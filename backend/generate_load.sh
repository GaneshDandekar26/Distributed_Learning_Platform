#!/bin/bash

echo "🚀 Starting Load Generation Test..."
echo "Watch your Admin Dashboard for real-time updates!"
echo ""

# Test 1: Send 30 requests to see load distribution
echo "📊 Test 1: Sending 30 requests through load balancer..."
for i in {1..30}; do
  curl -s http://localhost:8000/health > /dev/null
  echo -n "."
  sleep 0.3
done
echo ""
echo "✅ Test 1 complete! Check the dashboard."
echo ""
sleep 3

# Check current distribution
echo "📈 Current Connection Distribution:"
curl -s http://localhost:8000/lb/connections | jq '.'
echo ""
sleep 5

# Test 2: Send more requests to different endpoints
echo "📊 Test 2: Sending 20 requests to /info endpoint..."
for i in {1..20}; do
  curl -s http://localhost:8000/info > /dev/null
  echo -n "."
  sleep 0.2
done
echo ""
echo "✅ Test 2 complete! Check the dashboard."
echo ""
sleep 3

# Check updated distribution
echo "📈 Updated Connection Distribution:"
curl -s http://localhost:8000/lb/connections | jq '.'
echo ""
sleep 5

# Test 3: Send requests to courses endpoint
echo "📊 Test 3: Sending 25 requests to /courses endpoint..."
for i in {1..25}; do
  curl -s http://localhost:8000/courses > /dev/null
  echo -n "."
  sleep 0.25
done
echo ""
echo "✅ Test 3 complete! Check the dashboard."
echo ""

# Final status
echo "🎯 Final Load Balancer Status:"
curl -s http://localhost:8000/lb/status | jq '.'
echo ""

echo "🎉 Load testing complete! Check your Admin Dashboard for visualizations."
