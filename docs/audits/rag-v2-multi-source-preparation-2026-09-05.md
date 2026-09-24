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

### Rubriigi teine ettepanek pärast sisulist ülevaatust

05.09 rakendati omaniku korraldusel ülevaatuse `M2_3_RUBRIIK_V2_SISULINE_YLEVAATUS.md` neli piiritletud täpsustust. Ülevaatus jääb assistendi arvamuseks. Muudeti ainult rubriigi ettepanekufaili `scripts/lib/rag-v2-rubric-proposal.mjs`, selle sihttesti ja käesolevat dokumentatsiooni; hindaja mootor, v1, otsinguseaded, algtekstid, indeksid ja server säilisid.

- Inimsuhete nõue säilitab „ei tohiks / peaks” tähenduse ning arendustingimused artikli tingimusliku järelduse. Haiglapiloodi koostöönõue räägib olulisusest ja eesmärgist, mitte mõõdetud või garanteeritud mõjust.
- Projektide koguarvu nõue ei eelda enam 52 taotluse nimetamist. Pikem `funded-not-applied` säilib; uus `funded-total-only` on VÕI-alternatiiv sama EKA lk 5 toetuse saanud 20 projekti tekstile. Teemarühmade sõnastus täpsustab ravimivõtmise tuge ja varajast sekkumist. Mõõdetud tulemuste nõue on endiselt eraldi ja kohustuslik.
- Tööandja riskivastutusele lisati `page3-organizational-risk` ja järeltoele `page3-institutional-support`. Mõlemad on `partial` ettepanekud: omavalitsuste, juhtkonna ja institutsionaalse toe seos ei kinnita kõiki üldisi tööandjakohustusi. Lk 4 järeltoe täieliku alternatiivi kandidaat ja riskivastutuse osaline kandidaat säilisid.
- `eka-page8` põhjendus nimetab `related_content_excerpt` rolli ja seotud loo pealkirja. See pole põhiartikli uus autoriväide ega sõltumatu lisaallikas. EKA lk 3 alternatiiv ja Tehnopoli kohustuslik allikanõue säilisid.

Uued allikakohad lahendati olemasolevast kanoonilisest snapshot'ist. Versioon on `2.0-proposal-2`: **15 perekonda, 29 nõuet, 37 komplekti**. [Uus ülevaatusvaade](../../tmp/rag-v2-m2-3/rubric-v2-proposal-2/review.html), [rubriik](../../tmp/rag-v2-m2-3/rubric-v2-proposal-2/rubric-v2.json), [otsusefail](../../tmp/rag-v2-m2-3/rubric-v2-proposal-2/review-decisions.json), [raport](../../tmp/rag-v2-m2-3/rubric-v2-proposal-2/report.html) ja [jooksukirje](../../tmp/rag-v2-m2-3/rubric-v2-proposal-2/run.json) on eraldi privaatses kaustas; esimene v2 pakett säilib muutmata. Rubriigi räsi on `266f2abc39662a4f580ca3407513231a1cf0d5d53189604039a8250c4fba3e35`.

Sama 84 rea võrguta kordushindamine säilitas kõik v1 read, teksti, järjekorra ja tokeniarvestuse. Tööandja perekonna leksikaalse ning struktuuriraja ettepanekute katvus muutus mõlema nõude puhul `no_mapped_support` → `partial`; vektori ja hübriidi olemasolev `partial/full` ettepanekujaotus ei muutunud. See on vastenduste täpsustus, mitte otsingu paranemine ega inimese kinnitatud katvus.

Vanades otsustes oli 139 ootel kirjet ja 0 kinnitust. Vanu kirjeid ega assistendi arvamuse JSON-i uude kinnituste faili ei imporditud. Uues failis on 142 ootel kirjet (15 definitsiooni, 37 vastendust, 15 korpuse ja 75 konteksti otsust), kõik `reviewed_by=null`. Lõpphinnang jääb kõigil 84 real `needs_review`, kvaliteediprotsent `null`.

