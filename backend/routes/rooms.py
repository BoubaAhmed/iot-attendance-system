# routes/rooms.py
from flask import Blueprint, request, jsonify
from datetime import datetime
from firebase_config import firebase

rooms_bp = Blueprint('rooms', __name__)

@rooms_bp.route('/api/rooms', methods=['GET'])
def get_rooms():
    """Get all rooms"""
    try:
        rooms = firebase.get_all('rooms') or {}
        return jsonify({
            'success': True,
            'data': rooms,
            'count': len(rooms)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@rooms_bp.route('/api/rooms', methods=['POST'])
def create_room():
    """Create new room"""
    try:
        data = request.get_json()
        
        if not data.get('name'):
            return jsonify({'success': False, 'error': 'Name is required'}), 400
        
        room_id = data.get('id')
        if not room_id:
            # Generate room ID from name
            room_id = data['name'].lower().replace(' ', '_')
        
        # Check if room already exists
        existing_room = firebase.get_one('rooms', room_id)
        if existing_room:
            return jsonify({'success': False, 'error': 'Room already exists'}), 400
        
        room_data = {
            'name': data['name'],
            'esp32_id': data.get('esp32_id', ''),
            'active': data.get('active', True)
        }
        
        firebase.create('rooms', room_data, room_id)
        
        return jsonify({
            'success': True,
            'message': 'Room created',
            'data': {'id': room_id, **room_data}
        }), 201
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@rooms_bp.route('/api/rooms/<room_id>', methods=['GET'])
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

@rooms_bp.route('/api/rooms/esp32/<esp32_id>', methods=['GET'])
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

@rooms_bp.route('/api/rooms/<room_id>', methods=['PUT'])
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

@rooms_bp.route('/api/rooms/<room_id>/status', methods=['PUT'])
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
        
        firebase.update('rooms', room_id, {'active': active})
        
        return jsonify({
            'success': True,
            'message': f'Room {"activated" if active else "deactivated"}'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@rooms_bp.route('/api/rooms/<room_id>', methods=['DELETE'])
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