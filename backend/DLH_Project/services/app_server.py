"""
Application Server
Main backend server handling courses, users, and data with MongoDB.
Integrates RMI, Lamport Clock, Fault Tolerance, Bully Election, and Inter-Server Messaging.
Enhanced with TCP socket server for handling direct connections.
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
from pymongo import MongoClient
from bson import ObjectId
import os
import logging
from datetime import datetime
import hashlib
import sys
import socket
import threading
import json
import select
import xmlrpc.client
import time

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.lamport_clock import LamportClock
from utils.custom_rmi import RMIDispatcher, CourseService
from utils.ft_protocol import HeartbeatProtocol
from utils.bully_election import BullyElection
from utils.inter_server_messaging import InterServerMessaging
from utils.strong_consistency import StrongConsistencyManager

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# MongoDB connection
MONGO_URI = os.getenv('MONGO_URI', 'mongodb+srv://ganeshdandekar23_db_user:Uh4TirdCgXsqwPmL@dlh.nmdrhnl.mongodb.net/?appName=DLH')
SERVER_ID = os.getenv('SERVER_ID', 'app1')
PORT = int(os.getenv('PORT', '8001'))
TCP_PORT = PORT  # Use same port for both HTTP and TCP

# Initialize Distributed Computing components
lamport_clock = LamportClock()
heartbeat_protocol = None
rmi_dispatcher = None
bully_election = None
messaging_system = None
consistency_manager = None

# Connection tracking
active_connections = 0
connection_lock = threading.Lock()


class ApplicationServer:
    """
    Enhanced Application Server with distributed computing features.
    Integrates: TCP sockets, Lamport Clock, RMI, Fault Tolerance, Bully Election, and Inter-Server Messaging.
    """
    
    def __init__(self, server_id: str, port: int, lamport_clock: LamportClock, 
                 heartbeat_protocol: HeartbeatProtocol = None,
                 bully_election: BullyElection = None,
                 messaging_system: InterServerMessaging = None):
        """
        Initialize Application Server with all distributed computing components.
        
        Args:
            server_id: Unique server identifier
            port: Port number to bind to
            lamport_clock: LamportClock instance for logical time
            heartbeat_protocol: HeartbeatProtocol instance for fault tolerance
            bully_election: BullyElection instance for leader election
            messaging_system: InterServerMessaging instance for communication
        """
        self.server_id = server_id
        self.port = port
        self.clock = lamport_clock
        self.heartbeat = heartbeat_protocol
        self.election = bully_election
        self.messaging = messaging_system
        
        # FT Role (managed by HeartbeatProtocol and Bully Election)
        self.role = "BACKUP"  # Default to BACKUP, updated by election
        
        # Server state
        self.running = False
        self.tcp_socket = None
        self.active_connections_count = 0
        self.total_requests_handled = 0
        self.lock = threading.Lock()
        
        # XML-RPC client for monitoring
        self.monitoring_client = None
        self.monitoring_thread = None
        
        logger.info(f"ApplicationServer {server_id} initialized with all DC components")
    
    def start_monitoring_reports(self):
        """Start background thread to report metrics to monitoring service via XML-RPC."""
        self.monitoring_thread = threading.Thread(target=self._report_metrics_loop, daemon=True)
        self.monitoring_thread.start()
        logger.info(f"{self.server_id} started monitoring reports thread")
    
    def _report_metrics_loop(self):
        """Report metrics to monitoring service every 5 seconds."""
        # Initialize XML-RPC client
        try:
            self.monitoring_client = xmlrpc.client.ServerProxy('http://monitoring:9000', allow_none=True)
            logger.info(f"{self.server_id} connected to monitoring service XML-RPC")
        except Exception as e:
            logger.error(f"Failed to connect to monitoring XML-RPC: {e}")
            return
        
        while self.running:
            try:
                # Report Lamport clock
                lamport_time = self.clock.get_time()
                self.monitoring_client.report_clock(self.server_id, lamport_time)
                
                # Report election and FT status
                leader_id = self.election.get_leader() if self.election else 'unknown'
                ft_role = self.heartbeat.role if self.heartbeat else 'UNKNOWN'
                self.monitoring_client.report_status(self.server_id, leader_id, ft_role)
                
                # Report load
                with self.lock:
                    active_conns = self.active_connections_count
                self.monitoring_client.report_load(self.server_id, active_conns)
                
                # Report consistency status (placeholder for now)
                self.monitoring_client.report_consistency(self.server_id, 'EVENTUAL')
                
                logger.debug(f"{self.server_id} reported metrics via XML-RPC")
                
            except Exception as e:
                logger.error(f"Failed to report metrics via XML-RPC: {e}")
            
            time.sleep(5)  # Report every 5 seconds
        
    def start_server(self):
        """
        Start TCP socket server.
        Binds to 0.0.0.0 for Docker compatibility.
        """
        self.running = True
        self.tcp_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.tcp_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        
        try:
            # Note: We're starting TCP server on a different port to avoid conflict with Flask
            tcp_port = self.port + 1000  # e.g., 9001 for app1, 9002 for app2
            self.tcp_socket.bind(('0.0.0.0', tcp_port))
            self.tcp_socket.listen(50)
            logger.info(f"TCP Application Server {self.server_id} listening on 0.0.0.0:{tcp_port}")
            
            while self.running:
                try:
                    client_socket, client_address = self.tcp_socket.accept()
                    logger.info(f"Accepted TCP connection from {client_address}")
                    
                    # Spawn thread to handle client
                    client_thread = threading.Thread(
                        target=self.handle_client,
                        args=(client_socket, client_address),
                        daemon=True
                    )
                    client_thread.start()
                    
                except Exception as e:
                    if self.running:
                        logger.error(f"Error accepting TCP connection: {e}")
                        
        except Exception as e:
            logger.error(f"Failed to start TCP server: {e}")
        finally:
            if self.tcp_socket:
                self.tcp_socket.close()
                
    def handle_client(self, client_socket: socket.socket, client_address: tuple):
        """
        Handle individual client connection.
        Increments Lamport clock on state-modifying requests.
        
        Args:
            client_socket: Client socket connection
            client_address: Client address tuple (ip, port)
        """
        with self.lock:
            self.active_connections_count += 1
            
        try:
            # Set socket timeout
            client_socket.settimeout(30)
            
            # Receive request data
            data = b''
            while True:
                chunk = client_socket.recv(4096)
                if not chunk:
                    break
                data += chunk
                if len(chunk) < 4096:
                    break
                    
            if not data:
                return
                
            # Parse request
            try:
                request_data = json.loads(data.decode('utf-8'))
                logger.info(f"TCP Request from {client_address}: {request_data.get('action', 'unknown')}")
                
                # Handle request and get response
                response = self.process_request(request_data)
                
                # Send response
                response_json = json.dumps(response).encode('utf-8')
                client_socket.sendall(response_json)
                
                with self.lock:
                    self.total_requests_handled += 1
                    
            except json.JSONDecodeError as e:
                logger.error(f"Invalid JSON from {client_address}: {e}")
                error_response = json.dumps({'error': 'Invalid JSON'}).encode('utf-8')
                client_socket.sendall(error_response)
                
        except socket.timeout:
            logger.warning(f"Socket timeout for {client_address}")
        except Exception as e:
            logger.error(f"Error handling client {client_address}: {e}")
        finally:
            with self.lock:
                self.active_connections_count -= 1
            try:
                client_socket.close()
            except:
                pass
                
    def process_request(self, request_data: dict) -> dict:
        """
        Process client request with Lamport clock synchronization.
        
        Args:
            request_data: Request dictionary with 'action' and other parameters
            
        Returns:
            Response dictionary with result and timestamp
        """
        action = request_data.get('action')
        external_ts = request_data.get('lamport_time', 0)
        
        # Update Lamport clock on receive
        if external_ts > 0:
            self.clock.update_on_receive(external_ts)
        
        # Increment clock for local event (state-modifying request)
        if action in ['create', 'update', 'delete', 'write', 'modify']:
            current_time = self.clock.increment_local()
            logger.info(f"State-modifying request '{action}' - Lamport time: {current_time}")
        else:
            current_time = self.clock.get_time()
            
        # Process based on action
        response = {
            'server_id': self.server_id,
            'lamport_time': current_time,
            'timestamp': datetime.now().isoformat(),
            'action': action
        }
        
        # Handle different actions
        if action == 'get_status':
            response['result'] = {
                'active_connections': self.active_connections_count,
                'total_requests': self.total_requests_handled,
                'is_primary': self.heartbeat.is_primary() if self.heartbeat else False
            }
        elif action == 'health_check':
            response['result'] = {'status': 'healthy'}
        else:
            # Handle RMI or custom requests
            response['result'] = {'message': f'Action {action} processed'}
            
        # Return acknowledgment with timestamp
        response['acknowledgment'] = 'success'
        return response
        
    def get_stats(self) -> dict:
        """Get server statistics."""
        with self.lock:
            return {
                'server_id': self.server_id,
                'active_connections': self.active_connections_count,
                'total_requests': self.total_requests_handled,
                'lamport_time': self.clock.get_time()
            }
            
    def stop_server(self):
        """Stop the TCP server."""
        self.running = False
        if self.tcp_socket:
            try:
                self.tcp_socket.close()
            except:
                pass
        logger.info(f"TCP Application Server {self.server_id} stopped")


# Initialize Application Server instance
app_server = None

try:
    client = MongoClient(MONGO_URI)
    db = client['distributed_learning_hub']
    users_collection = db['users']
    courses_collection = db['courses']
    sessions_collection = db['sessions']
    logger.info(f"Connected to MongoDB successfully on {SERVER_ID}")
    
    # Initialize RMI Dispatcher for remote course access
    course_service = CourseService(courses_collection)
    rmi_dispatcher = RMIDispatcher(course_service, port=9001)
    rmi_dispatcher.start()
    logger.info(f"RMI Dispatcher started on port 9001")
    
    # Initialize Heartbeat Protocol (app1 is PRIMARY by default)
    is_primary = (SERVER_ID == 'app1')
    role = 'PRIMARY' if is_primary else 'BACKUP'
    primary_host = 'app1' if not is_primary else None
    
    heartbeat_protocol = HeartbeatProtocol(
        server_id=SERVER_ID,
        role=role,
        primary_host=primary_host,
        port=9002
    )
    
    # Set callback for promotion to primary
    def on_promote_callback(server_id):
        logger.warning(f"⚠️ {server_id} PROMOTED TO PRIMARY - Taking over cluster leadership")
    
    heartbeat_protocol.on_promote_to_primary = on_promote_callback
    heartbeat_protocol.start()
    logger.info(f"Heartbeat protocol started as {role}")
    
    # Initialize Enhanced Application Server
    app_server = ApplicationServer(
        server_id=SERVER_ID,
        port=PORT,
        lamport_clock=lamport_clock,
        heartbeat_protocol=heartbeat_protocol
    )
    
    # Start TCP server in background thread
    tcp_server_thread = threading.Thread(target=app_server.start_server, daemon=True)
    tcp_server_thread.start()
    logger.info(f"TCP Application Server thread started")
    
except Exception as e:
    logger.error(f"Failed to initialize services: {e}")
    db = None


# Helper functions
def hash_password(password: str) -> str:
    """Hash password using SHA-256."""
    return hashlib.sha256(password.encode()).hexdigest()


def serialize_doc(doc):
    """Convert MongoDB document to JSON-serializable format."""
    if doc is None:
        return None
    if isinstance(doc, list):
        return [serialize_doc(d) for d in doc]
    if isinstance(doc, dict):
        doc['_id'] = str(doc['_id'])
        return doc
    return doc


# Health check
@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint with DC metrics."""
    # Increment Lamport clock for local event
    lamport_time = lamport_clock.increment_local()
    
    db_status = 'connected' if db is not None else 'disconnected'
    ft_status = heartbeat_protocol.get_status() if heartbeat_protocol else None
    
    # Get app server stats if available
    app_server_stats = app_server.get_stats() if app_server else {}
    
    return jsonify({
        'status': 'healthy',
        'server_id': SERVER_ID,
        'port': PORT,
        'database': db_status,
        'timestamp': datetime.now().isoformat(),
        'lamport_time': lamport_time,
        'fault_tolerance': ft_status,
        'active_connections': app_server_stats.get('active_connections', 0),
        'total_requests': app_server_stats.get('total_requests', 0)
    }), 200


