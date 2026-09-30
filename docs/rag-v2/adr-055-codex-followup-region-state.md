# ADR-055 — Üks isiku piirkonna otsus otsingule ja mälule (olek v5), taastamise järjekord, plaani ID ja ristviidete lugeja

29.–30.09.2026. Teostus Claude Opus 5.5 Codexi järelülevaate leidude J1–J6 ja teostusanalüüsi (jaotis 7) põhjal ([audit](../audits/rag-v2-followup-review-2026-09-29.md)). Poolelioleva v5 kontroll leidis veel neli vastunäidet V1–V4 ja 30.09 järelkontroll kolm seotud leidu N1–N3 ([kontroll](../audits/rag-v2-state-v5-review-2026-09-29.md)); need on parandatud allpool. Omanik 29.09: „kui saab paremini, siis tuleb veidi paremini“.

## Probleem

- **J1:** otsinguplaani päring võis tuua tagasi piirkonna, mida kasutaja oli eitanud. `knowledgeRegionScope` võttis piirkonna päringust alati, kui `scope.region` puudus. Ta ei eristanud, kas piirkond oli teadmata või eitatud, mitmetähenduslik või kuuluvuselt lahendamata.
- **J2:** kui sama kohanimi kordus, luges kontroll eitust esimesest samanimelisest lausest (`indexOf`), mitte selle isiku lausest. Näide: „Mina ei ela Kose vallas. Minu ema elab Kose vallas.“ Ema koha kontroll leidis esimese lause eituse.
- **J3:** kahe koha puhul jättis otsing piirkonna mitmetähenduslikuks, aga olek salvestas ühe kindla koha. Ka kohtade järjekord mudeli vastuses muutis tulemust.
- **J4:** `needs_recovery` pööre ei hoidnud oma vestluse järjekorda. Uus pööre võis enne teda lõppeda ja hilinenud taastamine avaldada vana vastuse uuema peale.
- **J5:** ristviidete lugeja kaotas akti ulatuse. „Teise seaduse § 131 ja § 133“ andis oma akti `133`; „käesoleva seadustiku“ jäi välja; vahemik andis ainult otsad; komaloetelu ainult esimese.
- **J6:** sekunditäpsusega plaani-ID võis kahel samal sekundil tehtud plaanil kokku langeda.

## Otsus

### Olek v5 (`m4-dialogue-state-5`), otsinguplaan `search-assist-5`, prompt `m4-grounded-dialogue-18`

Andmevoog on nüüd ühesuunaline:

```text
nummerdatud kasutajapöörded + eelmise oleku inimesed
  -> otsinguplaan: iga koha kohta pööre, täpne osalause, eestikeelne nimi, isik ja suhe
  -> checkedTurnPlaces: tsitaat nimetatud pöördes, kohanimi ja eitus just selles kohas
  -> resolvePersonRegions: iga isiku piirkonnaseis
  -> sama tulemus: kataloogi filter, teadmusotsingu omavalitsuse filter ja järgmine olek
```

