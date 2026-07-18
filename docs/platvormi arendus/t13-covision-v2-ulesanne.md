# ÜLESANNE: T13 `COVISION-V2` — Kovisiooni ruumiline tervikmudel (PROTOTÜÜP-ESIMENE)

**Olek:** `READY_TO_ASSIGN — PROTOTÜÜP-ESIMENE`. Teema oli `DEFERRED_BY_OWNER`; selle lepingu koostamine on omaniku otsus see uuesti avada. **Backend (8 etappi + atomaarne sulgemine + purge) on VALMIS ja main'is runtime-tõendatud — V2 on ruumiline UI-mudel, MITTE andmekiht.**
**Teostus:** kaks faasi. **Faas A = prototüüp** (kohustuslik värav, omaniku enda lukustatud reegel); **Faas B = tootmiskood** (KOV-R paketid), avaneb AINULT prototüübi vastuvõtu järel.
**Soovitatud teostaja:** Fable High (kujundus-/interaktsioonivedu) prototüübile; Sol/Fable High tootmisele.
**Alus:** analüüs valmis — `docs/platvormi arendus/fable-5-kovisiooni-tervikvoo-teadmistekaart.md` (KOV-Q1 metoodika, KOV-Q2 variandid, **KOV-R ruumiline tervikmudel** R1–R13, prototüübi kriteeriumid Q2.7, otsused R13-D1…D8) + `docs/platvormi arendus/ruumilised-lehe-faasid.md` (lõuendireegel + flip-grammatika).

## KAKS ERINEVUST TEISTEST LEPINGUTEST (loe kõigepealt)

1. **T13 oli `DEFERRED_BY_OWNER`** (koos T19-ga). Selle lepingu väljastamine avab teema uuesti. **T19-pinget EI OLE:** register (rida 350) ütleb, et kuni T19 on deferred, lahendab iga teema oma ruumilisuse **ise oma lepingu piires**. T13 V2 ehitab **Kovisiooni-spetsiifilise ruumilise UI**, EI taaskäivita T19 jagatud esitlusmootorit ega oota seda.
2. **T13 on PROTOTÜÜP-ESIMENE — see on omaniku enda lukustatud reegel** (KOV-Q2.7, R11). Erinevalt T22/T14/T21-st ei lähe T13 otse tootmiskoodi: keskne ruumiline hüpotees (kaks lehte Ühine/Minu + flip, R13-D8) **otsustatakse prototüübi tulemusega**. Kui prototüübi kriteeriumid 2 (privaatsuse eksimatus), 4 (ringi puutumatus) ja 5 (värav ≠ dekoratsioon) ei tõendu, ei päästa ükski suurem ehitus mudelit — need kolm ONGI ruumilise Kovisiooni mõte.

## Eesmärk

Kovisiooni sessioon mahub ekraanile **kerimata**, iga etapp on ruumiliselt loetav ja privaatsuspiir (mis on grupile nähtav, mis privaatne) on eksimatu. Info liigub ekraani piires (flip/kate/dokk), mitte kerides. Metoodilised invariandid (omanik ei sekku refleksiooniringis; värav = etapp lõppes/algas; MINA-vorm) on ruumis nähtavad. Backend'i 8-etapi serveriloogikat, väravaid ega API-lepingut ei muudeta (v.a teadlikud R13-D otsused, mis on prototüübi järel).

## Loe enne tervikuna

