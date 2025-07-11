// Email service for sending OTP emails
import nodemailer from 'nodemailer';
import { prisma } from './prisma';

const EMAIL_CONFIG = {
  HOST: "smtp.zoho.in",
  PORT: 465,
  AUTH_USER: "mehul@kellygroup.in",
  AUTH_PASSWORD: "BRHfJ40JJu2F",
  FROM_ADDRESS: "mehul@kellygroup.in",
  FROM_NAME: "MNEE",
};

// Check if email is enabled (you can add this to your env variables)
const EMAIL_ENABLED = process.env.EMAIL_ENABLED !== 'false';

export interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

export function generateOtpEmailTemplate(otp: string, userEmail: string): EmailTemplate {
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset OTP</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
            }
            .container {
                background-color: #f9f9f9;
                padding: 30px;
                border-radius: 8px;
                border: 1px solid #e0e0e0;
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
            }
            .otp-code {
                font-size: 36px;
                font-weight: bold;
                color: #2563eb;
                text-align: center;
                padding: 20px;
                background-color: #f0f8ff;
                border-radius: 6px;
                margin: 20px 0;
                letter-spacing: 3px;
            }
            .warning {
                background-color: #fef3c7;
                border: 1px solid #f59e0b;
                padding: 15px;
                border-radius: 6px;
                margin: 20px 0;
            }
            .footer {
                text-align: center;
                margin-top: 30px;
                font-size: 14px;
                color: #666;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Password Reset Request</h1>
                <p>We received a request to reset your password for your account.</p>
            </div>
            
            <p>Hello,</p>
            
            <p>You requested to reset your password for your account associated with <strong>${userEmail}</strong>.</p>
            
            <p>Your One-Time Password (OTP) is:</p>
            
            <div class="otp-code">${otp}</div>
            
            <div class="warning">
                <strong>Important:</strong>
                <ul>
                    <li>This OTP is valid for only <strong>15 minutes</strong></li>
                    <li>Do not share this code with anyone</li>
                    <li>If you didn't request this, please ignore this email</li>
                </ul>
            </div>
            
            <p>Enter this code on the password reset page to continue with setting your new password.</p>
            
            <div class="footer">
                <p>If you have any questions, please contact our support team.</p>
                <p>This is an automated message, please do not reply to this email.</p>
            </div>
        </div>
    </body>
    </html>
  `;

  const text = `
    Password Reset Request
    
    Hello,
    
    You requested to reset your password for your account associated with ${userEmail}.
    
    Your One-Time Password (OTP) is: ${otp}
    
    Important:
    - This OTP is valid for only 15 minutes
    - Do not share this code with anyone
    - If you didn't request this, please ignore this email
    
    Enter this code on the password reset page to continue with setting your new password.
    
    If you have any questions, please contact our support team.
    This is an automated message, please do not reply to this email.
  `;

  return {
    subject: 'Password Reset OTP - MNEE',
    html,
    text,
  };
}

export async function sendOtpEmail(
  email: string,
  otp: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!EMAIL_ENABLED) {
      console.log('Email sending disabled, OTP would be:', otp);
      return { success: true };
    }

    const transporter = nodemailer.createTransport({
      host: EMAIL_CONFIG.HOST,
      port: EMAIL_CONFIG.PORT,
      secure: true, // Use SSL
      auth: {
        user: EMAIL_CONFIG.AUTH_USER,
        pass: EMAIL_CONFIG.AUTH_PASSWORD,
      },
    });

    const emailTemplate = generateOtpEmailTemplate(otp, email);

    const mailOptions = {
      from: `${EMAIL_CONFIG.FROM_NAME} <${EMAIL_CONFIG.FROM_ADDRESS}>`,
      to: email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    };

    const info = await transporter.sendMail(mailOptions);
    
    console.log('OTP email sent successfully:', {
      messageId: info.messageId,
      email: email,
      timestamp: new Date().toISOString(),
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to send OTP email:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to send email' 
    };
  }
}

// Utility function to generate a 6-digit OTP
export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Utility function to cleanup expired OTP tokens
export async function cleanupExpiredOtpTokens(): Promise<void> {
  try {
    const result = await prisma.otpToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
    
    if (result.count > 0) {
      console.log(`Cleaned up ${result.count} expired OTP tokens`);
    }
  } catch (error) {
    console.error('Failed to cleanup expired OTP tokens:', error);
  }
} 