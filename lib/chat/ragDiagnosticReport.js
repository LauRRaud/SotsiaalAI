import { buildRagDiagnostics } from "./ragDiagnostics.js";
import { serverT } from "../i18n/serverMessages.js";
import { resolveRunStatusFromTurn } from "./turnStatus.js";
import { diagnosticExplanationRows } from "./ragDiagnosticExplanation.js";

export const DIAGNOSTIC_TURN_LIMIT = 1000;
const messageText = value => typeof value === "string" ? value : "";
const time = value => value instanceof Date ? value.toISOString() : value ? String(value) : null;

// Pair exclusively through ChatTurn. Neighbouring messages are not evidence of
// a pair (retries, interrupted streams and legacy messages can interleave).
export function buildDiagnosticReport({ conversationId, turns = [], messages = [], hasMore = false, now = new Date() }) {
  const byId = new Map(messages.map(message => [message.id, message]));
  const paired = new Set();
  const rows = turns.map(turn => {
    const question = byId.get(turn.userMessageId);
    const answer = byId.get(turn.assistantMessageId);
    const validQuestion = question?.role === "USER";
    const validAnswer = answer?.role === "ASSISTANT";
    if (validQuestion) paired.add(question.id);
    if (validAnswer) paired.add(answer.id);
    const metadata = validAnswer ? answer.metadata || {} : {};
    const effectiveStatus = resolveRunStatusFromTurn(turn, { nowMs: new Date(now).getTime() }) || "UNKNOWN";
    return {
      reference: validAnswer ? `message:${answer.id}` : `turn:${turn.id}`,
      turn_id: turn.id,
      question_message_id: validQuestion ? question.id : null,
      assistant_message_id: validAnswer ? answer.id : null,
      pairing: validQuestion && validAnswer ? "CHAT_TURN" : "INCOMPLETE_CHAT_TURN",
      question: validQuestion ? messageText(question.content) : null,
      answer: validAnswer ? messageText(answer.content) : null,
      started_at: time(turn.startedAt),
      ended_at: time(turn.endedAt),
      attempt: turn.attempt,
      recorded_status: turn.status,
      effective_status: effectiveStatus,
      status_derivation: turn.status === "RUNNING" && effectiveStatus === "ERROR" ? "lease_expired" : "recorded_status",
      diagnostics: buildRagDiagnostics({ trace: metadata.rag_trace, turnId: turn.id, userMessageId: validQuestion ? question.id : null, attempt: turn.attempt, completionStatus: effectiveStatus, runtime: metadata.rag_trace?.diagnostic_runtime })
    };
  });
  for (const message of messages) {
    if (paired.has(message.id) || !["USER", "ASSISTANT"].includes(message.role)) continue;
    // A retry can replace ChatTurn.assistantMessageId. The old message keeps
    // its immutable pairing snapshot; never pair legacy messages by proximity.
    const savedPair = message.role === "ASSISTANT" ? message.metadata?.rag_diagnostics?.pairing_evidence : null;
    const savedQuestion = savedPair?.user_message_id ? byId.get(savedPair.user_message_id) : null;
    const validSavedQuestion = savedQuestion?.role === "USER";
    rows.push({
      reference: `message:${message.id}`,
      turn_id: savedPair?.turn_id || null,
      question_message_id: message.role === "USER" ? message.id : validSavedQuestion ? savedQuestion.id : null,
      assistant_message_id: message.role === "ASSISTANT" ? message.id : null,
      pairing: validSavedQuestion ? "PERSISTED_ATTEMPT" : "UNPAIRED_LEGACY_MESSAGE",
      question: message.role === "USER" ? messageText(message.content) : validSavedQuestion ? messageText(savedQuestion.content) : null,
      answer: message.role === "ASSISTANT" ? messageText(message.content) : null,
      started_at: time(message.createdAt),
      ended_at: null,
      attempt: savedPair?.attempt || null,
      recorded_status: message.metadata?.completionStatus || "UNKNOWN",
      effective_status: message.metadata?.completionStatus || "UNKNOWN",
      status_derivation: "message_metadata",
      diagnostics: buildRagDiagnostics({ trace: message.metadata?.rag_trace, turnId: savedPair?.turn_id, userMessageId: validSavedQuestion ? savedQuestion.id : null, attempt: savedPair?.attempt, completionStatus: message.metadata?.completionStatus || "UNKNOWN", runtime: message.metadata?.rag_trace?.diagnostic_runtime })
    });
  }
  rows.sort((a, b) => String(a.started_at || "").localeCompare(String(b.started_at || "")) || String(a.turn_id || a.question_message_id || a.assistant_message_id).localeCompare(String(b.turn_id || b.question_message_id || b.assistant_message_id)));
  return {
    schema_version: "rag_diagnostic_report_v1",
    conversation_id: conversationId,
    generated_at: time(now),
    complete: !hasMore,
    limit: DIAGNOSTIC_TURN_LIMIT,
    source: "ChatTurn + ConversationMessage; no time-based pairing",
    automatic_correctness_grading: false,
    rows: rows.map((row, index) => ({ number: index + 1, ...row }))
  };
}