@app.route('/info', methods=['GET'])
def info():
    """Server information with DC status."""
    lamport_time = lamport_clock.get_time()
    ft_status = heartbeat_protocol.get_status() if heartbeat_protocol else None
    app_server_stats = app_server.get_stats() if app_server else {}
    
    return jsonify({
        'server_id': SERVER_ID,
        'port': PORT,
        'uptime': 'running',
        'timestamp': datetime.now().isoformat(),
        'lamport_clock': lamport_time,
        'role': ft_status.get('role') if ft_status else 'UNKNOWN',
        'is_primary': heartbeat_protocol.is_primary() if heartbeat_protocol else False,
        'tcp_stats': app_server_stats
    }), 200


@app.route('/server/stats', methods=['GET'])
def server_stats():
    """Get detailed server statistics including TCP connections."""
    app_server_stats = app_server.get_stats() if app_server else {}
    
    return jsonify({
        'server_id': SERVER_ID,
        'port': PORT,
        'tcp_port': PORT + 1000,
        'lamport_time': lamport_clock.get_time(),
        'active_connections': app_server_stats.get('active_connections', 0),
        'total_requests_handled': app_server_stats.get('total_requests', 0),
        'is_primary': heartbeat_protocol.is_primary() if heartbeat_protocol else False,
        'role': heartbeat_protocol.get_status().get('role') if heartbeat_protocol else 'UNKNOWN',
        'timestamp': datetime.now().isoformat()
    }), 200


