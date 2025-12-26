# utils.py
from datetime import datetime, timedelta
from firebase_config import firebase

def get_day_of_week(date_str=None):
    """Convert date to weekday (in English)"""
    if date_str:
        date_obj = datetime.strptime(date_str, '%Y-%m-%d')
    else:
        date_obj = datetime.now()
    
    days_fr_to_en = {
        'lundi': 'monday',
        'mardi': 'tuesday',
        'mercredi': 'wednesday',
        'jeudi': 'thursday',
        'vendredi': 'friday',
        'samedi': 'saturday',
        'dimanche': 'sunday'
    }
    
    day_fr = date_obj.strftime('%A').lower()
    return days_fr_to_en.get(day_fr, day_fr)

def get_room_by_esp32_id(esp32_id):
    """Find room by ESP32 ID"""
    rooms = firebase.get_all('rooms') or {}
    for room_id, room_data in rooms.items():
        if room_data.get('esp32_id') == esp32_id:
            return room_id, room_data
    return None, None

def get_active_session_for_room(room_id):
    """Find active session for a room"""
    try:
        now = datetime.now()
        current_date = now.strftime('%Y-%m-%d')
        current_time = now.strftime('%H:%M')
        
        # Get today's sessions
        today_sessions = firebase.get_all(f'sessions/{current_date}') or {}
        
        for room_session_data in today_sessions.values():
            if isinstance(room_session_data, dict):
                if (room_session_data.get('room') == room_id and 
                    room_session_data.get('status') == 'ACTIVE' and
                    room_session_data.get('start') <= current_time <= room_session_data.get('end')):
                    return room_session_data
        
        return None
    except Exception as e:
        print(f"Error in get_active_session_for_room: {e}")
        return None

def get_today_schedule_for_room(room_id):
    """Get today's schedule for a room"""
    try:
        today_day = get_day_of_week()
        schedule = firebase.get_all(f'schedule/{room_id}') or {}
        return schedule.get(today_day, {})
    except Exception as e:
        print(f"Error in get_today_schedule_for_room: {e}")
        return {}

# utils.py - Update the get_student_by_fingerprint function
def get_student_by_fingerprint(fingerprint_id):
    """Find student by fingerprint ID"""
    try:
        students = firebase.get_all('students') or []
        for student in students:
            if isinstance(student, dict) and student.get('fingerprint_id') == fingerprint_id:
                return student
        return None
    except Exception as e:
        print(f"Error in get_student_by_fingerprint: {e}")
        return None

def check_for_scheduled_session(esp32_id):
    """Check if there's a scheduled session for ESP32"""
    try:
        room_id, room = get_room_by_esp32_id(esp32_id)
        if not room or not room.get('active', True):
            return None, "Room not found or inactive"
        
        today = datetime.now().strftime('%Y-%m-%d')
        current_time = datetime.now().strftime('%H:%M')
        
        # Get today's schedule
        today_schedule = get_today_schedule_for_room(room_id)
        
        if not today_schedule:
            return None, "No classes scheduled for today"
        
        # Find current time slot
        for time_slot, slot_data in today_schedule.items():
            if isinstance(slot_data, dict):
                start_time, end_time = time_slot.split('-')
                
                # If we're in the time slot
                if start_time <= current_time <= end_time:
                    # Check if session already exists
                    session_data = firebase.get_all(f'sessions/{today}/{room_id}')
                    
                    if not session_data:
                        # Create scheduled session
                        session_data = {
                            'date': today,
                            'room': room_id,
                            'room_name': room.get('name'),
                            'start': start_time,
                            'end': end_time,
                            'group': slot_data.get('group'),
                            'subject': slot_data.get('subject'),
                            'status': 'SCHEDULED',
                            'created_at': datetime.now().isoformat()
                        }
                        firebase.update('sessions', f'{today}/{room_id}', session_data)
                        return f'{today}/{room_id}', session_data
                    else:
                        return f'{today}/{room_id}', session_data
        
        # Check slots in next 15 minutes
        for time_slot, slot_data in today_schedule.items():
            if isinstance(slot_data, dict):
                start_time, end_time = time_slot.split('-')
                start_datetime = datetime.strptime(f"{today} {start_time}", "%Y-%m-%d %H:%M")
                time_diff = (start_datetime - datetime.now()).total_seconds() / 60
                
                if 0 < time_diff <= 15:  # In next 15 minutes
                    session_data = firebase.get_all(f'sessions/{today}/{room_id}')
                    
                    if not session_data:
                        session_data = {
                            'date': today,
                            'room': room_id,
                            'room_name': room.get('name'),
                            'start': start_time,
                            'end': end_time,
                            'group': slot_data.get('group'),
                            'subject': slot_data.get('subject'),
                            'status': 'SCHEDULED',
                            'created_at': datetime.now().isoformat()
                        }
                        firebase.update('sessions', f'{today}/{room_id}', session_data)
                        return f'{today}/{room_id}', session_data
                    else:
                        return f'{today}/{room_id}', session_data
        
        return None, "No class at this moment or in next 15 minutes"
        
    except Exception as e:
        print(f"Error in check_for_scheduled_session: {e}")
        return None, str(e)

