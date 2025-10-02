#!/bin/bash

# Church Telegram Bot - Deploy Script
# This script deploys the bot to Netlify and sets up the webhook

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

# Function to check if .env file exists and has required variables
check_env() {
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

    print_success "Environment variables check passed"
}

# Function to build the project
build_project() {
    print_status "Building the project..."
    
    if ! command_exists yarn; then
        print_error "yarn is not installed. Please install yarn first."
        exit 1
    fi

    yarn build
    
    if [ $? -eq 0 ]; then
        print_success "Build completed successfully"
    else
        print_error "Build failed"
        exit 1
    fi
}

# Function to deploy to Netlify
deploy_to_netlify() {
    print_status "Deploying to Netlify..."
    
    if ! command_exists netlify; then
        print_error "Netlify CLI is not installed. Please install it first:"
        echo "  npm install -g netlify-cli"
        exit 1
    fi

    # Check if user is logged in to Netlify
    if ! netlify status >/dev/null 2>&1; then
        print_warning "Not logged in to Netlify. Please log in:"
        netlify login
    fi

    # Deploy to production
    netlify deploy --prod --dir=dist --functions=netlify/functions
    
    if [ $? -eq 0 ]; then
        print_success "Deployment completed successfully"
        
        # Get the deployed URL
        DEPLOYED_URL=$(netlify status --json | grep -o '"url":"[^"]*"' | head -1 | cut -d'"' -f4)
        if [ -n "$DEPLOYED_URL" ]; then
            print_success "Deployed URL: $DEPLOYED_URL"
            echo "$DEPLOYED_URL" > .netlify-url
        fi
    else
        print_error "Deployment failed"
        exit 1
    fi
}

# Function to set up webhook
setup_webhook() {
    print_status "Setting up Telegram webhook..."
    
    # Get bot token from .env
    BOT_TOKEN=$(grep "^TELEGRAM_BOT_TOKEN=" .env | cut -d'=' -f2 | tr -d '"')
    
    if [ -z "$BOT_TOKEN" ]; then
        print_error "TELEGRAM_BOT_TOKEN not found in .env"
        exit 1
    fi

    # Get deployed URL
    if [ -f ".netlify-url" ]; then
        DEPLOYED_URL=$(cat .netlify-url)
    else
        print_error "Deployed URL not found. Please run deployment first."
        exit 1
    fi

    WEBHOOK_URL="${DEPLOYED_URL}/.netlify/functions/telegram-webhook"
    
    print_status "Setting webhook URL: $WEBHOOK_URL"
    
    # Set webhook using Telegram Bot API
    RESPONSE=$(curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
        -H "Content-Type: application/json" \
        -d "{\"url\":\"${WEBHOOK_URL}\"}")
    
    # Check if webhook was set successfully
    if echo "$RESPONSE" | grep -q '"ok":true'; then
        print_success "Webhook set successfully"
        
        # Get webhook info
        WEBHOOK_INFO=$(curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo")
        print_status "Webhook info:"
        echo "$WEBHOOK_INFO" | jq '.' 2>/dev/null || echo "$WEBHOOK_INFO"
    else
        print_error "Failed to set webhook"
        echo "Response: $RESPONSE"
        exit 1
    fi
}

# Function to test the deployment
test_deployment() {
    print_status "Testing deployment..."
    
    if [ -f ".netlify-url" ]; then
        DEPLOYED_URL=$(cat .netlify-url)
        WEBHOOK_URL="${DEPLOYED_URL}/.netlify/functions/telegram-webhook"
        
        # Test webhook endpoint
        RESPONSE=$(curl -s -X POST "$WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d '{"test": "ping"}')
        
        if echo "$RESPONSE" | grep -q "status"; then
            print_success "Webhook endpoint is responding"
        else
            print_warning "Webhook endpoint test failed, but deployment might still work"
        fi
    else
        print_warning "Cannot test deployment - no deployed URL found"
    fi
}

# Main execution
main() {
    echo "=========================================="
    echo "Church Telegram Bot - Deployment Script"
    echo "=========================================="
    echo
    
    # Parse command line arguments
    SKIP_BUILD=false
    SKIP_DEPLOY=false
    SKIP_WEBHOOK=false
    SKIP_TEST=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-build)
                SKIP_BUILD=true
                shift
                ;;
            --skip-deploy)
                SKIP_DEPLOY=true
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
            --help)
                echo "Usage: $0 [OPTIONS]"
                echo "Options:"
                echo "  --skip-build    Skip building the project"
                echo "  --skip-deploy   Skip deploying to Netlify"
                echo "  --skip-webhook  Skip setting up webhook"
                echo "  --skip-test     Skip testing deployment"
                echo "  --help          Show this help message"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done
    
    # Check environment
    check_env
    
    # Build project
    if [ "$SKIP_BUILD" = false ]; then
        build_project
    else
        print_warning "Skipping build step"
    fi
    
    # Deploy to Netlify
    if [ "$SKIP_DEPLOY" = false ]; then
        deploy_to_netlify
    else
        print_warning "Skipping deployment step"
    fi
    
    # Set up webhook
    if [ "$SKIP_WEBHOOK" = false ]; then
        setup_webhook
    else
        print_warning "Skipping webhook setup step"
    fi
    
    # Test deployment
    if [ "$SKIP_TEST" = false ]; then
        test_deployment
    else
        print_warning "Skipping test step"
    fi
    
    echo
    print_success "Deployment completed successfully!"
    echo
    echo "Next steps:"
    echo "1. Test your bot by sending /help command"
    echo "2. Check logs in Netlify dashboard if needed"
    echo "3. Monitor webhook status with: curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
    echo
}

# Run main function
main "$@"
