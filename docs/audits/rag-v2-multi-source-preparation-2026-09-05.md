# RAG v2 M2 mitme allika järelkatse audit

Kontrollipäev: 05.09.2026. Aktiivset tööd juhib [SotsiaalAI.md S1.0](../platvormi%20arendus/SotsiaalAI.md). Hindamisotsused on [ADR-004-s](../rag-v2/adr-004-multi-source-evaluation.md).

## Seis

Mitme allika järelkatse on kokkulepitud ulatuses **lõpetatud**. Omanik kinnitas täpse manifesti, kuni 73 uut katset, 23 554 tokenit ja 0,01 USD piiri. Kõik 73 `text-embedding-3-large` katset õnnestusid esimesel saatmisel; tulemuste nelja raja audit valmis. Luna ja muid genereerivaid kutseid oli 0.

Käituskood valmis commit'idel `51921fe98`, `8c3227ffc`, `63fa0b731` ja kululegeri järelparandus `7d1e1fd5d`. Pärisjooksu esimene muutumatu raport sündis serveri SHA-l `a8abe03fd`; pärast ledger'i parandust kordas SHA `7d1e1fd5d` sama tulemust 0 uue API-kutsega.

## Korpus

Valim koosneb kaheksast omaniku tööruumis olnud päris-PDF-ist. Ühe artikli eri koopiaid ei loetud eri allikateks. Sotsiaaltöö 2/2025 sama numbri teist artiklit materjalijuures polnud; valim sisaldab identiteedi eristamiseks Sotsiaaltöö 2/2026 artiklit, kuid see ei tõenda sama numbri katvust.

| Allikas | Roll | Lehti | Tekstiosi | Paigutuse piir |
| --- | --- | ---: | ---: | --- |
| „Tehisintellekt sotsiaaltöös” | senine alusartikkel ja lähiteema | 13 | 16 | M2.2-s üle vaadatud; viidete loend pole algfailis nähtav |
| „AI sotsiaaltöös” osalejapakett | lähiteema siht ja eksitaja | 13 | 20 | märkeruudu glüüfid vajasid NUL-asendust |
| ESTA andmekaitse ja eetiliste valikute teemapäev | eetika/andmekaitse siht ja eksitaja | 3 | 3 | veebitrüki jaluse ning poolitatud linkide müra |
| „Kas oleme valmis … töötajate turvalisusest” | ajakirjaartikkel ja tööheaolu siht | 6 | 15 | artikkel, kommentaar ja ilmumisjalus on ühes failis |
| Hooldustöötajate eetika ja enesehoid | eetika/enesehoiu siht ja eksitaja | 2 | 2 | veebitrüki jaluse müra |
| Tehnopoli heaolutehnoloogia programm | konkureeriv programmiallikas, rahastustingimused | 5 | 6 | külgriba tekst võib lugemisjärjekorda seguneda |
| EKA heaolutehnoloogia programmi käivitus | konkureeriv programmiallikas, EKA roll | 9 | 4 | korduv kõrvalteema/jalus; neid spane ei kasutata ankrutena |
| Haigla sotsiaaltöö teemapäev | kõrvalteema ja patsienditee siht | 2 | 3 | veebitrüki jaluse müra |

Kanooniline privaatne [korpusemanifest](../../tmp/rag-v2-multi-source/server-real-9526a805-1/corpus-manifest.json) sisaldab iga algfaili ja metadata räsi, dokumendi/versiooni identiteeti, rolli, õigusi, parseri hoiatusi ja allikakohtade mahtu. Kõik dokumendid on ainult `local_private` / `development_only` kasutuses.

## Hindamisleping

Uus kogum sisaldab 15 sisuliselt erinevat küsimuseperekonda ja 21 küsimust. Kuus perekonda on arendusosas ja üheksa puutumatus kontrollosas; otsustuspiiri, töötajavägivalla määra ja rahastustingimuste perekondadel on ET/EN/RU variandid. Sama perekonna tõlked jäävad samale poolele. Eraldi säilib üheksa küsimusega M2.2 regressioon.

Juhtumid katavad täpse termini ja vaba sõnastuse, lähiteema vale allika, mitu vajalikku tekstikohta, kahte dokumenti vajava küsimuse, osalise toe, korpuses puuduva toe ning bibliograafia. Oodatud dokumendid, lehed, spanid ja vastatavuse sildid lahendatakse hindajas enne päringut; otsingule antakse ainult küsimuse tekst, keel, ühine poliitika ja meetodi samad eelarved.

