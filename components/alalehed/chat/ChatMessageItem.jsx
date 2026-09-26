"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { parseAssistantMarkdownBlocks } from "@/lib/chat/messageMarkdown";
import MessageActionsMenu from "./MessageActionsMenu";

const ICON_PROPS = {
  "aria-hidden": "true",
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round"
};
const RETRY_ICON = (
  <svg {...ICON_PROPS}>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);
const LISTEN_ICON = (
  <svg {...ICON_PROPS}>
    <path d="M11 5 6 9H2v6h4l5 4z" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
  </svg>
);
const COPY_ICON = (
  <svg {...ICON_PROPS}>
    <rect x="9" y="9" width="10" height="10" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
  </svg>
);
const SOURCES_ICON = (
  <svg {...ICON_PROPS}>
    <path d="M12 3.5 3.5 8 12 12.5 20.5 8Z" />
    <path d="M3.5 12 12 16.5 20.5 12" />
    <path d="M3.5 16 12 20.5 20.5 16" />
  </svg>
);
const DIAGNOSTICS_ICON = (
  <svg {...ICON_PROPS}>
    <path d="M4 5h16M4 12h16M4 19h16" />
    <circle cx="8" cy="5" r="2" />
    <circle cx="16" cy="12" r="2" />
    <circle cx="10" cy="19" r="2" />
  </svg>
);


function splitGraphemes(text) {
  if (!text) return [];
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter(undefined, {
      granularity: "grapheme"
    });
    return Array.from(segmenter.segment(text), segment => segment.segment);
  }
  return Array.from(text);
}

const TYPING_STEP_MS = 18;
const TYPING_TRAILING_INLINE_RE = /^[\s!?,.;:)]$/;

function getTimeLocale(locale) {
  if (locale === "et") return "et-EE";
  if (locale === "ru") return "ru-RU";
  if (locale === "en") return "en-GB";
  return locale || undefined;
}

function formatMessageTime(createdAt, locale) {
  if (!createdAt) return null;
  const date = createdAt instanceof Date ? createdAt : new Date(createdAt);
  const timestamp = date.getTime();
  if (!Number.isFinite(timestamp)) return null;

  try {
    return {
      label: new Intl.DateTimeFormat(getTimeLocale(locale), {
        hour: "2-digit",
        minute: "2-digit"
      }).format(date),
      iso: date.toISOString()
    };
  } catch {
    return {
      label: date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      }),
      iso: date.toISOString()
    };
  }
}

function renderInlineMarkdown(text, keyPrefix) {
  const source = String(text || "");
  void keyPrefix;
  return source
    .replace(/\*\*([^*\n][\s\S]*?[^*\n])\*\*/g, "$1")
    .replace(/__([^_\n][\s\S]*?[^_\n])__/g, "$1");
}

function AssistantMarkdown({ text }) {
  const blocks = useMemo(() => parseAssistantMarkdownBlocks(text), [text]);

  if (!blocks.length) return null;

  return (
    <div>
      {blocks.map((block, index) => {
        if (block.type === "unordered" || block.type === "ordered") {
          const ListTag = block.type === "ordered" ? "ol" : "ul";
          return (
            <ListTag
              key={`${block.type}-${index}`}
              {...(block.type === "ordered" && block.start > 1 ? { start: block.start } : {})}
            >
              {block.items.map((item, itemIndex) => (
                <li key={`${block.type}-${index}-${itemIndex}`}>
                  {renderInlineMarkdown(item, `${block.type}-${index}-${itemIndex}`)}
                </li>
              ))}
            </ListTag>
          );
        }

        return (
          <p key={`paragraph-${index}`}>
            {renderInlineMarkdown(block.text, `paragraph-${index}`)}
          </p>
        );
      })}
    </div>
  );
}

