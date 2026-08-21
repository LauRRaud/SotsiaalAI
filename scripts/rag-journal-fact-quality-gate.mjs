#!/usr/bin/env node

const DEFAULT_BASE_URL = "http://127.0.0.1:8000";
const DEFAULT_TOP_K = 12;
const DEFAULT_TIMEOUT_MS = 30_000;

const CASES = [
  {
    id: "2016_mappa",
    query: "Kui sageli peavad MAPPA ümarlauad toimuma ning mitu kohtumist oli artikli järgi toimunud Rakveres, Jõhvis ja Narvas?",
    facts: [
      ["vähemalt kord nelja kuu jooksul", /vähemalt\s+kord\s+nelja\s+kuu\s+jooksul/iu],
      ["Rakveres viis", /Rakvere[^.]{0,180}(?:toimunud\s+viis|viis\s+ümarlauda)/iu],
      ["Jõhvis seitse", /Jõhvi[^.]{0,180}(?:toimunud\s+seitse|seitse\s+MAPPA)/iu],
      ["Narvas viis", /Narva[^.]{0,220}(?:viis|viiel\s+korral)/iu]
    ]
  },
  {
    id: "2017_erihooldekodud",
    query: "Millised kolm osakaalu näitas erihooldekodude elanike kaardistus: kui paljud saaksid hakkama kergemal teenusel, kui paljud vajavad ööpäevaringset juhendamist ja kui paljud pidevaid hooldamistoiminguid?",
    facts: [
      ["25% kergem teenus", /25\s*%[^.]{0,260}kergemal\s+teenusel/iu],
      ["45% ööpäevaringne juhendamine", /45\s*%[^.]{0,180}juhendamist\s+ööpäev/iu],
      ["30% pidevad hooldamistoimingud", /30\s*%[^.]{0,220}pidevalt\s+hooldamistoiminguid/iu]
    ]
  },
  {
    id: "2018_vaimse_tervise_kriis",
    query: "Millal käsitles 2018. aasta vaimse tervise esmaabi artikkel olukorda kriisina ja millistele telefoninumbritele soovitas helistada?",
    facts: [
      ["enese kahjustamise oht", /oht[^.]{0,100}ennast\s+kahjustada/iu],
      ["äärmuslik stress", /äärmuslikku\s+stressi/iu],
      ["teisi tugevalt häiriv käitumine", /käitumine[^.]{0,100}tugevalt\s+häiriv/iu],
      ["hädaabinumber 112", /\b112\b/u],
      ["perearsti nõuandeliin 1220", /\b1220\b/u]
    ]
  },
  {
    id: "2019_perepesad",
    query: "Millistes kolmes omavalitsuses avati Perepesad ja millised olid nende neli põhiülesannet?",
    facts: [
      ["Põltsamaa", /Põltsamaa/iu],
      ["Türi", /Türi/iu],
      ["Viljandi", /Viljandi/iu],
      ["kogukondlik kooskäimise koht", /kogukondlik\s+kooskäimise\s+koht/iu],
      ["ennetustöö nõuandekeskus", /nõuandekeskus\s+ennetustööks/iu],
      ["multidistsiplinaarne võrgustikutöö", /multidistsiplinaarset\s+võrgustikutööd/iu],
      ["teenuste mõju ja kvaliteet", /teenuste\s+mõju\s+ja\s+kvaliteeti/iu]
    ]
  },
  {
    id: "2020_taastav_oigus",
    query: "Kui palju spetsialiste ja riike osales taastava õiguse pandeemiaaegsetel Euroopa veebikohtumistel ning kui palju inimesi ja riike osales neljal kohtumisel aprillist juulini?",
    facts: [
      ["30 spetsialisti", /30\s+spetsialisti/iu],
      ["12 riiki", /12\s+riigist/iu],
      ["60 inimest", /60\s+inimest/iu],
      ["19 riiki", /19\s+riigist/iu]
    ]
  },
  {
    id: "2021_teenusmaja",
    query: "Mitu ligipääsetavat korterit nägi vanemaealiste teenusmaja kontseptsioon ette ning mida näitas 16 omavalitsuse küsitlus nende rajamisplaanide kohta?",
    facts: [
      ["12–30 korterit", /12\s*[–-]\s*30[^.]{0,100}korterit/iu],
      ["12 arengukavas", /12\s+kohaliku\s+omavalitsuse\s+arengukavas/iu],
      ["kõik kavatsesid avada", /kõik\s+vastanud\s+omavalitsused\s+plaanivad[^.]{0,100}avada/iu]
    ]
  },
  {
    id: "2022_seltsilised",
    query: "Kui palju inimesi, vabatahtlikke, töötunde, maakondi ja omavalitsusi hõlmas vabatahtlike seltsiliste esimene katseetapp aastatel 2018–2020?",
    facts: [
      ["678 inimest", /678[^.\n]{0,100}inimest/iu],
      ["273 vabatahtlikku", /273\s+vabatahtlikku/iu],
      ["21 600 tundi", /21\s*600\s+tundi/iu],
      ["12 maakonda", /12\s+maakonnas/iu],
      ["43 omavalitsust", /43\s+omavalitsuses/iu]
    ]
  },
  {
    id: "2023_hoolduskoormus",
    query: "Kui suur osa hooldajatest tundis 2022. aasta hoolduskoormuse uuringus, et vajab täiendavat abi, kui suur osa vajas mõne tegevuse juures palju abi ning kui suur osa kuulus suure ja keskmise abivajadusega riskirühma?",
    facts: [
      ["61% täiendav abi", /61\s*%[^.]{0,100}täiendavat\s+abi/iu],
      ["26% palju abi", /26\s*%[^.]{0,140}palju\s+abi/iu],
      // Alglauses on „riskirühma” kahe osakaalu ühine lõpp:
      // „11% ... suure ning 18% ... keskmise abivajadusega riskirühma”.
      ["11% suur riskirühm", /11\s*%[^.]{0,260}suure[^.]{0,260}riskirühma/iu],
      ["18% keskmine riskirühm", /18\s*%[^.]{0,130}keskmise[^.]{0,80}riskirühma/iu]
    ]
  },
  {
    id: "2024_kiusamine",
    query: "Kui suur osa Eesti 11–15-aastastest õpilastest oli 2022. aasta andmetel kogenud viimastel kuudel koolikiusamist ja kui paljud korduvalt? Kui suured olid vastavad näitajad küberkiusamise puhul?",
    facts: [
      ["33% koolikiusamine", /33\s*%/iu],
      ["13% korduv koolikiusamine", /13\s*%[^.]{0,140}korduvalt/iu],
      ["19% küberkiusamine", /19\s*%[^.]{0,160}küberkiusamist/iu],
      ["7% korduv küberkiusamine", /7\s*%[^.]{0,160}küberkiusamist[^.]{0,100}korduvalt|korduvalt[^.]{0,100}7\s*%/iu]
    ]
  },
  {
    id: "2025_dementsuse_ennetus",
    query: "Mida soovitas 2025. aasta dementsuse ennetamise artikkel nädalase liikumise ja ööune kohta ning mitu korda suurem on dementsuse risk kuulmislangusega inimesel?",
    facts: [
      ["150 minutit mõõdukat liikumist", /150\s+minutit\s+mõõdukat/iu],
      ["75 minutit intensiivset liikumist", /75\s+minutit\s+intensiivset/iu],
      ["7–8 tundi und", /seitse\s*[–-]\s*kaheksa\s+tundi/iu],
      ["2–5 korda suurem risk", /2\s*[–-]\s*5\s+korda\s+suurem\s+risk/iu]
    ]
  }
];

