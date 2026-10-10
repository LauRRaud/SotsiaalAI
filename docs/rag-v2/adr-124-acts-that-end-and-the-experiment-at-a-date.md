# ADR-124: aktid, mille redaktsioon lõpeb, ja graafikatse tulevasel kuupäeval

Kuupäev: 10.10.2026. Teostus Claude Opus 5.5 (ehitas agent, üle vaatas teine agent, parandused ja kontroll minult). Omanik 09.10.2026 õhtul: kuue tunni töö RAG-i valmisoleku nimel, agentide loaga. Seis: **kood ja testid tehtud; midagi ei ostetud.**

## Probleem

Otsing hoiab õigusaktist ainult seda redaktsiooni, mis küsitud päeval kehtib. Kui korpuses oleva redaktsiooni kehtivus lõpeb ja järgmist ei ole sisse võetud, **kaob akt sel päeval vaikselt kõigist vastustest**. Agentide kaardistus leidis selle 09.10.2026 ja ma kontrollisin üle:

| Päev | Riigi akte ilma kehtiva redaktsioonita | Omavalitsuse akte |
|---|---:|---:|
| 01.11.2026 | 3 (riigi õigusabi seadus, kriminaalmenetluse seadustik, riigihangete seadus) | 0 |
| 01.12.2026 | 4 (lisandub avaliku teabe seadus) | 0 |
| 01.01.2027 | 17 | 5 |

Kahe esimese hulgas on seadused, mis lisati alles 09.10.2026.

Igakuine kontroll Riigi Teataja vastu ([ADR-038](adr-038-law-validity-check.md), 25. kuupäeval) on olemas, kuid **oleks praeguse korpusega veaga katkenud**: ühel avaldatud redaktsioonil (kriminaalmenetluse seadustik, 111072026081) ei ole alguskuupäeva ja sortimine viskas vea enne aruande kirjutamist.

## Otsus

1. **Uus vaade `ending`** käsus `scripts/rag-v2-law-validity.mjs` (`actsEnding`, `lib/rag-v2/law-validity.js`): loeb ainult korpuse aktide loendit (`docs/rag-v2/legal-acts-in-index.json`), ei küsi võrgust midagi, ja ütleb, millised aktid jäävad horisondi sees (vaikimisi 90 päeva) ilma kehtiva redaktsioonita: viimane kaetud päev, mitu päeva on jäänud, kas korpuses on juba hilisem redaktsioon pärast vahet. Riigi aktid enne. Väljumiskood 10, kui midagi lõpeb.
2. **Kehtivuse kontrolli parandus:** alguskuupäevata redaktsioon ei katkesta enam kontrolli.
3. **Graafikatse käivitaja** (`scripts/rag-v2-graph-experiment.mjs`) sai kolm valikut: `--date` (samad küsimused teise päeva seisuga), `--vectors` (salvestatud vektorite fail eraldi kaustast) ja kaitse, mis **ei lase midagi osta**: kui mõne teksti vektor puudub, peatub käivitus enne andmebaasi avamist, välja arvatud `--allow-purchase`. Tundmatu lipp ja olematu kuupäev on viga.

## Mida see ei tee

- Ei too uusi redaktsioone ise sisse. 10.10.2026 öösel laadisin kontrolliga alla 27 puuduvat redaktsiooni ja lugesin need kohalikult sisse (5440 lõiku); ost ootab omaniku sõna (vaata üleandmise märkust).
- Väljalaske valmisoleku kontroll (`ready`) lõppevaid akte ei vaata: ebaõnnestuv `ready` peataks kogu saidi väljalasked.

## Kontrollitud

- Ühiktestid koos teiste öö muudatustega: 1337, neist 1315 läbi ja 22 vahele jäetud. Uued testid: lõppev akt, lahtise lõpuga akt, vaheta järglane, vahe kahe redaktsiooni vahel; käivitaja keeldub puuduva vektori korral enne andmebaasi avamist.
- Päris loendil 10.10.2026: 30 päeva sees lõpeb 4 riigi akti, 90 päeva sees 18 riigi ja 5 omavalitsuse akti.
- Kehtivuse kontroll parandatud koodiga päris andmetel: 501 aktigruppi, 478 muutmata, 20 muutunud, 3 ülevaatuseks; enne parandust katkes.
- Sõltumatu ülevaatus: neli väikest leidu (olematu kuupäev, tühi horisont, tundmatu lipp, tagurpidi kehtivus), kõik parandatud.

