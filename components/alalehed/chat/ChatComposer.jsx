"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Button from "@/components/ui/Button";
import { MAX_USER_MESSAGE_CHARS, MESSAGE_COUNTER_VISIBLE_FROM } from "@/lib/chat/messageLimits";

function resolvePrivacyWorkflow({ activeModeKey, isRoomMode }) {
  if (isRoomMode) return "room_private";
  if (activeModeKey === "help_request") return "help_request_public";
  if (activeModeKey === "help_offer") return "help_offer_public";
  if (activeModeKey === "pre_inquiry") return "pre_inquiry";
  if (activeModeKey === "document") return "document_generation";
  return "chat_private";
}

function privacyLabels(t) {
  const read = (key, fallback) => {
    const value = typeof t === "function" ? t(key) : "";
    return typeof value === "string" && value && value !== key ? value : fallback;
  };
  return {
    title: read("privacy_guard.title", "Tekst sisaldab isikuandmeid"),
    body: read("privacy_guard.body", "Enne saatmist vali, kas muudad teksti, saadad maskeeritult või jätkad originaaliga, kui see töövoog seda lubab."),
    edit: read("privacy_guard.edit", "Muudan teksti"),
    redacted: read("privacy_guard.send_redacted", "Saada maskeeritult"),
    original: read("privacy_guard.send_original", "Saada siiski"),
    unavailable: read("privacy_guard.unavailable", "Privaatsuskontroll ei õnnestunud. Proovi uuesti.")
  };
}
function DocumentModeIcon({
  stroke,
  className,
  strokeWidth = 1.8,
  plus = false,
  ...props
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      {...props}
    >
      <path d="M6.2 4.7h8.95l3.25 3.25V18.1a1.7 1.7 0 0 1-1.7 1.7H7.9a1.7 1.7 0 0 1-1.7-1.7V6.4a1.7 1.7 0 0 1 1.7-1.7Z" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15.15 4.7v3.25h3.25" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      {plus ? (
        <>
          <path d="M12.3 10.7v5.1" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
          <path d="M9.75 13.25h5.1" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M9.25 11.05h5.75" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
          <path d="M9.25 14.85h5.75" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

function DeepResearchIcon({
  stroke,
  className,
  strokeWidth = 1.8,
  ...props
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      {...props}
    >
      <circle
        cx="10.5"
        cy="10.5"
        r="5.4"
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      <path
        d="M14.55 14.55 19 19"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </svg>
  );
}

function JourneyModeIcon({
  stroke,
  className,
  strokeWidth = 1.8,
  ...props
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      {...props}
    >
      <path
        d="M5.4 17.9c2.2-1.7 3.5-3.6 3.6-5.8.08-1.5-.6-2.75-1.85-3.3-1.28-.57-2.85-.08-3.45 1.22-.62 1.34.03 2.86 1.45 3.4 1.28.5 2.85.1 4.32-.88l5.05-3.36c1.54-1.02 3.55-.82 4.78.48 1.34 1.42 1.14 3.72-.43 4.88l-4.56 3.38"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="15.4"
        cy="17.9"
        r="1.35"
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      <circle
        cx="5.4"
        cy="17.9"
        r="1.35"
        fill={stroke}
      />
    </svg>
  );
}

export default function ChatComposer({
  t,
  locale = "et",
  isLightTheme: _isLightTheme,
  hideTools = false,
  embedded = false,
  inputGlow: _inputGlow,
  placeholderText,
  forcePlaceholderVisible: _forcePlaceholderVisible,
  acceptAttr,
  ensureAnalysisPanelVisible,
  fileInputRef,
  onFileChange,
  inputRowRef,
  inputBarRef,
  inputRef,
  onFocusInput,
  onBlurInput,
  isGenerating,
  isStreamingAny,
  isRoomMode,
  roomBlocked,
  roomAuthRequired,
  onStop,
  onSend,
  onActivateInfoMode,
  onActivateDeepResearchMode,
  onActivateHelpRequestMode,
  onActivateHelpOfferMode,
  showDocumentAttachButton = false,
  onPickDocumentFile,
  voiceEnabled = true,
  showDictationButton = true,
  recording,
  recordingPulse,
  handleMic,
  draftApiRef,
  onDraftStateChange,
  onLayoutChange,
  inputFocused = false,
  isMobile = false,
  activeModeLabel = "",
  roomModeLabel = "",
  activeModeKey = "",
  allowAssistantForward = true,
  isHelpMatchRoom = false,
  sendToAssistant = false,
  setSendToAssistant,
  aiNote = "",
  callControlsNode = null
}) {
  const [draft, setDraft] = useState("");
  const [composerExpanded, setComposerExpanded] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [privacyPrompt, setPrivacyPrompt] = useState(null);
  const [toolsMenuPosition, setToolsMenuPosition] = useState(null);
  const submitInFlightRef = useRef(false);
  const primaryActionHandledAtRef = useRef(0);
  const toolsButtonRef = useRef(null);
  const toolsMenuRef = useRef(null);
  const initialDraftProbeCompleteRef = useRef(false);
  const previousDraftLengthRef = useRef(0);
  const composerLayoutSyncFramesRef = useRef([]);
  const composerLayoutSignatureRef = useRef("");
  const notifyLayoutChange = useCallback(() => {
    if (typeof onLayoutChange !== "function" || typeof window === "undefined") {
      return;
    }

    composerLayoutSyncFramesRef.current.forEach(frameId => {
      window.cancelAnimationFrame(frameId);
    });
    composerLayoutSyncFramesRef.current = [];

    const frame1 = window.requestAnimationFrame(() => {
      onLayoutChange();
      const frame2 = window.requestAnimationFrame(() => {
        onLayoutChange();
      });
      composerLayoutSyncFramesRef.current = [frame2];
    });

    composerLayoutSyncFramesRef.current = [frame1];
  }, [onLayoutChange]);
  const resizeComposerInput = useCallback(() => {
    const node = inputRef?.current;
    if (!node || typeof window === "undefined") return;

    const computed = window.getComputedStyle(node);
    const lineHeight = Number.parseFloat(computed.lineHeight) || 22;
    const paddingTop = Number.parseFloat(computed.paddingTop) || 0;
    const paddingBottom = Number.parseFloat(computed.paddingBottom) || 0;
    const borderTop = Number.parseFloat(computed.borderTopWidth) || 0;
    const borderBottom = Number.parseFloat(computed.borderBottomWidth) || 0;
    const minHeight = Math.ceil(lineHeight + paddingTop + paddingBottom + borderTop + borderBottom);
    const maxVisibleLines = isMobile ? 3 : 6;
    const maxHeight = Math.ceil(lineHeight * maxVisibleLines + paddingTop + paddingBottom + borderTop + borderBottom);
    const currentDraftLength = draft.length;
    const previousDraftLength = previousDraftLengthRef.current;
    const draftIsGrowing = currentDraftLength >= previousDraftLength;

    if (!inputFocused) {
      node.style.height = `${minHeight}px`;
      node.style.overflowY = "hidden";
      if (!currentDraftLength) {
        setComposerExpanded(false);
      }
      previousDraftLengthRef.current = currentDraftLength;
      const layoutSignature = `idle|${minHeight}|0`;
      if (composerLayoutSignatureRef.current !== layoutSignature) {
        composerLayoutSignatureRef.current = layoutSignature;
        notifyLayoutChange();
      }
      return;
    }

    node.style.height = "auto";
    const nextHeight = Math.max(minHeight, Math.min(node.scrollHeight, maxHeight));
    const contentHeight = Math.max(0, node.scrollHeight - paddingTop - paddingBottom);
    const lineCount = Math.max(1, Math.round(contentHeight / lineHeight));
    const scrollLocked = node.scrollHeight > maxHeight;
    let nextExpanded;

    if (composerExpanded) {
      nextExpanded = draftIsGrowing
        ? true
        : currentDraftLength > 0 && lineCount > 1;
    } else {
      nextExpanded = lineCount > 1;
    }

    if (!currentDraftLength) {
      nextExpanded = false;
    }

    node.style.height = `${nextHeight}px`;
    node.style.overflowY = scrollLocked ? "auto" : "hidden";
    if (composerExpanded !== nextExpanded) {
      setComposerExpanded(nextExpanded);
    }
    previousDraftLengthRef.current = currentDraftLength;
    const layoutSignature = `${nextHeight}|${nextExpanded ? 1 : 0}|${scrollLocked ? 1 : 0}`;
    if (composerLayoutSignatureRef.current !== layoutSignature) {
      composerLayoutSignatureRef.current = layoutSignature;
      notifyLayoutChange();
    }
  }, [composerExpanded, draft, inputFocused, inputRef, isMobile, notifyLayoutChange]);
  const helpRequestModeLabelRaw = t("chat.tools.help_request_mode");
  const helpRequestModeLabel =
    helpRequestModeLabelRaw && helpRequestModeLabelRaw !== "chat.tools.help_request_mode"
      ? helpRequestModeLabelRaw
      : "Abisoov";
  const helpOfferModeLabelRaw = t("chat.tools.help_offer_mode");
  const helpOfferModeLabel =
    helpOfferModeLabelRaw && helpOfferModeLabelRaw !== "chat.tools.help_offer_mode"
      ? helpOfferModeLabelRaw
      : "Abipakkumine";
  const deepResearchModeLabelRaw = t("chat.deep_research.mode_label");
  const deepResearchModeLabel =
    deepResearchModeLabelRaw && deepResearchModeLabelRaw !== "chat.deep_research.mode_label"
      ? deepResearchModeLabelRaw
      : "Süvauuring";
  const journeyModeLabelRaw = t("journey.chatTool.label");
  const journeyModeLabel =
    journeyModeLabelRaw && journeyModeLabelRaw !== "journey.chatTool.label"
      ? journeyModeLabelRaw
      : "Teekond";
  const resolvedActiveModeLabel = useMemo(() => {
    if (activeModeKey === "deep_research") return deepResearchModeLabel;
    if (activeModeKey === "help_request") return helpRequestModeLabel;
    if (activeModeKey === "help_offer") return helpOfferModeLabel;
    if (activeModeKey === "journey") return journeyModeLabel;
    return String(activeModeLabel || "");
  }, [
    activeModeKey,
    activeModeLabel,
    deepResearchModeLabel,
    helpOfferModeLabel,
    helpRequestModeLabel,
    journeyModeLabel
  ]);
  const effectiveModeLabel = String(roomModeLabel || resolvedActiveModeLabel || "");
  const subtleModeLabel = effectiveModeLabel
    .trim()
    .replace(/^[^:]+:\s*/, "");
  const displayModeLabel = subtleModeLabel
    ? subtleModeLabel.charAt(0).toLocaleUpperCase(locale) + subtleModeLabel.slice(1)
    : "";
  const hasActiveWorkflowMode = activeModeKey && activeModeKey !== "default";
  const isHelpWorkflowMode =
    activeModeKey === "help_request" || activeModeKey === "help_offer";
  const modeToggleShowsActiveState = hasActiveWorkflowMode;
  const assistantForwardEnabled = allowAssistantForward && !hideTools;
  const useSimpleRoomActionButtons = Boolean(
    (isRoomMode && isHelpMatchRoom) || isHelpWorkflowMode
  );
  const showModeLabelRow = Boolean(displayModeLabel && (modeToggleShowsActiveState || roomModeLabel));

  useEffect(() => {
    if (!hideTools) return;
    setToolsOpen(false);
  }, [hideTools]);

  useEffect(() => {
    if (!toolsOpen) return;
    const onPointerDown = event => {
      const target = event?.target;
      if (!(target instanceof Node)) return;
      if (toolsButtonRef.current?.contains(target)) return;
      if (toolsMenuRef.current?.contains(target)) return;
      setToolsOpen(false);
    };
    const onKeyDown = event => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setToolsOpen(false);
      toolsButtonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [toolsOpen]);

  const updateToolsMenuPosition = useCallback(() => {
    if (typeof window === "undefined") return;
    const button = toolsButtonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    setToolsMenuPosition({
      left: Math.max(8, rect.left),
      bottom: Math.max(8, window.innerHeight - rect.top + 7)
    });
  }, []);

  useEffect(() => {
    if (!toolsOpen) {
      setToolsMenuPosition(null);
      return;
    }
    updateToolsMenuPosition();
    if (typeof window === "undefined") return;
    const sync = () => updateToolsMenuPosition();
    window.addEventListener("resize", sync);
    window.addEventListener("scroll", sync, true);
    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("scroll", sync, true);
    };
  }, [toolsOpen, updateToolsMenuPosition]);

  useEffect(() => {
    if (!isRoomMode) return;
    setToolsOpen(false);
  }, [isRoomMode]);

  useEffect(() => {
    if (!draftApiRef) return;
    draftApiRef.current = {
      appendText: (txt, options = {}) => {
        const s = String(txt ?? "").trim();
        if (!s) return;
        const separator =
          typeof options?.separator === "string"
            ? options.separator
            : s.includes("\n")
              ? "\n\n"
              : " ";
        setDraft(prev => (prev ? `${prev}${separator}${s}` : s));
      },
      clear: () => setDraft("")
    };
    return () => {
      if (draftApiRef.current) draftApiRef.current = null;
    };
  }, [draftApiRef]);
  useLayoutEffect(() => {
    resizeComposerInput();
  }, [draft, composerExpanded, inputFocused, resizeComposerInput]);
  useEffect(() => () => {
    if (typeof window === "undefined") return;
    composerLayoutSyncFramesRef.current.forEach(frameId => {
      window.cancelAnimationFrame(frameId);
    });
    composerLayoutSyncFramesRef.current = [];
  }, []);
  useEffect(() => {
    if (!initialDraftProbeCompleteRef.current) return;
    onDraftStateChange?.({
      ready: true,
      hasDraft: Boolean(draft.trim())
    });
  }, [draft, onDraftStateChange]);
  useEffect(() => {
    if (!inputRef) return;
    let cancelled = false;
    let rafId = 0;
    let timeoutId = 0;
    const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
    const finish = () => {
      if (cancelled) return;
      cancelled = true;
      if (rafId) window.cancelAnimationFrame(rafId);
      if (timeoutId) window.clearTimeout(timeoutId);
      initialDraftProbeCompleteRef.current = true;
      onDraftStateChange?.({
        ready: true,
        hasDraft: Boolean(String(inputRef.current?.value || "").trim())
      });
    };
    const poll = () => {
      if (cancelled) return;
      const currentInput = inputRef.current;
      if (!currentInput) {
        rafId = window.requestAnimationFrame(poll);
        return;
      }
      const value = String(currentInput.value || "");
      if (value.trim()) {
        finish();
        return;
      }
      const elapsed = (typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAt;
      if (elapsed >= 1200) {
        finish();
        return;
      }
      rafId = window.requestAnimationFrame(poll);
    };
    rafId = window.requestAnimationFrame(poll);
    timeoutId = window.setTimeout(finish, 1250);
    return () => {
      cancelled = true;
      if (rafId) window.cancelAnimationFrame(rafId);
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [inputRef, onDraftStateChange]);
  const hasInput = Boolean(draft.trim());
  // T03 E3: nähtav tähemärgiloendur ilmub piirile lähenedes; üle piiri → over-limit olek.
  const draftLength = draft.length;
  const showCharCounter = draftLength >= MESSAGE_COUNTER_VISIBLE_FROM;
  const overCharLimit = draftLength > MAX_USER_MESSAGE_CHARS;
  const charCounterText = `${draftLength}/${MAX_USER_MESSAGE_CHARS}`;
  const closeToolsMenu = useCallback(() => {
    setToolsOpen(false);
  }, []);
  const openDocumentAnalysis = useCallback(() => {
    ensureAnalysisPanelVisible?.();
    closeToolsMenu();
  }, [ensureAnalysisPanelVisible, closeToolsMenu]);
  const handleHelpRequestModeSelect = useCallback(() => {
    closeToolsMenu();
    onActivateHelpRequestMode?.();
  }, [closeToolsMenu, onActivateHelpRequestMode]);
  const handleDeepResearchModeSelect = useCallback(() => {
    closeToolsMenu();
    onActivateDeepResearchMode?.();
  }, [closeToolsMenu, onActivateDeepResearchMode]);
  const handleHelpOfferModeSelect = useCallback(() => {
    closeToolsMenu();
    onActivateHelpOfferMode?.();
  }, [closeToolsMenu, onActivateHelpOfferMode]);
  const checkPrivacyBeforeSend = useCallback(async (text) => {
    const workflow = resolvePrivacyWorkflow({ activeModeKey, isRoomMode });
    try {
      const response = await fetch("/api/privacy/check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text,
          workflow
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 409 && payload?.needsPrivacyConfirmation) {
        setPrivacyPrompt({
          ...payload,
          originalText: text,
          workflow
        });
        return null;
      }
      if (!response.ok || payload?.ok === false) {
        throw new Error("privacy_check_failed");
      }
      return {
        text: String(payload?.text || text),
        privacyDecision: payload?.appliedDecision
          ? { action: payload.appliedDecision }
          : undefined
      };
    } catch {
      setPrivacyPrompt({
        originalText: text,
        workflow,
        warning: privacyLabels(t).unavailable,
        actions: ["edit"],
        allowOriginal: false,
        findings: [],
        categories: []
      });
      return null;
    }
  }, [activeModeKey, isRoomMode, t]);
  const submitSend = useCallback(async (options = {}) => {
    if (submitInFlightRef.current) return false;
    const originalDraft = options.textOverride != null ? String(options.textOverride) : draft;
    const trimmed = originalDraft.trim();
    if (!trimmed) return false;
    // T03 E3: nähtav piir — üle selle ei saada (server jõustaks 413); loendur selgitab miks.
    if (trimmed.length > MAX_USER_MESSAGE_CHARS) return false;
    if (isGenerating) return false;
    submitInFlightRef.current = true;
    try {
      const privacyResult = options.skipPrivacy
        ? {
            text: trimmed,
            privacyDecision: options.privacyDecision
          }
        : await checkPrivacyBeforeSend(trimmed);
      if (!privacyResult) return false;
      const nextText = String(privacyResult.text || trimmed).trim();
      setDraft("");
      const ok = await onSend(nextText, {
        privacyDecision: privacyResult.privacyDecision
      });
      if (!ok) {
        setDraft(options.restoreDraft ?? originalDraft);
      }
      return ok;
    } catch {
      setDraft(options.restoreDraft ?? originalDraft);
      return false;
    } finally {
      submitInFlightRef.current = false;
    }
  }, [checkPrivacyBeforeSend, draft, isGenerating, onSend]);
  const handleToolsButtonClick = useCallback(() => {
    if (hasActiveWorkflowMode) {
      onActivateInfoMode?.(
        activeModeKey === "deep_research"
          ? {
              preserveConversation: true,
              stopActiveRun: true
            }
          : undefined
      );
      closeToolsMenu();
      return;
    }
    setToolsOpen(prev => !prev);
  }, [activeModeKey, closeToolsMenu, hasActiveWorkflowMode, onActivateInfoMode]);
  const handleSubmit = useCallback(e => {
    if (Date.now() - primaryActionHandledAtRef.current < 400) {
      primaryActionHandledAtRef.current = 0;
      e.preventDefault();
      return;
    }
    e.preventDefault();
    closeToolsMenu();
    if (isGenerating) {
      onStop?.(e);
      return;
    }
    void submitSend();
  }, [closeToolsMenu, isGenerating, onStop, submitSend]);
  const handleKeyDown = useCallback(e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      closeToolsMenu();
      if (isGenerating) return;
      if (draft.trim()) {
        void submitSend();
      }
    }
  }, [closeToolsMenu, draft, isGenerating, submitSend]);
  const runPrimaryAction = useCallback(event => {
    closeToolsMenu();
    if (isGenerating || isStreamingAny) {
      onStop?.(event);
      return;
    }
    if (draft.trim()) {
      void submitSend();
      return;
    }
    if (showDictationButton && voiceEnabled && !useSimpleRoomActionButtons) {
      handleMic?.(event);
    }
  }, [closeToolsMenu, draft, handleMic, isGenerating, isStreamingAny, onStop, showDictationButton, submitSend, useSimpleRoomActionButtons, voiceEnabled]);
  const handleDictateClick = useCallback(event => {
    closeToolsMenu();
    handleMic?.(event);
  }, [closeToolsMenu, handleMic]);
  const handlePrimaryActionPointerDown = useCallback(e => {
    e.preventDefault();
    e.stopPropagation();
    primaryActionHandledAtRef.current = Date.now();
    runPrimaryAction(e);
  }, [runPrimaryAction]);
  const preserveDesktopInputFocusOnMouseDown = useCallback(e => {
    if (isMobile) return;
    e.preventDefault();
  }, [isMobile]);
  const focusComposerField = useCallback(() => {
    const node = inputRef?.current;
    if (!node) return;
    try {
      if (!isMobile) {
        node.focus({
          preventScroll: true
        });
        return;
      }
    } catch {}
    node.focus?.();
  }, [inputRef, isMobile]);
  const handlePrivacyEdit = useCallback(() => {
    setPrivacyPrompt(null);
    focusComposerField();
  }, [focusComposerField]);
  const handlePrivacyRedacted = useCallback(() => {
    const prompt = privacyPrompt;
    if (!prompt?.redactedText) return;
    setPrivacyPrompt(null);
    void submitSend({
      skipPrivacy: true,
      textOverride: prompt.redactedText,
      restoreDraft: prompt.originalText || draft,
      privacyDecision: { action: "use_redacted" }
    });
  }, [draft, privacyPrompt, submitSend]);
  const handlePrivacyOriginal = useCallback(() => {
    const prompt = privacyPrompt;
    if (!prompt?.allowOriginal) return;
    setPrivacyPrompt(null);
    void submitSend({
      skipPrivacy: true,
      textOverride: prompt.originalText || draft,
      restoreDraft: prompt.originalText || draft,
      privacyDecision: { action: "send_original" }
    });
  }, [draft, privacyPrompt, submitSend]);
  const handleInputBarMouseDown = useCallback(e => {
    const target = e?.target;
    if (!(target instanceof Element)) return;
    if (target.closest("textarea,button,a,input,select,label,[role='button'],[role='menuitem']")) {
      return;
    }
    e.preventDefault();
    focusComposerField();
  }, [focusComposerField]);
  // Alaserv tuleb ÜHEST muutujast (`--chat-composer-inset`, chat.css):
  // puhkeasendis = suurem kahest kattest (kodunupu ala VÕI iOS-i
  // tööriistariba) + tavaline vahe; klaviatuuri ajal kirjutab ChatBody
  // sinna väikese vahe, sest siis mõõdab koha `--chat-vk-offset`. Varem
  // olid kõik liidetavad siin real koos ja nad LIITUSID — komposer hüppas
  // klaviatuurist liiga kõrgele (omanik 28.07). Varu 2.5rem hoiab vana
  // käitumise seal, kus neid muutujaid ei defineerita (nt agendivaade).
  const inputRowMobileStyle = !embedded && isMobile
    ? {
        position: "absolute",
        left: 0,
        right: 0,
        top: "auto",
        bottom: "calc(var(--chat-composer-inset, 2.5rem) + var(--chat-vk-offset,0px))",
        marginTop: 0
      }
    : undefined;
  const inputRowStyle = inputRowMobileStyle || undefined;
  const toolsMenuPanel = toolsOpen && toolsMenuPosition && typeof document !== "undefined"
    ? createPortal(<div ref={toolsMenuRef} className="conv-tools-menu" role="menu" aria-label={t("chat.tools.menu_aria")} style={{
      position: "fixed",
      left: `${toolsMenuPosition.left}px`,
      bottom: `${toolsMenuPosition.bottom}px`
    }}>
          {/* Abisoov/Abipakkumine = abisoovi/-pakkumise LOOMISE režiimid —
              ei kuulu ruumivestlusse (omanik 23.07). Ainult tavavestluses. */}
          {!isRoomMode ? (
            <>
              <button type="button" role="menuitem" onClick={handleHelpRequestModeSelect}>
                <span>{helpRequestModeLabel}</span>
              </button>
              <button type="button" role="menuitem" onClick={handleHelpOfferModeSelect}>
                <span>{helpOfferModeLabel}</span>
              </button>
            </>
          ) : null}
          {!isRoomMode ? <button type="button" role="menuitem" onClick={handleDeepResearchModeSelect}>
              <span aria-hidden="true">
                <DeepResearchIcon stroke="currentColor" />
              </span>
              <span>{deepResearchModeLabel}</span>
            </button> : null}
          <button type="button" role="menuitem" onClick={openDocumentAnalysis}>
            <span aria-hidden="true">
              <DocumentModeIcon stroke="currentColor" />
            </span>
            <span>{t("chat.tools.document_analysis")}</span>
          </button>
        </div>, document.body)
    : null;
  const documentAttachDisabled = isGenerating || isRoomMode && (roomBlocked || roomAuthRequired);
  const showSideControls = !hideTools;
  const privacyCopy = privacyLabels(t);
  const privacyFindingLabels = Array.isArray(privacyPrompt?.findings)
    ? privacyPrompt.findings.map((finding) => finding?.label).filter(Boolean)
    : [];
  const privacyPromptNode = privacyPrompt ? (
    <div>
      <div>
        <strong>{privacyCopy.title}</strong>
        <span>{privacyPrompt.warning || privacyCopy.body}</span>
        {privacyFindingLabels.length ? (
          <span>{privacyFindingLabels.join(", ")}</span>
        ) : null}
      </div>
      <div>
        <Button as="button" type="button" size="sm" variant="primary" onClick={handlePrivacyEdit}>
          {privacyCopy.edit}
        </Button>
        {privacyPrompt.redactedText ? (
          <Button as="button" type="button" size="sm" variant="primary" onClick={handlePrivacyRedacted}>
            {privacyCopy.redacted}
          </Button>
        ) : null}
        {privacyPrompt.allowOriginal ? (
          <Button as="button" type="button" size="sm" variant="primary" onClick={handlePrivacyOriginal}>
            {privacyCopy.original}
          </Button>
        ) : null}
      </div>
    </div>
  ) : null;
  const inputBarChildren = <>
      <div>
        <textarea id="chat-input" ref={inputRef} value={draft} placeholder={placeholderText ?? ""} onChange={e => setDraft(e.target.value)} onKeyDown={handleKeyDown} onFocus={e => {
        onFocusInput?.(e);
      }} onBlur={onBlurInput} disabled={isGenerating || isRoomMode && (roomBlocked || roomAuthRequired)} rows={1} />
      </div>
      <div>
        {/* Helikõne kontrollid — kompaktne ikoon-grupp mikri juures (omanik 23.07). */}
        {callControlsNode}
        {isRoomMode && assistantForwardEnabled ? (
          <>
            {/* Saatmise siht — üksik nupp mikri VASAKUL (omanik 23.07, valik B).
                Aktiivne = assistent kaasatud (heledaks täidetud). EI lisa rida →
                sisend ei tõuse fookusel. Ruumis läheb sõnum ALATI ruumi;
                nupp lisab AI vastuse peale (routing muutmata). */}
            <button
              type="button"
              className="conv-ai-target"
              aria-label={t("chat.ai_toggle.button_aria")}
              title={sendToAssistant ? t("chat.ai_toggle.on") : t("chat.ai_toggle.off")}
              aria-pressed={sendToAssistant ? "true" : "false"}
              aria-describedby="chat-ai-hint"
              data-active={sendToAssistant ? "true" : undefined}
              onMouseDown={preserveDesktopInputFocusOnMouseDown}
              onClick={() => setSendToAssistant(!sendToAssistant)}
            />
            <span id="chat-ai-hint" className="sr-only">{aiNote}</span>
          </>
        ) : null}
        {showDictationButton && !useSimpleRoomActionButtons ? <button type="button" aria-label={recording ? t("chat.mic.stop") : t("chat.mic.start")} title={recording ? t("chat.mic.stop") : t("chat.mic.start")} onClick={handleDictateClick} onMouseDown={preserveDesktopInputFocusOnMouseDown} disabled={!voiceEnabled || isRoomMode && (roomBlocked || roomAuthRequired)} data-speaking={recording ? "true" : "false"} data-recording={recording ? "true" : "false"} data-recording-complete={recordingPulse ? "true" : "false"} /> : null}
        {isGenerating || isStreamingAny ? <button type="submit" aria-label={t("chat.send.stop")} title={t("chat.send.title_stop")} disabled={isRoomMode && (roomBlocked || roomAuthRequired) || !hasInput && !isGenerating && !isStreamingAny} data-loader-active="true" onPointerDown={handlePrimaryActionPointerDown} onMouseDown={preserveDesktopInputFocusOnMouseDown} /> : hasInput ? <button type="submit" aria-label={t("chat.send.send")} title={t("chat.send.title_send")} disabled={isRoomMode && (roomBlocked || roomAuthRequired)} onPointerDown={handlePrimaryActionPointerDown} onMouseDown={preserveDesktopInputFocusOnMouseDown} /> : <button type="submit" aria-label={t("chat.send.send")} title={t("chat.send.title_send")} disabled={!hasInput || isRoomMode && (roomBlocked || roomAuthRequired)} data-empty-disabled={!hasInput ? "true" : undefined} onPointerDown={handlePrimaryActionPointerDown} onMouseDown={preserveDesktopInputFocusOnMouseDown} />}
      </div>
    </>;
  return <form ref={inputRowRef} style={inputRowStyle} onSubmit={handleSubmit} autoComplete="off">
      {showSideControls ? <div>
        {hideTools ? null : <>
            <button ref={toolsButtonRef} type="button" aria-label={modeToggleShowsActiveState ? activeModeKey === "deep_research" ? t("chat.deep_research.exit_mode_aria") : t("chat.tools.exit_mode_aria") : t("chat.tools.aria")} title={modeToggleShowsActiveState ? activeModeKey === "deep_research" ? t("chat.deep_research.exit_mode_aria") : t("chat.tools.exit_mode_aria") : t("chat.tools.tooltip")} aria-haspopup={modeToggleShowsActiveState ? undefined : "menu"} aria-expanded={modeToggleShowsActiveState ? undefined : toolsOpen ? "true" : "false"} onMouseDown={preserveDesktopInputFocusOnMouseDown} onClick={handleToolsButtonClick}>
                {activeModeKey === "deep_research" ? <DeepResearchIcon stroke="currentColor" strokeWidth={1.45} />
                  : activeModeKey === "journey" ? <JourneyModeIcon stroke="currentColor" strokeWidth={1.45} />
                  : <svg aria-hidden="true" width="36" height="36" viewBox="0 0 42 42" fill="none">
                    <path d="M21 8.75v24.5M8.75 21h24.5" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" />
                  </svg>}
              </button>
            {toolsMenuPanel}
            {showDocumentAttachButton ? <button type="button" aria-label={t("chat.upload.aria")} title={t("chat.upload.tooltip")} onMouseDown={preserveDesktopInputFocusOnMouseDown} onClick={onPickDocumentFile} disabled={documentAttachDisabled}>
                    <svg aria-hidden="true" width="36" height="36" viewBox="0 0 42 42" fill="none">
                      <path d="M26.9 14.2 18 23.1a4.45 4.45 0 1 0 6.29 6.29l9.26-9.26a7.42 7.42 0 0 0-10.49-10.49l-9.78 9.79a10.39 10.39 0 1 0 14.7 14.69l7.95-7.95" stroke="currentColor" strokeWidth="2.95" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button> : null}
          </>}
      </div> : null}

      <input ref={fileInputRef} type="file" accept={acceptAttr} multiple onChange={onFileChange} hidden />

      <label htmlFor="chat-input" className="sr-only">
        {t("chat.input.label")}
      </label>

      <div>
        {privacyPromptNode}
        <div ref={inputBarRef} onMouseDown={handleInputBarMouseDown}>
          {inputBarChildren}
        </div>
        {showCharCounter ? (
          <div className="conv-char-counter" role="status" aria-live="polite" data-over-limit={overCharLimit ? "true" : undefined}>
            <span aria-hidden="true">{charCounterText}</span>
            <span className="sr-only">{charCounterText}</span>
          </div>
        ) : null}
      </div>
      {showModeLabelRow ? <div>
          <div>
            <span className="sr-only">{displayModeLabel}</span>
            <span aria-hidden="true">{displayModeLabel}</span>
          </div>
        </div> : null}
    </form>;
}