# Bully Election endpoints
@app.route('/election/status', methods=['GET'])
def get_election_status():
    """Get current election status."""
    if bully_election:
        return jsonify(bully_election.get_election_status()), 200
    return jsonify({'error': 'Election not initialized'}), 503


@app.route('/election/history', methods=['GET'])
def get_election_history():
    """Get election history."""
    if bully_election:
        return jsonify({
            'server_id': SERVER_ID,
            'history': bully_election.get_election_history()
        }), 200
    return jsonify({'error': 'Election not initialized'}), 503


@app.route('/election/initiate', methods=['POST'])
def initiate_election():
    """Manually trigger an election."""
    if bully_election:
        threading.Thread(target=bully_election.initiate_election, daemon=True).start()
        return jsonify({
            'message': 'Election initiated',
            'server_id': SERVER_ID
        }), 200
    return jsonify({'error': 'Election not initialized'}), 503


# Inter-Server Messaging endpoints
@app.route('/messages/send', methods=['POST'])
def send_message():
    """Send a discussion message to another server."""
    if not messaging_system:
        return jsonify({'error': 'Messaging not initialized'}), 503
    
    data = request.get_json()
    target_server = data.get('target_server')
    message = data.get('message')
    message_type = data.get('message_type', 'discussion')
    
    if not target_server or not message:
        return jsonify({'error': 'Missing target_server or message'}), 400
    
    success = messaging_system.send_discussion_message(message, target_server, message_type)
    
    return jsonify({
        'success': success,
        'sender': SERVER_ID,
        'target': target_server,
        'lamport_time': lamport_clock.get_time()
    }), 200 if success else 500


