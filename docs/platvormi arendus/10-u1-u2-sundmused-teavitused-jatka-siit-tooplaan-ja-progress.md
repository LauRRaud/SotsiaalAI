# U1 + U2 — sündmused, teavitused ja „Jätka siit”

> **Staatus:** VALITUD JÄRGMISEKS UUEKS ARENDUSPAKETIKS — TEOSTAMATA
>
> **Koostatud:** 2026-07-14
>
> **Põhiteostaja:** Sol 5.6, vähemalt **väga kõrge** effort
>
> **Sõltumatu järelkontroll:** Claude Opus 4.8, eelistatult **Max**, minimaalselt Extra (`xhigh`)
>
> **Deploy:** keelatud ilma kasutaja eraldi selge loata
>
> **Lähteallikas:** `fable-5-avastamata-vajadused-ja-uued-voimalused.md`, U1 + U2

## 0. Otsus

Fable'i auditist valitud järgmine arenduspakett on:

**U1 + U2 — püsiv sündmuse- ja teavituskiht koos töölaua „Jätka siit” koondiga.**

See valik on lukustatud. U1 on puuduv aluskiht, millest sõltuvad mitme mooduli märguanded. U2 teeb selle aluse kohe kasutajale nähtavaks ja ühendab olemasolevad pooleliolevad tööd üheks turvaliseks tööjärjeks.

Pakett ei ole üldine sõnumisüsteem ega ülesandehaldur. See on kitsas, kasutaja enda õigustega piiratud sündmuste, märguannete ja järgmiste tegevuste kiht.

## 1. Millal tohib alustada

Teostus algab uuelt `codex/` harult alles siis, kui teostaja on kontrollinud tegelikku `main` seisu.

Enne koodi:

1. kontrolli `git status`, `git log`, `origin/main` ja aktiivsed worktree'd;
2. veendu, et Parimate praktikate operatsioonipaketi P1 parandused on Soli kontrolli läbinud ja sihtharusse jõudnud;
3. veendu, et U12/U3, U4 ja U8-lite lõppseisud on kas `main`-is või kaardista täpselt, millise haru peale töö rajatakse;
4. ära kopeeri pooleliolevatest worktree'dest faile käsitsi;
5. ära stage'i ega muuda kõrvalisi ruumipilte, imagegen-väljundeid ega teise töö commit'imata faile;
6. kirjuta allolevasse progressipäevikusse lähteharu ja commit.

Kui mõni eelnev haru pole veel ühendatud, ei tohi selle eeldatavat API-t või skeemi välja mõelda. Kas oota integratsioon ära või dokumenteeri teadlikult eraldi integratsioonisõltuvus.

## 2. Kasutajad ja kasu

### 2.1 Pöörduja

- näeb, kus ta pooleli jäi;
- saab teada, et pöördumise, kutse, sobituse või ühise ruumiga on midagi juhtunud;
- ei pea eri lehti juhuslikult kontrollima;
- teavitus ei paljasta e-kirjas ega lukukuval tundlikku sisu.

### 2.2 Spetsialist

- alustab tööpäeva selge, kuni seitsme kirjega tööjärjega;
- näeb saabunud või tegevust vajavaid pöördumisi, lugemata ruume ja järgmise kontakti tähtaegu;
- saab Parimate praktikate ülevaatusülesannete ja tähtaegade märguanded;
- tööjärg ei ole AI riskiskoor ega ametlik menetlusregister.

### 2.3 Teenuseosutaja

- saab kättesaadavuse värskendamise meeldetuletuse;
- näeb ainult enda teenusekirjetega seotud tegevusi;
- ei saa selle kihi kaudu ligipääsu pöörduja privaatsele sisule.

## 3. Muutumatu privaatsus- ja tooteleping

1. Teavitus kannab ainult sündmuse fakti, turvalist liiki, aega ja serveri loodud sihtviidet — mitte pöördumise, sõnumi, juhtumi, heaolumustandi ega praktikakandidaadi vabateksti.
2. E-kirja teema ja sisu on minimaalsed: „Sulle on SotsiaalAI-s uus tegevus” + sisselogimislink. Tundlikku teemat ega kokkuvõtet e-kirja ei panda.
3. Kõik päringud on kasutajapõhiselt skoopitud. Võõrast ja puuduvat privaatset objekti ei eristata.
4. UI peitmine ei ole õigusekontroll. Server kontrollib nii sündmuse loomist, lugemist, loetuks märkimist kui ka sihtobjekti avamist.
5. Teavitus ei anna sihtobjektile uusi õigusi. Link võib pärast õiguse lõppemist anda üldise 404/403 vastavalt olemasolevale avalikule lepingule.
6. Sündmuse liik ja sihttee tulevad serveri allowlist'ist. Klient ei saada salvestamiseks suvalist URL-i, teksti ega sündmuseliiki.
7. Sündmuste ja „Jätka siit” järjekord ei ole AI hinnang kiireloomulisusele. Kasuta deterministlikke oleku- ja tähtajareegleid.
8. Tööheaolu privaatne mustand jääb rangelt omanikule. Selle olemasolu, pealkiri ega olek ei leki teisele rollile.
9. Parimate praktikate privaatne retsensendimärkus ei tohi jõuda sündmuse payload'i, e-kirja ega töölaua koondisse.
10. Konto kustutamise ja andmete minimeerimise leping laieneb uutele mudelitele; orvuks jäänud kasutajate teavitusi ei säilitata põhjendamatult.

## 4. Mitte-eesmärgid

Selles paketis ei ehitata:

- eraldi täismahus teavituskeskuse lehte;
- üldist DM-i ega uut vestluskanalit;
- kalendrit, väliskalendri sünkroniseerimist või CRM-i;
- vabalt koostatavaid admini mass-teavitusi;
- AI-põhist prioriteedi-, riski- ega kiireloomulisuse skoori;
- kogu platvormi üldist event-bus'i või universaalset sõnumijärjekorda;
- push-teavitusi brauserisse või telefoni;
- tundliku sisu kopeerimist sündmusetabelisse;
- uut ametlikku menetlusolekut.

## 5. Etapp 0 — kohustuslik read-only kaardistus

Enne skeemi või koodi muutmist loe aktiivsest lähteharust vähemalt:

- `prisma/schema.prisma`: `User`, `PreInquiry`, `Room`, `RoomMember`, Teekonna, Tööheaolu, teenusekirje ja Parimate praktikate mudelid;
- `lib/workspaceDashboardCards.js` ja selle kõik kasutajad;
- `lib/preInquiries.js` ning eelpöördumise saatmise, vastuvõtmise ja checklist'i marsruudid;
- ruumikutse, ruumisõnumi ja `/read` teenused/marsruudid;
- `RoomMember.lastReadAt` ja olemasolev lugemata sõnumite loogika;
- help-match/sobituse loomise teenus ja omanikuskoobid;
- aktiivse Teekonna ja Tööheaolu mustandite loendid;
- U4 teenuseosutaja kättesaadavuse värskuse lõppkood;
- Parimate praktikate review-scheduler'i lõppkood ja audit-markerid;
- kõik `getMailer` kasutuskohad, olemasolevad e-kirja retry/idempotentsuse mustrid ja job-route autentimine;
- `app/api/jobs/subscription-renewals/route.js` või selle aktiivne järeltulija;
- ET/EN/RU sõnumid ja `i18n:check` leping;
- olemasolevad API veavõtmete allowlist-helperid;
- kasutaja kustutamise/cascade'i loogika;
- seotud testitaristu ja fake-Prisma mustrid.

Kaardistuse lõpus kirjuta progressipäevikusse:

- milline olemasolev endpoint koostab tööruumi kaardid ja badge'id;
- millised viis U1 algsündmust tekivad juba aktiivses koodis;
- millised sündmused saadetakse praegu ainult e-kirjana;
- kus on iga sündmuse õige transaktsiooniline loomispunkt;
- kuidas välditakse duplikaatsündmust retry või topeltkliki korral;
- kuidas ruumi lugemata olek praegu tekib ja nullitakse;
- milline aktiivne mudel kannab receiver checklist'i;
- kuidas P1 scheduler ja U4 reminder annavad U1-le fakti ilma vabatekstita;
- milline e-kirja saatmise retry-muster on repos päriselt kasutatav;
- millised dokumendi eeldused erinevad aktiivsest koodist.

**Etapp 0 on read-only.** Kui leitakse oluline dokumendi ja koodi vastuolu, jäädvusta see enne teostamist. P0/P1 turvariski korral peatu ja anna see Solile või kasutajale otsustada.

## 6. Etapp 1 — püsiv sündmuse- ja kohaletoimetamise tuum (U1-A)

