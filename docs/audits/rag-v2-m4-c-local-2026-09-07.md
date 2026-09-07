# M4-C piiratud jätkuvestlus: kohalik teostus ja kontroll

07.09.2026. Ülesanne: `docs/CODEX_M4_C_PIIRATUD_JATKUVESTLUS_v0_1.md`, omaniku kohalik teostusjuhis „tegutse”. **Kohalik teostus valmis; pärisotsingu ja Luna jätkuvastuste sisuline vastuvõtt NOT_PROVEN.** See raport on ploki tõend, aktiivse töö seisu kannab `SotsiaalAI.md` S1.0.

## Tulemus ja piir

Kaitstud tavavestlus säilitab lühikese aktiivse teema/isiku kasutajasõnumid, eristab parandust varasemast infost ning lubab valida varasema teema, avaldatud vastuse ja vastuse punkti. Vastu võetud parandus või isikuvahetus ei sõltu vastuse õnnestumisest. Kõik neli kohalikku dialoogi läbisid tegeliku PostgreSQL-i ja autenditud HTTP raja: 15 pööret, 14 avaldatud testvastust ja üks tahtlik `answer_rejected`. Välismudelikutsed **0**.

V3 vastuse leping, kanoonilised viited, otsinguprofiil, indeks, korpus ja pärismudel säilisid. Tsitaadikandidaati ei parandatud ega aktiveeritud. Uus režiim on konfiguratsioonis eksplitsiitselt sisse lülitatav; vana ühe-pöörde režiim jääb loetavaks ja käitatavaks. [Päriskatse koondplaan](rag-v2-m4-c-real-plan-2026-09-07.md) sisaldab nelja täpset dialoogi, 15+15 kutse ja 0,30 USD piiri ning nelja allkirjastamata konfiguratsiooni. Uut väliskutse-, push'i- ega deploy-luba ei kasutatud.

## Mõõdetud lähte- ja lõppseis

| Pind | Mõõdetud seis |
|---|---|
| Kohalik põhikaust | `C:\Users\rauds\Desktop\SotsiaalAI`, haru `main` |
| Kohalik HEAD enne ja pärast tööd | `cd6bd044bb92a5be5aa44dedc18a6fedf611f552`; selle ploki muudatused on commit'imata |
| GitHub `refs/heads/main` enne ja pärast | `cd6bd044bb92a5be5aa44dedc18a6fedf611f552`, kontrollitud `git ls-remote` abil |
| Server enne ja pärast | `5b9d0a23`, tööpuu puhas, frontend `active`, aktiivne alates 07.09 kell 11:00:40 EEST; kontrollitud SSH-ga |
| Kontrollitud teostuse manifest | `7958451ad7d705c22397ac56a7463eaa0471dd108e761ffa724a311d9819ac94` |
| Kohalik runtime | `npm run dev`, port 3000; isoleeritud DB `sotsiaal_ai_m4_dev`; sünteetiline testkonto; `TZ=UTC` |
| Piloot ja säilitus | Uus kohalik ledger `m4-c-local-20260907-1`; kõik 15 pöörde tähtaega `null`; varasemad ledgerid muutmata |

Serveri lõppkontroll tehti pärast kohalikke muudatusi ja build'i. Serverisse midagi ei kirjutatud. Andmebaasi ühendus ja testkonfiguratsioon anti ainult kohaliku dev-protsessi keskkonda; `.env` jäi muutmata. Päris tootmiskasutaja sisu ei kasutatud.

Enne tööd oli tööpuus omaniku/teise akna töö: `app/layout.js`, `docs/audits/rag-v2-multi-source-preparation-2026-09-05.md`, `lib/chat/questionRequirements.js`, `lib/chat/ragDiagnostics.js`, kustutatud `public/voice/Torsonägu.png` ning jälgimata ülesanded, hindamisandmed ja 3D-varad. Neid faile selles plokis ei muudetud ega taastatud. Kogu tööpuu puhtust ei taotletud; stage'i, commit'i, push'i ega deploy'd ei tehtud.

## Teostuse leping

