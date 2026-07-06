import test from "node:test";
import assert from "node:assert/strict";

import { detectCrisis, isGreeting } from "../../lib/chat/safety.js";

const CRISIS_PHRASES = [
  "Ma ei jaksa enam elada, mida teha?",
  "ei taha enam elada",
  "Ma ei suuda enam elada",
  "ei jõua enam elada",
  "tahan surra",
  "tahaks surra",
  "Ma ei näe elul mõtet",
  "ei näe enam mõtet elada",
  "elul pole enam mõtet",
  "võtan endalt elu",
  "lõpetan oma elu",
  "mõtlen enesetapule, enesetapp tundub ainus väljapääs",
  "appi!"
];

const NON_CRISIS_PHRASES = [
  "Ma ei jaksa enam seda tööd teha",
  "Klient ütles, et ei jaksa enam hoolduskoormusega",
  "Millised on Kuusalu valla koduteenuse tingimused?",
  "Mis ütleb SHS § 42?",
  "tere",
  "Kuidas elada tervislikumalt?"
];

test("crisis phrases are detected", () => {
  for (const phrase of CRISIS_PHRASES) {
    assert.equal(detectCrisis(phrase), true, `should detect crisis: "${phrase}"`);
  }
});

test("non-crisis phrases are not flagged", () => {
  for (const phrase of NON_CRISIS_PHRASES) {
    assert.equal(detectCrisis(phrase), false, `should not flag: "${phrase}"`);
  }
});

test("crisis text is never treated as a greeting", () => {
  assert.equal(isGreeting("Ma ei jaksa enam elada"), false);
  assert.equal(isGreeting("tere"), true);
});
