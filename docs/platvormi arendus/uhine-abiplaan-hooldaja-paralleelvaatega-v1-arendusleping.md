# `ST10-04 HOOLDAJA-VAADE-V1` — ühise abiplaani ja hooldaja paralleelvaate arendusleping

Versioon: 1.0 · 24.08.2026
Lepingu liik: `ST10-02 UHINE-TEGEVUSPLAAN-V1` laiendus; uut plaanimootorit ei looda
Elav teostusseis: [`SotsiaalAI.md`](./SotsiaalAI.md) S4 artiklivõrdluse lepinguregister
Tõendipiir lepingu koostamisel: ühise plaani alus osaline, nimeline Omastehooldaja ruum 0;
`runtime: not_run`

## 1. Vajadus ja kasutajalubadus

2019. aasta koordinatsioonikogemus näitab, et ühine plaan peab tegema nähtavaks ka lähedase
hoolduskoormuse ja toe. Funktsioon lubab hoida **hooldatava eesmärgi ja hooldaja enda eesmärgi
eraldi**, kuid näidata inimese kinnitatud ühises plaanis, millise poole vajadusest konkreetne
tegevus lähtub.

See ei ole hooldaja hindamine hooldatava andmete põhjal. Hooldaja on oma vaate omanik ja
otsustab ise, mida ta jagab.

## 2. Sobivus olemasoleva platvormiga

Parent-leping on [`uhine-tegevusplaan-ja-uleandmisahel-v1-arendusleping.md`](./uhine-tegevusplaan-ja-uleandmisahel-v1-arendusleping.md).
Taaskasutatakse selle plaani, tegevuse, versiooni, osaluse ja vastuvõtukinnituse kandjat ning
olemasolevaid ruume, kutseid, „Minu jagamisi”, Teekonda ja Tööheaolu privaatseid põhimõtteid.

`Omastehooldaja ruum` esineb kanoonilises dokumendis kontseptsioonina; nimelist
funktsiooni, andmemudelit ega lepingut enne seda faili ei olnud. Seega „KATTUB” tähendab
ühise plaani doonorit, mitte hooldaja vaate valmimist.

## 3. V1 kasutajatee

1. Hooldaja loob enda privaatse eesmärgi või võtab vastu kutse seostada see ühise plaaniga.
2. Hooldatav ja hooldaja näevad eraldi, milline info kuulub kummalegi ja kes seda nägema hakkab.
3. Mõlemad kinnitavad oma jagatava osa eraldi; ühe nõusolek ei laiene teisele.
4. Ühise plaani tegevus märgitakse lähtuma hooldatava, hooldaja või mõlema kinnitatud
   eesmärgist.
5. Hooldaja saab lisada enda järgmise sammu ja toe vajaduse ilma hooldatava diagnoosi või
   privaatse Teekonna nähtavaks tegemiseta.
6. Mõlemad saavad oma tulevase jagamise lõpetada; juba tehtud tegevusfakt jääb minimaalselt.

## 4. Tootepiirid ja invariandid

- Hooldaja ja hooldatava eesmärgid on eri omanikuga objektid.
- Hoolduskoormust ei järeldata diagnoosist, teenusekasutusest, asukohast ega suhtluse sagedusest.
- V1 ei kasuta hoolduskoormuse riskiskoori; lubatud on inimese enda kirjeldus või valitud vastus.
- Hooldaja Tööheaolu, supervisioon, refleksioon ja privaatne Teekond ei liigu ühisesse plaani.
- Hooldatava nõusolek ei ava hooldaja vaadet ja vastupidi.
- Spetsialist näeb ainult konkreetse eesmärgi jaoks jagatud snapshot'i.
- Funktsioon ei pane lähedasele juriidilist ega teenuseosutaja vastutust.

## 5. Minimaalne andmeleping

Paralleelvaate seos kannab kahe eraldi omaniku ID-d, suhte kasutaja enda sõnastuses,
kutse/nõusoleku seisu, nähtavuse eesmärki ja aega. Hooldaja eesmärk, järgmine samm ja jagatav
kirjeldus elavad hooldaja omandis. Ühine tegevus viitab ainult kinnitatud eesmärgi versioonile
ja näitab, kelle vajadusest see lähtus.

Audit ei kanna suhte vabateksti, terviseandmeid ega koormuse sisu. Seose lõppemine eemaldab
edasise ligipääsu, kuid ei muuda teise inimese oma kirjeid.

## 6. Teostusetapid

### E0 — kahe omaniku ja nõusoleku mudel

- Kaardista kasutajaga ja välise hooldajaga rada; V1 võib alata kahe platvormikontoga, kuid
  ei tohi väita, et väline rada on kaetud.
- Lukusta kaks eraldi nõusolekut, jagamise eesmärk ja nähtavusmaatriks.
- Tõenda, et ST10-02 plaanikandja toetab eesmärgi omanikku ilma uue plaanitabelita.

### E1 — hooldaja privaatne eesmärk ja kutse

- Lisa omaniku-skoobitud hooldaja eesmärk, järgmine samm ja valikuline toe kirjeldus.
- Kasuta olemasolevat kutse/teavituse taristut ning selgita saajale rolli enne nõustumist.
- Lõpetamine ja kutse tagasilükkamine on fail-closed.

### E2 — paralleelvaate kasutajapind

- Kuva kaks veergu/sektsiooni: „abi saava inimese eesmärk” ja „hooldaja enda eesmärk”.
- Näita iga välja omanikku, päritolu ja jagamise ulatust.
- Lisa lihtkeel, ET/EN/RU, klaviatuur, ekraanilugeja ja mobiil.

### E3 — ühise plaani ühendus

- Seo mõlema kinnitatud eesmärgid ST10-02 tegevustega ilma privaatset sisu kopeerimata.
- Nõua mõlema poole kinnitust tegevusele, mis avaldab mõlema jagatud infot.
- Lahenda ühe poole tagasivõtt nii, et teise inimese privaatne rada säilib.

### E4 — järelvaade ja tugi

- Lisa hooldaja enda kontrollpunkt ja võimalik valikuline suunamine teenuse, info või päris
  spetsialisti juurde.
- Ära loe hooldaja toetuse kasutamist hooldatava tulemuseks ega vastupidi.
- Organisatsioonikoond jääb skoobist välja.

## 7. Vastuvõtukriteeriumid ja DoD

Valmis on siis, kui hooldaja ja hooldatav saavad hoida eri eesmärke, anda eri nõusolekud,
siduda kinnitatud eesmärgi sama ühise plaaniga ning ühe poole tagasivõtt ei paljasta ega kustuta
teise privaatset sisu. Spetsialist näeb ainult jagatud välju; Tööheaolu ja refleksioon jäävad
alati välja.

Kontroll: lint, `git diff --check`, vajadusel `i18n:check` ja `prisma validate`, peatüki lõpus
build ning käsitsi hooldaja/hooldatava/spetsialisti/võõra rada. Automaatteste ega sonde ei looda
ega käivitata; kontrollimata käitumine jääb `NOT_PROVEN`.

## 8. Aktiveerimisväravad

- O-HV-1: välise, platvormikontota hooldaja V1 või hilisem viil.
- O-HV-2: suhte lõppemise ja saadetud snapshot'i säilituse õiguslik sõnastus.
- Päris piloot vajab omastehooldajate esindaja kaasamist, et koormuse kirjeldus ei muutuks
  hindavaks või süüdistavaks tööriistaks.
