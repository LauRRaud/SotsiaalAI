# ADR-091 — Muudetud sätete lõigud jõuavad „mis muutub“ küsimuse kandidaatide hulka

05.10.2026. Teostus Claude Opus 5.5. Omanik 05.10: „Too muudetud sätted 'mis muutub' küsimuse kandidaatideks“. Lähtekoht: [ADR-088](adr-088-version-comparison-on-the-server.md) jaotis „Mõõtmine 2“.

**Töös alates #392 (05.10.2026 õhtul), kolmas versioon `version-change-places-3` alates sellest PR-ist. Mõõdetud mudeliga kaks korda (jaotised „Mõõtmine“ ja „Mõõtmine 2“, kokku 5 pööret, 0,0290 USD): kolm pööret läbisid, lastekaitseseaduse pööre kukkus mõlemal korral. Esimesel korral ei jõudnud § 29 vana lõik kandidaatide hulka (parandatud: rühm paragrahvi kaupa). Teisel korral oli see kandidaatide seas, aga valik ei jätnud seda alles (parandatud: server lisab alles jäetud paragrahvi teise redaktsiooni ise). Viimane parandus on kontrollitud tasuta kordusega mudeli enda valikuga; mudeliga mõõtmata.**

## Probleem

Mõõdetud 05.10.2026 küsimusega „Mis muutub lastekaitseseaduses alates 1. jaanuarist 2027?“:

- seaduse lõikudest olid valiku kandidaatide seas ainult rakendussätted (§ 41, 41², 41³, 42, 46, 47) ja § 33;
- § 29, mille muudatus ümber kirjutas, ei olnud kandidaatide seas kummaski redaktsioonis;
- valik jättis alles artikli eelnõu kohta; tõendites ei olnud seaduse kahte redaktsiooni, seega serveri võrdlust (ADR-088) ei tehtud.

Põhjus on otsingus, mitte valikus. Küsimus ei nimeta teemat: ükski selle sõna ei sarnane muudetud sätetega rohkem kui ülejäänud seadusega. Seda, millised sätted erinevad, teab ainult redaktsioonide võrdlus, aga see tehti pärast otsingut ja ainult nende lõikude kohta, mis tõenditesse jõudsid.

## Otsus

1. **Signaal.** Küsimus nimetab ühe päeva (sama märk, mille järgi kehtivuse filter võtab kaasa eelmise päeva, [ADR-077](adr-077-current-message-only-and-both-versions.md)) ja teadmiskanalisse jäänud dokumentide seas on akt, mille redaktsioon algab sel päeval, ning sama akti redaktsioon, mis lõppes eelmisel päeval. Sama akt tähendab sama pealkirja, andjat, omavalitsust ja vastuvõtmise päeva, nagu ADR-088-s.
2. **Server võrdleb need kaks redaktsiooni enne otsingut** sätete kaupa (ADR-088 võrdlus, `rag-v2/version-comparison-2`) ja leiab iga erineva sätte lõigud:
   - muudetud säte: lõigud mõlemas redaktsioonis;
   - lisatud säte: lõigud uues redaktsioonis;
   - kehtetuks tunnistatud säte: lõigud vanas redaktsioonis.
   Ümber nummerdatud ja sama sõnastusega säte ei ole erinevus.
   **Üks rühm on ühe paragrahvi erinevate sätete lõigud mõlemas redaktsioonis** (`version-change-places-2`). Kummastki redaktsioonist võetakse paragrahvi kohta kuni kaks esimest sellist lõiku. Esimene versioon tegi rühma iga sätte kohta eraldi; miks see ei sobinud, on jaotises „Mõõtmine“.
3. **Need lõigud saavad valiku kandidaatide seas oma kohad** (`VERSION_CHANGE_RESERVE`, 8 kohta). Nad otsitakse omavahel läbi sama küsimuse ja samade plaanipäringutega (sõnaline ja vektorotsing, sama liitmine) ning parimad rühmad lisatakse kandidaatide lõppu.
   - Rühm tuleb tervikuna või üldse mitte: sama paragrahv mõlemas redaktsioonis.
   - Rühm, mis enam ei mahu, jäetakse vahele; järgmine väiksem võib veel tulla.
   - Lõik, mis on juba kandidaatide seas, ei võta teist kohta.