@app.route('/messages/broadcast', methods=['POST'])
def broadcast_message():
    """Broadcast a message to all servers."""
    if not messaging_system:
        return jsonify({'error': 'Messaging not initialized'}), 503
    
    data = request.get_json()
    message = data.get('message')
    message_type = data.get('message_type', 'broadcast')
    
    if not message:
        return jsonify({'error': 'Missing message'}), 400
    
    results = messaging_system.broadcast_message(message, message_type)
    
    return jsonify({
        'sender': SERVER_ID,
        'results': results,
        'lamport_time': lamport_clock.get_time()
    }), 200


@app.route('/messages/all', methods=['GET'])
def get_all_messages():
    """Get all messages (sent and received)."""
    if not messaging_system:
        return jsonify({'error': 'Messaging not initialized'}), 503
    
    limit = request.args.get('limit', 100, type=int)
    messages = messaging_system.get_all_messages(limit)
    
    return jsonify({
        'server_id': SERVER_ID,
        'messages': messages,
        'count': len(messages)
    }), 200


@app.route('/messages/stats', methods=['GET'])
def get_message_stats():
    """Get message statistics."""
    if not messaging_system:
        return jsonify({'error': 'Messaging not initialized'}), 503
    
    stats = messaging_system.get_message_stats()
    return jsonify(stats), 200


