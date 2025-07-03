// src/lib/authOptions.ts
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcrypt';
import speakeasy from 'speakeasy';
import { checkRateLimit, RateLimitType } from '@/lib/rateLimiter';
import { createLoginFingerprint } from '@/lib/rateLimitHelpers';

// Helper function to extract client IP from NextAuth request
function getClientIPFromNextAuthReq(req: any): string {
  // Try to extract IP from various sources in NextAuth request
  if (req?.headers) {
    const xForwardedFor = req.headers['x-forwarded-for'];
    if (xForwardedFor) {
      return Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor.split(',')[0].trim();
    }

    const xRealIP = req.headers['x-real-ip'];
    if (xRealIP) {
      return Array.isArray(xRealIP) ? xRealIP[0] : xRealIP;
    }

    const cfConnectingIP = req.headers['cf-connecting-ip'];
    if (cfConnectingIP) {
      return Array.isArray(cfConnectingIP) ? cfConnectingIP[0] : cfConnectingIP;
    }
  }

  // Try to get IP from connection info
  if (req?.connection?.remoteAddress) {
    return req.connection.remoteAddress;
  }

  if (req?.socket?.remoteAddress) {
    return req.socket.remoteAddress;
  }

  // Fallback to unknown
  return 'unknown';
}

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
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        //ip based rate limiting
        // const clientIP = getClientIPFromNextAuthReq(req);
        // const rateLimitResult = await checkRateLimit(clientIP, RateLimitType.LOGIN_ATTEMPT);

        // Use email instead of IP for rate limiting to handle VPN users
        // const rateLimitResult = await checkRateLimit(credentials.email, RateLimitType.LOGIN_ATTEMPT);

        // Use advanced fingerprinting (session + user-agent + device) for VPN users
        const fingerprintId = createLoginFingerprint(req, credentials.email);
        const rateLimitResult = await checkRateLimit(fingerprintId, RateLimitType.LOGIN_ATTEMPT);
        if (rateLimitResult.blocked) {
          const resetTime = rateLimitResult.blockUntil || rateLimitResult.resetTime;
          const retryAfter = Math.ceil((resetTime.getTime() - Date.now()) / 1000);
          // Format the exact time when user can try again
          const canRetryAt = new Date(resetTime.getTime());
          const timeString = canRetryAt.toLocaleTimeString('en-US', {
            hour12: true,
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit'
          });

          // Create a more user-friendly message
          let errorMessage;
          if (retryAfter > 60) {
            const minutes = Math.ceil(retryAfter / 60);
            errorMessage = `Rate limit exceeded. Too many login attempts from this device. Please try again in ${minutes} minute${minutes > 1 ? 's' : ''} (at ${timeString}).`;
          } else {
            errorMessage = `Rate limit exceeded. Too many login attempts from this device. Please try again in ${retryAfter} second${retryAfter > 1 ? 's' : ''} (at ${timeString}).`;
          }
          throw new Error(errorMessage);
        }
        // Check account lockout first
        // const lockoutCheck = await checkAccountLockout(credentials.email);
        // if (lockoutCheck.isLocked) {
        //   const lockoutMessage = lockoutCheck.lockedUntil
        //     ? `Account locked until ${lockoutCheck.lockedUntil.toLocaleString()}`
        //     : 'Account is locked due to too many failed login attempts';
        //   throw new Error(lockoutMessage);
        // }

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
          },
        });

        if (!user) {
          // Update failed attempts for non-existent user to prevent user enumeration
          // await checkAccountLockout(credentials.email, false);
          return null;
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) {
          // Update failed attempts for invalid password
          // await checkAccountLockout(credentials.email, false);
          return null;
        }

        // Check if 2FA is enabled and handle verification
        if (user.twoFactorEnabled) {
          if (!credentials.token) {
            throw new Error("2FA_REQUIRED");
          }

          // Check 2FA rate limiting
          // const twoFALimit = await checkRateLimit(credentials.email, 'TWO_FA_ATTEMPT');
          // if (twoFALimit.blocked) {
          //   throw new Error("Too many 2FA attempts. Please try again later.");
          // }

          const verified = speakeasy.totp.verify({
            secret: user.twoFactorSecret!,
            encoding: 'base32',
            token: credentials.token,
          });

          if (!verified) {
            throw new Error("Invalid 2FA token");
          }

          // Reset 2FA rate limit on successful verification
          // await resetRateLimit(credentials.email, 'TWO_FA_ATTEMPT');
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
          // await checkAccountLockout(credentials.email, true);

          return {
            ...user,
            requiresPasswordReset: false,
          };
        }

        // Reset account lockout on successful login
        // await checkAccountLockout(credentials.email, true);

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
          const role = await prisma.role.findUnique({
            where: { id: roleId },
            select: {
              name: true,
            },
          });
          token.roleName = role?.name;
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
          select: {
            passwordChangedAt: true,
            lastRoleUpdatedAt: true
          }
        });

        if (user?.passwordChangedAt) {
          const tokenIssuedAt = new Date((token.iat as number) * 1000); // Convert from Unix timestamp
          if (tokenIssuedAt < user.passwordChangedAt) {
            token.invalidated = true;
          }
        }

        // Check if token was issued before role was updated (session invalidation)
        if (user?.lastRoleUpdatedAt) {
          const tokenIssuedAt = new Date((token.iat as number) * 1000); // Convert from Unix timestamp
          if (tokenIssuedAt < user.lastRoleUpdatedAt) {
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
        throw new Error('SESSION_EXPIRED');
      }
      if (session.user && token) {
        session.user.id = token.id as string;
        session.user.requiresPasswordReset = token.requiresPasswordReset as boolean;
        session.user.rolePermissions = token.rolePermissions as Record<string, string[]>;
        session.user.roleName = token.roleName as string;
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