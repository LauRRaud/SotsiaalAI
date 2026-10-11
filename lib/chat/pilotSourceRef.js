// Vastuse allika pööre ja viide. Praeguse vestluse allika võti on „<pöörde tunnus>/<viide>" (pilotChatResult,
// m4PilotClientContract.js): sama kuju loeb sõnumimull viidete avamiseks. Allika veateade nimetab allika nende
// kahe järgi. Muu allikas (üles laaditud fail, vana süsteemi allikas) annab null.
const KEY_SHAPE = /^([\w:.-]{1,200})\/(S\d{1,4})$/;

export function pilotSourceRef(source) {
  const type = String(source?.sourceType || source?.source_type || "").trim();
  if (type !== "m4_pilot") return null;
  const match = KEY_SHAPE.exec(String(source?.key || source?.id || ""));
  return match ? { turnId: match[1], ref: match[2] } : null;
}
