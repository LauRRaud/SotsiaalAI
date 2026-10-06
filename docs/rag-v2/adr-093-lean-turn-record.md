# ADR-093 — Kõhn pöördekirje: täisaudit ainult piiratud ajaks

06.10.2026. Teostus Claude Opus 5.5. Omanik 06.10: „vestlus ei ole muud kui tekst ja see ei tohiks mahtu võtta“, „produktsioonis ei ole vaja nii mahukat auditi teemat“, „me just päev või kaks tagasi kustutasime vestlused ära, nüüd on neid juba 43MB“. Valik küsimusele, kui kaua täisauditit hoida: **„Arenduses 7 päeva“** (tootmisplaan teeb rea kõhnaks kohe, arendusplaan hoiab täisauditit 7 päeva).

## Probleem

Vestluse üks pööre võttis andmebaasis keskmiselt 402 KB tekstina (183 KB kettal pärast andmebaasi enda tihendamist). Mõõdetud 06.10 serveris 82 lõpetatud pöördel:

| Osa | Keskmine | Mis see on |
|---|---|---|
| Küsimus ja vastus | 1,3 KB | vestlus ise |
| Tõenduspakett | 242 KB | kõik lõigud ja kirjed, mida mudelile näidati, viidetega |
| Saadetud päringu koopia | 72 KB | sama kontekst teist korda, nii nagu see teele läks |
| Päringu vektor | 64 KB | 3072 arvu |
| Otsingu tööandmed ja muu | 15 KB | |

Vastus viitab keskmiselt 3,9 allikale, pakett hoidis 34,8. Kõik ülejäänu on audit: mida mudel veel nägi ja kuidas otsing sinna jõudis. Seda kasutab arendus (halva vastuse põhjuse uurimine, mõõtmised), mitte vestlus.

Lisaks tõestas süsteem iga vana pöörde lugemisel uuesti, et vastus järeldub talle näidatud tõendusest (viidete kontroll kõigile paketi viidetele, vestluse oleku uus projektsioon salvestatud mustandist). Selleks pidi kogu tõendus alles olema.

50 kasutajat, igaüks 30 pööret päevas, oleks sellise kirjega umbes 8 GB kuus; serveris on vaba 8,5 GB.

## Otsus

1. **Lõpetatud pööre võib täisauditi lahti lasta ja jääda kõhnaks.** Kõhn kirje (`lib/rag-v2/pilot/lean-turn.js`) hoiab:
   - küsimuse, vastuse, vestluse konteksti ja oleku, kulu ja ajad;
   - **viidatud tõenduse tervikuna** oma viidete all (tunnused, lõigud, asukohad, tekst, allika kaart);
   - viidatud kirjed ja vormid, mida need deklareerivad;
   - räsid: lahti lastud paketi ja päringu räsi ning vastuse ja oleku räsi sellisena, nagu need avaldamisel tõestati.
2. **Lahti lastakse:** viitamata tõendus, mudeli kontekst, otsingu audit, päringu sisu, päringu vektor, dialoogi sisend ja oleku kontekst. Viidatud kirjetest lähevad otsinguabi, järjestuse numbrid, töötlusmärkused ja akti kuupäevad.
3. **Mis kontrollitakse kõhna pöörde igal lugemisel edasi:**
   - iga viidatud viide vastab oma tõendikirjele (tunnused ja teksti räsi) ning korpuse kanoonilisele allikale, ja kasutajal on sellele ligipääs;
   - vastus ja olek on samad, mis avaldamisel tõestati (räsid).
4. **Mida enam ei korrata:** vastuse ja oleku uut projektsiooni tõendusest. Kõhn pööre on tõestatud üks kord, avaldamisel. Otsingu kataloogi kontroll jääb kõhna paketi puhul vahele, sest otsingu audit läks koos ülejäänuga.
5. **Plaan ütleb, kui kaua täisaudit kestab.** Uus kinnitatav väli `auditDays`:
   - `0`: pööre salvestatakse kõhnana kohe avaldamisel (tootmine); varasema plaani ajast jäänud terved pöörded teeb kõhnaks ühekordne `scripts/rag-v2-lean-turns.mjs`;
   - päevade arv: pööre salvestatakse tervena ja tehakse kõhnaks, kui see on vanem (arendus; säilituse koristus teeb seda partiide kaupa, vt „Koristuse suutlikkus“);
   - väli puudub: täisaudit jääb alles nagu seni.
   Väli on osa sellest, mida omanik kinnitab; väljalaske uuendus ja korpuse täiendus hoiavad selle alles.
