# utils.py
from datetime import datetime, timedelta
from firebase_config import firebase

# utils.py (add these functions if not present)

def get_day_of_week(date_str):
    """Get day of week from date string"""
    from datetime import datetime
    date_obj = datetime.strptime(date_str, '%Y-%m-%d')
    days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    return days[date_obj.weekday()]

def get_room_by_esp32_id(esp32_id):
    """Get room by ESP32 ID"""
    rooms = firebase.get_all('rooms') or {}
    for room_id, room_data in rooms.items():
        if isinstance(room_data, dict) and room_data.get('esp32_id') == esp32_id:
            return room_id, room_data
    return None, None

def check_for_scheduled_session(esp32_id):
    """Check if there's a scheduled session for ESP32"""
    room_id, room = get_room_by_esp32_id(esp32_id)
    if not room_id:
        return None, "Room not found for ESP32"
    
    today = datetime.now().strftime('%Y-%m-%d')
    current_time = datetime.now().strftime('%H:%M')
    
    # Get all sessions for today
    sessions = firebase.get_all('sessions') or {}
    
    for session_key, session in sessions.items():
        if (isinstance(session, dict) and
            session.get('date') == today and
            session.get('room') == room_id and
            session.get('status') in ['SCHEDULED', 'ACTIVE']):
            
            session_start = session.get('start')
            session_end = session.get('end')
            
            if session_start <= current_time <= session_end:
                return session_key, session
    
    return None, "No scheduled session found"

def calculate_session_stats(date, room_id, group_id):
    """Calculate attendance statistics for a session"""
    try:
        # Get attendance for this group and date
        attendance = firebase.get_one('attendance', f'{group_id}/{date}') or {}
        
        present_count = len(attendance.get('present', {}))
        absent_count = len(attendance.get('absent', {}))
        total_students = present_count + absent_count
        
        # Get group info for total expected students
        group = firebase.get_one('groups', group_id) or {}
        group_name = group.get('name', group_id)
        
        # Count students in group
        all_students = firebase.get_all('students') or {}
        students_in_group = sum(1 for student in all_students.values() 
                               if isinstance(student, dict) and student.get('group') == group_id)
        
        stats = {
            'date': date,
            'room': room_id,
            'group': group_id,
            'group_name': group_name,
            'present': present_count,
            'absent': absent_count,
            'attendance_rate': round((present_count / total_students * 100), 2) if total_students > 0 else 0,
            'total_recorded': total_students,
            'total_expected': students_in_group,
            'timestamp': datetime.now().isoformat()
        }
        
        return stats
    except Exception as e:
        print(f"Error calculating stats: {e}")
        return None

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
    students = firebase.get_all('students') or []
    fingerprint_id = int(fingerprint_id)

    for index, student in enumerate(students):
        if student.get('fingerprint_id') == fingerprint_id:
            return index, student

    return None, None

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