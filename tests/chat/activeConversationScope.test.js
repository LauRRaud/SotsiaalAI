import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  activeConversationRow,
  clearActiveConversationIdIfMatches,
  readActiveConversationId,
  writeActiveConversationId
} from "../../lib/chat/activeConversationKey.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

/**
 * SOL-CHAT-11 — aktiivse vestluse ID on konto ja rolli oma.
 *
 * Vestluse SISU oli juba kasutaja järgi eraldatud, aga see, MILLINE vestlus on aktiivne, loeti
 * alati üldisest `sotsiaalai:chat:convId` reast. Samas vahekaardis kontot vahetades jätkas uus
 * kasutaja eelmise konto vestluse ID-ga.
 */

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key)
  };
}

test("kaks kontot samas brauseris ei näe teineteise aktiivset vestlust", () => {
  const storage = fakeStorage();
  writeActiveConversationId(storage, { userId: "user-a", role: "CLIENT" }, "conv-a");
  writeActiveConversationId(storage, { userId: "user-b", role: "CLIENT" }, "conv-b");

  assert.equal(readActiveConversationId(storage, { userId: "user-a", role: "CLIENT" }), "conv-a");
  assert.equal(readActiveConversationId(storage, { userId: "user-b", role: "CLIENT" }), "conv-b");
});

test("rollivahetus samas kontos annab oma vestluse, mitte eelmise rolli oma", () => {
  const storage = fakeStorage();
  writeActiveConversationId(storage, { userId: "user-a", role: "CLIENT" }, "conv-client");
  assert.equal(readActiveConversationId(storage, { userId: "user-a", role: "SOCIAL_WORKER" }), null);

  writeActiveConversationId(storage, { userId: "user-a", role: "SOCIAL_WORKER" }, "conv-worker");
  assert.equal(readActiveConversationId(storage, { userId: "user-a", role: "CLIENT" }), "conv-client");
  assert.equal(readActiveConversationId(storage, { userId: "user-a", role: "SOCIAL_WORKER" }), "conv-worker");
});

test("identiteedita hetk ei loe ega kirjuta midagi", () => {
  const storage = fakeStorage();
  assert.equal(writeActiveConversationId(storage, { userId: null, role: "CLIENT" }, "conv-x"), false);
  assert.equal(storage.map.size, 0);
  assert.equal(readActiveConversationId(storage, { userId: "", role: "CLIENT" }), null);
});

test("vana sildistamata rida kustutatakse, mitte ei anta esimesele avajale", () => {
  const storage = fakeStorage({ "sotsiaalai:chat:convId": "conv-eelmine-inimene" });
  const value = readActiveConversationId(storage, { userId: "user-uus", role: "CLIENT" });

  assert.equal(value, null, "pärandrida ei kuulu kellelegi");
  assert.equal(storage.getItem("sotsiaalai:chat:convId"), null, "ta peab kaduma");
});

test("kustutus puudutab ainult vastet ja ainult oma konto oma", () => {
  const storage = fakeStorage();
  writeActiveConversationId(storage, { userId: "user-a", role: "CLIENT" }, "conv-1");
  writeActiveConversationId(storage, { userId: "user-b", role: "CLIENT" }, "conv-1");

  assert.equal(clearActiveConversationIdIfMatches(storage, { userId: "user-a", role: "CLIENT" }, "conv-2"), false);
  assert.equal(readActiveConversationId(storage, { userId: "user-a", role: "CLIENT" }), "conv-1");

  assert.equal(clearActiveConversationIdIfMatches(storage, { userId: "user-a", role: "CLIENT" }, "conv-1"), true);
  assert.equal(readActiveConversationId(storage, { userId: "user-a", role: "CLIENT" }), null);
  assert.equal(
    readActiveConversationId(storage, { userId: "user-b", role: "CLIENT" }),
    "conv-1",
    "võõra konto rida jääb puutumata"
  );
});

test("võti kannab rolli ja omanikku, mitte ainult nime", () => {
  assert.equal(activeConversationRow("SOCIAL_WORKER"), "sotsiaalai:chat:convId:social_worker");
  const storage = fakeStorage();
  writeActiveConversationId(storage, { userId: "u1", role: "CLIENT" }, "c1");
  const [key] = [...storage.map.keys()];
  assert.ok(key.includes("client"));
  assert.ok(key.endsWith("::u1"));
});

test("üldist võtit ei kirjutata enam üheski kolmest kohast", () => {
  for (const file of [
    "components/chat/hooks/useChatConversationState.js",
    "components/alalehed/ChatBody.jsx",
    "components/ChatSidebar.jsx"
  ]) {
    const source = read(file);
    assert.doesNotMatch(
      source,
      /sessionStorage\.setItem\("sotsiaalai:chat:convId"/,
      `${file}: üldise võtme kirjutamine oli leid ise`
    );
    assert.doesNotMatch(
      source,
      /sessionStorage\.getItem\("sotsiaalai:chat:convId"\)/,
      `${file}: üldise võtme lugemine oli leid ise`
    );
  }
});

test("server annab võõra omaniku vestlusele 409 ENNE providerikutset", () => {
  const source = read("lib/chat/mainResponseHandler.js");
  const gate = source.indexOf("CHAT_TURN_OUTCOME.CONVERSATION_UNAVAILABLE");
  const provider = source.indexOf("await callProvider({");
  assert.ok(gate > 0 && gate < provider, "värav peab olema enne providerikutset");
  assert.match(source, /conversation_unavailable", 409/);
  assert.match(source, /chat_conversation_unavailable/);
});
