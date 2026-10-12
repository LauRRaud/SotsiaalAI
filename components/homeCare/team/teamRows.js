/**
 * Kliendi meeskonna reeglid ilma joonistamiseta: kes on loendis, kes mida teha
 * tohib, mis seisab „Viimati avasid" ja „Seisu ajalugu" real ning mitu rida on
 * vaates korraga.
 *
 * Meeskond näeb klienti ilma põhjust andmata; eemaldamine lõpetab rea, ajalugu
 * jääb alles. Olek ja päringud on konksus ./useClientTeam.js, vaated failis
 * ./TeamViews.jsx, kokku paneb need ./ClientTeam.jsx.
 */

/**
 * Mitu rida on vaates enne nuppu „Näita veel". Neli rida mahub koos kahe
 * loendi reaga nii arvuti paneeli kui ka telefoni ekraanile; pikendatud loend
 * kerib tervet paneeli.
 */
export const TEAM_PAGE = 4;

/** Mida inimene meeskonnaga teha tohib: lisab ja eemaldab hooldusjuht, kui asutus on kirjutatav. */
export function teamRights({ canWrite, isCoordinator }) {
  return { edit: Boolean(canWrite && isCoordinator) };
}

/** Liikme nimi; nimeta liige on kriips, mitte tühi rida. */
export function memberName(member) {
  return member.name || "—";
}

/** Liikme märk: `{ text, tone }` või null. Enam mitte aktiivne liige jääb hooldusjuhi loendisse märgiga. */
export function memberChip(member, { t }) {
  return member.active ? null : { text: t("home_care.team.inactive"), tone: "" };
}

/**
 * Meeskond loendi ridadena: `[{ key, title, chip }]`. Hooldusjuht näeb kõiki ridu
 * (ka enam mitte aktiivseid), teised ainult aktiivseid nimesid.
 */
export function teamRows(team, who, { t }) {
  return (team || [])
    .filter((member) => who.isCoordinator || member.active)
    .map((member) => ({ key: member.membershipId, title: memberName(member), chip: memberChip(member, { t }) }));
}

/** „Viimati avasid" ridadena: `[{ key, title, line }]`; real on kes, mille alusel ja millal. */
export function openerRows(openers, { t, moment }) {
  return (openers || []).map((opener, index) => ({
    key: `${opener.at}-${index}`,
    title: opener.name,
    line: [t(`home_care.client.basis.${opener.basis}`), moment(opener.at)].filter(Boolean).join(" · ")
  }));
}

/** „Seisu ajalugu" ridadena: `[{ key, title, line }]`; pealkirjas on uus seis ja põhjus, real aeg, märkus ja kes muutis. */
export function statusRows(changes, { t, moment }) {
  return (changes || []).map((change) => ({
    key: change.id,
    title: [t(`home_care.status.${change.toStatus}`), change.reason ? t(`home_care.status_reason.${change.toStatus}.${change.reason}`) : null].filter(Boolean).join(" · "),
    line: [moment(change.changedAt), change.note, change.actorName].filter(Boolean).join(" · ")
  }));
}

/** Üks lehekülg ridu: `{ rows, more }`; `more` ütleb, kas ridu on veel. */
export function teamPage(rows, expanded) {
  return { rows: expanded ? rows : rows.slice(0, TEAM_PAGE), more: !expanded && rows.length > TEAM_PAGE };
}

/** Töötajad, keda saab lisada: asutuse liikmed, kes ei ole veel kliendi meeskonna reas. */
export function candidateOptions(candidates, team) {
  const inTeam = new Set((team || []).map((member) => member.membershipId));
  return (candidates || []).filter((member) => !inTeam.has(member.membershipId)).map((member) => ({ value: member.membershipId, label: member.name || member.membershipId }));
}

/** Lisada saab, kui valitud töötaja on valikus. */
export function addReady(options, selected) {
  return Boolean(selected) && options.some((option) => option.value === selected);
}
