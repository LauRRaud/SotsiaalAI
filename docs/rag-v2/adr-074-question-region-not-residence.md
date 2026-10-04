# ADR-074 — Küsimuse omavalitsus ei ole inimese elukoht

04.10.2026. Teostus Claude Opus 5.5. Omanik 04.10: „Eristada selle küsimuse allikapiirkond inimese elukohast. Maardu teenuse kohta küsimine ei tähenda Maardusse kolimist: elukoha olekut ei tohi üle kirjutada ega järeldada õigust teenusele. Iga mainitud vald ei saa automaatselt võita: „elan Nõos, töötan Maardus; millist koduteenust ma saan?“ peab jääma elukoha juurde. Lahendus olgu üldine, ilma nimede või valdade eranditeta.“ Lähteks on [päris vestluse küsimustik 04.10](../audits/rag-v2-live-questionnaire-2026-10-04.md) ja Codexi ülevaatus. Järgib [ADR-051](adr-051-fact-lifecycle-and-place-attribution.md) kohaseoseid ja oleku v5 reegleid (Codex J1–J3, V1).

**Mõõdetud pärast avaldamist, omaniku loal** (jaotis „Mõõtmine“): 8 pööret, 7 läbis, 0,0476 USD. Teise valla küsimus otsiti küsitud vallast ja elukoht jäi alles; töökoht ei viinud otsingut ära. Järelküsimus läks elukoha valda tagasi, sest plaan kirjutas ka päringu kasutaja varasema palve kohta; selle parandus on tehtud pärast mõõtmist ja kontrollitud ainult kohalike testidega.

Muudatus on serveri otsustusloogikas; ühtegi mudeli juhist ei muudetud. #344 läks tootmisse mõõtmata, kohalike testidega.

**Codexi ülevaatus enne liitmist (04.10)** leidis esimeses versioonis kaks viga: järelküsimus kaotas küsitud valla (F1) ja töökoht võitis elukoha, kui plaani päring nimetas ainult töökoha valda (F2). Mõlemad on siin parandatud; reegli teine tingimus ja järelküsimuse jätkamine tulid sellest ülevaatusest.

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

Praeguse sõnumi vald on pöörde allikapiirkond, kui kolm lugemist langevad kokku:

1. **Sõnum nimetab seda muu mainimisena** (kontrollitud kohaseos `other`: ei elukoht ega eitus), selle inimese kohta, kellest sõnum räägib, või kellegi kohta määramata.
2. **Mainimine on küsimuse enda sees.** Seda loeb server ise, mitte plaan:
   - valla nime ees on samas osalauses küsisõna või palve („Kas Maardus saab …“, „tahan teada, mis toetusi Tartu vald maksab“, „Räägi Maardu …“, „kui palju …“); või
   - osalauses pole küsisõna ja see on terve lause, mis lõpeb küsimärgiga („Maardus saab isikliku abistaja teenust?“).
3. **Plaani otsingupäringud nimetavad sellist mainimist** ega nimeta muud valda. Erand pärast mõõtmist: päring inimese enda valla kohta, mida sõnum ei nimeta, ei loe (jaotis „Mõõtmine“).

`other` üksi ei tõenda, et küsitakse selle valla kohta: töökoht on samuti `other`. Lause, mis ainult teatab midagi („töötan Maardus“), on asjaolu, mis iganes küsimus sellele järgneb. Seepärast jääb „Elan Nõo vallas, töötan Maardus; millist koduteenust ma saan?“ Nõo valda ka siis, kui plaani ainus päring nimetab Maardut (Codex F2).

Otsingu piirkonna kirje:

```json
{ "state": "question_region", "region": "maardu_linn", "asked_in": "current_message",
  "person_scope": { "state": "person_region", "region": "noo_vald", "person": "user", "interpretation": "source_scope_only_not_confirmed_residence" },
  "interpretation": "asked_municipality_source_scope_not_residence" }
```

- **Inimest ei nimetata:** küsitud vald ei ole kellegi elukoht. Vastuse juhis ütleb, et `records.scope.person` on inimene, kelle valla järgi kataloog valiti; siin seda välja ei ole. Inimese enda piirkond on kõrval väljal `person_scope`.
- **Elukoha olek ei muutu.** Salvestatud olek tuleb samadest kontrollitud kohtadest nagu seni ja `other` ei muuda seal midagi.
- **Kunagi ei loeta küsitud vallaks:**
  - valda, mille sama sõnum annab kellelegi elukohaks, eitab või jätab lahendamata;
  - inimese enda valda;
  - teise inimese mainimist (ema töökoht kasutaja küsimuses).
