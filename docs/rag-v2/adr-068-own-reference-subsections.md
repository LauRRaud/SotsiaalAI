# ADR-068 — Akti viide iseendale toob nimetatud lõike (profiil v6)

02.10.2026. Teostus Claude Opus 5.5. Omanik 02.10: „tee kuni neljandani ära“ (punkt 3). Järgib [ADR-064](adr-064-named-other-act.md) (teise akti nimetatud lõige, profiil v4) ja [ADR-065](adr-065-pool-limit-per-document.md) (profiil v5).

## Probleem

- Kui valitud lõik viitab sama akti teisele paragrahvile („käesoleva seaduse § 34² lõigetes 3 ja 4“), lisab otsing alates profiilist v3 viidatud paragrahvi **esimese lõigu**.
- Pikk paragrahv on korpuses mitmes lõigus. Nimetatud lõige võib olla teises või kolmandas, ja siis jõuab mudelini paragrahvi algus, mitte see, millele viidati.
- Treeneri küsimus (ADR-065): lastekaitseseaduse § 27¹ viitab § 34² lõigetele 3 ja 4. Päris vestlus vastas 02.10 õigesti, aga ütles, et § 34² lõiked 3–4 on tema väljavõttes ainult osaliselt.
- Teise akti viide (ADR-064) toob juba nimetatud lõike lõigu. Sama akti viide ei toonud.

## Otsus

Uus otsinguprofiil `hybrid-estnltk-chat-v6`: profiil v5 ja üks reegel.

- Kui akti viide iseendale nimetab lõike, lisatakse lõik, kus see lõige algab, mitte paragrahvi esimene lõik. Lõike leiab sama funktsioon, mida kasutab teise akti reegel (`provisionChunks`).
- Kui viide nimetab ainult paragrahvi („§ 72 kohaselt“), lisatakse paragrahvi esimene lõik nagu enne.
- Kui lõige jätkub teises lõigus, lisatakse jätk alles siis, kui iga viide on oma esimese lõigu saanud.
- Kohad ja ruum on samad: kuni 4 lisandust, kontekst koos lisandustega kuni 13 000 tokenit, kokku kuni 13 lõiku (lisaks kaks kohta teise akti viitele).
- Kui nimetatud lõiget paragrahvis ei leita, lisatakse paragrahvi esimene lõik.
- Profiilid v3–v5 on muutmata.

### Teostus

- `lib/rag-v2/search/legal-references.js`: `sectionReferences()` annab akti enda viited koos nimetatud lõigetega.
- `lib/rag-v2/search/retrieval.js`: viidete tsükkel kasutab lipuga `referenceSubsections` nimetatud lõike lõike.
- `lib/rag-v2/search/profiles.js`, `ranking.js`: `CHAT_SUBSECTIONS_PROFILE`, lipu kontroll.
- `scripts/rag-v2-graph-experiment.mjs`: haru O (v6) ja võrdlus haruga N (aruande skeem `rag-v2/graph-experiment-4`, väli `own_subsections`).
- `scripts/rag-v2-corpus-run.sh` teeb uue vestlusplaani profiiliga v6.

## Mõõtmine

### Tasuta, ilma vastuseta (server, korpus v47, kolm rasket kataloogi, 30 küsimust)

Haru O (v6) haru N (v4) kõrval; ilma reranker'ita erineb v6 v4-st ainult selle reegli võrra.

| Mida | Tulemus |
|---|---|
| Otsustav lõik leitud | 28/30 mõlemal; ükski küsimus ei võitnud ega kaotanud |
| Valik muutus | 10 küsimuses 30-st, peaaegu kõik SHS § 133 (toimetulekutoetus) viited |
| Kontekst | keskmiselt +407 tokenit (+4%); kataloogiti +138, +348 ja +593 |
| Suurim üksik lisandus | `guardian-ward-family`: üks § 133 lõik, umbes 4000 tokenit |

- Viies küsimuses oli § 133 esimene lõik juba valitud ja v4 ei lisanud midagi; v6 lisab nimetatud lõike lõigu.
- `subsistence-home-loan`: nimetatud lõiked olid juba valitud lõikude seas, seega v6 ei lisa midagi ja kontekst on 900 tokenit väiksem.
- `subsistence-care-home`: v4 lisas § 133 ja § 140 alguse; v6 lisab § 133 kaks nimetatud lõiget ja § 140 jääb kohtade piiri taha (13 lõiku).
- Jätkulõikude järjekord (esmalt iga viite esimene lõik) ei muutnud neis kataloogides midagi.

### Vestluse rada (v6 plaan ajutises koopias, aktiveerimata; koopia ja plaan eemaldatud)

Kõik 10 muutunud valikuga küsimust ja treeneri küsimus, iga üks kord: **11/11 läbis**, 0,057 USD plaani hindade järgi, kolm jooksu.

- **Treeneri küsimus:** vastus loetleb, millised andmed võivad olla asjakohased (üldandmed, pere ja sotsiaalne võrgustik, elutingimused, haridus ja huvitegevus, abivajadusega seotud terviseandmed), ja ütleb, et need on näited andmetest, mida vald võib töödelda, mitte luba kõike edastada. Märkust, et § 34² lõiked on väljavõttes ainult osaliselt, enam ei ole.
- Ülejäänud kümme (toimetulekutoetus, teenuse lõpetamine, eestkoste, leibkond): kõik läbisid otsingu ja vastuse kontrolli.
- Pöörded olid aeglased (15–35 s), sest iga hindamisprotsess kontrollib oma allikad külmalt; see ei ole profiili mõju.

## Kasutuselevõtt

- Profiil on vestlusplaani osa. Pärast deploy'd tehakse serveris uus plaan profiiliga v6 ja teenus taaskäivitatakse, nagu v4 ja v5 puhul.
- Tagasi v5 peale saab uue plaaniga profiilist v5.

## Piirid

- Vestluse rajal on iga küsimus mõõdetud üks kord. Laiemat regressioonijooksu ei tehtud: ilma lõiget nimetava viiteta küsimustes valik ei muutu.
- Nimetatud lõige võib olla pikk (üks § 133 lõik on umbes 4000 tokenit). Ruumi piir (13 000 tokenit koos lisandustega) hoiab konteksti senises suuruses, aga pikk lõige võib teise viidatud paragrahvi välja jätta.
- Viide, mis nimetab mitu lõiget eraldi sõnadega („lõikes 1 ja lõikes 3“), annab praegu ainult esimese; loetelu „lõigetes 1 ja 3“ annab mõlemad.
- Punkte ja lauseid ei eristata: „§ 16 punktis 3“ toob paragrahvi alguse.
