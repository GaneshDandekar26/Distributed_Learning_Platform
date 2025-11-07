"""
Monitoring Service
Tracks health, metrics, and performance of all distributed services.
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import requests
import threading
import time
from datetime import datetime
from typing import Dict, List
import logging

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


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
                'is_primary': False
            }
            for service in self.services
        }
        
        self.history = {service: [] for service in self.services}
        
        # Start monitoring thread
        self.monitoring_thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self.monitoring_thread.start()
        
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
            
            self.metrics[service_name].update({
                'status': 'healthy' if is_healthy else 'unhealthy',
                'last_check': datetime.now().isoformat(),
                'response_time': round(response_time, 2),
                'requests_count': self.metrics[service_name]['requests_count'] + 1,
                'lamport_time': lamport_time,
                'role': ft_status.get('role', 'UNKNOWN') if ft_status else 'UNKNOWN',
                'is_primary': ft_status.get('role') == 'PRIMARY' if ft_status else False
            })
            
            if is_healthy:
                self.metrics[service_name]['uptime'] += 3  # seconds
                
            # Add to history (keep last 100 entries)
            self.history[service_name].append({
                'timestamp': datetime.now().isoformat(),
                'status': 'healthy' if is_healthy else 'unhealthy',
                'response_time': round(response_time, 2),
                'lamport_time': lamport_time,
                'role': ft_status.get('role', 'UNKNOWN') if ft_status else 'UNKNOWN'
            })
            
            if len(self.history[service_name]) > 100:
                self.history[service_name].pop(0)
                
            logger.info(f"{service_name}: {self.metrics[service_name]['status']} ({response_time:.2f}ms) Lamport:{lamport_time} Role:{self.metrics[service_name]['role']}")
            
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


if __name__ == '__main__':
    logger.info("Starting Monitoring Service on port 9000")
    app.run(host='0.0.0.0', port=9000, debug=False)
