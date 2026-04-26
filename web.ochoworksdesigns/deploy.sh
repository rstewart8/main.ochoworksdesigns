#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default branch
BRANCH="master"

# Parse arguments
while getopts "b:" opt; do
  case $opt in
    b)
      BRANCH=$OPTARG
      ;;
    \?)
      echo "Invalid option: -$OPTARG" >&2
      echo "Usage: $0 [-b branch_name]"
      exit 1
      ;;
  esac
done

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  OchoWorks Designs Deployment${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${YELLOW}Branch: ${BRANCH}${NC}"
echo ""

# Check if swap is enabled
SWAP_TOTAL=$(free -m | awk '/^Swap:/ {print $2}')
if [ "$SWAP_TOTAL" -eq 0 ]; then
    echo -e "${YELLOW}⚠️  Warning: No swap space detected${NC}"
    echo -e "${YELLOW}   Consider adding swap to prevent build failures${NC}"
    echo -e "${YELLOW}   Run: sudo ./setup-swap.sh${NC}"
    echo ""
fi

# Store current directory
DEPLOY_DIR="/var/www/web.ochoworksdesigns"
cd $DEPLOY_DIR

# Show current branch and commit
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
CURRENT_COMMIT=$(git rev-parse --short HEAD)
echo -e "${YELLOW}Current branch: ${CURRENT_BRANCH} (${CURRENT_COMMIT})${NC}"

# Fetch latest changes
echo -e "${YELLOW}Fetching latest changes...${NC}"
git fetch origin
if [ $? -ne 0 ]; then
    echo -e "${RED}Git fetch failed! Aborting deployment.${NC}"
    exit 1
fi

# Checkout and pull the specified branch
echo -e "${YELLOW}Checking out branch: ${BRANCH}${NC}"
git checkout $BRANCH
if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to checkout branch ${BRANCH}! Aborting deployment.${NC}"
    exit 1
fi

echo -e "${YELLOW}Pulling latest code from ${BRANCH}...${NC}"
git pull origin $BRANCH
if [ $? -ne 0 ]; then
    echo -e "${RED}Git pull failed! Aborting deployment.${NC}"
    exit 1
fi

NEW_COMMIT=$(git rev-parse --short HEAD)
echo -e "${GREEN}Updated to commit: ${NEW_COMMIT}${NC}"

# Install/update dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
npm install
if [ $? -ne 0 ]; then
    echo -e "${RED}npm install failed! Aborting deployment.${NC}"
    exit 1
fi

# Build the application with memory limits
echo -e "${YELLOW}Building application (with memory optimizations)...${NC}"
export NODE_OPTIONS="--max-old-space-size=512"
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}Build failed! Aborting deployment.${NC}"
    echo -e "${YELLOW}Tip: If build keeps failing, check swap space with 'free -h'${NC}"
    exit 1
fi

# Reload PM2 with zero downtime
echo -e "${YELLOW}Reloading application...${NC}"
pm2 reload ochoworks --update-env
if [ $? -ne 0 ]; then
    echo -e "${RED}PM2 reload failed! App may need manual restart.${NC}"
    exit 1
fi

# Wait for app to stabilize
sleep 2

# Show status
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Deployment Successful!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Branch: ${BRANCH}${NC}"
echo -e "${GREEN}Commit: ${NEW_COMMIT}${NC}"
echo ""
pm2 status
echo ""
echo -e "${YELLOW}Recent logs:${NC}"
pm2 logs ochoworks --lines 15 --nostream

echo ""
echo -e "${GREEN}Done! Application deployed and running.${NC}"