### 6.1 Andmemudel

Etapp 0 järel lisa väikseim mudel, mis kannab vähemalt:

- adressaat (`userId`);
- rakenduskihi allowlist'itud `type`;
- `sourceType` ja `sourceId`;
- deterministlik `dedupeKey` või samaväärne unikaalsusleping;
- serveri loodud allowlist'itud siht (`targetKind` + minimaalne ID või turvaline tee);
- `createdAt`;
- `readAt`;
- e-kirja kohaletoimetamise seis vähemalt `emailedAt`, katsete arv, järgmise katse aeg ja ohutu veakood, kui e-kiri on selle sündmuse jaoks lubatud.

Soovituslik nimi on `NotificationEvent`, kuid nimi ei ole olulisem kui leping.

Nõuded:

- ära kasuta PostgreSQL enum'i; sündmuseliigid on rakenduskihi whitelist;
- tabelisse ei lähe sündmuse vabateksti, e-kirja koopiaid ega tundlikku metadata-JSON-i;
- kasutaja kustutamisel rakenda põhjendatud cascade või dokumenteeritud anonümiseerimine;
- lisa päringuid toetavad indeksid: kasutaja + lugemata + aeg ning pending email delivery;
- migratsioon peab olema additiivne ja olemasolevate kasutajate jaoks ohutu;
- migratsioonil peab olema rollback-märkus, isegi kui Prisma ei genereeri automaatset rollback'i.

### 6.2 Kanalieelistus

Lisa minimaalne kasutajapõhine eelistus:

- platvormisiseseid märguandeid ei saa täielikult välja lülitada, kui need on tööjärje jaoks vajalikud;
- e-kirja saab kasutaja välja lülitada, välja arvatud juhul, kui olemasolev juriidiline/tooteleping nõuab konkreetset transaktsioonikirja;
- vaikimisi valik peab olema dokumenteeritud;
- eelistuse muutmine on ainult kasutaja enda toiming;
- eelistusse ei lisata esimese versiooniga sündmusetüüpide keerulist maatriksit, kui üks `emailEnabled` või kitsas kategooriajaotus täidab vajaduse.

Täpset skeemikuju otsusta aktiivse `User` ja preference-mustri põhjal pärast Etapp 0 kaardistust.

### 6.3 Teenusekiht

Loo üks keskne serveriteenus, mis:

- valideerib sündmuseliigi ja allikaliigi;
- loob või leiab idempotentselt sama sündmuse;
- ehitab sihtviite ainult allowlist'i järgi;
- ei võta caller'ilt kasutajale näidatavat teksti;
- ei loo sündmust inimesele, kellel pole sündmuse fakti suhtes õigust;
- võimaldab lugemata kokkuvõtet ning ühe või mitme sündmuse loetuks märkimist omanikuskoobis;
- ei tagasta sisemisi teiste kasutajate ID-sid;
- on testitav süstitud andmekihi ja kellaga.

Sündmus luuakse võimalusel samas tehingus ärisündmusega. Kui see pole välise süsteemi või olemasoleva piiri tõttu võimalik, kasuta püsivat reconcile/retry rada; ära kasuta protsessimälu ega „fire and forget” lubadust ainsa garantiina.

## 7. Etapp 2 — esimese versiooni sündmusetüübid (U1-B)

Vähemalt järgmised sündmused peavad olema kaetud:

| Sündmus | Adressaat | Deduplikatsiooni alus | E-kiri |
|---|---|---|---|
| Eelpöördumine saabus | platvormisisene adressaat | pöördumine + saatmisversioon | jah, ilma sisuta |
| Eelpöördumine võeti vastu või selle olek muutus saatjale oluliselt | autor | pöördumine + uus olek/versioon | tootelepingu järgi, minimaalselt |
| Ruumikutse | kutsutu | kutse ID või ruum + liikmelisuse versioon | jah, ilma ruumisisuta |
| Ruumi uus tegevus | aktiivne liige, mitte sündmuse tekitaja | ruum + adressaat + koondaken | koondatult, mitte iga sõnum eraldi |
| Sobitus tekkis | sobituse lubatud osapool | match ID + adressaat | jah või platvormisisene vastavalt aktiivsele lepingule |
| Järgmise kontakti tähtaeg | checklist'i omanik/spetsialist | objekt + kuupäev + adressaat | tähtajaline koond |
| Praktika ülevaatusülesanne või tähtaeg | määratud retsensent | assignment/audit-marker + adressaat | jah, ilma praktikatekstita |
| Kättesaadavuse värskendamise meeldetuletus | teenusekirje lubatud haldaja | teenusekirje + kontrolliperiood | jah, ilma privaatsete pöördumisteta |

Täpsed nimed kinnita aktiivse koodi järgi. Ära loo sündmust „igaks juhuks”. Igal sündmusel peab olema dokumenteeritud:

- tekitaja;
- adressaat;
- õiguse alus;
- idempotentsusvõti;
- loetuks saamise hetk;
- e-kirja poliitika;
- kustutamise või aegumise poliitika.

## 8. Etapp 3 — ohutu e-kirja kohaletoimetamine (U1-C)

Loo kitsas notification-delivery job olemasoleva job-route mustri järgi.

Nõuded:

- salajase võtme võrdlus kasutab olemasolevat fail-closed ja timing-safe mustrit;
- töö on partiipõhine, cursor'iga ja korduvalt ohutult käivitatav;
- sama sündmus ei saada topeltkirja ka paralleelse job'i korral;
- töö lease/claim või CAS takistab kahe töötleja võistlust;
- väliskutse kasutab timeout'i;
- katsetel on piir, backoff, `nextAttemptAt` ja ohutu `lastErrorCode`;
- logides ja job'i vastuses pole e-posti aadressi ega sündmuse tundlikku allikasisu;
- eelistuse muutmine enne saatmist peatab mittekohustusliku kirja;
- olematu/kustutatud adressaat lõpetab töö ohutult;
- dry-run ei saada ega muuda andmeid;
- töö vastus sisaldab ainult loendureid.

E-kirja tekst peab kasutama ET/EN/RU sõnumeid ning sisaldama ainult sündmuse üldist fakti ja platvormi turvalist sisselogimislinki.

## 9. Etapp 4 — teavituste lugemis-API ja märgid (U1-D)

Lisa väikseim API, mida vajavad tööruumi märgid ja „Jätka siit”:

- kasutaja lugemata sündmuste koond liikide või sihtkaartide kaupa;
- minimaalsed viimased sündmused ainult siis, kui „Jätka siit” neid päriselt vajab;
- omanikuskoobiga ühe sündmuse või allika sündmuste loetuks märkimine;
- serveripoolne lehekülg/limiit;
- kontrollitud 400/401/403/404/409 vead;
- cache'i vältimine kasutajapõhisel vastusel.

Eraldi teavituskeskuse lehte ei tehta. Kasuta olemasolevat `workspaceDashboardCards` badge-konksu ja quickbari tagasihoidlikku märki.

Märk peab olema tekstiliselt arusaadav ega tohi sõltuda ainult värvist. Ruumiline metafoor on „ukse alla lükatud kiri”, mitte häirete voog.

## 10. Etapp 5 — „Jätka siit” koond (U2-A)

### 10.1 Serveri koond

Loo üks kasutajapõhine koondteenus ja sellele sobiv endpoint või laienda olemasolevat tööruumi koond-API-t.

Esimese versiooni kandidaadid:

- kasutaja enda DRAFT-eelpöördumised;
- adressaadi READY/tegevust vajavad eelpöördumised;
- lugemata ühised ruumid;
- kasutaja enda kinnitamata Tööheaolu mustandid;
- kasutaja aktiivne Teekond;
- saabunud või lähenev järgmise kontakti tähtaeg;
- määratud Parimate praktikate ülevaatusülesanne;
- teenuseosutaja enda aegunud kättesaadavuse kinnitus.

Koond tagastab maksimaalselt seitse kirjet.

Iga kirje DTO sisaldab ainult:

- allowlist'itud `kind`;
- serveri loodud `href`;
- lokaliseeritavat oleku-/tegevusvõtit;
- ohutut kuupäeva;
- lubatud minimaalset esitlusinfot;
- deterministlikku järjestuse põhjust, mitte AI skoori.

Järjestus:

1. üle tähtaja tegevused;
2. kasutaja otsest tegevust vajavad uued sündmused;
3. lugemata ruumid;
4. lähenevad tähtajad;
5. mustandid ja aktiivne töö.

Sama prioriteedi sees kasuta stabiilset aega ja ID-d. Ära nimeta seda „kiireloomulisuse hinnanguks”.