1. `CLAUDE.md`
2. `docs/platvormi arendus/teemaarenduse-jatkamise-kord.md`
3. `docs/platvormi arendus/fable-5-kovisiooni-tervikvoo-teadmistekaart.md` — **tervikuna**, eriti KOV-Q1 (metoodika-invariandid Q1.0/Q1.9/Q1.10), KOV-Q2.7 (prototüübi kriteeriumid 1–9), **KOV-R R1–R13** (ruumimudel, R5.0 lõuendireegel, R13-D1…D8 otsused).
4. `docs/platvormi arendus/ruumilised-lehe-faasid.md` — lõuendireegel + flip/voltimine + värav.
5. `docs/platvormi arendus/arendusteemade-masterregister.md` — T13 (rida 298).
6. **Kood:** `components/covision/CovisionWorkspace.jsx` (aktiivne, andmekihiga seotud — MITTE surnud `CovisionSession.jsx`), `app/styles/covision-live.css` (**`.cvl-shell{overflow-y:auto}` on lõuendireegli rikkumine — esimene parandus**), `/kovisioon` leht, `/api/covision/[id]/session` + `/session/actions` (stage/phase/PrivateState/COMPLETE_STAGE lepingud).
7. `docs/platvormi arendus/tehis-testkontod.md` + `Kovisioon/HANDOFF-paris-ui-kuvatoendid.md` (töötav login-runtime retsept).

## Alus ja worktree

> **BACKEND ON VALMIS JA MAIN'IS.** 8 etappi serveriväravatega, atomaarne sulgemine + purge, lõpetatud juhtumid, parimad praktikad, RAG — kõik runtime-tõendatud (teadmistekaart ptk 3–8). **V2 EI muuda skeemi, marsruute ega API-lepingut** (v.a R13-D4/D5, mis on eraldi otsustuspaketid PÄRAST prototüüpi). Surnud `CovisionSession.jsx` on kustutatud (18.07).

> **PROTOTÜÜBI PIIRANG (KOV-LIMIT-1):** brauseripaani hüdratsioon ja ruumitausta screenshot-timeout välistavad paani-põhise kontrolli. Prototüübi runtime AINULT päris brauseris; server `preview_start` config'iga `next-dev` (vt `CLAUDE.md`).

1. **Baas = `main`-i PRAEGUNE tipp.** `git rev-parse main`, raporteeri SHA (koostamise ajal `d8a7c826`).
2. Worktree: `git worktree add ../SotsiaalAI-covision-v2 -b codex/covision-v2 main`.
3. **Migratsioon: 0** (ruumiline UI olemasolevate lepingute peal). R13-D4/D5 serveripaketid on eraldi, prototüübi järel.
4. Tõlkefailid ainult T13 võtmetes.
5. Lõpetamisel: **Faas A (prototüüp) EI lähe merge'i tootmisse enne omaniku vastuvõttu.** Faas B väravad rohelised → merge samal päeval. `main`, server, merge, deploy puutumata kuni omaniku loani.

## Lukustatud otsused (R13-D1…D8 — soovitused; D8 otsustab prototüüp)

| Otsus | Lukustatud valik |
|---|---|
| R13-D1 ettevalmistusrada (tupik) | **(b)** kärbi rada üheks sammuks; ettevalmistus hiljem seemnekaardi „tagaküljena". Tupik eemaldatakse (R12-1). |
| R13-D2 OBSERVER ruumis | **(a)** andmemudel jääb, UI EI paku (kuni konsensusvoog olemas). |
| R13-D3 kellade loogika | **(c)** kulunud aeg mõlemal kellal + juhi puldis valikuline sihtaeg (ainult juhile nähtav). Ei pöördloendurit (tempo-surve keeld). |
| R13-D4 refleksiooniringi serveripiir | **(a) nüüd** ainult UI-lukk; serveripiir (b) = eraldi otsustuspakett PÄRAST prototüüpi (kui UI-lukk osutub piisavaks, API-t ei muudeta). |
| R13-D5 faasivalmiduse signaal | **(b) sisuvaba „valmis" fakt**, aga ALLES pärast prototüüpi (prototüüp mõõdab, kas juhi häälega küsimine (a) piisab). |
| R13-D6 aktsent + tüpograafia | merevaik sessioonis (piltide järjepidevus), serif ainult raamatukogus. |
| R13-D7 järelkihi ulatus 1. ringis | **(a)** ainult kest+värvid; V3 lugemisrada eraldi pakett pärast P10. |
| **R13-D8 etapi lehtede mudel** | **(a) kaks püsivat lehte Ühine/Minu + flip (H1–H2) prototüüpi; OTSUS TEHAKSE PROTOTÜÜBI TULEMUSEGA** (R11 kriteerium 13). (c) etapiti erinev = tagavara, kui flip võidab ainult privaatrasketes etappides (e4/e7). |

