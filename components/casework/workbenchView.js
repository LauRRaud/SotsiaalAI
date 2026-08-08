/**
 * JTA-V1 (E2) — laua kuvaotsused ILMA JSX-ita.
 *
 * MIKS OMA FAIL: omaniku kuues audit 08.08 leidis, et pind valis sektsiooni
 * kuju `items.length` järgi ja luges olekut ainult siis, kui ridu EI OLNUD.
 * Parandus ise on lühike — aga teda ei saanud tõendada, sest ta elas
 * JSX-failis ja testijooksja ei teisenda JSX-i. Regex-test oleks kontrollinud
 * koodi kuju, mitte käitumist.
 *
 * Siin on ainult puhtad funktsioonid, seega `workbenchView.test.js` kutsub
 * neid päriselt ja test kukub VANA teostuse peal (v5 reegel).
 */

/**
 * L12 kanooniline järjekord. Peab olema BAIT-TÄPSELT sama mis
 * `WORKBENCH_SECTIONS` `lib/casework/workbench.js`-is — seda kontrollib test.
 *
 * Pind ei tohi seda serverimoodulist importida, sest ta toob endaga Prisma
 * kliendi. Kaks loendit ilma testita on ainult aja küsimus.
 *
 * #4 (`draftsAwaitingTransfer`) ja #10 (`transferHistory`) lisandusid E6-s ja
 * seisavad L12 tabeli kohal, mitte loendi lõpus.
 */
export const WORKBENCH_SECTION_ORDER = Object.freeze([
  "receivedPreInquiries",
  "todaysContacts",
  "activePreparations",
  "draftsAwaitingTransfer",
  "openMissingInfo",
  "upcomingContacts",
  "networkPreparation",
  "practiceReflection",
  "covisionPreparation",
  "transferHistory"
]);

/**
 * Sektsiooni olek → mida pind teeb.
 *
 * OLEK OTSUSTAB, MITTE RIDADE ARV. `FORBIDDEN` või `TIMEOUT` koos ridadega
 * kuvaks vanas teostuses read ja viskaks oleku vaikides ära. Serveri praegune
 * distsipliin hoiab neid tühjana, aga see on HTTP-vastus: pind ei tohi sõltuda
 * sellest, et teine pool end korralikult üleval peab.
 */
export const SECTION_VIEW = Object.freeze({
  OK: Object.freeze({ showItems: true, noticeKey: null }),
  EMPTY: Object.freeze({ showItems: false, noticeKey: "casework.workbench.state_empty" }),
  FORBIDDEN: Object.freeze({ showItems: false, noticeKey: "casework.workbench.state_forbidden" }),
  TIMEOUT: Object.freeze({ showItems: false, noticeKey: "casework.workbench.state_timeout" }),
  ERROR: Object.freeze({ showItems: false, noticeKey: "casework.workbench.state_error" })
});

/**
 * TUNDMATU OLEK ON VIGA, MITTE TÜHJUS.
 *
 * Vaikimisi `EMPTY` on fail-open: uus või vigane olek ütleks kasutajale „tööd
 * ei ole", mis on täpselt vale vastus siis, kui tegelikult ei tea. Juhtumitöö
 * laual tähendab „ei ole puuduvat infot" midagi.
 */
export const INVALID_VIEW = Object.freeze({ showItems: false, noticeKey: "casework.workbench.state_invalid" });

/**
 * Sektsiooni deskriptor → kuvaotsus.
 *
 * @param {{ state?: string, items?: unknown[] }} data
 * @returns {{ showItems: boolean, noticeKey: string|null, items: unknown[] }}
 */
export function resolveSection(data) {
  const items = Array.isArray(data?.items) ? data.items : [];
  const view = SECTION_VIEW[data?.state] || INVALID_VIEW;

  /* `OK` ilma ridadeta on ISE VASTUOLU: `settled()` annab sellisel juhul
     `EMPTY`. Seega see ei ole tühi sektsioon, vaid vastus, millest laud aru ei
     saa — ja „tööd ei ole" oleks siin väljamõeldud vastus. */
  if (view.showItems && items.length === 0) {
    return { showItems: false, noticeKey: INVALID_VIEW.noticeKey, items };
  }

  return { showItems: view.showItems, noticeKey: view.noticeKey, items };
}
