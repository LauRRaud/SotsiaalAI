"use client";

/**
 * Avatud kohtumise ettevalmistuse vaated: ülevaade, üks väli, küsimuste ja
 * väidete loend ja avatud küsimus.
 *
 * MIKS. Ettevalmistus oli üks pikk veerg: loomise vorm, loend ja selle all
 * avatud ettevalmistus viie tekstikasti, viie salvestusnupu, küsimuste vormi
 * ja küsimuste loendiga. Nüüd on korraga ees üks asi. Loend, uue
 * ettevalmistuse vorm, uue rea vorm ja päritolu kinnitamine on ühised tükid
 * (`./SectionBits.jsx`); siin on see, mis on ettevalmistuse oma.
 *
 * VAADE ON KIRJELDUS: iga funktsioon annab `{ title, note, actions, body }` ja
 * selle joonistab `OpenView` (`./SectionBits.jsx`) avatud ettevalmistuse päise
 * ja sakkide alla. Nii jääb sakirida saki vahetusel paigale.
 *
 * PÄRITOLU ON LIIDESE TASEMEL NÄHTAV, mitte peidetud: iga väli ja iga küsimus
 * kannab oma märgist. AI mustandi kõrval seisab kinnitamise nupp ja see on
 * ainus koht, kust märgis muutub.
 *
 * Siin on ainult kuju. Andmed, päringud ja olek on failis
 * ../MeetingPrepSection.jsx, read ja reeglid failis ./sectionRows.js.
 *
 * Kujundus: sections.module.css (siin kõrval).
 */

import TextAreaField from "@/components/stage/TextAreaField";
import Button from "@/components/ui/Button";

import { Chip } from "../cases/CaseListViews";
import base from "../cases/cases.module.css";
import { TwoStep } from "./SectionBits";
import styles from "./sections.module.css";

/**
 * Ülevaade: kui palju on täidetud ja mis ootab kinnitamist. Siit saab
 * ettevalmistuse ka kustutada; kustutamine küsib teist vajutust.
 *
 * `remove` puudub arhiveeritud sisuga ettevalmistusel: see on arhiveerimise
 * marker ja peab alles jääma (O-JTA-6), server keeldub kustutamast.
 */
export function prepOverviewView({ t, overview, remove }) {
  return {
    title: t("casework.prep.overview_title", ""),
    actions: remove ? (
      <TwoStep
        key="delete"
        t={t}
        label={t("casework.prep.delete", "")}
        confirmLabel={t("casework.prep.confirm_delete", "")}
        disabled={remove.disabled}
        onConfirm={remove.onConfirm}
      />
    ) : null,
    body: (
      <>
        {/* O-JTA-6: arhiveeritud sisuga ettevalmistus on TÜHJAST ERISTATAV. Ilma
            selleta näeks „töötaja arhiveeris töömaterjali" välja täpselt nagu
            „ettevalmistust ei ole veel alustatud". */}
        {overview.purged ? <p className={base.notice}>{overview.purged}</p> : null}
        <p className={styles.fact}>{overview.fields}</p>
        <p className={styles.fact}>{overview.questions}</p>
        {overview.pending ? (
          <p className={base.line}>
            <Chip tone="wait">{overview.pending}</Chip>
          </p>
        ) : null}
      </>
    )
  };
}

/**
 * Üks ettevalmistuse väli: tekst ja selle päritolu.
 *
 * Uuel real EI OLE vaikimisi päritolu (L4): esimene salvestus küsib päritolu
 * omaette vaates (`provenanceView`) ja nupp ütleb seda ette. Olemasoleval real
 * päritolu enam ei küsita: märgis EI muutu teksti salvestamisega (server eirab
 * saadetud väärtust) ja jalarea lause ütleb seda. AI mustandi kõrval on nupp,
 * mis avab kinnitamise.
 *
 * `locked`: juhtum on kirjutuskaitstud või ettevalmistuse sisu on arhiveeritud.
 */
