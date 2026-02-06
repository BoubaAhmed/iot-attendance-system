# routes/attendance.py
from flask import Blueprint, request, jsonify
from datetime import datetime
from firebase_config import firebase

attendance_bp = Blueprint('attendance', __name__)

def parse_session_id(session_id):
    """Parse session_id to extract date, room, time, and group"""
    try:
        # Format: YYYYMMDD_room_startTime_group
        parts = session_id.split('_')
        if len(parts) >= 4:
            date_str = parts[0]
            # In your data, rooms don't have underscores (roomA, roomB, infoA)
            # So the structure is always: date_room_time_group
            room = parts[1]
            start_time = parts[2]
            group = parts[3]
            
            # Convert date from YYYYMMDD to YYYY-MM-DD
            formatted_date = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
            return formatted_date, room, start_time, group
    except:
        pass
    return None, None, None, None

def get_subject_name(subject_code):
    """Get subject name from subject code"""
    if not subject_code:
        return None
    subject_data = firebase.get_one('subjects', subject_code)
    return subject_data.get('name') if subject_data else subject_code

def get_group_name(group_id):
    """Get group name from group ID"""
    if not group_id:
        return None
    group_data = firebase.get_one('groups', group_id)
    return group_data.get('name') if group_data else group_id

def get_room_name(room_id):
    """Get room name from room ID"""
    if not room_id:
        return None
    room_data = firebase.get_one('rooms', room_id)
    return room_data.get('name') if room_data else room_id

