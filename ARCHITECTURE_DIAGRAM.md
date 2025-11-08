# System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           DISTRIBUTED LEARNING PLATFORM                     │
│                     Load Balancer + Application Servers                     │
└────────────────────────────────────────────────────────────────────────────┘

                              FRONTEND LAYER
┌──────────────────────────────────────────────────────────────────────────┐
│                         React Frontend (Port 9090)                        │
│                                                                           │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐      │
│  │  LoadBalancer    │  │  AppServerStats  │  │  LamportClock    │      │
│  │     Chart        │  │    Component     │  │     Chart        │      │
│  │  (Connections)   │  │  (TCP Stats)     │  │ (Synchronization)│      │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘      │
│         ↑                      ↑                      ↑                  │
│         │                      │                      │                  │
│         └──────────────────────┴──────────────────────┘                  │
│                                │                                          │
│                       Fetches data every 3s                               │
└───────────────────────────────┼──────────────────────────────────────────┘
                                │
                                ↓
                      MONITORING LAYER
┌──────────────────────────────────────────────────────────────────────────┐
│                    Monitoring Service (Port 9000)                         │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  MonitoringService Class                                        │    │
│  │  - Polls all services every 3 seconds                           │    │
│  │  - Aggregates metrics                                            │    │
│  │  - Exposes REST API                                              │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                           │
│  Endpoints:                                                               │
│  ✓ /metrics          - All service metrics                               │
│  ✓ /summary          - Health summary                                    │
│  ✓ /lb/metrics       - Load balancer detailed metrics                    │
│  ✓ /lb/connections   - Connection distribution                           │
└───────────────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┴───────────────┐
                │                               │
                ↓                               ↓
        LOAD BALANCER                    APP SERVERS
┌──────────────────────────┐    ┌────────────────────────────┐
│  Load Balancer (8000)    │    │  Application Servers       │
│                          │    │                            │
│  LeastConnectionsLB:     │    │  ┌──────────────────────┐ │
│  ┌────────────────────┐  │    │  │ App1 (Ports 8001)   │ │
│  │ Connections Dict:  │  │    │  │ - HTTP: 8001        │ │
│  │ {                  │  │◄───┤  │ - TCP:  9001        │ │
│  │  "app1:8001": 2    │  │    │  │ - RMI:  9001        │ │
│  │  "app2:8002": 1    │  │    │  │ - Heartbeat: 9002   │ │
│  │  "app3:8003": 3    │  │    │  └──────────────────────┘ │
│  │ }                  │  │    │                            │
│  └────────────────────┘  │    │  ┌──────────────────────┐ │
│                          │    │  │ App2 (Ports 8002)   │ │
│  Selects: app2 (least)   │    │  │ - HTTP: 8002        │ │
│                          │    │  │ - TCP:  9002        │ │
│  ┌────────────────────┐  │    │  │ - RMI:  9001        │ │
│  │ Health Checker     │  │    │  │ - Heartbeat: 9002   │ │
│  │ - Polls every 5s   │  │    │  └──────────────────────┘ │
│  │ - Marks unhealthy  │  │    │                            │
│  │ - Auto failover    │  │    │  ┌──────────────────────┐ │
│  └────────────────────┘  │    │  │ App3 (Ports 8003)   │ │
│                          │    │  │ - HTTP: 8003        │ │
│  ┌────────────────────┐  │    │  │ - TCP:  9003        │ │
│  │ TCP Proxy          │  │    │  │ - RMI:  9001        │ │
│  │ - select() I/O     │  │    │  │ - Heartbeat: 9002   │ │
│  │ - Bidirectional    │  │    │  └──────────────────────┘ │
│  │ - Stream data      │  │    │                            │
│  └────────────────────┘  │    └────────────────────────────┘
└──────────────────────────┘                 │
         │                                   │
         │                                   │
         │                                   ↓
         │                    ┌────────────────────────────┐
         │                    │  ApplicationServer Class   │
         │                    │                            │
         │                    │  ┌──────────────────────┐ │
         │                    │  │ TCP Server          │ │
         │                    │  │ - Binds to 0.0.0.0  │ │
         │                    │  │ - Port: HTTP + 1000 │ │
         │                    │  │ - Spawns threads    │ │
         │                    │  └──────────────────────┘ │
         │                    │                            │
         │                    │  ┌──────────────────────┐ │
         │                    │  │ handle_client()     │ │
         │                    │  │ - Thread per client │ │
         │                    │  │ - JSON protocol     │ │
         │                    │  │ - Track connections │ │
         │                    │  └──────────────────────┘ │
         │                    │                            │
         │                    │  ┌──────────────────────┐ │
         │                    │  │ process_request()   │ │
         │                    │  │ - Lamport sync      │ │
         │                    │  │ - State detection   │ │
         │                    │  │ - RMI handling      │ │
         │                    │  └──────────────────────┘ │
         │                    └────────────────────────────┘
         │                                   │
         └───────────────────────────────────┘
                            │
                            ↓
                 ┌────────────────────┐
                 │   MongoDB Atlas    │
                 │                    │
                 │  Collections:      │
                 │  - users           │
                 │  - courses         │
                 │  - sessions        │
                 └────────────────────┘


