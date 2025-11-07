# Distributed Computing Concepts - Testing Guide

This document explains how to test the three distributed computing concepts implemented in the system.

## 1. Custom RMI (Remote Method Invocation)

### What it does:
- Allows servers to call methods on other servers remotely
- Uses pickle for serialization
- Works across Docker containers using service names

### How to test:

**Test RMI between servers:**
```bash
# From any server, test RMI calls to other servers
curl http://localhost:8001/dc/rmi/test
curl http://localhost:8002/dc/rmi/test
curl http://localhost:8003/dc/rmi/test
```

**Expected Response:**
```json
{
  "server_id": "app1",
  "rmi_calls": {
    "app2": {
      "status": "success",
      "courses_count": 0
    },
    "app3": {
      "status": "success",
      "courses_count": 0
    }
  },
  "timestamp": "2025-11-08T..."
}
```

**What to observe:**
- Each server successfully calls remote methods on other servers
- Course data can be accessed remotely
- RMI works across Docker network using service names

---

## 2. Lamport Logical Clock

### What it does:
- Provides logical timestamps for distributed events
- Maintains happened-before relationships
- Increments on local events and syncs on message receive

### How to test:

**Check current Lamport time:**
```bash
curl http://localhost:8001/dc/lamport
curl http://localhost:8002/dc/lamport
curl http://localhost:8003/dc/lamport
```

**Synchronize clocks (send timestamp from one server to another):**
```bash
# Get time from app1
TIME1=$(curl -s http://localhost:8001/dc/lamport | jq '.lamport_time')

# Update app2 with app1's time
curl -X POST http://localhost:8002/dc/lamport/sync \
  -H "Content-Type: application/json" \
  -d "{\"lamport_time\": $TIME1}"
```

**Perform operations and watch clocks increment:**
```bash
# Create a user (increments Lamport clock)
curl -X POST http://localhost:8001/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User",
    "role": "student"
  }'

# Check updated Lamport time
curl http://localhost:8001/dc/lamport
```

**View Lamport times in Admin Dashboard:**
- Open http://localhost:9090
- Login as admin
- See "Lamport Logical Clocks" graph
- Watch clocks increment in real-time

**What to observe:**
- Clock increments on every local operation
- Clock syncs when receiving messages (max(local, received) + 1)
- All servers maintain logical ordering of events
- Graph shows clock progression over time

---

## 3. Fault Tolerance Protocol (Heartbeat-based)

### What it does:
- Implements primary-backup replication
- Primary (app1) sends heartbeats every 2 seconds
- Backups (app2, app3) listen for heartbeats
- If 3 heartbeats missed → backup promotes to PRIMARY

### How to test:

**Check heartbeat status:**
```bash
curl http://localhost:8001/dc/heartbeat
curl http://localhost:8002/dc/heartbeat
curl http://localhost:8003/dc/heartbeat
```

**Expected Response (Primary):**
```json
{
  "server_id": "app1",
  "role": "PRIMARY",
  "running": true,
  "missed_heartbeats": 0,
  "last_heartbeat": null,
  "primary_host": null
}
```

**Expected Response (Backup):**
```json
{
  "server_id": "app2",
  "role": "BACKUP",
  "running": true,
  "missed_heartbeats": 0,
  "last_heartbeat": 1699445678.123,
  "primary_host": "app1"
}
```

**Test automatic failover:**

1. **Check initial roles:**
   ```bash
   curl http://localhost:8001/dc/heartbeat  # Should be PRIMARY
   curl http://localhost:8002/dc/heartbeat  # Should be BACKUP
   curl http://localhost:8003/dc/heartbeat  # Should be BACKUP
   ```

2. **Kill the primary server (app1):**
   ```bash
   docker stop dlh-app1
   ```

3. **Wait 6-8 seconds** (3 missed heartbeats × 2 seconds each)

4. **Check backup servers - one should be promoted:**
   ```bash
   curl http://localhost:8002/dc/heartbeat  # Might be PRIMARY now
   curl http://localhost:8003/dc/heartbeat  # Check this too
   ```

