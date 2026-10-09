# ADR-116: ametlike juhislehtede igakuine värskendus

Kuupäev: 09.10.2026. Teostus Claude Opus 5.5. Omanik: „Hoia ametlikud juhislehed igakuiselt värsked“. Seis: **käsk ja testid on tehtud, proovilugemine päris lehtedel tehtud; ajakava on seatud 09.10.2026 õhtul omaniku sõnal (kuu 1. ja 3. kuupäev); midagi ei ole ostetud.** Esimene päris ring on 1. novembril 2026.

## Probleem

08.–09.10.2026 lisati RAG-i kolme partiiga 330 ametlikku juhislehte ([ADR-111](adr-111-state-level-help-first-batch.md), [ADR-112](adr-112-state-level-help-second-batch.md), [ADR-115](adr-115-state-level-help-third-batch.md)). Ükski neist ei ole korduvas lugemises: olemasolev igakuine värskendus ([ADR-098](adr-098-monthly-assistive-refresh.md)) katab abivahendite teavet.

Alates vestluse juhistest 40 ([ADR-114](adr-114-present-figure-for-a-future-event-and-three-laws.md)) ütleb vastus lehe summa selle päeva seisuga, mil leht ise ütleb end viimati muudetud olevat. Kui amet muudab lehel summat ja meie koopia jääb vanaks, annab vastus vana summa vana kuupäevaga.

## Otsus

**Eraldi käsk**, `scripts/rag-v2-official-refresh.mjs`, mitte abivahendite värskenduse uus samm. Põhjus: abivahendite värskenduse seis ja lehed on koodihoidlast väljas (müüjate tekstid, telefonid) ja selle täiendus tehakse eksporditud registrist; ametlikud lehed on koodihoidlas ja registris, nii et muutunud leht tähendab registri räsi muutust ja tavalist täiendust. Lugemise osa on ühine: sama korjaja.

Käsk loeb kolme loendi lehed korjajaga uuesti, iga loendi oma töökausta, ja võrdleb salvestatud koopiatega. Kehtib kogutud andmete reegel:

- muutunud leht on esimesel lugemisel **ettepanek**, salvestatud koopia jääb;
- teisel samasugusel lugemisel **asendab** uus tekst salvestatud koopia, vana tõstetakse kõrvale;
- leht, mille korjaja märgib ülevaatuseks (isiku kontakt eemaldatud, õhuke sisu), **ei asendu iseenesest**: inimene vaatab üle ja lubab nimeliselt (`--approve`);
- leht, mida ei saa lugeda või mida saidi robots.txt enam ei luba, **jääb nii, nagu on**; midagi ei kustutata.

Reegel ise on nüüd üks funktsioon (`pageActions`, `lib/rag-v2/web-page.js`), mida kasutab korjaja ja mida test kontrollib; enne oli see korjaja skripti sees.

Pärast ringi, mis lehti asendas: register (`REGISTER.json`, `REGISTER.md`) nimetab uued baidid ja `<seis>/increment/selection.json` loetleb lehed, mis ootavad korpuse täiendust. Täiendus ise (sisestus, vektorite ost, indeks) on eraldi samm oma kulupiiriga; see käsk ei osta midagi ega kutsu ühtegi mudelit. `--mark-ingested` ütleb, et ootel lehed läksid korpusesse.

Aruanne (`<seis>/reports/`) ütleb väljaandjate kaupa, mitu lehte on muutmata, ettepanekus, asendatud, kinni peetud, uus või kättesaamatu, ja nimetab lehed, mida inimene peaks vaatama, tunnuse ja aadressiga. Lehe teksti ei trükita.

### Saidi enda paus

Korjaja peab nüüd kinni pausist, mida sait oma robots.txt-s palub (`Crawl-delay`), kui see on pikem kui jooksu oma; üle minuti paluv sait saab minuti. Politsei sait palub kümmet sekundit: seni tuli politsei lehed lugeda eraldi jooksuga.

## Proovilugemine päris lehtedel (09.10.2026)

Käsk luges `--dry-run`-iga kõik 330 lehte (umbes 20 minutit; politsei 42 lehte kümnesekundilise pausiga):

| Väljaandja | Lehti | Muutmata |
|---|---:|---:|
| Sotsiaalkindlustusamet | 154 | 154 |
| Tervisekassa | 42 | 42 |
| Politsei- ja Piirivalveamet | 42 | 42 |
| Justiits- ja Digiministeerium | 30 | 30 |
| Notarite Koda | 16 | 16 |
| Kohtutäiturite ja Pankrotihaldurite Koda | 16 | 16 |
| Eesti kohtud | 15 | 15 |
| Sotsiaalministeerium | 7 | 7 |
| Haridus- ja Teadusministeerium | 4 | 4 |
| Haridus- ja Noorteamet (sh Rajaleidja) | 4 | 4 |
| **Kokku** | **330** | **330** |

Ettepanekuid 0, kättesaamatuid 0. Esimese partii lehed olid salvestatud päev varem, kolmanda omad tund varem. Ühtegi lehte, mis loeks end muutunuks ilma sisulise muutuseta, see lugemine ei näidanud; korjajat ei olnud vaja parandada.

## Ajakava (seatud 09.10.2026)

Küsisin omanikult, kas sean värskenduse ajakavasse. Vastus: „Jah, 1. ja 3. kuupäeval“, pakutud tingimustega: lugemine lisatakse olemasolevasse ajastatud töösse abivahendite värskenduse järele, kuu lagi 0,10 USD jääb mõlemale ühiseks ja ost toimub ainult siis, kui mõni leht on muutunud.

