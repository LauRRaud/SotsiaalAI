import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { createSSEReader as defaultCreateSSEReader } from "../utils/sse";
import { normalizeSources as defaultNormalizeSources } from "../utils/sources";
import { localizePath } from "@/lib/localizePath";

function formatI18n(template, values) {
  if (!values) return template;
  let out = template;
  for (const [key, value] of Object.entries(values)) {
    out = out.split(`{${key}}`).join(String(value));
  }
  return out;
}

function createLocalizedError(key, values) {
  const err = new Error(key);
  err.chatKey = key;
  err.chatValues = values;
  return err;
}

function readApiErrorKey(payload) {
  const key = typeof payload?.messageKey === "string" ? payload.messageKey.trim() : "";
  if (key) return key;
  const message = typeof payload?.message === "string" ? payload.message.trim() : "";
  if (!message) return "";
  if (/^[a-z][a-z0-9_.:-]*$/i.test(message)) return message;
  return "";
}

function getResearchProgressText(tr, stage) {
  if (stage === "planning") return tr("chat.deep_research.stage_planning");
  if (stage === "retrieving") return tr("chat.deep_research.stage_retrieving");
  if (stage === "synthesizing") return tr("chat.deep_research.stage_synthesizing");
  return tr("chat.deep_research.running");
}

function normalizeAttachments(payload) {
  if (!Array.isArray(payload)) return [];
  return payload
    .filter(item => item && typeof item === "object")
    .map(item => {
      const label = String(item.label || "").trim();
      const url = String(item.url || "").trim();
      const fileName = String(item.fileName || "").trim();
      const format = String(item.format || "").trim();
      if (!url) return null;
      return {
        label: label || "Download file",
        url,
        ...(fileName ? { fileName } : {}),
        ...(format ? { format } : {})
      };
    })
    .filter(Boolean);
}

function normalizeCards(payload) {
  if (!Array.isArray(payload)) return [];
  return payload
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const title = String(item.title || "").trim();
      const subtitle = String(item.subtitle || "").trim();
      const body = String(item.body || "").trim();
      const meta = String(item.meta || "").trim();
      const hint = String(item.hint || "").trim();
      if (!title && !body) return null;
      return {
        ...(title ? { title } : {}),
        ...(subtitle ? { subtitle } : {}),
        ...(body ? { body } : {}),
        ...(meta ? { meta } : {}),
        ...(hint ? { hint } : {})
      };
    })
    .filter(Boolean);
}

function normalizeWorkflow(payload) {
  return payload && typeof payload === "object" ? payload : null;
}

function isCompletedChatRunPayload(payload) {
  if (!payload || typeof payload !== "object") return false;
  const status = String(payload.status || "").trim().toUpperCase();
  const text = String(payload.text || "").trim();
  return status === "COMPLETED" && text.length > 0;
}

function normalizeComparableText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function persistedResultMatchesRequest(payload, expectedUserText, startedAtMs) {
  const expected = normalizeComparableText(expectedUserText);
  const messages = Array.isArray(payload?.messages) ? payload.messages : [];
  if (messages.length) {
    let latestAssistantIndex = -1;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (String(messages[i]?.role || "").toLowerCase() === "ai") {
        latestAssistantIndex = i;
        break;
      }
    }
    if (latestAssistantIndex === -1) return false;
    for (let i = latestAssistantIndex - 1; i >= 0; i -= 1) {
      if (String(messages[i]?.role || "").toLowerCase() !== "user") continue;
      return !expected || normalizeComparableText(messages[i]?.text) === expected;
    }
    return false;
  }

  const updatedAtMs = Date.parse(String(payload?.updatedAt || ""));
  return Number.isFinite(updatedAtMs) && updatedAtMs >= Math.max(0, Number(startedAtMs) || 0) - 1000;
}

