import test from "node:test";
import assert from "node:assert/strict";

import { geocodeServiceMapAddress, suggestServiceMapAddresses } from "../../lib/serviceMap/geocoding.js";

const originalFetch = globalThis.fetch;
const originalProvider = process.env.SERVICE_MAP_GEOCODER_PROVIDER;
const originalBaseUrl = process.env.SERVICE_MAP_GEOCODER_BASE_URL;

function restoreEnv() {
  if (originalProvider === undefined) delete process.env.SERVICE_MAP_GEOCODER_PROVIDER;
  else process.env.SERVICE_MAP_GEOCODER_PROVIDER = originalProvider;
  if (originalBaseUrl === undefined) delete process.env.SERVICE_MAP_GEOCODER_BASE_URL;
  else process.env.SERVICE_MAP_GEOCODER_BASE_URL = originalBaseUrl;
  globalThis.fetch = originalFetch;
}

test.afterEach(restoreEnv);

test("Maa- ja Ruumiamet suggestions expose selectable official address candidates", async () => {
  process.env.SERVICE_MAP_GEOCODER_PROVIDER = "maaruum";
  const queries = [];
  globalThis.fetch = async (url, options) => {
    queries.push(url.searchParams.get("address"));
    assert.equal(options.headers.Accept, "application/json");
    return Response.json({
      addresses: [
        {
          ipikkaadress: "Teenuste tn 2, Tabasalu alevik, Harku vald, Harju maakond",
          adr_id: "tabasalu-teenuste-2",
          viitepunkt_b: "59.429",
          viitepunkt_l: "24.546",
          kvaliteet: "tapne_lahiaadress"
        }
      ]
    });
  };

  const result = await suggestServiceMapAddresses("Taba", { limit: 5 });

  assert.equal(result.ok, true);
  assert.equal(result.provider, "maaruum");
  assert.deepEqual(queries, ["Taba"]);
  assert.equal(result.suggestions.length, 1);
  assert.equal(result.suggestions[0].normalizedAddress, "Teenuste tn 2, Tabasalu alevik, Harku vald, Harju maakond");
  assert.equal(result.suggestions[0].latitude, 59.429);
  assert.equal(result.suggestions[0].longitude, 24.546);
  assert.equal(result.suggestions[0].adsObjectId, "tabasalu-teenuste-2");
});

test("Maa- ja Ruumiamet provider maps In-AKS Gazetteer address response", async () => {
  process.env.SERVICE_MAP_GEOCODER_PROVIDER = "maaruum";
  process.env.SERVICE_MAP_GEOCODER_BASE_URL = "https://aks.geoportaal.ee/inaks/inaadress/gazetteer";
  globalThis.fetch = async (url, options) => {
    assert.equal(url.searchParams.get("address"), "Suur-Sepa 16, Pärnu");
    assert.equal(options.headers.Accept, "application/json");
    return Response.json({
      addresses: [
        {
          ipikkaadress: "Suur-Sepa tn 16, Pärnu linn, Pärnu linn, Pärnu maakond",
          adr_id: "3072342",
          ads_oid: "ME00706027",
          viitepunkt_b: "58.382345",
          viitepunkt_l: "24.510193",
          kvaliteet: "tapne_nr",
          primary: "true"
        }
      ]
    });
  };

  const result = await geocodeServiceMapAddress("Suur-Sepa 16, Pärnu");

  assert.equal(result.status, "MATCHED");
  assert.equal(result.provider, "maaruum");
  assert.equal(result.normalizedAddress, "Suur-Sepa tn 16, Pärnu linn, Pärnu linn, Pärnu maakond");
  assert.equal(result.latitude, 58.382345);
  assert.equal(result.longitude, 24.510193);
  assert.equal(result.adsObjectId, "3072342");
});

test("Maa- ja Ruumiamet aliases use the same provider adapter", async () => {
  process.env.SERVICE_MAP_GEOCODER_PROVIDER = "inaks";
  globalThis.fetch = async () => Response.json({
    addresses: [
      {
        pikkaadress: "Pärnu maakond, Pärnu linn, Pärnu linn, Suur-Sepa tn 16",
        adr_id: "3072342",
        viitepunkt_b: 58.382345,
        viitepunkt_l: 24.510193
      }
    ]
  });

  const result = await geocodeServiceMapAddress("Suur-Sepa 16, Pärnu");

  assert.equal(result.status, "MATCHED");
  assert.equal(result.provider, "maaruum");
});

