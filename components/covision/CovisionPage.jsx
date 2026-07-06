"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import CovisionCanvas, { COVISION_STAGES } from "@/components/covision/CovisionCanvas";
import DocumentsDropdown from "@/components/documents/DocumentsDropdown";
import RoomCallBar from "@/components/rooms/RoomCallBar";
import { DashboardInfoTrigger } from "@/components/ui/DashboardInfoOverlay";
import { SubpageHeader } from "@/components/ui/SubpageHeader";
import Input from "@/components/ui/Input";
import OptionCard from "@/components/ui/OptionCard";
import Textarea from "@/components/ui/Textarea";
import {
  COVISION_CASE_STATUSES,
  COVISION_EXPECTED_HELP_TYPES,
  COVISION_JOURNEY_STEP_TYPES,
  COVISION_MESSAGE_TYPES,
  COVISION_PARTICIPANT_ROLES,
  COVISION_PARTY_GROUPS,
  COVISION_PARTY_STATUSES,
  COVISION_PROTECTIVE_OPTIONS,
  COVISION_RISK_OPTIONS,
  COVISION_TOPICS,
  EFFECTIVE_PRACTICE_STATUSES
} from "@/lib/covisionConstants";
import { localizePath } from "@/lib/localizePath";
import { pushWithTransition } from "@/lib/routeTransition";

const CHAT_WORKSPACE_RESTORE_STORAGE_KEY = "__SOTSIAALAI_CHAT_WORKSPACE_RESTORE__";
const CovisionCallBar = RoomCallBar;

function markChatWorkspaceRestore() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      CHAT_WORKSPACE_RESTORE_STORAGE_KEY,
      JSON.stringify({ ts: Date.now() })
    );
  } catch {}
}

const caseCreationSteps = Object.freeze([
  { key: "basic", label: "Põhiinfo" },
  { key: "anonymous_description", label: "Anonüümne olukorrakirjeldus" },
  { key: "process_flow", label: "Olukorra kulg" },
  { key: "network_risks", label: "Võrgustik, riskid ja kaitsetegurid" },
  { key: "central_question", label: "Keskne küsimus ja ootus" },
  { key: "review", label: "Ülevaade ja salvesta" }
]);

const journeyFocusBlocks = Object.freeze([
  ["mis on seni toimunud", "mis on seni toimunud"],
  ["mida on proovitud", "mida on proovitud"],
  ["mis on toiminud", "mis on toiminud"],
  ["mis on takerdunud", "mis on takerdunud"],
  ["mida ei ole veel teada", "mida ei ole veel teada"]
]);

const contributionStatuses = Object.freeze([
  ["NEW", "uus"],
  ["DISCUSSED", "arutatud"],
  ["ADDED_TO_CANVAS", "lisatud lõuendile"],
  ["CONVERTED_TO_NEXT_STEP", "muudetud järgmiseks sammuks"],
  ["DISMISSED", "kõrvale jäetud"]
]);

function messageTypeLabel(value) {
  return optionLabel(COVISION_MESSAGE_TYPES, value);
}

function messagesByTypes(messages = [], types = []) {
  const accepted = new Set(types);
  return messages.filter((message) => accepted.has(message.messageType));
}

function currentUserIdFromCase(covisionCase) {
  return covisionCase?.currentUserId || covisionCase?.me?.id || "";
}

function emptyCaseForm() {
  return {
    id: "",
    title: "",
    summary: "",
    anonymizedDescription: "",
    centralQuestion: "",
    expectedHelpTypes: [],
    topics: [],
    tagText: "",
    status: "draft",
    anonymityConfirmed: false,
    journeySteps: [],
    parties: [],
    riskFactors: [],
    participants: []
  };
}

function emptyPracticeForm() {
  return {
    id: "",
    sourceCovisionCaseId: "",
    title: "",
    background: "",
    mainChallenge: "",
    whatHelped: "",
    networkOrServiceRole: "",
    outcome: "",
    learningPoints: "",
    limitations: "",
    sources: "",
    topics: [],
    tagText: "",
    status: "draft"
  };
}

function caseToForm(item) {
  if (!item) return emptyCaseForm();
  return {
    id: item.id || "",
    title: item.title || "",
    summary: item.summary || "",
    anonymizedDescription: item.anonymizedDescription || "",
    centralQuestion: item.centralQuestion || "",
    expectedHelpTypes: item.expectedHelpTypes || [],
    topics: item.topics || [],
    tagText: (item.tags || []).join(", "),
    status: item.status || "draft",
    anonymityConfirmed: Boolean(item.anonymityConfirmedAt),
    journeySteps: item.journeySteps || [],
    parties: item.parties || [],
    riskFactors: item.riskFactors || [],
    participants: (item.participants || [])
      .filter((participant) => participant.role !== "owner")
      .map((participant) => ({
        email: participant.email || participant.user?.email || "",
        userId: participant.userId || "",
        role: participant.role || "participant"
      }))
  };
}

function practiceToForm(item) {
  if (!item) return emptyPracticeForm();
  return {
    id: item.id || "",
    sourceCovisionCaseId: item.sourceCovisionCaseId || "",
    title: item.title || "",
    background: item.background || "",
    mainChallenge: item.mainChallenge || "",
    whatHelped: item.whatHelped || "",
    networkOrServiceRole: item.networkOrServiceRole || "",
    outcome: item.outcome || "",
    learningPoints: item.learningPoints || "",
    limitations: item.limitations || "",
    sources: item.sources || "",
    topics: item.topics || [],
    tagText: (item.tags || []).join(", "),
    status: item.status || "draft"
  };
}

function splitTags(value) {
  return String(value || "")
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 32);
}

