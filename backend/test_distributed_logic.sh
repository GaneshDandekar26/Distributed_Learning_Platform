#!/bin/bash

# Distributed Logic Integration Test Script
# Tests Bully Election, Inter-Server Messaging, FT Roles, and XML-RPC Monitoring

set -e

MONITORING_URL="http://localhost:9005"
APP1_URL="http://localhost:8001"
APP2_URL="http://localhost:8002"
APP3_URL="http://localhost:8003"

echo "=========================================="
echo "  Distributed Logic Integration Tests"
echo "=========================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

test_count=0
pass_count=0
fail_count=0

# Test function
run_test() {
    local test_name="$1"
    local command="$2"
    local expected="$3"
    
    ((test_count++))
    echo -e "${BLUE}Test $test_count: $test_name${NC}"
    
    result=$(eval "$command" 2>&1)
    exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        if [ -z "$expected" ] || echo "$result" | grep -q "$expected"; then
            echo -e "${GREEN}✓ PASS${NC}"
            ((pass_count++))
        else
            echo -e "${RED}✗ FAIL - Expected: $expected${NC}"
            echo "Result: $result"
            ((fail_count++))
        fi
    else
        echo -e "${RED}✗ FAIL - Command failed with exit code $exit_code${NC}"
        echo "Error: $result"
        ((fail_count++))
    fi
    echo ""
}

echo "=== Pre-Test Checks ==="
echo ""

# Check if services are running
run_test "Monitoring Service is running" \
    "curl -s $MONITORING_URL/health" \
    "healthy"

run_test "App Server 1 is running" \
    "curl -s $APP1_URL/health" \
    "healthy"

run_test "App Server 2 is running" \
    "curl -s $APP2_URL/health" \
    "healthy"

run_test "App Server 3 is running" \
    "curl -s $APP3_URL/health" \
    "healthy"

echo "=== Bully Election Tests ==="
echo ""

run_test "Get election status from monitoring" \
    "curl -s $MONITORING_URL/election/status | jq -r '.app1.server_id'" \
    "app1"

run_test "Check current leader exists" \
    "curl -s $MONITORING_URL/election/status | jq -r '.app1.current_leader'" \
    "app"

run_test "Get election history" \
    "curl -s $MONITORING_URL/election/history | jq -r '.app1.server_id'" \
    "app1"

run_test "Manually trigger election on app1" \
    "curl -s -X POST $APP1_URL/election/initiate | jq -r '.message'" \
    "Election initiated"

echo "Waiting 5 seconds for election to complete..."
sleep 5

run_test "Verify election completed" \
    "curl -s $MONITORING_URL/election/status | jq -r '.app1.current_leader'" \
    "app"

echo "=== Inter-Server Messaging Tests ==="
echo ""

run_test "Send message from app1 to app2" \
    "curl -s -X POST $APP1_URL/messages/send \
        -H 'Content-Type: application/json' \
        -d '{\"target_server\":\"app2\",\"message\":\"Test message from app1\",\"message_type\":\"test\"}' \
        | jq -r '.success'" \
    "true"

run_test "Send message from app2 to app3" \
    "curl -s -X POST $APP2_URL/messages/send \
        -H 'Content-Type: application/json' \
        -d '{\"target_server\":\"app3\",\"message\":\"Test message from app2\",\"message_type\":\"test\"}' \
        | jq -r '.success'" \
    "true"

run_test "Broadcast message from app3" \
    "curl -s -X POST $APP3_URL/messages/broadcast \
        -H 'Content-Type: application/json' \
        -d '{\"message\":\"Broadcast test\",\"message_type\":\"broadcast\"}' \
        | jq -r '.sender'" \
    "app3"

run_test "Get message statistics for app1" \
    "curl -s $APP1_URL/messages/stats | jq -r '.server_id'" \
    "app1"

run_test "Get all messages from app1" \
    "curl -s $APP1_URL/messages/all | jq -r '.server_id'" \
    "app1"

run_test "Get all messages from monitoring" \
    "curl -s $MONITORING_URL/messages/all | jq -r '.app1.server_id'" \
    "app1"

run_test "Get message stats from monitoring" \
    "curl -s $MONITORING_URL/messages/stats | jq -r '.app1.server_id'" \
    "app1"

echo "=== Fault Tolerance Role Tests ==="
echo ""

run_test "Get FT roles from monitoring" \
    "curl -s $MONITORING_URL/ft/roles | jq -r '.app1.role'" \
    ""

run_test "Check app1 FT status in health endpoint" \
    "curl -s $APP1_URL/health | jq -r '.fault_tolerance.role'" \
    ""

run_test "Check app2 FT status in health endpoint" \
    "curl -s $APP2_URL/health | jq -r '.fault_tolerance.role'" \
    ""

run_test "Check app3 FT status in health endpoint" \
    "curl -s $APP3_URL/health | jq -r '.fault_tolerance.role'" \
    ""

echo "=== XML-RPC Monitoring Tests ==="
echo ""

run_test "Get XML-RPC collected metrics" \
    "curl -s $MONITORING_URL/xmlrpc/metrics | jq -r 'keys[]'" \
    ""

run_test "Check Lamport clock reported via XML-RPC" \
    "curl -s $MONITORING_URL/xmlrpc/metrics | jq -r '.app1.lamport_time'" \
    ""

run_test "Check election leader reported via XML-RPC" \
    "curl -s $MONITORING_URL/xmlrpc/metrics | jq -r '.app1.leader_id'" \
    ""

run_test "Check FT role reported via XML-RPC" \
    "curl -s $MONITORING_URL/xmlrpc/metrics | jq -r '.app1.ft_role'" \
    ""

echo "=== Lamport Clock Tests ==="
echo ""

run_test "Get Lamport clock value from app1" \
    "curl -s $APP1_URL/health | jq -r '.lamport_time'" \
    ""

run_test "Get Lamport clock value from app2" \
    "curl -s $APP2_URL/health | jq -r '.lamport_time'" \
    ""

run_test "Get Lamport clock value from app3" \
    "curl -s $APP3_URL/health | jq -r '.lamport_time'" \
    ""

echo "=== Server Statistics Tests ==="
echo ""

run_test "Get server stats from app1" \
    "curl -s $APP1_URL/server/stats | jq -r '.server_id'" \
    "app1"

run_test "Get server stats from app2" \
    "curl -s $APP2_URL/server/stats | jq -r '.server_id'" \
    "app2"

run_test "Get server stats from app3" \
    "curl -s $APP3_URL/server/stats | jq -r '.server_id'" \
    "app3"

echo "=========================================="
echo "           Test Summary"
echo "=========================================="
echo ""
echo -e "Total Tests:  $test_count"
echo -e "${GREEN}Passed:       $pass_count${NC}"
echo -e "${RED}Failed:       $fail_count${NC}"
echo ""

if [ $fail_count -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed.${NC}"
    exit 1
fi