function parseArgs(argv = []) {
  const args = {
    baseUrl: process.env.RAG_QUALITY_BASE_URL || process.env.RAG_API_BASE || DEFAULT_BASE_URL,
    apiKey: process.env.RAG_SERVICE_API_KEY || process.env.RAG_API_KEY || "",
    topK: Number(process.env.RAG_QUALITY_TOP_K || DEFAULT_TOP_K),
    journalDepth: Number(process.env.RAG_QUALITY_JOURNAL_DEPTH || 8),
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
    else if (arg === "--journal-depth") args.journalDepth = Number(argv[++index]);
    else if (arg === "--timeout-ms") args.timeoutMs = Number(argv[++index]);
    else if (arg === "--case") args.caseIds.push(argv[++index] || "");
    else if (arg === "--dense-only") args.denseOnly = true;
    else if (arg === "--debug") args.debug = true;
    else if (arg === "--json") args.json = true;
    else if (arg === "--help" || arg === "-h") {
      console.log("Usage: node scripts/rag-journal-fact-quality-gate.mjs [--base-url URL] [--top-k 12] [--journal-depth 8] [--timeout-ms 30000] [--case ID] [--dense-only] [--debug] [--json]");
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  if (!args.apiKey.trim()) throw new Error("RAG_SERVICE_API_KEY or RAG_API_KEY is required");
  if (!Number.isInteger(args.topK) || args.topK < 1 || args.topK > 50) throw new Error("top-k must be an integer from 1 to 50");
  if (!Number.isInteger(args.journalDepth) || args.journalDepth < 1 || args.journalDepth > 12) throw new Error("journal-depth must be an integer from 1 to 12");
  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs < 1000) throw new Error("timeout-ms must be at least 1000");
  const unknownCases = args.caseIds.filter(id => !CASES.some(testCase => testCase.id === id));
  if (unknownCases.length) throw new Error(`Unknown case: ${unknownCases.join(", ")}`);
  return args;
}

function articleKey(item = {}, index = 0) {
  return String(
    item.doc_id ||
    item.docId ||
    item.article_id ||
    item.articleId ||
    item.source_id ||
    item.sourceId ||
    item.title ||
    `result-${index}`
  ).trim();
}

function articleText(items = []) {
  return items.map(item => String(item.chunk || item.document || item.text || "")).join("\n\n").normalize("NFC");
}

function groupArticles(results = []) {
  const groups = new Map();
  results.forEach((item, index) => {
    const key = articleKey(item, index);
    const existing = groups.get(key) || {
      key,
      title: String(item.title || "").trim() || null,
      ranks: [],
      items: []
    };
    existing.ranks.push(index + 1);
    existing.items.push(item);
    groups.set(key, existing);
  });
  return [...groups.values()].map(group => ({
    ...group,
    text: articleText(group.items)
  }));
}

function scoreGroup(group, testCase) {
  const checks = testCase.facts.map(([label, pattern]) => ({ label, ok: pattern.test(group.text) }));
  return {
    ...group,
    checks,
    matched: checks.filter(check => check.ok).length,
    total: checks.length
  };
}

async function runCase(testCase, args) {
  const startedAt = performance.now();
  const response = await fetch(`${args.baseUrl.replace(/\/+$/u, "")}/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": args.apiKey
    },
    body: JSON.stringify({
      query: testCase.query,
      top_k: args.topK,
      journal_chunks_per_document: args.journalDepth,
      retrievers: args.denseOnly
        ? ["dense"]
        : ["dense", "title_match", "exact_phrase", "bm25"]
    }),
    signal: AbortSignal.timeout(args.timeoutMs)
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`${testCase.id}: HTTP ${response.status} ${raw.slice(0, 300)}`);
  const payload = JSON.parse(raw);
  const scored = groupArticles(Array.isArray(payload.results) ? payload.results : [])
    .map(group => scoreGroup(group, testCase))
    .sort((left, right) => right.matched - left.matched || Math.min(...left.ranks) - Math.min(...right.ranks));
  const best = scored[0] || { key: null, title: null, ranks: [], checks: [], matched: 0, total: testCase.facts.length };
  return {
    id: testCase.id,
    ok: best.matched === best.total,
    elapsedMs: Math.round(performance.now() - startedAt),
    serviceMs: Number(payload?.timings?.total_ms) || null,
    resultCount: Array.isArray(payload.results) ? payload.results.length : 0,
    partial: payload.partial === true,
    lexicalScan: payload?.retrieval?.lexical_scan || payload?.lexical_scan || null,
    bestArticle: {
      key: best.key,
      title: best.title,
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
          factNeighbor: item.fact_neighbor === true,
          retrievalChannels: item.retrieval_channels || null,
          excerpt: String(item.chunk || item.document || item.text || "").slice(0, 400)
        }))
      } : {})
    }
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const results = [];
  const selectedCases = args.caseIds.length
    ? CASES.filter(testCase => args.caseIds.includes(testCase.id))
    : CASES;
  for (const testCase of selectedCases) {
    try {
      results.push(await runCase(testCase, args));
    } catch (error) {
      results.push({
        id: testCase.id,
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      });
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
        : `${result.bestArticle.matched}/${result.bestArticle.total} facts; ranks=${result.bestArticle.ranks.join(",") || "-"}; ${result.elapsedMs} ms`;
      console.log(`${status} ${result.id}: ${detail}`);
      if (!result.ok && result.bestArticle?.missing?.length) console.log(`  missing: ${result.bestArticle.missing.join(", ")}`);
    }
    console.log(`SUMMARY ${passed}/${results.length}`);
  }
  if (!summary.ok) process.exitCode = 1;
}

await main();
