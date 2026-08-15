# SotsiaalAI RAG-i kvaliteedi- ja Luna ülemineku projekt

**Dokumendi liik:** põhiprojektifail  
**Versioon:** 1.2
**Kuupäev:** 01.08.2026
**Omanik:** SotsiaalAI  
**Staatus:** käimas  
**Tootmise vaikeseadistus:** tootmiseelne `gpt-5.6-luna` canary (`medium`, `medium`, 3000); Mini on rollback

**01.08.2026 seis.** Omaniku prioriteedimuudatuse järgi ei blokeeri pooleli jäetud mitmepäevane B0 idle-mõõtmisaken enam Mini baasjoont ega Luna hindamist. Lukustatud pimevõrdluses sai Mini 573/666 ja Luna 628/666. Pärast teenuseankru, atributsiooni, no-corpus ja kontaktipoliitika release-hardening'ut läbisid mõlemad mudelid tugevdatud Golden-37 automaatvärava 37/37. Luna tootmiseelne canary on aktiivne; B0 timeout'i sageduse lõppotsus on endiselt edasi lükatud ja retrieval timeout 12000 ms.

---

## 1. Projekti eesmärk

Projekti põhieesmärk on viia SotsiaalAI **kontrollitult üle mudelile `gpt-5.6-luna`**, parandades enne üleminekut RAG-toru mõõdetavust ja teadaolevaid kvaliteedivigu ning valides tootmiseks Luna parima konfiguratsiooni:

- `reasoning.effort = medium`;
- `text.verbosity = medium` või `low`;
- piisav `max_output_tokens`, et vastused jõuaksid loomuliku lõpuni.

Projekt ei käsitle `gpt-5.4-mini` ja Lunat enam kahe majanduslikult võrdväärse lõppkandidaadina. `gpt-5.4-mini` roll on:

- praeguse tootmise baasjoon;
- kvaliteedi, latentsuse ja päringukulu võrdluspunkt;
- ajutine rollback-mudel;
- regressioonikontroll ülemineku ajal.

Mudeli vahetamine ei tohi varjata RAG-toru enda vigu. Enne Luna tootmisse viimist tuleb kõrvaldada või mõõdetavalt piiritleda vähemalt 1100-tokenilise lae kärped, puudulik `rag_trace`, planneri rolliviga, kontaktikirjete müra, allikate kuvamise lahknevused ja incomplete-streami lõpetamisviga.

### 1.1 Hinnalähtekoht

OpenAI avaliku API hinnakirja seisuga 31.07.2026:

| Mudel | Sisend / 1M | Cache'itud sisend / 1M | Väljund / 1M |
|---|---:|---:|---:|
| `gpt-5.6-luna` | **$0.20** | **$0.02** | **$1.20** |
| `gpt-5.4-mini` | $0.75 | $0.075 | $4.50 |

Luna ühikuhind on kõigis kolmes tokeniliigis **73,3% madalam**; teistpidi on `gpt-5.4-mini` ühikuhind **3,75 korda kõrgem**. Seetõttu ei ole mini säilitamine lõppmudelina põhjendatud pelgalt hinnaga. Tegelik päringukulu tuleb siiski arvutada mõõdetud uncached-input-, cached-input- ja output-tokenite põhjal ning hinnad tuleb lõppotsuse päeval uuesti kontrollida.

### 1.2 Projekti kvaliteedieesmärk

Luna üleminek loetakse põhjendatuks ainult siis, kui puhastatud tootmis-RAG-i testid näitavad, et valitud Luna seadistus:

- säilitab või parandab Golden-37 kvaliteeti;
- ei halvenda õiguslikku ja eetilist kalibreerimist;
- kasutab asjakohaseid ning kasutajale jälgitavaid allikaid;
- lõpetab vastused usaldusväärselt;
- ei tekita vastuvõetamatut latentsuse või tootmiskindluse regressiooni;
- annab mõõdetava päringukulu, mida saab võrrelda mini baasjoonega.

### 1.3 Lõpptulemus

Projekt lõpeb siis, kui on olemas:

1. usaldusväärne RAG-i ja OpenAI kasutuse instrumentatsioon;
2. Golden-37 baasjoon enne parandusi;
3. planneri rollivea ja kontaktimüra sihitud parandused;
4. Golden-37 järelmõõtmine ja regressioonitestid;
5. puhas Luna `medium + medium` versus `medium + low` võrdlus vähemalt 3000 output-tokeni laega;
6. kinnitatud Luna tootmiskonfiguratsioon koos tegeliku päringukulu ja latentsuse hinnanguga;
7. dokumenteeritud etapiviisiline ülemineku-, seire- ja rollback-plaan.

## 2. Süsteemi kontekst

### 2.1 RAG-i üldine toru

SotsiaalAI RAG teenus töötab järgmise loogilise ahelana:

1. allikavajaduse tuvastamine;
2. küsimuse planeerimine (`questionPlanner`), sh režiim, roll ja eluolukord;
3. hübriidotsing;
4. konteksti rühmitamine;
5. `SourcePackage` koostamine;
6. vastuse lõikude atributsioon;
7. kuvatavate allikate jõustamine;
8. `rag_trace` logimine.

Graph-lite on kasutusel ning registris on ligikaudu 4000 entiteeti ja 9400 seost.

### 2.2 Korpuse hetkeseis

Korpuses on 5824 dokumenti:

| Allikatüüp | Dokumente |
|---|---:|
| `kov_services` | 4931 |
| `sotsiaaltoo_articles` | 638 |
| `national_guidelines` | 93 |
| `kov_legal` | 78 |
| `research_reports` | 31 |
| `organization_materials` | 28 |
| `organization_guidelines` | 15 |
| `policy_analyses` | 7 |
| muud | 3 |

Kõik 638 ajakirja PDF-i on indekseeritud. Ligikaudu 34 kohalikku repo-materjali ei ole RAG-i sisse viidud ning neid ei tohi testides eeldada.

---

## 3. Projekti ulatus ja piirid

### 3.1 Projekti sees

- Responses API lõpetamis- ja tokeniväljade instrumentatsioon;
- prompt-komponentide lokaalne tokenihinnang;
- RAG-i allikatoru kihiline logimine;
- `rag_trace` terviklikkus;
- planneri rollituvastus;
- kontaktikirjete asjakohasus ja privaatsus;
- kuvatavate allikate loogika;
- incomplete-streami lõpetamissignaal;
- Golden-37 baas- ja järelmõõtmine;
- Luna medium/medium ja medium/low puhas korduskatse;
- Luna reasoning'u, verbosity, output-tokeni lae ja etapiviisilise tootmisse viimise lõppsoovitus.

### 3.2 Projekti väljas

- korpuse üldine ümberindekseerimine;
- retrieval'i laiaulatuslik parameetrite häälestamine enne baasjoont;
- tootmise vaikemudeli või -seadistuse muutmine enne lõpptulemusi;
- uute tööriistade lisamine Responses API payload'i;
- kohalike repo-materjalide ingest;
- kasutajaliidese üldine ümberkujundamine.

---

## 4. Tootmise kontrollitud canary-asend

Kontrollitud 01.08.2026 pärast Mini järeljooksu ja Luna taastamist.

