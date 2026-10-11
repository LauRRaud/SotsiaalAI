/**
 * KODUTEENUS K1-e2 — dikteeritud teksti lisamine kirje väljale.
 *
 * Dikteerimine LISAB teksti, ei asenda: hooldaja võib osa kirjutada ja osa
 * öelda, ja mitu dikteerimist järjest annavad ühe kirje. Lisatav tekst läheb
 * välja lõppu, ühe tühikuga eraldatult.
 *
 * Kirjel on pikkuse piir. Kui dikteeritud tekst üle selle läheb, lõigatakse lõpp
 * ära ja kutsuja saab sellest teada (`cut`), et inimesele öelda: vaikselt
 * lühemaks jäänud kirje oleks hullem kui teade.
 */
export function appendDictatedText(current, spoken, max) {
  const base = typeof current === "string" ? current : "";
  const addition = String(spoken ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!addition) return { text: base, cut: false };
  const separator = base && !/\s$/.test(base) ? " " : "";
  const joined = `${base}${separator}${addition}`;
  const limit = Number.isFinite(max) && max > 0 ? max : joined.length;
  return joined.length > limit ? { text: joined.slice(0, limit), cut: true } : { text: joined, cut: false };
}
