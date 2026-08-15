import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  assertServiceProviderProfileInputLimits,
  preserveServiceProviderChildStatus,
  sanitizeServiceProviderProfileRagMetadata,
  validateServiceProviderProfilePublication
} from "../../lib/serviceProviderProfilePolicy.js";
import { serviceProviderProfileErrorDescriptor } from "../../lib/serviceProviderProfileBoundary.js";
import { formatLicenceRetryAfter } from "../../lib/mtr/licenceCooldown.js";

const profileSource = fs.readFileSync(new URL("../../lib/serviceProviderProfiles.js", import.meta.url), "utf8");
const profileRouteSource = fs.readFileSync(new URL("../../app/api/service-provider/profile/route.js", import.meta.url), "utf8");
const availabilityRouteSource = fs.readFileSync(
  new URL("../../app/api/service-provider/profile/services/[serviceId]/availability-confirmation/route.js", import.meta.url),
  "utf8"
);
const licenceRouteSource = fs.readFileSync(new URL("../../app/api/service-provider/profile/licence-check/route.js", import.meta.url), "utf8");
const addressRouteSource = fs.readFileSync(new URL("../../app/api/service-map/address-suggestions/route.js", import.meta.url), "utf8");
const uiSource = fs.readFileSync(new URL("../../components/workspace/WorkspaceFeaturePage.jsx", import.meta.url), "utf8");

function baseProfile(overrides = {}) {
  return { organizationName: "Piiriprofiil", status: "DRAFT", ...overrides };
}

test("SPROF-09: text and row limits reject limit+1 instead of truncating", () => {
  assert.doesNotThrow(() => assertServiceProviderProfileInputLimits(baseProfile({ organizationType: "x".repeat(999) })));
  assert.doesNotThrow(() => assertServiceProviderProfileInputLimits(baseProfile({ organizationType: "x".repeat(1000) })));
  assert.throws(
    () => assertServiceProviderProfileInputLimits(baseProfile({ organizationType: `TAIL-${"x".repeat(996)}` })),
    (error) => error?.status === 413 && error?.message === "service_provider_profile.errors.field_too_long"
  );

  for (const count of [49, 50]) {
    assert.doesNotThrow(() => assertServiceProviderProfileInputLimits(
      baseProfile({ languages: Array.from({ length: count }, (_, index) => `k${index}`) })
    ));
  }
  assert.throws(
    () => assertServiceProviderProfileInputLimits(baseProfile({ languages: Array.from({ length: 51 }, (_, index) => `k${index}`) })),
    (error) => error?.status === 413 && error?.message === "service_provider_profile.errors.too_many_list_items"
  );

  const services = Array.from({ length: 41 }, (_, index) => ({ name: `Teenus ${index + 1}` }));
  for (const count of [39, 40]) {
    assert.doesNotThrow(() => assertServiceProviderProfileInputLimits(baseProfile({
      serviceItems: services.slice(0, count)
    })));
  }
  assert.throws(
    () => assertServiceProviderProfileInputLimits(baseProfile({ serviceItems: services })),
    (error) => error?.status === 413 && error?.message === "service_provider_profile.errors.too_many_services"
  );
  const locations = Array.from({ length: 31 }, (_, index) => ({ label: `Koht ${index + 1}` }));
  for (const count of [29, 30]) {
    assert.doesNotThrow(() => assertServiceProviderProfileInputLimits(baseProfile({
      serviceLocations: locations.slice(0, count)
    })));
  }
  assert.throws(
    () => assertServiceProviderProfileInputLimits(baseProfile({ serviceLocations: locations })),
    (error) => error?.status === 413 && error?.message === "service_provider_profile.errors.too_many_locations"
  );
});

test("SPROF-09: UI exposes limits and disables additions at the server boundary", () => {
  assert.match(uiSource, /SERVICE_PROFILE_LIMITS/u);
  assert.match(uiSource, /maxLength=/u);
  assert.match(uiSource, /serviceItems\.length\s*>=\s*SERVICE_PROFILE_LIMITS\.services/u);
  assert.match(uiSource, /serviceLocations\.length\s*>=\s*SERVICE_PROFILE_LIMITS\.locations/u);
});

test("SPROF-10: profile and availability routes never return arbitrary thrown messages", () => {
  assert.doesNotMatch(profileRouteSource, /error\?\.message\s*\|\|\s*"service_provider_profile\.errors\.save_failed"/u);
  assert.doesNotMatch(availabilityRouteSource, /error\?\.message\s*\|\|\s*"service_provider_profile\.errors\.availability_confirmation_failed"/u);
  assert.match(profileRouteSource, /correlationId/u);
  assert.match(availabilityRouteSource, /correlationId/u);
  assert.match(uiSource, /payload\?\.correlationId/u);
  const secret = "UNIQUE_DATABASE_SECRET_MARKER";
  const descriptor = serviceProviderProfileErrorDescriptor(new Error(secret), "service_provider_profile.errors.save_failed", "corr-12345678");
  assert.deepEqual(descriptor, {
    status: 500,
    messageKey: "service_provider_profile.errors.save_failed",
    extras: { correlationId: "corr-12345678" }
  });
  assert.doesNotMatch(JSON.stringify(descriptor), new RegExp(secret, "u"));
  const unsafeClientError = Object.assign(new Error(secret), { status: 400 });
  const safeClientDescriptor = serviceProviderProfileErrorDescriptor(
    unsafeClientError,
    "service_provider_profile.errors.save_failed",
    "corr-12345678"
  );
  assert.equal(safeClientDescriptor.messageKey, "service_provider_profile.errors.invalid_request");
  assert.doesNotMatch(JSON.stringify(safeClientDescriptor), new RegExp(secret, "u"));
  const serializedMetadata = sanitizeServiceProviderProfileRagMetadata({
    syncStatus: "failed",
    message: secret,
    internalStack: secret
  });
  assert.equal(serializedMetadata.syncStatus, "failed");
  assert.doesNotMatch(JSON.stringify(serializedMetadata), new RegExp(secret, "u"));
});

