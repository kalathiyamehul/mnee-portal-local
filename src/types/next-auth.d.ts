// src/types/next-auth.d.ts
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import NextAuth from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      requiresPasswordReset?: boolean;
      rolePermissions?: Record<string, string[]>;
    };
  }
  interface User {
    id: string;
    name?: string | null;
    email?: string | null;
    requiresPasswordReset?: boolean;
  }
}