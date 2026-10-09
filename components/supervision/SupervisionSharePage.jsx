"use client";

/**
 * Vaade 5 „Jagamise eelvaade" = LÄVI (Q2.6): tee `/supervisioon/[id]/jaga?item=<id>`.
 *
 * Kaheastmeline TEADLIK värav: eelvaade näitab TÄPSELT need väljad, mis
 * serverisse lähevad (pealkiri, sisu, sihtrühm; `shareTopic` allowlist), ja
 * nimeliselt selle, KES neid pärast näeb. Ükski väli ei jõua siit edasi
 * vaikselt: manifest ON kirje ise (külmutatud koopia), seega mida siin näed,
 * seda jagad.
 *
 * KUJU (09.10). Leht oli klaaskast klaaspaneeli sees: pealkiri, rippvalik,
 * manifesti kast ja nupud ühes veerus. Nüüd on see kolm väikest sammu
 * sammulaval (`components/stage/StepFlight.jsx`): mis läheb, kellele, kinnitus.
 * Värava kaks astet on alles: viimase sammu „Jagan teadlikult" küsib teist
 * vajutust. Vaated on failis ./process/GateViews.jsx.
 *
 * PÄRAST JAGAMIST avaneb protsessi laud jagatud teemade osas, kus jagatu on
 * näha ja kust autor saab jagamise tagasi võtta. Vana leht viis tagasi
 * eeskambrisse ja jagatud teemat ei näidanud ükski vaade.
 *
 * JUBA JAGATUD KIRJE. Server lubab eeskambri kirjest teha ühe jagatud teema.
 * Vana leht näitas sellise kirje eelvaadet ikka ja jagamine lõppes üldise
 * vealausega; nüüd ütleb leht kohe, et kirje on juba jagatud.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useI18n } from "@/components/i18n/I18nProvider";
import StepFlight from "@/components/stage/StepFlight";
import Button from "@/components/ui/Button";

import { Problem } from "./entry/EntryBits";
import { excerpt } from "./entry/entryRows";
import { ShareAudienceView, ShareConfirmView, ShareContentView } from "./process/GateViews";
import styles from "./process/process.module.css";
import {
  PART,
  SHARE_AUDIENCE_DEFAULT,
  SHARE_STEP_KEYS,
  TOPIC_AUDIENCES,
  audienceLabel,
  audiencePrivacy,
  partHref,
  shareAudienceNames,
  shareBody,
  shareTitleOf
} from "./process/processRows";
import { isConflict, supervisionMessage, supervisionRequest } from "./supervisionClient";

export default function SupervisionSharePage({ processId }) {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const itemId = searchParams.get("item") || "";

  const [process, setProcess] = useState(null);
  const [item, setItem] = useState(null);
  const [audience, setAudience] = useState(SHARE_AUDIENCE_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");
  const [notReady, setNotReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const running = useRef(false);

  const load = useCallback(
    async (signal) => {
      setLoadError("");
      setNotReady(false);
      try {
        const [detail, privateItems] = await Promise.all([
          supervisionRequest(`/api/supervision/processes/${encodeURIComponent(processId)}`, { signal }),
          supervisionRequest(`/api/supervision/processes/${encodeURIComponent(processId)}/private-items`, { signal })
        ]);
        if (signal?.aborted) return;
        if (!detail.ok) {
          setLoadError(supervisionMessage({ status: detail.status, payload: detail.payload, t }));
          return;
        }
        setProcess(detail.payload?.process || null);
        if (!detail.payload?.process?.capabilities?.canShareTopic) setNotReady(true);
        if (privateItems.ok) {
          const found = (privateItems.payload?.items || []).find((row) => row.id === itemId);
          setItem(found || null);
          if (!found) setLoadError(t("supervision.common.notFound"));
        } else {
          setLoadError(supervisionMessage({ status: privateItems.status, payload: privateItems.payload, t }));
        }
      } catch (error) {
        if (error?.name === "AbortError" || signal?.aborted) return;
        setLoadError(t("supervision.errors.load_failed"));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [itemId, processId, t]
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  /** Kes NÄEVAD pärast jagamist: nimeliselt, mitte „osalejad" üldiselt. */
  const names = useMemo(() => shareAudienceNames(process, audience), [audience, process]);
  const privacy = useMemo(() => audiencePrivacy(process, audience), [audience, process]);
  /* Server NÕUAB pealkirja; pealkirjata kirjel tuletatakse see sisust ÜHES kohas
     ja eelvaade näitab täpselt seda väärtust (`shareTitleOf`). */
  const shareTitle = useMemo(() => shareTitleOf(item), [item]);

  const share = useCallback(async () => {
    if (!item || running.current) return;
    running.current = true;
    setSaving(true);
    setMessage("");
    /* Õnnestumise järel jääb nupp lukku, kuni leht vahetub: teine jagamine
       annaks juba jagatud kirje vea. */
    let shared = false;
    try {
      const { ok, status, payload } = await supervisionRequest(`/api/supervision/processes/${encodeURIComponent(processId)}/topics`, {
        method: "POST",
        body: shareBody(item, audience)
      });
      if (!ok) {
        // 409 CONTRACT_NOT_ACCEPTED (OS†) on OMA olek: kasutaja peab enne
        // kehtiva kontraktiversiooni kinnitama, mitte „proovi uuesti".
        if (isConflict(status) && payload?.messageKey === "supervision.errors.contract_not_accepted") {
          setNotReady(true);
          return;
        }
        setMessage(supervisionMessage({ status, payload, t, fallbackKey: "supervision.errors.save_failed" }));
        return;
      }
      shared = true;
      router.push(partHref(processId, PART.TOPICS));
    } catch {
      setMessage(t("supervision.errors.save_failed"));
    } finally {
      if (!shared) {
        running.current = false;
        setSaving(false);
      }
    }
  }, [audience, item, processId, router, t]);

  /* Teed tagasi kannavad sihtkoha nime. Nupud, mitte toored ankrud: vana leht
     laadis iga sellise vajutusega kogu rakenduse uuesti. */
  const toAntechamber = () => router.push(partHref(processId, PART.ANTECHAMBER));
  const back = (
    <Button type="button" size="sm" variant="secondary" onClick={toAntechamber}>
      {t("supervision.share.back")}
    </Button>
  );
  const blocked = (text, action) => (
    <div className={styles.state}>
      <Problem text={text} />
      <div className={styles.actions}>
        {action}
        {back}
      </div>
    </div>
  );

  let content;
  if (loading) {
    content = <p className={styles.quiet}>{t("supervision.common.loading")}</p>;
  } else if (loadError) {
    content = blocked(
      loadError,
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
    );
  } else if (notReady) {
    content = blocked(
      t("supervision.share.notReady"),
      <Button type="button" size="sm" variant="secondary" onClick={() => router.push(partHref(processId, PART.CONTRACT))}>
        {t("supervision.process.openContract")}
      </Button>
    );
  } else if (!item) {
    content = blocked(t("supervision.common.notFound"), null);
  } else if (item.sharedTopicId) {
    content = blocked(
      t("supervision.share.alreadyShared"),
      <Button type="button" size="sm" variant="secondary" onClick={() => router.push(partHref(processId, PART.TOPICS))}>
        {t("supervision.share.toTopics")}
      </Button>
    );
  } else {
    const steps = SHARE_STEP_KEYS.map((key) => ({
      key,
      label: t(`supervision.share.views.${key}.title`),
      short: t(`supervision.share.views.${key}.short`),
      /* Sisu on loetav kohe ja sihtrühmal on alati valik: nool edasi süttib.
         Kinnitus jääb inimese teha. */
      state: key === "confirm" ? "empty" : "done",
      summary: key === "content" ? excerpt(shareTitle, 90) : key === "audience" ? audienceLabel(audience, t) : undefined,
      /* Sisu võib olla pikk tekst: tema järgi ühist kõrgust ei võeta. */
      free: key === "content"
    }));
    const renderView = (step, index, flight) => {
      switch (step.key) {
        case "audience":
          return (
            <ShareAudienceView
              t={t}
              options={TOPIC_AUDIENCES.map((value) => ({ value, label: audienceLabel(value, t) }))}
              value={audience}
              onChange={setAudience}
              privacy={privacy}
              names={names}
            />
          );
        case "confirm":
          return (
            <ShareConfirmView
              t={t}
              glow={flight?.isActive !== false}
              facts={[
                { key: "title", label: t("supervision.share.titleLabel"), value: excerpt(shareTitle, 160) },
                { key: "audience", label: t("supervision.share.audienceLabel"), value: audienceLabel(audience, t) }
              ]}
              privacy={privacy}
              names={names}
              note={message}
              busy={saving}
              onShare={share}
              onBack={toAntechamber}
            />
          );
        default:
          return <ShareContentView t={t} title={shareTitle} body={item.body} derived={!item.title} />;
      }
    };
    content = (
      <StepFlight label={t("supervision.share.title")} steps={steps}>
        {renderView}
      </StepFlight>
    );
  }

  return (
    <section className={styles.shell}>
      <h1 className="sr-only">{t("supervision.share.title")}</h1>
      {content}
    </section>
  );
}
