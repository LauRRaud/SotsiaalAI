# SotsiaalAI lokaalsed mudelid ja multimodaalne interaktiivsus

Kuupäev: 11.07.2026  
Seis: kontseptuaalne tehnoloogiasuund  
Staatus: kandidaadid ja prototüüpimise järjekord, mitte kinnitatud tehnoloogiavalik

## 1. Eesmärk

SotsiaalAI ruumilist keskkonda võib juhtida hiire ja klaviatuuri kõrval ka käe, pea liikumise, mikrofoni ja eesti keele abil. Selleks ei pea kõiki sisendeid saatma välisesse tasulisse AI-teenusesse. Osa mudeleid saab käitada kasutaja brauseris, kasutaja arvutis või SotsiaalAI enda serveris.

Lokaalse mudelikihi eesmärk on anda platvormile „meeled”:

- märgata kõne algust ja lõppu;
- muuta eestikeelne kõne tekstiks;
- eristada häälkäsku dikteerimisest;
- tuvastada näpistust, käe asendit ja pea liikumist;
- lugeda skannitud dokumentidest teksti;
- märgata enne jagamist võimalikke isikuandmeid;
- leida kasutaja vajadusele sobiv tööriist, materjal või teenus.

Lokaalne mudel ei tee sotsiaaltöö otsust ega asenda allikapõhist SotsiaalAI põhivastust.

## 2. Mida tähendab „lokaalne”

Lokaalsusel on kolm eri taset.

### 2.1. Brauseris lokaalne

Mudel laaditakse kasutaja brauserisse ja töötab WebAssembly, WebGPU või WebNN kaudu.

Eelised:

- kaamera- või mikrofonikaader ei pea seadmest lahkuma;
- välise teenuse minutipõhist kasutustasu pole;
- reaktsioon võib olla kiire;
- funktsioon võib pärast mudeli laadimist osaliselt töötada võrguühenduseta.

Piirid:

- mudeli esimene allalaadimine võib olla suur;
- jõudlus sõltub kasutaja arvutist ja brauserist;
- WebGPU tugi pole kõigis brauserites ja seadmetes võrdne;
- mudel kasutab kasutaja akut, mälu ja protsessorit või GPU-d;
- suure mudeli käitamine võib muuta ruumilise liidese aeglaseks.

### 2.2. Kasutaja arvutis lokaalne

Mudel töötab PWA kõrval lokaalses abiprogrammis, töölauarakenduses või seadme enda mudeliruntime'is.

Eelised:

- võimalik kasutada brauserist suuremaid mudeleid;
- heli ja video võivad jääda täielikult seadmesse;
- jõudlust saab paremini juhtida.

Piirid:

- paigaldamine ja uuendamine on keerulisem;
- vaja on Windowsi, macOS-i ja võimaliku Linuxi erilahendusi;
- asutuse hallatavas arvutis võib paigaldamine vajada administraatori luba.

### 2.3. SotsiaalAI serveris lokaalne ehk isemajutatud

Avatud mudel töötab SotsiaalAI kontrollitud serveris. Välist AI-API-t ei kasutata, kuid kasutaja sisend liigub tema seadmest SotsiaalAI serverisse.

Eelised:

- ühtlasem jõudlus eri seadmetel;
- mudelit saab keskselt uuendada ja hinnata;
- puudub välise teenuse minutihind;
- võimalik kasutada suuremat mudelit.

Piirid:

- see ei ole kasutaja seadme mõttes lokaalne;
- tekib serveri, GPU, energiakasutuse, monitooringu ja hoolduse kulu;
- tundliku heli või teksti saatmine vajab selget õiguslikku alust ja turvet;
- samaaegsete kasutajate arv võib tekitada järjekorra ja latentsuse.

„Avatud mudel” või „ilma API-tasuta” ei tähenda tasuta süsteemi. Alles jäävad taristu-, arendus-, testimis-, litsentsi- ja hoolduskulud.

## 3. Võimalikud lokaalsed mudelid

