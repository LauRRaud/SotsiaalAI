# SotsiaalAI — Soli süvaanalüüsi eelkaardistus

**Staatus:** `PREMAP_READY`  
**Eesmärk:** anda Solile neutraalne ja kontrollitav lähtekaart enne funktsioonide ning failide süvaanalüüsi  
**Baaskuupäev:** 2026-08-08  
**Baasi HEAD:** `f57620204b52990dab207fa71e9744ab19f261ba`

## 1. Tööjaotus

Eelkaardistus ei hinda veel funktsioonide kvaliteeti, turvalisust ega arhitektuurilisi puudujääke. See fikseerib, millised põhifailid ja tehnilised pinnad Soli analüüsi sisendiks on olemas.

- Eelkaardistus: failide, põhikataloogide, lehtede ja tehniliste sisenemispindade inventuur.
- Sol: funktsioonide ja failide süvaanalüüs, seoste kontroll, riskid, puuduvad kaitsed ja prioriteedid.
- Testid: ei kuulu sellesse põhifailide registrisse; neid kasutatakse hiljem tõendikihina.

## 2. Soli esimese analüüsi ulatus

```text
app/
lib/
rag-service/
prisma/
auth.js
proxy.js
components/
pages/
```

Soli sisendist on teadlikult välja jäetud `tests/`, testinimega failid (`test_*`, `*.test.*`, `*.spec.*`), `__pycache__/`, `node_modules/`, `.next/`, buildikaustad ja muud sõltuvuste või genereeritud väljundite detailfailid. Tehnilise aluse kirjeldus (`package.json`, `package-lock.json`, `next.config.mjs` ja Prisma konfiguratsioon) tuleb vajadusel lisada eraldi kontekstina.

## 3. Eelkaardistatud failimaht

| Pind | Failid | Alamkaustad |
|---|---:|---:|
| `app/` | 545 | 557 |
| `lib/` | 491 | 54 |
| `rag-service/` | 3 | 0 |
| `prisma/` | 135 | 132 |
| `components/` | 282 | 51 |
| `pages/` | 2 | 2 |
| `auth.js` + `proxy.js` | 2 | 0 |
| **Kokku** | **1 460** | — |

Täielik failitaseme register on failis [sotsiaalai-sol-eelkaardistus-file-register.csv](C:\Users\rauds\Desktop\SotsiaalAI\docs\audits\sotsiaalai-sol-eelkaardistus-file-register.csv).

Registri väljad on:

- `path` — täpne suhteline failitee;
- `scope` — põhikataloog või root-runtime;
- `kind` — esmane failitüübi klassifikatsioon.

## 4. Soli süvaanalüüsi soovituslik järjekord

1. `app/` ja `pages/`: lehed, API-route'id, server action'id ja kasutaja sisenemispinnad.
2. `lib/`: äriloogika, õigused, andmetöötlus ja kõrvalmõjud.
3. `rag-service/`: retrieval, allikad, vektorikiht, timeout'id, retry'd ja fallback'id.
4. `prisma/`: mudelid, seosed, omanikupiirid ja andmete elutsükkel.
5. `auth.js` ja `proxy.js`: autentimise ning request'i-eelsed piirid.
6. `components/`: kasutaja tegevused ja nende seos serveripoolsete pindadega.

Süvaanalüüsi tulemusena peaks Sol siduma iga olulise funktsiooni vähemalt järgmise ahelaga:

```text
leht või muu sisenemispind
→ komponent või klient
→ API/server action
→ lib või rag-service
→ auth/õigus
→ Prisma või väline teenus
→ vastus, logi ja võimalik auditijälg
```

## 5. Piirangud ja ausad olekud

- See eelkaardistus tõestab failide olemasolu inventuuri hetkel, mitte nende kasutamist runtime'is.
- Faili olemasolu ei tõesta, et route või funktsioon on aktiivselt saavutatav.
- Testide ja runtime'i tõendid lisatakse alles järgmises auditi kihis.
- Kui seost või kasutust ei saa staatiliselt tõendada, peab Sol märkima selle `not_proven`, mitte oletama.
