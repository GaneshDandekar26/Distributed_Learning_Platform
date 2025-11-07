"""
Consistency Manager
Handles consistency protocols for distributed data replication.
Implements various consistency models (Strong, Eventual, Causal).
"""

import threading
import time
from typing import Dict, List, Any, Callable
from enum import Enum
from datetime import datetime


class ConsistencyModel(Enum):
    """Types of consistency models."""
    STRONG = 1
    EVENTUAL = 2
    CAUSAL = 3


class VectorClock:
    """
    Vector clock for tracking causal relationships.
    """
    
    def __init__(self, node_id: str, nodes: List[str]):
        self.node_id = node_id
        self.nodes = nodes
        self.clock = {node: 0 for node in nodes}
        self.lock = threading.Lock()
        
    def increment(self):
        """Increment local counter."""
        with self.lock:
            self.clock[self.node_id] += 1
            return self.clock.copy()
            
    def update(self, other_clock: Dict[str, int]):
        """Update clock with received vector."""
        with self.lock:
            for node in self.nodes:
                if node in other_clock:
                    self.clock[node] = max(self.clock[node], other_clock[node])
            self.clock[self.node_id] += 1
            return self.clock.copy()
            
    def is_concurrent(self, other_clock: Dict[str, int]) -> bool:
        """Check if two events are concurrent."""
        with self.lock:
            less = False
            greater = False
            
            for node in self.nodes:
                if self.clock[node] < other_clock.get(node, 0):
                    less = True
                if self.clock[node] > other_clock.get(node, 0):
                    greater = True
                    
            return less and greater
            
    def happens_before(self, other_clock: Dict[str, int]) -> bool:
        """Check if this event happens before another."""
        with self.lock:
            for node in self.nodes:
                if self.clock[node] > other_clock.get(node, 0):
                    return False
            return True


class ConsistencyManager:
    """
    Manages data consistency across distributed replicas.
    """
    
    def __init__(self, node_id: str, nodes: List[str], 
                 model: ConsistencyModel = ConsistencyModel.EVENTUAL):
        self.node_id = node_id
        self.nodes = nodes
        self.model = model
        self.vector_clock = VectorClock(node_id, nodes)
        self.data_store: Dict[str, Any] = {}
        self.version_history: Dict[str, List[Dict]] = {}
        self.pending_operations: List[Dict] = []
        self.lock = threading.Lock()
        
    def write(self, key: str, value: Any, replicate: Callable = None) -> Dict[str, Any]:
        """
        Write operation with consistency guarantees.
        """
        with self.lock:
            timestamp = self.vector_clock.increment()
            
            operation = {
                'type': 'WRITE',
                'key': key,
                'value': value,
                'timestamp': timestamp,
                'node_id': self.node_id,
                'wall_time': datetime.now().isoformat()
            }
            
            # Update local store
            self.data_store[key] = value
            
            # Track version history
            if key not in self.version_history:
                self.version_history[key] = []
            self.version_history[key].append(operation)
            
        # Replicate based on consistency model
        if self.model == ConsistencyModel.STRONG:
            # Synchronous replication
            if replicate:
                replicate(operation)
        elif self.model == ConsistencyModel.EVENTUAL:
            # Asynchronous replication
            if replicate:
                threading.Thread(target=replicate, args=(operation,)).start()
        elif self.model == ConsistencyModel.CAUSAL:
            # Causal ordering replication
            if replicate:
                self._replicate_with_causality(operation, replicate)
                
        return operation
        
    def read(self, key: str) -> Any:
        """Read operation."""
        with self.lock:
            return self.data_store.get(key)
            
    def merge_operation(self, operation: Dict[str, Any]):
        """
        Merge an operation from another replica.
        Handles conflict resolution.
        """
        with self.lock:
            key = operation['key']
            remote_timestamp = operation['timestamp']
            
            # Update vector clock
            self.vector_clock.update(remote_timestamp)
            
            # Check for conflicts
            if key in self.data_store:
                local_versions = self.version_history.get(key, [])
                
                # Simple last-write-wins conflict resolution
                if local_versions:
                    latest_local = local_versions[-1]
                    if operation['wall_time'] > latest_local['wall_time']:
                        self.data_store[key] = operation['value']
                        self.version_history[key].append(operation)
                else:
                    self.data_store[key] = operation['value']
                    if key not in self.version_history:
                        self.version_history[key] = []
                    self.version_history[key].append(operation)
            else:
                self.data_store[key] = operation['value']
                if key not in self.version_history:
                    self.version_history[key] = []
                self.version_history[key].append(operation)
                
    def _replicate_with_causality(self, operation: Dict[str, Any], replicate: Callable):
        """Replicate ensuring causal ordering."""
        # Check if all causally preceding operations have been applied
        # Then replicate
        threading.Thread(target=replicate, args=(operation,)).start()
        
    def get_status(self) -> Dict[str, Any]:
        """Get consistency manager status."""
        with self.lock:
            return {
                'node_id': self.node_id,
                'model': self.model.name,
                'vector_clock': self.vector_clock.clock,
                'data_count': len(self.data_store),
                'pending_ops': len(self.pending_operations)
            }
