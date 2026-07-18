# ÜLESANNE: T17 `SEARCH-LANGUAGE-V1` — isiklik otsing ja selge keel

**Olek:** `IN_PROGRESS_PAUSED` — jätka failiga `t17-search-language-v1-jatkuulesanne.md` olemasolevas `SotsiaalAI-search-language-v1` worktree's.  
**Teostus:** üks worktree, üks haru, üks terviklik lõppüleandmine  
**Soovitatud teostaja:** Terra Medium või Fable Medium

## Eesmärk

Kasutaja leiab oma tööobjektid usaldusväärselt, ilma et otsing avardaks tema õigusi või tooks nähtavale teise inimese sisu. Samal ajal saab ta valida selgema esitusviisi, mis aitab vastusest või juhitud töövoost aru saada, kuid ei kirjuta ümber ametlikku teksti, allikaid, tähtaegu ega hädaolukorra juhiseid.

Valmis teema tähendab, et:

1. vestluste otsing leiab kogu kasutaja lubatud vestlusajaloo, mitte ainult parasjagu laetud loendi;
2. kasutajal on üks ligipääsetav „Minu otsing” pind, kust ta leiab vähemalt oma vestlused, Teekonnad ja dokumendid nende turvaliste pealkirjade ja olekute järgi;
3. tulemus ei kuva sõnumi-, dokumendi- ega ruumisisu snippet'it, ei otsi teiste inimeste teksti ega anna administraatorile globaalset otsingut;
4. selge keele eelistus on nähtav, püsiv ja vabatahtlik ning aitab ainult seal, kus algne sisu jääb samal ajal alles;
5. kriisi-, õigus- ja ametliku dokumendi algne sõnastus jääb puutumata ning 112-juhis on selge keele vastusest alati eristatav ja esmane.

## Loe enne tervikuna

1. `CLAUDE.md`
2. `docs/platvormi arendus/teemaarenduse-jatkamise-kord.md`
3. `docs/platvormi arendus/arendusteemade-masterregister.md` — T17
4. `docs/platvormi arendus/koordinaatori-handoff-2026-07-16.md` — U6/U7 ajalooline tõend
5. U6 aluscommit'i dokument `14-opus-u6-isiklik-otsing-tooplaan-ja-progress.md` commit'is `ada42497372c93bee32e4c1ba606d3860aed02af`
6. U7 aluscommit'i dokument `15-sol-u7-selge-keele-reziim-progress.md` commit'is `657d3c68ac75317e72d51bb8b5c9d7c2d80c8bd0`
7. `components/ChatSidebar.jsx`, `app/api/chat/conversations/route.js`, `components/accessibility/AccessibilityProvider.jsx`, `components/accessibility/AccessibilityModal.jsx`, `components/workspace/WorkspaceFeaturePage.jsx`
8. oma tööobjektide serveripoolsed route'id/mudelid: vestlused, `Journey`, `UserDocument` ja nende olemasolevad detaililehed.

## Alus ja worktree

1. Kontrolli enne alustamist `origin/main` SHA-d. Ülesande koostamise hetkel on see `fe4eb4fa7997a7eada9417a27c6cea75ccd23cbe`.
2. Ära kasuta ega muuda määrdunud põhitööpuud `C:\Users\rauds\Desktop\SotsiaalAI`.
3. Loo uus worktree, näiteks `C:\Users\rauds\Desktop\SotsiaalAI-search-language-v1`, ning haru `codex/search-language-v1` värskest `origin/main`-ist.
4. Too alusena samasse harusse `cherry-pick -x ada42497372c93bee32e4c1ba606d3860aed02af`, seejärel `cherry-pick -x 657d3c68ac75317e72d51bb8b5c9d7c2d80c8bd0`. Auditcommit'e `9c465922` ja `8eb50912` ei cherry-pick'ita: need on kontrollitõend, mitte koodialus.
5. Lahenda võimalikud ühiste `messages/*.json` konfliktid üksnes T17 võtmete piires ning säilita kõik kummagi aluse testid. Ära rebase'i ega kasuta põhitööpuud alusena.

## Lukustatud V1 valikud

