#!/usr/bin/env node
/**
 * SOL-RAGSVC-01 ja -02 (P0) — HTTP-negatiivtest teede piirile.
 *
 * MIKS ERALDI SKRIPT, MITTE ÜHIKTEST. Vastuvõtukriteerium nõuab HTTP-tasandi
 * tõendit („ükski bait ei teki väljaspool RAG-hoidlat"), aga `rag-service` on
 * Python-teenus, mille sõltuvusi (fastapi, chromadb, openai) arendusmasinas ei
 * ole. Teede loogika ise on kaetud `rag-service/test_storage_paths.py`-ga;
 * SEE skript tõendab, et päris teenus käitub samamoodi.
 *
 * JOOKSUTA ALLES PÄRAST DEPLOY'D. Enne parandust ON see skript rünnak: ta
 * kirjutaks päris serveril failid hoidlast välja. Nimed on seepärast
 * kahjutud ja ajatempliga, ja skript ütleb ise välja, kui teenus need vastu
 * võttis.
 *
 * KASUTUS (serveris, kus teenus jookseb):
 *   RAG_SERVICE_API_KEY=... node scripts/rag-path-containment-probe.mjs
 *   # valikuline: --base http://127.0.0.1:8000
 *
 * Väljund: iga katse kohta OOTUS vs SAADUD, lõpus PROBE_OK või PROBE_FAIL.
 */

const args = process.argv.slice(2);
const baseArg = args.includes("--base") ? args[args.indexOf("--base") + 1] : null;
const BASE = String(
  baseArg || process.env.RAG_INTERNAL_HOST || process.env.RAG_API_BASE || "http://127.0.0.1:8000"
).replace(/\/+$/, "");
const KEY = String(process.env.RAG_SERVICE_API_KEY || "").trim();

if (!KEY) {
  console.error("RAG_SERVICE_API_KEY puudub. Serveris: set -a; . /etc/sotsiaalai/frontend.env; set +a");
  process.exit(2);
}

const STAMP = process.env.PROBE_STAMP || String(process.hrtime.bigint());
const results = [];
const createdDocIds = [];

function record(name, expectation, ok, detail) {
  results.push({ name, expectation, ok, detail });
  console.log(`${ok ? "OK  " : "FAIL"} ${name}\n     ootus: ${expectation}\n     saadud: ${detail}`);
}

async function call(path, init = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "x-api-key": KEY, ...(init.headers || {}) }
  });
  const text = await response.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = text.slice(0, 400);
  }
  return { status: response.status, body };
}

/**
 * Vaenulikud failinimed. Kõik peavad andma 400 VÕI salvestuma dokumendi enda
 * kausta kahjutu nimega — mitte kunagi sinna, kuhu nimi osutab.
 */
const HOSTILE_NAMES = [
  `../../rag-escape-probe-${STAMP}.txt`,
  `/tmp/rag-escape-probe-${STAMP}.txt`,
  String.raw`..\..\rag-escape-probe-${STAMP}.txt`
];

function verdictForIngest(status, body, docId) {
  if (status === 400) return { ok: true, detail: "400 (nimi lükati tagasi)" };
  if (status >= 200 && status < 300) {
    createdDocIds.push(docId);
    return { ok: null, detail: `${status} — kontrollime registri teed` };
  }
  return { ok: false, detail: `ootamatu ${status}: ${JSON.stringify(body).slice(0, 200)}` };
}

async function pathStaysInsideStorage(docId) {
  const { status, body } = await call(`/documents?limit=2000`);
  if (status !== 200) return { ok: false, detail: `dokumentide loend andis ${status}` };
  const rows = Array.isArray(body?.documents) ? body.documents : Array.isArray(body) ? body : [];
  const row = rows.find((item) => (item?.docId || item?.doc_id) === docId);
  const path = String(row?.path || row?.source_path || "");
  if (!path) return { ok: false, detail: "registris ei ole teed — ei saa tõendada" };
  const escaped = path.includes("..") || /rag-escape-probe/.test(path);
  return {
    ok: !escaped,
    detail: escaped ? `TEE VÄLJUS HOIDLAST: ${path}` : `tee jäi hoidlasse: ${path}`
  };
}

