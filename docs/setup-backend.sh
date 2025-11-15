#!/bin/bash

# Backend Optimization Setup Script
# Run this script to set up all backend optimizations

set -e

echo "🚀 Starting backend optimization setup..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${YELLOW}⚠️  Supabase CLI not found. Installing...${NC}"
    npm install -g supabase
fi

# Check if user is logged in
if ! supabase projects list &> /dev/null; then
    echo -e "${YELLOW}⚠️  Please login to Supabase first:${NC}"
    echo "   supabase login"
    exit 1
fi

echo -e "${BLUE}📊 Step 1: Creating database indexes...${NC}"
if [ -f "docs/indexes.sql" ]; then
    supabase db execute --file docs/indexes.sql
    echo -e "${GREEN}✅ Indexes created${NC}"
else
    echo -e "${YELLOW}⚠️  docs/indexes.sql not found, skipping...${NC}"
fi

echo ""
echo -e "${BLUE}📄 Step 2: Creating cursor pagination functions...${NC}"
if [ -f "docs/cursor-pagination.sql" ]; then
    supabase db execute --file docs/cursor-pagination.sql
    echo -e "${GREEN}✅ Cursor pagination functions created${NC}"
else
    echo -e "${YELLOW}⚠️  docs/cursor-pagination.sql not found, skipping...${NC}"
fi

echo ""
echo -e "${BLUE}⚡ Step 3: Deploying Edge Functions...${NC}"

# Deploy cached listings function
if [ -d "supabase/functions/get-cached-listings" ]; then
    echo "   Deploying get-cached-listings..."
    supabase functions deploy get-cached-listings
    echo -e "${GREEN}✅ get-cached-listings deployed${NC}"
else
    echo -e "${YELLOW}⚠️  get-cached-listings function not found, skipping...${NC}"
fi

# Deploy rate limiter function
if [ -d "supabase/functions/rate-limiter" ]; then
    echo "   Deploying rate-limiter..."
    supabase functions deploy rate-limiter
    echo -e "${GREEN}✅ rate-limiter deployed${NC}"
else
    echo -e "${YELLOW}⚠️  rate-limiter function not found, skipping...${NC}"
fi

# Deploy image processing function
if [ -d "supabase/functions/process-image" ]; then
    echo "   Deploying process-image..."
    supabase functions deploy process-image
    echo -e "${GREEN}✅ process-image deployed${NC}"
else
    echo -e "${YELLOW}⚠️  process-image function not found, skipping...${NC}"
fi

echo ""
echo -e "${BLUE}🔐 Step 4: Setting environment variables...${NC}"
echo -e "${YELLOW}⚠️  Please set these manually in Supabase Dashboard:${NC}"
echo "   - UPSTASH_REDIS_URL"
echo "   - UPSTASH_REDIS_TOKEN"
echo ""
echo "   Or run:"
echo "   supabase secrets set UPSTASH_REDIS_URL=your-redis-url"
echo "   supabase secrets set UPSTASH_REDIS_TOKEN=your-redis-token"

echo ""
echo -e "${GREEN}✅ Backend optimization setup complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Set up Upstash Redis (https://upstash.com)"
echo "2. Configure CDN (Cloudflare or Supabase Storage CDN)"
echo "3. Test the optimizations"
echo ""
echo "See docs/BACKEND_OPTIMIZATION_GUIDE.md for detailed instructions"

