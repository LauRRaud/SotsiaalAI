"use client";

/**
 * Vaade 3b „Kutsutu vastamisvaade" (Q2.6). Kutsutu näeb AINULT pealkirja,
 * superviisori nime, tüüpi ja aktiivset kontraktiteksti: see piir tuleb
 * serveri KUT-serializer'ist, siin seda ei laiendata. Aegunud versioon → 409
 * ja UUS tekst laetakse enne, kui kasutaja saab uuesti kinnitada.
 *
 * KUJU (09.10). Kaart oli klaaskast klaaspaneeli sees. Nüüd on see kolm
 * väikest sammu sammulaval (`components/stage/StepFlight.jsx`): kutse,
 * kontrakt, vastus. Vaated on failis ./entry/InvitedViews.jsx.
 *
 * KEELDUMINE KÜSIB TEIST VAJUTUST. Keeldumist ei saa tagasi võtta: osalus
 * jääb serveris keeldunuks ja sama inimest ei saa samasse protsessi uuesti
 * kutsuda. Vana kaart keeldus ühe vajutusega.
 *
 * PÄRAST KEELDUMIST EI LAETA PROTSESSI UUESTI. Keeldunu ei ole enam protsessi
 * vaataja, server vastab 404 ja protsessi leht asendas selle kaardi lausega
 * „Ei leitud või sul pole ligipääsu": kinnitust „Oled kutsest keeldunud" ei
 * näinud keegi. Nüüd jääb kinnitus ette koos teega tagasi.
 *
 * Selle kaardi joonistab protsessi leht (`SupervisionProcessPage.jsx`), kui
 * vaataja roll on KUT.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useI18n } from "@/components/i18n/I18nProvider";
import StepFlight from "@/components/stage/StepFlight";
import Button from "@/components/ui/Button";

import { AnswerView, ContractView, DeclinedNote, InviteView } from "./entry/InvitedViews";
import { INVITED_STEP_KEYS, SUPERVISION_HOME_HREF, excerpt, typeLabel } from "./entry/entryRows";
import styles from "./entry/entry.module.css";
import { isConflict, supervisionMessage, supervisionRequest } from "./supervisionClient";

/* Teine vajutus keeldumiseks peab tulema selle aja sees. */
const CONFIRM_MS = 8000;

export default function SupervisionInvitedCard({ process, onDone }) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [declined, setDeclined] = useState(process?.myParticipation?.status === "DECLINED");
  const [view, setView] = useState(INVITED_STEP_KEYS[0]);
  const [confirming, setConfirming] = useState(false);
  const confirmTimer = useRef(0);
  const armConfirm = useCallback(() => {
    window.clearTimeout(confirmTimer.current);
    setConfirming(true);
    confirmTimer.current = window.setTimeout(() => setConfirming(false), CONFIRM_MS);
  }, []);
  useEffect(() => () => window.clearTimeout(confirmTimer.current), []);

  const respond = useCallback(async (action) => {
    setBusy(action);
    setMessage("");
    try {
      const { ok, status, payload } = await supervisionRequest(
        `/api/supervision/participations/${encodeURIComponent(process.myParticipation.id)}/respond`,
        {
          method: "POST",
          body: action === "accept"
            ? { action, contractVersionId: process.activeContract?.id || "" }
            : { action }
        }
      );
      if (!ok) {
        if (isConflict(status)) {
          setMessage(t("supervision.common.conflictReload"));
          // Konflikt = kontraktiversioon vahetus: too värske tekst kohe ja vii
          // kinnitaja selle juurde, enne kui ta saab uuesti kinnitada.
          if (action === "accept") setView("contract");
          await onDone?.();
          return;
        }
        setMessage(supervisionMessage({ status, payload, t, fallbackKey: "supervision.errors.save_failed" }));
        return;
      }
      if (action === "decline") {
        setDeclined(true);
        return;
      }
      await onDone?.();
    } catch {
      setMessage(t("supervision.errors.save_failed"));
    } finally {
      window.clearTimeout(confirmTimer.current);
      setConfirming(false);
      setBusy("");
    }
  }, [onDone, process, t]);

  const toHome = (
    <Button type="button" size="sm" variant="secondary" onClick={() => router.push(SUPERVISION_HOME_HREF)}>
      {t("supervision.invited.toHome")}
    </Button>
  );

  if (declined) {
    return (
      <section className={styles.shell}>
        <h1 className="sr-only">{t("supervision.invited.title")}</h1>
        <DeclinedNote t={t} action={toHome} />
      </section>
    );
  }

  const contract = process.activeContract || null;
  const steps = INVITED_STEP_KEYS.map((key) => ({
    key,
    label: t(`supervision.invited.views.${key}.title`),
    short: t(`supervision.invited.views.${key}.short`),
    /* Kutse on loetav kohe ja kontrakt siis, kui see on olemas: nool edasi
       süttib. Vastus jääb inimese teha. */
    state: key === "invite" || (key === "contract" && contract) ? "done" : "empty",
    summary: key === "invite" ? process.title : key === "contract" && contract ? excerpt(contract.body, 90) : undefined,
    /* Kontrakt võib olla pikk tekst: tema järgi ühist kõrgust ei võeta. */
    free: key === "contract"
  }));

  const renderView = (step) => {
    switch (step.key) {
      case "contract":
        return <ContractView t={t} contract={contract} note={message} />;
      case "answer":
        return (
          <AnswerView
            t={t}
            note={message}
            accept={{
              title: busy === "accept" ? t("supervision.common.saving") : t("supervision.invited.accept"),
              description: contract
                ? t("supervision.invited.acceptHint", { n: contract.versionNumber })
                : t("supervision.invited.acceptWaits"),
              disabled: Boolean(busy) || !contract,
              onClick: () => respond("accept")
            }}
            decline={{
              title: confirming ? t("supervision.invited.declineConfirm") : t("supervision.invited.decline"),
              description: confirming ? t("supervision.invited.declineConfirmHint") : t("supervision.invited.declineHint"),
              disabled: Boolean(busy),
              onClick: () => (confirming ? respond("decline") : armConfirm())
            }}
          />
        );
      default:
        return (
          <InviteView
            t={t}
            title={process.title}
            typeText={typeLabel(process.type, t)}
            supervisor={process.supervisorName ? t("supervision.home.supervisor", { name: process.supervisorName }) : ""}
            actions={toHome}
          />
        );
    }
  };

  return (
    <section className={styles.shell}>
      <h1 className="sr-only">{t("supervision.invited.title")}</h1>
      <StepFlight flat
        label={t("supervision.invited.title")}
        steps={steps}
        activeKey={view}
        onStepChange={(index, step) => {
          if (step) setView(step.key);
        }}
      >
        {renderView}
      </StepFlight>
    </section>
  );
}