Kõik neli rada kasutavad top-1/3/5 mõõtmist, viie ühiku lõpppiiri ja 6000-tokenist kompaktset konteksti. Raport näitab toorkandidaatide ning lõppkonteksti ankrurühmad, valitud allikad, top-5 eksitajad, struktuuri lisatud ja välja jäänud üksused, tegelikud kontekstitokenid ja etappide kestused. `required_evidence_absent_by_dataset` jääb hindaja teadmiseks, mitte runtime'i keeldumisvõimeks.

## Artefaktide päritolu järelkontroll

Serveri esialgne `pilot-report.html` säilis muutmata SHA-256 räsiga `3db25b679873801ea33e80a4cd526ac2ff56c577a4b508f5f781522c6f4aa616`. Sama räsi kontrolliti kohaliku ajaloolise koopia ja serverifaili vahel.

Praegusest koodist genereeritud [versiooniline piloodiraport](../../tmp/rag-v2-m2-2/verifications/post-fix-63fa0b731/pilot-report.html) kasutab 25 varem salvestatud vektorit ning tegi 0 API-katset. Run ID on `evaluation_run_6f0cebf821594af4c875a2c86aecd1e83bd7c08c86439d1eea51bc9ea94a4307`; Git SHA on `63fa0b731bda134ad38244b7068bdc8253fcab95`. Üldine tracked-tööpuu oli omaniku muu kustutuse tõttu dirty, kuid RAG v2 scope oli clean. Kõigi 34 mittetühja meetodirea 102 kontrollitud `authority` / `historical` / `source_status` välja kandsid väärtust, päritolu ja `review_state` olekut; vigaseid välju oli 0.

## Mehaanikakontroll ja leitud viga

Esimene päris teenustega mock-jooks leidis enne hindamist PostgreSQL-i vea `22P05`: osalejapaketi märkeruudu glüüf sisaldas PDF-i tekstikihis NUL-koodipunkti. Parser asendab nüüd NUL-i enne püsistamist nähtava `U+FFFD` märgiga, märgib span'i transformatsiooni ja `pdf_nul_replaced` hoiatuse ning ei säilita kasutamata tooreid parseri item'e bundle'is. Metadata stringides on NUL keelatud.

Paranduse järel indekseeriti kaheksa dokumenti 69 üksusena. [Lõplik kohalik mock-mehaanikaraport](../../tmp/rag-v2-multi-source/final-63fa0b731/multi-source-v1-mechanics-report.html) sisaldab uue kogumi 84 meetodirida ja regressiooniraport 36 rida: kokku 120 rida, tehnilisi vigu 0. Sama 120-realine mehaanika läbis serveris commit'il `86517b2ab` samuti 0 tehnilise veaga ning andis sama manifesti räsi. `semantic_claim=NOT_PROVEN_test_mechanics_only`; mock-ridade sisulisi tabamusi ei kasutata pärisotsingu kvaliteediväitena. Mõlema jooksu mock-tenant ja Qdranti kollektsioon eemaldati pärast raportit, põhitenant jäi pärisvektori aktiivsele põlvkonnale.

## Väljasaatmine ja kulu

| Näitaja | Plaan | Tegelik |
| --- | ---: | ---: |
| Dokumendid | 8 | 8 |
| Uued perekonnad / küsimused | 15 / 21 | 15 / 21 |
| Eraldi regressiooniküsimused | 9 | 9 |
| Unikaalsed dokumendi- ja küsimusesisendid | 98 | 98 |
| Kontrollitud vanast ledger'ist taaskasutatavad sisendid | 25 / 12 420 tokenit | 25 / 12 420 tokenit |
| Uut embedding'ut vajavad sisendid | 73 / kuni 23 554 tokenit | 73 / 23 554 tokenit |
| Uued API-katsed | kuni 73 | 73 edukat / 0 teadmata / 0 ebaõnnestunud |
| Korduskatsed | 0 | 0 |
| Genereerivad ja Luna kutsed | 0 | 0 |
| Arvestuslik uus kulu hinnaga 0,13 USD / miljon tokenit | kuni 0,003062020 USD | 0,003062020 USD |

