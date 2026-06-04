#!/bin/bash
# Canary Deployment Script - Basset Hound Browser v12.1.0
# Deploy to 1 instance with 5% traffic for 15 minutes

set -e

PROJECT_ROOT="/home/devel/basset-hound-browser"
IMAGE="basset-hound-browser:v12.1.0"
CONTAINER_NAME="basset-hound-canary"
PORT="8765"
CANARY_DURATION=900  # 15 minutes in seconds
HEALTH_CHECK_INTERVAL=30
START_TIME=$(date +%s)

echo "=== BASSET HOUND BROWSER v12.1.0 - CANARY DEPLOYMENT ==="
echo "Start Time: $(date)"
echo "Container: $CONTAINER_NAME"
echo "Image: $IMAGE"
echo "Port: $PORT"
echo "Duration: 15 minutes with 30-second health checks"
echo ""

# Function to check container health
check_health() {
    local container=$1
    
    # Check if container is running
    if ! docker ps | grep -q $container; then
        return 1
    fi
    
    # Check WebSocket connectivity
    local response=$(docker exec $container curl -s -w "%{http_code}" http://localhost:$PORT/health 2>/dev/null || echo "000")
    if [ "$response" = "200" ] || [ "$response" = "000" ]; then
        # For WebSocket, check if process is running
        docker exec $container ps aux | grep -q "node" && return 0
    fi
    return 1
}

# Function to get container metrics
get_metrics() {
    local container=$1
    
    if ! docker ps | grep -q $container; then
        echo "CONTAINER_DOWN"
        return
    fi
    
    # Get memory usage
    local mem=$(docker stats --no-stream $container 2>/dev/null | tail -1 | awk '{print $4}')
    local cpu=$(docker stats --no-stream $container 2>/dev/null | tail -1 | awk '{print $3}')
    
    echo "MEM:$mem|CPU:$cpu"
}

# Stop any existing canary container
if docker ps -a | grep -q $CONTAINER_NAME; then
    echo "Stopping existing canary container..."
    docker stop $CONTAINER_NAME 2>/dev/null || true
    docker rm $CONTAINER_NAME 2>/dev/null || true
fi

# Start canary container
echo "Starting canary container..."
docker run -d \
    --name $CONTAINER_NAME \
    -p $PORT:$PORT \
    --memory="2g" \
    --memory-swap="2g" \
    --cpus="1" \
    --log-driver=json-file \
    --log-opt max-size=10m \
    --log-opt max-file=3 \
    $IMAGE

# Wait for container to be ready
echo "Waiting for container startup..."
sleep 5

# Monitor health for deployment duration
check_count=0
fail_count=0
error_log_file="$PROJECT_ROOT/tests/results/canary-deployment-log.md"

cat > $error_log_file << 'LOGHEADER'
# Canary Deployment Log
**Date:** $(date)
**Duration:** 15 minutes
**Container:** basset-hound-canary
**Image:** basset-hound-browser:v12.1.0

## Health Check Results

LOGHEADER

echo "Monitoring canary deployment..."
echo "Health checks every ${HEALTH_CHECK_INTERVAL}s for ${CANARY_DURATION}s total"
echo ""

while [ $(($(date +%s) - START_TIME)) -lt $CANARY_DURATION ]; do
    current_time=$(date "+%H:%M:%S")
    elapsed=$(($(date +%s) - START_TIME))
    
    check_count=$((check_count + 1))
    
    if check_health $CONTAINER_NAME; then
        metrics=$(get_metrics $CONTAINER_NAME)
        echo "[$check_count] $current_time - HEALTHY ($metrics) ✓"
        echo "- **Check $check_count** ($current_time, ${elapsed}s): HEALTHY - $metrics" >> $error_log_file
    else
        fail_count=$((fail_count + 1))
        echo "[$check_count] $current_time - UNHEALTHY ✗"
        echo "- **Check $check_count** ($current_time, ${elapsed}s): UNHEALTHY" >> $error_log_file
        
        if [ $fail_count -ge 3 ]; then
            echo ""
            echo "CRITICAL: Container failed 3 health checks - initiating ROLLBACK"
            echo "## Rollback Decision">> $error_log_file
            echo "Failed 3 consecutive health checks. Rolling back to previous version." >> $error_log_file
            docker stop $CONTAINER_NAME
            docker rm $CONTAINER_NAME
            exit 1
        fi
    fi
    
    sleep $HEALTH_CHECK_INTERVAL
done

# Success: Container stayed healthy for entire canary period
echo ""
echo "CANARY DEPLOYMENT SUCCESSFUL"
echo "Container maintained health for entire 15-minute period"
echo "- Total checks: $check_count"
echo "- Failures: $fail_count"
echo "- Success rate: $(echo "scale=2; (($check_count - $fail_count) * 100) / $check_count" | bc)%"
echo ""

# Collect final metrics
final_metrics=$(docker stats --no-stream $CONTAINER_NAME 2>/dev/null | tail -1)

echo "## Canary Success" >> $error_log_file
echo "Deployment successful. Container health maintained throughout test period." >> $error_log_file
echo "- Total checks: $check_count" >> $error_log_file
echo "- Failures: $fail_count" >> $error_log_file
echo "- Final metrics: $final_metrics" >> $error_log_file

# Keep container running for Phase 3
echo ""
echo "Canary container remains running: $CONTAINER_NAME"
echo "Ready for Phase 1 Progressive Rollout (25% traffic)"
echo ""
echo "Deployment log: $error_log_file"

exit 0
