# ADR-088 — Akti kahe redaktsiooni sätted võrdleb server

05.10.2026. Teostus Claude Opus 5.5. Omanik 05.10: „teeme need tugevaks“ (viiest tööst neljas: „mis muutub“ ei ole usaldusväärne). Lähtekoht: [ADR-077](adr-077-current-message-only-and-both-versions.md) leid F1.

**Töös alates #384. Kontrollitud mudelita päris indeksi peal (jaotis „Kontroll“) ja mõõdetud mudeliga (jaotised „Mõõtmine“ ja „Mõõtmine 2“): valla akti puhul jõudis plokk mudelini, vastuse väited peavad paika ja 04.10 olukorras ei esitatud muutumata sätet uuena. Üleriigilise seaduse puhul ei jõudnud muudetud sätted otsingust tõenditesse ja võrdlust ei tehtud; see on lahti.**

## Probleem

Paragrahv lõigatakse lõikudeks pikkuse järgi. Sama säte seisab seetõttu kahes redaktsioonis eri lõikudes: Põhja-Sakala korra § 5 lõige 5 on vanas redaktsioonis paragrahvi teises lõigus ja uues esimeses. 04.10 mõõdetud pöördes valis eelvalik mõlemast redaktsioonist § 5 esimese lõigu ja vastus esitas muutumata lõike 5 uuena. Sama paragrahvi leidmine mõlemast redaktsioonist ei tähenda, et võrreldi sama teksti.

## Otsus

1. **Server loeb redaktsiooni sätete kaupa** (`lib/rag-v2/search/version-comparison.js`): iga paragrahv ja iga lõige paragrahvi oma tekstist, nii nagu Riigi Teataja XML sisestati. Säte kannab tsiteeritavat nime („§ 5 lg 2“, „§ 12“).
2. **Millal võrreldakse:** kui teadmiste otsingu tõendites on lõike ühe akti kahest redaktsioonist. Sama akt tähendab sama pealkirja, väljaandjat, omavalitsust **ja vastuvõtmise kuupäeva**; redaktsioonidel on eri kehtivuse algus. Kui tõendites on üle kahe redaktsiooni, võrreldakse vanimat ja uusimat.
3. **Sätte olek:**
   - `unchanged`: sama number, sama sõnastus;
   - `changed`: sama number, teine sõnastus;
   - `added`: ainult uues;
   - `removed`: ainult vanas või uues kehtetuks tunnistatud (number on alles, tekst on „Kehtetu.“ või tühi);
   - `renumbered`: sama sõnastus sama paragrahvi teise numbri all.
   Sõnastust võrreldakse enne numbrit: paragrahvi keskele lisatud lõige ei tee järgmisi lõikeid „muutunuks“.
   **Täiendus samal päeval (`version-comparison-2`):** paragrahv, mis oli üks tekst ja sai uues redaktsioonis lõiked (või vastupidi), hoiab oma sõnastuse uue numbri all. Enne luges võrdlus sellise paragrahvi „muudetuks“ ja lõike 1 „lisatuks“, kuigi sõnad olid samad: lastekaitseseaduse 01.01.2027 redaktsioonis sai § 11 ainus lause lõikeks 1 (sama § 40¹). Leitud tasuta, enne kui seda seadust mudeliga mõõdeti. Indeksi 41 aktipaarist puudutas see ainult lastekaitseseadust (2 sätet); ristkontroll Riigi Teataja märgetega on endiselt 191/191.
4. **Mudel saab ploki `version_changes`**, mitte sätete teksti:
   - akti kaks redaktsiooni kehtivusega ja tõendilõikude viidetega;
   - `differences`: tõendites olevad sätted, mis erinevad, igaüks viidetega lõikudele, kus vana ja uus sõnastus seisavad;
   - `same_wording`: tõendites olevad sätted, mis on mõlemas redaktsioonis samad, ka siis, kui vana sõnastusega lõiku tõendites ei ole;
   - `not_in_evidence`: mujal aktis erinevate sätete nimed (kuni 40 oleku kohta, üle selle arv).
