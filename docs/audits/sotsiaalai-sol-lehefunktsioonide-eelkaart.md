# SotsiaalAI — lehtede ja põhifunktsioonide eelkaart

**Staatus:** `PREMAP_READY`  
**Baaskuupäev:** 2026-08-08  
**Kokku:** 94 lehepinna kirjet

See on route'i põhjal koostatud eelkaart. `candidate_function_scope` on esialgne funktsioonivaldkond, mitte lähtekoodist kinnitatud analüüs.

## Funktsioonivaldkondade jaotus

| Funktsioonivaldkond | Lehti |
|---|---:|
| organisatsioon | 18 |
| admin ja haldus | 13 |
| supervisioon | 7 |
| avalik info ja õigus | 5 |
| teadmised ja praktika | 5 |
| töölaud | 5 |
| autentimine | 4 |
| konto ja jagamised | 4 |
| mentorlus | 4 |
| paketid ja toetused | 4 |
| juhtumitöö ja kiire abi | 3 |
| ruumid ja koostöö | 3 |
| teenused ja teenusekaart | 3 |
| tööheaolu | 3 |
| dokumendid ja artefaktid | 2 |
| teekond | 2 |
| tehniline või abipind | 2 |
| välitöö | 2 |
| avalik sisenemine | 1 |
| eelpöördumised | 1 |
| kovisioon | 1 |
| otsing | 1 |
| vestlus | 1 |

Täielik leht → funktsioonivaldkond register on failis [sotsiaalai-sol-lehefunktsioonide-eelkaart.csv](C:\Users\rauds\Desktop\SotsiaalAI\docs\audits\sotsiaalai-sol-lehefunktsioonide-eelkaart.csv).

## Soli järgmine kontroll

Sol peab iga lehepinna puhul kontrollima:

- kas kirjeldatud põhifunktsioon on lähtekoodis olemas;
- millised komponendid ja API-route'id seda toetavad;
- millised `lib`-funktsioonid tegelikult käivituvad;
- millised Prisma mudelid või välised teenused on seotud;
- milline auth/rolli- ja omanikukontroll kehtib;
- kas funktsioon on täielik, osaline, dubleeriv või kasutamata.

Kaardistamata või oletuslikud seosed tuleb märkida `not_proven`.
