/**
 * JTA-V1 (E6) — ülekandeauditi teenusleping.
 *
 * KOLM LUBADUST, MIS KATKEVAD VAIKSELT, kui neid ei testita:
 *
 *   1. AUDIT EI KANNA SISU (L8). Väärtuse lisamine auditiritta ei anna ühtegi
 *      veateadet — ta lihtsalt elab üle E7 sisu-purge'i ja teeb tabelist
 *      varju-registri. Kontroll käib ANDMETE, mitte kutsete tasemel: iga välja
 *      tekst otsitakse auditirea seest üles.
 *
 *   2. ÜKS TEGU = ÜKS RIDA (L22). Kaks rida ühe kopeerimise kohta on sama katki
 *      nagu puuduv rida, ainult vastupidises suunas — ja hiljem ei ole kummastki
 *      võimalik aru saada, kumb juhtus. Jõustaja on unikaalne INDEKS, seega
 *      testib seda ka kutse, mis läheb teenuskihist mööda.
 *
 *   3. `ULE_KANTUD` EI SAA EKSISTEERIDA ILMA AUDITIREATA (L18/L19). Tehingu
 *      tagasiveeremine peab võtma kaasa MÕLEMAD; siire ilma auditita paneks
 *      säilituskella käima tõendita ülekande peal.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { PROVENANCE } from "../../lib/workspaces/provenance.js";
import { CASEWORK_FLAG_KEYS } from "../../lib/casework/flags.js";
import { DRAFT_TYPE, createDraft, setField, transitionDraft } from "../../lib/casework/caseWorkDraft.js";
import {
  TRANSFER_EVENT_KIND,
  buildStar2Block,
  listTransferEvents,
  listTransferEventsForOwner,
  markTransferred,
  recordCopyEvent
} from "../../lib/casework/caseWorkTransfer.js";

const OWNER = "worker_a";
const CASE_ID = "case_1";
const ACTION_KEY = "3f6d1c2a-1111-4222-8333-444455556666";
const OTHER_KEY = "3f6d1c2a-1111-4222-8333-444455559999";

function withFeatureOn(fn) {
  return async (...args) => {
    const previous = {
      flag: process.env[CASEWORK_FLAG_KEYS.ENABLED],
      outbox: process.env.U1_OUTBOX_ENABLED
    };
    process.env[CASEWORK_FLAG_KEYS.ENABLED] = "1";
    /* U1 sees, sest üks lepingurida on „`markTransferred` emiteerib sündmuse,
       `recordCopyEvent` mitte" (L9) — väljas lipuga oleks see test tautoloogia. */
    process.env.U1_OUTBOX_ENABLED = "1";
    try {
      return await fn(...args);
    } finally {
      if (previous.flag === undefined) delete process.env[CASEWORK_FLAG_KEYS.ENABLED];
      else process.env[CASEWORK_FLAG_KEYS.ENABLED] = previous.flag;
      if (previous.outbox === undefined) delete process.env.U1_OUTBOX_ENABLED;
      else process.env.U1_OUTBOX_ENABLED = previous.outbox;
    }
  };
}

/**
 * Fake-Prisma, mis jõustab KAHTE asja päris andmebaasi kombel:
 *   - unikaalne indeks `[draftId, clientActionId]` → `P2002`
 *   - tehingu TAGASIVEEREMINE → tabelite hetktõmmis taastatakse
 *
 * Ilma nendeta oleks L22 ja L18 test ainult teenuskihi harude kontroll — ja
 * just need harud on need, mis päris andmebaasis ei pruugi kehtida.
 */
