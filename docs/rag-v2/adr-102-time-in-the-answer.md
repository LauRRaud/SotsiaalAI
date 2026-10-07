# ADR-102: aeg vastuses: leid koos aastaga ja eri aastate allikad ajalises järjekorras

Kuupäev: 07.10.2026. Seis: juhis töötab (dialoogi juhise versioon 29, #445); päris lehe kontroll tehtud (allpool); kontrolli põhjal kaks parandust (versioon 30, #446) ja üks täpsustus (versioon 31, #447); töötab versioon 31.

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
7. **Juhendi nõuanne aastat ei vaja, juhendi arv vajab** (versioon 30). Summa, määr, piir või tähtaeg, mille annab juhend või infomaterjal, öeldakse koos aastaga („… aasta seisuga …“), sest sellised arvud muutuvad. Aasta tuleb kaardi ilmumisaastast ka siis, kui kaart ütleb, et allikas on aktiivne ja hiljuti kontrollitud (versioon 31): need väljad ütlevad, et leht oli kogumise ajal oma aadressil, mitte et selle arvud täna kehtivad. Kui uuem allikas või kehtiv seadus ütleb teisiti kui juhend, otsustab hilisem ja vastus ütleb, et juhend on vanem.
8. **Aasta juures võib olla allika liik, mitte „… järgi“** (versioon 30). „… aasta uuringus …“ on lubatud, kui lugejal on seda vaja; kuju „raporti järgi“, „juhendi järgi“ jääb välja nagu seni (answer-11).

Juhis on üldine: selles ei ole ühtki aastat, arvu, kohta ega teemat, mida vastus saaks faktina korrata (test kontrollib).

## Mida see ei tee

- **Otsingut see ei muuda.** Juhis kasutab ajaliselt ainult seda, mis tõendite hulka jõudis. Kui küsimuse juurde tuleb ainult ühe aasta allikaid, ei ole millestki ajalugu ehitada. Kas otsing toob sellise küsimuse juurde lõike eri aastatest piisavalt, tuleb eraldi vaadata; kui ei too, on vaja otsingusse ajalist sammu (eraldi otsus).
- Andmete aastat, mida lõigus ei ole, juhis ei tea: siis on kasutada ainult ilmumisaasta ja vastus ütleb seda ilmumisaastana.
- Taustalõiku (teema üldine selgitus enne vastust) see ei lisa.

## Kulu

Juhis pikeneb umbes 550 tokeni võrra igas vestluspöördes (versioon 29: 464, versioon 30: 551, versioon 31: umbes 600; mõõdetud `tokenCount`-iga, test hoiab piiri 620). Juhise algus on päringute vahel sama, nii et suurem osa sellest tuleb vahemälust.

## Kontroll

- `tests/rag-v2-answer-prompt.test.mjs`: versioon 29, versioon 28 on loetavate hulgas, ajareegli laused ja koht juhises; ilma lisatud osadeta on dialoogi laiendus endiselt versiooni 23 tekst bait-baidilt.
- `tests/rag-v2-web-address.test.mjs` ei seo enam juhise versiooni numbrit; see kuulub juhise enda testile.
- Väljalase uuendab vestluse plaani uue juhise versiooniga ise (nagu versiooniga 28, #424).

## Kontroll päris lehel (07.10.2026 õhtu, juhis 29)

Viis küsimust päris vestluses, igaüks uues vestluses; kõik pöörded jooksid juhisega 29. Kulu plaani hinna järgi 0,0226 USD (lagi 0,05).

| Küsimus | Tõendite aastad | Mida vastus tegi |
|---|---|---|
| Kuidas on lähedaste hoolduskoormus aastate jooksul muutunud? | 2009, 2016, 2019, 2021, 2022, 2023, 2025 | Rääkis aja järjekorras (2009, 2014, 2020, 2022, 2025), iga arv oma aastaga; ütles, et uuringud küsisid eri moodi ja arvud ei ole ühtne suundumus |
| Mis on lastekaitsetöös kümne aastaga muutunud? | 2016 (3), 2022 (2), 2024, 2026 (3) | 2016 seadus ja rakendusüksus, 2022 kirjeldatud arengud, 2024, 2026 kavandatav muudatus (jõustumine 2027, pöörde päeval veel jõustumata); ütles, et ülevaade ei ole ammendav |
| Kui suur osa tööealistest puudega inimestest töötab? | 2026, 2009 | Andis 2024. aasta näitaja ja 2009. aastal avaldatud uuringu näitaja; ütles, et need ei ole võrreldavad ja et 2009. aasta tulemus ei näita praegust olukorda |
| Kuidas saavad hakkama asendushoolduselt lahkuvad noored? | 2022 (7), 2023 (2) | Leiud kujul „2022. aastal avaldatud uuringus“; **2023. aasta juhendi kuu- ja aastasumma ilma aastata** |
| Hooldan dementsusega ema, kuidas vastu pidada? | 2020, 2024, 2026 | Praktiline vastus, ajalugu ei lisandunud; üks lause kujul „2026. aasta aruandes kirjeldatud intervjuudes …“ |

**Mida see näitab.**

- Ajaline ülesehitus töötab, kui küsitakse muutuse kohta, ja praktiline küsimus ei muutu ajalooks.
- Otsing tõi kahe muutuseküsimuse juurde lõike viiest kuni seitsmest eri aastast ilma eraldi ajalise sammuta. Valim on kaks küsimust: see ei tõesta, et nii on iga teemaga.
- **Kaks viga, parandatud versioonis 30:** juhendi summa jäi aastata (juhis küsis aastat ainult uuringu, aruande ja artikli arvule); aasta tuli ühes vastuses kujul „2025. aastal avaldatud raporti järgi …“.
- Vana leiu juurde hoiatust „võib olla muutunud“ 2022. aasta uuringu puhul ei lisandunud; aasta oli lauses. Seda ei ole muudetud.

## Kontroll päris lehel (juhis 30) ja versioon 31

Kaks küsimust juhisega 30 (0,0081 USD plaani hinna järgi).

- **Asendushoolduselt lahkuvad noored** (sama küsimus): leiud kujul „2022. aastal avaldatud uuringus kirjeldati …“, ühtki „… järgi“ lauset ei olnud. Juhendi summasid see vastus ei kasutanud.
- **Kui palju raha saab järelhooldusel olev noor isiklike kulude katteks?** Vastus andis 2023. aasta juhendi kuu- ja aastasumma **endiselt ilma aastata**. Ta ütles küll, et summa tuleb juhendist ja et seadusesättest seda kinnitada ei saa. Mudelile näidatud kaardil oli `publication_year` 2023, aga ka `source_status: active` ja `source_checked_at` sama päeva kuupäevaga: need loevad nagu „kehtib täna“, kuigi ütlevad ainult, et leht oli kogumise päeval oma aadressil.

Versioon 31 ütleb selle juhises välja ja nimetab välja, kust aasta tuleb.

## Kontroll päris lehel (juhis 31)

Kolm küsimust juhisega 31 (0,0145 USD plaani hinna järgi). Kogu kontroll kolme versiooniga: 10 pööret, 0,0452 USD (lagi 0,05).

- **Kuidas on lähedaste hoolduskoormus aastate jooksul muutunud?** (sama küsimus kui versiooniga 29): aja järjekorras 2009, 2016, 2019, 2022, 2025, iga arv oma aastaga, ühtki „… järgi“ lauset; ütles, et mõõdikud ei ole võrreldavad ja et uusimad andmed on 2025. aasta seis.
- **Kui palju raha saab järelhooldusel olev noor isiklike kulude katteks?** Summa tuli seekord kehtivast seadusest (viidatud sotsiaalhoolekande seaduse lõigud), juhendile toetus ainult korralduse kirjeldus. Aastat ei olnud ja ei pidanudki olema.
- **Kui palju maksab hooldekodu koht ja kui suure osa peab inimene ise maksma?** Vastus ei andnud ühtki arvu: jaotus seadusest, hinnad ametliku lehe aadressiga.

**Juhendi arvu reeglit (versioonid 30 ja 31) ei ole päris vastuses töötamas nähtud:** kahes katses võttis vastus arvu kehtivast seadusest või ei andnud arvu. See, et reegel on juhises, ei tõesta, et mudel seda järgib.

Kontrollimata: vene- ja ingliskeelne vastus, järjestikused küsimused samas vestluses.
