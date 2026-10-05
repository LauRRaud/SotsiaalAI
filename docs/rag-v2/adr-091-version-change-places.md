# ADR-091 — Muudetud sätete lõigud jõuavad „mis muutub“ küsimuse kandidaatide hulka

05.10.2026. Teostus Claude Opus 5.5. Omanik 05.10: „Too muudetud sätted 'mis muutub' küsimuse kandidaatideks“. Lähtekoht: [ADR-088](adr-088-version-comparison-on-the-server.md) jaotis „Mõõtmine 2“.

**Töös alates sellest PR-ist. Kontrollitud testidega ja serveris tasuta kordusega (jaotis „Kontroll“). Mudeliga mõõtmata: seda, kas valik jätab lisatud lõigud alles ja kas vastus loetleb muudatused õigesti, ei ole veel nähtud.**

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
   Ümber nummerdatud ja sama sõnastusega säte ei ole erinevus. Samades lõikudes seisvad sätted on üks rühm. Pikast sättest võetakse kummastki redaktsioonist kuni kaks esimest lõiku.
3. **Need lõigud saavad valiku kandidaatide seas oma kohad** (`VERSION_CHANGE_RESERVE`, 8 kohta). Nad otsitakse omavahel läbi sama küsimuse ja samade plaanipäringutega (sõnaline ja vektorotsing, sama liitmine) ning parimad rühmad lisatakse kandidaatide lõppu.
   - Rühm tuleb tervikuna või üldse mitte: sama säte mõlemas redaktsioonis.
   - Rühm, mis enam ei mahu, jäetakse vahele; järgmine väiksem võib veel tulla.
   - Lõik, mis on juba kandidaatide seas, ei võta teist kohta.
4. **Kandidaate on nüüd kuni 44** (30 üldist, 6 üleriigilise seaduse varukohta, 8 muudetud sätete kohta). Enne oli kuni 36.
5. **Prompte ei muudetud.** Valiku juhis (`search-assist-8`) ütleb juba, et erineva sätte kohta tuleb alles jätta mõlema redaktsiooni lõik. Vastuse juhis (dialoog 27) ja võrdluse plokk `version_changes` jäävad samaks.
6. **Pöörde kirjes** on näha, mida tehti: `searchAssist.changePlaces` (võrreldud aktid, rühmade arv, lisatud lõigud), otsingu ajakirjes samm `version_changes`, lisatud lõigu valikukirjes kanalid `change_lexical` ja `change_vector`.

## Mida see ei tee

- Ilma päevata küsimus („mis on viimasel ajal muutunud?“) ja vahemikuga küsimus ei käivita midagi.
- Päev, mil ükski alles jäänud redaktsioon ei alga: midagi ei loeta ega võrrelda.
- Kehtivuse filter, omavalitsuse filter ja üleriigilise seaduse varukohad ([ADR-032](adr-032-national-law-reserve-and-plan-restart.md), [ADR-079](adr-079-plan-list-duty-query-and-reserved-places.md)) on samad.
- Ilma valikuta (otsinguabi väljas) ja tervituse puhul ei võrrelda midagi.
- Piirid: kuni 8 akti ühe pöörde kohta, kuni 1000 rühma.

## Kontroll

**Testid** (`tests/rag-v2-version-change-places.test.mjs`, `tests/rag-v2-pool-reserve.test.mjs`): lastekaitseseaduse kaks redaktsiooni Andmebaasist (Riigi Teataja enda baidid). 32 erinevat sätet annavad 19 rühma; § 29 esimesed lõiked on kummaski redaktsioonis ühes lõigus; lisatud § 36¹ on ainult uues, kehtetu § 29 lg 3¹ ainult vanas. Midagi ei loeta, kui päeval ei alga redaktsiooni, kui eelmine redaktsioon puudub või kui akt on teine (pealkiri, andja, omavalitsus, vastuvõtmise päev). Otsingus tuleb rühm tervikuna, mittemahtuv jäetakse vahele, juba kandidaatide seas olev lõik ei kordu, ilma valikuta midagi ei lisata.

**Serveris, tasuta** (05.10.2026 õhtul, korpus v59, töötav väljalase `ba4e529c` pluss muudetud failid kõrvalkaustas). Mõõdetud pöörete salvestatud küsimusevektoriga jooksis vestluse enda otsing uuesti; mudelit ega embedding'ut ei kutsutud. Valiku asemel oli asendus, mis ainult salvestab kandidaadid.

| Pööre | Väljalaske kood | Muudetud kood |
|---|---|---|
| „Mis muutub lastekaitseseaduses alates 1. jaanuarist 2027?“ | 36 kandidaati; seadusest §-d 41, 41², 41³, 42, 46, 47, 33 | 44 kandidaati; lisandusid § 29, § 38 ja § 18 (igaüks mõlemas redaktsioonis), § 28 ja § 15 (uues) |
| „Mis muutub Põhja-Sakala valla sotsiaalabi korras alates 6. oktoobrist?“ | 36 kandidaati, korrast 20 lõiku | 44 kandidaati, korrast 28 lõiku |

- Lastekaitseseaduse pööre jooksis tabelis ilma plaanipäringuta, valla pööre plaanipäringu sõnadega (ilma selleta ei otsusta server omavalitsust). Lastekaitseseaduse pööre plaanipäringu sõnadega andis samuti 44 kandidaati: § 29 (uues kaks lõiku, vanas üks), § 38 (mõlemas), § 28, § 15 ja § 40¹ (uues).
- 1. jaanuaril 2027 algab indeksis nelja üleriigilise seaduse redaktsioon. Server võrdles kõiki nelja: sotsiaalhoolekande seadus (2 rühma), lastekaitseseadus (19), riigilõivuseadus (20), haldusmenetluse seadus (2). Kaheksa kohta läksid lastekaitseseadusele, sest küsimus nimetab seda.
- Kui asendus jätab lisatud lõigud alles, loetleb ADR-088 võrdlus lastekaitseseaduse 32 erinevast sättest 20 koos lõikudega (§ 29 lg 1–5 muudetud, mõlema redaktsiooni lõik olemas; lg 6–12 lisatud; lg 3¹ kehtetu) ja nimetab ülejäänud 12 nime järgi.
- Aeg: võrdlus võttis nelja seaduse puhul 223–259 ms ja ühe valla akti puhul 30–34 ms (äsja käivitatud protsessis). Otsingu koguaeg jäi samaks (3,5–4,8 s äsja käivitatud protsessis mõlema koodiga).
- **Korduse piir:** plaanipäringute vektoreid pöörde kirjes ei ole, nende asemel oli küsimuse vektor. Sõnaline otsing ja omavalitsuse otsus olid nagu päris pöördes.

## Lahti

- **Mudeliga mõõtmata.** Näha on, et lõigud jõuavad kandidaatide hulka. Nägemata on, kas valik jätab need alles ja kas vastus loetleb muudatused. Mõõtmine vajab omaniku luba.
- **Kaheksa kohta on umbes neli sätet mõlemas redaktsioonis.** Lastekaitseseaduses erineb 32 sätet. Ülejäänud nimetab võrdluse plokk nime järgi (`not_in_evidence`), sisu neist vastus ei saa. Koha arv on seadistus, mida mõõtmine võib muuta.
- **Rühmade järjekord tuleb küsimuse sarnasusest.** Teemata küsimuse puhul ei ütle see, milline muudatus on tähtsam.
- **Märge lõigul** („see lõik sisaldab erinevat sätet“) koos valiku juhise uue versiooniga on kaalutud ja edasi lükatud, kuni mõõtmine näitab, et valik lisatud lõike ei kasuta.
