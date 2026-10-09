"use client";

/**
 * Koostamisruumi heli rada: helifail, transkript, ülevaatus ja kokkuvõte.
 *
 * MIKS. Heli rada oli väljundi seadete keskel üks plokk, kus allika valik,
 * salvesti, loend, transkripti nupp, 8-realine tekstiväli ja kokkuvõtte nupp
 * olid üksteise all. Rada on päris jada (enne helifail, siis transkript, siis
 * ülevaatus, siis kokkuvõte), seepärast on see oma sammudega lava:
 *
 *  - `AudioSourceView`  kust heli tuleb: salvesta siin, laadi üles või vali
 *                       dokumentidest
 *  - `TranscribeView`   valitud helifail, keel ja nupp, mis koostab transkripti
 *  - `ReviewView`       transkripti tekst parandamiseks ja salvestamiseks
 *  - `SummaryView`      nupp, mis koostab kokkuvõtte, ja tee valmis mustandi juurde
 *
 * Salvesti (`components/documents/SessionRecorder.jsx`) tuleb lehelt valmis
 * kujul (`record.node`): selle nõusoleku samm ja käitumine ei muutu, siin
 * antakse sellele ainult koht.
 *
 * Siin on ainult kuju. Andmed, päringud ja olek on failis ../AgentModePage.jsx,
 * read ja reeglid failis ./draftingModel.js.
 *
 * Kujundus: drafting.module.css (siin kõrval).
 */

import ChoiceRow from "@/components/stage/ChoiceRow";
import StepPanel from "@/components/stage/StepPanel";
import TextAreaField from "@/components/stage/TextAreaField";
import Button from "@/components/ui/Button";

import { ActionButtons, Chip, Notices, PaidButton, noKeyRepeat } from "./DraftingBits";
import styles from "./drafting.module.css";

/**
 * Helifail. Üleval on kolm teed ühelaiuste lahtritena, selle all valitud tee
 * sisu: salvesti, faili valik või olemasolevate helifailide loend. Loend võib
 * olla pikk: siis kerib kogu paneel.
 */
