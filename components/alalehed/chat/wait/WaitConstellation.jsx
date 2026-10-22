"use client";

/* ADR-176, design 4 "Tähtkuju": a small constellation in the answer's card. The S stands in the centre; every passage
   the search found is a soft point of light, grouped by its source; the sources the selection reads light up and
   connect with thin lines into the S, as the knowledge graph behind the answers does. Everything is derived from the
   server's steps on each render, so a step that comes late, out of order or not at all only changes what is lit.
   The fold and the answer belong to PilotWaitSummary. Styles: app/styles/chat-wait-4.css. */
import { useEffect, useMemo, useRef, useState } from "react";
import { tr } from "./waitView";

// Caps keep a phone to a few dozen small layers; the caption keeps the real counts.
const MAX_GROUPS = 20;
const MAX_STARS = 40;
const MAX_PER_GROUP = 4;
// Spacing is judged on the mockup's wide card (its sky's radii in px), so a narrow card draws the same sky tighter.
const NOM_X = 310;
const NOM_Y = 58;
// One turn of the selection's light and where its brightest edge starts (27° from the top = -63° from the right).
// chat-wait-4.css turns it in the same 6 s after the same 1.1 s, so each star glints as the light passes over it.
const BEAM_S = 6;
const BEAM_PEAK = 63;
// The first text's p90 (median 21.7 s): only after that do we say it takes longer.
const SLOW_MS = 28000;

const px = value => `${value.toFixed(1)}px`;
const sec = value => `${value.toFixed(2)}s`;
const deg = (y, x) => `${((Math.atan2(y, x) * 180) / Math.PI).toFixed(1)}deg`;

function seeded(seed) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mix = Math.imul(state ^ (state >>> 15), 1 | state);
    mix = (mix + Math.imul(mix ^ (mix >>> 7), 61 | mix)) ^ mix;
    return ((mix ^ (mix >>> 14)) >>> 0) / 4294967296;
  };
}

/* Where the groups and their points sit, from the counts alone: the same search always draws the same sky, and the
   selection only lights groups that are already there. Without a found step the chosen sources are the whole sky. */
function skyModel(passages, sources, chosenCount, chosenPassages) {
  const fromChosen = passages == null;
  const points = fromChosen ? chosenPassages ?? chosenCount : passages;
  const groupsWanted = fromChosen ? chosenCount : sources ?? Math.ceil(points / 2);
  if (!(points > 0 && groupsWanted > 0)) return null;
  const groupCount = Math.min(MAX_GROUPS, groupsWanted, points);
  const starCount = Math.min(groupCount * MAX_PER_GROUP, Math.max(groupCount, Math.min(MAX_STARS, points)));
  const random = seeded(points * 131 + groupsWanted * 17 + 81);
  const groups = [];
  let gap = 46;
  for (let tries = 0; groups.length < groupCount; tries += 1) {
    if (tries > 300) {
      gap *= 0.88;
      tries = 0;
    }
    const u = random() * 2 - 1, v = random() * 2 - 1, reach = Math.hypot(u, v);
    // A ring around the S, never in the column the S and its glow stand in.
    if (reach < 0.4 || reach > 0.98 || (Math.abs(u) < 0.2 && Math.abs(v) < 0.85)) continue;
    if (groups.some(group => Math.hypot((group.u - u) * NOM_X, (group.v - v) * NOM_Y) < gap)) continue;
    groups.push({ u, v, size: 1 });
  }
  for (let left = starCount - groupCount; left > 0;) {
    const group = groups[Math.floor(random() * groupCount)];
    if (group.size < MAX_PER_GROUP) {
      group.size += 1;
      left -= 1;
    }
  }
  groups.forEach(group => {
    group.points = [{ ox: 0, oy: 0 }];
    for (let k = 1; k < group.size; k += 1) {
      let ox = 0, oy = 0;
      for (let tries = 0; tries < 60; tries += 1) {
        const turn = random() * Math.PI * 2, distance = 7 + random() * 6;
        ox = Math.cos(turn) * distance;
        oy = Math.sin(turn) * distance * 0.75;
        if (!group.points.some(point => Math.hypot(point.ox - ox, point.oy - oy) < 6.5)) break;
      }
      group.points.push({ ox, oy });
    }
    group.twinkle = 3 + random() * 2.8;
    group.twinkleAt = -random() * 4;
    group.jitter = random();
  });
  return { id: `${fromChosen ? "c" : "f"}${points}/${groupsWanted}`, fromChosen, groups };
}

