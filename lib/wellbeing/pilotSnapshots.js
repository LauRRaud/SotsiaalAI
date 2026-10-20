/**
 * Piloodi kvartali hetktõmmis (arendusettepanek ptk 8.22–8.23).
 *
 * MIS OLI. Piloodi vaataja sai valida kuu, kvartali, aasta või „kõik“ ja iga
 * päring arvutati elavalt. Lahtrisummutus kaitseb ÜHTE päringut, mitte kahe
 * päringu vahet: kvartal miinus oktoober andis novembri ainsa vastaja vastuse,
 * ja sama kvartal kahel eri päeval andis vahepeal lisandunud või loobunud
 * inimese panuse.
 *
 * MIS SIIN ON. Vaataja näeb ainult LÕPPENUD kvartalit ja see arvutatakse üks
 * kord, esimesel vaatamisel pärast kvartali lõppu (taustatööd on avamisvärava
 * taga, seega laisalt). Lõppenud kvartalisse uusi kirjeid ei tule (`createdAt`
 * on loomise aeg). Hilisem kustutus või koondist loobumine külmutatud aruannet
 * ei muuda: ümberarvutus paljastaks vahena just selle inimese panuse.
 *
 * Kärbitud koondit (kaitsepiir täis) ei külmutata: igavesti pooliku aruande
 * asemel arvutatakse ta iga kord ja aruanne ütleb, et ta on poolik.
 */

import { prisma as defaultPrisma } from "../prisma.js";

export const LEGACY_SNAPSHOT_SCOPE_KEY = "legacy";

function keyWhere({ scopeKey, roleGroup, periodYear, periodQuarter }) {
  return {
    scopeKey_roleGroup_periodYear_periodQuarter: { scopeKey, roleGroup, periodYear, periodQuarter }
  };
}

function toSnapshot(row, created) {
  return {
    dataset: row.dataset,
    offeredMeasures: Array.isArray(row.offeredMeasures) ? row.offeredMeasures : null,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    created,
    frozen: true
  };
}

/**
 * Loeb kvartali hetktõmmise või arvutab ja salvestab selle.
 *
 * @param key `{ scopeKey, pilotScopeId, roleGroup, periodYear, periodQuarter }`
 * @param compute `async () => ({ dataset, offeredMeasures })` — käib ainult siis, kui hetktõmmist veel ei ole
 * @returns `{ dataset, offeredMeasures, createdAt, created, frozen }`
 */
export async function readOrCreateWellbeingPilotSnapshot(key, compute, options = {}) {
  const prisma = options.prisma || defaultPrisma;
  const where = keyWhere(key);
  const existing = await prisma.wellbeingPilotSnapshot.findUnique({ where });
  if (existing) return toSnapshot(existing, false);

  const { dataset, offeredMeasures = null } = await compute();
  if (dataset?.truncated) {
    return { dataset, offeredMeasures, createdAt: null, created: false, frozen: false };
  }
  try {
    const row = await prisma.wellbeingPilotSnapshot.create({
      data: {
        scopeKey: key.scopeKey,
        pilotScopeId: key.pilotScopeId || null,
        roleGroup: key.roleGroup,
        periodYear: key.periodYear,
        periodQuarter: key.periodQuarter,
        /* JSON-i kaudu: kuupäevad muutuvad ISO-tekstiks samamoodi nagu API vastuses. */
        dataset: JSON.parse(JSON.stringify(dataset)),
        offeredMeasures: Array.isArray(offeredMeasures) ? offeredMeasures : undefined
      }
    });
    return toSnapshot(row, true);
  } catch (error) {
    /* Kaks samaaegset esimest vaatamist: teine loeb esimese salvestatud
       hetktõmmise, et mõlemad näeksid sama aruannet. */
    if (error?.code === "P2002") {
      const row = await prisma.wellbeingPilotSnapshot.findUnique({ where });
      if (row) return toSnapshot(row, false);
    }
    throw error;
  }
}
