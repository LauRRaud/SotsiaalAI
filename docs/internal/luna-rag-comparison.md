# GPT-5.6 Luna: verbosity medium vs low SotsiaalAI RAG-toru peal

Jooksutatud 31.07.2026, SotsiaalAI produktsiooniserveris `/api/chat` kaudu.
Mudel `gpt-5.6-luna`, `reasoning.effort = medium` mõlemal variandil.
**A = verbosity medium**, **B = verbosity low**. 8 ülesannet × 2 jooksu × 2 varianti = 32 jooksu.

Seotud failid: `luna-rag-run-results.csv`, `luna-rag-raw-answers.md`, `luna-rag-sources.md`,
`luna-rag-blind-test.md`, `luna-rag-blind-test-key.md`.

---

## Peamine järeldus: see katse ei mõõtnud seda, mida pidi

**21 jooksu 32-st lõppesid täpselt 1100 output-tokeni peal** (`openai_usage` ChatLog-sündmustest,
keskmine 1006). Ülejäänud 11 lõppesid loomulikult.

> **Parandus 31.07 (2. analüüsivoor).** Esialgu raporteerisin siin „24 tekstiliselt katkenud
> vastust" ja käsitlesin vahet 21-ga lahtise küsimusena. Vahet ei ole: kolm lisajuhtumit olid
> minu tekstiheuristiku valepositiivid. `T8-r1-B` ja `T8-r2-B` lõppevad korrektselt eestikeelse
> **sulgeva jutumärgiga `“`** (U+201C), mida mu regex ei tundnud (tundis ainult U+201D), ja
> `T1-r2-B` lõppeb URL-iga, mis lõpeb kaldkriipsuga. Õige arv on **21 kärbitut / 11 tervet**,
> mis kattub API tokeniarvuga täpselt. Keset lauset lõppemine ei kõlba kärpekriteeriumiks.

Põhjus on mehaaniline: Responses API-s katab `max_output_tokens` **nii reasoning- kui
väljundtokenid**. `effort = medium` kulutab olulise osa 1100-tokenilisest eelarvest mõtlemisele
ja nähtavale vastusele jääb ülejääk. Vastus ei lõpe seetõttu, et mudel lõpetas mõtte, vaid
seetõttu, et eelarve sai otsa.

See tähendab, et **rubriigipõhine hindamine mõõdaks peamiselt seda, kes jõudis enne lakke** —
mitte seda, kas verbosity=low säilitab olulise info. Ma ei anna seetõttu kuue kategooria
punktisummasid: need näeksid täpsed välja ja mõõdaksid artefakti. Allpool on see, mida andmed
päriselt kannavad.

### Mida see iseenesest tõestab

Praegune tootmiskonfiguratsioon (`OPENAI_MAX_OUTPUT_TOKENS_WORKER = 1100`) **ei ole ühildatav
reasoning effort'iga `medium`**. Kui effort tõsta, tuleb lagi tõsta koos sellega — muidu saab
kasutaja poolikuid vastuseid. Praegune toodang jookseb `effort = low` peal, nii et see ei ole
täna esinev viga, vaid tingimus mistahes tulevasele effort-tõstmisele.

---

## Mõõdetud tulemused

| Mõõdik | A (medium) | B (low) | Vahe |
|---|---:|---:|---:|
| Vastuse pikkus, keskmine | 2575 märki | 1884 märki | **−27%** |
| Latents, keskmine | 15 916 ms | 15 576 ms | −2% |
| Kärbitud vastuseid (`output_tokens == 1100`) | **13/16** | **8/16** | — |
| Retrieval'i tulemus | identne | identne | 0 |

> Kärpearvud on API `output_tokens` põhjal, mitte teksti lõpumärgi järgi.

### Pikkusvahe −27% EI ole tõestatud tokenisääst

Ainult **tervete** (kärpimata) jooksude API-tokenid:

| | Terveid jookse | `output_tokens` | Keskmine |
|---|---:|---|---:|
| A (medium) | 3/16 | 820, 732, 1011 | **854** |
| B (low) | 8/16 | 748, 960, 973, 446, 432, 1019, 1040, 921 | **817** |

