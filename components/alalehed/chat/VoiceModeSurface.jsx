"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import GlassCarousel from "@/components/room/GlassCarousel";
import ChevronIcon from "@/components/brand/icons/ChevronIcon";
import { AboutInfoIcon } from "@/components/brand/icons/CardIcons";
import { VOICE_SESSION_WARNING_MS } from "@/lib/chat/realtimeVoice";

const VoicePointAvatar = dynamic(() => import("./VoicePointAvatar"), {
  ssr: false,
  loading: () => <div className="voice-avatar voice-avatar--loading" aria-hidden="true" />
});

const LIVE_STATES = ["connecting", "listening", "thinking", "speaking"];

function formatRemaining(milliseconds) {
  const total = Math.max(0, Math.ceil(Number(milliseconds || 0) / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Häälpind on avatar läbipaistval taustal — ei paneeli, ei vastuse subtiitrit,
 * pealkirja, ei olekumulli. Navigatsioon käib platvormi DOKI kaudu
 * (tagasi-nool + üks olekunupp + ⓘ), täpselt nagu teistel avatud lehtedel.
 */
export default function VoiceModeSurface({ t, voice, onClose }) {
  const surfaceRef = useRef(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const endSession = voice.endSession;
  const read = (key, fallback) => {
    const value = typeof t === "function" ? t(key) : "";
    return typeof value === "string" && value.trim() && value !== key ? value : fallback;
  };
  const live = LIVE_STATES.includes(voice.status);
  const showCountdown = live
    && voice.remainingMs > 0
    && voice.remainingMs <= VOICE_SESSION_WARNING_MS;

  useEffect(() => {
    const onKeyDown = event => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      endSession("ended");
      onClose?.();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [endSession, onClose]);

  // Tagasi-nool viib vestlusesse ja lõpetab seansi: lahtine mikrofon
  // nähtamatu pinna taga oleks vaikne loaületus.
  const leave = () => {
    voice.endSession("ended");
    onClose?.();
  };
  // Üks nupp kannab mõlemat olekut — alustab seansi või lõpetab ta.
  const toggleSession = () => {
    if (live) {
      voice.endSession("ended");
      return;
    }
    setInfoOpen(false);
    voice.startSession();
  };
  const onDockSelect = item => {
    if (item?.key === "voice-back") return leave();
    if (item?.key === "voice-info") return setInfoOpen(open => !open);
    return toggleSession();
  };

  const dock = typeof document === "undefined" ? null : createPortal(
    /* Dokk portaalitakse body'sse: paneelil on backdrop-filter, mis loob
       oma sisaldusploki ja muudaks `position: fixed` doki paneeli-siseseks. */
    <div className="room-dock-wrap" data-room-ui data-voice-dock="1">
      <GlassCarousel
        dockOnly
        items={[]}
        t={t}
        forceInitial
        backItem={{
          key: "voice-back",
          label: read("chat.voice.back", "Tagasi vestlusesse"),
          icon: <ChevronIcon direction="left" strokeWidth={1.05} />
        }}
        actionItem={{
          key: "voice-toggle",
          // Dokis on lühivorm: "Alusta häälvestlust" venitaks riba laiaks.
          label: live ? read("chat.voice.end", "Lõpeta") : read("chat.voice.start_short", "Alusta"),
          active: live,
          tone: live ? "stop" : "start"
        }}
        infoItem={{
          key: "voice-info",
          label: read("chat.voice.info", "Kuidas häälvestlus töötab"),
          icon: <AboutInfoIcon />,
          active: infoOpen
        }}
        onSelect={onDockSelect}
      />
    </div>,
    document.body
  );

  return (
    <section
      ref={surfaceRef}
      className="voice-mode"
      data-voice-mode="true"
      data-state={voice.status}
      data-info-open={infoOpen ? "true" : undefined}
      role="dialog"
      aria-modal="true"
      aria-label={read("chat.voice.eyebrow", "Häälvestlus")}
    >
      {infoOpen ? (
        /* ⓘ vahetab pinna sisu, ei ava modaali — nii nagu mujal platvormil. */
        <div className="voice-mode__info">
          <h2>{read("chat.voice.info", "Kuidas häälvestlus töötab")}</h2>
          <p>{read("chat.voice.info_mic", "Mikrofon avaneb alles sinu loal ja sulgub seansi lõpus.")}</p>
          <p>{read("chat.voice.info_path", "Sinu kõne teisendatakse tekstiks ja vastus tuleb sama teed pidi nagu kirjalikus vestluses — samadest allikatest ja sama kontrolliga.")}</p>
          <p>{read("chat.voice.limit_copy", "Seanss sulgub automaatselt 5 minuti või 90 sekundi vaikuse järel.")}</p>
        </div>
      ) : (
        <>
          <div className="voice-mode__stage">
            <VoicePointAvatar
              status={voice.status}
              audioLevel={voice.audioLevel}
              label={read("chat.voice.avatar_label", "Täppidest digitaalne vestlusavatar")}
            />
          </div>

          {/* Vastuse tekst jääb vestlusse. Lühike olek elab avatari all eraldi
              rahulikus alas, et pikk RAG-paus oleks arusaadav ega muudaks
              avatari mõõtu. Kell ilmub ainult siis, kui 45-sekundiline
              lõpuhoiatus on juba kasutajale vajalik. */}
          <div className="voice-mode__caption" aria-live="polite" aria-atomic="true">
            {live ? <span className="voice-mode__state" role="status">{voice.stateLabel}</span> : null}
            {voice.notice ? <span className="voice-mode__notice" role="status">{voice.notice}</span> : null}
            {voice.error ? <span className="voice-mode__error" role="alert">{voice.error}</span> : null}
            {showCountdown ? (
              <time className="voice-mode__clock" aria-label={read("chat.voice.time_left", "Seansi lõpuni")}>
                {formatRemaining(voice.remainingMs)}
              </time>
            ) : null}
          </div>
        </>
      )}
      {dock}
    </section>
  );
}
