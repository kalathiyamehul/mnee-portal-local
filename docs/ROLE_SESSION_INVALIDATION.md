# Role-Based Session Invalidation Implementation

## Overview

This implementation ensures that users are automatically logged out when their roles are updated, deleted, or reassigned. It uses a combination of database timestamps, JWT token validation, and real-time Server-Sent Events (SSE) to provide immediate session invalidation.

## Key Components

### 1. Database Schema Changes

- **Added `lastRoleUpdatedAt` field** to the `User` model in `schema.prisma`
- This timestamp tracks when a user's role was last modified
- Used for JWT token validation to determine if a session should be invalidated

### 2. JWT Token Validation

- **Updated `authOptions.ts`** to check `lastRoleUpdatedAt` in the JWT callback
- Compares token issue time with the last role update time
- Marks tokens as `invalidated` if they were issued before the role change
- Throws `SESSION_INVALIDATED` error to force logout

### 3. Server-Sent Events (SSE)

- **Added new events** to `sseEmitter.ts`:
  - `ROLE_UPDATE`: Emitted when roles are created, updated, or deleted
  - `USER_SESSION_INVALIDATE`: Emitted to trigger immediate logout for affected users

- **Updated SSE endpoint** (`/api/sse/route.ts`) to handle new events

### 4. API Updates

#### Role Management APIs (`/api/role/route.ts`)

- **Role Creation**: Emits `ROLE_UPDATE` event
- **Role Update**: 
  - Updates `lastRoleUpdatedAt` for all users with that role
  - Emits `ROLE_UPDATE` and `USER_SESSION_INVALIDATE` events
- **Role Deletion**: 
  - Updates `lastRoleUpdatedAt` and removes role assignment
  - Emits `ROLE_UPDATE` and `USER_SESSION_INVALIDATE` events

#### Role Assignment API (`/api/role/assign/route.ts`)

- Updates `lastRoleUpdatedAt` when assigning roles
- Emits `USER_SESSION_INVALIDATE` event for the affected user

#### User Management API (`/api/users/[userId]/route.ts`)

- Detects role changes during user updates
- Updates `lastRoleUpdatedAt` and emits `USER_SESSION_INVALIDATE` event

### 5. Client-Side Implementation

#### Dashboard Component (`src/components/pages/dash/index.tsx`)

- **SSE Event Listener**: Listens for `userSessionInvalidate` events
- **Automatic Logout**: Shows appropriate message and signs out affected users
- **User Feedback**: Different messages based on the reason for invalidation:
  - Role updated
  - Role assigned/changed
  - Role deleted

#### Admin Interface Updates

- **Success Messages**: Updated to inform admins that affected users will be logged out
- **Real-time Feedback**: Admins see immediate confirmation of session invalidation

## How It Works

### Scenario 1: Role Permissions Updated

1. Admin updates a role's permissions
2. System updates `lastRoleUpdatedAt` for all users with that role
3. SSE event `USER_SESSION_INVALIDATE` is emitted
4. Active users receive the event and are logged out immediately
5. Inactive users are logged out when they next make a request (JWT validation)

### Scenario 2: User Role Changed

1. Admin assigns a different role to a user
2. System updates the user's `lastRoleUpdatedAt` timestamp
3. SSE event `USER_SESSION_INVALIDATE` is emitted for that user
4. User receives the event and is logged out immediately
5. User must log in again to get new permissions

### Scenario 3: Role Deleted

1. Admin deletes a role
2. System removes role assignment and updates `lastRoleUpdatedAt` for affected users
3. SSE event `USER_SESSION_INVALIDATE` is emitted
4. All users with that role are logged out immediately

## Benefits

### Immediate Security

- **Real-time Logout**: Active users are logged out immediately via SSE
- **Comprehensive Coverage**: Inactive users are caught by JWT validation
- **No Security Gaps**: Ensures users can't continue with outdated permissions

### User Experience

- **Clear Communication**: Users receive specific messages about why they were logged out
- **Graceful Handling**: 2-second delay before logout allows users to read the message
- **Automatic Redirect**: Users are redirected to login page after logout

### Admin Experience

- **Immediate Feedback**: Admins see confirmation that users will be logged out
- **Audit Trail**: All role changes are logged with affected user counts
- **Real-time Updates**: Changes take effect immediately across the system

## Technical Details

### Database Migration

```sql
-- The lastRoleUpdatedAt field was added to the user table
ALTER TABLE "user" ADD COLUMN "last_role_updated_at" TIMESTAMP(3);
```

### Event Flow

```
Role Change → Database Update → SSE Event → Client Logout
                ↓
            JWT Validation → Session Invalidation
```

### Error Handling

- SSE connection errors are logged but don't break functionality
- JWT validation provides fallback for users not connected to SSE
- Database transactions ensure consistency during role operations

## Testing

To test the implementation:

1. **Create two user sessions** in different browsers
2. **Update a role** that one of the users has
3. **Verify immediate logout** of the affected user
4. **Verify continued access** for unaffected users
5. **Test role assignment** and deletion scenarios

## Future Enhancements

- **Selective Logout**: Option to logout only specific users instead of all users with a role
- **Grace Period**: Configurable delay before forced logout
- **Notification System**: Email notifications about role changes
- **Session Management**: Admin interface to view and manage active sessions 