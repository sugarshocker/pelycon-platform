import nodemailer from "nodemailer";

const log = (msg: string) => console.log(`[email] ${msg}`);

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export function isEmailConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function sendReminderEmail(options: {
  to: string;
  orgName: string;
  reviewDate: Date;
  notes?: string | null;
}): Promise<boolean> {
  const transporter = getTransporter();
  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;

  if (!transporter || !fromAddress) {
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
    await transporter.sendMail({
      from: fromAddress,
      to: options.to,
      subject,
      html,
    });
    log(`Reminder sent to ${options.to} for ${options.orgName}`);
    return true;
  } catch (err: any) {
    log(`Failed to send reminder to ${options.to}: ${err.message}`);
    return false;
  }
}