| Väli | Väärtus |
|---|---|
| Integratsiooni-eelne server HEAD | `bd801d13` |
| Integratsiooni-eelne GitHub `main` | `952a76e3` |
| Luna release-haru | `origin/fix/rag-release-hardening` |
| Teenus | `sotsiaalai-frontend.service` — active |
| Töökataloog | serveri rakenduskataloog (hallatakse väljaspool repot) |
| Env-fail | serveri salajane keskkonnafail (hallatakse väljaspool repot) |
| `CHAT_PROMPT_TOKEN_AUDIT` | `0` |
| `OPENAI_MODEL` | `gpt-5.6-luna` |
| `OPENAI_REASONING_EFFORT` | `medium` |
| `OPENAI_TEXT_VERBOSITY` | `medium` |
| `OPENAI_MAX_OUTPUT_TOKENS` | `3000` |
| `_CLIENT` / `_WORKER` | `3000` / `3000` |

**Rollback-profiil:** `gpt-5.4-mini / low / medium / 1100`
**Luna-eelne env-varukoopia:** serveris, asukoht dokumenteeritud väljaspool repot

Frontend env SHA-256 on `7e786328f70c379c50d868c7e82d9499bec4d7cfd44029cb2997103ae54b726c`; RAG env SHA-256 jäi muutumatuks `38d41cfb9f93f3daa974bbe59aa61ef4aef5b89e126b8e2e7fc8a6a5d39caaa1`.

### 4.1 Kontrollitud

- teenus on active;
- avaleht vastab HTTP 200;
- autentimata `/api/chat` vastab HTTP 401, mitte 500;
- pärast parandatud käivitust ei ole journalis uusi hoiatusi ega erandeid;
- Luna tegelik mudel ja 3000-tokenine lagi on `openai_usage` sündmusega kinnitatud;
- RAG teenus jäi deploy ja mudelivõrdluse ajal samale PID-ile 90400.

### 4.2 Autenditud smoke — TEHTUD 31.07.2026

Golden-37 ja release-smoke kasutasid sünteetilist hindamiskontot ning serveris turvaliselt hallatud autentimisandmeid. Sessiooni HTTP oli 200 ja domeen sünteetiline. Autentimisandmete väärtusi, asukohti ega konto õigusi ei väljastatud ega salvestatud artefaktidesse või journald'i.

Warm-up'i, readiness't ega automaatset retry'd ei lisatud.

---

## 5. Projekti juhtpõhimõtted

1. Tootmiseelne Luna canary kasutab ainult pimehindamises ja regressioonis kontrollitud seadistust.
2. Avalik avamine tehakse alles canary mõõdikute ülevaatuse järel.
3. Retrieval'i üldisi parameetreid, 12000 ms timeout'i, korpust ega RAG teenust canary mudelivahetusega ei muudeta.
4. Algset T3 ülesannet ei eemaldata; see jääb regressioonitestiks.
5. Logidesse ei kirjutata süsteemiprompti, `SourcePackage`'i ega kasutaja tundlikku sisu.
6. Kohalik tokeniarv on hinnanguline; API `usage.input_tokens` on autoriteetne.
7. Incomplete või tehniliselt katkenud jooks ei saa kvaliteedipunkte.
8. Ühe- ja mitmevoorulisi katseid ei segata samasse põhivõrdlusse.
9. Muudatus peab olema sihitud ning selle regressioonirisk peab olema mõõdetud.
10. Kõik raportis esitatud arvud peavad olema mõõdetud või selgelt märgitud ettepanekuna.

---

## 6. Projekti tööjärjekord

```text
A + B0a/B0b instrumentatsioon                    [LÕPETATUD]
  → Mini Golden-37 baas + Luna Golden-37 pimevõrdlus [LÕPETATUD]
    → teenuseankru, atributsiooni ja no-corpus hardening [LÕPETATUD]
      → Mini ja Luna Golden-37 järelvärav          [37/37 + 37/37]
        → Luna tootmiseelne canary                 [AKTIIVNE]
          → canary seire ja avaliku avamise otsus

B0 idle-timeout'i sageduse mõõtmine jätkub eraldi ega blokeeri canary't.
```

| Tööpakett | Sisu | Seis |
|---|---|---|
| **A** | API completion/usage, prompt-komponentide tokenid ja kalibreerimine | **lõpetatud 31.07** (vt 7.3.1) |
| **B0** | idle RAG timeout ja aus veakäsitlus | B0a/B0b tootmises; sageduse lõppotsus edasi lükatud |
| **B** | allikatoru kihiline logi ja streami lõpetamisloogika | plaan valmis; ei blokeeri Luna canary't |
| **Golden-37 baas** | Mini tootmisbaas ja Luna pimevõrdlus | lõpetatud ja lukustatud |
| **C** | planneri rolliviga T3 | alustamata |
| **D** | kontaktimüra ja teenusepõhine atributsioon | release-hardening tehtud; canary seire jätkub |
| **Golden-37 järel** | tugevdatud regressioon pärast hardening'ut | Mini 37/37; Luna 37/37 |
| **E** | Luna hindamine ja tootmiseelne canary | pimehindamine lõpetatud; canary aktiivne |

---

## 7. Tööpakett A — OpenAI ja prompti instrumentatsioon

### 7.1 A1: Responses API lõpetamis- ja kasutusväljad

**Commit:** `d068c519`  
**Fail:** `lib/openaiUsage.js`

Sündmus `openai_usage` sisaldab nüüd API-st tulevaid välju:

- `status`;
- `incomplete_reason`;
- `max_output_tokens`;
- `input_tokens`;
- `cached_tokens`;
- `output_tokens`;
- `reasoning_tokens`;
- `total_tokens`.

Tuletatud väljad:

- `response_present`;
- `visible_output_tokens` = `output_tokens - reasoning_tokens`;
- `output_cap_reached` = `output_tokens >= max_output_tokens`.

**Tõlgendusreegel:** kärpimise autoriteetne alus on `status == incomplete` koos `incomplete_reason` väärtusega, mitte teksti lõpumärk ega ainult `output_cap_reached`.

### 7.2 A2: prompt-komponentide tokeniaudit

**Commit:** `f831257a`  
**Põhifail:** `lib/chat/promptTokenAudit.js`

Audit käivitub ainult lipuga:

```text
CHAT_PROMPT_TOKEN_AUDIT=1
```

Mõõtmine toimub vahetult enne OpenAI kutset pärast promptBuilder'it ja kõiki dünaamilisi lisasid.

Komponendid:

- `system_prompt`;
- `user_input`;
- `conversation_history`;
- `source_package`;
- `tool_definitions`;
- `other_dynamic`.

Iga komponendi kohta logitakse:

- märgikogus;
- `*_tokens_estimated`;
- SHA-256 esimesed 12 märki.

Sisu ei logita.

Tokeniseerija:

- `js-tiktoken` 1.0.21;
- dependency täispinnitud;
- tundmatu mudelinime fallback `o200k_base`;
- singleton ja lazy-load;
- mõõtmisviga ei katkesta chat-päringut.

Mõlemad rajad on instrumenteeritud:

- `callOpenAI` (`stream: false`);
- `streamOpenAI` (`stream: true`).

