from flask import Blueprint, request, jsonify
from datetime import datetime

groups_bp = Blueprint('groups', __name__)

@groups_bp.route('', methods=['GET'])
def get_groups():
    """Récupérer tous les groupes"""
    from ..firebase_config import firebase
    
    try:
        groups = firebase.get_all('groups')
        return jsonify({
            'success': True,
            'data': groups,
            'count': len(groups)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@groups_bp.route('/<group_id>', methods=['GET'])
def get_group(group_id):
    """Récupérer un groupe par ID"""
    from ..firebase_config import firebase
    
    try:
        group = firebase.get_one('groups', group_id)
        if not group:
            return jsonify({'success': False, 'error': 'Groupe non trouvé'}), 404
        
        return jsonify({'success': True, 'data': group})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@groups_bp.route('', methods=['POST'])
def create_group():
    """Créer un nouveau groupe"""
    from ..firebase_config import firebase
    
    try:
        data = request.get_json()
        
        # Validation basique
        if not data.get('name'):
            return jsonify({'success': False, 'error': 'Le nom est requis'}), 400
        
        # Générer un ID si non fourni
        group_id = data.get('id', f"G{len(firebase.get_all('groups')) + 1:03d}")
        
        # Préparer les données
        group_data = {
            'name': data['name'],
            'level': data.get('level', ''),
            'description': data.get('description', ''),
            'students': data.get('students', {}),
            'created_at': datetime.now().isoformat()
        }
        
        # Enregistrer
        firebase.create('groups', group_data, group_id)
        
        return jsonify({
            'success': True,
            'message': 'Groupe créé',
            'data': {'id': group_id, **group_data}
        }), 201
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@groups_bp.route('/<group_id>', methods=['PUT'])
def update_group(group_id):
    """Mettre à jour un groupe"""
    from ..firebase_config import firebase
    
    try:
        data = request.get_json()
        
        # Vérifier si le groupe existe
        existing = firebase.get_one('groups', group_id)
        if not existing:
            return jsonify({'success': False, 'error': 'Groupe non trouvé'}), 404
        
        # Mettre à jour
        firebase.update('groups', group_id, data)
        
        return jsonify({
            'success': True,
            'message': 'Groupe mis à jour'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@groups_bp.route('/<group_id>', methods=['DELETE'])
def delete_group(group_id):
    """Supprimer un groupe"""
    from ..firebase_config import firebase
    
    try:
        # Vérifier si le groupe existe
        existing = firebase.get_one('groups', group_id)
        if not existing:
            return jsonify({'success': False, 'error': 'Groupe non trouvé'}), 404
        
        # Supprimer
        firebase.delete('groups', group_id)
        
        return jsonify({
            'success': True,
            'message': 'Groupe supprimé'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500