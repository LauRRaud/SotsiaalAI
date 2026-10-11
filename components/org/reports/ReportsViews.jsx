"use client";

/**
 * Aruannete osa vaated.
 *
 * MIKS. Leht oli üks kast, kus iga aruande all seisid nupud, vormingu valik ja
 * eelvaate tabel: kõik korraga ja kõigi aruannete kohta. Nüüd on korraga ees üks asi:
 *  - `ReportsBoard`  saadetud kuuaruanded madalate ridadena (avamata on esile tõstetud)
 *  - `ReportView`    üks aruanne: read, saatja märkus, vaatamine siinsamas ja
 *                    allalaadimine (vorming ühelaiuste lahtritena)
 *
 * AVAMINE JÄTAB JÄLJE ja seda öeldakse ette (all servas): töötaja näeb oma
 * poolel, kas juht luges. Vaatamine on samuti avamine.
 *
 * Eelvaate tabel võib olla lai: see kerib oma kastis külgsuunas, püstsuunas
 * kerib kogu paneeli sisu (kasti kasti sees püstkerimist ei ole).
 *
 * Siin on ainult kuju. Otsused on failis ./reportRules.js; olek ja päringud lehel
 * (`../OrgServiceReportsClient.jsx`). Kujundus: reports.module.css.
 */

import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";

import { Facts, SMALL, footNote, ignoreKeyRepeat } from "../OrgBits";
import shared from "../org.module.css";
import styles from "./reports.module.css";

/** Loend. `more`: { busy, onMore } või null. */
export function ReportsBoard({ t, rows, onOpen, more, notice }) {
  if (!rows.length) {
    return <StepPanel title={t("org.reports.title")} lead={t("org.reports.empty")} note={footNote(notice, t("org.reports.intro"))} />;
  }
  return (
    <StepPanel title={t("org.reports.title")} note={footNote(notice, t("org.reports.intro"))}>
      <div className={shared.stack}>
        <ul className={shared.rows} aria-label={t("org.reports.title")}>
          {rows.map((row) => (
            <li key={row.id} className={shared.rowItem}>
              <button type="button" className={shared.row} data-report={row.id} onClick={() => onOpen(row.id)}>
                <span className={shared.rowMain}>
                  <span className={styles.month}>{row.title}</span>
                  {row.sub ? <span className={shared.rowSub}>{row.sub}</span> : null}
                </span>
                <span className={shared.rowMeta}>
                  {row.chip ? (
                    <span className={shared.chip} data-tone="wait">
                      {row.chip}
                    </span>
                  ) : null}
                  {row.time ? <span className={shared.time}>{t("org.reports.opened_at", { date: row.time })}</span> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {more ? (
          <div>
            <Button {...SMALL} aria-busy={more.busy ? "true" : undefined} data-more="1" onClick={more.onMore}>
              {t("org.pagination.loadMore")}
            </Button>
          </div>
        ) : null}
      </div>
    </StepPanel>
  );
}

/**
 * Üks aruanne.
 *
 * `view`: { busy, onView }; `formats`: { open, onToggle, onPick(format) };
 * `preview`: "none" | "table" | "unavailable"; `tableRows`: eelvaate read.
 */
export function ReportView({ t, title, facts, note, view, formats, preview, tableRows, notice, onBack, glow = true }) {
  return (
    <StepPanel
      title={title}
      note={footNote(notice, t("org.reports.audit_note"))}
      actions={
        <>
          <Button {...SMALL} data-back="1" onClick={onBack}>
            {t("org.members.back")}
          </Button>
          <Button {...SMALL} data-download="1" aria-expanded={formats.open} onClick={formats.onToggle}>
            {t("org.reports.download")}
          </Button>
          <Button type="button" size="sm" variant="primary" glow={glow} data-view="1" aria-busy={view.busy ? "true" : undefined} onKeyDown={ignoreKeyRepeat} onClick={view.onView}>
            {view.busy ? t("org.reports.viewing") : t("org.reports.view")}
          </Button>
        </>
      }
    >
      <div className={shared.stack} aria-busy={view.busy ? "true" : undefined}>
        <p className={styles.month}>{title}</p>
        <Facts rows={facts} />
        {note ? (
          <div className={shared.group}>
            <p className={shared.groupTitle}>{t("org.reports.note_label")}</p>
            <p className={shared.own}>{note}</p>
          </div>
        ) : null}
        {formats.open ? (
          /* KAKS ERI ASJA: CSV on ESITATUD fail (tema räsi tõendab, et see on täpselt
             see, mis omavalitsusele läks); PDF on lugemiseks tehtud koopia. */
          <div className={shared.group}>
            <p className={shared.groupTitle}>{t("org.reports.format_question")}</p>
            <div className={shared.cells}>
              <button type="button" className={shared.cellButton} data-format="csv" onKeyDown={ignoreKeyRepeat} onClick={() => formats.onPick("csv")}>
                {t("org.reports.format_csv")}
              </button>
              <button type="button" className={shared.cellButton} data-format="pdf" onKeyDown={ignoreKeyRepeat} onClick={() => formats.onPick("pdf")}>
                {t("org.reports.format_pdf")}
              </button>
            </div>
          </div>
        ) : null}
        {preview === "table" ? (
          <div className={styles.table} data-preview="1" tabIndex={0} role="region" aria-label={t("org.reports.preview_label")}>
            <table>
              <tbody>
                {tableRows.map((cells, index) => (
                  <tr key={index}>
                    {cells.map((cell, cellIndex) => (
                      <td key={cellIndex}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : preview === "unavailable" ? (
          /* PDF ja DOCX ei ole tekst: nende „eelvaade" oleks prügi. Siis on
             allalaadimine ainus tee ja seda öeldakse välja. */
          <p className={shared.quiet}>{t("org.reports.no_preview")}</p>
        ) : null}
      </div>
    </StepPanel>
  );
}
