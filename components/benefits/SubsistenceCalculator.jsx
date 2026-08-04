"use client";

/**
 * A2 — toimetulekutoetuse eelkalkulaator, pöörduja vorm (P1).
 *
 * KONTO ON NÕUTAV (omaniku otsus 04.08).
 *
 * ARVUTUS KÄIB SELLEGIPOOLEST BRAUSERIS. `lib/benefits/subsistence.js` on puhas
 * funktsioon ilma serverisõltuvusteta, seega sissetulek, pere koosseis ja
 * eluasemekulud EI LAHKU SEADMEST — API-kutset ei ole, logisse ei jää midagi,
 * salvestamist ei toimu.
 *
 * Need kaks on eri asjad ja neid ei tohi segi ajada: **sisselogimine avab lehe,
 * aga ei tee sisestatud andmeid serverile nähtavaks.** Platvorm teab, et sa
 * kalkulaatorit avasid; ta ei tea, mida sa sinna kirjutasid. Kui keegi kunagi
 * lisab siia `fetch`-i, kaob see vahe ära — seepärast on ta testiga lukus.
 *
 * Vorm peegeldab tuuma fail-closed loogikat: kui sisendist ei saa ohutult
 * numbrit teha, EI KUVATA summat, vaid öeldakse, mis puudu on. Usutav vale
 * number on siin halvim väljund — inimene teeb tema põhjal otsuse.
 */

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";

import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { estimateSubsistenceBenefit } from "@/lib/benefits/subsistence";
import { HOUSING_COST_KINDS } from "@/lib/benefits/subsistenceRates";

function txt(t, key, fallback) {
  return typeof t === "function" ? t(key, fallback) : fallback;
}

const EMPTY = {
  adults: "1",
  minors: "0",
  otherIncome: "",
  workIncome: "",
  paidMaintenance: "",
  enforcementWithheld: "",
  dwellingAreaM2: "",
  rooms: "",
  singleOccupantExtendedNorm: false,
  costsAreCurrentMonth: null,
  landlordIsFamilyOrTheirCompany: null,
  isApartmentBuilding: null,
  housingLoanConditionsMet: null
};

function YesNo({ label, value, onChange, hint, yesLabel, noLabel }) {
  return (
    <fieldset>
      <legend>{label}</legend>
      <label>
        <input type="radio" checked={value === true} onChange={() => onChange(true)} />
        <span>{yesLabel}</span>
      </label>
      <label>
        <input type="radio" checked={value === false} onChange={() => onChange(false)} />
        <span>{noLabel}</span>
      </label>
      {hint ? <small>{hint}</small> : null}
    </fieldset>
  );
}

