"use client";

/**
 * Koostamisruumi tulemuse vaated: tekst, täiendamine, versioonid, kinnitamine
 * ja pöörduja viimased tulemused.
 *
 * MIKS. Tulemus oli ühes kastis: pealkiri, 14-realine tekstiväli, viis nuppu,
 * versioonide loend ja allikad, ning täiendamine käis sama lehe teises otsas
 * vestluses. Nüüd on igal tegevusel oma vaade:
 *
 *  - `TextView`      tekst ise: muudetaval mustandil pealkiri ja sisu, kinnitatud
 *                    tekstil lugemine; salvestamine, kopeerimine, allikad
 *  - `RefineView`    juhis ja nupp, mis täiendab mustandit
 *  - `VersionsView`  tööruumi versioonid ja salvestatud teksti taastamine
 *  - `ApproveView`   kinnitamine (teise vajutusega) ja allalaadimine
 *  - `ResultsView`   pöörduja viimased tulemused: madal rida, üks tegevus „Ava”
 *
 * Siin on ainult kuju. Andmed, päringud ja olek on failis ../AgentModePage.jsx,
 * read ja reeglid failis ./draftingModel.js.
 *
 * Kujundus: drafting.module.css (siin kõrval).
 */

import StepPanel from "@/components/stage/StepPanel";
import TextAreaField from "@/components/stage/TextAreaField";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

import { ActionButtons, Chip, Notices, PromptPanel, noKeyRepeat } from "./DraftingBits";
import styles from "./drafting.module.css";

/** Tulemuse märgid ja ajad ühel real. */
function SheetLine({ sheet }) {
  return (
    <div className={styles.line}>
      {sheet.chips.map((chip) => (
        <Chip key={chip.key} tone={chip.tone}>
          {chip.text}
        </Chip>
      ))}
      {sheet.facts.map((fact) => (
        <span key={fact.key} className={styles.time}>
          {fact.label} {fact.value}
        </span>
      ))}
    </div>
  );
}

/**
 * Tekst. `state` ütleb, mis on ees: avamine (`loading`), avamine ei õnnestunud
 * (`failed`), muudetav mustand (`draft`) või kinnitatud tekst (`final`).
 * Mustandi sisu väli on pikk tekst ja seepärast täislaiuses; pealkiri on nii
 * lai, kui pealkiri vajab. Tekst võib olla pikk: siis kerib kogu paneel.
 */
export function TextView({ t, title, notice, state, error, sheet, editor, text, flag, sourcesLabel, note, actions, glow }) {
  if (state === "loading") {
    return (
      <StepPanel title={title}>
        <p className={styles.quiet}>{t("documents.loading")}</p>
      </StepPanel>
    );
  }
  if (state === "failed") {
    return (
      <StepPanel title={title}>
        <div className={styles.stack}>
          <Notices t={t} notice={notice} />
          <p className={styles.notice} data-tone="risk" role="alert">
            {error}
          </p>
        </div>
      </StepPanel>
    );
  }
  return (
    <StepPanel title={title} note={note} actions={<ActionButtons actions={actions} glow={glow} />}>
      <div className={styles.stack}>
        <Notices t={t} notice={notice} />
        <SheetLine sheet={sheet} />
        {flag ? <p className={styles.quiet}>{flag}</p> : null}
        {editor ? (
          <>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{t("documents.form.title_label")}</span>
              <Input value={editor.title} onChange={(event) => editor.onTitle(event.target.value)} autoComplete="off" />
            </label>
            {/* Toimeti kõrgus tuleb akna kõrgusest (vt `.editorArea`): vaade mahub
                paneeli ja nupurida jääb nähtavale; pikk tekst kerib välja sees. */}
            <div className={styles.editorArea}>
              <TextAreaField label={t("documents.form.content_label")} rows={6} value={editor.content} onChange={editor.onContent} />
            </div>
          </>
        ) : (
          <p className={styles.text}>{text}</p>
        )}
        {sheet.sources.length ? (
          <p className={styles.sources}>
            <span className={styles.sourcesLabel}>{sourcesLabel}</span>
            {sheet.sources.map((source) => (
              <a key={source.key} className={styles.textLink} href={source.href}>
                {source.title}
              </a>
            ))}
          </p>
        ) : null}
      </div>
    </StepPanel>
  );
}

