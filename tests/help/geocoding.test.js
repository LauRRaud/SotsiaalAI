import test from "node:test";
import assert from "node:assert/strict";

import { geocodePlace } from "../../lib/help/geocoding.js";

const originalFetch = globalThis.fetch;
const originalProvider = process.env.HELP_GEOCODER_PROVIDER;
const originalServiceMapProvider = process.env.SERVICE_MAP_GEOCODER_PROVIDER;
const originalBaseUrl = process.env.HELP_GEOCODER_BASE_URL;

function restoreEnv() {
  if (originalProvider === undefined) delete process.env.HELP_GEOCODER_PROVIDER;
  else process.env.HELP_GEOCODER_PROVIDER = originalProvider;
  if (originalServiceMapProvider === undefined) delete process.env.SERVICE_MAP_GEOCODER_PROVIDER;
  else process.env.SERVICE_MAP_GEOCODER_PROVIDER = originalServiceMapProvider;
  if (originalBaseUrl === undefined) delete process.env.HELP_GEOCODER_BASE_URL;
  else process.env.HELP_GEOCODER_BASE_URL = originalBaseUrl;
  globalThis.fetch = originalFetch;
}

test.afterEach(restoreEnv);

test("help geocoder supports Maa- ja Ruumiamet In-AKS provider", async () => {
  process.env.HELP_GEOCODER_PROVIDER = "maaruum";
  process.env.HELP_GEOCODER_BASE_URL = "https://aks.geoportaal.ee/inaks/inaadress/gazetteer";
  globalThis.fetch = async (url, options) => {
    assert.equal(url.searchParams.get("address"), "Suur-Sepa 16, Parnu");
    assert.equal(options.headers.Accept, "application/json");
    return Response.json({
      addresses: [
        {
          omavalitsus: "Parnu linn",
          maakond: "Parnu maakond",
          ipikkaadress: "Suur-Sepa tn 16, Parnu linn, Parnu linn, Parnu maakond",
          viitepunkt_b: "58.382345",
          viitepunkt_l: "24.510193",
          kvaliteet: "tapne_nr",
          primary: "true"
        }
      ]
    });
  };

  const result = await geocodePlace("Suur-Sepa 16, Parnu");

  assert.equal(result.provider, "maaruum");
  assert.equal(result.municipalityDisplayName, "Parnu linn");
  assert.equal(result.county, "Parnu maakond");
  assert.equal(result.confidence, "high");
  assert.equal(result.latitude, 58.382345);
  assert.equal(result.longitude, 24.510193);
  assert.ok(result.candidateStrings.includes("Parnu linn"));
});

test("help geocoder supports Maa- ja Ruumiamet provider aliases", async () => {
  process.env.HELP_GEOCODER_PROVIDER = "inaks";
  globalThis.fetch = async () => Response.json({
    addresses: [
      {
        omavalitsus: "Tartu linn",
        pikkaadress: "Tartu maakond, Tartu linn",
        viitepunkt_b: 58.3776,
        viitepunkt_l: 26.729
      }
    ]
  });

  const result = await geocodePlace("Tartu");

  assert.equal(result.provider, "maaruum");
  assert.equal(result.municipalityDisplayName, "Tartu linn");
});

test("help geocoder can use service map provider configuration", async () => {
  delete process.env.HELP_GEOCODER_PROVIDER;
  process.env.SERVICE_MAP_GEOCODER_PROVIDER = "maaruum";
  globalThis.fetch = async () => Response.json({
    addresses: [
      {
        omavalitsus: "Harku vald",
        pikkaadress: "Muraste kyla, Harku vald, Harju maakond",
        viitepunkt_b: 59.458,
        viitepunkt_l: 24.441
      }
    ]
  });

  const result = await geocodePlace("Muraste");

  assert.equal(result.provider, "maaruum");
  assert.equal(result.municipalityDisplayName, "Harku vald");
});
