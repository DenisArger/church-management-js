#!/bin/bash

# Test script for Netlify youth-poll-scheduler function
# Tests both local Netlify dev and deployed function

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

# Function to test local Netlify dev function
test_local_function() {
    print_status "Testing local Netlify dev function..."
    
    local netlify_dev_url="http://localhost:8889/.netlify/functions/youth-poll-scheduler"
    
    print_status "Testing URL: $netlify_dev_url"
    
    # Test the function endpoint
    RESPONSE=$(curl -s -X POST "$netlify_dev_url" \
        -H "Content-Type: application/json" \
        -d '{"httpMethod": "POST", "headers": {"user-agent": "test-script"}}' \
        -w "HTTP_STATUS:%{http_code}")
    
    HTTP_STATUS=$(echo "$RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
    RESPONSE_BODY=$(echo "$RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')
    
    if [ "$HTTP_STATUS" = "200" ]; then
        print_success "Local function test PASSED (HTTP $HTTP_STATUS)"
        echo "Response: $RESPONSE_BODY"
        
        # Check if response contains success
        if echo "$RESPONSE_BODY" | grep -q '"success":true'; then
            print_success "Function executed successfully"
        else
            print_warning "Function executed but may have issues"
        fi
    else
        print_error "Local function test FAILED (HTTP $HTTP_STATUS)"
        echo "Response: $RESPONSE_BODY"
    fi
}

# Function to test deployed Netlify function
test_deployed_function() {
    local netlify_url="$1"
    
    if [ -z "$netlify_url" ]; then
        print_error "Netlify URL is required for deployed function test"
        return 1
    fi
    
    print_status "Testing deployed Netlify function..."
    
    # Remove trailing slash if present
    netlify_url=$(echo "$netlify_url" | sed 's:/*$::')
    local function_url="${netlify_url}/.netlify/functions/youth-poll-scheduler"
    
    print_status "Testing URL: $function_url"
    
    # Test the function endpoint
    RESPONSE=$(curl -s -X POST "$function_url" \
        -H "Content-Type: application/json" \
        -d '{"httpMethod": "POST", "headers": {"user-agent": "test-script"}}' \
        -w "HTTP_STATUS:%{http_code}")
    
    HTTP_STATUS=$(echo "$RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
    RESPONSE_BODY=$(echo "$RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')
    
    if [ "$HTTP_STATUS" = "200" ]; then
        print_success "Deployed function test PASSED (HTTP $HTTP_STATUS)"
        echo "Response: $RESPONSE_BODY"
        
        # Check if response contains success
        if echo "$RESPONSE_BODY" | grep -q '"success":true'; then
            print_success "Function executed successfully"
        else
            print_warning "Function executed but may have issues"
        fi
    else
        print_error "Deployed function test FAILED (HTTP $HTTP_STATUS)"
        echo "Response: $RESPONSE_BODY"
    fi
}

# Function to check if Netlify dev is running
check_netlify_dev() {
    print_status "Checking if Netlify dev is running..."
    
    if curl -s "http://localhost:8889" > /dev/null 2>&1; then
        print_success "Netlify dev is running on port 8889"
        return 0
    else
        print_error "Netlify dev is not running on port 8889"
        print_status "Start it with: netlify dev --live"
        return 1
    fi
}

# Function to simulate cron trigger
simulate_cron_trigger() {
    local url="$1"
    
    if [ -z "$url" ]; then
        print_error "URL is required for cron simulation"
        return 1
    fi
    
    print_status "Simulating cron trigger for youth poll scheduler..."
    
    # Simulate the exact request that Netlify cron would send
    RESPONSE=$(curl -s -X POST "$url" \
        -H "Content-Type: application/json" \
        -H "User-Agent: Netlify-Cron/1.0" \
        -d '{
            "httpMethod": "POST",
            "headers": {
                "user-agent": "Netlify-Cron/1.0",
                "content-type": "application/json"
            },
            "body": "{}",
            "isBase64Encoded": false
        }' \
        -w "HTTP_STATUS:%{http_code}")
    
    HTTP_STATUS=$(echo "$RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
    RESPONSE_BODY=$(echo "$RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')
    
    if [ "$HTTP_STATUS" = "200" ]; then
        print_success "Cron simulation PASSED (HTTP $HTTP_STATUS)"
        echo "Response: $RESPONSE_BODY"
        
        # Check if response contains success
        if echo "$RESPONSE_BODY" | grep -q '"success":true'; then
            print_success "Scheduled function executed successfully"
        else
            print_warning "Scheduled function executed but may have issues"
        fi
    else
        print_error "Cron simulation FAILED (HTTP $HTTP_STATUS)"
        echo "Response: $RESPONSE_BODY"
    fi
}

# Function to show help
show_help() {
    echo "Youth Poll Scheduler Test Script"
    echo
    echo "Usage: $0 COMMAND [OPTIONS]"
    echo
    echo "Commands:"
    echo "  local                    Test local Netlify dev function"
    echo "  deployed URL             Test deployed Netlify function"
    echo "  cron URL                 Simulate cron trigger"
    echo "  check-dev                Check if Netlify dev is running"
    echo "  all URL                  Run all tests (local + deployed)"
    echo
    echo "Examples:"
    echo "  $0 local"
    echo "  $0 deployed https://f5fa2ef2--church-telegram-bot.netlify.live"
    echo "  $0 cron https://f5fa2ef2--church-telegram-bot.netlify.live/.netlify/functions/youth-poll-scheduler"
    echo "  $0 check-dev"
    echo "  $0 all https://f5fa2ef2--church-telegram-bot.netlify.live"
    echo
}

# Main execution
main() {
    if [ $# -eq 0 ]; then
        show_help
        exit 0
    fi
    
    case "$1" in
        "local")
            if check_netlify_dev; then
                test_local_function
            fi
            ;;
        "deployed")
            if [ -z "$2" ]; then
                print_error "URL is required for 'deployed' command"
                exit 1
            fi
            test_deployed_function "$2"
            ;;
        "cron")
            if [ -z "$2" ]; then
                print_error "URL is required for 'cron' command"
                exit 1
            fi
            simulate_cron_trigger "$2"
            ;;
        "check-dev")
            check_netlify_dev
            ;;
        "all")
            if [ -z "$2" ]; then
                print_error "URL is required for 'all' command"
                exit 1
            fi
            echo "Running all tests..."
            echo "=" .repeat(50)
            
            if check_netlify_dev; then
                test_local_function
                echo
            fi
            
            test_deployed_function "$2"
            echo
            
            simulate_cron_trigger "${2}/.netlify/functions/youth-poll-scheduler"
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

# Run main function
main "$@"
