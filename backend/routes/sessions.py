# routes/sessions.py
from flask import Blueprint, request, jsonify
from datetime import datetime
from firebase_config import firebase
from utils import get_day_of_week, check_for_scheduled_session, get_room_by_esp32_id, calculate_session_stats

sessions_bp = Blueprint('sessions', __name__)

@sessions_bp.route('/api/sessions', methods=['GET'])
def get_sessions():
    """Get sessions with filters"""
    try:
        date = request.args.get('date')
        room = request.args.get('room')
        status = request.args.get('status')
        group = request.args.get('group')
        subject = request.args.get('subject')
        
        all_sessions = firebase.get_all('sessions') or {}
        filtered_sessions = []
        
        for session_date, rooms_data in all_sessions.items():
            if date and session_date != date:
                continue
            
            for room_id, session_data in rooms_data.items():
                if room and room_id != room:
                    continue
                if status and session_data.get('status') != status:
                    continue
                if group and session_data.get('group') != group:
                    continue
                if subject and session_data.get('subject') != subject:
                    continue
                
                # Get additional info
                room_data = firebase.get_one('rooms', room_id) or {}
                group_data = firebase.get_one('groups', session_data.get('group')) or {}
                subject_data = firebase.get_one('subjects', session_data.get('subject')) or {}
                
                enhanced_session = {
                    'date': session_date,
                    'room': room_id,
                    **session_data,
                    'room_name': room_data.get('name', room_id),
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

@sessions_bp.route('/api/sessions/check', methods=['GET'])
def check_session():
    """Check if session is scheduled for ESP32"""
    try:
        esp32_id = request.args.get('esp32_id')
        if not esp32_id:
            return jsonify({'success': False, 'error': 'esp32_id required'}), 400
        
        session_path, session = check_for_scheduled_session(esp32_id)
        
        if session_path:
            return jsonify({
                'success': True,
                'session_path': session_path,
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

@sessions_bp.route('/api/sessions/start', methods=['POST'])
def start_session_esp32():
    """Start session for ESP32"""
    try:
        esp32_id = request.args.get('esp32_id')
        if not esp32_id:
            return jsonify({'success': False, 'error': 'esp32_id required'}), 400
        
        # Check if there's a scheduled session
        session_path, session = check_for_scheduled_session(esp32_id)
        
        if not session_path:
            return jsonify({'success': False, 'error': 'No scheduled session'}), 404
        
        # Extract date and room from session
        today = datetime.now().strftime('%Y-%m-%d')
        room_id, _ = get_room_by_esp32_id(esp32_id)
        
        # Start session
        session_data = firebase.get_all(f'sessions/{today}/{room_id}') or {}
        if isinstance(session_data, dict):
            session_data['status'] = 'ACTIVE'
            session_data['started_at'] = datetime.now().isoformat()
            
            firebase.update('sessions', f'{today}/{room_id}', session_data)
        
        return jsonify({
            'success': True,
            'message': 'Session started successfully',
            'session_path': session_path,
            'session': session_data
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@sessions_bp.route('/api/sessions/stop', methods=['POST'])
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
        
        # Find active session for this room today
        today = datetime.now().strftime('%Y-%m-%d')
        session_data = firebase.get_all(f'sessions/{today}/{room_id}')
        
        if not session_data or session_data.get('status') != 'ACTIVE':
            return jsonify({'success': False, 'error': 'No active session'}), 404
        
        # Calculate statistics and mark absences
        stats = calculate_session_stats(today, room_id, session_data.get('group'))
        
        if not stats:
            return jsonify({'success': False, 'error': 'Error calculating statistics'}), 500
        
        # Close session
        session_data['status'] = 'CLOSED'
        session_data['closed_at'] = datetime.now().isoformat()
        session_data['stats'] = stats
        
        firebase.update('sessions', f'{today}/{room_id}', session_data)
        
        return jsonify({
            'success': True,
            'message': 'Session stopped successfully',
            'session_path': f'{today}/{room_id}',
            'stats': stats
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@sessions_bp.route('/api/sessions/generate', methods=['POST'])
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
                
                # Get room info
                room = firebase.get_one('rooms', room_id)
                
                for time_slot, slot_data in day_schedule.items():
                    if isinstance(slot_data, dict):
                        start_time, end_time = time_slot.split('-')
                        
                        session_data = {
                            'date': date_str,
                            'room': room_id,
                            'room_name': room.get('name') if room else room_id,
                            'start': start_time,
                            'end': end_time,
                            'group': slot_data['group'],
                            'subject': slot_data['subject'],
                            'status': 'SCHEDULED',
                            'created_at': datetime.now().isoformat()
                        }
                        
                        firebase.update('sessions', f'{date_str}/{room_id}', session_data)
                        sessions_created.append(f'{date_str}/{room_id}')
        
        return jsonify({
            'success': True,
            'message': f'{len(sessions_created)} scheduled sessions created',
            'date': date_str,
            'day': day_of_week,
            'sessions': sessions_created
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@sessions_bp.route('/api/sessions/today', methods=['GET'])
def get_today_sessions():
    """Get today's sessions"""
    try:
        today = datetime.now().strftime('%Y-%m-%d')
        today_sessions = firebase.get_all(f'sessions/{today}') or {}
        
        enhanced_sessions = []
        for room_id, session_data in today_sessions.items():
            # Get additional info
            room_data = firebase.get_one('rooms', room_id) or {}
            group_data = firebase.get_one('groups', session_data.get('group')) or {}
            subject_data = firebase.get_one('subjects', session_data.get('subject')) or {}
            
            enhanced_sessions.append({
                'date': today,
                'room': room_id,
                **session_data,
                'room_name': room_data.get('name', room_id),
                'group_name': group_data.get('name', session_data.get('group')),
                'subject_name': subject_data.get('name', session_data.get('subject')),
                'teacher': subject_data.get('teacher', '')
            })
        
        return jsonify({
            'success': True,
            'data': enhanced_sessions,
            'count': len(enhanced_sessions)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@sessions_bp.route('/api/sessions/<date>/<room_id>/close', methods=['POST'])
def close_session_manual(date, room_id):
    """Manually close session and calculate absences"""
    try:
        session_data = firebase.get_all(f'sessions/{date}/{room_id}')
        
        if not session_data:
            return jsonify({'success': False, 'error': 'Session not found'}), 404
        
        if session_data.get('status') == 'CLOSED':
            return jsonify({'success': False, 'error': 'Session already closed'}), 400
        
        # Calculate statistics and mark absences
        stats = calculate_session_stats(date, room_id, session_data.get('group'))
        
        if not stats:
            return jsonify({'success': False, 'error': 'Error calculating statistics'}), 500
        
        # Close session
        session_data['status'] = 'CLOSED'
        session_data['closed_at'] = datetime.now().isoformat()
        session_data['stats'] = stats
        
        firebase.update('sessions', f'{date}/{room_id}', session_data)
        
        return jsonify({
            'success': True,
            'message': 'Session closed',
            'stats': stats
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500