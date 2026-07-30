# Sügiskool 2026 — uue akna arenduse käivitusülesanne

> Koostatud: 30.07.2026
>
> Töökaust: `C:\Users\rauds\Desktop\SotsiaalAI`
>
> Handoffi lähte-HEAD: `5e2396f77ed489b9dcb37ba545737c201fe27622`
>
> Lähtehetkel: `main == origin/main`
>
> Esimene tervikteema: `PARTNERIVALMIDUS-V1`
>
> Soovitatud haru: `codex/partnerivalmidus-v1`
>
> Merge ja deploy: ainult omaniku eraldi selgel loal

## 1. Uues aknas alustamise käsk

Loe see fail tervikuna läbi. Seejärel loe kohustuslikud lähtefailid ja alusta
`PARTNERIVALMIDUS-V1` teostamist. Selle haru ülesanne ei ole lisada tootesse uusi
funktsioone, vaid teha väliste osapoolte „jah” odavaks nelja otsustamiseks piisava
dokumendiga.

Esimene kasutajale antav vahekokkuvõte peab kinnitama:

1. milline `main` / `origin/main` SHA päriselt leiti;
2. et põhitööpuu commit'imata kasutajafailid jäid puutumata;
3. milline eraldi worktree ja haru loodi;
4. et `SEIS.md`, `SotsiaalAI.md` ja teemakohased alusdokumendid loeti tervikuna;
5. millised neli otsustusdokumenti valmivad ja millised seitse välist luba või liidest
   need katavad;
6. et selles harus ei alustata Teenuspäeviku E1–E12 tootekoodi.

## 1A. PARTNERIVALMIDUS-V1 väljundid

Loo neli lühikest, hinnatavat ja omavahel kooskõlalist dokumenti. Need on esmalt
SotsiaalAI sisemised ettepanekud. Ära avalda, saada ega nimeta neid riigi ametlikuks
standardiks ilma omaniku eraldi loata.

### A. STAR2 töötaja õigustel üleandmise spetsifikatsioon

Fail: `docs/platvormi arendus/star2-tootaja-oigustel-uleandmise-spetsifikatsioon.md`

Kirjelda vähemalt:

- inimese või spetsialisti kontrollitud mustandi eelvaade;
- kinnitamise ja üleandmise järjestus;
- variant A: liideseta käsitsi kiire üleandmine, mille järel töötaja siseneb STAR2-te;
- variant B: tulevane ametlik liides, milles volitus tuleb STAR2-sse sisse loginud
  töötajalt, mitte SotsiaalAI üldõigusest;
- SotsiaalAI-l puudub STAR2 lugemisõigus ja püsiv üldine kirjutamisõigus;
- nõusolek, auditijälg, idempotentsus, vead, parandamine ja katkestamine;
- milliseid tehnilisi ning õiguslikke otsuseid peab SKA enne variandi B avamist tegema.

Ära luba „üht vajutust” tehnilise faktina enne, kui SKA autentimis- ja
volitusmehhanism on teada. Kasuta täpsemat mõistet „üks kasutaja kinnitatud
üleandmistoiming”.

### B. Neutraalne teenuskirje vorming

Fail: `docs/platvormi arendus/teenuskirje-neutraalne-vorming.md`

Dokument peab sisaldama:

- versioonitud avalikku tuuma ja teenuseliigi profiile;
- kohustuslikke ning valikulisi välju;
- tööaja, tundliku sisukirjelduse ja päritolu lahusust;
- minimaalse andmekasutuse reegleid;
- näiteid JSON-i ja tabelkujuna;
- vastenduskihti KOV-i aruandele, arve lisale, statistikale ja STAR-i võimalikule
  sisendile;
- eraldi lisa teenuseosutajate ja KOV-ide avalike põhiandmete masinloetava korje kohta,
  sest kataloogi põhiandmed ei ole sama asi mis teenuse osutamise sündmus;
- versioonihaldust ja asendatavust: kui riik loob oma vormingu, peab SotsiaalAI saama
  adapteri ümber vahetada.

„Arve lisa” tähendab teenuse mahu või tundide väljavõtet, mitte arve koostamist,
raamatupidamist ega makseotsust.

### C. Organisatsioonikasutuse tootmis- ja piloodivalmis raamleping

Põhifail: `docs/legal/sotsiaalai_raamleping_vnext_MUSTAND.md`

Lähtealus on
`docs/legal/sotsiaalai_raamleping_uuendus_2026-07-20_MUSTAND.txt`. Arenda sellest
üks uus terviklik organisatsioonikasutuse raamlepingu versioon, mis sobib nii
piiratud piloodiks kui ka tootmiskasutuseks. See asendab pärast kinnitamist senise
raamlepingu; ära jäta kahte konkureerivat organisatsioonilepingut paralleelselt
kehtima.

