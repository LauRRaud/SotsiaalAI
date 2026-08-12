import crypto from "node:crypto";

import { PaymentStatus } from "@/generated/prisma/client";
import { enqueuePaymentEmail } from "@/lib/payments/emailOutbox";
import { writePaymentAudit } from "@/lib/payments/observability";

/**
 * SOL-PAY-07 — TASUTUD KUTSE LINK EI TOHI KADUDA.
 *
 * MIS OLI VALESTI. PAID webhook mintis kutse toortokeni tehingu SEES, salvestas
 * ainult räsi ja kandis toortokeni tehingust välja lokaalses objektis.
 * Outbox-rida loodi alles pärast maksetehingu commit'i ja enqueue-viga neelati
 * logiks — webhook vastas ikkagi 200. Räsist ei saa toortokenit tagasi, seega
 * makse ja kutse `SENT` seis commit'isid, aga saajale vajalikku join-linki EI
 * OLNUD enam kuskilt võtta. Sama webhooki kordus nägi makset juba `PAID`-na ja
 * tagastas idempotentse tulemuse ilma tokenita.
 *
 * MIS SIIN ON. Toortoken ja tema kandja sünnivad ÜHES tehingus: kui outbox-rida
 * ei teki, ei jõustu ka kutse räsi. Ja kordus ei ole enam tupik — kui kandja on
 * kadunud, aga kutse on veel elus, tehakse uus link ILMA uue õiguse või makseta.
 *
 * MIKS ROTATSIOON ON OHUTU: taastamine käib AINULT siis, kui ühtegi
 * kohaletoimetamise rida ei ole. Pärast seda parandust saab see juhtuda ainult
 * siis, kui rida ei tekkinudki (= kirja ei saadetud kunagi), seega vana lingi
 * tapmine ei võta kelleltki midagi ära. Kutse peab lisaks olema veel elus
 * (`SENT`, aegumata) — aegunud kutset ei ärata keegi.
 */

export function sponsoredInviteDedupeKey(paymentId) {
  return `invite:${String(paymentId || "")}`;
}

function mintToken() {
  const token = crypto.randomBytes(48).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(token).digest("base64");
  return { token, tokenHash };
}

const INVITE_SELECT = {
  id: true,
  status: true,
  expiresAt: true,
  sponsoredRole: true,
  inviteeEmail: true,
  room: { select: { title: true } },
  inviter: { select: { email: true } }
};

/**
 * Minti link ja pane ta järjekorda — mõlemad samas tehingus.
 *
 * @param {*} tx - Prisma tehing (KOHUSTUSLIK: globaalne klient tähendaks, et
 *   outbox-rida elab üle maksetehingu tagasipööramise)
 * @returns {Promise<{delivered: boolean, reason: string, inviteId?: string, toEmail?: string}>}
 */
