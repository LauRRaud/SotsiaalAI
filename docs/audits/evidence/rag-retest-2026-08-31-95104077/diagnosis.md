# 31.08.2026 — väljalaske 95104077 FAIL/PARTIAL-põhjuste diagnoos

See on lõpetatud kahefaasilise korduse tõendipõhine hetktõmmis, mitte uus elav seisufail. Aktiivne tööots jääb [SotsiaalAI.md](../../../platvormi%20arendus/SotsiaalAI.md) S1.0-sse.

## Põhijäreldus

Viimase kaheksa vastuse kaks FAIL-i pärinevad samast M02 küsimusest; kolm PARTIAL-i on integreeritud teenuste mõlemad vastused ja lapse heaolu eraldiseisev vastus. Põhjus ei ole üks üldine RAG-i otsingurike ega küsimuse vale kääne. Tõendatud on viis omavahel seotud rikkekohta:

1. M02 tõendileping seob ühe soovituse vale tähendusega tekstiga ning teeb teistes soovitustes kõrvalised sõnad ja tegevused kohustuslikuks.
2. Lapse heaolu allikakontroll jätab pikema vastuse 64. väite järgse osa läbi vaatamata.
3. Integreeritud teenuste eraldiseisvas vastuses loetakse kaks hajutatud üldsõna sisuliseks väitetoeks ja kuvatakse üleliigne allikas.
4. Integreeritud teenuste järjestikvastuses eraldatakse ilmumisaasta ülejäänud väitest ja peidetakse tegelikult kasutatud 2026. aasta allikas.
5. Sõltumatu süntees võtab ekslikult kaasa ajalooallika; isegi tühi lisaotsing muudab põhitulemuste skooriskaalat ja konteksti valikut.

Koodi, korpust, indekseid ega serveriseadistusi selle diagnoosi käigus ei muudetud. Uusi testküsimusi ei saadetud. Paranduste järel tuleb käitumine uuesti tõendada; diagnoos ei muuda olemasolevaid hindeid PASS-iks.

## 1. Tõendi päritolu ja piirid

- Mõõdetud kohaliku `main`-i, `origin/main`-i ja serveri HEAD: `c405d3ca1ccd3eb58e6c4db3b3bbb5db6ed7d6b6`; tegemist on järgneva dokumentatsioonikomitiga.
- Testitud runtime-kood: `951040777d9272e0660cbc319aabc83dd872cfad`. Server `/home/ubuntu/apps/sotsiaalai` oli puhas; frontend, RAG ja research-worker aktiivsed.
- Kaheksa in-app küsimust saadeti juba enne diagnoosi, 31.08 kell 11:12–11:24 EEST. Siin loeti olemasolevaid andmeid, mitte ei tekitatud uut jooksu.
- Täpne küsimus ja vastus seoti PostgreSQL-is `ChatTurn.userMessageId` / `assistantMessageId` kaudu vastavate `ConversationMessage` kirjetega. Autoriteetne jälg on vastuse `metadata.rag_trace`.
- Lugemine oli piiratud täpsete avalike testküsimuste ja ajatemplitega ning toimus read-only tehingutes. Arhiivi ei lisatud kasutaja-, vestluse- ega sõnumi-ID-sid, autentimisandmeid ega `body_preview` välju.
- Avalikust korpusest loeti olemasolevad dokumendilõigud GET-päringuga. See ei olnud uus semantiline otsing, ingest ega mudelipäring. Jälje tekstihashid seoti taastatud lõikudega; lihtsalt sama dokumendi leidmist ei loetud tõendiks.
- Puhas abifunktsioonide kordusarvutus kasutas olemasolevat muutmata koodi, salvestatud vastuseid ja avalikke allikakatkeid. See tõendab deterministlikke vigu, mitte parandatud live-vastust.
- M02 tagasilükatud mudelidrafti täistekst pole püsikirjes. Selle korrektsust ei saa tagantjärele väita. Säilinud on validaatori põhjus, puuduvad slotid ja lõplik keeldumine.

### Vastused ja jäljed

