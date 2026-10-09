# ADR-117: lehe kontrolli kuupäev liigub igakuise lugemisega edasi

Kuupäev: 09.10.2026. Teostus Claude Opus 5.5. Omanik: „nii, tegutseme edasi“ (kaks lahtist punkti [ADR-116](adr-116-official-pages-monthly-refresh.md) lõpust). Seis: **kood, testid ja esimene päris ring 29 lehel on tehtud; midagi ei ostetud.**

## Probleem

Alates vestluse juhistest 40 ([ADR-114](adr-114-present-figure-for-a-future-event-and-three-laws.md)) ütleb vastus veebilehe summa kuupäevaga: lehe enda muutmise päev või, kui lehel seda ei ole, päev, mil leht loeti („9. oktoobri seisuga …“).

- Korpuse 361 ametlikust lehest **182 ei ütle ise, millal neid muudeti** (kolme partii 330 lehest 157, varasemast 31 lehest 25). Müüjate ja organisatsioonide lehed (572) enamasti samuti.
- Igakuine lugemine ([ADR-098](adr-098-monthly-assistive-refresh.md), ADR-116) ei salvesta ega indekseeri muutmata lehte uuesti. Dokumendi kontrolli kuupäev jäi seega esimese lugemise päevaks: vastus oleks märtsis öelnud „9. oktoobri seisuga“, kuigi lehte oli iga kuu kontrollitud ja see oli sama.
- Varasemad 31 ametlikku lehte ([ADR-095](adr-095-web-pages-as-sources.md)) ei olnud ametlike lehtede värskenduses üldse. Need koguti 18 lehe loendist koos alalehtedega, nii et 19 salvestatud koopiat ei ole üheski loendis.

## Otsus

### 1. Kinnitatud lugemiste tabel

`lib/rag-v2/search/web-page-checks.json`: salvestatud lehe **baitide räsi** ja **viimane päev, mil lugemine leidis lehe sisu samana**. Tabelis on ainult räsid ja kuupäevad: ei aadresse, ei pealkirju, ei nimesid.

Tabelit kirjutavad mõlemad värskendused pärast päris ringi (proovilugemine ei kirjuta):

- ametlike lehtede käsk (`rag-v2-official-refresh.mjs`): iga leht, mis luges muutmata, ja iga leht, mis sel ringil asendati (uue koopia räsi);
- abivahendite värskendus (`rag-v2-assistive-refresh.mjs`): müüjate lehed, ameti kaks abivahendite lehte ja organisatsioonide lehed samal alusel.

Päev liigub ainult edasi ja tabelist ei võeta midagi välja (`checksAfterRefresh`, `lib/rag-v2/official-refresh.js`). Ettepanekus, kinni peetud või kättesaamatu leht jääb päevaga, mis tal oli.

### 2. Allika kaart loeb tabelit

`confirmedReading` (`lib/rag-v2/search/model-context.js`): kui tabel nimetab täpselt need baidid, millest dokumendi versioon on tehtud, ja tabeli päev on hilisem kui dokumendi oma, saab kaart `source_checked_at` väärtuseks tabeli päeva. Sama väärtust näitab vestluse allikate paneel.

Võti on baitide räsi, mitte aadress või tunnus. Sellest järeldub:

- muutunud lehe uus koopia on teine räsi, nii et vana dokument ei saa päeva, mis ei ole tema oma;
- midagi ei pea uuesti indekseerima ega ostma: reegel kehtib ka juba korpuses olevatele dokumentidele;
- allika liik ei otsusta (üks kogutud leht on registris uuringuaruanne): tabelis on ainult baidid, mille lugemine on kinnitanud.

Lehel, mis ütleb ise oma muutmise päeva, jääb vastuses kehtima see päev (ADR-114); kontrolli päev liigub kaardil ja allikate paneelis sellegipoolest.

### 3. Varasemad ametlikud lehed on värskenduses

Ametlike lehtede käsk loeb nüüd lisaks kolmele loendile ka **salvestatud lehed, mida ükski loend ei nimeta** (`@rest`, `restEntries`): iga leht oma aadressilt, alalehti ei otsita. Praegu on neid 29: varasemad 31 miinus kaks abivahendite lehte, mida loeb abivahendite värskendus (`--rest-except`). Koopia, mis ei asu oma väljaandja kaustas, on viga, mitte äraarvamine.

### 4. Tabel jõuab serverisse väljalaskega

