# routes/sessions.py
from flask import Blueprint, request, jsonify, current_app
from datetime import datetime, timedelta
from firebase_config import firebase
from sessions_utils import get_day_of_week, get_room_by_esp32_id, calculate_session_stats
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
import atexit
import threading

sessions_bp = Blueprint('sessions', __name__)

# Initialize scheduler globally
scheduler = None

def init_scheduler(app):
    """Initialize APScheduler with Flask app"""
    global scheduler
    
    if scheduler is not None and scheduler.running:
        print("⚠️ Scheduler already running, skipping initialization")
        return scheduler
    
    scheduler = BackgroundScheduler()
    
    # Use app context wrapper for jobs
    def job_with_context(job_func):
        """Wrapper to run jobs with Flask app context"""
        def wrapped_job():
            with app.app_context():
                job_func()
        return wrapped_job
    
    # Schedule daily session generation at 08:00
    scheduler.add_job(
        func=job_with_context(generate_daily_sessions_job),
        trigger=CronTrigger(hour=8, minute=0),
        id='daily_session_generation',
        name='Generate daily sessions at 08:00',
        replace_existing=True
    )
    scheduler.add_job(
        func=job_with_context(generate_daily_sessions_job),
        trigger=CronTrigger(hour=13, minute=34),
        id='daily_session_generation',
        name='Generate daily sessions at 13:34',
        replace_existing=True
    )
    
    # Schedule auto-closing of sessions every minute
    scheduler.add_job(
        func=job_with_context(auto_close_completed_sessions_job),
        trigger='interval',
        minutes=1,
        id='auto_close_sessions',
        name='Auto-close completed sessions every minute',
        replace_existing=True
    )
    
    scheduler.start()
    
    print("✅ APScheduler started with 2 jobs:")
    for job in scheduler.get_jobs():
        print(f"   - {job.name} (next run: {job.next_run_time})")
    
    # Shut down scheduler when app exits
    atexit.register(shutdown_scheduler)
    
    return scheduler

def shutdown_scheduler():
    """Shutdown scheduler"""
    global scheduler
    if scheduler and scheduler.running:
        scheduler.shutdown()
        scheduler = None
        print("🛑 Scheduler shutdown")

# Job functions - NO app context handling here, handled by wrapper
def generate_daily_sessions_job():
    """Generate sessions for today based on schedule"""
    try:
        today = datetime.now().strftime('%Y-%m-%d')
        day_of_week = get_day_of_week(today).lower()
        
        print(f"🔄 Generating sessions for {today} ({day_of_week})...")
        
        schedule = firebase.get_all('schedule') or {}
        sessions_created = 0
        
        for room_id, room_schedule in schedule.items():
            if day_of_week in room_schedule:
                day_sessions = room_schedule[day_of_week]
                
                if isinstance(day_sessions, list):
                    for session_data in day_sessions:
                        if isinstance(session_data, dict):
                            # Create unique session key
                            session_key = f"{today}/{room_id}/{session_data.get('start')}_{session_data.get('end')}"
                            
                            # Check if session already exists
                            existing_session = firebase.get_one('sessions', session_key)
                            if existing_session:
                                continue
                            
                            # Create session entry
                            session_entry = {
                                'date': today,
                                'room': room_id,
                                'start': session_data.get('start'),
                                'end': session_data.get('end'),
                                'group': session_data.get('group'),
                                'subject': session_data.get('subject'),
                                'status': 'SCHEDULED',
                                'created_at': datetime.now().isoformat()
                            }
                            
                            # Get room info
                            room = firebase.get_one('rooms', room_id) or {}
                            if room:
                                session_entry['room_name'] = room.get('name', room_id)
                            
                            # Save session
                            firebase.create('sessions', session_entry, session_key)
                            sessions_created += 1
                            print(f"   📅 Created session: {room_id} at {session_data.get('start')}-{session_data.get('end')}")
        
        print(f"✅ Generated {sessions_created} sessions for {today}")
        
    except Exception as e:
        print(f"❌ Error generating daily sessions: {str(e)}")

def auto_close_completed_sessions_job():
    """Auto-close sessions that have passed their end time"""
    try:
        today = datetime.now().strftime('%Y-%m-%d')
        current_time = datetime.now().strftime('%H:%M')
        current_datetime = datetime.now()
        
        # Get all sessions for today
        all_sessions = firebase.get_all('sessions') or {}
        sessions_closed = 0
        
        for session_key, session in all_sessions.items():
            if (isinstance(session, dict) and 
                session.get('date') == today and 
                session.get('status') == 'ACTIVE'):
                
                session_end = session.get('end')
                
                # Parse end time
                if session_end:
                    try:
                        end_hour, end_minute = map(int, session_end.split(':'))
                        end_time = current_datetime.replace(
                            hour=end_hour, 
                            minute=end_minute, 
                            second=0, 
                            microsecond=0
                        )
                        
                        # Add 5 minutes grace period
                        end_time_with_grace = end_time + timedelta(minutes=5)
                        
                        # Check if current time is past end time + grace period
                        if current_datetime > end_time_with_grace:
                            room_id = session.get('room')
                            group_id = session.get('group')
                            
                            # Calculate attendance stats
                            stats = calculate_session_stats(today, room_id, group_id)
                            
                            if stats:
                                # Close session
                                session['status'] = 'CLOSED'
                                session['closed_at'] = datetime.now().isoformat()
                                session['stats'] = stats
                                session['auto_closed'] = True
                                
                                firebase.update('sessions', session_key, session)
                                sessions_closed += 1
                                
                                print(f"   ⏹️ Auto-closed session: {session_key}")
                    except ValueError:
                        print(f"Invalid time format in session {session_key}: {session_end}")
                        continue
        
        if sessions_closed > 0:
            print(f"✅ Auto-closed {sessions_closed} sessions at {current_time}")
            
    except Exception as e:
        print(f"❌ Error auto-closing sessions: {str(e)}")

