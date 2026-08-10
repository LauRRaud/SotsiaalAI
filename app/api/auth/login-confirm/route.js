export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashOpaqueToken } from "@/lib/auth/pin-login";
import { normalizeServerLocale } from "@/lib/i18n/serverMessages";
import { safeError } from "@/lib/privacy/safeError";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache"
};

const COPY = {
  et: {
    okTitle: "Sisenemine kinnitatud",
    okBody: "Sisselogimine jätkus automaatselt aknas, kus sisestasid PIN-koodi. Võid selle akna sulgeda.",
    waitBody: "Avan SotsiaalAI …",
    invalidTitle: "Kinnituslink ei kehti",
    invalidBody: "Link on aegunud või juba kasutatud. Palun alusta sisselogimist uuesti.",
    openLabel: "Ava SotsiaalAI"
  },
  en: {
    okTitle: "Sign-in confirmed",
    okBody: "Sign-in continued automatically in the window where you entered your PIN. You can close this window.",
    waitBody: "Opening SotsiaalAI …",
    invalidTitle: "Confirmation link is invalid",
    invalidBody: "The link has expired or has already been used. Please start sign-in again.",
    openLabel: "Open SotsiaalAI"
  },
  ru: {
    okTitle: "Вход подтвержден",
    okBody: "Вход продолжился автоматически в окне, где вы ввели PIN-код. Это окно можно закрыть.",
    waitBody: "Открываю SotsiaalAI …",
    invalidTitle: "Ссылка подтверждения недействительна",
    invalidBody: "Ссылка устарела или уже использована. Начните вход заново.",
    openLabel: "Открыть SotsiaalAI"
  }
};

/* Isesuunamine: see leht oli tupik. Mobiilil avab e-kirja link uue saki
   (Gmail annab lingi Safarile ehk SAMASSE brauserisse), kasutaja luges
   teate ära ja pidi käsitsi veel „Ava SotsiaalAI" vajutama (omanik 28.07).
   Sessiooni ei tee see leht ise — küpsise paneb ESIMENE aken, kus PIN
   sisestati: seal käib `/api/auth/login-status` poll iga 2 s ja lõpetab
   sisselogimise ~2–4 s jooksul pärast lingi avamist. Seega ei tohi kohe
   `/` peale hüpata (satuks välja logitud avalehele) — leht ootab, kuni
   küpsis on päriselt olemas (`/api/auth/session` annab `user`), ja alles
   siis suunab. Nupp jääb alles kahe päris juhtumi jaoks: (1) JS väljas —
   ta on HTML-is nähtav ja skript peidab ta alles siis, kui ise tööle
   hakkab; (2) link avati TEISES brauseris või seadmes (PIN sülearvutis,
   kiri telefonis) — seal seda küpsist kunagi ei tule, seega pärast
   ooteakent tuleb tagasi vana teade koos nupuga.
   `location.replace`, mitte `href`: kinnituslink on ühekordne ja ei tohi
   tagasi-nupuga uuesti käiku minna.
   Kanalikuulamine (omanik 10.08): küpsis on brauseriülene, seega SAMAS
   brauseris said mõlemad aknad rakenduse ette — kaks akent sama asjaga.
   Kumbagi ei saa skriptiga sulgeda (mõlema avas kasutaja), nii et ainus
   viis ühe akna juurde jõuda on, et see leht ise ei liigu. PIN-i aken
   kuulutab OTP-sammu ajal `sotsiaalai-login` kanalis iga 0,5 s. Kanal on
   sama-päritolu ja sama-brauseri, seega kuulutuse KOHALEJÕUDMINE ongi
   tõend, et rakendus avaneb juba mujal — siis jääme siia „valmis" teate
   peale ja nupp jääb NÄHTAVALE, et mobiilis saaks ühe puutega ikkagi siin
   jätkata. Kuulutust ootame 1,2 s (aken kuulutab 0,5 s takti); kui seda ei
   tule — teine seade, teine brauser või aken kinni — käib kõik nagu enne. */
