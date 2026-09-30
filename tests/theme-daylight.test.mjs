import assert from "node:assert/strict";
import test from "node:test";

import { isEstonianDaytime, resolveThemePreference } from "../lib/themeDaylight.js";

// Tallinna päikesetõus ja -loojang (UTC), avalikest päikesetabelitest.
// Kontrollime 10 minutit enne ja pärast piiri: täpsus on ~1–2 minutit.
const cases = [
  { day: "2026-09-30", rise: "04:22", set: "16:02" },
  { day: "2026-12-21", rise: "07:18", set: "13:21" },
  { day: "2026-06-21", rise: "01:04", set: "19:43" },
  { day: "2026-03-20", rise: "04:23", set: "16:33" },
];

function shift(day, hhmm, minutes) {
  return new Date(Date.parse(`${day}T${hhmm}:00Z`) + minutes * 60000);
}

for (const { day, rise, set } of cases) {
  test(`${day}: tume enne tõusu, hele päeval, tume pärast loojangut`, () => {
    assert.equal(isEstonianDaytime(shift(day, rise, -10)), false);
    assert.equal(isEstonianDaytime(shift(day, rise, 10)), true);
    assert.equal(isEstonianDaytime(shift(day, set, -10)), true);
    assert.equal(isEstonianDaytime(shift(day, set, 10)), false);
    assert.equal(isEstonianDaytime(shift(day, "23:30", 0)), false);
  });
}

test("eelistus lahendub nähtavaks teemaks", () => {
  const noon = new Date("2026-12-21T10:00:00Z");
  const night = new Date("2026-12-21T20:00:00Z");
  assert.equal(resolveThemePreference("auto", noon), "light");
  assert.equal(resolveThemePreference("auto", night), "mid");
  assert.equal(resolveThemePreference("light", night), "light");
  assert.equal(resolveThemePreference("dark", noon), "dark");
  assert.equal(resolveThemePreference("night", noon), "mid");
  assert.equal(resolveThemePreference(undefined, noon), "mid");
});

test("funktsioon on isemajandav: töötab ka lähtetekstist (teema-init skript)", () => {
  const rebuilt = new Function(`return (${isEstonianDaytime.toString()});`)();
  const noon = new Date("2026-09-30T10:00:00Z");
  const night = new Date("2026-09-30T22:00:00Z");
  assert.equal(rebuilt(noon), true);
  assert.equal(rebuilt(night), false);
});
