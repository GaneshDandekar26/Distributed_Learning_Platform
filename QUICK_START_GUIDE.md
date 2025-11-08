# Quick Start Guide: Load Balancer & Application Servers

## Prerequisites
- Docker and Docker Compose installed
- Ports 8000-8003, 9000, 9090 available
- Internet connection for MongoDB Atlas

## Step 1: Build and Start Services

```bash
cd backend
docker-compose up --build -d
```

This will start:
- Load Balancer (port 8000)
- App Server 1 (port 8001)
- App Server 2 (port 8002)
- App Server 3 (port 8003)
- Monitoring Service (port 9000)
- Frontend (port 9090)

## Step 2: Verify Services are Running

```bash
docker ps
```

You should see all 6 containers running.

## Step 3: Run Integration Tests

```bash
chmod +x test_integration.sh
./test_integration.sh
```

Expected output: All tests should pass with green checkmarks.

## Step 4: Access the Admin Dashboard

1. Open browser: http://localhost:9090
2. Login with admin credentials
3. Navigate to Admin Dashboard

You should see:
- **Load Balancer Connection Distribution** chart
- **Application Server Statistics** with real-time connections
- Server health indicators
- Lamport clock synchronization
- Fault tolerance status

## Step 5: Test Load Balancing

### Test 1: Send Multiple Requests

```bash
# Send 20 requests through load balancer
for i in {1..20}; do
  curl http://localhost:8000/health
  echo ""
  sleep 0.5
done
```

### Test 2: Check Connection Distribution

```bash
curl http://localhost:8000/lb/connections | jq
```

You should see connections distributed across servers.

### Test 3: View in Dashboard

Refresh the Admin Dashboard and observe:
- Connection counts updating in real-time
- Load balancer chart showing distribution
- Each server handling requests

## Step 6: Test Fault Tolerance

### Simulate Server Failure

```bash
# Stop app server 1
docker stop dlh-app1

# Wait a few seconds for health checks
sleep 10

# Check load balancer status
curl http://localhost:8000/lb/status | jq

# Send requests - should go to app2/app3 only
for i in {1..5}; do
  curl http://localhost:8000/health
  sleep 0.5
done
```

### Observe Failover

In the Admin Dashboard, you should see:
- App1 marked as unhealthy (red)
- Load balancer routes traffic to app2 and app3
- Connection distribution updates automatically
- App2 or App3 promoted to PRIMARY (if app1 was primary)

### Restore Server

```bash
# Restart app1
docker start dlh-app1

# Wait for it to rejoin cluster
sleep 10

# Check status
curl http://localhost:8000/lb/status | jq
```

Dashboard should show app1 as healthy again.

## Step 7: Monitor Metrics

### Via API

```bash
# Get all metrics
curl http://localhost:9000/metrics | jq

# Get load balancer metrics
curl http://localhost:9000/lb/metrics | jq

# Get specific server stats
curl http://localhost:8001/server/stats | jq
```

### Via Dashboard

Navigate to different sections:
1. **Load Balancer Chart**: See real-time connection distribution
2. **App Server Stats**: View TCP connections per server
3. **Lamport Clock Chart**: Monitor logical clock synchronization
4. **DC Activity Log**: Track distributed computing events

## Step 8: Test TCP Application Server

### Python Test Client

```python
import socket
import json

def test_tcp_server(host='localhost', port=9001):
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.connect((host, port))
    
    # Send request
    request = {
        "action": "create",
        "lamport_time": 5,
        "data": {"test": "value"}
    }
    
    sock.sendall(json.dumps(request).encode())
    
    # Receive response
    response = sock.recv(4096)
    result = json.loads(response.decode())
    
    print("Response:", json.dumps(result, indent=2))
    
    sock.close()

test_tcp_server()
```

### Expected Response

```json
{
  "server_id": "app1",
  "lamport_time": 6,
  "timestamp": "2025-11-08T10:30:00",
  "action": "create",
  "result": {
    "message": "Action create processed"
  },
  "acknowledgment": "success"
}
```

## Troubleshooting

### Services Not Starting

```bash
# Check logs
docker logs dlh-load-balancer
docker logs dlh-app1
docker logs dlh-monitoring

# Restart specific service
docker-compose restart load_balancer
```

### Frontend Not Showing Data

```bash
# Check browser console for errors
# Verify CORS is enabled
# Check monitoring service is accessible
curl http://localhost:9000/health
```

### Load Balancer Shows All Servers Down

```bash
# Check if servers are reachable
docker exec dlh-load-balancer ping app1
docker exec dlh-load-balancer curl http://app1:8001/health
```

### Connection Counts Not Updating

```bash
# Restart load balancer
docker-compose restart load_balancer

# Clear browser cache and reload dashboard
```

## Viewing Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f load_balancer
docker-compose logs -f app1

# Last 50 lines
docker-compose logs --tail=50 load_balancer
```

## Stopping Services

```bash
# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v

# Stop specific service
docker-compose stop load_balancer
```

## Performance Testing

### Load Test with Apache Bench

```bash
# Install ab (Apache Bench)
sudo apt-get install apache2-utils

# Run load test (1000 requests, 10 concurrent)
ab -n 1000 -c 10 http://localhost:8000/health

# Check distribution after load test
curl http://localhost:8000/lb/connections | jq
```

### Expected Results
- Requests should be distributed evenly
- All servers should handle similar number of connections
- Response time should be consistent
- No connection errors

## Next Steps

1. ✅ System is running and load balanced
2. ✅ Fault tolerance is working
3. ✅ Monitoring is active
4. ✅ Frontend is integrated

Now you can:
- Add more application servers to the pool
- Implement custom business logic in app servers
- Create additional monitoring visualizations
- Test with real user traffic
- Deploy to production environment

## Key Features Summary

✅ **Least Connections Load Balancing** - Optimal request distribution
✅ **TCP Socket Servers** - High-performance connection handling
✅ **Thread-based Concurrency** - Multiple simultaneous clients
✅ **Lamport Clock Sync** - Distributed event ordering
✅ **Heartbeat Fault Tolerance** - Automatic failover
✅ **Real-time Monitoring** - Live metrics and visualization
✅ **Docker Containerization** - Easy deployment and scaling
✅ **Full Integration** - Backend ↔ Monitoring ↔ Frontend

## Support

For issues or questions:
1. Check the main documentation: `LOAD_BALANCER_APP_SERVER_DOCS.md`
2. Review container logs
3. Run integration tests
4. Check the DC_IMPLEMENTATION_SUMMARY.md for architecture details

Enjoy your distributed learning platform! 🚀
