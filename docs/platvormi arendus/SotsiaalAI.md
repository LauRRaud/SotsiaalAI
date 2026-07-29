# SotsiaalAI — olemus, olulisus ja tulevik

STATUS: elav strateegiadokument. Koostatud 28.07.2026 (Claude, omaniku tellimusel).
Alus: platvormi tegelik kood ja analüüsid + kuus riigi dokumenti, mis on täistekstina läbi
loetud (STAR-i strateegia 2026–2030, täisealise abivajaduse hindamise juhend, TERVIK-eelnõu
05.03.2026, sotsiaalteenuste kvaliteedijuhis, heaolu arengukava 2023–2030, sotsiaalhoolekande
programm 2026–2029) + EPIKoja arvamus + AI-määruse ajaraam. See ei ole unistuste dokument —
iga suurem väide siin toetub kas ehitatud koodile või riigi enda tekstile.

---

## 1. Mis SotsiaalAI praegu on

### Ühe lausega

SotsiaalAI on kiht **inimese elu ja riigi süsteemi vahel**: koht, kus eluküsimusega inimene
saab oma olukorrast selguse enne, kui ta kohtub ühegi blanketiga, ja kus spetsialist saab teha
oma tööd ette valmistades, reflekteerides ja koostööd tehes — ilma et kumbki kaotaks kontrolli
oma info üle.

### Kolm „EI-d", mis defineerivad meid sama palju kui funktsioonid

1. **Me ei pea kliendiregistrit ega dubleeri STAR-i.** Ametlik kandja ei teki platvormil
   kunagi; registrisse liigub ainult see, mille töötaja on ise kirjutanud ja kinnitanud.
2. **AI ei tee ühtegi otsust.** Iga AI väljund on mustand kuni inimese kinnituseni; AI ei
   muuda kunagi privaatset jagatuks.
3. **Mitte midagi ei jagata ilma inimese teadliku, tagasivõetava otsuseta.** Jagamine on
   konkreetne, eesmärgipõhine ja nähtav („Minu jagamised" + tagasivõtt).

Need kolm lauset on ühtaegu tootefilosoofia, õiguslik positsioon ja turunduslause. Neid ei
tohi kunagi pehmendada, sest nad on ainus asi, mida ükski suur konkurent kopeerida ei taha —
kopeerimine tähendaks nende ärimudeli hülgamist.

### Kolm rolli, üks platvorm — positsioon, mida Eestis kellelgi teisel ei ole

- **Pöörduja:** vestlus Eesti allikatega, Teekond (privaatne elusündmuse tööruum),
  eelkaardistus STAR2 hindamisjuhendi seitsme eluvaldkonna raamistikus, eelpöördumine tema
  enda valitud jagamisega, dokumentide selgitamine, kohtumise kokkuvõte vastusega „sain aru /
  mul on parandus".
- **Spetsialist:** vastuvõtulaud, ettevalmistus, koostööruumid ja kõned, kovisioon (8 etappi,
  atomaarne sulgemine ja purge), supervisioon, mentorlus, välitöö võrguta mobiilikest,
  tööheaolu privaatsed tööriistad, artefaktid päritolumärgistusega (kliendi öeldud / töötaja
  tähelepanek / töötaja tõlgendus / AI mustand / dokumendist …).
- **Teenuseosutaja:** teenuseprofiil, teenusekaart tegeliku kättesaadavusega, pöördumiste
  vastuvõtt, abivahenduse sobitus.

Sellest kolmnurgast sünnib võimekus, mida ükski üherolliline süsteem ei saa pakkuda: **sama
sündmuse kolm vaadet** (inimene valmistub → töötaja võtab vastu → teenus leitakse) ilma, et
info kordagi omaniku käest lahkuks.

### Mis on tehniliselt tõsi (mitte lubadus)

- Privaatsuspiirid on **serveris jõustatud** — IDOR-testidega tõendatud; ka admin ei pääse
  võõra kovisioonijuhtumi ega tööheaolu kirjete juurde.
- Koondid on **k≥5 anonüümsuslävega**; individuaalset juhivaadet ei eksisteeri
  arhitektuuriliselt.
- Kriisirada on **fail-closed** kolmes keeles.
- Andmed asuvad Eestis; platvorm töötab kolmes keeles (et/en/ru); ekspordiõigus (GDPR
  andmekoopia) on sisse ehitatud.
- 18 suuremat teemat 28-st on toodangus; maksed töötavad; registreerimine on teadlikult
  suletud kuni avaliku käivituseni.

---

## 2. Miks see on valdkonnale oluline — koht, mille riik on tühjaks jätnud

### 2.1. Vaheruumi tees

Sotsiaaltöö juhtub ruumis **elu ja süsteemi vahel**. Kõik kuus riigi dokumenti, mille ma läbi
lugesin, ehitavad süsteemi poolt: registrid (STAR2), koordinatsioon (TERVIK), riskituvastus
(§ 136 riskirühmitamine), kvaliteedikontroll, andmekogud. See on õige ja vajalik töö. Aga
**mitte ükski neist ei ehita elu poolt** — kohta, kus inimene oma olukorda ise mõtestab, ENNE
kui temast saab menetlusobjekt, ja kus töötaja on inimene, MITTE ainult menetleja.

TERVIK-eelnõu on selle asümmeetria puhtaim näide: tervise teejuht „koostab inimesele",
„selgitab inimesele", „motiveerib" — inimene on läbivalt sihitis. Heaoluplaani
juurdepääsuloendis (§ 135) inimest ennast ei ole. Samal ajal nõuab riigi enda kvaliteedijuhis:
*„Inimest koheldakse võrdväärse partnerina"* ja *„Inimesele tagatakse juurdepääs teda
puudutavale infole."*

**See lõhe — normatiivne lubadus vs süsteemide tegelikkus — ON SotsiaalAI koht.** Me ei
konkureeri riigiga; me ehitame seda poolt, mida riik struktuurselt ehitada ei saa, sest riik
ei saa olla inimese privaatse eneseselgituse teine pool. Register ei saa kunagi olla „minu
oma" — ta on definitsiooni järgi asutuse oma. Isiklik kiht saab tulla ainult väljastpoolt
süsteemi, ja ta peab olema usaldusväärne viisil, mida saab kontrollida.

### 2.2. Keeleliides riigi ja inimese vahel

Sotsiaalvaldkonna sügavaim ligipääsetavusprobleem ei ole rambid ega fondisuurused — see on
**keel**. Menetluskeel, milles riik kirjutab, ja elukeel, milles inimene mõtleb, on kaks eri
keelt. Kvaliteedijuhis nõuab „arusaadavat infot" ja abi „valikute tegemisel"; suurte
keelemudelite küpsus teeb selle nõude esimest korda ajaloos **taristuna** täidetavaks, mitte
brošüürina. SotsiaalAI on sisuliselt **tõlkekiht bürokraatia ja elu vahel** — mõlemas suunas:
inimese lugu → struktuurne eelinfo töötajale; ametlik otsus → arusaadav selgitus inimesele.

See on suund, mida tasub teadlikult nimetada ja kaitsta: *keeleliides heaoluriigile*. Sellel
kihil on väärtus sõltumata sellest, milliseid registreid riik järgmisena ehitab.

### 2.3. Andmeparadoks: riik on pime seal, kus meie näeme

Heaolu arengukava tunnistab ise: *„Praegune sotsiaalteenuste andmestike digiteerituse tase ja
andmekvaliteet ei ole riigi ja kohalike omavalitsuste sotsiaalvaldkonna juhtimiseks,
poliitikakujundamiseks ning teadus- ja arendustööks piisav."* Riigi registrid näevad
menetlusi, mis algasid. Nad EI näe:

- vajadust, millele teenust ei ole (menetlust ei teki → statistikat ei teki);
- töötajate tegelikku koormust ja taastumist (keegi ei julge seda tööandja süsteemi sisestada);
- kas inimese olukord PÄRISELT paranes (registrid loevad tegevusi, mitte muutust).

SotsiaalAI positsioon on ainus, kust need kolm andmekihti saavad üldse tekkida — **ja ainult
sellepärast, et me ei kuritarvita neid**. Teenuste puudujäägikoond, sotsiaaltöö kestlikkuse
baromeeter ja tulemuste mõõtmine on võimalikud ainult platvormil, kus individuaalne jälgimine
on arhitektuuriliselt võimatu. Usaldus ei ole siin moraalne valik, vaid **andmekihi
tekkimise eeltingimus**: päev, mil keegi kahtlustab jälgimist, on päev, mil andmed valetama
hakkavad. See on meie kõige vastuintuitiivsem vara: *me saame näha rohkem, sest oleme
lubanud vähem*.

### 2.4. Ajastus: aken on lahti umbes 2026–2028

Neli sõltumatut protsessi ristuvad just praegu:

1. **Keelemudelite küpsus** — inimkeelne eneseselgitus ja selge keele tõlge muutusid
   tehniliselt odavaks alles nüüd.
2. **AI-määruse jõustumine** (kõrge riski kohustused 02.08.2026) — turule tekib regulatiivne
   sein nende ette, kes tahavad AI-ga *otsustada*; meie oleme teadlikult ettevalmistuskihis.
   Regulatsioon on meile kaitsekraav, mitte takistus.
3. **Riigi reformid** (STAR2 iseteenindus, TERVIK 2027, heaolupiirkonnad) — riik ehitab
   uksi, mille taga peab keegi olema inimese poolel. STAR-i strateegia ütleb ise, et inimene
   võib alustada teekonda „mõnes muus keskkonnas" — *keegi peab olema see muu keskkond*.
4. **Tööjõukriis** — iga riigi dokument algab tööjõu nappusest; iga lahendus, mis päriselt
   vabastab töötaja aega, saab poliitilise tuule.

Kes selle akna ajal inimese-poolse kihi ära ehitab ja usaldusväärseks tõestab, seda on hiljem
peaaegu võimatu asendada — sest usaldust ei saa järele osta.

---

## 3. Kuhu areneda: kolm horisonti

### Horisont A (0–12 kuud): tõestus

Eesmärk: **üks päriselt töötav, mõõdetud, õiguslikult puhas kasutuslugu.**

- Release candidate + T27 koondvärav (kõik edasi lükatud QA-d).
- **Piloot:** üks KOV sotsiaaltööosakond, 2–4 töötajat, 10–30 pöördujat, eelpöördumise
  täisrada. Mõõdikud ilma sisu lugemata. STOP-rada valmis. (Leping ja 12-etapiline mudel on
  analüüsis olemas.)
- **Rahastus:** taotlus Heaolutehnoloogiate innovatsiooniprogrammi (2025–2030, lühikood 437) —
  programmi eesmärgikirjeldus kattub meie väärtuslubadusega peaaegu sõna-sõnalt. Kõrval
  ESF+ pikaajalise hoolduse TAT ja Šveitsi-Eesti programm (spetsialistide koolitus- ja
  tugisüsteem = kovisioon/supervisioon/mentorlus rahastuskeeles).
- **Õigusselgus:** selgitustaotlused SoM-ile ja SKA-le (eelpöördumise staatus, STAR2
  liidesed, kaks vastutavat töötlejat) — sügiskool avab isiklikud kontaktid, kirjad lähevad
  nädal hiljem viitega kohtumisele.
- **ESTA:** mentorite individuaalse nõusoleku voog käima (17 profiili ootab); rollijaotuse
  ettepanek (meie tehnoloogia, nende erialane kvaliteet, privaatandmetele ligipääsu neil ei
  ole kunagi).

### Horisont B (1–3 aastat): laienemine mööda riigi enda tähtaegu

- **1.07.2027 — heaolupiirkondade tähtaeg.** Igas piirkonnas tekivad tervise teejuhid, kelle
  heaoluplaan elab tervise infosüsteemis, aga kelle igapäevatöö (ettevalmistus, märkmed,
  tugimeeskonna koordineerimine, inimese ettevalmistamine kohtumiseks) jääb tööriistata.
  Teejuht on sotsiaaltöötaja kõrval meie teine loomulik professionaalne sihtrühm — ja tema
  tulek on seadusega dateeritud.
- **Teine KOV-laine:** esimese piloodi õppetundidega 3–5 osakonda; CASEWORK-tervik sama
  partneriga; välitöö kest osakondades, kus on outreach-töö.
- **Professiooni taristu:** kovisioon + supervisioon + mentorlus + meetodipeegel ühe
  paketina — „professionaalse arengu keskkond", mida ükski tööandja ega register ei paku.
  Siin on ka vastus valdkonna järelkasvuprobleemile: keskkond, kus algaja saab mentori,
  refleksiooniharjumuse ja kogukonna esimesest tööpäevast.
- **Org-kiht (T25)** aktiveerub alles siis, kui päris organisatsioon seda küsib — kood on
  lepinguna valmis, aktiveerimine on partneri-, mitte tehnoloogiaotsus.
- **Eksport-liidesed:** STAR2 ühesuunaline üleandmine (kui SKA ukse avab — strateegia lubab
  liidestusi teenuseosutajatega); KOV iseteeninduste „ühe ukse" haakumine.
- **Andmekihid käivituvad:** teenuste puudujäägikoond (huvikaitse-andmekiht) ja kestlikkuse
  baromeeter — mõlemad ainult partnerite ja selge õigusaluse olemasolul.

### Horisont C (3–10 aastat): isiklik heaolukiht elukaarel

- **Teekond muutub elukaare-pikkuseks:** mitte üks pöördumine, vaid inimese oma pidevuskiht
  läbi elusündmuste (lahutus, hooldus, töökaotus, vananemine) — riigi süsteemid tulevad ja
  lähevad, inimese lugu jääb tema omaks. „Teekonna kompass" (kus olen / mis on muutunud /
  mis järgmiseks) on selle esimene kehastus.
