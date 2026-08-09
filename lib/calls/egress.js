import { resolveEgressOutputFilePath } from "./recordingStorage.js";

/**
 * SOL-CALL-01/03 — provider peab suutma stoppi KINNITADA, mitte ainult käskida.
 *
 * MIKS SIIA MIDAGI LISANDUS. Senine provider oskas kaht asja: `startAudioRecording`
 * ja `stopRecording`. Kummalgi ei olnud tähtaega ja kummastki ei saanud teada, kas
 * salvestus PÄRISELT lõppes. Sellest sündis SOL-CALL-01 tuum: nõusoleku tagasivõtul
 * kutsuti stoppi, viga neelati alla ja andmebaasi kirjutati `STOPPED` — st platvorm
 * väitis, et salvestamine lõppes, ilma et keegi oleks seda kontrollinud.
 *
 * `getEgressStatus()` ei OTSUSTA midagi. Ta raporteerib ausalt, mida provider ütleb,
 * ja jätab poliitika teenusekihile. See on tahtlik: „ei leidnud" tähendab LiveKitis
 * kaht täiesti erinevat asja — kas egress'i ei olnud kunagi, või ta lõppes ammu ja
 * on ajaloost välja koristatud. Kumb neist on tõend, sõltub sellest, kui vana on
 * meie oma kirje; seda teab teenusekiht, mitte see fail.
 *
 * TIMEOUT ON SIIN, MITTE KUTSUJAS. Ilma tähtajata võib SDK-kutse rippuda määramata
 * aja, ja rippuv stop on halvim variant: nõusolek on tagasi võetud, kasutaja ootab
 * vastust ja egress kirjutab edasi. Parem on kiire aus tõrge, mille peale saab
 * püsiva taasproovi käivitada, kui lõputu vaikus.
 */

const DEFAULT_TIMEOUT_MS = 15_000;

function envEnabled(value) {
  return String(value || "false").trim().toLowerCase() === "true";
}

function resolveTimeoutMs(env = process.env) {
  const raw = Number(env.LIVEKIT_EGRESS_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
}

function getRecordingRuntimeConfig(env = process.env) {
  const recordingEnabled = envEnabled(env.RECORDING_ENABLED);
  const liveKitEgressEnabled = envEnabled(env.LIVEKIT_EGRESS_ENABLED);
  const liveKitConfigured = Boolean(env.LIVEKIT_URL && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET);
  return {
    recordingEnabled,
    liveKitEgressEnabled,
    liveKitConfigured,
    configured: recordingEnabled && liveKitEgressEnabled && liveKitConfigured
  };
}

function recordingDisabledError() {
  return new Error("call.recording_disabled");
}

/**
 * Tähtaeg masinkoodiga, et teenusekiht saaks timeout'i eristada päris tõrkest:
 * timeout tähendab „ei tea", päris tõrge tähendab sageli „ei õnnestunud". Neid ei
 * tohi kokku valada, sest esimene nõuab kontrollpäringut ja teine taasproovi.
 */
function withTimeout(promise, timeoutMs, code) {
  let timer = null;
  const timeout = new Promise((_resolve, rejectTimeout) => {
    timer = setTimeout(() => {
      const error = new Error(code);
      error.code = code;
      error.isTimeout = true;
      rejectTimeout(error);
    }, timeoutMs);
    timer?.unref?.();
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * LiveKiti `EgressStatus` tuleb SDK-st kord stringina, kord numbrilise enum'ina.
 * Loeme mõlemat ja taandame kaheks küsimuseks: kas ta on lõppenud, ja mis nimi tal on.
 * `EGRESS_ENDING` EI OLE lõppenud — ta on lõpetamas, ja nõusoleku mõttes tähendab
 * see endiselt „kirjutab veel".
 */
const EGRESS_STATUS_NAMES = [
  "EGRESS_STARTING",
  "EGRESS_ACTIVE",
  "EGRESS_ENDING",
  "EGRESS_COMPLETE",
  "EGRESS_FAILED",
  "EGRESS_ABORTED",
  "EGRESS_LIMIT_REACHED"
];

const TERMINAL_EGRESS_STATUSES = new Set([
  "EGRESS_COMPLETE",
  "EGRESS_FAILED",
  "EGRESS_ABORTED",
  "EGRESS_LIMIT_REACHED"
]);

export function normalizeEgressStatus(value) {
  if (typeof value === "number" && Number.isInteger(value)) {
    return EGRESS_STATUS_NAMES[value] || `EGRESS_UNKNOWN_${value}`;
  }
  const name = String(value || "").trim().toUpperCase();
  return name || "EGRESS_UNKNOWN";
}

export function isTerminalEgressStatus(value) {
  return TERMINAL_EGRESS_STATUSES.has(normalizeEgressStatus(value));
}

export function createConfiguredEgressProvider(env = process.env) {
  const config = getRecordingRuntimeConfig(env);
  const timeoutMs = resolveTimeoutMs(env);

  async function egressClient() {
    const { EgressClient } = await import("livekit-server-sdk");
    return new EgressClient(env.LIVEKIT_URL, env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);
  }

  return {
    configured: config.configured,

    async startAudioRecording({ providerRoomName, fileName }) {
      if (!config.configured) throw recordingDisabledError();
      const { EncodedFileType } = await import("livekit-server-sdk");
      const client = await egressClient();
      const filepath = resolveEgressOutputFilePath(fileName, env);
      const info = await withTimeout(
        client.startRoomCompositeEgress(
          providerRoomName,
          {
            file: {
              filepath,
              fileType: EncodedFileType.OGG
            }
          },
          {
            audioOnly: true,
            videoOnly: false
          }
        ),
        timeoutMs,
        "call.egress_start_timeout"
      );
      return {
        egressId: info?.egressId || ""
      };
    },

    /**
     * Tagastab kinnituse, mitte tühjuse. `stopped: true` tähendab, et provider ise
     * ütles terminaalse seisu — ainult see kõlbab tõendiks, mille peal tohib DB-sse
     * lõppseisu kirjutada.
     */
    async stopRecording({ egressId }) {
      if (!config.configured) throw recordingDisabledError();
      if (!egressId) return { ok: true, stopped: true, status: "EGRESS_UNKNOWN", reason: "no_egress_id" };
      const client = await egressClient();
      const info = await withTimeout(
        client.stopEgress(egressId),
        timeoutMs,
        "call.egress_stop_timeout"
      );
      const status = normalizeEgressStatus(info?.status);
      return { ok: true, stopped: isTerminalEgressStatus(status), status };
    },

    /**
     * Kontrollpäring. Kasutatakse siis, kui stop tõrkus või aegus ja meil on vaja
     * teada, kas ta ikkagi jõudis kohale. `known: false` = provider ei tunne seda
     * egress'i; kas see on tõend lõppemisest, otsustab teenusekiht kirje vanuse järgi.
     */
    async getEgressStatus({ egressId }) {
      if (!config.configured) throw recordingDisabledError();
      if (!egressId) return { known: false, stopped: true, status: "EGRESS_UNKNOWN", reason: "no_egress_id" };
      const client = await egressClient();
      const list = await withTimeout(
        client.listEgress({ egressId }),
        timeoutMs,
        "call.egress_status_timeout"
      );
      const info = Array.isArray(list) ? list.find(item => item?.egressId === egressId) || list[0] : list;
      if (!info) return { known: false, stopped: false, status: "EGRESS_NOT_FOUND" };
      const status = normalizeEgressStatus(info?.status);
      return { known: true, stopped: isTerminalEgressStatus(status), status };
    }
  };
}
