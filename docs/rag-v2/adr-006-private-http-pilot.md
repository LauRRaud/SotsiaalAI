# ADR-006: piiratud HTTP-sisepiloot

06.09.2026. Alus: `docs/CODEX_M4_SISEPILOOT_v0_1.md`. Elav tööseis jääb S1.0-sse; see ADR kirjeldab lepingut.

## Ühendus ja õigused

`/rag-pilot` kasutab olemasolevat NextAuthi serverisessiooni. Ainult `x-rag-pilot: 1` päring valib `/api/chat` kaitstud JSON-adapteri; avaliku chati paus ja `generationAvailable=false` säilivad. Olemasolev voogedastusklient ei saa kontrollimata vastusefragmente. Piloodiklient saab valmis vastuse pärast kontrolli ja andmebaasitehingut.

`M4_PILOT_ENABLED=1` ja serveri `M4_PILOT_CONFIG` fail peavad mõlemad olemas olema. `users` määrab nimelise loa; administraatori roll ei anna luba. Tenant, dokumendiversioonid, profiil, hind ja mudel tulevad sellest serverifailist. Kliendi õiguste-, ajaloo-, ruumi- ja dokumendiväljad lükatakse tagasi. Sessiooni, aktiivset jälgitavat sessioonikirjet, faililuba, vestlust ja allika õigusi kontrollitakse etappide vahel uuesti. Sama päritolu JSON, 18 kB keha, 4000 märgi / 2000 päringutokeni piir ning kasutajapõhine püsiv minutipiir eelnevad saatmisele.

## Püsistus ja elutsükkel

`Conversation` ja `ChatTurn` jäävad pöörde identiteediks. `M4PilotTurn` hoiab küsimust, vektorit, kompaktset paketti, valideeritud vastust ning sõnumi/allika seoseid; FK kustutab selle koos pöördega. Üldised `ConversationMessage` kirjed sisaldavad kaitstud piloodi kohatäitjaid ja pöörde-ID-d. Nii ei pea kõiki vanu vestluse ekspordi-/jagamisradu piloodi arenduskorpusega avama. Toorteksti taastab ainult piloodiadapter.

**Tagasi võetud 06.10.2026 ([ADR-094](adr-094-durable-conversation-history.md)):** omaniku otsusel on pöörde sõnumites küsimus ja vastus ise ning vestluse ajalookirje; kohatäide jääb ainult pöördele, mille kirjet ei õnnestu koostada. Kõik rajad, mis sõnumi sisu loevad, on piiratud vestluse omanikuga.

`M4PilotLedger` on sisuta ühine kulureserveering. Varasema M2 faililegeri katset ega eelarvet ei kasutata uue HTTP-katse loana. PostgreSQL-i nõuandelukk seob piloodi nõuded, ühe aktiivse töö piirangu ning reserveeringud; vestluserea lukk seob salvestuse olemasoleva archive/delete piiriga. Sama kasutaja võtme muu sisend annab 409; sama sisend taastab seisundi. `reserved_not_sent`, `sent_unknown`, `response_received`, `needs_recovery` ja `completed` eristavad katse piire. Teadmata tulemust ei saadeta automaatselt uuesti. Kehtiva mustandi taastamine on eraldi kohalik toiming.

Väljund avaldatakse pärast mõlema kohatäitjasõnumi ja allikaseoste ühist tehingut. Ebaõnnestumine pärast provider'i vastust ei loo uut mudelikatset. Kustutamine tehingu ajal takistab hilist vestluse taastamist. Sisu ja cache aeguvad hiljemalt serverifaili tähtajal või 1–168 tunni pärast; praegune ettepanek on 48 tundi. Ligipääs lõpeb kohe, füüsilise puhastuse teeb olemasolev retention-rada või piloodi järgmine päring. Sisuta kulusumma ei kao vestluse kustutamisel. Brauseris püsib ainult kavatsuse võti; toortekst elab kuvatavas mälus.

## Tuum ja teenusepakkuja

