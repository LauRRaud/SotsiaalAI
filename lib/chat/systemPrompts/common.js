const SYSTEM_PROMPT_ROLE_KEYS = ["CLIENT", "SOCIAL_WORKER", "DEFAULT"];

export function renderSystemPrompt(definition, {
  effectiveRole,
  isCrisis = false,
  replyLang = "et",
  dateContext = ""
} = {}) {
  const roleKey = SYSTEM_PROMPT_ROLE_KEYS.includes(effectiveRole)
    ? effectiveRole
    : "DEFAULT";
  const base = typeof definition?.base === "function"
    ? definition.base({ isCrisis, replyLang, dateContext })
    : [];
  const role = definition?.roles?.[roleKey] || definition?.roles?.DEFAULT || [];

  return [
    ...base,
    "",
    ...role
  ]
    .map(line => String(line || "").trim())
    .filter((line, index, lines) => line || lines[index - 1])
    .join("\n")
    .trim();
}

export function renderExtraSystemInstruction(definition, key, args = {}) {
  const item = definition?.extra?.[key];
  const lines = typeof item === "function" ? item(args) : item;
  if (!Array.isArray(lines)) return "";
  return lines
    .map(line => String(line || "").trim())
    .filter(Boolean)
    .join(" ");
}