### 10.2 Rollipiirid

- pöörduja näeb ainult enda mustandeid, osalusega ruume, enda Teekonda ja talle lubatud sündmusi;
- spetsialist näeb ainult talle saadetud või talle määratud tegevusi ja enda privaatseid mustandeid;
- teenuseosutaja näeb ainult enda hallatavate teenusekirjete tegevusi;
- admini roll ei saa selle endpoint'i kaudu vaikimisi kõigi inimeste isiklikku tööjärge;
- teenus kasutab samu omanikupiire nagu allikloendid, mitte laiemaid koondpäringuid.

## 11. Etapp 6 — „järgmine kontakt” (U2-B)

Laienda aktiivset receiver checklist'i väikseima ühilduva väljaga, eelistatult olemasolevas JSON-lepingus ja ilma migratsioonita, kui aktiivne mudel seda lubab.

Nõuded:

- kuupäev valideeritakse serveris range `YYYY-MM-DD` kalendrikuupäevana;
- väärtuse saab määrata ainult pöördumise lubatud vastuvõtja/tööplaani omanik;
- klient ei otsusta, kas tähtaeg on saabunud;
- muutmine on versioonikindel ja ei kirjuta paralleelset checklist'i üle;
- väärtuse eemaldamine lõpetab vana tulevikusündmuse või muudab selle mitteaktiivseks idempotentselt;
- kuupäeva muutmine ei tekita topeltmeeldetuletusi;
- kuupäev tõuseb „Jätka siit” koondisse ning loob U1 tähtajasündmuse;
- kuupäeva ei näidata pöördujale ega e-kirjas, kui aktiivne õiguse-/tooteleping seda ei luba;
- ajavöönd on serveris selgelt `Europe/Tallinn` või olemasolev rakenduse ajavöönd; UTC piirid dokumenteeritakse.

See ei ole kalender ega kohtumise broneering.

## 12. Etapp 7 — UI

UI muudatus on minimaalne ja kasutab olemasolevat tööruumi visuaalset grammatikat.

Kohustuslik:

- tööruumi ülaosas „Pooleli” / „Jätka siit” ala kuni seitsme kirjega;
- kaardid avavad täpse olemasoleva tööobjekti;
- tühiolek selgitab, et hetkel pole pooleliolevaid tegevusi;
- laadimis-, vea- ja tühiolek ei hüppa omavahel eksitavalt;
- badge'id olemasolevatel tööruumikaartidel;
- quickbari vaikne märgutuli, kui aktiivne disain seda toetab;
- järgmise kontakti kuupäeva sisestus ainult õige rolli tööplaanis;
- e-kirja eelistuse minimaalne lüliti kasutaja seadetes, kui Etapp 0 leiab sobiva olemasoleva koha;
- klaviatuur, fookus, ekraanilugeja tekst ja `prefers-reduced-motion`;
- märk ei tugine ainult värvile;
- ET/EN/RU täielik pariteet, uut hard-coded kasutajateksti ei lisata.

UI ei kuva tehnilisi sündmuseliike, sisemisi ID-sid, e-posti aadresse ega teise inimese identifikaatoreid.

## 13. Kohustuslikud testid

### 13.1 Sündmuse tuum

1. sama `dedupeKey` loob ühe sündmuse;
2. paralleelne loomine jätab ühe sündmuse;
3. tundmatu sündmuseliik lükatakse tagasi;
4. caller ei saa salvestada suvalist teksti ega URL-i;
5. sündmus läheb ainult õigele adressaadile;
6. võõras kasutaja ei näe ega märgi sündmust loetuks;
7. konto kustutamise leping töötab;
8. serializer ei väljasta teiste kasutajate sisemisi ID-sid ega e-posti.

### 13.2 E-kiri ja job

9. e-kiri ei sisalda pöördumise, ruumisõnumi, heaolumustandi ega praktikakandidaadi sisu;
10. eelistus `emailEnabled=false` peatab mittekohustusliku kirja;
11. retry ei saada pärast edukat claim'i sama sündmust kaks korda;
12. paralleelsed worker'id ei saada duplikaati;
13. timeout/backoff/max-attempts töötavad;
14. job'i vale või puuduv võti on fail-closed;
15. dry-run ei saada ega muuda ridu;
16. job'i vastus ja logid ei leki PII-d.

### 13.3 Sündmuse adapterid

17. saabunud eelpöördumine loob ühe adressaadisündmuse;
18. retry/topeltklikk ei dubleeri seda;
19. ruumi oma sõnum ei loo saatjale märguannet;
20. ruumi tegevus koondub, mitte ei tekita piiramatut kirjade voogu;
21. ruumi avamine/read-toiming lõpetab vastava lugemata märgi;
22. sobitus jõuab ainult lubatud osapooltele;
23. review-scheduler'i marker loob ühe õigesti skoopitud sündmuse;
24. U4 reminder loob sündmuse ainult teenusekirje lubatud haldajale.

### 13.4 „Jätka siit”

25. koondis on maksimaalselt seitse kirjet;
26. järjestus on deterministlik;
27. pöörduja ei näe teise inimese ega spetsialisti privaatset tööd;
28. spetsialist ei näe võõrast pöördumist;
29. teenuseosutaja ei näe võõrast teenusekirjet;
30. admin ei saa vaikimisi isiklikke tööjärgi;
31. DRAFT-pöördumine, READY-pöördumine, lugemata ruum, Tööheaolu mustand ja aktiivne Teekond käituvad lepingu järgi;
32. stale või kustunud sihtobjekt jäetakse koondist välja või kuvatakse ohutu aegunud tegevusena, mitte katkise lingina;
33. badge-loendurid vastavad serveri koondile.

### 13.5 Järgmine kontakt

34. ainult lubatud vastuvõtja saab kuupäeva määrata;
35. vigane või võimatu kuupäev annab kontrollitud 400;
36. stale checklist'i muutmine annab 409;
37. kuupäeva muutmine asendab vana tähtaja idempotentselt;
38. kuupäeva eemaldamine takistab tulevast märguannet;
39. tähtaja piir töötab valitud ajavööndis;
40. kuupäev ei leki rollile, kellel pole õigust seda näha.

### 13.6 Kliendileping

41. „Jätka siit” kirje avab õige marsruudi;
42. loetuks märkimise hiline vastus ei kirjuta uuemat UI olekut üle;
43. e-kirja eelistuse hiline vastus ei kirjuta uuemat valikut üle;
44. klaviatuuri/fookuse ja mitte ainult värviga badge'i leping on testitud vähemalt source-contract või DOM tasemel;
45. ET/EN/RU võtmete pariteet on kontrollitud.

Testide täpne jaotus võib aktiivse arhitektuuri järgi muutuda, kuid ükski ülaltoodud turva-, idempotentsus-, võistlus- ega rollijuhtum ei tohi kaduda.

## 14. Kontrollipakett

Iga vertikaali järel käivita sihttestid. Lõpus vähemalt:

- kõik uued U1/U2 sihttestid;
- `npm test`;
- `npm run i18n:check`;
- lint vähemalt kõigile muudetud failidele ning võimalusel kogu repo leping;
- `npx prisma validate`;
- `npx prisma generate`, kui skeem muutus;
- `npm run db:migrate:check`, kui skeem või migratsioon muutus;
- `npm run build`;
- `git diff --check`;
- autentimata runtime-smoke kõigile uutele API-dele ja job-route'ile;
- võimalusel autenditud brauseri-smoke vähemalt pöörduja ja spetsialisti vaates.

Kui mõni kontroll pole keskkonna tõttu võimalik, ära nimeta seda läbituks. Kirjuta täpne piirang ja asenduskontroll.

Olemasolevad hoiatused võrdle lähtebaasiga. Uusi vigu ega uusi põhjendamata hoiatusi ei lisata.

## 15. Teostuse kontrollpunktid ja commit'id

Soovituslikud eraldi kontrollpunktid:

1. Etapp 0 kaardistus ja lõplik skeemiotsus;
2. U1-A sündmuse tuum + migratsioon + teenusetestid;
3. U1-B sündmuse adapterid;
4. U1-C e-kirja delivery job;
5. U1-D API + badge'id;
6. U2-A „Jätka siit” server + UI;
7. U2-B järgmise kontakti väli + tähtajasündmus;
8. konsolideeritud regressioon ja üleandmine.

Ära tee läbipaistmatut ühte hiigelcommit'i. Samas ära push'i ega merge'i enne, kui kasutaja antud töökorraldus seda lubab. Deploy on alati eraldi selge loaga samm.

## 16. Opuse sõltumatu järelkontroll

