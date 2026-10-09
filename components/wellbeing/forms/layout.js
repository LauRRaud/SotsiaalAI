/**
 * Sammu paigutus ja „kaal": puhtad reeglid, mida saab testida.
 *
 * PAIGUTUS tuleb vastusevariantidest, mitte käsitsi:
 *  - kui sammu kõik ühe valikuga küsimused on lühikese skaalaga, on need TABEL
 *    (silt vasakul, skaala paremal, veerud kohakuti);
 *  - muidu on küsimus üleval ja variandid selle all ühelaiuste lahtritena
 *    (kolm veergu; neli lühikest varianti ühes reas).
 *
 * KAAL on vaate ligikaudne kõrgus lahtriridades (üks rida on umbes 46 px).
 * Üks vaade peab paneeli ära mahtuma (kerimine vahetab sammu, mitte ei keri
 * lehte), seega hoiab test iga sammu kaalu alla piiri `STEP_WEIGHT_LIMIT`.
 * Kaalud ja piir on mõõdetud brauseris 1536 × 640 aknas (09.10.2026): sammu
 * kõrgus oli umbes 86 px + 46 px × kaal ja paneeli mahub 445 px. Näiteks kaks
 * kahe rea küsimust juhisega (kaal 6,6) mõõtis 410 px, kuus tabelirida juhisega
 * (kaal 8,1) 476 px ja ei mahtunud.
 *
 * `text(entry)` annab sildi teksti (kirjelduses on silt sõne või [võti, varu]).
 */

export const SCALE_MAX_OPTIONS = 4;
export const SCALE_MAX_LABEL = 16;
export const ROW_OF_FOUR_MAX_LABEL = 20;
export const STEP_WEIGHT_LIMIT = 7.6;

const STACK_COLUMNS = 3;
const CHECK_COLUMNS = 2;

export const longestLabel = (field, text) => Math.max(...field.options.map((option) => String(text(option.label)).length));

/** Lühike skaala: kuni neli varianti ja ükski silt ei ole pikem kui paar sõna. */
export const isScale = (field, text) => field.options.length <= SCALE_MAX_OPTIONS && longestLabel(field, text) <= SCALE_MAX_LABEL;

/** Neli varianti, mis mahuvad virnas ühte ritta (muidu oleks 3 + 1). */
export const isRowOfFour = (field, text) => field.options.length === 4 && longestLabel(field, text) <= ROW_OF_FOUR_MAX_LABEL;

/** Kas sammu ühe valikuga küsimused on tabel? */
export function isTableStep(step, text) {
  const enums = step.fields.filter((field) => field.kind === "enum");
  return enums.length > 1 && enums.every((field) => isScale(field, text));
}

/** Mitu veergu on küsimuse variantidel virnas (undefined = võrk otsustab ise). */
export const stackColumns = (field, text) => (isRowOfFour(field, text) ? 4 : undefined);

function fieldWeight(field, table, text) {
  if (field.kind === "enum") {
    /* Tabelirida on lahtrireast kõrgem: pikem silt murdub seal kahele reale. */
    if (table) return 1.25;
    const columns = stackColumns(field, text) || STACK_COLUMNS;
    return 1 + Math.ceil(field.options.length / columns);
  }
  /* Märgitavate variantide sildid on pikemad ja murduvad sagedamini. */
  if (field.kind === "enum_list") return 1.2 + Math.ceil(field.options.length / STACK_COLUMNS) * 1.1;
  if (field.kind === "boolean") return 0;
  /* Tekstiväli: silt, read ja ääred. */
  const rows = field.rows || (field.kind === "text_list" ? 3 : 4);
  return 1.6 + rows * 0.75;
}

/** Vaate ligikaudne kõrgus lahtriridades (vt faili päist). */
export function stepWeight(step, text) {
  const table = isTableStep(step, text);
  const weights = step.fields.map((field) => fieldWeight(field, table, text));
  /* Kõrvuti väljad (`columns`) võtavad kõrgust nagu kõige kõrgem neist. */
  const fieldsWeight = step.columns ? Math.max(...weights) : weights.reduce((sum, weight) => sum + weight, 0);
  const checks = step.fields.filter((field) => field.kind === "boolean");
  const checkRows = Math.ceil(checks.length / CHECK_COLUMNS);
  const hinted = checks.some((field) => field.hint);
  return fieldsWeight + checkRows * (hinted ? 2 : 1.5) + (step.lead ? 0.6 : 0);
}
