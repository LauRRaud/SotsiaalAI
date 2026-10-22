/* ADR-176: the server's waiting steps ({ kind, ...data, atMs }) as one view every waiting design reads.
   stage is what the turn is doing now:
   reading (question sent) -> searching (plan done, search running) -> choosing (passages found, the selection reads
   them) -> writing (the answer call is out). Each later step implies the earlier ones, so a step that arrives late or
   not at all (a greeting has no plan, a plan may fail) never stalls the view.
   places are where the search looks: the municipality the search uses ('scope'), else what the plan read in the
   message ('plan'). earlier: the search's municipality came from an earlier message, not from this one. */
const STAGES = Object.freeze(["reading", "searching", "choosing", "writing"]);
const placeEntries = entries => Array.isArray(entries) && entries.length
  && entries.every(entry => typeof entry?.region === "string" && typeof entry?.name === "string");

export function waitView(steps = []) {
  const byKind = new Map((Array.isArray(steps) ? steps : []).filter(step => step && typeof step.kind === "string").map(step => [step.kind, step]));
  const plan = byKind.get("plan"), scope = byKind.get("scope"), found = byKind.get("found"), chosen = byKind.get("chosen"), writing = byKind.get("writing");
  const stage = writing ? "writing" : chosen || found ? "choosing" : plan || scope ? "searching" : "reading";
  // Each place: its municipality, or both municipalities a shared name may be ({ region, name } each, region for the map).
  const read = Array.isArray(plan?.places) ? plan.places.filter(placeEntries).slice(0, 2) : [];
  const used = placeEntries(scope?.places) ? scope.places.slice(0, 2) : null;
  const places = used ? [used] : read;
  const earlier = Boolean(used) && !used.some(entry => read.some(entries => entries.some(known => known.region === entry.region)));
  return {
    stage,
    stageIndex: STAGES.indexOf(stage),
    topic: typeof plan?.topic === "string" && plan.topic ? plan.topic : null,
    places,
    earlier,
    found: Number.isInteger(found?.passages) ? { passages: found.passages, sources: Number.isInteger(found.sources) ? found.sources : null } : null,
    chosen: chosen && Array.isArray(chosen.titles)
      ? { titles: chosen.titles.filter(title => typeof title === "string" && title).slice(0, 4), more: Number.isInteger(chosen.more) ? chosen.more : 0,
        passages: Number.isInteger(chosen.passages) ? chosen.passages : null }
      : null,
    at: {
      plan: plan?.atMs ?? null,
      found: found?.atMs ?? null,
      chosen: chosen?.atMs ?? null,
      writing: writing?.atMs ?? null,
    },
  };
}

/* A place as the view writes it: one municipality, or both a shared name may be ("Tartu linn või Tartu vald"). */
export function placeText(t, entries) {
  if (entries.length < 2) return entries[0]?.name || "";
  return tr(t, "chat.pilot_wait.place_or", "{a} või {b}").replace("{a}", entries[0].name).replace("{b}", entries[1].name);
}

/* Interface text with a fallback, as the chat's other components read it. */
export function tr(t, key, fallback) {
  const value = typeof t === "function" ? t(key) : "";
  return value && value !== key ? value : fallback;
}

/* The texts of each stage, so the designs say the same things in every language. */
export function waitTexts(t, view) {
  const found = view.found
    ? tr(t, "chat.pilot_wait.found", "{passages} lõiku {sources} allikast").replace("{passages}", String(view.found.passages)).replace("{sources}", String(view.found.sources ?? "?"))
    : null;
  return {
    reading: tr(t, "chat.pilot_wait.reading", "Loen küsimust…"),
    searching: tr(t, "chat.pilot_wait.searching", "Otsin Sotsiaal.pro andmebaasist…"),
    found,
    choosing: tr(t, "chat.pilot_wait.choosing", "Valin, mida lugeda…"),
    chosen: tr(t, "chat.pilot_wait.chosen", "Valisin lugemiseks"),
    more: view.chosen?.more ? tr(t, "chat.pilot_wait.more", "+{n}").replace("{n}", String(view.chosen.more)) : null,
    writing: tr(t, "chat.pilot_wait.writing", "Kirjutan vastust…"),
    places: view.places.map(names => placeText(t, names)),
    earlier: view.earlier ? tr(t, "chat.pilot_wait.earlier", "varasemast") : null,
    current: view.stage === "writing" ? tr(t, "chat.pilot_wait.writing", "Kirjutan vastust…")
      : view.stage === "choosing" ? tr(t, "chat.pilot_wait.choosing", "Valin, mida lugeda…")
        : view.stage === "searching" ? tr(t, "chat.pilot_wait.searching", "Otsin Sotsiaal.pro andmebaasist…")
          : tr(t, "chat.pilot_wait.reading", "Loen küsimust…"),
  };
}

