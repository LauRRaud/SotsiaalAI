export const ROOM_ORIGIN_TYPES = Object.freeze({
  MANUAL_INVITE: "MANUAL_INVITE",
  PRE_INQUIRY: "PRE_INQUIRY",
  HELP_MATCH: "HELP_MATCH",
  SERVICE_PROVIDER_INQUIRY: "SERVICE_PROVIDER_INQUIRY",
  JOURNEY: "JOURNEY",
  UNKNOWN: "UNKNOWN"
});

const VALID_ROOM_ORIGIN_TYPES = new Set(Object.values(ROOM_ORIGIN_TYPES));

const ORIGIN_LABELS = Object.freeze({
  [ROOM_ORIGIN_TYPES.MANUAL_INVITE]: "Käsitsi kutse",
  [ROOM_ORIGIN_TYPES.PRE_INQUIRY]: "Eelpöördumine",
  [ROOM_ORIGIN_TYPES.HELP_MATCH]: "Abisoovi ja abipakkumise sobitus",
  [ROOM_ORIGIN_TYPES.SERVICE_PROVIDER_INQUIRY]: "Teenusega seotud pöördumine",
  [ROOM_ORIGIN_TYPES.JOURNEY]: "Teekond",
  [ROOM_ORIGIN_TYPES.UNKNOWN]: "Päritolu pole määratud"
});

function cleanText(value, limit = 240) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function normalizeRoomOriginType(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return VALID_ROOM_ORIGIN_TYPES.has(normalized) ? normalized : ROOM_ORIGIN_TYPES.UNKNOWN;
}

export function buildRoomOrigin({
  originType = ROOM_ORIGIN_TYPES.UNKNOWN,
  originId = "",
  originLabel = "",
  originMeta = null
} = {}) {
  const type = normalizeRoomOriginType(originType);
  return {
    originType: type,
    originId: cleanText(originId, 120) || null,
    originLabel: cleanText(originLabel, 180) || ORIGIN_LABELS[type] || ORIGIN_LABELS.UNKNOWN,
    originMeta: originMeta && typeof originMeta === "object" && !Array.isArray(originMeta)
      ? originMeta
      : null
  };
}

export function serializeRoomOrigin(room = {}) {
  const type = normalizeRoomOriginType(room?.originType);
  const label = cleanText(room?.originLabel, 180) || ORIGIN_LABELS[type] || ORIGIN_LABELS.UNKNOWN;
  const meta = room?.originMeta && typeof room.originMeta === "object" && !Array.isArray(room.originMeta)
    ? room.originMeta
    : null;
  return {
    type,
    id: cleanText(room?.originId, 120),
    label,
    meta
  };
}
