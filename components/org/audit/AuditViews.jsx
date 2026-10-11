"use client";

/**
 * Auditi osa vaade: organisatsiooni haldustoimingud madalate ridadena, uuemad ees.
 *
 * MIKS. Leht oli tabel, kus toiming seisis toore sisemise nimena
 * (`org.member_suspended`), objekt suurtähtedes võtmena ja aeg ISO kujul. Nüüd
 * on igal real lause, mis juhtus, ja aeg inimese enda ajavööndis.
 *
 * Loend on pikk vaade (kuni sada sündmust korraga): siis kerib kogu paneeli sisu.
 * Otsused on failis ./auditRules.js; olek ja päring lehel (`../OrgAuditClient.jsx`).
 */

import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";

import { SMALL, footNote } from "../OrgBits";
import shared from "../org.module.css";

/** `more`: { busy, onMore } või null; `shown`: lause, mitu sündmust on näha. */
export function AuditBoard({ t, rows, shown, more, notice }) {
  if (!rows.length) {
    return <StepPanel title={t("org.audit.heading")} lead={t("org.audit.empty")} note={footNote(notice, t("org.audit.intro"))} />;
  }
  return (
    <StepPanel title={t("org.audit.heading")} note={footNote(notice, t("org.audit.intro"))}>
      <div className={shared.stack}>
        <ul className={shared.rows} aria-label={t("org.audit.heading")}>
          {rows.map((row) => (
            <li key={row.id} className={shared.rowItem}>
              <div className={shared.rowStatic} data-event={row.id}>
                <span className={shared.rowMain}>
                  <span className={shared.rowTitle}>{row.title}</span>
                </span>
                {row.time ? (
                  <span className={shared.rowMeta}>
                    <time className={shared.time} dateTime={row.createdAt || undefined}>
                      {row.time}
                    </time>
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
        <div className={shared.headBar}>
          <span className={shared.small}>{shown}</span>
          {more ? (
            <Button {...SMALL} aria-busy={more.busy ? "true" : undefined} data-more="1" onClick={more.onMore}>
              {t("org.audit.loadMore")}
            </Button>
          ) : null}
        </div>
      </div>
    </StepPanel>
  );
}