async function readPersistedConversationResult({ convId, normalizeSources, expectedUserText, startedAtMs }) {
  const id = String(convId || "").trim();
  if (!id) return null;
  const response = await fetch(`/api/chat/run?convId=${encodeURIComponent(id)}`, {
    cache: "no-store"
  });
  if (!response.ok) return null;
  const payload = await response.json().catch(() => null);
  if (!isCompletedChatRunPayload(payload)) return null;
  if (!persistedResultMatchesRequest(payload, expectedUserText, startedAtMs)) return null;
  const normalize = normalizeSources || defaultNormalizeSources;
  return {
    text: String(payload.text || "").trim(),
    sources: normalize(
      Array.isArray(payload.displayed_sources)
        ? payload.displayed_sources
        : payload.sources ?? []
    ),
    attachments: normalizeAttachments(payload.attachments),
    cards: normalizeCards(payload.cards),
    workflow: normalizeWorkflow(payload.workflow)
  };
}

function dispatchHelpListingsRefresh(workflow) {
  if (typeof window === "undefined") return;
  const helpState = workflow?.help;
  if (!helpState || typeof helpState !== "object") return;
  const justSaved =
    helpState.step === "saved" ||
    helpState.mode === "saved" ||
    (
      helpState.step === "browse" &&
      helpState.mode === "browse" &&
      !!helpState.sourceRecordId
    );
  if (!justSaved) return;
  try {
    window.dispatchEvent(new CustomEvent("sotsiaalai:refresh-help-listings"));
  } catch {}
}