test("SPROF-11/12: save transaction contains contentless transition audit and idempotency receipt", () => {
  assert.match(profileSource, /SERVICE_PROVIDER_PROFILE_PUBLICATION_CONSENT_CHANGED/u);
  assert.match(profileSource, /SERVICE_PROVIDER_PROFILE_SAVE_ACCEPTED/u);
  assert.match(profileSource, /domainEvent\.create/u);
  assert.match(profileSource, /idempotencyKey/u);
  assert.match(profileSource, /requestHash/u);
  assert.doesNotMatch(profileSource, /meta:\s*\{[^}]*description/su);
});

test("SPROF-12: every profile operation uses a shared durable operation limiter", () => {
  assert.match(profileRouteSource, /consumeServiceProviderProfileRateLimit/u);
  assert.match(availabilityRouteSource, /consumeServiceProviderProfileRateLimit/u);
  assert.match(profileRouteSource, /Idempotency-Key/ui);
  assert.match(addressRouteSource, /consumeHelpRateLimit/u);
  assert.match(addressRouteSource, /SERVICE_PROFILE_LIMITS\.addressQuery/u);
});

test("SPROF-13: cooldown response has Retry-After and UI uses localized date and time", () => {
  assert.match(licenceRouteSource, /Retry-After/u);
  assert.doesNotMatch(uiSource, /status:\s*form\.status === "PUBLISHED" \? "PUBLISHED" : "DRAFT"/u);
  const licenceUi = fs.readFileSync(new URL("../../lib/mtr/licenceCooldown.js", import.meta.url), "utf8");
  assert.match(licenceUi, /dateStyle:\s*"long"[\s\S]*timeStyle:/u);
  assert.doesNotMatch(licenceUi, /toLocaleString\("et-EE"/u);
  const boundaryBefore = "2026-03-29T00:30:00.000Z";
  const boundaryAfter = "2026-03-29T01:30:00.000Z";
  const sameDayRetry = "2026-08-13T12:15:00.000Z";
  const nextDayRetry = "2026-08-14T00:15:00.000Z";
  for (const locale of ["et", "en", "ru"]) {
    assert.match(formatLicenceRetryAfter(boundaryBefore, locale), /02[:.]30/u);
    assert.match(formatLicenceRetryAfter(boundaryAfter, locale), /04[:.]30/u);
    assert.match(formatLicenceRetryAfter(sameDayRetry, locale), /15[:.]15/u);
    assert.match(formatLicenceRetryAfter(nextDayRetry, locale), /03[:.]15/u);
    assert.notEqual(
      formatLicenceRetryAfter(sameDayRetry, locale),
      formatLicenceRetryAfter(nextDayRetry, locale)
    );
  }
});

test("SPROF-14/15: child status is preserved and publish contract is enforced on server and UI", () => {
  assert.match(profileSource, /validateServiceProviderProfilePublication/u);
  assert.match(profileSource, /existingLocationsById/u);
  assert.match(uiSource, /publishContractErrors/u);
  assert.match(uiSource, /status:\s*item\.status/u);
  assert.match(uiSource, /service_items\.status/u);
  assert.match(uiSource, /locations\.status/u);

  assert.equal(
    preserveServiceProviderChildStatus({ id: "service-hidden", status: "HIDDEN" }, "PUBLISHED"),
    "HIDDEN"
  );
  assert.equal(
    preserveServiceProviderChildStatus({ id: "location-hidden", status: "HIDDEN" }, "PUBLISHED"),
    "HIDDEN"
  );
  assert.equal(
    preserveServiceProviderChildStatus({ id: "service-published", status: "PUBLISHED" }, "HIDDEN"),
    "HIDDEN"
  );
  assert.equal(
    preserveServiceProviderChildStatus({ id: "location-published", status: "PUBLISHED" }, "DRAFT"),
    "DRAFT"
  );

  assert.throws(
    () => validateServiceProviderProfilePublication({ status: "PUBLISHED" }, []),
    (error) => error?.message === "service_provider_profile.errors.publish_service_required"
  );
  const publishedService = { name: "Nõustamine", status: "PUBLISHED", mapVisible: true, acceptsPlatformPreInquiries: false };
  assert.throws(
    () => validateServiceProviderProfilePublication({ status: "PUBLISHED" }, [publishedService]),
    (error) => error?.message === "service_provider_profile.errors.publish_contact_required"
  );
  assert.doesNotThrow(() => validateServiceProviderProfilePublication({
    status: "PUBLISHED",
    acceptsPlatformPreInquiries: true
  }, [publishedService]));
});
