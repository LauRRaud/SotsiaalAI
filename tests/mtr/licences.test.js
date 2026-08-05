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
    if (href.includes("/filter/action")) return new Response("ok", { status: filterStatus });
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
    activityType: null,
    validFrom: "2025-10-13",
    validUntil: null,
    indefinite: true,
    valid: true,
    licensedMaxPersons: 60,
    note: "Maksimaalne isikute arv: 60",
    locations: []
  });
  assert.equal(result.checksumValid, true);
  assert.deepEqual(result.unknownColumns, []);
  assert.ok(result.attemptedAt, "päringu algus jääb kirja");
  assert.ok(result.checkedAt, "checkedAt tekib alles tõlgendatud vastuse järel");

  /* Sessioon peab olema päris: csrf läheb kaasa ja küpsis kandub CSV päringusse. */
  assert.equal(calls.length, 3);
  assert.match(String(calls[1].body), /taotluse_tulemus_filters%5B_csrf_token%5D=token-123/);
  assert.match(String(calls[1].body), /ettevotte_kood%5D%5Btext%5D=17027241/);
  assert.match(String(calls[2].cookie), /MTRSESSION=abc/);
});

test("väljundtulbad tellitakse nimeliselt ja tegevusala liik parsitakse", async () => {
  const header = `${HEADER};Tegevusala liik;Tegevuskohtade aadressid (eraldi ridadel);Tegevusloa väljaandja;Maksimaalne isikute arv`;
  const csv = [
    header,
    "1;SEH000598;Masaan OÜ;17027241;13.10.2025;Tähtajatu;Jah;Erihoolekandeteenus;;Toetatud elamise teenus;Riia 5, Tartu;Sotsiaalkindlustusamet;42",
    "2;SEH000598;Masaan OÜ;17027241;13.10.2025;Tähtajatu;Jah;Erihoolekandeteenus;;Päeva- ja nädalahoiuteenus;Riia 5, Tartu;Sotsiaalkindlustusamet;7"
  ].join("\n");
  const calls = stubRegistry({ csv });

  const result = await fetchLicencesByRegistryCode("17027241");

  /* Tellimus läheb päringus kaasa — parser ei sõltu MTR-i vaikeseadistusest. */
  const body = String(calls[1].body);
  for (const field of ["tegevusala_liigid", "tegevuskoha_aadressid", "tegevusloa_valjaandja", "tegevuskohtade_kohtade_arvu_summa"]) {
    assert.ok(body.includes(field), `${field} tuleb tellida`);
  }

  assert.equal(result.status, MTR_RESULT.OK);
  assert.deepEqual(result.missingOrderedColumns, []);
  /* Sama loanumber, ERI alateenus — need on eri read ja neid ei tohi liita. */
  assert.equal(result.licences.length, 2);
  assert.deepEqual(
    result.licences.map((licence) => licence.activityType),
    ["Toetatud elamise teenus", "Päeva- ja nädalahoiuteenus"]
  );
  /* Tellitud tulp on täpsem kui Lisainfost loetud number. */
  assert.equal(result.licences[0].licensedMaxPersons, 42);
  assert.equal(result.licences[1].licensedMaxPersons, 7);
  assert.equal(result.licences[0].locations[0].address, "Riia 5, Tartu");
});

test("tellitud tulba puudumine ei ole fataalne, aga tuleb alarmi jaoks tagasi", async () => {
  stubRegistry({ csv: `${HEADER}\n${ROW_MASAAN}\n` });

  const result = await fetchLicencesByRegistryCode("17027241");

  assert.equal(result.status, MTR_RESULT.OK, "loa identiteet tuleb ikka kohustuslikest veergudest");
  assert.equal(result.licences[0].activityType, null);
  assert.deepEqual(result.missingOrderedColumns, [
    "tegevusala liik",
    "tegevuskohtade aadressid (eraldi ridadel)",
    "tegevusloa väljaandja",
    "maksimaalne isikute arv"
  ]);
});

test("võõra registrikoodiga rida annab RESULT_MISMATCH, mitte võõraid lube", async () => {
  /* Kui filter ei rakendu, kannab eksport teiste ettevõtete ridu. Neid ei tohi
     kunagi meie oma pähe tagastada ega otsitud koodiga üle kirjutada. */
  stubRegistry({ csv: `${HEADER}\n1;SEH000900;Keegi Teine OÜ;10000000;01.01.2020;Tähtajatu;Jah;Turvakoduteenus;\n` });

  const result = await fetchLicencesByRegistryCode("17027241");

  assert.equal(result.status, MTR_RESULT.UNCONFIRMED);
  assert.equal(result.reason, MTR_REASON.RESULT_MISMATCH);
  assert.deepEqual(result.licences, []);
});

