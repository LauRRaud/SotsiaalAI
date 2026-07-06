import { NextResponse } from "next/server";

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
  matcher: ["/(et|ru|en)", "/(et|ru|en)/:path*"]
};
