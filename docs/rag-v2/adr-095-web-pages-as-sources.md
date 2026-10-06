# ADR-095 — Veebilehe sisu korpuse allikaks: lehtede korjaja

06.10.2026. Teostus Claude Opus 5.5. Omanik 06.10: „vaata üle andmebaasi masterist, mis veebilehtede sisu on vaja andmebaasi panna ja kuidas“; pärast ülevaadet: „jah, teeks mingi hea info korjanduse skripti lehtedele“ ja „lisaks on lehtedel veel alalehed“.

## Probleem

Allikaregistris (`Andmebaasi/register/master_sources_final.json`, 323 allikat) on 180 PDF-i ja 143 veebilehte. PDF-idest on 174 kogutud ja korpuses. **Veebilehtedest ei ole kogutud ühtegi.** Nende hulgas on ametlikud juhislehed, mis vastavad küsimustele, mida inimesed päriselt küsivad: kuidas abivahendit taotleda, mis on üldhoolduse kord, kuhu kaevata.

Korpuse lugeja oskab HTML-i (ajakirja 43 veebiartiklit on korpuses), kuid lehe toomiseks ei olnud tööriista. Käsitsi salvestatud leht toob kaasa menüüd, küpsiseteate ja jaluse, ning ametnike nimed ja telefonid.

## Otsus

Lehtede korjaja: `scripts/rag-v2-web-pages.mjs`, teegid `lib/rag-v2/web-page.js` (mida lehest hoitakse) ja `lib/rag-v2/web-collect.js` (kuidas lehti tuuakse). Mudeli- ega vektorikutseid ei tee.

### Mida lehest hoitakse

- **Sisuosa** (`main`, `article`), ühe `<article>`-ina väikeses eraldiseisvas HTML-failis: pealkirjad, lõigud, loendid, tabelid, lingid. See on kuju, mille korpuse lugeja võtab vastu sellisena, nagu ta on.
- **Välja jäävad** saidi osad: menüüd, teekond, küpsiseteade, otsing, vormid, pildid, jalus, märksõnalingid, tagasiside rida, pealkirja kordus.
- **Akordioni küsimus on pealkiri** ja selle paneel loetakse, kuigi leht seda peidab.
- **Lehe enda uuendamise kuupäev** („Viimati uuendatud …“) läheb metaandmetesse, mitte teksti.
- **Dokumendid, millele leht viitab** (vormid, juhendid), loetletakse metaandmetes lingina. Vorm antakse lingina, mitte tekstina (omaniku 30.09 otsus).

Ploki nimi on ainult vihje. Esimene päris käik näitas, et ameti akordionipaneelid kannavad printimise abiklassi (`d-print-block`) ja teise saidi sisuplokk on nimega `content-and-sidebar`: nimepõhine reegel jättis üldhoolduse lehe 9362 sõnast alles 293. Nüüd ei jäeta välja plokki, mida märgistus nimetab sisuks (akordion, vahekaart), ega plokki, mis hoiab üle 30% sisuosa tekstist.

### Isikute kontaktid ei lähe salvestatud koopiasse

Repo on avalik: ametnike nimed, telefonid ja e-postid sinna ei lähe.

- **Kontaktikaart** (lühike plokk, kus on isiku nimi ja telefon või e-post) jäetakse **tervikuna välja**. Kaart võib olla ühes lõigus, loendi real, tabeli real, mitmel real järjest (nimi, amet, telefon, e-post igaüks omaette) või nimi lõigus ja kanalid loendina. Kõik neli kuju tulid päris lehtedelt.
- **Lauses** olev isiku e-post eemaldatakse koos sama ploki telefoninumbritega; lause jääb. Selline leht märgitakse ülevaatuseks, sest nimi võib tekstis alles olla.
- **Asutuse üldkanalid jäävad** (`info@`, klienditugi, infotelefon): neid leht lugejal kasutada soovitabki.
- **Saidi e-posti kaitse taha peidetud aadress** loetakse lahti nii, nagu külastaja brauser seda teeb, ja liigitatakse nagu iga teine. Üldaadress jääb teksti, isiku oma eemaldatakse. Kui lahti lugeda ei saa, loetakse aadress isiku omaks.
- Pealkiri, mille alt kõik kaardid eemaldati, jäetakse samuti välja.

### Alalehed