### 7.3 A3: 30-võtme piirangu kohandus

**Commit:** `f274190e`

Promptiauditi komponendid pesastati `components` objekti, et sündmus ei ületaks `redactObject` 30-võtme lage.

**Testid:** 1993/1993 rohelised.  
**Lint:** puhas muudetud failidel.

### 7.3.1 A kalibreerimine — LÕPETATUD 31.07.2026

Kalibreerimisaken jooksutati commit'il `f274190e`, mudel `gpt-5.4-mini`, tootmisseaded muutmata.
Enne mõõtmist tehti eraldi märgistatud warm-up, mida statistikasse ei arvatud (õnnestus 1. katsel;
idle-regressiooni ei tekkinud). 20 kalibreerimispäringut: 10 kuju × 2 rada, kõik HTTP 200.

**Gap-statistika raja ja päringutüübi kaupa:**

| Rühm | n | `api_input_tokens` | `estimated_component_sum` | gap | mediaan | max | p95 | gap% mediaan | gap% max | neg |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| KÕIK | 20 | 3902 | 3876 | 25 | 24 | 42 | 42 | 0,76 | 1,17 | 0 |
| rada: nonstream | 10 | 3902 | 3876 | 25 | 24 | 42 | 42 | 0,76 | 1,17 | 0 |
| rada: stream | 10 | 3902 | 3876 | 25 | 24 | 42 | 42 | 0,76 | 1,17 | 0 |
| ilma_ragita | 2+2 | 1634 | 1620 | 14 | 14 | 14 | 14 | 0,86 | 0,86 | 0 |
| vaike_pakk | 2+2 | 3136 | 3116 | 20 | 20 | 22 | 22 | 0,64 | 0,66 | 0 |
| suur_pakk | 2+2 | 7725 | 7693 | 32 | 32 | 34 | 34 | 0,50 | 0,69 | 0 |
| vestlusajalooga | 2+2 | 3740 | 3703 | 37 | 37 | 42 | 42 | 1,00 | 1,17 | 0 |
| muu_struktuur | 2+2 | 3276 | 3252 | 24 | 24 | 26 | 26 | 0,79 | 1,03 | 0 |

Tokeniseerimisvigu 0. Negatiivseid gap'e 0. Mudelini mitte jõudnud päringuid 0.

**Tõlgendus.** Gap kasvab absoluutarvult prompti suurusega (14 → 20 → 32 → 37), aga **kahaneb
protsendina** suurtel promptidel (0,86% → 0,64% → 0,50%). See on püsiva **sõnumipõhise üldkulu**
allkiri, mitte tokeniseerija viga: mida rohkem sõnumeid, seda suurem gap. Kõrgeim gap on
`vestlusajalooga` rühmas (37, kuni 1,17%), kus sõnumeid on kõige rohkem. Hinnanguliselt
~4–6 tokenit sõnumi kohta, mis vastab tavapärasele rollimärgise/ümbrise kulule.

`o200k_base` sobivus on sellega kinnitatud: gap on väike, ühesuunaline (mitte kordagi negatiivne)
ja seletatav struktuuriga. Lokaalseid arve võib nüüd nimetada usaldusväärseks hinnanguks, kuid
autoriteetne koguarv jääb `usage.input_tokens`.

**Radade võrreldavus (nõue 8).** `nonstream` ja `stream` andsid iga päringutüübi kohta identsed
väärtused — mõlemad rajad koostavad sama prompti. Gap-käitumine on võrreldav ja neid tohib
edaspidi ühte statistikasse liita.

**Kontrollitud:**

- js-tiktoken laeti alles esimesel auditeeritud päringul, mitte käivitamisel;
- kõik komponendid, märgikogused ja hashid jõudsid logisse (18 ülemist võtit, 6 pesastatud komponenti);
- `input_token_gap`, `input_token_gap_pct` ja `estimate_note` ei kärbu;
- sisuleket ei ole — ei süsteemiprompti, `RAG_CONTEXT`-i ega kasutaja teksti;
- OpenAI payload jäi muutmata (`gpt-5.4-mini` / `low` / `medium` / 1100);
- lipu sulgemise järel auditikirjeid enam ei teki (kinnitatud warm-up päringuga);
- uus protsess ei lae tokeniseerijat (`/proc/<pid>/maps` puhas).

Auditikirje suurus on ~1055 baiti.

### 7.4 A kalibreerimise lõpetamiskriteeriumid

Kalibreerimine on lõpetatud, kui:

- mõlemal rajal on vähemalt 10 erineva kujuga päringut;
- eraldi on kaetud RAG-ita, väikese ja suure `SourcePackage`'iga ning ajalooga päringud;
- kõik hinnangulised väljad on arvulised;
- hashid ja märgikogused on olemas;
- prompti ega kasutaja sisu logisse ei leki;
- OpenAI payload ei muutu;
- `input_token_gap` ja `input_token_gap_pct` jõuavad logisse;
- on raporteeritud mediaan, maksimum ja võimalusel p95 raja ning päringutüübi kaupa;
- auditilipp on pärast mõõtmist tagasi `0`;
- restarti järel ei laeta tokeniseerijat enne esimest auditipäringut.

### 7.5 Kalibreerimisvalemid

```text
estimated_component_sum =
  system_prompt_tokens_estimated
  + user_input_tokens_estimated
  + conversation_history_tokens_estimated
  + source_package_tokens_estimated
  + tool_definitions_tokens_estimated
  + other_dynamic_tokens_estimated

input_token_gap =
  usage.input_tokens - estimated_component_sum

input_token_gap_pct =
  input_token_gap / usage.input_tokens * 100
```

Gap võib sisaldada sõnumistruktuuri, rollimärgiseid, API ümbriseid ja mõõtmata komponenti. Seda ei tohi automaatselt nimetada tokeniseerija veaks.

### 7.6 Teadaolev piirang

Praegune `buildResponsesPayload` ei saada mudelile `tools` võtit. Seetõttu on:

```text
tool_definitions_tokens_estimated = 0
```

Komponent jääb alles tulevase ühilduvuse jaoks.

---

## 7b. Tööpakett B0 — idle RAG timeout ja aus veakäsitlus

**Seis 01.08.2026:** B0a/B0b on tootmises; idle-timeout'i esinemissageduse lõppotsus on omaniku prioriteedimuudatuse tõttu edasi lükatud. B0 ei blokeeri Mini baasjoont, Luna hindamist ega tootmiseelset canary't, kuid jääb riskiregistris avatuks.

### 7b.0 B0a — aus veakäsitlus: LÕPETATUD 31.07.2026

**Commit'id:** `5464c8f8` (tuum) + `fc46d17f` (omaniku sõnastus).
**Serveris:** `fc46d17f`. **Rollback-sihtmärk:** `f274190e`.

