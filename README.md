# MNEE Dashboard

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, set the required environment variables. You can use a .env file if working locally. The dashboard needs a postgres database to work with.

```bash
touch .env
```

```bash
NEXT_PUBLIC_MNEE_API=https://api.somehost.net:8082
DATABASE_URL=postgresql://postgres:****@postgres.somehost.net:52253/dbname
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key

# Development: Use unencrypted WIF values directly
MINT_WIF=<wif_value>
BURN_WIF=<wif_value>

# Production: Use KMS encrypted values
# ENCRYPTED_MINT_WIF=<kms_encrypted_wif>
# ENCRYPTED_BURN_WIF=<kms_encrypted_wif>

# AWS KMS Configuration (required when using encrypted values)
AWS_REGION=us-west-2  # or your preferred region
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
KMS_KEY_ID=your_kms_key_id
```

The application includes environment validation to ensure all required variables are set correctly before startup. For WIF values, you can either:
- Use unencrypted values directly (MINT_WIF, BURN_WIF) - suitable for development
- Use KMS encrypted values (ENCRYPTED_MINT_WIF, ENCRYPTED_BURN_WIF) - recommended for production

## KMS Setup

The dashboard uses AWS KMS to encrypt sensitive environment variables in production. To set this up:

1. Create a KMS key in your AWS account
2. Note the KMS key ID and add it to your environment variables
3. Ensure your AWS credentials have permissions to use the KMS key
4. Use the encrypt-value script to encrypt your WIF values:
   ```bash
   # Encrypt MINT_WIF
   bun run encrypt-value -d MINT_WIF "your_mint_wif_value"
   
   # Encrypt BURN_WIF
   bun run encrypt-value -d BURN_WIF "your_burn_wif_value"
   
   # Encrypt a value (quiet mode - only outputs encrypted value)
   bun run encrypt-value -q "your_wif_value"
   ```
   The script will output the encrypted value and instructions for adding it to your .env file. The `-d` option adds a description to help identify which WIF is which in AWS KMS.

## Installation

Install the dependencies:

```bash
bun i
# or
yarn install
# or
pnpm install
```

run the development server:

```bash
bun run dev
# or
yarn dev
# or
pnpm de
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

build for production:

```bash
bun run build
# or
yarn build
# or
pnpm build
```

start the production server:

```bash
bun run start
# or
yarn start
# or
pnpm start
```

## PostInstall

The postinstall script will run `npx prisma generate` and `npx prisma migrate deploy` to ensure the database is up to date.

## Configuration

Once the server is up and running, visit the web interface. You will be redirected to `/setup` which will set the token id and initialize the config table. Once the config is saved you will be redirected to `/signup` if no accounts exist in the `Users` table. You can create an account and login to the dashboard. The database schema supports email verification, but it is not implemented in the initial release of the dashboard.

## Change the Theme
    
```html
<html lang="en" data-theme="forest">
```

## Resetting the database

There is a helper script to reset the database. This will drop all tables and re-run the migrations.
```bash
bun run db-reset
```

## Managing Users

### User Management Scripts
Several scripts are available for managing users and system operations:

```bash
# Force Password Reset
bun run setPasswordReset user@example.com

# Check User Status
bun run checkUser user@example.com

# List All Approvers
bun run listApprovers

# Find Pending Requests
bun run findPendingRequests

# Delete Mint Request
bun run delete-mint-request -i <requestId>
```

### Force Password Reset
To force a user to reset their password on next login:
```bash
bun run setPasswordReset user@example.com
```

This will set the `requiresPasswordReset` flag to true for the specified user. The next time they log in, they will be redirected to the password reset page before they can access the dashboard.

### New Users
`/signup` will create new user accounts.

## Deploying a new token
`/setup` will deploy a new token and configure the dashboard.


### Delete Mint Request
To delete a specific mint request from the database:
```bash
bun run delete-mint-request -i 123e4567-e89b-12d3-a456-426614174000
```

This will permanently remove the specified mint request from the database. Use with caution as this action cannot be undone.