#!/bin/bash

# Church Telegram Bot - Production Setup Script
# This script configures the bot for production environment

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

# Function to check if .env file exists
check_env_file() {
    if [ ! -f ".env" ]; then
        print_error ".env file not found!"
        print_status "Creating .env from env.example..."
        if [ -f "env.example" ]; then
            cp env.example .env
            print_success ".env file created from env.example"
        else
            print_error "env.example file not found!"
            exit 1
        fi
    fi
}

# Function to update environment variable in .env file
update_env_var() {
    local var_name="$1"
    local var_value="$2"
    local comment="$3"
    
    if grep -q "^${var_name}=" .env; then
        # Variable exists, update it
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s|^${var_name}=.*|${var_name}=${var_value}|" .env
        else
            # Linux
            sed -i "s|^${var_name}=.*|${var_name}=${var_value}|" .env
        fi
        print_success "Updated ${var_name}=${var_value}"
    else
        # Variable doesn't exist, add it
        if [ -n "$comment" ]; then
            echo "" >> .env
            echo "# ${comment}" >> .env
        fi
        echo "${var_name}=${var_value}" >> .env
        print_success "Added ${var_name}=${var_value}"
    fi
}

# Function to set production environment
set_production_env() {
    print_status "Setting production environment variables..."
    
    # Set NODE_ENV to production
    update_env_var "NODE_ENV" "production" "Environment (production/development)"
    
    # Set DEBUG to false
    update_env_var "DEBUG" "false" "Debug mode (true/false)"
    
    # Set LOG_LEVEL to info (or warn for production)
    update_env_var "LOG_LEVEL" "info" "Log level (debug/info/warn/error)"
    
    # Set LOG_FORMAT to json (better for production logging)
    update_env_var "LOG_FORMAT" "json" "Log format (json/text)"
    
    print_success "Production environment variables configured"
}

# Function to verify production settings
verify_production_settings() {
    print_status "Verifying production settings..."
    
    local errors=0
    
    # Check NODE_ENV
    if grep -q "^NODE_ENV=production" .env; then
        print_success "NODE_ENV is set to production"
    else
        print_error "NODE_ENV is not set to production"
        errors=$((errors + 1))
    fi
    
    # Check DEBUG
    if grep -q "^DEBUG=false" .env; then
        print_success "DEBUG is set to false"
    else
        print_warning "DEBUG is not set to false (may still be in debug mode)"
    fi
    
    # Check required variables
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
        if ! grep -q "^${var}=" .env || grep -q "^${var}=your_" .env || grep -q "^${var}=$" .env; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        print_error "Missing or not configured required variables:"
        for var in "${missing_vars[@]}"; do
            echo "  - $var"
        done
        errors=$((errors + 1))
    else
        print_success "All required variables are configured"
    fi
    
    if [ $errors -eq 0 ]; then
        print_success "Production settings verification passed"
        return 0
    else
        print_error "Production settings verification failed"
        return 1
    fi
}

# Function to show Netlify setup instructions
show_netlify_instructions() {
    echo
    print_status "=========================================="
    print_status "Netlify Environment Variables Setup"
    print_status "=========================================="
    echo
    print_warning "IMPORTANT: You need to set environment variables in Netlify Dashboard!"
    echo
    echo "To set environment variables in Netlify:"
    echo
    echo "Option 1: Via Netlify Dashboard"
    echo "  1. Go to https://app.netlify.com"
    echo "  2. Select your site"
    echo "  3. Go to Site settings > Environment variables"
    echo "  4. Add all variables from your .env file"
    echo
    echo "Option 2: Via Netlify CLI"
    echo "  netlify env:set NODE_ENV production"
    echo "  netlify env:set DEBUG false"
    echo "  netlify env:set LOG_LEVEL info"
    echo "  netlify env:set LOG_FORMAT json"
    echo "  # ... and all other variables from .env"
    echo
    echo "Required variables for production:"
    echo "  - NODE_ENV=production"
    echo "  - DEBUG=false"
    echo "  - LOG_LEVEL=info"
    echo "  - LOG_FORMAT=json"
    echo "  - TELEGRAM_BOT_TOKEN"
    echo "  - ALLOWED_USERS"
    echo "  - NOTION_TOKEN"
    echo "  - NOTION_PRAYER_DATABASE"
    echo "  - NOTION_GENERAL_CALENDAR_DATABASE"
    echo "  - NOTION_DAILY_DISTRIBUTION_DATABASE"
    echo "  - NOTION_WEEKLY_PRAYER_DATABASE"
    echo "  - TELEGRAM_MAIN_CHANNEL_ID (optional)"
    echo "  - TELEGRAM_MAIN_GROUP_ID (optional)"
    echo "  - TELEGRAM_YOUTH_GROUP_ID (optional)"
    echo
    print_warning "Debug variables (TELEGRAM_BOT_TOKEN_DEBUG, etc.) are optional and not needed for production"
    echo
}

# Function to show webhook setup instructions
show_webhook_instructions() {
    echo
    print_status "=========================================="
    print_status "Webhook Setup Instructions"
    print_status "=========================================="
    echo
    echo "After deploying to Netlify, set up the webhook:"
    echo
    echo "1. Deploy to Netlify:"
    echo "   yarn deploy:full"
    echo "   # or"
    echo "   ./scripts/deploy.sh"
    echo
    echo "2. Set webhook:"
    echo "   yarn webhook:set"
    echo "   # or"
    echo "   ./scripts/webhook-manager.sh set-file"
    echo
    echo "3. Verify webhook:"
    echo "   yarn webhook:info"
    echo
}

# Main execution
main() {
    echo "=========================================="
    echo "Church Telegram Bot - Production Setup"
    echo "=========================================="
    echo
    
    # Check if .env exists
    check_env_file
    
    # Set production environment
    set_production_env
    
    # Verify settings
    if verify_production_settings; then
        echo
        print_success "Local .env file is configured for production!"
        echo
        
        # Show Netlify instructions
        show_netlify_instructions
        
        # Show webhook instructions
        show_webhook_instructions
        
        echo
        print_status "Next steps:"
        echo "1. Review and update your .env file with production values"
        echo "2. Set environment variables in Netlify Dashboard"
        echo "3. Deploy to Netlify: yarn deploy:full"
        echo "4. Set up webhook: yarn webhook:set"
        echo "5. Test your bot in production"
        echo
    else
        echo
        print_error "Please fix the issues above before deploying to production"
        echo
        exit 1
    fi
}

# Run main function
main "$@"

