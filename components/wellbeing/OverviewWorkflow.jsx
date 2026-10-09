"use client";

/**
 * Tööheaolu „Ülevaade": töötaja enda sisestuste koond valitud perioodi kohta.
 *
 * KUJU (09.10). Leht oli üks pikk veerg vanal ühisel kihil. Nüüd on see
 * sammulava (`components/stage/StepFlight.jsx`) vaadetena: kokkuvõte, mustrid,
 * memo juhile ja järgmised töövood. Vaated on failis ./overview/OverviewViews.jsx.
 * Siin on andmed, päringud ja see, mis vaateid olekuga seob.
 *
 * Sildid tulevad tõlkekataloogist ja ühisest tööheaolu sõnastikust
 * (`lib/wellbeing/displayLabels.js`); varem olid signaalide ja töövoogude nimed
 * siin eestikeelsete sõnedena ja soovitatud töövood trükiti sisemise nimega
 * („hard-case").
 */

import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import StepFlight from "@/components/stage/StepFlight";
import ContentTrustBadge from "@/components/ui/ContentTrustBadge";
import { wellbeingLabel } from "@/lib/wellbeing/displayLabels";
import { wellbeingTools } from "@/lib/wellbeingTools";

import { wellbeingActionRoute } from "./forms/routes";
import { MemoView, NextWorkflowsView, PatternsView, SummaryView } from "./overview/OverviewViews";

const SIGNAL_TONES = { green: "ok", yellow: "wait", red: "risk", insufficient_data: "quiet" };
const SIGNAL_FALLBACKS = { green: "Roheline", yellow: "Kollane", red: "Punane", insufficient_data: "Andmeid vähe" };
const VIEW_KEYS = ["summary", "patterns", "memo", "next"];
const VIEWS_KEY = "wellbeing.overview.views";

function stripManagerMemoHeading(value) {
  const text = String(value || "").trim();
  return text.replace(/^Juhiga jagatav memo\s*/i, "").trimStart();
}

