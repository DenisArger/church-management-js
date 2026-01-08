#!/bin/bash

# Simple webhook test script for local debugging
# This script tests the webhook endpoint locally

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

# Test webhook endpoint
test_webhook() {
    local webhook_url="$1"
    
    if [ -z "$webhook_url" ]; then
        print_error "Webhook URL is required"
        exit 1
    fi
    
    print_status "Testing webhook endpoint: $webhook_url"
    
    # Test webhook endpoint with a sample message
    RESPONSE=$(curl -s -X POST "$webhook_url" \
        -H "Content-Type: application/json" \
        -d '{
            "update_id": 1,
            "message": {
                "message_id": 1,
                "from": {
                    "id": 123456789,
                    "first_name": "Test",
                    "username": "testuser"
                },
                "chat": {
                    "id": 123456789,
                    "type": "private"
                },
                "text": "/help",
                "date": 1234567890
            }
        }')
    
    if echo "$RESPONSE" | grep -q "status"; then
        print_success "Webhook endpoint is responding"
        echo "Response: $RESPONSE"
        return 0
    else
        print_error "Webhook endpoint test failed"
        echo "Response: $RESPONSE"
        return 1
    fi
}

# Test health endpoint
test_health() {
    local base_url="$1"
    
    if [ -z "$base_url" ]; then
        print_error "Base URL is required"
        exit 1
    fi
    
    print_status "Testing health endpoint: $base_url/health"
    
    RESPONSE=$(curl -s "$base_url/health")
    
    if echo "$RESPONSE" | grep -q "OK"; then
        print_success "Health endpoint is responding"
        echo "Response: $RESPONSE"
        return 0
    else
        print_error "Health endpoint test failed"
        echo "Response: $RESPONSE"
        return 1
    fi
}

# Main execution
main() {
    if [ $# -eq 0 ]; then
        echo "Usage: $0 <base_url>"
        echo "Example: $0 http://localhost:3000"
        exit 1
    fi
    
    local base_url="$1"
    
    echo "=========================================="
    echo "Testing Debug Server"
    echo "=========================================="
    echo
    
    # Test health endpoint
    test_health "$base_url"
    echo
    
    # Test webhook endpoint
    test_webhook "$base_url/webhook"
    echo
    
    print_success "All tests completed!"
}

# Run main function
main "$@"
