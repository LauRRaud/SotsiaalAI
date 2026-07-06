function readPositiveNumber(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return numeric;
}

const ALERT_MIN_CHECKOUT_CREATE_RATE_PCT = readPositiveNumber(process.env.PAYMENT_ALERT_MIN_CHECKOUT_CREATE_RATE_PCT, 80);
const ALERT_MIN_PAID_FROM_CHECKOUT_RATE_PCT = readPositiveNumber(process.env.PAYMENT_ALERT_MIN_PAID_FROM_CHECKOUT_RATE_PCT, 35);
const ALERT_MAX_CALLBACK_PENDING_RATE_PCT = readPositiveNumber(process.env.PAYMENT_ALERT_MAX_CALLBACK_PENDING_RATE_PCT, 40);
const ALERT_MAX_WEBHOOK_TECH_ERROR_COUNT = readPositiveNumber(process.env.PAYMENT_ALERT_MAX_WEBHOOK_TECH_ERROR_COUNT, 3);
const ALERT_MAX_WEBHOOK_TECH_ERROR_RATE_PCT = readPositiveNumber(process.env.PAYMENT_ALERT_MAX_WEBHOOK_TECH_ERROR_RATE_PCT, 10);
const ALERT_MIN_SAMPLE_SIZE = readPositiveNumber(process.env.PAYMENT_ALERT_MIN_SAMPLE_SIZE, 8);

function safeRate(numerator, denominator) {
  const n = Number(numerator || 0);
  const d = Number(denominator || 0);
  if (!d) return 0;
  return Math.round((100 * n) / d);
}

export function buildPaymentPipelineFromCounts(counts = {}) {
  const initStarted = Number(counts.initStarted || 0);
  const checkoutCreated = Number(counts.checkoutCreated || 0);
  const initFailed = Number(counts.initFailed || 0);
  const callbackSuccess = Number(counts.callbackSuccess || 0);
  const callbackPending = Number(counts.callbackPending || 0);
  const callbackFailed = Number(counts.callbackFailed || 0);
  const callbackCanceled = Number(counts.callbackCanceled || 0);
  const webhookProcessed = Number(counts.webhookProcessed || 0);
  const webhookPaid = Number(counts.webhookPaid || 0);
  const webhookFailed = Number(counts.webhookFailed || 0);
  const webhookCanceled = Number(counts.webhookCanceled || 0);
  const webhookRefunded = Number(counts.webhookRefunded || 0);
  const webhookError = Number(counts.webhookError || 0);
  const webhookInvalidSignature = Number(counts.webhookInvalidSignature || 0);
  const webhookInvalidPayload = Number(counts.webhookInvalidPayload || 0);
  const webhookRateLimited = Number(counts.webhookRateLimited || 0);

  const callbackTotal = callbackSuccess + callbackPending + callbackFailed + callbackCanceled;
  const webhookTechErrorCount = webhookError + webhookInvalidSignature + webhookInvalidPayload + webhookRateLimited;

  return {
    initStarted,
    checkoutCreated,
    initFailed,
    callbackSuccess,
    callbackPending,
    callbackFailed,
    callbackCanceled,
    webhookProcessed,
    webhookPaid,
    webhookFailed,
    webhookCanceled,
    webhookRefunded,
    webhookError,
    webhookInvalidSignature,
    webhookInvalidPayload,
    webhookRateLimited,
    webhookTechErrorCount,
    checkoutCreateRatePct: safeRate(checkoutCreated, initStarted),
    paidFromCheckoutRatePct: safeRate(webhookPaid, checkoutCreated),
    callbackSuccessFromCheckoutRatePct: safeRate(callbackSuccess, checkoutCreated),
    callbackPendingRatePct: safeRate(callbackPending, callbackTotal),
    webhookTechErrorRatePct: safeRate(webhookTechErrorCount, webhookProcessed)
  };
}

export function buildPaymentAlerts(pipeline = {}) {
  const alerts = [];
  const checkoutCreated = Number(pipeline.checkoutCreated || 0);
  const callbacksTotal = Number(
    (pipeline.callbackSuccess || 0) +
      (pipeline.callbackPending || 0) +
      (pipeline.callbackFailed || 0) +
      (pipeline.callbackCanceled || 0)
  );
  const webhookProcessed = Number(pipeline.webhookProcessed || 0);
  const techErrorCount = Number(pipeline.webhookTechErrorCount || 0);

  if (checkoutCreated >= ALERT_MIN_SAMPLE_SIZE && Number(pipeline.checkoutCreateRatePct || 0) < ALERT_MIN_CHECKOUT_CREATE_RATE_PCT) {
    alerts.push({
      code: "checkout_create_rate_low",
      severity: "warning",
      value: Number(pipeline.checkoutCreateRatePct || 0),
      threshold: ALERT_MIN_CHECKOUT_CREATE_RATE_PCT
    });
  }

  if (checkoutCreated >= ALERT_MIN_SAMPLE_SIZE && Number(pipeline.paidFromCheckoutRatePct || 0) < ALERT_MIN_PAID_FROM_CHECKOUT_RATE_PCT) {
    alerts.push({
      code: "paid_conversion_low",
      severity: "warning",
      value: Number(pipeline.paidFromCheckoutRatePct || 0),
      threshold: ALERT_MIN_PAID_FROM_CHECKOUT_RATE_PCT
    });
  }

  if (checkoutCreated >= ALERT_MIN_SAMPLE_SIZE && webhookProcessed === 0) {
    alerts.push({
      code: "webhook_missing_after_checkout",
      severity: "critical",
      value: checkoutCreated
    });
  }

  if (callbacksTotal >= ALERT_MIN_SAMPLE_SIZE && Number(pipeline.callbackPendingRatePct || 0) > ALERT_MAX_CALLBACK_PENDING_RATE_PCT) {
    alerts.push({
      code: "callback_pending_high",
      severity: "warning",
      value: Number(pipeline.callbackPendingRatePct || 0),
      threshold: ALERT_MAX_CALLBACK_PENDING_RATE_PCT
    });
  }

  if (techErrorCount >= ALERT_MAX_WEBHOOK_TECH_ERROR_COUNT) {
    alerts.push({
      code: "webhook_error_spike",
      severity: "critical",
      value: techErrorCount,
      threshold: ALERT_MAX_WEBHOOK_TECH_ERROR_COUNT
    });
  }

  if (webhookProcessed >= ALERT_MIN_SAMPLE_SIZE && Number(pipeline.webhookTechErrorRatePct || 0) > ALERT_MAX_WEBHOOK_TECH_ERROR_RATE_PCT) {
    alerts.push({
      code: "webhook_error_rate_high",
      severity: "critical",
      value: Number(pipeline.webhookTechErrorRatePct || 0),
      threshold: ALERT_MAX_WEBHOOK_TECH_ERROR_RATE_PCT
    });
  }

  return alerts;
}
