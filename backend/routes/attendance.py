# routes/attendance.py
from flask import Blueprint, request, jsonify
from datetime import datetime
from firebase_config import firebase
from utils import get_room_by_esp32_id, get_student_by_fingerprint, get_active_session_for_room

attendance_bp = Blueprint('attendance', __name__)

@attendance_bp.route('/api/attendance', methods=['POST'])
def record_attendance():
    """Record attendance (called by ESP32 - Fingerprint only)"""
    try:
        data = request.get_json()
        
        # Validation
        required_fields = ['esp32_id', 'fingerprint_id']
        if not all(field in data for field in required_fields):
            return jsonify({
                'success': False,
                'error': f'Required fields: {required_fields}'
            }), 400
        
        esp32_id = data['esp32_id']
        fingerprint_id = int(data['fingerprint_id'])
        
        # Find room by ESP32 ID
        room_id, room = get_room_by_esp32_id(esp32_id)
        if not room or not room.get('active', True):
            return jsonify({'success': False, 'error': 'Room not found or inactive'}), 404
        
        # Find student by fingerprint ID
        student = get_student_by_fingerprint(fingerprint_id)
        if not student:
            return jsonify({'success': False, 'error': 'Student not found'}), 404
        
        # Find active session for this room
        session_data = get_active_session_for_room(room_id)
        if not session_data:
            return jsonify({'success': False, 'error': 'No active session in this room'}), 404
        
        # Check if student belongs to session group
        group_id = session_data.get('group')
        if student.get('group') != group_id:
            return jsonify({'success': False, 'error': 'Student does not belong to session group'}), 400
        
        # Record attendance
        today = datetime.now().strftime('%Y-%m-%d')
        now = datetime.now()
        
        # Get existing attendance for this date and group
        existing_attendance = firebase.get_all(f'attendance/{today}/{group_id}') or {}
        
        # Check if student already marked present today
        for record_key, record_data in existing_attendance.items():
            if isinstance(record_data, dict) and record_data.get('student_id') == str(fingerprint_id):
                return jsonify({
                    'success': True,
                    'message': 'Attendance already recorded today',
                    'data': {
                        'session': f'{today}/{room_id}',
                        'student': student.get('name'),
                        'room': room.get('name'),
                        'group': group_id,
                        'time': now.strftime('%H:%M'),
                        'already_recorded': True
                    }
                })
        
        # Generate unique timestamp key
        timestamp = str(int(datetime.now().timestamp() * 1000))
        
        # Create attendance record
        attendance_data = {
            'student_id': str(fingerprint_id),
            'student_name': student.get('name'),
            'status': 'PRESENT',
            'created_at': now.isoformat(),
            'timestamp': timestamp,
            'room_id': room_id,
            'room_name': room.get('name'),
            'group': group_id
        }
        
        # Add new attendance record with timestamp as key
        firebase.update('attendance', f'{today}/{group_id}/{timestamp}', attendance_data)
        
        return jsonify({
            'success': True,
            'message': 'Attendance recorded',
            'data': {
                'session': f'{today}/{room_id}',
                'student': student.get('name'),
                'room': room.get('name'),
                'group': group_id,
                'time': now.strftime('%H:%M'),
                'method': 'FINGERPRINT',
                'timestamp': timestamp
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@attendance_bp.route('/api/attendance', methods=['GET'])
def get_attendance():
    """Get attendance with filters"""
    try:
        date = request.args.get('date')
        room = request.args.get('room')
        group = request.args.get('group')
        student_id = request.args.get('student_id')
        
        all_attendance = firebase.get_all('attendance') or {}
        filtered_attendance = []
        
        for attendance_date, groups_data in all_attendance.items():
            if date and attendance_date != date:
                continue
            
            if not isinstance(groups_data, dict):
                continue
            
            for group_id, attendance_records in groups_data.items():
                if group and group_id != group:
                    continue
                
                # Get group info
                group_data = firebase.get_one('groups', group_id) or {}
                
                if not isinstance(attendance_records, dict):
                    continue
                
                for record_key, record in attendance_records.items():
                    if not isinstance(record, dict):
                        continue
                    
                    if student_id and record.get('student_id') != student_id:
                        continue
                    
                    # Get student info
                    student_fingerprint_id = record.get('student_id')
                    student = None
                    if student_fingerprint_id:
                        try:
                            student = get_student_by_fingerprint(int(student_fingerprint_id))
                        except:
                            student = None
                    
                    filtered_attendance.append({
                        'date': attendance_date,
                        'group': group_id,
                        'group_name': group_data.get('name', group_id),
                        'record_id': record_key,
                        'student_id': record.get('student_id'),
                        'student_name': student.get('name') if student else record.get('student_name', 'Unknown'),
                        'status': record.get('status', 'PRESENT'),
                        'created_at': record.get('created_at'),
                        'method': 'FINGERPRINT',
                        'room_id': record.get('room_id'),
                        'room_name': record.get('room_name')
                    })
        
        # Sort by date and time
        filtered_attendance.sort(key=lambda x: (x.get('date', ''), x.get('created_at', '')), reverse=True)
        
        return jsonify({
            'success': True,
            'data': filtered_attendance,
            'count': len(filtered_attendance)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@attendance_bp.route('/api/attendance/<date>/<group_id>', methods=['GET'])
def get_attendance_by_date_group(date, group_id):
    """Get attendance for specific date and group"""
    try:
        attendance_data = firebase.get_all(f'attendance/{date}/{group_id}') or {}
        
        # Get group info
        group_data = firebase.get_one('groups', group_id) or {}
        
        # Convert dictionary to list of records
        attendance_list = []
        if isinstance(attendance_data, dict):
            for record_key, record in attendance_data.items():
                if isinstance(record, dict):
                    # Get student info if available
                    student = None
                    student_id = record.get('student_id')
                    if student_id:
                        try:
                            student = get_student_by_fingerprint(int(student_id))
                        except:
                            student = None
                    
                    attendance_list.append({
                        **record,
                        'record_id': record_key,
                        'student_name': student.get('name') if student else record.get('student_name', 'Unknown'),
                        'group_name': group_data.get('name', group_id)
                    })
        
        # Sort by creation time
        attendance_list.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        
        return jsonify({
            'success': True,
            'date': date,
            'group': group_data,
            'data': attendance_list,
            'count': len(attendance_list)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@attendance_bp.route('/api/attendance/student/<int:fingerprint_id>', methods=['GET'])
def get_attendance_by_student(fingerprint_id):
    """Get attendance for specific student"""
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        # Check if student exists
        student = get_student_by_fingerprint(fingerprint_id)
        if not student:
            return jsonify({'success': False, 'error': 'Student not found'}), 404
        
        all_attendance = firebase.get_all('attendance') or {}
        student_attendance = []
        
        for date, groups_data in all_attendance.items():
            # Filter by date
            if start_date and date < start_date:
                continue
            if end_date and date > end_date:
                continue
            
            if not isinstance(groups_data, dict):
                continue
            
            for group_id, attendance_records in groups_data.items():
                # Only check if student is in this group
                if student.get('group') != group_id:
                    continue
                
                if not isinstance(attendance_records, dict):
                    continue
                
                for record_key, record in attendance_records.items():
                    if isinstance(record, dict) and record.get('student_id') == str(fingerprint_id):
                        student_attendance.append({
                            'date': date,
                            'group': group_id,
                            'record_id': record_key,
                            'status': record.get('status', 'PRESENT'),
                            'created_at': record.get('created_at'),
                            'method': 'FINGERPRINT',
                            'room_id': record.get('room_id'),
                            'room_name': record.get('room_name')
                        })
        
        # Sort by date
        student_attendance.sort(key=lambda x: x.get('date', ''), reverse=True)
        
        return jsonify({
            'success': True,
            'student': student,
            'data': student_attendance,
            'count': len(student_attendance)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@attendance_bp.route('/api/attendance/student/<int:fingerprint_id>/today', methods=['GET'])
def check_today_attendance(fingerprint_id):
    """Check if student has attendance recorded today"""
    try:
        # Check if student exists
        student = get_student_by_fingerprint(fingerprint_id)
        if not student:
            return jsonify({'success': False, 'error': 'Student not found'}), 404
        
        today = datetime.now().strftime('%Y-%m-%d')
        group_id = student.get('group')
        
        # Get today's attendance for student's group
        today_attendance = firebase.get_all(f'attendance/{today}/{group_id}') or {}
        
        # Check if student has attendance today
        has_attendance_today = False
        attendance_record = None
        
        if isinstance(today_attendance, dict):
            for record_key, record in today_attendance.items():
                if isinstance(record, dict) and record.get('student_id') == str(fingerprint_id):
                    has_attendance_today = True
                    attendance_record = {
                        'record_id': record_key,
                        **record
                    }
                    break
        
        return jsonify({
            'success': True,
            'student': student,
            'has_attendance_today': has_attendance_today,
            'attendance_record': attendance_record,
            'date': today,
            'group': group_id
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@attendance_bp.route('/api/attendance/stats', methods=['GET'])
def get_attendance_stats():
    """Get attendance statistics"""
    try:
        date = request.args.get('date', datetime.now().strftime('%Y-%m-%d'))
        group_id = request.args.get('group')
        
        stats = {
            'date': date,
            'total_students': 0,
            'present': 0,
            'absent': 0,
            'attendance_rate': 0,
            'by_group': {}
        }
        
        # Get all groups
        all_groups = firebase.get_all('groups') or {}
        
        for group_key, group_data in all_groups.items():
            if group_id and group_key != group_id:
                continue
            
            # Get students in this group
            group_students = []
            all_students = firebase.get_all('students') or {}
            for student_key, student in all_students.items():
                if isinstance(student, dict) and student.get('group') == group_key:
                    group_students.append(student_key)
            
            # Get attendance for this group on the specified date
            group_attendance = firebase.get_all(f'attendance/{date}/{group_key}') or {}
            
            present_count = 0
            if isinstance(group_attendance, dict):
                present_count = len(group_attendance)
            
            absent_count = len(group_students) - present_count
            attendance_rate = (present_count / len(group_students) * 100) if group_students else 0
            
            stats['by_group'][group_key] = {
                'group_name': group_data.get('name', group_key),
                'total_students': len(group_students),
                'present': present_count,
                'absent': absent_count,
                'attendance_rate': round(attendance_rate, 2)
            }
            
            stats['total_students'] += len(group_students)
            stats['present'] += present_count
        
        stats['absent'] = stats['total_students'] - stats['present']
        if stats['total_students'] > 0:
            stats['attendance_rate'] = round((stats['present'] / stats['total_students']) * 100, 2)
        
        return jsonify({
            'success': True,
            'stats': stats
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500