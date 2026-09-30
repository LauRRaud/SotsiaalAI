/* Servahelgi värvid tulevad teemast (tokens.css --specular-line /
   --specular-base): tumedas teemas valge helk, heledas tume. Tokenite
   heleda teema plokk kehtib alles tulede süttimisest, seega loeme
   arvutatud väärtuse, mitte html-i klassi.

   Loetakse jagatult ja harva (kuni kaks korda sekundis): iga SpecularButton
   renderdab igas kaadris ja getComputedStyle igas kaadris iga nupu kohta
   oleks mõttetu töö. Teemavahetus jõuab helgini poole sekundi jooksul. */
const FALLBACK = { line: "#ffffff", base: "#525252" };
const REFRESH_MS = 500;
let cached = FALLBACK;
let readAt = -Infinity;

export function specularThemeColors(now) {
  if (typeof document === "undefined") return FALLBACK;
  const time = typeof now === "number" ? now : performance.now();
  if (time - readAt < REFRESH_MS && time >= readAt) return cached;
  readAt = time;
  const style = getComputedStyle(document.documentElement);
  cached = {
    line: style.getPropertyValue("--specular-line").trim() || FALLBACK.line,
    base: style.getPropertyValue("--specular-base").trim() || FALLBACK.base,
  };
  return cached;
}
