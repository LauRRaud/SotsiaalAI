import { localizePath } from "./localizePath.js";

export function buildRoomChatPath(roomId, locale, options = {}) {
  const normalizedRoomId = String(roomId || "").trim();
  if (!normalizedRoomId) {
    return localizePath("/vestlus", locale);
  }

  const params = new URLSearchParams();
  params.set("roomId", normalizedRoomId);
  if (options?.isHelpMatchRoom === true) {
    params.set("roomKind", "help-match");
  }

  const basePath = `/vestlus?${params.toString()}`;
  return localizePath(basePath, locale);
}
