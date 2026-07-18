# JÄTKUÜLESANNE: T17 `SEARCH-LANGUAGE-V1` — lõpeta pooleliolev isiklik otsing ja selge keel

**Olek:** `IN_PROGRESS_PAUSED`  
**Teostus:** jätka ainult olemasolevas worktree's ja olemasoleval harul; ära loo uut T17 haru ega cherry-pick'i aluseid uuesti.  
**Soovitatud teostaja:** Opus; pärast lõpparuannet Fable fokuseeritud kontroll.

## Tegelik jätkamispunkt

| Fakt | Väärtus |
|---|---|
| Worktree | `C:\Users\rauds\Desktop\SotsiaalAI-search-language-v1` |
| Haru | `codex/search-language-v1` |
| Kohalik HEAD | `adf757826cddf4834dd87ed54b8a21a8cd9ec82b` |
| Remote-haru | puudub — midagi pole veel push'itud |
| Baas | `origin/main @ fe4eb4fa7997a7eada9417a27c6cea75ccd23cbe` |
| U6 stack | `b4cab70` (U6 järelparandused) + vajalik eelcommit `21b9f62…` on stack'is kujul `adf75782` |
| U7 stack | `29ff771` — cherry-pick `657d3c68` |
| Tööpuu | 14 pooleliolevat faili: 6 muudetud, 8 uut; ära reset'i, checkout'i ega kustuta neid |

Olemasolev algne tööleping jääb siduvaks: `docs/platvormi arendus/t17-search-language-v1-ulesanne.md`. Käesolev fail asendab ainult selle töö järjekorra ja tegeliku jätkamispunkti.

## Juba tehtud — säilita ja kontrolli

1. U6 serveripoolne vestluseotsing ja U7 selge keele preference on samas stack'is. U6 ajalooline progressidokument jäeti teadlikult taastamata, sest see oli main-ist eemaldatud; U6 test säilitati.
2. Alustatud on autentitud `/otsi` pind: `app/otsi/page.jsx`, `components/search/PersonalSearchPage.jsx`, `app/api/otsi/route.js`, `lib/search/personalSearch.js`, `tests/search/personalSearch.test.js`.
3. Ristotsing on kavandatud ainult praeguse kasutaja vestlustele, Teekondadele ja dokumentidele; tulemuse kuju on rangelt `kind`, `title`, `status`, `updatedAt`, `href` — sisu, preview ja toorväljad ei tohi väljuda.
4. Alustatud on Teekonna lugemisabi: `app/api/journeys/[id]/plain-language/route.js`, `lib/journey/plainLanguageExplanation.js`, `tests/journey/plainLanguageExplanation.test.js`, `JourneyDetail.jsx` ja ET/EN/RU võtmed.
5. Lugemisabi on praegu teadlikult määratud mittemuutvaks abiks: see hoiab algteksti/allika avatavana ega püsista uut ametlikku dokumenti. Kriisi-, õigus- ja ametliku allika keelamine on juba alustatud serverifunktsioonis.

## Alusta nii

1. Loe algne T17 tööleping ja see jätkuülesanne tervikuna.
2. Kontrolli olemasolevat diffi ning käivita esmalt ainult U6/U7 ja uued T17 sihttestid, et saada tegelik punane/roheline lähtepunkt. Ära kirjuta seni olemasolevaid pooleliolevaid faile üle.
3. Kontrolli enne uue koodi lisamist päris mudelite, detailiroute'ide ja olemasolevate serveri autoriseerimisabi funktsioonide järgi, et `/teekond/<id>` ja dokumendi `href` vastaksid tegelikele kasutajapindadele. Ära usalda poolelioleva koodi eeldust pimesi.
4. Vajadusel paranda pooleliolev lahendus samas harus; see ei ole audit, vaid T17 lõpuleviimine.

## Allesjäänud teostus

### E1 — vii „Minu otsing” päriselt serveripiirini

- Kontrolli ja paranda `lib/search/personalSearch.js` päris Prisma mudelite järgi. Iga tüüp kasutab ainult oma autoriteetset omandi-/aegumise filtrit; ära otsi ruume, eelpöördumisi, heaolu tekste, kovisiooni sisu ega teise inimese objekte.
- Vestluse detailotsing jääb U6 lepinguks. Ristotsingu vastus ei tohi valida ega tagastada `summary`, sõnumit, dokumentide sisu, `preview`, `rawPlace` ega muid toorvälju.
- Kontrolli, et `href` väärtused avavad olemasoleva kasutajatee ega võimalda kasutaja sisendist URL-i koostada. Kui dokumentidel puudub turvaline otsevaade, seo tulemus olemasoleva turvalise materjalide lehega või jäta see tüüp V1-st välja põhjusega — ära leiuta katkist marsruuti.
- Lisa route-tasandi testid autentimata, liiga pika päringu, rate-limit'i, serverivea ja lubatud metaandmete kohta. Tühi päring ei tohi teha kolme laia andmebaasiskanni.