- **Plaani koht** (`search-assist.js`) nimetab oma pöörde (`turn`, 1–8), tsiteerib isikut ja suhet näitavat osalauset (mitte ainult kohanime, kuni 160 märki) ja annab koha nime nii, nagu eestikeelsed ametlikud tekstid selle kirjutavad (`name`: „Kose vald“ tekstile „в Козе“). Küla või linnaosa jääb oma nime juurde, omavalitsuseks seda ei teisendata.
- **Ühine koht teisele inimesele (V4):** plaan annab teisele inimesele sama koha ainult siis, kui sõnum seda ütleb: nad elavad koos (leibkond) või sõnum ütleb ühise koha („me elame Tartu linnas“). Naaber, sugulane või tuttav üksi kohta ei saa. Server kontrollib seda ka ise: ainsuse esimese isiku osalause („Elan Harku vallas“, „Я живу в Харку“) on kasutaja oma. Teine inimene saab selle koha ainult siis, kui osalause ütleb kooselu („koos“, „emaga“, „вместе“, „с мамой“) või on mitmuses („me elame“); muidu `clause_is_the_users`.
- **Kontroll** (`checkedTurnPlaces`, `person-places.js`):
  - otsib tsitaati ainult nimetatud pöördest. Tsitaat leitakse ka siis, kui see erineb sõnumist ainult suurtähtede, tühikute või kirjavahemärkide poolest (`locateQuote`); edasi loetakse kasutaja enda sõnu. Kui tsitaati pole nimetatud lugemata pöördes (`quote_not_in_turn`) või see kordub (`quote_repeated`), jääb omistus lahendamata;
  - koht sõnumist, mille salvestatud olek on juba lugenud, või sealt kordatud tsitaat jäetakse välja, sest see on olekus juba olemas. Serveri esimene v5 jooks näitas, et plaan loetleb vahel varasema sõnumi koha uuesti. Range kontroll tegi sellest lahendamata omistuse ja kustutas teadaoleva koha: ema Harku kadus pöördes „Kui palju see talle maksma läheb?“. Kahe inimese kataloogid langesid 8/8 → 6/8 ja 5/5 → 2/5, mälukataloog 4/8;
  - kui osalause nimetab mitut omavalitsust (plaan tsiteeris terve lause „Ma ei ela enam Kose vallas, elan nüüd Harku vallas“), valib plaani nimi nende seast ühe. Nimi ei lisa kohta, mida osalauses pole; kui nimi ühte ei vali, tuleb `quote_names_several_places`;
  - valitud kohal peab tsitaadis olema täpselt üks mainimine (V2). Terve lause „Mina elan Kose vallas, aga ema ei ela Kose vallas“ ühe tsitaadina ei otsusta kummagi kohta (`place_repeated_in_quote`); täpsed osalaused otsustavad;
  - eitust loetakse selle ainsa mainimise juures: lause algusest tsitaadi lõpuni (`occurrenceNegated`). Mudeli „lives“ muutub „not“-iks, kui lause seda eitab.
- **Teises kirjas koht** (`translatedMention`, `record-scope.js`, V3 järel täpne):
  - Plaani eestikeelne nimi peab olema täpselt üks omavalitsus.
  - Kirillitsas sõna transliteeritakse fikseeritud tabeliga ja seda võrreldakse **kogu kataloogi** omavalitsuste nimedega täpselt. Sõna võib olla sellisena või ilma ühe vene käändelõputa; a-lõpulise nime korral ka ilma a-ta.
  - Näited: „Козе“ → Kose, „Таллине“ → Tallinn, „Нарве“ → Narva, „Йыхви“ → Jõhvi, „Нарва-Йыэсуу“ → Narva-Jõesuu.
  - Mõlemal poolel on samad ainult diakriitikud, z/s ja topelttähed. Ükski muu täht ei tohi erineda; ligikaudset kaugust ei kasutata.
  - Ladina kirjas sõna seda teed ei lähe (selle loeb EstNLTK kataloogi vastu), seega „koos“ ei ole Kose.
  - Seos kehtib ainult siis, kui sõna nimetab kataloogis täpselt üht omavalitsust ja see on plaani nimetatu. „в Тарту“ sobib Tartu linnale ja vallale: `name_matches_several_places`. Ilma seoseta jääb koht lahendamata (`place_link_unverified`), ja otsingupäring seda ei taasta.
