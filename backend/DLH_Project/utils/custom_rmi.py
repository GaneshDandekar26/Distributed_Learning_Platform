"""
Custom RMI (Remote Method Invocation) System
Allows methods to be called on remote objects across Docker containers.
"""
import pickle
import socket
import threading
import logging

logger = logging.getLogger(__name__)


class RemoteCourseStub:
    """
    Client-side stub for remote method invocation.
    Serializes method calls and sends them to remote servers.
    """
    
    def __init__(self, host, port=9001):
        """
        Initialize the RMI stub.
        
        Args:
            host (str): Remote server hostname (e.g., 'app1', 'app2', 'app3')
            port (int): RMI port (default: 9001)
        """
        self.host = host
        self.port = port
    
    def remote_call(self, method_name, *args, **kwargs):
        """
        Invoke a method on the remote server.
        
        Args:
            method_name (str): Name of the method to call
            *args: Positional arguments for the method
            **kwargs: Keyword arguments for the method
            
        Returns:
            The result of the remote method call
            
        Raises:
            Exception: If the remote call fails
        """
        try:
            # Prepare the request
            request = {
                'method_name': method_name,
                'args': args,
                'kwargs': kwargs
            }
            
            # Serialize the request
            serialized_request = pickle.dumps(request)
            
            # Connect to remote server
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
                sock.settimeout(5.0)  # 5 second timeout
                sock.connect((self.host, self.port))
                
                # Send request length first (4 bytes)
                request_length = len(serialized_request)
                sock.sendall(request_length.to_bytes(4, byteorder='big'))
                
                # Send the serialized request
                sock.sendall(serialized_request)
                
                # Receive response length (4 bytes)
                response_length_bytes = sock.recv(4)
                response_length = int.from_bytes(response_length_bytes, byteorder='big')
                
                # Receive the serialized response
                serialized_response = b''
                while len(serialized_response) < response_length:
                    chunk = sock.recv(min(4096, response_length - len(serialized_response)))
                    if not chunk:
                        break
                    serialized_response += chunk
                
                # Deserialize the response
                response = pickle.loads(serialized_response)
                
                # Check if there was an error
                if response.get('error'):
                    raise Exception(f"Remote error: {response['error']}")
                
                return response.get('result')
                
        except Exception as e:
            logger.error(f"RMI call to {self.host}:{self.port} failed: {e}")
            raise
    
    def get_courses(self):
        """Get all courses from remote server."""
        return self.remote_call('get_courses')
    
    def get_course_by_id(self, course_id):
        """Get a specific course by ID."""
        return self.remote_call('get_course_by_id', course_id)
    
    def create_course(self, course_data):
        """Create a new course on remote server."""
        return self.remote_call('create_course', course_data)
    
    def update_course(self, course_id, course_data):
        """Update an existing course."""
        return self.remote_call('update_course', course_id, course_data)
    
    def delete_course(self, course_id):
        """Delete a course."""
        return self.remote_call('delete_course', course_id)


