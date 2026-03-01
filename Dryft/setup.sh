#!/bin/bash

# Drift - Pre-Launch Setup Script
# Run this script to prepare the project for launch

set -e  # Exit on error

echo "========================================"
echo "  Drift Pre-Launch Setup"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Go
if ! command -v go &> /dev/null; then
    echo -e "${RED}Error: Go is not installed${NC}"
    echo "Please install Go 1.22+ from https://go.dev/dl/"
    exit 1
fi

GO_VERSION=$(go version | grep -oP '1\.\d+' | head -1)
GO_MINOR=$(echo "$GO_VERSION" | cut -d'.' -f2)
if [ "$GO_MINOR" -lt 22 ]; then
    echo -e "${RED}Error: Go 1.22+ required (found $GO_VERSION)${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Go $(go version | grep -oP 'go[0-9]+\.[0-9]+\.[0-9]+') detected${NC}"

# Check Node.js (needed for mobile app)
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Warning: Node.js is not installed (needed for mobile app)${NC}"
    echo "Please install Node.js 18+ from https://nodejs.org"
else
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        echo -e "${YELLOW}Warning: Node.js 18+ recommended for mobile (found v$NODE_VERSION)${NC}"
    else
        echo -e "${GREEN}✓ Node.js $(node -v) detected${NC}"
    fi
fi

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ========================================
# Backend Setup
# ========================================
echo ""
echo -e "${YELLOW}Setting up Backend...${NC}"
cd "$SCRIPT_DIR/backend"

echo "Downloading Go dependencies..."
go mod download

echo "Verifying build..."
go build ./cmd/dryft-api

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env from .env.example...${NC}"
    cp .env.example .env
    echo -e "${RED}⚠ Please edit backend/.env with your actual values${NC}"
fi

echo -e "${GREEN}✓ Backend setup complete${NC}"

# ========================================
# Mobile Setup
# ========================================
echo ""
echo -e "${YELLOW}Setting up Mobile App...${NC}"
cd "$SCRIPT_DIR/mobile"

if command -v npm &> /dev/null; then
    echo "Installing dependencies..."
    npm install

    # Check if .env exists
    if [ ! -f .env ]; then
        echo -e "${YELLOW}Creating .env from .env.example...${NC}"
        cp .env.example .env
        echo -e "${RED}⚠ Please edit mobile/.env with your actual values${NC}"
    fi

    echo -e "${GREEN}✓ Mobile setup complete${NC}"
else
    echo -e "${YELLOW}⚠ Skipping mobile setup (npm not found)${NC}"
fi

# ========================================
# Summary
# ========================================
echo ""
echo "========================================"
echo -e "${GREEN}  Setup Complete!${NC}"
echo "========================================"
echo ""
echo "Next steps:"
echo ""
echo "1. Configure environment variables:"
echo "   - Edit backend/.env"
echo "   - Edit mobile/.env"
echo ""
echo "2. Set up the database:"
echo "   cd backend"
echo "   for f in internal/database/migrations/*.sql; do"
echo "     psql \"\$DATABASE_URL\" -f \"\$f\""
echo "   done"
echo ""
echo "3. Configure mobile app for stores:"
echo "   - Update mobile/app.json with your EAS project ID"
echo "   - Update mobile/eas.json with Apple/Google credentials"
echo ""
echo "4. Run tests:"
echo "   cd backend && go test ./..."
echo "   cd mobile && npm run typecheck"
echo ""
echo "5. Start development:"
echo "   Backend: cd backend && go run ./cmd/dryft-api"
echo "   Mobile:  cd mobile && npm start"
echo ""
