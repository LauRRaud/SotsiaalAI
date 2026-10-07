# ADR-098: abivahendite info uuendamine kord kuus

Kuupäev: 06.10.2026. Seis: skriptid ja seis on paigas, esimene päris käivitus tehtud; ajastatud töö on loodud. Korpuse täiendust selle tee kaudu ei ole veel tehtud (esimesel käivitusel ei olnud midagi rakendada).

## Probleem

Korpuses olev abivahendite info vananeb:

- Sotsiaalkindlustusameti müügipunktide tabel (533 punkti, 93 lehte korpuses, [ADR-096](adr-096-assistive-device-points.md));
- ameti kaks abivahendite juhislehte ([ADR-095](adr-095-web-pages-as-sources.md));
- 51 müüjate lehte (sama ADR, korpus v62). Kontrollvastus tõi kahe müüja laenutuse päevahinnad nende enda lehtedelt.

Omanik 06.10.2026: „saad sa teha süsteemi, mis kord kuus uuendab teatud abivahendite infot?“ ja hiljem „tee asjad lõpuni“.

## Otsus

Kaks korda kuus (1. ja 3. kuupäeval) loeb ajastatud töö allikad uuesti. Muutus rakendub kogutud andmete reegli järgi (omanik 04.10.2026): **teisel samasugusel lugemisel**, ja **midagi ei kustu iseenesest**. Seepärast on lugemisi kaks: esimene teeb muutusest ettepaneku, teine kinnitab.

### Mida loetakse

| Allikas | Kuidas | Mis on muutus |
|---|---|---|
| Müügipunktide tabel | `collectPoints` (148 lugemist, umbes 3 minutit) | uus punkt; punkt, mille andmed erinevad; punkt, mida enam ei ole |
| Müügipunktide lehed | tehakse vastuvõetud punktidest uuesti | leht, mille punktid muutusid (ainult lugemise kuupäeva pärast lehte uuesti ei tehta) |
| Müüjate lehed korpuses | lehtede korjaja, täpselt need 51 aadressi | lehe sisu erineb salvestatud koopiast |
| Ameti kaks juhislehte | lehtede korjaja, nimekiri `web_pages.json` | sama |
| Organisatsioonide lehed korpuses (alates 06.10.2026 õhtust) | lehtede korjaja, täpselt need aadressid, mis korpuses on | lehe sisu erineb sellest, mis viimati loeti |

### Reeglid

- **Uus või muutunud punkt** rakendub, kui eelmine lugemine näitas sama muutust (sama punkt, samad uued andmed).
- **Kadunud punkti ei eemaldata iseenesest.** Kaks lugemist järjest kadunud punkt jääb vastuvõetud andmetesse ja aruanne nimetab selle; eemaldab inimese kinnitus (`--approve-removals <võti>`).
- **Muutunud leht** on esmalt ettepanek ja asendab salvestatud koopia teisel samasugusel lugemisel. Leht, mis muutub iga kord (avaleht pakkumistega), ei kinnitu kunagi ja jääb nii, nagu on.
- **Ülevaatuseks märgitud leht** (nimi lingis, märgistuseta sisuosa, õhuke) ei lähe ise kohale; aruanne nimetab selle ja inimene vaatab üle.
- **Vigane lugemine ei ole uudis:** kui tabelist tuleb alla 80% varasemast punktide arvust või mõni punkt jääb omavalitsuseta, katkestab skript.
- Müüja saidi uusi lehti ei otsita; loetakse neid, mis korpuses on.
- **Organisatsiooni leht valitakse uuesti sama reegliga, mis ta korpusesse valis** (ADR-095, `lib/rag-v2/web-select.js`: isikut nimetav lõik võetakse välja). Korjaja ise neid lehti kohale ei pane, sest enamik on ülevaatuseks märgitud just selle pärast, mida valik kontrollib. Teisel samasugusel lugemisel:
  - leht, mis valiku läbib ja mille valitud tekst erineb, asendab salvestatud koopia ja läheb täiendusse;
  - leht, mille muutus oli ainult selles osas, mille valik välja võtab, ei muuda korpuses midagi (salvestatakse ainult uus lugemise räsi);
  - leht, mille valik nüüd välja jätab (näiteks on lehest saanud isikute nimekiri), jääb korpusesse nii, nagu oli, ja aruanne nimetab selle (`changedAndLeftOutByTheChoice`). Eemaldamise otsustab inimene.
- Organisatsiooni saidi uusi lehti ei otsita; uued lehed tulevad uue korjega (`rag-v2-web-pages.mjs` ja `rag-v2-web-select.mjs`, ADR-095).

### Kulu

Lugemine, võrdlus ja aruanne on tasuta. Raha kulub ainult siis, kui on mida korpusesse viia: vektorite ost ja üks kontrollküsimus.

**Kuu ülempiir on 0,10 USD** (ost ja kontroll kokku). Selle soovitasin omanikule 06.10.2026; omanik vastas „tee asjad lõpuni“ ja lage ei muutnud. Tänased kolm täiendust maksid 0,006–0,024 USD. Kui kuu kulu ületaks lae, jääb töö aruande juurde seisma ja ootab omanikku. Lagi on kirjas ajastatud töö juhises; omanik saab selle seal muuta või töö välja lülitada.

