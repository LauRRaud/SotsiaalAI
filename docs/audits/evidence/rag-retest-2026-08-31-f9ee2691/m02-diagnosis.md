# M02 uue ebaõnnestumise kohene diagnoos — 31.08.2026

## Järeldus

Õige dokument ja morfoanalüüs on olemas, kuid süsteem ehitab soovituse kontrolllepingu valede tekstifragmentide peale. Probleemikirjeldus muutub liiga laia tegevussõna sobituse tõttu soovituseks. Uus lühema fragmendi eelistus ei lahendanud seda eristust ja tõstis sellised katked päris soovituste ette. Vastusekontrolli läbikukkumine kustutab seejärel kõik neli vastuseosa.

See on puudulikuks jäänud parandus, mitte tõend EstNLTK puudumise, vale kasutajakäände, serverisse jõudmata koodi või kadunud dokumendi kohta.

## Mõõdetud runtime

- Rakenduskood `f9ee2691`, serveri ja GitHubi HEAD `9acf8096`.
- [Paaristatud küsimus, täisvastus ja trace](isolated-M02.json); küsimus esitati Codexi in-app aknas uues vestluses, varasemaid kasutajapöördeid 0.
- Õige EPIKoja dokument on valitud kõrge kindlusega; EstNLTK `available=true`.
- Otsingu 26 tekstikeha katvus arvatakse olevat 4/4; taastamispäringuid on endiselt 0.
- Lõppkontekstis 8 tekstikeha. Kõik neli kvalitatiivset sloti märgitakse tõendiga kaetuks.
- Vastuse kontroll kinnitab slotid 1, 3 ja 4, kuid jätab puudu sloti 2; põhjus `requested_fact_answer_incomplete`.
- Nähtav vastus on üldine keeldumine, allikanuppu pole. Hinnang FAIL.

**Oluline piir:** validaatori kolme sloti läbimine ei tähenda, et kolm sisulist soovitust olid kindlasti õiged. Juba lepingu slotid 3 ja 4 on allpool näidatud viisil probleemsed.

## 1. Esimene sisuline lahknemine: probleemist saab soovitus

Avaliku dokumendi olemasolevad lõigud loeti dokumendi GET-lõpp-punktist. See ei olnud uus RAG-otsing, embedding ega mudelipäring. Kolme valitud fragmendi tekstid vastavad täpselt runtime'i `evidence_fragment_hash` väärtustele; peaagent kordas nende hash- ja tegevussignatuuri arvutuse muutmata koodiga. [Tõend ja käivitatav kordusarvutus](m02-failure-analysis.json).

| Slot | Fragmenteerimise sisuline viga | Parseri tegelik tulemus |
|---|---|---|
| 2: ennetav abi | Lõik kirjeldab, et abi tegeleb pigem tagajärgedega kui ennetamisega; see pole soovitus abi korralduse muutmiseks. | Sõna `tagajärgedega` muutub tegevuseks `provide/enable`. |
| 3: teenustele pääs ja korduvad hindamised | Lõik kirjeldab koostöö puudumist ning dubleerivate hindamiste koormavat mõju. | Fraasis `suurendavad koormust` loetakse verb `improve/enable` tegevuseks. |
| 4: toetatud otsustamine | Valitakse teenuse võimalikku vajalikkust ja eestkoste säilitamist käsitlev tingimuslik arutelu, mitte konkreetne ettepanek arendada toetatud otsustamise lahendusi. | Sõna `vajalik` annab `positive_state/enable` signatuuri. |

Koodis [qualitativeActionSemantics.js](../../../../lib/chat/qualitativeActionSemantics.js) on `provide` tüvemuster `taga(?!tud)`: see sobib ka sõnaga `tagajärgedega`, sest see algab samuti `taga`. See ei ole selle nimisõna tegelik morfoloogiline tõlgendus. Sama faili `improve` muster sisaldab `suurenda`, kuid ei erista, kas suureneb võimekus või hoopis koormus. `vajalik` loetakse positiivseks seisundiks ka siis, kui puudub täpne küsitud ettepanek.

Seega ei piisa sellest, et kasutaja küsimus läbib EstNLTK. Tõendifragmendi tegevuse tuvastamise kiht teeb endiselt eraldi ja liiga laia regulaaravaldisepõhist oletust.

## 2. Miks minu parandus selle vahele jättis

[retrievalContextAssembler.js](../../../../lib/chat/retrievalContextAssembler.js) hindab soovitusfragmenti seosesõnade arvu ja tegevusobjekti olemasolu järgi. Uus kood eemaldas kõrvaliste tegevuste arvust saadava lisaskoori ning eelistab võrdse skooriga fragmentidest lühemat. See lahendas ühe vana riski, kuid **lühidus ei tõenda soovituse rolli**.

Kui probleemikirjeldus saab juba eksliku tegevussignatuuri, võib ta uue asetuse järgi võita päris ettepanekut. Valitud fragment muutub seejärel nii genereerimise juhiseks kui ka vastuse hindamise lepinguks. Täieliku katvuse lipp takistab täiendava tõendi taastamist.

Sihttestid kasutasid nelja diagnoositud katkendit ja üht õiget toetatud otsustamise ettepanekut. Need ei sisaldanud sama jooksu täielikku konkureerivate fragmentide valikut. Seetõttu läbis kood kontrolli, kuid katvus oli kitsam kui paranduse runtime-lubadus. Vajalik sihttest peab algama päris konkureerivatest tõenditest ja kontrollima ka võitnud fragmendi tähendust, mitte üksnes etteantud fragmendi vastuse valideerimist.

