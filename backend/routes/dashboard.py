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
        students = firebase.get_all('students') or {}
        students_count = len(students)
        
        rooms = firebase.get_all('rooms') or {}
        rooms_count = len(rooms)
        active_rooms = sum(1 for room_id, room in rooms.items() 
                          if isinstance(room, dict) and room.get('active', False))
        
        groups_count = len(firebase.get_all('groups') or {})
        subjects_count = len(firebase.get_all('subjects') or {})
        
        # Get today's date
        today = datetime.now().strftime('%Y-%m-%d')
        
        # Get today's sessions - Fixed: sessions are nested under date, then room
        all_sessions = firebase.get_all('sessions') or {}
        today_sessions = []
        active_sessions = 0
        
        # Check if today's date exists in sessions
        if today in all_sessions:
            today_date_sessions = all_sessions.get(today, {})
            if isinstance(today_date_sessions, dict):
                for room_id, room_sessions in today_date_sessions.items():
                    if isinstance(room_sessions, dict):
                        for session_key, session_data in room_sessions.items():
                            if isinstance(session_data, dict):
                                today_sessions.append(session_data)
                                if session_data.get('status') == 'OPEN':
                                    active_sessions += 1
        
        # Get today's attendance - Fixed: attendance is grouped by group, then date
        today_attendance_count = 0
        all_attendance = firebase.get_all('attendance') or {}
        
        for group_id, dates_data in all_attendance.items():
            if not isinstance(dates_data, dict):
                continue
            
            # Get today's attendance for this group
            today_group_data = dates_data.get(today, {})
            if not isinstance(today_group_data, dict):
                continue
            
            # Count present students
            present_data = today_group_data.get('present', {})
            if isinstance(present_data, dict):
                today_attendance_count += len(present_data)
        
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
        
        all_attendance = firebase.get_all('attendance') or {}
        
        for date in dates:
            present_count = 0
            absent_count = 0
            
            # Check attendance for this date across all groups
            for group_id, dates_data in all_attendance.items():
                if not isinstance(dates_data, dict):
                    continue
                
                date_data = dates_data.get(date, {})
                if not isinstance(date_data, dict):
                    continue
                
                # Count present
                present_records = date_data.get('present', {})
                if isinstance(present_records, dict):
                    present_count += len(present_records)
                
                # Count absent
                absent_records = date_data.get('absent', {})
                if isinstance(absent_records, dict):
                    absent_count += len(absent_records)
            
            attendance_data.append({
                'date': date,
                'present': present_count,
                'absent': absent_count,
                'total': present_count + absent_count
            })
            
            total_present += present_count
            total_absent += absent_count
        
        # Get room utilization - Fixed: sessions are nested under date, then room
        rooms = firebase.get_all('rooms') or {}
        room_utilization = []
        
        all_sessions = firebase.get_all('sessions') or {}
        
        for room_id, room_data in rooms.items():
            if isinstance(room_data, dict) and room_data.get('active'):
                # Count sessions for this room in date range
                session_count = 0
                
                for date_key, date_sessions in all_sessions.items():
                    if date_key not in dates:  # Only consider dates in range
                        continue
                    
                    if not isinstance(date_sessions, dict):
                        continue
                    
                    room_sessions = date_sessions.get(room_id, {})
                    if isinstance(room_sessions, dict):
                        session_count += len(room_sessions)
                
                # Calculate utilization percentage
                utilization = round(min(100, (session_count / days) * 100), 2) if days > 0 else 0
                
                room_utilization.append({
                    'room_id': room_id,
                    'room_name': room_data.get('name', room_id),
                    'sessions_count': session_count,
                    'utilization': utilization
                })
        
        # Get group attendance rates
        groups = firebase.get_all('groups') or {}
        group_attendance = []
        
        for group_id, group_data in groups.items():
            present_count = 0
            absent_count = 0
            total_count = 0
            
            # Get attendance for this group across all dates
            group_attendance_data = all_attendance.get(group_id, {})
            if isinstance(group_attendance_data, dict):
                for date, date_data in group_attendance_data.items():
                    if date not in dates:  # Only consider dates in range
                        continue
                    
                    if not isinstance(date_data, dict):
                        continue
                    
                    # Count present
                    present_records = date_data.get('present', {})
                    if isinstance(present_records, dict):
                        present_count += len(present_records)
                    
                    # Count absent
                    absent_records = date_data.get('absent', {})
                    if isinstance(absent_records, dict):
                        absent_count += len(absent_records)
            
            total_count = present_count + absent_count
            attendance_rate = (present_count / total_count * 100) if total_count > 0 else 0
            
            # Count students in group
            students_in_group = sum(1 for student_id, student in (firebase.get_all('students') or {}).items() 
                                   if isinstance(student, dict) and student.get('group') == group_id)
            
            group_attendance.append({
                'group_id': group_id,
                'group_name': group_data.get('name', group_id),
                'level': group_data.get('level', ''),
                'present': present_count,
                'absent': absent_count,
                'total_attendance': total_count,
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

@dashboard_bp.route('/api/dashboard/recent-activity', methods=['GET'])
def get_recent_activity():
    """Get recent attendance activity"""
    try:
        limit = int(request.args.get('limit', 10))
        
        all_attendance = firebase.get_all('attendance') or {}
        recent_activity = []
        
        # Collect all attendance records
        for group_id, dates_data in all_attendance.items():
            if not isinstance(dates_data, dict):
                continue
            
            for date, date_data in dates_data.items():
                if not isinstance(date_data, dict):
                    continue
                
                # Process present records
                present_data = date_data.get('present', {})
                if isinstance(present_data, dict):
                    for student_id, record in present_data.items():
                        if isinstance(record, dict):
                            # Get student info
                            student = firebase.get_one('students', student_id) or {}
                            
                            # Create a timestamp from date and time
                            record_time = record.get('time', '00:00')
                            try:
                                # Combine date and time for sorting
                                timestamp_str = f"{date} {record_time}"
                                timestamp = datetime.strptime(timestamp_str, '%Y-%m-%d %H:%M')
                            except:
                                timestamp = datetime.now()
                            
                            recent_activity.append({
                                'type': 'PRESENT',
                                'date': date,
                                'time': record_time,
                                'student_id': student_id,
                                'student_name': student.get('name') or record.get('name', 'Unknown'),
                                'group': group_id,
                                'room': record.get('room', ''),
                                'timestamp': timestamp.isoformat()
                            })
                
                # Process absent records
                absent_data = date_data.get('absent', {})
                if isinstance(absent_data, dict):
                    for student_id, record in absent_data.items():
                        if isinstance(record, dict):
                            # Get student info
                            student = firebase.get_one('students', student_id) or {}
                            
                            # For absent records, use date only
                            try:
                                timestamp = datetime.strptime(date, '%Y-%m-%d')
                            except:
                                timestamp = datetime.now()
                            
                            recent_activity.append({
                                'type': 'ABSENT',
                                'date': date,
                                'time': None,
                                'student_id': student_id,
                                'student_name': student.get('name') or record.get('name', 'Unknown'),
                                'group': group_id,
                                'room': None,
                                'timestamp': timestamp.isoformat()
                            })
        
        # Sort by timestamp (most recent first)
        recent_activity.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
        
        # Limit results
        recent_activity = recent_activity[:limit]
        
        return jsonify({
            'success': True,
            'data': recent_activity,
            'count': len(recent_activity)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@dashboard_bp.route('/api/dashboard/room-status', methods=['GET'])
def get_room_status():
    """Get current status of all rooms"""
    try:
        rooms = firebase.get_all('rooms') or {}
        room_status = []
        
        all_sessions = firebase.get_all('sessions') or {}
        today = datetime.now().strftime('%Y-%m-%d')
        current_time = datetime.now().strftime('%H:%M')
        
        for room_id, room_data in rooms.items():
            if not isinstance(room_data, dict):
                continue
            
            # Find current session for this room - Fixed: sessions are nested under date
            current_session = None
            if today in all_sessions:
                today_sessions = all_sessions.get(today, {})
                if isinstance(today_sessions, dict) and room_id in today_sessions:
                    room_sessions = today_sessions.get(room_id, {})
                    if isinstance(room_sessions, dict):
                        # Look for OPEN session or determine based on time
                        for session_key, session in room_sessions.items():
                            if isinstance(session, dict):
                                session_status = session.get('status', '')
                                session_start = session.get('start', '00:00')
                                session_end = session.get('end', '23:59')
                                
                                # Check if current time is within session time
                                if session_start <= current_time <= session_end:
                                    current_session = session
                                    break
            
            # Determine room status
            status = 'IDLE'
            if current_session:
                # Check session status
                session_status = current_session.get('status', '')
                if session_status == 'OPEN':
                    status = 'ACTIVE'
                else:
                    # Determine based on time
                    session_start = current_session.get('start', '00:00')
                    session_end = current_session.get('end', '23:59')
                    
                    if current_time < session_start:
                        status = 'UPCOMING'
                    elif current_time > session_end:
                        status = 'COMPLETED'
                    else:
                        status = 'ACTIVE'
            
            room_status.append({
                'room_id': room_id,
                'room_name': room_data.get('name', room_id),
                'status': status,
                'active': room_data.get('active', False),
                'current_session': current_session,
                'esp32_id': room_data.get('esp32_id', '')
            })
        
        return jsonify({
            'success': True,
            'data': room_status
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@dashboard_bp.route('/api/dashboard/upcoming-sessions', methods=['GET'])
def get_upcoming_sessions():
    """Get upcoming sessions for today"""
    try:
        rooms = firebase.get_all('rooms') or {}
        all_sessions = firebase.get_all('sessions') or {}
        today = datetime.now().strftime('%Y-%m-%d')
        current_time = datetime.now().strftime('%H:%M')
        
        upcoming_sessions = []
        
        if today in all_sessions:
            today_sessions = all_sessions.get(today, {})
            if isinstance(today_sessions, dict):
                for room_id, room_sessions in today_sessions.items():
                    if not isinstance(room_sessions, dict):
                        continue
                    
                    # Get room info
                    room_data = rooms.get(room_id, {})
                    if not isinstance(room_data, dict):
                        continue
                    
                    for session_key, session in room_sessions.items():
                        if isinstance(session, dict):
                            session_start = session.get('start', '00:00')
                            
                            # Only include future sessions
                            if session_start > current_time:
                                upcoming_sessions.append({
                                    'room_id': room_id,
                                    'room_name': room_data.get('name', room_id),
                                    'session': session,
                                    'time_until': f"Dans {self._calculate_time_until(session_start, current_time)}"
                                })
        
        # Sort by start time
        upcoming_sessions.sort(key=lambda x: x['session'].get('start', '00:00'))
        
        return jsonify({
            'success': True,
            'data': upcoming_sessions[:5],  # Return only 5 upcoming sessions
            'count': len(upcoming_sessions)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@dashboard_bp.route('/api/dashboard/group-performance', methods=['GET'])
def get_group_performance():
    """Get detailed group performance data"""
    try:
        all_groups = firebase.get_all('groups') or {}
        all_students = firebase.get_all('students') or {}
        all_attendance = firebase.get_all('attendance') or {}
        
        group_performance = []
        
        for group_id, group_data in all_groups.items():
            if not isinstance(group_data, dict):
                continue
            
            # Count students in this group
            students_in_group = [
                student for student_id, student in all_students.items()
                if isinstance(student, dict) and student.get('group') == group_id
            ]
            
            # Get attendance for this group
            group_attendance = all_attendance.get(group_id, {})
            if not isinstance(group_attendance, dict):
                group_attendance = {}
            
            # Calculate attendance stats
            total_present = 0
            total_absent = 0
            attendance_dates = []
            
            for date, date_data in group_attendance.items():
                if isinstance(date_data, dict):
                    present_count = len(date_data.get('present', {}))
                    absent_count = len(date_data.get('absent', {}))
                    total_present += present_count
                    total_absent += absent_count
                    
                    if present_count + absent_count > 0:
                        attendance_dates.append(date)
            
            total_attendance = total_present + total_absent
            attendance_rate = (total_present / total_attendance * 100) if total_attendance > 0 else 0
            
            # Calculate daily average attendance
            daily_avg = (total_present / len(attendance_dates)) if attendance_dates else 0
            
            group_performance.append({
                'group_id': group_id,
                'group_name': group_data.get('name', group_id),
                'level': group_data.get('level', ''),
                'total_students': len(students_in_group),
                'total_present': total_present,
                'total_absent': total_absent,
                'attendance_rate': round(attendance_rate, 2),
                'attendance_days': len(attendance_dates),
                'daily_average': round(daily_avg, 2),
                'year': group_data.get('year', ''),
                'capacity': group_data.get('capacity', 0)
            })
        
        # Sort by attendance rate (highest first)
        group_performance.sort(key=lambda x: x['attendance_rate'], reverse=True)
        
        return jsonify({
            'success': True,
            'data': group_performance
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

def _calculate_time_until(session_start, current_time):
    """Calculate time difference between current time and session start"""
    try:
        start_dt = datetime.strptime(session_start, '%H:%M')
        current_dt = datetime.strptime(current_time, '%H:%M')
        
        if start_dt > current_dt:
            diff = start_dt - current_dt
            hours = diff.seconds // 3600
            minutes = (diff.seconds % 3600) // 60
            
            if hours > 0:
                return f"{hours}h {minutes}min"
            else:
                return f"{minutes}min"
        return "Maintenant"
    except:
        return "N/A"