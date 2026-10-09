"use client";

/**
 * Juhtumi sektsioonide (kohtumise ettevalmistus, märge, STAR2 järjekord)
 * ühised tükid: loendi vaade, kohtumise aja vorm, avatud kirje vaate raam
 * (päis, sakid, sisu), uue rea vorm, päritolu kinnitamine, kaheastmeline nupp
 * ja fookuse reegel.
 *
 * MIKS ÜHISED. Kolm sektsiooni on sama kujuga: loend, loendist avatud kirje ja
 * selle sees väikesed vaated, mis vahetuvad kohapeal. Kui iga sektsioon
 * joonistaks loendi ja sakid ise, läheksid need esimese parandusega lahku.
 *
 * SAKID, MITTE UUED LAUA OSAD. Avatud ettevalmistus, märge ja element ei ole
 * juhtumi osad (neid on juhtumil mitu ja need avanevad loendist), seega ei saa
 * nende vaated olla juhtumi laval. Vaated vahetuvad osa sees ja sakid on
 * ühelaiused lahtrid, nagu välitöö külastuse lehel
 * (`components/field/visit/VisitViews.jsx`).
 *
 * Siin on ainult kuju. Read ja reeglid on failis ./sectionRows.js, andmed ja
 * päringud sektsioonide failides (`../MeetingPrepSection.jsx` jt).
 *
 * Kujundus: sections.module.css (siin kõrval) ja juhtumi lehe ühised read
 * (`../cases/cases.module.css`).
 */

import { useEffect, useRef } from "react";

import ChoiceRow from "@/components/stage/ChoiceRow";
import StepPanel from "@/components/stage/StepPanel";
import TextAreaField from "@/components/stage/TextAreaField";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

import ConfirmButton from "../ConfirmButton";
import { Chip, Notice } from "../cases/CaseListViews";
import base from "../cases/cases.module.css";
import styles from "./sections.module.css";

const SMALL_BUTTON = Object.freeze({ size: "sm", variant: "secondary" });
/* Pöördumatu teo nupp kannab märget: fookuse reegel ei vii fookust kunagi selle peale. */
const DANGER_BUTTON = Object.freeze({ ...SMALL_BUTTON, "data-danger": "true" });

/**
 * Pöördumatu tegu platvormi nupuga. Esimene vajutus ainult küsib kinnitust;
 * loogika (klahvikordus, topeltklõps, keelatud nupp nullib küsimuse) on failis
 * ../ConfirmButton.jsx.
 *
 * `plain`: tegu on pöördumatu, aga ei kustuta midagi („Märgi üle kantuks"):
 * teine vajutus jääb, hoiatav toon mitte.
 */
