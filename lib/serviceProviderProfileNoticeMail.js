/**
 * Teade asutuse e-postile, kui tema nimel teenuseprofiiliga midagi juhtus.
 *
 * Erinevalt kinnituslingi kirjast (`lib/serviceProviderRepresentationMail.js`) ei ole siin linki
 * ega nuppu: kiri ainult ütleb, mis juhtus, ja mida teha, kui profiil ei ole asutuse oma. Kirja
 * saaja võib olla inimene, kes platvormist midagi ei tea.
 *
 * Kellele kiri läheb, otsustab `lib/serviceProviderProfileNotices.js`: ainult aadressile, mis on
 * äriregistris selle registrikoodi kontakt.
 */
import { serverT } from "@/lib/i18n/serverMessages";
import { getMailer, resolveMailFrom } from "@/lib/mailer";

export const OrganizationNoticeKind = Object.freeze({
  CONFIRMED_BY_ADMIN: "confirmed_by_admin",
  REVOKED: "revoked",
  PUBLISHED: "published"
});

const KINDS = new Set(Object.values(OrganizationNoticeKind));

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Kirja sisu: asutuse nimi on teenuseosutaja kirjutatud tekst, HTML-is läheb see varjestatult. */
export function renderOrganizationNoticeEmail({ kind, organizationName, registryCode, locale }) {
  if (!KINDS.has(kind)) throw new Error("SERVICE_PROFILE_NOTICE_KIND_UNKNOWN");
  const base = `email.service_profile_notice.${kind}`;
  const values = { organizationName, registryCode };
  return {
    subject: serverT(locale, `${base}.subject`, values),
    text: serverT(locale, `${base}.text`, values),
    html: serverT(locale, `${base}.html`, {
      organizationName: escapeHtml(organizationName),
      registryCode: escapeHtml(registryCode)
    })
  };
}

/**
 * Saadab kirja. Viskab, kui kiri teele ei läinud; kutsuja otsustab, mida see tähendab.
 * Arenduskeskkonnas päris kirja ei saadeta.
 */
export async function sendOrganizationNoticeEmail(
  { to, kind, organizationName, registryCode, locale },
  { mailer = null, from = resolveMailFrom(), isDev = process.env.NODE_ENV === "development" } = {}
) {
  if (isDev && !mailer) {
    console.info("[service-profile-notice][dev] organisation notice not sent", { kind });
    return { delivered: false, dev: true };
  }
  if (!from) throw new Error("SERVICE_PROFILE_NOTICE_FROM_MISSING");
  const content = renderOrganizationNoticeEmail({ kind, organizationName, registryCode, locale });
  await (mailer || getMailer("service-profile-notice")).sendMail({
    to,
    from,
    subject: content.subject,
    text: content.text,
    html: content.html
  });
  return { delivered: true, dev: false };
}
