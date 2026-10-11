/**
 * TEENUSE PIIRKOND — kus teenuseosutaja oma sõnul teenust osutab (ADR-144).
 *
 * Vestluse assistent saab osutajat nimetada ainult koha kohta, mille kohta inimene küsib
 * („tugiisik Elva vallas"). Profiilivorm kirjutab piirkonna aga vabalt: piirkonna tüüp on valik,
 * maakond ja omavalitsused on käsitsi kirjutatud sõnad. See moodul loeb need sõnad
 * omavalitsuste registri vastu ja ütleb, milliseid omavalitsusi teenus katab.
 *
 * REEGLID:
 *   1. Loetakse ainult see, mida osutaja ise piirkonnaks märkis (tüüp, maakond, omavalitsused,
 *      teeninduskoha maakond). Kirjeldustest ja vabatekstist ei oletata midagi.
 *   2. Sõna, mida register ei tunne, ei kata ühtki kohta. Sama kehtib nime kohta, mis sobib kahele
 *      omavalitsusele („Tartu" on nii linn kui vald): osutaja peab kirjutama „Tartu linn".
 *      Lugemata jäänud sõnad loetakse kokku, et vorm saaks neid küsida; välja neid ei anta.
 *   3. Kahtluse korral on piirkond teadmata ja teadmata piirkonnaga teenust ei pakuta ühegi koha
 *      küsimusele. Vale suunas eksides ütleks assistent, et teenust osutatakse seal, kus ei osutata.
 *
 * Puhas moodul: ei loe andmebaasi ega võrku, register antakse ette.
 */

export const ServiceAreaKind = Object.freeze({
  NATIONAL: "national",
  COUNTY: "county",
  MUNICIPALITY: "municipality",
  UNKNOWN: "unknown"
});

/* Vormi piirkonnatüübid (components/workspace/serviceProfile/profileModel.js, `areaType`). */
const AREA_TYPE = Object.freeze({
  NATIONAL: "üleriigiline",
  ONLINE: "veebiteenus",
  COUNTY: "maakondlik",
  MUNICIPALITY: "kov põhine",
  LOCATION: "teeninduskoha põhine"
});

function clean(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("et")
    .replace(/\s+/g, " ")
    .trim();
}

/** „Harjumaa", „Harju maakond" ja „Harju" on sama maakond: võti on nimi ilma lõputa. */
export function countyKey(value) {
  return clean(value).replace(/\s*maakond$/u, "").replace(/maa$/u, "").trim();
}

/**
 * Register ühe korra loetavaks: omavalitsuse nimed (täisnimi, lühinimi, tunnus) ja maakonnad.
 * `rows`: aktiivsed omavalitsused kujul `{ id, slug, displayName, baseName, county }`.
 */
export function municipalityRegister(rows = []) {
  const names = new Map();
  const countyOf = new Map();
  const counties = new Set();
  const claim = (name, slug) => {
    const key = clean(name);
    if (!key) return;
    /* Kahe omavalitsuse ühine nimi ei nimeta kumbagi (`null`). */
    names.set(key, names.has(key) && names.get(key) !== slug ? null : slug);
  };
  for (const row of Array.isArray(rows) ? rows : []) {
    const slug = String(row?.slug || "").trim();
    if (!slug) continue;
    const county = countyKey(row.county);
    countyOf.set(slug, county);
    if (county) counties.add(county);
    for (const name of [row.id, slug, slug.replaceAll("-", "_"), row.displayName, row.baseName]) claim(name, slug);
  }
  return { names, countyOf, counties };
}

function readMunicipalities(values, register, unread) {
  const found = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const key = clean(value);
    if (!key) continue;
    if (!register.names.has(key)) unread.municipalities += 1;
    else if (register.names.get(key) === null) unread.ambiguous += 1;
    else found.add(register.names.get(key));
  }
  return [...found].sort();
}

function readCounties(values, register, unread) {
  const found = new Set();
  for (const value of values) {
    const key = countyKey(value);
    if (!key) continue;
    if (register.counties.has(key)) found.add(key);
    else unread.counties += 1;
  }
  return [...found].sort();
}

function isPublic(row) {
  return Boolean(row && row.mapVisible === true && String(row.status || "").toUpperCase() === "PUBLISHED");
}

