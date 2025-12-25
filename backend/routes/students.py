from flask import Blueprint, request, jsonify
from datetime import datetime

students_bp = Blueprint('students', __name__)

# Pour éviter les imports circulaires, nous allons importer firebase dans chaque fonction
# ou créer un fichier de configuration partagé

@students_bp.route('', methods=['GET'])
def get_students():
    """Récupérer tous les étudiants"""
    from ..firebase_config import firebase
    
    try:
        students = firebase.get_all('students')
        return jsonify({
            'success': True,
            'data': students,
            'count': len(students)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@students_bp.route('/<student_id>', methods=['GET'])
def get_student(student_id):
    """Récupérer un étudiant par ID"""
    from ..firebase_config import firebase
    
    try:
        student = firebase.get_one('students', student_id)
        if not student:
            return jsonify({'success': False, 'error': 'Étudiant non trouvé'}), 404
        
        return jsonify({'success': True, 'data': student})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@students_bp.route('', methods=['POST'])
def create_student():
    """Créer un nouvel étudiant"""
    from ..firebase_config import firebase
    
    try:
        data = request.get_json()
        
        # Validation basique
        if not data.get('name'):
            return jsonify({'success': False, 'error': 'Le nom est requis'}), 400
        
        # Récupérer tous les étudiants
        students = firebase.get_all('students') or {}

        # Générer un ID numérique simple (1, 2, 3, ...)
        if students:
            last_id = max(int(sid) for sid in students.keys())
            student_id = str(last_id + 1)
        else:
            student_id = "1"
        
        # Préparer les données
        student_data = {
            'name': data['name'],
            'rfid': data.get('rfid', ''),
            'fingerprint_id': data.get('fingerprint_id', ''),
            'group': data.get('group', ''),
            'created_at': datetime.now().isoformat(),
            'active': True
        }
        
        # Enregistrer
        firebase.create('students', student_data, student_id)
        
        return jsonify({
            'success': True,
            'message': 'Étudiant créé',
            'data': {'id': student_id, **student_data}
        }), 201

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@students_bp.route('/<student_id>', methods=['PUT'])
def update_student(student_id):
    """Mettre à jour un étudiant"""
    from ..firebase_config import firebase
    
    try:
        data = request.get_json()
        
        # Vérifier si l'étudiant existe
        existing = firebase.get_one('students', student_id)
        if not existing:
            return jsonify({'success': False, 'error': 'Étudiant non trouvé'}), 404
        
        # Mettre à jour
        firebase.update('students', student_id, data)
        
        return jsonify({
            'success': True,
            'message': 'Étudiant mis à jour'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@students_bp.route('/<student_id>', methods=['DELETE'])
def delete_student(student_id):
    """Supprimer un étudiant"""
    from ..firebase_config import firebase
    
    try:
        # Vérifier si l'étudiant existe
        existing = firebase.get_one('students', student_id)
        if not existing:
            return jsonify({'success': False, 'error': 'Étudiant non trouvé'}), 404
        
        # Supprimer
        firebase.delete('students', student_id)
        
        return jsonify({
            'success': True,
            'message': 'Étudiant supprimé'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
