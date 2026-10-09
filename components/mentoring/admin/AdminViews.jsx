"use client";

/**
 * Mentorluse halduse vaated: loend ja avatud kirje.
 *
 * MIKS. Leht oli üks pikk veerg tumeda kaardi sees: neli arvu, ülevaatuse
 * järjekord, kus iga profiili küljes oli kaks nuppu ja rippvalik, ning ESTA
 * kirjete tabel, mille igal real seisis kaks rippvalikut, väli ja kaks nuppu.
 * Nüüd on korraga ees üks asi:
 *  - `AdminListView`     arvud, kahe loendi valik ja madalad read; rida avab kirje
 *  - `QueueItemView`     ülevaatusel profiil tervikuna ja otsus (lubada või
 *                        põhjusega tagasi lükata)
 *  - `ExternalItemView`  ESTA kirje: nõusoleku seis, tõend ja kirje kustutamine
 *
 * Loend ja avatud kirje vahetuvad kohapeal, ilma sammulavata: halduse raam on
 * terve ekraani laiune ja kindla kõrgusega aken, kuhu ühe asja vaadete lend ei
 * sobi (vt ../AdminMentoringPage.jsx). Ehitusklotsid on samad mis mujal:
 * `StepPanel`, `ChoiceRow`, `ActionCard` ja mentorluse lehtede märk ning read.
 *
 * Tagasilükkamine ja kirje kustutamine on lõplikud: nupp küsib teist vajutust.
 *
 * Siin on ainult kuju. Andmed, päringud ja olek on failis
 * ../AdminMentoringPage.jsx; read ja otsused failis ./adminRows.js.
 *
 * Kujundus: admin.module.css (siin kõrval).
 */

import { useEffect, useRef } from "react";

import ActionCard from "@/components/stage/ActionCard";
import ChoiceRow from "@/components/stage/ChoiceRow";
import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

import { FullText, OpenRows, SMALL_BUTTON, TwoStep, useSwapFocus } from "../desk/DeskParts";
import { Chip, Notice } from "../entry/EntryParts";
import entry from "../entry/entry.module.css";
import styles from "./admin.module.css";

/**
 * Avatud kirje võtab loendi koha: vajutatud rida kaob ja fookus koos sellega.
 * Fookus läheb kirje pealkirjale (ekraanilugeja ütleb, mis avanes).
 */
function useHeadingFocus() {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.querySelector("[data-step-heading]")?.focus({ preventScroll: true });
  }, []);
  return ref;
}

/**
 * Lehe veerg halduse aknas. Aken on terve ekraani laiune; leht (ka laadimise
 * ja vea lause) on selles keskel üks veerg, et read ja väljad ei veniks akna
 * laiuseks. `frameRef` annab lehele koha, kust leida keriv aken.
 */
export function AdminFrame({ frameRef, children }) {
  return (
    <div className={styles.frame} ref={frameRef}>
      {children}
    </div>
  );
}

/**
 * Loend: neli arvu, kahe loendi valik, read ja (ESTA kirjete juures) kirjete
 * toomine. `focusRow`: rida, kust kirje avati; loendisse naastes läheb fookus
 * sinna tagasi. Kui seda rida enam ei ole (profiil sai otsuse, kirje
 * kustutati), läheb fookus loendi pealkirjale, mitte järgmisele nupule.
 */
