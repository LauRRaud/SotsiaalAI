import { serverT } from "../i18n/serverMessages.js";

export function helpWorkflowT(locale, key, values, fallback = "") {
  return serverT(locale, `chat.helpWorkflow.${key}`, values, fallback);
}

export function helpWorkflowLabel(locale, key, fallback = "") {
  return helpWorkflowT(locale, `labels.${key}`, undefined, fallback);
}