| Valdkond | Tehnoloogiakandidaat | Võimalik kasutus | Eelistatud töökoht |
|---|---|---|---|
| Kõnetuvastus | Whisper või whisper.cpp | eestikeelne dikteerimine ja häälkäsud | seade või SotsiaalAI server |
| Kõne aktiivsus | Silero VAD | kõne alguse ja lõpu tuvastamine | brauser või seade |
| Äratussõna | openWakeWord või kohandatud mudel | tulevane vabatahtlik äratusfraas | seade |
| Käepunktid ja žestid | MediaPipe Hand Landmarker / Gesture Recognizer | näpistus, lohistamine ja suuruse muutmine | brauser |
| Näo- ja peapunktid | MediaPipe Face Landmarker | parallaks ja pea asendi ligikaudne muutus | brauser |
| Käsu kavatsus | väike mitmekeelne klassifikaator | eestikeelne tekst → struktureeritud toiming | brauser |
| Teksti embedding | väike mitmekeelne embedding-mudel | tööriista, materjali või teenuse soovitus | brauser või server |
| OCR | Tesseract või Tesseract.js koos `est` keelemudeliga | dokumendipildi muutmine tekstiks | brauser, seade või server |
| Isikuandmete eelkontroll | Presidio + Eesti reeglid ja NER | nimede, kontaktide ja tunnuste märkimine | SotsiaalAI server; lihtsad reeglid ka brauseris |
| Väike keelemudel | Transformers.js, ONNX Runtime Web või WebLLM | lihtne lokaalne klassifitseerimine ja struktureerimine | võimekas brauser |
| Kõnesüntees | eraldi hinnatav eestikeelne TTS-mudel | teksti ettelugemine | seade või server |

Ükski tabeli tehnoloogia pole automaatselt tootmiskõlblik. Enne valikut tuleb kontrollida litsentsi, mudeli päritolu, eestikeelset kvaliteeti, jõudlust, brauserituge ja hooldatavust.

## 4. Eestikeelne häälkiht

Eesti keel on SotsiaalAI häälekihi algkeel, mitte ingliskeelse kihi tõlge.

Soovitatud voog:

```text
eestikeelne heli
→ kõne aktiivsuse tuvastamine
→ eestikeelne transkript
→ eestikeelne kavatsus
→ aktiivne ruumiobjekt
→ nähtav eelvaade
→ ohutu toiming
```

Käsutuvastus peab arvestama eesti keele käändeid ja loomulikke variante.

```text
„Ava töölaud”
„Mine töölauale”
„Näita mulle töölauda”
„Soovin avada töölaua”

→ intent: open_workspace
```

```text
„Tee see suuremaks”
„Suurenda seda kaarti”
„Natuke suuremaks”

→ intent: resize_object
→ direction: increase
→ target: active_object
```

Sõna „see” seotakse objektiga ainult siis, kui kasutaja on selle hiire, klaviatuuri, pilguvihje või näpistusega selgelt aktiivseks muutnud.

### 4.1. Erialaterminite sõnastik

Kõnetuvastuse ja käsutuvastuse testkorpuses peavad olema vähemalt:

- SotsiaalAI;
- Kovisioon;
- Teemaseeme;
- Meetodipeegel;
- Juhtumitöö assistent;
- STAR2;
- ESTA;
- KOV;
- eelpöördumine;
- võrgustikutöö;
- tööheaolu;
- supervisioon;
- abisoov ja abipakkumine;
- teenusekaart ja teenuseprofiil.

Terminiloendit ei käsitleta iseseisva tõena. Selle abil parandatakse tuvastust ja kavatsuse leidmist, kuid kasutaja näeb alati transkripti.

### 4.2. Hääle neli režiimi

1. **Häälkäsklused:** ruumis navigeerimine ja aktiivse objekti muutmine.
2. **Dikteerimine:** kõne muutub aktiivse tekstivälja mustandiks.
3. **Vestlus SotsiaalAI-ga:** vabas vormis eestikeelne küsimus ja vastus.
4. **Häälruum:** reaalajas suhtlemine teiste osalejatega.

