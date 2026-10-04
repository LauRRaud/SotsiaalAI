# ADR-037 — Väljalase ja vestlusplaan lähevad käiku koos

27.09.2026. Teostus Claude Opus 5.5. Järgib Codexi #212 ülevaatust ([aruanne, jaotis 5](../audits/rag-v2-codex-review-2026-09-27.md#5-pr-212-koodiülevaatus-ja-väljalaskeraja-puudus)). Omaniku otsus samal päeval: plaan uuendatakse väljalaskel automaatselt.

## Probleem

Kinnitatud vestlusplaan on seotud täpse koodiga (`implementationHash`, [ADR-028](adr-028-production-answer-prompt.md)). Räsi katab ka paljusid mitte-RAG faile (`package.json`, `messages/*.json`, `auth.js`, vestluse UI).
- Iga selline väljalase tegi aktiivse plaani aegunuks. Vestlus keeldus vastamast (`implementation_approval_mismatch`), aga deploy andis ainult hoiatuse ja tervisekontroll (`/api/health`, avaleht) läbis.
- 24.09 jäi see märkamata. 27.09 oli vestlus pärast PR #212 väljalaset ~20 minutit (21:08–21:27 EEST) ilma sobiva plaanita, sest uus plaan ehitati käsitsi ja jälgimisskript ei märganud deploy lõppu.
- Pelgalt jälgimise parandamine ei seo koodi ja plaani üheks väljalaskeks.

## Otsus

- **Uuendus** (`renewChatPlan`, `lib/rag-v2/pilot/chat-plan.js`). Uus plaan tehakse aktiivsest kinnitatud plaanist:
  - muutmata jääb kõik, mis kuulub omaniku kinnituse ulatusse: kasutajad, konto, mudel ja lõpp-punktid, hinnad, eelarve (kõik piirid), väljasaatmise load, küsimuste kord, otsinguprofiil, indeksipõlvkond ja dokumendiversioonid;
  - uueks saavad ainult väljad, mis tulenevad koodist (`codeContract()`): `implementationHash`, dialoogi-, juhise-, otsinguabi-, kataloogi- ja olekulepingu versioonid ning uus id (`…-r<commit>`, oma kulupäevik);
  - kinnitus kantakse edasi: `authorization: release_renewal_of_approved_plan`, `renewedFrom` (eelmise plaani id ja räsi), `authorizationBasis.renewal` koos omaniku reegliga. Uuendada saab ainult kinnitatud, avatud küsimustega päris plaani, mille kinnitus seob täpselt selle sisu.
- **Väljalaske kontroll** (`scripts/rag-v2-plan-release.mjs`, `scripts/deploy-server.mjs`), mudelikutseta:
  1. RAG-kataloogi migratsioonid jooksevad nüüd **enne** põhiandmebaasi migratsiooni.
  2. `prepare` kontrollib aktiivset plaani uue koodiga: seadistus nagu vestluspöördel (`readPilotConfig` execute) ja vestluse eelkontroll aktiivse indeksi vastu (`preflight`):
     - `current`: plaan sobib;
     - `renewed <fail>`: plaan oli aegunud; uuendus läbis samad kontrollid ja kirjutati `/etc/sotsiaalai/` alla (veel mitte aktiivne);
     - `unready <kood>`: plaan poleks töötanud ka enne väljalaset (loetamatu, kinnitamata või selle indeksipõlvkond pole enam aktiivne). Väljalase jätkub hoiatusega.
     - **Viga:** plaan töötab praegu, aga uue koodiga ükski plaan ei läbi. Deploy peatub enne põhiandmebaasi migratsiooni ja olemasolev tagasipöördumise rada taastab eelmise commit'i, sõltuvused ja buildi. `rag.env` on selleks hetkeks puutumata, nii et eelmine kood tuleb tagasi koos oma plaaniga.
  3. Pärast põhimigratsiooni ja enne taaskäivitust aktiveeritakse uuendatud plaan (`rag.env` koopiaga). Kui väljalase peatub hiljem ja kood jääb (andmebaas liikus edasi), aktiveerib tagasipöördumise rada uuendatud plaani, sest uus kood töötab ainult sellega.
  4. Pärast taaskäivitust `ready`: seadistus ja eelkontroll sama plaaniga. Kui see ei läbi, on deploy punane (`::error`). Tagasi pöörduda sel hetkel ei saa, sest põhiandmebaas on migreeritud.
