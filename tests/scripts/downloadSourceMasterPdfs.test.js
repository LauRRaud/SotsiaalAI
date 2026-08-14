import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const CLI_PATH = path.resolve("scripts/download-source-master-pdfs.mjs");

test("default paths use the consolidated local Andmebaas archive", async () => {
  const downloader = await import("../../scripts/lib/source-master-pdf-download.mjs");
  assert.equal(downloader.DEFAULT_MASTER_PATH, "docs/Andmebaas/allikaregister/master_sources_final.json");
  assert.equal(downloader.DEFAULT_OUTPUT_DIR, "docs/Andmebaas/RAG/master_sources_pdf");
  assert.equal(downloader.DEFAULT_REPORT_DIR, "docs/Andmebaas/RAG");
  assert.deepEqual(downloader.DEFAULT_SCAN_ROOTS, ["docs/Andmebaas"]);
});

async function temporaryDirectory() {
  return fs.mkdtemp(path.join(os.tmpdir(), "source-master-pdf-download-"));
}

function runCli(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI_PATH, ...args], {
      cwd: process.cwd(),
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", chunk => { stdout += chunk; });
    child.stderr.on("data", chunk => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", code => resolve({ code, stdout, stderr }));
  });
}

test("plan excludes a PDF proven by an existing local metadata sidecar", async t => {
  const directory = await temporaryDirectory();
  t.after(async () => fs.rm(directory, { recursive: true, force: true }));

  const masterPath = path.join(directory, "master.json");
  const localRoot = path.join(directory, "local");
  const output = path.join(directory, "output");
  const reportDir = path.join(directory, "reports");
  await fs.mkdir(localRoot, { recursive: true });
  await fs.writeFile(path.join(localRoot, "already-here.pdf"), "%PDF-1.7\nlocal fixture\n");
  await fs.writeFile(path.join(localRoot, "already-here.json"), JSON.stringify({
    source_id: "existing-source",
    source_path: "already-here.pdf",
    source_url: "https://example.org/already-here.pdf"
  }));
  await fs.writeFile(masterPath, JSON.stringify([
    {
      source_id: "existing-source",
      title: "Existing",
      url: "https://example.org/already-here.pdf",
      source_format: "pdf"
    },
    {
      source_id: "missing-source",
      title: "Missing",
      url: "https://example.org/missing.pdf",
      source_format: "pdf"
    },
    {
      source_id: "html-source",
      title: "HTML",
      url: "https://example.org/",
      source_format: "html"
    }
  ]));

  const result = await runCli([
    "--plan",
    "--master", masterPath,
    "--scan-root", localRoot,
    "--output", output,
    "--report-dir", reportDir,
    "--json"
  ]);

  assert.equal(result.code, 0, result.stderr);
  const summary = JSON.parse(result.stdout);
  assert.deepEqual(summary.counts, {
    total: 2,
    local_file_exists: 1,
    would_download: 1
  });
  assert.equal(summary.results.find(item => item.source_id === "existing-source").status, "LOCAL_FILE_EXISTS");
  assert.equal(summary.results.find(item => item.source_id === "missing-source").status, "WOULD_DOWNLOAD");
  await assert.rejects(fs.access(output), error => error?.code === "ENOENT");
  assert.deepEqual((await fs.readdir(reportDir)).sort(), [
    "master_sources_pdf_report.csv",
    "master_sources_pdf_report.json",
    "master_sources_pdf_report.md"
  ]);
});

