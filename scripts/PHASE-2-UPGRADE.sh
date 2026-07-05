#!/bin/bash

# Phase 2: Jest Ecosystem Upgrade
# Upgrades jest and related packages to fix 18 moderate vulnerabilities
# Duration: ~45 minutes
# Risk Level: MEDIUM

set -e

echo "=========================================="
echo "Phase 2: Jest Ecosystem Upgrade"
echo "=========================================="
echo ""
echo "This phase upgrades:"
echo "  - jest: 29.7.0 → 30.4.2"
echo "  - jest-environment-node: 29.7.0 → 30.4.1"
echo "  - jest-junit: 8.0.0 → 16.0.0"
echo ""
echo "Expected Outcome: 19 vulnerabilities fixed"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

echo ""
echo "Step 1: Installing jest@30.4.2..."
npm install --save-dev jest@^30.4.2

echo ""
echo "Step 2: Installing jest-environment-node@30.4.1..."
npm install --save-dev jest-environment-node@^30.4.1

echo ""
echo "Step 3: Installing jest-junit@16.0.0..."
npm install --save-dev jest-junit@^16.0.0

echo ""
echo "Step 4: Running full test suite..."
npm test

echo ""
echo "Step 5: Verifying audit..."
npm audit

echo ""
echo "=========================================="
echo "Phase 2 Complete!"
echo "=========================================="
echo ""
echo "Summary:"
npm audit 2>&1 | grep "vulnerabilities"
npm outdated 2>&1 | head -15 || true

echo ""
echo "Next steps:"
echo "  1. Review test results above"
echo "  2. If all tests pass: commit changes"
echo "  3. If tests fail: check PHASE-2-UPGRADE-ROLLBACK.sh"
