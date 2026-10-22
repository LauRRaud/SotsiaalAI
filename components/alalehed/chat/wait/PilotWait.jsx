"use client";

/* ADR-176: the answer's waiting view: the server's real steps (useChatStream keeps them on the message as pilotSteps)
   in the design the administrator chose. PilotWait is the view before the answer's text; PilotWaitSummary is the one
   quiet line above the answer afterwards, which opens to the steps and their times. */
import { useState } from "react";
import PlaceMap from "./PlaceMap";
import { seconds, tr, waitTexts, waitView } from "./waitView";
import { useWaitMap } from "./waitVariant";
import WaitNotebook from "./WaitNotebook";
import WaitBreathingS from "./WaitBreathingS";
import WaitCards from "./WaitCards";
import WaitConstellation from "./WaitConstellation";

const DESIGNS = Object.freeze({ 1: WaitNotebook, 2: WaitBreathingS, 3: WaitCards, 4: WaitConstellation });

export default function PilotWait({ t, variant, steps }) {
  const look = useWaitMap();
  const Design = DESIGNS[variant];
  if (!Design) return null;
  const view = waitView(steps), texts = waitTexts(t, view);
  const map = view.places.length ? <PlaceMap t={t} places={view.places} look={look} /> : null;
  return (
    <div className="pilot-wait" data-variant={variant} data-stage={view.stage}>
      <Design t={t} view={view} texts={texts} map={map} />
      <span className="sr-only" role="status">{texts.current}</span>
    </div>
  );
}

export function PilotWaitSummary({ t, steps }) {
  const [open, setOpen] = useState(false);
  const view = waitView(steps), texts = waitTexts(t, view);
  if (!view.chosen && !view.found) return null;
  const line = texts.summary || texts.found;
  const trail = [
    view.topic || view.places.length ? [texts.understood, [view.topic, ...texts.places].filter(Boolean).join(" · "), view.at.plan] : null,
    texts.found ? [tr(t, "chat.pilot_wait.searched", "Otsisin Sotsiaal.pro andmebaasist"), texts.found, view.at.found] : null,
    view.chosen ? [texts.chosen, [...view.chosen.titles, texts.more].filter(Boolean).join(" · "), view.at.chosen] : null,
    view.at.writing != null ? [tr(t, "chat.pilot_wait.wrote", "Vastuse kirjutamine algas"), "", view.at.writing] : null,
  ].filter(Boolean);
  // In its own block: chat.css lays out a message row that has a button as a direct child as a flex row
  // (#chat-window-scroll > div:has(> button)), which put this line beside the answer as a narrow column.
  return (
    <div className="pilot-wait-summary-row">
      <button type="button" className="pilot-wait-summary" aria-expanded={open ? "true" : "false"} onClick={event => { event.stopPropagation(); setOpen(value => !value); }}>
        <span>{line}{view.at.writing != null ? ` · ${seconds(view.at.writing)}` : ""}</span>
        <span className="pilot-wait-summary__chev" aria-hidden="true">⌄</span>
      </button>
      {open ? (
        <ol className="pilot-wait-trail">
          {trail.map(([title, detail, at]) => (
            <li key={title}><strong>{title}</strong>{detail ? `: ${detail}` : ""}{at != null ? ` (${seconds(at)})` : ""}</li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