Opus peab pärast Soli teostust tegema read-only auditi vähemalt järgmiste nurkade alt:

1. kõigi sündmusetüüpide adressaadi- ja õigusearvutus;
2. tundliku sisu puudumine DB-st, serializer'ist, e-kirjast ja logist;
3. idempotentsus topeltkliki, route-retry ja paralleelse worker'i korral;
4. e-kirja claim/CAS ja crash-after-send risk;
5. ruumisõnumite koondamise ning read-state'i kooskõla;
6. checklist'i concurrent update ja tähtaja ajavöönd;
7. „Jätka siit” ristmooduli päringu omanikuskoobid;
8. stale/kustunud objektide käitumine;
9. konto kustutamine;
10. job-route fail-closed autentimine;
11. U4, U8-lite, U12/U3 ja Parimate praktikate scheduler'i regressioonid;
12. migratsiooni deploy-ohutus ja indeksid.

Verdikt on üks kolmest:

- `OPUS HEAKS KIIDETUD`;
- `OPUS PARANDUSED VAJALIKUD`;
- `OPUS BLOKEERITUD`.

P0/P1 leid peatab merge'i ja järgmise uue paketi. P2 võib jääda teadlikuks follow-up'iks ainult siis, kui mõju ja otsus on dokumendis ausalt kirjas.

## 17. Valmisoleku definitsioon

Pakett on valmis ainult siis, kui:

- püsiv sündmusemudel ja migratsioon on rakendatavad;
- vähemalt tabelis §7 loetletud sündmused on ühendatud või konkreetne erand on kasutaja poolt otsustatud;
- e-kirjad on minimaalsed, eelistust austavad ja retry-kindlad;
- tööruumi märgid kasutavad päris sündmusi;
- „Jätka siit” näitab kuni seitset õigesti skoopitud tegevust;
- järgmise kontakti kuupäev toimib versiooni- ja ajavööndikindlalt;
- ET/EN/RU on täielikud;
- kogu kontrollipakett on roheline;
- progressipäevik ja üleandmine on täidetud;
- Opuse sõltumatu P0/P1 audit on suletud;
- commit/push/merge/deploy seis on üheselt dokumenteeritud.

## 18. Progressipäevik

### 2026-07-14 — pakett valitud ja tööplaan loodud

- Fable'i järgmise arenduspaketina lukustatud U1 + U2.
- Põhjendus: U1 on suurim allesjäänud süsteemne alusauk; U2 annab sellele kohe nähtava igapäevase väärtuse.
- Teostust ei alustatud.
- Koodi, skeemi, migratsioone ega teste ei muudetud.
- Põhitööpuus on teise paketi commit'imata muudatusi; käesoleva dokumendi loomisel neid ei puudutatud ega stage'itud.

### Etapp 0 — täidab teostaja

- Kuupäev:
- Teostaja/mudel/effort:
- Lähteharu ja commit:
- `origin/main` seis:
- Aktiivsed sõltuvusharud:
- Kaardistatud sündmuste tekitajad:
- Valitud skeem ja miks:
- Dokumendi ja koodi lahknevused:
- Blokeerijad:
- Järgmine täpne samm:

### Teostuse kontrollpunkt — täidab teostaja iga etapi järel

- Etapp:
- Muudetud failid:
- Valmis funktsioonid:
- Tehtud testid ja tulemused:
- Teadlikud piirangud:
- Commit/push/deploy seis:
- Järgmine täpne samm:

## 19. Lõppüleandmise mall

Täida töö lõpus:

- **Verdikt:** SOL VALMIS / PARANDUSED VAJALIKUD / BLOKEERITUD
- **Mudel ja effort:**
- **Baas ja lõpp-HEAD:**
- **Muudetud failid:**
- **Migratsioonid:**
- **Sündmuseliigid:**
- **Rolli- ja privaatsusleping:**
- **Idempotentsus- ja võistlusgarantiid:**
- **E-kirja kohaletoimetamise leping:**
- **„Jätka siit” allikad ja järjestus:**
- **Järgmise kontakti leping:**
- **Sihttestid:**
- **Täiskontroll:**
- **Ajamata kontrollid ja miks:**
- **Teadlikud follow-up'id:**
- **Kõrvalised failid, mida ei puudutatud:**
- **Commit/push/merge/deploy seis:**
- **Opusele auditeerimiseks vajalikud riskikohad:**

## 20. Fable'i U1–U12 põhinimekirja jälgimine

U1 + U2 ei ole eraldiseisev lõpp-punkt. Edaspidi mõõdetakse arenduse edenemist kogu Fable'i U1–U12 ideenimekirja vastu.

Igas järgmises tööplaanis, progressiraportis ja üleandmises tuleb uuendada vähemalt:

- iga U-töö sisuline seis;
- haru ja commit, kui teostus on alanud;
- kas töö on Soli poolt valmis;
- kas Opuse sõltumatu audit on läbitud;
- kas töö on `main`-i ühendatud;
- kas töö on deploy'itud või ainult koodina valmis;
- blokeerija või järgmine konkreetne samm.

### 20.1 Ühtne staatusemudel

Kasuta ühte neist seisunditest:

1. `TEOSTAMATA`;
2. `TÖÖPLAAN VALMIS`;
3. `ARENDUS KÄIB`;
4. `SOL VALMIS`;
5. `OPUS PARANDUSED VAJALIKUD`;
6. `OPUS HEAKS KIIDETUD`;
7. `MAIN-IS`;
8. `DEPLOY'ITUD`.

„Kood on olemas” ei võrdu „lõpetatud”. Lõpliku valmiduse protsendis loetakse töö 100% valmis alles siis, kui nõutud audit on läbitud ja töö on `main`-i ühendatud. Deploy seisu näidatakse eraldi.

### 20.2 Hetkeseis 2026-07-14 — **OPUSE KONTROLLITUD KOONDSEIS**

> Uuendatud 2026-07-14 Opus 4.8 (Extra) poolt pärast sõltumatut read-only auditit `main` @ `df2f45c0` + commit'imata P1 diff `b6847805` vastu. Iga rida on kas koodist kontrollitud või on kontrollimata seis eraldi välja öeldud. Tõendid: doc 09 §8 (U3/U12 audit), doc 11 (U4 audit), doc 12 (U8-lite audit), doc 13 §11–§13 (U1/U2 + U5/U6/U7/U9/U11).
>
> **Integratsiooni- ja deploy-järgne lepitus:** Opuse auditi ajalooline tõendibaas jääb ülal muutmata. Pärast auditit ühendas Sol kasutaja loal U3/U12, P1, U8-lite ja U4 paketi `main`-i ning deploy'is rakenduse. Rakendusintegratsiooni dokumenteeritud `main`-seis on `fb8809a6`; produktsiooni rakenduskood vastab commit'ile `22958456` (`fb8809a6` on ainult dokumentatsioon). Täpne kontrollpakett on doc 14-s.

