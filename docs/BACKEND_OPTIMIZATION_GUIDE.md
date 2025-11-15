# Backend Optimization Guide - Step by Step

This guide covers all backend optimizations that cannot be done in React Native. Since you're using **Supabase**, all solutions are tailored for Supabase infrastructure.

---

## Table of Contents

1. [Database Indexes](#1-database-indexes)
2. [Cursor-Based Pagination](#2-cursor-based-pagination)
3. [Redis Caching (Supabase Edge Functions)](#3-redis-caching-supabase-edge-functions)
4. [API Rate Limiting](#4-api-rate-limiting)
5. [CDN Setup for Images](#5-cdn-setup-for-images)
6. [Image Optimization Pipeline](#6-image-optimization-pipeline)

---

## 1. Database Indexes

### Step 1: Connect to Supabase SQL Editor

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**

### Step 2: Run Index Creation Scripts

Copy and paste this SQL script:

```sql
-- ============================================
-- DATABASE INDEXES FOR PERFORMANCE
-- ============================================

-- Listings Indexes
CREATE INDEX IF NOT EXISTS idx_listings_status_created
ON listings(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_listings_location
ON listings(city, state);

CREATE INDEX IF NOT EXISTS idx_listings_user_status
ON listings(user_id, status);

CREATE INDEX IF NOT EXISTS idx_listings_model
ON listings(model);

CREATE INDEX IF NOT EXISTS idx_listings_price
ON listings(price);

CREATE INDEX IF NOT EXISTS idx_listings_search
ON listings USING GIN(to_tsvector('english',
  COALESCE(title, '') || ' ' ||
  COALESCE(description, '') || ' ' ||
  COALESCE(model, '')
));

-- Forum Posts Indexes
CREATE INDEX IF NOT EXISTS idx_forum_posts_created
ON forum_posts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_forum_posts_user
ON forum_posts(user_id);

CREATE INDEX IF NOT EXISTS idx_forum_posts_model
ON forum_posts(model);

CREATE INDEX IF NOT EXISTS idx_forum_posts_search
ON forum_posts USING GIN(to_tsvector('english',
  COALESCE(title, '') || ' ' ||
  COALESCE(content, '')
));

-- Events Indexes
CREATE INDEX IF NOT EXISTS idx_events_start_date
ON events(start_date);

CREATE INDEX IF NOT EXISTS idx_events_created_by
ON events(created_by);

CREATE INDEX IF NOT EXISTS idx_events_location
ON events(location);

CREATE INDEX IF NOT EXISTS idx_events_upcoming
ON events(start_date)
WHERE start_date > NOW();

-- Favorites Indexes
CREATE INDEX IF NOT EXISTS idx_listing_favorites_user
ON listing_favorites(user_id);

CREATE INDEX IF NOT EXISTS idx_listing_favorites_listing
ON listing_favorites(listing_id);

CREATE INDEX IF NOT EXISTS idx_listing_favorites_user_listing
ON listing_favorites(user_id, listing_id);

CREATE INDEX IF NOT EXISTS idx_event_favorites_user
ON event_favorites(user_id);

CREATE INDEX IF NOT EXISTS idx_event_favorites_event
ON event_favorites(event_id);

CREATE INDEX IF NOT EXISTS idx_event_favorites_user_event
ON event_favorites(user_id, event_id);

-- Comments Indexes
CREATE INDEX IF NOT EXISTS idx_forum_comments_post
ON forum_comments(post_id, created_at);

CREATE INDEX IF NOT EXISTS idx_forum_comments_user
ON forum_comments(user_id);

-- Messages/Conversations Indexes
CREATE INDEX IF NOT EXISTS idx_conversations_user1
ON conversations(user1_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_user2
ON conversations(user2_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_conversation
ON messages(conversation_id, created_at DESC);

-- Listing Images Indexes
CREATE INDEX IF NOT EXISTS idx_listing_images_listing
ON listing_images(listing_id, is_primary);

-- Garage Indexes
CREATE INDEX IF NOT EXISTS idx_garage_user
ON garage(user_id);

CREATE INDEX IF NOT EXISTS idx_garage_model
ON garage(model);

-- Verify indexes were created
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

### Step 3: Verify Indexes

Run this query to see all indexes:

```sql
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename;
```

### Step 4: Monitor Index Usage

Check if indexes are being used:

```sql
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

---

## 2. Cursor-Based Pagination

### Step 1: Update Listings Service (Backend)

Create a new Supabase Edge Function or update your RPC functions:

**File: `supabase/functions/get-listings-cursor/index.ts`**

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const { cursor, limit = 10, filters = {} } = await req.json();

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let query = supabaseClient
      .from("listings")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(limit);

    // Apply cursor (cursor is the created_at timestamp of last item)
    if (cursor) {
      query = query.lt("created_at", cursor);
    }

    // Apply filters
    if (filters.city) {
      query = query.ilike("city", `%${filters.city}%`);
    }
    if (filters.state) {
      query = query.eq("state", filters.state);
    }
    if (filters.minPrice) {
      query = query.gte("price", filters.minPrice);
    }
    if (filters.maxPrice) {
      query = query.lte("price", filters.maxPrice);
    }
    if (filters.model) {
      query = query.eq("model", filters.model);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Return data with next cursor
    const nextCursor =
      data.length > 0 ? data[data.length - 1].created_at : null;

    return new Response(
      JSON.stringify({
        data,
        nextCursor,
        hasMore: data.length === limit,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});
```

### Step 2: Create Database Function (Alternative - More Efficient)

**Run in Supabase SQL Editor:**

```sql
-- Cursor-based pagination function for listings
CREATE OR REPLACE FUNCTION get_listings_cursor(
  p_cursor TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 10,
  p_city TEXT DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_min_price NUMERIC DEFAULT NULL,
  p_max_price NUMERIC DEFAULT NULL,
  p_model TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  title TEXT,
  description TEXT,
  price NUMERIC,
  city TEXT,
  state TEXT,
  model TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  next_cursor TIMESTAMPTZ,
  has_more BOOLEAN
) AS $$
DECLARE
  v_cursor TIMESTAMPTZ;
  v_results RECORD;
BEGIN
  -- Build dynamic query
  RETURN QUERY
  WITH filtered_listings AS (
    SELECT *
    FROM listings
    WHERE status = 'active'
      AND (p_cursor IS NULL OR created_at < p_cursor)
      AND (p_city IS NULL OR city ILIKE '%' || p_city || '%')
      AND (p_state IS NULL OR state = p_state)
      AND (p_min_price IS NULL OR price >= p_min_price)
      AND (p_max_price IS NULL OR price <= p_max_price)
      AND (p_model IS NULL OR model = p_model)
    ORDER BY created_at DESC
    LIMIT p_limit + 1  -- Fetch one extra to check if there's more
  ),
  results AS (
    SELECT * FROM filtered_listings LIMIT p_limit
  )
  SELECT
    r.id,
    r.user_id,
    r.title,
    r.description,
    r.price,
    r.city,
    r.state,
    r.model,
    r.status,
    r.created_at,
    (SELECT created_at FROM filtered_listings OFFSET p_limit LIMIT 1) as next_cursor,
    (SELECT COUNT(*) > p_limit FROM filtered_listings) as has_more
  FROM results r
  ORDER BY r.created_at DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_listings_cursor TO authenticated;
GRANT EXECUTE ON FUNCTION get_listings_cursor TO anon;
```

### Step 3: Update React Native Service

**File: `src/services/listings.ts`**

```typescript
interface CursorPaginationParams {
  cursor?: string; // ISO timestamp string
  limit?: number;
  city?: string;
  state?: string;
  minPrice?: number;
  maxPrice?: number;
  model?: string;
}

interface CursorPaginationResult<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

async getAllListingsCursor(
  params: CursorPaginationParams = {}
): Promise<CursorPaginationResult<ListingWithImages>> {
  const { cursor, limit = 10, ...filters } = params;

  // Option 1: Use Edge Function
  const { data, error } = await supabase.functions.invoke('get-listings-cursor', {
    body: { cursor, limit, filters }
  });

  // Option 2: Use RPC function (more efficient)
  // const { data, error } = await supabase.rpc('get_listings_cursor', {
  //   p_cursor: cursor || null,
  //   p_limit: limit,
  //   p_city: filters.city || null,
  //   p_state: filters.state || null,
  //   p_min_price: filters.minPrice || null,
  //   p_max_price: filters.maxPrice || null,
  //   p_model: filters.model || null,
  // });

  if (error) throw error;

  // Fetch images for listings
  const listingsWithImages = await Promise.all(
    data.data.map(async (listing: any) => {
      const { data: images } = await supabase
        .from('listing_images')
        .select('*')
        .eq('listing_id', listing.id)
        .order('is_primary', { ascending: false });

      return {
        ...listing,
        listing_images: images || [],
      };
    })
  );

  return {
    data: listingsWithImages,
    nextCursor: data.nextCursor,
    hasMore: data.hasMore,
  };
}
```

---

## 3. Redis Caching (Supabase Edge Functions)

### Step 1: Set Up Upstash Redis (Free Tier Available)

1. Go to [Upstash.com](https://upstash.com/)
2. Sign up for free account
3. Create a new Redis database
4. Copy the **REST API URL** and **REST API Token**

### Step 2: Create Cached Edge Function

**File: `supabase/functions/get-cached-listings/index.ts`**

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const REDIS_URL = Deno.env.get("UPSTASH_REDIS_URL") ?? "";
const REDIS_TOKEN = Deno.env.get("UPSTASH_REDIS_TOKEN") ?? "";

// Cache TTL in seconds
const CACHE_TTL = {
  LISTINGS: 300, // 5 minutes
  EVENTS: 600, // 10 minutes
  PROFILE: 600, // 10 minutes
  STATS: 300, // 5 minutes
};

async function getFromCache(key: string): Promise<any> {
  try {
    const response = await fetch(`${REDIS_URL}/get/${key}`, {
      headers: {
        Authorization: `Bearer ${REDIS_TOKEN}`,
      },
    });
    const data = await response.json();
    return data.result ? JSON.parse(data.result) : null;
  } catch (error) {
    console.error("Redis get error:", error);
    return null;
  }
}

async function setCache(key: string, value: any, ttl: number): Promise<void> {
  try {
    await fetch(`${REDIS_URL}/setex/${key}/${ttl}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REDIS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(value),
    });
  } catch (error) {
    console.error("Redis set error:", error);
  }
}

async function invalidateCache(pattern: string): Promise<void> {
  try {
    // Upstash supports pattern matching
    const keys = await fetch(`${REDIS_URL}/keys/${pattern}`, {
      headers: {
        Authorization: `Bearer ${REDIS_TOKEN}`,
      },
    });
    const { result } = await keys.json();

    if (result && result.length > 0) {
      await fetch(`${REDIS_URL}/del`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${REDIS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(result),
      });
    }
  } catch (error) {
    console.error("Redis invalidate error:", error);
  }
}

serve(async (req) => {
  try {
    const { type, params = {} } = await req.json();

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Build cache key
    const cacheKey = `cache:${type}:${JSON.stringify(params)}`;

    // Try cache first
    const cached = await getFromCache(cacheKey);
    if (cached) {
      return new Response(JSON.stringify({ data: cached, cached: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Fetch from database
    let data;
    let ttl = CACHE_TTL.LISTINGS;

    switch (type) {
      case "listings":
        const { data: listings } = await supabaseClient
          .from("listings")
          .select("*")
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(params.limit || 20);
        data = listings;
        ttl = CACHE_TTL.LISTINGS;
        break;

      case "events":
        const { data: events } = await supabaseClient
          .from("events")
          .select("*")
          .gte("start_date", new Date().toISOString())
          .order("start_date", { ascending: true })
          .limit(params.limit || 20);
        data = events;
        ttl = CACHE_TTL.EVENTS;
        break;

      case "profile":
        const { data: profile } = await supabaseClient
          .from("profiles")
          .select("*")
          .eq("id", params.userId)
          .single();
        data = profile;
        ttl = CACHE_TTL.PROFILE;
        break;

      case "stats":
        const userId = params.userId;
        const { data: stats } = await supabaseClient.rpc("get_user_stats", {
          p_user_id: userId,
        });
        data = stats;
        ttl = CACHE_TTL.STATS;
        break;

      default:
        throw new Error("Invalid cache type");
    }

    // Cache the result
    await setCache(cacheKey, data, ttl);

    return new Response(JSON.stringify({ data, cached: false }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});
```

### Step 3: Set Environment Variables

In Supabase Dashboard:

1. Go to **Project Settings** → **Edge Functions**
2. Add secrets:
   - `UPSTASH_REDIS_URL` = Your Upstash REST URL
   - `UPSTASH_REDIS_TOKEN` = Your Upstash REST Token

### Step 4: Deploy Edge Function

```bash
# Install Supabase CLI if not installed
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Deploy function
supabase functions deploy get-cached-listings
```

### Step 5: Create Database Trigger for Cache Invalidation

**Run in SQL Editor:**

```sql
-- Function to invalidate cache on data changes
CREATE OR REPLACE FUNCTION invalidate_listings_cache()
RETURNS TRIGGER AS $$
BEGIN
  -- Call Edge Function to invalidate cache
  PERFORM net.http_post(
    url := current_setting('app.settings.edge_function_url') || '/invalidate-cache',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.edge_function_key')
    ),
    body := jsonb_build_object(
      'pattern', 'cache:listings:*'
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on listings table
CREATE TRIGGER invalidate_listings_cache_trigger
AFTER INSERT OR UPDATE OR DELETE ON listings
FOR EACH ROW
EXECUTE FUNCTION invalidate_listings_cache();
```

---

## 4. API Rate Limiting

### Step 1: Create Rate Limiting Edge Function

**File: `supabase/functions/rate-limiter/index.ts`**

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Rate limits (requests per window)
const RATE_LIMITS = {
  authenticated: {
    window: 60, // 60 seconds
    max: 100, // 100 requests per minute
  },
  unauthenticated: {
    window: 60,
    max: 20, // 20 requests per minute
  },
  critical: {
    window: 60,
    max: 10, // 10 requests per minute (like, favorite)
  },
};

// In-memory rate limit store (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(
  userId: string | null,
  isCritical: boolean = false
): { allowed: boolean; remaining: number; resetAt: number } {
  const key = userId || "anonymous";
  const limits = isCritical
    ? RATE_LIMITS.critical
    : userId
    ? RATE_LIMITS.authenticated
    : RATE_LIMITS.unauthenticated;

  const now = Date.now();
  const windowMs = limits.window * 1000;

  const record = rateLimitStore.get(key);

  if (!record || now > record.resetAt) {
    // New window
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return {
      allowed: true,
      remaining: limits.max - 1,
      resetAt: now + windowMs,
    };
  }

  if (record.count >= limits.max) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: record.resetAt,
    };
  }

  record.count++;
  return {
    allowed: true,
    remaining: limits.max - record.count,
    resetAt: record.resetAt,
  };
}

serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization");
    const userId = authHeader ? extractUserId(authHeader) : null;
    const { isCritical = false } = await req.json().catch(() => ({}));

    const { allowed, remaining, resetAt } = checkRateLimit(userId, isCritical);

    if (!allowed) {
      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded",
          retryAfter: Math.ceil((resetAt - Date.now()) / 1000),
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Limit": String(RATE_LIMITS.authenticated.max),
            "X-RateLimit-Remaining": String(remaining),
            "X-RateLimit-Reset": String(resetAt),
            "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)),
          },
        }
      );
    }

    return new Response(JSON.stringify({ allowed: true, remaining }), {
      headers: {
        "Content-Type": "application/json",
        "X-RateLimit-Limit": String(RATE_LIMITS.authenticated.max),
        "X-RateLimit-Remaining": String(remaining),
        "X-RateLimit-Reset": String(resetAt),
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

function extractUserId(authHeader: string): string | null {
  // Extract user ID from JWT token
  // This is simplified - use proper JWT decoding in production
  try {
    const token = authHeader.replace("Bearer ", "");
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.sub || null;
  } catch {
    return null;
  }
}
```

### Step 2: Use Redis for Rate Limiting (Production)

**Update to use Upstash Redis:**

```typescript
const REDIS_URL = Deno.env.get("UPSTASH_REDIS_URL") ?? "";
const REDIS_TOKEN = Deno.env.get("UPSTASH_REDIS_TOKEN") ?? "";

async function checkRateLimitRedis(
  userId: string | null,
  isCritical: boolean = false
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const key = `ratelimit:${userId || "anonymous"}:${
    isCritical ? "critical" : "normal"
  }`;
  const limits = isCritical
    ? RATE_LIMITS.critical
    : userId
    ? RATE_LIMITS.authenticated
    : RATE_LIMITS.unauthenticated;

  const now = Date.now();
  const windowMs = limits.window * 1000;

  // Get current count
  const response = await fetch(`${REDIS_URL}/get/${key}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  });
  const { result } = await response.json();

  const count = result ? parseInt(result) : 0;

  if (count >= limits.max) {
    const ttl = await fetch(`${REDIS_URL}/ttl/${key}`, {
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    });
    const { result: ttlResult } = await ttl.json();

    return {
      allowed: false,
      remaining: 0,
      resetAt: now + ttlResult * 1000,
    };
  }

  // Increment counter
  await fetch(`${REDIS_URL}/incr/${key}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  });

  // Set expiry if first request
  if (count === 0) {
    await fetch(`${REDIS_URL}/expire/${key}/${limits.window}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    });
  }

  return {
    allowed: true,
    remaining: limits.max - count - 1,
    resetAt: now + windowMs,
  };
}
```

### Step 3: Add Rate Limiting Middleware to Edge Functions

Wrap your Edge Functions with rate limiting:

```typescript
async function withRateLimit(
  req: Request,
  handler: (req: Request) => Promise<Response>,
  isCritical: boolean = false
): Promise<Response> {
  const authHeader = req.headers.get("Authorization");
  const userId = authHeader ? extractUserId(authHeader) : null;

  const { allowed, remaining, resetAt } = await checkRateLimitRedis(
    userId,
    isCritical
  );

  if (!allowed) {
    return new Response(
      JSON.stringify({
        error: "Rate limit exceeded",
        retryAfter: Math.ceil((resetAt - Date.now()) / 1000),
      }),
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)),
        },
      }
    );
  }

  const response = await handler(req);
  response.headers.set("X-RateLimit-Remaining", String(remaining));
  return response;
}
```

---

## 5. CDN Setup for Images

### Option 1: Cloudflare CDN (Recommended - Free)

#### Step 1: Set Up Cloudflare Account

1. Go to [Cloudflare.com](https://cloudflare.com)
2. Sign up for free account
3. Add your domain (or use Cloudflare Workers for subdomain)

#### Step 2: Configure Supabase Storage with Cloudflare

**Create Cloudflare Worker:**

```javascript
// cloudflare-worker.js
addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);

  // Proxy Supabase Storage URLs
  if (url.pathname.startsWith("/storage/")) {
    const supabaseUrl = "https://your-project.supabase.co";
    const proxiedUrl = `${supabaseUrl}${url.pathname}${url.search}`;

    const response = await fetch(proxiedUrl, {
      headers: {
        ...request.headers,
        Authorization: request.headers.get("Authorization") || "",
      },
    });

    // Cache images for 1 year
    const cacheResponse = response.clone();
    cacheResponse.headers.set(
      "Cache-Control",
      "public, max-age=31536000, immutable"
    );

    return cacheResponse;
  }

  return new Response("Not Found", { status: 404 });
}
```

#### Step 3: Update Image URLs in React Native

**File: `src/utils/imageUtils.ts`**

```typescript
const CLOUDFLARE_CDN_URL = "https://your-cdn.yourdomain.com";

export function getCDNImageUrl(supabaseUrl: string): string {
  if (!supabaseUrl) return supabaseUrl;

  // Replace Supabase Storage URL with CDN URL
  if (supabaseUrl.includes("supabase.co/storage")) {
    return supabaseUrl.replace(
      "https://your-project.supabase.co/storage",
      `${CLOUDFLARE_CDN_URL}/storage`
    );
  }

  return supabaseUrl;
}
```

### Option 2: Supabase Storage CDN (Built-in)

Supabase Storage already uses CDN! Just ensure your bucket is public:

```sql
-- Make bucket public (run in SQL Editor)
UPDATE storage.buckets
SET public = true
WHERE name = 'listing-images';

UPDATE storage.buckets
SET public = true
WHERE name = 'profile-avatars';
```

### Option 3: Cloudinary (Advanced)

1. Sign up at [Cloudinary.com](https://cloudinary.com)
2. Get API credentials
3. Upload images to Cloudinary instead of Supabase Storage
4. Use Cloudinary's transformation URLs for optimization

---

## 6. Image Optimization Pipeline

### Step 1: Create Image Processing Edge Function

**File: `supabase/functions/process-image/index.ts`**

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const { imageUrl, sizes = ["thumbnail", "medium", "large"] } =
      await req.json();

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Download original image
    const imageResponse = await fetch(imageUrl);
    const imageBlob = await imageResponse.blob();
    const imageArrayBuffer = await imageBlob.arrayBuffer();

    // Process each size
    const processedImages = await Promise.all(
      sizes.map(async (size) => {
        const dimensions = {
          thumbnail: { width: 300, height: 300 },
          medium: { width: 800, height: 600 },
          large: { width: 1920, height: 1080 },
        }[size] || { width: 800, height: 600 };

        // Use Sharp-like library or ImageMagick
        // For Deno, we'll use a simple resize (install sharp-deno)
        const resizedImage = await resizeImage(
          imageArrayBuffer,
          dimensions.width,
          dimensions.height
        );

        // Upload to Supabase Storage
        const fileName = `${size}-${Date.now()}.webp`;
        const { data, error } = await supabaseClient.storage
          .from("processed-images")
          .upload(fileName, resizedImage, {
            contentType: "image/webp",
            upsert: false,
          });

        if (error) throw error;

        // Get public URL
        const {
          data: { publicUrl },
        } = supabaseClient.storage
          .from("processed-images")
          .getPublicUrl(fileName);

        return {
          size,
          url: publicUrl,
          width: dimensions.width,
          height: dimensions.height,
        };
      })
    );

    return new Response(JSON.stringify({ images: processedImages }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});

// Simple image resize (install proper library in production)
async function resizeImage(
  imageBuffer: ArrayBuffer,
  width: number,
  height: number
): Promise<Blob> {
  // Use ImageMagick or Sharp for production
  // This is a placeholder
  return new Blob([imageBuffer], { type: "image/webp" });
}
```

### Step 2: Create Database Trigger for Auto-Processing

**Run in SQL Editor:**

```sql
-- Function to trigger image processing
CREATE OR REPLACE FUNCTION process_listing_image()
RETURNS TRIGGER AS $$
BEGIN
  -- Call Edge Function to process image
  PERFORM net.http_post(
    url := current_setting('app.settings.edge_function_url') || '/process-image',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.edge_function_key')
    ),
    body := jsonb_build_object(
      'imageUrl', NEW.image_url,
      'listingId', NEW.listing_id
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on listing_images insert
CREATE TRIGGER process_listing_image_trigger
AFTER INSERT ON listing_images
FOR EACH ROW
WHEN (NEW.image_url IS NOT NULL)
EXECUTE FUNCTION process_listing_image();
```

### Step 3: Use Optimized Images in React Native

**File: `src/utils/imageUtils.ts`**

```typescript
interface ImageSizes {
  thumbnail: string;
  medium: string;
  large: string;
}

export function getOptimizedImageUrl(
  originalUrl: string,
  size: "thumbnail" | "medium" | "large" = "medium"
): string {
  // If using Cloudinary
  if (originalUrl.includes("cloudinary.com")) {
    const transformations = {
      thumbnail: "w_300,h_300,c_fill",
      medium: "w_800,h_600,c_fill",
      large: "w_1920,h_1080,c_fill",
    };
    return originalUrl.replace("/upload/", `/upload/${transformations[size]}/`);
  }

  // If using Supabase with processed images
  // Store processed URLs in database and use them
  return originalUrl;
}

// Get responsive image based on device pixel ratio
export function getResponsiveImageUrl(originalUrl: string): string {
  const pixelRatio = 2; // Get from device
  const size =
    pixelRatio >= 3 ? "large" : pixelRatio >= 2 ? "medium" : "thumbnail";
  return getOptimizedImageUrl(originalUrl, size);
}
```

---

## Quick Setup Script

Create a file `setup-backend.sh`:

```bash
#!/bin/bash

echo "🚀 Setting up backend optimizations..."

# 1. Database Indexes
echo "📊 Creating database indexes..."
supabase db execute --file sql/indexes.sql

# 2. Cursor Pagination Functions
echo "📄 Creating cursor pagination functions..."
supabase db execute --file sql/cursor-pagination.sql

# 3. Deploy Edge Functions
echo "⚡ Deploying Edge Functions..."
supabase functions deploy get-cached-listings
supabase functions deploy rate-limiter
supabase functions deploy process-image

# 4. Set Environment Variables
echo "🔐 Setting environment variables..."
supabase secrets set UPSTASH_REDIS_URL=your-redis-url
supabase secrets set UPSTASH_REDIS_TOKEN=your-redis-token

echo "✅ Backend optimizations complete!"
```

---

## Testing Checklist

- [ ] Database indexes created and verified
- [ ] Cursor pagination working (test with large datasets)
- [ ] Redis caching working (check cache hits)
- [ ] Rate limiting working (test with rapid requests)
- [ ] CDN serving images (check response headers)
- [ ] Image optimization working (check file sizes)

---

## Monitoring

### Check Database Performance

```sql
-- Slow queries
SELECT
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

### Check Cache Hit Rate

Monitor Redis cache hits vs misses in Upstash dashboard.

### Check Rate Limit Hits

Monitor 429 responses in Supabase Edge Functions logs.

---

## Next Steps

1. **Set up monitoring** - Use Supabase Dashboard + Upstash Dashboard
2. **Load testing** - Test with tools like k6 or Artillery
3. **Optimize further** - Based on monitoring data
4. **Scale infrastructure** - Upgrade Supabase plan if needed

---

**Need help?** Check Supabase docs:

- [Edge Functions](https://supabase.com/docs/guides/functions)
- [Database Functions](https://supabase.com/docs/guides/database/functions)
- [Storage CDN](https://supabase.com/docs/guides/storage/cdn)
