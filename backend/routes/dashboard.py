# routes/dashboard.py
from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
from firebase_config import firebase
import re

dashboard_bp = Blueprint('dashboard', __name__)

def parse_session_id(session_id):
    """Parse session_id to extract date, room, time, and group"""
    try:
        # Format: YYYYMMDD_room_startTime_group
        parts = session_id.split('_')
        if len(parts) >= 4:
            date_str = parts[0]
            # Handle rooms with underscores in name (like "salle_info_1")
            if len(parts) == 5:  # room has 2 underscores
                room = f"{parts[1]}_{parts[2]}"
                start_time = parts[3]
                group = parts[4]
            else:  # room has 1 underscore or none
                room = parts[1]
                start_time = parts[2]
                group = parts[3]
            
            # Convert date from YYYYMMDD to YYYY-MM-DD
            formatted_date = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
            return formatted_date, room, start_time, group
    except:
        pass
    return None, None, None, None

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
        
        # Get today's sessions
        all_sessions = firebase.get_all('sessions') or {}
        today_sessions = []
        active_sessions = 0
        
        # Check if today's date exists in sessions
        if today in all_sessions:
            today_date_sessions = all_sessions.get(today, {})
            if isinstance(today_date_sessions, dict):
                for room_id, room_sessions in today_date_sessions.items():
                    if isinstance(room_sessions, list):
                        for session_data in room_sessions:
                            if isinstance(session_data, dict):
                                today_sessions.append(session_data)
                                if session_data.get('status') == 'OPEN':
                                    active_sessions += 1
        
        # Get today's attendance from attendance collection
        today_attendance_count = 0
        all_attendance = firebase.get_all('attendance') or {}
        
        for session_id, attendance_data in all_attendance.items():
            if not isinstance(attendance_data, dict):
                continue
            
            # Parse session_id to get date
            session_date, _, _, _ = parse_session_id(session_id)
            if session_date == today:
                # Count present students for today
                present_data = attendance_data.get('present', {})
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
        all_students = firebase.get_all('students') or {}
        
        # Group attendance by date
        date_attendance = {}
        for date in dates:
            date_attendance[date] = {'present': 0, 'absent': 0}
        
        for session_id, attendance_record in all_attendance.items():
            if not isinstance(attendance_record, dict):
                continue
            
            # Parse session_id to get date
            session_date, _, _, _ = parse_session_id(session_id)
            if session_date not in dates:
                continue
            
            # Count present
            present_records = attendance_record.get('present', {})
            if isinstance(present_records, dict):
                date_attendance[session_date]['present'] += len(present_records)
                total_present += len(present_records)
            
            # Count absent
            absent_records = attendance_record.get('absent', {})
            if isinstance(absent_records, dict):
                date_attendance[session_date]['absent'] += len(absent_records)
                total_absent += len(absent_records)
        
        # Convert to list format
        for date, counts in date_attendance.items():
            attendance_data.append({
                'date': date,
                'present': counts['present'],
                'absent': counts['absent'],
                'total': counts['present'] + counts['absent']
            })
        
        # Get room utilization
        rooms = firebase.get_all('rooms') or {}
        room_utilization = []
        
        all_sessions = firebase.get_all('sessions') or {}
        
        for room_id, room_data in rooms.items():
            if isinstance(room_data, dict) and room_data.get('active'):
                # Count sessions for this room in date range
                session_count = 0
                
                for date_key, date_sessions in all_sessions.items():
                    if date_key not in dates:
                        continue
                    
                    if not isinstance(date_sessions, dict):
                        continue
                    
                    room_sessions_list = date_sessions.get(room_id, [])
                    if isinstance(room_sessions_list, list):
                        session_count += len(room_sessions_list)
                
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
            
            # Count attendance for this group in date range
            for session_id, attendance_record in all_attendance.items():
                if not isinstance(attendance_record, dict):
                    continue
                
                # Parse session_id to get date and group
                session_date, _, _, session_group = parse_session_id(session_id)
                if session_group != group_id or session_date not in dates:
                    continue
                
                # Count present
                present_records = attendance_record.get('present', {})
                if isinstance(present_records, dict):
                    present_count += len(present_records)
                
                # Count absent
                absent_records = attendance_record.get('absent', {})
                if isinstance(absent_records, dict):
                    absent_count += len(absent_records)
            
            total_count = present_count + absent_count
            attendance_rate = (present_count / total_count * 100) if total_count > 0 else 0
            
            # Count students in group
            students_in_group = sum(1 for student_id, student in all_students.items() 
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
        all_students = firebase.get_all('students') or {}
        all_sessions = firebase.get_all('sessions') or {}
        recent_activity = []
        
        for session_id, attendance_record in all_attendance.items():
            if not isinstance(attendance_record, dict):
                continue
            
            # Parse session_id to get date
            session_date, room_id, start_time, group_id = parse_session_id(session_id)
            if not session_date:
                continue
            
            # Get session details for more context
            session_details = None
            if session_date in all_sessions:
                date_sessions = all_sessions.get(session_date, {})
                if isinstance(date_sessions, dict) and room_id in date_sessions:
                    room_sessions = date_sessions.get(room_id, [])
                    if isinstance(room_sessions, list):
                        for session in room_sessions:
                            if isinstance(session, dict) and session.get('session_id') == session_id:
                                session_details = session
                                break
            
            # Process present records
            present_data = attendance_record.get('present', {})
            if isinstance(present_data, dict):
                for student_id, record in present_data.items():
                    if isinstance(record, dict):
                        # Get student info
                        student = all_students.get(student_id, {})
                        
                        # Create timestamp
                        record_time = record.get('time', '00:00')
                        try:
                            timestamp_str = f"{session_date} {record_time}"
                            timestamp = datetime.strptime(timestamp_str, '%Y-%m-%d %H:%M')
                        except:
                            timestamp = datetime.now()
                        
                        recent_activity.append({
                            'type': 'PRESENT',
                            'date': session_date,
                            'time': record_time,
                            'student_id': student_id,
                            'student_name': student.get('name') or record.get('name', 'Unknown'),
                            'group': group_id,
                            'room': room_id,
                            'session_id': session_id,
                            'subject': session_details.get('subject') if session_details else None,
                            'timestamp': timestamp.isoformat()
                        })
            
            # Process absent records
            absent_data = attendance_record.get('absent', {})
            if isinstance(absent_data, dict):
                for student_id, record in absent_data.items():
                    if isinstance(record, dict):
                        # Get student info
                        student = all_students.get(student_id, {})
                        
                        try:
                            timestamp = datetime.strptime(session_date, '%Y-%m-%d')
                        except:
                            timestamp = datetime.now()
                        
                        recent_activity.append({
                            'type': 'ABSENT',
                            'date': session_date,
                            'time': None,
                            'student_id': student_id,
                            'student_name': student.get('name') or record.get('name', 'Unknown'),
                            'group': group_id,
                            'room': room_id,
                            'session_id': session_id,
                            'subject': session_details.get('subject') if session_details else None,
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
            
            # Find current session for this room
            current_session = None
            if today in all_sessions:
                today_sessions = all_sessions.get(today, {})
                if isinstance(today_sessions, dict) and room_id in today_sessions:
                    room_sessions_list = today_sessions.get(room_id, [])
                    if isinstance(room_sessions_list, list):
                        # Look for session that matches current time
                        for session in room_sessions_list:
                            if isinstance(session, dict):
                                session_start = session.get('start', '00:00')
                                session_end = session.get('end', '23:59')
                                
                                # Check if current time is within session time
                                if session_start <= current_time <= session_end:
                                    current_session = session
                                    break
            
            # Determine room status
            status = 'IDLE'
            if current_session:
                session_status = current_session.get('status', '')
                if session_status == 'OPEN':
                    status = 'ACTIVE'
                elif session_status == 'CLOSED':
                    status = 'COMPLETED'
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
                'esp32_id': room_data.get('esp32_id', ''),
                'capacity': room_data.get('capacity', 0)
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
                for room_id, room_sessions_list in today_sessions.items():
                    if not isinstance(room_sessions_list, list):
                        continue
                    
                    # Get room info
                    room_data = rooms.get(room_id, {})
                    if not isinstance(room_data, dict):
                        continue
                    
                    for session in room_sessions_list:
                        if isinstance(session, dict):
                            session_start = session.get('start', '00:00')
                            session_status = session.get('status', '')
                            
                            # Only include future sessions that are not CLOSED
                            if session_start > current_time and session_status != 'CLOSED':
                                upcoming_sessions.append({
                                    'room_id': room_id,
                                    'room_name': room_data.get('name', room_id),
                                    'session': session,
                                    'time_until': _calculate_time_until(session_start, current_time)
                                })
        
        # Sort by start time
        upcoming_sessions.sort(key=lambda x: x['session'].get('start', '00:00'))
        
        return jsonify({
            'success': True,
            'data': upcoming_sessions[:5],
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
            
            # Calculate attendance stats for this group
            total_present = 0
            total_absent = 0
            attendance_dates = set()
            
            for session_id, attendance_record in all_attendance.items():
                if not isinstance(attendance_record, dict):
                    continue
                
                # Parse session_id to get date and group
                session_date, _, _, session_group = parse_session_id(session_id)
                if session_group != group_id:
                    continue
                
                if session_date:
                    attendance_dates.add(session_date)
                
                # Count present
                present_data = attendance_record.get('present', {})
                if isinstance(present_data, dict):
                    total_present += len(present_data)
                
                # Count absent
                absent_data = attendance_record.get('absent', {})
                if isinstance(absent_data, dict):
                    total_absent += len(absent_data)
            
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