Vahe on **~4%**, mitte 27%. Märgikoguse 27% vahe tuleb valdavalt sellest, et A kärbiti sagedamini
ja tema nähtav tekst lõppes varem — see on artefakt, mitte sääst. Lisaks on valim kaldu:
A terveid jookse on ainult kolm ja need on tema lühimad.

**Verbosity=low tokenisääst on selle katsega kinnitamata.** Seda saab kinnitada alles siis, kui
kõik jooksud lõpevad `status: "completed"` ja `output_tokens` võrreldakse eraldi
`reasoning_tokens`-ist (vt nõue 10).

Pikkuse vahe ülesannete kaupa (B/A):

| | T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| B/A | 0,60 | 0,76 | **0,24** | 0,86 | 1,01 | 0,82 | 0,88 | **0,51** |

**Latents ei erine.** See on ootuspärane: aeg kulub reasoning'ule ja retrieval'ile, mitte
väljundi pikkusele. Verbosity langetamine **ei ole jõudlusvõit**.

---

## Retrieval oli variantide vahel bitthaaval identne

Iga ülesande kohta olid `retrieved_count`, `selected_context_count`, `selected_source_count`,
`displayed_source_count`, `query_plan.mode`, `rag_risk_level`, `retrievers_used` ja graph-kanali
kasutus **A ja B vahel täpselt samad**, mõlemas jooksus.

See on katse sisemise valiidsuse jaoks hea uudis: ainus muutuja oli tõesti verbosity.
Retrieval'i varieeruvus jooksude vahel = **0**.

---

## Kolm RAG-leidu, mis ei ole verbosity'ga seotud

### 1. T3: RAG-i ei käivitatud üldse (korduv, 4/4 jooksu)

`retrievers_used: []` — otsing ei jooksnud. Planner otsustas:

```
external_sources_needed: false
should_run_rag: false
question_planner: { input_role: "social_worker", role: "client", role_confidence: 0.86,
                    needs_rag: true, confidence: 0.4,
                    planner_reason: "first_person_life_situation", topics: [] }
```