Lepingu pooled on SotsiaalAI OÜ ning KOV, teenuseosutaja või muu organisatsioon.
Sotsiaaltöötaja ja muu spetsialist on organisatsiooni volitatud lõppkasutaja, mitte
üldjuhul lepingu pool. Eluküsimusega pöörduja ei ole selle raamlepingu sihtrühm:
tema privaatsele kasutusele kohalduvad eraldi kasutus- ja privaatsustingimused.
Kui inimene annab eelpöördumise või muu valitud sisu organisatsioonile üle, peab
raamlepingu andmevoo lisa määrama rollid alates üleandmise hetkest, mitte muutma
tagantjärele inimese privaatset ruumi organisatsiooni tööruumiks.

Raamleping peab võimaldama liikuda piloodist tootmisse ühe aktiveerimis- või
tellimuslisa muutmisega, ilma kogu raamlepingut uuesti koostamata. Koosta selle
juurde vähemalt:

- ühe lehe 20 minuti otsustuskokkuvõte;
- andmevoogude kaart;
- rollimaatriks privaatse ettevalmistusruumi, ametliku menetluse, üleandmise,
  teenuseosutaja tööruumi ja koondmõõtmise jaoks;
- moodulite ja lubatud töövoogude valikuleht, millest nähtub, milliseid platvormi
  osi organisatsioon kasutab ning millised osad ei ole talle aktiveeritud;
- üks tellimus- ja aktiveerimislisa, millel saab valida „piloot” või
  „tootmiskasutus”, kasutajad, kestuse, moodulid, hinna, toe, mõõdikud ja
  lõpetamise tingimused;
- kinnitus, et organisatsiooni tööandmete vaikemudel jääb raamlepingu järgi:
  organisatsioon on vastutav töötleja ja SotsiaalAI OÜ volitatud töötleja;
- lisaklauslid nende konkreetsete töövoogude jaoks, kus SotsiaalAI on iseseisev
  vastutav töötleja või kus info liigub ühelt vastutavalt töötlejalt teisele;
- alternatiiv kaasvastutuse juhuks ainult siis, kui tegelik töövoog näitab, et pooled
  määravad eesmärgid ja vahendid ühiselt;
- piloodi, tasulise piloodi ja lõpetamise põhimõtted;
- andmerikke, andmesubjekti taotluse, säilitamise, kustutamise ja auditi vastutus;
- lahtised küsimused, millele peab vastama KOV-i või sõltumatu jurist.

KOV-i sponsoreeritud digitoe mudelit, mille puhul KOV tasub eluküsimusega pöörduja
kasutuse eest, kuid ei saa tema privaatsele sisule ligipääsu, ära suru sellesse
tööalase kasutuse raamlepingusse. Selle jaoks koosta vajaduse korral eraldi
tasumis- või sponsorluslisa, mis ei muuda KOV-i inimese privaatse sisu vastutavaks
töötlejaks.

Raamlepingu uuendamisel lahenda vähemalt järgmised punktid:

- üks versiooniallikas ja tõendatav vastuvõtmine: DOCX, ASiC, HTML,
  keeleversioonid ja `WORKER_FRAMEWORK_VERSION` ei tohi kirjeldada eri sisu;
- tundlike töövoogude selge loetelu, kuid säilita üldklausel uute
  organisatsiooni lubatud töövoogude jaoks;
- kõnesalvestuse eraldi aktiveerimistingimused. Salvestus on praegu vaikimisi
  välja lülitatud; enne sisselülitamist peavad olema kokku lepitud eesmärk,
  nõusolek, ligipääs, säilitamine, kustutamine, hiljem liitunud osaleja ja
  transkriptsiooni reeglid;
- säilitustähtaegade üheselt mõistetav hierarhia: eriliigi tähtaeg peab
  sõnaselgelt olema üldise 90-päevase reegli suhtes ülimuslik. Ära käsitle
  inimese privaatset Teekonda automaatselt organisatsiooni tööandmena;
- muudatuste kord: halduslikest ja väikese mõjuga muudatustest võib ette teatada,
  kuid töötlemise eesmärki, andmeliike, rolle või riski oluliselt muutev muudatus
  vajab poolte selget kokkulepet;
- organisatsiooni tööandmete treenimiseks mittekasutamise klausel ning tõend, et
  kasutatavates teenusepakkuja seadetes pole vabatahtlikku andmejagamist sisse
  lülitatud;
- kolmandate riikide edastuse alus, tegelikud töötlemiskohad ja teenusepakkuja
  säilitusloogika;
