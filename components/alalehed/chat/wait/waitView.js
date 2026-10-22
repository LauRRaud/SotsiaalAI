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
    // What the platform holds and what this question searches, for the facts the waiting view turns through.
    corpus: count(scope?.corpus?.documents) ? { documents: scope.corpus.documents, passages: count(scope.corpus.passages) } : null,
    knowledge: count(scope?.knowledge?.documents) ? { documents: scope.knowledge.documents, passages: count(scope.knowledge.passages) } : null,
    records: count(scope?.records?.total) || count(records?.catalogue)
      ? { total: count(scope?.records?.total), region: count(scope?.records?.region), catalogue: count(records?.catalogue), listed: count(records?.listed) }
      : null,
    found: Number.isInteger(found?.passages) ? { passages: found.passages, sources: Number.isInteger(found.sources) ? found.sources : null } : null,
    chosen: chosen && Array.isArray(chosen.titles)
      ? { titles: chosen.titles.filter(title => typeof title === "string" && title).slice(0, 12), more: Number.isInteger(chosen.more) ? chosen.more : 0,
        passages: Number.isInteger(chosen.passages) ? chosen.passages : null,
        // ADR-180: the sources are the answer before's own, read again for the provisions asked about (no search).
        previous: chosen.previous === true }
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

/* Whether the topic names the place: a word of it starts with the place's first word ("Harku vald" in "Harku valla
   koduteenus", "Tallinn" in "Tallinna sotsiaaltransport"), as a case ending changes only the end. */
function inTopic(topic, name) {
  const stem = String(name || "").split(" ")[0].toLocaleLowerCase("et");
  if (!topic || stem.length < 3) return false;
  return topic.toLocaleLowerCase("et").split(/[\s,.;:()«»"]+/).some(word => word.startsWith(stem));
}

/* Interface text with a fallback, as the chat's other components read it. */
export function tr(t, key, fallback) {
  const value = typeof t === "function" ? t(key) : "";
  return value && value !== key ? value : fallback;
}

/* The texts of each stage, so the designs say the same things in every language. */
export function waitTexts(t, view) {
  // The sources the search found worth reading. The fixed size of the shortlist (36 passages) is never shown: it read as
  // if every answer came from 36 passages (owner 22.10); how much was searched is in the facts line.
  const sources = view.found?.sources ?? null;
  const found = sources == null ? null
    : tr(t, sources === 1 ? "chat.pilot_wait.found_plain_one" : "chat.pilot_wait.found_plain", sources === 1 ? "1 sobiv allikas" : "{sources} sobivat allikat")
      .replace("{sources}", String(sources));
  // Facts the view turns through while waiting (owner 22.10: "võimalikult palju huvitavat infot"), each from a number the
  // server reported for this question, in the order they come.
  const number = value => new Intl.NumberFormat("et-EE").format(value);
  const fill = (text, values) => Object.entries(values).reduce((out, [key, value]) => out.replaceAll(`{${key}}`, value), text);
  const place = view.places.length === 1 && view.places[0].length === 1 ? view.places[0][0].name : null;
  const chosenCount = view.chosen ? view.chosen.titles.length + view.chosen.more : 0;
  // The municipality's records as the records lane read them (its catalogue and the relevant ones), one fact, so the
  // number on screen never changes (the index's own count by region is a wider one).
  const catalogue = view.records?.catalogue ?? null, listed = view.records?.listed ?? null;
  const facts = [
    view.corpus && view.corpus.passages != null ? { key: "corpus", text: fill(tr(t, "chat.pilot_wait.fact_corpus", "Sotsiaal.pro andmebaasis on {documents} allikakirjet ja {passages} otsingulõiku"),
      { documents: number(view.corpus.documents), passages: number(view.corpus.passages) }) } : null,
    view.knowledge && view.knowledge.passages != null ? { key: "knowledge", text: fill(tr(t, "chat.pilot_wait.fact_knowledge", "Selle küsimuse ulatuses {documents} teadmusdokumenti ja {passages} lõiku"),
      { documents: number(view.knowledge.documents), passages: number(view.knowledge.passages) }) } : null,
    view.records?.total ? { key: "records", text: fill(tr(t, "chat.pilot_wait.fact_records", "Omavalitsuste teenuse- ja kontaktikirjeid on kokku {total}"),
      { total: number(view.records.total) }) } : null,
    place && catalogue ? { key: "region", text: fill(tr(t, "chat.pilot_wait.fact_region", "{place}: {listed} asjakohast kirjet {catalogue} seast"),
      { place, listed: number(listed ?? 0), catalogue: number(catalogue) }) } : null,
  ].filter(Boolean);
  // How many sources the answer reads, under their pages (the facts line does not say it twice).
  const chosenText = !chosenCount ? null : chosenCount === 1 ? tr(t, "chat.pilot_wait.fact_chosen_one", "Valitud 1 allikas")
    : fill(tr(t, "chat.pilot_wait.fact_chosen", "Valitud {count} allikat"), { count: number(chosenCount) });
  return {
    facts,
    chosenCount: chosenText,
    reading: tr(t, "chat.pilot_wait.reading", "Loen küsimust…"),
    searching: tr(t, "chat.pilot_wait.searching", "Otsin Sotsiaal.pro andmebaasist…"),
    found,
    choosing: tr(t, "chat.pilot_wait.choosing", "Valin, mida lugeda…"),
    chosen: view.chosen?.previous ? tr(t, "chat.pilot_wait.chosen_previous", "Vaatan eelmise vastuse allikaid…")
      : tr(t, "chat.pilot_wait.chosen", "Valisin lugemiseks"),
    more: view.chosen?.more ? tr(t, "chat.pilot_wait.more", "+{n}").replace("{n}", String(view.chosen.more)) : null,
    writing: tr(t, "chat.pilot_wait.writing", "Kirjutan vastust…"),
    // The detail line writes the topic and the place; a place the topic already names ("Harku valla koduteenus") is not
    // written twice (owner 22.10). Both of two municipalities a shared name may be still are, as that is news.
    places: view.places.filter(names => !(names.length === 1 && inTopic(view.topic, names[0].name))).map(names => placeText(t, names)),
    earlier: view.earlier ? tr(t, "chat.pilot_wait.earlier", "varasemast") : null,
    current: view.stage === "writing" ? tr(t, "chat.pilot_wait.writing", "Kirjutan vastust…")
      : view.stage === "choosing" ? tr(t, "chat.pilot_wait.choosing", "Valin, mida lugeda…")
        : view.stage === "searching" ? tr(t, "chat.pilot_wait.searching", "Otsin Sotsiaal.pro andmebaasist…")
          : tr(t, "chat.pilot_wait.reading", "Loen küsimust…"),
  };
}

