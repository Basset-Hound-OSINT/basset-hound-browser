#!/bin/bash

################################################################################
# Basset Hound Browser - Bash/cURL WebSocket Examples
#
# This script demonstrates WebSocket communication using common bash tools.
# Install wscat for interactive testing: npm install -g wscat
#
# Usage:
#   bash 04-bash-curl-examples.sh
#   # OR use wscat for interactive mode:
#   wscat -c ws://localhost:8765
################################################################################

set -e

# Configuration
BASSET_HOST="${BASSET_HOST:-localhost}"
BASSET_PORT="${BASSET_PORT:-8765}"
BASSET_URL="ws://${BASSET_HOST}:${BASSET_PORT}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function: Print section header
print_header() {
    echo ""
    echo "================================================================================"
    echo "$1"
    echo "================================================================================"
}

# Function: Test curl/http endpoint
test_http() {
    print_header "Testing HTTP Health Check"
    echo "URL: http://${BASSET_HOST}:${BASSET_PORT}/health"

    response=$(curl -s -X GET "http://${BASSET_HOST}:${BASSET_PORT}/health" 2>&1 || echo "FAILED")

    if [[ "$response" == "FAILED" ]]; then
        echo -e "${RED}Server not responding on HTTP${NC}"
        echo "Make sure server is running on ${BASSET_HOST}:${BASSET_PORT}"
        return 1
    fi

    echo -e "${GREEN}Server is healthy${NC}"
    echo "Response: $response"
    return 0
}

# Function: Check if wscat is installed
check_wscat() {
    if command -v wscat &> /dev/null; then
        echo -e "${GREEN}wscat is installed${NC}"
        return 0
    else
        echo -e "${YELLOW}wscat not found. Install with: npm install -g wscat${NC}"
        return 1
    fi
}

# Function: Test WebSocket with wscat
test_wscat() {
    if ! check_wscat; then
        return 1
    fi

    print_header "Testing WebSocket with wscat (Interactive Mode)"
    echo "Connecting to $BASSET_URL..."
    echo ""
    echo "Commands to try:"
    echo '  {"id":1,"command":"ping"}'
    echo '  {"id":2,"command":"status"}'
    echo '  {"id":3,"command":"navigate","url":"https://example.com"}'
    echo '  {"id":4,"command":"get_url"}'
    echo ""
    echo "Type 'quit' or Ctrl+C to exit"
    echo ""

    wscat -c "$BASSET_URL"
}

# Function: Send JSON via websocat (if available)
test_websocat() {
    if ! command -v websocat &> /dev/null; then
        echo -e "${YELLOW}websocat not found. Skipping websocat tests.${NC}"
        echo "Install with: cargo install websocat"
        return 1
    fi

    print_header "Testing with websocat"

    # Test 1: Ping
    echo ""
    echo "Test 1: Ping Command"
    echo "Request: {\"id\":1,\"command\":\"ping\"}"
    echo '{"id":1,"command":"ping"}' | websocat "$BASSET_URL"

    # Test 2: Status
    echo ""
    echo "Test 2: Status Command"
    echo "Request: {\"id\":2,\"command\":\"status\"}"
    echo '{"id":2,"command":"status"}' | websocat "$BASSET_URL"
}

# Function: Python WebSocket test
test_python() {
    if ! command -v python3 &> /dev/null; then
        echo -e "${YELLOW}python3 not found. Skipping Python test.${NC}"
        return 1
    fi

    print_header "Testing with Python"

    python3 << 'EOF'
import websocket
import json
import sys

try:
    ws = websocket.WebSocket()
    ws.connect('ws://localhost:8765')
    print("Connected to WebSocket server")

    # Test 1: Ping
    print("\nTest 1: Ping Command")
    request = {"id": 1, "command": "ping"}
    ws.send(json.dumps(request))
    response = json.loads(ws.recv())
    print(f"Response: {json.dumps(response, indent=2)}")

    # Test 2: Status
    print("\nTest 2: Status Command")
    request = {"id": 2, "command": "status"}
    ws.send(json.dumps(request))
    response = json.loads(ws.recv())
    print(f"Response: {json.dumps(response, indent=2)}")

    ws.close()
    print("\nTests completed successfully!")
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
EOF
}