**Juurpõhjus.** Signaal `ragSearchFailed` seatakse
[`retrievalContextAssembler.js:1571`](../../lib/chat/retrievalContextAssembler.js#L1571) ja
tagastatakse `retrievalMeta`-s real 2041, kuid **ükski tarbija ei lugenud seda**. Seetõttu läks
retrieval-timeout'i järel kasutajale sõnum `no_context_worker` („Palun täpsusta teemat…"), mis
on eksitav kahes mõttes: otsing ei jõudnudki lõpule ja täpsustamine ei aita.

**Muudatus.** Uued i18n-võtmed `chat.fallback.retrieval_failed_{client,worker}` kolmes keeles;
`langStrings` tagastab `retrievalFailed`; route valib selle, kui `retrievalMeta.ragSearchFailed`
on `true`; `no_context` sündmus kannab välja `ragSearchFailed`. Kriisisõnum jääb ülimuslikuks.

**Mõõdetud tõendus muudatuse vajalikkusest.** Kogu ChatLog-i ajaloos on **3 `no_context`
sündmust** (06-12 18:56, 07-31 15:06, 07-31 17:11) ja kõik kolm langevad kokku kolme teadaoleva
retrieval-tõrkega; kõigil `hadRagResults: false`. Puhas „otsing jooksis, tulemusi ei olnud" haru
ei ole kordagi käivitunud. **Vana sõnum oli vale 100% kordadest, mil seda kuvati.**

**Deploy-järgne kontroll:**

| Kontroll | Tulemus |
|---|---|
| Teenus active, server `fc46d17f` | ✅ |
| Tootmisseaded muutmata (`gpt-5.4-mini`/`low`/`medium`/1100, audit 0) | ✅ |
| Tavaline edukas RAG-päring mõlemal rajal | ✅ nonstream 896 märki / 2 allikat, stream 16 deltat / 2 allikat |
| `noContext` sõnum jäi endiseks | ✅ kontrollitud serveris `langStrings`-ist |
| `retrievalFailed` laadib kõigis 3 keeles × 2 rollis | ✅ 0 probleemi |
| Sõnum tuleb `messages/et.json`-ist, mitte koodi fallback'ist | ✅ |
| Kriisisõnum eristub ja sisaldab 112 | ✅ kõigis keeltes |
| Uusi hoiatusi/erandeid journalis | ✅ ei ole |

**Kontrollimata jäi teadlikult:** elavat `ragSearchFailed=true` rada tootmises ei kutsutud esile,
sest turvalist testimehhanismi timeout'i esilekutsumiseks ei ole (omaniku tingimus). Rada on
kaetud ühiktestiga (`crisisFailsafe.test.js`, „B0: kukkunud otsing annab retrievalFailed
vastuse") ja sõnumipoolelt serveri-kontrolliga. Väli `ragSearchFailed` ilmub `no_context`
sündmusesse järgmisel päris tõrkel.

**Väravad:** `npm test` 2001/2001, `i18n:check` ET/EN/RU OK, lint puhas.

### 7b.0.1 B0 jääk (avatud, ei blokeeri canary't)

- **osa 2:** timeout'i ülevaatus — eraldi, pikem lagi embedding-kutsele. Praegust 12 s
  üldist timeout'i **ei muudetud** ja ei muudeta enne mõju mõõtmist;
- **osa 3:** soojashoidmine või readiness-kontroll;
- **regressioonitest**, mis idle-first-request juhtumit deterministlikult reprodutseerib —
  vajab turvalist mehhanismi retrieval-tõrke simuleerimiseks.

### 7b.0.2 B0b — RAG-otsingu korrelatsioon ja etapikestused

`/search` tagastab tagasiühilduvalt `request_id` ning `timings`-objekti (`embedding_ms`,
`retrieval_ms`, `total_ms`, `outcome`). Sama ID liigub frontend'i timing-logisse ja
rag-service'i `rag.search.stage` etapilogisse; native- ja graph-channeli otsingud on
`observabilityStage` järgi eristatavad. Etapilogisse ei kirjutata päringut, embeddingut,
allika identifikaatoreid, pealkirju ega sisu.

**Operatiivne deploy-märkus.** RAG-service'i etapilogid kasutavad Uvicorni
`logging`-puud (`uvicorn.error.rag_stage`), et jõuda INFO-tasemel stderrisse ja
systemd journald'i ilma rakenduse globaallogimist muutmata. `sotsiaalai-rag.service`
restart käivitab systemd `Requires=` sõltuvuse tõttu automaatselt uuesti ka frontendi.
B0b RAG deploy-smoke vajab seetõttu kehtivat NextAuth küpsist ning vana frontendi
nonstream- ja stream-päringu kontrolli.

**Praegu mõõtmata piirang.** Sünkroonne `/search` endpoint ei mõõda kliendi katkestust.
`client_disconnected=true` ei logita ega tuletata timeout'ist; endpointi ei muudeta selle
mõõdiku pärast asünkroonseks.

### 7b.1 Probleem

Vt §13.4. Retrieval'i 12-sekundiline kõva timeout katkestab esimese päringu pärast jõudeolekut
ning kasutajale kuvatakse allikateta vastus, mis on eristamatu olukorrast, kus allikaid päriselt
ei ole.

### 7b.2 Nõutud lahendus kolmes osas

1. **Aus veakäsitlus (tehtud).** `rag_error`-järgne vastus peab olema kasutajale eristatav
   `no_context`-ist. Kasutajale tuleb öelda, et otsing ei õnnestunud, mitte et allikaid ei ole.
   See on B0 tuum ja ainus osa, mis on kasutajale nähtav.
2. **Timeout'i ülevaatus (edasi lükatud).** Kaaluda esimese päringu või embedding-kutse eraldi, pikemat lage.
   Praegust üldist timeout'i **ei muudeta** enne, kui mõju on mõõdetud.
3. **Soojashoidmine (ei rakendata tõendita).** Warm-up'i, readiness't ega retry'd ei lisatud.

### 7b.3 Vastuvõtukriteeriumid

- `rag_error` järel ei kuvata kasutajale „allikaid ei leitud" tüüpi sõnumit;
- `rag_trace` või vastuse metaandmed kannavad üheselt eristust „otsing ebaõnnestus" vs „tulemusi ei olnud";
- idle-first-request juhtum on reprodutseeritav regressioonitestis;
- mõõtmine ei tee automaatset warm-up'i ega retry'd;
- timeout'i muutmine, kui seda tehakse, on eraldi mõõdetud ja Golden-37 vastu kontrollitud.

Katkestatud mõõtmisaken märgitakse `measurement_window_cancelled_by_owner_priority`. Juba kogutud ohutud andmed säilitatakse, kuid ebapiisava valimi põhjal ei tehta timeout'i poolt ega vastu lõppjäreldust.

---

## 8. Tööpakett B — RAG-i allikatoru ja streami terviklikkus

### 8.1 Eesmärk

Logida üheselt ja kadudeta vähemalt järgmised kihid:

1. retrieved chunks;
2. retrieved unique documents;
3. selected context chunks;
4. unique selected sources;
5. `SourcePackage` pakid;
6. mudeli kasutatud või viidatud allikad;
7. atributsiooni ja jõustamise järel alles jäänud viited;
8. kasutajale kuvatud allikad.

### 8.2 Lahendatavad probleemid

- `displayed_sources` massiivis 9 kirjet, kuid `displayed_source_ids` sisaldab 6 unikaalset ID-d;
- `query_anchor_mismatch` valepositiiv, mis eemaldas SHS § 70 erihoolekande küsimuses;
- katkestatud või vigase streami korral kaob kogu lõplik response-objekt;
- incomplete vastuse korral ei saa klient `done` lõpetamissignaali;
- `rag_trace` võib 30-võtme piirangu tõttu vaikselt kärpuda.

### 8.3 `rag_trace` 30-võtme tootmisviga

`lib/privacy/safeError.js` määrab:

```text
MAX_OBJECT_KEYS = 30
```

DB-s on `rag_trace` sündmustel täpselt 30 võtit, mis viitab kärpimisele. Enne B väljade lisamist tuleb valida ja testida üks lahendus:

- tõsta üldist lage;
- pesastada `rag_trace` loogilisteks objektideks;
- kasutada mõlemat, kuid säilitada privaatsus- ja suurusepiirangud.

Eelistus on pesastamine koos sündmuseskeemi testiga, mis kontrollib kõigi nõutud väljade jõudmist andmebaasi.

### 8.4 B vastuvõtukriteeriumid

- kõik kaheksa allikatoru kihti on ühe päringu jaoks taastatavad;
- sama mõiste kannab kõigis artefaktides sama nime;
- massiivide koguarvud ja unikaalsed ID-d on eraldi väljad;
- `query_anchor_mismatch` ei eemalda selgelt teemakohast õigusallikat;
- incomplete stream saadab kliendile üheselt lõpetamis- ja incomplete-signaali;
- katkestatud voo puhul logitakse vähemalt osaline seis ning `response_present=false`;
- `rag_trace` skeemitest kinnitab, et ükski nõutud väli ei kao 30-võtme piirangu taha.

---

## 9. Golden-37 baasjoon

Golden-37 tuleb käivitada pärast A ja B instrumentatsiooni, kuid enne C ja D käitumismuudatusi.

### 9.1 Eesmärk

- säilitada praeguse retrieval'i ja planneri käitumise mõõdetav baas;
- tuvastada regressioonid pärast C ja D muudatusi;
- mõõta allikatoru kõiki kihte;
- eristada mudeliprobleeme retrieval'i ja atributsiooni probleemidest.

### 9.2 Tingimused

- tootmismudel ja vaikeseaded jäävad muutmata;
- retrieval'i üldparameetrid jäävad muutmata;
- A ja B logimine on aktiivne;
- iga jooksu completion-status on salvestatud;
- tehniliselt vigased jooksud märgitakse eraldi;
- raport sisaldab nii vastuse kvaliteeti kui ka toru diagnostikat.

---

## 10. Tööpakett C — planneri rolliviga

### 10.1 Probleem

Professionaali esimeses isikus kirjeldatud tööülesanne tuvastati ekslikult kliendi olukorrana. Selle tagajärjel võivad:

- `input_role` ja planneri `role` minna vastuollu;
- `needs_rag=true` ning `should_run_rag=false` olla korraga;
- RAG vajalikus professionaalses ülesandes käivitamata jääda.

### 10.2 Nõutud regressioonitestid

- professionaal kirjeldab esimeses isikus oma tööülesannet;
- klient kirjeldab esimeses isikus enda olukorda;
- professionaal tsiteerib kliendi esimeses isikus sõnastust;
- `needs_rag=true` ja `should_run_rag=false` vastuolu;
- algne T3 jääb muutmata regressioonitestiks.

### 10.3 Vastuvõtukriteeriumid

- `input_role=SOCIAL_WORKER` ei muutu ekslikult `client`-iks;
- professionaalse allikavajadusega ülesande puhul käivitub RAG;
- `needs_rag` ja `should_run_rag` on loogiliselt kooskõlas;
- kliendi päringute klassifitseerimine ei halvene;
- Golden-37 järelmõõtmine ei näita kõrvalregressiooni.

---

## 11. Tööpakett D — kontaktimüra piiramine

### 11.1 Probleem

T1 puhul oli 38 unikaalsest valitud allikast:

| Tüüp | Arv |
|---|---:|
| kontaktikirje | 32 |
| teenuseleht | 3 |
| õigusakti paragrahv | 3 |

Küsimus ei sisaldanud kontaktikavatsust, kuid 32 nimelise ametniku e-post ja telefon saadeti mudelile. See:

- tõrjus välja sisuliselt vajalikke õigusallikaid;
- suurendas sisendtokenite hulka;
- tekitas põhjendamatu privaatsuskoormuse;
- halvendas võrdlusküsimuse vastust.

### 11.2 Sihitud lahenduspõhimõte

- kontaktikavatsusega päringus on kontaktallikad lubatud;
- õiguse, tingimuste, võrdluse või teenuse sisu päringus kontaktid alandatakse tugevalt või välistatakse;
- vajalikud õigusaktilõigud reserveeritakse enne kontaktkirjeid;
- globaalset kontaktide keeldu ei rakendata.

### 11.3 Vastuvõtukriteeriumid

- T1 leiab vajalikud Jõhvi, Saku ja Põltsamaa sisulised sätted;
- kontaktitaotlused leiavad jätkuvalt õiged kontaktid;
- kontaktandmeid ei saadeta mudelile sisuküsimuses ilma vajaduseta;
- Golden-37 järelmõõtmine ei näita kontaktipäringute regressiooni;
- sisendtokenite ja `SourcePackage` mahu muutus raporteeritakse.

---

## 12. Tööpakett E — Luna puhas korduskatse

### 12.1 Testitavad variandid

| Variant | Mudel | Reasoning | Verbosity |
|---|---|---|---|
| A | `gpt-5.6-luna` | `medium` | `medium` |
| B | `gpt-5.6-luna` | `medium` | `low` |

### 12.2 Testidisain

- 8 ülesannet;
- 2 jooksu kummagi variandiga;
- kokku 32 jooksu;
- sama roll, korpus, süsteemiprompt ja retrieval;
- teises tsüklis pööratud A/B järjekord;
- iga sõltumatu jooks uues vestluses;
- T6 raporteeritakse eraldi mitmevoorulise katsena;
- võimalusel lisajooks identse fikseeritud T5 kokkuvõttega.

### 12.3 Enne täisjooksu

Seada ajutiselt:

```text
OPENAI_MAX_OUTPUT_TOKENS_WORKER=3000
```

Käivitada 2–3 smoke-ülesannet. Igaühel peab olema:

- `status == completed`;
- `incomplete_details` puudub;
- loomulik vastuse lõpp;
- allikaviited jõuavad kasutajani;
- `output_tokens` ei ole pidevalt täpselt 3000.

Kui mõni smoke jääb incomplete, ei tohi 32 jooksu alustada. Põhjus tuleb selgitada ja vajadusel lage tõsta.

### 12.4 Pimehindamise kriteeriumid

1. õiguslik ja faktiline kalibreerimine;
2. otseste ja kaudsete allikate korrektne kasutamine;
3. uuringu, praktika ja ettepaneku eristamine;
4. põhjendamata erandite vältimine;
5. autonoomia ja abist keeldumise käsitlus;
6. riskide seostamine maandamismeetmetega;
7. piloodi operatiivsus ja mõõdetavus;
8. toimepidevus, asendaja ja supervisioon;
9. piloodi õigusliku vormi või kontrollivajaduse märkamine;
10. allikate asjakohasus ja arv;
11. latency, input-, reasoning-, visible-output- ja total-tokenid.

### 12.5 Kehtiv jooks

Jooks on kvaliteedivõrdluses kehtiv ainult siis, kui:

- OpenAI status on `completed`;
- tehnilist viga ei esinenud;
- vastus jõudis tervikuna kliendini;
- source pipeline'i logi on terviklik;
- jooksu variant ja tingimused on taastatavad.

---

## 13. Olemasolevad mõõdetud leiud

### 13.1 1100-tokeni lagi moonutas esimest Luna testi

32 jooksust:

- 21 olid tegelikult kärbitud;
- 11 olid lõpetatud;
- kolm teksti-lõpu heuristiku juhtumit olid valepositiivid.

`reasoning_tokens` vahemik oli 99–1034 ja keskmine 324. Halvimal juhul jäi 1100-tokenilisest output-eelarvest nähtavale vastusele 66 tokenit.

Ainult lõpetatud jooksudel:

| Variant | Jookse | Output | Reasoning | Mitte-reasoning output |
|---|---:|---:|---:|---:|
| verbosity medium | 3 | 854 | 183 | 671 |
| verbosity low | 8 | 817 | 238 | 579 |

Esialgne nähtava väljundi erinevus oli umbes −14% low kasuks, kuid valim on liiga väike lõppotsuseks.

### 13.2 Allikakihtide definitsioonid

T1 mõõdetud väärtused:

| Kiht | Arv |
|---|---:|
| retrieved chunks | 100 |
| retrieved unique documents | 81 |
| selected context chunks | 41 |
| unique selected sources | 38 |
| `SourcePackage` pakid | 20 |
| model-cited sources | 6 |
| displayed unique ids | 6 |
| `displayed_sources` massiiv | 9 |
| unikaalsed kuvatud pealkirjad | 4 |

Kõik raportid peavad edaspidi kasutama neid mõisteid järjekindlalt.

### 13.3 Streami diagnostika

| Rada | Tulemus |
|---|---|
| `stream: false` | kõik API väljad olemas |
| `stream: true`, normaalne lõpp | kõik API väljad olemas |
| `stream: true`, katkestus või viga | lõplik response-objekt puudub |

Katkestuse korral annab `response_present=false` eristuse, kuid osalise kasutuse säilitamine ja kliendi lõpetamissignaal vajavad blokis B parandust.

### 13.4 Esimese RAG-päringu katkestamine pärast jõudeolekut 12 s retrieval-timeout'i tõttu

**Varasem nimetus „külmstardi risk" oli vale ja on siin parandatud.**

Juurpõhjus on leitud koodist: [`lib/chat/retrievalOrchestrator.js:617`](../../lib/chat/retrievalOrchestrator.js#L617)

```js
timeoutMs = 12000
const t = setTimeout(() => controller.abort(), Math.max(1000, Number(timeoutMs) || 12000));
```

Kolm vaadeldud juhtumit langevad täpselt sinna: mõõdetud latentsused **12 279 ms**, **12 630 ms**
ja ~12 000 ms — kõik napilt üle lae. Kolmandal korral oli teenus üleval **1 h 50 min**, seega
tegu ei ole restardijärgse külmstardiga, vaid **jõudeoleku** efektiga.

Muster:

| | Esimene päring pärast vaikust | Järgmised |
|---|---|---|
| Latents | ~12,3 s → abort | 7,2–7,3 s |
| `rag_cost_usage` (embedding) | puudub — katkes embeddingu ajal | 2 kirjet |
| Valitud allikaid | 0 | 3 |
| Vastus | 151 märki, allikateta | ~1000 märki, 2 allikaga |

**Kasutajamõju.** Katkestuse järel läheb päring `no_context` rajale ja kasutaja saab vastuse,
mille tähendus on „ma ei leidnud allikaid", kuigi tegelik olukord oli „otsing aegus". Need kaks
on kasutaja jaoks täiesti erineva tähendusega ja süsteem ei erista neid.

Tõrge on **vahelduv, mitte determinstlik**: kalibreerimisakna kaks warm-up'i õnnestusid esimesel
katsel (19,5 s ja 18,8 s koguaega, kuid retrieval mahtus 12 s sisse).

**01.08.2026 otsus:** mitmepäevane idle-aken peatati omaniku uue prioriteedi tõttu. Valim ei ole piisav esinemissageduse ega timeout'i muutmise lõppotsuseks. Timeout jääb 12000 ms peale; warm-up'i, readiness't ja retry'd ei lisata. B0a aus veakäsitlus ning B0b request-ID/timingute korrelatsioon jäävad tootmisse. Risk püsib avatuna, kuid ei blokeeri tootmiseelset Luna canary't.

Vt tööpakett **B0**.

---

## 14. Luna ülemineku senine indikatiivne tõendus

Järgmised tulemused pärinevad Playgroundi/File Searchi pimetestidest, mitte puhastatud tootmis-RAG-i korduskatsest. Neid kasutatakse Luna konfiguratsiooni hüpoteesi loomiseks, mitte lõpliku tootmisotsusena. Mini on siin baasjoon ja rollback-võrdlus, mitte võrdväärne lõppkandidaat.

### 14.1 Hinnavõrdlus

| Mudel | Sisend / 1M | Cache'itud sisend / 1M | Väljund / 1M |
|---|---:|---:|---:|
| `gpt-5.6-luna` | **$0.20** | **$0.02** | **$1.20** |
| `gpt-5.4-mini` | $0.75 | $0.075 | $4.50 |

Luna maksab sama tokeniliigi kohta 26,7% mini hinnast. Seetõttu võib Luna kasutada sama päringukulu juures ligikaudu 3,75 korda rohkem vastavat tokeniliiki. Lõplik kuluarvutus peab kasutama A1-st saadud päris tokenijaotust, mitte ainult kogutokenite arvu.

### 14.2 GPT-5.4 mini reasoning-baasjoon

| Variant | Tokenid | Latentsus | Sisuline tulemus |
|---|---:|---:|---|
| low reasoning + medium verbosity | 17 946 | 18,8 s | parem lõppvastus |
| medium reasoning + medium verbosity | 45 126 | 44,5 s | kallim ja aeglasem, mitte parem |

Senine järeldus: `gpt-5.4-mini` medium reasoning ei ole selle ülesandetüübi jaoks põhjendatud. Mini tootmisbaasjoon jääb ülemineku lõpuni `low + medium` peale.

### 14.3 Luna verbosity-võrdlus

| Variant | Tokenid | Latentsus | Sisuline tulemus |
|---|---:|---:|---|
| medium reasoning + medium verbosity | 30 583 | 29,9 s | napilt parem otsustusmemo |
| medium reasoning + low verbosity | 30 238 | 26,3 s | väga lähedane, veidi kompaktsem |

Senine hüpotees: Luna puhul on `medium + medium` parem ametliku ja põhjaliku otsustusmemo jaoks, kuid `medium + low` võib olla sobivam kompaktsema üldvastuse režiim. Lõppotsus tehakse tööpaketi E completed-jooksude põhjal.

### 14.4 Ajutine tootmisasend ja sihtkandidaat

Tootmine jääb kuni valideerimise lõpuni muutmata:

```text
model = gpt-5.4-mini
reasoning = low
verbosity = medium
max_output_tokens = 1100
```

See on **ajutine kontrollbaas ja rollback-asend**, mitte projekti eelistatud lõppmudel.

Peamine tootmisse viimise kandidaat:

```text
model = gpt-5.6-luna
reasoning = medium
verbosity = medium või low
max_output_tokens >= 3000
```

Lõppotsus peab valima ühe Luna põhirežiimi. Teise verbosity-seadistuse võib säilitada erirežiimina ainult siis, kui testid näitavad selget kasutusjuhtumipõhist kasu.

## 15. Mõõdikute sõnastik

| Mõõdik | Definitsioon |
|---|---|
| `input_tokens` | API autoriteetne sisendtokenite koguarv |
| `cached_tokens` | API raporteeritud cache'itud sisendtokenid |
| `output_tokens` | API output-tokenid, sh reasoning |
| `reasoning_tokens` | API raporteeritud reasoning-tokenid |
| `non_reasoning_output_tokens` | `output_tokens - reasoning_tokens`; nähtava teksti lähend |
| `total_tokens` | API kogutokenid |
| `estimated_request_cost_usd` | mudeli hinnasnapshoti ja uncached/cached/output-tokenite põhjal arvutatud päringukulu |
| `cost_per_1000_requests_usd` | valimi keskmise päringukulu projektsioon 1000 päringule |
| `estimated_component_sum` | lokaalsete prompt-komponentide tokenihinnangute summa |
| `input_token_gap` | `input_tokens - estimated_component_sum` |
| `retrieved chunks` | kõik otsingust tagastatud lõigud |
| `retrieved unique documents` | unikaalsed dokumendid retrieved-kihis |
| `selected context chunks` | konteksti valitud lõigud |
| `unique selected sources` | unikaalsed allikad valitud kontekstis |
| `SourcePackage packages` | mudelile koostatud allikapakid |
| `model-cited sources` | mudeli vastuses viidatud allikad |
| `displayed unique ids` | kasutajale kuvatud unikaalsed allika-ID-d |
| `displayed_sources array` | API massiivi kirjete koguarv |

**Märkus:** olemasolev väli `visible_output_tokens` tuleks dokumentatsioonis käsitleda mitte-reasoning output'i lähendina. Tulevikus on selgem nimi `non_reasoning_output_tokens` või `visible_output_tokens_estimated`.

---

## 16. Riskiregister

| Risk | Mõju | Tõenäosus | Maandus |
|---|---|---:|---|
| 1100-tokeni lagi kärbib vastuseid | kõrge | kõrge | tööpaketi E eel 3000+ smoke |
| `rag_trace` 30-võtme kärbe | kõrge | kõrge | pesastatud skeem + DB skeemitest |
| kontaktandmed tõrjuvad sisuallikad või kaks inimest esitatakse vaikimisi kontaktidena | kõrge | keskmine | teenusepõhine paketivärav; üldvastuses rollide mitmekesisus; kõik kontaktid ainult rollide kaupa |
| planner ajab professionaali kliendiga segi | kõrge | keskmine | C regressioonitestid |
| `query_anchor_mismatch` eemaldab õige teenuseallika | kõrge | madal pärast hardening'ut | käändevormide normaliseerimine, fail-closed pakett, Harku regressioon |
| incomplete stream ei anna kliendile lõpetamissignaali | kõrge | keskmine | B stream-protokolli parandus |
| esimese RAG-päringu katkestamine pärast jõudeolekut 12 s timeout'i tõttu | **kõrge** | teadmata; uus valim ebapiisav | B0a/B0b tootmises; eraldi idle-aken hiljem; timeout 12000 ms |
| no-corpus Luna lisab üldteadmisi | kõrge | madal pärast hardening'ut | range korpusepiir + nullallika Golden-regressioon |
| tokeniaudit lekib sisu | kõrge | madal | hash/maht ainult + sisulekke test |
| ~~kohalik tokenihinnang on ebatäpne~~ | ~~keskmine~~ | **maandatud** | kalibreeritud 31.07: gap mediaan 0,76%, max 1,17%, 0 negatiivset |
| Golden-37 muutub enne baasjoont | kõrge | madal | freeze ja commit/hash fikseerimine |
| T6 ajalugu erineb variantide vahel | keskmine | kindel | raporteerida eraldi; lisaks fikseeritud T5 |

---

## 17. Operatiivne töövoog

### 17.1 Ühendus ja kontroll

```bash
ssh sotsiaalai
```

```bash
cd <serveri-rakenduskataloog>
```

```bash
git rev-parse HEAD
systemctl status sotsiaalai-frontend.service
```

### 17.2 Testid

```bash
npm test
```

### 17.3 Deploy

```bash
npm run deploy:server
```

### 17.4 Kalibreerimise autentimine

Chat-päringuid tegevate skriptide autentimisandmed antakse turvalise, repost väljaspool
hallatava käituskonfiguratsiooni kaudu. Muutujate nimed, väärtused, failiasukohad, kehtivusajad
ja konto õigused ei kuulu projekti dokumentatsiooni.

### 17.5 Auditilipu avamine

```text
CHAT_PROMPT_TOKEN_AUDIT=1
```

Seejärel restart ja mõõtmine. Pärast kalibreerimist:

```text
CHAT_PROMPT_TOKEN_AUDIT=0
```

Seejärel uus restart ja lazy-load'i kontroll.

### 17.6 Rollback

Mudeliprofiil:

```text
OPENAI_MODEL=gpt-5.4-mini
OPENAI_REASONING_EFFORT=low
OPENAI_TEXT_VERBOSITY=medium
OPENAI_MAX_OUTPUT_TOKENS=1100
OPENAI_MAX_OUTPUT_TOKENS_CLIENT=1100
OPENAI_MAX_OUTPUT_TOKENS_WORKER=1100
```

Luna-eelne env-varukoopia on serveris ning selle asukohta hallatakse väljaspool repot. Mudeli rollback nõuab ainult frontend-teenuse restarti; RAG teenust, koodi, korpust ja retrieval'it ei muudeta. Rollback'i järel kontrollida teenust, avalehte, autentimisvalvet, sünteetilist chat-smoke'i, tegelikku `openai_usage.model` väärtust ja journalit.

---

## 18. Artefaktid ja harjastikud

### 18.1 Projekti artefaktid

Kõik asuvad `docs/internal/`:

- `gpt56-luna-comparison/` harul `ops/gpt56-luna-golden-comparison` — lukustatud Mini–Luna pimehindamine, tehniline võrdlus ja otsus;
- `gpt56-luna-release-validation/` — 8 küsimuse release-värav, mõlema mudeli Golden-37 järeljooks ja canary raport;
- `luna-rag-run-results.csv`;
- `luna-rag-comparison.md`;
- `luna-rag-raw-answers.md`;
- `luna-rag-sources.md`;
- `luna-rag-blind-test.md`;
- `luna-rag-blind-test-key.md`.

Tööpaketi E järel peavad artefaktid sisaldama:

- completion-status ja incomplete-põhjused;
- prompt-komponentide tokenijaotus;
- reasoning- ja non-reasoning output-tokenid;
- retrieval → `SourcePackage` → citation → displayed source toru;
- ühe- ja mitmevoorulised katsed eraldi;
- kehtivad ja kehtetud jooksud;
- kulude ja latentsuse võrdlus;
- lõplik soovitus.

### 18.2 Harjastikud serveris

Asukoht:

```text
~/luna-harness/
```

Failid:

- `calib.mjs`;
- `luna-batch.mjs`;
- `luna-run.mjs`;
- `probe.mjs`;
- `probe2.mjs`;
- `smoke2.mjs`;
- `usage-check.mjs`.

### 18.3 Muudetud koodifailid

- `lib/openaiUsage.js`;
- `lib/chat/promptTokenAudit.js`;
- `lib/chat/promptBuilder.js`;
- `lib/chat/openaiRuntime.js`;
- `lib/chat/settings.js`;
- `tests/chat/openaiUsageFields.test.js`;
- `tests/chat/promptTokenAudit.test.js`.

---

## 19. Otsuselogi

| Kuupäev | Otsus | Põhjendus |
|---|---|---|
| 31.07.2026 | tootmise mudeliseadistust ei muudeta | esimene Luna test oli 1100-tokeni lae tõttu valdavalt kehtetu |
| 31.07.2026 | projekti lõppsiht on kontrollitud üleminek Lunale | Luna avalik API ühikuhind on kõigis tokeniliikides 73,3% mini hinnast madalam; mini jääb baasjooneks ja rollback-mudeliks |
| 31.07.2026 | A ja B tehakse enne Golden-37 baasjoont | baasjoon vajab usaldusväärset logimist |
| 31.07.2026 | C ja D tehakse alles pärast baasjoont | käitumismuutuste regressiooni peab saama mõõta |
| 31.07.2026 | D ei kasuta globaalset kontaktikeeldu | kontaktipäringud vajavad kontaktallikaid |
| 31.07.2026 | T3 algversioon jääb alles | tootmisviga peab jääma regressioonitestiks |
| 31.07.2026 | E kasutab 3000 või kõrgemat lage | reasoning ja nähtav väljund jagavad output-eelarvet |
| 31.07.2026 | pimehindamine ainult completed-jooksudel | kärbitud vastus ei mõõda mudeli lõppkvaliteeti |
| 01.08.2026 | B0 idle-aken peatatakse ja otsus lükatakse edasi | omaniku prioriteet on kontrollitud Luna võrdlus ja kasutuselevõtt; valim jäi ebapiisavaks |
| 01.08.2026 | Luna on Mini ees tootmiskandidaat | lukustatud pimehindamine: 628/666 vs 573/666; Luna paarivõidud 30 vs 2 |
| 01.08.2026 | Harku allikalahknevus parandatakse enne canary't | teenuseankur ja kuvatud tõend peavad vastama samale KOV-ile ja teenusele |
| 01.08.2026 | „iga sotsiaaltöötaja loeb” on kontaktipoliitika | üldvastus näitab rollide mitmekesisust ega eelista meelevaldselt üht-kaht inimest |
| 01.08.2026 | Luna tootmiseelne canary aktiveeritakse | Luna ja Mini tugevdatud Golden-37 37/37; sihitud Luna värav 8/8 |

---

## 20. Vahetu järgmine tegevus

### Esimene ülesanne — canary seire ja avaliku avamise värav

1. hoida tootmiseelne konfiguratsioon `gpt-5.6-luna / medium / medium / 3000`;
2. jälgida completed/incomplete olekut, latentsust, tegelikku päringukulu ja vastuste pikkust;
3. auditeerida nullallikaga mitte-kriisipäringuid ning täpseid tasu-, tähtaja-, vormi- ja kontaktiväiteid;
4. kinnitada, et kuvatud allikas vastab samale KOV-ile ja samale teenusele;
5. kontrollida üldiste KOV-küsimuste rollipõhist kontaktide mitmekesisust;
6. kui canary värav ebaõnnestub, taastada Mini `low / medium / 1100` ja restartida ainult frontend;
7. avaliku avamise otsus teha pärast canary mõõdikute ülevaatust.

B0 idle-timeout'i täiendav mõõtmisaken on eraldi järgnev operatiivülesanne ega tohi canary seiret varjata. Tööpaketi B ülejäänud `rag_trace` ja incomplete-streami tööd jäävad avatuks; neid ei rakendata selle release-hardening'u osana.

---

## 21. Projekti lõpetamise kontrollnimekiri

- [x] A kalibreerimine lõpetatud ja auditilipp tagasi väljas
- [x] B0a/B0b aus veakäsitlus, request-ID ja timingud tootmises
- [ ] B0 idle-timeout'i esinemissageduse lõppotsus (edasi lükatud)
- [ ] `rag_trace` skeem ei kärbu
- [ ] B kaheksa allikakihti logitud
- [ ] incomplete streami lõpetamissignaal parandatud
- [x] Golden-37 Mini baasjoon ja Luna pimevõrdlus salvestatud ning lukustatud
- [ ] C planneri parandus ja regressioonitestid tehtud
- [x] D teenuseankru, atributsiooni ja kontaktipoliitika release-hardening tehtud
- [x] Golden-37 järelmõõtmine tehtud: Mini 37/37 ja Luna 37/37
- [x] sihitud Harku/no-corpus/kriisi/KOV regressioonid läbitud 8/8
- [x] 3000-tokeni Luna smoke läbitud ja tegelik mudel usage-event'iga kinnitatud
- [x] Luna 37 küsimuse võrdlus lõpetatud
- [x] ainult completed-jooksud pimehinnatud
- [x] hindamis- ja release-artefaktid uuendatud
- [x] Luna põhirežiim `medium + medium + 3000` kinnitatud tootmiseelseks canary'ks
- [x] tegelik Luna ja Mini päringukulu arvutatud päris tokenijaotuse põhjal
- [x] etapiviisiline Luna canary-, rollback- ja seireplaan kinnitatud
- [ ] canary mõõdikute ülevaatus ja avaliku avamise otsus

---

## 22. Lõplik soovituse formaat

Lõpparuanne peab andma ühe selge Luna põhirežiimi, vajaduse korral ühe erirežiimi ning kontrollitud üleminekuotsuse:

```text
Üleminekuotsus
- baasjoon: gpt-5.4-mini / low / medium
- sihtmudel: gpt-5.6-luna
- Golden-37 kvaliteedimuutus:
- tegelik päringukulu muutus:
- latentsuse muutus:
- rollout-etapid:
- rollback-kriteeriumid:

Põhirežiim
- model:
- reasoning effort:
- verbosity:
- max_output_tokens:
- eeldatav latency:
- eeldatav tokenikulu:
- sobivad kasutusjuhud:

Erirežiim
- käivitamise tingimus:
- model:
- reasoning effort:
- verbosity:
- max_output_tokens:

Tõendus
- Golden-37 enne/pärast:
- completed-jooksude kvaliteet:
- allikatoru kvaliteet:
- tokeni- ja latency-võrdlus:
- regressioonid:
- jääkriskid:
```

Tootmise muudatus tehakse alles pärast selle soovituse kinnitamist.