test("download stores a unique PDF but reuses identical bytes already in the local corpus", async t => {
  const directory = await temporaryDirectory();
  t.after(async () => fs.rm(directory, { recursive: true, force: true }));
  const downloader = await import("../../scripts/lib/source-master-pdf-download.mjs");
  assert.equal(typeof downloader.downloadMissingPdfs, "function");

  const localRoot = path.join(directory, "local");
  const output = path.join(directory, "output");
  await fs.mkdir(localRoot, { recursive: true });
  const existingBody = Buffer.from("%PDF-1.7\nalready local\n");
  const freshBody = Buffer.from("%PDF-1.7\nnew source\n");
  const existingPath = path.join(localRoot, "existing.pdf");
  await fs.writeFile(existingPath, existingBody);
  const catalog = await downloader.inventoryLocalPdfs([localRoot]);

  const records = [
    { source_id: "same-bytes", title: "Same", url: "https://example.org/same.pdf", source_format: "pdf" },
    { source_id: "fresh-pdf", title: "Fresh", url: "https://example.org/fresh.pdf", source_format: "pdf" }
  ];
  const fetcher = async url => ({
    ok: true,
    status: 200,
    finalUrl: url,
    redirects: [],
    contentType: "application/pdf",
    body: url.includes("same") ? existingBody : freshBody,
    bytes: url.includes("same") ? existingBody.length : freshBody.length
  });

  const report = await downloader.downloadMissingPdfs({
    records,
    catalog,
    outputDir: output,
    fetcher,
    concurrency: 2,
    retries: 0,
    now: () => new Date("2026-08-14T10:00:00.000Z")
  });

  assert.equal(report.results.find(item => item.source_id === "same-bytes").status, "LOCAL_FILE_EXISTS");
  assert.equal(report.results.find(item => item.source_id === "same-bytes").local_path, existingPath);
  await assert.rejects(fs.access(path.join(output, "same-bytes.pdf")), error => error?.code === "ENOENT");

  const fresh = report.results.find(item => item.source_id === "fresh-pdf");
  assert.equal(fresh.status, "DOWNLOADED");
  assert.deepEqual(await fs.readFile(path.join(output, "fresh-pdf.pdf")), freshBody);
  const metadata = JSON.parse(await fs.readFile(path.join(output, "fresh-pdf.metadata.json"), "utf8"));
  assert.equal(metadata.source.source_id, "fresh-pdf");
  assert.equal(metadata.final_url, "https://example.org/fresh.pdf");
  assert.equal(metadata.downloaded_at, "2026-08-14T10:00:00.000Z");
  assert.equal(metadata.sha256, fresh.sha256);
  assert.deepEqual((await fs.readdir(output)).filter(file => file.includes(".partial")), []);
});

test("download rejects an HTML response instead of saving it with a PDF extension", async t => {
  const directory = await temporaryDirectory();
  t.after(async () => fs.rm(directory, { recursive: true, force: true }));
  const downloader = await import("../../scripts/lib/source-master-pdf-download.mjs");
  const output = path.join(directory, "output");
  const catalog = await downloader.inventoryLocalPdfs([]);
  const report = await downloader.downloadMissingPdfs({
    records: [{ source_id: "html-instead", title: "Wrong body", url: "https://example.org/file.pdf", source_format: "pdf" }],
    catalog,
    outputDir: output,
    fetcher: async url => ({ ok: true, status: 200, finalUrl: url, redirects: [], body: Buffer.from("<html>login</html>") }),
    retries: 0
  });
  assert.equal(report.results[0].status, "NOT_A_PDF");
  assert.equal(report.results[0].error, "pdf_signature_missing");
  await assert.rejects(fs.access(output), error => error?.code === "ENOENT");
});

test("download reports the bounded-fetch size error as TOO_LARGE", async t => {
  const directory = await temporaryDirectory();
  t.after(async () => fs.rm(directory, { recursive: true, force: true }));
  const downloader = await import("../../scripts/lib/source-master-pdf-download.mjs");
  const { SafeFetchError } = await import("../../scripts/lib/safe-fetch.mjs");
  const report = await downloader.downloadMissingPdfs({
    records: [{ source_id: "huge", title: "Huge", url: "https://example.org/huge.pdf", source_format: "pdf" }],
    catalog: await downloader.inventoryLocalPdfs([]),
    outputDir: path.join(directory, "output"),
    fetcher: async () => { throw new SafeFetchError("response_too_large", "bounded"); },
    retries: 0
  });
  assert.equal(report.results[0].status, "TOO_LARGE");
  assert.equal(report.results[0].error, "response_too_large");
});

