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
 * alustatud või saadetud, saaja on selle avanud. „Kontakt või teenus otsitud" ja
 * „Järgmine samm" tulevad tagasi siis, kui nende taga on andmed (järgmise sammu
 * tegija, tähtaeg ja seis on Teekonna järgmise kihi töö).
 */
export const RoadmapState = Object.freeze({
  DONE: "done",
  CURRENT: "current",
  NEXT: "next",
  TODO: "todo"
});

/**
 * @param {{ primaryPath?: string, preInquiryFacts?: { total?: number, sent?: number, opened?: number } }} journey
 */
export function journeyRoadmap(journey) {
  const facts = journey?.preInquiryFacts || {};
  const total = Number(facts.total) || 0;
  const sent = Number(facts.sent) || 0;
  const opened = Number(facts.opened) || 0;

  let preInquiry = RoadmapState.TODO;
  if (sent > 0) preInquiry = RoadmapState.DONE;
  else if (total > 0) preInquiry = RoadmapState.CURRENT;
  else if (String(journey?.primaryPath || "").toUpperCase() === "PRE_INQUIRY") preInquiry = RoadmapState.NEXT;

  return [
    { key: "situation", state: RoadmapState.DONE },
    { key: "saved", state: RoadmapState.DONE },
    { key: "pre_inquiry", state: preInquiry },
    /* Rida ütleb täpselt seda, mida platvorm teab: saaja on pöördumise avanud.
       Kas ta ka vastas, siin ei väideta. */
    { key: "response", state: opened > 0 ? RoadmapState.DONE : RoadmapState.TODO }
  ];
}
