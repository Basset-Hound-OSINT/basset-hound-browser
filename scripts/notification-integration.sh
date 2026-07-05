#!/bin/bash
# Basset Hound Browser - Deployment Notification Integration
# Features: Slack, email, webhooks, notification templates
# Usage: ./scripts/notification-integration.sh [OPTIONS]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# ============================================================================
# CONFIGURATION
# ============================================================================

# Notification configuration file
CONFIG_FILE="${PROJECT_ROOT}/.env.notifications"
TEMPLATES_DIR="${PROJECT_ROOT}/scripts/notification-templates"

# Default values
SLACK_WEBHOOK=""
EMAIL_SMTP_HOST=""
EMAIL_SMTP_PORT="587"
EMAIL_FROM=""
EMAIL_TO=""
EMAIL_CC=""
WEBHOOK_URL=""
WEBHOOK_METHOD="POST"

# Notification types
NOTIFICATION_TYPE="deployment"  # deployment, health-check, rollback, alert
NOTIFICATION_STATUS="pending"   # pending, success, warning, error, failed, rolled_back
NOTIFICATION_MESSAGE=""
DEPLOYMENT_VERSION=""
DEPLOYMENT_DURATION=""
DEPLOYMENT_TIMESTAMP=""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ============================================================================
# LOGGING
# ============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $*"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*"
}

# ============================================================================
# ARGUMENT PARSING
# ============================================================================

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --type)
                NOTIFICATION_TYPE="$2"
                shift 2
                ;;
            --status)
                NOTIFICATION_STATUS="$2"
                shift 2
                ;;
            --message)
                NOTIFICATION_MESSAGE="$2"
                shift 2
                ;;
            --version)
                DEPLOYMENT_VERSION="$2"
                shift 2
                ;;
            --duration)
                DEPLOYMENT_DURATION="$2"
                shift 2
                ;;
            --slack)
                SLACK_WEBHOOK="$2"
                shift 2
                ;;
            --email-to)
                EMAIL_TO="$2"
                shift 2
                ;;
            --email-from)
                EMAIL_FROM="$2"
                shift 2
                ;;
            --email-smtp-host)
                EMAIL_SMTP_HOST="$2"
                shift 2
                ;;
            --webhook)
                WEBHOOK_URL="$2"
                shift 2
                ;;
            --config)
                CONFIG_FILE="$2"
                shift 2
                ;;
            --setup)
                setup_notifications
                exit 0
                ;;
            --test)
                test_notifications
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                print_usage
                exit 1
                ;;
        esac
    done

    DEPLOYMENT_TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
}

print_usage() {
    cat <<EOF
Usage: ./scripts/notification-integration.sh [OPTIONS]

OPTIONS:
    --type TYPE               Notification type (deployment|health-check|rollback|alert)
    --status STATUS           Notification status (pending|success|warning|error|failed|rolled_back)
    --message MSG             Notification message
    --version VERSION         Deployment version
    --duration SECONDS        Deployment duration
    --slack WEBHOOK           Slack webhook URL
    --email-to ADDR           Email recipient
    --email-from ADDR         Email sender
    --email-smtp-host HOST    Email SMTP host
    --webhook URL             Generic webhook URL
    --config FILE             Configuration file path
    --setup                   Interactive setup wizard
    --test                    Test all configured notifications

EXAMPLES:
    # Send deployment success notification
    ./scripts/notification-integration.sh \
        --type deployment \
        --status success \
        --version 12.9.0 \
        --duration 120 \
        --slack https://hooks.slack.com/...

    # Interactive setup
    ./scripts/notification-integration.sh --setup

    # Test notifications
    ./scripts/notification-integration.sh --test
EOF
}

# ============================================================================
# CONFIGURATION FUNCTIONS
# ============================================================================

load_config() {
    if [[ -f "$CONFIG_FILE" ]]; then
        log_info "Loading configuration from: $CONFIG_FILE"
        # shellcheck source=/dev/null
        source "$CONFIG_FILE"
    fi
}

save_config() {
    log_info "Saving configuration to: $CONFIG_FILE"

    cat > "$CONFIG_FILE" <<EOF
# Basset Hound Browser - Notification Configuration
# Generated: $(date)

# Slack Configuration
SLACK_WEBHOOK="${SLACK_WEBHOOK}"

# Email Configuration
EMAIL_SMTP_HOST="${EMAIL_SMTP_HOST}"
EMAIL_SMTP_PORT="${EMAIL_SMTP_PORT}"
EMAIL_FROM="${EMAIL_FROM}"
EMAIL_TO="${EMAIL_TO}"
EMAIL_CC="${EMAIL_CC}"

# Generic Webhook
WEBHOOK_URL="${WEBHOOK_URL}"
WEBHOOK_METHOD="${WEBHOOK_METHOD}"
EOF

    chmod 600 "$CONFIG_FILE"
    log_success "Configuration saved"
}

# ============================================================================
# SETUP WIZARD
# ============================================================================