Muutumatu egress-manifesti SHA-256 on `9526a80539a84e497226e48575ef1828f979c24dd3fcc41876c4909025e40592`. Manifest ei sisalda algteksti, ankruid ega vastatavuse silte; ta seob kaheksa allika räsid, 73 uue sisendi räsid/tokenid ja 25 taaskasutuskviitungit varasema manifesti, ledger'i ning vektorikirjete räsidega. [Evaluation plan](../../tmp/rag-v2-multi-source/server-real-9526a805-1/evaluation-plan.json), [egress-manifest](../../tmp/rag-v2-multi-source/server-real-9526a805-1/egress-manifest.json) ja [masinloetav jooks](../../tmp/rag-v2-multi-source/server-real-fixed-ledger-verify/run.json) on privaatsed.

0,003062020 USD on valideeritud provider usage'i ja lukustatud hinnakirje põhine arvutus, mitte arve. Püsilegeri 73 kirjet seovad iga katse sisendiräsi, reserveeritud tokenid/kulu, tegeliku usage'i, vektorifaili räsi ja request ID. Kõik piirid jäid omaniku kinnitatud 0,01 USD sisse.

## Pärisotsingu tulemus

Allolev põhitabel arvestab 18 täielikult vastatavat sisuküsimust. Bibliograafia, üks osalise toe juhtum ja üks korpuses vastuseta juhtum on eraldi allpool. „Perekonnad” loeb ET/EN/RU tõlked üheks sisuliseks perekonnaks ja nõuab, et sama perekonna kõik variandid õnnestuksid.

| Meetod | Top-1 | Top-3 | Top-5 | Kõik vajalik lõppkontekstis | Perekonnad | Keskmine kontekst | Valimi mediaankestus |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| PostgreSQL `simple` | 6/18 | 7/18 | 7/18 | 7/18 | 4/12 | 4516 tokenit | 435 ms |
| Pärisvektor | 9/18 | 13/18 | 15/18 | **15/18** | **9/12** | 3943 tokenit | 383 ms |
| Hübriid RRF | 7/18 | 10/18 | 13/18 | 13/18 | 7/12 | 4606 tokenit | 434 ms |
| Hübriid + struktuur | 7/18 | 10/18 | 13/18 seemnetes | 11/18 | 6/12 | 4022 tokenit | 413 ms |

Need kestused on 21 järjestikuse väikese serverijuhtumi valimi mediaanid, mitte tootmise p95 ega koormustõend. Täieliku toe juhtumitest sisaldas lõppkontekst vähemalt üht hindaja järgi mittevajalikku allikat leksikaalses rajas 15/18, vektoris 10/18, hübriidis 13/18 ja struktuurirajas 11/18. „Mittevajalik” tähendab selle ankrulepingu suhtes kõrvalist, mitte automaatselt sisuliselt valet allikat.

Arendusosas sai vektor ja hübriid mõlemad vajaliku toe 10/11 juhtumis; struktuur 9/11 ja leksikaalne rada 4/11. Esimest korda avatud kontrollosas oli tulemus vektoril 5/7, hübriidil 3/7, leksikaalsel 3/7 ja struktuuril 2/7. See vahe näitab, et ühe artikli põhjal valitud hübriidjärjestus ei üldistunud uutele perekondadele sama hästi kui puhas vektorirada.

Keele kaupa leidis vektor vajaliku toe ET 9/12, EN 3/3 ja RU 3/3; hübriid vastavalt 7/12, 3/3 ja 3/3. Struktuur kaotas EN- ja RU-rahastusküsimustes top-5-s olemas olnud tõendi ning jäi 2/3 peale. Leksikaalne rada sai ET 6/12, EN 1/3 ja RU 0/3.

### Algse M2.2 regressioon mitme dokumendi seas

| Meetod | Kuus sisuküsimust lõppkontekstis | Top-1 | Top-3 | Autor |
| --- | ---: | ---: | ---: | --- |
| Leksikaalne | 4/6 | 2/6 | 3/6 | lahendatud |
| Pärisvektor | 6/6 | 3/6 | 5/6 | lahendatud |
| Hübriid RRF | 6/6 | 4/6 | 6/6 | lahendatud |
| Hübriid + struktuur | 6/6 | 4/6 | 6/6 | lahendatud |

Algse ühe artikli piloodi hübriidne top-1 oli 6/6. Kaheksa dokumendi seas langes sama näitaja 4/6-ni: dokumenteerimise ET- ja EN-küsimuses tuli esimeseks sama teema osalejapakett, kuid õige artikkel oli vastavalt teisel ja kolmandal kohal. Kõik vajalik säilis top-3-s ja lõppkontekstis. See on konkureerivate allikate tegelik järjestusmõju, mida esimene piloot ei saanud näidata.

