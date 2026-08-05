# A4 — MTR tegevusloa kontroll teenuseprofiilil: arendusleping

STATUS: **v2, 05.08.2026. E1–E6 TEHTUD. E7 ootab otsust O-A4-3, mitte arendust.**

**E5 avalik silt** on teenusekaardi hüpikus: server annab valmis märgise (tekst, toon,
kuupäev, hoiatus, **allikas**), vaade ei tõlgenda midagi. **E6 korje** on
`npm run mtr:refresh` — austab `nextCheckAt`-i, käib profiilid ükshaaval ja annab adminile
viis signaali (`GET /api/admin/licence-alarms`).

**Neljanda ülevaatuse leiud (05.08), kõik parandatud:**

1. **`delete + create` kustutas hinnangu ikkagi.** `serviceKey` säilitamisest EI PIISANUD:
   teenuserea kustutamisel kadus kaskaadis kogu `ServiceLicenceAssessment` ja sama ID
   taasloomine seda ei taasta. Osutaja kaotanuks märgise iga kirjavea parandusega. Nüüd
   **uuendatakse olemasolevat rida kohapeal** ja kustutatakse ainult need, mis vormilt kadusid.
   Sondis on selle kohta oma kontroll: *„HINNANG säilis salvestuse üle"*.
2. **„Ei vaja luba" viitas MTR-ile.** See seis ei tule registri vastusest, vaid E2
   vastavustabelist. Märgis kannab nüüd **`sourceKey`-d** (register · kontrolliallikas ·
   loakohustuse kaardistus) ja vaade ei vali allikat ise.
3. **`dueProfiles` nälgimine.** Eelpiirang „võtame neli korda rohkem" tähendas, et kui
   esimesed N profiili ei ole küpsed, ei jõua järgmised MITTE KUNAGI kontrollini. Nüüd
   **kursoripagineerimine** läbi kõigi kandidaatide; test tõendab 61. profiili leidmist.
4. **Cron kord ööpäevas tegi 1 h ja 6 h korduskatsed olematuks.** Rütm on nüüd **kord tunnis**
   (`0 * * * *`) — see ei kontrolli iga profiili tunnis, vaid vaatab tunnis korra, kes on küps.
5. Alarmid arvutatakse **iga profiili viimase kontrolli** pealt, mitte viimase 100 rea pealt.
6. Aegunud positiivsed seisud filtreeritakse **andmebaasis**, mitte mälus.
7. Korje annab kontrollile **sama kella**, millega küpsust hinnati.
8. Alarmid on ühendatud päris rajaga: `GET /api/admin/licence-alarms`.
9. Tühja sildiplokki ei teki (puuduv tõlge → märgist ei renderdata) ja kõrge tõrkemäär läheb
   korje logis eraldi alarmireana välja.

## Assistendi usaldussignaal — OTSUSTATUD 05.08

> Tegevusloa avalik seis on assistendi soovitustes kasutatav **piiratud
> usaldussignaal**. Assistent võib kasutada ainult kehtivat avalikku seisu, kaetuse taset ja
> kontrollimise kuupäeva. Kontrolliajalugu ja tehnilised registrivead RAG-i ei lähe.
> `UNCONFIRMED` ja `NOT_CHECKED` ei ole negatiivsed hinnangud; `NOT_FOUND` ei ole õiguslik
> järeldus ega automaatne välistus. `SERVICE_MAPPING_REQUIRED` jääb sisemiseks. Võimaluse
> korral liidetakse värske loaseis soovituse ajal andmebaasist, mitte ei usaldata ainult
> RAG-indeksisse salvestatud koopiat.

**Koodis:** `lib/mtr/licenceSignal.js`. Kuus lubatud välja + kasutusreegel, mis käib signaaliga
KAASAS (`licence_usage`), et soovituskiht ei peaks reegleid mälu järgi teadma:

| Seis | Mida assistent tohib öelda |
|---|---|
| `VERIFIED` | „Tegevusluba on MTR-is kontrollitud" |
| `ACTIVITY_VERIFIED` | ainult ÜLDINE tegevusala; alaliiki **ei tohi** kinnitada |
| `NO_SHS_LICENCE_REQUIRED` | **ei ole halvem** kui kontrollitud luba; hoolduspere erisus käib kaasas |
| `UNCONFIRMED` / `NOT_CHECKED` | teadmata — ei nimeta kontrollituks EGA ei väida, et luba puudub |
| `NOT_FOUND` | „viimase kontrolli ajal ei leitud" — **mitte** õiguslik järeldus ega automaatne välistus |
| `SERVICE_MAPPING_REQUIRED` | ei jõua assistendini üldse |

**Arhitektuurivalik on ajaline, mitte maitse asi:** „kontrollitud" on väide, mis **aegub**, ja
indeksisse kirjutatud tekst ei aegu iseenesest. Seepärast liidetakse seis
`licenceSignalsForServices()` kaudu **soovituse ajal andmebaasist** ja RAG-dokument ei kanna
loaseisu üldse. **Sond kontrollib seda** (`RAG-dokument ei kanna loaseisu`) — kui keegi selle
kunagi dokumenti lisab, läheb kontroll punaseks. Aegunud positiivne väide langeb ka siin ise
„teadmata" peale, sest see on sama väide teises kohas.

**Tegemata jääb seos:** soovituskihti, mis RAG-i tulemused ja selle signaali kokku paneb, meil
veel ei ole — assistent saab teenuseinfo välise RAG-teenuse kaudu. `licenceSignalsForServices`
on valmis ja ootab seda kihti; kuni teda ei ole, jääb signaal kasutusele võtmata.

**E7 EI OLE tegemata töö, vaid otsuse taga:** O-A4-3 on juba vastatud — MTR-luba on
kiireloomulise osutaja-raja jaoks **vajalik, aga mitte piisav** tõend. Enne on vaja
kontrollitud organisatsioonikontot, teadlikku nõusolekut, aktiivset kontakti, määratud
piirkonda ja perioodilist kinnitust. Koodi kirjutamine enne neid ei ole ettevalmistus, vaid
poolik lüliti.

