"use client";

/**
 * Organisatsiooni teenuseprofiili osa vaated.
 *
 * MIKS. Leht oli vorm nelja täislaia välja ja tekstikastiga, selle all toimetajate
 * sildid; profiilita organisatsioonil üks kast üleandmise märkeruuduga. Nüüd on
 * korraga ees üks asi, valik lahtritest üleval:
 *  - `DataView`     kontaktandmed: nimi, telefon, e-post, veeb
 *  - `TextView`     lühikirjeldus
 *  - `EditorsView`  toimetajad nimedega (jagatud kontot ei looda)
 *  - `NoProfileView` profiili ei ole; oma profiili üleandmine eraldi kinnitusega
 *
 * Andmed ja kirjeldus on ÜKS kirje ja üks salvestus: kummagi vaate nupp
 * salvestab kogu vormi, nii et teises vaates tehtud muudatus ei lähe kaotsi.
 *
 * Siin on ainult kuju. Otsused on failis ./profileRules.js; olek ja päringud lehel
 * (`../OrgProfileClient.jsx`).
 */

import CheckCard from "@/components/stage/CheckCard";
import ChoiceRow from "@/components/stage/ChoiceRow";
import StepPanel from "@/components/stage/StepPanel";
import TextAreaField from "@/components/stage/TextAreaField";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

import { Facts, footNote, ignoreKeyRepeat } from "../OrgBits";
import shared from "../org.module.css";

/** Vaadete valik: ühelaiused lahtrid paneeli ülaservas. */
function Tabs({ t, tabs, tab, onTab }) {
  return (
    <ChoiceRow
      label={t("org.profile.tabs.label")}
      labelHidden
      options={tabs.map((key) => ({ value: key, label: t(`org.profile.tabs.${key}`) }))}
      value={tab}
      onChange={onTab}
      columns={tabs.length}
      keepColumns
    />
  );
}

/** Salvestamise nupp; kirjutuskaitstud organisatsioonis seda ei ole. */
function SaveButton({ t, save, glow }) {
  if (!save) return null;
  return (
    <Button type="button" size="sm" variant="primary" glow={glow} data-save="1" aria-busy={save.busy ? "true" : undefined} onKeyDown={ignoreKeyRepeat} onClick={save.onSave}>
      {save.busy ? t("org.profile.saving") : t("org.profile.save")}
    </Button>
  );
}

/** Kontaktandmed. `save`: { busy, onSave } või null; `dirty`: kas midagi on salvestamata. */
export function DataView({ t, tabs, tab, onTab, form, onField, readOnly, dirty, notice, save, glow = true }) {
  const field = (key, label, size, type = "text") => (
    <label className={shared.line} data-size={size}>
      <span className={shared.fieldLabel}>{label}</span>
      <Input type={type} className={shared.input} value={form[key]} readOnly={readOnly} autoComplete="off" onChange={(event) => onField(key, event.target.value)} />
    </label>
  );
  return (
    <StepPanel title={t("org.profile.heading")} note={footNote(notice, readOnly ? t("org.profile.read_only") : dirty ? t("org.profile.unsaved") : "")} actions={<SaveButton t={t} save={save} glow={glow} />}>
      <div className={shared.stack} aria-busy={save?.busy ? "true" : undefined}>
        <Tabs t={t} tabs={tabs} tab={tab} onTab={onTab} />
        {field("organizationName", t("org.create.displayName"))}
        <div className={shared.pair}>
          {field("phone", t("org.profile.phone"), "sm", "tel")}
          {field("email", t("org.profile.email"), undefined, "email")}
        </div>
        {field("website", t("org.profile.website"))}
      </div>
    </StepPanel>
  );
}

/** Lühikirjeldus: pikk tekst, täislai väli. */
export function TextView({ t, tabs, tab, onTab, form, onField, readOnly, dirty, notice, save, glow = true }) {
  return (
    <StepPanel title={t("org.profile.heading")} note={footNote(notice, readOnly ? t("org.profile.read_only") : dirty ? t("org.profile.unsaved") : "")} actions={<SaveButton t={t} save={save} glow={glow} />}>
      <div className={shared.stack} aria-busy={save?.busy ? "true" : undefined}>
        <Tabs t={t} tabs={tabs} tab={tab} onTab={onTab} />
        <TextAreaField label={t("org.profile.shortDescription")} value={form.shortDescription} onChange={(value) => onField("shortDescription", value)} rows={6} disabled={readOnly} />
      </div>
    </StepPanel>
  );
}

/** Toimetajad nimedega: iga toimetaja on inimene, kelle auditijälg on eraldi. */
export function EditorsView({ t, tabs, tab, onTab, editors }) {
  return (
    <StepPanel title={t("org.profile.editors")} note={t("org.profile.intro")}>
      <div className={shared.stack}>
        <Tabs t={t} tabs={tabs} tab={tab} onTab={onTab} />
        {editors.length ? (
          <ul className={shared.lines} aria-label={t("org.profile.editors")}>
            {editors.map((editor) => (
              <li key={editor.id} className={shared.lineItem}>
                {editor.name}
              </li>
            ))}
          </ul>
        ) : (
          <p className={shared.quiet}>{t("org.profile.noEditors")}</p>
        )}
      </div>
    </StepPanel>
  );
}

/**
 * Profiili ei ole. Kui vaatajal on oma profiil, saab ta selle organisatsioonile
 * üle anda: vaade ütleb, MIS profiil see on, ja üleandmine nõuab eraldi kinnitust.
 *
 * `convert`: { subject, confirmed, onConfirm, busy, onConvert } või null
 */
export function NoProfileView({ t, convert, notice, glow = true }) {
  if (!convert) return <StepPanel title={t("org.profile.heading")} lead={t("org.profile.noProfile")} note={footNote(notice, t("org.profile.intro"))} />;
  return (
    <StepPanel
      title={t("org.profile.heading")}
      lead={t("org.profile.noProfile")}
      note={footNote(notice, t("org.profile.convert_note"))}
      actions={
        <Button type="button" size="sm" variant="primary" glow={glow} data-convert="1" aria-busy={convert.busy ? "true" : undefined} onKeyDown={ignoreKeyRepeat} onClick={convert.onConvert}>
          {convert.busy ? t("org.profile.converting") : t("org.profile.convert")}
        </Button>
      }
    >
      <div className={shared.stack} aria-busy={convert.busy ? "true" : undefined}>
        <Facts rows={[{ key: "subject", label: t("org.profile.convertSubject"), value: convert.subject }]} />
        <p className={shared.quiet}>{t("org.profile.convertHint")}</p>
        <CheckCard title={t("org.profile.convertConfirm")} checked={convert.confirmed} onChange={convert.onConfirm} />
      </div>
    </StepPanel>
  );
}