| ID | Fable'i võimalus | Hetkeseis | Kontrollitud? | Järgmine samm |
|---|---|---|---|---|
| U1 | Sündmuse- ja teavituskiht | **TÖÖPLAAN VALMIS + ETAPP 0 VALMIS** | jah (doc 13) | U3+P1 integratsioon on tehtud; sulgeda esmalt `SOL-U1U2-P1-1` ja `OPUS-U1U2-P1-2` |
| U2 | „Jätka siit” + järgmine kontakt | **TÖÖPLAAN VALMIS + ETAPP 0 VALMIS** | jah (doc 13) | `nextContactOn` skeemiotsus tehtud; blokeerib `SOL-U1U2-P1-1` (serializer) + puuduv versioonivalve |
| U3 | Saadetud pöördumise tagasivõtmine ja parandamine | **OPUS HEAKS KIIDETUD — MAIN-IS + DEPLOY'ITUD** (allikas `d2dd13e3`) | jah (doc 09 §8) | jälgida regressioone U1 sündmuseadapteri juures |
| U4 | Kättesaadavuse ja ooteaja signaal + värskuskinnitus | **SOL PARANDATUD — KASUTAJA AKTSEPTEERIS ILMA KORDUSAUDITITA — MAIN-IS + DEPLOY'ITUD** (allikas `a3529ac0`) | esmane audit jah (doc 11); parandused kasutaja aktsepteeritud | otsustada enne U1-B-d, kas U4 või U1 omab kättesaadavuse kirja |
| U5 | Teenusepuudujäägi märge ja anonüümne koond | **TEOSTAMATA** | jah — `ServiceGapReport` = 0 vastet | U4 sõltuvus on täidetud; järgmine blokeerija on k-läve tooteotsus |
| U6 | Isiklik otsing enda objektide üle | **TEOSTAMATA** | jah — GET-il pole `q`; `ChatSidebar:626–633` on klient-filter | **Opus tõstab prioriteeti:** praegune filter annab vale negatiivse (otsib ainult 1. lehte, vaikimisi 30) |
| U7 | Selge keele režiim | **TEOSTAMATA — järgmine esmane kandidaat** | jah — `plainLanguage` = 0 vastet; `tone="plain"` alus olemas | **Opuse sisend valmis** (doc 13 §13); võib alata **U1/U2-st sõltumatult** |
| U8 | Allika-tagasiside silmus | **SOL PARANDATUD — KASUTAJA AKTSEPTEERIS ILMA KORDUSAUDITITA — MAIN-IS + DEPLOY'ITUD** (allikas `02f40a21`) | esmane audit jah (doc 12); parandused kasutaja aktsepteeritud | U8-P2-1 jääb teadlikuks tooteotsuseks |
| U9 | Tugiisiku kaasamise rada | **TEOSTAMATA** (mehhanism olemas, U9-spetsiifiline võimekus puudub) | jah — kutse-POST ei saada `relationship_type` | **Opuse lahknevus:** `Invite.relationshipType` on tarbijata väli → U9 v1 väärtus on **ainult copy/UX** |
| U10 | Kohtumise kokkuvõte pöördujale | **MAIN-IS + DEPLOY'ITUD** | **ei — selles ringis Opuse poolt üle kontrollimata** | jälgida regressioone U1 digest-adapteri juures |
| U11 | Töö üleandmine kolleegile | **TEOSTAMATA** | jah — owner on dubleeritud (`Room.ownerId` + `RoomRole.OWNER`); `assertRecipientChangeAllowed:803` blokeerib | **sõltub U1-st**; „kaks PATCH-i" hinnang on vale — vajab tooteotsust ruumiligipääsu kohta |
| U12 | „Minu jagamised” läbipaistvusvaade | **OPUS HEAKS KIIDETUD — MAIN-IS + DEPLOY'ITUD** (allikas `d2dd13e3`) | jah (doc 09 §8) | regressioonijälgimine |

**Opuse märkus §20.1 staatusemudeli kohta:** mudelis puudub „osaliselt olemas" seis. U9 on formaalselt `TEOSTAMATA` (U9-spetsiifilist võimekust ei tarni), kuigi selle alusmehhanism (kutse → ruum) töötab. Kui seda vahet on vaja jälgida, tuleb mudelisse lisada üheksas seis; praegu on see kirjas veerus „Järgmine samm".

### 20.3 Protsendi esitamise reegel

Edaspidi esita alati kaks eraldi näitajat:

1. **funktsionaalne valmidus** — kui palju U1–U12 sisust on koodina teostatud;
2. **lõplik valmidus** — kui palju on nõutud auditi läbinud ja `main`-i ühendatud.

Ära liida deploy'd samasse protsenti. Deploy on eraldi seis, sest kasutaja selge loata seda ei tehta.

Kui kasutatakse ligikaudset protsenti, lisa alati juurde, millised U-tööd on:

- valmis;
- osaliselt valmis;
- teostamata.

Nimekirja liikmed ei ole töömahult võrdsed. Seetõttu on „5 tööd 12-st” ainult katvuse näitaja, mitte täpne kulutatud töötundide protsent. Vajadusel anna nii lihtne U-katvus kui ka töömahuga kaalutud hinnang.

### 20.4 Progressihinnang 2026-07-14 — **OPUSE ARVUTUS + INTEGRATSIOONIJÄRGNE LEPITUS**

> Koostatud §20.3 reegli järgi: kaks eraldi näitajat, deploy eraldi, ligikaudse protsendi juurde kuulub alati jaotus.

