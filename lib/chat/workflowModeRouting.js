// T03 E3: `freeHelpEligible` on jagatud tellimusevärava predikaadi tulem. See OR-itakse siia,
// nii et iga päring, mis saab tasuta ligipääsu, marsruutub KA abivahenduse töövoogu (mitte
// tavavestluse mudelikutsesse). Marsruutija võib tellijaid suunata rohkem (aktiivne olek jne),
// aga mitte kunagi vähem kui tasuta-abi predikaat.
export function shouldUseHelpWorkflowMode({
  userId,
  roomId,
  forcedMode = null,
  explicitHelpModeActive = false,
  helpWorkflowActive = false,
  inactiveHelpStateCanResume = false,
  freeHelpEligible = false
} = {}) {
  return Boolean(
    userId &&
    !roomId &&
    forcedMode !== "document" &&
    (
      helpWorkflowActive ||
      explicitHelpModeActive ||
      (!forcedMode && inactiveHelpStateCanResume) ||
      freeHelpEligible
    )
  );
}