const REDIRECT_SCRIPT = `(function () {
  var msg = document.getElementById("lc-msg");
  var btn = document.getElementById("lc-open");
  if (!msg || !btn) return;
  var home = btn.getAttribute("href");
  var settled = msg.textContent;
  var deadline = Date.now() + 15000;
  var timer = null;
  var pinTabAlive = false;
  var channel = null;
  try { channel = new BroadcastChannel("sotsiaalai-login"); } catch (e) { channel = null; }
  function giveUp() {
    if (timer) clearTimeout(timer);
    msg.textContent = settled;
    btn.hidden = false;
    document.body.removeAttribute("data-waiting");
  }
  function again() {
    if (Date.now() >= deadline) { giveUp(); return; }
    timer = setTimeout(poll, 700);
  }
  function poll() {
    if (pinTabAlive) return;
    fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        if (pinTabAlive) return;
        if (data && data.user) { window.location.replace(home); return; }
        again();
      })
      .catch(again);
  }
  function startWaiting() {
    msg.textContent = msg.getAttribute("data-waiting") || settled;
    btn.hidden = true;
    document.body.setAttribute("data-waiting", "1");
    poll();
  }
  if (!channel) { startWaiting(); return; }
  channel.addEventListener("message", function (event) {
    if (!event || !event.data || event.data.type !== "login-pin-tab") return;
    pinTabAlive = true;
    giveUp();
    try { channel.close(); } catch (e) {}
  });
  setTimeout(function () { if (!pinTabAlive) startWaiting(); }, 1200);
})();`;

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Proxy taga on req.url origin localhost:3000 — avalik link peab minema
// x-forwarded-host/host origini pihta.
function resolvePublicOrigin(requestUrl, headers) {
  const fallback = new URL(requestUrl).origin;
  const forwardedHost = String(headers?.get?.("x-forwarded-host") || "").trim();
  const directHost = String(headers?.get?.("host") || "").trim();
  const forwardedProto = String(headers?.get?.("x-forwarded-proto") || "").trim();
  const resolvedHost = forwardedHost || directHost;
  if (!resolvedHost) return fallback;
  const protocol = forwardedProto || (fallback.startsWith("https://") ? "https" : "http");
  return `${protocol}://${resolvedHost}`;
}

