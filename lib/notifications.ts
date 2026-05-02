import nodemailer from "nodemailer";
import type { Competitor } from "@/lib/database";
import type { ProfileChange } from "@/lib/scraper";

export type NotificationTarget = {
  email?: string | null;
  webhookUrl?: string | null;
};

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = Number(process.env.SMTP_PORT ?? "587");

  if (!host || !user || !pass) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass
    }
  });

  return transporter;
}

function formatChangeLines(changes: ProfileChange[]) {
  return changes
    .map((change) => `- ${change.type.toUpperCase()}: ${change.summary}`)
    .join("\n");
}

export async function sendChangeNotifications(input: {
  competitor: Competitor;
  changes: ProfileChange[];
  target: NotificationTarget;
}) {
  if (input.changes.length === 0) {
    return;
  }

  const subject = `[GMB Monitor] ${input.competitor.name} changed ${input.changes
    .map((change) => change.type)
    .join(", ")}`;
  const plainText = [
    `Competitor: ${input.competitor.name}`,
    `Profile URL: ${input.competitor.profileUrl}`,
    "",
    "Detected changes:",
    formatChangeLines(input.changes),
    "",
    `Detected at: ${new Date().toISOString()}`
  ].join("\n");

  const transport = getTransporter();
  const toEmail = input.target.email ?? process.env.DEFAULT_ALERT_EMAIL ?? null;
  const fromEmail = process.env.SMTP_FROM ?? "alerts@gmb-monitor.local";

  if (transport && toEmail) {
    await transport.sendMail({
      from: fromEmail,
      to: toEmail,
      subject,
      text: plainText
    });
  }

  const webhookUrl =
    input.target.webhookUrl ?? process.env.DEFAULT_WEBHOOK_URL ?? null;
  if (webhookUrl) {
    await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        event: "competitor.changed",
        competitor: {
          id: input.competitor.id,
          name: input.competitor.name,
          profileUrl: input.competitor.profileUrl
        },
        changes: input.changes,
        summary: subject,
        detectedAt: new Date().toISOString()
      })
    });
  }
}
