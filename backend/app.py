# app.py
from flask import Flask, jsonify
from flask_cors import CORS
import os
from datetime import datetime

# Import route blueprints
from routes.students import students_bp
from routes.rooms import rooms_bp
from routes.groups import groups_bp
from routes.subjects import subjects_bp
from routes.schedule import schedule_bp
from routes.sessions import sessions_bp, init_scheduler
from routes.attendance import attendance_bp
from routes.dashboard import dashboard_bp
from routes.teachers import teachers_bp

# Create Flask app
app = Flask(__name__)
CORS(app)

# Configuration
app.config['JSON_SORT_KEYS'] = False

# Register blueprints
app.register_blueprint(students_bp)
app.register_blueprint(rooms_bp)
app.register_blueprint(groups_bp)
app.register_blueprint(subjects_bp)
app.register_blueprint(schedule_bp)
app.register_blueprint(sessions_bp)
app.register_blueprint(attendance_bp)
app.register_blueprint(dashboard_bp)
app.register_blueprint(teachers_bp)

# ================ MAIN ROUTES ================
@app.route('/')
def home():
    return jsonify({
        'message': 'IoT Automated Attendance System API',
        'version': '4.0.0',
        'architecture': 'ESP32-driven, Schedule-based, Fingerprint Only',
        'database_structure': 'Matches provided Firebase schema',
        'endpoints': {
            'students': '/api/students',
            'rooms': '/api/rooms',
            'groups': '/api/groups',
            'subjects': '/api/subjects',
            'schedule': '/api/schedule',
            'sessions': '/api/sessions',
            'attendance': '/api/attendance',
            'teachers': '/api/teachers',
            'dashboard': '/api/dashboard/stats',
        }
    })

@app.route('/api/health')
def health_check():
    return jsonify({
        'status': 'healthy',
        'service': 'IoT Attendance System API',
        'timestamp': datetime.now().isoformat(),
        'version': '4.0.0',
        'authentication': 'Fingerprint Only'
    })

# Error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({'success': False, 'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.errorhandler(400)
def bad_request(error):
    return jsonify({'success': False, 'error': 'Bad request'}), 400

init_scheduler(app)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print("=" * 60)
    print(f"IoT Attendance System - Fingerprint Only")
    print("=" * 60)
    print(f"Server started on http://localhost:{port}")
    print("=" * 60)
    app.run(host='0.0.0.0', port=port, debug=True)