Režiimid ei tohi olla korraga ebaselgelt aktiivsed. Kasutaja näeb olekut:

```text
Mikrofon on väljas
→ Kuulan…
→ Kuulsin: „tee see kaart suuremaks”
→ Sain aru: suurendan valitud kaarti
→ Valmis
```

Kui süsteem pole kindel, ei täida see käsku, vaid kuvab tõlgenduse ja küsib kinnitust.

## 5. Näpistus, hääl ja ruumiobjekt

Kõige tugevam interaktiivsus tekib mitme sisendi koostöös:

```text
pilk või sõrmekursor annab ligikaudse fookuse
→ näpistus valib konkreetse objekti
→ hääl ütleb soovitud tegevuse
→ ruum näitab eelvaadet
→ vabastamine või nupp lõpetab toimingu
```

Näited:

- kasutaja näpistab Teemaseemne kaarti ja ütleb „tee see suuremaks”;
- kasutaja valib nurgapideme ja ütleb „veel natuke”;
- kasutaja näpistab tühja ruumi ning ütleb „järgmised kaardid”;
- kasutaja valib dokumendi ja ütleb „loe see ette”;
- kasutaja valib tekstivälja ja alustab dikteerimist.

Hääl ei pea ära arvama sihtobjekti, kui ruumiline sisend on selle juba valinud.

## 6. Kaamera mudelikiht

Kaamera esimene roll on käe- ja peapunktide tuvastamine, mitte inimese hindamine.

Lubatud katsetused:

- nimetissõrme põhine rahulik ruumikursor;
- pöidla ja nimetissõrme näpistus;
- näpistusega lohistamine;
- nurgapideme näpistusega suuruse muutmine;
- tühja ruumi näpistamisega karusselli või lõuendi vedamine;
- pea asendi väga õrn parallaks;
- ligikaudne pilgufookus ainult valgusvihjena.

Keelatud või sobimatud kasutused:

- näotuvastus või biomeetriline isikusamasuse kontroll;
- emotsiooni, stressi, tööheaolu, motivatsiooni või usaldusväärsuse hindamine;
- pilguga tundliku tegevuse kinnitamine;
- kasutaja video salvestamine vaikimisi;
- taustal nähtamatu kaamera kasutamine.

## 7. Heli mudelikiht

### 7.1. Silero VAD

Voice Activity Detection eristab kõnet vaikusest ja taustamürast. See võimaldab:

- vältida vaikuse saatmist transkriptsiooni;
- käivitada Whisper ainult kõnelõigu jaoks;
- näidata ruumis „kuulan” olekut;
- lõpetada dikteerimise pärast määratud vaikust;
- vähendada arvutuskoormust.

VAD ei tuvasta kõne sisu, isikut ega emotsiooni.

### 7.2. Whisper

Whisperi mitmekeelset mudelit saab kasutada eesti keele transkriptsiooniks. Võimalikud paigutused:

- brauseris või seadmes väiksem kvantiseeritud mudel lühikeste käskude jaoks;
- SotsiaalAI serveris suurem mudel pikema dikteerimise jaoks;
- kahekihiline lahendus, kus lihtne käsk töödeldakse seadmes ja pikem tekst kasutaja nõusolekul serveris.

Enne valikut tuleb mõõta:

- eestikeelset sõnavigade määra;
- erialaterminite tuvastust;
- latentsust tavalisel 16-tollisel sülearvutil;
- mudeli allalaadimise suurust;
- mälu- ja energiakasutust;
- kontorimüra mõju;
- erinevate kõnelejate ja kõnetempode erinevust.

### 7.3. Äratussõna

Pidevat äratussõna ei lisata esimesse versiooni. Kui seda hiljem katsetatakse:

- kasutaja lubab režiimi teadlikult;
- töötlus toimub seadmes;
- äratussõna ei salvesta kõnet;
- valeaktiveerimisi testitakse eesti keeles;
- alati on olemas füüsiline või nähtav mikrofoni väljalülitamise nupp.

