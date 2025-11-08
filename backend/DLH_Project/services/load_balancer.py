"""
Load Balancer Service
Distributes incoming requests across multiple app servers using Least Connections algorithm.
Implements TCP socket-based proxying for high performance.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import threading
import time
import socket
import select
from typing import List, Dict, Tuple
import logging

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class LeastConnectionsLB:
    """
    Least Connections Load Balancer
    Routes requests to the server with the minimum active connections.
    """
    
    def __init__(self, servers: Dict[str, int]):
        """
        Initialize load balancer with server configuration.
        
        Args:
            servers: Dict mapping server hostname to port (e.g., {"app1": 8001})
        """
        self.servers = servers  # {"app1": 8001, "app2": 8002, "app3": 8003}
        self.connections = {f"{host}:{port}": 0 for host, port in servers.items()}
        self.lock = threading.Lock()
        self.server_health = {f"{host}:{port}": True for host, port in servers.items()}
        self.total_requests = 0
        self.request_history = []
        
        # Start health check thread
        self.health_check_thread = threading.Thread(target=self._health_check_loop, daemon=True)
        self.health_check_thread.start()
        
    def get_least_connected_server(self) -> Tuple[str, int]:
        """
        Get the server with the minimum active connections.
        
        Returns:
            Tuple of (hostname, port) of the least connected server
        """
        with self.lock:
            # Filter only healthy servers
            healthy_servers = {
                server: count for server, count in self.connections.items()
                if self.server_health.get(server, False)
            }
            
            if not healthy_servers:
                # If no healthy servers, try first server anyway
                first_server = next(iter(self.connections.keys()))
                host, port = first_server.split(':')
                return host, int(port)
            
            # Find server with minimum connections
            least_connected = min(healthy_servers.items(), key=lambda x: x[1])
            server_address = least_connected[0]
            host, port = server_address.split(':')
            
            logger.debug(f"Selected {server_address} with {least_connected[1]} connections")
            return host, int(port)
    
    def increment_connection(self, host: str, port: int):
        """Increment connection count for a server."""
        server_key = f"{host}:{port}"
        with self.lock:
            if server_key in self.connections:
                self.connections[server_key] += 1
                self.total_requests += 1
                logger.debug(f"Incremented {server_key} to {self.connections[server_key]} connections")
    
    def decrement_connection(self, host: str, port: int):
        """Decrement connection count for a server."""
        server_key = f"{host}:{port}"
        with self.lock:
            if server_key in self.connections and self.connections[server_key] > 0:
                self.connections[server_key] -= 1
                logger.debug(f"Decremented {server_key} to {self.connections[server_key]} connections")
    
    def _health_check_loop(self):
        """Continuously check health of all servers."""
        while True:
            for server_key in list(self.connections.keys()):
                host, port = server_key.split(':')
                try:
                    # Try to connect to the server's HTTP endpoint
                    response = requests.get(f"http://{host}:{port}/health", timeout=2)
                    self.server_health[server_key] = response.status_code == 200
                    
                    if response.status_code == 200:
                        logger.debug(f"Server {server_key} is healthy")
                    else:
                        logger.warning(f"Server {server_key} returned status {response.status_code}")
                        
                except Exception as e:
                    self.server_health[server_key] = False
                    logger.warning(f"Server {server_key} is down: {e}")
                    
            time.sleep(5)  # Check every 5 seconds
    
    def get_status(self) -> Dict:
        """Get load balancer status."""
        with self.lock:
            return {
                'connections': self.connections.copy(),
                'health': self.server_health.copy(),
                'total_requests': self.total_requests,
                'algorithm': 'least_connections'
            }
    
    def proxy_tcp_connection(self, client_socket: socket.socket):
        """
        Proxy a TCP connection between client and backend server.
        Uses select() for efficient bidirectional streaming.
        
        Args:
            client_socket: The client's socket connection
        """
        backend_socket = None
        try:
            # Get least connected server
            host, port = self.get_least_connected_server()
            
            # Increment connection count
            self.increment_connection(host, port)
            
            # Connect to backend server
            backend_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            backend_socket.settimeout(10)
            backend_socket.connect((host, port))
            
            logger.info(f"Proxying connection to {host}:{port}")
            
            # Set sockets to non-blocking
            client_socket.setblocking(False)
            backend_socket.setblocking(False)
            
            # Proxy data between client and server
            sockets = [client_socket, backend_socket]
            
            while True:
                readable, _, exceptional = select.select(sockets, [], sockets, 60)
                
                if exceptional:
                    break
                
                for sock in readable:
                    try:
                        data = sock.recv(4096)
                        if not data:
                            # Connection closed
                            return
                        
                        # Forward data to the other socket
                        if sock is client_socket:
                            backend_socket.sendall(data)
                        else:
                            client_socket.sendall(data)
                            
                    except (ConnectionResetError, BrokenPipeError):
                        return
                    except Exception as e:
                        logger.error(f"Error proxying data: {e}")
                        return
                        
        except Exception as e:
            logger.error(f"Error in TCP proxy: {e}")
        finally:
            # Decrement connection count
            if 'host' in locals() and 'port' in locals():
                self.decrement_connection(host, port)
            
            # Close sockets
            if backend_socket:
                try:
                    backend_socket.close()
                except:
                    pass
            try:
                client_socket.close()
            except:
                pass


class TCPLoadBalancerServer:
    """
    TCP server that accepts connections and distributes them using load balancer.
    """
    
    def __init__(self, lb: LeastConnectionsLB, host: str = '0.0.0.0', port: int = 8000):
        self.lb = lb
        self.host = host
        self.port = port
        self.running = False
        self.server_socket = None
        
    def start(self):
        """Start the TCP load balancer server."""
        self.running = True
        self.server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.server_socket.bind((self.host, self.port))
        self.server_socket.listen(100)
        
        logger.info(f"TCP Load Balancer listening on {self.host}:{self.port}")
        
        while self.running:
            try:
                client_socket, client_address = self.server_socket.accept()
                logger.info(f"Accepted connection from {client_address}")
                
                # Handle client in a separate thread
                client_thread = threading.Thread(
                    target=self.lb.proxy_tcp_connection,
                    args=(client_socket,),
                    daemon=True
                )
                client_thread.start()
                
            except Exception as e:
                if self.running:
                    logger.error(f"Error accepting connection: {e}")
    
    def stop(self):
        """Stop the TCP server."""
        self.running = False
        if self.server_socket:
            self.server_socket.close()


# Initialize load balancer with app servers (Docker hostnames)
lb = LeastConnectionsLB({
    'app1': 8001,
    'app2': 8002,
    'app3': 8003
})


# Flask HTTP endpoints for monitoring and status
@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({'status': 'healthy', 'service': 'load_balancer'}), 200


@app.route('/lb/status', methods=['GET'])
def lb_status():
    """Get load balancer status with connection metrics."""
    status = lb.get_status()
    return jsonify(status), 200


@app.route('/lb/connections', methods=['GET'])
def lb_connections():
    """Get current connection distribution across servers."""
    with lb.lock:
        return jsonify({
            'connections': lb.connections.copy(),
            'total_requests': lb.total_requests
        }), 200


@app.route('/lb/metrics', methods=['GET'])
def lb_metrics():
    """Get detailed load balancer metrics for graphing."""
    with lb.lock:
        servers_data = []
        for server_key, conn_count in lb.connections.items():
            host, port = server_key.split(':')
            servers_data.append({
                'server': server_key,
                'host': host,
                'port': int(port),
                'connections': conn_count,
                'is_healthy': lb.server_health.get(server_key, False)
            })
        
        return jsonify({
            'servers': servers_data,
            'total_requests': lb.total_requests,
            'algorithm': 'least_connections',
            'timestamp': time.time()
        }), 200


@app.route('/status', methods=['GET'])
def status():
    """Legacy status endpoint."""
    return lb_status()


@app.route('/<path:path>', methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
def proxy(path):
    """Proxy HTTP requests to backend servers using least connections."""
    host, port = lb.get_least_connected_server()
    server = f"http://{host}:{port}"
    
    if not server:
        return jsonify({'error': 'No available servers'}), 503
    
    # Increment connection count
    lb.increment_connection(host, port)
    
    try:
        # Forward request to selected server
        url = f"{server}/{path}"
        
        # Prepare request data
        kwargs = {
            'method': request.method,
            'url': url,
            'headers': {k: v for k, v in request.headers if k.lower() != 'host'},
            'timeout': 30
        }
        
        if request.method in ['POST', 'PUT', 'PATCH']:
            if request.is_json:
                kwargs['json'] = request.get_json()
            else:
                kwargs['data'] = request.get_data()
                
        if request.args:
            kwargs['params'] = request.args
            
        # Make request to backend server
        logger.info(f"Proxying {request.method} /{path} to {server} ({lb.connections[f'{host}:{port}']} connections)")
        response = requests.request(**kwargs)
        
        # Return response
        return response.content, response.status_code, dict(response.headers)
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Error proxying to {server}: {e}")
        return jsonify({'error': 'Backend server error', 'details': str(e)}), 502
    finally:
        # Decrement connection count
        lb.decrement_connection(host, port)


def start_flask_server():
    """Start Flask server in a separate thread."""
    logger.info("Starting Flask HTTP server on port 8000")
    app.run(host='0.0.0.0', port=8000, debug=False, threaded=True)


if __name__ == '__main__':
    # Start Flask server for HTTP/REST API
    flask_thread = threading.Thread(target=start_flask_server, daemon=True)
    flask_thread.start()
    
    logger.info("Load Balancer with Least Connections algorithm started")
    logger.info(f"Servers: {lb.connections}")
    
    # Keep main thread alive
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("Shutting down Load Balancer")