## Faas A — Prototüüp (KOHUSTUSLIK VÄRAV)

Prototüüp muudab AINULT aktiivset `CovisionWorkspace`'i `/kovisioon` lehel; 0 skeemi-/marsruudi-/API-muudatust (kõik elemendid istuvad olemasoleva `stage/phase/PrivateState/COMPLETE_STAGE` peal). Ei puuduta Teemaseemneid, Lõpetatud juhtumeid ega Parimaid praktikaid.

**Prototüüp peab päris kasutajatega tõendama (KOV-Q2.7 kriteeriumid 1–9; läbiviimine päris brauseris):**
1. **Etapiteadlikkus** — ≥9/10 õiget „mis etapp / mida tohib".
2. **Privaatsuse eksimatus (KRIITILINE, 0 viga)** — iga kaardi kohta õige „kas grupp näeb"; sahtli ja laua eristus ilma kahtlusjuhtudeta.
3. **Küsimuse püsivus** — omaniku küsimus meenutatav ka etapi 5 keskel (ankrukapsel).
4. **Ringi puutumatus (KRIITILINE)** — refleksioonifaasis omanik ei sekku, grupp ei adresseeri teda.
5. **Värav ≠ dekoratsioon (KRIITILINE)** — üleminek = „etapp lõppes/algas", mitte „ilus animatsioon"; keegi ei oota, et aeg/kerimine ise edasi viib.
6. **MINA-vormi loomulikkus** — võimalused algavad mina-vormis ilma juhi meeldetuletuseta.
7. **Pariteet** — sama stsenaarium klaviatuuriga ja reduced-motion režiimis ilma sisu kaotamata.
8. **Rahu** — vaikuseminutid tunduvad toetatud, mitte „ootamisena".
9. **Jõudlus** — üleminekud sujuvad päris masinatel Galaxy-taustaga (blur-kihtidel EI transform-animatsioone; mõõda enne/pärast).

**Prototüübi skoop = KOV-R keskne hüpotees:** kaks lehte Ühine/Minu + flip (R13-D8 (a)), lõuendireegel (0 kesta-kerimist 1920×1080 JA 1536×864 — R11 kriteerium 12), värav = etapi/faasi liikumishierarhia (H4: etapp = sügavustõuge ~0,5s, faas = mikro-tõuge ~0,2s, leht = flip). **Väljund:** tõendatud prototüüp + go/no-go R13-D8 mudelile + prototüübi raport samas dokumendisarjas.

> **Faas A vastuvõtt = omaniku otsus.** Kui kriteeriumid 2/4/5 ei tõendu, mudel vaadatakse üle ENNE Faas B-d. Faas B ei alga ilma prototüübi vastuvõtuta.

## Faas B — Tootmiskood (AINULT prototüübi vastuvõtu järel; KOV-R paketid R12)

Väljastatakse eraldi, prototüübi tulemusega täpsustatud skoobiga. Eeldatav järjekord (KOV-R R12):
- **R12-1 (esimene):** lõuendireegli parandus (R5.0) — `.cvl-shell` ei keri, tsoonid kõrgusgridi, `.cvl-canvas` min-height maha; ettevalmistusraja tupik eemaldatud (R13-D1 b).
- **R12-2…:** ruumikest/dokk, kõrgusmudel, ankur/faasiriba+kompass, kaks lehte Ühine/Minu (R13-D8 tulemusega), etapikatted, privaatsusläved, refleksiooniringi UI-lukk (R12-3, R13-D4 a), faasivalmiduse signaal (R13-D5 b), mobiil/reduced-motion, aktsent/tüpograafia (R13-D6), visuaalne viimistlus.
- **Eraldi otsustuspaketid pärast prototüüpi:** R13-D4 (b) serveripiir + R13-D5 (b) valmiduse-fakt, KUI prototüüp näitab UI-luku/hääle ebapiisavust.

## Selgelt väljas

