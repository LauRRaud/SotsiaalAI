import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
const moduleUrl = new URL("../../lib/mentoring/time.js", import.meta.url).href;

function inTallinn(source) {
  const script = `
    import { localDateTimeToIso } from ${JSON.stringify(moduleUrl)};
    const iso = localDateTimeToIso(${JSON.stringify(source)});
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Tallinn", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    }).formatToParts(new Date(iso));
    process.stdout.write(JSON.stringify({ iso, local: Object.fromEntries(parts.map((part) => [part.type, part.value])) }));
  `;
  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", script], {
    encoding: "utf8",
    env: { ...process.env, TZ: "Europe/Tallinn" },
    shell: false
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test("SOL-MENT-06: Tallinn winter and summer datetime-local become exact UTC and redisplay identically", () => {
  const winter = inTallinn("2026-01-15T10:30");
  const summer = inTallinn("2026-07-15T10:30");
  assert.equal(winter.iso, "2026-01-15T08:30:00.000Z");
  assert.equal(summer.iso, "2026-07-15T07:30:00.000Z");
  for (const value of [winter, summer]) {
    assert.equal(`${value.local.year}-${value.local.month}-${value.local.day}T${value.local.hour}:${value.local.minute}`,
      value === winter ? "2026-01-15T10:30" : "2026-07-15T10:30");
  }
});