/* The chosen sources' groups, spread round the S like the mockup's: one group nearest each of `count` even turns,
   preferring groups neither at the S nor at the edge. rank = the source's place in the step's list. */
function chosenRanks(model, count) {
  const ranks = new Map();
  if (!model || !(count > 0)) return ranks;
  const take = Math.min(count, model.groups.length);
  if (model.fromChosen) {
    for (let rank = 0; rank < take; rank += 1) ranks.set(rank, rank);
    return ranks;
  }
  const free = model.groups.map((_, index) => index);
  for (let rank = 0; rank < take; rank += 1) {
    const target = -2.6 + (rank * 2 * Math.PI) / take;
    let best = 0, bestCost = Infinity;
    free.forEach((index, at) => {
      const group = model.groups[index], reach = Math.hypot(group.u, group.v);
      const off = Math.abs(((Math.atan2(group.v, group.u) - target + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
      const cost = off + (reach < 0.5 || reach > 0.92 ? 0.6 : 0);
      if (cost < bestCost) {
        bestCost = cost;
        best = at;
      }
    });
    ranks.set(free.splice(best, 1)[0], rank);
  }
  return ranks;
}

/* The model in this card's pixels (the mockup's geometry): points, the lines inside a chosen group, and the rays from
   each chosen group into the S. */
function skyLayout(model, ranks, size) {
  if (!model || !size || size.w < 40 || size.h < 40) return null;
  const rx = size.w / 2 - Math.min(30, size.w * 0.06), ry = size.h / 2 - 15;
  const farthest = Math.hypot(rx, ry), core = Math.min(26, size.h * 0.2);
  const stars = [], links = [], rays = [];
  model.groups.forEach((group, gi) => {
    const rank = ranks.get(gi);
    const points = group.points.map(point => ({ x: group.u * rx + point.ox, y: group.v * ry + point.oy }));
    points.forEach((point, pi) => {
      const turn = (Math.atan2(point.y, point.x) * 180) / Math.PI;
      const hit = (((((turn + BEAM_PEAK) % 360) + 360) % 360) / 360) * BEAM_S;
      stars.push({
        key: `${gi}.${pi}`, x: point.x, y: point.y, rank, first: pi === 0,
        // Nearer points first, as if the search's wave found them.
        appear: (Math.hypot(point.x, point.y) / farthest) * 0.95 + group.jitter * 0.15 + pi * 0.05,
        glint: (hit - 0.05 * BEAM_S + BEAM_S) % BEAM_S,
        twinkle: group.twinkle, twinkleAt: group.twinkleAt - pi * 0.7,
      });
    });
    if (rank === undefined) return;
    for (let k = 1; k < points.length; k += 1) {
      const a = points[k - 1], b = points[k];
      links.push({ key: `${gi}.${k}`, x: a.x, y: a.y, angle: deg(b.y - a.y, b.x - a.x), length: Math.hypot(b.x - a.x, b.y - a.y),
        delay: 0.15 + rank * 0.12 + k * 0.08 });
    }
    const anchor = points[0], reach = Math.hypot(anchor.x, anchor.y), from = Math.min(7, reach);
    rays.push({ key: String(gi), x: anchor.x, y: anchor.y, angle: deg(-anchor.y, -anchor.x), from,
      length: Math.max(0, reach - core - from), travel: Math.max(0, reach - core * 0.7),
      delay: 0.45 + rank * 0.16, pulse: 1.5 + rank * 0.84 });
  });
  return { stars, links, rays };
}

/* The sky's size in pixels, kept as the card changes width (window, phone turned). */
function useBoxSize(ref) {
  const [size, setSize] = useState(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver !== "function") return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize(prev => (prev && Math.abs(prev.w - width) < 0.5 && Math.abs(prev.h - height) < 0.5 ? prev : { w: width, h: height }));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

/* After the first text's p90 the card says once, plainly, that it takes longer: a timer from mount, or at once when a
   step already came that late (the card mounted mid-wait, e.g. after the design was switched). */
function useSlow(at) {
  const [late, setLate] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setLate(true), SLOW_MS);
    return () => clearTimeout(timer);
  }, []);
  return late || Object.values(at || {}).some(ms => Number.isFinite(ms) && ms >= SLOW_MS);
}

/* "Loen küsimust…": the words, then three dots that breathe. The dots are decoration; the status line says it all. */
function Doing({ text }) {
  const value = String(text || "");
  const match = /(…|\.\.\.)\s*$/.exec(value);
  if (!match) return value;
  return (
    <>
      {value.slice(0, match.index)}
      <span className="pw4-dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span>
    </>
  );
}

export default function WaitConstellation({ t, view, texts, map }) {
  const skyRef = useRef(null);
  const size = useBoxSize(skyRef);
  const slow = useSlow(view.at);
  // The chosen-source chip under the pointer: [from, to) of chosen ranks, whose points the sky shows.
  const [lit, setLit] = useState(null);

  const passages = view.found ? view.found.passages : null;
  const sources = view.found ? view.found.sources : null;
  const chosen = view.chosen;
  const hasChosen = Boolean(chosen);
  const chosenCount = chosen ? chosen.titles.length + chosen.more : 0;
  const chosenPassages = chosen ? chosen.passages : null;
  // Keyed on numbers only: the view is a new object on every render.
  const model = useMemo(() => skyModel(passages, sources, chosenCount, chosenPassages), [passages, sources, chosenCount, chosenPassages]);
  const ranks = useMemo(() => chosenRanks(model, hasChosen ? chosenCount : 0), [model, hasChosen, chosenCount]);
  const sky = useMemo(() => skyLayout(model, ranks, size), [model, ranks, size]);

  const writing = view.stage === "writing";
  // The selection's light sweeps while it chooses; once it has chosen, it fades (still turning, so it never jumps).
  const beam = view.found && model ? (chosen ? "fade" : "on") : undefined;
  const isLit = rank => Boolean(lit && rank !== undefined && rank >= lit[0] && rank < lit[1]);

  const topicShown = Boolean(view.topic || texts.places.length);
  const planned = view.at.plan != null;
  const leadKey = topicShown ? `topic:${view.topic || ""}:${texts.places.join("|")}`
    : view.stage === "reading" ? "reading" : planned ? "understood" : null;
  const doing = view.stage === "searching" ? texts.searching
    : view.stage === "writing" ? texts.writing
      : view.stage === "choosing" && !chosen ? texts.choosing : null;
  // After the selection its sources are the latest fact, and what comes next reads under them.
  const second = chosen ? texts.chosen : doing;
  const doingBelow = chosen ? doing : null;
  const titles = chosen ? chosen.titles : [];

  return (
    <>
      <div ref={skyRef} className="pw4-sky" aria-hidden="true" data-beam={beam} data-chosen={chosen ? "1" : undefined}
        data-lit={lit ? "1" : undefined}>
        <span className="pw4-nebula" />
        <span className="pw4-ripples"><span /><span /></span>
        <span className="pw4-ring" />
        <span className="pw4-beam"><span /></span>
        {sky ? (
          <span className="pw4-field" key={model.id}>
            {sky.links.map(link => (
              <span key={link.key} className="pw4-link"
                style={{ "--x": px(link.x), "--y": px(link.y), "--a": link.angle, "--len": px(link.length), "--ld": sec(link.delay) }} />
            ))}
            {sky.rays.map(ray => (
              <span key={ray.key} className="pw4-ray"
                style={{ "--x": px(ray.x), "--y": px(ray.y), "--a": ray.angle, "--from": px(ray.from), "--len": px(ray.length),
                  "--travel": px(ray.travel), "--ld": sec(ray.delay), "--pd": sec(ray.pulse) }}>
                <span className="pw4-ray__line" />
                {writing ? <span className="pw4-ray__pulse" /> : null}
              </span>
            ))}
            {sky.stars.map(star => (
              <span key={star.key} className="pw4-star" data-first={star.first ? "1" : undefined}
                data-chosen={star.rank !== undefined ? "1" : undefined} data-lit={isLit(star.rank) ? "1" : undefined}
                style={{ "--x": px(star.x), "--y": px(star.y), "--ad": sec(star.appear), "--gd": sec(star.glint),
                  "--tw": sec(star.twinkle), "--twd": sec(star.twinkleAt) }}>
                <span className="pw4-star__halo" />
                <span className="pw4-star__core" />
                <span className="pw4-star__ring" />
              </span>
            ))}
          </span>
        ) : null}
        <span className="pw4-core">
          <span className="pw4-glow" />
          <span className="pw4-orbit" />
          <span className="pw4-mark"><span /></span>
        </span>
      </div>

      <div className="pw4-caption">
        <div className="pw4-text">
          {leadKey ? (
            <p className="pw4-lead">
              {topicShown ? (
                <span key={leadKey} className="pw4-in pw4-topicline">
                  {view.topic ? <span className="pw4-topic">{view.topic}</span> : null}
                  {/* The place as text only when the map is not drawn (CSS hides it next to the map). */}
                  {texts.places.map((place, index) => (
                    <span key={`${index}:${place}`} className="pw4-place" data-unsure={view.places[index]?.length > 1 ? "1" : undefined}>{place}</span>
                  ))}
                </span>
              ) : (
                <span key={leadKey} className="pw4-in">
                  {view.stage === "reading" ? <Doing text={texts.reading} /> : texts.understood}
                </span>
              )}
            </p>
          ) : null}
          {texts.found || second ? (
            <p className="pw4-activity">
              {texts.found ? <span key={`found:${texts.found}`} className="pw4-in pw4-fact">{texts.found}</span> : null}
              {second ? (
                <span key={`now:${second}`} className={chosen ? "pw4-in pw4-fact" : "pw4-in"}>
                  {texts.found ? <span className="pw4-sep" aria-hidden="true">·</span> : null}
                  {chosen ? second : <Doing text={second} />}
                </span>
              ) : null}
            </p>
          ) : null}
          {titles.length || texts.more ? (
            <ul className="pw4-sources" aria-label={texts.chosen} onMouseLeave={() => setLit(null)}>
              {titles.map((title, index) => (
                <li key={`${index}:${title}`} className="pw4-src" title={title} style={{ "--sd": sec(0.35 + index * 0.12) }}
                  onMouseEnter={() => setLit([index, index + 1])}>
                  <span className="pw4-src__dot" aria-hidden="true" />
                  <span className="pw4-src__name">{title}</span>
                </li>
              ))}
              {texts.more ? (
                <li key="more" className="pw4-src" data-more="1" style={{ "--sd": sec(0.35 + titles.length * 0.12) }}
                  onMouseEnter={() => setLit([titles.length, chosenCount])}>
                  {texts.more}
                </li>
              ) : null}
            </ul>
          ) : null}
          {doingBelow ? (
            <p className="pw4-activity">
              <span key={`next:${doingBelow}`} className="pw4-in"><Doing text={doingBelow} /></span>
            </p>
          ) : null}
          {slow ? <p className="pw4-note">{tr(t, "chat.pilot_wait.slow", "Võtab tavalisest kauem.")}</p> : null}
        </div>
        {map}
      </div>
    </>
  );
}
