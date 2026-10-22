"use client";

/* ADR-176, design 1 "Märkmik": the answer's card as a notebook page. A soft pen writes the steps the server really
   took, one line at a time: small glyphs in the margin, the topic underlined, the sources found as tally marks, the
   chosen ones as small paper notes, and the place on the shared map (it replaces the mockup's hand-drawn pin). A line
   exists only when its step's data is there, so a step that comes late, out of order or not at all (a greeting has no
   plan) never leaves a line hanging. The fold and the answer are PilotWaitSummary's. */
import { Fragment, useEffect, useState } from "react";
import { tr } from "./waitView";

/* After this long (p90 of a turn) the page says plainly that this one takes longer. */
const SLOW_AFTER_MS = 28000;
/* The pen's pauses: the margin mark goes down just before its line; the underline and the map get a moment of their
   own before the pen moves on; the notes are laid down one by one and settle. */
const GLYPH_LEAD_MS = 160;
const UNDERLINE_LEAD_MS = 260;
const MAP_LEAD_MS = 450;
const NOTE_FIRST_MS = 120;
const NOTE_STEP_MS = 170;
const NOTE_SETTLE_MS = 520;
const TALLY_MAX = 25;
const NOTE_TILT = Object.freeze([-1.6, 1.1, -0.7, 0.9, -1.2]);
const NOTE_LIFT = Object.freeze(["0em", "0.12em", "-0.04em", "0.08em", "0.02em"]);

const LOUPE = (
  <svg className="pilot-nb__mark" viewBox="0 0 16 16" focusable="false">
    <path d="M11.2 6.9C11.2 9.3 9.3 11.1 7 11C4.7 10.9 2.9 9 3 6.7C3.1 4.4 5 2.7 7.3 2.8C9.5 2.9 11.2 4.7 11.2 6.9Z" />
    <path d="M10.3 10.4L14.2 14.4" />
  </svg>
);
const PEN = (
  <svg className="pilot-nb__mark" viewBox="0 0 16 16" focusable="false">
    <path d="M2.9 13.2L3.5 10.5L11.1 2.9C11.7 2.3 12.7 2.3 13.2 2.9C13.8 3.5 13.8 4.4 13.2 5L5.6 12.6Z" />
    <path d="M10.1 4L12.1 6" />
  </svg>
);

/* How long the pen takes over a text: by its length, within a calm range. */
const penMs = text => Math.min(1150, Math.max(420, String(text || "").length * 30));

/* "Loen küsimust…" -> ["Loen küsimust", "…"]: the dots fade once the step is done, the words stay. */
function splitDots(text) {
  const match = /^(.*?)(\s*(?:…|\.\.\.))$/su.exec(text || "");
  return match ? [match[1], match[2]] : [text || "", ""];
}

/* The sources found as tally marks in fives, as one counts on paper; past 25 the count trails off. */
function tallyMarks(count) {
  const shown = Math.min(count, TALLY_MAX);
  const groups = [];
  let at = 0;
  for (let first = 0; first < shown; first += 5) {
    const size = Math.min(5, shown - first);
    const strokes = [];
    for (let index = 0; index < Math.min(4, size); index += 1) {
      strokes.push({ tilt: ((((first / 5) * 7 + index * 3) % 7) - 3) * 0.9, at }); // a hand's small wobble
      at += 70;
    }
    groups.push({ strokes, strike: size === 5 ? at : null });
    if (size === 5) at += 110;
  }
  return { groups, more: count > shown, ms: groups.length ? at + 240 : 0 };
}

/* The pen writes one line at a time, in the order the steps came (their own times, ms since the question was sent).
   A step's lines start when it arrived or when the pen is free, whichever is later: steps that arrive together are
   written one after the other, a step that arrives after a long search is written at once. Every line gets its delay
   after its step arrived, which is when the line appears; the pen rests after the last one. */
function penSchedule(steps, busy) {
  const arrived = [];
  let previous = 0;
  steps.forEach((step, index) => {
    const at = Number.isFinite(step.at) ? step.at : previous; // a step without a time comes right after the one before
    previous = at;
    const keys = step.keys.filter(key => key && busy[key] != null);
    if (keys.length) arrived.push({ at, index, keys });
  });
  arrived.sort((a, b) => a.at - b.at || a.index - b.index);
  const delays = {};
  let free = 0;
  let latest = 0;
  for (const step of arrived) {
    let offset = Math.max(0, free - step.at);
    for (const key of step.keys) {
      delays[key] = offset;
      offset += busy[key];
    }
    free = step.at + offset;
    latest = Math.max(latest, step.at);
  }
  return { delays, rest: Math.max(0, free - latest), count: arrived.length };
}

