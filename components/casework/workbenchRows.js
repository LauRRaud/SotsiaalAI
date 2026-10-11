/**
 * JTA-V1 (E2) — laua read ILMA JSX-ita: sektsiooni kirjed → rea andmed.
 *
 * MIKS OMA FAIL: sama põhjus mis `workbenchView.js`-il. Kuni read sündisid
 * JSX-failis, ei saanud testida, kuhu rida viib ja mida ta näitab. Siin on
 * puhas funktsioon; pind (`CaseWorkbenchShell.jsx`) ainult joonistab.
 *
 * RIDA = pealkiri + aeg + märk + tee edasi. Laud on lugeja (L1): iga rida viib
 * omaniku-pinnale, kus tegu tehakse. Väljad, mis kannavad kliendi teksti,
 * lauale ei tule, kui sektsiooni mõte seda ei nõua (vt iga haru juures).
 */

import { provenanceLabelKey } from "@/lib/workspaces/provenance";

import { caseLabelText } from "./caseWorkClient";

/**
 * K1 tööruumi liik → pind, kus tegu tehakse.
 *
 * DESKRIPTORI `href` EI OLE URL: ta on `{ action: "open_workspace", target }`
 * ehk kavatsus, mille lahendab iga pind ise. Laud peab seetõttu teadma, kuhu
 * ta viib — ja ta teab seda NIMELISELT, mitte liigist tuletades. Tuletus
 * (`/vestlus?workspace=${kind}`) andis esimeses läbisõidus katkise lingi, sest
 * tööruumi liik (`pre_inquiry`) ja töölaua võti (`pre_inquiries`) ei ole sama
 * string. Tundmatu liigi rida jääb nähtavaks, aga ILMA teeta: katkine link on
 * halvem kui puuduv, sest ta lubab teed, mida ei ole.
 */
export const WORKSPACE_ROUTES = Object.freeze({
  pre_inquiry: "/eelpoordumised",
  practice_reflection: "/refleksioon"
});

function timeText(value, locale) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(locale || "et", { dateStyle: "short", timeStyle: "short" });
}

/* Teed on LOKAALINEUTRAALSED ja see on õige: `localizePath()` eemaldab
   keeleprefiksi ja `proxy.js` suunab `/et|/ru|/en` teed 308-ga neutraalsele
   kujule, pannes keele küpsisesse. */
const caseHref = (caseId) => `/juhtumid?juhtum=${encodeURIComponent(caseId)}`;

/**
 * @param {string} key sektsiooni võti (`WORKBENCH_SECTION_ORDER`)
 * @param {unknown[]} items sektsiooni kirjed
 * @param {{ t: (key: string, fallback?: string) => string, locale?: string }} context
 * @returns {{ id: string, href: string|null, title: string, meta: string, badge: string|null }[]}
 */