const ChatMessageItem = memo(function ChatMessageItem({
  messageId,
  role,
  text,
  attachments,
  cards,
  createdAt,
  aiVisible: _aiVisible,
  typingEffect = false,
  onTypingComplete,
  authorName,
  authorRole: _authorRole,
  isRoomMode: _isRoomMode,
  t,
  locale = "et",
  isLightTheme: _isLightTheme,
  voiceEnabled = true,
  canSpeak = false,
  isSpeaking = false,
  onSpeak,
  messageSources = [],
  onShowSources,
  onShowDiagnostics,
  diagnosticRef = null,
  isStreaming = false,
  completionStatus = null,
  onRetry,
  retryPending = false,
  entranceIndex = 0
}) {
  const isAssistant = role === "ai";
  // Rööpa nuppude klaassildid (sama pill mis komposeris) — lühike sõna,
  // pikem kirjeldus jääb aria-label'isse.
  const tipLabel = (key, fallback) => {
    const value = typeof t === "function" ? t(`chat.message_tip.${key}`) : "";
    return value && value !== `chat.message_tip.${key}` ? value : fallback;
  };
  const isOwn = role === "user";
  /* Pöördindeks (0 = uusim) juhib sisenemis-kaskaadi viidet chat.css-is;
     CSS piirab efekti min()-iga, seega suur indeks on ohutu. */
  const entranceStyle = { "--msg-ri": entranceIndex };
  const [userTimeVisible, setUserTimeVisible] = useState(false);
  const [aiTimeVisible, setAiTimeVisible] = useState(false);
  const messageTime = useMemo(() => formatMessageTime(createdAt, locale), [createdAt, locale]);
  const normalizedAuthorName = String(authorName || "").trim();
  const hiddenAuthorNames = new Set([
    String(t("chat.aria.member") || "").trim().toLowerCase(),
    "liige",
    "member"
  ]);
  const displayAuthorName =
    normalizedAuthorName && !hiddenAuthorNames.has(normalizedAuthorName.toLowerCase())
      ? normalizedAuthorName
      : "";
  const authorLabel = isAssistant ? t("chat.aria.assistant") : isOwn ? t("chat.aria.user") : displayAuthorName || t("chat.aria.user");
  const thinkingLabelRaw = typeof t === "function" ? t("chat.typing.label") : "";
  const thinkingLabel = thinkingLabelRaw && thinkingLabelRaw !== "chat.typing.label"
    ? thinkingLabelRaw
    : locale === "en"
      ? "Thinking"
      : locale === "ru"
        ? "Думаю"
        : "Mõtlen";
  const normalizedAttachments = Array.isArray(attachments)
    ? attachments
        .filter(item => item && typeof item === "object")
        .map(item => ({
          label: String(item.label || "").trim() || "Download file",
          url: String(item.url || "").trim(),
          fileName: String(item.fileName || "").trim()
        }))
        .filter(item => !!item.url)
    : [];
  const showAttachments = isAssistant && normalizedAttachments.length > 0;
  const typingTimerRef = useRef(0);
  const typingCompleteNotifiedRef = useRef(false);
  const [visibleCount, setVisibleCount] = useState(0);
  const textSegments = useMemo(
    () => splitGraphemes(String(text || "").trim()),
    [text]
  );
  const clearTypingTimer = () => {
    if (!typingTimerRef.current || typeof window === "undefined") return;
    window.clearTimeout(typingTimerRef.current);
    typingTimerRef.current = 0;
  };
  useEffect(() => {
    clearTypingTimer();
    setVisibleCount(0);
    typingCompleteNotifiedRef.current = false;

    if (!typingEffect || !textSegments.length) {
      setVisibleCount(textSegments.length);
      if (typingEffect && textSegments.length === 0 && !typingCompleteNotifiedRef.current) {
        typingCompleteNotifiedRef.current = true;
        onTypingComplete?.();
      }
      return;
    }

    let nextCount = Math.min(textSegments.length, 1);
    while (nextCount < textSegments.length && TYPING_TRAILING_INLINE_RE.test(textSegments[nextCount])) {
      nextCount += 1;
    }
    setVisibleCount(nextCount);

    const step = () => {
      let followingCount = Math.min(textSegments.length, nextCount + 1);
      while (followingCount < textSegments.length && TYPING_TRAILING_INLINE_RE.test(textSegments[followingCount])) {
        followingCount += 1;
      }
      nextCount = followingCount;
      setVisibleCount(followingCount);
      if (followingCount >= textSegments.length) {
        typingTimerRef.current = 0;
        if (!typingCompleteNotifiedRef.current) {
          typingCompleteNotifiedRef.current = true;
          onTypingComplete?.();
        }
        return;
      }
      typingTimerRef.current = window.setTimeout(step, TYPING_STEP_MS);
    };

    typingTimerRef.current = window.setTimeout(step, TYPING_STEP_MS);
    return () => {
      clearTypingTimer();
    };
  }, [onTypingComplete, textSegments, typingEffect]);
  useEffect(() => () => {
    clearTypingTimer();
  }, []);
  const visibleText = typingEffect
    ? textSegments.slice(0, visibleCount).join("")
    : textSegments.join("");
  const normalizedCards = Array.isArray(cards)
    ? cards
        .filter((item) => item && typeof item === "object")
        .map((item) => ({
          title: String(item.title || "").trim(),
          subtitle: String(item.subtitle || "").trim(),
          body: String(item.body || "").trim(),
          meta: String(item.meta || "").trim(),
          hint: String(item.hint || "").trim()
        }))
        .filter((item) => item.title || item.body)
    : [];
  const showCards = isAssistant && normalizedCards.length > 0;
  const showThinking = isAssistant && isStreaming && !String(visibleText || "").trim() && !showCards && !showAttachments;
  const tr = key => {
    const value = typeof t === "function" ? t(key) : "";
    return value && value !== key ? value : "";
  };
  const copyLabel = locale === "en" ? "Copy" : locale === "ru" ? "Копировать" : "Kopeeri";
  const listenLabel = tr("chat.listen.last_reply") || "Loe ette";
  const sourcesLabel = tr("chat.sources.heading") || "Allikad";
  const actionsLabel = locale === "en" ? "Message actions" : locale === "ru" ? "Действия с сообщением" : "Sõnumi tegevused";
  const hasMessageSources = Array.isArray(messageSources) && messageSources.length > 0;
  const normalizedCompletionStatus = String(completionStatus || "").toUpperCase();
  const canRetry = isAssistant
    && typeof onRetry === "function"
    && (normalizedCompletionStatus === "ERROR" || normalizedCompletionStatus === "ABORTED");
  const retryLabel = tr("chat.error.retry") || (locale === "en" ? "Try again" : locale === "ru" ? "Повторить" : "Proovi uuesti");
  const interruptedNotice = !String(text || "").trim()
    ? normalizedCompletionStatus === "ABORTED"
      ? (tr("chat.error.interrupted") || (locale === "en" ? "The response was interrupted." : locale === "ru" ? "Ответ был прерван." : "Vastus katkes."))
      : normalizedCompletionStatus === "ERROR"
        ? (tr("chat.error.generic") || (locale === "en" ? "Something went wrong." : locale === "ru" ? "Что-то пошло не так." : "Midagi läks valesti."))
        : ""
    : "";
  const handleCopy = async () => {
    const value = String(text || "").trim();
    if (!value || typeof navigator === "undefined") return;
    try {
      await navigator.clipboard?.writeText(value);
    } catch {}
  };
  const handleSpeak = () => {
    const value = String(text || "").trim();
    if (!value) return;
    onSpeak?.(value);
  };
  const hasText = Boolean(String(text || "").trim());
  const messageActions = [];
  if (isAssistant && (hasText || canRetry)) {
    if (canRetry) {
      messageActions.push({
        key: "retry",
        label: tipLabel("retry", retryLabel),
        ariaLabel: retryLabel,
        disabled: retryPending,
        onSelect: () => onRetry?.(messageId),
        icon: RETRY_ICON
      });
    }
    if (hasText) {
      messageActions.push({
        key: "listen",
        label: tipLabel("listen", "Kuula"),
        ariaLabel: listenLabel,
        disabled: !voiceEnabled || !canSpeak,
        speaking: isSpeaking,
        onSelect: handleSpeak,
        icon: LISTEN_ICON
      });
      messageActions.push({
        key: "copy",
        label: tipLabel("copy", copyLabel),
        ariaLabel: copyLabel,
        onSelect: handleCopy,
        icon: COPY_ICON
      });
      if (hasMessageSources) {
        messageActions.push({
          key: "sources",
          label: tipLabel("sources", sourcesLabel),
          ariaLabel: sourcesLabel,
          onSelect: () => onShowSources?.(messageSources),
          icon: SOURCES_ICON
        });
      }
    }
    if (!isStreaming && onShowDiagnostics) {
      messageActions.push({
        key: "diagnostics",
        label: tipLabel("diagnostics", "Diagnostika"),
        ariaLabel: t("chat.diagnostics.open"),
        onSelect: () => onShowDiagnostics(diagnosticRef || "missing"),
        icon: DIAGNOSTICS_ICON
      });
    }
  }
  const toggleUserTimestamp = () => {
    if (!messageTime) return;
    setUserTimeVisible(prev => !prev);
  };
  // AI-mull: klõps mulli pinnale näitab/peidab kellaaja (nagu kasutaja
  // mullil). Nupud, lingid ja teksti valimine seda ei käivita.
  const toggleAiTimestamp = event => {
    if (!messageTime) return;
    if (event.target.closest?.("button, a, [data-msg-rail]")) return;
    const selection = typeof window !== "undefined" ? window.getSelection?.() : null;
    if (selection && String(selection).trim()) return;
    setAiTimeVisible(prev => !prev);
  };
  const handleAiBubbleKeyDown = event => {
    if (event.target !== event.currentTarget) return;
    if (event.key !== "Enter") return;
    event.preventDefault();
    toggleAiTimestamp(event);
  };
  const handleUserBubbleKeyDown = event => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    toggleUserTimestamp();
  };
  if (!isAssistant && !isOwn) {
    return <div role="article" tabIndex={0} data-role={role} data-chat-message-id={messageId} style={entranceStyle}>
        {displayAuthorName ? <div>{displayAuthorName}</div> : null}
        <div>
          <span className="sr-only">
            {authorLabel}
            {": "}
          </span>
        <div lang={locale}>{text}</div>
        </div>
      </div>;
  }
  if (isOwn) {
    return <div role="article" tabIndex={0} data-role={role} data-chat-message-id={messageId} style={entranceStyle}>
        <span className="sr-only">
          {authorLabel}
          {": "}
        </span>

        {text ? <div>
            <div
              role={messageTime ? "button" : undefined}
              tabIndex={messageTime ? 0 : undefined}
              aria-expanded={messageTime ? userTimeVisible : undefined}
              onClick={toggleUserTimestamp}
              onKeyDown={handleUserBubbleKeyDown}
            >
              <div lang={locale}>{visibleText}</div>
            </div>
            {messageTime && userTimeVisible ? (
              <time dateTime={messageTime.iso}>
                {messageTime.label}
              </time>
            ) : null}
          </div> : null}
      </div>;
  }
  return <div role="article" tabIndex={showThinking ? -1 : 0} data-role={role} data-chat-message-id={messageId} lang={locale} style={entranceStyle} data-thinking={showThinking ? "true" : undefined} data-streaming={isStreaming ? "true" : undefined} data-time-open={aiTimeVisible ? "true" : undefined} onClick={toggleAiTimestamp} onKeyDown={handleAiBubbleKeyDown}>
      <span className="sr-only">
        {authorLabel}
        {": "}
      </span>

      {text ? (
        <AssistantMarkdown text={visibleText} />
      ) : null}
      {showThinking ? (
        <span role="status" aria-live="polite" aria-label={thinkingLabel} />
      ) : null}
      {showCards ? (
        <div>
          {normalizedCards.map((item, idx) => (
            <article key={`${item.title || item.body}-${idx}`}>
              {item.title ? <div>{item.title}</div> : null}
              {item.subtitle ? <div>{item.subtitle}</div> : null}
              {item.body ? <div>{item.body}</div> : null}
              {item.meta ? <div>{item.meta}</div> : null}
              {item.hint ? <div>{item.hint}</div> : null}
            </article>
          ))}
        </div>
      ) : null}
      {showAttachments ? (
        <div>
          {normalizedAttachments.map((item, idx) => (
            <a
              key={`${item.url}-${idx}`}
              href={item.url}
              download={item.fileName || undefined}
            >
              {item.label}
            </a>
          ))}
        </div>
      ) : null}
      {interruptedNotice ? (
        <p role="status" data-completion-status={normalizedCompletionStatus.toLowerCase()}>
          {interruptedNotice}
        </p>
      ) : null}
      {messageActions.length ? (
        /* Välimine rööbas on mulli kõrgune; sisemine ⋯ on sticky ja sõidab
           pika vastuse lugemisel kaasa. Kõik tegevused on ühe nupu taga,
           et ikoonid ei segaks teksti lugemist (omanik 26.09). */
        <span data-msg-rail="">
          <div aria-label={actionsLabel}>
            <MessageActionsMenu
              label={actionsLabel}
              tip={tipLabel("more", "Valikud")}
              actions={messageActions}
              speaking={isSpeaking}
              time={messageTime}
            />
          </div>
        </span>
      ) : null}
      {messageTime && aiTimeVisible ? (
        <time dateTime={messageTime.iso}>
          {messageTime.label}
        </time>
      ) : null}
    </div>;
});
export default ChatMessageItem;
