"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import ModalConfirm from "@/components/ui/ModalConfirm";
import Panel from "@/components/ui/Panel";
import { usePanelInfoSlot } from "@/components/ui/PanelInfoSlot";
import { SubpageHeader } from "@/components/ui/SubpageHeader";
import Form from "@/components/ui/Form";
import Input from "@/components/ui/Input";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";
import { localizePath } from "@/lib/localizePath";
import { pushWithTransition } from "@/lib/routeTransition";
import OwnershipBar from "./OwnershipBar";
import styles from "./MySharingsPage.module.css";

const EMPTY_SHARINGS = Object.freeze({
  preInquiries: [],
  rooms: [],
  roomSummaries: [],
  invites: [],
  helpListings: [],
  mentoringPreparations: [],
  networkShares: [],
  outgoingNetworkShares: [],
  urgentRequests: [],
  wellbeingSupportShares: [],
  serviceReportShares: [],
  privateRecords: []
});

const SHARING_SECTION_KEYS = Object.freeze(Object.keys(EMPTY_SHARINGS));

function emptySectionMeta() {
  return Object.fromEntries(SHARING_SECTION_KEYS.map((key) => [key, {
    status: "EMPTY",
    errorCode: null,
    paging: { complete: true, hasMore: false, limit: null }
  }]));
}

function statusKey(item) {
  if (item.recalledAt) return "recalled";
  if (item.supersededById) return "superseded";
  return String(item.status || "sent").toLowerCase();
}

function Section({ title, help, empty, items, sectionState, retrying = false, onRetry, retryLabel, unavailableLabel, children }) {
  const unavailable = ["UNAVAILABLE", "TIMEOUT"].includes(sectionState?.status);
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeading}>
        <h2>{title}</h2>
        <p>{help}</p>
      </div>
      {unavailable ? (
        <Panel variant="subpage" padding="sm" className={styles.sectionError}>
          <p role="status">{unavailableLabel}</p>
          <Button variant="secondary" disabled={retrying} onClick={onRetry}>{retryLabel}</Button>
        </Panel>
      ) : items.length ? <div className={styles.cards}>{children}</div> : <p className={styles.empty}>{empty}</p>}
    </section>
  );
}

function helpMapVisibilityKey(item) {
  const value = String(item.mapVisibility || "OUT_OF_SYNC").toLowerCase();
  return `my_sharings.ownership.help_map_${value}`;
}

