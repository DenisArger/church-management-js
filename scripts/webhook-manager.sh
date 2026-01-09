#!/bin/bash

# Church Telegram Bot - Webhook Manager
# This script manages Telegram webhook settings

set -e  # Exit on any error

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Get the project root directory (parent of scripts directory)
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Change to project root directory
cd "$PROJECT_ROOT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to get bot token from .env
get_bot_token() {
    if [ ! -f ".env" ]; then
        print_error ".env file not found!"
        exit 1
    fi
    
    BOT_TOKEN=$(grep "^TELEGRAM_BOT_TOKEN=" .env | cut -d'=' -f2 | tr -d '"')
    
    if [ -z "$BOT_TOKEN" ]; then
        print_error "TELEGRAM_BOT_TOKEN not found in .env"
        exit 1
    fi
    
    echo "$BOT_TOKEN"
}

# Function to set webhook
set_webhook() {
    local webhook_url="$1"
    
    if [ -z "$webhook_url" ]; then
        print_error "Webhook URL is required"
        exit 1
    fi
    
    BOT_TOKEN=$(get_bot_token)
    
    print_status "Setting webhook URL: $webhook_url"
    
    # Set webhook using Telegram Bot API
    RESPONSE=$(curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
        -H "Content-Type: application/json" \
        -d "{\"url\":\"${webhook_url}\"}")
    
    # Check if webhook was set successfully
    if echo "$RESPONSE" | grep -q '"ok":true'; then
        print_success "Webhook set successfully"
        return 0
    else
        print_error "Failed to set webhook"
        echo "Response: $RESPONSE"
        return 1
    fi
}