═══════════════════════════════════════════════════════════════════════════
                              REQUEST FLOW
═══════════════════════════════════════════════════════════════════════════

1. CLIENT REQUEST
   ↓
   [Load Balancer Port 8000]
   ↓
2. GET LEAST CONNECTED SERVER
   Query connections dict: {"app1:8001": 2, "app2:8002": 1, "app3:8003": 3}
   Selected: app2 (minimum connections = 1)
   ↓
3. INCREMENT CONNECTION COUNT
   app2:8002: 1 → 2
   ↓
4. PROXY TO APP SERVER
   Forward request to app2:8002
   ↓
5. APP SERVER PROCESSING
   [ApplicationServer.handle_client()]
   - Receive request
   - Parse JSON
   - Check if state-modifying (create/update/delete)
   - Increment Lamport clock if needed
   - Process business logic
   - Generate response with timestamp
   ↓
6. RESPONSE BACK TO CLIENT
   [Load Balancer]
   - Forward response
   - Decrement connection count: app2:8002: 2 → 1
   ↓
7. MONITORING UPDATE
   [Monitoring Service polls every 3s]
   - Fetch /health from all servers
   - Fetch /lb/connections
   - Update metrics
   ↓
8. FRONTEND UPDATE
   [React components refresh every 3s]
   - Fetch from monitoring service
   - Update charts and graphs
   - Display real-time metrics


═══════════════════════════════════════════════════════════════════════════
                         DISTRIBUTED COMPUTING FEATURES
═══════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────┐
│                         LAMPORT CLOCK SYNCHRONIZATION                    │
│                                                                          │
│  Event Timeline:                                                         │
│                                                                          │
│  App1: 5 ──create──> 6 ──────────> 7 ──────────> 8                     │
│                       │                            │                     │
│                    send msg                     receive                  │
│                       │         (ts=6)             │                     │
│                       ↓                            ↓                     │
│  App2: 3 ──────────> 7 (max(3,6)+1) ──update──> 8                      │
│                                                    │                     │
│  Rule: Increment on local event                   │                     │
│  Rule: Update to max(local, received) + 1         │                     │
│                                                    ↓                     │
│  All events have causal ordering: 5 → 6 → 7 → 8                        │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                         HEARTBEAT FAULT TOLERANCE                        │
│                                                                          │
│  Normal Operation:                                                       │
│  App1 (PRIMARY) ─────heartbeat (every 2s)────→ App2, App3 (BACKUP)     │
│                                                                          │
│  Failure Detection:                                                      │
│  App1 (DOWN) ──✗ no heartbeat ✗──→ App2, App3                          │
│                                      │                                   │
│                         After 3 missed (6s)                              │
│                                      ↓                                   │
│                              App2 PROMOTED TO PRIMARY                    │
│                              App2 ─────heartbeat────→ App3               │
│                                                                          │
│  Recovery:                                                               │
│  App1 RESTARTED ────detect PRIMARY────→ Becomes BACKUP                  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                    REMOTE METHOD INVOCATION (RMI)                        │
│                                                                          │
│  App1 needs course data from App2:                                      │
│                                                                          │
│  App1 ─────RMI request (TCP 9001)─────→ App2                           │
│       ←────getCourses() result─────────                                 │
│                                                                          │
│  Cross-server method calls without direct HTTP                          │
└─────────────────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════════
                            KEY METRICS TRACKED
