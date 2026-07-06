import test from "node:test";
import assert from "node:assert/strict";

import { langStrings, toResponsesInput } from "../../lib/chat/promptBuilder.js";

test("uses short natural Estonian greetings", () => {
  const client = langStrings("et", "CLIENT");
  const worker = langStrings("et", "SOCIAL_WORKER");

  assert.equal(client.greetingClient, "Tere! Mis küsimusega saan aidata?");
  assert.equal(worker.greetingWorker, "Tere! Mis teemaga saan aidata?");
});

test("uses short natural English and Russian greetings", () => {
  const enClient = langStrings("en", "CLIENT");
  const enWorker = langStrings("en", "SOCIAL_WORKER");
  const ruClient = langStrings("ru", "CLIENT");
  const ruWorker = langStrings("ru", "SOCIAL_WORKER");

  assert.equal(enClient.greetingClient, "Hello! How can I help?");
  assert.equal(enWorker.greetingWorker, "Hello! What topic can I help with?");
  assert.equal(ruClient.greetingClient, "Здравствуйте! Чем могу помочь?");
  assert.equal(ruWorker.greetingWorker, "Здравствуйте! С какой темой могу помочь?");
});

test("worker no-context fallback is not municipality-only", () => {
  const worker = langStrings("et", "SOCIAL_WORKER");

  assert.match(worker.noContext, /teemat/);
  assert.match(worker.noContext, /allikatüüpi/);
  assert.match(worker.noContext, /vajadusel omavalitsust/);
  assert.doesNotMatch(worker.noContext, /Palun täpsusta KOV või omavalitsus/);
});

test("Estonian base prompt discourages search-status phrasing in ordinary answers", () => {
  const input = toResponsesInput({
    history: [],
    userMessage: "mis on võimaluste kohvik?",
    context: "(1) Võimaluste kohvik pakub toetavat töövõimalust.",
    effectiveRole: "SOCIAL_WORKER",
    grounding: "strong",
    replyLang: "et"
  });

  const system = input.input[0].content;

  assert.match(system, /Kirjuta nagu abivalmis spetsialist/);
  assert.match(system, /Ära kasuta vestlusvastuses Markdowni pealkirjamärke/);
  assert.match(system, /Ära alusta tavavastust allika- või otsingustaatusega/);
  assert.match(system, /Ära kasuta lõppvastuses väljendeid/);
  assert.match(system, /Praegu kasutatud allikad ei anna sellele piisavalt täpset vastust/);
  assert.match(system, /Ma ei leidnud praeguse otsinguga sellele piisavalt täpset õiguslikku allikakinnitust/);
  assert.match(system, /Ära väida, et midagi ei eksisteeri ainult seetõttu/);
  assert.doesNotMatch(system, /Sõnasta loomulikult: "leidsin allikatest"/);
});

test("Estonian base prompt requires time context for older projects", () => {
  const input = toResponsesInput({
    history: [],
    userMessage: "mis on võimaluste kohvik?",
    context: "(1) Võimaluste kohvik. source_year=2016\nProjekt lõi toetava töökoha.",
    effectiveRole: "SOCIAL_WORKER",
    grounding: "strong",
    replyLang: "et"
  });

  const system = input.input[0].content;

  assert.match(system, /source_year näitavad, et tegu oli varasema projekti/);
  assert.match(system, /kasuta õiget ajavormi/);
  assert.match(system, /Ära kirjelda vana projekti .* praegu tegutseva teenusena/);
});

test("English and Russian base prompts discourage search-status phrasing in ordinary answers", () => {
  const enInput = toResponsesInput({
    history: [],
    userMessage: "what is the opportunities cafe?",
    context: "(1) The opportunities cafe provides supported work.",
    effectiveRole: "SOCIAL_WORKER",
    grounding: "strong",
    replyLang: "en"
  });
  const ruInput = toResponsesInput({
    history: [],
    userMessage: "что такое кафе возможностей?",
    context: "(1) Кафе возможностей предоставляет поддерживаемую работу.",
    effectiveRole: "SOCIAL_WORKER",
    grounding: "strong",
    replyLang: "ru"
  });

  assert.match(enInput.input[0].content, /Write like a helpful specialist/);
  assert.match(enInput.input[0].content, /Do not use Markdown heading markers/);
  assert.match(enInput.input[0].content, /Do not start an ordinary answer with source- or search-status phrasing/);
  assert.doesNotMatch(enInput.input[0].content, /Phrase it naturally: "I found in the sources"/);

  assert.match(ruInput.input[0].content, /Пиши как внимательный специалист/);
  assert.match(ruInput.input[0].content, /Не используй в ответах Markdown-маркеры заголовков/);
  assert.match(ruInput.input[0].content, /Не начинай обычный ответ с фраз о статусе источников или поиска/);
  assert.doesNotMatch(ruInput.input[0].content, /Формулируй естественно: "я нашел в источниках"/);
});

