#!/usr/bin/env node
/**
 * SOL-DOC-J-03 isolated runtime orchestrator.
 *
 * Creates a temporary PostgreSQL database, starts the real local RAG service
 * with isolated Chroma storage, and serves deterministic embeddings from a
 * loopback-only OpenAI-compatible stub. The worker owns the document journey;
 * this process owns every runtime dependency and removes it in finally.
 */

import crypto from "node:crypto"
import { spawn, spawnSync } from "node:child_process"
import { once } from "node:events"
import { createServer } from "node:http"
import { access, mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import dotenv from "dotenv"
import pg from "pg"

import { assertLocalDocumentRagProbeConfig } from "./document-rag-removal-live-safety.mjs"

dotenv.config({ path: ".env.local", quiet: true })
dotenv.config({ path: ".env", quiet: true })

const DEFAULT_LOCAL_DATABASE_URL = "postgresql://sotsiaal_user:sotsiaalai@127.0.0.1:5432/sotsiaal_ai?schema=public"
const RAG_SERVICE_KEY = "sol-doc-j03-loopback-runtime-key"
const sourceDatabaseUrl = String(
  process.env.DOC_RAG_PROBE_DATABASE_URL
  || process.env.DATABASE_URL
  || DEFAULT_LOCAL_DATABASE_URL
).trim()
const bundledPython = path.join(
  process.env.USERPROFILE || "",
  ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "python", "python.exe"
)
const pythonExecutable = String(process.env.DOC_RAG_PROBE_PYTHON || bundledPython).trim()
const pipCacheRoot = path.join(process.env.LOCALAPPDATA || "", "pip", "cache", "http-v2")
const repoRoot = process.cwd()
const prismaCli = path.resolve("node_modules/prisma/build/index.js")
const worker = path.resolve("scripts/document-rag-removal-live-probe-worker.mjs")
const databaseName = `sol_doc_j03_live_${Date.now()}_${process.pid}`

let ragProcess = null
let embeddingServer = null
let temporaryRoot = null
let databaseCreated = false
let embeddingRequests = 0
let unexpectedStubRequests = 0
let ragOutput = ""
let pythonDependencies = null

function expectSafeDatabaseName(value) {
  if (!/^sol_doc_j03_live_[0-9_]+$/u.test(value)) {
    throw new Error("unsafe temporary database name")
  }
}

function appendRagOutput(chunk) {
  ragOutput = `${ragOutput}${String(chunk || "")}`.slice(-12_000)
}

function deterministicEmbedding(value) {
  const digest = crypto.createHash("sha256").update(String(value || "")).digest()
  const vector = Array.from({ length: 64 }, (_, index) => (digest[index % digest.length] - 127.5) / 127.5)
  const magnitude = Math.sqrt(vector.reduce((sum, item) => sum + (item * item), 0)) || 1
  return vector.map(item => item / magnitude)
}

async function readJsonBody(request) {
  const chunks = []
  let bytes = 0
  for await (const chunk of request) {
    bytes += chunk.length
    if (bytes > 1024 * 1024) throw new Error("embedding request too large")
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")
}

async function startEmbeddingStub() {
  const server = createServer(async (request, response) => {
    try {
      if (request.method !== "POST" || request.url !== "/v1/embeddings") {
        unexpectedStubRequests += 1
        response.writeHead(404, { "content-type": "application/json" })
        response.end(JSON.stringify({ error: { message: "loopback stub endpoint not found" } }))
        return
      }
      embeddingRequests += 1
      const payload = await readJsonBody(request)
      const inputs = Array.isArray(payload.input) ? payload.input : [payload.input]
      const data = inputs.map((input, index) => ({
        object: "embedding",
        index,
        embedding: deterministicEmbedding(input)
      }))
      response.writeHead(200, { "content-type": "application/json" })
      response.end(JSON.stringify({
        object: "list",
        data,
        model: String(payload.model || "synthetic-loopback-embedding"),
        usage: { prompt_tokens: inputs.length, total_tokens: inputs.length }
      }))
    } catch (error) {
      response.writeHead(400, { "content-type": "application/json" })
      response.end(JSON.stringify({ error: { message: error?.message || "invalid request" } }))
    }
  })
  server.listen(0, "127.0.0.1")
  await once(server, "listening")
  return server
}

async function reserveLoopbackPort() {
  const server = createServer()
  server.listen(0, "127.0.0.1")
  await once(server, "listening")
  const port = server.address().port
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  return port
}

async function waitForRagHealth(baseUrl, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (ragProcess?.exitCode != null) {
      throw new Error(`rag-service exited before health check\n${ragOutput}`)
    }
    try {
      const response = await fetch(`${baseUrl}/health`, { cache: "no-store" })
      if (response.ok) return
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error(`rag-service health check timed out\n${ragOutput}`)
}

async function stopChild(child) {
  if (!child || child.exitCode != null) return
  const exited = once(child, "exit")
  child.kill()
  const stopped = await Promise.race([
    exited.then(() => true),
    new Promise(resolve => setTimeout(() => resolve(false), 15_000))
  ])
  if (!stopped) throw new Error("rag-service process did not stop")
}

async function closeServer(server) {
  if (!server) return
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
}

function runChecked(command, args, { env, label, echoOutput = true }) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env,
    encoding: "utf8",
    shell: false,
    timeout: 180_000
  })
  if (echoOutput || result.status !== 0) {
    process.stdout.write(result.stdout || "")
    process.stderr.write(result.stderr || "")
  }
  if (result.status !== 0) {
    throw new Error(`${label} failed (${result.status ?? "no status"})${ragOutput ? `\n${ragOutput}` : ""}`)
  }
}

