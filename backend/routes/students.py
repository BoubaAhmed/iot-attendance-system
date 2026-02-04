# routes/students.py
from flask import Blueprint, request, jsonify
from datetime import datetime
from firebase_config import firebase
from utils import get_next_session_id

students_bp = Blueprint('students', __name__)

def get_student_by_fingerprint(fingerprint_id):
    """Get student by fingerprint ID, returns (student_id, student_data)"""
    try:
        # Get all students as a dictionary
        students = firebase.get_all('students')
        if not students:
            return None, None
            
        # If students is a list (old structure), handle it
        if isinstance(students, list):
            for idx, student_data in enumerate(students):
                if isinstance(student_data, dict) and student_data.get('fingerprint_id') == fingerprint_id:
                    return f"S{idx+1}", student_data
        # If students is a dict (new structure with S1, S2 keys)
        elif isinstance(students, dict):
            for student_id, student_data in students.items():
                if isinstance(student_data, dict) and student_data.get('fingerprint_id') == fingerprint_id:
                    return student_id, student_data
        
        return None, None
    except Exception as e:
        print(f"Error in get_student_by_fingerprint: {e}")
        return None, None

def generate_student_id():
    """Generate next student ID (S1, S2, etc.)"""
    try:
        students = firebase.get_all('students')
        if not students:
            return "S1"
        
        # If students is a list
        if isinstance(students, list):
            return f"S{len(students) + 1}"
        
        # If students is a dict
        existing_ids = []
        for student_id in students.keys():
            if student_id.startswith('S'):
                try:
                    num = int(student_id[1:])
                    existing_ids.append(num)
                except ValueError:
                    continue
        
        if not existing_ids:
            return "S1"
        
        next_num = max(existing_ids) + 1
        return f"S{next_num}"
    except Exception as e:
        print(f"Error generating student ID: {e}")
        return "S1"

def get_student_data():
    """Get students data, handling both list and dict structures"""
    try:
        students = firebase.get_all('students')
        if students is None:
            return {}
        return students
    except Exception as e:
        print(f"Error getting student data: {e}")
        return {}

