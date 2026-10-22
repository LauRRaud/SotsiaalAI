"use client";

/* ADR-176, waiting design 2 "Hingav S": the S mark, whole and solid (owner 22.10: no outline that fills, no glow around
   it, no ring of dots: "see S las pöörleb, ei ole vaja neid täppe"), turns through the turn as the platform's own S
   does. One caption crossfades beside it, with the topic and place under it. Below, the text first: one quiet line
   turns through the facts the server reported for this question (the records and passages of the platform, the
   documents in scope, the municipality's records, the sources chosen), in the order they came. Then the pictures, one
   thing at a time: a lens over a shelf while the search runs, then the sources found as small pages being read, then
   the chosen material as a list. When the question has a place they lie on its map, which stays the whole wait and
   fades under them (owner 22.10: the map that vanished left a gap). Everything else is derived from the props on each
   render, so a step that arrives late or never only leaves its part out. */
import { useEffect, useState } from "react";

/* public/logo/sai-s-valge.svg (viewBox 0 8 25.2 41.6), inline so it takes the text colour. */
const S_PATH = "M12.339752906976743 8.860015443313955Q14.991815043604651 8.915829396802323 17.70779206031977 9.097674418604651Q20.423769077034883 9.279519440406979 23.03621911337209 9.645008175872093L22.825567768895347 11.353615552325579Q20.342746184593025 11.200576853197674 17.688885356104652 11.075445130813954Q15.035024527616278 10.950313408430233 12.397365552325581 10.950313408430233Q9.876730559593023 10.950313408430233 8.06637445494186 11.110553688226744Q6.256018350290697 11.270793968023256 5.079421784156976 11.987375090843024Q3.9028252180232554 12.703956213662792 3.3599881904069764 14.31806413517442Q2.8171511627906973 15.93217205668605 2.8171511627906973 18.83990734011628Q2.8171511627906973 22.80810773982558 4.147685773982558 24.560851199127907Q5.478220385174419 26.313594658430233 8.584002543604651 26.80331577034884L16.93629632994186 28.177053052325583Q21.235769440406976 28.823410247093022 22.965102652616277 31.184697492732557Q24.69443586482558 33.54598473837209 24.69443586482558 38.46661973110465Q24.69443586482558 41.85686773255814 23.920242096656974 43.90127861555233Q23.14604832848837 45.945689498546514 21.645373819040696 46.951240007267444Q20.144699309593022 47.956790515988374 17.895939316860463 48.29257358284884Q15.647179324127906 48.6283566497093 12.671039244186046 48.6283566497093Q10.483489280523255 48.6283566497093 7.64868277616279 48.502325581395354Q4.813876271802325 48.3762945130814 1.1409611191860467 47.899177870639534L1.3516124636627902 46.176167332848834Q3.775009084302325 46.329206031976746 5.597962845203488 46.412926962209305Q7.420916606104651 46.496647892441864 9.09983875363372 46.51735328851744Q10.77876090116279 46.538058684593025 12.755659520348837 46.538058684593025Q16.29355014534884 46.496647892441864 18.389278252180233 45.94660928415698Q20.485006359011628 45.39657067587209 21.431145530523256 43.66363326671512Q22.377284702034885 41.93069585755814 22.377284702034885 38.43781340843023Q22.377284702034885 35.584093386627906 21.792137536337208 33.94207848837209Q21.20699037063953 32.30006359011628 19.890858920784883 31.451149164244185Q18.574727470930235 30.602234738372093 16.403379360465117 30.294358648255812L8.007876090116278 28.90621820494186Q3.9046511627906977 28.30127180232558 2.202325581395349 25.864364553052326Q0.5 23.42745730377907 0.5 18.81110101744186Q0.5 15.37944222383721 1.2327829760174418 13.362938317587208Q1.9655659520348836 11.346434411337206 3.4176280886627906 10.355287063953487Q4.8696902252906975 9.364139716569767 7.110349291424418 9.09137218386628Q9.35100835755814 8.818604651162794 12.339752906976743 8.860015443313955Z";
const PAGES_MAX = 8; // one row on the map (owner 22.10: "neid vähemaks, ühte ritta"); the label keeps the true count
const SEARCH_PAGES = 8; // the shelf the lens passes over while the search runs (no count is known yet)
const NBSP = String.fromCharCode(0xa0);
const FACT_MS = 3200; // how long one fact stays before the next
const PLANNING_MS = 1200; // how long "Loen küsimust…" stands before the plan's own caption

/* Whether the turn has been reading its question for a while: the search plan is being written then (owner 22.10:
   "„Loen küsimust...“ on mõnikord veidi pikalt ees, midagi muud ka panna?"). */
