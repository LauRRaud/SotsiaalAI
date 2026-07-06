export function isSubscriptionActive(subscription, now = new Date()) {
  if (!subscription) return false;

  if (String(subscription.status || "").toUpperCase() !== "ACTIVE") {
    return false;
  }

  if (!subscription.validUntil) {
    return true;
  }

  const validUntil = new Date(subscription.validUntil);
  if (Number.isNaN(validUntil.getTime())) {
    return false;
  }

  return validUntil.getTime() > now.getTime();
}
