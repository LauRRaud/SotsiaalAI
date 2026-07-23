export default function ChatAiForwardToggle({
  t,
  isRoomMode,
  allowAssistantForward = true,
  sendToAssistant,
  setSendToAssistant,
  aiNote,
  className = ""
}) {
  // Ainult ruumis (mitte-ruumis läheb sõnum niikuinii assistendile) ja mitte
  // help-match ruumis (allowAssistantForward). EI sõltu enam fookusest —
  // püsiv kontroll → sisend ei tõuse enam fookusel (omanik 23.07).
  if (!isRoomMode || !allowAssistantForward) return null;

  // Sihi valimine EI varasta sisendi fookust (mousedown preventDefault).
  const keepInputFocus = e => e.preventDefault();

  return (
    <div
      className={`conv-send-target ${className}`.trim()}
      role="radiogroup"
      aria-label={t("chat.ai_toggle.aria")}
      aria-describedby="chat-ai-hint"
    >
      <button
        type="button"
        role="radio"
        aria-checked={!sendToAssistant}
        data-active={!sendToAssistant ? "true" : undefined}
        className="conv-send-target-seg"
        onMouseDown={keepInputFocus}
        onClick={() => setSendToAssistant(false)}
      >
        {t("chat.ai_toggle.room")}
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={sendToAssistant}
        data-active={sendToAssistant ? "true" : undefined}
        className="conv-send-target-seg"
        onMouseDown={keepInputFocus}
        onClick={() => setSendToAssistant(true)}
      >
        {t("chat.ai_toggle.room_plus_assistant")}
      </button>
      <span id="chat-ai-hint" className="sr-only">
        {aiNote}
      </span>
    </div>
  );
}
