#!/bin/bash

# Test script for Netlify auto poll scheduler functions
# Tests both local Netlify dev and deployed functions

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
    local function_name="$1"
    local netlify_dev_url="http://localhost:8888/.netlify/functions/${function_name}"
    
    print_status "Testing local Netlify dev function: ${function_name}"
    print_status "Testing URL: $netlify_dev_url"
    
    # Test the function endpoint
    RESPONSE=$(curl -s -X POST "$netlify_dev_url" \
        -H "Content-Type: application/json" \
        -d '{"httpMethod": "POST", "headers": {"user-agent": "test-script"}}' \
        -w "HTTP_STATUS:%{http_code}" || echo "HTTP_STATUS:000")
    
    HTTP_STATUS=$(echo "$RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2 || echo "000")
    RESPONSE_BODY=$(echo "$RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')
    
    if [ "$HTTP_STATUS" = "200" ]; then
        print_success "Local function test PASSED (HTTP $HTTP_STATUS)"
        echo "Response: $RESPONSE_BODY" | head -c 500
        echo ""
        
        # Check if response contains success
        if echo "$RESPONSE_BODY" | grep -q '"success":true'; then
            print_success "Function executed successfully"
            return 0
        else
            print_warning "Function executed but may have issues"
            return 1
        fi
    else
        print_error "Local function test FAILED (HTTP $HTTP_STATUS)"
        echo "Response: $RESPONSE_BODY"
        return 1
    fi
}

# Function to test deployed Netlify function
test_deployed_function() {
    local function_name="$1"
    local netlify_url="$2"
    
    if [ -z "$netlify_url" ]; then
        print_error "Netlify URL is required for deployed function test"
        return 1
    fi
    
    print_status "Testing deployed Netlify function: ${function_name}"
    
    # Remove trailing slash if present
    netlify_url=$(echo "$netlify_url" | sed 's:/*$::')
    local function_url="${netlify_url}/.netlify/functions/${function_name}"
    
    print_status "Testing URL: $function_url"
    
    # Test the function endpoint
    RESPONSE=$(curl -s -X POST "$function_url" \
        -H "Content-Type: application/json" \
        -d '{"httpMethod": "POST", "headers": {"user-agent": "test-script"}}' \
        -w "HTTP_STATUS:%{http_code}" || echo "HTTP_STATUS:000")
    
    HTTP_STATUS=$(echo "$RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2 || echo "000")
    RESPONSE_BODY=$(echo "$RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')
    
    if [ "$HTTP_STATUS" = "200" ]; then
        print_success "Deployed function test PASSED (HTTP $HTTP_STATUS)"
        echo "Response: $RESPONSE_BODY" | head -c 500
        echo ""
        
        # Check if response contains success
        if echo "$RESPONSE_BODY" | grep -q '"success":true'; then
            print_success "Function executed successfully"
            return 0
        else
            print_warning "Function executed but may have issues"
            return 1
        fi
    else
        print_error "Deployed function test FAILED (HTTP $HTTP_STATUS)"
        echo "Response: $RESPONSE_BODY"
        return 1
    fi
}

# Main test function
main() {
    local command="$1"
    local netlify_url="$2"
    
    print_status "Auto Poll Scheduler Test Script"
    echo ""
    
    case "$command" in
        local)
            print_status "Testing local Netlify dev functions..."
            echo ""
            
            # Check if netlify dev is running
            if ! curl -s http://localhost:8888 > /dev/null 2>&1; then
                print_error "Netlify dev is not running!"
                print_status "Please start it with: netlify dev"
                exit 1
            fi
            
            test_local_function "poll-notification-scheduler"
            echo ""
            test_local_function "poll-sender-scheduler"
            ;;
            
        deployed)
            if [ -z "$netlify_url" ]; then
                print_error "Netlify URL is required for deployed function test"
                echo "Usage: $0 deployed <netlify-url>"
                exit 1
            fi
            
            print_status "Testing deployed Netlify functions..."
            echo ""
            
            test_deployed_function "poll-notification-scheduler" "$netlify_url"
            echo ""
            test_deployed_function "poll-sender-scheduler" "$netlify_url"
            ;;
            
        *)
            echo "Auto Poll Scheduler Test Script"
            echo ""
            echo "Usage: $0 [command] [options]"
            echo ""
            echo "Commands:"
            echo "  local                    - Test local Netlify dev functions"
            echo "  deployed <netlify-url>   - Test deployed Netlify functions"
            echo ""
            echo "Examples:"
            echo "  $0 local"
            echo "  $0 deployed https://your-site.netlify.app"
            exit 1
            ;;
    esac
}

main "$@"




