import test from "node:test";
import assert from "node:assert/strict";

import { splitServiceLocationMapEntries } from "../../lib/serviceProviderServiceLocations.js";

test("service provider map marker represents a location with linked services", () => {
  const entries = splitServiceLocationMapEntries({
    id: "provider-entry",
    title: "Teenuseosutaja",
    providerProfile: {
      id: "profile-1",
      serviceLocations: [
        {
          id: "loc-1",
          label: "Kesklinna vastuvõtt",
          normalizedAddress: "Tamme tn 1, Tallinn",
          latitude: 59.4,
          longitude: 24.7,
          geocodingStatus: "MATCHED",
          serviceLinks: [
            { providerService: { id: "service-1", name: "Nõustamine" } },
            { providerService: { id: "service-2", name: "Koduteenus" } }
          ]
        }
      ]
    }
  });

  assert.equal(entries.length, 1);
  assert.equal(entries[0].providerLocationId, "loc-1");
  assert.equal(entries[0].normalizedAddress, "Tamme tn 1, Tallinn");
  assert.deepEqual(entries[0].providerProfile.serviceItems.map((service) => service.name), ["Nõustamine", "Koduteenus"]);
  assert.deepEqual(entries[0].providerProfile.serviceLocations.map((location) => location.id), ["loc-1"]);
});

test("service provider map creates one marker per published confirmed location", () => {
  const entries = splitServiceLocationMapEntries({
    id: "provider-entry",
    title: "Teenuseosutaja",
    providerProfile: {
      id: "profile-1",
      serviceItems: [{ id: "fallback", name: "Üldteenus" }],
      serviceLocations: [
        {
          id: "loc-1",
          normalizedAddress: "Tamme tn 1, Tallinn",
          latitude: 59.4,
          longitude: 24.7,
          geocodingStatus: "MATCHED"
        },
        {
          id: "loc-2",
          normalizedAddress: "Pargi tn 2, Tallinn",
          latitude: 59.41,
          longitude: 24.71,
          geocodingStatus: "MATCHED"
        },
        {
          id: "hidden",
          normalizedAddress: "Peidetud tn 3, Tallinn",
          latitude: 59.42,
          longitude: 24.72,
          geocodingStatus: "MATCHED",
          mapVisible: false
        }
      ]
    }
  });

  assert.equal(entries.length, 2);
  assert.deepEqual(entries.map((entry) => entry.normalizedAddress), ["Tamme tn 1, Tallinn", "Pargi tn 2, Tallinn"]);
  assert.equal(entries[0].providerProfile.serviceItems[0].name, "Üldteenus");
});

test("service provider location entry prefers service contact over location and organization contact", () => {
  const entries = splitServiceLocationMapEntries({
    id: "provider-entry",
    title: "Teenuseosutaja",
    phone: "org-phone",
    email: "org@example.test",
    website: "https://org.example.test",
    providerProfile: {
      id: "profile-1",
      serviceLocations: [
        {
          id: "loc-1",
          phone: "location-phone",
          email: "location@example.test",
          website: "https://location.example.test",
          normalizedAddress: "Tamme tn 1, Tallinn",
          latitude: 59.4,
          longitude: 24.7,
          geocodingStatus: "MATCHED",
          serviceLinks: [
            {
              providerService: {
                id: "service-1",
                name: "Noustamine",
                contactName: "Teenuse kontakt",
                phone: "service-phone",
                email: "service@example.test",
                website: "https://service.example.test"
              }
            }
          ]
        }
      ]
    }
  });

  assert.equal(entries.length, 1);
  assert.equal(entries[0].contactName, "Teenuse kontakt");
  assert.equal(entries[0].phone, "service-phone");
  assert.equal(entries[0].email, "service@example.test");
  assert.equal(entries[0].website, "https://service.example.test");
});

test("service provider map does not fall back to provider marker when locations are hidden", () => {
  const entries = splitServiceLocationMapEntries({
    id: "provider-entry",
    title: "Teenuseosutaja",
    normalizedAddress: "Avalik tn 1, Tallinn",
    latitude: 59.4,
    longitude: 24.7,
    providerProfile: {
      id: "profile-1",
      serviceLocations: [
        {
          id: "hidden",
          normalizedAddress: "Peidetud tn 3, Tallinn",
          latitude: 59.42,
          longitude: 24.72,
          geocodingStatus: "MATCHED",
          mapVisible: false
        }
      ]
    }
  });

  assert.equal(entries.length, 0);
});
