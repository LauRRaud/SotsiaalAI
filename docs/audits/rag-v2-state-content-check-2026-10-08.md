# Riigi tasandi sisu Luna vastustes: kontroll 08.10.2026

Teostus Claude Opus 5.5. Omanik käivitas ülesande „Kontrolli uut riigi tasandi sisu Luna vastustes“ (lagi 0,10 USD). Küsimus: kas 08.10.2026 lisatud sisu ([ADR-111](../rag-v2/adr-111-state-level-help-first-batch.md), [ADR-112](../rag-v2/adr-112-state-level-help-second-batch.md): 293 ametlikku juhislehte ja 26 seadust) jõuab vastustesse ja kas inimene saab päris abi.

## Lühidalt

- 14 küsimust 12 vestluses, kõik 14 pööret lõppesid ja läbisid kontrolli. Kulu **0,0530 USD** (56 kutset).
- **13 pöördes 14-st** oli uus leht või seadus vastusele antud lõikude hulgas ja vastus viitas sellele. Viidatud 45 allikast 38 on 08.10 lisatud dokumendid.
- Summad ja tähtajad tulid koos allikaga: elatisabi kuni 200 eurot kuus, hambaravihüvitis 60 eurot aastas, maksekäsu vastuväide 15 päeva, pärandist loobumine 3 kuud, vaie 30 päeva, hooldushüvitis kuni 60 päeva.
- Üks küsimus (eestkoste dementsusega emale) sai õige vastuse varasematest allikatest; uutest ei jõudnud otsingu kandidaatide hulka ükski leht.
- Leitud viis asja, mida tasub parandada (allpool). Vestluse koodi selles töös ei muudetud.

## Kuidas mõõdeti

Küsimused saadeti serveris töötava väljalaske enda vestlusteenusest läbi (päris otsing, päris mudel, päris arvestus) kahe ajutise kasutajana: abivajaja (13 küsimust) ja sotsiaaltöö spetsialist (1). Tööriist `w4/check-v72.mjs` on tehtud varasemast kordustesti tööriistast; lagi tuleb arveldatud kutsetest ja jooks peatub 90% juures. Ajutised kasutajad kustutati lõpus. Korpus v72 (indeks `87d4f55c`), vestluse juhised 37, otsinguplaan `search-assist-12`.

Küsimustes ei olnud omavalitsust, et vastus tuleks riigi tasandi allikatest. „Uus“ tähendab dokumenti, mille pealkiri on 08.10 lisatud lehtede või seaduste loendis. Pöörete kirjetest loeti: otsingu 36 kandidaati, vastusele antud lõigud, viidatud allikad, piirangud ja täpsustav küsimus.

## Tabel