- **Ruumiline kogemus** (VR-põhjatäht: järveäärne tuba, klaaskaardid, lend läbi ruumi) —
  mitte efekt, vaid rahu disainiprintsiibina: keskkond, mis ise on abi osa. Tehniline alus
  (lennumootor, dokk, klaasikeel) on juba kolmes kohas koodis.
- **Lokaalsed mudelid:** eesti keele kõnetuvastus, isikuandmete märkaja enne jagamist, OCR —
  seadmes või Eesti serveris. Suveräänsus muutub müügiargumendist nõudeks; me oleme valmis.
- **Tulemuste mõõtmise kiht:** kvaliteedijuhis nõuab mõju hindamist „koos inimesega" — meie
  oleme ainus koht, kus inimene saab ise, vabatahtlikult ja koondatult öelda, kas ta olukord
  paranes. Riik mõõdab tegevusi; inimene saab mõõta muutust. See kiht võib kümne aasta pärast
  olla valdkonna kõige väärtuslikum tagasisideahel.
- **Mudeli eksport:** „inimese-poolne kiht heaoluriigile" on universaalne probleem. Eesti on
  ideaalne esimene maa (väike, digivõimekas, üks keel, üks register) — ja toimiv Eesti mudel
  on müüdav igale Põhjamaale. See on e-riigi loo puuduv peatükk: X-tee ühendas asutused,
  SotsiaalAI-laadne kiht ühendab inimese.

---

## 4. Funktsioonid: mis lisandub ja mille järgi me otsustame

### Otsustusväravad (iga uue funktsiooni 4 testi)

1. **Omaniku test:** kas see suurendab inimese kontrolli oma loo üle? (Kui väheneb — ei.)
2. **Varju test:** kas see hakkab dubleerima ametlikku registrit? (Kui jah — ei, ehitame
   selle asemel eksport-ukse.)
3. **Kihi test:** kas vähemalt kaks olemasolevat voogu saavad seda taaskasutada (K1–K8
   ühiskihid)? (Kui ainult üks — kas ta on piisavalt väärtuslik üksi?)
4. **Usalduse test:** kas funktsiooni saab kuritarvitada jälgimiseks, ja kas see võimalus on
   arhitektuuriliselt suletav? (Kui mitte suletav — ei.)

„Mitte ehitada" nimekirjad on sama tähtsad kui tegevuskavad — need on seni ära hoidnud
tööandja dashboardi, heaoluskoori, automaatse triaaži ja registri kloonimise. See distsipliin
on strateegiline vara.

### Omaniku otsus (28.07.2026): midagi ei kärbita

> „Mina hoiaks kõik asjad alles ja arendaks lõpuni, ja arendaks ka mingid ideed, mis olid
> veel sahtlis."

See on siduv suund: ükski olemasolev võimekus ei sure ja sahtliideed jäävad kaardile. Neli
väravat (ülal) EI ole sellega tühistatud — nad muutuvad tapariistast **järjestajaks**: nad ei
otsusta enam, KAS midagi ehitatakse, vaid MILLAL ja mis tingimusel. Ainus, mis jääb päriselt
keelatuks, on „Mida me EI ehita" loend (allpool) — see kaitseb usaldusarhitektuuri, mitte
ressurssi.

„Lõpuni arendamine" vajab iga asja juures kahte definitsiooni: **mis on „valmis"** ja **mis on
tema järgmine ühik** (kood / kasutaja / partner / otsus). Register allpool annab mõlemad.

**Teine omaniku otsus (28.07.2026): õigusselgus väravaks aktiveerimisele, mitte ehitusele.**

> „Pigem ei jää ootama õiguslikku infot funktsiooni välja arendamiseks, vaid saame funktsiooni
> lihtsalt peita."

