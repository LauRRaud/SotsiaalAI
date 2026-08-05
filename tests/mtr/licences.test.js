import test from "node:test";
import assert from "node:assert/strict";

import {
  MTR_REASON,
  MTR_RESULT,
  fetchLicencesByRegistryCode,
  normalizeRegistryCode,
  parseDelimitedText,
  registryCodeChecksumValid,
  resolveEntityByRegistryCode
} from "../../lib/mtr/licences.js";

const originalFetch = globalThis.fetch;
const originalDisabled = process.env.MTR_DISABLED;

const HEADER = "Jrk;Number;Ettevõtja nimi;Registrikood;Kehtivuse algus;Kehtivuse lõpp;Kehtiv;Tegevusala;Lisainfo";
const ROW_MASAAN = "1;SEH000598;Masaan OÜ;17027241;13.10.2025;Tähtajatu;Jah;Erihoolekandeteenus;Maksimaalne isikute arv: 60";

function restore() {
  globalThis.fetch = originalFetch;
  if (originalDisabled === undefined) delete process.env.MTR_DISABLED;
  else process.env.MTR_DISABLED = originalDisabled;
}

test.afterEach(restore);

/* MTR-i kolmesammuline rada: vorm (küpsis + csrf) → filter → CSV. */
function stubRegistry({ csv, csrf = "token-123", filterStatus = 200, csvStatus = 200, csvBytes = null }) {
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const href = String(url);
    calls.push({ href, method: options.method || "GET", body: options.body, cookie: options.headers?.Cookie });
    if (href.includes("/filter/action")) {
      return new Response("ok", { status: filterStatus });
    }
    if (href.includes("/csv/action")) {
      if (csvBytes) return new Response(csvBytes, { status: csvStatus });
      return new Response(new TextEncoder().encode(csv ?? ""), { status: csvStatus });
    }
    const html = csrf
      ? `<form><input type="hidden" name="taotluse_tulemus_filters[_csrf_token]" value="${csrf}" /><input type="hidden" name="juriidiline_isik_filters[_csrf_token]" value="${csrf}" /></form>`
      : "<form></form>";
    return new Response(html, { status: 200, headers: { "set-cookie": "MTRSESSION=abc; path=/" } });
  };
  return calls;
}

test("kehtiv tähtajatu luba parsitakse koos mahupiiri ja kuupäevaga", async () => {
  const calls = stubRegistry({ csv: `${HEADER}\n${ROW_MASAAN}\n` });

  const result = await fetchLicencesByRegistryCode("17027241");

  assert.equal(result.status, MTR_RESULT.OK);
  assert.equal(result.licences.length, 1);
  assert.deepEqual(result.licences[0], {
    number: "SEH000598",
    organizationName: "Masaan OÜ",
    registryCode: "17027241",
    activity: "Erihoolekandeteenus",
    validFrom: "2025-10-13",
    validUntil: null,
    indefinite: true,
    valid: true,
    maxPersons: 60,
    note: "Maksimaalne isikute arv: 60"
  });
  assert.equal(result.checksumValid, true);
  assert.deepEqual(result.unknownColumns, []);

  /* Sessioon peab olema päris: csrf läheb kaasa ja küpsis kandub CSV päringusse. */
  assert.equal(calls.length, 3);
  assert.match(String(calls[1].body), /taotluse_tulemus_filters%5B_csrf_token%5D=token-123/);
  assert.match(String(calls[1].body), /ettevotte_kood%5D%5Btext%5D=17027241/);
  assert.match(String(calls[2].cookie), /MTRSESSION=abc/);
});