- alamtöötlejate nimeline ja ajakohane register, etteteatamise tähtaeg,
  vastuväite kord ja tagajärg. Ise majutatud LiveKit on tarkvara, mitte iseenesest
  alamtöötleja; nimetada tuleb tegelik taristupakkuja;
- auditiklausel, mis lubab auditit ja aitab sellele kaasa, mitte ei jäta õigust
  tulevase erikokkuleppe sõltuvusse;
- lepinguline minimaalne turvameetmete tase ja kliendile sobiv turvakirjeldus,
  mis vastavad tegelikult rakendatud ning kontrollitud lahendusele;
- lepingu kestus ja lõpetamine, andmete tagastamine või kustutamine,
  dokumentide prioriteet, kohaldatav õigus ja vaidlused, keeleversioonide
  prioriteet, teadete kontaktid ning juristiga üle vaadatav vastutuse jaotus.

Ära eelda, et kasutustingimustega nõustumine määrab vastutava töötleja rolli.
Andmeroll tuleneb tegelikust eesmärgist ja andmevoost. Dokument on juristile
otsustamise alus, mitte õigusnõustamise asendus.

Kontrolli enne uue versiooni kinnitamist raamlepingu versioonid ühtseks: allkirjastatud
ASiC-konteineris olev DOCX, eraldi avalik DOCX, lehel kuvatav HTML, tekstiväljavõtted,
keeleversioonid ja `WORKER_FRAMEWORK_VERSION` peavad viitama samale sisule. Ära
asenda ega nimeta allkirjastatud faili ümber viisil, mis jätaks mulje, et vanad
allkirjad kinnitavad hilisemat sisu; uus sisu vajab uut tõendatavat nõustumist.

### D. Piloodi lähte- ja järelmõõtmise protokoll

Fail: `docs/platvormi arendus/piloodi-lahtemootmise-protokoll.md`

Protokoll peab määrama:

- 2 nädala lähteperioodi enne uue töövoo sisselülitamist;
- sama mõõteriista kasutamise lähte- ja järelperioodil;
- minimaalsed mõõdikud: dokumenteerimisele kuluv aeg, sama info sisestuskordade arv,
  paranduste arv, puuduvate väljade või tagasiküsimiste arv ja sobivuse subjektiivne
  hinnang;
- millised mõõdikud kogutakse sündmusena ja millised lühikese päevikuna;
- kuidas vältida vestluste või teenuskirjete sisu kogumist mõõtmise ettekäändel;
- valim, kestus, katkestamise tingimused, tulemuse tõlgendamine ja otsustuskriteeriumid;
- milline tulemus õigustab jätkamist, muutmist või piloodi lõpetamist.

„Mõõda kaks nädalat, siis lülita sisse” võib hiljem saada eraldi tooterežiimiks,
kuid selles harus valmib kõigepealt mõõtmisleping. Lähteolukorda saab mõõta ka enne
Teenuspäeviku valmimist, kui instrument ei muuda ise mõõdetavat töövoogu.

### E. Seitsme välise otsuse katvuskaart

Nelja dokumendi lõppu või eraldi lisasse lisa tabel, mis näitab, kus on kaetud:

1. STAR2 ülekanne;
2. aruandlusvormingu omanik;
3. teenuseosutaja ja KOV-i masinloetavad avalikud andmed;
4. „muu keskkonna” liitumisreegel;
5. andmekaitserollid;
6. kes ja millisel alusel võib inimese digitoe eest maksta;
7. millises lepingulises või hankelises vormis võib pilooti teha.

`PARTNERIVALMIDUS-V1` on valmis siis, kui neli dokumenti ja katvuskaart on
vastuoludeta, viitavad kontrollitavatele alusallikatele, eristavad ettepanekut
kehtivast ametlikust reeglist ning jurist, SKA või KOV saab märkida konkreetsed
„jah / ei / muuta” kohad ilma SotsiaalAI funktsioonide tutvustust uuesti küsimata.

## 2. Miks just see teema

Kuue küsimustiku ühine muster on, et järgmised blokeerijad ei ole funktsioonid, vaid
load, liidesed, andmerollid, maksmise alus ja piloodi vorm. Kood üksi muudaks nende
hindamise välisele osapoolele kalliks. Dokumentide eesmärk on vähendada
otsustamiskulu ja anda eksperdile konkreetne ettepanek, mida parandada.

Pärast `PARTNERIVALMIDUS-V1` omaniku vastuvõttu on järgmine eraldi tervikteema
`TEENUSPÄEVIK-V1`. Allolevad Teenuspäeviku E1–E12 nõuded jäävad selle teise faasi
teostuslepinguks; ära käivita neid praeguses dokumendiharus.

`TEENUSPÄEVIK-V1` on praegu kõige selgem koodis puuduv tervik:

