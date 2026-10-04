# ADR-083 — Loeteluga lõige loetakse punktide kaupa (`xml_units: "point"`)

04.10.2026. Teostus Claude Opus 5.5. Omanik 04.10 õhtul: „sa toimeta edasi, kuni vigu ei ole. võid teha teste, raha pole probleem.“ Täiendab [ADR-082](adr-082-selected-section-by-subsection.md).

**Mõõdetud korpusel v51: üks pööre, läbis** (jaotis „Mõõtmine“). Summaga punkt sai kandidaadiks, valiti ja vastus viitab sellele.

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

## Mõõtmine (04.10.2026, korpus v51)

- **Korpus v51:** riigieelarve seaduse § 2 uus redaktsioon (27 üksust ja lõiku). Ostetud 22 sisendit (viis lõiku olid v50-st olemas), 3984 tokenit, 0,0005 USD (usage `pilot_8eeb9095…`); indeks `74639553` (6474 dokumenti, 40 638 lõiku), plaan `/etc/sotsiaalai/m4-corpus-chat-20261004d.json`.
- **Üks pööre** („Kui suur on toimetulekupiir ja kuidas toimetulekutoetust arvutatakse?“, 0,0058 USD): **läbis, 7 kontrolli 7-st.** [Tõendifail](../audits/evidence/corpus-v51-measured-2026-10-04.json).
- Riigieelarve seadusel oli kaks kandidaati: lõige 4 (nagu v50-s) ja toimetulekupiiri punkt oma pealkirjaga. Eelvalik hoidis punkti; vastus viitab riigieelarve seadusele ja sotsiaalhoolekande seadusele.
- Vastus: 220 eurot (punkti enda tekst), 176 ja 264 eurot (80% ja 120%, sotsiaalhoolekande seaduse osakaalud), kahe täiskasvanu kohta 396 eurot (vastuse enda liitmine).
- Sama küsimus ei läbinud tund varem korpusel v50 peaaegu sama päringuga („toimetulekupiiri suurus ja toimetulekutoetuse arvutamise kord“ ja „toimetulekupiir toimetulekutoetuse arvutamise kord“).

Üks pööre, üks jooks: see näitab, et punkt on leitav, mitte et ta leitakse iga kord.
