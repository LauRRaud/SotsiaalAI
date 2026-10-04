# ADR-082 — Registris valitud paragrahvi saab lugeda lõigete kaupa (`xml_units`)

04.10.2026. Teostus Claude Opus 5.5. Omanik 04.10 õhtul: „sa toimeta edasi, kuni vigu ei ole. võid teha teste, raha pole probleem.“ Täiendab [ADR-076](adr-076-act-sections-as-source.md).

**Mõõdetud korpusel v50: ei aidanud** (jaotis „Mõõtmine“). Lõige 5 ei saanud kandidaadiks; riigieelarve seaduse kandidaat oli lõige 4. Järg: [ADR-083](adr-083-list-subsection-by-point.md) (loetelu punktide kaupa).

## Probleem

Küsimus „Kui suur on toimetulekupiir?“ sai neljast mõõdetud jooksust kolmes vastuse ilma summata.

- Summa seisab 2026. aasta riigieelarve seaduse § 2 lõikes 5 („Sotsiaalhoolekande seaduse alusel kehtestatavad määrad on järgmised: … toimetulekupiir 220 eurot kalendrikuus“).
- § 2 oli üks tekstiüksus (6737 märki), lõigatud pikkuse järgi neljaks lõiguks. Summaga lõik algas loetelu keskelt („3) seaduse § 73 lõike 5 alusel …“): lõike 5 avasõnad jäid eelmisse lõiku ja samas lõigus oli ka lõigete 6 ja 7 teksti.
- Kandidaadiks sai kolmes jooksus ainult esimene lõik (õppetoetuste määrad). Neljandas jooksus sai ka summaga lõik ja vastus andis summad; see sõltus plaani päringu sõnastusest.

## Otsus

Registrikirje uus väli **`xml_units: "subsection"`** (ainult koos väljaga `xml_sections`): valitud paragrahv loetakse lõigete kaupa, iga lõige on oma tekstiüksus ja saab oma lõigu(d).

- **Ainult seal, kus paragrahvi kogu tekst seisab lõigetes** ja lõikeid on vähemalt kaks. Muidu jääb paragrahv üheks üksuseks nagu enne.
- **Täielikult kehtetu lõige jäetakse välja** (nagu täielikult kehtetu paragrahv): reeglit selles ei ole. Selle märkus ja paragrahvi pealkirja märkus lähevad tekstiväliste märkuste loetellu, mitte kaotsi.
- **Lõike märkus seisab oma lõike üksuse juures**, sama koha peal tekstis.
- Paragrahvi number ja pealkiri on iga lõigu teekonnas („… > § 2. Seadustest tulenevate määrade ja piirsummade kehtestamine“), nagu enne.
- **Väli on registris, mitte vaikimisi:** ilma väljata loetakse valitud paragrahv täpselt nagu enne, nii et ühegi olemasoleva redaktsiooni väljund ei muutu. Töötlemise sildid jäävad samaks; sõrmejälg uuendatud.
- Järgmise aasta redaktsioon pärib välja koos paragrahvide valikuga (`corpus-refresh`).

### Tulemus riigieelarve seaduse § 2 jaoks

Üheksa lõiget, kümme lõiku (ainult pikk lõige 7 on lõigatud kaheks). Summaga lõik on lõige 5 tervikuna (1603 märki): algab sõnadega „(5) Sotsiaalhoolekande seaduse alusel kehtestatavad määrad on järgmised:“ ja sisaldab toimetulekupiiri.

### Teostus

- `lib/rag-v2/text-source.js`: `xmlUnits`, `xmlRecords` kolmas parameeter.
- `lib/rag-v2/registered-source.js`, `corpus-refresh.js`: väli jõuab metaandmetesse (`source_selector.xml_units`) ja pärandub.
- `Andmebaasi/REGISTER.json`: riigieelarve seaduse kirje.
- Metaandmed on redaktsiooni identiteedi osa, nii et sama fail saab uue redaktsiooni; vana jääb hoidlasse.

## Kontrollid

- `tests/rag-v2-xml-sections.test.mjs`: riigieelarve seaduse § 2 lõigete kaupa (üksused, summaga lõik, ükski lõik ei sisalda kahte lõiget); ilma väljata üks üksus ja teine redaktsioon; vigased väärtused; Märjamaa akti märkus õiges lõikes; väljamõeldud akt (kehtetu lõige, lõigeteta paragrahv, ühe lõikega paragrahv, märkuste loetelu).
- `tests/rag-v2-corpus-refresh.test.mjs`: väli pärandub uuele redaktsioonile.

## Piirid

- **Leidmine on endiselt otsingu teha.** Lõik on nüüd täpsem (üks lõige, oma avasõnadega), aga kandidaadiks saamine sõltub ikka päringust. Seda näitab ainult mõõtmine.
- Lõikest pikem tekst (lõige 7) lõigatakse endiselt pikkuse järgi.
- Punktide kaupa lugemist selles otsuses ei olnud: punkt üksi („seaduse § 131 lõike 3 alusel …“) ei ütle, millise seaduse määr see on. ADR-083 lisas selle, lõike avasõnad punkti pealkirjaks.

## Mõõtmine (04.10.2026, korpus v50)

- **Korpus v50:** riigieelarve seaduse § 2 uus redaktsioon (9 üksust, 10 lõiku). Ostetud 9 sisendit, 3098 tokenit, 0,0004 USD (usage `pilot_22f19f4a…`); indeks `9da75af5` (6474 dokumenti, 40 621 lõiku), plaan `/etc/sotsiaalai/m4-corpus-chat-20261004c.json`.
- **Üks pööre** („Kui suur on toimetulekupiir ja kuidas toimetulekutoetust arvutatakse?“, 0,0056 USD): **ei läbinud**, vastus summat ei andnud. [Tõendifail](../audits/evidence/corpus-v50-measured-2026-10-04.json).
- Riigieelarve seaduse ainus kandidaat oli **lõige 4** (töötutoetuse päevamäär), mitte lõige 5. Lõige 5 on kuue määraga loetelu, millest neli on erihoolekandeteenuste omaosalused ja toimetulekupiir viies: lõik tervikuna ei ole toimetulekupiiri päringule lähedane.
- Järeldus: lõige on selle loetelu jaoks liiga suur üksus. [ADR-083](adr-083-list-subsection-by-point.md) loeb loetelu punktide kaupa.

Üks pööre, üks jooks.
