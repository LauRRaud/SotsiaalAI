#!/usr/bin/env node

const DEFAULT_BASE_URL = "http://127.0.0.1:8000";
const DEFAULT_TOP_K = 12;
const DEFAULT_TIMEOUT_MS = 30_000;

// Kõik väited on kontrollitud vastava kohaliku PDF-i lehekülgedelt. Värav ei
// rahuldu sellega, et õiged sõnad leiduvad eri dokumentides: ühe oodatud
// dokumendi tagastatud lõigud peavad koos katma kogu küsimuse.
const CASES = [
  {
    id: "research_methods_2026",
    query: "Millist uurimismeetodit ja andmekogumisviisi kasutati täisealiste psüühikahäirega inimeste uuringus, millal uuring tehti ning kui palju inimesi osales?",
    expectedDocIds: [
      "epikoda-taisealiste-psuuhikahairega-eestkostetavate-uuring-2026",
      "epikoda-taisealiste-psuuhikahairega-eestkostetavate-uuring-luhikokkuvote-2026"
    ],
    facts: [
      ["november 2025 kuni märts 2026", /november\s+2025[^.]{0,80}märts\s+2026/iu],
      ["kvalitatiivne uurimus", /kvalitatiiv(?:ne|se)\s+uurim/iu],
      ["poolstruktureeritud individuaal- ja grupiintervjuud", /poolstruktureeritud[^.]{0,100}individuaal[^.]{0,80}grupiintervjuu/iu],
      ["42 inimest", /(?:tagasiside|intervjueeriti)[^.]{0,100}42\s+inimest|42\s+inimese\s+tagasiside/iu]
    ]
  },
  {
    id: "research_recommendations_2026",
    query: "Mida soovitas EPIKoda Tallinnale kindla kontaktisiku, ennetava abi, dubleerivate hindamiste ja eestkoste alternatiivi kohta?",
    expectedDocIds: [
      "epikoda-taisealiste-psuuhikahairega-eestkostetavate-uuring-luhikokkuvote-2026",
      "epikoda-taisealiste-psuuhikahairega-eestkostetavate-uuring-2026"
    ],
    facts: [
      ["üks kindel kontaktisik", /üks\s+kindel\s+kontaktisik/iu],
      ["proaktiivne ja ennetav abi", /proaktiivseks\s+ja\s+ennetavaks/iu],
      ["vältida dubleerivaid hindamisi", /vältides?\s+dubleerivaid\s+hindamisi/iu],
      ["toetatud otsustamine", /toetatud\s+otsustamise/iu]
    ]
  },
  {
    id: "guideline_trauma_aware_2025",
    query: "Mida soovitab terviseprobleemiga laste hea tava teha enne tundliku teema käsitlemist, millist keelt kasutada ning kuidas suhtuda pere elukogemusse ja emotsionaalsetesse reaktsioonidesse?",
    expectedDocIds: ["sm-terviseprobleemiga-laste-perede-hea-tava-2025"],
    facts: [
      ["küsi pere valmisolekut", /küsi[bd]?[^.]{0,100}pere\s+valmisolekut/iu],
      ["neutraalne ja toetav keel", /neutraalset\s+ja\s+toetavat\s+keelt/iu],
      ["austa elukogemust", /pead\s+lugu\s+inimese\s+elukogemusest/iu],
      ["ära katkesta ega suru ennast peale", /ei\s+katkesta[^.]{0,100}ega\s+suru\s+ennast\s+peale/iu]
    ]
  },
  {
    id: "fire_safety_response",
    query: "Mida teha enne tulekahjukahtlusega ruumi sisenemist, kellele tulekahjust helistada, millega alustada, millal tohib kustutada ja mida teha lahkudes uksega?",
    expectedDocIds: [
      "paasteamet-hoolekande-ja-tervishoiuasutuste-tuleohutus",
      "paasteamet_hoolekande_ja_tervishoiuasutuste_tuleohutus_pdf"
    ],
    facts: [
      ["kontrolli ust enne sisenemist", /enne\s+ruumi\s+sisenemist[^.]{0,180}katsudes\s+ust/iu],
      ["helista 112", /helista[^.]{0,80}\b112\b/iu],
      ["alusta evakueerimist", /alusta\s+inimeste\s+evakueerimisega/iu],
      ["kustuta ainult oskuse ja võimaluse korral", /kustuta\s+ainult[^.]{0,100}oskad[^.]{0,80}võimalik/iu],
      ["lahkudes sulge uks", /lahku\s+ruumist[^.]{0,80}sulge[^.]{0,80}uks/iu]
    ]
  },
  {
    id: "school_mental_health_danger",
    query: "Mida peab õpetaja tegema, kui õpilase muutunud käitumise taga võib olla vahetu oht või oht kodus?",
    expectedDocIds: [
      "peaasi-ee-koolilaste-ja-noorte-vaimne-tervis",
      "peaasi_ee_koolilaste_ja_noorte_vaimne_tervis"
    ],
    facts: [
      ["vahetu ohu korral 112", /oht\s+on\s+hetkeolukorras[^.]{0,100}\b112\b/iu],
      ["kutsu kolleeg või teine õpilane", /kutsu\s+appi[^.]{0,100}(?:kolleeg|teine\s+õpilane)/iu],
      ["ära jäta noort üksi", /ära\s+jäta\s+üksinda\s+noort/iu],
      ["kodus oleva ohu korral lastekaitse või 116111", /oht[^.]{0,100}kodus[^.]{0,220}(?:lastekaitse|116\s*111)/iu]
    ]
  },
  {
    id: "sexual_violence_crisis_centre",
    query: "Kellele, kui kiiresti ja millistel tingimustel annavad seksuaalvägivalla kriisiabikeskused abi ning millist abi sealt saab?",
    expectedDocIds: [
      "ska-seksuaalvagivalla-kriisiabikeskusi-tutvustav-voldik-est",
      "sotsiaalkindlustusamet_seksuaalvagivalla_kriisiabikeskusi_tutvustav_voldik_est"
    ],
    facts: [
      ["kuni 7 päeva pärast juhtunut", /kuni\s+7\s+päeva\s+peale\s+juhtunut/iu],
      ["abi sõltumata vanusest või soost", /sõltumata\s+vanusest\s+või\s+soost/iu],
      ["saatekirja ei ole vaja", /saatekirja[^.]{0,40}pole\s+vaja/iu],
      ["politseisse pöördumine ei ole kohustuslik", /politseisse\s+pöördumine[^.]{0,60}ei\s+ole\s+kohustuslik/iu],
      ["tugi, meditsiiniabi ja tõendite kogumine", /toetus[^.]{0,160}meditsiiniline\s+abi[^.]{0,180}tõendite\s+kogumine/iu]
    ]
  },
  {
    id: "parent_conversation_worksheet",
    query: "Kuidas soovitab Tarkvanema tööleht algkoolilapsega vestlust alustada ja pärast küsimuse esitamist käituda?",
    expectedDocIds: [
      "tarkvanem-tooleht-abikusimused-vestluseks-algkoolilapsega",
      "tarkvanem_tooleht_abikusimused_vestluseks_algkoolilapsega"
    ],
    facts: [
      ["esita avatud küsimusi", /esita\s+avatud\s+küsimusi/iu],
      ["laps saab mõtteid vabalt väljendada", /mõtteid\s+vabalt\s+väljendada/iu],
      ["kuula ja ole kohal", /lihtsalt\s+kuula[^.]{0,60}ole\s+kohal/iu],
      ["hoidu hinnangutest", /hoidu\s+hinnangutest/iu]
    ]
  },
  {
    id: "education_adjustments_2022",
    query: "Mis vahe on õpitulemuste vähendamisel, asendamisel ja kohustuslikust õppeainest vabastamisel ning mida peab kool vabastamise korral tegema?",
    expectedDocIds: [
      "harno-opitulemuste-vahendamine-asendamine-ja-oppeainest-vabastamine",
      "harno_opitulemuste_vahendamine_asendamine_ja_kohustusliku_oppeaine"
    ],
    facts: [
      ["vähendamine pärast järjepidevat individuaalset tuge", /vähendamine[^.]{0,260}järjepide\s*[-–]?\s*vale[^.]{0,100}individuaalsele\s+toele/iu],
      ["asendamine ühe õppeaine raames", /asenda\s*[-–]?\s*mine\s+toimub\s+ühe\s+õppeaine\s+raames/iu],
      ["vabastamine on äärmuslik sekkumine", /vabastamine\s+on\s+äärmuslik\s+sekkumine/iu],
      ["enne peavad muud tugimeetmed olema proovitud", /teised[^.]{0,100}tugimeetmed[^.]{0,120}ei\s+ole\s+andnud/iu],
      ["märge ei olnud õppekavas", /ei\s+olnud\s+õppekavas/iu]
    ]
  },
  {
    id: "child_report_privacy_2021",
    query: "Kas abivajavast lapsest võib teatada anonüümselt, kas nime peab ütlema, kellele teatada, millised piirangud anonüümsusega kaasnevad ja millal pöörduda politseisse?",
    expectedDocIds: ["oiguskantsler_juhend_abivajavast_lapsest_teatamine_ja_andmekaitse"],
    facts: [
      ["võib jääda anonüümseks", /teataja\s+võib\s+jääda\s+anonüümseks/iu],
      ["ei pea ütlema nime", /ei\s+pea\s+ütlema\s+oma\s+nime/iu],
      ["anonüümsus võib kahjustada usaldusväärsust", /anonüümsuse\s+tõttu[^.]{0,100}usaldusväärsus/iu],
      ["teata vallale, linnale või 116111", /valla-?\s*või\s+linnavalitsusele[^.]{0,160}116\s*111/iu],
      ["vajadusel politseile", /vajadusel\s+politseile/iu]
    ]
  },
  {
    id: "oska_care_workers_2025",
    query: "Milliseid arvulisi muutusi tõi OSKA 2025 seire välja hooldustöötajate palga, töötajate arvu, hooldekodude nõuete täitmise ja riikliku täienduskoolituse tellimuse kohta?",
    expectedDocIds: ["oska_sotsiaaltoo_seirearuanne_2025"],
    facts: [
      ["palk tõusis 16%", /palk[^.]{0,100}tõusnud?[^.]{0,80}16\s*%|tõusnud?[^.]{0,100}palk[^.]{0,80}16\s*%/iu],
      ["töötajate arv kasvas 18%", /töötajate(?:\s+ja\s+abihooldajate)?\s+arv[^.]{0,100}kasvanud?\s*18\s*%/iu],
      ["68% hooldekodudest täitis nõudeid", /68\s*%\s*hooldekodudest/iu],
      ["nõuded jõustuvad 01.07.2026", /(?:jõustuvad?\s+01[.]07[.]2026|alates\s+01[.]07[.]2026[^.]{0,80}kehtima)/iu],
      ["95 koolitust ja ligikaudu 1750 osalejat", /95\s+koolitust[^.]{0,160}1750\s*osalejale/iu]
    ]
  }
];

