# routes/groups.py
from flask import Blueprint, request, jsonify
from firebase_config import firebase

groups_bp = Blueprint('groups', __name__)

@groups_bp.route('/api/groups', methods=['GET'])
def get_groups():
    """Get all groups"""
    try:
        groups = firebase.get_all('groups') or {}
        return jsonify({
            'success': True,
            'data': groups,
            'count': len(groups)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@groups_bp.route('/api/groups/<group_id>', methods=['GET'])
def get_group(group_id):
    """Get group by ID"""
    try:
        group = firebase.get_one('groups', group_id)
        if not group:
            return jsonify({'success': False, 'error': 'Group not found'}), 404
        
        return jsonify({
            'success': True,
            'data': {'id': group_id, **group}
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@groups_bp.route('/api/groups/<group_id>/students', methods=['GET'])
def get_group_students(group_id):
    """Get students in a group"""
    try:
        all_students = firebase.get_all('students') or []
        group_students = []
        
        for student in all_students:
            if isinstance(student, dict) and student.get('group') == group_id:
                group_students.append(student)
        
        return jsonify({
            'success': True,
            'data': group_students,
            'count': len(group_students)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500