Bibliograafiaküsimus lahendas Aljona Kõpu kõigis neljas rajas. Osalise toe juhtumis leidsid vektor, hübriid ja struktuur korpuses olevad projektide arvu ning teemade ankrud, kuid korpus ei sisalda mõõdetud tulemusi. Korpuses vastuseta KOV-i omaosaluse/tähtaja küsimus tagastas kõigis radades kandidaate ja viis lõppühikut; see kinnitab, et runtime'i piisavus- või keeldumisotsustajat endiselt pole.

## Puudujääkide liigitus

| Juhtum | Liik | Tõend |
| --- | --- | --- |
| Andmeminimeerimine ja välissaatmise õigus | järjestus / valik | Mõlemad õiged ankrud olid hübriidis alles alates 7. kohast; struktuurne naabrus taastas need lõppkonteksti. |
| Intsidendijärgne tegevus | konteksti valik / struktuuri kahju | Hübriidi õige tervik oli 5. kohal ja lõppkontekstis olemas; kolm seemet + kaks naabrit tõrjusid selle välja. |
| Inimsuhete piir ja arendustingimused | fusioon / mitu vajalikku kohta | Vektor leidis mõlemad top-5-s; hübriid säilitas ainult inimsuhete ankru ja kaotas 12. lehe arendustingimuse. |
| Kolleegidega eetika arutamine | konkureeriv vale allikas / järjestus | Leksikaalne rada leidis õige ESTA teemapäeva esimesena; vektor ja hübriid eelistasid töötajate turvalisuse artiklit, õige ankur oli hübriidis 7. kohal. |
| Tööandja riskijuhtimine ja järeltoe kohustus | järjestus / mitme koha valik | Kõik meetodid valisid valdavalt õige artikli muud lõigud, kuid nõutud 5. lehe ankrud algasid hübriidis 8. ja vektoris 9. kohal. |
| EN/RU rahastustingimused | struktuuri kahju | Vektor leidis mõlemad ankrud top-1-s ja hübriid top-5-s; struktuur asendas 5. seemne naabritega ning kaotas tõendi. |
| Kahe programmi-allika rollid | fusioon / dokumendidiversiteet | Vektor leidis Tehnopoli teostajad ja EKA rolli top-5-s; hübriid täitis viis kohta peamiselt EKA ja AI-artikli tekstiga ning Tehnopoli ankru ei toonud. |

Ankrud lahendusid enne jooksu alg-PDF-ides vigadeta. Täieliku toe juhtumites polnud puuduvaid algallikaid. Parseri NUL-viga parandati enne pärisjooksu; veebitrüki paigutusmüra jäi korpuse piiranguks, kuid ükski hindamisankur ei kasutanud teadaolevat jaluse/külgriba müra.

Struktuurilaiendus lisas kõigis 21 reas kokku 42 naaberüksust. Võrreldes hübriidiga parandas ta ühe juhtumi, halvendas kolme ja jättis 17 muutmata. Seetõttu ei ole alust struktuurilaiendust M4 vaikimisi sisse lülitada. Väiksem keskmine kontekst ei korva tõendikadu.

## Kululegeri järelparandus

Esimese pärisjooksu audit avastas, et uus CLI oli sidunud ledger'i `--output` raportikaustaga. Uus raportikaust oleks saanud sama approval'i katsed uuesti reserveerida. Esimene jooks ise jäi 73 katse ja 0,003062020 USD sisse ning kordust enne parandust ei tehtud.

Commit `7d1e1fd5d` fikseeris pärisjooksu ledger'i juure `tmp/rag-v2-multi-source/usage` alla sõltumatult raportikaustast. Olemasoleva 73 vektori ledger kontrolliti ja viidi samasse manifestipõhisesse püsijuure. Serveri uus täisraport kasutas 69/69 indeksiüksust vahemälust, tegi `api_attempts_this_run=0` ning andis esimese jooksuga sama otsuste/rankingute projektsiooni SHA-256 `2dd449cc55d25ff840beb29bd919d77b4120fc18eddf9687305f4c7fff4c4033`. Lõplik [pärisraport](../../tmp/rag-v2-multi-source/server-real-fixed-ledger-verify/multi-source-v1-report.html) on run ID-ga `evaluation_run_f4a75400a22afcc63495e9228cf74744546df0cf14ff84139881f1ec95c08e0d`, Git SHA `7d1e1fd5d3d9176493bd550ea70116b4a4ff1108` ning clean tracked/RAG-scope seisuga.