def calculate_session_stats(date, room_id, group_id):
    """Calculate session statistics and mark absences"""
    try:
        # Get all students
        all_students = firebase.get_all('students') or []
        students_in_group = []
        
        for student in all_students:
            if isinstance(student, dict) and student.get('group') == group_id:
                students_in_group.append(student)
        
        # Get attendance for this date and group
        attendance_path = f'attendance/{date}/{group_id}'
        group_attendance = firebase.get_all(attendance_path) or []
        
        present_count = 0
        absent_count = 0
        attendance_list = []
        
        # Check each student in group
        for student in students_in_group:
            student_found = False
            
            for attendance_record in group_attendance:
                if isinstance(attendance_record, dict) and attendance_record.get('student_id') == str(student.get('fingerprint_id')):
                    student_found = True
                    if attendance_record.get('status') == 'PRESENT':
                        present_count += 1
                        attendance_list.append({
                            'student_id': student.get('fingerprint_id'),
                            'name': student.get('name'),
                            'status': 'PRESENT',
                            'created_at': attendance_record.get('created_at'),
                            'method': 'FINGERPRINT'
                        })
                    break
            
            if not student_found:
                absent_count += 1
                attendance_list.append({
                    'student_id': student.get('fingerprint_id'),
                    'name': student.get('name'),
                    'status': 'ABSENT',
                    'created_at': None,
                    'method': None
                })
                
                # Mark as absent
                absent_data = {
                    'status': 'ABSENT',
                    'student_id': str(student.get('fingerprint_id')),
                    'created_at': datetime.now().isoformat()
                }
                # Add to attendance array
                new_attendance = group_attendance + [absent_data]
                firebase.update('attendance', f'{date}/{group_id}', new_attendance)
        
        total = present_count + absent_count
        
        # Update session stats
        stats = {
            'total': total,
            'present': present_count,
            'absent': absent_count,
            'attendance_rate': round((present_count / total * 100), 2) if total > 0 else 0,
            'attendance_list': attendance_list
        }
        
        # Update session
        session_data = firebase.get_all(f'sessions/{date}/{room_id}') or {}
        if isinstance(session_data, dict):
            session_data['stats'] = stats
            firebase.update('sessions', f'{date}/{room_id}', session_data)
        
        return stats
    except Exception as e:
        print(f"Error in calculate_session_stats: {e}")
        return None

def get_next_session_id():
    """Generate next student ID"""
    students = firebase.get_all('students') or []
    if not students:
        return 1
    
    # Find max fingerprint_id
    max_id = 0
    for student in students:
        if isinstance(student, dict):
            fid = student.get('fingerprint_id')
            if fid and fid > max_id:
                max_id = fid
    
    return max_id + 1