function usePlanning(reading) {
  const [planning, setPlanning] = useState(false);
  useEffect(() => {
    if (!reading) return undefined;
    const timer = setTimeout(() => setPlanning(true), PLANNING_MS);
    return () => { clearTimeout(timer); setPlanning(false); };
  }, [reading]);
  return reading && planning;
}

/* One fact at a time, in the order they came (the platform's records first), the line turning through all of them. */
function useFact(facts) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (facts.length < 2) return undefined;
    const timer = setInterval(() => setShown(index => (index + 1) % facts.length), FACT_MS);
    return () => clearInterval(timer);
  }, [facts.length]);
  return facts.length ? facts[Math.min(shown, facts.length - 1)] : null;
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
  const stage = view.stageIndex;
  const fact = useFact(texts.facts || []);
  const planning = usePlanning(stage === 0);
  // Below the head, one thing at a time (owner 22.10: "liiga kaardikeskne"): the search (faint pages and a lens passing
  // over them, no count yet), then the sources found as small pages, then the chosen ones, read in turn, with how many
  // they are. No titles: "seda ei jõua niikuinii lugeda. Lihtsalt mitu faili kasutati" (owner 22.10).
  const searching = stage === 1;
  const chosenCount = view.chosen ? view.chosen.titles.length + view.chosen.more : 0;
  const pages = Math.min(Math.max(view.chosen ? chosenCount : view.found ? view.found.sources ?? view.found.passages ?? 0 : 0, 0), PAGES_MAX);
  const pagesLabel = view.chosen ? texts.chosenCount : texts.found;
  // A place an earlier message gave says so.
  const places = texts.earlier ? texts.places.map(place => `${place} (${texts.earlier})`) : texts.places;
  const about = [view.topic, ...places].filter(Boolean).join(`${NBSP}· `);

  const captions = [
    { key: "reading", text: texts.reading },
    planning || stage >= 1 ? { key: "planning", text: texts.planning } : null,
    stage >= 1 ? { key: "searching", text: texts.searching } : null,
    stage >= 2 ? { key: "choosing", text: texts.choosing } : null,
    view.chosen ? { key: "chosen", text: texts.chosen } : null,
    stage >= 3 ? { key: "writing", text: texts.writing } : null,
  ].filter(Boolean);
  const details = [stage >= 1 && about ? { key: "about", text: about } : null].filter(Boolean);
  // The caption that only repeats the status line (PilotWait's role=status) is not read out twice.
  const captionRepeats = captions[captions.length - 1].text === texts.current;

  return (
    <>
      <div className="hs-head">
        <span className="hs-mark" aria-hidden="true">
          <span className="hs-s">
            <svg viewBox="-30 -30 60 60" focusable="false">
              <g transform="translate(-12.6 -28.8)">
                <path className="hs-fill" d={S_PATH} />
              </g>
            </svg>
          </span>
        </span>
        <span className="hs-status">
          <Lines className="hs-cap" lines={captions} quiet={captionRepeats} />
          {details.length ? <Lines className="hs-det" lines={details} /> : null}
        </span>
      </div>
      {/* The facts right under the head, the pictures under them: the line keeps its place when the material below
          grows (owner 22.10: the page icons "enne teksti või all pool, kaardi üleval"). */}
      {fact ? (
        <div className="hs-facts" aria-hidden="true">
          <span key={fact.key} className="hs-fact">{fact.text}</span>
        </div>
      ) : null}
      {/* With a place, the pictures lie on the map, which fades under them (owner 22.10: "ikoonirida isegi luubi ja
          dokumentidega eesti kaardi peal"); without one they stand alone. */}
      {map || searching || pages ? <div className="hs-scene" data-map={map ? "1" : undefined}>
        {/* Its lines fade under the pages; the pin stays. */}
        {map ? <div className="hs-map" data-quiet={view.found || view.chosen ? "1" : undefined}>{map}</div> : null}
        {searching || pages ? <div className="hs-stage">
          {searching ? (
            <div className="hs-search" key="search" aria-hidden="true">
              <span className="hs-shelf">
                <span className="hs-page-row">
                  {Array.from({ length: SEARCH_PAGES }, (_, i) => <span key={i} className="hs-page hs-page--dim" style={{ "--i": i }} />)}
                </span>
                <span className="hs-lens" />
              </span>
              <span className="hs-pages-label">{NBSP}</span>
            </div>
          ) : null}
          {pages ? (
            <div className="hs-pages" key={view.chosen ? "chosen" : "found"} data-chosen={view.chosen ? "1" : undefined}>
              <span className="hs-page-row" aria-hidden="true">
                {Array.from({ length: pages }, (_, i) => <span key={i} className="hs-page" style={{ "--i": i }} />)}
              </span>
              {pagesLabel ? <span className="hs-pages-label">{pagesLabel}</span> : null}
            </div>
          ) : null}
        </div> : null}
      </div> : null}
    </>
  );
}