Registri kõiki ridu, mille tingimus on „õigusanalüüsi taga" või „otsuse taga", loetakse nüüd
nii: **ehitus võib alata kohe; värav kehtib sisselülitamisele.** See on juba platvormi
tõestatud muster — recurring-maksed on toodangus *fail-closed dormant*, salvestus on
env-lippude taga, registreerimine sulgub ühe konstandiga; org-kihi analüüs sõnastas sama
põhimõtte ammu („otsused ei blokeeri koodi, vaid aktiveerimist").

Üks aus piirang, et peitmine päriselt kaitseks: **peidetud funktsioon on õiguslikult
neutraalne ainult seni, kuni temas ei ole päris isikuandmeid.** Kui varjatud funktsioon juba
kogub andmeid, on risk olemas sõltumata nähtavusest. Seega „peidetud" tähendab meil alati:
lipp väljas + 0 päris isikuandmeid + skeem disainitud nii, et õiguslikult tundlik osa on
additiivne (saab hiljem sisse lülitada ilma tagasiulatuva töötluseta). Sünteetiliste
andmetega tohib pime funktsioon elada täisvormis.

### Täisarenduse register

**A. Toodangus, sabad lõpetada** („valmis" = saba loend tühi + päriskasutuses tõendatud)

| Võimekus | Mis on „lõpuni" | Järgmine ühik |
|---|---|---|
| Vestlusaken + RAG | kvaliteedi baasjoon mõõdetud, otsinguparandused selle peal; vestlus-UX/kriisiraja süvaanalüüs tehtud | kood (RAG-QM-P0) |
| Teadmusbaas | allikavärskuse päris protsess + juhendite värskuskanal; elutsükli 3 riski suletud; P8 URL-korje | kood (väike) |
| Teekond | TK-P0 jagamispiir → TK-P5 esitluskiht; Teekonna kompass | kood (TK-P0 enne pilooti) |
| Eelpöördumine + vastuvõtulaud | piloodis tõendatud täisrada; receiver-workbench UX-ring | kasutaja (piloot) |
| Tööheaolu | TO-otsused → nädalarütm + naasmispunkt (TH-RUUM-P0) → P3–P5; esimesed päriskirjed | otsus + kasutaja |
| Kovisioon | Faas A vastuvõtt → etapid 3–8 ruumiliselt → privaatne märkmik; päris grupp | omaniku vastuvõtt + kasutajad |
| Supervisioon | SUP-V1 analüüs → P1–P11; päris superviisorid | analüüs + partner (ESTA) |
| Mentorlus | ESTA mentorite nõusolekud; esimesed suhted | partner |
| Meetodipeegel | sekkumispäevik + vahehindamine (ideed 8.5); kliendi tagasiside (8.6, otsuse taga) | kood, väike |
| Välitöö | seadme-QA maatriks + oma piloot outreach-osakonnaga | partner + QA |
| Vestlusruumid + kõned | päris-egress QA (T27); kõne elutsükli/nõusoleku süvaanalüüs | QA |
| Abisoovid/-pakkumised | kriitiline mass + match-nõusoleku tooteotsus + moderatsioonimudel | kasutajad + otsus |
| Dokumendid + koostamine | analüüs püsivaks objektiks (leitavus); Journey-side | kood, väike |
| Teenusekaart + profiil | kättesaadavuse elav signaal (B-U4); loendivaade/klasterdamine; usaldusmärgistus | kood + otsus |
| Materjalid | esimesed spetsialistide esitatud materjalid läbi ülevaatuse | kasutajad |
| Isiklik otsing | — (valmis; hoia) | — |
| Töölaud + teavitused | U1 mitme-osaleja audience-reegel (outboxi järgmine viil) | kood |
| A11Y/keeled | RV-P1+, tõlkestrateegia, P1 juured | kood |
| Maksed | päris Maksekeskuse sponsorkutse tõendus toodangus; recurring sisse omaniku otsusel | QA + otsus |

**B. Sahtel — pargitud teemad, mis ärkavad** („valmis" = teema oma lepingu DoD)

| Sahtliidee | Kust | Ärkamise tingimus |
|---|---|---|
| Häälvestlus (T03 E4/E5) | pargitud haru = retsept | kriisiraja süvaanalüüs + mudelivalik WER-mõõtmisega |
| Failid-meedia elutsükkel (T08) | analüüs valmis | omaniku „nüüd"; eeldus salvestuste laienemisele |
| Ruumiline töölaud / VR (T19) | 4 prototüüpi + põhjatäht | kasvab viiludena niikuinii (dokk, lend, klaas); T19 kui tervik = horisont C |
| Org-kiht (T25) | kood lepinguna valmis | esimene päris organisatsioon küsib |
| Partnerpiloot (T26) | 12-etapiline mudel valmis | O-PP otsused + RC — see ON horisont A |
| ESTA foorum, piirkonnaruumid, teemakogukonnad, häälruum (ideed 27) | ideed.md | ESTA partnerlus sõlmitud; MVP = ptk 27.12 |
| ESTA liikmepakett + 1€ mudel (ideed 26) | ideed.md | sama lepe; lahendab ka „kes maksab tööriistade eest" |
| Perearst/tervishoiukontakt võrgustikus (ideed 5.7) | ideed.md | TERVIK-reform teeb selle aktuaalseks; kandidaat teejuhi-tööruumi kõrvale |
| Lokaalsed mudelid (eesti STT, PII-märkaja, OCR, VAD) | eraldi analüüs | prototüüpimisjärjekord on kirjas; esimene = PII-märkaja (väikseim, suurim privaatsusvõit) |
| Kaamera/näpistusgrammatika, ruumi juhtpaneel (ideed 28) | ideed.md | VR-viilude järel; mitte enne, kui ruumiline kest on igapäevane |
| Kestlikkuse baromeeter (ideed 20) | analüüs valmis | ESTA tõlgendaja + O-WB-3 õigusanalüüs |
| KOV kuukoond (ideed 21) | analüüs valmis | partnerlepe + baromeetri pretsedent |
| Teenuste puudujäägikoond (U5) | analüüs valmis | piloodi-KOV + k≥5 leping |
| Genogramm + ökokaart (T21 P4/P5) | leping valmis | O-CW-7 õigusanalüüs (laste andmed = tuum) |
| STAR2 eksport-uks (T21 P2) | vorming mõeldud | SKA liides VÕI „käsitsi kiire" režiim juba enne |
| Võrgustiku täisfunktsioon (T20 P4–P6) | leping valmis | O-CO-6 GDPR-analüüs |
| Avalik kest + copy (T10 E1/E2) | pooleli | release-rada — läheb RC-sse niikuinii |

**C. Uued ideed (28.07, riigi dokumentidest sündinud)** — sahtli värskeim sahtel

| Idee | Ajend | Esimene samm |
|---|---|---|
| Heaoluplaani peegel | TERVIK § 134–135: inimene on plaanis objekt | disainileping pärast eelnõu lõppversiooni |
| Tervise teejuhi tööruum | TERVIKud 1.07.2027, teejuht tööriistata | kuluaarivestlused sügiskoolis; spetsialisti-kesta kohandus |
| Omastehooldaja ruum | arengukava: hooldajate teadlikkus = kitsaskoht | vajaduskaardistus (Koppel/EPIK sisend) |
| Kriisirežiim | hoolekandeprogrammi toimepidevus; offline-kest olemas | kontseptsioonileht; võimalik eraldi rahastusuks |
| Juhendite värskuskanal | riigi juhendid muutuvad teavituseta | esimene sisend = ajakirja Sotsiaaltöö uudiskiri (vt allpool) |
| Lubaduste audit | /voimalused = 19 avalikku lubadust | iga lause → tõend/parandus; T10 release-raja osa |
| **Erihoolekande profiil Teenuspäevikule** | **UUS (SHS § 85):** tegevusplaan koos isikuga + kvartalihinnang + aastahinnang = seadusega ette kirjutatud aruanderütm; tegevusjuhendajad = suur kasutajaskond | Teenuspäevik OSA III; vt shs-katvuskaart.md A1 |
| **Toimetulekutoetuse eelkalkulaator** | **UUS (SHS § 131–134):** deterministlik valem + selge keel; informatiivne eelhinnang, MITTE otsus | pöörduja tapjafunktsioon; avalik versioon = SEO-uks; A2 |
| **Abivahendi teekonna selgitaja** | **UUS (SHS § 46–55):** tõend→loetelu→piirhind→müüja samm-sammult | pöörduja moodul + müüjad Teenusekaardile; A3 |
| **MTR/tegevusloa kontroll profiilil** | **UUS (SHS § 147–155):** avalik register → usaldusmärgise OBJEKTIIVNE komponent | osutaja-paketi aste 1; A4 |
| **Võlanõustamise eelkaardistus** | **UUS (SHS § 44):** eelpöördumise erikuju võla-profiiliga | A5 |
| **„Teata abivajajast" avalik juhis** | **UUS (SHS § 13):** igaühe seadusekohustus + Teenusekaardi KOV-kontaktid | kontota avalik leht; A7 |
| **Hooldekodu valiku rada** | **UUS (SHS § 20–22²):** hooldereformi rahastus + valikujuhis | pöörduja moodul; A8 |
| **Häirekeskuse järelsuunamise sild** | **UUS (kauge; ajend: Sotsiaaltöö 2/2025 essee „sotsiaalkiirabist" — häirekeskus kulutab sotsiaalkõnedele ~35 h/PÄEVAS):** mitte-hädaabi sotsiaalkõne saaks digitaalse järeltee (link: „mõtle olukord selgeks + sinu KOV-i kontakt") | partner-gated (Häirekeskus/SoM); positsioneering: „sotsiaalkiirabi on unistus 2050-ks, selguse-kanal töötab täna, 24/7" |
| **Ukraina keel / sisserändajate rada** | **UUS (ajend: Rosenthal 2050-essee — „erineva kultuuritausta ja keelega inimeste toetamine kui keskne ülesanne"):** 4. keele kandidaat; i18n-arhitektuur kannab (messages ×4 + RAG-vastuste keel); sisserände/kliimapõgenike kontekstis päris vajadus | sahtel; kaalu koos avaliku Q&A kihiga (vene rada enne — suurem olemasolev sihtrühm). **RAHASTUSKONKS (29.07): Šveitsi-Eesti programm 2024–2028 sihib sõnaselgelt eri keele- ja kultuuritaustaga inimeste osalust (~23 M€) — keelekihi taotlus sobiks sinna nagu valatult; vt 5.11** |
| **VIPS-spetsialistide tööruum** | **UUS (ajend: astmelise abi pilot, vt 5.12):** riigi loodav uus töötajasrühm (väljaõppega, EI OLE tervishoiutöötajad, KOHUSTUSLIK regulaarne supervisioon) — sama muster mis tervise teejuhi tööruumil: kohtumiste kokkuvõtted, supervisioonirütm, kovisioon, tööheaolu, teadmuskiht; kliinilist dokumentatsiooni EI (see jääb nende süsteemi/TIS-i, meie ei ole meditsiiniseade) | sahtel; kell = piloodi käivitumine/laienemine (40-kuuline projekt käib); jälgi VIPS-arendamise taotlusvoore |
| **SOTSIAALVALVE (KOV valvelaud)** | **UUS (omanik 29.07: „saaks platvormil ära teha või edasi arendada?" — sotsiaalkiirabi KIHT 2, mida essee ise ei näinud):** KOV-idel on valved juba OLEMAS (lastekaitse valvetelefonid, valvegraafikud), puudu on TÖÖRIIST — valvelaud: öised signaalid („teata abivajajast" + kiireloomulised eelpöördumised) triaažitud järjekorda valvetöötajale; valvekirjed Teenuspäeviku mustris; ÜLEANDMINE hommikusele vahetusele; valvegraafik = E10 mootor. Piirid kivisse: EI ole hädaabinumber, EI luba reageerimisaega, AI ei tee triaažiotsust (inimene valib kiireloomulisuse, elurisk = alati 112); valvepersonal = KOV-i oma, meie anname laua | vajab 1–2 valve-KOV-i pilooti; kihiline positsioneering: SotsiaalAI = sotsiaalkiirabi EELKIHT (24/7 selgus, olemas) + TÖÖRIISTAKAST (valvelaud, välitöö kest, kriisirežiim) + TÕENDUSBAAS (öiste mustrite k≥5 koond — essee 35h oli ühe päeva käsianalüüs, meie annaksime pideva mõõtmise); pehme käik = ühisartikkel essee autoritega ajakirjas Sotsiaaltöö („Unistusest prototüübini"). **KOLMEKIHILINE VALVE (omanik 29.07: „personal võiks olla SotsiaalAI assistent või abi otsene platvormil"):** kiht 1 = **AI öine esmatugi** (OLEMAS: kuulab/selgitab/kriisimuster→kontaktid; avalik nimi MITTE „personal" — sõna loob sekkumisootuse, mida AI kanda ei saa); kiht 2 = **„öö kuulab, hommik tegutseb"** (EHITATAV: öövestlus vormistub inimese NÕUSOLEKUL kokkuvõtteks → hommikune valvejärjekord alustab sisust — AI on valve öösekretär, mitte personal; olemasolev eelpöördumise/U10 muster); kiht 3 = **inimvalve platvormi KAUDU** (valvetöötaja vastab ruumis/kõnes sealsamas, kus inimene on — ruumide infra olemas; vastutuse kandja ALATI inimene; elurisk = alati 112; AI ei triaaži otsustavalt = AI-määruse kaitsekraav). KULUARGUMENT: AI-esmakiht → iga KOV ei vaja oma öövalvet, piisab PIIRKONDLIKUST ühisvalvest (heaolupiirkonnad 2027 = valmis struktuur) — „vähem valvetunde, parem vastus" |

**Teadmusbaasi uudiskirjakorje (omanik 28.07).** Ajakirja Sotsiaaltöö uudiskiri (11×/a) on
tasuta KUREERITUD värskusvoog uutest artiklitest, juhenditest ja uuringutest — toimetus teeb
valiku meie eest. Väljaandja alates 2026: SKA + SoM (kolis TAI alt ära). **Õigused: omanik
töötas ise ajakirjas; vastutav toimetaja Regina Lind (endine kolleeg) on andnud loa ajakirja
kasutamiseks andmebaasis** — seepärast ongi artiklid juba RAG-is. Soovitus: küsi Reginalt
lühike KIRJALIK kinnitus uue väljaandja (SKA+SoM) all — mitte usaldamatusest, vaid sest
väljaandja vahetus 2026, platvorm on tasuline ja kirjalik rida kaitseb ka Reginat ennast;
avaliku lehe üldtingimus („õppe- ja koolitustöös") ei kata ärikasutust, sinu luba on erand,
mis väärib paberit. Korjetorustik olemasoleva RAG-infra peal: e-postiarhiiv (vanad numbrid;
avalikul lehel ainult 2026) + leht + tellimus → parser (lingid+pealkirjad+kontekst →
kandidaatide JSON, master_sources mustris) → õigusklass lingi kohta (riigi juhendid =
ametlikud dokumendid, täistekst vaba; ajakiri = luba olemas; uuringud allikapõhiselt;
sündmused ei lähe) → RAG-admini ülevaatusvoog → ingest + checkedAt. Edaspidi ~30 min/kuu
uue numbri peale. Parser = väikese skripti mõõtu, järgmise sessiooni kandidaat.
**Empiiriliselt tõendatud 28.07** (numbrid 1/2026 ja 7/2026 päriselt alla laetud ja parsitud):
webcopy-link on puhas HTML (192–204 KB), JS-i ei vaja; sihtlingid istuvad trck-linkide `url=`
parameetris — **dekodeeri parameeter, ÄRA järgi trck-linki** (jälgimisvaba, ei sõltu smaily
püsimisest); e-postiarhiiv = kindlaim allikas, avalik leht varu. Saak: 1/2026 = 124 sihtlinki
(13 PDF-i, sh perevägivalla juhend, õiguskantsleri seisukoht, IFSW); 7/2026 = 100 sihtlinki
(5 riigi uuringu/juhendi PDF-i, 2 õiguskantsleri, 2 riigikohtu lahendit, 1 eelnõu, 20 SKA/SoM
uudist, 6 ajakirja artiklit → dedupe, 15 koolitust/sündmust → välja). Hinnang: ~10–25
RAG-väärilist kirjet numbri kohta ≈ 150–250 allikat aastas + vanade numbrite järelkorje.
Ingest: HTML otse; PDF laetakse ja parsitakse automaatselt (`pdf-parse` on juba projektis).

**Katmata analüüsid** (enne vastavat ehitust): vestlus-UX + kriisirada · häälvestluse tervik ·
receiver-workbench · kõne elutsükkel ja nõusolek · RAG edasiarendusprogramm · SUP-V1-A0 ·
KOV-V2-A0.

### Multimodaalne juhtimiskiht (omaniku küsimus 28.07: Realtime-mudel + RAG, kaamera, hääl)

Juhtprintsiip: **hääl ja kaamera on liides, mitte teine aju** — iga sisuline vastus käib läbi
sama tekstitorustiku (RAG + allikad + kriisirada + kvoodid), mis kannab platvormi lepingut.

1. **Realtime-kõnemudel + RAG:** töötab tool-calling'uga. Arhitektuurivalik: kaskaad
   (STT → olemasolev torustik → voogav TTS; ~1,5–2,5 s, leping muutmata) → siht on hübriid
   „õhuke hääl, paks server" (realtime-mudel hoiab ainult vooru ja kutsub KOHUSTUSLIKULT
   sisu-tooli; ~1 s tunnetuslikult). Puhas kõne-kõne (mudel vastab ise) EI sobi — vastuseleping
   nõrgeneks. Allikad kuvatakse ekraanil rääkimise ajal. **LiveKit on toodangus olemas** —
   häältorustik ehitada LiveKit Agents mustris, Realtime-mini on vahetatav komponent, mitte
   arhitektuuri omanik.
2. **Hääl „ilma viivituseta" = käskude ja vestluse lahutamine.** OLEMASOLEV komplekt
   (kontrollitud koodist 28.07): STT = OpenAI `gpt-4o-mini-transcribe`
   (`lib/transcription/provider.js`, failipõhine), TTS = Google Cloud `et-EE-Standard-A`
   (+ ru/en; varuks OpenAI `gpt-4o-mini-tts`) — mõlemad kvooditud (`STT_SECONDS`/`TTS_CHARS`)
   ja rate-limititud. **Kõnerežiim EI vaja uusi teenusepakkujaid** — kaks režiimimuudatust:
   (a) STT failist voogavaks (sama OpenAI mudel toetab Realtime-transkriptsiooni liidest;
   või VAD lõikab lausungi ja saadab tervikuna — ~0,5–1,5 s, vestluseks piisav);
   (b) TTS lausekaupa (Google'ile lause haaval = pseudo-vooguv). Käsklused: Silero VAD (WASM)
   + fikseeritud ~20–30 fraasi ruuter; AUS latentsus pilve-STT-ga on ~0,5–1 s, mitte <300 ms —
   osatulemuse esiletõst (kaart süttib enne lause lõppu) päästab tunnetuse; päris-instant
   vajaks kunagi lokaalset mudelit (optimeering, mitte eeldus). Barge-in kohustuslik. Hääl ei
   käivita pöördumatut tegevust kinnituseta.
   **TalTech/EKI = valikulised TULEVIKU-alternatiivid, mitte eeldused** (omanik 28.07: „ma ei
   tea nendest midagi" — õigustatud): TalTechi keeletehnoloogia labor avaldab tasuta eesti
   STT-mudeleid oma serveris jooksutamiseks („voogav" = transkribeerib sõna haaval heli
   saabudes, ~0,1–0,3 s; failipõhine ootab lausungi lõppu; jooksutaja = sherpa-onnx, ka
   brauseris/telefonis, ilma pilveta).
   **Eesti TTS — KAKS ERI ökosüsteemi (parandus 28.07, ära aja segi):**
   (a) **TartuNLP** (Tartu Ülikooli keeletehnoloogia grupp; neurokone.ee on nende avalik
   nägu) — `POST api.tartunlp.ai/text-to-speech/v2` `{text ≤10 000 tm, speaker, speed}` →
   WAV; võtmeta; **12 eesti neuraalset häält + 2 võro**; **MIT-litsents, kood+mudelid
   GitHubis (`TartuNLP/text-to-speech-api`) = ISE-HOSTITAV** — suveräänsuse-rada ilma
   loaküsimiseta. Hostitud API miinused tootmises: SLA puudub + kasutajate vastusetekstid
   läheksid kolmandale osapoolele (GDPR volitatud töötleja küsimus) → tootmisse
   ise-hostituna; viisakuskiri ping@tartunlp.ai (võimalik koostöö). Katsetus: lisa
   `tartunlp` kolmanda pakkujana olemasolevasse TTS-route'i (~50 rida, lipu taga),
   kõrvavõrdlus Google `et-EE-Standard-A` (mitteneuraalne) vastu.
   (b) **EKI** (Eesti Keele Instituut, vanem teenus, `teenus.eki.ee/synthub`) —
   litsentsikonks: arhiivileht lubab „privaatselt mitteärilistel eesmärkidel"; ärikasutuseks
   küsida heli@eki.ee. Eelistus on (a).
   Aktiveerimispäästikud endised: riigipartneri „kus heli töödeldakse?", kasvav pilvearve,
   võrguta välitöö.
   **Kõnerežiimi majandus (omanik 28.07: „hea ja soodne; piirang kasutajal, millegi muu
   arvelt; vastused 10–15 s; kas RAG kannab pikka kõnet; nuppudeta"):** (a) kaskaad on
   struktuurselt odavam ja jookseb OLEMASOLEVATE teenustega — STT = senine OpenAI
   mini-transcribe (voogavas režiimis), mõistmine = olemasolev kvooditud torustik, TTS =
   senine Google/OpenAI lausekaupa; Realtime-mini arveldab helisekundeid mõlemas suunas ja on
   hilisem „tunnetuse-turbo", mitte alus (transport on LiveKitis nagunii); (b) **uut kvooti EI
   looda** — kõne põletab olemasolevaid arvesteid (`STT_SECONDS` + `CHAT_ASSISTANT_REPLY` +
   `TTS_CHARS`), mis ONGI „millegi muu arvelt"; lisada ainult kõne maksimumpikkus (~10 min) +
   päevane häälelimiit; tasandi-värav (kas kõigil tasulistel või 14,99+) = omaniku
   hinnastusotsus; (c) **3 lause leping**: 10–15 s ≈ 2–3 lauset ≈ 150–250 tm; hääl annab tuuma,
   TÄISVASTUS koos allikatega maandub alati tekstina vestlusesse — lahendab korraga UX-i,
   kulu ja allika-lubaduse; (d) RAG kannab pikka kõnet juba täna (vestluslõng + ajalugu);
   lisada otsingu-ruuter pöörde kohta (jätkuküsimus ei käivita otsingut), lausekaupa voogav
   TTS, barge-in = olemasolev aus Stop; (e) **kõnerežiim on eraldi pind nagu telefonikõne**:
   opt-in, lahtine mikrofon, lokaalne VAD teeb vooruvahetuse (~0,7 s vaikus = vooru lõpp),
   elavad subtiitrid + allikakaardid ekraanil, „vaigista" ja „lõpeta" — dikteerimis-mikker
   jääb komposeris eraldi funktsiooniks.
   **Kaks rada, üks mikrofon (omanik 28.07: „ava vestlus" JA „selgitan, AI mõistab ja
   tegutseb"):** ruuter valib raja, mitte kasutaja — sõnastikuvaste (kõrge kindlus) → RADA 1
   kohalik refleks; muu → RADA 2 = LLM kui kavatsuste TÕLK. Rada 1 sõnastik on juba olemas:
   doki sildid (`roomDock.js` = marsruutide semantiline kaart) + käputäis tegusõnu; osaline
   vaste süütab kaardi enne lause lõppu; mitmetähenduslikkus → mõlemad süttivad + „kumba?".
   Rada 2 turvamudel: **AI ei saa kunagi vaba kätt ekraani üle — ta saab sama piiratud
   kavatsuste sõnastiku, mis nooleklahvid**; „AI on mustand" üldistub tegevustele
   (navigeerimine = pöörduv → täidab kohe; loomine/saatmine/kustutamine → AI valmistab ette,
   inimene kinnitab); iga AI-kavatsus logitud ja nähtav. NB rada 2 on tekstina juba toodangus
   („vestlusest saab alustada töövooge") — hääl on sama mustri uus sisend, mitte uus
   filosoofia. Faasid: (1) sõnastik + esiletõst doki peal → (2) LLM-tõlk ainult
   navigeerimiseks → (3) toimingud kinnitusega; kaugsiht = assistent „kätega" (pakub ise:
   „kas avan vormi?" → „jah" = kavatsus).
3. **Kaamera:** MediaPipe käetuvastus brauseris (WASM/WebGPU); **kaader ei lahku kunagi
   seadmest**, välja lähevad ainult semantilised sündmused. Kaamera on alternatiivne sisend,
   mitte nõutav (žestiväsimus + a11y). Sihtkaart on olemas (dokk/jaamad/lennumootor). WebXR
   käetuvastus tuleb hiljem sama kihi peale.
   **Žestikeel v1 (omanik 28.07): vehe = liigu, näpistus = vali.** Karussell on valmis vastuvõtja —
   tal on juba kolm kavatsust (prev/next/select), mida klaviatuur ja näpuvedu kasutavad; kaamera
   on ainult uus adapter. Disainireeglid, milleta žesti-UI kukub: (a) **tagasitõmbe lõks** —
   vehe = randme KIIRUS üle läve + suunalukk + ~500 ms puhkeaeg (muidu loeb käe tagasitulek
   vastassuuna vehkeks); üks vehe = üks samm; (b) **peegeltelg** — kaamera on peegelpilt,
   x-telg peegeldada, muidu juhtimine tundub tagurpidi; (c) **näpistus avab lahtilaskmisel**
   (nagu klõps mouseup'il) → kogemata näpistuse saab tühistada kätt kõrvale liigutades;
   näpistuskaugus normaliseeritud käe suurusega + hüsterees; vehke ajal näpistust ei loeta;
   (d) **kohaloleku indikaator** („näen su kätt") + selge opt-in lüliti (ülaserva juhtpaneel) +
   auto-off. Sama kahe žesti grammatika skaleerub jaamalendudele (vehe = järgmine jaam) ja
   VR-i — see on platvormi žestikeel, mitte karusselli funktsioon.
4. **Ehita üks kord: KAVATSUSTE SIIN (intent bus)** — hiir, klaviatuur, häälkäsk ja näpistus
   emiteerivad samu kavatsusi (`open_panel:x`, `select:next`, `confirm`, `dismiss`); UI kuulab
   ainult kavatsusi. Iga uus sisend on edaspidi adapter, mitte projekt; ligipääsetavus muutub
   arhitektuuriks (kõik juhitav ka klaviatuuri/lülitiga); testitav ilma mikrofoni ja kaamerata.

**Omaniku 6 soovi (28.07) = üks torn kuue korrusega, ehitusjärjekord** (kõik lipu taga;
uusi teenusepakkujaid null; kulu käib olemasolevate arvestite kaudu):
V1 STT+TTS nupuga = **JUBA VALMIS** (mikker + ettelugemine) →
(1) **kavatsuste siin** (vundament, 0 kulu, teenib ka klaviatuuri/a11y) →
(2) **V2 käed-vabad dikteerimine**: Silero VAD brauseris (kõne algus avab, ~0,7 s vaikus
saadab, vastus loetakse ette) — sama tariif mis V1 →
(3) **H1 häälnavigatsioon**: sama mikrofonisilmus + käsuruuter (doki sildid = sõnastik) +
kaardi süttimine osatulemusel →
(4) **V3 kõne-pind**: voogav STT (sama OpenAI mudel, uus ühendusviis) + lausekaupa TTS +
barge-in + elavad subtiitrid + allikad; kaitseriivid (max kõne ~10 min, päevalimiit) →
(5) **V4+H2 assistent „kätega"**: tool-calling kavatsuste sõnastiku peal; navigeerib vabalt,
muudab ainult kinnitusega; platvorm küsib täpsustusi häälega („kumba mustandit?"); LLM-tõlk =
mini-mudel, sent-murdosad käsu kohta →
(paralleelselt, sõltumatu) **TartuNLP TTS kolmanda pakkujana** lipu taha, kõrvavõrdlus, võidu
korral ise-hostituna tootmisse. Kolm suurimat kuluhooba on disainiotsused: 3 lause leping,
otsingu-ruuter (jätkuküsimus ei käivita RAG-i), barge-in (poolelijäänud vastust ei genereerita
lõpuni). Realtime-mini jääb V3 valikuliseks „tunnetuse-turboks". Lisaks: WER-mõõtmine eesti
keeles enne mudelivahetusi; näpistus-prototüüp kavatsuste siini peal pärast sammu 3.

### Järjestusloogika (kuidas „kõik lõpuni" ellu jääb)

Jadatöö reegel jääb: korraga kirjutab koodi üks teema. Järjekorra annavad kolm kella:

1. **Piloodi kell** — kõik, mis on piloodi eeldus (TK-P0, RC, lubaduste audit), enne kõike.
2. **Riigi kell** — seadusega dateeritud aknad (teejuhid 1.07.2027; AI Act 02.08.2026;
   STAR2 liidesed strateegia tempos) — nende ettevalmistus algab varem, sest tähtaeg ei
   nihku meie järgi.
3. **Partneri kell** — ESTA/KOV/superviisorid avavad terved plokid (mentorlus, foorum,
   baromeeter) ilma meie koodita; partneritöö käib kooditööga PARALLEELSELT, sest ta ei
   kuluta sama ressurssi.

Kõik muu — sahtel B ja C — säilib registris koos ärkamise tingimusega. Mitte miski ei kao;
kõik teab, mille taga ta ootab.

### Mida me ka tulevikus EI ehita

Automaatne triaaž ja riskiskoorimine inimeste üle · tööandja individuaalvaade · „jaga kogu
Teekond" nupp · vaidlustusmenetluse esindamine · ametlik register mis tahes kujul · engagement-
optimeerimine (vt 5.7).

---

## 5. Strateegiad

### 5.1. Sisenemine: kitsas kiil, mitte lai rinne

Üks täisrada (eelpöördumine) ühe partneriga lõpuni ja mõõdetult — alles siis järgmine.
Laienemise järjekord käib mööda **külgnevusi**: sama partner + uus voog (CASEWORK), sama voog
+ uus partner (2. KOV), sama kest + uus roll (tervise teejuht). Mitte kunagi „kõigile kõike
korraga" — visioon on asutuse mõõtu, aga ehitaja on üks, ja see nõuab halastamatut järjekorda.

### 5.2. Partnerlus: neljast sõltumatust jalast koosnev usaldus

- **ESTA** — erialane kvaliteet ja tõlgendus (rollijaotus on valmis kirjutatud; privaat-
  andmetele ligipääsu ei saa nad kunagi — see on usaldusargument, mitte piirang);
- **KOV-id** — piloot ja igapäevane väärtus;
- **SoM/SKA** — õigusselgus, liidesed, rahastusprogrammid; mitte lubade küsimine, vaid
  selgitustaotluste ja töötavate näidete keel;
- **EPIK ja kogemusorganisatsioonid** — inimese poole valvurid; nende kriitika TERVIK-ile
  kattub meie printsiipidega, mis teeb neist loomuliku liitlase. Kaugem siht: platvormi
  **privaatsusnõukoda** (ESTA + EPIK + kogemuseksperdid), mis annab väikesele ettevõttele
  institutsionaalse usalduse ilma agiilsust kaotamata.

### 5.3. Rahastus: kaks jalga + avalik raha kolmandaks

Tellimused (rollipõhine kuutasu — töötab juba) + tulevikus KOV-/asutuselitsents (piloot loob
hinnastusaluse) + projektiraha (innovatsiooniprogramm 437, ESF+ TAT-id, Šveitsi programm).
Reegel: avalik raha ehitab ÜHISHÜVE kihte (baromeeter, puudujäägikoond, ligipääsetavus,
liidesed), tellimusraha ehitab toodet. Nii ei teki sõltuvust, kus projektiraha lõpp tapab
põhiteenuse.

**Maksja-strateegia (arutatud 28.07).** Lähtepinge: tänane maksja on vale inimene — abivajaja
on väikseima maksevõimega klient (kvaliteedijuhis nõuab taskukohasust) ja spetsialist, kes
maksab ise oma töövahendi eest, on anomaalia (= sügiskooli E3). **Sihtpilt: pöörduja rada
muutub järk-järgult sponsoreerituks/tasuta; tulu tuleb professionaalidelt, asutustelt ja
avalikust rahast** — astmeliselt, praegust tulu ei tapeta enne asendust. Kuus mudelit
järjekorras: (1) isiklik tellimus (töötab; recurring tehniliselt valmis, serveris väljas);
(2) **asutuselitsents** — KOV/organisatsioon töötajate eest; aastahind alla lihthanke piiri,
et KOV saaks osta ilma hankemenetluseta; org-kiht T25 on koodina valmis; (3) **sponsoreeritud
pöörduja** — olemasolev sponsorkutse ON selle seeme; üldistus „KOV sponsoreerib N pöördujat";
müügilause: *teie elanikud saavad tasuta ettevalmistuse, teie töötajad parema eelinfo*;
(4) **ESTA liikmehüve** (ideed ptk 26 „1€ mudel" = valmis läbirääkimispositsioon);
(5) avalik projektiraha (ainult ühishüve kihid); (6) **supervisiooni vahendustasu**
(turuplatsi-komisjon tasuliselt professionaalselt teenuselt; mentorlusele EI sobi).
(+7) **Tervise teejuhid / TERVIK-ud alates 1.07.2027** — ravikindlustuse rahaga ostjaklass,
kuupäev ja eelarve seadusega küljes. Kolm hinnastuspõhimõtet: **ära allahindle kunagi otse**
(soodustus käib ainult partneri kaudu — ESTA hüve, asutuselitsents); **piloot on tasuta, aga
arvega** (lepingus nähtav tegelik väärtus + teise aasta hind — tasuta ilma ankruta muutub
igaveseks ootuseks); **andmed ei ole kunagi tuluallikas** (kuulub avalikule lubaduste
lehele). Enne sügiskooli valmis: **asutuselitsentsi hinnakirja A4 mustand** — kui KOV-juht
kuluaaris küsib „mis see maksaks?", läheb paber lauale.

**Täpsustus „pöörduja ei maksa?" (omaniku küsimus 28.07):** sihtpildis ei maksa
KASUTUSHETKEL — aga keegi maksab alati (KOV/sponsor/asutus/avalik raha; Lasteabi loogika:
helistaja ei maksa, riik maksab). Neli argumenti pöörduja-maksemüüri vastu: vale hetk
(kriisis ei sisestata kaardinumbrit — iga kanal lekib maksemüüri taha), vale rütm
(pöörduja vajadus on EPISOODILINE — kuutellimus on vale kuju), vale sõnum („abi algab
selgusest — 7,99 €/kuus" õõnestab tuumlauset; kvaliteedijuhis nõuab taskukohasust), väike
raha (100 maksvat pöördujat = 799 €/kuus; 5 asutuselitsentsi annab sama JA avab pöördujad).
Kaks vahekuju kaalumiseks: **freemium olemasoleva kvoodisüsteemiga** (baasrada tasuta,
AI-mahukas kvoodi taga — tehniliselt juba olemas, ainult tasuta paketi piirid nihutada) ja
**episoodipass** kuutasu asemel (nt ühekordne 30 päeva — vastab vajaduskujule). Isikliku
maksmise VÕIMALUS jääb erandina alles (autonoomia/privaatsus: mõni ei soovi KOV-i
sponsorlust; plaanivad, mitte-kriisis kasutajad). Üleminek astmeline: TÄNA ei muudeta
midagi (registreerimine kinni, piloot nagunii tasuta); otsus aktualiseerub avaliku
käivituse hetkel („avamise käigu" sessioon); 7,99 jääb hinnakirja — tema roll muutub
pöörduja seinast SPONSORI hinnaks (sponsorkutse juba kasutab seda).
**Valitud mehhanism (omanik 28.07): checkout'is KAKS valikut — „üks kuu, ei pikene ise"
VÕI püsimakse.** Tehniline seis: mõlemad rajad olemas — ühe kuu makse = tänane
live-käitumine (recurring globaalselt väljas, `validUntil`), püsimakse masinavärk täielik
(`lib/payments/recurring.js`: tokenid/mandaadid/retry'd; Subscription: `nextBilling`,
`cancelAtPeriodEnd`, `billingMethodId`) ja magab env-lüliti taga → töö = globaalne lüliti
kasutaja valikuks + UI 2 kaarti + valik tellimuse külge. Disain: vaikimisi pöördujal ühe
kuu (usalduslause „ei pikene ise"), spetsialistil/osutajal püsimakse; SAMA hind mõlemal;
recurring-nõusoleku linnuke (tekstid `checkout.recurring_*` olemas); ÜKS leebe
meeldetuletus enne lõppu (payment-emails worker olemas, unit'id inaktiivsed);
sponsoreeritud kuu lõpp → sama valikuekraan. Ainus päris värav: serveris
`PAYMENT_TOKEN_ENC_KEY` + `SUBSCRIPTION_RECURRING_ENABLED=1` + **päris Maksekeskuse
recurring-makse E2E test (NOT_PROVEN)**. Kuulub „avamise käigu" sessiooni skoopi koos
ootejärjekorraga.
**Sponsorluse diilikujud (omaniku küsimus 28.07: „1 kuu teise raha eest, edasi ise?"):**
see diil ON olemas (sponsorkutse = 1 kuu → „aktiveeri oma") ja JÄÄB üksikjuhtumi
mehhanismiks — aga põhidiiliks ei sobi, sest **menetlus kestab kauem kui kuu** (4–10
nädalat; maksesein keset protsessi murrab lubaduse kõige haavatavamal hetkel). Põhidiilid:
(a) **KOV menetlusepõhine** — inimene kaetud, KUNI pöördumine lahendatud; (b) **KOV
piirkonnalitsents** — asutuselitsents SISALDAB elanike juurdepääsu (hinnakirja-A4 teine
rida); (c) riik/projektiraha piirkonna kaupa; (d) üksiksponsor (olemas); (e) hiljem
MTÜ/fond sihtgrupile ja tööandja EAP-loogikas. Redel pärast sponsorlust: KOV pikendab
(menetlusepõhises automaatne) VÕI inimene jätkab ise (üks kuu korraga) VÕI baasrada.
**KÕVA REEGEL: oma andmetele ligipääs ei aegu KUNAGI** — tellimuse lõpp sulgeb AI-lisad,
aga Teekonna lugemine, Minu jagamised, eksport ja kriisikontaktid jäävad alati
(GDPR + usaldus); ÜLE KONTROLLIDA, kas aegunud tellimusega konto saab täna oma Teekonda
lugeda. Kokkulepete tekkimise viis: valideerimisküsimus KOV-juhile („kas selle eest maksab
KOV või inimene ise?" — keegi ei vasta avalikult „inimene ise") + piloot kui esimene diil
(tasuta aasta arvega, 2. aasta hind lepingus nähtaval).
**Väärtusargument maksjale (omaniku küsimus 28.07: „miks üldse keegi peaks maksma
abivajaja eest?") — kolm kihti:** (1) **inimene tuleb KOV-i lauale NAGUNII** (SHS § 15
kohustus) — küsimus on ainult, kui kallilt: ettevalmistamata pöördumine = 2–4 h töötaja
aega rohkem juhtumi kohta; töötaja tund ~15–25 € → kuu hind 7,99 teenib end tagasi ÜHE
säästetud tunniga, ja tööjõupuuduses pole töötaja aeg lihtsalt kallis, teda pole OLEMAS —
KOV ostab oma defitsiitseima ressursi tagasi; (2) **hilinenud abi on eksponentsiaalselt
kallim** (üldhoolduskoht ~2000 €/kuus, asendushooldus rohkem) — ÜKS ära hoitud kriis /
kuu võrra edasi lükatud paigutus katab piirkonna pöördujate aasta; „elukaareülene ennetus"
on heaolu arengukava ENDA esimene põhimõte; (3) **abivajaja ei maksa sotsiaalvaldkonnas
peaaegu kunagi ise — see ON valdkonna rahastusmudel** (Lasteabi, ohvriabi, perearst):
ühishüve loogika on ammu otsustatud, veider mudel oleks vastupidine; kvaliteedijuhis teeb
kohustuseks („inimest aidatakse sobiva teenuse leidmisel"). AUS LISA: täna on see
hüpotees — piloodi mõõdikud (aeg selguseni, ettevalmistatud pöördumiste osakaal,
kontaktide arv juhtumi kohta) muudavad ta arvet kandvaks faktiks. Hinnakirja-lause:
*„KOV ei maksa abivajaja äpi eest — KOV maksab selle eest, et tema seadusjärgne töö
algaks selgusest, mitte segadusest: iga ettevalmistatud pöördumine on tagasi ostetud
töötunnid ja iga varakult leitud uks on ära hoitud kriisi hind."*

### 5.4. Regulatiivne positsioon: piir kui kaitsekraav

AI-määruse kõrge riski klass (III lisa 5(a)) algab sealt, kus AI hindab õigust toetustele või
teenustele. Meie **dokumenteerime end teadlikult piirist ettevalmistuse poolele** ja hoiame
selle tõendatavana (mustand-kuni-kinnituseni on ka logides nähtav). Kaks käiku:

1. **Vastavusdokument avalikuks** — „kus SotsiaalAI AI-määruse kaardil asub ja miks" — enne,
   kui keegi küsima peab. Esimene omataoline valdkonnas = referentspositsioon.
2. **Standardimäng:** kui riik hakkab defineerima „muu keskkonna" liitumist (STAR-i
   strateegia lubab), peab laual olema valmis spetsifikatsioon. Kes kirjutab esimese
   ettevalmistuskihi-liidese mustandi, selle vorming saab aluspõhjaks. See on väikese tegija
   suurim võimendus: mitte võita hankeid, vaid **defineerida vorming**.

### 5.5. Usaldus kui kaubamärk: radikaalne läbipaistvus

- Avalik **lubaduste leht**: kolm EI-d + privaatsusinvariandid + „mitte ehitada" nimekiri —
  kontrollitavas, mitte turunduskeeles.
- **Sõltumatu audit** enne avalikku käivitust ja selle kokkuvõte avalikuks.
- Iga intsident (kui tuleb) — avalik post-mortem. Usalduskihi ettevõte ei saa endale lubada
  vaikimist; ta saab endale lubada vigu, kui ta neist ausalt räägib.

### 5.6. Tehnoloogia: mudel-agnostilisus ja suveräänsus

AI-mudelid on vahetatav osa; usaldusarhitektuur, päritolumärgistus ja töövood on püsiv osa.
Liikumine kolmes astmes: pilve-mudelid (praegu) → EL-i residentsus → lokaalsed/oma mudelid
seal, kus tundlikkus nõuab (kõne, PII-tuvastus). Andmed on Eestis ja jäävad; see lause peab
alati tõene olema.

### 5.7. Pöördujani jõudmine (omaniku küsimus 28.07: „kuidas ma jõuan eluküsimusega pöördujateni?")

Põhimõte: **pöörduja ei ole sihtrühm, vaid inimene hetkes** — temani jõutakse (a) olles
kohal hetkel, mil eluküsimus tekib, ja (b) tulles läbi inimese/asutuse, keda ta juba
usaldab. Reklaam ei tee kumbagi. Kanalid prioriteedis: (1) **KOV ise** — piloot ONGI
pöördujakanali proov (partner kutsub oma pöördujad oma kanalites); (2) **spetsialisti
soovitus** — sponsorkutse mehhanism on olemas; vaja „enne kohtumist" kaarti töötajale;
(3) **avalik selge keele Q&A** (SEO) — Google on koht, kus eluküsimus esimesena väljendub;
teadmusbaas + selge keel = vastusemootor, staatilised toimetatud lehed (omanik ON
toimetaja), iga leht lõpeb kahe uksega (mõtle läbi → platvorm / räägi inimesega →
teenusekaart); (4) **vene keel** — 3-keelne platvorm + venekeelse selge sotsiaalinfo
peaaegu-null-konkurents; (5) **kogemusorganisatsioonid** (EPIK, omastehooldajad,
pereliidud) — usalduse kandjad; kogemusekspertide ring (5–8) = validatsioon + esimene
partnerlus; (6) perearstid (TERVIK-i märkamisleht teeb 2027 ametlikuks); (7) raamatukogud
(alahinnatud üleriigiline „digiabi" võrk); (8) meedia inimlood pärast pilooti; (+ FB
kogukonnagrupid — ausalt vastates, mitte müües). **Kolm eeltingimust, ilma milleta kanalid
lekivad:** pöörduja rada kasutushetkel TASUTA (7,99 sein tapab konversiooni — maksja-
strateegia sihtpilt juba osutab sinna); kontota esimene väärtus (Q&A + teenusekaart +
kriisikontaktid; konto alles järjepidevuseks); **ootejärjekord kohe** (septembri lavad
toovad sadu spetsialiste, igaüks teab kümmet pöördujat — ilma „jäta e-post" leheta aurab
see õhku). Faasid: 0 (august) = ootejärjekord + ~10 Q&A lehte + kogemusekspertide ring;
1 (piloot) = KOV kutsub, õpime sõnumit; 2 (avalik) = sisu-mootor + soovituspakett +
MTÜ-d + vene rada. Mõõdupuu (anti-engagement ka siin): iga kanali juures küsi „kas ta toob
inimese hetkel, mil tal on PÄRIS küsimus?" — kui ei, jäta ära.

### 5.8. Teenuseosutaja-lugu (omaniku küsimus 28.07)

Aus lähteseis: kolmnurga alahinnatum tipp — kõrgeim hind (19,99), õhim lugu (kataloog +
postkast). **Kaks eri klienti:** väike osutaja (tugiisik/FIE/väike koduteenus — IT null,
platvorm = KOGU tema digitaristu) vs suur osutaja (hooldekodu/lepingutega MTÜ — raha on,
valu = töötajate voolavus, aruandlus, kvaliteedinõuded). ORG-analüüsi vana leid saab uue
kaalu: `SERVICE_PROVIDER_ORG` on AINUS juht, kus org-kihi vajadus on olemas juba täna
(profiil on 1:1 inimesega, osutaja on organisatsioon; 19,99 on inimese, mitte asutuse
hind). **Riik ehitab nõudlust:** (1) STAR-i strateegia lubab liidestada osutajate
süsteemidega — aga väikesel pole süsteemi, mida liidestada (sügiskooli F3) → SotsiaalAI =
**väikeste osutajate digikodu, mis STAR-iga liidestub** (liides üks kord, sajad väikesed
saavad ukse); (2) kvaliteedijuhis kohustab 2018-st kõiki osutajaid, aga tööriista pole →
„kvaliteedijuhis kui teenus" (enesehindamise checklist, tagasisidevoog) = ühtlasi vastus
teenusekaardi lahtisele USALDUSMÄRGISTUSE otsusele (märgis = täidetud kvaliteedinõuete
peegel; hangetel raha väärt); (3) TERVIK teeb osutajad kohustuslikeks
koostööpartneriteks. **Väärtuslugu:** nähtavus→klientide vool; ettevalmistatud
pöördumine→ajasääst; töötajate tugi→VOOLAVUS ALLA (suure osutaja kalleim valu; tööheaolu/
kovisioon/välitöö = personalihoidmise taristu); homme STAR-aruandlus ühest kohast. **Aus
seis:** V3 liit-ID viga (INTERNAL-pöördumine teeninduskohaga osutajale KATKI) + V5 lüli +
detailleht/usaldusmärgistus tegemata + org-kiht ehitamata. **Järjekord:** faas 2 pärast
KOV-pilooti (KOV-id on osutaja usalduse allikas) — AGA varem: V3/V5 parandus (katkine
põhivoog) + org-kihi aktiveerimisvalmidus (esimene mitme töötajaga osutaja on tõenäoliselt
esimene org-klient üldse, enne ühtegi KOV-i). Heaolutalgutel on osutaja hääl juba kohal
(Südamekodu juht, teenuseosutaja praktik-teoreetik). Lause: *„Väikesele osutajale müüd
digikodu, mida tal endal kunagi ei tekiks; suurele müüd töötajate püsimist — tema suurim
kulu ei ole tarkvara, vaid iga lahkuv inimene."*

**Omaniku suunaotsus (28.07): teenuseosutaja tähtsust platvormil SUURENDATAKSE ja talle
pakutakse rohkem.** Konkreetne pakett kolmes astmes: **enne kõike V3/V5 parandus** (austus
enne lubadusi — põhivoog tööle); **aste 1 „vitriin ja väärikus"** (avalik detailleht =
jagatav „koduleht", mida paljudel väikestel pole; usaldusmärgistus kvaliteedijuhise
enesehindamisena; org-kihi aktiveerimine SERVICE_PROVIDER_ORG-ile; asutuselitsentsi rida
hinnakirja — 19,99 jääb üksiktegija hinnaks); **aste 2 „töökorraldus"** (tagasisidevoog —
kvaliteedijuhis NÕUAB, tööriista pole; töötajate tugi paketina osutaja töötajatele =
voolavuse-argument; **ARUANDLUS = astme 2 põhisisu — kontrollitud 28.07: kohtumise
kokkuvõte on osutajale JUBA hästi arendatud** [`MEETING_SUMMARY_SHARE_ROLES` sisaldab
SERVICE_PROVIDER-it; täisahel mustand → U10 „sain aru/parandus" → kinnitusring →
kustutust üle elav privaatkoopia], **aga aruandlus PUUDUB päriselt**: `REPORT_DRAFT` on
tekstimustand, mitte andmearuanne; puudub ka eeldus = TEENUSKIRJE. Disainisuund:
FieldVisit on teenuskirje prototüüp (omanik, eesmärk, saabumis-/lahkumiskinnitus =
kestus, märkmed) → üldista kergeks teenussündmuste logiks (osutaja OMA töökiht,
owner-scoped — MITTE vari-STAR, ametlik arveldus jääb riigile) → perioodi väljavõte
CSV/PDF KOV-ile (+ REPORT_DRAFT mähib andmed kuuaruande mustandiks, inimene kinnitab) →
STAR-liidese avanedes „ekspordi" → „edasta". Topeltkontroll 28.07 (omanik arvas, et aruandlus on olemas — mõistetav segadus:
`REPORT_DRAFT` nimi vihjab, kokkuvõtted olemas, admin-analüütika olemas):
`ServiceProviderService` = KATALOOGIKIRJE (nimi/sihtrühmad/piirkonnad), mitte osutamise
logi; pöördumiste loend = sissetulevad soovid, mitte osutatud teenused; /voimalused EI
luba osutajale aruandlust → avalikku usaldusvõlga pole. **MVP maht on VÄIKE (1–2
tööpäeva):** teenuskirje mudel (teenus kataloogist + kuupäev + kestus + klient + märge,
owner-scoped) + sisestus + kuufilter + CSV — kataloog annab rippmenüü, FieldVisit annab
kestuse-mustri; hiljem REPORT_DRAFT mähib numbrid kuuaruande tekstiks. Ehita lipu taha
KOHE (universaalväljad — tund on tund igas KOV-is), septembris valideeri ainult EKSPORDI
vorming: Südamekodu juhilt/Keiu Talvelt 2–3 PÄRIS aruandevormi = ekspordi
spetsifikatsioon. Eeldus: puhas tööpuu (commit enne — skeemimuudatus); **aste 3 „digikodu"** (STAR-liides +
TERVIK-tööriistad, riigi tempos). **KOLM KAITSEPIIRET** (koht, kus rollide huvid võivad
esimest korda põrkuda): järjestus kaardil EI ole ostetav (mitte kunagi promoted listings);
usaldusmärgis EI ole müügiartikkel (ainult läbipaistvad kriteeriumid); pöörduja
andmed/kontaktid EI ole kunagi osutaja „lead'id" (sobitus jääb inimese algatatud ja
nõusolekupõhiseks). Järjekord: KOV-piloot jääb esimeseks; kohe ilma fookust hajutamata =
V3/V5 + hinnakirja rida + septembris osutaja-häälte valideerimine (heaolutalgutel
Südamekodu juht + teenuseosutaja praktik-teoreetik — küsi NEILT, mis astmest kõige rohkem
korda läheb).

### 5.9. Edu mõõdik: anti-engagement

Meie edu EI ole ekraaniaeg. Sotsiaalvaldkonnas on õnnestumise definitsioon pöördvõrdeline:
**inimene vajab meid vähem**. Mõõdame: aeg selguseni (pöörduja); ettevalmistusaeg kohtumise
kohta (töötaja); õigesse kanalisse jõudnud pöördumiste osakaal; taastumisrütmi püsivus
(töötaja enda jaoks, mitte kellelegi raporteerituna); dubleeriva sisestuse kadu. Kui kunagi
tekib kiusatus optimeerida „kasutajate naasmist", on see punane lipp, mitte KPI.

Teoreetiline selgroog valdkonna ENDA diskursusest (Harrikari, Sotsiaaltöö solidaarsuse
erinumber 1/2026): kolmanda modernsuse kriitika ütleb, et algoritmid ja tähelepanumajandus
toodavad „klikksolidaarsust" — emotsioon ja nähtavus asendavad püsiva pühendumise — ning
Rosa „resonantsi kriisis" muutub maailm hääletuks: inimesed ühendavad end, aga keegi ei
kuula. Anti-engagement mõõdik on sellesama kriitika TOOTETASANDI vastus: meie AI ei võistle
tähelepanu pärast, vaid vabastab aega kuulamiseks. See tähendab, et valdkonna
AI-skeptilisusega ei pea vaidlema — saame sellega ühineda ja näidata, et ehitame just seda
erandit, mida kriitika ise nõuab. Kasutuskohad: ESTA/akadeemilised vestlused, positsioonileht,
AI-koolituse eetikamoodul.

### 5.10. Kaks paneeliankrut (TLÜ „Sotsiaaltöö 2050" paneel, transkript loetud 29.07.2026)

**1. „Kahe kiirusega sotsiaaltöö" hoiatus (Anu Toots).** Tootsi lennujaama-paralleel:
odava piletiga reisija kohtub masinatega, business-klass saab inimteenindaja — ja sama
klassivahe võib tekkida sotsiaaltöös: vaestele „masin-sotsiaaltöö" (andurid, algoritmid,
monitooring), jõukatele päris inimene kui luksusteenus. See on meie positsioneeringu
kõige täpsem VASTAND: meie AI ei ole odav asendus vähem maksvale inimesele, vaid selguse
kiht, mis vabastab inimaega — ja anti-engagement mõõdik (5.9) on selle kaitse. Kui AI-kiht
hakkab kunagi asendama inimkontakti seal, kus inimest on vaja, oleme Tootsi düstoopia
teenistuses. Positsioonilehele üks lause: „tehnoloogia vaestele, inimesed rikastele" on
läbikukkumise definitsioon, mitte tõhusus.

**2. RAKE pretsedent = AI-piiri empiiriline selgroog (Lauri Leppik).** SoM tellis
paneeli meenutuse järgi ~2021–22 analüüsi: „kasutage kõiki riigi registriandmeid ja
kirjeldage algoritm, mis ennustab, kes hakkab 75-aastaselt abi vajama." TLÜ pidas
ülesannet lahendamatuks ega esitanud pakkumist; hanke võitnud TÜ RAKE järeldas lõpuks
SAMA — ülesannet ei saa lahendada (Leppiku paralleel: kõik autod sõidavad, kuni katki
lähevad, aga millal täpselt, ei tea keegi); lisaks leidis töö seadusandlikud tõkked
andmete ühendamisel. Tähendus meile: meie „ei ennusta abivajadust, ei triaaži, ei skoori"
EI OLE ainult eetiline valik — see on riigi enda tellitud analüüsiga empiiriliselt
põhjendatud piir. Kasutuskohad: positsioonileht, AI Act vastavusdokument, TERVIK § 136
lavaküsimus (T5). NB: lugu on paneeli suuline meenutus — enne avalikku tsiteerimist otsi
RAKE raport üles ja kontrolli aasta ning täpne järeldus.

### 5.11. Mõjuettevõtluse ökosüsteem: identiteet, uksed ja piirid

Allikas: TLÜ „Arenguvajaduste kaardistus" (Praakli, Kübar, Lepik K-L, 2025; Šveitsi-Eesti
koostööprogrammi „Sotsiaalse kaasatuse toetamine" / KÜSK-i tellimus; loetud 29.07.2026).
NB valimid on väikesed (37 vabaühendust/mõjuettevõtet, 17 konsultanti, 12 KOV-i) —
protsendid on suunanäitajad, mitte esinduslik statistika.

**1. Identiteedi-uks: SotsiaalAI ON mõjuettevõte.** Kaardistuse definitsioonide järgi
(ettevõte, mille põhieesmärk on ühiskondlik mõju; tegutseb sotsiaalhoolekandes; tulu
teenib eesmärki) kuulume sinna kategooriasse täpselt — aga me pole end kunagi selle
ökosüsteemi osaks deklareerinud. See on tasuta positsioneerimiskiht: „sotsiaalne
ettevõte" on keel, mida KÜSK, SEV (Sotsiaalsete Ettevõtete Võrgustik), maakondlikud
arenduskeskused ja rahastajad kõnelevad. Kaardistus ise märgib, et paljud organisatsioonid
„ei taju vajadust end sotsiaalse ettevõttena identifitseerida ega näe sellest kasu" — meie
näeme: võrgustik, nähtavus, rahastuskõlblikkus, ja Baltikumi mõju-startup'ide 800% kasvu
narratiiv, mille osaks saab olla.

**2. Rahastuse-uksed (kolm, erineva küpsusega):**
- **Šveitsi-Eesti programm 2024–2028, ~23 M€ sotsiaalse kaasatuse peale** — sihib
  sõnaselgelt „eri keele- ja kultuuritaustaga inimeste" osalusvõimalusi + sotsiaal-
  hoolekande teenuste kättesaadavust ja kvaliteeti. See on meie VENE RAJA ja ukraina
  keele sahtli-idee (C-tabel) loomulik rahastusallikas — keelekiht ei ole meie
  äriplaanis prioriteet, aga kui riik/Šveits selle kinni maksab, tõuseb ta järjekorras.
- **KÜSK-i sotsiaalse innovatsiooni tugi** — sellest kaardistusest kasvab
  nõustamis- ja koolitusprogramm (ESIA projekt 2024–2027, sotsiaalse innovatsiooni
  kompetentsikeskus). Meie roll seal on SAAJA, mitte andja: tasuta/subsideeritud
  nõustamine, mentorlus, võrgustik — täpselt need asjad, mida üksikehitaja bus-factori
  vastu vajab (riskitabel rida 1). Jälgi KÜSK-i voore.
- **Aus piirang samast kaardistusest:** konsultandi tsitaat „Eestis ei ole ühtegi
  rahastusmeedet, mis oleks mõeldud just sotsiaalsetele ettevõtetele" + MTÜ-d ei
  kvalifitseeru starditoetusele. Ökosüsteem on toetav, aga raha-instrumenti EI OLE —
  ära ehita äriplaani sellele, et „sotsiaalse ettevõtte raha" kuskilt tuleb.

**3. Turu-tõestus: mõju mõõtmine on kõigi kolme sihtrühma NÕRGIM pädevus.** KOV-idest
hindas 91,7% oma mõju mõõtmise ja raporteerimise pädevust „rahuldavaks" või madalamaks
(nõrgim kõigist!), vabaühendustest 70,3%; osa KOV-e tunnistab otse „ei mõõdeta
mõju/mõõdetakse väga minimaalselt". Samal ajal on „praktilised tööriistad ja juhendid"
KOV-ide suurim motivaator (91,7%). Tähendus meile: **Teenuspäeviku mall C (sisuaruanne
kliendi lugudega) + kvaliteedirütmid + E8 aruandlusaja mõõtmine ON mõju mõõtmise
infrastruktuur** — sama aatom, mis toidab KOV-i kuuaruannet, on organisatsiooni
mõjunarratiiv rahastajale. Kaardistuse keel („mõjunarratiiv", „muutuste teooria",
„mõju visualiseerimine") tasub Teenuspäeviku müügimaterjalis üle võtta — me ei ehita
midagi juurde, me nimetame olemasoleva õigesse keelde.

**4. Väiksemad resonantsid (märgi, ära ehita):** vabaühenduste katmata teemade loendis
on sõna-sõnalt „tööstressi ja läbipõlemise temaatika" (→ tööheaolu tööriistad 11 tk LIVE)
ja „digioskused/tehnoloogialahendused, ka tehisintellekti kasutamine" (32,4% tahab
arendada → AI-koolituspakett töötab ka vabaühenduste segmendis, mitte ainult ESTA-s);
konsultandid ise soovivad „kovisiooni või mastermindide vormis tuge" (→ kovisioonilõuend
on sama muster teises sihtrühmas — KAUGE sahtel). Eelistatud formaadid (moodulipõhisus,
hübriid, Eesti-põhised juhtumid, õppekülastused, mikrokraadid/koolitusampsud) kinnitavad
meie koolituspaketi disainivalikuid.

**5. Konkreetne käik: paku end Eesti-põhiseks juhtumiuuringuks.** Konsultantide kõige
korduvam soov oli elulised Eesti näited („tahaks Eesti konteksti — reaalne tegevus,
klient, mõju, tulu"; „ei piisa, kui ütled lihtsalt nime — tahaks teada, mis seal
ärimudelis täpselt toimub"). Loodav koolitusprogramm VAJAB case'e — SotsiaalAI radikaalse
läbipaistvuse joon (avalik arhitektuur, avalikud piirid, aus ärimudel) teeb meist ideaalse
õppejuhtumi. Kontakt: kaardistuse autorid on TLÜ-st (Katri-Liis Lepik = sotsiaalse
ettevõtluse tuumikuurija) — SAMA TLÜ klaster, kust tulid 2050-esseed ja paneel; uks on
soe. Hind: paar tundi intervjuud; tulu: nähtavus konsultantide võrgustikus, kes nõustavad
KOV-e ja vabaühendusi üle Eesti.

**6. Nimeline sõlm: Koosloome / Sotsiaalse Innovatsiooni Labor (koosloome.ee; loetud
29.07.2026).** 9-aastase avalike teenuste disaini kogemusega koosloome-fasiliteerija
(Pedanik, Koppel, Kostabi, Kaasik, Üibu; Telliskivi 60a) — kaardistuses nimetasid teda
kvaliteetse toe pakkujana NII vabaühendused KUI KOV-id, st ta on ökosüsteemi
usaldusristmik. Referents otse meie maailmast: **Kagu-Eesti sotsiaalteenuste
arenguprogramm** — neil on KOV-suhted just väikeste omavalitsuste segmendis. Kolm
sihitud kasutuskohta (MITTE üldine „teeme koostööd"): (a) **T26 piloodi disainitugi** —
kui KOV-piloot käivitub, on professionaalne koosloome-fasiliteerimine (töötajad +
pöördujad + meie ühes ruumis) parem kui meie oma käe peal vehkimine; (b) **KOV-uks
Kagu-Eestis** — nende arenguprogrammi läbinud KOV-idel on disainitud protsessid, aga
tõenäoliselt mitte digikihti — täpselt meie profiil; (c) **heaolutalgute (30.09)
fasiliteerimiskvaliteet** — nende tööriistad või kohalolu tõstaks töölaudade taset.
Aus piir: nad müüvad fasiliteerimist (maksab) ja TOOTE disaini me sisse ei osta —
kasutus on sihitud üritused/uksed, mitte alltöövõtt.

**7. Nimeline sõlm: EKA sotsiaalse disaini MA (artun.ee; loetud 29.07.2026).** 2-aastane
eestikeelne tasuta magistriõpe disainiteaduskonnas (õppejõud Martínez, Kubinyi, Aaloe);
fookused kattuvad meie registriga peaaegu punkt-punktilt: teenusedisain, osaluspõhised
meetodid, vaimne tervis, migratsioon, KRIISIVALMIDUS, eetika. Partnerite seas on juba
**Sotsiaalministeerium (Heaolutehnoloogiate programm 2025–2030 — SAMA programm 437, mis
on meie F10 rahastusuks!)**, PERH (patsiendikeskne disain), Kultuuriministeerium + INSA
(Ukraina põgenike lõimumine → meie ukraina-rada teema). Kolm sihitud kasutuskohta:
(a) **tudengiprojektid/magistritööd = struktureeritud tasuta disainivõimekus** — paku
SotsiaalAI päris-teemasid (pöörduja teekonna kasutajauuring, teenusekaardi UX väikestele
osutajatele, ruumilise UI ligipääsetavus, kanalikaardi disain); hind = meie juhendamisaeg,
tulu = värsked silmad + akadeemiline rangus ilma palgakuluta (bus-factori sõbralik);
(b) **programmi 437 taotluse tugevdus** — EKA kui akadeemiline disainipartner taotluses,
nad juba töötavad selle programmi sees; (c) **värbamiskanal**, kui tiim kunagi kasvab
(lõpetajad = teenuse-/interaktsioonidisainerid, rakendusantropoloogid). Aus piir sama
mis SIL-il: semestririik on aeglane, IP/omand lepitakse ette kokku, tuumaotsuseid välja
ei delegeeri. Ökosüsteemi kolm akadeemilist jalga on nüüd kaardil: TLÜ (sotsiaaltöö +
ettevõtlus + esseeklaster), TÜ (RAKE pretsedent), EKA (disain).

**8. Nimeline sõlm: TalTechi teenusedisaini labor d.Lab (Jana Kukk, Laura Kullerkupp;
taltech.ee uudis, loetud 29.07.2026).** Neljas akadeemiline jalg — ja TalTechil on meie
kaardil nüüd KAKS rolli: kõnetehnoloogia (voogav eesti STT, multimodaalse kihi
tulevikutrigger) + teenusedisain. Uudisest kolm meie printsiipe kinnitavat mõtet, mis
kõlbavad positsioonilehele ja koolitusse: (a) „keerulised lahendused on tegelikult
lihtsamad ehitada" — täpselt meie aruandlusmooduli-keeldumise loogika (eraldi moodul on
lihtsam ehitada, kõrvalsaadus on õigem); (b) lihtsam lahendus maksab ehitades ~6% rohkem,
aga on odavam hooldada (NB: intervjuu väide, allikas kontrollimata — enne avalikku
tsiteerimist otsi uuring); (c) „avalikes teenustes on tekkinud rohkem NÄHTAMATUID
lahendusi" — essee lõpplause („aidata alguses ja jääda lõpus nähtamatuks") on valdkonna
disainidiskursuses juba olemas. Kasutuskoht: kerge — tsitaadivaramu + d.Lab kui
võimalik neljas tudengiprojektide kanal EKA kõrvale; eraldi käiku ei planeeri.

**9. Algallika lisad: Kangro & Lepik „An Ecosystem for Social Innovation in Estonia"
(TLÜ 2023, ESIA; loetud 29.07.2026)** — 2025. a kaardistuse teoreetiline eelkäija,
23 poliitikasoovitusega. Mida kaardistuses EI olnud ja mis meile loeb:
- **Hangete tühjus on mõõdetud:** innovatsioonihankeid oli 2020. a kõigist hangetest
  0,2% (arvult) / 0,1% (maksumuselt), 2021. a alustati 11; sotsiaalselt vastutustundlikke
  hankeid 2021. a KOKKU 12 tk (9,7 M€), enamik Töötukassa omad. Riigi enda raport
  soovitab (rec 9) sotsiaalse väärtuse hangetesse sisse kirjutada — praktika on
  peaaegu null. Kasutus: kui KOV meid kunagi hangib, on „sotsiaalselt vastutustundlik
  hange" valmis raamistik, mida hankijale ette pakkuda; kuluaari-fakt sügiskooliks.
- **93% sotsiaalseid ettevõtteid on MTÜ vormis ega pääse ettevõtlustoetustele** (OECD
  2020 kaudu) — meie OÜ-vorm on selles ökosüsteemis ERAND ja eelis: pääseme
  tavameetmetele, mida MTÜ-põhine enamus ei saa.
- **Mõju-investeerimise kaart:** „investing for impact" poolel sisuliselt üks tegija
  (Heateo SA); pankade peatakistus = mõju hindamise metoodika keerukus → kinnitab
  punkti 3 (mõju-mõõtmise infra on turuauk) ka KAPITALI poolelt.
- **SoM on juba katsetanud tulemuspõhist MTÜ-rahastust** (nt eakate tööhõive
  tulemusnäitajaga) ja KOV-ide MTÜ-toetused „ei eelda mõju" (KÜSK 2021) —
  tulemuspõhisuse laine tuleb; kes suudab mõju NÄIDATA, võidab järgmise
  rahastusmudeli. Meie E8/mall C on selleks valmis.
- **Kirikud kui avastamata kogukonnaressurss** (usaldusvõrgustikud, hingehoid vaimse
  tervise väljal) — kattub paneeli Šotimaa-näitega („linn, kogukond ja kirik koos");
  kogukonnakihi kauge noot, mitte tegevus.
- Accelerate Estonia = riigi „sandbox radikaalseteks pilootideks" — võimalik uks, kui
  kunagi vajame regulatiivset katsetusruumi (nt Sotsiaalvalve idee).

**10. „Sotsiaalne innovatsioon Eestis. Visioon 2030" (KÜSK + TLÜ + SEV + Sise- ja
Sotsiaalministeerium; ESIA projekt, ~2023; PDF docs/; loetud 29.07.2026)** — kolmiku
keskmine lüli (2023 analüüs → visioon → 2025 kaardistus). Mida teised kaks ei andnud:
- **Sektori suurus:** Eestis 263 sotsiaalset ettevõtet (SEV 2023 II kv), maksustatav
  käive 34,5 M€, ~4200 töötajat; 34% asutatud viimase 5 aasta jooksul.
- **2030 sihid, mille sisse me mahume:** mõjuettevõtlus = 10% SKP-st, 1% rahvastikust
  töötab mõjuettevõttes, „Eestis on mitu mõjuükssarvikut", ühiskondliku mõju analüüs
  majandusaasta aruande osana. Ambitsioonikas/aspiratiivne — aga tähendab, et
  mõjuettevõtteks deklareerumine paneb meid POLIITILISELT ÕNNISTATUD kasvunarratiivi
  sisse, mitte niši.
- **Kolm visioonirida, mis õnnistavad otse meie positsioneeringut:** (a) „SELGE KEEL
  asjaajamises, dokumentides, kaasamises" on avaliku sektori 2030 visioonieesmärk —
  meie keeleliides/bürokraatia-tõlge EI ole niši-veidrus, vaid riikliku visiooni
  teostus; (b) „tõusnud on TEHISINTELLEKTI kasutamise alane teadlikkus" on
  inimese/kogukonna visioonirida — AI-koolituspakett panustab otse ametlikku 2030
  eesmärki (kasuta Liisi-kirjas ja koolituse põhjendustes!); (c) „MÕJUHANKED ja/või
  mõjupõhiste teenuste ostmine on avalikus sektoris levinud tava" — hangete-argument
  (punkt 9) on visioonis normiks kuulutatud.
- **KOV-soovituste eraldi plokk** (koosloome areen, mõju hangetes, tulemuspõhised
  rahastusprogrammid, innovatsioonimõõdikud) — valmis keel meie KOV-vestlusteks:
  „teie enda valdkonna visioon soovitab täpselt seda, mida see tööriist teeb".
- **Viies akadeemiline sõlm:** TÜ Pärnu kolledži „inimesekeskse sotsiaalse
  innovatsiooni" õppekava nimetatud visioonis näidisena — TÜ on kaardil nüüd kahes
  rollis (RAKE + Pärnu kolledž); + Vastutustundliku Ettevõtluse Foorum (28 märgisega
  ettevõtet 2022) CSR-poolel ja Siseministeeriumi SI-töörühm (2022–) koordinatsioonis.
- **Erivajadustega inimesed kui oma elu asjatundjad, kes „müüvad eksperditeadmist
  teenusena"** — kogemusekspertide/mentorluse suuna visioonikinnitus.

**11. SIKK = ökosüsteemi elav esiuks (kysk.ee/sikk; loetud 29.07.2026).** Kogu kolmik
(2023 analüüs + visioon 2030 + 2025 kaardistus) elab nüüd KÜSK-i sotsiaalse
innovatsiooni kompetentsikeskuse veebikeskusena: terminid, ökosüsteemi ülevaade,
poliitikasoovitused, Šveitsi-Eesti programmi leht, uudised. Kaks praktilist asja:
(a) **SIKK on taotlusvoorude ja programmide JÄLGIMISKOHT** — punktis 2 lubatud
„jälgi KÜSK-i voore" tähendab konkreetselt seda lehte; (b) **podcast „Mõjulood"** =
odav ja täpne nähtavuskanal: mõjuettevõtte lugu sotsiaalvaldkonnas + AI-piirid on
täpselt nende formaadi teema — omanik võiks end külaliseks pakkuda (haakub punkti 5
juhtumiuuringu-käiguga, sama KÜSK/TLÜ ring). Numbrite ajarida ettevaatusega: SEV-i
andmebaas näitas 2022 III kv ~187 SE-d (30,4 M€, ~3800 töötajat) ja 2023 II kv 263
(34,5 M€, ~4200) — kiire kasv VÕI loendusmetoodika muutus; enne tsiteerimist võta
värske number sev.ee andmebaasist.

**12. Autori lugu kui strateegiline vara (sotsiaal.ai/autorilt; loetud 29.07.2026).**
Avalik elulugu (2017 sotsiaalinfo.ee idee → 2020 AI-mõte ENNE ChatGPT-d → 2022 selge
visioon → 2025 mai ehituse algus → 2026 aprill toimiv platvorm) teeb kolm strateegilist
tööd, mida ükski teine dokument ei tee: (a) **ökosüsteem = vilistlasvõrgustik** — iga
5.11 sõlm on autori CV-s olemas (ajakiri Sotsiaaltöö tegevtoimetaja → RAG-luba; SoM-i
praktika; ESTA tegevus; Helpific → sotsiaalne ettevõtlus; TLÜ haridus → esseeklaster);
ükski uks ei ole külm; (b) **„kolm külge läbi elatud"** — isiklik abistaja
(osutaja/pöörduja pool) + tegevtoimetaja (teadmus ja keel) + ministeeriumipraktika
(süsteemi pool) = vaheruumi tees on elatud kogemus, mitte analüütiline poos; kuluaari
tugevaim avalause; (c) **pre-ChatGPT autentsus** — 2020. aasta AI-idee neutraliseerib
„hype'i-turisti" vastuväite ette ära. Võtmelause „sama keskkond ei saa kõnetada kõiki
ühtemoodi" (2022) on täna koodis kandjapiiri ja kolme rollina — elulugu ja arhitektuur
räägivad sama lauset, mis on radikaalse läbipaistvuse (5.5) harvim vorm: järjepidevus.
Kasutuskohad: essee autoririda, Mõjulood/juhtumiuuring, positsioonilehe „miks mina"
lõik, kuluaariavangud.

Lisakontroll (sotsiaal.ai/meist; loetud 29.07.2026): avalik leht, elulugu, essee ja
see strateegiadokument räägivad JUBA sama keelt („kõik algab selgusest"; „selguseni
peaks jõudma küsides, mitte otsides"; „AI valmistab ette, ei asenda"; „otsused jäävad
inimesele") — sõnumiarhitektuur on koherentne, mida hoida. Kasutamata pärl Meist-lehelt:
**„hoitud spetsialist on tugeva sotsiaaltöö alus"** → koolitusse ja positsioonilehele.
SAHTLI-MÄRGE (aktiveerib ainult omanik, = avaliku lehe muudatus): kui Meist kunagi
värskeneb, on tänase töö kandidaadid sinna: kolm EI-d selgete keeldumistena,
anti-engagement lubadus („meie edu on, et vajad meid vähem"), „abi küsimine tohib olla
sama privaatne kui mure ise", mõjuettevõtte enesemääratlus.

### 5.12. Vaimse tervise astmeline abi — riigi paralleelprojekt (peegel, piir ja kaks ust)

Allikas: SoM-i leht „Vaimse tervise astmelise abi piloteerimine" (uuendatud 24.07.2026;
PDF + infograafik `docs/vaimne tervis/`). Faktid: astmeline mudel = seisundi hindamine →
1. aste digitaalne eneseabi → 2. aste VIPS (väheintensiivne psühholoogiline sekkumine) →
3. aste esmatasand → 4. aste eriarstiabi; pilot digitaliseerib kaks esimest astet —
24/7 veebipõhine enesehindamine, AUTOMAATNE suunamine ilma spetsialistita, seisundi
jälgimine läbi teekonna; 40 kuud, **1 912 000 €** Riigikantselei avaliku sektori
innovatsioonifondist; SoM + Tervisekassa + TEHIK (projektijuht Kertu Miidu); pikaajaline
visioon = sidumine TIS-iga; eeskujud UK/Soome/Taani; terviseministri pealkiri lehel:
„abi peab jõudma inimeseni enne, kui mure süveneb".

**1. PEEGEL: riik ehitab tervise poolel sedasama, mida meie sotsiaalpoolel.** 24/7
digitaalne esmakanal enne spetsialisti, „abi võib alata juba enne arsti juurde jõudmist"
— see on vaheruumi-teesi riigipoolne kinnitus KOLMANDAT korda (Kuuse 2017 → TERVIK →
nüüd astmeline abi) ja ühtlasi tõestus, et selline kiht on rahastatav avalik hüve
(1,9 M€!). Sügiskooli U1 saab lisaargumendi: tervisemure digitaalne esmakanal on juba
ehitamisel — sotsiaalmure oma endiselt puudub.

**2. PIIR — ja see on KULD: riik ise klassifitseerib automaathindamise
MEDITSIINISEADMEKS.** Lehe võtmelause: kuna digitaalne seisundi hindamine ja
automatiseeritud suunamine tuginevad kliinilistele hindamisvahenditele, „käsitletakse
sellist lahendust meditsiiniseadmena" (MDR) — enne laienemist tuleb hinnata ohutust,
toimivust ja mõju. Meile tähendab see KOLMANDAT regulatiivset kaitsekraavi (AI Act +
RAKE pretsedent + nüüd MDR): meie EI kasuta kliinilisi hindamisinstrumente, EI skoori
seisundit, EI suuna automaatselt — sellepärast EI OLE me meditsiiniseade, ja see piir
peab jääma arhitektuuri (kriisirada = inimese enda valik + kontaktide näitamine, MITTE
kliiniline triaaž). Iga tulevane funktsiooniidee, mis lisaks „seisundi hindamise", tooks
kaasa MDR-i — registri väravasse kirjutada.

**3. UKS A: VIPS-spetsialistid = uus töötajaskond, seadusliku supervisioonivajadusega.**
VIPS-e osutavad väljaõppega spetsialistid, kes EI OLE tervishoiutöötajad, töötavad
tõenduspõhiselt ja on „regulaarselt superviseeritud" — see on tervise teejuhtide kõrval
TEINE riigi loodav uus töötajasrühm, kellel on sisseehitatud supervisiooni- ja
töökorraldusvajadus, aga (tõenäoliselt) ei ole veel töökihti. Meie supervisioonimudel,
kovisioon, tööheaolu ja kohtumiste kokkuvõtete muster sobivad neile ilma kliinilise
kihita. C-tabelisse rida; ärkamise kell = piloodi käivitumine/laienemine.

**4. UKS B: kanalikaart täieneb.** Kui riigi enesehindamise värav läheb live, peab meie
vestlus/kanalikaart (5.7) oskama vaimse tervise mure puhul juhatada ka sinna — „õige
kanal" on meie lubadus, mitte konkurentsitõrje. Ja vastupidi: astmelise abi teekonnal
sotsiaalmurega inimene vajab sotsiaalpoole ust — see ristsuunamine on koostöövestluse
teema SoM-iga (kontakt lehel olemas), MITTE enne piloodi käivitumist.

| Risk | Tõenäosus | Vastus |
|---|---|---|
| **Üks ehitaja** (bus factor, läbipõlemine) | kõrge | halastamatu järjekord (5.1); dokumentatsioon on juba erakordne — hoida; partnerid kannavad osa koormast; ära ehita üksi seda, mida saab partneriga |
| **Riik ehitab ise peale** (STAR2 iseteenindus katab eelpöördumise) | keskmine | riik ehitab vormi-, mitte mõtestamiskeskselt; meie kiht algab enne vormi ja jääb inimese omaks; liidestu, ära võistle. Riigi tempo on meie liitlane |
| **Usaldusõnnetus** (leke, väärkasutus) | madal, mõju fataalne | invariandid arhitektuuris, mitte poliitikas; sõltumatu audit; intsidendiplaan; radikaalne läbipaistvus (5.5) |
| **Rahastuseta venimine** | keskmine | kaks jalga + 437-programm; piloot enne raha küsimist — töötav näide on parim taotlus |
| **Skoobi ahnus** (visioon on asutuse mõõtu, ehitaja üks) | kõrge | „mitte ehitada" distsipliin; 4 väravat; iga kuu küsimus: mis on AINUS järgmine asi? |
| **Regulatiivne ümberklassifitseerimine** (keegi loeb meid kõrge riski AI-ks) | madal | vastavusdokument ette (5.4); piir on koodis tõendatav |
| **KOV-ide konservatiivsus** | kõrge | mitte müüa platvormi, vaid lahendada ühte valu (eelinfo kvaliteet); EPIK/ESTA referentsid; „kaks töötlejat" raamistik valmis |

---

## 7. Kümne aasta pilt

2036. Inimene, kellel on elus keeruline hetk, avab keskkonna, mis on talle tuttav — sest ta
on seal varem oma elu sündmusi mõtestanud. Tema lugu on tema oma: ta näeb, mida ta on kunagi
jaganud, kellele ja miks, ja saab iga jagamise tagasi võtta. Ta räägib oma keeles — eesti,
vene, inglise, lihtsas keeles — ja süsteem tõlgib bürokraatia inimkeelde, mitte vastupidi.

Sotsiaaltöötaja alustab tööpäeva keskkonnas, mis teab, mis teda ees ootab, valmistab koos
temaga ette, ja kus tema enda jaksamine on sama tähtis kui tema juhtumid. Tema refleksioon,
kovisioon ja mentorlus on sama loomulik osa tööst nagu dokumenteerimine — ja dokumenteerimine
ise on poole väiksem, sest midagi ei sisestata kaks korda.

Riik näeb esimest korda ausat koondpilti: kus on rahuldamata vajadus, kuidas valdkond
päriselt jaksab, kas inimeste olukord muutub — ilma et ükski üksikisik oleks kunagi nähtav.
Ja kui mõni teine riik küsib, kuidas Eesti selle tegi, on vastus sama, mis X-tee puhul:
väike maa ehitas kihi, mida suured ei osanud alustada.

> **SotsiaalAI ei asenda ei inimest ega riiki, vaid teeb nähtavaks ja kergemaks kõik selle,
> mis seni on kahe vahele ära kadunud.**

See lause oli olemas enne seda dokumenti. Kõik ülaltoodu on ainult tema teostusplaan.

---

## Lisa: alusdokumendid

Riigi dokumendid (täistekstid loetud 28.07.2026): STAR-i strateegia 2026–2030 · Täisealise
abi- ja toetusvajaduse hindamise juhend 2025 · TERVIK-eelnõu 05.03.2026 · Eesti
sotsiaalteenuste kvaliteedijuhis (12.11.2024) · Heaolu arengukava 2023–2030 ·
Sotsiaalhoolekande programm 2026–2029 (+ Lisa 1 ja 2) · EPIKoja arvamus TERVIK-eelnõule ·
AI-määruse III lisa ajaraam. Tsitaatidega viited: `sugiskool-2026-kusimustik.md` ptk 9.

Platvormi dokumendid: `ideed.md` · fable-5 analüüsid (44 tk) · `SEIS.md` (elav seisufail) ·
usaldusmudel · ruumilise platvormi visioon · tulevikufunktsioonide register.