Lehe alalehed on sama saidi lehed lehe enda tee all. Lingid võetakse kogu lehelt, ka jaotise menüüst (sisust jääb menüü välja, aga just seal sait alalehti loetleb). Vaikimisi loetakse kaks taset allapoole ja kuni 25 alalehte; nimekirja kirje võib öelda teisiti (`"subpages": false` või `{ "depth": 1, "max": 10 }`). Piirist välja jäänud aadressid nimetatakse aruandes.

- Päringuga link on lehe vaade, mitte leht; dokumendid ja pildid ei ole lehed.
- Sama sisuga kaks aadressi on üks allikas, ka siis, kui leht on nimekirjas eraldi ja leitakse uuesti teise lehe alalehena.
- Alaleht, mis suunab jaotisest välja, jäetakse vahele.

### Kuidas lehti tuuakse

- Ainult `https`, avalik nimi; ümbersuunamised käsitsi, iga samm kontrollitud; ajapiir 20 s, suurus kuni 3 MB.
- Saidi `robots.txt` loetakse üks kord ja seda järgitakse.
- Ühe saidi kahe päringu vahel on paus (vaikimisi 1,5 s).
- Päringu nimi on aus: `SotsiaalAI source collector/1.0 (+https://sotsiaal.pro)`.
- Lehte, mida lugeda ei saa, ei arvata: aruandes on põhjus (`http_403`, `http_404`, `not_html`, `rendered_by_script` jne).

### Muutunud leht ei kirjuta salvestatut üle

Omaniku 04.10 reegel: kogutud andmed ei kirjuta olemasolevat üle; kaks järjestikust võrdset lugemist või omaniku kinnitus; midagi ei kustutata automaatselt.

| Olek | Tähendus |
|---|---|
| `new` | salvestatud koopiat ei ole |
| `unchanged` | sisu on sama (võrreldakse teksti räsi, mitte märgistust) |
| `proposed` | sisu erineb: kirjutatakse ettepanekuna, salvestatud koopia jääb |
| `confirmed` | sisu erineb ja on sama mis varasema käigu ettepanek: teine võrdne lugemine |

Ilma `--apply`-ta ei kirjutata `Andmebaasi/` alla midagi: käigu lehed, ettepanekud ja aruanne lähevad `tmp/rag-v2-web/` alla (git ei jälgi). `--apply` paneb uue lehe kohale ja asendab kinnitatud muudatuse (vana koopia läheb `previous/` alla). Ülevaatust vajavat lehte ise kohale ei panda.

### Metaandmed

Lehe kõrvale kirjutatakse metaandmete fail võtmetega, mida korpuse metaandmete kohandaja loeb: tunnus (`web-<registri tunnus>`), pealkiri, väljaandja, aadress, kontrolli kuupäev, räsid, lehe uuendamise kuupäev, viidatud dokumendid, mis eemaldati ja mis hoiatused on. Leht on juhis ja taust, mitte õiguslik alus: `legal_basis: false`, ja keelatud väiteliigid on õigus teenusele, summa, omavalitsuse teenuse olemasolu, tähtaeg ja diagnoos.

### Nimekiri

`Andmebaasi/register/web_pages.json` nimetab lehed nende tunnusega allikaregistris. Esimene valik: **18 ametlikku juhislehte** (SKA abivahendid, üldhooldus ja järelevalve; Terviseamet; Päästeamet; ligipääsetavus; AKI ja õiguskantsleri kaebus).

## Proovikäik päris lehtedel (06.10.2026, `tmp/` alla, midagi ei pandud kohale)

| | Arv |
|---|---|
| Nimekirjas | 18 |
| Loetud lehti kokku (koos alalehtedega) | 37 |
| Sama sisuga (üks allikas) | 4 |
| Ei saanud lugeda | 2 |
| Sõnu kokku | 21 137 |
| Viidatud dokumente | 107 |
| Piirist välja jäänud alalehti | 16 |
| Eemaldatud kontaktikaarte | 7 |
| Alles jäänud üldaadresse | 5 (`info@` 4, üks tugiaadress) |
| Ülevaatust vajab | 8 |

Kontroll kõigil 37 salvestatud lehel: 879 plokist ühtegi, kus oleks nimelaadne sõnapaar telefoninumbri kõrval; ühtegi e-posti kaitse linki ei jäänud.

