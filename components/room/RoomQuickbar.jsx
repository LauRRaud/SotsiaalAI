"use client";

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
  onNextAmbient,
  onOpenAccessibility,
  onPowerOff,
  onToggleAmbient,
  onToggleOpen,
  open,
  t,
  visible,
}) {
  return (
    <div
      className="room-topbar"
      data-open={open ? "1" : "0"}
      data-room-ui
      data-visible={visible ? "1" : "0"}
      ref={containerRef}
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