| Juhtum | Eraldi | Järjest | RAG-konteksti võrdlus |
|---|---|---|---|
| M01 | [PASS, täisvastus ja jälg](isolated-M01.json) | [PASS, täisvastus ja jälg](sequential-M01.json) | Sama 8071 märki; hash `0e623747…` |
| M02 | [FAIL, täisvastus ja jälg](isolated-M02.json) | [FAIL, täisvastus ja jälg](sequential-M02.json) | Sama 9465 märki; hash `c7902101…` |
| Integreeritud teenused | [PARTIAL, täisvastus ja jälg](isolated-integrated.json) | [PARTIAL, täisvastus ja jälg](sequential-integrated.json) | 6320 → 6051 märki; hashid `d457c923…` / `e587e7ff…` |
| Lapse heaolu | [PARTIAL, täisvastus ja jälg](isolated-child.json) | [PASS, täisvastus ja jälg](sequential-child.json) | Sama 13 394 märki; hash `b96c53cd…` |

Koond on endiselt **3 PASS / 3 PARTIAL / 2 FAIL**, nimetaja kaheksa vastuse-režiimi tulemust. See ei ole 75 küsimuse ega Golden37 täisvärav ega kogu RAG-süsteemi hinne. Täisvastuse autoriteetne kuju on JSON-i `answer` väljas; vahelogi varasemad lühendatud ümberjutustused asendati selle kirje tekstiga.

## 2. M02: vale tõendileping, liiga kitsas vastusekontroll ja taastamise puudumine

### 2.1. Mida runtime päriselt tegi

Mõlemal juhul tuvastati kõrge kindlusega õige EPIKoja uuring. Küsimuse neli soovitust säilisid planner'is ning kvalitatiivne kontroll käivitus: `enabled=true`, `checked=true`, `used_for_validation=true`. Seega varasem dispatch'i puudus ei selgita seda kordust.

Lõplik kvalitatiivne leping raporteerib `complete=true`, `mapped_slot_count=4`, `requested_slot_count=4`, kuid see on koodi arvutatud katvus, mitte tõend nelja õige soovituse olemasolust. Kõik kaheksa mudelile renderdatud tekstikeha ja neli lepingufragmenti taastati avalikust korpusest hash-täpselt.

| Slot | Küsitud sisu | Runtime'i fragment / nõutud tegevusperekonnad | Diagnoos |
|---|---|---|---|
| 1 | Kontaktisik või juhtumikorraldus | `b9ad0189…`; support, provide, support | Valitud pika kirjelduse pealkiri ja omadussõna muutuvad lisategevusteks. |
| 2 | Ennetav abi | `3426f277…`; provide | Mõlema tagasilükatud drafti valideerimisjälg seob selle sloti. |
| 3 | Teenustele pääs ja korduvate hindamiste vältimine | `fe73bc67…`; simplify, provide, avoid | Koordineeritud objektid lõhutakse valesti; kõrvaltingimus muutub kohustuslikuks. |
| 4 | Toetatud otsustamine | `d2ac64c1…`; support | Tegeliku mõiste asemel sobitatakse kontaktisiku tugi taotluste ja menetluste mõistmisel. |

Valideerimise lõpppõhjus on mõlemal `requested_fact_answer_incomplete`. Eraldi vastuses jäävad sidumata slotid **1, 3, 4** (10 vastuseühikut), järjestikvastuses **1, 3** (9 ühikut). Mõlema lõppvastus on sama 79-märgiline deterministlik keeldumine. Draftid ei olnud valideerimistulemuste järgi identsed, isegi kui lõpptekst oli.

### 2.2. Esimene sisuline lahknemine: „toetatud otsustamine” pole „abi otsuste mõistmisel”

Sloti 4 siduv lõik pärineb lk 50 kontaktisiku ülesannete loetelust. Selles esineb lähedaste toetamine taotluste, otsuste ja menetluste mõistmisel. Morfovariantide ja prefiksivõrdluse tõttu saavad nii `toetama` / `toetamine` kui ka `otsustamine` / `otsuste` vasteskoori 0,72. Kaks sõnalist vastet loetakse kahe mõistetingimuse täitmiseks, kuigi need ei tõenda küsitud toetatud otsustamise süsteemi arendamist.

Tegelik lk 53 ettepanek toetatud otsustamise süsteemi arendamiseks ei ole nendes kaheksas renderdatud tekstikehas. Vale `complete=true` jätab puuduva fakti taastamisotsingu käivitamata: `requested_fact_recovery_query_count=0`. Esialgsete 26 tekstikeha kogu koosseis pole jäljes säilinud; õige soovituse puudumist lõppkontekstist ei tohi esitada tõendina, et seda ei leitud üheski varasemas otsinguetapis.

