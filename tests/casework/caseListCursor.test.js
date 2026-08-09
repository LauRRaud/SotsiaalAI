/**
 * SOL-CW-20 — juhtumiloendi cursor tugines MUUTLIKULE järjestusväljale.
 *
 * MIDA SIIN TÕENDATAKSE. Loend sordib `updatedAt DESC, id DESC`, aga cursorina
 * liikus kliendile ainult rea ID ja järgmine leht leiti Prisma
 * `cursor: { id }, skip: 1`-ga, mis positsioneerib rea PRAEGUSE koha järgi.
 * `updatedAt` on muutlik — juhtumi iga lapse kirjutus puudutab vanemrida — nii
 * et üks paralleelne vahekaart tekitas kaks vaikset viga:
 *
 *   · KORDUS — cursor-rida hüppab etteotsa, järgmine leht algab pea algusest
 *   · VAHELEJÄÄK — nägemata rida hüppab cursorist ETTE ja ei tule enam kunagi
 *
 * MIKS SEE FAKE ON PIKEM KUI TAVALINE. Fake, mis tagastab `[]` või ignoreerib
 * `where`/`orderBy`-t, oleks siin **täiesti kasutu**: kogu leid ON järjestuse ja
 * lehepiiri koosmõju. Seepärast hindab siinne pood päriselt nii keyset-tingimust
 * kui ka VANA `cursor`-semantikat — ja iga stsenaarium jookseb MÕLEMA peal.
 * Vana rada peab läbi kukkuma. Sond, mille iga rida on roheline, ei mõõda midagi.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { CASEWORK_FLAG_KEYS } from "../../lib/casework/flags.js";
import { listCaseWorkAssists } from "../../lib/casework/caseWorkAssist.js";
import { decodeListCursor, encodeListCursor } from "../../lib/casework/paging.js";

const OWNER = "worker_a";

function withFeatureOn(fn) {
  return async (...args) => {
    const previous = process.env[CASEWORK_FLAG_KEYS.ENABLED];
    process.env[CASEWORK_FLAG_KEYS.ENABLED] = "1";
    try {
      return await fn(...args);
    } finally {
      if (previous === undefined) delete process.env[CASEWORK_FLAG_KEYS.ENABLED];
      else process.env[CASEWORK_FLAG_KEYS.ENABLED] = previous;
    }
  };
}

const at = minutes => new Date(Date.UTC(2026, 7, 9, 12, minutes, 0));

/** `updatedAt DESC, id DESC` — sama järjestus, mida lugeja Prismalt küsib. */
function sortRows(rows) {
  return [...rows].sort((a, b) => {
    const diff = b.updatedAt.getTime() - a.updatedAt.getTime();
    return diff !== 0 ? diff : b.id.localeCompare(a.id);
  });
}

/** `where` puu hindaja: ainult need operaatorid, mida lugeja päriselt kasutab. */
function matches(row, where) {
  if (!where) return true;
  for (const [key, condition] of Object.entries(where)) {
    if (key === "AND") {
      if (!condition.every(part => matches(row, part))) return false;
      continue;
    }
    if (key === "OR") {
      if (!condition.some(part => matches(row, part))) return false;
      continue;
    }

    const value = row[key];
    if (condition instanceof Date) {
      if (!(value instanceof Date) || value.getTime() !== condition.getTime()) return false;
      continue;
    }
    if (condition && typeof condition === "object") {
      for (const [operator, operand] of Object.entries(condition)) {
        const left = value instanceof Date ? value.getTime() : value;
        const right = operand instanceof Date ? operand.getTime() : operand;
        if (operator === "lt" && !(left < right)) return false;
        else if (operator === "lte" && !(left <= right)) return false;
        else if (!["lt", "lte"].includes(operator)) {
          throw new Error(`fake ei tunne operaatorit ${operator} — test mõõdaks fake'i, mitte lugejat`);
        }
      }
      continue;
    }
    if (value !== condition) return false;
  }
  return true;
}

/**
 * @param {object[]} rows
 * @param {{ legacy?: boolean }} options `legacy` = VANA `cursor: { id }, skip: 1`
 */
