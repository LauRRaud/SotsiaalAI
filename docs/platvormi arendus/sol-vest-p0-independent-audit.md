# VEST-P0 kriisiraja sõltumatu audit

Kuupäev: 2026-07-16  
Verdikt: **CHANGES_REQUIRED**

## Auditi ulatus ja Git-seis

- Teostusharu: `codex/vest-p0-crisis-failsafe`
- Auditeeritud commit: `ef01fc42e77511c0a6a931358ef8df3fa722ca9a`
- Teostuscommiti parent: `2a63fcd0c822709fb013b5b9d9706e5b58f4f18c`
- Auditivahemik: `2a63fcd0c822709fb013b5b9d9706e5b58f4f18c..ef01fc42e77511c0a6a931358ef8df3fa722ca9a`
- Värske `origin/main`: `fe4eb4fa7997a7eada9417a27c6cea75ccd23cbe`
- `git merge-base --is-ancestor ef01fc42 origin/main`: **ei**; teostuscommit ei ole `origin/main`-i esivanem.

Audit tehti eraldi worktree-harus `codex/vest-p0-independent-audit`. Algne checkout oli muutunud (`app/styles/chat.css` ja koordinaatori handoff-dokument); seda ei kasutatud ega muudetud.

## Integratsioon värske main'i vastu

`git merge-tree --write-tree origin/main ef01fc42…` lõpetas puhtalt (tulemuse puu `db9d280dbd59de35e9a485e4b7a2b82323753f7c`). Eraldi ajutises integratsiooni-worktree's tehtud `git merge --no-commit --no-ff ef01fc42…` lõppes samuti konfliktideta.

Erikontroll `messages/en.json`, `messages/et.json` ja `messages/ru.json` jaoks: kõik kolm auto-merge'isid puhtalt ning ADMIN-P0.1/P0.1a värske main'i tõlked jäid alles. Lisandus vaid `chat.fallback.crisis_no_context`; tõlkevõtmete konflikt puudub.

Skeemi ega migratsioonide muudatust integratsioonis ei ole.

## Põhiküsimuste tulemus

| Kontroll | Tulemus | Tõend |
| --- | --- | --- |
| Tühi RAG/no-context kriisivastus asendub ja püsistub | PASS | Route valib `L.crisisNoCtx`; `persistDone` kirjutab tühja lõppteksti asemel fallback'i. |
| Kõik keeled sisaldavad 112; ET sisaldab 116 111 ja 116 006 | PASS | `messages/{et,en,ru}.json`, i18n-kontroll ja sihttest. |
| Tegelik `isCrisis` jõuab abi- ja dokumenditöövoogu | PASS | `route.js` annab väärtuse mõlemasse handlerisse; handlerid annavad selle edasi finalizer'ile ja vastusele. |
| HTTP 502-, stream'i-, võrgu- ja hüdratsioonivead säilitavad aktiivse hoiatuse kliendis | PASS kitsa ühikutõendi piires | `resolveCrisisStateAfterEvent` ning `resolveHydratedCrisisState` katavad need olekuüleminekud. |
| Vanem serveriseis ei kirjuta uuemat lokaalset kriisiseisu üle | PASS kitsa ühikutõendi piires | Hüdratsioon võrdleb viimast lokaalset kasutajapööret serveri vastusega. |
| Hoiatus eemaldub ainult eduka mittekriisi vastuse või vestluse vahetuse järel | PASS kitsa ühikutõendi piires | Streami `meta` ei nulli seisu; `done` ja `success` rakendavad väärtuse, vestluse vahetus nullib. |
| Tühi AI-vastus on alati ohutu kriisifallback | **FAIL — P0-1** | Mitte-tühja konteksti AI-teed kasutavad üldist veateksti, mitte kriisinumbritega fallback'i. |
| Sõnumisisu ja isikuandmed ei lisandu uude metasse | PASS teostusdiffi piires | Uus meta sisaldab ainult booleanit `isCrisis`; uut sõnumisisu ega isikuandmeid ei lisata. Boolean on teadlikult vajalik püsistatud kriisioleku taastamiseks. |
| Autentimise, limiitide, RAG-i ja töövoogude turvapiirid | PASS testitud ulatuses | Kriisi- ja kasutuslepingu komplekt läbis 15/15; skeemi/migratsioonidiff tühi. |
| Testid tõendavad kogu state-machine'i | **FAIL — P2-1** | Mitmed olulised väited on puhaste helper'ite või lähtekoodi regex-kontrollid; provider'i tühja vastuse tegelikku rada ei käivitata. |

## Leiud

### P0-1 — tühi OpenAI vastus ei saa kriisinumbritega fallback'i

**Mõju.** Kriisiklassifikatsioon jääb küll `true`, kuid kui RAG-kontekst ei ole tühi ja provider tagastab tühja väljundi või stream lõpeb ilma deltata, näeb ja püsistab kasutaja üldist ingliskeelset teadet. Selles puuduvad 112, ET lasteabi 116 111 ja ohvriabi 116 006. See rikub nõuet, et *iga* tühi AI/RAG kriisivastus asendub ohutu mittetühja fallback'iga.