═══════════════════════════════════════════════════════════════════════════

Load Balancer:
  ✓ Active connections per server
  ✓ Total requests handled
  ✓ Server health status
  ✓ Algorithm: Least Connections
  ✓ Response times

Application Servers:
  ✓ Active TCP connections
  ✓ Total requests processed
  ✓ Lamport clock value
  ✓ PRIMARY/BACKUP role
  ✓ Uptime
  ✓ Database connection status

Frontend Dashboard:
  ✓ Real-time connection distribution chart
  ✓ Server health indicators
  ✓ Load percentage per server
  ✓ Lamport clock synchronization graph
  ✓ Fault tolerance status
  ✓ Activity logs


═══════════════════════════════════════════════════════════════════════════
                               DOCKER SETUP
═══════════════════════════════════════════════════════════════════════════

Network: dlnet (bridge)
  │
  ├── Frontend (dlh-frontend)         → Port 9090
  ├── Load Balancer (dlh-load-balancer) → Port 8000
  ├── Monitoring (dlh-monitoring)     → Port 9000
  ├── App1 (dlh-app1)                → Ports 8001, 9101, 9102
  ├── App2 (dlh-app2)                → Ports 8002, 9201, 9202
  └── App3 (dlh-app3)                → Ports 8003, 9301, 9302

All services can communicate using hostnames: app1, app2, app3, load_balancer


═══════════════════════════════════════════════════════════════════════════
                              IMPLEMENTATION STATUS
═══════════════════════════════════════════════════════════════════════════

Backend:
  ✅ Load Balancer with Least Connections algorithm
  ✅ TCP socket-based Application Servers
  ✅ Thread-based concurrent client handling
  ✅ Lamport Clock synchronization
  ✅ Heartbeat Fault Tolerance
  ✅ RMI support
  ✅ Monitoring service integration
  ✅ REST API endpoints
  ✅ Docker containerization

Frontend:
  ✅ LoadBalancerChart component
  ✅ AppServerStats component
  ✅ Real-time data fetching (3s interval)
  ✅ Interactive visualizations
  ✅ Health status indicators
  ✅ Connection distribution graphs
  ✅ Lamport clock display
  ✅ Responsive design

Integration:
  ✅ Backend ↔ Monitoring ↔ Frontend data flow
  ✅ Real-time metric updates
  ✅ Automatic failover handling
  ✅ Cross-origin resource sharing (CORS)
  ✅ Docker networking

Documentation:
  ✅ Technical documentation (LOAD_BALANCER_APP_SERVER_DOCS.md)
  ✅ Quick Start Guide (QUICK_START_GUIDE.md)
  ✅ Implementation Summary (IMPLEMENTATION_SUMMARY.md)
  ✅ Architecture Diagram (ARCHITECTURE_DIAGRAM.md)
  ✅ Integration test script (test_integration.sh)

Status: ✅ PRODUCTION READY
```

## Visual Legend

```
┌─────┐  Rectangle with corners = Component/Service
│     │
└─────┘

─────→   Arrow = Data flow / Request
←─────

✓        Checkmark = Feature implemented
✗        X mark = Failure/Error
⚠        Warning = Alert/Issue
```
