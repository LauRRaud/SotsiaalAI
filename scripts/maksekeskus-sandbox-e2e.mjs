#!/usr/bin/env node
import crypto from "node:crypto";
import { PrismaClient, PaymentProvider, PaymentStatus, Role, SubscriptionStatus } from "@prisma/client";

const prisma = new PrismaClient();

function env(name, fallback = "") {
  const value = process.env[name];
  if (value == null) return fallback;
  return String(value).trim();
}

function fail(message) {
  console.error(`[maksekeskus:e2e] FAIL: ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`[maksekeskus:e2e] ${message}`);
}

function signPayload(payload, secret) {
  if (!secret) return "";
  return crypto.createHash("sha512").update(`${payload}${secret}`).digest("hex").toUpperCase();
}

function normalizeAction(value, fallback = "cancel") {
  const raw = String(value || "")
    .toLowerCase()
    .trim();
  if (raw === "cancel" || raw === "none") return raw;
  return fallback;
}

async function requestCallback(baseUrl, query, expectedState) {
  const url = new URL("/api/subscription/callback", baseUrl);
  Object.entries(query).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url, {
    method: "GET",
    redirect: "manual"
  });
  const location = response.headers.get("location") || "";

  if (response.status !== 302) {
    throw new Error(`callback expected 302 but got ${response.status}`);
  }
  if (!location.includes(`payment=${expectedState}`)) {
    throw new Error(`callback location missing payment=${expectedState}: ${location}`);
  }

  pass(`callback ${query.status} -> ${expectedState}`);
}

async function requestWebhook(baseUrl, payload, webhookSecret) {
  const json = JSON.stringify(payload);
  const mac = signPayload(json, webhookSecret);
  const body = new URLSearchParams({
    json,
    ...(mac ? { mac } : {})
  }).toString();
  const response = await fetch(new URL("/api/subscription/webhook", baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  const data = await response.json().catch(() => ({}));
  return {
    status: response.status,
    data
  };
}

async function main() {
  const baseUrl = env("MAKSEKESKUS_E2E_BASE_URL", "http://localhost:3000");
  const webhookSecret = env("MAKSEKESKUS_API_KEY", "");
  const testEmail = env("MAKSEKESKUS_E2E_USER_EMAIL", "maksekeskus-sandbox@example.test");
  const amount = env("MAKSEKESKUS_E2E_AMOUNT", "7.99");
  const currency = env("MAKSEKESKUS_E2E_CURRENCY", "EUR").toUpperCase();
  const cleanup = env("MAKSEKESKUS_E2E_CLEANUP", "1") !== "0";
  const expectedRefundedAction = normalizeAction(
    env("MAKSEKESKUS_E2E_EXPECT_REFUNDED_ACTION", env("SUBSCRIPTION_WEBHOOK_REFUNDED_ACTION", "cancel")),
    "cancel"
  );

  pass(`base URL: ${baseUrl}`);
  pass(`test user: ${testEmail}`);
  pass(`webhook mac signing: ${webhookSecret ? "enabled" : "disabled"}`);
  pass(`expected REFUNDED action: ${expectedRefundedAction}`);

  const providerPaymentId = `mk_e2e_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
  const eventId = `evt_${Date.now()}`;

  let createdSubscriptionId = "";
  let createdPaymentId = "";
  let createdUserId = "";
  let userCreatedNow = false;

  try {
    let user = await prisma.user.findUnique({
      where: { email: testEmail },
      select: { id: true }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: testEmail,
          role: Role.CLIENT,
          isAdmin: false
        },
        select: { id: true }
      });
      userCreatedNow = true;
      pass("created test user");
    }
    createdUserId = user.id;

    const subscription = await prisma.subscription.create({
      data: {
        userId: user.id,
        status: SubscriptionStatus.NONE,
        plan: "sandbox_e2e"
      },
      select: {
        id: true
      }
    });
    createdSubscriptionId = subscription.id;
    pass(`created subscription ${createdSubscriptionId}`);

    const payment = await prisma.payment.create({
      data: {
        subscriptionId: subscription.id,
        userId: user.id,
        provider: PaymentProvider.MAKSEKESKUS,
        providerPaymentId,
        amount,
        currency,
        status: PaymentStatus.INITIATED,
        raw: {
          source: "maksekeskus_e2e_script"
        }
      },
      select: {
        id: true
      }
    });
    createdPaymentId = payment.id;
    pass(`created payment ${createdPaymentId}`);

    await requestCallback(
      baseUrl,
      {
        status: "success",
        reference: providerPaymentId,
        locale: "en"
      },
      "success"
    );
    await requestCallback(
      baseUrl,
      {
        status: "cancelled",
        reference: providerPaymentId,
        locale: "en"
      },
      "canceled"
    );

    const paidRes = await requestWebhook(
      baseUrl,
      {
        message_type: "payment_return",
        message_time: new Date().toISOString(),
        reference: providerPaymentId,
        transaction: `trx_${eventId}_paid`,
        status: "COMPLETED",
        paid_at: new Date().toISOString()
      },
      webhookSecret
    );
    if (paidRes.status !== 200 || !paidRes.data?.ok) {
      throw new Error(`paid webhook failed: status=${paidRes.status}, body=${JSON.stringify(paidRes.data)}`);
    }
    pass("processed PAID webhook");

    const paidPayment = await prisma.payment.findUnique({
      where: { id: createdPaymentId },
      select: { status: true, paidAt: true }
    });
    if (!paidPayment || paidPayment.status !== PaymentStatus.PAID || !paidPayment.paidAt) {
      throw new Error(`payment not marked PAID: ${JSON.stringify(paidPayment)}`);
    }

    const paidSubscription = await prisma.subscription.findUnique({
      where: { id: createdSubscriptionId },
      select: { status: true, validUntil: true }
    });
    if (!paidSubscription || paidSubscription.status !== SubscriptionStatus.ACTIVE || !paidSubscription.validUntil) {
      throw new Error(`subscription not activated: ${JSON.stringify(paidSubscription)}`);
    }
    pass("subscription activated from PAID webhook");

    const duplicatePaidRes = await requestWebhook(
      baseUrl,
      {
        message_type: "payment_return",
        message_time: new Date().toISOString(),
        reference: providerPaymentId,
        transaction: `trx_${eventId}_paid_duplicate`,
        status: "COMPLETED",
        paid_at: new Date().toISOString()
      },
      webhookSecret
    );
    if (duplicatePaidRes.status !== 200 || !duplicatePaidRes.data?.ok || !duplicatePaidRes.data?.idempotent) {
      throw new Error(`duplicate paid webhook not idempotent: ${JSON.stringify(duplicatePaidRes)}`);
    }
    pass("duplicate PAID webhook is idempotent");

    const refundedRes = await requestWebhook(
      baseUrl,
      {
        message_type: "payment_return",
        message_time: new Date().toISOString(),
        reference: providerPaymentId,
        transaction: `trx_${eventId}_refunded`,
        status: "REFUNDED"
      },
      webhookSecret
    );
    if (refundedRes.status !== 200 || !refundedRes.data?.ok) {
      throw new Error(`refunded webhook failed: status=${refundedRes.status}, body=${JSON.stringify(refundedRes.data)}`);
    }
    if (refundedRes.data?.subscriptionAction !== expectedRefundedAction) {
      throw new Error(
        `unexpected refunded subscriptionAction: got=${refundedRes.data?.subscriptionAction || "none"} expected=${expectedRefundedAction}`
      );
    }

    const refundedPayment = await prisma.payment.findUnique({
      where: { id: createdPaymentId },
      select: { status: true }
    });
    if (!refundedPayment || refundedPayment.status !== PaymentStatus.REFUNDED) {
      throw new Error(`payment not marked REFUNDED: ${JSON.stringify(refundedPayment)}`);
    }

    const refundedSubscription = await prisma.subscription.findUnique({
      where: { id: createdSubscriptionId },
      select: { status: true, canceledAt: true, validUntil: true }
    });
    if (!refundedSubscription) {
      throw new Error("subscription missing after REFUNDED webhook");
    }

    if (expectedRefundedAction === "cancel") {
      if (refundedSubscription.status !== SubscriptionStatus.CANCELED || !refundedSubscription.canceledAt) {
        throw new Error(`subscription not canceled on REFUNDED: ${JSON.stringify(refundedSubscription)}`);
      }
      pass("REFUNDED webhook updated payment + canceled subscription");
    } else {
      if (refundedSubscription.status !== SubscriptionStatus.ACTIVE) {
        throw new Error(`subscription expected ACTIVE after REFUNDED with action=none: ${JSON.stringify(refundedSubscription)}`);
      }
      pass("REFUNDED webhook updated payment and kept subscription active (action=none)");
    }

    pass("E2E webhook/callback checks finished successfully");
  } catch (error) {
    fail(error?.message || String(error));
  } finally {
    if (cleanup) {
      if (createdPaymentId) {
        await prisma.payment.deleteMany({ where: { id: createdPaymentId } }).catch(() => {});
      }
      if (createdSubscriptionId) {
        await prisma.subscription.deleteMany({ where: { id: createdSubscriptionId } }).catch(() => {});
      }
      if (userCreatedNow && createdUserId) {
        await prisma.user.deleteMany({ where: { id: createdUserId } }).catch(() => {});
      }
      pass("cleanup complete");
    } else {
      pass("cleanup skipped (MAKSEKESKUS_E2E_CLEANUP=0)");
    }
    await prisma.$disconnect().catch(() => {});
  }

  if (process.exitCode) {
    process.exit(process.exitCode);
  }
}

main().catch((error) => {
  fail(error?.message || String(error));
  prisma.$disconnect().catch(() => {});
});
