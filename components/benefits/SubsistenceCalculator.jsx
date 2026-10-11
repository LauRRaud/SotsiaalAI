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
 * LEHE OTSUSED EI OLE SIIN. Mis väli mis kohta kirjutab, kuidas olek muutub,
 * mis läheb arvutusse, mis on tulemus, mis seisus on sammud ja mida iga vaade
 * joonistada tohib, otsustab `./subsistenceSteps.js` (testitud käitumisena).
 * Siin on kaks osa: `SubsistenceCalculator` hoiab olekut ja lahkumise väravat,
 * `SubsistenceViews` joonistab selle, mida `pageView` tagastab. Vaated on eraldi
 * osa, et test saaks need antud olekuga joonistada ja väljade teateid läbi
 * vajutada (`tests/subsistence-calculator-render.test.mjs`). Kujundus on failis
 * `./subsistence.module.css`.
 */

import { useEffect, useId, useReducer, useRef, useState } from "react";
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
  ANSWER_CHOICES,
  EMPTY_STATE,
  VIEW_FIELDS,
  answerAction,
  armLeaveGuard,
  fieldAction,
  fieldValue,
  leaveGuarded,
  pageReducer,
  pageScreen,
  pageView,
  viewText
} from "./subsistenceSteps";

/**
 * Arvuväli: nimi välja kohal, väli nii lai kui summa või arv vajab. Välja kuju
 * (täisarv või mitte, samm, laius, suurim väärtus) tuleb väljade tabelist.
 *
 * LOETAMATU SISU. Arvuväli annab lehele tühja väärtuse, kui väljale on
 * kirjutatud midagi, mida brauser arvuks ei loe („500,-", „1 200"), aga tekst
 * jääb väljale seisma. Väli ütleb lehele oma väärtuse ja loetavuse (`onReport`),
 * leht hoiab välja loetamatuna ja arvutus keeldub välja nimega: muidu arvutataks
 * ilma selle summata ja tulemus ei vastaks sellele, mida inimene väljal näeb.
 *
 * MIKS KOLM KUULAJAT. React kutsub `onChange` ainult siis, kui välja VÄÄRTUS
 * muutus. Tühjalt väljalt loetamatu tekstini („280,-" kleebitud tühjale väljale)
 * ja loetamatust tekstist tühjaks on väärtus mõlemal pool tühi sõne: `onChange`
 * ei tule, märk jäi panemata (leht arvutas ilma summata, mis väljal seisis) või
 * maha võtmata (leht keeldus tühja välja pärast). Brauseri enda `input` sündmus
 * (`onInput`) tuleb igal sisestusel; fookuse lahkumisel loetakse seis veel kord
 * üle. Teade on sama, seega mitu teadet järjest ei muuda midagi.
 */
function NumberField({ field, label, describedBy, value, onReport }) {
  const id = useId();
  const report = (event) => onReport(event.target);
  return (
    <div className={styles.field} data-size={field.size}>
      <label className={styles.fieldLabel} htmlFor={id}>
        {label}
      </label>
      <Input
        id={id}
        type="number"
        min="0"
        max={field.max}
        step={field.step}
        inputMode={field.whole ? "numeric" : "decimal"}
        value={value}
        aria-describedby={describedBy}
        onChange={report}
        onInput={report}
        onBlur={report}
      />
    </div>
  );
}

/**
 * Vormi vaated: joonistab selle, mida `pageView` antud oleku kohta tagastab, ja
 * saadab iga sisestuse `dispatch` kaudu lehe olekusse. `day` on testi jaoks;
 * leht jätab selle andmata ja arvutus võtab tänase kuupäeva.
 */