**Ei saanud lugeda:** Terviseameti erihoolekande leht (403) ja Riigikontrolli auditileht (404; aadress on registris aprillist ja enam ei kehti).

**Ülevaatust vajavad:** eesti.ee ligipääsetavuse juhis (lehe teksti kirjutab skript, tavalise päringuga sisu ei tule), kuus lühikest lehte kompetentsikeskuse saidilt (alla 80 sõna; osa on jaotiste avalehed) ja üks SKA leht, kus on tugiaadress, mida korjaja ei oska üldiseks ega isiklikuks liigitada.

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

### Mis lehtedest korpusesse läks

Uus korje 06.10 kell 14.18 UTC andis samad 37 lehte. Korpusesse läks **31**:

- 28 lehte, mida korjaja ülevaatuseks ei märkinud;
- 3 ülevaatuseks märgitud lehte, mille vaatasin üle ja kinnitasin (`--approve`): SKA „Abivahendi ettevõttele“ (tugiaadress on üldaadress) ja kaks lühikest sisulehte (nägemispuue; minuomavalitsus ja LIPS).

Välja jäi 6: eesti.ee juhis (tekst tuleb skriptist), kompetentsikeskuse jaotise avaleht (ainult pealkiri), kolm lehte, mis on ainult alalehtede tutvustuste loend, ja üks interaktiivse tööriista leht.

Lehed on repos (`Andmebaasi/veebilehed/`, 62 faili) samade baitidega, mis sisestati, ja failiregistris (`REGISTER.json`, `REGISTER.md`). Kõigi 31 lehe 856 plokist ühtegi, kus oleks nimelaadne sõnapaar telefoni kõrval; e-posti aadresse on viis, kõik üldaadressid.

### Korjaja täiendused selle käigus

- **Viies kontaktikaardi kuju:** isiku nimi pealkirjana, kanalid selle all (nähtud ühe andmekogu kontaktilehel, mis ei ole nimekirjas).
- **Saidi oma rida** (saidi nimi lehe pealkirja järel, „Back to list“) jääb välja.
- **`--approve id,id`**: ülevaatuseks märgitud leht pannakse kohale ainult siis, kui inimene on selle nimeliselt kinnitanud.
- `scripts/rag-v2-export-register.mjs` teeb kogutud allikate kaustast sisestuse registri ja valiku.

## Korpus v62 (06.10.2026): abivahendite müüjate lehed

Omanik 06.10: „mul on vaja, et sa paned ka veebilehed - abivahendite“. Allikaregistris on 21 abivahendite müüja ja teenuseosutaja lehte; varem soovitasin need välja jätta.

### Mida müüja saidilt loetakse

Nimekiri on `Andmebaasi/register/web_pages_vendors.json`. Registris on enamasti saidi avaleht, mille all on terve pood. Seepärast:

- loetakse **üks tase** avalehest allapoole, kuni 8 alalehte;
- alaleht loetakse ainult siis, kui tema aadress või lingi tekst ütleb, et leht on abivahendi **saamise** kohta: taotlemine, riigi soodustus, tõend, laenutus ja üür, remont, teenused, esindused ja kontakt, ettevõttest (nimekirja väli `subpages.only`, muster);
- **ei loeta** tootekataloogi, hinnakirju ega müügitingimusi: need on pikad ja vananevad.

Esimene katse laiema mustriga luges 128 lehte, neist suur osa tootekategooriad; kitsama mustriga 75 lehte (72 loetud, 2 sama sisuga, 1 registri aadress andis 404).

### Mis korpusesse läks

72 loetud lehest läks korpusesse **51 lehte 18 ettevõttelt** (16 327 sõna):

- 34 lehte, mida korjaja ülevaatuseks ei märkinud;
- 17 märgitud lehte, mille vaatasin üle: sisuosa märgistuseta lehed, mille tekst on sisu, ja lehed, mille märgitud e-posti aadressid on kaupluse või teenuse omad (enne @-märki koht või üksus).

Välja jäi 21 märgitud lehte: 13 on liiga õhukesed (alla 80 sõna) ja 8 muul põhjusel (töötajate nimed tekstis või isiklikud aadressid; tõendi vormi tekst; müüja koopia ametlikest sooduskogustest ja piirhindadest; müra tekstis). Valitud lehtedelt otsisin eraldi nimelaadseid sõnapaare ametinimetuse või telefoni kõrval: leide ei olnud.

