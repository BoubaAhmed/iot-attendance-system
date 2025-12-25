from datetime import datetime, timedelta
from flask import Flask, jsonify, request
from flask_cors import CORS
import os

# Create Flask app
app = Flask(__name__)
CORS(app)

# Configuration
app.config['JSON_SORT_KEYS'] = False

# Import firebase config
from firebase_config import firebase

# ================ UTILS ================
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

def generate_session_id(date, room_id, start_time):
    """Generate unique session ID"""
    clean_start = start_time.replace(':', '')
    return f"{date}_{room_id}_{clean_start}"

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
        all_sessions = firebase.get_all('sessions') or {}
        
        for session_id, session in all_sessions.items():
            if (session.get('room') == room_id and 
                session.get('date') == current_date and
                session.get('status') == 'ACTIVE' and
                session.get('start') <= current_time <= session.get('end')):
                return session_id, session
        
        return None, None
    except Exception as e:
        print(f"Error in get_active_session_for_room: {e}")
        return None, None

def get_today_schedule_for_room(room_id):
    """Get today's schedule for a room"""
    try:
        today_day = get_day_of_week()
        schedule = firebase.get_all('schedule') or {}
        
        room_schedule = schedule.get(room_id, {})
        return room_schedule.get(today_day, {})
    except Exception as e:
        print(f"Error in get_today_schedule_for_room: {e}")
        return {}

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
            start_time, end_time = time_slot.split('-')
            
            # If we're in the time slot
            if start_time <= current_time <= end_time:
                # Check if session already exists
                session_id = generate_session_id(today, room_id, start_time)
                session = firebase.get_one('sessions', session_id)
                
                if not session:
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
                    firebase.create('sessions', session_data, session_id)
                    return session_id, session_data
                else:
                    return session_id, session
        
        # Check slots in next 15 minutes
        for time_slot, slot_data in today_schedule.items():
            start_time, end_time = time_slot.split('-')
            start_datetime = datetime.strptime(f"{today} {start_time}", "%Y-%m-%d %H:%M")
            time_diff = (start_datetime - datetime.now()).total_seconds() / 60
            
            if 0 < time_diff <= 15:  # In next 15 minutes
                session_id = generate_session_id(today, room_id, start_time)
                session = firebase.get_one('sessions', session_id)
                
                if not session:
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
                    firebase.create('sessions', session_data, session_id)
                    return session_id, session_data
                else:
                    return session_id, session
        
        return None, "No class at this moment or in next 15 minutes"
        
    except Exception as e:
        print(f"Error in check_for_scheduled_session: {e}")
        return None, str(e)

def calculate_session_stats(session_id, group_id):
    """Calculate session statistics and mark absences"""
    try:
        # Get all students in group
        all_students = firebase.get_all('students') or {}
        students_in_group = []
        student_data_map = {}
        
        for student_id, student in all_students.items():
            if student.get('group') == group_id:
                students_in_group.append(student_id)
                student_data_map[student_id] = student
        
        # Get attendance for this session
        attendance_path = f"attendance/{session_id}"
        session_attendance = firebase.get_all(attendance_path) or {}
        
        present_count = 0
        absent_count = 0
        attendance_list = []
        
        # Check each student in group
        for student_id in students_in_group:
            student_attendance = session_attendance.get(student_id)
            student_info = student_data_map.get(student_id, {})
            
            if student_attendance and student_attendance.get('status') == 'PRESENT':
                present_count += 1
                attendance_list.append({
                    'student_id': student_id,
                    'name': student_info.get('name'),
                    'status': 'PRESENT',
                    'time': student_attendance.get('time'),
                    'method': student_attendance.get('method')
                })
            else:
                absent_count += 1
                attendance_list.append({
                    'student_id': student_id,
                    'name': student_info.get('name'),
                    'status': 'ABSENT',
                    'time': None,
                    'method': None
                })
                
                # Mark as absent in database if not already present
                if not student_attendance:
                    absent_data = {
                        'status': 'ABSENT',
                        'time': None,
                        'method': None,
                        'marked_at': datetime.now().isoformat()
                    }
                    firebase.update_at_path(f"{attendance_path}/{student_id}", absent_data)
        
        total = present_count + absent_count
        
        # Update session stats
        stats = {
            'total': total,
            'present': present_count,
            'absent': absent_count,
            'attendance_rate': round((present_count / total * 100), 2) if total > 0 else 0,
            'attendance_list': attendance_list
        }
        
        firebase.update('sessions', session_id, {'stats': stats})
        
        return stats
    except Exception as e:
        print(f"Error in calculate_session_stats: {e}")
        return None