function db({
  assists = [{ id: CASE_ID, ownerUserId: OWNER, retentionState: "ACTIVE" }],
  drafts = [],
  fields = [],
  events = [],
  domainEvents = [],
  failEventCreate = false,
  failDomainEventCreate = false
} = {}) {
  let sequence = 0;
  const nextId = (prefix) => `${prefix}_${++sequence}`;
  const matchWhere = (row, where) =>
    Object.entries(where).every(([key, value]) => {
      if (value === undefined) return true;
      if (value && typeof value === "object" && Array.isArray(value.notIn)) return !value.notIn.includes(row[key]);
      return row[key] === value;
    });

  const collection = (rows, prefix, defaults = {}) => ({
    async create({ data }) {
      const row = { id: nextId(prefix), createdAt: new Date(), updatedAt: new Date(), ...defaults, ...data };
      rows.push(row);
      return row;
    },
    async findFirst({ where }) {
      return rows.find((row) => matchWhere(row, where)) || null;
    },
    async findMany({ where = {} }) {
      return rows.filter((row) => matchWhere(row, where));
    },
    async updateMany({ where, data }) {
      const matching = rows.filter((row) => matchWhere(row, where));
      for (const row of matching) Object.assign(row, data, { updatedAt: new Date() });
      return { count: matching.length };
    },
    async deleteMany({ where }) {
      const keep = rows.filter((row) => !matchWhere(row, where));
      const removed = rows.length - keep.length;
      rows.length = 0;
      rows.push(...keep);
      return { count: removed };
    },
    async upsert({ where, create, update }) {
      const key = where.draftId_fieldKey;
      const existing = rows.find((row) => row.draftId === key.draftId && row.fieldKey === key.fieldKey);
      if (existing) {
        Object.assign(existing, update, { updatedAt: new Date() });
        return existing;
      }
      const row = { id: nextId(prefix), createdAt: new Date(), updatedAt: new Date(), ...create };
      rows.push(row);
      return row;
    }
  });

  const transferEvents = collection(events, "event");
  const baseCreate = transferEvents.create;
  transferEvents.create = async ({ data }) => {
    if (failEventCreate) throw new Error("audit write failed");
    /* UNIKAALNE INDEKS. `NULL` on Postgresis eristuv, seega kaks
       `MARKED_AS_TRANSFERRED` rida (võti `null`) EI põrka — täpselt see, mida
       L22 skeemiotsus lubab. */
    if (data.clientActionId != null) {
      const clash = events.find(
        (row) => row.draftId === data.draftId && row.clientActionId === data.clientActionId
      );
      if (clash) {
        const error = new Error("Unique constraint failed");
        error.code = "P2002";
        throw error;
      }
    }
    return baseCreate({ data });
  };

  /* SOL-CW-04 veasüst: outbox-rea kirjutus kukub. Enne parandust jäi see viga
     teise, commit'i-järgse tehingu sisse ja neelati alla. */
  const outbox = collection(domainEvents, "domain_event");
  const baseOutboxCreate = outbox.create;
  outbox.create = async (args) => {
    if (failDomainEventCreate) throw new Error("outbox write failed");
    return baseOutboxCreate(args);
  };

  const database = {
    assists,
    drafts,
    fields,
    events,
    domainEvents,
    async $transaction(callback) {
      /* TAGASIVEEREMINE ON PÄRIS: hetktõmmis enne, taastamine erindi korral. */
      const snapshot = {
        drafts: drafts.map((row) => ({ ...row })),
        fields: fields.map((row) => ({ ...row })),
        events: events.map((row) => ({ ...row })),
        domainEvents: domainEvents.map((row) => ({ ...row }))
      };
      try {
        return await callback(database);
      } catch (error) {
        for (const [key, value] of Object.entries(snapshot)) {
          const target = database[key];
          target.length = 0;
          target.push(...value);
        }
        throw error;
      }
    },
    caseWorkAssist: {
      async findFirst({ where }) {
        return assists.find((row) => row.id === where.id && row.ownerUserId === where.ownerUserId) || null;
      },
      async updateMany({ where }) {
        const matching = assists.filter(
          (row) =>
            row.id === where.id &&
            row.ownerUserId === where.ownerUserId &&
            (where.retentionState === undefined || row.retentionState === where.retentionState)
        );
        return { count: matching.length };
      }
    },
    caseWorkDraft: collection(drafts, "draft", {
      transferState: "MUSTAND",
      reviewKind: null,
      transferredAt: null,
      contentPurgedAt: null
    }),
    caseWorkDraftField: collection(fields, "field"),
    caseWorkTransferEvent: transferEvents,
    domainEvent: outbox
  };

  return database;
}

async function rejects(promise, status, messageKey) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.status, status, `oodatud ${status}, saadi ${error.status} (${error.messageKey})`);
    if (messageKey) assert.equal(error.messageKey, messageKey);
    return true;
  });
}

