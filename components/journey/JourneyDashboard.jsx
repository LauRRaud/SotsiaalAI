"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffectiveRole } from "@/components/auth/useEffectiveRole";
import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import { usePanelInfoSlot } from "@/components/ui/PanelInfoSlot";
import { SubpageHeader } from "@/components/ui/SubpageHeader";
import { localizePath } from "@/lib/localizePath";
import { pushWithTransition } from "@/lib/routeTransition";

const DEFAULT_DRAFT = Object.freeze({
  title: "",
  summary: "",
  primaryPath: "UNKNOWN",
  domains: [],
  missingInfo: [],
  riskSignals: [],
  suggestedActions: [],
  context: {}
});

const DEFAULT_LIFE_DOMAINS = Object.freeze([
  "suhtlemine",
  "vaimne tervis",
  "füüsiline tervis",
  "elukeskkond",
  "hõivatus",
  "vaba aeg ja huvitegevus",
  "igapäevaelu toimingud",
  "võrgustik ja kõrvalabi",
  "kriis ja turvalisus"
]);

const CHAT_WORKSPACE_RESTORE_STORAGE_KEY = "__SOTSIAALAI_CHAT_WORKSPACE_RESTORE__";
const JOURNEY_DRAFT_STORAGE_KEY = "sotsiaalai:journey-v1:draft";

function setJourneyStepInUrl(step = "") {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (step) url.searchParams.set("samm", step);
  else url.searchParams.delete("samm");
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

function normalizeListItems(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item : item?.title || item?.description || ""))
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function readDraftLifeDomains(draft) {
  const context = draft?.context && typeof draft.context === "object" && !Array.isArray(draft.context)
    ? draft.context
    : {};
  const lifeDomains = normalizeListItems(context.lifeDomains);
  return lifeDomains.length ? lifeDomains : DEFAULT_LIFE_DOMAINS.slice(0, 4);
}

function ensureDraftActivityLog(draft) {
  const context = draft?.context && typeof draft.context === "object" && !Array.isArray(draft.context)
    ? draft.context
    : {};
  const existing = Array.isArray(context.activityLog) ? context.activityLog : [];
  return {
    ...draft,
    context: {
      ...context,
      activityLog: existing.length
        ? existing
        : [{ type: "created_overview", title: "teekonna ülevaade koostatud" }]
    }
  };
}