- teenuse osutamise käigus tekib üks teenuskirje;
- sama kirje toidab tööajaarvestust, hoolduspäevikut, sisulist kuuaruannet ja
  s-veebi / STAR-valmis väljundit;
- välitöö neli märget annavad teenuse kestuse ja töötaja sõiduaja;
- töö kõrvalsaadus muutub aruandluseks ilma sama info korduva sisestamiseta;
- teenuseosutaja saab hiljem loobuda eraldi logistika- ja aruandlustööriistade
  paralleelsest pidamisest;
- funktsioon saab olla sügiskooli ajaks valmis, kuid välisliidesed ja partneripõhised
  vaated võivad jääda vaikimisi peidetuks ning serveris fail-closed olekusse.

See teema on põhjalikult kirjeldatud, kuid `ServiceEntry` ja `ServiceReferral` ei ole
handoffi koostamise hetkel Prisma skeemis. Ära kirjelda seda olemasoleva funktsioonina
enne, kui kood, testid ja runtime seda tõendavad.

## 3. Tõeallikad ja kohustuslik lugemine

Loe järgmises järjekorras.

1. `docs/platvormi arendus/SEIS.md`
   - ainus elava staatuse tõeallikas;
   - kui muu dokument väidab staatuse kohta midagi muud, kehtib `SEIS.md`.
2. `docs/platvormi arendus/aruandlus-teenuskirje-disain.md`
   - loe tervikuna, sh ptk 0, E1–E12, DoD, teostuskaart, lülitid ja õiguslik
     kontrollnimekiri;
   - handoffi koostamise hetkel on fail põhitööpuus commit'imata kasutajamuudatus:
     ära kirjuta seda üle ega stage'i ilma omaniku eraldi loata.
3. `docs/platvormi arendus/SotsiaalAI.md`
   - loe fail enne arendamise alustamist tervikuna läbi;
   - see on platvormi tervikloogika ja funktsioonide kohustuslik alus, mitte
     valikuline taustamaterjal;
   - see fail on samuti põhitööpuus commit'imata.
4. `docs/platvormi arendus/shs-katvuskaart.md`
   - erihoolekande tegevusplaani ja hinnangurütm;
   - sotsiaaltranspordi, tegevuslubade ja STAR-i kandmise kohustuse seosed.
5. `docs/platvormi arendus/sugiskool-2026-kusimused-SAADETAV.md`
   - loe küsimused 1–3, 6, 12–16 ja 20 koos selgitustega;
   - küsimused on välise sisendi kanal, mitte koodinõuete automaatne tõeallikas.
6. Olemasoleva koodi doonorid:
   - `prisma/schema.prisma`;
   - välitöö / `FieldVisit` mudel, API-d ja UI;
   - `REPORT_DRAFT` / dokumendiagendi rada;
   - U10 kinnitusringi muster;
   - teenusekaart ja teenuseosutaja rolli töölauad;
   - `lib/workspaces/` adapterid ja nähtavusleping;
   - `lib/wellbeing/` anonüümse koondi ja omaniku-skoobi testimustrid;
   - olemasolevad ekspordi DOCX/XLSX/CSV/PDF lahendused.

Ära loe kõiki ajaloolisi Fable'i analüüse. Ava lisaviide ainult siis, kui disainileping
või elav kood sellele otseselt viitab ja ilma selleta ei saa lepingut õigesti rakendada.

## 4. Tööpuu ja Git-ohutus

Handoffi koostamise hetkel on põhitööpuu teadlikult määrdunud. Muudetud või uued failid
kuuluvad kasutajale, sh:

- `SEIS.md`;
- `SotsiaalAI.md`;
- `aruandlus-teenuskirje-disain.md`;
- `sotsiaalkiirabi-v1-arendusleping.md`;
- sügiskooli küsimustikud, saadetavad failid, DOCX ja arhiiv;
- platvormi tutvustuse tekst.

Reeglid:

1. ära vaheta põhitööpuus haru;
2. ära stage'i, commit'i, stashi, taasta ega liiguta põhitööpuu olemasolevaid muudatusi;
3. ära kasuta `git reset --hard`, `git checkout --`, `git clean` ega stashi pop'imist;
4. loo arenduseks eraldi worktree värskest kontrollitud `origin/main` seisust;
5. soovitatud rada:

   ```text
   C:\Users\rauds\Desktop\SotsiaalAI-partnerivalmidus-v1
   ```

6. soovitatud haru:

   ```text
   codex/partnerivalmidus-v1
   ```

7. üks haru, üks tervikteema, üks lõppüleandmine;
8. vahecommit'id võivad tähistada E-etappide terviklikke kontrollpunkte, kuid ära loo
   E1–E12 jaoks eraldi mikroharusid;
