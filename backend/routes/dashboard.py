# routes/dashboard.py
from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
from firebase_config import firebase
from utils import get_student_by_fingerprint

dashboard_bp = Blueprint('dashboard', __name__)

@dashboard_bp.route('/api/dashboard/stats', methods=['GET'])
def get_dashboard_stats():
    """Get dashboard statistics"""
    try:
        # Count entities
        students = firebase.get_all('students') or []
        students_count = len(students)
        
        rooms = firebase.get_all('rooms') or {}
        rooms_count = len(rooms)
        active_rooms = sum(1 for room in rooms.values() if isinstance(room, dict) and room.get('active', False))
        
        groups_count = len(firebase.get_all('groups') or {})
        subjects_count = len(firebase.get_all('subjects') or {})
        
        # Get today's date
        today = datetime.now().strftime('%Y-%m-%d')
        
        # Get today's sessions
        today_sessions = firebase.get_all(f'sessions/{today}') or {}
        active_sessions = sum(1 for session in today_sessions.values() 
                              if isinstance(session, dict) and session.get('status') == 'ACTIVE')
        
        # Get today's attendance
        today_attendance = firebase.get_all(f'attendance/{today}') or {}
        today_attendance_count = 0
        for group_attendance in today_attendance.values():
            for record in group_attendance:
                if isinstance(record, dict) and record.get('status') == 'PRESENT':
                    today_attendance_count += 1
        
        return jsonify({
            'success': True,
            'stats': {
                'students': students_count,
                'rooms': rooms_count,
                'active_rooms': active_rooms,
                'groups': groups_count,
                'subjects': subjects_count,
                'today_sessions': len(today_sessions),
                'active_sessions': active_sessions,
                'today_attendance': today_attendance_count
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@dashboard_bp.route('/api/dashboard/analytics', methods=['GET'])
def get_analytics():
    """Get analytics data"""
    try:
        days = int(request.args.get('days', 7))
        
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        # Generate date range
        dates = []
        current_date = start_date
        while current_date <= end_date:
            dates.append(current_date.strftime('%Y-%m-%d'))
            current_date += timedelta(days=1)
        
        # Get attendance data for each date
        attendance_data = []
        total_present = 0
        total_absent = 0
        
        for date in dates:
            date_attendance = firebase.get_all(f'attendance/{date}') or {}
            present_count = 0
            absent_count = 0
            
            for group_attendance in date_attendance.values():
                for record in group_attendance:
                    if isinstance(record, dict):
                        if record.get('status') == 'PRESENT':
                            present_count += 1
                        elif record.get('status') == 'ABSENT':
                            absent_count += 1
            
            attendance_data.append({
                'date': date,
                'present': present_count,
                'absent': absent_count,
                'total': present_count + absent_count
            })
            
            total_present += present_count
            total_absent += absent_count
        
        # Get room utilization
        rooms = firebase.get_all('rooms') or {}
        room_utilization = []
        
        for room_id, room_data in rooms.items():
            if isinstance(room_data, dict) and room_data.get('active'):
                # Count sessions for this room in date range
                session_count = 0
                for date in dates:
                    date_sessions = firebase.get_all(f'sessions/{date}') or {}
                    if room_id in date_sessions:
                        session_count += 1
                
                room_utilization.append({
                    'room_id': room_id,
                    'room_name': room_data.get('name', room_id),
                    'sessions_count': session_count,
                    'utilization': min(100, (session_count / days) * 100)  # Percentage of days with sessions
                })
        
        # Get group attendance rates
        groups = firebase.get_all('groups') or {}
        group_attendance = []
        
        for group_id, group_data in groups.items():
            present_count = 0
            total_count = 0
            
            for date in dates:
                date_attendance = firebase.get_all(f'attendance/{date}') or {}
                group_records = date_attendance.get(group_id, [])
                
                for record in group_records:
                    if isinstance(record, dict):
                        total_count += 1
                        if record.get('status') == 'PRESENT':
                            present_count += 1
            
            attendance_rate = (present_count / total_count * 100) if total_count > 0 else 0
            
            # Count students in group
            students_in_group = sum(1 for s in (firebase.get_all('students') or []) 
                                   if isinstance(s, dict) and s.get('group') == group_id)
            
            group_attendance.append({
                'group_id': group_id,
                'group_name': group_data.get('name', group_id),
                'level': group_data.get('level', ''),
                'attendance_rate': round(attendance_rate, 2),
                'total_students': students_in_group
            })
        
        return jsonify({
            'success': True,
            'period': {
                'start_date': start_date.strftime('%Y-%m-%d'),
                'end_date': end_date.strftime('%Y-%m-%d'),
                'days': days
            },
            'summary': {
                'total_present': total_present,
                'total_absent': total_absent,
                'total_attendance': total_present + total_absent,
                'overall_rate': round((total_present / (total_present + total_absent) * 100), 2) if (total_present + total_absent) > 0 else 0
            },
            'daily_attendance': attendance_data,
            'room_utilization': room_utilization,
            'group_attendance': group_attendance
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500