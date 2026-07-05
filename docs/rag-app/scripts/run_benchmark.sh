#!/bin/bash
#
# Benchmark Runner Script
# Executes 10K document chunk pipeline benchmark
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
RESULTS_DIR="$PROJECT_ROOT/results"

# Create results directory
mkdir -p "$RESULTS_DIR"

echo "======================================================================"
echo "10K Document Chunk Pipeline Benchmark"
echo "======================================================================"
echo "Start time: $(date)"
echo "Project: $PROJECT_ROOT"
echo "Results: $RESULTS_DIR"
echo ""

# Check dependencies
echo "Checking dependencies..."
python3 -c "import psutil, numpy, pandas" 2>/dev/null || {
    echo "ERROR: Missing dependencies. Install with:"
    echo "  pip install psutil numpy pandas"
    exit 1
}

# Check services
echo "Checking services..."

# Check PostgreSQL
if ! curl -s http://localhost:5432/ >/dev/null 2>&1 && ! nc -z localhost 5432 2>/dev/null; then
    echo "WARNING: PostgreSQL not responding. Starting docker-compose..."
    cd "$PROJECT_ROOT"
    docker-compose up -d postgres redis
    sleep 10
fi

# Check Ollama
if ! curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
    echo "WARNING: Ollama not responding. Starting docker-compose..."
    cd "$PROJECT_ROOT"
    docker-compose up -d ollama
    sleep 10
fi

echo "Services check: OK"
echo ""

# Parse arguments
RETRIEVAL_QUERIES=1000
GENERATIONS=100
E2E_QUERIES=100
VERBOSE=0

while [[ $# -gt 0 ]]; do
    case $1 in
        --quick)
            RETRIEVAL_QUERIES=100
            GENERATIONS=10
            E2E_QUERIES=10
            shift
            ;;
        --retrieval)
            RETRIEVAL_QUERIES="$2"
            shift 2
            ;;
        --generations)
            GENERATIONS="$2"
            shift 2
            ;;
        --e2e)
            E2E_QUERIES="$2"
            shift 2
            ;;
        --verbose)
            VERBOSE=1
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Run benchmark
echo "Configuration:"
echo "  Retrieval queries: $RETRIEVAL_QUERIES"
echo "  Generation tasks: $GENERATIONS"
echo "  E2E queries: $E2E_QUERIES"
echo ""

cd "$PROJECT_ROOT"

if [ $VERBOSE -eq 1 ]; then
    python3 scripts/benchmark_10k_pipeline.py
else
    python3 scripts/benchmark_10k_pipeline.py 2>&1 | tee "$RESULTS_DIR/benchmark_run.log"
fi

# Find latest results file
LATEST_RESULTS=$(ls -t "$RESULTS_DIR"/benchmark_10k_*.json 2>/dev/null | head -1)

if [ -z "$LATEST_RESULTS" ]; then
    echo "ERROR: Benchmark results file not found"
    exit 1
fi

echo ""
echo "======================================================================"
echo "Benchmark Complete"
echo "======================================================================"
echo "Results: $LATEST_RESULTS"
echo ""

# Generate report
echo "Generating report..."
python3 scripts/generate_benchmark_report.py "$LATEST_RESULTS" > "$RESULTS_DIR/benchmark_report_latest.md"

echo "Report: $RESULTS_DIR/benchmark_report_latest.md"
echo ""

# Print summary
echo "Summary:"
python3 -c "
import json
import sys

with open('$LATEST_RESULTS') as f:
    results = json.load(f)

for name, bench in results['benchmarks'].items():
    if 'error' in bench:
        print(f'  {name}: ERROR')
        continue

    if 'latency' in bench:
        lat = bench['latency']
        print(f'  {name}: mean={lat[\"mean_ms\"]:.1f}ms, p95={lat[\"p95_ms\"]:.1f}ms')
"

echo ""
echo "End time: $(date)"
echo "======================================================================"