`m4-active-dialogue-1` valib serveri kaitstud ridadest kuni kaheksa kasutajapööret samas ulatuses. Vestluse piir on 64 pööret. Otsinguteksti piir on 4500 ning dialoogiesituse piir 9000 tokenit. Piirid on nähtavad kasutajaliideses; üle piiri jõudmine annab lokaliseeritud veateate, mitte vaikse kärpe.

Teema/isiku head salvestatakse vestluse ja pöördega samas tehingus enne mudelikatset. `same` jätkab aktiivset ulatust; `correction` lisab eelnevale pöördele osutava paranduse ja suurendab parandusversiooni. Varasemad kasutajasõnumid jäävad nähtava päritoluga alles, hilisem parandus on vastuolu korral prioriteetne. Vabatekstist faktitabelit ei eraldata. Rangeid piirkonnafiltreid ei tekitata: `strictFilters={}` ning olemasolevale otsingule antakse tekst, keel ja muutumatu profiil.

`new` loob uue teema ilma vana teema asjaoludeta; inimese ulatuse tunnus võib säilida. `new_person` loob mõlemad ulatused uuesti. Selgesõnaline vana teema valik kasutab selle teema viimast vastuvõetud seisu koos parandustega, mitte valitud vana pöörde aegunud hetktõmmist. Kadunud või aegunud aktiivne head ei anna luba valida vaikimisi vanemat inimest.

Avaldatud assistendivastust võib kasutada viite mõistmiseks. See saadetakse eraldi `NOT_A_FACT_SOURCE` dialoogina ja ajalooliste `turnId/S1` viidetega; ebaõnnestunud mustandit ei kasutata. Uue vastuse faktitoe annab ainult uus kanooniline allikapakett. Kogu assistendivastust ei panda embedding'usse; ainult kasutaja selgelt valitud punkt võib olla märgistatud kontrollimata otsinguvihje. Vana allika õigus ja versioon kontrollitakse uuesti enne selle vastuse kasutamist, uued allikad enne saatmist ja avaldamist ning taastamisel.

Otsingutekst ja vastajasisend on eraldi versioonitud: `m4-user-scope-search-1` ning `m4-grounded-dialogue-1`. V3 väljund jääb `m4-text-refs-3`. Päringu vahemälu identiteet sisaldab tegelikku teksti, versiooni, teema-/isikupiiri, embedding'u seadeid ja konfiguratsiooni räsi; andmebaasi päring piirab ka kasutajat. Vana ühe-pöörde vektor ei sobi dialoogile ainult lühikese küsimuse võrdsuse tõttu.

Valitud ja välja jäetud pöörded/põhjused, parandusseosed ning keel salvestatakse kaitstud auditis. Tegelik otsingutekst ja dialoog salvestatakse enne embedding'ut; allikapakett ja täielik vastamispäring enne vastamiskutse reserveerimist/saatmist. Kliendilt tulnud `history`, `role` ega isikutunnus õigusi ei anna. Kustutus ja arhiivi/aja järgi puhastamine hõlmavad uut toorpayload'i; kulude sisutud koondid jäävad alles. `null` säilitab tähtajatuse, puuduvat tähtaega ei tõlgendata loaks.

## Muudetud failid

| Pind | Failid |
|---|---|
| Kontekst, teenus ja kvoodiga seotud õigused | `lib/rag-v2/pilot/dialogue.js` (uus), `store.js`, `service.js`, `config.js`, `provenance.js` |
| Kaitstud vestluse API ja kliendileping | `lib/chat/m4PilotServer.js`, `m4PilotClientContract.js`, `m4PilotIntent.js` |
| Tavavestlus ja piloodivaade | `app/vestlus/page.js`, `app/rag-pilot/pilot-client.jsx`, `components/ChatSidebar.jsx`, `components/alalehed/ChatBody.jsx`, `components/alalehed/chat/ChatBodyView.jsx`, `components/chat/hooks/useChatStream.js` |
| Valikud | `components/chat/hooks/usePilotDialogue.js`, `components/chat/PilotContextControls.jsx`, `components/chat/PilotContextControls.module.css` (uued) |
| Keeled | `messages/et.json`, `messages/en.json`, `messages/ru.json` |
| Sihitud regressioonid | `tests/rag-v2-dialogue.test.mjs`, `tests/rag-v2-dialogue-store.test.mjs`, `tests/rag-v2-dialogue-config.test.mjs` (uued), `tests/rag-v2-pilot-chat-adapter.test.mjs`, `tests/rag-v2-pilot-replay.test.mjs` |
| Raport ja elav seis | Käesolev raport, `rag-v2-m4-c-real-plan-2026-09-07.md`, `docs/platvormi arendus/SotsiaalAI.md` S1.0 |

