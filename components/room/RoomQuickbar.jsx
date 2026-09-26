"use client";

import { useRef } from "react";
import IconButton from "@/components/glass/IconButton";
import {
  LanguageAccessIcon,
  PowerIcon,
} from "@/components/brand/icons/CardIcons";

/**
 * RoomQuickbar — ruumi püsiv juhtpaneel.
 *
 * Elab RoomStage'i kõrval eraldi ülemises kihis, et sama juhtpaneel oleks
 * kasutatav nii karussellis kui ka töövaadetes. Avastseeni ajal annab
 * `visible=false` juhtimise endiselt alumistele kõnni-juhikutele.
 */
export default function RoomQuickbar({
  ambientOn,
  containerRef,
  handsOn = false,
  onNextAmbient,
  onOpenAccessibility,
  onPowerOff,
  onToggleAmbient,
  /* null = seadmel pole kaamerat või leht pole turvalises kontekstis:
     siis nuppu ei ole, mitte ei ole katkine nupp. */
  onToggleHands = null,
  onToggleOpen,
  open,
  t,
  visible,
}) {
  const gestureRef = useRef(null);
  const suppressClickRef = useRef(false);

  const finishGesture = (event) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.id !== event.pointerId) return;
    gestureRef.current = null;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    const swiped = Math.abs(dy) >= 24 && Math.abs(dy) > Math.abs(dx);
    const tappedHandle = gesture.handle && Math.hypot(dx, dy) < 8;
    // Handle touch directly; its compatibility click must not toggle twice
    // or activate an icon revealed beneath the finger after a swipe.
    if (swiped || tappedHandle || Math.hypot(dx, dy) >= 8) {
      suppressClickRef.current = true;
      event.preventDefault();
      if ((swiped && (dy > 0) !== open) || tappedHandle) onToggleOpen();
    }
  };

  return (
    <div
      className="room-topbar"
      data-open={open ? "1" : "0"}
      data-room-ui
      data-visible={visible ? "1" : "0"}
      ref={containerRef}
      onPointerDown={(event) => {
        suppressClickRef.current = false;
        if (event.pointerType === "mouse" || !event.isPrimary) return;
        gestureRef.current = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          handle: event.target.closest?.(".room-topbar-arrow") != null,
        };
      }}
      onPointerUp={finishGesture}
      onPointerCancel={() => { gestureRef.current = null; }}
      onClickCapture={(event) => {
        if (!suppressClickRef.current || event.detail === 0) return;
        suppressClickRef.current = false;
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <button
        type="button"
        className="room-topbar-arrow"
        aria-label={t(open ? "room.quickbar_close" : "room.quickbar_open")}
        aria-expanded={open}
        onClick={onToggleOpen}
      />
      <div
        className="room-quickbar"
        onClick={(event) => {
          /* Hiireklõps ei jäta nuppu :focus-within-olekusse. Klaviatuuriga
             aktiveerimisel (detail === 0) säilib vajalik fookus. */
          if (event.detail > 0) {
            const button = event.target.closest?.(".room-quick-btn");
            if (button) requestAnimationFrame(() => button.blur());
          }
        }}
      >
        <span className="gc-card-surface" aria-hidden="true" />
        <span className="room-quickbar-arrow" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
        <IconButton
          layoutClassName="room-quick-btn"
          aria-label={t(ambientOn ? "room.sound_off" : "room.sound_on")}
          aria-pressed={ambientOn}
          data-on={ambientOn ? "1" : "0"}
          onClick={onToggleAmbient}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4.6 9.4v5.2h3.2l4.6 3.8V5.6L7.8 9.4H4.6Z" />
            {ambientOn ? (
              <>
                <path d="M15.6 9.2a4 4 0 0 1 0 5.6" />
                <path d="M18 6.8a7.4 7.4 0 0 1 0 10.4" />
              </>
            ) : (
              <path d="m15.4 9.6 4.8 4.8m0-4.8-4.8 4.8" />
            )}
          </svg>
        </IconButton>
        {ambientOn ? (
          <IconButton
            layoutClassName="room-quick-btn"
            aria-label={t("room.sound_next")}
            onClick={onNextAmbient}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M7 6.5 15 12 7 17.5V6.5Z" />
              <path d="M17.5 6.6v10.8" />
            </svg>
          </IconButton>
        ) : null}
        {onToggleHands ? (
          <IconButton
            layoutClassName="room-quick-btn"
            aria-label={t(handsOn ? "room.hands_off" : "room.hands_on")}
            aria-pressed={handsOn}
            data-on={handsOn ? "1" : "0"}
            onClick={onToggleHands}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 11V6a2 2 0 0 0-4 0" />
              <path d="M14 10V4a2 2 0 0 0-4 0v2" />
              <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
              <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-6-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
            </svg>
          </IconButton>
        ) : null}
        <IconButton
          layoutClassName="room-quick-btn"
          aria-label={t("room.settings_open")}
          onClick={onOpenAccessibility}
        >
          <LanguageAccessIcon />
        </IconButton>
        <IconButton
          layoutClassName="room-quick-btn"
          aria-label={t("room.power_off")}
          onClick={onPowerOff}
        >
          <PowerIcon />
        </IconButton>
      </div>
    </div>
  );
}
