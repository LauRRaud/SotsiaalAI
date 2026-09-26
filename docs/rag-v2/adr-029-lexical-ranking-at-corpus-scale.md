# ADR-029 — Sõnaline järjestus kogu korpuse mahul (ettepanek)

25.09.2026. Ettepanek, Claude Opus 5.5. Otsust ega koodimuudatust veel ei ole; kood on
järelkontrolliks külmutatud (`tmp/rag-v2-freeze-v12-2026-09-25`).

## Mida see muudab ja mida mitte

**Muudab ainult otsinguindeksit ja sõnalist järjestamist:** Postgres'i ühikutabeli sõnalised
väljad (`search_vector`, `morphology_vector` või uus termitabel), päringu SQL ja otsingukonfiguratsiooni
`lexical` väärtus. Selleks tuleb indeks uuesti ehitada (kohalikult ~1 h).

**Ei muuda embeddingusisendit.** Embeddingu sisend on tüki `retrieval_text`
(`title-section-text-v1`), mille teeb töötlus (`source-structure-v12`), mitte otsinguindeks. Ostetud
vektorid on seotud sisendi räsiga; uus sõnaline konfiguratsioon võtab need salvestatud kirjest,
ilma uue ostuta (`cachedIndexVector` → `StoredEmbedding`). Ükski allpool toodud variant ei muuda
tükeldust ega `retrieval_text`-i.

## Probleem

Mahutest 25.09 (5985 dokumenti, 29 103 ühikut, EstNLTK):

- Päring ühendab kõik sõnad OR-iga; tavasõnad („ja“, „on“, „kuidas“) sobivad ~27 600 ühikule.
  Sobitamine ise võtab 0,5 s.
- Igale sobinud ühikule arvutatakse `ts_rank_cd` ka morfoloogiavektoril, mille keskmine pikkus
  on 468 lekseemi, sest igal ühikul on eesti (EstNLTK), inglise ja vene Snowballi tüved.
- Tulemus: 60 hindamisküsimusel keskmiselt 36,5 s päringu kohta ühe ühendusega, paralleelselt ~11 s.
  Postgres'i 15 s piir katkestab päringu ja ühise raja pööre lõpeb `lexical_service_failed`.
- Vektorikanal sama filtriga: 0,13 s. Kataloogi laadimine: 0,3 s.

Proovitud kiirparandused (samad 60 küsimust):

| Variant | Aeg | 40 parema kattuvus praegusega |
|---|---:|---|
| Kaheastmeline: odav `ts_rank` valib 400 / 1000 kandidaati, siis praegune skoor | 1,5 / 2,5 s | järjekord 27% / 41%, 10 / 18 loendit identsed |
| Kandidaadiks ainult sõnad, mis esinevad ≤10% ühikutest; skoor sama | 13,5 s | hulk 85%, järjekord 46%, 21 loendit identsed |

Kumbki pole korraga kiire ja praegusele truu. Praegune järjestus ei ole ka iseenesest „õige“;
selle kvaliteeti kogu korpusel pole mõõdetud.

## Variandid

1. **Keelepõhised tüved.** Eestikeelne ühik saab ainult EstNLTK tüved, inglis- ja venekeelne oma
   keele omad. Morfoloogiavektor lüheneb umbes kolm korda. Ohutu, kuid üksi ei piisa: ainult
   täpsete sõnade vektori järjestus (128 lekseemi) võttis mõõtmisel juba 6,6 s.
2. **BM25 Postgres'is termitabeliga.** Genereerimise ajal termitabel (term, ühik, sagedus) ja
   dokumendisagedused; päringus summeeritakse ainult päringusõnade postitusi ja väga sagedased
   sõnad (nt >30% ühikutest) jäetakse sobitamisest välja. Uut teenust pole. BM25 kaalub
   tavasõnad loomulikult alla. Järjestus muutub (vajab hindamist).
3. **Eraldi BM25 mootor** (nt ParadeDB `pg_search` või Tantivy teenus). Kiireim, kuid uus
   komponent serveris; vajab omaniku luba ja serveri seadistust.
4. **Variandid 1 + kandidaatide piiramine** (haruldased sõnad ∪ vektori kandidaadid), seejärel
   praegune `ts_rank_cd`. Väikseim koodimuudatus, kuid sõnaline kanal ei ole enam vektorist
   sõltumatu, mis nõrgendab RRF-i mõtet.

## Soovitus

Variant 2 koos variandiga 1. Põhjused: töötab olemasolevas Postgres'is, aeg sõltub päringusõnade
postitustest, mitte kogu korpusest, ja BM25 on sõnalise otsingu tavapärane alus. Enne otsust:

- mõõta aega (eesmärk p95 < 1 s ühe sõnalise päringu kohta 30 000 ühikul);
- hinnata **hübriidtulemust** päris vektoritega, mitte sõnalist kanalit eraldi: olemasolevad 60
  küsimust (ET/EN/RU) ja uue korpuse hindamisküsimustik ankrutega;
- võrrelda praeguse profiiliga väikesel korpusel, kus praegune järjestus veel töötab.

Embeddingute ostu see ei takista; piloot kogu korpusel ootab selle otsuse ja teostuse järel.

Mõõteskriptid: `tmp/rag-v2-corpus/lexical-probe.mjs`, `lexical-variants.mjs`,
`lexical-two-stage.mjs`, `lexical-informative.mjs`; tulemused külmutuse `evidence/` kaustas.
