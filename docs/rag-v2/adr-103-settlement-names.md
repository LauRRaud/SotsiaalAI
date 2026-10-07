# ADR-103: asula nimi viib omavalitsuseni

Kuupäev: 07.10.2026. Seis: kood tehtud ja serveris päris sõnavormide lugejaga läbi proovitud (mudelit kutsumata); päris vestluse kontroll pärast juurutust on üleandmisfailis (S1.0).

## Probleem

Omanik küsis 07.10.2026 päris vestluses, kui palju hooldekodu koht maksab. Luna küsis, mis omavalitsuses on inimese elukoht. Vastused olid „Tabasalu“, „jah, pihlakodu“ ja „jah“. Kõik neli vastust jäid üldiseks ja Luna küsis elukohta kolm korda.

Pöörete kirjetest (esimene pööre `868e3d0a`):

- Üheski pöördes ei olnud omavalitsust (`searchAssist.places` tühi). Vestluse kohakontroll tundis ainult 78 omavalitsuse enda nime (`municipalDirectoryAdapter.loadRegions()`: `displayName` ja `baseName`). Tabasalu on Harku valla alevik.
- Teises pöördes ei pakkunud otsinguplaan kohta üldse; kolmandas pakkus („Tabasalu“, isik ebaselge, seos „muu“) ja server jättis selle kõrvale; neljandas oli vestluse mälus juba fakt „rahvastikuregistrijärgne elukoht on Tabasalu“, aga valda sellest ei saadud.
- Harku valla kord on korpuses (§ 27 „Kulude katmine“: tasumise otsustab osakond, vallavalitsus kehtestab piirmäära, vara ja ülalpidajateta inimese kulud katab vald) ja Harkul on 19 kontaktikirjet. Vastuseni ei jõudnud neist midagi.

Asula nimi on tavalisem kui valla nimi: inimene ütleb „Tabasalu“, „Jüri“, „Laagri“, „Kuressaare“.

## Mis oli juba olemas

Abiotsingu poolel (`lib/help`) on kohanimede loend `locationAliases.js` (13 käsitsi kirjutatud nime: Tabasalu → Harku vald, Tallinna linnaosad, Ihaste → Tartu linn jt) ja Maa-ameti aadressiotsing (`geocoding.js`). Vestlus neid ei kasutanud.

Vestlus kasutab nüüd sama loendit ja see otsustab esimesena. Aadressiotsingut vestlus ei kasuta: kasutaja kirjutatud teksti ei saadeta vestluse pöörde ajal välisele teenusele, ja vastus peab olema sama iga kord.

## Otsus

**1. Asulate tabel.** Maa- ja Ruumiameti asustusüksuste fail (EHAK-i tunnused), `asustusyksus_shp.zip` geoportaali haldus- ja asustusjaotuse lehelt, eksport 02.09.2026, sha256 `29c01cc8…82c6ba`. Loetakse ainult tunnuste tabel (`asustusyksus.dbf`): üksuse nimi ja liik, omavalitsus. 4717 üksust (4460 küla, 185 alevikku, 13 alevit, 46 linna, 13 linnaosa), 4739 nime (teise ametliku nimega üksusel on kaks), kõik 78 omavalitsust klapivad rakenduse omadega. Tabel on koodi kõrval (`lib/rag-v2/adapters/settlement-data.js`, 50 KB), ehitab `scripts/rag-v2-settlements-build.mjs`. Uuendamine: laadi fail uuesti, käivita skript, vaata erinevus üle.

**2. Asula nime loetakse ainult seal, kus miski ütleb, et sõna on koht.** 4700 nime hulgas on inimeste nimed (Jüri, Anna, Peetri) ja tavalised sõnad (Ole, Loo, Vee), seega vaba teksti nende järgi ei otsita. Asula loetakse kolmel juhul:

- otsinguplaan nimetas selle kohana (tema tsitaat sõnumis, mida salvestatud seis ei ole veel lugenud);
- praegune sõnum on paljas vastus (kuni kolm sõna: asula ja mõni sõna nagu „jah“, „elan“) lahtisele küsimusele koha kohta; alla nelja tähega nimi ainult koos liigisõnaga („Loo alevik“);
- salvestatud seis juba ankurdab inimese omavalitsuse tsitaadis, kus see nimi on.

**3. Lubatud asula on selle pöörde jaoks oma omavalitsuse üks nimi.** Kogu edasine lugemine on sama, mis omavalitsuse enda nimega: kelle koht, eitus („ma ei ela enam Tabasalus“), küsimus koha kohta (ADR-074), plaani päringud, salvestatud seisu ankur. Uut lugemisteed ei tekkinud.

**4. Mitme valla nimi.** Sama nimega üksustest võidab kõrgem liik: linn, siis linnaosa, alev, alevik, küla („Kuressaare“ on Saaremaa valla linn, mitte Viljandi valla küla; „Aruküla“ on Raasiku valla alevik). Kui kõrgeima liigiga üksusi on mitu, jääb nimi nende vahel lahtiseks ja vastus küsib, kumba mõeldakse („Vanamõisa“ on 12 vallas). Kasutaja öeldud liik otsustab enne („Nõmme külas“ ei ole Tallinna linnaosa). Käsitsi loend otsustab enne ametlikku tabelit („Peetri“ on Rae vald, „Nõmme“ Tallinn).

