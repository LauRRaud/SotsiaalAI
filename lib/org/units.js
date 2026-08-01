/**
 * T25 ORG-FOUNDATION-V1 — üksuste puu invariandid.
 *
 * Kolm asja, mida andmebaas ise ei suuda kontrollida ja mis peavad seetõttu siin
 * fail-closed olema (arenduskava §5.2):
 *   1. TSÜKKEL — üksus ei tohi sattuda iseenda alampuusse;
 *   2. ORGANISATSIOONI PIIR — vanem peab kuuluma samasse organisatsiooni;
 *   3. SÜGAVUS — alampuu liigutamine ei tohi ühtegi järglast üle 3. tasandi lükata.
 *
 * Punkt 3 on koht, kus lihtne „kontrolli uue vanema sügavust" eksib: liigutades
 * kolmetasandilise haru teise vanema alla, jääb üksus ise lubatud sügavusele,
 * aga ta LAPSED kukuvad üle piiri. Seepärast arvutame siin kogu alampuu.
 */

import { MAX_UNIT_DEPTH, OrganizationUnitStatus } from "./constants.js";
import { badRequest, conflict, notFound } from "./errors.js";

/**
 * @typedef {Object} UnitRow
 * @property {string} id
 * @property {string} organizationId
 * @property {string|null} parentUnitId
 * @property {number} depth
 */

/** Indekseerib read id järgi ja ehitab lapsloendid. */
function indexUnits(units) {
  const byId = new Map();
  const childrenByParent = new Map();
  for (const unit of units) {
    byId.set(unit.id, unit);
    const parentKey = unit.parentUnitId || "";
    if (!childrenByParent.has(parentKey)) childrenByParent.set(parentKey, []);
    childrenByParent.get(parentKey).push(unit);
  }
  return { byId, childrenByParent };
}

/**
 * Kogu alampuu (kaasa arvatud juur ise) laiuti. Silmusekaitse `seen`-iga:
 * kui andmetesse on kuidagi tsükkel jõudnud, ei tohi see funktsioon rippuma jääda.
 */
export function collectSubtree(rootId, units) {
  const { childrenByParent } = indexUnits(units);
  const seen = new Set();
  const queue = [rootId];
  const result = [];

  while (queue.length) {
    const currentId = queue.shift();
    if (seen.has(currentId)) continue;
    seen.add(currentId);
    result.push(currentId);
    for (const child of childrenByParent.get(currentId) || []) {
      if (!seen.has(child.id)) queue.push(child.id);
    }
  }
  return result;
}

/** Alampuu kõrgus tasandites: leht = 1, üks lapsetasand = 2 jne. */
export function subtreeHeight(rootId, units) {
  const { byId, childrenByParent } = indexUnits(units);
  if (!byId.has(rootId)) return 0;

  let height = 0;
  let level = [rootId];
  const seen = new Set();

  while (level.length) {
    height += 1;
    const next = [];
    for (const id of level) {
      if (seen.has(id)) continue;
      seen.add(id);
      for (const child of childrenByParent.get(id) || []) {
        if (!seen.has(child.id)) next.push(child.id);
      }
    }
    level = next;
    // Kaitse rikutud andmete vastu: puu ei saa olla sügavam kui ridade arv.
    if (height > units.length + 1) break;
  }
  return height;
}

/**
 * Kas `candidateParentId` asub `unitId` alampuus? Kui jah, tekiks liigutamisest
 * tsükkel.
 */
export function wouldCreateCycle(unitId, candidateParentId, units) {
  if (!candidateParentId) return false;
  if (candidateParentId === unitId) return true;
  return collectSubtree(unitId, units).includes(candidateParentId);
}

/**
 * Kontrollib üksuse loomise või liigutamise. Viskab `OrgError`-i; tagastab
 * uue sügavuse, mille kutsuja kirjutab reale (ja millest ta arvutab alampuu
 * uued sügavused).
 *
 * @param {Object} input
 * @param {string} input.organizationId
 * @param {string|null} input.unitId `null` = uue üksuse loomine.
 * @param {string|null} input.parentUnitId
 * @param {UnitRow[]} input.units kõik selle organisatsiooni üksused
 * @returns {{ depth: number, movedUnitIds: string[] }}
 */
export function assertUnitPlacement({ organizationId, unitId = null, parentUnitId = null, units = [] }) {
  const scoped = units.filter((unit) => unit.organizationId === organizationId);

  if (!parentUnitId) {
    // Juurüksus. Alampuu, mis liigub juurele, ei saa kunagi piiri ületada,
    // aga sügavused tuleb ikka ümber arvutada.
    return {
      depth: 1,
      movedUnitIds: unitId ? collectSubtree(unitId, scoped) : []
    };
  }

  const parent = scoped.find((unit) => unit.id === parentUnitId);
  // TEADLIKULT 404, mitte 400: võõra organisatsiooni üksuse ID ei tohi anda
  // teistsugust vastust kui olematu ID (arenduskava §6, §11.1).
  if (!parent) throw notFound("org.errors.unit_not_found");

  if (parent.status === OrganizationUnitStatus.ARCHIVED) {
    throw conflict("org.errors.unit_parent_archived");
  }

  if (unitId) {
    if (parentUnitId === unitId) throw badRequest("org.errors.unit_self_parent");
    if (wouldCreateCycle(unitId, parentUnitId, scoped)) {
      throw badRequest("org.errors.unit_cycle");
    }
  }

  const newDepth = Number(parent.depth || 1) + 1;
  // Uue üksuse kõrgus on 1; olemasoleva liigutamisel arvestame kogu alampuud.
  const height = unitId ? subtreeHeight(unitId, scoped) : 1;

  if (newDepth + height - 1 > MAX_UNIT_DEPTH) {
    throw badRequest("org.errors.unit_depth_exceeded", {
      maxDepth: MAX_UNIT_DEPTH,
      attemptedDepth: newDepth + height - 1
    });
  }

  return {
    depth: newDepth,
    movedUnitIds: unitId ? collectSubtree(unitId, scoped) : []
  };
}

/**
 * Uued sügavused kogu liigutatud alampuule. Kutsuja kirjutab need ühes tehingus,
 * muidu jääks `depth` veerg valetama ja järgmine sügavuskontroll tugineks valele.
 */
export function recomputeSubtreeDepths(rootId, rootDepth, units) {
  const { childrenByParent } = indexUnits(units);
  const updates = new Map([[rootId, rootDepth]]);
  const queue = [rootId];
  const seen = new Set();

  while (queue.length) {
    const currentId = queue.shift();
    if (seen.has(currentId)) continue;
    seen.add(currentId);
    const currentDepth = updates.get(currentId);
    for (const child of childrenByParent.get(currentId) || []) {
      if (seen.has(child.id)) continue;
      updates.set(child.id, currentDepth + 1);
      queue.push(child.id);
    }
  }
  return updates;
}

/**
 * Üksuse skoobi katvus. Arenduskava §E2: „org-skoop katab kõik üksused; üksuse
 * skoop katab valitud üksuse ja selle alampuu". Õdeüksusesse EI leki (§11.3).
 */
export function unitScopeCovers(scopeUnitId, targetUnitId, units) {
  if (!scopeUnitId || !targetUnitId) return false;
  if (scopeUnitId === targetUnitId) return true;
  return collectSubtree(scopeUnitId, units).includes(targetUnitId);
}
