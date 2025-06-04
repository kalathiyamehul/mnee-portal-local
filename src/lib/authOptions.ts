// src/lib/authOptions.ts
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcrypt';
import speakeasy from 'speakeasy';
import { checkAccountLockout, checkRateLimit, resetRateLimit } from '@/lib/rateLimiter';

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

        // Check account lockout first
        const lockoutCheck = await checkAccountLockout(credentials.email);
        if (lockoutCheck.isLocked) {
          const lockoutMessage = lockoutCheck.lockedUntil
            ? `Account locked until ${lockoutCheck.lockedUntil.toLocaleString()}`
            : 'Account is locked due to too many failed login attempts';
          throw new Error(lockoutMessage);
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
            roleId: true,
            requiresPasswordReset: true,
            twoFactorEnabled: true,
            twoFactorSecret: true,
          }
        });

        if (!user) {
          // Update failed attempts for non-existent user to prevent user enumeration
          await checkAccountLockout(credentials.email, false);
          return null;
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) {
          // Update failed attempts for invalid password
          await checkAccountLockout(credentials.email, false);
          return null;
        }

        // Check if 2FA is enabled and handle verification
        if (user.twoFactorEnabled) {
          if (!credentials.token) {
            console.log("2FA_REQUIRED");
            throw new Error("2FA_REQUIRED");
          }

          // Check 2FA rate limiting
          const twoFALimit = await checkRateLimit(credentials.email, 'TWO_FA_ATTEMPT');
          if (twoFALimit.blocked) {
            throw new Error("Too many 2FA attempts. Please try again later.");
          }

          const verified = speakeasy.totp.verify({
            secret: user.twoFactorSecret!,
            encoding: 'base32',
            token: credentials.token,
          });

          if (!verified) {
            throw new Error("Invalid 2FA token");
          }

          // Reset 2FA rate limit on successful verification
          await resetRateLimit(credentials.email, 'TWO_FA_ATTEMPT');
        }

        if (user.requiresPasswordReset && credentials.fromReset !== 'true') {
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
            emailVerified: user.emailVerified,
            requiresPasswordReset: true,
            roleId: user.roleId,
          };
        }

        if (credentials.fromReset === 'true' && user.requiresPasswordReset) {
          await prisma.user.update({
            where: { id: user.id },
            data: { requiresPasswordReset: false }
          });

          // Reset account lockout on successful login
          await checkAccountLockout(credentials.email, true);

          return {
            ...user,
            requiresPasswordReset: false,
          };
        }

        // Reset account lockout on successful login
        await checkAccountLockout(credentials.email, true);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          emailVerified: user.emailVerified,
          roleId: user.roleId,
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
        const { roleId, requiresPasswordReset } = user as typeof user & { roleId?: string; requiresPasswordReset?: boolean };
        if (roleId) {
          const rolePermissions = await prisma.rolePermission.findMany({
            where: {
              roleId: roleId,
            },
            select: {
              permission: {
                select: {
                  name: true,
                  resource: true,
                  action: true,
                },
              },
            },
          });
          const groupedPermissions: Record<string, string[]> = {};
          rolePermissions.forEach(({ permission }) => {
            const { resource, action } = permission;
            if (!groupedPermissions[resource]) {
              groupedPermissions[resource] = [];
            }
            if (!groupedPermissions[resource].includes(action)) {
              groupedPermissions[resource].push(action);
            }
          });
          token.rolePermissions = groupedPermissions;
        } else {
          token.rolePermissions = [] as any;
        }
        token.id = user.id;
        token.requiresPasswordReset = requiresPasswordReset;
      }

      // Check if token was issued before password was changed (session invalidation)
      if (token.id && token.iat) {
        const user = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { passwordChangedAt: true }
        });

        if (user?.passwordChangedAt) {
          const tokenIssuedAt = new Date((token.iat as number) * 1000); // Convert from Unix timestamp
          if (tokenIssuedAt < user.passwordChangedAt) {
            // Token was issued before password change, mark for invalidation
            console.log('[JWT] Token marked for invalidation due to password change:', {
              userId: token.id,
              tokenIssuedAt,
              passwordChangedAt: user.passwordChangedAt
            });
            token.invalidated = true;
          }
        }
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
      // Check if token is marked as invalidated
      if (token.invalidated) {
        console.log('[Session] Session invalidated due to password change for user:', token.id);
        throw new Error('SESSION_INVALIDATED');
      }

      if (session.user && token) {
        session.user.id = token.id as string;
        session.user.requiresPasswordReset = token.requiresPasswordReset as boolean;
        session.user.rolePermissions = token.rolePermissions as Record<string, string[]>;
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