Kontrollid: **10 pass, 0 fail, 0 skip** käsuga `node --test tests/rag-v2-rubric.test.mjs`; lint, `git diff --check` ja tootmisbuild koos i18n-ga läbisid. Uus sihttest kontrollib, et 20 projekti alternatiiv toimib ilma 52-ta, mõlemad lk 3 osalised komplektid leiduvad päris leksikaalses/struktuurilises kontekstis, mõõdetud tulemused jäävad kohustuslikuks ning EKA eelvaateroll säilib ekspordis. Omaniku järgneval käsul saadeti täpsustused, test ja dokumentatsioon GitHubi; privaatsed raportid ja otsusefailid jäid kohalikuks. Uusi mudelikutseid, otsingut, indekseerimist ega deploy'd ei tehtud. Järgmine samm on tegeliku omaniku või sisulise inimülevaataja otsused.

### Omaniku rubriigikinnitus

05.09 omanik kinnitas otseselt „mina kinnitan” rubriigi `2.0-proposal-2` nõuete ja tõendusvastenduste kasutamise hindamise alusena, jättes konteksti- ning korpuseotsused eraldi ülevaatusse. [Privaatne vastuvõtukirje](../../tmp/rag-v2-m2-3/rubric-v2-owner-acceptance.json) seob kinnituse rubriigi muutumatu räsiga `266f2abc39662a4f580ca3407513231a1cf0d5d53189604039a8250c4fba3e35`. 15 definitsiooni ja 37 vastendust on `approved`; `reviewed_by.role=owner`, nimeväli tuvastab selle vestluse projekti omaniku. Alus kirjeldab omaniku otsust assistendi koostatud ja üle vaadatud materjali põhjal, mitte sõltumatut pimedat inimhindamist. Algne rubriigiettepanek ja vana ootel otsusefail säilivad muutmata.

Kinnitatud on hindamise leping, mitte 75 konteksti ammendav lugemine ega kogu korpuse katvus: 75 konteksti ja 15 korpuseotsust jäid algse failiga täpselt võrdseks ja `pending`. [Uue kordushindamise raport](../../tmp/rag-v2-m2-3/rubric-v2-owner-accepted/report.html), [masinloetav tulemus](../../tmp/rag-v2-m2-3/rubric-v2-owner-accepted/regrade-results.json) ning [jooksukirje](../../tmp/rag-v2-m2-3/rubric-v2-owner-accepted/run.json) kinnitavad 84 v1 rea teksti, järjekorra ja tokenite säilimist, muutumatuid sisendiräsisid ning 0 võrgu-/otsingukutset. Kõik definitsioonid on nüüd hindajas kinnitatud, kuid lõpphinnang on endiselt `needs_review=84`, kvaliteediprotsent `null`, sest kontekstiülevaatus on eraldi ootel. Otsusefaili normaliseeritud räsi on `a63091e33730984d814211160364f2b3b09e46ab6964f377d99a29db48822f79`.

Vastuvõtukirje ja selle dokumentatsioon on kohalikud; uut rubriigiversiooni, koodimuudatust, push'i ega deploy'd ei tehtud. Järgmine samm on korpuse ja kontekstide sisulised otsused perekondade kaupa. Teste ega build'i ei korratud andme-/dokumendikirje pärast.

### Esimese perekonna kontekstiotsuste ettevalmistus

Tööandja vastutuse perekonna kõik neli salvestatud konteksti (13 unikaalset tekstiosa) loeti kinnitatud nõuete järgi läbi. [Otsustusleht](../../tmp/rag-v2-m2-3/employer-review.md) sisaldab meetoditeta tähiseid A–D, täielikke kontekste, päritolu ja korpuses leiduvat lk 5 täistuge; [assistendi ettepanek](../../tmp/rag-v2-m2-3/employer-review-proposal.json) on formaalsest otsusefailist eraldi.