9. ära merge'i, rebase'i, cherry-pick'i, push'i ega deploy ilma omaniku vastava loata;
10. kui worktree baasi ja handoffi SHA vahel on tekkinud uus `origin/main`, kontrolli
    muutust ja kasuta värsket tippu, kui see ei lõhu lepingut.

Commit'imata disainilepingut võib lugeda põhitööpuu absoluutsest asukohast, kuid seda ei
tohi vaikimisi uude worktree'sse kopeerida ega muuta.

## 5. Lukustatud toote- ja privaatsuspiirid

### 5.1 Teenuspäeviku põhiloogika

- Aruandlus on töö kõrvalsaadus, mitte eraldi vormitäitmise töö.
- Üks teenuskirje on aatom, millest tekib mitu väljundit.
- Teenuspäevik on teenuseosutaja enda töökiht, mitte STAR-i vari-register.
- Platvorm ei tee teenuse- ega toetusotsust.
- Arveldust, maksete väljaarvutamist ega raamatupidamisprogrammi ei ehitata.
- Tunnid / mahud ja tundlik narratiiv peavad olema andme- ja ligipääsutasandil
  eristatavad.
- Teenuseosutaja rolli serverivärav on kohustuslik; ainult UI peitmisest ei piisa.
- Võõras või puuduv objekt annab omaniku-skoobitud 404 ega leki olemasolu.

### 5.2 Välitöö ja asukoht

- Neli märget:
  - `LÄKSIN`;
  - `KOHAL`;
  - `LAHKUSIN`;
  - `TAGASI`.
- Iga märge tekitab serveri ajatempli.
- `KOHAL` võib lüliti korral lisada ühe hetke asukohatempli.
- Pidevat asukohajada, taustjälgimist ega töötaja teekonna reaalajas kaarti ei ehitata.
- Asukohatempel on vaikimisi väljas.
- „Kus mu inimesed on?” tähendab töötaja enda märgitud tööolekut, mitte GPS-punkti.
- `LÄKSIN` ilma `TAGASI`-ta võib toita töötaja turvakontrolli, kuid ei tohi muutuda
  tööandja nähtamatuks jälgimiseks.

### 5.3 Klient ja kinnitamine

- Kliendi osalemise / kinnitamise funktsioon ehitatakse valmis lüliti taha.
- Kliendivaade on vaikimisi väljas, kuni partneri, lepingu ja teenuseliigi otsus selle
  avab.
- Kliendi kinnitamine ei tohi tähendada, et inimene kinnitab spetsialisti tõlgendust
  faktina.
- Päritolu peab eristama vähemalt:
  - kliendi öeldu;
  - töötaja tähelepaneku;
  - töötaja tõlgenduse;
  - masina või malli mustandi.
- Jagamine ja kinnitamine on teadlik toiming, mitte automaatne kõrvalmõju.

### 5.4 Säilitamine ja kustutamine

- Disainileping näeb aruandlus- ja raamatupidamisalusele andmekihile ette 7-aastase
  säilituse.
- Ära rakenda tavapärast 90 päeva kustutust Teenuspäeviku andmetele.
- Enne kasutajale nähtava hard-delete'i avamist peab 7 aasta ulatus ja konto sulgemise
  järgne vastutus saama õigusliku kontrolli.
- Ehitus ei pea õigusanalüüsi ootama, kuid ohtlik kustutusrada peab jääma peidetuks /
  fail-closed olekusse.

### 5.5 Liidestused

- STAR2 ja s-veebi väljundid ehitatakse neutraalse sisemise mudeli ja ekspordiadapterina.
- Ära leiuta ega emuleeri riigi autentimis-, registri- või kirjutamisliidest.
- Kui päris välisliides puudub, peab funktsioon olema:
  - testitav;
  - eksporditav;
  - dokumenteeritud;
  - vaikimisi peidetud või käsitsi allalaaditava väljundina kasutatav;
  - serveris fail-closed välise saatmise suhtes.
- Integratsioonivalmidus ei tohi UI-s teeselda toimivat riigiliidest.

## 6. Tervikteema skoop

Teosta `aruandlus-teenuskirje-disain.md` leping ühe tervikteemana.

### OSA I — E1–E9

1. **E1 — andmemudel ja migratsioon**
   - `ServiceReferral`;
   - `ServiceEntry`;
   - `ServiceMonthlyNarrative`;
   - tegevuste kataloog / valitavad tegevused;
   - teenuseliigi lipud;
   - ajamärgid, valikulised asukohatemplid, päritolu ja kinnitused;
   - indeksid, omanikuskoop, säilituspoliitika kandvad väljad.