### Kuidas müüja leht on märgitud

- **Allika liik on `vendor_page`** ja väljaandja on ettevõte. Mõlemad on vastuse mudelile näha.
- **Pealkirja ees on ettevõtte nimi** („ITAK: ABIVAHENDITE LAENUTAMINE“), kui lehe enda pealkiri seda ei ütle (`pageTitle`). Leht nimega „Laenutus“ või „Kontakt“ ei ütle allikate loendis midagi. Sisselugemine märgib sellise pealkirja hoiatusega (pealkiri tervikuna ei ole lehe tekstis); ülevaatuse reegel lubab selle ühe hoiatuse.
- **Lehtede tekstid reposse ei lähe.** Need on ettevõtete enda tekstid; avalikku reposse nende koopiat ei pandud. Korpus loeti kaustast, mida git ei jälgi, oma registriga, nagu müügipunktide lehed. Repos on nimekiri ja korjaja.

### Täiendus ja kontroll

| | |
|---|---|
| Uusi allikaid | 51 |
| Lõike | 393 |
| Ost | 385 sisendit, 60 514 tokenit, **0,0079 USD** (piir 0,03, seatud omaniku „veidi raha“ loa sees) |
| Indeks | `d058d90b`: 7480 dokumenti, 43 558 lõiku (enne `e957586c`: 7429 ja 43 165) |
| Vestlusplaan | `/etc/sotsiaalai/m4-corpus-chat-20261006f.json` |

**Kontroll päris lehel (üks pööre, 0,0044 USD).** „Kas rulaatorit saab ostmise asemel ka laenutada? Kes seda teeb ja kuidas see käib?“ Vastus andis esmalt määruse lisa järgi üüri piirmäära ja riigi osa, nimetas siis kolm laenutajat nende enda lehtede järgi (mida kaasa võtta, et saadavus tasub enne üle küsida), tõi ühe ettevõtte laenutuse päevahinna ja ütles, et see on teenusepakkuja hinnakirja hind, ning küsis omavalitsust. Viidatud: määruse lisa, „ITAK: ABIVAHENDITE LAENUTAMINE“, „INVAGO: LAENUTUS“, „Teresa Abivahendikeskus: Rent“.

### Mida tähele panna

- **Müüja leht on ettevõtte kirjeldus, mitte ametlik juhis.** Leht võib olla vananenud (ühel lehel oli veel „Haigekassa“). Õiguse ja piirmäärade alus on määrus ja Sotsiaalkindlustusameti leht; kontrollvastus eristas neid. Rohkem küsimusi ei ole proovitud.
- **Hinnad:** hinnakirju ei loetud, kuid laenutuse leht võib hinda sisaldada. Hind vananeb; muutust näeb uus korje (ajastamata).
- Kolm ettevõtet 21-st jäi ilma ühegi leheta (lehed õhukesed või märgitud) ja üks registri aadress on surnud.

## Korpus v63 (06.10.2026): puuetega inimeste organisatsioonide lehed

Allikaregistris on 58 organisatsiooni kirjet 51 saidil: puuetega inimeste kojad, puudeliikide ühingud ja patsientide liidud. Omanik 06.10: organisatsioonide üldkontaktid võivad minna avalikku reposse („jah“) ja „tee asjad lõpuni“.

Täielik organisatsiooni pakett (nagu `Andmebaasi/organisatsioonid/astangu.*`: teenused, kontaktid, dokumendid) on käsitöö. See samm on esimene aste: organisatsiooni enda lehed korjajaga, nagu müüjatel.

### Mida loetakse

Nimekiri `Andmebaasi/register/web_pages_organisations.json` (55 kirjet; välja jäid äriregistri kirje, vana ajaveeb ja leht, mille jaotis on juba v60-s). Saidi avalehelt loetakse üks tase allapoole, kuni 6 alalehte, ja ainult lehed selle kohta, kes organisatsioon on, mida ta teeb ja kuidas temaga ühendust saab; uudiseid, galeriisid, juhatuse ja töötajate lehti ei loeta. Loeti 249 lehte (95 899 sõna); 3 aadressi ei avanenud.

### Valik reegli järgi

