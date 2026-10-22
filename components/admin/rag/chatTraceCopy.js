// Texts of the admin's view of a chat turn (/admin/rag/chat-trace), Estonian and English like ragAdminCopy.js.
const ET = {
  list: {
    empty: "Sinu vestlustes ei ole veel pöördeid, mille jälg on alles.",
    scope: "Näidatakse ainult sinu enda vestluste pöördeid, uuemad eespool. Teiste kasutajate vestluste vaatamine on isikuandmete küsimus ja vajab omaniku eraldi otsust.",
    time: "Aeg", question: "Küsimus", kind: "Vastuse liik", state: "Seis", open: "Ava jälg", back: "← Kõik pöörded"
  },
  missing: "Sellist pööret sinu vestlustes ei ole.",
  lean: "Selle pöörde täisaudit on säilitusreegli järgi lahti lastud ({at}). Alles on vastus ja selle allikad; otsingu ja AI päringu üksikasju enam ei ole.",
  noLaneAudit: "See pööre on tehtud enne radade auditit (21.10.2026): kandidaatide skoorid ja väljajäetute põhjused puuduvad, valikumudeli lugemine ja tõendid on alles.",
  sections: {
    question: "1. Küsimus",
    plan: "2. Mida AI otsinguks koostas",
    lanes: "3. Otsingu rajad",
    pool: "4. Kandidaadid, mille valikumudel läbi luges",
    evidence: "5. Mis läks vastuse aluseks ja miks",
    additions: "6. Lisarajad ja väljajäetud",
    answer: "7. Vastus",
    request: "8. Millest AI vastuse kirjutas",
    explain: "9. Kuidas otsing valib (selle pöörde profiili numbrid)",
    cost: "Kulu ja ajad"
  },
  fields: {
    asked: "Küsitud", searchText: "Otsingu tekst", role: "Roll, kellele vastati", language: "Keel", prompt: "Juhise versioon", profile: "Otsinguprofiil",
    plan: "Plaan", generation: "Indeks", state: "Seis", failure: "Miks pööre katkes", time: "Aeg", variants: "Otsinguvariandid (AI kirjutas)", none: "—",
    places: "Kohad", plannedPlaces: "Kohad, mida AI nimetas", person: "Isik", planLanguage: "Keel (AI tuvastas)", failures: "Abikutsete tõrked",
    greeting: "Tervitus: otsingut ei tehtud", thanks: "Tänu: otsingut ei tehtud", assistantQuestion: "Küsimus eelmise vastuse kohta",
    lane: "Rada", laneState: "Seis", refs: "Tõendid", counts: "Kandidaate kanalites", leftOut: "Välja jäetud", coverage: "Kaetus",
    rank: "Koht", pick: "Valikumudel", title: "Pealkiri", lead: "Algus", score: "RRF-skoor", channels: "Kohad kanalites (osa skoorist)",
    reserved: "reservkoht", finalRef: "Paketis", notPicked: "ei valinud", cited: "Vastus viitab", reason: "Miks paketis", source: "Allikas",
    heading: "Pealkirjatee", provision: "Säte", text: "Lõigu tekst", kind: "Liik", blocks: "Vastuse plokid", limitations: "Piirangud",
    clarification: "Täpsustav küsimus", repairs: "Server parandas vastuses", instructions: "Juhis (instructions)", developer: "Rolli tekst (pärast tõendeid)", modelContext: "Tõendid, nagu AI need sai",
    model: "Mudel", reasoning: "Mõtlemise tase", maxOutput: "Vastuse piir (tokenit)", evidenceChars: "Tõendite maht (märki)", records: "Omavalitsuse kirjed", scope: "Piirkonna otsus", work: "tööpiirkond",
    stage: "Samm", input: "Sisend (tokenit)", output: "Väljund (tokenit)", usd: "Kulu (USD)", ms: "Aeg (ms)", phases: "Etapid (ms algusest)"
  },
  stages: { plan: "otsinguplaan", embedding: "vektorid", rerank: "valikumudel", answer: "vastus" },
  reasons: {
    ranked_seed: "järjestatud lõik (otsing + valikumudel)",
    cross_reference: "sama seaduse viide",
    cross_reference_named: "teise seaduse viide",
    question_reference: "küsimuses nimetatud säte",
    companion_provision: "sama asja ütlev seaduse säte (vektori lähedus)",
    list_continuation: "kooloniga lõppeva lõigu järg",
    version_counterpart: "sama sätte teine redaktsioon",
    semantic_dependency: "teadmiskaardi seos",
    structural_expansion: "naaberlõik",
    structured_record: "omavalitsuse kirje",
    service_provider_profile: "teenuseosutaja profiil",
    unknown: "teadmata"
  },
  from: "lõigust {ref}",
  leftOutReasons: {
    final_limit: "kohad täis", document_cap: "ühe dokumendi piir", context_budget: "tokeniruum täis", duplicate_text: "sama tekst juba paketis",
    duplicate_unit: "juba valitud", seed_limit: "järjestatud kohad täis", structural_document_label: "ainult pealkiri või silt"
  },
  channels: { lexical: "sõnaotsing", vector: "vektor (küsimus)", vectorN: "vektor (variant {n})", reserve: "seaduste reserv" },
  additions: {
    cross_references: "Sama seaduse viited", question_references: "Küsimuses nimetatud säted", named_act_references: "Teise seaduse viited",
    companion_provisions: "Sama asja ütlevad säted", list_continuations: "Loetelu järg", dependency_additions: "Teadmiskaardi seosed"
  },
  explain: [
    "AI loeb küsimuse ja eelnevad pöörded ning kirjutab otsinguvariandid (punkt 2). Ta tuvastab ka kohad ja isiku, et valida omavalitsuse kirjed ja kehtivad seaduseredaktsioonid.",
    "Küsimust ja iga varianti otsitakse kahes kanalis: sõnaotsing (eesti keele lemmad) ja vektorotsing (tähenduse lähedus). Kummastki tuleb kuni {candidates} kandidaati.",
    "Kohad liidetakse (RRF): kanali koht k annab 1/(k + {rrf}) punkti korda kanali kaal. Vektorikanali kaal on {vector}, sõnaotsingu kaal {lexical}.",
    "Valikumudel loeb liidetud järjekorrast kuni 30 lõiku (ühest dokumendist kuni {poolPerDocument}) ja lisaks riiklike seaduste reservkohad. Ta jätab alles ainult küsimusse puutuvad, oma järjekorras.",
    "Paketti tuleb kuni {topK} valitud lõiku {contextTokens} tokeni piires. Seejärel lisarajad: sama seaduse viited (kuni {referenceAdditions}), teise seaduse viited ja küsimuses nimetatud säted (kuni {namedActAdditions}, omal kohal), sama asja ütlev säte ja loetelu järg. Lisarajad jagavad {expansionContextTokens} tokenit. Kokku on kuni {finalLimit} lõiku; ühest dokumendist kuni {perDocument}.",
    "Metaandmed (allika liik, väljaandja, kuupäev, kehtivus, omavalitsus) skoori otse ei muuda. Need otsustavad, millised dokumendid otsingusse üldse lähevad (kehtiv redaktsioon, pöörde omavalitsus), ja lähevad vastusele allikakaardina kaasa. Pealkirjatee ja dokumendi pealkiri on iga lõigu otsitava teksti alguses, seega mõjutavad need nii sõna- kui ka vektorotsingut. Lõigud tehakse dokumendi pealkirjade järgi: üks alajaotis on üks või mitu lõiku."
  ]
};

