/**
 * TÖÖHEAOLU — STANDARDVÄLJADE RANGE SERVERISKEEM (SOL-WB-03).
 *
 * MIS OLI. Üheksa validaatorit kontrollisid täpselt üht asja: kas võti on
 * objektis. Väärtust ennast ei vaadanud keegi — ei tüüpi, ei lubatud loendit.
 * Tagajärg ei olnud kosmeetiline, sest skoorijad annavad tundmatule väärtusele
 * `0`:
 *
 *   `{ dangerStatus: "ONGOING" }` (vale kirjapilt) või `"whatever"` ei ole
 *   `ongoing` ega `uncertain` → `safetyNoticeRequired` jääb `false`, ükski
 *   riskimarker ei teki ja signaal on **`no_immediate_danger`**.
 *
 * Teisisõnu: TEADMATUS hinnati OHUTUKS. Sama muster kordus igal skaalal, ja
 * `"false"` (string) oli boolean-väljal tõene, mis pööras iga „ei vaja" vastuse
 * „vajab"-iks. Isiklik soovitus, kontrollpunkt ja organisatsioonikoond said
 * vale signaali — ja kliendipoolne parandus poleks aidanud, sest vigane või
 * vana klient ongi see, kelle vastu server end kaitseb.
 *
 * MIS SIIN ON. Üks deklaratiivne skeem töövoo kohta: iga välja täpne liik ja
 * täpne lubatud väärtuste hulk. Tundmatu enum, vale tüüp, tundmatu võti ja liiga
 * pikk vabatekst annavad kõik **400 ja kirje ei sünni** — ohutuseks ei degradeeru
 * midagi (fail-closed). Skeem on ÜHES failis, mitte üheksas: üheksa koopiat
 * lahkneksid ja siin on lahknemise hind vale ohuhinnang.
 *
 * SKEEMIVERSIOON ON OSA LEPINGUST. Iga töövoo skeem ütleb, MILLISE
 * `schemaVersion`-i kohta ta käib; `tests/wellbeing/fieldSchemas.test.js` võrdleb
 * seda buildereist tuleva versiooniga, nii et versiooni tõstmine ilma uue
 * skeemita kukub testis, mitte toodangus.
 *
 * VÄÄRTUSTE ALLIKAS on töövoo enda skoorija ja tema liidese valikuloend; test
 * `uiOptionsMatchSchema` loeb komponendi lähtekoodi ja nõuab, et liides ei saaks
 * saata väärtust, mida skeem ei tunne. Nii ei ole see kaks tõde, vaid üks tõde
 * ja üks kontrollitud koopia.
 */

const ENUM = "enum";
const BOOLEAN = "boolean";
const TEXT = "text";
const ENUM_LIST = "enum_list";
const TEXT_LIST = "text_list";

/* Vabateksti piir on turvapiir, mitte stiil: standardväli läheb koondisse,
   PDF-i ja mustandisse, ja piiramata sisend on ainus koht, kust neisse saab
   suvalise suurusega andmeid pumbata. 4000 tähemärki on umbes kaks lehekülge —
   rohkem ei ole „üldistatud kirjeldus". */
const MAX_TEXT_LENGTH = 4000;
const MAX_LIST_ITEMS = 30;
const MAX_LIST_ITEM_LENGTH = 400;

const field = Object.freeze({
  enum: (...values) => ({ kind: ENUM, values: Object.freeze(values) }),
  boolean: () => ({ kind: BOOLEAN }),
  text: (maxLength = MAX_TEXT_LENGTH) => ({ kind: TEXT, maxLength }),
  enumList: (...values) => ({ kind: ENUM_LIST, values: Object.freeze(values) }),
  textList: () => ({ kind: TEXT_LIST })
});

/* Korduvad skaalad on nimetatud, sest sama skaala kahes töövoos peab olema sama
   skaala — mitte kaks juhuslikult sarnast loendit. */
const LOW_TO_HIGH = ["low", "moderate", "high"];
const CLARITY = ["clear", "partly_clear", "unclear"];
const NEED_LEVEL = ["none", "partial", "high"];
const NONE_TO_HIGH = ["none", "low", "moderate", "high"];

