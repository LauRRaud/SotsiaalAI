/**
 * Kinnituslingi kiri asutuse e-postile (teenuseprofiili esindusõigus).
 *
 * Kiri läheb aadressile, mille teenuseosutaja kirjutas ja mis on äriregistris selle asutuse
 * kontaktina kirjas. Kirja saaja võib olla inimene, kes platvormist midagi ei tea: kiri ütleb,
 * miks see tuli, mida teha, kui profiil on asutuse oma, ja mida teha, kui ei ole.
 *
 * Lingi alus tuleb AINULT konfiguratsioonist (`resolveBaseUrl`), mitte päringu päisest: muidu
 * saaks kirja panna võõra domeeniga lingi.
 */
import { serverT } from "@/lib/i18n/serverMessages";
import { getMailer, resolveBaseUrl, resolveMailFrom } from "@/lib/mailer";
import { REPRESENTATION_LINK_DAYS } from "@/lib/serviceProviderRepresentation";

export const REPRESENTATION_CONFIRM_PATH = "/teenuseprofiil/kinnitus";

export function buildRepresentationConfirmUrl(token, baseUrl = resolveBaseUrl()) {
  if (!baseUrl) throw new Error("REPRESENTATION_BASE_URL_MISSING");
  const url = new URL(REPRESENTATION_CONFIRM_PATH, String(baseUrl).replace(/\/+$/g, ""));
  url.searchParams.set("token", token);
  return url.toString();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Kirja sisu: asutuse nimi on teenuseosutaja kirjutatud tekst, HTML-is läheb see varjestatult. */
export function renderRepresentationLinkEmail({ organizationName, registryCode, confirmUrl, locale }) {
  const values = { organizationName, registryCode, confirmUrl, days: REPRESENTATION_LINK_DAYS };
  return {
    subject: serverT(locale, "email.service_representation.subject", values),
    text: serverT(locale, "email.service_representation.text", values),
    html: serverT(locale, "email.service_representation.html", {
      ...values,
      organizationName: escapeHtml(organizationName),
      registryCode: escapeHtml(registryCode),
      confirmUrl: escapeHtml(confirmUrl)
    })
  };
}

/**
 * Saadab kirja. Viskab, kui kiri teele ei läinud: kutsuja ütleb siis inimesele ausalt, et kirja
 * ei saadetud, ega kirjuta linki reale.
 *
 * Arenduskeskkonnas päris kirja ei saadeta; link läheb serveri logisse, et voogu saaks kohalikult
 * läbi mängida.
 */
export async function sendRepresentationLinkEmail(
  { to, organizationName, registryCode, token, locale },
  { mailer = null, from = resolveMailFrom(), baseUrl = resolveBaseUrl(), isDev = process.env.NODE_ENV === "development" } = {}
) {
  const confirmUrl = buildRepresentationConfirmUrl(token, baseUrl);
  if (isDev && !mailer) {
    console.info("[representation-link][dev] generated confirmation link", { confirmUrl });
    return { delivered: false, dev: true };
  }
  if (!from) throw new Error("REPRESENTATION_EMAIL_FROM_MISSING");
  const content = renderRepresentationLinkEmail({ organizationName, registryCode, confirmUrl, locale });
  await (mailer || getMailer("representation-link")).sendMail({
    to,
    from,
    subject: content.subject,
    text: content.text,
    html: content.html
  });
  return { delivered: true, dev: false };
}
