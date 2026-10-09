"use client";

/**
 * Supervisiooni kahe värava vaated: jagamise eelvaade (lävi) ja sulgemise eelvaade.
 *
 * MIKS. Mõlemad lehed olid klaaskast klaaspaneeli sees, korratud pealkirjaga ja
 * kõik korraga ühes veerus: jagamisel rippvalik, manifest ja nupud; sulgemisel
 * kaks kasti, takistuse kast, väli ja nupud. Nüüd on kumbki väikeste vaadete
 * jada sammulaval (`components/stage`): need ON sammud, sest inimene loeb enne
 * läbi, mis juhtub, ja kinnitab lõpus.
 *
 * Jagamine (Q2.6 vaade 5, kaheastmeline TEADLIK värav):
 *  - `ShareContentView`   mis läheb: TÄPSELT see pealkiri ja sisu, mis serverisse saadetakse
 *  - `ShareAudienceView`  kellele: kaks lahtrit ja nimeliselt need, kes pärast näevad
 *  - `ShareConfirmView`   kokkuvõte ja „Jagan teadlikult", mis küsib teist vajutust
 *
 * Sulgemine (Q2.6 vaade 9, PÖÖRDUMATU):
 *  - `CloseEffectView`    LOEND, mitte lause: kaks selgelt eristatud tulpa „Kustub" ja „Jääb"
 *  - `CloseTitleView`     üldistatud pealkiri, mis asendab praeguse
 *  - `CloseConfirmView`   „Sulgen protsessi lõplikult", mis küsib teist vajutust;
 *                         tagajärg seisab nupu kõrval
 *
 * Privaatsusmärk on püsielement: jagamise vaated ütlevad, kes teemat näevad.
 *
 * Siin on ainult kuju. Olek ja päringud on lehtedel (`../SupervisionSharePage.jsx`,
 * `../SupervisionClosePage.jsx`); read ja reeglid teeb `./processRows.js`.
 *
 * Kujundus: process.module.css (siin kõrval).
 */

import { useId } from "react";

import ChoiceRow from "@/components/stage/ChoiceRow";
import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

import PrivacyBadge from "../PrivacyBadge";
import { Chip } from "../entry/EntryBits";
import { Facts, Field, TwoPress, describedBy, useTwoPress } from "./ProcessBits";
import styles from "./process.module.css";
import { CLOSE_TITLE_MAX } from "./processRows";

/** Kes näevad: privaatsusmärk ja nimed. Nimi on märk, mitte komadega rida (nimes võib olla koma). */
function Audience({ t, privacy, names }) {
  return (
    <>
      <p className={styles.line}>
        <PrivacyBadge scope={privacy.scope} count={privacy.count} />
      </p>
      <p className={styles.line}>
        <span className={styles.time}>{t("supervision.share.willSee")}</span>
        {names.length ? (
          names.map((name, index) => <Chip key={`${index}:${name}`}>{name}</Chip>)
        ) : (
          <span className={styles.time}>{t("supervision.share.noNames")}</span>
        )}
      </p>
    </>
  );
}

/**
 * Mis läheb. Pealkiri ja sisu on täpselt need väärtused, mis päringusse lähevad;
 * `derived` ütleb, et pealkiri on võetud sisu algusest (kirjel pealkirja ei ole).
 */
export function ShareContentView({ t, title, body, derived }) {
  return (
    <StepPanel title={t("supervision.share.views.content.title")} lead={t("supervision.share.views.content.lead")}>
      <div className={styles.stack}>
        <Facts
          facts={[
            { key: "title", label: t("supervision.share.titleLabel"), value: title, long: true },
            { key: "body", label: t("supervision.eeskamber.bodyLabel"), value: body, long: true }
          ]}
        />
        {derived ? <p className={styles.quiet}>{t("supervision.share.derivedTitle")}</p> : null}
      </div>
    </StepPanel>
  );
}

/** Kellele. Küsimus on paneeli ülaservas, lahtrid selle all; nimed muutuvad valikuga kaasa. */
export function ShareAudienceView({ t, options, value, onChange, privacy, names }) {
  const question = t("supervision.share.views.audience.question");
  return (
    <StepPanel title={t("supervision.share.views.audience.title")} question={question}>
      <div className={styles.stack}>
        <ChoiceRow label={question} labelHidden columns={options.length} options={options} value={value} onChange={onChange} />
        <Audience t={t} privacy={privacy} names={names} />
      </div>
    </StepPanel>
  );
}

/**
 * Kinnitus. „Jagan teadlikult" on värava teine aste: esimene vajutus küsib
 * kinnitust, teine jagab. `facts`: pealkiri ja sihtrühm sõnadega.
 */
