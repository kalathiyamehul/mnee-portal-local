 # Rate Limiting & Brute Force Protection Implementation

## Overview

This implementation provides comprehensive rate limiting and brute force protection for the MNEE Portal application. It includes multiple layers of protection against various types of attacks including login brute force, API abuse, and account enumeration.

## Features

### 1. Rate Limiting Types
- **LOGIN_ATTEMPT**: Protects against login brute force attacks
- **API_REQUEST**: General API rate limiting
- **PASSWORD_RESET**: Limits password reset attempts
- **TWO_FA_ATTEMPT**: Protects 2FA verification endpoints

### 2. Account Lockout Protection
- Automatic account lockout after failed login attempts
- Configurable lockout duration
- Automatic unlock after lockout period expires
- Admin tools for manual account unlocking

### 3. IP-based Rate Limiting
- Tracks attempts by IP address
- Prevents distributed attacks
- Configurable time windows and attempt limits

### 4. Database-backed Tracking
- Persistent rate limit tracking
- Automatic cleanup of old records
- Detailed logging for security auditing

## Configuration

### Default Rate Limit Configurations

```typescript
export const RATE_LIMIT_CONFIGS: Record<RateLimitType, RateLimitConfig> = {
  LOGIN_ATTEMPT: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxAttempts: 5, // 5 attempts per 15 minutes
    blockDurationMs: 30 * 60 * 1000, // Block for 30 minutes
  },
  API_REQUEST: {
    windowMs: 60 * 1000, // 1 minute
    maxAttempts: 100, // 100 requests per minute
    blockDurationMs: 5 * 60 * 1000, // Block for 5 minutes
  },
  PASSWORD_RESET: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxAttempts: 3, // 3 attempts per hour
    blockDurationMs: 60 * 60 * 1000, // Block for 1 hour
  },
  TWO_FA_ATTEMPT: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxAttempts: 5, // 5 attempts per 5 minutes
    blockDurationMs: 15 * 60 * 1000, // Block for 15 minutes
  },
};
```

### Account Lockout Configuration

```typescript
export const DEFAULT_LOCKOUT_CONFIG: AccountLockoutConfig = {
  maxFailedAttempts: 5,
  lockoutDurationMs: 30 * 60 * 1000, // 30 minutes
  resetSuccessfulLogin: true,
};
```

## Database Schema

### Rate Limit Attempts Table
```sql
model RateLimitAttempt {
  id          String   @id @default(uuid())
  identifier  String   // IP address or email
  type        RateLimitType
  attempts    Int      @default(1)
  windowStart DateTime @default(now()) @map("window_start")
  lastAttempt DateTime @default(now()) @map("last_attempt")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@unique([identifier, type])
  @@index([identifier, type, windowStart])
  @@map("rate_limit_attempt")
}
```

### Account Lockout Table
```sql
model AccountLockout {
  id            String   @id @default(uuid())
  email         String   @unique
  failedAttempts Int     @default(0) @map("failed_attempts")
  lockedUntil   DateTime? @map("locked_until")
  lastFailedAt  DateTime? @map("last_failed_at")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  @@index([email, lockedUntil])
  @@map("account_lockout")
}
```

## Usage

### 1. Applying Rate Limiting to API Routes

```typescript
// src/app/api/auth/login/route.ts
import { withCSRF } from '@/lib/csrf';
import { createAPIRateLimit } from '@/lib/rateLimitHelpers';

export const POST = withCSRF(async function (request: Request) {
  // Login logic
}, createAPIRateLimit());
```

### 2. Manual Rate Limit Checks

```typescript
import { checkRateLimit, checkAccountLockout } from '@/lib/rateLimiter';

// Check rate limit
const rateLimitResult = await checkRateLimit(
  'user@example.com',
  'LOGIN_ATTEMPT'
);

if (rateLimitResult.blocked) {
  // Handle rate limit exceeded
}

// Check account lockout
const lockoutResult = await checkAccountLockout('user@example.com');
if (lockoutResult.isLocked) {
  // Handle locked account
}
```

