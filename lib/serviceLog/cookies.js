/**
 * Küpsiseallikas PÄRINGU PÄISEST, mitte `req.cookies`-ist ega
 * `next/headers`-ist.
 *
 * `req.cookies` sõltub sellest, kas käsitleja saab `NextRequest`-i või
 * tavalise `Request`-i. `Cookie` päis on mõlemas keskkonnas olemas ja tähendab
 * sama asja. Vigane kodeering jääb tooreks väärtuseks, sest üks vigane küpsis
 * ei tohi kogu päringut katkestada.
 */
export function cookieSourceFromRequest(req) {
  const header = req?.headers?.get?.("cookie") || "";
  const jar = new Map();
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 1) continue;
    const name = part.slice(0, index).trim();
    if (!name) continue;

    const rawValue = part.slice(index + 1).trim();
    let value = rawValue;
    try {
      value = decodeURIComponent(rawValue);
    } catch {
      // A malformed cookie must not turn an authenticated API request into a 500.
    }
    jar.set(name, value);
  }
  return { get: (name) => (jar.has(name) ? { name, value: jar.get(name) } : undefined) };
}
