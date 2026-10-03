export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  PENDING_LOGIN_COOKIE_NAME,
  clearedPendingLoginCookie,
  confirmLoginEmailLink,
  describeLoginEmailConfirmation
} from "@/lib/auth/login-email-link";
import { AUTO_CONFIRM_SCRIPT, SIGN_IN_SCRIPT } from "@/lib/auth/loginConfirmScripts";
import { normalizeServerLocale } from "@/lib/i18n/serverMessages";
import { safeError } from "@/lib/privacy/safeError";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache"
};

/* Lehe kujud:
   - `confirm`: link avati VÕÕRAS brauseris või seadmes (või skanner). Näitame
     katse kirjeldust ja nuppu. Kinnitab alles POST.
   - `confirm` + autoSubmit: link avati samas brauseris, kus PIN sisestati.
     Sama leht vajutab nuppu ise, nii et inimene näeb ainult „Sisenen“.
   - `signin`: kinnitus on tehtud samas brauseris ja leht lõpetab sisselogimise
     ise (omanik 28.09: e-kirja nupp viib otse sisse). Varem ootas leht 15 s,
     kuni PIN-aken seda teeb, ja saatis inimese siis seda akent otsima.
     Mobiilis PIN-aken taustal magab, seega see ootamine ei lõppenud kunagi.
   - `ok`: kinnitus on tehtud teises brauseris või seadmes. Siin brauseris
     sessiooni teha ei saa (see oleks postkasti omanikule sisselogimine ilma
     PIN-ita), seega on see lõppteade ilma ootamise ja nuputa. Endine „Ava
     Sotsiaal.pro“ viis siin väljalogitud avalehele. */
const COPY = {
  et: {
    okTitle: "Sisenemine kinnitatud",
    okBody: "Sisselogimine jätkub aknas, kus sisestasid PIN-koodi. Selle akna võid sulgeda.",
    waitBody: "Avan Sotsiaal.pro …",
    signinFallbackTitle: "Sisselogimine ei õnnestunud",
    signinFallbackBody:
      "Kinnitus on antud, aga siin aknas sisse logida ei saanud. Mine tagasi aknasse, kus sisestasid PIN-koodi — sisselogimine lõpeb seal.",
    invalidTitle: "Kinnituslink ei kehti",
    invalidBody: "Link on aegunud või juba kasutatud. Palun alusta sisselogimist uuesti.",
    openLabel: "Ava Sotsiaal.pro",
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
    okBody: "Sign-in continues in the window where you entered your PIN. You can close this window.",
    waitBody: "Opening Sotsiaal.pro …",
    signinFallbackTitle: "Sign-in did not finish",
    signinFallbackBody:
      "Confirmation received, but signing in failed in this window. Return to the window where you entered your PIN — sign-in finishes there.",
    invalidTitle: "Confirmation link is invalid",
    invalidBody: "The link has expired or has already been used. Please start sign-in again.",
    openLabel: "Open Sotsiaal.pro",
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
    okBody: "Вход продолжится в окне, где вы ввели PIN-код. Это окно можно закрыть.",
    waitBody: "Открываю Sotsiaal.pro …",
    signinFallbackTitle: "Вход не завершён",
    signinFallbackBody:
      "Подтверждение получено, но войти в этом окне не удалось. Вернитесь в окно, где вы ввели PIN-код, — вход завершится там.",
    invalidTitle: "Ссылка подтверждения недействительна",
    invalidBody: "Ссылка устарела или уже использована. Начните вход заново.",
    openLabel: "Открыть Sotsiaal.pro",
    confirmTitle: "Подтвердите вход",
    confirmBody:
      "Кто-то ввел ваш PIN-код и ожидает подтверждения. Если это были вы, нажмите кнопку. Если нет — закройте это окно и смените PIN: без подтверждения вход не продолжится.",
    confirmAction: "Да, это был я",
    deviceLabel: "Устройство",
    timeLabel: "Начато",
    ipLabel: "IP-адрес"
  }
};

