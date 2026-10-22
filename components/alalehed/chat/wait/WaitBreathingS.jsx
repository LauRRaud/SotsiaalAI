"use client";

/* ADR-176, waiting design 2 "Hingav S": the S mark lives through the turn. Its outline is written in while the question
   is read, it fills once the plan has understood the question, a ring of dots (one per source found) appears with the
   search result, the chosen ones step inward, and a soft glow breathes behind it while the answer is written. One
   caption crossfades beside it with one detail line under it; the place map sits below once the plan read a place.
   Everything is derived from the props on each render, so a step that arrives late or never only leaves its part out. */
import { useId } from "react";

/* public/logo/sai-s-valge.svg (viewBox 0 8 25.2 41.6), inline so the mark can be written in and filled. */
const S_PATH = "M12.339752906976743 8.860015443313955Q14.991815043604651 8.915829396802323 17.70779206031977 9.097674418604651Q20.423769077034883 9.279519440406979 23.03621911337209 9.645008175872093L22.825567768895347 11.353615552325579Q20.342746184593025 11.200576853197674 17.688885356104652 11.075445130813954Q15.035024527616278 10.950313408430233 12.397365552325581 10.950313408430233Q9.876730559593023 10.950313408430233 8.06637445494186 11.110553688226744Q6.256018350290697 11.270793968023256 5.079421784156976 11.987375090843024Q3.9028252180232554 12.703956213662792 3.3599881904069764 14.31806413517442Q2.8171511627906973 15.93217205668605 2.8171511627906973 18.83990734011628Q2.8171511627906973 22.80810773982558 4.147685773982558 24.560851199127907Q5.478220385174419 26.313594658430233 8.584002543604651 26.80331577034884L16.93629632994186 28.177053052325583Q21.235769440406976 28.823410247093022 22.965102652616277 31.184697492732557Q24.69443586482558 33.54598473837209 24.69443586482558 38.46661973110465Q24.69443586482558 41.85686773255814 23.920242096656974 43.90127861555233Q23.14604832848837 45.945689498546514 21.645373819040696 46.951240007267444Q20.144699309593022 47.956790515988374 17.895939316860463 48.29257358284884Q15.647179324127906 48.6283566497093 12.671039244186046 48.6283566497093Q10.483489280523255 48.6283566497093 7.64868277616279 48.502325581395354Q4.813876271802325 48.3762945130814 1.1409611191860467 47.899177870639534L1.3516124636627902 46.176167332848834Q3.775009084302325 46.329206031976746 5.597962845203488 46.412926962209305Q7.420916606104651 46.496647892441864 9.09983875363372 46.51735328851744Q10.77876090116279 46.538058684593025 12.755659520348837 46.538058684593025Q16.29355014534884 46.496647892441864 18.389278252180233 45.94660928415698Q20.485006359011628 45.39657067587209 21.431145530523256 43.66363326671512Q22.377284702034885 41.93069585755814 22.377284702034885 38.43781340843023Q22.377284702034885 35.584093386627906 21.792137536337208 33.94207848837209Q21.20699037063953 32.30006359011628 19.890858920784883 31.451149164244185Q18.574727470930235 30.602234738372093 16.403379360465117 30.294358648255812L8.007876090116278 28.90621820494186Q3.9046511627906977 28.30127180232558 2.202325581395349 25.864364553052326Q0.5 23.42745730377907 0.5 18.81110101744186Q0.5 15.37944222383721 1.2327829760174418 13.362938317587208Q1.9655659520348836 11.346434411337206 3.4176280886627906 10.355287063953487Q4.8696902252906975 9.364139716569767 7.110349291424418 9.09137218386628Q9.35100835755814 8.818604651162794 12.339752906976743 8.860015443313955Z";
const RING_MAX = 24; // more would read as a band, not as dots
const RING_R = 30;
const STEP_IN = 4.5;
const NBSP = String.fromCharCode(0xa0);

/* One dot per source found; the chosen ones spread round the ring (never bunched at the top) and step inward. */
function ringDots(total, picked) {
  const count = Math.min(Math.max(total || 0, 0), RING_MAX);
  const picks = Math.min(Math.max(picked, 0), count);
  const order = new Map();
  for (let k = 0; k < picks; k += 1) {
    let at = Math.floor((k * count) / picks + 1 + (k % 2) * 0.5) % count;
    while (order.has(at)) at = (at + 1) % count;
    order.set(at, k);
  }
  return Array.from({ length: count }, (_, i) => {
    const angle = ((i * 360) / count - 90) * (Math.PI / 180);
    const cos = Math.cos(angle), sin = Math.sin(angle);
    return {
      i,
      x: (RING_R * cos).toFixed(2),
      y: (RING_R * sin).toFixed(2),
      dx: `${(-cos * STEP_IN).toFixed(2)}px`,
      dy: `${(-sin * STEP_IN).toFixed(2)}px`,
      pick: order.has(i) ? order.get(i) : null,
    };
  });
}