async function seed(store, { fields = [["EESMARK", "Klient soovib tuge"]], advanceTo = null } = {}) {
  const draft = await createDraft({
    ownerUserId: OWNER,
    caseWorkAssistId: CASE_ID,
    draftType: DRAFT_TYPE.EESMARGI_SONASTUS,
    db: store
  });
  const base = { ownerUserId: OWNER, caseWorkAssistId: CASE_ID, draftId: draft.id, db: store };

  for (const [fieldKey, text] of fields) {
    await setField({ ...base, fieldKey, text, provenance: PROVENANCE.TOOTAJA_TAHELEPANEK });
  }

  if (advanceTo) {
    const road = ["MUSTAND", "VAJAB_KONTROLLI", "KONTROLLITUD", "VALMIS_ULEKANDEKS"];
    for (let i = 0; road[i] !== advanceTo; i += 1) {
      await transitionDraft({ ...base, expectedFrom: road[i], to: road[i + 1] });
    }
  }

  return { draft, base };
}

/* ── plokk ──────────────────────────────────────────────────────────────── */

test(
  "plokk algab hoiatusega ja kannab väljad, MITTE privaatset kihti",
  withFeatureOn(async () => {
    const store = db();
    const { base } = await seed(store, {
      fields: [
        ["EESMARK", "Klient soovib tuge"],
        ["TEGEVUS", "Kokku lepitud kohtumine"]
      ]
    });

    const block = await buildStar2Block({ ...base, locale: "et" });

    const [firstLine] = block.text.split("\n");
    assert.ok(firstLine.trim().length > 0, "esimene rida on tühi — hoiatust ei ole");
    assert.ok(!/^EESMARK:/.test(firstLine), "esimene rida on väli, mitte hoiatus");
    assert.ok(block.text.includes("EESMARK: Klient soovib tuge"));
    assert.deepEqual(block.fieldKeys, ["EESMARK", "TEGEVUS"]);

    /* L5/E4 lubadus: privaatne refleksioon ei jõua STAR2 ekspordini ÜHESKI
       vormis. Siin on ta struktuurne — märkme kihid ja mustandi väljad on eri
       tabelites — ja see test hoiab ära, et keegi ehitaks silla. */
    assert.ok(!block.text.includes("PRIVAATNE_REFLEKSIOON"));
  })
);

/* ── kopeerimise audit (L8, L16, L22) ───────────────────────────────────── */

test(
  "auditirida ei sisalda ÜHTEGI välja väärtust",
  withFeatureOn(async () => {
    const store = db();
    const { base } = await seed(store, {
      fields: [
        ["EESMARK", "Kliendi enda sõnastatud eesmärk"],
        ["TEGEVUS", "Väga eristuv tekstijupp 12345"]
      ]
    });

    await recordCopyEvent({ ...base, fieldKeys: ["EESMARK", "TEGEVUS"], clientActionId: ACTION_KEY });

    const [row] = store.events;
    const serialized = JSON.stringify(row);
    for (const field of store.fields) {
      assert.ok(!serialized.includes(field.text), `auditireas on välja VÄÄRTUS: ${field.fieldKey}`);
    }
    assert.deepEqual(row.fieldKeys, ["EESMARK", "TEGEVUS"]);
    assert.equal(row.kind, TRANSFER_EVENT_KIND.COPIED_FOR_STAR2);
  })
);

test(
  "kopeerimine EI MUUDA seisu ega emiteeri sündmust (L9)",
  withFeatureOn(async () => {
    const store = db();
    const { base } = await seed(store, { advanceTo: "VALMIS_ULEKANDEKS" });

    await recordCopyEvent({ ...base, fieldKeys: ["EESMARK"], clientActionId: ACTION_KEY });

    assert.equal(store.drafts[0].transferState, "VALMIS_ULEKANDEKS");
    assert.equal(store.drafts[0].transferredAt, null);
    assert.equal(store.domainEvents.length, 0, "kopeerimine emiteeris sündmuse");
  })
);

test(
  "L22: sama `clientActionId` kaks korda annab ÜHE rea ja sama id",
  withFeatureOn(async () => {
    const store = db();
    const { base } = await seed(store);

    const first = await recordCopyEvent({ ...base, fieldKeys: ["EESMARK"], clientActionId: ACTION_KEY });
    const second = await recordCopyEvent({ ...base, fieldKeys: ["EESMARK"], clientActionId: ACTION_KEY });

    assert.equal(first.created, true);
    assert.equal(second.created, false, "kordus lõi teise rea");
    assert.equal(second.event.id, first.event.id);
    assert.equal(store.events.length, 1);
  })
);