Seatud nii:

- **Millal:** samadel päevadel mis abivahendite värskendus, kuu 1. ja 3. kuupäeval, selle järel. Kaks lugemist on vajalikud, sest muudatus rakendub teisel samal lugemisel; 3. kuupäeva ringi järel on asendatud lehed täienduse ootel.
- **Kulu:** lugemine on tasuta. Täiendus ostab ainult muutunud lõigud; leht annab keskmiselt 6–10 lõiku ja lõik maksab umbes 0,00004 USD, nii et kuu muudatused on eelduslikult alla 0,02 USD. Abivahendite värskenduse kuu lagi 0,10 USD on mõlemale ühine.
- **Kes vaatab kinni peetud lehti:** ajastatud töö näitab need aruandes; omanik otsustab või annab ülevaatuse mulle. Seni jääb vana koopia. Töö ise ühtegi sellist lehte ei luba.
- **Kus töötab:** nagu abivahendite värskendus, omaniku arvutis Claude'i rakenduses; seis põhikausta `tmp/rag-v2-official-refresh` all.

### Mis ajastatud töös muutus

Sama töö (kell 9.00 kuu 1. ja 3. kuupäeval; nimi nüüd „Abivahendite info ja ametlike juhislehtede uuendamine“) teeb kaks osa järjest, mitte korraga, sest mõlemad loevad Sotsiaalkindlustusameti saiti ja paus päringute vahel kehtib jooksu kaupa:

1. abivahendite värskendus nagu seni ([ADR-098](adr-098-monthly-assistive-refresh.md));
2. ametlike lehtede lugemine selle käsuga (umbes 25 minutit).

Kui kumbki midagi ei asendanud ega oota, lõpeb töö aruandega ja raha ei kulu. Kui ametlik leht asendati, lähevad asendatud leht ja registri räsid samal käivitusel PR-iga koodihoidlasse, ka siis, kui täiendust ei osteta (seis loeb lehe juba asendatuks). Täiendus tehakse ainult siis, kui see mahub kuu lakke; kui ootavad mõlemad osad, tehakse kaks täiendust järjest (abivahendid versioon N, ametlikud lehed N+1). Kuu kulu peab töö ühes failis mõlema osa kohta (`tmp/rag-v2-assistive-refresh/reports/spending-<aasta-kuu>.json`).

Töö ei tee: kinni peetud lehe lubamist, kättesaamatu lehe lugemist teist teed pidi, loendis oleva, kuid salvestamata lehe lisamist.

## Kontrollitud

- Ühiktestid (värske põhiharu peal): 1190, neist 1168 läbi ja 22 vahele jäetud. Viis uut testi (`tests/rag-v2-official-refresh.test.mjs`): ettepanek esimesel ja asendus teisel samal lugemisel, kolmas erinev lugemine on uus ettepanek; ülevaatuseks märgitud leht ei asendu ilma nimelise loata ja selle ettepanek jääb alles; ainult vaatav ring ei paiguta midagi; ühtegi kustutavat tegevust ei ole; ring väljaandjate kaupa, kättesaamatu leht nimetatud ja alles; register saab asendatud lehe uue räsi ja pealkirja, puuduv registrikirje on viga; ootel loendis on leht ühe korra; saidi palutud paus (oma rühm, muidu kõigi oma, kuni minut).
- Käsk otsast lõpuni kahe lehe koopial ajutises kaustas (päris lehed, päris registri koopia; ühe koopia sisuräsi ja pealkiri muudetud vanaks): esimene ring ettepanek, teine ring asendus (registri räsid vastavad failidele, pealkiri ja REGISTER.md rida parandatud, vana koopia kõrvale tõstetud, leht ootel), kolmas ring muutmata, `--mark-ingested` tõstis ootel loendi kõrvale.
- Proovilugemine 330 päris lehel (tabel eespool). ESLint muudetud failidel.

## Kontrollimata

- Teine lugemine ja asendamine päris lehel: proovilugemine ainult vaatab. Esimene päris ring teeb ettepanekud, teine asendab.
- Ajastatud töö uue juhisega ei ole kordagi käivitunud (töö ise ei ole üldse veel käivitunud; esimene kord on 1. novembril 2026). Töö jookseb omaniku arvutis ainult siis, kui Claude'i rakendus on avatud; kinnise rakenduse korral käivitub ta järgmisel avamisel.
- Ametlike lehtede täiendust ajastatud töö kaudu ei ole tehtud; muutunud veebilehe viimine korpusesse uue versioonina on tehtud üks kord käsitsi (v64).
- Registri uuendamine ja ootel loend päris asendusega (testitud ainult funktsioonidena).
- Kas ametid muudavad lehti nii, et sisu räsi muutub ilma sisulise muutuseta (kuupäev jaluses, vahelduv plokk): üks lugemine päev pärast salvestamist seda ei näita.

## Mis jääb lahti

- Muutmata lehe kontrolli kuupäev ei uuene: allika kaardil jääb `source_checked_at` esimese lugemise päevaks. Lehel, millel oma muutmise kuupäeva ei ole, ütleb vastus summa selle vana päeva seisuga, kuigi leht on hiljem üle loetud.
- Varasemad 31 ametlikku lehte (`web_pages.json`, alalehtedega) ei ole selles käsus; neist kaks on abivahendite värskenduses.
- Loenditest käsitsi välja jäetud lehed (töötajate nimekirjad, tühjad lehed) jäävad välja ka edaspidi; uut lehte käsk ise ei otsi.