test("Maa- ja Ruumiamet provider keeps multiple valid matches ambiguous", async () => {
  process.env.SERVICE_MAP_GEOCODER_PROVIDER = "maaamet";
  globalThis.fetch = async () => Response.json({
    addresses: [
      {
        pikkaadress: "Harju maakond, Tallinn, Testi tn 1",
        adr_id: "1",
        viitepunkt_b: 59.4,
        viitepunkt_l: 24.7
      },
      {
        pikkaadress: "Tartu maakond, Tartu linn, Testi tn 1",
        adr_id: "2",
        viitepunkt_b: 58.4,
        viitepunkt_l: 26.7
      }
    ]
  });

  const result = await geocodeServiceMapAddress("Testi 1");

  assert.equal(result.status, "AMBIGUOUS");
  assert.equal(result.raw.candidates.length, 2);
});

test("Maa- ja Ruumiamet provider accepts one exact match among weaker candidates", async () => {
  process.env.SERVICE_MAP_GEOCODER_PROVIDER = "maaruum";
  globalThis.fetch = async () => Response.json({
    addresses: [
      {
        ipikkaadress: "Kesk tn 32, Elva linn, Elva vald, Tartu maakond",
        adr_id: "3007376",
        viitepunkt_b: 58.223805,
        viitepunkt_l: 26.417831,
        kvaliteet: "tapne_nr",
        primary: "true"
      },
      {
        ipikkaadress: "Kesk tn 32a, Elva linn, Elva vald, Tartu maakond",
        adr_id: "3018890",
        viitepunkt_b: 58.223898,
        viitepunkt_l: 26.417207,
        kvaliteet: "sihtnumber",
        primary: "true"
      }
    ]
  });

  const result = await geocodeServiceMapAddress("Kesk 32, Elva, 61507");

  assert.equal(result.status, "MATCHED");
  assert.equal(result.normalizedAddress, "Kesk tn 32, Elva linn, Elva vald, Tartu maakond");
  assert.equal(result.adsObjectId, "3007376");
});

test("Maa- ja Ruumiamet provider treats exact short address quality as a match", async () => {
  process.env.SERVICE_MAP_GEOCODER_PROVIDER = "maaruum";
  globalThis.fetch = async () => Response.json({
    addresses: [
      {
        ipikkaadress: "Lossi tn 9, Poltsamaa linn, Poltsamaa vald, Jogeva maakond",
        adr_id: "3381094",
        viitepunkt_b: 58.652741,
        viitepunkt_l: 25.97391,
        kvaliteet: "tapne_lahiaadress",
        primary: "true"
      },
      {
        ipikkaadress: "Lossi tn 9a, Poltsamaa linn, Poltsamaa vald, Jogeva maakond",
        adr_id: "3381112",
        viitepunkt_b: 58.652636,
        viitepunkt_l: 25.973749,
        kvaliteet: "sihtnumber",
        primary: "true"
      }
    ]
  });

  const result = await geocodeServiceMapAddress("Lossi tn 9, Poltsamaa linn, Poltsamaa vald, 48104 Jogeva maakond");

  assert.equal(result.status, "MATCHED");
  assert.equal(result.normalizedAddress, "Lossi tn 9, Poltsamaa linn, Poltsamaa vald, Jogeva maakond");
  assert.equal(result.adsObjectId, "3381094");
});

test("Maa- ja Ruumiamet provider treats duplicate ADS candidates as one match", async () => {
  process.env.SERVICE_MAP_GEOCODER_PROVIDER = "maaruum";
  globalThis.fetch = async () => Response.json({
    addresses: [
      {
        ipikkaadress: "Tallinna mnt 13, Haljala alevik, Haljala vald, L\u00e4\u00e4ne-Viru maakond",
        adr_id: "2759695",
        viitepunkt_b: 59.434499,
        viitepunkt_l: 26.261613,
        kvaliteet: "sihtnumber",
        primary: "true"
      },
      {
        ipikkaadress: "Tallinna mnt 13, Haljala alevik, Haljala vald, L\u00e4\u00e4ne-Viru maakond",
        adr_id: "2759695",
        viitepunkt_b: 59.434103,
        viitepunkt_l: 26.26171,
        kvaliteet: "sihtnumber",
        primary: "true"
      }
    ]
  });

  const result = await geocodeServiceMapAddress("Tallinna tn 13, Haljala alevik", {
    municipalityName: "Haljala vald",
    county: "L\u00e4\u00e4ne-Virumaa"
  });

  assert.equal(result.status, "MATCHED");
  assert.equal(result.adsObjectId, "2759695");
});