## Kontrollid ja järgmine otsus

- RAG-i lõplik sihtkomplekt: 61 testi läbitud, 0 ebaõnnestunud, 0 skip'i; ledger'i paranduse 15-testine sihtkomplekt läbis samuti.
- Muudetud koodi lint, `git diff --check`, i18n-kontroll ja iga lõpliku muutumatu koodipuu tootmisbuild läbisid.
- Päris PostgreSQL/Qdrant mehaanika kohalikult ja serveris: kummaski 120 meetodirida, 0 tehnilist viga, 0 väliskutset; testseis eemaldati.
- Pärisembedding'u jooks: 73/73 uut katset, 0 teadmata/ebaõnnestunud, 23 554 tegelikku tokenit, 0,003062020 USD; kordus pärast ledger'i parandust 0 kutset.

Järgmise valikumuudatuse eeltingimus on allolev kitsas M2.3 diagnoos. V1 kontrolltulemus säilib muutumatuna; selle ankrumõõdikut ei tõlgendata üldise semantilise kvaliteedina. Luna, M3 runtime, HTTP-autentimine ja avalik API jäävad suletuks.

## M2.3 kitsas diagnoos pärast koodiülevaatust

Kontrollitud lähte-SHA: `aa2b120721f066233c4d77770dcd49fd9a0713a0`. Aluseks olid esimese pärisjooksu salvestatud tulemused, täpsed küsimused, ankrud ja manifestiga kontrollitud kohaliku korpuse versioonid. Tulemuse payload-räsi vastas provenance'ile; kõik 84 RRF-järjestust arvutati salvestatud kanalitest uuesti ja kattusid; kõik 405 valitud tõendi teksti, span-loendit ja lehekülge kattusid kanoonilise chunk'iga. PDF-e selles diagnoosis uuesti visuaalselt ei kontrollitud. Uusi otsingu- ega mudelikutseid, järjestuse häälestamist või v1 märgendite muutmist ei tehtud.

### Tegelikud kanalijärgud

Tabel nimetab nõutud ankrut sisaldava üksuse koha. Kriips tähendab puudumist vastava kanali tagastatud kandidaatides. Kõik siin nimetatud ankrud olid hübriidi toorkandidaatides olemas.

| Juhtum ja vajalik lõik | Leksikaalne | Vektor | Hübriid | Kinnitatud mehhanism |
| --- | ---: | ---: | ---: | --- |
| Andmeminimeerimine, osalejapakett lk 7 | 19 | 7 | 7 | Üksus jääb mõlemas kanalis top-5-st välja; pelk vektorile üleminek ei lahenda seda juhtumit. |
| Intsidendijärgne tegevus, osalejapakett lk 11 | 32 | 1 | 5 | Fusioon langetab vajaliku vektoriesikoha viiendaks; struktuurirada jätab selle `seed_limit` tõttu välja. |
| Arendustingimused, AI-artikkel lk 12–13 | 22 | 4 | 10 | Mõlemas kanalis esineva üksuse nõrk leksikaalne järk langetab vajaliku vektorileiu top-5-st välja. |
| Kolleegidega eetika arutelu, ESTA lk 1–2 | 1 | 17 | 7 | Siin langetab fusioon leksikaalse esikoha; tugevam vektorikaal ei ole üldine lahendus. |
| Tööandja vastutuse v1 ankrud, artikkel lk 5 | 20 | 9 | 8 | Ankrud jäävad välja, aga sama artikli lk 4 sisuline alternatiiv on hübriidkontekstis olemas; vt allpool. |
| Rahastustingimused EN, Tehnopol lk 2 | 8 | 1 | 5 | Fusioon langetab vektoriesikoha viiendaks, seejärel jätab struktuur selle välja. |
| Rahastustingimused RU, Tehnopol lk 2 | — | 1 | 5 | Neli mõlemas kanalis esinevat kandidaati edestavad vektorirada üksi esindavat õiget üksust. |
| Kahe allika küsimuse Tehnopoli elluviijad, lk 1 | 36 | 3 | 14 | Vajalik Tehnopoli allikas kaob top-5-st; EKA materjal üksi ei täida küsimuse eksplitsiitset kahe allika nõuet. |

