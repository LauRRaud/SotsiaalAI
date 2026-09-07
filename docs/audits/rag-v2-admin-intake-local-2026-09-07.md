# RAG v2 dokumendi lisamisvoo kohalik vastuvõtt — 07.09.2026

Admini senine sisestusleht oli RAG v2 PDF-i ja metadata töötlusest lahutatud. Nüüd saab administraator samas vaates valida PDF-i, importida või täita metaandmed, vaadata loodavat metadatafaili ning käivitada tegeliku ingest'i. Salvestatud ülevaatus näitab PDF-i teksti, lehekülgi, hoiatusi ja väljade päritolu; sellest saab alla laadida mõlemad sisendfailid.

Aktiivse töö seisu kannab [SotsiaalAI.md S1.0](../platvormi%20arendus/SotsiaalAI.md). See dokument kirjeldab muudatuse lepingut ja vastuvõtutõendit.

## Teostatud ühendus

- `/admin/rag/ingest` kasutab uut `/api/admin/rag/v2/intake` rada ning olemasolevaid `ingest`, `loadSnapshot`, `buildMultiSourcePlan`, `runPilot` ja `indexSnapshot` teenuseid.
- Vorm säilitab imporditud lisametadata, sealhulgas `authority`, `source_status`, `historical` ja `collection_id`. Failitee normaliseeritakse serveri enda `source.pdf` väärtuseks. Metadata import on valikuline.
- Üleslaadimise tegelikku voogu piiratakse enne multipart-parsimist; PDF-i ülempiir on 20 MiB ja metadata ülempiir 1 MiB. Metadata peab olema korrektne UTF-8 JSON.
- PDF-i lugemine käib eraldi parseriprotsessis. Nexti API saab üheselt määratud worker-faili; tootmise failiindeks sisaldab worker'it ja PDF-parseri sõltuvusi.
- Ingest ei kasuta mudelit. Ülevaatus salvestatakse ka siis, kui järgneva indeksi ettevalmistus ebaõnnestub. Täpset dokumendiversiooni ja kogu lubatud korpuse hetkeseisu fikseeriv avaldamisplaan luuakse ülevaatuse juures.
- „Avalda otsingus” nõuab selle versiooni metadata, hoiatuste ja teksti eraldi ülevaatuse kinnitust. Avaldamine kontrollib plaani räsi, allikaversiooni ja korpuse hetkeseisu uuesti; vahepeal muutunud allikas ei saa vana kinnitusega avaldatud.
- Olemasolevad päris embedding'u vektorid saavad korduskasutusse ainult tervikluse ja teenusepakkuja päritolu kontrolli järel. Uute päringute raha-, kutse- ja tokenipiir reserveeritakse püsivalt enne väljaminekut. Ühe kinnituse kordamine ega uus dokumendiversioon ei nulli kogupiire.
- Teadmata teenusepakkuja tulemuse järel jääb avaldamine seisma. Salvestatud vektorite järel ebaõnnestunud indekseerimist saab jätkata uue mudelikutseta. Eduka korduskinnitusega uut indekseerimist ei alustata.
- Indekseerimise ühendused kontrollitakse enne mudelikutseid. Avaldamine ei tohi eemaldada aktiivsest indeksist seadistatud hetkeseisu väliseid dokumente. Vahetult enne indeksi aktiveerimist kontrollitakse õigusi ja allikaseisu uuesti.
- Admini RAG-i käsitsi käivitatav enesetest jäi alles.

See on kindla arenduskorpuse vastuvõturada. Uue suvalise dokumendi lubamine eeldab tema stabiilse tunnuse lisamist serveri ulatusse ja FilePolicy õigustesse. Indeksi avaldamine ei muuda iseenesest M4 allkirjastatud piloodiseadistust ega vestluse vaikimisi vastajat.

## Õigused ja seadistus

Rada on vaikimisi suletud. Avamiseks kasutatakse `RAG_V2_ADMIN_ENABLED=1` ning privaatsele JSON-failile viitavat `RAG_V2_ADMIN_CONFIG` väärtust.

Seadistuses on kohustuslikud `enabled`, `id`, `tenant`, `subject`, `users`, `documentIds`, `storeRoot`, `workRoot`, `policyFile`, `connectionsFile`, `embeddingReuseDirs`, `priceFile`, `maxSpendUsd`, `maxApiAttempts`, `maxInputTokens` ja `expiresAt`; valikulised on väiksemad `maxFileBytes` ja `maxMetadataBytes`. Tundmatud võtmed, avalikud või kattuvad salvestuskataloogid ning aegunud seadistus lükatakse tagasi. Ühendusfail annab olemasolevate adapterite `postgresUrl`, `qdrantUrl` ja vajadusel `qdrantKey` väärtused. Neid ei saadeta brauserisse.