# =============================================================================
# CONSISTENCY AND REPLICATION ENDPOINTS
# =============================================================================

@app.route('/consistency/status', methods=['GET'])
def get_consistency_status():
    """Get consistency and replication status."""
    if not consistency_manager:
        return jsonify({'error': 'Consistency manager not initialized'}), 503
    
    status = consistency_manager.get_consistency_status()
    return jsonify(status), 200


@app.route('/consistency/statistics', methods=['GET'])
def get_consistency_statistics():
    """Get detailed consistency statistics."""
    if not consistency_manager:
        return jsonify({'error': 'Consistency manager not initialized'}), 503
    
    stats = consistency_manager.get_statistics()
    return jsonify(stats), 200


@app.route('/consistency/write', methods=['POST'])
def consistency_write():
    """Perform a write with strong consistency and synchronous replication."""
    if not consistency_manager:
        return jsonify({'error': 'Consistency manager not initialized'}), 503
    
    data = request.get_json()
    key = data.get('key')
    value = data.get('value')
    
    if not key:
        return jsonify({'error': 'Key is required'}), 400
    
    # Define replication function
    def replicate_to_servers(server, message, timeout=2.0):
        try:
            # Send to server via messaging system
            if messaging_system:
                response = messaging_system.send_consistency_message(server, message, timeout)
                return response
            return None
        except Exception as e:
            logger.error(f"Replication error to {server}: {e}")
            return None
    
    success, message, operation = consistency_manager.write_with_replication(
        key, value, replicate_to_servers
    )
    
    return jsonify({
        'success': success,
        'message': message,
        'operation': operation,
        'lamport_time': lamport_clock.increment_local()
    }), 200 if success else 500


@app.route('/consistency/read', methods=['GET'])
def consistency_read():
    """Perform a strongly consistent read."""
    if not consistency_manager:
        return jsonify({'error': 'Consistency manager not initialized'}), 503
    
    key = request.args.get('key')
    if not key:
        return jsonify({'error': 'Key parameter is required'}), 400
    
    value = consistency_manager.read_consistent(key)
    
    return jsonify({
        'key': key,
        'value': value,
        'server_id': SERVER_ID,
        'lamport_time': lamport_clock.increment_local(),
        'timestamp': datetime.now().isoformat()
    }), 200


@app.route('/consistency/prepare', methods=['POST'])
def handle_prepare():
    """Handle 2PC PREPARE phase request."""
    if not consistency_manager:
        return jsonify({'error': 'Consistency manager not initialized'}), 503
    
    data = request.get_json()
    operation = data.get('operation')
    
    response = consistency_manager.handle_prepare_request(operation)
    return jsonify(response), 200


@app.route('/consistency/commit', methods=['POST'])
def handle_commit():
    """Handle 2PC COMMIT phase request."""
    if not consistency_manager:
        return jsonify({'error': 'Consistency manager not initialized'}), 503
    
    data = request.get_json()
    operation = data.get('operation')
    
    response = consistency_manager.handle_commit_request(operation)
    return jsonify(response), 200


