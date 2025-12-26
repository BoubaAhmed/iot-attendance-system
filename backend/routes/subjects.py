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