export default function MySharingsPage() {
  const router = useRouter();
  const { t, locale } = useI18n();
  /* ⓘ kiirmenüüsse (lib/dashboardInfoContent → `my_sharings`). Selgitus, mis
     seni seisis pealkirja all sissejuhatusena, elab nüüd seal: info ei ole
     pealkirja alamärkus. */
  usePanelInfoSlot({ infoId: "my_sharings" });
  const [sharings, setSharings] = useState(EMPTY_SHARINGS);
  const [sectionMeta, setSectionMeta] = useState(emptySectionMeta);
  const [retryingSection, setRetryingSection] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [confirmAction, setConfirmAction] = useState(null);
  const [correction, setCorrection] = useState(null);
  const [privacyPrompt, setPrivacyPrompt] = useState(null);
  const feedbackRef = useRef(null);
  const mutationInFlightRef = useRef("");

  const formatter = useMemo(
    () => new Intl.DateTimeFormat(locale || "et", { dateStyle: "medium", timeStyle: "short" }),
    [locale]
  );
  const formatDate = useCallback((value) => {
    if (!value) return t("my_sharings.labels.unknown_time");
    const date = new Date(value);
    return Number.isFinite(date.getTime())
      ? formatter.format(date)
      : t("my_sharings.labels.unknown_time");
  }, [formatter, t]);

  const loadSharings = useCallback(async ({ signal, preserveData = false, section = null, cursor = null, append = false } = {}) => {
    if (!preserveData) setLoadError("");
    if (section) setRetryingSection(section);
    try {
      const response = section
        ? await fetch(`/api/my-sharings?section=${encodeURIComponent(section)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, {
          cache: "no-store",
          signal,
        })
        : await fetch("/api/my-sharings", { cache: "no-store", signal });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) {
        throw new Error(resolveApiMessage({
          payload,
          t,
          fallbackKey: "my_sharings.errors.load_failed"
        }));
      }
      const incoming = payload?.sharings && typeof payload.sharings === "object" ? payload.sharings : {};
      setSharings((current) => {
        const next = section ? { ...current } : { ...EMPTY_SHARINGS };
        for (const [key, value] of Object.entries(incoming)) {
          if (key in EMPTY_SHARINGS) {
            const items = Array.isArray(value?.items) ? value.items : [];
            next[key] = append ? [...current[key], ...items.filter((item) => !current[key].some((existing) => existing.id === item.id))] : items;
          }
        }
        return next;
      });
      setSectionMeta((current) => {
        const next = section ? { ...current } : emptySectionMeta();
        for (const [key, value] of Object.entries(incoming)) {
          if (key in EMPTY_SHARINGS) {
            next[key] = {
              status: value?.status || "EMPTY",
              errorCode: value?.errorCode || null,
              paging: value?.paging || { complete: true, hasMore: false, limit: null }
            };
          }
        }
        return next;
      });
      return true;
    } catch (error) {
      if (error?.name === "AbortError") return false;
      if (!preserveData) {
        setLoadError(error?.message || t("my_sharings.errors.load_failed"));
      }
      return false;
    } finally {
      if (section) setRetryingSection("");
      if (!signal?.aborted) setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const controller = new AbortController();
    void loadSharings({ signal: controller.signal });
    return () => controller.abort();
  }, [loadSharings]);

  useEffect(() => {
    if (!feedback && !actionError) return;
    if (confirmAction) return;
    feedbackRef.current?.focus({ preventScroll: true });
  }, [actionError, confirmAction, feedback]);

  const ownershipLabels = useMemo(() => ({
    visibility: t("my_sharings.ownership.visibility"),
    origin: t("my_sharings.ownership.origin"),
    validity: t("my_sharings.ownership.validity")
  }), [t]);

  const resetMessages = useCallback(() => {
    setFeedback("");
    setActionError("");
  }, []);

  /* COLLAB-P4. Suund on siin teistpidi kui ülejäänud lehel: need ei ole asjad,
     mida inimene on jaganud, vaid ettepanek jagada tema KOHTA. Ühendav mõiste
     ei ole suund, vaid „kus mu info liigub" — seepärast on nad samas kohas ja
     eristuvad pealkirja, mitte eraldi lehega.
     Otsus läheb otse, ilma ModalConfirm'ita: kinnitamine EI ole pöördumatu
     (töötaja peab veel saatma) ja keeldumine on ohutu suund. Lisaklikk siin
     ainult väsitaks inimest, kes nagunii kaalub. */
  /**
   * SK-V1: kiireloomulise abipalve tagasivõtt.
   *
   * Sama piir mis eelpöördumisel — kuni keegi ei ole lugenud. Serveri kontroll
   * on ülimuslik: `canRecall` siin on ainult nupu nähtavus, mitte luba.
   */
  const recallUrgentRequest = useCallback(async (request) => {
    const key = `urgent:${request.id}`;
    if (mutationInFlightRef.current) return;
    mutationInFlightRef.current = key;
    setBusyKey(key);
    resetMessages();
    try {
      const response = await fetch(`/api/urgent-requests/${encodeURIComponent(request.id)}/recall`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ui-locale": locale || "et" },
        body: "{}"
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) {
        throw new Error(resolveApiMessage({
          payload,
          t,
          fallbackKey: "my_sharings.errors.action_failed"
        }));
      }
      setFeedback(t("my_sharings.notice.urgent_recalled"));
      const refreshed = await loadSharings({ preserveData: true });
      if (!refreshed) setActionError(t("my_sharings.errors.refresh_failed"));
    } catch (error) {
      setActionError(error?.message || t("my_sharings.errors.action_failed"));
    } finally {
      if (mutationInFlightRef.current === key) {
        mutationInFlightRef.current = "";
        setBusyKey("");
      }
    }
  }, [loadSharings, locale, resetMessages, t]);

  const decideNetworkShare = useCallback(async (share, decision) => {
    const key = `share:${share.id}`;
    if (mutationInFlightRef.current) return;
    mutationInFlightRef.current = key;
    setBusyKey(key);
    resetMessages();
    try {
      const response = await fetch(`/api/network-shares/${encodeURIComponent(share.id)}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ui-locale": locale || "et" },
        body: JSON.stringify({ decision })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) {
        throw new Error(resolveApiMessage({
          payload,
          t,
          fallbackKey: "my_sharings.errors.action_failed"
        }));
      }
      setFeedback(t(`my_sharings.notice.${decision === "CONFIRMED" ? "share_confirmed" : "share_declined"}`));
      const refreshed = await loadSharings({ preserveData: true });
      if (!refreshed) setActionError(t("my_sharings.errors.refresh_failed"));
    } catch (error) {
      setActionError(error?.message || t("my_sharings.errors.action_failed"));
    } finally {
      if (mutationInFlightRef.current === key) {
        mutationInFlightRef.current = "";
        setBusyKey("");
      }
    }
  }, [loadSharings, locale, resetMessages, t]);

  const openConfirmAction = useCallback((action) => {
    resetMessages();
    setConfirmAction(action);
  }, [resetMessages]);

  const runConfirmedAction = useCallback(async () => {
    const action = confirmAction;
    if (!action || mutationInFlightRef.current) return;
    const key = `${action.kind}:${action.item.id}`;
    mutationInFlightRef.current = key;
    setBusyKey(key);
    resetMessages();
    try {
      const target = action.kind === "recall"
        ? `/api/pre-inquiries/${encodeURIComponent(action.item.id)}/recall`
        : action.kind === "revoke"
          ? `/api/invites/${encodeURIComponent(action.item.id)}/revoke`
          : action.kind === "mentoringRecall"
            ? `/api/mentoring/relations/${encodeURIComponent(action.item.relationId)}/preparation`
            : `/api/rooms/${encodeURIComponent(action.item.id)}/leave`;
      const body = action.kind === "recall"
        ? { expectedUpdatedAt: action.item.updatedAt }
        : action.kind === "mentoringRecall"
          ? { action: "recall", noteId: action.item.id }
          : { locale };
      const response = await fetch(target, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ui-locale": locale || "et" },
        body: JSON.stringify(body)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) {
        const message = resolveApiMessage({
          payload,
          t,
          fallbackKey: "my_sharings.errors.action_failed"
        });
        if (action.kind === "mentoringRecall" && response.status === 409) {
          await loadSharings({ preserveData: true, section: "mentoringPreparations" });
          setConfirmAction(null);
          setActionError(message);
          return;
        }
        throw new Error(message);
      }
      setConfirmAction(null);
      setFeedback(t(`my_sharings.notice.${action.kind === "recall"
        ? "recalled"
        : action.kind === "revoke"
          ? "invite_revoked"
          : action.kind === "mentoringRecall"
            ? "mentoring_recalled"
            : "room_left"}`));
      const refreshed = await loadSharings({ preserveData: true });
      if (!refreshed) setActionError(t("my_sharings.errors.refresh_failed"));
    } catch (error) {
      setActionError(error?.message || t("my_sharings.errors.action_failed"));
    } finally {
      if (mutationInFlightRef.current === key) {
        mutationInFlightRef.current = "";
        setBusyKey("");
      }
    }
  }, [confirmAction, loadSharings, locale, resetMessages, t]);

  const openCorrection = useCallback((item) => {
    resetMessages();
    setPrivacyPrompt(null);
    setCorrection({
      id: item.id,
      expectedUpdatedAt: item.updatedAt,
      topic: item.topic || "",
      situation: item.situation || "",
      text: item.sharedText || ""
    });
  }, [resetMessages]);

  const sendCorrection = useCallback(async (privacyDecision = null) => {
    if (!correction || mutationInFlightRef.current) return;
    const key = `correct:${correction.id}`;
    mutationInFlightRef.current = key;
    setBusyKey(key);
    resetMessages();
    try {
      const response = await fetch(`/api/pre-inquiries/${encodeURIComponent(correction.id)}/corrections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedUpdatedAt: correction.expectedUpdatedAt,
          topic: correction.topic,
          situation: correction.situation,
          userEditedDraft: correction.text,
          privacyDecision
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) {
        if (payload?.needsPrivacyConfirmation) {
          setPrivacyPrompt(payload);
          return;
        }
        throw new Error(resolveApiMessage({
          payload,
          t,
          fallbackKey: "my_sharings.errors.action_failed"
        }));
      }
      setCorrection(null);
      setPrivacyPrompt(null);
      setFeedback(t("my_sharings.notice.corrected"));
      const refreshed = await loadSharings({ preserveData: true });
      if (!refreshed) setActionError(t("my_sharings.errors.refresh_failed"));
    } catch (error) {
      setActionError(error?.message || t("my_sharings.errors.action_failed"));
    } finally {
      if (mutationInFlightRef.current === key) {
        mutationInFlightRef.current = "";
        setBusyKey("");
      }
    }
  }, [correction, loadSharings, resetMessages, t]);

  const allEmpty = Object.values(sharings).every((items) => !Array.isArray(items) || items.length === 0);
  const hasUnavailableSection = Object.values(sectionMeta).some((meta) => ["UNAVAILABLE", "TIMEOUT"].includes(meta?.status));

  const sectionProps = useCallback((key) => ({
    sectionState: sectionMeta[key],
    retrying: retryingSection === key,
    retryLabel: t("my_sharings.actions.retry_section"),
    unavailableLabel: t(sectionMeta[key]?.status === "TIMEOUT"
      ? "my_sharings.errors.section_timeout"
      : "my_sharings.errors.section_unavailable"),
    onRetry: () => { void loadSharings({ preserveData: true, section: key }); }
  }), [loadSharings, retryingSection, sectionMeta, t]);

  const preInquiryValidity = useCallback((item) => {
    if (item.recalledAt) return t("my_sharings.ownership.recalled", { date: formatDate(item.recalledAt) });
    if (item.supersededById) return t("my_sharings.ownership.superseded");
    if (item.deliveryChannel === "EXTERNAL_EMAIL") return t("my_sharings.ownership.external_final");
    if (item.openedAt) return t("my_sharings.ownership.opened", { date: formatDate(item.openedAt) });
    return t("my_sharings.ownership.until_recall");
  }, [formatDate, t]);

  return (
    <main className={styles.page}>
      <div className={styles.shell} data-glass-back-anchor>
        <SubpageHeader
          title={t("my_sharings.title")}
          onBack={() => pushWithTransition(router, localizePath("/profiil", locale))}
          backAriaLabel={t("my_sharings.back")}
        />
        <div
          ref={feedbackRef}
          className={styles.liveRegion}
          role={actionError && !confirmAction ? "alert" : "status"}
          aria-live="polite"
          tabIndex={-1}
        >
          {confirmAction ? feedback : actionError || feedback}
        </div>

        {loading ? <p className={styles.loading}>{t("my_sharings.loading")}</p> : null}
        {!loading && loadError ? (
          <Panel variant="subpage" padding="sm" className={styles.loadError}>
            <p role="alert">{loadError}</p>
            <Button variant="secondary" onClick={() => { setLoading(true); void loadSharings(); }}>
              {t("my_sharings.actions.retry")}
            </Button>
          </Panel>
        ) : null}

        {!loading && !loadError && allEmpty && !hasUnavailableSection ? <p className={styles.emptyAll}>{t("my_sharings.empty_all")}</p> : null}

        {!loading && !loadError ? (
          <div className={styles.ledger}>
            {/* Kõige ülal, sest need on ainsad read lehel, mis nõuavad inimeselt
                tegutsemist. Ajaloo alla jäädes kaoksid nad ära. */}
            <Section
              {...sectionProps("networkShares")}
              title={t("my_sharings.sections.network_shares")}
              help={t("my_sharings.section_help.network_shares")}
              empty={t("my_sharings.empty.network_shares")}
              items={sharings.networkShares}
            >
              {sharings.networkShares.map((item) => {
                const busy = busyKey === `share:${item.id}`;
                return (
                  <Panel as="article" variant="glass" padding="sm" className={styles.card} key={item.id}>
                    <div className={styles.cardTopline}>
                      <div>
                        <span className={styles.eyebrow}>
                          {item.awaitingDecision
                            ? t("my_sharings.labels.awaiting_your_decision")
                            : t(`my_sharings.share_status.${item.status}`, item.status)}
                        </span>
                        <h3>{t("my_sharings.labels.share_incoming")}</h3>
                      </div>
                    </div>

                    <p className={styles.sharedText}>{item.summaryText}</p>

                    <dl className={styles.meta}>
                      <div>
                        <dt>{t("my_sharings.labels.share_purpose")}</dt>
                        <dd>{item.purpose}</dd>
                      </div>
                      <div>
                        <dt>{t("my_sharings.labels.share_boundary")}</dt>
                        <dd>{item.sharingBoundary}</dd>
                      </div>
                      <div>
                        <dt>{t("my_sharings.labels.share_ends")}</dt>
                        <dd>{formatDate(item.participationEndsOn)}</dd>
                      </div>
                    </dl>

                    {item.awaitingDecision ? (
                      <div className={styles.cardActions}>
                        <Button
                          variant="primary"
                          disabled={busy}
                          onClick={() => void decideNetworkShare(item, "CONFIRMED")}
                        >
                          {t("my_sharings.actions.confirm_share")}
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={busy}
                          onClick={() => void decideNetworkShare(item, "DECLINED")}
                        >
                          {t("my_sharings.actions.decline_share")}
                        </Button>
                      </div>
                    ) : null}
                  </Panel>
                );
              })}
            </Section>

            {/* SK-V1. Vastust ootav kiireloomuline abipalve on kõige ärevamas
                hetkes tehtud jagamine — ta seisab kohe otsust ootavate järel ja
                mitte ajaloo all. Keeldumise PÕHJUS on siin nähtav tekst: ilma
                temata oleks „ei jõudnud" ainult uks, mis kinni käis. */}
            <Section
              {...sectionProps("urgentRequests")}
              title={t("my_sharings.sections.urgent_requests")}
              help={t("my_sharings.section_help.urgent_requests")}
              empty={t("my_sharings.empty.urgent_requests")}
              items={sharings.urgentRequests}
            >
              {sharings.urgentRequests.map((item) => {
                const busy = busyKey === `urgent:${item.id}`;
                return (
                  <Panel as="article" variant="glass" padding="sm" className={styles.card} key={item.id}>
                    <div className={styles.cardTopline}>
                      <div>
                        <span className={styles.eyebrow}>{t(`urgent.status.${item.status}`, item.status)}</span>
                        <h3>{t("my_sharings.labels.urgent_request")}</h3>
                      </div>
                      <time dateTime={item.sentAt || undefined}>{formatDate(item.sentAt)}</time>
                    </div>

                    <p className={styles.sharedText}>{item.situationVerbatim}</p>

                    <dl className={styles.meta}>
                      <div>
                        <dt>{t("urgent.desk.reading_time")}</dt>
                        <dd>{item.readingTimePromise}</dd>
                      </div>
                      {item.declineReason ? (
                        <div>
                          <dt>{t("my_sharings.labels.urgent_decline_reason")}</dt>
                          <dd>{item.declineReason}</dd>
                        </div>
                      ) : null}
                    </dl>

                    {item.canRecall ? (
                      <div className={styles.cardActions}>
                        <Button
                          variant="secondary"
                          disabled={busy || Boolean(busyKey)}
                          onClick={() => void recallUrgentRequest(item)}
                        >
                          {t("urgent.sent.recall")}
                        </Button>
                      </div>
                    ) : null}
                  </Panel>
                );
              })}
            </Section>

            <Section
              {...sectionProps("preInquiries")}
              title={t("my_sharings.sections.pre_inquiries")}
              help={t("my_sharings.section_help.pre_inquiries")}
              empty={t("my_sharings.empty.pre_inquiries")}
              items={sharings.preInquiries}
            >
              {sharings.preInquiries.map((item) => {
                const isCorrecting = correction?.id === item.id;
                const recipient = item.recipientLabel || t("my_sharings.labels.unknown_recipient");
                return (
                  <Panel as="article" variant="glass" padding="sm" className={styles.card} key={item.id}>
                    <div className={styles.cardTopline}>
                      <div>
                        <span className={styles.eyebrow}>{t(`my_sharings.status.${statusKey(item)}`)}</span>
                        <h3>{item.topic || recipient}</h3>
                      </div>
                      <time dateTime={item.sentAt || undefined}>{formatDate(item.sentAt)}</time>
                    </div>
                    <OwnershipBar
                      labels={ownershipLabels}
                      visibility={t(item.deliveryChannel === "EXTERNAL_EMAIL" ? "my_sharings.ownership.external_email" : "my_sharings.ownership.shared_with", { name: recipient })}
                      origin={t("my_sharings.ownership.you_sent")}
                      validity={preInquiryValidity(item)}
                    />
                    <p className={styles.memoryNote}>{t("my_sharings.notice.memory")}</p>
                    <div className={styles.actions}>
                      {item.canRecall ? (
                        <Button
                          variant="secondary"
                          disabled={Boolean(busyKey)}
                          onClick={() => openConfirmAction({ kind: "recall", item })}
                        >
                          {t("my_sharings.actions.recall")}
                        </Button>
                      ) : null}
                      {item.canCorrect ? (
                        <Button variant="secondary" disabled={Boolean(busyKey)} onClick={() => openCorrection(item)}>
                          {t("my_sharings.actions.correct")}
                        </Button>
                      ) : null}
                    </div>
                    {isCorrecting ? (
                      <Form className={styles.correctionForm} onSubmit={(event) => { event.preventDefault(); void sendCorrection(); }}>
                        <div className={styles.correctionHeading}>
                          <h4>{t("my_sharings.correction.title")}</h4>
                          <p>{t("my_sharings.notice.correction")}</p>
                        </div>
                        <label>
                          <span>{t("my_sharings.correction.topic")}</span>
                          <Input disabled={Boolean(busyKey)} maxLength={1000} value={correction.topic} onChange={(event) => setCorrection((current) => ({ ...current, topic: event.target.value }))} />
                        </label>
                        <label>
                          <span>{t("my_sharings.correction.situation")}</span>
                          <textarea required disabled={Boolean(busyKey)} maxLength={12000} rows={4} value={correction.situation} onChange={(event) => setCorrection((current) => ({ ...current, situation: event.target.value }))} />
                        </label>
                        <label>
                          <span>{t("my_sharings.correction.text")}</span>
                          <textarea required disabled={Boolean(busyKey)} maxLength={12000} rows={7} value={correction.text} onChange={(event) => setCorrection((current) => ({ ...current, text: event.target.value }))} />
                        </label>
                        {privacyPrompt ? (
                          <div className={styles.privacyPrompt} role="alert">
                            <h5>{t("my_sharings.correction.privacy_title")}</h5>
                            <p>{t("my_sharings.correction.privacy_body")}</p>
                            <div className={styles.actions}>
                              <Button type="button" variant="secondary" disabled={Boolean(busyKey)} onClick={() => void sendCorrection({ action: "use_redacted" })}>{t("my_sharings.actions.use_redacted")}</Button>
                              {privacyPrompt.allowOriginal ? <Button type="button" variant="secondary" disabled={Boolean(busyKey)} onClick={() => void sendCorrection({ action: "send_original" })}>{t("my_sharings.actions.send_original")}</Button> : null}
                            </div>
                          </div>
                        ) : null}
                        <div className={styles.actions}>
                          <Button type="submit" disabled={Boolean(busyKey)}>{t("my_sharings.actions.send_correction")}</Button>
                          <Button type="button" variant="secondary" disabled={Boolean(busyKey)} onClick={() => { setCorrection(null); setPrivacyPrompt(null); }}>{t("my_sharings.actions.cancel")}</Button>
                        </div>
                      </Form>
                    ) : null}
                  </Panel>
                );
              })}
              {sectionMeta.preInquiries?.paging?.hasMore ? (
                <Button
                  variant="secondary"
                  disabled={retryingSection === "preInquiries"}
                  onClick={() => void loadSharings({
                    preserveData: true,
                    section: "preInquiries",
                    cursor: sectionMeta.preInquiries.paging.nextCursor,
                    append: true
                  })}
                >
                  {t("my_sharings.actions.load_more")}
                </Button>
              ) : null}
            </Section>

            <Section {...sectionProps("rooms")} title={t("my_sharings.sections.rooms")} help={t("my_sharings.section_help.rooms")} empty={t("my_sharings.empty.rooms")} items={sharings.rooms}>
              {sharings.rooms.map((item) => (
                <Panel as="article" variant="glass" padding="sm" className={styles.card} key={item.id}>
                  <div className={styles.cardTopline}><h3>{item.title || t("my_sharings.sections.rooms")}</h3><span className={styles.eyebrow}>{t(item.role === "OWNER" ? "my_sharings.labels.room_owner" : "my_sharings.labels.room_member")}</span></div>
                  <OwnershipBar labels={ownershipLabels} visibility={t("my_sharings.ownership.room_members")} origin={t("my_sharings.ownership.you_joined")} validity={t(item.canLeave ? "my_sharings.ownership.active" : "my_sharings.ownership.owner")} />
                  {item.canLeave ? <div className={styles.actions}><Button variant="secondary" disabled={Boolean(busyKey)} onClick={() => openConfirmAction({ kind: "leave", item })}>{t("my_sharings.actions.leave_room")}</Button></div> : null}
                </Panel>
              ))}
            </Section>

            <Section {...sectionProps("invites")} title={t("my_sharings.sections.invites")} help={t("my_sharings.section_help.invites")} empty={t("my_sharings.empty.invites")} items={sharings.invites}>
              {sharings.invites.map((item) => (
                <Panel as="article" variant="glass" padding="sm" className={styles.card} key={item.id}>
                  <div className={styles.cardTopline}><div><span className={styles.eyebrow}>{t(`my_sharings.status.${String(item.status).toLowerCase()}`)}</span><h3>{item.roomTitle || item.inviteeEmail}</h3></div><time dateTime={item.expiresAt}>{formatDate(item.expiresAt)}</time></div>
                  <OwnershipBar labels={ownershipLabels} visibility={t("my_sharings.ownership.invite_recipient", { name: item.inviteeEmail })} origin={t("my_sharings.ownership.you_invited")} validity={t("my_sharings.ownership.expires", { date: formatDate(item.expiresAt) })} />
                  {item.canRevoke ? <div className={styles.actions}><Button variant="secondary" disabled={Boolean(busyKey)} onClick={() => openConfirmAction({ kind: "revoke", item })}>{t("my_sharings.actions.revoke_invite")}</Button></div> : null}
                </Panel>
              ))}
            </Section>

            <Section {...sectionProps("helpListings")} title={t("my_sharings.sections.help")} help={t("my_sharings.section_help.help")} empty={t("my_sharings.empty.help")} items={sharings.helpListings}>
              {sharings.helpListings.map((item) => (
                <Panel as="article" variant="glass" padding="sm" className={styles.card} key={`${item.kind}:${item.id}`}>
                  <div className={styles.cardTopline}><div><span className={styles.eyebrow}>{t(`my_sharings.labels.${item.kind}`)}</span><h3>{item.title || t(`my_sharings.labels.${item.kind}`)}</h3></div><span>{t(`my_sharings.status.${String(item.status).toLowerCase()}`)}</span></div>
                  <OwnershipBar labels={ownershipLabels} visibility={t(helpMapVisibilityKey(item))} origin={t("my_sharings.ownership.you_submitted_help")} validity={item.expiresAt ? t("my_sharings.ownership.expires", { date: formatDate(item.expiresAt) }) : t("my_sharings.ownership.no_expiry")} />
                </Panel>
              ))}
            </Section>

            <Section {...sectionProps("mentoringPreparations")} title={t("my_sharings.mentoring.section_title")} help={t("my_sharings.mentoring.section_help")} empty={t("my_sharings.mentoring.empty")} items={sharings.mentoringPreparations || []}>
              {(sharings.mentoringPreparations || []).map((item) => (
                <Panel as="article" variant="glass" padding="sm" className={styles.card} key={item.id}>
                  <div className={styles.cardTopline}>
                    <div>
                      <span className={styles.eyebrow}>
                        {t(item.recalledAt
                          ? "my_sharings.mentoring.recalled"
                          : item.openedAt
                            ? "my_sharings.mentoring.opened"
                            : item.sharedAt
                              ? "my_sharings.mentoring.shared"
                              : "my_sharings.mentoring.private")}
                      </span>
                      <h3>{t("my_sharings.mentoring.item_title")}</h3>
                    </div>
                    <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
                  </div>
                  <OwnershipBar
                    labels={ownershipLabels}
                    visibility={t(item.sharedAt && !item.recalledAt
                      ? "my_sharings.mentoring.visible_to_mentor"
                      : "my_sharings.ownership.private_record")}
                    origin={t("my_sharings.mentoring.origin")}
                    validity={item.sharedAt
                      ? t("my_sharings.mentoring.shared_at", { date: formatDate(item.sharedAt) })
                      : t("my_sharings.ownership.active")}
                  />
                  {item.relationId ? (
                    <div className={styles.actions}>
                      {item.canRecall ? (
                        <Button
                          variant="secondary"
                          disabled={Boolean(busyKey)}
                          onClick={() => openConfirmAction({ kind: "mentoringRecall", item })}
                        >
                          {t("my_sharings.actions.recall")}
                        </Button>
                      ) : null}
                      <Button
                        variant="secondary"
                        disabled={Boolean(busyKey)}
                        onClick={() => {
                          pushWithTransition(router, localizePath(`/mentorlus/suhe/${item.relationId}`, locale));
                        }}
                      >
                        {t("my_sharings.mentoring.open_relation")}
                      </Button>
                    </div>
                  ) : item.sharedAt && !item.recalledAt && !item.openedAt ? (
                    <p role="status" className={styles.memoryNote}>{t("my_sharings.mentoring.action_unavailable")}</p>
                  ) : null}
                </Panel>
              ))}
            </Section>

            <Section {...sectionProps("outgoingNetworkShares")} title={t("my_sharings.sections.outgoing_network_shares")} help={t("my_sharings.section_help.outgoing_network_shares")} empty={t("my_sharings.empty.outgoing_network_shares")} items={sharings.outgoingNetworkShares}>
              {sharings.outgoingNetworkShares.map((item) => (
                <Panel as="article" variant="glass" padding="sm" className={styles.card} key={item.id}>
                  <div className={styles.cardTopline}><h3>{item.recipientLabel || t("my_sharings.labels.unknown_recipient")}</h3><span>{t(`my_sharings.share_status.${item.status}`, item.status)}</span></div>
                  <OwnershipBar labels={ownershipLabels} visibility={t("my_sharings.ownership.shared_with", { name: item.recipientLabel || t("my_sharings.labels.unknown_recipient") })} origin={t("my_sharings.ownership.you_sent")} validity={item.participationEndsOn ? t("my_sharings.ownership.expires", { date: formatDate(item.participationEndsOn) }) : t("my_sharings.ownership.active")} />
                </Panel>
              ))}
            </Section>

            <Section {...sectionProps("wellbeingSupportShares")} title={t("my_sharings.sections.wellbeing_support_shares")} help={t("my_sharings.section_help.wellbeing_support_shares")} empty={t("my_sharings.empty.wellbeing_support_shares")} items={sharings.wellbeingSupportShares}>
              {sharings.wellbeingSupportShares.map((item) => (
                <Panel as="article" variant="glass" padding="sm" className={styles.card} key={item.id}>
                  <div className={styles.cardTopline}><h3>{item.recipientLabel || item.organizationName || t("my_sharings.labels.unknown_recipient")}</h3><span>{t(`my_sharings.share_status.${item.status}`, item.status)}</span></div>
                  <OwnershipBar labels={ownershipLabels} visibility={t("my_sharings.ownership.shared_with", { name: item.recipientLabel || item.organizationName || t("my_sharings.labels.unknown_recipient") })} origin={t("my_sharings.ownership.you_sent")} validity={item.closedAt ? t("my_sharings.ownership.closed", { date: formatDate(item.closedAt) }) : t("my_sharings.ownership.active")} />
                </Panel>
              ))}
            </Section>

            <Section {...sectionProps("serviceReportShares")} title={t("my_sharings.sections.service_report_shares")} help={t("my_sharings.section_help.service_report_shares")} empty={t("my_sharings.empty.service_report_shares")} items={sharings.serviceReportShares}>
              {sharings.serviceReportShares.map((item) => (
                <Panel as="article" variant="glass" padding="sm" className={styles.card} key={item.id}>
                  <div className={styles.cardTopline}><h3>{item.recipientLabel || t("my_sharings.labels.unknown_recipient")}</h3><span>{item.month}</span></div>
                  <OwnershipBar labels={ownershipLabels} visibility={t("my_sharings.ownership.shared_with", { name: item.recipientLabel || t("my_sharings.labels.unknown_recipient") })} origin={t("my_sharings.ownership.you_sent")} validity={item.recalledAt ? t("my_sharings.ownership.recalled", { date: formatDate(item.recalledAt) }) : t("my_sharings.ownership.active")} />
                </Panel>
              ))}
            </Section>

            <Section {...sectionProps("roomSummaries")} title={t("my_sharings.sections.room_summaries")} help={t("my_sharings.section_help.room_summaries")} empty={t("my_sharings.empty.room_summaries")} items={sharings.roomSummaries}>
              {sharings.roomSummaries.map((item) => (
                <Panel as="article" variant="glass" padding="sm" className={styles.card} key={item.id}>
                  <div className={styles.cardTopline}><h3>{item.title || item.roomTitle || t("my_sharings.sections.room_summaries")}</h3><time dateTime={item.sharedAt || undefined}>{formatDate(item.sharedAt)}</time></div>
                  <OwnershipBar labels={ownershipLabels} visibility={t("my_sharings.ownership.room_members")} origin={t("my_sharings.ownership.you_sent")} validity={t("my_sharings.ownership.active")} />
                </Panel>
              ))}
            </Section>

            <Section {...sectionProps("privateRecords")} title={t("my_sharings.sections.private_records")} help={t("my_sharings.section_help.private_records")} empty={t("my_sharings.empty.private_records")} items={sharings.privateRecords}>
              {sharings.privateRecords.map((item) => (
                <Panel as="article" variant="glass" padding="sm" className={styles.card} key={`${item.privateType}:${item.id}`}>
                  <div className={styles.cardTopline}><h3>{item.frameworkKey || t("my_sharings.labels.private_record")}</h3><span>{item.frameworkVersion || ""}</span></div>
                  <OwnershipBar labels={ownershipLabels} visibility={t("my_sharings.ownership.private_record")} origin={t("my_sharings.ownership.you_confirmed")} validity={t("my_sharings.ownership.accepted", { date: formatDate(item.createdAt) })} />
                </Panel>
              ))}
            </Section>
          </div>
        ) : null}
      </div>

      {confirmAction ? (
        <ModalConfirm
          message={t(`my_sharings.confirm.${confirmAction.kind}`)}
          confirmLabel={t(`my_sharings.actions.${["recall", "mentoringRecall"].includes(confirmAction.kind) ? "recall" : confirmAction.kind === "revoke" ? "revoke_invite" : "leave_room"}`)}
          cancelLabel={t("my_sharings.actions.cancel")}
          disabled={Boolean(busyKey)}
          overlayClassName={styles.modalOverlay}
          contentClassName={styles.modalContent}
          actionsClassName={styles.modalActions}
          onConfirm={runConfirmedAction}
          onCancel={() => { if (!mutationInFlightRef.current) setConfirmAction(null); }}
        >
          {actionError ? <p className={styles.modalError} role="alert">{actionError}</p> : null}
        </ModalConfirm>
      ) : null}
    </main>
  );
}