Kolme päris allikalõigu eraldi prioriseerimiskontroll täpsustas valikuviga: lk 56 kokkuvõte (chunk 156) näib katvat slotte 1/2/3, lk 50 kontaktisikuloetelu (141) slotte 1/3/4 ning õige lk 53 soovitus (150) ainult sloti 4. Ahne katvusjärjestus annab `156 → 141 → 150`. Isegi õige soovituse lisamisel valib lõplik slot4-leping vale loetelu: mõlemad kandidaadid saavad skoori 12 ja varasem kandidaat võidab. Kood: `retrievalContextAssembler.js:2223` ja `:3317`. Seega ei piisa ainult rohkemate lõikude juurde toomisest; parandada tuleb ka mõistekohast sidumist ja valikut.

Kood: [factRelationSemantics.js](../../../../lib/chat/factRelationSemantics.js) read 18–33; [retrievalContextAssembler.js](../../../../lib/chat/retrievalContextAssembler.js) read 1773–1786, 2010–2110 ja 7358–7422. Seose kontroll arvestab termini olemasolu kandidaadis; mõiste koosseisu ja tegevuse–objekti tähendust see piisavalt ei säilita.

Puhas kontroll näitas ka vastupidist viga: kontaktisiku üldine tugi pealkirjaga „Toetatud otsustamine” läbib praeguse sloti, aga õige süsteemi arendamise soovitus ei läbi. Õige lk 53 tõendilepinguga sama vastus läbib. Vale konteksti korral ei peagi puuduva tõendiga väidet lubama: parandada tuleb esmalt tõendi valik. Seega pelk validaatori leevendamine ei paranda tulemust: praegune leping võib nii õiget tagasi lükata kui ka valet aktsepteerida.

Üheksa piiratud diagnostilise kordusarvutuse [sisendid](qualitative-replay.json) ning [mõõdetud väljund ja kordamise Node-kood](qualitative-replay-results.json) on salvestatud. Peaagent kordas neid muutmata abifunktsioonidega: kõik üheksa tulemust ja kasutatud fragmendihashid kattusid; see kinnitab kirjeldatud vigade reproduktsiooni, **mitte üheksat läbivat funktsionaalset testi**. Neljal juhul erineb praeguse koodi tulemus soovitud käitumisest. Sloti 4 õige vastuse/vale konteksti juhtumi ootus on eraldi `NOT_PROVEN_IN_CURRENT_RENDERED_CONTEXT`.

### 2.3. Kontaktisiku soovitusele lisatakse kõrvalisi kohustusi

Sloti 1 tegevussignatuur sisaldab `toetamise`, `pakutavates`, `toetaks`. Esimene võib pärineda pealkirjast ning `pakutavates toevõimalustes` on kirjeldus, mitte iseseisev soovitus midagi pakkuda. Prefiksireeglid annavad neile siiski tegevusperekonnad ja kõik sidumised muutuvad vastuses kohustuslikuks.

Samas lõppkontekstis olemasolev soovitus määrata üks püsiv kontaktisik kukub selle lepingu puhtas kontrollis läbi. Pikk valitud fragment sõnasõnalt läbib. Fragmentide järjestamisel annab iga lisategevus juurde skoori, mistõttu pikk mitme kõrvaltegevusega kirjeldus võib saada eelise täpse põhisoovituse ees.

Kood: [qualitativeActionSemantics.js](../../../../lib/chat/qualitativeActionSemantics.js) read 10–24 ja 39–61; [retrievalContextAssembler.js](../../../../lib/chat/retrievalContextAssembler.js) read 1945–1983 ja 2083–2109. EstNLTK tulemuse olemasolu ei muuda seda hilisemat prefiksipõhist parserit automaatselt tähendust mõistvaks.

### 2.4. Teenusele pääsu soovituses lõhutakse vale „ja”

Allika soovitus algab „Lihtsustada abi andmise ja teenustele jõudmise …” ning sisaldab hiljem `tagades`. `splitActionClause()` näeb mõlemal pool esimest „ja” tegevussõna, kontrollimata, kas parem koordinaat algab uue tegevusega. Tegelikult ühendab see „ja” siin objekte.

