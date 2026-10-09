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

## Kontrollimata

- Graafikatse tulevasel kuupäeval serveris (vajab salvestatud vektoreid; kas need on pärast kettakoristusi alles, ei ole vaadatud).
