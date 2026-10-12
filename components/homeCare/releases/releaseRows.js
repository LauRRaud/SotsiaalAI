/**
 * Väljastuste tööloendi reeglid ilma joonistamiseta: mis seisab väljastuse real
 * ja mida avatud väljastus ütleb.
 *
 * Väljastuste tööloend hooldusjuhile: mis kronoloogia, kellele, mis alusel ja kes
 * koostas. Loend EI näita dokumendi sisu; sisu avaneb dokumendist endast. Ametlik
 * register on asutuse dokumendihaldus, see loend on tööloend. Olek ja päring on
 * konksus ./useReleases.js, vaated on ühised (../client/PartViews.jsx), kokku
 * paneb need ./Releases.jsx.
 */

import { clientHref, homeCareBase } from "../homeCareClient";

/** Mitu rida lisandub loendisse nupust „Näita veel". */
export const RELEASES_PAGE = 4;

/** AAAA-KK-PP → PP.KK.AAAA. */
export function formatDay(isoDay) {
  const parts = String(isoDay || "").split("-");
  return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : String(isoDay || "");
}

/** Ajavahemik, kirjete arv ja koostaja ühe lausena. */
function periodLine(t, release) {
  return [
    t("home_care.releases.period", { from: formatDay(release.periodFromDay), to: formatDay(release.periodToDay) }),
    t("home_care.releases.entries", { count: release.entryCount }),
    t("home_care.releases.compiled", { name: release.createdByName })
  ].join(" · ");
}

/** Väljastused loendi ridadena: `[{ key, title, line }]`; real on aeg, ajavahemik ja kirjete arv. */
export function releaseRows(t, items, { moment }) {
  return items.map((release) => ({
    key: release.id,
    title: release.clientName,
    line: [
      moment(release.createdAt),
      t("home_care.releases.period", { from: formatDay(release.periodFromDay), to: formatDay(release.periodToDay) }),
      t("home_care.releases.entries", { count: release.entryCount })
    ].join(" · ")
  }));
}

/** Avatud väljastuse laused: `[{ key, text }]`; viimane on sisu räsi. */
export function releaseNotices(t, release, { moment }) {
  return [
    { key: "time", text: moment(release.createdAt) },
    { key: "period", text: periodLine(t, release) },
    { key: "requester", text: t("home_care.releases.requester", { value: release.requester }) },
    { key: "basis", text: t("home_care.releases.basis", { value: release.basis }) },
    release.registryRef ? { key: "registry_ref", text: t("home_care.releases.registry_ref", { value: release.registryRef }) } : null,
    { key: "hash", text: t("home_care.releases.hash", { value: release.contentSha256 }) }
  ].filter(Boolean);
}

/** Avatud väljastuse tegevused: dokument avaneb uuel vahelehel. */
export function releaseDocument(organizationId, release) {
  return `${homeCareBase(organizationId)}/valjastused/${release.id}/dokument`;
}

/** Link kliendi lehele. */
export function releaseClientHref(organizationId, release) {
  return clientHref(organizationId, release.clientId);
}
