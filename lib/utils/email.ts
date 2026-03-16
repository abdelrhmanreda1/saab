import { getSettings } from '@/lib/firestore/settings_db';
import { SMTPSettings } from '@/lib/firestore/settings';

/**
 * Send email using SMTP settings from Firestore
 * This function can be called from client or server
 */
export async function sendEmail(
  to: string | string[],
  subject: string,
  htmlBody: string,
  textBody?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const settings = await getSettings();
    if (!settings?.smtp) {
      return { success: false, error: 'SMTP settings not configured' };
    }

    const smtp = settings.smtp;
    
    // Validate required fields
    if (!smtp.host || !smtp.port || !smtp.username || !smtp.fromEmail) {
      return { success: false, error: 'SMTP configuration incomplete' };
    }

    // Call Firebase function to send email
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        smtp: {
          host: smtp.host,
          port: smtp.port,
          username: smtp.username,
          password: smtp.password,
          fromName: smtp.fromName,
          fromEmail: smtp.fromEmail,
          encryption: smtp.encryption,
        },
        to: Array.isArray(to) ? to : [to],
        subject,
        html: htmlBody,
        text: textBody || htmlBody.replace(/<[^>]*>/g, ''), // Strip HTML for text version
      }),
    });

    const result = await response.json();
    
    if (!response.ok) {
      return { success: false, error: result.error || 'Failed to send email' };
    }

    return { success: true };
  } catch (error) {
    // Failed to send email
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}

/**
 * Test SMTP connection
 */
export async function testSMTPConnection(smtp: SMTPSettings): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/test-smtp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ smtp }),
    });

    const result = await response.json();
    
    if (!response.ok) {
      return { success: false, error: result.error || 'SMTP test failed' };
    }

    return { success: true };
  } catch (error) {
    // Failed to test SMTP
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}