async function runCheckedAsync(command, args, { env, label, timeoutMs = 240_000 }) {
  const child = spawn(command, args, {
    cwd: repoRoot,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    shell: false
  })
  let stdout = ""
  let stderr = ""
  child.stdout.on("data", chunk => {
    stdout += String(chunk)
    process.stdout.write(chunk)
  })
  child.stderr.on("data", chunk => {
    stderr += String(chunk)
    process.stderr.write(chunk)
  })
  const timeout = setTimeout(() => child.kill(), timeoutMs)
  const [code, signal] = await once(child, "exit")
  clearTimeout(timeout)
  if (code !== 0) {
    const timedOut = signal != null && code == null
    throw new Error(
      `${label} failed (${timedOut ? `timeout/${signal}` : code ?? signal ?? "no status"})`+
      `${ragOutput ? `\n${ragOutput}` : ""}`+
      `${!stdout && !stderr ? "\nworker produced no output" : ""}`
    )
  }
}

async function prepareOfflinePythonRuntime() {
  await access(pythonExecutable)
  await access(pipCacheRoot)
  pythonDependencies = path.join(temporaryRoot, "pydeps")
  const script = String.raw`
import email
from pathlib import Path
from packaging.tags import parse_tag, sys_tags
import re
import sys
import zipfile

requirements, cache_root, target = map(Path, sys.argv[1:4])
skip = {"uvloop", "chroma-hnswlib"}
wanted = {}
for raw in requirements.read_text(encoding="utf-8").splitlines():
    line = raw.strip()
    if not line or line.startswith("#") or "==" not in line:
        continue
    name, version = line.split("==", 1)
    normalized = re.sub(r"[-_.]+", "-", name).lower()
    if normalized not in skip:
        wanted[normalized] = version

target.mkdir(parents=True, exist_ok=True)
tag_rank = {tag: index for index, tag in enumerate(sys_tags())}
candidates = {}
for body in cache_root.rglob("*.body"):
    try:
        with zipfile.ZipFile(body) as archive:
            metadata_name = next(
                (name for name in archive.namelist() if name.endswith(".dist-info/METADATA")),
                None,
            )
            if not metadata_name:
                continue
            metadata = email.message_from_bytes(archive.read(metadata_name))
            normalized = re.sub(r"[-_.]+", "-", str(metadata.get("Name", ""))).lower()
            version = str(metadata.get("Version", ""))
            if wanted.get(normalized) != version:
                continue
            wheel_name = next(
                (name for name in archive.namelist() if name.endswith(".dist-info/WHEEL")),
                None,
            )
            if not wheel_name:
                continue
            wheel = email.message_from_bytes(archive.read(wheel_name))
            ranks = [
                tag_rank[tag]
                for raw_tag in wheel.get_all("Tag", [])
                for tag in parse_tag(raw_tag)
                if tag in tag_rank
            ]
            if not ranks:
                continue
            score = min(ranks)
            if normalized not in candidates or score < candidates[normalized][0]:
                candidates[normalized] = (score, body)
    except (OSError, zipfile.BadZipFile):
        continue

missing = sorted(set(wanted) - set(candidates))
if missing:
    raise SystemExit("offline wheel cache missing: " + ", ".join(missing))
for normalized, (_score, body) in candidates.items():
    with zipfile.ZipFile(body) as archive:
        archive.extractall(target)
print(f"OFFLINE_PYTHON_DEPS_OK packages={len(candidates)} network=unused")
`
  const result = spawnSync(pythonExecutable, [
    "-c", script,
    path.resolve("rag-service/requirements.txt"),
    pipCacheRoot,
    pythonDependencies
  ], { cwd: repoRoot, encoding: "utf8", shell: false, timeout: 120_000 })
  process.stdout.write(result.stdout || "")
  process.stderr.write(result.stderr || "")
  if (result.status !== 0) throw new Error("offline Python RAG dependency restore failed")
}

