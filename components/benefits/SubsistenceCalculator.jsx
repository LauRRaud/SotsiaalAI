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
 * vaatel, ENNE kui inimene oma sissetuleku sisestab.
 *
 * LEHE OTSUSED EI OLE SIIN. Mis läheb arvutusse, mis on tulemus, mis seisus on
 * sammud ja mida tulemuse all öeldakse, otsustab `./subsistenceSteps.js`
 * (testitud käitumisena); siin on ainult olek ja joonistus. Kujundus on failis
 * `./subsistence.module.css`.
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";

import { useI18n } from "@/components/i18n/I18nProvider";
import CheckCard from "@/components/stage/CheckCard";
import ChoiceRow from "@/components/stage/ChoiceRow";
import StepFlight from "@/components/stage/StepFlight";
import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { setPanelLeaveGuard, twoPressLeaveGuard } from "@/lib/panelLeaveGuard";
import { loginHref } from "@/lib/safeNextPath";

import styles from "./subsistence.module.css";
import {
  COST_GROUPS,
  EMPTY_FORM,
  STEP_KEYS,
  costFieldId,
  declaredCostKeys,
  formTouched,
  gateQuestions,
  housingReason,
  issueRows,
  pageEstimate,
  quoted,
  rateMissing,
  resultFacts,
  resultNote,
  stepStates,
  stepSummaries,
  wholeCount
} from "./subsistenceSteps";

/**
 * Arvuväli: nimi välja kohal, väli nii lai kui summa või arv vajab. `hintId`:
 * selgitus, mis seisab väljade all. `whole`: pereliikmete ja tubade arv on
 * täisarv (murdosa ei jää väljale, kuigi arvutus selle nagunii ära lõikaks:
 * plaat ja arvutus peavad näitama sama arvu).
 *
 * LOETAMATU SISU. Arvuväli annab lehele tühja väärtuse, kui väljale on
 * kirjutatud midagi, mida brauser arvuks ei loe („500,-", „1 200"), aga tekst
 * jääb väljale seisma. Väli ütleb selle lehele (`onChange` teine argument),
 * leht hoiab välja loetamatuna ja arvutus keeldub välja nimega: muidu arvutataks
 * ilma selle summata ja tulemus ei vastaks sellele, mida inimene väljal näeb.
 */
function NumberField({ label, hintId, value, onChange, step = "0.01", size = "sum", whole = false }) {
  const id = useId();
  const change = (event) => {
    const typed = event.target.value;
    const unreadable = event.target.validity?.badInput === true;
    onChange(whole && typed !== "" ? String(wholeCount(typed)) : typed, unreadable);
  };
  return (
    <div className={styles.field} data-size={size}>
      <label className={styles.fieldLabel} htmlFor={id}>
        {label}
      </label>
      <Input id={id} type="number" min="0" max={whole ? "99" : "1000000"} step={step} inputMode={whole ? "numeric" : "decimal"} value={value} aria-describedby={hintId} onChange={change} />
    </div>
  );
}