RRF-i omadus „mõlema kanali 40. koht edestab ühe kanali esikohta” on selle seadistuse juures õige. See konkreetne mehhanism ilmneb RU rahastusküsimuses. Enamikus teistes siin vaadatud juhtumites oli ka vajalik üksus mõlemas kanalis olemas: nende puhul tuleb analüüsida kanalijärkude tasakaalu, mitte seletada kõiki kaotusi ainult kanalite kattuvusega.

### Ankrumõõdik ja sisuline tugi

**Tööandja vastutus:** küsimus küsib artiklis kirjeldatud vastutust riskide ja vägivallajuhtumijärgse toe puhul ega nõua 5. lehte või ministeeriumi kommentaari. Hübriidkonteksti 4. lehe chunk `chunk_eb39b390683c652190a69f1c5ff056d6bd2e1c980300e43a041c445c7c45c6a1` käsitleb situatsioonilist riskihindamist, kohtumise eel ohu hindamist, abilise kättesaadavust, juhtunu dokumenteerimist, õigusabi, kriisinõustamist, töökorralduse muutmist ja töötaja mitte üksi jätmist. Need on otsesed sisulised vastuseosad. V1 hindaja annab siiski mõlemale rühmale `covered=false`, sest alternatiivid on piiratud kahe teise fraasiga 5. lehel. Järeldus „v1 ankrud puuduvad” kehtib; järeldus „vastuseks vajalik tugi puudub” on selle hübriidrea puhul liiga tugev. Uues rubriigis tuleb see 4. lehe lõik hinnata samaväärse toe kandidaadina. V1 skoori ei muudeta ja uut semantilist täpsusprotsenti selle ühe tähelepaneku alusel ei arvutata. Struktuuriraja kontekst ei sisaldanud sedasama lõiku, seega ei tohi hübriidi sisulist vastendust talle automaatselt üle kanda.

**Inimsuhete piir ja arendustingimused:** valitud lk 7–8 kirjeldab lisaks inimsuhete säilitamisele läbipaistvat teavitamist, teadlikku osalust, kultuuritausta ja kasutajate osalust arendusprotsessis. See on osaline ja asjakohane tugi. See ei tõenda iseenesest sama täielikku üldist arendusrubriiki kui lk 12 läbipaistva, väärtuspõhise ja kaasava arenduse kokkuvõte. Enne alternatiivankru vastuvõttu tuleb nõutud mõtted eraldi määrata. Praeguse koodi viga sellest ei järeldu.

**Andmeminimeerimine:** hübriidi lk 8 sisaldab andmeliikide vajalikkuse, õigusliku aluse ning lepingulise katvuse küsimusi. See toetab teemat osaliselt. V1 lk 7 nõue iga detaili vajalikkuse ja konkreetse dokumendi välisele teenusele edastamise õiguse kohta on täpsem; täielikku samaväärsust ei kinnitatud. Seega pole ka siin `observed_support=absent` üldine tähendusliku sisu puudumise hinnang.

**Kahe allika küsimus:** täpne sõnastus nõuab Tehnopoli kirjeldust ja EKA enda materjali. Ankrufail lubab EKA rollile kahte alternatiivi, kuid Tehnopoli allikanõue on põhjendatud. Seda juhtumit ei märgita ainult EKA sisu põhjal õigeks.

### Struktuurivaliku tegelik piir

Intsidendiküsimuse õige viies üksus sai struktuurirajas jälje `seed_limit`; sama juhtus EN/RU rahastusküsimuse õige viienda üksusega. See polnud tokenieelarve täitumine: hübriidi kontekstid olid vastavalt 3107 ja 4468 tokenit, struktuuri kontekstid 2970 ja 3447 tokenit, ühine piir 6000. Katse valis kolm seemet ja kaks naabrit viie seemne asemel. Andmeid indeksist ei kadunud. Tõend puudutab seda konkreetset valikupoliitikat, mitte M3 semantiliste sõltuvuste kasulikkust.

### Edasise paranduse piir

