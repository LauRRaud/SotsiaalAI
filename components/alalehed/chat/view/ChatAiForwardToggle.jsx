export default function ChatAiForwardToggle({
  t,
  focusActive,
  isRoomMode,
  allowAssistantForward = true,
  sendToAssistant,
  setSendToAssistant,
  aiNote,
  className = ""
}) {
  if (!isRoomMode || !focusActive || !allowAssistantForward) return null;

  return <div className={className}>
    <label>
      <input type="checkbox" checked={sendToAssistant} onChange={e => setSendToAssistant(e.target.checked)} aria-describedby="chat-ai-hint" />
      <span>
        {t("chat.ai_toggle.label")}
      </span>
    </label>
    <span id="chat-ai-hint" className="sr-only">
      {aiNote}
    </span>
  </div>;
}
