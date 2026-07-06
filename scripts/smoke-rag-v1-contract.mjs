#!/usr/bin/env node

const DEFAULT_BASE_URL = "http://127.0.0.1:3000";

const DEFAULT_CASES = [
  {
    id: "voimaluste_kohvik",
    message: "Mis on Võimaluste kohvik?",
    expectRag: true
  },
  {
    id: "article_ai",
    message: "Kas Laur Raudsoo on kirjutanud tehisintellektist sotsiaaltöös?",
    expectRag: true
  },
  {
    id: "insufficient_evidence",
    message: "Kas allikas kinnitab konkreetset hooldajatoetuse summat?",
    expectRag: true
  }
];

const FORBIDDEN_TRACE_KEYS = new Set([
  "answer",
  "content",
  "context",
  "effectiveContext",
  "evidenceText",
  "modelContext",
  "model_context",
  "prompt",
  "reply",
  "text",
  "userMessage",
  "user_message"
]);

function parseArgs(argv = []) {
  const args = {
    baseUrl: process.env.SOTSIAALAI_SMOKE_BASE_URL || process.env.SMOKE_BASE_URL || DEFAULT_BASE_URL,
    cookie: process.env.SOTSIAALAI_SMOKE_COOKIE || process.env.SMOKE_COOKIE || "",
    bearer: process.env.SOTSIAALAI_SMOKE_BEARER || process.env.SMOKE_BEARER || "",
    stream: process.env.SOTSIAALAI_SMOKE_STREAM === "1" || process.env.SMOKE_STREAM === "1",
    role: process.env.SOTSIAALAI_SMOKE_ROLE || "SOCIAL_WORKER"
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--base-url") args.baseUrl = argv[++i] || args.baseUrl;
    else if (arg === "--cookie") args.cookie = argv[++i] || "";
    else if (arg === "--bearer") args.bearer = argv[++i] || "";
    else if (arg === "--stream") args.stream = true;
    else if (arg === "--role") args.role = argv[++i] || args.role;
  }
  return args;
}

function endpoint(baseUrl = "", path = "") {
  return `${String(baseUrl || DEFAULT_BASE_URL).replace(/\/+$/u, "")}${path}`;
}

function headers(args) {
  const out = {
    "Content-Type": "application/json"
  };
  if (args.cookie) out.Cookie = args.cookie;
  if (args.bearer) out.Authorization = `Bearer ${args.bearer}`;
  return out;
}

function sourceId(source = {}, index = 0) {
  return String(
    source?.source_id ||
    source?.sourceId ||
    source?.id ||
    source?.key ||
    source?.url ||
    source?.short_ref ||
    source?.title ||
    `source_${index}`
  ).trim();
}

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function walkTrace(value, visitor, path = []) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkTrace(item, visitor, [...path, String(index)]));
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    visitor(key, nested, path);
    if (nested && typeof nested === "object") walkTrace(nested, visitor, [...path, key]);
  }
}

function assertTracePrivacy(trace, userMessage = "") {
  const traceJson = JSON.stringify(trace || {});
  const normalizedMessage = String(userMessage || "").trim();
  if (normalizedMessage.length >= 24) {
    assertCondition(
      !traceJson.includes(normalizedMessage),
      "rag_trace must not contain the full user message"
    );
  }
  walkTrace(trace, (key, value, path) => {
    assertCondition(!FORBIDDEN_TRACE_KEYS.has(key), `rag_trace contains forbidden key ${[...path, key].join(".")}`);
    if (typeof value === "string") {
      assertCondition(value.length <= 500, `rag_trace string value is too long at ${[...path, key].join(".")}`);
    }
  });
}

