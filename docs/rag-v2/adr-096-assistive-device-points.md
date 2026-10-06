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

## Kontroll

`tests/rag-v2-assistive-points.test.mjs` (4 testi): tabeli lugemine (jutumärgid, komad, faili algusmärk); punkti koht ja pakkumised tulevad ainult lugemistest (omavalitsus kaks korda nimekirjas, pealinna nimi, kahel real punkt, punkt, mida kogu tabelis ei ole); avalik kuju ilma telefoni ja e-postita; viisakas lugemine üle veebi ja keeldumise ütlemine.

Päris lugemine 06.10.2026: 148 lugemist, 178 sekundit, arvud ülal. Mudeli- ega vektorikutseid ei tehtud.

## Tegemata

- **Andmestik ei ole veel korpuses ja Luna seda ei kasuta.** Kavand: iga omavalitsuse kohta üks allikas, kategooria kaupa jaotistes (punkti nimi, aadress, müük või üür, koduleht), märgitud selle omavalitsuse allikaks nagu omavalitsuse aktid. Siis leiab otsing „kust saan Tartus kuuldeaparaadi“ Tartu linna kuulmisabivahendite jaotise.
- Omavalitsused, kus punkte ei ole (10), vajavad maakonna vaadet.
- Toote nimetuse filter (neljas) on lugemata: see ütleks, kes pakub täpselt seda toodet, mitte ainult kategooriat.
- Muutuste jälgimine: uus lugemine ettepanekuna, nagu kogutud andmetel ikka.
- Omaniku otsus: kas müügipunkti üldtelefon võib vastuses olla (praegu ei ole).
- Samad punktid koordinaatidega sobiksid ka platvormi enda kaardile.
