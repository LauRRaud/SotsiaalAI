/**
 * Sisselogimise järel tagasi lehele, kust inimene tuli.
 *
 * Leht, mis nõuab kontot, saadab sisselogimata inimese vestluse lehele
 * sisselogimisaknasse (`/vestlus?login=1`). Varem ei teadnud vestlus, kust
 * inimene tuli: pärast sisselogimist jäi ta vestlusesse ja pidi lehe (näiteks
 * kiireloomulise abipalve vormi) ise uuesti üles otsima. Nüüd kannab aadress
 * kaasa tee (`&next=/kiireloomuline-abi`) ja vestlus viib ta sinna tagasi.
 *
 * TURVALISUS. `next` tuleb aadressiribalt, seega võib selle kirjutada igaüks.
 * Lubatud on ainult selle saidi enda tee: algab ühe kaldkriipsuga, ei sisalda
 * teist saiti (`//evil.example`, `/\evil.example`, `https://…`) ega vii tagasi
 * sisselogimisaknasse (lõputu ring) ega API-le. Kõik muu annab tühja sõne ja
 * inimene jääb vestlusesse nagu enne.
 */
const LOCAL_ORIGIN = "http://local";

export function safeNextPath(raw, origin = LOCAL_ORIGIN) {
  const value = String(raw ?? "").trim();
  if (!value || value.length > 512) return "";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "";
  /* Juhtmärgid (reavahetus, tabulaator) eemaldab brauser aadressist vaikselt: nii saaks kahest kaldkriipsust teise saidi aadress. */
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 32 || code === 127) return "";
  }
  let url;
  let base;
  try {
    base = new URL(origin || LOCAL_ORIGIN);
    url = new URL(value, base);
  } catch {
    return "";
  }
  if (url.origin !== base.origin) return "";
  if (url.pathname.startsWith("/api/") || url.pathname === "/api") return "";
  if (url.pathname === "/vestlus" && url.searchParams.has("login")) return "";
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Sisselogimisakna aadress, mis toob inimese pärast sisselogimist antud teele tagasi. */
export function loginHref(next = "") {
  const path = safeNextPath(next);
  return path ? `/vestlus?login=1&next=${encodeURIComponent(path)}` : "/vestlus?login=1";
}
