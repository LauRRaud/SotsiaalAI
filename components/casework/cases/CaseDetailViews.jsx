"use client";

/**
 * Avatud juhtumi vaated: päis ja need juhtumi osad, mis on juhtumi enda omad
 * (põhiandmed, STAR-i viide, seotud materjal, puuduv info, elutsükkel,
 * töömaterjali arhiveerimine, kliendiviide).
 *
 * MIKS. Juhtumi detail oli üks pikk veerg kaheksa raamitud sektsiooniga, igal
 * oma pealkiri, vorm ja loend. Nüüd on iga sektsioon lava osa
 * (`components/stage/StepFlight.jsx`, `parts`): juhtum avaneb ülevaates ja osa
 * avaneb omaette vaates. Vorm, mis lisab loendisse rea (seos, punkt), ei seisa
 * enam loendi all: osa vahetab loendi vormi vastu ja tagasi.
 *
 * Siin on ainult kuju. Andmed, päringud ja olek on failis ../CaseWorkDetail.jsx,
 * ridade sisu failis ../caseViews.js. Kohtumise ettevalmistuse, märkme, heli ja
 * STAR2 järjekorra vaated on kaustas ../sections: need sektsioonid hoiavad oma
 * andmeid ise ja vahetavad oma väikesi vaateid osa sees.
 *
 * Kujundus: cases.module.css (siin kõrval).
 */

import { useEffect, useRef } from "react";

import ChoiceRow from "@/components/stage/ChoiceRow";
import StepPanel from "@/components/stage/StepPanel";
import TextAreaField from "@/components/stage/TextAreaField";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

import ConfirmButton from "../ConfirmButton";
import { Chip } from "./CaseListViews";
import styles from "./cases.module.css";

const SMALL_BUTTON = Object.freeze({ size: "sm", variant: "secondary" });
/* Pöördumatu teo nupp kannab märget, mille järgi fookuse viimine selle vahele jätab. */
const DANGER_BUTTON = Object.freeze({ ...SMALL_BUTTON, "data-danger": "true" });

/**
 * Pöördumatu tegu platvormi nupuga. Esimene vajutus ei tee midagi peale selle,
 * et nupp küsib kinnitust; loogika on failis ../ConfirmButton.jsx.
 */
function TwoStep({ t, label, confirmLabel, disabled, onConfirm }) {
  return (
    <ConfirmButton
      as={Button}
      buttonProps={DANGER_BUTTON}
      className={styles.danger}
      cancelClassName=""
      label={label}
      confirmLabel={confirmLabel}
      cancelLabel={t("casework.page.cancel", "")}
      disabled={disabled}
      onConfirm={onConfirm}
    />
  );
}

/**
 * Kui osa vahetab oma sisu (loend → vorm → loend), kaob vajutatud nupp ja
 * klaviatuuri fookus koos sellega. Fookus läheb uue sisu esimesele väljale või
 * nupule; kui seal midagi ei ole, siis osa pealkirjale. Pöördumatu teo nupule
 * (`data-danger`) fookust ei viida: all hoitud Enter jõuaks muidu vormi
 * „Loobu" nupult otse esimese rea „Eemalda" nupule.
 */
function useSwapFocus(mode) {
  const ref = useRef(null);
  const shown = useRef(mode);
  useEffect(() => {
    if (shown.current === mode) return;
    shown.current = mode;
    const node = ref.current;
    if (!node) return;
    /* Valikurühmas on tabulatsioonis üks lahter (valitud või esimene); teised
       jäävad vahele, muidu satuks fookus lahtrile, kuhu Tab ei vii. */
    const target =
      node.querySelector('textarea:not(:disabled), input:not(:disabled), button:not(:disabled):not([tabindex="-1"]):not([data-danger])') ||
      node.closest("section")?.querySelector("[data-step-heading]");
    target?.focus({ preventScroll: true });
  }, [mode]);
  return ref;
}

/** Avatud juhtumi päis: milline juhtum on lahti, mis seisus ta on ja tee tagasi loendisse. */
export function CaseHead({ t, name, state, tone, onBack }) {
  return (
    <header className={styles.head}>
      <h1 className={styles.caseName}>{name}</h1>
      {state ? <Chip tone={tone}>{state}</Chip> : null}
      <button type="button" className={styles.back} onClick={onBack}>
        {t("casework.page.back_to_list", "")}
      </button>
    </header>
  );
}