function formatDate(value, locale = "et") {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function statusLabel(t, status) {
  return t(`journey.status.${status || "ACTIVE"}`, t("journey.status.ACTIVE", "Active"));
}

function primaryPathLabel(t, value) {
  return t(`journey.primary_paths.${value || "UNKNOWN"}`, t("journey.primary_paths.UNKNOWN", "Not clear yet"));
}

function JourneyCard({ journey, onArchive, busy, t, locale }) {
  const archived = journey.status === "ARCHIVED";
  const updatedAt = formatDate(journey.updatedAt, locale);
  const detailHref = localizePath(`/teekond/${encodeURIComponent(journey.id)}`, locale);

  return (
    <article>
      <div>
        <div>
          <h2>
            {journey.title}
          </h2>
          <div>
            <span>
              {t("journey.labels.private", "Private")}
            </span>
            <span>
              {statusLabel(t, journey.status)}
            </span>
            <span>
              {primaryPathLabel(t, journey.primaryPath)}
            </span>
          </div>
        </div>

        <div>
          <Button as="a" href={detailHref} size="sm">
            {t("journey.actions.open", "Open journey")}
          </Button>
          {!archived ? (
            <Button
              size="sm"
              onClick={() => onArchive(journey.id)}
              disabled={busy}
              aria-label={t("journey.actions.archive_named", { title: journey.title }, "Archive journey {title}")}
            >
              {t("journey.actions.archive", "Archive")}
            </Button>
          ) : null}
        </div>
      </div>

      <p>
        {journey.summary}
      </p>

      {journey.domains?.length ? (
        <div>
          {journey.domains.map((domain) => (
            <span key={domain}>
              {domain}
            </span>
          ))}
        </div>
      ) : null}

      <p>
        {t("journey.labels.updated_at", { date: updatedAt }, "Updated {date}")}
      </p>
    </article>
  );
}

function DraftChipList({ items, emptyText }) {
  const normalized = normalizeListItems(items);
  if (!normalized.length) {
    return <p>{emptyText}</p>;
  }
  return (
    <div>
      {normalized.map((item) => (
        <span key={item}>
          {item}
        </span>
      ))}
    </div>
  );
}

function ReviewBlock({ title, children }) {
  return (
    <section>
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function DraftReview({ draft, setDraft, onSave, onEditDescription, onDecline, busy, t }) {
  const updateField = useCallback((field, value) => {
    setDraft((current) => ({
      ...current,
      [field]: value
    }));
  }, [setDraft]);

  const lifeDomains = useMemo(() => readDraftLifeDomains(draft), [draft]);
  const suggestedActions = useMemo(() => normalizeListItems(draft.suggestedActions), [draft.suggestedActions]);

  return (
    <form onSubmit={onSave}>
      <div>
        <label htmlFor="journey-title">
          {t("journey.labels.title", "Teekonna pealkiri")}
        </label>
        <input
          id="journey-title"
          value={draft.title}
          onChange={(event) => updateField("title", event.target.value)}
          maxLength={160}
          required
        />
      </div>

      <ReviewBlock title={t("journey.review.summary_title", "Olukorra kokkuvõte")}>
        <label htmlFor="journey-summary">
          {t("journey.review.summary_label", "Täpsusta kokkuvõtet, kui soovid")}
        </label>
        <textarea
          id="journey-summary"
          value={draft.summary}
          onChange={(event) => updateField("summary", event.target.value)}
          required
        />
      </ReviewBlock>

      <div>
        <ReviewBlock title={t("journey.labels.domains", "Seotud teemad")}>
          <DraftChipList
            items={draft.domains}
            emptyText={t("journey.messages.empty_domains", "Seotud teemasid ei ole veel lisatud.")}
          />
        </ReviewBlock>
        <ReviewBlock title={t("journey.review.life_domains", "Eluvaldkonnad")}>
          <DraftChipList items={lifeDomains} emptyText={t("journey.review.empty_life_domains", "Eluvaldkonnad täpsustuvad hiljem.")} />
          <p>
            {t("journey.review.life_domains_note", "See on ainult olukorra korrastamise abikiht, mitte ametlik hinnang.")}
          </p>
        </ReviewBlock>
        <ReviewBlock title={t("journey.review.missing_title", "Mis võib veel puudu olla?")}>
          <DraftChipList
            items={draft.missingInfo}
            emptyText={t("journey.messages.empty_missing_info", "Puuduolevat infot ei ole veel lisatud.")}
          />
        </ReviewBlock>
        <ReviewBlock title={t("journey.review.actions_title", "Võimalikud järgmised sammud")}>
          {suggestedActions.length ? (
            <div>
              {suggestedActions.map((action) => (
                <p key={action}>{action}</p>
              ))}
            </div>
          ) : (
            <p>
              {t("journey.messages.empty_suggested_actions", "Järgmised sammud täpsustuvad pärast salvestamist.")}
            </p>
          )}
          <div>
            <Button type="button" variant="primary" size="sm" onClick={() => updateField("primaryPath", "SERVICE_MAP")}>
              {t("journey.service_map.open", "Ava teenusekaart")}
            </Button>
            <Button type="button" variant="primary" size="sm" onClick={() => updateField("primaryPath", "PRE_INQUIRY")}>
              {t("journey.pre_inquiry.open", "Koosta eelpöördumine")}
            </Button>
            <Button type="button" variant="primary" size="sm" onClick={() => updateField("primaryPath", "DOCUMENT")}>
              {t("journey.review.add_document", "Lisa dokument")}
            </Button>
            <Button type="button" variant="primary" size="sm" onClick={() => updateField("primaryPath", "HELP_REQUEST")}>
              {t("journey.review.create_help_request", "Loo abisoov")}
            </Button>
          </div>
        </ReviewBlock>
      </div>

      <p>
        {t("journey.review.privacy_note", "Teekond on privaatne. Teised näevad ainult seda infot, mille sa hiljem eraldi kinnitad ja jagad.")}
      </p>

      <div>
        <Button type="submit" disabled={busy}>
          {t("journey.actions.save_private", "Salvesta teekond")}
        </Button>
        <Button type="button" variant="primary" onClick={onEditDescription} disabled={busy}>
          {t("journey.actions.edit_description", "Muuda kirjeldust")}
        </Button>
        <Button type="button" variant="linkBrand" onClick={onDecline} disabled={busy}>
          {t("journey.actions.decline", "Loobu")}
        </Button>
      </div>
    </form>
  );
}

function RoleWorkspaceAction({ href, title, description }) {
  return (
    <Button as="a" href={href} variant="linkBrand" className="wellbeing-choice-btn">
      <span>{title}</span>
      {description ? (
        <span>{description}</span>
      ) : null}
    </Button>
  );
}

function RoleScopedWorkspace({ role, t, locale }) {
  const isProvider = role === "SERVICE_PROVIDER";
  const titleKey = isProvider ? "journey.workspace.provider.title" : "journey.workspace.specialist.title";
  const descriptionKey = isProvider ? "journey.workspace.provider.description" : "journey.workspace.specialist.description";
  const sharedInfoKey = isProvider ? "journey.workspace.provider.sharedInfoOnly" : "journey.workspace.specialist.sharedInfoOnly";
  const titleFallback = isProvider ? "Teenusega seotud eelinfo" : "Kinnitatud eelinfo";
  const descriptionFallback = isProvider
    ? "Teenuseosutaja näeb ainult konkreetse teenuse või pöördumisega seotud kinnitatud infot."
    : "Spetsialist näeb Teekonnaga seotud infot ainult eelpöördumiste ja muude kinnitatud töövoogude kaudu.";
  const sharedInfoFallback = isProvider
    ? "Privaatseid Teekondi ei kuvata. Teenuseosutaja ei näe kasutaja assistendivestlust ega kogu Teekonda."
    : "Privaatseid Teekondi ei kuvata. Spetsialist ei näe kasutaja assistendivestlust ega kogu Teekonda.";
  const preInquiryHref = localizePath("/eelpoordumised", locale);
  const roomsHref = localizePath("/vestlus?rooms=1", locale);
  const serviceProfileHref = localizePath("/teenuseprofiil", locale);
  const documentsHref = localizePath("/documents", locale);

  return (
    <section>
      <div>
        <h1>
          {t(titleKey, titleFallback)}
        </h1>
        <p>
          {t(descriptionKey, descriptionFallback)}
        </p>
        <p>
          {t(sharedInfoKey, sharedInfoFallback)}
        </p>
      </div>

      <div>
        <RoleWorkspaceAction
          href={preInquiryHref}
          title={isProvider
            ? t("journey.workspace.provider.serviceInquiries", "Saabunud pöördumised")
            : t("journey.workspace.specialist.preInquiries", "Eelpöördumised")}
          description={isProvider
            ? t("journey.workspace.provider.serviceInquiriesDescription", "Ava teenusega seotud kinnitatud pöördumised.")
            : t("journey.workspace.specialist.preInquiriesDescription", "Ava kasutaja kinnitatud eelpöördumised.")}
        />
        <RoleWorkspaceAction
          href={roomsHref}
          title={t("journey.workspace.client.relatedRooms", "Vestlusruumid")}
          description={t("journey.workspace.privateJourneysNotShared", "Privaatset Teekonda ei jagata automaatselt.")}
        />
        {isProvider ? (
          <RoleWorkspaceAction
            href={serviceProfileHref}
            title={t("journey.workspace.provider.serviceProfile", "Teenuseprofiil")}
            description={t("journey.workspace.provider.serviceProfileDescription", "Halda teenuse nähtavust ja kontaktinfot.")}
          />
        ) : (
          <RoleWorkspaceAction
            href={documentsHref}
            title={t("chat.workspace.cards.document_drafting.title", "Koosta dokument")}
            description={t("journey.workspace.specialist.documentsDescription", "Kasuta olemasolevaid dokumendi töövahendeid.")}
          />
        )}
        <RoleWorkspaceAction
          href={preInquiryHref}
          title={isProvider
            ? t("journey.workspace.provider.sharedInfoOnly", "Teenusega seotud kinnitatud eelinfo")
            : t("journey.workspace.specialist.missingInfo", "Täpsustamist vajav info")}
          description={t("journey.workspace.notAvailableForRole", "Privaatsete Teekondade nimekirja selles rollis ei kuvata.")}
        />
      </div>
    </section>
  );
}

function EmptyJourneyStart({ onStart, disabled, t }) {
  const label = t("journey.empty_start.label", "Alusta teekonda");

  return (
    <section>
      <Button
        type="button"
        onClick={onStart}
        disabled={disabled}
      >
        {label}
      </Button>
    </section>
  );
}

export default function JourneyDashboard({ embedded = false, onBack = null, hideHeader = false, roleOverride = "" } = {}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { status } = useSession();
  const { effectiveRole, isRoleResolved } = useEffectiveRole();
  const [journeys, setJourneys] = useState([]);
  const [mode, setMode] = useState("list");
  const [situation, setSituation] = useState("");
  const [draft, setDraft] = useState(DEFAULT_DRAFT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const situationInputRef = useRef(null);

  const activeJourneys = useMemo(
    () => journeys.filter((journey) => journey.status !== "ARCHIVED"),
    [journeys]
  );
  const archivedJourneys = useMemo(
    () => journeys.filter((journey) => journey.status === "ARCHIVED"),
    [journeys]
  );
  const normalizedRole = String(roleOverride || effectiveRole || "CLIENT").toUpperCase();
  const isClientRole = normalizedRole === "CLIENT";
  const latestJourney = activeJourneys[0] || journeys[0] || null;
  /* ⓘ elab paneeli nurgas × kõrval (PanelFrame); siin ainult sisu.
     Manustatuna registreerib Töölaud (WorkspacePanel) — sama reegel mis
     kõigil teistel moodulitel. Ilma `active`-väravata registreeriksid MÕLEMAD
     samasse pesasse ja võidaks see, kelle effect juhtub viimasena jooksma. */
  usePanelInfoSlot({
    infoId: "journey",
    title: t("journey.title", "Teekond"),
    label: t("journey.info.label", "Open journey info"),
    active: !embedded
  });

  const handleBack = useCallback(() => {
    if (typeof onBack === "function") {
      onBack();
      return;
    }

    const navigateBack = () => {
      if (typeof window !== "undefined") {
        try {
          window.sessionStorage.setItem(
            CHAT_WORKSPACE_RESTORE_STORAGE_KEY,
            JSON.stringify({ ts: Date.now() })
          );
        } catch {}
      }
      pushWithTransition(router, localizePath("/vestlus", locale));
    };

    if (typeof window === "undefined") {
      navigateBack();
      return;
    }
    window.requestAnimationFrame(navigateBack);
  }, [locale, onBack, router]);

  const loadJourneys = useCallback(async () => {
    if (status !== "authenticated" || !isRoleResolved || !isClientRole) return;
    setError("");
    const response = await fetch("/api/journeys", {
      cache: "no-store"
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) {
      throw new Error(payload.message || t("journey.messages.load_failed", "Loading the journey failed."));
    }
    setJourneys(Array.isArray(payload.journeys) ? payload.journeys : []);
  }, [isClientRole, isRoleResolved, status, t]);

  useEffect(() => {
    if (status !== "authenticated" || !isRoleResolved || !isClientRole) return;
    loadJourneys().catch((loadError) => {
      setError(loadError.message || t("journey.messages.load_failed", "Loading the journey failed."));
    });
  }, [isClientRole, isRoleResolved, loadJourneys, status, t]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const step = new URL(window.location.href).searchParams.get("samm");
    let saved = null;
    try {
      saved = JSON.parse(window.sessionStorage.getItem(JOURNEY_DRAFT_STORAGE_KEY) || "null");
    } catch {}
    if (saved?.situation) setSituation(String(saved.situation));
    if (saved?.draft && typeof saved.draft === "object") setDraft(saved.draft);
    if (step === "kirjelda" || step === "ulevaade") {
      setMode(step === "ulevaade" && saved?.draft ? "review" : "start");
      if (saved) setNotice(t("journey.autosave.restored", "Taastasime selle sessiooni pooleli jäänud töö."));
    }
  }, [t]);

  useEffect(() => {
    if (typeof window === "undefined" || !["start", "review"].includes(mode)) return;
    window.sessionStorage.setItem(JOURNEY_DRAFT_STORAGE_KEY, JSON.stringify({ mode, situation, draft }));
  }, [draft, mode, situation]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const guard = (event) => {
      if (!["start", "review"].includes(mode) || (!situation.trim() && !draft.summary)) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [draft.summary, mode, situation]);

  useEffect(() => {
    if (mode !== "start") return;
    const frame = window.requestAnimationFrame(() => {
      situationInputRef.current?.focus?.();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [mode]);

  const handleDraftSubmit = useCallback(async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/journeys/draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ situation })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || t("journey.messages.draft_failed", "Teekonna ülevaate koostamine ebaõnnestus."));
      }
      setDraft(ensureDraftActivityLog({
        ...DEFAULT_DRAFT,
        ...payload.draft
      }));
      setMode("review");
      setJourneyStepInUrl("ulevaade");
    } catch (draftError) {
      setError(draftError.message || t("journey.messages.draft_failed", "Teekonna ülevaate koostamine ebaõnnestus."));
    } finally {
      setBusy(false);
    }
  }, [situation, t]);

  const handleSaveDraft = useCallback(async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/journeys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...ensureDraftActivityLog(draft),
          status: "ACTIVE",
          sharingStatus: "PRIVATE"
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || t("journey.messages.save_failed", "Saving the journey failed."));
      }
      setSituation("");
      setDraft(DEFAULT_DRAFT);
      setMode("list");
      window.sessionStorage.removeItem(JOURNEY_DRAFT_STORAGE_KEY);
      setJourneyStepInUrl("");
      pushWithTransition(router, localizePath(`/teekond/${encodeURIComponent(payload.journey.id)}`, locale));
    } catch (saveError) {
      setError(saveError.message || t("journey.messages.save_failed", "Saving the journey failed."));
    } finally {
      setBusy(false);
    }
  }, [draft, locale, router, t]);

  const handleArchive = useCallback(async (journeyId) => {
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`/api/journeys/${encodeURIComponent(journeyId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status: "ARCHIVED" })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || t("journey.messages.archive_failed", "Archiving the journey failed."));
      }
      setNotice(t("journey.messages.archived", "Journey archived."));
      await loadJourneys();
    } catch (archiveError) {
      setError(archiveError.message || t("journey.messages.archive_failed", "Archiving the journey failed."));
    } finally {
      setBusy(false);
    }
  }, [loadJourneys, t]);

  const handleStartNew = useCallback(() => {
    setMode("start");
    setError("");
    setNotice("");
    setDraft(DEFAULT_DRAFT);
    setJourneyStepInUrl("kirjelda");
  }, []);

  const handleCancel = useCallback(() => {
    if (typeof window !== "undefined" && (situation.trim() || draft.summary)) {
      const confirmed = window.confirm(t("journey.autosave.discard_confirm", "Kas lõpetad koostamise ja kustutad selle sessiooni mustandi?"));
      if (!confirmed) return;
      window.sessionStorage.removeItem(JOURNEY_DRAFT_STORAGE_KEY);
    }
    setMode("list");
    setSituation("");
    setDraft(DEFAULT_DRAFT);
    setError("");
    setJourneyStepInUrl("");
  }, [draft.summary, situation, t]);

  const handleEditDescription = useCallback(() => {
    setMode("start");
    setJourneyStepInUrl("kirjelda");
    setError("");
    setNotice("");
  }, []);

  const renderPage = (children, options = {}) => {
    const minimal = options.minimal === true;
    const content = (
      <div className="journey-content">
        {!hideHeader && !minimal ? (
          <SubpageHeader
            onBack={handleBack}
            backAriaLabel={t("workspace_feature_pages.back_to_workspace", "Back to workspace")}
            holdPressedVisualDisabled
          >
            {t("journey.title", "Teekond")}
          </SubpageHeader>
        ) : null}
        {["start", "review"].includes(mode) ? (
          <>
            <aside className="journey-quick-help" aria-label={t("journey.quick_help.label", "Kiire abi")}>
              <strong>{t("journey.quick_help.label", "Kiire abi")}</strong>
              <span>{t("journey.quick_help.emergency", "112")}</span>
              <span>{t("journey.quick_help.child", "116 111")}</span>
              <span>{t("journey.quick_help.victim", "116 006")}</span>
            </aside>
            <nav aria-label={t("journey.steps.label", "Teekonna sammud")}>
              <ol className="journey-stepper">
                <li aria-current={mode === "start" ? "step" : undefined}>{t("journey.steps.describe", "Kirjelda")}</li>
                <li aria-current={mode === "review" ? "step" : undefined}>{t("journey.steps.review", "Vaata üle")}</li>
              </ol>
            </nav>
          </>
        ) : null}
        {children}
      </div>
    );

    if (embedded) {
      return (
        <div className="journey-content">
          {content}
        </div>
      );
    }

    return (
      <main className="journey-page">
        <div className="journey-shell">
          {content}
        </div>
      </main>
    );
  };

  if (status === "loading" || !isRoleResolved) {
    return renderPage(
      <div>
        <p>
          {t("journey.messages.loading", "Laen teekonda...")}
        </p>
      </div>
    );
  }

  if (status !== "authenticated") {
    return renderPage(
      <section>
            <div>
              <h1>{t("journey.title", "Teekond")}</h1>
            </div>
            <p>
              {t("journey.messages.auth_required", "The journey is private. Log in to continue.")}
            </p>
            <Button as="a" href="/vestlus?login=1">
              {t("journey.actions.login", "Log in")}
            </Button>
          </section>
    );
  }

  if (isClientRole && mode === "list" && !activeJourneys.length && !archivedJourneys.length) {
    return renderPage(
      <>
        {error ? (
          <p role="alert">
            {error}
          </p>
        ) : null}
        <EmptyJourneyStart onStart={handleStartNew} disabled={busy} t={t} />
      </>,
      { minimal: true }
    );
  }

  return renderPage(
    <>
        {!isClientRole ? (
          <RoleScopedWorkspace role={normalizedRole} t={t} locale={locale} />
        ) : (
          <>
        {mode === "list" ? (
          <section>
            <div>
              <div>
                <h2>
                  {t("journey.workspace.client.title", "Teekonna tööpind")}
                </h2>
                <p>
                  {t("journey.workspace.client.description", "Siin on sinu privaatsed Teekonnad ja järgmised sammud. Teekonda ei jagata enne sinu eraldi kinnitust.")}
                </p>
              </div>
              {latestJourney ? (
                <Button as="a" href={localizePath(`/teekond/${encodeURIComponent(latestJourney.id)}`, locale)}>
                  {t("journey.workspace.client.continue", "Jätka viimast Teekonda")}
                </Button>
              ) : null}
            </div>
            <div>
              <Button onClick={handleStartNew} disabled={busy}>
                {t("journey.workspace.client.start", "Alusta Teekonda")}
              </Button>
              <Button as="a" href={localizePath("/eelpoordumised", locale)}>
                {t("journey.workspace.client.relatedPreInquiries", "Eelpöördumised")}
              </Button>
              <Button as="a" href={localizePath("/teenusekaart", locale)}>
                {t("chat.workspace.cards.service_map.title", "Teenusekaart")}
              </Button>
              <Button as="a" href={localizePath("/documents", locale)}>
                {t("chat.workspace.cards.documents.title", "Dokumendid")}
              </Button>
            </div>
            <p>
              {t("journey.workspace.privacyNote", "Teekond on privaatne. Spetsialist, teenuseosutaja või ruumi liige näeb ainult seda infot, mille sa eraldi kinnitad ja jagad.")}
            </p>
          </section>
        ) : null}

        {error ? (
          <p role="alert">
            {error}
          </p>
        ) : null}

        {notice ? (
          <p role="status">
            {notice}
          </p>
        ) : null}

        {mode === "start" ? (
          <section>
            <p>
              {t("journey.sections.start_description", "Tere. Alustame sinu teekonda. Kirjelda oma olukorda oma sõnadega. Sa ei pea kõike teadma ega õigesti sõnastama — kirjuta lihtsalt, mis toimub.")}
            </p>

            <form onSubmit={handleDraftSubmit}>
              <label htmlFor="journey-situation">
                {t("journey.labels.situation", "Olukorra kirjeldus")}
                <textarea
                  id="journey-situation"
                  ref={situationInputRef}
                  value={situation}
                  onChange={(event) => setSituation(event.target.value)}
                  placeholder={t("journey.placeholders.situation", "Näiteks: hooldan ema ja ei jaksa enam üksi. Ta vajab abi pesemisel ja söögi tegemisel. Ma ei tea, kas peaksin pöörduma KOV-i või teenuseosutaja poole.")}
                  required
                />
              </label>

              <div>
                <Button type="submit" disabled={busy || !situation.trim()}>
                  {t("journey.empty_start.label", "Alusta teekonda")}
                </Button>
              </div>
            </form>
          </section>
        ) : null}

        {mode === "review" ? (
          <section>
            <div>
              <div>
                <h2>
                  {t("journey.sections.review_title", "Ülevaade enne salvestamist")}
                </h2>
                <p>
                  {t("journey.sections.review_description", "Vaata üle, kas SotsiaalAI korrastas olukorra õigesti. Teekond salvestatakse alles siis, kui kinnitad.")}
                </p>
              </div>
            </div>

            <Button variant="linkBrand" onClick={handleEditDescription} disabled={busy}>
              {t("journey.actions.previous_step", "← Eelmine samm")}
            </Button>

            {Array.isArray(draft.riskSignals) && draft.riskSignals.length ? (
              <aside className="journey-risk-card" role="alert">
                <strong>{t("journey.risk_card.title", "Kui vajad kohe abi")}</strong>
                <p>{t("journey.risk_card.body", "Need tähelepanekud jäävad ainult sulle nähtavaks ega liigu eelpöördumise adressaadile.")}</p>
              </aside>
            ) : null}

            <DraftReview
              draft={draft}
              setDraft={setDraft}
              onSave={handleSaveDraft}
              onEditDescription={handleEditDescription}
              onDecline={handleCancel}
              busy={busy}
              t={t}
            />
          </section>
        ) : null}

        {mode === "list" ? (
          <div>
            <section>
              <div>
                <h2>
                  {t("journey.sections.active_title", "Active journey")}
                </h2>
                <span>
                  {activeJourneys.length}
                </span>
              </div>

              <div>
                {activeJourneys.length ? activeJourneys.map((journey) => (
                  <JourneyCard
                    key={journey.id}
                    journey={journey}
                    onArchive={handleArchive}
                    busy={busy}
                    t={t}
                    locale={locale}
                  />
                )) : (
                  <p>
                    {t("journey.messages.no_active", "No private journey has been saved yet.")}
                  </p>
                )}
              </div>
            </section>

            <aside>
              <h2>
                {t("journey.sections.archived_title", "Previous journeys")}
              </h2>

              {archivedJourneys.length ? archivedJourneys.map((journey) => (
                <JourneyCard
                  key={journey.id}
                  journey={journey}
                  onArchive={handleArchive}
                  busy={busy}
                  t={t}
                  locale={locale}
                />
              )) : (
                <p>
                  {t("journey.messages.no_archived", "There are no archived journeys.")}
                </p>
              )}
            </aside>
          </div>
        ) : null}
          </>
        )}
      </>
  );
}
