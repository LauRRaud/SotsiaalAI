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
   - `0`: pööre salvestatakse kõhnana kohe avaldamisel (tootmine); varasema plaani ajast jäänud terved pöörded teeb kõhnaks koristus;
   - päevade arv: pööre salvestatakse tervena ja tehakse kõhnaks, kui see on vanem (arendus; säilituse koristus teeb seda, kuni 200 rida korraga);
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

Kõhna rea suurim osa on viidatud tõendus (keskmiselt 17,6 KB): lõikude tunnused ja asukohad, mida viite kontroll vajab, ja lõigu tekst. Kettal on rida andmebaasi tihendamise tõttu väiksem; seda ei ole mõõdetud, sest midagi ei kirjutatud.

## Kontroll

- **Ühiktestid** (`tests/rag-v2-lean-turn.test.mjs`): mis jääb ja mis läheb; vestluse loetav on kõhnast kirjest sama; kõhna paketi viited kontrollitakse kirjekaupa ja korpuse vastu (muudetud tekst, muudetud viide, puuduv kirje, muutunud allikas ja äravõetud ligipääs keelduvad); muudetud vastuse või olekuga kõhn rida keeldub (`lean_turn_changed`); pood avaldab `auditDays: 0` korral kõhnana ja muul juhul tervena; vanade ridade kõhnaks tegemine; plaani väli.
- **Andmebaasitestid** (kohalik testandmebaas): Tallinna-suuruse paketiga terve pööre salvestub kõhnana (alla 20 KB) ja taastub oma viidatud allikaga; hiljem muudetud vastusega rida keeldub; auditiajaga plaani pööre salvestub tervena, tehakse vanemana kõhnaks ja taastub; neljapöördeline dialoog ja olekuga dialoog jätkuvad kõhnadest pööretest.
- `tests/rag-v2-corpus-run.test.mjs`: korpuse täiendus kannab `auditDays` uude plaani, ka nulli.

## Kasutuselevõtt

Pärast selle muudatuse jõudmist serverisse tehakse arendusplaan `auditDays: 7`-ga, mis jätkab praeguse plaani kuluarvestust. Tehtud plaani nimi ja kontroll lisatakse siia eraldi muudatusega. Tootmisplaan saab `--audit-days 0`.

```bash
node scripts/rag-v2-chat-plan.mjs ... --audit-days 7 --continue-ledger <asendatav plaan> --basis "<omaniku korraldus>" --activate
```

## Mida see ei lahenda

- **Tabeli fail ei kahane.** 06.10 oli tabel kettal 43 MB, elusaid andmeid 15 MB; ülejäänu on koht, mille jätab pöörde rea korduv ülekirjutamine pöörde käigus. See koht läheb taaskasutusse, aga rida kirjutatakse endiselt mitu korda. Ühekordne kirjutamine on eraldi töö.
- **Täisauditi aja sees on rida endiselt suur** (umbes 0,3 MB pärast paketi kokkupakkimist, ADR-089).

## Tuhandete kasutajate jaoks sellest ei piisa

Omanik samal päeval: „mul on plaanis platvormile tuua tuhandeid kasutajaid, mul ei tohi paisuda kõvaketta kasutus meeletuks. Peab arvestama, kuidas toimub vestlus, selle talletamine, ajalugu.“

Arvutus eeldusega 3000 kasutajat ja 10 pööret päevas kasutaja kohta (30 000 pööret päevas). Kettamaht on hinnang: mõõdetud on tekstimaht, ja andmebaas tihendas täiskirjet 2,2 korda.

| Kirje kuju | Pöörde kohta kettal | Päevas | Aastas |
|---|---|---|---|
| Täiskirje (seni) | 183 KB (mõõdetud) | 5,5 GB | ei mahu |
| Kõhn kirje (see otsus) | umbes 14 KB (hinnang 30,6 KB tekstist) | 0,4 GB | umbes 150 GB |
| Ajalookirje ilma tõenduseta (järgmine samm) | umbes 1,5 KB (hinnang 3 KB tekstist) | 45 MB | umbes 16 GB |

Kõhn kirje on seega vaheaste: see peatab arendusaja kasvu ja teeb vana rea 92% väiksemaks, aga hoiab viidatud tõenduse tervikuna, sest iga lugemine kontrollib viiteid korpuse vastu. Tuhandete kasutajatega on vaja teistsugust jaotust:

1. **Püsiv ajalugu on ainult vestlus:** küsimus, vastuse tekst ja iga viidatud allika kohta lühike viide (pealkiri, koht, link, kontrolli kuupäev). Umbes 3 KB pöörde kohta. Praegu on vestluse sõnumite tabelis kohatäited ja päris tekst on ainult pöörde auditikirjes.
2. **Auditikirje on ajutine:** täis- või kõhn kirje elab seadistatud arvu päevi ja kustub siis täielikult (rea aegumine on poes olemas).
3. **Ajalugu ei sõltu plaanist ega korpuse versioonist** (vt „Kõrvalleid“). Vana vastus näitab seda, mis tollal vastati; allika avamine loeb praegust korpust või ütleb, et allikas on uuenenud.
4. **Vestluste säilitusaeg** on omaniku otsus (näiteks 12 kuud või kuni kasutaja kustutab).
5. **Rida kirjutatakse üks kord**, mitte kümmekond korda pöörde jooksul.

See on eraldi otsus ja eraldi töö: see muudab, kust ajalugu loetakse ja mida vana pöörde kohta enam ei tõestata.

## Tagasipööramise piir

Kõhn rida tekib ainult siis, kui plaanil on `auditDays`. Kuni ühtegi kõhna rida ei ole, saab selle väljalaske tagasi pöörata nagu iga teise. Pärast esimest kõhna rida ei loe sellest vanem väljalase neid pöördeid (`invalid_model_reference`); alumine piir on see väljalase. Kokkupakitud pakettide alumine piir on #403 (`edde1119`), [ADR-089](adr-089-closest-contact-directory.md).

## Kõrvalleid: plaani vahetus peidab varasemad pöörded

Vestluse ajalugu ja dialoogi kontekst loevad ainult töötava plaani pöördeid (`configHash`). Plaan uueneb iga väljalaskega, mis vestluse koodi muudab, ja iga korpuse täiendusega. Pärast seda varasemaid pöördeid vestluses ei näidata ja dialoog algab otsast. Arenduses on see teadlik piir; tootmises tähendaks see, et kasutaja ajalugu kaob igal uuendusel. **Enne avamist vajab see eraldi otsust.** Selle muudatusega seda ei puudutatud.

## Lahti

- Päris pööre päris lehel kõhna kirjega (tasuline; luba ei ole küsitud). Praeguse plaaniga tekib esimene kõhn rida alles 7 päeva pärast.
- Kõhna rea suurus kettal.
- Rea ühekordne kirjutamine.
- Varasemate pöörete nähtavus pärast plaani vahetust (ülal).
- Püsiv ajalookirje ja ajutine auditikirje (jaotis „Tuhandete kasutajate jaoks sellest ei piisa“): omaniku otsus ja eraldi töö.
- Minu serveri lugemisskriptid (`st/`) eeldavad täiskirjet.
