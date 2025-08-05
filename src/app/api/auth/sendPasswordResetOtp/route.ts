import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendOtpEmail, generateOtp, cleanupExpiredOtpTokens } from '@/lib/emailService';

export async function POST(request: Request) {
  try {
    const { email, type="forgot" } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'No account found with this email address' },
        { status: 404 }
      );
    }

    // Clean up expired tokens
    await cleanupExpiredOtpTokens();

    // Check if there's already a recent OTP request (rate limiting)
    const existingToken = await prisma.otpToken.findFirst({
      where: {
        email,
        isUsed: false,
        expiresAt: {
          gt: new Date(),
        },
        createdAt: {
          gt: new Date(Date.now() - 60000), // 1 minute ago
        },
      },
    });

    if (existingToken) {
      return NextResponse.json(
        { error: `Please wait ${Math.floor((existingToken.expiresAt.getTime() - Date.now()) / 1000)} seconds before requesting another OTP` },
        { status: 429 }
      );
    }

    // Generate new OTP
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Save OTP to database
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
    await sendOtpEmail(email, otp,type);

    return NextResponse.json(
      { message: 'OTP sent successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Send password reset OTP error:', error);
    return NextResponse.json(
      { error: 'Failed to send OTP' },
      { status: 500 }
    );
  }
} 