import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { buildPreInquiryAssessment } from "../../lib/preInquiriesAssessment.js";
import {
  buildPreInquiryRoutingConfidence,
  explainPreInquiryRecipientMatch
} from "../../lib/preInquiryRouting.js";
import {
  normalizePreInquiryReceiverChecklist,
  normalizePreInquiryReceiverNote
} from "../../lib/preInquiryReceiverWorkflow.js";
import {
  PRE_INQUIRY_DOMAIN_DEFINITIONS,
  buildPreInquiryAssessmentAssistContext,
  buildPreInquiryAssessmentDraftSummary,
  buildPreInquiryAssessmentExportText,
  buildPreInquiryAssessmentReview,
  buildPreInquiryAssessmentSituation,
  createEmptyPreInquiryAssessmentState,
  normalizePreInquiryAssessmentState
} from "../../lib/preInquiriesQuestionnaire.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

test("pre-inquiry assessment start asks questions before matching contacts", () => {
  const assessment = buildPreInquiryAssessment({
    situation: "Soovin alustada abivajaduse eelkaardistust.",
    assistantMessage: "Soovin alustada abivajaduse eelkaardistust."
  });

  assert.equal(assessment.assessmentMode, "PRE_ASSESSMENT");
  assert.equal(assessment.needsMoreInput, true);
  assert.equal(assessment.suggestedNextSteps, "ASK_DETAILS");
  assert.deepEqual(assessment.lifeDomains, []);
  assert.deepEqual(assessment.targetGroups, []);
  assert.ok(assessment.clarifyingQuestions.some((question) => question.includes("KOV-is")));
  assert.ok(assessment.clarifyingQuestions.some((question) => question.includes("kirja KOV")));
});

test("pre-inquiry assessment maps care burden to STAR2-aligned domains", () => {
  const assessment = buildPreInquiryAssessment({
    topic: "Ema hooldusvajadus",
    situation: "Mu 82-aastane ema vajab abi pesemisel, toidu tegemisel ja kodus liikumisel. Hooldan teda üksi ja ei tea, kas pöörduda KOV-i või teenuseosutaja poole."
  });

  assert.equal(assessment.assessmentMode, "PRE_ASSESSMENT");
  assert.deepEqual(assessment.lifeDomains, [
    "füüsiline tervis",
    "igapäevaelu toimingud"
  ]);
  assert.deepEqual(assessment.targetGroups, [
    "eakas inimene",
    "lähedane või hooldaja"
  ]);
  assert.equal(assessment.suggestedNextSteps, "BOTH");
  assert.ok(assessment.clarifyingQuestions.some((question) => question.includes("igapäevatoimingutes")));
  assert.ok(assessment.warnings.some((warning) => warning.includes("ei ole ametlik abivajaduse hindamine")));
});

test("pre-inquiry assessment flags child protection direction separately", () => {
  const assessment = buildPreInquiryAssessment({
    situation: "Kool andis teada, et lapse turvalisuse pärast on mure ja vanem ei tule kodus toime."
  });

  assert.deepEqual(assessment.lifeDomains, [
    "lapse heaolu ja pere"
  ]);
  assert.deepEqual(assessment.targetGroups, [
    "laps ja pere"
  ]);
  assert.equal(assessment.suggestedNextSteps, "CHILD_PROTECTION");
});

test("pre-inquiry assessment adds crisis warning for immediate danger", () => {
  const assessment = buildPreInquiryAssessment({
    situation: "Kodus on vahetu vägivalla oht ja inimene kardab oma turvalisuse pärast."
  });

  assert.equal(assessment.urgencyLevel, "URGENT");
  assert.ok(assessment.warnings.some((warning) => warning.includes("112")));
});

