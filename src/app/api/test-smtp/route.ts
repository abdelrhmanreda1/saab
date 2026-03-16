import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { smtp, testEmail } = body;

    if (!smtp || !testEmail) {
      return NextResponse.json(
        { success: false, error: 'SMTP settings and test email are required' },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!smtp.host || !smtp.port || !smtp.username || !smtp.fromEmail) {
      return NextResponse.json(
        { success: false, error: 'Missing required SMTP fields' },
        { status: 400 }
      );
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: parseInt(smtp.port, 10),
      secure: smtp.encryption === 'ssl', // true for 465, false for other ports
      auth: {
        user: smtp.username,
        pass: smtp.password || '',
      },
      tls: {
        rejectUnauthorized: false, // Allow self-signed certificates
      },
    });

    // Verify connection
    await transporter.verify();

    // Send test email
    const info = await transporter.sendMail({
      from: `"${smtp.fromName}" <${smtp.fromEmail}>`,
      to: testEmail,
      subject: 'SMTP Test Email - Pardah',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #000;">SMTP Configuration Test</h2>
          <p>This is a test email from your Pardah e-commerce platform.</p>
          <p>If you received this email, your SMTP settings are configured correctly!</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">
            Sent at: ${new Date().toLocaleString()}<br>
            From: ${smtp.fromName} (${smtp.fromEmail})
          </p>
        </div>
      `,
      text: `SMTP Configuration Test\n\nThis is a test email from your Pardah e-commerce platform.\n\nIf you received this email, your SMTP settings are configured correctly!\n\nSent at: ${new Date().toLocaleString()}\nFrom: ${smtp.fromName} (${smtp.fromEmail})`,
    });

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
    });
  } catch (error) {
    // Failed to send test email
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send test email',
      },
      { status: 500 }
    );
  }
}

