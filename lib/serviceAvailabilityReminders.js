import { prisma } from "@/lib/prisma";
import { getMailer, hasConfiguredEmailTransport, resolveBaseUrl } from "@/lib/mailer";
import { safeError } from "@/lib/privacy/safeError";
import {
  SERVICE_AVAILABILITY_STATUSES,
  getServiceAvailabilityState,
  serviceAvailabilityFreshDays,
  serviceAvailabilityReminderDue
} from "@/lib/serviceAvailability";

const AUDIT_SENT = "service_availability_reminder_sent";
const AUDIT_NOT_SENT = "service_availability_reminder_not_sent";

function cleanEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return email && email.includes("@") ? email : "";
}

function reminderCopy(locale, organizationName, serviceName, link) {
  if (locale === "en") {
    return {
      subject: `Please confirm availability for ${serviceName}`,
      text: `${organizationName}: the availability information for “${serviceName}” needs confirmation. Review and confirm it in your authenticated service profile: ${link}`
    };
  }
  if (locale === "ru") {
    return {
      subject: `Подтвердите доступность услуги: ${serviceName}`,
      text: `${organizationName}: сведения о доступности услуги «${serviceName}» требуют подтверждения. Проверьте и подтвердите их в своём защищённом профиле поставщика услуг: ${link}`
    };
  }
  return {
    subject: `Kinnita teenuse kättesaadavus: ${serviceName}`,
    text: `${organizationName}: teenuse „${serviceName}” kättesaadavuse info vajab kinnitamist. Vaata info üle ja kinnita see oma autenditud teenuseprofiilis: ${link}`
  };
}

export function buildServiceAvailabilityReminderEmail({ service, profile, baseUrl, locale = "et" }) {
  const link = new URL("/teenuseprofiil?availability=review", baseUrl).toString();
  const copy = reminderCopy(locale, profile.organizationName, service.name, link);
  return {
    subject: copy.subject,
    text: copy.text,
    html: `<p>${copy.text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</p>`
  };
}

async function writeAudit(db, service, action, reason, extra = {}) {
  await db.dataAuditLog.create({
    data: {
      targetUserId: service.providerProfile.ownerId,
      action,
      resourceType: "ServiceProviderService",
      resourceId: service.id,
      meta: {
        reason,
        availabilityCheckedAt: service.availabilityCheckedAt?.toISOString?.() || service.availabilityCheckedAt || null,
        ...extra
      }
    }
  });
}

export async function dispatchServiceAvailabilityReminders(options = {}) {
  const db = options.db || prisma;
  const now = options.now instanceof Date ? options.now : new Date();
  const freshDays = serviceAvailabilityFreshDays(options.freshDays);
  const cutoff = new Date(now.getTime() - freshDays * 86_400_000);
  const limit = Math.max(1, Math.min(Number(options.limit) || 100, 500));
  const dryRun = options.dryRun === true;
  const transportConfigured = typeof options.transportConfigured === "boolean"
    ? options.transportConfigured
    : hasConfiguredEmailTransport();
  const from = cleanEmail(options.from ?? process.env.EMAIL_FROM ?? process.env.SMTP_FROM);
  const baseUrl = options.baseUrl || resolveBaseUrl();

  const services = await db.serviceProviderService.findMany({
    where: {
      status: "PUBLISHED",
      availabilityStatus: { in: SERVICE_AVAILABILITY_STATUSES },
      availabilityCheckedAt: { lt: cutoff },
      availabilityReminderSentAt: null
    },
    orderBy: [{ availabilityCheckedAt: "asc" }, { id: "asc" }],
    take: Math.min(limit * 5, 2000),
    include: {
      providerProfile: {
        include: {
          owner: { select: { id: true, email: true } }
        }
      }
    }
  });

  const summary = { due: 0, sent: 0, notSent: 0, skipped: 0, dryRun: 0 };
  for (const service of services) {
    if (summary.due >= limit) break;
    if (!serviceAvailabilityReminderDue(service, { now, freshDays })) {
      summary.skipped += 1;
      continue;
    }
    summary.due += 1;
    if (dryRun) {
      summary.dryRun += 1;
      continue;
    }

    const recipient = cleanEmail(service.providerProfile?.owner?.email || service.providerProfile?.email);
    let missingReason = "";
    if (!recipient) missingReason = "recipient_email_missing";
    else if (!from) missingReason = "sender_missing";
    else if (!baseUrl) missingReason = "base_url_missing";
    else if (!transportConfigured && !options.mailer) missingReason = "transport_missing";
    if (missingReason) {
      await writeAudit(db, service, AUDIT_NOT_SENT, missingReason);
      summary.notSent += 1;
      continue;
    }

    const claim = await db.serviceProviderService.updateMany({
      where: {
        id: service.id,
        availabilityCheckedAt: service.availabilityCheckedAt,
        availabilityReminderSentAt: service.availabilityReminderSentAt
      },
      data: { availabilityReminderSentAt: now }
    });
    if (claim.count !== 1) {
      summary.skipped += 1;
      continue;
    }

    try {
      const message = buildServiceAvailabilityReminderEmail({
        service,
        profile: service.providerProfile,
        baseUrl,
        locale: options.locale || "et"
      });
      await (options.mailer || getMailer("service-availability")).sendMail({
        to: recipient,
        from,
        ...message
      });
      await writeAudit(db, service, AUDIT_SENT, "stale_availability", { freshDays });
      summary.sent += 1;
    } catch (error) {
      await db.serviceProviderService.updateMany({
        where: { id: service.id, availabilityReminderSentAt: now },
        data: { availabilityReminderSentAt: service.availabilityReminderSentAt || null }
      });
      await writeAudit(db, service, AUDIT_NOT_SENT, "transport_error", {
        errorCode: String(error?.code || "SEND_FAILED").slice(0, 80)
      });
      console.error("[service-availability] reminder failed", safeError(error));
      summary.notSent += 1;
    }
  }

  return summary;
}

export async function listServiceAvailabilityAdminRows(options = {}) {
  const db = options.db || prisma;
  const now = options.now instanceof Date ? options.now : new Date();
  const freshDays = serviceAvailabilityFreshDays(options.freshDays);
  const limit = Math.max(1, Math.min(Number(options.limit) || 500, 1000));
  const services = await db.serviceProviderService.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [{ availabilityCheckedAt: "asc" }, { name: "asc" }],
    take: limit,
    include: {
      providerProfile: {
        include: { owner: { select: { id: true, email: true } } }
      }
    }
  });

  return services.map((service) => {
    const availability = getServiceAvailabilityState(service, { now, freshDays });
    return {
      id: service.id,
      name: service.name,
      profileId: service.providerProfileId,
      organizationName: service.providerProfile?.organizationName || "",
      ownerId: service.providerProfile?.ownerId || "",
      ownerEmail: service.providerProfile?.owner?.email || service.providerProfile?.email || null,
      availability,
      reminderSentAt: service.availabilityReminderSentAt?.toISOString?.() || service.availabilityReminderSentAt || null
    };
  }).filter((row) => row.availability.freshness !== "fresh");
}