| Teema | V1 valik |
|---|---|
| Otsingu õigused | Server liidab tulemused ainult praeguse kasutaja juba lubatud objektidest. Iga päring säilitab omandi-/osaleja- ja aegumise filtrid; puuduv ligipääs annab sama turvalise tühja/404 käitumise nagu detailipind. |
| Otsitavad objektid | Vestlused (U6), kasutaja enda `Journey` ja kasutaja enda `UserDocument`. Otsitakse ainult turvalisi metaandmeid: pealkiri, kasutajale nähtav olek ja kuupäev. Sõnumi sisu jääb U6 vestluseotsingu serveri poolele; ristotsing ei tagasta ühtki sisujuppi. |
| Väljas olev sisu | Eelpöördumiste kehad, ruumide sõnumid, kovisiooni/juhtumitöö sisu, Tööheaolu refleksioonid, jagatud objektid ja kõik võõrad objektid ei lähe sellesse V1 otsingusse. |
| Selge keel | U7 eelistus on kasutaja kontrollitav režiim. See annab tavavestluses selgema AI-vastuse ning juhitud eelpöördumises alternatiivse esituse; algne kasutajasisend ega ametlik dokument ei muutu. |
| Selgitamine | „Selgita lihtsalt” on nõusolekupõhine ainult kasutaja enda nähtava, platvormi loodud kokkuvõtte või juhise juures. Eelvaade näitab, milline tekst saadetakse; algne ja allikas/versioon jäävad alati kõrvuti avatavaks. Kui turvalist allikat või versiooni ei ole, nuppu ei kuvata. |
| Erandid | Kriisiteade, 112, ametlik õigus-/nõusolekutekst ja allkirjastatud/vormistatud dokument ei saa lihtsustatud asendust. Nende kõrval võib olla ainult neutraalne lugemisabi, mis ei muuda fakti ega juhist. |
| Tulemusvorm | Otsingutulemuses on tüüp, turvaline pealkiri, olek/kuupäev ning olemasolev detaili-süvalink. Tulemust ei tohi usaldusväärsuse näitamiseks värvi abil üksi eristada. |

## Teostus

### E1 — U6/U7 aluspakettide terviklik toomine

- Too mõlemad aluscommit'id ja nende testid T17 harusse. Jäta alles U6 serveripoolne vestluseotsing, cursor, abort/latest-request olekud ning U7 literal-boolean fail-closed preference'i ahel.
- Paranda vaid tegelik integratsioonikonflikt. Ära muuda U6 otsingut pelgaks kliendifiltriks ega U7 eelistust teenuseosutaja `simple_language` võimekusega samaks asjaks.
- Lisa T17 dokumentatsiooni lühike aluscommit'ide ja konfliktide märge.

### E2 — omandipiiriga „Minu otsing”

- Loo autentitud otsingupind, näiteks `/otsi`, ning selle serveriliides. Ühenda üksnes kolme lukustatud tüübi tulemused: vestlused, oma Teekonnad ja oma dokumendid.
- Kasuta iga tüübi olemasolevat autoriteetset omandi-/nähtavusfiltrit; ära ehita globaalset indeksit, taustalugejat ega uut püsivat otsinguandmestikku. Ühtset tulemust tagastav adapter tohib anda ainult `kind`, turvaline `title`, kasutajale nähtav `status`, `updatedAt` ja kinnitatud `href`.
- Päring on piiratud, normaliseeritud ja rate-limit'itud. Tühi päring ei tee laia sisuskanni. Pikkus- ning lehepiir on selgelt määratud ja testitud.
- Vestluse detailotsing jääb U6 lepinguks (title/summary/sõnumisisu enda vestlustes). Ristotsingu tulemus ei korda selle sisu ega preview'd.

### E3 — leitav ja rahulik kasutajaliides

- Lisa navigeerimisest või töölaualt leitav „Minu otsing” sissepääs, ilma et see sõltuks veel merge'imata T05 töölauast. Kui T05 on hiljem main'is, võib see sama route'i linkida, kuid T17 ei cherry-pick'i T05-te.
- Kuva eraldi laadimis-, tühja-, vea- ja tulemuseolek; viga ei tohi väita, et tulemust ei ole. Klaviatuur, nähtav fookus, semantilised tulemused, ekraanilugeja olekuteade ja 375 px vaade on kohustuslikud.
- Tulemuse avamisel kasuta ainult serveri poolt lubatud süvalinki. Ära lase kliendil koostada kasutaja sisendist suvalist URL-i.

### E4 — selge keel ja allika säilimine

- Säilita U7 eelistuse cookie/localStorage/SSR/hydration leping ning olemasoleva chat request-to-prompt ahela fail-closed literal boolean.
- Lisa „Selgita lihtsalt” ainult seal, kus Eesmärgi tabelis lubatud. Nupp avab enne saatmist lühikese nõusoleku/eelvaate: kasutaja näeb allikat, selle versiooni või kuupäeva ja seda, et algne tekst jääb muutmata.
- Vastus ei kirjuta originaali üle, ei salvestu vaikimisi ametliku dokumendina ega muuda otsinguindeksit. Kuvamisel on algne tekst/allikas alati kättesaadav.
- Kriisi-, õigus- ja ametliku dokumendi piir on serveris ning UI-s; kliendi peitmine üksi ei ole turvapiir.

### E5 — keeled ja kasutatavus

- Kõik uus ET/EN/RU copy on sümmeetriline. Selge keele režiim ei tõlgi kasutaja eraandmeid ega saada eelistust eraldi analüütikasse.
- Kontrolli 200% tekstisuurust, klaviatuuri, ekraanilugeja jaoks arusaadavaid nimesid/olekuid, mobiili ja `prefers-reduced-motion` tasast varianti.

