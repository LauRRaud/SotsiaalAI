import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("best-practices carousel card opens the completed page without a stale coming-soon state", async () => {
  const source = await readFile(
    new URL("../../components/room/RoomStage.jsx", import.meta.url),
    "utf8"
  );
  const card = source.match(
    /\{\s*key: "praktikad",(?<body>[\s\S]*?)\n\s*\},/u
  )?.groups?.body || "";

  assert.match(card, /href: "\/parimad-praktikad"/u);
  assert.doesNotMatch(card, /comingSoon|kovision_practices_building/u);
  assert.match(source, /key: "ruum"[\s\S]*href: "\/kovisioon"/u);
  assert.match(source, /key: "lopetatud"[\s\S]*href: "\/lopetatud-juhtumid"/u);
});

test("topic-seeds navigation links to the completed best-practices page", async () => {
  const source = await readFile(new URL("../../components/teemaseeme/TeemaseemnedPage.jsx", import.meta.url), "utf8");
  assert.match(source, /<Link className="ts-nav-link" href="\/parimad-praktikad">/u);
  assert.doesNotMatch(source, /Parimad praktikad · ehitamisel/u);
});
