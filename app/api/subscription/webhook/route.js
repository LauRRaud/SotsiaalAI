export const runtime = "nodejs";

import crypto from "node:crypto";
import { NextResponse } from "next/server";
import {
  BillingInterval,
  BillingMethodStatus,
  BillingMode,
  PaymentKind,
  PaymentProvider,
  PaymentStatus,
  SubscriptionStatus
} from "@/generated/prisma/client";
import { normalizeServerLocale } from "@/lib/i18n/serverMessages";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getRequestIpFromRequest } from "@/lib/request-ip";
import {
  extractProviderPaymentId,
  getMaksekeskusSecretKey,
  mapProviderPaymentStatus,
  parseMaksekeskusFormMessage,
  verifyMaksekeskusMac,
} from "@/lib/payments/maksekeskus";
import { enqueuePaymentEmail } from "@/lib/payments/emailOutbox";
import { isTerminalPaymentStatus } from "@/lib/payments/providerOutcome";
import { describeMismatches, verifyPaidPayload } from "@/lib/payments/paymentVerification";
import {
  buildRenewalFailureSubscriptionUpdate,
  planRenewalFailure
} from "@/lib/payments/recurring";
import { logPaymentAudit, logPaymentEvent } from "@/lib/payments/observability";
import { buildPaymentRawRecord } from "@/lib/payments/rawProjection";
import { safeError } from "@/lib/privacy/safeError";
import {
  activateSubscriptionFromPayment,
  upsertRecurringBillingMethod
} from "@/lib/payments/subscriptionActivation";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0"
};
const WEBHOOK_SECRET = String(getMaksekeskusSecretKey() || "").trim();
const SUBSCRIPTION_WEBHOOK_RATE_LIMIT_WINDOW_MS = Number(process.env.SUBSCRIPTION_WEBHOOK_RATE_LIMIT_WINDOW_MS || 60_000);
const SUBSCRIPTION_WEBHOOK_RATE_LIMIT_MAX = Number(process.env.SUBSCRIPTION_WEBHOOK_RATE_LIMIT_MAX || 120);
const REFUNDED_ACTION = normalizeSubscriptionAction(process.env.SUBSCRIPTION_WEBHOOK_REFUNDED_ACTION, "cancel");
const CANCELED_ACTION = normalizeSubscriptionAction(process.env.SUBSCRIPTION_WEBHOOK_CANCELED_ACTION, "none");
const FAILED_ACTION = normalizeSubscriptionAction(process.env.SUBSCRIPTION_WEBHOOK_FAILED_ACTION, "none");
/* SOL-PAY-02: lõplikkuse definitsioon elab ühes kohas. `RECONCILE_PENDING` EI
   ole siin — see on kogu leiu mõte: ebamäärase tulemuse peale peab hilisem PAID
   veel õiguse aktiveerima. */
const isFinalStatus = isTerminalPaymentStatus;
const OWNER_NOTIFICATION_EMAIL = String(process.env.PAYMENT_OWNER_EMAIL || "info@sotsiaal.ai")
  .trim()
  .toLowerCase();
const OWNER_NOTIFICATION_LOCALE = normalizeServerLocale(process.env.PAYMENT_OWNER_EMAIL_LOCALE) || "en";

function json(payload, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: NO_STORE_HEADERS
  });
}

function parsePaidAt(payload) {
  const raw =
    payload?.paidAt ||
    payload?.paid_at ||
    payload?.transaction_time ||
    payload?.completed_at ||
    payload?.updated_at ||
    null;
  if (!raw) return new Date();
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return new Date();
  return date;
}

function resolveIncomingStatus(payload) {
  const candidates = [
    payload?.status,
    payload?.transaction?.status,
    payload?.payment_status,
    payload?.transaction_status,
    payload?.event,
    payload?.type
  ];
  for (const candidate of candidates) {
    const mapped = mapProviderPaymentStatus(candidate);
    if (mapped) return mapped;
  }
  return null;
}