## Selgelt väljas

- Admini globaalne otsing, üle-organisatsiooniline koondotsing ja jagatud ruumide sisuotsing.
- Eelpöördumiste kehade, heaolu refleksioonide või teiste inimeste teksti indekseerimine.
- Otsinguindex, `pg_trgm`, semantiline/RAG otsing, ranking või automaatne sisu-snippet.
- Õigus- või nõusolekuteksti ümberkirjutamine, kriisijuhise muutmine ning AI-põhine ametliku dokumendi asendamine.
- T05 töölaud, T07 dokumentide elutsükkel, T15 platvormiülene a11y audit ning maksete/rollide loogika muutmine.
- Merge, deploy, PR, põhitööpuu puhastus, rebase ja force-push.

## Nõutud testilepingud

1. U6 otsing leiab vaste pärast esimest laetud loendit, säilitab `userId`/arhiivi/aegumise/rolli piirid ning cursor töötab koos `q`-ga.
2. „Minu otsing” tagastab ainult kasutaja enda kolme lukustatud tüübi tulemusi; teise kasutaja samanimeline objekt, aegunud objekt ja jagatud ruumi sisu ei leki.
3. Ristotsingu vastus ei sisalda `preview`, sõnumi sisu, dokumendi keha, ruumisisu ega muud toorvälja; iga `href` on serveri allowlist'ist.
4. Tühi, liiga pikk, katkestatud ja ebaõnnestunud päring annab eristatava ning ausa oleku; vana vastus ei kirjuta uut otsingut üle.
5. U7 preference aktsepteerib ainult literal `true`; cookie/localStorage/SSR/hydration ja chat request-to-prompt ahel jäävad ühtseks.
6. Selge keele vastus säilitab allikad, faktid, ebakindluse, tingimused, arvud, kuupäevad ja sõna-sõnalise 112 juhise; see ei jõua dokumendi genereerimise harusse.
7. „Selgita lihtsalt” nõuab eelvaadet/nõusolekut, jätab originaali alles ning ei ole saadaval kriisi-, õigus- ega ametlikul dokumendil ka käsitsi API-kutsega.
8. ET/EN/RU pariteet, klaviatuur, ARIA olekud, reduced-motion ja mobiilivaade on uutel pindadel kaetud.

Käivita vähemalt T17 sihttestid, muudetud failide lint, `npm run i18n:check`, skeemi korral `npx prisma validate` ja migratsiooniahela kontroll, `git diff --check` ning production build. Täissviit ja sõltumatu audit jäävad T27-sse, kui neid eraldi ei nõuta.

## Sünteetiline runtime

Kasuta ainult lokaalset sünteetilist keskkonda ja olemasolevaid tehis-testkontosid vastavalt `docs/platvormi arendus/tehis-testkontod.md`. Loo vajadusel ainult ülesande ajutised vestlused, Teekonnad ja dokumendid kahele kasutajale; tõenda ühe kasutaja otsing, teise kasutaja leke-keeld, U7 toggle'i püsivus, kriisierand ning 375 px vaade. Korista ülesande loodud andmed. Kui ohutut runtime'i ei saa teha, raporteeri ausalt `NOT_RUN`/`NOT_PROVEN`.

## Definition of Done

1. E1–E5 on samas harus tehtud; U6 ja U7 aluscommit'id on stack'is ning nende lepingud säilinud.
2. Isiklik otsing on serveripoolselt omandipiiriga ja leitav, kuid ei ole globaalne ega sisulekke kanal.
3. Selge keel on vabatahtlik kõrvalesitus: originaal, allikas ja piirangud säilivad.
4. Kriisi-, õigus- ja ametlik tekst ei saa lihtsustatud asendust.
5. ET/EN/RU, a11y, mobiil ja reduced-motion on T17 pinnal tõendatud.
6. Worktree on puhas, muudatused commit'itud ja remote-harusse push'itud.
7. `main`, server, merge ja deploy jäävad puutumata.

## Lõpparuanne koordinaatorile

Esita worktree, haru, täpne baas-SHA, mõlema aluscommiti cherry-pick SHA, lõppcommit/remote SHA, migratsiooni nimi või kinnitus et migratsiooni pole; E1–E5 kasutajateekonna kokkuvõte; testide/lindi/i18n/Prisma/diff-check/buildi tulemused; runtime/cleanup või `NOT_RUN`/`NOT_PROVEN`; selge keele ja kriisierandi piir; ning kinnitus, et põhitööpuud, `main`-i, serverit, merge'i ega deploy'd ei muudetud.

Koordinaator kontrollib pärast aruannet ainult haru, parent'i, commit'i ja remote SHA-d. Ta ei korda automaatselt sinu teste, buildi ega runtime'i.
