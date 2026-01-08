#!/bin/bash

# Church Telegram Bot - Ngrok Testing Script
# This script starts local development server with ngrok and sets up webhook

set -e  # Exit on any error

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

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check requirements
check_requirements() {
    print_status "Checking requirements for ngrok testing..."
    
    local missing_requirements=()
    
    # Check Node.js
    if ! command_exists node; then
        missing_requirements+=("Node.js")
    fi
    
    # Check Yarn
    if ! command_exists yarn; then
        missing_requirements+=("Yarn")
    fi
    
    # Check Netlify CLI (try netlify, npx netlify, or yarn netlify)
    NETLIFY_CMD=""
    if command_exists netlify; then
        NETLIFY_CMD="netlify"
    elif command_exists npx; then
        NETLIFY_CMD="npx netlify"
    elif command_exists yarn; then
        NETLIFY_CMD="yarn netlify"
    fi
    
    if [ -z "$NETLIFY_CMD" ]; then
        missing_requirements+=("Netlify CLI (install via: yarn add -D netlify-cli)")
    fi
    
    # Check ngrok
    NGROK_PATH=""
    # Try different possible paths for ngrok
    for path in "/mnt/c/ProgramData/chocolatey/bin/ngrok.exe" "/mnt/c/Program Files/chocolatey/bin/ngrok.exe" "/usr/local/bin/ngrok" "/usr/bin/ngrok" "$HOME/bin/ngrok"; do
        if [ -f "$path" ] || command_exists ngrok; then
            NGROK_PATH="$path"
            break
        fi
    done
    
    if [ -z "$NGROK_PATH" ] && ! command_exists ngrok; then
        missing_requirements+=("ngrok")
    fi
    
    # Check curl
    if ! command_exists curl; then
        missing_requirements+=("curl")
    fi
    
    if [ ${#missing_requirements[@]} -ne 0 ]; then
        print_error "Missing requirements:"
        for req in "${missing_requirements[@]}"; do
            echo "  - $req"
        done
        echo
        echo "Please install missing requirements:"
        echo "  - Node.js: https://nodejs.org/"
        echo "  - Yarn: npm install -g yarn"
        echo "  - Netlify CLI: npm install -g netlify-cli"
        echo "  - ngrok: https://ngrok.com/download"
        exit 1
    fi
    
    print_success "All requirements satisfied"
}

# Function to check environment
check_environment() {
    print_status "Checking environment configuration..."
    
    if [ ! -f ".env" ]; then
        print_error ".env file not found!"
        print_status "Please create .env file from env.example"
        exit 1
    fi
    
    # Check for required environment variables
    required_vars=(
        "TELEGRAM_BOT_TOKEN"
        "NOTION_TOKEN"
        "NOTION_PRAYER_DATABASE"
        "NOTION_GENERAL_CALENDAR_DATABASE"
        "NOTION_DAILY_DISTRIBUTION_DATABASE"
        "NOTION_WEEKLY_PRAYER_DATABASE"
        "ALLOWED_USERS"
    )
    
    missing_vars=()
    for var in "${required_vars[@]}"; do
        if ! grep -q "^${var}=" .env; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        print_error "Missing required environment variables:"
        for var in "${missing_vars[@]}"; do
            echo "  - $var"
        done
        exit 1
    fi
    
    print_success "Environment configuration check passed"
}

# Function to get bot token
get_bot_token() {
    BOT_TOKEN=$(grep "^TELEGRAM_BOT_TOKEN=" .env | cut -d'=' -f2 | tr -d '"')
    echo "$BOT_TOKEN"
}

# Function to build project
build_project() {
    print_status "Building project..."
    
    yarn build
    
    if [ $? -eq 0 ]; then
        print_success "Build completed successfully"
    else
        print_error "Build failed"
        exit 1
    fi
}

# Function to start netlify dev server
start_netlify_dev() {
    print_status "Starting Netlify development server..."
    
    # Determine netlify command
    if [ -z "$NETLIFY_CMD" ]; then
        if command_exists netlify; then
            NETLIFY_CMD="netlify"
        elif command_exists npx; then
            NETLIFY_CMD="npx netlify"
        elif command_exists yarn; then
            NETLIFY_CMD="yarn netlify"
        else
            print_error "Netlify CLI not found"
            exit 1
        fi
    fi
    
    print_status "Using Netlify command: $NETLIFY_CMD"
    
    # Start netlify dev in background and disown it
    nohup $NETLIFY_CMD dev --port 8888 > .netlify-dev.log 2>&1 &
    NETLIFY_PID=$!
    
    # Wait for server to start
    print_status "Waiting for Netlify dev server to start..."
    sleep 8
    
    # Check if server is running
    if ! kill -0 $NETLIFY_PID 2>/dev/null; then
        print_error "Failed to start Netlify dev server"
        print_status "Check .netlify-dev.log for details"
        cat .netlify-dev.log 2>/dev/null | tail -20
        exit 1
    fi
    
    print_success "Netlify dev server started (PID: $NETLIFY_PID)"
    echo $NETLIFY_PID > .netlify-dev.pid
    # Disown the process so it continues after script exits
    disown $NETLIFY_PID 2>/dev/null || true
}

# Function to start ngrok tunnel
start_ngrok() {
    print_status "Starting ngrok tunnel..."
    
    # Determine ngrok command
    NGROK_CMD=""
    for path in "/mnt/c/ProgramData/chocolatey/bin/ngrok.exe" "/mnt/c/Program Files/chocolatey/bin/ngrok.exe" "/usr/local/bin/ngrok" "/usr/bin/ngrok" "$HOME/bin/ngrok"; do
        if [ -f "$path" ]; then
            NGROK_CMD="$path"
            break
        fi
    done
    
    # If no path found, try using ngrok from PATH
    if [ -z "$NGROK_CMD" ] && command_exists ngrok; then
        NGROK_CMD="ngrok"
    fi
    
    if [ -z "$NGROK_CMD" ]; then
        print_error "ngrok not found. Please install ngrok first."
        exit 1
    fi
    
    print_status "Using ngrok: $NGROK_CMD"
    
    # Start ngrok tunnel in background and disown it
    nohup "$NGROK_CMD" http 8888 --log=stdout > .ngrok.log 2>&1 &
    NGROK_PID=$!
    
    # Wait for ngrok to start
    print_status "Waiting for ngrok tunnel to establish..."
    sleep 5
    
    # Check if ngrok is running
    if ! kill -0 $NGROK_PID 2>/dev/null; then
        print_error "Failed to start ngrok tunnel"
        print_status "Check .ngrok.log for details"
        cat .ngrok.log 2>/dev/null | tail -20
        exit 1
    fi
    
    # Get ngrok URL
    NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"https://[^"]*"' | head -1 | cut -d'"' -f4)
    
    if [ -z "$NGROK_URL" ]; then
        print_error "Failed to get ngrok URL"
        exit 1
    fi
    
    print_success "ngrok tunnel established: $NGROK_URL"
    echo $NGROK_PID > .ngrok.pid
    echo $NGROK_URL > .ngrok-url
    
    WEBHOOK_URL="${NGROK_URL}/.netlify/functions/telegram-webhook"
    echo $WEBHOOK_URL > .webhook-url
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

# Function to cleanup processes
cleanup() {
    print_status "Cleaning up processes..."
    
    # Kill netlify dev server
    if [ -f ".netlify-dev.pid" ]; then
        NETLIFY_PID=$(cat .netlify-dev.pid)
        if kill -0 $NETLIFY_PID 2>/dev/null; then
            # Try graceful shutdown first
            kill $NETLIFY_PID 2>/dev/null
            sleep 2
            # Force kill if still running
            if kill -0 $NETLIFY_PID 2>/dev/null; then
                kill -9 $NETLIFY_PID 2>/dev/null
            fi
            print_status "Stopped Netlify dev server (PID: $NETLIFY_PID)"
        fi
        rm -f .netlify-dev.pid
    fi
    
    # Kill ngrok tunnel
    if [ -f ".ngrok.pid" ]; then
        NGROK_PID=$(cat .ngrok.pid)
        if kill -0 $NGROK_PID 2>/dev/null; then
            # Try graceful shutdown first
            kill $NGROK_PID 2>/dev/null
            sleep 1
            # Force kill if still running
            if kill -0 $NGROK_PID 2>/dev/null; then
                kill -9 $NGROK_PID 2>/dev/null
            fi
            print_status "Stopped ngrok tunnel (PID: $NGROK_PID)"
        fi
        rm -f .ngrok.pid
    fi
    
    # Also try to kill by process name (in case PID file is missing)
    pkill -f "netlify dev" 2>/dev/null && print_status "Stopped remaining Netlify dev processes"
    pkill -f "ngrok http" 2>/dev/null && print_status "Stopped remaining ngrok processes"
    
    # Clean up temporary files (keep logs for debugging)
    rm -f .ngrok-url .webhook-url
    
    print_success "Cleanup completed"
}

# Function to show status
show_status() {
    echo
    echo "=========================================="
    echo "Ngrok Testing Status"
    echo "=========================================="
    
    if [ -f ".ngrok-url" ]; then
        NGROK_URL=$(cat .ngrok-url)
        WEBHOOK_URL=$(cat .webhook-url)
        
        echo "ngrok URL: $NGROK_URL"
        echo "Webhook URL: $WEBHOOK_URL"
        echo
        
        # Get webhook info
        BOT_TOKEN=$(get_bot_token)
        WEBHOOK_INFO=$(curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo")
        echo "Current webhook info:"
        echo "$WEBHOOK_INFO" | jq '.' 2>/dev/null || echo "$WEBHOOK_INFO"
    else
        echo "No active ngrok session found"
    fi
    
    echo
}

# Function to show help
show_help() {
    echo "Church Telegram Bot - Ngrok Testing Script"
    echo
    echo "Usage: $0 COMMAND [OPTIONS]"
    echo
    echo "Commands:"
    echo "  start                     Start ngrok testing session"
    echo "  stop                      Stop ngrok testing session"
    echo "  restart                   Restart ngrok testing session"
    echo "  status                    Show current status"
    echo "  test                      Test webhook endpoint"
    echo "  webhook-info              Get webhook information"
    echo "  help                      Show this help message"
    echo
    echo "Options:"
    echo "  --skip-build              Skip building the project"
    echo "  --skip-webhook            Skip setting webhook"
    echo "  --skip-test               Skip testing webhook"
    echo
    echo "Examples:"
    echo "  $0 start                  # Start full testing session"
    echo "  $0 start --skip-build     # Start without building"
    echo "  $0 stop                   # Stop testing session"
    echo "  $0 status                 # Show current status"
    echo "  $0 test                   # Test webhook endpoint"
    echo
}

# Main execution
main() {
    if [ $# -eq 0 ]; then
        show_help
        exit 0
    fi
    
    # Parse command line arguments
    SKIP_BUILD=false
    SKIP_WEBHOOK=false
    SKIP_TEST=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-build)
                SKIP_BUILD=true
                shift
                ;;
            --skip-webhook)
                SKIP_WEBHOOK=true
                shift
                ;;
            --skip-test)
                SKIP_TEST=true
                shift
                ;;
            *)
                break
                ;;
        esac
    done
    
    case "$1" in
        "start")
            echo "=========================================="
            echo "Starting Ngrok Testing Session"
            echo "=========================================="
            echo
            
            # Check requirements
            check_requirements
            
            # Check environment
            check_environment
            
            # Build project
            if [ "$SKIP_BUILD" = false ]; then
                build_project
            else
                print_warning "Skipping build step"
            fi
            
            # Start netlify dev server
            start_netlify_dev
            
            # Start ngrok tunnel
            start_ngrok
            
            # Set webhook
            if [ "$SKIP_WEBHOOK" = false ]; then
                WEBHOOK_URL=$(cat .webhook-url)
                set_webhook "$WEBHOOK_URL"
            else
                print_warning "Skipping webhook setup"
            fi
            
            # Test webhook
            if [ "$SKIP_TEST" = false ]; then
                WEBHOOK_URL=$(cat .webhook-url)
                test_webhook "$WEBHOOK_URL"
            else
                print_warning "Skipping webhook test"
            fi
            
            echo
            print_success "Ngrok testing session started successfully!"
            echo
            echo "Your bot is now accessible at:"
            echo "  ngrok URL: $(cat .ngrok-url)"
            echo "  Webhook URL: $(cat .webhook-url)"
            echo
            echo "Processes are running in background:"
            echo "  Netlify Dev: PID $(cat .netlify-dev.pid)"
            echo "  ngrok: PID $(cat .ngrok.pid)"
            echo
            echo "To stop the session, run: $0 stop"
            echo "To check status, run: $0 status"
            echo
            echo "You can now send commands to your bot in Telegram!"
            echo "All logs will be written to:"
            echo "  - .netlify-dev.log (Netlify Dev)"
            echo "  - .ngrok.log (ngrok)"
            echo
            # Remove trap so processes continue after script exits
            trap - EXIT INT TERM
            ;;
        "stop")
            echo "=========================================="
            echo "Stopping Ngrok Testing Session"
            echo "=========================================="
            echo
            
            cleanup
            
            print_success "Ngrok testing session stopped"
            ;;
        "restart")
            echo "=========================================="
            echo "Restarting Ngrok Testing Session"
            echo "=========================================="
            echo
            
            cleanup
            sleep 2
            
            # Restart with same options
            exec "$0" start "${@:2}"
            ;;
        "status")
            show_status
            ;;
        "test")
            if [ -f ".webhook-url" ]; then
                WEBHOOK_URL=$(cat .webhook-url)
                test_webhook "$WEBHOOK_URL"
            else
                print_error "No active webhook URL found. Please start ngrok session first."
                exit 1
            fi
            ;;
        "webhook-info")
            BOT_TOKEN=$(get_bot_token)
            WEBHOOK_INFO=$(curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo")
            echo "Webhook information:"
            echo "$WEBHOOK_INFO" | jq '.' 2>/dev/null || echo "$WEBHOOK_INFO"
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

# Trap to cleanup on exit
trap cleanup EXIT INT TERM

# Run main function
main "$@"
