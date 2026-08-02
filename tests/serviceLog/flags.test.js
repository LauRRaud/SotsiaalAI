/**
 * TEENUSPÄEVIK-V1 — väravate lepingutestid.
 *
 * DoD punkt 7: „kõik lipu taga kuni omanik avab". Need testid tõendavad, et
 * väljas värav on VAIKIMISI olek, mitte eriharu, ja et alamlipud ei saa
 * peaväravat mööda minna.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  SERVICE_LOG_FLAG_KEYS,
  ServiceLogDisabledError,
  assertServiceLogEnabled,
  isServiceLogClientViewEnabled,
  isServiceLogEnabled,
  isServiceLogLocationStampEnabled,
  readServiceLogFlags
} from "../../lib/serviceLog/flags.js";

test("tühi keskkond tähendab VÄLJAS", () => {
  assert.equal(isServiceLogEnabled({}), false);
  assert.equal(isServiceLogLocationStampEnabled({}), false);
  assert.equal(isServiceLogClientViewEnabled({}), false);
});

test("ainult selge sisselülitus loeb — sodi on väljas", () => {
  for (const value of ["", "0", "false", "no", "off", "ei", "maybe", " ", "2"]) {
    assert.equal(
      isServiceLogEnabled({ [SERVICE_LOG_FLAG_KEYS.ENABLED]: value }),
      false,
      `"${value}" ei tohi väravat avada`
    );
  }
  for (const value of ["1", "true", "yes", "on", "TRUE", " On "]) {
    assert.equal(
      isServiceLogEnabled({ [SERVICE_LOG_FLAG_KEYS.ENABLED]: value }),
      true,
      `"${value}" peaks värava avama`
    );
  }
});

test("alamlipud ei saa peaväravat mööda minna", () => {
  // Asukohatemplit ega kliendivaadet ei ole mõtet avada, kui teenuskirjet
  // ennast luua ei saa — ja see EI TOHI olla ainult UI kokkulepe.
  const env = {
    [SERVICE_LOG_FLAG_KEYS.LOCATION_STAMP]: "1",
    [SERVICE_LOG_FLAG_KEYS.CLIENT_VIEW]: "1"
  };
  assert.equal(isServiceLogLocationStampEnabled(env), false);
  assert.equal(isServiceLogClientViewEnabled(env), false);

  const open = { ...env, [SERVICE_LOG_FLAG_KEYS.ENABLED]: "1" };
  assert.equal(isServiceLogLocationStampEnabled(open), true);
  assert.equal(isServiceLogClientViewEnabled(open), true);
});

test("lipud loetakse päringu ajal, mitte impordi hetkel", () => {
  // Mooduli-tasemel konstant külmutaks väärtuse ja test ei saaks väravat enam
  // ümber lülitada — sellest tekiks „test möödus, sest lipp jäi sisse".
  const env = {};
  assert.equal(readServiceLogFlags(env).enabled, false);
  env[SERVICE_LOG_FLAG_KEYS.ENABLED] = "1";
  assert.equal(readServiceLogFlags(env).enabled, true);
});

test("suletud värav annab 404, mitte 403", () => {
  assert.throws(
    () => assertServiceLogEnabled({}),
    (error) => {
      assert.ok(error instanceof ServiceLogDisabledError);
      assert.equal(error.status, 404);
      return true;
    }
  );
  assert.doesNotThrow(() => assertServiceLogEnabled({ [SERVICE_LOG_FLAG_KEYS.ENABLED]: "1" }));
});

test("suletud värav annab PÄRIS 404 — ka anonüümsele, ka valele rollile", async () => {
  /* VAREM KONTROLLIS SEE TEST AINULT LÄHTEKOODI REGEXIGA ja jäi seetõttu
     magama: marsruudid kontrollisid väravat PÄRAST autentimist, seega
     anonüümne sai 401 ja vale roll 403 — mõlemad ütlevad „see asi on olemas,
     ainult sina ei pääse ligi". Nüüd kutsume käsitlejaid päriselt.

     Autentimist EI OLE VAJA mockida: kui värav töötab, ei jõua täitmine
     `getServerSession`-ini kunagi. Kui keegi väravakontrolli tagasi allapoole
     tõstab, kukub see test just seal. */
  const list = await import("../../app/api/service-entries/route.js");
  const single = await import("../../app/api/service-entries/[id]/route.js");

  /* LIPP PANNAKSE VÄLJA PÄRAST IMPORTI, mitte enne.
     Marsruudi import tõmbab kaasa Prisma konfiguratsiooni, mis laeb `.env`
     UUESTI — enne importi kustutatud muutuja tuli sealt tagasi ja test hakkas
     sõltuma sellest, mis arendaja `.env`-is parajasti on. Nii kukkus ta kohe,
     kui keegi lipu lokaalselt sisse lülitas: 401 vs 404. Lipp loetakse päringu
     ajal, seega siin seadmine on ainus koht, mis on sõltumatu. */
  process.env.SERVICE_LOG_ENABLED = "0";

  const calls = [
    ["GET", () => list.GET(new Request("http://localhost/api/service-entries"))],
    [
      "POST",
      () =>
        list.POST(
          new Request("http://localhost/api/service-entries", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}"
          })
        )
    ],
    [
      "PATCH",
      () =>
        single.PATCH(
          new Request("http://localhost/api/service-entries/x", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: "{}"
          }),
          { params: Promise.resolve({ id: "x" }) }
        )
    ],
    [
      "DELETE",
      () =>
        single.DELETE(new Request("http://localhost/api/service-entries/x", { method: "DELETE" }), {
          params: Promise.resolve({ id: "x" })
        })
    ]
  ];

  for (const [name, call] of calls) {
    const response = await call();
    assert.equal(response.status, 404, `${name}: suletud värav peab andma 404`);
  }
});

