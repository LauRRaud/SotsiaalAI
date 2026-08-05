# A4 — MTR tegevusloa kontroll teenuseprofiilil: arendusleping

STATUS: **v2, 05.08.2026. E1 TEHTUD, E2–E7 tegemata.**

**E1 on koodis** (`lib/mtr/licences.js`, 14 testi `tests/mtr/licences.test.js`): sessioon +
CSRF, otsing registrikoodi järgi, CSV-parser skeemikontrolliga, identiteedivärav
(`resolveEntityByRegistryCode`) ja fail-safe seisud. Väravad 05.08: `npm test` **2780/2780**,
eslint puhas, `i18n:check` OK. Env: `MTR_BASE_URL` · `MTR_DISABLED=1` · `MTR_USER_AGENT` ·
`MTR_CSV_ENCODING`. Kood ei ole veel ühegi marsruudi ega vaate küljes.

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
| **EI_VAJA_LUBA** | „Selle teenuse osutamiseks ei ole tegevusluba nõutav" | vastavustabeli rida, mille alusel nii otsustati |
| **LUBA_PUUDUB** | „MTR-ist ei leitud kontrolli ajal sellele teenusele kehtivat tegevusluba" | mida otsiti: registrikood, tegevusala, kuupäev + parandustee |
| **KINNITAMATA** | „Tegevusloa staatust ei saanud MTR-is kinnitada" | põhjus: päring kukkus · registrikood ei lahendunud · CSV tundmatu kuju · kontroll vananes |
| **KONTROLLIMATA** | „Tegevusloa staatust ei saanud MTR-is kinnitada" | registrikood puudub profiililt · korje pole veel jõudnud |

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
| **E2** | **Vastavustabel — funktsiooni äriloogika süda.** Platvormi teenusekataloogi kirje → kas loakohustuslik → milline MTR tegevusala. Versioonitud, omaniku kinnitatud, testidega kaetud, muudetav ilma parserit puutumata, iga rea juures õigus- või registriallika viide |
| **E3** | Andmemudel: loakirjed (loanumber, tegevusala, kehtivus, mahupiir, tegevuskoht) + kontrolli tulemus ja aeg. `registryCode` ja `checkedAt` on profiilil juba olemas |
| **E4** | Osutaja vaade: mida kontrolliti, millise koodiga, millise tegevusala vastu, millal, miks selline tulemus, kuidas parandada, kuidas teatada valest vastavusest |
| **E5** | Avalik silt teenusekaardil ja profiilil — **neli teksti**, teenuse ja koha täpsusega |
| **E6** | Admini vaade (alarmid, nimeanomaaliad, korje seis) + korje ajastus |
| **E7** | SK-V1 O-SK-5 haakumine — **eraldi otsuse taga, ei ehita enne** |

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
| **O-A4-1** | korje sagedus ja vananemise aken | automaatkontroll 1×/ööpäevas · käsitsi „kontrolli uuesti" kohe · positiivne märgis kehtib **72 h** viimasest edukast kontrollist · loa lõppkuupäev lõpetab kohe |
| **O-A4-2** | kas mahupiir läheb avalikule kaardile | **V1-s ei lähe.** Hoitakse osutaja ja admini vaates. Kui kunagi läheb, siis ainult sõnastuses „Tegevusloal märgitud maksimaalne isikute arv: 40" — **mitte kunagi „vabad kohad", „kättesaadavus" ega „mahutavus"** |
| **O-A4-3** | kas MTR-luba avab SK-V1 osutaja-raja | **Vajalik, kuid mitte piisav.** Lisaks nõutav: kontrollitud organisatsioonikonto · organisatsiooni teadlik nõusolek kiireid pöördumisi vastu võtta · aktiivne vastutav kontakt · määratud teeninduspiirkond ja reageerimisviis · perioodiline kinnitus, et rada on aktiivne |

Allikad: [MTR tegevuslubade otsing](https://mtr.ttja.ee/tegevusluba?m=97) ·
[MTR/Tarviku tegevusalade infoleht](https://mtr.ttja.ee/infoleht/22) ·
[SKA sotsiaalteenuste järelevalve](https://sotsiaalkindlustusamet.ee/spetsialistile-ja-koostoopartnerile/jarelevalve)
