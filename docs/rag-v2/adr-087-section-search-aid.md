# ADR-087 — Register võib anda seaduse paragrahvile tavakeelse otsinguabi

05.10.2026. Teostus Claude Opus 5.5. Omanik 05.10: „teeme need tugevaks“ (viiest tööst viies: perekonnaseaduse §-d 96–97 ei tule otsingus kindlalt välja). Lähtekoht: [ADR-079](adr-079-plan-list-duty-query-and-reserved-places.md) mõõtmine ja käsiraamatu S1.0 kirje „otsinguabi seaduse lõigu juurde“.

**Kood ja registrikirje on kontrollitud kohalike testidega. Mõju otsingule on mõõtmata, kuni perekonnaseadus on uue registrikirjega indeksis (korpus v58); mõõtmiskataloog ja ootused on enne jooksu kirjas.**

## Diagnoos (05.10, tasuta: indeks v56/v57, sõnaline kanal, mudelita)

- Perekonnaseaduse §-d 96–107 on igaüks omaette lõik õige pealkirjateega („… > 8. peatükk PÕLVNEMISEST TULENEV ÜLALPIDAMISKOHUSTUS > 1. jagu Üldsätted > § 96. Ülalpidamist andma kohustatud isikud“). Lõikamine ei ole põhjus.
- **Sõnavara ei kattu.** § 96 ütleb „täisealised esimese astme ülenejad ja alanejad sugulased“, § 97 „muu abivajav alaneja või üleneja sugulane“. Inimene ja otsinguplaan räägivad lastest ja vanematest.
- **Sõnaline kanal** (seaduse 227 lõigu seas): mõõdetud pöörde plaanipäringule „Täisealise lapse ülalpidamiskohustus vanema hoolduskulude tasumisel“ on § 96 kohal 81 ja § 97 kohal 102 (sõnu tabas 160 lõiku); ees on lõigud, kus „laps“ ja „vanem“ korduvad (§ 214, § 152, § 143, § 134). Sõnaline järjestus loeb tabamusi ega kaalu haruldast sõna („ülalpidamiskohustus“) sagedasest kõrgemaks; peatüki pealkiri, kus see sõna seisab, ei ole lõigu sõnalises indeksis.
- **Mõõdetud pöörded** ([tõend 1](../audits/evidence/search-assist-8-measured-2026-10-04.json), [tõend 2](../audits/evidence/plan-guard-measured-2026-10-04.json)): seaduse kandidaadid olid §-d 113–118, 132–133, 72 ja 157 (vanema ja lapse õigussuhe, hooldusõigus), mitte ülalpidamise sätted; teise sõnastusega päringule tulid § 97, § 99 ja § 103.
- Vektorkanali kohti ei saa tasuta lugeda (päringuvektoreid ei ole salvestatud).

## Otsus

1. **Registriväli `xml_search_aids`** (Riigi Teataja XML-allikal): paragrahvi number → üks rida tavakeelt selle kohta, millest paragrahv räägib (10–300 märki, üks rida). Väli käib sama teed nagu `xml_sections` ja `xml_units` ([ADR-076](adr-076-act-sections-as-source.md), [ADR-082](adr-082-selected-section-by-subsection.md)).
2. **Kus abi on:** paragrahvi iga lõigu otsingutekstis omaette real pealkirjatee ja teksti vahel (see osa, mida vektor ja eelvalik loevad teksti kõrval) ning sõnalises indeksis lõigu otsinguabide hulgas. **Kus abi ei ole:** lõigu allikatekstis. Vastuse mudel näeb allikateksti; abi ei saa tsiteerida ega tõendina kasutada.
3. **Paragrahv, mida aktis ei ole** (ümber nummerdatud, kehtetu, valikust väljas), on viga (`xml_section_not_found`), mitte vaikne kadu. Akti järgmine redaktsioon saab registris samad abid ([ADR-059](adr-059-corpus-refresh-path.md) rada).
4. **Perekonnaseaduse kolm abi** (`Andmebaasi/REGISTER.json`, `oigusaktid/107052025017.xml`): § 96 (kes peab ülalpidamist andma), § 97 (kellel on õigus seda saada), § 105 (kes annab esimesena). Iga rida algab sõnaga „Tavakeeles:“ ja nimetab seaduse mõistete taga olevad inimesed: vanemad, täisealised lapsed, vanavanemad, lapselapsed.

### Miks nii

- **Üldine mehhanism, allika andmed registris.** Reader ei tunne ühtki akti ega paragrahvi; mis abi mis paragrahv saab, on registri kirje, nagu allika kirjeldus ja märksõnad seni. Käitusaegset erandit allika nime ega oodatud vastuse järgi ei ole.
- **Abi ei muuda seda, mida vastus võib öelda.** Tõendiks on endiselt ainult seaduse tekst.
- **Väike mõjuala.** Abita allikas loetakse nagu enne: perekonnaseaduse 227 lõigust muutub kolme otsingutekst, teiste lõikude tekst ja embedding'u sisend on samad (kohalik võrdlus hoidla versiooniga).

### Mida ei tehtud

- Üldist mõistesõnastikku („üleneja sugulane“ → „vanem“ kõigis aktides) ei ehitatud: see muudaks kõigi selliste aktide lõike ja vajaks eraldi mõõtmist.
- Sõnalise järjestuse kaalumist (haruldane sõna sagedasest ette) ei muudetud: see puudutaks iga küsimust.
- Otsinguplaani juhist ei muudetud.

## Kontroll

- `tests/rag-v2-xml-sections.test.mjs`: abi on lõigu otsinguteksti eesosas ja sõnalises indeksis, allikatekst ja teised lõigud on muutmata; puuduva paragrahvi või vigase abi korral viga; registris olev perekonnaseadus loetakse abidega ja muutub täpselt kolm lõiku.
- `tests/rag-v2-corpus-refresh.test.mjs`: akti järgmine redaktsioon saab samad abid.
- Kohalik võrdlus hoidlaga: ilma abita annab muudetud reader perekonnaseadusele samad 227 lõiku ja samad embedding'u sisendid, mis on korpuses.

## Mõõtmine (kataloog enne jooksu kirjas)

`tests/evaluation/graph/maintenance-duty-1.json`: neli küsimust (kaks mõõdetud pöörete plaanipäringuga, üks inimese oma sõnadega ilma plaanita, üks, mis ei nimeta kohustust ega seadust), igaühel § 96 ja § 97 otsustavad sõnad. Otsingukatse (`scripts/rag-v2-graph-experiment.mjs`, eelvalikuta ja vastuse mudelita) näitab, kas need sõnad jõuavad tõenditesse korpusel v57 (abita) ja korpusel v58 (abidega). Päringutekstide vektorid ostetakse üks kord ja hoitakse alles.

**Enne (korpus v57, abita; 05.10, omaniku loal ost 6 päringuteksti, 142 tokenit, 0,00002 USD):** vestluse otsinguprofiiliga (v6, eelvalikuta, 10 allikat) ei jõudnud § 96 ega § 97 sõnad tõenditesse üheski neljast küsimusest (0/7 otsustavat fraasi). Sama tulemus alusprofiiliga v1.

Tulemus abidega kirjutatakse siia pärast korpust v58.

## Piirid

- Abi on käsitsi kirjutatud rida; selle sõnastuse õigsuse eest vastutab registri toimetaja. Vale abi toob lõigu valede küsimuste juurde, aga ei jõua vastuse tõenditesse.
- Otsingukatse ei kasuta eelvalikut ega üleriigiliste seaduste varukohti; mida Luna vastab, näitab töö lõpu mõõtmisjooks.