/* One line that crossfades. Every line the turn reached stays mounted under its own key: the current one fades in, the
   earlier ones fade up and out of the flow (CSS), so the box always has the current line's height. */
function Lines({ className, lines, quiet = false }) {
  const current = lines.length ? lines[lines.length - 1].key : null;
  return (
    <span className={className}>
      {lines.map(({ key, text }) => (key === current
        ? <span key={key} className="hs-line" data-on="1" aria-hidden={quiet ? "true" : undefined}>{text}</span>
        : <span key={key} className="hs-line" aria-hidden="true">{text}</span>))}
    </span>
  );
}

export default function WaitBreathingS({ view, texts, map }) {
  // useId may hold characters an SVG url(#...) reference does not take.
  const uid = `hs${useId().replace(/[^\w-]/g, "")}`;
  const stage = view.stageIndex;
  const chosenCount = view.chosen ? view.chosen.titles.length + view.chosen.more : 0;
  // The ring counts sources; without a found step (late or lost) the chosen ones are all it knows.
  const total = view.found ? (view.found.sources ?? view.found.passages) : chosenCount;
  const dots = view.found || view.chosen ? ringDots(total, chosenCount) : [];
  // A no-break space before each dot: a line may wrap after a separator, never before one.
  const chosenList = view.chosen ? [...view.chosen.titles, texts.more].filter(Boolean).join(`${NBSP}· `) : "";

  const captions = [
    { key: "reading", text: texts.reading },
    stage >= 1 ? { key: "searching", text: texts.searching } : null,
    stage >= 2 ? { key: "choosing", text: texts.choosing } : null,
    view.chosen ? { key: "chosen", text: texts.chosen } : null,
    stage >= 3 ? { key: "writing", text: texts.writing } : null,
  ].filter(Boolean);
  const details = [
    stage >= 1 && view.topic ? { key: "topic", text: view.topic } : null,
    texts.found ? { key: "found", text: texts.found } : null,
    chosenList ? { key: "chosen", text: chosenList } : null,
  ].filter(Boolean);
  // The caption that only repeats the status line (PilotWait's role=status) is not read out twice.
  const captionRepeats = captions[captions.length - 1].text === texts.current;

  return (
    <>
      <div className="hs-head" data-filled={stage >= 1 ? "1" : undefined} data-chosen={view.chosen ? "1" : undefined}>
        <span className="hs-mark" aria-hidden="true">
          <span className="hs-glow" />
          {dots.length ? (
            <span className="hs-ring">
              <svg viewBox="-38 -38 76 76" focusable="false">
                {dots.map(dot => (
                  <g key={dot.i} className="hs-dot" style={{ "--i": dot.i, "--p": dot.pick ?? 0, "--dx": dot.dx, "--dy": dot.dy }}>
                    <g className="hs-dot-move" data-pick={dot.pick != null ? "1" : undefined}>
                      <circle cx={dot.x} cy={dot.y} r="1.75" />
                    </g>
                  </g>
                ))}
              </svg>
            </span>
          ) : null}
          <span className="hs-s">
            <svg viewBox="-38 -38 76 76" focusable="false">
              <defs>
                <linearGradient id={`${uid}-draw-g`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#fff" />
                  <stop offset="0.82" stopColor="#fff" />
                  <stop offset="1" stopColor="#fff" stopOpacity="0" />
                </linearGradient>
                <linearGradient id={`${uid}-rise-g`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#fff" stopOpacity="0" />
                  <stop offset="0.14" stopColor="#fff" />
                  <stop offset="1" stopColor="#fff" />
                </linearGradient>
                {/* The outline is written top to bottom and the fill rises from below: both are masks that move
                    (transform only), so the S itself never changes shape. */}
                <mask id={`${uid}-draw`} maskUnits="userSpaceOnUse" x="-4" y="0" width="34" height="60">
                  <rect className="hs-draw" x="-4" y="4" width="34" height="56" fill={`url(#${uid}-draw-g)`} />
                </mask>
                <mask id={`${uid}-rise`} maskUnits="userSpaceOnUse" x="-4" y="0" width="34" height="60">
                  <rect className="hs-rise" x="-4" y="1" width="34" height="52" fill={`url(#${uid}-rise-g)`} />
                </mask>
              </defs>
              <g transform="translate(-12.6 -28.8)">
                <path className="hs-fill" d={S_PATH} mask={`url(#${uid}-rise)`} />
                <path className="hs-trace" d={S_PATH} mask={`url(#${uid}-draw)`} />
              </g>
            </svg>
          </span>
        </span>
        <span className="hs-status">
          <Lines className="hs-cap" lines={captions} quiet={captionRepeats} />
          <Lines className="hs-det" lines={details} />
        </span>
      </div>
      {map ? <div className="hs-map">{map}</div> : null}
    </>
  );
}
