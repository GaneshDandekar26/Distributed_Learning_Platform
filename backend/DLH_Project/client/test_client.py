"""
Test Client for Distributed Services
Provides simple interface to test various distributed services.
"""

import json
import socket
from xmlrpc.client import ServerProxy
import asyncio
import websockets
from typing import Dict, Any


class ServiceClient:
    """
    Client for interacting with distributed services.
    """
    
    def __init__(self, api_gateway_host: str = 'localhost', api_gateway_port: int = 5000):
        self.api_gateway_host = api_gateway_host
        self.api_gateway_port = api_gateway_port
        
    def send_request(self, service: str, action: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Send request to API Gateway."""
        try:
            client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            client_socket.connect((self.api_gateway_host, self.api_gateway_port))
            
            request = {
                'service': service,
                'action': action,
                'data': data
            }
            
            client_socket.send(json.dumps(request).encode('utf-8'))
            response = client_socket.recv(4096).decode('utf-8')
            client_socket.close()
            
            return json.loads(response)
        except Exception as e:
            return {'error': str(e)}


class AuthClient:
    """
    Client for authentication service using XML-RPC.
    """
    
    def __init__(self, host: str = 'localhost', port: int = 5001):
        self.proxy = ServerProxy(f'http://{host}:{port}', allow_none=True)
        
    def register(self, username: str, password: str, role: str = 'student'):
        """Register a new user."""
        return self.proxy.register_user(username, password, role)
        
    def login(self, username: str, password: str):
        """Login user."""
        return self.proxy.login(username, password)
        
    def logout(self, session_id: str):
        """Logout user."""
        return self.proxy.logout(session_id)
        
    def validate_session(self, session_id: str):
        """Validate session."""
        return self.proxy.validate_session(session_id)


class CourseClient:
    """
    Client for course management service using XML-RPC.
    """
    
    def __init__(self, host: str = 'localhost', port: int = 5002):
        self.proxy = ServerProxy(f'http://{host}:{port}', allow_none=True)
        
    def create_course(self, course_id: str, title: str, description: str, instructor: str):
        """Create a new course."""
        course_data = {
            'title': title,
            'description': description,
            'instructor': instructor
        }
        return self.proxy.create_course(course_id, course_data)
        
    def get_course(self, course_id: str):
        """Get course details."""
        return self.proxy.get_course(course_id)
        
    def list_courses(self):
        """List all courses."""
        return self.proxy.list_courses()
        
    def enroll(self, course_id: str, student_id: str):
        """Enroll student in course."""
        return self.proxy.enroll_student(course_id, student_id)
        
    def get_student_courses(self, student_id: str):
        """Get courses for a student."""
        return self.proxy.get_student_courses(student_id)


class ChatClient:
    """
    Client for chat service using WebSockets.
    """
    
    def __init__(self, host: str = 'localhost', port: int = 5003):
        self.uri = f'ws://{host}:{port}'
        self.websocket = None
        
    async def connect(self):
        """Connect to chat service."""
        self.websocket = await websockets.connect(self.uri)
        
    async def send_message(self, user_id: str, content: str, room_id: str):
        """Send a chat message."""
        if not self.websocket:
            await self.connect()
            
        message = {
            'user_id': user_id,
            'content': content,
            'room_id': room_id
        }
        
        await self.websocket.send(json.dumps(message))
        
    async def receive_messages(self):
        """Receive messages from chat service."""
        if not self.websocket:
            await self.connect()
            
        async for message in self.websocket:
            yield json.loads(message)
            
    async def close(self):
        """Close connection."""
        if self.websocket:
            await self.websocket.close()


class WhiteboardClient:
    """
    Client for whiteboard service using WebSockets.
    """
    
    def __init__(self, host: str = 'localhost', port: int = 5004):
        self.uri = f'ws://{host}:{port}'
        self.websocket = None
        
    async def connect(self):
        """Connect to whiteboard service."""
        self.websocket = await websockets.connect(self.uri)
        
    async def join_room(self, room_id: str):
        """Join a whiteboard room."""
        if not self.websocket:
            await self.connect()
            
        message = {
            'action': 'join',
            'room_id': room_id
        }
        
        await self.websocket.send(json.dumps(message))
        
    async def draw(self, room_id: str, points: list, color: str = '#000000', width: int = 2):
        """Send drawing data."""
        if not self.websocket:
            await self.connect()
            
        message = {
            'action': 'draw',
            'room_id': room_id,
            'points': points,
            'color': color,
            'width': width
        }
        
        await self.websocket.send(json.dumps(message))
        
    async def clear(self, room_id: str):
        """Clear whiteboard."""
        if not self.websocket:
            await self.connect()
            
        message = {
            'action': 'clear',
            'room_id': room_id
        }
        
        await self.websocket.send(json.dumps(message))
        
    async def receive_updates(self):
        """Receive whiteboard updates."""
        if not self.websocket:
            await self.connect()
            
        async for message in self.websocket:
            yield json.loads(message)
            
    async def close(self):
        """Close connection."""
        if self.websocket:
            await self.websocket.close()


# Test functions
def test_auth():
    """Test authentication service."""
    print("Testing Auth Service...")
    client = AuthClient()
    
    # Register
    result = client.register('testuser', 'password123', 'student')
    print(f"Register: {result}")
    
    # Login
    result = client.login('testuser', 'password123')
    print(f"Login: {result}")


def test_course():
    """Test course service."""
    print("\nTesting Course Service...")
    client = CourseClient()
    
    # Create course
    result = client.create_course(
        'CS101',
        'Introduction to Computer Science',
        'Learn the basics of programming',
        'Prof. Smith'
    )
    print(f"Create Course: {result}")
    
    # List courses
    result = client.list_courses()
    print(f"List Courses: {result}")


async def test_chat():
    """Test chat service."""
    print("\nTesting Chat Service...")
    client = ChatClient()
    
    await client.connect()
    await client.send_message('user1', 'Hello, World!', 'room1')
    print("Message sent to chat service")
    
    await client.close()


async def test_whiteboard():
    """Test whiteboard service."""
    print("\nTesting Whiteboard Service...")
    client = WhiteboardClient()
    
    await client.connect()
    await client.join_room('room1')
    await client.draw('room1', [[0, 0], [10, 10], [20, 20]])
    print("Drawing sent to whiteboard service")
    
    await client.close()


if __name__ == '__main__':
    print("Distributed Learning Hub - Service Test Client\n")
    print("=" * 50)
    
    # Test services
    try:
        test_auth()
    except Exception as e:
        print(f"Auth test error: {e}")
        
    try:
        test_course()
    except Exception as e:
        print(f"Course test error: {e}")
        
    try:
        asyncio.run(test_chat())
    except Exception as e:
        print(f"Chat test error: {e}")
        
    try:
        asyncio.run(test_whiteboard())
    except Exception as e:
        print(f"Whiteboard test error: {e}")
        
    print("\n" + "=" * 50)
    print("Tests completed!")
