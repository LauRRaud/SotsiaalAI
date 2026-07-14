import { createHash } from "node:crypto";

import {
  canonicalServiceAvailabilityStatus,
  isCanonicalServiceAvailabilityStatus,
  normalizeServiceAvailabilityDescription
} from "./serviceAvailability.js";

export function serviceAvailabilityFingerprint(service = {}) {
  if (!service?.id || !isCanonicalServiceAvailabilityStatus(service.availabilityStatus)) return null;
  const payload = JSON.stringify([
    String(service.id),
    canonicalServiceAvailabilityStatus(service.availabilityStatus, { includeLegacy: false }),
    normalizeServiceAvailabilityDescription(service.availabilityDescription)
  ]);
  return createHash("sha256").update(payload, "utf8").digest("base64url");
}