test("mitu luba ühe koodi all tulevad kõik tagasi, duplikaatread kaovad", async () => {
  const csv = [
    HEADER,
    ROW_MASAAN,
    "2;SEH000585;Masaan OÜ;17027241;09.06.2025;Tähtajatu;Jah;Erihoolekandeteenus;Maksimaalne isikute arv: 60",
    "3;SEH000585;Masaan OÜ;17027241;09.06.2025;Tähtajatu;Jah;Erihoolekandeteenus;Maksimaalne isikute arv: 60",
    "4;SEH000582;Masaan OÜ;17027241;05.05.2025;Tähtajatu;Jah;Lapsehoiuteenus;Maksimaalne isikute arv: 80"
  ].join("\n");
  stubRegistry({ csv });

  const result = await fetchLicencesByRegistryCode("17027241");

  assert.equal(result.status, MTR_RESULT.OK);
  assert.deepEqual(
    result.licences.map((licence) => `${licence.number}/${licence.activity}`),
    ["SEH000598/Erihoolekandeteenus", "SEH000585/Erihoolekandeteenus", "SEH000582/Lapsehoiuteenus"]
  );
});

test("lõppenud ja peatatud load säilitavad oma kuupäeva ja kehtivuse", async () => {
  const csv = [
    HEADER,
    "1;SEH000100;Vana OÜ;17027241;01.01.2019;31.12.2024;Ei;Turvakoduteenus;",
    "2;SEH000101;Vana OÜ;17027241;01.06.2027;Tähtajatu;Ei;Turvakoduteenus;"
  ].join("\n");
  stubRegistry({ csv });

  const result = await fetchLicencesByRegistryCode("17027241");

  assert.equal(result.licences[0].validUntil, "2024-12-31");
  assert.equal(result.licences[0].valid, false);
  assert.equal(result.licences[1].validFrom, "2027-06-01");
  assert.equal(result.licences[1].indefinite, true);
});

test("tulemusteta otsing on OK ja tühi loend, mitte tõrge", async () => {
  stubRegistry({ csv: `${HEADER}\n` });

  const result = await fetchLicencesByRegistryCode("17027241");

  assert.equal(result.status, MTR_RESULT.OK);
  assert.deepEqual(result.licences, []);
});

test("puuduv kohustuslik veerg annab SCHEMA_CHANGED, mitte vale tulemuse", async () => {
  stubRegistry({ csv: "Jrk;Number;Ettevõtja nimi;Registrikood;Kehtiv;Lisainfo\n1;SEH1;X OÜ;17027241;Jah;\n" });

  const result = await fetchLicencesByRegistryCode("17027241");

  assert.equal(result.status, MTR_RESULT.UNCONFIRMED);
  assert.equal(result.reason, MTR_REASON.SCHEMA_CHANGED);
  assert.deepEqual(result.missingColumns, ["kehtivuse algus", "tegevusala"]);
  assert.deepEqual(result.licences, []);
});

test("tundmatu veerg ei blokeeri, vaid tuleb alarmi jaoks tagasi", async () => {
  stubRegistry({ csv: `${HEADER};Uus tulp\n${ROW_MASAAN};midagi\n` });

  const result = await fetchLicencesByRegistryCode("17027241");

  assert.equal(result.status, MTR_RESULT.OK);
  assert.deepEqual(result.unknownColumns, ["uus tulp"]);
});

test("vigane kodeering peatab parsimise", async () => {
  stubRegistry({ csvBytes: new Uint8Array([0x4e, 0x75, 0x6d, 0x62, 0x65, 0x72, 0xff, 0xfe]) });

  const result = await fetchLicencesByRegistryCode("17027241");

  assert.equal(result.status, MTR_RESULT.UNCONFIRMED);
  assert.equal(result.reason, MTR_REASON.ENCODING_FAILED);
});