- **Plaanist välja jäänud koht (V1; mainimise ja inimese kaupa pärast N1–N3, 30.09):**
  - Praeguse sõnumi iga omavalitsuse mainimine loetakse koos asukoha, eituse ja osalausega (`placeOccurrences`). Ladina kirja nimed loeb EstNLTK, kirillitsas nimed täpne transliteratsioon, ja mõlemal on sama eitusereegel (N3).
  - Kontrollitud plaanikoht katab ainult oma tsitaadi sees olevad mainimised. Teise inimese sama piirkond ega `other` mainimine ei kata sama sõnumi teist mainimist (N2).
  - Katmata mainimine kuulub:
    - kasutajale, kui osalause on ainsuse esimeses isikus („Ma ei ela enam Kose vallas“, „Я больше не живу в Козе“). Eituse loeb server kasutaja `not`-iks (`server_read_negation`), nii et kolimine hoiab uue koha ja välistab vana;
    - kasutajale ka siis, kui osalause on ainsuse esimeses isikus elukohaütlus ilma eituseta (`server_read_residence`: „Olen Harkus.“, „Я живу в Харку“; mõõdetud 30.09, plaan jättis koha loetlemata). Elukohaks loeb server elamisverbi samas osalauses enne kohta („elan“, „живу“, „live“; ka „tegelikult elab ema Harkus“, kus alus on verbi ja koha vahel) või „olen/asun“, kui koht lõpetab osalause. „Olen Harkus tööl“ ei ole kodu. Mineviku vorm („elasin“, „elanud“, „жила“, „lived“) ei ole praegune kodu; „ei ela ema Harkus“ on eitus;
    - kasutajale ja sihtisikule, kui osalause on mitmuse esimeses isikus elukohaütlus („Me elame Tartu linnas“). Sihtisik saab koha ainult siis, kui tal kohta veel pole; teadaolevat kohta see ei asenda. Sama kehtib, kui plaan andis sellise osalause ainult kasutajale (`shared_clause`; kataloogi v4 juhtum „Naabri väike laps … Me elame Tartu linnas“);
    - ühele teadaolevale inimesele, kui osalause nimetab teda („Ema elab Kose vallas“).
  - Osalause, mis nimetab kedagi, keda vestlus ei tunne, või mitut inimest (isikunimisõnad nagu „naabri“, „sõber“, „соседка“), on nende kohta. See ei otsusta midagi sihtisiku ega kellegi teise jaoks („Naabri omavalitsus on Kose vald“, mõõdetud 30.09).
  - Muul juhul (osalause ei nimeta kedagi) on mainimise inimene ebaselge. Sihtisik, eituse korral ka kõik selle koha praegused elanikud, jääb ilma kohata (`place_not_attributed`).
  - Kes sai samas sõnumis uue kodu, plaanist või serveri lugemisest, hoiab selle teise osalause mainimise vastu („Ema elab Tartus, aga töötab Harkus“).
  - Muu jaatav katmata mainimine, mis pole elukohaütlus, annab oma inimesele lahendamata koha: plaan ei kinnitanud seda elukohaks.
  - Kellegi koht ei muutu ainult seetõttu, et teisel inimesel oli sama koht (N1: kasutaja kolib Harkusse, ema jääb Kosesse).
  - **Sihtisik** (`regionTarget`) on plaani nimetatud isik. Kui plaan ütleb `unclear`, on see ainus teadaolev inimene, keda sõnum nimetab, eeldusel et sõnum pole ainsuse esimeses isikus („Ja ema, kas tema saaks sotsiaaltransporti?“, mõõdetud 30.09). Selle puudumisel on see vestluse fookus, siis kasutaja. Otsing, katmata mainimised ja oleku fookus kasutavad sama inimest.
  - Sama kehtib, kui plaani kutse ebaõnnestub: kohad kontrollitakse siis tühja plaaniga.
  - Otsingul pole teist teed selle otsuse ümber. `personRegionScope` ei anna otsust vanale resolverile, ja järgmise pöörde mälu ei taasta kohta, mille sõnum võis tagasi võtta.
- **Piirkonnaseis** (`resolvePersonRegions`):
  - pöördeid loetakse ajalises järjekorras, ühe pöörde kohti aga hulgana, nii et järjekord mudeli vastuses ei loe;
  - üks jaatav koht annab `reported`, mitu `ambiguous` koos kandidaatidega;
  - eitus eemaldab ainult sama inimese sama koha (`negated`, välistused jäävad alles);
  - sama koha vastuolu või lahendamata kuuluvus annab `unresolved`;
  - uus koht asendab vana (kolimine) ja hilisem eitus vana, juba asendatud kohta tagasi ei too;
  - hoitakse kuni neli inimest, kasutaja ja fookus alati.
