import { getMailer, resolveBaseUrl } from "@/lib/mailer";
import { serverT } from "@/lib/i18n/serverMessages";
import { safeError } from "@/lib/privacy/safeError";
import {
  OTP_TTL_MINUTES,
  generateOpaqueToken,
  hashOpaqueToken,
  summarizeUserAgent,
  formatSecurityEventTime
} from "@/lib/auth/pin-login";

/**
 * Sisselogimise e-kirja link: mint → saada → alles siis rotatsioon, ja kinnitamise
 * otsus marsruudist väljas, et teda saaks testida.
 *
 * Kolm SOL-leidu elasid siin ühe voo peal ja kõigil kolmel oli kõrval juba
 * lahendatud vaste:
 *   -08 kinnitas sisselogimise pelga GET-i peale (vaste: `verify-email` ja
 *       e-posti vahetuse kinnitus, mõlemad GET = vaheleht, POST = otsus);
 *   -12 tuletas turvalingi origini kliendi `Host` päisest (vaste: paroolitaaste
 *       ja e-posti vahetus, mõlemad keelduvad ilma kanoonilise baas-URL-ita);
 *   -13 rotreeris tokeni ENNE saatmist (vaste: `SOL-AUTH-06` e-posti vahetuses).
 */

/**
 * Turvalingi origin tuleb AINULT konfiguratsioonist. Varem langes ta puuduva
 * `NEXTAUTH_URL`/`AUTH_URL`/`APP_URL`/`VERCEL_URL` korral tagasi päringu
 * `x-forwarded-host`/`host` päisele, seega õiget PIN-i teadev ründaja sai lasta
 * konto e-posti aadressile kirja panna ENDA domeeniga kinnituslingi ja püüda
 * bearer-tokeni ära (SOL-AUTH-12). Puuduv konfiguratsioon on nüüd viga, mitte
 * varurada — täpselt nagu paroolitaastel ja e-posti vahetusel.
 */
export function buildLoginConfirmUrl(token, locale) {
  const baseUrl = resolveBaseUrl();
  if (!baseUrl) {
    throw new Error("api.auth.login.base_url_missing");
  }
  const url = new URL("/api/auth/login-confirm", baseUrl.replace(/\/+$/g, ""));
  url.searchParams.set("token", token);
  if (locale) url.searchParams.set("locale", locale);
  return url.toString();
}

/** Mint ilma andmebaasita: alles kutsuja teab, kas kiri jõudis teele. */
export function prepareLoginEmailLink({
  generateToken = () => generateOpaqueToken(32),
  hashToken = hashOpaqueToken
} = {}) {
  const token = generateToken();
  return { token, tokenHash: hashToken(token) };
}

/**
 * Rea peal olev räsi ON kehtiv link — ülekirjutamine pensioneerib vaikselt selle
 * lingi, mida kasutaja võib parajasti käes hoida. Seepärast on see eraldi samm.
 */
export async function persistLoginEmailLinkHash({ db, id, tokenHash }) {
  await db.loginTempToken.update({
    where: { id },
    data: { emailLinkTokenHash: tokenHash }
  });
}

/**
 * Resend: mint → SAADA → alles siis rotatsioon.
 *
 * Vana järjekord kirjutas uue räsi reale enne maileri kutset, seega ajutine
 * SMTP-tõrge tappis kohale jõudnud kehtiva lingi ja uut ei tulnud asemele —
 * kasutajale jäi ainult PIN-i uuesti alustamine, kuigi UI näitas lihtsalt
 * resend-tõrget (SOL-AUTH-13). Nüüd on tarne eeltingimus, mitte tagajärg.
 *
 * Tagastab `{ ok: true }` või `{ ok: false, reason: "delivery", error }` — vale
 * eduteade oli osa leiust, seega tarnetõrget ei neelata.
 */
export async function resendLoginEmailLink({ db, loginTokenId, deliver, prepare = prepareLoginEmailLink }) {
  const prepared = prepare();

  try {
    await deliver(prepared.token);
  } catch (error) {
    return { ok: false, reason: "delivery", error };
  }

  await persistLoginEmailLinkHash({ db, id: loginTokenId, tokenHash: prepared.tokenHash });
  return { ok: true };
}

/**
 * Kirjeldab kinnitatavat sisselogimiskatset — LOEB, ei kirjuta.
 *
 * Kinnituslehe kontekst (seade, aeg, IP) on siin turvamehhanismi tuum, mitte
 * kaunistus: PIN-sisselogimist alustab ründaja OMA brauseris, seega ainus, mis
 * konto omanikku aitab, on näha, et katse tuli võõrast seadmest — enne kui ta
 * nupule vajutab.
 */
export async function describeLoginEmailConfirmation({
  db,
  token,
  hashToken = hashOpaqueToken,
  now = () => new Date(),
  locale = "et"
}) {
  if (!token || typeof token !== "string") return { ok: false };

  const row = await db.loginTempToken.findUnique({
    where: { emailLinkTokenHash: hashToken(token.trim()) },
    select: {
      requiresOtp: true,
      otpVerifiedAt: true,
      usedAt: true,
      expiresAt: true,
      userAgent: true,
      ipAddress: true,
      createdAt: true
    }
  });

  if (!row || !row.requiresOtp || row.otpVerifiedAt || row.usedAt || row.expiresAt <= now()) {
    return { ok: false };
  }

  return {
    ok: true,
    attempt: {
      device: summarizeUserAgent(row.userAgent),
      ipAddress: row.ipAddress || "-",
      startedAt: formatSecurityEventTime(locale, row.createdAt)
    }
  };
}

/**
 * Kinnitamine ise. Tingimuslik `updateMany` on siin ainus ühekordsuse tõend: ta
 * nõuab täpselt seda seisu, mille peal otsus tehti, ja nullib räsi, seega sama
 * link ei saa teist katset kinnitada.
 */
export async function confirmLoginEmailLink({
  db,
  token,
  hashToken = hashOpaqueToken,
  now = () => new Date()
}) {
  if (!token || typeof token !== "string") return { ok: false, count: 0 };

  const at = now();
  const result = await db.loginTempToken.updateMany({
    where: {
      emailLinkTokenHash: hashToken(token.trim()),
      requiresOtp: true,
      otpVerifiedAt: null,
      usedAt: null,
      expiresAt: { gt: at }
    },
    data: {
      otpVerifiedAt: at,
      emailLinkTokenHash: null
    }
  });

  return { ok: result.count > 0, count: result.count };
}

export async function sendLoginLinkEmail(email, confirmUrl, locale) {
  const mailer = getMailer("login-link");
  const from = process.env.EMAIL_FROM || process.env.SMTP_FROM;
  const isDev = process.env.NODE_ENV === "development";

  if (isDev) {
    console.info("[login-link][dev] generated login confirmation link", {
      email,
      confirmUrl
    });
  }

  if (!from) {
    if (isDev) return;
    throw new Error("api.auth.login.email_from_missing");
  }

  const values = {
    confirmUrl,
    minutes: OTP_TTL_MINUTES
  };

  try {
    if (!isDev) {
      await mailer.sendMail({
        to: email,
        from,
        subject: serverT(locale, "email.auth.login_link.subject", values),
        text: serverT(locale, "email.auth.login_link.text", values),
        html: serverT(locale, "email.auth.login_link.html", values)
      });
    }
  } catch (error) {
    console.error("[login-link] send failed", safeError(error));
    if (!isDev) throw error;
  }
}