function normalizeSubscriptionAction(value, fallback) {
  const raw = String(value || "")
    .toLowerCase()
    .trim();
  if (raw === "cancel" || raw === "none") return raw;
  return fallback;
}

function actionForStatus(status) {
  if (status === PaymentStatus.REFUNDED) return REFUNDED_ACTION;
  if (status === PaymentStatus.CANCELED) return CANCELED_ACTION;
  if (status === PaymentStatus.FAILED) return FAILED_ACTION;
  return "none";
}

function canSendOwnerNotification(result) {
  /* SOL-PAY-05: ülevaatust vajav makse on täpselt see sõnum, mida omanik peab
     nägema — ta ei ole „updated", aga ta on otsus, mille teeb inimene. */
  return (
    Boolean(result?.updated || result?.review) && Boolean(result?.paymentId) && Boolean(result?.status)
  );
}

function asPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

async function cancelSubscriptionFromPayment(tx, payment) {
  if (!payment?.subscriptionId) return null;
  const now = new Date();
  // O-M4: tagasimakse/turva-rada on KOHENE revoke — ligipääs lõpeb kohe
  // (validUntil=now), uut uuendust ei alustata, cancelAtPeriodEnd nullitakse.
  await tx.subscription.updateMany({
    where: {
      id: payment.subscriptionId,
      status: SubscriptionStatus.ACTIVE
    },
    data: {
      status: SubscriptionStatus.CANCELED,
      canceledAt: now,
      validUntil: now,
      nextBilling: null,
      cancelAtPeriodEnd: false
    }
  });
  // Revoke ka maksevahend, et tulevasi kordusmakseid ei toimuks.
  const cancelSub = await tx.subscription.findUnique({
    where: { id: payment.subscriptionId },
    select: { billingMethodId: true }
  });
  if (cancelSub?.billingMethodId) {
    await tx.billingMethod.updateMany({
      where: { id: cancelSub.billingMethodId, status: { not: BillingMethodStatus.REVOKED } },
      data: { status: BillingMethodStatus.REVOKED, revokedAt: now }
    });
  }
  return tx.subscription.findUnique({
    where: {
      id: payment.subscriptionId
    },
    select: {
      id: true,
      status: true,
      validUntil: true,
      nextBilling: true,
      canceledAt: true,
      plan: true,
      userId: true,
      updatedAt: true,
      createdAt: true
    }
  });
}

