# ADR-065 — Eelvalikus kuni kümme lõiku ühest dokumendist (profiil v5)

02.10.2026. Teostus Claude Opus 5.5. Omanik 02.10: „tegutse“ (M3 järgmine samm, küsimus `coach-reports-child`). Järgib [ADR-064](adr-064-named-other-act.md) (profiil v4) ja [ADR-032](adr-032-national-law-reserve-and-plan-restart.md) (riikliku õiguse varukohad).

## Probleem

- Küsimus: „Olen treener ja märkasin, et üks laps vajab abi. Milliseid andmeid ma tohin tema kohta vallale edastada?“
- Vastus on lastekaitseseaduse § 27¹-s: treener teatab abivajavast lapsest, edastades vähimas vajalikus ulatuses § 34² lõigetes 3 ja 4 nimetatud andmed.
- Ükski otsinguharu ei leidnud seda 30.09 ega 01.10. Vestluses vastas Luna juhendi põhjal üldiselt („edasta ainult asjassepuutuvat teavet“) ja seadust ei viidanud.

### Põhjus (tasuta mõõtmine, [tõendid](../audits/evidence/pool-limit-2026-10-02/))

- **Eelvaliku täidab üks dokument.** Mudel valib vastuse lõigud 30 liidetud kandidaadi ja kuue riikliku õiguse varukoha seast. Juhend „Abivajavast lapsest teatamine ja andmekaitse“ võttis 30 kohast 24–25. Paljud neist on lühikesed tükid, näiteks pealkiri või sõna „JUHEND“.
- **Säte jäi alla.** § 27¹ oli liidetud järjestuses kataloogi päringutega kohal 23, vestluse eilsete päringutega kohal 36, ehk eelvalikust väljas.
- **Varukohad ei aidanud.** Lastekaitseseaduse kaks varukohta läksid teistele sätetele (§ 27² ja 8¹. peatükk).
- **Ülekaal on haruldane.** 30 raskest küsimusest võttis üks dokument 30 kohast üle 16 ainult selles küsimuses (24). Teistes on suurim osa 4–16.

## Otsus

Uus otsinguprofiil `hybrid-estnltk-chat-v5`: profiil v4 ja üks piirang.

- 30 liidetud kandidaadi seas on ühest dokumendist kuni 10 lõiku. Liidetud järjestus jääb samaks. Dokumendi lõigud üle piiri jäetakse vahele ja nende kohad saavad järgmised teiste dokumentide kandidaadid.
- Kümme jätab ruumi üheksale lähtelõigule ühest dokumendist (näiteks SHS).
- Varukohad ([ADR-032](adr-032-national-law-reserve-and-plan-restart.md)) on samad: kuni kaks lõiku akti kohta.
- **Ilma reranker'ita ei muutu midagi:** lähtelõigud on liidetud järjestuse esimesed üheksa. Seetõttu ei mõõda seda muudatust otsingukatse ilma vastuseta; mõõta saab ainult vestluse rajal.

### Teostus

- `lib/rag-v2/search/retrieval.js`: eelvalik võtab piiri arvestades järjestuse kandidaadid (`limits.poolPerDocument`).
- `lib/rag-v2/search/profiles.js`: `CHAT_POOL_PROFILE`. Profiilid v3 ja v4 on muutmata.
- `lib/rag-v2/search/ranking.js`: piiri kontroll (1–30).
- `scripts/rag-v2-corpus-run.sh` teeb uue vestlusplaani profiiliga v5.

## Mõõtmine

### Tasuta, ilma vastuseta (server, korpus v47)

| Mida | Tulemus |
|---|---|
| 30 rasket küsimust, piir 8, 10, 12 või 15 | otsustav lõik ei kao üheski küsimuses eelvalikust; piiriga 6 kaoks see ühes küsimuses |
| Treeneri küsimus, piir 10 | § 27¹ tõuseb eelvalikus kohalt 23 kohale 15 |
| 46 dialoogikataloogi esimest pööret (corpus-4 ja kolm rasket kataloogi) | piir 10 muudab eelvalikut 8 küsimuses, ülejäänud 38-s ei muuda midagi |

### Vestluse rada (v5 plaan ajutises koopias, aktiveerimata; koopia ja plaan eemaldatud)

- **Treeneri küsimus: läbis** (0,0049 USD). Mudel valis lastekaitseseaduse sätted. Vastus: „Edasta ainult vähimas vajalikus ulatuses sulle teada olevad andmed …“ ja loetleb § 34² järgi, millised andmed võivad olla asjakohased (üldandmed, pere ja leibkond, elutingimused ja toimetulek, terviseandmed, haridus, huvitegevus, last kasvatava isiku andmed). Lõpuks juhatab, kuhu teatada: valda või lasteabitelefonile 116 111.
- **Ülejäänud seitse stsenaariumi, mille eelvalikut piir muudab** (10 pööret, 0,052 USD): 9 läbis.
  - corpus-4: `fire-harku` 2/2, `care-home-correction` 3/3, `tartu-parish-not-city` 1/1, `hearing-aid-cap` 1/1.
  - Kataloog 3: `service-ended-martial-law` ja `child-rehabilitation-need` läbisid.
  - **`kuusalu-limits-since` jäi vastuse kontrolli taha.** Vastus ütles õigesti, et piirmäärasid rakendatakse alates 1. maist 2026, ning lisas, et määrus jõustus 15. septembril 2026. Kontroll keelab „15. september“, et vastus ei dateeriks piirmäärasid jõustumisega; see vastus eristab need kaks kuupäeva ise.
  - **Võrdlus:** sama küsimus praeguse v4 plaaniga (üks pööre, 0,0046 USD) läbis. See ütles sama ilma kuupäevata: „Määrus ise jõustus kolmandal päeval pärast Riigi Teatajas avaldamist.“ Mõlemad vastused viitavad samale allikale. Ühe jooksuga ei saa öelda, kas erinevus tuleb eelvalikust või sõnastuse juhuslikkusest.
- Tasuline kulu kokku 0,062 USD plaani hindade järgi, neli jooksu.

## Kasutuselevõtt

- Profiil on vestlusplaani osa. Pärast deploy'd tehakse serveris uus plaan profiiliga v5 ja teenus taaskäivitatakse, nagu v4 puhul ([ADR-064](adr-064-named-other-act.md)).
- Tagasi v4 peale saab uue plaaniga profiilist v4.

## Piirid

- Vestluse rajal on mõõdetud 11 pööret, iga stsenaarium üks kord. Laiemat regressioonijooksu (corpus-4 tervikuna, umbes 0,2 USD) ei tehtud: tasuta analüüsi järgi muudab piir eelvalikut ainult 8 küsimuses 46-st.
- Tasuta analüüs kasutas dialoogide esimest pööret ilma vestluse otsinguplaani päringute ja vallata. Päris vestluses kirjutab plaan oma päringud, seega võib muudetud küsimusi olla teisi.
- Pikad juhendid jagunevad lühikesteks tükkideks (pealkiri, „JUHEND“), mis tulevad liidetud järjestuses kõrgele. Piir vähendab nende kohti eelvalikus, aga ei eemalda neid. Tükeldust see muudatus ei puuduta.
- Kümme on valitud mõõtmise järgi (8–15 ei kaotanud midagi), mitte optimeeritud.
