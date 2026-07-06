import test from "node:test";
import assert from "node:assert/strict";

import {
  buildLegalLookupQueryEntries,
  detectLegalLookupPlan
} from "../../lib/chat/legalLookup.js";

test("municipality Riigi Teataja availability lookup targets kov_legal without fake act title filter", () => {
  const message = "kas Harku valla riigiteataja on sul?";
  const plan = detectLegalLookupPlan({
    message,
    sourceLookupRequest: true,
    effectiveMunicipalities: [
      {
        id: "harku_vald",
        displayName: "Harku vald"
      }
    ]
  });

  assert.equal(plan.enabled, true);
  assert.equal(plan.mode, "legal_source_lookup");
  assert.equal(plan.collectionId, "kov_legal");
  assert.equal(plan.sourceTypes[0], "kov_regulation");
  assert.equal(plan.municipalityId, "harku_vald");
  assert.equal(plan.actTitle, null);

  const queries = buildLegalLookupQueryEntries(plan, message);
  assert.equal(queries.length, 1);
  assert.equal(queries[0].filters.collection_id, "kov_legal");
  assert.equal(queries[0].filters.source_type, "kov_regulation");
  assert.equal(queries[0].filters.municipality_id, "harku_vald");
  assert.equal(Object.hasOwn(queries[0].filters, "act_title"), false);
  assert.match(queries[0].query, /Riigi Teataja/i);
});
