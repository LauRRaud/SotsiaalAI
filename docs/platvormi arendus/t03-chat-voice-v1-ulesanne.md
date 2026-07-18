# ÜLESANNE: T03 `CHAT-VOICE-V1` — vestlus, kriisirada, hääl, Stop/retry ja töövoogude käivitamine

**Olek:** `READY_TO_ASSIGN_AFTER_T17`  
**Teostus:** üks worktree, üks haru, üks terviklik lõppüleandmine  
**Soovitatud teostaja:** Opus või Sol Medium  
**Järjekord:** alusta alles pärast T17 lõppcommiti. T03 lähtub T17 lõppharust, sest U7 selge keele režiim ning T03 muudavad samu vestluse- ja keelefaile. Koordinaator annab enne käivitust täpse T17 remote SHA.

## Eesmärk

Vestlus on aus ja turvaline kasutuskoht: kriisis saab inimene sõltumata mudeli, RAG-i või võrgu tõrkest kohe õige juhise; Stop peatab päriselt serveripoolse töö; katkestatud või ebaõnnestunud pööre ei ilmu refresh’i järel valmislahendusena; Retry on teadlik tegevus, mitte uue sõnumi käsitsi kirjutamine. Tekst-, STT- ja TTS-rada on kolmes keeles võrdselt selgitatud ning vestlusest käivitatavad töövood säilitavad nõusoleku- ja privaatsuspiiri.

## Loe enne tervikuna

1. `CLAUDE.md`
2. `docs/platvormi arendus/teemaarenduse-jatkamise-kord.md`
3. `docs/platvormi arendus/fable-5-vestlusaken-haalvestlus-ja-toovoogude-kaivitamine.md` — tervikuna; eriti ptk 4, 7, 10, 12–16
4. `docs/platvormi arendus/t17-search-language-v1-ulesanne.md` ja T17 lõpparuande tegelik commit/remote SHA
5. `docs/platvormi arendus/arendusteemade-masterregister.md` — T03
6. VEST-P0/P0a aluscommit'id `ef01fc42e77511c0a6a931358ef8df3fa722ca9a` ning `043f0dce5b9c08e5a017f63009b293aa039dc308`
7. `app/api/chat/route.js`, `lib/chat/requestBootstrap.js`, `lib/chat/mainResponseHandler.js`, `lib/chat/persistence.js`, `lib/chat/responseFinalizer.js`, `lib/chat/safety.js`, `lib/chat/workflowBranchHandlers.js`
8. `components/alalehed/ChatBody.jsx`, `components/chat/hooks/useChatStream.js`, `components/chat/hooks/useSpeech.js`, `components/chat/ChatComposer.jsx`, `components/chat/ChatTopNotices.jsx`, `components/chat/ChatMessageItem.jsx` ning seotud testid.

## Alus ja worktree

1. Kontrolli T17 lõpparuandest remote SHA ning kasuta seda T03 otsese alusena. Ära alusta, kui T17 ei ole veel lõpetatud või SHA puudub.
2. Ära kasuta ega muuda määrdunud põhitööpuud `C:\Users\rauds\Desktop\SotsiaalAI`.
3. Loo uus worktree, näiteks `C:\Users\rauds\Desktop\SotsiaalAI-chat-voice-v1`, ja haru `codex/chat-voice-v1` T17 kinnitatud remote-headist.
4. Too VEST-P0 ja P0a samasse stack'i järjekorras `cherry-pick -x ef01fc42…`, seejärel `cherry-pick -x 043f0dce…`. Lahenda võimalikud T17/U7 konfliktid, säilitades mõlema kriisi- ja literal-boolean keelelepingu. Ära rebase'i ega muuda algseid harusid.
5. Tee enne uue töö algust lühike konfliktimärge progressifaili: alus-SHA, mõlema cherry-pick SHA ja milliseid T17/U7 muudatusi säilitati.

## Lukustatud V1 valikud

| Teema | V1 valik |
|---|---|
| Kriisirada | VEST-P0/P0a ET/EN/RU fail-safe jääb esimese klassi deterministlikuks rajaks. RU/EN kriisituvastus lisandub regex-komplektina; mudelklassifikaator ei kuulu V1-sse. |
| Kriisitekst | Kasuta olemasolevat VEST-P0 struktuuri: 112 on alati nähtav; lasteabi 116 111 ja ohvriabi 116 006 säilivad ET/EN/RU lokaliseeritud tekstis. Juristi/sisuomaniku hilisem sõnastuse kinnitus ei blokeeri koodi. |
| Stop | Stop katkestab providerivoo serveris. Juba saadud osaline tekst salvestub tähisega `ABORTED`; täielikku hiljem valmivat vastust ei salvestata ega näidata. |
| Retry | Retry saadab sama viimase kasutajasõnumi ühe teadliku uue pöördena, seob selle eelmise ERROR/ABORTED pöördega ning ei dubleeri kasutaja sõnumit ega usage-reservatsiooni. |
| Sõnumipiir | Kasutaja saab 4000 tähemärgi nähtava loenduri ja serveri 413 piiri. Mudelile ei kärbita teksti kasutaja eest vaikides. Vastuse keel jääb kasutajaliidese keeleks. |
| Tasuta abi | Tellimuseta abiintent läheb ainult selgelt määratud abivahenduse töövoogu; sama jagatud predikaat otsustab värava ja marsruudi. Üldist RAG/LLM vastust tasuta tagauksena ei teki. |
| STT/TTS | Server-TTS on kasutusel ainult siis, kui vajalik turvaline konfiguratsioon on olemas; brauserihääl on selgelt märgistatud varu. Salvestusel on katkesta/viska ära ning 2,5 minuti pehme piir koos hoiatusega. |
| Logid | ChatLog jääb sisuta: sündmus, ID-d, kestus ja olek, mitte sõnumitekst/heli. Kriisisündmus ei saa laiendatud sisulogi. |