async function probeIngestFile() {
  for (const name of HOSTILE_NAMES) {
    const docId = `probe-file-${STAMP}-${HOSTILE_NAMES.indexOf(name)}`;
    const { status, body } = await call("/ingest/file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        docId,
        fileName: name,
        mimeType: "text/plain",
        data: Buffer.from("probe").toString("base64"),
        title: "SOL-RAGSVC probe"
      })
    });
    const first = verdictForIngest(status, body, docId);
    if (first.ok === null) {
      const inside = await pathStaysInsideStorage(docId);
      record(`/ingest/file  ${name}`, "400 või tee hoidla sees", inside.ok, inside.detail);
    } else {
      record(`/ingest/file  ${name}`, "400 või tee hoidla sees", first.ok, first.detail);
    }
  }
}

async function probeUpload() {
  for (const name of HOSTILE_NAMES) {
    const docId = `probe-upload-${STAMP}-${HOSTILE_NAMES.indexOf(name)}`;
    const form = new FormData();
    form.append("file", new Blob([Buffer.from("probe")], { type: "text/plain" }), "harmless.txt");
    form.append("docId", docId);
    form.append("fileName", name);
    form.append("mimeType", "text/plain");
    const { status, body } = await call("/upload", { method: "POST", body: form });
    const first = verdictForIngest(status, body, docId);
    if (first.ok === null) {
      const inside = await pathStaysInsideStorage(docId);
      record(`/upload       ${name}`, "400 või tee hoidla sees", inside.ok, inside.detail);
    } else {
      record(`/upload       ${name}`, "400 või tee hoidla sees", first.ok, first.detail);
    }
  }
}

/**
 * SOL-RAGSVC-02: kliendi `source_path` ei tohi muutuda serverifaili lugemiseks.
 * Sihiks on fail, mis igal Linuxil OLEMAS on — nii on „ei lekkinud" tõendatud,
 * mitte lihtsalt „faili ei olnud".
 */
async function probeTextSourceRead() {
  const docId = `probe-text-${STAMP}`;
  const { status } = await call("/ingest/text", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      doc_id: docId,
      text: "SOL-RAGSVC probe text",
      metadata: { title: "SOL-RAGSVC probe", source_path: "/etc/passwd" }
    })
  });
  if (status < 200 || status >= 300) {
    record("/ingest/text  source_path=/etc/passwd", "ingest õnnestub, allikas ei lekki", false, `ingest andis ${status}`);
    return;
  }
  createdDocIds.push(docId);

  const response = await fetch(`${BASE}/documents/${encodeURIComponent(docId)}/source`, {
    headers: { "x-api-key": KEY },
    redirect: "manual"
  });
  const text = response.status === 200 ? await response.text() : "";
  const leaked = /root:.*:0:0:/.test(text);
  record(
    "/documents/{id}/source pärast source_path=/etc/passwd",
    "404 või meie oma salvestatud tekst — MITTE /etc/passwd",
    !leaked,
    leaked ? "LEKKIS /etc/passwd sisu" : `${response.status}, ${text.slice(0, 60).replace(/\n/g, " ")}`
  );
}

async function cleanup() {
  for (const docId of createdDocIds) {
    try {
      await call(`/documents/${encodeURIComponent(docId)}`, { method: "DELETE" });
    } catch {
      /* Koristus on parima tahte kaupa; probe-dokumendid on äratuntava nimega. */
    }
  }
}

async function main() {
  console.log(`RAG teede piiri probe → ${BASE} (stamp ${STAMP})\n`);
  await probeIngestFile();
  await probeUpload();
  await probeTextSourceRead();
  await cleanup();

  const failed = results.filter((row) => !row.ok);
  console.log("");
  if (failed.length) {
    console.log(`PROBE_FAIL ${failed.length}/${results.length}`);
    console.log("NB: kontrolli serveris ka, kas faile tekkis hoidlast välja:");
    console.log(`  find / -name 'rag-escape-probe-${STAMP}*' 2>/dev/null`);
    process.exit(1);
  }
  console.log(`PROBE_OK ${results.length}/${results.length}`);
  console.log("Kinnituseks serveris (peab andma tühja tulemuse):");
  console.log(`  find / -name 'rag-escape-probe-${STAMP}*' 2>/dev/null`);
}

main().catch((error) => {
  console.error("PROBE_FAIL", error?.message || error);
  process.exit(1);
});