function store(rows, { legacy = false } = {}) {
  const table = rows;
  return {
    table,
    caseWorkAssist: {
      async findMany({ where, orderBy, take, cursor, skip }) {
        assert.deepEqual(orderBy, [{ updatedAt: "desc" }, { id: "desc" }], "järjestus muutus — cursor eeldab teda");

        let list = sortRows(table.filter(row => matches(row, where)));

        if (legacy && cursor?.id) {
          /* VANA SEMANTIKA täpselt nii, nagu Prisma teeb: leia rida PRAEGUSEST
             järjestusest ja jätka temast. Just see teeb `updatedAt`-i muutumise
             lehepiiriks. */
          const index = list.findIndex(row => row.id === cursor.id);
          list = index === -1 ? [] : list.slice(index + (skip || 0));
        }

        return list.slice(0, take).map(row => ({ ...row }));
      }
    },
    user: {
      async findMany() {
        return [];
      }
    }
  };
}

function row(id, minutes) {
  return { id, ownerUserId: OWNER, clientUserId: null, retentionState: "ACTIVE", updatedAt: at(minutes) };
}

/** Lehitseb lõpuni ja tagastab ID-d ilmumise järjekorras. `mutate` jookseb iga lehe JÄREL. */
async function paginate(db, { limit = 2, mutate = null } = {}) {
  const seen = [];
  let cursor = null;
  for (let page = 0; page < 10; page += 1) {
    const result = await listCaseWorkAssists({ ownerUserId: OWNER, cursor, limit, db });
    seen.push(...result.items.map(item => item.id));
    cursor = result.nextCursor;
    if (!cursor) break;
    if (mutate) mutate(db.table, page);
  }
  return seen;
}

/**
 * VANA LUGEJA, sõna-sõnalt nii nagu ta enne SOL-CW-20 oli.
 *
 * MIKS TEST TA UUESTI KIRJUTAB: uus lugeja EI VÕTA vana kujuga cursorit vastu
 * (paljas ID annab 400 ja see on teadlik), seega vana käitumist ei saa enam läbi
 * `listCaseWorkAssists()` mõõta. Ilma selle võrdluseta ei tõendaks ükski
 * roheline test, et stsenaarium leidu üldse reprodutseerib.
 */
async function legacyPaginate(db, { limit = 2, mutate = null } = {}) {
  const seen = [];
  let cursorId = null;
  for (let page = 0; page < 10; page += 1) {
    const rows = await db.caseWorkAssist.findMany({
      where: { ownerUserId: OWNER },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {})
    });
    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    seen.push(...pageRows.map(entry => entry.id));
    cursorId = hasMore ? pageRows[pageRows.length - 1].id : null;
    if (!cursorId) break;
    if (mutate) mutate(db.table, page);
  }
  return seen;
}

/* ── 1. KORDUS ──────────────────────────────────────────────────────────── */

test(
  "SOL-CW-20: vahepeal muudetud cursor-rida ei too sama juhtumit teist korda",
  withFeatureOn(async () => {
    const rows = [row("c5", 50), row("c4", 40), row("c3", 30), row("c2", 20), row("c1", 10)];

    /* Esimese lehe viimane rida (`c4`) hüppab etteotsa — täpselt see, mida teeb
       lapse kirjutus paralleelses vahekaardis. */
    const bump = table => {
      table.find(entry => entry.id === "c4").updatedAt = at(59);
    };

    const seen = await paginate(store(rows.map(entry => ({ ...entry }))), { limit: 2, mutate: bump });
    assert.deepEqual(seen, [...new Set(seen)], `kordus loendis: ${seen.join(",")}`);
    assert.deepEqual(seen, ["c5", "c4", "c3", "c2", "c1"]);
  })
);

test(
  "SOL-CW-20: NEGATIIVKONTROLL — VANA cursor kordab sama stsenaariumi peal",
  withFeatureOn(async () => {
    /* Ilma selle testita ei tõendaks eelmine, et stsenaarium leidu üldse
       reprodutseerib — ta võiks olla roheline ka siis, kui viga ei olnudki. */
    const rows = [row("c5", 50), row("c4", 40), row("c3", 30), row("c2", 20), row("c1", 10)];
    const bump = table => {
      table.find(entry => entry.id === "c4").updatedAt = at(59);
    };

    const seen = await legacyPaginate(store(rows.map(entry => ({ ...entry })), { legacy: true }), {
      limit: 2,
      mutate: bump
    });
    assert.notDeepEqual(
      seen,
      [...new Set(seen)],
      `vana rada EI kordanud — stsenaarium ei reprodutseeri leidu (${seen.join(",")})`
    );
  })
);

/* ── 2. KUSTUTATUD CURSOR-RIDA ──────────────────────────────────────────── */