5. **Check Docker logs to see promotion:**
   ```bash
   docker logs dlh-app2 | tail -20
   # Should see: "PRIMARY FAILURE DETECTED! Promoting app2 to PRIMARY"
   ```

6. **Restart app1:**
   ```bash
   docker start dlh-app1
   # It will start as BACKUP now, not PRIMARY
   ```

7. **Verify new configuration:**
   ```bash
   curl http://localhost:8001/dc/heartbeat  # Now BACKUP
   curl http://localhost:8002/dc/heartbeat  # Now PRIMARY (if promoted)
   ```

**View FT status in Admin Dashboard:**
- Open http://localhost:9090
- Login as admin
- See "Server State & Roles" table
- FT Role column shows PRIMARY/BACKUP for each server
- Kill app1 and watch role changes in real-time

**What to observe:**
- Primary sends heartbeats every 2 seconds
- Backups detect missed heartbeats
- After 3 missed heartbeats (6 seconds), backup promotes to PRIMARY
- System continues operating with new primary
- When old primary restarts, it becomes a backup

---

## Testing All Three Together

**Complete Integration Test:**

1. **Start all services:**
   ```bash
   cd backend
   docker-compose up -d
   ```

2. **Open Admin Dashboard:**
   - Go to http://localhost:9090
   - Login with admin credentials
   - Observe all three DC concepts in action

3. **Perform operations:**
   ```bash
   # Create users (triggers Lamport clock increment)
   curl -X POST http://localhost:8000/auth/signup \
     -H "Content-Type: application/json" \
     -d '{
       "email": "user1@test.com",
       "password": "pass123",
       "name": "User One",
       "role": "student"
     }'
   ```

4. **Test RMI:**
   ```bash
   # Each server queries others via RMI
   curl http://localhost:8001/dc/rmi/test
   ```

5. **Simulate failure:**
   ```bash
   # Kill primary server
   docker stop dlh-app1
   
   # Wait 8 seconds
   
   # Check which backup became primary
   curl http://localhost:8002/dc/heartbeat
   curl http://localhost:8003/dc/heartbeat
   ```

6. **Watch the dashboard:**
   - Lamport clocks continue incrementing
   - Server states update (PRIMARY/BACKUP roles change)
   - Health status reflects server failures
   - System remains operational

---

## Monitoring Commands

**View all metrics:**
```bash
curl http://localhost:9000/metrics | jq
```

**View summary:**
```bash
curl http://localhost:9000/summary | jq
```

**View individual server health:**
```bash
curl http://localhost:8001/health | jq
curl http://localhost:8002/health | jq
curl http://localhost:8003/health | jq
```

**Watch logs in real-time:**
```bash
docker logs -f dlh-app1
docker logs -f dlh-app2
docker logs -f dlh-monitoring
```

---

## Expected Dashboard Views

The Admin Dashboard should show:

1. **Lamport Logical Clocks Graph**
   - Line chart showing clock values over time
   - Each server has its own line
   - Clocks increment on operations

2. **Server State & Roles Table**
   - Server ID column
   - Coordinator Role (LEADER/FOLLOWER)
   - FT Role (PRIMARY/BACKUP)
   - Health status (Healthy/Unhealthy)

3. **Server Health Cards**
   - Individual cards for each server
   - Shows Lamport time
   - Shows role
   - Updates every 3 seconds

4. **Real-time Metrics**
   - Response times
   - Request counts
   - Server availability percentage

---

## Troubleshooting

**RMI not working:**
- Check port 9001 is exposed
- Verify services can resolve each other's hostnames
- Check Docker network connectivity

**Lamport clock not incrementing:**
- Ensure operations are being performed
- Check server logs for errors
- Verify clock is initialized properly

**Heartbeat failover not working:**
- Ensure port 9002 is not blocked
- Check heartbeat interval (2 seconds)
- Verify UDP packets are being sent
- Wait full 6-8 seconds for 3 missed heartbeats

**Dashboard not updating:**
- Check monitoring service is running
- Verify frontend can reach monitoring service
- Check browser console for errors
- Ensure CORS is properly configured
