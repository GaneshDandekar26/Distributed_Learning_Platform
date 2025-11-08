"""
Bully Election Algorithm Implementation
Implements leader election in distributed systems using UDP communication.
"""
import socket
import threading
import time
import logging
import pickle
from typing import Optional, Callable

logger = logging.getLogger(__name__)


class BullyElection:
    """
    Implements the Bully Election Algorithm for leader election.
    
    Algorithm:
    1. If coordinator fails, any process can initiate election
    2. Process sends ELECTION message to all processes with higher IDs
    3. If no response (OK) within timeout, declare itself coordinator
    4. If receives OK, wait for COORDINATOR announcement
    5. Process with highest ID becomes coordinator
    
    Message Types:
    - ELECTION: Initiates election, sent to higher-ranked processes
    - OK: Response to ELECTION, indicates higher process is alive
    - COORDINATOR: Announces new leader to all processes
    """
    
    def __init__(self, server_id: str, port: int = 9100, 
                 on_elected_leader: Optional[Callable] = None):
        """
        Initialize Bully Election.
        
        Args:
            server_id: Server identifier (e.g., 'app1', 'app2', 'app3')
            port: UDP port for election messages (default: 9100)
            on_elected_leader: Callback when this server becomes leader
        """
        self.server_id = server_id
        self.server_rank = int(server_id.replace('app', ''))  # Extract numeric ID
        self.port = port
        self.on_elected_leader = on_elected_leader
        
        # Election state
        self.current_leader = None
        self.election_in_progress = False
        self.election_timeout = 3.0  # seconds
        self.coordinator_timeout = 5.0  # seconds
        
        # All servers in the system
        self.all_servers = ['app1', 'app2', 'app3']
        
        # Thread control
        self.running = False
        self.listener_thread = None
        self.sock = None
        
        # Lock for thread-safe operations
        self.lock = threading.Lock()
        
        # Election history for monitoring
        self.election_history = []
        self.ok_received = threading.Event()
        
        logger.info(f"Bully Election initialized for {server_id} (rank: {self.server_rank})")
    
    def start(self):
        """Start the election listener thread."""
        self.running = True
        self.listener_thread = threading.Thread(
            target=self._listen_election_messages,
            daemon=True
        )
        self.listener_thread.start()
        logger.info(f"{self.server_id} election listener started on port {self.port}")
    
    def stop(self):
        """Stop the election listener."""
        self.running = False
        if self.sock:
            try:
                self.sock.close()
            except:
                pass
        if self.listener_thread:
            self.listener_thread.join(timeout=5)
        logger.info(f"{self.server_id} election listener stopped")
    
    def initiate_election(self):
        """
        Initiate a new election.
        Called when coordinator failure is detected.
        """
        with self.lock:
            if self.election_in_progress:
                logger.info(f"{self.server_id} election already in progress")
                return
            
            self.election_in_progress = True
            self.ok_received.clear()
        
        logger.info(f"{self.server_id} initiating election (rank: {self.server_rank})")
        
        # Record election event
        self._record_election_event('ELECTION_INITIATED', self.server_id)
        
        # Send ELECTION to all higher-ranked processes
        higher_servers = self._get_higher_ranked_servers()
        
        if not higher_servers:
            # No higher-ranked servers, I am the leader
            self._become_coordinator()
            return
        
        # Send election messages
        ok_count = self.send_election(higher_servers)
        
        # Wait for OK responses
        ok_received = self.ok_received.wait(timeout=self.election_timeout)
        
        if not ok_received:
            # No OK received, become coordinator
            logger.info(f"{self.server_id} received no OK responses, becoming coordinator")
            self._become_coordinator()
        else:
            # Received OK, wait for COORDINATOR announcement
            logger.info(f"{self.server_id} received OK, waiting for coordinator announcement")
            # Wait for coordinator announcement (handled in listener)
    
    def send_election(self, target_servers: list) -> int:
        """
        Send ELECTION message to higher-ranked servers.
        
        Args:
            target_servers: List of server IDs to send election message
            
        Returns:
            Number of messages sent successfully
        """
        message = {
            'type': 'ELECTION',
            'sender': self.server_id,
            'rank': self.server_rank,
            'timestamp': time.time()
        }
        
        sent_count = 0
        for target in target_servers:
            try:
                with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
                    sock.settimeout(1.0)
                    data = pickle.dumps(message)
                    sock.sendto(data, (target, self.port))
                    logger.debug(f"ELECTION sent to {target}")
                    sent_count += 1
            except Exception as e:
                logger.warning(f"Failed to send ELECTION to {target}: {e}")
        
        return sent_count
    
    def _send_ok(self, target_server: str):
        """
        Send OK response to ELECTION message.
        
        Args:
            target_server: Server ID to send OK message
        """
        message = {
            'type': 'OK',
            'sender': self.server_id,
            'rank': self.server_rank,
            'timestamp': time.time()
        }
        
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
                sock.settimeout(1.0)
                data = pickle.dumps(message)
                sock.sendto(data, (target_server, self.port))
                logger.debug(f"OK sent to {target_server}")
        except Exception as e:
            logger.warning(f"Failed to send OK to {target_server}: {e}")
    
    def announce_new_coordinator(self):
        """
        Announce this server as the new coordinator.
        Broadcasts COORDINATOR message to all servers.
        """
        message = {
            'type': 'COORDINATOR',
            'coordinator': self.server_id,
            'rank': self.server_rank,
            'timestamp': time.time()
        }
        
        logger.info(f"{self.server_id} announcing as NEW COORDINATOR")
        
        for server in self.all_servers:
            if server != self.server_id:
                try:
                    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
                        sock.settimeout(1.0)
                        data = pickle.dumps(message)
                        sock.sendto(data, (server, self.port))
                        logger.debug(f"COORDINATOR announcement sent to {server}")
                except Exception as e:
                    logger.warning(f"Failed to send COORDINATOR to {server}: {e}")
    
    def receive_election_messages(self):
        """
        Continuously receive and handle election messages.
        This method is called in the listener thread.
        """
        # Implemented in _listen_election_messages
        pass
    
    def _listen_election_messages(self):
        """
        Listen for election messages on UDP socket.
        Handles ELECTION, OK, and COORDINATOR messages.
        """
        try:
            self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self.sock.bind(('0.0.0.0', self.port))
            self.sock.settimeout(1.0)
            
            logger.info(f"{self.server_id} listening for election messages on port {self.port}")
            
            while self.running:
                try:
                    data, addr = self.sock.recvfrom(4096)
                    message = pickle.loads(data)
                    
                    msg_type = message.get('type')
                    sender = message.get('sender')
                    sender_rank = message.get('rank', 0)
                    
                    logger.debug(f"{self.server_id} received {msg_type} from {sender}")
                    
                    if msg_type == 'ELECTION':
                        self._handle_election_message(sender, sender_rank)
                    elif msg_type == 'OK':
                        self._handle_ok_message(sender, sender_rank)
                    elif msg_type == 'COORDINATOR':
                        self._handle_coordinator_message(sender, sender_rank)
                    
                except socket.timeout:
                    continue
                except Exception as e:
                    if self.running:
                        logger.error(f"Error receiving election message: {e}")
        
        except Exception as e:
            logger.error(f"Failed to start election listener: {e}")
    
    def _handle_election_message(self, sender: str, sender_rank: int):
        """
        Handle incoming ELECTION message.
        
        Logic:
        - If my rank is higher, send OK and start my own election
        - If my rank is lower, ignore (sender should become leader)
        """
        if self.server_rank > sender_rank:
            # I have higher rank, send OK and start election
            logger.info(f"{self.server_id} (rank {self.server_rank}) received ELECTION from {sender} (rank {sender_rank}), sending OK")
            self._send_ok(sender)
            
            # Start my own election
            threading.Thread(target=self.initiate_election, daemon=True).start()
        else:
            logger.debug(f"{self.server_id} received ELECTION from higher-ranked {sender}, ignoring")
    
    def _handle_ok_message(self, sender: str, sender_rank: int):
        """
        Handle incoming OK message.
        Indicates a higher-ranked process is alive.
        """
        logger.info(f"{self.server_id} received OK from {sender} (rank {sender_rank})")
        self.ok_received.set()
        
        with self.lock:
            self.election_in_progress = False
    
    def _handle_coordinator_message(self, coordinator: str, coordinator_rank: int):
        """
        Handle incoming COORDINATOR announcement.
        Updates the current leader.
        """
        logger.info(f"{self.server_id} received COORDINATOR announcement: {coordinator} (rank {coordinator_rank})")
        
        with self.lock:
            self.current_leader = coordinator
            self.election_in_progress = False
        
        self._record_election_event('COORDINATOR_ANNOUNCED', coordinator)
    
    def _become_coordinator(self):
        """
        Become the coordinator (leader).
        Announces to all servers and triggers callback.
        """
        with self.lock:
            self.current_leader = self.server_id
            self.election_in_progress = False
        
        logger.info(f"🎖️  {self.server_id} is now the COORDINATOR (LEADER)")
        
        # Announce to all servers
        self.announce_new_coordinator()
        
        # Record event
        self._record_election_event('BECAME_COORDINATOR', self.server_id)
        
        # Trigger callback
        if self.on_elected_leader:
            try:
                self.on_elected_leader()
            except Exception as e:
                logger.error(f"Error in on_elected_leader callback: {e}")
    
    def _get_higher_ranked_servers(self) -> list:
        """Get list of servers with higher rank than this server."""
        return [
            server for server in self.all_servers
            if int(server.replace('app', '')) > self.server_rank
        ]
    
    def _record_election_event(self, event_type: str, server: str):
        """Record election event for monitoring."""
        event = {
            'timestamp': time.time(),
            'event_type': event_type,
            'server': server,
            'current_leader': self.current_leader
        }
        self.election_history.append(event)
        
        # Keep only last 50 events
        if len(self.election_history) > 50:
            self.election_history = self.election_history[-50:]
    
    def get_leader(self) -> Optional[str]:
        """Get current leader."""
        with self.lock:
            return self.current_leader
    
    def is_leader(self) -> bool:
        """Check if this server is the current leader."""
        with self.lock:
            return self.current_leader == self.server_id
    
    def get_election_history(self) -> list:
        """Get election history for monitoring."""
        return self.election_history.copy()
    
    def get_election_status(self) -> dict:
        """
        Get current election status for monitoring.
        
        Returns:
            Dictionary with election state
        """
        with self.lock:
            return {
                'server_id': self.server_id,
                'server_rank': self.server_rank,
                'current_leader': self.current_leader,
                'is_leader': self.current_leader == self.server_id,
                'election_in_progress': self.election_in_progress,
                'election_history': self.get_election_history()
            }