# Function: Node.js WebSocket test
test_nodejs() {
    if ! command -v node &> /dev/null; then
        echo -e "${YELLOW}node not found. Skipping Node.js test.${NC}"
        return 1
    fi

    print_header "Testing with Node.js"

    node << 'EOF'
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8765');

let testCount = 0;
let completed = false;

ws.on('open', () => {
    console.log('Connected to WebSocket server');

    // Test 1: Ping
    console.log('\nTest 1: Ping Command');
    ws.send(JSON.stringify({id: 1, command: 'ping'}));
});

ws.on('message', (data) => {
    testCount++;
    console.log(`Response: ${data}`);

    if (testCount === 1) {
        // Test 2: Status
        console.log('\nTest 2: Status Command');
        ws.send(JSON.stringify({id: 2, command: 'status'}));
    } else if (testCount === 2) {
        console.log('\nTests completed successfully!');
        ws.close();
        completed = true;
    }
});

ws.on('error', (error) => {
    console.error('Error:', error);
    process.exit(1);
});

ws.on('close', () => {
    if (completed) {
        process.exit(0);
    } else {
        console.error('Connection closed unexpectedly');
        process.exit(1);
    }
});
EOF
}

# Function: Raw nc (netcat) test
test_netcat() {
    if ! command -v nc &> /dev/null; then
        echo -e "${YELLOW}nc (netcat) not found. Skipping netcat test.${NC}"
        return 1
    fi

    print_header "Testing with netcat (Connectivity Only)"
    echo "Attempting to connect to $BASSET_HOST:$BASSET_PORT..."

    if nc -zv "$BASSET_HOST" "$BASSET_PORT" 2>&1; then
        echo -e "${GREEN}Port $BASSET_PORT is open and listening${NC}"
    else
        echo -e "${RED}Cannot connect to $BASSET_HOST:$BASSET_PORT${NC}"
        return 1
    fi
}

# Function: Docker ps check
test_docker() {
    if ! command -v docker &> /dev/null; then
        echo -e "${YELLOW}docker not found. Skipping Docker check.${NC}"
        return 1
    fi

    print_header "Docker Container Status"

    if docker ps | grep -q basset-hound; then
        echo -e "${GREEN}Basset Hound container is running${NC}"
        docker ps | grep basset-hound
    else
        echo -e "${YELLOW}No running Basset Hound container found${NC}"
        echo "Run with: docker run -p 8765:8765 basset-hound-browser"
    fi
}

# Main menu
main() {
    echo ""
    echo "================================================"
    echo "Basset Hound Browser - WebSocket Test Suite"
    echo "================================================"
    echo ""
    echo "Target: ws://${BASSET_HOST}:${BASSET_PORT}"
    echo ""
    echo "Available tests:"
    echo "  1) HTTP Health Check"
    echo "  2) Docker Status"
    echo "  3) Netcat Connectivity"
    echo "  4) Python WebSocket Test"
    echo "  5) Node.js WebSocket Test"
    echo "  6) websocat Test"
    echo "  7) wscat Interactive (Recommended)"
    echo "  8) Run All Tests"
    echo "  q) Quit"
    echo ""

    if [[ $# -eq 0 ]]; then
        # Interactive mode
        while true; do
            read -p "Select test (1-8, a, or q): " choice
            case $choice in
                1) test_http ;;
                2) test_docker ;;
                3) test_netcat ;;
                4) test_python ;;
                5) test_nodejs ;;
                6) test_websocat ;;
                7) test_wscat ;;
                8)
                    test_http
                    test_docker
                    test_netcat
                    test_python || true
                    test_nodejs || true
                    test_websocat || true
                    ;;
                a)
                    test_http
                    test_docker
                    test_netcat
                    test_python || true
                    test_nodejs || true
                    test_websocat || true
                    ;;
                q) exit 0 ;;
                *) echo "Invalid choice" ;;
            esac
        done
    else
        # Command line mode
        case "$1" in
            http) test_http ;;
            docker) test_docker ;;
            netcat) test_netcat ;;
            python) test_python ;;
            nodejs) test_nodejs ;;
            websocat) test_websocat ;;
            wscat) test_wscat ;;
            all)
                test_http
                test_docker
                test_netcat
                test_python || true
                test_nodejs || true
                ;;
            *)
                echo "Usage: $0 [http|docker|netcat|python|nodejs|websocat|wscat|all]"
                exit 1
                ;;
        esac
    fi
}

main "$@"
