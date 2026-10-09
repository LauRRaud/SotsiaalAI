"use client";

/**
 * STAR2 järjekorra vaated: uus element, avatud elemendi väljad, uus väli,
 * avatud väli, seis, STAR2-sse viimine ja juhtumi ülekandeajalugu.
 *
 * MIKS. Sektsioon oli üks pikk veerg: tüübi rippvalik, loend ja selle all
 * avatud element väljade loendi, välja vormi, siirde vormi ja ülekandepaneeliga.
 * Nüüd on avatud elemendil kolm vaadet, mis vahetuvad sakkidest: väljad (sisu),
 * seis (olekutee) ja STAR2-sse viimine (kopeerimine ja ülekantuks märkimine).
 * Need on kolm eri tegu ja varem seisid kõik nupud üksteise all.
 *
 * VAADE ON KIRJELDUS: avatud elemendi vaate funktsioon annab
 * `{ title, note, actions, body }` ja selle joonistab `OpenView`
 * (`./SectionBits.jsx`) elemendi päise ja sakkide alla. Nii jääb sakirida saki
 * vahetusel paigale. Uue elemendi valik ja ülekandeajalugu on omaette vaated ja
 * seepärast päris komponendid.
 *
 * OLEKUTEE ON NÄHTAV, MITTE PEIDETUD. Element kannab oma seisu päises ja seisu
 * vaade pakub AINULT neid siirdeid, mida olekumasin lubab. Vaba valik koos
 * serveri veateatega õpetaks kasutajat arvama, et viga on tema tehtud.
 *
 * Siin on ainult kuju. Andmed, päringud ja olek on failides ../DraftSection.jsx
 * ja ../TransferPanel.jsx, read ja reeglid failis ./sectionRows.js, kopeerimise
 * järjekord failis ../transferFlow.js.
 *
 * Kujundus: sections.module.css (siin kõrval).
 */

import ChoiceRow from "@/components/stage/ChoiceRow";
import StepPanel from "@/components/stage/StepPanel";
import TextAreaField from "@/components/stage/TextAreaField";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";

import { Chip, Notice } from "../cases/CaseListViews";
import base from "../cases/cases.module.css";
import { ProvenanceChoice, TwoStep } from "./SectionBits";
import styles from "./sections.module.css";

/**
 * Uus element: kaheksa tüüpi on kohe näha (rippvaliku asemel). Valik ei loo
 * elementi ise: lahtrid on raadionupud ja klaviatuuril valib juba nool, seega
 * loob elemendi alles nupp.
 */
export function DraftCreateView({ t, swapRef, options, value, onChange, busy, glow, errorText, onSubmit, onCancel }) {
  return (
    <StepPanel
      title={t("casework.draft.create_title", "")}
      actions={
        <>
          <Button type="button" size="sm" variant="secondary" onClick={onCancel}>
            {t("casework.page.cancel", "")}
          </Button>
          <Button type="button" size="sm" variant="primary" glow={glow} disabled={busy || !value} onClick={onSubmit}>
            {t("casework.draft.create", "")}
          </Button>
        </>
      }
    >
      <div className={base.stack} ref={swapRef}>
        <ChoiceRow label={t("casework.draft.choose_type", "")} columns={2} options={options} value={value} onChange={onChange} />
        <Notice text={errorText} tone="risk" />
      </div>
    </StepPanel>
  );
}

/**
 * Elemendi väljad: loend, kust rida avab välja. Rea nimi on välja võti, mille
 * töötaja ise andis (sama võti läheb STAR2 plokki).
 *
 * `add` puudub lõppseisus elemendil: TERMINAALSE ELEMENDI SISU EI MUUDETA.
 * `ULE_KANTUD` ja `EI_KANTA` on lõpp-punktid ja lause all servas ütleb, miks
 * nuppu ei ole.
 */
export function draftFieldsView({ t, rows, add, terminal, glow, onOpen, purgedNote = "" }) {
  return {
    title: t("casework.draft.fields_title", ""),
    note: purgedNote || (terminal ? t("casework.draft.terminal_notice", "") : ""),
    actions: add ? (
      <Button type="button" size="sm" variant="primary" glow={glow} disabled={add.disabled} onClick={add.onClick}>
        {t("casework.draft.add_field", "")}
      </Button>
    ) : null,
    body: rows.length ? (
      <ul className={base.rows}>
        {rows.map((row) => (
          <li className={base.rowItem} key={row.key}>
            <button type="button" className={base.row} onClick={() => onOpen(row.key)}>
              {/* Tekst on TEKST: sisu tuleb React'i lapsena, mitte HTML-ina. */}
              <span className={base.rowText}>
                <span className={styles.key}>{row.key}</span> {row.text}
              </span>
              <span className={base.rowMeta}>
                <Chip>{row.provenanceText}</Chip>
              </span>
              <span className={base.rowOpen} aria-hidden="true">
                {t("casework.draft.open", "")} ›
              </span>
            </button>
          </li>
        ))}
      </ul>
    ) : (
      <p className={base.quiet}>{t("casework.draft.fields_empty", "")}</p>
    )
  };
}