Täiendav peaagendi kordusarvutus taastas kõik kaheksa tekstikeha ja kõik neli lepingufragmenti hash-täpselt. [Iseseisev tõendiarhiiv koos kordamiskoodiga](m02-diagnostic-replay.json) ei sõltu ajutistest failidest. Ennetava abi vale fragment saab õige ettepanekuga sama skoori 12, kuid on 84 märki pika 164 asemel; teenuste osa vale fragment saab sama skoori 17, kuid on 148 märki pika 212 asemel. Toetatud otsustamise arutelu saab õige ettepanekuga sama skoori 12, kuid on 97 märki pika 187 asemel. Isegi õige viimase ettepaneku lisamine ei muuda võitjat: lühike ebasobiv arutelu valitakse ikka.

Viis piiratud kunstliku vastuse kordusarvutust tõendavad kontrolli riski, mitte tegeliku provider-mustandi sisu:

- Sisuliselt korrektne ennetava abi muutmise parafraas ei läbi valest fragmendist ehitatud lepingut, kuid läbib õigest ettepanekust ehitatud lepingu.
- Ennetava abi pakkumise parafraas läbib mõlemad.
- Ekslik tagajärgedega tegelemise võrdsustamine ennetava abiga läbib mõlemad: ainult parema fragmendi valimisest ei piisa, ka vigane tegevusetuvastus tuleb sulgeda.
- Teenustele pääsu lihtsustamine ilma korduvate hindamiste vältimiseta läbib praeguse vale lepingu, kuid mitte õiget kahe tegevuse lepingut.
- Toetatud otsustamise lahenduste arendamise korrektne soovitus ei läbi tingimusliku arutelu lepingut, kuid läbib tegeliku ettepaneku lepingu.

## 3. Miks kasutajale jäi ainult keeldumine

[FactContract](../../../../lib/chat/factContract.js) kontrollib kogu kvalitatiivlepingut. Kui üks slot ei leia sobivat vastuseüksust, tagastab kontroll kohe `requestedFactCoverageFailureReply`.

Selles jooksus jäi kinnitamata ainult ennetava abi slot. [MainResponseHandler](../../../../lib/chat/mainResponseHandler.js) asendab genereeritud puhvri selle tagavaravastusega enne kasutajale saatmist ja püsikirjesse salvestamist. [ConversationalRecovery](../../../../lib/chat/conversationalRecovery.js) jätab deterministliku tõendipuuduse vastuse jõusse. Numbriliste väidete taastamisrada ei taasta seda kvalitatiivset juhtumit.

Seetõttu kadusid ka kontrolli läbinud osad ning allikapaneel jäi tühjaks. Turvakontrolli eemaldamine ei oleks õige parandus: kontrolli alus ise peab enne olema sisuliselt korrektne.

## 4. Mida sellest konkreetsest keeldumisest ei saa tagantjärele tõendada

Tagasilükatud provider-mustandit ei säilitata `ConversationMessage.content` väljas; seal on juba keeldumine. Trace ei salvesta puuduva sloti iga alavärava tulemust ega selle lauset. Kasutuslogi salvestab mahu ja staatuse, mitte vastuse teksti ega taastatavat provider-vastuse ID-d.

Seega on **tõendatud vale tõendifragment, vale tegevuse tuvastus ja keeldumiseni viiv kooditee**. Ei ole tõendatud, milline täpne ennetava abi sõnastus mustandis oli või kas selle vahetu tagasilükkaja oli tegevusklass, objektiseos, eitus või mõni muu alavärav. Näiteks `provide` ja `change` parafraaside erinev kohtlemine on võimalik lisarisk, mitte selle mustandi kinnitatud põhjus.

## 5. Järgmise paranduse piir

1. Erista tõendist autori soovitus, olukorra kirjeldus ja intervjueeritava arvamus. Kasuta allika lõigu rolli ja päris predikaadi–objekti seost; pelk `taga*`, `suurenda*` või `vajalik` ei piisa.
2. Vali iga küsitud suhte jaoks sisuliselt sobiv ettepanek, mitte lühim sõnaliselt kattuv lause. Kui sellist ettepanekut kontekstis pole, jäta katvus puudulikuks ja luba sihitud tõenditaastamist.
3. Kontrolli sama mitmeosalist sisu lubatud parafraasides, säilitades eitus- ja objektipiirid.
4. Lisa ainult vajalik konkurentsiga regressioon: tegelikud selle jooksu lõigud, õige autori ettepanek ja samad neli sloti. Välista probleemilause soovitusena läbimine.
5. Puuduliku sloti korral vajab kvalitatiivne rada tõendiga seotud osalist taastamist või selget puuduva osa vastust; kasutaja küsimust ei saa ravida üldise keeldumise või pimesi kordusgenereerimisega.
6. Diagnoosijälg peaks säilitama puuduva sloti alaväravate põhjused tekstivabalt. Avaliku auditiküsimuse mustandi piiratud talletamine oleks eraldi teadlik arendusotsus, mitte kõigi kasutajavastuste vaikimisi logimine.

## Töö piir

Uusi küsimusi pärast omaniku kohest diagnoosikorraldust ei esitatud. Juba saadetud integreeritud teenuste vastus säilitati ja hinnati eraldi: PASS. Senine jooks on 3/8: M01 PASS, M02 FAIL, integreeritud teenused PASS; lapse heaolu ning kogu sequential-faas on alustamata. Käesolevas diagnoosis ei muudetud rakenduskoodi, serverit, korpust ega indekseid. Kõik tulemused on [Luna vahelogis](../../../../eval/luna-retest-progress.md).
