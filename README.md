# MNEE Dashboard

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, set the required environment variables. You can use a .env file if working locally. The dhasboard needs a postgres database to work with.

```bash
touch .env
```

```bash
NEXT_PUBLIC_MNEE_API=https://api.somehost.net:8082
DATABASE_URL=postgresql://postgres:****@postgres.somehost.net:52253/dbname
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key
MNEE_ORDINALS_SERVICE=https://mnee-ordinals-service.somehost.net
```

install the dependencies:

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
