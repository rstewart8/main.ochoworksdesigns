#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Swap Space Setup for EC2${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Please run as root (sudo ./setup-swap.sh)${NC}"
    exit 1
fi

# Check if swap already exists
SWAP_TOTAL=$(free -m | awk '/^Swap:/ {print $2}')
if [ "$SWAP_TOTAL" -gt 0 ]; then
    echo -e "${YELLOW}Swap space already exists (${SWAP_TOTAL}MB)${NC}"
    echo -e "${YELLOW}Current swap status:${NC}"
    free -h
    echo ""
    read -p "Do you want to recreate it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${GREEN}Keeping existing swap. Exiting.${NC}"
        exit 0
    fi
    
    echo -e "${YELLOW}Removing existing swap...${NC}"
    swapoff -a
    sed -i '/swapfile/d' /etc/fstab
    rm -f /swapfile
fi

# Show available disk space
echo -e "${YELLOW}Current disk usage:${NC}"
df -h /
echo ""

# Check available disk space
AVAILABLE_GB=$(df -BG / | awk 'NR==2 {print $4}' | sed 's/G//')
if [ "$AVAILABLE_GB" -lt 3 ]; then
    echo -e "${RED}Warning: Low disk space (${AVAILABLE_GB}GB available)${NC}"
    echo -e "${YELLOW}Recommended: At least 3GB free for a 2GB swap file${NC}"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Create swap file
echo -e "${YELLOW}Creating 2GB swap file...${NC}"
fallocate -l 2G /swapfile
if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to create swap file!${NC}"
    exit 1
fi

# Set correct permissions
echo -e "${YELLOW}Setting permissions...${NC}"
chmod 600 /swapfile

# Format as swap
echo -e "${YELLOW}Formatting swap space...${NC}"
mkswap /swapfile
if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to format swap!${NC}"
    exit 1
fi

# Enable swap
echo -e "${YELLOW}Enabling swap...${NC}"
swapon /swapfile
if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to enable swap!${NC}"
    exit 1
fi

# Make it permanent
echo -e "${YELLOW}Making swap permanent (survives reboots)...${NC}"
if ! grep -q '/swapfile' /etc/fstab; then
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    echo -e "${GREEN}Added to /etc/fstab${NC}"
else
    echo -e "${YELLOW}Already in /etc/fstab${NC}"
fi

# Set swappiness (how aggressively to use swap)
echo -e "${YELLOW}Configuring swappiness...${NC}"
sysctl vm.swappiness=10
if ! grep -q 'vm.swappiness' /etc/sysctl.conf; then
    echo 'vm.swappiness=10' >> /etc/sysctl.conf
    echo -e "${GREEN}Swappiness set to 10 (conservative, only use swap when needed)${NC}"
else
    sed -i 's/vm.swappiness=.*/vm.swappiness=10/' /etc/sysctl.conf
    echo -e "${GREEN}Swappiness updated to 10${NC}"
fi

# Show results
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Swap Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${GREEN}Memory status:${NC}"
free -h
echo ""
echo -e "${GREEN}Swap file details:${NC}"
ls -lh /swapfile
echo ""
echo -e "${GREEN}Disk space after setup:${NC}"
df -h /
echo ""
echo -e "${GREEN}✓ 2GB swap will persist after reboots${NC}"
echo -e "${GREEN}✓ Swappiness set to 10 (only use when needed)${NC}"
echo ""
echo -e "${BLUE}You can now run your deployment script!${NC}"