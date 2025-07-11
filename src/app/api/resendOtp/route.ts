import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendOtpEmail, generateOtp, cleanupExpiredOtpTokens } from '@/lib/emailService';

export const POST = async function(request: Request) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'No account found with this email address' },
        { status: 404 }
      );
    }

    // Clean up expired OTP tokens
    await cleanupExpiredOtpTokens();

    // Check if there's a recent OTP request (within 2 minutes to prevent spam)
    const recentOtp = await prisma.otpToken.findFirst({
      where: {
        email,
        createdAt: {
          gte: new Date(Date.now() - 2 * 60 * 1000), // 2 minutes ago
        },
      },
    });

    if (recentOtp) {
      return NextResponse.json(
        { error: 'Please wait at least 2 minutes before requesting another OTP' },
        { status: 429 }
      );
    }

    // Invalidate any existing unused OTP tokens for this email
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
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now

    // Store new OTP in database
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
    const emailResult = await sendOtpEmail(email, otp);

    if (!emailResult.success) {
      console.error('Failed to resend OTP email:', emailResult.error);
      return NextResponse.json(
        { error: 'Failed to send OTP email. Please try again later.' },
        { status: 500 }
      );
    }

    console.log('OTP resent successfully to:', email);

    return NextResponse.json({
      success: true,
      message: 'OTP resent successfully to your email address',
      expiresIn: 15 * 60, // 15 minutes in seconds
    });

  } catch (error) {
    console.error('Error in resend OTP API:', error);
    return NextResponse.json(
      { error: 'An error occurred while resending OTP' },
      { status: 500 }
    );
  }
} 