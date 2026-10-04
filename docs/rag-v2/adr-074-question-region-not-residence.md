# ADR-074 — Küsimuse omavalitsus ei ole inimese elukoht

04.10.2026. Teostus Claude Opus 5.5. Omanik 04.10: „Eristada selle küsimuse allikapiirkond inimese elukohast. Maardu teenuse kohta küsimine ei tähenda Maardusse kolimist: elukoha olekut ei tohi üle kirjutada ega järeldada õigust teenusele. Iga mainitud vald ei saa automaatselt võita: „elan Nõos, töötan Maardus; millist koduteenust ma saan?“ peab jääma elukoha juurde. Lahendus olgu üldine, ilma nimede või valdade eranditeta.“ Lähteks on [päris vestluse küsimustik 04.10](../audits/rag-v2-live-questionnaire-2026-10-04.md) ja Codexi ülevaatus. Järgib [ADR-051](adr-051-fact-lifecycle-and-place-attribution.md) kohaseoseid ja oleku v5 reegleid (Codex J1–J3, V1).

**Mudeliga mõõtmata.** Muudatus on serveri otsustusloogikas; ühtegi mudeli juhist ei muudetud. Seda, mida allpool väidetakse, näitavad 04.10 pöördekirjed (probleem) ja kohalikud testid (parandus). Vastuse sõnastust uue piirkonnaga pole mudeliga kontrollitud.

## Probleem

Loetud 04.10 pöördekirjetest (`M4PilotTurn.payload`: `searchAssist`, `previousDialogueState`, `dialogueState`, `packet.record_context.scope`), mitte vastustest.

| Pööre | Küsimus | Elukoht enne | Kontrollitud koht | Plaani päringud nimetavad | Otsingu piirkond | Elukoht pärast |
|---|---|---|---|---|---|---|
| Q3 | Kas Tartu vallas on sotsiaaltransport ja mis see maksab? | Anija | Tartu vald, `other` | Tartu valda | Anija (`person_region`) | Anija |
| Q5 | Kas Maardus saab isikliku abistaja teenust? | Nõo | Maardu, `other` | Maardut | Nõo (`person_region`) | Nõo |
| Q6 | Mis muutub Põhja-Sakala valla sotsiaalabi korras …? | Nõo | `place_not_attributed` | Põhja-Sakala valda | puudub (`attribution_unresolved`) | **lahendamata** |
| Q7 | Kust leian Harku valla toimetulekutoetuse taotluse vormi? | lahendamata | `place_not_attributed` | Harku valda | puudub | lahendamata |
| R3, R5, R7 | samad küsimused vestluse esimese sõnumina | teadmata | küsitud vald, `other` | küsitud valda | küsitud vald (`search_plan_region`) | teadmata |

- **Q3, Q5:** plaan luges küsimuse õigesti, aga otsing jäi elukoha valda. `personRegionScope` andis mõlemale otsingurajale inimese elukoha; `knowledgeRegionScope` luges plaani päringuid ainult siis, kui kellegi elukohta teada polnud. Seepärast töötas sama küsimus puhtas vestluses.
- **Q6, Q7:** kirjes on ainult serveri enda märge `place_not_attributed`. See tekib serveri kontrollis, kui praeguse sõnumi kohamainimist ei kata ükski kontrollitud kohaseos. Server muutis siis sihtinimese piirkonna lahendamatuks: **Q6 kustutas kasutaja teadaoleva elukoha (Nõo)** ja otsingul polnud piirkonda.
- **Mida ei tea:** miks Q6 ja Q7 kohaseos serverini ei jõudnud. Plaan saab anda ainult `lives`, `not` või `other`; kas ta jättis koha nimetamata või lükkas server tema seose tagasi (vale sõnumi number, tsitaat ei klapi), kirjest ei selgu, sest plaani enda kohaseoseid ei salvestatud. Mõlemad teed annavad sama kirje.

## Otsus

**Pöörde allikapiirkond otsustatakse eraldi inimese elukoha olekust.** Elukoha olekut muudavad nagu seni ainult elamise kohta käivad laused: „elan seal“, „ei ela seal“, kolimine.