test("Maa- ja Ruumiamet provider retries room addresses with municipality context", async () => {
  process.env.SERVICE_MAP_GEOCODER_PROVIDER = "maaruum";
  const queries = [];
  globalThis.fetch = async (url) => {
    const query = url.searchParams.get("address");
    queries.push(query);
    if (query !== "Rahu 15, Tartu linn") {
      return Response.json({ addresses: [] });
    }
    return Response.json({
      addresses: [
        {
          ipikkaadress: "Rahu tn 15, Tartu linn, Tartu linn, Tartu maakond",
          adr_id: "3080170",
          viitepunkt_b: 58.35778,
          viitepunkt_l: 26.723199,
          kvaliteet: "tapne_lahiaadress",
          primary: "true"
        }
      ]
    });
  };

  const result = await geocodeServiceMapAddress("Rahu 15, ruum 1", {
    municipalityName: "Tartu linn"
  });

  assert.equal(result.status, "MATCHED");
  assert.equal(result.normalizedAddress, "Rahu tn 15, Tartu linn, Tartu linn, Tartu maakond");
  assert.ok(queries.includes("Rahu 15, Tartu linn"));
});

test("Maa- ja Ruumiamet provider accepts Tallinn short context for Tallinna linn entries", async () => {
  process.env.SERVICE_MAP_GEOCODER_PROVIDER = "maaruum";
  const queries = [];
  globalThis.fetch = async (url) => {
    const query = url.searchParams.get("address");
    queries.push(query);
    if (query !== "Metalli 5, Tallinn") {
      return Response.json({ addresses: [] });
    }
    return Response.json({
      addresses: [
        {
          ipikkaadress: "Metalli tn 5, Kristiine linnaosa, Tallinn, Harju maakond",
          adr_id: "tallinn-metalli-5",
          viitepunkt_b: 59.42123,
          viitepunkt_l: 24.70456,
          kvaliteet: "tapne_nr",
          primary: "true"
        }
      ]
    });
  };

  const result = await geocodeServiceMapAddress("Kristiine: Metalli 5, Tallinn", {
    municipalityName: "Tallinna linn",
    county: "Harjumaa"
  });

  assert.equal(result.status, "MATCHED");
  assert.equal(result.normalizedAddress, "Metalli tn 5, Kristiine linnaosa, Tallinn, Harju maakond");
  assert.ok(queries.includes("Metalli 5, Tallinn"));
});

test("Maa- ja Ruumiamet provider resolves service point labels to settlement with county context", async () => {
  process.env.SERVICE_MAP_GEOCODER_PROVIDER = "maaruum";
  const queries = [];
  globalThis.fetch = async (url) => {
    const query = url.searchParams.get("address");
    queries.push(query);
    if (query !== "Padise kula, Laane-Harju vald, Harju maakond") {
      return Response.json({ addresses: [] });
    }
    return Response.json({
      addresses: [
        {
          ipikkaadress: "Padise kula, Laane-Harju vald, Harju maakond",
          adr_id: "2674703",
          viitepunkt_b: 59.227804,
          viitepunkt_l: 24.142046,
          kvaliteet: "tapne_taisaadress",
          liikVal: "EHAK",
          primary: "true"
        }
      ]
    });
  };

  const result = await geocodeServiceMapAddress("Padise teeninduspunkt, Padise kula, Laane-Harju vald", {
    municipalityName: "Laane-Harju vald",
    county: "Harjumaa"
  });

  assert.equal(result.status, "MATCHED");
  assert.equal(result.normalizedAddress, "Padise kula, Laane-Harju vald, Harju maakond");
  assert.ok(queries.includes("Padise kula, Laane-Harju vald, Harju maakond"));
});

