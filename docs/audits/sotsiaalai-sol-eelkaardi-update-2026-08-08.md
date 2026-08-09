# SotsiaalAI — auditi eelkaardi uuendus 2026-08-08

**Uus HEAD:** `cfa62ea8ad161aef04442b1c43048656c7d0e289`  
**Võrdlusbaas:** `f57620204b52990dab207fa71e9744ab19f261ba`  
**Baaskaart:** 1 460 põhifaili  
**Praegune põhikaart:** 1 480 põhifaili

## Mis juurde tuli

Võrdluses leiti 20 uut sisulist faili. Need moodustavad uue casework/draft/transfer/retention funktsionaalse ala:

- 9 API-route'i `app/api/casework/...` all;
- 3 kasutajaliidese faili `components/casework/` all;
- 4 äriloogika faili `lib/casework/` all;
- 4 Prisma migratsiooni `prisma/migrations/` all.

Uued failid on eraldi registris [sotsiaalai-sol-eelkaardistus-update-2026-08-08.csv](C:\Users\rauds\Desktop\SotsiaalAI\docs\audits\sotsiaalai-sol-eelkaardistus-update-2026-08-08.csv).

Uued route'id on eraldi registris [sotsiaalai-sol-lehtede-ja-routeide-update-2026-08-08.csv](C:\Users\rauds\Desktop\SotsiaalAI\docs\audits\sotsiaalai-sol-lehtede-ja-routeide-update-2026-08-08.csv).

## Mõju olemasolevale kaardile

- uusi `page.*` lehti ei lisandunud;
- API-route'ide arv suurenes 392-lt 401-ni;
- pinnaregistri kogumaht suurenes 492-lt 501-ni;
- olemasolev lehtede funktsioonieelkaart vajab casework-route'ide tõttu täiendavat seostamist, kuigi uusi lehepindu ei ole.

## Auditistaatus

See on inventuuriuuendus, mitte süvaanalüüs. Uus ala tuleb Soli analüüsis eraldi käsitleda: draft'i olekud, transfer-sündmused, STAR2-blokk, retention/purge ning seotud omandi- ja rollipiirid.
