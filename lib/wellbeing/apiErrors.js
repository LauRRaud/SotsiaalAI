/**
 * TÖÖHEAOLU API — VEA VÄRAV (SOL-WB-11).
 *
 * MIS OLI. Iga tööheaolu marsruut logis 500-vea `safeError()` kaudu (õigesti),
 * aga pani vastusesse ikkagi `error?.message` — seega Prisma, skeemi või
 * infrastruktuuri vea SISEMINE TEKST jõudis autenditud kasutajani. Vastus nagu
 *
 *   „Invalid `prisma.wellbeingRecord.create()` invocation: … Unknown column …"
 *
 * ütleb välja tabelinimed, veerud ja mõnikord ka väärtused. Lisaks proovib
 * liides seda välja tõlkevõtmena kasutada, mis tegi juhuslikust veatekstist
 * avaliku API lepingu osa.
 *
 * MIS NÜÜD. Oma sõnumi ja `details` saab välja anda AINULT teadlikult visatud
 * domeeniviga: tal on 4xx staatus JA tema sõnum on tõlkevõtme kujuga
 * (`a.b.c`). Kõik muu — sh 4xx staatusega võõras erind — annab fikseeritud
 * üldvõtme ja korrelatsiooni-ID, mille järgi logist tegelik viga üles leiab.
 *
 * MIKS SIIN, MITTE `_shared.js`-is: see fail ei impordi `next-auth`-i ega
 * `@/auth`-i, seega teda saab ühiktestis kutsuda ilma serverikonteksti
 * püsti panemata. Värav, mida ei saa testida, ei ole värav.
 */

/* Tõlkevõtme kuju, mitte suvaline tekst: `wellbeing.errors.record_missing` jah,
   „Invalid `prisma...` invocation" ei. Tühikud, jutumärgid, suurtähed ja
   sulud jäävad kõik välja. */
const DOMAIN_MESSAGE_KEY_RE = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/u;

export const WELLBEING_UNEXPECTED_ERROR = "wellbeing.errors.unexpected";

export function isWellbeingDomainError(error) {
  const status = Number(error?.status);
  if (!Number.isInteger(status) || status < 400 || status >= 500) return false;
  return DOMAIN_MESSAGE_KEY_RE.test(String(error?.message || ""));
}

/* Ajatempel + juhuslik saba: piisav, et logirida ja kasutaja ekraan kokku viia,
   ja mitte midagi, mis ise infot kannaks. */
export function newWellbeingCorrelationId() {
  return `wb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Vastuse KEHA (mitte `Response`) — nii saab sama otsust kasutada nii
 * `wellbeingJson`-iga kui marsruudis, millel on oma vastusehelper.
 *
 * @returns `{ body, status, correlationId }`
 */
export function wellbeingErrorBody(error) {
  if (isWellbeingDomainError(error)) {
    return {
      status: Number(error.status),
      correlationId: null,
      body: {
        ok: false,
        message: error.message,
        /* `details` on sama otsuse teine pool: kui sõnum ei kvalifitseerunud,
           ei tule ka detailid kaasa. */
        ...(error.details ? { details: error.details } : {})
      }
    };
  }

  const correlationId = newWellbeingCorrelationId();
  const status = Number(error?.status);
  return {
    status: Number.isInteger(status) && status >= 500 && status <= 599 ? status : 500,
    correlationId,
    body: { ok: false, message: WELLBEING_UNEXPECTED_ERROR, correlationId }
  };
}