test("English and Russian base prompts require time context for older projects", () => {
  const enInput = toResponsesInput({
    history: [],
    userMessage: "what is the opportunities cafe?",
    context: "(1) Opportunities cafe. source_year=2016\nThe project created supported work.",
    effectiveRole: "SOCIAL_WORKER",
    grounding: "strong",
    replyLang: "en"
  });
  const ruInput = toResponsesInput({
    history: [],
    userMessage: "что такое кафе возможностей?",
    context: "(1) Кафе возможностей. source_year=2016\nПроект создал поддерживаемую работу.",
    effectiveRole: "SOCIAL_WORKER",
    grounding: "strong",
    replyLang: "ru"
  });

  assert.match(enInput.input[0].content, /source_year shows that this was an earlier project/);
  assert.match(enInput.input[0].content, /use the correct tense/);
  assert.match(enInput.input[0].content, /Do not describe an old project .* currently operating service/);
  assert.match(ruInput.input[0].content, /source_year, показывают, что это был более ранний проект/);
  assert.match(ruInput.input[0].content, /используй правильное время/);
  assert.match(ruInput.input[0].content, /Не описывай старый проект .* как действующую сейчас услугу/);
});

test("weak grounding instruction avoids old source-summary lead-in", () => {
  const input = toResponsesInput({
    history: [],
    userMessage: "mis muutus?",
    context: "(1) Katkend ühest allikast.",
    effectiveRole: "CLIENT",
    grounding: "weak",
    replyLang: "et"
  });

  const weakGrounding = input.input.find(
    item => item.role === "system" && item.content.includes("RAG_GROUNDING: weak.")
  );

  assert.ok(weakGrounding);
  assert.doesNotMatch(weakGrounding.content, /Leitud RAG-kontekst/);
  assert.doesNotMatch(weakGrounding.content, /Sõnasta järeldused/);
  assert.match(weakGrounding.content, /ära ava seda tehnilise allika- või otsingustaatuse fraasiga/);
});

test("English and Russian weak grounding instructions avoid old source-summary lead-ins", () => {
  const enInput = toResponsesInput({
    history: [],
    userMessage: "what changed?",
    context: "(1) A passage from one source.",
    effectiveRole: "CLIENT",
    grounding: "weak",
    replyLang: "en"
  });
  const ruInput = toResponsesInput({
    history: [],
    userMessage: "что изменилось?",
    context: "(1) Фрагмент из одного источника.",
    effectiveRole: "CLIENT",
    grounding: "weak",
    replyLang: "ru"
  });
  const enWeakGrounding = enInput.input.find(
    item => item.role === "system" && item.content.includes("RAG_GROUNDING: weak.")
  );
  const ruWeakGrounding = ruInput.input.find(
    item => item.role === "system" && item.content.includes("RAG_GROUNDING: weak.")
  );

  assert.ok(enWeakGrounding);
  assert.ok(ruWeakGrounding);
  assert.doesNotMatch(enWeakGrounding.content, /retrieved RAG context/);
  assert.doesNotMatch(enWeakGrounding.content, /Frame conclusions/);
  assert.doesNotMatch(enWeakGrounding.content, /visible sources/);
  assert.match(enWeakGrounding.content, /the current search could confirm/);
  assert.match(enWeakGrounding.content, /do not open with technical source- or search-status phrasing/);
  assert.doesNotMatch(ruWeakGrounding.content, /Найденный RAG-контекст/);
  assert.doesNotMatch(ruWeakGrounding.content, /Формулируй выводы/);
  assert.match(ruWeakGrounding.content, /не начинай с технических фраз о статусе источников или поиска/);
});
