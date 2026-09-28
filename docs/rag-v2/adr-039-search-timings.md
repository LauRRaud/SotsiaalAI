# ADR-039 — Vestluse otsingu ajakulu jääb pöördega alles

28.09.2026. Teostus Claude Opus 5.5. Järgib Codexi kontrolli ([audit, jaotised 9 ja 9.1](../audits/rag-v2-codex-review-2026-09-27.md#9-otsingu-ajamõõtmise-ja-mäluväidete-kontroll-2809)).

## Probleem

- Serveri pööretes kasvas otsingufaasi kohalik osa (ilma mudelikutseteta) `versions-v1` kihil kolmes pöördes neljast umbes 10 sekundini. Vanal kihil oli see umbes 2,6 s. Põhjus pole tõendatud.
- `retrieve()` mõõdab juba iga kanali aega (sõnaline, vektor, hüdreerimine, rerank jt). Need ajad kadusid aga kahes kohas: ühise paketi koostamisel ja pöörde salvestamisel. Aeglase pöörde kohta ei saanud tagantjärele öelda, kus aeg kulus.

## Otsus

- **`unifiedSearch` tagastab `search_timings`** (`rag-v2/search-timings-1`):
  - `since_start_ms`: millisekundid otsingu algusest kuni iga sammu lõpuni. Sammud on `directory`, `scope`, `knowledge_and_records`, `periods` (kui perioode on) ja `merged`.
  - `lanes.<raja võti>`: raja enda kestus (`lane`) ja `retrieve()` ajad, näiteks `registry`, `lexical`, `vector`, `vector_N`, `hydration`, `rerank` ja `total`. Kirjete rajal on ainult `lane`.
  - Teadmiste ja kirjete rada jooksevad samal ajal, nii et nende aegu ei liideta.
- **Qdranti enda aeg:** vektorpäringu juures on ka Qdranti vastuses teatatud aeg (`vector_server`, `vector_N_server`). Kui päring võttis kaua, aga Qdrant teenindas selle kiiresti, kulus aeg mujal, näiteks päringu keha koostamisel või sündmusetsüklis.
- **Salvestus:** ajad on pöörde auditis väljal `payload.timings.search`, ainult numbritena. Otsingu abiga pöördes salvestatakse need kohe pärast otsingut, nii et hilisema vea korral jäävad need alles.
  - Mudeli sisendisse ega tõendipaketti neid ei panda, seega tõendipaketi sisu ei muutu.

## Mõõtmised enne muudatust (esialgsed)

Codexi kontrolli järgi on need suunavad, mitte tõestus.

- **Serveris, v33**, vestluse otsingutee eraldi protsessis pärast algsoojendust (`full-search-timing.mjs`):
  - esimene otsing 10,2 s, teine 1,8 s;
  - PostgreSQL-i mõõdetud osad kokku umbes 2,5 s;
  - ülejäänut see skript ei mõõtnud.
- **Qdrant serveris:**
  - vektorpäring mälus 100 ms;
  - mõne minuti jõudeoleku järel esimene päring 2,9 s.
- **Sülearvutis, sünteetilised 3072-mõõtmelised vektorid, soe olek:**

  | | 1× (34k) | 2× | 4× |
  |---|---:|---:|---:|
  | täpne otsing koos lubatud ID-de loendiga | 92 ms | 124 ms | 209 ms |
  | täpne otsing ilma ID-de loendita | 64 ms | 77 ms | 100 ms |

  - int8-kvantimine ei mõjuta täpset otsingut; Qdrant jätab selle `exact: true` puhul vahele.
  - ID-de loendi eemaldamine säästaks ainult 28–109 ms. Loendit ei saa lihtsalt ära jätta, sest see välistab tekstiosad, mida ei tohi tõendina kasutada.
- **Sõnaline otsing sülearvutis** (serveri tekstiosad, 1×/2×/4×): 1,0 / 1,6 / 3,0 s.
  - Katse valis dokumendid laiemalt kui vestlus: vestlus kitsendab lisaks liigi, õiguste, kehtivuse, piirkonna ja rolli järgi.
  - 91% vastete arv on kogu katsetabelist.
- **Mälu:** mälusurve on usutav põhjus, aga tõendatud see ei ole. PostgreSQL kasutab lisaks `shared_buffers`-ile ka operatsioonisüsteemi vahemälu, ja `memory.low` kaitseb mälu ainult võimaluste piires.

## Järgmised sammud

1. **Aeglased pöörded:** pärast väljalaset vaata aeglaste pöörete `timings.search` välja. Sealt näeb, kas aeg kulub Qdrantis (`vector_server`), sõnalises päringus või mujal.
2. **Mäluseaded**, igaüks eraldi ja samade päringutega. Need on omaniku serveriseaded:
   - Qdranti mälukaitse (`memory.low` konteineril ja `system.slice` tasemel);
   - PostgreSQL-i `shared_buffers`.
3. **Sõnalise otsingu mõõtmine** vestluse enda filtritega.
4. **Mahupiir:** sadu dokumente mahub praegusse piiri, näiteks 34 405 + 500 × 40 = 54 405 < 60 000. Otsingukiirus sellel mahul vajab siiski kontrolli. Tekstiosade piiri tõstmine 80–100 tuhandele jääb ettepanekuks, kuni sammud 1–3 on tehtud ja tegelikud filtrid ning samaaegsed päringud kontrollitud. 10 000 dokumendi piiri see ei muuda.

## Kontroll

- **`tests/rag-v2-unified.integration.test.mjs`** (päris PostgreSQL, Qdrant ja EstNLTK):
  - pöörde auditis on `timings.search`, sammud on õiges järjekorras ja täisarvulised;
  - radade ajad on olemas koos Qdranti ajaga;
  - mudeli sisendis ja tõendipaketis aegu pole.
- **Muud testid:**
  - `npm test`: 333 läbis, 0 ebaõnnestus, 17 vahele jäetud;
  - integratsioonitestid `rag-v2-version-index`: 5/5, `rag-v2-structured-records`: 9/9;
  - `rag-v2-dialogue-scenarios` vajab v25 kirjeüksuste vektoreid, mida sülearvutis pole (`scenario_unit_vector_missing`, README).