test("kõik marsruudid käivad ÜHEST väravast läbi", () => {
  /* Rollireegel oli varem kopeeritud kaheksasse marsruuti. Kaheksa koopiat
     tähendab, et üks neist jääb muutmisel maha — ja just see üks on siis see,
     mille kaudu keegi sisse saab. Test nõuab, et ükski marsruut ei ehitaks
     oma väravat. */
  const root = process.cwd();
  const routes = [
    ["app", "api", "service-entries", "route.js"],
    ["app", "api", "service-entries", "[id]", "route.js"],
    ["app", "api", "service-entries", "[id]", "lifecycle", "route.js"],
    ["app", "api", "service-referrals", "route.js"],
    ["app", "api", "service-referrals", "[id]", "route.js"],
    ["app", "api", "service-narratives", "route.js"],
    ["app", "api", "service-log", "month", "route.js"],
    ["app", "api", "service-reports", "export", "route.js"]
  ];
  for (const parts of routes) {
    const file = path.join(root, ...parts);
    const source = readFileSync(file, "utf8");
    assert.match(source, /guardServiceLogRequest\(/u, `${file}: ei kasuta ühist väravat`);
    assert.doesNotMatch(source, /getServerSession/u, `${file}: oma sessioonikontroll`);
    assert.doesNotMatch(source, /roleFromSession/u, `${file}: oma rollikontroll`);
  }
});

test("värav loeb rolli PLATVORMI rollivaatest ja jätab skoobi omanikule", () => {
  /* Omanik peab saama oma admin-kontolt S/P/T lülitiga teenuseosutaja pinda
     proovida. See EI nõrgenda vana reeglit „admin ei kirjuta kellegi teise
     arve alusdokumente": skoop ei tule rollist, vaid `requireWritableProfile`
     seob kirjed `ownerId: userId`-ga. Rollivaates admin näeb AINULT oma
     profiili kirjeid. */
  const root = process.cwd();
  const guard = readFileSync(path.join(root, "lib", "serviceLog", "access.js"), "utf8");
  assert.match(guard, /resolveSessionRoleState/u);
  assert.match(guard, /effectiveRole !== "SERVICE_PROVIDER"/u);

  const entries = readFileSync(path.join(root, "lib", "serviceLog", "entries.js"), "utf8");
  assert.match(entries, /ownerId: userId/u, "skoop peab jääma omanikupõhiseks");
});