- **Üks lugemine kahele otsingurajale ja mälule:**
  - `personRegionScope` teeb piirkonnaseisust otsingu ulatuse: `negated` → `region_required_after_negation`, `ambiguous` → `ambiguous_region`, `unresolved` → `region_required` põhjusega `attribution_unresolved`;
  - `searchScope` (`retrieval.js`) annab sama `knowledgeRegion`-i kataloogile ja teadmusraja omavalitsuse tekstidele;
  - `knowledgeRegionScope` võtab piirkonna päringust ainult siis, kui vestlus pole kellegi kohta otsustanud (`region_required` ilma põhjuseta). Eitust, mitmetähenduslikkust ega lahendamata kuuluvust ta enam ei asenda (J1);
  - oleku v5 projektsioon kasutab sama `resolvePersonRegions`-i ja sama pöörde kontrollitud kohti.
- **Prompt 18:** vastusemudel teab, et isiku piirkond võib olla eitatud, mitmetähenduslik või lahendamata. Siis pole sellel isikul omavalitsust, ja kui kohalik abi on oluline, küsib ta, milline omavalitsus see on.
- **Vanad vastused:** v4 projektsioon jääb muutmata lugemiseks ja taastamiseks. v4-ga uut pööret ei käivitata. Test loeb ja taastab v4 vastuse, mis tehti üks kord commiti `21aabc81b` koodiga (`tests/fixtures/rag-v2-dialogue-state-4-answer.json`), ja seda näidist uue koodiga ümber ei arvutata. Muudetud salvestatud olek kukub kontrollis läbi (`dialogue_state_projection_mismatch`).

### J4: taastatav pööre hoiab oma vestluse järjekorda (`store.js`, `service.js`)

- Kui vestluses on `needs_recovery` pööre, ei võta `claim` uut pööret vastu (`conversation_recovery_pending`, 409).
- Teenus taastab vestluse ootel pöörded enne uut pööret. Kui taastamine ebaõnnestub, tuleb `conversation_recovery_failed` (409).
- Avaldamine keeldub, kui samas vestluses on uuem lõpetatud pööre (`turn_superseded`, 409). Hilinenud taastamine ei kirjuta vana vastust uuema peale.

### J6: plaani ID (`chat-plan.js`)

- ID on sekundi täpsusega aeg koos juhusliku UUID-ga. Kaks samal sekundil loodud plaani saavad eri ID ja eri kulupäeviku.
- Uuendamisel säilivad eelarve, lubatud kasutajad ja `budgetLedger`.

### J5: ristviidete lugeja (`search/legal-references.js`), otsingusse ühendamata

- **Loetelu:** lugeja loeb loetelu tervikuna: märgid, numbrid, vahemikud, komad, „ja/ning/või“ ja väiksemad üksused („lõike 1 punktides 2 ja 3“, „teises lauses“). Loetelu akt kehtib kogu loetelule.
- **Mitu numbrit ühe märgi järel:**
  - mitmuse märk („§-des 105, 106 ja 107“) loeb kõik;
  - ainsuse märk loeb järgmise palja numbri ainult siis, kui loetelu jätkub („§-s 200, 214, § 215“, aga mitte „§ 9 ja 16 kuu jooksul“);
  - järgarv („16. peatükis“) paragrahv ei ole.
- **Kelle paragrahv:**
  - „käesoleva seaduse/seadustiku/koodeksi/määruse/korra“ on oma akt;
  - teise akti nimi (ka nimetavas, avaldamisviite, pealkirja või peatüki kaudu) või lühend („SHS“, „KOKS-i“) on võõras akt;
  - „sama seaduse“ on viimati nimetatud akt;
  - „… kehtinud/kehtiva redaktsiooni § …“ on teine redaktsioon (`other_version`);
  - paljas loetelu on oma akt, välja arvatud siis, kui lauses on pärast viimast oma akti loetelu nimetatud teist akti (`act_scope_unclear`).