**E4–E5 on koodis:** teenuskiht `lib/mtr/licenceCheckService.js`, tekstikiht
`lib/mtr/statusText.js`, API `app/api/service-provider/profile/licence-check/`, osutaja vaade
`components/service-provider/ServiceLicenceStatus.jsx` (eraldi failis, mitte 5000-realises
`WorkspaceFeaturePage.jsx`-is) ja ET/EN/RU tekstid seitsmele seisule.

**Kolmanda ülevaatuse seitse leidu on parandatud** (05.08):

1. **Värske positiivne seis kukkus osutaja vaates „ei ole nõutud" peale** — `VERIFIED` ja
   `ACTIVITY_VERIFIED` ei olnud `internalLicenceStatus`-es üldse käsitletud ja langesid lõppu.
   See oli päris viga: kontrollitud loaga teenus oleks osutajale näidanud vastupidist.
2. **`serviceKey` oleks kadunud iga profiilisalvestusega.** Profiili PUT teeb teenustele
   `deleteMany` + `create`, seega seos oleks nullitud ja koos teenuse reaga oleks kaskaadis
   kustunud kogu hinnang. Nüüd **säilitab server varasema väärtuse** ja PUT ei loe teda
   sisendist — sidumine käib eraldi operatsiooniga.
3. **Mitte-429 tõrge kustutas liidesest seisud** (tühi vastus asendas kaardi). Nüüd jäävad
   varasemad seisud alles ja osutaja näeb, et kontroll ebaõnnestus.
4. **Pärast profiili salvestamist jäid vanad märgised ekraanile** — nüüd tühjendatakse ja
   laetakse uuesti.
5. **`ACTIVITY_VERIFIED` toon → NEUTRAALNE.** Jäme vaste on infomärgis, mitte rohelise
   kinnitusega samaväärne.
6. **Vaade kasutab nüüd märgise enda tooni ja kuupäeva** (`data-tone`, `badge.params.date`) —
   varem tuli kuupäev viimaselt katselt ja CSS oleks saanud aegunud seisu positiivseks värvida.
7. **`NOT_FOUND` parandustee laiendatud** (registrikood ei ole ainus võimalik põhjus) ja
   **põhjused rühmitatud** nii, et iga E1 veakood leiab selgituse.

Lisaks leidis elav QA ühe vea, mida ükski ülevaatus ei näinud: **jahtumisaeg andis 500 asemel
429** alles pärast seda, kui `json(data, status)` teine argument sai õige kuju.

Väravad 05.08: `npm test` **2839/2839**, `npm run mtr:probe` **29/29**, `npm run build` OK,
eslint puhas, `i18n:check` OK.

**E3 on koodis** (migratsioon `20260805170000_a4_mtr_licence_check`, `lib/mtr/assessment.js`,
`lib/mtr/policy.js`): neli tabelit, kuue seisuga olekumasin ja konfiguratsioonist tulev korje
rütm. **E4 teenuskiht on samuti koodis** (`lib/mtr/licenceCheckService.js`) — ahel identiteedi
kontrollist kuni iga teenuse hinnanguni; tegemata on ainult liides.

**E3/E4 karastati teise sõltumatu ülevaatuse järel 05.08** — üksteist leidu, kõik parandatud
(migratsioon `20260805190000_a4_licence_assessment_evidence`). Kolm neist oleksid tootnud
päriselt vale avaliku märgise:

1. **Aegumist ei salvestatud.** `publicStatusValidUntil`, `assessmentReason` ja tõendi seos
   arvutati ja visati ära — tähtajalise loa märgis oleks jäänud rippuma üle loa lõpu. Nüüd on
   nad veergudena olemas ja **lugemisrada jõustab neid**: aegunud positiivne seis langeb
   „ei saanud kinnitada" peale ka siis, kui korje pole veel jõudnud.
2. **Vana märgis seoti uue kontrolliga.** Kui uus kontroll luba ei leidnud, aga märgis püsis
   vanema tõendi najal, oleks liides kuvanud „kontrollitud [uue kontrolli kuupäev]" — kuupäev,
   mille kontroll seda luba EI leidnud. Nüüd on kaks eraldi seost: `lastAttemptCheckId` ja
   `statusSourceCheckId`.
3. **`VERIFIED` kandis nii täpset kui jämedat vastet.** Nüüd on `ACTIVITY_VERIFIED` **oma
   seis**, seega liides ei saa renderdada täpset märgist ainult `publicStatus` põhjal.

Ülejäänud kaheksa: kirje + hinnangud on nüüd **üks tehing** · paralleelne kontroll ei kirjuta
üle (`SUPERSEDED`) · `LicenceCheck` kannab mõlema allika tulemust eraldi, seega `result: OK`
ei saa esineda koos `entityResolved: false` · korduskatsete astmestik kasvab päriselt
(`consecutiveFailureCount`) · `checksumValid` on kolmeväärtuseline · loa kuupäevad on
`@db.Date` ja võrdlus käib **Eesti kalendripäevades** (varem oleks suveajal nihkunud 3 h) ·
avalik `NOT_FOUND` nõuab **kahte järjestikust edukat** tühja vastust ka siis, kui märgist
polnudki · tehniline tõrge **nullib** puudumiste loenduri · seis, mis ei tulene kontrollist,
ei seostu kontrolliga.

**V1 märgise ulatus on lukus:** `coverageScope = "ORGANISATION"`. Märgis ütleb, et osutajal on
sellele teenusele luba — **mitte**, et just see teeninduskoht on kaetud. Kohatasandi vaste
nõuaks teenusekirje sidumist tegevuskohaga ja on eraldi töö.

**Päris andmebaasi sond: `npm run mtr:probe` → 29/29** (`scripts/mtr-licence-probe.mjs`).
Sond on tootmiskaitsega (`ALLOW_A4_DB_PROBE`), kasutab juhuslikku jooksu-ID-d ja sünteetilist
registrikoodi, ning kontrollib nüüd ka kahe taseme kaskaadi, mõlemasuunalist seost, tõendi
seost, esimese ja teise puudumise poliitikat ning tehingu tagasiveeremist.
Fake-prisma ei valideeri skeemi, seega sond kirjutab päris tabelitesse, loeb tagasi, kontrollib
kaskaadkustutust ja laseb terve teenuskihi läbi sünteetilise registrivastusega — võõrast
registrit ta ei koorma. Väravad 05.08: `npm test` **2826/2826**, `db:migrate:check` OK
(128 migratsiooni), eslint puhas, `i18n:check` OK.

