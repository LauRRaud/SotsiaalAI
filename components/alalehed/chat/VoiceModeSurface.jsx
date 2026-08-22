"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef } from "react";

const VoicePointAvatar = dynamic(() => import("./VoicePointAvatar"), {
  ssr: false,
  loading: () => <div className="voice-avatar voice-avatar--loading" aria-hidden="true" />
});

function formatRemaining(milliseconds) {
  const total = Math.max(0, Math.ceil(Number(milliseconds || 0) / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function cleanCaption(value) {
  return String(value || "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_#>`~]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 360);
}

export default function VoiceModeSurface({
  t,
  voice,
  latestAiText,
  sourceCount = 0,
  onShowSources,
  onClose
}) {
  const surfaceRef = useRef(null);
  const startButtonRef = useRef(null);
  const endButtonRef = useRef(null);
  const endSession = voice.endSession;
  const read = (key, fallback) => {
    const value = typeof t === "function" ? t(key) : "";
    return typeof value === "string" && value.trim() && value !== key ? value : fallback;
  };
  const connected = ["connecting", "listening", "thinking", "speaking"].includes(voice.status);
  const canStart = ["idle", "error", "ended"].includes(voice.status);
  const visibleCaption = useMemo(() => {
    if (voice.status === "speaking") return cleanCaption(latestAiText);
    return cleanCaption(voice.partialCaption || voice.caption);
  }, [latestAiText, voice.caption, voice.partialCaption, voice.status]);

  useEffect(() => {
    (startButtonRef.current || endButtonRef.current)?.focus?.({ preventScroll: true });
    const onKeyDown = event => {
      if (event.key === "Escape") {
        event.preventDefault();
        endSession("ended");
        onClose?.();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = [...(surfaceRef.current?.querySelectorAll?.("button:not([disabled])") || [])];
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [endSession, onClose]);

  const close = () => {
    voice.endSession("ended");
    onClose?.();
  };

  return (
    <section
      ref={surfaceRef}
      className="voice-mode"
      data-voice-mode="true"
      data-state={voice.status}
      role="dialog"
      aria-modal="true"
      aria-labelledby="voice-mode-title"
    >
      <div className="voice-mode__ambient" aria-hidden="true" />
      <header className="voice-mode__header">
        <div>
          <span className="voice-mode__eyebrow">{read("chat.voice.eyebrow", "Häälvestlus")}</span>
          <h2 id="voice-mode-title">{read("chat.voice.title", "SotsiaalAI")}</h2>
        </div>
        <div className="voice-mode__session-meta">
          <span data-live={connected ? "true" : undefined}>{connected ? read("chat.voice.live", "Otse") : read("chat.voice.ready", "Valmis")}</span>
          <time aria-label={read("chat.voice.time_left", "Seansi lõpuni")}>{formatRemaining(voice.remainingMs)}</time>
        </div>
      </header>

      <div className="voice-mode__stage">
        <VoicePointAvatar
          status={voice.status}
          audioLevel={voice.audioLevel}
          label={read("chat.voice.avatar_label", "Täppidest digitaalne vestlusavatar")}
        />
        <div className="voice-mode__state" data-state={voice.status}>
          <span aria-hidden="true" />
          <strong>{voice.stateLabel}</strong>
        </div>
      </div>

      <div className="voice-mode__caption" aria-live="polite" aria-atomic="true">
        {visibleCaption ? <p>{visibleCaption}</p> : (
          <p data-placeholder="true">
            {canStart
              ? read("chat.voice.start_hint", "Vajuta Alusta. Mikrofon avaneb alles sinu loal.")
              : read("chat.voice.listening_hint", "Räägi loomulikult — vastuse saad nii hääle kui tekstina.")}
          </p>
        )}
        {voice.notice ? <span className="voice-mode__notice" role="status">{voice.notice}</span> : null}
        {voice.error ? <span className="voice-mode__error" role="alert">{voice.error}</span> : null}
      </div>

      <div className="voice-mode__controls">
        {canStart ? (
          <button ref={startButtonRef} type="button" className="voice-mode__start" onClick={voice.startSession}>
            <span aria-hidden="true" />
            {read("chat.voice.start", "Alusta häälvestlust")}
          </button>
        ) : null}
        {connected ? (
          <button type="button" className="voice-mode__mute" data-muted={voice.muted ? "true" : undefined} onClick={voice.toggleMuted}>
            <span aria-hidden="true" />
            {voice.muted ? read("chat.voice.unmute", "Lülita mikrofon sisse") : read("chat.voice.mute", "Vaigista")}
          </button>
        ) : null}
        {sourceCount > 0 ? (
          <button type="button" className="voice-mode__sources" onClick={onShowSources}>
            {read("chat.voice.sources", "Allikad")} <span>{sourceCount}</span>
          </button>
        ) : null}
        <button ref={endButtonRef} type="button" className="voice-mode__end" onClick={close}>
          <span aria-hidden="true" />
          {read("chat.voice.end", "Lõpeta")}
        </button>
      </div>

      <p className="voice-mode__limit-copy">
        {read("chat.voice.limit_copy", "Seanss sulgub automaatselt 5 minuti või 90 sekundi vaikuse järel.")}
      </p>
    </section>
  );
}