Prisma skeem, migratsioonid, v3 `contracts.js`, `presentation.js` ning retrieval'i seadistus ei muutunud. Kohalikud täismahus dialoogi-/allikajäljed ja kontoga seotud ettevalmistusfailid jäävad ignoreeritud `tmp/rag-v2-m4-c/` alla.

## PASS / FAIL / SKIP ja käivitatud kontrollid

Arenduse jooksul läbis **29 erinevat sihttesti**, ebaõnnestunud teste 0. Samu rohelisi teste ei korratud ainult raporti või commit'i puudumise pärast. Esimene ajaloolise replay katse jäi puuduva artefaktimuutuja tõttu SKIP; õige olemasoleva seitsme vastuse failiga läbis ka see test. Lõplikus vajalikus sihttestide katvuses lahendamata SKIP-e pole. Päris Luna semantika ning päris jätkuotsing on eraldi **NOT_RUN / NOT_PROVEN**, mitte testide PASS.

| Kontroll | Tegelik tulemus ja ulatus |
|---|---|
| Uus puhas dialoogileping | PASS 3: ET/EN/RU kõigis neljas režiimis, parandused, isiku-/teemapiir, piirid, sünteetilise garantii sisendileping |
| Uus PostgreSQL-i dialoogirada | PASS 12: neli pööret, ebaõnnestunud parandus/isikuvahetus, vana ulatuse valik, sama võtme võistlus, rollback, 8/9-pöörde piir, vahemälu ulatus, allikaloa kadu, kustutus, aegunud head, konfiguratsiooni muutus read/execute vahel, taastatav kontekstikoond |
| Dialoogikonfiguratsioon | PASS 1: oma versioonid ja `dialogueEgress` luba nõutud; fikseeritud paketi ja kandidaadiga ühildamatu |
| Tavavestluse adapter/kavatsus | PASS 5: ajalooline v3, ohutud veaseisud, pöördega seotud allikad, refresh'i valikud ja kordusvõti |
| Olemasolev konfiguratsioon | PASS 1: kasutaja, aegumise, mudeli ja loa piirid |
| Olemasoleva teenuse kitsas DB-regressioon | PASS 6: kordusvõti, lubatud cache, võõras vestlus/roll/ajalugu, avaldamise rollback/taastamine, tähtaja/kustutuse piirid |
| Seitse algvastust läbi restore'i/renderduse | PASS 1: seitse v3 vastust, uut otsingut/kutset 0, algfaili baidid muutmata |
| ESLint kõigil 21 muudetud JS/JSX/MJS failil | PASS, 0 viga ja 0 hoiatust |
| `npm run i18n:check` | PASS, ET/EN/RU võtmed ja loetavad koodiviited kooskõlas |
| `TZ=UTC; npm run build` | PASS, Next 16.2.10 tootmisbuild; kompileerumine 28,6 s; üks build lõpliku koodipuu kohta |
| `git diff --check` | PASS; Git näitas tavapäraseid LF/CRLF teisenduste teateid |
| `prisma validate` | NOT_APPLICABLE: skeemi/migratsiooni ei muudetud |

Sihitud käivitused (PowerShell; ühenduse väärtust raportisse ei kanta):

