# routes/schedule.py
from flask import Blueprint, request, jsonify
from firebase_config import firebase
from utils import get_day_of_week

schedule_bp = Blueprint('schedule', __name__)

@schedule_bp.route('/api/schedule', methods=['GET'])
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

@schedule_bp.route('/api/schedule/room/<room_id>', methods=['GET'])
def get_room_schedule(room_id):
    """Get schedule for a room"""
    try:
        day = request.args.get('day')
        schedule = firebase.get_all(f'schedule/{room_id}') or {}
        
        # Get room info
        room = firebase.get_one('rooms', room_id) or {}
        
        if day:
            day_schedule = schedule.get(day, {})
            # Enhance with subject and group names
            enhanced_schedule = {}
            for time_slot, slot_data in day_schedule.items():
                if isinstance(slot_data, dict):
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

@schedule_bp.route('/api/schedule/today/<room_id>', methods=['GET'])
def get_today_schedule(room_id):
    """Get today's schedule for a room"""
    try:
        today_day = get_day_of_week()
        schedule = firebase.get_all(f'schedule/{room_id}') or {}
        
        # Get room info
        room = firebase.get_one('rooms', room_id) or {}
        
        today_schedule = schedule.get(today_day, {})
        
        # Enhance with subject and group names
        enhanced_schedule = {}
        for time_slot, slot_data in today_schedule.items():
            if isinstance(slot_data, dict):
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

@schedule_bp.route('/api/schedule/entry', methods=['POST'])
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
        
        firebase.update('schedule', f'{room_id}/{day}/{time_slot}', entry_data)
        
        return jsonify({
            'success': True,
            'message': 'Schedule entry added'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@schedule_bp.route('/api/schedule/entry', methods=['DELETE'])
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
        
        path = f'{room_id}/{day}/{time_slot}'
        existing_entry = firebase.get_one('schedule', path)
        if not existing_entry:
            return jsonify({'success': False, 'error': 'Schedule entry not found'}), 404
        
        firebase.delete('schedule', path)
        
        return jsonify({
            'success': True,
            'message': 'Schedule entry deleted'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500