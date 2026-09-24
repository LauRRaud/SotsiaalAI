# ADR-022 — Vektorikaaluga hübriidprofiil

24.09.2026. Teostus Claude Opus 5.5.

## Probleem

Vaba olukorrakirjelduse korral („Kellega vallas rääkida…”, „Mul on raha otsas…”) tabab EstNLTK-sõnaline kanal peamiselt üldsõnu. RRF-is tõrjuvad need tabamused vektori asjakohased vasted allapoole. Päris vektoritega mõõtmises (terviklik analüüs §2.7) leidis vektor asjakohase allika top-5-s 12/12 korral, hübriid 10/12 ja sõnaline kanal 4/12.

## Otsus

- `rrf()` võtab valikulised kanalikaalud (`lexical`, `vector`; vahemik 0 < w ≤ 4). Kaaludeta tulemus on sama mis enne.
- Kaal on **päringu** parameeter (`query.channelWeights`). Generatsiooni `rrf-v1` leping, indeksid, embedding'u vahemälu ja generatsiooni ID ei muutu, seega pole vaja uut indeksit ega tasulisi kutseid.
- Uus profiil `hybrid-estnltk-vector2-dependencies-v1` on sama mis `hybrid-estnltk-dependencies-v1`, ainult vektori kaal on 2. Iga ühiku `rrf_contributions` näitab kaalutud panust.
- Vaikeprofiil ei muutu. Uue profiili kasutamiseks tuleb see valida piloodiplaanis, mis vajab omaniku kinnitust.

## Tõend

Kulu 0: salvestatud päris vektorid, SQL seansi `TEMP` tabelil, muutmata `evaluateRetrieval()`.

| Vektori kaal | 05.09 võrdlus (18 täielikku) | top-1 / top-3 | Kontrollosa | M2.2 regressioon | Olukorralaused hit@5 (12) |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1 (praegune) | 17/18 | 7 / 10 | 6/7 | 7/7 | 10/12 |
| 1,5 | 17/18 | 9 / 11 | 6/7 | 7/7 | 11/12 |
| **2** | **17/18** | **9 / 12** | **6/7** | **7/7** | **11/12** |
| 3 | 16/18 | 9 / 13 | 5/7 | 7/7 | 11/12 |

Kaal 2 on mõlemal valimil parem või võrdne; kaal 3 kaotab kontrollosas ühe küsimuse. Tootmiskoodi `rrf()` koos profiili kaaluga taasesitas olukorralausete tulemuse 11/12.

## Piirid

- Valimid on väikesed (18 + 12) ja olukorralausete asjakohasuse märgistas üks hindaja. Kinnitamiseks on vaja suuremat märgistatud komplekti.
- „Kellega vallas rääkida, kui vajan sotsiaalabi?” jääb 18. kohale. Kontaktikirje ei ole sõnalises kanalis ja mõlemas kanalis olevad üldsõnatabamused jäävad ette. Selle lahendus on sõnalise kanali stoppsõnade käsitlus, mitte suurem kaal.

## Kinnitus holdout-2 valimil (24.09)

Enne ühtegi mõõtmist kinnitati Git'is 30 uut küsimust: 26 perekonda, ET/EN/RU, sh kümme igapäevases või olukorrasõnastuses. Päringuvektorid telliti ühe kutsega: 1027 tokenit, ~0,00013 USD, omaniku loal.

Õige allikas lõppkontekstis, hübriid:

| Variant | Holdout-2 (30) | 05.09 (18) | Kokku (48) |
| --- | ---: | ---: | ---: |
| Alus | 26 | 17 | 43 |
| **Vektor ×2** | **28** | **17** | **45** |

Kaal 2 võitis kaks küsimust („vaide tähtaeg”, „hooldaja läbipõlemise koolitus”), kus vektor leidis allika, kuid sõnaline kanal mitte. Ühtegi küsimust see ei kaotanud. Kaks küsimust jäid kõigis variantides saamata:
- kahe allikaga „vanaema + tehnoloogia”: puhas vektor tõi mõlemad allikad lõppkonteksti, hübriid (ka kaaluga 2) kaotas ühe;
- ingliskeelne küsimus Eesti nõusolekuteenuse kohta.

Kordamine: `node scripts/rag-v2-query-variants.mjs --set 05-09 --set holdout-2 --query-vectors tmp/rag-v2-multi-source/holdout-2-query-vectors.json`. Vektorifail on kohalik (`tmp/`).