```powershell
$m4TestRuntime = Get-Content tmp/rag-v2-m4/local-runtime.json -Raw | ConvertFrom-Json
$env:M4_TEST_DATABASE_URL = $m4TestRuntime.databaseUrl
$env:TZ = 'UTC'
node --import ./scripts/register-node-source-loader.mjs --test tests/rag-v2-dialogue.test.mjs
# Garantii testteksti konkretiseerimise järel ainult selle regressiooni kordus:
node --import ./scripts/register-node-source-loader.mjs --test --test-name-pattern='synthetic guarantee' tests/rag-v2-dialogue.test.mjs
node --import ./scripts/register-node-source-loader.mjs --test tests/rag-v2-dialogue-store.test.mjs
# Hiljem lisatud kaks eraldi riski; eelmist kümmet rohelist testi ei korratud:
node --import ./scripts/register-node-source-loader.mjs --test --test-name-pattern='configuration change between|context summary restores' tests/rag-v2-dialogue-store.test.mjs
node --import ./scripts/register-node-source-loader.mjs --test tests/rag-v2-dialogue-config.test.mjs tests/rag-v2-pilot-chat-adapter.test.mjs tests/rag-v2-pilot-config.test.mjs tests/rag-v2-pilot-replay.test.mjs
node --import ./scripts/register-node-source-loader.mjs --test --test-name-pattern='concurrent same-key|permitted cache|foreign conversation|publication transaction rollback|expiry|archive' tests/rag-v2-pilot-store.test.mjs
$env:M4_REPLAY_ARTIFACT = 'tmp/rag-v2-m4-comparison-real/results.json'
node --import ./scripts/register-node-source-loader.mjs --test tests/rag-v2-pilot-replay.test.mjs
npx eslint app/rag-pilot/pilot-client.jsx app/vestlus/page.js components/ChatSidebar.jsx components/alalehed/ChatBody.jsx components/alalehed/chat/ChatBodyView.jsx components/chat/hooks/useChatStream.js components/chat/hooks/usePilotDialogue.js components/chat/PilotContextControls.jsx lib/chat/m4PilotClientContract.js lib/chat/m4PilotIntent.js lib/chat/m4PilotServer.js lib/rag-v2/pilot/config.js lib/rag-v2/pilot/provenance.js lib/rag-v2/pilot/service.js lib/rag-v2/pilot/store.js lib/rag-v2/pilot/dialogue.js tests/rag-v2-dialogue.test.mjs tests/rag-v2-dialogue-store.test.mjs tests/rag-v2-dialogue-config.test.mjs tests/rag-v2-pilot-chat-adapter.test.mjs tests/rag-v2-pilot-replay.test.mjs
npm run i18n:check
npm run build
git diff --check
```

Build'i logi: `tmp/rag-v2-m4-c/build.log`. [Lõppmõõtmine kell 09:25:32 UTC](../../tmp/rag-v2-m4-c/final-checks.json) kinnitas muutumatu koodimanifesti, algvastuste räsi, allikaloa baiditäpse taastamise ja endiselt 15+15 kohaliku katse arvestuse. Staatilised väravad tõendavad ainult oma pinda; konteksti tehingu- ja ligipääsukäitumise tõend on sihttestides ning allolevas päris HTTP/DB kontrollis.

## Käsitsi brauseri- ja HTTP-rada

Kõik 15 pööret esitati brauseri kaudu autenditud kohalikule serverile. A ja B kõik pöörded ning D3–D4 tehti tavavestluse nähtavate juhtnuppudega; C1–C3 ja D1–D2 esitati brauseri kontekstis käsitsi sama API kaudu. C katkestatud vastuse järel kontrolliti tegelikku lehe taastamist. Uut automatiseeritud brauserisondi ei loodud.

