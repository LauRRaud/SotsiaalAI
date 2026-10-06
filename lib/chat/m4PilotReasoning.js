// ADR-092: the composer's lightning button "Kiire vastus". The chat plan may offer the answer's reasoning effort as a
// choice; the button is lit for the lowest effort offered and unlit for the highest. Until the user chooses, the
// plan's own effort holds. The choice is remembered in this browser only.
// The key changed with the default (06.10.2026, medium -> low): a value kept under the old key, 'sotsiaal.chat.reasoning',
// was chosen against the other default and would hide the new one, so it is no longer read.
export const PILOT_REASONING_STORAGE_KEY = 'sotsiaal.chat.reasoning.2';

/** True when the plan offers two different efforts to choose between (`offer` is reasoningOffer of the plan). */
export const reasoningChoiceAvailable = offer => !!offer && typeof offer.quick === 'string' && typeof offer.thorough === 'string' && offer.quick !== offer.thorough;

/** The effort a chat starts with: the remembered choice when the plan still offers it, else the plan's own. */
export function initialReasoning(offer, saved = null) {
  if (!reasoningChoiceAvailable(offer)) return null;
  return saved === offer.quick || saved === offer.thorough ? saved : offer.fallback;
}

/** The other effort of the two. */
export function toggledReasoning(offer, current) {
  if (!reasoningChoiceAvailable(offer)) return null;
  return current === offer.thorough ? offer.quick : offer.thorough;
}

// `storage` is a function that returns the browser's storage: reading the property itself can throw where storage is
// blocked. Without storage (a private window) the choice lasts for this page.
export function readSavedReasoning(storage) {
  try { return storage().getItem(PILOT_REASONING_STORAGE_KEY); } catch { return null; }
}
export function saveReasoning(storage, effort) {
  try { storage().setItem(PILOT_REASONING_STORAGE_KEY, effort); } catch { /* not remembered */ }
}
