"use client";

/**
 * Mentorluse avalehe vaated: leia mentor, minu suhted, taotlused ja mina mentorina.
 *
 * MIKS. Leht oli üks pikk veerg tumeda kaardi sees: suhted, saabunud taotlused,
 * minu taotlused, mentori vaade, kataloog kolme vabateksti filtriga ja lõppenud
 * suhted üksteise all, iga kirje omaette kõrge kaart. Nüüd on igal asjal oma
 * vaade sammulaval (`components/stage`) ja leht avaneb kõigi osade ülevaates.
 *
 * VAATED (`StepFlight`-i osad, nimed on all kiirmenüüs):
 *  - `FindView`       mentorite kataloog: filtrid kataloogi enda väärtustest ja read
 *  - `RelationsView`  minu suhted: käimas ja lõppenud; rida viib suhteruumi
 *  - `RequestsView`   taotlused: mulle saabunud (otsus) ja minu saadetud (seis)
 *  - `MentorView`     minu mentoriprofiili seis ja tee selle haldamise juurde
 *
 * Siin on ainult kuju. Andmed, päringud ja olek on failis
 * ../MentoringHomePage.jsx; read ehitab ./entryRows.js.
 *
 * Kujundus: entry.module.css (siin kõrval).
 */

import Link from "next/link";

import ChoiceRow from "@/components/stage/ChoiceRow";
import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";
import Dropdown from "@/components/ui/Dropdown";

import { Chip, LinkCard, Notice, TextLink } from "./EntryParts";
import { ESTA_MENTORS_URL } from "./entryRows";
import styles from "./entry.module.css";

function MentorRow({ row, openText, newTabText }) {
  const body = (
    <>
      <span className={styles.rowMain}>
        <span className={styles.rowTitle}>{row.title}</span>
        {row.sub ? <span className={styles.rowSub}>{row.sub}</span> : null}
        {row.fields ? <span className={styles.rowSub}>{row.fields}</span> : null}
        {row.excerpt ? <span className={styles.rowExcerpt}>{row.excerpt}</span> : null}
      </span>
      <span className={styles.rowMeta}>
        <Chip tone={row.tone}>{row.chip}</Chip>
        {row.meta ? <span className={styles.time}>{row.meta}</span> : null}
      </span>
      <span className={styles.rowOpen} aria-hidden="true">
        {openText} {row.external ? "↗" : "›"}
      </span>
      {row.external ? <span className="sr-only">({newTabText})</span> : null}
    </>
  );
  return (
    <li className={styles.rowItem}>
      {row.external ? (
        <a className={styles.row} href={row.href} target="_blank" rel="noopener noreferrer">
          {body}
        </a>
      ) : (
        <Link className={styles.row} href={row.href} prefetch={false}>
          {body}
        </Link>
      )}
    </li>
  );
}

/** Leia mentor: filtrid, kataloogi read ja viide ESTA andmebaasile. */
export function FindView({ t, filters, notice, failed, onRetry, rows, emptyText, capNote }) {
  const newTabText = t("mentoring.labels.opens_new_tab");
  return (
    <StepPanel title={t("mentoring.home.views.find.title")} lead={t("mentoring.home.catalog_help")}>
      <div className={styles.stack}>
        {filters.length ? (
          <div className={styles.filters} role="group" aria-label={t("mentoring.home.views.find.filters")}>
            {filters.map((filter) => (
              <div key={filter.key} className={styles.filter}>
                <Dropdown ariaLabel={filter.label} value={filter.value} options={filter.options} onChange={filter.onChange} />
              </div>
            ))}
          </div>
        ) : null}
        <Notice text={notice} tone="risk" />
        {failed ? (
          <div className={styles.fault}>
            <p className={styles.quiet}>{t("mentoring.home.catalog_failed")}</p>
            <Button type="button" size="sm" variant="secondary" onClick={onRetry}>
              {t("mentoring.labels.retry")}
            </Button>
          </div>
        ) : rows.length ? (
          <ul className={styles.rows}>
            {rows.map((row) => (
              <MentorRow key={row.id} row={row} openText={t("mentoring.labels.open")} newTabText={newTabText} />
            ))}
          </ul>
        ) : (
          <p className={styles.quiet}>{emptyText}</p>
        )}
        {capNote ? <p className={styles.quiet}>{capNote}</p> : null}
        <LinkCard
          external
          href={ESTA_MENTORS_URL}
          title={t("mentoring.home.esta_title")}
          description={t("mentoring.home.esta_help")}
          newTabText={newTabText}
        />
      </div>
    </StepPanel>
  );
}

