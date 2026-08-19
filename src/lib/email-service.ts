import { Resend } from 'resend';

// Initialize Resend with API key from environment
const resend = new Resend(process.env.RESEND_API_KEY);

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  /**
   * Where a reply actually goes. The default From is a noreply address, so any
   * email whose copy invites a reply has to set this or it is telling the
   * customer something untrue.
   */
  replyTo?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send an email using Resend
 * @param params Email parameters
 * @returns Result of the send operation
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  try {
    const { to, subject, html, replyTo, from = 'ReelCaster <noreply@reelcaster.com>' } = params;

    // If RESEND_API_KEY is not set, log to console (development mode)
    if (!process.env.RESEND_API_KEY) {
      console.log('📧 Email would be sent (RESEND_API_KEY not set):');
      console.log('To:', to);
      console.log('Subject:', subject);
      console.log('From:', from);
      console.log('HTML length:', html.length, 'characters');

      return {
        success: true,
        messageId: 'dev-mode-' + Date.now(),
      };
    }

    const { data, error } = await resend.emails.send({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      ...(replyTo ? { replyTo } : {}),
    });

    if (error) {
      console.error('Error sending email:', error);
      return {
        success: false,
        error: error.message || 'Failed to send email',
      };
    }

    return {
      success: true,
      messageId: data?.id,
    };
  } catch (error) {
    console.error('Exception sending email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send emails in batches to avoid rate limits
 * @param emails Array of email addresses
 * @param subject Email subject
 * @param html Email HTML content
 * @param batchSize Number of emails to send at once (default: 20)
 * @returns Results for each email
 */
export async function sendBatchEmails(
  emails: string[],
  subject: string,
  html: string,
  batchSize: number = 20
): Promise<{ sent: number; failed: number; results: SendEmailResult[] }> {
  const results: SendEmailResult[] = [];
  let sent = 0;
  let failed = 0;

  // Process emails in batches
  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);

    console.log(`Sending batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(emails.length / batchSize)}...`);

    // Send emails in parallel within the batch
    const batchResults = await Promise.all(
      batch.map(email =>
        sendEmail({
          to: email,
          subject,
          html,
        })
      )
    );

    // Collect results
    for (const result of batchResults) {
      results.push(result);
      if (result.success) {
        sent++;
      } else {
        failed++;
      }
    }

    // Small delay between batches to avoid rate limiting
    if (i + batchSize < emails.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return { sent, failed, results };
}

/**
 * Validate email address format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
