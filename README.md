# Distributed LearnHub

## Project Structure

```
DISTRIBUTED_LEARNING_PLATFORM/
│
├── frontend/          # React + TypeScript frontend application
│   ├── src/          # Source code
│   ├── public/       # Static assets
│   ├── Dockerfile    # Frontend container config
│   └── ...
│
├── backend/           # Distributed Python backend system
│   ├── DLH_Project/  # Main backend application
│   │   ├── services/     # Microservices (load balancer, monitoring, app servers)
│   │   ├── utils/        # Distributed system utilities
│   │   ├── analytics/    # MapReduce and dashboard
│   │   └── client/       # Test clients
│   ├── docker-compose.yml  # Container orchestration
│   └── README.md          # Backend documentation
│
└── README.md         # This file
```

## Architecture Overview

### Services
- **Frontend** (Port 5173): React + TypeScript SPA
- **Load Balancer** (Port 8000): Round-robin load balancing across app servers
- **Monitoring Service** (Port 9000): Real-time health monitoring and metrics
- **App Servers** (Ports 8001-8003): 3 replicated backend servers with MongoDB
- **Analytics Dashboard** (Port 8501): Streamlit dashboard for system visualization

### Key Features
- ✅ **Load Balancing**: Automatic traffic distribution across 3 app servers
- ✅ **Health Monitoring**: Real-time server health tracking with auto-recovery
- ✅ **MongoDB Integration**: User authentication with signup/signin
- ✅ **Fault Tolerance**: System continues operating even if servers fail
- ✅ **Real-time Dashboard**: Live server status visualization
- ✅ **Distributed Systems Concepts**: Lamport clocks, consistency protocols, MapReduce

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for local frontend development)
- Python 3.11+ (for local backend development)

### Run Complete System with Docker

1. **Clone the repository**
   ```bash
   git clone https://github.com/GaneshDandekar26/Distributed_Learning_Platform.git
   cd Distributed_Learning_Platform
   ```

2. **Start all services**
   ```bash
   cd backend
   docker-compose up --build
   ```

3. **Access the application**
   - Frontend: http://localhost:5173
   - Load Balancer: http://localhost:8000
   - Monitoring API: http://localhost:9000
   - Analytics Dashboard: http://localhost:8501
   - App Servers: http://localhost:8001, 8002, 8003

4. **Create an account**
   - Go to http://localhost:5173
   - Click "Sign Up"
   - Fill in your details and select a role (Student/Teacher/Admin)
   - Sign in with your credentials

5. **Access Admin Dashboard** (requires admin role)
   - Sign in as admin
   - View real-time server monitoring
   - Test fault tolerance by stopping servers

### Testing Fault Tolerance

Stop one or more app servers to see load balancer in action:

```bash
# Stop app1
docker stop dlh-app1

# Watch the admin dashboard - app1 will show as "down"
# Load balancer automatically redirects traffic to app2 and app3

# Restart app1
docker start dlh-app1

# App1 will rejoin the cluster automatically
```

### Local Development

#### Frontend
```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:9090
```

#### Backend (Individual Services)
```bash
cd backend/DLH_Project
pip install -r requirements.txt

# Run load balancer
python -m services.load_balancer

# Run monitoring service
python -m services.monitoring_service

# Run app server
PORT=8001 SERVER_ID=app1 python -m services.app_server
```

## Project info

A modern distributed learning platform with real-time whiteboard collaboration, chat with Lamport timestamps, and comprehensive distributed systems monitoring.

## How can I edit this code?

**Use your preferred IDE**

Clone this repo and push changes using your preferred development environment.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone https://github.com/GaneshDandekar26/Distributed_Learning_Platform.git

# Step 2: Navigate to the project directory.
cd Distributed_Learning_Platform

# Step 3: Start with Docker (Recommended)
cd backend
docker-compose up --build

# OR run frontend locally:
cd frontend
npm install
npm run dev

