"use client";

/* ADR-176 design 3, "Kaardid": reading for you on paper cards inside the assistant's own card. The question lies on a
   card under a soft reading light; blank source cards fan in while the search runs; their lines appear only once the
   count is in, and a light skims each card; the chosen ones keep their titles with a +N stack while the rest fade.
   Every step is read from the props on each render (a step may come late, out of order or never), and the cards'
   places are pure CSS (container units in chat-wait-3.css), so nothing here measures, times or loops. */
import { tr } from "./waitView";

// The desk's pool of source cards; CSS shows as many as the width allows (6-9) and never more than were found.
const POOL = Object.freeze([0, 1, 2, 3, 4, 5, 6, 7, 8]);
// The fan always shows at least six cards, so the chosen ones are taken from those first: they visibly rise out of it.
const PREFER = Object.freeze([1, 3, 4, 0, 2, 5, 6, 7, 8]);
const LINE_TOPS = Object.freeze([1.55, 2.2, 2.85, 3.5, 4.15]);
// The question card has no words to show (the view does not carry them): three lines of ink stand for it.
const QUESTION_LINES = Object.freeze([84, 88, 52]);

// Fixed "random" line lengths per card (the reviewed mockup's seed), so a card looks the same on every render.
function seeded(seed) {
  let value = seed * 9301 + 49297;
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}
const CARD_LINES = Object.freeze(POOL.map(index => {
  const random = seeded(index * 7 + 3);
  const head = 34 + random() * 22;
  return [head, ...LINE_TOPS.map((_, line) => (line === LINE_TOPS.length - 1 ? 34 + random() * 24 : 62 + random() * 20))];
}));

/* What the desk shows, from the data alone: chosen titles, found passages, a running search, or the question. */
function deskMode(view) {
  if (view.chosen?.titles.length) return "chosen";
  if (view.found?.passages > 0) return "found";
  return view.stage === "searching" ? "search" : "question";
}

/* Which pool cards stay as chosen (named, with a title) and which make the +N stack; the rest fade. */
function castRoles(view, count) {
  const roles = new Map();
  if (!view.chosen) return roles;
  const named = view.chosen.titles.length, stacked = Math.min(3, view.chosen.more);
  const visible = Math.min(count, 6);
  const order = [...PREFER.filter(index => index < visible), ...PREFER.filter(index => index >= visible)];
  order.slice(0, named).sort((a, b) => a - b).forEach((index, slot) => roles.set(index, { role: "named", slot }));
  order.slice(named, named + stacked).sort((a, b) => a - b).forEach((index, slot) => roles.set(index, { role: "stack", slot }));
  return roles;
}

/* A step text ending in "…" gets three slowly blinking dots instead (decorative; the words stay readable). */
function Dotted({ text }) {
  if (typeof text !== "string" || !text.endsWith("…")) return text;
  return (
    <>
      {text.slice(0, -1)}
      <span className="pw3-dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span>
    </>
  );
}

function Card({ index, role, slot, title }) {
  const style = { "--i": String(index) };
  if (role === "named") {
    // Column/row for a 2- or 3-column desk; CSS picks the pair the desk's width allows (or 1 or 4 columns).
    Object.assign(style, {
      "--j": String(slot), "--c2": String(slot % 2), "--r2": String(Math.floor(slot / 2)),
      "--c3": String(slot % 3), "--r3": String(Math.floor(slot / 3)), "--tilt": slot % 2 ? "0.5deg" : "-0.7deg",
    });
  }
  if (role === "stack") style["--sk"] = String(slot);
  return (
    <span className="pw3-card" data-role={role} style={style}>
      <span className="pw3-in">
        <span className="pw3-lift">
          <span className="pw3-paper">
            {CARD_LINES[index].map((width, line) => (
              <span key={line} className="pw3-ln" data-head={line === 0 ? "1" : undefined} data-keep={line === LINE_TOPS.length ? "1" : undefined}
                style={{ top: `${line ? LINE_TOPS[line - 1] : 0.72}rem`, width: `${width.toFixed(1)}%`, "--l": String(line) }} />
            ))}
            <span className="pw3-sheen" />
            {role === "named" ? <span className="pw3-ttl">{title}</span> : null}
          </span>
        </span>
      </span>
    </span>
  );
}