test("pre-inquiry assessment warns before processing personal data", () => {
  const assessment = buildPreInquiryAssessment({
    situation: "Mari Mets, isikukood 48901011234, telefon +372 5123 4567, elab Tamme tn 12."
  });

  assert.ok(assessment.riskFlags.includes("PERSONAL_DATA"));
  assert.ok(assessment.personalDataCategories.includes("estonian_personal_code"));
  assert.ok(assessment.personalDataCategories.includes("phone"));
  assert.ok(assessment.warnings.some((warning) => warning.includes("isikuandmeid")));
});

test("pre-inquiry assessment routes child safety concerns to human support channels", () => {
  const assessment = buildPreInquiryAssessment({
    situation: "Alaealine noor kirjeldab koduvagivalda ja koolikiusamist ning ei tunne end kodus turvaliselt."
  });

  assert.equal(assessment.suggestedNextSteps, "CHILD_PROTECTION");
  assert.ok(assessment.riskFlags.includes("CHILD_SAFETY"));
  assert.ok(assessment.riskFlags.includes("YOUTH_SAFETY"));
  assert.ok(assessment.warnings.some((warning) => warning.includes("116 111")));
});

test("pre-inquiry questionnaire stores a structured state and keeps traffic-light labels internal", () => {
  const state = createEmptyPreInquiryAssessmentState("TARGETED_ASSESSMENT");
  const normalized = normalizePreInquiryAssessmentState({
    ...state,
    subject: {
      ...state.subject,
      concernsAbout: "Eaka lähedase kohta",
      municipalityText: "Tallinn"
    },
    domains: state.domains.map((domain) => (
      domain.id === "daily_living"
        ? {
            ...domain,
            primaryAnswers: domain.primaryAnswers.map((answer) => (
              answer.id === "food_preparation"
                ? {
                    ...answer,
                    screenAnswer: "SIGNIFICANT_DIFFICULTY",
                    followUpAnswers: {
                      "Millises toidu hankimise või valmistamise osas vajab inimene abi?": "Poes käimine ja söögi tegemine."
                    }
                  }
                : answer
            ))
          }
        : domain
    ))
  });

  const dailyLiving = normalized.domains.find((domain) => domain.id === "daily_living");
  assert.equal(normalized.path, "TARGETED_ASSESSMENT");
  assert.equal(normalized.routing.confidence, "HIGH");
  assert.equal(dailyLiving.status, "RED");
  assert.ok(dailyLiving.routingSignals.includes("koduteenus"));

  const exportText = buildPreInquiryAssessmentExportText(normalized, {
    topic: "Ema toimetulek"
  });
  assert.match(exportText, /SotsiaalAI eelpöördumise eelinfo/);
  assert.match(exportText, /Toidu valmistamine: Kas inimene suudab iseseisvalt süüa valmistada/);
  assert.match(exportText, /Vastus: Oluline mure/);
  assert.match(exportText, /Poes käimine ja söögi tegemine/);
  assert.doesNotMatch(exportText, /\bRED\b/);
});

test("pre-inquiry questionnaire keeps the guide primary questions visible by life domain", () => {
  const primaryQuestions = PRE_INQUIRY_DOMAIN_DEFINITIONS.flatMap((domain) => domain.primaryQuestions);

  assert.equal(PRE_INQUIRY_DOMAIN_DEFINITIONS.length, 7);
  assert.equal(primaryQuestions.length, 21);
  assert.ok(primaryQuestions.some((question) => question.question.includes("eluruumides")));
  assert.ok(primaryQuestions.some((question) => question.question.includes("rahade planeerimisel")));
  assert.ok(primaryQuestions.some((question) => question.question.includes("sotsiaalne võrgustik on turvalised")));
});

