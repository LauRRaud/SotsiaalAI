/**
 * Toe küsimise valikud (SupportRequestPanel).
 *
 * Omaette failis, et test saaks iga valiku läbi tekstikoostaja lasta: valik,
 * mille adressaati tekstikoostaja ei tunne, viskas paneeli joonistamisel vea
 * (mentori valik, tests/wellbeing-display-labels.test.mjs).
 */

/* SOL-WB-17: neljast valikust oli teostatud AINULT kovisiooni üleandmine.
   Ülejäänud kolm lubasid „jagatav versioon kinnitatud", aga juht, pilooditugi
   ega mentor ei saanud midagi — üleandmisrada ei olnud olemas ja lõputekst ei
   öelnud seda välja.

   Kaks ausat vastust, kriteeriumi mõlemad harud:
     `handoff: "..."` — valikul ON õigustega piiratud adressaadi-rada;
     `copyOnly: true` — valik ON privaatne mustand, mille kasutaja ise edastab,
                        ja liides ütleb seda otse, mitte ei jäta arvata. */
export const supportOptions = [
  {
    outputType: "manager_memo",
    recipientType: "manager",
    copyOnly: true,
    labelKey: "wellbeing.support.manager_memo_label",
    labelFallback: "Koosta juhiga arutelu memo",
    descriptionKey: "wellbeing.support.manager_memo_meta",
    descriptionFallback: "Privaatne mustand, mille sa ise juhiga jagad — platvorm seda ei saada"
  },
  {
    outputType: "support_request",
    recipientType: "supervisor",
    handoff: "supervision",
    labelKey: "wellbeing.support.supervisor_input_label",
    labelFallback: "Anna supervisioonile üle",
    descriptionKey: "wellbeing.support.supervisor_input_meta",
    descriptionFallback: "Kinnitatud tekst liigub sinu valitud supervisiooniprotsessi"
  },
  {
    outputType: "covision_input",
    recipientType: "covision",
    handoff: "covision",
    labelKey: "wellbeing.support.covision_input_label",
    labelFallback: "Koosta kovisiooni sisend",
    descriptionKey: "wellbeing.support.covision_input_meta",
    descriptionFallback: "Juhtum, küsimus ja õppimiskoht rühmale"
  },
  {
    outputType: "support_request",
    recipientType: "pilot_support_contact",
    copyOnly: true,
    labelKey: "wellbeing.support.support_request_label",
    labelFallback: "Koosta abipalve",
    descriptionKey: "wellbeing.support.support_request_meta",
    descriptionFallback: "Privaatne mustand, mille sa ise tugikontaktile edastad — platvorm seda ei saada"
  },
  {
    outputType: "support_request",
    recipientType: "mentor",
    copyOnly: true,
    labelKey: "wellbeing.support.mentor_input_label",
    labelFallback: "Koosta mentorile sisend",
    descriptionKey: "wellbeing.support.mentor_input_meta",
    descriptionFallback: "Privaatne mustand, mille sa ise mentoriga jagad — platvorm seda ei saada"
  }
];
