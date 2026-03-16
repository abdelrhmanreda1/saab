import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { smtp, to, subject, html, text } = body;

    if (!smtp || !to || !subject || !html) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate required SMTP fields
    if (!smtp.host || !smtp.port || !smtp.username || !smtp.fromEmail) {
      return NextResponse.json(
        { success: false, error: 'SMTP configuration incomplete' },
        { status: 400 }
      );
    }

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

    // Send email
    const recipients = Array.isArray(to) ? to : [to];
    const info = await transporter.sendMail({
      from: `"${smtp.fromName}" <${smtp.fromEmail}>`,
      to: recipients.join(', '),
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''),
    });

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
    });
  } catch (error) {
    // Failed to send email
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send email',
      },
      { status: 500 }
    );
  }
}

