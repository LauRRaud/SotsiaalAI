"use client";

/**
 * A2 — toimetulekutoetuse eelkalkulaator, pöörduja vorm (P1).
 *
 * KONTO ON NÕUTAV (omaniku otsus 04.08).
 *
 * ARVUTUS KÄIB SELLEGIPOOLEST BRAUSERIS. `lib/benefits/subsistence.js` on puhas
 * funktsioon ilma serverisõltuvusteta, seega sissetulek, pere koosseis ja
 * eluasemekulud EI LAHKU SEADMEST: API-kutset ei ole, logisse ei jää midagi,
 * salvestamist ei toimu.
 *
 * Need kaks on eri asjad ja neid ei tohi segi ajada: **sisselogimine avab lehe,
 * aga ei tee sisestatud andmeid serverile nähtavaks.** Platvorm teab, et sa
 * kalkulaatorit avasid; ta ei tea, mida sa sinna kirjutasid. Kui keegi kunagi
 * lisab siia päringu, kaob see vahe ära: seepärast on ta testiga lukus
 * (`tests/subsistence-calculator-views.test.mjs`).
 *
 * Vorm peegeldab tuuma fail-closed loogikat: kui sisendist ei saa ohutult
 * numbrit teha, EI KUVATA summat, vaid öeldakse, mis puudu on. Usutav vale
 * number on siin halvim väljund: inimene teeb tema põhjal otsuse.
 *
 * KUJU. Leht on sammulaval (`components/stage`): pere, sissetulek, eluase,
 * eluaseme kulud, kommunaalkulud, täpsustused (küsimused tekivad sisestatud
 * kulude järgi) ja eelhinnang. Lehe nimi ja samm on all kiirmenüüs. Kaks
 * lubadust (see ei ole otsus; andmed ei lahku seadmest) seisavad esimesel
 * vaatel, ENNE kui inimene oma sissetuleku sisestab. Reeglid ilma joonistuseta
 * on failis `./subsistenceSteps.js`, kujundus failis `./subsistence.module.css`.
 */

