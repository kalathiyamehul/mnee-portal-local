// src/lib/authOptions.ts
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcrypt';
import speakeasy from 'speakeasy';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        token: { label: '2FA Token', type: 'text' },
        fromReset: { label: 'From Reset', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          select: {
            id: true,
            name: true,
            email: true,
            password: true,
            image: true,
            emailVerified: true,
            requiresPasswordReset: true,
            twoFactorEnabled: true,
            twoFactorSecret: true,
          }
        });

        if (!user) return null;

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) return null;

        // Check if 2FA is enabled and handle verification
        if (user.twoFactorEnabled) {
          // If no token provided, signal that 2FA is required
          console.log(credentials);
          if (!credentials.token) {
            console.log("2FA_REQUIRED");
            throw new Error("2FA_REQUIRED");
          }

          // Verify 2FA token
          const verified = speakeasy.totp.verify({
            secret: user.twoFactorSecret!,
            encoding: 'base32',
            token: credentials.token,
          });

          if (!verified) {
            throw new Error("Invalid 2FA token");
          }
        }

        if (user.requiresPasswordReset && credentials.fromReset !== 'true') {
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
            emailVerified: user.emailVerified,
            requiresPasswordReset: true
          };
        }

        if (credentials.fromReset === 'true' && user.requiresPasswordReset) {
          await prisma.user.update({
            where: { id: user.id },
            data: { requiresPasswordReset: false }
          });
          return {
            ...user,
            requiresPasswordReset: false,
          };
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          emailVerified: user.emailVerified,
          requiresPasswordReset: user.requiresPasswordReset,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  pages: {
    signIn: '/login',
    signOut: '/logout',
    error: '/login',
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        // Initial sign in
        token.id = user.id;
        token.requiresPasswordReset = user.requiresPasswordReset;
      }

      // On token update, refresh user data
      if (trigger === "update") {
        const freshUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: {
            requiresPasswordReset: true,
            twoFactorEnabled: true,
          }
        });
        if (freshUser) {
          token.requiresPasswordReset = freshUser.requiresPasswordReset;
          token.twoFactorEnabled = freshUser.twoFactorEnabled;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string;
        session.user.requiresPasswordReset = token.requiresPasswordReset as boolean;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Handle password reset redirect during sign in
      if (url.startsWith(`${baseUrl}/login`) || url === baseUrl) {
        // Get the user from the token instead of session
        const token = await prisma.user.findFirst({
          where: { requiresPasswordReset: true },
          orderBy: { updatedAt: 'desc' }
        });
        
        if (token?.requiresPasswordReset) {
          return `${baseUrl}/reset-password`;
        }
        return `${baseUrl}/dash`;
      }

      // Allows relative callback URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      // Allows callback URLs on the same origin
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};