# Function to delete webhook
delete_webhook() {
    BOT_TOKEN=$(get_bot_token)
    
    print_status "Deleting webhook..."
    
    # Delete webhook using Telegram Bot API
    RESPONSE=$(curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook")
    
    # Check if webhook was deleted successfully
    if echo "$RESPONSE" | grep -q '"ok":true'; then
        print_success "Webhook deleted successfully"
        return 0
    else
        print_error "Failed to delete webhook"
        echo "Response: $RESPONSE"
        return 1
    fi
}

# Function to get webhook info
get_webhook_info() {
    BOT_TOKEN=$(get_bot_token)
    
    print_status "Getting webhook information..."
    
    # Get webhook info using Telegram Bot API
    RESPONSE=$(curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo")
    
    # Check if request was successful
    if echo "$RESPONSE" | grep -q '"ok":true'; then
        print_success "Webhook information retrieved"
        echo
        
        # Try to format with jq if available, otherwise parse manually
        if command -v jq >/dev/null 2>&1; then
            echo "$RESPONSE" | jq '.'
        else
            # Extract key information from JSON manually
            URL=$(echo "$RESPONSE" | grep -o '"url":"[^"]*' | cut -d'"' -f4)
            PENDING=$(echo "$RESPONSE" | grep -o '"pending_update_count":[0-9]*' | cut -d':' -f2)
            MAX_CONN=$(echo "$RESPONSE" | grep -o '"max_connections":[0-9]*' | cut -d':' -f2)
            IP=$(echo "$RESPONSE" | grep -o '"ip_address":"[^"]*' | cut -d'"' -f4)
            
            echo "Webhook URL: ${URL:-not set}"
            echo "Pending updates: ${PENDING:-0}"
            echo "Max connections: ${MAX_CONN:-40}"
            if [ -n "$IP" ]; then
                echo "IP address: $IP"
            fi
            echo
            echo "Full response:"
            echo "$RESPONSE"
        fi
        return 0
    else
        print_error "Failed to get webhook information"
        echo "Response: $RESPONSE"
        return 1
    fi
}

# Function to test webhook
test_webhook() {
    local webhook_url="$1"
    
    if [ -z "$webhook_url" ]; then
        print_error "Webhook URL is required for testing"
        exit 1
    fi
    
    print_status "Testing webhook endpoint: $webhook_url"
    
    # Test webhook endpoint
    RESPONSE=$(curl -s -X POST "$webhook_url" \
        -H "Content-Type: application/json" \
        -d '{"update_id": 1, "message": {"message_id": 1, "from": {"id": 123456789, "first_name": "Test"}, "chat": {"id": 123456789, "type": "private"}, "text": "/help", "date": 1234567890}}')
    
    if echo "$RESPONSE" | grep -q "status"; then
        print_success "Webhook endpoint is responding"
        echo "Response: $RESPONSE"
        return 0
    else
        print_warning "Webhook endpoint test failed"
        echo "Response: $RESPONSE"
        return 1
    fi
}

# Function to set webhook from Netlify URL
set_webhook_from_netlify() {
    local netlify_url="$1"
    
    if [ -z "$netlify_url" ]; then
        print_error "Netlify URL is required"
        exit 1
    fi
    
    # Remove trailing slash if present
    netlify_url=$(echo "$netlify_url" | sed 's:/*$::')
    
    # Construct webhook URL
    webhook_url="${netlify_url}/.netlify/functions/telegram-webhook"
    
    print_status "Setting webhook from Netlify URL: $netlify_url"
    print_status "Webhook URL will be: $webhook_url"
    
    set_webhook "$webhook_url"
}

# Function to get Netlify URL from various sources
# Outputs only URL to stdout, messages to stderr
get_netlify_url() {
    # First try .netlify-url file
    if [ -f ".netlify-url" ]; then
        cat .netlify-url
        return
    fi
    
    # Try to get from netlify status
    if command -v netlify >/dev/null 2>&1; then
        print_status "Trying to get URL from netlify status..." >&2
        if netlify status >/dev/null 2>&1; then
            if command -v jq >/dev/null 2>&1; then
                URL=$(netlify status --json 2>/dev/null | jq -r '.site.url // empty' 2>/dev/null)
            else
                STATUS_OUTPUT=$(netlify status 2>&1)
                URL=$(echo "$STATUS_OUTPUT" | grep -iE "(Site url|Website URL):" | sed -n 's/.*[Uu]RL:[[:space:]]*\(https\?:\/\/[^[:space:]]*\).*/\1/p' | head -1)
            fi
            
            if [ -n "$URL" ] && [ "$URL" != "null" ] && [ "$URL" != "" ]; then
                print_success "Found URL from netlify status: $URL" >&2
                echo "$URL"
                return
            fi
        fi
    fi
    
    # Return empty string if URL not found
    echo ""
}

# Function to set webhook from .netlify-url file
set_webhook_from_file() {
    netlify_url=$(get_netlify_url)
    
    if [ -z "$netlify_url" ]; then
        print_error ".netlify-url file not found and could not get URL from netlify status"
        print_status "Please do one of the following:"
        echo "  1. Run deployment: ./scripts/deploy.sh"
        echo "  2. Set webhook manually: $0 set-netlify <URL>"
        echo "  3. Create .netlify-url file manually with your Netlify site URL"
        exit 1
    fi
    
    set_webhook_from_netlify "$netlify_url"
}

# Function to set webhook from ngrok URL
set_webhook_from_ngrok() {
    local ngrok_url="$1"
    
    if [ -z "$ngrok_url" ]; then
        print_error "ngrok URL is required"
        exit 1
    fi
    
    # Remove trailing slash if present
    ngrok_url=$(echo "$ngrok_url" | sed 's:/*$::')
    
    # Construct webhook URL
    webhook_url="${ngrok_url}/.netlify/functions/telegram-webhook"
    
    print_status "Setting webhook from ngrok URL: $ngrok_url"
    print_status "Webhook URL will be: $webhook_url"
    
    set_webhook "$webhook_url"
}

# Function to set webhook from .ngrok-url file
set_webhook_from_ngrok_file() {
    if [ ! -f ".ngrok-url" ]; then
        print_error ".ngrok-url file not found. Please start ngrok session first."
        exit 1
    fi
    
    ngrok_url=$(cat .ngrok-url)
    set_webhook_from_ngrok "$ngrok_url"
}

# Function to show help
show_help() {
    echo "Church Telegram Bot - Webhook Manager"
    echo
    echo "Usage: $0 COMMAND [OPTIONS]"
    echo
    echo "Commands:"
    echo "  set URL                    Set webhook to specified URL"
    echo "  set-netlify URL           Set webhook from Netlify URL"
    echo "  set-file                  Set webhook from .netlify-url file"
    echo "  set-ngrok URL             Set webhook from ngrok URL"
    echo "  set-ngrok-file            Set webhook from .ngrok-url file"
    echo "  delete                    Delete current webhook"
    echo "  info                      Get webhook information"
    echo "  test URL                  Test webhook endpoint"
    echo "  test-netlify URL          Test webhook from Netlify URL"
    echo "  test-file                 Test webhook from .netlify-url file"
    echo "  test-ngrok URL            Test webhook from ngrok URL"
    echo "  test-ngrok-file           Test webhook from .ngrok-url file"
    echo
    echo "Examples:"
    echo "  $0 set https://mybot.netlify.app/.netlify/functions/telegram-webhook"
    echo "  $0 set-netlify https://mybot.netlify.app"
    echo "  $0 set-file"
    echo "  $0 set-ngrok https://abc123.ngrok.io"
    echo "  $0 set-ngrok-file"
    echo "  $0 delete"
    echo "  $0 info"
    echo "  $0 test https://mybot.netlify.app/.netlify/functions/telegram-webhook"
    echo "  $0 test-ngrok https://abc123.ngrok.io"
    echo
}

# Main execution
main() {
    if [ $# -eq 0 ]; then
        show_help
        exit 0
    fi
    
    case "$1" in
        "set")
            if [ -z "$2" ]; then
                print_error "URL is required for 'set' command"
                exit 1
            fi
            set_webhook "$2"
            ;;
        "set-netlify")
            if [ -z "$2" ]; then
                print_error "Netlify URL is required for 'set-netlify' command"
                exit 1
            fi
            set_webhook_from_netlify "$2"
            ;;
        "set-file")
            set_webhook_from_file
            ;;
        "set-ngrok")
            if [ -z "$2" ]; then
                print_error "ngrok URL is required for 'set-ngrok' command"
                exit 1
            fi
            set_webhook_from_ngrok "$2"
            ;;
        "set-ngrok-file")
            set_webhook_from_ngrok_file
            ;;
        "delete")
            delete_webhook
            ;;
        "info")
            get_webhook_info
            ;;
        "test")
            if [ -z "$2" ]; then
                print_error "URL is required for 'test' command"
                exit 1
            fi
            test_webhook "$2"
            ;;
        "test-netlify")
            if [ -z "$2" ]; then
                print_error "Netlify URL is required for 'test-netlify' command"
                exit 1
            fi
            netlify_url="$2"
            netlify_url=$(echo "$netlify_url" | sed 's:/*$::')
            webhook_url="${netlify_url}/.netlify/functions/telegram-webhook"
            test_webhook "$webhook_url"
            ;;
        "test-file")
            netlify_url=$(get_netlify_url)
            if [ -z "$netlify_url" ]; then
                print_error ".netlify-url file not found and could not get URL from netlify status"
                print_status "Please do one of the following:"
                echo "  1. Run deployment: ./scripts/deploy.sh"
                echo "  2. Test webhook manually: $0 test-netlify <URL>"
                exit 1
            fi
            netlify_url=$(echo "$netlify_url" | sed 's:/*$::')
            webhook_url="${netlify_url}/.netlify/functions/telegram-webhook"
            test_webhook "$webhook_url"
            ;;
        "test-ngrok")
            if [ -z "$2" ]; then
                print_error "ngrok URL is required for 'test-ngrok' command"
                exit 1
            fi
            ngrok_url="$2"
            ngrok_url=$(echo "$ngrok_url" | sed 's:/*$::')
            webhook_url="${ngrok_url}/.netlify/functions/telegram-webhook"
            test_webhook "$webhook_url"
            ;;
        "test-ngrok-file")
            if [ ! -f ".ngrok-url" ]; then
                print_error ".ngrok-url file not found. Please start ngrok session first."
                exit 1
            fi
            ngrok_url=$(cat .ngrok-url)
            ngrok_url=$(echo "$ngrok_url" | sed 's:/*$::')
            webhook_url="${ngrok_url}/.netlify/functions/telegram-webhook"
            test_webhook "$webhook_url"
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