6. **Kõhnaks tegemine on ühesuunaline.** Lahti lastut ei saa reast taastada; räsid lubavad mujal hoitud koopiat sama pöördega siduda.

## Mida see vestluses muudab

- Vana pöörde allikate loend näitab ainult viidatud allikaid. Leht näitas ka seni ainult neid (`used`).
- Viidatud allikas avaneb endiselt ja kontrollitakse korpuse vastu.
- Vestluse jätkamine vanast pöördest (varasem vastus, kirjete fookus, küsitud piirkond, olek) toimib samamoodi.
- Sama küsimuse kordamisel tehakse uus embedding-kutse, sest vektorit enam ei hoita.

## Mida see arenduses muudab

- Pöörde põhjust (mida mudel veel nägi, mis päring saadeti) saab kirjest vaadata ainult täisauditi aja sees: praeguse plaaniga 7 päeva.
- Hindaja ja mõõtmisskriptid loevad täisauditit; need töötavad pöördel, mis ei ole veel kõhn.

## Mõõdetud (ainult lugedes, 06.10.2026, serveris)

Kõhn kuju arvutati mälus iga salvestatud lõpetatud pöörde kohta; midagi ei kirjutatud.

| Mis | Tulemus |
|---|---|
| 82 pööret kokku | 32,11 MB → 2,51 MB (92% vähem) |
| Kõhn rida | keskmiselt 30,6 KB, mediaan 29,4 KB, vahemik 14,3–51,3 KB (tekstina) |
| Viidatud allikate viited, allikate loend, vormid, järgmise pöörde sisend, küsitud piirkond, vastuse kehtivus | kõigil 82 pöördel samad mis täiskirjest |
| Viidete kontroll päris korpuse vastu (51 praeguse indeksi pööret, 194 viidatud viidet) | kõhn 51/51, täiskirje 51/51 |
| Kontrolli aeg pöörde kohta | kõhn 59 ms, täiskirje 213 ms |

Kõhna rea suurim osa on viidatud tõendus (keskmiselt 17,6 KB): lõikude tunnused ja asukohad, mida viite kontroll vajab, ja lõigu tekst. Kettal on rida andmebaasi tihendamise tõttu väiksem: 17,4 KB (mõõdetud ajutises tabelis, vt „Mõõdetud kettamaht“).

## Kontroll

- **Ühiktestid** (`tests/rag-v2-lean-turn.test.mjs`): mis jääb ja mis läheb; vestluse loetav on kõhnast kirjest sama; kõhna paketi viited kontrollitakse kirjekaupa ja korpuse vastu (muudetud tekst, muudetud viide, puuduv kirje, muutunud allikas ja äravõetud ligipääs keelduvad); muudetud vastuse või olekuga kõhn rida keeldub (`lean_turn_changed`); pood avaldab `auditDays: 0` korral kõhnana ja muul juhul tervena; vanade ridade kõhnaks tegemine; plaani väli.
- **Andmebaasitestid** (kohalik testandmebaas): Tallinna-suuruse paketiga terve pööre salvestub kõhnana (alla 20 KB) ja taastub oma viidatud allikaga; hiljem muudetud vastusega rida keeldub; auditiajaga plaani pööre salvestub tervena, tehakse vanemana kõhnaks ja taastub; neljapöördeline dialoog ja olekuga dialoog jätkuvad kõhnadest pööretest.
- `tests/rag-v2-corpus-run.test.mjs`: korpuse täiendus kannab `auditDays` uude plaani, ka nulli.

## Kasutuselevõtt