- Backend'i 8-etapi loogika, väravad, atomaarne sulgemine/purge, API-leping (v.a R13-D4/D5 eraldi paketid pärast prototüüpi).
- T19 jagatud esitlusmootori taaskäivitamine; Flight ruumikaadrite teekond; helix/karussell ühisfaasidesse; AI-panused ühislauale; eraldi vestlusaken; reaktsioonid/skoorid/aktiivsusmõõdikud; automaatne/taimeripõhine faasivahetus.
- Teemaseemned, Lõpetatud juhtumid, Parimad praktikad (eraldi lehed).
- Faas B enne prototüübi vastuvõttu; merge, deploy, PR, tootmisandmete lugemine, päris kasutajate testimine ilma nõusolekuta.

## Nõutud tõenduslepingud (Faas A)

1. **Lõuendireegel:** 0 kesta-kerimist 1920×1080 JA 1536×864 kõigil 8 etapil (JS `getComputedStyle`/scrollHeight, MITTE screenshot — KOV-LIMIT-1).
2. **Privaatsuse eksimatus:** iga kaart kannab nähtavat „privaatne/jagatud" märgist; flip Minu↔Ühine ei jäta ühtki kahtlusjuhtu; refleksioonimärgid nähtamatud teistes vaadetes.
3. **Ringi puutumatus:** e4 omaniku vaates komposer/„Tänan"/sisendid lukus, aktiivne ainult privaatmärkmik; grupi vaates omaniku marker väljas ringist „kuulab"; ringist naasmine AINULT faasivahetusega.
4. **Värav:** etapi/faasi üleminek on selgelt tajutav liikumishierarhiana; blur-kihtidel 0 transform-animatsiooni (jõudlus).
5. **Pariteet:** täisstsenaarium klaviatuuriga + reduced-motion lame variant ilma sisu kaotamata.
6. **Backend puutumata:** 8-etapi väravad, COMPLETE_STAGE tõendid, atomaarne sulgemine, testid (`npm test`) jäävad roheliseks; prototüüp ei muuda API-lepingut.

Käivita `npm test` (regressioon), muudetud failide lint, `npm run i18n:check`, `git diff --check`, build. Runtime AINULT päris brauseris (login-retsept `Kovisioon/HANDOFF-paris-ui-kuvatoendid.md`).

## DoD

**Faas A valmis on siis, kui:** prototüüp on aktiivsel `CovisionWorkspace`'il (0 skeemi-/API-muudatust), kriteeriumid 1–9 on päris brauseris tõendatud (eriti 2/4/5), lõuendireegel peab 0 kerimist mõlemal resolutsioonil, backend-regressioon roheline, prototüübi raport kirjutatud + R13-D8 go/no-go antud, worktree puhas, commit/push tehtud. **Faas B ei alga ilma omaniku vastuvõtuta.** `main`, server, merge, deploy puutumata.

## Lõpparuanne (Faas A)

Esita worktree, haru, baas-SHA, lõppcommit/remote SHA, prototüübi kriteeriumide 1–9 tulemus (tõendatud/ei), lõuendireegel mõlemal resolutsioonil, backend-regressioon, **R13-D8 go/no-go**, mis vajab Faas B otsust (R13-D4/D5 kui UI-lukk ebapiisav), ning kinnitus, et backend'i, tootmisandmeid, merge'i ega deploy'd ei puudutatud.

Pärast Faas A raportit teeb Fable/omanik prototüübi vastuvõtu-otsuse: kas Faas B (R12 tootmispaketid) käivitub ja millise R13-D8 mudeliga.

## Lõpetamisel: uuenda AINULT `SEIS.md`

1. **Seisutabeli rida** → uus olek (nt `PROTOTYPE_DONE` / `PROTOTYPE_REJECTED`), haru + SHA, kriteeriumide tulemus, R13-D8 otsus.
2. **Järjekord** → kas Faas B avanes, mis järgmine.
3. **Vananenud väide** → paranda kohe (nt T13 „DEFERRED" → aktiivne).

Masterregistrit ei uuendata oleku pärast. Kirjuta SEIS-i ka pooleliolek.
