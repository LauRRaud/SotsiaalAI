"use client";

/**
 * Avatud kohtumise märkme vaated (üks kiht, avatud kirje, paranduste ajalugu)
 * ja kohtumise heli vaade.
 *
 * KAHEKSA KIHTI ON KAHEKSA ERALDI VAADET, mitte üks loend siltidega. See ei
 * ole kujundusvalik: kui kliendi enda sõnad ja töötaja tõlgendus seisavad ühes
 * voos, loeb inimene neid ühe tekstina ka siis, kui igal real on silt küljes.
 * Eraldi vaade sunnib kirjutamise hetkel valima, KUHU rida käib — ja just see
 * valik ongi kihilise märkme mõte. Kihid on sakkidena kohe näha ja vahetuvad
 * ühe vajutusega: kohtumise ajal kirjutatakse vaheldumisi mitmesse kihti.
 *
 * VAADE ON KIRJELDUS: avatud märkme vaate funktsioon annab
 * `{ title, note, actions, body }` ja selle joonistab `OpenView`
 * (`./SectionBits.jsx`) märkme päise ja sakkide alla. Nii jääb sakirida saki
 * vahetusel paigale. Kohtumise heli on juhtumi lava oma osa ja seepärast päris
 * komponent.
 *
 * PRIVAATNE REFLEKSIOON SEISAB LÕPUS ja kannab oma selgitust. Tema kirjeid ei
 * saa teise kihti tõsta (server annab 409) ja liides ei paku selleks nuppu —
 * lubadust ei tohi saada tühistada ümbernimetamisega.
 *
 * Siin on ainult kuju. Andmed, päringud ja olek on failides
 * ../MeetingNoteSection.jsx ja ../MeetingAudioSection.jsx, read ja reeglid
 * failis ./sectionRows.js.
 *
 * Kujundus: sections.module.css (siin kõrval).
 */

import { useEffect, useRef } from "react";

import SessionRecorder from "@/components/documents/SessionRecorder";
import StepPanel from "@/components/stage/StepPanel";
import TextAreaField from "@/components/stage/TextAreaField";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

import { Chip, Notice } from "../cases/CaseListViews";
import base from "../cases/cases.module.css";
import { TwoStep } from "./SectionBits";
import styles from "./sections.module.css";

/**
 * Üks kiht: selle kirjed ja all servas „Lisa kirje". Rida avab kirje (terve
 * tekst ja tagasivõtmine).
 *
 * TÜHISTATUD RIDA JÄÄB LOENDISSE (SOL-CW-15), aga teda ei avata ja oma teksti
 * ta ei kanna: sisu on paranduste ajaloos. Rea kadumine tähendaks tühja
 * konteinerit, mis näib puutumata.
 */
export function noteLayerView({ t, title, isPrivate, rows, add, glow, onOpen }) {
  return {
    title,
    actions: (
      <Button type="button" size="sm" variant="primary" glow={glow} disabled={add.disabled} onClick={add.onClick}>
        {t("casework.note.add_entry", "")}
      </Button>
    ),
    body: (
      <>
        {isPrivate ? <p className={base.quiet}>{t("casework.note.private_locked_hint", "")}</p> : null}
        {rows.length ? (
          <ul className={base.rows}>
            {rows.map((row) =>
              row.retracted ? (
                <li className={base.item} key={row.id}>
                  <span className={styles.muted}>{t("casework.note.entry_retracted", "")}</span>
                  <span className={base.rowMeta}>
                    <Chip>{row.provenanceText}</Chip>
                    {row.revised ? <Chip>{row.revised}</Chip> : null}
                  </span>
                </li>
              ) : (
                <li className={base.rowItem} key={row.id}>
                  <button type="button" className={base.row} onClick={() => onOpen(row.id)}>
                    {/* Tekst on TEKST: sisu tuleb React'i lapsena, mitte HTML-ina. */}
                    <span className={base.rowText}>{row.text}</span>
                    <span className={base.rowMeta}>
                      <Chip>{row.provenanceText}</Chip>
                      {/* Parandatud rida ütleb seda VÄLJA. Vaikselt parandatud
                          tõend on täpselt see, mille SOL-CW-15 maha võttis. */}
                      {row.revised ? <Chip>{row.revised}</Chip> : null}
                    </span>
                    <span className={base.rowOpen} aria-hidden="true">
                      {t("casework.note.open", "")} ›
                    </span>
                  </button>
                </li>
              )
            )}
          </ul>
        ) : (
          <p className={base.quiet}>{t("casework.note.entries_empty", "")}</p>
        )}
      </>
    )
  };
}

