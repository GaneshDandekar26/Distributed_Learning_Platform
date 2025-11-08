#!/bin/bash

echo "🔥 Starting CONTINUOUS Load Testing..."
echo "This will keep sending requests to maintain active connections."
echo "Watch your Admin Dashboard at http://localhost:9090"
echo "Press Ctrl+C to stop"
echo ""
echo "Starting in 3 seconds..."
sleep 3

# Counter
counter=1

while true; do
    # Send concurrent requests to create active connections
    for i in {1..5}; do
        (
            # Random endpoint to hit
            endpoint=$(shuf -n 1 -e "health" "info" "courses" "dc/lamport")
            curl -s "http://localhost:8000/$endpoint" > /dev/null
        ) &
    done
    
    # Show progress
    echo -n "."
    
    # Show status every 20 requests
    if [ $((counter % 20)) -eq 0 ]; then
        echo ""
        echo "📊 Connection Status at request $counter:"
        curl -s http://localhost:8000/lb/connections | jq -c '.connections'
        echo ""
    fi
    
    ((counter++))
    
    # Small delay to simulate real traffic
    sleep 0.5
    
    # Wait for background jobs to finish
    wait
done
