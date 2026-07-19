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

// E1: fail-closed inglise ja vene kriisimustrid.
const CRISIS_PHRASES_EN = [
  "I want to kill myself",
  "I am thinking about suicide",
  "I feel suicidal",
  "I don't want to live anymore",
  "I want to die",
  "I wish I were dead",
  "there is no reason to live",
  "I keep cutting myself",
  "I might hurt myself tonight",
  "we are in immediate danger",
  "he is threatening to kill me",
  "my child is being abused",
  "this is child abuse"
];

const CRISIS_PHRASES_RU = [
  "я хочу покончить с собой",
  "думаю про суицид",
  "не хочу больше жить",
  "не могу так жить",
  "жить не хочется",
  "хочу убить себя",
  "я режу себя",
  "он меня избивает",
  "мне сейчас небезопасно",
  "ребёнок в опасности",
  "ребенок в опасности"
];

const NON_CRISIS_PHRASES_EN = [
  "I can't handle this workload anymore",
  "What child protection services are available in Tartu?",
  "Where can a client report domestic violence?",
  "This bug is killing my motivation",
  "I'm dying to try the new feature",
  "How can I help someone who feels unsafe at home?"
];

const NON_CRISIS_PHRASES_RU = [
  "Какие услуги доступны при домашнем насилии?",
  "Ребёнок пошёл в школу",
  "Я устал на работе",
  "Не хочу идти на работу сегодня",
  "Как получить помощь в кризисной ситуации для клиента?"
];

test("crisis phrases are detected", () => {
  for (const phrase of CRISIS_PHRASES) {
    assert.equal(detectCrisis(phrase), true, `should detect crisis: "${phrase}"`);
  }
});

test("English crisis phrases are detected", () => {
  for (const phrase of CRISIS_PHRASES_EN) {
    assert.equal(detectCrisis(phrase), true, `should detect EN crisis: "${phrase}"`);
  }
});

test("Russian crisis phrases are detected", () => {
  for (const phrase of CRISIS_PHRASES_RU) {
    assert.equal(detectCrisis(phrase), true, `should detect RU crisis: "${phrase}"`);
  }
});

test("non-crisis phrases are not flagged", () => {
  for (const phrase of NON_CRISIS_PHRASES) {
    assert.equal(detectCrisis(phrase), false, `should not flag: "${phrase}"`);
  }
});

test("English non-crisis phrases are not flagged", () => {
  for (const phrase of NON_CRISIS_PHRASES_EN) {
    assert.equal(detectCrisis(phrase), false, `should not flag EN: "${phrase}"`);
  }
});

test("Russian non-crisis phrases are not flagged", () => {
  for (const phrase of NON_CRISIS_PHRASES_RU) {
    assert.equal(detectCrisis(phrase), false, `should not flag RU: "${phrase}"`);
  }
});

test("crisis text is never treated as a greeting", () => {
  assert.equal(isGreeting("Ma ei jaksa enam elada"), false);
  assert.equal(isGreeting("tere"), true);
});
