# ADR-033 — Allikate soojendus serveri käivitusel

27.09.2026. Teostus Claude Opus 5.5. Järgib [ADR-032](adr-032-national-law-reserve-and-plan-restart.md) elavat kontrolli ja HANDOFF-i punkti 4b (esimese pöörde kiirus).

## Probleem

Esimene vestluspööre pärast deploy'd või vestlusplaani ümberehitust (mõlemad taaskäivitavad `sotsiaalai-frontend`-i) kestis 43–45 s, järgmised ~17 s.
- 27.09 hommikul: B9 45 s, sellest otsing 29 s. ADR-032 elav kontroll: 42,7 s, sellest otsing 33,3 s.
- Protsess kontrollib iga allika esimesel puudutusel täielikult: bundle'i räsi ja kataloogirida, allikaobjektide võrdlus ning ühikute salvestatud morfoloogia uus EstNLTK analüüs (`PostgresCatalog.bundles()` ja `units()`). Kontrollitud read jäävad protsessi mällu (`verified`), järgmised lugemised on odavad.
- Taustasoojendus (`postgres.warm()`, 1124 teadmusallikat) algas alles esimese pöörde `preflight`-is. Esimene küsimus kontrollis seega oma allikad ise ja võistles samal ajal soojendusega sama EstNLTK protsessi ja Postgresi pärast.
- ADR-032 reserv toob valijani riiklikud aktid (Riigilõivuseaduses 714 ühikut, SHS-is 295). Nende esimene puudutus on kallis.

Mõõtmine värskes protsessis (serveris, B9 teadmusrada koos reserviga, tasuta asendusvalija):

| | külm | soe |
|---|---:|---:|
| Otsing kokku | 12,2 s | 2,4 s |
| valija hulga ühikute laadimine ja kontroll (`rerank` aeg) | 8,3 s | 0,4 s |
| valitud allikate laadimine | 1,2 s | 0,3 s |
| sõnaline päring | 2,2 s | 1,6 s |

Elava pöörde ülejäänud ~20 s oli sama kontroll teistes radades (kataloog, perioodid) ja võistlus taustasoojendusega.

## Otsus

- **Soojendus algab serveri käivitusel.** Next.js-i `instrumentation.js` `register()` käivitab 2 s pärast starti taustal `warmPilotAtStart()` (`lib/rag-v2/pilot/retrieval.js`).
  - Loeb aktiivse plaani failist (`M4_PILOT_CONFIG`) ainult tenant'i, indeksipõlvkonna ja dokumendid. Mudelikutset, väliskutset ega ligipääsu otsust pole.
  - Töötab ainult siis, kui `M4_PILOT_ENABLED=1`, plaan on `real` ja ühise otsinguga (`retrievalRouting`), ning plaani põlvkond on aktiivne. Muidu ei tee midagi.
  - Ei käivitu build'i ajal (`NEXT_PHASE`) ega Edge'i runtime'is. Viga ainult logitakse; server käivitub igal juhul.
- **Üks soojendus protsessi ja põlvkonna kohta** (`warmKnowledgeSources`, globaalne `WARMING` hulk). `preflight` kutsub sama funktsiooni ja soojendab ainult siis, kui käivitusel seda ei tehtud või see katkes.
- **Riiklikud õigustekstid esimesena.** Reserv loeb neid peaaegu igal küsimusel.

Muutmata: kontrollide sisu ja range (iga allikas kontrollitakse enne kasutamist täielikult), vahemälu piirid, `RAG_V2_ESTNLTK_IDLE_MS`.

## Mõõtmine

Serveris värskes protsessis aktiivse plaaniga `m4-corpus-chat-20260927l` (`warm-check.mjs`, sama kood):
- `warmPilotAtStart()` luges plaani ja alustas (`started: true`).
- 7 riiklikku õigusteksti olid kontrollitud 7,7 s pärast, kõik 1124 teadmusallikat 284 s (4,7 min) pärast.
- Seejärel B9 teadmusraja otsing: **2,4 s** (valija hulk 0,38 s, sõnaline päring 1,0 s). Külmas protsessis oli sama otsing 12,2 s.
- Kulu: üks embedding-päring (~0,00001 USD).

Kontrolli pärast deploy'd serveri logist: `[rag-v2] start warm-up started` ja mõne minuti pärast `[rag-v2] warmed 1124 sources in … s`.

**Elav kontroll 27.09.2026, PR #201 (`5b09e80e`) ja plaan `m4-corpus-chat-20260927m` (id …-1000):**
- Logi: taaskäivitus 13:00:48, `[rag-v2] start warm-up started` 13:00:50, `[rag-v2] warmed 1124 sources in 288 s` 13:05:37.
- Esimene pööre pärast soojendust (B9, uus vestlus, `fe5de48d`): **23,3 s**, otsingufaas 12,0 s, vastus 7,8 s. Enne seda muudatust oli sama esimene pööre 42,7 s (otsing 29,4 s).
- Kohe järgmine sama küsimus uues vestluses (`220e02f2`): 12,7 s, otsing 4,0 s.
- Teine elav kontroll pärast indeksi v27 aktiveerimist ja plaani `o` taaskäivitust (soojendus 14:14–14:19, pööre 14:23, `0f581b28`): esimene pööre selles protsessis **14,1 s**, otsing 4,0 s, sama mis soe pööre.
- 13:08 kontrollis jäi esimesse pöördesse veel ~8 s külma tööd, 14:23 kontrollis mitte. Kandidaadid, mõõtmata: täis-bundle'id (soojendus kontrollib, aga ei hoia neid LRU vahemälus: `cache: false`), omavalitsuse kataloogi ja piirkondade esimene laadimine, Postgres'i paralleelse sõnalise päringu esimene jooks.

## Piirid

- Soojendus võtab mitu minutit. Selle aja sees esitatud küsimus võistleb endiselt soojendusega.
- Vastuse mudeli aeg (~9–10 s, `medium`) jääb põrandaks; vastuse voogedastus kasutajaliidesesse on tegemata.
- `instrumentation.js` ei kuulu implementatsiooni räsisse; `lib/rag-v2/pilot/retrieval.js` kuulub, seega vajab deploy vestlusplaani ümberehitust.
- Soojendus kasutab sama EstNLTK protsessi, mis vestlus.
