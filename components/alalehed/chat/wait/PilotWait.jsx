"use client";

/* ADR-176: the answer's waiting view: the server's real steps (useChatStream keeps them on the message as pilotSteps)
   in the design the owner chose on 22.10 ("Hingav S" with the small brand map). It is shown until the answer's first
   text; the answer then takes its place. */
import PlaceMap from "./PlaceMap";
import { waitTexts, waitView } from "./waitView";
import WaitBreathingS from "./WaitBreathingS";

export default function PilotWait({ t, steps }) {
  const view = waitView(steps), texts = waitTexts(t, view);
  const map = view.places.length ? <PlaceMap t={t} places={view.places} /> : null;
  return (
    <div className="pilot-wait" data-variant="2" data-stage={view.stage}>
      <WaitBreathingS view={view} texts={texts} map={map} />
      <span className="sr-only" role="status">{texts.current}</span>
    </div>
  );
}