export function AdminListView({ t, title, counters, groups, group, onGroup, filter, notice, fault, rows, emptyText, capText, help, importCard, focusRow, onOpen }) {
  const ref = useRef(null);
  const returnTo = useRef(focusRow);
  useEffect(() => {
    if (returnTo.current === null || returnTo.current === undefined) return;
    const node = ref.current;
    if (!node) return;
    const row = [...node.querySelectorAll("[data-row]")].find((item) => item.getAttribute("data-row") === returnTo.current);
    (row || node.querySelector("[data-step-heading]"))?.focus({ preventScroll: true });
  }, []);

  return (
    <div className={styles.desk} ref={ref}>
      <StepPanel title={title} lead={t("mentoring.admin.lead")}>
        <div className={entry.stack}>
          {counters.length ? (
            <div className={styles.counters} role="group" aria-label={t("mentoring.admin.counters")}>
              {counters.map((cell) => (
                <p key={cell.key} className={styles.counter}>
                  <strong className={styles.counterValue}>{cell.value}</strong>
                  <span className={styles.counterLabel}>{cell.label}</span>
                </p>
              ))}
            </div>
          ) : null}
          <div className={styles.bar}>
            <ChoiceRow label={t("mentoring.admin.groups")} labelHidden columns={groups.length} options={groups} value={group} onChange={onGroup} />
            {filter ? (
              <ChoiceRow
                label={t("mentoring.admin.filter")}
                labelHidden
                columns={filter.options.length > 3 ? Math.ceil(filter.options.length / 2) : filter.options.length}
                options={filter.options}
                value={filter.value}
                onChange={filter.onChange}
              />
            ) : null}
          </div>
          <Notice text={notice?.text} tone={notice?.tone} />
          {fault ? (
            <div className={entry.fault}>
              <p className={entry.quiet}>{fault.text}</p>
              <Button type="button" {...SMALL_BUTTON} onClick={fault.onRetry}>
                {t("mentoring.labels.retry")}
              </Button>
            </div>
          ) : null}
          {rows.length ? (
            <OpenRows rows={rows} openText={t("mentoring.labels.open")} onOpen={onOpen} />
          ) : emptyText ? (
            <p className={entry.quiet}>{emptyText}</p>
          ) : null}
          {capText ? <p className={entry.small}>{capText}</p> : null}
          {help ? <p className={entry.small}>{help}</p> : null}
          {importCard ? (
            <div className={styles.card}>
              <ActionCard title={importCard.title} description={importCard.description} disabled={importCard.disabled} onClick={importCard.onClick} />
            </div>
          ) : null}
        </div>
      </StepPanel>
    </div>
  );
}

/**
 * Ülevaatusel profiil. `mode`: `read` (kõik, mida mentor kirjutas, ja otsuse
 * nupud) või `reject` (tagasilükkamise põhjus ja teist vajutust küsiv nupp).
 * Haldur näeb terve profiili, mitte ainult nime ja lühitutvustust: ta lubab
 * kataloogi kõik need tekstid.
 */
