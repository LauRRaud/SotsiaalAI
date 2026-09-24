# ADR-025 — KOV-kataloogi kompaktne mudelivaade

24.09.2026. Teostus Claude Opus 5.5.

## Probleem

Pärnu kataloogi pealkirjavaade võttis 12 000 tokeni piirist 11 748. Teenuste pealkirjad ise moodustasid sellest **711 (6%)**; ülejäänu oli ümbris ja iga pealkiri oli kolm korda:

| Osa | Tokeneid | Teenuse kohta | Mis seal oli |
| --- | ---: | ---: | --- |
| `sources` | 3 625 | ~58 | pealkiri uuesti, `authors: null`, `publication_date: null`, väärtused kujul `{value: …}`, tühi `limitations` |
| `evidence` | 3 831 | ~62 | JSON-tee ja kirje-ID `source_locations`-is, tühi `pdf_pages`, pealkiri ise |
| `entries` | 4 118 | ~66 | pikk `record_id`, igal kirjel korduv `region`, `detail: 'catalogue'` |

Seetõttu ei mahtunud mudelisse ükski teenuse kirjeldus, kõige asjakohasemadki mitte (ADR-023). Tallinn ja Jõhvi said ainult osalise loendi.

## Otsus

Muutub ainult mudeli vaade. Auditipakett (`record_context`, `evidence`, `reference_map`) jääb täielikuks. Muutus puudutab ainult `structured_record` tõendit, mida toodab ainult kataloogirada; artiklite ja õigusaktide projektsioon jääb samaks.

- Tõend mudelile on `{ ref, source, text }`. JSON-tee, kirje-ID ja tühi leheküljeloend jäävad viiteloendisse (`reference_map`), mida server kasutab kanooniliseks kontrolliks.
- Allikakaart: väärtused ilma `{value}`-ümbriseta, null- ja tühjad väljad välja, pealkirja ei korrata. Väärtused, mis on kõigil kaartidel ühesugused, on üks kord `records.source_defaults` all. Erineva väärtusega kaart, nt kehtetu allika `valid_to`, hoiab oma väärtuse.
- Kirje mudelile on `{ key, kind, fields, detail? }`. `record_id` ja kirjepõhine `region` jäävad paketti; piirkond on mudelile üks kord `records.region` all. `recordFocus` tuletatakse serveris viidetest (ADR-021), mudelile ID-sid vaja pole.
- Mudeli juhis: `records.source_defaults` kehtib iga kaardi kohta, kui kaart ei ütle teisiti.

## Mõõtmine päris KOV-pakettidel (kulu 0)

Pealkirjavaade:

| Vald | Enne | Pärast |
| --- | ---: | ---: |
| Anija | 6 348 | 2 263 |
| Harku | 7 557 | 2 668 |
| Kose | 9 604 | 3 331 |
| Pärnu | 11 748 | 4 067 |
| Jõhvi | 11 953, 62/65 | 4 256, 65/65 |
| Tallinn | 11 908, 63/71 | 4 663, 71/71 |

ADR-023 53 valla ja olukorralause paaris:

| Mõõdik | ADR-024 järel | Pärast |
| --- | ---: | ---: |
| Kõik asjakohased teenused kataloogis | 52 | 53 |
| Vähemalt ühel asjakohasel teenusel kokkuvõte | 18 | **46** |

- Iga vald jõudis kokkuvõteteni. Suurim kontekst oli 9 923 tokenit, seega mahupiir pole enam piiraja.
- Seitsmes paaris jäi asjakohane teenus kokkuvõtteta, sest sõnad ei kattunud. Näiteks „Mul on raha otsas ja toiduks ei jätku” ei nimeta toimetulekutoetust. See on sõnalise järjestuse piir: järgmine samm oleks semantiline järjestus päringuvektoriga, mis ühisel rajal on olemas.

## Piirid

- Asjakohasus on pealkirjamuster, mitte inimhinnang. Kokkuvõtte olemasolu ei tõenda õiget vastust.
- Mudeli vaade muutus: pärisvastuste mõju tuleb mõõta piloodis. Leping jääb `rag-v2/record-catalogue-2`, sest seda pole üheski kinnitatud plaanis kasutatud.
