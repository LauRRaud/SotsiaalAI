"use client";

/**
 * Supervisiooni laud: minu protsessid, kutsed ja isiklikud paketid.
 *
 * KUJU (09.10). Avaleht oli klaaskast klaaspaneeli sees, suure pealkirja ja
 * kõrgete kaartide võrguga; pakkide loend oli eraldi samasugune leht. Nüüd on
 * see üks laud sammulaval (`components/stage/StepFlight.jsx`): kolm osa, igas
 * üks loend. Osad ei ole sammud, seepärast annab leht lavale `parts`: kiirmenüüs
 * on nupp „Kõik osad" ja avatud osa nimi.
 *
 * LEHT AVANEB SISUGA, mitte kõigi osade vaates: enamasti tullakse siia
 * protsessi avama. Kui mõni kutse ootab vastust, avaneb leht kutsete osas:
 * vanal lehel seisis kutse teiste kaartide vahel ja erines neist ühe märgiga. Tee
 * `/supervisioon/valjundid` avab sama laua pakkide osas (`initialPart`).
 *
 * KAKS PÄRINGUT. Protsessid ja kutsed tulevad ühest loendist
 * (`/api/supervision/processes`), paketid teisest (`/api/supervision/outcomes`).
 * Kumbki osa näitab oma laadimist ja viga ise: pakkide viga ei peida protsesse.
 *
 * Lehe nimi on all kiirmenüüs (kaart „Supervisioon"); pealkiri jääb
 * ekraanilugejale. Vaated on failis ./entry/HomeViews.jsx, read ./entry/entryRows.js.
 *
 * SUPERVISIOONI V0 LEPING ütles „EI uut lõuendimootorit, EI Flight/3D" (SUP-P10).
 * Omanik otsustas 09.10, et kõik alamlehed lähevad sammulavale. Uut mootorit
 * siin ei ole: lava on platvormi olemasolev lend, mis vähendatud liikumise
 * korral vahetab vaateid ristsulandusega. Protsessi leht ise on veel vanal kujul.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useI18n } from "@/components/i18n/I18nProvider";
import StepFlight from "@/components/stage/StepFlight";
import Button from "@/components/ui/Button";

import { DeskLead, InvitesView, OutcomesView, ProcessesView } from "./entry/HomeViews";
import { HOME_PART_KEYS, SUPERVISION_CREATE_HREF, outcomeRows, processRows, splitProcesses, tileSummary } from "./entry/entryRows";
import styles from "./entry/entry.module.css";
import useSupervisionLoad from "./entry/useSupervisionLoad";

const pickProcesses = (payload) => (Array.isArray(payload?.processes) ? payload.processes : []);
const pickOutcomes = (payload) => (Array.isArray(payload?.outcomes) ? payload.outcomes : []);

export default function SupervisionHomePage({ initialPart = "" }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const processes = useSupervisionLoad("/api/supervision/processes", pickProcesses, t);
  const outcomes = useSupervisionLoad("/api/supervision/outcomes", pickOutcomes, t);

  const rows = useMemo(() => {
    const context = { t, locale };
    const split = splitProcesses(processes.data);
    return {
      processes: processRows(split.mine, context),
      invites: processRows(split.invites, context),
      outcomes: outcomeRows(outcomes.data, context)
    };
  }, [locale, outcomes.data, processes.data, t]);

  /* Maandumine otsustatakse üks kord, kui protsesside loend on kohal (või
     ebaõnnestus): lava saab avatud osa ainult loomisel ja hilisem hüpe teise
     ossa viiks inimese sealt ära, kuhu ta just läks. */
  const [landing, setLanding] = useState(HOME_PART_KEYS.includes(initialPart) ? initialPart : "");
  useEffect(() => {
    if (landing || processes.status === "loading") return;
    setLanding(rows.invites.length ? "invites" : "processes");
  }, [landing, processes.status, rows.invites.length]);

  const sources = { processes, invites: processes, outcomes };
  const noneText = {
    processes: t("supervision.home.views.processes.none"),
    invites: t("supervision.home.views.invites.empty"),
    outcomes: t("supervision.outcome.empty")
  };
  const parts = HOME_PART_KEYS.map((key) => {
    const source = sources[key];
    return {
      key,
      label: t(`supervision.home.views.${key}.title`),
      short: t(`supervision.home.views.${key}.short`),
      /* Selge plaat = osas on ridu. See on olemasolu märk, mitte loendur. */
      state: rows[key].length ? "done" : "empty",
      summary:
        source.status === "loading"
          ? t("supervision.common.loading")
          : source.status === "error"
            ? source.error
            : tileSummary({ rows: rows[key], emptyText: noneText[key], moreText: t("supervision.home.moreRows") }),
      /* Loend võib olla pikk: tema järgi ühist kõrgust ei võeta. */
      free: true
    };
  });

  /* Uue protsessi alustamine on protsesside loendi enda tegevus ja seisab ka
     kõigi osade vaate kohal. Nupp, mitte toores ankur: vana `Button as="a"`
     laadis kogu rakenduse uuesti. */
  const newProcess = (
    <Button type="button" size="sm" variant="secondary" onClick={() => router.push(SUPERVISION_CREATE_HREF)}>
      {t("supervision.home.newProcess")}
    </Button>
  );

  return (
    <section className={styles.shell}>
      <h1 className="sr-only">{t("supervision.home.title")}</h1>
      {landing ? (
        <StepFlight
          label={t("supervision.home.title")}
          steps={parts}
          parts
          initialIndex={HOME_PART_KEYS.indexOf(landing)}
          texts={{
            all: t("supervision.home.all"),
            position: (current, total, label) => t("supervision.home.position", { current, total, label })
          }}
          wideLead={<DeskLead t={t} action={newProcess} />}
        >
          {(part) =>
            part.key === "invites" ? (
              <InvitesView t={t} source={processes} rows={rows.invites} />
            ) : part.key === "outcomes" ? (
              <OutcomesView t={t} source={outcomes} rows={rows.outcomes} />
            ) : (
              <ProcessesView t={t} source={processes} rows={rows.processes} action={newProcess} />
            )
          }
        </StepFlight>
      ) : (
        <p className={styles.quiet}>{t("supervision.common.loading")}</p>
      )}
    </section>
  );
}
