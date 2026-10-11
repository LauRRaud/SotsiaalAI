# ADR-138: töökoha lause ei kustuta elukohta

Kuupäev: 10.10.2026. Teostus Claude Opus 5.5 (kavandi ja selle vastulugemise tegid agendid 10.10 hommikul; siia jõudis kavandi üks eraldatav osa vastulugeja parandustega, kaks laiendust ja mõõtmine on minult). Seis: **kood ja testid tehtud; mõõdetud tasuta serveris päris keeleanalüüsiga; mudeliga mõõtmata, sest mudeli juhist see ei muuda.**

## Probleem

Kui vestluse plaan jätab kohanime kellelegi omistamata, loeb server lause ise. Lause, milles kasutaja räägib endast („ma“, „olen“) ja nimetab omavalitsust, aga ei ütle, et ta seal elab, jättis kasutaja elukoha lahtiseks. Varem teada olnud elukoht läks selleks pöördeks kaotsi ja ühtegi omavalitsust ei otsitud.

Mõõdetud serveris töötava koodiga (10.10.2026), kasutaja salvestatud elukoht Nõo vald:

| Kasutaja kirjutas | Elukoht pärast |
|---|---|
| „Ma töötan Maardus.“ | lahtine |
| „Olen Harku vallas tööl.“ | lahtine |
| „Olen Maardu linna sotsiaaltöötaja.“ | lahtine |
| „Olen Viimsi valla lastekaitsespetsialist.“ | lahtine |
| „Töötan Maardus.“ (ilma sõnata „ma“) | Nõo vald |

Sama lause ilma sõnata „ma“ ei muutnud midagi. Spetsialisti jaoks on see tavaline esimene lause: ta ütleb, kus ta töötab, ja küsib siis kliendi kohta.

## Otsus

**Lause, milles kasutaja räägib endast ja töötamisest või oma ametist, nimetab töökohta, mitte kodu.** Server paneb selle kirja kasutaja muu mainimisena (`relation: 'other'`, põhjus `unattributed_work_mention`, `lib/rag-v2/pilot/person-places.js`). Elukoht jääb selliseks, nagu see oli.

Töötamise loeb sõna pinnavorm (`speaksOfWorking`, `lib/rag-v2/pilot/record-scope.js`):

- töötamise sõna mis tahes ajas: „töötan“, „töötasin“, „töötanud“, „tööl“, „work“, „работаю“;
- ameti nimetus, mis lõpeb sõnaga „töötaja“ või „spetsialist“ („sotsiaaltöötaja“, „lastekaitsespetsialistina“).

Sõnad „töötu“ ja „töötukassa“ nende hulka ei kuulu.

Reegel ei kehti lausele, mis:

- loeb koduna või eitusena („Olen Maardus.“, „Ma ei ela enam …“): need loetakse nagu enne;
- sisaldab ka elamise sõna („Elan Tartus ja töötan Tartu vallas“, ilma komata): kodu on seal nimes, mida jagavad kaks omavalitsust, ja töökoht selle kõrval ei tohi lasta varasemal elukohal alles jääda. Selline lause loetakse nagu enne ja assistent küsib üle.

Server ei salvesta töökohta ega otsi selle järgi. Ta ainult ei kustuta enam elukohta.

Kavandi vastulugeja parandustest on sees: põhjuse nimi ei alga sõnaga `server_read_` (koristus usaldab selle algusega ainult kodu või eitust); tingimus on töötamise sõna, mitte „lugem ei ole tühi“. Minu laiendused, mida kavandis ei olnud: ameti nimetus, kahe omavalitsuse jagatud nimi („Ma töötan Tartus.“) ja keeld elamise sõnaga lausele.

## Mõõdetud

Tasuta, serveris, päris keeleanalüüsi ja omavalitsuste loendiga (`ov2-run.sh`, 54 selleks kirjutatud lauset, ilma plaani kohata, salvestatud elukoht Nõo vald; sama skript töötava koodiga ja muudetud koodiga):

| | |
|---|---|
| lauseid | 54 |
| muutus | 28 |
| sama | 26 |

26 lauses oli elukoht enne lahtine ja nüüd jäi Nõo vald alles („Ma töötan Maardus.“, „Olen Harku vallas tööl.“, „Olen Maardu linna sotsiaaltöötaja.“, „Ma töötasin varem Viimsi vallas.“, „Ma töötan Tartus.“, „I work in Maardu.“, „Я работаю в Маарду.“). Kahes lauses oli samas sõnumis ka uus kodu; see loeti nagu enne ja lisandus ainult töökoha mainimine („Ma töötan Maardus, aga elan Viimsi vallas.“ → Viimsi vald).

Sama jäid muu hulgas:

| Lause | Loetakse |
|---|---|
| „Elan Tartus ja töötan Tartu vallas.“ | lahtine, küsitakse üle |
| „Elan ja töötan Tartus.“ | lahtine, küsitakse üle |
| „Ma elan Viimsis ja olen Maardu linna sotsiaaltöötaja.“ | Viimsi vald |
| „Ma olen töötu ja elan Maardus.“ | Maardu linn |
| „Töötan Maardus.“ | Nõo vald |
| „Mu ema töötab Maardus.“ | Nõo vald |

Päris analüsaatoriga testifail `tests/rag-v2-record-scope.test.mjs` läbis serveris muudetud koodiga 5/5.

Kaks varasemat testi kinnitasid vana käitumise ja on meelega muudetud: `tests/rag-v2-region-state-5.test.mjs` („Olen Harku vallas tööl.“ jätab nüüd elukoha alles) ja `tests/rag-v2-question-region.test.mjs` (kirjavahemärkideta „töötan maardus millist koduteenust ma saan“ ei ole enam erand).

## Piirid

- **Külaskäigu lause** jätab elukoha endiselt lahtiseks: „Ma käisin eile Maardus arsti juures.“, „Mina sõidan iga päev Maardu kaudu.“
- **„Ma hakkan tööle Maardus.“** ja **„Olen Maardus töötu.“** loetakse nagu enne (lahtine).
- **„Olen Maardu elanik ja sotsiaaltöötaja.“** jääb lahtiseks, sest „elanik“ on elamise sõna.
- **„Ma ei ole enam Viimsi valla lastekaitsespetsialist.“** loetakse endiselt nii, et kasutaja ei ela Viimsi vallas.
- **Leitud ja parandamata:** „Olen spetsialist ja mu klient elab Maardus.“ (ilma komata) salvestab Maardu kasutaja enda elukohaks. See oli nii enne ja on nii nüüd.

## Lahtine

Kavandi põhiosa on ehitamata: plaan märgib spetsialisti töökoha omavalitsuse eraldi seosena, seis hoiab seda ja otsing kasutab seda siis, kui küsimus on kohaliku töö kohta. See muudab plaani juhist ja väljundit, nii et enne serverisse saatmist on vaja tasulist kontrolli päris mudeliga. Kavand ja vastulugeja parandused on failis `tmp/wf1-2026-10-10.json` (kavand C) seansi tööpuus `ecstatic-jepsen-e01bca`.