test(
  "SOL-CW-06: sama võti ERI väljadega annab 409, mitte vaikset 200",
  withFeatureOn(async () => {
    /* Ilma payload'i kontrollita tagastaks teine kutse eelmise kopeerimise
       auditirea ja teine tegu jääks jäädavalt tõendita. */
    const store = db();
    const { base } = await seed(store, {
      fields: [
        ["EESMARK", "Klient soovib tuge"],
        ["OLUKORD", "Elamistingimused"]
      ]
    });

    const first = await recordCopyEvent({ ...base, fieldKeys: ["EESMARK"], clientActionId: ACTION_KEY });
    assert.equal(first.created, true);

    await rejects(
      recordCopyEvent({ ...base, fieldKeys: ["OLUKORD"], clientActionId: ACTION_KEY }),
      409,
      "casework.errors.transfer_action_key_conflict"
    );
    assert.equal(store.events.length, 1, "vastuoluline kutse ei tohi rida lisada");
    assert.deepEqual(store.events[0].fieldKeys, ["EESMARK"], "esimese teo audit muutus");
  })
);

test(
  "SOL-CW-06: sama võti sama väljade JÄRJEKORRAGA on idempotentne, teine järjekord ei ole",
  withFeatureOn(async () => {
    const store = db();
    const { base } = await seed(store, {
      fields: [
        ["EESMARK", "Klient soovib tuge"],
        ["OLUKORD", "Elamistingimused"]
      ]
    });
    const keys = ["EESMARK", "OLUKORD"];

    const first = await recordCopyEvent({ ...base, fieldKeys: keys, clientActionId: ACTION_KEY });
    const repeat = await recordCopyEvent({ ...base, fieldKeys: [...keys], clientActionId: ACTION_KEY });
    assert.equal(repeat.created, false, "täpselt sama tegu peab jääma idempotentseks");
    assert.equal(repeat.event.id, first.event.id);

    await rejects(
      recordCopyEvent({ ...base, fieldKeys: ["OLUKORD", "EESMARK"], clientActionId: ACTION_KEY }),
      409,
      "casework.errors.transfer_action_key_conflict"
    );
    assert.equal(store.events.length, 1);
  })
);

test(
  "L22: kaks ERI võtit annavad kaks rida — päris korduskopeerimine on lubatud",
  withFeatureOn(async () => {
    const store = db();
    const { base } = await seed(store);

    await recordCopyEvent({ ...base, fieldKeys: ["EESMARK"], clientActionId: ACTION_KEY });
    await recordCopyEvent({ ...base, fieldKeys: ["EESMARK"], clientActionId: OTHER_KEY });

    assert.equal(store.events.length, 2);
  })
);

test(
  "L22: puuduv või vigase kujuga võti annab 400 ja rida EI TEKI",
  withFeatureOn(async () => {
    const store = db();
    const { base } = await seed(store);

    await rejects(
      recordCopyEvent({ ...base, fieldKeys: ["EESMARK"], clientActionId: null }),
      400,
      "casework.errors.transfer_action_key_invalid"
    );
    await rejects(
      recordCopyEvent({ ...base, fieldKeys: ["EESMARK"], clientActionId: "1234" }),
      400,
      "casework.errors.transfer_action_key_invalid"
    );
    assert.equal(store.events.length, 0);
  })
);

test(
  "L22 jõustaja on INDEKS — teenuskihist mööda kirjutades keeldub andmebaas",
  withFeatureOn(async () => {
    const store = db();
    const { base, draft } = await seed(store);

    await recordCopyEvent({ ...base, fieldKeys: ["EESMARK"], clientActionId: ACTION_KEY });

    /* Otse tabelisse, teenuskihi valideerimisest mööda. Kui unikaalsust hoiaks
       ainult teenuskiht, läheks see rida läbi ja audit loeks ühe teo kaheks. */
    await assert.rejects(
      store.caseWorkTransferEvent.create({
        data: {
          caseWorkAssistId: CASE_ID,
          draftId: draft.id,
          ownerUserId: OWNER,
          actorUserId: OWNER,
          kind: TRANSFER_EVENT_KIND.COPIED_FOR_STAR2,
          draftType: DRAFT_TYPE.EESMARGI_SONASTUS,
          transferStateAtEvent: "MUSTAND",
          fieldKeys: ["EESMARK"],
          clientActionId: ACTION_KEY
        }
      }),
      (error) => error.code === "P2002"
    );
    assert.equal(store.events.length, 1);
  })
);