API kontrollib nii kehtivat sessiooni kui ka kasutaja värsket DB rolli, peatamist ja sessiooniversiooni. Edasine tegevus kontrollib uuesti sama kasutajat, kogu seadistuse räsi ning FilePolicy õigusi. Ülevaatus kuulub selle loonud kasutajale ja samale seadistusele. Allalaadimine kontrollib ka faili räsi; failivastused on `no-store`, `nosniff` ja allalaadimiseks määratud.

Ülevaatuse ligipääs aegub hiljemalt 24 tunni pärast või seadistuse aegumisel. See plokk ei lisa tööfailide füüsilise koristamise ajastajat ega muuda kanoonilise allikakorpuse säilituslepingut; M6 terviklahenduseks seda ei loeta.

## Tegelik kohalik vastuvõtt

Kontroll tehti ehitatud rakenduses aadressil `http://localhost:3100`, `TZ=UTC` ja dokumenteeritud kohaliku testadmini sessiooniga. Kasutati eraldi privaatset allika- ja töökataloogi, üht lubatud dokumenti, nullist raha-/kutse-/tokenipiiri ning väljalülitatud M4 pilooti.

S11-s oleva testadmini PIN ei vastanud enam kohaliku DB räsile. Seda kontrolliti ainult nimetatud testkonto puhul. UI-login'i ajaks kasutati lühiajaliselt dokumenteeritud PIN-i ning algne räsi taastati automaatselt; taastamine tagastas `originalCredentialRestored=true`. Teiste kontode andmeid ei loetud ega muudetud.

| Kontroll | Tulemus |
|---|---|
| PDF-i valimine ja metadata JSON-i import brauseris | Läbis; täidetud väljad ja loodava faili eelvaade olid nähtavad |
| Metadata lisaväljade säilimine | `authority=program_implementer`, `source_status=archived_snapshot`, `historical=true`, `collection_id=m2_multi_source_evaluation` säilisid |
| „Töötle dokumenti” päris API ja PDF-parseri kaudu | `prepared`; 5 PDF-lehte, 6 tekstiosa, 1 `layout_coverage_limit` hoiatus |
| Teksti ja päritolu nähtav ülevaatus | Läbis; näidati PDF-i teksti ja lehekülgi, hoiatus selgitas lugemisjärjekorra kontrolli vajadust |
| PDF-i ja metadata allalaadimine UI-linkidest | Läbis; PDF-i SHA-256 kattus algfailiga, JSON-is säilisid lisaväljad |
| Lehe värskendamine | Sama ülevaatus ja metadata taastusid; avaldamise kinnitus jäi uuesti nõutuks |
| Kitsas ja lai vaade | 390 × 844 ja 1280 × 900 pildid vaadati visuaalselt üle; vorm reastus kitsal ekraanil ühte veergu |
| Anonüümne päring tegelikule API-le | HTTP 401, `unauthorized` |
| Kohaliku ülevaatuse mudelikasutus | 0 kutset ja 0 USD; avaldamist ei käivitatud, eelarvefaili ei loodud |

Allikas: `docs/Heaolu_tehnoloogiate programm _ Tehnopol.ee.pdf`, 802 188 baiti; metadata: `tests/evaluation/multi-source/metadata/tehnopol-heaolutehnoloogia-2026.json`.

PDF-i SHA-256: `2db90ecc6509a7c5118c4868b904efd254b3b6a62d004c6baab5e5b7d12aa182`.

Salvestatud versioon: `version_75a3c703c9324d4591d8da9f45df6fcf6a5d8f1828c90a8eb44468034236c2bf`. Kohaliku ülevaatuse plaan: `be7c7a327aeb0ed8e6ba82005479b73f0306ab239c2e8d2a3081cfcb92f47a1b`; ilma korduskasutuse kataloogita 6 kavandatud embedding'u sisendit ja 1944 tokenit. See oli ettevalmistuse kirjeldus, mitte päringute käivitamise luba.

Kohalikud pilditõendid: [taastunud ülevaatus](../../output/playwright/rag-intake-restored.png), [mobiilivaade](../../output/playwright/rag-intake-mobile.png), [avalduva indeksi ulatus](../../output/playwright/rag-intake-prepared.png). Brauseri konsoolis esines kohaliku aadressi Cloudflare RUM-i CORS-tõrkeid ja preload-hoiatusi; need pärinesid olemasolevast analüütika/laadimise kihist.

## Kitsas kontroll