const labels = {
  et: { title: "RAG-i diagnostikaaruanne", warning: "Automaatkontroll ei hinda vastuse sisulist õigsust. BLOCKED näitab blokeerinud kontrolli, mitte tingimata algpõhjust. NOT_PROVEN tähendab, et tõend puudub. Aruanne uueneb vestluse salvestatud pöörete järgi; allalaaditud fail on ajahetke koopia.", partial: "OSALINE ARUANNE: mahupiir on täis, kõiki kirjeid ei kuvata.", question: "Küsimus", answer: "Vastus", missing: "Puudub / pole tõendatult paaristatud", control: "Automaatkontroll", correctness: "Sisuline õigsus", cause: "Esimene täheldatud tõrge", root: "Algpõhjuse tõendatus", trace: "Jälje tunnus", pairing: "Paaristus", stage: "Etapp", status: "Seis", reason: "Põhjuskood", details: "Piiratud diagnostikatõend" },
  en: { title: "RAG diagnostic report", warning: "Automated checks do not establish answer correctness. BLOCKED identifies a blocking check, not necessarily the root cause. NOT_PROVEN means evidence is missing. This report is derived from persisted conversation turns; a download is a point-in-time copy.", partial: "PARTIAL REPORT: the size limit was reached; some records are not shown.", question: "Question", answer: "Answer", missing: "Missing / no proven pairing", control: "Automated check", correctness: "Answer correctness", cause: "First observed failure", root: "Root cause evidence", trace: "Trace reference", pairing: "Pairing", stage: "Stage", status: "Status", reason: "Reason code", details: "Bounded diagnostic evidence" },
  ru: { title: "Диагностический отчёт RAG", warning: "Автоматические проверки не доказывают правильность ответа. BLOCKED указывает на блокирующую проверку, но не обязательно на первопричину. NOT_PROVEN означает отсутствие доказательств. Отчёт строится по сохранённым сообщениям; скачанный файл отражает состояние на момент загрузки.", partial: "НЕПОЛНЫЙ ОТЧЁТ: достигнут предел объёма; показаны не все записи.", question: "Вопрос", answer: "Ответ", missing: "Отсутствует / связь не доказана", control: "Автоматическая проверка", correctness: "Правильность ответа", cause: "Первый обнаруженный сбой", root: "Доказанность первопричины", trace: "Идентификатор трассировки", pairing: "Связь сообщений", stage: "Этап", status: "Состояние", reason: "Код причины", details: "Ограниченные диагностические данные" }
};

function fenced(value, language = "text") {
  const text = String(value ?? "");
  const longest = Math.max(2, ...(text.match(/`+/g) || []).map(run => run.length));
  const fence = "`".repeat(longest + 1);
  return `${fence}${language}\n${text}\n${fence}`;
}

export function diagnosticReportMarkdown(report, locale = "et") {
  const l = labels[locale] || labels.et;
  const lines = [`# ${l.title}`, "", l.warning, "", `UTC: ${report.generated_at}`, `Conversation: ${report.conversation_id}`, ""];
  if (!report.complete) lines.push(`**${l.partial}**`, "");
  for (const row of report.rows) {
    const d = row.diagnostics;
    const reasonExplanation = row.status_derivation === "lease_expired"
      ? serverT(locale, "chat.diagnostics.lease_expired")
      : d.first_observed_failure
        ? serverT(locale, `chat.diagnostics.reasons.${d.first_observed_failure.code}`, undefined, l.missing)
        : serverT(locale, "chat.diagnostics.no_failure");
    lines.push(`## ${row.number}. ${l.question}`, "", fenced(row.question ?? l.missing), "", `### ${l.answer}`, "", fenced(row.answer ?? l.missing), "", `- ${l.control}: ${d.technical_status}`, `- ${l.correctness}: ${d.answer_correctness}`, `- ${l.root}: ${d.root_cause_status}`, `- ${l.cause}: ${d.first_observed_failure?.id || "NOT_PROVEN"} / ${d.first_observed_failure?.code || "NOT_PROVEN"}`, `- ${l.trace}: ${d.trace_id || "NOT_PROVEN"}`, `- ${l.pairing}: ${row.pairing}`, `- UTC: ${row.started_at || "NOT_PROVEN"} → ${row.ended_at || "NOT_PROVEN"}`, "", `| ${l.stage} | ${l.status} | ${l.reason} |`, "|---|---|---|");
    for (const stage of d.stages) lines.push(`| ${stage.id} | ${stage.status} | ${stage.code} |`);
    lines.push("", `### ${serverT(locale, "chat.diagnostics.decision_title")}`, "", serverT(locale, "chat.diagnostics.decision_boundary"), "");
    for (const item of diagnosticExplanationRows(d, key => serverT(locale, `chat.diagnostics.${key}`))) lines.push(`- ${item.label}: ${item.value}`);
    lines.push("", reasonExplanation, "", `### ${l.details}`, "", fenced(JSON.stringify({ reference: row.reference, attempt: row.attempt, recorded_status: row.recorded_status, effective_status: row.effective_status, status_derivation: row.status_derivation, runtime: d.runtime, runtime_missing_fields: d.runtime_missing_fields, limitations: d.limitations, evidence: d.evidence }, null, 2), "json"), "");
  }
  return `${lines.join("\n")}\n`;
}