**Täpsed kohad.**

- `lib/chat/openaiRuntime.js:56` teisendab tühja `output_text` väärtuseks `Sorry, I couldn't generate an answer right now.`.
- `lib/chat/mainResponseHandler.js:13` määratleb sama üldise streami-fallback'i.
- `lib/chat/mainResponseHandler.js:806-812` kasutab seda fallback'i, kui voos pole ühtki deltateksti.
- `lib/chat/persistence.js:157-159` asendab ainult sõna otseses mõttes tühja `finalText`i ET fallback'iga. Eelnev üldine string ei ole tühi ning seda ei parandata; pealegi ei saa see funktsioon `replyLang`i.

**Reproduktsioon.** Käivita kriisipäring, millel on vähemalt üks RAG-konteksti plokk, `stream: true`, ning stub'i provider nii, et see väljastab `response.completed` ilma `response.output_text.delta` sündmuseta. `finalizeStreamReply()` jõuab harusse `!accumulated.trim()` ja saadab/püsistab üldise ingliskeelse stringi. Mitte-streami ekvivalent: stub'i `responses.create()` tulemuseks `{ output_text: "" }`; `callOpenAI()` tagastab sama stringi. Kummaski vastuses ei ole `112`.

**Minimaalne parandusskoop.** Teostaja uues commit'is peab keskselt arvutama `langStrings(replyLang).crisisNoCtx` ja kasutama seda nii tühja mitte-streami provider-väljundi kui ka tühja streami lõpu korral, kui `isCrisis === true`. Samale lõppteksti väärtusele peab jõudma nii HTTP/SSE vastus kui püsistus; vajadusel anna `replyLang` ka `persistDone`i turvavõrgule. Lisa integreeritud käitumistestid ET/EN/RU jaoks mõlemale teele ja kontrolli nii vastust kui salvestatud assistendi sõnumit.

### P2-1 — state-machine'i regressioonikaitse ei kata provider'i tühja vastuse rada ning osa kinnitusest on staatiline

`tests/chat/crisisFailsafe.test.js:337-354` loeb kliendifaile `fs.readFileSync`iga ning sobitab regulaaravaldisega lähtekoodi. See ei käivita Reacti hook'i, SSE lugejat ega võrguvea/hüdratsiooni sündmuste järjestust. Teised olekuassertsioonid kutsuvad küll `resolveCrisisStateAfterEvent` ja `resolveHydratedCrisisState` helper'eid, kuid puudub test, mis ühendab `mainResponseHandler`i, tühja provider-voo, SSE `meta/done`, kliendi oleku ning püsistuse.

**Minimaalne parandusskoop.** Asenda staatilised regex-assertsioonid või täienda neid deterministliku integraatsioonitestiga, mis stub'ib provider'i ja SSE-d. Vähemalt järgmised harud peavad päriselt käivituma: tühi mitte-streami vastus, null-deltaga lõpetatud stream, stream-viga/502 pärast kriisi-meta sündmust, vana serverihüdratsioon ning sellele järgnev edukas mittekriisi `done`.

## Käivitatud kontrollid

| Kontroll | Tulemus |
| --- | --- |
| VEST-P0 kriisitestid | PASS — 11/11 |
| Kriisiraja + API kasutusleping | PASS — 15/15 |
| `npm test` | PASS — 1303/1303 |
| Muudetud sihtfailide lint | PASS — 0 viga |
| `npm run lint` | PASS — 0 viga, 358 olemasolevat hoiatust |
| `npm run i18n:check` | PASS |
| Tootmisbuild | PASS — Next.js 16.2.10 Turbopack |
| `npx prisma validate` | PASS |
| Skeemi-/migratsioonidiff | PASS — tühi |
| `git diff --check` (teostus ja integratsioon) | PASS |

Prisma käskude jaoks kasutati ainult mittetoimivat sünteetilist lokaalset `DATABASE_URL`i (`127.0.0.1:65432`); andmebaasiühendust ei avatud. Autenditud runtime-smoke'i ei saanud värskes worktree's korrata, sest selles ei ole lokaalset autentimis- ega andmebaasiseadistust. Seetõttu ei loodud sünteetilist kasutajat, vestlust, logi ega seanssi.

## Koristus

Ajutine integratsiooni-worktree, selle paigaldatud sõltuvused ja build-artifaktid eemaldati pärast kontrolli. Teostusharu, rakenduskood, skeem, migratsioonid, `origin/main` ja tootmisserver jäid muutmata. Käesolev raport on auditiharu ainus muudatus ning seda ei commit'itud ega push'itud, sest verdikt ei ole PASS.

## Lõppverdikt

**CHANGES_REQUIRED**

Enne integratsiooni peab teostaja parandama vähemalt P0-1 uuel commit'il ja lisama P2-1 kirjeldatud käitumistestid. Audit ei teinud teostusharus parandusi, merge'i ega deploy'd.
