/**
 * STT-MAHU RESERVEERIMINE JA LÕPLIK ARVESTUS (SOL-DOC-02).
 *
 * MIS PUUDUS. Helifaili transkribeerimise marsruut kutsus päris teenusepakkujat, aga ei
 * reserveerinud ega arvestanud ühtegi `STT_SECONDS` sekundit. Paketis on see piir olemas
 * (klient 900 s/kuus, töötaja 3600, teenusepakkuja 7200), aga marsruudil oli ainult
 * minutipõhine mälupõhine rate-limit — seega sai selle otsepunkti kaudu tekitada piiramatut
 * perioodikulu ja kasutusülevaade ei näidanud sellest midagi.
 *
 * KAKS ERI KÜSIMUST, mida siin lahus hoitakse:
 *
 *  1. **Kui palju reserveerida ENNE kutset?** Vastust ei ole veel olemas — sisu ei ole
 *     transkribeeritud. Seega peab see olema turvaline ÜLEMPIIR, mitte oletus.
 *  2. **Kui palju arvestada PÄRAST kutset?** Siin on juba päris vastus: teenusepakkuja enda
 *     mõõdetud kestus, muidu failist loetud kestus.
 *
 * Reservatsiooni ülempiir tuleb kolmest allikast, tugevuse järjekorras: teadaolev kestus
 * (kõnesalvestisel on ta andmebaasis), failist loetud kestus, ja kui kumbagi ei ole —
 * baitidest tuletatud piir kõige madalama usutava kõne-bitikiiruse järgi. Viimane on
 * teadlikult HELDE: liiga suur reservatsioon parandatakse commit'i ajal tegeliku kestusega
 * ära ja teda hoitakse ainult päringu kestel, liiga väike aga tähendaks, et lubatud piirist
 * saab mööda minna. Vale suund on siin see, mis jääb märkamatuks.
 *
 * Lõplik arvestus on **piiratud reserveeritud mahuga**. Kui teenusepakkuja ütleb rohkem, kui
 * me ülempiiriks pidasime, siis oli meie hinnang vale — aga sellest ei tohi saada 500-t
 * kasutajale, kelle transkript on juba olemas: `commit` valideerib ämbri invariandi ja
 * suurema summa peale kukuks.
 */

// Opuse kitsasriba-kõne põrand. Madalam usutav bitikiirus tähendaks pikemat lubatud kestust
// sama faili kohta, seega on see number ülempiiri arvutuses KÕIGE konservatiivsem valik.
export const STT_MIN_SPEECH_BITRATE_BPS = 8000

// Kui ei ole teada kestust, faili suurust ega midagi muud, jääb alles ainult see: sama
// põrand, mida kasutab `/api/stt`. Ilma temata reserveeriks nulli ja piir ei kehtiks üldse.
export const STT_UNKNOWN_FALLBACK_SECONDS = 60

function positiveSeconds(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Math.max(1, Math.ceil(parsed))
}

function upperBoundFromBytes(sizeBytes, minBitrateBps) {
  const bytes = Number(sizeBytes)
  const bitrate = Number(minBitrateBps) > 0 ? Number(minBitrateBps) : STT_MIN_SPEECH_BITRATE_BPS
  if (!Number.isFinite(bytes) || bytes <= 0) return null
  return Math.max(1, Math.ceil((bytes * 8) / bitrate))
}

/**
 * Turvaline ülempiir, mille järgi reserveerida ENNE teenusepakkuja kutset.
 *
 * @param knownSeconds   andmebaasist teada kestus (kõnesalvestis) — tugevaim allikas.
 * @param measuredSeconds failist loetud kestus.
 * @param sizeBytes      faili suurus, millest tuletatakse piir, kui kestust ei saa lugeda.
 * @param minBitrateBps  madalaim usutav bitikiirus (süstitav; vaikimisi kõne põrand).
 */
export function resolveSttReservationSeconds({
  knownSeconds = null,
  measuredSeconds = null,
  sizeBytes = null,
  minBitrateBps = STT_MIN_SPEECH_BITRATE_BPS
} = {}) {
  return (
    positiveSeconds(knownSeconds) ||
    positiveSeconds(measuredSeconds) ||
    upperBoundFromBytes(sizeBytes, minBitrateBps) ||
    STT_UNKNOWN_FALLBACK_SECONDS
  )
}

/**
 * Tegelik kestus, mis commit'itakse. Teenusepakkuja enda mõõt on tugevaim, sest tema järgi
 * tekib ka päris kulu. Kui ühtegi mõõtu ei ole, jääb reserveeritud maht — mitte null, sest
 * tasuta ei tohi tehtud töö jääda.
 */
export function resolveSttCommittedSeconds({
  providerUsage = null,
  knownSeconds = null,
  measuredSeconds = null,
  reservedSeconds = null
} = {}) {
  const reserved = positiveSeconds(reservedSeconds)
  const fromProvider =
    String(providerUsage?.type || "").trim() === "duration" ? positiveSeconds(providerUsage?.seconds) : null

  const actual =
    fromProvider ||
    positiveSeconds(knownSeconds) ||
    positiveSeconds(measuredSeconds) ||
    reserved ||
    STT_UNKNOWN_FALLBACK_SECONDS

  if (!reserved) return actual
  return Math.min(actual, reserved)
}