| Nr | Küsimus | Kandidaate uusi (leht / seadus) | Vastusele antud lõike (uusi leht / seadus) | Viidatud (uusi) | Hinnang |
|---|---|---:|---:|---:|---|
| P1 | 64-aastane, millal pensionile ja kui suur | 25 / 7 | 8 (7 / 1) | 4 (4) | hea: pensioniiga aasta järgi, staažinõue, kust osakuid näha; küsib sünnikuupäeva |
| P2 | sünnib laps, mis raha riigilt | 20 / 3 | 8 (7 / 1) | 6 (6) | sisu õige, **summasid ei andnud** (leid 1) |
| P3 | isa ei maksa elatist | 28 / 4 | 6 (5 / 1) | 4 (4) | väga hea: kohtutäitur, elatisabi tingimused ja summa |
| P4.1 | töö kadus, ravikindlustus lõpeb | 17 / 8 | 7 (3 / 3) | 3 (3) | hea: Töötukassa kaudu või vabatahtlik leping |
| P4.2 | hammas valutab, kas maksan kõik ise | 23 / 4 | 3 (3 / 0) | 3 (3) | hea: vältimatu abi tasuta, hüvitis 60 eurot, kuupäevaga |
| P5 | koondati, mida teha ja mis raha | 9 / 19 | 14 (0 / 14) | 3 (3) | hea, **ainult seadustest**: Töötukassa juhiseid RAG-is ei ole |
| P6 | laps haige, kes maksab | 21 / 8 | 6 (3 / 3) | 2 (2) | hea: hooldusleht, 80%, kuni 60 päeva; vastab allikale |
| P7 | kohtutäitur arestis konto | 17 / 12 | 8 (4 / 4) | 2 (2) | hea: alammäär jääb, avaldus, 3 tööpäeva |
| P8 | maksekäsu avaldus, ei ole nõus | 18 / 17 | 5 (1 / 4) | 2 (2) | hea: vastuväide 15 päeva, põhjendama ei pea |
| P9.1 | ema dementsus, rahaasjad, kas kohtusse | 0 / 2 | 6 (0 / 0) | 2 (0) | õige ja kasulik, **uutest allikatest mitte midagi** (leid 2) |
| P9.2 | advokaadi jaoks raha ei ole | 9 / 10 | 6 (1 / 2) | 2 (1) | hea; teine viide on asjasse mittepuutuv juhend (leid 3) |
| P10 | isa suri, pärand ja võlad | 22 / 14 | 10 (7 / 3) | 2 (2) | väga hea: notar, 3 kuud, inventuur |
| P11 | elukaaslane lööb | 14 / 5 | 8 (4 / 1) | 6 (4) | hea ja hooliv; politsei osa nõrk (leid 4) |
| S1 | klient ei nõustu valla otsusega (spetsialist) | 13 / 7 | 9 (2 / 1) | 4 (2) | hea: vaie 30 päeva, kaebuse liigid ja tähtajad |

Piiranguga vastuseid oli 11, täpsustava küsimusega 7. Piirangud olid enamasti ausad („sinu summat ei saa arvutada ilma sinu andmeteta“) ja küsimused asjakohased („kas kirjas on sõna makseettepanek ja mis kuupäeval see kätte toimetati?“).

Seaduselõigud juhiseid välja ei tõrjunud: kus juhis on olemas, oli see vastusele antud lõikude hulgas (P3 viis lehte ja üks seadus, P10 seitse lehte ja kolm seadust). Ainult seadustest vastati seal, kus juhist ei ole (P5).

## Leiud

1. **Tulevase sündmuse korral jäid summad ütlemata (P2).** Küsimus „meil sünnib kevadel laps“ sai õige loetelu ja taotlemise käigu, aga mitte ühtegi summat, kuigi leht „Perehüvitiste määrad“ oli vastusele antud. Piirang: „ei saa öelda, millised summad kehtivad lapse sünni ajal kevadel“. Inimene tahab teada praegust suurust; selle saab öelda koos märkusega, et kevadeks võib muutuda. Põhjus on tõenäoliselt aja reegel vestluse juhistes ([ADR-102](../rag-v2/adr-102-time-in-the-answer.md)); ühe pöörde põhjal tõendamata.
2. **Eestkoste küsimus ei leidnud uusi allikaid (P9.1).** 36 kandidaadi hulgas ei olnud ühtegi uut lehte ja ainult kaks uue seaduse lõiku; vastus tuli perekonnaseadusest ja dementsuse kompetentsikeskuse lehelt. Vastus on õige, aga menetluse pool (mida avaldus sisaldab, ekspertiis, kulud) jäi puudu. Sellele vastavat juhist RAG-is ei olegi: kohtute leht „Eestkoste ja järelevalve“ on ainult pilt-link ja notarite volikirja lehte ei ole. Miks tsiviilkohtumenetluse seadustiku eestkoste paragrahvid kandidaatide hulka ei jõudnud, on uurimata.
3. **Riigi õigusabi seadust RAG-is ei ole (P9.2).** Vastus tuli kohtute lehelt „Menetluskulud ja menetlusabi“ ja on õige; teiseks viiteks võeti inimkaubanduse suunamisjuhend, mis teemasse ei puutu. Seadus on väike ja Riigi Teatajas olemas.
4. **Politsei tegevus lähisuhtevägivalla korral (P11).** Küsimusele „mida politsei teha saab“ vastati 2016. aasta ajakirjaartikli näitega (vastus ütleb seda ise ja märgib piiranguks). Uued politsei lehed räägivad avalduse esitamisest ja turvalisusest, mitte sellest, mida politsei kohapeal teha võib. Viibimiskeeld ja ajutine lähenemiskeeld tulevad korrakaitseseadusest ja kriminaalmenetluse seadustikust, mida RAG-is ei ole. Lisaks viitas veebivestluse link kohtinguvägivalla lehele, kuigi sobivam on lähisuhtevägivalla leht.
5. **Töö kaotus ainult seadustest (P5).** Vastus on konkreetne ja õige (arvelevõtmine, tööandja hüvitis, koondamishüvitis staaži järgi), aga asutuse enda juhist ja praeguseid summasid ei ole. Põhjus on teada: Töötukassa lehti ei saa korjata ([ADR-111](../rag-v2/adr-111-state-level-help-first-batch.md)).

