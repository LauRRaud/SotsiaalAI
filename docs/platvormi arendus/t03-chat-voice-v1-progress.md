# T03 `CHAT-VOICE-V1` — teostuse progressifail

## Alus ja stack (kohustuslik konfliktimärge)

- **Alus-SHA (T17 lõpp):** `ed95d6aa` — "Complete T17: owner-scoped personal search + plain-language reading aid".
  Kontrollitud: `origin/codex/search-language-v1` = `ed95d6aa` (remote == lokaalne).
- **Worktree:** `C:\Users\rauds\Desktop\SotsiaalAI-chat-voice-v1`, haru `codex/chat-voice-v1` (loodud `origin/codex/search-language-v1` headist).
- **VEST-P0 cherry-pick:** algne `ef01fc42e77511c0a6a931358ef8df3fa722ca9a` → uus `80107cbf` (`cherry-pick -x`).
- **VEST-P0a cherry-pick:** algne `043f0dce5b9c08e5a017f63009b293aa039dc308` → uus `96eef909` (`cherry-pick -x`).

### Konfliktid

Kumbki cherry-pick **ei tekitanud konflikti** — git auto-merge lahendas kattuvad failid
(`messages/{et,en,ru}.json`, `app/api/chat/route.js`, `components/chat/hooks/useChatStream.js`).

### Säilitatud T17/U7 muudatused (kontrollitud pärast merge'i)

- **U7 selge keel (T17):** `messages/*` võtmed `Selge keel`, `Kasuta selge keele režiimi`,
  `Selge keele režiim on sees`, teenuseosutaja `simple_language` — kõik alles.
- **VEST-P0/P0a kriis:** `crisis.notice`, `crisis_no_context`, `crisis_detected` jt — kõik alles.
- **JSON valiidsus:** kõik kolm `messages/*.json` parse'uvad.
- **Testid:** `tests/chat/crisisFailsafe.test.js` + `tests/chat/crisisEmptyProviderFallback.test.js`
  → 16/16 pass baasstacki peal (enne uut tööd).

## Teostuse seis (E1–E5)

- [x] E1 — kriis igas vestluse harus. `detectCrisis` ET jäi muutmata; lisatud EN + RU fail-closed
  regexgrupid (kirillitsa ilma ASCII-`\b`-ta). +2 positiivset (EN/RU) ja +2 negatiivset (EN/RU)
  testiplokki `tests/chat/safety.test.js` (7/7 pass). Kriis voolab `isCrisis` kaudu ühest kohast
  (`requestBootstrap` r290) tava-, abi- ja dokumenditöövoogu (workflowBranchHandlers r83/98/281/296).
  Banner `role="alert"` on olemas (`ChatNotices.jsx` r61), on eraldi determinstlik UI → U7 ei kirjuta
  ega paiguta seda ümber; PLAIN_LANGUAGE_MODE tekst juba lubab "olulised hoiatused jäävad alles".
- [ ] E2 — aus pöörde elutsükkel, Stop (server-abort), Retry (retryOf, idempotentne)
- [ ] E3 — 4000-piir + 413, jagatud `isFreeHelpWorkflowEligible`, töövoo eelvaade→kinnitus, PII-võtmed
- [ ] E4 — hääl: TTS locale server/fallback aus viga, STT discard + 2,5 min piir + taimeripuhastus
- [ ] E5 — a11y/keeled/jõudlus: klaviatuur, reduced-motion, ET/EN/RU sümmeetria, reservatsioonileping

## Verifitseerimine

- [ ] T03 sihttestid
- [ ] muudetud failide lint
- [ ] `npm run i18n:check`
- [ ] Prisma validate (+ migrate:check kui skeem muutub)
- [ ] `git diff --check`
- [ ] production build
- [ ] sünteetiline runtime (või aus NOT_RUN/NOT_PROVEN)