| Rada | Tulemus |
|---|---|
| A: neli pööret ja refresh | PASS: taastusid kaheksa kasutaja/assistendi sõnumit; A4 sisendis säilis A1 vanus ja vald |
| B: ingliskeelne parandus | PASS: Tartu parandussõnum, 67-aastasus ja abivajadus säilisid koos; UI näitab algteemat ja viimast parandust eraldi |
| C: uus inimene, tahtlik S99 viiteviga, jätk | PASS: C2 `answer_rejected`, C3 aktiivne inimene 2; C1 vanus/vald/abikaasa puuduvad C3 sisendis; ebaõnnestunud mustand puudub |
| D: uus teema, refresh, D1 teema/vastus/punkt 2, allikavaade, naasmine, D4 | PASS: D1 ulatus taastub; D2 küsimus ei kandu sinna; allika link sisaldab D3 pöörde-ID-d; D4 säilitab õige ulatuse |
| Allikaloa ajutine eemaldamine | PASS: vana D3 allikas tagastas 404 `source_unavailable`; pöördeloend oli 200/`turns=[]`; kontekst oli `active=null`, `unavailable=true`, `scopes=[]`. Ei avaldatud vana sisu. Algne konfiguratsioon taastati baiditäpselt ja allikas vastas jälle 200 |
| Kaks paralleelset HTTP korduspäringut | PASS: D1 sama võtmega päringud tagastasid mõlemad 200 ja sama ID `0785691b-e606-4ee6-b4be-200b46e47027`; uus pöördeloomise võistlus kontrolliti lisaks päris DB sihttestis |
| Sama võtme muudetud režiim | PASS: 409 `idempotency_conflict` |
| Kliendi võltsitud `history` | PASS: 400 `invalid_shape`, enne transporti |
| Ilma autentimisküpsiseta kontekst | PASS: 401 `unauthorized` |
| Tavaline, M4 õiguseta vestlus | PASS: 403 `conversation_unavailable`; võõra kasutaja piir kontrolliti lisaks reaalse DB kaudu |
| „Uus vestlus” piloodis | Leitud viga parandatud: sidebar lõi algul tavalise vestluse, mille M4 rada õigesti sulges. Nüüd kasutab nupp M4 `ensure` rada; uus kaitstud vestlus loodi UI-st edukalt |
| 390 × 844 mobiilivaade | Leitud kattumine parandatud: absoluutne kirjutusväli kattis valikute avaja. Pärast parandust valikud avanevad klõpsuga; valikute põhi 674,1 px ja kirjutusvälja ülaserv 719,6 px, horisontaalset ülevoolu 0 |

Brauserinäited: [EN parandus töölaual](../../output/playwright/m4-c-b-correction.png), [D kanooniline allikas](../../output/playwright/m4-c-d-source.png), [avatud valikud mobiilis](../../output/playwright/m4-c-mobile-context.png). Testallika leheküljed olid 2–3; need tõendavad allikalingi sidumist ja taastumist, mitte küsimuse sisule sobivat leidu. Brauseris esines ka varasema analüütika CORS-teateid ning käesoleva negatiivkontrolli eeldatud HTTP-vigu; neid ei loetud Luna ega konteksti sisutõendiks.

## Neli dialoogijälge