/** Minu suhted: käimas või lõppenud; rida avab suhteruumi. */
export function RelationsView({ t, groups, group, onGroup, rows, empty }) {
  return (
    <StepPanel title={t("mentoring.home.views.relations.title")}>
      <div className={styles.stack}>
        {groups.length > 1 ? (
          <ChoiceRow
            label={t("mentoring.home.views.relations.groups")}
            labelHidden
            columns={groups.length}
            options={groups}
            value={group}
            onChange={onGroup}
          />
        ) : null}
        {rows.length ? (
          <ul className={styles.rows}>
            {rows.map((row) => (
              <li key={row.id} className={styles.rowItem}>
                <Link className={styles.row} href={row.href} prefetch={false}>
                  <span className={styles.rowMain}>
                    <span className={styles.rowTitle}>{row.title}</span>
                  </span>
                  <span className={styles.rowMeta}>
                    <Chip tone={row.tone}>{row.chip}</Chip>
                    {row.meta ? <span className={styles.time}>{row.meta}</span> : null}
                  </span>
                  <span className={styles.rowOpen} aria-hidden="true">
                    {row.openText} ›
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>{empty.title}</p>
            <p className={styles.quiet}>{empty.help}</p>
            <p className={styles.small}>{empty.note}</p>
          </div>
        )}
      </div>
    </StepPanel>
  );
}

/**
 * Taotlused. Saabunud taotlus on otsus (tekst ja kaks nuppu), minu saadetud
 * taotlus on madal rida seisu ja ühe tegevusega. Keeldumine ja tühistamine
 * küsivad teist vajutust: silt tuleb lehelt.
 */
export function RequestsView({ t, notice, groups, group, onGroup, incoming, sent }) {
  const rows = group === "incoming" ? incoming : sent;
  const lead = !rows.length ? "" : group === "incoming" ? t("mentoring.home.incoming_help") : t("mentoring.home.views.requests.sent_lead");
  return (
    <StepPanel title={t("mentoring.home.views.requests.title")} lead={lead || undefined}>
      <div className={styles.stack}>
        {groups.length > 1 ? (
          <ChoiceRow
            label={t("mentoring.home.views.requests.groups")}
            labelHidden
            columns={groups.length}
            options={groups}
            value={group}
            onChange={onGroup}
          />
        ) : null}
        <Notice text={notice?.text} tone={notice?.tone}>
          {notice?.href ? (
            <>
              {" "}
              <TextLink href={notice.href}>{t("mentoring.home.open_relation")}</TextLink>
            </>
          ) : null}
        </Notice>
        {!rows.length ? (
          <p className={styles.quiet}>{t("mentoring.home.views.requests.empty")}</p>
        ) : group === "incoming" ? (
          <ul className={styles.rows}>
            {incoming.map((row) => (
              <li key={row.id} className={styles.card}>
                <div className={styles.cardHead}>
                  <span className={styles.rowTitle}>{row.name}</span>
                  {row.meta ? <span className={styles.time}>{row.meta}</span> : null}
                </div>
                {row.message ? <p className={styles.cardText}>{row.message}</p> : null}
                {row.canRespond ? (
                  <div className={styles.buttons}>
                    <Button type="button" size="sm" variant="primary" disabled={row.busy} onClick={row.onAccept}>
                      {t("mentoring.home.accept")}
                    </Button>
                    <Button type="button" size="sm" variant="secondary" disabled={row.busy} onClick={row.onDecline}>
                      {row.declineLabel}
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <ul className={styles.rows}>
            {sent.map((row) => (
              <li key={row.id} className={styles.item}>
                <span className={`${styles.rowTitle} ${styles.itemTitle}`}>{row.name}</span>
                <span className={styles.rowMeta}>
                  <Chip tone={row.tone}>{row.chip}</Chip>
                  {row.meta ? <span className={styles.time}>{row.meta}</span> : null}
                </span>
                {row.canCancel ? (
                  <Button type="button" size="sm" variant="secondary" disabled={row.busy} onClick={row.onCancel}>
                    {row.cancelLabel}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </StepPanel>
  );
}

/** Mina mentorina: profiili seis ühe reana ja tee profiili lehele. */
export function MentorView({ t, profile, href }) {
  return (
    <StepPanel title={t("mentoring.home.views.mentor.title")}>
      <div className={styles.stack}>
        {profile ? (
          <p className={styles.line}>
            <span className={styles.rowTitle}>{profile.name}</span>
            <Chip tone={profile.tone}>{profile.chip}</Chip>
            <Chip tone="quiet">{profile.capacity}</Chip>
          </p>
        ) : (
          <p className={styles.quiet}>{t("mentoring.home.no_profile")}</p>
        )}
        <LinkCard
          href={href}
          title={profile ? t("mentoring.home.manage_profile") : t("mentoring.home.become_mentor")}
          description={profile ? t("mentoring.home.manage_profile_help") : t("mentoring.home.become_mentor_help")}
        />
      </div>
    </StepPanel>
  );
}