test("Maa- ja Ruumiamet provider retries bare service areas as settlement names", async () => {
  process.env.SERVICE_MAP_GEOCODER_PROVIDER = "maaruum";
  const queries = [];
  globalThis.fetch = async (url) => {
    const query = url.searchParams.get("address");
    queries.push(query);
    if (query !== "Koonga k\u00fcla, Laaneranna vald, P\u00e4rnu maakond") {
      return Response.json({ addresses: [] });
    }
    return Response.json({
      addresses: [
        {
          ipikkaadress: "Koonga k\u00fcla, Laaneranna vald, P\u00e4rnu maakond",
          adr_id: "2908594",
          viitepunkt_b: 58.582575,
          viitepunkt_l: 24.152238,
          kvaliteet: "tapne_taisaadress",
          liikVal: "EHAK",
          primary: "true"
        }
      ]
    });
  };

  const result = await geocodeServiceMapAddress("Koonga kokkuleppel", {
    municipalityName: "Laaneranna vald",
    county: "Parnumaa"
  });

  assert.equal(result.status, "MATCHED");
  assert.equal(result.normalizedAddress, "Koonga k\u00fcla, Laaneranna vald, P\u00e4rnu maakond");
  assert.ok(queries.includes("Koonga k\u00fcla, Laaneranna vald, P\u00e4rnu maakond"));
});

test("Maa- ja Ruumiamet provider rejects exact-looking matches outside requested municipality", async () => {
  process.env.SERVICE_MAP_GEOCODER_PROVIDER = "maaruum";
  globalThis.fetch = async (url) => {
    const query = url.searchParams.get("address");
    if (query === "Hanila") {
      return Response.json({
        addresses: [
          {
            ipikkaadress: "Hanila, Parmupalu k\u00fcla, R\u00f5uge vald, V\u00f5ru maakond",
            adr_id: "wrong",
            viitepunkt_b: 57.620509,
            viitepunkt_l: 26.647292,
            kvaliteet: "tapne_lahiaadress",
            primary: "true"
          }
        ]
      });
    }
    if (query === "Hanila k\u00fcla, Laaneranna vald, P\u00e4rnu maakond") {
      return Response.json({
        addresses: [
          {
            ipikkaadress: "Hanila k\u00fcla, Laaneranna vald, P\u00e4rnu maakond",
            adr_id: "right",
            viitepunkt_b: 58.613531,
            viitepunkt_l: 23.603605,
            kvaliteet: "tapne_taisaadress",
            primary: "true"
          }
        ]
      });
    }
    return Response.json({ addresses: [] });
  };

  const result = await geocodeServiceMapAddress("Hanila", {
    municipalityName: "Laaneranna vald",
    county: "Parnumaa"
  });

  assert.equal(result.status, "MATCHED");
  assert.equal(result.adsObjectId, "right");
  assert.equal(result.normalizedAddress, "Hanila k\u00fcla, Laaneranna vald, P\u00e4rnu maakond");
});

test("Maa- ja Ruumiamet provider resolves known municipality office aliases outside municipality bounds", async () => {
  process.env.SERVICE_MAP_GEOCODER_PROVIDER = "maaruum";
  const queries = [];
  globalThis.fetch = async (url) => {
    const query = url.searchParams.get("address");
    queries.push(query);
    if (query !== "V\u00f5rum\u00f5isa tee 4a, V\u00f5ru linn, V\u00f5ru maakond") {
      return Response.json({ addresses: [] });
    }
    return Response.json({
      addresses: [
        {
          ipikkaadress: "V\u00f5rum\u00f5isa tee 4a, V\u00f5ru linn, V\u00f5ru maakond",
          adr_id: "3277895",
          viitepunkt_b: 57.853618,
          viitepunkt_l: 27.004225,
          kvaliteet: "tapne_lahiaadress",
          primary: "true"
        }
      ]
    });
  };

  const result = await geocodeServiceMapAddress("V\u00f5ru Vallavalitsus", {
    municipalityName: "V\u00f5ru vald",
    county: "V\u00f5rumaa"
  });

  assert.equal(result.status, "MATCHED");
  assert.equal(result.normalizedAddress, "V\u00f5rum\u00f5isa tee 4a, V\u00f5ru linn, V\u00f5ru maakond");
  assert.ok(queries.includes("V\u00f5rum\u00f5isa tee 4a, V\u00f5ru linn, V\u00f5ru maakond"));
});

