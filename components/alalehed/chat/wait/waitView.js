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
  const records = byKind.get("records");
  const count = value => (Number.isInteger(value) && value >= 0 ? value : null);
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
    // How many documents the search ranked (the shortlist of passages has the same size every time, so it is not shown).
    searched: Number.isInteger(scope?.documents) && scope.documents > 0 ? scope.documents : null,
    // What the platform holds and what this question searches, for the facts the waiting view turns through.
    corpus: count(scope?.corpus?.documents) ? { documents: scope.corpus.documents, passages: count(scope.corpus.passages) } : null,
    knowledge: count(scope?.knowledge?.documents) ? { documents: scope.knowledge.documents, passages: count(scope.knowledge.passages) } : null,
    records: count(scope?.records?.total) || count(records?.catalogue)
      ? { total: count(scope?.records?.total), region: count(scope?.records?.region), catalogue: count(records?.catalogue), listed: count(records?.listed) }
      : null,
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
  // The sources the search found worth reading, among the documents it searched (not the shortlist's fixed 36 passages,
  // which read as if every answer came from 36 passages: owner 22.10).
  const sources = view.found?.sources ?? null;
  const documents = view.searched != null ? new Intl.NumberFormat("et-EE").format(view.searched) : null;
  const found = sources == null ? null
    : (documents
      ? tr(t, sources === 1 ? "chat.pilot_wait.found_one" : "chat.pilot_wait.found", sources === 1 ? "1 sobiv allikas {documents} dokumendi seast" : "{sources} sobivat allikat {documents} dokumendi seast")
      : tr(t, sources === 1 ? "chat.pilot_wait.found_plain_one" : "chat.pilot_wait.found_plain", sources === 1 ? "1 sobiv allikas" : "{sources} sobivat allikat"))
      .replace("{sources}", String(sources)).replace("{documents}", documents ?? "");
  // Facts the view turns through while waiting (owner 22.10: "võimalikult palju huvitavat infot"), each from a number the
  // server reported for this question, in the order they come.
  const number = value => new Intl.NumberFormat("et-EE").format(value);
  const fill = (text, values) => Object.entries(values).reduce((out, [key, value]) => out.replaceAll(`{${key}}`, value), text);
  const place = view.places.length === 1 && view.places[0].length === 1 ? view.places[0][0].name : null;
  const chosenCount = view.chosen ? view.chosen.titles.length + view.chosen.more : 0;
  const regionRecords = view.records?.catalogue ?? view.records?.region ?? null;
  const facts = [
    view.corpus && view.corpus.passages != null ? { key: "corpus", text: fill(tr(t, "chat.pilot_wait.fact_corpus", "Sotsiaal.pro andmebaasis on {documents} allikakirjet ja {passages} otsingulõiku"),
      { documents: number(view.corpus.documents), passages: number(view.corpus.passages) }) } : null,
    view.knowledge && view.knowledge.passages != null ? { key: "knowledge", text: fill(tr(t, "chat.pilot_wait.fact_knowledge", "Selle küsimuse ulatuses {documents} teadmusdokumenti ja {passages} lõiku"),
      { documents: number(view.knowledge.documents), passages: number(view.knowledge.passages) }) } : null,
    view.records?.total ? { key: "records", text: fill(tr(t, "chat.pilot_wait.fact_records", "Omavalitsuste teenuse- ja kontaktikirjeid on kokku {total}"),
      { total: number(view.records.total) }) } : null,
    place && regionRecords ? { key: "region", text: fill(tr(t, "chat.pilot_wait.fact_region", "{place}: {count} omavalitsuse kirjet"),
      { place, count: number(regionRecords) }) } : null,
    view.found?.sources != null ? { key: "shortlist", text: fill(tr(t, "chat.pilot_wait.fact_shortlist", "Lühinimekirjas {passages} lõiku {sources} allikast"),
      { passages: number(view.found.passages), sources: number(view.found.sources) }) } : null,
    view.records?.listed != null && view.records?.catalogue ? { key: "listed", text: fill(tr(t, "chat.pilot_wait.fact_listed", "Asjakohaseid kirjeid {listed} kirjest {catalogue}"),
      { listed: number(view.records.listed), catalogue: number(view.records.catalogue) }) } : null,
    chosenCount ? { key: "chosen", text: chosenCount === 1 ? tr(t, "chat.pilot_wait.fact_chosen_one", "Lugemiseks valitud 1 allikas")
      : fill(tr(t, "chat.pilot_wait.fact_chosen", "Lugemiseks valitud {count} allikat"), { count: number(chosenCount) }) } : null,
  ].filter(Boolean);
  return {
    facts,
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

