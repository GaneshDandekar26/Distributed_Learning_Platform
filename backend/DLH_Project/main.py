"""
Main entry point for Distributed Learning Hub Backend.
Starts all distributed services.
"""

import threading
import time
import sys
from services.api_gateway import APIGateway
from services.auth_service import AuthService
from services.course_service import CourseService
from services.chat_service import ChatService
from services.whiteboard_service import WhiteboardService
from utils.logger import DistributedLogger


class DLHBackend:
    """
    Main coordinator for all distributed services.
    """
    
    def __init__(self):
        self.logger = DistributedLogger('DLH_Backend')
        self.services = {}
        self.threads = {}
        
    def start_service(self, name: str, service_class, *args, **kwargs):
        """Start a service in a separate thread."""
        self.logger.info(f"Starting {name}...")
        
        service = service_class(*args, **kwargs)
        self.services[name] = service
        
        thread = threading.Thread(target=service.start, daemon=True)
        thread.start()
        self.threads[name] = thread
        
        time.sleep(1)  # Give service time to start
        self.logger.info(f"{name} started successfully")
        
    def start_all(self):
        """Start all distributed services."""
        self.logger.info("=" * 60)
        self.logger.info("Distributed LearnHub Backend - Starting All Services")
        self.logger.info("=" * 60)
        
        try:
            # Start API Gateway
            self.start_service('API Gateway', APIGateway, 'localhost', 5000)
            
            # Start Authentication Service
            self.start_service('Auth Service', AuthService, 'localhost', 5001)
            
            # Start Course Service
            self.start_service('Course Service', CourseService, 'localhost', 5002)
            
            # Start Chat Service
            self.start_service('Chat Service', ChatService, 'localhost', 5003)
            
            # Start Whiteboard Service
            self.start_service('Whiteboard Service', WhiteboardService, 'localhost', 5004)
            
            self.logger.info("=" * 60)
            self.logger.info("All services started successfully!")
            self.logger.info("API Gateway: http://localhost:5000")
            self.logger.info("Auth Service: http://localhost:5001")
            self.logger.info("Course Service: http://localhost:5002")
            self.logger.info("Chat Service: ws://localhost:5003")
            self.logger.info("Whiteboard Service: ws://localhost:5004")
            self.logger.info("=" * 60)
            
            # Keep main thread alive
            while True:
                time.sleep(1)
                
        except KeyboardInterrupt:
            self.logger.info("\nShutting down services...")
            self.stop_all()
            
        except Exception as e:
            self.logger.error(f"Error starting services: {e}")
            self.stop_all()
            sys.exit(1)
            
    def stop_all(self):
        """Stop all services."""
        for name, service in self.services.items():
            try:
                self.logger.info(f"Stopping {name}...")
                if hasattr(service, 'stop'):
                    service.stop()
            except Exception as e:
                self.logger.error(f"Error stopping {name}: {e}")
                
        self.logger.info("All services stopped")


def main():
    """Main entry point."""
    backend = DLHBackend()
    backend.start_all()


if __name__ == '__main__':
    main()
