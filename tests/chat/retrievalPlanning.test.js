import test from "node:test";
import assert from "node:assert/strict";

import { buildTemporalRetrievalPlan } from "../../lib/chat/retrievalPlanning.js";

const previousMultiYearHistory = [
  {
    role: "user",
    text: "Võrdle 2018., 2019. ja 2024. aasta dementsuse käsitlusi."
  },
  {
    role: "assistant",
    text: "2018, 2019 ja 2024 käsitlesid teemat eri rõhuasetustega."
  }
];

test("a substantive new question does not inherit years from earlier turns", () => {
  const baseQuery = "Kuidas kasutab Eesti Töötukassa OTT-süsteemi ja millised piirangud kasutajad nimetasid?";
  const plan = buildTemporalRetrievalPlan({
    message: baseQuery,
    history: previousMultiYearHistory,
    baseQuery
  });

  assert.equal(plan.enabled, false);
  assert.deepEqual(plan.years, []);
  assert.deepEqual(plan.queries, [baseQuery]);
});

test("an explicit multi-year question still creates a temporal plan", () => {
  const message = "Võrdle 2018., 2019. ja 2024. aasta dementsuse käsitlusi.";
  const plan = buildTemporalRetrievalPlan({ message, history: [], baseQuery: message });

  assert.equal(plan.enabled, true);
  assert.deepEqual(plan.years, [2018, 2019, 2024]);
});

test("an explicit reference to those years may carry temporal history", () => {
  const message = "Tee nende aastate kohta tabel.";
  const plan = buildTemporalRetrievalPlan({
    message,
    history: previousMultiYearHistory,
    baseQuery: message
  });

  assert.equal(plan.enabled, true);
  assert.deepEqual(plan.years, [2018, 2019, 2024]);
});
