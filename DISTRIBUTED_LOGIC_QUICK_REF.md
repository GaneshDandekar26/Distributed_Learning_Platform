# Distributed Logic Integration - Quick Reference

## 🚀 Quick Start

### 1. Build and Start All Services

```bash
cd backend
docker-compose down
docker-compose build
docker-compose up -d
```

### 2. Verify Services

```bash
docker ps
# Should show: dlh-frontend, dlh-load-balancer, dlh-monitoring, dlh-app1, dlh-app2, dlh-app3
```

### 3. Run Integration Tests

```bash
cd backend
./test_distributed_logic.sh
```

### 4. Access Dashboard

Open browser: http://localhost:9090

Login and navigate to Admin Dashboard to see:
- **Bully Election** tab - Leader election status
- **Messaging** tab - Inter-server communication
- **FT Roles** tab - Fault tolerance monitoring  
- **Lamport** tab - Clock synchronization
- **Servers** tab - Server details

---

## 📡 Key Endpoints

### Monitoring Service (Port 9005)

```bash
# Election status
curl http://localhost:9005/election/status | jq

# Election history
curl http://localhost:9005/election/history | jq

# All messages
curl http://localhost:9005/messages/all | jq

# Message stats
curl http://localhost:9005/messages/stats | jq

# FT roles
curl http://localhost:9005/ft/roles | jq

# XML-RPC metrics
curl http://localhost:9005/xmlrpc/metrics | jq
```

### Application Servers

```bash
# Health check (includes Lamport, FT status)
curl http://localhost:8001/health | jq

# Server stats
curl http://localhost:8001/server/stats | jq

# Election status
curl http://localhost:8001/election/status | jq

# Trigger election
curl -X POST http://localhost:8001/election/initiate

# Send message
curl -X POST http://localhost:8001/messages/send \
  -H "Content-Type: application/json" \
  -d '{"target_server":"app2","message":"Hello","message_type":"test"}'

# Broadcast message
curl -X POST http://localhost:8001/messages/broadcast \
  -H "Content-Type: application/json" \
  -d '{"message":"Broadcast","message_type":"announcement"}'

# Get all messages
curl http://localhost:8001/messages/all | jq

# Get message stats
curl http://localhost:8001/messages/stats | jq
```

---

## 🧪 Testing Scenarios

### Test 1: Bully Election

```bash
# View current leader
curl http://localhost:9005/election/status | jq '.app1.current_leader'

# Stop highest ranked server (app3)
docker stop dlh-app3

# Wait for election
sleep 10

# Check new leader (should be app2)
curl http://localhost:9005/election/status | jq '.app1.current_leader'

# Restart app3
docker start dlh-app3
```

### Test 2: Inter-Server Messaging

```bash
# Send messages between servers
curl -X POST http://localhost:8001/messages/send \
  -H "Content-Type: application/json" \
  -d '{"target_server":"app2","message":"Test 1","message_type":"test"}'

curl -X POST http://localhost:8002/messages/send \
  -H "Content-Type: application/json" \
  -d '{"target_server":"app3","message":"Test 2","message_type":"test"}'

# View message flow
curl http://localhost:9005/messages/all | jq '.app1.messages[-5:]'

# Check Lamport timestamps
curl http://localhost:9005/messages/all | jq '.app1.messages[].lamport_time'
```

### Test 3: Fault Tolerance Failover

```bash
# Check initial roles
curl http://localhost:9005/ft/roles | jq

# Stop PRIMARY (app1)
docker stop dlh-app1

# Wait for failover (6 seconds for 3 missed heartbeats)
sleep 10

# Check new PRIMARY
curl http://localhost:9005/ft/roles | jq

# Check election was triggered
curl http://localhost:9005/election/history | jq

# Restart app1
docker start dlh-app1
```

### Test 4: XML-RPC Monitoring

```bash
# View all metrics reported via XML-RPC
curl http://localhost:9005/xmlrpc/metrics | jq

# Check specific server metrics
curl http://localhost:9005/xmlrpc/metrics | jq '.app1'

# Verify metrics update (wait 5 seconds and check again)
curl http://localhost:9005/xmlrpc/metrics | jq '.app1.lamport_time'
sleep 5
curl http://localhost:9005/xmlrpc/metrics | jq '.app1.lamport_time'
```

---

## 🔌 Port Reference

| Component | Port | Protocol | Purpose |
|-----------|------|----------|---------|
| Frontend | 9090 | HTTP | Dashboard UI |
| Load Balancer | 8000 | TCP | Request distribution |
| Monitoring REST | 9005 | HTTP | Metrics API |
| Monitoring XML-RPC | 9000 | XML-RPC | Metrics collection |
| App1 HTTP | 8001 | HTTP | REST API |
| App1 TCP | 9001 | TCP | Application server |
| App1 RMI | 13001 | TCP | Remote invocation |
| App1 Heartbeat | 9002 | UDP | FT monitoring |
| App1 Election | 9100 | UDP | Bully algorithm |
| App1 Messaging | 9200 | TCP | Inter-server comm |
| App2 HTTP | 8002 | HTTP | REST API |
| App3 HTTP | 8003 | HTTP | REST API |

---

## 📂 New Files Created

### Backend

