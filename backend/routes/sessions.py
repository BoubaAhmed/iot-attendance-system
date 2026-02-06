# routes/sessions.py
from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
from firebase_config import firebase
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
import atexit

sessions_bp = Blueprint('sessions', __name__)

# Initialize scheduler globally
scheduler = None

def get_day_of_week(date_str=None):
    """Get day of week from date string"""
    try:
        if date_str:
            date_obj = datetime.strptime(date_str, '%Y-%m-%d')
        else:
            date_obj = datetime.now()
       
        # Get weekday number (0 = Monday, 6 = Sunday)
        weekday_num = date_obj.weekday()
       
        # Map to English day names (lowercase)
        days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
       
        return days[weekday_num]
    except Exception as e:
        print(f"Error in get_day_of_week: {e}")
        # Return current day as fallback
        days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        return days[datetime.now().weekday()]

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

    # Schedule daily session generation at 07:55
    scheduler.add_job(
        func=job_with_context(generate_daily_sessions_job),
        trigger=CronTrigger(hour=7, minute=55, timezone='Africa/Casablanca'),
        id='daily_session_generation',
        name='Generate daily sessions at 07:55',
        replace_existing=True
    )

    scheduler.add_job(
        func=job_with_context(auto_activate_scheduled_sessions_job),
        # trigger="interval",
        trigger=CronTrigger(minute='*/5', hour='8-18', timezone='Africa/Casablanca'),
        id='auto_activate_sessions',
        name='Auto activate sessions every 5 minutes between 08:00 and 18:59',
        replace_existing=True
    )

    scheduler.add_job(
        func=job_with_context(auto_close_completed_sessions_job),
        # trigger='interval',
        # minutes=1,
        trigger=CronTrigger(minute='*/5', hour='8-18', timezone='Africa/Casablanca'),
        id='auto_close_sessions',
        name='Auto-close completed sessions every 5 minutes between 08:00 and 18:59',
        replace_existing=True
    )

    scheduler.start()

    print("✅ APScheduler started with 3 jobs:")
    for job in scheduler.get_jobs():
        print(f" - {job.name} (next run: {job.next_run_time})")

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

def time_to_minutes(t):
    """Convert time string (HH:MM) to minutes"""
    if not t or ':' not in t:
        return 0
    try:
        h, m = map(int, t.split(':'))
        return h * 60 + m
    except:
        return 0

def generate_session_id(date, room, start_time, group):
    """Generate a unique session ID matching Firebase format"""
    # Format: YYYYMMDD_room_startTime_group
    # Convert date from YYYY-MM-DD to YYYYMMDD
    date_formatted = date.replace('-', '')
    # Convert time from HH:MM to HHMM
    start_formatted = start_time.replace(':', '')
    
    # In your structure, rooms don't have underscores
    return f"{date_formatted}_{room}_{start_formatted}_{group}"

def get_session_by_id(session_id):
    """Get session by session_id"""
    try:
        # Parse session_id to get date
        date_str = session_id.split('_')[0]
        if len(date_str) == 8:  # YYYYMMDD format
            date = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
        else:
            return None
        
        # Get all sessions for this date
        all_sessions = firebase.get_all('sessions') or {}
        if date not in all_sessions:
            return None
        
        date_sessions = all_sessions[date]
        if not isinstance(date_sessions, dict):
            return None
        
        # Parse room from session_id (second part before time)
        parts = session_id.split('_')
        if len(parts) < 4:
            return None
            
        room = parts[1]  # room is the second part
        
        if room not in date_sessions:
            return None
        
        room_sessions = date_sessions[room]
        if not isinstance(room_sessions, list):
            return None
        
        # Search for the session with matching session_id
        for session in room_sessions:
            if isinstance(session, dict) and session.get('session_id') == session_id:
                return session
        
        return None
        
    except Exception as e:
        print(f"Error getting session by ID: {e}")
        return None

def update_session(session_data):
    """Update session in Firebase structure"""
    try:
        session_id = session_data.get('session_id')
        date = session_data.get('date')
        room = session_data.get('room')
        
        if not session_id or not date or not room:
            print(f"Missing required fields: session_id={session_id}, date={date}, room={room}")
            return False
        
        # Get existing sessions for this date
        date_sessions = firebase.get_one('sessions', date) or {}
        
        # Get or create sessions for this room on this date
        if room not in date_sessions:
            date_sessions[room] = []
        
        room_sessions = date_sessions[room]
        if not isinstance(room_sessions, list):
            room_sessions = []
        
        # Find and update the session
        found = False
        for i, session in enumerate(room_sessions):
            if isinstance(session, dict) and session.get('session_id') == session_id:
                # Update the session
                room_sessions[i] = {**session, **session_data}
                found = True
                break
        
        # If not found, add it
        if not found:
            room_sessions.append(session_data)
        
        date_sessions[room] = room_sessions
        
        # Update in Firebase
        result = firebase.update('sessions', date, date_sessions)
        if not result:
            print(f"Failed to update session in Firebase: {session_id}")
        return result
        
    except Exception as e:
        print(f"Error updating session: {e}")
        return False

