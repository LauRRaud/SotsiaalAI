# ADR-113: katkenud ostu makstud vektorid lähevad arvesse

Kuupäev: 08.10.2026. Teostus Claude Opus 5.5. Omanik: „Võta katkenud ostu makstud vektorid arvesse“. Seis: kood ja testid tehtud; serveris kontrollitud lugemisega, ilma ühegi tasulise kutseta. **Päris katkestusega proovimata**: teine käivitus pärast päris peatumist tuleb ette alles järgmise katkestuse korral.

## Probleem

Korpuse v72 ost peatus 08.10.2026 pärast 1063 sisendit 1826-st: ühe päringu vastus jäi tulemata ja arvestus lõpetas jooksu (`stopped_unknown`). Makstud oli 0,0392 USD ([ADR-112](adr-112-state-level-help-second-batch.md)). Sama juhtus 26.09.2026 (236 sisendit, 0,014 USD).

Kumbki kord ei saanud makstud vektoreid kasutada:

- Varasemate ostude lugeja võttis vektoreid ainult lõpuni jõudnud ostust (`complete_real_pilot_required`).
- Serveri jooks (`rag-v2-corpus-run.sh`) ei alustanud sama versiooni ostu teist korda ja luges kõiki kaustu `usage/` all, nii et poolik kaust seal oleks peatanud iga järgmise plaani. 26.09 poolik kaust oli skriptis nimepidi välja jäetud.

Tagajärg: kogu partii osteti uuesti ja inimene pidi serveris kaustu käsitsi ümber tõstma.

## Miks reegel oli range

Arvestus on tasuliste kutsete päevik: iga sisendi kohta reserveerimise rida enne saatmist ja õnnestumise või teadmata tulemuse rida pärast. Lõpetatud ostu kontroll on lihtne: igal manifesti sisendil on täpselt üks õnnestunud kirje. Poolikut ostu ei jätkata, sest teadmata tulemusega päringut ei tohi uuesti saata sama ostu sees: see võib olla juba arveldatud.

See osa jääb samaks. Muutub ainult see, kas pooliku ostu **õnnestunud** kirjeid tohib lugeda.

## Otsus

1. **Lugeja** (`StoredEmbedding.load`, valik `stopped`). Peatunud ost (`stopped_unknown`, või järsult katkenud ost, mille lõpurida jäi kirjutamata) loetakse sisse nende sisendite jaoks, mille õnnestumine on päevikus kirjas. Kontrollid on samad mis lõpetatud ostul: päevik mängitakse läbi, manifest on arvestuse enda oma, iga kirje on manifesti sisend sama räsi ja tokenite arvuga, ja vektorifaili räsi võrreldakse õnnestumise real kirja pandud räsiga siis, kui vektor loetakse. Kirjet ilma õnnestumiseta ei kasutata kunagi. Kausta ainult loetakse; kaust, mida elus protsess parajasti kirjutab, lükatakse tagasi (`pilot_busy`).
2. **Varasemate ostude loend** (`reusableEmbeddingCatalog`). Lõpetatud ostud tulevad enne. Sisend, mille on ostnud nii lõpetatud kui ka peatunud ost, võetakse lõpetatud ostust ja peatunud ostu vektorit ei loeta ega võrrelda: pärast katkestust uuesti ostetud partiis on iga peatunud ostu sisend teist korda ja teenusepakkuja kaks vastust samale tekstile ei pruugi viimase kohani võrduda. Kahe lõpetatud ostu erinev vektor samale sisendile on endiselt viga (`stored_embedding_collision`).
3. **Kes seda kasutab.** Ainult korpuse ost (`rag-v2-corpus-embeddings.mjs`, `--reuse`) ja indeksi ehitus (`rag-v2-index-batch.mjs`, `--vectors`). Teised kohad (piloot, mitme allika plaan, vastuvõtt) loevad endiselt ainult lõpetatud oste. Ostu kokkuvõttes on uus rida `reusable_inputs_from_stopped_purchases`.
4. **Serveri jooks** (`rag-v2-corpus-run.sh`). Kui sama versiooni ost on olemas ja selle kirje ütleb `stopped_unknown`, tõstab jooks selle ise kõrvale nimega `run-v<N>-stopped-<k>` koos plaani, kinnituse ja logidega ning läheb edasi: plaan loeb peatunud ostu vektorid olemasolevaks ja ostetakse ainult ülejäänud sisendid. Lõpetatud ostu või ostu, mille kirje lõppu ei ütle, ei alustata endiselt uuesti. Midagi ei kustutata. Kausta `pilot_7e23e68b` nimeline väljajätt on eemaldatud.

