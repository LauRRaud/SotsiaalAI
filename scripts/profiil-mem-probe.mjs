// One-shot memory probe for the /profiil OOM. Loads the page logged-in and
// samples CDP Performance metrics over time so we can SEE which resource runs
// away: Nodes↑ = re-render/childList loop, JSHeapUsedSize↑ = allocation leak,
// LayoutCount/RecalcStyleCount climbing fast = a rAF style-thrash loop (the
// prime suspect: the profile role-hole mask effect).
//
// Usage:
//   node scripts/profiil-mem-probe.mjs [--base-url http://localhost:3000]
//     [--route /profiil] [--seconds 20] [--token <t>] [--headed]
//     [--disable-mask]   neutralise the mask effect to A/B the suspect
//
// Auth: env SNAPSHOT_SESSION (session-token cookie) or --token, else generates
// one via tmp-create-login-token.mjs (needs DB reachable via .env).

import { chromium } from "playwright";
import { execSync } from "node:child_process";

function parseArgs(argv) {
  const out = { baseUrl: "http://localhost:3000", route: "/profiil", seconds: 20, token: null, headed: false, disableMask: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--base-url") out.baseUrl = argv[++i];
    else if (a === "--route") out.route = argv[++i];
    else if (a === "--seconds") out.seconds = Number(argv[++i]);
    else if (a === "--token") out.token = argv[++i];
    else if (a === "--headed") out.headed = true;
    else if (a === "--disable-mask") out.disableMask = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  return out;
}

function generateToken() {
  const raw = execSync("npx tsx scripts/tmp-create-login-token.mjs", { encoding: "utf8" });
  const m = raw.match(/TOKEN:\s*([a-f0-9]+)/i);
  if (!m) throw new Error("could not parse token");
  return m[1];
}

async function login(page, baseUrl, token) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  const res = await page.evaluate(async (tok) => {
    const csrf = await (await fetch("/api/auth/csrf")).json();
    const body = new URLSearchParams({ csrfToken: csrf.csrfToken, temp_login_token: tok, callbackUrl: "/vestlus", json: "true" });
    const r = await fetch("/api/auth/callback/credentials", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(), redirect: "manual",
    });
    return { status: r.status };
  }, token);
  if (res.status >= 400) throw new Error(`login failed: ${res.status}`);
}

const KEYS = ["JSHeapUsedSize", "Nodes", "LayoutCount", "RecalcStyleCount", "JSEventListeners", "LayoutObjects", "Documents"];

function pick(metrics) {
  const m = Object.fromEntries(metrics.map((x) => [x.name, x.value]));
  const out = {};
  for (const k of KEYS) out[k] = m[k] ?? 0;
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sessionCookie = process.env.SNAPSHOT_SESSION || null;
  const token = sessionCookie ? null : args.token || generateToken();

  const browser = await chromium.launch({ headless: !args.headed });
  const context = await browser.newContext();
  if (sessionCookie) {
    const { hostname } = new URL(args.baseUrl);
    await context.addCookies([{ name: "next-auth.session-token", value: sessionCookie, domain: hostname, path: "/", httpOnly: true, sameSite: "Lax" }]);
  }
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(120000);

  // Optionally neutralise the mask effect before it runs, to A/B the suspect:
  // freeze requestAnimationFrame's victim by no-op'ing the mask refresh path is
  // hard from outside, so instead we just record — the --disable-mask flag adds
  // a style that forces the mask layer off, removing the data-URL churn cost.
  if (args.disableMask) {
    await context.addInitScript(() => {
      const css = ".profile-mask-layer{mask-image:none!important;-webkit-mask-image:none!important;clip-path:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;}";
      const apply = () => { const s = document.createElement("style"); s.textContent = css; document.head?.appendChild(s); };
      if (document.head) apply(); else document.addEventListener("DOMContentLoaded", apply);
    });
  }

  if (token) await login(page, args.baseUrl, token);

  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");

  console.log(`probing ${args.baseUrl}${args.route} for ${args.seconds}s (disableMask=${args.disableMask})\n`);
  const t0 = Date.now();
  await page.goto(`${args.baseUrl}${args.route}`, { waitUntil: "domcontentloaded" }).catch((e) => {
    console.log(`navigation error (may be the crash): ${String(e.message).split("\n")[0]}`);
  });

  const samples = [];
  const header = ["t(s)", ...KEYS].join("\t");
  console.log(header);
  const end = Date.now() + args.seconds * 1000;
  let crashed = false;
  while (Date.now() < end) {
    try {
      const { metrics } = await cdp.send("Performance.getMetrics");
      const row = pick(metrics);
      samples.push(row);
      const ts = ((Date.now() - t0) / 1000).toFixed(1);
      const heapMb = (row.JSHeapUsedSize / 1048576).toFixed(1);
      console.log([ts, `${heapMb}MB`, row.Nodes, row.LayoutCount, row.RecalcStyleCount, row.JSEventListeners, row.LayoutObjects, row.Documents].join("\t"));
    } catch (e) {
      crashed = true;
      console.log(`\n*** metrics failed — render process likely gone (OOM reproduced): ${String(e.message).split("\n")[0]}`);
      break;
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  if (samples.length >= 2) {
    const a = samples[0], b = samples[samples.length - 1];
    console.log("\n--- delta over window ---");
    for (const k of KEYS) {
      const d = b[k] - a[k];
      const unit = k === "JSHeapUsedSize" ? ` (${(d / 1048576).toFixed(1)}MB)` : "";
      console.log(`${k}: ${a[k]} -> ${b[k]}  Δ${d}${unit}`);
    }
  }
  console.log(crashed ? "\nRESULT: OOM/crash reproduced." : "\nRESULT: survived the window (no crash in this run).");
  await browser.close().catch(() => {});
}

main().catch((e) => { console.error(e); process.exit(1); });