async function verifyPythonRuntime(env) {
  const result = spawnSync(pythonExecutable, [
    "-c",
    [
      "import chromadb, fastapi, openai, uvicorn",
      "assert hasattr(chromadb, 'PersistentClient')",
      "assert hasattr(fastapi, 'FastAPI')",
      "assert hasattr(openai, 'OpenAI')",
      "assert hasattr(uvicorn, 'run')",
      "print('PYTHON_RAG_RUNTIME_OK implementations=present')"
    ].join("; ")
  ], { cwd: repoRoot, env, encoding: "utf8", shell: false, timeout: 30_000 })
  process.stdout.write(result.stdout || "")
  process.stderr.write(result.stderr || "")
  if (result.status !== 0) throw new Error("isolated Python RAG dependencies are unavailable")
}

async function main() {
  expectSafeDatabaseName(databaseName)
  const source = new URL(sourceDatabaseUrl)
  const adminUrl = new URL(source)
  adminUrl.pathname = "/postgres"
  adminUrl.search = ""
  const probeUrl = new URL(source)
  probeUrl.pathname = `/${databaseName}`
  probeUrl.search = ""

  temporaryRoot = await mkdtemp(path.join(tmpdir(), "sol-doc-j03-live-"))
  await prepareOfflinePythonRuntime()
  embeddingServer = await startEmbeddingStub()
  const embeddingPort = embeddingServer.address().port
  const ragPort = await reserveLoopbackPort()
  const ragBaseUrl = `http://127.0.0.1:${ragPort}`
  assertLocalDocumentRagProbeConfig({
    databaseUrl: probeUrl.toString(),
    ragHost: ragBaseUrl,
    ragServiceKey: RAG_SERVICE_KEY
  })

  const pythonEnv = {
    ...process.env,
    PYTHONPATH: [pythonDependencies, process.env.PYTHONPATH].filter(Boolean).join(path.delimiter),
    OPENAI_API_KEY: "synthetic-loopback-openai-key",
    OPENAI_BASE_URL: `http://127.0.0.1:${embeddingPort}/v1`,
    RAG_SERVICE_API_KEY: RAG_SERVICE_KEY,
    RAG_BIND_HOST: "127.0.0.1",
    RAG_STORAGE_DIR: path.join(temporaryRoot, "rag-storage"),
    RAG_COLLECTION: `sol_doc_j03_${process.pid}`,
    RAG_CHUNK_MODE: "chars",
    RAG_CHUNK_SIZE: "400",
    RAG_CHUNK_OVERLAP: "40",
    RAG_ALLOW_PRIVATE_URL_FETCH: "0",
    ANONYMIZED_TELEMETRY: "FALSE",
    HTTP_PROXY: "",
    HTTPS_PROXY: "",
    ALL_PROXY: "",
    NO_PROXY: "127.0.0.1,localhost"
  }
  await verifyPythonRuntime(pythonEnv)

  const creator = new pg.Client({ connectionString: adminUrl.toString() })
  await creator.connect()
  try {
    await creator.query(`CREATE DATABASE "${databaseName}"`)
    databaseCreated = true
  } finally {
    await creator.end()
  }

  const runtimeEnv = {
    ...process.env,
    DATABASE_URL: probeUrl.toString(),
    RAG_INTERNAL_HOST: `127.0.0.1:${ragPort}`,
    RAG_API_BASE: ragBaseUrl,
    RAG_SERVICE_API_KEY: RAG_SERVICE_KEY,
    ALLOW_EXTERNAL_RAG: "0",
    RAG_TIMEOUT_MS: "120000"
  }
  runChecked(process.execPath, [prismaCli, "migrate", "deploy"], {
    env: runtimeEnv,
    label: "temporary database migration",
    echoOutput: false
  })
  console.log("MIGRATIONS_OK temporary_database_full_chain")

  ragProcess = spawn(pythonExecutable, [
    "-c",
    [
      "import sys, uvicorn",
      "sys.path.insert(0, sys.argv[1])",
      "uvicorn.run('main:app', host='127.0.0.1', port=int(sys.argv[2]), log_level='warning')"
    ].join("; "),
    path.resolve("rag-service"),
    String(ragPort)
  ], { cwd: repoRoot, env: pythonEnv, stdio: ["ignore", "pipe", "pipe"], shell: false })
  ragProcess.stdout.on("data", appendRagOutput)
  ragProcess.stderr.on("data", appendRagOutput)
  await waitForRagHealth(ragBaseUrl)
  console.log("RAG_RUNTIME_OK real_service=ready chroma=isolated embeddings=loopback")

  await runCheckedAsync(process.execPath, [
    "--conditions=react-server",
    "--import", "./scripts/register-node-test-loader.mjs",
    "--import", "./scripts/register-document-rag-live-loader.mjs",
    worker
  ], { env: runtimeEnv, label: "document RAG live worker" })

  if (embeddingRequests < 4) {
    throw new Error(`expected multiple local embedding calls, got ${embeddingRequests}`)
  }
  if (unexpectedStubRequests !== 0) {
    throw new Error(`embedding stub received ${unexpectedStubRequests} unexpected requests`)
  }
}

