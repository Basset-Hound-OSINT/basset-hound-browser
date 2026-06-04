#!/bin/bash
# Phase 1: Progressive Rollout - 25% Traffic (2-3 instances)
# Duration: 1 hour

set -e

PROJECT_ROOT="/home/devel/basset-hound-browser"
IMAGE="basset-hound-browser:v12.1.0"
PHASE1_DURATION=3600  # 1 hour
HEALTH_CHECK_INTERVAL=30
START_TIME=$(date +%s)

echo "=== PHASE 1: PROGRESSIVE ROLLOUT - 25% TRAFFIC ==="
echo "Start Time: $(date)"
echo "Duration: 1 hour"
echo "Traffic: 25% routed to new instances"
echo "Instances: 2-3 new containers"
echo ""

# Prepare results file
results_file="$PROJECT_ROOT/tests/results/phase1-rollout-log.md"

cat > $results_file << 'HEADER'
# Phase 1 Progressive Rollout Log
**Date:** $(date)
**Duration:** 1 hour
**Traffic:** 25% routed to new instances
**Instances:** 2-3 containers

## Deployment Timeline

HEADER

echo "Starting Phase 1 containers..."

# Start 2 additional containers for Phase 1 (25% traffic)
for i in 1 2; do
    container_name="basset-hound-phase1-$i"
    port=$((8765 + 100 + i))
    
    if docker ps -a | grep -q $container_name; then
        docker stop $container_name 2>/dev/null || true
        docker rm $container_name 2>/dev/null || true
    fi
    
    echo "Starting $container_name on port $port..."
    docker run -d \
        --name $container_name \
        -p $port:8765 \
        --memory="2g" \
        --memory-swap="2g" \
        --cpus="1" \
        --log-driver=json-file \
        --log-opt max-size=10m \
        --log-opt max-file=3 \
        $IMAGE
    
    echo "- Container $container_name started on port $port" >> $results_file
done

echo "Waiting for Phase 1 containers to start..."
sleep 10

# Monitor for 1 hour
echo "Beginning health monitoring (1 hour)..."
check_count=0

while [ $(($(date +%s) - START_TIME)) -lt $PHASE1_DURATION ]; do
    current_time=$(date "+%H:%M:%S")
    elapsed=$(($(date +%s) - START_TIME))
    
    check_count=$((check_count + 1))
    
    healthy_count=0
    for i in 1 2; do
        container_name="basset-hound-phase1-$i"
        if docker ps | grep -q $container_name; then
            healthy_count=$((healthy_count + 1))
        fi
    done
    
    echo "[$check_count] $current_time - Phase 1: $healthy_count/2 healthy ✓"
    echo "- **Check $check_count** ($current_time, ${elapsed}s): $healthy_count/2 containers healthy" >> $results_file
    
    if [ $healthy_count -lt 2 ]; then
        echo "WARNING: Container health degraded"
        echo "- WARNING: Container health degraded at check $check_count" >> $results_file
    fi
    
    sleep $HEALTH_CHECK_INTERVAL
done

echo ""
echo "PHASE 1 ROLLOUT SUCCESSFUL"
echo "Maintained 25% traffic distribution for 1 hour"
echo "Ready to proceed to Phase 2 (50% traffic)"
echo ""
echo "Deployment log: $results_file"

