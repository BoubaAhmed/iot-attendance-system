# routes/groups.py
from flask import Blueprint, request, jsonify
from firebase_config import firebase
import uuid
from datetime import datetime

groups_bp = Blueprint('groups', __name__)

@groups_bp.route('/api/groups', methods=['GET'])
def get_groups():
    """Get all groups"""
    try:
        groups = firebase.get_all('groups') or {}
        return jsonify({
            'success': True,
            'data': groups
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
            'data': {**group, 'id': group_id}
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@groups_bp.route('/api/groups/<group_id>/students', methods=['GET'])
def get_group_students(group_id):
    """Get students in a group"""
    try:
        all_students = firebase.get_all('students') or {}
        group_students = {}
        
        for student_id, student_data in all_students.items():
            if isinstance(student_data, dict) and student_data.get('group') == group_id:
                group_students[student_id] = student_data
        
        return jsonify({
            'success': True,
            'data': group_students,
            'count': len(group_students)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@groups_bp.route('/api/groups', methods=['POST'])
def create_group():
    """Create a new group"""
    try:
        data = request.json
        
        # Generate group ID (you can use G1, G2, etc. or UUID)
        groups = firebase.get_all('groups') or {}
        group_id = f"G{len(groups) + 1}"
        
        # Prepare group data
        group_data = {
            'name': data.get('name'),
            'level': data.get('level', ''),
            'description': data.get('description', ''),
            'capacity': int(data.get('capacity', 30)),
            'year': int(data.get('year', datetime.now().year)),
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }
        
        # Save to Firebase
        firebase.create('groups', group_data, group_id)
        
        return jsonify({
            'success': True,
            'message': 'Group created successfully',
            'data': {'id': group_id, **group_data}
        }), 201
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@groups_bp.route('/api/groups/<group_id>', methods=['PUT'])
def update_group(group_id):
    """Update a group"""
    try:
        data = request.json
        
        # Check if group exists
        existing_group = firebase.get_one('groups', group_id)
        if not existing_group:
            return jsonify({'success': False, 'error': 'Group not found'}), 404
        
        # Prepare updated data
        updated_data = {
            **existing_group,
            'name': data.get('name', existing_group.get('name')),
            'level': data.get('level', existing_group.get('level', '')),
            'description': data.get('description', existing_group.get('description', '')),
            'capacity': int(data.get('capacity', existing_group.get('capacity', 30))),
            'year': int(data.get('year', existing_group.get('year', datetime.now().year))),
            'updated_at': datetime.now().isoformat()
        }
        
        # Update in Firebase
        firebase.update('groups', group_id, updated_data)
        
        return jsonify({
            'success': True,
            'message': 'Group updated successfully',
            'data': {'id': group_id, **updated_data}
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@groups_bp.route('/api/groups/<group_id>', methods=['DELETE'])
def delete_group(group_id):
    """Delete a group"""
    try:
        # Check if group exists
        existing_group = firebase.get_one('groups', group_id)
        if not existing_group:
            return jsonify({'success': False, 'error': 'Group not found'}), 404
        
        # Check if group has students
        all_students = firebase.get_all('students') or {}
        has_students = any(
            isinstance(student, dict) and student.get('group') == group_id 
            for student in all_students.values()
        )
        
        if has_students:
            return jsonify({
                'success': False, 
                'error': 'Cannot delete group with students. Remove students first.'
            }), 400
        
        # Delete from Firebase
        firebase.delete('groups', group_id)
        
        return jsonify({
            'success': True,
            'message': 'Group deleted successfully'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500