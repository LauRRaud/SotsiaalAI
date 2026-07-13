import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// A6.1 §9.3 — client + route SOURCE-CONTRACT regressions. There is no authenticated
// browser e2e harness here, so these assert the wiring in source (they are NOT an
// e2e test): the page uses real server data, not demo seeds, and the routes are
// role-gated.

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const page = readFileSync(join(root, "components/teemaseeme/TeemaseemnedPage.jsx"), "utf8");
const listRoute = readFileSync(join(root, "app/api/topic-seeds/route.js"), "utf8");
const editRoute = readFileSync(join(root, "app/api/topic-seeds/[id]/route.js"), "utf8");
const queueRoute = readFileSync(join(root, "app/api/topic-seeds/[id]/queue/route.js"), "utf8");

test("client: DEMO_SEEDS is no longer the source of truth", () => {
  assert.doesNotMatch(page, /useState\(DEMO_SEEDS\)/);
  assert.doesNotMatch(page, /const DEMO_SEEDS\s*=/);
  assert.match(page, /const \[seeds, setSeeds\] = useState\(\[\]\)/);
});

test("client: the page loads the owner's seeds from GET /api/topic-seeds", () => {
  assert.match(page, /fetch\("\/api\/topic-seeds"/);
  assert.match(page, /useEffect\(/);
});

test("client: create/save write through POST or PATCH and server response defines id/status", () => {
  assert.match(page, /method:\s*isEditing \? "PATCH" : "POST"/);
  assert.match(page, /expectedUpdatedAt:\s*editingUpdatedAt/);
  assert.match(page, /buildCreatePayload/);
  assert.match(page, /toCardSeed\(payload\.seed\)/);
  // No local id minting remains.
  assert.doesNotMatch(page, /nextSeedId/);
});

test("client: a DRAFT can be reopened losslessly in the quick form", () => {
  assert.match(page, /function openEdit\(seed\)/);
  assert.match(page, /setEditingSeedId\(seed\.id\)/);
  assert.match(page, /setEditingUpdatedAt\(seed\.updatedAt \|\| null\)/);
  assert.match(page, /setTitle\(seed\.rawTitle \|\| ""\)/);
  assert.match(page, /setContextKey\(seed\.contextType \|\| null\)/);
  assert.match(page, /setKindKey\(seed\.caseType \|\| null\)/);
  assert.match(page, /setSupport\(Array\.isArray\(seed\.requestedSupport\)/);
  assert.match(page, /KEY_TO_GATE\[seed\.safetyGate\]/);
});

test("client: save-and-exit persists first and exits only after success", () => {
  assert.match(page, /async function saveDraft\(\)[\s\S]*await submitSeed\(\{ complete: false \}\)[\s\S]*if \(!card\) return[\s\S]*setView\("list"\)/);
  assert.match(page, /topic_seeds\.ui\.save_and_exit[\s\S]*onClick=\{saveDraft\}/);
  assert.doesNotMatch(page, /Salvestan mustandi ja väljun[\s\S]{0,160}setView\("list"\)/);
});

test("client: WAITING cards render only the frozen snapshot and reject malformed snapshot arrays", () => {
  assert.match(page, /seed\.status === "WAITING"/);
  assert.match(page, /!Array\.isArray\(seed\.sharedCardSnapshot\)/);
  assert.match(page, /const displaySeed = seed\.status === "WAITING" \? frozenSnapshot \|\| \{\} : seed/);
  assert.match(page, /title:\s*displaySeed\.title/);
  assert.match(page, /CONTEXT_LABEL\[displaySeed\.contextType\]/);
  assert.match(page, /displaySeed\.requestedSupport/);
});

test("client: known incomplete drafts cannot enter the queue confirmation", () => {
  assert.match(page, /isComplete:\s*Boolean\(/);
  assert.match(page, /disabled=\{!seed\.isComplete\}/);
  assert.match(page, /topic_seeds\.ui\.complete_before_queue/);
});

test("client: localized inline failures offer a reload action on 409", () => {
  assert.match(page, /resolveApiMessage/);
  assert.match(page, /if \(response\.status === 409\) setConflictScope\("edit"\)/);
  assert.match(page, /if \(response\.status === 409\) setConflictScope\("share"\)/);
  assert.match(page, /role="alert"/);
  assert.match(page, /topic_seeds\.ui\.reload/);
  assert.doesNotMatch(page, /error && !shareSeed/);
  assert.match(page, /const shareLayer = shareSeed \? \([\s\S]*\{error \? \(/);
});

test("client: fetches carry the active UI locale and initial GET cannot overwrite a mutation", () => {
  assert.match(page, /const \{ locale, t \} = useI18n\(\)/);
  assert.ok((page.match(/"x-ui-locale": locale/g) || []).length >= 3);
  assert.match(page, /const versionAtStart = dataVersionRef\.current/);
  assert.match(page, /if \(dataVersionRef\.current === versionAtStart\)/);
  assert.match(page, /dataVersionRef\.current \+= 1/);
});

test("client: queue sends expectedUpdatedAt and a conscious confirmation, gated on the checkbox", () => {
  assert.match(page, /\/topic-seeds\/\$\{encodeURIComponent\(shareSeed\.id\)\}\/queue/);
  assert.match(page, /expectedUpdatedAt:\s*shareSeed\.updatedAt/);
  assert.match(page, /confirmedNoIdentifiers:\s*true/);
  assert.match(page, /if \(!shareSeed \|\| saving \|\| !shareConfirmed\) return/);
});

test("client: success is applied only after an ok response (no misleading WAITING)", () => {
  assert.match(page, /if \(!response\.ok \|\| !payload\?\.seed\)/);
});

test("client: local card layout state stays out of server domain data", () => {
  // The spatial layout lives in dedicated maps, not in the seed domain objects.
  assert.match(page, /const \[cardOffsets, setCardOffsets\] = useState\(\{\}\)/);
  assert.match(page, /const \[cardSizes, setCardSizes\] = useState\(\{\}\)/);
});

test("routes: list/create, edit, and queue routes are role-gated via requireCovisionAuth (401/403)", () => {
  assert.match(listRoute, /requireCovisionAuth/);
  assert.match(editRoute, /requireCovisionAuth/);
  assert.match(queueRoute, /requireCovisionAuth/);
});