1. **`backend/DLH_Project/utils/bully_election.py`**
   - Bully Election Algorithm implementation
   - UDP-based leader election
   - Election history tracking

2. **`backend/DLH_Project/utils/inter_server_messaging.py`**
   - Inter-server messaging with Lamport clocks
   - TCP-based reliable communication
   - Message logging to `/logs`

3. **`backend/DLH_Project/services/monitoring_service.py`** (updated)
   - XML-RPC server on port 9000
   - New REST endpoints for election, messaging, FT roles
   - Metrics aggregation from all servers

4. **`backend/DLH_Project/services/app_server.py`** (updated)
   - Integrated Bully Election
   - Integrated Inter-Server Messaging
   - XML-RPC metrics reporting
   - New endpoints for election and messaging

### Frontend

5. **`frontend/src/components/BullyElectionChart.tsx`**
   - Current leader display
   - Server rankings visualization
   - Election history timeline

6. **`frontend/src/components/MessagingPanel.tsx`**
   - Message flow visualization
   - Lamport timestamp display
   - Message statistics charts

7. **`frontend/src/components/FTRoleMonitor.tsx`**
   - PRIMARY/BACKUP role monitoring
   - Failover status indicators
   - System health overview

8. **`frontend/src/pages/AdminDashboard.tsx`** (updated)
   - Tabs integration for all DC features
   - Real-time updates every 3 seconds

### Documentation

9. **`DISTRIBUTED_LOGIC_INTEGRATION.md`**
   - Complete implementation guide
   - Architecture diagrams
   - Testing procedures
   - Troubleshooting guide

10. **`backend/test_distributed_logic.sh`**
    - Automated integration test suite
    - 30+ test cases
    - Color-coded pass/fail results

---

## 🐛 Troubleshooting

### Services not starting

```bash
# Check logs
docker logs dlh-app1
docker logs dlh-monitoring

# Restart services
docker-compose restart

# Rebuild if needed
docker-compose down
docker-compose build
docker-compose up -d
```

### Election not working

```bash
# Check UDP port 9100
docker exec dlh-app1 netstat -an | grep 9100

# View election logs
docker logs dlh-app1 | grep -i "election"

# Manually trigger
curl -X POST http://localhost:8001/election/initiate
```

### Messages not sending

```bash
# Check TCP port 9200
docker exec dlh-app1 netstat -an | grep 9200

# Check logs directory
docker exec dlh-app1 ls -la /logs/

# Test connection
curl -X POST http://localhost:8001/messages/send \
  -H "Content-Type: application/json" \
  -d '{"target_server":"app2","message":"Test","message_type":"test"}'
```

### Frontend not showing data

```bash
# Check monitoring URL
curl http://localhost:9005/health

# Test endpoints
curl http://localhost:9005/election/status
curl http://localhost:9005/messages/all
curl http://localhost:9005/ft/roles

# Check browser console for errors
```

---

## 📊 Features Implemented

✅ **Bully Election Algorithm**
- UDP-based communication
- Automatic leader election
- Election history tracking
- Integration with FT protocol

✅ **Inter-Server Messaging**
- TCP-based reliable messaging
- Lamport clock synchronization
- Message acknowledgment
- Persistent logging to `/logs`

✅ **Fault Tolerance Roles**
- PRIMARY/BACKUP architecture
- Heartbeat monitoring (2s interval)
- Automatic failover (6s detection)
- Election trigger on failure

✅ **XML-RPC Monitoring**
- Centralized metrics collection
- 5-second reporting interval
- Clock, status, load, consistency reporting
- REST API for aggregated data

✅ **Frontend Dashboard**
- Real-time visualizations
- Tabbed interface
- Election status charts
- Message flow diagrams
- FT role monitoring
- 3-second refresh rate

---

## 🎓 Distributed Computing Concepts Covered

1. **Leader Election** - Bully Algorithm
2. **Logical Clocks** - Lamport Timestamps
3. **Fault Tolerance** - Primary-Backup with Heartbeats
4. **Inter-Process Communication** - TCP/UDP Sockets, XML-RPC
5. **Distributed Coordination** - Election + FT Integration
6. **Event Ordering** - Causality with Lamport Clocks
7. **Monitoring & Observability** - Real-time metrics collection

---

## 📖 Documentation

- **Full Documentation**: `DISTRIBUTED_LOGIC_INTEGRATION.md`
- **Testing Guide**: `backend/test_distributed_logic.sh`
- **Architecture**: See diagrams in main documentation
- **API Reference**: Endpoint listings in documentation

---

## 🔗 Related Files

- Load Balancer: `backend/DLH_Project/services/load_balancer.py`
- Lamport Clock: `backend/DLH_Project/utils/lamport_clock.py`
- Heartbeat Protocol: `backend/DLH_Project/utils/ft_protocol.py`
- RMI Dispatcher: `backend/DLH_Project/utils/custom_rmi.py`
- Docker Compose: `backend/docker-compose.yml`

---

**For detailed information, see:** [DISTRIBUTED_LOGIC_INTEGRATION.md](./DISTRIBUTED_LOGIC_INTEGRATION.md)

**Quick Test:** Run `./backend/test_distributed_logic.sh`

**Dashboard:** http://localhost:9090
