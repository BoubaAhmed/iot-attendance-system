# routes/esp32.py
from flask import Blueprint, request, jsonify
from datetime import datetime
from firebase_config import firebase
from utils import get_room_by_esp32_id

esp32_bp = Blueprint('esp32', __name__)

@esp32_bp.route('/api/esp32/health', methods=['GET'])
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
            'record_attendance': '/api/attendance (POST)',
            'student_lookup': '/api/students/fingerprint/<fingerprint_id> (GET)'
        }
    })

@esp32_bp.route('/api/esp32/status', methods=['GET'])
def esp32_status():
    """Get ESP32 status"""
    try:
        esp32_id = request.args.get('esp32_id')
        if not esp32_id:
            return jsonify({'success': False, 'error': 'esp32_id required'}), 400
        
        # Find room by ESP32 ID
        room_id, room = get_room_by_esp32_id(esp32_id)
        if not room:
            return jsonify({'success': False, 'error': 'ESP32 not found'}), 404
        
        # Check for active session
        today = datetime.now().strftime('%Y-%m-%d')
        session_data = firebase.get_all(f'sessions/{today}/{room_id}')
        
        return jsonify({
            'success': True,
            'esp32_id': esp32_id,
            'room': {'id': room_id, **room},
            'active_session': session_data if session_data and session_data.get('status') == 'ACTIVE' else None,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@esp32_bp.route('/api/esp32/ping', methods=['POST'])
def esp32_ping():
    """Update ESP32 last seen timestamp"""
    try:
        data = request.get_json()
        esp32_id = data.get('esp32_id')
        
        if not esp32_id:
            return jsonify({'success': False, 'error': 'esp32_id required'}), 400
        
        # Find room by ESP32 ID
        rooms = firebase.get_all('rooms') or {}
        room_id = None
        
        for rid, room in rooms.items():
            if isinstance(room, dict) and room.get('esp32_id') == esp32_id:
                room_id = rid
                break
        
        if not room_id:
            return jsonify({'success': False, 'error': 'ESP32 not found'}), 404
        
        # Update last seen
        firebase.update('rooms', room_id, {
            'last_seen': datetime.now().isoformat()
        })
        
        return jsonify({
            'success': True,
            'message': 'Ping received',
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500