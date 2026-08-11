export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  confirmLoginEmailLink,
  describeLoginEmailConfirmation
} from "@/lib/auth/login-email-link";
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
    handoffBody: "Mine tagasi aknasse, kus sisselogimist alustasid — seal oled juba sees. Selle akna võid sulgeda.",
    invalidTitle: "Kinnituslink ei kehti",
    invalidBody: "Link on aegunud või juba kasutatud. Palun alusta sisselogimist uuesti.",
    openLabel: "Ava SotsiaalAI",
    confirmTitle: "Kinnita sisselogimine",
    confirmBody:
      "Keegi sisestas sinu PIN-koodi ja ootab kinnitust. Kui see olid sina, vajuta nuppu. Kui ei olnud, sulge see aken ja vaheta PIN — kinnitamata jääb sisselogimine pooleli.",
    confirmAction: "Jah, see olin mina",
    deviceLabel: "Seade",
    timeLabel: "Alustatud",
    ipLabel: "IP-aadress"
  },
  en: {
    okTitle: "Sign-in confirmed",
    okBody: "Sign-in continued automatically in the window where you entered your PIN. You can close this window.",
    waitBody: "Opening SotsiaalAI …",
    handoffBody: "Go back to the window where you started signing in — you are already signed in there. You can close this window.",
    invalidTitle: "Confirmation link is invalid",
    invalidBody: "The link has expired or has already been used. Please start sign-in again.",
    openLabel: "Open SotsiaalAI",
    confirmTitle: "Confirm sign-in",
    confirmBody:
      "Someone entered your PIN and is waiting for confirmation. If that was you, press the button. If it was not, close this window and change your PIN — without confirmation the sign-in cannot continue.",
    confirmAction: "Yes, this was me",
    deviceLabel: "Device",
    timeLabel: "Started",
    ipLabel: "IP address"
  },
  ru: {
    okTitle: "Вход подтвержден",
    okBody: "Вход продолжился автоматически в окне, где вы ввели PIN-код. Это окно можно закрыть.",
    waitBody: "Открываю SotsiaalAI …",
    handoffBody: "Вернитесь в окно, где вы начали вход, — вы уже вошли там. Это окно можно закрыть.",
    invalidTitle: "Ссылка подтверждения недействительна",
    invalidBody: "Ссылка устарела или уже использована. Начните вход заново.",
    openLabel: "Открыть SotsiaalAI",
    confirmTitle: "Подтвердите вход",
    confirmBody:
      "Кто-то ввел ваш PIN-код и ожидает подтверждения. Если это были вы, нажмите кнопку. Если нет — закройте это окно и смените PIN: без подтверждения вход не продолжится.",
    confirmAction: "Да, это был я",
    deviceLabel: "Устройство",
    timeLabel: "Начато",
    ipLabel: "IP-адрес"
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
   tõend, et rakendus avaneb juba mujal — siis jääme siia paigale JA nupp
   KAOB (omanik 10.08): teine aken on juba sees, siin nupu vajutamine annaks
   ainult teise samasuguse akna. Tekst saadab kasutaja tagasi sinna, kus ta
   sisselogimist alustas. Kuulutust ootame 1,2 s (aken kuulutab 0,5 s takti);
   kui seda ei tule — teine seade, teine brauser või aken kinni — käib kõik
   nagu enne ja nupp jääb alles, sest siis on ta ainus tee edasi. */
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
  function handOff() {
    if (timer) clearTimeout(timer);
    msg.textContent = msg.getAttribute("data-handoff") || settled;
    btn.hidden = true;
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
    handOff();
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

function htmlResponse(locale, variant, homeUrl, { token = "", attempt = null } = {}) {
  const copy = COPY[locale] || COPY.et;
  const ok = variant === "ok";
  const confirming = variant === "confirm";
  const title = confirming ? copy.confirmTitle : ok ? copy.okTitle : copy.invalidTitle;
  const body = confirming ? copy.confirmBody : ok ? copy.okBody : copy.invalidBody;
  // Kontekst on siin turvamehhanismi tuum, mitte kaunistus: PIN-sisselogimist
  // alustab ründaja OMA brauseris ja kirja saab konto omanik — ainus, mis teda
  // aitab, on näha võõrast seadet ENNE nupuvajutust.
  const facts =
    confirming && attempt
      ? [
          [copy.deviceLabel, attempt.device],
          [copy.timeLabel, attempt.startedAt],
          [copy.ipLabel, attempt.ipAddress]
        ]
          .map(
            ([label, value]) =>
              `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`
          )
          .join("")
      : "";
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
        color: ${variant === "invalid" ? "#e8a3a3" : "#c4c4c4"};
      }
      /* Katse kirjeldus kinnituslehel. Sildid ja väärtused kõrvuti, et võõras
         seade jääks silma enne, kui käsi nupuni jõuab. */
      .facts {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 0.35rem 0.9rem;
        margin: 0;
        width: 100%;
        max-width: 24rem;
        font-size: 0.96rem;
        text-align: left;
      }
      .facts dt { color: #9a9a9a; }
      .facts dd { margin: 0; color: #dcdcdc; word-break: break-word; }
      form { margin: 0; display: contents; }
      /* NB: see plokk elab JS-i malli-stringis — siia EI TOHI kirjutada
         tagurpidi ülakoma ega dollar-loogsulgu (sama hoiatus mis allpool
         [hidden]-reegli juures; kirjutasin ta 10.08 ise üle ja leht andis
         500 kuni parandamiseni).
         Nupp oli siin oma retseptiga: kaks gradienti, 0.30 serv, raske must
         vari ja hoveril brightness(1.12). Platvormi primitiiv (glass.css
         button[data-variant]) on hoopis ÜHEVÄRVILINE 10% valge veel
         klaasil, background-image: none, kaks õhukest inset-helki — ja
         HOVERIT EI OLE ÜLDSE (omanik 01.08 "ilma hoverita"; tagasiside
         annab specular-helk, mida siin ei ole). Väärtused on käsitsi sisse
         kirjutatud, sest see leht on eraldiseisev HTML ilma rakenduse
         tokeniteta: kui --input-* muutub, tuleb see plokk käsitsi järele
         viia. Erineb teadlikult kahes kohas: suurus on lehe-CTA oma (mitte
         14px) ja kiri on süsteemifont, sest Exo 2 laadib next/font. */
      .button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.5em;
        min-height: 3.1rem;
        min-width: 11rem;
        padding: 0 1.6rem;
        margin-top: 0.4rem;
        border-radius: 999px;
        text-decoration: none;
        color: #f1f1f1;
        font-size: 1rem;
        font-weight: 560;
        letter-spacing: 0.04em;
        /* Kinnitusleht kasutab sama klassi <button>-il: font ja kursor ei päri. */
        font-family: inherit;
        cursor: pointer;
        appearance: none;
        -webkit-appearance: none;
        background-color: rgba(255, 255, 255, 0.10);
        background-image: none;
        -webkit-backdrop-filter: blur(32px);
        backdrop-filter: blur(32px);
        border: 1px solid rgba(255, 255, 255, 0.18);
        box-shadow:
          inset 0 1px 1px rgba(255, 255, 255, 0.26),
          inset 0 -1px 1px rgba(255, 255, 255, 0.05),
          0 8px 24px rgba(0, 0, 0, 0.08);
        transition:
          background-color 240ms cubic-bezier(0.22, 0.61, 0.36, 1),
          box-shadow 240ms cubic-bezier(0.22, 0.61, 0.36, 1),
          scale 160ms cubic-bezier(0.22, 0.61, 0.36, 1);
      }
      .button:focus-visible {
        outline: none;
        box-shadow:
          0 0 0 2px rgba(13, 13, 13, 0.9),
          0 0 0 4.5px rgba(242, 242, 242, 0.95);
      }
      .button:active {
        background-color: rgba(0, 0, 0, 0.14);
        scale: 0.975;
        box-shadow:
          inset 0 1.5px 4px rgba(0, 0, 0, 0.22),
          inset 0 -1px 1px rgba(255, 255, 255, 0.08),
          0 3px 12px rgba(0, 0, 0, 0.22);
      }
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
      <p id="lc-msg" aria-live="polite"${ok ? ` data-waiting="${escapeHtml(copy.waitBody)}" data-handoff="${escapeHtml(copy.handoffBody)}"` : ""}>${escapeHtml(body)}</p>
      ${facts ? `<dl class="facts">${facts}</dl>` : ""}
      ${
        confirming
          ? `<form method="POST" action="/api/auth/login-confirm"><input type="hidden" name="token" value="${escapeHtml(
              token
            )}" /><input type="hidden" name="locale" value="${escapeHtml(
              locale
            )}" /><button class="button" type="submit">${escapeHtml(copy.confirmAction)}</button></form>`
          : `<a class="button" id="lc-open" href="${escapeHtml(homeUrl)}">${escapeHtml(copy.openLabel)}</a>`
      }
      ${ok ? '<span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>' : ""}
    </main>
    ${ok ? `<script>${REDIRECT_SCRIPT}</script>` : ""}
  </body>
</html>`, {
    status: variant === "invalid" ? 400 : 200,
    headers: {
      ...NO_STORE_HEADERS,
      "Content-Type": "text/html; charset=utf-8"
    }
  });
}

/**
 * GET EI KINNITA MIDAGI — ta ainult kirjeldab katset ja pakub nuppu.
 *
 * Varem kinnitas lingi pelk AVAMINE teise faktori: postkasti turvaskanner,
 * lingieelvaade või automaatne URL-kontroll tegi seda konto omaniku eest, seega
 * PIN-i teadnud ründaja sai oma brauseris sessiooni ilma ühegi inimese otsuseta
 * (SOL-AUTH-08). Sama muster on kõrval juba kaks korda — `verify-email` ja
 * e-posti vahetuse kinnitus — ja siin on ta rangem: auto-submit'i EI OLE, sest
 * skanner ei ole ainus oht. Ohver ise võib lingi uudishimust avada ja peab siis
 * nägema, KELLE katset ta kinnitab.
 */
export async function GET(request) {
  const url = new URL(request.url);
  const token = String(url.searchParams.get("token") || "").trim();
  const locale = normalizeServerLocale(url.searchParams.get("locale")) || "et";
  const homeUrl = `${resolvePublicOrigin(request.url, request.headers)}/`;

  if (!token) return htmlResponse(locale, "invalid", homeUrl);

  try {
    const described = await describeLoginEmailConfirmation({ db: prisma, token, locale });
    if (!described.ok) return htmlResponse(locale, "invalid", homeUrl);

    return htmlResponse(locale, "confirm", homeUrl, {
      token,
      attempt: described.attempt
    });
  } catch (error) {
    console.error("login-confirm page error", safeError(error), { locale });
    return htmlResponse(locale, "invalid", homeUrl);
  }
}

/** Kinnitus ise. Siia jõuab ainult päris brauseri teadlik nupuvajutus. */
export async function POST(request) {
  const contentType = String(request.headers.get("content-type") || "");
  let fields = {};
  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const form = await request.formData().catch(() => null);
    if (form) fields = Object.fromEntries(form.entries());
  } else {
    fields = await request.json().catch(() => ({}));
  }

  const token = String(fields?.token || "").trim();
  const locale = normalizeServerLocale(fields?.locale) || "et";
  const homeUrl = `${resolvePublicOrigin(request.url, request.headers)}/`;

  if (!token) return htmlResponse(locale, "invalid", homeUrl);

  try {
    const result = await confirmLoginEmailLink({ db: prisma, token });
    return htmlResponse(locale, result.ok ? "ok" : "invalid", homeUrl);
  } catch (error) {
    console.error("login-confirm error", safeError(error), { locale });
    return htmlResponse(locale, "invalid", homeUrl);
  }
}