- **Päring, mis nimetab muud valda** (näiteks inimese enda oma), jätab otsingu inimese juurde.
- **Mitu küsitud valda** (või nimi, mida jagavad kaks omavalitsust): olek `question_regions`, piirkonda ei valita, kandidaadid piiravad kohalikke õigusakte; kataloogi ei valita. Sama käitumine on juba mitmetähendusliku nimega.

### 2. Järelküsimus jätkab küsitud valda

„Ja mis see maksab?“ pärast Maardu küsimust ei nimeta valda. Otsing jääb Maardusse, kui (Codex F1):

- **viimane avaldatud vastus anti küsitud valla kohta** (selle pöörde salvestatud piirkonnakirje on `question_region`; teenus annab selle järgmisele pöördele kaasa väljal `query.askedRegions`);
- **praegune sõnum ei nimeta ühtegi valda**;
- **plaani päringud nimetavad seda küsitud valda** ega nimeta muud valda. Erand pärast mõõtmist: päring inimese enda valla kohta ei loe, kui sõnum ei räägi esimeses isikus.

Kirjes on siis `"asked_in": "earlier_question"`. Jätk kestab pöördest pöördesse, kuni plaan kirjutab päringud selle valla kohta. Inimese enda kohta käiv palve („Millist koduteenust ma ise saan?“), mille päringud nimetavad elukohta või ei nimeta valda, läheb elukoha juurde tagasi; pärast seda pole enam midagi jätkata. Elukoht on kõigis neis pööretes sama.

### 3. Mainimine, mis ei räägi elamisest, ei muuda elukohta

- **Plaani `other`-seos, mida server ei saa kontrollida** (koht tsitaadis kaks korda, tsitaat vales sõnumis), jäetakse kõrvale. Varem muutis see inimese piirkonna lahendamatuks, kuigi `other` ei väida elukoha kohta midagi. Elukohaväide (`lives`, `not`), mida ei saa kontrollida, jääb lahendamata nagu seni.
- **Praeguse sõnumi mainimine, mida ükski kohaseos ei kata**, mis ei nimeta ühtki inimest ega räägi elamisest („Kust leian Harku valla toimetulekutoetuse taotluse vormi?“), loetakse serveris muuks mainimiseks (`other`, põhjus `unattributed_other_mention`). Varem muutus sihtinimese piirkond lahendamatuks. See on Q6 ja Q7 kirjes nähtud kuju.
- **Muutmata:** esimeses isikus lause („Olen Harku vallas tööl“, „Kolisin Harku valda“), nimetatud inimese lause („Ema käib Harku vallas arsti juures“), eitus ja elamise lause, mille inimest ei näe, jätavad piirkonna lahendamata nagu seni. Seal võib olla kolimine, mida server ei oska lugeda.

### 4. Plaani enda kohaseosed pöördekirjes

`searchAssist.plannedPlaces` hoiab plaani kohaseoseid nii, nagu mudel need andis (sõnumi number, tsitaat, nimi, inimene, seos), kontrollitud kohtade kõrval. Ainult audit; ükski otsus neid ei loe. Järgmine Q6-laadne pööre näitab, kas plaan jättis koha nimetamata või lükkas server seose tagasi. Kontrollitud `other`-kohal on nüüd ka serveri lugemine `asking`. Hindaja väljund näitab sama (`plannedPlaces`) ja piirkonna valiku liiki (`scopeState`).

### Mida ei muudetud

- Otsinguplaani juhis (`search-assist-6`), dialoogi juhis 24, vastuse juhis, oleku v5 skeem ja `resolvePersonRegions`.
- **Vestlus, kus kellegi elukohta teada pole:** piirkond tuleb endiselt plaani päringutest (`search_plan_region`), täpselt nagu 04.10 õnnestunud korduspööretes R3, R5 ja R7; nii ka selle järelküsimus.

### Teostus

- `lib/rag-v2/pilot/record-scope.js`: `placeOccurrences` annab igale mainimisele `asking` (küsisõnade ja palvete loend eesti, inglise ja vene keeles; süntaksireegel nagu eituse lugemine).
- `lib/rag-v2/pilot/person-places.js`: `questionRegionScope`, `sourceRegionScope`, `askedRegions`; kaks muudatust `checkedTurnPlaces`-is (jaotis 3).
- `lib/rag-v2/pilot/retrieval.js`: `searchScope` kasutab oleku v5 korral `sourceRegionScope`-i.
- `lib/rag-v2/pilot/service.js`: `query.askedRegions` viimase avaldatud vastuse piirkonnakirjest; `plannedPlaces` (`search-assist.js`).
- `scripts/rag-v2-conversation-eval.mjs`: `scopeState`, `plannedPlaces` väljundis.