Ettepanek: A ja D riskivastutus `partial`, järeltoe nõue `full`; B ja C mõlemad nõuded `partial`; kogu küsimuse katvus kõigis neljas `partial`. Vastandväidet nõuetele ei tuvastatud. Korpuses on mõlema nõude täielik tugi kinnitatud lk 5 komplektidena olemas; see on positiivse olemasolu tõend, mitte kogu korpuse ammendava lugemise väide. Formaalseid konteksti- ega korpuseotsuseid enne omaniku kinnitust ei muudetud. Ülevaatus on assistendi ettevalmistus, millele omanik saab oma otsuses tugineda.

### Tööandja perekonna otsused vastu võetud

05.09 omanik nõustus A–D terviktekstide ja kinnitatud rubriigi alusel kõigi nelja kontekstiotsusega, mõlema nõude täieliku toe olemasoluga korpuses ning vastandväite puudumisega. Omanik lubas nõusoleku lisada otsuste alusesse. [Jätkuv privaatne otsusefail](../../tmp/rag-v2-m2-3/review-decisions-employer-accepted.json) säilitab kõik 52 varasemat definitsiooni/vastenduse kinnitust ja lisab täpselt viis otsust: neli konteksti ning ühe perekonna korpusekatvuse. Muud otsused ei muutunud. Päritolu on selle vestluse omaniku retrospektiivne vastuvõtt assistendi koostatud materjali põhjal, mitte sõltumatu pime inimhindamine. Korpuse `full/full` on positiivse tõendi olemasolu otsus, mitte ülejäänud korpuse ammendava lugemise või kehtiva õiguse kontrolli kinnitus.

[Võrguta kordushindamine](../../tmp/rag-v2-m2-3/employer-accepted/report.html) andis kõigile neljale tööandja reale `partial`. A/D ehk vektori/hübriidi riskivastutus on `partial` ja järeltoe nõue `full`; B/C ehk struktuuri/leksikaalse raja mõlemad nõuded on `partial`. Kõigi nelja vastuoluväli on `none`. V1 read, tekstid, järjestus ja tokenid säilisid; võrgu- ja otsingukutseid oli 0. Kogu 84 rea koond: 4 kinnitatud `partial`, 80 `needs_review`, 0 `full`, 0 `absent`, kvaliteediprotsent `null`. Ootel on 71 unikaalset konteksti ja 14 korpusekatvuse otsust. Otsusefaili normaliseeritud räsi: `4dac47e331694d0fec3c94001fa005acf468ccdc91f05c1d844a87bff4f2ed18`.

Selle perekonna rubriigiparandust pole vaja. Vajalik üldise tööandja riskivastutuse teadmine on korpuses, kuid ei jõudnud tervikuna ühtegi neljast valikust; otsingu edasine siht oleks vastutusseose leidmine, mitte lehe sunniviisiline eelistamine. Järgmine ülevaatusperekond on inimsuhted ja arendustingimused. Muudatused on kohalikud, koodi ega serverit ei muudetud, push'i ega deploy'd ei tehtud.

### Inimsuhete ja arendustingimuste otsustusleht

05.09 loeti järgmise perekonna kõik neli salvestatud konteksti (10 unikaalset tekstiosa). [Otsustusleht](../../tmp/rag-v2-m2-3/relationships-review.md) sisaldab nõudeid, põhjendusi, kõiki A–D terviktekste ja päritolu; [assistendi ettepanek](../../tmp/rag-v2-m2-3/relationships-review-proposal.json) säilitab sidumise muutumatu rubriigi ja kontekstiräsidega. Meetodid ja skoorid on peidetud; tegu on retrospektiivse ettevalmistusega.

