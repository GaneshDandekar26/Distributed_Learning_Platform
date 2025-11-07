"""
Authentication Service
Handles user authentication, session management, and authorization.
"""

import socket
import threading
import json
import hashlib
from typing import Dict, Optional
from xmlrpc.server import SimpleXMLRPCServer
from xmlrpc.client import ServerProxy


class AuthService:
    """
    Distributed authentication service using XML-RPC.
    Manages user sessions and credentials.
    """
    
    def __init__(self, host: str = 'localhost', port: int = 5001):
        self.host = host
        self.port = port
        self.users = {}  # Simulated user database
        self.sessions = {}  # Active user sessions
        self.server = None
        
    def register_user(self, username: str, password: str, role: str) -> Dict[str, Any]:
        """Register a new user."""
        if username in self.users:
            return {'success': False, 'error': 'User already exists'}
        
        password_hash = hashlib.sha256(password.encode()).hexdigest()
        self.users[username] = {
            'password_hash': password_hash,
            'role': role
        }
        
        return {'success': True, 'message': 'User registered successfully'}
        
    def login(self, username: str, password: str) -> Dict[str, Any]:
        """Authenticate user and create session."""
        if username not in self.users:
            return {'success': False, 'error': 'Invalid credentials'}
        
        password_hash = hashlib.sha256(password.encode()).hexdigest()
        if self.users[username]['password_hash'] != password_hash:
            return {'success': False, 'error': 'Invalid credentials'}
        
        session_id = hashlib.sha256(f"{username}{password}".encode()).hexdigest()
        self.sessions[session_id] = {
            'username': username,
            'role': self.users[username]['role']
        }
        
        return {
            'success': True,
            'session_id': session_id,
            'role': self.users[username]['role']
        }
        
    def validate_session(self, session_id: str) -> bool:
        """Validate if session is active."""
        return session_id in self.sessions
        
    def logout(self, session_id: str) -> Dict[str, Any]:
        """Terminate user session."""
        if session_id in self.sessions:
            del self.sessions[session_id]
            return {'success': True, 'message': 'Logged out successfully'}
        return {'success': False, 'error': 'Invalid session'}
        
    def start(self):
        """Start the authentication service."""
        self.server = SimpleXMLRPCServer((self.host, self.port), allow_none=True)
        self.server.register_instance(self)
        
        print(f"Auth Service started on {self.host}:{self.port}")
        self.server.serve_forever()
        
    def stop(self):
        """Stop the authentication service."""
        if self.server:
            self.server.shutdown()


if __name__ == '__main__':
    auth_service = AuthService()
    auth_service.start()
