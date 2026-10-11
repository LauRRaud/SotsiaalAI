"use client";

/**
 * Teenuseprofiili vaadete ühised tükid: üherealine väli, tekstiväli, märgitav
 * valikurühm, piirkonna valik registrist, märk, teade, loendirida ja paneeli
 * alumise serva olekurida.
 *
 * MÄRKIDE LOENDUR on vaikne rida kohe oma välja all (kujundusaudit K08: vanal
 * lehel seisis „12 / 1000" järgmise välja sildi küljes ja luges nagu selle
 * osa). Väljade vahe on loenduri ja järgmise sildi vahel selgelt suurem kui
 * välja ja tema loenduri vahel.
 *
 * Siin ei ole olekut ega päringuid: kõik tuleb lehelt
 * (`ServiceProfileSurface` failis ../WorkspaceFeaturePage.jsx).
 *
 * Kujundus: profile.module.css (siin kõrval); ehitusklotsid kaustast components/stage.
 */

import { useId } from "react";

import ChoiceChips from "@/components/stage/ChoiceChips";
import TextAreaField from "@/components/stage/TextAreaField";
import Dropdown from "@/components/ui/Dropdown";
import Input from "@/components/ui/Input";
import { SERVICE_PROFILE_LIMITS } from "@/lib/serviceProviderProfileLimits";

import { countyChoice, municipalityChoice, optionsWithSelected, splitList, toggleListValue } from "./profileModel";
import styles from "./profile.module.css";

const lengthOf = (value) => (typeof value === "string" ? value.length : 0);

/** Märkide loendur: vaikne rida välja all. */
function Counter({ id, value, max }) {
  return (
    <span className={styles.counter} id={id}>
      {lengthOf(value)} / {max}
    </span>
  );
}

