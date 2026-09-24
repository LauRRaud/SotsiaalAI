# ADR-027 — Mitme allika säilitamine hübriidotsingus: mõõdetud, piirang tagasi lükatud

24.09.2026. Teostus Claude Opus 5.5.

## Probleem

Holdout-2 küsimus „Kas vanaema saaks nutilahenduste abil kauem kodus hakkama ja kes selliseid arendusi korraldab?” vajab kahte allikat (EKA ja Tehnopol). Puhas vektor tõi mõlemad lõppkonteksti, hübriid kaotas Tehnopoli.

## Põhjus (jälgitud samm-sammult)

1. Sõnaline kanal on selle küsimuse puhul müra. Üldsõnad tõstavad esile AI-artikli ja töötajate turvalisuse artikli; Tehnopol pole sõnalises top 8-s.
2. RRF eelistab kahes nimekirjas olevat tükki. AI-artikli tükid on mõlemas kanalis keskmistel kohtadel ja saavad topeltpanuse. Nad jätavad seemnete hulgast välja Tehnopoli p1 tüki, mis oli vektoris 4. kohal.
3. Üks dokument täidab kohad: viiest lõppkohast kolm läks samale AI-artiklile.
4. Märgistuse piir: valitud EKA tükk ütleb samuti, kes programmi ellu viivad („EKA, Tehnopol ning Civitta viivad ellu…”). Külmutatud ankur lubab aga ainult Tehnopoli sõnastust. Ankrut tagantjärele ei muudeta; see küsimus alahindab osaliselt saadud infot.

## Mõõdetud lahendused

Mõõdeti 48 küsimusel: 05.09 18 küsimust ja holdout-2 30 küsimust. Õige allikakoht hübriidi lõppkontekstis; kulu 0.

| Variant | 05.09 | Holdout-2 | Kokku |
| --- | ---: | ---: | ---: |
| Alus (5 seemet) | 17 | 26 | 43 |
| Kuni 2 tükki dokumendi kohta | 12 | 22 | **34** |
| 5 seemet + vaba koht vektori top-5 dokumendile, kui ühtki selle tükki pole valitud | 17 | 26 | 43 |
| **6 seemet** | 18 | 27 | 45 |
| Vektor ×2 (ADR-022) | 17 | 28 | 45 |
| **Vektor ×2 + 6 seemet** | **18** | **28** | **46** |

- **Dokumendipiirang lükati tagasi.** Paljud küsimused vajavad sama dokumendi mitut kohta, ja piirang kaotas 9 küsimust.
- **Vektori kinnitatud lisakoht lükati tagasi.** See ei andnud midagi rohkem kui lihtsalt 6. seeme; koodi ei lisatud.
- **Ainus mõõdetult aitav hoob on seemnete arv.** 6. seeme lisas 2–3 küsimust ja vektor ×2 + 6 seemet andis 46/48. Mitme allika ühtki kaotust see ei tekitanud.

## Otsus ja soovitus

- Otsingu valikukoodi ei muudeta. `evaluateRetrieval({ queryOptions })` võtab nüüd ka `limits`, et variante saaks tootmiskoodiga mõõta. Võrdlusskriptis on variandid `perdoc2`, `seeds6` ja `vector2+seeds6` ning `--variant` valik.
- Soovitus piloodiplaani jaoks: profiil, kus on vektor ×2 ja 6 seemet (praegu 5). Päris piloodiprofiilis on lõpplimiit 9 ja sõltuvuste laiendus, seega vaba koht on olemas.
- Hindamine kasutab 5 kohta ilma sõltuvuste laienduseta (Codexi märkus). 05.09 korpuse versioonid on varasemad kui sõltuvuste andmestik, seega laiendus neil midagi ei lisaks. Profiili muutus tuleb enne pilooti kinnitada.

## Kordamine

```bash
node scripts/rag-v2-eval-data.mjs unpack
node scripts/rag-v2-query-variants.mjs --set 05-09 --set holdout-2 --query-vectors tmp/rag-v2-multi-source/holdout-2-query-vectors.json --variant base --variant perdoc2 --variant seeds6 --variant vector2 --variant vector2+seeds6
```

Mõõtmine käis eraldi worktree'st ainult lahtipakitud paketi pealt ja kordas aluse arvud täpselt (17/18, 26/30).