export async function issueSponsoredInviteDelivery(
  tx,
  { paymentId, inviteId, locale = "en", activate = false, paidAt = null, now = new Date() }
) {
  if (!paymentId || !inviteId) return { delivered: false, reason: "missing_ids" };

  const invite = await tx.invite.findUnique({ where: { id: inviteId }, select: INVITE_SELECT });
  if (!invite) return { delivered: false, reason: "invite_not_found" };

  /* Olemasolu kontrollitakse ENNE kirjutamist — erindipõhine „duplikaat" ei kõlba
     tehingu sees. PostgreSQL märgib tehingu vigaseks juba unikaalsuse rikkumise
     hetkel; JS-i `catch` päästab siin ainult protsessi, mitte tehingut, ja kõik
     järgnevad laused (sh kutse `SENT` seis) pöörduvad vaikselt tagasi. Sond tabas
     täpselt selle: kutse jäi `PENDING_PAYMENT`-i, kuigi logi ütles „activated".
     Makse rida on webhooki alguses `FOR UPDATE` all, seega võistlust siin ei ole. */
  const existingCarrier = await tx.paymentEmailOutbox.findUnique({
    where: { dedupeKey: sponsoredInviteDedupeKey(paymentId) },
    select: { id: true }
  });

  /* Kandja on juba olemas: ÕIGUS jõustub ikka (see on makse tagajärg, mitte kirja
     oma), aga räsi EI rotreerita — olemasolev kandja kannab täpselt seda tokenit,
     millele praegune räsi vastab. */
  if (existingCarrier) {
    if (activate) {
      await tx.invite.update({
        where: { id: inviteId },
        data: { status: "SENT", sponsoredPaidAt: paidAt || now }
      });
    }
    return { delivered: true, reason: "already_queued", inviteId, toEmail: invite.inviteeEmail };
  }

  const { token, tokenHash } = mintToken();
  await tx.invite.update({
    where: { id: inviteId },
    data: {
      tokenHash,
      ...(activate ? { status: "SENT", sponsoredPaidAt: paidAt || now } : {})
    }
  });

  let enqueued;
  try {
    enqueued = await enqueuePaymentEmail(tx, {
      dedupeKey: sponsoredInviteDedupeKey(paymentId),
      template: "invite_sponsored",
      toEmail: invite.inviteeEmail,
      locale,
      paymentId,
      inviteId,
      payload: {
        joinToken: token,
        roomTitle: invite.room?.title || "Room",
        inviterName: invite.inviter?.email || "SotsiaalAI",
        targetRole: invite.sponsoredRole || "CLIENT"
      },
      now
    });
  } catch (cause) {
    /* Kui kandjat ei saa luua, ei tohi ka räsi jõustuda: erind pöörab kogu
       tehingu tagasi. Nimeline kood ütleb kutsujale, MIS katkes — algne viga
       jääb `cause` külge, et diagnostika ei kaoks. */
    const error = new Error("api.subscription.invite_delivery_unavailable", { cause });
    error.code = "INVITE_DELIVERY_UNAVAILABLE";
    throw error;
  }

  // Duplikaat EI ole viga — ta tähendab, et kandja on juba olemas.
  if (!enqueued.enqueued && enqueued.reason !== "duplicate") {
    const error = new Error("api.subscription.invite_delivery_unavailable");
    error.code = "INVITE_DELIVERY_UNAVAILABLE";
    throw error;
  }

  return {
    delivered: true,
    reason: enqueued.reason === "duplicate" ? "already_queued" : "queued",
    inviteId,
    toEmail: invite.inviteeEmail
  };
}

/**
 * Kordus on viimane võimalus märgata, et tasutud kutse kandja on kadunud.
 * Uut õigust ega makset siin ei sünni — ainult uus link olemasoleva kutse peale.
 */
export async function restoreMissingSponsoredInviteDelivery(
  tx,
  { payment, locale = "en", now = new Date() }
) {
  if (!payment?.inviteId || payment.status !== PaymentStatus.PAID) return false;

  const existing = await tx.paymentEmailOutbox.findUnique({
    where: { dedupeKey: sponsoredInviteDedupeKey(payment.id) },
    select: { id: true }
  });
  if (existing) return false;

  const invite = await tx.invite.findUnique({
    where: { id: payment.inviteId },
    select: { id: true, status: true, expiresAt: true }
  });
  // Elus kutse = veel saadetud seisus ja aegumata. Kõik muu on terminal.
  if (!invite || invite.status !== "SENT") return false;
  if (invite.expiresAt && new Date(invite.expiresAt).getTime() <= now.getTime()) return false;

  const result = await issueSponsoredInviteDelivery(tx, {
    paymentId: payment.id,
    inviteId: payment.inviteId,
    locale,
    activate: false,
    now
  });
  if (!result.delivered) return false;

  await writePaymentAudit(tx, {
    action: "sponsored_invite_delivery_restored",
    result: result.reason,
    paymentId: payment.id,
    inviteId: payment.inviteId
  });
  return true;
}
