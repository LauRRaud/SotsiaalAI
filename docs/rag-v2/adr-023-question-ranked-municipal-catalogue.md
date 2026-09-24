# ADR-023 — Küsimuse järgi järjestatud KOV-kataloog

24.09.2026. Teostus Claude Opus 5.5.

## Probleem

ADR-021 kataloog kärbib suure valla loendi ID järjekorras, seega jäävad välja ID lõpus olevad teenused, sõltumata küsimusest (Tallinn 63/71, Jõhvi 62/65). Pealkirjade vaates pole ühelgi mittevalitud kirjel kokkuvõtet, ka kõige asjakohasemal mitte. Codexi 24.09 järelülevaatus nimetas välja jäänud kirjete leidmise järgmiseks tööks.

## Otsus

- `StructuredRecordSource.retrieve({ question })` järjestab kataloogi generatsiooni enda sõnalise kanaliga (sama leping ja analüsaator mis põhiotsingul), piiratuna selle valla kirjeüksustega. Kirje skoor on tema parima üksuse skoor. Järjestus ei filtreeri midagi.
- Prioriteet: valitud detailid, siis asjakohasus, siis stabiilne ID. Mahupiiri korral jäävad välja kõige vähem asjakohased.
- Pealkirjade vaade annab kokkuvõtte nii paljudele kõige asjakohasematele kirjetele, kui piiri sisse mahub (`detail: 'relevant_summary'`, `relevant_summaries`, `selection: 'question_relevance'`). Mudeli juhis: see on järjestusabi, mitte sobivuse ega õiguse tõend.
- Piloot annab järjestamiseks uusimad kasutajapöörded, mis mahuvad päringu 8000 märgi piiri.
- Uusi kutseid, indekseid ega versioone pole.

## Mõõtmine päris KOV-pakettidel

Kuus valda, kümme olukorralauset. Asjakohane teenus tähendab pealkirjamustrit (nt „transport|sõidu”); arvesse läksid ainult paarid, kus vallas selline teenus on. Kokku 53 paari.

| Mõõdik | Enne (ID järjekord) | Pärast |
| --- | ---: | ---: |
| Kõik asjakohased teenused kataloogis | 46/53 | 51/53 |
| Vähemalt ühel asjakohasel teenusel kokkuvõte | 0/53 | 19/53 |

- Anija, Harku ja Kose: kokkuvõte lisandus 16 paaril 27-st.
- Pärnus pole ruumi, sest pealkirjad üksi võtavad 11 749 tokenit piirist 12 000.
- Tallinnas ja Jõhvis tõi järjestus loendisse viis puudunud teenust, sh võlanõustamise mõlemas vallas (0 → 1). Kaks paari halvenes: Tallinn „raha otsas” 3 → 2, Jõhvi „eakas isa” 4 → 3.

Halvenemise põhjus: üldsõnad („on”, „ja”, „ei”, „mul”) annavad peaaegu igale kirjele positiivse skoori ja müra järjestab osa pärisvastetest ette. Sõnalise kanali üldsõnade käsitlus on järgmine samm, mis parandab ka seda.

## Kõrvalleid: EstNLTK protokolliviga

Kose kirjes olev „2 eurot/m²” andis lemma `vmetm²`. Pythoni `\w` loeb „²” sõnatäheks, kliendi protokoll lubab ainult tähti, märke ja sidekriipsu, seega lükati kogu partii tagasi (`morphology_protocol_error`). Sellise allika EstNLTK-indekseerimine ja „m²” sisaldav päring ebaõnnestusid.

Parandus: worker jätab välja tunnused, mis pole tähed, märgid ega sidekriips. Varem õnnestunud väljund ei muutu, sest selline tunnus nurjas alati kogu partii. Seetõttu analüsaatori versioon ei muutu ja 05.09 võrdlus andis täpselt sama tulemuse: sõnaline 11, vektor 15, hübriid 17/18, M2.2 7/7. Pärnu, Jõhvi ja Tallinna tekstides sama viga polnud.

## Piirid

Asjakohasuse märgistus on pealkirjamuster, mitte inimhinnang. Kokkuvõte näitab, et mudel näeb teenuse sisu; see ei tõenda, et mudel vastab õigesti.