5. **Dialoogi juhis 26** ütleb, mis plokk on: uueks, muudetuks või eemaldatuks nimetatakse säte ainult ploki järgi, sõnastus võetakse viidatud lõikudest, `same_wording` sätet ei esitata muudatusena ja tõenditest väljas olevate sätete sisu ei kirjeldata.
6. **Plokk on lisa, mitte tõend:** nagu seaduse kuupäevad ([ADR-062](adr-062-provision-dates.md)) on ta väljaspool konteksti mahupiire ja oma ülempiiriga (1500 tokenit). Pööre ei saa ploki pärast nurjuda ega kaota tema pärast ühtki lõiku. Ülempiiri ületav plokk nimetab esmalt vähem tõenditest väljas olevaid sätteid, siis ainult nende arvu; kui ta ikka ei mahu, jäetakse ta saatmata ja vastus tuleb lõikudest nagu enne.
7. Plokk salvestatakse pöörde kirjesse (`version_comparison`).

### Mida ei võrrelda

- **Sama pealkirjaga uus akt** (teine vastuvõtmise kuupäev), mis asendas vana: seal ei tähenda sama number sama sätet. Indeksis on selliseid paare kaks (Tapa ja Kehtna sotsiaalhoolekandelise abi andmise kord).
- **Punktid eraldi:** muutunud punkt teeb muutunuks oma lõike.
- **Lisad ja preambul.**

### Kõrvalleid: lingi sihtkoht seaduse tekstis

Üleriigiliste seaduste tekstis seisab rakendusakti lingi sihtkoht omaette plokina („./dyn=<redaktsiooni number>&id=<akti number>“; 21 aktis 326 kohta). See nimetab redaktsiooni, milles ta seisab, ja erineb seega igas redaktsioonis. Sotsiaalhoolekande seaduse 01.02.2027 ja 01.04.2027 redaktsiooni 46 erinevast lõikest erines 38 ainult selle poolest. Võrdlus jätab sihtkoha sõnastusest välja. **Lugejat ei muudetud:** sihtkoht on endiselt lõikude tekstis ja embedding'u sisendis; selle eemaldamine muudab 21 akti lõike ja vajab eraldi tööd.

## Kontroll

- `tests/rag-v2-version-comparison.test.mjs` (10 testi; loeb Põhja-Sakala kaks redaktsiooni kaustast `Andmebaasi`): sätete lugemine, olekud, 04.10 mõõdetud pöörde tõendid (ainult esimene lõik kummastki redaktsioonist: lõige 5 on `same_wording` all), kehtetuks tunnistatud lõige, lingi sihtkoht, uus akt sama pealkirja all, ülempiir, mahupiiridest väljajäämine.
- Kogu testikomplekt (680 läbis, 0 kukkus), otsinguraja ühendtestid kohalike teenustega (14/14).
- **Päris indeks serveris, mudelita** (05.10, korpus v58, vaba lugemine):
  - Indeksis on 46 akti mitmes redaktsioonis; 41 paari on sama akti redaktsioonid ja võrreldavad, 2 on uued aktid sama pealkirja all, 1 kolme redaktsiooniga aktil on vanim eelmine akt, 2 on lisad ilma paragrahvideta.
  - **Ristkontroll Riigi Teataja muutmismärgetega:** uusima redaktsiooni märked nimetavad 41 aktis 191 sätet, mis redaktsiooni alguspäeval muutusid. Võrdlus leidis erinevusena kõik 191.
  - Võrdlus leidis 279 erinevust; 70-l ei ole märget. Viies aktis vaadati need läbi: akti läbiv sõnaasendus, mida märge iga sätte juures ei nimeta (Põhja-Sakala: „sotsiaaltöötaja“ → „spetsialist“), uue paragrahvi lõiked ja ümber kirjutatud paragrahvid. Kõiki 70 ei vaadatud.
  - 04.10 pöörde tõendid ehitati otsingu oma funktsiooniga uuesti: plokk on 1377 baiti, § 5 lg 5 on `same_wording` all, võrdlus võttis 9 ms.

## Mõõtmine (05.10, omaniku loal; üks pööre, 0,0061 USD)

Kataloog `scenarios-version-change-1` töötaval versioonil `d43f3458` ([tõend](../audits/evidence/strengthening-measured-2026-10-05.json)): „Mis muutub Põhja-Sakala valla sotsiaalabi korras alates 6. oktoobrist?“ Pööre läbis kataloogi kõik kontrollid.