Tulemuseks jäävad `simplify` objektideks `abi`, `andmise`; teenusele jõudmine liigub hilisema `provide` tegevuse alla. Ka `tagades` kõrvaltingimust nõutakse, kuigi küsiti teenusele pääsu ja korduvate hindamiste kohta. Sisuliselt piisav lühivastus võib seetõttu ebaõnnestuda.

Puhas kontrast: „Abi andmist ja teenustele pääsu tuleb lihtsustada ning korduvaid hindamisi vältida” ei läbi. Ainult liigse `provide` sidumise eemaldamine mälus muudab sama vastuse läbivaks. See oli diagnoosikatse, mitte koodiparandus. Ilma „abi andmist” sõnadeta jääb alles eraldi vale objektisidumise viga.

Kood: [qualitativeActionSemantics.js](../../../../lib/chat/qualitativeActionSemantics.js) read 66–92; [retrievalContextAssembler.js](../../../../lib/chat/retrievalContextAssembler.js) read 1945–1983.

### 2.5. Õige vastus sõltub lubamatult lausestusest

`requestedAnswerUnits()` jaotab vastuse lauseteks. Seejärel peab üks selline ühik sisaldama kõiki sloti tegevuse–objekti sidumisi. Sama sisuga vastus läbis ühelauselisena, kuid ebaõnnestus kaheks lauseks jagatuna. Sama nummerdatud vastusepunkti seotud lauseid ei koondata sloti tõendiks.

Kood: [factContract.js](../../../../lib/chat/factContract.js) read 489–680. Parandus peab lubama sidusa vastusepunkti mitut lauset, kuid ei tohi lubada teise soovituse tegevusega esimese puuduvat tegevust katta.

### 2.6. Miks kogu vastus kaob

Pärast ebaõnnestunud kontrolli ei ole selle kvalitatiivse vea jaoks tõendiga seotud taastamisrada. Numbriline taastamine lubab vaid kindlaid count/proportion-vigu; `requested_fact_answer_incomplete` sinna ei kuulu. `resolveValidationRecovery()` valib deterministliku tõendipuuduse vastuse, sest kasutaja lisaküsimus ei lahendaks süsteemi sisemist valideerimisviga.

Jälg: `action=state_evidence_limit`, `trigger=fact_validation_failed`, `reply_source=deterministic_fallback`, `model_call_count=1`, lisamudelikõnesid ja parandushinte 0. Allikate peitmine pärast sisuta keeldumist on järgneva piiri ootuspärane käitumine, mitte siin esmane rike.

Kood: [factContract.js](../../../../lib/chat/factContract.js) read 4330–4402; [conversationalRecovery.js](../../../../lib/chat/conversationalRecovery.js) read 604–620; [mainResponseHandler.js](../../../../lib/chat/mainResponseHandler.js) read 3271–3297 ja 3411. `providerReply` on kohalik muutuja; salvestatakse juba keeldumisega asendatud tekst.

Õige järeldus pole „mudel vastas kindlasti õigesti ja kontroll kustutas kõik”. Õige järeldus on: tõendileping on mõõdetavalt vale, suudab õige vastuse tagasi lükata ning eksliku vastuse heaks kiita; päris tagasilükatud drafti sisu jääb teadmata.

## 3. Lapse heaolu: 64 väite piir peidab õige mudeliallika

Mõlemal režiimil on täpselt sama nelja allikaga RAG-kontekst: SKA käsiraamat, Helen Altoni 2024. aasta „Turvalisuse märgid”, Sirje Pindi 2016. ja Kadi Lauri 2017. aasta käsitlus. Seega otsing leidis mudeliallika mõlemal korral.

| Näitaja | Eraldi | Järjest |
|---|---:|---:|
| Täpse salvestatud vastuse pikkus | 5904 märki | 4568 märki |
| Parseri väiteid ilma 64 piirita | 74 | 60 |
| Nimetatud mudeli väite indeks (0-põhine) | 71 | 59 |
| Mudeli väide jõuab päris allikakontrolli | Ei | Jah |
| Helen Altoni allikas | Peidetud `claim_support_subsumed` | Kuvatud |

