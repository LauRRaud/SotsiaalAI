# ADR-026 — KOV-kataloogi tähenduspõhine järjestus

24.09.2026. Teostus Claude Opus 5.5.

## Probleem

Inimene kirjeldab olukorda, mitte teenuse nime. „Mul on raha otsas ja toiduks ei jätku” ei sisalda sõna „toimetulekutoetus”. Seetõttu ei leidnud ADR-023/024 sõnaline kataloogijärjestus seda kolmes vallas kuuest: kokkuvõtet polnud ja teenus oli järjestuse lõpus.

## Otsus

- Ühisel rajal on pöörde päringuvektor juba olemas. Kui see on antud, järjestab kataloogi vektorindeks, mis arvestab ainult selle piirkonna kirjeüksusi. Kirje skoor on tema parima üksuse sarnasus. Järjestus ei filtreeri midagi.
- Ilma vektorita järjestab endiselt sõnaline kanal (ADR-023/024). Kirjete rajal ilma ühise marsruudita vektorit ei ole ja käitumine ei muutu.
- Kanaleid ei ühendata RRF-iga, sest mõõtmises tegi see tulemuse halvemaks (vt allpool).
- Auditipakett saab kirje kohale järjestuses (`relevance_rank`) ja kasutatud kanali (`relevance_channels`). Mudeli vaade jätab need välja.
- Uusi kutseid pole: päringuvektor on pöörde oma, üksuste vektorid on indeksis.

## Mõõtmine päris andmetel

Kuus valda ja ADR-023 kümme olukorralauset, kokku 53 paari. Päris `text-embedding-3-large` vektorid 5192 kirjeüksusele ja kümnele lausele telliti omaniku loal: 273 076 tokenit, ~0,036 USD. Asjakohasus on pealkirjamuster.

| Järjestus | Asjakohane teenus kokkuvõttega | Esimesel kohal | Top 3 | Top 5 |
| --- | ---: | ---: | ---: | ---: |
| Sõnaline (ADR-024) | 46 | 16 | 27 | 34 |
| **Vektor** | **53** | **27** | **43** | **47** |
| RRF, kaal 1 | 53 | 25 | 37 | 45 |
| RRF, vektor ×2 | 53 | 26 | 40 | 45 |

- „Raha otsas” leiab toimetulekutoetuse kõigis kuues vallas kohtadel 1–4, varem kolmes vallas üldse mitte.
- RRF halvendas järjestust. Jõhvis oli „Jään kodust ilma, kus saan ööbida?” puhul varjupaik vektoriga 1. kohal, RRF-iga 17. kohal. Sõnaline kanal tabab kodu- ja hooldusteenustes sõna „kodu” ning mõlemas nimekirjas olev kirje saab kaks panust.
- Põhiotsingus on olukord teine (ADR-022: hübriid 17/18 vs vektor 15/18): artiklid on pikad ja küsimused sõnastatud. KOV-kirjed on lühikesed ja pöörded on olukorrakirjeldused.
- Lõplik tootmiskood kordas vektori rea täpselt: 53 / 27 / 43 / 47.

## Piirid

- Asjakohasuse märgistus on pealkirjamuster, mitte inimhinnang. Kokkuvõtte olemasolu ei tõenda õiget vastust.
- Kirjete rajal ilma ühise marsruudita jääb sõnaline järjestus.
- Mõõtmise vektorid on kohalikud (85 MB), mõõtmispaketti neid ei lisatud.
