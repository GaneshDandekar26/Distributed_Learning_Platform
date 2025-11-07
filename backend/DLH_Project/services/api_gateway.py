"""
API Gateway Service
Central entry point for all client requests, routing to appropriate services.
"""

import socket
import threading
import json
from typing import Dict, Any


class APIGateway:
    """
    API Gateway for routing requests to distributed services.
    Handles load balancing and service discovery.
    """
    
    def __init__(self, host: str = 'localhost', port: int = 5000):
        self.host = host
        self.port = port
        self.services = {}
        self.running = False
        
    def register_service(self, service_name: str, service_address: tuple):
        """Register a service with the gateway."""
        self.services[service_name] = service_address
        print(f"Service {service_name} registered at {service_address}")
        
    def start(self):
        """Start the API Gateway server."""
        self.running = True
        server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        server_socket.bind((self.host, self.port))
        server_socket.listen(5)
        
        print(f"API Gateway started on {self.host}:{self.port}")
        
        while self.running:
            try:
                client_socket, address = server_socket.accept()
                client_thread = threading.Thread(
                    target=self.handle_client,
                    args=(client_socket, address)
                )
                client_thread.start()
            except Exception as e:
                print(f"Error accepting connection: {e}")
                
    def handle_client(self, client_socket: socket.socket, address: tuple):
        """Handle incoming client requests."""
        try:
            data = client_socket.recv(4096).decode('utf-8')
            request = json.loads(data)
            
            service_name = request.get('service')
            response = self.route_request(service_name, request)
            
            client_socket.send(json.dumps(response).encode('utf-8'))
        except Exception as e:
            error_response = {'error': str(e)}
            client_socket.send(json.dumps(error_response).encode('utf-8'))
        finally:
            client_socket.close()
            
    def route_request(self, service_name: str, request: Dict[str, Any]) -> Dict[str, Any]:
        """Route request to appropriate service."""
        if service_name not in self.services:
            return {'error': f'Service {service_name} not found'}
        
        # Placeholder response
        return {'status': 'success', 'message': f'Request routed to {service_name}'}
        
    def stop(self):
        """Stop the API Gateway server."""
        self.running = False


if __name__ == '__main__':
    gateway = APIGateway()
    gateway.start()
