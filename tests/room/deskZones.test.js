import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CLIENT_ZONE,
  WELLBEING_ZONE,
  WELLBEING_ZONES,
  WORKSPACE_ZONES,
  workspaceZonesForRole
} from "../../lib/deskZones.js";
import { wellbeingTools } from "../../lib/wellbeingTools.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const messagesDir = path.resolve(here, "..", "..", "messages");

const allZoneIds = [
  ...new Set([...Object.values(WORKSPACE_ZONES).flat(), ...WELLBEING_ZONES])
];

/* Sügavuslaual EI OLE lehitsemist: kaart, mille tsooni ei ole olemas,
   maandub GlassCarouselis viimasele astmele ja jääb vaikselt valesse
   kohta. Neid vaikimisi eksimusi püüavad järgmised kolm testi. */

test("iga tööheaolu tööriist kuulub täpselt ühte astmesse", () => {
  for (const tool of wellbeingTools) {
    const zone = WELLBEING_ZONE[tool.id];
    assert.ok(zone, `tööriistal "${tool.id}" puudub tsoon`);
    assert.ok(
      WELLBEING_ZONES.includes(zone),
      `tööriist "${tool.id}" viitab tundmatule tsoonile "${zone}"`
    );
  }
});

test("WELLBEING_ZONE ei nimeta tööriistu, mida enam ei ole", () => {
  const known = new Set(wellbeingTools.map((tool) => tool.id));
  for (const id of Object.keys(WELLBEING_ZONE)) {
    assert.ok(known.has(id), `WELLBEING_ZONE viitab kadunud tööriistale "${id}"`);
  }
});

test("kliendi kaardid maanduvad kliendi enda astmetele", () => {
  const clientZones = workspaceZonesForRole("CLIENT");
  for (const [key, zone] of Object.entries(CLIENT_ZONE)) {
    assert.ok(
      clientZones.includes(zone),
      `kliendi kaart "${key}" viitab tsoonile "${zone}", mida kliendi laual ei ole`
    );
  }
});

test("tundmatu roll saab kliendi vaate, mitte tühja laua", () => {
  assert.deepEqual(workspaceZonesForRole("MIDAGI_MUUD"), WORKSPACE_ZONES.CLIENT);
  assert.deepEqual(workspaceZonesForRole(null), WORKSPACE_ZONES.CLIENT);
  assert.deepEqual(workspaceZonesForRole("social_worker"), WORKSPACE_ZONES.SOCIAL_WORKER);
});

test("igal astmel on nimi KÕIGIS keeltes", async () => {
  for (const locale of ["et", "en", "ru"]) {
    const raw = await readFile(path.join(messagesDir, `${locale}.json`), "utf8");
    const zones = JSON.parse(raw)?.room?.zones || {};
    for (const id of allZoneIds) {
      assert.ok(zones[id], `${locale}: puudub room.zones.${id}`);
      /* Tühi silt tähendaks laual nimetut astet — see peab failima
         siin, mitte kasutaja ekraanil. */
      assert.ok(
        String(zones[id].name || "").trim(),
        `${locale}: room.zones.${id}.name on tühi`
      );
    }
  }
});

test("i18n ei kanna astmeid, mida laual enam ei ole", async () => {
  const raw = await readFile(path.join(messagesDir, "et.json"), "utf8");
  const zones = Object.keys(JSON.parse(raw)?.room?.zones || {});
  for (const id of zones) {
    assert.ok(allZoneIds.includes(id), `room.zones.${id} on orb — ükski laud ei kasuta`);
  }
});
