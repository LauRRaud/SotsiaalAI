function pickFirst(raw) {
  if (!raw) return "";
  return String(raw).split(",")[0]?.trim() || "";
}

export function getRequestIp(headers) {
  if (!headers || typeof headers.get !== "function") return "unknown";
  return (
    pickFirst(headers.get("x-real-ip")) ||
    pickFirst(headers.get("x-forwarded-for")) ||
    pickFirst(headers.get("cf-connecting-ip")) ||
    pickFirst(headers.get("true-client-ip")) ||
    "unknown"
  );
}

export function getRequestIpFromRequest(request) {
  return getRequestIp(request?.headers);
}

/**
 * SOL-AUTH-09: IP, mida TOHIB turvaotsuses kasutada.
 *
 * `getRequestIp()` ülal võtab esimese väärtuse esimesest olemasolevast päisest — need on
 * kõik kliendi saadetavad ja seega turvapiiri jaoks kõlbmatud: piisab ühest lisapäisest,
 * et iga päring saaks uue bucket'i. Siin on kaks vahet:
 *
 *   1. **Ainult üks päis ja ainult konfiguratsioonist** (`TRUSTED_PROXY_IP_HEADER`). Ilma
 *      seadistuseta tagastab funktsioon `null` — fail-closed. `null` EI tähenda „luba kõik":
 *      kutsuja jätab siis IP-piiri vahele ja tugineb identiteedipõhisele piirile, mis on
 *      niikuinii see, mis brute-force'i vastu loeb.
 *   2. **Viimane väärtus, mitte esimene.** Usaldatud edge lisab kliendi IP loendi LÕPPU, seega
 *      viimane on see, mida edge ise nägi; esimene on täpselt see, mille klient ise kirjutas.
 *
 * Päis peab olema selline, mille edge ÜLE KIRJUTAB (nginx: `proxy_set_header X-Real-IP
 * $remote_addr`). Läbi lastud päis annaks sama nõrkuse tagasi.
 */
export function getTrustedRequestIp(headers) {
  const headerName = String(process.env.TRUSTED_PROXY_IP_HEADER || "").trim().toLowerCase();
  if (!headerName) return null;
  if (!headers || typeof headers.get !== "function") return null;

  const raw = String(headers.get(headerName) || "");
  const value = raw.split(",").pop()?.trim() || "";
  if (!value) return null;

  const isIpv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(value);
  const isIpv6 = /^[0-9a-f:]+$/i.test(value) && value.includes(":");
  return isIpv4 || isIpv6 ? value : null;
}

export function getTrustedRequestIpFromRequest(request) {
  return getTrustedRequestIp(request?.headers);
}