export function workbenchRows(key, items, { t, locale }) {
  const list = Array.isArray(items) ? items : [];
  switch (key) {
    /* K1 deskriptor (`receivedPreInquiries`, `practiceReflection`). `goal` ja
       `progress` EI lähe lauale: nad on tööruumi sisu ja avanevad tööruumis.

       `title` ON KAS TÕLKEVÕTI VÕI TEKST — adapterid on siin teadlikult
       erinevad: sisuta tööruum (eelpöördumine, meetodipeegel) annab võtme,
       sest pealkiri ei tohi kanda kliendi sisu, ja nimega tööruum (teekond,
       ruum) annab teksti. `t(title, title)` katab mõlemat: puuduv võti annab
       varuks sama stringi. Esimene läbisõit kuvas siin
       „workspace.kind.pre_inquiry" — võti lekkis pinnale. */
    case "receivedPreInquiries":
    case "practiceReflection":
      return list.map((row) => ({
        id: String(row?.ref?.id),
        href: WORKSPACE_ROUTES[row?.ref?.kind] || null,
        title: row?.title ? t(row.title, row.title) : t("casework.label.untitled", ""),
        meta: timeText(row?.lastMeaningfulActivityAt, locale),
        badge: row?.nextAction?.labelKey ? t(row.nextAction.labelKey, "") : null
      }));

    case "todaysContacts":
    case "upcomingContacts":
      return list.map((row) => ({
        id: String(row.caseId),
        href: caseHref(row.caseId),
        title: caseLabelText(row.label, t),
        meta: timeText(row.nextContactAt, locale),
        badge: null
      }));

    /* L3: arv on SELLE juhtumi lahtiste punktide oma. Ta ei summeeru
       sektsiooni peale kokku ja tal ei ole „liiga palju" läve.

       Võti on `prepId`, mitte `caseId` (SOL-CW-13): ühel juhtumil võib olla
       mitu kohtumist ja `caseId` annaks React'ile korduva võtme. Aeg on
       KOHTUMISE oma. */
    case "activePreparations":
      return list.map((row) => ({
        id: String(row.prepId),
        href: caseHref(row.caseId),
        title: caseLabelText(row.label, t),
        meta: timeText(row.meetingAt, locale),
        badge: row.openMissingInfoCount
          ? t("casework.workbench.missing_count", "").replace("{count}", String(row.openMissingInfoCount))
          : null
      }));

    /* Punkti tekst ON sektsiooni mõte, seega ta jääb. Pind renderdab selle
       tekstina — `dangerouslySetInnerHTML`-i seal ei ole ega tule. */
    case "openMissingInfo":
      return list.map((row) => ({
        id: String(row.itemId),
        href: caseHref(row.caseId),
        title: row.text,
        meta: timeText(row.createdAt, locale),
        badge: t(provenanceLabelKey(row.provenance) || "casework.errors.provenance_unknown", "")
      }));

    /* Staatus tuleb VÕRGUSTIKUJAGAMISE oma sõnastikust, mitte lauast: sama
       seis on juba nimetatud „Minu jagamistes" ja teine sõnastus tähendaks,
       et sama rida loeb kahel pinnal kaht eri asja. */
    case "networkPreparation":
      return list.map((row) => ({
        id: String(row.shareId),
        href: "/eelpoordumised",
        title: t("casework.workbench.share_row", ""),
        meta: timeText(row.updatedAt, locale),
        badge: t(`network_share.status.${row.status}`, "")
      }));

    /* Teemaseemne seisul EI OLE mujal sõnastikku (kontrollitud 06→08.08:
       `TopicSeedStatus` viis väärtust ei esine üheski messages-failis), seega
       ta sünnib siin. Toorest enum'i nime pinnale ei kuvata — tundmatu
       väärtus annab tühja sildi. */
    case "covisionPreparation":
      return list.map((row) => ({
        id: String(row.seedId),
        href: "/teemaseemned",
        title: row.title || t("casework.workbench.seed_untitled", ""),
        meta: timeText(row.updatedAt, locale),
        badge: t(`casework.workbench.seed_status_${row.status}`, "")
      }));

    /* #4 (E6). Siht on JUHTUM, mitte mustand: mustandil ei ole oma marsruuti
       ja tema koht on juhtumi detailvaates. Tüüp ja seis on tõlkevõtmed —
       laual ei ole ühtegi mustandi VÄLJA, sest väljad kannavad kliendi teksti. */
    case "draftsAwaitingTransfer":
      return list.map((row) => ({
        id: String(row.draftId),
        href: caseHref(row.caseId),
        title: t(`casework.draft.type_${row.draftType}`, ""),
        meta: timeText(row.updatedAt, locale),
        badge: t(`casework.star2.${row.transferState}`, "")
      }));

    /* #10 (E6). Ajalugu kannab TEGU ja aega. Väljade võtmed on auditis olemas,
       aga laual neid ei ole (L20): siin on küsimus „mis juhtus", mitte „mis
       täpselt kopeeriti". */
    case "transferHistory":
      return list.map((row) => ({
        id: String(row.eventId),
        href: caseHref(row.caseId),
        title: t(`casework.transfer.kind_${row.kind}`, ""),
        meta: timeText(row.createdAt, locale),
        badge: t(`casework.draft.type_${row.draftType}`, "")
      }));

    default:
      return [];
  }
}
