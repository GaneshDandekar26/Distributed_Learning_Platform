# Distributed Logic Integration - Complete Implementation Guide

## 🎯 Overview

This document provides a comprehensive guide to the Distributed Logic Integration implemented in the Distributed Learning Platform. The implementation includes:

1. **Bully Election Algorithm** - Leader election for distributed coordination
2. **Inter-Server Messaging** - Communication with Lamport clock synchronization
3. **Fault Tolerance Integration** - Primary/Backup roles with automatic failover
4. **XML-RPC Monitoring** - Centralized metrics collection

---

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Bully Election Algorithm](#bully-election-algorithm)
3. [Inter-Server Messaging](#inter-server-messaging)
4. [Fault Tolerance Roles](#fault-tolerance-roles)
5. [XML-RPC Monitoring](#xml-rpc-monitoring)
6. [Frontend Dashboard](#frontend-dashboard)
7. [Port Configuration](#port-configuration)
8. [Testing Guide](#testing-guide)
9. [Troubleshooting](#troubleshooting)

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Admin Dashboard                          │
│  (React + TypeScript - Port 9090)                              │
│  - Bully Election Chart                                        │
│  - Messaging Panel                                             │
│  - FT Role Monitor                                             │
└───────────────┬─────────────────────────────────────────────────┘
                │ HTTP REST API
                ▼
┌─────────────────────────────────────────────────────────────────┐
│              Monitoring Service (Port 9005)                     │
│  - REST API: /election/status, /messages/all, /ft/roles       │
│  - XML-RPC Server (Port 9000): report_clock, report_status    │
└───────────────┬─────────────────────────────────────────────────┘
                │ XML-RPC + REST
                ▼
┌─────────────────────────────────────────────────────────────────┐
│            Application Servers (app1, app2, app3)               │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  HTTP API (8001, 8002, 8003)                            │  │
│  │  - /health, /election/status, /messages/send           │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Bully Election (UDP 9100)                              │  │
│  │  - ELECTION, OK, COORDINATOR messages                   │  │
│  │  - Highest rank becomes leader                          │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Inter-Server Messaging (TCP 9200)                      │  │
│  │  - send_discussion_message()                            │  │
│  │  - Lamport clock synchronization                        │  │
│  │  - Logs to /logs/messages_*.json                        │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Fault Tolerance (UDP 9002)                             │  │
│  │  - PRIMARY sends heartbeats (2s interval)               │  │
│  │  - BACKUP monitors, promotes on failure                 │  │
│  │  - Triggers Bully election                              │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Lamport Clock                                          │  │
│  │  - Increments on state changes                          │  │
│  │  - Synchronizes on message receive                      │  │
│  └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎖️ Bully Election Algorithm

### Overview

The Bully Election Algorithm ensures that the server with the highest rank becomes the coordinator (leader). When the current leader fails, any server can initiate an election.

### Implementation Details

#### File: `backend/DLH_Project/utils/bully_election.py`

**Key Features:**
- UDP-based communication on port 9100
- Automatic leader election on failure detection
- Election history tracking
- Thread-safe operations

**Message Types:**
1. **ELECTION** - Sent to higher-ranked servers to initiate election
2. **OK** - Response indicating a higher-ranked server is alive
3. **COORDINATOR** - Broadcast announcement of new leader

### Algorithm Flow

```
1. Server detects coordinator failure
   ↓
2. Server sends ELECTION to all higher-ranked servers
   ↓
3. Wait for OK responses (timeout: 3 seconds)
   ↓
4. If NO OK received:
   → Become COORDINATOR
   → Broadcast COORDINATOR message
   
5. If OK received:
   → Wait for COORDINATOR announcement
   → Update current_leader
```

### Server Rankings

```python
app1: rank = 1  (lowest priority)
app2: rank = 2  (medium priority)
app3: rank = 3  (highest priority, default leader)
```

### Integration with ApplicationServer

```python
# In app_server.py initialization
bully_election = BullyElection(
    server_id=SERVER_ID,
    port=9100,
    on_elected_leader=on_elected_leader
)
bully_election.start()

# Callback when elected as leader
def on_elected_leader():
    logger.info(f"🎖️  {SERVER_ID} ELECTED AS LEADER!")
    if heartbeat_protocol:
        heartbeat_protocol.promote_to_primary()
```

### REST API Endpoints

```
GET /election/status
    - Returns: Current leader, election in progress, history

GET /election/history
    - Returns: Election events with timestamps

POST /election/initiate
    - Manually trigger an election
```

### Testing Election

```bash
# Method 1: Stop current leader
docker stop dlh-app3

# Method 2: Trigger manual election
curl -X POST http://localhost:8001/election/initiate

# Method 3: View election status
curl http://localhost:9005/election/status
```

---

## 💬 Inter-Server Messaging

### Overview

Inter-Server Messaging enables servers to communicate with Lamport clock synchronization. All messages are logged for MapReduce analytics.

### Implementation Details

#### File: `backend/DLH_Project/utils/inter_server_messaging.py`

**Key Features:**
- TCP-based reliable messaging on port 9200
- Lamport timestamp attachment
- Message acknowledgment
- Persistent logging to `/logs/messages_*.json`

### Message Flow

```
Sender                          Receiver
  │                                │
  ├─ increment_local()            │
  │  (Lamport: t)                  │
  │                                │
  ├─────── TCP Message ──────────→│
  │  {sender, content, lamport_time: t} │
  │                                │
  │                          update_on_receive(t)
  │                          (Lamport: max(local, t) + 1)
  │                                │
  │←────── ACK {status: received} ─┤
  │                                │
```

### Usage Examples

**Send Message to Specific Server:**
```python
messaging_system.send_discussion_message(
    msg="Hello from app1",
    target_server="app2",
    message_type="discussion"
)
```

**Broadcast to All Servers:**
```python
results = messaging_system.broadcast_message(
    msg="System update notification",
    message_type="broadcast"
)
```

### REST API Endpoints

```
POST /messages/send
    Body: {
        "target_server": "app2",
        "message": "Hello",
        "message_type": "discussion"
    }

POST /messages/broadcast
    Body: {
        "message": "Broadcast message",
        "message_type": "broadcast"
    }

GET /messages/all?limit=100
    - Returns: All messages sorted by Lamport timestamp

GET /messages/stats
    - Returns: Message statistics (sent, received, total)
```

### Message Log Format

```json
{
    "direction": "sent",
    "timestamp": 1699471234.567,
    "datetime": "2024-11-08T10:30:00",
    "type": "inter_server_message",
    "sender": "app1",
    "content": "Hello from app1",
    "lamport_time": 145,
    "message_type": "discussion"
}
```

### Testing Messaging

```bash
# Send message from app1 to app2
curl -X POST http://localhost:8001/messages/send \
  -H "Content-Type: application/json" \
  -d '{
    "target_server": "app2",
    "message": "Test message",
    "message_type": "test"
  }'

# Broadcast message
curl -X POST http://localhost:8001/messages/broadcast \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Broadcast test",
    "message_type": "announcement"
  }'

# View all messages
curl http://localhost:9005/messages/all
```

---

## 🛡️ Fault Tolerance Roles

### Overview

Fault Tolerance is achieved through Primary-Backup replication with heartbeat monitoring and automatic failover.

### Integration with Bully Election

```
Failure Detection (FT) ──→ Trigger Bully Election ──→ New Leader
         │                          │                      │
         │                          │                      │
    Heartbeat                 Election              Promote to
    Timeout                   Process               PRIMARY
    (3 missed)                (UDP 9100)            Role
```

### Failover Sequence

```
1. PRIMARY (app1) fails
   ↓
2. BACKUP (app2, app3) detect missed heartbeats (6 seconds)
   ↓
3. BACKUP with highest rank (app3) initiates Bully Election
   ↓
4. app3 sends ELECTION to higher servers (none exist)
   ↓
5. app3 becomes COORDINATOR (no OK received)
   ↓
6. app3 promotes to PRIMARY
   ↓
7. app3 starts sending heartbeats
   ↓
8. System recovered with new PRIMARY
```

### Role Determination

```python
# Initial configuration (in app_server.py)
primary_server = 'app1'  # Initially PRIMARY
role = 'PRIMARY' if SERVER_ID == primary_server else 'BACKUP'

# On PRIMARY failure callback
def on_become_primary():
    logger.info(f"⚡ {SERVER_ID} PROMOTED TO PRIMARY!")
    if bully_election:
        bully_election.initiate_election()
```

### REST API Endpoints

```
GET /ft/roles
    - Returns: FT roles for all servers

GET /health
    - Includes: fault_tolerance status with role info
```

---

## 📊 XML-RPC Monitoring

### Overview

XML-RPC server runs on port 9000, collecting metrics from all application servers every 5 seconds.

### Implementation Details

#### File: `backend/DLH_Project/services/monitoring_service.py`

**XML-RPC Methods:**

1. **report_clock(server_id, lamport_time)**
   - Reports Lamport clock value
   - Returns: Acknowledgment string

2. **report_status(server_id, leader_id, ft_role)**
   - Reports election and FT status
   - Returns: Acknowledgment string

3. **report_load(server_id, active_connections)**
   - Reports server load
   - Returns: Acknowledgment string

4. **report_consistency(server_id, status)**
   - Reports consistency model status
   - Returns: Acknowledgment string

### Client Implementation

```python
# In ApplicationServer class
def _report_metrics_loop(self):
    self.monitoring_client = xmlrpc.client.ServerProxy(
        'http://monitoring:9000',
        allow_none=True
    )
    
    while self.running:
        try:
            # Report metrics
            lamport_time = self.clock.get_time()
            self.monitoring_client.report_clock(self.server_id, lamport_time)
            
            leader_id = self.election.get_leader()
            ft_role = self.heartbeat.role
            self.monitoring_client.report_status(self.server_id, leader_id, ft_role)
            
            # ... more reports
            
        except Exception as e:
            logger.error(f"Failed to report metrics: {e}")
        
        time.sleep(5)  # Report every 5 seconds
```

### REST API Endpoints (Monitoring Service)

```
GET /xmlrpc/metrics
    - Returns: All metrics collected via XML-RPC

GET /election/status
    - Aggregates election status from all servers

GET /messages/all
    - Aggregates messages from all servers

GET /ft/roles
    - Aggregates FT roles from all servers
```

---

## 🎨 Frontend Dashboard

### Components

#### 1. BullyElectionChart
**File:** `frontend/src/components/BullyElectionChart.tsx`

**Features:**
- Current leader display with crown icon
- Server rankings bar chart
- Election history timeline
- Election in progress indicator
- Server status grid

**Data Source:** `GET /election/status`

#### 2. MessagingPanel
**File:** `frontend/src/components/MessagingPanel.tsx`

**Features:**
- Message statistics cards
- Sent vs received distribution chart
- Message timeline with Lamport timestamps
- Message flow patterns visualization
- Send/receive indicators

**Data Sources:**
- `GET /messages/all`
- `GET /messages/stats`

#### 3. FTRoleMonitor
**File:** `frontend/src/components/FTRoleMonitor.tsx`

**Features:**
- PRIMARY server highlight
- System health overview
- Failover status indicator
- Role distribution pie chart
- Server FT status grid
- Heartbeat and election details

**Data Sources:**
- `GET /ft/roles`
- `GET /election/status`
- `GET /metrics`

### Dashboard Layout

The AdminDashboard uses tabs to organize all distributed computing features:

```tsx
<Tabs defaultValue="election">
  <TabsList>
    <TabsTrigger value="election">Bully Election</TabsTrigger>
    <TabsTrigger value="messaging">Messaging</TabsTrigger>
    <TabsTrigger value="ft">FT Roles</TabsTrigger>
    <TabsTrigger value="lamport">Lamport</TabsTrigger>
    <TabsTrigger value="servers">Servers</TabsTrigger>
  </TabsList>
  
  <TabsContent value="election">
    <BullyElectionChart />
  </TabsContent>
  
  <!-- Other tabs -->
</Tabs>
```

---

## 🔌 Port Configuration

### Complete Port Mapping

| Service | Port | Protocol | Purpose |
|---------|------|----------|---------|
| **Frontend** | 9090 | HTTP | React dashboard |
| **Load Balancer** | 8000 | TCP | Request distribution |
| **Monitoring REST API** | 9005 | HTTP | Metrics endpoints |
| **Monitoring XML-RPC** | 9000 | XML-RPC | Metrics collection |
| **App Server 1 HTTP** | 8001 | HTTP | REST API |
| **App Server 1 TCP** | 9001 | TCP | Application server |
| **App Server 1 RMI** | 13001 | TCP | Remote Method Invocation |
| **App Server 1 Heartbeat** | 9002 | UDP | FT heartbeats |
| **App Server 1 Election** | 9100 | UDP | Bully election |
| **App Server 1 Messaging** | 9200 | TCP | Inter-server messages |
| **App Server 2 HTTP** | 8002 | HTTP | REST API |
| **App Server 2 TCP** | 9002 (host) | TCP | Application server |
| **App Server 2 RMI** | 13002 | TCP | Remote Method Invocation |
| **App Server 2 Heartbeat** | 9003 (host) | UDP | FT heartbeats |
| **App Server 2 Election** | 9101 (host) | UDP | Bully election |
| **App Server 2 Messaging** | 9201 (host) | TCP | Inter-server messages |
| **App Server 3 HTTP** | 8003 | HTTP | REST API |
| **App Server 3 TCP** | 9003 (host) | TCP | Application server |
| **App Server 3 RMI** | 13003 | TCP | Remote Method Invocation |
| **App Server 3 Heartbeat** | 9004 (host) | UDP | FT heartbeats |
| **App Server 3 Election** | 9102 (host) | UDP | Bully election |
| **App Server 3 Messaging** | 9202 (host) | TCP | Inter-server messages |

### Docker Compose Configuration

```yaml
services:
  monitoring_service:
    ports:
      - "9000:9000"  # XML-RPC
      - "9005:9005"  # REST API
  
  app1:
    ports:
      - "8001:8001"   # HTTP API
      - "9001:9001"   # TCP Application Server
      - "13001:13001" # RMI
      - "9002:9002"   # Heartbeat FT
      - "9100:9100"   # Bully Election
      - "9200:9200"   # Inter-Server Messaging
    volumes:
      - app1_logs:/logs
```

---

## 🧪 Testing Guide

### 1. Start All Services

```bash
cd backend
docker-compose down
docker-compose build
docker-compose up -d
```

### 2. Verify Services are Running

```bash
docker ps
# Should see: dlh-frontend, dlh-load-balancer, dlh-monitoring, dlh-app1, dlh-app2, dlh-app3
```

### 3. Test Bully Election

**View Current Leader:**
```bash
curl http://localhost:9005/election/status | jq
```

**Trigger Manual Election:**
```bash
curl -X POST http://localhost:8001/election/initiate
```

**Simulate Leader Failure:**
```bash
# Stop app3 (highest rank, likely current leader)
docker stop dlh-app3

# Wait 10 seconds, then check new leader
sleep 10
curl http://localhost:9005/election/status | jq

# Restart app3
docker start dlh-app3
```

### 4. Test Inter-Server Messaging

**Send Message:**
```bash
curl -X POST http://localhost:8001/messages/send \
  -H "Content-Type: application/json" \
  -d '{
    "target_server": "app2",
    "message": "Hello from app1",
    "message_type": "test"
  }'
```

**Broadcast Message:**
```bash
curl -X POST http://localhost:8001/messages/broadcast \
  -H "Content-Type: application/json" \
  -d '{
    "message": "System broadcast test",
    "message_type": "announcement"
  }'
```

**View Messages:**
```bash
curl http://localhost:9005/messages/all | jq
```

**Check Message Stats:**
```bash
curl http://localhost:9005/messages/stats | jq
```

### 5. Test Fault Tolerance

**Check Current FT Roles:**
```bash
curl http://localhost:9005/ft/roles | jq
```

**Simulate PRIMARY Failure:**
```bash
# Stop app1 (initial PRIMARY)
docker stop dlh-app1

# Wait for failover (6 seconds for 3 missed heartbeats)
sleep 10

# Check new PRIMARY
curl http://localhost:9005/ft/roles | jq

# Restart app1
docker start dlh-app1
```

### 6. Test XML-RPC Monitoring

**View Collected Metrics:**
```bash
curl http://localhost:9005/xmlrpc/metrics | jq
```

### 7. Frontend Dashboard Testing

1. Open browser: http://localhost:9090
2. Login as admin
3. Navigate to Admin Dashboard
4. Verify all tabs are working:
   - **Bully Election** tab - Shows current leader, rankings, history
   - **Messaging** tab - Shows message flow, statistics
   - **FT Roles** tab - Shows PRIMARY/BACKUP status
   - **Lamport** tab - Shows clock synchronization
   - **Servers** tab - Shows server details and activity

### 8. Integration Test Script

Create `test_distributed_integration.sh`:

```bash
#!/bin/bash

echo "=== Distributed Integration Test Suite ==="
echo ""

echo "1. Testing Election Status..."
curl -s http://localhost:9005/election/status | jq '.app1.current_leader'

echo ""
echo "2. Sending Inter-Server Message..."
curl -s -X POST http://localhost:8001/messages/send \
  -H "Content-Type: application/json" \
  -d '{
    "target_server": "app2",
    "message": "Integration test message",
    "message_type": "test"
  }' | jq '.success'

echo ""
echo "3. Checking Message Stats..."
curl -s http://localhost:9005/messages/stats | jq '.app1.total_sent'

echo ""
echo "4. Checking FT Roles..."
curl -s http://localhost:9005/ft/roles | jq '.app1.role'

echo ""
echo "5. Checking XML-RPC Metrics..."
curl -s http://localhost:9005/xmlrpc/metrics | jq 'keys'

echo ""
echo "=== All Tests Completed ==="
```

Run it:
```bash
chmod +x test_distributed_integration.sh
./test_distributed_integration.sh
```

---

## 🔧 Troubleshooting

### Common Issues

#### 1. Election Not Working

**Symptoms:**
- No leader elected
- Election messages not received

**Solutions:**
```bash
# Check UDP port 9100 is open
docker exec dlh-app1 netstat -an | grep 9100

# Check election logs
docker logs dlh-app1 | grep -i "election"

# Manually trigger election
curl -X POST http://localhost:8001/election/initiate
```

#### 2. Messages Not Being Sent

**Symptoms:**
- Message send fails
- No messages in logs

**Solutions:**
```bash
# Check TCP port 9200 is listening
docker exec dlh-app1 netstat -an | grep 9200

# Check message logs exist
docker exec dlh-app1 ls -la /logs/

# Test direct connection
telnet localhost 9200
```

#### 3. XML-RPC Connection Failed

**Symptoms:**
- "Failed to report metrics via XML-RPC" errors

**Solutions:**
```bash
# Check monitoring service is running
docker logs dlh-monitoring | grep "XML-RPC"

# Verify port 9000 is accessible
curl -X POST http://localhost:9000 \
  -H "Content-Type: text/xml" \
  -d '<?xml version="1.0"?><methodCall><methodName>system.listMethods</methodName></methodCall>'
```

#### 4. Frontend Not Showing Data

**Symptoms:**
- Empty graphs
- "Error fetching data" messages

**Solutions:**
```bash
# Check monitoring URL in frontend env
echo $VITE_MONITORING_URL  # Should be http://localhost:9005

# Test monitoring endpoints
curl http://localhost:9005/election/status
curl http://localhost:9005/messages/all
curl http://localhost:9005/ft/roles

# Check browser console for CORS errors
# Open DevTools → Console
```

### Debug Commands

```bash
# View all logs for a service
docker logs -f dlh-app1

# Execute commands inside container
docker exec -it dlh-app1 /bin/bash

# Check network connectivity between containers
docker exec dlh-app1 ping app2

# View Docker network
docker network inspect backend_dlnet

# Restart specific service
docker restart dlh-app2

# View resource usage
docker stats

# Check volumes
docker volume ls
docker volume inspect backend_app1_logs
```

---

## 📈 Performance Metrics

### Expected Performance

- **Election Time:** < 5 seconds
- **Message Latency:** < 100ms
- **Failover Time:** < 10 seconds (3 missed heartbeats at 2s interval)
- **Lamport Clock Sync:** Real-time (< 10ms)
- **XML-RPC Report Interval:** 5 seconds
- **Frontend Refresh Rate:** 3 seconds

### Monitoring Metrics

```bash
# Check Lamport clock values
curl http://localhost:9005/xmlrpc/metrics | jq '.app1.lamport_time'

# Check message counts
curl http://localhost:9005/messages/stats | jq '.app1.total_messages'

# Check election history
curl http://localhost:9005/election/history | jq '.app1.history | length'
```

---

## 🎓 Learning Outcomes

This implementation demonstrates:

1. **Leader Election** - Bully algorithm with UDP communication
2. **Logical Clocks** - Lamport timestamps for event ordering
3. **Fault Tolerance** - Primary-backup with heartbeat detection
4. **Inter-Process Communication** - TCP/UDP sockets, XML-RPC
5. **Distributed Coordination** - Election integration with FT
6. **Real-Time Monitoring** - Metrics collection and visualization
7. **Frontend Integration** - React dashboard with real-time updates

---

## 📝 Next Steps

1. **MapReduce Analytics** - Process message logs for insights
2. **Causal Ordering** - Implement vector clocks
3. **Consensus Algorithms** - Add Raft or Paxos
4. **Data Replication** - Implement state machine replication
5. **Performance Testing** - Load testing with concurrent elections

---

## 📚 References

- [Bully Election Algorithm](https://en.wikipedia.org/wiki/Bully_algorithm)
- [Lamport Clocks](https://lamport.azurewebsites.net/pubs/time-clocks.pdf)
- [Fault Tolerance Patterns](https://martinfowler.com/articles/patterns-of-distributed-systems/)
- [XML-RPC Specification](http://xmlrpc.com/spec.md)

---

**Document Version:** 1.0  
**Last Updated:** November 8, 2024  
**Author:** Distributed Learning Platform Team
