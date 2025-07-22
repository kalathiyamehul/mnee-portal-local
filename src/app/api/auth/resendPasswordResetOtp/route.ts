import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendOtpEmail, generateOtp, cleanupExpiredOtpTokens } from '@/lib/emailService';

export async function POST(request: Request) {
  try {
    const { email, type ="forgot" } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Clean up expired tokens
    await cleanupExpiredOtpTokens();

    // Check if there's already a recent resend request (2 minute rate limiting)
    const recentToken = await prisma.otpToken.findFirst({
      where: {
        email,
        createdAt: {
          gt: new Date(Date.now() - 2 * 60 * 1000), // 2 minutes ago
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (recentToken) {
      const timeLeft = 2 * 60 * 1000 - (Date.now() - recentToken.createdAt.getTime());
      if (timeLeft > 0) {
        return NextResponse.json(
          { error: `Please wait ${Math.ceil(timeLeft / 1000)} seconds before requesting another OTP` },
          { status: 429 }
        );
      }
    }

    // Mark any existing unused tokens as used
    await prisma.otpToken.updateMany({
      where: {
        email,
        isUsed: false,
      },
      data: {
        isUsed: true,
      },
    });

    // Generate new OTP
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Save new OTP to database
    await prisma.otpToken.create({
      data: {
        email,
        token: otp,
        expiresAt,
        isUsed: false,
        attempts: 0,
      },
    });

    // Send OTP email
    await sendOtpEmail(email, otp, type);

    return NextResponse.json(
      { message: 'OTP resent successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Resend password reset OTP error:', error);
    return NextResponse.json(
      { error: 'Failed to resend OTP' },
      { status: 500 }
    );
  }
} 