Ettepanek: B/C inimsuhete piir `full`, üldised arendustingimused `partial`; D mõlemad `full`. B lk 6–7 eakate/hooldajate osalus on sisuline lisatugi, kuid hooldusvaldkonna näide ei kinnita automaatselt kogu üldist tingimust. A jääb `needs_review`: lk 6 inimkesksed väärtused ning lk 3–4 Hesteri näide sisaldavad võimalikku seni vastendamata osatuge, mistõttu `no_mapped_support` ei teisendata `absent`-iks. Koolitusmaterjal ei asenda küsimuses nõutud artikli käsitlust. Vastandväidet nõuetele ei tuvastatud. Korpuses on mõlemale nõudele täistugi kinnitatud `relationship-limit` (lk 8) ja `general-conclusion` (lk 12) komplektides; see on positiivse olemasolu tõend.

B–D ja korpuse otsused ootavad omaniku sisulist vastuvõttu; A vajab eraldi hinnangut. Formaalseid otsuseid, rubriiki ega varasemaid vastuvõtukirjeid ei muudetud. Koodi-, võrgu-, otsingu-, DB-, push- ega deploy-toiminguid ei tehtud. Andme-/dokumendimuudatus ei vajanud uut testi ega build'i; kontrolliti otsustuslehe tekstide ja räsiseoste vastavust olemasolevale paketile ning `git diff --check` tulemust.

### Inimsuhete B–D ja korpuse otsused vastu võetud

05.09 omanik kinnitas B–D terviktekstide lugemise järel B/C `full/partial` ja D `full/full`, nendes kolmes vastandväidete puudumise ning mõlema nõude `full` korpusekatvuse. A jäeti sõnaselgelt eraldi ülevaatusse. [Uus privaatne otsusefail](../../tmp/rag-v2-m2-3/review-decisions-relationships-accepted.json) lisab täpselt neli vastuvõttu: B, C, D ja perekonna korpusekatvus; ülejäänud 138 kirjet, sealhulgas A, 52 rubriigikinnitust ja viis tööandja otsust, säilivad muutmata. Alus sisaldab omaniku hinnangu kasutusluba, terviktekstide lugemist ning retrospektiivse vastuvõtu piiri.

B põhjendus tunnustab eakate/hooldajate kaasamist väljatöötamisse, autonoomiat, andmekaitset, jälgitavust ja spetsialistidega koostööd. B/C osalisus tuleneb spetsialistide ja teenusekasutajate sisulise arendusotsustes osalemise kogu ulatuse ebapiisavast tõendist, mitte lehe või fraasi puudumisest. Nende `no_other_support_for` sisaldab ainult `general-development` ning põhjendus täpsustab, et lisatugi ei anna tugevamat ehk täielikku katvust; osatuge ei eitata. D säilitab artikli tingimusliku järelduse, mitte garanteeritud või mõõdetud mõju. Korpusekatvus on positiivse allikatõendi olemasolu, mitte ülejäänud korpuse ammendava lugemise kinnitus.

[Võrguta kordushindamine](../../tmp/rag-v2-m2-3/relationships-accepted/report.html) kinnitab A `needs_review`, B/C `partial` ja D `full`; A vastuoluotsus on endiselt ootel, B–D `none`. Kõigi 84 rea koond on **1 full, 6 partial, 0 absent, 77 needs_review**, kvaliteediprotsent `null`. Ootel on 68 unikaalset konteksti ja 13 korpuseotsust. [Jooksukirje](../../tmp/rag-v2-m2-3/relationships-accepted/run.json) normaliseeritud otsuseräsi on `219ee76f6391f409ec4f6cc0e976210507e50f308e41201fd3b80b3bf59593ec`; sisendid säilisid, võrgu- ja otsingukutseid oli 0. Readback võrdles kõigi v1 ridade täielikku sisu ja tokeniarvestust eelmise jooksuga ning kinnitas täpselt nelja otsuse muutuse ja A puutumatuse.

