"""
Distributed Logging Utility
Centralized logging for distributed services.
"""

import logging
import json
from datetime import datetime
from typing import Any, Dict


class DistributedLogger:
    """
    Logger for distributed systems with structured logging.
    """
    
    def __init__(self, service_name: str, log_file: str = None):
        self.service_name = service_name
        self.logger = logging.getLogger(service_name)
        self.logger.setLevel(logging.INFO)
        
        # Console handler
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.INFO)
        formatter = logging.Formatter(
            f'[{service_name}] %(asctime)s - %(levelname)s - %(message)s'
        )
        console_handler.setFormatter(formatter)
        self.logger.addHandler(console_handler)
        
        # File handler if specified
        if log_file:
            file_handler = logging.FileHandler(log_file)
            file_handler.setLevel(logging.INFO)
            file_handler.setFormatter(formatter)
            self.logger.addHandler(file_handler)
            
    def log_event(self, event_type: str, data: Dict[str, Any], level: str = 'INFO'):
        """Log a structured event."""
        log_entry = {
            'service': self.service_name,
            'event_type': event_type,
            'timestamp': datetime.now().isoformat(),
            'data': data
        }
        
        message = json.dumps(log_entry)
        
        if level == 'DEBUG':
            self.logger.debug(message)
        elif level == 'INFO':
            self.logger.info(message)
        elif level == 'WARNING':
            self.logger.warning(message)
        elif level == 'ERROR':
            self.logger.error(message)
        elif level == 'CRITICAL':
            self.logger.critical(message)
            
    def info(self, message: str):
        """Log info message."""
        self.logger.info(message)
        
    def error(self, message: str):
        """Log error message."""
        self.logger.error(message)
        
    def warning(self, message: str):
        """Log warning message."""
        self.logger.warning(message)
        
    def debug(self, message: str):
        """Log debug message."""
        self.logger.debug(message)