test(
  "L22: kaks `MARKED_AS_TRANSFERRED` rida võtmeta EI PÕRKA",
  withFeatureOn(async () => {
    const store = db();
    const { draft } = await seed(store);

    const row = {
      caseWorkAssistId: CASE_ID,
      draftId: draft.id,
      ownerUserId: OWNER,
      actorUserId: OWNER,
      kind: TRANSFER_EVENT_KIND.MARKED_AS_TRANSFERRED,
      draftType: DRAFT_TYPE.EESMARGI_SONASTUS,
      transferStateAtEvent: "VALMIS_ULEKANDEKS",
      fieldKeys: [],
      clientActionId: null
    };

    /* See test hoiab ära, et keegi teeks veeru hiljem `NOT NULL`-iks või
       lisaks „null loeb kokkupõrkeks" kontrolli teenuskihti. */
    await store.caseWorkTransferEvent.create({ data: row });
    await store.caseWorkTransferEvent.create({ data: row });
    assert.equal(store.events.length, 2);
  })
);

test(
  "võõra mustandi väli annab 400 ja tühi loend samuti",
  withFeatureOn(async () => {
    const store = db();
    const { base } = await seed(store);

    await rejects(
      recordCopyEvent({ ...base, fieldKeys: ["MUU_VALI"], clientActionId: ACTION_KEY }),
      400,
      "casework.errors.transfer_field_keys_unknown"
    );
    await rejects(
      recordCopyEvent({ ...base, fieldKeys: [], clientActionId: ACTION_KEY }),
      400,
      "casework.errors.transfer_field_keys_required"
    );
    assert.equal(store.events.length, 0);
  })
);

test(
  "võõra juhtumi mustand annab 404, mitte 403",
  withFeatureOn(async () => {
    const store = db();
    const { draft } = await seed(store);

    const stranger = { ownerUserId: "worker_b", caseWorkAssistId: CASE_ID, draftId: draft.id, db: store };
    await rejects(buildStar2Block(stranger), 404);
    await rejects(recordCopyEvent({ ...stranger, fieldKeys: ["EESMARK"], clientActionId: ACTION_KEY }), 404);
    await rejects(markTransferred({ ...stranger, expectedFrom: "VALMIS_ULEKANDEKS" }), 404);
    await rejects(listTransferEvents({ ownerUserId: "worker_b", caseWorkAssistId: CASE_ID, db: store }), 404);
  })
);

/* ── ülekantuks märkimine (L18, L19) ────────────────────────────────────── */

test(
  "`markTransferred` paneb seisu, aja ja auditirea ÜHES tehingus",
  withFeatureOn(async () => {
    const store = db();
    const { base } = await seed(store, { advanceTo: "VALMIS_ULEKANDEKS" });

    const { draft, event } = await markTransferred({ ...base, expectedFrom: "VALMIS_ULEKANDEKS" });

    assert.equal(draft.transferState, "ULE_KANTUD");
    assert.ok(draft.transferredAt instanceof Date, "transferredAt jäi panemata");
    assert.equal(event.kind, TRANSFER_EVENT_KIND.MARKED_AS_TRANSFERRED);
    /* Seis, MILLEST märgiti — `ULE_KANTUD` oleks tautoloogia. */
    assert.equal(event.transferStateAtEvent, "VALMIS_ULEKANDEKS");
    assert.deepEqual(event.fieldKeys, []);
    assert.equal(store.domainEvents.length, 1, "U1 sündmus jäi emiteerimata");
    assert.equal(store.domainEvents[0].type, "casework.draft.external_transfer_marked");
  })
);

