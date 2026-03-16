import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { getSettings } from '@/lib/firestore/settings_db';

// Store OTPs temporarily (in production, use Redis or Firestore)
const otpStore = new Map<string, { otp: string; expiresAt: number }>();

// Clean up expired OTPs every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of otpStore.entries()) {
    if (value.expiresAt < now) {
      otpStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, phoneNumber } = body;

    if (!email && !phoneNumber) {
      return NextResponse.json(
        { success: false, error: 'Email or phone number is required' },
        { status: 400 }
      );
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    if (email) {
      // Get SMTP settings
      const settings = await getSettings();
      if (!settings?.smtp) {
        return NextResponse.json(
          { success: false, error: 'SMTP settings not configured' },
          { status: 500 }
        );
      }

      const smtp = settings.smtp;
      
      // Validate required fields
      if (!smtp.host || !smtp.port || !smtp.username || !smtp.fromEmail) {
        return NextResponse.json(
          { success: false, error: 'SMTP configuration incomplete' },
          { status: 500 }
        );
      }

      // Store OTP
      otpStore.set(`email:${email}`, { otp, expiresAt });

      // Create transporter
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: parseInt(smtp.port, 10),
        secure: smtp.encryption === 'ssl',
        auth: {
          user: smtp.username,
          pass: smtp.password || '',
        },
        tls: {
          rejectUnauthorized: false,
        },
      });

      // Send OTP email
      const companyName = settings?.company?.name || 'Our Store';
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f9f9f9; padding: 30px; border-radius: 10px;">
            <h2 style="color: #000; margin-top: 0;">Verification Code</h2>
            <p>Hello,</p>
            <p>Your verification code for ${companyName} is:</p>
            <div style="background-color: #000; color: #fff; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; border-radius: 5px; margin: 20px 0;">
              ${otp}
            </div>
            <p>This code will expire in 10 minutes.</p>
            <p>If you didn't request this code, please ignore this email.</p>
            <p style="margin-top: 30px; font-size: 12px; color: #666;">
              Best regards,<br>
              ${companyName}
            </p>
          </div>
        </body>
        </html>
      `;

      const text = `Your verification code for ${companyName} is: ${otp}. This code will expire in 10 minutes.`;

      await transporter.sendMail({
        from: `"${smtp.fromName}" <${smtp.fromEmail}>`,
        to: email,
        subject: `Your ${companyName} Verification Code`,
        html,
        text,
      });

      return NextResponse.json({
        success: true,
        message: 'OTP sent to email',
      });
    }

    // For phone, we'll use Firebase Phone Auth (already implemented)
    return NextResponse.json(
      { success: false, error: 'Phone OTP should use Firebase Phone Auth' },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send OTP',
      },
      { status: 500 }
    );
  }
}

// Verify OTP
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, otp } = body;

    if (!otp) {
      return NextResponse.json(
        { success: false, error: 'OTP is required' },
        { status: 400 }
      );
    }

    if (email) {
      const stored = otpStore.get(`email:${email}`);
      if (!stored) {
        return NextResponse.json(
          { success: false, error: 'OTP not found or expired' },
          { status: 400 }
        );
      }

      if (stored.expiresAt < Date.now()) {
        otpStore.delete(`email:${email}`);
        return NextResponse.json(
          { success: false, error: 'OTP expired' },
          { status: 400 }
        );
      }

      if (stored.otp !== otp) {
        return NextResponse.json(
          { success: false, error: 'Invalid OTP' },
          { status: 400 }
        );
      }

      // OTP verified, remove it
      otpStore.delete(`email:${email}`);

      return NextResponse.json({
        success: true,
        message: 'OTP verified',
      });
    }

    return NextResponse.json(
      { success: false, error: 'Email or phone number is required' },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to verify OTP',
      },
      { status: 500 }
    );
  }
}