export const WELLBEING_FIELD_SCHEMAS = Object.freeze({
  "quick-check": {
    schemaVersion: "1.0",
    fields: {
      workloadLevel: field.enum("low", "moderate", "high", "critical"),
      caseComplexityLevel: field.enum("routine", "moderate", "complex", "very_complex"),
      emotionalLoad: field.enum("low", "moderate", "high", "very_high"),
      documentationLoad: field.enum("low", "moderate", "high", "very_high"),
      interruptionsLevel: field.enum("low", "moderate", "high", "very_high"),
      recoveryLevel: field.enum("sufficient", "partial", "low", "none"),
      afterHoursImpact: field.enum(...NONE_TO_HIGH),
      decisionControl: field.enum("high", "moderate", "low", "none"),
      priorityClarity: field.enum(...CLARITY),
      supportAvailability: field.enum("available", "partial", "unclear", "not_available"),
      covisionNeed: field.boolean(),
      workBoundaryClarity: field.enum(...CLARITY),
      difficultCaseMarker: field.boolean(),
      supportNeed: field.boolean()
    }
  },

  "hard-case": {
    schemaVersion: "1.0",
    fields: {
      caseType: field.enum(
        "emotionally_heavy",
        "ethical_dilemma",
        "complex_case",
        "trauma_related",
        "role_conflict"
      ),
      /* OHUVÄLI: tundmatu väärtus ei tohi anda „ohtu ei ole". */
      immediateDanger: field.enum("no", "uncertain", "yes"),
      generalizedDescription: field.text(),
      professionalRole: field.enum(
        "case_worker",
        "child_protection",
        "social_worker",
        "advisor",
        "coordinator"
      ),
      mainLoad: field.enum(
        "emotional_load",
        "ethical_tension",
        "moral_distress",
        "trauma_exposure",
        "role_conflict",
        "workload_followup"
      ),
      ethicalTension: field.enum(...NONE_TO_HIGH),
      moralDistress: field.enum("none", "some", "strong"),
      traumaExposure: field.enum("none", "indirect", "direct"),
      roleClarity: field.enum(...CLARITY),
      shouldNotCarryAlone: field.boolean(),
      next24hNeeds: field.enumList(
        "manager_check_in",
        "document_key_facts",
        "reduce_next_day_load",
        "colleague_debrief",
        "safety_followup",
        "covision_input"
      ),
      covisionNeed: field.boolean(),
      recoveryNeed: field.enum(...NEED_LEVEL)
    }
  },

  "workplace-violence": {
    schemaVersion: "1.0",
    fields: {
      violenceType: field.enum(
        "insult_or_humiliation",
        "aggression",
        "threat",
        "physical_danger",
        "stalking_or_intimidation",
        "repeated_harassment",
        "threatening_message",
        "lone_work_risk"
      ),
      /* OHUVÄLI: `ongoing` ja `uncertain` käivitavad turvateate. Tundmatu
         väärtus andis varem `no_immediate_danger` — see on leiu tuum. */
      dangerStatus: field.enum("ended", "uncertain", "ongoing"),
      generalizedDescription: field.text(),
      locationOrChannel: field.enum(
        "office",
        "home_visit",
        "phone",
        "email_or_message",
        "public_space",
        "partner_channel"
      ),
      documentedStatus: field.enum("yes", "partial", "not_yet"),
      workImpact: field.enum(...LOW_TO_HIGH),
      safetyImpact: field.enum("none", "some", "high"),
      nextStepNeed: field.enum(
        "manager_followup",
        "safety_followup",
        "document_neutral_facts",
        "change_channel",
        "colleague_presence",
        "work_arrangement_change"
      ),
      safetyAgreementNeed: field.enum("no", "unclear", "yes"),
      covisionNeed: field.boolean(),
      recoveryNeed: field.enum(...NEED_LEVEL)
    }
  },

  recovery: {
    schemaVersion: "1.0",
    fields: {
      recoveryReason: field.enum("heavy_week", "difficult_case", "workplace_violence", "long_overload"),
      recoveryLevel: field.enum("sufficient", "partial", "low", "none"),
      workCapacityNext72h: field.enum("stable", "reduced", "low", "not_sustainable"),
      unavoidableTasks: field.textList(),
      deferrableTasks: field.textList(),
      redistributableTasks: field.textList(),
      primaryLoadFactors: field.enumList(
        "documentation",
        "interruptions",
        "difficult_case",
        "workplace_violence",
        "after_hours",
        "role_conflict"
      ),
      /* NB: `supportNeed` on SIIN enum, kiirkontrollis boolean. Sama nimi, eri
         tähendus — täpselt see, mille pärast skeem on töövoo, mitte välja
         kaupa. */
      supportNeed: field.enum("none", "manager", "colleague", "supervisor"),
      covisionNeed: field.boolean(),
      nextCheckpoint: field.enum("today", "tomorrow", "in_72h", "next_week")
    }
  },

  "work-boundaries": {
    schemaVersion: "1.0",
    fields: {
      agreementType: field.enum(
        "after_hours_availability",
        "work_time_boundary",
        "evening_messages",
        "pause_agreement",
        "replacement_agreement",
        "crisis_exception",
        "focus_time",
        "urgent_requests"
      ),
      currentConcern: field.text(),
      boundaryClarity: field.enum(...CLARITY),
      afterHoursPressure: field.enum(...NONE_TO_HIGH),
      pauseProtection: field.enum("protected", "partial", "unclear", "none"),
      replacementCoverage: field.enum("clear", "partial", "unclear", "missing"),
      urgentExceptionClarity: field.enum(...CLARITY),
      counterpart: field.enum("manager", "colleague", "team", "partner"),
      desiredPrinciple: field.text(),
      exceptions: field.text(),
      reviewTime: field.enum("one_week", "two_weeks", "one_month", "next_meeting"),
      supportNeed: field.enum("none", "manager", "colleague", "team")
    }
  },

  interruptions: {
    schemaVersion: "1.0",
    fields: {
      interruptionClass: field.enum(
        "unavoidable",
        "negotiable",
        "deferrable",
        "wrong_channel",
        "role_boundary",
        "documentation_system",
        "partner_process"
      ),
      sources: field.enumList(
        "phone",
        "email",
        "message",
        "colleague_questions",
        "manager_requests",
        "client_contact",
        "partner_contact",
        "documentation_system",
        "meetings",
        "urgent_cases"
      ),
      frequency: field.enum("rare", "sometimes", "often", "very_often"),
      workImpact: field.enum(...LOW_TO_HIGH),
      immediateResponseNeed: field.enum("clear", "partial", "unclear"),
      canWait: field.enum("few", "some", "many"),
      neededAgreement: field.enum(
        "focus_time",
        "channel_rules",
        "role_boundary",
        "process_change",
        "team_agreement"
      ),
      counterpart: field.enum("manager", "team", "colleague", "partner"),
      wrongChannelShare: field.enum("none", "some", "many"),
      documentationInterruption: field.boolean(),
      recoveryImpact: field.enum("none", "some", "high")
    }
  },

  "work-processes": {
    schemaVersion: "1.0",
    fields: {
      analysisFocus: field.enum(
        "documentation_flow",
        "case_flow",
        "partner_coordination",
        "team_routine",
        "information_flow"
      ),
      categories: field.enumList(
        "client_value_work",
        "necessary_burden",
        "duplicate_entry",
        "documentation",
        "information_search",
        "partner_coordination",
        "waiting",
        "repetitive_tasks",
        "low_value_work"
      ),
      timeCostSources: field.enumList(
        "same_data_multiple_places",
        "searching_partner_info",
        "manual_status_updates",
        "waiting_for_answers",
        "copying_between_systems",
        "unclear_next_step"
      ),
      lowValueActivities: field.enumList(
        "same_data_multiple_places",
        "manual_copying",
        "status_chasing",
        "duplicate_meetings",
        "unclear_templates"
      ),
      informationBlockers: field.enumList(
        "unclear_owner",
        "missing_shared_view",
        "partner_delay",
        "system_gap",
        "role_confusion"
      ),
      unfinishedWork: field.enumList(
        "client_followup",
        "case_notes",
        "partner_reply",
        "planning",
        "recovery_pause"
      ),
      simplificationNeeds: field.enumList(
        "single_entry",
        "shared_status_view",
        "clear_owner",
        "template_cleanup",
        "meeting_rule"
      ),
      documentationDuplication: field.enum(...NONE_TO_HIGH),
      switchingLoad: field.enum(...LOW_TO_HIGH),
      processImpact: field.enum(...LOW_TO_HIGH),
      counterpart: field.enum("manager", "team", "colleague", "partner")
    }
  },

  "role-boundaries": {
    schemaVersion: "1.0",
    fields: {
      expectationSource: field.enum(
        "client",
        "client_family",
        "manager",
        "colleague",
        "partner",
        "network"
      ),
      expectedAction: field.enum(
        "explain_service",
        "solve_partner_delay",
        "be_always_available",
        "make_decision",
        "coordinate_network",
        "emotional_support"
      ),
      myRole: field.enum(
        "case_worker",
        "advisor",
        "service_link",
        "assessment_input",
        "support_planning"
      ),
      outsideRole: field.enum(
        "none",
        "make_other_agency_decision",
        "replace_service_provider",
        "be_crisis_contact",
        "guarantee_outcome",
        "carry_partner_responsibility"
      ),
      neededResponsibility: field.enum(
        "self",
        "manager",
        "partner_agency",
        "service_provider",
        "network",
        "client_family"
      ),
      roleConflict: field.enum(...NONE_TO_HIGH),
      partnerExplanationNeed: field.boolean(),
      managerDiscussionNeed: field.boolean(),
      availabilityPressure: field.enum(...NONE_TO_HIGH),
      ethicalComplexity: field.enum(...LOW_TO_HIGH),
      counterpart: field.enum("client", "client_family", "manager", "partner", "team")
    }
  },

  "starter-support": {
    schemaVersion: "1.0",
    fields: {
      experienceStage: field.enum("first_week", "first_month", "first_100_days", "new_role"),
      roleArea: field.enum(
        "child_protection",
        "adult_support",
        "elderly_support",
        "disability_support",
        "service_coordination",
        "general_social_work"
      ),
      unclearTopics: field.enumList(
        "role_boundaries",
        "documentation",
        "network_work",
        "service_rules",
        "risk_escalation",
        "work_boundaries"
      ),
      existingSupport: field.enumList(
        "manager_check_in",
        "team_channel",
        "onboarding_material",
        "shadowing",
        "case_discussion"
      ),
      missingSupport: field.enumList(
        "mentor",
        "covision",
        "clear_documentation_routine",
        "role_expectations",
        "boundary_agreement",
        "case_escalation_rule"
      ),
      casesNotCarryAlone: field.enumList(
        "complex_family_case",
        "workplace_violence",
        "ethical_tension_case",
        "high_risk_case",
        "unclear_mandate"
      ),
      covisionNeedSigns: field.enumList(
        "ethical_tension",
        "role_uncertainty",
        "emotional_load",
        "repeating_case_pattern",
        "not_to_carry_alone"
      ),
      mentorDiscussionNeed: field.boolean(),
      managerDiscussionNeed: field.boolean(),
      workBoundaryNeed: field.boolean(),
      supportUrgency: field.enum("stable", "plan_needed", "soon", "urgent")
    }
  }
});