def create_session(session_data):
    """Create session in Firebase structure"""
    try:
        date = session_data.get('date')
        room = session_data.get('room')
        session_id = session_data.get('session_id')
        
        if not date or not room or not session_id:
            print(f"Missing required fields: date={date}, room={room}, session_id={session_id}")
            return False
        
        # Check if session already exists
        existing_session = get_session_by_id(session_id)
        if existing_session:
            print(f"Session already exists: {session_id}")
            return False  # Session already exists
        
        # Get existing sessions for this date
        date_sessions = firebase.get_one('sessions', date) or {}
        
        # Get or create sessions for this room on this date
        if room not in date_sessions:
            date_sessions[room] = []
        
        room_sessions = date_sessions[room]
        if not isinstance(room_sessions, list):
            room_sessions = []
        
        # Add the new session
        room_sessions.append(session_data)
        date_sessions[room] = room_sessions
        
        # Update in Firebase
        result = firebase.update('sessions', date, date_sessions)
        if result:
            print(f"✅ Created session: {session_id}")
        else:
            print(f"❌ Failed to create session: {session_id}")
        return result
        
    except Exception as e:
        print(f"Error creating session: {e}")
        return False

def delete_session_by_id(session_id):
    """Delete session by session_id"""
    try:
        # Parse session_id to get date and room
        parts = session_id.split('_')
        if len(parts) < 4:
            return False
            
        date_str = parts[0]
        if len(date_str) == 8:  # YYYYMMDD format
            date = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
        else:
            return False
        
        room = parts[1]  # room is the second part
        
        # Get existing sessions for this date
        date_sessions = firebase.get_one('sessions', date) or {}
        
        if room not in date_sessions:
            return False
        
        room_sessions = date_sessions[room]
        if not isinstance(room_sessions, list):
            return False
        
        # Find and remove the session
        updated_sessions = [
            session for session in room_sessions 
            if isinstance(session, dict) and session.get('session_id') != session_id
        ]
        
        if len(updated_sessions) == len(room_sessions):
            return False  # Session not found
        
        if updated_sessions:
            date_sessions[room] = updated_sessions
        else:
            # Remove the room entry if no sessions left
            del date_sessions[room]
        
        # If no rooms left for this date, remove the date entry
        if not date_sessions:
            return firebase.delete('sessions', date)
        else:
            return firebase.update('sessions', date, date_sessions)
        
    except Exception as e:
        print(f"Error deleting session: {e}")
        return False

# Job functions
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
                            # Generate session ID
                            session_id = generate_session_id(
                                today,
                                room_id,
                                session_data.get('start', ''),
                                session_data.get('group', '')
                            )

                            # Check if session already exists
                            existing_session = get_session_by_id(session_id)
                            if existing_session:
                                # Check if we need to update the status if it's CLOSED from previous day
                                if existing_session.get('status') == 'CLOSED' and existing_session.get('date') != today:
                                    existing_session['status'] = 'SCHEDULED'
                                    existing_session['date'] = today
                                    existing_session['auto_created'] = True
                                    existing_session['created_at'] = datetime.now().isoformat()
                                    if update_session(existing_session):
                                        sessions_created += 1
                                        print(f" 🔄 Reactivated session: {session_id}")
                                else:
                                    print(f" ⚠️ Session already exists: {session_id}")
                                continue

                            # Create session entry
                            session_entry = {
                                'session_id': session_id,
                                'date': today,
                                'room': room_id,
                                'start': session_data.get('start', ''),
                                'end': session_data.get('end', ''),
                                'group': session_data.get('group', ''),
                                'subject': session_data.get('subject', ''),
                                'status': 'SCHEDULED',
                                'created_at': datetime.now().isoformat(),
                                'auto_created': True,
                                'auto_closed': False,
                                'closed_at': None
                            }

                            # Get room info
                            room_info = firebase.get_one('rooms', room_id) or {}
                            if room_info:
                                session_entry['room_name'] = room_info.get('name', room_id)

                            # Get subject info
                            subject_info = firebase.get_one('subjects', session_data.get('subject', '')) or {}
                            if subject_info:
                                session_entry['subject_name'] = subject_info.get('name', session_data.get('subject', ''))

                            # Save session
                            if create_session(session_entry):
                                sessions_created += 1
                                print(f" ✅ Created session: {session_id}")
                            else:
                                print(f" ❌ Failed to create session: {room_id} at {session_data.get('start')}")

        print(f"✅ Generated {sessions_created} sessions for {today}")

    except Exception as e:
        print(f"❌ Error generating daily sessions: {str(e)}")

