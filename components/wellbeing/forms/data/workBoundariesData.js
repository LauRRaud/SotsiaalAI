/**
 * WorkBoundaries: küsimused, vastusevariandid ja signaalitekstid.
 *
 * Tõstetud sõna-sõnalt vanast töövormist (`WorkBoundariesWorkflow.jsx`), et
 * sildid ja väärtused ei muutuks. Väärtused on serveri lepingu osa
 * (`lib/wellbeing/fieldSchemas.js`). `initialFields` on vana vormi näidis-
 * täide; sammuvorm seda ei kasuta (küsimused on alguses vastamata).
 */

export const initialFields = {
  agreementType: "after_hours_availability",
  currentConcern: "Töövälised sõnumid katkestavad taastumist ja tekitavad ebaselgust.",
  boundaryClarity: "partly_clear",
  afterHoursPressure: "moderate",
  pauseProtection: "partial",
  replacementCoverage: "unclear",
  urgentExceptionClarity: "partly_clear",
  counterpart: "manager",
  desiredPrinciple: "Tööväline kontakt toimub ainult vahetu ohu või eelnevalt kokku lepitud erandi korral.",
  exceptions: "Kriisiolukorra erandid: vahetu oht inimese elule, tervisele või turvalisusele.",
  reviewTime: "two_weeks",
  supportNeed: "manager"
};

export const selectFields = [
  {
    key: "agreementType",
    label: "Kokkuleppe fookus",
    options: [
      ["after_hours_availability", "Töövälise kättesaadavuse piir"],
      ["work_time_boundary", "Tööaja piir"],
      ["evening_messages", "Õhtuste sõnumite kokkulepe"],
      ["pause_agreement", "Pauside kaitsmine"],
      ["replacement_agreement", "Asenduse kokkulepe"],
      ["crisis_exception", "Kriisiolukorra erandid"],
      ["focus_time", "Keskendumisaja kaitsmine"],
      ["urgent_requests", "Kiirete päringute piir"]
    ]
  },
  {
    key: "boundaryClarity",
    label: "Piiri selgus",
    options: [
      ["clear", "Selge"],
      ["partly_clear", "Osaliselt selge"],
      ["unclear", "Ebaselge"]
    ]
  },
  {
    key: "afterHoursPressure",
    label: "Töövälise kättesaadavuse surve",
    options: [
      ["none", "Puudub"],
      ["low", "Madal"],
      ["moderate", "Mõõdukas"],
      ["high", "Kõrge"]
    ]
  },
  {
    key: "pauseProtection",
    label: "Pauside kaitstus",
    options: [
      ["protected", "Kaitstud"],
      ["partial", "Osaline"],
      ["unclear", "Ebaselge"],
      ["none", "Puudub"]
    ]
  },
  {
    key: "replacementCoverage",
    label: "Asenduse või info liikumise selgus",
    options: [
      ["clear", "Selge"],
      ["partial", "Osaline"],
      ["unclear", "Ebaselge"],
      ["missing", "Puudub"]
    ]
  },
  {
    key: "urgentExceptionClarity",
    label: "Kiireloomuliste erandite selgus",
    options: [
      ["clear", "Selge"],
      ["partly_clear", "Osaliselt selge"],
      ["unclear", "Ebaselge"]
    ]
  },
  {
    key: "counterpart",
    label: "Kokkuleppe osapool",
    options: [
      ["manager", "Juht"],
      ["colleague", "Kolleeg"],
      ["team", "Tiim"],
      ["partner", "Koostööpartner"]
    ]
  },
  {
    key: "reviewTime",
    label: "Ülevaatamise aeg",
    options: [
      ["one_week", "Ühe nädala pärast"],
      ["two_weeks", "Kahe nädala pärast"],
      ["one_month", "Kuu aja pärast"],
      ["next_meeting", "Järgmisel kohtumisel"]
    ]
  },
  {
    key: "supportNeed",
    label: "Vajalik tugi",
    options: [
      ["none", "Ei vaja eraldi tuge"],
      ["manager", "Juhi kokkulepe"],
      ["colleague", "Kolleegitugi"],
      ["team", "Tiimi kokkulepe"]
    ]
  }
];

export const signalCopy = {
  clear: {
    title: "Piir on pigem selge",
    text: "Kokkulepe vajab hoidmist ja ülevaatamist, aga töökorralduslik risk on praegu madal."
  },
  needs_clarification: {
    title: "Vajab täpsustamist",
    text: "Mõni piir, erand või asendus vajab selgemat sõnastust, et katkestused ei jääks korduma."
  },
  needs_agreement: {
    title: "Vajab kokkulepet",
    text: "Tööväline surve või ebaselged erandid vajavad juhiga või tiimiga konkreetset töökorralduslikku kokkulepet."
  }
};

export const actionRoutes = {
  recovery: "/tooheaolu/taastumine",
  overview: "/tooheaolu/ulevaade",
  "work-processes": "/tooheaolu/tooprotsessid"
};