## Kus mis on

- Skript: `scripts/rag-v2-assistive-refresh.mjs` (otsused: `lib/rag-v2/assistive-refresh.js`).
- Seis on väljaspool repot, sest lehtedel on telefoninumbrid ja ettevõtete enda tekstid: `C:\Users\rauds\Desktop\Sotsiaal.ee\tmp\rag-v2-assistive-refresh\`
  - `accepted/points.json` vastuvõetud tabel; `pending.json` eelmise lugemise ettepanekud;
  - `accepted/pages/` müüjate lehtede salvestatud koopiad; `accepted/organisations/` organisatsioonide lehed nii, nagu valik need korpusesse pani; `ingested/abivahendid/` punktilehed nii, nagu korpuses;
  - `increment/sources/` mis ootab täiendust (koos registriga); `reports/` iga käivituse aruanne.
- Ametlike lehtede koopiad on repos (`Andmebaasi/veebilehed`); kui selline leht muutub, muutub repo fail ja tema räsi failiregistris (`Andmebaasi/REGISTER.json`) tuleb käsitsi uuendada.
- Abiskriptid täienduse jaoks: `scripts/rag-v2-review-by-rule.mjs` (ülevaatus reegli järgi), `scripts/rag-v2-upload-parts.sh` (üleslaadimine osade kaupa), `scripts/rag-v2-corpus-run-guarded.sh` (serveri käivitus sisendite piiriga).

## Töö käik

1. **Lugemine.** Värskes tööpuus (`origin/main`):

   ```bash
   node --import ./scripts/register-node-source-loader.mjs scripts/rag-v2-assistive-refresh.mjs --state "C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/rag-v2-assistive-refresh"
   ```

   Aruanne ütleb: mis punktid rakendusid, mis on ettepanekud, mis kadunud punktid ootavad kinnitust, mis lehed muutusid, mis on ülevaatuseks märgitud, ja kas täiendus ootab (`increment`).

2. **Kui täiendust ei oota,** on töö tehtud: aruanne omanikule, raha ei kulunud.

3. **Kui täiendus ootab** (N on järgmine korpuse versioon, eelmine poliitika on põhikoopias `tmp/rag-v2-v<N-1>/ship/policy.json`):

   ```bash
   D=tmp/rag-v2-v$N; STORE="C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/rag-v2-corpus-store-v25"
   mkdir -p $D && cp -r "C:/Users/rauds/Desktop/Sotsiaal.ee/tmp/rag-v2-assistive-refresh/increment/sources" $D/sources
   # hoidla pea varukoopia: $STORE/tenant_…/active.json ja publications/ kausta $D/store-backup-v<N-1>
   node scripts/rag-v2-ingest-batch.mjs --mode plan --development-only --registry $D/sources/REGISTER.json --selection $D/sources/selection.json --tenant sotsiaalai-corpus --manifest $D/plan.json
   node scripts/rag-v2-ingest-batch.mjs --mode run --development-only --manifest $D/plan.json --input-root $D/sources --store "$STORE"   # korda, kuni olek on „prepared“
   node scripts/rag-v2-ingest-batch.mjs --mode review --development-only --manifest $D/plan.json --store "$STORE" --review $D/review-draft.json
   node scripts/rag-v2-review-by-rule.mjs $D/review-draft.json $D/review.json "<kes ja kelle korraldusel>"
   node scripts/rag-v2-ingest-batch.mjs --mode publish --development-only --manifest $D/plan.json --store "$STORE" --review $D/review.json
   node scripts/rag-v2-corpus-refresh.mjs package --store "$STORE" --policy "<eelmine policy.json>" --review $D/review.json --out $D/ship
   ```

   **Enne üleslaadimist kaks kontrolli** (07.10.2026, v66 õppetund, ADR-099): (1) korpuse lõigud pluss täienduse lõigud ei tohi ületada indeksi mahupiiri (`lib/rag-v2/search/capacity.js`: 80 000 lõiku ja 10 000 dokumenti põlvkonna kohta, ADR-100), muidu keeldub serveri plaan pärast seda, kui hoidla pea on juba tõstetud; (2) serveri kettal peab olema ruumi umbes 380 KB iga uue lõigu kohta, lisaks pakk ja 1,5 GB järgmise väljalaske jaoks. Dokumendi märksõnad (`tags`) on otsinguabi iga lõigu juures: ühist märksõna kogu partiile ei panda.

   Serverisse: `ship.json` (väike, tavalise ssh-vooga), `policy.json` ja `ship.tgz` skriptiga `rag-v2-upload-parts.sh` kausta `/home/ubuntu/rag-v2-work/rag-v2-v25/` nimedega `ship-v$N.json`, `policy-v$N.json`, `ship-v$N.tgz`. Päeva hinnafail (`…/prices/price-<kuupäev>.json`, `text-embedding-3-large`, kontrollitud ametlikult lehelt; plaan keeldub üle 24 tunni vanusest). Siis `rag-v2-corpus-run-guarded.sh` serveri töökausta ja käivitus lahti ühendatult: versioon, eelmine versioon, plaanifail, ülempiir (kuu laest järelejäänu), lubatud sisendite arv (lõikude arv pluss kümnendik) ja alus kahes keeles.

4. **Pärast:** logis `run-v$N exit: 0` ja `running plan:`; üks kontrollküsimus päris lehel, kui brauseris on omaniku seanss (muidu öelda, et kontrolli ei tehtud); `--mark-ingested`; töökaust põhikoopia `tmp/` alla; **registrid** (omanik 07.10.2026: register peab näitama ka RAG-i seisu ehk kõike, mis korpuses on): `node --import ./scripts/register-node-source-loader.mjs scripts/rag-v2-register-corpus.mjs --store "<hoidla>" --policy tmp/rag-v2-v$N/ship/policy.json --version v$N --index <indeksi 8 märki>` kirjutab `Andmebaasi/REGISTER.json` ja `REGISTER.md` uue seisu (mis failid on korpuses, korpus allikaliigiti, väljaspool repot hoitavad allikad; kontaktide kohta ainult arvud), ja see läheb PR-iga reposse; mälu (järgmine aluspoliitika, summad); aruanne omanikule summadega. See samm kehtib iga korpuse täienduse, mitte ainult igakuise uuendamise kohta.

## Esimene käivitus (06.10.2026)

| | Tulemus |
|---|---|
| Tabel | 533 punkti loetud, 533 vastuvõetud; muutusi ei ole |
| Punktilehed | 93 muutmata |
| Müüjate lehed | 51 loetud: 50 muutmata, 1 ettepanek (ühe müüja avaleht oli pärastlõunast muutunud) |
| Ameti lehed | 2 loetud, muutmata |
| Täiendus | ei oota; raha ei kulunud |

## Organisatsioonide lehtede sammu proov (06.10.2026 õhtul)

Omanik viitas 06.10.2026 minu enda loetelule tegemata asjadest („siit saad ka vist midagi edasi teha?“), kus oli kirjas, et organisatsioonide lehti igakuine uuendamine ei loe.

Proov tehti eraldi prooviseisuga (`tmp/` all, päris seisu ei puudutatud): ühe organisatsiooni 13 valitud lehte „korpusena“, kahel neist salvestatud koopia tahtlikult teistsugune kui sait praegu ütleb. Ühel oli tekstist lõik välja võetud, teisel ainult lugemise räsi muudetud.

| Lugemine | Tulemus |
|---|---|
| 1. | 11 muutmata, 2 ettepanek; midagi ei pandud kohale |
| 2. | 2 kinnitatud: üks läks täiendusse (lõik on tagasi, fail on sama mis saidilt valitud leht), teine märgiti „muutus ainult selles, mille valik välja võtab“; täiendus ootab registri ja valikufailiga |
| 3. | 13 muutmata |

See näitab, et samm teeb, mida reegel ütleb. Muutus oli tehislik (mina muutsin salvestatud koopiat), mitte saidi päris muutus.

## Kontroll

`tests/rag-v2-assistive-refresh.test.mjs` (3 testi): lugemise muutused (samad andmed teises järjekorras ei ole muutus); muutus on esimesel lugemisel ettepanek ja rakendub teisel; kadunud punkt ootab inimest ja läheb ainult kinnitusega; teistsugune muutus alustab uuesti; punktilehti tehakse uuesti ainult seal, kus punktid muutusid.

Ülevaatuse reegli skript andis tänaste täienduste mustanditel sama tulemuse kui käsitsi tehtud reeglid (v61: 10 punktilehte, v62: 51 müüja lehte).

## Kontrollimata ja tegemata

- **Muutunud allika viimine korpusesse on proovitud ühe sammu võrra.** Korpus v64 (06.10.2026 öösel) viis 17 muutunud veebilehte korpusesse uue versioonina ja võttis 5 lehte poliitikast välja sama täiendustee kaudu (kohalik vastuvõtt, pakett, serveri käivitus): indeksis 8001 dokumenti, käivitus lõppes veata. Uuendamise skripti enda `increment/` kaustast tulnud täiendust ei ole veel tehtud; see on esimesel päris muutusel esimene kord.
- **Ajastatud töö jookseb omaniku arvutis** Claude'i rakenduses ja ainult siis, kui rakendus on avatud; kinnise rakenduse korral käivitub ta järgmisel avamisel. Server korpust sisse ei loe.
- Ajastatud töö ise ei ole veel kordagi käivitunud; esimene kord on 1. novembril.
- Kontrollküsimus vajab brauseris omaniku seanssi; ilma selleta jääb see tegemata ja aruanne ütleb seda.
- Hinnad müüjate lehtedel võivad kahe lugemise vahel (kuni kuu) vananeda.
- Organisatsioonide lehtede lugemine pikendab käivitust (üks päring pooleteise sekundi järel saidi kohta); kui pikaks, näitab esimene päris käivitus.
- Skripti ja ajastatud töö nimi räägib abivahenditest, kuid loetakse ka organisatsioonide lehti. Nime ei muudetud, et ajastatud töö ja seisukaust jääksid samaks.
