# routes/subjects.py
from flask import Blueprint, request, jsonify
from firebase_config import firebase

subjects_bp = Blueprint('subjects', __name__)

@subjects_bp.route('/api/subjects', methods=['GET'])
def get_subjects():
    """Get all subjects"""
    try:
        subjects = firebase.get_all('subjects') or {}
        return jsonify({
            'success': True,
            'data': subjects,
            'count': len(subjects)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@subjects_bp.route('/api/subjects/<subject_id>', methods=['GET'])
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

@subjects_bp.route('/api/subjects', methods=['POST'])
def create_subject():
    """Create new subject"""
    try:
        data = request.get_json()
        
        if not data.get('name'):
            return jsonify({'success': False, 'error': 'Name is required'}), 400
        
        # Generate subject ID from name (lowercase, replace spaces with underscores)
        subject_id = data['name'].lower().replace(' ', '_').replace('-', '_')
        
        # Check if subject already exists
        existing_subject = firebase.get_one('subjects', subject_id)
        if existing_subject:
            return jsonify({'success': False, 'error': 'Subject already exists'}), 400
        
        # Prepare subject data
        subject_data = {
            'name': data['name'],
            'teacher_id': data.get('teacher_id', ''),
            'credits': data.get('credits', 3),
            'semester': data.get('semester', 'S1'),
            'level': data.get('level', 'Licence 1'),
            'description': data.get('description', '')
        }
        
        # Create subject
        firebase.create('subjects', subject_data, subject_id)
        
        return jsonify({
            'success': True,
            'message': 'Subject created',
            'data': {'id': subject_id, **subject_data}
        }), 201
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@subjects_bp.route('/api/subjects/<subject_id>', methods=['PUT'])
def update_subject(subject_id):
    """Update subject"""
    try:
        data = request.get_json()
        
        # Check if subject exists
        existing = firebase.get_one('subjects', subject_id)
        if not existing:
            return jsonify({'success': False, 'error': 'Subject not found'}), 404
        
        # Update subject data
        firebase.update('subjects', subject_id, data)
        
        # Get updated subject
        updated_subject = firebase.get_one('subjects', subject_id)
        
        return jsonify({
            'success': True,
            'message': 'Subject updated',
            'data': {'id': subject_id, **updated_subject}
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@subjects_bp.route('/api/subjects/<subject_id>', methods=['DELETE'])
def delete_subject(subject_id):
    """Delete subject"""
    try:
        # Check if subject exists
        existing = firebase.get_one('subjects', subject_id)
        if not existing:
            return jsonify({'success': False, 'error': 'Subject not found'}), 404
        
        # Delete subject
        firebase.delete('subjects', subject_id)
        
        return jsonify({
            'success': True,
            'message': 'Subject deleted'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@subjects_bp.route('/api/subjects/by-teacher/<teacher_id>', methods=['GET'])
def get_subjects_by_teacher(teacher_id):
    """Get subjects by teacher ID"""
    try:
        subjects = firebase.get_all('subjects') or {}
        
        teacher_subjects = {}
        for subject_id, subject_data in subjects.items():
            if subject_data.get('teacher_id') == teacher_id:
                teacher_subjects[subject_id] = subject_data
        
        return jsonify({
            'success': True,
            'data': teacher_subjects,
            'count': len(teacher_subjects)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@subjects_bp.route('/api/subjects/level/<level>', methods=['GET'])
def get_subjects_by_level(level):
    """Get subjects by level"""
    try:
        subjects = firebase.get_all('subjects') or {}
        
        level_subjects = {}
        for subject_id, subject_data in subjects.items():
            if subject_data.get('level') == level:
                level_subjects[subject_id] = subject_data
        
        return jsonify({
            'success': True,
            'data': level_subjects,
            'count': len(level_subjects)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@subjects_bp.route('/api/subjects/stats', methods=['GET'])
def get_subjects_stats():
    """Get subjects statistics"""
    try:
        subjects = firebase.get_all('subjects') or {}
        
        stats = {
            'total': len(subjects),
            'by_level': {},
            'by_semester': {},
            'by_teacher': {},
            'total_credits': 0
        }
        
        for subject_data in subjects.values():
            # Count by level
            level = subject_data.get('level', 'Non spécifié')
            stats['by_level'][level] = stats['by_level'].get(level, 0) + 1
            
            # Count by semester
            semester = subject_data.get('semester', 'Non spécifié')
            stats['by_semester'][semester] = stats['by_semester'].get(semester, 0) + 1
            
            # Count by teacher
            teacher_id = subject_data.get('teacher_id', 'Non assigné')
            stats['by_teacher'][teacher_id] = stats['by_teacher'].get(teacher_id, 0) + 1
            
            # Sum credits
            stats['total_credits'] += subject_data.get('credits', 0)
        
        return jsonify({
            'success': True,
            'stats': stats
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500