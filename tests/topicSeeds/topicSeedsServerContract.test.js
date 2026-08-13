import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const collectionRoute = readFileSync(join(root, "app/api/topic-seeds/route.js"), "utf8");
const itemRoute = readFileSync(join(root, "app/api/topic-seeds/[id]/route.js"), "utf8");
const queueRoute = readFileSync(join(root, "app/api/topic-seeds/[id]/queue/route.js"), "utf8");
const withdrawRoute = readFileSync(join(root, "app/api/topic-seeds/[id]/withdraw/route.js"), "utf8");
const queueListRoute = readFileSync(join(root, "app/api/topic-seeds/queue/route.js"), "utf8");

test("routes: every write uses the strict shared JSON body parser", () => {
  assert.match(collectionRoute, /parseTopicSeedJsonBody\(request\)/);
  assert.match(itemRoute, /parseTopicSeedJsonBody\(request\)/);
  assert.match(queueRoute, /parseTopicSeedJsonBody\(request\)/);
});

test("route: owner-only PATCH is role-gated and delegates to the atomic service", () => {
  assert.match(itemRoute, /export async function PATCH/);
  assert.match(itemRoute, /requireCovisionAuth\(\)/);
  assert.match(itemRoute, /updateTopicSeed\(/);
});

test("shared Kovisioon role gate behavior returns 401/403 and allows the two worker roles", () => {
  const script = `
    const { requireCovisionRole } = await import('./lib/covision.js');
    const expectFailure = (session, status, message) => {
      try { requireCovisionRole(session); process.exit(20); }
      catch (error) {
        if (error?.status !== status || error?.message !== message) process.exit(21);
      }
    };
    expectFailure(null, 401, 'api.common.unauthorized');
    expectFailure({ user: { id: 'client', role: 'CLIENT' } }, 403, 'covision.errors.role_forbidden');
    requireCovisionRole({ user: { id: 'worker', role: 'SOCIAL_WORKER' } });
    requireCovisionRole({ user: { id: 'provider', role: 'SERVICE_PROVIDER' } });
  `;
  const result = spawnSync(
    process.execPath,
    [
      "--conditions",
      "react-server",
      "--import",
      pathToFileURL(join(root, "scripts/register-node-test-loader.mjs")).href,
      "--input-type=module",
      "--eval",
      script
    ],
    { cwd: root, encoding: "utf8" }
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("routes: errors pass through the explicit public-error descriptor", () => {
  for (const source of [collectionRoute, itemRoute, queueRoute, withdrawRoute, queueListRoute]) {
    assert.match(source, /topicSeedPublicError\(error\)/);
    assert.doesNotMatch(source, /error\?\.message\s*\|\|/);
  }
});

test("routes expose bounded list, minimal queue, delete and withdraw lifecycle operations", () => {
  assert.match(collectionRoute, /listTopicSeedPage/);
  assert.match(collectionRoute, /search\.get\("cursor"\)/);
  assert.match(queueListRoute, /listWaitingTopicSeedPage/);
  assert.match(itemRoute, /export async function DELETE/);
  assert.match(itemRoute, /deleteTopicSeed/);
  assert.match(withdrawRoute, /withdrawTopicSeed/);
  assert.match(queueRoute, /expectedVersion:\s*body\.expectedVersion/);
});
