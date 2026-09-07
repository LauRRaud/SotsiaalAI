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

### Serverikatse algus 07.09

Alljärgnev algusseis on ajalooline; lõpptulemus on faili lõpus.

Omanik andis ülal kirjeldatud push'i/deploy, privaatse piloodiseadistuse kontrolli ja kuni 0,05 USD katse loa. `a8fc91ec7` jõudis serverisse; tootmisbuild läbis ja 204 migratsiooni hulgas polnud rakendamata migratsioone. Serveris kontrollitud korpus sisaldas kaheksat dokumenti ja 69 indeksiüksust; 68 erinevat dokumendisisendit olid olemasolevate päris vektoritega kaetud ning uusi embedding'u kutseid polnud vaja.

Eelkontroll leidis uues adapteris ühendusvea: `reusableEmbeddingCatalog` annab päritolu väljal `embedding.provenance`, kuid adapter luges seda kataloogi juurest. Vale lugemine oleks tõkestanud päris vektorite korduskasutuse. Parandus kasutab teenuse tegelikku andmekuju ning sihttesti sisestatud transpordipäritolu paikneb nüüd samas väljas. Selle paranduse järel läbisid 10 sihttesti, sihitud eslint ja uus tootmisbuild. Katse pole selles etapis mudelikutseni jõudnud.

Parandus `5e1d133c4538f82aada2e2482543250ecb6cc2ae` on serveris: serveri tootmisbuild läbis, frontend on aktiivne ja avalik `/vestlus` vastab HTTP 200. Päris vektorikataloog tagastas `embedding.provenance=openai_https` ja `embedding.source=persisted_vectors`. Piiratud adminivoog on avatud ainult senisele testijale, kelle ADMIN-roll, adminitunnus ja peatamata olek kontrolliti DB-st. Seadistuse dokumendikutsete, tokenite ja raha piir on null ning luba aegub 08.09 kell 00:00 UTC.

**Katse jätkamiseks on vaja kasutaja sisselogimist.** Avatud Chrome'i profiilis polnud serveri sessiooni; kasutajale avati tavaline `https://sotsiaal.ai/` sisselogimisvaade. Serveris pole selle katse PDF-ingest'i, indeksi avaldamist ega küsimuse/vastuse kutset veel tehtud. Uue piiratud M4 plaani ettevalmistus nõuab enne üht avaldatud UI-vastuvõtu kviitungit ning kontrollib sama uue versiooni aktiivses indeksis; plaani pole praegu teenuses lubatud. Senine piloodiseadistus säilis muutmata ja keskkonnafaili taastamiseks on privaatne varukoopia. Järgmine samm on pärast sisselogimist jätkata ülal kirjeldatud sama loa ja kulupiiriga katset.


### Serverikatse lõpptulemus 07.09 — tehniline rada PASS, vastuse sisu PARTIAL

Katse jätkus rakendusesiseses brauseris olemasoleva sessiooniga. Tegelikus adminivormis lisati sama PDF ja metadata: 5 lehekülge, 6 tekstiosa, 1 hoiatus. Metadata/päritolu ülevaatus avanes ning „Avalda otsingus” kinnitas indeksi avaldamist. Plaan hõlmas 8 dokumenti, 68 korduskasutatavat embedding-sisendit ja 0 uut dokumendikutset; ülejäänud 7 dokumendi versioonid säilisid.

Aktiivne põlvkond: `search_generation_f9b136c78c607b643503a5732294dd62ffab215f7ee26d9723052b89639a7566`, 8 dokumenti ja 69 üksust. Uus Tehnopoli versioon: `version_75a3c703c9324d4591d8da9f45df6fcf6a5d8f1828c90a8eb44468034236c2bf`. Avaldatud kviitungi, aktiivse PostgreSQL põlvkonna ja Qdranti eelkontroll läbis enne piiratud M4 plaani aktiveerimist.

