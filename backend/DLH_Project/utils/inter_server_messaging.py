"""
Inter-Server Messaging with Lamport Clock Synchronization
Handles discussion messages between distributed servers with logical timestamps.
"""
import socket
import threading
import time
import logging
import pickle
import json
import os
from datetime import datetime
from typing import Optional, Callable

logger = logging.getLogger(__name__)


class InterServerMessaging:
    """
    Inter-Server Messaging System with Lamport Clock integration.
    
    Features:
    - Send discussion messages between servers
    - Attach Lamport timestamps to all messages
    - Log all messages for MapReduce analytics
    - Support both TCP and UDP transports
    """
    
    def __init__(self, server_id: str, lamport_clock, port: int = 9200,
                 on_message_received: Optional[Callable] = None):
        """
        Initialize Inter-Server Messaging.
        
        Args:
            server_id: Server identifier (e.g., 'app1')
            lamport_clock: LamportClock instance for timestamp synchronization
            port: Port for receiving messages (default: 9200)
            on_message_received: Callback when message is received
        """
        self.server_id = server_id
        self.clock = lamport_clock
        self.port = port
        self.on_message_received = on_message_received
        
        # Message storage
        self.sent_messages = []
        self.received_messages = []
        self.message_log_file = f"/logs/messages_{server_id}.json"
        
        # Thread control
        self.running = False
        self.listener_thread = None
        self.sock = None
        
        # Lock for thread-safe operations
        self.lock = threading.Lock()
        
        # Create logs directory if it doesn't exist
        os.makedirs('/logs', exist_ok=True)
        
        logger.info(f"Inter-Server Messaging initialized for {server_id}")
    
    def start(self):
        """Start the message listener thread."""
        self.running = True
        self.listener_thread = threading.Thread(
            target=self._listen_messages,
            daemon=True
        )
        self.listener_thread.start()
        logger.info(f"{self.server_id} message listener started on port {self.port}")
    
    def stop(self):
        """Stop the message listener."""
        self.running = False
        if self.sock:
            try:
                self.sock.close()
            except:
                pass
        if self.listener_thread:
            self.listener_thread.join(timeout=5)
        logger.info(f"{self.server_id} message listener stopped")
    
    def send_discussion_message(self, msg: str, target_server: str, 
                               message_type: str = 'discussion') -> bool:
        """
        Send a discussion message to target server with Lamport timestamp.
        
        Args:
            msg: Message content
            target_server: Target server ID (e.g., 'app2')
            message_type: Type of message (e.g., 'discussion', 'sync', 'data')
            
        Returns:
            True if message sent successfully, False otherwise
        """
        # Increment Lamport clock for sending event
        timestamp = self.clock.increment_local()
        
        message_data = {
            'type': 'inter_server_message',
            'message_type': message_type,
            'sender': self.server_id,
            'content': msg,
            'lamport_time': timestamp,
            'timestamp': time.time(),
            'datetime': datetime.now().isoformat()
        }
        
        logger.info(f"{self.server_id} sending message to {target_server} "
                   f"(Lamport: {timestamp}): {msg[:50]}...")
        
        try:
            # Send via TCP for reliability
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
                sock.settimeout(3.0)
                sock.connect((target_server, self.port))
                data = pickle.dumps(message_data)
                sock.sendall(data)
                
                # Wait for acknowledgment
                ack_data = sock.recv(1024)
                ack = pickle.loads(ack_data)
                
                if ack.get('status') == 'received':
                    logger.info(f"Message acknowledged by {target_server}")
                    
                    # Store sent message
                    with self.lock:
                        self.sent_messages.append(message_data)
                    
                    # Log to file
                    self._log_message_to_file(message_data, 'sent')
                    
                    return True
                    
        except Exception as e:
            logger.error(f"Failed to send message to {target_server}: {e}")
            return False
        
        return False
    
    def broadcast_message(self, msg: str, message_type: str = 'broadcast') -> dict:
        """
        Broadcast a message to all other servers.
        
        Args:
            msg: Message content
            message_type: Type of message
            
        Returns:
            Dictionary with success status for each server
        """
        all_servers = ['app1', 'app2', 'app3']
        results = {}
        
        for server in all_servers:
            if server != self.server_id:
                success = self.send_discussion_message(msg, server, message_type)
                results[server] = 'success' if success else 'failed'
        
        return results
    
    def _listen_messages(self):
        """
        Listen for incoming messages on TCP socket.
        Handles message reception and Lamport clock synchronization.
        """
        try:
            self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self.sock.bind(('0.0.0.0', self.port))
            self.sock.listen(10)
            self.sock.settimeout(1.0)
            
            logger.info(f"{self.server_id} listening for messages on port {self.port}")
            
            while self.running:
                try:
                    client_sock, addr = self.sock.accept()
                    # Handle in separate thread
                    threading.Thread(
                        target=self._handle_message_connection,
                        args=(client_sock, addr),
                        daemon=True
                    ).start()
                    
                except socket.timeout:
                    continue
                except Exception as e:
                    if self.running:
                        logger.error(f"Error accepting message connection: {e}")
        
        except Exception as e:
            logger.error(f"Failed to start message listener: {e}")
    
    def _handle_message_connection(self, client_sock: socket.socket, addr: tuple):
        """
        Handle incoming message connection.
        
        Args:
            client_sock: Client socket
            addr: Client address
        """
        try:
            # Receive message data
            data = b''
            while True:
                chunk = client_sock.recv(4096)
                if not chunk:
                    break
                data += chunk
                if len(chunk) < 4096:
                    break
            
            if not data:
                return
            
            # Parse message
            message_data = pickle.loads(data)
            
            # Update Lamport clock on receive
            external_timestamp = message_data.get('lamport_time', 0)
            updated_time = self.clock.update_on_receive(external_timestamp)
            
            sender = message_data.get('sender')
            content = message_data.get('content')
            
            logger.info(f"{self.server_id} received message from {sender} "
                       f"(Lamport: {external_timestamp} → {updated_time}): {content[:50]}...")
            
            # Store received message
            with self.lock:
                self.received_messages.append(message_data)
            
            # Log to file
            self._log_message_to_file(message_data, 'received')
            
            # Send acknowledgment
            ack = {
                'status': 'received',
                'lamport_time': updated_time,
                'receiver': self.server_id
            }
            ack_data = pickle.dumps(ack)
            client_sock.sendall(ack_data)
            
            # Trigger callback
            if self.on_message_received:
                try:
                    self.on_message_received(message_data)
                except Exception as e:
                    logger.error(f"Error in on_message_received callback: {e}")
        
        except Exception as e:
            logger.error(f"Error handling message connection: {e}")
        finally:
            try:
                client_sock.close()
            except:
                pass
    
    def _log_message_to_file(self, message_data: dict, direction: str):
        """
        Log message to JSON file for MapReduce analytics.
        
        Args:
            message_data: Message data dictionary
            direction: 'sent' or 'received'
        """
        try:
            log_entry = {
                'direction': direction,
                'timestamp': time.time(),
                'datetime': datetime.now().isoformat(),
                **message_data
            }
            
            # Append to log file
            with open(self.message_log_file, 'a') as f:
                f.write(json.dumps(log_entry) + '\n')
        
        except Exception as e:
            logger.error(f"Failed to log message to file: {e}")
    
    def get_sent_messages(self, limit: int = 50) -> list:
        """Get recent sent messages."""
        with self.lock:
            return self.sent_messages[-limit:] if self.sent_messages else []
    
    def get_received_messages(self, limit: int = 50) -> list:
        """Get recent received messages."""
        with self.lock:
            return self.received_messages[-limit:] if self.received_messages else []
    
    def get_all_messages(self, limit: int = 100) -> list:
        """
        Get all messages (sent and received) sorted by Lamport timestamp.
        
        Args:
            limit: Maximum number of messages to return
            
        Returns:
            List of messages sorted by Lamport timestamp
        """
        with self.lock:
            all_msgs = []
            
            for msg in self.sent_messages:
                all_msgs.append({**msg, 'direction': 'sent'})
            
            for msg in self.received_messages:
                all_msgs.append({**msg, 'direction': 'received'})
            
            # Sort by Lamport timestamp
            all_msgs.sort(key=lambda x: x.get('lamport_time', 0))
            
            return all_msgs[-limit:] if all_msgs else []
    
    def get_message_stats(self) -> dict:
        """
        Get message statistics for monitoring.
        
        Returns:
            Dictionary with message stats
        """
        with self.lock:
            return {
                'server_id': self.server_id,
                'total_sent': len(self.sent_messages),
                'total_received': len(self.received_messages),
                'total_messages': len(self.sent_messages) + len(self.received_messages),
                'log_file': self.message_log_file
            }
    
    def send_consistency_message(self, target_server: str, message: dict, timeout: float = 2.0) -> dict:
        """
        Send a consistency protocol message (for 2PC) and wait for response.
        
        Args:
            target_server: Target server ID
            message: Consistency message (PREPARE, COMMIT, ABORT)
            timeout: Timeout for response
            
        Returns:
            Response dictionary from target server
        """
        import requests
        
        # Map server IDs to ports
        port_map = {
            'app1': 8001,
            'app2': 8002,
            'app3': 8003
        }
        
        target_port = port_map.get(target_server)
        if not target_port:
            logger.error(f"Unknown target server: {target_server}")
            return {'error': 'Unknown server'}
        
        phase = message.get('phase')
        
        try:
            if phase == 'PREPARE':
                url = f"http://{target_server}:{target_port}/consistency/prepare"
            elif phase == 'COMMIT':
                url = f"http://{target_server}:{target_port}/consistency/commit"
            elif phase == 'ABORT':
                url = f"http://{target_server}:{target_port}/consistency/abort"
            else:
                return {'error': 'Unknown phase'}
            
            response = requests.post(url, json=message, timeout=timeout)
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Consistency message failed: {response.status_code}")
                return {'error': f'HTTP {response.status_code}'}
                
        except requests.exceptions.Timeout:
            logger.error(f"Timeout sending consistency message to {target_server}")
            return {'error': 'timeout'}
        except Exception as e:
            logger.error(f"Error sending consistency message to {target_server}: {e}")
            return {'error': str(e)}
    
    def clear_messages(self):
        """Clear message history (for testing)."""
        with self.lock:
            self.sent_messages = []
            self.received_messages = []
        logger.info(f"{self.server_id} message history cleared")

