from flask import Blueprint, request, jsonify
from datetime import datetime

attendance_bp = Blueprint('attendance', __name__)

@attendance_bp.route('', methods=['POST'])
def record_attendance():
    """Enregistrer une présence (appelé par ESP32)"""
    from ..firebase_config import firebase
    
    try:
        data = request.get_json()
        
        # Validation des données requises
        required_fields = ['student_id', 'room_id', 'method']
        if not all(field in data for field in required_fields):
            return jsonify({
                'success': False,
                'error': f'Champs requis: {required_fields}'
            }), 400
        
        student_id = data['student_id']
        room_id = data['room_id']
        method = data['method']  # 'RFID' ou 'FINGERPRINT'
        esp32_id = data.get('esp32_id', '')
        
        # Vérifier si l'étudiant existe
        student = firebase.get_one('students', student_id)
        if not student:
            return jsonify({'success': False, 'error': 'Étudiant non trouvé'}), 404
        
        # Vérifier si la salle existe et est active
        room = firebase.get_one('rooms', room_id)
        if not room:
            return jsonify({'success': False, 'error': 'Salle non trouvée'}), 404
        
        if not room.get('active', True):
            return jsonify({'success': False, 'error': 'Salle inactive'}), 400
        
        # Vérifier l'ESP32 si fourni
        if esp32_id and room.get('esp32_id') != esp32_id:
            return jsonify({'success': False, 'error': 'ESP32 non autorisé'}), 403
        
        # Récupérer la session en cours pour cette salle
        current_session = firebase.get_one('currentSession', room_id)
        if not current_session:
            return jsonify({'success': False, 'error': 'Aucune session en cours'}), 400
        
        session_id = current_session.get('sessionId')
        if not session_id:
            return jsonify({'success': False, 'error': 'Session invalide'}), 400
        
        # Vérifier si l'étudiant est déjà présent dans cette session
        existing_attendance = firebase.get_one(f'sessions/{session_id}/attendance', student_id)
        if existing_attendance:
            return jsonify({
                'success': False,
                'error': 'Étudiant déjà enregistré pour cette session'
            }), 400
        
        # Préparer les données de présence
        now = datetime.now()
        attendance_data = {
            'student_id': student_id,
            'name': student.get('name', 'Inconnu'),
            'time': now.strftime('%H:%M:%S'),
            'timestamp': now.isoformat(),
            'method': method,
            'room': room_id,
            'session': session_id
        }
        
        # Enregistrer dans la session
        firebase.create(f'sessions/{session_id}/attendance', attendance_data, student_id)
        
        # Enregistrer dans les logs
        log_data = {
            **attendance_data,
            'action': 'check_in',
            'esp32_id': esp32_id
        }
        firebase.create(f'logs/{room_id}', log_data)
        
        # Mettre à jour le timestamp de la salle
        firebase.update('rooms', room_id, {'last_seen': now.isoformat()})
        
        return jsonify({
            'success': True,
            'message': 'Présence enregistrée',
            'data': attendance_data
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@attendance_bp.route('/session/<session_id>', methods=['GET'])
def get_session_attendance(session_id):
    """Récupérer les présences d'une session"""
    from ..firebase_config import firebase
    
    try:
        attendance = firebase.get_all(f'sessions/{session_id}/attendance')
        
        return jsonify({
            'success': True,
            'session_id': session_id,
            'data': attendance,
            'count': len(attendance)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@attendance_bp.route('/today', methods=['GET'])
def get_today_attendance():
    """Récupérer les présences d'aujourd'hui"""
    from ..firebase_config import firebase
    
    try:
        today = datetime.now().strftime('%Y-%m-%d')
        attendance = firebase.get_all(f'attendance/{today}')
        
        return jsonify({
            'success': True,
            'date': today,
            'data': attendance
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@attendance_bp.route('/stats/daily', methods=['GET'])
def get_daily_stats():
    """Récupérer les statistiques du jour"""
    from ..firebase_config import firebase
    from datetime import datetime
    
    try:
        date_str = request.args.get('date', datetime.now().strftime('%Y-%m-%d'))
        attendance = firebase.get_all(f'attendance/{date_str}')
        
        # Calculer les statistiques
        total = 0
        by_room = {}
        by_method = {'RFID': 0, 'FINGERPRINT': 0}
        
        for room, sessions in attendance.items():
            room_total = 0
            for session, students in sessions.items():
                room_total += len(students)
                total += len(students)
                
                for student_data in students.values():
                    method = student_data.get('method', '')
                    if method in by_method:
                        by_method[method] += 1
            
            by_room[room] = room_total
        
        return jsonify({
            'success': True,
            'date': date_str,
            'stats': {
                'total': total,
                'by_room': by_room,
                'by_method': by_method
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500