export async function POST(request) {
  const ip = getRequestIpFromRequest(request);
  const limiter = consumeRateLimit(
    `subscription:webhook:${ip}`,
    SUBSCRIPTION_WEBHOOK_RATE_LIMIT_MAX,
    SUBSCRIPTION_WEBHOOK_RATE_LIMIT_WINDOW_MS
  );
  if (!limiter.allowed) {
    logPaymentEvent("subscription_webhook_rate_limited", {
      ip
    });
    return json(
      {
        ok: false,
        messageKey: "api.common.rate_limited",
        message: "api.common.rate_limited"
      },
      429
    );
  }

  const rawBody = await request.text().catch(() => "");
  const contentType = String(request.headers.get("content-type") || "").toLowerCase();
  if (!rawBody) {
    logPaymentEvent("subscription_webhook_invalid_payload", {
      ip,
      reason: "empty_body"
    });
    return json(
      {
        ok: false,
        messageKey: "api.subscription.webhook_invalid_payload",
        message: "api.subscription.webhook_invalid_payload"
      },
      400
    );
  }

  if (
    !contentType.includes("application/x-www-form-urlencoded") &&
    !rawBody.includes("json=")
  ) {
    logPaymentEvent("subscription_webhook_invalid_payload", {
      ip,
      reason: "unsupported_content_type",
      contentType
    });
    return json(
      {
        ok: false,
        messageKey: "api.subscription.webhook_invalid_payload",
        message: "api.subscription.webhook_invalid_payload"
      },
      400
    );
  }

  const parsed = parseMaksekeskusFormMessage(rawBody);
  if (!parsed.jsonText || !parsed.payload) {
    logPaymentEvent("subscription_webhook_invalid_payload", {
      ip,
      reason: "invalid_form_payload"
    });
    return json(
      {
        ok: false,
        messageKey: "api.subscription.webhook_invalid_payload",
        message: "api.subscription.webhook_invalid_payload"
      },
      400
    );
  }

  if (!WEBHOOK_SECRET) {
    logPaymentEvent("subscription_webhook_signature_unconfigured", {
      ip
    });
    return json(
      {
        ok: false,
        messageKey: "api.subscription.webhook_signature_unconfigured",
        message: "api.subscription.webhook_signature_unconfigured"
      },
      503
    );
  }

  if (!verifyMaksekeskusMac(parsed.jsonText, parsed.mac, WEBHOOK_SECRET)) {
    logPaymentEvent("subscription_webhook_invalid_signature", {
      ip,
      signatureMode: "mac"
    });
    return json(
      {
        ok: false,
        messageKey: "api.subscription.webhook_signature_invalid",
        message: "api.subscription.webhook_signature_invalid"
      },
      401
    );
  }

  const payload = parsed.payload;

  const messageType = String(payload?.message_type || "payment_return")
    .trim()
    .toLowerCase();
  if (messageType && messageType !== "payment_return") {
    logPaymentEvent("subscription_webhook_ignored_message_type", {
      ip,
      messageType
    });
    return json({
      ok: true,
      ignored: true,
      messageType
    });
  }

  const providerPaymentId = extractProviderPaymentId(payload);
  const nextStatus = resolveIncomingStatus(payload);
  if (!providerPaymentId || !nextStatus) {
    logPaymentEvent("subscription_webhook_invalid_payload", {
      ip,
      reason: "missing_fields",
      providerPaymentId: providerPaymentId || "",
      incomingStatus: payload?.status || payload?.payment_status || payload?.transaction_status || ""
    });
    return json(
      {
        ok: false,
        messageKey: "api.subscription.webhook_invalid_payload",
        message: "api.subscription.webhook_invalid_payload"
      },
      400
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // L-03: lukusta makseea rida enne lugemist. Ilma selleta võivad kaks
      // samaaegset eri-staatusega webhook'i (nt PAID + CANCELED) mõlemad lugeda
      // INITIATED ja jätta vastuolulise õiguse; FOR UPDATE serialiseerib need.
      await tx.$queryRaw`
        SELECT 1 FROM "Payment"
        WHERE "providerPaymentId" = ${providerPaymentId}
        FOR UPDATE
      `;

      const payment = await tx.payment.findUnique({
        where: {
          provider_providerPaymentId: {
            provider: PaymentProvider.MAKSEKESKUS,
            providerPaymentId
          }
        },
        select: {
          id: true,
          status: true,
          subscriptionId: true,
          inviteId: true,
          userId: true,
          kind: true,
          billingMethodId: true,
          /* SOL-PAY-05: summa ja valuuta ON siin real olemas — checkout kirjutas
             nad ise. Vana select ei lugenud neid, seega otsus ei saanudki neid
             võrrelda. */
          providerPaymentId: true,
          amount: true,
          currency: true,
          raw: true
        }
      });
      const paymentLocale =
        normalizeServerLocale(payment?.raw?.locale) ||
        normalizeServerLocale(payment?.raw?.lang) ||
        "en";

      if (!payment) {
        return {
          notFound: true
        };
      }

      const sameStatus = payment.status === nextStatus;
      if (sameStatus) {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            raw: buildPaymentRawRecord(
              { ...asPlainObject(payment.raw), source: "maksekeskus_webhook" },
              payload
            )
          }
        });
        return {
          idempotent: true,
          paymentId: payment.id,
          status: payment.status,
          paymentLocale
        };
      }

      if (isFinalStatus(payment.status) && nextStatus !== PaymentStatus.REFUNDED) {
        return {
          ignored: true,
          paymentId: payment.id,
          status: payment.status,
          paymentLocale
        };
      }

      /* SOL-PAY-05: allkiri tõendab PÄRITOLU, mitte summat. Enne kui `PAID`
         annab kuu või sponsorkutse õiguse, peab sõnum kuuluma SELLELE maksele ja
         SELLE summa eest. Mittevastavus ei ole tõrge ega vaikne edu — ta on
         nähtav `REVIEW_REQUIRED` seis, mille otsustab inimene. */
      if (nextStatus === PaymentStatus.PAID) {
        const verdict = verifyPaidPayload({ payment, payload });
        if (!verdict.ok) {
          const reviewedPayment = await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: PaymentStatus.REVIEW_REQUIRED,
              raw: buildPaymentRawRecord(
                {
                  ...asPlainObject(payment.raw),
                  source: "maksekeskus_webhook",
                  review: {
                    reason: "paid_payload_mismatch",
                    fields: describeMismatches(verdict.mismatches),
                    mismatches: verdict.mismatches
                  }
                },
                payload
              )
            },
            select: { id: true, status: true }
          });
          logPaymentAudit({
            action: "payment_review_required",
            result: describeMismatches(verdict.mismatches),
            paymentId: payment.id,
            subscriptionId: payment.subscriptionId,
            inviteId: payment.inviteId
          });
          return {
            review: true,
            paymentId: reviewedPayment.id,
            status: reviewedPayment.status,
            mismatchedFields: describeMismatches(verdict.mismatches),
            paymentLocale
          };
        }
      }

      const paidAt = nextStatus === PaymentStatus.PAID ? parsePaidAt(payload) : null;
      const subscriptionAction = nextStatus === PaymentStatus.PAID ? "activate" : actionForStatus(nextStatus);
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: nextStatus,
          ...(paidAt ? { paidAt } : {}),
          ...(nextStatus === PaymentStatus.FAILED || nextStatus === PaymentStatus.CANCELED ? { failedAt: new Date() } : {}),
          ...(nextStatus === PaymentStatus.REFUNDED ? { refundedAt: new Date() } : {}),
          raw: buildPaymentRawRecord(
            { ...asPlainObject(payment.raw), source: "maksekeskus_webhook", subscriptionAction },
            payload
          )
        },
        select: {
          id: true,
          status: true,
          subscriptionId: true,
          inviteId: true,
          kind: true,
          userId: true,
          billingMethodId: true
        }
      });

      let subscription = null;
      let inviteEmail = null;
      let clawbackNotify = null;
      let billingMethod = null;

      if (updatedPayment.inviteId) {
        if (nextStatus === PaymentStatus.PAID) {
          // O-M6/L-07: hilise PAID korral ei ärka terminaalne kutse. Ainult
          // PENDING_PAYMENT läheb SENT-iks; REVOKED/EXPIRED/ACCEPTED jäävad terminaliks.
          const currentInvite = await tx.invite.findUnique({
            where: { id: updatedPayment.inviteId },
            select: { status: true }
          });
          if (currentInvite?.status !== "PENDING_PAYMENT") {
            logPaymentAudit({
              action: "sponsored_invite_paid_terminal_ignored",
              result: String(currentInvite?.status || "unknown").toLowerCase(),
              paymentId: updatedPayment.id,
              inviteId: updatedPayment.inviteId
            });
          } else {
            const token = crypto.randomBytes(48).toString("base64url");
            const tokenHash = crypto
              .createHash("sha256")
              .update(token)
              .digest("base64");
            const invite = await tx.invite.update({
              where: { id: updatedPayment.inviteId },
              data: {
                status: "SENT",
                sponsoredPaidAt: paidAt || new Date(),
                tokenHash
              },
              select: {
                id: true,
                sponsoredRole: true,
                inviteeEmail: true,
                room: {
                  select: {
                    title: true
                  }
                },
                inviter: {
                  select: {
                    email: true
                  }
                }
              }
            });

            inviteEmail = {
              to: invite.inviteeEmail,
              token,
              roomTitle: invite.room?.title || "Room",
              inviterName: invite.inviter?.email || "SotsiaalAI",
              locale:
                normalizeServerLocale(payment?.raw?.locale) ||
                normalizeServerLocale(payment?.raw?.lang) ||
                "en",
              targetRole: invite.sponsoredRole || "CLIENT"
            };
            logPaymentAudit({
              action: "sponsored_invite_activated",
              result: "sent",
              paymentId: updatedPayment.id,
              inviteId: invite.id
            });
          }
        } else if (nextStatus === PaymentStatus.REFUNDED) {
          // L-12/O-M3: tagasimakse pärast accept'i → revoke kutse + juba antud
          // sponsoreeritud tellimus + ruumiliikmesus ÜHES lukustatud tehingus.
          // Idempotentne: updateMany tingimused väldivad topeltkustutust/-grant'i.
          const invite = await tx.invite.findUnique({
            where: { id: updatedPayment.inviteId },
            select: {
              id: true,
              roomId: true,
              acceptedByUserId: true,
              inviteeEmail: true,
              room: { select: { title: true } }
            }
          });
          await tx.invite.updateMany({
            where: { id: updatedPayment.inviteId, status: { not: "REVOKED" } },
            data: { status: "REVOKED" }
          });
          if (invite) {
            const clawedSub = await tx.subscription.updateMany({
              where: {
                inviteId: invite.id,
                billingSource: "SPONSORED_BY_HOST",
                status: "ACTIVE"
              },
              data: {
                status: SubscriptionStatus.CANCELED,
                canceledAt: new Date(),
                validUntil: new Date(),
                nextBilling: null
              }
            });
            let clawedMember = { count: 0 };
            if (invite.acceptedByUserId) {
              clawedMember = await tx.roomMember.updateMany({
                where: {
                  roomId: invite.roomId,
                  userId: invite.acceptedByUserId,
                  billingSource: "SPONSORED_BY_HOST",
                  leftAt: null
                },
                data: { leftAt: new Date() }
              });
            }
            // E5: teavita adressaati outbox'i kaudu, kui õigus päriselt tühistati.
            if ((clawedSub.count > 0 || clawedMember.count > 0) && invite.inviteeEmail) {
              clawbackNotify = {
                to: invite.inviteeEmail,
                inviteId: invite.id,
                roomTitle: invite.room?.title || "Room",
                locale: paymentLocale
              };
            }
            logPaymentAudit({
              action: "sponsored_invite_refund_clawback",
              result: `sub:${clawedSub.count},member:${clawedMember.count}`,
              paymentId: updatedPayment.id,
              inviteId: invite.id,
              roomId: invite.roomId
            });
          }
        } else if (
          nextStatus === PaymentStatus.CANCELED ||
          nextStatus === PaymentStatus.FAILED
        ) {
          await tx.invite.updateMany({
            where: {
              id: updatedPayment.inviteId,
              status: { in: ["PENDING_PAYMENT", "SENT"] }
            },
            data: { status: "REVOKED" }
          });
          logPaymentAudit({
            action: "sponsored_invite_payment_failed",
            result: String(nextStatus).toLowerCase(),
            paymentId: updatedPayment.id,
            inviteId: updatedPayment.inviteId
          });
        }
      } else if (nextStatus === PaymentStatus.PAID) {
        if (payment.kind === PaymentKind.SUBSCRIPTION_INITIAL) {
          billingMethod = await upsertRecurringBillingMethod(tx, payment, payload, paidAt || new Date());

          if (billingMethod?.id) {
            await tx.payment.update({
              where: { id: updatedPayment.id },
              data: {
                billingMethodId: billingMethod.id
              }
            });
            await tx.subscription.update({
              where: { id: updatedPayment.subscriptionId },
              data: {
                billingMode: BillingMode.RECURRING,
                billingInterval: BillingInterval.MONTHLY,
                billingMethodId: billingMethod.id
              }
            });
          }
        } else if (payment.kind === PaymentKind.SUBSCRIPTION_RENEWAL && payment.billingMethodId) {
          await tx.billingMethod.update({
            where: { id: payment.billingMethodId },
            data: {
              status: BillingMethodStatus.ACTIVE,
              lastUsedAt: paidAt || new Date()
            }
          });
        }

        subscription = await activateSubscriptionFromPayment(tx, updatedPayment);
        logPaymentAudit({
          action: "subscription_activate",
          result: "active",
          paymentId: updatedPayment.id,
          subscriptionId: updatedPayment.subscriptionId
        });
      } else if (subscriptionAction === "cancel") {
        subscription = await cancelSubscriptionFromPayment(tx, updatedPayment);
        logPaymentAudit({
          action: nextStatus === PaymentStatus.REFUNDED ? "subscription_refund_cancel" : "subscription_cancel",
          result: "canceled",
          paymentId: updatedPayment.id,
          subscriptionId: updatedPayment.subscriptionId
        });
      } else if (
        payment.kind === PaymentKind.SUBSCRIPTION_RENEWAL &&
        (nextStatus === PaymentStatus.FAILED || nextStatus === PaymentStatus.CANCELED) &&
        payment.subscriptionId
      ) {
        /* SOL-PAY-01/-02: providerilt KINNITATUD eitus on tõrge nagu iga teine
           ja tema tagajärg tuleb samast kohast, kus worker'i oma
           (`planRenewalFailure`). Vana kood kasvatas siin ainult loendurit ja
           jättis `nextBilling`-u minevikku — järgmine jooks laadis kohe uuesti,
           ilma päevagraafikuta, ja lae peal jäi tellimus igaveseks `PAST_DUE`
           seisu ilma lõpliku tühistuseta. */
        const failedAt = new Date();
        const current = await tx.subscription.findUnique({
          where: { id: payment.subscriptionId },
          select: { billingRetryCount: true, nextBilling: true, billingMethodId: true }
        });
        const failurePlan = planRenewalFailure({
          retryCountBefore: current?.billingRetryCount,
          failedAt
        });
        subscription = await tx.subscription.update({
          where: { id: payment.subscriptionId },
          data: buildRenewalFailureSubscriptionUpdate(failurePlan, {
            failedAt,
            currentNextBilling: current?.nextBilling || null
          }),
          select: {
            id: true,
            status: true,
            validUntil: true,
            nextBilling: true
          }
        });
        if (current?.billingMethodId && failurePlan.billingMethodStatus) {
          await tx.billingMethod.update({
            where: { id: current.billingMethodId },
            data: { status: failurePlan.billingMethodStatus }
          });
        }
        logPaymentAudit({
          action: failurePlan.cancel ? "subscription_renewal_canceled" : "subscription_past_due",
          result: failurePlan.cancel ? "canceled" : "past_due",
          paymentId: updatedPayment.id,
          subscriptionId: payment.subscriptionId
        });
      }

      return {
        updated: true,
        paymentId: updatedPayment.id,
        status: updatedPayment.status,
        subscription,
        billingMethodId: billingMethod?.id || payment.billingMethodId || null,
        subscriptionAction,
        inviteEmail,
        clawbackNotify,
        paymentLocale
      };
    });

    if (result?.notFound) {
      logPaymentEvent("subscription_webhook_payment_not_found", {
        providerPaymentId
      });
      return json({
        ok: true,
        ignored: true,
        messageKey: "api.subscription.payment_not_found",
        message: "api.subscription.payment_not_found"
      });
    }

    logPaymentEvent("subscription_webhook_processed", {
      providerPaymentId,
      resultStatus: result?.status || "",
      subscriptionAction: result?.subscriptionAction || "none",
      updated: Boolean(result?.updated),
      idempotent: Boolean(result?.idempotent),
      ignored: Boolean(result?.ignored),
      review: Boolean(result?.review),
      mismatchedFields: result?.mismatchedFields || ""
    });

    // T09 E6/L-06: kõik makse-/kutse e-kirjad lähevad idempotentse outbox'i
    // kaudu (mitte inline SMTP). Outbox worker saadab; kordus ei korda makset
    // ega õiguse andmist. dedupeKey väldib duplikaate webhook-korduse korral.
    if (result?.inviteEmail?.to && result?.status === PaymentStatus.PAID) {
      try {
        await enqueuePaymentEmail(prisma, {
          dedupeKey: `invite:${result.paymentId}`,
          template: "invite_sponsored",
          toEmail: result.inviteEmail.to,
          locale: result.inviteEmail.locale,
          paymentId: result.paymentId,
          payload: {
            joinToken: result.inviteEmail.token,
            roomTitle: result.inviteEmail.roomTitle,
            inviterName: result.inviteEmail.inviterName,
            targetRole: result.inviteEmail.targetRole
          }
        });
      } catch (inviteError) {
        logPaymentEvent("subscription_webhook_invite_email_enqueue_failed", {
          paymentId: result?.paymentId || "",
          providerPaymentId,
          error: inviteError
        });
      }
    }

    if (result?.updated && result?.status === PaymentStatus.PAID && result?.paymentId) {
      try {
        const payer = await prisma.payment.findUnique({
          where: { id: result.paymentId },
          select: { user: { select: { email: true } } }
        });
        const to = String(payer?.user?.email || "").trim().toLowerCase();
        if (to && to.includes("@")) {
          await enqueuePaymentEmail(prisma, {
            dedupeKey: `customer:${result.paymentId}`,
            template: "customer_confirmation",
            toEmail: to,
            locale: result.paymentLocale || "en",
            paymentId: result.paymentId,
            payload: { paymentId: result.paymentId }
          });
        }
      } catch (customerEmailError) {
        logPaymentEvent("subscription_webhook_customer_email_enqueue_failed", {
          paymentId: result?.paymentId || "",
          providerPaymentId,
          error: customerEmailError
        });
      }
    }

    if (canSendOwnerNotification(result)) {
      try {
        await enqueuePaymentEmail(prisma, {
          dedupeKey: `owner:${result.paymentId}:${result.status}`,
          template: "owner_webhook",
          toEmail: OWNER_NOTIFICATION_EMAIL,
          locale: OWNER_NOTIFICATION_LOCALE,
          paymentId: result.paymentId,
          payload: {
            paymentId: result.paymentId,
            status: result.status,
            providerPaymentId,
            subscriptionAction: result.subscriptionAction || "none"
          }
        });
      } catch (notifyError) {
        logPaymentEvent("subscription_webhook_owner_email_enqueue_failed", {
          paymentId: result?.paymentId || "",
          providerPaymentId,
          status: result?.status || "",
          error: notifyError
        });
      }
    }

    // E5: tagasimakse-clawback → teavita adressaati outbox'i kaudu.
    if (result?.clawbackNotify?.to) {
      try {
        await enqueuePaymentEmail(prisma, {
          dedupeKey: `sponsored_revoked:${result.paymentId}`,
          template: "sponsored_revoked",
          toEmail: result.clawbackNotify.to,
          locale: result.clawbackNotify.locale || "en",
          paymentId: result.paymentId,
          inviteId: result.clawbackNotify.inviteId || null,
          payload: { roomTitle: result.clawbackNotify.roomTitle }
        });
      } catch (clawbackError) {
        logPaymentEvent("subscription_webhook_clawback_email_enqueue_failed", {
          paymentId: result?.paymentId || "",
          providerPaymentId,
          error: clawbackError
        });
      }
    }

    return json({
      ok: true,
      ...result
    });
  } catch (error) {
    console.error("subscription webhook error", safeError(error));
    logPaymentEvent("subscription_webhook_failed", {
      providerPaymentId,
      error
    });
    return json(
      {
        ok: false,
        messageKey: "api.subscription.webhook_process_failed",
        message: "api.subscription.webhook_process_failed"
      },
      500
    );
  }
}
