"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import ContentTrustBadge from "@/components/ui/ContentTrustBadge";
import { formatQuickCheckFactor } from "@/lib/wellbeing/quickCheck";
import { WellbeingOutputCard as OutputCard } from "./WellbeingControls";

const signalLabels = {
  green: "Roheline",
  yellow: "Kollane",
  red: "Punane",
  insufficient_data: "Andmeid vähe"
};

const workflowLabels = {
  "quick-check": "Kiirkontroll",
  "hard-case": "Raske juhtum",
  "workplace-violence": "Töövägivald",
  recovery: "Taastumine",
  "work-boundaries": "Tööpiirid",
  interruptions: "Katkestused",
  "work-processes": "Tööprotsessid",
  "role-boundaries": "Rollipiirid",
  "starter-support": "Alustaja tugi",
  covision: "Kovisioon"
};

function stripManagerMemoHeading(value) {
  const text = String(value || "").trim();
  return text.replace(/^Juhiga jagatav memo\s*/i, "").trimStart();
}

export default function OverviewWorkflow() {
  const { t } = useI18n();
  const periodOptions = [
    { key: "all", label: t("wellbeing.overview.period_all", "Kõik") },
    { key: "week", label: t("wellbeing.overview.period_week", "Nädal") },
    { key: "month", label: t("wellbeing.overview.period_month", "Kuu") }
  ];
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

  const periodSignal = overview?.periodSignal || "insufficient_data";
  const recordCount = overview?.recordCount || 0;
  const quickCheckCount = overview?.quickCheckCount || 0;
  const signalCounts = overview?.signalCounts || { green: 0, yellow: 0, red: 0 };
  const managerMemo = overview?.managerMemo;
  const memoText = editedMemo || stripManagerMemoHeading(managerMemo?.text || "");

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

  return (
    <div>
      <section aria-labelledby="wellbeing-overview-heading">
        <div>
          <h2 id="wellbeing-overview-heading">{t("wellbeing.overview.title", "Ülevaade")}</h2>
          <p>
            {t(
              "wellbeing.overview.intro",
              "Ülevaade koondab sinu privaatsed tööheaolu sisestused ja näitab töö nõudmiste, ressursside ning korduvate mustrite seisu."
            )}
          </p>
        </div>
        <div>
          <span>{signalLabels[periodSignal] || signalLabels.insufficient_data}</span>
          <p>{t("wellbeing.overview.record_count", "Töövoo kirjeid")}: {recordCount}</p>
          <p>{t("wellbeing.overview.quick_check_count", "Kiirkontrolle")}: {quickCheckCount}</p>
          <p>{t("wellbeing.overview.period_label", "Periood")}: {overview?.period?.label || periodOptions.find((option) => option.key === selectedPeriod)?.label}</p>
        </div>
      </section>

      <div aria-label={t("wellbeing.overview.period_label", "Periood")}>
        {periodOptions.map((option) => (
          <Button
            key={option.key}
            type="button"
            size="sm"
            aria-pressed={selectedPeriod === option.key}
            onClick={() => setSelectedPeriod(option.key)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {status === "error" ? (
        <p>{t("wellbeing.overview.load_failed", "Ülevaate laadimine ebaõnnestus.")}</p>
      ) : null}

      <section aria-labelledby="wellbeing-overview-output">
        <h3 id="wellbeing-overview-output">{t("wellbeing.overview.patterns", "Mustrid")}</h3>
        <div>
          <div>
            <h4>{t("wellbeing.overview.signals", "Signaalid")}</h4>
            <ul>
              <li>{signalLabels.green}: {signalCounts.green}</li>
              <li>{signalLabels.yellow}: {signalCounts.yellow}</li>
              <li>{signalLabels.red}: {signalCounts.red}</li>
            </ul>
          </div>
          <OverviewList
            title={t("wellbeing.overview.work_demands", "Töö nõudmised")}
            items={overview?.workDemands || overview?.topLoadFactors || []}
            emptyText={status === "loading" ? t("wellbeing.overview.loading", "Laadin...") : t("wellbeing.overview.no_load_factors", "Koormustegureid ei ole veel piisavalt.")}
          />
          <OverviewList
            title={t("wellbeing.overview.work_resources", "Tööressursid")}
            items={overview?.workResources || overview?.topResourceFactors || []}
            emptyText={status === "loading" ? t("wellbeing.overview.loading", "Laadin...") : t("wellbeing.overview.no_resource_factors", "Ressursipuudujääke ei ole veel piisavalt.")}
          />
          <OverviewList
            title={t("wellbeing.overview.risk_events", "Riskisündmused")}
            items={overview?.riskEvents || overview?.riskMarkers || []}
            emptyText={status === "loading" ? t("wellbeing.overview.loading", "Laadin...") : t("wellbeing.overview.no_risk_markers", "Riskimustreid ei ole veel piisavalt.")}
          />
          <WorkflowList
            title={t("wellbeing.overview.workflow_counts", "Töövood")}
            items={overview?.workflowCounts || []}
            emptyText={status === "loading" ? t("wellbeing.overview.loading", "Laadin...") : t("wellbeing.overview.no_workflows", "Töövoo kirjeid ei ole veel.")}
          />
        </div>
      </section>

      <section aria-labelledby="wellbeing-overview-manager-memo">
        <h3 id="wellbeing-overview-manager-memo">
          {t("wellbeing.overview.manager_memo", "Juhiga jagatav memo")}
        </h3>
        <div>
          <OutputCard
            title={t("wellbeing.overview.manager_memo_summary", "Koondatud ülevaade")}
            value={managerMemo?.text || t("wellbeing.overview.no_manager_memo", "Memo tekib siis, kui tööheaolu kirjeid on olemas.")}
            stripTitles={["Juhiga jagatav memo"]}
          />
        </div>
        <div>
          <ContentTrustBadge
            generatedText={draft?.generatedText || managerMemo?.text || ""}
            editedText={draft?.editedText}
            currentText={memoText}
            userConfirmed={draft?.userConfirmed === true}
          />
          <label>
            <span>{t("wellbeing.overview.memo_preview_label", "Memo mustand")}</span>
            <textarea
              value={memoText}
              onChange={(event) => {
                setEditedMemo(event.target.value);
                setUserReviewed(false);
                setUserConfirmed(false);
                if (draft?.id) setDraftStatus("editing");
              }}
              rows={11}
              maxLength={4000}
            />
          </label>
          <div>
            <label>
              <input
                type="checkbox"
                checked={userReviewed}
                onChange={(event) => setUserReviewed(event.target.checked)}
              />
              {t("wellbeing.overview.reviewed", "Olen memo üle vaadanud ja liigsed detailid eemaldanud.")}
            </label>
            <label>
              <input
                type="checkbox"
                checked={userConfirmed}
                onChange={(event) => setUserConfirmed(event.target.checked)}
              />
              {t("wellbeing.overview.confirmed", "Kinnitan, et see versioon sobib juhiga arutelu sisendiks.")}
            </label>
          </div>
          <div>
            <Button
              type="button"
              onClick={saveManagerMemoDraft}
              disabled={!String(memoText || "").trim() || draftStatus === "saving"}
            >
              {t("wellbeing.overview.save_memo_draft", "Salvesta memo mustand")}
            </Button>
            <Button
              type="button"
              onClick={confirmManagerMemoDraft}
              disabled={!draft?.id || !userReviewed || !userConfirmed || draftStatus === "saving"}
            >
              {t("wellbeing.overview.confirm_memo_draft", "Kinnita jagatav memo")}
            </Button>
          </div>
          <p role="status">
            {draftStatus === "draft_saved"
              ? t("wellbeing.overview.memo_draft_saved", "Memo mustand salvestati privaatselt. Enne kasutamist kinnita jagatav versioon.")
              : draftStatus === "ready"
                ? t("wellbeing.overview.memo_draft_ready", "Juhiga jagatav memo on kinnitatud, kuid seda ei saadeta automaatselt.")
                : draftStatus === "conflict"
                  ? t("wellbeing.overview.memo_draft_conflict", "Memo mustand muutus teises vaates. Kopeeri oma parandused, laadi Ülevaade uuesti ja proovi värske versiooniga.")
                : draftStatus === "error"
                  ? t("wellbeing.overview.memo_draft_error", "Memo mustandi salvestamine või kinnitamine ebaõnnestus.")
                  : ""}
          </p>
        </div>
      </section>

      <section aria-labelledby="wellbeing-overview-actions">
        <h3 id="wellbeing-overview-actions">{t("wellbeing.overview.next_steps", "Soovitatud järgmised töövood")}</h3>
        {(overview?.recommendedWorkflowTypes || []).length > 0 ? (
          <ul>
            {overview.recommendedWorkflowTypes.map((workflowType) => (
              <li key={workflowType}>{workflowType}</li>
            ))}
          </ul>
        ) : (
          <p>{t("wellbeing.overview.no_actions", "Salvesta mõned kiirkontrollid, et soovitused tekiksid sinu andmete põhjal.")}</p>
        )}
      </section>

      <p>
        {t(
          "wellbeing.overview.privacy",
          "Ülevaade kasutab sinu privaatseid sisestusi. Juhiga jagatav memo on koondatud tekst, mida ei saadeta automaatselt."
        )}
      </p>
    </div>
  );
}

function WorkflowList({ title, items, emptyText }) {
  return (
    <div>
      <h4>{title}</h4>
      {items.length > 0 ? (
        <ul>
          {items.map((item) => (
            <li key={item.workflowType}>{item.label || workflowLabels[item.workflowType] || item.workflowType}: {item.count}</li>
          ))}
        </ul>
      ) : (
        <p>{emptyText}</p>
      )}
    </div>
  );
}

function OverviewList({ title, items, emptyText }) {
  return (
    <div>
      <h4>{title}</h4>
      {items.length > 0 ? (
        <ul>
          {items.map((item) => (
            <li key={item.key}>{item.label || formatQuickCheckFactor(item.key)}: {item.count}</li>
          ))}
        </ul>
      ) : (
        <p>{emptyText}</p>
      )}
    </div>
  );
}
