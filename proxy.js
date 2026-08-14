import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { REGISTRATION_OPEN } from "@/lib/publicRegistration";
import { isCaseWorkEnabled } from "@/lib/casework/flags";
import { isServiceLogEnabled } from "@/lib/serviceLog/flags";
import { prisma } from "@/lib/prisma";
import { authorizeCurrentAdminToken } from "@/lib/auth/jwtAuthorization";

function isLocalHostname(hostname = "") {
  const h = String(hostname).toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "[::1]";
}

function resolvePublicOrigin() {
  const candidates = [
    process.env.PUBLIC_ORIGIN,
    process.env.APP_BASE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXTAUTH_URL,
    process.env.SITE_URL,
    "https://sotsiaal.ai"
  ];
  for (const raw of candidates) {
    if (!raw) continue;
    try {
      const u = new URL(String(raw));
      if (isLocalHostname(u.hostname)) continue;
      return `${u.protocol}//${u.host}`;
    } catch {}
  }
  return "https://sotsiaal.ai";
}

const PUBLIC_ORIGIN = resolvePublicOrigin();

/**
 * Teed, mille lehe enda `notFound()` EI TOHI olla ainus 404-allikas.
 *
 * `matcher` allpool peab sisaldama täpselt neidsamu teid — matcher'ist välja
 * jäänud tee ei jõua siia funktsiooni üldse ja ümberkirjutus jääks vaikselt
 * tegemata (SOL-CW-02 juur: juhtumitöö lehed kasutasid sama `notFound()`
 * mustrit, aga matcher neid ei katnud).
 */
export const FLAGGED_PAGE_REWRITES = [
  { pathname: "/teenuspaevik", isEnabled: isServiceLogEnabled },
  { pathname: "/juhtumid", isEnabled: isCaseWorkEnabled },
  { pathname: "/toolaud/juhtumitoo", isEnabled: isCaseWorkEnabled }
];

/** Olematu tee, mille peale suletud pind kirjutatakse. */
const MISSING_ROUTE_PATHNAME = "/_puudub";

export async function proxy(req) {
  const {
    pathname
  } = req.nextUrl;

  /* LIPU TAGA OLEVAD LEHED (Teenuspäevik, juhtumitöö) — väljas lipuga peab
     marsruut olema ERISTAMATU olematust marsruudist (Teenuspäeviku leping
     DoD 7, juhtumitöö leping L19). Lehe enda `notFound()` sellest EI PIISA:
     mõõdetud päris production-build'iga, `/teenuspaevik` andis staatuse 200 ja
     olematu marsruut 404 — sisu oli küll 404-leht, aga staatus reetis, et pind
     on olemas. Sama kehtib platvormi teiste `notFound()` lehtede kohta (nt
     `/org/<tundmatu>/audit` → samuti 200), seega põhjus ei ole selles failis,
     vaid selles, et juurpaigutus on juba voogedastatud enne kui `notFound()`
     jõuab mõjuda. Siin, keskvaras, on staatus veel muudetav.

     ÜMBERKIRJUTUS OLEMATULE TEELE, mitte `new NextResponse(null, {status:404})`:
     tühi keha oleks omaette sõrmejälg. Nii tuleb TÄPSELT seesama 404-leht, mille
     annab iga muu olematu marsruut. */
  const flaggedPage = FLAGGED_PAGE_REWRITES.find(entry => entry.pathname === pathname);
  if (flaggedPage && !flaggedPage.isEnabled()) {
    const gone = req.nextUrl.clone();
    gone.pathname = MISSING_ROUTE_PATHNAME;
    gone.search = "";
    return NextResponse.rewrite(gone);
  }

  // Suletud seisus on /registreerimine ainult admin-eelvaade; avatuna avalik.
  if (pathname === "/registreerimine" && !REGISTRATION_OPEN) {
    const token = await getToken({
      req,
      secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
    });
    const admin = await authorizeCurrentAdminToken(token, {
      db: prisma,
      sessionMaxAgeSeconds:
        process.env.NEXTAUTH_SESSION_MAX_AGE_SECONDS ||
        process.env.AUTH_SESSION_MAX_AGE_SECONDS
    });
    if (!admin) {
      const destination = req.nextUrl.clone();
      destination.pathname = "/";
      destination.search = "";
      return NextResponse.redirect(destination, 307);
    }
  }

  const m = pathname.match(/^\/(et|ru|en)(\/.*)?$/);
  if (m) {
    const locale = m[1];
    const rest = m[2] || "/";
    const search = req.nextUrl.search || "";
    const dest = new URL(`${rest}${search}`, PUBLIC_ORIGIN);
    const res = NextResponse.redirect(dest, 308);
    res.cookies.set("NEXT_LOCALE", locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax"
    });
    return res;
  }
  return NextResponse.next();
}
/* MATCHER PEAB KATMA IGA `FLAGGED_PAGE_REWRITES` TEE. Matcher on staatiline
   massiiv (Next loeb ta build'i ajal), seega teda ei saa ülalt tuletada —
   `tests/casework/closedSurface.test.js` hoiab need kaks nimekirja sünkroonis. */
export const config = {
  matcher: [
    "/registreerimine",
    "/teenuspaevik",
    "/juhtumid",
    "/toolaud/juhtumitoo",
    "/(et|ru|en)",
    "/(et|ru|en)/:path*"
  ]
};
