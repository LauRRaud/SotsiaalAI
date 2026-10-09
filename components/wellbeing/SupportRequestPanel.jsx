"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import ActionCard, { ActionCardGrid } from "@/components/stage/ActionCard";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import ContentTrustBadge from "@/components/ui/ContentTrustBadge";
import { createLatestRequestGate, isAbortError } from "@/lib/client/latestRequestGate";
import { buildWellbeingShareableDraft } from "@/lib/wellbeing/supportDraftText";

import { supportOptions } from "./supportOptions";

export default function SupportRequestPanel({
  sourceWorkflowType = "quick-check",
  sourceRecordId = null,
  context,
  onNavigate,
  /* Sammulaval annab pealkirja ja sissejuhatuse samm ise; siis jätab paneel
     oma päise ära, et sama tekst ei korduks. */
  headless = false
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState(null);
  const [editedText, setEditedText] = useState("");
  const [userReviewed, setUserReviewed] = useState(false);
  const [userConfirmed, setUserConfirmed] = useState(false);
  const [confirmedNoIdentifiers, setConfirmedNoIdentifiers] = useState(false);
  /* SOL-WB-17: supervisiooni üleandmisrada oli serveris OLEMAS ja liidesest
     kättesaamatu. Protsessi valik on kohustuslik — üleandmine käib konkreetsesse
     protsessi, mitte „supervisioonile" üldiselt. */
  const [supervisionProcesses, setSupervisionProcesses] = useState([]);
  const [supervisionProcessId, setSupervisionProcessId] = useState("");
  const [status, setStatus] = useState("idle");
  /* Serveri tuvastajakontrolli leiu TÜÜBID (mitte kunagi tekst/väärtus) —
     kuvatakse covision_identifiers staatuse all i18n kaudu. */
  const [identifierIssueTypes, setIdentifierIssueTypes] = useState([]);
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
    setIdentifierIssueTypes([]);
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
    setIdentifierIssueTypes([]);
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
    setIdentifierIssueTypes([]);
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

  async function loadSupervisionProcesses() {
    try {
      const response = await fetch("/api/supervision/processes", { headers: { Accept: "application/json" } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) return;
      const processes = Array.isArray(payload.processes) ? payload.processes : [];
      setSupervisionProcesses(processes);
      setSupervisionProcessId((current) => current || processes[0]?.id || "");
    } catch {
      /* Nimekirja puudumine ei ole viga: nupp jääb lihtsalt keelatuks ja
         kasutaja näeb, et protsessi ei ole. */
      setSupervisionProcesses([]);
    }
  }

  async function startSupervisionHandoff() {
    if (!draft?.id || !draft?.updatedAt || !supervisionProcessId || hasUnconfirmedEdits || isBusy) return;
    const request = requestGateRef.current.begin("start-supervision");
    setStatus("starting_supervision");
    try {
      const response = await fetch(
        `/api/wellbeing/output-drafts/${encodeURIComponent(draft.id)}/supervision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: request.signal,
          body: JSON.stringify({
            processId: supervisionProcessId,
            expectedUpdatedAt: draft.updatedAt
          })
        }
      );
      const payload = await response.json().catch(() => ({}));
      if (!request.isCurrent()) return;
      if (!response.ok || !payload?.ok) {
        const error = new Error(payload?.message || "supervision.errors.handoff_failed");
        error.status = response.status;
        throw error;
      }
      setStatus("supervision_started");
    } catch (error) {
      if (isAbortError(error) || !requestGateRef.current.isCurrent(request)) return;
      setStatus(Number(error?.status) === 409 ? "draft_conflict" : "error");
    }
  }

  async function copyDraftText() {
    const text = String(editedText || preview || "").trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
    } catch {
      setStatus("copy_failed");
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
        error.issueTypes = Array.isArray(payload?.details?.issueTypes)
          ? payload.details.issueTypes.filter((type) => typeof type === "string" && type).slice(0, 3)
          : [];
        throw error;
      }
      const href = `/kovisioon?case=${encodeURIComponent(payload.covisionCaseId)}`;
      setStatus("covision_started");
      if (typeof onNavigate === "function") onNavigate(href);
      else router.push(href);
    } catch (error) {
      if (isAbortError(error) || !request.isCurrent()) return;
      const identifiersDetected = error?.message === "wellbeing.errors.identifiers_detected";
      setIdentifierIssueTypes(identifiersDetected && Array.isArray(error?.issueTypes) ? error.issueTypes : []);
      setStatus(
        identifiersDetected
          ? "covision_identifiers"
          : Number(error?.status) === 409
            ? "covision_conflict"
            : "covision_error"
      );
    }
  }

  return (
    <section
      aria-labelledby={headless ? undefined : "support-request-heading"}
      aria-label={headless ? t("wellbeing.support.title", "Soovin tuge küsida") : undefined}
    >
      <div>
        {headless ? null : (
          <div>
            <h3 id="support-request-heading">{t("wellbeing.support.title", "Soovin tuge küsida")}</h3>
            <p>
              {t(
                "wellbeing.support.intro",
                "Midagi ei saadeta automaatselt. Mustand jääb privaatseks, kuni oled teksti üle vaadanud ja kinnitanud."
              )}
            </p>
          </div>
        )}
        <Button type="button" size="sm" onClick={leavePrivate} disabled={isBusy}>
          {t("wellbeing.support.leave_private", "Jäta privaatseks")}
        </Button>
      </div>

      {/* Pealkiri ja selgitus eraldi ridadel (ActionCard). Varem olid need ühe
          pillnupu järjestikused tekstiosad ja jooksid kokku (kujundusaudit K03);
          paneel on ühine kõigile tööheaolu töövormidele. */}
      <ActionCardGrid label={t("wellbeing.support.options_label", "Toe küsimise valikud")}>
        {supportOptions.map((option) => (
          <ActionCard
            key={`${option.outputType}:${option.recipientType}`}
            title={t(option.labelKey, option.labelFallback)}
            description={t(option.descriptionKey, option.descriptionFallback)}
            pressed={selected?.outputType === option.outputType && selected?.recipientType === option.recipientType}
            onClick={() => chooseOption(option)}
            disabled={isBusy}
          />
        ))}
        <ActionCard
          title={t("wellbeing.support.open_recovery", "Ava Taastumine")}
          description={t("wellbeing.support.recovery_meta", "Taastumisplaan jääb enne jagamist sinu kontrolli alla")}
          onClick={() => {
            requestGateRef.current.invalidate();
            onNavigate?.("/tooheaolu/taastumine");
          }}
          disabled={isBusy}
        />
      </ActionCardGrid>

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
            <Checkbox
              checked={userReviewed}
              onChange={setUserReviewed}
              disabled={isBusy}
              label={t("wellbeing.support.reviewed", "Olen teksti üle vaadanud ja liigsed detailid eemaldanud.")}
            />
            <Checkbox
              checked={userConfirmed}
              onChange={setUserConfirmed}
              disabled={isBusy}
              label={t("wellbeing.support.confirmed", "Kinnitan, et see versioon sobib jagatavaks sisendiks.")}
            />
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
            {/* SOL-WB-17: valik, millel EI OLE adressaadi-rada, ütleb seda välja
                ja annab selle asemel päris toimingu — teksti kopeerimise. */}
            {selected.copyOnly ? (
              <div>
                <p>
                  {t(
                    "wellbeing.support.copy_only_notice",
                    "Sellel valikul ei ole platvormisisest adressaati: tekst jääb sinu privaatseks mustandiks ja sina otsustad, kellega ja millal ta jagad."
                  )}
                </p>
                <Button type="button" onClick={copyDraftText} disabled={isBusy}>
                  {t("wellbeing.support.copy_text", "Kopeeri tekst")}
                </Button>
              </div>
            ) : null}
            {selected.handoff === "supervision"
              && draft?.status === "ready_to_share"
              && userReviewed
              && userConfirmed
              && !hasUnconfirmedEdits ? (
              <div>
                <Button type="button" onClick={loadSupervisionProcesses} disabled={isBusy}>
                  {t("wellbeing.support.load_supervision_processes", "Vali supervisiooniprotsess")}
                </Button>
                {supervisionProcesses.length > 0 ? (
                  <label>
                    {t("wellbeing.support.supervision_process", "Supervisiooniprotsess")}
                    <select
                      value={supervisionProcessId}
                      onChange={(event) => setSupervisionProcessId(event.target.value)}
                    >
                      {supervisionProcesses.map((process) => (
                        <option key={process.id} value={process.id}>
                          {process.title || process.id}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <Button
                  type="button"
                  onClick={startSupervisionHandoff}
                  disabled={!supervisionProcessId || isBusy}
                >
                  {status === "starting_supervision"
                    ? t("wellbeing.support.starting_supervision", "Annan üle…")
                    : t("wellbeing.support.start_supervision", "Anna supervisioonile üle")}
                </Button>
              </div>
            ) : null}
            {selected.outputType === "covision_input"
              && draft?.status === "ready_to_share"
              && userReviewed
              && userConfirmed
              && !hasUnconfirmedEdits ? (
              <div>
                <Checkbox
                  checked={confirmedNoIdentifiers}
                  onChange={setConfirmedNoIdentifiers}
                  disabled={isBusy}
                  label={t(
                    "wellbeing.support.confirm_no_identifiers",
                    "Kinnitan, et Kovisiooni viidav tekst ei sisalda otseseid tuvastajaid."
                  )}
                />
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
            : status === "supervision_started"
              ? t("wellbeing.support.status_supervision_started", "Tekst on antud üle valitud supervisiooniprotsessi.")
              : status === "copied"
                ? t("wellbeing.support.status_copied", "Tekst on kopeeritud. Sina otsustad, kellega ja millal ta jagad.")
                : status === "copy_failed"
                  ? t("wellbeing.support.status_copy_failed", "Kopeerimine ebaõnnestus. Vali tekst ja kopeeri käsitsi.")
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
      {status === "covision_identifiers" && identifierIssueTypes.length > 0 ? (
        <ul aria-label={t("wellbeing.support.identifier_hints_label", "Kontrolli leitud kohad")}>
          {identifierIssueTypes.map((issueType) => (
            <li key={issueType}>
              {t(
                `wellbeing.support.identifier_types.${issueType}`,
                t("wellbeing.support.identifier_types.other", "Võimalik otsene tuvastaja")
              )}
              {" — "}
              {t(
                `wellbeing.support.identifier_suggestions.${issueType}`,
                t(
                  "wellbeing.support.identifier_suggestions.other",
                  "Hinda, kas detail on vajalik, või üldista see."
                )
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
