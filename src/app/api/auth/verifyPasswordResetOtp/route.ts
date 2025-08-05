import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cleanupExpiredOtpTokens } from '@/lib/emailService';

export async function POST(request: Request) {
  try {
    const { email, otp } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    if (!otp) {
      return NextResponse.json(
        { error: 'OTP is required' },
        { status: 400 }
      );
    }

    // Clean up expired tokens
    await cleanupExpiredOtpTokens();

    // Find the OTP token
    const otpToken = await prisma.otpToken.findFirst({
      where: {
        email,
        token: otp,
        isUsed: false,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!otpToken) {
      return NextResponse.json(
        { error: 'Invalid or expired OTP' },
        { status: 400 }
      );
    }

    // Check attempts
    if (otpToken.attempts >= 5) {
      // Mark as used to prevent further attempts
      await prisma.otpToken.update({
        where: { id: otpToken.id },
        data: { isUsed: true },
      });
      
      return NextResponse.json(
        { error: 'Too many attempts. Please request a new OTP.' },
        { status: 429 }
      );
    }

    // Don't mark as used yet - that will happen when password is actually reset
    // Just return success for OTP verification
    return NextResponse.json(
      { 
        message: 'OTP verified successfully',
        resetToken: otpToken.id // Pass the token ID for password reset
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Verify password reset OTP error:', error);
    return NextResponse.json(
      { error: 'Failed to verify OTP' },
      { status: 500 }
    );
  }
} 