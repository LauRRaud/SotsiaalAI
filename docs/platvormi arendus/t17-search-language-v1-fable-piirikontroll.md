# Fable'i fokuseeritud kontroll: T17 `SEARCH-LANGUAGE-V1`

**Kontrollitav haru:** `codex/search-language-v1 @ ed95d6aab12722496f97ba8fafb13201767e74ce`  
**Vahemik:** `fe4eb4fa7997a7eada9417a27c6cea75ccd23cbe..ed95d6aab12722496f97ba8fafb13201767e74ce`  
**Tüüp:** ainult lepingupiiride lugemiskontroll. **Ära muuda koodi ega dokumente, ära käivita teste, buildi, linti, Prisma kontrolli või runtime'i.**

## Eesmärk

Kontrolli üksnes, kas T17 lõppcommit säilitab kasutajaandmete omandi- ja sisupiiri ning selge keele kaitserajad. See ei ole uus audit ega teostaja kontrollide kordamine.

## Loe

1. `docs/platvormi arendus/t17-search-language-v1-ulesanne.md` — nõutud leping.
2. Lõpparuande kokkuvõte ja diff nimetatud vahemikus.
3. Eeskätt `app/api/otsi/route.js`, `lib/search/personalSearch.js`, `lib/journey/plainLanguageExplanation.js`, `app/api/journeys/[id]/plain-language/route.js`, `components/search/PersonalSearchPage.jsx`, `components/journey/JourneyDetail.jsx` ja nende T17 testid.

## Kontrolli täpselt viit asja

1. **Omand ja sisu:** `/otsi` tagastab ainult autentitud kasutaja enda vestlused, Teekonnad ja dokumendid; tulemus ei sisalda preview'd, sõnumi-/dokumendikeha, ruumisisu ega suvalist href'i. Dokumendi tulemus võib viia `/documents`, sest turvalist detail-süvalinki V1-s ei ole.
2. **Nõusolek ja erandid:** „Selgita lihtsalt” nõuab serveris nõusolekut/eelvaadet ning käsitsi API-kutse ei läbi kriisi-, õigus- ega ametliku dokumendi teksti. Unicode'i eesti- ja venekeelsed terminid on päriselt kaetud, mitte ASCII `\b`/`\w` eeldusel.
3. **Originaali säilimine:** selgitus ei kirjuta algset teksti üle, ei muutu vaikimisi ametlikuks dokumendiks ega käivita dokumendigenereerimise rada.
4. **Ligipääsetavus:** otsingupinnal on semantiline vorm/tulemused, nähtav fookus ning `aria-live` laadimis-, vea- ja tühja oleku jaoks; reduced-motion ei lisa nõutud liikumist.
5. **Teadlikud piiriotsused:** `/otsi` on ainult-autenditud, mitte tellimusepõhine; see on soovitud, sest tasuta kasutaja peab saama otsida oma vestlusi. Ära märgi seda leiuks.

## Väljund

Kirjuta lühike tulemus samasse vastusesse: `PASS` või `CHANGES_NEEDED`; viie punkti kaupa tõendatud failid/rida või konkreetne lepingurikkumine. `NOT_PROVEN` märgi ainult siis, kui seda ei saa diffist ja lähtekoodist otsustada. Ära korda teostaja 23+30 testi, i18n-i, Prisma, linti, buildi ega kahest kasutajast runtime'i.

`PASS` järel on T17 `CODE_READY` ning T11, T03 ja T07 võivad kasutada `ed95d6aa` stack'i alusena. Merge, deploy ja T27 koondkontroll jäävad välja.