**E1 on koodis** (`lib/mtr/licences.js`, 19 testi `tests/mtr/licences.test.js`): sessioon +
CSRF, otsing registrikoodi järgi, CSV-parser skeemikontrolliga, identiteedivärav
(`resolveEntityByRegistryCode`) ja fail-safe seisud. Env: `MTR_BASE_URL` · `MTR_DISABLED=1` ·
`MTR_USER_AGENT` · `MTR_CSV_ENCODING`.

**E1 karastati sõltumatu ülevaatuse järel 05.08** — viis leidu, kõik parandatud ja testidega
lukus:

1. **Vastuse registrikoodi ei kontrollitud.** Rida `at(row,"registrikood") || registryCode`
   asendas puuduva või VÕÕRA koodi otsituga — rakendumata filtri korral oleks funktsioon
   tagastanud teise ettevõtte load `OK`-na. Nüüd: iga rea kood peab täpselt kattuma, muidu
   `RESULT_MISMATCH`. Sama kontroll lisati identiteedivärava juurde (varem võeti lihtsalt
   esimene rida).
2. **Vigane CSV läks läbi.** Sulgemata jutumärk ja lühem rida võeti vastu ning puuduvad väljad
   said tühja stringi. Nüüd on kontrollitud: jutumärgi sulgumine, iga rea veergude arv,
   kohustuslike väljade sisu, kuupäevade tõlgendatavus (ka olematu „31.02"), `Kehtiv` lubatud
   väärtused. Iga rike → `PARSE_FAILED` või `MALFORMED_ROW`.
3. **Tegevuskoha read hävisid.** Deduplitseerimise võti `number|activity` viskas ära just
   selle info, mida E5 vajab (luba käib teenuse JA koha külge). Nüüd koondatakse read loa
   kaupa ja tegevuskohad säilivad `locations[]`-is.
4. **„Ei viska kunagi erindit" ei olnud tõsi** — `arrayBuffer()`, `TextDecoder`, `text()` ja
   vigane `options.now` said läbi lipsata. Mõlemal avalikul funktsioonil on nüüd viimane
   `try/catch` → `UNEXPECTED_ERROR`.
5. **`checkedAt` tekkis enne päringut.** Nüüd on `attemptedAt` päringu alguses ja `checkedAt`
   ainult tõlgendatud vastuse järel. `maxPersons` → **`licensedMaxPersons`**, et keegi ei
   loeks seda vabaks mahuks.

**E1 tellib väljundtulbad nimeliselt (05.08).** Päring saadab kaasa
`tegevusala_liigid` · `tegevuskoha_aadressid` · `tegevusloa_valjaandja` ·
`tegevuskohtade_kohtade_arvu_summa`, seega parser ei sõltu MTR-i vaikeseadistusest ja
varasem reservatsioon „aadressiveeru nimi on oletus" kadus.

**Tellitud tulba puudumine ei ole fataalne** (erinevus ülevaatuse soovitusest, teadlik):
loa identiteet tuleb kohustuslikest veergudest ja hard-fail muudaks iga MTR-i sõnastusmuutuse
täielikuks katkestuseks. Puuduv tellitud tulp tuleb tagasi `missingOrderedColumns` all (E6
alarm) ja kaetus langeb `ACTIVITY_MATCH_ONLY` peale — täpselt see varurada, mida ülevaatus ise
E2 poolel nõudis.

**E2 on koodis** (`lib/mtr/licensedServices.js`, 14 testi): versioonitud vastavustabel — kogu
SHS § 151 loetelu + § 147, iga rida oma õigusviite ja MTR tegevusalaga, pluss kuus
loakohustuseta teenust. Kood ei ole veel ühegi marsruudi ega vaate küljes.

**E2 karastati sõltumatu ülevaatuse järel 05.08** — piirid, mis olid kommentaarides,
on nüüd API-s jõustatud:

1. **`licenceCoversService` boolean kadus.** `licenceCoverageForService` tagastab seisu:
   `EXACT_MATCH` · `ACTIVITY_MATCH_ONLY` · `NO_MATCH` · `UNCONFIRMED`. Varem andis MTR-i üldine
   „Erihoolekandeteenus" vaste `true` kõigile kuuele alateenusele — täpselt see viga, mille
   fail ise kirjelduses keelas.
2. **`needsVerification` blokeerib nüüd koodis.** Päeva- ja nädalahoiu real nullitakse
   tegevusala ja `mappingStatus` on `NEEDS_VERIFICATION`, seega MTR-kontrolli ei saa tema peal
   käivitada. **Erinevus ülevaatuse soovitusest:** loakohustus ise jääb `REQUIRED`, sest
   § 151 p 8¹ on selge — kontrollimata on ainult seos MTR tegevusalaga. Avalikult tähendab
   see „ei saanud kinnitada", mis on täpsem kui „ei tea, kas luba on vaja".
3. **`NOT_REQUIRED` → `NO_SHS_LICENCE_REQUIRED`.** Tabel tõendab ainult SHS-i loakohustuse
   puudumist. Avalik tekst muutub vastavalt: **„Selle teenuse puhul ei ole MTR-is
   kontrollitavat sotsiaalteenuse tegevusluba nõutud"** — mitte „ei vaja tegevusluba".
   Näide, miks: sotsiaaltranspordile võivad kehtida ühistranspordiseaduse nõuded.
4. **„Naiste tugikeskus" eemaldati** turvakoduteenuse aliaste hulgast — see on ohvriabi
   seaduse alusel eraldi tervikteenus, mitte turvakodu teine nimi. Testiga lukus.
5. **Kataloog on sügavkülmutatud** (`deepFreeze`) — varem sai reaobjekte ja aliaseid jooksvalt
   muuta, mis oleks vahetanud äriloogika kogu protsessi ulatuses.
6. Aliased kannavad nüüd **kindlusastet ja vaste põhjust** (`matchedText`, `matchedBy`,
   `confidence`, `note`); mitmetähenduslikud — „lapsehoid" (alates 01.09.2025 on tavaline
   lastehoid haridusvaldkonnas), „hooldushaigla", „rehabilitatsioon", „sotsiaaltransport" —
   on `LOW` koos selgitusega, millega neid segi aetakse.
