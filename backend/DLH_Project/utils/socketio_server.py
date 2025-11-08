"""
Socket.IO Server for Real-Time Communication
Handles chat and whiteboard events with Lamport clock integration
"""
import socketio
import logging
from typing import Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class SocketIOServer:
    """
    Socket.IO server managing real-time chat and whiteboard communication.
    Integrates with Lamport clock for event ordering.
    """
    
    def __init__(self, app, lamport_clock, server_id: str):
        """
        Initialize Socket.IO server.
        
        Args:
            app: Flask application instance
            lamport_clock: LamportClock instance for timestamp generation
            server_id: Server identifier (e.g., 'app1')
        """
        self.server_id = server_id
        self.lamport_clock = lamport_clock
        
        # Create Socket.IO server with CORS support
        self.sio = socketio.Server(
            cors_allowed_origins='*',
            async_mode='threading',
            logger=True,
            engineio_logger=False
        )
        
        # Wrap Flask app with Socket.IO
        self.app = socketio.WSGIApp(self.sio, app)
        
        # Store active sessions
        self.chat_sessions: Dict[str, Dict[str, Any]] = {}
        self.whiteboard_sessions: Dict[str, Dict[str, Any]] = {}
        
        # Register event handlers
        self._register_chat_events()
        self._register_whiteboard_events()
        
        logger.info(f"Socket.IO server initialized for {server_id}")
    
    def _register_chat_events(self):
        """Register chat namespace event handlers"""
        
        @self.sio.on('connect', namespace='/chat')
        def chat_connect(sid, environ):
            """Handle chat client connection"""
            logger.info(f"Chat client connected: {sid}")
            self.chat_sessions[sid] = {
                'connected_at': datetime.now().isoformat(),
                'server': self.server_id
            }
            self.sio.emit('connected', {
                'server_id': self.server_id,
                'sid': sid,
                'timestamp': datetime.now().isoformat()
            }, room=sid, namespace='/chat')
        
        @self.sio.on('disconnect', namespace='/chat')
        def chat_disconnect(sid):
            """Handle chat client disconnection"""
            logger.info(f"Chat client disconnected: {sid}")
            if sid in self.chat_sessions:
                del self.chat_sessions[sid]
        
        @self.sio.on('join_room', namespace='/chat')
        def join_chat_room(sid, data):
            """Handle client joining a chat room"""
            room = data.get('room')
            username = data.get('username', 'Anonymous')
            
            if room:
                self.sio.enter_room(sid, room, namespace='/chat')
                self.chat_sessions[sid]['room'] = room
                self.chat_sessions[sid]['username'] = username
                
                # Increment Lamport clock
                lamport_time = self.lamport_clock.increment_local()
                
                # Notify room
                self.sio.emit('user_joined', {
                    'username': username,
                    'room': room,
                    'lamport_time': lamport_time,
                    'timestamp': datetime.now().isoformat(),
                    'server_id': self.server_id
                }, room=room, namespace='/chat', skip_sid=sid)
                
                logger.info(f"User {username} joined room {room} (sid: {sid})")
        
        @self.sio.on('leave_room', namespace='/chat')
        def leave_chat_room(sid, data):
            """Handle client leaving a chat room"""
            room = data.get('room')
            username = self.chat_sessions.get(sid, {}).get('username', 'Anonymous')
            
            if room:
                self.sio.leave_room(sid, room, namespace='/chat')
                
                # Increment Lamport clock
                lamport_time = self.lamport_clock.increment_local()
                
                # Notify room
                self.sio.emit('user_left', {
                    'username': username,
                    'room': room,
                    'lamport_time': lamport_time,
                    'timestamp': datetime.now().isoformat(),
                    'server_id': self.server_id
                }, room=room, namespace='/chat')
                
                logger.info(f"User {username} left room {room}")
        
        @self.sio.on('chat_message', namespace='/chat')
        def handle_chat_message(sid, data):
            """
            Handle incoming chat message with Lamport clock integration.
            
            Event data:
                - room: Chat room ID
                - message: Message content
                - username: Sender username
            """
            room = data.get('room')
            message = data.get('message')
            username = data.get('username', 'Anonymous')
            
            if not room or not message:
                return
            
            # Increment Lamport clock for this event
            lamport_time = self.lamport_clock.increment_local()
            
            # Create message event
            message_event = {
                'id': f"{self.server_id}_{lamport_time}_{sid[:8]}",
                'room': room,
                'username': username,
                'message': message,
                'lamport_time': lamport_time,
                'timestamp': datetime.now().isoformat(),
                'server_id': self.server_id
            }
            
            # Broadcast to all clients in the room
            self.sio.emit('chat_message', message_event, room=room, namespace='/chat')
            
            logger.info(f"Chat message in {room} from {username} [Lamport: {lamport_time}]")
        
        @self.sio.on('typing', namespace='/chat')
        def handle_typing(sid, data):
            """Handle typing indicator"""
            room = data.get('room')
            username = data.get('username', 'Anonymous')
            is_typing = data.get('is_typing', False)
            
            if room:
                self.sio.emit('typing', {
                    'username': username,
                    'is_typing': is_typing
                }, room=room, namespace='/chat', skip_sid=sid)
    
    def _register_whiteboard_events(self):
        """Register whiteboard namespace event handlers"""
        
        @self.sio.on('connect', namespace='/whiteboard')
        def whiteboard_connect(sid, environ):
            """Handle whiteboard client connection"""
            logger.info(f"Whiteboard client connected: {sid}")
            self.whiteboard_sessions[sid] = {
                'connected_at': datetime.now().isoformat(),
                'server': self.server_id
            }
            self.sio.emit('connected', {
                'server_id': self.server_id,
                'sid': sid,
                'timestamp': datetime.now().isoformat()
            }, room=sid, namespace='/whiteboard')
        
        @self.sio.on('disconnect', namespace='/whiteboard')
        def whiteboard_disconnect(sid):
            """Handle whiteboard client disconnection"""
            logger.info(f"Whiteboard client disconnected: {sid}")
            if sid in self.whiteboard_sessions:
                del self.whiteboard_sessions[sid]
        
        @self.sio.on('join_whiteboard', namespace='/whiteboard')
        def join_whiteboard_room(sid, data):
            """Handle client joining a whiteboard session"""
            room = data.get('room')
            username = data.get('username', 'Anonymous')
            
            if room:
                self.sio.enter_room(sid, room, namespace='/whiteboard')
                self.whiteboard_sessions[sid]['room'] = room
                self.whiteboard_sessions[sid]['username'] = username
                
                # Increment Lamport clock
                lamport_time = self.lamport_clock.increment_local()
                
                # Notify room
                self.sio.emit('user_joined', {
                    'username': username,
                    'room': room,
                    'lamport_time': lamport_time,
                    'timestamp': datetime.now().isoformat(),
                    'server_id': self.server_id
                }, room=room, namespace='/whiteboard', skip_sid=sid)
                
                logger.info(f"User {username} joined whiteboard {room} (sid: {sid})")
        
        @self.sio.on('leave_whiteboard', namespace='/whiteboard')
        def leave_whiteboard_room(sid, data):
            """Handle client leaving a whiteboard session"""
            room = data.get('room')
            username = self.whiteboard_sessions.get(sid, {}).get('username', 'Anonymous')
            
            if room:
                self.sio.leave_room(sid, room, namespace='/whiteboard')
                
                # Increment Lamport clock
                lamport_time = self.lamport_clock.increment_local()
                
                # Notify room
                self.sio.emit('user_left', {
                    'username': username,
                    'room': room,
                    'lamport_time': lamport_time,
                    'timestamp': datetime.now().isoformat(),
                    'server_id': self.server_id
                }, room=room, namespace='/whiteboard')
                
                logger.info(f"User {username} left whiteboard {room}")
        
        @self.sio.on('draw_event', namespace='/whiteboard')
        def handle_draw_event(sid, data):
            """
            Handle whiteboard drawing event with Lamport clock integration.
            
            Event data:
                - room: Whiteboard session ID
                - type: Draw action type (draw, erase, clear)
                - points: Drawing points/path
                - color: Drawing color
                - width: Line width
                - username: Drawer username
            """
            room = data.get('room')
            if not room:
                return
            
            # Increment Lamport clock for this event
            lamport_time = self.lamport_clock.increment_local()
            
            # Create draw event with timestamp for ordering
            draw_event = {
                'id': f"{self.server_id}_{lamport_time}_{sid[:8]}",
                'room': room,
                'type': data.get('type', 'draw'),
                'points': data.get('points', []),
                'color': data.get('color', '#000000'),
                'width': data.get('width', 2),
                'username': data.get('username', 'Anonymous'),
                'lamport_time': lamport_time,
                'timestamp': datetime.now().isoformat(),
                'server_id': self.server_id
            }
            
            # Broadcast to all clients in the room (including sender for confirmation)
            self.sio.emit('draw_event', draw_event, room=room, namespace='/whiteboard')
            
            logger.info(f"Draw event in {room} [Type: {draw_event['type']}, Lamport: {lamport_time}]")
        
        @self.sio.on('request_state', namespace='/whiteboard')
        def handle_state_request(sid, data):
            """Handle request for current whiteboard state"""
            room = data.get('room')
            if room:
                # This would be handled by the leader server to send current state
                logger.info(f"State request for whiteboard {room} from {sid}")
                # In a full implementation, the leader would send the current drawing state
    
    def get_stats(self) -> Dict[str, Any]:
        """Get Socket.IO server statistics"""
        return {
            'server_id': self.server_id,
            'chat_sessions': len(self.chat_sessions),
            'whiteboard_sessions': len(self.whiteboard_sessions),
            'total_sessions': len(self.chat_sessions) + len(self.whiteboard_sessions)
        }