def auto_activate_scheduled_sessions_job():
    """Automatically activate sessions when their start time arrives"""
    print("🔄 Checking for sessions to auto-activate...")
   
    try:
        today = datetime.now().strftime('%Y-%m-%d')
        current_time = datetime.now().strftime('%H:%M')
        current_minutes = time_to_minutes(current_time)
       
        # Get all sessions for today
        all_sessions = firebase.get_all('sessions') or {}
        sessions_activated = 0
       
        # Check if today has sessions
        if today not in all_sessions:
            print("No sessions for today to activate.")
            return
       
        today_sessions = all_sessions[today]
        if not isinstance(today_sessions, dict):
            return
       
        for room_id, room_sessions in today_sessions.items():
            if not isinstance(room_sessions, list):
                continue
           
            for session in room_sessions:
                if not isinstance(session, dict):
                    continue
               
                if session.get('status') != 'SCHEDULED':
                    continue
               
                start_time = session.get('start')
                if not start_time:
                    continue
               
                start_minutes = time_to_minutes(start_time)
               
                # Activate session when current time is within 5 minutes of start time
                # or up to 15 minutes after start time
                if (start_minutes - 5) <= current_minutes <= (start_minutes + 15):
                    # Check if session is already in the time window
                    if current_minutes >= start_minutes:
                        if 'date' not in session or not session['date']:
                            session['date'] = today
                        session['status'] = 'ACTIVE'
                        session['started_at'] = datetime.now().isoformat()
                        session['auto_activated'] = True
                       
                        if update_session(session):
                            sessions_activated += 1
                            print(f" ▶️ Auto-activated session: {session.get('session_id')}")
       
        if sessions_activated > 0:
            print(f"✅ Auto-activated {sessions_activated} session(s)")
           
    except Exception as e:
        print(f"❌ Error auto-activating sessions: {str(e)}")

def auto_close_completed_sessions_job():
    """Auto-close sessions that have passed their end time"""
    print("🔄 Checking for sessions to auto-close...")

    try:
        today = datetime.now().strftime('%Y-%m-%d')
        current_time = datetime.now().strftime('%H:%M')
        current_minutes = time_to_minutes(current_time)
        
        # Get all sessions for today
        all_sessions = firebase.get_all('sessions') or {}
        sessions_closed = 0
        
        # Check if today has sessions
        if today not in all_sessions:
            print(f"No sessions for today ({today}) to close.")
            return

        today_sessions = all_sessions[today]
        if not isinstance(today_sessions, dict):
            print(f"Today's sessions data is not a dict: {type(today_sessions)}")
            return

        for room_id, room_sessions in today_sessions.items():
            if not isinstance(room_sessions, list):
                continue

            for session in room_sessions:
                if not isinstance(session, dict):
                    continue

                # Skip if already closed
                if session.get('status') == 'CLOSED':
                    continue

                end_time = session.get('end')
                if not end_time:
                    continue

                end_minutes = time_to_minutes(end_time)

                # Close session 5 minutes after end time
                if current_minutes > (end_minutes + 5):
                    if 'date' not in session or not session['date']:
                        session['date'] = today
                    # Close session
                    session['status'] = 'CLOSED'
                    session['closed_at'] = datetime.now().isoformat()
                    session['auto_closed'] = True

                    if update_session(session):
                        sessions_closed += 1
                        print(f" ⏹️ Auto-closed session: {session.get('session_id')} (ended at {end_time}, current: {current_time})")

        if sessions_closed > 0:
            print(f"✅ Auto-closed {sessions_closed} session(s) at {current_time}")
        else:
            print(f"ℹ️ No sessions to auto-close at {current_time}")

    except Exception as e:
        print(f"❌ Error auto-closing sessions: {str(e)}")

