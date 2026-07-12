"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Button from "@/components/ui/Button";
import ChatAiForwardToggle from "./view/ChatAiForwardToggle";

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
  isLightTheme,
  hideTools = false,
  embedded = false,
  inputGlow = false,
  placeholderText,
  forcePlaceholderVisible = false,
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
  focusActive = false,
  allowAssistantForward = true,
  isHelpMatchRoom = false,
  sendToAssistant = false,
  setSendToAssistant,
  aiNote = "",
  spatialEntry = false,
  conversationStarted = false
}) {
  const [draft, setDraft] = useState("");
  const [composerExpanded, setComposerExpanded] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  /* Ruumilise sisenemise (tellija 12.07) olek: /vestlus algab KAHE
     ikooniga (Räägi + Kirjuta). "Kirjuta" avab kirjutusrežiimi;
     "Räägi" käivitab dikteerimise; stop → tekst tekib joonele. */
  const [writeModeActive, setWriteModeActive] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
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
  /* Ruumilise sisenemise olekumasin (ainult spatialEntry korral):
       idle      = kaks ikooni (Räägi + Kirjuta), sisendriba peidus
       recording = "Salvestan…" + Stopp
       write     = kuldne sisendtriip nähtav
     Kirjutusrežiim on aktiivne, kui kasutaja on selle avanud, tal on
     mustand, sisend on fookuses või käib genereerimine. */
  const composerBusy = isGenerating || isStreamingAny;
  /* Kaheikooniline VALIK (idle) AINULT värskes vestluses. Kui vestlus on
     juba alanud (conversationStarted), jääb sisendtriip püsivalt — kahe
     ikooni juurde EI naaseta (tellija 12.07). NB: EI sõltu inputFocused
     prop'ist — see uueneb vanemas viivitusega. */
  const entryState = !spatialEntry
    ? "write"
    : recording
      ? "recording"
      : writeModeActive || hasInput || composerBusy || conversationStarted
        ? "write"
        : "idle";
  useEffect(() => {
    if (!recording) {
      setRecSeconds(0);
      return undefined;
    }
    const id = window.setInterval(() => setRecSeconds(s => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [recording]);
  const enterWriteMode = useCallback(() => {
    setWriteModeActive(true);
  }, []);
  /* Fookus kirjutusrežiimi lülitudes — useEffect (mitte rAF), et sisend
     oleks juba renderdatud/nähtav ja fookus töötaks ka siis, kui brauser
     ei joonista kaadreid. Ainult "Kirjuta"-kaudsel avamisel (writeModeActive),
     mitte igal fookusel. */
  const writeModeFocusPendingRef = useRef(false);
  useEffect(() => {
    if (writeModeActive) {
      if (!writeModeFocusPendingRef.current) {
        writeModeFocusPendingRef.current = true;
        const node = inputRef?.current;
        if (node && document.activeElement !== node) {
          try {
            node.focus({ preventScroll: true });
          } catch {
            node.focus?.();
          }
        }
      }
    } else {
      writeModeFocusPendingRef.current = false;
    }
  }, [writeModeActive, inputRef]);
  /* Suur kohandatud kursor (tellija 12.07: "vilkuv kriipsuke pidi palju
     suurem olema"). CSS ei luba caret'i laiust muuta → peidame natiivse
     kursori (#chat-input caret-color: transparent) ja joonistame paksu
     kuldkriipsu, mis järgib teksti. Asukoht mõõdetakse peegel-diviga
     (sama font/polster/laius kui textareal). Ainult spatialEntry korral. */
  const fatCaretRef = useRef(null);
  useEffect(() => {
    if (!spatialEntry || typeof document === "undefined") return undefined;
    const ta = inputRef?.current;
    const caret = fatCaretRef.current;
    if (!ta || !caret) return undefined;
    const mirror = document.createElement("div");
    mirror.setAttribute("aria-hidden", "true");
    Object.assign(mirror.style, {
      position: "absolute",
      top: "0",
      left: "-9999px",
      visibility: "hidden",
      whiteSpace: "pre-wrap",
      overflowWrap: "break-word",
      wordWrap: "break-word"
    });
    document.body.appendChild(mirror);
    const COPY = [
      "fontFamily", "fontSize", "fontWeight", "fontStyle", "letterSpacing",
      "textTransform", "wordSpacing", "textIndent", "lineHeight",
      "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "boxSizing"
    ];
    const measure = () => {
      if (ta.clientWidth <= 0) return; // peidetud (idle) — mõõtmine mõttetu
      const cs = window.getComputedStyle(ta);
      COPY.forEach(p => { mirror.style[p] = cs[p]; });
      mirror.style.width = `${ta.clientWidth}px`;
      const pos = typeof ta.selectionStart === "number" ? ta.selectionStart : ta.value.length;
      mirror.textContent = ta.value.substring(0, pos);
      const marker = document.createElement("span");
      marker.textContent = "​";
      mirror.appendChild(marker);
      const fs = parseFloat(cs.fontSize) || 20;
      const lh = parseFloat(cs.lineHeight) || fs * 1.4;
      /* Kursori kõrgus ~teksti kõrgus (mitte täis reakõrgus), et poleks
         "liiga suur" (tellija 12.07); tsentreeri reale. */
      const ch = Math.round(fs * 1.15);
      const x = marker.offsetLeft - ta.scrollLeft;
      const y = marker.offsetTop - ta.scrollTop + Math.max(0, (lh - ch) / 2);
      caret.style.height = `${ch}px`;
      caret.style.transform = `translate(${x}px, ${y}px)`;
      // taaskäivita vilkumine, et kursor oleks liikudes/kirjutades kohe täis
      caret.style.animation = "none";
      void caret.offsetWidth;
      caret.style.animation = "";
    };
    // Otsekutse (mitte rAF) — töökindel ka siis, kui brauser ei joonista
    const update = () => { measure(); };
    const show = () => { caret.dataset.on = "true"; measure(); };
    const hide = () => { caret.dataset.on = "false"; };
    ta.addEventListener("focus", show);
    ta.addEventListener("blur", hide);
    ta.addEventListener("input", update);
    ta.addEventListener("keyup", update);
    ta.addEventListener("click", update);
    ta.addEventListener("scroll", update);
    ta.addEventListener("select", update);
    window.addEventListener("resize", update);
    if (document.activeElement === ta) show();
    return () => {
      ta.removeEventListener("focus", show);
      ta.removeEventListener("blur", hide);
      ta.removeEventListener("input", update);
      ta.removeEventListener("keyup", update);
      ta.removeEventListener("click", update);
      ta.removeEventListener("scroll", update);
      ta.removeEventListener("select", update);
      window.removeEventListener("resize", update);
      mirror.remove();
    };
  }, [spatialEntry, inputRef]);
  const handleVoiceEntry = useCallback(event => {
    /* Hoia kirjutusrežiim aktiivsena, et pärast dikteerimise lõppu
       tekiks tekst joonele (mitte ei hüppaks tagasi kahe ikooni juurde). */
    setWriteModeActive(true);
    handleMic?.(event);
  }, [handleMic]);
  const handleComposerBlur = useCallback(event => {
    onBlurInput?.(event);
    if (spatialEntry && !draft.trim() && !recording) {
      setWriteModeActive(false);
    }
  }, [onBlurInput, spatialEntry, draft, recording]);
  const readEntryLabel = (key, fallback) => {
    const value = typeof t === "function" ? t(key) : "";
    return value && value !== key ? value : fallback;
  };
  const voiceEntryLabel = readEntryLabel("chat.entry.voice", locale === "en" ? "Speak" : locale === "ru" ? "Голос" : "Räägi");
  const writeEntryLabel = readEntryLabel("chat.entry.write", locale === "en" ? "Write" : locale === "ru" ? "Написать" : "Kirjuta");
  const recordingLabel = readEntryLabel("chat.mic.recording", locale === "en" ? "Recording…" : locale === "ru" ? "Запись…" : "Salvestan…");
  const stopEntryLabel = readEntryLabel("chat.mic.stop", locale === "en" ? "Stop" : locale === "ru" ? "Стоп" : "Stopp");
  const recTimeLabel = `${Math.floor(recSeconds / 60)}:${String(recSeconds % 60).padStart(2, "0")}`;
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
  const inputRowMobileStyle = !embedded && isMobile
    ? {
        position: "absolute",
        left: 0,
        right: 0,
        top: "auto",
        bottom: "calc(env(safe-area-inset-bottom,0px) + var(--chat-composer-mobile-bottom-base,2.5rem) + var(--chat-vk-offset,0px))",
        marginTop: 0
      }
    : undefined;
  const inputRowStyle = inputRowMobileStyle || undefined;
  const toolsMenuPanel = toolsOpen && toolsMenuPosition && typeof document !== "undefined"
    ? createPortal(<div ref={toolsMenuRef} role="menu" aria-label={t("chat.tools.menu_aria")} style={{
      position: "fixed",
      left: `${toolsMenuPosition.left}px`,
      bottom: `${toolsMenuPosition.bottom}px`
    }}>
          <button type="button" role="menuitem" onClick={handleHelpRequestModeSelect}>
            <span>{helpRequestModeLabel}</span>
          </button>
          <button type="button" role="menuitem" onClick={handleHelpOfferModeSelect}>
            <span>{helpOfferModeLabel}</span>
          </button>
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
      }} onBlur={handleComposerBlur} disabled={isGenerating || isRoomMode && (roomBlocked || roomAuthRequired)} rows={1} />
        {spatialEntry ? <span ref={fatCaretRef} className="conv-fatcaret" aria-hidden="true" data-on="false" /> : null}
      </div>
      <div>
        {showDictationButton && !useSimpleRoomActionButtons ? <button type="button" aria-label={recording ? t("chat.mic.stop") : t("chat.mic.start")} title={recording ? t("chat.mic.stop") : t("chat.mic.start")} onClick={handleDictateClick} onMouseDown={preserveDesktopInputFocusOnMouseDown} disabled={!voiceEnabled || isRoomMode && (roomBlocked || roomAuthRequired)} data-speaking={recording ? "true" : "false"} data-recording={recording ? "true" : "false"} data-recording-complete={recordingPulse ? "true" : "false"} /> : null}
        {isGenerating || isStreamingAny ? <button type="submit" aria-label={t("chat.send.stop")} title={t("chat.send.title_stop")} disabled={isRoomMode && (roomBlocked || roomAuthRequired) || !hasInput && !isGenerating && !isStreamingAny} data-loader-active="true" onPointerDown={handlePrimaryActionPointerDown} onMouseDown={preserveDesktopInputFocusOnMouseDown} /> : hasInput ? <button type="submit" aria-label={t("chat.send.send")} title={t("chat.send.title_send")} disabled={isRoomMode && (roomBlocked || roomAuthRequired)} onPointerDown={handlePrimaryActionPointerDown} onMouseDown={preserveDesktopInputFocusOnMouseDown} /> : <button type="submit" aria-label={t("chat.send.send")} title={t("chat.send.title_send")} disabled={!hasInput || isRoomMode && (roomBlocked || roomAuthRequired)} data-empty-disabled={!hasInput ? "true" : undefined} onPointerDown={handlePrimaryActionPointerDown} onMouseDown={preserveDesktopInputFocusOnMouseDown} />}
      </div>
    </>;
  const spatialEntryNode = spatialEntry ? (
    <div className="conv-entry" data-entry-state={entryState} aria-hidden={entryState === "write" ? "true" : undefined}>
      {/* Idle: kaks ikooni — Räägi (dikteerimine) + Kirjuta (kirjutusrežiim) */}
      <div className="conv-entry-idle">
        {showDictationButton && voiceEnabled ? (
          <button type="button" className="conv-entry-btn conv-entry-voice" onClick={handleVoiceEntry} aria-label={voiceEntryLabel} title={voiceEntryLabel}>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
            </svg>
            <span>{voiceEntryLabel}</span>
          </button>
        ) : null}
        <button type="button" className="conv-entry-btn conv-entry-write" onClick={enterWriteMode} aria-label={writeEntryLabel} title={writeEntryLabel}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 20h16" />
            <path d="M14.5 4.5a2.12 2.12 0 0 1 3 3L8 17l-4 1 1-4Z" />
          </svg>
          <span>{writeEntryLabel}</span>
        </button>
      </div>
      {/* Recording: "Salvestan…" + aeg + Stopp */}
      <div className="conv-entry-recording" role="status" aria-live="polite">
        <span className="conv-rec-dot" aria-hidden="true" />
        <span className="conv-rec-label">{recordingLabel}</span>
        <span className="conv-rec-time">{recTimeLabel}</span>
        <button type="button" className="conv-entry-stop" onClick={handleVoiceEntry} aria-label={stopEntryLabel} title={stopEntryLabel}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
            <rect x="7" y="7" width="10" height="10" rx="2.5" />
          </svg>
          <span>{stopEntryLabel}</span>
        </button>
      </div>
    </div>
  ) : null;
  return <form ref={inputRowRef} style={inputRowStyle} onSubmit={handleSubmit} autoComplete="off" data-entry={spatialEntry ? entryState : undefined}>
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
        <ChatAiForwardToggle t={t} focusActive={focusActive} isRoomMode={isRoomMode} allowAssistantForward={assistantForwardEnabled} sendToAssistant={sendToAssistant} setSendToAssistant={setSendToAssistant} aiNote={aiNote} />
      </div>
      {showModeLabelRow ? <div>
          <div>
            <span className="sr-only">{displayModeLabel}</span>
            <span aria-hidden="true">{displayModeLabel}</span>
          </div>
        </div> : null}
      {spatialEntryNode}
    </form>;
}