Esimeses MVP-s kasutatakse vajuta-ja-räägi või vajuta-ja-kuula loogikat.

### 7.4. RAG-põhine häälvestlus SotsiaalAI-ga

Praegune häälsisestus ja ettelugemine on kaks eraldi toimingut: kasutaja räägib teksti sisestusväljale, kontrollib seda ja saadab sõnumi; vastus loetakse ette alles kõlariikooni vajutamisel. See loogika peab säilima kontrollitud **dikteerimisrežiimina**, kuid selle kõrvale võib lisada eraldi **häälvestluse režiimi**.

Häälvestlus ei asenda SotsiaalAI olemasolevat RAG-i. Kõne on vestluse sisend ja väljund, kuid sotsiaalvaldkonna sisuline vastus koostatakse endiselt kontrollitud teadmusbaasi, allikate ja olemasolevate turvareeglite põhjal.

Soovitatud esimene arhitektuur on ahel:

```text
kasutaja valib „Alusta häälvestlust”
→ mikrofon avaneb kasutaja loal
→ VAD tuvastab kõnevooru alguse ja lõpu
→ eestikeelne kõnetuvastus loob nähtava transkripti
→ kõnevoor saadetakse automaatselt olemasolevasse vestluse API-sse
→ RAG otsib teadmusbaasist asjakohased allikad
→ tekstivastus ja allikad ilmuvad vestlusesse
→ kõnesüntees alustab vastuse ettelugemist automaatselt
→ kasutaja võib vastuse katkestada ja uuesti rääkida
```

See on **ahelaga häälvestlus**: speech-to-text → olemasolev RAG-vestlus → text-to-speech. Selle eelis on, et vahepealne tekst, allikad, privaatsuse eelkiht ja kinnitused jäävad SotsiaalAI kontrolli alla. Praeguse kirjelduse põhjal on sisendi ja väljundi põhiosad juba olemas; puudu on neid ühendav sessiooniloogika, automaatne saatmine, automaatne ettelugemine, kõnevoorude juhtimine ja katkestamine.

Häälvestluse nähtavad olekud:

- **Kuulan** – mikrofon töötab ja kasutaja räägib;
- **Sain aru** – transkript on nähtav ning süsteem lõpetab kõnevooru;
- **Otsin allikatest** – RAG töötab;
- **Vastan** – tekst tekib ja heli mängib;
- **Peatatud** – mikrofon ja heli on peatatud;
- **Vajan täpsustust** – transkript või küsimuse tähendus jäi ebaselgeks.

Kasutaja peab saama igal ajal:

- heli peatada või vaigistada;
- AI kõne ajal vahele rääkida;
- minna häälest tagasi tekstivestlusse;
- näha enda kõne transkripti ja AI tekstivastust;
- avada vastuse allikakaardid;
- parandada valesti tuvastatud olulist terminit;
- lõpetada sessiooni ühe selge toiminguga.

AI ei loe veebiaadresse ega pikki viiteid häälega ette. Ta võib öelda näiteks „Leidsin selle kohta kolm allikat”, samal ajal kui allikad kuvatakse ekraanil tavapäraste allikakaartidena.

### 7.5. Hilisem otsene speech-to-speech režiim

Teises etapis võib katsetada päris reaalaja speech-to-speech sessiooni, kus mudel võtab vastu ja väljastab heli otse. Brauseris sobib selleks WebRTC-põhine ühendus. SotsiaalAI teadmusbaas ühendatakse reaalajasessiooniga serveripoolse tööriistana, näiteks:

```text
otsi_sotsiaalai_teadmusbaasist(küsimus, roll, kontekst)
→ tagastab kontrollitud katkendid, allikad ja kehtivusandmed
→ reaalajaagent koostab nende põhjal suulise vastuse
→ täielik tekst ja allikakaardid jäävad ekraanile
```

