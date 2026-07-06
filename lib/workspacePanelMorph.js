const WORKSPACE_PANEL_MORPH_STORAGE_KEY = "__SOTSIAALAI_WORKSPACE_PANEL_MORPH__";
export const WORKSPACE_PANEL_MORPH_MS = 360;
const WORKSPACE_PANEL_MORPH_MAX_AGE_MS = 30 * 60 * 1000;

export function resolveWorkspaceRestoreTransition(morphState, _options = {}) {
  return {
    suppressOpenTransition: true,
    returnMorphing: false,
    returnTransitioning: false
  };
}

function readWorkspacePanelMorph(maxAgeMs = WORKSPACE_PANEL_MORPH_MAX_AGE_MS) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(WORKSPACE_PANEL_MORPH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const ts = Number(parsed?.ts || 0);
    if (!Number.isFinite(ts) || Date.now() - ts > maxAgeMs) {
      window.sessionStorage.removeItem(WORKSPACE_PANEL_MORPH_STORAGE_KEY);
      return null;
    }
    return {
      direction: String(parsed?.direction || ""),
      targetPath: String(parsed?.targetPath || ""),
      ts
    };
  } catch {
    try {
      window.sessionStorage.removeItem(WORKSPACE_PANEL_MORPH_STORAGE_KEY);
    } catch {}
    return null;
  }
}

export function consumeWorkspacePanelMorph(maxAgeMs = WORKSPACE_PANEL_MORPH_MAX_AGE_MS) {
  const parsed = readWorkspacePanelMorph(maxAgeMs);
  if (!parsed) return null;
  try {
    window.sessionStorage.removeItem(WORKSPACE_PANEL_MORPH_STORAGE_KEY);
  } catch {}
  return parsed;
}
