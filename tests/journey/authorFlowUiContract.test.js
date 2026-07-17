import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../../app/teekond/page.jsx", import.meta.url), "utf8");
const dashboard = await readFile(new URL("../../components/journey/JourneyDashboard.jsx", import.meta.url), "utf8");
const detail = await readFile(new URL("../../components/journey/JourneyDetail.jsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../../app/styles/journey.css", import.meta.url), "utf8");

test("Journey is an independent page and composition state is URL/session based", () => {
  assert.doesNotMatch(page, /redirect\(/u);
  assert.match(page, /JourneyDashboard hideHeader/u);
  assert.match(dashboard, /sotsiaalai:journey-v1:draft/u);
  assert.match(dashboard, /searchParams\.get\("samm"\)/u);
  assert.match(dashboard, /sessionStorage\.setItem/u);
  assert.match(dashboard, /beforeunload/u);
  assert.match(dashboard, /journey-stepper/u);
  assert.match(dashboard, /journey-quick-help/u);
});

test("author flow exposes one server-backed sharing preview and reversible lifecycle actions", () => {
  assert.match(detail, /pre-inquiry-draft/u);
  assert.match(detail, /recipient_preview/u);
  assert.match(detail, /person_context_ack/u);
  assert.match(detail, /downloadJourneyText/u);
  assert.match(detail, /confirmation: "DELETE"/u);
  assert.match(detail, /status: "ACTIVE"/u);
  assert.match(detail, /showBack=\{false\}/u);
});

test("Journey styling is scrollable, mobile-safe and motion-reduced", () => {
  assert.match(styles, /overflow: auto/u);
  assert.match(styles, /max-width: 40rem/u);
  assert.match(styles, /prefers-reduced-motion/u);
});