/**
 * Uus väli: võti, tekst ja päritolu. Võti on masinvõti (ladina suurtähed,
 * numbrid ja alakriips) ja vihje ütleb seda enne, kui server keeldub.
 * Päritolul EI OLE vaikeväärtust (L4) — märgis, mille inimene ei valinud, ei
 * ole märgis.
 */
export function draftFieldAddView({ t, formId, draft, onChange, provenanceOptions, locked, busy, glow, canSubmit, onSubmit, onCancel }) {
  return {
    title: t("casework.draft.add_field", ""),
    actions: (
      <>
        <Button type="button" size="sm" variant="secondary" onClick={onCancel}>
          {t("casework.page.cancel", "")}
        </Button>
        <Button type="submit" form={formId} size="sm" variant="primary" glow={glow} disabled={locked || busy || !canSubmit}>
          {t("casework.draft.save_field", "")}
        </Button>
      </>
    ),
    body: (
      <form id={formId} className={base.stack} onSubmit={onSubmit}>
        {/* Lühike võti ja pikk tekst on kõrvuti, et vaade mahuks paneeli;
            telefonis üksteise all. */}
        <div className={styles.pair}>
          <label className={styles.keyField} data-autofocus>
            <span className={base.fieldLabel}>{t("casework.draft.field_key", "")}</span>
            <Input
              type="text"
              value={draft.fieldKey}
              maxLength={64}
              autoComplete="off"
              disabled={locked}
              onChange={(event) => onChange({ fieldKey: event.target.value.toUpperCase() })}
            />
            <span className={styles.hint}>{t("casework.draft.field_key_hint", "")}</span>
          </label>
          <TextAreaField
            label={t("casework.draft.field_text", "")}
            value={draft.text}
            onChange={(text) => onChange({ text })}
            rows={3}
            maxLength={4000}
            disabled={locked}
          />
        </div>
        <ProvenanceChoice
          label={t("casework.draft.provenance_required", "")}
          options={provenanceOptions}
          value={draft.provenance}
          onChange={(provenance) => onChange({ provenance })}
          disabled={locked}
        />
      </form>
    )
  };
}

/**
 * Avatud väli: tekst, mida saab parandada, ja päritolu märgina. Päritolu
 * teksti salvestamisega EI muutu (L4). Eemaldamine küsib teist vajutust.
 *
 * `locked`: juhtum on kirjutuskaitstud või element on lõppseisus; siis on
 * tekst ainult lugemiseks. Lõppseisus elemendil nuppe ei ole ja lause all
 * servas ütleb, miks.
 */
export function draftFieldView({ t, row, text, onText, locked, terminal, busy, glow, canSave, remove, onSave, onBack }) {
  return {
    title: row.key,
    note: terminal ? t("casework.draft.terminal_notice", "") : "",
    actions: (
      <>
        <Button type="button" size="sm" variant="secondary" onClick={onBack}>
          {t("casework.draft.back_to_fields", "")}
        </Button>
        {terminal ? null : (
          /* Võti seob kinnituse SELLE väljaga: poolik kinnitus ei kandu teise välja nupule. */
          <TwoStep
            key={`remove:${row.key}`}
            t={t}
            label={t("casework.draft.remove_field", "")}
            confirmLabel={t("casework.draft.confirm_remove_field", "")}
            disabled={remove.disabled}
            onConfirm={remove.onConfirm}
          />
        )}
        {terminal ? null : (
          <Button type="button" size="sm" variant="primary" glow={glow} disabled={locked || busy || !canSave} onClick={onSave}>
            {t("casework.draft.save_field", "")}
          </Button>
        )}
      </>
    ),
    body: (
      <>
        {/* Sildiks on välja võti: töötaja enda antud nimi, mitte platvormi sisemine väärtus. */}
        <TextAreaField label={row.key} value={text} onChange={onText} rows={4} maxLength={4000} disabled={locked} />
        <p className={base.line}>
          <span className={base.lineLabel}>{t("casework.draft.provenance_label", "")}</span>
          <Chip>{row.provenanceText}</Chip>
        </p>
      </>
    )
  };
}

