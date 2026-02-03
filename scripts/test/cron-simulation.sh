#!/bin/bash

# Cron simulation script for youth poll scheduler
# This script simulates the daily cron job that triggers youth poll creation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="${SCRIPT_DIR}/cron-simulation.log"
PID_FILE="${SCRIPT_DIR}/cron-simulation.pid"

# Function to log with timestamp
log_with_timestamp() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to check if Netlify dev is running
check_netlify_dev() {
    if curl -s "http://localhost:8889" > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to trigger youth poll scheduler
trigger_youth_poll_scheduler() {
    local url="$1"
    
    if [ -z "$url" ]; then
        print_error "URL is required"
        return 1
    fi
    
    log_with_timestamp "Triggering youth poll scheduler at $url"
    
    # Make the request
    RESPONSE=$(curl -s -X POST "$url" \
        -H "Content-Type: application/json" \
        -H "User-Agent: Cron-Simulation/1.0" \
        -d '{
            "httpMethod": "POST",
            "headers": {
                "user-agent": "Cron-Simulation/1.0",
                "content-type": "application/json"
            },
            "body": "{}",
            "isBase64Encoded": false
        }' \
        -w "HTTP_STATUS:%{http_code}")
    
    HTTP_STATUS=$(echo "$RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
    RESPONSE_BODY=$(echo "$RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')
    
    log_with_timestamp "Response: HTTP $HTTP_STATUS"
    log_with_timestamp "Body: $RESPONSE_BODY"
    
    if [ "$HTTP_STATUS" = "200" ]; then
        if echo "$RESPONSE_BODY" | grep -q '"success":true'; then
            log_with_timestamp "SUCCESS: Youth poll scheduler executed successfully"
            return 0
        else
            log_with_timestamp "WARNING: Function executed but may have issues"
            return 1
        fi
    else
        log_with_timestamp "ERROR: Function failed with HTTP $HTTP_STATUS"
        return 1
    fi
}

# Function to run scheduled simulation
run_scheduled_simulation() {
    local url="$1"
    local interval="$2"
    
    if [ -z "$url" ]; then
        print_error "URL is required for scheduled simulation"
        exit 1
    fi
    
    if [ -z "$interval" ]; then
        interval=3600  # Default: 1 hour
    fi
    
    print_status "Starting scheduled simulation..."
    print_status "URL: $url"
    print_status "Interval: ${interval} seconds"
    print_status "Log file: $LOG_FILE"
    print_status "PID file: $PID_FILE"
    
    # Save PID
    echo $$ > "$PID_FILE"
    
    log_with_timestamp "Scheduled simulation started"
    log_with_timestamp "URL: $url"
    log_with_timestamp "Interval: ${interval} seconds"
    
    # Main loop
    while true; do
        # Check if Netlify dev is running (for local testing)
        if [[ "$url" == *"localhost"* ]]; then
            if ! check_netlify_dev; then
                log_with_timestamp "WARNING: Netlify dev is not running, skipping trigger"
                sleep "$interval"
                continue
            fi
        fi
        
        # Trigger the scheduler
        if trigger_youth_poll_scheduler "$url"; then
            log_with_timestamp "Trigger completed successfully"
        else
            log_with_timestamp "Trigger completed with issues"
        fi
        
        # Wait for next interval
        log_with_timestamp "Waiting ${interval} seconds until next trigger..."
        sleep "$interval"
    done
}

# Function to stop scheduled simulation
stop_scheduled_simulation() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            kill "$PID"
            rm -f "$PID_FILE"
            print_success "Scheduled simulation stopped (PID: $PID)"
            log_with_timestamp "Scheduled simulation stopped by user"
        else
            print_warning "Process not running, cleaning up PID file"
            rm -f "$PID_FILE"
        fi
    else
        print_warning "No PID file found, simulation may not be running"
    fi
}

# Function to check status
check_status() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            print_success "Scheduled simulation is running (PID: $PID)"
            print_status "Log file: $LOG_FILE"
            return 0
        else
            print_warning "PID file exists but process is not running"
            rm -f "$PID_FILE"
            return 1
        fi
    else
        print_warning "Scheduled simulation is not running"
        return 1
    fi
}

# Function to show logs
show_logs() {
    local lines="${1:-50}"
    
    if [ -f "$LOG_FILE" ]; then
        print_status "Last $lines lines from log file:"
        echo "=" .repeat(50)
        tail -n "$lines" "$LOG_FILE"
    else
        print_warning "Log file not found: $LOG_FILE"
    fi
}

# Function to show help
show_help() {
    echo "Youth Poll Cron Simulation Script"
    echo
    echo "Usage: $0 COMMAND [OPTIONS]"
    echo
    echo "Commands:"
    echo "  trigger URL                Trigger youth poll scheduler once"
    echo "  start URL [INTERVAL]       Start scheduled simulation"
    echo "  stop                       Stop scheduled simulation"
    echo "  status                     Check simulation status"
    echo "  logs [LINES]               Show recent logs (default: 50 lines)"
    echo "  help                       Show this help"
    echo
    echo "Examples:"
    echo "  $0 trigger http://localhost:8889/.netlify/functions/poll-scheduler"
    echo "  $0 start http://localhost:8889/.netlify/functions/poll-scheduler 900"
    echo "  $0 start https://f5fa2ef2--church-telegram-bot.netlify.live/.netlify/functions/poll-scheduler 900"
    echo "  $0 stop"
    echo "  $0 status"
    echo "  $0 logs 100"
    echo
    echo "Notes:"
    echo "  - INTERVAL is in seconds (default: 3600 = 1 hour)"
    echo "  - For local testing, ensure Netlify dev is running"
    echo "  - Logs are saved to: $LOG_FILE"
    echo "  - PID is saved to: $PID_FILE"
}

# Main execution
main() {
    if [ $# -eq 0 ]; then
        show_help
        exit 0
    fi
    
    case "$1" in
        "trigger")
            if [ -z "$2" ]; then
                print_error "URL is required for 'trigger' command"
                exit 1
            fi
            trigger_youth_poll_scheduler "$2"
            ;;
        "start")
            if [ -z "$2" ]; then
                print_error "URL is required for 'start' command"
                exit 1
            fi
            run_scheduled_simulation "$2" "$3"
            ;;
        "stop")
            stop_scheduled_simulation
            ;;
        "status")
            check_status
            ;;
        "logs")
            show_logs "$2"
            ;;
        "help"|"--help"|"-h")
            show_help
            ;;
        *)
            print_error "Unknown command: $1"
            echo "Use 'help' for usage information"
            exit 1
            ;;
    esac
}

# Handle signals for graceful shutdown
trap 'log_with_timestamp "Received signal, shutting down..."; rm -f "$PID_FILE"; exit 0' INT TERM

# Run main function
main "$@"