## Kontrollitud ja kontrollimata

Kontrollitud: iga pöörde kirjest kandidaadid, vastusele antud lõigud, viited ja piirangud; iga vastuse tekst loetud läbi; hooldushüvitise arvud võrreldud salvestatud Tervisekassa lehega (klapivad).

Kontrollimata: teiste vastuste arvud allikate vastu ükshaaval; küsimused koos omavalitsusega (kas riigi leht ja valla kirje jõuavad samasse vastusesse); pikem vestlus; kiirus (eraldi protsessis jooks on aeglasem kui päris vestlus, ajad ei ole võrreldavad). Üks küsimus teema kohta ei tõenda, et teema on kaetud.

## Mida edasi

Omaniku otsustada: leid 1 on juhiste muudatus; leiud 3 ja 4 on kolme seaduse lisamine (riigi õigusabi seadus, korrakaitseseadus, kriminaalmenetluse seadustiku lähenemiskeelu osa), paari sendi suurune ost; leid 2 vajab esmalt põhjuse uurimist (tasuta).

## Täiendus 09.10.2026: parandused ja kordusmõõtmine

Omanik 09.10.2026: „on meil veel RAG süsteemi arendust. Jätka“ ja „luba on antud raha kulutada“. Kolm leidu on parandatud ([ADR-114](../rag-v2/adr-114-present-figure-for-a-future-event-and-three-laws.md)), üks osutus mitte-veaks, üks jääb lahti.

| Leid | Mis tehti | Mõõdetud tulemus |
|---|---|---|
| 1. Tulevase sündmuse korral jäid summad ütlemata | vestluse juhised 38 → 40: praegu kehtiv summa öeldakse koos seisu ajaga; veebilehe kaart kannab lehe enda viimase muutmise päeva (`page_updated`) | „meil sünnib kevadel laps“ sai juhistega 40 kahel jooksul kahest summad: „18. septembri seisuga on sünnitoetus 320 eurot ühekordselt“, lapsetoetus 80 eurot kuus, vanemahüvitise alam- ja ülempiir; ühes vastuses lause, et summad võivad kevadeks muutuda, piiranguid ei olnud |
| 2. Eestkoste küsimus ei leidnud uusi allikaid | pöörde kirje vaadati üle | viga ei olnud: kaks tsiviilkohtumenetluse seadustiku lõiku oli kandidaatide hulgas, valik jättis alles praktilisemad; üks uuring võttis 36 kandidaadikohast 10 (tähelepanek) |
| 3. Riigi õigusabi seadust ei ole | korpus v73: seadus tervikuna | „advokaadi jaoks raha ei ole“ viitab nüüd seadusele ja kohtute lehele; asjasse mittepuutuvat juhendit enam ei viidatud |
| 4. Politsei tegevus lähisuhtevägivalla korral | korpus v73: korrakaitseseadus ja kriminaalmenetluse seadustik tervikuna | vastus nimetab viibimiskeelu perevägivalla ohvri kaitseks kuni 72 tundi (võrreldud seaduse tekstiga) ja ajutise lähenemiskeelu; 2016. aasta artiklit enam ei kasutatud |
| 5. Töö kaotus ainult seadustest | ei tehtud | Töötukassa lehti ei saa korjata; jääb lahti |