- **Vahemik** annab kõik akti järjestuses vahele jäävad paragrahvid, ka ülaindeksiga lisaparagrahvid. Seepärast vajab funktsioon akti järjestatud paragrahve (`actSections`), mitte hulka.
- **Lahendamata jäävad põhjusega:**
  - `section_not_in_act`;
  - `section_ambiguous` (kadunud ülaindeks, mida ei saa üheselt taastada);
  - `range_bound_unknown`, `range_reversed`;
  - `range_too_long` (üle 30);
  - `reference_limit` (üle 60).

  Midagi ei lõigata vaikides näiliselt täielikuks.
- **Pealkiri:** paragrahvi enda pealkiri rea alguses („§ 12. Teenuse …“) ei ole viide.
- **Kontroll korpuse peal:** kohaliku korpuse 100 Riigi Teataja aktist 89-l on paragrahvid, kokku 7510 tükki. Tulemus:
  - 2228 oma akti viidet;
  - 1292 võõra akti loetelu;
  - 323 põhjendusega lahendamata: `section_ambiguous` 211, `section_not_in_act` 47, `act_scope_unclear` 38, `other_version` 21, `same_act_unknown` 6.

  Kontrollitud näidetes polnud valesid sihte. Lahendamata juhud olid põhjendatud: kehtetu paragrahv, teine redaktsioon või lauses nimetatud teine akt.
- Graafi seos (`REFERS_TO`, lähte- ja sihtversioon, üksus, tekstikoht) ja otsingusse ühendamine on eraldi samm (Codex 7.4 p 5 ja 7.7).

### Hindaja: fakti elutsükkel (Codex 7.6)

- Uued ootused `facts_present`, `facts_absent`, `fact_changes` ja `allowed_dropped` loevad salvestatud fakte, mitte `model.accepted`-it.
- Iga kasutaja fakti, muudatuse, perioodi või oleku väljajätmine vajab oma luba (liik, põhjus, soovi korral isik või fakt). Üks luba katab ühe väljajätmise. Vajaduse või lahtise küsimuse väljajätmine on mudeli järeldus, mitte kadunud fakt.
- Oleku v5 väljajäetud uus fakt nimetab oma isiku ja väljajäetud muudatus oma fakti. v4 väljund jääb baitide kaupa samaks.
- Kataloogid: `scenarios-fact-lifecycle-1.json` (parandus, teise isiku sama teema, tagasivõtmine) ja `scenarios-region-state-1.json` (J1–J3 ja teine kiri). Mõlemad kirjutati enne esimest jooksu.

### Sõnastuse parandused (Codex jaotis 3)

- ADR-054: graafi järeldus ütleb nüüd, et laiendatud eelarve ei andnud tõenditeksti katvusele lisa. Graafi enda mõju pole eraldatud (laeefekt, graaf mõlemas profiilis sees). Kuuldeaparaadi viga kordus kahes kulujooksus kolmest.
- ADR-048: kiiruse põhjuslik väide on nõrgendatud mõõdetu tasemele.

### Codexi järelülevaade 30.09: R1 ja R2 ([Codexi järelülevaade 30.09](../audits/rag-v2-pr264-272-review-2026-09-30.md))

- **R1:** plaani tsitaat kattis enne kontrolli kogu oma lõigu. „Ma ei ela enam Kose vallas, ema elab Harku vallas“, tsiteeritud terve lausena ema jaoks, peitis nii kasutaja eituse; kui plaan nimetas kolimislauses ainult ühe koha, kadus teine.
  - Nüüd katab plaan ainult selle ühe mainimise, mille omistus lahenes. Lahendamata omistus ei kata midagi.
  - Serveri selge lugemine sama inimese ja koha kohta samas sõnumis asendab plaani lahendamata omistuse.
- **R2:** plaaniga rada luges eitust ainult koha eest (`occurrenceNegated`), plaanita rada ka elamisverbi ja koha vahel oleva alusega lausest (`livingInClause`). „Praegu ei ela ema Kose vallas“ oli ema „not“ ainult ilma plaanita.
  - Nüüd kasutavad mõlemad sama esinemise lugemist (`placeOccurrences`).
- `tests/rag-v2-region-state-5.test.mjs`: Codexi näited annavad plaaniga ja plaanita sama tulemuse. Vana koodiga testid kukuvad, varasemad V1–V4 ja N1–N3 läbivad.

