import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { reconcileSuggestedActionTitles } from "../../lib/journey/suggestedActions.js";
import { normalizeJourneyUpdateInput } from "../../lib/journey/validation.js";

const detailSource = await readFile(
  new URL("../../components/journey/JourneyDetail.jsx", import.meta.url),
  "utf8"
);

test("SOL-JOUR-04: editing only a title preserves machine-readable action fields", () => {
  const existing = [
    {
      id: "action-service-map",
      type: "SERVICE_MAP",
      title: "Ava teenusekaart",
      description: "Leia sobiv kohalik teenus."
    },
    {
      id: "action-health",
      type: "HEALTH_CONTACT",
      title: "Võta ühendust tervishoiuga",
      description: "Koosta tervisekontakti küsimused."
    }
  ];

  const reconciled = reconcileSuggestedActionTitles(
    existing,
    "Ava kohalike teenuste kaart\nVõta ühendust tervishoiuga"
  );
  const normalized = normalizeJourneyUpdateInput({ suggestedActions: reconciled });

  assert.deepEqual(normalized.suggestedActions, [
    { ...existing[0], title: "Ava kohalike teenuste kaart" },
    existing[1]
  ]);
});

test("SOL-JOUR-04: insertion or deletion never moves metadata to another action", () => {
  const existing = [
    { id: "first", type: "SERVICE_MAP", title: "Teenusekaart", description: "A" },
    { id: "second", type: "HEALTH_CONTACT", title: "Tervisekontakt", description: "B" }
  ];

  assert.deepEqual(
    reconcileSuggestedActionTitles(existing, "Uus käsitsi lisatud samm\nTeenusekaart\nTervisekontakt"),
    [
      { title: "Uus käsitsi lisatud samm" },
      existing[0],
      existing[1]
    ]
  );

  assert.deepEqual(
    reconcileSuggestedActionTitles(existing, "Tervisekontakt"),
    [existing[1]]
  );
});

test("SOL-JOUR-04: the ordinary detail save uses metadata-preserving reconciliation", () => {
  assert.match(
    detailSource,
    /suggestedActions:\s*reconcileSuggestedActionTitles\(journey\?\.suggestedActions, form\.suggestedActions\)/u
  );
  assert.doesNotMatch(detailSource, /function textToActions/u);
});