**Tehtud 06.10.2026:** arendusplaan `m4-corpus-chat-20261006c.json`, tehtud ja aktiveeritud väljalaskes `78b3d3ab` (#406). Ühtegi mudelikutset ei tehtud.

- **Erinevus asendatud plaanist:** ainult `auditDays: 7`. Tase (`low`, valikuna `medium`), korpus, kasutaja, hinnad ja 4 USD piir on samad; kuluarvestus jätkub (plaani `20261006a` arvestus).
- **Koristuse päring töötab päris andmebaasis** (sama tingimus, ainult lugedes): praegu on kõhnaks tegemise järjekorras 0 rida ja kõhnu ridu 0. Vanim pööre on 05.10 kell 13.01 UTC, seega esimene rida tehakse kõhnaks 12.10.
- `ready` läbib, teenus töötab, logis vigu ei ole.

Tootmisplaan saab `--audit-days 0`.

```bash
node scripts/rag-v2-chat-plan.mjs ... --audit-days 7 --continue-ledger <asendatav plaan> --basis "<omaniku korraldus>" --activate
```

## Mida see ei lahenda

- **Tabeli fail ei kahane.** 06.10 oli tabel kettal 43 MB, elusaid andmeid 15 MB; ülejäänu on koht, mille jätab pöörde rea korduv ülekirjutamine pöörde käigus. See koht läheb taaskasutusse, aga rida kirjutatakse endiselt mitu korda. Ühekordne kirjutamine on eraldi töö.
- **Täisauditi aja sees on rida endiselt suur** (umbes 0,3 MB pärast paketi kokkupakkimist, ADR-089).

## Tuhandete kasutajate jaoks sellest ei piisa

Omanik samal päeval: „mul on plaanis platvormile tuua tuhandeid kasutajaid, mul ei tohi paisuda kõvaketta kasutus meeletuks. Peab arvestama, kuidas toimub vestlus, selle talletamine, ajalugu.“ Codexi ülevaade (#406–407, omaniku edastatud) lisas: kettakasv peab olema ette arvutatav ja piiratud; pöörde mahu vähendamine ei lahenda veel tähtajatut kogunemist.

### Mida kõhn kirje ei tee

- **Seitse päeva tähendab väiksemaks tegemist, mitte kustutamist.** Kõhn rida jääb alles. Plaani `expiresAt` ja `retentionHours` on `null`, seega ei aegu ükski pööre ja kogumaht kasvab, kuni kasutaja vestluse kustutab.
- **Platvormi üldine säilitusreegel neid vestlusi ei puuduta.** Muud vestlused kustutab koristus pärast 90 päeva tegevusetust (`DATA_RETENTION_DAYS`). Vestlus, mille pöördel on aegumiseta auditikirje, on sellest reeglist teadlikult välja jäetud (`lib/retention.js`). Praeguse arendusplaaniga on seega iga RAG v2 vestlus tähtajatu. See on ühe kasutaja arendusplaani erand ja **tootmiskasutajatele ei tohi see üle kanduda**: tootmisplaani pöörded peavad aeguma, et vestlus alluks avaldatud 90 päeva reeglile.
- **Kõhnaks tegemine ei käivita säilituskella uuesti.** Koristus kirjutab pöörde rea üle, aga ükski säilitusreegel ei loe selle rea muutmise aega: vestluse kustutamine lähtub vestluse viimasest aktiivsusest (`lastActivityAt`) ja pöörde rea kustutamine rea aegumisest (`expiresAt`); kumbagi koristus ei muuda.
- **Kõhn kirje ei ole anonüümne kirje.** Küsimus ja vastus võivad endiselt sisaldada isikuandmeid; väiksem kirje allub samale säilitusreeglile.
- **Plaani vahetusega nähtamatuks muutunud pööre võtab kettal endiselt ruumi** (vt „Kõrvalleid“).

### Mõõdetud kettamaht (06.10.2026, päris pöörded)

Iga kuju tehti mälus 82 salvestatud lõpetatud pöördest ja kirjutati serveri andmebaasis ajutisse tabelisse, mis kadus tehingu lõpus; andmebaasi enda tihendus kehtib seal nagu päris tabelis. Ühtegi päris rida ei muudetud.

| Kuju | Kettal pöörde kohta | Tekstina |
|---|---|---|
| Täiskirje, nagu enne 06.10 | 184,8 KB | 391,6 KB |
| Täiskirje kokkupakitud paketiga (ADR-089) | 136,1 KB | 294,8 KB |
| Kõhn kirje (see otsus) | 17,4 KB | 30,6 KB |
| Ainult vestlus: küsimus, vastus, iga viidatud allika lühiviide, kulu | 2,6 KB | 3,6 KB |

Varasem hinnang (kõhn umbes 14 KB, ainult vestlus umbes 1,5 KB) oli liiga optimistlik: tunnused ja räsid ei tihene.

### Arvutus

Koormusstsenaarium, mitte prognoos: 3000 **iga päev aktiivset** kasutajat ja 10 pööret päevas, 30 000 pööret päevas ehk 10,95 miljonit aastas. Registreeritud kasutaja ei ole päevane kasutaja.

| Kuju | Päevas lisandub | 12 kuu andmed |
|---|---|---|
| Täiskirje | 5,5 GB | ei mahu |
| Kõhn kirje | 0,52 GB | 190 GB |
| Ainult vestlus | 77 MB | 28 GB |

See on ainult pöörde sisu. Lisanduvad sõnumite ja vestluste read, indeksid, andmebaasi tehingulogi, varukoopiad ja rakenduse logid. Serveris oli 06.10 vaba 8,5 GB: sellest ei piisa selle koormuse juures ühegi kuju 12 kuu ajalooks.

### Mahukatse (kohalik testandmebaas, sünteetilised pöörded)

`scripts/rag-v2-turn-volume.mjs`, 300 pööret päris pöörde kuju ja suurusega (sünteetiline tekst tiheneb paremini kui päris, seega on siinsed read väiksemad kui ülal):

| Samm | Tulemus |
|---|---|
| 300 tervet pööret kirjutatud | tabel kasvas 29,6 MB |
| Koristus tegi need kõhnaks | 300/300, 16 rida sekundis; rida 110,6 → 11,6 KB; tabeli fail **ei kahanenud** (+2,9 MB) |
| Andmebaasi koristus (`VACUUM`) | fail sama |
| 300 tervet pööret uuesti | tabel kasvas 1,2 MB: **96% vabanenud ruumist läks taaskasutusse** |

Järeldus: kõhnaks tegemine ei anna operatsioonisüsteemile ruumi tagasi, aga hoiab faili kasvamast. Kettamaht stabiliseerub tasemel „auditiaja sees olevad terved read + kõik kõhnad read“.

### Koristuse suutlikkus

Codexi leid oli õige: esimene teostus tegi kõhnaks kuni 200 rida ühe koristusega ja koristus käib vaikimisi iga kuue tunni tagant, seega 800 rida päevas, sõltumata sellest, kui palju juurde tekib. Parandatud:

- koristus töötab partiide kaupa, kuni tööd jätkub või ajapiir (vaikimisi 60 s, `M4_PILOT_LEAN_SWEEP_MS`) täis saab, ja ütleb, kas midagi jäi järgmiseks korraks (`pilotTurnsLeftWhole`);
- järgmine koristus ei loe uuesti ridu, mis on teadaolevalt juba kõhnad;
- plaan, mis avaldab kõhnana (`auditDays: 0`), ei koristata üldse: muidu loeks iga koristus kõik read läbi. Varasema plaani ajast jäänud terved read teeb kõhnaks ühekordne `scripts/rag-v2-lean-turns.mjs`.

Mõõdetud 16 rida sekundis (sülearvuti) tähendab, et 60 sekundit neli korda päevas katab umbes 3800 pööret päevas. **30 000 pööret päevas ja mitmepäevane täisaudit vajaks umbes 31 minutit koristust päevas**: pikemat ajapiiri või tihedamat käivitust. Tootmise `auditDays: 0` seda järjekorda ei tekita.

### Järgmise arenduse nõuded

**Töös: [ADR-094](adr-094-durable-conversation-history.md)** (omaniku otsus 06.10 „Jah, kogu töö“; viis sammu, esimene tehtud).

Kõhn kirje on vaheaste. Codexi ülevaate järgi, millega ma nõustun:

1. **Vestlusajalugu on väike ja iseseisev:** küsimus, vastus, ajatemplid, lühikesed allikaviited. Ajalugu ja jätkuvestlus töötavad ka pärast auditi kustumist, plaani vahetust ja korpuse uuendamist. Praegu on vestluse sõnumite tabelis teadlikult kohatäited ja päris tekst on ainult auditikirjes.
2. **Täisaudit on päriselt ajutine:** arenduses 7 päeva, tootmises ilma püsiva täisauditita; ka katkenud ja ebaõnnestunud pöörded aeguvad. Rea aegumine (`retentionHours`, kuni 168 tundi) ja kustutamine on poes olemas; neid ei saa kasutada enne, kui ajalugu ei ela enam auditikirjes.
3. **Allikat ei kopeerita iga vastuse juurde:** vestlus hoiab allika tunnust, versiooni, kohta ja linki; vana allikaversioon elab korpuses ühe korra. Kui vana vastuse juurest avatakse allika praegune versioon, peab see olema öeldud: see ei ole tõend, et sama tekst kehtis vastuse koostamisel.
4. **Suuri andmeid ei kirjutata korduvalt üle:** lõplik sisu salvestatakse üks kord.
5. **Ajaloo säilitusaeg on avaldatud reegel: üldjuhul kuni 90 päeva.** Privaatsustingimuste punkt 7.3 (versioon 2026-08-13.1): vestlused, sõnumid ja jooksvad olekukirjed säilivad üldjuhul kuni 90 päeva viimasest aktiivsusest või kirje loomisest või uuendamisest. Kettaruumi parandus tehakse selle reegli piires. Varasem pakkumine 12 kuud (minu ja Codexi oma) oleks säilitusreegli sisuline muutus: see vajab eraldi põhjendust, tingimuste uuendamist ja kasutajate teavitamist. „Kuni kasutaja kustutab“ lubaks tähtajatut kasvu.
6. **Koristus ja kettakasv on mõõdetavad:** vestluste kogumaht, päevane juurdekasv, aegunud kirjete arv, vanim koristamata kirje, vaba ruum.

**Vastuvõtukriteerium on mahukatse, mitte pakkimisprotsent:** testandmebaasis esinduslik hulk sünteetilisi pöördeid; audit ja vana ajalugu aeguvad; ajalugu ja jätkuvestlus töötavad ilma auditita; uuendus ei peida varasemaid sõnumeid; koristusjärjekord ei kasva; tegelik kettakulu vastab kokkulepitud mahueelarvele. Tasulisi mudelikutseid see ei vaja. `scripts/rag-v2-turn-volume.mjs` on selle katse algus.

## Vastavus avaldatud tingimustele

Omaniku edastatud ülevaade (06.10) võrdles muudatusi kasutustingimustega (versioon 2026-07-20) ja privaatsustingimustega (versioon 2026-08-13.1). Privaatsustingimuste punkti 7.3 sõnastuse kontrollisin repost (`messages/et.json`).

- Paketi kokkupakkimine, tarbetute koopiate, vektori ja viitamata tõenduse eemaldamine, eraldi väike vestlusajalugu, ajaloo sõltumatus plaanist ja korduva ülekirjutamise vähendamine sobivad kehtivate tingimustega. Kasutustingimuste punkt 10 näeb ette vestluste salvestamise ajaloo ja jätkamise jaoks; sealt ei tulene kohustust hoida kogu mudelile saadetud paketti ega tõestada vana vastust igal avamisel uuesti.
- Tarbetu diagnostika eemaldamine seitsme päeva järel mahub „kuni 90 päeva“ raami sisse.
- Vestlusajaloo pikendamine 12 kuuni või tähtajatuks ei mahu: see on säilitusreegli muutus.

## Tagasipööramise piir

Kõhn rida tekib ainult siis, kui plaanil on `auditDays`. Kuni ühtegi kõhna rida ei ole, saab selle väljalaske tagasi pöörata nagu iga teise. Pärast esimest kõhna rida ei loe sellest vanem väljalase neid pöördeid (`invalid_model_reference`); alumine piir on see väljalase. Kokkupakitud pakettide alumine piir on #403 (`edde1119`), [ADR-089](adr-089-closest-contact-directory.md).

## Kõrvalleid: plaani vahetus peidab varasemad pöörded

Vestluse ajalugu ja dialoogi kontekst loevad ainult töötava plaani pöördeid (`configHash`). Plaan uueneb iga väljalaskega, mis vestluse koodi muudab, ja iga korpuse täiendusega. Pärast seda varasemaid pöördeid vestluses ei näidata ja dialoog algab otsast. Arenduses on see teadlik piir; tootmises tähendaks see, et kasutaja ajalugu kaob igal uuendusel. **Enne avamist vajab see eraldi otsust.** Selle muudatusega seda ei puudutatud. **Otsustatud 06.10, [ADR-094](adr-094-durable-conversation-history.md):** pärast selle esimest sammu on uued pöörded plaani vahetuse järel vestluses näha; jätkuvestlus kirjest on teine samm.

## Lahti

- Päris pööre päris lehel kõhna kirjega (tasuline; luba ei ole küsitud). Praeguse plaaniga tekib esimene kõhn rida alles 7 päeva pärast.
- Rea ühekordne kirjutamine.
- Varasemate pöörete nähtavus pärast plaani vahetust (ülal): [ADR-094](adr-094-durable-conversation-history.md), esimene samm tehtud.
- Püsiv ajalookirje ja ajutine auditikirje (jaotis „Tuhandete kasutajate jaoks sellest ei piisa“): omanik otsustas 06.10, töö käib ADR-094 all.
- Serveri lugemisskriptid (`st/`) avavad nüüd kokkupakitud paketi (ühine klient `st/st-prisma.mjs`, 16 skripti, 06.10). Kõhnas reas puuduvat (vektor, päringu sisu, viitamata tõendus) nad lugeda ei saa: enne lugemist tuleb vaadata `payload.lean`.
