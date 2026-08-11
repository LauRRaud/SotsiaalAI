import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

/**
 * SOL-CHAT-08 — valmis analüüsi ei tohi commit'i viga ära visata.
 *
 * Vana järjekord oli: analüüs valmis → lipp `analysisCompleted = true` → commit → commit'i viga
 * läks `catch`-i, kus vabastust EI tehtud (lipp oli juba tõene) ja kasutajale läks analüüsi asemel
 * VIGA. Kaks asja korraga: tulemus kadus JA reservatsioon jäi kinni.
 */

test("analüüsi viga vabastab, commit'i viga EI vabasta ega tühista tulemust", () => {
  const source = read("app/api/chat/analyze-file/route.js");

  const produce = source.indexOf("data = await callRagAnalyze(forward)");
  const commit = source.indexOf("await commitUsageForRequest(usageHandle)");
  const respond = source.lastIndexOf("return json({");
  assert.ok(produce > 0 && commit > produce, "commit peab tulema PÄRAST tasulist tööd");
  assert.ok(respond > commit, "vastus antakse pärast arveldust");

  // Tasulise töö viga vabastab.
  assert.match(source, /catch \(e\) \{[\s\S]*?releaseUsageForRequest\(usageHandle, \{ reason: "file_analysis_failed" \}\)/);

  // Commit'i viga logitakse, aga ei vabasta ega muuda vastust veaks.
  const commitBlock = source.slice(commit, respond);
  assert.match(commitBlock, /catch \(commitError\)/);
  assert.ok(
    !/releaseUsageForRequest/.test(commitBlock),
    "commit'i vea peale vabastamine annaks tasulise tulemuse tasuta"
  );
  assert.ok(!/errorJson/.test(commitBlock), "olemasolevat tulemust ei tohi veaks muuta");

  /* Lipp, mille ümber vana viga elas, on kadunud — mitte parandatud. (Nimi esineb veel
     kommentaaris, mis leidu selgitab; mõõdame koodi, mitte teksti.) */
  assert.ok(!/analysisCompleted\s*=/.test(source), "vana lipp oli leiu mehhanism");
  assert.ok(!/!analysisCompleted/.test(source));
});

test("klient saadab failipõhise stabiilse kavatsuse võtme ja vabastab ta õnnestumisel", () => {
  const source = read("components/chat/hooks/useChatAnalysisController.js");

  assert.match(source, /resolveIntentKey\(/);
  assert.match(source, /fd\.append\("idempotencyKey", intent\.key\)/);
  // Allkiri peab sõltuma failist, mitte ainult nimest — muidu oleks „sama nimi" sama kavatsus.
  assert.match(source, /buildIntentSignature\(\{[\s\S]*?size: file\.size[\s\S]*?lastModified: file\.lastModified/);
  // Lahendatud kavatsus vabastatakse, muidu ei saaks sama faili kunagi tahtlikult uuesti analüüsida.
  assert.match(source, /analysisIntentsRef\.current\.delete\(file\.name\)/);

  const send = source.indexOf('fd.append("idempotencyKey"');
  const clear = source.indexOf("analysisIntentsRef.current.delete(");
  assert.ok(send > 0 && clear > send, "võti vabastatakse alles pärast õnnestunud vastust");
});
