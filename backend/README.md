# Distributed LearnHub - Backend

## Overview

This is the distributed backend system for the Distributed Learning Hub platform. It implements a microservices architecture with various distributed systems concepts including:

- **Distributed Services**: Multiple independent services communicating via RPC and WebSockets
- **Lamport Timestamps**: Logical clocks for message ordering in distributed chat
- **Consistency Protocols**: Strong, eventual, and causal consistency models
- **Distributed Locking**: Ricart-Agrawala algorithm for mutual exclusion
- **MapReduce Analytics**: Distributed data processing for analytics
- **Real-time Collaboration**: WebSocket-based chat and whiteboard

## Architecture

```
Backend/
├── DLH_Project/
│   ├── services/          # Microservices
│   │   ├── api_gateway.py      # Central routing service
│   │   ├── auth_service.py     # Authentication & authorization
│   │   ├── course_service.py   # Course management
│   │   ├── chat_service.py     # Real-time chat with Lamport clocks
│   │   └── whiteboard_service.py # Collaborative whiteboard
│   │
│   ├── utils/             # Distributed system utilities
│   │   ├── logger.py           # Distributed logging
│   │   ├── distributed_lock.py # Mutual exclusion
│   │   └── consistency.py      # Consistency protocols
│   │
│   ├── analytics/         # Data processing & visualization
│   │   ├── mapreduce.py        # MapReduce jobs
│   │   └── dashboard.py        # Streamlit dashboard
│   │
│   └── client/            # Test clients
│       └── test_client.py      # Service testing utilities
│
└── docker-compose.yml     # Container orchestration
```

## Services

### 1. API Gateway (Port 5000)
- Central entry point for all requests
- Service discovery and routing
- Load balancing

### 2. Authentication Service (Port 5001)
- User registration and login
- Session management
- XML-RPC based

### 3. Course Service (Port 5002)
- Course creation and management
- Student enrollment
- XML-RPC based

### 4. Chat Service (Port 5003)
- Real-time messaging
- Lamport clock timestamps
- WebSocket based

### 5. Whiteboard Service (Port 5004)
- Collaborative drawing
- Real-time synchronization
- WebSocket based

### 6. Analytics Dashboard (Port 8501)
- Real-time metrics visualization
- System health monitoring
- Streamlit based

## Setup & Installation

### Prerequisites
- Python 3.11+
- Docker & Docker Compose (for containerized deployment)
- pip

### Local Development

1. **Install Dependencies**
   ```bash
   cd backend/DLH_Project
   pip install -r requirements.txt
   ```

2. **Run All Services**
   ```bash
   python main.py
   ```

3. **Run Individual Services**
   ```bash
   # API Gateway
   python -m services.api_gateway
   
   # Auth Service
   python -m services.auth_service
   
   # Course Service
   python -m services.course_service
   
   # Chat Service
   python -m services.chat_service
   
   # Whiteboard Service
   python -m services.whiteboard_service
   ```

4. **Run Analytics Dashboard**
   ```bash
   streamlit run analytics/dashboard.py
   ```

5. **Test Services**
   ```bash
   python -m client.test_client
   ```

### Docker Deployment

1. **Build and Start All Services**
   ```bash
   cd backend
   docker-compose up --build
   ```

2. **Stop All Services**
   ```bash
   docker-compose down
   ```

3. **View Logs**
   ```bash
   docker-compose logs -f [service-name]
   ```

## Service Endpoints

### API Gateway
- HTTP: `http://localhost:5000`

### Auth Service (XML-RPC)
- `register_user(username, password, role)`
- `login(username, password)`
- `logout(session_id)`
- `validate_session(session_id)`

### Course Service (XML-RPC)
- `create_course(course_id, course_data)`
- `get_course(course_id)`
- `list_courses()`
- `enroll_student(course_id, student_id)`
- `get_student_courses(student_id)`

### Chat Service (WebSocket)
- Connect: `ws://localhost:5003`
- Send: `{user_id, content, room_id}`
- Receive: `{id, user_id, content, room_id, lamport_time, wall_time}`

### Whiteboard Service (WebSocket)
- Connect: `ws://localhost:5004`
- Join: `{action: 'join', room_id}`
- Draw: `{action: 'draw', points, color, width}`
- Clear: `{action: 'clear', room_id}`

## Distributed Systems Concepts

### 1. Lamport Logical Clocks
- Implemented in `chat_service.py`
- Ensures causal ordering of messages
- Each message tagged with Lamport timestamp

### 2. Distributed Locking
- Ricart-Agrawala algorithm in `utils/distributed_lock.py`
- Prevents race conditions
- Ensures mutual exclusion across nodes

### 3. Consistency Models
- Strong consistency for critical operations
- Eventual consistency for collaborative features
- Causal consistency with vector clocks

### 4. MapReduce Analytics
- User activity analysis
- Course engagement metrics
- Chat message analytics

## Development

### Adding a New Service

1. Create service file in `services/`
2. Implement service class with `start()` and `stop()` methods
3. Add service to `docker-compose.yml`
4. Update `main.py` to start the service

### Running Tests

```bash
# Test individual services
python -m client.test_client

# Run with coverage
pytest --cov=DLH_Project tests/
```

## Monitoring

- **Analytics Dashboard**: http://localhost:8501
- **Service Health**: Check individual service logs
- **Metrics**: Available via API Gateway `/metrics` endpoint

## Troubleshooting

### Services won't start
- Check if ports are already in use
- Verify Python version (3.11+)
- Ensure all dependencies are installed

### WebSocket connection issues
- Verify firewall settings
- Check WebSocket URL format
- Ensure service is running

### Docker issues
- Run `docker-compose down -v` to clean volumes
- Rebuild with `docker-compose up --build --force-recreate`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - See LICENSE file for details