Järgmine samm on A võimaliku osatoe eraldi sisuline hinnang. Rubriiki, otsingut, koodi, andmebaase ega serverit ei muudetud. Teste ega build'i andme-/dokumendikirje tõttu ei korratud; `git diff --check` läbis. Kõik uued otsusekirjed ja dokumentatsioon on kohalikud, push'i ega deploy'd ei tehtud.

### Kõigi ülejäänud otsuste koondpakett

05.09 omanik ütles, et tal pole aega üksikute juhtumite kaupa hinnata, ning palus teha hindamise korraga. Valmis [üks otsustusleht](../../tmp/rag-v2-m2-3/batch-review.md), [täistekstidega tõendivaade](../../tmp/rag-v2-m2-3/batch-review-evidence.html), [masinloetav ettepanek](../../tmp/rag-v2-m2-3/batch-review-proposal.json) ja [artefaktide räsimanifest](../../tmp/rag-v2-m2-3/batch-review-manifest.json). Kaks sõltumatut read-only ülevaatuskatset ei käivitunud kasutuslimiidi tõttu; lõpliku sisulise ülevaatuse tegi põhiassistent. Seda ei esitata sõltumatu mitme hindaja ega inimese auditina.

Läbi vaadati kõigi 68 ootel konteksti 58 unikaalset tekstiosa ning võeti arvesse varasemas voorus loetud allikaosi. Korpuse kontrolliks vaadati lisaks üle kontekstides puudunud kaheksa lühikest tekstiosa; kaheksa dokumendi 69 normaliseeritud tekstiosa sisu oli seega läbi loetud. PDF-e ei renderdatud uuesti ja parseri piirangud säilivad. Korpuse negatiivsed ettepanekud piirduvad selle snapshot'iga: EKA projektikajastus ei sisalda nende projektide saavutatud mõõdetud mõju; korpuses pole määramata valla 2026 koduteenuse hinnamäära ega määramise tähtaega. Positiivsed korpuseotsused toetuvad kinnitatud täielikele allikakomplektidele.

Ettepanekute jaotus 68 unikaalsel kontekstil: **41 full, 8 partial, 12 absent, 7 needs_review**. Ühe vastuvõtuga saab kinnitada 61 konteksti ja 13 korpuseotsust. Lahtiseks jäävad K13/K42/K67 (turvalisuse arutelu võimalik osatugi eetilisele kolleegiarutelule), K21/K41 (intsidendikorra tundmise võimalik osatugi teatamisnõudele), K24 (varasem inimsuhete A) ja K45 (H2 töölehe võimalik tugevam detaili-ülesande seos). Neid ei teisendata automaatselt puuduvaks toeks. Uut rubriigiversiooni ega vastendust selles paketis ei lisatud.

Kui omanik võtab kõik selged ettepanekud vastu, oleks kõigi 84 tulemuserivi prognoos **50 full, 14 partial, 13 absent, 7 needs_review**. See on ettepanekute mehaaniline projektsioon, mitte kordushindamise ametlik tulemus ega otsingu paranemine. Praegused formaalsed otsused ja ametlik koond **1 full / 6 partial / 77 needs_review** säilivad muutmata. Koondvastuvõtu sõnastus lubab omanikul tugineda assistendi paketile, väitmata kõigi terviktekstide isiklikku lugemist; lubatud on üks koondnõusolek koos eranditega.

Tehniline readback kontrollis kõigi 68 konteksti olemasolu, sisuräsiseoseid, iga täisteksti leidumist tõendivaates, 61 selge ettepaneku kooskõla olemasolevate vastendustega ja formaalsete otsusefailide muutumatust. `git diff --check` läbis. Teste ega build'i ei korratud, otsingut ja andmebaase ei puudutatud ning väliskutseid, push'i ega deploy'd ei tehtud. Järgmine samm on üks omaniku koondotsus, seejärel üks võrguta kordushindamine ja ühe allesjäänud otsinguvaliku puudujäägi valimine; iga lahtise konteksti jaoks uut üksikkinnituse ringi ei alustata.

