import assert from "node:assert/strict";
import test from "node:test";

import { assembleRetrievalContext } from "@/lib/chat/retrievalContextAssembler";

// B0b: ahel search error -> ragSearchFailed -> rag_error -> no_context.
// Kasutab assembler'i minimaalset DI-liidest; tootmise 12 s timeout't ei puuduta.

function abortError() {
  return Object.assign(new Error("This operation was aborted"), { name: "AbortError" });
}

async function runAssembler({ searchImpl }) {
  const events = [];
  const errors = [];
  const result = await assembleRetrievalContext({
    payloadAudience: null,
    normalizedRole: "SOCIAL_WORKER",
    rawHistory: [],
    effectiveMessage: "Kas Jõhvi vallas saab isikliku abistaja teenust?",
    forceSources: true,
    forcedMode: null,
    hasHistory: false,
    replyLang: "et",
    ephemeralChunks: [],
    ephemeralSource: null,
    combineSources: false,
    userId: "test-user",
    convId: null,
    isCrisis: false,
    logInfo: () => {},
    logError: (name, payload) => errors.push({ name, payload }),
    logEvent: async (event, payload) => {
      events.push({ event, payload });
    },
    buildMissingMunicipalityInstruction: () => null,
    buildSourceLookupInstruction: () => null,
    docContextBudgets: {},
    searchRagQueriesImpl: searchImpl
  });
  return { result, events, errors };
}

test("abortitud otsing seab ragSearchFailed=true ja logib rag_error", async () => {
  const { result, events } = await runAssembler({
    searchImpl: async () => {
      throw abortError();
    }
  });

  assert.equal(result.retrievalMeta.ragSearchFailed, true);

  const ragError = events.find(e => e.event === "rag_error");
  assert.ok(ragError, "rag_error sündmust ei logitud");
  assert.match(String(ragError.payload.error_message || ""), /aborted/i);
  assert.equal(ragError.payload.stage, "rag_search");
});

test("edukas nulltulemusega otsing jätab ragSearchFailed=false ega logi rag_error'it", async () => {
  const { result, events } = await runAssembler({
    searchImpl: async () => []
  });

  assert.equal(result.retrievalMeta.ragSearchFailed, false);
  assert.equal(result.retrievalMeta.rawMatchesCount, 0);
  assert.equal(events.find(e => e.event === "rag_error"), undefined);
});

test("edukas tulemusega otsing ei muutu ja ragSearchFailed jääb false", async () => {
  const { result } = await runAssembler({
    searchImpl: async () => [
      {
        id: "chunk-1",
        doc_id: "kov-rt-johvi-vald",
        title: "Jõhvi vald - Isikliku abistaja teenus",
        text: "Isikliku abistaja teenuse eesmärk on suurendada iseseisvat toimetulekut.",
        retriever: "dense"
      }
    ]
  });

  assert.equal(result.retrievalMeta.ragSearchFailed, false);
  assert.ok(result.retrievalMeta.rawMatchesCount >= 1);
});

test("rag_error koorem ei sisalda paringu ega allika sisu", async () => {
  const { events } = await runAssembler({
    searchImpl: async () => {
      throw abortError();
    }
  });
  const ragError = events.find(e => e.event === "rag_error");
  const serialized = JSON.stringify(ragError.payload);
  for (const secret of ["Jõhvi vallas saab", "isikliku abistaja teenust"]) {
    assert.ok(!serialized.includes(secret), `lekkis: ${secret}`);
  }
});

test("rag_error sündmus mahub redactObject 30-võtme piirangu alla", async () => {
  const { events } = await runAssembler({
    searchImpl: async () => {
      throw abortError();
    }
  });
  const ragError = events.find(e => e.event === "rag_error");
  assert.ok(
    Object.keys(ragError.payload).length <= 30,
    `rag_error võtmeid: ${Object.keys(ragError.payload).length}`
  );
});
