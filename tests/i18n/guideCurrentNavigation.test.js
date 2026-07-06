import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const messages = JSON.parse(
  readFileSync(new URL("../../messages/et.json", import.meta.url), "utf8")
);

function getMessage(path) {
  return path.split(".").reduce((value, key) => value?.[key], messages);
}

const guideBodies = [
  "about.guide.sections_v2.home.body",
  "about.guide.sections_v2.chat.body",
  "about.guide.sections_v2.about.body",
  "about.guide.sections_v2.before_use.body",
  "about.guide.sections_v2.quickstart.body"
].map(getMessage);

test("guide describes current home links instead of the removed links circle", () => {
  const homeGuide = getMessage("about.guide.sections_v2.home.body");
  const aboutGuide = getMessage("about.guide.sections_v2.about.body");
  const beforeUseGuide = getMessage("about.guide.sections_v2.before_use.body");

  assert.match(homeGuide, /Meist-paneel/i);
  assert.match(homeGuide, /Võimalused/i);
  assert.match(homeGuide, /Hinnastus/i);
  assert.match(aboutGuide, /kiirlingid/i);
  assert.match(beforeUseGuide, /Hinnastus/i);

  for (const body of guideBodies) {
    assert.doesNotMatch(body, /linkide ring/i);
  }
});

test("guide describes current chat rails and compact plus menu", () => {
  const chatGuide = getMessage("about.guide.sections_v2.chat.body");

  assert.match(chatGuide, /Vasak ikooniriba/i);
  assert.match(chatGuide, /Parem ikooniriba/i);
  assert.match(chatGuide, /Töölaud/i);
  assert.match(chatGuide, /Abisoov/);
  assert.match(chatGuide, /Abipakkumine/);
  assert.match(chatGuide, /Süvauuring/);
  assert.match(chatGuide, /Dokumendi analüüs/);
  assert.doesNotMatch(chatGuide, /Dokumendi koostamine.*Plussmärk/s);
  assert.doesNotMatch(chatGuide, /Dokumendid.*Plussmärk/s);
});
