import crypto from "node:crypto";
import net from "node:net";
import tls from "node:tls";
import os from "node:os";
const SMTP_TIMEOUT_MS = 15000;
const SMTP_REQUIRE_TLS = ["1", "true", "yes"].includes(
  String(process.env.SMTP_REQUIRE_TLS || "").trim().toLowerCase()
);

function readPositiveInteger(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return Math.max(1, Math.trunc(numeric));
}

/**
 * SOL-NOTIF-01 — SAATJA AADRESS TULEB ÜHEST KOHAST.
 *
 * Platvormi oma SMTP-transport loeb envelope-saatja AINULT `message.from`
 * väärtusest ja katkestab tema puudumisel („EMAIL_FROM peab sisaldama kehtivat
 * aadressi"). Teavitusworker ei andnud seda välja üldse, seega päris
 * transpordiga läks iga teavituskiri RETRY/FAILED seisu — rakendusesisene teade
 * oli olemas, lubatud kiri mitte. Fake-mailer testis võttis suvalise objekti
 * vastu ja ei näinud sellest midagi.
 *
 * Sama `EMAIL_FROM || SMTP_FROM` rida oli koodibaasis kaheksas kohas laiali;
 * siin on ta nimeliselt olemas, et „sama autoriteetne konfiguratsioon" oleks
 * mõõdetav väide, mitte kokkulepe.
 */
export function resolveMailFrom() {
  return String(process.env.EMAIL_FROM || process.env.SMTP_FROM || "").trim();
}

export function resolveBaseUrl() {
  const direct = process.env.NEXTAUTH_URL || process.env.AUTH_URL || process.env.APP_URL;
  if (direct) return direct;
  const vercel = process.env.VERCEL_URL;
  if (vercel) return vercel.startsWith("http") ? vercel : `https://${vercel}`;
  return process.env.NODE_ENV === "development" ? "http://localhost:3000" : undefined;
}
function parseConnectionString(connectionString) {
  const url = new URL(connectionString);
  const secure = url.protocol === "smtps:" || url.protocol === "smtp+ssl:";
  const host = url.hostname;
  const port = url.port ? Number(url.port) : secure ? 465 : 587;
  const user = url.username ? decodeURIComponent(url.username) : undefined;
  const pass = url.password ? decodeURIComponent(url.password) : undefined;
  return {
    host,
    port,
    secure,
    auth: user && pass ? {
      user,
      pass
    } : undefined
  };
}
function resolveSmtpConfig() {
  if (process.env.EMAIL_SERVER) return parseConnectionString(process.env.EMAIL_SERVER);
  if (process.env.SMTP_HOST) {
    const port = readPositiveInteger(process.env.SMTP_PORT, 587);
    const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465;
    const authUser = process.env.SMTP_USER || undefined;
    const authPass = process.env.SMTP_PASS || undefined;
    return {
      host: process.env.SMTP_HOST,
      port,
      secure,
      auth: authUser && authPass ? {
        user: authUser,
        pass: authPass
      } : undefined
    };
  }
  return undefined;
}

export function hasConfiguredEmailTransport() {
  return Boolean(resolveSmtpConfig());
}

export class EmailTransportUnavailableError extends Error {
  constructor() {
    super("Email transport is not configured.");
    this.name = "EmailTransportUnavailableError";
    this.code = "EMAIL_TRANSPORT_NOT_CONFIGURED";
    this.retryable = false;
  }
}

function isExplicitDevMockEnabled() {
  if (process.env.NODE_ENV === "production") return false;
  return ["1", "true", "yes"].includes(
    String(process.env.EMAIL_DEV_MOCK || "").trim().toLowerCase()
  );
}

function createDevTransporter(tag = "mailer") {
  return {
    async sendMail(message) {
      const recipientCount = normalizeRecipients(message?.to).length;
      console.info(`[${tag}] Explicit development email mock`, {
        recipientCount,
        hasSubject: Boolean(message?.subject),
        hasText: Boolean(message?.text),
        hasHtml: Boolean(message?.html)
      });
      return {
        message: "",
        mocked: true
      };
    }
  };
}

