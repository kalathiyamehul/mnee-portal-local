import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cleanupExpiredOtpTokens } from '@/lib/emailService';

export const POST = async function(request: Request) {
  try {
    const { email, otp } = await request.json();

    if (!email || !otp || typeof email !== 'string' || typeof otp !== 'string') {
      return NextResponse.json(
        { error: 'Email and OTP are required' },
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

    // Validate OTP format (6 digits)
    const otpRegex = /^\d{6}$/;
    if (!otpRegex.test(otp)) {
      return NextResponse.json(
        { error: 'Invalid OTP format' },
        { status: 400 }
      );
    }

    // Clean up expired OTP tokens
    await cleanupExpiredOtpTokens();

    // Find the OTP token
    const otpToken = await prisma.otpToken.findFirst({
      where: {
        email,
        token: otp,
        isUsed: false,
        expiresAt: {
          gt: new Date(), // Not expired
        },
      },
    });

    if (!otpToken) {
      return NextResponse.json(
        { error: 'Invalid or expired OTP' },
        { status: 400 }
      );
    }

    // Check if too many attempts have been made
    if (otpToken.attempts >= 5) {
      // Mark the OTP as used to prevent further attempts
      await prisma.otpToken.update({
        where: { id: otpToken.id },
        data: { isUsed: true },
      });

      return NextResponse.json(
        { error: 'Too many verification attempts. Please request a new OTP.' },
        { status: 429 }
      );
    }

    // Increment attempts
    await prisma.otpToken.update({
      where: { id: otpToken.id },
      data: { attempts: otpToken.attempts + 1 },
    });

    // Mark OTP as used
    await prisma.otpToken.update({
      where: { id: otpToken.id },
      data: { isUsed: true },
    });

    // Generate a temporary token for password reset
    const resetToken = Math.random().toString(36).substring(2, 15) + 
                      Math.random().toString(36).substring(2, 15);

    // Store the reset token temporarily (valid for 10 minutes)
    const resetTokenExpiry = new Date(Date.now() + 10 * 60 * 1000);
    
    // You can store this in a separate table or use a different approach
    // For now, we'll return the token to the client
    console.log('OTP verified successfully for:', email);

    return NextResponse.json({
      success: true,
      message: 'OTP verified successfully',
      resetToken: resetToken,
      expiresIn: 10 * 60, // 10 minutes in seconds
    });

  } catch (error) {
    console.error('Error in verify OTP API:', error);
    return NextResponse.json(
      { error: 'An error occurred while verifying OTP' },
      { status: 500 }
    );
  }
}