### 3. Admin Management

The system provides admin endpoints for managing rate limits:

```typescript
// Unlock a specific account
POST /api/admin/rate-limit
{
  "action": "unlock_account",
  "email": "user@example.com"
}

// Reset rate limit for specific identifier
POST /api/admin/rate-limit
{
  "action": "reset_rate_limit",
  "identifier": "192.168.1.1",
  "type": "LOGIN_ATTEMPT"
}

// Bulk unlock all accounts
POST /api/admin/rate-limit
{
  "action": "bulk_unlock"
}

// Clean up old records
POST /api/admin/rate-limit
{
  "action": "cleanup_old_records"
}
```

## Security Features

### 1. IP Address Detection
The system detects client IP addresses from various headers:
- `x-forwarded-for`
- `x-real-ip`
- `cf-connecting-ip`

### 2. User Enumeration Protection
- Failed login attempts are tracked even for non-existent users
- Consistent response times for valid and invalid users
- No indication whether an email exists in the system

### 3. Distributed Attack Protection
- Rate limiting by IP address prevents distributed attacks
- Combined IP + email tracking for login attempts

### 4. Fail-Safe Design
- If rate limiting fails due to database errors, requests are allowed
- Graceful degradation ensures system availability

## Response Headers

When rate limiting is active, the following headers are included:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200000
Retry-After: 60
```

## Error Responses

### Rate Limit Exceeded
```json
{
  "error": "Too many requests",
  "message": "Rate limit exceeded. Try again in 60 seconds.",
  "retryAfter": 60,
  "resetTime": "2023-12-31T23:59:59.000Z"
}
```

### Account Locked
```json
{
  "error": "Account locked until 2023-12-31T23:59:59.000Z"
}
```

## Monitoring and Logging

### Activity Logging
All rate limiting actions are logged to the `ActivityLog` table:
- Account lockouts and unlocks
- Rate limit resets
- Admin actions

### Metrics Available
- Failed login attempts per user
- Rate limit violations by IP
- Account lockout frequency
- Admin interventions

## Best Practices

### 1. Configuration
- Adjust rate limits based on your application's usage patterns
- Monitor false positives and adjust thresholds accordingly
- Consider different limits for different user types

### 2. Monitoring
- Set up alerts for high numbers of rate limit violations
- Monitor account lockout patterns
- Review admin actions regularly

### 3. User Experience
- Provide clear error messages to legitimate users
- Implement progressive delays rather than hard blocks where appropriate
- Offer alternative authentication methods for locked accounts

## Migration

To apply the rate limiting schema to your database:

```bash
npx prisma migrate dev --name add-rate-limiting
```

Or if you're in production:

```bash
npx prisma migrate deploy
```

## Testing

### Unit Tests
Test rate limiting functions with various scenarios:
- Normal usage within limits
- Exceeding rate limits
- Account lockout scenarios
- Admin unlock functionality

### Integration Tests
- Test API endpoints with rate limiting applied
- Verify proper error responses
- Test rate limit headers

### Load Testing
- Verify rate limiting works under high load
- Test distributed attack scenarios
- Ensure database performance with rate limiting

## Troubleshooting

### Common Issues

1. **Rate limits too strict**: Adjust `maxAttempts` and `windowMs` values
2. **Database performance**: Ensure proper indexing on rate limit tables
3. **False positives**: Review IP detection logic for proxy environments
4. **Memory usage**: Implement regular cleanup of old records

### Debug Mode
Enable detailed logging by setting environment variable:
```bash
DEBUG_RATE_LIMITING=true
```

## Future Enhancements

1. **Redis Integration**: For high-scale deployments
2. **Geolocation-based Rules**: Different limits by country
3. **Machine Learning**: Adaptive rate limiting based on behavior patterns
4. **Whitelist/Blacklist**: IP-based allow/deny lists
5. **CAPTCHA Integration**: Progressive challenges for suspicious activity