@students_bp.route('/api/students', methods=['GET'])
def get_students():
    """Get all students"""
    try:
        students = get_student_data()
        
        # Convert to list format
        students_list = []
        
        # Handle list structure
        if isinstance(students, list):
            for idx, student_data in enumerate(students):
                if isinstance(student_data, dict):
                    student_data_copy = student_data.copy()
                    student_data_copy['id'] = f"S{idx+1}"
                    students_list.append(student_data_copy)
        
        # Handle dict structure
        elif isinstance(students, dict):
            for student_id, student_data in students.items():
                if isinstance(student_data, dict):
                    student_data_copy = student_data.copy()
                    student_data_copy['id'] = student_id
                    students_list.append(student_data_copy)
        
        return jsonify({
            'success': True,
            'data': students_list,
            'count': len(students_list)
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
        
        # Check if fingerprint_id is provided
        fingerprint_id = data.get('fingerprint_id')
        if not fingerprint_id:
            # Generate new fingerprint_id
            fingerprint_id = get_next_session_id()
        else:
            fingerprint_id = int(fingerprint_id)
        
        # Check if fingerprint_id already exists
        students = get_student_data()
        if isinstance(students, list):
            for student_data in students:
                if isinstance(student_data, dict) and student_data.get('fingerprint_id') == fingerprint_id:
                    return jsonify({'success': False, 'error': 'Fingerprint ID already exists'}), 400
        elif isinstance(students, dict):
            for student_data in students.values():
                if isinstance(student_data, dict) and student_data.get('fingerprint_id') == fingerprint_id:
                    return jsonify({'success': False, 'error': 'Fingerprint ID already exists'}), 400
        
        # Generate student ID
        student_id = generate_student_id()
        
        student_data = {
            'name': data['name'],
            'fingerprint_id': fingerprint_id,
            'group': data.get('group', ''),
            'email': data.get('email', ''),
            'phone': data.get('phone', ''),
            'active': data.get('active', True),
            'updated_at': datetime.now().isoformat()
        }
        
        # Add to students collection
        # The create method will handle the key (student_id)
        created_key = firebase.create('students', student_data, student_id)
        
        if not created_key:
            return jsonify({'success': False, 'error': 'Failed to create student'}), 500
        
        # Add ID to response data
        student_data['id'] = student_id
        
        return jsonify({
            'success': True,
            'message': 'Student created',
            'data': student_data,
            'student_id': student_id
        }), 201
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@students_bp.route('/api/students/<int:fingerprint_id>', methods=['GET'])
def get_student(fingerprint_id):
    """Get student by fingerprint ID"""
    try:
        student_id, student_data = get_student_by_fingerprint(fingerprint_id)
        if not student_data:
            return jsonify({'success': False, 'error': 'Student not found'}), 404
        
        # Add ID to response
        student_data_with_id = student_data.copy()
        student_data_with_id['id'] = student_id
        
        return jsonify({
            'success': True,
            'data': student_data_with_id
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@students_bp.route('/api/students/by-id/<string:student_id>', methods=['GET'])
def get_student_by_id(student_id):
    """Get student by student ID (S1, S2, etc.)"""
    try:
        # Use get_one instead of get
        student_data = firebase.get_one('students', student_id)
        if not student_data:
            return jsonify({'success': False, 'error': 'Student not found'}), 404
        
        # Add ID to response
        student_data['id'] = student_id
        
        return jsonify({
            'success': True,
            'data': student_data
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@students_bp.route('/api/students/<int:fingerprint_id>', methods=['PUT'])
def update_student(fingerprint_id):
    """Update student by fingerprint ID"""
    try:
        data = request.get_json()
        
        # Get the student ID and data
        student_id, student_data = get_student_by_fingerprint(fingerprint_id)
        if not student_data:
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
        
        # Check if updating fingerprint_id and ensure it's unique
        if 'fingerprint_id' in data and data['fingerprint_id'] != fingerprint_id:
            new_fingerprint_id = int(data['fingerprint_id'])
            # Check if new fingerprint_id already exists (excluding current student)
            all_students = get_student_data()
            if isinstance(all_students, list):
                for idx, sdata in enumerate(all_students):
                    if isinstance(sdata, dict) and sdata.get('fingerprint_id') == new_fingerprint_id and f"S{idx+1}" != student_id:
                        return jsonify({'success': False, 'error': 'Fingerprint ID already exists'}), 400
            elif isinstance(all_students, dict):
                for sid, sdata in all_students.items():
                    if isinstance(sdata, dict) and sdata.get('fingerprint_id') == new_fingerprint_id and sid != student_id:
                        return jsonify({'success': False, 'error': 'Fingerprint ID already exists'}), 400
            update_data['fingerprint_id'] = new_fingerprint_id
        
        update_data['updated_at'] = datetime.now().isoformat()
        
        # Update in Firebase using student_id (S1, S2, etc.)
        success = firebase.update('students', student_id, update_data)
        
        if not success:
            return jsonify({'success': False, 'error': 'Failed to update student'}), 500
        
        # Get updated student
        updated_student = firebase.get_one('students', student_id)
        if updated_student:
            updated_student['id'] = student_id
        
        return jsonify({
            'success': True,
            'message': 'Student updated',
            'data': updated_student
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@students_bp.route('/api/students/by-id/<string:student_id>', methods=['PUT'])
def update_student_by_id(student_id):
    """Update student by student ID (S1, S2, etc.)"""
    try:
        data = request.get_json()
        
        # Check if student exists
        student_data = firebase.get_one('students', student_id)
        if not student_data:
            return jsonify({'success': False, 'error': 'Student not found'}), 404
        
        current_fingerprint_id = student_data.get('fingerprint_id')
        
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
        
        # Check if updating fingerprint_id and ensure it's unique
        if 'fingerprint_id' in data and data['fingerprint_id'] != current_fingerprint_id:
            new_fingerprint_id = int(data['fingerprint_id'])
            # Check if new fingerprint_id already exists (excluding current student)
            all_students = get_student_data()
            if isinstance(all_students, list):
                for idx, sdata in enumerate(all_students):
                    if isinstance(sdata, dict) and sdata.get('fingerprint_id') == new_fingerprint_id and f"S{idx+1}" != student_id:
                        return jsonify({'success': False, 'error': 'Fingerprint ID already exists'}), 400
            elif isinstance(all_students, dict):
                for sid, sdata in all_students.items():
                    if isinstance(sdata, dict) and sdata.get('fingerprint_id') == new_fingerprint_id and sid != student_id:
                        return jsonify({'success': False, 'error': 'Fingerprint ID already exists'}), 400
            update_data['fingerprint_id'] = new_fingerprint_id
        
        update_data['updated_at'] = datetime.now().isoformat()
        
        # Update in Firebase
        success = firebase.update('students', student_id, update_data)
        
        if not success:
            return jsonify({'success': False, 'error': 'Failed to update student'}), 500
        
        # Get updated student
        updated_student = firebase.get_one('students', student_id)
        if updated_student:
            updated_student['id'] = student_id
        
        return jsonify({
            'success': True,
            'message': 'Student updated',
            'data': updated_student
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@students_bp.route('/api/students/<int:fingerprint_id>', methods=['DELETE'])
def delete_student(fingerprint_id):
    """Delete student by fingerprint ID"""
    try:
        # Get student ID
        student_id, student_data = get_student_by_fingerprint(fingerprint_id)
        if not student_data:
            return jsonify({'success': False, 'error': 'Student not found'}), 404
        
        # Delete from Firebase using student_id
        firebase.delete('students', student_id)
        
        return jsonify({
            'success': True,
            'message': 'Student deleted',
            'deleted_id': student_id
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@students_bp.route('/api/students/by-id/<string:student_id>', methods=['DELETE'])
def delete_student_by_id(student_id):
    """Delete student by student ID (S1, S2, etc.)"""
    try:
        # Check if student exists
        student_data = firebase.get_one('students', student_id)
        if not student_data:
            return jsonify({'success': False, 'error': 'Student not found'}), 404
        
        # Delete from Firebase
        firebase.delete('students', student_id)
        
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
        
        students = get_student_data()
        filtered_students = []
        
        # Handle list structure
        if isinstance(students, list):
            for idx, student_data in enumerate(students):
                if not isinstance(student_data, dict):
                    continue
                    
                # Apply filters
                if name and name.lower() not in student_data.get('name', '').lower():
                    continue
                if group and student_data.get('group') != group:
                    continue
                if active is not None:
                    student_active = student_data.get('active', True)
                    if active.lower() == 'true' and not student_active:
                        continue
                    if active.lower() == 'false' and student_active:
                        continue
                
                # Add ID to student data
                student_data_copy = student_data.copy()
                student_data_copy['id'] = f"S{idx+1}"
                filtered_students.append(student_data_copy)
        
        # Handle dict structure
        elif isinstance(students, dict):
            for student_id, student_data in students.items():
                if not isinstance(student_data, dict):
                    continue
                    
                # Apply filters
                if name and name.lower() not in student_data.get('name', '').lower():
                    continue
                if group and student_data.get('group') != group:
                    continue
                if active is not None:
                    student_active = student_data.get('active', True)
                    if active.lower() == 'true' and not student_active:
                        continue
                    if active.lower() == 'false' and student_active:
                        continue
                
                # Add ID to student data
                student_data_copy = student_data.copy()
                student_data_copy['id'] = student_id
                filtered_students.append(student_data_copy)
        
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
        student_id, student_data = get_student_by_fingerprint(fingerprint_id)
        if not student_data or not student_data.get('active', True):
            return jsonify({'success': False, 'error': 'Student not found or inactive'}), 404
        
        # Add ID to response
        student_data['id'] = student_id
        
        return jsonify({
            'success': True,
            'student': student_data,
            'message': 'Student found'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500