function formatDate(value, locale = "et") {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat(locale === "et" ? "et-EE" : locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function optionLabel(options, value) {
  return options.find((option) => option.value === value)?.label || value || "";
}

function dropdownOptions(options) {
  return (options || []).map((option) => {
    if (typeof option === "string") return { value: option, label: option };
    return {
      value: option.value || option.label || "",
      label: option.label || option.value || ""
    };
  });
}

function Notice({ type = "info", children }) {
  if (!children) return null;
  return <p>{children}</p>;
}

function Field({ label, children }) {
  return (
    <label>
      <span>{label}</span>
      {children}
    </label>
  );
}

function SelectField({ value, onChange, options, ariaLabel, openDirection = "down" }) {
  return (
    <DocumentsDropdown value={value}
      onChange={onChange}
      ariaLabel={ariaLabel}
      placeholder={ariaLabel}
      options={dropdownOptions(options)}
      openDirection={openDirection} />
  );
}

function CovisionInput(props) {
  return <Input {...props} />;
}

function CovisionTextarea(props) {
  return <Textarea {...props} />;
}

function MultiChoice({ options, value, onChange }) {
  const selected = new Set(value || []);
  return (
    <div>
      {options.map((option) => {
        const optionValue = option.value || option;
        const label = option.label || option;
        const active = selected.has(optionValue);
        return (
          <OptionCard type="checkbox"
            key={optionValue}
            value={optionValue}
            checked={active}
            showIndicator={false}
            fitTextLines={1}
            onChange={() => {
              const next = new Set(selected);
              if (next.has(optionValue)) next.delete(optionValue);
              else next.add(optionValue);
              onChange([...next]);
            }}
          >
            <span>{label}</span>
          </OptionCard>
        );
      })}
    </div>
  );
}

function StatusBadge({ status, type = "case" }) {
  const label = type === "practice"
    ? optionLabel(EFFECTIVE_PRACTICE_STATUSES, status)
    : optionLabel(COVISION_CASE_STATUSES, status);
  return <span>{label}</span>;
}

function SectionPanel({ title, children, aside }) {
  return (
    <section>
      <div>
        <h2>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function CardTags({ tags }) {
  if (!tags?.length) return null;
  return (
    <div>
      {tags.slice(0, 5).map((tag) => (
        <span key={tag}>{tag}</span>
      ))}
    </div>
  );
}

function CovisionCard({ item, onOpen, onEdit, locale, t }) {
  return (
    <article>
      <div>
        <div>
          <h3>{item.title}</h3>
          <CardTags tags={item.topics?.length ? item.topics : item.tags} />
        </div>
        <StatusBadge status={item.status} />
      </div>
      <div>
        <span>{t("covision.common.participants_count", { count: item.participants?.length || 1 }, "{count} osalejat")}</span>
        <span>{formatDate(item.lastActivityAt || item.updatedAt, locale)}</span>
      </div>
      <div>
        <Button type="button" variant="primary" onClick={() => onEdit(item)}>
          {t("covision.common.edit", "Muuda")}
        </Button>
        <Button type="button" onClick={() => onOpen(item)}>
          {t("covision.common.open", "Ava")}
        </Button>
      </div>
    </article>
  );
}

function PracticeCard({ item, onOpen, t }) {
  return (
    <article>
      <div>
        <div>
          <h3>{item.title}</h3>
          <CardTags tags={item.topics?.length ? item.topics : item.tags} />
        </div>
        <StatusBadge status={item.status} type="practice" />
      </div>
      <p>
        {item.background || item.whatHelped || t("covision.overview.practice_missing_description", "Üldistatud praktikakogemus vajab veel kirjeldust.")}
      </p>
      <div>
        <Button type="button" onClick={() => onOpen(item)}>
          {t("covision.common.open", "Ava")}
        </Button>
      </div>
    </article>
  );
}

function WellbeingInputCard({ item, onUse, locale, t }) {
  const text = item.editedText || item.generatedText || "";
  return (
    <article>
      <div>
        <h3>
          {t("covision.wellbeing_inputs.card_title", "Tööheaolu sisend")}
        </h3>
        <p>
          {item.sourceWorkflowType || t("covision.wellbeing_inputs.source_fallback", "tööheaolu")} · {formatDate(item.createdAt, locale)}
        </p>
      </div>
      <p>
        {text || t("covision.wellbeing_inputs.empty_preview", "Kinnitatud kovisiooni sisend vajab eelvaadet.")}
      </p>
      <div>
        <span>
          {t("covision.wellbeing_inputs.privacy_note", "Sisend jääb privaatseks, kuni salvestad selle kovisiooni mustandina.")}
        </span>
        <Button type="button" onClick={() => onUse(item)}>
          {t("covision.wellbeing_inputs.use", "Kasuta kovisioonis")}
        </Button>
      </div>
    </article>
  );
}

function SummaryField({ label, value, onChange }) {
  return (
    <Field label={label}>
      <CovisionTextarea value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        rows={3} />
    </Field>
  );
}

function knowledgeCategoryLabel(category) {
  if (category === "legal") return "Õigusraam";
  if (category === "guidance") return "Juhend või metoodika";
  if (category === "practice") return "Praktika";
  if (category === "service") return "Teenus või toetus";
  return "Taustainfo";
}

function KnowledgeSupportPanel({ support, t }) {
  const items = Array.isArray(support?.results) ? support.results : [];
  if (!support) {
    return (
      <p>
        {t("covision.knowledge.intro", "Otsi teadmistebaasist seotud seadusi, juhendeid, metoodikamaterjale, praktikakirjeldusi, teenuseid ja toetusi.")}
      </p>
    );
  }
  if (support.available === false) {
    return (
      <p>
        {t("covision.knowledge.unavailable", "Teadmistebaasi otsing ei ole selles keskkonnas seadistatud.")}
      </p>
    );
  }
  if (!items.length) {
    return (
      <p>
        {t("covision.knowledge.no_matches", "Teadmistebaasist ei leitud selle juhtumipüstituse põhjal sobivaid vasteid.")}
      </p>
    );
  }
  return (
    <div>
      {items.map((item) => (
        <article key={item.id || `${item.title}-${item.snippet}`}>
          <div>
            <h3>{item.title}</h3>
            <span>
              {knowledgeCategoryLabel(item.category)}
            </span>
          </div>
          {item.organization ? <p>{item.organization}</p> : null}
          <p className="whitespace-pre-wrap">{item.snippet}</p>
          {item.url ? (
            <a href={item.url} target="_blank" rel="noreferrer">
              {t("covision.knowledge.open_source", "Ava allikas")}
            </a>
          ) : null}
        </article>
      ))}
    </div>
  );
}

/* CanvasSection asendus: sektsioonid elavad nüüd CovisionCanvas'e
   liigutatavates kaartides (tellija 06.07 öö). */

function ContributionList({ messages, locale, emptyText, onPromote, onNextStep, t }) {
  if (!messages.length) return <p>{emptyText}</p>;
  return (
    <div>
      {messages.map((message) => (
        <article key={message.id}>
          <div>
            <span>{message.author?.name || message.author?.email || "Osaleja"} · {messageTypeLabel(message.messageType)}</span>
            <span>{formatDate(message.createdAt, locale)}</span>
          </div>
          <p className="whitespace-pre-wrap">{message.body}</p>
          <div>
            {contributionStatuses.slice(0, 3).map(([key, label]) => (
              <span key={key}>{label}</span>
            ))}
          </div>
          <div>
            <Button type="button" variant="primary" onClick={() => onPromote?.(message)}>{t("covision.room.add_to_canvas", "Lisa lõuendile")}</Button>
            <Button type="button" variant="primary" onClick={() => onNextStep?.(message)}>{t("covision.room.convert_to_next_step", "Muuda järgmiseks sammuks")}</Button>
          </div>
        </article>
      ))}
    </div>
  );
}

export default function CovisionPage({ embedded = false, onBack = null, hideHeader = false }) {
  const router = useRouter();
  const { locale, t } = useI18n();
  const [view, setView] = useState("overview");
  const [cases, setCases] = useState([]);
  const [practices, setPractices] = useState([]);
  const [wellbeingCovisionInputs, setWellbeingCovisionInputs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [topicFilter, setTopicFilter] = useState("");
  const [caseForm, setCaseForm] = useState(() => emptyCaseForm());
  const [caseStep, setCaseStep] = useState(0);
  const [activeCase, setActiveCase] = useState(null);
  const [practiceForm, setPracticeForm] = useState(() => emptyPracticeForm());
  const [anonymityIssues, setAnonymityIssues] = useState([]);
  const [questionSuggestions, setQuestionSuggestions] = useState([]);
  const [messageBody, setMessageBody] = useState("");
  const [messageType, setMessageType] = useState("question");
  const [messageSectionKey, setMessageSectionKey] = useState("questions");
  const [summaryForm, setSummaryForm] = useState({});
  const [knowledgeSupport, setKnowledgeSupport] = useState(null);
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);
  const [participantEmail, setParticipantEmail] = useState("");
  /* Lõuendi aktiivne etapp (tellija: "kõik toimub etappidena") */
  const [canvasStage, setCanvasStage] = useState("all");
  const [participantRole, setParticipantRole] = useState("participant");
  const [partyCategory, setPartyCategory] = useState(COVISION_PARTY_GROUPS[0]?.category || "");
  const [partyType, setPartyType] = useState(COVISION_PARTY_GROUPS[0]?.options?.[0] || "");
  const [riskKind, setRiskKind] = useState("risk");
  const [riskLabel, setRiskLabel] = useState(COVISION_RISK_OPTIONS[0] || "");
  const [riskSeverity, setRiskSeverity] = useState("medium");

  const covisionFetch = useCallback((url, options = {}) => {
    return fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        "x-ui-locale": locale
      }
    });
  }, [locale]);

  const selectedPartyGroup = useMemo(
    () => COVISION_PARTY_GROUPS.find((group) => group.category === partyCategory) || COVISION_PARTY_GROUPS[0],
    [partyCategory]
  );

  useEffect(() => {
    if (!selectedPartyGroup?.options?.includes(partyType)) {
      setPartyType(selectedPartyGroup?.options?.[0] || "");
    }
  }, [partyType, selectedPartyGroup]);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await covisionFetch("/api/covision", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || "Kovisiooni tööruumi laadimine ebaõnnestus.");
      }
      setCases(Array.isArray(payload?.cases) ? payload.cases : []);
      setPractices(Array.isArray(payload?.practices) ? payload.practices : []);
    } catch (loadError) {
      setCases([]);
      setPractices([]);
      setError(loadError?.message || "Kovisiooni tööruumi laadimine ebaõnnestus.");
    } finally {
      setLoading(false);
    }
  }, [covisionFetch]);

  const fetchWellbeingCovisionInputs = useCallback(async () => {
    try {
      const response = await covisionFetch("/api/wellbeing/output-drafts?outputType=covision_input&recipientType=covision", {
        cache: "no-store"
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) throw new Error(payload?.message || "Tööheaolu sisendite laadimine ebaõnnestus.");
      setWellbeingCovisionInputs(Array.isArray(payload.drafts) ? payload.drafts : []);
    } catch {
      setWellbeingCovisionInputs([]);
    }
  }, [covisionFetch]);

  useEffect(() => {
    void loadWorkspace();
    void fetchWellbeingCovisionInputs();
  }, [fetchWellbeingCovisionInputs, loadWorkspace]);

  const filteredCases = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("et");
    return cases.filter((item) => {
      if (topicFilter && !(item.topics || []).includes(topicFilter)) return false;
      if (!normalizedQuery) return true;
      return [
        item.title,
        item.summary,
        item.centralQuestion,
        ...(item.topics || []),
        ...(item.tags || [])
      ].join(" ").toLocaleLowerCase("et").includes(normalizedQuery);
    });
  }, [cases, query, topicFilter]);

  const filteredPractices = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("et");
    return practices.filter((item) => {
      if (topicFilter && !(item.topics || []).includes(topicFilter)) return false;
      if (!normalizedQuery) return true;
      return [
        item.title,
        item.background,
        item.whatHelped,
        ...(item.topics || []),
        ...(item.tags || [])
      ].join(" ").toLocaleLowerCase("et").includes(normalizedQuery);
    });
  }, [practices, query, topicFilter]);

  const roomMessages = useMemo(() => activeCase?.messages || [], [activeCase?.messages]);
  const roomQuestions = useMemo(() => messagesByTypes(roomMessages, ["question"]), [roomMessages]);
  const roomReflections = useMemo(() => messagesByTypes(roomMessages, ["observation", "reflection"]), [roomMessages]);
  const roomSuggestions = useMemo(() => messagesByTypes(roomMessages, ["source_note", "suggestion"]), [roomMessages]);
  const roomNextSteps = useMemo(() => messagesByTypes(roomMessages, ["next_step"]), [roomMessages]);
  const roomOpenQuestions = useMemo(() => messagesByTypes(roomMessages, ["question"]).slice(-3), [roomMessages]);

  const handleBack = useCallback(() => {
    if (view !== "overview") {
      setView("overview");
      setActiveCase(null);
      setNotice("");
      setError("");
      return;
    }
    if (typeof onBack === "function") {
      onBack();
      return;
    }
    markChatWorkspaceRestore();
    if (typeof window === "undefined") {
      pushWithTransition(router, localizePath("/vestlus", locale));
      return;
    }
    window.requestAnimationFrame(() => {
      pushWithTransition(router, localizePath("/vestlus", locale));
    });
  }, [locale, onBack, router, view]);

  function startCase() {
    setCaseForm(emptyCaseForm());
    setCaseStep(0);
    setAnonymityIssues([]);
    setQuestionSuggestions([]);
    setNotice("");
    setError("");
    setView("case_form");
  }

  function startCaseFromWellbeingDraft(item) {
    const text = item?.editedText || item?.generatedText || "";
    setCaseForm({
      ...emptyCaseForm(),
      title: t("covision.wellbeing_inputs.case_title", "Tööheaolu sisendist alustatud kovisioon"),
      summary: t("covision.wellbeing_inputs.case_summary", "Kasutaja kinnitatud tööheaolu sisend."),
      anonymizedDescription: text,
      centralQuestion: t(
        "covision.wellbeing_inputs.case_question",
        "Milline tugi või töökorralduslik kokkulepe aitaks olukorda edasi viia?"
      ),
      expectedHelpTypes: ["questions", "reflection"],
      topics: ["töökoormus ja taastumine"],
      tagText: "tööheaolu"
    });
    setCaseStep(1);
    setAnonymityIssues([]);
    setQuestionSuggestions([]);
    setNotice(t(
      "covision.wellbeing_inputs.case_notice",
      "Tööheaolu sisend on toodud kovisiooni mustandisse. Vaata tekst enne salvestamist üle."
    ));
    setError("");
    setView("case_form");
  }

  function editCase(item) {
    setCaseForm(caseToForm(item));
    setCaseStep(0);
    setAnonymityIssues([]);
    setQuestionSuggestions([]);
    setNotice("");
    setError("");
    setView("case_form");
  }

  async function openCase(item) {
    setError("");
    setNotice("");
    try {
      const response = await covisionFetch(`/api/covision/${encodeURIComponent(item.id)}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || "Kovisiooni avamine ebaõnnestus.");
      setActiveCase(payload.case);
      setSummaryForm(payload.case?.summaryRecord || {});
      setKnowledgeSupport(null);
      setView("room");
    } catch (openError) {
      setError(openError?.message || "Kovisiooni avamine ebaõnnestus.");
    }
  }

  function startPractice(seed = null) {
    setActiveCase(null);
    setPracticeForm(seed ? practiceToForm(seed) : emptyPracticeForm());
    setNotice("");
    setError("");
    setView("practice_form");
  }

  function updateCaseForm(field, value) {
    setCaseForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  function updateJourneyStep(index, field, value) {
    setCaseForm((current) => ({
      ...current,
      journeySteps: current.journeySteps.map((step, stepIndex) => (
        stepIndex === index ? { ...step, [field]: value } : step
      ))
    }));
  }

  function addJourneyStep() {
    setCaseForm((current) => ({
      ...current,
      journeySteps: [
        ...current.journeySteps,
        {
          type: COVISION_JOURNEY_STEP_TYPES[0],
          title: "",
          description: "",
          dateLabel: "",
          notes: "",
          status: "needs_clarification"
        }
      ]
    }));
  }

  function removeJourneyStep(index) {
    setCaseForm((current) => ({
      ...current,
      journeySteps: current.journeySteps.filter((_, stepIndex) => stepIndex !== index)
    }));
  }

  function addParty() {
    if (!partyType) return;
    setCaseForm((current) => ({
      ...current,
      parties: [
        ...current.parties,
        {
          category: partyCategory,
          type: partyType,
          label: partyType,
          involvementStatus: "vajab kaasamist",
          cooperationStatus: "info puudub",
          roleDescription: "",
          note: ""
        }
      ]
    }));
  }

  function updateParty(index, field, value) {
    setCaseForm((current) => ({
      ...current,
      parties: current.parties.map((party, partyIndex) => (
        partyIndex === index ? { ...party, [field]: value } : party
      ))
    }));
  }

  function addRiskFactor() {
    if (!riskLabel) return;
    setCaseForm((current) => ({
      ...current,
      riskFactors: [
        ...current.riskFactors,
        {
          type: riskKind,
          label: riskLabel,
          severity: riskSeverity,
          note: "",
          needsAttention: true
        }
      ]
    }));
  }

  function updateRiskFactor(index, field, value) {
    setCaseForm((current) => ({
      ...current,
      riskFactors: current.riskFactors.map((factor, factorIndex) => (
        factorIndex === index ? { ...factor, [field]: value } : factor
      ))
    }));
  }

  async function inviteParticipant() {
    if (!activeCase?.id || saving) return;
    const email = participantEmail.trim().toLowerCase();
    if (!email) return;
    setSaving(true);
    setError("");
    try {
      const nextParticipants = [
        ...(activeCase.participants || [])
          .filter((participant) => participant.role !== "owner")
          .map((participant) => ({
            email: participant.email || participant.user?.email || "",
            userId: participant.userId || "",
            role: participant.role || "participant"
          })),
        { email, role: participantRole }
      ];
      const response = await covisionFetch(`/api/covision/${encodeURIComponent(activeCase.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...caseToForm(activeCase),
          participants: nextParticipants,
          tags: activeCase.tags || [],
          anonymityConfirmed: true
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || "Kutse lisamine ebaõnnestus.");
      setActiveCase(payload.case);
      setParticipantEmail("");
      setNotice("Osaleja kutse lisatud. Sisu avaneb pärast autentimist ja õiguste kontrolli.");
      await loadWorkspace();
    } catch (inviteError) {
      setError(inviteError?.message || "Kutse lisamine ebaõnnestus.");
    } finally {
      setSaving(false);
    }
  }

  async function runAnonymityCheck() {
    setError("");
    try {
      const response = await covisionFetch("/api/covision/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "anonymity",
          description: caseForm.anonymizedDescription
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || "Anonüümsuse kontroll ebaõnnestus.");
      setAnonymityIssues(Array.isArray(payload.issues) ? payload.issues : []);
      if (!caseForm.topics.length && Array.isArray(payload.topics)) {
        updateCaseForm("topics", payload.topics);
      }
      setNotice(payload.issues?.length ? "Kontroll leidis detailid, mis vajavad ülevaatust." : "Anonüümsuse kontroll ei leidnud selgeid tuvastavaid detaile.");
    } catch (assistError) {
      setError(assistError?.message || "Anonüümsuse kontroll ebaõnnestus.");
    }
  }

  async function runQuestionAssist() {
    setError("");
    try {
      const response = await covisionFetch("/api/covision/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "questions",
          case: {
            anonymizedDescription: caseForm.anonymizedDescription,
            topics: caseForm.topics,
            riskFactors: caseForm.riskFactors
          }
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || "Küsimuste pakkumine ebaõnnestus.");
      setQuestionSuggestions(Array.isArray(payload.questions) ? payload.questions : []);
    } catch (assistError) {
      setError(assistError?.message || "Küsimuste pakkumine ebaõnnestus.");
    }
  }

  async function saveCase(event) {
    event.preventDefault();
    if (saving) return;
    if (!caseForm.anonymityConfirmed) {
      setError("Kovisiooni salvestamiseks kinnita, et juhtumipüstitus on anonüümne.");
      setCaseStep(1);
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    const payload = {
      ...caseForm,
      tags: splitTags(caseForm.tagText),
      anonymityConfirmed: Boolean(caseForm.anonymityConfirmed)
    };
    try {
      const response = await covisionFetch(caseForm.id ? `/api/covision/${encodeURIComponent(caseForm.id)}` : "/api/covision", {
        method: caseForm.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || "Kovisiooni salvestamine ebaõnnestus.");
      await loadWorkspace();
      setActiveCase(data.case);
      setSummaryForm(data.case?.summaryRecord || {});
      setKnowledgeSupport(null);
      setNotice("Kovisiooni juhtumipüstitus salvestatud.");
      setView("room");
    } catch (saveError) {
      setError(saveError?.message || "Kovisiooni salvestamine ebaõnnestus.");
    } finally {
      setSaving(false);
    }
  }

  async function sendMessage(event) {
    event.preventDefault();
    if (!activeCase?.id || !messageBody.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await covisionFetch(`/api/covision/${encodeURIComponent(activeCase.id)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageType, body: messageBody, sectionKey: messageSectionKey, status: "NEW" })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || "Sõnumi lisamine ebaõnnestus.");
      setActiveCase((current) => ({
        ...current,
        status: current?.status === "draft" ? "active" : current?.status,
        messages: [...(current?.messages || []), payload.message]
      }));
      setMessageBody("");
    } catch (sendError) {
      setError(sendError?.message || "Sõnumi lisamine ebaõnnestus.");
    } finally {
      setSaving(false);
    }
  }

  function promoteContribution(message) {
    setNotice(`Arutelusisend märgitud lõuendile lisamiseks: ${messageTypeLabel(message.messageType)}.`);
  }

  function convertContributionToNextStep(message) {
    setNotice(`Järgmine samm on eraldi objektina ette valmistatud sisendist: ${message.body?.slice(0, 80) || ""}`);
  }

  async function draftSummary() {
    if (!activeCase?.id) return;
    setError("");
    try {
      const response = await covisionFetch("/api/covision/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "summary", caseId: activeCase.id })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || "Kokkuvõtte mustandi koostamine ebaõnnestus.");
      setSummaryForm(payload.summary || {});
      setNotice("Kokkuvõtte mustand koostatud. Vaata see enne salvestamist üle.");
    } catch (assistError) {
      setError(assistError?.message || "Kokkuvõtte mustandi koostamine ebaõnnestus.");
    }
  }

  async function loadKnowledgeSupport() {
    if (!activeCase?.id || knowledgeLoading) return;
    setKnowledgeLoading(true);
    setError("");
    try {
      const response = await covisionFetch("/api/covision/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "knowledge", caseId: activeCase.id, topK: 8 })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || "Teadmistebaasi taustainfo otsimine ebaõnnestus.");
      setKnowledgeSupport(payload.knowledge || { available: true, results: [] });
      if (payload.knowledge?.available === false) {
        setNotice("Teadmistebaasi otsing ei ole selles keskkonnas seadistatud.");
      } else {
        setNotice("Teadmistebaasi taustainfo uuendatud. Kontrolli allikaid enne kasutamist.");
      }
    } catch (knowledgeError) {
      setError(knowledgeError?.message || "Teadmistebaasi taustainfo otsimine ebaõnnestus.");
    } finally {
      setKnowledgeLoading(false);
    }
  }

  async function saveSummary() {
    if (!activeCase?.id || saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await covisionFetch(`/api/covision/${encodeURIComponent(activeCase.id)}/summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(summaryForm)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || "Kokkuvõtte salvestamine ebaõnnestus.");
      setActiveCase((current) => ({
        ...current,
        status: "summary_ready",
        summaryRecord: payload.summary
      }));
      setNotice("Kovisiooni kokkuvõte salvestatud.");
      await loadWorkspace();
    } catch (summaryError) {
      setError(summaryError?.message || "Kokkuvõtte salvestamine ebaõnnestus.");
    } finally {
      setSaving(false);
    }
  }

  async function startPracticeFromCase() {
    if (!activeCase?.id) return;
    setError("");
    try {
      const response = await covisionFetch("/api/covision/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "practice", caseId: activeCase.id })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || "Toimiva praktika mustandi alustamine ebaõnnestus.");
      setPracticeForm({
        ...practiceToForm(payload.practice),
        sourceCovisionCaseId: activeCase.id
      });
      setView("practice_form");
    } catch (practiceError) {
      setError(practiceError?.message || "Toimiva praktika mustandi alustamine ebaõnnestus.");
    }
  }

  function updatePracticeForm(field, value) {
    setPracticeForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  async function savePractice(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    const payload = {
      ...practiceForm,
      tags: splitTags(practiceForm.tagText)
    };
    try {
      const response = await covisionFetch(practiceForm.id ? `/api/covision/effective-practices/${encodeURIComponent(practiceForm.id)}` : "/api/covision/effective-practices", {
        method: practiceForm.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || "Toimiva praktika salvestamine ebaõnnestus.");
      await loadWorkspace();
      setNotice("Toimiva praktika kirje salvestatud.");
      setPracticeForm(practiceToForm(data.practice));
      setView("overview");
    } catch (practiceError) {
      setError(practiceError?.message || "Toimiva praktika salvestamine ebaõnnestus.");
    } finally {
      setSaving(false);
    }
  }

  const content = (
    <div>
          {!hideHeader ? (
            <SubpageHeader onBack={handleBack}
              backAriaLabel={t("buttons.back")}
              holdPressedVisualDisabled
              anchorBack={false}
              rightSlot={
                <DashboardInfoTrigger infoId="kovision"
                  label="Ava info"
                  title={t("chat.workspace.cards.kovision.title", "Kovisioon")} />
              }
            >
              {t("chat.workspace.cards.kovision.title", "Kovisioon")}
            </SubpageHeader>
          ) : null}

          <Notice type="error">{error}</Notice>
          <Notice>{notice}</Notice>

          {view === "overview" ? (
            <>
              <section>
                <div>
                  <div aria-label={t("covision.overview.actions_aria", "Kovisiooni tegevused")}>
                    <Button type="button" onClick={startCase}>
                      <span>{t("covision.overview.new_covision", "Uus kovisioon")}</span>
                    </Button>
                    <Button type="button" onClick={() => setView("wellbeing_inputs")}>
                      <span>{t("covision.overview.from_wellbeing", "Tööheaolust")}</span>
                    </Button>
                    <Button type="button" onClick={() => startPractice()}>
                      <span>{t("covision.overview.practice_example", "Praktikanäide")}</span>
                    </Button>
                  </div>
                  <div>
                    <label>
                      <CovisionInput value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Otsi teema, sildi või küsimuse järgi"
                        aria-label="Otsi" />
                    </label>
                    <div>
                      <SelectField value={topicFilter}
                        onChange={setTopicFilter}
                        ariaLabel="Teemafilter"
                        openDirection="down"
                        options={[{ value: "", label: "Kõik teemad" }, ...COVISION_TOPICS.map((topic) => ({ value: topic, label: topic }))]} />
                    </div>
                  </div>
                </div>
              </section>

              <div>
                <SectionPanel title="Minu kovisioonid">
                  {loading ? (
                    <p>{t("covision.overview.loading_covisions", "Laen kovisioone...")}</p>
                  ) : filteredCases.length ? (
                    <div>
                      {filteredCases.map((item) => (
                        <CovisionCard key={item.id} item={item} onOpen={openCase} onEdit={editCase} locale={locale} t={t} />
                      ))}
                    </div>
                  ) : (
                    <div>
                      <p>{t("covision.overview.empty_covisions_title", "Kovisioone pole veel loodud")}</p>
                      <p>{t("covision.overview.empty_covisions_body", "Alusta uus kovisioon või muuda filtrit, et olemasolevad tulemused uuesti nähtavaks teha.")}</p>
                    </div>
                  )}
                </SectionPanel>

                <SectionPanel title="Praktikanäited">
                  {loading ? (
                    <p>{t("covision.overview.loading_practices", "Laen praktikakogemusi...")}</p>
                  ) : filteredPractices.length ? (
                    <div>
                      {filteredPractices.map((item) => (
                        <PracticeCard key={item.id} item={item} onOpen={(practice) => startPractice(practice)} t={t} />
                      ))}
                    </div>
                  ) : (
                    <div>
                      <p>{t("covision.overview.empty_practices_title", "Praktikanäiteid pole lisatud")}</p>
                      <p>{t("covision.overview.empty_practices_body", "Lisa esimene näide või eemalda teemafilter, kui otsid varasemaid kogemusi.")}</p>
                    </div>
                  )}
                </SectionPanel>
              </div>
            </>
          ) : null}

          {view === "wellbeing_inputs" ? (
            <SectionPanel title={t("covision.wellbeing_inputs.section_title", "Heaolu töövoogudest ette valmistatud sisendid")}
              aside={
                <Button type="button" variant="primary" onClick={() => setView("overview")}>
                  {t("buttons.back", "Tagasi")}
                </Button>
              }
            >
              {wellbeingCovisionInputs.length ? (
                <div>
                  {wellbeingCovisionInputs.map((item) => (
                    <WellbeingInputCard key={item.id}
                      item={item}
                      onUse={startCaseFromWellbeingDraft}
                      locale={locale}
                      t={t} />
                  ))}
                </div>
              ) : (
                <p>
                  {t(
                    "covision.wellbeing_inputs.empty",
                    "Kinnitatud tööheaolu kovisiooni sisendeid veel ei ole. Koosta see tööheaolu töövoost ja kinnita tekst enne kasutamist."
                  )}
                </p>
              )}
            </SectionPanel>
          ) : null}

          {view === "case_form" ? (
            <form onSubmit={saveCase}>
              <div className="covision-steps" aria-label="Kovisiooni loomise sammud">
                {caseCreationSteps.map((step, index) => (
                  <Button key={step.key}
                    type="button"
                    size="sm"
                    onClick={() => setCaseStep(index)}
                    aria-current={index === caseStep ? "step" : undefined}
                  >
                    {index + 1}. {t(`covision.workflow.steps.${step.key}`, step.label)}
                  </Button>
                ))}
              </div>

              {caseStep === 0 ? (
              <SectionPanel title={`1. ${t("covision.workflow.steps.basic", "Põhiinfo")}`}>
                <div>
                  <Field label="Pealkiri">
                    <CovisionInput value={caseForm.title} onChange={(event) => updateCaseForm("title", event.target.value)} required />
                  </Field>
                  <Field label="Staatus">
                    <SelectField value={caseForm.status} onChange={(value) => updateCaseForm("status", value)} ariaLabel="Staatus" options={COVISION_CASE_STATUSES} />
                  </Field>
                </div>
                <Field label="Lühikirjeldus">
                  <CovisionTextarea value={caseForm.summary} onChange={(event) => updateCaseForm("summary", event.target.value)} rows={3} />
                </Field>
                <div>
                  <p>{t("covision.workflow.topic_areas", "Teemavaldkonnad")}</p>
                  <MultiChoice options={COVISION_TOPICS} value={caseForm.topics} onChange={(value) => updateCaseForm("topics", value)} />
                </div>
                <Field label="Oma sildid">
                  <CovisionInput value={caseForm.tagText} onChange={(event) => updateCaseForm("tagText", event.target.value)} placeholder="eralda komaga" />
                </Field>
              </SectionPanel>
              ) : null}

              {caseStep === 1 ? (
              <SectionPanel title={`2. ${t("covision.workflow.steps.anonymous_description", "Anonüümne olukorrakirjeldus")}`}
                aside={<Button type="button" variant="primary" onClick={runAnonymityCheck} >{t("covision.workflow.check_anonymity", "Kontrolli anonüümsust")}</Button>}
              >
                <p>
                  {t(
                    "covision.workflow.anonymity_instruction",
                    "Kirjelda olukorda nii, et inimene ei oleks tuvastatav. Ära sisesta nime, isikukoodi, täpset aadressi, telefoninumbrit, täpset sündmuskohta ega muid tuvastamist võimaldavaid detaile."
                  )}
                </p>
                <CovisionTextarea value={caseForm.anonymizedDescription}
                  onChange={(event) => updateCaseForm("anonymizedDescription", event.target.value)}
                  rows={8}
                  placeholder="Kirjelda tööalast olukorda ilma tuvastatavate kliendiandmeteta." />
                {anonymityIssues.length ? (
                  <div>
                    {anonymityIssues.map((issue, index) => (
                      <div key={`${issue.type}-${index}`} >
                        <p>{issue.label}</p>
                        <p>{issue.snippet}</p>
                        <p>{issue.suggestion}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
                <label>
                  <input
                    type="checkbox"
                    checked={caseForm.anonymityConfirmed}
                    onChange={(event) => updateCaseForm("anonymityConfirmed", event.target.checked)}
                  />
                  <span>{t("covision.workflow.anonymity_confirmation", "Kinnitan, et juhtumipüstitus on anonüümne ja ei sisalda tahtlikult tuvastatavaid kliendiandmeid.")}</span>
                </label>
              </SectionPanel>
              ) : null}

              {caseStep === 2 ? (
              <SectionPanel title={`3. ${t("covision.workflow.steps.process_flow", "Olukorra kulg")}`} aside={<Button type="button" variant="primary" onClick={addJourneyStep} >{t("covision.workflow.add_step", "Lisa samm")}</Button>}>
                <p>
                  {t("covision.workflow.process_flow_hint", "Kirjelda tööprotsessi või olukorra kulgu. Keskendu sellele, mis on seni toimunud, mida on proovitud, mis on toiminud ja mis on takerdunud. Ära lisa tuvastatavaid kliendiandmeid.")}
                </p>
                {caseForm.journeySteps.length ? (
                  <div>
                    {caseForm.journeySteps.map((step, index) => (
                      <div key={`step-${index}`} >
                        <div>
                          <SelectField value={step.type || COVISION_JOURNEY_STEP_TYPES[0]} onChange={(value) => updateJourneyStep(index, "type", value)} ariaLabel="Sammu tüüp" options={COVISION_JOURNEY_STEP_TYPES} />
                          <CovisionInput value={step.title || ""} onChange={(event) => updateJourneyStep(index, "title", event.target.value)} placeholder="Lühike pealkiri" />
                          <CovisionInput value={step.dateLabel || ""} onChange={(event) => updateJourneyStep(index, "dateLabel", event.target.value)} placeholder="Periood" />
                          <Button type="button" variant="danger" onClick={() => removeJourneyStep(index)} >{t("covision.common.remove", "Eemalda")}</Button>
                        </div>
                        <CovisionTextarea value={step.description || ""} onChange={(event) => updateJourneyStep(index, "description", event.target.value)} rows={2} placeholder="Lühikirjeldus" />
                        <div>
                          <CovisionInput value={step.notes || ""} onChange={(event) => updateJourneyStep(index, "notes", event.target.value)} placeholder="Märkused" />
                          <SelectField value={step.status || "needs_clarification"}
                            onChange={(value) => updateJourneyStep(index, "status", value)}
                            ariaLabel="Sammu seis"
                            options={[
                              { value: "needs_clarification", label: "vajab täpsustamist" },
                              { value: "confirmed", label: "kinnitatud" }
                            ]} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div>
                    <p>{t("covision.workflow.process_flow_empty_hint", "Lisa tööprotsessi etapid kaartidena. See ei ole inimese elulugu, vaid tööalase olukorra kulg.")}</p>
                    <div>
                      {journeyFocusBlocks.map(([key, label]) => (
                        <span key={key} >{label}</span>
                      ))}
                    </div>
                  </div>
                )}
              </SectionPanel>
              ) : null}

              {caseStep === 3 ? (
              <div>
              <SectionPanel title="4. Võrgustik ja osapooled" aside={<Button type="button" variant="primary" onClick={addParty} >{t("covision.workflow.add_party", "Lisa osapool")}</Button>}>
                <div>
                  <SelectField value={partyCategory}
                    onChange={setPartyCategory}
                    ariaLabel="Osapoole kategooria"
                    options={COVISION_PARTY_GROUPS.map((group) => ({ value: group.category, label: group.category }))} />
                  <SelectField value={partyType} onChange={setPartyType} ariaLabel="Osapool" options={selectedPartyGroup?.options || []} />
                </div>
                {caseForm.parties.length ? (
                  <div>
                    {caseForm.parties.map((party, index) => (
                      <div key={`party-${index}`} >
                        <CovisionInput value={party.label || ""} onChange={(event) => updateParty(index, "label", event.target.value)} />
                        <div>
                          <SelectField value={party.involvementStatus || "info puudub"} onChange={(value) => updateParty(index, "involvementStatus", value)} ariaLabel="Kaasamise seis" options={COVISION_PARTY_STATUSES} />
                          <SelectField value={party.cooperationStatus || "info puudub"} onChange={(value) => updateParty(index, "cooperationStatus", value)} ariaLabel="Koostöö seis" options={COVISION_PARTY_STATUSES} />
                        </div>
                        <CovisionTextarea value={party.note || ""} onChange={(event) => updateParty(index, "note", event.target.value)} rows={2} placeholder="Lühimärkus" />
                        <Button type="button" variant="danger" onClick={() => updateCaseForm("parties", caseForm.parties.filter((_, partyIndex) => partyIndex !== index))} >{t("covision.common.remove", "Eemalda")}</Button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </SectionPanel>

              <SectionPanel title="5. Riskid ja kaitsetegurid" aside={<Button type="button" variant="primary" onClick={addRiskFactor} >{t("covision.workflow.add_factor", "Lisa tegur")}</Button>}>
                <div>
                  <SelectField value={riskKind}
                    onChange={(value) => {
                      setRiskKind(value);
                      setRiskLabel(value === "risk" ? COVISION_RISK_OPTIONS[0] : COVISION_PROTECTIVE_OPTIONS[0]);
                    }}
                    ariaLabel="Teguri tüüp"
                    options={[
                      { value: "risk", label: "risk" },
                      { value: "protective", label: "kaitsetegur" }
                    ]} />
                  <SelectField value={riskLabel} onChange={setRiskLabel} ariaLabel="Tegur" options={riskKind === "risk" ? COVISION_RISK_OPTIONS : COVISION_PROTECTIVE_OPTIONS} />
                  <SelectField value={riskSeverity}
                    onChange={setRiskSeverity}
                    ariaLabel="Olulisus"
                    options={[
                      { value: "low", label: "madal" },
                      { value: "medium", label: "keskmine" },
                      { value: "high", label: "kõrge" }
                    ]} />
                </div>
                {caseForm.riskFactors.length ? (
                  <div>
                    {caseForm.riskFactors.map((factor, index) => (
                      <div key={`factor-${index}`} >
                        <div>
                          <strong>{factor.label}</strong>
                          <span>{factor.type === "protective" ? "kaitsetegur" : "risk"} · {factor.severity}</span>
                        </div>
                        <CovisionTextarea value={factor.note || ""} onChange={(event) => updateRiskFactor(index, "note", event.target.value)} rows={2} placeholder="Märkus" />
                        <Button type="button" variant="danger" onClick={() => updateCaseForm("riskFactors", caseForm.riskFactors.filter((_, factorIndex) => factorIndex !== index))} >{t("covision.common.remove", "Eemalda")}</Button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </SectionPanel>
              </div>
              ) : null}

              {caseStep === 4 ? (
              <SectionPanel title={`5. ${t("covision.workflow.steps.central_question", "Keskne küsimus ja ootus")}`}
                aside={<Button type="button" variant="primary" onClick={runQuestionAssist} >{t("covision.workflow.suggest_questions", "Paku küsimusi")}</Button>}
              >
                <CovisionTextarea value={caseForm.centralQuestion} onChange={(event) => updateCaseForm("centralQuestion", event.target.value)} rows={3} placeholder="Sõnasta üks keskne küsimus kolleegidele." />
                {questionSuggestions.length ? (
                  <div>
                    {questionSuggestions.map((question) => (
                      <Button type="button"
                        key={question}
                        size="sm"
                        onClick={() => updateCaseForm("centralQuestion", question)}
                      >
                        {question}
                      </Button>
                    ))}
                  </div>
                ) : null}
                <div>
                  <p>{t("covision.workflow.expectations_heading", "Mida ootan kovisioonilt?")}</p>
                  <MultiChoice options={COVISION_EXPECTED_HELP_TYPES} value={caseForm.expectedHelpTypes} onChange={(value) => updateCaseForm("expectedHelpTypes", value)} />
                </div>
              </SectionPanel>
              ) : null}

              {caseStep === 5 ? (
              <SectionPanel title={`6. ${t("covision.workflow.steps.review", "Ülevaade ja salvesta")}`}>
                <p>{t("covision.workflow.review_hint", "Kontrolli enne salvestamist uuesti, et kirjeldus ei sisaldaks tuvastatavaid kliendiandmeid. Kutsed lisatakse kovisiooniruumis.")}</p>
                <div>
                  <div><strong>{t("covision.workflow.review_title", "Pealkiri")}</strong><p>{caseForm.title || t("covision.workflow.missing_value", "Puudub")}</p></div>
                  <div><strong>{t("covision.workflow.review_central_question", "Keskne küsimus")}</strong><p>{caseForm.centralQuestion || t("covision.workflow.pending_clarification", "Täpsustamisel")}</p></div>
                  <div><strong>{t("covision.workflow.review_anonymous_description", "Anonüümne olukorrakirjeldus")}</strong><p>{caseForm.anonymizedDescription || t("covision.workflow.missing_value", "Puudub")}</p></div>
                  <div><strong>{t("covision.workflow.review_process_flow", "Olukorra kulg")}</strong><p>{caseForm.journeySteps.length ? t("covision.workflow.step_count", { count: caseForm.journeySteps.length }, "{count} etappi") : t("covision.workflow.no_steps", "Etapid puuduvad")}</p></div>
                  <div><strong>{t("covision.workflow.review_network_risks", "Võrgustik, riskid ja kaitsetegurid")}</strong><p>{t("covision.workflow.parties_factors_count", { parties: caseForm.parties.length, factors: caseForm.riskFactors.length }, "{parties} osapoolt, {factors} tegurit")}</p></div>
                  <div><strong>{t("covision.workflow.review_expectation", "Ootus kovisioonile")}</strong><p>{caseForm.expectedHelpTypes.join(", ") || t("covision.workflow.missing_value", "Puudub")}</p></div>
                </div>
              </SectionPanel>
              ) : null}

              <div>
                <Button type="button" variant="linkBrand" onClick={() => setView("overview")}>{t("buttons.cancel", "Tühista")}</Button>
                {caseStep > 0 ? <Button type="button" variant="linkBrand" onClick={() => setCaseStep((step) => Math.max(0, step - 1))}>{t("buttons.back", "Tagasi")}</Button> : null}
                {caseStep < caseCreationSteps.length - 1 ? (
                  <Button type="button" onClick={() => setCaseStep((step) => Math.min(caseCreationSteps.length - 1, step + 1))} >{t("covision.common.next", "Järgmine")}</Button>
                ) : (
                  <Button type="submit" disabled={saving || !caseForm.title.trim() || !caseForm.anonymityConfirmed} >
                    {saving ? t("covision.common.saving", "Salvestan...") : t("covision.workflow.save_open_room", "Salvesta ja ava kovisiooniruum")}
                  </Button>
                )}
              </div>
            </form>
          ) : null}

          {view === "room" && activeCase ? (
            <div>
              <div>
                <div>
                  <div>
                    <div>
                      <h2>{activeCase.title}</h2>
                      <StatusBadge status={activeCase.status} />
                      <span>{t("covision.common.participants_count", { count: activeCase.participants?.length || 1 }, "{count} osalejat")}</span>
                    </div>
                    <p>{t("covision.room.central_question_inline", { question: activeCase.centralQuestion || t("covision.workflow.pending_clarification_lower", "täpsustamisel") }, "Keskne küsimus: {question}")}</p>
                    <CardTags tags={activeCase.topics} />
                  </div>
                  <div>
                    <Button type="button" variant="primary" >{t("covision.room.request_to_speak", "Soovin sõna")}</Button>
                    <Button type="button" variant="primary" onClick={loadKnowledgeSupport} disabled={knowledgeLoading} >
                      {knowledgeLoading ? "Otsin taustainfot..." : "Otsi taustainfot"}
                    </Button>
                    <Button type="button" variant="primary" onClick={startPracticeFromCase} >{t("covision.room.create_practice", "Loo toimiv praktika")}</Button>
                  </div>
                </div>
                <CovisionCallBar roomId={activeCase.id}
                  userId={currentUserIdFromCase(activeCase)}
                  basePath={`/api/covision/${encodeURIComponent(activeCase.id)}/calls`}
                  contextType="COVISION"
                  allowRecordingControls={false}
                  recordingAllowed={false}
                  t={t} />
              </div>

              <div>
                {/* TÄISEKRAANI LÕUEND (tellija 06.07 öö): sektsioonid on
                    liigutatavad kaardid; etapiriba juhib fookust. */}
                <div className="covision-stagebar" role="tablist" aria-label={t("covision.canvas.stages", "Kovisiooni etapid")}>
                  {COVISION_STAGES.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      role="tab"
                      aria-selected={canvasStage === s.key}
                      data-variant={canvasStage === s.key ? "primary" : "default"}
                      data-on={canvasStage === s.key ? "1" : "0"}
                      onClick={() => setCanvasStage(s.key)}
                    >
                      {t(s.labelKey, s.fallback)}
                    </button>
                  ))}
                </div>
                <CovisionCanvas
                  caseId={activeCase.id}
                  stage={canvasStage}
                  t={t}
                  sections={[
                    { id: "s1", title: "1. Keskne küsimus", node: activeCase.centralQuestion || "Täpsustamisel" },
                    { id: "s2", title: "2. Anonüümne olukorrakirjeldus", node: activeCase.anonymizedDescription || activeCase.summary || "Puudub" },
                    {
                      id: "s3",
                      title: "3. Olukorra kulg / tööprotsessi etapid",
                      node: (activeCase.journeySteps || []).length
                        ? activeCase.journeySteps.map((step) => `- ${step.title || step.type}: ${step.description || step.notes || ""}`).join("\n")
                        : "Olukorra kulg vajab täpsustamist.",
                    },
                    {
                      id: "s4",
                      title: "4. Võrgustik ja osapooled",
                      node: (activeCase.parties || []).length
                        ? activeCase.parties.map((party) => `- ${party.label} (${party.involvementStatus || "seis täpsustamisel"})`).join("\n")
                        : "Osapooled sisestatakse rollidena, mitte nimedena.",
                    },
                    {
                      id: "s5",
                      title: "5. Riskid ja kaitsetegurid",
                      node: (activeCase.riskFactors || []).length
                        ? activeCase.riskFactors.map((factor) => `- ${factor.type === "protective" ? "Kaitsetegur" : "Risk"}: ${factor.label} (${factor.severity})`).join("\n")
                        : "Riskid ja kaitsetegurid puuduvad või vajavad lisamist.",
                    },
                    { id: "s6", title: "6. Kolleegide küsimused", node: <ContributionList messages={roomQuestions} locale={locale} emptyText="Küsimusi pole veel lisatud." onPromote={promoteContribution} onNextStep={convertContributionToNextStep} t={t} /> },
                    { id: "s7", title: "7. Peegeldused ja võimalikud seletused", node: <ContributionList messages={roomReflections} locale={locale} emptyText="Peegeldusi pole veel lisatud." onPromote={promoteContribution} onNextStep={convertContributionToNextStep} t={t} /> },
                    { id: "s8", title: "8. Ettepanekud", node: <ContributionList messages={roomSuggestions} locale={locale} emptyText="Ettepanekuid pole veel lisatud." onPromote={promoteContribution} onNextStep={convertContributionToNextStep} t={t} /> },
                    { id: "s9", title: "9. Järgmised sammud", node: <ContributionList messages={roomNextSteps} locale={locale} emptyText="Järgmine samm on eraldi objekt; ettepanekuid pole veel kinnitatud." onPromote={promoteContribution} onNextStep={convertContributionToNextStep} t={t} /> },
                    { id: "s10", title: "10. Lahtised küsimused", node: <ContributionList messages={roomOpenQuestions} locale={locale} emptyText="Lahtiseid küsimusi pole veel koondatud." onPromote={promoteContribution} onNextStep={convertContributionToNextStep} t={t} /> },
                    { id: "s11", title: "11. Kokkuvõte", node: summaryForm.content || "Kokkuvõte täidetakse käsitsi juhtumilõuendi ja tekstiliste sisendite põhjal. Heli ei kasutata." },
                  ]}
                />

                <SectionPanel title="Osalejad ja kutsed">
                  <div>
                    <div>
                      {(activeCase.participants || []).map((participant) => (
                        <span key={participant.id} >
                          {participant.user?.name || participant.email || participant.role} · {optionLabel(COVISION_PARTICIPANT_ROLES, participant.role)}
                        </span>
                      ))}
                    </div>
                    <div>
                      <CovisionInput value={participantEmail} onChange={(event) => setParticipantEmail(event.target.value)} placeholder="kolleeg@example.ee" type="email" />
                      <SelectField value={participantRole} onChange={setParticipantRole} ariaLabel="Osaleja roll" options={COVISION_PARTICIPANT_ROLES} />
                      <Button type="button" variant="primary" onClick={inviteParticipant} disabled={saving || !participantEmail.trim()} >{t("covision.room.invite_participant", "Kutsu osaleja")}</Button>
                    </div>
                    <p>{t("covision.room.invite_notice", "Kutsutav ei näe sisu enne autentimist ja õiguste kontrolli.")}</p>
                  </div>
                </SectionPanel>

                <SectionPanel title="Sõnasoovid">
                  <p>{t("covision.room.speaking_requests_help", "Sõnasoovide järjekord on heliriba detailides nähtav. Moderaator saab sõnasoovi lahendada ja osaleja saab selle tühistada.")}</p>
                </SectionPanel>

                <SectionPanel title={t("covision.room.written_discussion", "Kirjalik arutelu")}>
                  <div className="overflow-y-auto">
                    {(activeCase.messages || []).length ? activeCase.messages.map((message) => (
                      <article key={message.id} >
                        <div>
                          <span>{message.author?.name || message.author?.email || "Osaleja"} · {messageTypeLabel(message.messageType)}</span>
                          <span>{formatDate(message.createdAt, locale)}</span>
                        </div>
                        <p className="whitespace-pre-wrap">{message.body}</p>
                      </article>
                    )) : (
                      <p>{t("covision.room.discussion_empty", "Arutelu ei ole veel alanud.")}</p>
                    )}
                  </div>
                  <form onSubmit={sendMessage} >
                    <div>
                      <SelectField value={messageType} onChange={setMessageType} ariaLabel="Sisendi tüüp" options={COVISION_MESSAGE_TYPES} />
                      <SelectField value={messageSectionKey}
                        onChange={setMessageSectionKey}
                        ariaLabel="Seos juhtumilõuendi sektsiooniga"
                        options={[
                          { value: "questions", label: "Kolleegide küsimused" },
                          { value: "reflections", label: "Peegeldused" },
                          { value: "suggestions", label: "Ettepanekud" },
                          { value: "risks", label: "Riskid ja kaitsetegurid" },
                          { value: "next_steps", label: "Järgmised sammud" },
                          { value: "open_questions", label: "Lahtised küsimused" }
                        ]} />
                    </div>
                    <CovisionTextarea value={messageBody} onChange={(event) => setMessageBody(event.target.value)} rows={3} placeholder="Lisa küsimus, peegeldus, ettepanek, risk või järgmise sammu ettepanek." />
                    <div>
                      <Button type="submit" disabled={saving || !messageBody.trim()} >{t("covision.room.add_to_discussion", "Lisa arutelusse")}</Button>
                    </div>
                  </form>
                </SectionPanel>
              </div>

              <SectionPanel
                title="Teadmistebaasi taustainfo"
                aside={knowledgeSupport?.query ? (
                  <span>
                    {t("covision.knowledge.results_count", { count: knowledgeSupport.results?.length || 0 }, "{count} vastet")}
                  </span>
                ) : null}
              >
                <KnowledgeSupportPanel support={knowledgeSupport} t={t} />
              </SectionPanel>

              <SectionPanel title="Kovisiooni kokkuvõte"
                aside={<Button type="button" variant="primary" onClick={draftSummary} >{t("covision.room.draft_summary", "Koosta mustand")}</Button>}
              >
                <p>
                  {t("covision.room.summary_intro", "Kokkuvõte põhineb juhtumilõuendil ja tekstiliselt sisestatud arutelul. Kovisiooni heli ei salvestata, ei transkribeerita ja seda ei kasutata kokkuvõtte koostamiseks.")}
                </p>
                <div>
                  <SummaryField label="Peamised tähelepanekud" value={summaryForm.keyObservations} onChange={(value) => setSummaryForm((current) => ({ ...current, keyObservations: value }))} />
                  <SummaryField label="Kolleegide küsimused" value={summaryForm.questions} onChange={(value) => setSummaryForm((current) => ({ ...current, questions: value }))} />
                  <SummaryField label="Riskid, mis vajavad tähelepanu" value={summaryForm.risks} onChange={(value) => setSummaryForm((current) => ({ ...current, risks: value }))} />
                  <SummaryField label="Kaitsetegurid" value={summaryForm.protectiveFactors} onChange={(value) => setSummaryForm((current) => ({ ...current, protectiveFactors: value }))} />
                  <SummaryField label="Kinnitatud järgmised sammud" value={summaryForm.possibleNextSteps} onChange={(value) => setSummaryForm((current) => ({ ...current, possibleNextSteps: value }))} />
                  <SummaryField label="Lahtised küsimused" value={summaryForm.openQuestions} onChange={(value) => setSummaryForm((current) => ({ ...current, openQuestions: value }))} />
                </div>
                <div>
                  <Button type="button" onClick={saveSummary} disabled={saving} >{t("covision.room.save_summary", "Salvesta kokkuvõte")}</Button>
                </div>
              </SectionPanel>
            </div>
          ) : null}

          {view === "practice_form" ? (
            <form onSubmit={savePractice} >
              <SectionPanel title="Toimiv praktika">
                <div>
                  <Field label="Pealkiri">
                    <CovisionInput value={practiceForm.title} onChange={(event) => updatePracticeForm("title", event.target.value)} required />
                  </Field>
                  <Field label="Staatus">
                    <SelectField value={practiceForm.status} onChange={(value) => updatePracticeForm("status", value)} ariaLabel="Staatus" options={EFFECTIVE_PRACTICE_STATUSES} />
                  </Field>
                </div>
                <div>
                  <p>{t("covision.practice.topics_heading", "Teemad")}</p>
                  <MultiChoice options={COVISION_TOPICS} value={practiceForm.topics} onChange={(value) => updatePracticeForm("topics", value)} />
                </div>
                <Field label="Sildid">
                  <CovisionInput value={practiceForm.tagText} onChange={(event) => updatePracticeForm("tagText", event.target.value)} placeholder="eralda komaga" />
                </Field>
                <div>
                  <SummaryField label="Olukorra üldine taust" value={practiceForm.background} onChange={(value) => updatePracticeForm("background", value)} />
                  <SummaryField label="Peamine takistus" value={practiceForm.mainChallenge} onChange={(value) => updatePracticeForm("mainChallenge", value)} />
                  <SummaryField label="Mis aitas" value={practiceForm.whatHelped} onChange={(value) => updatePracticeForm("whatHelped", value)} />
                  <SummaryField label="Milline võrgustik või teenus oli oluline" value={practiceForm.networkOrServiceRole} onChange={(value) => updatePracticeForm("networkOrServiceRole", value)} />
                  <SummaryField label="Milline oli tulemus" value={practiceForm.outcome} onChange={(value) => updatePracticeForm("outcome", value)} />
                  <SummaryField label="Mida teine spetsialist saab õppida" value={practiceForm.learningPoints} onChange={(value) => updatePracticeForm("learningPoints", value)} />
                  <SummaryField label="Millal see lähenemine ei pruugi sobida" value={practiceForm.limitations} onChange={(value) => updatePracticeForm("limitations", value)} />
                  <SummaryField label="Seotud allikad või juhised" value={practiceForm.sources} onChange={(value) => updatePracticeForm("sources", value)} />
                </div>
                <p>{t("covision.practice.publish_notice", "Toimivat praktikat ei avaldata ilma anonüümsuse kontrolli ja ülevaatuseta.")}</p>
              </SectionPanel>
              <div>
                <Button type="button" variant="linkBrand" onClick={() => setView(activeCase ? "room" : "overview")}>{t("buttons.cancel", "Tühista")}</Button>
                <Button type="submit" disabled={saving || !practiceForm.title.trim()} >{saving ? t("covision.common.saving", "Salvestan...") : t("covision.practice.save", "Salvesta toimiv praktika")}</Button>
              </div>
            </form>
          ) : null}
    </div>
  );

  if (embedded) return content;

  return (
    <section lang={locale} data-covision-page>
      <div>
        {content}
      </div>
    </section>
  );
}
