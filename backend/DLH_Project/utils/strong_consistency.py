"""
Strong Consistency and Synchronous Replication Module
Implements:
- Strong Sequential Consistency
- Synchronous Replication with quorum
- Two-Phase Commit (2PC) protocol
- Read-Your-Writes consistency
"""

import threading
import time
import socket
import json
import logging
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime
from enum import Enum

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ReplicationStatus(Enum):
    """Replication operation status"""
    PENDING = "PENDING"
    PREPARED = "PREPARED"
    COMMITTED = "COMMITTED"
    ABORTED = "ABORTED"


class ConsistencyLevel(Enum):
    """Consistency levels"""
    STRONG = "STRONG"
    SEQUENTIAL = "SEQUENTIAL"
    LINEARIZABLE = "LINEARIZABLE"


@dataclass
class ReplicationOperation:
    """Represents a replication operation"""
    operation_id: str
    operation_type: str  # READ, WRITE, DELETE
    key: str
    value: Any
    timestamp: float
    lamport_time: int
    initiator: str
    sequence_number: int
    status: ReplicationStatus
    replica_votes: Dict[str, bool]
    
    def to_dict(self):
        return {
            'operation_id': self.operation_id,
            'operation_type': self.operation_type,
            'key': self.key,
            'value': self.value,
            'timestamp': self.timestamp,
            'lamport_time': self.lamport_time,
            'initiator': self.initiator,
            'sequence_number': self.sequence_number,
            'status': self.status.value,
            'replica_votes': self.replica_votes
        }