[sourceAttribution.js](../../../../lib/chat/sourceAttribution.js) read 639–660 sisaldavad endiselt `if (claims.length >= 64) break`. Eelmise parandusega eemaldati sisemise allikaindeksite kogumi 32-kirjeline kärbe, kuid vastuse enda 64-väiteline piir jäi alles. Pikk vastus ulatus uue tõendatud pinna piiridest välja.

Altoni allikas toetas eraldiseisvas jooksus parseri esimese 64 väite seas 18 üldist väidet. Kuna eristav mudeliväide puudus arvutusest, sai seda allikat pidada teistega kaetuks. Selle asemel säilis Kadi Lauri taustaallikas, millele omistati leksikaalset lisakatet. Järjestikvastuses jõudis mudeliväide indeksiga 59 kontrolli ja Altoni allikas säilis.

Jutumärkides mudelinime kontroll ise töötab, kui väide selleni jõuab. Mudelilõiku ei lisatud pärast allikate otsust: voogvastuse finaliseerija arvutab allikaseose lõplikust `accumulated` tekstist ja salvestab sama vastuse. Seega ei ole see hilise tekstilisamise ega UI-paneeli iseseisev renderdusviga.

Paranduse nõue on kogu lubatud vastuse katmine või ausalt tuvastatud piirang, mitte lihtsalt 64 muutmine uueks maagiliseks arvuks. Logi kärpimine võib olla eraldi piiratud; sisuline allikakate ei tohi sellest sõltuda.

## 4. Integreeritud teenused: kaks eri allikakatte viga

### 4.1. Eraldi vastus: Hiiumaa allikas lisatakse kahe üldsõna tõttu

Ainuüksi see, et vastus ei nimeta artikli pealkirja, ei tõenda allika üleliigsust. Siin kontrolliti lisaks päris renderdatud tekstiosa ja allikatoe arvutust.

Hiiumaa algse tekstikeha hash on `9f5e3537408ba94cc33f40e0f49028cfaf562d8914633b38989b3dcaa82d07d0`. Eraldiseisva vastuse 675-märgiline kärbitud tekst taastub täpselt hashiga `ef6c97a0480b075cbaf77e473d20fe77a5ed5daf3cc2c826e6552ee115e9ce72`.

Allikas saab ainulaadse toe väitele indeksiga 11: „Rõhk on sellel, et teenuseid ei korraldataks asutuste tööloogika, vaid inimese tegeliku vajaduse järgi.” Tegelikud kattuvad tokenid on üksnes `teenus` ja `inimese`: **2/11 = 18,18%**, 0 ühist bigrammi. `inimese` pärineb teenuse kasutajate arvu lausest, `teenus` järgmise lause arsti juurde sõitmisest. Need ei tõenda väites tehtud korralduspõhimõtte vastandust.

[sourceAttribution.js](../../../../lib/chat/sourceAttribution.js) read 713–728 loevad vähemalt viietähelise üldsõna „eristavaks” ning lubavad kahe sellise sõna ja 18% katvuse korral väitetoe. Järgnev minimaalse katte algoritm (read 874–913) säilitab allika, sest see näib katvat veel katmata väidet. Minimaalne katmine töötab oma sisendi suhtes, kuid sisend on semantiliselt valepositiivne.

Järjestikvastuses on Hiiumaa päriselt kasutatud näide: sama allika tegelik vastuseväide saab 16 ühist tokenit ja 6 bigrammi; allika säilitamine seal on õige. Allikat ei tohi lihtsalt musta nimekirja panna ega paneeli allikate arvu neljale piirata.

### 4.2. Järjestikvastus: 2026. aasta allikas oli olemas, kuid peideti

Järjestikvastuse lõpp seostab uuemad 2026. aasta käsitlused sotsiaal- ja tervishoiu lõimumise ning kohaliku omavalitsuse tööga. Jälg kinnitab kontekstis `sotsiaaltoo_eessona-2026-2` allikat. Taastatud renderdatud tekst on 536 märki, hash `650f1fe2df8cd8e19c51890100e35c3eff413ab660e75c003206d24edde78758`; selle aluskeha hash on `c1efa249c0fa15f62d2f01c0e399c970a09e44be67eb6ab8e5cbaf5164782d7e`.