test(
  "SOL-CW-20: kustutatud cursor-rida ei katkesta lehitsemist",
  withFeatureOn(async () => {
    /* Keyset ei vaja rea OLEMASOLU — ta on võrdlus, mitte otsing. Vana rada
       otsis rea üles ja ilma temata kadus kogu ülejäänud loend. */
    const rows = [row("c5", 50), row("c4", 40), row("c3", 30), row("c2", 20), row("c1", 10)];
    const dropCursorRow = (table, page) => {
      if (page === 0) table.splice(table.findIndex(entry => entry.id === "c4"), 1);
    };

    const seen = await paginate(store(rows.map(entry => ({ ...entry }))), { limit: 2, mutate: dropCursorRow });
    assert.deepEqual(seen, ["c5", "c4", "c3", "c2", "c1"]);
  })
);

test(
  "SOL-CW-20: NEGATIIVKONTROLL — VANA cursor kaotab kustutatud rea taga KOGU loendi",
  withFeatureOn(async () => {
    const rows = [row("c5", 50), row("c4", 40), row("c3", 30), row("c2", 20), row("c1", 10)];
    const dropCursorRow = (table, page) => {
      if (page === 0) table.splice(table.findIndex(entry => entry.id === "c4"), 1);
    };

    const seen = await legacyPaginate(store(rows.map(entry => ({ ...entry })), { legacy: true }), {
      limit: 2,
      mutate: dropCursorRow
    });
    assert.deepEqual(seen, ["c5", "c4"], `vana rada ei kaotanud saba — stsenaarium ei reprodutseeri leidu (${seen.join(",")})`);
  })
);

/* ── 3. SNAPSHOT-LEPING ─────────────────────────────────────────────────── */

test(
  "SOL-CW-20: üles hüpanud rida jääb SELLEST lehitsemisest välja, aga ei kao andmestikust",
  withFeatureOn(async () => {
    /* SEE ON LEPING, MITTE PUUDUS. Stabiilne ülempiir teeb lehitsemisest
       snapshot'i: mis pärast esimest lehte muutus, tuleb nähtavale
       VÄRSKENDUSEL. Alternatiiv — lasta tal keset lehitsemist sisse — annaks
       rea, mille kasutaja on juba läbi kerinud, teist korda.

       Kandev vahe vana raja ees on see, et siin EI OLE ühtegi rida, mis oleks
       loendist päriselt kadunud: värske lehitsemine leiab ta esimeselt lehelt. */
    const rows = [row("c5", 50), row("c4", 40), row("c3", 30), row("c2", 20), row("c1", 10)];
    const db = store(rows.map(entry => ({ ...entry })));

    const bump = (table, page) => {
      if (page === 0) table.find(entry => entry.id === "c1").updatedAt = at(58);
    };

    const seen = await paginate(db, { limit: 2, mutate: bump });
    assert.deepEqual(seen, [...new Set(seen)], `kordus: ${seen.join(",")}`);
    assert.ok(!seen.includes("c1"), "snapshot lasi vahepeal muudetud rea keset lehitsemist sisse");

    /* Ja ta ON olemas — värske snapshot algab temast. */
    const fresh = await listCaseWorkAssists({ ownerUserId: OWNER, limit: 2, db });
    assert.equal(fresh.items[0].id, "c1", "üles hüpanud rida ei tulnud värskendusel esimeseks");
  })
);

/* ── 3. tavaline lehitsemine ei katkenud ────────────────────────────────── */

test(
  "SOL-CW-20: muutumatu loend lehitseb endiselt täpselt ja lõpetab",
  withFeatureOn(async () => {
    const rows = [row("c5", 50), row("c4", 40), row("c3", 30), row("c2", 20), row("c1", 10)];
    const seen = await paginate(store(rows.map(entry => ({ ...entry }))), { limit: 2 });
    assert.deepEqual(seen, ["c5", "c4", "c3", "c2", "c1"]);
  })
);

test(
  "SOL-CW-20: sama millisekundi read järjestuvad ID järgi ja ei korduta",
  withFeatureOn(async () => {
    /* Sortimisvõtme teine pool. Ilma `id`-ta oleks järjestus ebastabiilne ja
       keyset-tingimus jätaks ühe rea kas kaks korda või üldse välja. */
    const rows = [row("c4", 30), row("c3", 30), row("c2", 30), row("c1", 30)];
    const seen = await paginate(store(rows.map(entry => ({ ...entry }))), { limit: 2 });
    assert.deepEqual(seen, ["c4", "c3", "c2", "c1"]);
  })
);

