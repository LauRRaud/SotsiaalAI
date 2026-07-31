# RAG / Luna verbosity-katse — üleandmine

**Kuupäev:** 31.07.2026
**Põhjus:** kontekstiaken sai täis; töö jätkub teise sessiooniga.
**Seis:** blokk A (instrumentatsioon) on koodis valmis ja serveris. Kalibreerimine (punkt 9) on **tegemata**. Blokid B–E on alustamata.

Loe see fail läbi enne ühegi muudatuse tegemist. Kõik numbrid siin on mõõdetud, mitte hinnatud.

---

## 1. Tootmise puhkeasend (kontrollitud 31.07 18:2x EEST)

| | |
|---|---|
| Server-commit | `f274190e` |
| GitHub `origin/main` | `f274190e` (push'itud) |
| Teenus | `sotsiaalai-frontend.service` — active |
| Töökataloog | `/home/ubuntu/apps/sotsiaalai` |
| Env-fail | `/etc/sotsiaalai/frontend.env` |
| `CHAT_PROMPT_TOKEN_AUDIT` | **0** (väljas) |
| `OPENAI_MODEL` | `gpt-5.4-mini` |
| `OPENAI_REASONING_EFFORT` | `low` |
| `OPENAI_TEXT_VERBOSITY` | `medium` |
| `OPENAI_MAX_OUTPUT_TOKENS` | `1100` (ka `_CLIENT`, `_WORKER`) |

**Rollback-sihtmärk:** `41c69a41` (viimane commit enne blokki A).
**Env varukoopia:** `/etc/sotsiaalai/frontend.env.bak-blokkA-2026-07-31`.

Env-hash muutus deploy käigus **ainult** seetõttu, et lisasin rea `CHAT_PROMPT_TOKEN_AUDIT=0`
(`4510252a7b39bf…` → `6acbe78110810886…`). Deploy ise env-i ei puutunud.

Mudel, effort, verbosity ja tokenilagi on **muutmata** — omanik keelas tootmise vaikeseadistuse
muutmise enne tulemuste esitamist.

### Mis on smoke'iga kinnitatud ja mis mitte

Kinnitatud pärast `f274190e` deploy'd: teenus active, avaleht HTTP 200, `/api/chat` ilma autentimiseta
HTTP 401 (valve töötab, ei ole 500), journalis uusi hoiatusi ega erandeid ei ole.

**Kinnitamata:** autenditud läbiv chat-smoke pärast `f274190e`. Vajab NextAuth-i sessiooniküpsist
(`__Secure-next-auth.session-token`) sisselogitud brauserist — `--bearer` lipp seda ei asenda.
Sama küpsist vajab kogu kalibreerimine. **Esimene samm järgmises sessioonis: hangi küpsis.**

Vahetult enne seda deploy'd oli sama kood (`f831257a`) täies mahus smoke'itud — mõlemad rajad
HTTP 200, A1 väljad ChatLog-is, payload muutumatu. `f274190e` muudab ainult ühe logisündmuse
võtmestruktuuri lipu taga, mis on väljas.

---

## 2. Mis on valmis (3 commit'i)

### `d068c519` — blokk A1: Responses API lõpetamis- ja kasutusväljad

`lib/openaiUsage.js`. Sündmus `openai_usage` kannab nüüd:

**Otse API-st:** `status`, `incomplete_reason` (`response.incomplete_details.reason`),
`max_output_tokens`, `input_tokens`, `cached_tokens`, `output_tokens`, `reasoning_tokens`,
`total_tokens`.

**Meie tuletatud:** `response_present`, `visible_output_tokens` (= `output_tokens − reasoning_tokens`),
`output_cap_reached` (= `output_tokens >= max_output_tokens`).

Kärbe on nüüd tuvastatav API väljadest, mitte teksti lõpumärgist.

### `f831257a` — blokk A2: prompt-komponentide tokeniaudit

`lib/chat/promptTokenAudit.js` (uus), `promptBuilder.js`, `openaiRuntime.js`, `settings.js`.

- Lipp `CHAT_PROMPT_TOKEN_AUDIT=1`, vaikimisi väljas.
- Mõõdab **vahetult enne OpenAI-kutset**, pärast promptBuilder'it ja kõiki dünaamilisi lisasid.
- Komponendid: `system_prompt`, `user_input`, `conversation_history`, `source_package`,
  `tool_definitions`, `other_dynamic`. Igaühe kohta märgikogus, `*_tokens_estimated` ja
  sha256 esimesed 12 märki. **Sisu ei logita** — selle peale on eraldi test.
- Tokeniseerija: `js-tiktoken` 1.0.21, täispinnitud (`--save-exact`). `gpt-5.6-luna` ei ole
  paketis nime järgi toetatud → fallback `o200k_base` (kontrollitud).
- Singleton, lazy-load: ka lipp sees ei laeta tokeniseerijat käivitamisel, vaid alles esimesel mõõtmisel.
- Mõõtmise viga ei kuku päringut — hoiatus konsooli, edasi ainult märgikogused + API `usage.input_tokens`.
- Ühendatud mõlema rajaga: `callOpenAI` (stream: false) ja `streamOpenAI` finally-plokk (toodang).

Tõestatud jooksuga, mitte lubatud:

```
lipp VÄLJAS: {"flag":false,"komponendid_kogutud":false,"js_tiktoken_laetud":false}
lipp SEES:   {"flag":true, "komponendid_kogutud":true, "js_tiktoken_laetud":false}
```

### `f274190e` — parandus: 30-võtme lagi

Vt ptk 3. Komponendid on nüüd pesastatud objektis `components`, ülemisi võtmeid 15.

**Testid:** 1993/1993 rohelised. Lint puhas muudetud failidel.

---

## 3. LAHTINE LEID — `redactObject` kärbib iga ChatLog-sündmuse 30 võtme peale

`lib/privacy/safeError.js:6` → `MAX_OBJECT_KEYS = 30`.

Avastasin selle, kui minu auditisündmuse viimased kolm välja (`input_token_gap`,
`input_token_gap_pct`, `estimate_note`) kadusid logist **ilma ühegi veata**. Kirjes oli 33 võtit.

Oma sündmuse parandasin. **Aga sama lagi puudutab olemasolevat `rag_trace` sündmust:**
DB-s on selle võtmearv **täpselt 30** — see on kärpe allkiri, mitte juhus.

Tagajärg: osa `rag_trace` välju ei jõua andmebaasi, ja iga analüüs, mis loeb ChatLog-ist
(sh RAG-QM), töötab poolikute andmetega. Minu Luna-analüüsi see ei mõjuta — lugesin trace'i
API vastusest, mitte logist.

**See on eraldi uurimist vääriv tootmisviga, mitte testiartefakt.** Enne bloki B
instrumentatsiooni tuleb otsustada, kas tõsta lage, pesastada `rag_trace` või mõlemat —
muidu uued B-väljad kaovad täpselt samamoodi vaikselt ära.

---

## 4. Mis on olemasolevatest andmetest juba selgunud

Need on 31.07 tehtud 32 jooksu (`gpt-5.6-luna`, effort medium, A = verbosity medium,
B = verbosity low) analüüsi tulemused. Artefaktid on uuendatud.

### Punkt 2 — lahendatud: erinevust 21 ja 24 vahel ei ole

Kolm lisajuhtumit olid **minu heuristiku valepositiivid**:

- `T8-r1-B`, `T8-r2-B` lõppevad eestikeelse sulgeva jutumärgiga `“` (U+201C). Regex tundis ainult `”` (U+201D).
- `T1-r2-B` lõppeb kaldkriipsuga URL-iga — terve lõpp.

Tegelik arv: **21 kärbitut, 11 tervet**, kattub täpselt `output_tokens == 1100` loendiga.
Omaniku juhis mitte kasutada „keset lauset lõppemist" põhikriteeriumina on andmetega tõestatud.

### Punkt 10 — osaline vastus tagantjärele

`reasoning_tokens` ja `cached_tokens` olid juba varem logitud; ma lihtsalt ei küsinud neid.
**Ainult tervete jooksude pealt:**

| Variant | Terveid | output | reasoning | nähtav (output − reasoning) |
|---|---|---|---|---|
| A (medium) | 3 | 854 | 183 | 671 |
| B (low) | 8 | 817 | 238 | 579 |

- Nähtava väljundi vahe **−14%** — esimene tokenipõhine tõend verbosity=low säästu kohta.
- Kogu `output_tokens` vahe on ainult **−4%** (sisaldab reasoning'ut).
- Märgikoguse vahe **−27%** on suuresti kärpeartefakt (A kärbiti sagedamini).

`reasoning_tokens` 32 jooksus: min 99, max 1034, keskmine 324.
**Halvimal juhul jäi 1100-tokenilisest eelarvest nähtavale vastusele 66 tokenit.**

Valim on väike — see ei asenda puhast kordust (blokk E).

### Punkt 7 — lahendatud: T1 „kuvatud allikad" on üheksa eri arvu

| Kiht | T1 |
|---|---|
| retrieved chunks | 100 |
| retrieved unique documents | 81 |
| selected context chunks | 41 |
| unique selected sources | 38 |
| SourcePackage'i pakid | 20 |
| model-cited sources (`answer_source_count`) | 6 |
| displayed unique ids | 6 |
| `displayed_sources` massiiv API vastuses | 9 |
| unikaalsed pealkirjad kuvatute seas | 4 |

CSV kasutas 6, `sources.md` kasutas 4, ja ma nimetasin 38 „valitud kontekstiks", kuigi valitud
kontekst oli 41. Kõik kolm etteheidet pidasid paika. Artefaktid kasutavad nüüd samu definitsioone;
CSV-l on 29 veergu, sh päris API-tokenid.

**Uus lahknevus:** `displayed_sources` massiivis 9 kirjet, `displayed_source_ids`-s 6 unikaalset id-d.
Need kaks ei ole kooskõlas → kuulub blokki B.

### Punkt 6 — juurpõhjus leitud, uut koodi ei olnud vaja

T2 low puhul **mudel ei loonud ühtegi viidet** (`answer_source_ids: []`), ja atributsioonifilter
märkis kõik valitud allikad välja põhjustega `insufficient_evidence_strength` ja
`query_anchor_mismatch`. `displayed_source_count` **ei olnud valesti arvutatud** — null oli aus.

**Eraldi leid:** SHS § 70 „Erihoolekandeteenuse taotlemine" filtreeriti *erihoolekande* küsimuse
juures välja põhjusega `query_anchor_mismatch`. See on valepositiiv ja väärib omaette uurimist (blokk B).

### Punkt 8 — analüüs tehtud, parandus tegemata

T1 38-st valitud allikast:

| Tüüp | Arv |
|---|---|
| Kontaktikirje (nimi, e-post, telefon) | **32** |
| Teenuseleht | 3 |
| Õigusakti paragrahv | 3 |

Läbi saanud õigusaktilõigud:

- `kov-rt-johvi-vald|paragraph-46` — Isikliku abistaja teenuse taotlemine, määramine ja osutamine
- `kov-rt-poltsamaa-vald|paragraph-89` — Hüvitise taotlemine
- `kov-rt-saku-vald|paragraph-20` — Isikliku abistaja määramine

Jõhvi § 46 ja Saku § 20 on täpselt need paragrahvid, kus sugulasekeeld ja üheaastane tähtaeg asuvad.
Põltsamaalt valiti § 89 (taotlemine), **mitte** § 87 (eesmärk) ega § 90 (sobivuse hindamine) — ehk
just see paragrahv, mille põhjal keelu puudumist järeldada ei saa.

Vastus ei jäänud puudulikuks sisu puudumise, vaid **32 kontaktikirje väljatõrjumise** tõttu.
Küsimus ei sisaldanud sõna „kontakt" ega „spetsialist".

**Privaatsusnurk, mida keegi ei tellinud:** 32 nimelise ametniku e-post ja telefon saadeti mudelile
konteksti küsimuse juures, mis neid ei vajanud.

### Kus API-väljad striimimisrajal kaovad (punkti 1 eraldi nõue)

| Rada | Seis |
|---|---|
| `stream: false` (harjastik) | kõik väljad olemas |
| `stream: true` (toodang), normaalne lõpp | kõik väljad olemas |
| `stream: true`, katkestatud või vigane voog | **kõik kaob korraga** |

Täpne koht: `lib/chat/openaiRuntime.js`, `streamOpenAI` finally-plokk, rida
`await stream.finalResponse().catch(() => null)`. Stop-nupp või voo viga → kogu vastuseobjekt
muutub `null`-iks. Nüüd eristab seda `response_present: false`.

**Boonusleid samast rajast:** iteraator väljastab `done` **ainult** sündmusel `response.completed`.
Kui vastus on incomplete, seda sündmust ei tule ja klient ei saa mingit lõpetamissignaali — voog
lihtsalt lõpeb ja kasutaja ei näe, et vastus jäi pooleli. Kuulub blokki B.

### Kõrvaljuhtum: külmstardi `rag_error`

Esimene päring pärast restarti kukkus RAG-otsingus: `rag_error`,
`error_message: "This operation was aborted"`. Kutse ei jõudnud mudelini, `openai_usage` rida ei tekkinud.
Kordus sooja süsteemi peal oli korras. `rag_error` on ajaloos haruldane — kokku kaks korda üldse
(12.06 ja 31.07), mõlemad külmstardi kontekstis. Blokk A retrieval'i ega timeout'e ei puuduta.
**Esimene päring pärast iga restarti on riskirühm** — väärib eraldi märkust.

---

## 5. JÄRGMINE SAMM — kalibreerimine (punkt 9), pooleli jäänud

Omanik andis 10-sammulise juhise; sammud 1–6 on tehtud, **7–10 on tegemata**.

Esimene kalibreerimiskatse jooksis läbi (20 päringut, kõik HTTP 200, 0 kuni 41 kontekstitükki,
viis eri planneri režiimi), aga **tulemused olid kasutuskõlbmatud**: `input_token_gap`,
`input_token_gap_pct` ja `estimate_note` olid 30-võtme lae taha kadunud. Seetõttu tuleb kalibreerimine
**pärast `f274190e` deploy'd otsast peale teha**.

### Töövoog

1. **Hangi sessiooniküpsis** sisselogitud brauserist (`__Secure-next-auth.session-token`).
2. Lülita aken lahti:
   ```
   CHAT_PROMPT_TOKEN_AUDIT=1
   ```
   (`/etc/sotsiaalai/frontend.env`, siis `systemctl restart sotsiaalai-frontend.service`)
3. Kontrolli pärast esimest päris mõõtmist:
   - `js-tiktoken` on lazy-load'itud;
   - kõik `*_tokens_estimated` on arvulised;
   - hashid ja märgikogused olemas;
   - **prompti, RAG_CONTEXT-i ega kasutaja teksti sisu logisse ei leki**;
   - API payload ise ei muutu;
   - `input_token_gap` **jõuab nüüd kohale** (see oli eelmise katse ainus tõrge).
4. Vähemalt 10 kalibreerimispäringut: 2 ilma RAG-ita, 2 väikese SourcePackage'iga,
   2 suure SourcePackage'iga, 2 vestlusajalooga, 2 muud struktuuri.
5. Kalibreeri **eraldi** toodangu streaming-rada ja `stream:false` testirada.
   Ära sega neid üheks statistikaks enne, kui `input_token_gap` käitumine on võrreldav.
6. Raporteeri: `usage.input_tokens`, `estimated_component_sum`, `input_token_gap`, gap %,
   mediaan, maksimum, võimalusel p95 — päringutüübi ja raja kaupa.
7. **Pane lipp tagasi 0**, restardi, kinnita et uue protsessi käivitamisel tokeniseerijat ei laeta.

### Teadaolev piirang

`buildResponsesPayload` **ei saada mudelile ühtegi tööriista** — payloadis pole `tools` võtit.
Seega `tool_definitions_tokens_estimated = 0` struktuurselt. Raporteeri see nii ja märgi, et
tööriistadega kalibreerimist praegune süsteem ei võimalda. Komponent on koodis alles, et see ei
jääks märkamata, kui tööriistad kunagi lisanduvad.

Gap ei ole ainult tokeniseerija viga — seal võivad olla sõnumite struktuur, rollimärgised,
API ümbrised ja mõni mõõtmata sisendkomponent. Ära nimeta lokaalseid arve täpseteks enne, kui
vahe on väike ja stabiilne. `usage.input_tokens` jääb autoriteetseks koguarvuks.

---

## 6. Kokkulepitud järjekord (omaniku kinnitatud)

```
A + B instrumentatsioon
  → Golden-37 baasjoon ENNE parandusi
    → C ja D parandused
      → Golden-37 pärast parandusi + T1/T3 regressioonid
        → E: smoke 3000 + 32 jooksu kordus
```

| Blokk | Punktid | Sisu | Seis |
|---|---|---|---|
| **A** | 1, 9, 10 | API completion/usage + prompt-komponentide tokenid | kood **valmis + serveris**; kalibreerimine tegemata |
| **B** | 6 | 8-etapiline allikatoru logi; `displayed_sources` 9-vs-6; `query_anchor_mismatch` valepositiiv; incomplete-voo lõpetamissignaal | alustamata |
| **Golden-37** | — | baasjoon **praeguse** käitumisega, A+B logimisega, **enne** C/D | alustamata |
| **C** | 4 | Planneri rolliviga (T3). **Tootmisviga, mitte testiprobleem** | alustamata |
| **D** | 8 | Kontaktimüra piiramine | blokeeritud kuni Golden-37 |
| **E** | 3, 11, 12 | Lagi 3000, smoke 2–3 ülesandega, siis 32 jooksu | viimasena |

### Blokk C — nõutud regressioonitestid

Paranduse järel peavad testid katma vähemalt:

- professionaal kirjeldab **esimeses isikus oma tööülesannet** (algne T3 — **ära eemalda**, jääb regressioonitestiks);
- klient kirjeldab esimeses isikus enda olukorda;
- professionaal tsiteerib kliendi esimeses isikus sõnastust;
- `needs_rag=true` ja `should_run_rag=false` vastuolu.

Trace peab jääma sisemiselt kooskõlaliseks: `input_role` jääb `SOCIAL_WORKER`, `role` ei muutu
ekslikult `client`-iks, `needs_rag` ja `should_run_rag` ei ole vastuolus, RAG käivitub kui ülesanne
vajab korpuse allikaid.

Verbosity-võrdluseks võib **kõrvale** lisada ümber sõnastatud T3 variandi.

### Blokk D — sihitud, mitte globaalne

Omaniku põhimõte:

- kontaktikavatsusega päring → kontaktallikad lubatud;
- õiguse, tingimuste, võrdluse või teenuse sisu päring → kontaktid tugevalt alandatud või välistatud;
- vajalikud õigusaktilõigud **reserveeritakse enne** kontaktkirjeid.

Ainult T1 regressioonitest ei ole piisav — kontaktide filtreerimine võib mõjutada päringuid, kus
kontaktallikas on päriselt vajalik. Sellepärast Golden-37 enne.

### Blokk E — korduskatse tingimused

`gpt-5.6-luna`, effort medium, A = verbosity medium, B = verbosity low, 8 ülesannet,
2 jooksu kummagi variandiga, sama roll/korpus/süsteemiprompt/retrieval, pööratud järjekord teises
tsüklis, uus vestlus iga sõltumatu jooksu jaoks, **T6 eraldi mitmevoorulise katsena**.

Enne täisjooksu: `OPENAI_MAX_OUTPUT_TOKENS_WORKER=3000` ja 2–3 smoke-ülesannet, igaühel kinnitatud
`status == "completed"`, `incomplete_details` puudub, vastus lõpeb loomulikult, allikaviited jõuavad
kasutajani, `output_tokens` ei ole pidevalt täpselt 3000. **Kui mõni jääb incomplete — ära käivita
32 jooksu**, selgita põhjus ja tõsta lage.

Pimehindamise rubriik ainult completed-jooksudele. Incomplete või tehniliselt katkenud jooks =
kehtetu, kvaliteedipunkte ei saa.

**T6 hoiatus:** T6 sisend sisaldab T5 erinevat assistant-vastust, seega sisendajalugu **ei ole**
variantide vahel identne. Ära väida, et ainus erinevus oli API verbosity parameeter. Puhta
sünteesivõrdluse jaoks võib teha lisajooksu identse fikseeritud T5 kokkuvõttega.

---

## 7. Reeglid, mis kehtivad kogu töö vältel

- **Ära muuda tootmise vaikeseadistust** (model / effort / verbosity / tokenilagi) enne, kui
  tulemused ja soovitus on esitatud.
- **Ära käivita Luna 32 jooksu kordust** enne blokke A–D ja Golden-37.
- **Ära muuda retrieval'i üldisi parameetreid** enne baasjoone säilitamist.
- **Ära eemalda algset T3 ülesannet.**
- Logi ainult mahud, tokeniarvud, hash või muu mittetundlik identifikaator — **mitte** süsteemiprompti,
  SourcePackage'i ega tundlike andmete sisu.
- Kohalik tokeniarv on **hinnanguline**; `usage.input_tokens` on autoriteetne.

---

## 8. Praktiline pagas

### Artefaktid (kõik `docs/internal/`)

- `luna-rag-run-results.csv` — 29 veergu, sh päris API-tokenid
- `luna-rag-comparison.md` — kihitabelid, striimimisraja analüüs, punktide 2/6/7/8/10 vastused
- `luna-rag-raw-answers.md`
- `luna-rag-sources.md` — allikakihtide tabel
- `luna-rag-blind-test.md`, `luna-rag-blind-test-key.md`

Blokis E tuleb kõik neli uuendada ja lisada tabelid: completion status ja incomplete põhjused;
input-tokenite komponentide jaotus; reasoning- ja nähtava väljundi tokenid; retrieval → SourcePackage
→ citation → displayed source toru; ühevoorulised ja mitmevoorulised katsed; kehtivad ja kehtetud jooksud.

### Harjastikud (serveris, päästetud `/tmp`-st)

`~/luna-harness/` — `calib.mjs`, `luna-batch.mjs`, `luna-run.mjs`, `probe.mjs`, `probe2.mjs`,
`smoke2.mjs`, `usage-check.mjs`.

Kõik chat-päringuid tegevad skriptid vajavad `TEST_SESSION_COOKIE` env-muutujat.

### Muudetud koodifailid

- `lib/openaiUsage.js` — A1
- `lib/chat/promptTokenAudit.js` — A2 (uus)
- `lib/chat/promptBuilder.js`, `lib/chat/openaiRuntime.js`, `lib/chat/settings.js` — A2 ühendus
- `tests/chat/openaiUsageFields.test.js`, `tests/chat/promptTokenAudit.test.js` — uued

### Käsud

```bash
ssh sotsiaalai
```

```bash
npm run deploy:server
```

```bash
npm test
```