export function TwoStep({ t, label, confirmLabel, disabled, onConfirm, plain = false }) {
  return (
    <ConfirmButton
      as={Button}
      buttonProps={DANGER_BUTTON}
      className={plain ? "" : base.danger}
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
 * Kui osa vahetab oma sisu (loend → vorm → loend, loend → avatud kirje), kaob
 * vajutatud nupp ja klaviatuuri fookus koos sellega. Fookus läheb siis väljale,
 * mille vaade on selleks märkinud (`data-autofocus`: vormi esimene väli), ja
 * kui seda ei ole, siis vaate pealkirjale.
 *
 * NUPULE FOOKUST EI VIIDA. All hoitud Enter (klahvikordus) vajutaks seda kohe:
 * „Ava" viiks otse „Tagasi" peale ja tagasi, või hullem, pöördumatu teo nupule.
 *
 * `onMount`: vaade ise ilmus vajutuse peale (loendist avati kirje), seega
 * liigub fookus juba esimesel joonistusel. Saki vahetus võtmesse ei kuulu:
 * sakirida jääb paigale (vt `OpenView`) ja fookus jääb vajutatud sakile.
 */
export function useSwapFocus(key, { onMount = false } = {}) {
  const ref = useRef(null);
  const shown = useRef(onMount ? null : key);
  useEffect(() => {
    if (shown.current === key) return;
    shown.current = key;
    const node = ref.current;
    if (!node) return;
    const target =
      node.querySelector("[data-autofocus] textarea:not(:disabled), [data-autofocus] input:not(:disabled)") ||
      node.closest("section")?.querySelector("[data-step-heading]");
    target?.focus({ preventScroll: true });
  }, [key]);
  return ref;
}

/**
 * Vorm, mille tühjalt saatmine on lubatud (kohtumise aeg võib puududa), ei
 * tohi minna teele all hoitud Enteri peale: klahvikordus jõuab väljale kohe,
 * kui fookus sinna viiakse.
 */
export function blockRepeatEnter(event) {
  if (event.repeat && event.key === "Enter") event.preventDefault();
}

/**
 * Sektsiooni loend: read, mis avavad kirje, ja all servas üks tegevus (uus
 * kirje). Rida on nii madal kui võimalik: nimi, märgid ja tee edasi. Kõik muu
 * on avatud kirje vaadetes. Loend võib olla pikk: siis kerib kogu paneel,
 * mitte kast paneeli sees.
 *
 * `rows`: [{ id, title, chips: [{ key, text, tone }] }]. `openingId`: rida, mille
 * kirjet parajasti laaditakse. Aeglase võrguga peab vajutusel olema nähtav
 * tagajärg; muidu vajutab inimene uuesti.
 */
export function ItemListView({ t, title, lead, swapRef, errorText, status, rows, emptyText, openText, openingId = null, more, onOpen, onRetry, actions }) {
  return (
    <StepPanel title={title} lead={lead} actions={actions}>
      <div className={base.stack} ref={swapRef}>
        <Notice text={errorText} tone="risk" />

        {status === "loading" && !rows.length ? <p className={base.quiet}>{t("casework.page.loading", "")}</p> : null}

        {/* „Ridu ei ole" öeldakse ainult siis, kui loend päriselt laaditi:
            ebaõnnestunud laadimise järel oleks see väljamõeldud vastus. */}
        {status === "ready" && !rows.length ? <p className={base.quiet}>{emptyText}</p> : null}

        {rows.length ? (
          <ul className={base.rows}>
            {rows.map((row) => (
              <li className={base.rowItem} key={row.id}>
                <button type="button" className={base.row} aria-busy={row.id === openingId ? "true" : undefined} onClick={() => onOpen(row.id)}>
                  <span className={base.rowTitle}>{row.title}</span>
                  <span className={base.rowMeta}>
                    {row.chips.map((chip) => (
                      <Chip key={chip.key} tone={chip.tone}>
                        {chip.text}
                      </Chip>
                    ))}
                  </span>
                  {row.id === openingId ? (
                    <span className={base.rowOpen} aria-live="polite">
                      {t("casework.page.loading", "")}
                    </span>
                  ) : (
                    <span className={base.rowOpen} aria-hidden="true">
                      {openText} ›
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {status === "error" && !rows.length ? (
          <Button type="button" size="sm" variant="secondary" className={base.more} onClick={onRetry}>
            {t("casework.page.retry", "")}
          </Button>
        ) : null}

        {/* Nupp on laadimise ajal KEELATUD: kiire topeltvajutus saadaks kaks
            sama kursoriga päringut ja lisaks samad read kaks korda. */}
        {more ? (
          <Button type="button" size="sm" variant="secondary" className={base.more} disabled={more.busy} onClick={more.onClick}>
            {more.label}
          </Button>
        ) : null}
      </div>
    </StepPanel>
  );
}

/**
 * Uue ettevalmistuse või märkme alustamine: ainus küsimus on kohtumise aeg ja
 * selle võib tühjaks jätta. Nupp on paneeli all servas, aga kuulub vormi
 * juurde (`form`): nii alustab ka Enter väljal.
 */
export function MeetingCreateView({ t, title, lead, swapRef, formId, label, value, onChange, submitLabel, glow, busy, errorText, onSubmit, onCancel }) {
  return (
    <StepPanel
      title={title}
      lead={lead}
      actions={
        <>
          <Button type="button" size="sm" variant="secondary" onClick={onCancel}>
            {t("casework.page.cancel", "")}
          </Button>
          <Button type="submit" form={formId} size="sm" variant="primary" glow={glow} disabled={busy}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <div className={base.stack} ref={swapRef}>
        <form id={formId} className={base.fields} onSubmit={onSubmit} onKeyDown={blockRepeatEnter}>
          <label className={base.field} data-size="sm" data-autofocus>
            <span className={base.fieldLabel}>{label}</span>
            <Input type="datetime-local" value={value} onChange={(event) => onChange(event.target.value)} />
          </label>
        </form>
        <Notice text={errorText} tone="risk" />
      </div>
    </StepPanel>
  );
}

/**
 * Avatud kirje päis: MILLINE ettevalmistus, märge või element on lahti.
 *
 * AVATUD KIRJE IDENTITEET ON NÄHTAV igas vaates. Juhtumil on neid mitu, ja
 * ilma selleta ei ütle ükski asi ekraanil, MILLISE kohtumise alla parasjagu
 * kirjutatakse.
 */
export function OpenHead({ label, name, chips = null, back }) {
  return (
    <div className={styles.openHead}>
      <p className={styles.openName}>
        <span className={styles.openLabel}>{label}</span> {name}
      </p>
      {chips}
      {back ? (
        <button type="button" className={base.back} onClick={back.onClick}>
          {back.label}
        </button>
      ) : null}
    </div>
  );
}

/**
 * Avatud kirje vaadete sakid: ühelaiused lahtrid, kõik kohe näha. See on sama
 * osa sisu vahetamine, seepärast rühm, mitte navigatsioon.
 *
 * `tabs`: [{ key, label, count?, state?, pending? }]. `count` on sakis oleva
 * loendi pikkus, `state: "empty"` tuhmistab täitmata välja saki ja `pending`
 * paneb märgi, kui sakis ootab midagi inimese kinnitust (`pendingText` ütleb
 * seda ekraanilugejale).
 */
export function ViewTabs({ label, tabs, current, onSelect, columns, pendingText = "" }) {
  return (
    <div className={styles.tabs} role="group" aria-label={label} style={{ "--tab-cols": columns || tabs.length }}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={styles.tab}
          aria-current={tab.key === current ? "true" : undefined}
          data-state={tab.state}
          onClick={() => onSelect(tab.key)}
        >
          <span className={styles.tabLabel}>{tab.label}</span>
          {tab.count ? <span className={styles.tabCount}>{tab.count}</span> : null}
          {tab.pending ? (
            <span className={styles.tabDot}>
              <span className="sr-only">{pendingText}</span>
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

/**
 * Avatud kirje üks vaade: päis, sakid, selle vaate tõrge, sisu ja all servas
 * tegevused.
 *
 * VAADE ON KIRJELDUS, MITTE KOMPONENT. `view` on `{ title, note, actions, body }`
 * (vt `./PrepViews.jsx` jt) ja selle joonistab alati SEE komponent. Kui iga
 * vaade oleks oma komponent, võtaks saki vahetus terve vaate koos sakireaga
 * maha ja ehitaks uuesti: äsja vajutatud sakk kaoks ja klaviatuuri fookus koos
 * sellega. Nii jääb paneel, päis ja sakirida paigale ning vahetub ainult sisu.
 *
 * Alamvaates (`frame.tabs` puudub) sakke ei ole: vorm ja avatud rida vajavad
 * kogu ruumi.
 */
export function OpenView({ frame, view }) {
  return (
    <StepPanel title={view.title} note={view.note} actions={view.actions}>
      <div className={base.stack} ref={frame.swapRef}>
        <OpenHead {...frame.head} />
        {frame.tabs ? <ViewTabs {...frame.tabs} /> : null}
        <Notice text={frame.errorText} tone="risk" />
        {view.body}
      </div>
    </StepPanel>
  );
}

/**
 * PÄRITOLU VALIK. Vaikimisi valikut ei ole ja see on L4 otsene nõue: märgis,
 * mille inimene ei valinud, ei ole märgis. Kaheksa päritolu on neljas veerus,
 * kõik kohe näha. Valik seisab omaette ümbrises: vahe eelmise väljaga tuleb
 * vaate enda vahest, mitte valikurea ülemisest polstrist.
 */
export function ProvenanceChoice({ label, options, value, onChange, disabled }) {
  return (
    <div className={styles.choice}>
      <ChoiceRow label={label} columns={4} options={options} value={value} onChange={onChange} disabled={disabled} />
    </div>
  );
}

/**
 * Uus rida avatud kirjesse (küsimus või väide, märkme kirje): tekst ja
 * päritolu. Sildiks on see, mida lisatakse (küsimuse liik, märkme kiht), et
 * vorm ütleks ise, KUHU rida läheb.
 *
 * PÄRITOLUL EI OLE VAIKEVÄÄRTUST ja see on L4 otsene nõue: server keeldub
 * tühjast ja nupp ei lase enne saata. Väli tühjendatakse AINULT õnnestumisel
 * (seda teeb sektsioon): ebaõnnestunud salvestus ei tohi inimese teksti ära
 * kustutada.
 */
export function rowAddView({ t, formId, label, text, onText, provenance, provenanceLabel, submitLabel, locked, busy, glow, canSubmit, onSubmit, onCancel }) {
  return {
    title: label,
    actions: (
      <>
        <Button type="button" size="sm" variant="secondary" onClick={onCancel}>
          {t("casework.page.cancel", "")}
        </Button>
        <Button type="submit" form={formId} size="sm" variant="primary" glow={glow} disabled={locked || busy || !canSubmit}>
          {submitLabel}
        </Button>
      </>
    ),
    body: (
      <form id={formId} className={base.stack} onSubmit={onSubmit}>
        <div data-autofocus>
          <TextAreaField label={label} value={text} onChange={onText} rows={3} maxLength={4000} disabled={locked} />
        </div>
        <ProvenanceChoice label={provenanceLabel} options={provenance.options} value={provenance.value} onChange={provenance.onChange} disabled={locked} />
      </form>
    )
  };
}

/**
 * TEKSTI PÄRITOLU: omaette väike vaade kahe teo jaoks.
 *
 *  - UUE VÄLJA ESIMENE SALVESTUS. Uuel real EI OLE vaikimisi päritolu (L4):
 *    märgis, mille inimene ei valinud, ei ole märgis. Salvestus küsib päritolu
 *    siin ja alles siis läheb tekst serverisse.
 *  - AI MUSTANDI KINNITAMINE inimese märgiseks (`current` on praegune märgis).
 *    Teksti parandamine märgist EI muuda (server eirab saadetud väärtust);
 *    kinnitus tähendab „ma vaatasin selle üle ja võtan vastutuse". SUUND ON
 *    ÜHESUUNALINE: masina märgist valikus ei ole. SIHTI EI OLE ETTE VALITUD:
 *    varem oli esimene märgis („kliendi öeldu") vaikimisi sees ja üks vajutus
 *    tegi AI mustandist kliendi sõnad.
 *
 * Tekst on ees tervikuna: päritolu öeldakse selle kohta, mida inimene näeb.
 */
export function provenanceView({ t, title, text, current = "", options, value, onChange, locked, busy, glow, submitLabel, onSubmit, onCancel }) {
  return {
    title,
    actions: (
      <>
        <Button type="button" size="sm" variant="secondary" onClick={onCancel}>
          {t("casework.page.cancel", "")}
        </Button>
        <Button type="button" size="sm" variant="primary" glow={glow} disabled={locked || busy || !value} onClick={onSubmit}>
          {submitLabel}
        </Button>
      </>
    ),
    body: (
      <>
        {/* Tekst on TEKST: sisu tuleb React'i lapsena, mitte HTML-ina. */}
        <p className={styles.quote}>{text}</p>
        {current ? (
          <p className={base.line}>
            <span className={base.lineLabel}>{t("casework.prep.provenance_now", "")}</span>
            <Chip tone="wait">{current}</Chip>
          </p>
        ) : null}
        <ProvenanceChoice label={t("casework.prep.confirm_as", "")} options={options} value={value} onChange={onChange} disabled={locked} />
      </>
    )
  };
}