Üks lukustatud küsimus saadeti nähtavas vestluses. Piloot `m4-intake-acceptance-20260907-1`, käik `7e92cd62-0f97-416e-8cd2-ef0497a13b13`. Päris otsing andis S1–S5 kahest dokumendist; S1–S3 viitasid uuele versioonile. Tegeliku päringukeha räsi kontroll läbis (`2b7b13ae7c5f27c79c566298292e95400a96aa68dcaf4bd0740ab13e86ff7070`); teenusepakkuja sisendi evidence ja otsingupaketi model_context normaliseeritud räsid kattusid. Sisendis oli üks kasutajasõnum küsimuse/allikatega, mitte vestlusajalugu; juhis `m4-grounded-answer-4`, leping `m4-text-refs-4`, mudel `gpt-5.6-luna`, reasoning `low`, `store=false`. Struktuurivalidaator läbis; see ei tõenda rahastusväite õigsust.

Vastuses oli kolm viidatud lõiku ja kaks piirangut. Allikate paneel avas viis viidet; S1 avanes PDF lehekülgedega 3, 4, 5 ja uue dokumendiversiooniga. Allika sulgemine taastas vestluse; eraldi lehe värskendamise järel oli sama vastus alles. Allikavaate kohalik tõend: `output/playwright/intake-server/source.png` ja `source.txt`.

**Sisuline vastuvõtt PARTIAL:** eesmärk ja salvestatud allika eristamine tänasest taotlusvõimalusest olid toetatud. Rahastuslõik ütles ekslikult, et projekte rahastatakse mõlema nimetatud meetme vahenditest. S1 eristab projektide kaasrahastamist meetmest „Heaolutehnoloogiate kasutuselevõtu toetamine tervise- ja hoolekande valdkonnas” ning arendusprogrammi kaasrahastamist meetmest „Pikaajalise hoolduse kättesaadavuse ja kvaliteedi parandamine”. Õige allikas oli päringus ja viites olemas; viga tekkis vastuse koostamisel. Järgmine plokk peab säilitama rahastuse objekti ja meetme seose. Vastuse üldine piirang rahastajate institutsionaalse jaotuse kohta seda ekslikku seost ei paranda. T1/T5 ja varasemad semantilised lahtised otsad säilivad; päris rolli tagasivõtmise/võistluse kontroll on endiselt NOT_PROVEN.

Kulu: 1 värske küsimuse embedding ja 1 vastusekutse, korduskatseid 0, kokku 25 168 tokenit. Püsiv kuluregister arvestas 8 230 760 nano-USD ehk **0,008230760 USD**, alla 0,05 USD piiri; see on konservatiivne piloodiarvestus, mitte teenusepakkuja arve. Dokumendi lisamine/avaldamine ei teinud mudelikutseid.

Katse lõpus taastati algne serveri keskkonnafail; selle ja privaatse varukoopia SHA-256 kattus (`a50c105cb5eab9a6fe78fd787574f551efcf059649276c4cf1c0aea2145a0dcf`). Frontend taaskäivitati ja on aktiivne. Ajutine admini/M4 konfiguratsioon pole enam teenuses valitud; avaldatud indeks jäi alles. Brauseri värskendamise tõend saadi enne katsekonfiguratsiooni sulgemist. Dokumentatsiooni uuendus ei muuda koodi; sama koodipuu rohelist tootmisbuildi ei korratud.


### Rahastusseoste juhise parandus 07.09

`m4-grounded-answer-5` lisab üldise seoste säilitamise nõude: rahastaja/meede peab jääma seotud selle konkreetse tegevusega, kaasrahastamine peab jääma kaasrahastamiseks ning elluviija roll ei muutu rahastajaks. Samas väljavõttes või programmis paiknemine ei ühenda eri meetmete rahastatavaid objekte. Teadaolevat objekti ja meetme seost ei tohi asendada üldise teadmatuse piiranguga, kui puudu on üksnes summad või haldaja. Reegel rakendub kõigile nähtavatele vastuseväljadele. Allikateksti, otsingut ega vana salvestatud vastust ei muudetud; väljundskeem jäi samaks.

Kontroll: olemasolev konfiguratsiooni sihttest läbis UTC-s koos uue juhuga, mis lubab allkirjastatud v4 plaani lugeda, kuid keelab selle kasutamise v5 käivitamiseks ka siis, kui koodiräsi on ajakohane. Muudetud kahe koodifaili eslint, diff-check, i18n ja tootmisbuild läbisid. See tõendab versioonipiiri ja kompileerumist, mitte mudeli uut sõnastust.

