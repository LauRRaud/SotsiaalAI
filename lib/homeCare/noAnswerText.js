/**
 * KODUTEENUS K4-f — erijuhtumi kirje tekst nupust „Ei saa sisse".
 *
 * Puhas funktsioon (ilma serveri ja brauseri mooduliteta), et sama teksti saaks testida.
 * `taps` on sammu ID → kellaaeg („10:02"). Tehtud sammud on puudutamise järjekorras
 * kellaaja järgi, tegemata sammud loendi järjekorras ühel real.
 */
export function composeNoAnswerText(t, steps, taps, note) {
  const done = steps.filter((step) => taps[step.id]).sort((a, b) => (taps[a.id] < taps[b.id] ? -1 : taps[a.id] > taps[b.id] ? 1 : a.position - b.position));
  const skipped = steps.filter((step) => !taps[step.id]);
  const lines = [t("home_care.no_answer.text_head")];
  if (!steps.length) lines.push(t("home_care.no_answer.text_no_steps"));
  for (const step of done) lines.push(t("home_care.no_answer.text_step", { time: taps[step.id], step: step.text }));
  if (done.length && skipped.length) lines.push(t("home_care.no_answer.text_skipped", { steps: skipped.map((step) => step.text).join("; ") }));
  if (!done.length && steps.length) lines.push(t("home_care.no_answer.text_none_done"));
  const extra = typeof note === "string" ? note.trim() : "";
  if (extra) lines.push(extra);
  return lines.join("\n");
}