Tekstikeha sisaldab nimetatud teemade seost. 2026 on selle allika metadata ilmumisaasta. Seega pole selle väite kohta põhjendatud öelda „mudel mõtles 2026 välja”. Viga on lõpliku väite ja nähtava allika seoses.

`replyClaims()` lõikab lause `2026.` järel pooleks. Väite indeksile 17 jääb aasta, indeksile 18 sisuline `aasta ajakirja teemakäsitlustes…` jätk ilma aastata. Vanemad allikad loetakse selle aastata teksti katteks; Eessõna toetab indekseid 12 ja 18 ning peidetakse `claim_support_subsumed` põhjusel.

Sama parser eemaldab rea algusest ka `\d+[.)]`, mis võib kustutada ilmumisaasta nagu loendinumbri. Parandus peab arvestama mõlemat kohta. Ainult lõhkumise korrastamisest ei piisa: praegune aastaarvu metadata-erand nõuab ajakirjaallika täpse pealkirja nimetamist. Küsitud süntees võib õigesti viidata ilmumisaastale ilma pealkirjata.

Vajalik on ilmumisaasta ja sündmusaasta eristamine: metadata `year=2026` koos sisulise tekstitoega võib toetada „2026. aasta käsitluse järgi”, kuid ei tõenda „teenus alustas 2026”. Seda piiri ei tohi asendada üldise aastaarvu lubamisega.

## 5. Miks järjest küsimine muutis integreeritud teenuste konteksti

Kõigi nelja küsimuse planner on režiimide vahel identne. Kõigil kaheksal `history_reference.explicit_source_anaphora=false` ja `carry_previous_source_filter=false`. Sellest hoolimata käivitub laia sünteesi jaoks teine ajaloorada:

1. [retrievalOrchestrator.js](../../../../lib/chat/retrievalOrchestrator.js) rida 716 kasutab `broadMultiSource || shouldUseRecentSourceAnchorsForRetrieval(message)`. Lai süntees ise lubab seega ajalooallika.
2. Read 720–735 lisavad varasema vastuse allikale filtreeritud lisaotsingu. Selles testajaloos on kasutatavaks allikaks M01 EPIKoja uuring; M02 keeldumine allikaid ei näita. Täpset lisaotsinguteksti trace ei salvesta, kuid valik järeldub koodist ja selle vestluse allikaloost.
3. Jäljes tõuseb `query_count` 1 → 2 ja filtritesse lisandub `document_id`. Põhiotsing leiab mõlemal korral 36 lõiku; lisaotsing leiab **0**. `max_query_hit_count=1`, ankurdunud kandidaate 0.
4. Ometi käivitub fusion (rida 1459) ning `hybrid_score` kirjutatakse ümber RRF-skooriks (rida 1311). Esimese kandidaadi skaala muutub umbes **0,4808 → 0,9836**, kuigi lisaotsing ei lisanud tõendeid.
5. Fikseeritud teema-/kvaliteedilisandite ja suhtelise `topScore * 0.55` lävendi mõju muutub ([ragContext.js](../../../../lib/chat/ragContext.js), read 1394–1398). Järjestikjooksus kvalifitseerub Eessõna skooriga 0,8007, lävend umbes 0,7775.
6. Konteksti valitakse 8 asemel 9 dokumenti. Kaheksa ühise dokumendi algsed tekstihashid on samad, kuid 7/8 renderdatud tekstihashist muutuvad eelarve ümberjaotamise tõttu. Renderdatud allikateksti summa väheneb 4147 → 3676 märgini; uus allikas saab sellest 536 märki.

See on tõendatud ajalooefekt otsingu koostamises ja tulemuste liitmises. Kõikide samas vestluses esitatud küsimuste automaatne käsitlemine sõltumatuna oleks samuti vale: ehtsad sama allika jätkuküsimused peavad ajaloo säilitama. Parandus peab ühildama selle otsuse juba olemasoleva semantilise ajaloo-piiriga.

M02 ja lapse heaolu puhul on lõppkontekst hash-täpselt sama. Nende nelja iseseisva sõnastuse korral ei lisa `shouldUseAnswerHistory()` ka mudelile vastuseajalugu ([route.js](../../../../app/api/chat/route.js), read 466–468; [retrievalOrchestrator.js](../../../../lib/chat/retrievalOrchestrator.js), rida 288). Lapse heaolu PASS-i ei saa seetõttu seletada sellega, et varasem vestlus õpetas mudelit paremini vastama. Mõlema vastuse pikkus ja genereeritud sõnastus erinesid; allikakatte pikkuseviga on eraldi deterministlikult tõendatud.

