#!/bin/bash
# Run test suite with memory optimization settings
# Prevents heap exhaustion at 613MB by reducing workers and forcing GC

set -e

echo "🧪 Running tests with memory optimization..."
echo ""
echo "Settings:"
echo "  - Node.js heap limit: 512MB per worker"
echo "  - Max workers: 1 (aggressive memory control)"
echo "  - Garbage collection: Forced (--expose-gc)"
echo "  - Test timeout: 120 seconds"
echo ""

# Set environment variables for memory optimization
export NODE_OPTIONS="--max_old_space_size=512 --expose-gc"
export JEST_MAX_WORKERS=1
export TEST_TIMEOUT=120000
export JEST_VERBOSE=false

# Clean test artifacts first
npm run test:cleanup

# Run test suite
echo "Starting test run..."
node --expose-gc ./node_modules/.bin/jest \
  --config jest.config.js \
  --maxWorkers=1 \
  --testTimeout=120000 \
  --forceExit \
  --detectOpenHandles \
  --logHeapUsage \
  --bail=0 \
  "$@"

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo ""
  echo "✅ All tests passed!"
else
  echo ""
  echo "❌ Tests failed with exit code: $EXIT_CODE"
fi

exit $EXIT_CODE