Käitustuum `lib/rag-v2/pilot/` ei impordi Next.js-i sessiooni ega HTTP objekte. HTTP adapter on `lib/chat/m4PilotServer.js`. Deterministlik päringuehitaja võtab uue küsimuse; ainult eksplitsiitne `same` lisab eelneva serveris salvestatud kasutajaküsimuse. `new`, `new_person` ja `correction` ei kanna varasemat teksti üle. Üldise pika mälu võimekust ei väideta.

Pärisotsing kasutab muutmata `retrieve()` tuuma, `vector-ranked-first-v1` profiili, aktiivse põlvkonna kontrolli ja 3072-mõõtmelist `text-embedding-3-large` ruumi. Vektor salvestatakse enne otsingut pöörde kirjesse. Testrežiimi fikseeritud allikavalik ja mock-vektor on eraldi haru, mida pärisindeksisse ei suunata. Puuduv/sobimatu indeks peatab raja enne päringu embedding'ut; fallback puudub.

Luna adapter on üks `fetch` päring Responses API-sse: `gpt-5.6-luna`, eksplitsiitne projekt, `store:false`, range JSON-skeem, piiratud timeout ja väljund koos arutlustokenitega. `temperature`, tööriistad, hosted files, võrgusirvimine ja automaatsed kordused puuduvad. Kogu serialiseeritud keha UTF-8 baidimahust koos protokollivaruga tuletatakse konservatiivne sisendreserv; provider'i tegelikud tokenid, cache-read/write andmed ja esimese vastusebaidi aeg salvestatakse eraldi. Rahaline hinnang kasutab kinnitatud serverihindu; teadmata kasutus ei ole nullkulu.

Iga faktiliseks märgitud plokk vajab käesoleva paketi viidet. Kanooniline resolver kontrollib dokumendiversiooni, chunk'i, span'e, teksti räsi ja 1-põhiseid PDF-lehti. Kehtiv viide ega mudeli deklareeritud `partial` ei ole sõltumatu sisukvaliteedi tõend. Allikad renderdatakse tekstina Reacti kaudu, allika avamine kasutab uut õiguskontrolli.

## Päriskatse kinnituse piir

Omaniku 06.09 jätkujuhise järgi kasutab piloot tavapärast `/vestlus` lehte, olemasolevat komposerit, sõnumivaadet ja „Vastuste allikad” paneeli. Server annab piloodirežiimi ainult nimelisele lubatud sessioonile. Piloodis saadab klient ainult küsimuse ja pöörde identiteedi, mitte vana chati ajalugu/rolli. Taastamine käib eraldi kaitstud adapteri kaudu; brauseri toorsõnumite salvestus on piloodis välja jäetud. Allikapaneeli piloodiviide avaneb kaitstud `/chat-source` lehel samas sakis, et ka rakendusesisene brauser töötaks.

Ühist katsepiiri täiendavad püsivad `embeddingAttempts` ja `answerAttempts` loendurid: kuni kaheksa uut küsimuseembedding'ut ja kaheksa vastusekatset. Kaheksanda vastuse järel tõrjub järgmine küsimus juba enne uut embedding'ut. Cache ei vabasta vastusekatsete piiri. Varasem aggregate-only ledger ei saa etappide loendureid vaikimisi nullida; uue lepingu jaoks kasutatakse uut selgelt seotud piloodiplaani.

`scripts/rag-v2-pilot-plan.mjs` koostab privaatse plaani, materjalimanifesti, kaheksa küsimuse hindamislehe ja teostuse räsimanifesti. See käsk ei anna luba ega tee võrgukutset. Runtime seob loa failis oleva plaani räsi, prompti/päringuehitaja versiooni ning teostuse failiräsiga. Lukustatud küsimusteloa alla ei kuulu vaba vestlus; selleks on eraldi `bounded_dynamic` ja vastav eksplitsiitne luba.

`store:false` ei tõenda nullsäilitust: ametlikud [andmekontrollid](https://developers.openai.com/api/docs/guides/your-data) kirjeldavad muu hulgas kuritarvituse logisid ja prompt-cache'i. Konto ZDR-i, MAM-i, piirkonda ega mudelile ligipääsu ei eeldata. Pärispiloodi tegelik käivitus ja sisuline vastuvõtt on eraldi M4-B värav.
