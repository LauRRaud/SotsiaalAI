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

## Tulemus 28.09: külm Qdrant pärast deploy'd ja algsoojendus

Salvestatud ajad näitasid põhjust. Kõik pöörded on sama küsimusega; `merged` on otsingu enda kestus. Loendurid ja tagasipööre on Codexi kirjas ([audit, jaotised 10 ja 11](../audits/rag-v2-codex-review-2026-09-27.md#11-ajutise-mälukaitse-võrdluskatse-225-peal-2809)).

| Pööre | Olukord | `merged` | Qdranti `vector_server` |
|---|---|---:|---:|
| 28.09 07:49 UTC | 7,5 min pärast #224 restarti, algsoojendus lõppenud | 11,9 s | 8,45–8,51 s |
| 08:24 ja 08:40 UTC | soe; teine 15 min 52 s pärast esimest, deploy'd vahepeal polnud | 4,1 / 3,4 s | 0,18–0,23 s |
| 09:14 UTC | #226 deploy järel, ajutine mälukaitse sees (`system.slice` 1500M, Qdrant 1G) | 12,6 s | 8,41–8,43 s |

- **Jõudeolek ei tee otsingut aeglaseks, deploy teeb.** Rakenduse ehitus tõrjub Qdranti vektorid failivahemälust välja: Qdranti `file` 334 → 10,6 MiB, `memory.events.low` +119. Kolmandas pöördes luges Qdrant kettalt 306 MiB ja I/O ooteaeg kasvas 6,4 s; PostgreSQL-il oli see 37 ms.
- **PostgreSQL oli pärast algsoojendust soe** (rerank 2,7 s, lexical 1,2 s): [ADR-033](adr-033-warm-up-at-server-start.md) loeb teadmusallikad uuesti. Vektoreid algsoojendus ei puudutanud.
- **Proovitud mälukaitse ehitust ei üle elanud.** Suuremat kaitset ega swap'i ei katsetatud. Ajutine kaitse võetakse tagasi 28.09 kell 13:24 EEST.

**Otsus: Qdranti algsoojendus** (`QdrantIndex.warm`, `warmPilotAtStart`).

- Pärast teadmusallikate soojendust teeb algsoojendus ühe täpse vektorpäringu kinnitatud plaani aktiivsete dokumendiversioonide ulatuses. Vektoriks võetakse üks sama ulatuse salvestatud vektor, embeddingu kutset pole.
- Nii loeb Qdrant vektorid pärast iga restarti ühe korra mällu, enne esimest küsimust.
- Viga ainult logitakse. Logis on `[rag-v2] warmed vectors of N sources in X s`.
- Mõju kinnitab esimene deploy-järgne pööre algsoojenduse lõppedes: `vector_server` peaks olema umbes 0,2 s, mitte 8,4 s.
- **Kinnitatud #228 peal (28.09):** algsoojendus lõppes kell 12:51:05 EEST (`warmed vectors of 6026 sources in 11 s`). Selle ajal luges Qdrant kettalt 416,5 MiB.
  - Umbes 10 minutit hiljem küsiti sama küsimust: `merged` 5,0 s, `vector_server` 80–123 ms. Küsimuse ajal luges Qdrant kettalt ainult 192 KiB.
  - Rerank'i 2,54 s-st kulus mudelikutsele 2,21 s.
  - Ajutine mälukaitse oli mõõtmise ajal veel peal, aga #226 katses ei hoidnud see üksi ehitust üle. Soojendusejärgset püsimist ilma kaitseta pole eraldi mõõdetud.
- **Piir:** tõendatud on küsimus, mis tuleb pärast algsoojenduse lõppu. Käivitus võtab umbes 5 min 16 s ja selle ajal esitatud küsimus võib endiselt oodata külma otsingu järel.
- **Korduskatse** (Codexi #228 ülevaatus, P2): vektorisoojendusel on protsessi ja põlvkonna kohta oma olek: `running`, `done` või `failed`.
  - Kui soojendus ebaõnnestub (Qdrant pole veel üleval, aegumine), proovib järgmine käivitus või esimese pöörde `preflight` seda uuesti.
  - Allikaid selleks uuesti ei soojendata, ja sama tööd ei tehta kunagi kaks korda korraga.
  - Kui `preflight` alustab allikate soojendust (algsoojendus jäi vahele), järgnevad vektorid ka siis allikatele.

## Järgmised sammud

1. **Aeglased pöörded:** pärast väljalaset vaata aeglaste pöörete `timings.search` välja. Sealt näeb, kas aeg kulub Qdrantis (`vector_server`), sõnalises päringus või mujal.
2. **Mäluseaded**, igaüks eraldi ja samade päringutega. Need on omaniku serveriseaded:
   - Qdranti mälukaitse (`memory.low` konteineril ja `system.slice` tasemel);
   - PostgreSQL-i `shared_buffers`.
3. **Sõnalise otsingu mõõtmine** vestluse enda filtritega.
4. **Mahupiir:** sadu dokumente mahub praegusse piiri, näiteks 34 405 + 500 × 40 = 54 405 < 60 000. Otsingukiirus sellel mahul vajab siiski kontrolli. Tekstiosade piiri tõstmine 80–100 tuhandele jääb ettepanekuks, kuni sammud 1–3 on tehtud ja tegelikud filtrid ning samaaegsed päringud kontrollitud. 10 000 dokumendi piiri see ei muuda.

## Kontroll

- **Korduskatse:** `tests/rag-v2-vector-warm-up.test.mjs` (võrguta, päris `warmPilotAtStart`):
  - ebaõnnestunud vektorisoojendust proovitakse uuesti, käimasolevat ega lõpetatut mitte;
  - teine käivitus proovib vektoreid uuesti ilma allikaid uuesti soojendamata.

- **Qdranti algsoojendus:**
  - `tests/rag-v2-unified.integration.test.mjs`: päris `warmPilotAtStart` loeb plaani vektorid ühe päringuga pärast allikaid ja ainult korra; tühi dokumendiloend ei tee päringut.
  - `tests/rag-v2-pool-reserve.test.mjs`: `then` käivitub alles pärast allikaid, ja kui allikate soojendus ebaõnnestub, siis üldse mitte.

- **`tests/rag-v2-unified.integration.test.mjs`** (päris PostgreSQL, Qdrant ja EstNLTK):
  - pöörde auditis on `timings.search`, sammud on õiges järjekorras ja täisarvulised;
  - radade ajad on olemas koos Qdranti ajaga;
  - mudeli sisendis ja tõendipaketis aegu pole.
- **Muud testid:**
  - `npm test`: 333 läbis, 0 ebaõnnestus, 17 vahele jäetud;
  - integratsioonitestid `rag-v2-version-index`: 5/5, `rag-v2-structured-records`: 9/9;
  - `rag-v2-dialogue-scenarios` vajab v25 kirjeüksuste vektoreid, mida sülearvutis pole (`scenario_unit_vector_missing`, README).