/* A notebook line. Its delay is taken once, when the line first appears, so a later step never moves a line that is
   already written. */
function Line({ kind, delay, done = false, glyph = null, children }) {
  const [start] = useState(delay);
  return (
    <div className="pilot-nb__line" data-line={kind} data-done={done ? "true" : undefined}
      style={{ "--d": `${Math.round(start)}ms` }}>
      <span className="pilot-nb__margin" aria-hidden="true">{glyph}</span>
      <div className="pilot-nb__text">{children}</div>
    </div>
  );
}

/* Words written by the pen: a window opens from the left with a soft ink edge and the nib rides on it. Transform
   only: the window moves in, the words move the same amount back, so they stand still while they appear. */
function Ink({ text, offset = 0, children }) {
  return (
    <span className="pilot-nb__ink" style={{ "--o": `${Math.round(offset)}ms`, "--wd": `${penMs(text)}ms` }}>
      <span className="pilot-nb__clip">
        <span className="pilot-nb__sweep">
          <span className="pilot-nb__words">{children ?? text}</span>
          <i className="pilot-nb__nib" aria-hidden="true" />
        </span>
      </span>
    </span>
  );
}

/* A margin mark drawn by the same pen (the S from the top down, as it is written). */
function Glyph({ down = false, children }) {
  return (
    <span className="pilot-nb__glyph" data-down={down ? "true" : undefined}>
      <span className="pilot-nb__glyph-sweep">{children}</span>
    </span>
  );
}

function Tally({ marks, offset }) {
  return (
    <span className="pilot-nb__tally" aria-hidden="true" style={{ "--o": `${Math.round(offset)}ms` }}>
      {marks.groups.map((group, index) => (
        <span key={index} className="pilot-nb__five">
          {group.strokes.map((stroke, n) => (
            <span key={n} style={{ "--t": `${stroke.tilt.toFixed(1)}deg`, "--s": `${stroke.at}ms` }} />
          ))}
          {group.strike != null ? <span data-strike="true" style={{ "--s": `${group.strike}ms` }} /> : null}
        </span>
      ))}
      {marks.more ? <span className="pilot-nb__tally-more">…</span> : null}
    </span>
  );
}

/* "36 lõiku 18 allikast": the numbers carry the line, in any language's order. */
const strongNumbers = text => String(text).split(/(\d+)/).map((part, index) => (
  index % 2 ? <b key={index}>{part}</b> : <Fragment key={index}>{part}</Fragment>
));

