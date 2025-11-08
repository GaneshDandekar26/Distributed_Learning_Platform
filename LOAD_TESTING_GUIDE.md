# 🧪 Load Balancing Testing Guide

## Quick Testing Steps to See Graphs Change

### **Step 1: Open Admin Dashboard** 🖥️

1. Open your browser
2. Go to: **http://localhost:9090**
3. Login as admin
4. Navigate to Admin Dashboard

You should see:
- Load Balancer Connection Distribution chart
- Application Server Statistics
- Real-time metrics (updates every 3 seconds)

---

### **Step 2: Generate Basic Load** ⚡

Open a new terminal and run:

```bash
cd /home/ganesh/Desktop/Distributed_Learning_Platform/backend

# Quick burst test (75 requests)
./generate_load.sh
```

**What to watch:**
- The bar chart will show connections distributed across servers
- Total requests counter will increase
- Load percentages will update

---

### **Step 3: Continuous Load Testing** 🔥

For continuous real-time updates, run:

```bash
cd /home/ganesh/Desktop/Distributed_Learning_Platform/backend

# Continuous load (Press Ctrl+C to stop)
./continuous_load.sh
```

**What you'll see:**
- Requests sent every 0.5 seconds
- Dashboard updates every 3 seconds
- Connection counts changing in real-time
- Load distribution across servers

---

### **Step 4: Test Specific Scenarios** 🎯

#### **Test 1: See Load Distribution**

```bash
# Send 50 quick requests
for i in {1..50}; do
  curl -s http://localhost:8000/health > /dev/null &
done

# Wait and check distribution
sleep 2
curl http://localhost:8000/lb/connections | jq
```

#### **Test 2: Check Lamport Clock Changes**

```bash
# Before
curl http://localhost:8001/dc/lamport | jq

# Send requests
for i in {1..20}; do
  curl -s http://localhost:8000/auth/signup -X POST \
    -H "Content-Type: application/json" \
    -d '{"email":"test'$i'@test.com","password":"test123","name":"Test User"}' > /dev/null
done

# After (should have increased)
curl http://localhost:8001/dc/lamport | jq
```

#### **Test 3: Monitor Server Stats**

```bash
# Watch app server 1 stats
watch -n 1 'curl -s http://localhost:8001/server/stats | jq'

# In another terminal, generate load
for i in {1..100}; do
  curl -s http://localhost:8000/health > /dev/null
  sleep 0.1
done
```

---

### **Step 5: Test Fault Tolerance** 🛡️

#### **Simulate Server Failure:**

```bash
# Stop app server 1
docker stop dlh-app1

# Wait 10 seconds for health checks to detect failure
sleep 10

# Check load balancer status (should show app1 as unhealthy)
curl http://localhost:8000/lb/status | jq

# Send requests (should go to app2 and app3 only)
for i in {1..20}; do
  curl -s http://localhost:8000/health
  sleep 0.5
done

# Check distribution (app1 should have 0 connections)
curl http://localhost:8000/lb/connections | jq
```

#### **Watch Dashboard During Failover:**
- App1 will turn RED (unhealthy)
- Load will redistribute to App2 and App3
- App2 or App3 will be promoted to PRIMARY

#### **Restore Server:**

```bash
# Restart app server 1
docker start dlh-app1

# Wait for it to rejoin
sleep 10

# Check status (should be healthy again)
curl http://localhost:8000/lb/status | jq
```

**Dashboard will show:**
- App1 turns GREEN (healthy)
- Load redistributes across all 3 servers
- Connection counts rebalance

---

### **Step 6: Advanced Load Testing** 🚀

#### **Multiple Concurrent Users:**

```bash
# Simulate 10 concurrent users for 30 seconds
for user in {1..10}; do
  (
    for i in {1..60}; do
      curl -s http://localhost:8000/health > /dev/null
      sleep 0.5
    done
  ) &
done

# Monitor in real-time
watch -n 1 'curl -s http://localhost:8000/lb/status | jq'
```

#### **Load Test with Apache Bench:**

```bash
# Install ab (Apache Bench) if not installed
# sudo apt-get install apache2-utils

# Run load test: 1000 requests, 10 concurrent
ab -n 1000 -c 10 http://localhost:8000/health

# Check distribution after test
curl http://localhost:8000/lb/connections | jq
```

---

## 📊 What to Look For in Dashboard

### **Load Balancer Connection Distribution Chart**
- **Bar Chart**: Shows active connections per server
- **Colors**: Different color for each server
- **Load %**: Percentage of total load per server
- **Updates**: Every 3 seconds