249 lehte on ükshaaval vaatamiseks liiga palju, seepärast on reegel range ja käsitsi ei kinnitatud ühtegi lehte. Korpusesse läks **56 lehte 30 organisatsioonilt** (19 523 sõna). Välja jäi:

| Põhjus | Lehti |
|---|---|
| Õhuke (alla 80 sõna) | 83 |
| Tekstis nimelaadne sõnapaar ametinimetuse või telefoni kõrval | 50 |
| Aegunud tükk: esimestes ridades varasem aastaarv või postituse ajatempel | 19 |
| Lehelt eemaldati isiklik e-posti aadress | 14 |
| Pealkirja järgi: artikkel või uudis, patsientide lood, toetajate ja partnerite leht, kolmanda osapoole kokkuvõte toetustest või omavalitsuste kontaktidest | 11 |
| Alles jäi aadress, mis võib olla isiku oma | 9 |
| Sisuosa märgistuseta ja lühike (alla 120 sõna) | 6 |
| Pargitud domeeni teade | 1 |

Kolmanda osapoole kokkuvõtted toetustest ja teenustest jäid välja, sest need võivad olla vananenud ja ametlikud allikad on korpuses olemas. Sisuosa märgistuseta lehti on valitute hulgas 18; nende algused vaatasin üle (menüüd ei olnud).

**Ilma leheta jäi 18 organisatsiooni 48-st** (17 reegli järgi: lehed olid õhukesed, nimedega või aegunud; ühe aadress ei avanenud), nende hulgas Tartu ja Lääne-Virumaa koda, Vähiliit ja Diabeediliit.

### Märgistus

Allika liik on `organization_page`, väljaandja on organisatsioon ja pealkirja ees on organisatsiooni nimi (`pageTitle`). Liik kuulub nende hulka, mille aadressi Luna võib vastuses nimetada ([ADR-097](adr-097-web-address-in-the-answer.md)). Lehtede tekstid reposse ei lähe (organisatsioonide enda tekstid); repos on nimekiri.

### Täiendus

| | |
|---|---|
| Uusi allikaid | 56 |
| Lõike | 232 |
| Ost | 232 sisendit, 69 983 tokenit, **0,0091 USD** (piir 0,03, seatud omaniku „veidi raha“ loa sees) |
| Indeks | `214c8a6d`: 7536 dokumenti, 43 790 lõiku (enne `d058d90b`: 7480 ja 43 558) |
| Vestlusplaan | `/etc/sotsiaalai/m4-corpus-chat-20261006g.json` |

Täiendus tehti esimest korda repos olevate abiskriptidega (`rag-v2-review-by-rule.mjs`, `rag-v2-upload-parts.sh`, `rag-v2-corpus-run-guarded.sh`, [ADR-098](adr-098-monthly-assistive-refresh.md)). Kontroll päris lehel on üleandmisfailis.

### Tähele panna

- Organisatsiooni leht ei ole ametlik juhis ega õiguslik alus.
- Valik on reegli järgi, mitte lehekaupa loetud: reegel võis jätta sisse lehe, mis ei ole kasulik, ja välja lehe, mis oleks olnud.
- Organisatsioonide lehti igakuine uuendamine ei lugenud. Alates v64 loeb (ADR-098).

## Korpus v64 (06.10.2026 öösel): organisatsioonide lehed uue valikuga

Omanik küsis pärast v63: „miks 18 organisatsiooni jäi välja? neil on ju lehed“, ja lisas pildi otsingutulemustest, kus ühe patsientide liidu saidil olid lehed haiguse enda kohta.

### Mis v63 reeglites valesti oli

