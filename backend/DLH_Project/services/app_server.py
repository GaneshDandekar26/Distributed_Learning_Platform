"""
Application Server
Main backend server handling courses, users, and data with MongoDB.
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
from pymongo import MongoClient
from bson import ObjectId
import os
import logging
from datetime import datetime
import hashlib

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# MongoDB connection
MONGO_URI = os.getenv('MONGO_URI', 'mongodb+srv://ganeshdandekar23_db_user:Uh4TirdCgXsqwPmL@dlh.nmdrhnl.mongodb.net/?appName=DLH')
SERVER_ID = os.getenv('SERVER_ID', 'app1')
PORT = int(os.getenv('PORT', '8001'))

try:
    client = MongoClient(MONGO_URI)
    db = client['distributed_learning_hub']
    users_collection = db['users']
    courses_collection = db['courses']
    sessions_collection = db['sessions']
    logger.info(f"Connected to MongoDB successfully on {SERVER_ID}")
except Exception as e:
    logger.error(f"Failed to connect to MongoDB: {e}")
    db = None


# Helper functions
def hash_password(password: str) -> str:
    """Hash password using SHA-256."""
    return hashlib.sha256(password.encode()).hexdigest()


def serialize_doc(doc):
    """Convert MongoDB document to JSON-serializable format."""
    if doc is None:
        return None
    if isinstance(doc, list):
        return [serialize_doc(d) for d in doc]
    if isinstance(doc, dict):
        doc['_id'] = str(doc['_id'])
        return doc
    return doc


# Health check
@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    db_status = 'connected' if db is not None else 'disconnected'
    return jsonify({
        'status': 'healthy',
        'server_id': SERVER_ID,
        'port': PORT,
        'database': db_status,
        'timestamp': datetime.now().isoformat()
    }), 200


@app.route('/info', methods=['GET'])
def info():
    """Server information."""
    return jsonify({
        'server_id': SERVER_ID,
        'port': PORT,
        'uptime': 'running',
        'timestamp': datetime.now().isoformat()
    }), 200


# Authentication endpoints
@app.route('/auth/signup', methods=['POST'])
def signup():
    """User registration."""
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
        name = data.get('name')
        role = data.get('role', 'student')
        
        if not email or not password or not name:
            return jsonify({'error': 'Missing required fields'}), 400
            
        # Check if user exists
        if users_collection.find_one({'email': email}):
            return jsonify({'error': 'User already exists'}), 400
            
        # Create user
        user = {
            'email': email,
            'password': hash_password(password),
            'name': name,
            'role': role,
            'created_at': datetime.now().isoformat(),
            'created_by': SERVER_ID
        }
        
        result = users_collection.insert_one(user)
        user['_id'] = str(result.inserted_id)
        
        logger.info(f"User registered: {email} on {SERVER_ID}")
        
        return jsonify({
            'success': True,
            'message': 'User registered successfully',
            'user': {
                'id': user['_id'],
                'email': user['email'],
                'name': user['name'],
                'role': user['role']
            },
            'server_id': SERVER_ID
        }), 201
        
    except Exception as e:
        logger.error(f"Signup error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/auth/signin', methods=['POST'])
def signin():
    """User login."""
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
        
        if not email or not password:
            return jsonify({'error': 'Missing email or password'}), 400
            
        # Find user
        user = users_collection.find_one({'email': email})
        
        if not user or user['password'] != hash_password(password):
            return jsonify({'error': 'Invalid credentials'}), 401
            
        # Create session
        session = {
            'user_id': str(user['_id']),
            'email': user['email'],
            'role': user['role'],
            'created_at': datetime.now().isoformat(),
            'server_id': SERVER_ID
        }
        
        session_result = sessions_collection.insert_one(session)
        session_id = str(session_result.inserted_id)
        
        logger.info(f"User logged in: {email} on {SERVER_ID}")
        
        return jsonify({
            'success': True,
            'session_id': session_id,
            'user': {
                'id': str(user['_id']),
                'email': user['email'],
                'name': user['name'],
                'role': user['role']
            },
            'server_id': SERVER_ID
        }), 200
        
    except Exception as e:
        logger.error(f"Signin error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/auth/logout', methods=['POST'])
def logout():
    """User logout."""
    try:
        data = request.get_json()
        session_id = data.get('session_id')
        
        if session_id:
            sessions_collection.delete_one({'_id': ObjectId(session_id)})
            
        return jsonify({'success': True, 'message': 'Logged out successfully'}), 200
        
    except Exception as e:
        logger.error(f"Logout error: {e}")
        return jsonify({'error': str(e)}), 500


# Course endpoints
@app.route('/courses', methods=['GET'])
def get_courses():
    """Get all courses."""
    try:
        courses = list(courses_collection.find())
        return jsonify({
            'success': True,
            'courses': serialize_doc(courses),
            'count': len(courses),
            'server_id': SERVER_ID
        }), 200
        
    except Exception as e:
        logger.error(f"Get courses error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/courses', methods=['POST'])
def create_course():
    """Create a new course."""
    try:
        data = request.get_json()
        
        course = {
            'title': data.get('title'),
            'description': data.get('description'),
            'instructor': data.get('instructor'),
            'students': [],
            'created_at': datetime.now().isoformat(),
            'server_id': SERVER_ID
        }
        
        result = courses_collection.insert_one(course)
        course['_id'] = str(result.inserted_id)
        
        logger.info(f"Course created: {course['title']} on {SERVER_ID}")
        
        return jsonify({
            'success': True,
            'course': serialize_doc(course),
            'server_id': SERVER_ID
        }), 201
        
    except Exception as e:
        logger.error(f"Create course error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/courses/<course_id>', methods=['GET'])
def get_course(course_id):
    """Get a specific course."""
    try:
        course = courses_collection.find_one({'_id': ObjectId(course_id)})
        
        if not course:
            return jsonify({'error': 'Course not found'}), 404
            
        return jsonify({
            'success': True,
            'course': serialize_doc(course),
            'server_id': SERVER_ID
        }), 200
        
    except Exception as e:
        logger.error(f"Get course error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/stats', methods=['GET'])
def get_stats():
    """Get server statistics."""
    try:
        stats = {
            'server_id': SERVER_ID,
            'users_count': users_collection.count_documents({}),
            'courses_count': courses_collection.count_documents({}),
            'sessions_count': sessions_collection.count_documents({}),
            'timestamp': datetime.now().isoformat()
        }
        
        return jsonify(stats), 200
        
    except Exception as e:
        logger.error(f"Get stats error: {e}")
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    logger.info(f"Starting {SERVER_ID} on port {PORT}")
    app.run(host='0.0.0.0', port=PORT, debug=False)