### **Application Server Statistics**
- **Health Indicators**: Green (UP) or Red (DOWN)
- **Active Connections**: Current TCP connections
- **Lamport Clock**: Logical timestamp (increases with operations)
- **Role**: PRIMARY (leader) or BACKUP (follower)
- **Load Bars**: Visual representation of load distribution

### **Expected Behavior**

1. **Even Distribution**: 
   - With least connections algorithm, load should be evenly distributed
   - Example: 33%, 33%, 34% across 3 servers

2. **Dynamic Updates**:
   - As you send requests, numbers update in real-time
   - Charts animate to show changes

3. **Fault Tolerance**:
   - When server goes down, it turns red
   - Load automatically redistributes to healthy servers
   - When server comes back, it rejoins the pool

---

## 🎬 Quick Demo Commands

### **Option 1: Quick Test (30 seconds)**
```bash
cd /home/ganesh/Desktop/Distributed_Learning_Platform/backend
./generate_load.sh
```

### **Option 2: Continuous Test (Run until stopped)**
```bash
cd /home/ganesh/Desktop/Distributed_Learning_Platform/backend
./continuous_load.sh
# Press Ctrl+C to stop
```

### **Option 3: Manual Control**
```bash
# Send 1 request at a time
curl http://localhost:8000/health

# Check status
curl http://localhost:8000/lb/status | jq

# Send 10 requests
for i in {1..10}; do curl -s http://localhost:8000/health; done

# Check distribution
curl http://localhost:8000/lb/connections | jq
```

---

## 🔍 Monitoring Commands

### **Watch Load Balancer Status**
```bash
watch -n 1 'curl -s http://localhost:8000/lb/status | jq'
```

### **Watch Connection Distribution**
```bash
watch -n 1 'curl -s http://localhost:8000/lb/connections | jq'
```

### **Watch App Server Stats**
```bash
# App1
watch -n 1 'curl -s http://localhost:8001/server/stats | jq'

# App2
watch -n 1 'curl -s http://localhost:8002/server/stats | jq'

# App3
watch -n 1 'curl -s http://localhost:8003/server/stats | jq'
```

### **Watch Lamport Clocks**
```bash
watch -n 1 'echo "App1: $(curl -s http://localhost:8001/dc/lamport | jq .lamport_time) | App2: $(curl -s http://localhost:8002/dc/lamport | jq .lamport_time) | App3: $(curl -s http://localhost:8003/dc/lamport | jq .lamport_time)"'
```

---

## 🎯 Success Indicators

✅ **Load Balancing is Working:**
- Requests distributed across all healthy servers
- No single server overloaded
- Connection counts relatively even

✅ **Frontend Integration Working:**
- Charts update every 3 seconds
- Bar heights change as load changes
- Health indicators show correct status

✅ **Fault Tolerance Working:**
- Unhealthy servers excluded from load balancing
- Automatic failover to healthy servers
- Seamless recovery when server returns

---

## 🐛 Troubleshooting

### **Dashboard Not Updating?**
```bash
# Check monitoring service
curl http://localhost:9000/lb/metrics | jq

# Check browser console for errors
# Clear browser cache and reload
```

### **Connections Always 0?**
This is normal for quick HTTP requests. They complete so fast that by the time the dashboard polls (every 3 seconds), connections are already closed.

To see active connections:
```bash
# Run continuous load in background
./continuous_load.sh &

# Check connections immediately
curl http://localhost:8000/lb/connections | jq
```

### **Servers Showing Down?**
```bash
# Check container status
docker ps | grep dlh

# Check logs
docker logs dlh-app1
docker logs dlh-load-balancer
```

---

## 📈 Expected Results

After running tests, you should see:

1. **Load Balancer Status:**
   ```json
   {
     "algorithm": "least_connections",
     "connections": {"app1:8001": 2, "app2:8002": 1, "app3:8003": 3},
     "health": {"app1:8001": true, "app2:8002": true, "app3:8003": true},
     "total_requests": 150
   }
   ```

2. **Dashboard Shows:**
   - Real-time bar chart with connection distribution
   - Server health indicators (all green)
   - Lamport clocks incrementing
   - Load percentages calculated

3. **Least Connections Working:**
   - Next request goes to server with minimum connections
   - Load evenly distributed over time

---

## 🎉 Quick Start

**Just run these 3 commands:**

```bash
# 1. Navigate to backend
cd /home/ganesh/Desktop/Distributed_Learning_Platform/backend

# 2. Open dashboard in browser
# http://localhost:9090 (login as admin)

# 3. Generate load
./continuous_load.sh
```

**Watch your dashboard update in real-time!** 🚀

---

*For more details, see: LOAD_BALANCER_README.md*