@app.route('/consistency/abort', methods=['POST'])
def handle_abort():
    """Handle 2PC ABORT phase request."""
    if not consistency_manager:
        return jsonify({'error': 'Consistency manager not initialized'}), 503
    
    data = request.get_json()
    operation = data.get('operation')
    
    response = consistency_manager.handle_abort_request(operation)
    return jsonify(response), 200


@app.route('/consistency/verify', methods=['GET'])
def verify_consistency():
    """Verify sequential consistency of operations."""
    if not consistency_manager:
        return jsonify({'error': 'Consistency manager not initialized'}), 503
    
    verification = consistency_manager.verify_sequential_consistency()
    return jsonify(verification), 200


@app.route('/consistency/history/<key>', methods=['GET'])
def get_version_history(key):
    """Get version history for a specific key."""
    if not consistency_manager:
        return jsonify({'error': 'Consistency manager not initialized'}), 503
    
    history = consistency_manager.get_version_history(key)
    return jsonify({
        'key': key,
        'history': history,
        'version_count': len(history)
    }), 200


# =============================================================================
# DISTRIBUTED COMPUTING ENDPOINTS
# =============================================================================

@app.route('/dc/lamport', methods=['GET'])
def get_lamport_clock():
    """Get current Lamport clock time."""
    return jsonify({
        'server_id': SERVER_ID,
        'lamport_time': lamport_clock.get_time(),
        'timestamp': datetime.now().isoformat()
    }), 200


@app.route('/dc/lamport/sync', methods=['POST'])
def sync_lamport_clock():
    """Synchronize Lamport clock with received timestamp."""
    data = request.get_json()
    external_ts = data.get('lamport_time', 0)
    
    new_time = lamport_clock.update_on_receive(external_ts)
    
    return jsonify({
        'server_id': SERVER_ID,
        'new_lamport_time': new_time,
        'timestamp': datetime.now().isoformat()
    }), 200


@app.route('/dc/heartbeat', methods=['GET'])
def get_heartbeat_status():
    """Get fault tolerance heartbeat status."""
    if not heartbeat_protocol:
        return jsonify({'error': 'Heartbeat protocol not initialized'}), 500
    
    status = heartbeat_protocol.get_status()
    return jsonify(status), 200


@app.route('/dc/rmi/test', methods=['GET'])
def test_rmi():
    """Test RMI by calling methods on other servers."""
    from utils.custom_rmi import RemoteCourseStub
    
    results = {}
    for i in range(1, 4):
        server = f'app{i}'
        if server != SERVER_ID:
            try:
                stub = RemoteCourseStub(host=server, port=9001)
                courses = stub.get_courses()
                results[server] = {
                    'status': 'success',
                    'courses_count': len(courses) if courses else 0
                }
            except Exception as e:
                results[server] = {
                    'status': 'failed',
                    'error': str(e)
                }
    
    return jsonify({
        'server_id': SERVER_ID,
        'rmi_calls': results,
        'timestamp': datetime.now().isoformat()
    }), 200