### 1. Küsitud omavalitsus

Praeguse sõnumi vald on pöörde allikapiirkond, kui kaks lugemist langevad kokku:

1. **sõnum nimetab seda muu mainimisena** (kontrollitud kohaseos `other`: ei elukoht ega eitus), selle inimese kohta, kellest sõnum räägib, või kellegi kohta määramata;
2. **iga vald, mida plaani otsingupäringud nimetavad, on selline mainimine.**

Siis loevad kataloog ja teadmiste raja kohalikud õigusaktid seda valda. Otsingu piirkonna kirje:

```json
{ "state": "question_region", "region": "maardu_linn",
  "person_scope": { "state": "person_region", "region": "noo_vald", "person": "user", "interpretation": "source_scope_only_not_confirmed_residence" },
  "interpretation": "asked_municipality_source_scope_not_residence" }
```

- **Inimest ei nimetata:** küsitud vald ei ole kellegi elukoht. Vastuse juhis ütleb, et `records.scope.person` on inimene, kelle valla järgi kataloog valiti; siin seda välja ei ole. Inimese enda piirkond on kõrval väljal `person_scope`.
- **Elukoha olek ei muutu.** Salvestatud olek tuleb samadest kontrollitud kohtadest nagu seni ja `other` ei muuda seal midagi. Järgmine pööre otsib jälle elukoha vallast.
- **Kunagi ei loeta küsitud vallaks:**
  - valda, mille sama sõnum annab kellelegi elukohaks, eitab või jätab lahendamata;
  - inimese enda valda;
  - teise inimese mainimist (ema töökoht kasutaja küsimuses).
- **Päring, mis nimetab muud valda** (näiteks inimese enda oma), jätab otsingu inimese juurde. „Elan Nõos, töötan Maardus; millist koduteenust ma saan?“ jääb Nõo valda ka siis, kui plaan nimetab mõlemat.
- **Ainult päringust ei piisa:** vald peab olema praeguses sõnumis. Varasema küsimuse vald ega eitatud elukoht ei tule päringu kaudu tagasi (Codex J1 kehtib).
- **Mitu küsitud valda** (või nimi, mida jagavad kaks omavalitsust): olek `question_regions`, piirkonda ei valita, kandidaadid piiravad kohalikke õigusakte; kataloogi ei valita. Sama käitumine on juba mitmetähendusliku nimega.

### 2. Mainimine, mis ei räägi elamisest, ei muuda elukohta

- **Plaani `other`-seos, mida server ei saa kontrollida** (koht tsitaadis kaks korda, tsitaat vales sõnumis), jäetakse kõrvale. Varem muutis see inimese piirkonna lahendamatuks, kuigi `other` ei väida elukoha kohta midagi. Elukohaväide (`lives`, `not`), mida ei saa kontrollida, jääb lahendamata nagu seni.
- **Praeguse sõnumi mainimine, mida ükski kohaseos ei kata**, mis ei nimeta ühtki inimest ega räägi elamisest („Kust leian Harku valla toimetulekutoetuse taotluse vormi?“), loetakse serveris muuks mainimiseks (`other`, põhjus `unattributed_other_mention`). Varem muutus sihtinimese piirkond lahendamatuks. See on Q6 ja Q7 kirjes nähtud kuju.
- **Muutmata:** esimeses isikus lause („Olen Harku vallas tööl“, „Kolisin Harku valda“), nimetatud inimese lause („Ema käib Harku vallas arsti juures“), eitus ja elamise lause, mille inimest ei näe, jätavad piirkonna lahendamata nagu seni. Seal võib olla kolimine, mida server ei oska lugeda.

### 3. Plaani enda kohaseosed pöördekirjes

`searchAssist.plannedPlaces` hoiab plaani kohaseoseid nii, nagu mudel need andis (sõnumi number, tsitaat, nimi, inimene, seos), kontrollitud kohtade kõrval. Ainult audit; ükski otsus neid ei loe. Järgmine Q6-laadne pööre näitab, kas plaan jättis koha nimetamata või lükkas server seose tagasi. Hindaja väljund näitab sama (`plannedPlaces`) ja piirkonna valiku liiki (`scopeState`).