@attendance_bp.route('/api/attendance', methods=['GET'])
def get_attendance():
    """Get attendance with filters"""
    try:
        date = request.args.get('date')
        room = request.args.get('room')
        group = request.args.get('group')
        student_id = request.args.get('student_id')
        
        all_attendance = firebase.get_all('attendance') or {}
        all_sessions = firebase.get_all('sessions') or {}
        all_subjects = firebase.get_all('subjects') or {}
        filtered_attendance = []
        
        for session_id, attendance_record in all_attendance.items():
            if not isinstance(attendance_record, dict):
                continue
            
            # Parse session_id to get date, room, group
            session_date, session_room, session_time, session_group = parse_session_id(session_id)
            if not session_date:
                continue
            
            # Apply filters
            if date and session_date != date:
                continue
            if room and session_room != room:
                continue
            if group and session_group != group:
                continue
            
            # Get session details for more context
            session_details = None
            if session_date in all_sessions:
                date_sessions = all_sessions.get(session_date, {})
                if isinstance(date_sessions, dict) and session_room in date_sessions:
                    room_sessions = date_sessions.get(session_room, [])
                    if isinstance(room_sessions, list):
                        for session in room_sessions:
                            if isinstance(session, dict) and session.get('session_id') == session_id:
                                session_details = session
                                break
            
            # Process present students
            present_data = attendance_record.get('present', {})
            if isinstance(present_data, dict):
                for stud_id, record in present_data.items():
                    if not isinstance(record, dict):
                        continue
                    
                    if student_id and stud_id != student_id:
                        continue
                    
                    # Get student info
                    student_data = firebase.get_one('students', stud_id) or {}
                    
                    # Get subject name
                    subject_name = None
                    if session_details and session_details.get('subject'):
                        subject_code = session_details.get('subject')
                        subject_name = all_subjects.get(subject_code, {}).get('name', subject_code)
                    
                    filtered_attendance.append({
                        'date': session_date,
                        'session_id': session_id,
                        'group_id': session_group,
                        'group_name': get_group_name(session_group),
                        'student_id': stud_id,
                        'student_name': student_data.get('name') or record.get('name', 'Unknown'),
                        'status': 'PRESENT',
                        'time': record.get('time'),
                        'room': session_room,
                        'room_name': get_room_name(session_room),
                        'method': 'FINGERPRINT',
                        'session_start': session_time,
                        'session_end': session_details.get('end') if session_details else None,
                        'subject': session_details.get('subject') if session_details else None,
                        'subject_name': subject_name
                    })
            
            # Process absent students
            absent_data = attendance_record.get('absent', {})
            if isinstance(absent_data, dict):
                for stud_id, record in absent_data.items():
                    if not isinstance(record, dict):
                        continue
                    
                    if student_id and stud_id != student_id:
                        continue
                    
                    # Get student info
                    student_data = firebase.get_one('students', stud_id) or {}
                    
                    # Get subject name
                    subject_name = None
                    if session_details and session_details.get('subject'):
                        subject_code = session_details.get('subject')
                        subject_name = all_subjects.get(subject_code, {}).get('name', subject_code)
                    
                    filtered_attendance.append({
                        'date': session_date,
                        'session_id': session_id,
                        'group_id': session_group,
                        'group_name': get_group_name(session_group),
                        'student_id': stud_id,
                        'student_name': student_data.get('name') or record.get('name', 'Unknown'),
                        'status': 'ABSENT',
                        'time': None,
                        'room': session_room,
                        'room_name': get_room_name(session_room),
                        'method': 'MANUAL',
                        'session_start': session_time,
                        'session_end': session_details.get('end') if session_details else None,
                        'subject': session_details.get('subject') if session_details else None,
                        'subject_name': subject_name
                    })
        
        # Sort by date (descending) and time (descending)
        filtered_attendance.sort(key=lambda x: (
            x.get('date', ''),
            x.get('session_start', '')
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
        # Get all attendance data
        all_attendance = firebase.get_all('attendance') or {}
        all_sessions = firebase.get_all('sessions') or {}
        all_subjects = firebase.get_all('subjects') or {}
        
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
            'sessions': [],
            'students': group_students,
            'summary': {
                'total_students': len(group_students),
                'total_present': 0,
                'total_absent': 0,
                'attendance_rate': 0
            }
        }
        
        # Find attendance records for this group and date
        for session_id, attendance_record in all_attendance.items():
            if not isinstance(attendance_record, dict):
                continue
            
            # Parse session_id
            session_date, session_room, session_time, session_group = parse_session_id(session_id)
            if session_date != date or session_group != group_id:
                continue
            
            # Get session details
            session_details = None
            if date in all_sessions:
                date_sessions = all_sessions.get(date, {})
                if isinstance(date_sessions, dict) and session_room in date_sessions:
                    room_sessions = date_sessions.get(session_room, [])
                    if isinstance(room_sessions, list):
                        for session in room_sessions:
                            if isinstance(session, dict) and session.get('session_id') == session_id:
                                session_details = session
                                break
            
            # Get subject name
            subject_name = None
            if session_details and session_details.get('subject'):
                subject_code = session_details.get('subject')
                subject_name = all_subjects.get(subject_code, {}).get('name', subject_code)
            
            # Get present and absent lists
            present_list = []
            absent_list = []
            
            present_data = attendance_record.get('present', {})
            if isinstance(present_data, dict):
                for stud_id, record in present_data.items():
                    if isinstance(record, dict):
                        student_info = firebase.get_one('students', stud_id) or {}
                        present_list.append({
                            'student_id': stud_id,
                            'name': student_info.get('name', record.get('name', 'Unknown')),
                            'time': record.get('time')
                        })
            
            absent_data = attendance_record.get('absent', {})
            if isinstance(absent_data, dict):
                for stud_id, record in absent_data.items():
                    if isinstance(record, dict):
                        student_info = firebase.get_one('students', stud_id) or {}
                        absent_list.append({
                            'student_id': stud_id,
                            'name': student_info.get('name', record.get('name', 'Unknown'))
                        })
            
            session_info = {
                'session_id': session_id,
                'room': session_room,
                'room_name': get_room_name(session_room),
                'start_time': session_time,
                'end_time': session_details.get('end') if session_details else None,
                'subject': session_details.get('subject') if session_details else None,
                'subject_name': subject_name,
                'status': session_details.get('status') if session_details else None,
                'present': present_list,
                'absent': absent_list,
                'present_count': len(present_list),
                'absent_count': len(absent_list)
            }
            
            result['sessions'].append(session_info)
            result['summary']['total_present'] += len(present_list)
            result['summary']['total_absent'] += len(absent_list)
        
        # Calculate attendance rate
        total_counted = result['summary']['total_present'] + result['summary']['total_absent']
        if total_counted > 0:
            result['summary']['attendance_rate'] = round(
                (result['summary']['total_present'] / total_counted) * 100, 2
            )
        
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
        all_sessions = firebase.get_all('sessions') or {}
        all_subjects = firebase.get_all('subjects') or {}
        student_attendance = []
        
        # Search for student in all attendance records
        for session_id, attendance_record in all_attendance.items():
            if not isinstance(attendance_record, dict):
                continue
            
            # Parse session_id to get date and group
            session_date, session_room, session_time, session_group = parse_session_id(session_id)
            if not session_date:
                continue
            
            # Filter by date range
            if start_date and session_date < start_date:
                continue
            if end_date and session_date > end_date:
                continue
            
            # Filter by student's group (optional, but good for validation)
            if session_group != group_id:
                continue
            
            # Get session details
            session_details = None
            if session_date in all_sessions:
                date_sessions = all_sessions.get(session_date, {})
                if isinstance(date_sessions, dict) and session_room in date_sessions:
                    room_sessions = date_sessions.get(session_room, [])
                    if isinstance(room_sessions, list):
                        for session in room_sessions:
                            if isinstance(session, dict) and session.get('session_id') == session_id:
                                session_details = session
                                break
            
            # Get subject name
            subject_name = None
            if session_details and session_details.get('subject'):
                subject_code = session_details.get('subject')
                subject_name = all_subjects.get(subject_code, {}).get('name', subject_code)
            
            # Check present list
            present_data = attendance_record.get('present', {})
            if student_id in present_data:
                record = present_data[student_id]
                student_attendance.append({
                    'date': session_date,
                    'session_id': session_id,
                    'group_id': session_group,
                    'group_name': get_group_name(session_group),
                    'status': 'PRESENT',
                    'time': record.get('time'),
                    'room': session_room,
                    'room_name': get_room_name(session_room),
                    'session_start': session_time,
                    'session_end': session_details.get('end') if session_details else None,
                    'subject': session_details.get('subject') if session_details else None,
                    'subject_name': subject_name
                })
            # Check absent list
            elif student_id in attendance_record.get('absent', {}):
                record = attendance_record['absent'][student_id]
                student_attendance.append({
                    'date': session_date,
                    'session_id': session_id,
                    'group_id': session_group,
                    'group_name': get_group_name(session_group),
                    'status': 'ABSENT',
                    'time': None,
                    'room': session_room,
                    'room_name': get_room_name(session_room),
                    'session_start': session_time,
                    'session_end': session_details.get('end') if session_details else None,
                    'subject': session_details.get('subject') if session_details else None,
                    'subject_name': subject_name
                })
        
        # Sort by date (descending)
        student_attendance.sort(key=lambda x: x.get('date', ''), reverse=True)
        
        # Calculate stats
        total_sessions = len(student_attendance)
        present_sessions = sum(1 for a in student_attendance if a['status'] == 'PRESENT')
        absent_sessions = sum(1 for a in student_attendance if a['status'] == 'ABSENT')
        attendance_rate = 0
        if total_sessions > 0:
            attendance_rate = round((present_sessions / total_sessions) * 100, 2)
        
        return jsonify({
            'success': True,
            'student': student_data,
            'data': student_attendance,
            'count': len(student_attendance),
            'stats': {
                'total_sessions': total_sessions,
                'present': present_sessions,
                'absent': absent_sessions,
                'attendance_rate': attendance_rate
            }
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
        
        today = datetime.now().strftime('%Y%m%d')
        formatted_today = datetime.now().strftime('%Y-%m-%d')
        group_id = student_data.get('group')
        
        # Get all attendance data
        all_attendance = firebase.get_all('attendance') or {}
        attendance_records = []
        
        # Search for today's attendance records for this student
        for session_id, attendance_record in all_attendance.items():
            if not isinstance(attendance_record, dict):
                continue
            
            # Parse session_id to get date and group
            session_date_str = session_id.split('_')[0] if '_' in session_id else ''
            if session_date_str != today:
                continue
            
            session_date, session_room, session_time, session_group = parse_session_id(session_id)
            if session_group != group_id:
                continue
            
            # Check present list
            present_data = attendance_record.get('present', {})
            if student_id in present_data:
                record = present_data[student_id]
                attendance_records.append({
                    'session_id': session_id,
                    'status': 'PRESENT',
                    'time': record.get('time'),
                    'room': session_room,
                    'room_name': get_room_name(session_room),
                    'session_time': session_time
                })
            # Check absent list
            elif student_id in attendance_record.get('absent', {}):
                record = attendance_record['absent'][student_id]
                attendance_records.append({
                    'session_id': session_id,
                    'status': 'ABSENT',
                    'room': session_room,
                    'room_name': get_room_name(session_room),
                    'session_time': session_time
                })
        
        has_attendance_today = len(attendance_records) > 0
        is_absent = any(record['status'] == 'ABSENT' for record in attendance_records)
        
        return jsonify({
            'success': True,
            'student': student_data,
            'has_attendance_today': has_attendance_today,
            'is_absent': is_absent,
            'attendance_records': attendance_records,
            'date': formatted_today,
            'group_id': group_id
        })
    except Exception as e:
        print(f"Error checking today's attendance: {e}")
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
        
        # Convert date to YYYYMMDD format for session_id matching
        target_date_compact = target_date.replace('-', '')
        
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
        all_attendance = firebase.get_all('attendance') or {}
        all_students = firebase.get_all('students') or {}
        
        for group_key, group_data in all_groups.items():
            if group_id and group_key != group_id:
                continue
            
            # Get students in this group
            group_students = []
            for student_key, student in all_students.items():
                if isinstance(student, dict) and student.get('group') == group_key:
                    group_students.append(student_key)
            
            # Count attendance for this group on the specified date
            present_count = 0
            absent_count = 0
            
            # Find attendance records for this group and date
            for session_id, attendance_record in all_attendance.items():
                if not isinstance(attendance_record, dict):
                    continue
                
                # Parse session_id
                session_date_str = session_id.split('_')[0] if '_' in session_id else ''
                if session_date_str != target_date_compact:
                    continue
                
                session_date, _, _, session_group = parse_session_id(session_id)
                if session_group != group_key:
                    continue
                
                # Count present
                present_data = attendance_record.get('present', {})
                if isinstance(present_data, dict):
                    present_count += len(present_data)
                
                # Count absent
                absent_data = attendance_record.get('absent', {})
                if isinstance(absent_data, dict):
                    absent_count += len(absent_data)
            
            total_students = len(group_students)
            total_counted = present_count + absent_count
            
            # Use the higher count between group students and counted attendance
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
                'attendance_rate': attendance_rate
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
        today = datetime.now().strftime('%Y%m%d')
        formatted_today = datetime.now().strftime('%Y-%m-%d')
        
        # Check if room exists
        room_data = firebase.get_one('rooms', room_id)
        if not room_data:
            return jsonify({'success': False, 'error': 'Room not found'}), 404
        
        # Get all attendance data
        all_attendance = firebase.get_all('attendance') or {}
        all_sessions = firebase.get_all('sessions') or {}
        attendance_records = []
        
        # Find attendance records for today and this room
        for session_id, attendance_record in all_attendance.items():
            if not isinstance(attendance_record, dict):
                continue
            
            # Parse session_id
            session_date_str = session_id.split('_')[0] if '_' in session_id else ''
            if session_date_str != today:
                continue
            
            session_date, session_room, session_time, session_group = parse_session_id(session_id)
            if session_room != room_id:
                continue
            
            # Get session details
            session_details = None
            if session_date in all_sessions:
                date_sessions = all_sessions.get(session_date, {})
                if isinstance(date_sessions, dict) and session_room in date_sessions:
                    room_sessions = date_sessions.get(session_room, [])
                    if isinstance(room_sessions, list):
                        for session in room_sessions:
                            if isinstance(session, dict) and session.get('session_id') == session_id:
                                session_details = session
                                break
            
            # Process present students
            present_data = attendance_record.get('present', {})
            for student_id, attendance_info in present_data.items():
                if not isinstance(attendance_info, dict):
                    continue
                
                student_data = firebase.get_one('students', student_id) or {}
                
                attendance_records.append({
                    'session_id': session_id,
                    'group': session_group,
                    'group_name': get_group_name(session_group),
                    'student_id': student_id,
                    'student_name': student_data.get('name', 'Unknown'),
                    'attendance_time': attendance_info.get('time'),
                    'status': 'PRESENT',
                    'session_time': session_time,
                    'session_end': session_details.get('end') if session_details else None,
                    'subject': session_details.get('subject') if session_details else None
                })
            
            # Process absent students
            absent_data = attendance_record.get('absent', {})
            for student_id, attendance_info in absent_data.items():
                if not isinstance(attendance_info, dict):
                    continue
                
                student_data = firebase.get_one('students', student_id) or {}
                
                attendance_records.append({
                    'session_id': session_id,
                    'group': session_group,
                    'group_name': get_group_name(session_group),
                    'student_id': student_id,
                    'student_name': student_data.get('name', 'Unknown'),
                    'attendance_time': None,
                    'status': 'ABSENT',
                    'session_time': session_time,
                    'session_end': session_details.get('end') if session_details else None,
                    'subject': session_details.get('subject') if session_details else None
                })
        
        return jsonify({
            'success': True,
            'room': room_data,
            'date': formatted_today,
            'attendance': attendance_records,
            'count': len(attendance_records),
            'summary': {
                'present': sum(1 for r in attendance_records if r['status'] == 'PRESENT'),
                'absent': sum(1 for r in attendance_records if r['status'] == 'ABSENT'),
                'sessions': len(set(r['session_id'] for r in attendance_records))
            }
        })
    except Exception as e:
        print(f"Error getting today's attendance for room: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500