setup_notifications() {
    log_info "Basset Hound Browser - Notification Setup Wizard"
    echo ""

    # Slack setup
    echo "=== Slack Configuration ==="
    read -p "Enable Slack notifications? (y/n): " -r enable_slack
    if [[ "$enable_slack" =~ ^[Yy]$ ]]; then
        read -p "Enter Slack Webhook URL: " SLACK_WEBHOOK
    fi
    echo ""

    # Email setup
    echo "=== Email Configuration ==="
    read -p "Enable email notifications? (y/n): " -r enable_email
    if [[ "$enable_email" =~ ^[Yy]$ ]]; then
        read -p "Email SMTP Host (default: localhost): " EMAIL_SMTP_HOST
        EMAIL_SMTP_HOST="${EMAIL_SMTP_HOST:-localhost}"

        read -p "Email SMTP Port (default: 587): " EMAIL_SMTP_PORT
        EMAIL_SMTP_PORT="${EMAIL_SMTP_PORT:-587}"

        read -p "Email From: " EMAIL_FROM
        read -p "Email To (comma-separated): " EMAIL_TO
        read -p "Email CC (optional): " EMAIL_CC
    fi
    echo ""

    # Generic webhook setup
    echo "=== Generic Webhook Configuration ==="
    read -p "Enable webhook notifications? (y/n): " -r enable_webhook
    if [[ "$enable_webhook" =~ ^[Yy]$ ]]; then
        read -p "Webhook URL: " WEBHOOK_URL
        read -p "HTTP Method (GET|POST|PUT|PATCH) [default: POST]: " WEBHOOK_METHOD
        WEBHOOK_METHOD="${WEBHOOK_METHOD:-POST}"
    fi
    echo ""

    # Save configuration
    read -p "Save configuration? (y/n): " -r save_config_response
    if [[ "$save_config_response" =~ ^[Yy]$ ]]; then
        save_config
    fi
}

# ============================================================================
# SLACK NOTIFICATIONS
# ============================================================================

send_slack_notification() {
    local status=$1
    local title=$2
    local text=$3

    if [[ -z "$SLACK_WEBHOOK" ]]; then
        log_warn "Slack webhook not configured, skipping Slack notification"
        return 0
    fi

    log_info "Sending Slack notification..."

    local color="danger"
    case "$status" in
        success) color="good" ;;
        warning) color="warning" ;;
        pending) color="#0099ff" ;;
        error|failed) color="danger" ;;
        rolled_back) color="#ff9900" ;;
    esac

    local payload=$(cat <<EOF
{
    "attachments": [
        {
            "fallback": "$title",
            "color": "$color",
            "title": "$title",
            "text": "$text",
            "fields": [
                {"title": "Version", "value": "$DEPLOYMENT_VERSION", "short": true},
                {"title": "Status", "value": "$status", "short": true},
                {"title": "Timestamp", "value": "$DEPLOYMENT_TIMESTAMP", "short": true},
                {"title": "Host", "value": "$(hostname)", "short": true},
                {"title": "Duration", "value": "$DEPLOYMENT_DURATION s", "short": true}
            ],
            "ts": $(date +%s)
        }
    ]
}
EOF
)

    if curl -X POST -H 'Content-type: application/json' \
        --data "$payload" \
        "$SLACK_WEBHOOK" 2>/dev/null; then
        log_success "Slack notification sent"
        return 0
    else
        log_error "Failed to send Slack notification"
        return 1
    fi
}

# ============================================================================
# EMAIL NOTIFICATIONS
# ============================================================================

send_email_notification() {
    local status=$1
    local title=$2
    local text=$3

    if [[ -z "$EMAIL_TO" ]]; then
        log_warn "Email not configured, skipping email notification"
        return 0
    fi

    log_info "Sending email notification..."

    local subject="[${status}] ${title}"

    local body=$(cat <<EOF
Basset Hound Browser Notification

Status: $status
Title: $title
Message: $text

Details:
- Version: $DEPLOYMENT_VERSION
- Duration: $DEPLOYMENT_DURATION seconds
- Timestamp: $DEPLOYMENT_TIMESTAMP
- Host: $(hostname)

For more information, please check the deployment logs.
EOF
)

    # Check if mail command is available
    if ! command -v mail &>/dev/null; then
        log_warn "mail command not available, attempting msmtp..."
        if command -v msmtp &>/dev/null; then
            echo "$body" | msmtp "$EMAIL_TO" -t <<< "To: $EMAIL_TO
Subject: $subject

$body"
        else
            log_error "No mail utility available"
            return 1
        fi
    else
        # Use sendmail-compatible mail command
        if [[ -n "$EMAIL_CC" ]]; then
            echo "$body" | mail -c "$EMAIL_CC" -s "$subject" "$EMAIL_TO"
        else
            echo "$body" | mail -s "$subject" "$EMAIL_TO"
        fi
    fi

    if [[ $? -eq 0 ]]; then
        log_success "Email notification sent to $EMAIL_TO"
        return 0
    else
        log_error "Failed to send email notification"
        return 1
    fi
}

# ============================================================================
# WEBHOOK NOTIFICATIONS
# ============================================================================