test("download retries one transient HTTP 503 and then stores the valid PDF", async t => {
  const directory = await temporaryDirectory();
  t.after(async () => fs.rm(directory, { recursive: true, force: true }));
  const downloader = await import("../../scripts/lib/source-master-pdf-download.mjs");
  let attempts = 0;
  const body = Buffer.from("%PDF-1.7\nretry success\n");
  const report = await downloader.downloadMissingPdfs({
    records: [{ source_id: "flaky", title: "Flaky", url: "https://example.org/flaky.pdf", source_format: "pdf" }],
    catalog: await downloader.inventoryLocalPdfs([]),
    outputDir: path.join(directory, "output"),
    fetcher: async url => {
      attempts += 1;
      if (attempts === 1) return { ok: false, status: 503, finalUrl: url, redirects: [], body: Buffer.alloc(0) };
      return { ok: true, status: 200, finalUrl: url, redirects: [], body };
    },
    retries: 1,
    sleep: async () => {}
  });
  assert.equal(attempts, 2);
  assert.equal(report.results[0].status, "DOWNLOADED");
  assert.deepEqual(await fs.readFile(path.join(directory, "output", "flaky.pdf")), body);
});

test("parallel records with identical downloaded bytes create only one PDF", async t => {
  const directory = await temporaryDirectory();
  t.after(async () => fs.rm(directory, { recursive: true, force: true }));
  const downloader = await import("../../scripts/lib/source-master-pdf-download.mjs");
  const output = path.join(directory, "output");
  const body = Buffer.from("%PDF-1.7\nidentical remote content\n");
  const report = await downloader.downloadMissingPdfs({
    records: [
      { source_id: "duplicate-a", title: "A", url: "https://example.org/a.pdf", source_format: "pdf" },
      { source_id: "duplicate-b", title: "B", url: "https://example.org/b.pdf", source_format: "pdf" }
    ],
    catalog: await downloader.inventoryLocalPdfs([]),
    outputDir: output,
    fetcher: async url => ({ ok: true, status: 200, finalUrl: url, redirects: [], body }),
    concurrency: 2,
    retries: 0
  });
  assert.deepEqual(report.results.map(item => item.status).sort(), ["DOWNLOADED", "LOCAL_FILE_EXISTS"]);
  assert.equal(new Set(report.results.map(item => item.local_path)).size, 1);
  assert.equal((await fs.readdir(output)).filter(file => file.endsWith(".pdf")).length, 1);
});

test("generated metadata sidecar makes a downloaded PDF local on the next run", async t => {
  const directory = await temporaryDirectory();
  t.after(async () => fs.rm(directory, { recursive: true, force: true }));
  const downloader = await import("../../scripts/lib/source-master-pdf-download.mjs");
  const pdfPath = path.join(directory, "saved.pdf");
  await fs.writeFile(pdfPath, "%PDF-1.7\nsaved\n");
  await fs.writeFile(path.join(directory, "saved.metadata.json"), JSON.stringify({
    source: {
      source_id: "saved-source",
      url: "https://example.org/saved.pdf"
    },
    final_url: "https://cdn.example.org/saved.pdf"
  }));
  const catalog = await downloader.inventoryLocalPdfs([directory]);
  assert.deepEqual(
    downloader.findProvenLocalPdf({ source_id: "saved-source", url: "https://example.org/saved.pdf" }, catalog),
    { path: pdfPath, matched_by: "source_id_sidecar" }
  );
});

test("HTTP download failure keeps the response status in the report", async t => {
  const directory = await temporaryDirectory();
  t.after(async () => fs.rm(directory, { recursive: true, force: true }));
  const downloader = await import("../../scripts/lib/source-master-pdf-download.mjs");
  const report = await downloader.downloadMissingPdfs({
    records: [{ source_id: "missing-http", title: "Missing", url: "https://example.org/missing.pdf", source_format: "pdf" }],
    catalog: await downloader.inventoryLocalPdfs([]),
    outputDir: path.join(directory, "output"),
    fetcher: async url => ({ ok: false, status: 404, finalUrl: url, redirects: [], body: Buffer.alloc(0) }),
    retries: 0
  });
  assert.equal(report.results[0].status, "DOWNLOAD_FAILED");
  assert.equal(report.results[0].error, "HTTP 404");
});