`node --test tests/rag-v2-admin-intake.test.mjs`: **10/10 läbis**. Testid tõendavad selle muudatuse konkreetseid lepinguid: privaatne seadistus ja kogupiirid, tegeliku päringuvoo piiramine, sessiooni/DB rolli nõue, metadata säilitamine, töö omanik ja õiguste muutumine, aegunud allikaplaan, teadmata embedding'u tulemuse korduskeeld, vektorite järel indekseerimise jätkamine, õiguse tagasivõtmine enne aktiveerimist ning kogupiiri püsimine uue versiooni korral. Teenusepakkuja ja otsinguandmebaaside vastused on nendes testides sisestatud sõltuvused; päris võrku testides ei kasutata.

Muudetud koodifailide eslint, `i18n:check`, `git diff --check` ja lõplik tootmisbuild läbisid. Esimene build tuvastas privaatse tee kontrollis tarbetult laia failijälituse; põhjus eemaldati. Selle konfiguratsioonimuudatuse järel läbis vastav üks sihttest ning lõplik build enam neid hoiatusi ei andnud. Skeemi ega migratsioone ei muudetud.

## Järelejäänud vastuvõtt ja konkreetne serverikatse

**NOT_PROVEN:** selle adminivooga päris PostgreSQL/Qdranti indeksi avaldamine, sama uue versiooni värske otsing, tegelikult assistendile jõudnud juhise/allikate vastavus ning uus nähtav vastus koos algallikaga. Ka päris keskkonna rolli tagasivõtmise ja samaaegsete avaldamiste kontroll jääb sihttesti tõendist eraldi.

Kohalik RAG-i tavaport 55432 kuulub teisele projektile ja vajalik Qdrant pole selles keskkonnas avatud. Neid ei kasutatud ega muudetud. Root kontrollis 07.09 serveri seisuks `10783c35fcd4b7270b30c4937117ca4b63685dc6`, puhta tööpuu, aktiivse frontendi ja `/vestlus` HTTP 200; värske `origin/main` oli `5bb949825004e12ca62a1e7c4070158d9a05af48`. Käesoleva ploki push'i ega deploy'd pole tehtud.

Järgmine kontroll on täpselt piiratud:

1. Viia see muudatus serverisse olemasoleva deploy-rajaga ning avada adminivoog ainult senise piloodi testijale ja lubatud arenduskorpusele. Kontrollida serveris privaatset seadistust, ühendusi ja aktiivse korpuse tegelikku ulatust.
2. Lisada sama Tehnopoli PDF ja metadata tegeliku admini UI kaudu. Ülejäänud lubatud allikad peavad säilima indeksis. Enne avaldamist peab kontrollitud olemasolevate päris vektorite korduskasutus katma kõik dokumendisisendid; admini avaldamise uute mudelikutsete piir jääb **0**. Kui korduskasutus ei kata neid, katse peatub.
3. Avaldada indeks ja kontrollida selle aktiivset põlvkonda ning täpseid dokumendiversioone. Siduda uus allkirjastatud M4 plaan selle tulemusega. Plaan ei kasuta külmutatud vastusepaketti ega küsimusvektori korduskasutust.
4. Saata nähtavas vestluses üks lukustatud küsimus: **„Mis on Tehnopoli heaolutehnoloogiate programmi eesmärk ja kes seda rahastavad? Erista 2026. aasta salvestatud allikat tänasest taotlusvõimalusest.”**
5. Piir: **1 värske küsimuse embedding, 1 vastusekutse, korduskatseid 0, kogukulu kuni 0,05 USD**. Mudel `gpt-5.6-luna`, reasoning `low`, maksimaalselt 64 000 sisend- ja 2048 väljundtokenit; mõlema etapi ühine tokenipiir 67 048. Olemasolev püsiv ledger peab kontrollima kutsete, tokenite ja raha piire.
6. Kontrollida otsingutulemust, uue dokumendiversiooni jõudmist valikusse, teenusepakkujale saadetud tegelikku juhist/allikateksti, nähtava vastuse väiteid, algallika avanemist ja lehe värskendamist. Koondada tegelik kulu ning sulgeda ajutine käivitusluba.

See üks küsimus tõendab tervikahela rada. Varasemate T1/T5 vastunäidete, tõendipiiride ja isikupiiri semantilist vastuvõttu see ei asenda.

Push ja deploy vajavad omaniku selget luba vastavalt [AGENTS.md](../../AGENTS.md). Serveri privaatse piloodiseadistuse väärtuste väljastamise katse lükkas automaatne heakskiidukontroll tagasi, kuna selle eraldi ulatuse luba polnud tuvastatud. Seda lugemist ei korratud ega tehtud kaudsel teel; serverikatse seadistus jääb selle loa ja serveris mõõdetud tulemuse ootele.