| Reegel | Mida see tegi | Nüüd |
|---|---|---|
| Alalehtede muster nimetas tutvustust, teenuseid ja kontakti | patsientide liidu lehti haiguse kohta ei loetud üldse | loetakse kõik alalehed peale nimetatute (`subpages.except`: uudised, varasemate aastate postitused, galerii, pood, foorum, juhatus ja töötajad, kavad ja aruanded) |
| Kuni 6, siis 12 alalehte, üks tase | ühe liidu avalehelt viis 68 linki uudistele ja piir sai nendega täis; sisulehtedele viis ainult leht „Mis on diabeet“ | kuni 40 alalehte, kaks taset |
| „Õhuke“ oli alla 80 sõna | avalehed 60–77 sõnaga (kes me oleme, aadress) jäid välja | alla 30 sõna |
| „Aegunud“ oli varasem aastaarv lehe alguses või postituse kuupäev tekstis | ühe ühingu kõik lehed kandsid malli kuupäeva; „asutatud 2019“ luges vanaks | varasem aasta pealkirjas või aadressis, või postituse kuu aadressis |
| Nimesarnane sõnapaar ametinimetuse kõrval jättis välja terve lehe | „Eesti Diabeediliit … liikmed“ luges isikuks; 50 lehte jäi välja | isikut nimetav lõik võetakse välja, leht jääb |
| Leht, millelt korjaja oli isikliku aadressi eemaldanud, jäi tervena välja | aadress oli juba läinud | välja läheb lõik, kus märge seisab |
| Lingi tekst sai lehe pealkirjaks | ühe liidu 15 lehte kandis pealkirja „LOE EDASI“ | lugema kutsuv lingitekst ei ole pealkiri; võetakse lehe enda oma (`linkTitle`) |

Vahepeal tegin vea ka teises suunas. Kui nimekontrolli leebemaks tegin (isik ainult ametinimetuse, telefoni või aadressi kõrval), vaatasin valitud 207 lehe suurtähelised sõnapaarid üle ja leidsin, et jooksvas tekstis jäid isikunimed sisse. Midagi ei olnud selleks ajaks korpusesse läinud. Sellest tuli praegune reegel.

### Valik on nüüd repos: `lib/rag-v2/web-select.js`, `scripts/rag-v2-web-select.mjs`

v63 valiku tegi ajutine skript. Nüüd on reegel testidega repos, sest sama reegel peab valima ka muutunud lehe igakuisel uuendamisel.

**Isik** on kaks järjestikust suurtähega sõna, mis ei ole millegi muu nimi, kui

- esimene on eesnimi (sõnaloend `web-select-words.js`, käsitsi kirjutatud; ei nimeta kedagi), või
- kumbagi sõna ei ole kogu lugemises kordagi väikese tähega kirjutatud (tavalist sõna on; nime ei ole), või
- üht sõna ei ole, ja kõrval on ametinimetus, telefon või aadress.

Millegi muu nimi: koht (omavalitsuste ja maakondade sõnad, ka käändes), asutuse või asja lõpuga sõna (liit, keskus, haigla, teenus …), tavaline pealkirjasõna, ja paarid, mille vaatasin ükshaaval üle ja mis ei ole isikud (`NOT_PERSONS`: asutused, ürituste ja toodete nimed, võõrkeelsed pealkirjad, ajaloo isikud, kelle järgi midagi on nimetatud). Loendist puuduv paar loetakse nimeks: viga maksab lõigu, mitte kellegi privaatsuse.

**Lõik** (lõik, loendi punkt, tabeli rida, pealkiri), mis nimetab isikut, hoiab isikliku moega aadressi või korjaja märget eemaldatud aadressist, võetakse välja. Isikut nimetava pealkirja alt läheb kogu jaotis.

**Leht jääb tervena välja,** kui

- see räägib peamiselt isikutest: välja läks üle veerandi sõnadest, üle 8 lõigu, üle 3 rea, mis on ainult nimi, või lehe enda pealkiri nimetab isikut (nimede eemaldamine jätaks alles selle, mida nende kohta öeldi);
- nimi seisab tekstis, mis ei ole ühegi lõigu sees;
- järele jääb alla 30 sõna (märgistuseta sisuosaga lehel alla 80);
- selle järgi, mis see on (aadress ja pealkiri): foorum, lood, uudised, toetajad, kava, aruanne, ajalugu, postituste loendi leht; nimekirja enda muster (`selection.leave_out`) lisab kolmanda osapoole kokkuvõtted riigi ja omavalitsuste toetustest ja teenustest, üritused ja kuulutused, arvamuslood ja venekeelsed lehed;
- see on aegunud, skriptiga kirjutatud või pargitud domeen.

### Lugemine ja valik