Tabel on koodihoidla fail, mille rakendus kokku ehitab. Iga ring muudab seda, nii et **ajastatud töö teeb nüüd igal käivitusel PR-i** (enne ainult siis, kui mõni leht asendati või tehti täiendus). Väljalase uuendab vestluse plaani ise.

## Miks nii ja mitte teisiti

- **Salvestatud metaandmete ümberkirjutamine ja uuesti indekseerimine:** iga kuu üle 900 dokumendi uus versioon ja sama palju registri räsi muutusi kuupäeva pärast, mida saab öelda ühe väikese failiga.
- **Tabel serveri andmebaasis:** vajaks kirjutamist omaniku arvutist serveri andmebaasi ja eraldi skeemi. Fail liigub sama teed mis muu kood ja muudatus on PR-is näha.
- **Võtmeks lehe tunnus või aadress:** siis võiks vana koopia saada päeva, mil loeti juba teistsugust lehte, ja aadressi sisse võib sattuda inimese nimi. Räsi ei saa kumbagi.

## Kontrollitud

- Ühiktestid (värske põhiharu peal): 1221, neist 1199 läbi ja 22 vahele jäetud; ESLint muudetud failidel. Neli uut testi: kaart võtab hilisema päeva ainult oma baitide kohta (varasem või sama päev, teised baidid, vigane väärtus ja puuduv tabel ei muuda midagi; allikate paneel näitab sama päeva); tabeli reegel (päev ainult edasi, midagi ei kao, vigane räsi, päev või tabel on viga); loendita lehtede valik (loendis olev ja teise värskenduse leht jäävad välja, vale kaust on viga); koodihoidlas olev tabel on lugeja oodatud kujul.
- **Kohalik korpus:** kõik 361 salvestatud ametlikku lehte, 51 müüjate lehte ja 521 organisatsioonide lehte on bait-baidilt mõne korpuses oleva dokumendi lähtefail (räsi võrdlus hoidla aktiivsete versioonidega); kõigil 361 ametlikul lehel liikus kaardi päev proovitabeliga edasi ja jäi tabelita samaks.
- **Proovilugemine ja esimene päris ring 29 lehel** (loendita lehed): mõlemal korral 29 muutmata, 0 kättesaamatut. Päris ring kirjutas tabelisse 29 kirjet päevaga 09.10.2026 (lehtede oma päev oli 06.10.2026).
- **Tasuta kontroll serveris enne väljalaset** (muudetud kood töötava väljalaske peal, päris korpus): tabeli 29 räsi järgi leiti 29 dokumenti ja kõigil liikus kaardi päev 06.10 → 09.10; kolm tabelist väljas olevat lehte jäid oma päevaga.
- **Sõltumatu ülevaatus** kolmest vaatest (allika kaart ja selle lugejad; värskenduse käsud ja kogutud andmete reegel; ehitus ja väljalase), iga leid eraldi üle kontrollitud: päris viga ei leitud. Ühe tähelepaneku põhjal kontrollib käsk nüüd kõik loendid enne esimese lehe lugemist, et hiline viga ei jätaks juba asendatud lehte registrist välja.
- **Abivahendite värskenduse uued read** proovikaustal nelja lehe koopiaga ja oma tabelifailiga: kaks müüja lehte ja üks organisatsiooni leht muutmata ja tabelis, üks organisatsiooni leht ettepanekus ja tabelist väljas.

## Kontrollimata

- Vastus päris vestluses: kas Luna ütleb lehe summa uue päevaga. See vajab tasulist küsimust ja luba; kaardi väärtus on serveris kontrollitav tasuta (vaata üleandmise märkust).
- Kolme partii 330 lehte ei ole selle koodiga päris ringis loetud (loeti proovilugemisega samal päeval kell 18; uut lugemist samal õhtul ei tehtud). Nende kirjed tekivad esimesel ajastatud käivitusel.
- Abivahendite värskenduse täisring uue koodiga (umbes 570 lehte).
- Kas rakenduse ehitus serveris võtab JSON-faili sisse samamoodi nagu kohalik Node: sama võte on kasutusel failis `lib/rag-v2/admin/intake.js`.

## Mis jääb lahti

- Müügipunktide ja hooldekodude hinnalehed tehakse ameti tabelist, mitte ei loeta lehelt; neid tabelis ei ole ja nende päev jääb selleks, mil leht viimati uuesti tehti.
- Tabelist ei võeta vanu räsisid välja. Kasv on mõni rida kuus.
- Ameti kaks abivahendite lehte loeb endiselt abivahendite värskendus; nende asendamisel tuleb registri räsi käsitsi uuendada (ADR-098).
