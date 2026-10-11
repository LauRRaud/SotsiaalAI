"use client";

/**
 * Vaade 9 „Sulgemise eelvaade" (Q2.6): tee `/supervisioon/[id]/sulge`.
 *
 * Sulgemine on PÖÖRDUMATU: jagatud toorsisu kustub ühes tehingus. Seepärast on
 * siin LOEND, mitte lause (kaks selgelt eristatud tulpa „Kustub" ja „Jääb"),
 * ja kinnitus on kaheastmeline koos üldistatud pealkirja sisestusega (see
 * asendab praeguse pealkirja).
 *
 * 409-d on eristatud: ootel kokkuvõtted annavad OTSELINGID nende juurde; juba
 * suletud protsess suunab suletud vaatesse (mitte veateate taha).
 *
 * KUJU (09.10). Leht oli klaaskast klaaspaneeli sees: kaks kasti, takistuse
 * kast, väli ja nupud ühes veerus. Nüüd on see kolm väikest sammu sammulaval
 * (`components/stage/StepFlight.jsx`): mis kustub ja mis jääb, üldistatud
 * pealkiri, sulgemine. Viimase sammu nupp küsib teist vajutust ja tagajärg
 * seisab nupu kõrval. Vaated on failis ./process/GateViews.jsx.
 *
 * KES EI SAA SULGEDA, näeb ainult loendit: osaleja lausega „Ainult superviisor
 * saab protsessi sulgeda", superviisor ootel kokkuvõtete korral takistust ja
 * ridu, mis viivad iga ootel kokkuvõtte juurde.
 *
 * KUI PEALKIRI ON PUUDU, viib „Sulgen protsessi lõplikult" pealkirja sammu
 * juurde ja ütleb seal, mis puudu on. Vana lehe nupp oli seni lihtsalt hall.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useI18n } from "@/components/i18n/I18nProvider";
import StepFlight from "@/components/stage/StepFlight";
import Button from "@/components/ui/Button";

import { LinkRows, Problem } from "./entry/EntryBits";
import { CloseConfirmView, CloseEffectView, CloseTitleView } from "./process/GateViews";
import styles from "./process/process.module.css";
import { CLOSE_STEP_KEYS, PART, closeEffect, closeTitle, partHref, pendingSummaryRows } from "./process/processRows";
import { isConflict, supervisionMessage, supervisionRequest } from "./supervisionClient";

export default function SupervisionClosePage({ processId }) {
  const { t } = useI18n();
  const router = useRouter();
  const [preview, setPreview] = useState(null);
  const [process, setProcess] = useState(null);
  const [generalizedTitle, setGeneralizedTitle] = useState("");
  const [view, setView] = useState(CLOSE_STEP_KEYS[0]);
  /* Puuduvat pealkirja ei heideta ette enne, kui inimene on proovinud sulgeda. */
  const [checked, setChecked] = useState(false);
  const [pendingIds, setPendingIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const running = useRef(false);

  const closedHref = partHref(processId, PART.CLOSED);

  const load = useCallback(
    async (signal) => {
      setLoadError("");
      try {
        const [previewResult, detail] = await Promise.all([
          supervisionRequest(`/api/supervision/processes/${encodeURIComponent(processId)}/close-preview`, { signal }),
          supervisionRequest(`/api/supervision/processes/${encodeURIComponent(processId)}`, { signal })
        ]);
        if (signal?.aborted) return;
        if (!previewResult.ok) {
          setLoadError(supervisionMessage({ status: previewResult.status, payload: previewResult.payload, t }));
          return;
        }
        setPreview(previewResult.payload?.preview || null);
        setPendingIds(previewResult.payload?.preview?.pendingSummaryIds || []);
        if (detail.ok) setProcess(detail.payload?.process || null);
        if (previewResult.payload?.preview?.alreadyClosed) router.replace(closedHref);
      } catch (error) {
        if (error?.name === "AbortError" || signal?.aborted) return;
        setLoadError(t("supervision.errors.load_failed"));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [closedHref, processId, router, t]
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const close = useCallback(async () => {
    const title = closeTitle(generalizedTitle);
    if (!title.ok) {
      setChecked(true);
      setView("title");
      return;
    }
    /* Sulgemine vajab protsessi versiooni (CAS). Kui protsessi päring ei
       õnnestunud, öeldakse seda ja proovitakse uuesti; vana lehe nupp ei
       teinud sel juhul lihtsalt midagi. */
    if (!process) {
      setMessage(t("supervision.errors.load_failed"));
      void load();
      return;
    }
    if (running.current) return;
    running.current = true;
    setSaving(true);
    setMessage("");
    /* Õnnestumise järel jääb nupp lukku, kuni leht vahetub. */
    let closed = false;
    try {
      const { ok, status, payload } = await supervisionRequest(`/api/supervision/processes/${encodeURIComponent(processId)}/close`, {
        method: "POST",
        body: { expectedVersion: process.version, generalizedTitle: title.title }
      });
      if (!ok) {
        if (isConflict(status) && payload?.messageKey === "supervision.errors.already_closed") {
          closed = true;
          router.replace(closedHref);
          return;
        }
        if (isConflict(status) && payload?.messageKey === "supervision.errors.pending_summaries") {
          await load();
          setMessage(t("supervision.close.pendingBlock"));
          return;
        }
        /* Vananenud versioon: ilma värske seisuta ebaõnnestuks iga järgmine
           vajutus samamoodi, kuni brauseri leht uuesti laetakse. */
        if (isConflict(status)) await load();
        setMessage(supervisionMessage({ status, payload, t, fallbackKey: "supervision.errors.save_failed" }));
        return;
      }
      closed = true;
      /* Suletud protsess avaneb osas „Suletud": mis kustus ja minu isiklik pakk. */
      router.replace(closedHref);
    } catch {
      setMessage(t("supervision.errors.save_failed"));
    } finally {
      if (!closed) {
        running.current = false;
        setSaving(false);
      }
    }
  }, [closedHref, generalizedTitle, load, process, processId, router, t]);

  /* Tee tagasi viib sulgemise osa juurde, kust eelvaatesse tuldi. */
  const toProcess = () => router.push(partHref(processId, PART.CLOSE));
  const back = (
    <Button type="button" size="sm" variant="secondary" onClick={toProcess}>
      {t("supervision.close.toProcess")}
    </Button>
  );

  let content;
  if (loading) {
    content = <p className={styles.quiet}>{t("supervision.common.loading")}</p>;
  } else if (loadError || !preview) {
    content = (
      <div className={styles.state}>
        <Problem text={loadError || t("supervision.common.notFound")} />
        <div className={styles.actions}>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              setLoading(true);
              void load();
            }}
          >
            {t("supervision.common.retry")}
          </Button>
          {back}
        </div>
      </div>
    );
  } else if (!preview.canClose) {
    /* Sulgeda ei saa: loend jääb loetavaks ja takistus on öeldud selle kohal. */
    const pendingRows = pendingSummaryRows(pendingIds, { processId, process, t });
    content = (
      <>
        <div className={styles.state}>
          <Problem text={t(pendingRows.length ? "supervision.close.pendingBlock" : "supervision.close.onlySupervisor")} />
          {pendingRows.length ? <LinkRows rows={pendingRows} openText={t("supervision.home.open")} /> : null}
        </div>
        <CloseEffectView t={t} effect={closeEffect(preview, { t })} actions={back} />
      </>
    );
  } else {
    const title = closeTitle(generalizedTitle);
    const steps = CLOSE_STEP_KEYS.map((key) => ({
      key,
      label: t(`supervision.close.views.${key}.title`),
      short: t(`supervision.close.views.${key}.short`),
      state: key === "effect" || (key === "title" && title.ok) ? "done" : "empty",
      summary: key === "title" ? title.title : undefined
    }));
    const renderView = (step, index, flight) => {
      switch (step.key) {
        case "title":
          return (
            <CloseTitleView
              t={t}
              value={generalizedTitle}
              onChange={setGeneralizedTitle}
              error={checked && !title.ok ? t("supervision.close.titleMissing") : ""}
              currentTitle={process?.title || ""}
              onEnter={flight.next}
            />
          );
        case "close":
          return (
            <CloseConfirmView
              t={t}
              facts={[
                {
                  key: "title",
                  label: t("supervision.close.newTitle"),
                  value: title.title || t("supervision.close.titleNone"),
                  missing: !title.ok
                }
              ]}
              note={message}
              busy={saving}
              onClose={close}
              onBack={toProcess}
            />
          );
        default:
          return <CloseEffectView t={t} effect={closeEffect(preview, { t })} />;
      }
    };
    content = (
      <StepFlight flat
        label={t("supervision.close.title")}
        steps={steps}
        activeKey={view}
        onStepChange={(index, step) => {
          if (step) setView(step.key);
        }}
      >
        {renderView}
      </StepFlight>
    );
  }

  return (
    <section className={styles.shell}>
      <h1 className="sr-only">{t("supervision.close.title")}</h1>
      {content}
    </section>
  );
}