test("Maa- ja Ruumiamet provider resolves known Mustvee service area aliases", async () => {
  process.env.SERVICE_MAP_GEOCODER_PROVIDER = "maaruum";
  const queries = [];
  globalThis.fetch = async (url) => {
    const query = url.searchParams.get("address");
    queries.push(query);
    if (query !== "Avinurme alevik, Mustvee vald, J\u00f5geva maakond") {
      return Response.json({ addresses: [] });
    }
    return Response.json({
      addresses: [
        {
          ipikkaadress: "Avinurme alevik, Mustvee vald, J\u00f5geva maakond",
          adr_id: "3335001",
          viitepunkt_b: 58.985314,
          viitepunkt_l: 26.862473,
          kvaliteet: "tapne_taisaadress",
          liikVal: "EHAK",
          primary: "true"
        }
      ]
    });
  };

  const result = await geocodeServiceMapAddress("Avinurme piirkond", {
    municipalityName: "Mustvee vald",
    county: "J\u00f5gevamaa"
  });

  assert.equal(result.status, "MATCHED");
  assert.equal(result.normalizedAddress, "Avinurme alevik, Mustvee vald, J\u00f5geva maakond");
  assert.equal(result.adsObjectId, "3335001");
  assert.ok(queries.includes("Avinurme alevik, Mustvee vald, J\u00f5geva maakond"));
});

test("Maa- ja Ruumiamet provider strips parenthesized cabinet labels", async () => {
  process.env.SERVICE_MAP_GEOCODER_PROVIDER = "maaruum";
  const queries = [];
  globalThis.fetch = async (url) => {
    const query = url.searchParams.get("address");
    queries.push(query);
    if (query !== "Suur-Sepa 16, P\u00e4rnu") return Response.json({ addresses: [] });
    return Response.json({
      addresses: [
        {
          ipikkaadress: "Suur-Sepa tn 16, P\u00e4rnu linn, P\u00e4rnu linn, P\u00e4rnu maakond",
          adr_id: "3072342",
          viitepunkt_b: 58.382345,
          viitepunkt_l: 24.510193,
          kvaliteet: "tapne_nr",
          primary: "true"
        }
      ]
    });
  };

  const result = await geocodeServiceMapAddress("Suur-Sepa 16, P\u00e4rnu (kab 208)", {
    municipalityName: "P\u00e4rnu linn",
    county: "P\u00e4rnumaa"
  });

  assert.equal(result.status, "MATCHED");
  assert.equal(result.adsObjectId, "3072342");
  assert.ok(queries.includes("Suur-Sepa 16, P\u00e4rnu"));
});

test("Maa- ja Ruumiamet provider retries street names with missing street type", async () => {
  process.env.SERVICE_MAP_GEOCODER_PROVIDER = "maaruum";
  const queries = [];
  globalThis.fetch = async (url) => {
    const query = url.searchParams.get("address");
    queries.push(query);
    if (query === "N\u00f5mme 22, Kilingi-N\u00f5mme, 86304") {
      return Response.json({
        addresses: [
          {
            ipikkaadress: "N\u00f5mme tn 22, Kilingi-N\u00f5mme linn, Saarde vald, P\u00e4rnu maakond",
            adr_id: "right",
            viitepunkt_b: 58.149587,
            viitepunkt_l: 24.951624,
            kvaliteet: "tapne_nr",
            primary: "true"
          },
          {
            ipikkaadress: "Kiriku tn 22, Kilingi-N\u00f5mme linn, Saarde vald, P\u00e4rnu maakond",
            adr_id: "wrong",
            viitepunkt_b: 58.146365,
            viitepunkt_l: 24.957464,
            kvaliteet: "tapne_nr",
            primary: "true"
          }
        ]
      });
    }
    if (query !== "N\u00f5mme tn 22, Kilingi-N\u00f5mme, 86304") return Response.json({ addresses: [] });
    return Response.json({
      addresses: [
        {
          ipikkaadress: "N\u00f5mme tn 22, Kilingi-N\u00f5mme linn, Saarde vald, P\u00e4rnu maakond",
          adr_id: "right",
          viitepunkt_b: 58.149587,
          viitepunkt_l: 24.951624,
          kvaliteet: "tapne_nr",
          primary: "true"
        }
      ]
    });
  };

  const result = await geocodeServiceMapAddress("N\u00f5mme 22, Kilingi-N\u00f5mme, 86304", {
    municipalityName: "Saarde vald",
    county: "P\u00e4rnumaa"
  });

  assert.equal(result.status, "MATCHED");
  assert.equal(result.adsObjectId, "right");
  assert.ok(queries.includes("N\u00f5mme tn 22, Kilingi-N\u00f5mme, 86304"));
});