function assertRagContract(payload, item) {
  assertCondition(payload && typeof payload === "object", `${item.id}: response payload missing`);
  assertCondition(payload.ok !== false, `${item.id}: response ok=false`);
  assertCondition(typeof (payload.reply || payload.answer) === "string", `${item.id}: response reply missing`);
  assertCondition(Array.isArray(payload.sources), `${item.id}: sources must be an array`);
  assertCondition(Array.isArray(payload.displayed_sources), `${item.id}: displayed_sources must be an array`);
  assertCondition(payload.displayed_sources.length <= payload.sources.length, `${item.id}: displayed_sources cannot exceed sources`);

  if (!item.expectRag) return;
  assertCondition(payload.rag_contract_version === "v1", `${item.id}: rag_contract_version must be v1`);
  assertCondition(
    payload.source_display_mode === "displayed_sources_enforced" ||
    payload.source_display_mode === "legacy_sources_allowed",
    `${item.id}: source_display_mode missing or invalid`
  );
  assertCondition(payload.rag_trace && typeof payload.rag_trace === "object", `${item.id}: rag_trace missing`);
  assertCondition(typeof payload.rag_trace.retrieved_count === "number", `${item.id}: rag_trace.retrieved_count missing`);
  assertCondition(Array.isArray(payload.rag_trace.displayed_source_ids), `${item.id}: rag_trace.displayed_source_ids missing`);

  const displayedIds = payload.displayed_sources.map(sourceId).filter(Boolean);
  for (const id of displayedIds) {
    assertCondition(
      payload.rag_trace.displayed_source_ids.includes(id),
      `${item.id}: displayed source ${id} missing from rag_trace.displayed_source_ids`
    );
  }
  assertTracePrivacy(payload.rag_trace, item.message);
}

async function postChatJson(args, item, stream = false) {
  const res = await fetch(endpoint(args.baseUrl, "/api/chat"), {
    method: "POST",
    headers: headers(args),
    body: JSON.stringify({
      message: item.message,
      history: item.history || [],
      role: args.role,
      stream,
      persist: false,
      uiLocale: "et",
      chatMode: "rag",
      forceSources: true
    })
  });
  const contentType = res.headers.get("content-type") || "";
  const raw = await res.text();
  assertCondition(res.ok, `${item.id}: HTTP ${res.status} ${raw.slice(0, 300)}`);
  if (stream) return parseSseDone(raw, item);
  assertCondition(contentType.includes("application/json"), `${item.id}: expected JSON response`);
  return JSON.parse(raw);
}

function parseSseDone(raw = "", item = {}) {
  const events = String(raw || "")
    .split("\n\n")
    .map(block => block.trim())
    .filter(Boolean)
    .map(block => {
      const event = block.match(/^event:\s*(.+)$/m)?.[1] || "";
      const dataRaw = block.match(/^data:\s*(.+)$/m)?.[1] || "{}";
      return {
        event,
        data: JSON.parse(dataRaw)
      };
    });
  const done = events.find(event => event.event === "done")?.data;
  assertCondition(done, `${item.id}: stream done event missing`);
  return {
    ok: true,
    reply: "streamed",
    ...done
  };
}

async function checkHealth(args) {
  const res = await fetch(endpoint(args.baseUrl, "/api/chat"), {
    method: "GET",
    headers: headers(args)
  });
  assertCondition(res.ok, `GET /api/chat failed with HTTP ${res.status}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await checkHealth(args);
  const results = [];
  for (const item of DEFAULT_CASES) {
    const payload = await postChatJson(args, item, false);
    assertRagContract(payload, item);
    results.push({ id: item.id, mode: payload.rag_trace?.query_plan?.mode || "n/a" });
  }
  if (args.stream) {
    const item = DEFAULT_CASES[0];
    const payload = await postChatJson(args, { ...item, id: `${item.id}_stream` }, true);
    assertRagContract(payload, { ...item, id: `${item.id}_stream` });
    results.push({ id: `${item.id}_stream`, mode: payload.rag_trace?.query_plan?.mode || "n/a" });
  }
  console.log(JSON.stringify({
    ok: true,
    baseUrl: args.baseUrl,
    cases: results
  }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({
    ok: false,
    error: err?.message || String(err)
  }, null, 2));
  process.exitCode = 1;
});
