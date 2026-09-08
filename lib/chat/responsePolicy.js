import { createHash } from "node:crypto";
import { hasValidatedPublicationRecord, hasValidatedDirectedRelationPublicationRecord } from "./responsePolicyContract.js";
export { GROUP_CONTRACT_REASONS, DIRECTED_RELATION_CONTRACT_REASONS,
  projectGroupEvidenceLocators, projectDirectedRelationEvidenceLocators, projectResponseDecision } from "./responsePolicyContract.js";

export const responseTextHash = text => createHash("sha256").update(String(text || "").trim()).digest("hex");

export function hasValidatedDirectedRelationPublication(trace, reply = null) {
  return hasValidatedDirectedRelationPublicationRecord(trace) &&
    (reply === null || responseTextHash(reply) === trace.response_decision.validated_reply_hash);
}

export function hasValidatedPublication(trace, reply = null) {
  return hasValidatedPublicationRecord(trace) &&
    (reply === null || responseTextHash(reply) === trace.response_decision.validated_reply_hash);
}