class RMIDispatcher:
    """
    Server-side RMI dispatcher.
    Accepts connections, deserializes requests, invokes methods, and returns results.
    """
    
    def __init__(self, service_object, host='0.0.0.0', port=9001):
        """
        Initialize the RMI dispatcher.
        
        Args:
            service_object: Object whose methods will be invoked remotely
            host (str): Host to bind to (default: '0.0.0.0')
            port (int): Port to listen on (default: 9001)
        """
        self.service_object = service_object
        self.host = host
        self.port = port
        self.running = False
        self.server_socket = None
    
    def start(self):
        """Start the RMI dispatcher in a background thread."""
        self.running = True
        thread = threading.Thread(target=self._listen, daemon=True)
        thread.start()
        logger.info(f"RMI Dispatcher started on {self.host}:{self.port}")
    
    def stop(self):
        """Stop the RMI dispatcher."""
        self.running = False
        if self.server_socket:
            self.server_socket.close()
        logger.info("RMI Dispatcher stopped")
    
    def _listen(self):
        """Listen for incoming RMI requests."""
        try:
            self.server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self.server_socket.bind((self.host, self.port))
            self.server_socket.listen(5)
            self.server_socket.settimeout(1.0)  # Check running flag every second
            
            logger.info(f"RMI Dispatcher listening on {self.host}:{self.port}")
            
            while self.running:
                try:
                    client_socket, address = self.server_socket.accept()
                    # Handle each request in a separate thread
                    thread = threading.Thread(
                        target=self._handle_request,
                        args=(client_socket, address),
                        daemon=True
                    )
                    thread.start()
                except socket.timeout:
                    continue
                except Exception as e:
                    if self.running:
                        logger.error(f"Error accepting connection: {e}")
                    
        except Exception as e:
            logger.error(f"RMI Dispatcher error: {e}")
        finally:
            if self.server_socket:
                self.server_socket.close()
    
    def _handle_request(self, client_socket, address):
        """
        Handle a single RMI request.
        
        Args:
            client_socket: Socket connection to the client
            address: Client address
        """
        try:
            # Receive request length (4 bytes)
            request_length_bytes = client_socket.recv(4)
            if not request_length_bytes:
                return
            
            request_length = int.from_bytes(request_length_bytes, byteorder='big')
            
            # Receive the serialized request
            serialized_request = b''
            while len(serialized_request) < request_length:
                chunk = client_socket.recv(min(4096, request_length - len(serialized_request)))
                if not chunk:
                    break
                serialized_request += chunk
            
            # Deserialize the request
            request = pickle.loads(serialized_request)
            
            method_name = request.get('method_name')
            args = request.get('args', ())
            kwargs = request.get('kwargs', {})
            
            logger.info(f"RMI call from {address}: {method_name}")
            
            # Invoke the method
            try:
                if not hasattr(self.service_object, method_name):
                    raise AttributeError(f"Method '{method_name}' not found")
                
                method = getattr(self.service_object, method_name)
                result = method(*args, **kwargs)
                
                response = {
                    'result': result,
                    'error': None
                }
            except Exception as e:
                logger.error(f"Error executing {method_name}: {e}")
                response = {
                    'result': None,
                    'error': str(e)
                }
            
            # Serialize the response
            serialized_response = pickle.dumps(response)
            
            # Send response length first (4 bytes)
            response_length = len(serialized_response)
            client_socket.sendall(response_length.to_bytes(4, byteorder='big'))
            
            # Send the serialized response
            client_socket.sendall(serialized_response)
            
        except Exception as e:
            logger.error(f"Error handling RMI request from {address}: {e}")
        finally:
            client_socket.close()


class CourseService:
    """
    Example service object that can be accessed via RMI.
    This would be instantiated on each app server.
    """
    
    def __init__(self, db_collection):
        """
        Initialize the course service.
        
        Args:
            db_collection: MongoDB collection for courses
        """
        self.courses = db_collection
    
    def get_courses(self):
        """Get all courses."""
        from bson import ObjectId
        courses = list(self.courses.find())
        for course in courses:
            course['_id'] = str(course['_id'])
        return courses
    
    def get_course_by_id(self, course_id):
        """Get a course by ID."""
        from bson import ObjectId
        course = self.courses.find_one({'_id': ObjectId(course_id)})
        if course:
            course['_id'] = str(course['_id'])
        return course
    
    def create_course(self, course_data):
        """Create a new course."""
        result = self.courses.insert_one(course_data)
        return str(result.inserted_id)
    
    def update_course(self, course_id, course_data):
        """Update an existing course."""
        from bson import ObjectId
        result = self.courses.update_one(
            {'_id': ObjectId(course_id)},
            {'$set': course_data}
        )
        return result.modified_count > 0
    
    def delete_course(self, course_id):
        """Delete a course."""
        from bson import ObjectId
        result = self.courses.delete_one({'_id': ObjectId(course_id)})
        return result.deleted_count > 0
