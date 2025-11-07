"""
Lamport Logical Clock Implementation
Provides logical timestamps for distributed events.
"""
import threading


class LamportClock:
    """
    Implements Lamport's logical clock algorithm for ordering distributed events.
    
    Rules:
    1. Before each local event, increment the clock
    2. When sending a message, include the current timestamp
    3. When receiving a message, update clock to max(local, received) + 1
    """
    
    def __init__(self):
        self.timestamp = 0
        self.lock = threading.Lock()
    
    def increment_local(self):
        """
        Increment the clock for a local event.
        Called before any local operation.
        
        Returns:
            int: The new timestamp
        """
        with self.lock:
            self.timestamp += 1
            return self.timestamp
    
    def update_on_receive(self, external_ts):
        """
        Update clock when receiving a message from another process.
        Sets clock to max(local_time, received_time) + 1
        
        Args:
            external_ts (int): Timestamp received from another process
            
        Returns:
            int: The updated timestamp
        """
        with self.lock:
            self.timestamp = max(self.timestamp, external_ts) + 1
            return self.timestamp
    
    def get_time(self):
        """
        Get the current logical timestamp without incrementing.
        
        Returns:
            int: Current timestamp
        """
        with self.lock:
            return self.timestamp
    
    def set_time(self, new_time):
        """
        Manually set the clock time (useful for synchronization).
        
        Args:
            new_time (int): New timestamp value
        """
        with self.lock:
            self.timestamp = new_time