export default function OverviewWorkflow({ onNavigate }) {
  const { t } = useI18n();
  const [status, setStatus] = useState("loading");
  const [overview, setOverview] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState("all");
  const [draft, setDraft] = useState(null);
  const [editedMemo, setEditedMemo] = useState("");
  const [userReviewed, setUserReviewed] = useState(false);
  const [userConfirmed, setUserConfirmed] = useState(false);
  const [draftStatus, setDraftStatus] = useState("idle");

  useEffect(() => {
    let alive = true;
    async function loadOverview() {
      setStatus("loading");
      try {
        const searchParams = new URLSearchParams();
        searchParams.set("period", selectedPeriod);
        const response = await fetch("/api/wellbeing/overview" + "?" + searchParams.toString(), {
          method: "GET",
          headers: { Accept: "application/json" }
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.ok) throw new Error(payload?.message || "wellbeing.errors.overview_failed");
        if (alive) {
          setOverview(payload.overview);
          setDraft(null);
          setEditedMemo("");
          setUserReviewed(false);
          setUserConfirmed(false);
          setDraftStatus("idle");
          setStatus("ready");
        }
      } catch {
        if (alive) setStatus("error");
      }
    }

    loadOverview();
    return () => {
      alive = false;
    };
  }, [selectedPeriod]);

  const periodSignal = SIGNAL_TONES[overview?.periodSignal] ? overview.periodSignal : "insufficient_data";
  const signalCounts = overview?.signalCounts || { green: 0, yellow: 0, red: 0 };
  const managerMemo = overview?.managerMemo;
  const memoText = editedMemo || stripManagerMemoHeading(managerMemo?.text || "");
  const signalLabel = (level) => t(`wellbeing.my_records.signal_level.${level}`, SIGNAL_FALLBACKS[level] || level);
  /* Töövoo nimi kataloogist; kovisioonil on oma kaardi nimi. Tundmatu liik jääb
     tööriistade loendi nime juurde, mitte sisemise võtme juurde. */
  const workflowLabel = (type) =>
    type === "covision"
      ? t("chat.workspace.cards.kovision.title", "Kovisioon")
      : t(`wellbeing.my_records.workflow.${String(type || "").replaceAll("-", "_")}`, wellbeingTools.find((tool) => tool.id === type)?.title || "");
  const factorItems = (items) =>
    (Array.isArray(items) ? items : []).map((item) => ({ key: item.key, label: item.label || wellbeingLabel(item.key), count: item.count }));

  async function saveManagerMemoDraft() {
    const textToSave = String(memoText || "").trim();
    if (!textToSave || draftStatus === "saving") return;
    setDraftStatus("saving");
    try {
      const response = await fetch(
        draft?.id
          ? `/api/wellbeing/output-drafts/${encodeURIComponent(draft.id)}`
          : "/api/wellbeing/output-drafts",
        {
          method: draft?.id ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft?.id
            ? {
              editedText: textToSave,
              expectedUpdatedAt: draft.updatedAt
            }
            : {
              sourceWorkflowType: "overview",
              outputType: "manager_memo",
              recipientType: "manager",
              generatedText: textToSave,
              context: overview
            })
        }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        const error = new Error(payload?.message || "wellbeing.errors.output_draft_failed");
        error.status = response.status;
        throw error;
      }
      setDraft(payload.draft);
      setEditedMemo(stripManagerMemoHeading(
        payload.draft?.editedText || payload.draft?.generatedText || textToSave
      ));
      setUserReviewed(false);
      setUserConfirmed(false);
      setDraftStatus("draft_saved");
    } catch (error) {
      setDraftStatus(Number(error?.status) === 409 ? "conflict" : "error");
    }
  }

  async function confirmManagerMemoDraft() {
    const textToConfirm = String(memoText || "").trim();
    if (!draft?.id || !textToConfirm || !userReviewed || !userConfirmed || draftStatus === "saving") return;
    setDraftStatus("saving");
    try {
      const response = await fetch(`/api/wellbeing/output-drafts/${encodeURIComponent(draft.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editedText: textToConfirm,
          userReviewed,
          userConfirmed,
          expectedUpdatedAt: draft.updatedAt
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        const error = new Error(payload?.message || "wellbeing.errors.output_draft_confirm_failed");
        error.status = response.status;
        throw error;
      }
      setDraft(payload.draft);
      setEditedMemo(stripManagerMemoHeading(payload.draft?.editedText || payload.draft?.generatedText || ""));
      setDraftStatus("ready");
    } catch (error) {
      setDraftStatus(Number(error?.status) === 409 ? "conflict" : "error");
    }
  }

  const recordCount = overview?.recordCount || 0;
  /* Ülevaade ei soovita iseennast: inimene on juba siin. */
  const recommended = (Array.isArray(overview?.recommendedWorkflowTypes) ? overview.recommendedWorkflowTypes : []).filter((type) => type !== "overview");
  const memoStatus = draftStatus === "draft_saved"
    ? t("wellbeing.overview.memo_draft_saved", "Memo mustand salvestati privaatselt. Enne kasutamist kinnita jagatav versioon.")
    : draftStatus === "ready"
      ? t("wellbeing.overview.memo_draft_ready", "Juhiga jagatav memo on kinnitatud, kuid seda ei saadeta automaatselt.")
      : draftStatus === "conflict"
        ? t("wellbeing.overview.memo_draft_conflict", "Memo mustand muutus teises vaates. Kopeeri oma parandused, laadi Ülevaade uuesti ja proovi värske versiooniga.")
        : draftStatus === "error"
          ? t("wellbeing.overview.memo_draft_error", "Memo mustandi salvestamine või kinnitamine ebaõnnestus.")
          : "";

  const steps = VIEW_KEYS.map((key) => ({
    key,
    label: t(`${VIEWS_KEY}.${key}.title`, key),
    short: t(`${VIEWS_KEY}.${key}.short`, key),
    state:
      key === "summary" ? (recordCount ? "done" : "empty")
        : key === "memo" ? (draft?.userConfirmed === true ? "done" : draft?.id ? "partial" : "empty")
          : key === "next" ? (recommended.length ? "partial" : "empty")
            : "empty",
    summary: key === "summary" && status === "ready" ? signalLabel(periodSignal) : undefined,
    /* Mustrid ja memo võivad olla pikad: nende järgi ühist kõrgust ei võeta. */
    free: key === "patterns" || key === "memo" || key === "next"
  }));

  const renderView = (step) => {
    switch (step.key) {
      case "patterns":
        return (
          <PatternsView
            t={t}
            signals={["green", "yellow", "red"].map((level) => ({ key: level, label: signalLabel(level), count: signalCounts[level] || 0, tone: SIGNAL_TONES[level] }))}
            groups={[
              {
                key: "demands",
                title: t("wellbeing.overview.work_demands", "Töö nõudmised"),
                items: factorItems(overview?.workDemands || overview?.topLoadFactors),
                empty: t("wellbeing.overview.no_load_factors", "Koormustegureid ei ole veel piisavalt.")
              },
              {
                key: "resources",
                title: t("wellbeing.overview.work_resources", "Tööressursid"),
                items: factorItems(overview?.workResources || overview?.topResourceFactors),
                empty: t("wellbeing.overview.no_resource_factors", "Ressursipuudujääke ei ole veel piisavalt.")
              },
              {
                key: "risks",
                title: t("wellbeing.overview.risk_events", "Riskisündmused"),
                items: factorItems(overview?.riskEvents || overview?.riskMarkers),
                empty: t("wellbeing.overview.no_risk_markers", "Riskimustreid ei ole veel piisavalt.")
              }
            ]}
          />
        );
      case "memo":
        return (
          <MemoView
            t={t}
            empty={!memoText && !managerMemo?.text}
            badge={
              <ContentTrustBadge
                generatedText={draft?.generatedText || managerMemo?.text || ""}
                editedText={draft?.editedText}
                currentText={memoText}
                userConfirmed={draft?.userConfirmed === true}
              />
            }
            text={memoText}
            onText={(value) => {
              setEditedMemo(value);
              setUserReviewed(false);
              setUserConfirmed(false);
              if (draft?.id) setDraftStatus("editing");
            }}
            reviewed={userReviewed}
            onReviewed={setUserReviewed}
            confirmed={userConfirmed}
            onConfirmed={setUserConfirmed}
            status={memoStatus}
            save={{ disabled: !String(memoText || "").trim() || draftStatus === "saving", onClick: saveManagerMemoDraft }}
            confirm={{ disabled: !draft?.id || !userReviewed || !userConfirmed || draftStatus === "saving", onClick: confirmManagerMemoDraft }}
          />
        );
      case "next":
        return (
          <NextWorkflowsView
            t={t}
            items={recommended.map((type) => ({
              key: type,
              title: workflowLabel(type) || type,
              description:
                type === "covision"
                  ? t("wellbeing.overview.views.next.covision", "Aruta olukorda kolleegidega struktureeritud kohtumisel.")
                  : wellbeingTools.find((tool) => tool.id === type)?.description || "",
              onClick: () => onNavigate?.(wellbeingActionRoute(type))
            }))}
          />
        );
      default:
        return (
          <SummaryView
            t={t}
            loading={status === "loading" && !overview}
            failed={status === "error"}
            period={{
              value: selectedPeriod,
              onChange: setSelectedPeriod,
              options: ["all", "week", "month"].map((key) => ({
                value: key,
                label: t(`wellbeing.overview.period_${key}`, key === "all" ? "Kõik" : key === "week" ? "Nädal" : "Kuu")
              }))
            }}
            signal={{ text: signalLabel(periodSignal), tone: SIGNAL_TONES[periodSignal] }}
            counts={[
              { key: "records", label: t("wellbeing.overview.record_count", "Töövoo kirjeid"), value: recordCount },
              { key: "quick", label: t("wellbeing.overview.quick_check_count", "Kiirkontrolle"), value: overview?.quickCheckCount || 0 }
            ]}
            truncated={
              overview?.truncated
                ? t("wellbeing.overview.truncated", "Ülevaade tabas kaitsepiiri ja ei sisalda kõiki selle perioodi kirjeid. Vali lühem periood, et näha tervikpilti.")
                : ""
            }
            workflows={(overview?.workflowCounts || []).map((item) => ({
              key: item.workflowType,
              label: item.label || workflowLabel(item.workflowType) || item.workflowType,
              count: item.count
            }))}
          />
        );
    }
  };

  return (
    <StepFlight label={t("wellbeing.overview.title", "Ülevaade")} steps={steps}>
      {renderView}
    </StepFlight>
  );
}
