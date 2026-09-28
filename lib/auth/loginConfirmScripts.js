import {
  LOGIN_HANDOFF_ATTEMPT_MARKER_LENGTH,
  LOGIN_HANDOFF_MESSAGE,
  LOGIN_HANDOFF_PREFS_KEY,
  LOGIN_TAB_CHANNEL
} from "@/lib/auth/loginHandoff";

/* Kinnituslingi lehe skriptid. Leht on eraldiseisev HTML ilma rakenduse
   bundle'ita, seega on skriptid tavalised stringid (ES5, ilma tagurpidi
   kaldkriipsudeta, mida mall-string muudaks). Test käivitab täpselt neidsamu stringe.

   Mõlemad skriptid jõuavad lehele ainult siis, kui päring kandis PIN-i
   sisestanud brauseri küpsist (`sameBrowser`). Võõras brauser, teine seade ja
   postkasti skanner saavad endiselt kinnituslehe nupuga (SOL-AUTH-08).

   Ootamise ajal on body[data-waiting] ja leht näitab ainult punkte. Omanik 28.09:
   eraldi „sisse logitud“ teadet vaja ei ole, rakenduse avanemine on see teade.
   Teksti näeb ainult siis, kui sisselogimine siin ei õnnestu. */

const KEY = JSON.stringify(LOGIN_HANDOFF_PREFS_KEY);
const CHANNEL = JSON.stringify(LOGIN_TAB_CHANNEL);
const FINISHING = JSON.stringify(LOGIN_HANDOFF_MESSAGE.finishing);
const COMPLETE = JSON.stringify(LOGIN_HANDOFF_MESSAGE.complete);
const FAILED = JSON.stringify(LOGIN_HANDOFF_MESSAGE.failed);
const MARKER_LENGTH = String(LOGIN_HANDOFF_ATTEMPT_MARKER_LENGTH);

/* GET samas brauseris: kinnitusnupp vajutatakse kohe ise. GET ise ei kirjuta
   midagi. Kinnitus jääb POST-i, nii et lingi eelvaade ega skanner ei
   kinnita midagi. JS-ita jääb nähtavale tavaline kinnitusleht nupuga. */
export const AUTO_CONFIRM_SCRIPT = `(function () {
  var form = document.getElementById("lc-form");
  if (!form) return;
  window.addEventListener("pageshow", function (event) {
    if (event && event.persisted) document.body.removeAttribute("data-waiting");
  });
  document.body.setAttribute("data-waiting", "1");
  form.submit();
})();`;

/* POST samas brauseris: kinnitus on tehtud, leht lõpetab sisselogimise nagu
   PIN-aken seda teeks (step2 + NextAuthi credentials) ja avab rakenduse. Kui
   miski ebaõnnestub, oodatakse lühidalt, kas ärkvel PIN-aken jõudis ette. Kui
   ei jõudnud, jääb nähtavale serveri renderdatud tõrketeade. */
export const SIGN_IN_SCRIPT = `(function () {
  var root = document.getElementById("lc");
  if (!root) return;
  var token = root.getAttribute("data-token") || "";
  var locale = root.getAttribute("data-locale") || "et";
  var prefs = {};
  try { prefs = JSON.parse(window.localStorage.getItem(${KEY}) || "{}") || {}; } catch (e) { prefs = {}; }
  // Ainult selle brauseri PIN-akna enda katse: märgis on meie päritolu
  // localStorage'is ja seda ei saa istutada võõra saidi vormi-POST.
  var marker = token.slice(0, ${MARKER_LENGTH});
  if (!token || marker.length !== ${MARKER_LENGTH} || prefs.attempt !== marker) return;
  var remember = prefs.remember === true;
  var deviceName = remember && typeof prefs.name === "string" ? prefs.name.slice(0, 60) : "";
  var next = samePath(prefs.next);
  var channel = null;
  try { channel = new BroadcastChannel(${CHANNEL}); } catch (e) { channel = null; }
  function samePath(value) {
    try {
      var url = new URL(typeof value === "string" && value ? value : "/", window.location.origin);
      if (url.origin !== window.location.origin) return "/";
      return url.pathname + url.search + url.hash;
    } catch (e) {
      return "/";
    }
  }
  function tell(type) {
    if (!channel) return;
    try { channel.postMessage({ type: type }); } catch (e) {}
  }
  function finish() {
    try { window.localStorage.removeItem(${KEY}); } catch (e) {}
    tell(${COMPLETE});
    window.location.replace(next);
  }
  function giveUp() {
    tell(${FAILED});
    document.body.removeAttribute("data-waiting");
  }
  function waitForSession(triesLeft) {
    function again() {
      if (triesLeft > 0) setTimeout(function () { waitForSession(triesLeft - 1); }, 800);
      else giveUp();
    }
    fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        if (data && data.user) { finish(); return; }
        again();
      })
      .catch(again);
  }
  document.body.setAttribute("data-waiting", "1");
  tell(${FINISHING});
  fetch("/api/auth/login-step2", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      temp_login_token: token,
      remember_device: remember,
      device_name: deviceName,
      locale: locale
    })
  })
    .then(function (res) {
      if (!res.ok) throw new Error("step2");
      return fetch("/api/auth/csrf", { credentials: "same-origin", cache: "no-store" });
    })
    .then(function (res) {
      if (!res.ok) throw new Error("csrf");
      return res.json();
    })
    .then(function (data) {
      var body = new URLSearchParams();
      body.set("temp_login_token", token);
      body.set("csrfToken", (data && data.csrfToken) || "");
      body.set("callbackUrl", next);
      body.set("json", "true");
      return fetch("/api/auth/callback/credentials", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString()
      });
    })
    .then(function (res) {
      return res.json().catch(function () { return null; }).then(function (data) {
        var url = (data && data.url) || "";
        if (!res.ok || url.indexOf("error=") !== -1) throw new Error("signin");
        finish();
      });
    })
    .catch(function () { waitForSession(6); });
})();`;
