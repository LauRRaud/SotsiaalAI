import { configuredOrigins } from "./jsonMutationRequest.js";

/**
 * Kas muutev päring tuli meie oma lehelt: brauseri `Origin` peab olema rakenduse enda aadress.
 *
 * `request.url` EI OLE päris serveris see aadress, mida brauser näeb. Rakendus käivitatakse
 * käsuga `next start --hostname 127.0.0.1 --port 3000` ja Next ehitab siis päringu aadressi
 * neist kahest (`https://127.0.0.1:3000/...`), mitte `Host` päisest. Ainult selle vastu võrreldes
 * keeldus kontroll päris serveris igast päringust, ka meie oma lehe omast (leitud 11.10.2026:
 * halduri esindusõiguse kinnitus vastas alati 403). Arenduses on mõlemad `localhost:3000`,
 * seepärast kohalik proov seda ei näinud.
 *
 * Lubatud on seega kaks aadressi: päringu enda oma (arendus) ja seadistatud avalik aadress
 * (`NEXTAUTH_URL` jt), sama reegel mis `validateJsonMutationRequest`-il. Päiseid `Host` ja
 * `X-Forwarded-Host` ei usaldata: need tulevad päringu saatjalt.
 */
export function isSameOriginRequest(request) {
  const origin = request?.headers?.get?.("origin");
  if (!origin) return false;

  try {
    const allowedOrigins = new Set([new URL(request.url).origin, ...configuredOrigins()]);
    return allowedOrigins.has(new URL(origin).origin);
  } catch {
    return false;
  }
}