## Täiendus 10.10.2026 öösel: loend igakuises teates ja mõõtmine tulevastel kuupäevadel

**Loend igakuises teates.** Igakuine kontroll (`.github/workflows/rag-v2-law-validity.yml`, 25. kuupäeval) käivitab nüüd ka vaate `ending` 90 päeva horisondiga ja kirjutab loendi teate algusesse, enne Riigi Teataja võrdlust. Lõppev akt loetakse leiuks (teade avatakse või täieneb); loendi ebaõnnestumine teeb töö punaseks. Kontrollitud kohalikult: töövoo fail loetakse YAML-ina, teate koostamise käsud läbivad süntaksikontrolli ja teate tekst koostati päris loendist (24 rida). Töövoogu ennast GitHubis ei käivitatud; esimene käivitus on 25.10.2026.

**Mõõtmine tulevastel kuupäevadel (tasuta, serveris, salvestatud vektoritega).** Kolm raskete tingimuste kataloogi (30 küsimust), töötava vestlusprofiili haru (O) ilma valikumudelita: mitmel küsimusel jõuab otsustav säte tõendite hulka.

| | 02.10.2026 (1071 riigi dokumenti) | 10.10.2026 (2293) | 01.11.2026 (2290) | 01.01.2027 (2276) |
|---|---:|---:|---:|---:|
| Kataloog 1 (9) | 9 | 6 | 6 | 6 |
| Kataloog 2 (6) | 5 | 4 | 4 | 4 |
| Kataloog 3 (15) | 14 | 14 | 14 | 13 |
| **Kokku (30)** | **28** | **24** | **24** | **23** |

Esimene veerg on 02.10.2026 salvestatud tulemus (`docs/audits/evidence/own-subsections-2026-10-02/`).

Mida see ütleb:

1. **Korpuse kasv on selles mõõdus maksnud neli tingimust** (28 → 24). Kadusid `day-support-dementia-retirement`, `subsistence-care-home`, `rehabilitation-student` ja `reclaim-limitation`. Põhjus ei ole kuupäev, vaid see, et kaks korda suuremas korpuses on liidetud otsingu üheksa esimest lõiku teised, ja viited ning kaardid lähtuvad just neist. See haru ei kasuta valikumudelit; päris vestluses valib lõigud mudel 36 kandidaadi seast. Sama küsimuste komplekt päris vestluse rajal mõõdeti samal ööl tasuliselt: 72 pöördest 71-l jõudis otsustav säte tõendite hulka ja vastus viitas sellele ([valmisoleku loend](../audits/rag-v2-readiness-2026-10-10.md)).
2. **Seaduste lõppemine 01.11.2026 neid küsimusi ei puuduta:** kolm lõppevat seadust (riigi õigusabi, kriminaalmenetlus, riigihanked) ei ole nende küsimuste teema. Mõõt ei näita, et lõppemine oleks ohutu, vaid et see kataloog neid seadusi ei kata; küsimus riigi õigusabi kohta kaotab oma seaduse sel päeval kindlasti.
3. **Teadmiskaartide lõpp maksab ühe tingimuse.** 01.01.2027 kaob `guardian-ward-family`: selle leiab täna ainult kaartide kaudu (haru ilma kaartideta ei leia seda ühelgi päeval) ja sotsiaalhoolekande seaduse kaardid on redaktsioonil, mis kehtib 30.11.2026-ni. Sisend lüheneb samal ajal umbes 1500 tokeni võrra. Päris vestluse rajal tuli sama säte mõlemal korral valitud kandidaatide seast, ja 12 korduspöördes, kus otsingu lisasammu liik salvestati, ei toonud otsustavat lõiku kordagi kaart (viiel korral akti viide).

**Koormuse tähelepanek.** Kataloogi 1 jooks 01.11 seisuga katkes esimesel korral: samal ajal jooksid serveris otsingukontroll ja üks päris pööre ning vektoriandmebaasi päringud ületasid 30 sekundi piiri. Kordus üksi jooksis läbi. Raskeid mõõtmisi tuleb serveris käivitada ükshaaval.

## Kontrollimata

- Töövoo esimene päris käivitus GitHubis (25.10.2026).
- Küsimused seaduste kohta, mille redaktsioon lõpeb: neid kataloogides ei ole.
