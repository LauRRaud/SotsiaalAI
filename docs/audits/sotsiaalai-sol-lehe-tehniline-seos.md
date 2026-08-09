# SotsiaalAI — lehtede tehniline seos eelkaardina

**Staatus:** `STATIC_PREMAP`  
**Baaskuupäev:** 2026-08-08  
**Analüüsitud lehed:** 94

Täielik register on failis [sotsiaalai-sol-lehe-tehniline-seos.csv](C:\Users\rauds\Desktop\SotsiaalAI\docs\audits\sotsiaalai-sol-lehe-tehniline-seos.csv).

## 1. Staatilise skanni tulemus

| Kontroll | Tulemus |
|---|---:|
| Lehed registris | 94 |
| Lehed, millel leiti otseimport | 94 |
| Lehed, mille lähtekoodis leiti otsene `/api/...` stringiviide | 3 |
| Lehed, mille importides leiti `action` või `server` viide | 26 |

## 2. Registri väljad

- `route_pattern` — lehe route;
- `page_file` — lähtefail;
- `direct_imports` — suhtelised ja `@/`-impordid, mida lehefail otse kasutab;
- `api_refs` — lehefailis otse leitavad `/api/...` stringiviited;
- `action_imports` — importide hulgast esialgselt tuvastatud action/server nimega viited;
- `scan_status` — `static_import_scan`.

## 3. Tõlgenduspiirang

Kolm otsest `/api/...` viidet ei tähenda, et ainult kolm lehte kasutavad API-t. Paljud lehed võivad kasutada API-kutseid hook'i, komponendi, `lib`-mooduli või eraldi kliendikihi kaudu. Seetõttu on see register ainult esimene servakaart.

Soli järgmine töö on liikuda lehefailist edasi imporditud komponentidesse, hook'idesse, API-klientidesse, server action'itesse ja `lib`-moodulitesse ning kinnitada tegelik funktsioonivoog.