function htmlResponse(locale, ok, homeUrl) {
  const copy = COPY[locale] || COPY.et;
  const title = ok ? copy.okTitle : copy.invalidTitle;
  const body = ok ? copy.okBody : copy.invalidBody;
  return new NextResponse(`<!doctype html>
<html lang="${escapeHtml(locale)}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root { color-scheme: dark; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
        font-family: "Segoe UI", Arial, sans-serif;
        background:
          radial-gradient(circle at 18% 14%, rgba(255,255,255,0.05), transparent 26%),
          radial-gradient(circle at 82% 84%, rgba(255,255,255,0.03), transparent 32%),
          linear-gradient(180deg, #0d0d0d 0%, #161616 100%);
        color: #e4e4e4;
      }
      main {
        width: min(100%, 31rem);
        border-radius: 2rem;
        padding: clamp(2rem, 4vw, 2.4rem);
        background: linear-gradient(180deg, rgba(34,34,34,0.66) 0%, rgba(23,23,23,0.78) 100%);
        border: 1px solid rgba(255,255,255,0.14);
        box-shadow:
          0 1.4rem 3.6rem rgba(0,0,0,0.5),
          inset 0 1px 0 rgba(255,255,255,0.10);
        backdrop-filter: blur(20px) saturate(118%);
        -webkit-backdrop-filter: blur(20px) saturate(118%);
        display: grid;
        justify-items: center;
        gap: 1.1rem;
        text-align: center;
      }
      h1 {
        margin: 0;
        font-size: clamp(1.8rem, 3vw, 2.2rem);
        line-height: 1.1;
        letter-spacing: 0.02em;
        color: #e6e6e6;
        font-weight: 400;
      }
      p {
        margin: 0;
        max-width: 24rem;
        font-size: 1.04rem;
        line-height: 1.56;
        color: ${ok ? "#c4c4c4" : "#e8a3a3"};
      }
      .button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 3.4rem;
        min-width: 11rem;
        padding: 0 1.7rem;
        margin-top: 0.4rem;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.30);
        text-decoration: none;
        background:
          radial-gradient(130% 130% at 18% 14%, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0) 58%),
          linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.05) 100%);
        color: #ececec;
        font-size: 1.1rem;
        font-weight: 500;
        letter-spacing: 0.02em;
        box-shadow:
          0 0.6rem 1.4rem rgba(0,0,0,0.35),
          inset 0 1px 0 rgba(255,255,255,0.22);
        transition: box-shadow 180ms ease, transform 180ms ease, filter 180ms ease;
      }
      .button:hover,
      .button:focus-visible {
        box-shadow:
          0 0.75rem 1.7rem rgba(0,0,0,0.45),
          inset 0 1px 0 rgba(255,255,255,0.30);
        outline: none;
        filter: brightness(1.12);
      }
      .button:active { transform: translateY(1px); }
      /* NB: see plokk elab JS-i malli-stringis — siia EI TOHI kirjutada
         tagurpidi ülakoma ega dollar-loogsulgu, muidu lõpeb string keset
         CSS-i. [hidden] üksi ei võida inline-flex'i: ilma selle reeglita
         jääks nupp ooteajaks nähtavale. */
      .button[hidden] { display: none; }
      /* Ootel olek vajab liikumist, muidu loeb „Avan …" kinnijooksmisena.
         Kolm punkti, mitte spinner: sama vaikne keel mis dokil. */
      .dots {
        display: none;
        gap: 0.42rem;
        margin-top: 0.5rem;
      }
      body[data-waiting] .dots { display: inline-flex; }
      .dots i {
        width: 0.42rem;
        height: 0.42rem;
        border-radius: 50%;
        background: rgba(236, 236, 236, 0.75);
        animation: lc-pulse 1.15s ease-in-out infinite;
      }
      .dots i:nth-child(2) { animation-delay: 0.18s; }
      .dots i:nth-child(3) { animation-delay: 0.36s; }
      @keyframes lc-pulse {
        0%, 100% { opacity: 0.28; transform: scale(0.86); }
        50% { opacity: 1; transform: scale(1); }
      }
      @media (prefers-reduced-motion: reduce) {
        .dots i { animation: none; opacity: 0.7; }
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(title)}</h1>
      <p id="lc-msg" aria-live="polite"${ok ? ` data-waiting="${escapeHtml(copy.waitBody)}"` : ""}>${escapeHtml(body)}</p>
      <a class="button" id="lc-open" href="${escapeHtml(homeUrl)}">${escapeHtml(copy.openLabel)}</a>
      ${ok ? '<span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>' : ""}
    </main>
    ${ok ? `<script>${REDIRECT_SCRIPT}</script>` : ""}
  </body>
</html>`, {
    status: ok ? 200 : 400,
    headers: {
      ...NO_STORE_HEADERS,
      "Content-Type": "text/html; charset=utf-8"
    }
  });
}

export async function GET(request) {
  const url = new URL(request.url);
  const token = String(url.searchParams.get("token") || "").trim();
  const locale = normalizeServerLocale(url.searchParams.get("locale")) || "et";
  const homeUrl = `${resolvePublicOrigin(request.url, request.headers)}/`;

  if (!token) return htmlResponse(locale, false, homeUrl);

  try {
    const now = new Date();
    const result = await prisma.loginTempToken.updateMany({
      where: {
        emailLinkTokenHash: hashOpaqueToken(token),
        requiresOtp: true,
        otpVerifiedAt: null,
        usedAt: null,
        expiresAt: {
          gt: now
        }
      },
      data: {
        otpVerifiedAt: now,
        emailLinkTokenHash: null
      }
    });

    return htmlResponse(locale, result.count > 0, homeUrl);
  } catch (error) {
    console.error("login-confirm error", safeError(error), { locale });
    return htmlResponse(locale, false, homeUrl);
  }
}
