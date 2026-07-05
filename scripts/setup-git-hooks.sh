#!/bin/bash

# ============================================================================
# Git Hooks Setup Script for Basset Hound Browser
# ============================================================================
# This script installs git pre-commit hooks for code quality checks
# Run this once after cloning the repository
# ============================================================================

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
  echo -e "${BLUE}▶ $1${NC}"
}

print_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

# Get the project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

print_header "Setting up git hooks for Basset Hound Browser"

# Check if .git directory exists
if [ ! -d ".git" ]; then
  echo "Error: Not a git repository. Run this script from the project root."
  exit 1
fi

# Create hooks directory if it doesn't exist
HOOKS_DIR=".git/hooks"
mkdir -p "$HOOKS_DIR"

# Create pre-commit hook
PRE_COMMIT_HOOK="$HOOKS_DIR/pre-commit"
cat > "$PRE_COMMIT_HOOK" << 'EOF'
#!/bin/bash
# Pre-commit hook for code quality checks

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"

# Run pre-commit checks
bash scripts/pre-commit.sh
exit $?
EOF

chmod +x "$PRE_COMMIT_HOOK"
print_success "Created pre-commit hook at $PRE_COMMIT_HOOK"

# Create commit-msg hook for commit message validation (optional)
COMMIT_MSG_HOOK="$HOOKS_DIR/commit-msg"
cat > "$COMMIT_MSG_HOOK" << 'EOF'
#!/bin/bash
# Commit message validation hook

COMMIT_MSG_FILE=$1
COMMIT_MSG=$(cat "$COMMIT_MSG_FILE")

# Check minimum length
if [ ${#COMMIT_MSG} -lt 10 ]; then
  echo "Error: Commit message is too short (minimum 10 characters)"
  exit 1
fi

# Optional: Check for conventional commits format
# Uncomment to enforce conventional commits
# if ! echo "$COMMIT_MSG" | grep -qE '^(feat|fix|docs|style|refactor|test|chore|perf|ci): '; then
#   echo "Error: Commit message should follow conventional commits format"
#   echo "  Format: <type>(<scope>): <subject>"
#   exit 1
# fi

exit 0
EOF

chmod +x "$COMMIT_MSG_HOOK"
print_success "Created commit-msg hook at $COMMIT_MSG_HOOK"

# Summary
echo ""
print_header "Git hooks setup complete"
echo ""
echo "Installed hooks:"
echo "  - pre-commit: Runs ESLint and code quality checks"
echo "  - commit-msg: Validates commit message format"
echo ""
echo "To test the pre-commit hook:"
echo "  git add <files>"
echo "  git commit -m 'test commit'"
echo ""
echo "To bypass hooks (NOT RECOMMENDED):"
echo "  git commit --no-verify"
echo ""

print_success "Setup complete!"