Täpsed laused on [koondplaani tabelis](rag-v2-m4-c-real-plan-2026-09-07.md#täpsed-laused-ja-valikud). [Privaatne tervikjälg](../../tmp/rag-v2-m4-c/local-traces.json) sisaldab kõiki 15 tegelikku rida, kasutajasõnumeid, dialoogisisendit, otsinguteksti, allikapaketti, pöördekaarte ning request/usage sündmusi. [Kohaliku jooksu koond](../../tmp/rag-v2-m4-c/local-summary.json) mõõdeti 09:03:56 UTC: üheksa kontrollitud tähelepanekut PASS, 0 FAIL; 15 mock-embedding'ut, 15 fikseeritud vastust, 30 katset ja 192423 reserveeritud tokenit, 0 USD. Järgnenud korduspäringud ja õiguste lugemiskontrollid ei loo uusi katseid.

Kõigi kohalike pöörete otsingutulemus oli testtranspordi fikseeritud valik artiklist „Tehisintellekt sotsiaaltöös: praktika, kaalutlused ja väärtuspõhised piirid”, versioon `version_cb096c93c7ec37aaa354668421a45e1890de87fb2f84bc176bd478a613d42983`, `S1`, lk 2–3. See valik ei ole vektorotsingu kvaliteeditõend. Päris DB teenusetest vahetas lisaks iga pöörde S1 allikakohta ning kontrollis, et vana S1 ei asendaks uut.

### A — ET

Vestlus `a5f4b138-b945-479b-9b64-fb7a0047f0ee`.

| Pööre / ID | Režiim ja seis | Kasutajakontekst | Teema / inimene / parandus | Assistendidialoog | Otsingu / dialoogi tokenid |
|---|---|---|---|---|---|
| A1 / `96016ba5-59ce-488a-9928-b798beb76b12` | new / completed | A1 | A1 / A1 / 0 | — | 40 / 229 |
| A2 / `851984a2-f54a-4a3b-9735-623578adb6b9` | same / completed | A1, A2 | A1 / A1 / 0 | A1 | 77 / 464 |
| A3 / `95c5ffb9-cb19-49aa-8acc-1a74a0036b59` | same / completed | A1, A2, A3 | A1 / A1 / 0 | A2 | 91 / 525 |
| A4 / `841148ee-945c-4767-a01d-7c4ac9af906b` | same / completed | A1, A2, A3, A4 | A1 / A1 / 0 | A3 | 124 / 594 |

Viimase pöörde välja jäetud kirjed: A1 (assistant: not_selected_answer); A2 (assistant: not_selected_answer).

<details>
<summary>A viimase pöörde tegelik otsingutekst</summary>

```text
Active topic and person. Later user corrections take precedence; unchanged circumstances remain.
1. USER MESSAGE:
Olen 67-aastane ja elan Harkus. Mida kirjeldab heaolutehnoloogiate programm kodus elamise toetamise kohta?

2. USER MESSAGE:
Milliseid lahendusi see programm eeldas?

3. USER MESSAGE:
Mida tuli kohandada?

4. USER MESSAGE:
Selgita teist punkti ja erista eesmärk juba saavutatud tulemusest.
```

</details>

### B — EN

Vestlus `conv-8e81e03b-c349-4b17-b4fa-2198a4077b1e`.

| Pööre / ID | Režiim ja seis | Kasutajakontekst | Teema / inimene / parandus | Assistendidialoog | Otsingu / dialoogi tokenid |
|---|---|---|---|---|---|
| B1 / `a615d070-ea4a-42b0-84aa-e339ef5c3f4c` | new / completed | B1 | B1 / B1 / 0 | — | 34 / 243 |
| B2 / `b81352d3-fffe-4d4d-b63b-de606e70d2ab` | correction / completed | B1, B2 | B1 / B1 / 1 | B1 | 87 / 505 |
| B3 / `5d4c033d-eed0-42f3-9778-02128ff56734` | same / completed | B1, B2, B3 | B1 / B1 / 1 | B2 | 100 / 547 |
| B4 / `0c2f7352-bfbb-4252-a03c-d8caf4e45688` | same / completed | B1, B2, B3, B4 | B1 / B1 / 1 | B3 | 116 / 593 |

Viimase pöörde välja jäetud kirjed: B1 (assistant: not_selected_answer); B2 (assistant: not_selected_answer).

<details>
<summary>B viimase pöörde tegelik otsingutekst</summary>

```text
Active topic and person. Later user corrections take precedence; unchanged circumstances remain.
1. USER MESSAGE:
This is a fictional case: I am 67, live in Harku and need help at home. What can the training fact sheet tell me about home support?

2. USER CORRECTION (replaces conflicting earlier user information only):
Correction: I live in Tartu. My age and need for help have not changed.

3. USER MESSAGE:
What is the exact price for me?

4. USER MESSAGE:
Which part is still unknown, given my corrected location?
```

</details>

### C — RU

Vestlus `m4-c-local-C-20260907`.

| Pööre / ID | Režiim ja seis | Kasutajakontekst | Teema / inimene / parandus | Assistendidialoog | Otsingu / dialoogi tokenid |
|---|---|---|---|---|---|
| C1 / `46852700-5d30-4b53-a929-bd69372128e7` | new / completed | C1 | C1 / C1 / 0 | — | 58 / 251 |
| C2 / `10a195b7-6860-45dc-b841-e18d26aecb73` | new_person / answer_rejected | C2 | C2 / C2 / 0 | — | 46 / 240 |
| C3 / `d2da0581-8038-4b8e-8136-dfbe8a454a5f` | same / completed | C2, C3 | C2 / C2 / 0 | — | 87 / 315 |

Viimase pöörde välja jäetud kirjed: C1 (user: different_scope); C2 (assistant: not_published).

<details>
<summary>C viimase pöörde tegelik otsingutekst</summary>

```text
Active topic and person. Later user corrections take precedence; unchanged circumstances remain.
1. USER MESSAGE:
Теперь речь о другом человеке: ему 30 лет, он живёт один, муниципалитет неизвестен.

2. USER MESSAGE:
А точная цена и гарантированный срок?
```

</details>

### D — ET

Vestlus `m4-c-local-D-20260907`.

| Pööre / ID | Režiim ja seis | Kasutajakontekst | Teema / inimene / parandus | Assistendidialoog | Otsingu / dialoogi tokenid |
|---|---|---|---|---|---|
| D1 / `0785691b-e606-4ee6-b4be-200b46e47027` | new / completed | D1 | D1 / D1 / 0 | — | 40 / 233 |
| D2 / `df673fc6-b5b0-48b7-b61e-6d22d47239e5` | new / completed | D2 | D2 / D1 / 0 | — | 40 / 245 |
| D3 / `0ee70cf3-fe5e-427a-94c2-7b77ce5560b4` | same / completed | D1, D3 | D1 / D1 / 0 | D1, punkt 2 | 122 / 488 |
| D4 / `bc4a74cd-cc31-424e-9c83-fc5cdc46d8f2` | same / completed | D1, D3, D4 | D1 / D1 / 0 | D3 | 118 / 566 |

Viimase pöörde välja jäetud kirjed: D2 (user: different_scope); D1 (assistant: not_selected_answer).

<details>
<summary>D viimase pöörde tegelik otsingutekst</summary>

```text
Active topic and person. Later user corrections take precedence; unchanged circumstances remain.
1. USER MESSAGE:
Milliseid korralduslikke samme soovitab eetikanõukoja kommentaar töötaja ähvardamise või vägivalla järel?

2. USER MESSAGE:
Naasen töötaja ohutuse teema juurde. Selgita selle vastuse teist punkti.

3. USER MESSAGE:
Milline allikakatkend toetab seda korralduslikku sammu?
```

</details>


## Olemasoleva seitsme pärisbaasvastuse sisuline hinnang

Läbi vaadati olemasoleva 7+7 katse seitse v3 baasvastust ja nende tegelikud allikapaketid, uusi vastuseid ja hindamismudeli kutseid 0. Algfaili SHA-256 jäi `41b78493b9a0d18857f9af95a9c41e1a994edc00aa795df37ad5cad583610e7a`. Tegu on Codexi allikapõhise läbivaatusega, mitte sõltumatu inimese pimeda vastuvõtuga. [Täpsed vastused, allikatekstid, viited ja leheküljed](../../tmp/rag-v2-m4-c/baseline-review.json).

| Küsimus / leid | Hinnang ja konkreetne allikapiir |
|---|---|
| 1 / M4C-BASE-1-1 | **FAIL, OPEN**. Teise ploki „The programme brought together…” on seotud S1/S3-ga. S3 („Heaolu tehnoloogiate programm”, lk 2) ütleb „Programmi eesmärk on tuua kokku erinevad valdkonna\nosapooled”. See on eesmärk. S4 („Käivitus …”, lk 5–8) sisaldab tegeliku 9. jaanuari kohtumise kirjeldust, kuid S4 ei ole selle ploki viide. Viga on ajavormis ja konkreetse ploki allikatoes; sellest ei järeldata, et kohtumist polnud. Olemasolevate lahenduste kohandamise põhivastus on toetatud |
| 2 / M4C-BASE-2-1 | **PARTIAL, OPEN**. „Ei saa seda artiklit kasutada kõigi Eesti valdade kohustusliku teenuseotsuse reeglistikuna.” on kategoorilisem kui „need väljavõtted ei tõenda siduvat reeglistikku”. Viidatud S1/S5 TI-artikkel (lk 1–3) esitab väärtusotsuste ja võimusuhete analüüsi; S5: „Eesmärk ei ole võtta seisukohta TI kasuks või kahjuks, vaid näidata, et iga\ntehnoloogilise lahenduse kasutamine hõlmab väärtusotsuseid”. Analüütiline ja väärtuspõhine põhisisu on toetatud. Õiguslikku kehtivust siin eraldi ei otsustatud |
| 3 / M4C-BASE-3-1 | **PARTIAL, OPEN**. Hind ja garanteeritud tähtaeg jäetakse õigesti teadmata. Piiranguvälja „Эти сведения могут зависеть от конкретного муниципалитета” lisab toeta piirkondliku sõltuvuse oletuse. S1 osalejapakett, lk 2–3: „Faktileht ei ütle, kui kiiresti ühendust võetakse, kas teenus kindlasti määratakse ega kui palju see\nmaksab.” Varasem kõrvaline teise õppenäite kirjeldus selles vastuses enam ei esine; uus kõrvalväide jääb avatuks |
| 4 / M4C-BASE-4-1 | **PARTIAL, OPEN**. Eesmärki ja mõõdetud koormuse vähenemist eristatakse õigesti. „the funded projects were at the development, testing, impact-assessment, or implementation stages” muudab kavandatud rahastusetapid projektide tegeliku seisu väiteks. S3 lk 2 ütleb „toetust saab\ntaotleda kahes omavahel seotud etapis”, kirjeldades rahastamise võimalusi, mitte iga projekti seisu |
| 5 | **PASS**. Välisriikide TI-näiteid ei tõsteta iseseisvaks Eesti kohustuse aluseks; näited ja väärtuspõhise hindamise väited on seotud tegelike väljavõtetega. See ei ole eraldi Eesti õiguse hinnang |
| 6 / M4C-BASE-6-1 | **PARTIAL, OPEN**. „Учебный факт-лист гарантирует только описание базового порядка обращения” annab kirjeldusele põhjendamatu garantii sõnastuse. S1 lk 2–3 kirjeldab pöördumist, ühendusevõttu ja hindamist ning nimetab teenuse määramise, kiiruse ja hinna teadmata asjaoludeks. Järgmine vastuseplokk säilitab need piirid; vastus ei luba inimesele kindlat teenuse määramist |
| 7 | **PASS**. Eetikanõukoja soovitused kokkulepete, vastutajate, riskihindamise, dokumenteerimise ja toetuse kohta on seotud S1–S3 sisuga; määravat väljajättu või kõrvalist õigusväidet ei leitud |

Koond: **2 PASS, 4 PARTIAL, 1 FAIL**. Keele ja kasuliku põhivastuse osas olid kõik seitse sobivad; selle ülevaatuse käigus ei tuvastatud määravat väljajättu ega tarbetut keeldumist. Viidete tehniline lahendumine läbis replay; see ei tõenda väite semantilist tuge. Viis sisulist leidu jäävad avatuks; v3 ühe-pöörde prompti selles plokis nende parandamiseks ei häälestatud.

## Mis jääb tõendamata

- **Päris jätkuotsingu katvus ja Luna allikatäpsus:** NOT_RUN. Kohalik testtransport kasutas fikseeritud allikavalikut ning sünteetilist teksti. Need ei saa näidata, kas parandatud asukohaga või lühikese viitega pärisotsing leiab sobiva toe.
- **Vana assistendi toeta garantii semantiline tagasilükkamine:** NOT_PROVEN. Sünteetiline regressioon paigutab garantii eraldi kontrollimata dialoogi, hoiab vana viite uue allika viitest lahus ja kontrollib prompti selget keeldu garantiid kinnitada. See test ei käivita Lunat ega tõenda, et iga tema jätkuvastus keeldu järgib. Ajaloolist pärisvastust ei muudetud.
- **Vabateksti automaatne isiku-/teemavahetus:** ei ole teostuse väide. Kasutaja valib režiimi; programm haldab päritolu ja ulatust. Vanad ning parandatud sõnad võivad mõlemad olla otsingutekstis, kuid vana väärtust ei kasutata range filtrina. Semantiline eelistus vajab päriskatse hinnangut.
- **Tootmisruntime ja avalik kasutus:** uut teostust ei deploy'tud; sõltumatu inimese sisuline vastuvõtt, päris seadmete klaviatuurid ja abitehnoloogia jäävad NOT_PROVEN. Olemasolevad ühe-pöörde sisuleiud ei kao jätkuvestluse tehnilise PASS-i tõttu.

Järgmine samm on üks konkreetne [nelja vestluse päriskatse koondplaan](rag-v2-m4-c-real-plan-2026-09-07.md), mitte tsitaadikandidaadi uus parandusring ega M3/M5/M6 arhitektuurimuutus.
