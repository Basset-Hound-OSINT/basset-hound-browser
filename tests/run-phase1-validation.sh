#!/bin/bash

# Phase 1 Real-World Validation Test Runner
# Tests Basset Hound Browser against 20+ real websites

set -e

PROJECT_ROOT="/home/devel/basset-hound-browser"
TEST_DIR="${PROJECT_ROOT}/tests"
RESULTS_DIR="/tmp/phase1-results"
CONTAINER_NAME="basset-hound-test-phase1"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Phase 1 Real-World Validation Testing ===${NC}"
echo "Project Root: $PROJECT_ROOT"
echo "Results Directory: $RESULTS_DIR"
echo ""

# Create results directory
mkdir -p "$RESULTS_DIR"

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Docker not found. Please install Docker to run Phase 1 tests.${NC}"
    exit 1
fi

# Function to start container
start_container() {
    echo -e "${YELLOW}Starting Docker container...${NC}"

    # Check if container already exists
    if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        echo "Removing existing container..."
        docker rm -f "$CONTAINER_NAME" || true
    fi

    # Build and start container
    echo "Building Docker image..."
    docker build -t basset-hound-test:phase1 \
        -f "$PROJECT_ROOT/config/docker/Dockerfile" \
        "$PROJECT_ROOT" \
        2>&1 | tail -5

    echo "Starting container..."
    docker run -d \
        --name "$CONTAINER_NAME" \
        -p 8765:8765 \
        --cpus=2 \
        --memory=2g \
        basset-hound-test:phase1 \
        2>&1

    echo -e "${GREEN}Container started.${NC}"
    sleep 5 # Wait for container to be ready
}

# Function to check WebSocket connectivity
check_websocket() {
    echo -e "${YELLOW}Checking WebSocket connectivity...${NC}"

    for i in {1..10}; do
        if timeout 5 bash -c "</dev/tcp/localhost/8765" 2>/dev/null; then
            echo -e "${GREEN}WebSocket server is ready.${NC}"
            return 0
        fi
        echo "Attempt $i/10: Waiting for server..."
        sleep 2
    done

    echo -e "${RED}WebSocket server failed to start.${NC}"
    return 1
}

# Function to run tests
run_tests() {
    echo -e "${YELLOW}Running Phase 1 tests...${NC}"

    cd "$PROJECT_ROOT"

    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        echo "Installing dependencies..."
        npm install --silent 2>&1 | grep -v "^npm WARN" | tail -5
    fi

    # Run the test suite
    node "$TEST_DIR/phase1-real-world-validation.js" 2>&1 | tee "$RESULTS_DIR/test-output.txt"
}

# Function to cleanup
cleanup() {
    echo -e "${YELLOW}Cleaning up...${NC}"
    docker stop "$CONTAINER_NAME" 2>/dev/null || true
    docker rm "$CONTAINER_NAME" 2>/dev/null || true
}

# Main execution
main() {
    trap cleanup EXIT

    # Start container
    start_container

    # Check WebSocket
    if ! check_websocket; then
        echo -e "${RED}Failed to connect to WebSocket server.${NC}"
        exit 1
    fi

    # Run tests
    run_tests

    # Print results
    if [ -f "$RESULTS_DIR/phase1-validation-report.json" ]; then
        echo -e "${GREEN}Tests completed. Report: $RESULTS_DIR/phase1-validation-report.json${NC}"
    fi
}

main "$@"