2. **E2 — sisestusvood ja välitöö sild**
   - kiire teenuskirje;
   - plaanitud visiit → kinnitatud kirje;
   - neli välitöö märget;
   - häälmärkme ohutu mustand, kui olemasolev häälkiht seda kannab;
   - välitöö pakub Teenuspäeviku kirjet, kuid ei loo seda kasutaja teadmata.
3. **E3 — suunamine, maht ja saldo**
   - periood;
   - teenuse liik;
   - lubatud maht;
   - kasutatud maht;
   - jääk;
   - üle-/alatäitmise aus kuva.
4. **E4 — kuu töövaade ja kvaliteedirütmid**
   - kuu kirjed;
   - puuduolevad või lõpetamata kirjed;
   - klienditagasiside ja ülevaatamise kokkulepped;
   - ära nimeta kvaliteedijuhise nõuet seadusest tulenevaks, kui paragrahv seda ei
     kinnita.
5. **E5 — sisuline kuuaruanne**
   - koondub teenuskirjetest ja valitud märkmetest;
   - AI / mall loob mustandi, mitte fakti;
   - kasutaja vaatab, parandab ja kinnitab;
   - vabateksti päritolu ning väidete allikas jäävad eristatavaks.
6. **E6 — mallimootor ja ekspordid**
   - tööajaarvestus;
   - hoolduspäevik;
   - sisuline aruanne;
   - s-veebi väljavõte;
   - mall on sisu/config, mitte eraldi funktsiooniharu.
7. **E7 — kliendi osalus ja kinnitus**
   - ehita lüliti taha valmis;
   - vaikimisi väljas;
   - partneri / KOV-i kaupa seadistatav;
   - kliendi nähtavus ei tohi avada töötaja privaatmärkmeid.
8. **E8 — aruandlusaja mõõtmine**
   - mõõda töövoo ajakulu ja kordussisestuse vähenemist;
   - ära mõõda töötaja „kiirust” individuaalse tulemusnäitajana;
   - piloodimõõdikud peavad näitama lahenduse mõju, mitte looma töötaja
     tulemusjälgimist.
9. **E9 — STAR / s-veeb valmidus**
   - neutraalne ekspordikuju;
   - käsitsi allalaadimine töötab;
   - välise saatmise adapter on peidetud ja fail-closed, kuni päris leping /
     liides on olemas.

### OSA II — E10–E12

10. **E10 — graafik, dispetšerlus ja staatustahvel**
    - vajalik organisatsiooni / osutaja skoop;
    - töötaja enda märgitud olekud;
    - tööde jaotamine ja vastuvõtmine;
    - ei mingit punktikaarti töötajate reaalajas jälgimiseks.
11. **E11 — päevaplaan ja navigeerimine**
    - teenusekaardi olemasoleva kaardipinna taaskasutus;
    - aadressilt navigeerimisrakendusse avamine;
    - ära ehita marsruudi optimeerimise algoritmi.
12. **E12 — kerge sõidupäevik**
    - sõiduaeg välitöö märgetest;
    - vajadusel töötaja sisestatud / kinnitatud kilomeetrid;
    - parandusjälg;
    - autopargi haldus jääb välja.

### Lisafunktsioonid

Rakenda disainilepingus kirjeldatud lisafunktsioonide kiht ainult olemasolevaid
platvormimustreid taaskasutades:

- AI-toega sisuaruande mustand;
- häälmärkme mustand;
- teadmusabi Teenuspäeviku kontekstis;
- tööheaolu tee kasutaja algatusel;
- kliendi osalus lüliti taga;
- kvaliteedirütmid;
- sama kirje korduvkasutus mitmes väljundis.

Ära kopeeri Kovisiooni, Supervisiooni ega Tööheaolu toorandmeid Teenuspäevikusse.
Moodulite vahel liigub ainult selgelt kinnitatud või teadlikult valitud väljund.

## 7. Funktsioonilülitid

Üks tõeallikas peab määrama vähemalt järgmised lülitid:

- Teenuspäeviku põhifunktsioon;
- kliendivaade;
- ühe hetke asukohatempel;
- organisatsiooni graafik / dispetšerlus;
- välisliidese adapterid;
- häälmärkme rada, kui see vajab eraldi lülitit.

Nõuded:

- server jõustab lüliti;
- UI peitmine ei ole turvapiir;
- vaikimisi olek on konservatiivne;
- lipp-väljas test on kohustuslik;
- `NEXT_PUBLIC_*` väärtuse build-time iseloom peab olema dokumenteeritud;
- peidetud funktsioon võib olla integratsioonivalmis, kuid ei tohi olla URL-i või API
  kaudu loata avatav.

## 8. Testi- ja tõendusleping