test(
  "tehingu TAGASIVEEREMINE ei jäta ei olekusiiret ega auditirida",
  withFeatureOn(async () => {
    const store = db({ failEventCreate: true });
    const { base } = await seed(store, { advanceTo: "VALMIS_ULEKANDEKS" });

    await assert.rejects(markTransferred({ ...base, expectedFrom: "VALMIS_ULEKANDEKS" }));

    /* KANDEV KONTROLL. Kui siire ja audit ei ole samas tehingus, jääb siin
       mustand `ULE_KANTUD`-iks ilma ühegi tõendita — ja L7 säilituskell hakkab
       käima ülekande peal, mida keegi ei teinud. */
    assert.equal(store.drafts[0].transferState, "VALMIS_ULEKANDEKS");
    assert.equal(store.drafts[0].transferredAt, null);
    assert.equal(store.events.length, 0);
  })
);

test(
  "SOL-CW-04: outbox-sündmuse kirjutuse viga veeretab KOGU ülekande tagasi",
  withFeatureOn(async () => {
    /* Enne parandust emiteeriti sündmus PÄRAST commit'i, eraldi tehingus, ja
       viga neelati alla: API vastas eduga, mustand jäi `ULE_KANTUD`-iks ja
       ajajoone-/teavitussündmus kadus jäädavalt ilma ühegi taastajata. */
    const store = db({ failDomainEventCreate: true });
    const { base } = await seed(store, { advanceTo: "VALMIS_ULEKANDEKS" });

    await assert.rejects(
      markTransferred({ ...base, expectedFrom: "VALMIS_ULEKANDEKS" }),
      /outbox write failed/,
      "vaikne osaline edu: kutse õnnestus, kuigi sündmus jäi kirjutamata"
    );

    assert.equal(store.drafts[0].transferState, "VALMIS_ULEKANDEKS", "seis muutus ilma sündmuseta");
    assert.equal(store.drafts[0].transferredAt, null, "transferredAt jäi ilma sündmuseta külge");
    assert.equal(store.events.length, 0, "auditirida jäi ilma sündmuseta alles");
    assert.equal(store.domainEvents.length, 0);
  })
);

test(
  "SOL-CW-04: kordus pärast outbox-viga õnnestub tervikuna",
  withFeatureOn(async () => {
    /* Aus 500 on kasutatav ainult siis, kui kordus töötab: tagasiveeremise
       järel peab sama `expectedFrom` uuesti läbi minema ja andma nii seisu,
       auditirea kui sündmuse. */
    const store = db({ failDomainEventCreate: true });
    const { base } = await seed(store, { advanceTo: "VALMIS_ULEKANDEKS" });
    await assert.rejects(markTransferred({ ...base, expectedFrom: "VALMIS_ULEKANDEKS" }));

    const healthy = db({
      assists: store.assists,
      drafts: store.drafts,
      fields: store.fields,
      events: store.events,
      domainEvents: store.domainEvents
    });
    const { draft } = await markTransferred({ ...base, db: healthy, expectedFrom: "VALMIS_ULEKANDEKS" });

    assert.equal(draft.transferState, "ULE_KANTUD");
    assert.equal(healthy.events.length, 1, "auditirida puudub");
    assert.equal(healthy.domainEvents.length, 1, "sündmus puudub");
  })
);

test(
  "SOL-CW-04: sündmus ja auditirida sünnivad SAMAS tehingus",
  withFeatureOn(async () => {
    /* Kui sündmus liiguks tagasi commit'i-järgsesse tehingusse, näeks
       `$transaction` kutseid kaks. Üks tehing = üks atomaarne piir. */
    const store = db();
    let transactions = 0;
    const original = store.$transaction.bind(store);
    store.$transaction = async (callback) => {
      transactions += 1;
      return original(callback);
    };
    const { base } = await seed(store, { advanceTo: "VALMIS_ULEKANDEKS" });
    transactions = 0;

    await markTransferred({ ...base, expectedFrom: "VALMIS_ULEKANDEKS" });

    assert.equal(transactions, 1, "ülekanne kasutab rohkem kui üht tehingut");
    assert.equal(store.events.length, 1);
    assert.equal(store.domainEvents.length, 1);
  })
);