export default function SubsistenceCalculator() {
  const { t } = useI18n();
  const { status } = useSession();
  const [form, setForm] = useState(EMPTY);
  const [costs, setCosts] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const yes = txt(t, "subsistence.answers.yes", "Jah");
  const no = txt(t, "subsistence.answers.no", "Ei");

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const setCost = (key, value) => setCosts((c) => ({ ...c, [key]: value }));

  const declaredCostKeys = useMemo(
    () => Object.keys(costs).filter((key) => Number(costs[key]) > 0),
    [costs]
  );
  const needsRent = declaredCostKeys.includes("rent");
  const needsApartment = declaredCostKeys.some((k) => k === "buildingManagement" || k === "buildingRenovationLoan");
  const needsLoan = declaredCostKeys.includes("housingLoan");

  const result = useMemo(() => estimateSubsistenceBenefit({
    adults: form.adults,
    minors: form.minors,
    otherIncome: form.otherIncome,
    workIncome: form.workIncome,
    paidMaintenance: form.paidMaintenance,
    enforcementWithheld: form.enforcementWithheld,
    dwellingAreaM2: form.dwellingAreaM2,
    rooms: form.rooms === "" ? null : form.rooms,
    singleOccupantExtendedNorm: form.singleOccupantExtendedNorm,
    housingCosts: costs,
    gates: {
      costsAreCurrentMonth: form.costsAreCurrentMonth,
      landlordIsFamilyOrTheirCompany: form.landlordIsFamilyOrTheirCompany,
      isApartmentBuilding: form.isApartmentBuilding,
      housingLoanConditionsMet: form.housingLoanConditionsMet
    }
  }), [form, costs]);

  if (status === "loading") {
    return <p>{txt(t, "subsistence.loading", "Laen...")}</p>;
  }

  // Konto on nõutav (omanik 04.08). Arvutus ise jääb sellegipoolest brauserisse
  // — sisselogimine avab lehe, aga ei tee sisestatud andmeid serverile
  // nähtavaks. Need kaks on eri asjad ja teine neist ei tohi esimesega kaduda.
  if (status !== "authenticated") {
    return (
      <section>
        <h2>{txt(t, "subsistence.title", "Toimetulekutoetuse eelhinnang")}</h2>
        <p>{txt(t, "subsistence.auth_required", "Eelhinnangu tegemiseks logi sisse.")}</p>
        <Button as="a" href="/vestlus?login=1">
          {txt(t, "subsistence.actions.login", "Logi sisse")}
        </Button>
      </section>
    );
  }

  return (
    <section>
      <h2>{txt(t, "subsistence.title", "Toimetulekutoetuse eelhinnang")}</h2>

      {/* Kaks lubadust ette, mitte tulemuse juurde. Inimene peab teadma, mida ta
          teeb, ENNE kui ta oma sissetuleku sisestab. */}
      <p><strong>{txt(t, "subsistence.not_a_decision", "See ei ole otsus. Toimetulekutoetuse määrab valla- või linnavalitsus.")}</strong></p>
      <p>{txt(t, "subsistence.stays_on_device", "Arvutus käib sinu seadmes. Sisestatud andmed ei lähe kuhugi ära ega salvestu.")}</p>

      <h3>{txt(t, "subsistence.section.family", "Pere")}</h3>
      <label>
        <span>{txt(t, "subsistence.fields.adults", "Täisealisi pereliikmeid")}</span>
        <Input type="number" min="0" value={form.adults} onChange={(e) => set("adults", e.target.value)} />
      </label>
      <label>
        <span>{txt(t, "subsistence.fields.minors", "Alaealisi pereliikmeid")}</span>
        <Input type="number" min="0" value={form.minors} onChange={(e) => set("minors", e.target.value)} />
      </label>

      <h3>{txt(t, "subsistence.section.income", "Eelmise kuu sissetulek")}</h3>
      <label>
        <span>{txt(t, "subsistence.fields.work_income", "Töine sissetulek (netos)")}</span>
        <Input type="number" min="0" step="0.01" value={form.workIncome} onChange={(e) => set("workIncome", e.target.value)} />
      </label>
      <label>
        <span>{txt(t, "subsistence.fields.other_income", "Muu sissetulek (pension, toetused, elatis sulle)")}</span>
        <Input type="number" min="0" step="0.01" value={form.otherIncome} onChange={(e) => set("otherIncome", e.target.value)} />
        <small>{txt(t, "subsistence.hints.excluded_income", "Ära arvesta siia ühekordseid toetusi, puudetoetusi, õppelaenu ega õppetoetusi — neid seadus sissetulekuks ei loe.")}</small>
      </label>
      <label>
        <span>{txt(t, "subsistence.fields.paid_maintenance", "Sinu makstud elatis")}</span>
        <Input type="number" min="0" step="0.01" value={form.paidMaintenance} onChange={(e) => set("paidMaintenance", e.target.value)} />
      </label>
      <label>
        <span>{txt(t, "subsistence.fields.enforcement", "Kohtutäituri kinni peetud summa")}</span>
        <Input type="number" min="0" step="0.01" value={form.enforcementWithheld} onChange={(e) => set("enforcementWithheld", e.target.value)} />
      </label>

      <h3>{txt(t, "subsistence.section.housing", "Eluase")}</h3>
      <label>
        <span>{txt(t, "subsistence.fields.area", "Eluruumi üldpind (m²)")}</span>
        <Input type="number" min="0" step="0.1" value={form.dwellingAreaM2} onChange={(e) => set("dwellingAreaM2", e.target.value)} />
      </label>
      <label>
        <span>{txt(t, "subsistence.fields.rooms", "Tubade arv")}</span>
        <Input type="number" min="0" value={form.rooms} onChange={(e) => set("rooms", e.target.value)} />
        <small>{txt(t, "subsistence.hints.rooms", "Kui tube on sama palju kui elanikke, võetakse arvesse kogu pind.")}</small>
      </label>
      <label>
        <input
          type="checkbox"
          checked={form.singleOccupantExtendedNorm}
          onChange={(e) => set("singleOccupantExtendedNorm", e.target.checked)}
        />
        <span>{txt(t, "subsistence.fields.single_occupant", "Elan üksi ja olen pensionär või osalise/puuduva töövõimega")}</span>
      </label>

      {HOUSING_COST_KINDS.map((kind) => (
        <label key={kind.key}>
          <span>{txt(t, `subsistence.costs.${kind.key}`, kind.label)}</span>
          <Input
            type="number" min="0" step="0.01"
            value={costs[kind.key] ?? ""}
            onChange={(e) => setCost(kind.key, e.target.value)}
          />
        </label>
      ))}

      {declaredCostKeys.length ? (
        <>
          <h3>{txt(t, "subsistence.section.gates", "Täpsustused")}</h3>
          <YesNo
            yesLabel={yes}
            noLabel={no}
            label={txt(t, "subsistence.gates.current_month", "Kas need on jooksval kuul tasumisele kuuluvad kulud?")}
            value={form.costsAreCurrentMonth}
            onChange={(v) => set("costsAreCurrentMonth", v)}
            hint={txt(t, "subsistence.hints.current_month", "Varasemat eluasemevõlga arvesse ei võeta.")}
          />
          {needsRent ? (
            <YesNo
              yesLabel={yes}
              noLabel={no}
              label={txt(t, "subsistence.gates.landlord_family", "Kas üürileandja on pereliige või tema äriühing?")}
              value={form.landlordIsFamilyOrTheirCompany}
              onChange={(v) => set("landlordIsFamilyOrTheirCompany", v)}
            />
          ) : null}
          {needsApartment ? (
            <YesNo
              yesLabel={yes}
              noLabel={no}
              label={txt(t, "subsistence.gates.apartment", "Kas elad korterelamus?")}
              value={form.isApartmentBuilding}
              onChange={(v) => set("isApartmentBuilding", v)}
            />
          ) : null}
          {needsLoan ? (
            <YesNo
              yesLabel={yes}
              noLabel={no}
              label={txt(t, "subsistence.gates.loan", "Kas eluasemelaen on sinu nimel ja laenatud eluase on sinu rahvastikuregistrijärgne elukoht?")}
              value={form.housingLoanConditionsMet}
              onChange={(v) => set("housingLoanConditionsMet", v)}
            />
          ) : null}
        </>
      ) : null}

      <button type="button" onClick={() => setSubmitted(true)}>
        {txt(t, "subsistence.actions.calculate", "Arvuta eelhinnang")}
      </button>

      {submitted ? (
        <div aria-live="polite">
          {result.usable ? (
            <>
              <h3>{txt(t, "subsistence.result.title", "Eelhinnang")}</h3>
              <p><strong>{result.estimate.toFixed(2)} €</strong></p>
              <ul>
                <li>{txt(t, "subsistence.result.limit", "Pere toimetulekupiir")}: {result.subsistenceLimit.total.toFixed(2)} €</li>
                <li>{txt(t, "subsistence.result.housing", "Arvesse minev eluasemekulu")}: {result.housing.total.toFixed(2)} €</li>
                <li>{txt(t, "subsistence.result.income", "Arvesse minev sissetulek")}: {result.income.total.toFixed(2)} €</li>
              </ul>
              {result.caveats.includes("KOV_HOUSING_LIMITS_UNKNOWN") ? (
                <p><strong>{txt(t, "subsistence.caveat.kov_limits", "Sinu omavalitsus kehtestab eluasemekuludele oma piirmäärad, mida see arvutus ei tea. Tegelik summa võib olla väiksem.")}</strong></p>
              ) : null}
              {result.caveats.includes("ABOVE_SUBSISTENCE_LINE") ? (
                <p>{txt(t, "subsistence.caveat.above_line", "Selle sisendi juures toetust ei tuleks. Olukorra muutudes tasub uuesti arvutada.")}</p>
              ) : null}
              <p>{txt(t, "subsistence.not_a_decision", "See ei ole otsus. Toimetulekutoetuse määrab valla- või linnavalitsus.")}</p>
            </>
          ) : (
            <>
              {/* Fail-closed: summat EI kuvata. Inimene saab teada, mis puudu on. */}
              <h3>{txt(t, "subsistence.result.incomplete", "Eelhinnangut ei saa veel anda")}</h3>
              {/* Kaks vastamata väravat annavad SAMA teate. Sama lause kaks
                  korda järjest näeb välja nagu viga, mitte nagu juhis —
                  kordused kaovad, puudujäägid jäävad. */}
              <ul>
                {[...new Set(result.issues.map((issue) => txt(t, `subsistence.issues.${issue.code}`, issue.code)))]
                  .map((message) => <li key={message}>{message}</li>)}
              </ul>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
