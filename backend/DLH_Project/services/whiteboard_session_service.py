"""
Whiteboard Session Management Service
Handles whiteboard creation with ID/password and access control
"""
from flask import Blueprint, request, jsonify
import uuid
import hashlib
from typing import Dict, Any
from datetime import datetime

whiteboard_session_bp = Blueprint('whiteboard_session', __name__)

# In-memory storage (in production, use database)
whiteboard_sessions: Dict[str, Dict[str, Any]] = {}


def hash_password(password: str) -> str:
    """Hash password using SHA256"""
    return hashlib.sha256(password.encode()).hexdigest()


@whiteboard_session_bp.route('/whiteboard/create', methods=['POST'])
def create_whiteboard_session():
    """
    Create a new whiteboard session with ID and password
    
    Body:
        - name: Session name
        - password: Session password (optional)
        - user_id: User ID of creator
    """
    try:
        data = request.get_json()
        name = data.get('name')
        password = data.get('password', '')  # Optional password
        user_id = data.get('user_id')
        
        if not name or not user_id:
            return jsonify({
                'success': False,
                'message': 'Missing required fields: name and user_id'
            }), 400
        
        # Generate unique session ID
        session_id = str(uuid.uuid4())[:8]
        
        # Store session
        whiteboard_sessions[session_id] = {
            'id': session_id,
            'name': name,
            'password_hash': hash_password(password) if password else None,
            'creator_id': user_id,
            'creator_name': data.get('creator_name', 'Unknown'),
            'created_at': datetime.now().isoformat(),
            'participants': [user_id],
            'drawing_data': [],
            'is_active': True
        }
        
        return jsonify({
            'success': True,
            'session_id': session_id,
            'session': {
                'id': session_id,
                'name': name,
                'creator_name': whiteboard_sessions[session_id]['creator_name'],
                'created_at': whiteboard_sessions[session_id]['created_at']
            }
        }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@whiteboard_session_bp.route('/whiteboard/join', methods=['POST'])
def join_whiteboard_session():
    """
    Join a whiteboard session with ID and password
    
    Body:
        - session_id: Whiteboard session ID
        - password: Session password (optional if no password set)
        - user_id: User ID joining
    """
    try:
        data = request.get_json()
        session_id = data.get('session_id')
        password = data.get('password', '')
        user_id = data.get('user_id')
        
        if not session_id or not user_id:
            return jsonify({
                'success': False,
                'message': 'Missing required fields: session_id and user_id'
            }), 400
        
        # Check if session exists
        if session_id not in whiteboard_sessions:
            return jsonify({
                'success': False,
                'message': 'Session not found'
            }), 404
        
        session = whiteboard_sessions[session_id]
        
        # Verify password if session has one
        if session['password_hash']:
            if not password or session['password_hash'] != hash_password(password):
                return jsonify({
                    'success': False,
                    'message': 'Invalid password'
                }), 401
        
        # Check if session is active
        if not session['is_active']:
            return jsonify({
                'success': False,
                'message': 'Session is not active'
            }), 403
        
        # Add participant if not already in
        if user_id not in session['participants']:
            session['participants'].append(user_id)
        
        return jsonify({
            'success': True,
            'session_name': session['name'],
            'creator_name': session['creator_name'],
            'participants_count': len(session['participants'])
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@whiteboard_session_bp.route('/whiteboard/sessions', methods=['GET'])
def get_user_sessions():
    """
    Get all whiteboard sessions for a user
    
    Query params:
        - user_id: User ID to get sessions for
    """
    try:
        user_id = request.args.get('user_id')
        
        if not user_id:
            return jsonify({'error': 'user_id required'}), 400
        
        user_sessions = []
        for session_id, session in whiteboard_sessions.items():
            if user_id in session['participants']:
                user_sessions.append({
                    'id': session_id,
                    'name': session['name'],
                    'creator_name': session['creator_name'],
                    'created_at': session['created_at'],
                    'participants_count': len(session['participants']),
                    'is_creator': session['creator_id'] == user_id,
                    'is_active': session['is_active']
                })
        
        return jsonify({
            'success': True,
            'sessions': user_sessions
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@whiteboard_session_bp.route('/whiteboard/close/<session_id>', methods=['POST'])
def close_whiteboard_session(session_id: str):
    """
    Close a whiteboard session (only creator can close)
    
    Body:
        - user_id: User ID trying to close
    """
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        
        if not user_id:
            return jsonify({'error': 'user_id required'}), 400
        
        if session_id not in whiteboard_sessions:
            return jsonify({'error': 'Session not found'}), 404
        
        session = whiteboard_sessions[session_id]
        
        # Only creator can close
        if session['creator_id'] != user_id:
            return jsonify({'error': 'Only creator can close session'}), 403
        
        session['is_active'] = False
        
        return jsonify({
            'success': True,
            'message': 'Session closed successfully'
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