### Mida ei muudetud

- Otsinguplaani juhis (`search-assist-6`), dialoogi juhis 24, vastuse juhis, oleku v5 skeem ja `resolvePersonRegions`.
- **Vestlus, kus kellegi elukohta teada pole:** piirkond tuleb endiselt plaani päringutest (`search_plan_region`), täpselt nagu 04.10 õnnestunud korduspööretes R3, R5 ja R7.

### Teostus

- `lib/rag-v2/pilot/person-places.js`: `questionRegionScope`, `sourceRegionScope`; kaks muudatust `checkedTurnPlaces`-is (jaotis 2).
- `lib/rag-v2/pilot/retrieval.js`: `searchScope` kasutab oleku v5 korral `sourceRegionScope`-i.
- `lib/rag-v2/pilot/search-assist.js`, `service.js`: `plannedPlaces`.
- `scripts/rag-v2-conversation-eval.mjs`: `scopeState`, `plannedPlaces` väljundis.

## Piirid

- **Otsus toetub plaani päringutele.** Kui plaan kirjutab töökohta mainiva sõnumi kohta päringud ainult töökoha valla kohta, otsitakse sealt. Plaani juhis ütleb hoida päringus selle inimese kohta, kelle kohta palve käib; töökoha mainimisega päris plaani pole salvestatud, nii et seda pole nähtud.
- **Võrdlus oma vallaga** („kas Maardus on odavam kui Nõos?“) jääb elukoha valda, sest päring nimetab ka inimese enda valda.
- **Kohaseoseta esimeses isikus küsimus** („Kas ma saan Maardus …?“) muudab elukoha endiselt lahendamatuks, kui kohaseos serverini ei jõua. Kohaseosega (`other`) töötab see nagu Q5.
- **Kohaseoseta lause, milles on inimest tähistav sõna** (ka „lapsehoiuteenus“), ei anna küsitud valda: otsing jääb elukoha valda, elukoht jääb alles.
- **Puhta vestluse kaks valda:** piirkonnaks saab viimase päringu vald, nagu seni.
- **Q6/Q7 põhjus on teadmata.** Parandatud on serveri reaktsioon, mitte see, miks kohaseos serverini ei jõudnud.

## Kontrollid

`tests/rag-v2-question-region.test.mjs` (9 testi) viib iga pöörde läbi päris otsinguadapteri kohakontrolli ja piirkonnavaliku (`runtimeAdapters`: `checkedPlaces`, `searchScope`); salvestatud olek on sama `resolvePersonRegions`. Mudelit ega andmebaasi ei kasutata. Enne parandust kukkus 8 testi 9-st.

| Omaniku nõue | Test | Tulemus |
|---|---|---|
| Selgesõnaline teise valla infopäring | Q3 ja Q5 plaanid ja sõnumid kirjest sõna-sõnalt | otsing Tartu vallas / Maardus; elukoht Anija / Nõo |
| Elukoha säilimine järgmistes pööretes | järgmine küsimus; päring, mis nimetab Maardut uuesti; päris kolimine | Nõo; Nõo; Maardu saab elukohaks |
| Töökoha mainimine | „Elan Nõo vallas, töötan Maardus …“ kolme päringukomplektiga; töökoht hilisemas sõnumis kohaseosega ja ilma | Nõo igal juhul |
| Kaks valda ühes küsimuses | elukoht + küsitud vald; kaks küsitud valda; küsitud vald + oma vald; jagatud nimi „Tartu“ | küsitud vald ja elukoht salvestatud; kaks kandidaati; elukoht; kaks kandidaati |
| Teise inimese olukord | ema Kose vallas, küsimus Tartu valla kohta ema jaoks; ema töökoht kasutaja küsimuses | Tartu vald, ema jääb Kose valda; kasutaja Anija |
| Q6 ja Q7 | kohaseoseta plaan; vale sõnumi numbriga kohaseos | küsitud vald, elukoht Nõo alles |
| Puhas vestlus | R3, R5, R7 plaanid | `search_plan_region` nagu 04.10 |
| Mis jääb otsustatuks | eitatud koht + päring; eitus ja töökoht samas vallas; kontrollimatu elukohaväide | piirkonda ei valita; elukoht lahendamata |