const EN = {
  list: {
    empty: "Your conversations have no turns with a trace left yet.",
    scope: "Only the turns of your own conversations are shown, newest first. Viewing other users' conversations is a personal data question and needs the owner's separate decision.",
    time: "Time", question: "Question", kind: "Answer kind", state: "State", open: "Open trace", back: "← All turns"
  },
  missing: "Your conversations have no such turn.",
  lean: "This turn's full audit was let go by the retention rule ({at}). The answer and its sources are left; the search and the AI request details are gone.",
  noLaneAudit: "This turn was made before the lane audit (21.10.2026): candidate scores and the reasons for leaving candidates out are missing; the selection model's reading and the evidence are there.",
  sections: {
    question: "1. Question", plan: "2. What the AI made of it for the search", lanes: "3. Search lanes", pool: "4. Candidates the selection model read",
    evidence: "5. What the answer was based on, and why", additions: "6. Additional lanes and what was left out", answer: "7. Answer",
    request: "8. What the AI wrote the answer from", explain: "9. How the search selects (this turn's profile numbers)", cost: "Cost and times"
  },
  fields: {
    asked: "Asked", searchText: "Search text", role: "Role answered", language: "Language", prompt: "Prompt version", profile: "Search profile",
    plan: "Plan", generation: "Index", state: "State", failure: "Why the turn stopped", time: "Time", variants: "Search variants (written by the AI)", none: "—",
    places: "Places", plannedPlaces: "Places the AI named", person: "Person", planLanguage: "Language (detected by the AI)", failures: "Assist call failures",
    greeting: "Greeting: no search", thanks: "Thanks: no search", assistantQuestion: "Question about the previous answer",
    lane: "Lane", laneState: "State", refs: "Evidence", counts: "Candidates per channel", leftOut: "Left out", coverage: "Coverage",
    rank: "Place", pick: "Selection model", title: "Title", lead: "Start", score: "RRF score", channels: "Places per channel (share of score)",
    reserved: "reserved place", finalRef: "In packet", notPicked: "not picked", cited: "Answer cites", reason: "Why in the packet", source: "Source",
    heading: "Heading path", provision: "Provision", text: "Passage text", kind: "Kind", blocks: "Answer blocks", limitations: "Limitations",
    clarification: "Clarifying question", repairs: "Repaired by the server", instructions: "Instructions", developer: "Role text (after the evidence)", modelContext: "Evidence as the AI received it",
    model: "Model", reasoning: "Reasoning effort", maxOutput: "Output limit (tokens)", evidenceChars: "Evidence size (characters)", records: "Municipal records", scope: "How the municipality was decided", work: "place of work",
    stage: "Step", input: "Input (tokens)", output: "Output (tokens)", usd: "Cost (USD)", ms: "Time (ms)", phases: "Phases (ms from start)"
  },
  stages: { plan: "search plan", embedding: "vectors", rerank: "selection model", answer: "answer" },
  reasons: {
    ranked_seed: "ranked passage (search + selection model)", cross_reference: "own-act reference", cross_reference_named: "other act's reference",
    question_reference: "provision the question names", companion_provision: "law provision saying the same (vector nearness)",
    list_continuation: "continuation of a passage ending with a colon", version_counterpart: "same provision in the other version",
    semantic_dependency: "knowledge card relation", structural_expansion: "neighbouring passage", structured_record: "municipal record",
    service_provider_profile: "service provider profile", unknown: "unknown"
  },
  from: "from {ref}",
  leftOutReasons: {
    final_limit: "places full", document_cap: "per-document limit", context_budget: "token room full", duplicate_text: "same text already in packet",
    duplicate_unit: "already selected", seed_limit: "ranked places full", structural_document_label: "only a title or label"
  },
  channels: { lexical: "lexical", vector: "vector (question)", vectorN: "vector (variant {n})", reserve: "law reserve" },
  additions: {
    cross_references: "Own-act references", question_references: "Provisions named in the question", named_act_references: "Other acts' references",
    companion_provisions: "Provisions saying the same", list_continuations: "List continuations", dependency_additions: "Knowledge card relations"
  },
  explain: [
    "The AI reads the question and the earlier turns and writes search variants (section 2). It also finds places and the person, to choose the municipality's records and the law versions in force.",
    "The question and each variant are searched in two channels: lexical (Estonian lemmas) and vector (nearness of meaning). Each gives up to {candidates} candidates.",
    "Places are fused (RRF): place k in a channel gives 1/(k + {rrf}) points times the channel's weight. The vector channel weighs {vector}, the lexical one {lexical}.",
    "The selection model reads up to 30 passages of the fused order (at most {poolPerDocument} of one document) plus the reserved places of national laws, and keeps only those that bear on the question, in its own order.",
    "Up to {topK} kept passages enter the packet within {contextTokens} tokens. Then the additional lanes: own-act references (up to {referenceAdditions}), other acts' references and provisions the question names (up to {namedActAdditions}, in places of their own), the provision saying the same and list continuations, sharing {expansionContextTokens} tokens. At most {finalLimit} passages in all, {perDocument} of one document.",
    "Metadata (source type, publisher, date, validity, municipality) does not change a score directly. It decides which documents are searched at all (the version in force, the turn's municipality) and goes to the answer as the source card. The heading path and the document title begin every passage's searched text, so they affect both the lexical and the vector search. Passages follow the document's headings: one subsection is one or more passages."
  ]
};

export function getChatTraceCopy(locale) {
  return String(locale || "").toLowerCase().startsWith("et") ? ET : EN;
}

export function fill(template, values = {}) {
  return String(template).replace(/\{(\w+)\}/g, (match, key) => (values[key] ?? values[key] === 0 ? String(values[key]) : match));
}