4. **Server lisab alles jäetud paragrahvi teise redaktsiooni ise** (`version-change-places-3`). Kui valik jätab alles lõigu, mis kuulub mõnda rühma, lisab server sama rühma ülejäänud lõigud tõendite hulka pärast valiku enda lõike.
   - Valiku enda lõigud jäävad kõik alles; lisatav lõik saab koha ainult seal, kus lõigupiir ja mahupiir seda lubavad.
   - Lisatud lõik on tõendis märgitud (`version_counterpart`) koos lõiguga, mille pärast ta lisati; pöörde kirjes on `change_completed`.
   - Kui valik ei olnud saadaval, ei lisata midagi.
   Põhjus on jaotises „Mõõtmine 2“: valik luges 44 lõiku ja jättis ümber kirjutatud paragrahvist alles ainult uue redaktsiooni, kuigi vana oli talle pakutud. Millised lõigud kuuluvad kokku, teab server; mudel peaks selle 44 lõigu tekstist ise välja lugema.
5. **Kandidaate on nüüd kuni 44** (30 üldist, 6 üleriigilise seaduse varukohta, 8 muudetud sätete kohta). Enne oli kuni 36.
6. **Prompte ei muudetud.** Valiku juhis (`search-assist-8`) ütleb juba, et erineva sätte kohta tuleb alles jätta mõlema redaktsiooni lõik. Vastuse juhis (dialoog 27) ja võrdluse plokk `version_changes` jäävad samaks.
7. **Pöörde kirjes** on näha, mida tehti: `searchAssist.changePlaces` (võrreldud aktid, rühmade arv, kandidaatideks lisatud lõigud, serveri lisatud teise redaktsiooni lõigud), otsingu ajakirjes samm `version_changes`, lisatud lõigu valikukirjes kanalid `change_lexical` ja `change_vector`.

## Mida see ei tee

- Ilma päevata küsimus („mis on viimasel ajal muutunud?“) ja vahemikuga küsimus ei käivita midagi.
- Päev, mil ükski alles jäänud redaktsioon ei alga: midagi ei loeta ega võrrelda.
- Kehtivuse filter, omavalitsuse filter ja üleriigilise seaduse varukohad ([ADR-032](adr-032-national-law-reserve-and-plan-restart.md), [ADR-079](adr-079-plan-list-duty-query-and-reserved-places.md)) on samad.
- Ilma valikuta (otsinguabi väljas) ja tervituse puhul ei võrrelda midagi.
- Piirid: kuni 8 akti ühe pöörde kohta, kuni 1000 rühma.

## Kontroll

**Testid** (`tests/rag-v2-version-change-places.test.mjs`, `tests/rag-v2-pool-reserve.test.mjs`): lastekaitseseaduse kaks redaktsiooni Andmebaasist (Riigi Teataja enda baidid). 32 erinevat sätet annavad 15 rühma, ühe iga paragrahvi kohta; § 29 rühmas on uue redaktsiooni kaks lõiku ja vana üks; lisatud § 36¹ on ainult uues. Midagi ei loeta, kui päeval ei alga redaktsiooni, kui eelmine redaktsioon puudub või kui akt on teine (pealkiri, andja, omavalitsus, vastuvõtmise päev). Otsingus tuleb rühm tervikuna, mittemahtuv jäetakse vahele, juba kandidaatide seas olev lõik ei kordu, ilma valikuta midagi ei lisata.

**Serveris, tasuta, esimene versioon (rühm sätte kaupa)** (05.10.2026 õhtul, korpus v59, töötav väljalase `ba4e529c` pluss muudetud failid kõrvalkaustas). Mõõdetud pöörete salvestatud küsimusevektoriga jooksis vestluse enda otsing uuesti; mudelit ega embedding'ut ei kutsutud. Valiku asemel oli asendus, mis ainult salvestab kandidaadid.

| Pööre | Väljalaske kood | Muudetud kood |
|---|---|---|
| „Mis muutub lastekaitseseaduses alates 1. jaanuarist 2027?“ | 36 kandidaati; seadusest §-d 41, 41², 41³, 42, 46, 47, 33 | 44 kandidaati; lisandusid § 29, § 38 ja § 18 (igaüks mõlemas redaktsioonis), § 28 ja § 15 (uues) |
| „Mis muutub Põhja-Sakala valla sotsiaalabi korras alates 6. oktoobrist?“ | 36 kandidaati, korrast 20 lõiku | 44 kandidaati, korrast 28 lõiku |