## Teostus

### E1 — kriis igas vestluse harus

- Säilita P0/P0a kriisifallback HTTP, SSE ja püsistuse teel. Lisa fail-closed RU/EN regexid ning testi negatiivsed mittkriisi juhtumid.
- Kriisiseis jõuab tavavestluse, abi- ja dokumenditöövoo vastusesse ning püsib kasutajaliideses, kuni sama pöörde serveritõde kinnitab selle lõppu. Mudeli/RAG-i/502/timeout tõrge ei tohi bännerit kustutada.
- 112 ja muu hädajuhis on kasutajale eristatav ning ekraanilugejale `role=alert`; U7 selge keele režiim ei kirjuta seda ümber ega paiguta seda vastuse järele.

### E2 — aus pöörde elutsükkel, Stop ja Retry

- Loo selge serveri pöördestaatuse leping vähemalt `COMPLETED`, `ERROR` ja `ABORTED` jaoks. Ära tuleta aktiivsust ainult „viimane sõnum oli kasutajalt” heuristikast.
- Seo kliendi AbortController serveri providerivoo ja finalizeriga. Abort lõpetab iteratsiooni/taimerid, vabastab kasutamata reservatsiooni olemasoleva usage-lepingu kaudu ning ei lase taustal täielikku vastust püsistada.
- Püsista ainult juba kasutajale kuvatud osaline tekst koos `completionStatus: ABORTED` metaandmetega või ausa tühja katkestuse faktiga; refresh/hydration taastab sama seisundi.
- Retry on nähtav vaid ERROR/ABORTED pöördel; see kasutab sama kasutajasõnumit, loob ühe uue assistendipöörde ja hoiab `retryOf` seose. Kordusklikk, võrguvea retry ja hiline SSE ei tohi luua topeltpööret.

### E3 — piirid, vead ja töövoo käivitus

- Jõusta 4000 tähemärgi piir enne püsistust ja providerikutset; klient näitab loendurit ja serveri 413 lokaliseeritud viga. Säilita olemasolev turn-/rate-limit ja ära logi sisendteksti.
- Kasuta üht jagatud `isFreeHelpWorkflowEligible`-laadset predikaati nii subscription-gate'is kui workflow routing'us. Tasuta abi ei tohi lekkida tavavestluse mudelikutsesse.
- Säilita vestlusest alustatava abisoovi, abipakkumise, Teekonna ja dokumendi olemasolev eelvaade→kinnitus muster. Vestluse sisu ei liigu uude tööobjekti ilma konkreetse serveriprojektsiooni ja kinnitamiseta.
- PII-hoiatused ja veasildid on API-võtmed, mitte serverist etteantud eestikeelne tekst; klient tõlgib need ET/EN/RU-s.

### E4 — hääl kui samaväärne sisend/väljund

- TTS valib locale'i järgi serveritee, kui see on seadistatud; konfiguratsioonipuudusel kasutab selgelt märgistatud brauseri fallback'i või kuvab ausa vea. RU/EN kasutaja ei jää vaikivasse ebaõnnestumisse.
- STT salvestust saab katkestada enne transkribeerimist: blob visatakse ära, providerikutset ei tehta ja kasutajale kuvatakse kinnitatud katkestus. Lisa 2,5 minuti hoiatus/piir ning puhasta taimerid/helirajad kõigil abort/error/success radadel.
- Mikrofoninupu disabled või permission-keeld on tekstina selgitatud: tellimusnõue, brauseri loakeeld ja tehniline viga on eraldi seisud.

### E5 — kasutatavus, keeled ja jõudlus

- Läbivad seisud (mõtlen, katkestatud, retry, kriis, STT/TTS, pikkusepiir) on klaviatuuriga saavutatavad, nähtava fookusega ja ekraanilugejale arusaadavad. Reduced-motion eemaldab kirjutusefekti ning sisenemiskaskaadi.
- Kõik uus copy on ET/EN/RU sümmeetriline. U7 selge keele preference säilib ning ei mõjuta teenuseosutaja `simple_language` võimekust.
- Lähtu PERF-P0 reservatsiooni-/pollimislepingust: taimerid, SSE, abort ja retry ei jäta töötavat polli, providerikutset ega reservatsiooni.

## Selgelt väljas

