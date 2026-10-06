# ADR-096 — Abivahendite müügi- ja üüripunktid ametlikust kaardist

06.10.2026. Teostus Claude Opus 5.5. Omanik 06.10: „mulle meeldiks, et inimene saaks abivahendite leidmisel abi. tihti kurdetakse, et info on killustunud, keeruline on leida“.

## Probleem

Inimene, kes vajab abivahendit, peab teadma kolme asja: kas tal on õigus soodustusele, mis tõendit on vaja, ja **kust abivahendi saab**. Esimesele kahele vastavad Sotsiaalkindlustusameti leht ja määruse loetelu. Kolmas on killustunud: müüjaid on sadu ja igaühel oma koduleht.

Allikaregistris on 21 abivahendite müüja kodulehte. [ADR-095](adr-095-web-pages-as-sources.md) ülevaates soovitasin need välja jätta ja kirjutasin, et vastus viitab ameti otsimootorile. **See oli vale:** otsimootor näitab määruse loetelu tingimusi (milline abivahend, kellele, mis soodustusega), mitte müüjaid. Müüjad on ameti lepingupartnerid ja amet saadab neid otsima oma kaardirakendusest.

## Leid

Ameti kaardirakendus („Leia endale sobivaim abivahendi pakkuja“) on töölaud, mille tabel on avalikult loetav ja mida saab kitsendada töölaua enda filtritega: omavalitsus, maakond, toote kategooria, teenuse liik.

| | Arv |
|---|---|
| Müügipunkte | 533 |
| Omavalitsusi, kus on vähemalt üks punkt | 68 (78-st) |
| Eri kodulehti (ettevõtteid ligikaudu) | 58 |
| Neist allikaregistris | 13 (registri 20 saidist) |
| Pakkumisi (punkt × kategooria × teenuse liik) | 1232 |
| Toote kategooriaid | 18 |

Registri 21 lehte on seega osa tervikust, ja valik oli juhuslik. Ametlik tabel on täielik, ühes kohas ja ühes kujus.

Kategooriate kaupa: põetus- ja hooldusabivahendid 446 punkti (enamasti apteegid), liikumisabivahendid 116, ortopeedilised 89, olmeabivahendid 77, funktsionaalvoodid 72, kodukohandused 69, siirdumisabivahendid 69, laste abivahendid 64, eriistmed 63, kuulmisabivahendid 48, orienteerumise abivahendid 38, nägemisabivahendid 25, suhtlusabivahendid 18, signaalseadmed 12, keskkonnahäiresüsteemid 12, audio- ja visuaalse teabe abivahendid 9, arvutiabivahendid 3, juhtkoerad 2. 451 punkti ainult müüvad, 81 müüvad ja üürivad, 1 ainult üürib.

## Otsus

**Allikas on ameti kaart, mitte müüjate kodulehed.** `scripts/rag-v2-assistive-points.mjs` (teek `lib/rag-v2/assistive-points.js`) loeb tabeli üheks andmestikuks: iga punkt koos omavalitsuse, maakonna, pakutavate kategooriate ja teenuse liigiga.

- **Midagi ei arvata.** Üks lugemine annab kõik punktid; lugemine iga filtri väärtusega ütleb, millised punktid on selles omavalitsuses, pakuvad seda kategooriat ja kas müüvad või üürivad. Punkti koht ja pakkumised on täpselt need lugemised, kus ta esines. Umbes 150 lugemist, pausiga, ausa nimega.
- **Kontaktid ei lähe reposse.** Tabelis on punkti telefon ja e-post. Avalikku faili (`points.public.json`) need ei lähe; jäävad nimi, aadress, omavalitsus, maakond, koordinaadid, koduleht ja pakkumised. Telefoni annavad punkti koduleht ja ameti kaart.
- **Tulemus läheb `tmp/` alla** (git ei jälgi). Reposse ja korpusesse panek on järgmine samm.

### Mida esimene lugemine õpetas

- Tabel nimetab pealinna „Tallinn“, korpus „Tallinna linn“. Esimesel lugemisel jäi 148 punkti omavalitsuseta, kõik Harju maakonnas. Nimede erinevus on nüüd kirjas (`TABLE_NAMES`); aruanne ütleb, mitu punkti jäi omavalitsuseta, ja see arv peab olema 0.
- Sama punkt võib tabelis olla kahel real (kaks kontakti). See on üks punkt.
- Ühel punktil oli kodulehe lahtris e-posti aadress. See on kontakt, mitte koduleht.

Pärast parandusi: iga punkt on täpselt ühes omavalitsuses ja ühes maakonnas ning igal on vähemalt üks pakkumine. 14 punktil ei ole kaardikohta.

## Andmestikust korpuse allikad

Omanik 06.10: „üld võib olla, pane juhislehega“. `pointSources` teeb andmestikust 83 väikest lehte:

