/**
 * Töövägivalla kirjeldus sammuvormile.
 * Väljad ja väärtused: serveri leping (`lib/wellbeing/fieldSchemas.js`, `workplace-violence`).
 * Arvutus ja valmis tekstid: `lib/wellbeing/workplaceViolence.js`.
 */

import { buildWorkplaceViolenceRecord, isInternalViolenceSource } from "@/lib/wellbeing/workplaceViolence";

import { selectFields, signalCopy } from "./data/workplaceViolenceData.js";
import { checkField, enumFields, flowLead, formText, output, signals, textField } from "./helpers.js";

export const workplaceViolenceForm = {
  workflowType: "workplace-violence",
  endpoint: "/api/wellbeing/workplace-violence",
  buildRecord: buildWorkplaceViolenceRecord,
  text: formText("workplace_violence"),
  steps: [
    {
      key: "situation",
      title: ["wellbeing.workplace_violence.situation", "Olukord"],
      fields: enumFields(selectFields, ["violenceType"])
    },
    {
      /* Ohu küsimus on omaette vaates: ohutusteade ilmub kohe selle alla ja
         peab sinna ära mahtuma. */
      key: "safety",
      title: "Ohutus",
      fields: enumFields(selectFields, ["dangerStatus"])
    },
    {
      /* Ohu küsimuse järel, et see jääks teiseks sammuks. Kolleegi või juhi
         teade ilmub selle alla. */
      key: "source",
      title: ["wellbeing.workplace_violence.source_heading", "Kellelt see tuli"],
      short: ["wellbeing.workplace_violence.source_short", "Kellelt"],
      lead: ["wellbeing.workplace_violence.source_lead", "See aitab valida sobivad järgmised sammud ja tekstid."],
      fields: enumFields(selectFields, ["sourceOfHarm"])
    },
    {
      key: "impact",
      title: "Koht ja mõju",
      short: "Mõju",
      fields: enumFields(selectFields, ["locationOrChannel", "workImpact", "safetyImpact"])
    },
    {
      key: "followup",
      title: ["wellbeing.workplace_violence.followup", "Järeltegevus"],
      fields: enumFields(selectFields, ["documentedStatus", "nextStepNeed", "safetyAgreementNeed"])
    },
    {
      key: "support",
      title: "Taastumine ja tugi",
      short: "Taastumine",
      fields: [
        ...enumFields(selectFields, ["recoveryNeed"]),
        checkField("covisionNeed", ["wellbeing.workplace_violence.covision_need", "Vajan kovisiooni sisendit"])
      ]
    },
    {
      key: "description",
      title: ["wellbeing.workplace_violence.generalized_heading", "Üldistatud kirjeldus"],
      short: "Kirjeldus",
      lead: flowLead("general_text"),
      fields: [
        textField(
          "generalizedDescription",
          ["wellbeing.workplace_violence.generalized_description", "Neutraalne kirjeldus ilma tuvastatavate detailideta"],
          undefined,
          5
        )
      ]
    },
    {
      key: "privateLog",
      title: ["wellbeing.workplace_violence.private_log_heading", "Minu märkmik"],
      short: ["wellbeing.workplace_violence.private_log_short", "Märkmik"],
      lead: [
        "wellbeing.workplace_violence.private_log_lead",
        "Ainult sinule: kuupäev, mis juhtus, kus ja kes nägi. Kirjuta rolli, mitte nime. Märkmik ei lähe ühtegi jagatavasse teksti ega koondisse."
      ],
      fields: [textField("privateLog", ["wellbeing.workplace_violence.private_log", "Märkmed"], undefined, 5)]
    }
  ],
  signals: signals(signalCopy, { no_immediate_danger: "ok", needs_attention: "warn", urgent_attention: "risk" }),
  /* Kolleeg või juht: abiteed, kus esimene samm ei pea olema juht. Loetelu ootab
     tööõiguse või ESTA asjatundja ülevaatust (arendusettepanek ptk 8.8). */
  safetyNotices: [
    {
      fieldKey: "sourceOfHarm",
      when: isInternalViolenceSource,
      repeatOnResult: false,
      title: ["wellbeing.workplace_violence.internal_notice.title", "Kui see tuli kolleegilt või juhilt"],
      text: [
        "wellbeing.workplace_violence.internal_notice.text",
        "Esimene samm ei pea olema sinu juht: saad pöörduda kõrgema juhi, personalitöötaja, töökeskkonnavoliniku või töötervishoiuarsti poole; nõu annab ka Tööinspektsioon. Pane toimunu kuupäevaga kirja (märkmik on viimases sammus). See kirje ei lähe koondisse ega kovisiooni."
      ]
    }
  ],
  /* Ohutusteade kohe ohu küsimuse all, mitte alles tulemuse sammul. */
  safetyNotice: {
    fieldKey: "dangerStatus",
    when: (fields) => fields.dangerStatus === "ongoing" || fields.dangerStatus === "uncertain",
    title: ["wellbeing.workplace_violence.safety_title", "Ohutustekst"],
    text: ["wellbeing.workplace_violence.safety_text", ""]
  },
  /* Tühjad tekstid jäävad valikust välja: kolleegi või juhi puhul on
     kliendikesksete asemel pöördumise mustand. */
  outputs: [
    output("Neutraalne juhtumikirjeldus", "neutralIncidentDescription"),
    output("Pöördumise mustand", "internalReport"),
    output("Turvalisuse kokkuleppe sisend", "safetyAgreementInput"),
    output("Juhiga arutelu memo", "managerMemo"),
    output("Kovisiooni sisend", "covisionInput"),
    output("Töökorralduse muutmise soovitus", "workArrangementRecommendation")
  ]
};
