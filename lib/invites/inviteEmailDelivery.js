import { getMailer, resolveBaseUrl } from "@/lib/mailer";
import { normalizeServerLocale } from "@/lib/i18n/serverMessages";
import { enqueuePaymentEmail, renderInviteOutboxEmail } from "@/lib/payments/emailOutbox";
import { safeError } from "@/lib/privacy/safeError";

/**
 * KUTSE-KIRJA KOHALETOIMETUS (SOL-INV-03).
 *
 * MIS OLI VALESTI. Kutse loomine kirjutas SENT-kutse ja toortokeni andmebaasi,
 * püüdis seejärel `sendInviteEmail()` vea kinni AINULT logiga ja jätkas.
 * Eduvastusest eemaldati toortoken, seega kasutaja ei saanud ebaõnnestunud kirja
 * linki isegi käsitsi edasi saata. Kutse jäi `SENT` olekusse ja vastus ütles
 * kõigi adressaatide kohta ühetaoliselt „loodud" — mitmest aadressist võisid
 * mõned kirjad kohale jõuda ja teised mitte, ilma et keegi seda näeks.
 *
 * MIS SIIN ON. Kaks asja, mis üksinda kumbki ei piisa:
 *
 *   1. **PÜSIV OLEK.** Iga kutse-kiri läheb enne saatmist `PaymentEmailOutbox`-i
 *      — samasse järjekorda, mida kordussaatmine juba kasutas ja mille worker
 *      toodangus töötab. Rida ON delivery olek: `PENDING` = kohale toimetamata,
 *      `SENT` = kinnitatud. Idempotentsus tuleb `dedupeKey`-st, mis kannab kutse
 *      id-d ja TOKENI RÄSI (mitte toortokenit).
 *   2. **AUS VASTUS.** Kohene katse tehakse ikka (inimene ootab kirja kohe, mitte
 *      kolme minuti pärast), aga tema tulemus öeldakse välja: `sent` · `queued`
 *      (kohene katse kukkus, worker proovib uuesti) · `failed` (ka järjekorda ei
 *      õnnestunud panna — alles siis on kutse päriselt ilma teeta).
 *
 * Kordus EI SAADA kohe: kui sama `dedupeKey` on juba järjekorras, võis worker ta
 * juba ära saata ja teine kiri oleks topelt. Sellisel juhul on aus vastus
 * `queued`.
 */

export const INVITE_EMAIL_DELIVERY = Object.freeze({
  SENT: "sent",
  QUEUED: "queued",
  FAILED: "failed"
});

/**
 * Dedupe-võti kannab TOKENI RÄSI, mitte toortokenit: võti satub logidesse ja
 * andmebaasi indeksisse, toortoken on aga liitumisõigus ise.
 */
export function inviteEmailDedupeKey({ kind, inviteId, tokenHash }) {
  return `invite_${kind}:${inviteId}:${String(tokenHash || "").slice(0, 24)}`;
}

function errorCode(error) {
  const raw = String(error?.code || error?.name || "EMAIL_FAILED").toUpperCase();
  return raw.replace(/[^A-Z0-9_]/gu, "_").slice(0, 80) || "EMAIL_FAILED";
}

export async function deliverInviteEmail({
  db,
  kind = "create",
  inviteId,
  toEmail,
  tokenRaw,
  tokenHash,
  roomTitle,
  inviterName,
  locale,
  mailer = null,
  baseUrl = resolveBaseUrl(),
  now = new Date()
}) {
  const template = kind === "resend" ? "invite_resend" : "invite_create";
  const dedupeKey = inviteEmailDedupeKey({ kind, inviteId, tokenHash });
  const normalizedLocale = normalizeServerLocale(locale) || "en";
  const payload = {
    joinToken: tokenRaw,
    roomTitle: String(roomTitle || ""),
    inviterName: String(inviterName || "SotsiaalAI")
  };

  let queued = false;
  let duplicate = false;
  try {
    const result = await enqueuePaymentEmail(db, {
      dedupeKey,
      template,
      toEmail,
      locale: normalizedLocale,
      inviteId,
      payload,
      now
    });
    queued = Boolean(result?.enqueued);
    duplicate = result?.reason === "duplicate";
  } catch (error) {
    console.error("[invite email] enqueue failed", safeError(error));
  }

  // Sama võti on juba järjekorras — worker võis ta juba ära saata.
  if (duplicate) return INVITE_EMAIL_DELIVERY.QUEUED;

  const from = String(process.env.EMAIL_FROM || process.env.SMTP_FROM || "").trim();
  if (!from) {
    // Konfiguratsioonipuudus ei ole „saadetud". Järjekorras olev rida ootab
    // seadistust; ilma järjekorrata on kutse päriselt ilma teeta.
    return queued ? INVITE_EMAIL_DELIVERY.QUEUED : INVITE_EMAIL_DELIVERY.FAILED;
  }

  try {
    const content = await renderInviteOutboxEmail({
      template,
      locale: normalizedLocale,
      payload,
      baseUrl
    });
    const transport = mailer || getMailer(kind === "resend" ? "invite-resend" : "invite");
    await transport.sendMail({
      to: toEmail,
      from,
      subject: content.subject,
      text: content.text,
      html: content.html
    });
    // Kinnitatud kohaletoimetus võtab rea workeri käest ära — muidu saadaks ta
    // kolme minuti pärast teise kirja.
    await db.paymentEmailOutbox
      ?.updateMany?.({
        where: { dedupeKey, status: "PENDING" },
        data: { status: "SENT", sentAt: new Date(now), nextAttemptAt: null, lastErrorCode: null }
      })
      .catch(() => null);
    return INVITE_EMAIL_DELIVERY.SENT;
  } catch (error) {
    // Toortokenit siin EI logita — läheb ainult veakood.
    console.error("[invite email] immediate send failed", safeError(error));
    await db.paymentEmailOutbox
      ?.updateMany?.({
        where: { dedupeKey, status: "PENDING" },
        data: { lastErrorCode: errorCode(error) }
      })
      .catch(() => null);
    return queued ? INVITE_EMAIL_DELIVERY.QUEUED : INVITE_EMAIL_DELIVERY.FAILED;
  }
}
