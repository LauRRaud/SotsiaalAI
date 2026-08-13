import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = process.cwd();
const read = relative => readFileSync(path.join(ROOT, relative), "utf8");

test("rooms UI consumes server action flags instead of rebuilding permissions from role", () => {
  const source = read("components/rooms/RoomsPage.jsx");
  assert.doesNotMatch(source, /canInvite\(room\.role\)/);
  assert.doesNotMatch(source, /canDelete\(room\.role\)/);
  assert.doesNotMatch(source, /role => role === "OWNER"/);
  for (const flag of ["canInvite", "canLeave", "canDelete", "canArchive"]) {
    assert.match(source, new RegExp(`room\\.${flag}`), `${flag} is not consumed from the response`);
  }

  const route = read("app/api/rooms/route.js");
  assert.match(
    route,
    /canLeave: !isOwner && !isArchived/,
    "GET /api/rooms must serialize the fail-closed leave decision too"
  );
});

test("rooms UI offers archive and keeps GET/PATCH/DELETE failures recoverable", () => {
  const source = read("components/rooms/RoomsPage.jsx");
  assert.match(source, /"PATCH"/);
  assert.match(source, /action: "archive"/);
  assert.match(source, /role="alert"/);
  assert.match(source, /rooms\.retry/);
  assert.match(source, /setLoadError/);
  assert.match(source, /setActionError/);
  assert.doesNotMatch(
    source,
    /finally\s*\{[^}]*setConfirmRoom\(null\)/s,
    "a failed mutation must not silently close its recovery context"
  );
});
