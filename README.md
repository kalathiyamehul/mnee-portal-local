# MNEE Dashboard

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, set the required environment variables. You can use a .env file if working locally.

```bash
touch .env
```

```bash
NEXT_PUBLIC_MNEE_API=https://api.somehost.net:8082
DATABASE_URL=postgresql://postgres:****@postgres.somehost.net:52253/dbname
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key
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