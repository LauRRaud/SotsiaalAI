import test from "node:test";
import assert from "node:assert/strict";

import {
  projectServiceContactPolicy,
  resolveSelectedServicePolicy
} from "../../lib/serviceMap/contactPolicy.js";

test("service channel flags explicitly override profile flags and null inherits", () => {
  for (const profileValue of [true, false]) {
    for (const serviceValue of [true, false, null]) {
      const policy = projectServiceContactPolicy({
        id: "service",
        acceptsPlatformPreInquiries: serviceValue,
        acceptsEmailPreInquiries: serviceValue,
        directContactAllowed: "Jah",
        email: "service@example.test"
      }, {
        acceptsPlatformPreInquiries: profileValue,
        acceptsEmailPreInquiries: profileValue
      }, { id: "location" });
      const expected = serviceValue ?? profileValue;
      assert.equal(policy.platformAllowed, expected, `platform ${profileValue}/${serviceValue}`);
      assert.equal(policy.emailAllowed, expected, `email ${profileValue}/${serviceValue}`);
    }
  }
});

test("unspecified, no and conditional direct contact never expose one-click contact", () => {
  for (const directContactAllowed of ["", "Ei", "Sõltub olukorrast"]) {
    const policy = projectServiceContactPolicy({
      id: "service",
      directContactAllowed,
      acceptsEmailPreInquiries: true,
      email: "secret@example.test"
    }, {}, { id: "location" });
    assert.equal(policy.emailAllowed, false);
    assert.equal(policy.email, null);
    assert.equal(policy.phone, null);
  }
});

test("a service must belong to the selected public location and profile", () => {
  const entry = {
    type: "SERVICE_PROVIDER",
    providerProfile: {
      acceptsPlatformPreInquiries: true,
      acceptsEmailPreInquiries: true,
      serviceItems: [{ id: "service-a", directContactAllowed: "Jah", email: "a@example.test" }],
      serviceLocations: [{ id: "location-a", serviceLinks: [{ providerServiceId: "service-a" }] }]
    }
  };
  assert.equal(resolveSelectedServicePolicy({ entry, serviceId: "service-a", locationId: "location-a" }).email, "a@example.test");
  assert.equal(resolveSelectedServicePolicy({ entry, serviceId: "foreign", locationId: "location-a" }), null);
  assert.equal(resolveSelectedServicePolicy({ entry, serviceId: "service-a", locationId: "foreign" }), null);
});
