import { validateDomainEventInput } from "@/lib/events/registry";

function enabled(value) {
  return ["1", "true", "on", "yes"].includes(String(value ?? "false").trim().toLowerCase());
}

function isUniqueConflict(error) {
  return error?.code === "P2002" || error?.name === "UniqueConstraintError";
}

function assertTransactionClient(tx) {
  /* `findUnique` on nüüd sama kohustuslik kui `create`: idempotentsus kontrollitakse
     ENNE kirjutamist ja klient, kellel seda meetodit ei ole, jätaks kontrolli vaikselt
     tegemata. Puuduv võimekus on siin viga, mitte haru. */
  if (!tx?.domainEvent?.create || !tx?.domainEvent?.findUnique || typeof tx.$connect === "function") {
    const error = new TypeError("emitDomainEvent requires a Prisma transaction client");
    error.code = "DOMAIN_EVENT_TX_REQUIRED";
    throw error;
  }
}

/* SOL-EVENT-01. Sama idempotentsusvõti tohib olla edukalt korduv AINULT siis, kui ta
   kirjeldab sama tegu. Identiteet on kogu salvestatav kuju, millest on välja jäetud
   ainult `occurredAt`.

   MIKS AEG EI OLE OSA TEOIDENTITEEDIST. `occurredAt` ütleb, millal me sündmust
   MÄRKASIME, mitte MIS juhtus. Kutsuja, kes aega ei anna (nt casework, kelle võti on
   auditirea id), saab vaikimisi `new Date()` — kordus pärast kukkunud tehingut annaks
   siis paratamatult uue aja ja aja võrdlemine muudaks just selle korduse, mille jaoks
   idempotentsus olemas on, kõvaks konfliktiks. Kutsujad, kelle jaoks aeg ON teo osa
   (teekond, eelpöördumine), panevad ta ISE võtme sisse — seal eristab aja juba võti.

   Kõik ülejäänu on sees VÄLISTAMISE, mitte lubamise kaudu: uus väli `data`-s satub
   võrdlusesse iseenesest ja ei teki vaikset auku. */
const IDENTITY_EXCLUDED = new Set(["occurredAt"]);

function canonical(value) {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (typeof value === "object") {
    const result = {};
    for (const key of Object.keys(value).sort()) {
      const item = canonical(value[key]);
      if (item !== null) result[key] = item;
    }
    /* Tühi meta, puuduv meta ja JSON-null on üks ja sama „metaandmeid ei ole" —
       muidu annaks `{}` vs `null` konflikti seal, kus midagi ei muutunud. */
    return Object.keys(result).length ? result : null;
  }
  return value;
}

function identity(source, keys) {
  const result = {};
  for (const key of keys) {
    if (IDENTITY_EXCLUDED.has(key)) continue;
    result[key] = canonical(source?.[key]);
  }
  return result;
}

function differingFields(stored, wanted) {
  const names = new Set([...Object.keys(stored), ...Object.keys(wanted)]);
  const differing = [];
  for (const name of names) {
    /* `canonical` järjestab võtmed, seega on JSON siin stabiilne võrdlusvorm. */
    if (JSON.stringify(stored[name] ?? null) !== JSON.stringify(wanted[name] ?? null)) {
      differing.push(name);
    }
  }
  return differing.sort();
}

export async function emitDomainEvent(tx, input = {}) {
  if (!enabled(process.env.U1_OUTBOX_ENABLED)) {
    return { emitted: false, created: false, disabled: true, event: null };
  }
  assertTransactionClient(tx);
  const value = validateDomainEventInput(input);
  const occurredAt = input.occurredAt instanceof Date ? input.occurredAt : new Date();
  if (!Number.isFinite(occurredAt.getTime())) {
    throw Object.assign(new TypeError("Invalid event occurrence time"), { code: "INVALID_EVENT_TIME" });
  }
  const data = {
    type: value.type,
    version: value.eventSpec.version,
    occurredAt,
    actorKind: value.actorKind,
    actorUserId: value.actorUserId,
    sourceFeature: value.eventSpec.sourceFeature,
    sourceType: value.eventSpec.sourceType,
    sourceId: value.sourceId,
    workspaceKind: input.workspaceKind ?? value.eventSpec.workspaceKind ?? null,
    workspaceId: value.workspaceId,
    audienceRule: value.eventSpec.audienceRule,
    audienceHint: null,
    visibilityClass: value.eventSpec.visibilityClass,
    actionKind: value.eventSpec.actionKind,
    actionTarget: value.actionTarget,
    idempotencyKey: value.idempotencyKey,
    retentionClass: value.eventSpec.retentionClass,
    meta: Object.keys(value.meta).length ? value.meta : undefined
  };

  /* Olemasolu küsitakse ENNE `create`-i, mitte `P2002` püüdmise kaudu. Kaks põhjust:
       1. SOL-EVENT-01 — teistsuguse teo peal peab tulema konflikt, mitte näiline edu,
          ja seda saab öelda ainult siis, kui olemasolev rida on käes;
       2. `create` → `catch (P2002)` → `findUnique` on SAMA TEHINGU sees vaikne
          andmekadu: Postgres märgib tehingu pärast unikaalsusrikkumist vigaseks ja iga
          järgnev käsk selles tehingus kukub. Vana kood „leidis" rea ainult fake-Prisma
          peal — päris andmebaasis ei jõudnud ta sinna kunagi. */
  const keys = Object.keys(data);
  const existing = await tx.domainEvent.findUnique({ where: { idempotencyKey: value.idempotencyKey } });
  if (existing) {
    const differing = differingFields(identity(existing, keys), identity(data, keys));
    if (differing.length) {
      const error = new Error(
        `Domain event idempotency key already describes a different act: ${differing.join(", ")}`
      );
      error.code = "DOMAIN_EVENT_IDEMPOTENCY_CONFLICT";
      error.idempotencyKey = value.idempotencyKey;
      error.existingEventId = existing.id ?? null;
      /* Ainult VÄLJANIMED — väärtused võivad olla isikustatud ja logi ei ole nende koht. */
      error.differingFields = differing;
      throw error;
    }
    return { emitted: true, created: false, disabled: false, event: existing };
  }

  try {
    const event = await tx.domainEvent.create({ data });
    return { emitted: true, created: true, disabled: false, event };
  } catch (error) {
    /* VÕIDUJOOKS: keegi teine jõudis sama võtmega ette pärast meie kontrolli. Siin EI
       TOHI enam midagi küsida ega edu tagastada — tehing on juba vigane. Aus vastus on
       kukkuda; kutsuja kordus leiab rea eespool oleva kontrolliga üles ja lõpeb
       idempotentselt. Märgis on ainult selleks, et logis oleks võidujooks eristatav. */
    if (isUniqueConflict(error)) error.domainEventRace = true;
    throw error;
  }
}

export const domainEventEmitterInternals = Object.freeze({ assertTransactionClient, enabled });