export function QueueItemView({ t, mode, model, chip, groupTitles, reasons, reason, onReason, busy, note, onBack, onApprove, onStartReject, onCancelReject, onReject }) {
  const headRef = useHeadingFocus();
  const swapRef = useSwapFocus(mode);
  const title = t("mentoring.admin.views.profile.title");

  if (mode === "reject") {
    return (
      <div className={styles.desk} ref={headRef}>
        <StepPanel
          title={title}
          question={model.heading}
          lead={t("mentoring.admin.reject_lead")}
          note={note}
          actions={
            <>
              <Button type="button" {...SMALL_BUTTON} onClick={onCancelReject}>
                {t("mentoring.labels.cancel")}
              </Button>
              <TwoStep
                cancelLabel={t("mentoring.labels.cancel")}
                label={t("mentoring.admin.reject")}
                confirmLabel={t("mentoring.admin.confirm_reject")}
                disabled={busy}
                onConfirm={onReject}
              />
            </>
          }
        >
          <div ref={swapRef}>
            <ChoiceRow label={t("mentoring.admin.reason_label")} labelHidden columns={3} options={reasons} value={reason} onChange={onReason} />
          </div>
        </StepPanel>
      </div>
    );
  }

  return (
    <div className={styles.desk} ref={headRef}>
      <StepPanel
        title={title}
        question={model.heading}
        lead={model.sub || undefined}
        note={note}
        actions={
          <>
            <Button type="button" {...SMALL_BUTTON} onClick={onBack}>
              {t("mentoring.admin.back_to_list")}
            </Button>
            <Button type="button" {...SMALL_BUTTON} disabled={busy} onClick={onStartReject}>
              {t("mentoring.admin.reject")}
            </Button>
            <Button type="button" size="sm" variant="primary" disabled={busy} onClick={onApprove}>
              {t("mentoring.admin.approve")}
            </Button>
          </>
        }
      >
        <div className={entry.stack} ref={swapRef}>
          <p className={entry.line}>
            <Chip tone={chip.tone}>{chip.text}</Chip>
          </p>
          <FullText>{model.intro}</FullText>
          {model.groups.length ? (
            <div className={entry.groups}>
              {model.groups.map((group) => (
                <section key={group.key} className={entry.group}>
                  <h4 className={entry.groupTitle}>{groupTitles[group.key]}</h4>
                  <ul className={entry.tags}>
                    {group.items.map((item, index) => (
                      <li key={`${index}-${item}`} className={entry.tag}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : null}
          {model.story ? (
            <section className={entry.section}>
              <h4 className={entry.groupTitle}>{t("mentoring.admin.views.profile.story")}</h4>
              <FullText>{model.story}</FullText>
            </section>
          ) : null}
          {model.experience ? (
            <section className={entry.section}>
              <h4 className={entry.groupTitle}>{t("mentoring.profile_public.experience")}</h4>
              <FullText>{model.experience}</FullText>
            </section>
          ) : null}
        </div>
      </StepPanel>
    </div>
  );
}

/**
 * ESTA kirje: nõusoleku seis, tõend (ainult siis, kui nõusolek on olemas) ja
 * kirje kustutamine. Väljad jäävad salvestamise ajal kirjutatavaks; nõusolekut
 * ei saa salvestada ilma tõendi viiteta, sest server keeldub sellest.
 */
export function ExternalItemView({ t, model, form, statuses, evidenceTypes, maxLength, busy, note, onBack, onStatus, onEvidenceType, onEvidenceRef, onSave, onDelete }) {
  const headRef = useHeadingFocus();
  return (
    <div className={styles.desk} ref={headRef}>
      <StepPanel
        title={t("mentoring.admin.views.record.title")}
        question={model.heading}
        lead={model.sub || undefined}
        note={note}
        actions={
          <>
            <Button type="button" {...SMALL_BUTTON} onClick={onBack}>
              {t("mentoring.admin.back_to_list")}
            </Button>
            <TwoStep
              cancelLabel={t("mentoring.labels.cancel")}
              label={t("mentoring.admin.delete_external")}
              confirmLabel={t("mentoring.admin.confirm_delete")}
              disabled={busy}
              onConfirm={onDelete}
            />
            <Button type="button" size="sm" variant="primary" disabled={busy || !form.canSave} onClick={onSave}>
              {t("mentoring.admin.consent_save")}
            </Button>
          </>
        }
      >
        <div className={entry.stack}>
          <p className={entry.line}>
            <Chip tone={model.chip.tone}>{model.chip.text}</Chip>
            <span className={entry.time}>{model.checked}</span>
            {model.url ? (
              <a className={entry.textLink} href={model.url} target="_blank" rel="noopener noreferrer">
                {t("mentoring.admin.views.record.source")}
                <span aria-hidden="true"> ↗</span>
                <span className="sr-only"> ({t("mentoring.labels.opens_new_tab")})</span>
              </a>
            ) : null}
          </p>
          <ChoiceRow
            label={t("mentoring.admin.consent_label")}
            labelHidden
            columns={statuses.length}
            options={statuses}
            value={form.status}
            onChange={onStatus}
          />
          {form.needsEvidence ? (
            <>
              <ChoiceRow
                label={t("mentoring.admin.consent_evidence_type")}
                columns={evidenceTypes.length}
                options={evidenceTypes}
                value={form.evidenceType}
                onChange={onEvidenceType}
              />
              <label className={styles.field}>
                <span className={styles.fieldLabel}>{t("mentoring.admin.consent_evidence_ref")}</span>
                <Input type="text" value={form.evidenceRef} maxLength={maxLength} onChange={(event) => onEvidenceRef(event.target.value)} />
              </label>
            </>
          ) : null}
        </div>
      </StepPanel>
    </div>
  );
}