/** Üherealine väli sildi, vihje ja loenduriga. `size` ütleb, kui lai sisu on (sm, lg). */
export function LineField({ label, hint, value, onChange, size, type, maxLength = SERVICE_PROFILE_LIMITS.shortText, placeholder, autoComplete, onFocus }) {
  const id = useId();
  return (
    <div className={styles.field} data-size={size}>
      <label className={styles.fieldLabel} htmlFor={id}>
        {label}
      </label>
      <Input
        id={id}
        type={type}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        autoComplete={autoComplete}
        describedBy={hint ? `${id}-hint ${id}-count` : `${id}-count`}
        onFocus={onFocus}
        onChange={(event) => onChange?.(event.target.value)}
      />
      <Counter id={`${id}-count`} value={value} max={maxLength} />
      {hint ? (
        <span className={styles.fieldHint} id={`${id}-hint`}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

/** Mitmerealine tekst loenduriga (väli ise on `TextAreaField`). */
export function TextField({ label, hint, value, onChange, rows = 3, maxLength = SERVICE_PROFILE_LIMITS.text }) {
  return (
    <div className={styles.counted}>
      <TextAreaField label={label} hint={hint} value={value} rows={rows} maxLength={maxLength} onChange={onChange} />
      <Counter value={value} max={maxLength} />
    </div>
  );
}

/**
 * Mitu valikut korraga. Vormis on väärtus komadega tekst (nii nagu see serverist
 * tuli); lahtrid on ühelaiused ja märgitud lahter on kohe näha, seepärast ei
 * ole all enam eraldi rida „Valitud: …".
 */
export function ChipsField({ label, hint, value, options, onChange, labelHidden = false }) {
  return (
    <ChoiceChips
      label={label}
      labelHidden={labelHidden}
      hint={hint}
      options={optionsWithSelected(options, value)}
      values={splitList(value)}
      onToggle={(option) => onChange(toggleListValue(value, option))}
    />
  );
}

/**
 * Üks valik pikast loendist: platvormi rippvalik sildiga. Lehe muud valikud on
 * kohe näha lahtrid (`ChoiceRow`, kuni kuus varianti); rippvalik on ainult
 * registri jaoks, kus variante on 15 (maakonnad) või 78 (omavalitsused).
 */
function SelectField({ label, hint, value, options, onChange, size, placeholder, disabled }) {
  const id = useId();
  return (
    <div className={styles.field} data-size={size}>
      <label className={styles.fieldLabel} htmlFor={id}>
        {label}
      </label>
      <Dropdown
        id={id}
        value={value}
        options={options}
        placeholder={placeholder}
        ariaLabel={label}
        disabled={disabled}
        describedBy={hint ? `${id}-hint` : undefined}
        onChange={onChange}
      />
      {hint ? (
        <span className={styles.fieldHint} id={`${id}-hint`}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Piirkond registrist: maakond (üks) ja omavalitsused (mitu). Omavalitsus
 * lisatakse rippvalikust ja valitud seisavad all märgitud lahtritena; vajutus
 * lahtrile võtab selle maha. Nii mahub 78 omavalitsuse valik ühte vaatesse.
 *
 * Varem käsitsi kirjutatud sõna, mida register ei tunne, on samuti lahter ja
 * teade ütleb, et see ei kata ühtki kohta (reeglid: profileModel.js).
 * `children`: väljad, mis seisavad valikutega samas reas.
 * `inheritedCounty`: profiili maakond teenuse vaates. Teenuse tühi maakond
 * tähendab siis „sama mis profiilil" (lugeja võtab profiili oma), mitte
 * „täpsustamata".
 */
export function AreaFields({ tp, area, county, municipalities, inheritedCounty = "", onCounty, onMunicipalities, children }) {
  /* Teenuse tühi maakond tähendab „sama mis profiilil": valik ütleb seda ja vihje nimetab maakonna. */
  const inherited = countyChoice(inheritedCounty, area, "").value;
  const countyPick = countyChoice(county, area, inherited ? tp("area.county_inherited", "Sama mis profiilil") : tp("area.county_none", "Täpsustamata"));
  const pick = municipalityChoice(municipalities, area);
  /* Üks teade mõlema kohta: kaks kasti üksteise all teeksid vaate asjatult pikaks. */
  const warnings = [
    pick.unread.length
      ? tp("area.unread_municipalities", "Need nimed ei ole loendist valitud: {names}. Võta need maha ja vali loendist õige omavalitsus.", { names: pick.unread.join(", ") })
      : "",
    countyPick.unread ? tp("area.unread_county", "Maakond „{name}” ei ole loendist valitud. Vali maakond loendist.", { name: countyPick.value }) : ""
  ].filter(Boolean);
  return (
    <div className={styles.stack}>
      <div className={styles.fields}>
        {children}
        <SelectField
          size={inherited ? "md" : "sm"}
          label={tp("fields.county", "Maakond")}
          hint={inherited && !countyPick.value ? tp("area.county_inherited_hint", "Profiili maakond: {county}", { county: inherited }) : ""}
          value={countyPick.value}
          options={countyPick.options}
          onChange={onCounty}
        />
        <SelectField
          size="md"
          label={tp("area.municipalities", "Omavalitsused")}
          hint={pick.full ? tp("area.limit", "Valida saab kuni {max} omavalitsust.", { max: SERVICE_PROFILE_LIMITS.listItems }) : ""}
          value=""
          options={pick.options}
          placeholder={tp("area.add_municipality", "Lisa omavalitsus")}
          disabled={pick.full}
          onChange={(name) => onMunicipalities(toggleListValue(municipalities, name))}
        />
      </div>
      {pick.selected.length ? (
        <ChipsField label={tp("area.chosen", "Valitud omavalitsused")} labelHidden value={municipalities} options={[]} onChange={onMunicipalities} />
      ) : null}
      {warnings.length ? <Notice tone="wait">{warnings.join(" ")}</Notice> : null}
    </div>
  );
}

/** Seisu märk loendireal. */
export function Chip({ tone, children }) {
  return (
    <span className={styles.chip} data-tone={tone}>
      {children}
    </span>
  );
}

/** Teade vaate sees. `aria-live`, mitte status-roll: ühine lehekiht joonistab iga status-rolliga elemendi kastina. */
export function Notice({ tone, alert = false, children }) {
  if (!children) return null;
  return (
    <p className={styles.notice} data-tone={tone} role={alert ? "alert" : undefined} aria-live={alert ? undefined : "polite"}>
      {children}
    </p>
  );
}

/** Loendirida: pealkiri, märgid ja tee edasi. Terve rida on üks vajutatav lahter. */
export function ItemRow({ title, meta, chips = [], openText, onOpen }) {
  return (
    <li className={styles.item}>
      <button type="button" className={styles.row} onClick={onOpen}>
        <span className={styles.rowText}>
          <span className={styles.rowTitle}>{title}</span>
          {meta ? <span className={styles.rowMeta}>{meta}</span> : null}
        </span>
        <span className={styles.rowChips}>
          {chips.map((chip) => (
            <Chip key={chip.key} tone={chip.tone}>
              {chip.text}
            </Chip>
          ))}
        </span>
        <span className={styles.rowOpen} aria-hidden="true">
          {openText} ›
        </span>
      </button>
    </li>
  );
}

/**
 * Paneeli alumise serva olekurida (`StepPanel note`): kus ma olen (avatud
 * teenuse või koha nimi ja tee tagasi loendisse), mis seisus on salvestamine ja
 * vajadusel tee vaatesse, kus puuduv asi parandada.
 */
export function footNote({ crumb, text, go }) {
  if (!crumb && !text && !go) return "";
  return (
    <span className={styles.footNote}>
      {crumb ? (
        <>
          <button type="button" className={styles.textButton} aria-label={crumb.backLabel} onClick={crumb.onBack}>
            ‹ {crumb.list}
          </button>
          <span className={styles.crumbName}>{crumb.name}</span>
        </>
      ) : null}
      {text ? <span>{text}</span> : null}
      {go ? (
        <button type="button" className={styles.textButton} onClick={go.onClick}>
          {go.label} ›
        </button>
      ) : null}
    </span>
  );
}