- **Omavalitsuse leht** (68): kõik selle omavalitsuse punktid abivahendi kategooria kaupa. Iga punkti kohta nimi, aadress, müük või üür, **üldtelefon** ja koduleht. Leht on selle omavalitsuse allikas: otsing kasutab seda siis, kui vestlus on selle omavalitsuse kohta.
- **Maakonna leht** (15): ülevaade, millises omavalitsuses on millise kategooria punkte, ja millistes omavalitsustes punkte ei ole. Leht on maakonna kõigi omavalitsuste allikas, nii et punktita omavalitsuse inimene saab teada, kus lähimad on. Aadress ja telefon on omavalitsuse lehel.

Reeglid:

- **Telefon** antakse ainult siis, kui tabelis on terve number (7–8 numbrit). E-posti lehtedel ei ole.
- **Punkti nimi on sageli nimi ettevõtte sees** („Tartu“, „Kesk 27“). Kelle punkt see on, ütleb selle kõrval ettevõtte sait: kodulehe sait, selle puudumisel e-posti aadressi sait, kui see on ettevõtte oma (aadressi ennast ei kasutata).
- **Maakond** on see, mille tabel punktidele annab; punktita omavalitsusel paketi enda sõna (paketid kirjutavad maakonda mitut moodi).
- **Telefonidega lehed reposse ei lähe.** Need genereeritakse korpuse jaoks kausta, mida git ei jälgi, ja sisestatakse sealt oma registriga (`scripts/rag-v2-export-register.mjs`), nagu kontaktide eksport.

## Korpus v60 (06.10.2026)

Omanik 06.10: „üld võib olla, pane juhislehega“ (müügipunkti üldtelefon võib vastuses olla; müügipunktid lähevad korpusesse koos juhislehtedega) ja samal päeval „minu luba antud ka veidi raha kulutada“. Ostu ülempiiri (0,04 USD) seadsin ise selle loa sees.

| | |
|---|---|
| Uusi allikaid | 114: 31 juhislehte ([ADR-095](adr-095-web-pages-as-sources.md)) ja 83 müügipunktide lehte ([ADR-096](adr-096-assistive-device-points.md): 68 omavalitsust, 15 maakonda) |
| Lõike | 864; hoiatusi ja blokeerijaid 0 |
| Ost | 864 sisendit, 187 635 tokenit, **0,0244 USD** (piir 0,04; kasutuskirje `pilot_4925b6fc…`) |
| Indeks | `3b3b1325`: 7419 dokumenti, 43 018 lõiku (enne `2e4b3572`: 7305 ja 42 154) |
| Vestlusplaan | `/etc/sotsiaalai/m4-corpus-chat-20261006d.json` |

**Kontroll päris lehel (kaks pööret päris mudeliga, 0,0035 ja 0,0045 USD):**

- „Kust saan Tartus kuuldeaparaadi?“ Vastus nimetas Tartu linna kuulmisabivahendite punktid aadressidega (viis kuuest; kahel ka telefon), eristas müügi ja üüri ning viitas allikale „Abivahendite müügi- ja üüripunktid: Tartu linn“. Lisas, et Tartu valla kohta ta nende andmete põhjal öelda ei saa.
- Jätkuküsimus „Mis tõendit mul selleks vaja on ja kes selle annab?“ Vastus viitas määrusele, selle lisale ja uuele juhislehele „Abivahendi vajajale“.

Kaks pööret on kontroll, et uued allikad jõuavad vastusesse, mitte kvaliteedi mõõtmine.

**Tähelepanek kontrollist:** punkti, mille nimi on ainult „Tartu“, nimetas vastus aadressi järgi („Teguri tn 37b asuvast müügikohast“), mitte ettevõtte järgi. Leht võiks sellise punkti puhul öelda ettevõtte saidi nime ette.

## Kontroll

`tests/rag-v2-assistive-points.test.mjs` (5 testi): tabeli lugemine (jutumärgid, komad, faili algusmärk); punkti koht ja pakkumised tulevad ainult lugemistest (omavalitsus kaks korda nimekirjas, pealinna nimi, kahel real punkt, punkt, mida kogu tabelis ei ole); avalik kuju ilma telefoni ja e-postita; viisakas lugemine üle veebi ja keeldumise ütlemine.

Päris lugemine 06.10.2026: 148 lugemist, 178 sekundit, arvud ülal. Mudeli- ega vektorikutseid ei tehtud.

## Tegemata

- Kvaliteeti ei ole mõõdetud: kaks pööret päris lehel on kontroll, mitte mõõtmine. Kontrollimata on punktita omavalitsuse inimese küsimus (maakonna leht) ja kategooriad peale kuulmisabivahendite.
- Toote nimetuse filter (neljas) on lugemata: see ütleks, kes pakub täpselt seda toodet, mitte ainult kategooriat.
- Muutuste jälgimine: uus lugemine ettepanekuna, nagu kogutud andmetel ikka.
- Samad punktid koordinaatidega sobiksid ka platvormi enda kaardile.
