# Projekti tööjuhis

## Alustamine ja seis

- Loe `docs/platvormi arendus/SotsiaalAI.md`-st S1.0 ja ainult ülesandega seotud sektsioon. S11 sisaldab keskkonna lisajuhiseid. Ära loe kogu faili ega juba loetud juhiseid uuesti ilma vajaduseta.
- Kontrolli `git status` ja `git log -1`; määra muudatuse ulatus ning vajalik tõend enne koodi. Serveri või `origin/main`-i kohta väites mõõda nende tegelik seis.
- Aktiivset tööd kannab ainult `SotsiaalAI.md`. Töö lõpus uuenda muutunud teemaseisu ja vajadusel S1.0 lühidalt; tehnilised tõendid jäävad vastavasse raportisse või commit'i. Eraldi seisu-/handoff-faile ei looda. Pilvesessioon kirjutab seisu PR-i kirjeldusse ega muuda `SotsiaalAI.md`-d, et paralleelsed PR-id ei läheks selles failis konflikti.

## Töö ja Git

- Omaniku arendusülesanne annab loa selle täitmiseks vajalikele kohalikele ja tagasipööratavatele muudatustele. Vali olemasoleva arhitektuuriga sobiv lahendus, teosta see ja kontrolli tulemust; ära peatu iga tavapärase teostusotsuse juures kinnituse küsimiseks.
- Kohalik töö käib põhikausta `main`-harus ühe kirjutajana. Pilvesessioon töötab oma harus ja viib töö `main`-i PR-iga. Muu eraldi haru või tööpuu ainult kokkuleppel. Alamagente ei kasutata.
- Säilita teiste pooleliolev töö. Stage'i ainult nimelised üle vaadatud failid; `git add .` ja `git add -A` on keelatud.
- Tee sidus muudatus olemasoleva arhitektuuri järgi. Väldi ülesandega mitteseotud ümberkirjutusi ja laia repo-uurimist.
- Push ja merge ei vaja omaniku luba, kui muudatuse kontrollid on läbitud. `main`-i ajalugu ei kirjutata ümber (force-push, rebase avaldatud commit'idel).
- Pilvesessiooni PR merge'itakse automaatselt, kui nõutud kontrollid on rohelised. Skeemi, õiguste, maksete, privaatsuse või kriisiabi muudatusel nimeta PR-i kirjelduses risk ja tehtud kontroll.
- Deploy: `main`-i roheline quality-gate käivitab `deploy` workflow'i (`scripts/deploy-server.mjs` + smoke-test `/api/health` vastu). Käsitsi `npm run deploy:server` ja päris sõnumite saatmine vajavad omaniku selget luba. Juba antud luba kehtib kokkulepitud ulatuses; ära küsi seda uuesti. Valmista ülevaadatav tulemus enne loaküsimust ette.
- Tasuliste teenuste kasutamisel järgi kokkulepitud ulatust ja kulupiiri. Uus tasuline teenus või kokkuleppimata mahutöö vajab eraldi kokkulepet; selle puudumine ei peata sõltumatut kohalikku arendust.
- Puuduva tooteotsuse korral tee sõltumatu töö valmis ja küsi ainult vajalik otsus. Lahenda tagasipööratavad teostusvalikud ise ning nimeta oluline eeldus tulemuse juures. Jätka ülesande piires järgmise vajaliku sammuga, kui takistus puudutab ainult üht tööosa.
- Commit'i sõnum selgitab parandatavat probleemi ja lahenduse põhjust.

## Kontrollid

Kasuta väikseimat kontrolli, mis tõendab muudatuse riski. Dokumentatsioonimuudatus ei vaja teste ega build'i.

- Tasulised mudelitestid ega eraldi AI-hindamisring ei ole arenduse või töö valmimise nõue. Ära lisa neid kohustuslikuks järgmiseks sammuks ega peata tööd nende loa ootamiseks. Kasuta tehnilise käitumise kontrollimiseks kohalikke sihtteste, testadaptereid ja olemasolevaid tõendeid; kirjelda ausalt sisulise kvaliteedi kontrollimata osa.
- Muudetud JS/JSX: `npx eslint <failid>`.
- Unit-testid: `npm test` (sama komplekt jookseb CI-s) või üks fail `node --import ./scripts/register-node-source-loader.mjs --test tests/<fail>`. `*.integration.test.mjs` ja `scripts/run-unit-tests.mjs`-is nimetatud failid vajavad kohalikku andmebaasi või EstNLTK-d.
- Tõlked või tõlkevõtmed: `npm run i18n:check`.
- Prisma skeem/migratsioon: `npx prisma validate` ja vajalik migratsiooni käitumise kontroll.
- Iga muudatus: `git diff --check`; enne commit'i ka stage'itud diffi kontroll.
- Käitumise muutus: vajalik sihttest. Õiguste, privaatsuse, maksete, skeemi ja võistlusolukordade puhul tõenda konkreetne risk; UI-/teenuserada kontrolli vajadusel päris keskkonnas.
- Väike madala riskiga CSS/UI-parandus: piisab `git diff --check`-ist ja sihitud brauserikontrollist; kogu repo lint'i, i18n-kontrolli ega kohalikku build'i ei käivitata, kui muudatus nende pinda ei puuduta.
- Järjestikused visuaalsed täpsustused koonda ning tee vajalik laiem värav üks kord stabiilse tulemuse järel, mitte iga väikese paranduse vahel.
- Kui deploy-käsk teeb serveris tootmisbuild'i, ära dubleeri seda vahetult enne kohaliku build'iga. Kohalik `npm run build` on vajalik ainult siis, kui risk vajab build'i tõendit enne push'i/deploy'd; brauseri/serveri impordipiiri või CI ehituse muutusel ka `npm run build:webpack`.

Ära korda sama muutumatu koodi läbitud kontrolle dokumentatsiooni või commit'ide jaotuse pärast. Ajatundlikud kontrollid käivita `TZ=UTC` all. Testi või build'i edu ei tõenda kontrollimata runtime'i: märgi see `not_run`/`NOT_PROVEN`.

## Keskkond

- Dev-server: `npm run dev` (port 3000). Kasuta juba töötavat serverit; ära tapa võõrast protsessi ega käivita sama kausta duplikaati.
- Kasuta eraldatud testandmeid. Ära loe tootmiskasutajate sisu ega kasuta päris kasutajaid testimiseks. Saladusi ei kirjutata koodi, raportitesse ega logidesse.
- Admini RAG-i käsitsi käivitatav enesetest on tootefunktsioon ja peab säilima.
- GraphRAG-tuuma hoia kliendist sõltumatuna; kliendi eripärad kuuluvad konfiguratsiooni või adapterisse. Allika nime/ID või oodatud vastuse järgi runtime-erandeid ei lisata.
