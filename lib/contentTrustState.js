function normalizedText(value) {
  return String(value || "").replace(/\r\n/g, "\n").trim();
}

export function getContentTrustState({ generatedText, editedText, currentText, userConfirmed } = {}) {
  const generated = normalizedText(generatedText);
  const edited = normalizedText(editedText);
  const current = normalizedText(currentText || edited || generated);
  const storedVisible = edited || generated;
  const changedSinceStored = Boolean(current && storedVisible && current !== storedVisible);

  if (userConfirmed === true && current && !changedSinceStored && current === storedVisible) return "human_confirmed";
  if ((edited && edited !== generated) || changedSinceStored) return "human_edited";
  return "ai_draft";
}
