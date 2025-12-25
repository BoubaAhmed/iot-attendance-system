from flask import Blueprint, request, jsonify
from datetime import datetime

rooms_bp = Blueprint('rooms', __name__)

@rooms_bp.route('', methods=['GET'])
def get_rooms():
    """Récupérer toutes les salles"""
    from ..firebase_config import firebase
    
    try:
        rooms = firebase.get_all('rooms')
        return jsonify({
            'success': True,
            'data': rooms,
            'count': len(rooms)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@rooms_bp.route('/<room_id>', methods=['GET'])
def get_room(room_id):
    """Récupérer une salle par ID"""
    from ..firebase_config import firebase
    
    try:
        room = firebase.get_one('rooms', room_id)
        if not room:
            return jsonify({'success': False, 'error': 'Salle non trouvée'}), 404
        
        # Récupérer la session en cours si elle existe
        current_session = firebase.get_one('currentSession', room_id)
        
        response_data = {
            **room,
            'current_session': current_session or None
        }
        
        return jsonify({'success': True, 'data': response_data})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@rooms_bp.route('', methods=['POST'])
def create_room():
    """Créer une nouvelle salle"""
    from ..firebase_config import firebase
    
    try:
        data = request.get_json()
        
        # Validation
        if not data.get('name'):
            return jsonify({'success': False, 'error': 'Le nom est requis'}), 400
        
        room_id = data.get('id', f"room{chr(65 + len(firebase.get_all('rooms')))}")
        
        room_data = {
            'name': data['name'],
            'esp32_id': data.get('esp32_id', ''),
            'active': data.get('active', True),
            'created_at': datetime.now().isoformat()
        }
        
        firebase.create('rooms', room_data, room_id)
        
        return jsonify({
            'success': True,
            'message': 'Salle créée',
            'data': {'id': room_id, **room_data}
        }), 201
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@rooms_bp.route('/<room_id>', methods=['PUT'])
def update_room(room_id):
    """Mettre à jour une salle"""
    from ..firebase_config import firebase
    
    try:
        data = request.get_json()
        
        existing = firebase.get_one('rooms', room_id)
        if not existing:
            return jsonify({'success': False, 'error': 'Salle non trouvée'}), 404
        
        firebase.update('rooms', room_id, data)
        
        return jsonify({
            'success': True,
            'message': 'Salle mise à jour'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@rooms_bp.route('/<room_id>/status', methods=['PUT'])
def toggle_room_status(room_id):
    """Activer/désactiver une salle"""
    from ..firebase_config import firebase
    
    try:
        data = request.get_json()
        active = data.get('active')
        
        if active is None:
            return jsonify({'success': False, 'error': 'Champ "active" requis'}), 400
        
        existing = firebase.get_one('rooms', room_id)
        if not existing:
            return jsonify({'success': False, 'error': 'Salle non trouvée'}), 404
        
        firebase.update('rooms', room_id, {'active': active})
        
        return jsonify({
            'success': True,
            'message': f'Salle {"activée" if active else "désactivée"}'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500