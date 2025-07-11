import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isPasswordValid, isPasswordReused, updatePasswordWithHistory } from '@/utils/auth';
import { cleanupExpiredOtpTokens } from '@/lib/emailService';
import bcrypt from 'bcrypt';

export async function POST(request: Request) {
  try {
    const { email, resetToken, newPassword } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    if (!resetToken || !newPassword) {
      return NextResponse.json(
        { error: 'Reset token and new password are required' },
        { status: 400 }
      );
    }

    // Clean up expired tokens
    await cleanupExpiredOtpTokens();

    // Find the OTP token by ID and verify it's still valid
    const otpToken = await prisma.otpToken.findFirst({
      where: {
        id: resetToken,
        email,
        isUsed: false,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!otpToken) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    // Validate new password
    const passwordValidation = isPasswordValid(newPassword);
    if (!passwordValidation.valid) {
      // Increment attempts for invalid password
      await prisma.otpToken.update({
        where: { id: otpToken.id },
        data: { attempts: otpToken.attempts + 1 },
      });
      
      return NextResponse.json(
        { error: passwordValidation.error },
        { status: 400 }
      );
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if password is reused
    const isReused = await isPasswordReused(user.id, newPassword);
    if (isReused) {
      // Increment attempts for reused password
      await prisma.otpToken.update({
        where: { id: otpToken.id },
        data: { attempts: otpToken.attempts + 1 },
      });
      
      return NextResponse.json(
        { error: 'Cannot reuse a previous password' },
        { status: 400 }
      );
    }

    // Mark OTP as used
    await prisma.otpToken.update({
      where: { id: otpToken.id },
      data: { isUsed: true },
    });

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    // Update password with history
    await updatePasswordWithHistory(user.id, hashedPassword);

    // Update user flags
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        requiresPasswordReset: false,
        passwordChangedAt: new Date(),
      },
    });

    return NextResponse.json(
      { message: 'Password reset successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Set password with OTP error:', error);
    return NextResponse.json(
      { error: 'Failed to reset password' },
      { status: 500 }
    );
  }
} 