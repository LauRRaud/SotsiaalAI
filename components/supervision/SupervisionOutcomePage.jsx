"use client";

/**
 * „Minu isiklik pakk" (M12): tee `/supervisioon/valjundid/[outcomeId]`.
 *
 * Pakk kuulub AINULT omanikule: ka superviisor ei näe teiste omi (server: 404).
 * Sisu on KÜLMUTATUD koopia sulgemishetkest, seega siin ei ole ühtegi
 * muutmisteed.
 *
 * KUJU (09.10). Leht oli üks pikk veerg teise klaaskasti sees. Nüüd on see
 * sammulava (`components/stage/StepFlight.jsx`) osadena: leht avaneb kogu paki
 * vaates (paki nimi, privaatsusmärk ja plaat iga teksti kohta) ja iga tekst
 * (kinnitatud kontrakt, iga kinnitatud kokkuvõte) avaneb omaette vaates. Osad
 * ei ole sammud, seepärast `parts`; kogu paki vaade on paki sisukord ja seega
 * loomulik algus (`startWide`).
 *
 * Viga ja puuduv ligipääs on lause paneelis. Vanal lehel ei olnud vea järel
 * teed uuesti proovida ja tagasi-nuppe oli vea korral kaks.
 *
 * Vaated on failis ./entry/OutcomeViews.jsx, osad teeb ./entry/entryRows.js.
 */

import { useMemo } from "react";
import { useRouter } from "next/navigation";

import { useI18n } from "@/components/i18n/I18nProvider";
import StepFlight from "@/components/stage/StepFlight";
import Button from "@/components/ui/Button";

import { Loaded, Problem } from "./entry/EntryBits";
import { PackLead, PackTextView } from "./entry/OutcomeViews";
import { SUPERVISION_OUTCOMES_HREF, hasSummaries, packParts } from "./entry/entryRows";
import styles from "./entry/entry.module.css";
import useSupervisionLoad from "./entry/useSupervisionLoad";

const pickOutcome = (payload) => (payload?.outcome && typeof payload.outcome === "object" ? payload.outcome : null);

export default function SupervisionOutcomePage({ outcomeId }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const outcome = useSupervisionLoad(`/api/supervision/outcomes/${encodeURIComponent(outcomeId)}`, pickOutcome, t);
  const parts = useMemo(() => packParts(outcome.data, { t, locale }), [locale, outcome.data, t]);

  /* Tee tagasi pakkide loendisse kannab sihtkoha nime, mitte sõna „Tagasi". */
  const back = (
    <Button type="button" size="sm" variant="secondary" onClick={() => router.push(SUPERVISION_OUTCOMES_HREF)}>
      {t("supervision.outcome.list")}
    </Button>
  );
  const title = String(outcome.data?.processTitleGeneralized || "").trim() || t("supervision.outcome.untitled");

  return (
    <section className={styles.shell}>
      <h1 className="sr-only">{t("supervision.outcome.title")}</h1>
      <Loaded t={t} source={{ ...outcome, extra: back }}>
        {!outcome.data ? (
          <div className={styles.state}>
            <Problem text={t("supervision.common.notFound")} />
            {back}
          </div>
        ) : parts.length ? (
          <StepFlight
            key={parts.map((part) => part.key).join("|")}
            label={t("supervision.outcome.title")}
            steps={parts}
            parts
            startWide
            texts={{
              all: t("supervision.outcome.all"),
              position: (current, total, label) => t("supervision.outcome.position", { current, total, label })
            }}
            wideLead={
              <PackLead t={t} title={title} note={hasSummaries(parts) ? "" : t("supervision.outcome.noSummaries")} back={back} />
            }
          >
            {(part) => <PackTextView part={part} />}
          </StepFlight>
        ) : (
          <PackLead t={t} title={title} note={t("supervision.outcome.noContent")} back={back} />
        )}
      </Loaded>
    </section>
  );
}