/** Põhiandmed: kliendi viide ja järgmine kontakt. `client.note` ütleb, miks viidet muuta ei saa. */
export function BasicsView({ t, formId, client, nextContact, onNextContact, disabled, onSubmit }) {
  return (
    <StepPanel
      title={t("casework.page.parts.basics.title", "")}
      actions={
        <Button type="submit" form={formId} size="sm" variant="primary" disabled={disabled}>
          {t("casework.page.save", "")}
        </Button>
      }
    >
      <div className={styles.stack}>
        <form id={formId} className={styles.fields} onSubmit={onSubmit}>
          {client.editable ? (
            <>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>{t("casework.page.client_display_name", "")}</span>
                <Input type="text" value={client.displayName} maxLength={120} disabled={disabled} onChange={client.onDisplayName} />
              </label>
              <label className={styles.field} data-size="sm">
                <span className={styles.fieldLabel}>{t("casework.page.client_external_ref", "")}</span>
                <Input type="text" value={client.externalRef} maxLength={120} disabled={disabled} onChange={client.onExternalRef} />
              </label>
            </>
          ) : null}
          <label className={styles.field} data-size="sm">
            <span className={styles.fieldLabel}>{t("casework.page.next_contact", "")}</span>
            <Input type="datetime-local" value={nextContact} disabled={disabled} onChange={onNextContact} />
          </label>
        </form>
        {client.note ? <p className={styles.quiet}>{client.note}</p> : null}
      </div>
    </StepPanel>
  );
}

/** STAR-i viide: süsteem valikuna (vaba tekstiväli tekitaks nimede sõnastiku) ja viitenumber. */
export function StarView({ t, formId, system, reference, onReference, disabled, onSubmit }) {
  return (
    <StepPanel
      title={t("casework.page.parts.star.title", "")}
      lead={t("casework.page.parts.star.lead", "")}
      actions={
        <Button type="submit" form={formId} size="sm" variant="primary" disabled={disabled}>
          {t("casework.page.save", "")}
        </Button>
      }
    >
      <form id={formId} className={styles.stack} onSubmit={onSubmit}>
        <ChoiceRow
          label={t("casework.page.star_system", "")}
          columns={system.options.length}
          options={system.options}
          value={system.value}
          onChange={system.onChange}
          disabled={disabled}
        />
        <label className={styles.field} data-size="sm">
          <span className={styles.fieldLabel}>{t("casework.page.star_reference", "")}</span>
          <Input type="text" value={reference} maxLength={120} disabled={disabled} onChange={onReference} />
        </label>
      </form>
    </StepPanel>
  );
}

/**
 * Seotud materjal: seoste loend või (pärast vajutust „Seo materjal") sidumise
 * vorm. Seose eemaldamine küsib teist vajutust.
 */