export function ShareConfirmView({ t, glow, facts, privacy, names, note, busy, onShare, onBack }) {
  const press = useTwoPress();
  return (
    <StepPanel
      title={t("supervision.share.views.confirm.title")}
      lead={t("supervision.share.views.confirm.lead")}
      note={press.note || note}
      actions={
        <>
          <Button type="button" size="sm" variant="secondary" onClick={onBack}>
            {t("supervision.share.back")}
          </Button>
          <TwoPress
            press={press}
            name="share"
            variant="primary"
            glow={glow}
            label={t("supervision.share.confirm")}
            confirmLabel={t("supervision.share.confirmAgain")}
            cancelLabel={t("supervision.common.cancel")}
            consequence={t("supervision.share.confirmConsequence")}
            disabled={busy}
            busyLabel={t("supervision.process.busy.sharing")}
            onConfirm={onShare}
          />
        </>
      }
    >
      <div className={styles.stack}>
        <Facts facts={facts} />
        <Audience t={t} privacy={privacy} names={names} />
      </div>
    </StepPanel>
  );
}

/**
 * Mis kustub ja mis jääb. `effect`: `{ deleted, kept }` (`closeEffect`).
 * `actions`: tee tagasi, kui vaade seisab üksi (vaataja ei saa sulgeda).
 */
export function CloseEffectView({ t, effect, actions }) {
  const column = (kind, heading, rows) => (
    <div className={styles.column} data-kind={kind}>
      <h2 className={styles.columnTitle}>{heading}</h2>
      <ul className={styles.lines}>
        {rows.map((row) => (
          <li key={row.key} className={styles.lineItem}>
            {row.text}
          </li>
        ))}
      </ul>
    </div>
  );
  return (
    <StepPanel title={t("supervision.close.views.effect.title")} lead={t("supervision.close.intro")} actions={actions}>
      <div className={styles.columns}>
        {column("deleted", t("supervision.close.willDelete"), effect.deleted)}
        {column("kept", t("supervision.close.willKeep"), effect.kept)}
      </div>
    </StepPanel>
  );
}

/**
 * Üldistatud pealkiri. Enter väljal viib järgmise sammu juurde: ühe väljaga
 * vorm ilma saatmisnuputa ei saada end ise.
 */
export function CloseTitleView({ t, value, onChange, error, currentTitle, onEnter }) {
  const id = useId();
  const hint = t("supervision.close.titleHint");
  return (
    /* Vaate nimi on kiirmenüüs; paneel algab küsimusega ja välja silt jääb
       ekraanilugejale (muidu kordaks väli vaate nime). */
    <StepPanel title={t("supervision.close.views.title.title")} question={t("supervision.close.titleQuestion")}>
      <form
        className={styles.fields}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          onEnter();
        }}
      >
        <Field id={`${id}-title`} label={t("supervision.close.titleField")} labelHidden hint={hint} error={error}>
          <Input
            id={`${id}-title`}
            className={styles.input}
            type="text"
            value={value}
            maxLength={CLOSE_TITLE_MAX}
            invalid={Boolean(error)}
            describedBy={describedBy(`${id}-title`, { hint, error })}
            onChange={(event) => onChange(event.target.value)}
          />
        </Field>
        {currentTitle ? <p className={styles.quiet}>{t("supervision.close.currentTitle", { title: currentTitle })}</p> : null}
      </form>
    </StepPanel>
  );
}

/**
 * Sulgemine. Tagasivõtmatu: nupp küsib teist vajutust ja tagajärg seisab nupu
 * kõrval tegevusreal; sama lause on vaate alguses juba enne esimest vajutust.
 */
export function CloseConfirmView({ t, facts, note, busy, onClose, onBack }) {
  const press = useTwoPress();
  return (
    <StepPanel
      title={t("supervision.close.views.close.title")}
      lead={t("supervision.close.views.close.lead")}
      note={press.note || note}
      actions={
        <>
          <Button type="button" size="sm" variant="secondary" onClick={onBack}>
            {t("supervision.close.toProcess")}
          </Button>
          <TwoPress
            press={press}
            name="close"
            label={t("supervision.close.confirm")}
            confirmLabel={t("supervision.close.confirmAgain")}
            cancelLabel={t("supervision.common.cancel")}
            consequence={t("supervision.close.consequence")}
            disabled={busy}
            busyLabel={t("supervision.process.busy.closing")}
            onConfirm={onClose}
          />
        </>
      }
    >
      <Facts facts={facts} />
    </StepPanel>
  );
}
