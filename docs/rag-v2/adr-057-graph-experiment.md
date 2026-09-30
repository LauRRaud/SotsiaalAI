# ADR-057 — Graafi kasu eraldav katse ja vestluse profiil v3: akti enda ristviited toovad määrava tingimuse

30.09.2026. Teostus Claude Opus 5.5 Codexi järelülevaate jaotise 7.7 järgi ([audit](../audits/rag-v2-followup-review-2026-09-29.md)). Omanik 30.09: „tee arendustööd edasi, ilma pausita“.

## Probleem

- ADR-054 mõõtis graafi vestluse täisahelas, kus baas leidis juba 10/10 (laeefekt). Graafita võrdlust polnud: profiilides v1 ja v2 on kaardid mõlemas sees.
- Codex 7.7:
  - vaja on puhast graafita baasi (A);
  - graafi harud peavad saama sama lisaruumi kui lihtsalt rohkem tavateksti (B);
  - rasked juhtumid tuleb valida enne tulemusi;
  - esmalt taastatav otsingukatse ilma tasuliste vastusekutseteta.

## Otsus

### Katseprofiilid (`search/profiles.js`, `GRAPH_EXPERIMENT_PROFILES`)

Kõik harud on vestluse teadmusraja seaded (hübriidotsing, EstNLTK kiire leksikaalne kanal, vektori kaal 2).

| Haru | Profiil | Lisaruum |
|---|---|---|
| A | `experiment-graph-a-base-v1` | Graafita: 9 järjestatud lõiku, 10 000 tokenit; kaarte ega sõltuvuskonteksti pole |
| B | `experiment-graph-b-text-v1` | 13 järjestatud lõiku, 13 000 tokenit |
| C | `experiment-graph-c-cards-v1` | 9 lõiku + kaardid ja nende sõltuvused, kuni 4 lisalõiku 3000 tokenis (= vestluse profiil v2) |
| D | `experiment-graph-d-references-v1` | 9 lõiku + akti enda ristviited, kuni 4 lisalõiku 3000 tokenis |
| E | `experiment-graph-e-neighbours-v1` | 9 lõiku + struktuursed naabrid, kuni 4 lisalõiku 3000 tokenis |

- **Haru D on uus** (`search/retrieval.js`). Valitud lõigu tekstist loeb ristviidete lugeja (`legal-references.js`, ADR-055) akti enda viited ning lisab iga viidatud paragrahvi esimese lõigu viitamise järjekorras (`cross_reference`).
- Lisaruum (`expansionContextTokens`) kehtib ainult oma haru lisandusele, nagu sõltuvuste ruum C-s.
- Vestluse profiilid v1 ja v2 on muutmata; test kontrollib seda.

### Katsejooksja (`scripts/rag-v2-graph-experiment.mjs`)

- Külmutatud:
  - korpuse põlvkond;
  - kuupäev (kehtivad õigusaktide redaktsioonid);
  - omavalitsust pole, seega pole kohalikke tekste;
  - otsinguplaani päringud on kirjas kataloogis;
  - rerank puudub.
- Iga tekst embeditakse üks kord ja vektorid hoitakse tulemuse juures. Kordus ei tee ühtegi mudelikutset ja annab sama tulemuse.
- Mõõdab:
  - kas kataloogi määrav fraas jõuab tõenditesse;
  - mida iga haru lisas (liik, paragrahv);
  - konteksti maht ja aeg.
- Vastuse kvaliteeti see ei mõõda.

### Kataloog `tests/evaluation/graph/hard-conditions-1.json`

- Üheksa küsimust, kirjutatud enne esimest jooksu.
- Määrav tingimus või erand on teises paragrahvis või sama paragrahvi teises osas kui teema, mida küsimus nimetab.
- Fraasid on kehtiva sotsiaalhoolekande seaduse tekstist (RT 130062026065, kuupäev 15.10.2026), ülaindeksiteta, et v38 ja v39 loeksid neid ühtemoodi.
- Päringud on sellised, nagu plaan küsimusele kirjutab; määravat paragrahvi need ei nimeta.

## Tulemus (30.09.2026, korpus v38, 1071 lubatud dokumenti)

| Haru | Määrav fraas tõendites | Lõike keskmiselt | Konteksti tokenid |
|---|---:|---:|---:|
| A graafita | 3/9 | 9,0 | 6432 |
| B rohkem teksti | 4/9 | 13,0 | 9008 |
| C kaardid | 5/9 | 9,8 | 8976 |
| D ristviited | **7/9** | 10,0 | **7223** |
| E naabrid | 3/9 | 13,0 | 9053 |

Küsimuse kaupa:

- **D** leidis neli juhtu, kus erand viitab § 72 lõikele 2 (dementsus vanaduspensioniikka jõudnul, sõltuvus põhihaigusena). Ükski teine haru neid ei leidnud. Mehhanism on otsene: „välja arvatud käesoleva seaduse § 72 lõikes 2 nimetatud isikul“ → § 72.
- **C** leidis ainsana hooldekodus elaja toimetulekutoetuse välistuse (§ 132 lg 7). Seda ei viita ükski teine paragrahv, seega D seda ei leia.
- **B ja C** leidsid õppiva osalise töövõimega isiku tingimuse (§ 59 lg 3).
- **E** ei lisanud midagi.
- Kolm küsimust leidis juba baas ja kõik harud.
- Kaarditekst üksi (ilma allikalõiguta) ei sisaldanud ühtegi fraasi.

### Teine kataloog: muu kujuga juhud (`hard-conditions-2.json`)

- Kuus küsimust, kirjutatud enne jooksu.
- Esimese kataloogi kallutatuse kontroll: ükski paragrahv, mida küsimus puudutab, ei nimeta määravat. Määrav on sama akti hilisemas paragrahvis (SÜS § 35, LasteKS § 27¹) või pika paragrahvi hilisemas lõikes (SHS § 131 lg 9, § 133 lg 2¹); üks on kontrolljuht (§ 132 lg 1).

| Haru | Leitud | Konteksti tokenid |
|---|---:|---:|
| A graafita | 5/6 | 6010 |
| B rohkem teksti | 5/6 | 8031 |
| C kaardid | 5/6 | 6892 |
| D ristviited | 5/6 | 6488 |
| E naabrid | 5/6 | 8522 |

- Baas leidis juba viis kuuest, ja lapsega töötava isiku andmete edastamise tingimust (LasteKS § 27¹) ei leidnud ükski haru. Selle kataloogi peal harud ei erinenud.
- D lisas kõige vähem konteksti (+478 tokenit baasiga võrreldes; B +2021, C +882, E +2512) ja kahju ei teinud. Tema lisandused olid SÜS-i enda viidatud paragrahvid (§ 15, § 27).

## Järeldus

- Sama lisaruumiga tõi akti enda ristviidete deterministlik laiendus määrava tingimuse kõige sagedamini ja väikseima lisakontekstiga, ilma mudelita.
- Kaardid ja ristviited täiendavad teineteist: kumbki leidis juhte, mida teine ei leidnud.
- Rohkem tavateksti (B) ja naabrid (E) lisasid vähe.
- **Kataloogi kallutatus:** neli üheksast juhtumist on ristviite kujuga (§ 72 erandid). Tulemus ei näita, et D oleks alati parim. See näitab, et selliseid juhte baas, rohkem teksti ega naabrid ei leia. Teises kataloogis, kus viidet pole, harud ei erinenud (kõik 5/6) ja D oli odavaim lisandus.
- Vastusepoolne mõõtmine on allpool: vestluse täisahel reranki ja vastusemudeliga, profiil v1 vs v3.

## Vestluse profiil v3 (`hybrid-estnltk-chat-v3`)

- **Seaded:** v1 (kaardid jäävad) + haru D ristviited: kuni 4 lisalõiku 3000 tokenis, mida võib kasutada ainult ristviide. v1 ja v2 on baitide kaupa samad (test).
- **Kataloog:** `tests/evaluation/dialogue/scenarios-hard-conditions-1.json`, samad üheksa küsimust vestlustena. Kataloog kontrollib, kas määrav fraas jõudis tõenditesse (`evidence_text`) ja kas vastus kohaldab tingimust (`must`). Kirjutatud enne jooksu.
- **Mõõtmine** (30.09, korpus v38, aktiveerimata plaanid `m4-eval-graph-20260930a` = v1 ja `…b` = v3):

| Kataloog | v1 | v3 |
|---|---:|---:|
| Rasked tingimused, jooks 1 | 6/9 (otsing 3) | 8/9 (vastus 1*) |
| Rasked tingimused, jooks 2 | 5/9 (otsing 4) | **9/9** |
| Kataloog v4 | 40/40 (ADR-054) | **40/40** |
| Katvuskataloog | 10/10 (ADR-054) | **10/10** |

- v1 jättis mõlemas jooksus kõigis kolmes § 72 lõike 2 juhtumis määrava fraasi tõenditest välja, ja vastus ei nimetanud tingimust. v3 leidis ja kohaldas selle igas jooksus. Hooldekodu välistuse (§ 132 lg 7) leidsid mõlemad: kaardid on mõlemas profiilis.
- \* v3 jooksu 1 ainus viga oli kataloogi oma: vastus ütles „Paigutamise otsustab kohus“, aga eelnevalt kirjutatud muster oli `/kohtu/`. Tulemust ei muudetud. Muster on pärast jooksu laiendatud `/kohus|kohtu/` ja see on kataloogis kirjas.
- **Otsus:** vestlus läheb profiilile v3 koos korpuse v39 uue plaaniga (ADR-056).
- **Tehtud 30.09 09:46:** plaan `m4-corpus-chat-20260930a.json`. v39 peal andis sama koodiga aktiveerimata plaan (koos prompt 19-ga) raskete tingimuste kataloogis 9/9 ja kataloogis v4 39/40 (tulemused ADR-056-s).

