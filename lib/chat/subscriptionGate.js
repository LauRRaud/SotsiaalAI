const FREE_HELP_CHAT_INTENTS = new Set([
  "create_help_request",
  "create_help_offer",
  "browse_help_requests",
  "browse_help_offers",
  "connect_to_offer",
  "connect_to_request"
]);

// T03 E3: ÜKS jagatud predikaat, mis otsustab nii tellimusevärava (tasuta ligipääs) kui ka
// selle, kas päring marsruutub abivahenduse töövoogu. Nii ei teki tasuta abi kaudu
// üldist RAG/LLM tagaust: tasuta ligipääs antakse AINULT siis, kui päring läheb selgelt
// määratud abivahenduse töövoogu (selge abirežiim, aktiivne või taasavatav vaba-abi olek).
export function isFreeHelpWorkflowEligible({
  roomId = null,
  forcedMode = null,
  explicitHelpIntent = null,
  detectedHelpIntent = null,
  helpWorkflowState = null,
  helpWorkflowActive = false
} = {}) {
  if (roomId) return false;
  // Dokumendivoog ega muu forcedMode ei ole tasuta abi.
  if (forcedMode === "document") return false;

  // Kasutaja valis selgelt abirežiimi (Abisoov / Abipakkumine).
  if (forcedMode === "help_request" || forcedMode === "help_offer") return true;
  if (FREE_HELP_CHAT_INTENTS.has(String(explicitHelpIntent || "").trim())) return true;

  // Aktiivne abi-töövoog vaba-abi kavatsusega jätkub.
  if (helpWorkflowActive && FREE_HELP_CHAT_INTENTS.has(String(helpWorkflowState?.intent || "").trim())) {
    return true;
  }

  // Mitteaktiivne, kuid taasavatav abi-olek, mille kasutaja tuvastatud vaba-abi kavatsusega
  // taasavab — ainult siis, kui puudub muu forcedMode (muidu marsruutija ei suunaks siia).
  if (
    !forcedMode &&
    helpWorkflowState &&
    !helpWorkflowActive &&
    FREE_HELP_CHAT_INTENTS.has(String(detectedHelpIntent || "").trim())
  ) {
    return true;
  }

  return false;
}

export function shouldAllowChatWithoutSubscription({
  roomId,
  requestedChatMode = null,
  explicitHelpIntent = null,
  detectedHelpIntent = null,
  helpWorkflowState = null,
  helpWorkflowActive = false
} = {}) {
  return isFreeHelpWorkflowEligible({
    roomId,
    forcedMode: requestedChatMode ?? null,
    explicitHelpIntent,
    detectedHelpIntent,
    helpWorkflowState,
    helpWorkflowActive
  });
}
