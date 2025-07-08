# Rate Limiting Usage Guide

This guide shows how to use the enhanced `withCSRF` function with built-in rate limiting for your API routes.

## Basic Usage

The `withCSRF` function now accepts an optional second parameter for rate limiting configuration:

```typescript
import { withCSRF } from '@/lib/csrf';
import { createAPIRateLimit } from '@/lib/rateLimitHelpers';

export const POST = withCSRF(async function (request: Request) {
  // Your API logic here
}, createAPIRateLimit());
```

## Available Helper Functions

### 1. General API Rate Limiting
```typescript
import { createAPIRateLimit } from '@/lib/rateLimitHelpers';

// Default: 100 requests per minute
export const POST = withCSRF(handler, createAPIRateLimit());

// Custom limit: 50 requests per minute
export const POST = withCSRF(handler, createAPIRateLimit(50));
```

### 5. Custom Rate Limiting
```typescript
import { createCustomRateLimit } from '@/lib/rateLimitHelpers';

// Custom configuration
export const POST = withCSRF(handler, createCustomRateLimit(
  'API_REQUEST',
  async (request) => {
    // Custom identifier logic
    const userId = getUserIdFromRequest(request);
    return userId || getClientIP(request);
  },
  25 // Custom max attempts
));
```

## Manual Configuration

You can also configure rate limiting manually without helper functions:

```typescript
import { withCSRF } from '@/lib/csrf';

export const POST = withCSRF(async function (request: Request) {
  // Your API logic here
}, {
  rateLimit: {
    type: 'API_REQUEST',
    identifier: async (request: Request) => {
      // Custom identifier logic
      return 'custom-identifier';
    },
    config: {
      maxAttempts: 10,
      windowMs: 60000, // 1 minute
      blockDurationMs: 300000, // 5 minutes
    },
    skipMethods: ['GET', 'HEAD'], // Skip rate limiting for these methods
  },
});
```

## Rate Limit Types

Available rate limit types:
- `LOGIN_ATTEMPT`: For authentication endpoints
- `API_REQUEST`: For general API endpoints

## Default Configurations

| Type | Window | Max Attempts | Block Duration |
|------|--------|--------------|----------------|
| LOGIN_ATTEMPT | 15 minutes | 5 | 30 minutes |
| API_REQUEST | 1 minute | 100 | 5 minutes |

## Response Headers

When rate limiting is active, the following headers are added to responses:
- `X-RateLimit-Limit`: Maximum number of requests allowed
- `X-RateLimit-Remaining`: Number of requests remaining in current window
- `X-RateLimit-Reset`: Timestamp when the rate limit resets

## Error Handling

When rate limit is exceeded, a 429 status code is returned with:
```json
{
  "error": "Too many requests",
  "message": "Rate limit exceeded. Try again in 30 seconds.",
  "retryAfter": 30,
  "resetTime": "2024-01-01T12:30:00.000Z"
}
```

## Client-Side Handling

The `apiFetch` utility in `src/utils/api.ts` automatically handles rate limiting responses and throws descriptive errors.

## Examples

### Simple API Route
```typescript
// src/app/api/data/route.ts
import { withCSRF } from '@/lib/csrf';
import { createAPIRateLimit } from '@/lib/rateLimitHelpers';

export const GET = withCSRF(async function (request: Request) {
  return Response.json({ data: 'example' });
}, createAPIRateLimit());
```

### No Rate Limiting
```typescript
// For routes that don't need rate limiting
export const GET = withCSRF(async function (request: Request) {
  // Your logic here
}); // No second parameter = no rate limiting
``` 