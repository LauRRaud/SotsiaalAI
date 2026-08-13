import { spawn } from "node:child_process"

const DEFAULT_COMMAND = "/usr/local/bin/sotsiaalai-material-cdr"
const DEFAULT_TIMEOUT_MS = 180_000
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024
const MAX_ERROR_BYTES = 64 * 1024
const SUPPORTED_MIMES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
])

function cdrError(code, status = 503) {
  const error = new Error(code)
  error.code = code
  error.status = status
  return error
}

function positiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function runCdrCommand(command, args, {
  input,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  spawnProcess = spawn
} = {}) {
  return new Promise((resolve, reject) => {
    let settled = false
    let stdoutBytes = 0
    let stderrBytes = 0
    const stdout = []
    const stderr = []
    const child = spawnProcess(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      env: {
        PATH: process.env.PATH || "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
        HOME: process.env.HOME || "/home/ubuntu",
        LANG: "C.UTF-8",
        LC_ALL: "C.UTF-8"
      }
    })

    const finish = (error, output = null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (error) reject(error)
      else resolve(output)
    }
    const timer = setTimeout(() => {
      child.kill("SIGKILL")
      finish(cdrError("material_cdr_timeout"))
    }, timeoutMs)

    child.on("error", error => {
      finish(cdrError(error?.code === "ENOENT" ? "material_cdr_unavailable" : "material_cdr_failed"))
    })
    child.stdout.on("data", chunk => {
      stdoutBytes += chunk.length
      if (stdoutBytes > MAX_OUTPUT_BYTES) {
        child.kill("SIGKILL")
        finish(cdrError("material_cdr_output_too_large", 422))
        return
      }
      stdout.push(chunk)
    })
    child.stderr.on("data", chunk => {
      stderrBytes += chunk.length
      if (stderrBytes <= MAX_ERROR_BYTES) stderr.push(chunk)
    })
    child.on("close", code => {
      if (code !== 0) return finish(cdrError("material_cdr_failed"))
      finish(null, Buffer.concat(stdout))
    })
    child.stdin.on("error", () => {})
    child.stdin.end(input)
  })
}

export function createLocalMaterialCdr({
  command = process.env.MATERIALS_CDR_COMMAND || DEFAULT_COMMAND,
  timeoutMs = positiveInt(process.env.MATERIALS_CDR_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
  run = runCdrCommand
} = {}) {
  return {
    async extractSanitizedText({ buffer, mime } = {}) {
      if (!SUPPORTED_MIMES.has(mime)) throw cdrError("material_cdr_mime_not_supported", 415)
      const input = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || [])
      if (!input.length) throw cdrError("material_sanitized_derivative_invalid", 422)
      return run(command, ["--mime", mime], { input, timeoutMs })
    }
  }
}

export { DEFAULT_COMMAND as DEFAULT_MATERIAL_CDR_COMMAND, runCdrCommand }