- T12 reaalajas ruumikõne, salvestis ja egress; T24 välitöö heli/OCR; T28 RAG-allikate elutsükkel.
- Mudelklassifikaatoriga kriisituvastus, päris TTS/STT võtmete aktiveerimine, päris OpenAI/provideri kõned ja päris helisalvestised.
- U7 selge keele sisupoliitika või T17 otsingu ümberteostus.
- Pikaajaline Next.js worker, üldine arveldus/usage ümberteostus, maksed ja avaliku copy lõppkinnitus.
- Merge, deploy, PR, põhitööpuu puhastus, rebase ja force-push.

## Nõutud testilepingud

1. ET/EN/RU kriisisõnumid tuvastuvad; mittkriisi näited ei käivita kriisirada; 112 fallback püsib no-context, empty-provider, SSE-null-delta, workflow ja 502/timeout rajal.
2. Abort katkestab provideri iteratsiooni, koristab taimerid/reservatsiooni ja jätab ainult ABORTED osalise/tühja pöörde; refresh ei too hiljem välja täielikku vastust.
3. ERROR pöörde järel Retry loob ühe uue pöörde, säilitab algse kasutajasõnumi, on topeltkliki vastu kaitstud ja ei tohi kahekorra usage't kulutada.
4. Pöördestaatuse route/hydration eristab COMPLETED, ERROR ja ABORTED ning ei jää igavesse RUNNING olekusse.
5. Üle 4000 tähemärgi → 413 enne DB/providerit; piiriloendur, API-võti ja kolm lokaati on kooskõlas.
6. Tasuta abiintent käivitab üksnes abivahenduse töövoo; sama predikaat kehtib gate'is ja router'is; tavaline LLM/RAG rada jääb suletuks.
7. PII ja veapayload ei sisalda kõvakodeeritud eestikeelset kasutajateksti ning UI tõlgib võtmed ET/EN/RU-s.
8. STT discard ei kutsu providerit; kestuspiir/permission/konfiguratsioonivead on eristatavad; TTS locale'i fallback on aus ja taimerid puhastuvad.
9. Kriis-, Stop-, Retry- ja häälerada on klaviatuuril, ekraanilugejas, mobiilis ning reduced-motion režiimis kasutatav.

Käivita vähemalt T03 sihttestid, muudetud failide lint, `npm run i18n:check`, Prisma validate ja migratsiooniahela kontroll kui skeemi muudetakse, `git diff --check` ning production build. Täissviit ja sõltumatu release-audit jäävad T27-sse, kui neid eraldi ei nõuta.

## Sünteetiline runtime

Kasuta ainult lokaalset sünteetilist keskkonda, deterministic provider stube ja tehis-testkontosid vastavalt `docs/platvormi arendus/tehis-testkontod.md`. Tõenda ET/EN/RU kriisirada, provider-abort, partial persistence, retry, tasuta abi piir, STT discard/TTS veaseis ning mobiil/klaviatuur. Päris helisisendit, mudelit, väliskutset ega tootmisandmeid ei kasutata. Korista tööga loodud vestlused, sõnumid, usage-kirjed ja autentimisolek; kui ohutu runtime pole võimalik, märgi ausalt `NOT_RUN`/`NOT_PROVEN`.

## Definition of Done

1. E1–E5 on samas harus; T17 alus ning VEST-P0/P0a stack on säilitatud.
2. Kriisijuhis on determinstlik, mitmekeelne ja püsib kõigis tõrke-/töövooharudes.
3. Stop peatab serveritöö päriselt; ERROR/ABORTED/Retry on püsivad, ausad ja idempotentsed.
4. Tekst- ja häälerajad on piiratud, selgitatud ja kolmes keeles võrdsed ilma päris teenuseid aktiveerimata.
5. Vestluse töövoog ei saada sisu edasi ilma kasutaja kinnituse ning serveriprojektsioonita.
6. ET/EN/RU, a11y, mobiil ja reduced-motion on T03 pindadel tõendatud.
7. Worktree on puhas, muudatused commit'itud ja remote-harusse push'itud; `main`, server, merge ja deploy on puutumata.

## Lõpparuanne koordinaatorile

Esita worktree, haru, T17 alus-SHA, mõlema VEST cherry-pick SHA, lõppcommit/remote SHA, migratsioonid; E1–E5 kokkuvõte; testide/lindi/i18n/Prisma/diff-check/buildi tulemused; sünteetilise runtime'i ja cleanup'i tõend või `NOT_RUN`/`NOT_PROVEN`; Stop'i salvestuslepingu ning kriisierandi tõend; ning kinnitus, et väliseid AI-/häälekutseid, tootmisandmeid, põhitööpuud, `main`-i, serverit, merge'i ega deploy'd ei muudetud.

Pärast lõpparuannet teeb Fable fokuseeritud kontrolli: kriisiraja prioriteet, Stop/Retry aus elutsükkel, tasuta abi piir, hääle veaolekud ning U7 selge keele säilimine. Ta ei korda automaatselt täissviiti ega tee uut vestluse tervikanalüüsi.
