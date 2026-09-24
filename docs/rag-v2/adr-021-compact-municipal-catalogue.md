# ADR-021 — Kompaktne ja kohanduv KOV-kataloog

24.09.2026. Teostus Claude Opus 5.5.

## Probleem

Päris KOV-pakettidega ületas ADR-016 kataloog 12 000 tokeni piiri 6–11 korda: Anija 70k, Tallinn 136k. Pärnu ületas ka kirjete piiri 100. Iga selline pööre ebaõnnestus ja ühisel rajal ebaõnnestusid ka järgmised ajakirjaküsimused. Suurem osa mahust ei olnud tõend:
- iga kirje-dokumendi metaandmed koos päritoluga (Anija 39k);
- kirje kohta korratud räsitunnused;
- igas allikas korratud hoiatustekst.

## Otsus

Leping on `rag-v2/record-catalogue-2`.

- Kirje tõendil on mudeli jaoks ainult `source_type` ja `source_checked_at`. Täielik metaandmestik ja päritolu jäävad bundle'isse ja auditisse. Hoiatused on üks kord `record_context.source_limitations` all.
- Kataloogikirjel ei ole enam dokumendi- ega versiooniräsisid. Värskuse tähendus on üks kord `record_context.freshness` all.
- Jätkupöörde fookus (`recordFocus`) tuletatakse vastuse viidetest kirje enda väljadele, mitte dokumendi tunnusest.
- **Kohanduv vaade.** Kõigepealt täisvaade: pealkiri, kokkuvõte, link ja kõigi kirjete seosed. Kui see ei mahu, pealkirjade vaade, kus detailid ja seosed on ainult valitud kirjetel. Kui ka see ei mahu, pealkirjade osaline loend, kus valitud detailid on esimesed, märkega `completeness: partial_context_budget` ja `listed_count / catalogue_count`. Viga tuleb ainult siis, kui ka valitud detailid ei mahu.
- Dokumentide ja kirjete ülempiir on 300.

## Tõend

Päris `Andmebaasi/KOV` paketid ja päris vastuvõtukood, kataloog mälus, piir 12 000:

| Vald | Enne | Pärast |
| --- | --- | --- |
| Anija | 70 057, tõrge | 6 081, pealkirjad 35/35 |
| Harku | 91 017, tõrge | 7 248, 41/41 |
| Kose | 99 653, tõrge | 9 225, 51/51 |
| Pärnu | kirjete piir, tõrge | 11 281, 62/62 |
| Jõhvi | 126 822, tõrge | 11 827, 64/65 osaline |
| Tallinn | 135 598, tõrge | 11 921, 66/71 osaline |

Testid (`TZ=UTC`): struktureeritud kirjete integratsioon 7/7 uue vaatevahetuse kontrolliga, ühine rada 2/2, dialoog, seis, vestlusandmebaas, konfiguratsioon, unified, piloodi eelkontroll ja valla tuvastus (kokku 44). ESLint läbis. Tasulisi kutseid 0.

## Piirid

Pealkirjade vaates valib mudel teenuse pealkirja järgi. Kokkuvõte ja tingimused tulevad järgmises pöördes viidatud kirje detailina. Suure valla loend võib jääda osaliseks, mis on märgistatud. Semantiline eelvalik, kus kõige asjakohasemad kirjed saaksid kokkuvõtte, on järgmine võimalik samm. Kataloog pole serveri piloodiplaanis sisse lülitatud.

## Täiendus 24.09 (Codexi R2/R3)

- Tihendatud tõend säilitab allika enda `historical`, `source_status`, `valid_from` ja `valid_to`, kui need on deklareeritud. Üldine `collected_not_verified_current` ei asenda allika teadaolevat lõppkuupäeva.
- Kõigil allikatel ühesugune hoiatus on üks kord `source_limitations` all. Allikapõhine hoiatus jääb allika juurde.
- Leping jääb versiooniks `rag-v2/record-catalogue-2`, sest v2 kataloogi pole üheski kinnitatud plaanis kasutatud. `rag-v2/record-catalogue-1` plaan on loetav, kuid mitte käivitatav.
- Mõõtmine pärast täiendust: Anija 6 348, Tallinn 11 908 (63/71), Jõhvi 11 953 (62/65).