- **Plokk jõudis mudelini** (pöörde kirjest loetud): üks akt, 1897 baiti; üheksa tõendites olevat sätet erinevana (§ 3 lg 1–2, § 4 lg 2 ja lisatud lg 6, § 5 lg 1, 3, 4, § 6 lg 2 ja 4), viisteist samana, nende seas § 5 lg 5.
- **Vastus** nimetas muudatused §-des 3–6 ja ei esitanud lõiget 5 muudatusena. Väited selle kohta, mis erineb, võrdlesin mõlema redaktsiooni tekstiga: peavad paika (sh § 5 lg 3 p 4: püsiväljaminekute asemel eluasemekulud, tõendid soovitusliku asemel nõutavad; uus § 4 lg 6).
- **§ 6 lg 2 ja 4:** vana sõnastusega lõiku tõendites ei olnud (plokk andis ainult uue lõigu viite). Vastus kirjeldas uut sõnastust ja ütles lõpus, et ei saa neid lõikeid varasemaga võrrelda. Tegelik erinevus on seal üks sõna („sotsiaaltöötaja“ → „spetsialist“).
- **Nõrk koht, mis jääb:** muudetud sätte uut sõnastust kirjeldades ei ütle vastus alati, mis täpselt teisiti on (§ 3 lg 1 puhul muutus sõnastus, sisu mitte). Plokk ütleb „muutus“, mitte „kuidas“.
- **Teine pööre samal päeval** (versioon `3e2ac388`, 0,0060 USD, [tõend](../audits/evidence/contact-directory-measured-2026-10-05.json)): läbis. Vastus ütles iga muudatuse kujul „varem … nüüd“ ja abivajaduse hindamise kohta, et vaadatakse endiselt samu asjaolusid; muutumata sätet uuena ei esitatud.
- **Parandus varasemale väitele:** kirjutasin siia, et 04.10 olukord (muutumata säte tõendites ainult ühe redaktsiooni lõigus) nendes pööretes ei kordunud. § 5 kohta see kehtib, aga esimese pöörde kirjest uuesti arvutades oli sama olukord §-s 6: selle pealkiri ning lõiked 1 ja 3 on mõlemas redaktsioonis samad ja tõendites oli ainult uue redaktsiooni lõik. Vastus neid uuena ei esitanud.

## Mõõtmine 2 (05.10 õhtu, omaniku korraldus „tee teised mõõtmised“; versioon `add0624c`, `version-comparison-2`)

Kataloog `scenarios-strengthening-2` (kirjutatud enne jooksu), [tõend](../audits/evidence/open-points-measured-2026-10-05.json).

- **04.10 olukord, mõõdetud** („Milliseid dokumente tuleb Põhja-Sakala vallas alates 6. oktoobrist sissetulekust sõltuva toetuse taotlusele lisada ja mis selles muutub?“; läbis, 0,0061 USD). Eelvalik hoidis kummastki redaktsioonist ühe lõigu, nii et § 5 lg 5 seisis ainult uue redaktsiooni lõigus, täpselt nagu 04.10. Plokk nimetas lõike 5 samade sätete all. Vastus ütles tegeliku muudatuse (tõendid kohustuslikuks, püsiväljaminekute asemel eluasemekulud) ega esitanud tähtaega uuena.
- **Üleriigiline seadus ei jõudnud võrdluseni** („Mis muutub lastekaitseseaduses alates 1. jaanuarist 2027?“; kukkus otsingus, 0,0045 USD).
  - Seaduse kahest redaktsioonist oli kandidaatide seas 11 lõiku, aga kõik olid rakendussätted (§-d 41–47: kohaldamine, jõustumine). Plaani päring „Lastekaitseseaduse muudatused jõustuvad 1. jaanuaril 2027“ leiab sätted, mis räägivad jõustumisest, mitte sätted, mis muutuvad (§ 29, § 36¹ jt).
  - Eelvalik valis kuus lõiku eelnõu tutvustavast artiklist. Tõendites ei olnud seaduse lõike, seega võrdlust ei tehtud.
  - Vastus kirjeldas eelnõu ja ütles, et ei saa kinnitada, kas see vastu võeti, kuigi 1. jaanuarist 2027 kehtiv redaktsioon on indeksis.
  - **Järeldus:** pika seaduse puhul ei too tähenduse järgi otsing muudetud sätteid kandidaatideks. Server teab, millised sätted erinevad (see võrdlus ja Riigi Teataja muutmismärked); need tuleb tuua kandidaatideks otsingu ajal. See on eraldi töö.

## Mõõtmata ja lahti

- **Muudetud sätted kandidaatideks** „mis muutub“ küsimuses, kui küsitud päeval algab akti uus redaktsioon (vt eelmine jaotis). Kuni selleni töötab võrdlus siis, kui otsing muudetud sätted ise leiab (lühike akt).
- Pööre, kus tõendites on üleriigilise seaduse kaks redaktsiooni, on seetõttu mudeliga mõõtmata.
