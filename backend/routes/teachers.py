# routes/teachers.py
from flask import Blueprint, request, jsonify
from firebase_config import firebase

teachers_bp = Blueprint('teachers', __name__)
@teachers_bp.route('/api/teachers', methods=['GET'])
def get_teachers():
    """Get all teachers"""
    try:
        teachers = firebase.get_all('teachers') or {}
        return jsonify({
            'success': True,
            'data': teachers,
            'count': len(teachers)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500