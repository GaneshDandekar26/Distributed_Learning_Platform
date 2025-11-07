"""
Fault Tolerance Protocol using Heartbeat mechanism.
Implements primary-backup replication with automatic failover.
"""
import time
import threading
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class HeartbeatProtocol:
    """
    Implements a heartbeat-based fault tolerance protocol.
    
    Architecture:
    - One PRIMARY server sends heartbeats to BACKUP servers
    - BACKUP servers listen for heartbeats
    - If 3 consecutive heartbeats are missed, backup promotes to PRIMARY
    - Heartbeats sent every 2 seconds
    """
    
    def __init__(self, server_id, role='BACKUP', primary_host=None, port=9002):
        """
        Initialize the heartbeat protocol.
        
        Args:
            server_id (str): Unique identifier for this server (e.g., 'app1')
            role (str): 'PRIMARY' or 'BACKUP'
            primary_host (str): Hostname of the primary server (for backups)
            port (int): Port for heartbeat communication (default: 9002)
        """
        self.server_id = server_id
        self.role = role
        self.primary_host = primary_host
        self.port = port
        
        # Heartbeat tracking
        self.last_heartbeat = None
        self.missed_heartbeats = 0
        self.max_missed_heartbeats = 3
        self.heartbeat_interval = 2.0  # seconds
        
        # Thread control
        self.running = False
        self.sender_thread = None
        self.listener_thread = None
        
        # Callbacks
        self.on_promote_to_primary = None
        self.on_primary_detected = None
        
        # Lock for thread-safe operations
        self.lock = threading.Lock()
        
        logger.info(f"Heartbeat protocol initialized for {server_id} as {role}")
    
    def start(self):
        """Start the heartbeat protocol based on role."""
        self.running = True
        
        if self.role == 'PRIMARY':
            self.start_sender()
        else:
            self.start_listener()
    
    def stop(self):
        """Stop the heartbeat protocol."""
        self.running = False
        if self.sender_thread:
            self.sender_thread.join(timeout=5)
        if self.listener_thread:
            self.listener_thread.join(timeout=5)
        logger.info(f"Heartbeat protocol stopped for {self.server_id}")
    
    def start_sender(self):
        """
        Start sending heartbeats to backup servers.
        Only called by PRIMARY server.
        """
        if self.role != 'PRIMARY':
            logger.warning(f"{self.server_id} is not PRIMARY, cannot start sender")
            return
        
        self.sender_thread = threading.Thread(target=self._send_heartbeats, daemon=True)
        self.sender_thread.start()
        logger.info(f"{self.server_id} (PRIMARY) started sending heartbeats")
    
    def start_listener(self):
        """
        Start listening for heartbeats from primary.
        Only called by BACKUP servers.
        """
        if self.role != 'BACKUP':
            logger.warning(f"{self.server_id} is not BACKUP, cannot start listener")
            return
        
        self.listener_thread = threading.Thread(target=self._listen_heartbeats, daemon=True)
        self.listener_thread.start()
        logger.info(f"{self.server_id} (BACKUP) started listening for heartbeats from {self.primary_host}")
    
    def _send_heartbeats(self):
        """
        Send heartbeat messages to all backup servers every 2 seconds.
        Runs in a separate thread.
        """
        import socket
        
        # Get list of backup servers (all servers except this one)
        backup_servers = []
        for i in range(1, 4):  # app1, app2, app3
            server = f'app{i}'
            if server != self.server_id:
                backup_servers.append(server)
        
        while self.running:
            try:
                heartbeat_data = {
                    'type': 'heartbeat',
                    'primary_id': self.server_id,
                    'timestamp': time.time(),
                    'role': self.role
                }
                
                # Send to each backup server
                for backup in backup_servers:
                    try:
                        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
                            sock.settimeout(1.0)
                            import pickle
                            message = pickle.dumps(heartbeat_data)
                            sock.sendto(message, (backup, self.port))
                            logger.debug(f"Heartbeat sent to {backup}")
                    except Exception as e:
                        logger.warning(f"Failed to send heartbeat to {backup}: {e}")
                
                time.sleep(self.heartbeat_interval)
                
            except Exception as e:
                logger.error(f"Error in heartbeat sender: {e}")
                time.sleep(self.heartbeat_interval)
    
    def _listen_heartbeats(self):
        """
        Listen for heartbeat messages from primary server.
        Runs in a separate thread.
        Promotes to PRIMARY if 3 heartbeats are missed.
        """
        import socket
        import pickle
        
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.bind(('0.0.0.0', self.port))
            sock.settimeout(self.heartbeat_interval + 1.0)  # Slightly longer than interval
            
            logger.info(f"Listening for heartbeats on port {self.port}")
            
            while self.running:
                try:
                    data, addr = sock.recvfrom(4096)
                    heartbeat_data = pickle.loads(data)
                    
                    if heartbeat_data.get('type') == 'heartbeat':
                        with self.lock:
                            self.last_heartbeat = time.time()
                            self.missed_heartbeats = 0
                            
                        logger.debug(f"Heartbeat received from {heartbeat_data.get('primary_id')}")
                        
                        # Callback for heartbeat received
                        if self.on_primary_detected:
                            self.on_primary_detected(heartbeat_data.get('primary_id'))
                
                except socket.timeout:
                    # Heartbeat not received in time
                    with self.lock:
                        self.missed_heartbeats += 1
                        logger.warning(f"Missed heartbeat #{self.missed_heartbeats}")
                        
                        # Promote to primary if too many heartbeats missed
                        if self.missed_heartbeats >= self.max_missed_heartbeats:
                            self._promote_to_primary()
                
                except Exception as e:
                    logger.error(f"Error receiving heartbeat: {e}")
            
        except Exception as e:
            logger.error(f"Error in heartbeat listener: {e}")
        finally:
            if 'sock' in locals():
                sock.close()
    
    def _promote_to_primary(self):
        """
        Promote this backup server to PRIMARY.
        Called when primary is detected as failed.
        """
        if self.role == 'PRIMARY':
            return  # Already primary
        
        logger.warning(f"PRIMARY FAILURE DETECTED! Promoting {self.server_id} to PRIMARY")
        
        old_role = self.role
        self.role = 'PRIMARY'
        self.missed_heartbeats = 0
        
        # Stop listening and start sending heartbeats
        if old_role == 'BACKUP':
            # Start sending heartbeats to other backups
            self.start_sender()
        
        # Callback for promotion
        if self.on_promote_to_primary:
            self.on_promote_to_primary(self.server_id)
        
        logger.info(f"{self.server_id} is now PRIMARY")
    
    def get_status(self):
        """
        Get the current status of the heartbeat protocol.
        
        Returns:
            dict: Status information
        """
        with self.lock:
            return {
                'server_id': self.server_id,
                'role': self.role,
                'last_heartbeat': self.last_heartbeat,
                'missed_heartbeats': self.missed_heartbeats,
                'running': self.running,
                'primary_host': self.primary_host if self.role == 'BACKUP' else None
            }
    
    def is_primary(self):
        """Check if this server is currently primary."""
        return self.role == 'PRIMARY'
    
    def set_primary(self, is_primary):
        """
        Manually set the role of this server.
        
        Args:
            is_primary (bool): True to set as PRIMARY, False for BACKUP
        """
        new_role = 'PRIMARY' if is_primary else 'BACKUP'
        if new_role != self.role:
            old_role = self.role
            self.role = new_role
            logger.info(f"{self.server_id} role changed from {old_role} to {new_role}")
            
            # Restart the appropriate thread
            if self.running:
                self.stop()
                self.start()