| | |
|---|---|
| Loetud | 1159 lehte 48 organisatsiooni saitidelt (esimene lai lugemine 505 lehte piiriga 12; teine 1146 lehte piiriga 40; neli saiti ei avanenud teisel korral ja loeti uuesti, neli loeti uuesti pealkirjade pärast) |
| Valitud | **523 lehte 43 organisatsioonilt**: 472 uut, 17 on v63 lehed, mille valitud tekst muutus, 34 on samad mis korpuses |
| Lõike välja võetud | 252 lõiku 132 lehelt |
| Välja jäi | 242 selle järgi, mis leht on; 160 peamiselt isikutest; 145 alla 30 sõna; 40 skriptiga kirjutatud; 30 pealkiri nimetab isikut; 28 märgistuseta ja lühike; 5 aegunud; 1 pargitud domeen |
| Sama sisu teise aadressi all | 2 uut lehte olid bait-baidilt samad mis v63 lehed; jäid välja (korpus võtab ühe sisu ühe korra) |
| Lehe-ta organisatsioonid (5) | Eesti Parkinsoniliit (avaleht räägib peamiselt isikutest, muu on foorum ja galerii), Põhja-Eesti Autismi Liit (üks leht, peamiselt asutajast), Eesti Puuetega Inimeste Fond (pargitud domeen), Põlvamaa Puuetega Inimeste Koda (sait ei avanenud), Tallinna linna nõustamisleht |

Ühe patsientide liidu, mille kohta omanik küsis, lehti on nüüd 9: mis on diabeet, I ja II tüübi diabeet, toitumissoovitused, diabeet Eestis ja teised. Kontakti- ja avaleht jäid välja, sest need nimetavad ühte isikut paljudes lõikudes.

### Kontroll, et nimesid sisse ei jäänud

Reegel on üks asi, tulemus teine. Vaatasin valitud lehtedelt üle kaks loendit:

- sõnapaarid, mille kumbagi sõna ei ole lugemises väikese tähega (148 + 60 + 7 paari kolmes voorus): asutused, kohad, tooted, võõrkeelsed pealkirjad ja ajaloo isikud (Braille, Koch), isikunimesid ei olnud;
- sõnapaarid, mille üks sõna on tavaline (312 + 163 + 31): üks päris nimi (eesnimi, mida loend ei tunne, tavalise sõnaga perekonnanimi, „asutajaliikmeks on …“). Selle pärast lisandusid ametisõnadesse „asutaja“ ja „liige“ ning see leht jäi välja.

**Mida see kontroll ei kata:** nime, mille mõlemad sõnad on tavalised sõnad ja eesnime loendis ei ole, kui kõrval ei ole ametinimetust. Sellist ma loenditest otsida ei oska. Üksikut eesnime (allkiri „Mari“) reegel ei eemalda.

### v63 lehed uue reegli all

- 17 lehe valitud tekst muutus (enamasti läks välja lõik, mis nimetab isikut; mõnel oli sait vahepeal muutunud). Need läksid korpusesse **uue versioonina**: see on esimene kord, kui veebilehe muutus asendab korpuses varasema versiooni.
- **5 lehte võeti korpusest välja** (`package --remove`, ADR-058 tee): kolm räägivad uue reegli järgi peamiselt isikutest, üks on tegevuskava, üks on kuulutus pealkirjaga, mis lõpeb sõnadega „Loe edasi“. See on minu eilse valiku parandus, mitte allika kadumine; lehed on poliitikast väljas, hoidlas alles ja tagasi pandavad. Omanikule öeldud.

### Täiendus

Kohalik vastuvõtt: 487 allikat, 1904 lõiku, ülevaatus reegli järgi (465 korral hoiatus, et pealkirja ei leitud tekstist: pealkirja ees on organisatsiooni nimi; probleeme 0). Poliitikas 8001 dokumenti (7536 + 470 uut − 5).

Serveris `rag-v2-corpus-run-guarded.sh 64 63`: 1825 sisendit, 600 117 tokenit, **0,0780 USD** ülempiiri 0,12 USD all (seadsin ise omaniku 06.10 loa „veidi raha“ ja päeva ülempiiri 0,50 USD sees). Indeks `7d209c63` (8001 dokumenti, 45 596 ühikut); vestluse plaan `m4-corpus-chat-20261006h.json`.

### Kontroll päris lehel

Neli küsimust, igaüks uues vestluses, pärast täiendust (väljalase `6e0630f2`; 4 pööret, 0,0154 USD):