test("pre-inquiry questionnaire can generate a saveable situation summary", () => {
  const state = normalizePreInquiryAssessmentState({
    ...createEmptyPreInquiryAssessmentState("COMPREHENSIVE_ASSESSMENT"),
    subject: {
      concernsAbout: "Minu enda kohta",
      municipalityText: "Põltsamaa vald",
      urgency: "Saan oodata"
    },
    supportContext: {
      existingSupport: "Naaber aitab vahel poes käia.",
      personWish: "Soovin kodus edasi elada."
    }
  });

  const summary = buildPreInquiryAssessmentSituation(state);
  assert.match(summary, /Põhjalikum eelkaardistus/);
  assert.match(summary, /Piirkond\/KOV: Põltsamaa vald/);
  assert.match(summary, /Naaber aitab vahel poes käia/);
});

test("pre-inquiry questionnaire builds a review from exact answered questions before sending", () => {
  const state = createEmptyPreInquiryAssessmentState("TARGETED_ASSESSMENT");
  const review = buildPreInquiryAssessmentReview({
    ...state,
    subject: {
      ...state.subject,
      concernsAbout: "Eaka lähedase kohta",
      municipalityText: "Põltsamaa vald",
      urgency: "Keegi võib olla vahetus ohus"
    },
    supportContext: {
      existingSupport: "Lähedane aitab nädalavahetusel.",
      personWish: "Soovib kodus edasi elada."
    },
    domains: state.domains.map((domain) => ({
      ...domain,
      primaryAnswers: domain.primaryAnswers.map((answer) => {
        if (answer.id === "social_relations") {
          return {
            ...answer,
            screenAnswer: "INDEPENDENT"
          };
        }
        if (answer.id === "indoor_mobility") {
          return {
            ...answer,
            screenAnswer: "UNKNOWN"
          };
        }
        if (answer.id === "food_preparation") {
          return {
            ...answer,
            screenAnswer: "SIGNIFICANT_DIFFICULTY",
            followUpAnswers: {
              "Millises toidu hankimise või valmistamise osas vajab inimene abi?": "Poes käimisel."
            }
          };
        }
        return answer;
      })
    }))
  });

  assert.equal(review.pathTitle, "Lühem eelkaardistus");
  assert.deepEqual(review.progress, {
    answeredPrimaryCount: 3,
    totalPrimaryCount: 21,
    unansweredPrimaryCount: 18
  });
  assert.equal(review.concernQuestions[0].answerLabel, "Oluline mure");
  assert.equal(review.concernQuestions[0].followUpAnswers[0].answer, "Poes käimisel.");
  assert.equal(review.unknownQuestions[0].title, "Liikumine eluruumides");
  assert.equal(review.strengthQuestions[0].title, "Sotsiaalsed suhted");
  assert.ok(review.unansweredQuestions.some((question) => question.id.endsWith(":outdoor_mobility")));
  assert.ok(review.possibleDirections.includes("koduteenus"));
  assert.ok(review.subjectLines.some((line) => line.value === "Põltsamaa vald"));
  assert.match(review.riskMessage, /112/);
});

test("pre-inquiry questionnaire provides structured contact matching context", () => {
  const state = createEmptyPreInquiryAssessmentState("TARGETED_ASSESSMENT");
  const assistContext = buildPreInquiryAssessmentAssistContext({
    ...state,
    subject: {
      ...state.subject,
      municipalityText: "Põltsamaa vald",
      urgency: "Olukord on tõsine ja vajab kiiret sekkumist"
    },
    domains: state.domains.map((domain) => (
      domain.id === "daily_living"
        ? {
            ...domain,
            primaryAnswers: domain.primaryAnswers.map((answer) => (
              answer.id === "food_preparation"
                ? {
                    ...answer,
                    screenAnswer: "SIGNIFICANT_DIFFICULTY"
                  }
                : answer
            ))
          }
        : domain
    ))
  });

  assert.deepEqual(assistContext, {
    municipality: "Põltsamaa vald",
    selectedNeedAreas: ["koduteenus", "sotsiaaltransport", "abivahendid", "hoolduskoormus"],
    urgencyLevel: "URGENT"
  });
});