export function SubsistenceViews({ state, dispatch, leaveAsked = false, leaveRef, day }) {
  const { t, locale } = useI18n();
  const hintId = useId();

  /* Kui vaated lähevad ekraanilt (seanss lõppes), kaob koos väljadega ka nendel
     seisnud loetamatu tekst: märgid võetakse maha, muidu keelduks leht pärast
     tagasitulekut tühjade väljade pärast. Sisestatud arvud jäävad alles. */
  useEffect(() => () => dispatch({ type: "fieldsGone" }), [dispatch]);

  const view = pageView(state, locale, day);
  const steps = view.steps.map((step) => ({
    key: step.key,
    label: t(step.titleKey),
    short: t(step.shortKey),
    state: step.state,
    summary: (step.summaryKey ? t(step.summaryKey, step.summaryVars) : step.summary) || undefined,
    free: step.free
  }));
  const answers = ANSWER_CHOICES.map((choice) => ({ value: choice.value, label: t(choice.labelKey) }));
  const numberFields = (viewKey) => (
    <div className={styles.fields}>
      {VIEW_FIELDS[viewKey].map((field) => (
        <NumberField
          key={field.id}
          field={field}
          label={t(field.labelKey)}
          describedBy={field.hint ? `${hintId}-${field.hint}` : undefined}
          value={fieldValue(state, field)}
          onReport={(target) => dispatch(fieldAction(field, target))}
        />
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
              {numberFields("family")}
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
              {numberFields("income")}
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
              {numberFields("housing")}
              <p className={styles.hint} id={`${hintId}-rooms`}>
                {t("subsistence.hints.rooms")}
              </p>
              {/* Märge käib üksi elava inimese kohta: mitme pereliikmega arvutus seda ei kasuta, seega seda siis ei pakuta. */}
              {view.singleOccupant.shown ? (
                <div className={styles.check}>
                  <CheckCard title={t("subsistence.fields.single_occupant")} checked={view.singleOccupant.checked} onChange={(checked) => dispatch({ type: "singleOccupant", checked })} />
                </div>
              ) : null}
            </div>
          </StepPanel>
        );
      case "costs":
        return (
          <StepPanel title={t("subsistence.views.costs.title")} question={t("subsistence.views.costs.question")} note={t("subsistence.views.costs.note")}>
            {numberFields("costs")}
          </StepPanel>
        );
      case "utilities":
        return (
          <StepPanel title={t("subsistence.views.utilities.title")} question={t("subsistence.views.utilities.question")} note={t("subsistence.views.costs.note")}>
            {numberFields("utilities")}
          </StepPanel>
        );
      case "gates":
        return (
          <StepPanel title={t("subsistence.views.gates.title")} question={view.gates.length ? undefined : t("subsistence.views.gates.none")}>
            <div className={styles.gates}>
              {view.gates.map((question) => (
                <div key={question.field} className={styles.gate} role="group" aria-describedby={question.conditions ? `${hintId}-${question.field}` : undefined}>
                  {/* Tingimused seisavad enne vastust: ilma nendeta ei saa küsimusele vastata. */}
                  {question.conditions ? (
                    <ol className={styles.conditions} id={`${hintId}-${question.field}`}>
                      {question.conditions.map((conditionKey) => (
                        <li key={conditionKey}>{t(conditionKey)}</li>
                      ))}
                    </ol>
                  ) : null}
                  <ChoiceRow label={t(question.text)} layout="scale" options={answers} value={question.choice} onChange={(choice) => dispatch(answerAction(question, choice))} />
                  {question.hint ? <p className={styles.hint}>{t(question.hint)}</p> : null}
                </div>
              ))}
            </div>
          </StepPanel>
        );
      default:
        /* Tulemus arvutatakse sisestatust kohe: eraldi nuppu ei ole. Kui summat
           ei saa ohutult anda, seisab siin see, mis puudu on (fail-closed).
           Summa avab vaate: sammu nime („Eelhinnang") ütleb kiirmenüü. Mõlemad
           vaated joonistavad ainult seda, mis on `view.result` sees. */
        return view.result.usable ? (
          <StepPanel title={t("subsistence.views.result.title")} note={t("subsistence.not_a_decision")}>
            <div className={styles.stack} aria-live="polite">
              <p className={styles.amount}>{view.result.amount}</p>
              <dl className={styles.facts}>
                {view.result.facts.map((fact) => (
                  <div key={fact.id} className={styles.fact}>
                    <dt className={styles.factLabel}>{viewText(fact, t, locale)}</dt>
                    <dd className={styles.factValue}>{fact.value}</dd>
                  </div>
                ))}
              </dl>
              {view.result.sentences.map((sentence) => (
                <p key={sentence.id} className={sentence.tone === "caveat" ? styles.caveat : styles.quiet}>
                  {viewText(sentence, t, locale)}
                </p>
              ))}
            </div>
          </StepPanel>
        ) : (
          <StepPanel title={t("subsistence.views.result.title")} question={t("subsistence.result.incomplete")}>
            <ul className={styles.issues} aria-live="polite">
              {view.result.rows.map((row) => (
                <li key={row.id} className={styles.issue}>
                  {viewText(row, t, locale)}
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
      {/* Kuupäeva puudujääk (päeva ei saa lugeda, seadme kell on varasemas aastas või selle aasta määra ei ole):
          ükski sisestus ei aita, seega öeldakse seda kohe, mitte alles seitsmendas vaates. */}
      {view.banner ? <p className={styles.leave}>{t(view.banner)}</p> : null}
      <StepFlight label={t("subsistence.title")} steps={steps}>
        {(step) => renderView(step.key)}
      </StepFlight>
    </section>
  );
}

export default function SubsistenceCalculator() {
  const { t } = useI18n();
  const { status } = useSession();
  /* Vorm, kulud ja loetamatute väljade märgid ühes olekus: tulemus arvutatakse
     alati kõigist kolmest korraga. */
  const [state, dispatch] = useReducer(pageReducer, EMPTY_STATE);
  const [leaveAsked, setLeaveAsked] = useState(false);
  const leaveRef = useRef(null);

  /* Leht ei salvesta midagi (see on lubadus), seega kaoks kogemata lahkumisel
     kuni kakskümmend sisestatud arvu ilma ühegi sõnata. Kui midagi on sisestatud,
     peab kiirmenüü tagasinool ja Esc esimese vajutuse kinni ja lava kohal seisab
     põhjus; teine vajutus lahkub (lib/panelLeaveGuard.js). Akna sulgemise ja uuesti
     laadimise peab kinni brauseri enda küsimus. Brauseri tagasinuppu ja
     väljalogimist see ei kata. Värav on olemas ainult siis, kui vorm on ees:
     lõppenud seansi korral on ees sisselogimise vaade ja teadet ei oleks kus näidata. */
  const guarded = leaveGuarded(status, state);
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
    return armLeaveGuard({ leave, register: setPanelLeaveGuard, target: window });
  }, [guarded]);

  const screen = pageScreen(status);
  if (screen === "loading") {
    return <p className={styles.quiet}>{t("subsistence.loading")}</p>;
  }

  // Konto on nõutav (omanik 04.08). Arvutus ise jääb sellegipoolest brauserisse:
  // sisselogimine avab lehe, aga ei tee sisestatud andmeid serverile nähtavaks.
  // Need kaks on eri asjad ja teine neist ei tohi esimesega kaduda.
  if (screen === "login") {
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

  return <SubsistenceViews state={state} dispatch={dispatch} leaveAsked={leaveAsked} leaveRef={leaveRef} />;
}