7. Kommentaari „viis erihoolekandeteenust" parandatud **kuueks** (p 5, 6, 7, 8, 8¹, 9);
   kataloogi versioon on nüüd `2026-08-05.1`, et sama päeva kordused eristuksid.

Väravad 05.08 pärast karastust: `npm test` **2799/2799**, eslint puhas, `i18n:check` OK.

**E2 tõi välja kaks piirangut, mis muudavad märgise sõnastust ja avavad ühe otsuse
(O-A4-4).** Vt „Sidumise reegel" ja „Lahtised otsused".

v2 sisaldab omaniku ülevaatuse **viit lukustatud muudatust**: (1) „ei leitud" ja „ei saanud
kinnitada" on avalikult eri tekstid · (2) luba seotakse teenuse ja tegevuskohaga, mitte ainult
osutajaga · (3) maksimaalne isikute arv EI ole kättesaadavuse signaal · (4) MTR-i veebipäring
on ebastabiilne väline sõltuvus · (5) MTR-luba üksi ei ava kiireloomulist osutajarada.

## Mis see on

Teenusekaardi **usaldusmärgise objektiivne alus**: riigi register ütleb, kas osutajal on tema
pakutavale loakohustuslikule teenusele kehtiv tegevusluba. Mitte meie hinnang, mitte osutaja
enda väide.

Kaks tarbijat, üks andmekiht:

1. **Teenusekaart ja teenuseprofiil** — inimene, kes otsib hooldekodu või erihoolekannet, näeb
   loa seisu ja kontrolli kuupäeva, ilma et peaks ise MTR-i minema ja teadma, mida sealt otsida.
2. **SK-V1 O-SK-5** — lahtine otsus „kes lülitab teenuseosutaja kiireloomulise abipalve raja".
   MTR-kontroll on selle **vajalik, kuid mitte piisav** tõend; vt O-A4-3.

## Õiguslik alus ja kontrollitud faktid (05.08.2026)

**Seadus.** SHS § 1¹ lg 1 seob sotsiaalteenuse osutamise nõuded majandustegevuse nõuetega,
seega käib loakohustus MsÜS-i kaudu majandustegevuse registrisse. Loakohustuslikud teenused:
rehabilitatsiooniteenus (§ 147) ja § 151 loetelu — asendushooldus, turvakodu, lapsehoid,
erihoolekanne, väljaspool kodu osutatav üldhooldusteenus jt. Loa annab **SKA**, andmed
kantakse MTR-i. SKA käsitleb tegevusloa olemasolu, loa kõrvaltingimusi, muid
majandustegevuse nõudeid ja **teenuse kvaliteeti eraldi kontrollivaldkondadena** — see
jaotus kandub otse meie tootepiiridesse.

