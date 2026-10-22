"use client";

/* ADR-176: the administrator's choice of the waiting design (0 = today's turning S, 1-4 the designs). A small group of
   numbers in the lower left corner of the chat; the choice applies to the next question sent in this browser. */
import { chooseWaitMap, chooseWaitVariant, useIsAdmin, useWaitMap, useWaitVariant, WAIT_MAPS, WAIT_VARIANTS } from "./waitVariant";
import { tr } from "./waitView";

const NAMES = Object.freeze({ 0: ["current", "Praegune"], 1: ["notebook", "Märkmik"], 2: ["breathing", "Hingav S"],
  3: ["cards", "Kaardid"], 4: ["constellation", "Tähtkuju"] });

export default function WaitVariantPicker({ t }) {
  const variant = useWaitVariant();
  const map = useWaitMap();
  const isAdmin = useIsAdmin();
  if (!isAdmin) return null;
  const label = tr(t, "chat.pilot_wait.picker", "Ootus");
  return (
    <div className="pilot-wait-picker" role="group" aria-label={label}>
      <span className="pilot-wait-picker__label" aria-hidden="true">{label}</span>
      {WAIT_VARIANTS.map(value => {
        const [key, fallback] = NAMES[value];
        const name = tr(t, `chat.pilot_wait.design.${key}`, fallback);
        return (
          <button key={value} type="button" aria-pressed={variant === value ? "true" : "false"} title={name}
            aria-label={`${value}: ${name}`} onClick={() => chooseWaitVariant(value)}>
            <span>{value}</span>
          </button>
        );
      })}
      <span className="pilot-wait-picker__sep" aria-hidden="true" />
      <span className="pilot-wait-picker__label" aria-hidden="true">{tr(t, "chat.pilot_wait.map", "Kaart")}</span>
      {WAIT_MAPS.map(value => (
        <button key={value} type="button" className="pilot-wait-picker__word" aria-pressed={map === value ? "true" : "false"}
          onClick={() => chooseWaitMap(value)}>
          <span>{value === "icon" ? tr(t, "chat.pilot_wait.map_icon", "Ikoon") : tr(t, "chat.pilot_wait.map_outline", "Kontuur")}</span>
        </button>
      ))}
    </div>
  );
}