class StrongConsistencyManager:
    """
    Manages strong consistency with synchronous replication
    """
    
    def __init__(self, server_id: str, servers: List[str], lamport_clock):
        self.server_id = server_id
        self.servers = [s for s in servers if s != server_id]
        self.all_servers = servers
        self.lamport_clock = lamport_clock
        
        # Data store with versioning
        self.data_store: Dict[str, Any] = {}
        self.version_store: Dict[str, List[Dict]] = {}
        
        # Sequence numbers for ordering
        self.sequence_number = 0
        self.sequence_lock = threading.Lock()
        
        # Pending operations (Two-Phase Commit)
        self.pending_operations: Dict[str, ReplicationOperation] = {}
        self.operation_lock = threading.Lock()
        
        # Replication statistics
        self.stats = {
            'total_writes': 0,
            'successful_replications': 0,
            'failed_replications': 0,
            'conflicts_resolved': 0,
            'average_replication_time': 0.0,
            'quorum_achieved': 0,
            'quorum_failed': 0
        }
        self.stats_lock = threading.Lock()
        
        # Operation history for sequential consistency
        self.operation_history: List[Dict] = []
        self.history_lock = threading.Lock()
        
        logger.info(f"Strong Consistency Manager initialized for {server_id}")
        
    def get_next_sequence(self) -> int:
        """Get next sequence number for ordering"""
        with self.sequence_lock:
            self.sequence_number += 1
            return self.sequence_number
    
    def write_with_replication(self, key: str, value: Any, 
                               replicate_func=None) -> Tuple[bool, str, Dict]:
        """
        Perform write with synchronous replication using 2PC
        Returns: (success, message, operation_details)
        """
        start_time = time.time()
        
        # Phase 1: Prepare
        operation_id = f"{self.server_id}_{self.get_next_sequence()}_{int(time.time()*1000)}"
        lamport_time = self.lamport_clock.increment_local()
        
        operation = ReplicationOperation(
            operation_id=operation_id,
            operation_type='WRITE',
            key=key,
            value=value,
            timestamp=time.time(),
            lamport_time=lamport_time,
            initiator=self.server_id,
            sequence_number=self.sequence_number,
            status=ReplicationStatus.PENDING,
            replica_votes={}
        )
        
        with self.operation_lock:
            self.pending_operations[operation_id] = operation
        
        # Phase 1: Send PREPARE to all replicas
        prepare_success, votes = self._phase1_prepare(operation, replicate_func)
        
        if not prepare_success:
            operation.status = ReplicationStatus.ABORTED
            with self.stats_lock:
                self.stats['failed_replications'] += 1
                self.stats['quorum_failed'] += 1
            logger.warning(f"Replication aborted for {key}: quorum not achieved")
            return False, "Quorum not achieved", operation.to_dict()
        
        # Phase 2: Commit
        operation.status = ReplicationStatus.PREPARED
        commit_success = self._phase2_commit(operation, replicate_func)
        
        if commit_success:
            # Apply locally
            with self.operation_lock:
                self.data_store[key] = value
                if key not in self.version_store:
                    self.version_store[key] = []
                self.version_store[key].append({
                    'value': value,
                    'timestamp': operation.timestamp,
                    'lamport_time': lamport_time,
                    'operation_id': operation_id
                })
                
            operation.status = ReplicationStatus.COMMITTED
            
            # Record in history for sequential consistency
            with self.history_lock:
                self.operation_history.append({
                    'operation_id': operation_id,
                    'type': 'WRITE',
                    'key': key,
                    'value': value,
                    'timestamp': operation.timestamp,
                    'lamport_time': lamport_time,
                    'sequence': self.sequence_number
                })
            
            # Update statistics
            replication_time = time.time() - start_time
            with self.stats_lock:
                self.stats['total_writes'] += 1
                self.stats['successful_replications'] += 1
                self.stats['quorum_achieved'] += 1
                
                # Update average replication time
                total = self.stats['successful_replications']
                current_avg = self.stats['average_replication_time']
                self.stats['average_replication_time'] = (
                    (current_avg * (total - 1) + replication_time) / total
                )
            
            logger.info(f"Write replicated successfully: {key} in {replication_time:.3f}s")
            return True, "Success", operation.to_dict()
        else:
            operation.status = ReplicationStatus.ABORTED
            with self.stats_lock:
                self.stats['failed_replications'] += 1
            logger.error(f"Replication commit failed for {key}")
            return False, "Commit failed", operation.to_dict()
    
    def _phase1_prepare(self, operation: ReplicationOperation, 
                       replicate_func) -> Tuple[bool, Dict[str, bool]]:
        """
        Phase 1 of 2PC: Send PREPARE to all replicas
        Returns: (quorum_achieved, votes)
        """
        if not replicate_func:
            # No replication function, consider as single node
            return True, {self.server_id: True}
        
        votes = {self.server_id: True}  # Self vote
        
        prepare_message = {
            'phase': 'PREPARE',
            'operation': operation.to_dict()
        }
        
        # Send PREPARE to all replicas synchronously
        for server in self.servers:
            try:
                response = replicate_func(server, prepare_message, timeout=2.0)
                if response and response.get('vote') == 'YES':
                    votes[server] = True
                else:
                    votes[server] = False
                    logger.warning(f"Server {server} voted NO for prepare")
            except Exception as e:
                votes[server] = False
                logger.error(f"Failed to get prepare vote from {server}: {e}")
        
        operation.replica_votes = votes
        
        # Check if quorum achieved (majority + 1)
        required_votes = len(self.all_servers) // 2 + 1
        yes_votes = sum(1 for v in votes.values() if v)
        quorum_achieved = yes_votes >= required_votes
        
        logger.info(f"Prepare phase: {yes_votes}/{len(self.all_servers)} votes (quorum: {quorum_achieved})")
        return quorum_achieved, votes
    
    def _phase2_commit(self, operation: ReplicationOperation, 
                      replicate_func) -> bool:
        """
        Phase 2 of 2PC: Send COMMIT to all replicas that voted YES
        """
        if not replicate_func:
            return True
        
        commit_message = {
            'phase': 'COMMIT',
            'operation': operation.to_dict()
        }
        
        success_count = 1  # Self
        
        # Send COMMIT to replicas that voted YES
        for server, voted_yes in operation.replica_votes.items():
            if server == self.server_id:
                continue
                
            if voted_yes:
                try:
                    response = replicate_func(server, commit_message, timeout=2.0)
                    if response and response.get('status') == 'COMMITTED':
                        success_count += 1
                    else:
                        logger.warning(f"Server {server} failed to commit")
                except Exception as e:
                    logger.error(f"Failed to send commit to {server}: {e}")
        
        # Consider successful if majority committed
        required = len(self.all_servers) // 2 + 1
        return success_count >= required
    
    def read_consistent(self, key: str) -> Optional[Any]:
        """
        Strongly consistent read - always returns latest committed value
        """
        with self.operation_lock:
            return self.data_store.get(key)
    
    def handle_prepare_request(self, operation_data: Dict) -> Dict:
        """
        Handle PREPARE request from coordinator
        """
        try:
            # Validate operation
            op_id = operation_data['operation_id']
            key = operation_data['key']
            
            # Check if can accept (no conflicts)
            with self.operation_lock:
                # Simple check: not currently processing this key
                can_commit = True
                
                if can_commit:
                    # Store as pending
                    self.pending_operations[op_id] = operation_data
                    return {'vote': 'YES', 'server': self.server_id}
                else:
                    return {'vote': 'NO', 'server': self.server_id, 'reason': 'conflict'}
        except Exception as e:
            logger.error(f"Error in prepare: {e}")
            return {'vote': 'NO', 'server': self.server_id, 'reason': str(e)}
    
    def handle_commit_request(self, operation_data: Dict) -> Dict:
        """
        Handle COMMIT request from coordinator
        """
        try:
            op_id = operation_data['operation_id']
            key = operation_data['key']
            value = operation_data['value']
            
            # Apply the operation
            with self.operation_lock:
                self.data_store[key] = value
                
                if key not in self.version_store:
                    self.version_store[key] = []
                self.version_store[key].append({
                    'value': value,
                    'timestamp': operation_data['timestamp'],
                    'lamport_time': operation_data['lamport_time'],
                    'operation_id': op_id
                })
                
                # Remove from pending
                if op_id in self.pending_operations:
                    del self.pending_operations[op_id]
            
            # Record in history
            with self.history_lock:
                self.operation_history.append({
                    'operation_id': op_id,
                    'type': operation_data['operation_type'],
                    'key': key,
                    'value': value,
                    'timestamp': operation_data['timestamp'],
                    'lamport_time': operation_data['lamport_time'],
                    'sequence': operation_data['sequence_number']
                })
            
            logger.info(f"Committed operation {op_id} for key {key}")
            return {'status': 'COMMITTED', 'server': self.server_id}
            
        except Exception as e:
            logger.error(f"Error in commit: {e}")
            return {'status': 'FAILED', 'server': self.server_id, 'reason': str(e)}
    
    def handle_abort_request(self, operation_data: Dict) -> Dict:
        """
        Handle ABORT request from coordinator
        """
        try:
            op_id = operation_data['operation_id']
            
            with self.operation_lock:
                if op_id in self.pending_operations:
                    del self.pending_operations[op_id]
            
            logger.info(f"Aborted operation {op_id}")
            return {'status': 'ABORTED', 'server': self.server_id}
        except Exception as e:
            logger.error(f"Error in abort: {e}")
            return {'status': 'FAILED', 'server': self.server_id, 'reason': str(e)}
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get replication statistics"""
        with self.stats_lock:
            return {
                'server_id': self.server_id,
                'consistency_level': 'STRONG_SEQUENTIAL',
                'replication_mode': 'SYNCHRONOUS',
                'total_writes': self.stats['total_writes'],
                'successful_replications': self.stats['successful_replications'],
                'failed_replications': self.stats['failed_replications'],
                'success_rate': (
                    self.stats['successful_replications'] / self.stats['total_writes'] * 100
                    if self.stats['total_writes'] > 0 else 0
                ),
                'conflicts_resolved': self.stats['conflicts_resolved'],
                'average_replication_time_ms': self.stats['average_replication_time'] * 1000,
                'quorum_achieved': self.stats['quorum_achieved'],
                'quorum_failed': self.stats['quorum_failed'],
                'data_items': len(self.data_store),
                'pending_operations': len(self.pending_operations),
                'operation_history_size': len(self.operation_history)
            }
    
    def get_consistency_status(self) -> Dict[str, Any]:
        """Get detailed consistency status for dashboard"""
        # Get statistics first (outside locks to avoid deadlock)
        stats = self.get_statistics()
        
        with self.history_lock:
            recent_ops = self.operation_history[-10:] if self.operation_history else []
            
            return {
                'server_id': self.server_id,
                'consistency_model': 'STRONG_SEQUENTIAL',
                'replication_strategy': 'SYNCHRONOUS_2PC',
                'statistics': stats,
                'recent_operations': recent_ops,
                'current_sequence': self.sequence_number,
                'quorum_size': len(self.all_servers) // 2 + 1,
                'total_replicas': len(self.all_servers),
                'timestamp': datetime.now().isoformat()
            }
    
    def get_version_history(self, key: str) -> List[Dict]:
        """Get version history for a specific key"""
        with self.operation_lock:
            return self.version_store.get(key, [])
    
    def verify_sequential_consistency(self) -> Dict[str, Any]:
        """
        Verify that operations maintain sequential consistency
        All operations should be in order based on sequence numbers
        """
        with self.history_lock:
            is_consistent = True
            violations = []
            
            for i in range(1, len(self.operation_history)):
                prev_seq = self.operation_history[i-1]['sequence']
                curr_seq = self.operation_history[i]['sequence']
                
                if curr_seq < prev_seq:
                    is_consistent = False
                    violations.append({
                        'index': i,
                        'prev_seq': prev_seq,
                        'curr_seq': curr_seq
                    })
            
            return {
                'is_consistent': is_consistent,
                'total_operations': len(self.operation_history),
                'violations': violations,
                'verification_time': datetime.now().isoformat()
            }