test("pre-inquiry questionnaire builds a concise draft summary from structured answers", () => {
  const state = createEmptyPreInquiryAssessmentState("TARGETED_ASSESSMENT");
  const draftSummary = buildPreInquiryAssessmentDraftSummary({
    ...state,
    subject: {
      ...state.subject,
      concernsAbout: "Eaka lähedase kohta",
      municipalityText: "Põltsamaa vald",
      urgency: "Vajan ühendust lähiajal"
    },
    supportContext: {
      existingSupport: "Tütar aitab kord nädalas.",
      supportAdequacy: "Abist ei piisa.",
      personWish: "Soovib kodus edasi elada."
    },
    domains: state.domains.map((domain) => ({
      ...domain,
      primaryAnswers: domain.primaryAnswers.map((answer) => {
        if (answer.id === "social_relations") {
          return {
            ...answer,
            screenAnswer: "INDEPENDENT"
          };
        }
        if (answer.id === "food_preparation") {
          return {
            ...answer,
            screenAnswer: "SIGNIFICANT_DIFFICULTY",
            followUpAnswers: {
              "Millises toidu hankimise või valmistamise osas vajab inimene abi?": "Poes käimine ja söögi tegemine."
            }
          };
        }
        return answer;
      })
    }))
  });

  assert.match(draftSummary, /Eelkaardistuse kokkuvõte/);
  assert.match(draftSummary, /Kelle kohta: Eaka lähedase kohta/);
  assert.match(draftSummary, /Piirkond\/KOV: Põltsamaa vald/);
  assert.match(draftSummary, /Peamised mured ja täpsustused/);
  assert.match(draftSummary, /Igapäevaelu toimingud \/ Toidu valmistamine: Oluline mure/);
  assert.match(draftSummary, /Poes käimine ja söögi tegemine/);
  assert.match(draftSummary, /Toimivad valdkonnad või tugevused/);
  assert.match(draftSummary, /Suhtlemine \/ Sotsiaalsed suhted/);
  assert.match(draftSummary, /Olemasolev abi: Tütar aitab kord nädalas/);
  assert.match(draftSummary, /Inimese enda soov: Soovib kodus edasi elada/);
  assert.match(draftSummary, /Võimalikud teenuse- või kontaktisuunad: koduteenus/);
  assert.doesNotMatch(draftSummary, /\bRED\b|\bGREEN\b/);
});

test("pre-inquiry routing explains recipient matches and confidence", () => {
  const entry = {
    type: "SERVICE_PROVIDER",
    title: "Kodutugi",
    email: "info@example.test",
    providerProfile: {
      ownerId: "user_1",
      serviceArea: "Põltsamaa vald",
      services: ["Koduteenus"],
      serviceItems: [
        {
          name: "Koduteenus",
          description: "Abi poes käimisel ja toidu valmistamisel",
          category: "koduteenus",
          targetGroups: ["eakas inimene"],
          serviceArea: "Põltsamaa vald"
        }
      ]
    }
  };

  const explanation = explainPreInquiryRecipientMatch(entry, {
    municipality: "Põltsamaa vald",
    needAreas: ["koduteenus"],
    keywords: ["toidu", "poes"]
  });
  const confidence = buildPreInquiryRoutingConfidence({
    municipality: "Põltsamaa vald",
    needAreas: ["koduteenus"],
    suggestions: [entry]
  });

  assert.match(explanation.reason, /teenuseosutajaga/);
  assert.match(explanation.reason, /Piirkond kattub/);
  assert.deepEqual(explanation.matchedServices, ["Koduteenus"]);
  assert.equal(confidence.level, "HIGH");
  assert.match(confidence.text, /piirkonnal/);
});

