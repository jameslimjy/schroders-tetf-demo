#!/bin/bash

# Tokenized ETF Demo Startup Script
# This script automates the entire demo setup:
# 1. Starts Anvil blockchain
# 2. Deploys smart contracts
# 3. Starts frontend development server

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Tokenized ETF Demo - Startup Script${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Check if Anvil is already running
if lsof -Pi :8545 -sTCP:LISTEN -t >/dev/null ; then
    echo -e "${YELLOW}⚠️  Anvil is already running on port 8545${NC}"
    echo -e "${YELLOW}   Using existing Anvil instance...${NC}\n"
    ANVIL_RUNNING=true
else
    ANVIL_RUNNING=false
fi

# Step 1: Start Anvil (if not already running)
if [ "$ANVIL_RUNNING" = false ]; then
    echo -e "${GREEN}Step 1: Starting Anvil blockchain...${NC}"
    cd "$BACKEND_DIR"
    
    # Start Anvil in background
    anvil > /tmp/anvil.log 2>&1 &
    ANVIL_PID=$!
    
    # Wait for Anvil to be ready
    echo -e "   Waiting for Anvil to start..."
    for i in {1..30}; do
        if curl -s http://localhost:8545 > /dev/null 2>&1; then
            echo -e "   ✓ Anvil is ready (PID: $ANVIL_PID)"
            break
        fi
        if [ $i -eq 30 ]; then
            echo -e "${RED}✗ Anvil failed to start${NC}"
            exit 1
        fi
        sleep 1
    done
    echo ""
else
    echo -e "${GREEN}Step 1: Anvil already running, skipping...${NC}\n"
    ANVIL_PID=""
fi

# Step 2: Deploy Smart Contracts
echo -e "${GREEN}Step 2: Deploying smart contracts...${NC}"
cd "$BACKEND_DIR"

# Check if contracts are already deployed (optional - remove if you want fresh deploy each time)
if [ -f "deployment-info.json" ] && [ "$ANVIL_RUNNING" = true ]; then
    echo -e "   ${YELLOW}⚠️  Contracts may already be deployed${NC}"
    echo -e "   ${YELLOW}   Deploying anyway to ensure fresh state...${NC}"
fi

# Deploy contracts
forge script script/Deploy.s.sol \
    --broadcast \
    --rpc-url http://localhost:8545 \
    --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

if [ $? -eq 0 ]; then
    echo -e "   ✓ Contracts deployed successfully"
    echo -e "   ✓ Deployment info saved to backend/deployment-info.json"
else
    echo -e "${RED}✗ Contract deployment failed${NC}"
    if [ -n "$ANVIL_PID" ]; then
        kill $ANVIL_PID 2>/dev/null || true
    fi
    exit 1
fi
echo ""

# Check if frontend exists
if [ ! -d "$FRONTEND_DIR" ]; then
    echo -e "${YELLOW}⚠️  Frontend directory not found at: $FRONTEND_DIR${NC}"
    echo -e "${YELLOW}   Skipping frontend startup...${NC}"
    echo ""
    echo -e "${GREEN}✅ Backend setup complete!${NC}"
    echo -e "${BLUE}   Anvil is running on http://localhost:8545${NC}"
    echo -e "${BLUE}   Contracts are deployed and ready${NC}"
    echo ""
    echo -e "${YELLOW}To start frontend manually:${NC}"
    echo -e "   cd frontend && npm start"
    echo ""
    exit 0
fi

# Step 3: Copy CDP registry to frontend public folder
echo -e "${GREEN}Step 3: Preparing frontend data files...${NC}"
if [ -f "$BACKEND_DIR/data/cdp-registry.json" ]; then
    mkdir -p "$FRONTEND_DIR/public/api"
    cp "$BACKEND_DIR/data/cdp-registry.json" "$FRONTEND_DIR/public/api/cdp-registry.json"
    echo -e "   ✓ CDP registry copied to frontend"
else
    echo -e "   ${YELLOW}⚠️  CDP registry not found, skipping copy${NC}"
fi

# Copy deployment info to frontend public folder (optional, for dynamic loading)
if [ -f "$BACKEND_DIR/deployment-info.json" ]; then
    cp "$BACKEND_DIR/deployment-info.json" "$FRONTEND_DIR/public/deployment-info.json" 2>/dev/null || true
fi
echo ""

# Step 4: Start Frontend
echo -e "${GREEN}Step 4: Starting frontend development server...${NC}"
cd "$FRONTEND_DIR"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "   Installing frontend dependencies..."
    npm install
fi

echo -e "   Starting frontend..."
echo -e "${BLUE}   Frontend will be available at http://localhost:3000${NC}"
echo -e "${BLUE}   Press Ctrl+C to stop all services${NC}"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down...${NC}"
    if [ -n "$ANVIL_PID" ]; then
        echo -e "   Stopping Anvil (PID: $ANVIL_PID)"
        kill $ANVIL_PID 2>/dev/null || true
    fi
    echo -e "${GREEN}✓ Cleanup complete${NC}"
}

# Trap Ctrl+C and cleanup
trap cleanup INT TERM

# Start frontend (this will block)
npm start

# Cleanup when frontend exits
cleanup