Küsimuse sõnastus („**Kirjutan** meie hooldekodu arendusplaani… **Vajan** ausat pilti…") loeti
esimeses isikus elusituatsiooniks, roll kirjutati sotsiaaltöötajast **kliendiks** ümber ja
väliste allikate vajadus lülitati välja. Registris on 19 dementsuseteemalist artiklit, mis
otsinguga leiduvad — sisu oli olemas, päring ei jõudnud selleni.

Trace'i sisemine vastuolu: `question_planner.needs_rag: true`, aga ülemine `should_run_rag: false`.

**Tööpraktiline mõju:** sotsiaaltöötaja, kes kirjeldab oma tööülesannet esimeses isikus, võib
saada vastuse ilma ühegi allikata, ja süsteem ei ütle talle seda.

### 2. Pooltel ülesannetel kuvati kasutajale null allikat

T2, T4 ja T7 valisid 4–5 allikat ja kuvasid **null**. T3 ei valinud ega kuvanud midagi.
Ehk 4 ülesannet 8-st jõudsid kasutajani ilma allikaviideteta.

See on sama nähtus, mis RAG-QM-P0 baasjoonel andis `selected_without_display_rate = 11,5%`.
Selles valimis on see 50%.

### 3. Valitud kontekst on peaaegu kõikjal täpselt 4

| | T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| valitud allikaid | 38 | 4 | 0 | 4 | 4 | 4 | 5 | 4 |

Ülesanded olid projekteeritud vajama 3–7 sisuliselt vajalikku dokumenti; ainult T1 sai
mitmeallikalise konteksti. See tähendab, et **testi allikakatvuse mõõde ei olnud kummalegi
variandile täidetav** — piirang tuli retrieval'ist, mitte verbosity'st.

---

## Kvalitatiivne võrdlus seal, kus see on aus

Lugesin läbi T1 ja T3 mõlema variandi vastused. Ülejäänud kuue ülesande vastused on
`luna-rag-raw-answers.md`-s, aga ma ei andnud neile punkte, sest kärpelagi otsustas tulemuse.

### T1 — isikliku abistaja võrdlus

Mõlemad **keeldusid õigesti** väitmast, et tingimused on samad või erinevad, ja ütlesid välja,
et kättesaadav väljavõte ei kanna järeldust. Kumbki ei toonud välja ühtegi kolmest
verbosity-tundlikust punktist (Saku üheaastane tähtaeg, Jõhvi karistatuse tingimus, Põltsamaa
keelu puudumine) — aga ka retrieval ei toonud neid lõike konteksti, ainult paragrahvide pealkirjad.

**B oli parem.** Sama sisu 40% lühemalt, **pluss kolm Riigi Teataja otselinki** edasi
kontrollimiseks. Kontrollisin kaks neist varem loetud lõikude vastu (`423122025040` Jõhvi,
`421062023039` Põltsamaa) — õiged, mitte väljamõeldud. A kulutas ruumi regulatsioonide
ülesehituse kirjeldamisele, mida kasutaja ei küsinud.

### T3 — null allikat

Mõlemad alustasid sõnaga „Aus vastus:" ja tunnistasid, et kontrollitud allikaid ei ole.
Erinevus tuli edasi:

- **B (202 ja 751 märki):** lõpetas seal. Ei täitnud tühjust.
- **A (2050 ja 1987 märki):** jätkas kolmetasandilise sisulise raamistikuga pikaajalise hoolduse
  arengutest — **ilma ühegi allikata**. Hedge'itud, aga sisulised väited siiski.

Võtme järgi on see A puudujääk kategoorias „ebakindluse ja allikapiiride aus käsitlemine":
tunnistada allikate puudumist ja seejärel kirjutada 2000 märki sisu on vastuolus.

---

## Miks kuvati null allikat: juurpõhjus leitud (nõue 6, osaline)

T2 ja T7 puhul on vastus juba olemasolevas trace'is, uut instrumentatsiooni ei olnud vaja.

**Mudel ei loonud ühtegi viidet.** `answer_source_ids: []` ja `section_attribution: []` mõlemas
variandis. Seejärel filtreeris atributsioonikiht kõik valitud allikad välja, kirjas põhjustega:

| Ülesanne | Allikas | `filter_reason` |
|---|---|---|
| T2 | Praxis 2014 „KOV-i poolt tasu nõudmine" | `insufficient_evidence_strength` |
| T2 | Sotsiaaltöö 2023 „Suure hoolduskoormusega inimesed" | `insufficient_evidence_strength` |
| T2 | Sotsiaaltöö 2019 „Püsivaesus ja vaesus" | `query_anchor_mismatch` |
| T2 | Sotsiaaltöö 2021 „Eesti inimeste toetamine" | `query_anchor_mismatch` |
| T7 | EPIKoja eestkostetavate uuring 2026 | `query_anchor_mismatch` |
| T7 | **SHS § 70 „Erihoolekandeteenuse taotlemine ja otsuse tegemine"** | `query_anchor_mismatch` |
| T7 | Praxis „Täiskasvanud erivajadusega inimeste abivajaduse hindamine" | `query_anchor_mismatch` |

Sinu hüpoteesiloendist vastavad tõele **„mudel ei loonud viidet"** ja osaliselt **„jõustamiskiht
eemaldas viite"** — filter jooksis ja logis põhjused, aga eemaldada polnud midagi, sest viiteid
ei tekkinud; ta klassifitseeris valitud allikad kasutuskõlbmatuks. `displayed_source_count`
arvutus ei olnud vale — null oli aus.

**Eraldi leid:** SHS § 70 filtreeriti erihoolekande küsimuse juures välja põhjusega
`query_anchor_mismatch`. See on täpselt teemakohane paragrahv. `query_anchor_mismatch` annab
siin valepositiivi ja see väärib omaette uurimist.

Mõlemas variandis identne — verbosity'ga seost ei ole.

## Soovitus tootmise vaikeseadistuse kohta

**Ära muuda praegu midagi.** Jää `effort = low` + `verbosity = medium` juurde, mis on täna sees.

Põhjendus:

1. **Verbosity=low ei tõestanud end selles katses**, sest katse ei olnud puhas. Ta ei näidanud ka
   kahju: võtmepunktide kadu ei olnud tuvastatav ja kahel ülesandel (T1, T3) oli lühem vastus
   **sisuliselt parem**. Aga tokenisääst on kinnitamata — tervete jooksude vahe on ~4%, mitte 27%.
2. **Verbosity=low ei ole jõudlusvõit** — latents on identne. Ainus võit on tokenikulu.
3. **Effort=medium ei ole 1100-tokenilise laega kasutatav.** Kui tahad effort'i tõsta, tõsta
   koos sellega `OPENAI_MAX_OUTPUT_TOKENS_WORKER` vähemalt 2500–3000 peale ja mõõda uuesti.

### Puhas kordus maksab vähe

Harjastik on olemas ja töötab: `/tmp/luna-batch.mjs` + `/tmp/luna-q/` serveris, `TEST_SESSION_COOKIE`
paigas, jooks võtab ~2,5 min paki kohta. Puhta korduse tingimused:

- `OPENAI_MAX_OUTPUT_TOKENS_WORKER = 3000` (ajutiselt, testi ajaks);
- kõik muu sama;
- eeltingimusena T3 planneri-viga parandatud või T3 asendatud, muidu jääb üks ülesanne tühjaks.

---

## Blokk A1: kus API väljad kaovad (nõue 1)

Kaardistatud koodist, mitte oletusest.

| Rada | Kus vastus tekib | `status` / `incomplete_details` / `usage` |
|---|---|---|
| **`stream: false`** (testiharjastik) | `client.responses.create()` → täisobjekt | **Kõik olemas** |
| **`stream: true`** (toodangu `/api/chat`) | `stream.finalResponse()` `finally`-plokis | Olemas, **kui voog lõpeb normaalselt** |
| **`stream: true`, katkestatud või vigane voog** | `.catch(() => null)` samas plokis | **Kõik kaob korraga** |

Täpne kadumiskoht: [openaiRuntime.js](../../lib/chat/openaiRuntime.js) `streamOpenAI` `finally`-plokk,
rida `const finalResponse = await stream.finalResponse().catch(() => null)`. Kui kasutaja vajutab
Stop või voog viskab vea, muutub kogu vastuseobjekt `null`-iks ja kõik kasutusväljad logitakse
nullina.

**Enne A1 muudatust** ei olnud see eristatav olukorrast, kus vastus oli olemas, aga `usage` puudus.
Nüüd eristab seda `response_present: false`.

**Teine leid samast rajast:** iteraator väljastab `done` ainult sündmusel `response.completed`.
Kui vastus on `incomplete` (nt tokenilagi täis), sellist sündmust ei tule ja klient ei saa
lõpetamissignaali — voog lihtsalt lõpeb. Kasutaja ei näe, et vastus jäi pooleli. See on lahtine
leid, mis kuulub bloki B juurde.

### Mis A1-ga lisandus logisse

`openai_usage` ChatLog-sündmus kannab nüüd lisaks senisele: `response_present`, `status`,
`incomplete_reason`, `max_output_tokens`, `total_tokens`, `visible_output_tokens`
(= output − reasoning) ja `output_cap_reached` (API väljadest, mitte tekstist).

`input_tokens`, `cached_tokens`, `output_tokens` ja `reasoning_tokens` olid juba varem olemas —
neid lihtsalt ei küsitud välja. Tänu sellele on nõue 10 osaliselt vastatav **tagantjärele**,
juba tehtud 32 jooksu pealt:

| | Terveid jookse | `output_tokens` | `reasoning_tokens` | **nähtav väljund** |
|---|---:|---:|---:|---:|
| A (medium) | 3 | 854 | 183 | **671** |
| B (low) | 8 | 817 | 238 | **579** |

**Nähtava väljundi vahe −14%.** See on esimene tokenipõhine tõend verbosity=low säästu kohta —
tugevam kui märgikogus (−27%, kärpeartefakt), ausam kui kogu `output_tokens` (−4%, sisaldab
reasoning'ut). Valim on väike ja kaldu (A terveid jookse ainult kolm), nii et see ei asenda
puhast kordust.

`reasoning_tokens` kõigis 32 jooksus: min 99, max **1034**, keskmine 324. Halvimal juhul jäi
1100-tokenilisest eelarvest nähtavale vastusele **66 tokenit**. `cached_tokens > 0` oli 14/32
jooksus (teine tsükkel sai prompt-caching'ust kasu).

## Metoodika ja piirid

- **Autentimine:** testkonto sessiooniküpsis ainult `TEST_SESSION_COOKIE`-st, serveris failis
  õigustega 600. Väärtust ei logitud, ei salvestatud ega commit'itud.
- **Roll:** konto on ADMIN, kuid `/api/chat` effektiivne roll oli `SOCIAL_WORKER`
  ([authz.js:33](../../lib/authz.js#L33): admin → `adminViewRole || "SOCIAL_WORKER"`).
  `sotsiaalai_admin_view_role` küpsist ei saadetud üheski jooksus.
- **Vestlused:** `persist: false`, iga jooks uues vestluses ilma ajaloota. Erand: **T6 saadeti
  alati kohe T5 järel sama vestluse ajalooga**, nagu ülesanne nõuab.
- **Järjekord:** tsükkel 1 = A jooks 1 → B jooks 1; tsükkel 2 = B jooks 2 (pööratud
  ülesandejärjekord) → A jooks 2 (pööratud). Kolm restarti, iga kord kontrollitud jooksva
  protsessi keskkonnast (`/proc/<pid>/environ`), mitte ainult env-failist.
- **Payload kinnitatud:** `scripts/smoke-openai-payload-settings.mjs --live` enne iga varianti;
  OpenAI kajastas vastuses tagasi mudeli, `reasoning.effort` ja `text.verbosity`. Kõik `PAYLOAD_OK`.
- **Ei mõõdetud:** `finish_reason` ei jõua kliendini ega ChatLog-i. Kasutasin proxy'na
  `output_tokens == 1100` ja teksti katkemist keset lauset. Need kaks langesid kokku.
- **Pimehindamine:** kavandatud X/Y anonüümistamine jäi ära, sest rubriigipõhist punktiandmist
  ei tehtud — kärpeartefakti tõttu. Kui teeme puhta korduse, tuleb see sisse.
- **Muutmata:** retrieval, süsteemiprompt, RAG-korpus, register, Chroma, graph-lite kanal,
  planner. Ainus koodimuudatus oli `41c69a41` (env-juhitav model/effort/verbosity + rollipõhise
  tokenilae parandus).

## Vigade nimekiri

| Tüüp | Mis | Kus |
|---|---|---|
| Seadistus | `max_output_tokens` 1100 katab ka reasoning-tokenid → 21/32 jooksu kärbiti | kogu katse |
| Retrieval | T3: `should_run_rag: false`, planner kirjutas rolli kliendiks ümber | T3, 4/4 jooksu |
| Retrieval | valitud 4–5 allikat, kuvatud 0 | T2, T4, T7 |
| Retrieval | valitud kontekst 4 ka seal, kus ülesanne vajab 6–7 | T2, T4, T5, T6, T8 |
| Genereerimine | A kirjutas 2000 märki sisu, olles just tunnistanud, et allikaid ei ole | T3, variant A |
| Instrumentatsioon | `finish_reason` ei ole kättesaadav ilma koodimuudatuseta | kogu katse |

Genereerimis- ega API-vigu (HTTP ≠ 200, retry'sid, erandeid) ei esinenud: **32/32 jooksu
lõppesid HTTP 200-ga, `error: null`.**
