#!/bin/bash

# Mad Sniper - Flight Demo Quick Start Script
# Makes it easy for judges to run the end-to-end demo

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default goal (escaped $ to prevent shell expansion)
DEFAULT_GOAL='Find cheapest RT flight SFO LHR 3/15-3/22 max $800'

# Use provided goal or default
GOAL="${1:-$DEFAULT_GOAL}"

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  MAD SNIPER - FLIGHT DEMO                                          ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Starting flight search demo...${NC}"
echo -e "${YELLOW}Goal: ${GOAL}${NC}"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}Error: .env file not found!${NC}"
    echo -e "${YELLOW}Please run: cp .env.example .env${NC}"
    echo -e "${YELLOW}Then edit .env and add your OPENAI_API_KEY${NC}"
    exit 1
fi

# Check if node_modules exists
if [ ! -d node_modules ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
fi

# Run the demo
echo -e "${BLUE}Running demo...${NC}"
echo ""

# Use single quotes to preserve $ and other special characters in the goal
node src/demo-cli.js --goal "$GOAL" --verbose

# Capture exit code
EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ Demo completed successfully!${NC}"
else
    echo -e "${RED}❌ Demo failed with exit code $EXIT_CODE${NC}"
fi

exit $EXIT_CODE
