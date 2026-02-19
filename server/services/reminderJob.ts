import { storage } from "../storage";
import { sendReminderEmail, isEmailConfigured } from "./email";

const log = (msg: string) => console.log(`[reminder-job] ${msg}`);

const REMINDER_DAYS_AHEAD = 2;
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

async function checkAndSendReminders() {
  try {
    const schedules = await storage.getSchedulesDueForReminder(REMINDER_DAYS_AHEAD);

    if (schedules.length === 0) {
      log("No reminders due");
      return;
    }

    log(`Found ${schedules.length} schedule(s) due for reminder`);

    for (const schedule of schedules) {
      if (!schedule.reminderEmail || !schedule.nextReviewDate) continue;

      const sent = await sendReminderEmail({
        to: schedule.reminderEmail,
        orgName: schedule.orgName,
        reviewDate: new Date(schedule.nextReviewDate),
        notes: schedule.notes,
      });

      if (sent) {
        await storage.markReminderSent(schedule.id);
        log(`Reminder sent and marked for ${schedule.orgName} (id: ${schedule.id})`);
      } else if (!isEmailConfigured()) {
        log(`Email not configured — reminder for ${schedule.orgName} will retry next check once SMTP is set up`);
      }
    }
  } catch (err: any) {
    log(`Error checking reminders: ${err.message}`);
  }
}

export function startReminderJob() {
  log(`Starting reminder job (checking every ${CHECK_INTERVAL_MS / 60000} minutes, ${REMINDER_DAYS_AHEAD} days ahead)`);
  if (!isEmailConfigured()) {
    log("SMTP not configured — reminders will be logged but not sent. Set SMTP_HOST, SMTP_USER, SMTP_PASS to enable.");
  }

  checkAndSendReminders();

  setInterval(checkAndSendReminders, CHECK_INTERVAL_MS);
}
