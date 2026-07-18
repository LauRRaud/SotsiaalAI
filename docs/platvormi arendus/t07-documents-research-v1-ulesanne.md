# ÜLESANNE: T07 `DOCUMENTS-RESEARCH-V1` — Minu dokumendid, analüüs ja süvauuring

**Olek:** `READY_TO_ASSIGN_AFTER_T17`  
**Teostus:** üks worktree, üks haru, üks terviklik lõppüleandmine  
**Soovitatud teostaja:** Opus või Terra High  
**Järjekord:** alusta alles siis, kui T17 lõppcommit on pushitud. T28 `RAG-V1` on vajalik alus. See on dokumenditeema täielik V1, mitte eraldi RAG-i, faili- ega kõnepakett.

## Eesmärk

Kasutajal on üks rahulik **Minu dokumendid** ruum: ta saab dokumenti mõista, koostada, transkribeerida või teha süvauuringut; iga väljund on leitav, omaniku-põhine ja arusaadava päritolu ning privaatsuspiiriga. Koostamisel tekkinud privaatne materjal ei jõua kunagi teise kasutaja vestluse või süvauuringu vastusesse. Pikk süvauuring jääb navigeerimisel tööle ning peatub ainult kasutaja selgel Stop-toimingul.

## Loe enne tervikuna

1. `CLAUDE.md`
2. `docs/platvormi arendus/teemaarenduse-jatkamise-kord.md`
3. `docs/platvormi arendus/lisafunktsioonid/fable-5-dokumendid-analuus-ja-syvauuring-tervikvoog.md` — tervikuna, eriti ptk 8–17 ja A–E.
4. `docs/platvormi arendus/arendusteemade-masterregister.md` — T07.
5. T17 lõpparuanne ning selle tegelik remote SHA; ära eelda poolelioleva haru SHA-d.
6. T28 lõpparuanne ja `codex/rag-v1 @ 8c3e5f778d1a85eb1281ee076f578ed227aeec55`.
7. T06 `codex/journey-v1 @ f17a3c365928433fbe5a9a681d6f8a91bb762010`, `lib/rag/**`, `app/api/documents/**`, `app/api/research/**`, `components/alalehed/ChatBody.jsx`, `app/dokreziim/**`, dokumentide kustutus- ja retention-rajad.
8. `docs/platvormi arendus/tehis-testkontod.md` enne lokaalset autentitud kontrolli.

## Alus ja worktree

1. Kontrolli enne alustamist `origin/main`, T17 remote SHA-d ja T28 remote SHA-d. Määrdunud põhitööpuud `C:\Users\rauds\Desktop\SotsiaalAI` ei kasutata ega muudeta.
2. Loo uus worktree T28 commit'ist `8c3e5f77`, näiteks `C:\Users\rauds\Desktop\SotsiaalAI-documents-research-v1`, haruga `codex/documents-research-v1`. See sisaldab ka T06 alust.
3. Too T17 kinnitatud lõppcommit stack'i `cherry-pick -x` abil. Kui T17 pole veel pushitud või selle lõpparuanne puudub, peatu — ära tee oma tõlgendust poolelioleva otsingu diffist.
4. Ära re-ingesti päris allikaid, ära käivita RAG-i masskorjet ega aktiveeri research-workerit või selle systemd timerit. Need on eraldi ops-otsused.

## Lukustatud V1 valikud

| Teema | V1 leping |
|---|---|
| Privaatne agent-dokument | Koostamisel kasutatud või loodud dokument on **ainult omaniku** jaoks. See ei rikasta ühiskollektsiooni ega tule kunagi mitte-omaniku vestluse või süvauuringu retrieval'isse. Puuduv/ebaselge allikaklass tähendab fail-closed väljajättu. |
| Analüüs | Analüüs algab privaatselt vestluse kontekstis, kuid kasutaja saab selle selgelt **salvestada oma analüüsiobjektina**. Salvestamata analüüs ei teki nähtamatu püsikirjena. |
| Mustand | Genereerimise tulemus salvestub kohe omaniku `DRAFT`-ina; kasutaja näeb olekut, saab jätkata, nimetada, kustutada või kinnitada. Kulu ei tohi jääda koos kadunud tulemusega. |
| Failiruum | `/documents` on kasutaja nähtav Minu dokumentide sisenemine. Koostamine, analüüs, transkript ja uuring on sama ruumi tegevused, mitte neli eksitavat eraldi lehte. Olemasolevaid URL-e ei lõhuta. |
| Uuring | Süvauuring on püsiva jobi külge seotud. Tavalisel SPA-navigeerimisel see jätkub; ainult selge Stop tühistab. Kasutaja näeb tööd, ulatust, geo-valikut, edenemist, allikaid, ebakindlust ja ausat „tõendeid ei leitud” tulemust. |
| Uuringu allikad | V1 kasutab ainult olemasolevat RAG-teadmusbaasi; avatud veeb, päris URL-korje ja tootmis-RAG-i sisselülitamine on väljas. |
| Kustutus ja õigused | Kõigil dokumendi-/artefakti-/analüüsi-/uuringuradadel on omanikukontroll ning võõras, puuduv või kustutatud ID annab sama 404-kuju. Meeting-summary JSON-snapshot on dokumendi- ja konto-kustutusahelas. |
| Heli piir | Transkriptsiooni olemasolevat töövoogu ei kirjutata ümber. V1 parandab ainult dokumendiruumi nähtavuse ja kustutusahela; salvestise/egressi üldelutsükkel kuulub T08/T12-sse. |