### 8.1 Ühik- ja lepingutestid

Lisa vähemalt:

- saldo arvutus;
- ajamärkide lubatud järjestused;
- topeltpuute / korduspäringu idempotentsus;
- omanikuskoop ja võõra objekti no-leak;
- rollivärav;
- lipp-väljas negatiivsed testid;
- ühe hetke asukohatempli tingimus;
- pideva asukohajada puudumise leping;
- 7-aastase kirje keelatud hard-delete;
- kliendivaate välja- ja sisseolek;
- töötaja privaatmärkmete kliendile / juhile lekkimise keeld;
- suunamise maht, kasutus ja jääk;
- parandusahel ja auditijälg;
- iga mall A–D;
- sisuaruande tuletamisreeglid;
- STAR / s-veebi adapteri neutraalne kuju;
- välise saatmise fail-closed olek;
- häälmärkme puhul tundliku sisu piirid ja kinnitamine.

### 8.2 Päris andmebaasi sünteetiline runtime

Kasuta ainult kohalikke sünteetilisi identiteete ja andmeid. Tõenda vähemalt:

1. teenuseosutaja loob suunamise;
2. töötaja või teenuseosutaja loob plaanitud visiidi;
3. neli märget tekitavad õiged ajatemplid;
4. teenuse kestus ja sõiduaeg arvutatakse;
5. üks teenuskirje jõuab kuu tööajaarvestusse ja sisuaruande mustandisse;
6. parandamine ei tekita vaikset topeltarvestust;
7. võõras kasutaja ei näe kirjet ega selle olemasolu;
8. kliendivaade väljas ei avalda midagi;
9. kliendivaade sees näitab ainult lubatud kinnitatud sisu;
10. asukohalipp väljas ei salvesta asukohta;
11. asukohalipp sees salvestab ainult kinnituse hetke, mitte jada;
12. välisliidese lipp väljas ei saada midagi;
13. kustutuse / säilituse piir toimib;
14. cleanup eemaldab ainult selle ülesande sünteetilised andmed.

### 8.3 Brauser ja ligipääsetavus

Tõenda vähemalt:

- töölaua- ja mobiilivaade;
- teenuseosutaja põhirada;
- välitöö neli suurt puutenuppu;
- klaviatuur, fookus ja ekraanilugeja sildid;
- vähendatud liikumise tugi;
- aeglane / katkev ühendus;
- topeltpuude või korduslaadimise käitumine;
- privaatsus- ja asukohatekst enne kasutamist;
- lüliti taga olev pind ei ole käsitsi URL-iga avatav.

### 8.4 Kohustuslikud väravad

Käivita kahjustatud sihttestid ja täielik projektivärav proportsionaalselt suurele
teemale:

- target-testid;
- täissviit;
- lint;
- i18n ET / EN / RU pariteet;
- Prisma generate + validate;
- migratsiooniahela kontroll;
- `git diff --check`;
- production build;
- sünteetiline runtime;
- brauseri läbiv kontroll.

Kui mõni kontroll jääb tegemata, märgi see `NOT_PROVEN`. Ära asenda runtime'i staatilise
koodilugemisega.

## 9. Valmisoleku definitsioon

Teemat ei loeta valmis pelgalt siis, kui:

- skeem on olemas;
- üks vorm salvestab;
- üks CSV tekib;
- funktsioon töötab ainult adminiga;
- UI on peidetud, aga API avatud;
- liides on dokumenteeritud, kuid käsitsi väljund ei tööta;
- OSA I töötab, kuid OSA II on jäetud nimetamata „järgmisse viilu”.

`TEENUSPÄEVIK-V1` on valmis siis, kui:

1. E1–E12 ja disainilepingu lisafunktsioonid on sama tervikteema sees teostatud;
2. DoD ja DoD-2 on täidetud või iga tõendamata punkt on ausalt `NOT_PROVEN`;
3. suur teenuseosutaja saab kasutada graafikut, päevaplaani, välitöö olekuid,
   teenuskirjeid, suunamiste saldot, aruandeid ja kerget sõidupäevikut ilma eraldi
   hoolekande-logistikarakenduseta;
4. pidevat töötaja GPS-jälgimist ei ole;
5. klient ei näe privaatmärkmeid;
6. registriliidesed on neutraalse adapteri taga ega teeskle töötavat ühendust;
7. funktsioonid on vaikimisi konservatiivsete lülitite taga;
8. kood, testid, migratsioonid, runtime ja brauserikontroll on dokumenteeritud;
9. tööharu on puhas;
10. merge'i ja deploy'd ei ole tehtud ilma omaniku loata.

## 10. Lõppüleandmine

Lõpparuandes esita:

- worktree;
- haru;
- kasutatud baas-SHA;
- commit'id ja remote SHA, kui push oli lubatud;
- migratsioonid;
- E1–E12 ja lisafunktsioonide täpne seis;
- lülitite vaikeseaded;
- testid, lint, i18n, Prisma, migratsioonikontroll, diff-check ja build;
- sünteetilise runtime'i tõendid;
- brauseri ja mobiili tõendid;
- cleanup;
- `NOT_PROVEN`;
- `OUT_OF_SCOPE`;
- teadaolevad õigus- ja partneriväravad;
- kinnitus, et tootmisandmeid ei kasutatud;
- kinnitus, kas main, server, merge ja deploy jäid puutumata.

Uuenda lõpus `docs/platvormi arendus/SEIS.md` ainult selle teema elava oleku osas ja
ainult pärast seda, kui põhitööpuu kasutajamuudatuste säilitamine on kontrollitud.

## 11. Järgmised eraldi teemad

Ära sega järgmisi teemasid Teenuspäeviku harusse.

### 11.1 Tööheaolu P3–P5

Järgmine eraldi tööheaolu haru peab käsitlema:

- vabatahtlikku kasutaja valitud rütmi;
- pausile panekut ilma võla, punase staatuse või streak'ita;
- taastumise v2 sisu, mitte ainult 24–72 tunni tööde jaotamist;
- suunamisreeglit: inimese enda samm vs töökorralduslik kokkulepe;
- madala jõuvaruga inimese ligipääsu probleemi;
- anonüümse koondi, vältimise ja vastuste ilustamise riski;
- ESTA või muu valdkondliku partneri rolli.

Lukustatud täpsustus: ESTA-l ei ole vaikimisi ligipääsu inimese privaatsetele
tööheaolu kirjetele. Kui ESTA on eraldi tööheaolu mõõtmise partner, lepitakse mõõtmise
eesmärk, andmerollid, nähtav andmetase, õiguslik alus ja vastutus eraldi kokku. Ära raiu
koodi ega dokumenti absoluutset reeglit, et ESTA ei saa kunagi ühelegi mõõtmisandmele
ligi.

### 11.2 Kiireloomuline abipalve / Sotsiaalkiirabi

Eraldi haru, olemasoleva `sotsiaalkiirabi-v1-arendusleping.md` järgi:

- ehita peidetud, liidestusvalmis ja serveris fail-closed tervik;
- avalik nimi on „Kiireloomuline abipalve”;
- partneri teenusenimi kuvatakse ainult päris mehitatud ühenduse korral;
- AI võib vastata ja mure sõnastada, kuid ei ole inimvalve ega operatiivteenus;
- elurisk jääb alati 112 rajale;
- avalik rada ei avane ilma saaja, tööaja, lugemisaja ja vastutuse kokkuleppeta.

### 11.3 STAR2, genogramm ja ökokaart

- STAR2 adapter ja käsitsi eksporditav kuju võivad olla tehniliselt valmis;
- päris registriõigus jääb välise kokkuleppe taha;
- genogrammi / ökokaardi kolmandate isikute andmete rada ei avata enne õigusanalüüsi;
- ära lahenda õiguslikku alust vaikimisi tehnilise valikuga.

### 11.4 Sügiskooli vastused

Kui ekspertide vastused saabuvad:

1. säilita saadetud küsimuste versioon muutmata;
2. seo vastus konkreetse küsimusega;
3. erista:
   - isiklik kogemus;
   - eksperdi soovitus;
   - asutuse ametlik seisukoht;
   - kontrollitav fakt;
4. märgi mõju:
   - kinnitab olemasolevat lahendust;
   - nõuab muudatust;
   - avab välisliidese või partnerluse;
   - jätab otsuse lahtiseks;
5. ära muuda üht lavavastust automaatselt tootenõudeks.

## 12. Kopeeritav käsk uude aknasse

> Loe tervikuna `docs/platvormi arendus/sugiskool-2026-arenduse-kaivitusulesanne.md`,
> `docs/platvormi arendus/SEIS.md`, `docs/platvormi arendus/SotsiaalAI.md` ja
> teised handoff'is nimetatud kohustuslikud lähtefailid. Alusta
> `TEENUSPÄEVIK-V1` teostamist
> eraldi worktree's ja harus `codex/teenuspaevik-v1`. Põhitööpuu commit'imata
> kasutajafailid peavad jääma puutumata. Tee üks tervikteema kuni E1–E12, DoD ja
> DoD-2-ni; ära lõpeta pärast skeemi või üksikut vormi. Ära merge'i ega deploy ilma
> minu eraldi loata. Hoia mind töö ajal lühidalt kursis ning lõpuks anna üks
> tõenduspõhine üleandmine.
