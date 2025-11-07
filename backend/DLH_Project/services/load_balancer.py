"""
Load Balancer Service
Distributes incoming requests across multiple app servers using round-robin.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import threading
import time
from typing import List, Dict
import logging

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class LoadBalancer:
    """Round-robin load balancer for distributing requests."""
    
    def __init__(self, servers: List[str]):
        self.servers = servers
        self.current_index = 0
        self.lock = threading.Lock()
        self.server_health = {server: True for server in servers}
        
        # Start health check thread
        self.health_check_thread = threading.Thread(target=self._health_check_loop, daemon=True)
        self.health_check_thread.start()
        
    def get_next_server(self) -> str:
        """Get next available server using round-robin."""
        with self.lock:
            attempts = 0
            while attempts < len(self.servers):
                server = self.servers[self.current_index]
                self.current_index = (self.current_index + 1) % len(self.servers)
                
                if self.server_health.get(server, False):
                    return server
                    
                attempts += 1
                
            # If no healthy servers, return first one anyway
            return self.servers[0] if self.servers else None
            
    def _health_check_loop(self):
        """Continuously check health of all servers."""
        while True:
            for server in self.servers:
                try:
                    response = requests.get(f"{server}/health", timeout=2)
                    self.server_health[server] = response.status_code == 200
                    logger.info(f"Server {server} health: {self.server_health[server]}")
                except Exception as e:
                    self.server_health[server] = False
                    logger.warning(f"Server {server} is down: {e}")
                    
            time.sleep(5)  # Check every 5 seconds
            
    def get_status(self) -> Dict:
        """Get load balancer status."""
        return {
            'servers': self.servers,
            'health': self.server_health,
            'current_index': self.current_index
        }


# Initialize load balancer with app servers
lb = LoadBalancer([
    'http://app1:8001',
    'http://app2:8002',
    'http://app3:8003'
])


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({'status': 'healthy', 'service': 'load_balancer'}), 200


@app.route('/status', methods=['GET'])
def status():
    """Get load balancer status."""
    return jsonify(lb.get_status()), 200


@app.route('/<path:path>', methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
def proxy(path):
    """Proxy all requests to backend servers."""
    server = lb.get_next_server()
    
    if not server:
        return jsonify({'error': 'No available servers'}), 503
        
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
        response = requests.request(**kwargs)
        
        # Return response
        return response.content, response.status_code, dict(response.headers)
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Error proxying to {server}: {e}")
        return jsonify({'error': 'Backend server error', 'details': str(e)}), 502


if __name__ == '__main__':
    logger.info("Starting Load Balancer on port 8000")
    app.run(host='0.0.0.0', port=8000, debug=False)
