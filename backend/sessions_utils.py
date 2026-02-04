# utils.py
from datetime import datetime, timedelta
from firebase_config import firebase

def get_day_of_week(date_str=None):
    """Get day of week from date string - FIXED VERSION"""
    try:
        if date_str:
            date_obj = datetime.strptime(date_str, '%Y-%m-%d')
        else:
            date_obj = datetime.now()
        
        # Get weekday number (0 = Monday, 6 = Sunday)
        weekday_num = date_obj.weekday()
        
        # Map to English day names (lowercase)
        days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        
        return days[weekday_num]
    except Exception as e:
        print(f"Error in get_day_of_week: {e}")
        # Return current day as fallback
        days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        return days[datetime.now().weekday()]

def get_room_by_esp32_id(esp32_id):
    """Get room by ESP32 ID"""
    rooms = firebase.get_all('rooms') or {}
    for room_id, room_data in rooms.items():
        if isinstance(room_data, dict) and room_data.get('esp32_id') == esp32_id:
            return room_id, room_data
    return None, None

def calculate_session_stats(date, room_id, group_id):
    """Calculate attendance statistics for a session"""
    try:
        if not group_id:
            return None
        
        # Get attendance for this group and date
        attendance_path = f"{group_id}/{date}"
        attendance = firebase.get_one('attendance', attendance_path) or {}
        
        present_count = len(attendance.get('present', {}))
        absent_count = len(attendance.get('absent', {}))
        total_students = present_count + absent_count
        
        # Get group info
        group = firebase.get_one('groups', group_id) or {}
        group_name = group.get('name', group_id)
        
        # Count students in group
        all_students = firebase.get_all('students') or {}
        students_in_group = 0
        for student_id, student_data in all_students.items():
            if isinstance(student_data, dict) and student_data.get('group') == group_id:
                students_in_group += 1
        
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