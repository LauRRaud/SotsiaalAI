import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const MASTER_SOURCE_RUNTIME_SCHEMA_VERSION = "master-sources-runtime-v1";

export class MasterSourceStateConflictError extends Error {
  constructor(message = "master_source_state_conflict") {
    super(message);
    this.name = "MasterSourceStateConflictError";
    this.code = "master_source_state_conflict";
  }
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function stateFingerprint(value) {
  return crypto.createHash("sha256").update(stable(value), "utf8").digest("hex");
}

export function createMasterSourceRuntimeState(registrySha256, now = new Date()) {
  return {
    schema_version: MASTER_SOURCE_RUNTIME_SCHEMA_VERSION,
    registry_sha256: String(registrySha256 || ""),
    revision: 0,
    updated_at: now.toISOString(),
    sources: {}
  };
}

export function validateMasterSourceRuntimeState(value, registrySha256 = null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("master_source_runtime_state_invalid");
  if (value.schema_version !== MASTER_SOURCE_RUNTIME_SCHEMA_VERSION) throw new TypeError("master_source_runtime_schema_invalid");
  if (!Number.isInteger(value.revision) || value.revision < 0) throw new TypeError("master_source_runtime_revision_invalid");
  if (!value.sources || typeof value.sources !== "object" || Array.isArray(value.sources)) throw new TypeError("master_source_runtime_sources_invalid");
  if (registrySha256 && value.registry_sha256 !== registrySha256) throw new MasterSourceStateConflictError("master_source_registry_sha_mismatch");
  return value;
}

export async function readMasterSourceRuntimeState(filePath, registrySha256, now = new Date()) {
  try {
    const text = await fs.readFile(filePath, "utf8");
    const state = validateMasterSourceRuntimeState(JSON.parse(text), registrySha256);
    return { state, fingerprint: stateFingerprint(state), exists: true };
  } catch (error) {
    if (error?.code === "ENOENT") {
      const state = createMasterSourceRuntimeState(registrySha256, now);
      return { state, fingerprint: null, exists: false };
    }
    throw error;
  }
}

async function acquireLock(lockPath, attempts = 40) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fs.open(lockPath, "wx");
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      await new Promise(resolve => setTimeout(resolve, Math.min(25 * (attempt + 1), 200)));
    }
  }
  throw new MasterSourceStateConflictError("master_source_state_lock_timeout");
}

export async function writeMasterSourceRuntimeStateCas(filePath, nextState, { expectedFingerprint, registrySha256, now = new Date() } = {}) {
  const absolute = path.resolve(filePath);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  const lockPath = `${absolute}.lock`;
  const lock = await acquireLock(lockPath);
  try {
    const current = await readMasterSourceRuntimeState(absolute, registrySha256, now);
    if (expectedFingerprint !== undefined && current.fingerprint !== expectedFingerprint) {
      throw new MasterSourceStateConflictError();
    }
    validateMasterSourceRuntimeState(nextState, registrySha256);
    const finalState = {
      ...nextState,
      revision: current.state.revision + 1,
      updated_at: now.toISOString()
    };
    const temporary = `${absolute}.tmp-${process.pid}-${crypto.randomUUID()}`;
    await fs.writeFile(temporary, `${JSON.stringify(finalState, null, 2)}\n`, "utf8");
    await fs.rename(temporary, absolute);
    return { state: finalState, fingerprint: stateFingerprint(finalState) };
  } finally {
    await lock.close().catch(() => null);
    await fs.unlink(lockPath).catch(() => null);
  }
}

export function createMasterSourceRuntimeStateStore(filePath, registrySha256, now = () => new Date()) {
  return {
    async read() {
      return readMasterSourceRuntimeState(filePath, registrySha256, now());
    },
    async mutate(expectedFingerprint, mutate) {
      const current = await readMasterSourceRuntimeState(filePath, registrySha256, now());
      if (expectedFingerprint !== undefined && current.fingerprint !== expectedFingerprint) throw new MasterSourceStateConflictError();
      const next = await mutate(structuredClone(current.state), current);
      return writeMasterSourceRuntimeStateCas(filePath, next, { expectedFingerprint: current.fingerprint, registrySha256, now: now() });
    }
  };
}