function createUnavailableTransporter() {
  return {
    async sendMail() {
      throw new EmailTransportUnavailableError();
    }
  };
}
async function connectSocket({
  host,
  port,
  secure
}) {
  return new Promise((resolve, reject) => {
    const socket = secure ? tls.connect({
      host,
      port,
      servername: host
    }) : net.createConnection({
      host,
      port
    });
    const onConnect = () => {
      socket.setTimeout(SMTP_TIMEOUT_MS, () => socket.destroy(new Error("SMTP ühendus aegus.")));
      resolve(socket);
    };
    socket.once(secure ? "secureConnect" : "connect", onConnect);
    socket.once("error", reject);
    socket.once("timeout", () => reject(new Error("SMTP ühendus aegus.")));
  });
}
async function upgradeToTls(socket, host) {
  return new Promise((resolve, reject) => {
    const secureSocket = tls.connect({
      socket,
      servername: host
    }, () => {
      secureSocket.setTimeout(SMTP_TIMEOUT_MS, () => secureSocket.destroy(new Error("SMTP ühendus aegus.")));
      resolve(secureSocket);
    });
    secureSocket.once("error", reject);
  });
}
async function readResponse(socket) {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const onData = chunk => {
      buffer += chunk.toString("utf8");
      if (/\r?\n$/.test(buffer)) {
        const lines = buffer.split(/\r?\n/).filter(Boolean);
        const last = lines[lines.length - 1] || "";
        const code = Number(last.slice(0, 3));
        socket.off("data", onData);
        resolve({
          code,
          lines
        });
      }
    };
    const onError = e => {
      socket.off("data", onData);
      reject(e);
    };
    const onClose = () => {
      socket.off("data", onData);
      reject(new Error("SMTP ühendus suleti ootamatult."));
    };
    socket.on("data", onData);
    socket.once("error", onError);
    socket.once("close", onClose);
    socket.once("end", onClose);
  });
}
async function sendCommand(socket, command) {
  if (command) socket.write(`${command}\r\n`);
  return readResponse(socket);
}
function parseEhloResponse(response) {
  const capabilities = response.lines.map(l => l.slice(4).trim()).map(c => c.toUpperCase());
  return {
    capabilities,
    supportsStartTls: capabilities.includes("STARTTLS")
  };
}
async function ensureAuthenticated(socket, auth) {
  if (!auth) return;
  const initial = await sendCommand(socket, "AUTH LOGIN");
  if (initial.code === 503) return;
  if (initial.code !== 334) throw new Error(`SMTP AUTH LOGIN ebaõnnestus (kood ${initial.code}).`);
  const userRes = await sendCommand(socket, Buffer.from(auth.user, "utf8").toString("base64"));
  if (userRes.code !== 334) throw new Error(`SMTP AUTH kasutajanimi ebaõnnestus (kood ${userRes.code}).`);
  const passRes = await sendCommand(socket, Buffer.from(auth.pass, "utf8").toString("base64"));
  if (passRes.code !== 235 && passRes.code !== 503) {
    throw new Error(`SMTP AUTH parool ebaõnnestus (kood ${passRes.code}).`);
  }
}
function extractAddress(value) {
  if (!value) return "";
  const match = /<([^>]+)>/.exec(value);
  return match ? match[1].trim() : String(value).trim();
}
function normalizeRecipients(to) {
  if (!to) return [];
  if (Array.isArray(to)) return to.flatMap(t => normalizeRecipients(t));
  return String(to).split(",").map(p => p.trim()).filter(Boolean);
}
function encodeSubject(subject) {
  if (!subject) return "";
  return /^[\x20-\x7E]*$/.test(subject) ? subject : `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
}
function encodeHeaderPhrase(value) {
  if (!value) return "";
  return /^[\x20-\x7E]*$/.test(value)
    ? value
    : `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}
function formatFromHeader(from) {
  const raw = String(from || "").trim();
  if (!raw) return "";
  if (/<[^>]+>/.test(raw)) return raw;
  const displayName = String(process.env.EMAIL_FROM_NAME || "").trim();
  if (!displayName) return raw;
  return `${encodeHeaderPhrase(displayName)} <${raw}>`;
}
function domainFromAddress(address) {
  const raw = String(address || "").trim();
  const at = raw.lastIndexOf("@");
  if (at < 0) return "sotsiaal.ai";
  const domain = raw.slice(at + 1).trim().toLowerCase();
  return /^[a-z0-9.-]+$/.test(domain) ? domain : "sotsiaal.ai";
}
function normalizeMessageId(value, fallbackDomain) {
  const raw = String(value || "").trim().replace(/^<|>$/g, "");
  if (!raw) {
    return `${Date.now()}.${crypto.randomBytes(12).toString("hex")}@${fallbackDomain}`;
  }
  if (/\r|\n/u.test(raw)) throw new TypeError("Invalid Message-ID.");
  const parts = raw.split("@");
  const local = parts[0] || "";
  const domain = parts.length === 1 ? fallbackDomain : parts[1] || "";
  if (parts.length > 2 || !/^[A-Za-z0-9._+-]+$/u.test(local) || !/^[A-Za-z0-9.-]+$/u.test(domain)) {
    throw new TypeError("Invalid Message-ID.");
  }
  return `${local}@${domain}`;
}

