"use client";

import { useMemo, useRef, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import ContentTrustBadge from "@/components/ui/ContentTrustBadge";
import { createLatestRequestGate, isAbortError } from "@/lib/client/latestRequestGate";
import { buildWellbeingShareableDraft } from "@/lib/wellbeing/supportDraftText";

const supportOptions = [
  {
    outputType: "manager_memo",
    recipientType: "manager",
    labelKey: "wellbeing.support.manager_memo_label",
    labelFallback: "Koosta juhiga arutelu memo",
    descriptionKey: "wellbeing.support.manager_memo_meta",
    descriptionFallback: "Neutraalne kokkuvõte juhiga arutamiseks"
  },
  {
    outputType: "covision_input",
    recipientType: "covision",
    labelKey: "wellbeing.support.covision_input_label",
    labelFallback: "Koosta kovisiooni sisend",
    descriptionKey: "wellbeing.support.covision_input_meta",
    descriptionFallback: "Juhtum, küsimus ja õppimiskoht rühmale"
  },
  {
    outputType: "support_request",
    recipientType: "pilot_support_contact",
    labelKey: "wellbeing.support.support_request_label",
    labelFallback: "Koosta abipalve",
    descriptionKey: "wellbeing.support.support_request_meta",
    descriptionFallback: "Lühike sisend toe või nõu küsimiseks"
  }
];

export default function SupportRequestPanel({
  sourceWorkflowType = "quick-check",
  sourceRecordId = null,
  context,
  onNavigate
}) {
  const { t } = useI18n();
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState(null);
  const [editedText, setEditedText] = useState("");
  const [userReviewed, setUserReviewed] = useState(false);
  const [userConfirmed, setUserConfirmed] = useState(false);
  const [confirmedNoIdentifiers, setConfirmedNoIdentifiers] = useState(false);
  const [status, setStatus] = useState("idle");
  const requestGateRef = useRef(createLatestRequestGate());

  const preview = useMemo(() => {
    if (!selected) return "";
    return buildWellbeingShareableDraft({
      sourceWorkflowType,
      sourceRecordId,
      outputType: selected.outputType,
      recipientType: selected.recipientType,
      context
    }).generatedText;
  }, [context, selected, sourceRecordId, sourceWorkflowType]);
  const savedConfirmedText = String(draft?.editedText || draft?.generatedText || "").trim();
  const hasUnconfirmedEdits = draft?.status === "ready_to_share"
    && String(editedText || preview).trim() !== savedConfirmedText;
  const isBusy = status === "saving" || status === "starting_covision";

  function changeEditedText(value) {
    if (isBusy) return;
    setEditedText(value);
    setUserReviewed(false);
    setUserConfirmed(false);
    setConfirmedNoIdentifiers(false);
    if (draft?.status === "ready_to_share") {
      setStatus(String(value || preview).trim() === savedConfirmedText ? "editing" : "needs_reconfirm");
    } else if (draft?.id) {
      setStatus("editing");
    }
  }

  function chooseOption(option) {
    requestGateRef.current.invalidate();
    setSelected(option);
    setDraft(null);
    setEditedText("");
    setUserReviewed(false);
    setUserConfirmed(false);
    setConfirmedNoIdentifiers(false);
    setStatus("idle");
  }

  function leavePrivate() {
    requestGateRef.current.invalidate();
    setSelected(null);
    setDraft(null);
    setEditedText("");
    setUserReviewed(false);
    setUserConfirmed(false);
    setConfirmedNoIdentifiers(false);
    setStatus("private");
  }

  async function saveDraft() {
    const textToSave = String(editedText || preview).trim();
    if (!selected || !textToSave || isBusy) return;
    const request = requestGateRef.current.begin("save-draft");
    setStatus("saving");
    try {
      const response = await fetch(
        draft?.id
          ? `/api/wellbeing/output-drafts/${encodeURIComponent(draft.id)}`
          : "/api/wellbeing/output-drafts",
        {
        method: draft?.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        signal: request.signal,
        body: JSON.stringify(draft?.id
          ? {
            editedText: textToSave,
            expectedUpdatedAt: draft.updatedAt
          }
          : {
            sourceWorkflowType,
            sourceRecordId,
            outputType: selected.outputType,
            recipientType: selected.recipientType,
            generatedText: textToSave,
            context
          })
      });
      const payload = await response.json().catch(() => ({}));
      if (!request.isCurrent()) return;
      if (!response.ok || !payload?.ok) {
        const error = new Error(payload?.message || "wellbeing.errors.output_draft_failed");
        error.status = response.status;
        throw error;
      }
      setDraft(payload.draft);
      setEditedText(String(payload.draft?.editedText || payload.draft?.generatedText || textToSave));
      setUserReviewed(false);
      setUserConfirmed(false);
      setConfirmedNoIdentifiers(false);
      setStatus("draft_saved");
    } catch (error) {
      if (isAbortError(error) || !request.isCurrent()) return;
      setStatus(Number(error?.status) === 409 ? "draft_conflict" : "error");
    }
  }

  async function confirmDraft() {
    const textToConfirm = String(editedText || preview).trim();
    if (!draft?.id || !textToConfirm || !userReviewed || !userConfirmed || isBusy) return;
    const request = requestGateRef.current.begin("confirm-draft");
    setStatus("saving");
    try {
      const response = await fetch(`/api/wellbeing/output-drafts/${encodeURIComponent(draft.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        signal: request.signal,
        body: JSON.stringify({
          editedText: textToConfirm,
          userReviewed,
          userConfirmed,
          expectedUpdatedAt: draft.updatedAt
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!request.isCurrent()) return;
      if (!response.ok || !payload?.ok) {
        const error = new Error(payload?.message || "wellbeing.errors.output_confirm_failed");
        error.status = response.status;
        throw error;
      }
      setDraft(payload.draft);
      setEditedText(String(payload.draft?.editedText || payload.draft?.generatedText || ""));
      setConfirmedNoIdentifiers(false);
      setStatus("ready");
    } catch (error) {
      if (isAbortError(error) || !request.isCurrent()) return;
      setStatus(Number(error?.status) === 409 ? "draft_conflict" : "error");
    }
  }

  async function startCovision() {
    if (
      !draft?.id
      || !draft?.updatedAt
      || !confirmedNoIdentifiers
      || !userReviewed
      || !userConfirmed
      || hasUnconfirmedEdits
      || isBusy
    ) return;
    const request = requestGateRef.current.begin("start-covision");
    setStatus("starting_covision");
    try {
      const response = await fetch(
        `/api/wellbeing/output-drafts/${encodeURIComponent(draft.id)}/covision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: request.signal,
          body: JSON.stringify({
            expectedUpdatedAt: draft.updatedAt,
            confirmedNoIdentifiers: true
          })
        }
      );
      const payload = await response.json().catch(() => ({}));
      if (!request.isCurrent()) return;
      if (!response.ok || !payload?.ok || !payload?.covisionCaseId) {
        const error = new Error(payload?.message || "wellbeing.errors.covision_handoff_failed");
        error.status = response.status;
        throw error;
      }
      const href = `/kovisioon?case=${encodeURIComponent(payload.covisionCaseId)}`;
      setStatus("covision_started");
      if (typeof onNavigate === "function") onNavigate(href);
      else window.location.assign(href);
    } catch (error) {
      if (isAbortError(error) || !request.isCurrent()) return;
      setStatus(
        error?.message === "wellbeing.errors.identifiers_detected"
          ? "covision_identifiers"
          : Number(error?.status) === 409
            ? "covision_conflict"
            : "covision_error"
      );
    }
  }

  return (
    <section aria-labelledby="support-request-heading">
      <div>
        <div>
          <h3 id="support-request-heading">{t("wellbeing.support.title", "Soovin tuge küsida")}</h3>
          <p>
            {t(
              "wellbeing.support.intro",
              "Midagi ei saadeta automaatselt. Mustand jääb privaatseks, kuni oled teksti üle vaadanud ja kinnitanud."
            )}
          </p>
        </div>
        <Button type="button" size="sm" onClick={leavePrivate} disabled={isBusy}>
          {t("wellbeing.support.leave_private", "Jäta privaatseks")}
        </Button>
      </div>

      <div aria-label={t("wellbeing.support.options_label", "Toe küsimise valikud")}>
        {supportOptions.map((option) => (
          <Button
            key={option.outputType}
            type="button"
            className="wellbeing-choice-btn"
            aria-pressed={selected?.outputType === option.outputType}
            onClick={() => chooseOption(option)}
            disabled={isBusy}
          >
            <span>{t(option.labelKey, option.labelFallback)}</span>
            <span>{t(option.descriptionKey, option.descriptionFallback)}</span>
          </Button>
        ))}
        <Button
          type="button"
          className="wellbeing-choice-btn"
          onClick={() => {
            requestGateRef.current.invalidate();
            onNavigate?.("/tooheaolu/taastumine");
          }}
          disabled={isBusy}
        >
          <span>{t("wellbeing.support.open_recovery", "Ava Taastumine")}</span>
          <span>
            {t("wellbeing.support.recovery_meta", "Taastumisplaan jääb enne jagamist sinu kontrolli alla")}
          </span>
        </Button>
      </div>

      {selected ? (
        <div>
          <ContentTrustBadge
            generatedText={draft?.generatedText || preview}
            editedText={draft?.editedText}
            currentText={editedText || preview}
            userConfirmed={draft?.userConfirmed === true}
          />
          <label>
            <span>{t("wellbeing.support.preview_label", "Jagatava versiooni eelvaade")}</span>
            <textarea
              value={editedText || preview}
              onChange={(event) => changeEditedText(event.target.value)}
              rows={11}
              maxLength={4000}
              disabled={isBusy}
            />
          </label>
          <div>
            <label>
              <input
                type="checkbox"
                checked={userReviewed}
                onChange={(event) => setUserReviewed(event.target.checked)}
                disabled={isBusy}
              />
              {t("wellbeing.support.reviewed", "Olen teksti üle vaadanud ja liigsed detailid eemaldanud.")}
            </label>
            <label>
              <input
                type="checkbox"
                checked={userConfirmed}
                onChange={(event) => setUserConfirmed(event.target.checked)}
                disabled={isBusy}
              />
              {t("wellbeing.support.confirmed", "Kinnitan, et see versioon sobib jagatavaks sisendiks.")}
            </label>
          </div>
          <div>
            <Button
              type="button"
              onClick={saveDraft}
              disabled={isBusy || !String(editedText || preview).trim()}
            >
              {t("wellbeing.support.save_draft", "Salvesta privaatne mustand")}
            </Button>
            <Button
              type="button"
              onClick={confirmDraft}
              disabled={
                !draft?.id
                || !userReviewed
                || !userConfirmed
                || !String(editedText || preview).trim()
                || isBusy
              }
            >
              {t("wellbeing.support.confirm_draft", "Kinnita jagatav versioon")}
            </Button>
            {selected.outputType === "covision_input"
              && draft?.status === "ready_to_share"
              && userReviewed
              && userConfirmed
              && !hasUnconfirmedEdits ? (
              <div>
                <label>
                  <input
                    type="checkbox"
                    checked={confirmedNoIdentifiers}
                    onChange={(event) => setConfirmedNoIdentifiers(event.target.checked)}
                    disabled={isBusy}
                  />
                  {t(
                    "wellbeing.support.confirm_no_identifiers",
                    "Kinnitan, et Kovisiooni viidav tekst ei sisalda otseseid tuvastajaid."
                  )}
                </label>
                <p>
                  {t(
                    "wellbeing.support.covision_handoff_notice",
                    "Kovisiooni liigub ainult ülal kinnitatud üldistus. Tööheaolu lähteandmed jäävad privaatseks."
                  )}
                </p>
                <Button
                  type="button"
                  onClick={startCovision}
                  disabled={!confirmedNoIdentifiers || isBusy}
                >
                  {status === "starting_covision"
                    ? t("wellbeing.support.starting_covision", "Loon Kovisiooni…")
                    : t("wellbeing.support.start_covision", "Loo Kovisioon ja ava")}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <p role="status">
        {status === "private"
          ? t("wellbeing.support.status_private", "Sisestus jääb privaatseks.")
          : status === "draft_saved"
            ? t("wellbeing.support.status_saved", "Privaatne mustand salvestati. Enne kasutamist kinnita jagatav versioon.")
            : status === "ready"
              ? t("wellbeing.support.status_ready", "Jagatav versioon on kinnitatud, kuid seda ei saadeta automaatselt.")
              : status === "needs_reconfirm"
                ? t("wellbeing.support.status_needs_reconfirm", "Tekst muutus pärast kinnitamist. Kinnita jagatav versioon uuesti.")
                : status === "draft_conflict"
                  ? t("wellbeing.support.status_draft_conflict", "Mustand muutus teises vaates. Salvesta või laadi värske versioon enne uut kinnitamist.")
                  : status === "starting_covision"
                    ? t("wellbeing.support.status_starting_covision", "Loon privaatset Kovisiooni juhtumit…")
                    : status === "covision_started"
                      ? t("wellbeing.support.status_covision_started", "Kovisiooni juhtum loodi.")
                      : status === "covision_conflict"
                        ? t("wellbeing.support.status_covision_conflict", "Mustand muutus vahepeal. Värskenda kinnitatud versiooni ja proovi uuesti.")
                        : status === "covision_identifiers"
                          ? t("wellbeing.support.status_covision_identifiers", "Tekstis võib olla otseseid tuvastajaid. Eemalda või üldista need ja kinnita tekst uuesti.")
                          : status === "covision_error"
                            ? t("wellbeing.support.status_covision_error", "Kovisiooni loomine ebaõnnestus. Mustand jäi privaatseks.")
                            : status === "error"
                              ? t("wellbeing.support.status_error", "Mustandi salvestamine või kinnitamine ebaõnnestus.")
                              : ""}
      </p>
    </section>
  );
}