export const WELLBEING_SCHEMA_WORKFLOW_TYPES = Object.freeze(Object.keys(WELLBEING_FIELD_SCHEMAS));

export function wellbeingFieldSchema(workflowType) {
  return WELLBEING_FIELD_SCHEMAS[String(workflowType || "").trim()] || null;
}

function invalidFieldsError(details) {
  const error = new Error("wellbeing.errors.invalid_standardized_fields");
  error.status = 400;
  error.details = details;
  return error;
}

function checkValue(spec, value) {
  switch (spec.kind) {
    case ENUM:
      if (typeof value !== "string") return "not_a_string";
      return spec.values.includes(value) ? null : "unknown_value";
    case BOOLEAN:
      /* `"false"` on string ja string on tõene — see oli päris viga, mitte
         teoreetiline. Boolean tähendab siin boolean'i. */
      return typeof value === "boolean" ? null : "not_a_boolean";
    case TEXT:
      if (typeof value !== "string") return "not_a_string";
      return value.length > spec.maxLength ? "too_long" : null;
    case ENUM_LIST: {
      if (!Array.isArray(value)) return "not_an_array";
      if (value.length > MAX_LIST_ITEMS) return "too_many_items";
      const bad = value.some((item) => typeof item !== "string" || !spec.values.includes(item));
      return bad ? "unknown_value" : null;
    }
    case TEXT_LIST: {
      if (!Array.isArray(value)) return "not_an_array";
      if (value.length > MAX_LIST_ITEMS) return "too_many_items";
      const bad = value.some((item) => typeof item !== "string" || item.length > MAX_LIST_ITEM_LENGTH);
      return bad ? "invalid_item" : null;
    }
    default:
      return "unsupported_kind";
  }
}