/** Teenuse avalikud teeninduskohad: teenusega seotud kohad, seoste puudumisel profiili kõik kohad. */
function serviceLocations(service, profile) {
  const locations = (Array.isArray(profile?.serviceLocations) ? profile.serviceLocations : []).filter(isPublic);
  const linked = new Set((Array.isArray(service?.locationLinks) ? service.locationLinks : [])
    .map((link) => link?.providerLocationId)
    .filter(Boolean));
  return linked.size ? locations.filter((location) => linked.has(location.id)) : locations;
}

function area(kind, { municipalities = [], counties = [] } = {}, unread) {
  return { kind, municipalities, counties, unread };
}

/**
 * Teenuse piirkond registri sõnades.
 *
 * Tagastab `{ kind, municipalities, counties, unread }`: `municipalities` on registri `slug`-id,
 * `counties` maakonnavõtmed (`countyKey`), `unread` loendab sõnu, mida ei õnnestunud lugeda.
 */
export function readServiceArea(service = {}, profile = {}, register = municipalityRegister()) {
  const unread = { municipalities: 0, counties: 0, ambiguous: 0 };
  const type = clean(service?.serviceAreaType);
  if (type === AREA_TYPE.NATIONAL || type === AREA_TYPE.ONLINE) return area(ServiceAreaKind.NATIONAL, {}, unread);

  const ownMunicipalities = Array.isArray(service?.municipalityIds) && service.municipalityIds.length
    ? service.municipalityIds
    : profile?.serviceAreaMunicipalityIds;
  const ownCounty = service?.county || profile?.county;

  if (type === AREA_TYPE.MUNICIPALITY) {
    const municipalities = readMunicipalities(ownMunicipalities, register, unread);
    return municipalities.length ? area(ServiceAreaKind.MUNICIPALITY, { municipalities }, unread) : area(ServiceAreaKind.UNKNOWN, {}, unread);
  }
  if (type === AREA_TYPE.COUNTY) {
    const counties = readCounties([ownCounty], register, unread);
    return counties.length ? area(ServiceAreaKind.COUNTY, { counties }, unread) : area(ServiceAreaKind.UNKNOWN, {}, unread);
  }
  if (type === AREA_TYPE.LOCATION) {
    /* Teeninduskohal on aadress ja maakond, omavalitsust ei ole: loetav piirkond on koha maakond. */
    const places = serviceLocations(service, profile).map((location) => location.county).filter(Boolean);
    const counties = readCounties(places.length ? places : [ownCounty], register, unread);
    return counties.length ? area(ServiceAreaKind.COUNTY, { counties }, unread) : area(ServiceAreaKind.UNKNOWN, {}, unread);
  }
  /* Tundmatu tüüp (vana vabatekst) ei ole tüüp: seda ei loeta täpsustamata väärtuseks ümber. */
  if (type) return area(ServiceAreaKind.UNKNOWN, {}, unread);

  /* Täpsustamata tüüp: kehtib kitsaim piirkond, mille osutaja ise märkis. */
  const municipalities = readMunicipalities(ownMunicipalities, register, unread);
  if (municipalities.length) return area(ServiceAreaKind.MUNICIPALITY, { municipalities }, unread);
  const counties = readCounties([ownCounty], register, unread);
  return counties.length ? area(ServiceAreaKind.COUNTY, { counties }, unread) : area(ServiceAreaKind.UNKNOWN, {}, unread);
}

/** Kas piirkond katab omavalitsust `slug`. Teadmata piirkond ei kata ühtki. */
export function areaServesMunicipality(serviceArea, slug, register = municipalityRegister()) {
  const key = String(slug || "").trim();
  if (!serviceArea || !key || !register.countyOf.has(key)) return false;
  if (serviceArea.kind === ServiceAreaKind.NATIONAL) return true;
  if (serviceArea.kind === ServiceAreaKind.MUNICIPALITY) return serviceArea.municipalities.includes(key);
  if (serviceArea.kind === ServiceAreaKind.COUNTY) {
    const county = register.countyOf.get(key);
    return Boolean(county) && serviceArea.counties.includes(county);
  }
  return false;
}