/**
 * Seis: kus element olekuteel on ja kuhu siit saab.
 *
 * `ULE_KANTUD` EI OLE SIIN VALIK ja see ei ole väljajätt (L19): sinna viib
 * ainult „Märgi üle kantuks" (STAR2-sse viimise vaates), mis loob samas
 * tehingus auditirea. Lause ütleb selle välja, et puuduv valik ei näeks välja
 * nagu puudujääk.
 *
 * Siire lõppseisu („Ei kanta") küsib teist vajutust (`needsConfirm`).
 */
export function draftStateView({ t, view, to, onTo, review, locked, busy, glow, needsConfirm, onTransition }) {
  const hasTargets = view.targets.length > 0;
  return {
    title: t("casework.draft.state_title", ""),
    actions: !hasTargets ? null : needsConfirm ? (
      /* Võti seob kinnituse valitud sihiga: sihi vahetus alustab otsast. */
      <TwoStep
        key={`to:${to}`}
        t={t}
        label={t("casework.draft.transition", "")}
        confirmLabel={t("casework.draft.confirm_not_transferred", "")}
        disabled={locked || busy}
        onConfirm={onTransition}
      />
    ) : (
      <Button type="button" size="sm" variant="primary" glow={glow} disabled={locked || busy || !to} onClick={onTransition}>
        {t("casework.draft.transition", "")}
      </Button>
    ),
    body: (
      <>
        {view.transferredAt ? (
          <p className={base.line}>
            <span className={base.lineLabel}>{t("casework.draft.transferred_at", "")}</span>
            <span className={base.time}>{view.transferredAt}</span>
          </p>
        ) : null}
        {/* L7 loendus elemendi vaates: SISU kustub, rida ja ülekande tõend
            jäävad. Kuupäev tuleb serverist, mitte pinnal arvutatuna. */}
        {view.purgeDue ? <p className={base.quiet}>{view.purgeDue}</p> : null}
        {view.terminal ? <p className={base.notice}>{t("casework.draft.terminal_notice", "")}</p> : null}
        {hasTargets ? (
          <ChoiceRow
            label={t("casework.draft.transition_to", "")}
            columns={view.targets.length}
            options={view.targets}
            value={to}
            onChange={onTo}
            disabled={locked}
          />
        ) : null}
        {/* `reviewKind` on AINULT `VAJAB_KONTROLLI` täpsustus — mujal ei küsita
            ja server nullib ta niikuinii. */}
        {review ? (
          <ChoiceRow
            label={t("casework.draft.review_kind", "")}
            columns={review.options.length}
            options={review.options}
            value={review.value}
            onChange={review.onChange}
            disabled={locked}
          />
        ) : null}
        {/* Puuduv „STAR2-sse kantud" valik ütleb end ise välja, et ta ei näeks
            välja nagu puudujääk. */}
        {view.awaitingMark ? <p className={base.quiet}>{t("casework.draft.mark_transferred_elsewhere", "")}</p> : null}
      </>
    )
  };
}

/**
 * STAR2-sse viimine: „Kopeeri STAR2 jaoks" ja „Märgi üle kantuks".
 *
 * KAKS TÕRGET SAAVAD ERI TEATE ja teine neist on tahtlikult ebamugav:
 *
 *   lõikelaud ei võtnud vastu   → „ei õnnestunud kopeerida" + plokk kuvatakse,
 *                                 et inimene saaks ta ise valida
 *   lõikelaud võttis, audit ei  → „kopeeritud, AGA jälge ei salvestatud"
 *
 * L8 järgi on audit tõend, ja vaikne tõendi kadu on halvem kui nähtav.
 *
 * `model` tuleb failist ../TransferPanel.jsx (`useTransferActions`).
 */