# OR run backend services locally:
cd backend/DLH_Project
pip install -r requirements.txt
python main.py
```

## API Endpoints

### Authentication
- `POST /auth/signup` - Register new user
- `POST /auth/signin` - User login
- `POST /auth/logout` - User logout

### Courses
- `GET /courses` - List all courses
- `POST /courses` - Create new course
- `GET /courses/:id` - Get course details

### Monitoring
- `GET /metrics` - Get all service metrics
- `GET /summary` - Get system health summary
- `GET /health` - Health check

### Load Balancer
- `GET /status` - Load balancer status
- `GET /health` - Health check
- All other routes are proxied to app servers

## Environment Variables

### Frontend (.env)
```
VITE_API_URL=http://localhost:8000
VITE_MONITORING_URL=http://localhost:9000
```

### Backend (.env)
```
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/?appName=DLH
SERVER_ID=app1
PORT=8001
```

## Database

This project uses **MongoDB Atlas** for data persistence:
- User accounts and authentication
- Course information
- Session management

The MongoDB connection string is configured in docker-compose.yml and can be overridden with environment variables.

## Troubleshooting

### Port already in use
```bash
# Find process using port
lsof -i :8000
# Kill process
kill -9 <PID>
```

### Docker issues
```bash
# Stop all containers
docker-compose down

# Remove all containers and volumes
docker-compose down -v

# Rebuild from scratch
docker-compose up --build --force-recreate
```

### Frontend not connecting to backend
- Check if load balancer is running: http://localhost:8000/health
- Check if monitoring service is running: http://localhost:9000/health
- Verify environment variables in frontend/.env

### MongoDB connection issues
- Verify MongoDB Atlas connection string
- Check if IP address is whitelisted in MongoDB Atlas
- Ensure network connectivity

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

**Frontend:**
- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- React Router

**Backend:**
- Python 3.11
- Flask (Load Balancer, Monitoring, App Servers)
- MongoDB Atlas (Database)
- Streamlit (Analytics Dashboard)
- Docker & Docker Compose

**Distributed Systems:**
- Round-robin load balancing
- Health monitoring and auto-recovery
- Fault tolerance
- Lamport logical clocks
- Consistency protocols
- MapReduce analytics

## Testing the System

### 1. Test User Authentication
```bash
# Sign up a new user
curl -X POST http://localhost:8000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123","name":"Test User","role":"student"}'

# Sign in
curl -X POST http://localhost:8000/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
```

### 2. Test Load Balancer
```bash
# Check load balancer status
curl http://localhost:8000/status

# Make multiple requests - watch them distribute across servers
for i in {1..10}; do
  curl http://localhost:8000/health
  echo ""
done
```

### 3. Test Monitoring
```bash
# Get all metrics
curl http://localhost:9000/metrics

# Get system summary
curl http://localhost:9000/summary

# Get history for a specific service
curl http://localhost:9000/history?service=app1
```

### 4. Test Fault Tolerance
```bash
# Stop one server
docker stop dlh-app1

# Check monitoring - app1 should show as down
curl http://localhost:9000/metrics

# System should still work through app2 and app3
curl http://localhost:8000/health

# Restart server
docker start dlh-app1

# Watch it rejoin the cluster
curl http://localhost:9000/metrics
```

## Docker Commands

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# View logs for specific service
docker-compose logs -f load_balancer

# Stop all services
docker-compose down

# Restart a specific service
docker-compose restart app1

# Scale app servers (experimental)
docker-compose up -d --scale app1=2

# Remove all containers and volumes
docker-compose down -v
```

## Project Highlights

### Distributed Systems Concepts Implemented
1. **Load Balancing** - Round-robin algorithm with health checks
2. **Fault Tolerance** - System continues operating with server failures
3. **Service Discovery** - Automatic detection of healthy servers
4. **Health Monitoring** - Real-time metrics collection
5. **Data Replication** - MongoDB handles data consistency
6. **Lamport Clocks** - Logical ordering for distributed events
7. **Consistency Protocols** - Eventual consistency model

### Admin Dashboard Features
- Real-time server health visualization
- Request distribution charts
- Lamport clock timeline
- Server state monitoring
- Fault tolerance testing interface
- System metrics and analytics

## How can I deploy this project?

You can deploy this project using various hosting services like Vercel, Netlify, or any other platform that supports Vite applications.

Build the project with `npm run build` and deploy the `dist` folder.
