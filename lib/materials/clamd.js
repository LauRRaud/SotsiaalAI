import net from "node:net"

const DEFAULT_TIMEOUT_MS = 8_000
const DEFAULT_SIGNATURE_MAX_AGE_MS = 36 * 60 * 60_000
const MAX_RESPONSE_BYTES = 8_192

function scannerError(code, message = code) {
  const error = new Error(message)
  error.code = code
  error.status = 503
  return error
}

function positiveInt(value, fallback) {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback
}

function connectionOptions(environment = process.env) {
  const socketPath = String(environment.MATERIALS_CLAMD_SOCKET || "/run/clamav/clamd.ctl").trim()
  if (socketPath) return { path: socketPath }
  const host = String(environment.MATERIALS_CLAMD_HOST || "").trim()
  const port = positiveInt(environment.MATERIALS_CLAMD_PORT, 3310)
  if (!host) throw scannerError("scanner_unavailable")
  if (!["127.0.0.1", "::1", "localhost"].includes(host)) throw scannerError("scanner_non_loopback_forbidden")
  return { host, port }
}

function clamdRequest(chunks, { environment = process.env, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(connectionOptions(environment))
    let response = Buffer.alloc(0)
    let settled = false
    const finish = (error, value) => {
      if (settled) return
      settled = true
      socket.destroy()
      if (error) reject(error)
      else resolve(value)
    }
    socket.setTimeout(positiveInt(timeoutMs, DEFAULT_TIMEOUT_MS), () => finish(scannerError("scanner_timeout")))
    socket.on("error", () => finish(scannerError("scanner_unavailable")))
    socket.on("data", chunk => {
      response = Buffer.concat([response, chunk])
      if (response.byteLength > MAX_RESPONSE_BYTES) finish(scannerError("scanner_protocol_error"))
      if (response.includes(0)) finish(null, response.subarray(0, response.indexOf(0)).toString("utf8"))
    })
    socket.on("end", () => {
      const value = response.toString("utf8").replace(/\0+$/u, "").trim()
      if (!value) finish(scannerError("scanner_protocol_error"))
      else finish(null, value)
    })
    socket.on("connect", () => {
      for (const chunk of chunks) socket.write(chunk)
    })
  })
}

function parseVersion(response, { now = new Date(), maxSignatureAgeMs = DEFAULT_SIGNATURE_MAX_AGE_MS } = {}) {
  const match = /^ClamAV\s+([^/\s]+)\/([^/\s]+)\/(.+)$/u.exec(String(response || "").trim())
  if (!match) throw scannerError("scanner_protocol_error")
  const signatureUpdatedAt = new Date(match[3])
  if (!Number.isFinite(signatureUpdatedAt.getTime())) throw scannerError("scanner_signature_unknown")
  if (now.getTime() - signatureUpdatedAt.getTime() > positiveInt(maxSignatureAgeMs, DEFAULT_SIGNATURE_MAX_AGE_MS)) {
    throw scannerError("scanner_signatures_stale")
  }
  return {
    engine: "ClamAV",
    engineVersion: match[1],
    signatureVersion: match[2],
    signatureUpdatedAt
  }
}

function instreamFrames(buffer) {
  const frames = [Buffer.from("zINSTREAM\0", "ascii")]
  const chunkSize = 64 * 1024
  for (let offset = 0; offset < buffer.byteLength; offset += chunkSize) {
    const chunk = buffer.subarray(offset, Math.min(buffer.byteLength, offset + chunkSize))
    const length = Buffer.allocUnsafe(4)
    length.writeUInt32BE(chunk.byteLength)
    frames.push(length, chunk)
  }
  frames.push(Buffer.alloc(4))
  return frames
}

export function createClamdScanner({ environment = process.env, now = () => new Date(), request = clamdRequest } = {}) {
  const timeoutMs = positiveInt(environment.MATERIALS_CLAMD_TIMEOUT_MS, DEFAULT_TIMEOUT_MS)
  const maxSignatureAgeMs = positiveInt(environment.MATERIALS_CLAMD_SIGNATURE_MAX_AGE_MS, DEFAULT_SIGNATURE_MAX_AGE_MS)
  return {
    async scan(bufferLike) {
      const buffer = Buffer.isBuffer(bufferLike) ? bufferLike : Buffer.from(bufferLike || [])
      const versionResponse = await request([Buffer.from("zVERSION\0", "ascii")], { environment, timeoutMs })
      const metadata = parseVersion(versionResponse, { now: now(), maxSignatureAgeMs })
      const response = String(await request(instreamFrames(buffer), { environment, timeoutMs })).trim()
      if (/^stream:\s+OK$/u.test(response)) return { state: "CLEAN", ...metadata }
      const infected = /^stream:\s+(.+)\s+FOUND$/u.exec(response)
      if (infected) return { state: "INFECTED", threatCode: "malware_detected", ...metadata }
      if (/^stream:.*ERROR$/u.test(response)) throw scannerError("scanner_protocol_error")
      throw scannerError("scanner_unknown_result")
    }
  }
}

export { parseVersion as parseClamdVersion }
