import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const page = readFileSync(join(root, "components/covision/CompletedCasesPage.jsx"), "utf8");
const route = readFileSync(join(root, "app/lopetatud-juhtumid/page.jsx"), "utf8");
const css = readFileSync(join(root, "app/styles/completed-cases.css"), "utf8");

test("completed cases production page is authenticated and never mounts demo data", () => {
  assert.match(route, /getServerSession\(authConfig\)/);
  assert.match(route, /canUseCovisionRole/);
  assert.match(route, /<CompletedCasesPage/);
  assert.doesNotMatch(page, /DEMO_|demoCases|mockCases|sampleCases/i);
});

test("page reads real list/detail APIs and wires every lifecycle write", () => {
  assert.match(page, /fetch\(`\/api\/covision\/completed\?\$\{params\}`/);
  assert.match(page, /fetch\(`\/api\/covision\/completed\/\$\{encodeURIComponent\(normalizedId\)\}`/);
  for (const action of ["follow-up", "decision", "archive"]) {
    assert.match(page, new RegExp(`"${action}"`));
  }
  assert.match(page, /expectedVersion:\s*detail\.version/);
});

test("main page has platform navigation and deliberately lacks active-session chrome", () => {
  for (const href of ["/kovisioon", "/teemaseemned", "/lopetatud-juhtumid", "/parimad-praktikad"]) {
    assert.match(page, new RegExp(`href="${href}"`));
  }
  assert.doesNotMatch(page, /StageRail|meetingElapsed|Vajan tuge|Sessiooni juht/);
  assert.match(page, /completed_cases\.help\.title/);
  assert.match(page, /roleLabel\(owner\.role, t\)/);
});

test("owner-package content is conditional and all important states have text labels", () => {
  assert.match(page, /item\.package\?\.contentVisible/);
  assert.match(page, /item\.package\?\.content\s*\?/);
  assert.match(page, /completed_cases\.package\.hidden_other/);
  assert.match(page, /statusMeta\(item, t\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /content-visibility:\s*auto/);
});

test("desktop toolbar reserves enough width for both complete view labels", () => {
  assert.match(css, /\.ccp-toolbar\s*\{[\s\S]*flex-wrap:\s*wrap/);
  assert.match(css, /\.ccp-toolbar select\s*\{[\s\S]*width:\s*13rem[\s\S]*max-width:\s*100%/);
  assert.match(css, /\.ccp-view-switch\s*\{[^}]*flex:\s*0 0 auto/);
  assert.match(css, /\.ccp-view-switch button\s*\{[^}]*white-space:\s*nowrap/);
});

test("detail deep links stay synchronized with browser history", () => {
  assert.match(page, /const openDetail = useCallback\(async \(id, \{ history = "push", trigger = null \} = \{\}\)/);
  assert.match(page, /window\.history\[history === "replace" \? "replaceState" : "pushState"\]/);
  assert.match(page, /window\.addEventListener\("popstate", syncFromLocation\)/);
  assert.match(page, /window\.removeEventListener\("popstate", syncFromLocation\)/);
  assert.match(page, /detailRequestGateRef\.current\.begin\(normalizedId\)/);
});

test("list, detail and mutation responses are scoped to the latest visible target", () => {
  assert.match(page, /listRequestGateRef\.current\.begin\(params\.toString\(\)\)/);
  assert.match(page, /detailRequestGateRef\.current\.begin\(normalizedId\)/);
  assert.match(page, /mutationRequestGateRef\.current\.begin\(detailId\)/);
  assert.match(page, /signal: request\.signal/);
  assert.match(page, /selectedIdRef\.current !== normalizedId/);
  assert.match(page, /selectedIdRef\.current !== detailId/);
  assert.match(page, /openDetail\(detailId, \{ history: "none" \}\)/);
});

test("loading and error detail states remain keyboard-contained dialogs", () => {
  assert.match(page, /function DetailLoadingDialog/);
  assert.match(page, /role="dialog"[\s\S]*aria-modal="true"[\s\S]*aria-labelledby="ccp-detail-loading-title"/);
  assert.match(page, /autoFocus onClick=\{onClose\} aria-label=/);
  assert.match(page, /onClick=\{onRetry\}/);
  assert.match(page, /useModalFocusTrap\(dialogRef\)/);
  assert.match(page, /completed_cases\.help\.title[\s\S]*aria-expanded=\{helpOpen\}/);
});

test("owner-only practice link and help disclosure have explicit UI contracts", () => {
  assert.match(page, /mode === "links" && isOwner/);
  assert.match(page, /\/parimad-praktikad\?practice=/);
  assert.match(page, /aria-expanded=\{helpOpen\}/);
  assert.match(page, /aria-controls="ccp-help-panel"/);
  assert.match(page, /id="ccp-help-panel"/);
  assert.match(page, /aria-label=\{m\(t, "completed_cases\.search"/);
  assert.match(page, /dialogRef\.current/);
  assert.match(page, /event\.key !== "Tab"/);
  assert.match(page, /detailOpenerRef\.current/);
  assert.match(page, /requestAnimationFrame\(\(\) => opener\?\.focus\(\)\)/);
});
