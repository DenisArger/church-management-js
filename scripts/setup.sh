#!/bin/bash

# Church Telegram Bot - Setup Script
# This script sets up the development environment and initial configuration

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

# Function to check system requirements
check_requirements() {
    print_status "Checking system requirements..."
    
    local missing_requirements=()
    
    # Check Node.js
    if ! command_exists node; then
        missing_requirements+=("Node.js")
    else
        NODE_VERSION=$(node --version)
        print_success "Node.js found: $NODE_VERSION"
    fi
    
    # Check Yarn
    if ! command_exists yarn; then
        missing_requirements+=("Yarn")
    else
        YARN_VERSION=$(yarn --version)
        print_success "Yarn found: $YARN_VERSION"
    fi
    
    # Check Git
    if ! command_exists git; then
        missing_requirements+=("Git")
    else
        GIT_VERSION=$(git --version)
        print_success "Git found: $GIT_VERSION"
    fi
    
    # Check Netlify CLI
    if ! command_exists netlify; then
        print_warning "Netlify CLI not found. Installing..."
        npm install -g netlify-cli
        if [ $? -eq 0 ]; then
            print_success "Netlify CLI installed successfully"
        else
            missing_requirements+=("Netlify CLI")
        fi
    else
        NETLIFY_VERSION=$(netlify --version)
        print_success "Netlify CLI found: $NETLIFY_VERSION"
    fi
    
    if [ ${#missing_requirements[@]} -ne 0 ]; then
        print_error "Missing requirements:"
        for req in "${missing_requirements[@]}"; do
            echo "  - $req"
        done
        echo
        echo "Please install missing requirements and run the script again."
        exit 1
    fi
    
    print_success "All requirements satisfied"
}

# Function to install dependencies
install_dependencies() {
    print_status "Installing project dependencies..."
    
    if [ ! -f "package.json" ]; then
        print_error "package.json not found. Are you in the project root?"
        exit 1
    fi
    
    yarn install
    
    if [ $? -eq 0 ]; then
        print_success "Dependencies installed successfully"
    else
        print_error "Failed to install dependencies"
        exit 1
    fi
}

# Function to create .env file
create_env_file() {
    print_status "Setting up environment configuration..."
    
    if [ -f ".env" ]; then
        print_warning ".env file already exists. Backing up to .env.backup"
        cp .env .env.backup
    fi
    
    if [ ! -f "env.example" ]; then
        print_error "env.example not found. Cannot create .env file."
        exit 1
    fi
    
    cp env.example .env
    
    print_success ".env file created from env.example"
    print_warning "Please edit .env file with your actual values:"
    echo "  - TELEGRAM_BOT_TOKEN: Your Telegram bot token"
    echo "  - NOTION_TOKEN: Your Notion integration token"
    echo "  - NOTION_*_DATABASE: Your Notion database IDs"
    echo "  - ALLOWED_USERS: Comma-separated list of authorized user IDs"
    echo
}

# Function to build the project
build_project() {
    print_status "Building the project..."
    
    yarn build
    
    if [ $? -eq 0 ]; then
        print_success "Build completed successfully"
    else
        print_error "Build failed"
        exit 1
    fi
}

# Function to test the build
test_build() {
    print_status "Testing the build..."
    
    if [ ! -f "dist/index.js" ]; then
        print_error "Build output not found. Build may have failed."
        exit 1
    fi
    
    # Test if the built code can be required
    if node -e "require('./dist/index.js')" 2>/dev/null; then
        print_success "Build test passed"
    else
        print_warning "Build test failed, but this might be expected for serverless functions"
    fi
}

# Function to set up Git hooks
setup_git_hooks() {
    print_status "Setting up Git hooks..."
    
    if [ ! -d ".git" ]; then
        print_warning "Not a Git repository. Skipping Git hooks setup."
        return
    fi
    
    # Create pre-commit hook
    cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
# Pre-commit hook for Church Telegram Bot

echo "Running pre-commit checks..."

# Check if .env file is not committed
if git diff --cached --name-only | grep -q "\.env$"; then
    echo "Error: .env file should not be committed to version control"
    exit 1
fi

# Run linting
if command -v yarn >/dev/null 2>&1; then
    yarn lint
    if [ $? -ne 0 ]; then
        echo "Error: Linting failed"
        exit 1
    fi
fi

echo "Pre-commit checks passed"
EOF
    
    chmod +x .git/hooks/pre-commit
    print_success "Git pre-commit hook installed"
}

# Function to create development scripts
create_dev_scripts() {
    print_status "Creating development scripts..."
    
    # Create start-dev.sh
    cat > start-dev.sh << 'EOF'
#!/bin/bash
# Start development server

echo "Starting development server..."
netlify dev --port 8888
EOF
    
    chmod +x start-dev.sh
    
    # Create test-local.sh
    cat > test-local.sh << 'EOF'
#!/bin/bash
# Test local webhook

if [ -z "$1" ]; then
    echo "Usage: $0 <webhook_url>"
    echo "Example: $0 https://your-ngrok-url.ngrok.io/.netlify/functions/telegram-webhook"
    exit 1
fi

echo "Testing webhook: $1"

curl -X POST "$1" \
    -H "Content-Type: application/json" \
    -d '{
        "update_id": 1,
        "message": {
            "message_id": 1,
            "from": {
                "id": 282850458,
                "first_name": "Test",
                "last_name": "User"
            },
            "chat": {
                "id": 282850458,
                "type": "private"
            },
            "text": "/help",
            "date": 1234567890
        }
    }'
EOF
    
    chmod +x test-local.sh
    
    print_success "Development scripts created"
}

# Function to show next steps
show_next_steps() {
    echo
    echo "=========================================="
    echo "Setup completed successfully!"
    echo "=========================================="
    echo
    echo "Next steps:"
    echo
    echo "1. Configure your environment:"
    echo "   - Edit .env file with your actual values"
    echo "   - Get your Telegram bot token from @BotFather"
    echo "   - Set up Notion integration and get database IDs"
    echo "   - Add authorized user IDs to ALLOWED_USERS"
    echo
    echo "2. Test locally:"
    echo "   - Run: ./start-dev.sh"
    echo "   - Use ngrok to expose your local server"
    echo "   - Test with: ./test-local.sh <ngrok-url>"
    echo
    echo "3. Deploy to production:"
    echo "   - Run: ./scripts/deploy.sh"
    echo "   - Or use: yarn deploy"
    echo
    echo "4. Manage webhook:"
    echo "   - Set webhook: ./scripts/webhook-manager.sh set-file"
    echo "   - Check status: ./scripts/webhook-manager.sh info"
    echo
    echo "Useful commands:"
    echo "   - yarn build          # Build the project"
    echo "   - yarn lint           # Run linting"
    echo "   - yarn lint:fix       # Fix linting issues"
    echo "   - netlify dev         # Start development server"
    echo "   - netlify deploy      # Deploy to Netlify"
    echo
}

# Function to show help
show_help() {
    echo "Church Telegram Bot - Setup Script"
    echo
    echo "Usage: $0 [OPTIONS]"
    echo
    echo "Options:"
    echo "  --skip-requirements    Skip system requirements check"
    echo "  --skip-dependencies    Skip dependency installation"
    echo "  --skip-env             Skip .env file creation"
    echo "  --skip-build           Skip project build"
    echo "  --skip-test            Skip build test"
    echo "  --skip-git             Skip Git hooks setup"
    echo "  --skip-scripts         Skip development scripts creation"
    echo "  --help                 Show this help message"
    echo
    echo "Examples:"
    echo "  $0                     # Full setup"
    echo "  $0 --skip-build        # Setup without building"
    echo "  $0 --skip-env          # Setup without creating .env"
    echo
}

# Main execution
main() {
    echo "=========================================="
    echo "Church Telegram Bot - Setup Script"
    echo "=========================================="
    echo
    
    # Parse command line arguments
    SKIP_REQUIREMENTS=false
    SKIP_DEPENDENCIES=false
    SKIP_ENV=false
    SKIP_BUILD=false
    SKIP_TEST=false
    SKIP_GIT=false
    SKIP_SCRIPTS=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-requirements)
                SKIP_REQUIREMENTS=true
                shift
                ;;
            --skip-dependencies)
                SKIP_DEPENDENCIES=true
                shift
                ;;
            --skip-env)
                SKIP_ENV=true
                shift
                ;;
            --skip-build)
                SKIP_BUILD=true
                shift
                ;;
            --skip-test)
                SKIP_TEST=true
                shift
                ;;
            --skip-git)
                SKIP_GIT=true
                shift
                ;;
            --skip-scripts)
                SKIP_SCRIPTS=true
                shift
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done
    
    # Check system requirements
    if [ "$SKIP_REQUIREMENTS" = false ]; then
        check_requirements
    else
        print_warning "Skipping requirements check"
    fi
    
    # Install dependencies
    if [ "$SKIP_DEPENDENCIES" = false ]; then
        install_dependencies
    else
        print_warning "Skipping dependency installation"
    fi
    
    # Create .env file
    if [ "$SKIP_ENV" = false ]; then
        create_env_file
    else
        print_warning "Skipping .env file creation"
    fi
    
    # Build project
    if [ "$SKIP_BUILD" = false ]; then
        build_project
    else
        print_warning "Skipping build step"
    fi
    
    # Test build
    if [ "$SKIP_TEST" = false ]; then
        test_build
    else
        print_warning "Skipping build test"
    fi
    
    # Set up Git hooks
    if [ "$SKIP_GIT" = false ]; then
        setup_git_hooks
    else
        print_warning "Skipping Git hooks setup"
    fi
    
    # Create development scripts
    if [ "$SKIP_SCRIPTS" = false ]; then
        create_dev_scripts
    else
        print_warning "Skipping development scripts creation"
    fi
    
    # Show next steps
    show_next_steps
}

# Run main function
main "$@"