## Piirid

- Kontroll ei tõesta, et mudel luges isiku õigesti. Kui plaan paneb kolmanda isiku osalause („Ema elab Harku vallas“) vale isiku alla, jääb see nii. Kontrollitakse ainult kasutaja enda esimese isiku osalauset (V4).
- **Ettevaatlikkuse hind:** kui plaan jätab kolmanda isiku elukoha loetlemata („Ema elab Harku vallas“), küsib vastus omavalitsust, kuigi sõnum võis selle öelda. See on V1 lepingu teadlik valik: kolmanda isiku elukohta ei loe server ise, sest ta ei tea, kas lause subjekt on see inimene. Kasutaja enda esimese isiku elukoha ja eituse loeb server ise. Hindaja jooks salvestab nüüd plaani kontrollitud kohad (`observed.places`), nii et neid juhtumeid saab loendada.
- Transliteratsioon katab kirillitsa. Muu kirja koht jääb lahendamata. Vene omadussõnavorm („Харкуской волости“) ei ole nimi ja jääb lahendamata.
- Küla või linnaosa ei muutu omavalitsuseks. Kui plaan annab küla kohta omavalitsuse nime, jääb isiku piirkond lahendamata ja vastus küsib omavalitsust.
- Ristviidete lugeja ei tunne dokumentidevahelisi viiteid ega vanu redaktsioone. Need vajavad eraldi akti ja redaktsiooni lahendajat.
- **Korpuse kontrollis leitud viga (järgmine samm):** Riigi Teataja XML-i sisutekstis on ülaindeks XML-element (`§ 45<sup>9</sup>`). `text-source.js` teisendab ainult CDATA-sisest `<sup>`-teksti, seega loevad tükid „§ 459“. See puudutab ka vastuste viiteid. Parandus muudab korpuse teksti ja vajab uut korpuse versiooni, seega on see eraldi PR.

## Kontroll

- Ühiktestid:
  - `tests/rag-v2-region-state-5.test.mjs`: J1–J3, teine kiri, v4 taastamine; V1 (kolm pööret, poolik plaan, ebaselge isik, teise inimese koht), uuesti loetletud koht, tsitaadi leidmine, V2 mõlemas suunas täpsete osalausete ja terve lausega, V3 (kohanimeta laused, linn/vald, sidekriipsuga nimi, õiged transliteratsioonid, valed piirkonnad), V4 (plaani juhis ja serveri kontroll); N1–N3 (ema jääb kasutaja kolimisel oma kohale, ka järgmises pöördes; ema koht ei kata kasutaja eitust kummaski lausejärjekorras ega `other` mainimisega; eitus eesti ja vene keeles mõlemal pool töökohta); sihtisik ebaselge plaani korral;
  - `tests/rag-v2-legal-references.test.mjs`: loetelu akt, oma seadustik, komaloetelu, täielik vahemik, ülaindeks, kadunud ülaindeksi mitmetähenduslikkus, lühend, lausepiir, redaktsioon;
  - `tests/rag-v2-conversation-eval.test.mjs`: iga elutsükli ootuse negatiivne paar;
  - `tests/rag-v2-chat-plan.test.mjs`: J6.
- Andmebaasitestid:
  - `tests/rag-v2-pilot-store.test.mjs` (J4: järjekord, ebaõnnestunud ja hilinenud taastamine, samaaegsed taastamised);
  - `tests/rag-v2-dialogue-store.test.mjs`: igas pöördes võrreldakse kataloogi, teadmusrada ja salvestatud olekut päris `checkedPlaces`-i ja `searchScope`-iga. Stsenaariumid: J1–J3 ja teine kiri; V1 viis pööret (koht, loetlemata eitus, järgmine küsimus, poolik plaan ebaselge isikuga, uuesti loetletud koht). J1 vana kaitse tagasipanek kukutab selle testi läbi.
