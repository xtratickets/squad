#!/bin/bash
# Build performance testing script
# Run this locally to verify deployment will be fast

echo "======================================"
echo "SQUAD Deployment Build Test"
echo "======================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo -e "${YELLOW}[1/5] Checking prerequisites...${NC}"
if ! command -v node &> /dev/null; then
  echo -e "${RED}✗ Node.js not found${NC}"
  exit 1
fi
if ! command -v npm &> /dev/null; then
  echo -e "${RED}✗ npm not found${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Node.js $(node --version)${NC}"
echo -e "${GREEN}✓ npm $(npm --version)${NC}"
echo ""

# Clean old builds
echo -e "${YELLOW}[2/5] Cleaning old builds...${NC}"
rm -rf dist .tsbuildinfo frontend/dist
echo -e "${GREEN}✓ Cleaned${NC}"
echo ""

# Install dependencies
echo -e "${YELLOW}[3/5] Installing dependencies (this may take 2-3 min)...${NC}"
START_TIME=$(date +%s)
npm ci --omit=dev --prefer-offline --no-audit > /tmp/npm-install.log 2>&1 && \
cd frontend && npm ci --omit=dev --prefer-offline --no-audit >> /tmp/npm-install.log 2>&1 && \
cd ..
END_TIME=$(date +%s)
INSTALL_TIME=$((END_TIME - START_TIME))

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Installed in ${INSTALL_TIME}s${NC}"
else
  echo -e "${RED}✗ Installation failed${NC}"
  tail -20 /tmp/npm-install.log
  exit 1
fi
echo ""

# Build backend
echo -e "${YELLOW}[4/5] Building backend (TypeScript)...${NC}"
START_TIME=$(date +%s)
npm run build:backend > /tmp/build-backend.log 2>&1
END_TIME=$(date +%s)
BUILD_TIME=$((END_TIME - START_TIME))

if [ $? -eq 0 ]; then
  DIST_SIZE=$(du -sh dist | cut -f1)
  echo -e "${GREEN}✓ Backend built in ${BUILD_TIME}s (${DIST_SIZE})${NC}"
else
  echo -e "${RED}✗ Backend build failed${NC}"
  tail -20 /tmp/build-backend.log
  exit 1
fi
echo ""

# Build frontend
echo -e "${YELLOW}[5/5] Building frontend (React + Vite)...${NC}"
START_TIME=$(date +%s)
npm run build:frontend > /tmp/build-frontend.log 2>&1
END_TIME=$(date +%s)
FRONTEND_TIME=$((END_TIME - START_TIME))

if [ $? -eq 0 ]; then
  FRONTEND_SIZE=$(du -sh frontend/dist | cut -f1)
  echo -e "${GREEN}✓ Frontend built in ${FRONTEND_TIME}s (${FRONTEND_SIZE})${NC}"
else
  echo -e "${RED}✗ Frontend build failed${NC}"
  tail -20 /tmp/build-frontend.log
  exit 1
fi
echo ""

# Summary
echo "======================================"
echo -e "${GREEN}BUILD SUCCESSFUL!${NC}"
echo "======================================"
echo ""
echo "Performance Summary:"
echo "  npm install:      ${INSTALL_TIME}s"
echo "  Backend build:    ${BUILD_TIME}s"
echo "  Frontend build:   ${FRONTEND_TIME}s"
echo "  Total time:       $((INSTALL_TIME + BUILD_TIME + FRONTEND_TIME))s"
echo ""
echo "Artifact sizes:"
echo "  Backend dist/:    $(du -sh dist | cut -f1)"
echo "  Frontend dist/:   $(du -sh frontend/dist | cut -f1)"
echo "  Node modules:     $(du -sh node_modules | cut -f1)"
echo ""
echo "Expected Dokploy deployment time: 8-12 minutes (first deploy)"
echo "Expected Dokploy deployment time: 3-5 minutes (subsequent deploys with cache)"
echo ""

# Docker build test (optional)
if command -v docker &> /dev/null; then
  read -p "Test Docker build? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo -e "${YELLOW}Building Docker image...${NC}"
    docker build -t squad-test:latest .
    if [ $? -eq 0 ]; then
      IMG_SIZE=$(docker images squad-test:latest --format "{{.Size}}")
      echo -e "${GREEN}✓ Docker image built: ${IMG_SIZE}${NC}"
    else
      echo -e "${RED}✗ Docker build failed${NC}"
    fi
  fi
fi
