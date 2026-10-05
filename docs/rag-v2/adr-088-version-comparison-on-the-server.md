# ADR-088 — Akti kahe redaktsiooni sätted võrdleb server

05.10.2026. Teostus Claude Opus 5.5. Omanik 05.10: „teeme need tugevaks“ (viiest tööst neljas: „mis muutub“ ei ole usaldusväärne). Lähtekoht: [ADR-077](adr-077-current-message-only-and-both-versions.md) leid F1.

**Kood on valmis ja kontrollitud mudelita päris indeksi peal (jaotis „Kontroll“). Mudeliga mõõtmata: mida Luna selle plokiga vastab.**

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

## Mõõtmata

- Mida Luna plokiga vastab (töö lõpu jooks, kataloog `scenarios-version-change-1`, mille kontroll `must_not` keelab tähtaega uuena esitada).
- Päris vestluse pööre, kus tõendites on kaks redaktsiooni koos kirjete ja ajakirjade lõikudega.