test("tühja registrikoodiga rida ei asendu otsitud koodiga", async () => {
  stubRegistry({ csv: `${HEADER}\n1;SEH000598;Masaan OÜ;;13.10.2025;Tähtajatu;Jah;Erihoolekandeteenus;\n` });

  const result = await fetchLicencesByRegistryCode("17027241");

  assert.equal(result.reason, MTR_REASON.RESULT_MISMATCH);
});

test("mitu luba tulevad kõik tagasi, identne duplikaatrida kaob", async () => {
  const csv = [
    HEADER,
    ROW_MASAAN,
    "2;SEH000585;Masaan OÜ;17027241;09.06.2025;Tähtajatu;Jah;Erihoolekandeteenus;Maksimaalne isikute arv: 60",
    "3;SEH000585;Masaan OÜ;17027241;09.06.2025;Tähtajatu;Jah;Erihoolekandeteenus;Maksimaalne isikute arv: 60",
    "4;SEH000582;Masaan OÜ;17027241;05.05.2025;Tähtajatu;Jah;Lapsehoiuteenus;Maksimaalne isikute arv: 80"
  ].join("\n");
  stubRegistry({ csv });

  const result = await fetchLicencesByRegistryCode("17027241");

  assert.deepEqual(
    result.licences.map((licence) => `${licence.number}/${licence.activity}`),
    ["SEH000598/Erihoolekandeteenus", "SEH000585/Erihoolekandeteenus", "SEH000582/Lapsehoiuteenus"]
  );
});

test("sama loa tegevuskoha read säilivad, mitte ei kustu deduplitseerimisel", async () => {
  const header = `${HEADER};Tegevuskohtade aadressid`;
  const csv = [
    header,
    `1;SEH000598;Masaan OÜ;17027241;13.10.2025;Tähtajatu;Jah;Erihoolekandeteenus;Maksimaalne isikute arv: 60;Tartu mnt 1, Tallinn`,
    `2;SEH000598;Masaan OÜ;17027241;13.10.2025;Tähtajatu;Jah;Erihoolekandeteenus;Maksimaalne isikute arv: 60;Riia 5, Tartu`
  ].join("\n");
  stubRegistry({ csv });

  const result = await fetchLicencesByRegistryCode("17027241");

  assert.equal(result.status, MTR_RESULT.OK);
  assert.equal(result.licences.length, 1, "üks luba");
  assert.deepEqual(
    result.licences[0].locations.map((location) => location.address),
    ["Tartu mnt 1, Tallinn", "Riia 5, Tartu"]
  );
  assert.equal(result.addressColumn, "tegevuskohtade aadressid");
});