- Lastekaitseseaduse pööre jooksis tabelis ilma plaanipäringuta, valla pööre plaanipäringu sõnadega (ilma selleta ei otsusta server omavalitsust). Lastekaitseseaduse pööre plaanipäringu sõnadega andis samuti 44 kandidaati: § 29 (uues kaks lõiku, vanas üks), § 38 (mõlemas), § 28, § 15 ja § 40¹ (uues).
- 1. jaanuaril 2027 algab indeksis nelja üleriigilise seaduse redaktsioon. Server võrdles kõiki nelja: sotsiaalhoolekande seadus (2 rühma), lastekaitseseadus (19), riigilõivuseadus (20), haldusmenetluse seadus (2). Kaheksa kohta läksid lastekaitseseadusele, sest küsimus nimetab seda.
- Kui asendus jätab lisatud lõigud alles, loetleb ADR-088 võrdlus lastekaitseseaduse 32 erinevast sättest 20 koos lõikudega (§ 29 lg 1–5 muudetud, mõlema redaktsiooni lõik olemas; lg 6–12 lisatud; lg 3¹ kehtetu) ja nimetab ülejäänud 12 nime järgi.
- Aeg: võrdlus võttis nelja seaduse puhul 223–259 ms ja ühe valla akti puhul 30–34 ms (äsja käivitatud protsessis). Otsingu koguaeg jäi samaks (3,5–4,8 s äsja käivitatud protsessis mõlema koodiga).
- **Korduse piir:** plaanipäringute vektoreid pöörde kirjes ei ole, nende asemel oli küsimuse vektor. Sõnaline otsing ja omavalitsuse otsus olid nagu päris pöördes.

## Mõõtmine (05.10.2026 õhtul, omaniku luba: 4 pööret, ülempiir 0,05 USD)

Kataloog `scenarios-version-change-places-1` (kirjutatud enne jooksu), väljalase `491de89e`, korpus v59. **Kulu 0,0234 USD** plaani hindade järgi. [Tõend](../audits/evidence/version-change-places-measured-2026-10-05.json), kontaktisikute nimedeta.

| Pööre | Tulemus | Lisatud 8 lõigust jäi valikusse | Võrdluse plokk |
|---|---|---|---|
| Lastekaitseseadus, 1. jaanuar 2027 | **kukkus otsingus** | 3 (kõik uuest redaktsioonist) | puudus |
| Puuetega inimeste sotsiaaltoetuste seadus, 1. veebruar 2027 | läbis | 6 (kolm paragrahvi mõlemas redaktsioonis) | kõik 10 erinevat sätet, 5 mõlema redaktsiooni lõiguga |
| Põhja-Sakala kord, 6. oktoober | läbis (nagu enne) | 2 (§ 7 mõlemas redaktsioonis) | 13 erinevust, 9 mõlema redaktsiooni lõiguga |
| Kontroll: vaide tähtaeg, otsus 1. jaanuaril 2027 | läbis | 0 | puudus, nagu peab |

- **Puuetega inimeste sotsiaaltoetuste seadus: täielik vastus.** Vastus ütleb, et lapse vanusepiir tõuseb 16-lt 18-le kõigis kolmes kohas (puude raskusastme tuvastamine, selle kestus, puudega lapse toetus), et toetuse summad on võrreldud redaktsioonides samad, ja kirjeldab üleminekusätet § 25⁴. Kontrollisin väited akti kahe redaktsiooni teksti vastu: peavad paika. Enne ADR-091 seda pööret ei mõõdetud.
- **Lastekaitseseadus: vastus paranes, aga pööre kukkus.** Vastus kirjeldab nüüd seaduse enda uut § 29 ja § 28 (juhtumikorralduse algatamine, eelhindamine, kahe kuu tähtaeg) ja viitab seadusele. Eelmises mõõtmises kirjeldas vastus eelnõu ja ütles, et ei tea, kas see vastu võeti. Kukkus see, et tõendites oli ainult uus redaktsioon: võrdlust ei tehtud ja vastus ütleb, et ei saa kõiki muudatusi loetleda.
  - **Põhjus, loetud pöörde kirjest (lisatud lõigud ja nende järjekord) ja rühmade loogikast:** rühm oli iga sätte kohta eraldi ja ühe paragrahvi lõiked kattusid. Lisatud § 29 lg 6 ulatub uue redaktsiooni kahte lõiku; see rühm tõi § 29 esimese lõigu sisse üksi. Muudetud lõigete 1–5 rühmale (sama lõik pluss vana redaktsiooni lõik) ei jäänud siis enam kohta. Valik jättis alles need kolm uue redaktsiooni lõiku, mis talle pakuti.
  - Kahe teise paragrahvi puhul (§ 38, § 21) pakuti mõlemad redaktsioonid ja valik ei jätnud kumbagi alles. Valik võttis selle, mis küsimusega kõige rohkem haakub.
  - **Parandus (`version-change-places-2`):** üks rühm paragrahvi kohta. Tasuta kordus samal pöördel (salvestatud vektor, mudelit kutsumata): kandidaatideks tulevad § 29 (uues kaks lõiku, vanas üks), § 15 (uues kaks, vanas üks), § 28 ja § 40¹ (uues). Kui asendus jätab need alles, on võrdluse plokis § 29 lg 1–5 mõlema redaktsiooni lõiguga.
