import { serviceAvailabilityFingerprint } from "./serviceAvailability.server.js";

function fail(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function clean(value, maxLength = 200) {
  return String(value || "").trim().slice(0, maxLength);
}

export async function confirmServiceAvailabilityRecord({
  db,
  ownerId,
  serviceId,
  expectedFingerprint,
  now = new Date(),
  profileInclude
}) {
  if (!ownerId) throw fail("api.common.unauthorized", 401);
  const normalizedServiceId = clean(serviceId, 120);
  const fingerprint = clean(expectedFingerprint, 200);
  if (!normalizedServiceId || !fingerprint) {
    throw fail("service_provider_profile.errors.availability_confirmation_invalid", 400);
  }

  const current = await db.serviceProviderService.findFirst({
    where: {
      id: normalizedServiceId,
      // ORGANIZATION-režiimis on ownerId ainult päritolu, mitte ligipääsuõigus.
      providerProfile: { ownerId, ownershipMode: "SOLO" }
    }
  });
  if (!current) throw fail("service_provider_profile.errors.service_not_found", 404);
  const currentFingerprint = serviceAvailabilityFingerprint(current);
  if (!currentFingerprint || currentFingerprint !== fingerprint) {
    throw fail("service_provider_profile.errors.availability_conflict", 409);
  }

  const checkedAt = now instanceof Date ? now : new Date();
  const result = await db.serviceProviderService.updateMany({
    where: {
      id: current.id,
      providerProfileId: current.providerProfileId,
      // Korda õiguse piiri tingimuslikul kirjutusel: profiil võis esimese
      // lugemise järel organisatsioonile üle minna.
      providerProfile: { ownerId, ownershipMode: "SOLO" },
      availabilityStatus: current.availabilityStatus,
      availabilityDescription: current.availabilityDescription
    },
    data: {
      availabilityCheckedAt: checkedAt,
      availabilityReminderSentAt: null
    }
  });
  if (result.count !== 1) throw fail("service_provider_profile.errors.availability_conflict", 409);

  return db.serviceProviderProfile.findUnique({
    where: { id: current.providerProfileId },
    ...(profileInclude ? { include: profileInclude } : {})
  });
}