## Teostus

### E1 — privaatsuspiir ja omandiõiguse ühtlustus

- Sulge Fable'i tuvastatud cross-tenant RAG-leke serveris: agent-/koostamisdokument, selle chunk ja sellest tuletatud kontekst on mitte-omaniku retrieval'ist välistatud nii põhivestluse kui süvauuringu kõigil radadel. Ära lahenda seda ainult kliendipoolse filtri, pealkirja peitmise ega promptiga.
- Kasuta minimaalset, selget allikatüübi/omaniku lepingut. Säilita T28 registri-, versiooni- ja delete-leping; ära tee uut jagatud RAG-kollektsiooni ilma vajaduseta.
- Ühtlusta dokumendi, artefakti, transkriptsiooni, kokkuvõtte ja uuringu võõra-ID käitumine owner-404-ks. Ära tagasta olemasolu- või õiguse-oraaklit.
- Näita kasutajale dokumendil päritolu/privaatsusriba: kes näeb, kust objekt tuli, millises olekus ta on ja kas ta saab RAG-i kasutada. See ei tohi lubada jagatud indeksit, mida V1 ei kasuta.

### E2 — püsiv mustand ja salvestatav analüüs

- Muuda genereerimise tulemus kohe kasutaja omandis olevaks `DRAFT`-objektiks. Kordus, katkestus, retry ja kustutus on idempotentsed; pooleliolev tulemus ei jää transientseks kuluga kadumiseks.
- Loo privaatselt salvestatav analüüsiobjekt: minimaalne päritoludokumentide viide, analüüsi tekst/olek, autor, loomise aeg ning selge „see on AI selgitus, mitte ametlik otsus” tähis. Säilitamine toimub ainult kasutaja sõnaselgel Save-toimingul.
- Kinnitatud dokument on uue versiooni loomisel lähtepunkt; ära muuda vana kinnitatud versiooni vaikselt. Täielik versioonihaldus ja ühine koostamine on väljas.
- Seo T06 Teekonna „Lisa dokument analüüsiks” tegeliku analüüsirajaga, mitte koostamislehega. Kasuta URL-is ainult omandiga kontrollitud dokument-ID-d.

### E3 — üks Minu dokumentide tööruum

- Tee `/documents`-ist üks fokusseeritud tööruum: üks küsimus korraga „Mida soovid teha?” — mõista dokumenti, koosta, transkribeeri või uuri. Pikk lugemine jääb rahulikku lugemiskihti; ära ehita tabelikeskset juhtpaneeli.
- Näita kasutajale tema objekte ühe selge loendina: algfail, transkript, analüüs, mustand, kinnitatud dokument, uuring. Igal real on olek, päritolu, viimane tegevus ja üks järgmine mõistlik toiming.
- Säilita olemasolevad süvalingid `/dokreziim` ja dokumentide detailidesse, kuid suuna need sama tööruumi tähendusega. Tühja-, laadimis-, vea-, katkestus- ja kustutatud olekud on ausad.
- Tee ET/EN/RU, klaviatuur, ekraanilugeja, mobiil ja reduced-motion samas teemas. Ära lisa dekoratiivset flight-animatsiooni.

### E4 — püsiv ja aus süvauuring

- Lõpeta uuringu automaatne DELETE/Stop tavalisel ChatBody unmount'il või soft-nav'il. Taasavamisel loe kasutaja enda aktiivne/põhjustatud job ning näita sama edenemist/tulemust.
- Selge Stop on ainus tühistusrada ja jääb idempotentseks; Stop ei väida, et juba loodud raport või kulutatud töö poleks toimunud.
- Too olemasolevad ulatuse/geo-valikud UI-s nähtavale ning valideeri neid serveris. Allikad, kindlus, lüngad ja järgmised sammud jäävad kasutajale nähtavaks; 0-tõendi ja degradeerunud RAG-i tulemus on aus.
- `RESEARCH_API_ENABLED`/worker puudumisel kuva „praegu pole saadaval” koos jätkatava töö olekuga, mitte näivalt käivitatud uuring. Ära aktiveeri lippu, tööriista ega unit'it.

### E5 — kustutus, sündmused ja järjestikune töökindlus