# ================ CRUD STUDENTS ================
@app.route('/api/students', methods=['GET'])
def get_students():
    """Get all students"""
    try:
        students = firebase.get_all('students') or {}
        # Convert to list for React
        student_list = []
        for student_id, student_data in students.items():
            student_list.append({
                'id': student_id,
                **student_data
            })
        
        return jsonify({
            'success': True,
            'data': student_list,
            'count': len(student_list)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/students', methods=['POST'])
def create_student():
    """Create new student"""
    try:
        data = request.get_json()
        
        # Validation
        if not data.get('name'):
            return jsonify({'success': False, 'error': 'Name is required'}), 400
        
        # Get existing students to generate ID
        students = firebase.get_all('students') or {}
        
        # Generate numeric ID
        if students:
            # Find max numeric ID
            numeric_ids = []
            for sid in students.keys():
                if sid.isdigit():
                    numeric_ids.append(int(sid))
            if numeric_ids:
                student_id = str(max(numeric_ids) + 1)
            else:
                student_id = "1"
        else:
            student_id = "1"
        
        student_data = {
            'name': data['name'],
            'fingerprint_id': data.get('fingerprint_id'),
            'rfid': data.get('rfid', ''),
            'group': data.get('group', ''),
            'email': data.get('email', ''),
            'phone': data.get('phone', ''),
            'active': data.get('active', True),
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }
        
        firebase.create('students', student_data, student_id)
        
        return jsonify({
            'success': True,
            'message': 'Student created',
            'data': {'id': student_id, **student_data}
        }), 201

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/students/<student_id>', methods=['GET'])
def get_student(student_id):
    """Get student by ID"""
    try:
        student = firebase.get_one('students', student_id)
        if not student:
            return jsonify({'success': False, 'error': 'Student not found'}), 404
        
        return jsonify({
            'success': True,
            'data': {'id': student_id, **student}
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/students/<student_id>', methods=['PUT'])
def update_student(student_id):
    """Update student"""
    try:
        data = request.get_json()
        
        existing = firebase.get_one('students', student_id)
        if not existing:
            return jsonify({'success': False, 'error': 'Student not found'}), 404
        
        data['updated_at'] = datetime.now().isoformat()
        firebase.update('students', student_id, data)
        
        updated_student = firebase.get_one('students', student_id)
        
        return jsonify({
            'success': True,
            'message': 'Student updated',
            'data': {'id': student_id, **updated_student}
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/students/<student_id>', methods=['DELETE'])
def delete_student(student_id):
    """Delete student"""
    try:
        existing = firebase.get_one('students', student_id)
        if not existing:
            return jsonify({'success': False, 'error': 'Student not found'}), 404
        
        firebase.delete('students', student_id)
        
        return jsonify({
            'success': True,
            'message': 'Student deleted'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/students/search', methods=['GET'])
def search_students():
    """Search students"""
    try:
        name = request.args.get('name', '')
        group = request.args.get('group', '')
        active = request.args.get('active')
        
        students = firebase.get_all('students') or {}
        filtered_students = []
        
        for student_id, student_data in students.items():
            # Apply filters
            if name and name.lower() not in student_data.get('name', '').lower():
                continue
            if group and student_data.get('group') != group:
                continue
            if active is not None:
                if active.lower() == 'true' and not student_data.get('active', True):
                    continue
                if active.lower() == 'false' and student_data.get('active', True):
                    continue
            
            filtered_students.append({
                'id': student_id,
                **student_data
            })
        
        return jsonify({
            'success': True,
            'data': filtered_students,
            'count': len(filtered_students)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ================ CRUD ROOMS ================
@app.route('/api/rooms', methods=['GET'])
def get_rooms():
    """Get all rooms"""
    try:
        rooms = firebase.get_all('rooms') or {}
        # Convert to list for React
        room_list = []
        for room_id, room_data in rooms.items():
            room_list.append({
                'id': room_id,
                **room_data
            })
        
        return jsonify({
            'success': True,
            'data': room_list,
            'count': len(room_list)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/rooms', methods=['POST'])
def create_room():
    """Create new room"""
    try:
        data = request.get_json()
        
        if not data.get('name'):
            return jsonify({'success': False, 'error': 'Name is required'}), 400
        
        room_id = data.get('id', f"room{len(firebase.get_all('rooms') or {}) + 1}")
        
        room_data = {
            'name': data['name'],
            'esp32_id': data.get('esp32_id', ''),
            'location': data.get('location', ''),
            'description': data.get('description', ''),
            'active': data.get('active', True),
            'status': 'offline',
            'created_at': datetime.now().isoformat(),
            'last_seen': None
        }
        
        firebase.create('rooms', room_data, room_id)
        
        return jsonify({
            'success': True,
            'message': 'Room created',
            'data': {'id': room_id, **room_data}
        }), 201
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/rooms/<room_id>', methods=['GET'])
def get_room(room_id):
    """Get room by ID"""
    try:
        room = firebase.get_one('rooms', room_id)
        if not room:
            return jsonify({'success': False, 'error': 'Room not found'}), 404
        
        return jsonify({
            'success': True,
            'data': {'id': room_id, **room}
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/rooms/esp32/<esp32_id>', methods=['GET'])
def get_room_by_esp32(esp32_id):
    """Get room by ESP32 ID"""
    try:
        rooms = firebase.get_all('rooms') or {}
        for room_id, room_data in rooms.items():
            if room_data.get('esp32_id') == esp32_id:
                return jsonify({
                    'success': True,
                    'data': {'id': room_id, **room_data}
                })
        
        return jsonify({'success': False, 'error': 'ESP32 not found'}), 404
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/rooms/<room_id>', methods=['PUT'])
def update_room(room_id):
    """Update room"""
    try:
        data = request.get_json()
        
        existing = firebase.get_one('rooms', room_id)
        if not existing:
            return jsonify({'success': False, 'error': 'Room not found'}), 404
        
        firebase.update('rooms', room_id, data)
        
        updated_room = firebase.get_one('rooms', room_id)
        
        return jsonify({
            'success': True,
            'message': 'Room updated',
            'data': {'id': room_id, **updated_room}
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/rooms/<room_id>/status', methods=['PUT'])
def update_room_status(room_id):
    """Activate/deactivate room"""
    try:
        data = request.get_json()
        active = data.get('active')
        
        if active is None:
            return jsonify({'success': False, 'error': 'Field "active" required'}), 400
        
        existing = firebase.get_one('rooms', room_id)
        if not existing:
            return jsonify({'success': False, 'error': 'Room not found'}), 404
        
        firebase.update('rooms', room_id, {
            'active': active,
            'last_status_update': datetime.now().isoformat()
        })
        
        return jsonify({
            'success': True,
            'message': f'Room {"activated" if active else "deactivated"}'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/rooms/<room_id>', methods=['DELETE'])
def delete_room(room_id):
    """Delete room"""
    try:
        existing = firebase.get_one('rooms', room_id)
        if not existing:
            return jsonify({'success': False, 'error': 'Room not found'}), 404
        
        firebase.delete('rooms', room_id)
        
        return jsonify({
            'success': True,
            'message': 'Room deleted'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ================ CRUD GROUPS ================
@app.route('/api/groups', methods=['GET'])
def get_groups():
    """Get all groups"""
    try:
        groups = firebase.get_all('groups') or {}
        # Convert to list for React
        group_list = []
        for group_id, group_data in groups.items():
            group_list.append({
                'id': group_id,
                **group_data
            })
        
        return jsonify({
            'success': True,
            'data': group_list,
            'count': len(group_list)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/groups', methods=['POST'])
def create_group():
    """Create new group"""
    try:
        data = request.get_json()
        
        if not data.get('name'):
            return jsonify({'success': False, 'error': 'Name is required'}), 400
        
        group_id = data.get('id', f"G{len(firebase.get_all('groups') or {}) + 1}")
        
        group_data = {
            'name': data['name'],
            'level': data.get('level', ''),
            'description': data.get('description', ''),
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }
        
        firebase.create('groups', group_data, group_id)
        
        return jsonify({
            'success': True,
            'message': 'Group created',
            'data': {'id': group_id, **group_data}
        }), 201
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/groups/<group_id>', methods=['GET'])
def get_group(group_id):
    """Get group by ID"""
    try:
        group = firebase.get_one('groups', group_id)
        if not group:
            return jsonify({'success': False, 'error': 'Group not found'}), 404
        
        return jsonify({
            'success': True,
            'data': {'id': group_id, **group}
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/groups/<group_id>', methods=['PUT'])
def update_group(group_id):
    """Update group"""
    try:
        data = request.get_json()
        
        existing = firebase.get_one('groups', group_id)
        if not existing:
            return jsonify({'success': False, 'error': 'Group not found'}), 404
        
        data['updated_at'] = datetime.now().isoformat()
        firebase.update('groups', group_id, data)
        
        updated_group = firebase.get_one('groups', group_id)
        
        return jsonify({
            'success': True,
            'message': 'Group updated',
            'data': {'id': group_id, **updated_group}
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/groups/<group_id>', methods=['DELETE'])
def delete_group(group_id):
    """Delete group"""
    try:
        existing = firebase.get_one('groups', group_id)
        if not existing:
            return jsonify({'success': False, 'error': 'Group not found'}), 404
        
        firebase.delete('groups', group_id)
        
        return jsonify({
            'success': True,
            'message': 'Group deleted'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/groups/<group_id>/students', methods=['GET'])
def get_group_students(group_id):
    """Get students in a group"""
    try:
        students = firebase.get_all('students') or {}
        group_students = []
        
        for student_id, student_data in students.items():
            if student_data.get('group') == group_id:
                group_students.append({
                    'id': student_id,
                    **student_data
                })
        
        return jsonify({
            'success': True,
            'data': group_students,
            'count': len(group_students)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ================ CRUD SUBJECTS ================
@app.route('/api/subjects', methods=['GET'])
def get_subjects():
    """Get all subjects"""
    try:
        subjects = firebase.get_all('subjects') or {}
        # Convert to list for React
        subject_list = []
        for subject_id, subject_data in subjects.items():
            subject_list.append({
                'id': subject_id,
                **subject_data
            })
        
        return jsonify({
            'success': True,
            'data': subject_list,
            'count': len(subject_list)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/subjects', methods=['POST'])
def create_subject():
    """Create new subject"""
    try:
        data = request.get_json()
        
        if not data.get('name'):
            return jsonify({'success': False, 'error': 'Name is required'}), 400
        
        subject_id = data.get('id', data['name'].lower().replace(' ', '_'))
        
        subject_data = {
            'name': data['name'],
            'teacher': data.get('teacher', ''),
            'description': data.get('description', ''),
            'code': data.get('code', ''),
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }
        
        firebase.create('subjects', subject_data, subject_id)
        
        return jsonify({
            'success': True,
            'message': 'Subject created',
            'data': {'id': subject_id, **subject_data}
        }), 201
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/subjects/<subject_id>', methods=['GET'])
def get_subject(subject_id):
    """Get subject by ID"""
    try:
        subject = firebase.get_one('subjects', subject_id)
        if not subject:
            return jsonify({'success': False, 'error': 'Subject not found'}), 404
        
        return jsonify({
            'success': True,
            'data': {'id': subject_id, **subject}
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/subjects/<subject_id>', methods=['PUT'])
def update_subject(subject_id):
    """Update subject"""
    try:
        data = request.get_json()
        
        existing = firebase.get_one('subjects', subject_id)
        if not existing:
            return jsonify({'success': False, 'error': 'Subject not found'}), 404
        
        data['updated_at'] = datetime.now().isoformat()
        firebase.update('subjects', subject_id, data)
        
        updated_subject = firebase.get_one('subjects', subject_id)
        
        return jsonify({
            'success': True,
            'message': 'Subject updated',
            'data': {'id': subject_id, **updated_subject}
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/subjects/<subject_id>', methods=['DELETE'])
def delete_subject(subject_id):
    """Delete subject"""
    try:
        existing = firebase.get_one('subjects', subject_id)
        if not existing:
            return jsonify({'success': False, 'error': 'Subject not found'}), 404
        
        firebase.delete('subjects', subject_id)
        
        return jsonify({
            'success': True,
            'message': 'Subject deleted'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ================ CRUD SCHEDULE ================
@app.route('/api/schedule', methods=['GET'])
def get_schedule():
    """Get all schedule"""
    try:
        schedule = firebase.get_all('schedule') or {}
        
        # Get additional data for better UI
        enhanced_schedule = {}
        for room_id, room_schedule in schedule.items():
            room_data = firebase.get_one('rooms', room_id) or {}
            enhanced_schedule[room_id] = {
                'room_name': room_data.get('name', room_id),
                'schedule': room_schedule
            }
        
        return jsonify({
            'success': True,
            'data': enhanced_schedule
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/schedule/room/<room_id>', methods=['GET'])
def get_room_schedule(room_id):
    """Get schedule for a room"""
    try:
        day = request.args.get('day')
        schedule = firebase.get_one('schedule', room_id) or {}
        
        # Get room info
        room = firebase.get_one('rooms', room_id) or {}
        
        if day:
            day_schedule = schedule.get(day, {})
            # Enhance with subject and group names
            enhanced_schedule = {}
            for time_slot, slot_data in day_schedule.items():
                group_data = firebase.get_one('groups', slot_data.get('group')) or {}
                subject_data = firebase.get_one('subjects', slot_data.get('subject')) or {}
                
                enhanced_schedule[time_slot] = {
                    **slot_data,
                    'group_name': group_data.get('name', slot_data.get('group')),
                    'subject_name': subject_data.get('name', slot_data.get('subject')),
                    'teacher': subject_data.get('teacher', '')
                }
            
            return jsonify({
                'success': True,
                'room': {'id': room_id, **room},
                'day': day,
                'data': enhanced_schedule
            })
        
        return jsonify({
            'success': True,
            'room': {'id': room_id, **room},
            'data': schedule
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/schedule/today/<room_id>', methods=['GET'])
def get_today_schedule(room_id):
    """Get today's schedule for a room"""
    try:
        today_day = get_day_of_week()
        schedule = firebase.get_one('schedule', room_id) or {}
        
        # Get room info
        room = firebase.get_one('rooms', room_id) or {}
        
        today_schedule = schedule.get(today_day, {})
        
        # Enhance with subject and group names
        enhanced_schedule = {}
        for time_slot, slot_data in today_schedule.items():
            group_data = firebase.get_one('groups', slot_data.get('group')) or {}
            subject_data = firebase.get_one('subjects', slot_data.get('subject')) or {}
            
            enhanced_schedule[time_slot] = {
                **slot_data,
                'group_name': group_data.get('name', slot_data.get('group')),
                'subject_name': subject_data.get('name', slot_data.get('subject')),
                'teacher': subject_data.get('teacher', '')
            }
        
        return jsonify({
            'success': True,
            'room': {'id': room_id, **room},
            'day': today_day,
            'data': enhanced_schedule
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/schedule/entry', methods=['POST'])
def add_schedule_entry():
    """Add schedule entry"""
    try:
        data = request.get_json()
        
        required_fields = ['room', 'day', 'time_slot', 'group', 'subject']
        if not all(field in data for field in required_fields):
            return jsonify({
                'success': False,
                'error': f'Required fields: {required_fields}'
            }), 400
        
        room_id = data['room']
        day = data['day'].lower()
        time_slot = data['time_slot']
        
        # Validate time slot format (HH:MM-HH:MM)
        try:
            start_time, end_time = time_slot.split('-')
            datetime.strptime(start_time, '%H:%M')
            datetime.strptime(end_time, '%H:%M')
        except ValueError:
            return jsonify({'success': False, 'error': 'Invalid time slot format. Use HH:MM-HH:MM'}), 400
        
        # Check if room exists
        room = firebase.get_one('rooms', room_id)
        if not room:
            return jsonify({'success': False, 'error': 'Room not found'}), 404
        
        # Check if group exists
        group = firebase.get_one('groups', data['group'])
        if not group:
            return jsonify({'success': False, 'error': 'Group not found'}), 404
        
        # Check if subject exists
        subject = firebase.get_one('subjects', data['subject'])
        if not subject:
            return jsonify({'success': False, 'error': 'Subject not found'}), 404
        
        entry_data = {
            'group': data['group'],
            'subject': data['subject']
        }
        
        path = f"schedule/{room_id}/{day}/{time_slot}"
        firebase.update_at_path(path, entry_data)
        
        return jsonify({
            'success': True,
            'message': 'Schedule entry added'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/schedule/entry', methods=['PUT'])
def update_schedule_entry():
    """Update schedule entry"""
    try:
        data = request.get_json()
        
        required_fields = ['room', 'day', 'time_slot']
        if not all(field in data for field in required_fields):
            return jsonify({
                'success': False,
                'error': f'Required fields: {required_fields}'
            }), 400
        
        room_id = data['room']
        day = data['day'].lower()
        time_slot = data['time_slot']
        
        # Check if entry exists
        path = f"schedule/{room_id}/{day}/{time_slot}"
        existing_entry = firebase.get_at_path(path)
        if not existing_entry:
            return jsonify({'success': False, 'error': 'Schedule entry not found'}), 404
        
        update_data = {}
        if 'group' in data:
            # Check if group exists
            group = firebase.get_one('groups', data['group'])
            if not group:
                return jsonify({'success': False, 'error': 'Group not found'}), 404
            update_data['group'] = data['group']
        
        if 'subject' in data:
            # Check if subject exists
            subject = firebase.get_one('subjects', data['subject'])
            if not subject:
                return jsonify({'success': False, 'error': 'Subject not found'}), 404
            update_data['subject'] = data['subject']
        
        firebase.update_at_path(path, update_data)
        
        return jsonify({
            'success': True,
            'message': 'Schedule entry updated'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/schedule/entry', methods=['DELETE'])
def delete_schedule_entry():
    """Delete schedule entry"""
    try:
        data = request.get_json()
        
        required_fields = ['room', 'day', 'time_slot']
        if not all(field in data for field in required_fields):
            return jsonify({
                'success': False,
                'error': f'Required fields: {required_fields}'
            }), 400
        
        room_id = data['room']
        day = data['day'].lower()
        time_slot = data['time_slot']
        
        path = f"schedule/{room_id}/{day}/{time_slot}"
        existing_entry = firebase.get_at_path(path)
        if not existing_entry:
            return jsonify({'success': False, 'error': 'Schedule entry not found'}), 404
        
        firebase.delete_at_path(path)
        
        return jsonify({
            'success': True,
            'message': 'Schedule entry deleted'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ================ CRUD SESSIONS ================
@app.route('/api/sessions', methods=['GET'])
def get_sessions():
    """Get sessions with filters"""
    try:
        date = request.args.get('date')
        room = request.args.get('room')
        status = request.args.get('status')
        group = request.args.get('group')
        subject = request.args.get('subject')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        all_sessions = firebase.get_all('sessions') or {}
        filtered_sessions = []
        
        for session_id, session_data in all_sessions.items():
            # Apply filters
            if date and session_data.get('date') != date:
                continue
            if room and session_data.get('room') != room:
                continue
            if status and session_data.get('status') != status:
                continue
            if group and session_data.get('group') != group:
                continue
            if subject and session_data.get('subject') != subject:
                continue
            if start_date and session_data.get('date') < start_date:
                continue
            if end_date and session_data.get('date') > end_date:
                continue
            
            # Get additional info
            room_data = firebase.get_one('rooms', session_data.get('room')) or {}
            group_data = firebase.get_one('groups', session_data.get('group')) or {}
            subject_data = firebase.get_one('subjects', session_data.get('subject')) or {}
            
            enhanced_session = {
                'id': session_id,
                **session_data,
                'room_name': room_data.get('name', session_data.get('room')),
                'group_name': group_data.get('name', session_data.get('group')),
                'subject_name': subject_data.get('name', session_data.get('subject')),
                'teacher': subject_data.get('teacher', '')
            }
            
            filtered_sessions.append(enhanced_session)
        
        # Sort by date and time
        filtered_sessions.sort(key=lambda x: (x.get('date', ''), x.get('start', '')), reverse=True)
        
        return jsonify({
            'success': True,
            'data': filtered_sessions,
            'count': len(filtered_sessions)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/sessions/check', methods=['GET'])
def check_session():
    """Check if session is scheduled for ESP32"""
    try:
        esp32_id = request.args.get('esp32_id')
        if not esp32_id:
            return jsonify({'success': False, 'error': 'esp32_id required'}), 400
        
        session_id, session = check_for_scheduled_session(esp32_id)
        
        if session_id:
            return jsonify({
                'success': True,
                'session_id': session_id,
                'session': session,
                'message': 'Scheduled session found'
            })
        else:
            return jsonify({
                'success': False,
                'message': session  # Error message is in session variable
            })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/sessions/start', methods=['POST'])
def start_session_esp32():
    """Start session for ESP32"""
    try:
        esp32_id = request.args.get('esp32_id')
        if not esp32_id:
            return jsonify({'success': False, 'error': 'esp32_id required'}), 400
        
        # Check if there's a scheduled session
        session_id, session = check_for_scheduled_session(esp32_id)
        
        if not session_id:
            return jsonify({'success': False, 'error': 'No scheduled session'}), 404
        
        # Start session
        firebase.update('sessions', session_id, {
            'status': 'ACTIVE',
            'started_at': datetime.now().isoformat()
        })
        
        # Update room status
        room_id, room = get_room_by_esp32_id(esp32_id)
        if room_id:
            firebase.update('rooms', room_id, {
                'last_seen': datetime.now().isoformat(),
                'status': 'online'
            })
            
            # Add log
            log_data = {
                'type': 'SESSION_STARTED',
                'session_id': session_id,
                'message': f'Session started: {session.get("group")} - {session.get("subject")}',
                'timestamp': datetime.now().isoformat()
            }
            firebase.update_at_path(f'logs/{room_id}/{int(datetime.now().timestamp() * 1000)}', log_data)
        
        # Get updated session
        updated_session = firebase.get_one('sessions', session_id)
        
        return jsonify({
            'success': True,
            'message': 'Session started successfully',
            'session_id': session_id,
            'session': updated_session
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/sessions/stop', methods=['POST'])
def stop_session_esp32():
    """Stop session for ESP32"""
    try:
        esp32_id = request.args.get('esp32_id')
        if not esp32_id:
            return jsonify({'success': False, 'error': 'esp32_id required'}), 400
        
        # Find room
        room_id, room = get_room_by_esp32_id(esp32_id)
        if not room_id:
            return jsonify({'success': False, 'error': 'Room not found'}), 404
        
        # Find active session for this room
        session_id, session = get_active_session_for_room(room_id)
        if not session_id:
            return jsonify({'success': False, 'error': 'No active session'}), 404
        
        # Close session and calculate absences
        stats = calculate_session_stats(session_id, session.get('group'))
        
        if not stats:
            return jsonify({'success': False, 'error': 'Error calculating statistics'}), 500
        
        # Close session
        firebase.update('sessions', session_id, {
            'status': 'CLOSED',
            'closed_at': datetime.now().isoformat(),
            'stats': stats
        })
        
        # Add log
        log_data = {
            'type': 'SESSION_CLOSED',
            'session_id': session_id,
            'message': f'Session closed: {session.get("group")} - {session.get("subject")}',
            'stats': stats,
            'timestamp': datetime.now().isoformat()
        }
        firebase.update_at_path(f'logs/{room_id}/{int(datetime.now().timestamp() * 1000)}', log_data)
        
        return jsonify({
            'success': True,
            'message': 'Session stopped successfully',
            'session_id': session_id,
            'stats': stats
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/sessions/generate', methods=['POST'])
def generate_scheduled_sessions():
    """Generate scheduled sessions for a date"""
    try:
        date_str = request.args.get('date', datetime.now().strftime('%Y-%m-%d'))
        day_of_week = get_day_of_week(date_str)
        
        schedule = firebase.get_all('schedule') or {}
        sessions_created = []
        
        for room_id, room_schedule in schedule.items():
            if day_of_week in room_schedule:
                day_schedule = room_schedule[day_of_week]
                
                for time_slot, slot_data in day_schedule.items():
                    start_time, end_time = time_slot.split('-')
                    
                    # Generate session ID
                    session_id = generate_session_id(date_str, room_id, start_time)
                    
                    # Check if session already exists
                    existing_session = firebase.get_one('sessions', session_id)
                    if not existing_session:
                        # Get room info
                        room = firebase.get_one('rooms', room_id)
                        
                        session_data = {
                            'date': date_str,
                            'room': room_id,
                            'room_name': room.get('name') if room else room_id,
                            'day': day_of_week,
                            'start': start_time,
                            'end': end_time,
                            'group': slot_data['group'],
                            'subject': slot_data['subject'],
                            'status': 'SCHEDULED',
                            'created_at': datetime.now().isoformat()
                        }
                        
                        firebase.create('sessions', session_data, session_id)
                        sessions_created.append(session_id)
        
        return jsonify({
            'success': True,
            'message': f'{len(sessions_created)} scheduled sessions created',
            'date': date_str,
            'day': day_of_week,
            'sessions': sessions_created
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/sessions/<session_id>', methods=['GET'])
def get_session(session_id):
    """Get specific session"""
    try:
        session = firebase.get_one('sessions', session_id)
        if not session:
            return jsonify({'success': False, 'error': 'Session not found'}), 404
        
        # Get additional info
        room_data = firebase.get_one('rooms', session.get('room')) or {}
        group_data = firebase.get_one('groups', session.get('group')) or {}
        subject_data = firebase.get_one('subjects', session.get('subject')) or {}
        
        enhanced_session = {
            'id': session_id,
            **session,
            'room_name': room_data.get('name', session.get('room')),
            'group_name': group_data.get('name', session.get('group')),
            'subject_name': subject_data.get('name', session.get('subject')),
            'teacher': subject_data.get('teacher', '')
        }
        
        return jsonify({'success': True, 'data': enhanced_session})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/sessions/<session_id>/close', methods=['POST'])
def close_session_manual(session_id):
    """Manually close session and calculate absences"""
    try:
        session = firebase.get_one('sessions', session_id)
        if not session:
            return jsonify({'success': False, 'error': 'Session not found'}), 404
        
        if session.get('status') == 'CLOSED':
            return jsonify({'success': False, 'error': 'Session already closed'}), 400
        
        # Calculate statistics and mark absences
        stats = calculate_session_stats(session_id, session.get('group'))
        
        if not stats:
            return jsonify({'success': False, 'error': 'Error calculating statistics'}), 500
        
        # Close session
        firebase.update('sessions', session_id, {
            'status': 'CLOSED',
            'closed_at': datetime.now().isoformat(),
            'stats': stats
        })
        
        return jsonify({
            'success': True,
            'message': 'Session closed',
            'session_id': session_id,
            'stats': stats
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/sessions/<session_id>/attendance', methods=['POST'])
def update_session_attendance(session_id):
    """Manually update attendance for a session"""
    try:
        data = request.get_json()
        
        if 'status' not in data or 'student_id' not in data:
            return jsonify({'success': False, 'error': 'status and student_id required'}), 400
        
        session = firebase.get_one('sessions', session_id)
        if not session:
            return jsonify({'success': False, 'error': 'Session not found'}), 404
        
        student_id = data['student_id']
        status = data['status']
        
        attendance_data = {
            'status': status,
            'time': datetime.now().strftime('%H:%M') if status == 'PRESENT' else None,
            'method': 'MANUAL',
            'updated_at': datetime.now().isoformat()
        }
        
        # Add student name if available
        student = firebase.get_one('students', student_id)
        if student:
            attendance_data['student_name'] = student.get('name')
        
        attendance_path = f"attendance/{session_id}/{student_id}"
        firebase.update_at_path(attendance_path, attendance_data)
        
        # Recalculate stats
        calculate_session_stats(session_id, session.get('group'))
        
        return jsonify({
            'success': True,
            'message': f'Attendance updated to {status}'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/sessions/auto-close', methods=['POST'])
def auto_close_sessions():
    """Auto-close sessions that have ended"""
    try:
        now = datetime.now()
        current_time = now.strftime('%H:%M')
        current_date = now.strftime('%Y-%m-%d')
        
        all_sessions = firebase.get_all('sessions') or {}
        closed_sessions = []
        
        for session_id, session in all_sessions.items():
            if (session.get('status') in ['ACTIVE', 'SCHEDULED'] and 
                session.get('date') == current_date and
                session.get('end') < current_time):
                
                # Close session
                stats = calculate_session_stats(session_id, session.get('group'))
                
                if stats:
                    firebase.update('sessions', session_id, {
                        'status': 'CLOSED',
                        'closed_at': now.isoformat(),
                        'stats': stats
                    })
                    closed_sessions.append(session_id)
        
        return jsonify({
            'success': True,
            'message': f'{len(closed_sessions)} sessions closed',
            'closed_sessions': closed_sessions
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ================ ATTENDANCE MANAGEMENT ================
@app.route('/api/attendance', methods=['POST'])
def record_attendance():
    """Record attendance (called by ESP32)"""
    try:
        data = request.get_json()
        
        # Validation
        required_fields = ['esp32_id', 'fingerprint_id', 'method']
        if not all(field in data for field in required_fields):
            return jsonify({
                'success': False,
                'error': f'Required fields: {required_fields}'
            }), 400
        
        esp32_id = data['esp32_id']
        fingerprint_id = int(data['fingerprint_id'])
        method = data['method']
        
        # Find room by ESP32 ID
        room_id, room = get_room_by_esp32_id(esp32_id)
        if not room or not room.get('active', True):
            return jsonify({'success': False, 'error': 'Room not found or inactive'}), 404
        
        # Find student by fingerprint ID
        student = None
        students = firebase.get_all('students') or {}
        for sid, sdata in students.items():
            if sdata.get('fingerprint_id') == fingerprint_id:
                student = {'id': sid, **sdata}
                break
        
        if not student:
            return jsonify({'success': False, 'error': 'Student not found'}), 404
        
        # Find active session for this room
        session_id, session = get_active_session_for_room(room_id)
        if not session_id:
            return jsonify({'success': False, 'error': 'No active session in this room'}), 404
        
        # Check if student belongs to session group
        group_id = session.get('group')
        if student.get('group') != group_id:
            return jsonify({'success': False, 'error': 'Student does not belong to session group'}), 400
        
        # Record attendance
        now = datetime.now()
        time_str = now.strftime('%H:%M')
        
        attendance_data = {
            'status': 'PRESENT',
            'time': time_str,
            'method': method,
            'student_name': student.get('name'),
            'room_name': room.get('name'),
            'recorded_at': now.isoformat(),
            'esp32_id': esp32_id
        }
        
        attendance_path = f"attendance/{session_id}/{student['id']}"
        firebase.update_at_path(attendance_path, attendance_data)
        
        # Update room timestamp
        firebase.update('rooms', room_id, {
            'last_seen': now.isoformat(),
            'status': 'online'
        })
        
        # Add log
        log_data = {
            'type': 'ATTENDANCE_RECORDED',
            'student_id': student['id'],
            'student_name': student.get('name'),
            'session_id': session_id,
            'method': method,
            'message': f'{student.get("name")} present via {method}',
            'timestamp': now.isoformat()
        }
        firebase.update_at_path(f'logs/{room_id}/{int(now.timestamp() * 1000)}', log_data)
        
        return jsonify({
            'success': True,
            'message': 'Attendance recorded',
            'data': {
                'session': session_id,
                'student': student.get('name'),
                'room': room.get('name'),
                'group': group_id,
                'time': time_str,
                'method': method
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/attendance', methods=['GET'])
def get_attendance():
    """Get attendance with filters"""
    try:
        session_id = request.args.get('session')
        date = request.args.get('date')
        room = request.args.get('room')
        student = request.args.get('student')
        group = request.args.get('group')
        status = request.args.get('status')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        all_attendance = firebase.get_all('attendance') or {}
        filtered_attendance = []
        
        for attendance_session_id, session_attendance in all_attendance.items():
            # Get session info
            session_info = firebase.get_one('sessions', attendance_session_id) or {}
            
            # Apply filters
            if session_id and attendance_session_id != session_id:
                continue
            
            # Filter by date (date is in session ID)
            session_date = session_info.get('date', '')
            if date and not attendance_session_id.startswith(date):
                continue
            if start_date and session_date < start_date:
                continue
            if end_date and session_date > end_date:
                continue
            
            if room and session_info.get('room') != room:
                continue
            if group and session_info.get('group') != group:
                continue
            
            # Process each student's attendance
            for student_id, student_attendance in session_attendance.items():
                if student and student_id != student:
                    continue
                if status and student_attendance.get('status') != status:
                    continue
                
                # Get student info
                student_info = firebase.get_one('students', student_id) or {}
                
                filtered_attendance.append({
                    'session_id': attendance_session_id,
                    'student_id': student_id,
                    'student_name': student_info.get('name', 'Unknown'),
                    'group': student_info.get('group', ''),
                    'date': session_date,
                    'room': session_info.get('room'),
                    'room_name': session_info.get('room_name'),
                    'subject': session_info.get('subject'),
                    'subject_name': session_info.get('subject_name'),
                    'start_time': session_info.get('start'),
                    'end_time': session_info.get('end'),
                    **student_attendance
                })
        
        # Sort by date and time
        filtered_attendance.sort(key=lambda x: (x.get('date', ''), x.get('time', '')), reverse=True)
        
        return jsonify({
            'success': True,
            'data': filtered_attendance,
            'count': len(filtered_attendance)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/attendance/session/<session_id>', methods=['GET'])
def get_attendance_by_session(session_id):
    """Get attendance for specific session"""
    try:
        attendance = firebase.get_one('attendance', session_id) or {}
        
        # Get session info
        session = firebase.get_one('sessions', session_id) or {}
        
        # Enhance with student info
        enhanced_attendance = []
        for student_id, student_attendance in attendance.items():
            student_info = firebase.get_one('students', student_id) or {}
            enhanced_attendance.append({
                'student_id': student_id,
                'student_name': student_info.get('name', 'Unknown'),
                'group': student_info.get('group', ''),
                **student_attendance
            })
        
        return jsonify({
            'success': True,
            'session': session,
            'data': enhanced_attendance,
            'count': len(enhanced_attendance)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/attendance/student/<student_id>', methods=['GET'])
def get_attendance_by_student(student_id):
    """Get attendance for specific student"""
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        # Check if student exists
        student = firebase.get_one('students', student_id)
        if not student:
            return jsonify({'success': False, 'error': 'Student not found'}), 404
        
        all_attendance = firebase.get_all('attendance') or {}
        student_attendance = []
        
        for session_id, session_attendance in all_attendance.items():
            if student_id in session_attendance:
                # Get session info
                session = firebase.get_one('sessions', session_id) or {}
                
                # Filter by date
                session_date = session.get('date', '')
                if start_date and session_date < start_date:
                    continue
                if end_date and session_date > end_date:
                    continue
                
                student_attendance.append({
                    'session_id': session_id,
                    'date': session_date,
                    'room': session.get('room'),
                    'room_name': session.get('room_name'),
                    'subject': session.get('subject'),
                    'subject_name': session.get('subject_name'),
                    'start_time': session.get('start'),
                    'end_time': session.get('end'),
                    'status': session.get('status'),
                    **session_attendance[student_id]
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

@app.route('/api/attendance/stats/daily', methods=['GET'])
def get_daily_stats():
    """Get daily statistics"""
    try:
        date_str = request.args.get('date', datetime.now().strftime('%Y-%m-%d'))
        
        # Get sessions for the day
        all_sessions = firebase.get_all('sessions') or {}
        day_sessions = {}
        
        for session_id, session in all_sessions.items():
            if session.get('date') == date_str:
                day_sessions[session_id] = session
        
        # Calculate global statistics
        total_sessions = len(day_sessions)
        scheduled_sessions = sum(1 for s in day_sessions.values() if s.get('status') == 'SCHEDULED')
        active_sessions = sum(1 for s in day_sessions.values() if s.get('status') == 'ACTIVE')
        closed_sessions = sum(1 for s in day_sessions.values() if s.get('status') == 'CLOSED')
        
        # Get attendance for the day
        all_attendance = firebase.get_all('attendance') or {}
        day_attendance = {}
        
        for session_id, attendance in all_attendance.items():
            if session_id in day_sessions:
                day_attendance[session_id] = attendance
        
        # Calculate attendance by method
        by_method = {'RFID': 0, 'FINGERPRINT': 0, 'MANUAL': 0}
        total_present = 0
        
        for attendance in day_attendance.values():
            for student_data in attendance.values():
                if student_data.get('status') == 'PRESENT':
                    total_present += 1
                    method = student_data.get('method', 'MANUAL')
                    if method in by_method:
                        by_method[method] += 1
                    else:
                        by_method['MANUAL'] += 1
        
        # Calculate attendance by room
        by_room = {}
        for session_id, session in day_sessions.items():
            room_id = session.get('room')
            room_name = room_id
            
            # Get room name
            room = firebase.get_one('rooms', room_id)
            if room:
                room_name = room.get('name', room_id)
            
            attendance_count = len(day_attendance.get(session_id, {}))
            if room_name not in by_room:
                by_room[room_name] = 0
            
            by_room[room_name] += attendance_count
        
        # Calculate attendance by group
        by_group = {}
        for session_id, session in day_sessions.items():
            group_id = session.get('group')
            group_name = group_id
            
            # Get group name
            group = firebase.get_one('groups', group_id)
            if group:
                group_name = group.get('name', group_id)
            
            attendance_count = len(day_attendance.get(session_id, {}))
            if group_name not in by_group:
                by_group[group_name] = 0
            
            by_group[group_name] += attendance_count
        
        return jsonify({
            'success': True,
            'date': date_str,
            'stats': {
                'sessions': {
                    'total': total_sessions,
                    'scheduled': scheduled_sessions,
                    'active': active_sessions,
                    'closed': closed_sessions
                },
                'attendance': {
                    'total': total_present,
                    'by_room': by_room,
                    'by_group': by_group,
                    'by_method': by_method
                }
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ================ DASHBOARD & ANALYTICS ================
@app.route('/api/dashboard/stats', methods=['GET'])
def get_dashboard_stats():
    """Get dashboard statistics"""
    try:
        # Count entities
        students_count = len(firebase.get_all('students') or {})
        rooms_count = len(firebase.get_all('rooms') or {})
        groups_count = len(firebase.get_all('groups') or {})
        subjects_count = len(firebase.get_all('subjects') or {})
        
        # Get today's date
        today = datetime.now().strftime('%Y-%m-%d')
        
        # Get today's sessions
        all_sessions = firebase.get_all('sessions') or {}
        today_sessions = []
        active_sessions = []
        
        for session_id, session in all_sessions.items():
            if session.get('date') == today:
                today_sessions.append(session)
                if session.get('status') == 'ACTIVE':
                    active_sessions.append(session)
        
        # Get today's attendance
        all_attendance = firebase.get_all('attendance') or {}
        today_attendance = 0
        
        for session_id, attendance in all_attendance.items():
            if session_id.startswith(today):
                for student_attendance in attendance.values():
                    if student_attendance.get('status') == 'PRESENT':
                        today_attendance += 1
        
        # Get active rooms
        rooms = firebase.get_all('rooms') or {}
        active_rooms = sum(1 for room in rooms.values() if room.get('active', False))
        
        return jsonify({
            'success': True,
            'stats': {
                'students': students_count,
                'rooms': rooms_count,
                'active_rooms': active_rooms,
                'groups': groups_count,
                'subjects': subjects_count,
                'today_sessions': len(today_sessions),
                'active_sessions': len(active_sessions),
                'today_attendance': today_attendance
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ================ ESP32 API ================
@app.route('/api/esp32/health', methods=['GET'])
def esp32_health():
    """Check API health for ESP32"""
    return jsonify({
        'status': 'healthy',
        'service': 'IoT Attendance System ESP32 API',
        'timestamp': datetime.now().isoformat(),
        'endpoints': {
            'check_session': '/api/sessions/check?esp32_id=ESP32_ID (GET)',
            'start_session': '/api/sessions/start?esp32_id=ESP32_ID (POST)',
            'stop_session': '/api/sessions/stop?esp32_id=ESP32_ID (POST)',
            'record_attendance': '/api/attendance (POST)'
        }
    })

@app.route('/api/esp32/status', methods=['GET'])
def esp32_status():
    """Get ESP32 status"""
    try:
        esp32_id = request.args.get('esp32_id')
        if not esp32_id:
            return jsonify({'success': False, 'error': 'esp32_id required'}), 400
        
        room_id, room = get_room_by_esp32_id(esp32_id)
        if not room:
            return jsonify({'success': False, 'error': 'ESP32 not found'}), 404
        
        # Check for active session
        session_id, session = get_active_session_for_room(room_id)
        
        return jsonify({
            'success': True,
            'esp32_id': esp32_id,
            'room': room,
            'active_session': session,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ================ MAIN ROUTES ================
@app.route('/')
def home():
    return jsonify({
        'message': 'IoT Automated Attendance System API',
        'version': '3.0.0',
        'architecture': 'ESP32-driven, Schedule-based',
        'endpoints': {
            'students': '/api/students',
            'rooms': '/api/rooms',
            'groups': '/api/groups',
            'subjects': '/api/subjects',
            'schedule': '/api/schedule',
            'sessions': '/api/sessions',
            'attendance': '/api/attendance',
            'dashboard': '/api/dashboard/stats',
            'esp32': {
                'health': '/api/esp32/health',
                'status': '/api/esp32/status'
            }
        }
    })

@app.route('/api/health')
def health_check():
    return jsonify({
        'status': 'healthy',
        'service': 'IoT Attendance System API',
        'timestamp': datetime.now().isoformat(),
        'version': '3.0.0'
    })

# Error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({'success': False, 'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.errorhandler(400)
def bad_request(error):
    return jsonify({'success': False, 'error': 'Bad request'}), 400

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print("=" * 60)
    print(f"🚀 IoT Attendance System - ESP32-driven Architecture")
    print("=" * 60)
    print(f"📡 Server started on http://localhost:{port}")
    print(f"📚 API documentation on http://localhost:{port}/")
    print(f"🔧 Debug mode: {app.debug}")
    print("\n🎯 Architecture: ESP32-driven, Schedule-based")
    print("📅 Sessions: Automatically started by ESP32")
    print("🕒 Attendance: Recorded in real-time by ESP32")
    print("📊 Absences: Automatically calculated on closure")
    print("=" * 60)
    app.run(host='0.0.0.0', port=port, debug=True)