test("timeout ja HTTP-viga annavad eri põhjuse, aga mõlemad UNCONFIRMED", async () => {
  globalThis.fetch = async () => {
    const error = new Error("aborted");
    error.name = "AbortError";
    throw error;
  };
  const timedOut = await fetchLicencesByRegistryCode("17027241");
  assert.equal(timedOut.status, MTR_RESULT.UNCONFIRMED);
  assert.equal(timedOut.reason, MTR_REASON.TIMEOUT);

  stubRegistry({ csv: HEADER, filterStatus: 500 });
  const failed = await fetchLicencesByRegistryCode("17027241");
  assert.equal(failed.status, MTR_RESULT.UNCONFIRMED);
  assert.equal(failed.reason, MTR_REASON.REQUEST_FAILED);
});

test("puuduv CSRF-token annab SESSION_FAILED", async () => {
  stubRegistry({ csv: HEADER, csrf: null });

  const result = await fetchLicencesByRegistryCode("17027241");

  assert.equal(result.reason, MTR_REASON.SESSION_FAILED);
});

test("vigane registrikood ei jõua võrku", async () => {
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response("");
  };

  for (const input of ["", null, "123", "1702724A1", "170272411"]) {
    const result = await fetchLicencesByRegistryCode(input);
    assert.equal(result.status, MTR_RESULT.UNCONFIRMED);
    assert.equal(result.reason, MTR_REASON.INVALID_REGISTRY_CODE);
  }
  assert.equal(called, false);
});

test("MTR_DISABLED lülitab raja välja ilma tõrketa", async () => {
  process.env.MTR_DISABLED = "1";
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response("");
  };

  const result = await fetchLicencesByRegistryCode("17027241");

  assert.equal(result.reason, MTR_REASON.DISABLED);
  assert.equal(called, false);
});

test("kontrollnumber on anomaaliasignaal, mitte värav", async () => {
  assert.equal(registryCodeChecksumValid("17027241"), true);
  assert.equal(registryCodeChecksumValid("80587752"), true);
  assert.equal(registryCodeChecksumValid("17027242"), false);

  stubRegistry({ csv: `${HEADER}\n1;SEH1;X OÜ;17027242;01.01.2020;Tähtajatu;Jah;Turvakoduteenus;\n` });
  const result = await fetchLicencesByRegistryCode("17027242");

  assert.equal(result.status, MTR_RESULT.OK, "vale kontrollnumber ei tohi päringut blokeerida");
  assert.equal(result.checksumValid, false);
});

test("identiteedivärav: lahendunud ja lahendamata registrikood", async () => {
  stubRegistry({ csv: "Registrikood;Nimi\n17027241;Masaan OÜ\n" });
  const found = await resolveEntityByRegistryCode("17027241");
  assert.equal(found.status, MTR_RESULT.OK);
  assert.equal(found.found, true);
  assert.equal(found.name, "Masaan OÜ");

  stubRegistry({ csv: "Registrikood;Nimi\n" });
  const missing = await resolveEntityByRegistryCode("17027241");
  assert.equal(missing.status, MTR_RESULT.OK);
  assert.equal(missing.found, false);

  stubRegistry({ csv: "Registrikood;Nimi\n17027241;Masaan OÜ\n", filterStatus: 503 });
  const broken = await resolveEntityByRegistryCode("17027241");
  assert.equal(broken.status, MTR_RESULT.UNCONFIRMED, "tõrge ei tohi tähendada 'isikut ei ole'");
  assert.equal(broken.found, false);
});

test("normalizeRegistryCode ja CSV-lugeja käitlevad päris kuju", () => {
  assert.equal(normalizeRegistryCode(" 1702 7241 "), "17027241");
  assert.equal(normalizeRegistryCode("1702724"), null);

  const quoted = parseDelimitedText('a;b\n"Masaan; OÜ";"ütles ""tere"""\n');
  assert.equal(quoted.delimiter, ";");
  assert.deepEqual(quoted.rows[1], ["Masaan; OÜ", 'ütles "tere"']);

  const comma = parseDelimitedText("a,b\n1,2\n");
  assert.equal(comma.delimiter, ",");
  assert.deepEqual(parseDelimitedText("").rows, []);
});