# ================ API ENDPOINTS ================

@sessions_bp.route('/api/sessions', methods=['GET'])
def get_sessions():
    """Get all sessions with optional filters"""
    try:
        date = request.args.get('date')
        room = request.args.get('room')
        status = request.args.get('status')
        
        all_sessions = firebase.get_all('sessions') or {}
        filtered_sessions = []
        
        for session_key, session_data in all_sessions.items():
            if not isinstance(session_data, dict):
                continue
                
            if date and session_data.get('date') != date:
                continue
            
            if room and session_data.get('room') != room:
                continue
            
            if status and session_data.get('status') != status:
                continue
            
            # Get room info
            room_data = firebase.get_one('rooms', session_data.get('room')) or {}
            
            enhanced_session = {
                'id': session_key,
                **session_data,
                'room_name': room_data.get('name', session_data.get('room')),
                'room_active': room_data.get('active', False)
            }
            
            filtered_sessions.append(enhanced_session)
        
        # Sort by date and start time
        filtered_sessions.sort(key=lambda x: (
            x.get('date', ''),
            x.get('start', '')
        ), reverse=True)
        
        return jsonify({
            'success': True,
            'data': filtered_sessions,
            'count': len(filtered_sessions)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@sessions_bp.route('/api/sessions/today', methods=['GET'])
def get_today_sessions():
    """Get today's sessions"""
    try:
        today = datetime.now().strftime('%Y-%m-%d')
        
        all_sessions = firebase.get_all('sessions') or {}
        today_sessions = []
        
        for session_key, session_data in all_sessions.items():
            if isinstance(session_data, dict) and session_data.get('date') == today:
                # Get room info
                room_data = firebase.get_one('rooms', session_data.get('room')) or {}
                
                enhanced_session = {
                    'id': session_key,
                    **session_data,
                    'room_name': room_data.get('name', session_data.get('room')),
                    'room_active': room_data.get('active', False)
                }
                
                today_sessions.append(enhanced_session)
        
        # Sort by start time
        today_sessions.sort(key=lambda x: x.get('start', ''))
        
        return jsonify({
            'success': True,
            'data': today_sessions,
            'count': len(today_sessions)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@sessions_bp.route('/api/sessions/check', methods=['GET'])
def check_session():
    """Check if session is scheduled for ESP32"""
    try:
        esp32_id = request.args.get('esp32_id')
        if not esp32_id:
            return jsonify({'success': False, 'error': 'esp32_id required'}), 400
        
        # Find room by ESP32 ID
        room_id, room = get_room_by_esp32_id(esp32_id)
        if not room_id:
            return jsonify({'success': False, 'error': 'Room not found for ESP32'}), 404
        
        today = datetime.now().strftime('%Y-%m-%d')
        current_time = datetime.now().strftime('%H:%M')
        
        # Find active session for this room today
        all_sessions = firebase.get_all('sessions') or {}
        
        for session_key, session in all_sessions.items():
            if (isinstance(session, dict) and
                session.get('date') == today and
                session.get('room') == room_id and
                session.get('status') in ['SCHEDULED', 'ACTIVE']):
                
                session_start = session.get('start')
                session_end = session.get('end')
                
                if session_start <= current_time <= session_end:
                    return jsonify({
                        'success': True,
                        'session_path': session_key,
                        'session': session,
                        'message': 'Session found'
                    })
        
        return jsonify({
            'success': False,
            'message': 'No active session found'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@sessions_bp.route('/api/sessions/start', methods=['POST'])
def start_session():
    """Start a session (can be called by ESP32)"""
    try:
        esp32_id = request.args.get('esp32_id')
        if not esp32_id:
            return jsonify({'success': False, 'error': 'esp32_id required'}), 400
        
        # Find room
        room_id, room = get_room_by_esp32_id(esp32_id)
        if not room_id:
            return jsonify({'success': False, 'error': 'Room not found'}), 404
        
        today = datetime.now().strftime('%Y-%m-%d')
        current_time = datetime.now().strftime('%H:%M')
        
        # Find scheduled session for this room
        all_sessions = firebase.get_all('sessions') or {}
        session_to_start = None
        session_key = None
        
        for key, session in all_sessions.items():
            if (isinstance(session, dict) and
                session.get('date') == today and
                session.get('room') == room_id and
                session.get('status') == 'SCHEDULED'):
                
                session_start = session.get('start')
                session_end = session.get('end')
                
                # Allow starting 15 minutes before scheduled time
                if session_start <= current_time <= session_end:
                    session_to_start = session
                    session_key = key
                    break
        
        if not session_to_start:
            return jsonify({'success': False, 'error': 'No scheduled session found'}), 404
        
        # Start the session
        session_to_start['status'] = 'ACTIVE'
        session_to_start['started_at'] = datetime.now().isoformat()
        
        firebase.update('sessions', session_key, session_to_start)
        
        return jsonify({
            'success': True,
            'message': 'Session started successfully',
            'session': session_to_start
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@sessions_bp.route('/api/sessions/stop', methods=['POST'])
def stop_session():
    """Stop a session (can be called by ESP32)"""
    try:
        esp32_id = request.args.get('esp32_id')
        if not esp32_id:
            return jsonify({'success': False, 'error': 'esp32_id required'}), 400
        
        # Find room
        room_id, room = get_room_by_esp32_id(esp32_id)
        if not room_id:
            return jsonify({'success': False, 'error': 'Room not found'}), 404
        
        today = datetime.now().strftime('%Y-%m-%d')
        
        # Find active session for this room
        all_sessions = firebase.get_all('sessions') or {}
        active_session = None
        session_key = None
        
        for key, session in all_sessions.items():
            if (isinstance(session, dict) and
                session.get('date') == today and
                session.get('room') == room_id and
                session.get('status') == 'ACTIVE'):
                active_session = session
                session_key = key
                break
        
        if not active_session:
            return jsonify({'success': False, 'error': 'No active session found'}), 404
        
        # Calculate attendance stats
        stats = calculate_session_stats(today, room_id, active_session.get('group'))
        
        if not stats:
            return jsonify({'success': False, 'error': 'Error calculating statistics'}), 500
        
        # Close session
        active_session['status'] = 'CLOSED'
        active_session['closed_at'] = datetime.now().isoformat()
        active_session['stats'] = stats
        
        firebase.update('sessions', session_key, active_session)
        
        return jsonify({
            'success': True,
            'message': 'Session stopped successfully',
            'stats': stats
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@sessions_bp.route('/api/sessions/generate', methods=['POST'])
def generate_sessions():
    """Manually generate sessions for a specific date"""
    try:
        date_str = request.args.get('date', datetime.now().strftime('%Y-%m-%d'))
        day_of_week = get_day_of_week(date_str).lower()
        
        schedule = firebase.get_all('schedule') or {}
        sessions_created = 0
        
        for room_id, room_schedule in schedule.items():
            if day_of_week in room_schedule:
                day_sessions = room_schedule[day_of_week]
                
                if isinstance(day_sessions, list):
                    for session_data in day_sessions:
                        if isinstance(session_data, dict):
                            # Create session key
                            session_key = f"{date_str}/{room_id}/{session_data.get('start')}_{session_data.get('end')}"
                            
                            # Check if already exists
                            existing_session = firebase.get_one('sessions', session_key)
                            if existing_session:
                                continue
                            
                            # Create session
                            session_entry = {
                                'date': date_str,
                                'room': room_id,
                                'start': session_data.get('start'),
                                'end': session_data.get('end'),
                                'group': session_data.get('group'),
                                'subject': session_data.get('subject'),
                                'status': 'SCHEDULED',
                                'created_at': datetime.now().isoformat()
                            }
                            
                            firebase.create('sessions', session_entry, session_key)
                            sessions_created += 1
        
        return jsonify({
            'success': True,
            'message': f'{sessions_created} sessions created',
            'date': date_str,
            'sessions_created': sessions_created
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@sessions_bp.route('/api/scheduler/status', methods=['GET'])
def get_scheduler_status():
    """Check scheduler status"""
    try:
        global scheduler
        if scheduler:
            jobs = []
            for job in scheduler.get_jobs():
                jobs.append({
                    'id': job.id,
                    'name': job.name,
                    'next_run': job.next_run_time.isoformat() if job.next_run_time else None
                })
            
            return jsonify({
                'success': True,
                'running': scheduler.running,
                'jobs': jobs,
                'jobs_count': len(jobs)
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Scheduler not initialized'
            })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@sessions_bp.route('/api/scheduler/trigger-now', methods=['POST'])
def trigger_now():
    """Manually trigger session generation now"""
    try:
        generate_daily_sessions_job()
        return jsonify({
            'success': True,
            'message': 'Session generation triggered manually'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@sessions_bp.route('/api/scheduler/test', methods=['GET'])
def test_scheduler():
    """Test if scheduler is working"""
    try:
        global scheduler
        return jsonify({
            'success': True,
            'scheduler_exists': scheduler is not None,
            'scheduler_running': scheduler.running if scheduler else False,
            'jobs': [job.name for job in scheduler.get_jobs()] if scheduler else []
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500