send_webhook_notification() {
    local status=$1
    local title=$2
    local text=$3

    if [[ -z "$WEBHOOK_URL" ]]; then
        log_warn "Webhook URL not configured, skipping webhook notification"
        return 0
    fi

    log_info "Sending webhook notification..."

    local payload=$(cat <<EOF
{
    "type": "$NOTIFICATION_TYPE",
    "status": "$status",
    "title": "$title",
    "message": "$text",
    "version": "$DEPLOYMENT_VERSION",
    "duration_seconds": $DEPLOYMENT_DURATION,
    "timestamp": "$DEPLOYMENT_TIMESTAMP",
    "hostname": "$(hostname)",
    "notification_time": $(date +%s)
}
EOF
)

    if curl -X "$WEBHOOK_METHOD" \
        -H 'Content-type: application/json' \
        --data "$payload" \
        "$WEBHOOK_URL" 2>/dev/null; then
        log_success "Webhook notification sent"
        return 0
    else
        log_error "Failed to send webhook notification"
        return 1
    fi
}

# ============================================================================
# NOTIFICATION TEMPLATES
# ============================================================================

generate_notification_title() {
    case "$NOTIFICATION_TYPE" in
        deployment)
            echo "Deployment - Basset Hound Browser v${DEPLOYMENT_VERSION}"
            ;;
        health-check)
            echo "Health Check Report - Basset Hound Browser"
            ;;
        rollback)
            echo "Rollback Alert - Basset Hound Browser"
            ;;
        alert)
            echo "Alert - Basset Hound Browser"
            ;;
        *)
            echo "Notification - Basset Hound Browser"
            ;;
    esac
}

generate_notification_text() {
    case "$NOTIFICATION_TYPE" in
        deployment)
            case "$NOTIFICATION_STATUS" in
                success)
                    echo "✅ Deployment completed successfully in ${DEPLOYMENT_DURATION} seconds"
                    ;;
                failed)
                    echo "❌ Deployment failed after ${DEPLOYMENT_DURATION} seconds"
                    ;;
                rolled_back)
                    echo "⚠️ Deployment failed and rolled back automatically"
                    ;;
                *)
                    echo "⏳ Deployment status: $NOTIFICATION_STATUS"
                    ;;
            esac
            ;;
        health-check)
            echo "📊 Health check completed - Status: $NOTIFICATION_STATUS"
            ;;
        rollback)
            echo "🔄 Rollback initiated - Status: $NOTIFICATION_STATUS"
            ;;
        *)
            echo "$NOTIFICATION_MESSAGE"
            ;;
    esac
}

# ============================================================================
# TESTING
# ============================================================================

test_notifications() {
    log_info "Testing notification channels..."
    echo ""

    DEPLOYMENT_VERSION="12.9.0-TEST"
    DEPLOYMENT_DURATION="42"
    NOTIFICATION_MESSAGE="This is a test notification"

    local title=$(generate_notification_title)
    local text=$(generate_notification_text)

    # Test Slack
    if [[ -n "$SLACK_WEBHOOK" ]]; then
        echo "Testing Slack..."
        send_slack_notification "warning" "Test: $title" "$text"
    fi

    # Test Email
    if [[ -n "$EMAIL_TO" ]]; then
        echo "Testing Email..."
        send_email_notification "warning" "Test: $title" "$text"
    fi

    # Test Webhook
    if [[ -n "$WEBHOOK_URL" ]]; then
        echo "Testing Webhook..."
        send_webhook_notification "warning" "Test: $title" "$text"
    fi

    echo ""
    log_success "Notification test completed"
}

# ============================================================================
# MAIN NOTIFICATION FLOW
# ============================================================================

main() {
    # Load configuration
    load_config

    # Parse command line arguments (overrides config)
    parse_arguments "$@"

    # Generate notification content
    local title=$(generate_notification_title)
    local text="${NOTIFICATION_MESSAGE:-$(generate_notification_text)}"

    log_info "Sending notifications..."
    log_info "Type: $NOTIFICATION_TYPE"
    log_info "Status: $NOTIFICATION_STATUS"
    log_info "Version: $DEPLOYMENT_VERSION"
    log_info "Title: $title"
    echo ""

    # Send notifications
    local send_count=0
    local fail_count=0

    send_slack_notification "$NOTIFICATION_STATUS" "$title" "$text" || ((fail_count++))
    ((send_count++))

    send_email_notification "$NOTIFICATION_STATUS" "$title" "$text" || ((fail_count++))
    ((send_count++))

    send_webhook_notification "$NOTIFICATION_STATUS" "$title" "$text" || ((fail_count++))
    ((send_count++))

    echo ""
    log_info "Notification summary: $((send_count - fail_count))/$send_count sent successfully"

    if [[ $fail_count -eq 0 ]]; then
        log_success "All notification channels completed"
        exit 0
    else
        log_warn "$fail_count notification channel(s) had issues"
        exit 1
    fi
}

# ============================================================================
# SCRIPT EXECUTION
# ============================================================================

main "$@"
