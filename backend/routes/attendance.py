# routes/attendance.py
from flask import Blueprint, request, jsonify
from datetime import datetime, date as date_type
from firebase_config import firebase

attendance_bp = Blueprint('attendance', __name__)

def get_room_by_esp32_id(esp32_id):
    """Find room by ESP32 ID, returns (room_id, room_data)"""
    try:
        rooms = firebase.get_all('rooms') or {}
        for room_id, room_data in rooms.items():
            if isinstance(room_data, dict) and room_data.get('esp32_id') == esp32_id:
                return room_id, room_data
        return None, None
    except Exception as e:
        print(f"Error in get_room_by_esp32_id: {e}")
        return None, None

def get_student_by_fingerprint(fingerprint_id):
    """Get student by fingerprint ID, returns (student_id, student_data)"""
    try:
        students = firebase.get_all('students') or {}
        for student_id, student_data in students.items():
            if isinstance(student_data, dict) and student_data.get('fingerprint_id') == fingerprint_id:
                return student_id, student_data
        return None, None
    except Exception as e:
        print(f"Error in get_student_by_fingerprint: {e}")
        return None, None

def get_active_session_for_room(room_id):
    """Find active session for room at current time"""
    try:
        today = datetime.now().strftime('%Y-%m-%d')
        current_time = datetime.now().strftime('%H:%M')
        
        # Get sessions for today
        sessions_data = firebase.get_all(f'sessions/{today}') or {}
        if not sessions_data:
            return None
        
        # Check if room has sessions today
        room_sessions = sessions_data.get(room_id)
        if not room_sessions:
            return None
        
        # Find session that matches current time
        current_dt = datetime.now()
        for session_key, session_data in room_sessions.items():
            if not isinstance(session_data, dict):
                continue
            
            start_time = session_data.get('start')
            end_time = session_data.get('end')
            if not start_time or not end_time:
                continue
            
            # Convert times to datetime objects for comparison
            try:
                start_dt = datetime.strptime(f"{today} {start_time}", "%Y-%m-%d %H:%M")
                end_dt = datetime.strptime(f"{today} {end_time}", "%Y-%m-%d %H:%M")
                
                # Check if current time is within session time
                if start_dt <= current_dt <= end_dt:
                    return session_data
            except ValueError:
                continue
        
        return None
    except Exception as e:
        print(f"Error in get_active_session_for_room: {e}")
        return None

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
        student_id, student_data = get_student_by_fingerprint(fingerprint_id)
        if not student_data:
            return jsonify({'success': False, 'error': 'Student not found'}), 404
        
        # Check if student is active
        if not student_data.get('active', True):
            return jsonify({'success': False, 'error': 'Student is not active'}), 400
        
        # Find active session for this room
        session_data = get_active_session_for_room(room_id)
        if not session_data:
            return jsonify({'success': False, 'error': 'No active session in this room'}), 404
        
        # Check if student belongs to session group
        group_id = session_data.get('group')
        if student_data.get('group') != group_id:
            return jsonify({'success': False, 'error': 'Student does not belong to session group'}), 400
        
        # Record attendance
        today = datetime.now().strftime('%Y-%m-%d')
        now = datetime.now()
        current_time = now.strftime('%H:%M')
        
        # Check if attendance already exists for today
        attendance_path = f'attendance/{group_id}/{today}/present/{student_id}'
        existing_attendance = firebase.get_one('attendance', attendance_path)
        
        if existing_attendance:
            return jsonify({
                'success': True,
                'message': 'Attendance already recorded today',
                'data': {
                    'session': f'{today}/{room_id}',
                    'student': student_data.get('name'),
                    'room': room.get('name'),
                    'group': group_id,
                    'time': existing_attendance.get('time'),
                    'already_recorded': True
                }
            })
        
        # Remove from absent list if present
        absent_path = f'attendance/{group_id}/{today}/absent/{student_id}'
        existing_absent = firebase.get_one('attendance', absent_path)
        if existing_absent:
            firebase.delete('attendance', f'{group_id}/{today}/absent/{student_id}')
        
        # Create attendance record
        attendance_record = {
            'name': student_data.get('name'),
            'time': current_time,
            'room': room.get('name'),
            'fingerprint_id': fingerprint_id,
            'timestamp': now.isoformat(),
            'room_id': room_id,
            'session_subject': session_data.get('subject'),
            'session_time': f"{session_data.get('start')}-{session_data.get('end')}"
        }
        
        # Save attendance
        firebase.update('attendance', f'{group_id}/{today}/present/{student_id}', attendance_record)
        
        return jsonify({
            'success': True,
            'message': 'Attendance recorded',
            'data': {
                'session': f'{today}/{room_id}',
                'student': student_data.get('name'),
                'room': room.get('name'),
                'group': group_id,
                'time': current_time,
                'method': 'FINGERPRINT',
                'student_id': student_id,
                'subject': session_data.get('subject')
            }
        })
    except Exception as e:
        print(f"Error recording attendance: {e}")
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
        
        for group_id, dates_data in all_attendance.items():
            if group and group_id != group:
                continue
            
            if not isinstance(dates_data, dict):
                continue
            
            for attendance_date, status_data in dates_data.items():
                if date and attendance_date != date:
                    continue
                
                if not isinstance(status_data, dict):
                    continue
                
                # Get group info
                group_data = firebase.get_one('groups', group_id) or {}
                group_name = group_data.get('name', group_id)
                
                # Process present students
                present_data = status_data.get('present', {})
                if isinstance(present_data, dict):
                    for stud_id, record in present_data.items():
                        if not isinstance(record, dict):
                            continue
                        
                        if student_id and stud_id != student_id:
                            continue
                        
                        if room and record.get('room') != room:
                            continue
                        
                        # Get student info
                        student_data = firebase.get_one('students', stud_id) or {}
                        
                        filtered_attendance.append({
                            'date': attendance_date,
                            'group_id': group_id,
                            'group_name': group_name,
                            'student_id': stud_id,
                            'student_name': student_data.get('name') or record.get('name', 'Unknown'),
                            'status': 'PRESENT',
                            'time': record.get('time'),
                            'room': record.get('room'),
                            'method': 'FINGERPRINT',
                            'timestamp': record.get('timestamp'),
                            'subject': record.get('session_subject'),
                            'session_time': record.get('session_time')
                        })
                
                # Process absent students
                absent_data = status_data.get('absent', {})
                if isinstance(absent_data, dict):
                    for stud_id, record in absent_data.items():
                        if not isinstance(record, dict):
                            continue
                        
                        if student_id and stud_id != student_id:
                            continue
                        
                        # Get student info
                        student_data = firebase.get_one('students', stud_id) or {}
                        
                        filtered_attendance.append({
                            'date': attendance_date,
                            'group_id': group_id,
                            'group_name': group_name,
                            'student_id': stud_id,
                            'student_name': student_data.get('name') or record.get('name', 'Unknown'),
                            'status': 'ABSENT',
                            'time': None,
                            'room': None,
                            'method': 'MANUAL',
                            'timestamp': record.get('timestamp'),
                            'subject': None,
                            'session_time': None
                        })
        
        # Sort by date (descending) and time (descending)
        filtered_attendance.sort(key=lambda x: (
            x.get('date', ''),
            x.get('time', '') if x.get('time') else '00:00'
        ), reverse=True)
        
        return jsonify({
            'success': True,
            'data': filtered_attendance,
            'count': len(filtered_attendance)
        })
    except Exception as e:
        print(f"Error getting attendance: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@attendance_bp.route('/api/attendance/<group_id>/<date>', methods=['GET'])
def get_attendance_by_group_date(group_id, date):
    """Get attendance for specific group and date"""
    try:
        # Get attendance data
        attendance_data = firebase.get_one('attendance', f'{group_id}/{date}') or {}
        
        # Get group info
        group_data = firebase.get_one('groups', group_id) or {}
        
        # Get all students in this group
        all_students = firebase.get_all('students') or {}
        group_students = []
        
        for stud_id, student in all_students.items():
            if isinstance(student, dict) and student.get('group') == group_id:
                group_students.append({
                    'id': stud_id,
                    **student
                })
        
        result = {
            'date': date,
            'group': group_data,
            'present': [],
            'absent': [],
            'students': group_students,
            'summary': {
                'total_students': len(group_students),
                'total_present': 0,
                'total_absent': 0,
                'attendance_rate': 0
            }
        }
        
        # Process present students
        present_data = attendance_data.get('present', {})
        if isinstance(present_data, dict):
            for stud_id, record in present_data.items():
                if isinstance(record, dict):
                    student_info = firebase.get_one('students', stud_id) or {}
                    result['present'].append({
                        'student_id': stud_id,
                        **student_info,
                        'attendance_info': record
                    })
        
        # Process absent students
        absent_data = attendance_data.get('absent', {})
        if isinstance(absent_data, dict):
            for stud_id, record in absent_data.items():
                if isinstance(record, dict):
                    student_info = firebase.get_one('students', stud_id) or {}
                    result['absent'].append({
                        'student_id': stud_id,
                        **student_info,
                        'attendance_info': record
                    })
        
        # Calculate summary
        total_present = len(result['present'])
        total_absent = len(result['absent'])
        total_students = len(group_students)
        
        # If we have absent records, adjust total
        if total_absent > 0:
            total_counted = total_present + total_absent
            # Use whichever is larger: actual group count or counted attendance
            total_students = max(total_students, total_counted)
        
        attendance_rate = 0
        if total_students > 0:
            attendance_rate = round((total_present / total_students) * 100, 2)
        
        result['summary'] = {
            'total_students': total_students,
            'total_present': total_present,
            'total_absent': total_absent,
            'attendance_rate': attendance_rate
        }
        
        return jsonify({
            'success': True,
            'data': result
        })
    except Exception as e:
        print(f"Error getting attendance by group/date: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@attendance_bp.route('/api/attendance/student/<student_id>', methods=['GET'])
def get_attendance_by_student(student_id):
    """Get attendance for specific student"""
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        # Check if student exists
        student_data = firebase.get_one('students', student_id)
        if not student_data:
            return jsonify({'success': False, 'error': 'Student not found'}), 404
        
        group_id = student_data.get('group')
        
        # Get all attendance data
        all_attendance = firebase.get_all('attendance') or {}
        student_attendance = []
        
        # Check if the group exists in attendance
        if group_id in all_attendance:
            group_attendance = all_attendance[group_id]
            
            for date_str, status_data in group_attendance.items():
                # Filter by date
                if start_date and date_str < start_date:
                    continue
                if end_date and date_str > end_date:
                    continue
                
                # Check present list
                present_data = status_data.get('present', {})
                if student_id in present_data:
                    record = present_data[student_id]
                    student_attendance.append({
                        'date': date_str,
                        'group_id': group_id,
                        'status': 'PRESENT',
                        'time': record.get('time'),
                        'room': record.get('room'),
                        'method': 'FINGERPRINT',
                        'timestamp': record.get('timestamp'),
                        'subject': record.get('session_subject'),
                        'session_time': record.get('session_time')
                    })
                # Check absent list
                elif student_id in status_data.get('absent', {}):
                    record = status_data['absent'][student_id]
                    student_attendance.append({
                        'date': date_str,
                        'group_id': group_id,
                        'status': 'ABSENT',
                        'time': None,
                        'room': None,
                        'method': 'MANUAL',
                        'timestamp': record.get('timestamp'),
                        'subject': None,
                        'session_time': None
                    })
        
        # Sort by date (descending)
        student_attendance.sort(key=lambda x: x.get('date', ''), reverse=True)
        
        return jsonify({
            'success': True,
            'student': student_data,
            'data': student_attendance,
            'count': len(student_attendance)
        })
    except Exception as e:
        print(f"Error getting attendance by student: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@attendance_bp.route('/api/attendance/student/<student_id>/today', methods=['GET'])
def check_today_attendance(student_id):
    """Check if student has attendance recorded today"""
    try:
        # Check if student exists
        student_data = firebase.get_one('students', student_id)
        if not student_data:
            return jsonify({'success': False, 'error': 'Student not found'}), 404
        
        today = datetime.now().strftime('%Y-%m-%d')
        group_id = student_data.get('group')
        
        # Get today's attendance for student's group
        today_attendance_path = f'attendance/{group_id}/{today}'
        today_attendance = firebase.get_one('attendance', today_attendance_path) or {}
        
        # Check if student is present
        present_data = today_attendance.get('present', {})
        has_attendance_today = student_id in present_data
        attendance_record = present_data.get(student_id) if has_attendance_today else None
        
        # Check if student is absent
        absent_data = today_attendance.get('absent', {})
        is_absent = student_id in absent_data
        
        return jsonify({
            'success': True,
            'student': student_data,
            'has_attendance_today': has_attendance_today,
            'is_absent': is_absent,
            'attendance_record': attendance_record,
            'date': today,
            'group_id': group_id
        })
    except Exception as e:
        print(f"Error checking today's attendance: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@attendance_bp.route('/api/attendance/mark-absent', methods=['POST'])
def mark_absent():
    """Manually mark a student as absent"""
    try:
        data = request.get_json()
        
        required_fields = ['student_id', 'date', 'group_id']
        if not all(field in data for field in required_fields):
            return jsonify({
                'success': False,
                'error': f'Required fields: {required_fields}'
            }), 400
        
        student_id = data['student_id']
        date = data['date']
        group_id = data['group_id']
        
        # Check if student exists
        student_data = firebase.get_one('students', student_id)
        if not student_data:
            return jsonify({'success': False, 'error': 'Student not found'}), 404
        
        # Check if group exists
        group_data = firebase.get_one('groups', group_id)
        if not group_data:
            return jsonify({'success': False, 'error': 'Group not found'}), 404
        
        # Check if student is already marked absent
        absent_path = f'attendance/{group_id}/{date}/absent/{student_id}'
        existing_absent = firebase.get_one('attendance', absent_path)
        if existing_absent:
            return jsonify({
                'success': True,
                'message': 'Student already marked absent',
                'already_marked': True
            })
        
        # Check if student is marked present and remove from present
        present_path = f'attendance/{group_id}/{date}/present/{student_id}'
        existing_present = firebase.get_one('attendance', present_path)
        if existing_present:
            firebase.delete('attendance', f'{group_id}/{date}/present/{student_id}')
        
        # Mark as absent
        absent_data = {
            'name': student_data.get('name'),
            'timestamp': datetime.now().isoformat(),
            'marked_by': data.get('marked_by', 'admin'),
            'reason': data.get('reason', '')
        }
        
        firebase.update('attendance', f'{group_id}/{date}/absent/{student_id}', absent_data)
        
        return jsonify({
            'success': True,
            'message': 'Student marked as absent',
            'data': {
                'student_id': student_id,
                'name': student_data.get('name'),
                'date': date,
                'group_id': group_id,
                'group_name': group_data.get('name', group_id)
            }
        })
    except Exception as e:
        print(f"Error marking absent: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@attendance_bp.route('/api/attendance/stats', methods=['GET'])
def get_attendance_stats():
    """Get attendance statistics"""
    try:
        date_param = request.args.get('date')
        group_id = request.args.get('group_id')
        
        # Use today's date if not provided
        if date_param:
            target_date = date_param
        else:
            target_date = datetime.now().strftime('%Y-%m-%d')
        
        stats = {
            'date': target_date,
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
            attendance_path = f'attendance/{group_key}/{target_date}'
            group_attendance = firebase.get_one('attendance', attendance_path) or {}
            
            present_count = 0
            present_data = group_attendance.get('present', {})
            if isinstance(present_data, dict):
                present_count = len(present_data)
            
            absent_count = 0
            absent_data = group_attendance.get('absent', {})
            if isinstance(absent_data, dict):
                absent_count = len(absent_data)
            
            total_students = len(group_students)
            
            # If we have attendance records, use the higher count
            total_counted = present_count + absent_count
            if total_counted > total_students:
                total_students = total_counted
            
            attendance_rate = 0
            if total_students > 0:
                attendance_rate = round((present_count / total_students) * 100, 2)
            
            stats['by_group'][group_key] = {
                'group_name': group_data.get('name', group_key),
                'total_students': total_students,
                'present': present_count,
                'absent': absent_count,
                'attendance_rate': attendance_rate,
                'present_percentage': attendance_rate
            }
            
            stats['total_students'] += total_students
            stats['present'] += present_count
            stats['absent'] += absent_count
        
        # Calculate overall attendance rate
        if stats['total_students'] > 0:
            stats['attendance_rate'] = round((stats['present'] / stats['total_students']) * 100, 2)
        
        return jsonify({
            'success': True,
            'stats': stats
        })
    except Exception as e:
        print(f"Error getting attendance stats: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@attendance_bp.route('/api/attendance/room/<room_id>/today', methods=['GET'])
def get_today_attendance_for_room(room_id):
    """Get today's attendance for a specific room"""
    try:
        today = datetime.now().strftime('%Y-%m-%d')
        
        # Check if room exists
        room_data = firebase.get_one('rooms', room_id)
        if not room_data:
            return jsonify({'success': False, 'error': 'Room not found'}), 404
        
        # Get sessions for today in this room
        sessions_path = f'sessions/{today}/{room_id}'
        room_sessions = firebase.get_one('sessions', sessions_path) or {}
        
        attendance_records = []
        
        # For each session, get attendance
        for session_key, session_data in room_sessions.items():
            if not isinstance(session_data, dict):
                continue
            
            group_id = session_data.get('group')
            if not group_id:
                continue
            
            # Get attendance for this group today
            attendance_path = f'attendance/{group_id}/{today}'
            group_attendance = firebase.get_one('attendance', attendance_path) or {}
            
            # Process present students
            present_data = group_attendance.get('present', {})
            for student_id, attendance_info in present_data.items():
                if not isinstance(attendance_info, dict):
                    continue
                
                # Check if this attendance is for this room
                if attendance_info.get('room_id') == room_id:
                    student_data = firebase.get_one('students', student_id) or {}
                    
                    attendance_records.append({
                        'session': session_data,
                        'student_id': student_id,
                        'student_name': student_data.get('name'),
                        'attendance_time': attendance_info.get('time'),
                        'status': 'PRESENT',
                        'fingerprint_id': attendance_info.get('fingerprint_id')
                    })
        
        return jsonify({
            'success': True,
            'room': room_data,
            'date': today,
            'attendance': attendance_records,
            'count': len(attendance_records)
        })
    except Exception as e:
        print(f"Error getting today's attendance for room: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500