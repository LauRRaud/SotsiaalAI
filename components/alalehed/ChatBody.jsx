"use client";

import { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { writeActiveConversationId } from "@/lib/chat/activeConversationKey";
import LoginModal from "@/components/LoginModal";
import { useAccessibility } from "@/components/accessibility/AccessibilityProvider";
import { useEffectiveRole } from "@/components/auth/useEffectiveRole";
import { useI18n } from "@/components/i18n/I18nProvider";
import ChatMessageItem from "./chat/ChatMessageItem";
import { useSpeech } from "../chat/hooks/useSpeech";
import { useRealtimeVoice } from "../chat/hooks/useRealtimeVoice";
import { useChatStream } from "@/components/chat/hooks/useChatStream";
import { useChatConversationState } from "../chat/hooks/useChatConversationState";
import { prettifyFileName } from "@/components/chat/utils/sources";
import { collectMessageSources, useConversationSources } from "@/components/chat/hooks/useConversationSources";
import { useChatAnalysisController } from "@/components/chat/hooks/useChatAnalysisController";
import HelpListingsPanel from "@/components/chat/HelpListingsPanel";
import SelectedListingContext from "@/components/chat/SelectedListingContext";
import { getHelpUiText } from "@/components/chat/helpUiText";
import ModalConfirm from "@/components/ui/ModalConfirm";
import { pushWithTransition } from "@/lib/routeTransition";
import { clearStaleScrollLock } from "@/lib/scrollLock";
import { resolveChatLayoutVars } from "./chat/chatLayoutVars";
import { useChatMobileRail } from "./chat/hooks/useChatMobileRail";
import { useChatProfileRoll } from "./chat/hooks/useChatProfileRoll";
import { useChatRoomMode, useSyncRoomAssistantMessages } from "./chat/hooks/useChatRoomMode";
import ChatBodyView from "./chat/ChatBodyView";
import VoiceModeSurface from "./chat/VoiceModeSurface";
import RoomCallBar from "@/components/rooms/RoomCallBar";
import RoomSummaryApprovalCard from "@/components/rooms/RoomSummaryApprovalCard";
import { useRoomCall } from "@/components/rooms/useRoomCall";
import { localizePath, stripLocaleFromPath } from "@/lib/localizePath";
import { buildRoomChatPath } from "@/lib/roomPath";
import { isActiveDocumentWorkflowState } from "@/lib/chat/documentWorkflowState";
import { getHelpListingsReturnTarget } from "@/lib/chat/helpListingsReturnTarget";
import { createHelpWorkflowDraftState, isActiveHelpWorkflowState } from "@/lib/help/workflowState";
import {
  clearChatJourneyDraft,
  readChatJourneyDraft,
  writeChatJourneyDraft
} from "@/lib/journey/chatDraftStorage";
import {
  resolveMobileChatKeyboardOffset,
  resolveMobileChatKeyboardVisibilityOffset
} from "./chat/mobileViewportUtils";
import {
  consumeWorkspacePanelMorph,
  resolveWorkspaceRestoreTransition
} from "@/lib/workspacePanelMorph";
import { requestPrivacyCheck } from "@/lib/privacy/privacyCheckClient";
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;
const MOBILE_KEYBOARD_OPEN_THRESHOLD = 88;
const MOBILE_KEYBOARD_CLOSE_THRESHOLD = 56;
const MOBILE_KEYBOARD_BLUR_SETTLE_MS = 220;
const MOBILE_KEYBOARD_BASELINE_CAPTURE_MS = 320;
const MOBILE_KEYBOARD_OPEN_STABLE_MS = 96;
const MOBILE_KEYBOARD_OFFSET_JITTER_PX = 10;
/* Klaviatuur lahti → komposeri koha mõõdab `--chat-vk-offset` ja alles jääb
   kitsas vahe klaviatuuri servast. Puhkeasendi varud (kodunupu ala VÕI
   brauseri tööriistariba + 2.5rem, vt chat.css `--chat-composer-rest-inset`)
   LIITUSID varem selle nihkega ja sisend hüppas klaviatuurist ~70 px kõrgele
   (omanik 28.07: „hüppas üles poole, kõrgemale kui peaks"). */
const MOBILE_COMPOSER_KEYBOARD_GAP = "0.55rem";
/* iOS ei kerita LEHTE, vaid nihutab visuaalset vaateava (`vv.offsetTop`),
   kui fookus läheb klaviatuuri alla jäävale väljale. Meie tõstame komposeri
   ise, seega nihe on üleliigne — ja tema tõttu lähevad paneeli ülanupud (☰,
   ×) ekraanist välja (omanik 28.07). `scrollTo(0,0)` võtab nihke maha; katse
   on loendatud, et mitte jääda Safariga võitlema, kui ta nihkest ei loobu. */
const MOBILE_VIEWPORT_UNPAN_ATTEMPTS = 4;
const WORKSPACE_SURFACE_SETTLE_MS = 680;
function setComposerKeyboardInset(node, keyboardOpen) {
  if (!node) return;
  if (keyboardOpen) {
    node.style.setProperty("--chat-composer-inset", MOBILE_COMPOSER_KEYBOARD_GAP);
    return;
  }
  node.style.removeProperty("--chat-composer-inset");
}
const CHAT_HELP_PANEL_STORAGE_KEY = "__SOTSIAALAI_CHAT_HELP_PANEL__";
const CHAT_HELP_PANEL_SOURCE_STORAGE_KEY = "__SOTSIAALAI_CHAT_HELP_PANEL_SOURCE__";
const CHAT_WORKSPACE_RESTORE_STORAGE_KEY = "__SOTSIAALAI_CHAT_WORKSPACE_RESTORE__";
const CHAT_EMPTY_INTRO_SEEN_KEY_PREFIX = "sotsiaalai:chat:empty-intro-seen";
const HOME_RETURN_FROM_CHAT_KEY = "sotsiaalai:home-return-from-chat";
const ACTIVE_CHAT_WORKFLOW_VALUES = Object.freeze([
  "default",
  "deep_research",
  "help_request",
  "help_offer",
  "journey"
]);

function readTranslated(t, key, fallback) {
  const value = typeof t === "function" ? t(key) : "";
  return typeof value === "string" && value && value !== key ? value : fallback;
}

function readChatSurfaceModeFromDom() {
  if (typeof document === "undefined") return null;
  const html = document.documentElement;
  const highContrast = html.getAttribute("data-contrast") === "hc";
  const lightTheme = html.classList.contains("theme-light");
  const isLightTheme = !highContrast && lightTheme;

  return {
    isLightTheme,
    usesInputHoleSurface: highContrast || !isLightTheme,
    signature: `${highContrast ? "hc" : "normal"}|${lightTheme ? "light" : "dark"}`
  };
}

function createConversationId() {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return String(Date.now());
}

function createEmptyListingsPanelState() {
  return {
    items: [],
    nextOffset: null,
    loading: false,
    error: ""
  };
}

function createEmptySelectedListingState() {
  return {
    loading: false,
    error: "",
    listing: null,
    isOwn: false,
    canDelete: false,
    connectOptions: [],
    selectedConnectListingId: "",
    edit: null,
    busyAction: "",
    deleteConfirmOpen: false
  };
}

function normalizeActiveWorkflow(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return ACTIVE_CHAT_WORKFLOW_VALUES.includes(normalized) ? normalized : "default";
}

function readWorkflowFromSearchParams(searchParams) {
  if (typeof searchParams?.get !== "function") return "default";
  return normalizeActiveWorkflow(searchParams.get("workflow"));
}

function readHelpJourneyPrefillRequest(searchParams) {
  if (readWorkflowFromSearchParams(searchParams) !== "help_request") return null;
  const journeyId = String(searchParams.get("fromJourney") || "").trim();
  if (!journeyId) return null;
  const shareKeys = String(searchParams.get("share") || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return {
    journeyId,
    shareKeys,
    shareKey: shareKeys.join(",")
  };
}

function buildHelpWorkflowPrefillState(searchParams, journeyProjection = null) {
  const workflow = readWorkflowFromSearchParams(searchParams);
  if (workflow !== "help_request" && workflow !== "help_offer") return null;
  const intent = workflow === "help_request" ? "create_help_request" : "create_help_offer";
  const fromJourney = String(searchParams.get("fromJourney") || "").trim();
  if (fromJourney) {
    if (journeyProjection?.sourceJourneyId !== fromJourney) return null;
    return createHelpWorkflowDraftState({
      intent,
      step: "collect_required_fields",
      flowLocked: true,
      municipalityId: journeyProjection.municipalityId,
      municipalityLabel: journeyProjection.municipalityLabel,
      sourceMessage: "journey_help_prefill",
      draft: journeyProjection.draft
    });
  }
  const categoryCode = String(searchParams.get("category") || "").trim().toUpperCase();
  const municipalityName = String(searchParams.get("municipalityName") || "").trim();

  return createHelpWorkflowDraftState({
    intent,
    step: "collect_required_fields",
    flowLocked: true,
    municipalityLabel: municipalityName,
    sourceMessage: "",
    draft: {
      categoryCode,
      category: categoryCode,
      rawPlace: municipalityName,
      extraNotes: ""
    }
  });
}

function getEmptyIntroMessage(t, workflow) {
  if (workflow === "deep_research") return t("chat.empty_intro_deep_research");
  if (workflow === "help_request") return t("chat.empty_intro_help_request");
  if (workflow === "help_offer") return t("chat.empty_intro_help_offer");
  if (workflow === "journey") return readTranslated(t, "journey.workflow.startBody", "Journey mode. Describe the situation in your own words. I will help create an initial journey map. The journey stays private and is not shared before you confirm it.");
  return t("chat.empty_intro");
}

function getWorkflowModeLabel(t, workflow) {
  if (workflow === "deep_research") {
    const value = t("chat.deep_research.mode_label");
    return value && value !== "chat.deep_research.mode_label"
      ? value
      : "Süvauuring";
  }
  if (workflow === "career") {
    const value = t("chat.tools.career_mode");
    return value && value !== "chat.tools.career_mode"
      ? value
      : "Karjäärinõustamine";
  }
  if (workflow === "help_request") {
    const value = t("chat.tools.help_request_mode");
    return value && value !== "chat.tools.help_request_mode"
      ? value
      : "Abisoov";
  }
  if (workflow === "help_offer") {
    const value = t("chat.tools.help_offer_mode");
    return value && value !== "chat.tools.help_offer_mode"
      ? value
      : "Abipakkumine";
  }
  if (workflow === "journey") {
    return readTranslated(t, "journey.chatTool.label", "Teekond");
  }
  return t("chat.tools.info_mode");
}

function normalizeJourneyListItems(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item : item?.title || item?.description || ""))
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function formatJourneyDraftMessage(t, draft) {
  const title = String(draft?.title || "").trim();
  const summary = String(draft?.summary || "").trim();
  const primaryPath = String(draft?.primaryPath || "UNKNOWN").trim();
  const domains = normalizeJourneyListItems(draft?.domains);
  const missingInfo = normalizeJourneyListItems(draft?.missingInfo);
  const riskSignals = normalizeJourneyListItems(draft?.riskSignals);
  const suggestedActions = normalizeJourneyListItems(draft?.suggestedActions);
  const primaryPathLabel = readTranslated(t, `journey.primary_paths.${primaryPath}`, primaryPath || readTranslated(t, "journey.primary_paths.UNKNOWN", "Not clear yet"));
  const listBlock = (label, items, emptyFallback) => [
    label,
    ...(items.length ? items.map((item) => `- ${item}`) : [`- ${emptyFallback}`])
  ].join("\n");

  return [
    readTranslated(t, "journey.workflow.draftTitle", "Journey draft"),
    "",
    `${readTranslated(t, "journey.labels.title", "Title")}: ${title}`,
    "",
    `${readTranslated(t, "journey.labels.summary", "Situation summary")}:`,
    summary,
    "",
    `${readTranslated(t, "journey.labels.primary_path", "Primary direction")}: ${primaryPathLabel}`,
    "",
    listBlock(
      readTranslated(t, "journey.labels.domains", "Related topics"),
      domains,
      readTranslated(t, "journey.messages.empty_domains", "No related topics have been added.")
    ),
    "",
    listBlock(
      readTranslated(t, "journey.labels.missing_info", "Missing information"),
      missingInfo,
      readTranslated(t, "journey.messages.empty_missing_info", "No missing information has been added.")
    ),
    "",
    listBlock(
      readTranslated(t, "journey.labels.risk_signals", "Careful notes"),
      riskSignals,
      readTranslated(t, "journey.messages.empty_risk_signals", "No careful notes have been added.")
    ),
    "",
    listBlock(
      readTranslated(t, "journey.labels.suggested_actions", "Suggested next steps"),
      suggestedActions,
      readTranslated(t, "journey.messages.empty_suggested_actions", "No suggested next steps have been added.")
    ),
    "",
    readTranslated(t, "journey.workflow.privacyNote", "This is a draft. It is not saved or shared before you confirm it."),
    "",
    readTranslated(t, "journey.workflow.nextPrompt", "Write more details, or answer: save, clarify, or cancel.")
  ].filter((line) => line != null).join("\n");
}

function isJourneySaveCommand(text) {
  return /^(salvesta|salvesta teekond|kinnita|save|save journey|confirm|сохранить|подтвердить)\.?$/iu.test(String(text || "").trim());
}

function isJourneyCancelCommand(text) {
  return /^(tühista|tyhista|katkesta|cancel|отмена|отменить)\.?$/iu.test(String(text || "").trim());
}

function isJourneyRefineCommand(text) {
  return /^(täpsustan|tapsustan|täpsustan veel|tapsustan veel|refine|clarify|уточнить|уточню)\.?$/iu.test(String(text || "").trim());
}

function getEmptyIntroSeenStorageKey({
  convId,
  userId,
  userRole,
  locale
}) {
  if (!convId) return null;
  const uid = userId || "anon";
  const role = (userRole || "CLIENT").toLowerCase();
  const loc = locale || "et";
  return `${CHAT_EMPTY_INTRO_SEEN_KEY_PREFIX}:${uid}:${role}:${loc}:${convId}`;
}

function getConversationRenderLimitStorageKey({
  convId,
  userId,
  userRole,
  locale
}) {
  if (!convId) return null;
  const uid = userId || "anon";
  const role = (userRole || "CLIENT").toLowerCase();
  const loc = locale || "et";
  return `sotsiaalai:chat:render-limit:${uid}:${role}:${loc}:${convId}`;
}

function readStoredRenderLimit(storageKey) {
  if (!storageKey || typeof window === "undefined") return null;
  try {
    const rawValue = window.sessionStorage.getItem(storageKey);
    const parsed = Number.parseInt(String(rawValue || ""), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function writeStoredRenderLimit(storageKey, value) {
  if (!storageKey || typeof window === "undefined") return;
  const nextValue = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(nextValue) || nextValue <= 0) return;
  try {
    window.sessionStorage.setItem(storageKey, String(nextValue));
  } catch {}
}

function isEditableElement(node) {
  if (!(node instanceof Element)) return false;
  const tag = node.tagName;
  return tag === "TEXTAREA" || tag === "INPUT" || node.isContentEditable;
}

function resolveCssLengthPx(value, contextNode = null) {
  const raw = String(value || "").trim();
  if (!raw) return 0;

  const numeric = Number.parseFloat(raw);
  if (!Number.isFinite(numeric)) return 0;
  if (raw.endsWith("px")) return numeric;

  if (raw.endsWith("rem")) {
    const root = contextNode?.ownerDocument?.documentElement || document.documentElement;
    const rootFontSize = Number.parseFloat(window.getComputedStyle(root).fontSize) || 16;
    return numeric * rootFontSize;
  }

  if (raw.endsWith("em")) {
    const fontSize = contextNode
      ? Number.parseFloat(window.getComputedStyle(contextNode).fontSize) || 16
      : 16;
    return numeric * fontSize;
  }

  return raw === String(numeric) ? numeric : 0;
}

export default function ChatBody({
  roomId = null,
  onBackHome = null,
  embedded = false,
  requestLoginOnOpen = false,
  emailVerifiedEntry = false
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const {
    data: session,
    status
  } = useSession();
  const { actualRole, effectiveRole, isAdmin: effectiveRoleIsAdmin } = useEffectiveRole();
  const {
    t,
    locale
  } = useI18n();
  const {
    prefs
  } = useAccessibility();
  const prefsIsLightTheme = prefs?.theme === "light";
  const initialWorkspaceOpenFromSearch =
    typeof searchParams?.get === "function" &&
    Boolean(String(searchParams.get("workspace") || "").trim());
  const [domChatSurfaceMode, setDomChatSurfaceMode] = useState(null);
  const isLightTheme = domChatSurfaceMode?.isLightTheme ?? prefsIsLightTheme;
  const extendedLabel = t("chat.analysis.extended_label");
  const contextHint = t("chat.upload.context_hint");
  const aiNote = t("chat.ai_toggle.note");
  const crisisText = t("chat.crisis.notice");
  const sessionUserId = session?.user?.id;
  const sessionUserRole = effectiveRole;
  const userRole = effectiveRole;
  const userActualRole = actualRole;
  const userIsAdmin = Boolean(
    effectiveRoleIsAdmin ||
    session?.user?.isAdmin ||
    String(session?.user?.role || "").trim().toUpperCase() === "ADMIN"
  );
  const voiceEnabled = Boolean(session?.user?.isAdmin || session?.subActive);
  const [inputFocused, setInputFocused] = useState(false);
  const [voiceModeOpen, setVoiceModeOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(() => initialWorkspaceOpenFromSearch);
  const [workspaceSurfaceReady, setWorkspaceSurfaceReady] = useState(() => initialWorkspaceOpenFromSearch);
  const [workspaceSuppressOpenTransition, setWorkspaceSuppressOpenTransition] = useState(() => initialWorkspaceOpenFromSearch);
  const {
    isMobile,
    mobileRailVisible,
    mobileRailInteractionLocked
  } = useChatMobileRail();
  const [errorBanner, setErrorBanner] = useState(null);
  const [isCrisis, setIsCrisis] = useState(false);
  const [activeWorkflow, setActiveWorkflow] = useState(() => readWorkflowFromSearchParams(searchParams));
  const helpJourneyPrefillRequest = useMemo(
    () => readHelpJourneyPrefillRequest(searchParams),
    [searchParams]
  );
  const helpJourneyPrefillId = helpJourneyPrefillRequest?.journeyId || "";
  const helpJourneyPrefillShareKey = helpJourneyPrefillRequest?.shareKey || "";
  const [helpJourneyProjection, setHelpJourneyProjection] = useState(null);
  useEffect(() => {
    if (!helpJourneyPrefillId) {
      setHelpJourneyProjection(null);
      return undefined;
    }
    const controller = new AbortController();
    setHelpJourneyProjection(null);
    fetch(`/api/journeys/${encodeURIComponent(helpJourneyPrefillId)}/help-request-draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shareKeys: helpJourneyPrefillShareKey.split(",").filter(Boolean)
      }),
      signal: controller.signal
    })
      .then((response) => response.json().catch(() => ({})))
      .then((payload) => {
        if (controller.signal.aborted) return;
        setHelpJourneyProjection(payload?.ok ? payload.prefill || null : null);
      })
      .catch(() => {
        if (!controller.signal.aborted) setHelpJourneyProjection(null);
      });
    return () => controller.abort();
  }, [helpJourneyPrefillId, helpJourneyPrefillShareKey]);
  const helpWorkflowPrefillState = useMemo(
    () => buildHelpWorkflowPrefillState(searchParams, helpJourneyProjection),
    [helpJourneyProjection, searchParams]
  );
  const [journeyWorkflowDraft, setJourneyWorkflowDraft] = useState(null);
  const journeyDraftReadyScopeRef = useRef("");
  const [isJourneyGenerating, setIsJourneyGenerating] = useState(false);
  const [showSourcesPanel, setShowSourcesPanel] = useState(false);
  const [scopedSources, setScopedSources] = useState(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const autoLoginHandledRef = useRef(false);
  const verifyEntryUrlClearedRef = useRef(false);
  const helpUi = useMemo(() => getHelpUiText(t), [t]);
  const effectiveRoomId = useMemo(() => {
    const roomIdFromSearch = typeof searchParams?.get === "function"
      ? String(searchParams.get("roomId") || "").trim()
      : "";
    return roomIdFromSearch || roomId || null;
  }, [roomId, searchParams]);
  const initialIsHelpMatchRoom = useMemo(() => {
    if (typeof searchParams?.get !== "function") return false;
    return String(searchParams.get("roomKind") || "").trim().toLowerCase() === "help-match";
  }, [searchParams]);
  const [activeListingsPanel, setActiveListingsPanel] = useState(null);
  const [listingsPanelClosing, setListingsPanelClosing] = useState(false);
  const [listingsPanelState, setListingsPanelState] = useState(() => createEmptyListingsPanelState());
  const [selectedListingState, setSelectedListingState] = useState(() => createEmptySelectedListingState());
  const [isEntering, setIsEntering] = useState(false);
  const [isGeneratingForSave, setIsGeneratingForSave] = useState(false);
  const [analysisPanelWidth, setAnalysisPanelWidth] = useState(null);
  const [hasHydrated, setHasHydrated] = useState(false);
  const viewportIsMobile = hasHydrated ? isMobile : false;
  const [layoutTransitionsReady, setLayoutTransitionsReady] = useState(false);
  const listingsPanelCloseTimerRef = useRef(null);
  const searchWorkflowHandledRef = useRef("");
  const searchConversationHandledRef = useRef("");
  const chatWindowRef = useRef(null);
  const chatContainerRef = useRef(null);
  const isGeneratingRef = useRef(false);
  const renderLimitInitializedConvRef = useRef(null);
  const blurTimerRef = useRef(0);
  const mobileKeyboardWasOpenRef = useRef(false);
  const inputRef = useRef(null);
  const composerDraftApiRef = useRef(null);
  const inputRowRef = useRef(null);
  const inputBarRef = useRef(null);
  const mobileKeyboardBaselineRef = useRef({
    viewportExtent: 0,
    containerHeight: 0
  });
  const sourcesButtonRef = useRef(null);
  const backTapGuardRef = useRef(0);
  const workspaceSurfaceReadyTimerRef = useRef(0);
  const workspaceRestoredOpenRef = useRef(initialWorkspaceOpenFromSearch);
  const workspaceRestoreTransitionRafRef = useRef(0);
  const {
    isRoomMode,
    roomMessages,
    roomBlocked,
    roomAuthRequired,
    roomTitle,
    roomRole,
    isHelpMatchRoom,
    roomOrigin,
    roomSummaryApprovals,
    reloadRoomMessages,
    sendToAssistant,
    setSendToAssistant,
    getVisibleMessages,
    onRoomMessageSent,
    onAssistantMessageCreated,
    pendingRoomAiIdsRef,
    seenRoomAiIdsRef
  } = useChatRoomMode({
    roomId: effectiveRoomId,
    sessionUserId,
    t,
    initialIsHelpMatchRoom
  });
  const allowAssistantForward = !isHelpMatchRoom;
  const hideComposerTools = isHelpMatchRoom;
  // 14 K1: kõne on kestev seansiolek ja elab siin, mitte vestlusnäo sees —
  // töölaua/profiili avamine unmount'ib RoomCallBar'i esitluse, aga hook
  // (LiveKit-ühendus, 5 s poll) jääb elama. Ligipääsu kadu (blocked/auth)
  // annab hookile tühja roomId → fail-closed reset + server-leave.
  const roomCallSession = useRoomCall(
    isRoomMode && sessionUserId && !roomBlocked && !roomAuthRequired ? effectiveRoomId : "",
    sessionUserId
  );
  useIsomorphicLayoutEffect(() => {
    if (typeof window === "undefined") return;
    let shouldRestore = false;
    try {
      const raw = window.sessionStorage.getItem(CHAT_WORKSPACE_RESTORE_STORAGE_KEY);
      if (raw) {
        window.sessionStorage.removeItem(CHAT_WORKSPACE_RESTORE_STORAGE_KEY);
        const parsed = JSON.parse(raw);
        const ts = Number(parsed?.ts || 0);
        shouldRestore = Number.isFinite(ts) && Date.now() - ts < 30 * 60 * 1000;
      }
    } catch {
      try {
        window.sessionStorage.removeItem(CHAT_WORKSPACE_RESTORE_STORAGE_KEY);
      } catch {}
    }
    if (!shouldRestore) return;
    const morphState = consumeWorkspacePanelMorph();
    const restoreTransition = resolveWorkspaceRestoreTransition(morphState, {
      reduceMotion: prefs?.reduceMotion
    });
    workspaceRestoredOpenRef.current = true;
    setWorkspaceSuppressOpenTransition(restoreTransition.suppressOpenTransition);
    setWorkspaceOpen(true);
    setWorkspaceSurfaceReady(true);
    setShowSourcesPanel(false);
    setInputFocused(false);
    try {
      inputRef.current?.blur?.();
    } catch {}
  }, []);
  useIsomorphicLayoutEffect(() => {
    if (typeof searchParams?.get !== "function") return;
    const workspaceParam = String(searchParams.get("workspace") || "").trim();
    if (!workspaceParam) return;
    workspaceRestoredOpenRef.current = true;
    setWorkspaceSuppressOpenTransition(true);
    setWorkspaceOpen(true);
    setWorkspaceSurfaceReady(true);
    setShowSourcesPanel(false);
    setInputFocused(false);
    try {
      inputRef.current?.blur?.();
    } catch {}
  }, [searchParams]);
  useEffect(() => {
    clearStaleScrollLock();
  }, []);
  const clearVerifyEntryUrl = useCallback(() => {
    if (!emailVerifiedEntry || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    let changed = false;
    if (url.searchParams.has("login")) {
      url.searchParams.delete("login");
      changed = true;
    }
    if (url.searchParams.get("reason") === "email-verified") {
      url.searchParams.delete("reason");
      changed = true;
    }
    if (!changed) return;
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, [emailVerifiedEntry]);
  useEffect(() => {
    if (status === "loading") return;
    if (!requestLoginOnOpen || status !== "unauthenticated") return;
    if (autoLoginHandledRef.current) return;
    autoLoginHandledRef.current = true;
    setLoginOpen(true);
  }, [requestLoginOnOpen, status]);
  useEffect(() => {
    if (!emailVerifiedEntry || status !== "authenticated") return;
    if (verifyEntryUrlClearedRef.current) return;
    verifyEntryUrlClearedRef.current = true;
    clearVerifyEntryUrl();
  }, [clearVerifyEntryUrl, emailVerifiedEntry, status]);
  useIsomorphicLayoutEffect(() => {
    setHasHydrated(true);
  }, []);
  useIsomorphicLayoutEffect(() => {
    if (typeof document === "undefined" || typeof MutationObserver === "undefined") return;
    const html = document.documentElement;
    let lastSignature = "";
    const syncSurfaceMode = () => {
      const next = readChatSurfaceModeFromDom();
      if (!next || next.signature === lastSignature) return;
      lastSignature = next.signature;
      setDomChatSurfaceMode(next);
    };

    syncSurfaceMode();
    const observer = new MutationObserver(syncSurfaceMode);
    observer.observe(html, {
      attributes: true,
      attributeFilter: ["class", "data-contrast"]
    });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const rafId = window.requestAnimationFrame(() => {
      setLayoutTransitionsReady(true);
    });
    return () => window.cancelAnimationFrame(rafId);
  }, []);
  useEffect(() => {
    return () => {
      if (listingsPanelCloseTimerRef.current && typeof window !== "undefined") {
        window.clearTimeout(listingsPanelCloseTimerRef.current);
        listingsPanelCloseTimerRef.current = null;
      }
    };
  }, []);
  useEffect(() => {
    const node = chatContainerRef.current;
    if (!node || typeof window === "undefined" || !isMobile) return;
    const vv = window.visualViewport;
    let rafId = 0;
    const readViewportExtent = () =>
      vv ? Math.max(0, vv.height + vv.offsetTop) : Math.max(0, window.innerHeight);
    const readContainerRect = () => node.getBoundingClientRect();
    const readContainerHeight = rect => {
      const h = (rect || readContainerRect()).height;
      return Math.max(0, Math.round(h || 0));
    };
    const captureBaseline = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        const active = document.activeElement;
        if (node.contains(active) && isEditableElement(active)) return;
        const viewportExtent = Math.max(
          readViewportExtent(),
          Math.max(0, window.innerHeight || 0)
        );
        const containerHeight = readContainerHeight();
        if (viewportExtent > 0 || containerHeight > 0) {
          mobileKeyboardBaselineRef.current = {
            viewportExtent,
            containerHeight
          };
        }
      });
    };
    captureBaseline();
    vv?.addEventListener("resize", captureBaseline);
    vv?.addEventListener("scroll", captureBaseline);
    window.addEventListener("resize", captureBaseline);
    window.addEventListener("orientationchange", captureBaseline);
    window.addEventListener("focusout", captureBaseline);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      vv?.removeEventListener("resize", captureBaseline);
      vv?.removeEventListener("scroll", captureBaseline);
      window.removeEventListener("resize", captureBaseline);
      window.removeEventListener("orientationchange", captureBaseline);
      window.removeEventListener("focusout", captureBaseline);
    };
  }, [isMobile]);
  useEffect(() => {
    const node = chatContainerRef.current;
    if (!node || typeof window === "undefined") return;
    if (!isMobile || !inputFocused) {
      node.style.setProperty("--chat-vk-offset", "0px");
      setComposerKeyboardInset(node, false);
      mobileKeyboardWasOpenRef.current = false;
      return;
    }
    const vv = window.visualViewport;
    let rafId = 0;
    let unpanAttempts = 0;
    let lastAppliedOffset = Number.NaN;
    let lastResolvedOffset = 0;
    let pendingOpenSince = 0;
    let pendingOpenOffset = 0;
    const now = () =>
      typeof performance !== "undefined" ? performance.now() : Date.now();
    const readViewportExtent = () =>
      vv ? Math.max(0, vv.height + vv.offsetTop) : Math.max(0, window.innerHeight);
    const readContainerRect = () => node.getBoundingClientRect();
    const readContainerHeight = rect => {
      const h = (rect || readContainerRect()).height;
      return Math.max(0, Math.round(h || 0));
    };
    const storedBaseline = mobileKeyboardBaselineRef.current || {};
    let baselineViewportExtent = Math.max(
      readViewportExtent(),
      storedBaseline.viewportExtent || 0
    );
    let baselineContainerHeight = Math.max(
      readContainerHeight(),
      storedBaseline.containerHeight || 0
    );
    const baselineCaptureUntil = now() + MOBILE_KEYBOARD_BASELINE_CAPTURE_MS;
    const readKeyboardMetrics = () => {
      const currentExtent = readViewportExtent();
      const currentContainerHeight = readContainerHeight();
      if (now() <= baselineCaptureUntil) {
        baselineViewportExtent = Math.max(baselineViewportExtent, currentExtent);
        if (currentContainerHeight > 0) {
          baselineContainerHeight = Math.max(
            baselineContainerHeight,
            currentContainerHeight
          );
        }
      }
      if (currentExtent > baselineViewportExtent) {
        baselineViewportExtent = currentExtent;
      }
      if (currentContainerHeight > baselineContainerHeight) {
        baselineContainerHeight = currentContainerHeight;
      }
      const containerRect = readContainerRect();
      const metrics = {
        baselineViewportExtent,
        baselineContainerHeight,
        currentViewportExtent: currentExtent,
        currentContainerHeight,
        currentContainerBottom: containerRect.bottom,
        layoutViewportHeight: window.innerHeight || baselineViewportExtent,
        windowInnerHeight: window.innerHeight || 0,
        visualViewportHeight: vv?.height,
        visualViewportOffsetTop: vv?.offsetTop
      };
      return {
        offset: resolveMobileChatKeyboardOffset(metrics),
        keyboardVisibleOffset: resolveMobileChatKeyboardVisibilityOffset(metrics),
        viewportPanned: Math.max(0, Math.round(vv?.offsetTop || 0)) > MOBILE_KEYBOARD_OFFSET_JITTER_PX
      };
    };
    const resolveKeyboardOffset = () => {
      const {
        offset: rawOffset,
        keyboardVisibleOffset,
        viewportPanned
      } = readKeyboardMetrics();
      const keyboardStillOpen =
        rawOffset > MOBILE_KEYBOARD_CLOSE_THRESHOLD ||
        keyboardVisibleOffset > MOBILE_KEYBOARD_CLOSE_THRESHOLD;
      if (keyboardStillOpen) {
        mobileKeyboardWasOpenRef.current = true;
      }
      if (lastResolvedOffset > 0) {
        if (keyboardStillOpen) {
          lastResolvedOffset = viewportPanned
            ? rawOffset
            : Math.max(lastResolvedOffset, rawOffset);
          return lastResolvedOffset;
        }
        lastResolvedOffset = 0;
        pendingOpenSince = 0;
        pendingOpenOffset = 0;
        return lastResolvedOffset;
      }
      if (viewportPanned && keyboardVisibleOffset > MOBILE_KEYBOARD_OPEN_THRESHOLD) {
        lastResolvedOffset = rawOffset;
        pendingOpenSince = 0;
        pendingOpenOffset = 0;
        return lastResolvedOffset;
      }
      if (rawOffset <= MOBILE_KEYBOARD_OPEN_THRESHOLD) {
        pendingOpenSince = 0;
        pendingOpenOffset = 0;
        return 0;
      }
      const ts = now();
      if (!pendingOpenSince) {
        pendingOpenSince = ts;
        pendingOpenOffset = rawOffset;
        return 0;
      }
      pendingOpenOffset = Math.max(pendingOpenOffset, rawOffset);
      if (ts - pendingOpenSince < MOBILE_KEYBOARD_OPEN_STABLE_MS) {
        return 0;
      }
      lastResolvedOffset = pendingOpenOffset;
      pendingOpenSince = 0;
      pendingOpenOffset = 0;
      return lastResolvedOffset;
    };
    const applyKeyboardOffset = offset => {
      if (offset === lastAppliedOffset) return;
      if (
        offset > 0 &&
        lastAppliedOffset > 0 &&
        Math.abs(offset - lastAppliedOffset) < MOBILE_KEYBOARD_OFFSET_JITTER_PX
      ) {
        return;
      }
      lastAppliedOffset = offset;
      node.style.setProperty("--chat-vk-offset", `${offset}px`);
      setComposerKeyboardInset(node, offset > 0);
    };
    // Kui komposer on juba ise klaviatuuri kohale tõstetud, ei ole iOS-i
    // vaateava-nihet enam vaja — tema tõttu kaovad ülanupud ekraanilt.
    const unpanViewport = () => {
      if (!vv || unpanAttempts >= MOBILE_VIEWPORT_UNPAN_ATTEMPTS) return;
      if (Math.round(vv.offsetTop || 0) <= MOBILE_KEYBOARD_OFFSET_JITTER_PX) return;
      unpanAttempts += 1;
      window.scrollTo(0, 0);
    };
    const updateKeyboardOffset = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        const offset = resolveKeyboardOffset();
        applyKeyboardOffset(offset);
        if (offset > 0) unpanViewport();
      });
    };
    updateKeyboardOffset();
    vv?.addEventListener("resize", updateKeyboardOffset);
    vv?.addEventListener("scroll", updateKeyboardOffset);
    window.addEventListener("orientationchange", updateKeyboardOffset);
    window.addEventListener("resize", updateKeyboardOffset);
    window.addEventListener("focusin", updateKeyboardOffset);
    window.addEventListener("focusout", updateKeyboardOffset);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      vv?.removeEventListener("resize", updateKeyboardOffset);
      vv?.removeEventListener("scroll", updateKeyboardOffset);
      window.removeEventListener("orientationchange", updateKeyboardOffset);
      window.removeEventListener("resize", updateKeyboardOffset);
      window.removeEventListener("focusin", updateKeyboardOffset);
      window.removeEventListener("focusout", updateKeyboardOffset);
      node.style.setProperty("--chat-vk-offset", "0px");
      setComposerKeyboardInset(node, false);
      mobileKeyboardWasOpenRef.current = false;
    };
  }, [inputFocused, isMobile]);
  useEffect(() => {
    const node = chatContainerRef.current;
    if (!node || typeof window === "undefined" || !isMobile || !inputFocused) return;
    const vv = window.visualViewport;
    let rafId = 0;
    let settleTimer = 0;
    const readKeyboardOffset = () =>
      vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0;
    const clearSettledKeyboardState = () => {
      const active = document.activeElement;
      if (active && node.contains(active) && isEditableElement(active)) return;
      mobileKeyboardWasOpenRef.current = false;
      node.style.setProperty("--chat-vk-offset", "0px");
      setComposerKeyboardInset(node, false);
      setInputFocused(false);
    };
    const scheduleCheck = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        const keyboardOffset = readKeyboardOffset();
        if (keyboardOffset > MOBILE_KEYBOARD_CLOSE_THRESHOLD) {
          mobileKeyboardWasOpenRef.current = true;
          if (settleTimer) {
            window.clearTimeout(settleTimer);
            settleTimer = 0;
          }
          return;
        }
        if (!mobileKeyboardWasOpenRef.current) return;
        if (settleTimer) window.clearTimeout(settleTimer);
        settleTimer = window.setTimeout(() => {
          settleTimer = 0;
          if (readKeyboardOffset() > MOBILE_KEYBOARD_CLOSE_THRESHOLD) return;
          clearSettledKeyboardState();
        }, MOBILE_KEYBOARD_BLUR_SETTLE_MS);
      });
    };
    scheduleCheck();
    vv?.addEventListener("resize", scheduleCheck);
    vv?.addEventListener("scroll", scheduleCheck);
    window.addEventListener("resize", scheduleCheck);
    window.addEventListener("orientationchange", scheduleCheck);
    window.addEventListener("focusout", scheduleCheck);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      if (settleTimer) window.clearTimeout(settleTimer);
      vv?.removeEventListener("resize", scheduleCheck);
      vv?.removeEventListener("scroll", scheduleCheck);
      window.removeEventListener("resize", scheduleCheck);
      window.removeEventListener("orientationchange", scheduleCheck);
      window.removeEventListener("focusout", scheduleCheck);
    };
  }, [inputFocused, isMobile]);
  useEffect(() => {
    const node = chatContainerRef.current;
    if (!node || typeof window === "undefined" || !isMobile) return;
    const vv = window.visualViewport;
    let rafId = 0;
    const readKeyboardOffset = () =>
      vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0;
    const clearStaleOffset = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        const active = document.activeElement;
        if (active && node.contains(active) && isEditableElement(active)) return;
        if (readKeyboardOffset() > MOBILE_KEYBOARD_CLOSE_THRESHOLD) return;
        mobileKeyboardWasOpenRef.current = false;
        node.style.setProperty("--chat-vk-offset", "0px");
        setComposerKeyboardInset(node, false);
        if (inputFocused) setInputFocused(false);
      });
    };
    clearStaleOffset();
    vv?.addEventListener("resize", clearStaleOffset);
    vv?.addEventListener("scroll", clearStaleOffset);
    window.addEventListener("resize", clearStaleOffset);
    window.addEventListener("orientationchange", clearStaleOffset);
    window.addEventListener("focusout", clearStaleOffset);
    window.addEventListener("pageshow", clearStaleOffset);
    document.addEventListener("visibilitychange", clearStaleOffset);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      vv?.removeEventListener("resize", clearStaleOffset);
      vv?.removeEventListener("scroll", clearStaleOffset);
      window.removeEventListener("resize", clearStaleOffset);
      window.removeEventListener("orientationchange", clearStaleOffset);
      window.removeEventListener("focusout", clearStaleOffset);
      window.removeEventListener("pageshow", clearStaleOffset);
      document.removeEventListener("visibilitychange", clearStaleOffset);
    };
  }, [inputFocused, isMobile]);
  const MAX_RENDERED_MESSAGES = 80;
  const PAGE_SIZE = 80;
  const [renderLimit, setRenderLimit] = useState(MAX_RENDERED_MESSAGES);
  const handleInputBlur = useCallback(event => {
    const node = chatContainerRef.current;
    const next = event?.relatedTarget || document.activeElement;
    if (next && node?.contains(next)) return;
    if (blurTimerRef.current && typeof window !== "undefined") {
      window.clearTimeout(blurTimerRef.current);
      blurTimerRef.current = 0;
    }
    if (!isMobile) {
      blurTimerRef.current = window.setTimeout(() => {
        const active = document.activeElement;
        if (node?.contains(active)) return;
        setInputFocused(false);
        blurTimerRef.current = 0;
      }, 0);
      return;
    }
    blurTimerRef.current = window.setTimeout(() => {
      const active = document.activeElement;
      if (node?.contains(active) && isEditableElement(active)) return;
      const vv = window.visualViewport;
      const rawOffset = vv
        ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))
        : 0;
      const clearComposerFocus = () => {
        setInputFocused(false);
        node?.style.setProperty("--chat-vk-offset", "0px");
        blurTimerRef.current = 0;
      };
      if (rawOffset > MOBILE_KEYBOARD_CLOSE_THRESHOLD) {
        blurTimerRef.current = window.setTimeout(() => {
          const activeLater = document.activeElement;
          if (node?.contains(activeLater) && isEditableElement(activeLater)) {
            blurTimerRef.current = 0;
            return;
          }
          clearComposerFocus();
        }, MOBILE_KEYBOARD_BLUR_SETTLE_MS);
        return;
      }
      clearComposerFocus();
    }, MOBILE_KEYBOARD_BLUR_SETTLE_MS);
  }, [isMobile]);
  const [composerHasDraft, setComposerHasDraft] = useState(false);
  const [emptyIntroSeenOverride, setEmptyIntroSeenOverride] = useState(false);
  const waitForComposerCollapse = useCallback(async () => {
    if (blurTimerRef.current && typeof window !== "undefined") {
      window.clearTimeout(blurTimerRef.current);
      blurTimerRef.current = 0;
    }
    const shouldWait =
      typeof window !== "undefined" &&
      !isMobile &&
      inputFocused;
    setInputFocused(false);
    try {
      inputRef.current?.blur?.();
    } catch {}
    if (!shouldWait) return;
    await new Promise(resolve => {
      const row = inputRowRef.current;
      const container = chatContainerRef.current;
      let settled = false;
      let timeoutId = 0;
      let handleTransitionEnd = null;
      let rowSettled = !row;
      let containerSettled = !container;
      function finish() {
        if (settled) return;
        settled = true;
        if (handleTransitionEnd) {
          row?.removeEventListener("transitionend", handleTransitionEnd);
          container?.removeEventListener("transitionend", handleTransitionEnd);
        }
        if (timeoutId) window.clearTimeout(timeoutId);
        resolve();
      }
      handleTransitionEnd = event => {
        if (
          event.target === row &&
          (event.propertyName === "top" ||
            event.propertyName === "margin-top" ||
            event.propertyName === "transform")
        ) {
          rowSettled = true;
          if (containerSettled) finish();
          return;
        }
        if (event.target !== container) return;
        if (
          event.propertyName === "border-top-left-radius" ||
          event.propertyName === "border-top-right-radius" ||
          event.propertyName === "border-bottom-left-radius" ||
          event.propertyName === "border-bottom-right-radius" ||
          event.propertyName === "width" ||
          event.propertyName === "min-width" ||
          event.propertyName === "max-width" ||
          event.propertyName === "height" ||
          event.propertyName === "min-height" ||
          event.propertyName === "max-height" ||
          event.propertyName === "inline-size" ||
          event.propertyName === "block-size" ||
          event.propertyName === "transform"
        ) {
          containerSettled = true;
          if (rowSettled) finish();
        }
      };
      row?.addEventListener("transitionend", handleTransitionEnd);
      container?.addEventListener("transitionend", handleTransitionEnd);
      timeoutId = window.setTimeout(finish, 760);
    });
  }, [inputFocused, isMobile]);
  const {
    profileOpen,
    openProfileDirect,
    closeProfile,
    toggleProfile
  } = useChatProfileRoll({
    embedded,
    router,
    locale,
    showSourcesPanel,
    setShowSourcesPanel,
    setInputFocused,
    inputRef,
    waitForComposerCollapse
  });
  const closeWorkspace = useCallback(() => {
    setWorkspaceSuppressOpenTransition(false);
    setWorkspaceSurfaceReady(false);
    setWorkspaceOpen(false);
  }, []);
  const toggleWorkspace = useCallback(() => {
    if (workspaceOpen) {
      setWorkspaceSuppressOpenTransition(false);
      setWorkspaceSurfaceReady(false);
      setWorkspaceOpen(false);
      return;
    }

    setShowSourcesPanel(false);
    setInputFocused(false);
    setWorkspaceSuppressOpenTransition(false);
    setWorkspaceSurfaceReady(false);
    try {
      inputRef.current?.blur?.();
    } catch {}

    setWorkspaceOpen(true);
  }, [
    setShowSourcesPanel,
    workspaceOpen
  ]);
  const toggleProfileFromRail = useCallback(() => {
    setWorkspaceSuppressOpenTransition(false);
    setWorkspaceSurfaceReady(false);
    setWorkspaceOpen(false);
    toggleProfile?.();
  }, [toggleProfile]);
  const openProfileDirectFromRail = useCallback((options) => {
    setWorkspaceSuppressOpenTransition(false);
    setWorkspaceSurfaceReady(false);
    setWorkspaceOpen(false);
    return openProfileDirect?.(options);
  }, [openProfileDirect]);
  useEffect(() => {
    if (!profileOpen) return;
    setWorkspaceSuppressOpenTransition(false);
    setWorkspaceSurfaceReady(false);
    setWorkspaceOpen(false);
  }, [profileOpen]);
  useEffect(() => {
    if (!workspaceSuppressOpenTransition || typeof window === "undefined") return;

    workspaceRestoreTransitionRafRef.current = window.setTimeout(() => {
      workspaceRestoreTransitionRafRef.current = 0;
      setWorkspaceSuppressOpenTransition(false);
    }, WORKSPACE_SURFACE_SETTLE_MS);

    return () => {
      if (!workspaceRestoreTransitionRafRef.current || typeof window === "undefined") return;
      window.clearTimeout(workspaceRestoreTransitionRafRef.current);
      workspaceRestoreTransitionRafRef.current = 0;
    };
  }, [workspaceSuppressOpenTransition]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    return () => {
      if (workspaceRestoreTransitionRafRef.current) {
        window.clearTimeout(workspaceRestoreTransitionRafRef.current);
        workspaceRestoreTransitionRafRef.current = 0;
      }
      if (workspaceSurfaceReadyTimerRef.current) {
        window.clearTimeout(workspaceSurfaceReadyTimerRef.current);
        workspaceSurfaceReadyTimerRef.current = 0;
      }
      workspaceRestoredOpenRef.current = false;
      setWorkspaceSuppressOpenTransition(false);
      setWorkspaceSurfaceReady(false);
    };
  }, [pathname]);
  useEffect(() => {
    if (workspaceSurfaceReadyTimerRef.current && typeof window !== "undefined") {
      window.clearTimeout(workspaceSurfaceReadyTimerRef.current);
      workspaceSurfaceReadyTimerRef.current = 0;
    }

    if (workspaceSuppressOpenTransition) {
      setWorkspaceSurfaceReady(true);
      return;
    }

    setWorkspaceSurfaceReady(false);
    if (!workspaceOpen) return;

    if (workspaceRestoredOpenRef.current) {
      workspaceRestoredOpenRef.current = false;
      setWorkspaceSurfaceReady(true);
      return;
    }

    if (prefs?.reduceMotion || !layoutTransitionsReady || typeof window === "undefined") {
      setWorkspaceSurfaceReady(true);
      return;
    }

    workspaceSurfaceReadyTimerRef.current = window.setTimeout(() => {
      workspaceSurfaceReadyTimerRef.current = 0;
      setWorkspaceSurfaceReady(true);
    }, WORKSPACE_SURFACE_SETTLE_MS);

    return () => {
      if (!workspaceSurfaceReadyTimerRef.current || typeof window === "undefined") return;
      window.clearTimeout(workspaceSurfaceReadyTimerRef.current);
      workspaceSurfaceReadyTimerRef.current = 0;
    };
  }, [layoutTransitionsReady, prefs?.reduceMotion, workspaceOpen, workspaceSuppressOpenTransition]);
  useEffect(() => {
    return () => {
      if (workspaceSurfaceReadyTimerRef.current && typeof window !== "undefined") {
        window.clearTimeout(workspaceSurfaceReadyTimerRef.current);
        workspaceSurfaceReadyTimerRef.current = 0;
      }
      if (workspaceRestoreTransitionRafRef.current && typeof window !== "undefined") {
        window.clearTimeout(workspaceRestoreTransitionRafRef.current);
        workspaceRestoreTransitionRafRef.current = 0;
      }
    };
  }, []);
  const {
    convId,
    setConvId,
    messages,
    setMessages,
    conversationLocalReady,
    appendMessage,
    mutateMessage,
    historyPayload,
    getLatestHelpWorkflowState
  } = useChatConversationState({
    isRoomMode,
    roomId: effectiveRoomId,
    isGenerating: isGeneratingForSave,
    setErrorBanner,
    setIsCrisis,
    t,
    locale,
    userId: sessionUserId,
    userRole: sessionUserRole,
    getVisibleMessages
  });
  const journeyDraftScope = sessionUserId && convId
    ? `${sessionUserId}:${convId}`
    : "";
  useIsomorphicLayoutEffect(() => {
    journeyDraftReadyScopeRef.current = "";
    if (!conversationLocalReady || !sessionUserId || !convId || typeof window === "undefined") {
      setJourneyWorkflowDraft(null);
      return;
    }
    const restored = readChatJourneyDraft(window.sessionStorage, sessionUserId, convId);
    const restoredWithActionId = restored ? {
      ...restored,
      draft: {
        ...restored.draft,
        clientActionId: restored.draft?.clientActionId
          || globalThis.crypto?.randomUUID?.()
          || `journey-${Date.now()}-${Math.random().toString(36).slice(2)}`
      }
    } : null;
    setJourneyWorkflowDraft(restoredWithActionId);
    if (restoredWithActionId) setActiveWorkflow("journey");
    journeyDraftReadyScopeRef.current = journeyDraftScope;
  }, [convId, conversationLocalReady, journeyDraftScope, sessionUserId]);
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !journeyWorkflowDraft ||
      !journeyDraftScope ||
      journeyDraftReadyScopeRef.current !== journeyDraftScope
    ) return;
    writeChatJourneyDraft(
      window.sessionStorage,
      sessionUserId,
      convId,
      journeyWorkflowDraft
    );
  }, [convId, journeyDraftScope, journeyWorkflowDraft, sessionUserId]);
  const visibleMessages = useMemo(() => getVisibleMessages(messages), [getVisibleMessages, messages]);
  useEffect(() => {
    if (
      !journeyWorkflowDraft ||
      !journeyDraftScope ||
      journeyDraftReadyScopeRef.current !== journeyDraftScope
    ) return;
    const hasDraftMessage = visibleMessages.some(
      (message) => message?.workflow?.journeyDraft?.conversationId === convId
    );
    if (hasDraftMessage) return;
    appendMessage({
      role: "ai",
      text: formatJourneyDraftMessage(t, journeyWorkflowDraft.draft),
      aiVisible: true,
      workflow: { journeyDraft: { conversationId: convId } }
    });
  }, [appendMessage, convId, journeyDraftScope, journeyWorkflowDraft, t, visibleMessages]);
  const latestHelpWorkflowState = useMemo(() => {
    for (let i = visibleMessages.length - 1; i >= 0; i -= 1) {
      const message = visibleMessages[i];
      if (message?.role !== "ai") continue;
      if (!message?.workflow || typeof message.workflow !== "object") continue;
      const helpState = message.workflow.help;
      if (!helpState || typeof helpState !== "object") continue;
      return helpState;
    }
    return null;
  }, [visibleMessages]);
  const effectiveHelpWorkflowState = latestHelpWorkflowState || helpWorkflowPrefillState;
  const getEffectiveLatestHelpWorkflowState = useCallback(
    () => getLatestHelpWorkflowState() || helpWorkflowPrefillState,
    [getLatestHelpWorkflowState, helpWorkflowPrefillState]
  );
  const renderLimitStorageKey = useMemo(() => getConversationRenderLimitStorageKey({
    convId,
    userId: sessionUserId,
    userRole: sessionUserRole,
    locale
  }), [convId, locale, sessionUserId, sessionUserRole]);
  const emptyIntroSeenStorageKey = useMemo(() => getEmptyIntroSeenStorageKey({
    convId,
    userId: sessionUserId,
    userRole: sessionUserRole,
    locale
  }), [convId, locale, sessionUserId, sessionUserRole]);
  const emptyIntroSeenStored = useMemo(() => {
    if (!emptyIntroSeenStorageKey || typeof window === "undefined") return false;
    try {
      return window.sessionStorage.getItem(emptyIntroSeenStorageKey) === "1";
    } catch {
      return false;
    }
  }, [emptyIntroSeenStorageKey]);
  const emptyIntroSeen = emptyIntroSeenStored || emptyIntroSeenOverride;
  useEffect(() => {
    setComposerHasDraft(false);
  }, [convId, effectiveRoomId, locale, sessionUserId, sessionUserRole]);
  useEffect(() => {
    setEmptyIntroSeenOverride(false);
  }, [emptyIntroSeenStorageKey]);
  useEffect(() => {
    if (!isRoomMode) return;
    setActiveWorkflow("default");
    setJourneyWorkflowDraft(null);
    setShowSourcesPanel(false);
    setActiveListingsPanel(null);
    setListingsPanelClosing(false);
    setListingsPanelState(createEmptyListingsPanelState());
    setSelectedListingState(createEmptySelectedListingState());
  }, [isRoomMode]);
  const renderedMessages = useMemo(() => {
    const canShowIntroImmediately = emptyIntroSeen;
    const draftAllowsIntro = canShowIntroImmediately
      ? !composerHasDraft
      : !composerHasDraft;
    const hasEmptyIntro =
      !isRoomMode &&
      conversationLocalReady &&
      draftAllowsIntro &&
      visibleMessages.length === 0;
    const emptyIntroText = getEmptyIntroMessage(t, activeWorkflow);
    const displayMessages = hasEmptyIntro
      ? [{
          id: "__chat-empty-intro__",
          role: "ai",
          text: emptyIntroText,
          aiVisible: true,
          typingEffect: !emptyIntroSeen,
          onTypingComplete: !emptyIntroSeen ? "emptyIntro" : null
        }]
      : visibleMessages;
    const n = displayMessages.length;
    if (n <= renderLimit) return displayMessages;
    return displayMessages.slice(n - renderLimit);
  }, [activeWorkflow, composerHasDraft, conversationLocalReady, emptyIntroSeen, isRoomMode, renderLimit, t, visibleMessages]);
  useEffect(() => {
    if (!convId || !conversationLocalReady) return;

    const initKey = `${convId}:${renderLimitStorageKey || "none"}`;

    if (renderLimitInitializedConvRef.current !== initKey) {
      renderLimitInitializedConvRef.current = initKey;
      const storedLimit = readStoredRenderLimit(renderLimitStorageKey);

      if (storedLimit != null) {
        setRenderLimit(Math.max(MAX_RENDERED_MESSAGES, storedLimit));
        return;
      }

      setRenderLimit(MAX_RENDERED_MESSAGES);
    }
  }, [convId, conversationLocalReady, renderLimitStorageKey]);
  const hiddenCount = useMemo(() => {
    const n = visibleMessages.length;
    return n > renderLimit ? n - renderLimit : 0;
  }, [visibleMessages.length, renderLimit]);
  const latestAiText = useMemo(() => {
    for (let i = visibleMessages.length - 1; i >= 0; i--) {
      const m = visibleMessages[i];
      if (m?.role === "ai" && m?.text) {
        const trimmed = String(m.text).trim();
        if (trimmed) return trimmed;
      }
    }
    return "";
  }, [visibleMessages]);
  const analysis = useChatAnalysisController({
    t,
    locale,
    sessionUserId,
    userRole: sessionUserRole,
    chatWindowRef,
    visibleMessagesCount: visibleMessages.length,
    isGeneratingRef
  });
  const {
    speechReady,
    isSpeaking,
    speakText,
    stopSpeaking,
    recording,
    recordingPulse,
    recordingError,
    voiceNotice,
    handleMic,
    cancelRecording
  } = useSpeech({
    locale,
    latestAiText,
    onAppendText: txt => composerDraftApiRef.current?.appendText?.(txt),
    onError: msg => setErrorBanner(msg),
    voiceEnabled,
    t
  });
  const revealOlder = useCallback(() => {
    const el = chatWindowRef.current;
    const prevScrollHeight = el ? el.scrollHeight : 0;
    const prevScrollTop = el ? el.scrollTop : 0;
    setRenderLimit(prev => {
      const total = visibleMessages.length;
      const nextLimit = Math.min(total, prev + PAGE_SIZE);
      writeStoredRenderLimit(renderLimitStorageKey, nextLimit);
      return nextLimit;
    });
    requestAnimationFrame(() => {
      if (!el) return;
      const newScrollHeight = el.scrollHeight;
      const delta = newScrollHeight - prevScrollHeight;
      el.scrollTop = prevScrollTop + delta;
    });
  }, [renderLimitStorageKey, visibleMessages.length]);
  const {
    conversationSources,
    latestAnswerSources,
    allConversationSources,
    hasConversationSources,
    hasAllConversationSources,
    sourcesPulse
  } = useConversationSources({
    messages,
    showSourcesPanel,
    uploadPreview: analysis.uploadPreview
  });
  const focusSourcesButton = useCallback(() => {
    setTimeout(() => {
      try {
        sourcesButtonRef.current?.focus?.();
      } catch {}
    }, 0);
  }, []);
  const openMessageSources = useCallback((sources) => {
    const nextSources = Array.isArray(sources) ? sources : [];
    if (!nextSources.length) return;
    setScopedSources(nextSources);
    setShowSourcesPanel(true);
  }, []);
  const closeSourcesPanel = useCallback(() => {
    setShowSourcesPanel(false);
    setScopedSources(null);
  }, []);
  const toggleSourcesPanel = useCallback(() => {
    if (!hasConversationSources) return;
    setShowSourcesPanel(prev => {
      const next = !prev;
      if (!next) focusSourcesButton();
      return next;
    });
  }, [hasConversationSources, focusSourcesButton]);
  const keepCareerUploadFocus = false;
  const suppressCareerCvPreview = false;
  const focusInput = useCallback(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);
  const updateComposerMobileReserve = useCallback(() => {
    const container = chatContainerRef.current;
    if (!container || typeof window === "undefined") return;
    if (!viewportIsMobile) {
      container.style.setProperty("--chat-composer-dynamic-extra", "0px");
      container.style.setProperty("--chat-composer-occlusion", "0px");
      return;
    }

    const inputBar = inputBarRef.current;
    if (!inputBar) {
      container.style.setProperty("--chat-composer-dynamic-extra", "0px");
      container.style.setProperty("--chat-composer-occlusion", "0px");
      return;
    }

    const inputRow = inputRowRef.current;
    const computed = window.getComputedStyle(inputBar);
    const resolvedBaseHeight = Math.max(
      resolveCssLengthPx(computed.getPropertyValue("--inputbar-h"), inputBar),
      1
    );
    const inputBarHeight =
      inputBar.getBoundingClientRect().height || inputBar.offsetHeight || resolvedBaseHeight;
    const inputRowHeight =
      inputRow?.getBoundingClientRect?.().height || inputRow?.offsetHeight || inputBarHeight;
    const currentHeight = Math.max(inputBarHeight, inputRowHeight);
    const extraHeight = Math.max(0, currentHeight - resolvedBaseHeight);
    const containerRect = container.getBoundingClientRect();
    const inputBarRect = inputBar.getBoundingClientRect();
    const inputRowRect = inputRow?.getBoundingClientRect?.();
    const inputBarTop = Number.isFinite(inputBarRect.top)
      ? inputBarRect.top
      : Number.POSITIVE_INFINITY;
    const inputRowTop = Number.isFinite(inputRowRect?.top)
      ? inputRowRect.top
      : Number.POSITIVE_INFINITY;
    const inputTop = Math.min(
      inputBarTop,
      inputRowTop
    );
    const composerOcclusion = Number.isFinite(inputTop)
      ? Math.max(0, containerRect.bottom - inputTop)
      : currentHeight;

    container.style.setProperty(
      "--chat-composer-dynamic-extra",
      `${Math.ceil(extraHeight)}px`
    );
    container.style.setProperty(
      "--chat-composer-occlusion",
      `${Math.ceil(composerOcclusion)}px`
    );
  }, [viewportIsMobile]);
  useIsomorphicLayoutEffect(() => {
    const container = chatContainerRef.current;
    if (!container || typeof window === "undefined") return;

    let frameId = 0;
    let resizeObserver = null;
    const visualViewport = window.visualViewport;
    const scheduleUpdate = () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        updateComposerMobileReserve();
      });
    };

    scheduleUpdate();

    const inputBar = inputBarRef.current;
    const inputRow = inputRowRef.current;
    if (typeof ResizeObserver !== "undefined" && inputBar) {
      resizeObserver = new ResizeObserver(scheduleUpdate);
      resizeObserver.observe(inputBar);
      if (inputRow && inputRow !== inputBar) {
        resizeObserver.observe(inputRow);
      }
    }

    window.addEventListener("resize", scheduleUpdate);
    visualViewport?.addEventListener("resize", scheduleUpdate);

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      resizeObserver?.disconnect?.();
      window.removeEventListener("resize", scheduleUpdate);
      visualViewport?.removeEventListener("resize", scheduleUpdate);
      container.style.removeProperty("--chat-composer-dynamic-extra");
      container.style.removeProperty("--chat-composer-occlusion");
    };
  }, [updateComposerMobileReserve]);
  const handleComposerLayoutChange = useCallback(() => {
    updateComposerMobileReserve();

    if (!inputFocused && !keepCareerUploadFocus) return;

    const stickToBottom = () => {
      const node = chatWindowRef.current;
      if (!node) return;
      node.scrollTop = node.scrollHeight;
    };

    requestAnimationFrame(stickToBottom);
    window.setTimeout(stickToBottom, 32);
    window.setTimeout(stickToBottom, 120);
  }, [inputFocused, keepCareerUploadFocus, updateComposerMobileReserve]);
  const patchListingCollections = useCallback((kind, listing, mode = "replace") => {
    setListingsPanelState((prev) => {
      const nextItems = prev.items.filter((item) => !(item.kind === kind && item.id === listing.id));
      if (mode === "delete") {
        return {
          ...prev,
          items: nextItems
        };
      }
      return {
        ...prev,
        items: [listing, ...nextItems]
      };
    });
    setSelectedListingState((prev) => {
      if (!prev.listing || prev.listing.id !== listing.id || prev.listing.kind !== kind) return prev;
      if (mode === "delete") {
        return createEmptySelectedListingState();
      }
      return {
        ...prev,
        listing
      };
    });
  }, []);
  const loadListingsPanel = useCallback(async (panelConfig, options = {}) => {
    if (!panelConfig) return;
    const append = options?.append === true;
    const offset = append
      ? (Number.isFinite(Number(listingsPanelState.nextOffset)) ? Number(listingsPanelState.nextOffset) : 0)
      : 0;

    setListingsPanelState((prev) => ({
      ...prev,
      loading: true,
      error: append ? prev.error : ""
    }));

    try {
      const search = new URLSearchParams({
        kind: panelConfig.kind,
        scope: panelConfig.scope,
        locale,
        limit: "10"
      });
      if (offset > 0) search.set("offset", String(offset));
      if (panelConfig.status) search.set("status", panelConfig.status);
      const response = await fetch(`/api/help/listings?${search.toString()}`, {
        cache: "no-store"
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) {
        throw new Error(helpUi.loadFailed);
      }
      setListingsPanelState((prev) => ({
        items: append ? [...prev.items, ...(payload?.items || [])] : (payload?.items || []),
        nextOffset: payload?.nextOffset ?? null,
        loading: false,
        error: ""
      }));
    } catch (error) {
      setListingsPanelState((prev) => ({
        ...prev,
        loading: false,
        error: error?.message || helpUi.loadFailed
      }));
    }
  }, [helpUi.loadFailed, listingsPanelState.nextOffset, locale]);
  const openListingsPanel = useCallback((panelConfig) => {
    setShowSourcesPanel(false);
    if (listingsPanelCloseTimerRef.current && typeof window !== "undefined") {
      window.clearTimeout(listingsPanelCloseTimerRef.current);
      listingsPanelCloseTimerRef.current = null;
    }
    setListingsPanelClosing(false);
    setActiveListingsPanel(panelConfig);
  }, []);
  const closeListingsPanel = useCallback((options = {}) => {
    const afterClose = typeof options.afterClose === "function" ? options.afterClose : null;
    const delayMs = Number.isFinite(options.delayMs) && options.delayMs > 0 ? options.delayMs : 0;
    if (listingsPanelClosing) return;
    if (listingsPanelCloseTimerRef.current && typeof window !== "undefined") {
      window.clearTimeout(listingsPanelCloseTimerRef.current);
      listingsPanelCloseTimerRef.current = null;
    }
    const finishClose = () => {
      setListingsPanelClosing(false);
      setActiveListingsPanel(null);
      setListingsPanelState({
        items: [],
        nextOffset: null,
        loading: false,
        error: ""
      });
      setSelectedListingState(createEmptySelectedListingState());
      afterClose?.();
    };
    if (!delayMs || typeof window === "undefined" || prefs?.reduceMotion) {
      finishClose();
      return;
    }
    setListingsPanelClosing(true);
    listingsPanelCloseTimerRef.current = window.setTimeout(() => {
      listingsPanelCloseTimerRef.current = null;
      finishClose();
    }, delayMs);
  }, [listingsPanelClosing, prefs?.reduceMotion]);
  const backToProfileFromListingsPanel = useCallback(() => {
    closeListingsPanel({
      afterClose: () => {
        void openProfileDirect();
      }
    });
  }, [closeListingsPanel, openProfileDirect]);
  const restoreWorkspaceFromSharedPanel = useCallback(() => {
    workspaceRestoredOpenRef.current = true;
    setWorkspaceSuppressOpenTransition(true);
    setWorkspaceSurfaceReady(true);
    setWorkspaceOpen(true);
    setShowSourcesPanel(false);
    setInputFocused(false);
    try {
      inputRef.current?.blur?.();
    } catch {}
  }, [setShowSourcesPanel]);
  const backToWorkspaceFromListingsPanel = useCallback(() => {
    closeListingsPanel({
      afterClose: () => {
        restoreWorkspaceFromSharedPanel();
      }
    });
  }, [closeListingsPanel, restoreWorkspaceFromSharedPanel]);
  const openSelectedListing = useCallback(async (item) => {
    const kind = String(item?.kind || "").trim().toLowerCase();
    const id = String(item?.id || "").trim();
    if (!kind || !id) return;
    setSelectedListingState((prev) => ({
      ...prev,
      loading: true,
      error: "",
      edit: null,
      busyAction: "",
      selectedConnectListingId: "",
      connectOptions: []
    }));
    try {
      const response = await fetch(`/api/help/listings/${encodeURIComponent(kind)}/${encodeURIComponent(id)}?locale=${encodeURIComponent(locale)}`, {
        cache: "no-store"
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false || !payload?.listing) {
        throw new Error(helpUi.detailLoadFailed);
      }

      let connectOptions = [];
      if (!payload.isOwn) {
        const oppositeKind = kind === "request" ? "offer" : "request";
        const optionsResponse = await fetch(`/api/help/listings?kind=${encodeURIComponent(oppositeKind)}&scope=mine&status=OPEN&locale=${encodeURIComponent(locale)}&limit=20`, {
          cache: "no-store"
        });
        const optionsPayload = await optionsResponse.json().catch(() => ({}));
        if (optionsResponse.ok && optionsPayload?.ok !== false) {
          connectOptions = Array.isArray(optionsPayload?.items) ? optionsPayload.items : [];
        }
      }
      const initialConnectListingId = connectOptions[0]?.id
        ? String(connectOptions[0].id).trim()
        : "";

      setSelectedListingState({
        loading: false,
        error: "",
        listing: payload.listing,
        isOwn: Boolean(payload.isOwn),
        canDelete: Boolean(payload.canDelete),
        connectOptions,
        selectedConnectListingId: initialConnectListingId,
        edit: null,
        busyAction: "",
        deleteConfirmOpen: false
      });
    } catch (error) {
      setSelectedListingState({
        ...createEmptySelectedListingState(),
        loading: false,
        error: error?.message || helpUi.detailLoadFailed
      });
    }
  }, [helpUi.detailLoadFailed, locale]);
  const dismissSelectedListing = useCallback(() => {
    setSelectedListingState(createEmptySelectedListingState());
  }, []);
  const startListingEdit = useCallback(() => {
    setSelectedListingState((prev) => {
      if (!prev.listing) return prev;
      return {
        ...prev,
        edit: {
          title: prev.listing.editableTitle || prev.listing.title || "",
          description: prev.listing.editableDescription || prev.listing.description || "",
          primaryCategoryCode: prev.listing.primaryCategoryCode || "",
          roleLabel: prev.listing.roleLabel || "",
          rawPlace: prev.listing.editableRawPlace || prev.listing.rawPlace || "",
          helpType: prev.listing.helpType || "",
          timeType: prev.listing.timeType || "",
          availabilityOrStart: prev.listing.editableAvailabilityOrStart || prev.listing.availabilityOrStart || "",
          compensationDetails: prev.listing.editableCompensationDetails || prev.listing.compensationDetails || "",
          conditions: prev.listing.editableConditions || prev.listing.conditions || "",
          targetGroupCodes: Array.isArray(prev.listing.targetGroupCodes) ? prev.listing.targetGroupCodes : [],
          targetGroups: Array.isArray(prev.listing.targetGroupLabels) ? prev.listing.targetGroupLabels.join(", ") : ""
        }
      };
    });
  }, []);
  const changeListingEditField = useCallback((field, value) => {
    setSelectedListingState((prev) => prev.edit ? {
      ...prev,
      edit: {
        ...prev.edit,
        [field]: value
      }
    } : prev);
  }, []);
  const saveListingEdit = useCallback(async (editPayload) => {
    const listing = selectedListingState.listing;
    if (!listing) return;
    setSelectedListingState((prev) => ({
      ...prev,
      busyAction: "save",
      error: ""
    }));
    try {
      const response = await fetch(`/api/help/listings/${encodeURIComponent(listing.kind)}/${encodeURIComponent(listing.id)}?locale=${encodeURIComponent(locale)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: editPayload?.title,
          description: editPayload?.description,
          primaryCategoryCode: editPayload?.primaryCategoryCode,
          roleLabel: editPayload?.roleLabel,
          rawPlace: editPayload?.rawPlace,
          helpType: editPayload?.helpType,
          timeType: editPayload?.timeType,
          availabilityOrStart: editPayload?.availabilityOrStart,
          compensationDetails: editPayload?.compensationDetails,
          conditions: editPayload?.conditions,
          targetGroupCodes: Array.isArray(editPayload?.targetGroupCodes) ? editPayload.targetGroupCodes : undefined,
          targetGroups: Array.isArray(editPayload?.targetGroups) ? editPayload.targetGroups : []
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false || !payload?.listing) {
        throw new Error(helpUi.updateFailed);
      }
      patchListingCollections(listing.kind, payload.listing);
      setSelectedListingState((prev) => ({
        ...prev,
        listing: payload.listing,
        edit: null,
        busyAction: "",
        error: ""
      }));
    } catch (error) {
      setSelectedListingState((prev) => ({
        ...prev,
        busyAction: "",
        error: error?.message || helpUi.updateFailed
      }));
    }
  }, [helpUi.updateFailed, locale, patchListingCollections, selectedListingState.listing]);
  const requestDeleteOwnedListing = useCallback(() => {
    setSelectedListingState((prev) => prev.listing ? {
      ...prev,
      deleteConfirmOpen: true,
      error: ""
    } : prev);
  }, []);
  const cancelDeleteOwnedListing = useCallback(() => {
    setSelectedListingState((prev) => ({
      ...prev,
      deleteConfirmOpen: false
    }));
  }, []);
  const deleteOwnedListing = useCallback(async () => {
    const listing = selectedListingState.listing;
    if (!listing) return;
    setSelectedListingState((prev) => ({
      ...prev,
      deleteConfirmOpen: false,
      busyAction: "delete",
      error: ""
    }));
    try {
      const response = await fetch(`/api/help/listings/${encodeURIComponent(listing.kind)}/${encodeURIComponent(listing.id)}`, {
        method: "DELETE"
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) {
        throw new Error(helpUi.deleteFailed);
      }
      patchListingCollections(listing.kind, listing, "delete");
      dismissSelectedListing();
    } catch (error) {
      setSelectedListingState((prev) => ({
        ...prev,
        busyAction: "",
        error: error?.message || helpUi.deleteFailed
      }));
    }
  }, [dismissSelectedListing, helpUi.deleteFailed, patchListingCollections, selectedListingState.listing]);
  const connectSelectedListing = useCallback(async () => {
    const listing = selectedListingState.listing;
    const selectedConnectListingId = String(selectedListingState.selectedConnectListingId || "").trim();
    if (!listing || !selectedConnectListingId) return;
    setSelectedListingState((prev) => ({
      ...prev,
      busyAction: "connect",
      error: ""
    }));
    try {
      const payload = listing.kind === "request"
        ? { requestId: listing.id, offerId: selectedConnectListingId }
        : { requestId: selectedConnectListingId, offerId: listing.id };
      const response = await fetch("/api/help/matches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.ok === false || !body?.match) {
        throw new Error(helpUi.connectFailed);
      }
      const roomTarget = body?.match?.roomId ? buildRoomChatPath(body.match.roomId, locale) : null;
      setSelectedListingState((prev) => ({
        ...prev,
        busyAction: "",
        error: roomTarget ? "" : helpUi.connectPending
      }));
      if (roomTarget) {
        if (activeListingsPanel) {
          closeListingsPanel({
            skipAnimation: true,
            afterClose: () => {
              pushWithTransition(router, roomTarget);
            }
          });
          return;
        }
        dismissSelectedListing();
        requestAnimationFrame(() => {
          pushWithTransition(router, roomTarget);
        });
      }
    } catch (error) {
      setSelectedListingState((prev) => ({
        ...prev,
        busyAction: "",
        error: error?.message || helpUi.connectFailed
      }));
    }
  }, [activeListingsPanel, closeListingsPanel, dismissSelectedListing, helpUi.connectFailed, helpUi.connectPending, locale, router, selectedListingState.listing, selectedListingState.selectedConnectListingId]);
  const openGlobalRequestsPanel = useCallback((source = "chat") => {
    const returnTarget = getHelpListingsReturnTarget(source);
    openListingsPanel({
      key: "help_requests",
      side: "left",
      kind: "request",
      scope: "global",
      status: "OPEN",
      returnToProfile: returnTarget === "profile",
      returnToWorkspace: returnTarget === "workspace",
      title: helpUi.helpRequests,
      emptyText: helpUi.emptyGlobalRequests
    });
  }, [helpUi.emptyGlobalRequests, helpUi.helpRequests, openListingsPanel]);
  const openGlobalOffersPanel = useCallback((source = "chat") => {
    const returnTarget = getHelpListingsReturnTarget(source);
    openListingsPanel({
      key: "help_offers",
      side: "left",
      kind: "offer",
      scope: "global",
      status: "OPEN",
      returnToProfile: returnTarget === "profile",
      returnToWorkspace: returnTarget === "workspace",
      title: helpUi.helpOffers,
      emptyText: helpUi.emptyGlobalOffers
    });
  }, [helpUi.emptyGlobalOffers, helpUi.helpOffers, openListingsPanel]);
  const openMyRequestsPanel = useCallback((source = "chat") => {
    const returnTarget = getHelpListingsReturnTarget(source);
    openListingsPanel({
      key: "help_requests",
      side: "left",
      kind: "request",
      scope: "global",
      status: "OPEN",
      returnToProfile: returnTarget === "profile",
      returnToWorkspace: returnTarget === "workspace",
      title: helpUi.helpRequests,
      emptyText: helpUi.emptyGlobalRequests
    });
  }, [helpUi.emptyGlobalRequests, helpUi.helpRequests, openListingsPanel]);
  const openMyOffersPanel = useCallback((source = "chat") => {
    const returnTarget = getHelpListingsReturnTarget(source);
    openListingsPanel({
      key: "help_offers",
      side: "left",
      kind: "offer",
      scope: "global",
      status: "OPEN",
      returnToProfile: returnTarget === "profile",
      returnToWorkspace: returnTarget === "workspace",
      title: helpUi.helpOffers,
      emptyText: helpUi.emptyGlobalOffers
    });
  }, [helpUi.emptyGlobalOffers, helpUi.helpOffers, openListingsPanel]);
  const openHelpPanelByKey = useCallback((panelKey, source = "chat") => {
    if (panelKey === "my_help_requests") {
      openMyRequestsPanel(source);
      return;
    }
    if (panelKey === "my_help_offers") {
      openMyOffersPanel(source);
      return;
    }
    if (panelKey === "help_requests") {
      openGlobalRequestsPanel(source);
      return;
    }
    if (panelKey === "help_offers") {
      openGlobalOffersPanel(source);
    }
  }, [openGlobalOffersPanel, openGlobalRequestsPanel, openMyOffersPanel, openMyRequestsPanel]);
  useEffect(() => {
    const onOpenHelpListings = event => {
      const panelKey = String(event?.detail?.panelKey || "");
      const source = String(event?.detail?.source || "chat");
      openHelpPanelByKey(panelKey, source);
    };
    window.addEventListener("sotsiaalai:open-help-listings", onOpenHelpListings);
    return () => {
      window.removeEventListener("sotsiaalai:open-help-listings", onOpenHelpListings);
    };
  }, [openHelpPanelByKey]);
  /* Süvalink ruumi Töölaua kaartidelt (tellija 10.07):
     /vestlus?workspace=help_requests|help_offers avab kuulutuste paneeli
     (need pole embedded-feature'd, vaid kuulutuste kihid töölaua kohal). */
  const helpDeepLinkDoneRef = useRef(false);
  useEffect(() => {
    if (helpDeepLinkDoneRef.current) return;
    if (typeof searchParams?.get !== "function") return;
    const wp = String(searchParams.get("workspace") || "").trim();
    if (wp !== "help_requests" && wp !== "help_offers") return;
    helpDeepLinkDoneRef.current = true;
    openHelpPanelByKey(wp, "workspace");
  }, [searchParams, openHelpPanelByKey]);
  useEffect(() => {
    const onRestoreWorkspace = () => {
      restoreWorkspaceFromSharedPanel();
    };
    window.addEventListener("sotsiaalai:restore-workspace-from-modal", onRestoreWorkspace);
    return () => {
      window.removeEventListener("sotsiaalai:restore-workspace-from-modal", onRestoreWorkspace);
    };
  }, [restoreWorkspaceFromSharedPanel]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    let panelKey = "";
    let source = "chat";
    try {
      panelKey = String(window.sessionStorage.getItem(CHAT_HELP_PANEL_STORAGE_KEY) || "");
      source = String(window.sessionStorage.getItem(CHAT_HELP_PANEL_SOURCE_STORAGE_KEY) || "chat");
      if (panelKey) {
        window.sessionStorage.removeItem(CHAT_HELP_PANEL_STORAGE_KEY);
        window.sessionStorage.removeItem(CHAT_HELP_PANEL_SOURCE_STORAGE_KEY);
      }
    } catch {
      panelKey = "";
      source = "chat";
    }
    if (!panelKey) return;
    openHelpPanelByKey(panelKey, source);
  }, [openHelpPanelByKey]);
  useEffect(() => {
    if (!activeListingsPanel) return;
    void loadListingsPanel(activeListingsPanel);
  }, [activeListingsPanel, loadListingsPanel]);
  useEffect(() => {
    const onRefreshHelpListings = () => {
      if (!activeListingsPanel) return;
      void loadListingsPanel(activeListingsPanel);
    };
    window.addEventListener("sotsiaalai:refresh-help-listings", onRefreshHelpListings);
    return () => {
      window.removeEventListener("sotsiaalai:refresh-help-listings", onRefreshHelpListings);
    };
  }, [activeListingsPanel, loadListingsPanel]);
  const requestConversationsRefresh = useCallback(() => {
    try {
      window.dispatchEvent(new CustomEvent("sotsiaalai:refresh-conversations"));
    } catch {}
  }, []);
  const helpFlowActive = useMemo(
    () => isActiveHelpWorkflowState(effectiveHelpWorkflowState),
    [effectiveHelpWorkflowState]
  );
  const handleAssistantMessageCreated = useCallback((messageId) => {
    onAssistantMessageCreated?.(messageId);
    if (!(activeWorkflow === "help_request" || activeWorkflow === "help_offer" || helpFlowActive)) return;
    if (messageId == null) return;

    const scrollToMessageStart = () => {
      const node = chatWindowRef.current;
      if (!(node instanceof HTMLElement)) return;
      const messageNode = node.querySelector(`[data-chat-message-id="${messageId}"]`);
      if (!(messageNode instanceof HTMLElement)) return;
      const nodeRect = node.getBoundingClientRect();
      const messageRect = messageNode.getBoundingClientRect();
      const offsetTop = messageRect.top - nodeRect.top;
      node.scrollTo({
        top: Math.max(0, node.scrollTop + offsetTop - 8),
        behavior: "auto"
      });
    };

    requestAnimationFrame(scrollToMessageStart);
    window.setTimeout(scrollToMessageStart, 80);
    window.setTimeout(scrollToMessageStart, 220);
  }, [activeWorkflow, helpFlowActive, onAssistantMessageCreated]);
  const {
    isGenerating: isChatGenerating,
    sendMessage,
    stop: stopChatStream,
    detach: detachChatStream,
    retryLast
  } = useChatStream({
    convId,
    historyPayload,
    userRole,
    locale,
    activeWorkflow,
    // A workspace surface (including "Minu dokumendid") is not the chat consumer. Resuming
    // there would create a hidden stream/placeholder before the user explicitly returns to chat.
    researchResumeEnabled: !workspaceOpen,
    helpWorkflowState: effectiveHelpWorkflowState,
    getLatestHelpWorkflowState: getEffectiveLatestHelpWorkflowState,
    docOnlyMode: analysis.docOnlyMode,
    ephemeralChunks: analysis.ephemeralChunks,
    ephemeralSource: analysis.ephemeralSource,
    uploadPreview: analysis.uploadPreview,
    isRoomMode,
    roomId: effectiveRoomId,
    roomBlocked,
    roomAuthRequired,
    sendToAssistant: allowAssistantForward ? sendToAssistant : false,
    onRoomMessageSent,
    onAssistantMessageCreated: handleAssistantMessageCreated,
    t,
    setErrorBanner,
    setIsCrisis,
    requestConversationsRefresh,
    onDeepResearchComplete: () => {
      setActiveWorkflow("default");
    },
    appendMessage,
    mutateMessage,
    onFocusInput: focusInput,
    onAuthRedirect: () => setLoginOpen(true)
  });
  const isGenerating = isChatGenerating || isJourneyGenerating;
  const stop = useCallback(() => {
    stopChatStream();
  }, [stopChatStream]);
  // Leaving the page or switching conversations must NOT cancel a running deep-research job:
  // detach the local stream and let the durable job finish and persist to its conversation.
  const detach = useCallback(() => {
    detachChatStream();
  }, [detachChatStream]);
  const startFreshConversation = useCallback((nextWorkflow = "default", options = {}) => {
    const {
      convId: requestedConvId = null,
      closeAnalysis = true,
      preserveConversationSearch = false
    } = options;
    const nextConvId = String(requestedConvId || "").trim() || createConversationId();

    if (!preserveConversationSearch && typeof window !== "undefined") {
      try {
        const url = new URL(window.location.href);
        const searchConversation = String(url.searchParams.get("conversation") || "").trim();
        if (searchConversation) {
          // URL-i conversation on ühekordne süvalingi sisend. Kohalik valik peab
          // selle tarbima, muidu kirjutab vana query uue vestluse kohe üle.
          searchConversationHandledRef.current = searchConversation;
          url.searchParams.delete("conversation");
          window.history.replaceState(
            window.history.state,
            "",
            `${url.pathname}${url.search}${url.hash}`
          );
        }
      } catch {}
    }

    detach();
    setErrorBanner(null);
    setIsCrisis(false);
    setShowSourcesPanel(false);
    setActiveListingsPanel(null);
    setListingsPanelClosing(false);
    setListingsPanelState(createEmptyListingsPanelState());
    setSelectedListingState(createEmptySelectedListingState());
    setJourneyWorkflowDraft(null);
    if (closeAnalysis) {
      analysis.closeAnalysisPanel?.();
    }
    setMessages([]);
    renderLimitInitializedConvRef.current = null;
    setRenderLimit(MAX_RENDERED_MESSAGES);
    setConvId(nextConvId);
    setActiveWorkflow(normalizeActiveWorkflow(nextWorkflow));

    if (typeof window !== "undefined") {
      // SOL-CHAT-11: aktiivse vestluse valik on konto ja rolli oma, mitte brauseri oma.
      try {
        writeActiveConversationId(window.sessionStorage, {
          userId: sessionUserId,
          role: userRole
        }, nextConvId);
      } catch {}
    }

    return nextConvId;
  }, [analysis, setConvId, setIsCrisis, setMessages, detach, sessionUserId, userRole]);
  useEffect(() => {
    if (isRoomMode) return;
    const workflow = readWorkflowFromSearchParams(searchParams);
    if (workflow !== "help_request" && workflow !== "help_offer") return;
    const key = `${workflow}:${typeof searchParams?.toString === "function" ? searchParams.toString() : ""}`;
    if (searchWorkflowHandledRef.current === key) return;
    searchWorkflowHandledRef.current = key;
    if (activeWorkflow === workflow && visibleMessages.length === 0) return;
    startFreshConversation(workflow, {
      closeAnalysis: false
    });
  }, [activeWorkflow, isRoomMode, searchParams, startFreshConversation, visibleMessages.length]);
  useEffect(() => {
    if (isRoomMode || typeof searchParams?.get !== "function") return;
    const requestedConversation = String(searchParams.get("conversation") || "").trim();
    if (!requestedConversation) {
      searchConversationHandledRef.current = "";
      return;
    }
    if (searchConversationHandledRef.current === requestedConversation) return;
    searchConversationHandledRef.current = requestedConversation;
    if (requestedConversation === convId) return;
    startFreshConversation("default", {
      convId: requestedConversation,
      closeAnalysis: false,
      preserveConversationSearch: true
    });
  }, [convId, isRoomMode, searchParams, startFreshConversation]);
  const activateInfoMode = useCallback((options = null) => {
    const preserveConversation = Boolean(options?.preserveConversation);
    const stopActiveRun = Boolean(options?.stopActiveRun);
    if (stopActiveRun) {
      stop();
    }
    if (preserveConversation) {
      setActiveWorkflow("default");
      setJourneyWorkflowDraft(null);
      return true;
    }
    startFreshConversation("default");
    return true;
  }, [startFreshConversation, stop]);
  const activateDeepResearchMode = useCallback(() => {
    if (isRoomMode) {
      setErrorBanner(t("chat.tools.deep_research_room_only"));
      return false;
    }
    if (activeWorkflow === "deep_research") {
      return true;
    }
    setErrorBanner(null);
    setIsCrisis(false);
    setActiveWorkflow("deep_research");
    appendMessage({
      role: "ai",
      text: getEmptyIntroMessage(t, "deep_research"),
      aiVisible: true
    });
    return true;
  }, [activeWorkflow, appendMessage, isRoomMode, setIsCrisis, t]);
  const activateHelpRequestMode = useCallback(() => {
    startFreshConversation("help_request");
    return true;
  }, [startFreshConversation]);
  const activateHelpOfferMode = useCallback(() => {
    startFreshConversation("help_offer");
    return true;
  }, [startFreshConversation]);
  const createJourneyDraftFromText = useCallback(async (text) => {
    const response = await fetch("/api/journeys/draft", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        situation: text
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.message || "journeys.errors.draft_failed");
    }
    return payload.draft || null;
  }, []);
  const saveJourneyWorkflowDraft = useCallback(async (draft) => {
    if (!convId) throw new Error("journeys.errors.conversation_not_found");
    const conversationResponse = await fetch("/api/chat/conversations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ id: convId, role: userRole })
    });
    const conversationPayload = await conversationResponse.json().catch(() => ({}));
    if (
      !conversationResponse.ok ||
      conversationPayload?.ok === false ||
      conversationPayload?.conversation?.id !== convId
    ) {
      throw new Error(conversationPayload?.message || "journeys.errors.conversation_not_found");
    }
    const response = await fetch("/api/journeys", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ...(draft || {}),
        conversationId: convId
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.message || "journeys.errors.save_failed");
    }
    return payload.journey || null;
  }, [convId, userRole]);
  const handleJourneyWorkflowMessage = useCallback(async (text) => {
    appendMessage({
      role: "user",
      text,
      aiVisible: true
    });

    if (isJourneyCancelCommand(text)) {
      if (typeof window !== "undefined") {
        clearChatJourneyDraft(window.sessionStorage, sessionUserId, convId);
      }
      setJourneyWorkflowDraft(null);
      setActiveWorkflow("default");
      appendMessage({
        role: "ai",
        text: readTranslated(t, "journey.workflow.cancelled", "Journey draft was cancelled. Nothing was saved."),
        aiVisible: true
      });
      return true;
    }

    if (journeyWorkflowDraft && isJourneySaveCommand(text)) {
      setIsJourneyGenerating(true);
      try {
        const saved = await saveJourneyWorkflowDraft(journeyWorkflowDraft.draft);
        const href = saved?.id ? localizePath(`/teekond/${saved.id}`, locale) : localizePath("/teekond", locale);
        if (typeof window !== "undefined") {
          clearChatJourneyDraft(window.sessionStorage, sessionUserId, convId);
        }
        setJourneyWorkflowDraft(null);
        setActiveWorkflow("default");
        appendMessage({
          role: "ai",
          text: readTranslated(t, "journey.workflow.savedSuccess", "Private journey was saved."),
          aiVisible: true,
          attachments: [{
            label: readTranslated(t, "journey.workflow.openSaved", "Open journey"),
            url: href
          }]
        });
        requestConversationsRefresh();
        return true;
      } catch {
        appendMessage({
          role: "ai",
          text: readTranslated(t, "journey.messages.save_failed", "Saving the journey failed."),
          aiVisible: true
        });
        return false;
      } finally {
        setIsJourneyGenerating(false);
      }
    }

    if (journeyWorkflowDraft && isJourneyRefineCommand(text)) {
      appendMessage({
        role: "ai",
        text: readTranslated(t, "journey.workflow.refinePrompt", "Add the detail you want to clarify. I will update the draft."),
        aiVisible: true
      });
      return true;
    }

    const baseText = journeyWorkflowDraft?.sourceText
      ? `${journeyWorkflowDraft.sourceText}\n\n${text}`
      : text;

    setIsJourneyGenerating(true);
    const streamingMessageId = appendMessage({
      role: "ai",
      text: "",
      isStreaming: true,
      aiVisible: true
    });

    try {
      const draft = await createJourneyDraftFromText(baseText);
      setJourneyWorkflowDraft({
        draft: {
          ...draft,
          clientActionId: globalThis.crypto?.randomUUID?.()
            || `journey-${Date.now()}-${Math.random().toString(36).slice(2)}`
        },
        sourceText: baseText
      });
      mutateMessage(streamingMessageId, (message) => ({
        ...message,
        text: formatJourneyDraftMessage(t, draft),
        workflow: { journeyDraft: { conversationId: convId } },
        isStreaming: false
      }));
      return true;
    } catch {
      mutateMessage(streamingMessageId, (message) => ({
        ...message,
        text: readTranslated(t, "journey.messages.draft_failed", "Creating the draft failed."),
        isStreaming: false
      }));
      return false;
    } finally {
      setIsJourneyGenerating(false);
    }
  }, [
    appendMessage,
    convId,
    createJourneyDraftFromText,
    journeyWorkflowDraft,
    locale,
    mutateMessage,
    requestConversationsRefresh,
    saveJourneyWorkflowDraft,
    sessionUserId,
    t
  ]);
  const handleSendMessage = useCallback(async (rawText, options = {}) => {
    const text = String(rawText || "").trim();
    if (!text) return false;
    if (!isRoomMode && activeWorkflow === "journey") {
      return handleJourneyWorkflowMessage(text);
    }
    return sendMessage(text, options);
  }, [activeWorkflow, handleJourneyWorkflowMessage, isRoomMode, sendMessage]);
  const handleVoiceTranscript = useCallback(async (rawText) => {
    const text = String(rawText || "").trim();
    if (!text) return { ok: false };
    try {
      const { response, payload } = await requestPrivacyCheck({
        text,
        workflow: "chat_private"
      });
      if (response.status === 409 && payload?.needsPrivacyConfirmation) {
        composerDraftApiRef.current?.appendText?.(text);
        return { ok: false, reason: "privacy" };
      }
      if (!response.ok || payload?.ok === false) return { ok: false };
      const safeText = String(payload?.text || text).trim();
      const ok = await handleSendMessage(safeText, {
        inputModality: "voice",
        privacyDecision: payload?.appliedDecision
          ? { action: payload.appliedDecision }
          : undefined
      });
      return { ok: Boolean(ok) };
    } catch {
      return { ok: false };
    }
  }, [handleSendMessage]);
  const realtimeVoice = useRealtimeVoice({
    enabled: voiceEnabled,
    locale,
    latestAiText,
    isGenerating,
    isSpeaking,
    speakText,
    stopSpeaking,
    onTranscript: handleVoiceTranscript,
    onStopResponse: stop,
    t
  });
  const endRealtimeVoiceSession = realtimeVoice.endSession;
  const openVoiceMode = useCallback(() => {
    if (isRoomMode || activeWorkflow !== "default" || isGenerating) return false;
    setErrorBanner(null);
    setVoiceModeOpen(true);
    return true;
  }, [activeWorkflow, isGenerating, isRoomMode]);
  const closeVoiceMode = useCallback(() => {
    endRealtimeVoiceSession("ended");
    setVoiceModeOpen(false);
  }, [endRealtimeVoiceSession]);
  useEffect(() => {
    if (!voiceModeOpen) return;
    if (!workspaceOpen && !isRoomMode && activeWorkflow === "default") return;
    endRealtimeVoiceSession("ended");
    setVoiceModeOpen(false);
  }, [activeWorkflow, endRealtimeVoiceSession, isRoomMode, voiceModeOpen, workspaceOpen]);
  const handleDraftStateChange = useCallback(({ ready: _ready, hasDraft }) => {
    setComposerHasDraft(Boolean(hasDraft));
  }, []);
  const handleEmptyIntroTyped = useCallback(() => {
    if (!emptyIntroSeenStorageKey) return;
    setEmptyIntroSeenOverride(true);
    try {
      window.sessionStorage.setItem(emptyIntroSeenStorageKey, "1");
    } catch {}
  }, [emptyIntroSeenStorageKey]);
  // Aus Retry (T03 E2): kordab sama viimast kasutajasõnumit ühe uue teadliku pöördena.
  // retryLast leiab ise viimase ERROR/ABORTED pöörde ega dubleeri kasutaja sõnumit; kui
  // pööre juba käib, ei tee midagi (topeltklikk/hiline SSE turvatud).
  const handleRetry = useCallback(() => {
    if (typeof retryLast !== "function") return;
    retryLast(renderedMessages);
  }, [retryLast, renderedMessages]);
  const messageItems = useMemo(() => {
    return renderedMessages.map((msg, msgIndex, allMessages) => {
      const messageSources = msg.role === "ai"
        ? collectMessageSources(msg, analysis.uploadPreview)
        : [];
      return <ChatMessageItem key={msg.id} messageId={msg.id} entranceIndex={allMessages.length - 1 - msgIndex} role={msg.role} text={msg.text} attachments={msg.attachments} cards={msg.cards} createdAt={msg.createdAt} aiVisible={!!msg.aiVisible} typingEffect={!!msg.typingEffect} onTypingComplete={msg.onTypingComplete === "emptyIntro" ? handleEmptyIntroTyped : undefined} authorName={msg.authorName} authorRole={msg.authorRole} isRoomMode={isRoomMode} t={t} locale={locale} isLightTheme={isLightTheme} voiceEnabled={voiceEnabled} canSpeak={Boolean(voiceEnabled && speechReady && String(msg.text || "").trim())} isSpeaking={isSpeaking} onSpeak={speakText} messageSources={messageSources} onShowSources={openMessageSources} isStreaming={!!msg.isStreaming} completionStatus={msg.completionStatus} onRetry={msg.role === "ai" && !isRoomMode ? handleRetry : undefined} retryPending={isChatGenerating} />;
    });
  }, [analysis.uploadPreview, handleEmptyIntroTyped, handleRetry, isChatGenerating, isLightTheme, isRoomMode, isSpeaking, locale, openMessageSources, renderedMessages, speakText, speechReady, t, voiceEnabled]);
  const activeModeLabel = useMemo(() => {
    return getWorkflowModeLabel(t, activeWorkflow);
  }, [activeWorkflow, t]);
  const composerPlaceholderText = t("chat.input.placeholder");
  const composerForcePlaceholderVisible = false;
  const roomModeLabel = useMemo(() => {
    // Ruumi NIMI kuvatakse nüüd ÜLEVAL (ChatTopNotices), MITTE composeri all
    // (omanik 23.07). Composeri silt jääb ainult help-match režiimi-
    // indikaatoriks (Abisoov/Abipakkumine), kus ruumil pole eraldi nime.
    if (!isRoomMode || !isHelpMatchRoom) return "";
    if (roomRole === "OWNER") {
      const value = t("chat.tools.help_request_mode");
      return value && value !== "chat.tools.help_request_mode"
        ? value
        : "Abisoov";
    }
    if (roomRole === "MEMBER") {
      const value = t("chat.tools.help_offer_mode");
      return value && value !== "chat.tools.help_offer_mode"
        ? value
        : "Abipakkumine";
    }
    return "";
  }, [isHelpMatchRoom, isRoomMode, roomRole, t]);
  const hideRoomTitle = Boolean(roomModeLabel);
  const documentFlowActive = useMemo(() => {
    for (let i = visibleMessages.length - 1; i >= 0; i -= 1) {
      const message = visibleMessages[i];
      if (message?.role !== "ai") continue;
      if (!message?.workflow || typeof message.workflow !== "object") continue;
      if (!Object.prototype.hasOwnProperty.call(message.workflow, "document")) continue;
      return isActiveDocumentWorkflowState(message.workflow.document);
    }
    return false;
  }, [visibleMessages]);
  const hasSelectedListing = Boolean(selectedListingState.listing || selectedListingState.loading || selectedListingState.error);
  const selectedListingContextProps = hasSelectedListing ? {
    locale,
    loading: selectedListingState.loading,
    error: selectedListingState.error,
    listing: selectedListingState.listing,
    isOwn: selectedListingState.isOwn,
    canDelete: selectedListingState.canDelete,
    editState: selectedListingState.edit,
    connectOptions: selectedListingState.connectOptions,
    selectedConnectListingId: selectedListingState.selectedConnectListingId,
    busyAction: selectedListingState.busyAction,
    onDismiss: dismissSelectedListing,
    onStartEdit: startListingEdit,
    onChangeEditField: changeListingEditField,
    onCancelEdit: () => setSelectedListingState((prev) => ({ ...prev, edit: null, busyAction: "" })),
    onSaveEdit: saveListingEdit,
    onDeleteListing: requestDeleteOwnedListing,
    onSelectConnectListing: (value) => setSelectedListingState((prev) => ({ ...prev, selectedConnectListingId: value })),
    onConnect: connectSelectedListing
  } : null;
  const inlineSelectedListingNode = activeListingsPanel && selectedListingContextProps ? (
    <SelectedListingContext
      {...selectedListingContextProps}
      inline
    />
  ) : null;
  const listingsPanelNode = activeListingsPanel ? (
    <HelpListingsPanel
      locale={locale}
      title={activeListingsPanel.title}
      infoId={activeListingsPanel.key}
      side={activeListingsPanel.side}
      items={listingsPanelState.items}
      loading={listingsPanelState.loading}
      error={listingsPanelState.error}
      nextOffset={listingsPanelState.nextOffset}
      emptyText={activeListingsPanel.emptyText}
      embedded={activeListingsPanel?.returnToWorkspace}
      hideHeader={activeListingsPanel?.returnToWorkspace}
      isClosing={listingsPanelClosing}
      onClose={closeListingsPanel}
      onBackToProfile={activeListingsPanel?.returnToProfile ? backToProfileFromListingsPanel : undefined}
      onBackToWorkspace={activeListingsPanel?.returnToWorkspace ? backToWorkspaceFromListingsPanel : undefined}
      onLoadMore={() => loadListingsPanel(activeListingsPanel, { append: true })}
      onSelectItem={openSelectedListing}
      detailNode={inlineSelectedListingNode}
    />
  ) : null;
  const workspaceListingsPanelNode = activeListingsPanel?.returnToWorkspace ? listingsPanelNode : null;
  const workspaceListingsPanelMeta = activeListingsPanel?.returnToWorkspace ? {
    title: activeListingsPanel.title,
    infoId: activeListingsPanel.key
  } : null;
  const modalListingsPanelNode = activeListingsPanel?.returnToWorkspace ? null : listingsPanelNode;
  const selectedListingContextNode = !activeListingsPanel && selectedListingContextProps ? (
    <SelectedListingContext
      {...selectedListingContextProps}
    />
  ) : null;
  const deleteListingConfirmNode = selectedListingState.deleteConfirmOpen ? (
    <ModalConfirm
      message={helpUi.deleteConfirm}
      confirmLabel={t("buttons.delete")}
      cancelLabel={t("buttons.cancel")}
      confirmVariant="danger"
      cancelVariant="primary"
      onConfirm={deleteOwnedListing}
      onCancel={cancelDeleteOwnedListing}
      disabled={selectedListingState.busyAction === "delete"}
      overlayClassName="!z-[146] !bg-transparent !backdrop-blur-0 !backdrop-saturate-100"
      contentClassName="chat-analysis-upload-modal-card !w-[min(100%,20.5rem)] !max-w-[20.5rem]"
    />
  ) : null;
  const isStreamingAny = useMemo(() => isGenerating || visibleMessages.some(m => m.role === "ai" && m.isStreaming), [isGenerating, visibleMessages]);
  useEffect(() => {
    setIsGeneratingForSave(isGenerating);
  }, [isGenerating]);
  useEffect(() => {
    isGeneratingRef.current = isGenerating;
  }, [isGenerating]);
  useEffect(() => {
    function onSwitch(e) {
      const newId = e?.detail?.convId;
      if (!newId) return;
      startFreshConversation(e?.detail?.workflow, {
        convId: newId,
        closeAnalysis: false
      });
      try {
        window.dispatchEvent(new CustomEvent("sotsiaalai:toggle-conversations"));
      } catch {}
    }
    window.addEventListener("sotsiaalai:switch-conversation", onSwitch);
    return () => window.removeEventListener("sotsiaalai:switch-conversation", onSwitch);
  }, [startFreshConversation]);
  useEffect(() => {
    function onConversationsDeleted(e) {
      const deletedIds = Array.isArray(e?.detail?.ids)
        ? e.detail.ids.map(id => String(id || "").trim()).filter(Boolean)
        : [];
      if (!convId || !deletedIds.includes(convId)) return;
      startFreshConversation("default", {
        closeAnalysis: false
      });
    }
    window.addEventListener("sotsiaalai:conversations-deleted", onConversationsDeleted);
    return () => window.removeEventListener("sotsiaalai:conversations-deleted", onConversationsDeleted);
  }, [convId, startFreshConversation]);
  useEffect(() => {
    return () => {
      detach();
    };
  }, [detach]);
  useEffect(() => {
    if (!analysis.showAnalysisPanel || suppressCareerCvPreview || keepCareerUploadFocus) return;
    try {
      inputRef.current?.blur?.();
    } catch {}
    setInputFocused(false);
  }, [analysis.showAnalysisPanel, keepCareerUploadFocus, suppressCareerCvPreview]);
  useEffect(() => {
    if (!analysis.showAnalysisPanel || suppressCareerCvPreview) return;
    if (analysis.uploadPreview) return;
    if (typeof window === "undefined") return;
    const scroller = document.scrollingElement || document.documentElement;
    const y = scroller ? scroller.scrollTop : window.scrollY;
    const restore = () => {
      if (scroller) {
        scroller.scrollTop = y;
      } else {
        window.scrollTo({
          top: y,
          behavior: "auto"
        });
      }
    };
    requestAnimationFrame(restore);
    setTimeout(restore, 0);
    setTimeout(restore, 120);
    setTimeout(restore, 260);
  }, [analysis.showAnalysisPanel, analysis.uploadPreview, suppressCareerCvPreview]);
  useEffect(() => {
    if (!analysis.showAnalysisPanel || suppressCareerCvPreview) return;
    if (!analysis.uploadPreview) return;
    if (typeof window === "undefined") return;
    const ensureVisible = () => {
      const panel = analysis.analysisPanelRef?.current;
      if (!panel) return;
      const rect = panel.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight || 0;
      const margin = 24;
      const isAbove = rect.top < margin;
      const isBelow = rect.bottom > vh - margin;
      if (isAbove || isBelow) {
        panel.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }
    };
    requestAnimationFrame(ensureVisible);
    setTimeout(ensureVisible, 120);
  }, [analysis.showAnalysisPanel, analysis.uploadPreview, analysis.analysisPanelRef, suppressCareerCvPreview]);
  useSyncRoomAssistantMessages({
    isRoomMode,
    roomMessages,
    sessionUserId,
    setMessages,
    pendingRoomAiIdsRef,
    seenRoomAiIdsRef
  });
  useEffect(() => {
    if (!scopedSources && !hasConversationSources && showSourcesPanel) {
      closeSourcesPanel();
    }
  }, [hasConversationSources, scopedSources, showSourcesPanel, closeSourcesPanel]);
  const scrollToBottom = useCallback(() => {
    const node = chatWindowRef.current;
    if (!node) return;
    node.scrollTo({
      top: node.scrollHeight,
      behavior: "smooth"
    });
  }, []);
  const handleBackHome = useCallback(async () => {
      const now = Date.now();
      if (now - backTapGuardRef.current < 320) return;
      backTapGuardRef.current = now;
      setShowSourcesPanel(false);
      await waitForComposerCollapse();
      if (typeof window !== "undefined") {
        try {
          window.sessionStorage.setItem(HOME_RETURN_FROM_CHAT_KEY, String(now));
        } catch {}
      }
      if (typeof onBackHome === "function") {
        onBackHome();
        return;
      }
    const homePath = localizePath("/", locale);
    window.requestAnimationFrame(() => {
      pushWithTransition(router, homePath);
    });
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        if (stripLocaleFromPath(window.location.pathname).startsWith("/vestlus")) {
          window.location.assign(homePath);
        }
      }, isMobile ? 1800 : 960);
    }
  }, [isMobile, locale, onBackHome, router, setShowSourcesPanel, waitForComposerCollapse]);
  const handleComposerFocus = useCallback(() => {
    if (blurTimerRef.current && typeof window !== "undefined") {
      window.clearTimeout(blurTimerRef.current);
      blurTimerRef.current = 0;
    }
    setInputFocused(true);
    if (!isMobile) return;
    const keepConversationAtBottom = () => {
      const node = chatWindowRef.current;
      if (!node) return;
      node.scrollTop = node.scrollHeight;
    };
    requestAnimationFrame(keepConversationAtBottom);
    setTimeout(keepConversationAtBottom, 90);
    setTimeout(keepConversationAtBottom, 190);
  }, [isMobile]);
  useEffect(() => {
    return () => {
      if (blurTimerRef.current && typeof window !== "undefined") {
        window.clearTimeout(blurTimerRef.current);
        blurTimerRef.current = 0;
      }
    };
  }, []);
  const handleJumpToBottom = useCallback(() => {
    if (renderLimit > MAX_RENDERED_MESSAGES) {
      writeStoredRenderLimit(renderLimitStorageKey, MAX_RENDERED_MESSAGES);
      setRenderLimit(Math.min(visibleMessages.length, MAX_RENDERED_MESSAGES));
    }
    scrollToBottom();
  }, [renderLimit, renderLimitStorageKey, scrollToBottom, visibleMessages.length]);
  const hideOlder = useCallback(() => {
    const el = chatWindowRef.current;
    const prevScrollHeight = el ? el.scrollHeight : 0;
    const prevScrollTop = el ? el.scrollTop : 0;
    writeStoredRenderLimit(renderLimitStorageKey, MAX_RENDERED_MESSAGES);
    setRenderLimit(MAX_RENDERED_MESSAGES);
    requestAnimationFrame(() => {
      if (!el) return;
      const newScrollHeight = el.scrollHeight;
      const delta = newScrollHeight - prevScrollHeight;
      el.scrollTop = prevScrollTop + delta;
    });
  }, [renderLimitStorageKey]);
  useEffect(() => {
    if (prefs?.reduceMotion) {
      setIsEntering(false);
    }
  }, [prefs?.reduceMotion]);
  useEffect(() => {
    const node = chatContainerRef.current;
    if (!node) return;
    const update = () => {
      const rect = node.getBoundingClientRect();
      const next = Math.round(rect.width || 0);
      if (next > 0) setAnalysisPanelWidth(next);
    };
    update();
    window.addEventListener("resize", update);
    let ro;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(update);
      ro.observe(node);
    }
    return () => {
      window.removeEventListener("resize", update);
      ro?.disconnect?.();
    };
  }, []);
  const focusActive =
    (inputFocused || keepCareerUploadFocus) &&
    !profileOpen &&
    !viewportIsMobile;
  const handleChatWindowDoubleClick = useCallback(() => {
    setInputFocused(false);
    try {
      inputRef.current?.blur?.();
    } catch {}
  }, []);
  const chatVars = resolveChatLayoutVars({
    isMobile: viewportIsMobile,
    focusActive,
    workspaceOpen
  });
  const chatAnalysisPanelProps = {
    t,
    analysisPanelRef: analysis.analysisPanelRef,
    analysisPanelMode: analysis.analysisPanelMode,
    uploadPreview: analysis.uploadPreview,
    uploadedFilesCount: analysis.uploadedFilesCount,
    uploadedFileNames: analysis.uploadedFileNames,
    uploadFileLimit: analysis.uploadFileLimit,
    uploadBusy: analysis.uploadBusy,
    uploadError: analysis.uploadError,
    uploadUsage: analysis.uploadUsage,
    previewText: analysis.previewText,
    analysisCollapsed: analysis.analysisCollapsed,
    toggleAnalysisCollapse: analysis.toggleAnalysisCollapse,
    docOnlyMode: analysis.docOnlyMode,
    setDocOnlyMode: analysis.setDocOnlyMode,
    extendedLabel,
    contextHint,
    inputRef,
    chatWindowRef,
    isMobileViewport: viewportIsMobile,
    onPickFile: analysis.onPickFile,
    setUploadPreview: analysis.setUploadPreview,
    setUploadError: analysis.setUploadError,
    setEphemeralChunks: analysis.setEphemeralChunks,
    closeAnalysisPanel: analysis.closeAnalysisPanel,
    isGenerating,
    prettifyFileName
  };
  const workspacePanelVisible =
    workspaceOpen && (workspaceSurfaceReady || workspaceSuppressOpenTransition);
  const chatRingStyle = { ...chatVars };
  const chatContainerClassName = "chat-container";
  return <>
    <ChatBodyView
      embedded={embedded}
      t={t}
      locale={locale}
      profileOpen={profileOpen}
      closeProfile={closeProfile}
      workspaceOpen={workspaceOpen}
      workspaceSurfaceReady={workspacePanelVisible}
      onWorkspaceToggle={toggleWorkspace}
      onWorkspaceClose={closeWorkspace}
      isEntering={isEntering}
      focusActive={focusActive}
      chatContainerRef={chatContainerRef}
      chatContainerClassName={chatContainerClassName}
      chatRingStyle={chatRingStyle}
      handleBackHome={handleBackHome}
      mobileRailVisible={mobileRailVisible}
      mobileRailInteractionLocked={mobileRailInteractionLocked}
      isLightTheme={isLightTheme}
      roomId={effectiveRoomId}
      inputFocused={inputFocused}
      isMobile={viewportIsMobile}
      sourcesButtonRef={sourcesButtonRef}
      toggleSourcesPanel={toggleSourcesPanel}
      showSourcesPanel={showSourcesPanel}
      sourcesPulse={sourcesPulse}
      conversationSources={conversationSources}
      latestAnswerSources={latestAnswerSources}
      allConversationSources={allConversationSources}
      scopedSources={scopedSources}
      hasConversationSources={hasConversationSources}
      hasAllConversationSources={hasAllConversationSources}
      rightRailActiveKey={activeListingsPanel?.side === "right" ? activeListingsPanel.key : ""}
      toggleProfile={toggleProfileFromRail}
      openProfileDirect={openProfileDirectFromRail}
      analysis={analysis}
      isRoomMode={isRoomMode}
      roomTitle={roomTitle}
      roomOrigin={roomOrigin}
      hideRoomTitle={hideRoomTitle}
      allowAssistantForward={allowAssistantForward}
      isHelpMatchRoom={isHelpMatchRoom}
      isCrisis={isCrisis}
      crisisText={crisisText}
      errorBanner={errorBanner}
      roomBlocked={roomBlocked}
      roomAuthRequired={roomAuthRequired}
      roomCallNode={isRoomMode && sessionUserId && !roomBlocked && !roomAuthRequired ? (
        <RoomCallBar
          roomId={effectiveRoomId}
          userId={sessionUserId}
          isLightTheme={isLightTheme}
          t={t}
          session={roomCallSession}
        />
      ) : null}
      voiceModeNode={voiceModeOpen ? (
        <VoiceModeSurface
          t={t}
          voice={realtimeVoice}
          onClose={closeVoiceMode}
        />
      ) : null}
      roomSummaryApprovalNode={isRoomMode && sessionUserId && !roomBlocked && !roomAuthRequired ? (
        <RoomSummaryApprovalCard
          roomId={effectiveRoomId}
          summaryApprovals={roomSummaryApprovals}
          t={t}
          onResponded={reloadRoomMessages}
        />
      ) : null}
      activeModeLabel={activeModeLabel}
      roomModeLabel={roomModeLabel}
      activeModeKey={activeWorkflow}
      chatWindowRef={chatWindowRef}
      isStreamingAny={isStreamingAny}
      hiddenCount={hiddenCount}
      pageSize={PAGE_SIZE}
      onRevealOlder={revealOlder}
      canHideOlder={visibleMessages.length > MAX_RENDERED_MESSAGES && renderLimit > MAX_RENDERED_MESSAGES}
      onHideOlder={hideOlder}
      onJumpToBottom={handleJumpToBottom}
      messageItems={messageItems}
      listingsPanelNode={modalListingsPanelNode}
      workspaceListingsPanelNode={workspaceListingsPanelNode}
      workspaceListingsPanelMeta={workspaceListingsPanelMeta}
      onWorkspaceListingsPanelBack={backToWorkspaceFromListingsPanel}
      selectedListingContextNode={selectedListingContextNode}
      onWindowDoubleClick={handleChatWindowDoubleClick}
      chatAnalysisPanelProps={chatAnalysisPanelProps}
      inputRowRef={inputRowRef}
      inputBarRef={inputBarRef}
      inputRef={inputRef}
      onFocusComposer={handleComposerFocus}
      onBlurInput={handleInputBlur}
      isGenerating={isGenerating}
      userRole={userRole}
      userActualRole={userActualRole}
      isAdmin={userIsAdmin}
      subActive={Boolean(session?.user?.isAdmin || session?.subActive)}
      onOpenHelpListings={openHelpPanelByKey}
      onStop={stop}
      onSend={handleSendMessage}
      onAuthRequired={() => setLoginOpen(true)}
      onOpenVoiceMode={openVoiceMode}
      onActivateInfoMode={activateInfoMode}
      onActivateDeepResearchMode={activateDeepResearchMode}
      onActivateHelpRequestMode={activateHelpRequestMode}
      onActivateHelpOfferMode={activateHelpOfferMode}
      placeholderText={composerPlaceholderText}
      forcePlaceholderVisible={composerForcePlaceholderVisible}
      hideComposerTools={hideComposerTools}
      documentFlowActive={documentFlowActive}
      suppressCareerCvPreview={suppressCareerCvPreview}
      onPickDocumentFile={analysis.onPickFile}
      voiceEnabled={voiceEnabled}
      recording={recording}
      recordingPulse={recordingPulse}
      handleMic={handleMic}
      cancelRecording={cancelRecording}
      composerDraftApiRef={composerDraftApiRef}
      onDraftStateChange={handleDraftStateChange}
      onComposerLayoutChange={handleComposerLayoutChange}
      sendToAssistant={allowAssistantForward ? sendToAssistant : false}
      setSendToAssistant={setSendToAssistant}
      aiNote={aiNote}
      recordingError={recordingError}
      voiceNotice={voiceNotice}
      closeSourcesPanel={closeSourcesPanel}
      analysisPanelWidth={analysisPanelWidth}
    />
    {deleteListingConfirmNode}
    <LoginModal
      open={loginOpen}
      onClose={() => {
        setLoginOpen(false);
        clearVerifyEntryUrl();
      }}
      suppressRedirect
      onAuthSuccess={() => {
        clearVerifyEntryUrl();
        setLoginOpen(false);
      }}
      prefillStoredEmail={!emailVerifiedEntry}
    />
  </>;
}