**1. Funktsionaalne valmidus (kood olemas, sõltumata auditist ja merge'ist): ≈ 46 %** (5,5 / 12)

Loeb: U3, U4, U8, U10, U12 = 5 tervikuna; U9 = 0,5 (alusmehhanism töötab, U9-spetsiifiline võimekus puudub). Kõik ülejäänud = 0.

**2. Lõplik valmidus (nõutud kontroll läbitud või kasutaja erandina aktsepteeritud JA `main`-is): ≈ 42 %** (5 / 12)

Loeb **U3, U4, U8, U10 ja U12**. U3/U12 on Opuse heakskiiduga; U4/U8 puhul kehtib dokumenteeritud kasutaja otsus võtta Soli sihitud parandused vastu ilma uue täismahus kordusauditita. See erand ei muuda neid märgendiks `OPUS HEAKS KIIDETUD`, kuid lubab need koondseisus lõplikuks lugeda.

**Deploy: 5 / 12 (≈ 42 %)** — U3, U4, U8, U10 ja U12 on produktsioonis. P1 operatsioonipakett on samuti deploy'itud, kuid ei ole U1–U12 loendi eraldi liige.

**Jaotus:**

- **Valmis ja deploy'itud:** U3, U12 (Opus heaks kiidetud) · U4, U8 (kasutaja aktsepteeris ilma kordusauditita) · U10.
- **Koodina valmis, kuid merge'imata:** puudub.
- **Osaliselt:** U9 (kutse→ruum mehhanism olemas; puudub CLIENT-semantika ja scope-selgitus).
- **Teostamata:** U1, U2 (tööplaan + Etapp 0 valmis, koodi ei ole), U5, U6, U7, U11.

**Integratsioonijärgne järeldus:** Opuse tuvastatud integratsioonipudelikael on U3/U4/U8/U12 ja P1 jaoks kõrvaldatud. Funktsionaalse ja lõpliku valmiduse vahe on nüüd umbes 4 protsendipunkti ning järgmine suurim sisuline lünk on U1/U2 teostus. U7 võib eraldi harul sõltumatult alata, kuid ei asenda U1/U2 kinnitatud P1-eeltingimuste sulgemist.

**Töömahuga kaalutud hoiatus (§20.3 nõue):** lihtne U-katvus **ülehindab** edenemist, sest suurim allesjäänud töö — **U1** (püsiv sündmusekiht + delivery job + adapterid + koond + UI; doc 10 §15 järgi kaheksa kontrollpunkti) — on 0 %. Väikesed tööd (U6, U7, U9) on odavad, U5/U11 keskmised. Kaalutud hinnanguna on tegelik edenemine **madalam kui 46 %**; täpset kaalu ei ole mõtet välja mõelda enne, kui U1 tööplaan on teostuseks lahti kirjutatud.

---

## 21. Järgmine pakett pärast U1 + U2

Kui U1 + U2 on Soli poolt lõpetatud, Opuse poolt P0/P1 osas heaks kiidetud ja sihtharusse ühendatud, on järgmine esmane kandidaat:

**U7 — lihtsa ja selge keele režiim.**

U7 ei kuulu käesoleva paketi skoopi ning sellele koostatakse eraldi tööplaan pärast U1 + U2 lõpetamist.

---

## 22. SOL — U1 + U2 TEOSTUS VALMIS, OOTAB OPUSE SÕLTUMATUT AUDITIT (2026-07-14)

### 22.1 Haru, baas ja kontrollpunktcommit'id

- eraldi worktree: `C:\Users\rauds\Desktop\SotsiaalAI-u1-u2`;
- haru: `codex/u1-u2-events-continuity`;
- värske baas: `origin/main` @ `87a8f7cb`;
- P1-eeltingimused (serializer + receiver-workflow CAS + mailer fail-closed): `30faf508`;
- U1 püsiv sündmuse-, adapteri- ja delivery-vertikaal: `8e479886`;
- U2 „Jätka siit” + järgmine kontakt + UI: `0afc2ff1`;
- põhitööpuud teostuse ajal ei vahetatud ega kasutatud arenduseks.

Seis: **SOL VALMIS**. Haru ei ole `main`-i ühendatud ega deploy'itud. Järgmine
lubatud samm on Opuse §16 read-only P0/P1 audit selle haru vastu.

### 22.2 Skeem ja migratsioon

Additiivne migratsioon:
`prisma/migrations/20260715120000_u1_u2_notification_continuity/migration.sql`.

- uus `NotificationEvent`, millel ei ole vabateksti ega metadata-JSON-i;
- adressaat kustub konto kustutamisel `ON DELETE CASCADE` abil;
- unikaalne `dedupeKey`;
- kasutaja/lugemata/aja, source-read ja delivery indeksid;
- püsiv delivery-seis: policy, status, attempts, next attempt, claim, sent time,
  ohutu error code ja stabiilne Message-ID;
- `User.notificationEmailEnabled` on nullable ning vaikimisi `null` = valikuline
  e-kiri **väljas**; CAS-i versioon on `notificationPreferenceVersion`;
- `PreInquiry.nextContactOn` on range kuupäevastring ning receiver-skoobis;
- rollback-märkus on migratsioonis; rakenduse rollback on additiivsete väljade
  allesjätmisel ohutu.

### 22.3 Sündmused, adressaadid ja kanalipoliitika

| Sündmus | Õigus/allikas | Dedupe | E-kirja omanik |
|---|---|---|---|
| saabunud eelpöördumine | värske `recipientOwnerId`, recall puudub | pöördumine + `sentAt` | olemasolev transaktsioonikiri; U1 ei dubleeri |
| eelpöördumise oluline olek | pöördumise autor | olek + versioon | U1 optional |
| ruumikutse | konto värske e-post = aktiivse kutse adressaat | invite ID + sent | olemasolev kutsekiri; U1 ei dubleeri |
| ruumi tegevus | aktiivne liige, mitte akna sõnumite autor | ruum + adressaat + 6 h UTC aken | U1 optional digest |
| abisobitus | ainult `requesterId`/`offererId` | match + adressaat | aktiivne abisobituse leping; U1 platvormisündmus |
| järgmine kontakt | pöördumise receiver/workflow omanik | pöördumine + kuupäev | U1 optional |
| praktika ülesanne/tähtaeg | assignment'i värske reviewer | assignment + marker | U1 optional |
| kättesaadavuse värskus | teenuseprofiili värske omanik | teenus + kontrolliperiood | **U4 legacy reminder**, U1 `NONE` |

Kättesaadavuse kirja omanikuks jäi selles paketis teadlikult U4. U1 loob sama
fakti kohta ainult platvormisisese sündmuse. Nii ei teki kahte kirja ega muudeta
U4 `availabilityReminderSentAt` lepingut auditita. Opus peab selle otsuse §16
auditil eraldi üle vaatama.

Iga `createNotificationEvent` kontrollib enne kirjutamist allikobjektist uuesti
adressaati ja source/target allowlist'i. Caller ei saa sisestada sündmuseteksti,
URL-i ega Message-ID-d. Lugemis-API kontrollib nii event-owner'it kui ka allika
värsket ligipääsu; stale/kustunud allikas jäetakse vastusest välja.

### 22.4 Idempotentsus, scheduler ja delivery

- DB unikaalsus sulgeb sama `dedupeKey` paralleelse loomise;
- reconcile kasutab iga allikamudeli jaoks stabiilset ID-cursor'it ja kuni 100
  piiratud lehte, mitte muutuvat offset'i;
- room activity koondub 6-tunnisesse aknasse ja saatja ei ole adressaat;
- delivery valib stabiilses ID-järjekorras, claim'ib `updateMany` CAS-iga ning
  ainult claim'i võitja saadab;
- crash pärast võimalikku SMTP vastuvõttu ei põhjusta pimesi kordussaatmist:
  aegunud `SENDING` muutub `UNKNOWN`-iks;
- enne optional saatmist loetakse kasutaja eelistus värskelt;
- timeout 15 s, max 3 katset, eksponentsiaalne piiratud backoff;
- olematu adressaat ja transpordi puudumine lõpetavad ohutu olekuga;
- dry-run ei saada ega kirjuta;
- job-route kasutab puuduva võtme korral fail-closed timing-safe kontrolli ning
  tagastab ainult loendurid, mitte e-posti, source ID-sid ega cursoreid;
- e-kiri kasutab ET/EN/RU kataloogi, üldist sündmusefakti ja platvormi
  sisselogimislinki; tööobjekti sisu sinna ei lähe.

Pärast auditit vajab server:

- 256-bitist juhuslikku `NOTIFICATION_JOB_KEY` väärtust;
- soovi korral `NOTIFICATION_JOB_BATCH_SIZE=40`;
- olemasolevat korrektset `APP_URL`/`NEXTAUTH_URL` ja SMTP seadistust;
- perioodilist `npm run notifications:dispatch` käivitust. Timerit ja env-i ei
  lisatud enne auditit ning deploy'd ei tehtud.

### 22.5 API, märgid ja „Jätka siit”

- `GET/PATCH /api/notifications`: owner-skoobiga nimekiri, badge'id ja read-state;
- `GET/PATCH /api/notifications/preferences`: ainult konto omanik, version-CAS;
- `GET /api/workspace/continuity`: ainult sessiooni kasutaja, private no-store;
- `POST /api/jobs/notifications`: secret-gated reconcile + delivery;
- room read uuendab samas tehingus `lastReadAt` ja vastava U1 source-read'i;
- badge-konks kasutab tegelikke serveriloendureid ning numbriline märk on
  tekstiline/ruumiline, mitte ainult värv;
- „Jätka siit” tagastab kuni 7 allowlist'itud DTO-d ilma vabateksti ja PII-ta;
- järjestus: üle tähtaja kontakt, praktikaülesanne, saabunud pöördumine,
  lugemata ruum, lähenev kontakt / stale service, mustandid ja aktiivne Teekond;
- sama href deduplitakse kõrgema prioriteedi kasuks;
- admin ei saa endpoint'i kaudu valida teise inimese `userId`-d.

UI-l on laadimis-, vea- ja tühiolek, klaviatuurifookus, reduced-motion leping,
serveri loodud kohalikud teed ning request-ID valvur, et hiline preference-vastus
ei kirjutaks uuemat olekut üle. ET/EN/RU võtmed on pariteedis.

### 22.6 Järgmine kontakt

- ainult aktiivne platform-recipient saab receiver-workflow route'i kaudu muuta;
- server aktsepteerib ainult tegelikku `YYYY-MM-DD` kalendrikuupäeva või tühja
  väärtust;
- sama `expectedUpdatedAt` CAS kaitseb checklist'i, märget, staatust ja kuupäeva
  ühe ühise stale-write'i eest;
- autorile, kõrvalisele kasutajale ja fail-closed serializerile kuupäeva ei anta;
- muutmisel/eemaldamisel suletakse vana lugemata sündmus ja pending email samas
  tehingus olekuga `CANCELLED`;
- uus tähtaeg saab dedupe-võtmesse kuupäeva ning server võrdleb seda
  `Europe/Tallinn` kalendripäevaga;
- UI kuupäevaväli on ainult receiver-workflow plokis.

### 22.7 Kontrollipakett

Läbitud:

- U1/U2 sihttestid koos P1-regressioonidega: **43/43**;
- kogu `npm test`: **1222/1222**;
- `npm run i18n:check`: ET/EN/RU pariteet korras;
- muudetud failide lint: 0 viga;
- kogu `npm run lint`: 0 viga, **359 varasemat repo hoiatust**;
- `npx prisma validate`: korras;
- `npx prisma generate`: korras;
- `npm run css:budget`: **52/52**;
- `npm run build`: tootmisbuild korras, kõik uued route'id buildis;
- `git diff --check`: korras;
- autentimata runtime-smoke: notifications GET/PATCH, preferences GET,
  continuity GET ja job POST andsid kõik **401** enne andmepäringut.

Keskkonnapiirangud, mida ei nimetata läbituks:

- `npm run db:migrate:check` käivitus, kuid lokaalses worktree's ei olnud päris
  DB mandaati; dummy ühendus jõudis PostgreSQL-i ja lõppes `28P01` auth-veaga;
- autenditud pöörduja/spetsialisti brauserisuitsu ei tehtud, sest sellel puhtal
  worktree'l ei olnud kasutajasessiooni;
- produktsioonimigratsiooni, env-i, timerit ega deploy'd ei tehtud enne auditit.

### 22.8 Täpne jätkamispunkt Opusele

Auditeeri `codex/u1-u2-events-continuity` tervikuna, baasiga `87a8f7cb`, eelkõige:

1. `lib/notifications.js` värske source-owner kontroll kõikidele tüüpidele;
2. `lib/notificationReconciler.js` stabiilne multi-model cursor, ruumi 6 h koond
   ja saatja välistamine;
3. `lib/notificationDelivery.js` claim/CAS, `UNKNOWN` crash-semantika, värske
   opt-out ja PII-vaba e-kiri/logi;
4. U4 kui kättesaadavuskirja ainus omanik;
5. kutse sündmuse target pärast kutse vastuvõtmist/aegumist;
6. room read + notification read sama tehing;
7. next-contact CAS, cancellation ja Tallinn day-boundary;
8. continuity kõigi seitsme päringu omanikuskoobid ja stale-target käitumine;
9. konto kustutamise cascade;
10. migratsiooni päris DB deploy-check ja indeksid.

P0/P1 leid peatab merge'i. Heakskiidu järel: fast-forward/merge haru `main`-i,
käivita päris `prisma migrate deploy`, lisa serveri env + perioodiline job,
tee autenditud kahe rolli smoke, seejärel deploy ja uuenda käesoleva doki
commit/main/deploy seisu. Alles pärast seda on järgmine pakett U7.

### 22.9 U1–U12 koondseis pärast Soli teostust

- funktsionaalne valmidus: ligikaudu **62,5%** (U1, U2, U3, U4, U8, U10,
  U12 + U9 alus 0,5);
- lõplik valmidus: endiselt ligikaudu **42%**, sest U1/U2 audit ja merge puuduvad;
- deploy: endiselt **5/12**; U1/U2 ei ole produktsioonis;
- U1 ja U2 staatus: **SOL VALMIS — OOTAB OPUSE AUDITIT**;
- järgmine teostus pärast auditit ja integratsiooni: **U7**.

---

## 23. OPUSE SÕLTUMATU AUDIT — U1/U2 (2026-07-14)

> **VERDIKT: `OPUS HEAKS KIIDETUD`** — P0 puudub, P1 puudub. Merge on lubatud.
> Üksteist P2-d on kirjas allpool; ükski ei blokeeri, aga kaks väärivad parandust enne kui e-kirjad kasutajatele sisse lülitatakse.
> **Üks värav jääb lahtiseks:** §22.8 p10 (päris DB migratsioonikontroll) — vt §23.5.

- Auditeeritud: `codex/u1-u2-events-continuity` @ `4d81eaab`, baas `main` @ `87a8f7cb`. Read-only.
- Mudel/effort: Opus 4.8, Extra (xhigh).
- Jooksutasin ise: sihttestid **122/122**, kogu repo `npm test` **exit 0**.

### 23.1 Mõlemad P1-eeltingimused on SULETUD (kinnitatud koodist)

**`SOL-U1U2-P1-1` + `OPUS-U1U2-P1-1-EXT` — suletud.** `serializePreInquiry(inquiry, { viewerId })`; `receiverNote`/`receiverChecklist`/`nextContactOn` ainult `isRecipient` korral. Minu EXT on lahendatud **rangemalt kui nõudsin**: kumbki pool näeb ainult **oma** e-posti (`isAuthor`/`isRecipient` väravad). Kontrollisin lisaks: (a) `viewerId = null` vaikeväärtus on **fail-closed**; (b) **iga** kutsuja annab `viewerId` (0 erandit); (c) ükski kood ei loe `author.email`/`recipientOwner.email` → **regressiooni ei teki**. Regressioonitest `tests/preInquiries/audienceSerialization.test.js` olemas.

**`OPUS-U1U2-P1-2` — suletud.** `createTransporter`: prod ilma SMTP-ta → `createUnavailableTransporter()` → `sendMail` viskab `EmailTransportUnavailableError` (`retryable: false`). Dev-mock nõuab **explicit `EMAIL_DEV_MOCK`** ja on prod-is võimatu. Mock logib ainult loendureid — kogu sõnumi logimine kadus. Boonus: `normalizeMessageId` valideerib **CRLF-i vastu** (päise-injektsiooni kaitse).

**Kõik neli minu §11.3 skeemiparandust on rakendatud:** `occurredAt` eemaldatud; `emailClaimToken` eemaldatud; kolmas indeks on **täpselt** `[userId, sourceType, sourceId, readAt]` (allika-põhine, nagu nõudsin); `emailMessageId` jäi ja mailer aktsepteerib kutsuja ID-d.

**Minu „kaks saatjat" leid on lahendatud:** `SERVICE_AVAILABILITY_STALE` → `emailPolicy: "NONE"` → **U4 jääb kättesaadavuskirja ainsaks omanikuks**. Sama muster katab `PRE_INQUIRY_ARRIVED`, `ROOM_INVITE`, `HELP_MATCH_CREATED` → ükski olemasolev kiri ei dubleeru.

### 23.2 §22.8 punktid 1–9 — kontrollitud

| # | Nõue | Tulemus |
|---|---|---|
| 1 | värske source-owner kontroll kõigile tüüpidele | ✅ 9/9 tüübist loeb adressaadi **allikobjektist**, mitte kutsujalt; fail-closed (`allowed = false` → 404) |
| 2 | stabiilne cursor, 6 h koond, saatja välistamine | ✅ keyset-cursor kõigil; saatja välistatud; **6 h aknal on P2-defekt (vt 23.3-1)** |
| 3 | claim/CAS, UNKNOWN, värske opt-out, PII-vaba | ✅ CAS enne saatmist (`count !== 1 → continue`); `UNKNOWN` on **terminaalne** (ei ole ühtegi requeue-teed); eelistus loetakse **pärast claim'i, vahetult enne saatmist**; logides ja vastuses ainult loendurid |
| 4 | U4 kui kättesaadavuskirja ainus omanik | ✅ vt 23.1 |
| 5 | kutse target pärast vastuvõtmist/aegumist | ✅ kontroll nõuab `status: "SENT"` + **värsket konto e-posti**; aegunud/vastuvõetud kutse sündmus kaob lugemisel |
| 6 | room read + notification read samas tehingus | ✅ `prisma.$transaction` katab mõlemad (`read/route.js:147–161`), tagasiliikumise klamber säilis |
| 7 | next-contact CAS, cancellation, Tallinn boundary | ✅ `sameUpdatedAtFingerprint` + `expectedUpdatedAt`; `tallinnDate` kasutab `Intl.DateTimeFormat` + `formatToParts` → **DST-kindel** |
| 8 | continuity omanikuskoobid ja stale-target | ✅ **kõik 7 päringut on omanikuskoobis**; ristkasutaja lekke ei leidnud; admin ei saa võõrast tööjärge (route võtab ainult `session.user.id`); DTO kannab ainult `{kind, id, href, labelKey, date, overdue}` — vabateksti ei ole |
| 9 | konto kustutamise cascade | ✅ `onDelete: Cascade` → `deleteUserAfterFinalPracticeSweep`'i `tx.user.delete` hävitab read |

### 23.3 P2 leiud (ei blokeeri merge'i; **1 ja 2 soovitan parandada enne e-kirjade sisselülitamist**)

1. **Ruumi 6 h aken võib anda ühe sõnumi kohta kaks sündmust.** `roomWindow` on **fikseeritud UTC-ämber** (00/06/12/18), aga skann on **libisev** `now − 6 h` (`notificationReconciler.js:14–17` vs `:43`). Sõnum kell 11:30 UTC → tick 11:35 (ämber T06) loob sündmuse #1; tick 12:05 (sõnum on veel aknas, ämber T12) loob #2 — erinev `dedupeKey`, seega DB ei püüa. Piiritletud 2×-ga (mitte piiramatu voog), seega leping „koondub" on sisuliselt täidetud, kuid **§22.4 „koondub 6-tunnisesse aknasse" on rikutud**. Täna on mõju ainult topelt-badge, sest e-kirjad on vaikimisi väljas.
2. **„Lähenev järgmine kontakt" ei jõua kunagi ekraanile.** `workspaceContinuity.js:145–170` lisab ühele pöördumisele **kaks kandidaati sama `href`-iga**: `next_contact` (prioriteet 4, kui pole üle tähtaja) ja `pre_inquiry_received` (prioriteet 2). Dedupe (`:241–246`) jookseb **pärast sortimist** → p2 võidab alati → `workspace_continuity.next_contact_upcoming` on **surnud i18n-võti** ja §10.1 järjestusreegel 4 („lähenevad tähtajad") ei käivitu kunagi. Ainult `overdue` (p0) jõuab kohale. Kirje ise ei kao (kuvatakse „pre_inquiry_received"-ina), seega valeinfot ei teki.
3. **Reconciler skannib `matches`/`assignments`/`services` iga käivitusega id 0-st**, ilma aja- või staatusepiiranguta; cursor on päringu-lokaalne (`route.js:38`), lehepiir 100. Kui kõlblik hulk ületab ~`batchSize × 100`, jääb saba **jäädavalt** sündmusteta. Signaliseeritud `truncated: true`-ga. Pilootmahus ei avaldu.
4. **`emit`-il puudub try/catch** → üks võistlev rida (nt vahepeal tagasi võetud pöördumine) laseb **kogu ticki 500-ga põhja**. Ise-tervenev (järgmine tick õnnestub), aga habras.
5. **Lease-taaste võib üle kirjutada elava claim'i** (`notificationDelivery.js:77–80`): puudub kaitse värskete claim'ide vastu, seega paralleelne worker võib märkida saadetava rea `UNKNOWN`-iks; saatja terminaalne CAS ei taba ridu, kuid `counters.sent += 1` jookseb ikka. **Duplikaatkirja ei teki** (`UNKNOWN` on terminaalne).
6. **Loendureid ei väravata CAS-tulemusega** (`:126/:134/:157/:169`) → job'i JSON võib üle raporteerida.
7. **`targetId` ei ole 4 tüübi puhul allikobjektiga seotud** (`notifications.js:114–136`) — ainult kuju- ja liigikontroll. **Ei ole ekspluateeritav:** `createNotificationEvent` on kutsutud ainult `notificationReconciler.js:53`-st ja ükski route ei loo sündmusi kasutaja bodyst. Kaitsekihi auk, mitte haavatavus.
8. **`verifyRecipient` on väljalülitatav** (`:179`, `:197`), kuigi dok ütleb „iga create kontrollib". Vaikeväärtus on turvaline, ükski kutsuja ei kasuta seda.
9. `emailLastErrorCode` taandub SMTP-vigadel alati `"ERROR"`-iks (mailer viskab `.code`-ta vigu) → diagnostiline väärtus kaob (turvalisus säilib).
10. `HELP_MATCH_CREATED` ignoreerib `HelpMatchStatus`-t ja ruumi liikmelisust → ruumist eemaldatud kasutaja võib saada elava lingi ruumi, mida ta avada ei saa.
11. Continuity ehitab `href`-id käsitsi, mitte `targetHref` registri kaudu → kaks tõeallikat (täna identsed).

### 23.4 Tähelepanek, mis ei ole viga, aga mõjutab deploy'd

**Kogu U1 e-kirjakiht on vaikimisi VÄLJAS.** `notificationEmailEnabled` on nullable ja `null !== true` → `SKIPPED_PREFERENCE`. Reconciler kasutab ainult `NONE` ja `OPTIONAL` policy't — **`TRANSACTIONAL` ei ole kasutusel**. Järeldus: **ükski U1 e-kiri ei lähe välja enne, kui kasutaja selle ise sisse lülitab.** See on §22.2-s dokumenteeritud teadlik valik ja väga ohutu vaikeväärtus, aga see tähendab, et delivery-vertikaali ei saa prod-is smoke-testida ilma opt-in'ita.

### 23.5 Ainus lahtine värav

**§22.8 p10 — päris DB migratsioonikontroll on TEGEMATA.** Harul puudub `.env`, seega `db:migrate:check`/`prisma migrate deploy` ei olnud auditi ajal võimalik. Skeem ja migratsioon on **koodina üle vaadatud ja korrektsed** (aditiivne, rollback-märkusega, `NOT NULL DEFAULT 0` on olemasolevatele ridadele ohutu, indeksid vastavad päringutele), kuid **ahela päris-DB kontroll peab toimuma enne deploy'd**, koos U3/U8 sama-ajatempliga migratsioonide järjekorra kinnitamisega.

### 23.6 Otsus

- **Merge `main`-i: LUBATUD.**
- **Enne deploy'd kohustuslik:** `npm run db:migrate:check` (või päris `prisma migrate deploy` staging'is) — §22.8 p10.
- **Soovituslik enne e-kirjade sisselülitamist:** P2-1 (ruumi ämber) ja P2-2 (lähenev tähtaeg).
- Ülejäänud P2-d on teadlikud follow-up'id.