## Mis jääb kaitstuks

- Ostu tegija (`runPilot`) on muutmata: peatunud ostu ei jätkata ja teadmata tulemusega päringut selle ostu sees uuesti ei saadeta.
- Uus ost on oma manifestiga uus ost: oma kinnitus, hinnakontroll, kulupiir ja päevik.
- Iga loetud vektor kontrollitakse räsi vastu; rikutud fail peatab lugemise.
- Vaikimisi (ilma valikuta) on lugeja sama range kui enne.

## Mida katkestus nüüd maksab

Ainult teadmata tulemusega päring: see sisend ostetakse uuesti ja võib olla arveldatud kaks korda (v72 puhul oleks see olnud umbes 0,00004 USD 0,0392 asemel). Ülejäänud makstud vektorid lähevad arvesse.

## Mis vajab endiselt inimest

- Sama käsk tuleb uuesti käivitada (kaitstud jooks vabastab luku ise).
- Teise käivituse kulupiir kehtib ainult teisele ostule; kogusumma liidab käivitaja ise ja küsib omanikult, kui see läheb üle lubatu.
- Kui peatumise põhjus ei ole ühekordne (näiteks konto piir), peatub ka järgmine käivitus; iga peatunud ost saab järgmise numbri.

## Kontrollitud

- Ühiktestid, kolm uut ostuarvestuse kohta: peatunud ostu ostetud sisend on taaskasutatav ja teadmata tulemusega sisend ei ole (ei kviitungit ega vektorit); valikuta lükatakse poolik kaust tagasi nagu enne; päevikut ei muudeta ja sama plaani uus käivitus ei saada midagi; rikutud vektorifail peatab lugemise; lõpetatud ost võidab peatunud ostu ilma võrdlemata; kaks erinevat lõpetatud ostu on endiselt viga; järsult katkenud ost loetakse; elus protsessi lukk ja loetamatu lukk lükatakse tagasi, surnud protsessi lukk mitte.
- Jooksuskripti test: lõpetatud ost, lõputa kirje ja puuduv kirje lükatakse tagasi ja midagi ei tõsteta; peatunud ost tõstetakse kõrvale koos plaani, kinnituse ja logidega ja sama käivitus teeb uue plaani; teine peatumine saab numbri 2.
- Kõik ühiktestid: 839, neist 817 läbi ja 22 vahele jäetud. ESLint muudetud failidel.
- Kohaliku andmebaasiga indeksitest (`tests/rag-v2-index-jobs.integration.test.mjs`): 11 testist 9 läbi. Kaks käsureatesti peatusid veaga `morphology_unavailable`, sest selles arvutis ei ole morfoloogia käituskeskkonda seadistatud; mõlemas oli muudetud rida (vektorite lugemine) selleks ajaks läbitud.
- Serveris, ainult lugemine muudetud koodiga (`w4/adr113-load.mjs`):

| Mis | Tulemus |
|---|---|
| v72 poolik kaust (`usage-incomplete/pilot_5684…`) | valikuta tagasi lükatud; valikuga 1064 kirjet, neist 1063 ostetud 1826-st, 1 teadmata |
| 26.09 poolik kaust (`usage/pilot_7e23e68b…`) | valikuta tagasi lükatud; valikuga 237 kirjet, neist 236 ostetud 29 354-st, 1 teadmata |
| Loend nagu täna (42 kausta), range | 72 642 kviitungit, 5,5 s |
| Samad 42 kausta valikuga | 72 642 kviitungit: lõpetatud ostude jaoks ei muutu midagi |
| Kõik 43 kausta ja kõrvale tõstetud kaust | 72 642 kviitungit, 2 peatunud ostu, neist 0 sisendit (mõlema partii osteti hiljem tervikuna uuesti), 5,9 s |

## Kontrollimata

- Päris teine käivitus pärast päris peatumist (ost, mis ostab ainult puuduva osa).
- Indeksi ehitus serveris, kui `--vectors` hulgas on peatunud ost: serveris jooksis ainult lugeja.

## Serveris olevad v72 jäägid

Kaust `usage-incomplete/pilot_5684…` ja `-first` nimega failid jäid puutumata. Kausta võib tõsta tagasi `usage/` alla; mõju sellel ei ole, sest samad sisendid on lõpetatud ostus.