test("lõppenud ja tulevikus algav luba säilitavad kuupäeva ja kehtivuse", async () => {
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

test("vigane CSV ei jõua kunagi OK tulemuseni", async () => {
  const cases = [
    { name: "sulgemata jutumärk", csv: `${HEADER}\n1;"SEH000598;Masaan OÜ;17027241;13.10.2025;Tähtajatu;Jah;X;\n`, reason: MTR_REASON.PARSE_FAILED },
    { name: "liiga vähe veerge", csv: `${HEADER}\n1;SEH000598;Masaan OÜ\n`, reason: MTR_REASON.MALFORMED_ROW },
    { name: "tühi loanumber", csv: `${HEADER}\n1;;Masaan OÜ;17027241;13.10.2025;Tähtajatu;Jah;Erihoolekandeteenus;\n`, reason: MTR_REASON.MALFORMED_ROW },
    { name: "tühi tegevusala", csv: `${HEADER}\n1;SEH1;Masaan OÜ;17027241;13.10.2025;Tähtajatu;Jah;;\n`, reason: MTR_REASON.MALFORMED_ROW },
    { name: "vigane alguskuupäev", csv: `${HEADER}\n1;SEH1;Masaan OÜ;17027241;13/10/2025;Tähtajatu;Jah;Erihoolekandeteenus;\n`, reason: MTR_REASON.MALFORMED_ROW },
    { name: "olematu kuupäev", csv: `${HEADER}\n1;SEH1;Masaan OÜ;17027241;31.02.2026;Tähtajatu;Jah;Erihoolekandeteenus;\n`, reason: MTR_REASON.MALFORMED_ROW },
    { name: "vigane lõppkuupäev", csv: `${HEADER}\n1;SEH1;Masaan OÜ;17027241;13.10.2025;peatatud;Jah;Erihoolekandeteenus;\n`, reason: MTR_REASON.MALFORMED_ROW },
    { name: "tundmatu kehtivus", csv: `${HEADER}\n1;SEH1;Masaan OÜ;17027241;13.10.2025;Tähtajatu;Võib-olla;Erihoolekandeteenus;\n`, reason: MTR_REASON.MALFORMED_ROW }
  ];

  for (const { name, csv, reason } of cases) {
    stubRegistry({ csv });
    const result = await fetchLicencesByRegistryCode("17027241");
    assert.equal(result.status, MTR_RESULT.UNCONFIRMED, name);
    assert.equal(result.reason, reason, name);
    assert.deepEqual(result.licences, [], name);
  }
});

test("puuduv kohustuslik veerg annab SCHEMA_CHANGED, mitte vale tulemuse", async () => {
  stubRegistry({ csv: "Jrk;Number;Ettevõtja nimi;Registrikood;Kehtiv;Lisainfo\n1;SEH1;X OÜ;17027241;Jah;\n" });

  const result = await fetchLicencesByRegistryCode("17027241");

  assert.equal(result.reason, MTR_REASON.SCHEMA_CHANGED);
  assert.deepEqual(result.missingColumns, ["kehtivuse algus", "tegevusala"]);
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

  assert.equal(result.reason, MTR_REASON.ENCODING_FAILED);
});

test("timeout ja HTTP-viga annavad eri põhjuse, aga mõlemad UNCONFIRMED", async () => {
  globalThis.fetch = async () => {
    const error = new Error("aborted");
    error.name = "AbortError";
    throw error;
  };
  const timedOut = await fetchLicencesByRegistryCode("17027241");
  assert.equal(timedOut.reason, MTR_REASON.TIMEOUT);

  stubRegistry({ csv: HEADER, filterStatus: 500 });
  const failed = await fetchLicencesByRegistryCode("17027241");
  assert.equal(failed.reason, MTR_REASON.REQUEST_FAILED);
});

test("ootamatu erind ei jõua kutsujani, vaid tuleb UNEXPECTED_ERROR-ina", async () => {
  globalThis.fetch = async () => ({
    ok: true,
    get headers() {
      throw new Error("ootamatu");
    }
  });

  const licences = await fetchLicencesByRegistryCode("17027241");
  assert.equal(licences.status, MTR_RESULT.UNCONFIRMED);
  assert.equal(licences.reason, MTR_REASON.UNEXPECTED_ERROR);

  const entity = await resolveEntityByRegistryCode("17027241");
  assert.equal(entity.reason, MTR_REASON.UNEXPECTED_ERROR);
  assert.equal(entity.found, false);
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

test("identiteedivärav kontrollib rea registrikoodi, mitte ainult esimest rida", async () => {
  stubRegistry({ csv: "Registrikood;Nimi\n10000000;Keegi Teine OÜ\n17027241;Masaan OÜ\n" });
  const found = await resolveEntityByRegistryCode("17027241");
  assert.equal(found.status, MTR_RESULT.OK);
  assert.equal(found.found, true);
  assert.equal(found.name, "Masaan OÜ", "õige rida, mitte esimene");

  stubRegistry({ csv: "Registrikood;Nimi\n10000000;Keegi Teine OÜ\n" });
  const mismatch = await resolveEntityByRegistryCode("17027241");
  assert.equal(mismatch.status, MTR_RESULT.UNCONFIRMED);
  assert.equal(mismatch.reason, MTR_REASON.RESULT_MISMATCH);
  assert.equal(mismatch.found, false);

  stubRegistry({ csv: "Nimi\nMasaan OÜ\n" });
  const noCode = await resolveEntityByRegistryCode("17027241");
  assert.equal(noCode.reason, MTR_REASON.SCHEMA_CHANGED, "registrikoodi veerg on kohustuslik");

  stubRegistry({ csv: "Registrikood;Nimi\n" });
  const absent = await resolveEntityByRegistryCode("17027241");
  assert.equal(absent.status, MTR_RESULT.OK, "sellist koodi lihtsalt ei ole");
  assert.equal(absent.found, false);

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
  assert.equal(quoted.unterminatedQuote, false);
  assert.deepEqual(quoted.rows[1], ["Masaan; OÜ", 'ütles "tere"']);

  assert.equal(parseDelimitedText('a;b\n"katki;x\n').unterminatedQuote, true);
  assert.equal(parseDelimitedText("a,b\n1,2\n").delimiter, ",");
  assert.deepEqual(parseDelimitedText("").rows, []);
});