export default function SubsistenceCalculator() {
  const { t, locale } = useI18n();
  const { status } = useSession();
  const hintId = useId();
  const [form, setForm] = useState(EMPTY_FORM);
  const [costs, setCosts] = useState({});
  /* Väljad, kuhu on kirjutatud midagi, mida brauser arvuks ei loe. */
  const [bad, setBad] = useState([]);
  const [leaveAsked, setLeaveAsked] = useState(false);
  const leaveRef = useRef(null);

  const mark = (id, unreadable) =>
    setBad((current) => (unreadable ? (current.includes(id) ? current : [...current, id]) : current.includes(id) ? current.filter((item) => item !== id) : current));
  const set = (key, value, unreadable = false) => {
    setForm((current) => ({ ...current, [key]: value }));
    mark(key, unreadable);
  };
  const setCost = (key, value, unreadable = false) => {
    setCosts((current) => ({ ...current, [key]: value }));
    mark(costFieldId(key), unreadable);
  };

  const declared = useMemo(() => declaredCostKeys(costs), [costs]);
  const questions = gateQuestions(declared);
  const result = useMemo(() => pageEstimate(form, costs, bad), [form, costs, bad]);

  /* Leht ei salvesta midagi (see on lubadus), seega kaoks kogemata lahkumisel
     kuni kakskümmend sisestatud arvu ilma ühegi sõnata. Kui midagi on sisestatud,
     peab kiirmenüü tagasinool ja Esc esimese vajutuse kinni ja lava kohal seisab
     põhjus; teine vajutus lahkub (lib/panelLeaveGuard.js). Akna sulgemise ja uuesti
     laadimise peab kinni brauseri enda küsimus. Brauseri tagasinuppu ja
     väljalogimist see ei kata. Värav on olemas ainult siis, kui vorm on ees:
     lõppenud seansi korral on ees sisselogimise vaade ja teadet ei oleks kus näidata. */
  const guarded = status === "authenticated" && formTouched(form, costs, bad);
  useEffect(() => {
    if (!guarded) return undefined;
    const leave = twoPressLeaveGuard({
      onAsk: () => {
        setLeaveAsked(true);
        /* Teade on lehe alguses: keritud lehel (telefon) tuuakse see nähtavale. */
        window.requestAnimationFrame(() => leaveRef.current?.scrollIntoView({ block: "nearest" }));
      },
      onClear: () => setLeaveAsked(false)
    });
    const release = setPanelLeaveGuard(leave);
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      release();
      leave.clear();
      window.removeEventListener("beforeunload", warn);
    };
  }, [guarded]);

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

  const members = wholeCount(form.adults) + wholeCount(form.minors);
  const states = stepStates(form, costs, result.usable);
  const summaries = stepSummaries(form, costs, result, locale);
  const steps = STEP_KEYS.map((key) => ({
    key,
    label: t(`subsistence.views.${key}.title`),
    short: t(`subsistence.views.${key}.short`),
    state: states[key],
    summary: (key === "family" ? t("subsistence.views.family.summary", summaries.family) : summaries[key]) || undefined,
    /* Üle nelja täpsustava küsimuse (üür, korterelamu kulud, laen ja maamaks korraga) ei mahu ühte vaatesse:
       see vaade kerib siis paneeli ega tee teisi vaateid enda kõrguseks. */
    free: key === "gates" && questions.length > 4
  }));
  const yesNo = [
    { value: "yes", label: t("subsistence.answers.yes") },
    { value: "no", label: t("subsistence.answers.no") }
  ];
  const note = resultNote(result);
  const reason = housingReason(result, locale);
  const costFields = (group) => (
    <div className={styles.fields}>
      {COST_GROUPS[group].map((key) => (
        <NumberField key={key} label={t(`subsistence.costs.${key}`)} value={costs[key] ?? ""} onChange={(value, unreadable) => setCost(key, value, unreadable)} />
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
            <div className={styles.stack}>
              <div className={styles.fields}>
                <NumberField label={t("subsistence.fields.adults")} hintId={`${hintId}-family`} value={form.adults} step="1" size="count" whole onChange={(value, unreadable) => set("adults", value, unreadable)} />
                <NumberField label={t("subsistence.fields.minors")} hintId={`${hintId}-family`} value={form.minors} step="1" size="count" whole onChange={(value, unreadable) => set("minors", value, unreadable)} />
              </div>
              {/* Kes on pereliige ja kuhu läheb laps, kes saab sel kuul 18: vale lahter annaks vale piiri. */}
              <p className={styles.hint} id={`${hintId}-family`}>
                {t("subsistence.hints.family")}
              </p>
            </div>
          </StepPanel>
        );
      case "income":
        return (
          <StepPanel title={t("subsistence.views.income.title")} question={t("subsistence.views.income.question")} note={t("subsistence.stays_on_device")}>
            <div className={styles.stack}>
              <div className={styles.fields}>
                <NumberField label={t("subsistence.fields.work_income")} hintId={`${hintId}-income`} value={form.workIncome} onChange={(value, unreadable) => set("workIncome", value, unreadable)} />
                <NumberField label={t("subsistence.fields.other_income")} hintId={`${hintId}-income`} value={form.otherIncome} onChange={(value, unreadable) => set("otherIncome", value, unreadable)} />
                <NumberField label={t("subsistence.fields.paid_maintenance")} value={form.paidMaintenance} onChange={(value, unreadable) => set("paidMaintenance", value, unreadable)} />
                <NumberField label={t("subsistence.fields.enforcement")} value={form.enforcementWithheld} onChange={(value, unreadable) => set("enforcementWithheld", value, unreadable)} />
              </div>
              {/* Null sissetulek on selle toetuse puhul tavaline: reegel seisab siin, mitte alles viimases vaates. */}
              <p className={styles.hint} id={`${hintId}-income`}>
                {t("subsistence.hints.zero_income")} {t("subsistence.hints.excluded_income")}
              </p>
            </div>
          </StepPanel>
        );
      case "housing":
        return (
          <StepPanel title={t("subsistence.views.housing.title")} question={t("subsistence.views.housing.question")}>
            <div className={styles.stack}>
              <div className={styles.fields}>
                <NumberField label={t("subsistence.fields.area")} value={form.dwellingAreaM2} step="0.1" size="count" onChange={(value, unreadable) => set("dwellingAreaM2", value, unreadable)} />
                <NumberField label={t("subsistence.fields.rooms")} hintId={`${hintId}-rooms`} value={form.rooms} step="1" size="count" whole onChange={(value, unreadable) => set("rooms", value, unreadable)} />
              </div>
              <p className={styles.hint} id={`${hintId}-rooms`}>
                {t("subsistence.hints.rooms")}
              </p>
              {/* Märge käib üksi elava inimese kohta: mitme pereliikmega arvutus seda ei kasuta, seega seda siis ei pakuta. */}
              {members === 1 ? (
                <div className={styles.check}>
                  <CheckCard title={t("subsistence.fields.single_occupant")} checked={form.singleOccupantExtendedNorm} onChange={(checked) => set("singleOccupantExtendedNorm", checked)} />
                </div>
              ) : null}
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
            <div className={styles.gates}>
              {questions.map((question) => (
                <div key={question.field} className={styles.gate} role="group" aria-describedby={question.conditions ? `${hintId}-${question.field}` : undefined}>
                  {/* Tingimused seisavad enne vastust: ilma nendeta ei saa küsimusele vastata. */}
                  {question.conditions ? (
                    <ol className={styles.conditions} id={`${hintId}-${question.field}`}>
                      {question.conditions.map((conditionKey) => (
                        <li key={conditionKey}>{t(conditionKey)}</li>
                      ))}
                    </ol>
                  ) : null}
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
           ei saa ohutult anda, seisab siin see, mis puudu on (fail-closed).
           Summa avab vaate: sammu nime („Eelhinnang") ütleb kiirmenüü. */
        return result.usable ? (
          <StepPanel title={t("subsistence.views.result.title")} note={t("subsistence.not_a_decision")}>
            <div className={styles.stack} aria-live="polite">
              <p className={styles.amount}>{summaries.result}</p>
              <dl className={styles.facts}>
                {resultFacts(result, locale).map((fact) => (
                  <div key={fact.key} className={styles.fact}>
                    <dt className={styles.factLabel}>{t(`subsistence.result.${fact.key}`)}</dt>
                    <dd className={styles.factValue}>{fact.value}</dd>
                  </div>
                ))}
              </dl>
              {/* Miks arvesse läks vähem, kui sisestati: arv ilma põhjuseta näeb välja nagu viga. */}
              {reason ? <p className={styles.quiet}>{t(reason.key, { ...reason.vars, costs: reason.costKeys.map((costKey) => quoted(t(costKey), locale)).join(", ") })}</p> : null}
              {note === "above_line" ? <p className={styles.quiet}>{t("subsistence.caveat.above_line")}</p> : null}
              {note === "kov_limits" ? <p className={styles.caveat}>{t("subsistence.caveat.kov_limits")}</p> : null}
            </div>
          </StepPanel>
        ) : (
          <StepPanel title={t("subsistence.views.result.title")} question={t("subsistence.result.incomplete")}>
            <ul className={styles.issues} aria-live="polite">
              {issueRows(result.issues).map((row) => (
                <li key={`${row.code}:${row.fieldLabelKey}`} className={styles.issue}>
                  {row.fieldLabelKey ? t(`subsistence.issues_named.${row.code}`, { field: t(row.fieldLabelKey) }) : t(`subsistence.issues.${row.code}`)}
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
      {leaveAsked ? (
        <p className={styles.leave} role="alert" ref={leaveRef}>
          {t("subsistence.leave_asked")}
        </p>
      ) : null}
      {/* Kui selle aasta määra ei ole kinnitatud, ei aita ükski sisestus: seda öeldakse kohe, mitte alles seitsmendas vaates. */}
      {rateMissing(result) ? <p className={styles.leave}>{t("subsistence.issues.UNSUPPORTED_DATE")}</p> : null}
      <StepFlight label={t("subsistence.title")} steps={steps}>
        {(step) => renderView(step.key)}
      </StepFlight>
    </section>
  );
}