test("pre-inquiry receiver workflow normalizes checklist and internal note", () => {
  const state = createEmptyPreInquiryAssessmentState("TARGETED_ASSESSMENT");
  const checklist = normalizePreInquiryReceiverChecklist([
    { id: "review_preinfo", checked: true },
    { id: "unknown", checked: true }
  ], {
    topic: "Ema toimetulek",
    assessmentState: {
      ...state,
      domains: state.domains.map((domain) => (
        domain.id === "daily_living"
          ? {
              ...domain,
              primaryAnswers: domain.primaryAnswers.map((answer) => (
                answer.id === "food_preparation"
                  ? { ...answer, screenAnswer: "UNKNOWN" }
                  : answer
              ))
            }
          : domain
      ))
    }
  });

  assert.equal(checklist[0].id, "review_preinfo");
  assert.equal(checklist[0].checked, true);
  assert.ok(checklist.some((item) => item.id === "clarify_missing" && item.label.includes("ebaselget")));
  assert.equal(normalizePreInquiryReceiverNote("  Märge\r\njärgmisele kontaktile  "), "Märge\njärgmisele kontaktile");
});

test("pre-inquiry assist message uses detected urgency, not only explicit urgency input", () => {
  const source = readFileSync(resolve(__dirname, "../../lib/preInquiries.js"), "utf8");

  assert.match(source, /const detectedUrgencyLevel = assessment\.urgencyLevel \|\| detectUrgencyLevel\(/);
  assert.match(
    source,
    /buildPreInquiryAssistantMessage\(\{[\s\S]*?detectedUrgencyLevel,\s*[\s\S]*?suggestedNextSteps[\s\S]*?\}\)/
  );
  assert.doesNotMatch(source, /detectedUrgencyLevel:\s*normalizedUrgencyLevel/);
});

test("pre-inquiry service includes structured assessment summary in fallback draft", () => {
  const source = readFileSync(resolve(__dirname, "../../lib/preInquiries.js"), "utf8");

  assert.match(source, /buildPreInquiryAssessmentDraftSummary/);
  assert.match(source, /const assessmentDraftSummary = assessmentState \? buildPreInquiryAssessmentDraftSummary\(assessmentState\) : ""/);
  assert.match(source, /assessmentSummary:\s*assessmentDraftSummary/);
});

test("pre-inquiry visibility is owner or recipient based without admin content bypass", () => {
  const serviceSource = readFileSync(resolve(__dirname, "../../lib/preInquiries.js"), "utf8");
  const listRouteSource = readFileSync(resolve(__dirname, "../../app/api/pre-inquiries/route.js"), "utf8");
  const detailRouteSource = readFileSync(resolve(__dirname, "../../app/api/pre-inquiries/[id]/route.js"), "utf8");
  const acceptRouteSource = readFileSync(resolve(__dirname, "../../app/api/pre-inquiries/[id]/accept/route.js"), "utf8");
  const roomRouteSource = readFileSync(resolve(__dirname, "../../app/api/pre-inquiries/[id]/room/route.js"), "utf8");
  const workflowRouteSource = readFileSync(resolve(__dirname, "../../app/api/pre-inquiries/[id]/workflow/route.js"), "utf8");

  assert.match(serviceSource, /function visiblePreInquiryWhere\(userId\) \{[\s\S]*?authorId: userId[\s\S]*?recipientOwnerId: userId[\s\S]*?\}/);
  assert.doesNotMatch(serviceSource, /isAdmin\s*\?\s*\{\}/);
  assert.doesNotMatch(serviceSource, /!\s*isAdmin\s*&&/);
  assert.doesNotMatch(listRouteSource, /isAdmin\(session\.user\)/);
  assert.doesNotMatch(detailRouteSource, /isAdmin\(session\.user\)/);
  assert.doesNotMatch(acceptRouteSource, /auth\.isAdmin/);
  assert.doesNotMatch(roomRouteSource, /auth\.isAdmin/);
  assert.match(serviceSource, /updatePreInquiryReceiverWorkflow/);
  assert.match(workflowRouteSource, /updatePreInquiryReceiverWorkflow/);
  assert.doesNotMatch(workflowRouteSource, /auth\.isAdmin/);
});
