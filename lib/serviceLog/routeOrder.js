/**
 * TEENUSPÄEVIK — PÄEVA JÄRJESTUSE SOOVITUS.
 *
 * Omanik 03.08: „esimene versioon on juba ammu möödas, oleme juba lõpp
 * versioonis" — lepingu piirang „marsruudi optimeerimisalgoritmi ei ehita
 * esimeses versioonis" on sellega maha võetud.
 *
 * MIS SIIN ON JA MIS EI OLE.
 *
 * SEE ON SOOVITUS, MITTE OTSUS. Funktsioon tagastab järjekorra; kas ta
 * rakendub, otsustab inimene. Automaatne ümberjärjestamine tähendaks, et
 * töötaja avab hommikul telefoni ja tema päev on öösel ümber tehtud.
 *
 * KAKS REEGLIT, MIS KÄIVAD ENNE GEOGRAAFIAT:
 *
 * 1. FIKSEERITUD AEG ON FIKSEERITUD. Ravim kell 9, söögikord kell 12, teine
 *    töötaja tuleb kell 14 — need ei ole ümber tõstetavad ja lähedus ei ole
 *    argument nende vastu. `plannedStartAt`-iga külastused moodustavad päeva
 *    SKELETI ajalises järjekorras.
 *
 * 2. TEHTUD TÖÖD EI JÄRJESTATA ÜMBER. Lõpetatud, ära jäänud ja käigus olev
 *    külastus jäävad sinna, kus nad on. Ümberjärjestada saab ainult seda, mis
 *    on veel ees.
 *
 * ALLES SIIS LÄHEDUS. Vaba (ajata) külastus lisatakse skeletti kohta, kus ta
 * lisab kõige vähem sõitu — „odavaim lisamine". See EI OLE optimaalne marsruut
 * ja seda ei tohi nii nimetada: optimaalse leidmine on NP-raske ja meie vastus
 * on ahne. Praktikas annab ta hea järjekorra kümne peatuse juures, mis on
 * koduhoolduse päeva mõõt.
 *
 * KAUGUS ON LINNULENNULT × teekonnategur, sama mis sõidupäevikul. Marsruudi-
 * mootorit (päris teed, ühesuunalised, ummikud) me ei manusta — ta annaks
 * täpsema numbri ja eksliku mulje, et järjekord on lõplik tõde.
 */

import { ROAD_FACTOR, haversineKm } from "./mileage.js";
import { VISIT_STATUS, isTerminalVisit } from "./dayRouteMachine.js";

/** Külastus, mida tohib ümber järjestada: veel ees ja mitte käigus. */
function isMovable(visit) {
  return visit?.status === VISIT_STATUS.PLANNED;
}

/**
 * Punkt, mille järgi kaugust arvutada. Aadressi koordinaat on siin ÕIGE
 * valik ka siis, kui mõõdetud punkt on olemas: me planeerime seda, kuhu
 * MINNAKSE, mitte seda, kus keegi juba oli.
 */
function pointOf(visit) {
  const lat = Number(visit?.addressLat);
  const lng = Number(visit?.addressLng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  const stamp = visit?.locationStamps?.arrivedAt;
  return stamp && Number.isFinite(Number(stamp.lat)) ? { lat: Number(stamp.lat), lng: Number(stamp.lng) } : null;
}

function kmBetween(a, b) {
  const straight = haversineKm(pointOf(a), pointOf(b));
  return straight === null ? null : straight * ROAD_FACTOR;
}

/** Ahela pikkus. Tundmatu lõik loeb nulliks — ta ei tohi ahelat diskvalifitseerida. */
function chainKm(chain, startPoint) {
  let total = 0;
  let previous = startPoint ? { addressLat: startPoint.lat, addressLng: startPoint.lng } : null;
  for (const visit of chain) {
    if (previous) total += kmBetween(previous, visit) || 0;
    previous = visit;
  }
  return total;
}

/**
 * Soovitab päeva järjekorra.
 *
 * @param visits kogu päeva külastused (järjestatud praeguse `sortOrder` järgi)
 * @param startPoint kust päev algab (nt viimase tehtud külastuse koht)
 * @returns `{ order, changed, km }` — `order` on külastuste ID-d uues
 *   järjekorras KOGU päeva kohta, et kutsuja saaks `sortOrder`-i ühe korraga
 *   kirjutada; `changed` ütleb, kas midagi üldse muutuks.
 */
export function suggestOrder(visits = [], { startPoint = null } = {}) {
  const list = Array.isArray(visits) ? visits : [];

  /* Tehtud ja käigus olev töö jääb ette, oma praeguses järjekorras. */
  const fixed = list.filter((visit) => !isMovable(visit));
  const movable = list.filter(isMovable);

  if (movable.length < 2) {
    return { order: list.map((visit) => visit.id), changed: false, km: null };
  }

  /* SKELETT: fikseeritud ajaga külastused ajalises järjekorras. */
  const anchored = movable
    .filter((visit) => visit.plannedStartAt)
    .sort((a, b) => new Date(a.plannedStartAt) - new Date(b.plannedStartAt));
  const free = movable.filter((visit) => !visit.plannedStartAt);

  let chain = [...anchored];

  /* Ilma skeletita algame lähimast: ahne naaber. */
  if (chain.length === 0 && free.length) {
    const remaining = [...free];
    let current = startPoint ? { addressLat: startPoint.lat, addressLng: startPoint.lng } : remaining[0];
    if (!startPoint) chain.push(remaining.shift());
    while (remaining.length) {
      let bestIndex = 0;
      let bestKm = Infinity;
      remaining.forEach((candidate, index) => {
        const km = kmBetween(current, candidate);
        /* Tundmatu kaugus ei võida, aga ei kao ka: ta jääb järjekorda lõppu. */
        const weight = km === null ? Infinity - 1 : km;
        if (weight < bestKm) {
          bestKm = weight;
          bestIndex = index;
        }
      });
      const [next] = remaining.splice(bestIndex, 1);
      chain.push(next);
      current = next;
    }
    return finish(list, fixed, chain, startPoint);
  }

  /* ODAVAIM LISAMINE: iga vaba külastus läheb kohta, kus ta lisab kõige vähem
     sõitu. Fikseeritud ajaga külastuste omavaheline järjekord ei muutu. */
  for (const visit of free) {
    let bestPosition = chain.length;
    let bestCost = Infinity;
    for (let position = 0; position <= chain.length; position += 1) {
      const candidate = [...chain.slice(0, position), visit, ...chain.slice(position)];
      const cost = chainKm(candidate, startPoint);
      if (cost < bestCost) {
        bestCost = cost;
        bestPosition = position;
      }
    }
    chain = [...chain.slice(0, bestPosition), visit, ...chain.slice(bestPosition)];
  }

  return finish(list, fixed, chain, startPoint);
}

function finish(list, fixed, chain, startPoint) {
  const order = [...fixed.map((visit) => visit.id), ...chain.map((visit) => visit.id)];
  const current = list.map((visit) => visit.id);
  return {
    order,
    changed: order.some((id, index) => id !== current[index]),
    km: Math.round(chainKm(chain, startPoint) * 10) / 10
  };
}

/** Praeguse järjekorra sõidupikkus — võrdluseks, kui palju soovitus säästab. */
export function orderDistanceKm(visits = [], { startPoint = null } = {}) {
  const movable = visits.filter((visit) => !isTerminalVisit(visit?.status));
  return Math.round(chainKm(movable, startPoint) * 10) / 10;
}
