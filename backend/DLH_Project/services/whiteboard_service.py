"""
Whiteboard Service
Real-time collaborative whiteboard with distributed state synchronization.
"""

import socket
import threading
import json
import asyncio
import websockets
from typing import Dict, List, Set, Any
from datetime import datetime


class WhiteboardService:
    """
    Distributed whiteboard service for real-time collaboration.
    Supports drawing, shapes, and multi-user synchronization.
    """
    
    def __init__(self, host: str = 'localhost', port: int = 5004):
        self.host = host
        self.port = port
        self.whiteboards = {}  # Whiteboard states by room_id
        self.active_clients: Dict[str, Set[websockets.WebSocketServerProtocol]] = {}
        self.running = False
        
    def create_whiteboard(self, room_id: str) -> Dict[str, Any]:
        """Create a new whiteboard for a room."""
        if room_id not in self.whiteboards:
            self.whiteboards[room_id] = {
                'room_id': room_id,
                'strokes': [],
                'objects': [],
                'created_at': datetime.now().isoformat()
            }
            self.active_clients[room_id] = set()
            
        return {'success': True, 'whiteboard': self.whiteboards[room_id]}
        
    def add_stroke(self, room_id: str, stroke_data: Dict[str, Any]) -> Dict[str, Any]:
        """Add a drawing stroke to the whiteboard."""
        if room_id not in self.whiteboards:
            self.create_whiteboard(room_id)
            
        stroke = {
            'id': f"stroke_{len(self.whiteboards[room_id]['strokes'])}",
            'type': 'stroke',
            'points': stroke_data.get('points', []),
            'color': stroke_data.get('color', '#000000'),
            'width': stroke_data.get('width', 2),
            'user_id': stroke_data.get('user_id', 'anonymous'),
            'timestamp': datetime.now().isoformat()
        }
        
        self.whiteboards[room_id]['strokes'].append(stroke)
        return {'success': True, 'stroke': stroke}
        
    def get_whiteboard_state(self, room_id: str) -> Dict[str, Any]:
        """Get current whiteboard state."""
        if room_id not in self.whiteboards:
            return {'success': False, 'error': 'Whiteboard not found'}
            
        return {'success': True, 'whiteboard': self.whiteboards[room_id]}
        
    def clear_whiteboard(self, room_id: str) -> Dict[str, Any]:
        """Clear all content from whiteboard."""
        if room_id not in self.whiteboards:
            return {'success': False, 'error': 'Whiteboard not found'}
            
        self.whiteboards[room_id]['strokes'] = []
        self.whiteboards[room_id]['objects'] = []
        
        return {'success': True, 'message': 'Whiteboard cleared'}
        
    async def handle_client(self, websocket: websockets.WebSocketServerProtocol, path: str):
        """Handle WebSocket client connections for real-time updates."""
        room_id = None
        
        try:
            async for message in websocket:
                data = json.loads(message)
                action = data.get('action')
                
                if action == 'join':
                    room_id = data.get('room_id')
                    if room_id not in self.active_clients:
                        self.create_whiteboard(room_id)
                    self.active_clients[room_id].add(websocket)
                    
                    # Send current state
                    state = self.get_whiteboard_state(room_id)
                    await websocket.send(json.dumps(state))
                    
                elif action == 'draw' and room_id:
                    stroke = self.add_stroke(room_id, data)
                    await self.broadcast_to_room(room_id, {
                        'action': 'stroke',
                        'data': stroke
                    })
                    
                elif action == 'clear' and room_id:
                    self.clear_whiteboard(room_id)
                    await self.broadcast_to_room(room_id, {
                        'action': 'clear'
                    })
                    
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            if room_id and room_id in self.active_clients:
                self.active_clients[room_id].discard(websocket)
                
    async def broadcast_to_room(self, room_id: str, message: Dict[str, Any]):
        """Broadcast update to all clients in a room."""
        if room_id in self.active_clients and self.active_clients[room_id]:
            message_json = json.dumps(message)
            await asyncio.gather(
                *[client.send(message_json) for client in self.active_clients[room_id]],
                return_exceptions=True
            )
            
    async def start_async(self):
        """Start the WebSocket whiteboard service."""
        async with websockets.serve(self.handle_client, self.host, self.port):
            print(f"Whiteboard Service started on ws://{self.host}:{self.port}")
            await asyncio.Future()  # Run forever
            
    def start(self):
        """Start the whiteboard service."""
        self.running = True
        asyncio.run(self.start_async())


if __name__ == '__main__':
    whiteboard_service = WhiteboardService()
    whiteboard_service.start()