Kõigepealt tuleb täiendada sisulist hindamisrubriiki tööandja vastutuse alternatiivse toe ning osalise toe eristusega, säilitades ajaloolise v1 ankrumõõdiku. Seejärel saab arendusosal katsetada üht valikumuudatust korraga. Kanalite esikohtade säilitamine ja naabri võrdlemine järgmise seemnega on mõõdetavad hüpoteesid; uus kaal ega dokumendikvoot pole veel kinnitatud lahendus. V1 kontrollosa on nüüd diagnoosiks avatud ning ei kvalifitseeru tulevase häälestuse puutumatuks kontrolliks. Suure korpuse päringu töömaht ja M4 eksplitsiitne profiil on eraldi tööd.

## M2.3 rubriik v2 ja võrguta kordushindamine

05.09 kohalik teostus valmis `aa2b12072` lähtepuu peale. Eelmine kitsas diagnoos säilis. Otsingutuuma, v1 küsimusi/ankruid, algmaterjali, indekseid ja teenuseid ei muudetud. Eraldi moodul `lib/rag-v2/evaluation/rubric-v2.js` ning käsk `scripts/rag-v2-regrade.mjs` loevad ainult salvestatud tulemusi ja manifestiga kontrollitud kohalikke versioone. Need ei impordi `retrieve()` ega PostgreSQL-i/Qdranti adaptereid; käsus on väljamineva võrgu tõke.

Rubriigi ettepanek sisaldab **15 perekonda, 29 kohustuslikku sisulist nõuet ja 34 põhjendatud tõenduskomplekti**. Valikulised näited on perekonna juures. Iga komplekt määrab toe ulatuse, põhjenduse ja täpse päritolu: PDF-räsi, dokumendi/versiooni identiteedi, lehe ning algtekstiga spanid. Komplekti liikmete vahel on JA, alternatiivide vahel VÕI. Fraas on allikakoha leidmise vahend; subjekti, summa, piirangu või mõtte toetuseks peab vajalik terviktekst kontekstis leiduma.

Nõuded ja vastendused on **Codexi ettepanekud**, mitte omaniku ega sõltumatu inimese kinnitatud märgendid. Otsusefaili 139 kirjet on ootel: 15 definitsiooni, 34 vastendust, 15 korpuse katvuse otsust ja 75 unikaalset perekonna/konteksti ülevaatust. Sama tegelik tekstikogum samas perekonnas kasutab sama otsust sõltumata meetodi nimest või otsingujärjekorrast.

### Kohalik ülevaatuspakett

- [Rubriigi v2 ettepanek](../../tmp/rag-v2-m2-3/rubric-v2-final/rubric-v2.json).
- [Meetodi ja skoorita sisulise ülevaatuse vaade](../../tmp/rag-v2-m2-3/rubric-v2-final/review.html) ja [masinloetav pakett](../../tmp/rag-v2-m2-3/rubric-v2-final/review-packet.json). Allikapäritolu säilib, tekstid on kanoonilises allikajärjekorras. Varasem kokkupuude tulemustega tähendab, et ülevaatus on retrospektiivne.
- [Ülevaatusotsused](../../tmp/rag-v2-m2-3/rubric-v2-final/review-decisions.json): kõik `pending`, `reviewed_by=null`. Kinnitus nõuab tegelikku inimest, aega, põhjendust ja otsuse alust. Fail on usaldatud kohaliku ülevaatuse kirje, mitte autentimis- ega digitaalallkirjasüsteem.
- [V1 → v2 raport](../../tmp/rag-v2-m2-3/rubric-v2-final/report.html), [täielik tulemus](../../tmp/rag-v2-m2-3/rubric-v2-final/regrade-results.json), [kontrollide kirje](../../tmp/rag-v2-m2-3/rubric-v2-final/run.json) ja [ülevaatamise juhis](../../tmp/rag-v2-m2-3/rubric-v2-final/README.md).

Käsk uue paketi loomiseks repositooriumi juurkaustast:

```powershell
node scripts/rag-v2-regrade.mjs --output tmp/rag-v2-m2-3/uus-pakett
```

Pärast tegelike ülevaatusotsuste lisamist kasutatakse sama salvestatud tulemust ja uut väljundkausta:

```powershell
node scripts/rag-v2-regrade.mjs --rubric tmp/rag-v2-m2-3/rubric-v2-final/rubric-v2.json --decisions tmp/rag-v2-m2-3/rubric-v2-final/review-decisions.json --output tmp/rag-v2-m2-3/parast-ulevaatust
```