/**
 * Avatud kirje: tekst tervikuna, päritolu ja tagasivõtmine.
 *
 * TÜHISTUS, MITTE KUSTUTUS (SOL-CW-15). PÕHJUS ON VÄLJAL, MITTE
 * KINNITUSTEKSTIS: kaheastmeline „kas oled kindel" ei tekita auditile midagi;
 * server nõuab põhjust ja kui pind seda ei küsi, saab töötaja 400 alles pärast
 * otsust. Nupp on kinni, kuni põhjus on kirjutatud, ja küsib siis teist
 * vajutust.
 */
export function noteEntryView({ t, title, row, reason, locked, retract, correct, onBack }) {
  return {
    title,
    actions: (
      <>
        <Button type="button" size="sm" variant="secondary" onClick={onBack}>
          {t("casework.note.back_to_layer", "")}
        </Button>
        {/* Parandus on omaette vaade: uus tekst ja põhjus. Eelmine tekst jääb paranduste alla. */}
        <Button type="button" size="sm" variant="secondary" disabled={correct.disabled} onClick={correct.onOpen}>
          {t("casework.note.correct_entry", "")}
        </Button>
        {/* Võti seob kinnituse SELLE kirjega: poolik kinnitus ei kandu teise rea nupule. */}
        <TwoStep
          key={`retract:${row.id}`}
          t={t}
          label={t("casework.note.retract_entry", "")}
          confirmLabel={t("casework.note.confirm_retract_entry", "")}
          disabled={retract.disabled}
          onConfirm={retract.onConfirm}
        />
      </>
    ),
    body: (
      <>
        {/* Tekst on TEKST: sisu tuleb React'i lapsena, mitte HTML-ina. */}
        <p className={base.pointText}>{row.text}</p>
        <p className={base.line}>
          <Chip>{row.provenanceText}</Chip>
          {row.revised ? <Chip>{row.revised}</Chip> : null}
        </p>
        <label className={base.field} data-size="lg">
          <span className={base.fieldLabel}>{t("casework.note.retract_reason", "")}</span>
          <Input type="text" value={reason.value} maxLength={1000} disabled={locked} onChange={(event) => reason.onChange(event.target.value)} />
        </label>
      </>
    )
  };
}

/**
 * Salvestatud kirje parandamine: uus tekst ja kohustuslik põhjus.
 *
 * PARANDUS, MITTE ÜMBERKIRJUTUS (SOL-CW-15). Server hoiab eelmise teksti, aja ja
 * põhjuse alles ning need on näha paranduste sakil; rea päritolu parandus ei
 * muuda. Nupp on kinni, kuni tekst erineb salvestatust ja põhjus on kirjutatud.
 */
export function noteEntryCorrectView({ t, title, formId, text, reason, locked, busy, glow, canSubmit, onSubmit, onCancel }) {
  return {
    title,
    note: t("casework.note.correct_hint", ""),
    actions: (
      <>
        <Button type="button" size="sm" variant="secondary" onClick={onCancel}>
          {t("casework.page.cancel", "")}
        </Button>
        <Button type="submit" form={formId} size="sm" variant="primary" glow={glow} disabled={locked || busy || !canSubmit}>
          {t("casework.note.save_correction", "")}
        </Button>
      </>
    ),
    body: (
      <form id={formId} className={base.stack} onSubmit={onSubmit}>
        <div data-autofocus>
          <TextAreaField label={t("casework.note.correct_text", "")} value={text.value} onChange={text.onChange} rows={3} maxLength={4000} disabled={locked} />
        </div>
        <label className={base.field} data-size="lg">
          <span className={base.fieldLabel}>{t("casework.note.correct_reason", "")}</span>
          <Input type="text" value={reason.value} maxLength={1000} disabled={locked} onChange={(event) => reason.onChange(event.target.value)} />
        </label>
      </form>
    )
  };
}

/**
 * Paranduste ja tühistuste ajalugu (SOL-CW-15).
 *
 * SIIN ON ASENDATUD TEKST NÄHTAV — see ongi tõend. Ilma temata oleks „eelmine
 * versioon säilib" lubadus, mida keegi kontrollida ei saa, ja pärast kõigi
 * ridade tühistamist näeks märge välja nagu puutumata tühi konteiner.
 *
 * Tühja ajaloo kohta öeldakse VÄLJA, et parandusi ei ole. Kadunud vaade
 * tähendaks, et lugeja ei tea, kas parandusi ei olnud või ei oska pind neid
 * näidata.
 */