export function prepFieldView({ t, field, text, onText, locked, busy, glow, canSave, onSave, onConfirmOpen }) {
  return {
    title: field.label,
    note: field.saved ? t("casework.prep.provenance_kept", "") : "",
    actions: (
      <Button type="button" size="sm" variant="primary" glow={glow} disabled={locked || busy || !canSave} onClick={onSave}>
        {t(field.saved ? "casework.prep.save_field" : "casework.prep.choose_provenance", "")}
      </Button>
    ),
    body: (
      <>
        {/* Välja nimi on sakil: silt jääb ekraanilugejale. Võti hoiab iga
            välja kasti omaette: saki vahetus ei kanna kursorit ega valikut
            ühest väljast teise. */}
        <div data-autofocus key={field.key}>
          <TextAreaField label={field.label} labelHidden value={text} onChange={onText} rows={3} maxLength={4000} disabled={locked} />
        </div>
        {field.saved ? (
          <div className={styles.lineRow}>
            <span className={base.lineLabel}>{t("casework.prep.provenance_label", "")}</span>
            <Chip tone={field.ai ? "wait" : undefined}>{field.provenanceText}</Chip>
            {field.ai ? (
              <Button type="button" size="sm" variant="secondary" disabled={locked || busy} onClick={onConfirmOpen}>
                {t("casework.prep.confirm_provenance", "")}
              </Button>
            ) : null}
          </div>
        ) : null}
      </>
    )
  };
}

/**
 * Täpsustavad küsimused ja kontrollitavad väited: loend, kust rida avab
 * küsimuse. Küsimus otsib infot, väide kinnitab olemasolevat: neid ei valata
 * kokku, seepärast on kummalgi oma lisamise nupp ja rida kannab liiki märgina.
 *
 * `add` puudub arhiveeritud sisuga ettevalmistusel: sinna ei kirjutata uut
 * sisu (server keeldub 409-ga) ja vorm, mis seda ei tea, annaks inimesele vea
 * tema enda teo eest.
 */
export function prepQuestionsView({ t, rows, add, glow, onOpen }) {
  return {
    title: t("casework.prep.questions_title", ""),
    /* Selgitus on all servas nuppude kõrval: loend saab kogu ruumi. */
    note: t("casework.prep.questions_hint", ""),
    actions: add
      ? add.kinds.map((kind) => (
          <Button
            key={kind.value}
            type="button"
            size="sm"
            variant={kind.primary ? "primary" : "secondary"}
            glow={kind.primary ? glow : undefined}
            disabled={add.disabled}
            onClick={() => add.onAdd(kind.value)}
          >
            {kind.label}
          </Button>
        ))
      : null,
    body: (
      <>
        {rows.length ? (
          <ul className={base.rows}>
            {rows.map((row) => (
              <li className={base.rowItem} key={row.id}>
                <button type="button" className={base.row} onClick={() => onOpen(row.id)}>
                  {/* Tekst on PLAIN TEXT ja renderdub tekstina: HTML-i sisestust
                      siin ei ole ega tule. */}
                  <span className={base.rowText}>{row.text}</span>
                  <span className={base.rowMeta}>
                    <Chip>{row.kindText}</Chip>
                    <Chip tone={row.ai ? "wait" : undefined}>{row.provenanceText}</Chip>
                  </span>
                  <span className={base.rowOpen} aria-hidden="true">
                    {t("casework.prep.open", "")} ›
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className={base.quiet}>{t("casework.prep.questions_empty", "")}</p>
        )}
      </>
    )
  };
}

/**
 * Avatud küsimus või väide: tekst tervikuna, liik ja päritolu märkidena.
 * Eemaldamine küsib teist vajutust; AI mustandi juures on kinnitamise nupp.
 */
export function prepQuestionView({ t, row, busy, locked, glow, remove, onConfirmOpen, onBack }) {
  return {
    title: row.kindText,
    actions: (
      <>
        <Button type="button" size="sm" variant="secondary" onClick={onBack}>
          {t("casework.prep.back_to_questions", "")}
        </Button>
        {/* Võti seob kinnituse SELLE küsimusega: poolik kinnitus ei kandu teise rea nupule. */}
        <TwoStep
          key={`remove:${row.id}`}
          t={t}
          label={t("casework.prep.remove", "")}
          confirmLabel={t("casework.prep.confirm_remove", "")}
          disabled={remove.disabled}
          onConfirm={remove.onConfirm}
        />
        {row.ai ? (
          <Button type="button" size="sm" variant="primary" glow={glow} disabled={locked || busy} onClick={onConfirmOpen}>
            {t("casework.prep.confirm_provenance", "")}
          </Button>
        ) : null}
      </>
    ),
    body: (
      <>
        {/* Tekst on TEKST: sisu tuleb React'i lapsena, mitte HTML-ina. */}
        <p className={base.pointText}>{row.text}</p>
        <p className={base.line}>
          <Chip>{row.kindText}</Chip>
          <Chip tone={row.ai ? "wait" : undefined}>{row.provenanceText}</Chip>
        </p>
      </>
    )
  };
}