## Piirid

- **Küsimuseta palve jääb elukoha valda.** „Maardu isikliku abistaja teenus“ või „Soovin infot Maardu … kohta“ ei sisalda küsisõna ega küsimärki; server ei loe seda küsimuseks ja otsib elukohast, nagu enne parandust. Test hoiab seda piirina, mitte eesmärgina.
- **Vald, millele küsimus viitab asesõnaga** („Töötan Maardus, kas sealt saab …?“), ei ole küsimuse sees nimetatud: otsing jääb elukoha valda.
- **Töökoht küsimuse sees pärast küsisõna**, kirjavahemärkideta („kas ma saan koduteenust kui töötan Maardus“), loetakse küsimuse osaks. Vale piirkond tekib siis ainult juhul, kui ka plaani päringud nimetavad üksnes töökoha valda.
- **Järelküsimus toetub plaani päringutele.** Kui plaan kirjutab pärast Maardu küsimust inimese enda palve kohta päringud ainult Maardust, jätkub otsing Maardus. Server ei saa seda sõnumist eristada.
- **Esimeses isikus järelküsimus** („Kuidas ma seda taotleda saan?“), mille plaan nimetab nii küsitud kui oma valda, läheb elukoha juurde. Ainult küsitud valda nimetava plaaniga jätkab see küsitud valda.
- **Järelküsimus, mille plaan küsitud valda ei nimeta**, läheb elukoha juurde.
- **Võrdlus oma vallaga** („kas Maardus on odavam kui Nõos?“) jääb elukoha valda, sest päring nimetab ka inimese enda valda.
- **Kohaseoseta esimeses isikus küsimus** („Kas ma saan Maardus …?“) muudab elukoha endiselt lahendamatuks, kui kohaseos serverini ei jõua. Kohaseosega (`other`) töötab see nagu Q5.
- **Kohaseoseta lause, milles on inimest tähistav sõna** (ka „lapsehoiuteenus“), ei anna küsitud valda: otsing jääb elukoha valda, elukoht jääb alles.
- **Puhta vestluse kaks valda:** piirkonnaks saab viimase päringu vald, nagu seni.
- **Q6/Q7 põhjus on teadmata.** Parandatud on serveri reaktsioon, mitte see, miks kohaseos serverini ei jõudnud.

## Kontrollid

`tests/rag-v2-question-region.test.mjs` (11 testi) viib iga pöörde läbi päris otsinguadapteri kohakontrolli ja piirkonnavaliku (`runtimeAdapters`: `checkedPlaces`, `searchScope`); salvestatud olek on sama `resolvePersonRegions`. Mudelit ega andmebaasi ei kasutata. Enne parandust kukkus esimese versiooni 9 testist 8.

| Nõue | Test | Tulemus |
|---|---|---|
| Selgesõnaline teise valla infopäring | Q3 ja Q5 plaanid ja sõnumid kirjest sõna-sõnalt | otsing Tartu vallas / Maardus; elukoht Anija / Nõo |
| Järelküsimus (Codex F1) | „Ja mis see maksab?“ ja „Kuidas seda taotleda?“ Maardu päringuga | Maardu, elukoht Nõo |
| Mõõdetud plaanid | 04.10 jooksu kohaseosed ja päringud sõna-sõnalt: küsimus, järelküsimus kolme päringuga, oma palve, töökoht, Tartu vald | Maardu; Maardu; Nõo; Nõo; Tartu vald |
| Elukoha säilimine ja tagasitulek | „Aga millist koduteenust ma ise saan?“ kolme päringukomplektiga; pärast seda Maardut nimetav päring; päris kolimine | Nõo; Nõo; Maardu saab elukohaks |
| Töökoha mainimine (Codex F2) | „Elan Nõo vallas, töötan Maardus …“ nelja päringukomplektiga, sh ainult Maardu; töökoht hilisemas sõnumis neljas sõnastuses, kohaseosega ja ilma | Nõo igal juhul |
| Küsimus töökoha kõrval | „Töötan Maardus. Kas Maardus saab …?“, kaudne küsimus, palve, küsimärgiga lause, „kui palju“ | Maardu, elukoht Nõo |
| Kaks valda ühes küsimuses | elukoht + küsitud vald; kaks küsitud valda; küsitud vald + oma vald; jagatud nimi „Tartu“ | küsitud vald ja elukoht salvestatud; kaks kandidaati; elukoht; kaks kandidaati |
| Teise inimese olukord | ema Kose vallas, küsimus Tartu valla kohta ema jaoks; ema töökoht kasutaja küsimuses | Tartu vald, ema jääb Kose valda; kasutaja Anija |
| Q6 ja Q7 | kohaseoseta plaan; vale sõnumi numbriga kohaseos | küsitud vald, elukoht Nõo alles |
| Puhas vestlus | R3, R5, R7 plaanid; järelküsimus | `search_plan_region` nagu 04.10 |
| Mis jääb otsustatuks | eitatud koht + päring; eitus ja küsimus sama valla kohta; kontrollimatu elukohaväide | piirkonda ei valita; elukoht lahendamata |

