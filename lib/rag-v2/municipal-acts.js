// The social welfare acts a municipality has in force besides its main regulation (ADR-058): its benefits procedure,
// the rates, the housing cost limits for the subsistence benefit, the care home cost cap, the service prices and
// procedures, and the carer's allowance. They are found from Riigi Teataja's listing of the council's and the
// government's acts, by title; the index held one act per municipality until 30.09.2026.

const EXCLUDE = new RegExp([
  'põhimäärus', 'arengukava', 'eelarve', 'delegeeri', 'volitamine', 'komisjon', 'struktuur', 'palga', 'töötasu', 'kool', 'lasteaia',
  'koolieelse', 'huvi', 'sport', 'treener', 'maamaks', 'jäätme', 'parkimis', 'teede', 'heakord', 'kalmistu', 'ühistransp', 'hange',
  'vallavara', 'linnavara', 'õppe', 'haridus', 'stipend', 'noor(te|so)', 'kultuur', 'küla', 'mittetulundus', 'ettevõtlus', 'üritus',
  'kaubandus', 'vee', 'kanalisatsioon', 'soojus', 'lõpetamine', 'ümberkorraldamine', 'asutamine', 'ühinemine', 'tunnustus', 'autasu',
  'preemia', 'aukodanik', 'sümboolika', 'valimis', 'kinnisasja', 'korteriomandi', 'metsa', 'looma', 'matmis', 'konkurs', 'ametikoha',
  'otsuse tegija', 'pädevus', 'ülejäägi', 'spetsialist', 'korter', 'elamu', 'õueala', 'hoovi', 'aiandus', 'messi',
  'omaalgatus', 'arendustegevus', 'kogukon', 'investeering', 'lammutus', 'ettevõtja', 'arst', 'esindusvõistkon', 'covid',
  'miljöö', 'selts', 'raie', 'istutamis', 'õpilas', 'ukraina', 'toetusfond', 'värvid',
].join('|'), 'u');
const SOCIAL = new RegExp([
  'sotsiaal', 'hoolekan', 'hooldaja', 'hoolduse', 'hoolduskulu', 'üldhooldus', 'toimetulek', 'puudega', 'puuetega', 'erivajadus', 'eluruumi\\w* alaliste',
  'eluaseme', 'lapsehoiu', 'koduteenus', 'abistaja', 'tugiisik', 'varjupaiga', 'turvakodu', 'päevahoiu', 'intervallhoold', 'sünni',
  'matuse', 'koduse lapse', 'eaka', 'pere(toetus|kond|konna)', 'pere sissetulek', 'lasterikka', 'sissetulekust', 'ranitsa',
  'vaimse tervise', 'eluruumi kohandami', 'võlanõustamis', 'tugiteenus', 'asenduskodu', 'järelhooldus', 'hoolduspere',
].join('|'), 'u');
// A rate is a word of its own: "määr", "määrad", "piirmäärade", "suurus"; never "määramise".
const RATE = /(?:^|[^\p{L}])(?:piir)?määr(?:a|ad|ade|asid)?(?![\p{L}])|suurus/u;
const PROCEDURE = /(?:^|[^\p{L}])(?:kord|korra|tingimused)(?![\p{L}])/u;

/** Single-valued categories: a municipality has one such act in force, so the newest open one replaces the others. */
export const SINGLE_VALUED = new Set(['housing_costs', 'care_home_costs', 'rates']);

/** The category of an act by its title, or null when it is not a social welfare act of these kinds. */
export function classifyMunicipalAct(title) {
  const t = String(title || '').toLocaleLowerCase('et');
  if (!SOCIAL.test(t) || EXCLUDE.test(t)) return null;
  if (/eluruumi\w* alaliste kulu|eluasemekulu|eluaseme kulu/u.test(t) && /toimetulek|piirmäär/u.test(t)) return 'housing_costs';
  if (/hoolduskulu|üldhooldusteenus/u.test(t) && /piirmäär|tasu|hind|maksumus|omaosalus|kulu/u.test(t)) return 'care_home_costs';
  if (/teenus\w* (hind|hinna|maksumus|tasu|omaosalus)|(hind|hinna|hindade|tasu|maksumus)\w* (kehtestamine|kinnitamine)/u.test(t) && /teenus/u.test(t)) return 'service_prices';
  if (/toetus/u.test(t) && RATE.test(t) && !PROCEDURE.test(t)) return 'rates';
  if (/hooldaja|hoolduse seadmise/u.test(t)) return 'carer';
  if (/toetus/u.test(t) && PROCEDURE.test(t)) return 'benefits_procedure';
  if (/sotsiaalhoolekand|sotsiaalteenus|sotsiaalabi|hoolekande/u.test(t)) return 'welfare_procedure';
  if (PROCEDURE.test(t)) return 'service_procedure';
  return null;
}

const titleKey = title => String(title).toLocaleLowerCase('et').replace(/[^\p{L} ]/gu, '')
  .replace(/(?:^| )\p{L}+ (?:valla|linna)s?(?= |$)/gu, ' ').replace(/\s+/gu, ' ').trim();
const pastYear = (title, today) => [...String(title).matchAll(/(?:^|\D)(20\d{2})(?!\d)/gu)].some(m => Number(m[1]) < Number(today.slice(0, 4)));

/** The acts to take from a listing ({ m, id, title, from, to, tekst, kk, mj }): consolidated texts in force today or
 *  starting by the horizon, not repeal stubs (kk: kehtivKehtetus) nor texts that never entered into force (mj:
 *  mitteJoustunud, a version replaced before its start), with no past year in the title. Per municipality and category (or
 *  title, for the others) the newest act in force today is kept with every later one; the older ones are dropped, since
 *  Riigi Teataja leaves an act that a newer one replaced without an end date unless it was formally repealed. */
export function selectMunicipalActs(listing, { today, horizon }) {
  const candidates = [], stale = [];
  for (const act of listing) {
    if (act.kk || act.mj || !['terviktekst', 'algtekst-terviktekst'].includes(act.tekst)) continue;
    if (!act.from || act.from > horizon || (act.to && act.to < today)) continue;
    const category = classifyMunicipalAct(act.title);
    if (!category) continue;
    (pastYear(act.title, today) ? stale : candidates).push({ ...act, category });
  }
  const groups = new Map();
  for (const act of candidates) {
    const key = SINGLE_VALUED.has(act.category) ? `${act.m}|${act.category}` : `${act.m}|${act.category}|${titleKey(act.title)}`;
    groups.set(key, [...(groups.get(key) || []), act]);
  }
  const keep = [], dropped = [...stale.map(act => ({ ...act, reason: 'past_year_in_title' }))];
  for (const acts of groups.values()) {
    acts.sort((a, b) => b.from.localeCompare(a.from) || b.id.localeCompare(a.id));
    const current = acts.filter(act => act.from <= today);
    keep.push(...acts.filter(act => act.from > today), ...current.slice(0, 1));
    dropped.push(...current.slice(1).map(act => ({ ...act, reason: 'replaced_by_newer' })));
  }
  return { keep, dropped };
}