function readPendingLoginToken(request) {
  return String(request?.cookies?.get?.(PENDING_LOGIN_COOKIE_NAME)?.value || "").trim();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function htmlResponse(
  locale,
  variant,
  homeUrl,
  { token = "", attempt = null, autoSubmit = false, pendingLoginToken = "" } = {}
) {
  const copy = COPY[locale] || COPY.et;
  const signingIn = variant === "signin";
  const ok = variant === "ok" || signingIn;
  const confirming = variant === "confirm";
  const autoConfirming = confirming && autoSubmit;
  const waits = signingIn || autoConfirming;
  // `signin` renderdab tõrketeate. Skript peidab selle ootamise ajaks ja näitab
  // ainult siis, kui sisselogimine siin ei õnnestu. JS-ita on see õige lõppseis.
  const title = confirming
    ? copy.confirmTitle
    : signingIn
      ? copy.signinFallbackTitle
      : ok
        ? copy.okTitle
        : copy.invalidTitle;
  const body = confirming
    ? copy.confirmBody
    : signingIn
      ? copy.signinFallbackBody
      : ok
        ? copy.okBody
        : copy.invalidBody;
  const script = signingIn ? SIGN_IN_SCRIPT : autoConfirming ? AUTO_CONFIRM_SCRIPT : "";
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
      *, *::before, *::after { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        min-height: 100dvh;
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
        min-width: 0;
        overflow-wrap: anywhere;
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
        min-width: min(11rem, 100%);
        max-width: 100%;
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
      /* Ootel olek vajab liikumist, muidu loeb ta kinnijooksmisena.
         Kolm punkti, mitte spinner: sama vaikne keel mis dokil. Teksti ootel
         olekus ei ole (omanik 28.09: eraldi sisselogimise teadet vaja ei ole,
         rakenduse avanemine on see teade). Tekst ilmub ainult tõrke korral,
         kui skript data-waiting'u maha võtab. */
      .dots {
        display: none;
        gap: 0.42rem;
        margin-top: 0.5rem;
      }
      body[data-waiting] .dots { display: inline-flex; }
      body[data-waiting] h1,
      body[data-waiting] #lc-msg,
      body[data-waiting] .facts,
      body[data-waiting] form { display: none; }
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
    <main id="lc"${
      signingIn
        ? ` data-token="${escapeHtml(pendingLoginToken)}" data-locale="${escapeHtml(locale)}"`
        : ""
    }>
      <h1>${escapeHtml(title)}</h1>
      <p id="lc-msg" aria-live="polite">${escapeHtml(body)}</p>
      ${facts ? `<dl class="facts">${facts}</dl>` : ""}
      ${
        confirming
          ? `<form id="lc-form" method="POST" action="/api/auth/login-confirm"><input type="hidden" name="token" value="${escapeHtml(
              token
            )}" /><input type="hidden" name="locale" value="${escapeHtml(
              locale
            )}" /><button class="button" id="lc-submit" type="submit">${escapeHtml(copy.confirmAction)}</button></form>`
          : variant === "invalid"
            ? `<a class="button" id="lc-open" href="${escapeHtml(homeUrl)}">${escapeHtml(copy.openLabel)}</a>`
            : ""
      }
      ${
        waits
          ? `<span class="dots" role="status" aria-label="${escapeHtml(copy.waitBody)}"><i></i><i></i><i></i></span>`
          : ""
      }
    </main>
    ${script ? `<script>${script}</script>` : ""}
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
 *
 * Erand on ainult sama brauser (omanik 28.09). Kui päring kannab selle katse PIN-i
 * sisestanud brauseri küpsist, vajutab leht nuppu ise ja inimene jõuab otse
 * rakendusse. Skanner ja ohvri brauser seda küpsist ei saada. Ka siis kinnitab
 * alles POST, GET jääb lugemiseks.
 */
export async function GET(request) {
  const url = new URL(request.url);
  const token = String(url.searchParams.get("token") || "").trim();
  const locale = normalizeServerLocale(url.searchParams.get("locale")) || "et";
  const homeUrl = "/";

  if (!token) return htmlResponse(locale, "invalid", homeUrl);

  try {
    const described = await describeLoginEmailConfirmation({
      db: prisma,
      token,
      pendingLoginToken: readPendingLoginToken(request),
      locale
    });
    if (!described.ok) return htmlResponse(locale, "invalid", homeUrl);

    return htmlResponse(locale, "confirm", homeUrl, {
      token,
      attempt: described.attempt,
      autoSubmit: described.sameBrowser
    });
  } catch (error) {
    console.error("login-confirm page error", safeError(error), { locale });
    return htmlResponse(locale, "invalid", homeUrl);
  }
}

/**
 * Kinnitus ise. Siia jõuab päris brauseri nupuvajutus. Võõras brauser vajutab
 * nuppu teadlikult, PIN-i sisestanud brauseris vajutab seda leht ise.
 */
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
  const homeUrl = "/";

  if (!token) return htmlResponse(locale, "invalid", homeUrl);

  try {
    const pendingLoginToken = readPendingLoginToken(request);
    const result = await confirmLoginEmailLink({ db: prisma, token, pendingLoginToken });
    if (!result.ok) return htmlResponse(locale, "invalid", homeUrl);
    if (!result.sameBrowser) return htmlResponse(locale, "ok", homeUrl);

    // PIN-i sisestanud brauser: leht lõpetab sisselogimise ise. Token läheb lehele
    // ainult selle brauseri enda küpsisest. Küpsise roll on sellega täidetud.
    const response = htmlResponse(locale, "signin", homeUrl, { pendingLoginToken });
    const cleared = clearedPendingLoginCookie();
    response.cookies.set(cleared.name, cleared.value, cleared.options);
    return response;
  } catch (error) {
    console.error("login-confirm error", safeError(error), { locale });
    return htmlResponse(locale, "invalid", homeUrl);
  }
}