### Koondjärelhinnang ja nelja põhjenduse lisa

05.09 loeti omaniku lisatud [KOOND_JARELHINNANG.md](../KOOND_JARELHINNANG.md) ja [batch-review-assistant-check.json](../batch-review-assistant-check.json). Need on ChatGPT assistendi retrospektiivne järelülevaatus, mitte omaniku otsus ega sõltumatu inimhindamine. Järelülevaatus toetab 61 valmis konteksti ja 13 korpuseotsust ning säilitab seitse erandit. Tema lugemisulatus on 58 esitatud unikaalset tekstiosa; 69 kanoonilise korpuseüksuse läbivaatuse väide pärineb algpaketi koostajalt. V1 kogu payload'i ja formaalse baastaseme räsi sõltumatut kontrolli järelülevaataja ei väitnud.

Kohalik võrdlus kinnitas järelülevaatuse kolme failiräsi, 61 valmis tähise, 13 korpuseperekonna, seitsme erandi ning nõudepõhiste ettepanekute vastavuse algpaketile. Leid K22/K47/K50/K65 puuduva `reason` kohta osutus õigeks: sama puudus oli HTML-i põhjenduskohtades. Varasem tehniline kontroll tõendas tekstide ja vastenduste säilimist, kuid ei kontrollinud iga põhjenduse mittetühjust.

[Eraldi põhjenduste lisa](../../tmp/rag-v2-m2-3/batch-review-rationale-supplement.json) seob neli põhjendust muutumatute konteksti- ja sisuräsidega ning sisaldab mõlema järelülevaatusfaili baidiräsi. K22/K47/K50 eristavad EKA rolli olemasolu ja nõutud Tehnopoli allikakoha puudumist (`absent/full`, koond `partial`); K65 sisaldab mõlemat (`full/full`). Rubriiki ega hinnanguid ei muudetud, algpaketi kolm manifestiräsi säilivad. Formaalsetesse otsustesse assistendi hinnangut ei imporditud ja kordushindamist ei tehtud. Ametlik tulemus jääb **1 full / 6 partial / 77 needs_review**; **50/14/13/7** on endiselt omaniku koondvastuvõtust sõltuv prognoos. `git diff --check` läbis; koodi, serverit, push'i ega deploy'd ei puudutatud.

## M2.3 koondvastuvõtt ja põhileidude eelisjärjekorraga profiil

05.09 omaniku esitatud `CODEX_M2_3_KONTEKSTIVALIK_v0_1.md` §2 ja sama töövooru lisatud juhis kinnitasid tegeliku koondvastuvõtu aluse ning andsid loa piiratud valikukatseks. [Salvestatud otsusefail](../../tmp/rag-v2-m2-3/review-decisions-batch-accepted.json) lisab täpselt **61 konteksti ja 13 korpuseotsust**. Ülejäänud 68 otsusekirjet säilisid; nende hulgas on kõik varasemad kinnitused ja seitse lahtist konteksti. K22/K47/K50/K65 põhjendused tulid muutumatu algpaketi eraldi lisast. `reviewed_by` on senise vastuvõturaja projekti omanik, mitte järelülevaatuse assistent. `reviewed_at=2026-09-05T19:54:58.291Z` on salvestamise aeg; vahendatud varasema kinnituse täpne kellaaeg on teadmata ja seda ei leiutatud. Alus säilitab assistentide tööle tugineva omaniku vastuvõtu ning 58 eksporditud / 69 kanoonilise üksuse läbivaatuste erinevuse.

[Üks ametlik võrguta kordushindamine](../../tmp/rag-v2-m2-3/batch-accepted/report.html) andis **50 full / 14 partial / 13 absent / 7 needs_review** kõigil 84 küsimuse-/meetodireal. Need pole 68 unikaalse konteksti arvud ega süsteemi täpsusprotsent. Otsuste normaliseeritud räsi on `1adaac767a11d7714b12d27d76afcc5c98418fb997d374cc98dcaf1806305987`; rubriik, v1 payload, korpus ja algpakett säilivad. Korpuse mõõdetud projektimõju ning määramata valla teenuse hinna/tähtaja nõuded on endiselt piiratud valimi `absent`.

