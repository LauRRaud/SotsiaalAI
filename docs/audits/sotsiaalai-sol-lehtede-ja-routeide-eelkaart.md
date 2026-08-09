# SotsiaalAI — Soli lehtede ja route'ide eelkaart

**Staatus:** `PREMAP_READY`  
**Eesmärk:** fikseerida platvormi kasutaja- ja HTTP-sisenemispinnad enne funktsioonide süvaanalüüsi  
**Baaskuupäev:** 2026-08-08  
**Baasi HEAD:** `f57620204b52990dab207fa71e9744ab19f261ba`

## 1. Eelkaardistuse tulemus

```text
94    App Routeri lehte
392   App Routeri API-route'i
1     App Routeri layout
3     App Routeri boundary-faili (error/loading jms)
1     Pages Routeri API-route
1     Pages Routeri special boundary
----
492   lehe, route'i või boundary kirjet kokku
```

Täielik register on failis [sotsiaalai-sol-lehtede-ja-routeide-register.csv](C:\Users\rauds\Desktop\SotsiaalAI\docs\audits\sotsiaalai-sol-lehtede-ja-routeide-register.csv).

## 2. Registri tähendus

Iga kirje sisaldab:

- pinnatüüpi (`page`, `api-route`, `layout`, `boundary`, `pages-router`);
- kasutatud router'i;
- staatilist route'i mustrit;
- lähtefaili täpset asukohta;
- route'i esmast rühma;
- dünaamilisi parameetreid;
- olekut `inventory_only`.

Dünaamilised Next.js segmendid on eelkaardis näidatud loetaval kujul, näiteks `[id]` → `:id` ja `[...path]` → `*path`. See on ainult route'i lugemise lihtsustus, mitte runtime-käitumise tõend.

## 3. Mida see kaart veel ei väida

Eelkaart ei väida veel:

- milline kasutajaroll lehele ligi pääseb;
- millised funktsioonid lehel tegelikult töötavad;
- milliseid API-route'e leht kasutab;
- milline `lib`-funktsioon on route'i tegelik äriloogika;
- kas serveripoolne õiguste kontroll on olemas;
- kas route on runtime'is saavutatav või aktiivselt kasutatud.

Need küsimused lähevad Soli süvaanalüüsi.

## 4. Järgmine kaardistamiskiht

Järgmine samm on siduda 94 lehte nende nähtavate põhifunktsioonidega. Funktsioon tuleb kirjeldada kasutaja tegevuse tasemel, näiteks:

```text
leht: /vestlus
funktsioonid:
- vestluse alustamine
- sõnumi saatmine
- ajaloo vaatamine
- allikate vaatamine
- vestluse eksport või kustutamine
```

Seejärel lisatakse tehniline seos:

```text
leht
→ peamine komponent
→ API-route või server action
→ lib-funktsioon
→ Prisma / rag-service / väline teenus
```

Selles etapis ei tehta veel kvaliteedi- ega turvaverdiktit. Ebaselged seosed märgitakse `not_proven`, mitte ei täideta oletusega.