Reaalajaagent ei tohi sotsiaalvaldkonna, õiguste, toetuste ega teenuste faktiküsimusele vastata ainult mudeli üldteadmise põhjal, kui vastus peab tulema SotsiaalAI teadmusbaasist. Selleks tuleb:

- kirjeldada RAG-otsing reaalajaagendi kohustusliku tööriistana;
- rakendada tööriista kutsumise ja õiguste kontroll SotsiaalAI serveris;
- tagastada mudelile võimalikult lühike, allikatega seotud kontekst;
- näidata kasutajale, kas vastus põhineb teadmusbaasil või on üldine vestluslik selgitus;
- katkestada või piirata vastus, kui vajalikku kontrollitud allikat ei leitud.

Otsese speech-to-speech variandi eelised on väiksem tajutav viivitus, loomulikum kõnevoor ja parem vahelerääkimine. Selle puudused on väiksem kontroll vahepealse transkripti üle, keerukam RAG-i jõustamine, välise reaalaja-API kasutuskulu ning vajadus testida eesti keele kõnet, häält ja erialatermineid eraldi.

### 7.6. Häälvestluse ohutus ja privaatsus

- häälvestlus algab ainult kasutaja selgest valikust;
- mikrofoni aktiivsus on kogu sessiooni vältel nähtav;
- vaikimisi ei kasutata pidevat taustal kuulamist ega äratussõna;
- kasutaja näeb, milline transkript saadeti RAG-i;
- toorheli ei säilitata vaikimisi;
- transkripti, vestluse ja allikate säilitamine järgib sama loogikat nagu tekstivestlus;
- hääl ei kinnita automaatselt pöördumise esitamist, dokumendi jagamist, kustutamist ega muud tundlikku toimingut;
- kiireloomulise olukorra kontaktid kuvatakse lisaks häälele alati ka nähtavalt;
- süsteem ei järelda häälest isikut, emotsiooni, stressi, joovet, tööheaolu ega usaldusväärsust.

### 7.7. Soovitatud arendusjärjekord

1. Säilita praegune mikrofon dikteerimisrežiimina.
2. Lisa selle kõrvale eraldi „Alusta häälvestlust” valik.
3. Ühenda VAD, automaatne saatmine, olemasolev RAG ja automaatne ettelugemine üheks sessiooniks.
4. Lisa vahelerääkimine: uus tuvastatud kõne peatab kohe AI heli.
5. Kuva reaalajas olek, transkript, tekstivastus ja allikad.
6. Testi eesti keele sõnavara, päris pauside, kontorimüra ja sotsiaaltöö terminitega.
7. Mõõda vastuse esimese heli viivitust ja RAG-otsingu kestust.
8. Katseta alles seejärel eraldi otsest speech-to-speech prototüüpi.

Tehnilised lähtekohad:

- [OpenAI Voice agents: speech-to-speech ja ahelaga häälvood](https://developers.openai.com/api/docs/guides/voice-agents)
- [OpenAI Realtime WebRTC](https://developers.openai.com/api/docs/guides/realtime-webrtc)
- [OpenAI Realtime voice activity detection](https://developers.openai.com/api/docs/guides/realtime-vad)
- [OpenAI Realtime with tools](https://developers.openai.com/api/docs/guides/realtime-mcp)

## 8. Dokumendi mudelikiht

### 8.1. Eestikeelne OCR

Tesseracti `est` keelemudel võimaldab tuvastada eestikeelset trükitud teksti. Võimalik voog:

```text
kasutaja valib dokumendipildi
→ lokaalne OCR
→ tuvastatud tekst
→ isikuandmete eelkontroll
→ kasutaja parandab ja kinnitab
→ dokument liigub analüüsi
```

OCR-i tulemust ei käsitleta originaaldokumendi täpse koopiana. Kasutaja näeb alati pilti ja tuvastatud teksti kõrvuti ning saab vigu parandada.

### 8.2. Isikuandmete eelkontroll

Presidio-laadset raamistikku võib kasutada koos Eesti-spetsiifiliste reeglite ja NER-mudeliga. Märgatavad üksused võivad olla:

- Eesti isikukood;
- telefoninumber ja e-post;
- aadress;
- inimese nimi;
- kooli, töökoha või asutuse nimi;
- STAR2 või muu menetluse viitenumber;
- tervise- ja lastekaitsega seotud tundlikud tunnused.

Automaatne tuvastus ei taga kõigi isikuandmete leidmist. See on kasutajat toetav eelkiht, mitte õiguslik garantii.

## 9. Väikesed kohalikud teksti- ja embedding-mudelid

Brauseris töötav väike mudel võib aidata ilma suure keelemudelita:

- valida eestikeelse lause põhjal häälkäsu kavatsuse;
- soovitada kasutaja küsimusele sobivat SotsiaalAI tööriista;
- leida semantiliselt sarnaseid materjale;
- võrrelda abisoovi ja abipakkumise üldistatud kirjeldusi;
- järjestada Teenusekaardi kandidaate;
- märgata, millise professionaalse meetodi või teema kohta kasutaja küsib.

Need mudelid ei anna lõplikku õigus-, teenuse- või sotsiaaltöövastust. Sisuline vastus jääb kontrollitud teadmusbaasi, allikate ja tugevama põhichati ülesandeks.

Suurt lokaalset LLM-i ei lisata esimesse interaktiivsuse MVP-sse, sest:

- mudeli allalaadimine ja soojendamine on aeglane;
- nõrgemates seadmetes võib ruumiline UI muutuda ebaühtlaseks;
- eesti keele kvaliteet võib olla väikese mudeli puhul ebapiisav;
- sama lihtsa käsu saab töökindlamalt lahendada väikese klassifikaatori ja reeglitega;
- litsents ja kommertskasutuse tingimused erinevad mudeliti.

## 10. Kulud ja litsentsid

Lokaalsed mudelid vähendavad välist minutipõhist API-kulu, kuid ei kaota kulusid.

Arvestada tuleb:

- mudelite allalaadimise ja CDN-i liiklusega;
- SotsiaalAI serveri CPU või GPU kuluga;
- brauseri mälu- ja energiakasutusega;
- mudelite uuendamise ja turvapaikadega;
- kvaliteedi hindamise testkorpusega;
- litsentside ja mudeliandmete kasutustingimustega;
- kasutajatoega seadmetel, kus WebGPU või mudel ei tööta;
- varulahendusega, kui lokaalne mudel ei käivitu.

Iga mudeli puhul dokumenteeritakse enne kasutuselevõttu:

```text
mudeli nimi ja versioon
→ allikas ja kontrollsumma
→ litsents
→ treeningandmete teadaolev päritolu
→ toetatud keeled
→ jõudlusnõuded
→ kvaliteeditestid
→ privaatsuspiir
→ uuendamise ja tagasipööramise kord
```

## 11. Privaatsus- ja turvareeglid

- Mikrofon ja kaamera on vaikimisi väljas.
- Seadme luba küsitakse ainult kasutaja algatatud toimingu järel.
- Kasutaja näeb alati, kas süsteem kuulab või vaatab.
- Ühe nupuga saab kõik heli- ja videorajad peatada.
- Toorheli ja -videot ei salvestata vaikimisi.
- Seadmes lokaalne ja serveris isemajutatud töötlus on kasutajale eristatavad.
- Mudeli väljundit käsitletakse ebakindla tuvastusena, mitte faktina.
- Tundlik toiming vajab nähtavat eelvaadet ja tavapärast kinnitamist.
- Kaamera- ja helimudeleid ei kasutata töötaja või kliendi profileerimiseks.
- Telemeetria ei sisalda toorheli, videokaadreid ega kasutaja dikteeritud tundlikku teksti.
- Mudeli vea korral taastub hiire ja klaviatuuri põhine töövoog.

## 12. Soovitatud prototüüpimise järjekord

### Etapp 1. Kaamera interaktiivsus

1. MediaPipe'i käepunktid brauseris.
2. Rahulik sõrmekursor.
3. Näpistusega Teemaseemne valimine.
4. Näpistades lohistamine.
5. Nurgast suuruse muutmine.
6. Hiire ja klaviatuuri paralleelne kontroll.

### Etapp 2. Eestikeelne häälkäsk

1. Vajuta-ja-räägi mikrofon.
2. Silero VAD või lihtne kohalik kõneaktiivsuse tuvastus.
3. Lühikese eestikeelse käsu transkriptsioon.
4. Piiratud 10–15 käsu klassifikaator.
5. Nähtav transkript ja tõlgendus.
6. Valitud Teemaseemne ohutu muutmine.

### Etapp 3. Eestikeelne dikteerimine

1. Aktiivse tekstivälja dikteerimine.
2. Algse transkripti säilitamine mustandina.
3. Kasutaja juhitud parandamine.
4. Erialaterminite testkorpus.
5. Seadme- ja serverivariandi kvaliteedivõrdlus.

### Etapp 4. Dokument ja privaatsus

1. Tesseracti eestikeelne OCR.
2. Eesti isikukoodi ja kontaktide reeglipõhine tuvastus.
3. Eesti NER-mudeli kandidaatide võrdlus.
4. Pildi ja OCR-teksti kõrvutine parandamine.
5. Kasutaja kinnitatud analüüsi üleandmine.

### Etapp 5. Kohalik soovituskiht

1. Väike mitmekeelne embedding-mudel.
2. Tööriista või materjali lokaalne soovitus.
3. Kvaliteedi ja kallutatuse testid eesti keeles.
4. Selge eristus soovituse ja allikapõhise vastuse vahel.

## 13. Esimene kombineeritud demo

Esimene terviklik katse võib toimuda Teemaseemnete lõuendil:

```text
kasutaja lubab katserežiimi
→ MediaPipe näitab sõrmekursorit
→ kasutaja näpistab kaardi aktiivseks
→ vajutab mikrofoni ja ütleb „tee see natuke suuremaks”
→ Silero tuvastab kõnelõigu
→ Whisper loob eestikeelse transkripti
→ väike käsutuvastus tagastab resize_object + increase
→ SotsiaalAI näitab tõlgendust
→ kaart suureneb
→ kasutaja saab sama toimingu tagasi võtta
```

Demo on edukas ainult siis, kui:

- eestikeelne käsk tuvastatakse piisavalt kiiresti;
- vale objekti ei muudeta;
- kasutaja saab aru, millal kaamera või mikrofon töötab;
- hiire ja klaviatuuri alternatiiv on sama kasutatav;
- heli ega videot ei salvestata;
- mudeli ebaõnnestumisel ei lähe töö kaduma.

## 14. Mitte-eesmärgid

Esimeses lokaalse interaktiivsuse arenduses ei tehta:

- emotsioonituvastust;
- stressi või tööheaolu automaatset hindamist;
- näo- või häälepõhist isikutuvastust;
- pilguga kinnitamist;
- pidevat vaikimisi kuulamist;
- automaatset tundlike toimingute täitmist;
- kogu SotsiaalAI vestluse viimist väikesesse lokaalsesse LLM-i;
- eeldust, et lokaalne mudel töötab kõigis seadmetes sama hästi.

## 15. Lähtekohad

- [OpenAI Whisper](https://github.com/openai/whisper)
- [Silero VAD](https://github.com/snakers4/silero-vad)
- [openWakeWord](https://github.com/dscripka/openWakeWord)
- [Google MediaPipe Gesture Recognizer](https://developers.google.com/edge/mediapipe/solutions/vision/gesture_recognizer)
- [Transformers.js](https://github.com/huggingface/transformers.js)
- [ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/)
- [WebLLM](https://github.com/mlc-ai/web-llm)
- [Tesseracti ametlikud keeleandmed](https://github.com/tesseract-ocr/tessdoc/blob/main/Data-Files.md)
- [Microsoft Presidio](https://microsoft.github.io/presidio/)
- [MediaDevices.getUserMedia()](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
