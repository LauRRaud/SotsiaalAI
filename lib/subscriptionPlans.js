export const DEFAULT_SOCIAL_WORKER_AMOUNT = 14.99;
export const DEFAULT_SERVICE_PROVIDER_AMOUNT = 19.99;
export const DEFAULT_CLIENT_AMOUNT = 7.99;
export const DEFAULT_SPONSORED_INVITE_AMOUNT = 4;
const DEFAULT_USAGE_ALLOWANCE_SOFTENING = 0.5;
const DEFAULT_USAGE_ALLOWANCE_CAP = 1.8;
const DEFAULT_USAGE_ALLOWANCE_MIN_INCREASE_SHARE = 0.1;

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function normalizeSubscriptionRole(role) {
  const normalized = String(role || "").trim().toUpperCase();
  if (normalized === "SOCIAL_WORKER") return "SOCIAL_WORKER";
  if (normalized === "SERVICE_PROVIDER") return "SERVICE_PROVIDER";
  return "CLIENT";
}

export function getRolePlanKey(role) {
  const normalizedRole = normalizeSubscriptionRole(role);
  if (normalizedRole === "SERVICE_PROVIDER") return "service_provider_monthly";
  return normalizedRole === "SOCIAL_WORKER" ? "social_worker_monthly" : "client_monthly";
}

export function getRoleMonthlyAmount(role) {
  const generalAmount = Number(process.env.SUBSCRIPTION_MONTHLY_AMOUNT);
  const hasGeneralAmount = Number.isFinite(generalAmount) && generalAmount > 0;

  if (normalizeSubscriptionRole(role) === "SOCIAL_WORKER") {
    return toNumber(
      process.env.SUBSCRIPTION_MONTHLY_AMOUNT_SOCIAL_WORKER,
      hasGeneralAmount ? generalAmount : DEFAULT_SOCIAL_WORKER_AMOUNT
    );
  }

  if (normalizeSubscriptionRole(role) === "SERVICE_PROVIDER") {
    return toNumber(
      process.env.SUBSCRIPTION_MONTHLY_AMOUNT_SERVICE_PROVIDER,
      hasGeneralAmount ? generalAmount : DEFAULT_SERVICE_PROVIDER_AMOUNT
    );
  }

  return toNumber(
    process.env.SUBSCRIPTION_MONTHLY_AMOUNT_CLIENT,
    hasGeneralAmount ? generalAmount : DEFAULT_CLIENT_AMOUNT
  );
}

export function getSponsoredInviteAmount(role) {
  const generalAmount = Number(process.env.INVITE_SPONSORED_AMOUNT);
  const hasGeneralAmount = Number.isFinite(generalAmount) && generalAmount > 0;

  if (normalizeSubscriptionRole(role) === "SOCIAL_WORKER") {
    return toNumber(
      process.env.INVITE_SPONSORED_AMOUNT_SOCIAL_WORKER,
      hasGeneralAmount ? generalAmount : DEFAULT_SPONSORED_INVITE_AMOUNT
    );
  }

  if (normalizeSubscriptionRole(role) === "SERVICE_PROVIDER") {
    return toNumber(
      process.env.INVITE_SPONSORED_AMOUNT_SERVICE_PROVIDER,
      hasGeneralAmount ? generalAmount : DEFAULT_SPONSORED_INVITE_AMOUNT
    );
  }

  return toNumber(
    process.env.INVITE_SPONSORED_AMOUNT_CLIENT,
    hasGeneralAmount ? generalAmount : DEFAULT_SPONSORED_INVITE_AMOUNT
  );
}

export function getRoleReferenceMonthlyAmount(role) {
  const normalizedRole = normalizeSubscriptionRole(role);
  if (normalizedRole === "SOCIAL_WORKER") return DEFAULT_SOCIAL_WORKER_AMOUNT;
  if (normalizedRole === "SERVICE_PROVIDER") return DEFAULT_SERVICE_PROVIDER_AMOUNT;
  return DEFAULT_CLIENT_AMOUNT;
}

export function getRoleUsageAllowanceMultiplier(role, options = {}) {
  const normalizedRole = normalizeSubscriptionRole(role);
  const currentAmount = getRoleMonthlyAmount(normalizedRole);
  const referenceAmount = getRoleReferenceMonthlyAmount(normalizedRole);
  const softening = toNumber(options.softening, DEFAULT_USAGE_ALLOWANCE_SOFTENING);
  const cap = toNumber(options.cap, DEFAULT_USAGE_ALLOWANCE_CAP);
  const minIncreaseShare = toNumber(options.minIncreaseShare, DEFAULT_USAGE_ALLOWANCE_MIN_INCREASE_SHARE);

  if (!(referenceAmount > 0) || !(currentAmount > referenceAmount)) return 1;

  const increaseShare = (currentAmount - referenceAmount) / referenceAmount;
  if (increaseShare < minIncreaseShare) return 1;
  const softenedMultiplier = 1 + increaseShare * Math.min(1, softening);
  return Math.max(1, Math.min(cap, softenedMultiplier));
}

export function getRolePlanDescription(role, locale = "et") {
  const effectiveRole = normalizeSubscriptionRole(role);

  switch (locale) {
    case "et":
      if (effectiveRole === "SERVICE_PROVIDER") {
        return "SotsiaalAI teenuseosutaja kuutellimus";
      }
      return effectiveRole === "SOCIAL_WORKER"
        ? "SotsiaalAI sotsiaaltöö spetsialisti kuutellimus"
        : "SotsiaalAI eluküsimusega pöörduja kuutellimus";
    case "ru":
      if (effectiveRole === "SERVICE_PROVIDER") {
        return "SotsiaalAI: ежемесячная подписка для поставщика услуг";
      }
      return effectiveRole === "SOCIAL_WORKER"
        ? "SotsiaalAI: ежемесячная подписка для специалиста по социальной работе"
        : "SotsiaalAI: ежемесячная подписка для человека, ищущего помощь";
    default:
      if (effectiveRole === "SERVICE_PROVIDER") {
        return "SotsiaalAI monthly subscription for service providers";
      }
      return effectiveRole === "SOCIAL_WORKER"
        ? "SotsiaalAI monthly subscription for social work specialists"
        : "SotsiaalAI monthly subscription for people seeking help";
  }
}

export function formatEuroAmount(amount, locale = "et") {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  } catch {
    return `${Number(amount || 0).toFixed(2)} EUR`;
  }
}
