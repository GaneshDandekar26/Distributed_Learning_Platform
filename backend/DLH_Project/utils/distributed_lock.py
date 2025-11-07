"""
Distributed Lock Manager
Implements distributed mutual exclusion using Ricart-Agrawala algorithm.
"""

import socket
import threading
import time
from typing import Dict, Set, Tuple
from enum import Enum


class LockState(Enum):
    """States for distributed lock."""
    RELEASED = 1
    WANTED = 2
    HELD = 3


class DistributedLock:
    """
    Distributed mutual exclusion lock using message passing.
    Based on Ricart-Agrawala algorithm.
    """
    
    def __init__(self, node_id: str, nodes: Dict[str, Tuple[str, int]]):
        self.node_id = node_id
        self.nodes = nodes  # {node_id: (host, port)}
        self.state = LockState.RELEASED
        self.timestamp = 0
        self.request_timestamp = 0
        self.replies_received: Set[str] = set()
        self.deferred_replies: Set[str] = set()
        self.lock = threading.Lock()
        self.condition = threading.Condition(self.lock)
        
    def acquire(self):
        """Acquire the distributed lock."""
        with self.lock:
            self.state = LockState.WANTED
            self.timestamp += 1
            self.request_timestamp = self.timestamp
            self.replies_received.clear()
            
        # Send request to all other nodes
        self._send_request_to_all()
        
        # Wait for replies from all nodes
        with self.condition:
            while len(self.replies_received) < len(self.nodes) - 1:
                self.condition.wait(timeout=1.0)
                
        with self.lock:
            self.state = LockState.HELD
            
    def release(self):
        """Release the distributed lock."""
        with self.lock:
            self.state = LockState.RELEASED
            
            # Send deferred replies
            for node_id in self.deferred_replies:
                self._send_reply(node_id)
            self.deferred_replies.clear()
            
    def handle_request(self, from_node: str, timestamp: int) -> bool:
        """
        Handle lock request from another node.
        Returns True if reply should be sent immediately.
        """
        with self.lock:
            if self.state == LockState.HELD:
                # Defer reply
                self.deferred_replies.add(from_node)
                return False
            elif self.state == LockState.WANTED:
                # Compare timestamps
                if (timestamp < self.request_timestamp or 
                    (timestamp == self.request_timestamp and from_node < self.node_id)):
                    # Other request has priority
                    return True
                else:
                    # Our request has priority, defer
                    self.deferred_replies.add(from_node)
                    return False
            else:
                # We're not interested, reply immediately
                return True
                
    def handle_reply(self, from_node: str):
        """Handle reply from another node."""
        with self.condition:
            self.replies_received.add(from_node)
            self.condition.notify()
            
    def _send_request_to_all(self):
        """Send lock request to all nodes."""
        for node_id, (host, port) in self.nodes.items():
            if node_id != self.node_id:
                self._send_message(host, port, {
                    'type': 'REQUEST',
                    'from': self.node_id,
                    'timestamp': self.request_timestamp
                })
                
    def _send_reply(self, node_id: str):
        """Send reply to a specific node."""
        if node_id in self.nodes:
            host, port = self.nodes[node_id]
            self._send_message(host, port, {
                'type': 'REPLY',
                'from': self.node_id
            })
            
    def _send_message(self, host: str, port: int, message: Dict):
        """Send message to a node."""
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.connect((host, port))
            import json
            sock.send(json.dumps(message).encode())
            sock.close()
        except Exception as e:
            print(f"Error sending message to {host}:{port} - {e}")


class LockManager:
    """
    Manager for distributed locks across multiple resources.
    """
    
    def __init__(self, node_id: str, nodes: Dict[str, Tuple[str, int]]):
        self.node_id = node_id
        self.nodes = nodes
        self.locks: Dict[str, DistributedLock] = {}
        
    def get_lock(self, resource_id: str) -> DistributedLock:
        """Get or create a lock for a resource."""
        if resource_id not in self.locks:
            self.locks[resource_id] = DistributedLock(self.node_id, self.nodes)
        return self.locks[resource_id]
        
    def acquire(self, resource_id: str):
        """Acquire lock for a resource."""
        lock = self.get_lock(resource_id)
        lock.acquire()
        
    def release(self, resource_id: str):
        """Release lock for a resource."""
        if resource_id in self.locks:
            self.locks[resource_id].release()