| Küsimus | Mis tagasi tuli |
|---|---|
| diagnoositi 2. tüübi diabeet: mida teada ja kust tuge | tsiteeris liidu lehti „Mis on diabeet“ ja „Diabeet Eestis“, kaks linki mullis; ütles, et veresuhkru sihte ja ravimeid kirjelduse põhjal öelda ei saa |
| isal oli insult ja ta tuli haiglast koju | Insuldipatsientide Seltsi kolm lehte (elu pärast insulti, koduteenused, kümme ideed), kolm linki mullis |
| laps on kurt: kust tellida viipekeele tõlki | nimetas tõlketeenuse osutajaid ja Tallinna tõlketeenuse korda (Kurtide Liidu leht, link mullis) ning küsis omavalitsust. **Viga:** ühe ettevõtte aadress oli vastuses kahes kohas ühe tähe võrra valesti kirjutatud. Mull seda lingiks ei teinud (lingiks saab ainult tsiteeritud allika enda aadress, ADR-097), kuid tekstis on vale aadress |
| kaotan nägemist: kust õppida iseseisvalt toime tulema | NIRK-i rehabilitatsiooniteenused (valge kepi ja marsruutide õpe), link mullis |

Isikunimesid vastustes ei olnud. Neli küsimust on kontroll, mitte mõõtmine. Esimese vastuse algus („2. tüüpi …“) läks mullis nummerdatud loendi punktiks; omanik märkas, parandus on PR-is #430.

### Tähele panna

- Valik on reegli järgi, mitte lehekaupa loetud. Pealkirjad vaatasin üle (ligi 500) ja jätsin mustriga välja üritused, kuulutused ja kokkuvõtted; lehtede tekste ma ükshaaval ei lugenud.
- Kolmanda osapoole kokkuvõtted riigi toetustest ja teenustest (näiteks ühe liidu „Kellel on õigus saada abivahend riigipoolse soodustusega“) on väljas, sest ametlikud allikad on korpuses ja kokkuvõte võib olla vananenud. Kui omanik tahab neid sisse, on see nimekirja mustri muutus.
- Haiguste kirjeldused patsientide liitude lehtedelt on korpuses taustana; lehe metaandmed keelavad neist diagnoosi- ja raviväiteid teha, nagu teistegi veebilehtede puhul.
- Lehtede tekstid ei ole repos (organisatsioonide enda tekstid); repos on nimekiri, reegel ja sõnaloendid.

## Kontroll

`tests/rag-v2-web-select.test.mjs` (4 testi): isik kui kaks suurtähega sõna kolme tunnuse järgi ja mis ei ole isik; lõigu väljavõtmine ja lehe allesjäämine, organisatsiooni enda aadressid, metaandmed; jaotis isikut nimetava pealkirja all; millal leht jääb tervena välja.

`tests/rag-v2-web-page.test.mjs` (13 testi; lisandus alalehtede muster ja ettevõtte lehe pealkiri, v64-ga alalehtede välistus ja lingiteksti pealkiri): sisuosa eraldamine näidislehelt; isiku kontaktid kõigis neljas kujus ja peidetud aadressid; sisuosata leht ja vihje; salvestatud leht läbib päris vastuvõtu (üks sisuosa, lõikude kohad artikli sees) ja metaandmed läbivad kohandaja; `robots.txt`; alalehtede leidmine; toomine (ümbersuunamised, keelatud aadressid, mitte-HTML, ajapiir, märgistik); lehe ja alalehtede kogumine piiridega; saidi viisakus; muutuse otsus; ploki nime reegli kaks päris juhtumit.

## Tegemata

- 16 kompetentsikeskuse alalehte jäi 25 piiri taha ja kaks registri aadressi ei avanenud (403, 404).
- Lehtede muutuste jälgimine (uus korje ettepanekuna) on olemas, kuid ajastamata.
- Skriptiga kirjutatav leht (eesti.ee) vajab teist teed.
- Kontaktireegel tunneb isikut kahe suurtähega sõna järgi. See võib välja jätta ka asutuse üldkontakti, kui see on kirjas kahe suurtähega sõnana telefoni kõrval; eemaldatud kaartide arv on aruandes.
- Organisatsioonide täispaketid (teenused, kontaktid, dokumendid struktureeritult, nagu `Andmebaasi/organisatsioonid/astangu.*`) on tegemata: see on käsitöö iga organisatsiooni kohta. Lehed on korpuses (v63, v64); registrid ja otsingud ainult lingina.