**MTR-i seis.** Tegevuslubade otsingus on kategooria „Sotsiaalhooldus" ja selle all täpselt
ülalnimetatud teenused. TTJA uus süsteem **Tarvik** (25.06.2025–) võtab üle
**majandustegevusteateid**; **tegevusload jäävad MTR-i**, ja sotsiaalhoolekandest on üle
läinud ainult töötervishoiuteenuse teade
([infoleht 22](https://mtr.ttja.ee/infoleht/22)). → *Kui ehitus algab hiljem kui 2026 sügis,
kontrolli see rida uuesti samalt lehelt.*

**Mõõdetud päris päringuga 05.08.2026** (otsisõna „Masaan"):

| Leid | Tulemus |
|---|---|
| Ligipääs | avalik otsing, sisselogimist ei vaja |
| Otsingu rada | vorm POST → `/taotluse_tulemus`; **püsilinki kirje kohta EI OLE** |
| Masinloetav väljund | `input[type=button]` → `/taotluse_tulemus/csv/action` — jooksva otsingu tulemus CSV-na, **sama sessiooni sees** |
| Valitavad väljundtulbad | Number · Ettevõtja nimi · Registrikood · Kehtivuse algus · Kehtivuse lõpp · Kehtiv · Tegevusala · Lisainfo (+ Tegevusloa väljaandja, tegevuskohtade aadressid, kontaktandmed) |
| Vastus | 6 kehtivat erihoolekandeteenuse luba, **kaks juriidilist isikut**: MTÜ Masaan (80587752, 3 luba 2021) ja Masaan OÜ (17027241, 3 luba 2025) |

**X-teed ei ole vaja.** Rada on `POST otsinguvorm → GET CSV → parse`, ühe küpsisepurgi sees.
Võtit ega turvaserverit ei ole vaja. **Aga see ei ole API** — vt „Väline sõltuvus" allpool.

**Kolm leidu, mis disaini määravad:**

1. **Võti on registrikood, mitte nimi.** masaan.ee on MTÜ Masaan, aga värsked 2025. aasta load
   on Masaan OÜ nimel — sarnane nimi, eri juriidiline isik. Nimepõhine sidumine näitaks valet.
   **Nimi jääb siiski kasutusse — anomaalia tuvastajana**, mitte sidumise alusena.
2. **Ühel osutajal on mitu luba** (Masaanil kolm per isik, ilmselt tegevuskohtade kaupa) —
   koondamise reegel on teenuse- ja kohapõhine, vt „Sidumise reegel".
3. **Lisainfo kannab mahupiiri** („Maksimaalne isikute arv: 40 / 60 / 80"). See on **loal
   lubatud maksimaalne maht, mitte kättesaadavus** — vt tootepiirid ja O-A4-2.

## Mõisted

Nende täpne tähendus on lepingu osa; kood ja testid kasutavad neid samas tähenduses.

| Mõiste | Tähendus |
|---|---|
| **Kehtiv luba** | MTR-i kirje, mille „Kehtiv" = Jah, kehtivuse algus on käes ja lõpp ei ole möödas (tähtajatu = lõputa) |
| **Vastav tegevusala** | MTR tegevusala, mille vastavustabel seob platvormi teenusekataloogi kirjega (E2) |
| **Vastav tegevuskoht** | loal märgitud tegevuskoht, mis vastab profiilil nimetatud teeninduskohale |
| **Edukas kontroll** | päring läks välja, register vastas, CSV parsis tuntud veergudega |
| **Lahendatud registrikood** | registrikood vastab MTR-is olemasolevale juriidilisele isikule |
| **Vananenud kontroll** | viimasest edukast kontrollist on möödas üle lubatud akna (vaikimisi 72 h) |
| **Loa puudumine registri järgi** | edukas kontroll + lahendatud registrikood + vastavat kehtivat luba ei leitud |

## Viis seisu, neli avalikku teksti

**Iga teenus kannab avalikult mingit seisu — tühja kohta ei jää kuhugi.** Just see teeb
positiivsest märgisest päris signaali: kui pooled kirjed on tühjad, ei tähenda märgise
puudumine midagi.

| Sisemine seis | Avalik tekst | Osutaja ja admin näevad lisaks |
|---|---|---|
| **KONTROLLITUD** | „Tegevusluba MTR-is kontrollitud 5. augustil 2026" | loanumbrid, tegevusalad, mahupiirid, tegevuskohad |
| **EI_VAJA_LUBA** | „Selle teenuse puhul ei ole MTR-is kontrollitavat sotsiaalteenuse tegevusluba nõutud" | vastavustabeli rida, mille alusel nii otsustati |
| **LUBA_PUUDUB** | „MTR-ist ei leitud kontrolli ajal sellele teenusele kehtivat tegevusluba" | mida otsiti: registrikood, tegevusala, kuupäev + parandustee |
| **KINNITAMATA** | „Tegevusloa staatust ei saanud MTR-is kinnitada" | põhjus: päring kukkus · registrikood ei lahendunud · CSV tundmatu kuju · kontroll vananes |
| **KONTROLLIMATA** | „Tegevusloa staatust ei saanud MTR-is kinnitada" | registrikood puudub profiililt · korje pole veel jõudnud |
| **SIDUMATA** (`SERVICE_MAPPING_REQUIRED`) | **silti ei ole** | „Teenuse liik pole veel tegevusloa kontrolliga seotud" + tuvastaja kandidaadid |

**`SIDUMATA` ja `KINNITAMATA` on eri asjad ja neid ei tohi ühte valada** (omaniku otsus 05.08):
esimesel juhul me ei tea, MIDA kontrollida — teenus ei ole vastavustabeli reaga seotud;
teisel juhul me teadsime, mida küsida, aga kontroll ei õnnestunud. Ainult teine on registri
või võrgu probleem. Sidumata teenusel **ei ole avalikku silti üldse** — ei märgist, ei
„ei vaja luba", ei „ei leitud".

**Neutraalne kujundus ei tähenda ebatäpseid sõnu.** Punast värvi, hüüumärki ega ähvardavat
kujundust ei ole üheski seisus. „Ei leitud" ütleb, mida register kontrolli hetkel näitas —
ta ei ütle, et osutaja rikub seadust.

**Miks „ei vaja luba" peab olema avalikult väljas:** tugiisik, koduteenus, nõustamine ja
coaching ei ole loakohustuslikud. Ilma selle tekstita loeks inimene tühja koha hoiatuseks ja
pooled väikesed osutajad satuksid põhjendamatult halba valgusesse.

## Sidumise reegel — luba käib teenuse ja koha, mitte firma külge

**Ei piisa reeglist „registrikoodil on vähemalt üks luba".** Märgis arvutatakse võtmega:

```
registrikood + platvormi teenuse liik + vastav MTR tegevusala + loa kehtivus [+ tegevuskoht]
```

Ühe tegevuskoha erihoolekandeluba **ei anna** rohelist märgist sama firma teistele teenustele,
teistele aadressidele ega kõigile profiilil nimetatud tegevuskohtadele. Platvormi mudelis on
teenusel mitu kohta ja kohas mitu teenust (`ServiceProviderService`,
`ServiceProviderLocation`, `ServiceProviderServiceLocation`) — märgis elab selle ristmiku, mitte
profiili peal.

### Kaks piirangut, mis E2 ehitamisel välja tulid (05.08)

**1. ~~MTR on jämedama teralisusega kui seadus~~ — PARANDATUD 05.08, järeldus oli vale.**
Esialgu tundus, et kuus erihoolekandeteenust (§ 151 p 5–9 ja p 8¹) kannavad ühte tegevusala
„Erihoolekandeteenus" ja loakirje ei ütle, milline alateenus on kaetud. See tuli **vaikimisi
väljundtulpade** pealt. Päris registri kontroll näitas, et MTR-il on nende jaoks eraldi väli
**„Tegevusala liik"** (filter `tegevusala_liik_kontrolliga`, väljundtulp `tegevusala_liigid`)
kuue väärtusega, mis vastavad täpselt SHS-i alateenustele. Kontroll: filter Erihoolekandeteenus
+ „Päeva- ja nädalahoiuteenus" → **21 kehtivat kirjet**.

Seega **E1 tellib väljundtulbad nimeliselt** ja vaste on täpne. `ACTIVITY_MATCH_ONLY` jääb
**varuseisuks**: kui liik puudub, on tühi või MTR muudab sõnastust, langeb kaetus jämedale
tasemele — **puuduv liik ei anna kunagi `NO_MATCH`**. Selles olukorras kehtib omaniku 05.08
sõnastus: *„Erihoolekandeteenuse tegevusluba MTR-is kontrollitud [kuupäev]"* + lisainfo
*„MTR-i avalik väljund ei näita, millist konkreetset erihoolekandeteenust tegevusluba katab."*

**2. Platvormil ei ole kontrollitud teenusesõnastikku.** `ServiceProviderService.categories` ja
`services` on vaba tekst (`splitList` komadega). Seega ei saa E2 olla ainult kaardistus — ta
peab tooma sisse ka nimekirja, mille külge kaardistada. Kood teeb vabatekstist ainult
**kandidaadi**, mitte otsuse: `licenceRequirementFor` annab `UNKNOWN` iga kord, kui teenus ei
ole tabeli reaga selgelt seotud. Nii ei saa oletusest sündida ei avalikku rahustust
(„ei vaja luba") ega avalikku kontrolli vale teenuse peal.

**~~Üks rida on kontrollimata~~ — KONTROLLITUD 05.08.** Päeva- ja nädalahoiuteenus (§ 151 p 8¹)
on registris „Erihoolekandeteenus" tegevusala all ja eristub liigi kaudu (21 kehtivat kirjet).
`needsVerification` on maas.

**Kataloogi lisandusid 05.08 neli loakohustuseta teenust** (omaniku otsus): täisealise isiku
hooldus (§ 26) · eluruumi tagamine (§ 41–43) · asendushooldus hooldusperes (§ 45¹⁰ lg 2) ·
sotsiaalnõustamine. Kaks neist kannavad erisust, mida ei tohi ära kaotada:

- **Hoolduspere** — tegevusluba ei ole nõutud, aga see EI tähenda kontrolli puudumist: sobivust
  hindab SKA ja kanne tehakse STAR-i, mis ei ole avalik register. Rida kannab struktuurset välja
  `otherVerification: "SKA_SUITABILITY_AND_STAR"` ja avalikku selgitust. **A4 ei tohi kuvada
  „SKA-s kontrollitud" ega „STAR-i kantud"** — ainult seda, et kontrollimehhanism on teistsugune.
- **Sotsiaalnõustamine** — kehtivas SHS-is ei ole eraldi nummerdatud teenus (§ 16 on tasu
  sotsiaalteenuse eest). Rida kannab `legalBasis: null` + `legalNote`. Aegunud paragrahvi
  ei leiutata.

Mitme loa koondamine üheks märgiseks on lubatud **ainult organisatsiooni üldprofiilil**.
Konkreetse teenusekaardi kirje juures peab märgis põhinema just sellele teenusele ja kohale
vastaval loal.

## Riivid vale positiivse vastu

Vale „luba puudub" on siin kõige kallim viga: ta on avalik, ta puudutab kolmanda isiku mainet
ja teda ei saa tagantjärele olematuks teha.

1. **Identiteet enne otsust.** `LUBA_PUUDUB` on lubatud **ainult siis, kui registrikood
   registris lahendus.** Kui kood ei vasta ühelegi juriidilisele isikule (trükiviga, vale
   number), on seis `KINNITAMATA` — meie ei tea, kelle kohta me küsisime. See riiv on see, mis
   teeb „ei leitud" ja „ei saanud kinnitada" lahutamise ohutuks.
2. **Teine kinnitus enne avalikku muutust.** Üleminek `KONTROLLITUD → LUBA_PUUDUB` nõuab
   **kahte järjestikust edukat kontrolli**. Ühekordne registrikapriis ei tohi muutuda avalikuks
   registriväiteks.
3. **Teadmatus ei ole puudumine.** Päringu tõrge, tundmatu CSV kuju, jõudmata korje → `KINNITAMATA`.
4. **Parandustee on ühe klõpsu kaugusel.** „Kontrolli uuesti" käivitab kontrolli kohe.
5. **Kontroll vananeb.** Üle akna vana kontroll langeb `KINNITAMATA` peale. Vana kontroll ei ole
   kontroll.
6. **Loa lõppkuupäev lõpetab positiivse seisu kohe**, ootamata järgmist korjet.
7. **Nimeanomaalia on admini signaal, mitte avalik seis.** Kui MTR-ist tulnud juriidilise isiku
   nimi erineb oluliselt profiili nimest, tekib adminile hoiatus — avalikku teksti see ei muuda.
8. **Registrikoodi formaat ja kontrollnumber** valideeritakse enne päringut.

## Väline sõltuvus: MTR ei ole API

**Kontrollitud E1 ehitamisel 05.08:** otsinguvorm POSTib `/taotluse_tulemus/filter/action`
peale ja kannab **sessioonipõhist CSRF-tokenit** (`taotluse_tulemus_filters[_csrf_token]`),
CSV tuleb `/taotluse_tulemus/csv/action` tagant sama sessiooni sees. Juriidilise isiku otsing
on eraldi vorm (`/juriidiline_isik/filter/action`). Ehk **üks kontroll = kolm päringut** ja
sessioon peab elama nende vahel. See on veel üks tõend, et tegemist ei ole liidesega.

Avalik HTML-vorm ja CSV-nupp **ei ole garanteeritud liides**. TTJA võib muuta väljade nimesid,
sessiooniloogikat, CSV struktuuri, tegevusalade nimetusi, kodeeringut, päringupiiranguid või
kogu otsingulahendust — ilma meid teavitamata. Kriitiline usaldusfunktsioon ei tohi olla
dokumenteerimata veebivormi küljes ilma kaitseta.

Kohustuslik osa teostusest:

- **skeemimuutuse tuvastus** — tundmatu veerg, kadunud veerg või ootamatu kodeering peatab
  parsimise ja annab `KINNITAMATA`, mitte vale tulemuse;
- **alarm** admini vaates, kui parser saab tundmatu kuju või ootamatult null tulemust seal, kus
  varem oli kirjeid;
- **päringukiiruse piirang + vahemälu** — üks päring osutaja kohta, mitte täisregistri tõmbamine;
- **retry ja circuit breaker**;
- **viimase eduka kontrolli aeg** on salvestatud ja nähtav;
- **selge käitumine MTR-i katkestuse korral**: olemasolevad positiivsed märgised püsivad kuni
  vananemisaknani, seejärel `KINNITAMATA`; ükski katkestus ei tooda `LUBA_PUUDUB`;
- **hooldusvastutus** pärast välise süsteemi muudatust on nimeliselt kirjas.

**TTJA kiri on pargitud (omanik 05.08: praegu ei saa lubada).** Küsimus — kas väikese
koormusega automatiseeritud kasutus on aktsepteeritav ja kas on plaanis stabiilsem
andmeväljund — jääb kaardile, aga **ta ei blokeeri ehitust ega aktiveerimist**. Kuni kirja ei
ole, kannavad riski ülalkirjeldatud tehnilised riivid ja **viisakusreegel: üks päring osutaja
kohta ööpäevas, vahemälu tagant, täisregistrit ei tõmmata**. Loomulik hetk kirja saatmiseks on
enne avalikku käivitust (T27) või siis, kui päringumaht on päriselt teada — mõlemal juhul on
küsimus tugevam, sest siis on midagi konkreetset näidata.

## Teostuse osad

| Osa | Sisu |
|---|---|
| **E1** | ~~Allikaklient~~ — **TEHTUD 05.08**: `lib/mtr/licences.js`. Sessioon + CSRF → otsing registrikoodi järgi → CSV → parse + skeemikontroll; identiteedivärav eraldi funktsioonina; iga tõrge annab `UNCONFIRMED` koos põhjusega, mitte tühja tulemust |
| **E2** | ~~Vastavustabel~~ — **TEHTUD 05.08**: `lib/mtr/licensedServices.js`. Kogu § 151 loetelu + § 147 + kuus loakohustuseta teenust; iga rida kannab õigusviidet, MTR tegevusala ja teralisust; versioon `2026-08-05`; vabatekst annab ainult kandidaadi. **Ridade sisu ootab omaniku kinnitust** |
| **E3** | ~~Andmemudel~~ — **TEHTUD 05.08**: migratsioon `20260805170000_a4_mtr_licence_check` (3 enum'i, 4 tabelit, 1 uus veerg), seisuloogika `lib/mtr/assessment.js` ja rütm `lib/mtr/policy.js`. Vt „E3 kaheksa põhimõtet" allpool |
| **E4** | **Teenuskiht TEHTUD 05.08** (`lib/mtr/licenceCheckService.js`, 9 testi): `runLicenceCheck` = identiteedivärav + lubade päring + kirje + iga teenuse hinnang; `licenceStatusesForProfile` = lugemisrada. **Tegemata on liides**: osutaja vaade (mida kontrolliti, millise koodiga, millal, miks, kuidas parandada, kuidas teatada valest vastavusest) |
| **E5** | ~~Avalik silt~~ — **TEHTUD 05.08**: `lib/mtr/statusText.js` otsustab teksti ja tooni; avalik märgis teenusekaardi hüpikus (`ServiceMapLeaflet`), andmed `listPublishedServiceMapEntries` kaudu koos aegumise ja tõendi kuupäevaga. Sidumata teenusel silti ei ole |
| **E6** | ~~Korje ja alarmid~~ — **TEHTUD 05.08**: `lib/mtr/refresh.js` + `npm run mtr:refresh` (ja `mtr:refresh:dry`). Korje austab `nextCheckAt`-i ja käib profiilid **ükshaaval**; üks tõrge ei katkesta korjet. Viis admini signaali: skeemitriiv, lahendamata identiteet, nimeanomaalia, korduvad tõrked, aegunud märgised |
| **E7** | SK-V1 O-SK-5 haakumine — **eraldi otsuse taga, ei ehita enne** |

## E3 kaheksa põhimõtet (omanik 05.08) — ja kus nad koodis elavad

| # | Põhimõte | Kus |
|---|---|---|
| 1 | `serviceKey` on laiendatav **string, mitte DB-enum** | `ServiceProviderService.serviceKey` ja `ServiceLicenceAssessment.serviceKey` on `TEXT` |
| 2 | `catalogueVersion` iga hinnangu juures | `ServiceLicenceAssessment.catalogueVersion` |
| 3 | Otsus salvestatakse **kontrolli hetke koopiana** | `requirementAtAssessment`, `activityExpected`, `activityTypeExpected` |
| 4 | `EXACT_MATCH` ja `ACTIVITY_MATCH_ONLY` on eraldi seisud | enum `LicenceCoverage` |
| 5 | `missingOrderedColumns` säilib tehnilise metaandmena | `LicenceCheck.missingOrderedColumns` |
| 6 | Rikastusvälja puudumine ei kustuta usaldusväärset tulemust | `assessServiceLicence` → liigita luba annab `VERIFIED` + `ACTIVITY_MATCH_ONLY` |
| 7 | Sidumata teenus ei tekita päringut ega väidet | `serviceKey IS NULL` → `SERVICE_MAPPING_REQUIRED`, silti ei ole |
| 8 | Uus võti = andmed, mitte migratsioon | võtmeid ei ole üheski enum'is ega `CHECK`-piirangus |

**Kolm ajaankrut on eraldi ja neid ei tohi segada** (`lib/mtr/policy.js`, kõik env-ist
muudetavad): automaatkontroll 24 h · eduka kontrolli värskus 72 h · tõrke korduskatsed
1/6/24 h · käsitsi kontroll ≤1× 15 min. Positiivne seis kehtib **lühima ankru järgi** — kas
kontroll vananeb või luba lõpeb, kumb enne tuleb.

**Kadunud luba ei kustuta märgist esimese kontrolliga.** `consecutiveMissCount` peab jõudma
kaheni; enne seda jääb märgis püsti põhjusega `PENDING_SECOND_CHECK`. Kui märgist polnudki,
ei ole midagi kaitsta ja `NOT_FOUND` tekib kohe.

## Mida päris register õpetas (05.08, elav päring)

Need seitse asja EI TULNUD välja üheski testis ega ülevaatuses — ainult elavast
päringust. Nad on siin kirjas, sest järgmine inimene ei pea neid uuesti avastama:

1. **`valjund_valjad[]` ASENDAB vaiketulbad**, mitte ei lisandu neile. Ainult lisatulpade
   tellimine andis 64-baidise CSV kolme veeru ja **null reaga**. Baastulbad tuleb kaasa saata.
2. **Peidetud väljad `tulemus_id[]` (4 ja 1) on kohustuslikud** — ilma nendeta otsing ei rakendu.
3. **CSV on windows-1257, kuigi päis ütleb `charset=utf-8`.** Kodeeringut ei usu me päise
   järgi, vaid proovime kaht kandidaati ja võtame selle, mis ei tooda asendusmärke.
4. **Mitme tegevuskohaga luba tuleb JÄTKURIDADENA**: teine koht on oma rida, kus kõik
   identiteedi veerud on tühjad ja rida on päisest **lühem**. Esimene versioon luges need
   vigasteks ridadeks ja kogu vastus kukkus `MALFORMED_ROW` peale.
5. **Aadressiveeru päis on „Tegevuskoha aadress"** (ainsuses), mitte tellimisvaliku nimi.
6. **„Maksimaalne isikute arv" ei tule oma veeruna** — mahupiir jääb „Lisainfo" sisse.
7. **Kaks paralleelset otsingut on registrile liiga palju:** entity- ja lubade päring
   `Promise.all`-iga andsid mõlemad TIMEOUT-i, kuigi eraldi töötasid mõlemad. Nüüd
   **järjestikku** — aeglasem tervik, aga me ei koorma võõrast registrit kahe samaaegse
   otsinguga ühe osutaja pärast. Ajapiir 8 s → 20 s (mõõdetud ahel ~18 s).

**Tõendatud 05.08 elava registri vastu:** `succeeded: true`, identiteet `Masaan OÜ`,
kolm luba eristuvate alateenustega, jätkurida kinnitatud teise tegevuskohana,
`Toetatud elamine → VERIFIED`, `Tugiisik → NO_SHS_LICENCE_REQUIRED`, nimeanomaalia
tuvastatud.

## Olekumasin

Iga üleminek on nimeline sündmus; test katab iga noole. Vaatajate kaupa on kirjas, mida
üleminek muudab avalikul kaardil, osutaja vaates, admini vaates ja SK-V1 töövoos.

Kohustuslikud üleminekud: profiil ilma koodita → `KONTROLLIMATA` · edukas kontroll + luba →
`KONTROLLITUD` · edukas kontroll + lahendatud kood + luba puudub (2×) → `LUBA_PUUDUB` ·
lahendamata kood → `KINNITAMATA` · tõrge → `KINNITAMATA` · aken möödas → `KINNITAMATA` ·
loa lõppkuupäev → kohe välja `KONTROLLITUD`-ist · vastavustabeli muutus → kõik puudutatud
kirjed ümberarvutusse.

## DoD

**Väravad:** `npm test` · `npm run i18n:check` · eslint muudetud failidel ·
`npm run db:migrate:check`.

**Vastuvõtutestid salvestatud andmetega** (mitte ainult live-MTR — pärisandmed muutuvad ka siis,
kui kood on õige):

kehtiv tähtajatu luba · lõppenud luba · tulevikus algav luba · peatatud luba · mitu luba ühel
koodil · sama nimi + eri registrikood · sama registrikood + eri tegevusalad · sama teenus eri
tegevuskohtades · tühi CSV · muutunud CSV veerud · timeout · vigane registrikood · lahendamata
registrikood · tehniline tõrge · duplikaatread · täpitähed ja kodeering.

**Eraldi live-smoke** vähemalt kolme päris osutajaga, sh üks loakohustuslik ilma loata ja üks
loakohustuseta.

**Lisaks lukus testidega:** „päring kukkus" ei tooda kunagi `LUBA_PUUDUB` · lahendamata
registrikood ei tooda kunagi `LUBA_PUUDUB` · `KONTROLLITUD → LUBA_PUUDUB` nõuab kahte kontrolli ·
ühe koha luba ei rohelista teist kohta ega teist teenust · vananenud kontroll langeb
`KINNITAMATA` peale · ET/EN/RU tekstid kõigile neljale avalikule seisule.

## Vaidlustamine ja parandamine

Osutaja näeb oma vaates: mida kontrolliti · millise registrikoodiga · millise tegevusala
vastu · millal · miks tulemus selline oli. Ja tal on kaks tegevust: **parandan registrikoodi
või teenuse liigituse** ning **teatan valest vastavusest** (vastavustabeli viga on meie, mitte
tema viga). Teade jõuab adminile koos kontrolli kontekstiga.

## Andmete minimaalsus

MTR-ist ei salvestata kõike, mida CSV võimaldab. Säilitatakse ainult see, mida märgis,
auditijälg ja parandamine nõuavad: loanumber, tegevusala, kehtivusajad, mahupiir, tegevuskoht,
juriidilise isiku nimi (anomaaliakontrolliks), kontrolli aeg ja tulemus. **Kontaktandmeid
MTR-ist ei salvestata.** Eesmärgipärasus ja minimaalsus kehtivad ka avalikust registrist
pärinevatele andmetele.

## Lahtised otsused

| Kood | Küsimus | Soovitatud vaikeväärtus |
|---|---|---|
| ~~**O-A4-1**~~ | ~~korje sagedus ja vananemise aken~~ | **OTSUSTATUD 05.08.** Automaatkontroll **1×/ööpäevas** · eduka kontrolli kehtivus **72 h** · tõrke korduskatsed **1 h, 6 h, 24 h** · käsitsi „kontrolli uuesti" kohe, aga **mitte tihedamini kui 1× 15 minuti jooksul** · loa lõppkuupäev lõpetab positiivse seisu kohe, sõltumata korjest. **Kõik väärtused on konfiguratsioon**, mitte koodi laiali puistatud konstandid ega andmebaasi read |
| **O-A4-2** | kas mahupiir läheb avalikule kaardile | **V1-s ei lähe.** Hoitakse osutaja ja admini vaates. Kui kunagi läheb, siis ainult sõnastuses „Tegevusloal märgitud maksimaalne isikute arv: 40" — **mitte kunagi „vabad kohad", „kättesaadavus" ega „mahutavus"** |
| ~~**O-A4-4**~~ | ~~mida näeb avalikult sidumata teenus~~ | **OTSUSTATUD 05.08: silti ei ole**, ja seis on eraldi (`SERVICE_MAPPING_REQUIRED`), mitte `KINNITAMATA` alla peidetud. Osutaja ja admin näevad „Teenuse liik pole veel tegevusloa kontrolliga seotud" koos tuvastaja kandidaatidega; **tuvastaja ei vali teenust automaatselt** |
| **O-A4-3** | kas MTR-luba avab SK-V1 osutaja-raja | **Vajalik, kuid mitte piisav.** Lisaks nõutav: kontrollitud organisatsioonikonto · organisatsiooni teadlik nõusolek kiireid pöördumisi vastu võtta · aktiivne vastutav kontakt · määratud teeninduspiirkond ja reageerimisviis · perioodiline kinnitus, et rada on aktiivne |

Allikad: [MTR tegevuslubade otsing](https://mtr.ttja.ee/tegevusluba?m=97) ·
[MTR/Tarviku tegevusalade infoleht](https://mtr.ttja.ee/infoleht/22) ·
[SKA sotsiaalteenuste järelevalve](https://sotsiaalkindlustusamet.ee/spetsialistile-ja-koostoopartnerile/jarelevalve)