---

## 24. Integratsiooni- ja deploy-otsuse märkus (2026-07-14)

Opuse sõltumatu audit oli **read-only**: rakenduskoodi, skeemi ega migratsioone
auditi käigus ei muudetud. Lõppotsus on **`OPUS HEAKS KIIDETUD`** — P0 ja P1
puuduvad ning U1/U2 haru võib `main`-i ühendada.

Edasine kohustuslik järjekord on:

1. ühenda auditeeritud U1/U2 haru `main`-i;
2. käivita päris andmebaasi vastu `npm run db:migrate:check` ja kinnita sealhulgas
   U3 ning U8 sama ajatempliga migratsioonide tegelik rakendumisjärjekord;
3. alles eduka andmebaasikontrolli järel uuenda vajadusel serveri env-i, lülita
   scheduler sisse ja tee deploy;
4. tee autenditud smoke-kontroll mõlema rolliga ning jäädvusta main/deploy seis.

Oluline käitamispiirang: U1 e-kirjad on vaikimisi välja lülitatud. Delivery
prod-smoke eeldab teadlikku kasutaja opt-in'i; scheduler'i edukas töö üksi ei
tõesta e-kirja saatmist. Enne e-kirjade laiemat sisselülitamist on soovitatav
sulgeda §23.3 P2-1 (ruumi 6 h topeltsündmus) ja P2-2 (läheneva järgmise
kontakti dedupe). Need ei blokeeri merge'i ega praegust ohutu vaikeväärtusega
deploy'd.