export function noteHistoryView({ t, rows, shown = rows.length, onMore }) {
  /* KAKS KIRJET KORRAGA: iga kirje on kolm rida (asendatud tekst, märgid, põhjus)
     ja pikem loend lükkas sakid paneelist välja. Ülejäänud avab „Näita rohkem”. */
  const visible = rows.slice(0, shown);
  return {
    title: t("casework.note.history_title", ""),
    /* Selgitus seisab ainult tühja ajaloo juures: kirjed ise näitavad eelmist
       sisu, aega ja põhjust, ja koos nendega ei mahtunud vaade paneeli. */
    note: rows.length ? "" : t("casework.note.history_hint", ""),
    actions:
      rows.length > visible.length ? (
        <Button type="button" size="sm" variant="secondary" onClick={onMore}>
          {t("casework.note.load_more", "")}
        </Button>
      ) : null,
    body: (
      <>
        {visible.length ? (
          <ul className={base.rows}>
            {visible.map((row) => (
              <li className={styles.record} key={row.id}>
                {/* Asendatud tekst on TEKST, sama reegel mis kehtival real. */}
                <span className={styles.recordText}>{row.text}</span>
                <span className={styles.recordMeta}>
                  <Chip>{row.kindText}</Chip>
                  <Chip>{row.layerText}</Chip>
                  {row.time ? <span className={base.time}>{row.time}</span> : null}
                </span>
                {/* Põhjus on kasutaja enda tekst ja ta on selle rea MÕTE. */}
                <span className={styles.recordNote}>
                  {t("casework.note.revision_reason", "")}: {row.reason}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={base.quiet}>{t("casework.note.history_empty", "")}</p>
        )}
      </>
    )
  };
}

const RECORDER_CLASSES = Object.freeze({
  root: styles.recorder,
  consent: styles.consent,
  actions: styles.recorderActions,
  status: styles.recorderStatus,
  hint: styles.recorderHint,
  error: styles.recorderError
});

/**
 * Kohtumise heli: näost näkku kohtumise salvesti.
 *
 * Salvesti ise on `components/documents/SessionRecorder.jsx` ja seda siin ei
 * muudeta: vaade annab talle platvormi nupu ja oma kujunduse klassid.
 *
 * SALVESTAMISE SEIS LOETAKSE SALVESTI JUURELEMENDILT (`data-recorder-phase`).
 * Salvesti ei teata oma seisust muul viisil, aga osa plaat juhtumi ülevaates
 * peab ütlema, et salvestus käib: salvesti jääb tööle ka siis, kui ees on
 * juhtumi teine osa.
 *
 * LINK DOKUMENTIDE LEHELE ON TAVALINE ANKUR, mitte rakenduse sisene liikumine:
 * teade ilmub ka keset salvestust (osa salvestub iga kümne minuti järel) ja
 * ainult päris lehevahetuse eel küsib salvesti, kas inimene tahab lahkuda.
 */
export function AudioView({ t, title, disabled, glow, notice, errorText, onPartSaved, onRecording, onAlert }) {
  const wrapRef = useRef(null);
  const reportRef = useRef(onRecording);
  const alertRef = useRef(onAlert);
  useEffect(() => {
    reportRef.current = onRecording;
    alertRef.current = onAlert;
  }, [onAlert, onRecording]);

  /* Salvesti teated (osa jäi salvestamata, mikrofon kadus, osade piir) on
     tema enda sees. Juhtum näitab teistes osades rida, et siin on teade:
     selleks ütleme, kas salvestis on praegu hoiatus ees. */
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || typeof MutationObserver === "undefined") return undefined;
    const read = () => alertRef.current?.(Boolean(wrap.querySelector('[role="alert"]')));
    read();
    const observer = new MutationObserver(read);
    observer.observe(wrap, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      alertRef.current?.(false);
    };
  }, []);

  useEffect(() => {
    const node = wrapRef.current?.querySelector("[data-recorder-phase]");
    if (!node || typeof MutationObserver === "undefined") return undefined;
    const read = () => {
      const phase = node.getAttribute("data-recorder-phase");
      reportRef.current?.(phase === "recording" || phase === "closing");
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(node, { attributes: true, attributeFilter: ["data-recorder-phase"] });
    return () => observer.disconnect();
  }, []);

  return (
    <StepPanel title={title} lead={t("casework.note.audio_hint", "")}>
      <div className={base.stack}>
        <div ref={wrapRef}>
          <SessionRecorder
            disabled={disabled}
            ButtonComponent={Button}
            buttonProps={{ size: "sm", variant: "primary", glow }}
            classNames={RECORDER_CLASSES}
            onPartSaved={onPartSaved}
          />
        </div>
        {notice ? (
          /* `aria-live`, mitte status-roll: ühine lehekiht joonistab iga
             status-rolliga elemendi oma teatena. */
          <p className={base.notice} aria-live="polite">
            {notice.text}{" "}
            <a className={styles.link} href={notice.href}>
              {notice.linkText}
            </a>
          </p>
        ) : null}
        <Notice text={errorText} tone="risk" />
      </div>
    </StepPanel>
  );
}