export function useChatStream(config) {
  const cfgRef = useRef(config);

  useEffect(() => {
    cfgRef.current = config;
  }, [config]);

  const [isGenerating, setIsGenerating] = useState(false);
  const isGeneratingRef = useRef(false);

  useEffect(() => {
    isGeneratingRef.current = isGenerating;
  }, [isGenerating]);

  const abortRef = useRef(null);
  const researchJobIdRef = useRef(null);
  const researchStreamingMessageIdRef = useRef(null);

  const stop = useCallback(() => {
    const activeResearchJobId = researchJobIdRef.current;
    if (activeResearchJobId && typeof fetch === "function") {
      fetch(`/api/research/jobs/${encodeURIComponent(activeResearchJobId)}`, {
        method: "DELETE"
      }).catch(() => {});
    }
    try {
      abortRef.current?.abort?.();
    } catch {}
    abortRef.current = null;
    researchJobIdRef.current = null;
    researchStreamingMessageIdRef.current = null;
    isGeneratingRef.current = false;
    setIsGenerating(false);
  }, []);

  const sendMessage = useCallback(async (rawText, options = {}) => {
    const cfg = cfgRef.current;
    const tr = (key, values) => {
      const value = cfg?.t?.(key);
      const text = typeof value === "string" && value.trim() ? value : key;
      return formatI18n(text, values);
    };

    const text = String(rawText ?? "").trim();
    if (!text) return false;
    if (isGeneratingRef.current) return false;

    cfg.setErrorBanner?.(null);
    cfg.setIsCrisis?.(false);

    if (cfg.isRoomMode) {
      if (cfg.roomBlocked) {
        return false;
      }
      if (cfg.roomAuthRequired) {
        return false;
      }

      try {
        const roomPathId = encodeURIComponent(String(cfg.roomId || ""));
        const res = await fetch(`/api/rooms/${roomPathId}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            content: text,
            privacyDecision: options?.privacyDecision
          })
        });
        const data = await res.json().catch(() => ({}));

        if (res.status === 403) {
          return false;
        }
        if (res.status === 401) {
          return false;
        }
        if (!res.ok || data?.ok === false) {
          throw createLocalizedError("chat.room.send_error");
        }

        if (data?.message?.id && cfg.sendToAssistant) {
          cfg.onRoomMessageSent?.(data.message.id);
        }
      } catch {
        cfg.setErrorBanner?.(tr("chat.room.send_error"));
        return false;
      }
    }

    if (cfg.activeWorkflow === "deep_research" && !cfg.isRoomMode) {
      cfg.appendMessage?.({
        role: "user",
        text,
        aiVisible: true
      });

      isGeneratingRef.current = true;
      setIsGenerating(true);
      cfg.onFocusInput?.();

      const controller = new AbortController();
      abortRef.current = controller;

      let streamingMessageId = null;
      let finalText = "";
      let finalSources = [];
      let completionState = "error";
      let completedFromPersistence = false;
      let persistencePollTimer = null;
      let persistencePollBusy = false;
      let researchStartedAtMs = 0;

      const clearPersistencePoll = () => {
        if (persistencePollTimer && typeof window !== "undefined") {
          window.clearInterval(persistencePollTimer);
        }
        persistencePollTimer = null;
      };

      const applyPersistedResult = persisted => {
        if (!persisted?.text || streamingMessageId == null) return false;
        completedFromPersistence = true;
        completionState = "done";
        finalText = persisted.text;
        finalSources = persisted.sources;
        cfg.mutateMessage?.(streamingMessageId, msg => ({
          ...msg,
          text: persisted.text,
          sources: persisted.sources,
          attachments: persisted.attachments,
          cards: persisted.cards,
          workflow: persisted.workflow || normalizeWorkflow(msg?.workflow),
          isStreaming: false
        }));
        clearPersistencePoll();
        try {
          controller.abort();
        } catch {}
        return true;
      };

      const pollPersistedResult = async () => {
        if (completedFromPersistence || persistencePollBusy || !cfg.convId) return;
        persistencePollBusy = true;
        try {
          const persisted = await readPersistedConversationResult({
            convId: cfg.convId,
            normalizeSources: cfg.normalizeSources || defaultNormalizeSources,
            expectedUserText: text,
            startedAtMs: researchStartedAtMs
          });
          if (persisted?.text) {
            applyPersistedResult(persisted);
          }
        } catch {
        } finally {
          persistencePollBusy = false;
        }
      };

      const runResearch = async () => {
        try {
          const createResponse = await fetch("/api/research/jobs", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              query: text,
              convId: cfg.convId,
              persist: true,
              uiLocale: cfg.locale || "et"
            }),
            signal: controller.signal
          });
          const createPayload = await createResponse.json().catch(() => ({}));

          if (createResponse.status === 401) {
            if (cfg.onAuthRedirect) {
              cfg.onAuthRedirect();
            } else if (typeof window !== "undefined") {
              const callbackUrl = localizePath("/vestlus", cfg.locale || "et");
              const params = new URLSearchParams({
                callbackUrl
              });
              window.location.href = `/api/auth/signin?${params.toString()}`;
            }
            return true;
          }

          if (createResponse.status === 403) {
            if (createPayload?.requireSubscription && createPayload?.redirect && typeof window !== "undefined") {
              window.location.href = String(createPayload.redirect);
              return true;
            }
            throw createLocalizedError(readApiErrorKey(createPayload) || "chat.deep_research.error_generic");
          }

          if (createResponse.status === 429) {
            const key = readApiErrorKey(createPayload);
            if (key) throw createLocalizedError(key);
            throw createLocalizedError("chat.error.rate_limit_generic");
          }

          if (!createResponse.ok || createPayload?.ok === false || !createPayload?.id) {
            throw createLocalizedError(readApiErrorKey(createPayload) || "chat.deep_research.error_generic");
          }

          const jobId = String(createPayload.id || "").trim();
          if (!jobId) {
            throw createLocalizedError("chat.deep_research.error_generic");
          }
          researchJobIdRef.current = jobId;
          researchStartedAtMs = Date.now();

          streamingMessageId = cfg.appendMessage?.({
            role: "ai",
            text: tr("chat.deep_research.running"),
            isStreaming: true,
            aiVisible: true,
            ...(cfg.isRoomMode ? { roomScoped: true } : {})
          });
          researchStreamingMessageIdRef.current = streamingMessageId;
          cfg.onAssistantMessageCreated?.(streamingMessageId);
          if (typeof window !== "undefined") {
            persistencePollTimer = window.setInterval(() => {
              void pollPersistedResult();
            }, 2500);
          }

          const streamResponse = await fetch(`/api/research/jobs/${encodeURIComponent(jobId)}/stream`, {
            cache: "no-store",
            signal: controller.signal
          });
          if (!streamResponse.ok || !streamResponse.body) {
            const streamPayload = await streamResponse.json().catch(() => ({}));
            throw createLocalizedError(readApiErrorKey(streamPayload) || "chat.deep_research.error_generic");
          }

          const reader = (cfg.createSSEReader || defaultCreateSSEReader)(streamResponse.body);

          for await (const ev of reader) {
            if (completedFromPersistence) break;
            if (ev.event === "status") {
              try {
                const payload = JSON.parse(ev.data || "{}");
                const status = String(payload?.status || "").trim();
                if ((status === "queued" || status === "running") && streamingMessageId != null) {
                  cfg.mutateMessage?.(streamingMessageId, msg => ({
                    ...msg,
                    text: tr("chat.deep_research.running"),
                    isStreaming: true
                  }));
                } else if (status === "done") {
                  completionState = "done";
                } else if (status === "cancelled") {
                  completionState = "cancelled";
                }
              } catch {}
              continue;
            }

            if (ev.event === "progress") {
              try {
                const payload = JSON.parse(ev.data || "{}");
                const stage = String(payload?.stage || "").trim();
                if (streamingMessageId != null) {
                  cfg.mutateMessage?.(streamingMessageId, msg => ({
                    ...msg,
                    text: getResearchProgressText(tr, stage),
                    isStreaming: true
                  }));
                }
              } catch {}
              continue;
            }

            if (ev.event === "result") {
              try {
                const payload = JSON.parse(ev.data || "{}");
                finalText = String(payload?.result?.report_text || "").trim();
                const normalize = cfg.normalizeSources || defaultNormalizeSources;
                finalSources = normalize(payload?.result?.sources ?? []);
              } catch {}
              continue;
            }

            if (ev.event === "error") {
              let errorKey = "chat.deep_research.error_generic";
              try {
                const payload = JSON.parse(ev.data || "{}");
                const apiKey = readApiErrorKey(payload);
                if (apiKey === "research.error.cancelled") {
                  errorKey = "chat.deep_research.cancelled";
                } else if (apiKey) {
                  errorKey = apiKey;
                }
              } catch {}
              throw createLocalizedError(errorKey);
            }

            if (ev.event === "done") {
              break;
            }
          }
          clearPersistencePoll();

          if (!finalText) {
            const persisted = await readPersistedConversationResult({
              convId: cfg.convId,
              normalizeSources: cfg.normalizeSources || defaultNormalizeSources,
              expectedUserText: text,
              startedAtMs: researchStartedAtMs
            }).catch(() => null);
            if (persisted?.text) {
              applyPersistedResult(persisted);
            }
          }

          if (streamingMessageId != null) {
            const nextText =
              finalText ||
              (completionState === "cancelled"
                ? tr("chat.deep_research.cancelled")
                : tr("chat.deep_research.error_generic"));
            cfg.mutateMessage?.(streamingMessageId, msg => ({
              ...msg,
              text: nextText,
              sources: finalSources,
              isStreaming: false
            }));
          }

          if (completionState === "done" && finalText) {
            cfg.onDeepResearchComplete?.();
            cfg.requestConversationsRefresh?.();
            return true;
          }
          if (completionState === "cancelled") {
            return false;
          }
          throw createLocalizedError("chat.deep_research.error_generic");
        } catch (err) {
          clearPersistencePoll();
          if (err?.name === "AbortError" && completedFromPersistence && finalText) {
            cfg.onDeepResearchComplete?.();
            cfg.requestConversationsRefresh?.();
            return true;
          }
          const errorKey =
            err?.name === "AbortError"
              ? "chat.deep_research.cancelled"
              : err?.chatKey === "research.error.cancelled"
                ? "chat.deep_research.cancelled"
                : err?.chatKey || "chat.deep_research.error_generic";
          const errorText = tr(errorKey, err?.chatValues);

          if (streamingMessageId != null) {
            cfg.mutateMessage?.(streamingMessageId, msg => ({
              ...msg,
              text: errorText,
              sources: [],
              isStreaming: false
            }));
          } else {
            cfg.appendMessage?.({
              role: "ai",
              text: errorText,
              ...(cfg.isRoomMode ? { roomScoped: true } : {})
            });
          }
          return false;
        } finally {
          clearPersistencePoll();
          abortRef.current = null;
          researchJobIdRef.current = null;
          researchStreamingMessageIdRef.current = null;
          isGeneratingRef.current = false;
          setIsGenerating(false);
          cfg.onFocusInput?.();
        }
      };

      void runResearch();
      return true;
    }

    const shouldSendToAssistant = cfg.isRoomMode ? cfg.sendToAssistant : true;
    const isInitialHelpLaunch =
      (cfg.activeWorkflow === "help_request" || cfg.activeWorkflow === "help_offer")
      && Array.isArray(cfg.historyPayload)
      && cfg.historyPayload.length === 0;
    const selectedChatMode = isInitialHelpLaunch
      ? cfg.activeWorkflow
      : "rag";

    cfg.appendMessage?.({
      role: "user",
      text,
      aiVisible: shouldSendToAssistant
    });

    isGeneratingRef.current = shouldSendToAssistant;
    setIsGenerating(shouldSendToAssistant);
    cfg.onFocusInput?.();

    if (!shouldSendToAssistant) return true;

    const controller = new AbortController();
    abortRef.current = controller;

    const clientTimeout = setTimeout(() => controller.abort(), 180000);
    let streamingMessageId = null;
    let visibleText = "";
    let sources = [];
    let attachments = [];
    let cards = [];
    let workflow = null;
    streamingMessageId = cfg.appendMessage?.({
      role: "ai",
      text: "",
      isStreaming: true,
      aiVisible: true,
      ...(cfg.isRoomMode ? { roomScoped: true } : {})
    });
    cfg.onAssistantMessageCreated?.(streamingMessageId);
    const latestHelpWorkflowState = !cfg.isRoomMode && typeof cfg.getLatestHelpWorkflowState === "function"
      ? normalizeWorkflow(cfg.getLatestHelpWorkflowState())
      : normalizeWorkflow(cfg.helpWorkflowState);
    const doPushVisibleText = () => {
      if (streamingMessageId == null) return;
      startTransition(() => {
        cfg.mutateMessage?.(streamingMessageId, msg => ({
          ...msg,
          text: visibleText
        }));
      });
    };

    const flushAllPending = () => {
      doPushVisibleText();
    };

    const runStream = async () => {
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            message: text,
            history: cfg.historyPayload,
            role: cfg.userRole,
            stream: true,
            persist: true,
            convId: cfg.convId,
            uiLocale: cfg.locale || "et",
            chatMode: selectedChatMode,
            helpWorkflowState: !cfg.isRoomMode && latestHelpWorkflowState && typeof latestHelpWorkflowState === "object"
              ? latestHelpWorkflowState
              : undefined,
            roomId: cfg.isRoomMode ? cfg.roomId : undefined,
            privacyDecision: options?.privacyDecision,
            ...(cfg.ephemeralChunks?.length
              ? {
                  ephemeralChunks: cfg.ephemeralChunks,
                  ...((cfg.ephemeralSource?.fileName || cfg.uploadPreview?.fileName)
                    ? {
                        ephemeralSource: {
                          fileName: cfg.ephemeralSource?.fileName || cfg.uploadPreview?.fileName,
                          ...(Array.isArray(cfg.ephemeralSource?.fileNames) && cfg.ephemeralSource.fileNames.length
                            ? {
                                fileNames: cfg.ephemeralSource.fileNames
                              }
                            : {})
                        }
                      }
                    : {}),
                  combineSources: !cfg.docOnlyMode
                }
              : {})
          }),
          signal: controller.signal
        });

        clearTimeout(clientTimeout);

        let parsedBody = null;
        let parsedBodyLoaded = false;
        const readJsonBody = async () => {
          if (parsedBodyLoaded) return parsedBody;
          parsedBodyLoaded = true;
          try {
            parsedBody = await res.json();
          } catch {
            parsedBody = null;
          }
          return parsedBody;
        };
        if (res.status === 401) {
          cfg.mutateMessage?.(streamingMessageId, msg => ({
            ...msg,
            text: tr("chat.room.auth_required"),
            isStreaming: false
          }));
          streamingMessageId = null;
          if (cfg.onAuthRedirect) {
            cfg.onAuthRedirect();
          } else if (typeof window !== "undefined") {
            const callbackUrl = localizePath("/vestlus", cfg.locale || "et");
            const params = new URLSearchParams({
              callbackUrl
            });
            window.location.href = `/api/auth/signin?${params.toString()}`;
          }
          return true;
        }

        if (res.status === 403) {
          const data = await readJsonBody();
          if (data?.requireSubscription && data?.redirect && typeof window !== "undefined") {
            cfg.mutateMessage?.(streamingMessageId, msg => ({
              ...msg,
              text: tr("chat.error.subscription_required_profile"),
              isStreaming: false
            }));
            streamingMessageId = null;
            window.location.href = String(data.redirect);
            return true;
          }
          const key = readApiErrorKey(data);
          throw createLocalizedError(key || (cfg.isRoomMode ? "chat.room.blocked" : "api.common.forbidden"));
        }

        if (res.status === 429) {
          const data = await readJsonBody();
          const key = readApiErrorKey(data);
          if (key) {
            throw createLocalizedError(key);
          }
          const retry = res.headers.get("retry-after");
          if (retry) {
            throw createLocalizedError("chat.error.rate_limit_retry", {
              seconds: retry
            });
          }
          throw createLocalizedError("chat.error.rate_limit_generic");
        }

        const contentType = res.headers.get("content-type") || "";

        if (!contentType.includes("text/event-stream")) {
          const data = await readJsonBody();

          if (!res.ok) {
            throw createLocalizedError(readApiErrorKey(data) || "chat.error.no_response");
          }

          const replyText = (data?.answer ?? data?.reply) || tr("chat.error.no_answer");
          const normalize = cfg.normalizeSources || defaultNormalizeSources;
          const normSources = normalize(Array.isArray(data?.displayed_sources) ? data.displayed_sources : data?.sources);
          const attachments = normalizeAttachments(data?.attachments);
          const cards = normalizeCards(data?.cards);
          const workflow = normalizeWorkflow(data?.workflow);

          cfg.setIsCrisis?.(!!data?.isCrisis);

          cfg.mutateMessage?.(streamingMessageId, msg => ({
            ...msg,
            text: replyText,
            sources: normSources,
            attachments,
            cards,
            workflow,
            isStreaming: false
          }));

          dispatchHelpListingsRefresh(workflow);
          cfg.requestConversationsRefresh?.();
          streamingMessageId = null;
          return true;
        }

        if (!res.ok) {
          const data = await readJsonBody();
          throw createLocalizedError(readApiErrorKey(data) || "chat.error.no_response");
        }

        if (!res.body) {
          throw createLocalizedError("chat.error.stream_missing");
        }

        const reader = (cfg.createSSEReader || defaultCreateSSEReader)(res.body);

        for await (const ev of reader) {
          if (ev.event === "meta") {
            try {
              const payload = JSON.parse(ev.data);
              const rawSources = Array.isArray(payload?.sources)
                ? (Array.isArray(payload?.displayed_sources) ? payload.displayed_sources : payload.sources)
                : Array.isArray(payload?.displayed_sources)
                  ? payload.displayed_sources
                  : Array.isArray(payload?.groups)
                    ? payload.groups
                    : null;
              if (rawSources) {
                const normalize = cfg.normalizeSources || defaultNormalizeSources;
                sources = normalize(rawSources);
                cfg.mutateMessage?.(streamingMessageId, msg => ({
                  ...msg,
                  sources
                }));
              }
              workflow = normalizeWorkflow(payload?.workflow);
              if (workflow) {
                cfg.mutateMessage?.(streamingMessageId, msg => ({
                  ...msg,
                  workflow
                }));
              }
              if (typeof payload?.isCrisis !== "undefined") {
                cfg.setIsCrisis?.(!!payload.isCrisis);
              }
            } catch {}
          } else if (ev.event === "delta") {
            try {
              const payload = JSON.parse(ev.data);
              if (payload?.t) {
                visibleText += payload.t;
                doPushVisibleText();
              }
            } catch {}
          } else if (ev.event === "error") {
            throw createLocalizedError("chat.error.stream_failed");
          } else if (ev.event === "done") {
            try {
              const payload = ev?.data ? JSON.parse(ev.data) : {};
              attachments = normalizeAttachments(payload?.attachments);
              cards = normalizeCards(payload?.cards);
              const doneSources = Array.isArray(payload?.displayed_sources)
                ? payload.displayed_sources
                : Array.isArray(payload?.sources)
                  ? payload.sources
                  : null;
              if (doneSources) {
                const normalize = cfg.normalizeSources || defaultNormalizeSources;
                sources = normalize(doneSources);
              }
            } catch {}
            break;
          }
        }

        flushAllPending();

        cfg.mutateMessage?.(streamingMessageId, msg => ({
          ...msg,
          text: (visibleText || "").trim() || tr("chat.error.no_answer"),
          sources,
          attachments,
          cards,
          workflow: workflow || normalizeWorkflow(msg?.workflow),
          isStreaming: false
        }));

        dispatchHelpListingsRefresh(workflow);
        cfg.requestConversationsRefresh?.();
        streamingMessageId = null;
        return true;
      } catch (err) {
        flushAllPending();
        clearTimeout(clientTimeout);

        if (err?.name === "AbortError") {
          if (streamingMessageId != null) {
            cfg.mutateMessage?.(streamingMessageId, msg => ({
              ...msg,
              text: msg.text
                ? `${msg.text}\n\n${tr("chat.error.interrupted_suffix")}`
                : tr("chat.error.interrupted"),
              isStreaming: false
            }));
            streamingMessageId = null;
          } else {
            cfg.appendMessage?.({
              role: "ai",
              text: tr("chat.error.interrupted"),
              ...(cfg.isRoomMode ? { roomScoped: true } : {})
            });
          }
        } else {
          const isSilentRoomAccessError =
            cfg.isRoomMode &&
            (err?.chatKey === "chat.room.blocked" || err?.chatKey === "chat.room.auth_required");
          if (isSilentRoomAccessError) {
            return false;
          }
          const isSubscriptionRequired = err?.chatKey === "api.common.subscription_required";
          const errText = isSubscriptionRequired
            ? tr("chat.error.subscription_required_profile")
            : err?.chatKey
              ? tr(err.chatKey, err.chatValues)
              : tr("chat.error.generic");
          const errWithPrefix = isSubscriptionRequired
            ? errText
            : tr("chat.error.with_detail", {
                message: errText
              });

          if (streamingMessageId != null) {
            cfg.mutateMessage?.(streamingMessageId, msg => ({
              ...msg,
              text: errWithPrefix,
              sources: [],
              cards: [],
              isStreaming: false
            }));
            streamingMessageId = null;
          } else {
            cfg.appendMessage?.({
              role: "ai",
              text: errWithPrefix,
              ...(cfg.isRoomMode ? { roomScoped: true } : {})
            });
          }
        }

        return false;
      } finally {
        abortRef.current = null;
        isGeneratingRef.current = false;
        setIsGenerating(false);
        cfg.onFocusInput?.();
      }
    };

    void runStream();
    return true;
  }, []);

  return {
    isGenerating,
    sendMessage,
    stop
  };
}