---

## 25. Main-integratsioon ja production deploy (2026-07-14)

U1/U2 sõltumatu audit oli roheline ning kasutaja andis loa koondada valmis
paketid `main`-i ja productionisse. U12/U3, P1, U8-lite ja U4 olid juba
integratsioonijadana `main`-is; U1/U2 lisandus sellele puhta fast-forward'ina.

### 25.1 GitHub ja kontrollid

- auditeeritud rakenduse release-commit: `a53d40b0`;
- GitHubi `main`: fast-forward `87a8f7cb -> a53d40b0`;
- enne ühendamist: kogu `npm test` **1222/1222**, CSS budget **52/52**,
  Prisma validate, ET/EN/RU pariteet ja production build korras;
- serveris eraldi tühja proovibaasi vastu rakendus kogu **92 migratsiooni**
  ahel ning `prisma migrate status` kinnitas ajakohase skeemi;
- U3 ja U8 varasem sama ajatempel oli integratsioonis juba lahendatud
  järjestuseks `20260714220000` ja `20260714223000`; U1/U2 migratsioon järgneb
  neile nimega `20260715120000_u1_u2_notification_continuity`.

### 25.2 Production migratsioon ja build

- server: `/home/ubuntu/apps/sotsiaalai`, haru `main`, release `a53d40b0`;
- enne migratsiooni tehti õigustega `0600` täisvarukoopia:
  `/home/ubuntu/apps/sotsiaalai-deploy-backups/db-before-u1u2-20260714T161346Z.dump`;
- `prisma migrate deploy` rakendas 92. migratsiooni ja järelkontroll kinnitas
  **Database schema is up to date**;
- production build läbis; logi:
  `/home/ubuntu/apps/sotsiaalai/deploy-build-logs/build-20260714T161354Z.log`;
- `sotsiaalai-frontend.service` ja `sotsiaalai-rag.service`: **active**;
- deploy-järgses frontend/RAG/notification error-journalis kirjeid ei olnud.

### 25.3 Notification scheduler ja env

Serveris lisati väärtusi logimata:

- juhuslik 256-bitine `NOTIFICATION_JOB_KEY`;
- `NOTIFICATION_JOB_BATCH_SIZE=40`;
- env-varukoopia:
  `/etc/sotsiaalai/frontend.env.bak-20260714T161507Z-u1u2`;
- env-faili senine omanik ja režiim säilisid: `root:ubuntu`, `0640`.

Lisati ja lubati `sotsiaalai-notifications.timer`, mis käivitab
`sotsiaalai-notifications.service` iga viie minuti järel. Esimene päriskäivitus
ja sellele järgnenud dry-run lõpetasid mõlemad edukalt:

- `reconcilePages=1`, `deliveryPages=1`, `truncated=false`;
- `created=0`, `sent=0`, `failed=0`, `retried=0`.

U1 optional e-kirjad jäävad endiselt kasutaja teadliku opt-in'ini vaikimisi
välja. Serveri scheduler'i aktiveerimine ei muutnud seda tooteotsust.

### 25.4 Production smoke

- `/`, `/minu-jagamised`, `/vestlus`: **200**;
- autentimata `/api/notifications`, `/api/notifications/preferences` ja
  `/api/workspace/continuity`: **401**;
- võtmeta `POST /api/jobs/notifications`: **401**;
- notification timer, frontend ja RAG: **active**;
- serveri git-tööpuu: puhas.

### 25.5 Lõppseis

- U1: **MAIN-IS JA PRODUCTIONIS**;
- U2: **MAIN-IS JA PRODUCTIONIS**;
- kõik seni valminud U12/U3, P1, U4, U8-lite, U1 ja U2 paketid on ühes
  `main`-harus;
- §23.3 P2-1 ja P2-2 jäävad teadlikeks mitteblokeerivateks parandusteks enne
  U1 e-kirjade laiemat sisselülitamist.