- **Kahe inimese kataloogid:** kõik `tests/evaluation/dialogue/*.json` kataloogid läbivad kuju kontrolli ja nende testid on muutmata. Nende pöörete piirkonnaootused ei puutu uude reeglisse: seal pole `other`-mainimist, mida päringud üksi nimetaksid.
- **Muudetud kinnitatud ootus** (`tests/rag-v2-region-state-5.test.mjs`): „Käin Harku vallas arsti juures.“ ilma kohaseoseta jätab nüüd Kose elukohaks. Varem muutus elukoht lahendamatuks (Codex V1, 30.09). See on teadlik muutus jaotise 2 järgi.
- **Kataloog `scenarios-region-state-1.json`, `moved-away-no-new-place`, teine pööre** („Kas Kose vallas on mingi toetus, mida ma veel saaksin?“): elukoht jääb teadmata nagu ootus nõuab; otsingu piirkond võib nüüd olla Kose kui küsitud vald. Kataloog piirkonda ei kontrolli.
- **Kohalik andmebaasitest** (`tests/rag-v2-dialogue-store.test.mjs`, 22/22): uus vestlus läbi teenuse: elukoht Kose, küsimus Harku kohta kohaseosega ja ilma, siis oma küsimus. Otsing Harku, salvestatud elukoht Kose, järgmine pööre Kose; `plannedPlaces` on kirjes.
- **Täiskomplekt** `node scripts/run-unit-tests.mjs`: 630 testi, 611 läbis, 19 vahele jäetud, 0 ebaõnnestus. ESLint muudetud failidel puhas. Codexi neli sondi läbivad muutmata koodi arhiivil.

## Mis on mõõdetud ja mis mitte

| Väide | Alus |
|---|---|
| Q3 ja Q5 otsisid elukoha vallast, kuigi plaan nimetas küsitud valda | 04.10 pöördekirjed |
| Q6 kustutas kasutaja elukoha | 04.10 pöördekirje (`dialogueState`) |
| Uus kood valib nende plaanide puhul küsitud valla ja hoiab elukoha | kohalikud testid |
| Töökoht, kaks valda, teine inimene | kohalikud testid väljamõeldud plaanidega |
| Vastus räägib küsitud vallast ega tee sellest kasutaja õigust | **mõõtmata** |
| Plaani päringud töökoha mainimise korral | **mõõtmata** |
| Kui sageli kohaseos serverini ei jõua | **mõõtmata** (04.10: pikas vestluses kahel neljast teise valla küsimusest, puhtas vestluses mitte ühelgi neljast) |

## Mudeliga kontroll (lubatud, tegemata)

Kataloog `tests/evaluation/dialogue/scenarios-question-region-1.json`, kirjutatud enne ühtki jooksu: kolm vestlust, 8 pööret.

- Nõo elanik küsib Maardu isikliku abistaja teenuse kohta, siis oma koduteenuse kohta. Kontrollid: piirkond Maardu, elukoht Nõo, Maardu kord tõendites, vastus ei küsi tagasi ega ütle „sul on õigus“; järgmine pööre Nõo.
- „Elan Nõo vallas, töötan Maardus. Millist koduteenust ma saan?“: piirkond Nõo.
- 04.10 vestluse algus (Anija, ema Kose vallas, küsimus Tartu valla kohta, siis ema koduteenus).

Hinnang plaanihindades umbes 0,06 USD (8 pööret, 0,0056–0,0081 USD pööre). Omanik lubas 04.10 ühe jooksu pärast avaldamist, peatudes enne 0,08 USD; tulemus lisatakse siia eraldi muudatusega. Muster on jäme kontroll: otsustav vastus tuleb lugeda tervikuna.