Rubriigi või tõendi muutmine tühistab vana otsuse räsiseose; räsi käsitsi ülekirjutamine ei ole uus kinnitus. `absent` eeldab konteksti sisulist ülevaatust ja kinnitust, et nõudele puudub muu tugi; ainult vastendamata tekst jääb `needs_review`. Vastuolu on eraldi väljal ja takistab lõpliku `full` kinnitamist. Korpuse osatoe leidmine ning terve küsimuse katvus on eraldi: projektide arv ja teemad ei täida mõõdetud tulemuste nõuet.

### Esialgne tulemus ja lahtised otsused

Kõik **84 rida**, sealhulgas v1 õnnestumised, said sama v2 kontrolli. Iga v1 rida säilis täies mahus, sealhulgas valitud tekst, järjekord ja tokeniarv. Payload, küsimuste/ankrute räsid ning korpuse identiteet kattusid; failide enne/pärast räsid olid samad. Võrgu- ja otsingukutseid oli 0. Inimkinnituse puudumisel on `needs_review=84` ja kinnitatud `full/partial/absent=0`; see ei tähenda 84 ebaõnnestunud otsingut. Uut kvaliteediprotsenti ei esitata.

| Perekond | Ettepaneku järgi kontekstis leiduv tugi | Lahendamata või säiliv piir |
| --- | --- | --- |
| Tööandja vastutus | Vektor ja hübriid sisaldavad lk 4 järeltoe täieliku alternatiivi kandidaati ning riskivastutuse osalist kandidaati. | Kõigi tööandja riskikohustuste samaväärsus pole kinnitatud. Struktuuris sama komplekti pole. |
| Inimsuhted/arendustingimused | Hübriidis ja struktuuris on inimsuhete piir ning hooldusnäite osaline arendustugi; vektoris ka lk 12 üldine kokkuvõte. | Näitepõhine teavitamine/osalus ei täida automaatselt üldist arendusnõuet. |
| Andmeminimeerimine/väljasaatmine | Leksikaalses, vektoris ja hübriidis on üldiste andmeliigi/aluse/lepingutingimuste osalised kandidaadid; struktuuris lisaks lk 7 konkreetsed nõuded. | Osaline tugi ei kinnita iga detaili minimaalsust ega konkreetse dokumendi edastamisõigust. |
| Tehnopoli/EKA rollid | Mõlema nõutud allika komplekt leidub vektoris. | Teiste radade Tehnopoli nõue jääb täitmata. |
| Projektide arv, teemad ja mõõdetud tulemused | Vektor, hübriid ja struktuur sisaldavad arvu ning nelja teemarühma komplekti. | Mõõdetud tulemustele pole kinnitatud komplekti; kogu küsimuse täielikkust sellest ei järeldu. |
| Intsidenditegevus ja rahastamine | Kontroll hõlmab ka adressaate, kirjepunkte, terveid summasid ja etapipiire ning rakendus v1 võitudele. | Struktuuriraja varem tuvastatud viienda üksuse kaotus ei kao rubriigi täpsustamisega. |

Need on ettepanekute **tekstilise leidumise** tulemused, mitte kinnitatud semantilised märgendid. Otsingut ei muudetud; hilisem v1 → v2 erinevus tuleneb hindamisrubriigi või kinnitatud vastenduste muutusest.

### Kontrollid ja peatumiskoht

`node --test tests/rag-v2-rubric.test.mjs`: **9 pass, 0 fail, 0 skip**. Testid tõendavad alternatiivide nõudepõhisust, mitme lõigu JA-d, vale allika/lehe/teksti tõrjumist, partial/absent/needs_review eristust, osavastuse piiri, meetodi sõltumatust, otsuse päritolu/räsiseost, vastuolu ning kõigi 84 v1 rea säilimist. Võrguta CLI läbis ka eksplitsiitse rubriigi ja otsusefailiga korduse. Lint ja tootmisbuild koos i18n-ga läbisid; varasemat laia RAG-sviiti ega päristeenusekatset ei korratud.

Omaniku järgneval käsul saadeti teostus ja dokumentatsioon GitHubi; privaatsed raportid, algtekstid ning ülevaatusotsuste failid jäid kohalikku `tmp/` hoidlasse. Deploy'd ega tootmistoiminguid ei tehtud. Järgmine vajalik samm on sisuline ülevaatus; alles selle järel valitakse üks allesjäänud otsinguprobleem. V1 kontrollosa ei muutu kordushindamise tõttu puutumatuks.