Ühest paarist ei saa hinnata kogu juhuslikku varieeruvust. Täielik mudeliprompt ega juhuslikkuse seeme ei ole neis artefaktides talletatud.

## 6. EstNLTK: mida see tõendab ja mida mitte

Kõigis kaheksas pärispäringus on `morphology.available=true`, analüsaator `estnltk-vabamorf-1.7.5-v2` ning tegelikud lemma- ja liitsõnatüvede massiivid. M02 näited on `teenustele → teenus`, `hindamiste → hindamine`, `otsustamise → otsustamine`. Seega ei järeldata morfoloogia tööd ainult health-kontrolli valmisolekust.

Morfoanalüüs toimub enne planeerimist; leksikaalseid kanaleid kasutavatel radadel liiguvad lemmad `lexicalTerms` kaudu tootmisotsingusse: [retrievalContextAssembler.js](../../../../lib/chat/retrievalContextAssembler.js) read 6031–6040, 6087–6089 ja 6137; [retrievalOrchestrator.js](../../../../lib/chat/retrievalOrchestrator.js) read 995–1007; [rag-service/main.py](../../../../rag-service/main.py) read 4267–4282.

Eraldi lemma-FTS indeks on siiski **shadow-only**: kõigil kaheksal `production_path_changed=false`. Selle kandidaatide arv ei tähenda, et kandidaadid jõudsid päris vastusekonteksti. Eraldiseisva jooksu `index_ready=false` koos `ASYNC_SHADOW_SCHEDULED` on asünkroonse kohatäite vaikeväärtus, mitte tõend katkisest indeksist (`main.py:3421`).

Integreeritud teenuste ajakirjasüntees on planner'i järgi ainult `dense`-otsing ([queryPlanner.js](../../../../lib/chat/queryPlanner.js), read 2184–2191). Morfoanalüüs tehakse, kuid leksikaalsed kanalid selle otsingu meenutuses ei osale. Seda arhitektuurivalikut ei diagnoosita praeguste PARTIAL-ide põhjuseks: allikapaneeli vead on näidatud renderdatud tekstide peal.

Oluline vahe: lemma aitab leida sama sõna eri vorme; ta ei otsusta iseenesest, kas „toetatud otsustamine” tähendab sama mis „toetamine otsuste mõistmisel”, ega tee hilisemat 64-väitelist parserit täielikuks. Nendes juhtumites pole tõendit, et korpuse uuesti ingest'imine või küsimuse käände käsitsi muutmine parandaks tuvastatud rikked.

## 7. Miks eelmised parandused ja rohelised sihttestid seda ei välistanud

- Kvalitatiivse validaatori dispatch on nüüd päriselt aktiivne. Alles nüüd ilmneb täisjooksus vale soovituslepingu rangus; paranduse olemasolu ja korrektne lõppvastus on eri tõendid.
- Kahe suhte-sõna nõue kõrvaldas osa ühe sõna valepositiive, kuid kaks prefiksivastet pole veel sama mõiste tõend. Tegelikud EstNLTK variandid ja pikk valitud fragment annavad uue valepositiivi.
- `partial-repair-contracts.test.mjs` kontrollib toetatud otsustamise õiget lühikest lk 53 ettepanekut eraldi ning kunstlikke suhtelausete näiteid. See ei kata päris nelja sloti, morfovariantide ja kõigi kaheksa konkureeriva tekstikeha kombinatsiooni.
- Allikakatte eelmine parandus eemaldas 32-indeksilise sisemise kärpe. Pika vastuse test kasutab 40 põhiväidet ja ühte erimeetodit; varasema runtime-vastuse kordusarvutus jäi samuti alla 64. Uus 74-väiteline vastus paljastas järgmise allesjäänud piiri.
- Nimelise mudeli guard takistab vale üldallikaga mudeliväite katmist ainult siis, kui parser selle väite üldse arvutusse võtab.
- Allikate minimaalse katte vähendamine ei paranda kehva väitetuge: kaks üldsõna võivad endiselt tekitada vale ainulaadse panuse.
- Tehnilised subset-invariandid (`displayed ⊆ selected`) võivad olla rohelised nii liigse kui ka puuduva allika korral. Need ei tõenda semantilist asjakohasust ega täielikku katet.