test(
  "teine `markTransferred` sama `expectedFrom` pealt annab 409, teist rida ei teki",
  withFeatureOn(async () => {
    const store = db();
    const { base } = await seed(store, { advanceTo: "VALMIS_ULEKANDEKS" });

    await markTransferred({ ...base, expectedFrom: "VALMIS_ULEKANDEKS" });
    await rejects(
      markTransferred({ ...base, expectedFrom: "VALMIS_ULEKANDEKS" }),
      409,
      "casework.errors.transfer_state_conflict"
    );

    assert.equal(store.events.length, 1);
    assert.equal(store.drafts[0].transferState, "ULE_KANTUD");
  })
);

test(
  "ebaseaduslikust seisust ei saa üle kanda ja seis ei muutu",
  withFeatureOn(async () => {
    const store = db();
    const { base } = await seed(store);

    await rejects(
      markTransferred({ ...base, expectedFrom: "MUSTAND" }),
      400,
      "casework.errors.transfer_transition_illegal"
    );
    assert.equal(store.drafts[0].transferState, "MUSTAND");
    assert.equal(store.events.length, 0);
  })
);

test(
  "ÜKSKI `ULE_KANTUD` mustand ei eksisteeri ilma auditireata — kontroll andmete tasemel",
  withFeatureOn(async () => {
    const store = db();
    const a = await seed(store, { advanceTo: "VALMIS_ULEKANDEKS" });
    const b = await seed(store, { advanceTo: "VALMIS_ULEKANDEKS" });

    await markTransferred({ ...a.base, expectedFrom: "VALMIS_ULEKANDEKS" });
    /* Teine mustand jääb `VALMIS_ULEKANDEKS`-i: `transitionDraft` keeldub
       `ULE_KANTUD`-ist 400-ga (L19), seega teist ust ei ole. */
    await rejects(transitionDraft({ ...b.base, expectedFrom: "VALMIS_ULEKANDEKS", to: "ULE_KANTUD" }), 400);

    const transferred = store.drafts.filter((row) => row.transferState === "ULE_KANTUD");
    assert.equal(transferred.length, 1);
    for (const draft of transferred) {
      const proof = store.events.find(
        (row) => row.draftId === draft.id && row.kind === TRANSFER_EVENT_KIND.MARKED_AS_TRANSFERRED
      );
      assert.ok(proof, `ülekantud mustand ilma auditireata: ${draft.id}`);
    }
  })
);

/* ── ajalugu ────────────────────────────────────────────────────────────── */

test(
  "ajalugu on append-only: moodulil EI OLE update- ega delete-rada",
  async () => {
    const transfer = await import("../../lib/casework/caseWorkTransfer.js");
    assert.equal(transfer.updateTransferEvent, undefined);
    assert.equal(transfer.deleteTransferEvent, undefined);
    assert.equal(transfer.removeTransferEvent, undefined);
  }
);

test(
  "ajalugu tagastab omaniku read ja EI KANNA väärtusi",
  withFeatureOn(async () => {
    const store = db();
    const { base } = await seed(store, { fields: [["EESMARK", "Väga eristuv tekstijupp 12345"]] });

    await recordCopyEvent({ ...base, fieldKeys: ["EESMARK"], clientActionId: ACTION_KEY });

    const { items } = await listTransferEvents({ ownerUserId: OWNER, caseWorkAssistId: CASE_ID, db: store });
    assert.equal(items.length, 1);
    assert.ok(!JSON.stringify(items).includes("Väga eristuv tekstijupp 12345"));

    const owned = await listTransferEventsForOwner({ ownerUserId: OWNER, db: store });
    assert.equal(owned.items.length, 1);

    const foreign = await listTransferEventsForOwner({ ownerUserId: "worker_b", db: store });
    assert.equal(foreign.items.length, 0, "võõras nägi laual teise töötaja ülekannet");
  })
);

test(
  "värav väljas: ükski operatsioon ei tööta",
  async () => {
    const store = db();
    const base = { ownerUserId: OWNER, caseWorkAssistId: CASE_ID, draftId: "draft_1", db: store };
    await rejects(buildStar2Block(base), 404);
    await rejects(recordCopyEvent({ ...base, fieldKeys: ["EESMARK"], clientActionId: ACTION_KEY }), 404);
    await rejects(markTransferred({ ...base, expectedFrom: "VALMIS_ULEKANDEKS" }), 404);
    await rejects(listTransferEvents({ ownerUserId: OWNER, caseWorkAssistId: CASE_ID, db: store }), 404);
  }
);