- Codexi 30.09 sond ([`rag-v2-negation-review-2026-09-30-probes.mjs`](../audits/rag-v2-negation-review-2026-09-30-probes.mjs), sama `checkedPlaces` → `searchScope` rada): kõik üheksa juhtu annavad soovitud tulemuse. N1: kasutaja Harku, ema Kose. N2: kasutaja eitatud, ema Kose, otsing `null`. N3: kasutaja eitatud, Harku jääb töökohaks. Sondi assert'id kirjeldavad vana käitumist ja kukuvad nüüd teadlikult läbi.
- Codexi varasem sond ([`rag-v2-state-v5-review-2026-09-29-probes.mjs`](../audits/rag-v2-state-v5-review-2026-09-29-probes.mjs)): V2, V3 ja V4 ei kordu. V1 sond annab otsingule tühjad kohad `checkedPlaces`-ist mööda, mida teenus ei tee. Teenuse enda teega (`checkedPlaces` ja siis `searchScope`) on otsing `null`, olek `unresolved` ja järgmine pööre `null`.

### Tulemused serveris, 29.–30.09.2026

Aktiveerimata plaanid iseseisvas `eval-full` koopias, korpus v38, profiil v1.

- **x** (`m4-eval-full-20260929x`): main (olek v4) koos uue hindaja ja kataloogidega.
- **y** (`…20260929y`): esimene v5.
- **c** (`…20260930c`) ja **d** (`…20260930d`, commit `3d976b93a`): V1–V4 ja N1–N3 järel.
- **f** (`…20260930f`, commit `e83966dd`): lõplik.

| Kataloog | x (v4) | y (esimene v5) | c | d | f (lõplik) |
|---|---:|---:|---:|---:|---:|
| `region-state-1` (11) | 6/11 | 9/11 | 11/11, 11/11 | 11/11, 11/11 | **11/11, 11/11** |
| `fact-lifecycle-1` (6) | 5/6 (vastus) | 6/6 | 6/6 | 5/6 (vastus) | — |
| `two-people-1` (8) | 8/8 (ADR-051) | 6/8 | 6/8 | 8/8, 8/8 | **8/8** |
| `two-people-2` (5) | 5/5 (ADR-051) | 2/5 | 5/5 | 5/5 | **5/5** |
| `memory-1` (8) | 8/8 (prompt 17) | 4/8 | 8/8 | 7/8 (vastus) | 7/8 (vastus) |
| Kataloog v4 (40) | 40/40 (ADR-054) | 38/40 | 39/40 (vastus) | 39/40 (olek) | **40/40** |
| Katvuskataloog (10) | 10/10 | — | 10/10 | 9/10 (otsing) | — |
| Lisade kataloog (4) | 4/4 | — | 4/4 | 4/4 | — |
| Kulukataloog (5) | 5/5 | — | 5/5 | 5/5 | — |

- **Vahejooksud leidsid ja parandasid:**
  - y: plaan loetles loetud sõnumi koha uuesti ja v5 kustutas teadaoleva koha (ema Harku). Kahe inimese kataloogid 6/8 ja 2/5, mälu 4/8;
  - c: plaan tsiteeris naabri osalause ilma kohata;
  - d: „tegelikult elab ema Harkus“;
  - e (`…20260930e`): „Elasin Kose vallas, aga enam ma seal ei ela“ ja „Naabri omavalitsus on Kose vald“.

  Iga parandus on eespool reeglina kirjas ja ühiktestis.
- **„Vastus“ tähendab:** vastus ei nimetanud parandatud summat („Vabandust, võlgu on hoopis 5000 eurot“ → vastus räägib võlanõustamisest ilma summata). Olekukontrollid läbisid. Sama viga oli v4 baasis (x) ja varem prompt 17-ga umbes kolmandikus jooksudest. See on vastuse sõnastuse küsimus, mitte olekuviga (avatud S1.0-s).
- **d „otsing“:** Harku lapsehoiu toetuse määrav fraas ei jõudnud tõenditesse, kuigi piirkond oli õige. c-s ja varem leiti see. See on otsingu ja reranki kõikumine.
- **Mõõtmine ei loe** plaani tsiteeritud teksti. Jooks salvestab ainult kontrollitud kohad (`observed.places`), sest vestlused kustutatakse pärast jooksu.