| Ametlik meetod | full | partial | absent | needs_review |
| --- | ---: | ---: | ---: | ---: |
| Leksikaalne | 8 | 3 | 8 | 2 |
| Vektor | 16 | 2 | 1 | 2 |
| Hübriid | 14 | 5 | 1 | 1 |
| Ajalooline 3+2 struktuur | 12 | 4 | 3 | 2 |

### Teostus ja võrdlus

Koodikontroll näitas, et `retrieve()` juba lisab põhileiud enne naabreid. Seetõttu lisati **olemasoleva võimekuse eksplitsiitsed profiilid**, mitte teine valikualgoritm: `lib/rag-v2/search/profiles.js` annab versioonitud `ranked-first-nondisplacing-v1` poliitika, `topK=finalLimit=5`, 40 kandidaati kanalis, 6000 tegelikku kompaktset tokenit, sama kuni viie üksuse dokumendipiiri ning struktuuri vaikimisi väljas. Naabritega nimeline profiil lubab kuni kaheksa sammu ja kaks lisandust ainult tegelikult vabasse mahtu. Ajalooline `hybrid_structure`, RRF, leksikaalne otsing, parser, tükeldus, mudel ja indeksid säilisid. Leping ja kasutus on [ADR-005-s](../rag-v2/adr-005-ranked-first-profiles.md).

`scripts/rag-v2-selection-compare.mjs` kasutab salvestatud pärisvektoreid ja kandidaatide nimekirju ning käivitab muutmata tootmisvalikufunktsiooni read-only mälus olevate adapteritega. [Võrdlusraport](../../tmp/rag-v2-m2-3/selection-ranked-first-v1/report.html), [kõik tulemused](../../tmp/rag-v2-m2-3/selection-ranked-first-v1/comparison-results.json) ja [jooksukirje](../../tmp/rag-v2-m2-3/selection-ranked-first-v1/run.json) tõendavad **63/63 ajaloolise rea** täpset teksti, järjekorra ja tokenite reproduktsiooni. Kokku tehti 84 runtime'i kordusesitust ja 84 salvestatud päringuvektori lugemist; uusi välismudeli-, PostgreSQL-i või Qdranti teenusekutseid, indeksi aktiveerimisi ega genereerivaid kutseid oli 0.

Uus naabritega profiil oli **21/21 küsimusel struktuurita hübriidiga täpselt sama**: kõik viis kohta täitusid põhileidudega. See on võrdsus, mitte graafi võit. Kõik uue profiili kontekstid olid olemasolevate otsustega seotud tekstikogumid; uusi unikaalseid kontekste ja uut kinnitusringi ei tekkinud. Olemasolev lahtine hübriidkontekst jäi lahtiseks.

| Muutus vana 3+2 raja suhtes | Tõend |
| --- | --- |
| Kaks võitu sama perekonna EN/RU tõlkeridadel | Rahastamise nõutud Tehnopoli lk 2 tuli tagasi: `absent → full`. Need pole kaks sõltumatut sisulist olukorda. |
| Üks kaotus | Andmeminimeerimisel kadus kasulik osalejapaketi lk 7 naaber; mõlemad nõuded muutusid `full → partial`. |
| 16 võrdse kinnitatud katvusega rida | Sisu võis muutuda, kuid kinnitatud koondkatvus säilis. |
| Kaks lahendamata võrdlust | Intsidendil tuli lk 11 täielik tugi tagasi ja uus kontekst on varem kinnitatud `full`, kuid vana 3+2 kontekst jääb `needs_review`; seda ei loeta kinnitatud võiduks. Eetilise arutelu mõlemad kontekstid jäävad lahti. |