**Uue juhise semantiline runtime: NOT_PROVEN.** Eelmise katse ühe embedding-kutse ja ühe vastusekutse luba on kasutatud. Konkreetne järelkontroll: sama lukustatud küsimus, sama aktiivne kaheksa dokumendi indeks, üks värske küsimuse embedding ja üks vastusekutse (Luna low), korduskatseid 0, kuni 0,05 USD. Uus plaan tuleb siduda v5 juhise ja juurutatud koodiräsiga. Vastuvõtt nõuab mõlemat õiget objekti-meetme paari, kaasrahastamise säilimist, elluviijate eristamist, õige S1 teksti jõudmist päringusse ja viitesse ning salvestatud allika/tänase vooru eristuse säilimist. Pärast nähtava vastuse ja algallika kontrolli tuleb katsekonfiguratsioon jälle sulgeda. Püsivat uut kululuba ega korduskatset selle parandusega ei lisatud.


Parandus `e842888dac1c65f81f705f9db3cea9b1ebb715b5` on serverisse juurutatud varem antud sama töö deploy-loa alusel. Serveri tootmisbuild läbis, mõõdetud HEAD vastas commitile, tööpuu oli puhas, frontend aktiivne ja avalik `/vestlus` HTTP 200. Uusi mudelikutseid ei tehtud; eelmine ajutine katsekonfiguratsioon jäi suletuks.


### Omaniku täpsustus: universaalsus, indeks, graaf ja tööjärjestus 07.09

Omanik täpsustas, et artikleid tuleb ligi tuhat ning parandused peavad olema universaalsed, indekseerimine ja graaf peavad vastust toetama. Seejärel peatas ta uue hindamisringi; varem lubatud uut kahe kutse katset ei käivitatud. Mudelikulu selles plokis on 0.

Juhis `m4-grounded-answer-6` asendab juhtumipõhise rahastuse näite üldise seose osapoolte, suuna, tingimuste ja ajalise ulatuse säilitamise reegliga; eemaldati ka eelmise juhtumi fraasinäide ja eraldi rahastusviite näide. Seose olemasolu ei järeldata ühisest teemast, allikast ega graafi naabrusest. Algteksti, salvestatud vastuseid ja väljundskeemi ei muudeta; v4/v5 plaanide lugemine säilib.

Uued `vector-ranked-first-neighbors-v1` ja `hybrid-ranked-first-neighbors-v2` profiilid kasutavad olemasolevaid indeksisse salvestatud struktuurseoseid: kuni 5 järjestatud põhileidu + kuni 2 naabrit, lõpp- ja dokumendipiir 7, endiselt 6000 kontekstitokenit ja 8 graafisammu. Ajaloolised profiilid säilitavad oma täpse kuju; olemasolevat allkirjastatud piloodikonfiguratsiooni ega suletud katset ei muudeta. Uus profiil tuleb valida uues kasutusplaanis; praegune vaikeprofiil ei muutu vaikimisi graafiprofiiliks.

Kaks väikest tehnilist lepingukontrolli läbivad: uute profiilide indeksiservad lisavad naabrid kõigi viie põhileiu järel (servade eemaldamisel juurdekasvu pole), ning vana allkirjastatud juhisega saab lugeda ajalugu, kuid mitte käivitada uut juhist. Need ei ole mudelivastuse hindamine. Muudetud nelja koodifaili eslint ja diff-check läbisid; lõplik kohalik tootmisbuild läbis.

Tööplaani kontroll leidis, et M1/M2 ja piiratud M4/M6 on edasi liikunud, kuid M3 sisulise sõltuvuse teostus puudub (`normalize.js` loob `knowledge_cards: []`). `indexing.js` piirab importi 5000 üksusega, `retrieval.js` ja piloodi eelkontroll laadivad lubatud korpuse tervikuna. Need on eraldi mahuga seotud arendustööd; käesolev profiili/juhise muudatus neid ei lahenda. Aktiivne järgmiste tööde järjestus ja etappide seis on SotsiaalAI.md S2-s, mitte käesolevas raportis.


Universaalne juhis ja graafiprofiilid on serveris commitiga `0ddffe382805591b72e291e56648c6aee35de916`. Serveri tootmisbuild läbis; mõõdetud HEAD kattus, tööpuu oli puhas, frontend aktiivne ja `/vestlus` HTTP 200. Piloodi käivitusplaani ei aktiveeritud ning mudelikutseid ei tehtud. M3 ja mahutöö jäävad järgmisse arendusplokki.