**5. Omavalitsuse enda nimi jääb peale.** Tekst, mis nimetab omavalitsuse selle enda nimega, asulat ei loe: „Kose“ on Kose vald, „Elan Tabasalus, Harku vallas“ loetakse Harku valla nime järgi.

**6. Paljas kohavastus on otsingu koht** (`reply_region`). „Tabasalu“ või „Harku vald“ vastusena ei ütle, et keegi seal elab, seega kellegi elukohaks seda ei salvestata (ADR-074). Seni sõltus pöörde omavalitsus sellest, kas plaani päring nime kordas. Nüüd otsitakse kuni neljasõnalise sõnumi puhul, mille kõik kohad on sellised mainimised, selles kohas. See kehtib ka omavalitsuse nime kohta.

**7. Lühike vastus jätkab eelmise koha juures.** „jah“ ja „jah, pihlakodu“ (kuni kolm sõna, küsisõna ja küsimärgita) jätkavad seal, kus eelmine vastus otsiti, nagu seni tegi tagasi viitav sõnum („ja mis see maksab?“). Lühike küsimus („Ja kuidas taotleda?“) jääb omaette päringuks, nagu ADR-081 selle jättis.

**8. Luna ütleb seose välja** (dialoogi juhis 33). Pöörde ulatusega läheb kaasa `named_place` (asula nimi ja liik, omavalitsus või omavalitsused). Juhis: ühe omavalitsuse puhul öelda vastuse alguses üks kord, kuhu asula kuulub, ja mitte küsida omavalitsust uuesti; mitme puhul nimetada need ja küsida, kumba mõeldakse. Seos öeldakse ainult selles pöördes, kus asula nimetati.

**9. Plaani juhis** (search-assist-9): üks rida kohareegli järel, et küla, alevik ja linnaosa on koht nagu omavalitsus, ka siis, kui sõnum ongi ainult see nimi.

Vastaja mudelile asulate loendit ei näidata; seisu kontekst mudeli jaoks on endiselt ainult kuupäev.

## Mida see ei tee

- Vaba teksti asulanimede järgi ei loeta: „Elan Tabasalus“ loetakse siis, kui plaan selle kohana nimetab. Kui plaan jätab koha nimetamata ja sõnum ei ole paljas vastus, jääb asula lugemata.
- Kirjavigu ei paranda („Tabassalu“).
- Kirillitsas kirjutatud asula loetakse plaani antud nime järgi olemasoleva translitereerimise kaudu; seda ei ole proovitud.
- Lahtise küsimuse äratundmine koha kohta käib sõnade järgi (elukoht, omavalitsus, vald, linn, kus; inglise ja vene vasted). Küsimus, mis kohta küsib teiste sõnadega, paljast vastust ei ava.
- Elukohaks salvestub asula ainult siis, kui plaan ütleb „elab“. Vastus „jah“ küsimusele „kas Tabasalu on elukoht?“ elukohta ei salvesta: plaan ei näe Luna küsimust. Otsing jääb siiski Harku valda (punktid 6 ja 7).
- Olemasolev viga jäi: liitsõna osa loetakse omavalitsuse nimeks („Elan Raekülas“ annab Rae valla). See ei tule sellest muudatusest.

## Kontroll

- `tests/rag-v2-settlements.test.mjs` (8 testi): 07.10 vestlus selle pöörete kirjetes olnud plaanidega (teine pööre Harku vald, kolmas ja neljas jätkavad seal; ilma asulateta ei saa ükski pööre omavalitsust, nagu kirjed näitavad); plaani nimetatud asula käändes, eitus, küsimus teise asula kohta; omavalitsuse nimi jääb peale; mitme valla nimi; inimese nimi ja tavaline sõna ei ole koht; seisu ankur loeb sama nimega; adapteri meetodid lahti võetuna.
- `node scripts/run-unit-tests.mjs`: 803 testi, 781 läbib, 22 vahele jäetud, 0 viga.
- **Serveris päris sõnavormide lugejaga ja päris omavalitsuste loendiga, mudelit ja otsingut kutsumata** (ajutine kaust, töötava väljalaske kõrval): vestluse neli pööret annavad `search_plan_region` / `continued_region` Harku vallaga; „Elan Tabasalus“, „Ema elab Haabneemes“, „Elan Kuressaares“, „Laagris“, „Mustamäel“, „Õismäel“, „Kose-Uuemõisas“, „Vääna-Jõesuus“, „Lool“, „Jüris“, „Peetris“, „Arukülas“, „Kärdlas“ annavad õige omavalitsuse; „Isa elab Vanamõisas“ jääb 12 valla vahele; „Mu isa Jüri vajab hooldekodu kohta“, „ole“ ja „jah“ ei anna kohta. See kontroll leidis vea, mida testid ei näinud (adapteri meetod luges teist meetodit `this` kaudu, aga meetodid antakse edasi ükshaaval); parandatud ja testitud.
- **Kontrollimata:** kuidas vastused päriselt muutuvad (tasuline kontroll päris lehel pärast juurutust); kas plaan nimetab asula kohana pikemas sõnumis; vene- ja ingliskeelsed sõnumid.