Nõuete lisandunud/kadunud komplektid, täistekstid, päritolu, valikupõhjused ja kestused on raportis. Kõigis võrreldud meetodites oli viis üksust. Vektori tokenivahemik oli 2507–5450 (keskmine 3943), hübriidil ja uuel profiilil 3107–5889 (4606), vanal 3+2 rajal 2818–5111 (4022). Mõõdetud valikuaeg ei sisalda päristeenuste latentsust. Tegelik PostgreSQL/Qdrant integratsioon selles plokis `not_run`; aktiivset pärisindeksit ei puudutatud.

### Profiilikandidaat ja M4 järg

Järgmise piiratud M4 sisepiloodi ettepanek on **[vector-ranked-first-v1](../../tmp/rag-v2-m2-3/selection-ranked-first-v1/m4-profile-candidate.json)**, struktuur väljas; kontrollitud alternatiiv on `hybrid-ranked-first-v1`. Põhjus on selle valimi 16 vs 14 täieliku toega rida ja väiksem kontekst, kuid ootel ridu ei peideta ega vektori universaalset paremust väideta. Helperi hübriidne vaikimisi profiil ei aktiveeri M4 kandidaati: ühendus peab valima profiili nimeliselt. Naabritega variant jääb katseprofiiliks.

[Uue kontrollkogumi ettepanek](../../tmp/rag-v2-m2-3/selection-ranked-first-v1/future-control-proposal.json) sisaldab kuut uut sisulist ET/EN/RU juhtumit: Hesteri andmete elutsükkel ja inimese abi, olemasoleva tehnoloogia kohandamise nõue, õppeotsuse vaiderada, kommentaaride eri autorite seisukohad, Kataloonia/Tamil Nadu kujundusnäidete võrdlus ning tänase vooruseisu eristamine ajaloolisest snapshot'ist. Küsimusi pole käivitatud ega häälestamiseks kasutatud. Enne valideerimist fikseeritakse lõplik profiili-, küsimuste-, nõuete- ja korpuseräsi; pärisembedding ja Luna vajavad üht selget materjali-/kuluplaani.

M4 järgmine töö on uue küsimuse embedding, serverisessioonist tuletatud õigused, nimeline otsinguprofiil ja kompaktne kontekst, ühe vastaja adapter, kanooniliste viidete avamine ning salvestamise/taastatavuse leping. M4 teostust ei alustatud. Seitse lahtist hinnangut ega kogu M3 sõltuvusgraaf ei blokeeri seda piiratud ettevalmistust; M3, M5 ja suure korpuse päringutöö vähendamine jäävad oma töödeks.

### Kontrollid ja kohaliku töö piir

Uus `tests/rag-v2-selection.test.mjs`: **7 pass / 0 fail / 0 skip**. Mõjutatud RAG-regressioon (`rag-v2-search`, `rag-v2-rubric`, `rag-v2-pilot`): **32 pass / 0 fail / 0 skip**; kokku **39/0/0**. Kontrolliti viienda põhileiu säilimist, vabade kohtade kasutamist, tegelikke kompaktseid tokeneid, nähtavaid piiripõhjuseid, duplikaate, puuduvat/valet versiooni, ligipääsu tühistamist, determinismi, puuduvat vektorivahemälu, hindaja eraldatust ja vana kinnituse mitteülekandmist uuele kontekstile. Muudetud koodi lint, `git diff --check` ja üks lõpliku koodipuu tootmisbuild koos i18n-ga läbisid. Skeemi ega tõlkeid ei muudetud.

Lähte-HEAD on `0873f148b`; profiil, võrdluskäsk, test ja dokumentatsioon on kohalikud muudatused. Vanad rapordid ja kinnituste ajalugu säilivad eraldi väljundites. Avaliku chati `generationAvailable=false`, Luna, teenused ja server jäid puutumata. Push'i ega deploy'd ei tehtud.
