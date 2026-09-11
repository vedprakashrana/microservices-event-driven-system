export interface DispatchResult {
  success: boolean;
  channel: 'EMAIL' | 'SMS' | 'PUSH';
  recipient: string;
  subject: string;
  body: string;
  error?: string;
}

export class NotificationDispatcher {
  /**
   * Simulated multi-channel delivery (Email, SMS, Push).
   * In a live production system, this routes to SendGrid, AWS SES, Twilio, or Firebase FCM.
   */
  static async send(
    channel: 'EMAIL' | 'SMS' | 'PUSH',
    recipient: string,
    subject: string,
    body: string
  ): Promise<DispatchResult> {
    // Simulate slight async network delay
    await new Promise((resolve) => setTimeout(resolve, 50));

    console.log(`\n📬 [DISPATCH ${channel}] ---------------------------`);
    console.log(`To:      ${recipient}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body:\n${body.trim()}`);
    console.log(`--------------------------------------------------\n`);

    return {
      success: true,
      channel,
      recipient,
      subject,
      body,
    };
  }
}
