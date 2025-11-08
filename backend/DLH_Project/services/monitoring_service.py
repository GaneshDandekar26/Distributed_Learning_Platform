"""
Monitoring Service
Tracks health, metrics, and performance of all distributed services.
Includes XML-RPC server for distributed metrics reporting.
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import requests
import threading
import time
from datetime import datetime
from typing import Dict, List
import logging
from xmlrpc.server import SimpleXMLRPCServer
from xmlrpc.server import SimpleXMLRPCRequestHandler

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class XMLRPCMetricsServer:
    """
    XML-RPC Server for distributed metrics reporting.
    Application servers call these methods to report their metrics.
    """
    
    def __init__(self):
        self.server_metrics = {}
        self.lock = threading.Lock()
        logger.info("XML-RPC Metrics Server initialized")
    
    def report_clock(self, server_id: str, lamport_time: int) -> str:
        """
        Report Lamport clock value from a server.
        
        Args:
            server_id: Server identifier (e.g., 'app1')
            lamport_time: Current Lamport clock value
            
        Returns:
            Acknowledgment message
        """
        with self.lock:
            if server_id not in self.server_metrics:
                self.server_metrics[server_id] = {}
            
            self.server_metrics[server_id]['lamport_time'] = lamport_time
            self.server_metrics[server_id]['last_clock_update'] = time.time()
        
        logger.debug(f"Received clock report from {server_id}: {lamport_time}")
        return f"Clock report received from {server_id}"
    
    def report_status(self, server_id: str, leader_id: str, ft_role: str) -> str:
        """
        Report election and FT status from a server.
        
        Args:
            server_id: Server identifier
            leader_id: Current leader ID (from Bully election)
            ft_role: Fault tolerance role ('PRIMARY' or 'BACKUP')
            
        Returns:
            Acknowledgment message
        """
        with self.lock:
            if server_id not in self.server_metrics:
                self.server_metrics[server_id] = {}
            
            self.server_metrics[server_id]['leader_id'] = leader_id
            self.server_metrics[server_id]['ft_role'] = ft_role
            self.server_metrics[server_id]['last_status_update'] = time.time()
        
        logger.debug(f"Received status report from {server_id}: leader={leader_id}, role={ft_role}")
        return f"Status report received from {server_id}"
    
    def report_load(self, server_id: str, active_connections: int) -> str:
        """
        Report load metrics from a server.
        
        Args:
            server_id: Server identifier
            active_connections: Number of active connections
            
        Returns:
            Acknowledgment message
        """
        with self.lock:
            if server_id not in self.server_metrics:
                self.server_metrics[server_id] = {}
            
            self.server_metrics[server_id]['active_connections'] = active_connections
            self.server_metrics[server_id]['last_load_update'] = time.time()
        
        logger.debug(f"Received load report from {server_id}: {active_connections} connections")
        return f"Load report received from {server_id}"
    
    def report_consistency(self, server_id: str, status: str) -> str:
        """
        Report consistency status from a server.
        
        Args:
            server_id: Server identifier
            status: Consistency status (e.g., 'EVENTUAL', 'CAUSAL', 'STRONG')
            
        Returns:
            Acknowledgment message
        """
        with self.lock:
            if server_id not in self.server_metrics:
                self.server_metrics[server_id] = {}
            
            self.server_metrics[server_id]['consistency_status'] = status
            self.server_metrics[server_id]['last_consistency_update'] = time.time()
        
        logger.debug(f"Received consistency report from {server_id}: {status}")
        return f"Consistency report received from {server_id}"
    
    def get_all_metrics(self) -> dict:
        """Get all reported metrics."""
        with self.lock:
            return self.server_metrics.copy()


class MonitoringService:
    """Monitors health and metrics of distributed services."""
    
    def __init__(self):
        self.services = {
            'app1': {'url': 'http://app1:8001', 'port': 8001},
            'app2': {'url': 'http://app2:8002', 'port': 8002},
            'app3': {'url': 'http://app3:8003', 'port': 8003},
            'load_balancer': {'url': 'http://load_balancer:8000', 'port': 8000},
        }
        
        self.metrics = {
            service: {
                'status': 'unknown',
                'uptime': 0,
                'last_check': None,
                'response_time': 0,
                'requests_count': 0,
                'errors_count': 0,
                'start_time': datetime.now().isoformat(),
                'lamport_time': 0,
                'role': 'UNKNOWN',
                'is_primary': False,
                'election_leader': None,
                'message_count': 0
            }
            for service in self.services
        }
        
        self.history = {service: [] for service in self.services}
        
        # XML-RPC metrics storage
        self.xmlrpc_server = XMLRPCMetricsServer()
        
        # Start monitoring thread
        self.monitoring_thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self.monitoring_thread.start()
        
        # Start XML-RPC server thread
        self.xmlrpc_thread = threading.Thread(target=self._start_xmlrpc_server, daemon=True)
        self.xmlrpc_thread.start()
    
    def _start_xmlrpc_server(self):
        """Start XML-RPC server on port 9000 for metrics reporting."""
        try:
            # Create XML-RPC server
            server = SimpleXMLRPCServer(
                ('0.0.0.0', 9000),
                requestHandler=SimpleXMLRPCRequestHandler,
                allow_none=True,
                logRequests=False
            )
            
            # Register methods
            server.register_function(self.xmlrpc_server.report_clock, 'report_clock')
            server.register_function(self.xmlrpc_server.report_status, 'report_status')
            server.register_function(self.xmlrpc_server.report_load, 'report_load')
            server.register_function(self.xmlrpc_server.report_consistency, 'report_consistency')
            
            logger.info("XML-RPC Metrics Server started on port 9000")
            server.serve_forever()
            
        except Exception as e:
            logger.error(f"Failed to start XML-RPC server: {e}")
        
    def _monitor_loop(self):
        """Continuously monitor all services."""
        while True:
            for service_name, service_info in self.services.items():
                self._check_service(service_name, service_info['url'])
            time.sleep(3)  # Check every 3 seconds
            
    def _check_service(self, service_name: str, url: str):
        """Check health of a single service."""
        try:
            start_time = time.time()
            response = requests.get(f"{url}/health", timeout=2)
            response_time = (time.time() - start_time) * 1000  # ms
            
            is_healthy = response.status_code == 200
            
            # Extract DC metrics from response
            health_data = response.json() if is_healthy else {}
            lamport_time = health_data.get('lamport_time', 0)
            ft_status = health_data.get('fault_tolerance', {})
            active_connections = health_data.get('active_connections', 0)
            total_requests = health_data.get('total_requests', 0)
            
            self.metrics[service_name].update({
                'status': 'healthy' if is_healthy else 'unhealthy',
                'last_check': datetime.now().isoformat(),
                'response_time': round(response_time, 2),
                'requests_count': self.metrics[service_name]['requests_count'] + 1,
                'lamport_time': lamport_time,
                'role': ft_status.get('role', 'UNKNOWN') if ft_status else 'UNKNOWN',
                'is_primary': ft_status.get('role') == 'PRIMARY' if ft_status else False,
                'active_connections': active_connections,
                'total_requests': total_requests
            })
            
            if is_healthy:
                self.metrics[service_name]['uptime'] += 3  # seconds
                
            # Add to history (keep last 100 entries)
            self.history[service_name].append({
                'timestamp': datetime.now().isoformat(),
                'status': 'healthy' if is_healthy else 'unhealthy',
                'response_time': round(response_time, 2),
                'lamport_time': lamport_time,
                'role': ft_status.get('role', 'UNKNOWN') if ft_status else 'UNKNOWN',
                'active_connections': active_connections
            })
            
            if len(self.history[service_name]) > 100:
                self.history[service_name].pop(0)
                
            logger.info(f"{service_name}: {self.metrics[service_name]['status']} ({response_time:.2f}ms) Lamport:{lamport_time} Role:{self.metrics[service_name]['role']} Conns:{active_connections}")
            
        except Exception as e:
            self.metrics[service_name].update({
                'status': 'down',
                'last_check': datetime.now().isoformat(),
                'errors_count': self.metrics[service_name]['errors_count'] + 1
            })
            
            self.history[service_name].append({
                'timestamp': datetime.now().isoformat(),
                'status': 'down',
                'response_time': 0
            })
            
            if len(self.history[service_name]) > 100:
                self.history[service_name].pop(0)
                
            logger.warning(f"{service_name} is down: {e}")
    
    def get_load_balancer_metrics(self):
        """Get detailed load balancer metrics."""
        try:
            lb_url = self.services['load_balancer']['url']
            
            # Get connection distribution
            conn_response = requests.get(f"{lb_url}/lb/connections", timeout=2)
            lb_metrics_response = requests.get(f"{lb_url}/lb/metrics", timeout=2)
            
            if conn_response.status_code == 200 and lb_metrics_response.status_code == 200:
                return {
                    'connections': conn_response.json(),
                    'detailed_metrics': lb_metrics_response.json()
                }
        except Exception as e:
            logger.error(f"Failed to get load balancer metrics: {e}")
        
        return None

            
    def get_metrics(self):
        """Get all service metrics."""
        return self.metrics
        
    def get_history(self, service_name: str = None):
        """Get historical data for services."""
        if service_name:
            return self.history.get(service_name, [])
        return self.history
        
    def get_summary(self):
        """Get summary statistics."""
        total_services = len(self.services)
        healthy_services = sum(1 for m in self.metrics.values() if m['status'] == 'healthy')
        
        return {
            'total_services': total_services,
            'healthy_services': healthy_services,
            'unhealthy_services': total_services - healthy_services,
            'health_percentage': round((healthy_services / total_services) * 100, 2) if total_services > 0 else 0,
            'timestamp': datetime.now().isoformat()
        }


# Initialize monitoring service
monitor = MonitoringService()


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({'status': 'healthy', 'service': 'monitoring'}), 200


@app.route('/metrics', methods=['GET'])
def get_metrics():
    """Get all service metrics."""
    return jsonify(monitor.get_metrics()), 200


@app.route('/metrics/<service_name>', methods=['GET'])
def get_service_metrics(service_name):
    """Get metrics for a specific service."""
    metrics = monitor.get_metrics().get(service_name)
    if metrics:
        return jsonify(metrics), 200
    return jsonify({'error': 'Service not found'}), 404


@app.route('/history', methods=['GET'])
def get_history():
    """Get historical data for all services."""
    service_name = request.args.get('service')
    history = monitor.get_history(service_name)
    return jsonify(history), 200


@app.route('/summary', methods=['GET'])
def get_summary():
    """Get summary statistics."""
    return jsonify(monitor.get_summary()), 200


@app.route('/services', methods=['GET'])
def get_services():
    """Get list of monitored services."""
    return jsonify({
        'services': list(monitor.services.keys()),
        'count': len(monitor.services)
    }), 200


@app.route('/lb/metrics', methods=['GET'])
def get_lb_metrics():
    """Get detailed load balancer metrics."""
    lb_metrics = monitor.get_load_balancer_metrics()
    if lb_metrics:
        return jsonify(lb_metrics), 200
    return jsonify({'error': 'Unable to fetch load balancer metrics'}), 500


@app.route('/lb/connections', methods=['GET'])
def get_lb_connections():
    """Get load balancer connection distribution."""
    lb_metrics = monitor.get_load_balancer_metrics()
    if lb_metrics:
        return jsonify(lb_metrics.get('connections', {})), 200
    return jsonify({'error': 'Unable to fetch load balancer connections'}), 500


@app.route('/election/status', methods=['GET'])
def get_election_status():
    """Get Bully election status from all servers."""
    election_data = {}
    
    for service_name in ['app1', 'app2', 'app3']:
        try:
            url = monitor.services[service_name]['url']
            response = requests.get(f"{url}/election/status", timeout=2)
            if response.status_code == 200:
                election_data[service_name] = response.json()
        except Exception as e:
            logger.error(f"Failed to get election status from {service_name}: {e}")
            election_data[service_name] = {'error': str(e)}
    
    return jsonify(election_data), 200


@app.route('/election/history', methods=['GET'])
def get_election_history():
    """Get election history from all servers."""
    history_data = {}
    
    for service_name in ['app1', 'app2', 'app3']:
        try:
            url = monitor.services[service_name]['url']
            response = requests.get(f"{url}/election/history", timeout=2)
            if response.status_code == 200:
                history_data[service_name] = response.json()
        except Exception as e:
            logger.error(f"Failed to get election history from {service_name}: {e}")
            history_data[service_name] = {'error': str(e)}
    
    return jsonify(history_data), 200


@app.route('/messages/all', methods=['GET'])
def get_all_messages():
    """Get all inter-server messages from all servers."""
    messages_data = {}
    
    for service_name in ['app1', 'app2', 'app3']:
        try:
            url = monitor.services[service_name]['url']
            response = requests.get(f"{url}/messages/all", timeout=2)
            if response.status_code == 200:
                messages_data[service_name] = response.json()
        except Exception as e:
            logger.error(f"Failed to get messages from {service_name}: {e}")
            messages_data[service_name] = {'error': str(e)}
    
    return jsonify(messages_data), 200


@app.route('/messages/stats', methods=['GET'])
def get_message_stats():
    """Get message statistics from all servers."""
    stats_data = {}
    
    for service_name in ['app1', 'app2', 'app3']:
        try:
            url = monitor.services[service_name]['url']
            response = requests.get(f"{url}/messages/stats", timeout=2)
            if response.status_code == 200:
                stats_data[service_name] = response.json()
        except Exception as e:
            logger.error(f"Failed to get message stats from {service_name}: {e}")
            stats_data[service_name] = {'error': str(e)}
    
    return jsonify(stats_data), 200


@app.route('/ft/roles', methods=['GET'])
def get_ft_roles():
    """Get fault tolerance roles from all servers."""
    roles_data = {}
    
    for service_name in ['app1', 'app2', 'app3']:
        try:
            url = monitor.services[service_name]['url']
            response = requests.get(f"{url}/health", timeout=2)
            if response.status_code == 200:
                health_data = response.json()
                roles_data[service_name] = {
                    'role': health_data.get('fault_tolerance', {}).get('role', 'UNKNOWN'),
                    'is_primary': health_data.get('fault_tolerance', {}).get('is_primary', False),
                    'status': health_data.get('fault_tolerance', {}).get('status', 'unknown')
                }
        except Exception as e:
            logger.error(f"Failed to get FT role from {service_name}: {e}")
            roles_data[service_name] = {'error': str(e)}
    
    return jsonify(roles_data), 200


@app.route('/xmlrpc/metrics', methods=['GET'])
def get_xmlrpc_metrics():
    """Get metrics reported via XML-RPC."""
    return jsonify(monitor.xmlrpc_server.get_all_metrics()), 200


if __name__ == '__main__':
    logger.info("Starting Monitoring Service REST API on port 9005")
    logger.info("XML-RPC Metrics Server running on port 9000")
    app.run(host='0.0.0.0', port=9005, debug=False)