/**
 * Range kontroll ühe töövoo standardväljadele.
 *
 * Kolm keeldu ühes kohas ja kõik fail-closed:
 *   PUUDUV võti  — endine käitumine, sama veavõti ja sama `details.missing`;
 *   TUNDMATU võti — vaikne läbilaskmine tähendaks, et vana või vigane klient
 *                   saab kirjesse panna välju, mida ükski skoorija ei vaata,
 *                   aga mis lähevad koondisse ja PDF-i;
 *   VALE VÄÄRTUS — tundmatu enum, vale tüüp või liiga pikk tekst.
 */
export function validateWellbeingStandardizedFields(workflowType, fields) {
  const schema = wellbeingFieldSchema(workflowType);
  if (!schema) {
    const error = new Error("wellbeing.errors.workflow_not_supported");
    error.status = 400;
    error.details = { workflowType: String(workflowType || "") };
    throw error;
  }

  if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
    throw invalidFieldsError({ missing: Object.keys(schema.fields) });
  }

  const missing = Object.keys(schema.fields).filter((key) => !(key in fields));
  if (missing.length > 0) throw invalidFieldsError({ missing });

  const unknown = Object.keys(fields).filter((key) => !(key in schema.fields));
  if (unknown.length > 0) throw invalidFieldsError({ unknown });

  const invalid = [];
  for (const [key, spec] of Object.entries(schema.fields)) {
    const reason = checkValue(spec, fields[key]);
    if (reason) invalid.push({ key, reason });
  }
  if (invalid.length > 0) throw invalidFieldsError({ invalid });

  return fields;
}
