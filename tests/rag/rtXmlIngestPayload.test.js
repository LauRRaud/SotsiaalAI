import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRtXmlIngestPayload
} from "../../lib/admin/rag/kov/rtXml.js";

const municipalXml = `<?xml version="1.0" encoding="UTF-8"?>
<oigusakt>
  <metaandmed>
    <valjaandja>Jõgeva Vallavolikogu</valjaandja>
    <dokumentLiik>määrus</dokumentLiik>
    <tekstiliik>terviktekst</tekstiliik>
    <globaalID>406112024020</globaalID>
    <avaldamismarge><aktViide>406112024020</aktViide></avaldamismarge>
    <kehtivus><kehtivuseAlgus>2024-11-06</kehtivuseAlgus></kehtivus>
  </metaandmed>
  <aktinimi><nimi><pealkiri>Jõgeva valla sotsiaalhoolekandelise abi kord</pealkiri></nimi></aktinimi>
  <sisu>
    <paragrahv>
      <paragrahvNr>1</paragrahvNr>
      <paragrahvPealkiri>Reguleerimisala</paragrahvPealkiri>
      <loige><loigeNr>1</loigeNr><sisuTekst>Kord reguleerib sotsiaalhoolekandelise abi andmist.</sisuTekst></loige>
    </paragrahv>
  </sisu>
</oigusakt>`;

const nationalXml = `<?xml version="1.0" encoding="UTF-8"?>
<oigusakt>
  <metaandmed>
    <valjaandja>Riigikogu</valjaandja>
    <dokumentLiik>seadus</dokumentLiik>
    <tekstiliik>terviktekst</tekstiliik>
    <globaalID>130122025029</globaalID>
    <avaldamismarge><aktViide>130122025029</aktViide></avaldamismarge>
    <kehtivus><kehtivuseAlgus>2025-01-30</kehtivuseAlgus><kehtivuseLopp>2026-12-31</kehtivuseLopp></kehtivus>
  </metaandmed>
  <aktinimi><nimi><pealkiri>Sotsiaalhoolekande seadus</pealkiri></nimi></aktinimi>
  <sisu>
    <peatykk>
      <peatykkNr>8</peatykkNr>
      <peatykkPealkiri>Abi vajavale isikule</peatykkPealkiri>
      <jagu>
        <kuvatavNr>8. jagu</kuvatavNr>
        <jaguPealkiri>Toimetulekutoetus</jaguPealkiri>
        <paragrahv><paragrahvNr>131</paragrahvNr><paragrahvPealkiri>Toimetulekutoetus</paragrahvPealkiri><loige><loigeNr>1</loigeNr><sisuTekst>Toimetulekutoetus on riigi rahaline abi.</sisuTekst></loige></paragrahv>
        <paragrahv><paragrahvNr>132</paragrahvNr><paragrahvPealkiri>Toimetulekutoetuse taotlemine</paragrahvPealkiri><loige><loigeNr>1</loigeNr><sisuTekst>Taotlus esitatakse kohaliku omavalitsuse üksusele.</sisuTekst></loige></paragrahv>
        <paragrahv><paragrahvNr>133</paragrahvNr><paragrahvPealkiri>Toimetulekutoetuse arvestamise alused</paragrahvPealkiri><loige><loigeNr>1</loigeNr><sisuTekst>Arvestamisel võetakse aluseks sissetulekud.</sisuTekst></loige></paragrahv>
        <paragrahv><paragrahvNr>134</paragrahvNr><paragrahvPealkiri>Toimetulekutoetuse määramine ja maksmine</paragrahvPealkiri><loige><loigeNr>1</loigeNr><sisuTekst>Toetus määratakse ja makstakse seaduses sätestatud korras.</sisuTekst></loige></paragrahv>
      </jagu>
    </peatykk>
  </sisu>
</oigusakt>`;

test("auto-detects municipal RT XML as KOV regulation", () => {
  const payload = buildRtXmlIngestPayload({
    xmlText: municipalXml,
    sourceFile: "406112024020.xml",
    sourcePath: "KOV/Jogeva/jogeva-vald/406112024020.xml",
    sourceUrl: "https://www.riigiteataja.ee/akt/406112024020",
    docId: "jogeva-vald-rt-406112024020"
  });

  assert.equal(payload.doc_id, "jogeva-vald-rt-406112024020");
  assert.equal(payload.metadata.source_type, "kov_regulation");
  assert.equal(payload.metadata.collection_id, "kov_regulations");
  assert.equal(payload.metadata.jurisdiction_level, "MUNICIPALITY");
  assert.equal(payload.metadata.municipality_name, "Jõgeva vald");
  assert.equal(payload.metadata.municipality_id, "jogeva_vald");
  assert.equal(payload.metadata.authority, "official_legal");
  assert.equal(payload.metadata.act_reference, "406112024020");
  assert.equal(payload.chunks[0].metadata.source_type, "kov_regulation");
  assert.equal(payload.chunks[0].metadata.municipality_id, "jogeva_vald");
});

test("keeps national RT XML in national law collection", () => {
  const payload = buildRtXmlIngestPayload({
    xmlText: nationalXml,
    sourceFile: "130122025029.xml",
    sourcePath: "KOV/130122025029.xml",
    sourceUrl: "https://www.riigiteataja.ee/akt/130122025029",
    docId: "national-rt-130122025029"
  });

  assert.equal(payload.doc_id, "national-rt-130122025029");
  assert.equal(payload.metadata.source_type, "national_law");
  assert.equal(payload.metadata.collection_id, "national_regulations");
  assert.equal(payload.metadata.jurisdiction_level, "NATIONAL");
  assert.equal(payload.metadata.municipality_name, null);
  assert.equal(payload.metadata.municipality_id, undefined);
  assert.equal(payload.metadata.valid_to, "2026-12-31");
  assert.equal(payload.metadata.source_status, "active");
  assert.equal(payload.metadata.historical, false);

  const byParagraph = new Map();
  for (const chunk of payload.chunks) {
    const number = String(chunk?.metadata?.paragraph_number || "");
    if (number && !byParagraph.has(number)) byParagraph.set(number, chunk);
  }

  assert.equal(byParagraph.get("131")?.metadata?.paragraph_title, "Toimetulekutoetus");
  assert.equal(byParagraph.get("132")?.metadata?.paragraph_title, "Toimetulekutoetuse taotlemine");
  assert.equal(byParagraph.get("133")?.metadata?.paragraph_title, "Toimetulekutoetuse arvestamise alused");
  assert.equal(byParagraph.get("134")?.metadata?.paragraph_title, "Toimetulekutoetuse määramine ja maksmine");
  assert.equal(byParagraph.get("131")?.metadata?.section, "Toimetulekutoetus");
  assert.match(byParagraph.get("131")?.metadata?.title || "", /§ 131 Toimetulekutoetus/);
  assert.match(byParagraph.get("131")?.text || "", /8\. jagu - Toimetulekutoetus/);
});
