/**
 * Teekonnarada: mis on tehtud ja mis on pooleli, tuletatuna FAKTIDEST.
 *
 * Varem oli rajal kuus rida, millest neli olid alati „mitte alustatud" või
 * sõltusid ainult valitud suunast: „Eelpöördumine koostatud" jäi tegemata ka
 * siis, kui pöördumine oli saadetud ja saaja selle avanud. Rada lubas seisu,
 * mida keegi ei pidanud.
 *
 * Siin on ainult read, mille seisu platvorm päriselt teab: Teekond on
 * kirjeldatud ja salvestatud (muidu seda lehte ei oleks), eelpöördumine on
 * alustatud või saadetud, saaja on selle avanud, saaja on ühises ruumis vastanud
 * (K1-c), ning inimese enda sammud
 * (K1-b: pooleli, kuni mõni samm on tegemata; tehtud, kui kõik on lõpetatud).
 * „Kontakt või teenus otsitud" tuleb tagasi siis, kui selle taga on andmed.
 */
export const RoadmapState = Object.freeze({
  DONE: "done",
  CURRENT: "current",
  NEXT: "next",
  TODO: "todo"
});

/**
 * @param {{ primaryPath?: string, preInquiryFacts?: { total?: number, sent?: number, opened?: number, answered?: number }, steps?: Array<{ state: string }> }} journey
 */
export function journeyRoadmap(journey) {
  const facts = journey?.preInquiryFacts || {};
  const total = Number(facts.total) || 0;
  const sent = Number(facts.sent) || 0;
  const opened = Number(facts.opened) || 0;
  const answered = Number(facts.answered) || 0;

  let preInquiry = RoadmapState.TODO;
  if (sent > 0) preInquiry = RoadmapState.DONE;
  else if (total > 0) preInquiry = RoadmapState.CURRENT;
  else if (String(journey?.primaryPath || "").toUpperCase() === "PRE_INQUIRY") preInquiry = RoadmapState.NEXT;

  /* Sammud: ilma sammudeta „mitte alustatud"; tegemata samm teeb rea pooleliolevaks. */
  const steps = Array.isArray(journey?.steps) ? journey.steps : [];
  const open = steps.filter((step) => step?.state === "TODO").length;
  let own = RoadmapState.TODO;
  if (open > 0) own = RoadmapState.CURRENT;
  else if (steps.length > 0) own = RoadmapState.DONE;

  return [
    { key: "situation", state: RoadmapState.DONE },
    { key: "saved", state: RoadmapState.DONE },
    { key: "pre_inquiry", state: preInquiry },
    /* Rida ütleb täpselt seda, mida platvorm teab: saaja on pöördumise avanud.
       Kas ta ka vastas, siin ei väideta. */
    /* Vastus tähendab, et pöördumine jõudis kohale ka siis, kui üks kindel inimene
       seda „avanud" ei ole (organisatsiooni vastuvõtulaud). */
    { key: "response", state: opened > 0 || answered > 0 ? RoadmapState.DONE : RoadmapState.TODO },
    { key: "answered", state: answered > 0 ? RoadmapState.DONE : RoadmapState.TODO },
    { key: "steps", state: own }
  ];
}
