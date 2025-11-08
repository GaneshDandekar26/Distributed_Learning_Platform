#!/bin/bash

# Integration Test Script for Load Balancer and Application Servers
# This script tests the complete integration between frontend and backend

echo "================================================"
echo "Integration Test: Load Balancer & App Servers"
echo "================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

# Function to test endpoint
test_endpoint() {
    local name=$1
    local url=$2
    local expected_status=${3:-200}
    
    echo -n "Testing $name... "
    response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)
    
    if [ "$response" = "$expected_status" ]; then
        echo -e "${GREEN}✓ PASSED${NC} (HTTP $response)"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAILED${NC} (Expected $expected_status, got $response)"
        ((TESTS_FAILED++))
        return 1
    fi
}

# Function to test JSON response
test_json_endpoint() {
    local name=$1
    local url=$2
    local json_key=$3
    
    echo -n "Testing $name... "
    response=$(curl -s "$url" 2>/dev/null)
    
    if echo "$response" | grep -q "\"$json_key\""; then
        echo -e "${GREEN}✓ PASSED${NC} (Contains '$json_key')"
        ((TESTS_PASSED++))
        
        # Display some data
        if command -v jq &> /dev/null; then
            echo "$response" | jq -r ".$json_key" | head -3
        fi
        return 0
    else
        echo -e "${RED}✗ FAILED${NC} (Missing '$json_key')"
        ((TESTS_FAILED++))
        return 1
    fi
}

echo "=== 1. Testing Load Balancer ==="
echo ""

test_endpoint "Load Balancer Health" "http://localhost:8000/health"
test_json_endpoint "Load Balancer Status" "http://localhost:8000/lb/status" "connections"
test_json_endpoint "Load Balancer Connections" "http://localhost:8000/lb/connections" "connections"
test_json_endpoint "Load Balancer Metrics" "http://localhost:8000/lb/metrics" "servers"

echo ""
echo "=== 2. Testing Application Servers ==="
echo ""

for i in 1 2 3; do
    port=$((8000 + i))
    echo "--- App Server $i (Port $port) ---"
    test_endpoint "App$i Health" "http://localhost:$port/health"
    test_json_endpoint "App$i Server Stats" "http://localhost:$port/server/stats" "active_connections"
    test_json_endpoint "App$i Info" "http://localhost:$port/info" "lamport_clock"
    echo ""
done

echo "=== 3. Testing Monitoring Service ==="
echo ""

test_endpoint "Monitoring Health" "http://localhost:9000/health"
test_json_endpoint "All Metrics" "http://localhost:9000/metrics" "app1"
test_json_endpoint "Summary Stats" "http://localhost:9000/summary" "total_services"
test_json_endpoint "LB Metrics via Monitor" "http://localhost:9000/lb/metrics" "connections"
test_json_endpoint "LB Connections via Monitor" "http://localhost:9000/lb/connections" "connections"

echo ""
echo "=== 4. Testing Load Distribution ==="
echo ""

echo "Sending 10 requests through load balancer..."
for i in {1..10}; do
    curl -s "http://localhost:8000/health" > /dev/null 2>&1
    sleep 0.1
done

echo "Checking connection distribution..."
connections=$(curl -s "http://localhost:8000/lb/connections" 2>/dev/null)

if command -v jq &> /dev/null; then
    echo "$connections" | jq '.connections'
    
    # Count total connections
    total=$(echo "$connections" | jq '.total_requests')
    echo -e "${YELLOW}Total requests handled: $total${NC}"
fi

echo ""
echo "=== 5. Testing Proxied Requests ==="
echo ""

# Test proxied course endpoint
test_endpoint "Proxied /courses endpoint" "http://localhost:8000/courses"
test_endpoint "Proxied /info endpoint" "http://localhost:8000/info"

echo ""
echo "=== 6. Testing Distributed Computing Features ==="
echo ""

test_json_endpoint "Lamport Clock (App1)" "http://localhost:8001/dc/lamport" "lamport_time"
test_json_endpoint "Heartbeat Status (App1)" "http://localhost:8001/dc/heartbeat" "server_id"

echo ""
echo "=== 7. Frontend Integration Check ==="
echo ""

# Check if frontend is accessible
test_endpoint "Frontend Homepage" "http://localhost:9090" 200

echo ""
echo "================================================"
echo "Test Summary"
echo "================================================"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed! Integration is working correctly.${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed. Please check the logs above.${NC}"
    echo ""
    echo "Troubleshooting steps:"
    echo "1. Check if all containers are running: docker ps"
    echo "2. Check container logs: docker logs dlh-load-balancer"
    echo "3. Restart services: docker-compose restart"
    exit 1
fi
