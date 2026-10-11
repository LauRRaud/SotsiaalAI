/**
 * Kliendi lehe päeviku reeglid ilma joonistamiseta: mitu kirjet on vaates
 * korraga, mis seisab kirje real, mida ütleb kehtiv otsing ja millal on näha
 * read, mis viivad varasema ajaloo juurde.
 *
 * Vaated on failis ./DiaryViews.jsx, olek ja päringud lehel
 * (`../HomeCareClientPage.jsx`).
 */

/**
 * Mitu kirjet on vaates enne nuppu „Näita varasemaid". Viis rida mahub nii
 * arvuti paneeli kui ka telefoni ekraanile; pikendatud loend kerib tervet paneeli.
 */
export const DIARY_PAGE = 5;

/**
 * Mitu lõiku varasemast ajaloost on tabamuste vaates enne nuppu „Näita veel".
 * Lõik on terve tekst (otsitud sõna võib olla selle lõpus), nii et vaade võib
 * olla paneelist pikem ja kerib siis tervikuna.
 */
export const HITS_PAGE = 3;

/**
 * Mitu lõiku üle toodud dokumendist on ees enne nuppu „Näita veel". Server
 * annab teksti suurte lehekülgede kaupa (proovandmetega 14 lõiku, arvutis üle
 * 6000 px): vaate tegevused on all servas ja peavad jääma käeulatusse.
 */
export const DOC_PAGE = 3;

/** Tühi otsing: päevik näitab kõiki kirjeid. */
export const NO_FILTER = Object.freeze({ kind: "", from: "", to: "", q: "" });

/** Kas päevikul on otsing või filter peal. */
export function filterActive(filter) {
  return Boolean(filter?.kind || filter?.from || filter?.to || (filter?.q || "").trim());
}

/**
 * Kehtiv otsing ühe reana („Otsing: „piim" · Teade järgmisele · Alates
 * 01.10.2026"); tühi sõne, kui otsingut ei ole. `day` vormindab päeva.
 */
export function filterLine(filter, { t, day }) {
  if (!filterActive(filter)) return "";
  const q = (filter.q || "").trim();
  return [
    q ? t("home_care.diary.filter_q", { q }) : null,
    filter.kind ? t(`home_care.entry.kinds.${filter.kind}`) : null,
    filter.from ? `${t("home_care.filter.from")} ${day(filter.from)}` : null,
    filter.to ? `${t("home_care.filter.to")} ${day(filter.to)}` : null
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Kirje aeg loendi real: selle aasta kirjel ilma aastata („09.10 16:40"),
 * varasemal koos aastaga. `moment` on kujul „09.10.2026 16:40", `today` kujul
 * „2026-10-12" (asutuse päev). Avatud kirjes on aeg alati täies pikkuses.
 */
export function rowMoment(moment, today) {
  const year = String(today || "").slice(0, 4);
  return year && moment.slice(5, 10) === `.${year}` ? `${moment.slice(0, 5)}${moment.slice(10)}` : moment;
}

/* Liigid, mis on real tugevama märgiga: neid peab meeskond märkama. */
const NOTICED_KINDS = Object.freeze(["HANDOVER", "INCIDENT", "CONCERN"]);

/**
 * Rea märgid: mis asi see kirje on (liik, kui ei ole tavaline; kontakti viis,
 * kui ei olnud käik; erijuhtumi seis). Märgid selle kohta, kuidas kirje
 * päevikusse jõudis (hiljem kirjutatud, parandatud, ainult hooldusjuhile), on
 * avatud kirjes.
 */
export function entryChips(entry, { t }) {
  const settled = Boolean(entry.retractedAt) || entry.incident?.status === "CLOSED";
  return [
    entry.kind !== "NOTE" ? { key: "kind", text: t(`home_care.entry.kinds.${entry.kind}`), wait: NOTICED_KINDS.includes(entry.kind) && !settled } : null,
    entry.contactMode && entry.contactMode !== "VISIT" ? { key: "contact", text: t(`home_care.entry.contact.${entry.contactMode}`) } : null,
    entry.incident && !entry.retractedAt ? { key: "status", text: t(`home_care.incident.status.${entry.incident.status}`) } : null
  ].filter(Boolean);
}

/**
 * Rea teine rida: teksti algus (vaade lõikab selle rea pikkuseks). Tühistatud
 * kirjel lause, et see on tühistatud; erijuhtumil ees, mis juhtus; tekstita
 * käigu kirjel kestus ja mitu toimingut märgiti. `made`: rida on kokku pandud,
 * mitte inimese kirjutatud.
 */
export function entryLine(entry, { t }) {
  if (entry.retractedAt) return { text: t("home_care.entry.retracted"), muted: true, made: true };
  const text = (entry.text || "").trim();
  if (entry.incident?.type) {
    const type = t(`home_care.incident.types.${entry.incident.type}`);
    /* Kiirmärke tekst algab juba sellega, mis juhtus („Peaaegu juhtus: …"): siis seda ette ei korrata. */
    if (text.toLowerCase().startsWith(type.toLowerCase())) return { text };
    return { text: [type, text].filter(Boolean).join(" · "), made: true };
  }
  if (text) return { text };
  const activities = entry.visit?.activities || [];
  const done = activities.filter((activity) => !activity.outcome || activity.outcome === "DONE").length;
  const skipped = activities.length - done;
  return {
    text: [
      entry.visit?.minutes ? t("home_care.visit.lasted", { minutes: entry.visit.minutes }) : null,
      done ? t("home_care.entry_steps.summary_done", { count: done }) : null,
      skipped ? t("home_care.entry_steps.summary_skipped", { count: skipped }) : null
    ]
      .filter(Boolean)
      .join(" · "),
    made: true
  };
}

/**
 * Loendi read: `[{ key, when, who, line: { text, muted, made }, chips }]`.
 * `moment` vormindab ajahetke asutuse ajavööndis, `today` on asutuse päev.
 */
export function diaryRows(items, { t, moment, today }) {
  return (Array.isArray(items) ? items : []).map((entry) => ({
    key: entry.id,
    when: rowMoment(moment(entry.occurredAt), today),
    who: entry.authorName || "",
    line: entryLine(entry, { t }),
    chips: entryChips(entry, { t })
  }));
}

/**
 * Loendi lehekülg: esimene lehekülg või kõik laaditud kirjed. „Näita
 * varasemaid" on olemas, kuni laaditud kirjeid on peidus või server ütleb, et
 * varasemaid on veel.
 */
export function diaryPage(rows, { expanded, hasMore }) {
  const shown = expanded ? rows : rows.slice(0, DIARY_PAGE);
  return { rows: shown, more: shown.length < rows.length || Boolean(hasMore) };
}

/**
 * Üle toodud dokumentide read: `[{ key, title, line }]`. Rida ütleb, millal ja
 * kes teksti üle tõi ja kui pikk see on. `moment` vormindab ajahetke.
 */
export function historyRows(histories, { t, moment }) {
  return (Array.isArray(histories) ? histories : []).map((history) => ({
    key: history.id,
    title: history.title,
    line: t("home_care.history.meta", { time: moment(history.createdAt), name: history.importedByName, count: history.charCount })
  }));
}

/**
 * Kas osa „Varasem ajalugu teisest kohast" on sellele inimesele olemas: midagi
 * on üle toodud või ta saab ise üle tuua (hooldusjuht kirjutatavas asutuses).
 */
export function historyVisible(who, data) {
  return (data?.histories || []).length > 0 || (who.isCoordinator && who.canWrite);
}