def flatten_sessions(all_sessions):
    """Convert structure to flat list of sessions"""
    flat_sessions = []

    if not all_sessions:
        return flat_sessions

    for date, rooms_data in all_sessions.items():
        if not isinstance(rooms_data, dict):
            continue

        for room_id, room_sessions in rooms_data.items():
            if not isinstance(room_sessions, list):
                continue

            for session in room_sessions:
                if not isinstance(session, dict):
                    continue

                session_with_date = {
                    **session,
                    'date': session.get('date', date)
                }

                flat_sessions.append(session_with_date)

    return flat_sessions

# ================ API ENDPOINTS ================
@sessions_bp.route('/api/sessions', methods=['GET'])
def get_sessions():
    """Get all sessions with optional filters"""
    try:
        date = request.args.get('date')
        room = request.args.get('room')
        status = request.args.get('status')
        group = request.args.get('group')
        subject = request.args.get('subject')

        all_sessions = firebase.get_all('sessions') or {}
        flat_sessions = flatten_sessions(all_sessions)
        filtered_sessions = []

        for session in flat_sessions:
            if date and session.get('date') != date:
                continue

            if room and session.get('room') != room:
                continue

            if status and session.get('status') != status:
                continue

            if group and session.get('group') != group:
                continue

            if subject and session.get('subject') != subject:
                continue

            # Get room info
            room_data = firebase.get_one('rooms', session.get('room')) or {}

            # Get subject info
            subject_data = firebase.get_one('subjects', session.get('subject')) or {}

            enhanced_session = {
                **session,
                'room_name': room_data.get('name', session.get('room')),
                'room_active': room_data.get('active', False),
                'subject_name': subject_data.get('name', session.get('subject'))
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
        print(f"Error in get_sessions endpoint: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@sessions_bp.route('/api/sessions/today', methods=['GET'])
def get_today_sessions():
    """Get today's sessions"""
    try:
        today = datetime.now().strftime('%Y-%m-%d')
       
        all_sessions = firebase.get_all('sessions') or {}
        today_sessions = []
       
        # Check if today has sessions
        if today in all_sessions:
            today_date_sessions = all_sessions[today]
            if isinstance(today_date_sessions, dict):
                for room_id, room_sessions in today_date_sessions.items():
                    if not isinstance(room_sessions, list):
                        continue
                    
                    for session in room_sessions:
                        if not isinstance(session, dict):
                            continue
                        
                        # Get room info
                        room_data = firebase.get_one('rooms', room_id) or {}
                       
                        # Get subject info
                        subject_data = firebase.get_one('subjects', session.get('subject')) or {}
                       
                        enhanced_session = {
                            **session,
                            'room_name': room_data.get('name', room_id),
                            'room_active': room_data.get('active', False),
                            'subject_name': subject_data.get('name', session.get('subject'))
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
        print(f"Error in get_today_sessions endpoint: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@sessions_bp.route('/api/sessions/generate', methods=['POST'])
def generate_sessions():
    """Manually generate sessions for a specific date (backup if scheduler fails)"""
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
                            # Generate session ID
                            session_id = generate_session_id(
                                date_str,
                                room_id,
                                session_data.get('start', ''),
                                session_data.get('group', '')
                            )
                           
                            # Check if already exists
                            existing_session = get_session_by_id(session_id)
                            if existing_session:
                                # Update if needed - only if date doesn't match (carryover from previous day)
                                if existing_session.get('date') != date_str:
                                    existing_session['date'] = date_str
                                    existing_session['status'] = 'SCHEDULED'
                                    existing_session['updated_at'] = datetime.now().isoformat()
                                    if update_session(existing_session):
                                        sessions_created += 1
                                        print(f" 🔄 Updated session date: {session_id}")
                                continue
                           
                            # Create session
                            session_entry = {
                                'session_id': session_id,
                                'date': date_str,
                                'room': room_id,
                                'start': session_data.get('start', ''),
                                'end': session_data.get('end', ''),
                                'group': session_data.get('group', ''),
                                'subject': session_data.get('subject', ''),
                                'status': 'SCHEDULED',
                                'created_at': datetime.now().isoformat(),
                                'manually_created': True,
                                'auto_created': False,
                                'auto_closed': False,
                                'closed_at': None
                            }
                           
                            # Get room info
                            room_info = firebase.get_one('rooms', room_id) or {}
                            if room_info:
                                session_entry['room_name'] = room_info.get('name', room_id)
                           
                            # Get subject info
                            subject_info = firebase.get_one('subjects', session_data.get('subject', '')) or {}
                            if subject_info:
                                session_entry['subject_name'] = subject_info.get('name', session_data.get('subject', ''))
                           
                            if create_session(session_entry):
                                sessions_created += 1
       
        return jsonify({
            'success': True,
            'message': f'{sessions_created} sessions created/updated',
            'date': date_str,
            'sessions_created': sessions_created
        })
    except Exception as e:
        print(f"Error in generate_sessions endpoint: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@sessions_bp.route('/api/sessions/<session_id>', methods=['GET'])
def get_session(session_id):
    """Get a specific session by ID"""
    try:
        session = get_session_by_id(session_id)
        if not session:
            return jsonify({'success': False, 'error': 'Session not found'}), 404
       
        # Get room info
        room_data = firebase.get_one('rooms', session.get('room')) or {}
       
        # Get subject info
        subject_data = firebase.get_one('subjects', session.get('subject')) or {}
       
        enhanced_session = {
            **session,
            'room_name': room_data.get('name', session.get('room')),
            'room_active': room_data.get('active', False),
            'subject_name': subject_data.get('name', session.get('subject'))
        }
       
        return jsonify({
            'success': True,
            'data': enhanced_session
        })
    except Exception as e:
        print(f"Error in get_session endpoint: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@sessions_bp.route('/api/sessions/room/<room_id>', methods=['GET'])
def get_sessions_by_room(room_id):
    """Get all sessions for a specific room"""
    try:
        date = request.args.get('date')
       
        all_sessions = firebase.get_all('sessions') or {}
        filtered_sessions = []
       
        for session_date, rooms in all_sessions.items():
            if date and session_date != date:
                continue
           
            if not isinstance(rooms, dict) or room_id not in rooms:
                continue
           
            room_sessions = rooms[room_id]
            if not isinstance(room_sessions, list):
                continue
           
            for session in room_sessions:
                if not isinstance(session, dict):
                    continue
               
                # Get room info
                room_data = firebase.get_one('rooms', room_id) or {}
               
                # Get subject info
                subject_data = firebase.get_one('subjects', session.get('subject')) or {}
               
                enhanced_session = {
                    **session,
                    'room_name': room_data.get('name', room_id),
                    'room_active': room_data.get('active', False),
                    'subject_name': subject_data.get('name', session.get('subject'))
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
        print(f"Error in get_sessions_by_room endpoint: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@sessions_bp.route('/api/sessions/<session_id>', methods=['PUT'])
def update_session_status(session_id):
    """Update session status"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'No data provided'}), 400
        
        # Get existing session
        session = get_session_by_id(session_id)
        if not session:
            return jsonify({'success': False, 'error': 'Session not found'}), 404
        
        # Update session
        updated_session = {**session, **data}
        
        # Add timestamp for certain actions
        if data.get('status') == 'ACTIVE' and 'started_at' not in session:
            updated_session['started_at'] = datetime.now().isoformat()
        elif data.get('status') == 'CLOSED' and 'closed_at' not in session:
            updated_session['closed_at'] = datetime.now().isoformat()
            updated_session['auto_closed'] = False
        
        if update_session(updated_session):
            return jsonify({
                'success': True,
                'message': 'Session updated',
                'data': updated_session
            })
        else:
            return jsonify({'success': False, 'error': 'Failed to update session'}), 500
            
    except Exception as e:
        print(f"Error in update_session_status endpoint: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@sessions_bp.route('/api/sessions/<session_id>', methods=['DELETE'])
def delete_session(session_id):
    """Delete a session"""
    try:
        if delete_session_by_id(session_id):
            return jsonify({
                'success': True,
                'message': 'Session deleted successfully'
            })
        else:
            return jsonify({'success': False, 'error': 'Session not found or could not be deleted'}), 404
            
    except Exception as e:
        print(f"Error in delete_session endpoint: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@sessions_bp.route('/api/sessions/create', methods=['POST'])
def create_session_manual():
    """Manually create a session"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'No data provided'}), 400
        
        required_fields = ['date', 'room', 'start', 'end', 'group', 'subject']
        for field in required_fields:
            if field not in data:
                return jsonify({'success': False, 'error': f'Missing required field: {field}'}), 400
        
        # Generate session ID
        session_id = generate_session_id(
            data['date'],
            data['room'],
            data['start'],
            data['group']
        )
        
        # Check if session already exists
        existing_session = get_session_by_id(session_id)
        if existing_session:
            return jsonify({'success': False, 'error': 'Session already exists'}), 409
        
        # Create session
        session_entry = {
            'session_id': session_id,
            'date': data['date'],
            'room': data['room'],
            'start': data['start'],
            'end': data['end'],
            'group': data['group'],
            'subject': data['subject'],
            'status': data.get('status', 'SCHEDULED'),
            'created_at': datetime.now().isoformat(),
            'auto_created': False,
            'auto_closed': False,
            'closed_at': None
        }
        
        # Add optional fields
        if 'room_name' in data:
            session_entry['room_name'] = data['room_name']
        else:
            room_info = firebase.get_one('rooms', data['room']) or {}
            session_entry['room_name'] = room_info.get('name', data['room'])
        
        if 'subject_name' in data:
            session_entry['subject_name'] = data['subject_name']
        else:
            subject_info = firebase.get_one('subjects', data['subject']) or {}
            session_entry['subject_name'] = subject_info.get('name', data['subject'])
        
        if create_session(session_entry):
            return jsonify({
                'success': True,
                'message': 'Session created successfully',
                'session_id': session_id,
                'data': session_entry
            })
        else:
            return jsonify({'success': False, 'error': 'Failed to create session'}), 500
            
    except Exception as e:
        print(f"Error in create_session_manual endpoint: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@sessions_bp.route('/api/sessions/bulk-update', methods=['POST'])
def bulk_update_sessions():
    """Bulk update sessions for a specific date"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'No data provided'}), 400
        
        date = data.get('date')
        if not date:
            return jsonify({'success': False, 'error': 'Date is required'}), 400
        
        sessions_to_update = data.get('sessions', [])
        if not isinstance(sessions_to_update, list):
            return jsonify({'success': False, 'error': 'Sessions must be a list'}), 400
        
        updated_count = 0
        
        for session_data in sessions_to_update:
            session_id = session_data.get('session_id')
            if not session_id:
                continue
            
            # Get existing session
            existing_session = get_session_by_id(session_id)
            if not existing_session:
                continue
            
            # Update session
            updated_session = {**existing_session, **session_data}
            if update_session(updated_session):
                updated_count += 1
        
        return jsonify({
            'success': True,
            'message': f'{updated_count} sessions updated',
            'updated_count': updated_count
        })
            
    except Exception as e:
        print(f"Error in bulk_update_sessions endpoint: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# Scheduler endpoints
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
                    'next_run': job.next_run_time.isoformat() if job.next_run_time else None,
                    'trigger': str(job.trigger)
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
        print(f"Error in get_scheduler_status endpoint: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@sessions_bp.route('/api/scheduler/trigger-now', methods=['POST'])
def trigger_now():
    """Manually trigger session generation now (for debugging)"""
    try:
        generate_daily_sessions_job()
        return jsonify({
            'success': True,
            'message': 'Session generation triggered manually'
        })
    except Exception as e:
        print(f"Error in trigger_now endpoint: {e}")
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
            'jobs_count': len(scheduler.get_jobs()) if scheduler else 0,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        print(f"Error in test_scheduler endpoint: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@sessions_bp.route('/api/scheduler/jobs', methods=['GET'])
def get_scheduler_jobs():
    """Get detailed info about all scheduler jobs"""
    try:
        global scheduler
        if not scheduler:
            return jsonify({'success': False, 'error': 'Scheduler not initialized'})
       
        jobs = []
        for job in scheduler.get_jobs():
            job_info = {
                'id': job.id,
                'name': job.name,
                'next_run': job.next_run_time.isoformat() if job.next_run_time else None,
                'trigger': str(job.trigger),
                'pending': job.pending
            }
            jobs.append(job_info)
       
        return jsonify({
            'success': True,
            'jobs': jobs,
            'total_jobs': len(jobs)
        })
    except Exception as e:
        print(f"Error in get_scheduler_jobs endpoint: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@sessions_bp.route('/api/scheduler/run-auto-close', methods=['POST'])
def run_auto_close():
    """Manually trigger auto-close job"""
    try:
        auto_close_completed_sessions_job()
        return jsonify({
            'success': True,
            'message': 'Auto-close job triggered manually'
        })
    except Exception as e:
        print(f"Error in run_auto_close endpoint: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@sessions_bp.route('/api/scheduler/run-auto-activate', methods=['POST'])
def run_auto_activate():
    """Manually trigger auto-activate job"""
    try:
        auto_activate_scheduled_sessions_job()
        return jsonify({
            'success': True,
            'message': 'Auto-activate job triggered manually'
        })
    except Exception as e:
        print(f"Error in run_auto_activate endpoint: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500