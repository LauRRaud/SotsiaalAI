import { serverT } from "../i18n/serverMessages.js";

export function documentWorkflowT(locale, key, values, fallback = "") {
  return serverT(locale, `chat.documentWorkflow.${key}`, values, fallback);
}

export function documentWorkflowLabel(locale, key, fallback = "") {
  return documentWorkflowT(locale, `labels.${key}`, undefined, fallback);
}