import { useId, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

import { useI18n } from "@/components/i18n/I18nProvider";
import CheckCard from "@/components/stage/CheckCard";
import ChoiceRow from "@/components/stage/ChoiceRow";
import StepFlight from "@/components/stage/StepFlight";
import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { estimateSubsistenceBenefit } from "@/lib/benefits/subsistence";
import { loginHref } from "@/lib/safeNextPath";

import styles from "./subsistence.module.css";
import { COST_GROUPS, STEP_KEYS, declaredCostKeys, euro, gateQuestions, stepStates, uniqueIssueCodes } from "./subsistenceSteps";

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

/** Arvuväli: nimi välja kohal, väli nii lai kui summa või arv vajab. `hintId`: selgitus, mis seisab väljade all. */
function NumberField({ label, hintId, value, onChange, step = "0.01", size = "sum" }) {
  const id = useId();
  return (
    <div className={styles.field} data-size={size}>
      <label className={styles.fieldLabel} htmlFor={id}>
        {label}
      </label>
      <Input id={id} type="number" min="0" step={step} inputMode="decimal" value={value} aria-describedby={hintId} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

export default function SubsistenceCalculator() {
  const { t } = useI18n();
  const { status } = useSession();
  const hintId = useId();
  const [form, setForm] = useState(EMPTY);
  const [costs, setCosts] = useState({});

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const setCost = (key, value) => setCosts((current) => ({ ...current, [key]: value }));

  const declared = useMemo(() => declaredCostKeys(costs), [costs]);
  const questions = gateQuestions(declared);

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
    return <p className={styles.quiet}>{t("subsistence.loading")}</p>;
  }

  // Konto on nõutav (omanik 04.08). Arvutus ise jääb sellegipoolest brauserisse:
  // sisselogimine avab lehe, aga ei tee sisestatud andmeid serverile nähtavaks.
  // Need kaks on eri asjad ja teine neist ei tohi esimesega kaduda.
  if (status !== "authenticated") {
    return (
      <section className={styles.page}>
        <h1 className="sr-only">{t("subsistence.title")}</h1>
        <StepPanel
          title={t("subsistence.title")}
          question={t("subsistence.auth_required")}
          actions={
            <Button as="a" href={loginHref("/toimetulekutoetus")} size="sm" variant="primary">
              {t("subsistence.actions.login")}
            </Button>
          }
        />
      </section>
    );
  }

  const states = stepStates(form, costs);
  const sum = (group) => COST_GROUPS[group].reduce((total, key) => total + (Number(costs[key]) > 0 ? Number(costs[key]) : 0), 0);
  const summaries = {
    family: t("subsistence.views.family.summary", { adults: Number(form.adults) || 0, minors: Number(form.minors) || 0 }),
    costs: sum("costs") ? euro(sum("costs")) : "",
    utilities: sum("utilities") ? euro(sum("utilities")) : "",
    result: result.usable ? euro(result.estimate) : ""
  };
  const steps = STEP_KEYS.map((key) => ({
    key,
    label: t(`subsistence.views.${key}.title`),
    short: t(`subsistence.views.${key}.short`),
    state: states[key],
    summary: summaries[key] || undefined
  }));
  const yesNo = [
    { value: "yes", label: t("subsistence.answers.yes") },
    { value: "no", label: t("subsistence.answers.no") }
  ];
  const costFields = (group) => (
    <div className={styles.fields}>
      {COST_GROUPS[group].map((key) => (
        <NumberField key={key} label={t(`subsistence.costs.${key}`)} value={costs[key] ?? ""} onChange={(value) => setCost(key, value)} />
      ))}
    </div>
  );

  const renderView = (key) => {
    switch (key) {
      case "family":
        return (
          /* Kaks lubadust ette, mitte tulemuse juurde. Inimene peab teadma, mida ta
             teeb, ENNE kui ta oma sissetuleku sisestab. */
          <StepPanel title={t("subsistence.views.family.title")} question={t("subsistence.not_a_decision")} lead={t("subsistence.stays_on_device")}>
            <div className={styles.fields}>
              <NumberField label={t("subsistence.fields.adults")} value={form.adults} step="1" size="count" onChange={(value) => set("adults", value)} />
              <NumberField label={t("subsistence.fields.minors")} value={form.minors} step="1" size="count" onChange={(value) => set("minors", value)} />
            </div>
          </StepPanel>
        );
      case "income":
        return (
          <StepPanel title={t("subsistence.views.income.title")} question={t("subsistence.views.income.question")} note={t("subsistence.stays_on_device")}>
            <div className={styles.stack}>
              <div className={styles.fields}>
                <NumberField label={t("subsistence.fields.work_income")} value={form.workIncome} onChange={(value) => set("workIncome", value)} />
                <NumberField label={t("subsistence.fields.other_income")} hintId={`${hintId}-income`} value={form.otherIncome} onChange={(value) => set("otherIncome", value)} />
                <NumberField label={t("subsistence.fields.paid_maintenance")} value={form.paidMaintenance} onChange={(value) => set("paidMaintenance", value)} />
                <NumberField label={t("subsistence.fields.enforcement")} value={form.enforcementWithheld} onChange={(value) => set("enforcementWithheld", value)} />
              </div>
              <p className={styles.hint} id={`${hintId}-income`}>
                {t("subsistence.hints.excluded_income")}
              </p>
            </div>
          </StepPanel>
        );
      case "housing":
        return (
          <StepPanel title={t("subsistence.views.housing.title")} question={t("subsistence.views.housing.question")}>
            <div className={styles.stack}>
              <div className={styles.fields}>
                <NumberField label={t("subsistence.fields.area")} value={form.dwellingAreaM2} step="0.1" size="count" onChange={(value) => set("dwellingAreaM2", value)} />
                <NumberField label={t("subsistence.fields.rooms")} hintId={`${hintId}-rooms`} value={form.rooms} step="1" size="count" onChange={(value) => set("rooms", value)} />
              </div>
              <p className={styles.hint} id={`${hintId}-rooms`}>
                {t("subsistence.hints.rooms")}
              </p>
              <div className={styles.check}>
                <CheckCard title={t("subsistence.fields.single_occupant")} checked={form.singleOccupantExtendedNorm} onChange={(checked) => set("singleOccupantExtendedNorm", checked)} />
              </div>
            </div>
          </StepPanel>
        );
      case "costs":
        return (
          <StepPanel title={t("subsistence.views.costs.title")} question={t("subsistence.views.costs.question")} note={t("subsistence.views.costs.note")}>
            {costFields("costs")}
          </StepPanel>
        );
      case "utilities":
        return (
          <StepPanel title={t("subsistence.views.utilities.title")} question={t("subsistence.views.utilities.question")} note={t("subsistence.views.costs.note")}>
            {costFields("utilities")}
          </StepPanel>
        );
      case "gates":
        return (
          <StepPanel title={t("subsistence.views.gates.title")} question={questions.length ? undefined : t("subsistence.views.gates.none")}>
            <div className={styles.stack}>
              {questions.map((question) => (
                <div key={question.field} className={styles.gate}>
                  <ChoiceRow
                    label={t(question.text)}
                    layout="scale"
                    options={yesNo}
                    value={form[question.field] === true ? "yes" : form[question.field] === false ? "no" : ""}
                    onChange={(value) => set(question.field, value === "yes")}
                  />
                  {question.hint ? <p className={styles.hint}>{t(question.hint)}</p> : null}
                </div>
              ))}
            </div>
          </StepPanel>
        );
      default:
        /* Tulemus arvutatakse sisestatust kohe: eraldi nuppu ei ole. Kui summat
           ei saa ohutult anda, seisab siin see, mis puudu on (fail-closed). */
        return result.usable ? (
          <StepPanel title={t("subsistence.views.result.title")} question={t("subsistence.result.title")} note={t("subsistence.not_a_decision")}>
            <div className={styles.stack} aria-live="polite">
              <p className={styles.amount}>{euro(result.estimate)}</p>
              <dl className={styles.facts}>
                {[
                  ["limit", result.subsistenceLimit.total],
                  ["housing", result.housing.total],
                  ["income", result.income.total]
                ].map(([name, value]) => (
                  <div key={name} className={styles.fact}>
                    <dt className={styles.factLabel}>{t(`subsistence.result.${name}`)}</dt>
                    <dd className={styles.factValue}>{euro(value)}</dd>
                  </div>
                ))}
              </dl>
              {result.caveats.includes("KOV_HOUSING_LIMITS_UNKNOWN") ? <p className={styles.caveat}>{t("subsistence.caveat.kov_limits")}</p> : null}
              {result.caveats.includes("ABOVE_SUBSISTENCE_LINE") ? <p className={styles.quiet}>{t("subsistence.caveat.above_line")}</p> : null}
            </div>
          </StepPanel>
        ) : (
          <StepPanel title={t("subsistence.views.result.title")} question={t("subsistence.result.incomplete")}>
            <ul className={styles.issues} aria-live="polite">
              {uniqueIssueCodes(result.issues).map((code) => (
                <li key={code} className={styles.issue}>
                  {t(`subsistence.issues.${code}`)}
                </li>
              ))}
            </ul>
          </StepPanel>
        );
    }
  };

  return (
    <section className={styles.page}>
      <h1 className="sr-only">{t("subsistence.title")}</h1>
      <StepFlight label={t("subsistence.title")} steps={steps}>
        {(step) => renderView(step.key)}
      </StepFlight>
    </section>
  );
}