test(
  "SOL-CW-20: ülempiir sünnib esimesel lehel ja EI liigu lehitsemise ajal",
  withFeatureOn(async () => {
    /* Kui ülempiir tekiks iga lehe peal uuesti, liiguks snapshot koos
       lehitsemisega ja kogu kaitse kaoks — sama viga, ainult aeglasemal kujul. */
    const rows = [row("c5", 50), row("c4", 40), row("c3", 30)];
    const db = store(rows.map(entry => ({ ...entry })));

    const first = await listCaseWorkAssists({ ownerUserId: OWNER, limit: 2, db });
    const boundary = decodeListCursor(first.nextCursor).boundary;

    const second = await listCaseWorkAssists({ ownerUserId: OWNER, cursor: first.nextCursor, limit: 1, db });
    assert.equal(second.nextCursor, null, "kolmerealine loend andis neljanda lehe");
    assert.deepEqual(
      second.items.map(item => item.id),
      ["c3"]
    );
    assert.equal(boundary.getTime(), at(50).getTime(), "ülempiir ei ole esimese lehe hetk");
  })
);

/* ── 4. cursor ise ──────────────────────────────────────────────────────── */

test("SOL-CW-20: cursor on läbipaistmatu ja käib täisringi", () => {
  const encoded = encodeListCursor({ updatedAt: at(30), id: "c3", boundary: at(50) });
  assert.ok(encoded && !encoded.includes("c3"), "cursor paljastab rea ID nagu tavatekst");

  const decoded = decodeListCursor(encoded);
  assert.equal(decoded.id, "c3");
  assert.equal(decoded.updatedAt.getTime(), at(30).getTime());
  assert.equal(decoded.boundary.getTime(), at(50).getTime());
});

test("SOL-CW-20: loetamatu cursor annab 400, MITTE vaikset esimest lehte", () => {
  /* Vaikne tagasilangus kaotaks kasutaja koha loendis ja näeks välja nagu
     andmete kadu. Ja vana kujuga cursor (paljas ID) on samuti loetamatu — teda
     EI tõlgendata, sest vale tõlgendus taastaks täpselt selle vea. */
  for (const value of ["c3", "!!!", "e30", Buffer.from('{"v":9}', "utf8").toString("base64url")]) {
    assert.throws(
      () => decodeListCursor(value),
      error => {
        assert.equal(error.status, 400, `oodatud 400, saadi ${error.status}`);
        assert.equal(error.messageKey, "casework.errors.cursor_invalid");
        return true;
      },
      `cursor ${value} oleks pidanud tagasi tulema 400-ga`
    );
  }

  /* Puuduv cursor EI OLE vigane cursor — esimene leht on täiesti korras. */
  assert.equal(decodeListCursor(null), null);
  assert.equal(decodeListCursor(""), null);
});

test("SOL-CW-20: päris andmebaasi sond on olemas — fake ei tõenda Prisma päringut", () => {
  /* Siinne fake hindab MINU where-puud. Kas Prisma pesastatud `AND`/`OR` +
     `lt`/`lte` `DateTime` peal üldse vastu võtab, saab öelda ainult päris
     andmebaas — ja just seal ütleb fake kõige veenvamalt „roheline". */
  const pkg = JSON.parse(readFileSync(fileURLToPath(new URL("../../package.json", import.meta.url)), "utf8"));
  assert.ok(pkg.scripts["casework:list:probe"], "loendi sondi käsku ei ole");

  const probe = readFileSync(fileURLToPath(new URL("../../scripts/casework-list-probe.mjs", import.meta.url)), "utf8");
  assert.match(probe, /listCaseWorkAssists/, "sond ei kutsu päris lugejat");
  assert.match(probe, /DROP DATABASE IF EXISTS/, "sond ei kustuta oma andmebaasi");
  assert.match(probe, /SELECT 1 FROM pg_database WHERE datname/, "koristust ei kontrollita");
});

test("SOL-CW-20: puudulikust võtmest cursorit ei sünni", () => {
  assert.equal(encodeListCursor({ updatedAt: at(10), id: "", boundary: at(50) }), null);
  assert.equal(encodeListCursor({ updatedAt: "mitte kuupäev", id: "c1", boundary: at(50) }), null);
  assert.equal(encodeListCursor({ updatedAt: at(10), id: "c1", boundary: null }), null);
});
