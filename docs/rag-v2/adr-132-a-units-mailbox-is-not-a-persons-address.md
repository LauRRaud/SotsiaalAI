# ADR-132: üksuse postkast ei ole isiku aadress

Kuupäev: 10.10.2026. Teostus Claude Opus 5.5 (reegli ehitasid ja vaatasid mitmes ringis üle agendid; lõplik kontroll, salvestatud lehtede kordus, kaheksa lehe päris ülelugemine ja see kirje minult). Seis: **kood ja testid tehtud; mõõdetud tasuta 955 salvestatud lehekoopial ja kaheksa lehe päris ülelugemisel; korpuses ei ole veel midagi muutunud.**

## Probleem

Lehtede korjaja ([ADR-095](adr-095-web-pages-as-sources.md)) võtab lehe koopiast välja isiku kontakti: isiku e-posti aadressi koos selle kõrval seisvate telefoninumbritega. Isiku aadressiks luges ta iga aadressi, mille @-märgi ees on kaks tavalist sõna (`eesnimi.perenimi@`). Asutuse üksuse postkast on sama kujuga.

[ADR-112](adr-112-state-level-help-second-batch.md) pani selle kirja lahtise asjana: kohtute kontaktilehelt läksid välja kohtumajade aadressid menetlusdokumentide saatmiseks ja nende kõrvalt iga kohtumaja infotelefon. Vastus sai anda ainult üldaadressi ja lehe lingi.

Reegli läbivaatamisel leiti veel kolm viga samas kohas:

- **Aadress lingi sihtkohana.** Leht, mis kirjutab lingi kujul `<a href="info@amet.example">`, annab korjajale veebiaadressi, mille lõpus on e-posti aadress. Nähtav aadress võeti välja, lingi sihtkoht jäi koopiasse alles. Kohtute kontaktilehe salvestatud koopias on selliseid sihtkohti 45.
- **Sildita lingi sõnad jooksid kõrvalteksti sisse.** Link, mis kirjutab või helistab, kaotab koopias oma sildi. Selle sõnad seisid siis vahetult eelmise teksti vastas: „Tel 612 3456“ ja kohe aadress loeti üheks sõnaks, mida reegel ei osanud paigutada, ja number jäi alles; number ja kohe nimi ei olnud enam number, nii et kontaktikaarti ei tekkinud.
- **Täpitähega aadress lingi sihtkohas** loeti täpitähest alates, nii et eesnimi jäi nägemata ja järelejäänu võis paista kanalina.

## Otsus

**Aadress on üksuse postkast ainult siis, kui iga sõna @-märgi ees on arvele võetud.** Reegel eksib alati kinnise poole: aadress, mida ta ei oska paigutada, on kas isiku oma (võetakse välja) või jääb sisse ja leht läheb inimese ülevaatamisele. Midagi, mis enne välja võeti kontaktikaardina, tagasi ei tule.

`emailKind` (`lib/rag-v2/web-page.js`) annab endiselt kolm liiki:

| Liik | Mis see on | Mis temaga tehakse |
|---|---|---|
| `general` | asutuse kanal (`info@`) või üksuse postkast | jääb, numbrid tema kõrval jäävad |
| `personal` | isiku aadress | võetakse välja koos numbritega samas üksuses |
| `other` | reegel ei oska paigutada | jääb, leht läheb ülevaatamisele |

Sõnad, mille järgi otsustatakse (`MAILBOX_WORDS`):

- **kanalisõnad** (`info`, `klienditugi`, `registratuur`…), nagu enne;
- **üksusesõnad** (`osakond`, `menetlus`, `lastekaitse`, `sotsiaalosakond`, `keskasutus`…): sõnad, mis ei ole kellegi ees- ega perekonnanimi. Kes sõna lisab, kontrollib seda käsitsi nimestatistikast;
- **asutuse liigi sõnad, mis on ka perekonnanimed** (`vald`, `kool`, `kohus`…): nõrgad, loevad ainult siis, kui kõik teised sõnad on arvele võetud;
- **aadressi enda domeeni nimi** (`naidislinn` aadressis `info.naidislinn@naidislinn.example`).

Postkastiks teeb aadressi vähemalt üks kindel sõna: kanali- või üksusesõna, mis on vähemalt nelja tähe pikkune ega ole eesnimi, perekonnanimi ega initsiaalid.

Mis jääb isiku omaks:

- loendis olev eesnimi üksusesõna kõrval (`mari.osakond@`), ka täpitäheta kirjapildis (`jyri`, `jueri`) ja numbriga (`mari2.osakond@`);
- `linn` ja `maja` on ka eesnimed ja loevad ainult eesnimena;
- kaks tavalist sõna, millest kumbki ei ole üksusesõna, nagu enne.

Mis muutus peale selle:

- **Tundmatu sõna üksusesõna kõrval** (`<kohtumaja>.menetlus@`) on nüüd `other`: aadress ja numbrid jäävad, leht läheb ülevaatamisele. Enne oli see `personal`.
- **Number läheb välja ainult isiku aadressi kõrvalt.**
- **Kontaktikaart** (lühike üksus, mis nimetab isikut numbri või aadressi kõrval) joonistatakse endise reegli järgi. Iga plokk loetakse kaks korda: üks kord uue reegliga selleks, mis salvestatakse, teine kord endisega selleks, mis on kaart.
- **Lingi sihtkoht**, mis on paljas aadress või mille masinanime ees on kasutajanimi, ei lähe kunagi koopiasse. Sihtkoht, milles on isiku aadress, jäetakse välja ja leht läheb ülevaatamisele (`person_named_by_link`). Dokumendi link jääb dokumendiks ka siis, kui faili nimes on aadress.
- **Sildita lingi sõnad** ei jookse enam numbri ega aadressi sisse (`settle`): tühik pannakse ainult sinna, kus aadress või number muidu tähe või numbriga kokku kasvaks.
- Korjaja nimi on `rag-v2/web-page-2`. Sisu räsi ei sisalda korjaja nime ega lingi sihtkohta, nii et nimi üksi ei tee ühestki lehest muudatusettepanekut.

## Mõõdetud

**Salvestatud koopiad, loetud uuesti endise ja uue reegliga** (10.10.2026; 955 koopiat: 361 `Andmebaasi/veebilehed`, 51 müüjate ja 543 organisatsioonide lehte põhikausta `tmp` all):

| | |
|---|---|
| tekst sama | 955 / 955 |
| sisu räsi sama | 955 / 955 |
| isiku aadresse tekstis | 0 |
| nähtavaid aadresse, mille liik muutus | 2 (üks leht, `other` → `general`) |
| lehti, kust läks lingi sihtkohti | 2: kohtute kontaktileht 31, üks organisatsiooni leht 1 |
| lehti, mis lähevad uuena ülevaatamisele | 1 (sama organisatsiooni leht: lingi sihtkohas oli isiku aadress) |
| lehti, millel on varasema väljavõtmise märk | 8 (34 aadressi, 21 numbrit) |

Salvestatud koopiast ei saa lugeda seda, mis sealt juba välja võeti. Seepärast loeti need kaheksa lehte päris lehelt uuesti (tasuta, midagi ei salvestatud):

| Leht | Endine reegel | Uus reegel |
|---|---|---|
| Kohtud: kuidas kohtuga ühendust võtta | 25 aadressi ja 20 numbrit väljas | **25 postkasti ja 20 infotelefoni tagasi** (20 menetlusdokumentide, 5 lastekaitse postkasti); 31 lingi sihtkohta väljas; leht ülevaatamisel nagu enne |
| Kohtutäiturite koda: elatisabi taotlemine | 1 aadress väljas, ülevaatamisel | keskasutuse aadress tagasi, ülevaatamist ei vaja |
| Kohtutäiturite koda: elatisvõlgnevused | sama | sama |
| Sotsiaalministeerium: elatisabi | sama | sama |
| SKA: kaugtõlge | 2 aadressi, 1 number, 1 kaart väljas | muutuseta |
| SKA: rahvusvahelise kaitse taotlemine | 1 aadress väljas | muutuseta |
| SKA: ohvriabi lihtsas keeles | 1 aadress, 4 kaarti väljas | muutuseta |
| palunabi.ee: seksuaalne ahistamine ööelus | 2 aadressi, 1 kaart väljas | muutuseta |

Kohtute lehe uus koopia vaadati rida-realt üle: iga kohtumaja real on maja aadress, infotelefon, üldaadress ja menetlusdokumentide postkast; ühegi kanali kõrval ei ole loendis olevat eesnime. Kaheksal lehel kokku ei jäänud teksti ühtegi isiku aadressi ega lingi sihtkohta, milles on @-märk.

Neljal muutuseta lehel on aadressid kujul `sõna.sõna@`, kus reegel ei tunne kumbagi sõna. Need jäävad välja nagu enne.

Testid: `tests/rag-v2-web-page.test.mjs` 14 → 27 testi.

## Piirid

- **Kohtumajade postkastid on `other`, mitte `general`.** Kohtumaja lühend ei ole reeglile tuntud sõna, nii et leht läheb ülevaatamisele ja paigutatakse ainult inimese loal (`--approve`). See on kinnise poole viga meelega.
- **SKA kaugtõlke toe aadress jääb välja.** ADR-112 pidas seda asutuse enda aadressiks; reegel ei tunne selle sõnu ja ei saa seda isiku aadressist eristada.
- **Eesnimi, mida loendis ei ole,** samanimelise domeeni juures ja asutuse liigi sõnaga perekonnanime kohal (`<nimi>.vald@<nimi>.example`) ei ole valla aadressist eristatav; selline aadress jääb `other` ja leht ülevaatamisele.
- Organisatsioonide ja müüjate lehti igakuine uuendus ei loe ([ADR-116](adr-116-official-pages-monthly-refresh.md)), nii et nende koopiad muutuvad alles järgmisel kogumisel.

## Lahtine

Neli muutunud ametlikku lehte jõuavad korpusesse kas igakuise uuendusega (esimene lugemine 1. novembril, muudatus rakendub teisel võrdsel lugemisel) või varem koos järgmise täiendusega; kohtute leht vajab kummalgi juhul luba `--approve`. Varasem tee vajab väikest ostu ja seega omaniku luba.