- **Kontrollküsimus:** lisatud kaheksa lõiku (lastekaitseseadus, riigilõivuseadus, haldusmenetluse seadus) ei seganud. Valik jättis alles ühe lõigu, haldusmenetluse seaduse § 75, ja vastus ütleb 30 päeva.
- **Aeg:** võrdluse samm võttis esimeses pöördes 281 ms (neli seadust), järgmistes 21–36 ms.

## Mõõtmine 2 (05.10.2026 õhtul, omaniku luba: 1 pööre, ülempiir 0,01 USD)

Sama kataloogi esimene küsimus pärast paragrahvi kaupa rühmi (väljalase `f60b7c27`, `version-change-places-2`). **Kulu 0,0056 USD.** [Tõend](../audits/evidence/version-change-places-remeasured-2026-10-05.json).

- **Kukkus uuesti otsingu kontrollis, aga põhjus on nüüd valikus.** Kandidaatide seas olid § 29 uue redaktsiooni kaks lõiku ja vana redaktsiooni lõik, § 15 (uues kaks, vanas üks), § 28 ja haldusmenetluse seaduse § 111¹. Valik jättis alles § 29 uue redaktsiooni kaks lõiku, § 28 ja viis lõiku eelnõu tutvustavast artiklist. § 29 vana redaktsiooni lõiku ta alles ei jätnud.
- Vastus kirjeldab uut korda täpsemalt kui esimesel korral (juhtumikorralduse algatamine, kümne päeva ja kahe kuu tähtajad, üleandmine teisele omavalitsusele), aga võrdlust varasemaga ei ole ja vastus ütleb, et kõiki muudatusi ta loetleda ei saa.
- Valiku juhis ütleb, et erineva sätte kohta tuleb alles jätta mõlema redaktsiooni lõik. Teises kahes pöördes (puuetega inimeste sotsiaaltoetuste seadus, Põhja-Sakala kord) valik nii ka tegi, selles mitte. Juhisele üksi ei saa seega loota.
- **Parandus (`version-change-places-3`, Otsuse punkt 4):** server lisab alles jäetud paragrahvi teise redaktsiooni ise.

**Tasuta kordus mudeli enda valikuga** (korpus v59, väljalase `f60b7c27` pluss muudetud failid kõrvalkaustas; asendus jätab alles täpselt need lõigud, mille mudel mõõdetud pöördes alles jättis):

| Pööre | Server lisas | Võrdluse plokk enne | Võrdluse plokk nüüd |
|---|---|---|---|
| Lastekaitseseadus (Mõõtmine 2 valik) | 1 lõik: § 29 vana redaktsioon | puudus | 15 erinevust, § 29 lg 1–5 mõlema redaktsiooni lõiguga |
| Põhja-Sakala kord (Mõõtmine valik) | 4 lõiku: § 4 ja § 6 vana redaktsioon, § 7 teised lõigud | 13 erinevust, 9 mõlema redaktsiooni lõiguga | 14 erinevust, 13 mõlema redaktsiooni lõiguga |
| Puuetega inimeste sotsiaaltoetuste seadus (Mõõtmine valik) | 0 | kõik 10 erinevust | sama |
| Kontrollküsimus (Mõõtmine valik) | 0 | puudus | puudus |

Valla akti pöördes ütles mõõdetud vastus, et § 4 lõike 2 ja § 6 varasemat sõnastust tal võrdluseks ei ole; need on nüüd tõendites. Kõik mudeli valitud lõigud jäid alles.

## Lahti

- **Kolmas versioon on mudeliga mõõtmata.** Tasuta kordus näitab, et lastekaitseseaduse pöördes on § 29 mõlemad redaktsioonid tõendites ja võrdluse plokk olemas. Nägemata on vastus. Üks pööre, vajab omaniku luba.
- **Kaheksa kohta on kaks kuni neli paragrahvi mõlemas redaktsioonis.** Lastekaitseseaduses erineb 15 paragrahvi. Ülejäänud nimetab võrdluse plokk nime järgi (`not_in_evidence`), sisu neist vastus ei saa. Kohtade arv on seadistus, mida mõõtmine võib muuta.
- **Rühmade järjekord tuleb küsimuse sarnasusest.** Teemata küsimuse puhul ei ütle see, milline muudatus on tähtsam.
- **Valik eelistab artiklit seaduse lõikudele** (lastekaitseseaduse pöördes viis lõiku kaheksast). Serveri lisatud lõigud seda ei muuda.
- **Lisatud lõigud suurendavad konteksti:** valla akti pöördes 9 lõigult 13-le. Mahupiir (10 000 tokenit teadmiskanalile) kehtib endiselt.
