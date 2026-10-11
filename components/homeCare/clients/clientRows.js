/**
 * Klientide vaate reeglid ilma joonistamiseta: mis sõnad on kliendi real, mida
 * ütleb otsingu tulemus, millal saab kõne märkida otse tulemusest ja mitu rida
 * on vaates korraga.
 *
 * Vaade on failis ./ClientsViews.jsx, olek ja päringud lehel
 * (`../HomeCareHome.jsx`).
 */

/**
 * Mitu klienti on vaates enne nuppu „Näita veel". Arvutis on read kahes veerus
 * (kolm rida), telefonis üksteise all (seal näitab kujundus viis esimest, kuni
 * loendit ei ole pikendatud). Pikendatud loend kerib tervet paneeli.
 */
export const CLIENTS_PAGE = 6;

/** Loendi lehekülg: nähtavad read ja mitu on veel. */
export function pageOf(list, shown) {
  const rows = Array.isArray(list) ? list : [];
  const count = Math.max(shown, 0);
  return { rows: rows.slice(0, count), left: Math.max(rows.length - count, 0) };
}

/** Kliendi rea teine rida: aadress ja, kui klient ei ole teenusel, seisu alus ja selgitus. */
export function clientLine(client, { t }) {
  const away = client.status !== "ACTIVE";
  return [client.address, away && client.statusReason ? t(`home_care.status_reason.${client.status}.${client.statusReason}`) : null, away ? client.statusNote : null].filter(Boolean).join(" · ");
}

/** Kliendi rea märgid: ajutiselt ära ja ootab eeltingimust. */
export function clientChips(client, { t }) {
  return [
    client.status === "AWAY" ? { key: "away", text: t("home_care.status.AWAY"), wait: true } : null,
    client.waiting ? { key: "waiting", text: t("home_care.precondition.badge"), wait: true } : null
  ].filter(Boolean);
}

/**
 * Otsingu tulemuse teine rida: seis (kui ei ole teenusel) ja see, mille järgi
 * klient leiti või kuidas tema leht avaneb (lähedase järgi, telefoninumbri
 * järgi, põhjusega, meeskonnas).
 */
export function resultLine(client, { t }) {
  const status = client.status !== "ACTIVE" ? `${t(`home_care.status.${client.status}`)} · ` : "";
  if (client.matchedRelative) {
    const relative = client.matchedRelative;
    const name = relative.relation ? `${relative.name} (${relative.relation})` : relative.name;
    const doubt = relative.doubt ? ` · ${t("home_care.home.matched_relative_doubt")}` : "";
    return `${status}${t("home_care.home.matched_relative", { name, level: t(`home_care.relatives.levels.${relative.level}`) })}${doubt}`;
  }
  if (client.matchedPhone) return `${status}${t("home_care.home.matched_phone")}`;
  return `${status}${t(client.needsReason ? "home_care.home.needs_reason" : "home_care.client.basis.TEAM")}`;
}

/**
 * Kõne märkimine otse tulemusest (K5-o): helistaja järgi leitud kliendil alati,
 * nime järgi leitud kliendil siis, kui tulemusi on vähe. Ainult kliendil, kelle
 * päevikusse vastaja tohib kirjutada (põhjust küsiva lehega kliendil mitte).
 */
export function canNoteCall(client, total) {
  return !client.needsReason && Boolean(client.matchedRelative || client.matchedPhone || total <= 3);
}