- **Kahe inimese kataloogid:** kõik `tests/evaluation/dialogue/*.json` kataloogid läbivad kuju kontrolli ja nende testid on muutmata. Nende pöörete piirkonnaootused ei puutu uude reeglisse: seal pole küsimuse sees `other`-mainimist, mida päringud üksi nimetaksid.
- **Muudetud kinnitatud ootus** (`tests/rag-v2-region-state-5.test.mjs`): „Käin Harku vallas arsti juures.“ ilma kohaseoseta jätab nüüd Kose elukohaks. Varem muutus elukoht lahendamatuks (Codex V1, 30.09). See on teadlik muutus jaotise 3 järgi; Codex pidas seda 04.10 põhjendatuks.
- **Kataloog `scenarios-region-state-1.json`, `moved-away-no-new-place`, teine pööre** („Kas Kose vallas on mingi toetus, mida ma veel saaksin?“): elukoht jääb teadmata nagu ootus nõuab; otsingu piirkond võib nüüd olla Kose kui küsitud vald. Kataloog piirkonda ei kontrolli.
- **Kohalik andmebaasitest** (`tests/rag-v2-dialogue-store.test.mjs`, 22/22): üks vestlus läbi päris teenuse: elukoht Kose, küsimus Harku kohta, järelküsimus, oma palve, hilisem Harkut nimetav päring, kohaseoseta küsimus, töökoht ainult Harkut nimetava päringuga. Järelküsimuse piirkond tuleb eelmise pöörde salvestatud kirjest; `plannedPlaces` ja `asking` on pöördekirjes.
- **Täiskomplekt** `node scripts/run-unit-tests.mjs`: 632 testi, 613 läbis, 19 vahele jäetud, 0 ebaõnnestus (pärast mõõtmisjärgset parandust). ESLint muudetud failidel puhas.
- **Codexi sondide kohta:** F2 sondi sisend (kohaseosed `Nõo=lives`, `Maardu=other`, päring ainult Maardust) on testis sõna-sõnalt. F1 sond kutsub `searchScope`-i otse; järelküsimuse jaoks tuleb sellele anda eelmise pöörde küsitud vald (`query.askedRegions`), nagu teenus seda teeb.

## Mõõtmine (04.10.2026, pärast avaldamist)

Omaniku loal üks jooks: kataloog `tests/evaluation/dialogue/scenarios-question-region-1.json` (kolm vestlust, 8 pööret, `--auto-modes`) töötaval plaanil pärast #344 avaldamist (väljalase `a88dfe78`, plaan uuendatud, search-assist-6, dialoog 24). **7 pööret 8-st läbis, kulu plaanihindades 0,0476 USD** (luba: umbes 0,06, peatus enne 0,08). Tõendid: [evidence/question-region-measured-2026-10-04.json](../audits/evidence/question-region-measured-2026-10-04.json); täisraport serveris. Otsustavad vastused on loetud tervikuna.

| Pööre | Plaani kohaseos ja päringud | Otsingu piirkond | Elukoht olekus | Tulemus |
|---|---|---|---|---|
| Elan Nõo vallas … Kust ma abi saan? | Nõo, `lives`; päringud Nõost | Nõo (elukoht) | Nõo | läbis |
| **Kas Maardus saab isikliku abistaja teenust?** | Maardu, `other`; kaks päringut Maardust | **Maardu** (`question_region`) | Nõo | läbis: vastas Maardu korrast, nimetas tingimuseks registrijärgse elukoha Maardus, tagasi ei küsinud |
| **Ja mis see maksab?** | kohta ei nimetanud; päringud: kaks Maardu teenusest, **kolmas „Nõo valla sotsiaalabi toimetulekuraskustes“** | **Nõo** (elukoht) | Nõo | **ei läbinud**: vastus ütles, et kohalik kirje on Nõo valla oma ja Maardu hinda ta öelda ei saa |
| Aga millist koduteenust ma ise saan? | päringud Nõost | Nõo | Nõo | läbis |
| Elan Nõo vallas, töötan Maardus. Millist koduteenust ma saan? | Nõo `lives`, Maardu `other`; päringud Nõost | Nõo | Nõo | läbis; vastus märkis, et Nõo korra elukohatingimus töökohta ei nimeta |
| Elan Anija vallas … | Anija, `lives` | Anija | Anija | läbis |
| Mu ema elab Kose vallas … | Kose, ema, `lives` | Kose | Anija, ema Kose | läbis |
| **Kas Tartu vallas on sotsiaaltransport ja mis see maksab?** | Tartu vald, `other`; päringud Tartu vallast | **Tartu vald** (`question_region`) | Anija, ema Kose | läbis: 3 ja 5 eurot sõidusuuna eest |