- Too meeting-summary jobi JSON-snapshot dokumenti/kontot kustutades samasse fail-closed kustutusahelasse. Ebaõnnestumine peab säilitama ausa ootele/retry oleku, mitte jätma vaikset sisu jääki.
- Lisa vajalikud minimaalsed T04 sündmused/teavitused mustandi, analüüsi ja uuringu kasutajateele. Payloadis on vaid ID, olek ja ohutu sihtlink — mitte dokumendi tekst, allikas ega uuringu sisu.
- Säilita T28 retry/dead-letter, reservation ja RAG_DELETE lepingud. T07 ei lisa uut workerit ega taimerit.

## Selgelt väljas

- Päris RAG-korje, välise URL-i ingest, mass-reingest, RAG master-PDF patch-meta, production flag'i või research-worker/timeri aktiveerimine.
- Ühine dokumentide redigeerimine, kolmandate isikute dokumentide jagamine, automaatne anonüümistamine ühiskorpuse jaoks, dokumentide reitingud või lai versioonihaldus.
- Salvestiste/LiveKit egressi globaalne retention, AV-skann, failide üldine elutsükkel (T08), kõne- ja ruumituum (T12), ekspordi tervik (T16).
- Merge, deploy, PR, põhitööpuu puhastus, rebase, force-push, tootmisandmete lugemine või päris kasutajaandmete testimine.

## Nõutud testilepingud

1. Kasutaja A agent-dokumendi/chunk'i äratuntav marker ei jõua kasutaja B põhivestluse ega süvauuringu retrieval'i; A enda lubatud rada töötab. Testi serveri tegelikku filtrit, mitte ainult UI-d.
2. Võõras, puuduv ja kustutatud dokumendi/artefakti/transkriptsiooni/analüüsi/uuringu ID annab sama 404-kuju ega ava sisu ega olemasolu fakti.
3. Generate → DRAFT → lahku/naase → jätka/kinnita/kustuta on püsiv ja idempotentne; retry/race ei tee topeltobjekti ega kaota kasutusfakti.
4. Salvestamata analüüs ei jää püsivaks; Save loob vaid omaniku allowlistitud analüüsiobjekti; Teekonna analüüsilink jõuab õige omaniku kontrollitud rajani.
5. Uuring jätkub soft-nav'i järel, Stop tühistab ainult aktiivse kasutaja jobi ning refresh/taasühendus ei tekita topeltjobi. Worker/feature-off annab ausa seisundi.
6. Meeting-summary snapshot kustub dokumendi- ja konto-kustutusahelas; ebaõnnestunud kustutus jääb korduskindlalt ootele, ilma vaikse jäägita.
7. T28 retrieval/version/delete/retry testid ning T06 Teekonna jagamis-/URL-lepingud jäävad roheliseks.
8. ET/EN/RU pariteet, klaviatuur, fookus, aria-live olekuteated, mobiil ja reduced-motion katavad Minu dokumentide, analüüsi ja uuringu teed.

Käivita T07 sihttestid ja kahjustatud T06/T17/T28 regressioonid, muudetud failide lint, `npm run i18n:check`, Prisma validate + migratsiooniahela kontroll, `git diff --check` ning production build. Täissviit ja sõltumatu release-audit jäävad T27-sse.

## Sünteetiline runtime ja DoD

Kasuta ainult lokaalset sünteetilist DB-d ning olemasolevaid kohalikke testidentiteete. Kui RAG-i fixture on ohutult käivitatav, tõenda kahe kasutaja privaatsuspiir, DRAFT-i naasmine, salvestatud analüüs, soft-nav uuring, Stop ning dokumendi/snapshot-kustutus; korista kõik selle tööga loodud objektid, chunkid, jobid ja failid. Kui mõni osa vajab päris RAG-i, välisallikat või puuduvat workerit, märgi see `NOT_RUN`/`NOT_PROVEN` — ära kasuta tootmist.

Valmis on siis, kui E1–E5 on samas harus, privaatse dokumendi cross-tenant piir on serveris testitud, Minu dokumendid on kasutajale ühtne ja rahulik tööruum, uuring ei kao navigeerimisel, kustutus ei jäta snapshotit, worktree on puhas ning commit/push tehtud. `main`, server, merge ja deploy jäävad puutumata.

## Lõpparuanne

Esita worktree, haru, baas/T17/T28 SHA-d, lõppcommit/remote SHA, migratsioonid, E1–E5 kokkuvõte, testid/lint/i18n/Prisma/diff-check/build, sünteetiline runtime/cleanup või `NOT_RUN`/`NOT_PROVEN`, välja jäetud ops- ja failielutsükli osad ning kinnitus, et tootmisandmeid, merge'i ega deploy'd ei puudutatud.

Pärast lõpparuannet teeb Fable fokuseeritud lepingu kontrolli: cross-tenant RAG-piir, owner-404, DRAFT/analüüsi püsivus, soft-nav/Stop ning snapshot-kustutus. Ta ei korda täissviiti, buildi ega tervikauditit.
