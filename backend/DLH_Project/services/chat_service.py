"""
Chat Service
Real-time chat with Lamport timestamps for distributed message ordering.
"""

import socket
import threading
import json
import asyncio
import websockets
from typing import Dict, List, Set, Any
from datetime import datetime


class LamportClock:
    """
    Implementation of Lamport logical clock for distributed ordering.
    """
    
    def __init__(self):
        self.time = 0
        self.lock = threading.Lock()
        
    def increment(self):
        """Increment local clock."""
        with self.lock:
            self.time += 1
            return self.time
            
    def update(self, received_time: int):
        """Update clock based on received timestamp."""
        with self.lock:
            self.time = max(self.time, received_time) + 1
            return self.time
            
    def get_time(self) -> int:
        """Get current clock value."""
        with self.lock:
            return self.time


class ChatService:
    """
    Distributed chat service with Lamport timestamps.
    Supports real-time messaging with causal ordering.
    """
    
    def __init__(self, host: str = 'localhost', port: int = 5003):
        self.host = host
        self.port = port
        self.clock = LamportClock()
        self.messages = []  # Message history
        self.active_clients: Set[websockets.WebSocketServerProtocol] = set()
        self.running = False
        
    def create_message(self, user_id: str, content: str, room_id: str) -> Dict[str, Any]:
        """Create a new message with Lamport timestamp."""
        timestamp = self.clock.increment()
        
        message = {
            'id': f"{user_id}_{timestamp}",
            'user_id': user_id,
            'content': content,
            'room_id': room_id,
            'lamport_time': timestamp,
            'wall_time': datetime.now().isoformat()
        }
        
        self.messages.append(message)
        return message
        
    def get_messages(self, room_id: str, limit: int = 100) -> List[Dict[str, Any]]:
        """Get messages for a specific room, ordered by Lamport time."""
        room_messages = [
            msg for msg in self.messages 
            if msg['room_id'] == room_id
        ]
        
        # Sort by Lamport timestamp
        room_messages.sort(key=lambda x: x['lamport_time'])
        
        return room_messages[-limit:]
        
    async def handle_client(self, websocket: websockets.WebSocketServerProtocol, path: str):
        """Handle WebSocket client connections."""
        self.active_clients.add(websocket)
        
        try:
            async for message in websocket:
                data = json.loads(message)
                
                # Update Lamport clock
                if 'lamport_time' in data:
                    self.clock.update(data['lamport_time'])
                
                # Create message
                msg = self.create_message(
                    data['user_id'],
                    data['content'],
                    data['room_id']
                )
                
                # Broadcast to all clients
                await self.broadcast_message(msg)
                
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            self.active_clients.remove(websocket)
            
    async def broadcast_message(self, message: Dict[str, Any]):
        """Broadcast message to all connected clients."""
        if self.active_clients:
            message_json = json.dumps(message)
            await asyncio.gather(
                *[client.send(message_json) for client in self.active_clients],
                return_exceptions=True
            )
            
    async def start_async(self):
        """Start the WebSocket chat service."""
        async with websockets.serve(self.handle_client, self.host, self.port):
            print(f"Chat Service started on ws://{self.host}:{self.port}")
            await asyncio.Future()  # Run forever
            
    def start(self):
        """Start the chat service."""
        self.running = True
        asyncio.run(self.start_async())


if __name__ == '__main__':
    chat_service = ChatService()
    chat_service.start()
