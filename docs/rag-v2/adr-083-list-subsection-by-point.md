# ADR-083 — Loeteluga lõige loetakse punktide kaupa (`xml_units: "point"`)

04.10.2026. Teostus Claude Opus 5.5. Omanik 04.10 õhtul: „sa toimeta edasi, kuni vigu ei ole. võid teha teste, raha pole probleem.“ Täiendab [ADR-082](adr-082-selected-section-by-subsection.md).

**Mõõtmata selle kirjutamise hetkel.** Tõend on kohalikud testid hoidla failiga. Korpuse täiendus v51 ja mõõtmine tehakse pärast avaldamist ning lisatakse jaotisesse „Mõõtmine“.

## Probleem

ADR-082 järel (korpus v50) ei saanud toimetulekupiiri lõige ikka kandidaadiks: riigieelarve seaduse § 2 lõige 5 on kuue määraga loetelu ja toimetulekupiir on selles viies, nelja erihoolekande omaosaluse järel. Mõõdetud pöördes valiti selle akti kandidaadiks lõige 4 (töötutoetuse päevamäär).

## Otsus

Registrivälja `xml_units` teine väärtus **`"point"`**: valitud paragrahv loetakse lõigete kaupa (nagu `"subsection"`), ja lõige, mis on loetelu, punktide kaupa.

- **Loetelu** on lõige, mis lõpeb oma punktidega ja kus neid on vähemalt kaks. Lõige, mille punktide järel on veel teksti, või ühe punktiga lõige jääb üheks üksuseks.
- **Iga punkt on oma üksus.** Lõike avasõnad („(5) Sotsiaalhoolekande seaduse alusel kehtestatavad määrad on järgmised:“) on punktide pealkiri, st iga lõigu teekonnas. Nii ütleb lõik, millise seaduse määr see on.
- Täielikult kehtetu punkt jäetakse välja; selle märkus läheb tekstiväliste märkuste loetellu. Punkti märkus jääb oma punkti juurde.
- Ilma väljata ja väärtusega `"subsection"` loetakse nagu enne.

### Tulemus riigieelarve seaduse § 2 jaoks

27 üksust ja 27 lõiku: viis loetelu (5, 6, 8 ja 3 punkti ning lõige 1 viie punktiga) ja neli üksikut lõiget. Summaga lõik:

> 2026. aasta riigieelarve seadus > § 2. Seadustest tulenevate määrade ja piirsummade kehtestamine > (5) Sotsiaalhoolekande seaduse alusel kehtestatavad määrad on järgmised:
>
> 5) seaduse § 131 lõike 3 alusel kehtestatav üksi elava isiku või perekonna esimese liikme toimetulekupiir 220 eurot kalendrikuus;

### Teostus

- `lib/rag-v2/text-source.js`: `xmlUnits` lubab väärtust `"point"`; `xmlRecords` loeb loetelu punktid.
- `Andmebaasi/REGISTER.json`: riigieelarve seaduse kirje väli on nüüd `"point"`. Sama fail saab uue redaktsiooni (korpus v51).

## Kontrollid

- `tests/rag-v2-xml-sections.test.mjs`: riigieelarve seaduse § 2 punktide kaupa (üksuste arv lõigete kaupa, summaga lõik on üks punkt oma pealkirjaga, loeteluta lõige jääb terveks, tekstist ei lähe midagi kaduma); väljamõeldud akt (kehtetu punkt, punktide järel tekst, ühe punktiga lõige, märkus punkti juures).

## Piirid

- **Leidmine on endiselt otsingu teha;** seda näitab mõõtmine.
- Punkti lõik on lühike. Vastuse jaoks vajalikud osakaalud (80% ja 120%) on sotsiaalhoolekande seaduses, mitte siin.
- Loetelu alapunkte (punkti sees) eraldi ei loeta.

## Mõõtmine

Tegemata selle kirjutamise hetkel; lisatakse pärast korpuse täiendust v51.