# Authentication endpoints
@app.route('/auth/signup', methods=['POST'])
def signup():
    """User registration with Lamport clock synchronization."""
    try:
        # Increment Lamport clock for this event
        lamport_time = lamport_clock.increment_local()
        
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
        name = data.get('name')
        role = data.get('role', 'student')
        
        if not email or not password or not name:
            return jsonify({'error': 'Missing required fields'}), 400
            
        # Check if user exists
        if users_collection.find_one({'email': email}):
            return jsonify({'error': 'User already exists'}), 400
            
        # Create user with Lamport timestamp
        user = {
            'email': email,
            'password': hash_password(password),
            'name': name,
            'role': role,
            'created_at': datetime.now().isoformat(),
            'created_by': SERVER_ID,
            'lamport_time': lamport_time
        }
        
        result = users_collection.insert_one(user)
        user['_id'] = str(result.inserted_id)
        
        logger.info(f"User registered: {email} on {SERVER_ID} at Lamport time {lamport_time}")
        
        return jsonify({
            'success': True,
            'message': 'User registered successfully',
            'user': {
                'id': user['_id'],
                'email': user['email'],
                'name': user['name'],
                'role': user['role']
            },
            'server_id': SERVER_ID,
            'lamport_time': lamport_time
        }), 201
        
    except Exception as e:
        logger.error(f"Signup error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/auth/signin', methods=['POST'])
def signin():
    """User login."""
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
        
        if not email or not password:
            return jsonify({'error': 'Missing email or password'}), 400
            
        # Find user
        user = users_collection.find_one({'email': email})
        
        if not user or user['password'] != hash_password(password):
            return jsonify({'error': 'Invalid credentials'}), 401
            
        # Create session
        session = {
            'user_id': str(user['_id']),
            'email': user['email'],
            'role': user['role'],
            'created_at': datetime.now().isoformat(),
            'server_id': SERVER_ID
        }
        
        session_result = sessions_collection.insert_one(session)
        session_id = str(session_result.inserted_id)
        
        logger.info(f"User logged in: {email} on {SERVER_ID}")
        
        return jsonify({
            'success': True,
            'session_id': session_id,
            'user': {
                'id': str(user['_id']),
                'email': user['email'],
                'name': user['name'],
                'role': user['role']
            },
            'server_id': SERVER_ID
        }), 200
        
    except Exception as e:
        logger.error(f"Signin error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/auth/logout', methods=['POST'])
def logout():
    """User logout."""
    try:
        data = request.get_json()
        session_id = data.get('session_id')
        
        if session_id:
            sessions_collection.delete_one({'_id': ObjectId(session_id)})
            
        return jsonify({'success': True, 'message': 'Logged out successfully'}), 200
        
    except Exception as e:
        logger.error(f"Logout error: {e}")
        return jsonify({'error': str(e)}), 500


# Course endpoints
@app.route('/courses', methods=['GET'])
def get_courses():
    """Get all courses."""
    try:
        courses = list(courses_collection.find())
        return jsonify({
            'success': True,
            'courses': serialize_doc(courses),
            'count': len(courses),
            'server_id': SERVER_ID
        }), 200
        
    except Exception as e:
        logger.error(f"Get courses error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/courses', methods=['POST'])
def create_course():
    """Create a new course."""
    try:
        data = request.get_json()
        
        course = {
            'title': data.get('title'),
            'description': data.get('description'),
            'instructor': data.get('instructor'),
            'students': [],
            'created_at': datetime.now().isoformat(),
            'server_id': SERVER_ID
        }
        
        result = courses_collection.insert_one(course)
        course['_id'] = str(result.inserted_id)
        
        logger.info(f"Course created: {course['title']} on {SERVER_ID}")
        
        return jsonify({
            'success': True,
            'course': serialize_doc(course),
            'server_id': SERVER_ID
        }), 201
        
    except Exception as e:
        logger.error(f"Create course error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/courses/<course_id>', methods=['GET'])
def get_course(course_id):
    """Get a specific course."""
    try:
        course = courses_collection.find_one({'_id': ObjectId(course_id)})
        
        if not course:
            return jsonify({'error': 'Course not found'}), 404
            
        return jsonify({
            'success': True,
            'course': serialize_doc(course),
            'server_id': SERVER_ID
        }), 200
        
    except Exception as e:
        logger.error(f"Get course error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/stats', methods=['GET'])
def get_stats():
    """Get server statistics."""
    try:
        stats = {
            'server_id': SERVER_ID,
            'users_count': users_collection.count_documents({}),
            'courses_count': courses_collection.count_documents({}),
            'sessions_count': sessions_collection.count_documents({}),
            'timestamp': datetime.now().isoformat()
        }
        
        return jsonify(stats), 200
        
    except Exception as e:
        logger.error(f"Get stats error: {e}")
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    logger.info(f"Starting {SERVER_ID} on port {PORT}")
    logger.info("="*60)
    logger.info("Initializing Distributed Computing Components")
    logger.info("="*60)
    
    # Initialize Bully Election
    def on_elected_leader():
        """Callback when this server becomes leader."""
        logger.info(f"🎖️  {SERVER_ID} ELECTED AS LEADER!")
        # Update FT role to PRIMARY
        if heartbeat_protocol:
            heartbeat_protocol.promote_to_primary()
    
    bully_election = BullyElection(
        server_id=SERVER_ID,
        port=9100,
        on_elected_leader=on_elected_leader
    )
    bully_election.start()
    logger.info(f"✓ Bully Election initialized for {SERVER_ID}")
    
    # Initialize Inter-Server Messaging
    def on_message_received(message_data):
        """Callback when message is received."""
        sender = message_data.get('sender')
        content = message_data.get('content', '')[:50]
        logger.info(f"📩 Message received from {sender}: {content}...")
    
    messaging_system = InterServerMessaging(
        server_id=SERVER_ID,
        lamport_clock=lamport_clock,
        port=9200,
        on_message_received=on_message_received
    )
    messaging_system.start()
    logger.info(f"✓ Inter-Server Messaging initialized for {SERVER_ID}")
    
    # Initialize Strong Consistency Manager
    all_servers = ['app1', 'app2', 'app3']
    consistency_manager = StrongConsistencyManager(
        server_id=SERVER_ID,
        servers=all_servers,
        lamport_clock=lamport_clock
    )
    logger.info(f"✓ Strong Consistency Manager initialized for {SERVER_ID}")
    
    # Initialize Heartbeat Protocol (Fault Tolerance)
    primary_server = 'app1'  # app1 is initially PRIMARY
    role = 'PRIMARY' if SERVER_ID == primary_server else 'BACKUP'
    
    def on_become_primary():
        """Callback when promoted to PRIMARY due to failure."""
        logger.info(f"⚡ {SERVER_ID} PROMOTED TO PRIMARY due to failure!")
        # Initiate election to confirm leadership
        if bully_election:
            threading.Thread(target=bully_election.initiate_election, daemon=True).start()
    
    heartbeat_protocol = HeartbeatProtocol(
        server_id=SERVER_ID,
        role=role,
        primary_host=primary_server if role == 'BACKUP' else None,
        port=9002
    )
    heartbeat_protocol.on_promote_to_primary = on_become_primary
    heartbeat_protocol.start()
    logger.info(f"✓ Heartbeat Protocol started as {role}")
    
    # Initialize RMI Dispatcher
    course_service = CourseService(courses_collection)
    rmi_dispatcher = RMIDispatcher(SERVER_ID, PORT + 5000, course_service)  # RMI on port 13001, 13002, 13003
    rmi_dispatcher.start()
    logger.info(f"✓ RMI Dispatcher started on port {PORT + 5000}")
    
    # Initialize Application Server (TCP)
    app_server = ApplicationServer(
        server_id=SERVER_ID,
        port=PORT,
        lamport_clock=lamport_clock,
        heartbeat_protocol=heartbeat_protocol,
        bully_election=bully_election,
        messaging_system=messaging_system
    )
    
    # Start TCP server in background thread
    tcp_thread = threading.Thread(target=app_server.start_server, daemon=True)
    tcp_thread.start()
    logger.info(f"✓ TCP Application Server started on port {PORT + 1000}")
    
    # Start XML-RPC monitoring reports
    app_server.start_monitoring_reports()
    logger.info(f"✓ XML-RPC monitoring reports started")
    
    # Initial election to determine leader
    time.sleep(2)  # Wait for all servers to initialize
    if SERVER_ID == 'app3':  # Highest ranked server initiates first election
        logger.info(f"{SERVER_ID} initiating first election...")
        threading.Thread(target=bully_election.initiate_election, daemon=True).start()
    
    logger.info("="*60)
    logger.info(f"✅ {SERVER_ID} FULLY INITIALIZED - All DC components running")
    logger.info("="*60)
    
    # Start Flask app
    app.run(host='0.0.0.0', port=PORT, debug=False)