function parseArgs(argv = []) {
  const args = {
    baseUrl: process.env.RAG_QUALITY_BASE_URL || process.env.RAG_API_BASE || DEFAULT_BASE_URL,
    apiKey: process.env.RAG_SERVICE_API_KEY || process.env.RAG_API_KEY || "",
    topK: Number(process.env.RAG_QUALITY_TOP_K || DEFAULT_TOP_K),
    timeoutMs: Number(process.env.RAG_QUALITY_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
    caseIds: [],
    denseOnly: false,
    debug: false,
    json: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--base-url") args.baseUrl = argv[++index] || args.baseUrl;
    else if (arg === "--api-key") args.apiKey = argv[++index] || "";
    else if (arg === "--top-k") args.topK = Number(argv[++index]);
    else if (arg === "--timeout-ms") args.timeoutMs = Number(argv[++index]);
    else if (arg === "--case") args.caseIds.push(argv[++index] || "");
    else if (arg === "--dense-only") args.denseOnly = true;
    else if (arg === "--debug") args.debug = true;
    else if (arg === "--json") args.json = true;
    else if (arg === "--help" || arg === "-h") {
      console.log("Usage: node scripts/rag-material-fact-quality-gate.mjs [--base-url URL] [--top-k 12] [--timeout-ms 30000] [--case ID] [--dense-only] [--debug] [--json]");
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  if (!args.apiKey.trim()) throw new Error("RAG_SERVICE_API_KEY or RAG_API_KEY is required");
  if (!Number.isInteger(args.topK) || args.topK < 1 || args.topK > 50) throw new Error("top-k must be an integer from 1 to 50");
  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs < 1000) throw new Error("timeout-ms must be at least 1000");
  const unknownCases = args.caseIds.filter(id => !CASES.some(testCase => testCase.id === id));
  if (unknownCases.length) throw new Error(`Unknown case: ${unknownCases.join(", ")}`);
  return args;
}

function documentKey(item = {}, index = 0) {
  return String(
    item.doc_id || item.docId || item.document_id || item.documentId ||
    item.source_id || item.sourceId || item.title || `result-${index}`
  ).trim();
}

function groupDocuments(results = []) {
  const groups = new Map();
  results.forEach((item, index) => {
    const key = documentKey(item, index);
    const group = groups.get(key) || {
      key,
      title: String(item.title || "").trim() || null,
      sourceType: String(item.source_type || item.legacy_source_type || "").trim() || null,
      ranks: [],
      items: []
    };
    group.ranks.push(index + 1);
    group.items.push(item);
    groups.set(key, group);
  });
  return [...groups.values()].map(group => ({
    ...group,
    text: group.items
      .map(item => String(item.chunk || item.document || item.text || ""))
      .join("\n\n")
      .normalize("NFC")
  }));
}

function scoreGroup(group, testCase) {
  const checks = testCase.facts.map(([label, pattern]) => ({ label, ok: pattern.test(group.text) }));
  return {
    ...group,
    expected: testCase.expectedDocIds.includes(group.key),
    checks,
    matched: checks.filter(check => check.ok).length,
    total: checks.length
  };
}

async function runCase(testCase, args) {
  const startedAt = performance.now();
  const response = await fetch(`${args.baseUrl.replace(/\/+$/u, "")}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": args.apiKey },
    body: JSON.stringify({
      query: testCase.query,
      top_k: args.topK,
      journal_chunks_per_document: 8,
      retrievers: args.denseOnly ? ["dense"] : ["dense", "title_match", "exact_phrase", "bm25"]
    }),
    signal: AbortSignal.timeout(args.timeoutMs)
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`${testCase.id}: HTTP ${response.status} ${raw.slice(0, 300)}`);
  const payload = JSON.parse(raw);
  const scored = groupDocuments(Array.isArray(payload.results) ? payload.results : [])
    .map(group => scoreGroup(group, testCase))
    .sort((left, right) => Number(right.expected) - Number(left.expected) || right.matched - left.matched || Math.min(...left.ranks) - Math.min(...right.ranks));
  const best = scored.find(group => group.expected) || scored[0] || {
    key: null, title: null, sourceType: null, ranks: [], items: [], checks: [], matched: 0, total: testCase.facts.length, expected: false
  };
  return {
    id: testCase.id,
    ok: best.expected && best.matched === best.total,
    elapsedMs: Math.round(performance.now() - startedAt),
    serviceMs: Number(payload?.timings?.total_ms) || null,
    resultCount: Array.isArray(payload.results) ? payload.results.length : 0,
    partial: payload.partial === true,
    lexicalScan: payload?.retrieval?.lexical_scan || payload?.lexical_scan || null,
    bestDocument: {
      key: best.key,
      title: best.title,
      sourceType: best.sourceType,
      expected: best.expected,
      ranks: best.ranks,
      matched: best.matched,
      total: best.total,
      missing: best.checks.filter(check => !check.ok).map(check => check.label),
      ...(args.debug ? {
        chunkIndexes: best.items.map(item => item.chunk_index ?? item.chunkIndex ?? null),
        chunkIds: best.items.map(item => item.chunk_id || item.chunkId || item.id || null),
        candidates: best.items.map(item => ({
          id: item.chunk_id || item.chunkId || item.id || null,
          chunkIndex: item.chunk_index ?? item.chunkIndex ?? null,
          factSegmentRanks: item.fact_segment_ranks || null,
          factSegmentLexicalRanks: item.fact_segment_lexical_ranks || null,
          retrievalChannels: item.retrieval_channels || null,
          excerpt: String(item.chunk || item.document || item.text || "").slice(0, 500)
        }))
      } : {})
    }
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const selectedCases = args.caseIds.length
    ? CASES.filter(testCase => args.caseIds.includes(testCase.id))
    : CASES;
  const results = [];
  for (const testCase of selectedCases) {
    try {
      results.push(await runCase(testCase, args));
    } catch (error) {
      results.push({ id: testCase.id, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
  const passed = results.filter(result => result.ok).length;
  const summary = { ok: passed === results.length, passed, total: results.length, results };
  if (args.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    for (const result of results) {
      const status = result.ok ? "PASS" : "FAIL";
      const detail = result.error
        ? result.error
        : `${result.bestDocument.matched}/${result.bestDocument.total} facts; doc=${result.bestDocument.key || "-"}; ranks=${result.bestDocument.ranks.join(",") || "-"}; ${result.elapsedMs} ms`;
      console.log(`${status} ${result.id}: ${detail}`);
      if (!result.ok && result.bestDocument?.missing?.length) console.log(`  missing: ${result.bestDocument.missing.join(", ")}`);
    }
    console.log(`SUMMARY ${passed}/${results.length}`);
  }
  if (!summary.ok) process.exitCode = 1;
}

await main();
