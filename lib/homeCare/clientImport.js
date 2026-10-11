/**
 * KODUTEENUS K1-f — klientide nimekirja sissetoomine tabelist (teenuskiht).
 *
 * Kaks sammu, mõlemad ainult hooldusjuhile:
 *   1. EELVAADE: tabel loetakse, iga rea kohta öeldakse, mis sellest saab;
 *      midagi ei salvestata.
 *   2. SISSETOOMINE: server loeb SAMA teksti uuesti ja teeb kava uuesti (brauseri
 *      eelvaadet ei usaldata) ning loob kliendid ühes tehingus. Kas kõik uued
 *      read või mitte ühtegi.
 *
 * KORDUSED. Tunnusega rida, mille tunnus on asutuses juba olemas, jäetakse
 * vahele. Tunnuseta rida, mille nimega klient on juba olemas, tuuakse üle
 * ainult siis, kui hooldusjuht on rea eraldi kinnitanud. Seega sama faili teine
 * sissetoomine (ka pärast poolikut katset) ei tekita ühtegi kordust.
 *
 * NIMEVÕRDLUS on hooldusjuhi SKOOBIS: üksuse hooldusjuht ei saa eelvaatest
 * teada teise üksuse klientide nimesid. Tunnus on asutuses kordumatu, seega
 * selle hõivatust näeb ta nagu üksiku kliendi loomisel.
 *
 * Tabeli tekst (nimed, aadressid, telefonid) tuleb päringu kehas ja seda ei
 * logita. Iga loodud klient jätab sama auditirea mis käsitsi loodu.
 */

import prisma from "@/lib/prisma";

import { badRequest, conflict } from "../org/errors.js";

import { assertHomeCareContext, coordinatorScope } from "./access.js";
import { assertCoordinatorForUnit, createClientRow, requireOrgUnit } from "./clients.js";
import { ClientImportStatus, planClientImport, readClientTable, rowsToCreate } from "./clientTable.js";
import { asObject, normalizeOptionalId } from "./validation.js";

/** Nii palju olemasolevaid kliente loetakse võrdluseks; suurem asutus toob nimekirja osade kaupa. */
const EXISTING_MAX = 20_000;
/* Kuni 500 klienti ja sama palju auditiridu ühes tehingus: vaikimisi 5 sekundit jääks napiks. */
const IMPORT_TRANSACTION = Object.freeze({ maxWait: 5_000, timeout: 30_000 });

function readInput(context, rawInput) {
  const body = asObject(rawInput);
  const unitId = normalizeOptionalId(body.unitId, "home_care.errors.invalid_unit") || null;
  assertCoordinatorForUnit(context, unitId);
  const table = readClientTable(body.text);
  if (!table.ok) throw badRequest(table.errorKey, table.values);
  const confirmedLines = Array.isArray(body.confirmedLines)
    ? body.confirmedLines.filter((value) => Number.isInteger(value) && value > 0).slice(0, table.rows.length)
    : [];
  return { unitId, table, confirmedLines };
}

/** Asutuse tunnused (kordumatus on asutuse piires) ja hooldusjuhi skoobi nimed. */
async function loadExisting(db, context) {
  const organizationId = context.organization.id;
  const scope = coordinatorScope(context);
  const [codes, names] = await Promise.all([
    db.careClient.findMany({
      where: { organizationId, internalCode: { not: null } },
      select: { internalCode: true },
      take: EXISTING_MAX
    }),
    db.careClient.findMany({
      where: { organizationId, ...(scope?.wholeOrg ? {} : { unitId: { in: scope?.unitIds || [] } }) },
      select: { displayName: true },
      take: EXISTING_MAX
    })
  ]);
  return {
    existingCodes: new Set(codes.map((row) => row.internalCode)),
    existingNames: new Set(names.map((row) => row.displayName))
  };
}

function publicRow(row) {
  return {
    line: row.line,
    displayName: row.displayName,
    internalCode: row.internalCode,
    status: row.status,
    errorKey: row.errorKey
  };
}

/** Eelvaade: mis igast reast saaks. Midagi ei salvestata. */
export async function previewClientImport(context, rawInput = {}, { db = prisma, env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const { unitId, table } = readInput(context, rawInput);
  await requireOrgUnit(db, context, unitId);
  const plan = planClientImport(table, await loadExisting(db, context));
  return {
    columns: Object.keys(table.columns),
    ignoredHeaders: table.ignoredHeaders,
    rows: plan.rows.map(publicRow),
    summary: plan.summary
  };
}

/**
 * Sissetoomine. `confirmedLines` on tabeli reanumbrid, mille hooldusjuht
 * kinnitas, kuigi sama nimega klient on juba olemas.
 * @returns `{ created, summary }`: loodud klientide arv ja kava kokkuvõte.
 */
export async function applyClientImport(
  context,
  rawInput = {},
  { db = prisma, now = new Date(), env = process.env } = {}
) {
  assertHomeCareContext(context, { env });
  const { unitId, table, confirmedLines } = readInput(context, rawInput);

  try {
    return await db.$transaction(async (tx) => {
      const unit = await requireOrgUnit(tx, context, unitId);
      const plan = planClientImport(table, await loadExisting(tx, context));
      const rows = rowsToCreate(plan, confirmedLines);
      for (const row of rows) {
        await createClientRow(tx, context, row.data, unit, { now });
      }
      return {
        created: rows.length,
        summary: {
          ...plan.summary,
          /* Samanimelised, mida ei kinnitatud, jäid vahele. */
          sameNameSkipped: plan.rows.filter(
            (row) => row.status === ClientImportStatus.SAME_NAME && !rows.includes(row)
          ).length
        }
      };
    }, IMPORT_TRANSACTION);
  } catch (error) {
    /* Keegi lõi sama tunnusega kliendi eelvaate ja sissetoomise vahel: tehing
       on tagasi võetud, hooldusjuht teeb eelvaate uuesti. */
    if (error?.code === "P2002") throw conflict("home_care.errors.import_changed");
    throw error;
  }
}