### E2 — lõpeta otsingupind ja leitavus

- Tee `/otsi` nähtavaks autentitud navigeerimisest või olemasolevalt stabiilselt pinnalt, ilma T05 töölauda cherry-pick'imata. Kontrolli, et subscription/rollivärav ei välista kasutajat, kellel on juba lubatud oma tööobjektidele ligipääs.
- Täienda `PersonalSearchPage` laadimis-, vea-, tühja- ja tulemuseolekuid: vea järel peab olema Retry; katkestatud/vananenud vastus ei tohi kirjutada uut päringut üle; tulemuse tüüp, pealkiri, kuupäev ja olek on tekstina eristatavad.
- Lisa vajalik CSS olemasolevas SotsiaalAI keeles, 375 px mobiilivaade, nähtav fookus ja semantiline tulemuste loend. Ära too uut UI-teeki ega T19 ruumimootorit.

### E3 — lõpeta selge keele turvapiir ja kasutajateekond

- Säilita U7 literal-boolean cookie/localStorage/SSR/hydration ja chat request-to-prompt leping. Ära seo seda teenuseosutaja `simple_language` võimekusega.
- Tee Teekonna „Selgita lihtsalt” rada täielikuks ainult kasutaja enda nähtava, versioonitava Teekonna kokkuvõtte juures: kasutaja näeb enne kinnitamist allikat, kuupäeva/versiooni ja teadet, et algne jääb muutmata. API jõustab sama piiri, mitte ainult nupp.
- Praegune lugemisabi võib jääda mittemuutvaks struktureeritud abiks; see ei pea kutsuma uut mudelit. Kui kasutusel on mudel, peab eelvaade täpselt ütlema, milline tekst väljub, ning testid tõendama, et originaal/allikas/faktid ei kao.
- Server keelab kriisi-, 112-, õigus-, nõusoleku-, ametliku ja allkirjastatud allika ka käsitsi API-kutsel. Täienda keelamist struktureeritud/metapõhise allikaklassiga, mitte ainult sõnaregexiga, kui olemasolev Journey mudel seda võimaldab.
- Algne tekst, allikas ja lugemisabi ei salvestu uue dokumendi ega otsinguindeksina. UI pakub sulgemist/tagasipöördumist ilma algset Teekonda muutmata.

### E4 — testid, i18n ja sünteetiline runtime

- Täienda `tests/search/**` ja `tests/journey/plainLanguageExplanation.test.js` kõigi algse T17 töölepingu negatiivsete juhtudega: võõras objekt, aegunud vestlus, sisu/preview leke, URL allowlist, tühi/pikk/race/veaotsing, nõusolek puudub, kriisi-/õigus-/ametlik erand ning originaali säilimine.
- Hoia ET/EN/RU võtmed pariteedis ja lisa ainult kasutatavad võtmed. Käivita T17 sihttestid, muudetud failide lint, `npm run i18n:check`, Prisma validate, `git diff --check` ja production build. Täissviit jääb T27-sse.
- Käivita võimaluse korral lokaalses sünteetilises keskkonnas kaks testkasutajat: üks leiab ainult oma vestluse/Teekonna/dokumendi, teine ei näe neid; kontrolli U7 toggle'i püsivus, selgituse eelvaade/kinnitus/keeld ning mobiil. Korista ainult ülesandes loodud andmed. Kui seda ei saa turvaliselt teha, märgi ausalt `NOT_RUN`/`NOT_PROVEN`.

## Keelatud

- Uue T17 worktree/haru loomine, olemasoleva branchi reset/rebase/force-push või pooleliolevate failide kustutamine.
- T02, T10, T11, T12, T19, T24 või T05 stack'ide cherry-pick'imine; globaalne/admini otsing; eelpöördumise/ruumi/heaolu sisukaevamine; RAG/semantiline otsing.
- Kriisi-, õigus- või ametliku teksti lihtsustatud asendamine; kasutajasisu saatmine uuele providerile ilma nähtava nõusolekuta.
- Päris kasutajaandmete, tootmisserveri või väliste AI-kutsete kasutamine; merge, deploy või PR.

## Lõpparuanne

Esita worktree, haru, algne `adf75782` HEAD, lõppcommit ja remote SHA; kõik commit'id; muutunud failid; T17 testid/lint/i18n/Prisma/diff-check/build; runtime ja cleanup või `NOT_RUN`/`NOT_PROVEN`; kinnita, millised U6/U7 konfliktid lahendati ning et `main`, server, merge ja deploy jäid puutumata.

Pärast lõpparuannet kontrollib Fable ainult: (1) omandi-/sisu piir otsingus, (2) selgituse nõusolek ja ametliku/kriisi erandid, (3) originaali/allika säilimine ning (4) kasutajaliidese a11y. Täissviiti ega uut tervikauditit ei korrata.