export function draftTransferView({ t, model, glow }) {
  return {
    title: t("casework.transfer.actions_title", ""),
    actions: (
      <>
        {/* „Märgi üle kantuks" on OMA TEGU (L9) ja ta ei sünni kopeerimisest.
            Ta on nähtav ainult `VALMIS_ULEKANDEKS` juures, sest ainult sealt
            viib olekumasinas tee edasi — ja ta on kaheastmeline, sest
            `ULE_KANTUD` on terminaalne ja käivitab säilituskella. */}
        {model.canMark ? (
          <TwoStep
            key="mark"
            t={t}
            plain
            label={t("casework.transfer.mark_transferred", "")}
            confirmLabel={t("casework.transfer.confirm_mark_transferred", "")}
            disabled={model.working}
            onConfirm={model.onMark}
          />
        ) : null}
        <Button type="button" size="sm" variant="primary" glow={glow} disabled={model.working || model.purged} onClick={model.onCopy}>
          {t("casework.transfer.copy", "")}
        </Button>
      </>
    ),
    body: (
      <>
        {model.purged ? <p className={base.notice}>{t("casework.transfer.content_purged", "")}</p> : null}

        {/* Käsitsi kopeerimise plokk vajab ruumi: selgitus annab talle koha. */}
        {model.clipboardFailed ? null : <p className={base.quiet}>{t("casework.transfer.copy_hint", "")}</p>}

        {model.copied ? (
          <p className={base.notice} aria-live="polite">
            {t("casework.transfer.copy_ok", "")}
          </p>
        ) : null}

        {model.clipboardFailed ? (
          <>
            <Notice text={t("casework.transfer.copy_failed", "")} tone="risk" />
            {/* Tekst on TEKST: sisu tuleb `value`-na, mitte HTML-ina. Kast on
                ainult lugemiseks ja valib fookuse saades kogu ploki. */}
            <Textarea
              className={styles.block}
              readOnly
              rows={5}
              value={model.blockText}
              aria-label={t("casework.transfer.block_label", "")}
              onFocus={(event) => event.target.select()}
            />
          </>
        ) : null}

        {/* Hoiatust juhib JÄRJEKORD, mitte viimane faas (SOL-CW-05): pärast uut
            õnnestunud kopeerimist on eelmise teo jälg endiselt salvestamata ja
            seda ei tohi ekraanilt kaotada. */}
        {model.pendingCount ? (
          <>
            <Notice
              text={`${t("casework.transfer.copy_audit_failed", "")}${model.pendingCount > 1 ? ` (${model.pendingCount})` : ""}`}
              tone="risk"
            />
            <Button type="button" size="sm" variant="secondary" className={base.more} disabled={model.working} onClick={model.onRetry}>
              {t("casework.transfer.retry_audit", "")}
            </Button>
          </>
        ) : null}

        <Notice text={model.errorText} tone="risk" />
      </>
    )
  };
}

/**
 * Juhtumi ülekandeajalugu.
 *
 * SISU SIIN EI OLE — read kannavad tegu, aega ja VÄLJADE VÕTMEID (L8).
 * Kopeeritud teksti auditis ei ole ja seepärast ei saa teda siit ka lugeda;
 * ajalugu on tõend selle kohta, MIS juhtus, mitte teine koopia sellest, MIDA
 * kopeeriti.
 */
export function TransferHistoryView({ t, title, status, rows, errorText, more, onRetry }) {
  return (
    <StepPanel title={title} lead={t("casework.transfer.history_hint", "")}>
      <div className={base.stack}>
        <Notice text={errorText} tone="risk" />

        {status === "loading" && !rows.length ? <p className={base.quiet}>{t("casework.page.loading", "")}</p> : null}

        {/* „Ülekandeid ei ole" öeldakse ainult siis, kui ajalugu päriselt laaditi. */}
        {status === "ready" && !rows.length ? <p className={base.quiet}>{t("casework.transfer.history_empty", "")}</p> : null}

        {rows.length ? (
          <ul className={base.rows}>
            {rows.map((row) => (
              <li className={styles.record} key={row.id}>
                <span className={styles.recordHead}>
                  <span className={styles.recordTitle}>{row.title}</span>
                  {row.time ? <span className={base.time}>{row.time}</span> : null}
                </span>
                {row.keys.length ? (
                  <span className={styles.keys}>
                    <span className={base.lineLabel}>{t("casework.transfer.fields_label", "")}</span>
                    {row.keys.map((key) => (
                      <span className={styles.key} key={key}>
                        {key}
                      </span>
                    ))}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        {status === "error" && !rows.length ? (
          <Button type="button" size="sm" variant="secondary" className={base.more} onClick={onRetry}>
            {t("casework.page.retry", "")}
          </Button>
        ) : null}

        {more ? (
          <Button type="button" size="sm" variant="secondary" className={base.more} disabled={more.busy} onClick={more.onClick}>
            {t("casework.transfer.load_more", "")}
          </Button>
        ) : null}
      </div>
    </StepPanel>
  );
}