export default function WaitCards({ t, view, texts, map }) {
  const mode = deskMode(view);
  const reading = view.stageIndex === 0;
  // The head says what was understood: the topic once the plan has it; "understood" only when a plan step came (a
  // greeting or a failed plan has none), otherwise what the turn is doing.
  const headText = reading ? texts.reading : view.topic || (view.at.plan != null ? texts.understood : texts.current);
  const caption = view.stage === "writing" ? texts.writing
    : mode === "chosen" ? texts.chosen
      : mode === "found" ? texts.found
        : view.stage === "searching" ? texts.searching
          : view.stage === "choosing" ? texts.found || texts.choosing
            : tr(t, "chat.pilot_wait.your_question", "Sinu küsimus");
  // Never more cards on the desk than sources were found.
  const sources = view.found ? view.found.sources ?? view.found.passages : POOL.length;
  const count = Math.max(1, Math.min(POOL.length, sources));
  const roles = castRoles(view, count);
  const titles = view.chosen?.titles || [];
  const deskStyle = { "--k": String(count) };
  if (mode === "chosen") {
    const named = titles.length, last = named - 1;
    Object.assign(deskStyle, {
      "--m": String(named), "--rows2": String(Math.ceil(named / 2)), "--rows3": String(Math.ceil(named / 3)),
      "--lc2": String(last % 2), "--lr2": String(Math.floor(last / 2)), "--lc3": String(last % 3), "--lr3": String(Math.floor(last / 3)),
    });
  }
  return (
    <div className="pw3" data-mode={mode}>
      <div className="pw3-head">
        <span className="pw3-s" aria-hidden="true">
          {/* Keyed by stage: the S turns once each time the work moves on. */}
          <span key={view.stage} className="pw3-s-turn" data-nod={reading ? undefined : "1"}><span className="pw3-s-mark" /></span>
        </span>
        <span key={headText} className="pw3-title" data-kind={!reading && view.topic ? "topic" : "status"}><Dotted text={headText} /></span>
      </div>
      <div className="pw3-body" data-map={map ? "1" : undefined}>
        <div className="pw3-table">
          <div className="pw3-desk" data-mode={mode} aria-hidden="true" style={deskStyle}>
            {/* Always mounted, so it can fade away when the cards are dealt. */}
            <span className="pw3-q">
              <span className="pw3-q-in">
                <span className="pw3-paper">
                  {QUESTION_LINES.map((width, line) => (
                    <span key={line} className="pw3-q-line" style={{ top: `${0.62 + line * 1.3}rem`, width: `${width}%`, "--l": String(line) }}>
                      <span className="pw3-q-light" />
                    </span>
                  ))}
                </span>
              </span>
            </span>
            {mode === "question" ? null : POOL.map(index => {
              const cast = roles.get(index);
              const role = mode !== "chosen" ? "fan" : cast ? cast.role : "rest";
              return <Card key={index} index={index} role={role} slot={cast?.slot ?? 0} title={cast?.role === "named" ? titles[cast.slot] : ""} />;
            })}
            {mode === "chosen" && texts.more ? <span className="pw3-chip"><span>{texts.more}</span></span> : null}
          </div>
          <div key={caption} className="pw3-cap">
            <Dotted text={caption} />
            {mode === "chosen"
              ? <span className="sr-only">{`: ${[...titles, texts.more].filter(Boolean).join(", ")}`}</span>
              : null}
          </div>
        </div>
        {map ? <div className="pw3-map">{map}</div> : null}
      </div>
    </div>
  );
}
