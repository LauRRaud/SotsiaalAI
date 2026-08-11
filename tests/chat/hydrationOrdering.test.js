import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createRequestGeneration } from "../../lib/chat/requestGeneration.js";
import { shouldSettleRequest } from "../../lib/chat/sidebarListState.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

/**
 * SOL-CHAT-12 (vestluse hüdreerimine) ja SOL-CHAT-13 (ruumide külgriba) — sama klass kahes kohas:
 * kattuv päring kirjutas uuema seisu vanemaga üle ja lõpetas võõra laadimisoleku.
 */

// --- SOL-CHAT-12: kaks sama vestluse päringut vastupidises lahendumisjärjekorras ---

test("vanem päring EI kirjuta, kui uuem on juba alanud — ka siis, kui ta lõpetab hiljem", async () => {
  const generation = createRequestGeneration();
  const writes = [];

  // Kaks laadimist, mille lahendumine on VASTUPIDINE nende alustamisele.
  const run = async (label, delayMs) => {
    const token = generation.next();
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    if (!generation.isCurrent(token)) return;
    writes.push(label);
  };

  const older = run("vana", 30); // algab esimesena, lõpetab viimasena
  await new Promise((resolve) => setTimeout(resolve, 5));
  const newer = run("uus", 5);
  await Promise.all([older, newer]);

  assert.deepEqual(writes, ["uus"], "kirjutada tohib ainult viimasena ALANUD päring");
});

test("järjestikused päringud kirjutavad kõik — põlvkond ei ole lukk", () => {
  const generation = createRequestGeneration();
  const first = generation.next();
  assert.equal(generation.isCurrent(first), true);
  const second = generation.next();
  assert.equal(generation.isCurrent(first), false);
  assert.equal(generation.isCurrent(second), true);
});

test("hook kasutab põlvkonda ja tühistab nii taimeri kui päringu", () => {
  const source = read("components/chat/hooks/useChatConversationState.js");

  assert.match(source, /createRequestGeneration\(\)/);
  assert.match(source, /const generation = hydrationGenerationRef\.current\.next\(\);/);
  // Mõlemad kirjutuskohad on värava taga: sisu ja lõppmärgend.
  assert.equal((source.match(/if \(!isCurrent\(\)\) return;/g) || []).length, 2);
  // Päring saab katkestussignaali …
  assert.match(source, /hydrationAbortRef\.current\?\.abort\(\)/);
  assert.match(source, /\.\.\.\(ac \? \{ signal: ac\.signal \} : \{\}\)/);
  // … ja puhastus tühistab ka ootel throttle-taimeri, mis varem üle jäi.
  assert.match(source, /throttled\.cancel\(\);[\s\S]*?refreshFromEvent\.cancel\(\);/);
  assert.match(source, /throttled\.cancel = \(\) => \{/);
});

// --- SOL-CHAT-13: ruumiloend kasutab sama lepingut mis vestlusloend ---

test("shouldSettleRequest lubab kirjutada ainult praegusel controlleril", () => {
  const current = { id: "uus" };
  assert.equal(shouldSettleRequest(current, current), true);
  assert.equal(shouldSettleRequest(current, { id: "vana" }), false);
});

test("ruumide laadimine kasutab sama omandi-, abort- ja vealepingut mis vestlusloend", () => {
  const source = read("components/ChatSidebar.jsx");
  const roomsStart = source.indexOf("const fetchRooms = useCallback");
  const roomsEnd = source.indexOf("}, [resolveErrorMessage, t]);", roomsStart);
  assert.ok(roomsStart > 0 && roomsEnd > roomsStart);
  const rooms = source.slice(roomsStart, roomsEnd);

  // Tulemuse kirjutamine, veaseis ja busy-lõpetamine — kõik kolm värava taga.
  assert.equal((rooms.match(/shouldSettleRequest\(roomsAbortRef\.current, ac\)/g) || []).length, 3);
  // Tõrge ei ole enam ainult console'i rida.
  assert.match(rooms, /setRoomsError\(/);
  assert.ok(!/console\.warn\("Rooms load failed:/.test(rooms), "vaikne logi oli leid ise");
  // Tingimusteta busy-lõpetamine oli see, mis võõra laadimisindikaatori kustutas.
  assert.ok(!/\}\s*finally\s*\{\s*if \(roomsAbortRef\.current === ac\) roomsAbortRef\.current = null;\s*setRoomsBusy\(false\);/.test(rooms));

  // Ruumivaates näidatakse ruumide viga, mitte vestlusloendi oma.
  assert.match(source, /const currentError = isConversationView \? error : roomsError;/);
  assert.match(source, /listState = resolveListState\(\{[\s\S]*?error: currentError/);
  // Retry on nüüd mõlemal vaatel.
  assert.match(source, /isConversationView \? fetchList\(\{ reset: true \}\) : fetchRooms\(\)/);
});
