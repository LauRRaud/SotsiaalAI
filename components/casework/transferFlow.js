/**
 * JTA-V1 (E6) — L16 kopeerimisjärjekord ILMA JSX-ita.
 *
 * MIKS OMA FAIL. Sama õppetund mis `workbenchView.js`-il (omaniku kuues audit):
 * kandev otsus, mis elab JSX-failis, ei ole testitav — testijooksja ei teisenda
 * JSX-i ja alles jääks regex-test, mis kontrollib koodi KUJU, mitte käitumist.
 *
 * Ja siin on kandev otsus JÄRJEKORD:
 *
 *     1. plokk        server koostab teksti
 *     2. lõikelaud    brauser kirjutab
 *     3. AINULT siis  audit salvestub
 *
 * Vale järjekord (audit → lõikelaud → brauser keeldub) tähendaks, et auditis
 * seisab kopeerimine, mida ei toimunud — ja L8 järgi on see rida TÕEND. Ükski
 * veateade ei tekiks; katkine oleks ainult tähendus. Seepärast on `runCopyForStar2`
 * puhas funktsioon nelja süstitud sammuga ja test kontrollib KUTSETE JÄRJEKORDA.
 *
 * `clientActionId` sünnib SIIN, kohe alguses ja ENNE lõikelauda (L22) — ning ta
 * jääb `pendingAudit`-i sisse alles, kui audit ebaõnnestus. Uus võti korduskatsel
 * tähendaks andmebaasi jaoks TEIST tegu ja audit loeks ühe kopeerimise kaheks.
 *
 * OOTEL AUDITID ON JÄRJEKORD, MITTE ÜKS PESA (SOL-CW-05). Varem hoidis liides
 * ühte `pendingAudit`-i ja iga uus kopeerimine kirjutas eelmise üle: kasutaja
 * kopeeris kaks korda, esimese teo jälg kadus jäädavalt ja ükski veateade ei
 * tekkinud. Kopeerimise keelamine ootel auditi ajal oleks teine võimalik
 * lahendus, aga see lukustaks töötaja välja tööst, mille ta juba tegi — ja
 * mõlemad kopeerimised TOIMUSID päriselt, seega mõlemad väärivad tõendit.
 */

export const COPY_PHASE = Object.freeze({
  COPIED: "copied",
  CLIPBOARD_FAILED: "clipboard_failed",
  AUDIT_FAILED: "audit_failed",
  EMPTY: "empty",
  LOAD_FAILED: "load_failed"
});

function errorKeyOf(error) {
  return error?.messageKey || "casework.errors.unexpected";
}

/**
 * @param {object} steps
 * @param {() => Promise<object>} steps.loadBlock      server → plokk
 * @param {(text: string) => Promise<boolean>} steps.writeClipboard
 * @param {(input: { fieldKeys: string[], clientActionId: string }) => Promise<unknown>} steps.recordCopy
 * @param {() => string} steps.createActionKey
 * @returns {Promise<{ phase: string, block: object|null, errorKey: string|null, pendingAudit: object|null }>}
 */
export async function runCopyForStar2({ loadBlock, writeClipboard, recordCopy, createActionKey }) {
  /* VÕTI ENNE KÕIKE MUUD (L22). */
  const clientActionId = createActionKey();

  let block = null;
  try {
    block = await loadBlock();
  } catch (error) {
    return { phase: COPY_PHASE.LOAD_FAILED, block: null, errorKey: errorKeyOf(error), pendingAudit: null };
  }

  if (!block?.fieldKeys?.length) {
    /* Tühja ploki kopeerimine ei ole tegu, mille kohta tõendit hoida. Server
       lükkaks ta niikuinii 400-ga tagasi — aga siis oleks tekst juba lõikelaual
       ja kasutaja näeks viga teo kohta, mis tema jaoks õnnestus. */
    return {
      phase: COPY_PHASE.EMPTY,
      block: block || null,
      errorKey: "casework.errors.transfer_field_keys_required",
      pendingAudit: null
    };
  }

  const wrote = await writeClipboard(block.text);
  if (!wrote) {
    /* AUDITIT EI KIRJUTATA. Kopeerimist ei toimunud — plokk jääb ekraanile, et
       inimene saaks ta ise valida. */
    return { phase: COPY_PHASE.CLIPBOARD_FAILED, block, errorKey: null, pendingAudit: null };
  }

  try {
    await recordCopy({ fieldKeys: block.fieldKeys, clientActionId });
    return { phase: COPY_PHASE.COPIED, block, errorKey: null, pendingAudit: null };
  } catch (error) {
    /* Lõikelaud VÕTTIS vastu, jälg jäi salvestamata. Kasutaja peab seda teadma
       (L8: tõendi vaikne kadu on halvem kui nähtav) ja korduskatse peab kandma
       SAMA võtit. */
    return {
      phase: COPY_PHASE.AUDIT_FAILED,
      block,
      errorKey: errorKeyOf(error),
      pendingAudit: { fieldKeys: block.fieldKeys, clientActionId }
    };
  }
}

/**
 * Lisab ootel auditi järjekorda (SOL-CW-05).
 *
 * SAMA VÕTI EI SATU KAKS KORDA JÄRJEKORDA: korduskatse ebaõnnestumine ei tohi
 * järjekorda kasvatada, muidu kirjutaks üks tegu mitu auditirida.
 *
 * @param {Array<{ fieldKeys: string[], clientActionId: string }>} queue
 * @param {{ fieldKeys: string[], clientActionId: string } | null} pendingAudit
 */
export function queuePendingAudit(queue, pendingAudit) {
  const current = Array.isArray(queue) ? queue : [];
  if (!pendingAudit?.clientActionId) return current;
  if (current.some((entry) => entry.clientActionId === pendingAudit.clientActionId)) return current;
  return [...current, pendingAudit];
}

/**
 * Proovib kogu järjekorra uuesti, JÄRJEKORRAS ja LÕPUNI.
 *
 * ESIMESE VEA PEALE EI PEATUTA: iga kirje kannab oma võtit, seega hilisema
 * kirje õnnestumine ei sõltu varasemast ega tekita duplikaati. Peatumine
 * tähendaks, et üks püsivalt vigane kirje hoiab kõiki teisi pantvangis.
 *
 * @returns {Promise<{ remaining: Array<object>, flushed: number, errorKey: string|null }>}
 */
export async function flushPendingAudits(queue, recordCopy) {
  const current = Array.isArray(queue) ? queue : [];
  const remaining = [];
  let errorKey = null;

  for (const entry of current) {
    try {
      await recordCopy(entry);
    } catch (error) {
      remaining.push(entry);
      if (!errorKey) errorKey = errorKeyOf(error);
    }
  }

  return { remaining, flushed: current.length - remaining.length, errorKey };
}