## 8. Põhjusepõhised parandused ja kitsad vastuvõtukriteeriumid

| Plokk | Vajalik muudatus | Positiivne ja negatiivne sihttõend |
|---|---|---|
| M02 tõendi mõiste ja põhisoovitus | Säilitada küsitud mõiste ning tegevuse–objekti seos; eristada põhisoovitust pealkirjast, omadussõnast ja kõrvalmõjust. Õige tõend puudub → katvus ei tohi olla complete. | Tegelik 4-slotiline / 8-tekstikehaga olukord märgib puuduvaks toetatud otsustamise; kontaktisiku abi ei asenda seda; õige dokumendisisene ettepanek täidab sloti. |
| M02 vastuse sidumine | Lubada sama vastusepunkti seotud lauseid; parandada koordineeritud objektide ja tegevuste eristamine. | Sama korrektne soovitus ühes või mitmes lauses läbib; vale objekt, vastupidine tegevus või teise sloti tegevus ei läbi. |
| M02 taastamine | Pärast õige tõendilepingu loomist vajadusel piiratud, tõendiga seotud parandusrada ja uuesti valideerimine. | Puuduv tõend käivitab sihitud dokumendisisese taastamise; parandamata või tõendita väide ei pääse läbi. Ei kasutata pimesi kordusgenereerimist ega automaatset PASS-i. |
| Täielik allikakate | Sisuline arvutus peab hõlmama kogu lubatud vastust; logi piirid eraldi. | Mudeliväide enne ja pärast 64. piiri säilitab sama õige allika; hiline dubleeriv allikas eemaldatakse endiselt. |
| Lokaalne väitetugi | Nõrk kahe üldsõna kattuvus ei tohi anda sisulise väite ainulaadset tuge. | Hajutatud Hiiumaa üldsõnad ei piisa; päris kohalik näide ja õiged võrdlusallikad säilivad. Lävendit ei tõsteta pimesi kõigile parafraasidele. |
| Aja ja väite sidumine | Säilitada aastaarv lause osana ja eristada ilmumisaastat sündmusaastast. | 2026. aasta käsitlus + õige metadata + sisuline tekst toetab väidet; sama metadata ei tõenda teenuse algusaastat. Rea algusaasta ei kao loendinumbri pähe. |
| Ajaloo piir ja tulemuste liitmine | Sõltumatu süntees ei päri allikaid; ühe sisulise tulemuskogumi juurde lisatud tühi päring ei muuda skoore/konteksti. | Iseseisev süntees samade põhitulemustega on ajaloo suhtes invariantne; ehtne „selle artikli” jätk ja kahe sisulise päringu liitmine töötavad edasi. |

Need on paranduse vastuvõtukriteeriumid, mitte juba teostatud või läbitud testid. Küsimusespetsiifilisi nimesid, aastaarve ega ette määratud allikate arvu ei tohi paranduse reegliks kirjutada.

## 9. Järelduste täpsustused ja järgmine piir

Varasema töölogi lause „see ei ole ajalookonteksti probleem” oli liiga üldine. M02 sama lõppkontekst välistab selles paaris otsingukonteksti erinevuse, kuid sama keeldumine üksi ei tõenda ajaloo puuduvat mõju. Integreeritud teenuste juures on ajaloo mõju nüüd otseselt tõendatud.

Samuti oli üksnes paneeli vaatamise põhjal Hiiumaa allika üleliigsus esialgne hinnang. Nüüd toetab seda hash-täpne väitetoearvutus. Vastupidises suunas täpsustus 2026 väide: allikas polnud otsingust puudu, vaid kadus paneeli valikus.

Diagnoos on tehtud; koodiparandus, commit, push, deploy ja uus runtime-kordus on selles tööplokis **not_run**. Dokumentatsioonimuudatustele ei käivitatud formaalset testisviiti ega build'i. Pärast omaniku parandamiskorraldust tuleb teha ülaltoodud kitsad põhjusparandused ning alles seejärel korrata samu küsimusi in-app eraldi ja järjest, salvestades vastused ja jäljed jooksvalt. Pärast teist faasi jääb paus.
