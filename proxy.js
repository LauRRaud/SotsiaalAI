import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { REGISTRATION_OPEN } from "@/lib/publicRegistration";
import { isServiceLogEnabled } from "@/lib/serviceLog/flags";

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

export async function proxy(req) {
  const {
    pathname
  } = req.nextUrl;

  /* TEENUSPÄEVIK — väljas lipuga peab marsruut olema ERISTAMATU olematust
     marsruudist (leping, DoD 7). Lehe enda `notFound()` sellest EI PIISA:
     mõõdetud päris production-build'iga, `/teenuspaevik` andis staatuse 200 ja
     olematu marsruut 404 — sisu oli küll 404-leht, aga staatus reetis, et pind
     on olemas. Sama kehtib platvormi teiste `notFound()` lehtede kohta (nt
     `/org/<tundmatu>/audit` → samuti 200), seega põhjus ei ole selles failis,
     vaid selles, et juurpaigutus on juba voogedastatud enne kui `notFound()`
     jõuab mõjuda. Siin, keskvaras, on staatus veel muudetav.

     ÜMBERKIRJUTUS OLEMATULE TEELE, mitte `new NextResponse(null, {status:404})`:
     tühi keha oleks omaette sõrmejälg. Nii tuleb TÄPSELT seesama 404-leht, mille
     annab iga muu olematu marsruut. */
  if (pathname === "/teenuspaevik" && !isServiceLogEnabled()) {
    const gone = req.nextUrl.clone();
    gone.pathname = "/_puudub";
    gone.search = "";
    return NextResponse.rewrite(gone);
  }

  // Suletud seisus on /registreerimine ainult admin-eelvaade; avatuna avalik.
  if (pathname === "/registreerimine" && !REGISTRATION_OPEN) {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET
    });
    const admin =
      token?.isAdmin === true ||
      String(token?.role || "").toUpperCase() === "ADMIN";
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
export const config = {
  matcher: ["/registreerimine", "/teenuspaevik", "/(et|ru|en)", "/(et|ru|en)/:path*"]
};
