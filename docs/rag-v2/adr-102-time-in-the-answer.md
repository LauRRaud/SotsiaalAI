# ADR-102: aeg vastuses: leid koos aastaga ja eri aastate allikad ajalises järjekorras

Kuupäev: 07.10.2026. Seis: juhis tehtud (dialoogi juhise versioon 29); päris lehe kontroll pärast juurutust on üleandmisfailis (S1.0).

## Probleem

Korpuses on kolme liiki allikaid, mille aeg tähendab eri asja.

- **Õigusaktid.** Aeg on täpne: otsing annab ainult selle redaktsiooni, mis kehtib küsitud päeval või täna (`legal-validity.js`, ADR-077), ja juhis ütleb, kuidas redaktsioonide erinevusest rääkida (ADR-062, ADR-088).
- **Ajakirja Sotsiaaltöö artiklid alates 2016.** Kaardil on ilmumise kuupäev; otsing oskab ajavahemikku küsida (perioodirajad).
- **Uuringud, aruanded ja juhendid 2015–2026** (07.10.2026 lisatud 257 dokumenti, kolmandik korpuse lõikudest). Kaardil on ainult aasta.

Kahe viimase liigi kohta ei öelnud juhis vastajale midagi. Allikakaardil on aasta alati olnud (`publication_date`, `publication_year`), kuid:

1. vana uuringu arv või leid võis vastuses kõlada tänase seisuna;
2. kui tõendites olid sama asja kohta eri aastate allikad, ei rääkinud vastus, mis oli enne ja mis on muutunud.

Omanik 07.10.2026: „kui nt midagi küsitakse, mingit fakti või mis iganes teemat, siis idee poolest saab vastuses seda asja ka üles ehitada ajaliselt, mis oli ja mis on muutunud.“

## Otsus

Dialoogi juhise lõppu lisandub ajareegel (`TIME_INSTRUCTIONS`, `lib/rag-v2/pilot/dialogue.js`). See käib allikate kohta, mis ei ole õigusaktid; õigusaktide reeglid jäävad puutumata.

1. **Leid koos ajaga.** Kui vastus annab uuringust, aruandest või artiklist arvu, osakaalu, summa, leiu või olukorra kirjelduse, ütleb ta samas lauses, mis aja kohta see on: aasta, mille lõik ise andmete kohta nimetab; kui lõik aastat ei nimeta, siis allika ilmumisaasta, ja see öeldakse ilmumise aastana, mitte andmete aastana.
2. **Luna oma hääl jääb** (answer-11): aasta on lause osa („… aastal …“, „… aastal avaldatud andmetel …“), allikat, autorit ega pealkirja ei nimetata.
3. **Vana leid ei ole tänane seis.** Aastat võrreldakse pöörde kuupäevaga (`stateContext.asOfDateUTC`). Kui uusim tõend on sellest selgelt vanem, ütleb vastus, et pilt on selle aja kohta ja võib olla muutunud. Sama või eelmise aasta leiu juurde seda hoiatust ei lisata.
4. **Ajaline järjekord.** Kui tõendites on sama asja kohta eri aastate allikad või kasutaja küsib, mis on muutunud, räägitakse see osa aja järjekorras: mis oli (aastaga), mis muutus ja millal, mis kehtib nüüd.
5. **Mis kehtib nüüd,** tuleb uusimast tõendist või kehtivast õigusaktist. Vanem allikas ei kaalu üles uuemat ega seadust; kui need erinevad, öeldakse, kumb on hilisem.
6. **Ajalugu ei mõelda välja.** Kaks ajahetke ei ole suundumus; kahe uuringu erinevus võib tulla sellest, kuidas kumbki tehti; aastaid, mida tõendid ei kata, ei täideta. Kui kõik tõendid on ühest ajast, ei tehta juurde varasemat ega hilisemat seisu. Praktiline küsimus „mida ma nüüd teen“ saab vastuse sellest, mis kehtib nüüd, mitte ajaloost.
7. **Juhendi nõuanne aastat ei vaja.** Kui uuem allikas või kehtiv seadus ütleb teisiti kui juhend, otsustab hilisem ja vastus ütleb, et juhend on vanem.

Juhis on üldine: selles ei ole ühtki aastat, arvu, kohta ega teemat, mida vastus saaks faktina korrata (test kontrollib).

## Mida see ei tee

- **Otsingut see ei muuda.** Juhis kasutab ajaliselt ainult seda, mis tõendite hulka jõudis. Kui küsimuse juurde tuleb ainult ühe aasta allikaid, ei ole millestki ajalugu ehitada. Kas otsing toob sellise küsimuse juurde lõike eri aastatest piisavalt, tuleb eraldi vaadata; kui ei too, on vaja otsingusse ajalist sammu (eraldi otsus).
- Andmete aastat, mida lõigus ei ole, juhis ei tea: siis on kasutada ainult ilmumisaasta ja vastus ütleb seda ilmumisaastana.
- Taustalõiku (teema üldine selgitus enne vastust) see ei lisa.

## Kulu

Juhis pikeneb umbes 460 tokeni võrra igas vestluspöördes (mõõdetud `tokenCount`-iga, test hoiab piiri 480). Juhise algus on päringute vahel sama, nii et suurem osa sellest tuleb vahemälust.

## Kontroll

- `tests/rag-v2-answer-prompt.test.mjs`: versioon 29, versioon 28 on loetavate hulgas, ajareegli laused ja koht juhises; ilma lisatud osadeta on dialoogi laiendus endiselt versiooni 23 tekst bait-baidilt.
- `tests/rag-v2-web-address.test.mjs` ei seo enam juhise versiooni numbrit; see kuulub juhise enda testile.
- Väljalase uuendab vestluse plaani uue juhise versiooniga ise (nagu versiooniga 28, #424).
- **Mõõtmata enne juurutust:** kuidas vastused päriselt muutuvad. Kontroll päris lehel mõne küsimusega tehakse pärast juurutust (lagi 0,05 USD).