- **RAG-kataloogi migratsioonid peavad eelmise väljalaske töös hoidma:** tabeleid ja veerge lisatakse, mitte ei eemaldata ega nimetata ümber. Muidu ei saaks peatunud väljalase eelmist koodi taastada.
- **Eelarve jätkub** (Codexi ülevaatus, P1): uuendatud plaan nimetab kinnitatud plaani kulupäeviku (`budgetLedger`, ahelas alati esimene plaan). `PilotStore` broneerib, lukustab ja arvestab selle päeviku järgi, nii et uuendus ei taasta juba kasutatud eelarvet. Päevikut, mille teine plaan lõi, saab kasutada ainult plaan, mis seda kinnitatult nimetab (`ledger_plan_conflict`). Käsitsi tehtud uus plaan saab uue päeviku ja uue kinnitatud eelarve.
- `scripts/rag-v2-chat-plan.mjs` jääb uue plaani tegemiseks, näiteks uue indeksipõlvkonna, teise eelarve või mudeli jaoks. See kasutab sama teeki (`newChatPlan`, `preflightChatPlan`, `activateChatPlan`).

## Kontroll

- `tests/deploy-plan-release.test.mjs` käivitab **päris genereeritud deploy-skripti** kohaliku git-hoidla ja kõnesid salvestavate `sudo`/`systemctl`/`npm`/`npx` asendajatega:
  - plaani kontroll ebaõnnestub: exit 8, taastuvad eelmine commit, eelmine build ja muutmata `rag.env`; põhimigratsioon ja aktiveerimine ei jooksnud; sõltuvused paigaldati eelmisele koodile uuesti ja teenus käivitati;
  - uuendatud plaan: järjekord RAG-migratsioon → `prepare` → põhimigratsioon → `activate` → taaskäivitus → `ready`;
  - enne väljalaset katki olnud plaan: hoiatus, väljalase jätkub, plaani ei vahetata;
  - `ready` ebaõnnestub: exit 9, uus kood ja uuendatud plaan jäävad.
- `tests/rag-v2-plan-release.integration.test.mjs` (päris Postgres, Qdrant ja EstNLTK, sünteetilised salvestatud vektorid): `current`, `renewed` (sama kinnituse ulatus), `activate`, `ready`; edasi liikunud indeks annab `unready active_index_mismatch`; uue koodiga mittetöötav plaan annab vea ega kirjuta faili.
- `tests/rag-v2-chat-plan.test.mjs`: uuendus hoiab kinnituse ulatuse; ainult kinnitatud avatud päris plaan ja nimetatud väljalase; `rag.env` aktiveerimine koopiaga; käsk ei trüki plaani sisu.

## Piirid

- Uuendus hoiab indeksipõlvkonna. Uus põlvkond vajab endiselt uut plaani (`rag-v2-chat-plan.mjs`). Automaatne üleminek on järgmine etapp.
- Mudeli, eelarve, kasutajate või hindade muutus vajab uut plaani. Kui näiteks `OPENAI_MODEL` muutub, ei läbi uuendus kontrolli ja väljalase pöördub tagasi.
- Tagasipöördumine katab ainult `prepare` vea (enne põhimigratsiooni). Kui `ready` pärast taaskäivitust ebaõnnestub, jääb uus kood koos uuendatud plaaniga tööle ja deploy on punane. Varasem `prepare` teeb sama kontrolli, nii et see tähendab vahepealset muutust keskkonnas. `unready` (plaan polnud ka enne väljalaset töökorras) jätkab väljalaset hoiatusega.
- Iga uuendus jätab `/etc/sotsiaalai/` alla uue plaanifaili ja `rag.env` koopia. Koristus on käsitsi.

## Täiendus 04.10.2026: käsitsi tehtud plaan ja väljalaskekaustad

Avaldamine käib nüüd väljalaskekaustadega (`scripts/deploy-release-host.mjs`, [audit](../audits/release-build-once-2026-10-04.md)). Iga väljalase saab oma env-faili `/etc/sotsiaalai/releases/<commit>.env`, mis tehakse `frontend.env`-ist ja `rag.env`-ist. Uuendatud plaani kirjutab deploy sellesse faili ja pärast õnnestunud vahetust ka `rag.env`-i. Ülal kirjeldatud deploy-skripti sammude järjekord ja testid on 27.09 seis.

- Käsitsi tehtud plaan (`rag-v2-chat-plan.mjs --activate`) jõuab ainult `rag.env`-i, kust selle saab järgmine väljalase. Töötav teenus loeb ainult oma väljalaske env-faili.
- Seepärast tehakse sama aktiveerimine ka seal: `rag-v2-plan-release.mjs activate --plan <fail> --rag-env /etc/sotsiaalai/releases/<commit>.env`, siis `ready` ja taaskäivitus. `scripts/rag-v2-corpus-run.sh` teeb seda ise ([ADR-059 täiendus](adr-059-corpus-refresh-path.md#täiendus-04102026-serveriskript-väljalaskekaustade-korral)); käsitsi käsud on [runbooki jaotises 9](runbook-corpus-increment.md#9-aktiveerimine-ja-vestlusplaan).
