# ADR-115: riigi tasandi abi kolmas partii (korpus v74)

Kuupäev: 09.10.2026. Teostus Claude Opus 5.5. Omanik 09.10.2026: „on meil veel RAG süsteemi arendust. Jätka“ ja „luba on antud raha kulutada“; ulatuse ja kulupiiri määras tegija (töölõigu lagi 0,30 USD, see ost kuni 0,03 USD). Seis: **ostetud ja töös.** Serveris töötab korpus v74: indeks `3dff55b3`, 8696 dokumenti, 75 543 lõiku, vestlusplaan `m4-corpus-chat-20261009b.json`. Kulu 0,0189 USD. Mudeliga mõõtmata.

## Probleem

Pärast kahte partiid ([ADR-111](adr-111-state-level-help-first-batch.md), [ADR-112](adr-112-state-level-help-second-batch.md)) ja [vastuste kontrolli](../audits/rag-v2-state-content-check-2026-10-08.md) jäi kaks kohta, kus RAG vastas ainult seadusest või ei vastanud menetluse poolt:

- **Õigusabi, kohus, võlad, ohvri õigused inimese keeles.** Seadused on sees, aga lihtne ametlik selgitus puudus: kes saab riigi õigusabi ja tasuta õigusnõu, mida tähendab lähenemiskeeld, mis õigused on kuriteoohvril, kuidas käib täitemenetlus ja maksejõuetus.
- **Lapse tugi koolis.** Rajaleidja lehed ei sobinud (töötajate nimekirjad, tühjad lehed; ADR-112).

## Otsus

37 ametlikku juhislehte. Loend: `Andmebaasi/register/web_pages_state_help_3.json`; lehed on kaustas `Andmebaasi/veebilehed/`, iga leht oma aadressiga saidikaardi järgi.

| Väljaandja | Lehti | Teemad |
|---|---:|---|
| Justiits- ja Digiministeerium | 30 | riigi toetatud õigusabi, õigusnõu erivajadustega inimestele ja tasuta õigusnõu eakatele; advokaat, notar, kohtutäitur, pankrotihaldur; pärimisregister ja täitmisregister; tsiviilkohtumenetlus ja täitemenetlus; perekonna-, pärimis- ja võlaõigus, miinimumelatis; andmekaitse, avalik teave, haldusmenetlus; maksejõuetus; kuriteoohvrite õigused, lähenemiskeeld, kahjude heastamine; perevägivald, seksuaalne väärkohtlemine, inimkaubandus; vangla ja kriminaalhooldus; lapsesõbralik menetlus |
| Haridus- ja Teadusministeerium | 4 | toe vajadusega õpilased, alusharidus, õppimiskohustus, põhiharidus |
| Haridus- ja Noorteamet | 3 | kaasav haridus, lapsevanema tugi lapsele, lasteaedade ja koolide toimimine |

Välja jäi üks loetud leht (lepitus: 35 sõna, ainult viide edasi).

### Isikuandmed

Salvestatud lehtedel on kaheksa e-posti aadressi, kõik asutuste või teenuste üldaadressid; ühegi nime kõrval ei ole telefoni ega aadressi. Nimesid on tekstis seal, kus leht nimetab ministrit ametis, loengu esinejat, ettekande tegijat või väljaande autorit; töötajate ega teenuseosutajate nimekirju ei ole (sama piir mis ADR-112-s).

## Arvud

| | v73 | v74 | Piir |
|---|---:|---:|---:|
| Dokumente | 8659 | 8696 | 10 000 |
| Lõike | 75 102 | 75 543 | 100 000 |

- Partii: 37 dokumenti, 441 lõiku. Ost: 441 sisendit, 145 529 tokenit, 0,0189 USD (piir 0,03 USD); arvestatud kinnitatud kasutusest, mitte arvelt.
- Ketas: pärast 22 GB vaba (73% kasutusel). Ühist märksõna ega kirjeldust partii dokumentidel ei ole.
- Esimene käivitus läks tegija veana käima enne, kui pakk oli üles laaditud, ja peatus kohe (`ship-v74.tgz ... are needed`); midagi ei ostetud ega muudetud. Teine käivitus läks läbi.

## Kontrollitud

- Proovikorje luges 38 lehte, 7 märgiti ülevaatuseks; õhukeste lehtede tekst loeti läbi, nimed otsiti koodihoidla reegliga ja vaadati ükshaaval.
- Salvestatud failid on need, mis korjaja luges; registri räsid vastavad failidele (3787 kirjet).
- Serveris: ost `complete` (441, teadmata 0); indeks `ready`; vestlusplaani kontroll `ready`; teenus töötab.
- Ühiktestid: 1176, neist 1154 läbi ja 22 vahele jäetud. Koodi selles partiis ei muudetud.

## Kontrollimata

- Vastused mudeliga uute lehtede kohta.
- Lehtede hilisem seis: 330 ametlikku juhislehte kolmest partiist ei ole veel igakuises värskenduses.

## Mis jääb lahti

- Töö kaotus: Töötukassa juhiseid ei saa korjata.
- Lapse arengumure enne kooli (kõne, käitumine, autismi kahtlus): ametlikku teekonda vanemale ei leitud; koolitoe lehed katavad koolis käiva lapse.
- Peaasi ja Tervise Arengu Instituudi abi leidmise lehed.
- Igakuine värskendus uutele lehtedele.