/** Täiendamine: mida mustandis muuta, ja nupp, mis täiendab teksti. */
export function RefineView({ t, title, lead, notice, prompt, glow }) {
  return <PromptPanel t={t} title={title} lead={lead} notice={notice} prompt={prompt} glow={glow} />;
}

/**
 * Versioonid: selle tööruumi viimased versioonid, uusim ees. Rida on madal:
 * nimi, liik, kas see on praegu toimetis, aeg ja üks tegevus (taasta).
 * `saved` on salvestatud teksti taastamine, kui toimetis on salvestamata
 * muudatusi.
 */
export function VersionsView({ t, title, lead, notice, rows, emptyText, saved, note }) {
  return (
    <StepPanel
      title={title}
      lead={lead}
      note={note}
      actions={
        saved ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onKeyDown={noKeyRepeat}
            onClick={saved.onClick}
          >
            {saved.label}
          </Button>
        ) : null
      }
    >
      <div className={styles.stack}>
        <Notices t={t} notice={notice} />
        {rows.length === 0 ? (
          <p className={styles.quiet}>{emptyText}</p>
        ) : (
          <ul className={styles.rows}>
            {rows.map((row) => (
              <li key={row.key} className={styles.fileRow}>
                <span className={styles.rowTitle}>{row.title}</span>
                <span className={styles.rowMeta}>
                  {row.kind ? <Chip tone="quiet">{row.kind}</Chip> : null}
                  {row.current ? <Chip tone="ok">{t("documents.drafting.versions.current")}</Chip> : null}
                  <span className={styles.time}>{row.meta}</span>
                </span>
                <span className={styles.rowActions}>
                  {row.onRestore ? (
                    <button
                      type="button"
                      className={styles.textButton}
                      onKeyDown={noKeyRepeat}
                      onClick={row.onRestore}
                    >
                      {row.restoreLabel}
                    </button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </StepPanel>
  );
}

/**
 * Kinnitamine. Mustandil on üks nupp, mis küsib teist vajutust: kinnitatud
 * teksti ei saa enam muuta. Kinnitatud tekstil on siin allalaadimised.
 */
export function ApproveView({ t, title, lead, notice, sheet, approve, downloads, note, glow }) {
  return (
    <StepPanel
      title={title}
      lead={lead}
      note={note}
      actions={
        approve ? (
          <Button
            type="button"
            size="sm"
            variant="primary"
            glow={glow}
            disabled={approve.disabled}
            onKeyDown={noKeyRepeat}
            onClick={approve.onClick}
          >
            {approve.label}
          </Button>
        ) : (
          <ActionButtons actions={downloads} glow={glow} />
        )
      }
    >
      <div className={styles.stack}>
        <Notices t={t} notice={notice} />
        <SheetLine sheet={sheet} />
      </div>
    </StepPanel>
  );
}

/**
 * Pöörduja viimased tulemused. Rida on üks vajutatav lahter: pealkiri, olek,
 * aeg ja tee edasi. Allalaadimine, kopeerimine ja kustutamine on avatud
 * tulemuse vaadetes.
 */
export function ResultsView({ t, title, lead, notice, loading, error, rows, emptyText, note }) {
  return (
    <StepPanel title={title} lead={lead} note={note}>
      <div className={styles.stack}>
        <Notices t={t} notice={notice} />
        {error ? (
          <p className={styles.notice} data-tone="risk" role="alert">
            {error}
          </p>
        ) : null}
        {loading ? (
          <p className={styles.quiet}>{t("documents.loading")}</p>
        ) : rows.length === 0 ? (
          <p className={styles.quiet}>{emptyText}</p>
        ) : (
          <ul className={styles.rows}>
            {rows.map((row) => (
              <li key={row.key} className={styles.rowItem}>
                <button
                  type="button"
                  className={styles.row}
                  aria-current={row.current ? "true" : undefined}
                  onKeyDown={noKeyRepeat}
                  onClick={row.onOpen}
                >
                  <span className={styles.rowTitle}>{row.title}</span>
                  <span className={styles.rowMeta}>
                    <Chip tone={row.tone}>{row.status}</Chip>
                    {row.current ? <Chip tone="quiet">{t("documents.drafting.results.opened")}</Chip> : null}
                    <span className={styles.time}>{row.date}</span>
                  </span>
                  <span className={styles.rowOpen} aria-hidden="true">
                    {row.openLabel} ›
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </StepPanel>
  );
}