export function AudioSourceView({ t, title, notice, ways, record, upload, existing, selected, note, glow }) {
  return (
    <StepPanel
      title={title}
      note={note}
      actions={
        upload ? (
          <Button type="button" size="sm" variant="primary" glow={glow} disabled={upload.disabled} onKeyDown={noKeyRepeat} onClick={upload.onPick}>
            {upload.label}
          </Button>
        ) : null
      }
    >
      <div className={styles.stack}>
        <Notices t={t} notice={notice} />
        <ChoiceRow label={ways.label} labelHidden columns={ways.options.length} options={ways.options} value={ways.value} onChange={ways.onChange} />
        {record ? (
          <>
            <p className={styles.quiet}>{record.help}</p>
            {record.node}
          </>
        ) : null}
        {upload ? (
          <>
            {/* Failivalija ise on peidus; seda avab jalarea nupp. */}
            <input
              ref={upload.inputRef}
              className="sr-only"
              type="file"
              tabIndex={-1}
              aria-hidden="true"
              accept={upload.accept}
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                event.target.value = "";
                upload.onFile(file);
              }}
            />
            <p className={styles.quiet}>{upload.help}</p>
          </>
        ) : null}
        {existing ? (
          <>
            <p className={styles.quiet}>{existing.help}</p>
            {existing.loading ? (
              <p className={styles.quiet}>{t("documents.drafting.audio.loading")}</p>
            ) : existing.rows.length === 0 ? (
              <p className={styles.quiet}>{t("documents.drafting.audio.empty")}</p>
            ) : (
              <ul className={styles.rows}>
                {existing.rows.map((row) => (
                  <li key={row.key} className={styles.fileRow} data-selected={row.selected ? "true" : undefined}>
                    <span className={styles.rowTitle}>{row.title}</span>
                    <span className={styles.rowMeta}>
                      <Chip tone="quiet">{row.origin}</Chip>
                      {row.hasTranscript ? <Chip tone="ok">{t("documents.drafting.audio.has_transcript")}</Chip> : null}
                      <span className={styles.time}>{row.meta}</span>
                    </span>
                    <span className={styles.rowActions}>
                      {row.selected ? (
                        <Chip tone="ok">{t("documents.drafting.audio.chosen")}</Chip>
                      ) : (
                        <button type="button" className={styles.textButton} onKeyDown={noKeyRepeat} onClick={row.onChoose}>
                          {row.chooseLabel}
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}
        {selected ? <p className={styles.meta}>{selected}</p> : null}
      </div>
    </StepPanel>
  );
}

/**
 * Transkripti koostamine. Vaates on valitud helifail, keel ja üks nupp.
 * Transkript koostatakse ainult selle nupu vajutusest; kui helifailil on
 * transkript juba olemas, nuppu ei ole ja vaade ütleb, kust seda näeb.
 */
export function TranscribeView({ t, title, lead, notice, source, language, done, note, transcribe, glow }) {
  return (
    <StepPanel
      title={title}
      lead={lead}
      note={note}
      actions={
        transcribe ? (
          <PaidButton glow={glow} disabled={transcribe.disabled} onPress={transcribe.onPress}>
            {transcribe.label}
          </PaidButton>
        ) : null
      }
    >
      <div className={styles.stack}>
        <Notices t={t} notice={notice} />
        {source ? (
          <div className={styles.line}>
            <span className={styles.rowTitle}>{source.title}</span>
            <Chip tone="quiet">{source.origin}</Chip>
            <span className={styles.time}>{source.meta}</span>
          </div>
        ) : null}
        {done ? (
          <div className={styles.line}>
            <Chip tone="ok">{done}</Chip>
          </div>
        ) : null}
        {language ? (
          <div className={styles.scales}>
            <ChoiceRow layout="scale" label={language.label} options={language.options} value={language.value} onChange={language.onChange} />
          </div>
        ) : null}
      </div>
    </StepPanel>
  );
}

/**
 * Transkripti ülevaatus. `state`: transkripti ei ole (`none`), seda avatakse
 * (`loading`), avamine ei õnnestunud (`failed`) või tekst on ees (`ready`).
 * Väli ei lähe salvestamise ajaks lukku. Tekst võib olla pikk: siis kerib kogu
 * paneel.
 */
export function ReviewView({ t, title, lead, notice, state, emptyText, editor, retry, note, actions, glow }) {
  return (
    <StepPanel title={title} lead={state === "ready" ? lead : undefined} note={note} actions={state === "ready" ? <ActionButtons actions={actions} glow={glow} /> : null}>
      <div className={styles.stack}>
        <Notices t={t} notice={notice} />
        {state === "ready" ? (
          <TextAreaField label={editor.label} labelHidden rows={10} value={editor.value} onChange={editor.onChange} />
        ) : state === "loading" ? (
          <p className={styles.quiet}>{t("documents.loading")}</p>
        ) : (
          <p className={styles.quiet}>{emptyText}</p>
        )}
        {state === "failed" && retry ? (
          <div className={styles.buttons}>
            <Button type="button" size="sm" variant="secondary" onClick={retry.onClick}>
              {retry.label}
            </Button>
          </div>
        ) : null}
      </div>
    </StepPanel>
  );
}

/**
 * Kokkuvõte. Üks nupp koostab kokkuvõtte üle vaadatud transkriptist; valmis
 * kokkuvõte avaneb mustandina koostamise jada tekstivaates (`done.onOpen`).
 */
export function SummaryView({ t, title, lead, notice, done, note, summarize, glow }) {
  return (
    <StepPanel
      title={title}
      lead={lead}
      note={note}
      actions={
        <>
          {done ? (
            <Button type="button" size="sm" variant="secondary" onKeyDown={noKeyRepeat} onClick={done.onOpen}>
              {done.openLabel}
            </Button>
          ) : null}
          <PaidButton glow={glow} disabled={summarize.disabled} onPress={summarize.onPress}>
            {summarize.label}
          </PaidButton>
        </>
      }
    >
      <div className={styles.stack}>
        <Notices t={t} notice={notice} />
        {done ? (
          <div className={styles.line}>
            <Chip tone="ok">{done.text}</Chip>
          </div>
        ) : null}
      </div>
    </StepPanel>
  );
}
