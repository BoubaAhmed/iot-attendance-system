# routes/schedule.py
from flask import Blueprint, request, jsonify
from firebase_config import firebase
from datetime import datetime
import calendar

schedule_bp = Blueprint('schedule', __name__)

def get_day_of_week():
    """Get current day of week in lowercase"""
    days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    today_index = datetime.now().weekday()
    return days[today_index]

@schedule_bp.route('/api/schedule', methods=['GET'])
def get_schedule():
    """Get all schedule"""
    try:
        schedule = firebase.get_all('schedule') or {}
        
        # Get additional data for better UI
        enhanced_schedule = {}
        for room_id, room_schedule in schedule.items():
            if not isinstance(room_schedule, dict):
                continue
                
            room_data = firebase.get_one('rooms', room_id) or {}
            enhanced_room_schedule = {}
            
            for day, day_schedule in room_schedule.items():
                if isinstance(day_schedule, list):
                    enhanced_day_schedule = []
                    for session in day_schedule:
                        if isinstance(session, dict):
                            # Enhance with group and subject names
                            group_data = firebase.get_one('groups', session.get('group')) or {}
                            subject_data = firebase.get_one('subjects', session.get('subject')) or {}
                            
                            enhanced_session = {
                                **session,
                                'group_name': group_data.get('name', session.get('group')),
                                'subject_name': subject_data.get('name', session.get('subject')),
                                'teacher_id': subject_data.get('teacher_id'),
                                'teacher_name': None
                            }
                            
                            # Get teacher name if available
                            if subject_data.get('teacher_id'):
                                teacher_data = firebase.get_one('teachers', subject_data['teacher_id']) or {}
                                enhanced_session['teacher_name'] = teacher_data.get('name')
                            
                            enhanced_day_schedule.append(enhanced_session)
                    
                    enhanced_room_schedule[day] = enhanced_day_schedule
                else:
                    enhanced_room_schedule[day] = day_schedule
            
            enhanced_schedule[room_id] = {
                'room_name': room_data.get('name', room_id),
                'room_data': room_data,
                'schedule': enhanced_room_schedule
            }
        
        return jsonify({
            'success': True,
            'data': enhanced_schedule
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@schedule_bp.route('/api/schedule/room/<room_id>', methods=['GET'])
def get_room_schedule(room_id):
    """Get schedule for a room"""
    try:
        day = request.args.get('day')
        schedule = firebase.get_all(f'schedule/{room_id}') or {}
        
        # Get room info
        room = firebase.get_one('rooms', room_id) or {}
        
        if day:
            day = day.lower()
            day_schedule = schedule.get(day, [])
            
            # Enhance with subject and group names
            enhanced_schedule = []
            for session in day_schedule:
                if isinstance(session, dict):
                    group_data = firebase.get_one('groups', session.get('group')) or {}
                    subject_data = firebase.get_one('subjects', session.get('subject')) or {}
                    
                    enhanced_session = {
                        **session,
                        'group_name': group_data.get('name', session.get('group')),
                        'subject_name': subject_data.get('name', session.get('subject')),
                        'teacher_id': subject_data.get('teacher_id')
                    }
                    
                    # Get teacher name if available
                    if subject_data.get('teacher_id'):
                        teacher_data = firebase.get_one('teachers', subject_data['teacher_id']) or {}
                        enhanced_session['teacher_name'] = teacher_data.get('name')
                    
                    enhanced_schedule.append(enhanced_session)
            
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

@schedule_bp.route('/api/schedule/today/<room_id>', methods=['GET'])
def get_today_schedule(room_id):
    """Get today's schedule for a room"""
    try:
        today_day = get_day_of_week()
        schedule = firebase.get_all(f'schedule/{room_id}') or {}
        
        # Get room info
        room = firebase.get_one('rooms', room_id) or {}
        
        today_schedule = schedule.get(today_day, [])
        
        # Enhance with subject and group names
        enhanced_schedule = []
        for session in today_schedule:
            if isinstance(session, dict):
                group_data = firebase.get_one('groups', session.get('group')) or {}
                subject_data = firebase.get_one('subjects', session.get('subject')) or {}
                
                enhanced_session = {
                    **session,
                    'group_name': group_data.get('name', session.get('group')),
                    'subject_name': subject_data.get('name', session.get('subject')),
                    'teacher_id': subject_data.get('teacher_id')
                }
                
                # Get teacher name if available
                if subject_data.get('teacher_id'):
                    teacher_data = firebase.get_one('teachers', subject_data['teacher_id']) or {}
                    enhanced_session['teacher_name'] = teacher_data.get('name')
                
                enhanced_schedule.append(enhanced_session)
        
        return jsonify({
            'success': True,
            'room': {'id': room_id, **room},
            'day': today_day,
            'data': enhanced_schedule
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@schedule_bp.route('/api/schedule/active', methods=['GET'])
def get_active_schedule():
    """Get currently active schedule for all rooms"""
    try:
        today_day = get_day_of_week()
        current_time = datetime.now().strftime('%H:%M')
        
        all_schedule = firebase.get_all('schedule') or {}
        active_sessions = []
        
        for room_id, room_schedule in all_schedule.items():
            if not isinstance(room_schedule, dict):
                continue
            
            # Get today's schedule for this room
            today_sessions = room_schedule.get(today_day, [])
            
            for session in today_sessions:
                if not isinstance(session, dict):
                    continue
                
                session_start = session.get('start', '')
                session_end = session.get('end', '')
                
                # Check if current time is within session time
                if session_start <= current_time <= session_end:
                    # Get additional info
                    room_data = firebase.get_one('rooms', room_id) or {}
                    group_data = firebase.get_one('groups', session.get('group')) or {}
                    subject_data = firebase.get_one('subjects', session.get('subject')) or {}
                    
                    active_session = {
                        'room_id': room_id,
                        'room_name': room_data.get('name', room_id),
                        'session': {
                            **session,
                            'group_name': group_data.get('name', session.get('group')),
                            'subject_name': subject_data.get('name', session.get('subject'))
                        }
                    }
                    
                    # Get teacher info if available
                    if subject_data.get('teacher_id'):
                        teacher_data = firebase.get_one('teachers', subject_data['teacher_id']) or {}
                        active_session['session']['teacher_name'] = teacher_data.get('name')
                    
                    active_sessions.append(active_session)
        
        return jsonify({
            'success': True,
            'current_time': current_time,
            'day': today_day,
            'active_sessions': active_sessions,
            'count': len(active_sessions)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@schedule_bp.route('/api/schedule/entry', methods=['POST'])
def add_schedule_entry():
    """Add schedule entry"""
    try:
        data = request.get_json()
        
        required_fields = ['room', 'day', 'start', 'end', 'group', 'subject']
        if not all(field in data for field in required_fields):
            return jsonify({
                'success': False,
                'error': f'Required fields: {required_fields}'
            }), 400
        
        room_id = data['room']
        day = data['day'].lower()
        start_time = data['start']
        end_time = data['end']
        
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
        
        # Validate time format
        try:
            datetime.strptime(start_time, '%H:%M')
            datetime.strptime(end_time, '%H:%M')
        except ValueError:
            return jsonify({'success': False, 'error': 'Invalid time format. Use HH:MM'}), 400
        
        # Check for time conflicts in the same room and day
        existing_schedule = firebase.get_all(f'schedule/{room_id}/{day}') or []
        
        for existing_session in existing_schedule:
            if not isinstance(existing_session, dict):
                continue
            
            existing_start = existing_session.get('start', '')
            existing_end = existing_session.get('end', '')
            
            # Check for time overlap
            if not (end_time <= existing_start or start_time >= existing_end):
                return jsonify({
                    'success': False,
                    'error': f'Time conflict with existing session: {existing_start}-{existing_end}'
                }), 400
        
        # Create new session entry
        new_entry = {
            'start': start_time,
            'end': end_time,
            'group': data['group'],
            'subject': data['subject']
        }
        
        # Get existing schedule for this room and day
        day_schedule = existing_schedule.copy()
        day_schedule.append(new_entry)
        
        # Sort by start time
        day_schedule.sort(key=lambda x: x.get('start', ''))
        
        # Update the schedule
        firebase.update('schedule', f'{room_id}/{day}', day_schedule)
        
        return jsonify({
            'success': True,
            'message': 'Schedule entry added',
            'data': new_entry
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@schedule_bp.route('/api/schedule/entry', methods=['DELETE'])
def delete_schedule_entry():
    """Delete schedule entry"""
    try:
        data = request.get_json()
        
        required_fields = ['room', 'day', 'start', 'end']
        if not all(field in data for field in required_fields):
            return jsonify({
                'success': False,
                'error': f'Required fields: {required_fields}'
            }), 400
        
        room_id = data['room']
        day = data['day'].lower()
        start_time = data['start']
        end_time = data['end']
        
        # Get existing schedule for this room and day
        day_schedule = firebase.get_all(f'schedule/{room_id}/{day}') or []
        
        # Find and remove the entry
        updated_schedule = []
        found = False
        
        for session in day_schedule:
            if not isinstance(session, dict):
                continue
            
            if session.get('start') == start_time and session.get('end') == end_time:
                found = True
                continue  # Skip this entry (remove it)
            
            updated_schedule.append(session)
        
        if not found:
            return jsonify({'success': False, 'error': 'Schedule entry not found'}), 404
        
        # Update the schedule
        firebase.update('schedule', f'{room_id}/{day}', updated_schedule)
        
        return jsonify({
            'success': True,
            'message': 'Schedule entry deleted'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@schedule_bp.route('/api/schedule/week', methods=['GET'])
def get_week_schedule():
    """Get schedule for the entire week"""
    try:
        days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        
        all_schedule = firebase.get_all('schedule') or {}
        week_schedule = {}
        
        for room_id, room_schedule in all_schedule.items():
            if not isinstance(room_schedule, dict):
                continue
            
            room_data = firebase.get_one('rooms', room_id) or {}
            room_week_schedule = {}
            
            for day in days:
                day_schedule = room_schedule.get(day, [])
                
                # Enhance with group and subject names
                enhanced_day_schedule = []
                for session in day_schedule:
                    if isinstance(session, dict):
                        group_data = firebase.get_one('groups', session.get('group')) or {}
                        subject_data = firebase.get_one('subjects', session.get('subject')) or {}
                        
                        enhanced_session = {
                            **session,
                            'group_name': group_data.get('name', session.get('group')),
                            'subject_name': subject_data.get('name', session.get('subject'))
                        }
                        
                        # Get teacher name if available
                        if subject_data.get('teacher_id'):
                            teacher_data = firebase.get_one('teachers', subject_data['teacher_id']) or {}
                            enhanced_session['teacher_name'] = teacher_data.get('name')
                        
                        enhanced_day_schedule.append(enhanced_session)
                
                room_week_schedule[day] = enhanced_day_schedule
            
            week_schedule[room_id] = {
                'room_name': room_data.get('name', room_id),
                'room_data': room_data,
                'schedule': room_week_schedule
            }
        
        return jsonify({
            'success': True,
            'data': week_schedule
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500