Mõõtmised (serveri enda vestlusteenusest läbi, ajutiste kasutajatega):

| Juhised | Küsimusi | Kulu, USD | Mis selgus |
|---|---:|---:|---|
| 38 | 6 | 0,0247 | summad tulid; kolm seadust jõudsid vastustesse; oleviku küsimus ei saanud asjatut märkust; märkus „võib muutuda“ oli kahes vastuses ka piirangute all |
| 39 | 3 | 0,0129 | sama lapse sünni küsimus jäi seekord summadeta: lehe kaardil ei olnud kuupäeva, millega summat öelda |
| 40 | 5 | 0,0168 | lapse sünni küsimus sai summad mõlemal jooksul, lehe enda kuupäevaga; rahvapensioni küsimus („jään kahe aasta pärast pensionile“) sai summa mõlemal jooksul, aga hoidis piirangut, et kahe aasta pärast kehtivat määra ei saa öelda |

Kokku 14 pööret, 0,0544 USD; korpuse v73 ost 0,0620 USD.

**Mida see ei tõenda.** Sama küsimus andis juhistega 38 ja 39 erineva tulemuse, nii et üks jooks ei ole tõend; juhistega 40 on kaks jooksu kahest korras, mis on vähe. Rahvapensioni vastuse piirang on kaitstav (inimene küsis tuleviku summat), aga näitab, et „ei saa öelda“ ei kao juhisega täielikult. Teisi vastuseid (kas uus lause lisab kuhugi asjatu märkuse) vaadati ainult kahe oleviku küsimusega.

### Kolmas partii (korpus v74)

Samal päeval lisati 37 ametlikku juhislehte ([ADR-115](../rag-v2/adr-115-state-level-help-third-batch.md)): Justiits- ja Digiministeeriumi lehed õigusabist, lähenemiskeelust, kuriteoohvri õigustest, täitemenetlusest ja maksejõuetusest ning haridusasutuste lehed toe vajadusega õpilasest. Kolm küsimust pärast paigaldust (0,0120 USD), kõik lõppesid:

| Küsimus | Tulemus |
|---|---|
| Endine elukaaslane käib ukse taga ja helistab; mis on lähenemiskeeld ja kuidas selle saab | viitab ministeeriumi lähenemiskeelu ja kuriteoohvrite õiguste lehele, tsiviilkohtumenetluse seadustikule ja ohvriabi lehtedele; ütleb, kes keelu määrab, et tsiviilkohtumenetluses võib see olla kuni kolmeks aastaks, ja annab ohvriabi kriisitelefoni; piiranguid ei olnud |
| Pensionär, maavaidlus naabriga; kust saab tasuta õigusnõu | viitab lehele „Tasuta õigusnõu eakatele“ ja riigi õigusabi seadusele: teabepäevad, küsimuse esitamine juristile, riigi õigusabi tingimused; piirang, et selle vaidluse jaoks tasuta personaalset nõustamist ei saa kinnitada |
| Poeg käib 3. klassis ja ei saa õppimisega hakkama; mis tuge kool andma peab | viitab ministeeriumi lehele toe vajadusega õpilastest, põhikooli- ja gümnaasiumiseadusele ja Sotsiaalkindlustusameti lehele: kooli kohustus tuge hinnata ja anda, tugispetsialistid tasuta, kellest alustada, millal Rajaleidja; piiranguid ei olnud |

Kõigis kolmes oli uus leht vastusele antud lõikude hulgas ja viidatud. 09.10.2026 mõõtmised kokku 17 pööret, 0,0664 USD; korpuseostud v73 ja v74 kokku 0,0809 USD; päev kokku 0,1473 USD.
