import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/authOptions';
import bcrypt from 'bcrypt';
import { isPasswordValid } from '@/utils/auth';
import { withCSRF } from '@/lib/csrf';
import { createAPIRateLimit } from '@/lib/rateLimitHelpers';
import { emitPasswordChanged } from '@/lib/sseEmitter';

export const POST = withCSRF(async function (request: Request) {
  const session = await getServerSession(authOptions);
  console.log('[Reset Password] Session state:', {
    userId: session?.user?.id,
    userEmail: session?.user?.email
  });

  if (!session?.user?.id) {
    console.log('[Reset Password] Error: No session or user ID found');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { newPassword } = await request.json();

    if (!newPassword || typeof newPassword !== 'string') {
      console.log('[Reset Password] Error: Invalid or missing password in request');
      return NextResponse.json(
        { error: 'New password is required' },
        { status: 400 }
      );
    }

    // Validate password complexity
    const validation = isPasswordValid(newPassword);
    if (!validation.valid) {
      console.log('[Reset Password] Error: Password validation failed -', validation.error);
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Hash the new password with a high cost factor for additional security
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Get user before update
    const beforeUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { requiresPasswordReset: true }
    });
    console.log('[Reset Password] User state before update:', beforeUser);

    // Update user's password and clear the reset requirement
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        password: hashedPassword, 
        requiresPasswordReset: false,
        passwordChangedAt: new Date() // This will invalidate all existing JWT tokens
      },
      select: { id: true, email: true, requiresPasswordReset: true }
    });

    console.log('[Reset Password] Update successful:', {
      userId: updatedUser.id,
      requiresPasswordReset: updatedUser.requiresPasswordReset
    });

    // Emit password changed event to invalidate user sessions
    emitPasswordChanged({
      userId: updatedUser.id,
      userEmail: updatedUser.email
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.log('[Reset Password] Error during update:', error);
    return NextResponse.json(
      { error: 'Failed to reset password' },
      { status: 500 }
    );
  }
}, createAPIRateLimit());