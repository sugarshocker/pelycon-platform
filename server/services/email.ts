const log = (msg: string) => console.log(`[email] ${msg}`);

export function isEmailConfigured(): boolean {
  return !!(process.env.SMTP2GO_API_KEY && process.env.SMTP_FROM);
}

export async function sendReminderEmail(options: {
  to: string;
  orgName: string;
  reviewDate: Date;
  notes?: string | null;
}): Promise<boolean> {
  const apiKey = process.env.SMTP2GO_API_KEY;
  const sender = process.env.SMTP_FROM;

  if (!apiKey || !sender) {
    log(`Email not configured — skipping reminder for ${options.orgName} to ${options.to}`);
    return false;
  }

  const dateStr = options.reviewDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const subject = `TBR Reminder: ${options.orgName} review on ${dateStr}`;

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <div style="background-color: #E77125; padding: 16px 24px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px;">Technology Business Review Reminder</h1>
      </div>
      <div style="background-color: #f9f9f9; padding: 24px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="font-size: 16px; color: #333; margin-top: 0;">
          This is a reminder that a <strong>Technology Business Review</strong> is scheduled for 
          <strong>${options.orgName}</strong> in <strong>2 days</strong>.
        </p>
        <div style="background: white; border: 1px solid #e0e0e0; border-radius: 6px; padding: 16px; margin: 16px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #666; font-size: 14px; width: 120px;">Client:</td>
              <td style="padding: 8px 0; font-size: 14px; font-weight: 600;">${options.orgName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666; font-size: 14px;">Review Date:</td>
              <td style="padding: 8px 0; font-size: 14px; font-weight: 600;">${dateStr}</td>
            </tr>
            ${options.notes ? `
            <tr>
              <td style="padding: 8px 0; color: #666; font-size: 14px; vertical-align: top;">Notes:</td>
              <td style="padding: 8px 0; font-size: 14px;">${options.notes}</td>
            </tr>
            ` : ""}
          </table>
        </div>
        <p style="font-size: 14px; color: #666;">
          Please ensure all staging data (engineer notes, service manager notes, MFA/license reports) 
          is prepared before the review meeting.
        </p>
        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
        <p style="font-size: 12px; color: #999; margin-bottom: 0;">
          Sent by Pelycon Technologies TBR Dashboard
        </p>
      </div>
    </div>
  `;

  try {
    const res = await fetch("https://api.smtp2go.com/v3/email/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Smtp2go-Api-Key": apiKey,
      },
      body: JSON.stringify({
        sender,
        to: [options.to],
        subject,
        html_body: html,
      }),
    });

    const body = await res.json();

    if (!res.ok || body?.data?.failed > 0) {
      const errMsg = body?.data?.error || body?.data?.failures?.join(", ") || res.statusText;
      log(`SMTP2GO error for ${options.to}: ${errMsg}`);
      return false;
    }

    log(`Reminder sent to ${options.to} for ${options.orgName} (email_id: ${body?.data?.email_id})`);
    return true;
  } catch (err: any) {
    log(`Failed to send reminder to ${options.to}: ${err.message}`);
    return false;
  }
}
