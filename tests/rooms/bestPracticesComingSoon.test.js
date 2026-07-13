import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("best-practices carousel card is marked as coming soon and has no misleading href", async () => {
  const source = await readFile(
    new URL("../../components/room/RoomStage.jsx", import.meta.url),
    "utf8"
  );
  const card = source.match(
    /\{\s*key: "praktikad",(?<body>[\s\S]*?)\n\s*\},/u
  )?.groups?.body || "";

  assert.match(card, /comingSoon: true/u);
  assert.match(card, /room\.kovision_practices_building/u);
  assert.doesNotMatch(card, /href:/u);
});

test("carousel exposes the coming-soon state and visible badge accessibly", async () => {
  const [carousel, card] = await Promise.all([
    readFile(new URL("../../components/room/GlassCarousel.jsx", import.meta.url), "utf8"),
    readFile(new URL("../../components/glass/GlassCard.jsx", import.meta.url), "utf8")
  ]);

  assert.match(carousel, /"aria-disabled": "true"/u);
  assert.match(carousel, /badge=\{item\.badge \|\| null\}/u);
  assert.match(card, /className="gc-card-badge"/u);
});