**Mida jooks näitas**

- **Põhiparandus töötab päris plaaniga:** mõlemas teise valla küsimuses otsiti küsitud vallast, elukoht jäi alles ja vastus ei küsinud tagasi. Maardu vastus andis elukohatingimuse korra tingimusena ega teinud teenusest kasutaja õigust.
- **Töökoht ei viinud otsingut ära.** Plaan andis töökohale seose `other` ja kirjutas päringud elukoha vallast. Üks jooks; ainult töökoha valda nimetavat plaani ei nähtud.
- **Järelküsimus ebaõnnestus.** Plaan kirjutas „Ja mis see maksab?“ jaoks ka päringu kasutaja enda varasema palve kohta (Nõo vald). Reegel nõudis, et päringud nimetaksid ainult küsitud valda, ja otsing läks elukohta tagasi. See on sama nähtus, mida küsimustiku raport kirjeldab punktis 3: plaan otsib juba vastatud küsimust uuesti.
- **`plannedPlaces` näitas esimest korda plaani enda kohaseoseid:** järelküsimuse ja järgmise pöörde plaan nimetas uuesti esimese sõnumi elukohta („Elan Nõo vallas“, sõnum 1). Server jättis selle kõrvale, sest olek on seda sõnumit juba lugenud.
- **Olek:** ühtki mudeli olekut ei lükatud tagasi.

### Parandus pärast mõõtmist (mudeliga kontrollimata)

**Päring inimese enda valla kohta, mida praegune sõnum ei nimeta, käib varasema asja kohta ega otsusta pöörde piirkonda.**

- Küsimuses endas: küsitud vald jääb piirkonnaks, kui plaan kirjutab selle kõrvale päringu kasutaja varasema palve kohta. Võrdlus, kus sõnum nimetab ka oma valda, jääb elukoha juurde nagu enne.
- Järelküsimuses kehtib see ainult sõnumi kohta, mis ei räägi esimeses isikus. „Ja mis see maksab?“ jätkab Maardut; „Aga millist koduteenust ma ise saan?“ või „Kuidas ma seda taotleda saan?“ koos mõlema valla päringutega läheb elukoha juurde.
- Kolmandat valda nimetav päring jätab otsingu endiselt inimese juurde.

Kontrollitud kohalikult mõõdetud plaanidega sõna-sõnalt (`tests/rag-v2-question-region.test.mjs`, 11 testi): mõõdetud järelküsimuse plaan annab nüüd Maardu, mõõdetud oma palve plaan Nõo. Uut jooksu ei tehtud; luba oli ühele jooksule.

## Mis on mõõdetud ja mis mitte

| Väide | Alus |
|---|---|
| Q3 ja Q5 otsisid elukoha vallast, kuigi plaan nimetas küsitud valda | 04.10 pöördekirjed |
| Q6 kustutas kasutaja elukoha | 04.10 pöördekirje (`dialogueState`) |
| Teise valla küsimus otsitakse küsitud vallast, elukoht jääb, vastus ei küsi tagasi | **mõõdetud**, kaks pööret, üks jooks |
| Töökoha mainimisel jääb otsing elukoha valda | **mõõdetud**, üks pööre; plaani päringud olid elukoha vallast |
| Inimese enda palve pärast teise valla küsimust läheb elukoha juurde | **mõõdetud**, üks pööre |
| Järelküsimus jätkab küsitud valda | mõõdetud reegliga **ei jätkanud**; parandatud reegel ainult kohalike testidega |
| Kaks valda, teine inimene küsitud vallaga, kohaseoseta mainimine (Q6/Q7 kuju) | kohalikud testid |
| Kui sageli kohaseos serverini ei jõua | mõõtmata (04.10 küsimustikus kahel neljast; selles jooksus mitte ühelgi kaheksast) |

Üks jooks ei erista reegli mõju mudeli kõikumisest.