export default function WaitNotebook({ t, view, texts, map }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    // The one clock on the page: a plain note when the wait is long, counted from when the card appeared.
    const timer = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const [readWords, readDots] = splitDots(texts.reading);
  const [searchWords, searchDots] = splitDots(texts.searching);
  const [writeWords, writeDots] = splitDots(texts.writing);
  const place = texts.places.filter(Boolean).join(" · ");
  const slowText = slow ? tr(t, "chat.pilot_wait.slow", "Võtab tavalisest kauem.") : null;
  const sources = view.found?.sources ?? 0;
  const marks = tallyMarks(sources);
  const notes = view.chosen
    ? [...view.chosen.titles.map(text => ({ text, more: false })), ...(texts.more ? [{ text: texts.more, more: true }] : [])]
    : [];
  const writing = view.stage === "writing";
  // The plan implies the search has started; without a plan, the first result that came implies it.
  const planned = view.stage === "searching" || view.at.plan != null || Boolean(view.topic) || view.places.length > 0;
  const searchWith = planned ? "plan" : view.found ? "found" : view.chosen ? "chosen" : null;

  const busy = {
    read: GLYPH_LEAD_MS + penMs(readWords),
    topic: view.topic ? penMs(view.topic) + UNDERLINE_LEAD_MS : null,
    place: place ? penMs(place) + (map ? MAP_LEAD_MS : 0) : null,
    search: GLYPH_LEAD_MS + penMs(searchWords),
    count: view.found ? penMs(texts.found) + Math.min(600, marks.ms * 0.35) : null,
    notes: notes.length ? NOTE_FIRST_MS + notes.length * NOTE_STEP_MS + NOTE_SETTLE_MS : null,
    compose: GLYPH_LEAD_MS + penMs(writeWords),
    slow: slowText ? penMs(slowText) : null,
  };
  const pen = penSchedule([
    { at: 0, keys: ["read"] },
    { at: view.at.plan, keys: planned ? ["topic", "place", "search"] : [] },
    { at: view.at.found, keys: view.found ? [searchWith === "found" && "search", "count"] : [] },
    { at: view.at.chosen, keys: view.chosen ? [searchWith === "chosen" && "search", "notes"] : [] },
    { at: view.at.writing, keys: writing ? ["compose"] : [] },
    { at: SLOW_AFTER_MS, keys: slowText ? ["slow"] : [] },
  ], busy);
  const at = pen.delays;
  // A step is done once a later one is there: the search when results came, the place and the count when the reading
  // was chosen.
  const searched = Boolean(view.found || view.chosen) || writing;
  const settled = Boolean(view.chosen) || writing;

  return (
    <div className="pilot-nb">
      <Line key="read" kind="read" delay={at.read} done={view.stageIndex > 0}
        glyph={<Glyph down><span className="pilot-nb__s" /></Glyph>}>
        <Ink text={readWords} offset={GLYPH_LEAD_MS}>
          {readWords}{readDots ? <span className="pilot-nb__dots">{readDots}</span> : null}
        </Ink>
      </Line>

      {at.topic != null ? (
        <Line key="topic" kind="topic" delay={at.topic}>
          <span className="pilot-nb__topic">
            <Ink text={view.topic} />
            <span className="pilot-nb__underline" aria-hidden="true" style={{ "--o": `${penMs(view.topic)}ms` }}>
              <span>
                <svg viewBox="0 0 200 10" preserveAspectRatio="none" focusable="false">
                  <path d="M1.5 6.2C30 3.6 62 4.4 96 5.4C130 6.4 166 5.2 198.5 3.4" />
                </svg>
              </span>
            </span>
          </span>
        </Line>
      ) : null}

      {at.place != null ? (
        <Line key="place" kind="place" delay={at.place} done={settled}>
          <Ink text={place} />
          {/* The written name says the place; the map beside it only shows where. */}
          {map ? <div className="pilot-nb__map" aria-hidden="true" style={{ "--o": `${penMs(place)}ms` }}>{map}</div> : null}
        </Line>
      ) : null}

      {at.search != null ? (
        <Line key="search" kind="search" delay={at.search} done={searched} glyph={<Glyph>{LOUPE}</Glyph>}>
          <Ink text={searchWords} offset={GLYPH_LEAD_MS}>
            {searchWords}{searchDots ? <span className="pilot-nb__dots">{searchDots}</span> : null}
          </Ink>
        </Line>
      ) : null}

      {at.count != null ? (
        <Line key="count" kind="count" delay={at.count} done={settled}>
          <Ink text={texts.found}>{strongNumbers(texts.found)}</Ink>
          {sources > 0 ? <Tally marks={marks} offset={penMs(texts.found)} /> : null}
        </Line>
      ) : null}

      {at.notes != null ? (
        <Line key="notes" kind="notes" delay={at.notes}>
          <span className="sr-only">{texts.chosen}: </span>
          <div className="pilot-nb__notes">
            {notes.map((note, index) => (
              <span key={`${index}:${note.text}`} className="pilot-nb__note" data-more={note.more ? "true" : undefined}
                style={{
                  "--r": `${NOTE_TILT[index % NOTE_TILT.length]}deg`,
                  "--y": NOTE_LIFT[index % NOTE_LIFT.length],
                  "--o": `${NOTE_FIRST_MS + index * NOTE_STEP_MS}ms`,
                }}>
                <span className="pilot-nb__paper">{note.text}</span>
                <span className="pilot-nb__ear" aria-hidden="true" />
              </span>
            ))}
          </div>
        </Line>
      ) : null}

      {at.compose != null ? (
        <Line key="compose" kind="compose" delay={at.compose} glyph={<Glyph>{PEN}</Glyph>}>
          <Ink text={writeWords} offset={GLYPH_LEAD_MS}>
            {writeWords}{writeDots ? <span className="pilot-nb__dots">{writeDots}</span> : null}
          </Ink>
        </Line>
      ) : null}

      {at.slow != null ? (
        <Line key="slow" kind="slow" delay={at.slow}>
          <Ink text={slowText} />
        </Line>
      ) : null}

      {/* The pen rests on the next line until the next step comes; a new step starts it again after its lines. */}
      <Line key={`pen:${pen.count}`} kind="pen" delay={pen.rest}>
        <span className="pilot-nb__rest" aria-hidden="true"><span /><span /><span /><span /></span>
      </Line>
    </div>
  );
}
