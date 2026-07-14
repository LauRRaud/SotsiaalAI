import { getMailer, resolveBaseUrl } from "./mailer.js";
import { normalizeEmail } from "./covisionShared.js";

export function buildCovisionInviteLink(covisionCaseId, baseUrl = resolveBaseUrl()) {
  const id = typeof covisionCaseId === "string" ? covisionCaseId.trim() : "";
  if (!id) throw new TypeError("covisionCaseId is required");
  const root = String(baseUrl || "http://localhost:3000").replace(/\/+$/, "");
  return `${root}/kovisioon?case=${encodeURIComponent(id)}`;
}

export async function sendCovisionInviteEmails({
  covisionCaseId,
  emails,
  inviterEmail,
  mailer = getMailer("covision-invite"),
  baseUrl
}) {
  const recipients = [...new Set((emails || []).map(normalizeEmail).filter(Boolean))];
  if (!recipients.length) return;
  const from = process.env.EMAIL_FROM || process.env.SMTP_FROM;
  if (!from) return;
  const link = buildCovisionInviteLink(covisionCaseId, baseUrl);
  for (const to of recipients) {
    await mailer.sendMail({
      to,
      from,
      replyTo: inviterEmail || undefined,
      subject: "SotsiaalAI kovisiooni kutse",
      text: [
        "Sind kutsuti SotsiaalAI kovisiooni arutelusse.",
        "",
        "Kovisiooni sisu avaneb alles pärast autentimist ja õiguste kontrolli.",
        link
      ].join("\n"),
      html: [
        "<p>Sind kutsuti SotsiaalAI kovisiooni arutelusse.</p>",
        "<p>Kovisiooni sisu avaneb alles pärast autentimist ja õiguste kontrolli.</p>",
        `<p><a href="${link}">${link}</a></p>`
      ].join("\n")
    });
  }
}