export function ItemsView({ t, adding, rows, more, disabled, link, onAdd, onCancel, onUnlink }) {
  const swapRef = useSwapFocus(adding);

  if (adding) {
    return (
      <StepPanel
        title={t("casework.page.parts.items.title", "")}
        lead={t("casework.page.items_hint", "")}
        actions={
          <>
            <Button type="button" size="sm" variant="secondary" onClick={onCancel}>
              {t("casework.page.cancel", "")}
            </Button>
            <Button type="submit" form={link.formId} size="sm" variant="primary" disabled={disabled || !link.targetId.trim()}>
              {t("casework.page.link_submit", "")}
            </Button>
          </>
        }
      >
        <form id={link.formId} className={styles.stack} onSubmit={link.onSubmit} ref={swapRef}>
          <ChoiceRow
            label={t("casework.page.item_type", "")}
            columns={link.types.length}
            options={link.types}
            value={link.type}
            onChange={link.onType}
            disabled={disabled}
          />
          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t("casework.page.item_target_id", "")}</span>
            <Input type="text" value={link.targetId} disabled={disabled} onChange={link.onTargetId} />
          </label>
        </form>
      </StepPanel>
    );
  }

  return (
    <StepPanel
      title={t("casework.page.parts.items.title", "")}
      lead={t("casework.page.items_hint", "")}
      actions={
        <Button type="button" size="sm" variant="primary" disabled={disabled} onClick={onAdd}>
          {t("casework.page.parts.items.add", "")}
        </Button>
      }
    >
      <div className={styles.stack} ref={swapRef}>
        {rows.length ? (
          <ul className={styles.rows}>
            {rows.map((row) => (
              <li className={styles.item} key={row.id}>
                <span className={styles.itemMain}>
                  <Chip>{row.type}</Chip>
                  <span className={styles.ref}>{row.ref}</span>
                  {row.meta ? <span className={styles.time}>{row.meta}</span> : null}
                </span>
                <span className={styles.buttons}>
                  <TwoStep
                    t={t}
                    label={t("casework.page.unlink", "")}
                    confirmLabel={t("casework.page.parts.items.confirm_unlink", "")}
                    disabled={disabled}
                    onConfirm={() => onUnlink(row.id)}
                  />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.quiet}>{t("casework.page.items_empty", "")}</p>
        )}
        {more ? (
          <Button type="button" size="sm" variant="secondary" className={styles.more} disabled={more.busy} onClick={more.onClick}>
            {t("casework.page.load_more", "")}
          </Button>
        ) : null}
      </div>
    </StepPanel>
  );
}

/**
 * Puuduv ja kontrollimist vajav info: punktide loend, avatud punkt või uue
 * punkti vorm (`mode`: `list`, `point`, `add`).
 *
 * Rida avab punkti. Seal on tekst tervikuna, seis kolme lahtrina ja
 * kustutamine, mis küsib teist vajutust. Seisu valik ei salvestu ise: lahtrid
 * on raadionupud ja klaviatuuril valib juba nool, seega kirjutab seisu alles
 * „Salvesta" (muidu läheks serverisse iga seis, millest nool üle käib).
 */
export function MissingView({ t, mode, rows, point, more, disabled, add, status, onAdd, onCancel, onOpen, onRemove }) {
  const swapRef = useSwapFocus(mode === "point" ? `point:${point?.id}` : mode);
  const title = t("casework.page.parts.missing.title", "");

  if (mode === "add") {
    return (
      <StepPanel
        title={title}
        actions={
          <>
            <Button type="button" size="sm" variant="secondary" onClick={onCancel}>
              {t("casework.page.cancel", "")}
            </Button>
            <Button type="submit" form={add.formId} size="sm" variant="primary" disabled={disabled || !add.text.trim() || !add.provenance}>
              {t("casework.page.missing_info_add", "")}
            </Button>
          </>
        }
      >
        <form id={add.formId} className={styles.stack} onSubmit={add.onSubmit} ref={swapRef}>
          <TextAreaField
            label={t("casework.page.missing_info_text", "")}
            value={add.text}
            onChange={add.onText}
            rows={3}
            maxLength={2000}
            disabled={disabled}
          />
          {/* PÄRITOLU ON KOHUSTUSLIK ja tuleb jagatud sõnastikust
              (`lib/workspaces/provenance.js`) — teist koopiat siia ei teki.
              Vaikimisi valikut ei ole: märgis, mille inimene ei valinud, ei ole märgis. */}
          <ChoiceRow
            label={t("casework.page.missing_info_provenance", "")}
            columns={4}
            options={add.provenances}
            value={add.provenance}
            onChange={add.onProvenance}
            disabled={disabled}
          />
        </form>
      </StepPanel>
    );
  }

  if (mode === "point" && point) {
    return (
      <StepPanel
        title={title}
        actions={
          <>
            <Button type="button" size="sm" variant="secondary" onClick={onCancel}>
              {t("casework.page.parts.missing.back", "")}
            </Button>
            <TwoStep
              t={t}
              label={t("casework.page.remove", "")}
              confirmLabel={t("casework.page.parts.missing.confirm_remove", "")}
              disabled={disabled}
              onConfirm={() => onRemove(point.id)}
            />
            <Button type="button" size="sm" variant="primary" disabled={disabled || !status.changed} onClick={status.onSave}>
              {t("casework.page.save", "")}
            </Button>
          </>
        }
      >
        <div className={styles.stack} ref={swapRef}>
          {/* Tekst on TEKST: sisu tuleb React'i lapsena, mitte HTML-ina. */}
          <p className={styles.pointText}>{point.text}</p>
          <p className={styles.line}>
            <span className={styles.lineLabel}>{t("casework.page.missing_info_provenance", "")}</span>
            <Chip>{point.provenance}</Chip>
          </p>
          <ChoiceRow
            label={t("casework.page.parts.missing.status_label", "")}
            columns={status.options.length}
            options={status.options}
            value={status.value}
            onChange={status.onChange}
            disabled={disabled}
          />
        </div>
      </StepPanel>
    );
  }

  return (
    <StepPanel
      title={title}
      actions={
        <Button type="button" size="sm" variant="primary" disabled={disabled} onClick={onAdd}>
          {t("casework.page.missing_info_add", "")}
        </Button>
      }
    >
      <div className={styles.stack} ref={swapRef}>
        {rows.length ? (
          <ul className={styles.rows}>
            {rows.map((row) => (
              <li className={styles.rowItem} key={row.id}>
                <button type="button" className={styles.row} onClick={() => onOpen(row.id)}>
                  <span className={styles.rowText}>{row.text}</span>
                  <span className={styles.rowMeta}>
                    <Chip tone={row.tone}>{row.statusText}</Chip>
                    <Chip>{row.provenance}</Chip>
                  </span>
                  <span className={styles.rowOpen} aria-hidden="true">
                    {t("casework.page.open", "")} ›
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.quiet}>{t("casework.page.missing_info_empty", "")}</p>
        )}
        {more ? (
          <Button type="button" size="sm" variant="secondary" className={styles.more} disabled={more.busy} onClick={more.onClick}>
            {t("casework.page.load_more", "")}
          </Button>
        ) : null}
      </div>
    </StepPanel>
  );
}

/**
 * Elutsükkel: seis, arhiveeritud juhtumi kustutuskell ja siire järgmisse seisu.
 * Siire on ühesuunaline, vajab põhjust ja küsib teist vajutust.
 */
export function RetentionView({ t, view, reason, onReason, busy, onTransition }) {
  const toArchive = view.next === "ARCHIVED";
  return (
    <StepPanel
      title={t("casework.page.parts.retention.title", "")}
      lead={t("casework.page.retention_hint", "")}
      actions={
        view.next ? (
          <TwoStep
            t={t}
            label={t(toArchive ? "casework.page.retention_to_archived" : "casework.page.retention_to_read_only", "")}
            confirmLabel={t(
              toArchive ? "casework.page.confirm_retention_to_archived" : "casework.page.parts.retention.confirm_read_only",
              ""
            )}
            disabled={busy || !reason.trim()}
            onConfirm={() => onTransition(view.next)}
          />
        ) : null
      }
    >
      <div className={styles.stack}>
        <p className={styles.line}>
          <span className={styles.lineLabel}>{t("casework.page.retention_state", "")}</span>
          <Chip tone={view.tone}>{view.stateText}</Chip>
        </p>
        {view.countdown ? <p className={styles.notice}>{view.countdown}</p> : null}
        {view.next ? (
          <label className={styles.field} data-size="lg">
            <span className={styles.fieldLabel}>{t("casework.page.retention_reason", "")}</span>
            <Input type="text" value={reason} maxLength={500} disabled={busy} onChange={onReason} />
          </label>
        ) : null}
        {view.warnClock ? (
          <p className={styles.notice} data-tone="risk" role="note">
            {t("casework.page.archive_clock_warning", "")}
          </p>
        ) : null}
      </div>
    </StepPanel>
  );
}

/** Töömaterjali arhiveerimine: juhtum jääb tööle, kustub kandmata mustandite ja ettevalmistuste sisu. */
export function MaterialView({ t, busy, onArchive }) {
  return (
    <StepPanel
      title={t("casework.page.parts.material.title", "")}
      lead={t("casework.page.working_material_hint", "")}
      actions={
        <TwoStep
          t={t}
          label={t("casework.page.archive_working_material", "")}
          confirmLabel={t("casework.page.confirm_archive_working_material", "")}
          disabled={busy}
          onConfirm={onArchive}
        />
      }
    />
  );
}

/** Kliendiviide: jäädav kustutamine, lubatud igas seisus. */
export function ClientView({ t, erased, busy, onErase }) {
  return (
    <StepPanel
      title={t("casework.page.parts.client.title", "")}
      lead={t("casework.page.erase_hint", "")}
      actions={
        erased ? null : (
          <TwoStep
            t={t}
            label={t("casework.page.erase_client_reference", "")}
            confirmLabel={t("casework.page.confirm_erase_client_reference", "")}
            disabled={busy}
            onConfirm={onErase}
          />
        )
      }
    >
      {erased ? <p className={styles.notice}>{t("casework.page.erased", "")}</p> : null}
    </StepPanel>
  );
}