test("Maa- ja Ruumiamet provider resolves institution labels as settlement names", async () => {
  process.env.SERVICE_MAP_GEOCODER_PROVIDER = "maaruum";
  const queries = [];
  globalThis.fetch = async (url) => {
    const query = url.searchParams.get("address");
    queries.push(query);
    if (query !== "Kullamaa k\u00fcla, L\u00e4\u00e4ne-Nigula vald, L\u00e4\u00e4ne maakond") return Response.json({ addresses: [] });
    return Response.json({
      addresses: [
        {
          ipikkaadress: "Kullamaa k\u00fcla, L\u00e4\u00e4ne-Nigula vald, L\u00e4\u00e4ne maakond",
          adr_id: "kullamaa",
          viitepunkt_b: 58.881141,
          viitepunkt_l: 24.080578,
          kvaliteet: "tapne_taisaadress",
          primary: "true"
        }
      ]
    });
  };

  const result = await geocodeServiceMapAddress("Kullamaa osavallamaja", {
    municipalityName: "L\u00e4\u00e4ne-Nigula vald",
    county: "L\u00e4\u00e4nemaa"
  });

  assert.equal(result.status, "MATCHED");
  assert.equal(result.adsObjectId, "kullamaa");
  assert.ok(queries.includes("Kullamaa k\u00fcla, L\u00e4\u00e4ne-Nigula vald, L\u00e4\u00e4ne maakond"));
});

test("Maa- ja Ruumiamet provider falls back from cabinet-only labels to municipality office", async () => {
  process.env.SERVICE_MAP_GEOCODER_PROVIDER = "maaruum";
  const queries = [];
  globalThis.fetch = async (url) => {
    const query = url.searchParams.get("address");
    queries.push(query);
    if (query !== "Kungla tn 12, Valga linn, Valga maakond") return Response.json({ addresses: [] });
    return Response.json({
      addresses: [
        {
          ipikkaadress: "Kungla tn 12, Valga linn, Valga vald, Valga maakond",
          adr_id: "valga-office",
          viitepunkt_b: 57.776382,
          viitepunkt_l: 26.042411,
          kvaliteet: "tapne_nr",
          primary: "true"
        }
      ]
    });
  };

  const result = await geocodeServiceMapAddress("Kabinet 218", {
    municipalityName: "Valga vald",
    county: "Valgamaa"
  });

  assert.equal(result.status, "MATCHED");
  assert.equal(result.adsObjectId, "valga-office");
  assert.ok(queries.includes("Kungla tn 12, Valga linn, Valga maakond"));
});

test("Maa- ja Ruumiamet provider accepts explicit address municipality outside entry municipality", async () => {
  process.env.SERVICE_MAP_GEOCODER_PROVIDER = "maaruum";
  const queries = [];
  globalThis.fetch = async (url) => {
    const query = url.searchParams.get("address");
    queries.push(query);
    if (query !== "Haapsalu mnt 31a-3, Keila linn, 76605") return Response.json({ addresses: [] });
    return Response.json({
      addresses: [
        {
          ipikkaadress: "Haapsalu mnt 31a-3, Keila linn, Harju maakond",
          adr_id: "keila-office",
          viitepunkt_b: 59.3121,
          viitepunkt_l: 24.4218,
          kvaliteet: "tapne_lahiaadress",
          primary: "true"
        }
      ]
    });
  };

  const result = await geocodeServiceMapAddress("Haapsalu mnt 31a-3, Keila linn, 76605", {
    municipalityName: "L\u00e4\u00e4ne-Harju vald",
    county: "Harjumaa"
  });

  assert.equal(result.status, "MATCHED");
  assert.equal(result.adsObjectId, "keila-office");
  assert.ok(queries.includes("Haapsalu mnt 31a-3, Keila linn, 76605"));
});