### Teine kataloog vestluse täisahelas

- `tests/evaluation/dialogue/scenarios-hard-conditions-2.json`: kuus küsimust `hard-conditions-2.json`-ist vestlustena, kirjutatud enne jooksu.
- Mõõdetud 30.09, korpus v38, samad plaanid (v1 ja v3), kaks jooksu kummalegi.

| Jooks | v1 | v3 |
|---|---:|---:|
| 1 | 4/6 (parandatud 6/6) | 4/6 (parandatud 6/6) |
| 2 | 3/6 (parandatud 6/6) | 3/6 (parandatud 5/6) |

- **Otsingukatse ainus möödalask leiti:** LasteKS § 27¹ oli liidetud järjestuses 22. kohal, rerank'i 30 kandidaadi hulgas. Rerank valis Lastekaitseseaduse igas jooksus, ja § 27¹ lõik jõudis tõenditesse kolmes jooksus neljast. Neljandas (v3, jooks 2) tuli seadusest teine lõik, aga vastus andis sama põhimõtte juhendi põhjal („Edasta ainult lapse abistamiseks vajalikku … teavet“).
- **Parandatud arv:** kolm eelnevalt kirjutatud mustrit ei tundnud õiget vastust ära. Seetõttu on need pärast jooksu laiendatud, ja see on kataloogis kirjas; hinnatud arvud jäävad tabelisse:
  - „hiljemalt selle kuu viimasel tööpäeval“ (muster oli `viimase(ks)? tööpäeva`);
  - „palk jäetakse kahel kuul täielikult arvestusest välja“ ja v39 jooksus „ei võeta su palka … üldse arvesse“ (muster oli `100 ?(%|protsent)`);
  - „Edasta ainult lapse õiguste kaitseks vajalik teave“.
- **Tulemus:** sellel kujul profiilid ei erinenud. v3 ristviited ei kahjustanud, nagu otsingukatseski.
- **v39 peal** (profiil v3, prompt 19): 5/6 (parandatud 6/6); täpsete paragrahvinumbritega 6/6 (ADR-056). LasteKS § 27¹ jõudis mõlemas tõenditesse.

### Parandus 30.09: ristviidete ruum lõpukontrollis

- Otsingu lõpukontroll võrdles kogu konteksti piiriga „seemnete eelarve + sõltuvuste ruum“ ega arvestanud ristviidete lisaruumi (3000 tokenit).
- Kui profiili v3 ristviited viisid konteksti üle 10 000 tokeni, katkes kogu pööre veaga `dependency_context_budget_exceeded`. Enne seda jäi kaartide sõltuvuskontekst välja.
- Leitud mälukataloogi 12 asjaoluga esimeses pöördes. Otsingukatse ei näinud seda, sest haru D-l pole semantilist graafi.
- Nüüd sisaldab piir laienduse ruumi, kui naaber või ristviide tegelikult lisati. Test kordab juhtumit profiiliga v3.

### Codexi järelülevaade 30.09: R4 ([Codexi järelülevaade 30.09](../audits/rag-v2-pr264-272-review-2026-09-30.md))

- Laiendatud tulumuster (`täielikult`, `üldse arvesse`) võttis vastu ka vastupidise vastuse: „kogu töötasu võetakse esimesest kuust täielikult arvesse“ sai `passed`.
- Nüüd nõuab muster, et töötasu jäetakse arvestusest välja, ja `must_not` keelab selle kohe arvesse võtmise. Lapse andmete muster ei võta vastu „mitte ainult vajalik“.
- `tests/rag-v2-conversation-eval.test.mjs` kontrollib jooksudes antud õigeid vastuseid (kõik kuus läbivad) ja vastupidiseid (kukuvad).
- Varasemad parandatud arvud põhinevad vastuste käsitsi lugemisel; need ei ole uue jooksu sõltumatu tõend.

## Piirid

- Ainult ühe akti sees; dokumentidevahelist viidet D ei loe.
- Üheksa küsimust, üks seadus.
- Otsingukatse on rerankita. Vestluses valib rerank lähtelõigud, ja ristviide laieneb nendest; see on mõõdetud vestluse täisahelas.
- Kuupäev on külmutatud (15.10.2026).
