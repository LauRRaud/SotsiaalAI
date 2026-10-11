# ADR-146: Töötukassa ja ühingute lehed teise tööriista korjest

Kuupäev: 11.10.2026. Teostus Claude Opus 5.5. Seis: **korpus v84 on serveris: 131 Töötukassa lehte ja 190 ühingute lehte; ost 0,0704 USD.**

## Miks

Töötukassa lehti ei saanud projekti korjaja lugeda: saidi robotifail lubab lehtede aadresse, aga keelab tee, kust lehe tekst skriptiga laaditakse. Omanik lasi sisu koguda teisel tööriistal (Codex) brauseriga ja samal päeval ka üheteistkümne ühingu saidid, mida olin talle nimetanud. Ta andis mõlemad kogud siia: „kõik peavad saama meta failid ja graph peab looma seosed“, valis, et töö tehakse selles aknas, ja ostu kohta (lagi 0,10 USD) ütles „kõik vaja ära teha“.

## Mis kogudes on

Kaks kogu kaustas `Andmebaasi/Töötukassa` ja `Andmebaasi/Tugiorganisatsioonid` (hoidlas neid ei ole), kokku 4218 tekstikirjet ja umbes 106 miljonit tähemärki.

| Liik | Töötukassa | Ühingud | Otsus |
|---|---:|---:|---|
| väljaandja enda lehed | 179 | 986 | loeti, valiti reegliga |
| muudatuste uudised | 38 | 140 | ei: uudised vananevad; omaniku otsusel saab lisada |
| manused (PDF, tabelid, tekstifailid) | 249 | 680 | ei: statistikatabelid, aruanded, vormid; juhendid vajavad eraldi valikut ja võrdlust olemasolevaga |
| teiste väljaandjate lehed ühe lingisammu kauguselt | 208 | 1566 | ei: teiste väljaandjate sisu, sh ajakirjandus ja võõrkeelsed lehed |
| seaduste koopiad Riigi Teatajast | 41 | 131 | ei: seadused on kogus ametlikust allikast koos kehtivusega |

Kõike ei saaks sisse panna ka mahu pärast: lõikude piir on 150 000 ja serveri kettal oli vaba 14 GB (umbes 370 KB lõigu kohta).

## Kuidas lehed loeti

Lehed loeti **projekti enda lehelugejaga** (`lib/rag-v2/web-collect.js`, `web-page.js`), aga lehe baidid tulid kettale salvestatud korjest, mitte saidilt (`tmp/rag-v2-codex-import/tools/collect-from-capture.mjs`). Nii on lehe kuju, metaandmed ja kontrollid samad mis tavalisel korjel. Saidi robotifail loeti endiselt saidilt endalt:

- **Päästearmee** sait keelab robotitel lugemise; selle 70 lehte jäid välja.
- **Töötukassa** lehtede aadressid on robotifaili järgi lubatud; teksti tõi teise tööriista brauser. See on omaniku otsus. Tagajärg: igakuine uuendus neid lehti üle lugeda ei saa ja need jäävad korjepäeva seisuga. Kirja mustand Töötukassale (luba lugeda kord kuus või tekst muul viisil) on tehtud.
- Kokkuvolditud plokid olid Töötukassa korjes avatud ja kontrollitud (oodatud ja kogutud plokkide arv lehe kaupa); lehel „Töökeskne nõustamine“ on kõik seitse vastust.
- Kaks ühingut jäid ilma leheta: Kasuperede Liidult oli ainult ingliskeelne leht, Pensionäride Ühenduste Liidu sait ei avanenud ka teisel tööriistal.

## Valik

**Töötukassa: 131 lehte, 58 501 sõna.** Loendisse võeti 138 lehte (ette jäid välja statistikalehed, jaluse halduslehed peale vaide esitamise, blogi, andmekaitsetingimused, partnerite ja koolitajate lehed). Reegel valis 130; välja jäid kaheksa lehte: partneri- ja kogemuslugude lehed, lõppenud töötutoetuse leht ja lehed, mis on peamiselt inimestest. Esinduste leht (aadressid, lahtiolekuajad, esinduste postkastid) paigutati käsitsi: reegel luges selle inimeste leheks, kuigi ükski lõik inimest ei nimeta.

**Ühingud: 190 lehte, 92 508 sõna.** Loendis 851 lehte, loetud 779 (70 keelas robotifail, 2 kordust), reegel valis 368. Seejärel käsitsi sammud:

- saidi korduv plokk välja (menüürida, annetuse üleskutse pangakontoga, ostukorv, „kuula artiklit“) ja võõrkeelsed lehed välja (`tools/tidy-placed.mjs`);
- lehe haaval välja annetus- ja liitumislehed, privaatsustingimused, põhikirjad ja statuudid, projektikirjeldused ja huvikaitse ajalugu, abitöö teistes riikides, arvamuslood, lood nimeliste inimestega (`tools/leave-out.mjs`);
- jääkread välja: robotikontrolli märk, autoriõiguse rida, peatüki „järgmine“ ja „eelmine“ viited koos autori nimega, üks eesnimega tänukiri (`tools/strip-units.mjs`).

| Ühing | Lehti | Sõnu |
|---|---:|---:|
| Eesti Inimõiguste Keskus | 86 | 53 291 |
| Eesti Lasterikaste Perede Liit | 25 | 4 750 |
| Eesti Punane Rist | 21 | 5 725 |
| Eesti Naiste Varjupaikade Liit | 16 | 9 780 |
| Eesti Patsientide Liit | 12 | 3 921 |
| Eesti Pagulasabi | 9 | 4 164 |
| MTÜ Oma Pere | 8 | 4 692 |
| SOS Lasteküla Eesti Ühing | 8 | 4 584 |
| Eesti Võlanõustajate Liit | 5 | 1 601 |

Inimõiguste aastaaruannetest on sees ainult 2026. aasta oma (varasemad on varasema aasta uuringud).

Valikureegli sõnaloendisse lisandus 37 paari, mida reegel luges inimese nimeks, aga mis on asutuse või ettevõtte nimi: Punase Risti nimi käändevormides, ettevõtted, erakonnad, ingliskeelsed mõisted. Ilma selleta kaotasid Punase Risti lehed lõike, kus on nende enda nimi.

## Metaandmed ja graaf

- Igal lehel on metafail korjaja võtmetega; `collection.capture` ütleb, millisest korjest baidid tulid (kogu tunnus, dokumendi tunnus, meetod, faili räsi), ja lugemise ajaks on korje enda aeg.
- Teise tööriista metafailid ja graaf (dokument, alajaotus, tekstiosa, link; 592 kogudevahelist lingiseost) on päritolu ja struktuuri kirjeldus tema enda vormingus. Kogu neid ei kasuta: struktuuri teeb töötlus ise ja tähendusseoseid seal ei ole.
- Mudeliga tehtud teadmiskaarte neil lehtedel ei ole (nagu ülejäänud kogul peale seitsme dokumendi). Viide seaduse sättele järgitakse otsingu ajal kõigil dokumentidel ([ADR-145](adr-145-a-passage-points-at-the-provision-it-names.md)).

## Ost

| Käik | Lehti | Sisendeid ostetud | Märke | Hind | Indeks | Dokumente kokku | Lõike kokku |
|---|---:|---:|---:|---:|---|---:|---:|
| v84 | 321 | 1 564 | 541 804 | 0,0704 USD | `74de5ca3` | 10 569 | 93 401 |

Vestlusplaan `/etc/sotsiaalai/m4-corpus-chat-20261011h.json`; järgmine alus põhikausta `tmp/rag-v2-codex-import/ship/policy.json`.

## Kus lehed on

- Töötukassa: `Andmebaasi/register/web_pages_tootukassa.json` (131 lehte, ei ole igakuises uuenduses).
- Ühingud: `web_pages_associations.json` (+83, igakuises uuenduses) ja `web_pages_associations_2.json` (+107, käsitsi sammuga muudetud lehed, ei ole uuenduses).
- Lehtede koopiad on väljaspool hoidlat (`tmp/rag-v2-codex-import/sources-tk`, `sources-assoc`); register loetleb need pealkirja ja aadressiga.

## Lahtine

- Töötukassa lehtede värskus. Teine tööriist tegi samal päeval korduskontrolli skripti (`scripts/check-tootukassa-updates.mjs` põhikaustas, veel hoidlasse panemata): see avab lehed brauseris uuesti, võrdleb teksti ja linke eelmise korjega ning kirjutab muutused eraldi kausta. Tööjaotus: korduskontrolli käivitab omanik või teine tööriist; muutunud lehed loetakse siis sama lugejaga nagu siin ja lähevad täiendusse. Ajastust ei ole. Kirja mustand Töötukassale (luba lugeda kord kuus) on omanikul.
- Kuus Töötukassa teekonnalehte, mis jäid esimeses korjes tühjaks, on korduskontroll uuesti salvestanud (`Andmebaasi/Töötukassa/kontroll-teekonnad-2026-10-11-v2/`); need ei ole veel kogus.
- Töötukassa 38 muudatuste uudist ja manuste hulgas olevad juhendid: omaniku otsus.
- Käsitsi sammuga muudetud ühingute lehed ei ole igakuises uuenduses.
- Vastuseid nende lehtede pealt ei ole selle otsuse kirjutamise ajal mudeliga mõõdetud.