async function cleanup() {
  const failures = []
  await stopChild(ragProcess).catch(error => failures.push(error))
  await closeServer(embeddingServer).catch(error => failures.push(error))

  let databaseCount = databaseCreated ? -1 : 0
  if (databaseCreated) {
    try {
      const source = new URL(sourceDatabaseUrl)
      source.pathname = "/postgres"
      source.search = ""
      const cleanupClient = new pg.Client({ connectionString: source.toString() })
      await cleanupClient.connect()
      try {
        await cleanupClient.query(
          "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1",
          [databaseName]
        )
        await cleanupClient.query(`DROP DATABASE IF EXISTS "${databaseName}"`)
        const check = await cleanupClient.query(
          "SELECT count(*)::int AS count FROM pg_database WHERE datname = $1",
          [databaseName]
        )
        databaseCount = Number(check.rows[0]?.count ?? -1)
      } finally {
        await cleanupClient.end()
      }
    } catch (error) {
      failures.push(error)
    }
  }

  if (temporaryRoot) {
    await rm(temporaryRoot, { recursive: true, force: true }).catch(error => failures.push(error))
  }
  console.log(
    `RUNTIME_CLEANUP remote_worker=absent database=${databaseCount} rag_storage=0 embedding_requests=${embeddingRequests} unexpected_requests=${unexpectedStubRequests}`
  )
  if (databaseCount !== 0) failures.push(new Error("temporary database cleanup was not proven"))
  if (failures.length) throw new AggregateError(failures, "isolated runtime cleanup failed")
}

try {
  await main()
} catch (error) {
  console.error(`SOL-DOC-J-03 isolated runtime: FAIL — ${error?.message || "unknown error"}`)
  process.exitCode = 1
} finally {
  await cleanup().catch(error => {
    console.error(`SOL-DOC-J-03 cleanup: FAIL — ${error?.message || "unknown error"}`)
    process.exitCode = 1
  })
}
