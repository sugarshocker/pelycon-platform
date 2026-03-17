import { storage } from "../storage";
import { sendReminderEmail, isEmailConfigured } from "./email";

const log = (msg: string) => console.log(`[reminder-job] ${msg}`);

const REMINDER_DAYS_AHEAD = 3;
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

async function checkAndSendReminders() {
  try {
    const schedules = await storage.getSchedulesDueForReminder(REMINDER_DAYS_AHEAD);

    if (schedules.length === 0) {
      log("No reminders due");
      return;
    }

    log(`Found ${schedules.length} schedule(s) due for reminder`);

    const [smEmail, leEmail, otherEmail] = await Promise.all([
      storage.getAppSetting("tbrEmailServiceManager"),
      storage.getAppSetting("tbrEmailLeadEngineer"),
      storage.getAppSetting("tbrEmailOther"),
    ]);
    const globalEmails = [smEmail, leEmail, otherEmail].filter(Boolean) as string[];

    for (const schedule of schedules) {
      if (!schedule.nextReviewDate) continue;

      const recipients = Array.from(new Set([
        ...(schedule.reminderEmail ? [schedule.reminderEmail] : []),
        ...globalEmails,
      ]));

      if (recipients.length === 0) {
        log(`No recipients for ${schedule.orgName} — skipping`);
        continue;
      }

      let anySuccess = false;
      for (const to of recipients) {
        const sent = await sendReminderEmail({
          to,
          orgName: schedule.orgName,
          reviewDate: new Date(schedule.nextReviewDate),
          notes: schedule.notes,
        });
        if (sent) anySuccess = true;
      }

      if (anySuccess) {
        await storage.markReminderSent(schedule.id);
        log(`Reminder sent for ${schedule.orgName} → ${recipients.join(", ")}`);
      } else if (!isEmailConfigured()) {
        log(`Email not configured — reminder for ${schedule.orgName} will retry next check`);
      }
    }
  } catch (err: any) {
    log(`Error checking reminders: ${err.message}`);
  }
}

export function startReminderJob() {
  log(`Starting reminder job (checking every ${CHECK_INTERVAL_MS / 60000} minutes, ${REMINDER_DAYS_AHEAD} days ahead)`);
  if (!isEmailConfigured()) {
    log("Email not configured — reminders will be logged but not sent. Set SMTP2GO_API_KEY and SMTP_FROM to enable.");
  }

  checkAndSendReminders();

  setInterval(checkAndSendReminders, CHECK_INTERVAL_MS);
}