export function buildMimeMessage({
  from,
  to,
  subject,
  text,
  html,
  replyTo,
  messageId
}) {
  const boundary = `sotsiaalai-${crypto.randomBytes(12).toString("hex")}`;
  const normalizedTo = Array.isArray(to) ? to.join(", ") : to;
  const fromHeader = formatFromHeader(from);
  const messageIdDomain = domainFromAddress(extractAddress(from));
  const normalizedMessageId = normalizeMessageId(messageId, messageIdDomain);
  const headers = [
    `From: ${fromHeader}`,
    `To: ${normalizedTo}`,
    `Subject: ${encodeSubject(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${normalizedMessageId}>`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "X-Auto-Response-Suppress: All"
  ];
  if (replyTo) headers.push(`Reply-To: ${replyTo}`);
  const plain = text || (html ? html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "");
  const htmlPart = html || (text ? `<pre>${text}</pre>` : plain);
  const parts = [`--${boundary}`, "Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: 8bit", "", plain, `--${boundary}`, "Content-Type: text/html; charset=utf-8", "Content-Transfer-Encoding: 8bit", "", htmlPart, `--${boundary}--`, ""];
  return `${headers.join("\r\n")}\r\n\r\n${parts.join("\r\n")}`;
}
async function sendSmtpMail({
  host,
  port,
  secure,
  auth,
  message
}) {
  const recipients = normalizeRecipients(message.to);
  if (!recipients.length) throw new Error("E-kirjal peab olema vähemalt üks adressaat.");
  const envelopeFrom = extractAddress(message.from);
  if (!envelopeFrom) throw new Error("EMAIL_FROM peab sisaldama kehtivat aadressi.");
  let socket = await connectSocket({
    host,
    port,
    secure
  });
  try {
    const greeting = await readResponse(socket);
    if (greeting.code !== 220) throw new Error(`SMTP server vastas koodiga ${greeting.code}.`);
    const ehloHost = os.hostname() || "localhost";
    let ehlo = parseEhloResponse(await sendCommand(socket, `EHLO ${ehloHost}`));
    if (!secure && SMTP_REQUIRE_TLS && !ehlo.supportsStartTls) {
      throw new Error("SMTP server ei toeta STARTTLS-i, kuid SMTP_REQUIRE_TLS=true.");
    }
    if (!secure && ehlo.supportsStartTls) {
      const startTls = await sendCommand(socket, "STARTTLS");
      if (startTls.code !== 220) throw new Error(`STARTTLS käivitamine ebaõnnestus (kood ${startTls.code}).`);
      socket = await upgradeToTls(socket, host);
      ehlo = parseEhloResponse(await sendCommand(socket, `EHLO ${ehloHost}`));
    }
    await ensureAuthenticated(socket, auth);
    const mailFrom = await sendCommand(socket, `MAIL FROM:<${envelopeFrom}>`);
    if (mailFrom.code !== 250) throw new Error(`MAIL FROM käsk ebaõnnestus (kood ${mailFrom.code}).`);
    for (const rcpt of recipients) {
      const res = await sendCommand(socket, `RCPT TO:<${extractAddress(rcpt)}>`);
      if (![250, 251].includes(res.code)) throw new Error(`RCPT TO ebaõnnestus (kood ${res.code}).`);
    }
    const dataStart = await sendCommand(socket, "DATA");
    if (dataStart.code !== 354) throw new Error(`DATA käsk ebaõnnestus (kood ${dataStart.code}).`);
    const payload = buildMimeMessage(message);
    const stuffedPayload = payload.replace(/^\./gm, "..");
    socket.write(`${stuffedPayload}\r\n.\r\n`);
    const dataResult = await readResponse(socket);
    if (dataResult.code !== 250) throw new Error(`Kirja edastamine ebaõnnestus (kood ${dataResult.code}).`);
    await sendCommand(socket, "QUIT");
    return {
      message: payload
    };
  } finally {
    socket.end();
  }
}
function createTransporter(tag = "mailer") {
  const config = resolveSmtpConfig();
  if (!config) {
    if (isExplicitDevMockEnabled()) return createDevTransporter(tag);
    console.warn(`[${tag}] Email transport is unavailable.`);
    return createUnavailableTransporter();
  }
  return {
    async sendMail(message) {
      return sendSmtpMail({
        ...config,
        message
      });
    }
  };
}
export function getMailer(tag = "mailer") {
  const g = globalThis;
  if (!g.__sotsiaalai_mailer) g.__sotsiaalai_mailer = createTransporter(tag);
  return g.__sotsiaalai_mailer;
}
