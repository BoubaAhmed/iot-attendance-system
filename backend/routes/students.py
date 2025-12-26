# routes/students.py
from flask import Blueprint, request, jsonify
from datetime import datetime
from firebase_config import firebase
from utils import get_student_by_fingerprint, get_next_session_id

students_bp = Blueprint('students', __name__)

@students_bp.route('/api/students', methods=['GET'])
def get_students():
    """Get all students"""
    try:
        students = firebase.get_all('students') or []
        return jsonify({
            'success': True,
            'data': students,
            'count': len(students)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@students_bp.route('/api/students', methods=['POST'])
def create_student():
    """Create new student"""
    try:
        data = request.get_json()
        
        # Validation
        if not data.get('name'):
            return jsonify({'success': False, 'error': 'Name is required'}), 400
        
        # Get existing students
        students = firebase.get_all('students') or []
        
        # Check if fingerprint_id is provided
        fingerprint_id = data.get('fingerprint_id')
        if not fingerprint_id:
            # Generate new fingerprint_id
            fingerprint_id = get_next_session_id()
        else:
            fingerprint_id = int(fingerprint_id)
        
        # Check if fingerprint_id already exists
        for student in students:
            if isinstance(student, dict) and student.get('fingerprint_id') == fingerprint_id:
                return jsonify({'success': False, 'error': 'Fingerprint ID already exists'}), 400
        
        student_data = {
            'name': data['name'],
            'fingerprint_id': fingerprint_id,
            'group': data.get('group', ''),
            'email': data.get('email', ''),
            'phone': data.get('phone', ''),
            'active': data.get('active', True),
            'updated_at': datetime.now().isoformat()
        }
        
        # Add to students array
        firebase.create('students', student_data)
        
        return jsonify({
            'success': True,
            'message': 'Student created',
            'data': student_data
        }), 201
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@students_bp.route('/api/students/<int:fingerprint_id>', methods=['GET'])
def get_student(fingerprint_id):
    """Get student by fingerprint ID"""
    try:
        student = get_student_by_fingerprint(fingerprint_id)
        if not student:
            return jsonify({'success': False, 'error': 'Student not found'}), 404
        
        return jsonify({
            'success': True,
            'data': student
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@students_bp.route('/api/students/<int:fingerprint_id>', methods=['PUT'])
def update_student(fingerprint_id):
    """Update student"""
    try:
        data = request.get_json()
        
        # Get the student first
        student = get_student_by_fingerprint(fingerprint_id)
        if not student:
            return jsonify({'success': False, 'error': 'Student not found'}), 404
        
        # Update student data
        update_data = {}
        if 'name' in data:
            update_data['name'] = data['name']
        if 'group' in data:
            update_data['group'] = data.get('group', '')
        if 'email' in data:
            update_data['email'] = data.get('email', '')
        if 'phone' in data:
            update_data['phone'] = data.get('phone', '')
        if 'active' in data:
            update_data['active'] = data.get('active', True)
        
        update_data['updated_at'] = datetime.now().isoformat()
        
        # Update in Firebase
        success = firebase.update('students', fingerprint_id, update_data)
        
        if not success:
            return jsonify({'success': False, 'error': 'Failed to update student'}), 500
        
        # Get updated student
        updated_student = get_student_by_fingerprint(fingerprint_id)
        
        return jsonify({
            'success': True,
            'message': 'Student updated',
            'data': updated_student
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@students_bp.route('/api/students/<int:fingerprint_id>', methods=['DELETE'])
def delete_student(fingerprint_id):
    """Delete student"""
    try:
        # Check if student exists
        student = get_student_by_fingerprint(fingerprint_id)
        if not student:
            return jsonify({'success': False, 'error': 'Student not found'}), 404
        
        # Delete from Firebase
        firebase.delete('students', fingerprint_id)
        
        return jsonify({
            'success': True,
            'message': 'Student deleted'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@students_bp.route('/api/students/search', methods=['GET'])
def search_students():
    """Search students"""
    try:
        name = request.args.get('name', '')
        group = request.args.get('group', '')
        active = request.args.get('active')
        
        students = firebase.get_all('students') or []
        filtered_students = []
        
        for student in students:
            if not isinstance(student, dict):
                continue
                
            # Apply filters
            if name and name.lower() not in student.get('name', '').lower():
                continue
            if group and student.get('group') != group:
                continue
            if active is not None:
                student_active = student.get('active', True)
                if active.lower() == 'true' and not student_active:
                    continue
                if active.lower() == 'false' and student_active:
                    continue
            
            filtered_students.append(student)
        
        return jsonify({
            'success': True,
            'data': filtered_students,
            'count': len(filtered_students)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@students_bp.route('/api/students/fingerprint/<int:fingerprint_id>', methods=['GET'])
def get_student_by_fingerprint_api(fingerprint_id):
    """Get student by fingerprint ID (for ESP32)"""
    try:
        student = get_student_by_fingerprint(fingerprint_id)
        if not student or not student.get('active', True):
            return jsonify({'success': False, 'error': 'Student not found or inactive'}), 404
        
        return jsonify({
            'success': True,
            'student': student,
            'message': 'Student found'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500