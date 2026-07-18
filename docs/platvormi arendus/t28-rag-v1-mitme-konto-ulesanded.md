# T28 RAG-V1 — järjestikuste kontode ülesanded

STATUS: COMPLETED — ajalooline üleandmisfail, mida ei kasutata tulevaste teemade mudelina; T28 on `CODE_READY @ 8c3e5f77`

Lõppseis: `codex/rag-v1 @ 8c3e5f778d1a85eb1281ee076f578ed227aeec55`, remote kattub, tööpuu puhas. Seda ülesannete komplekti enam ei väljastata; edaspidi antakse üks tervikteemaülesanne konto tüübist sõltumata. P8.6 päris proovipakk ootab eraldi omaniku ingest-otsust.

See fail on kopeeritavate ülesannete komplekt T28 `RAG-V1` lõpetamiseks. Eesmärk ei ole jagada teemat eri pakettideks ega lasta kontodel samas worktree's paralleelselt töötada. Iga järgmine konto jätkab täpselt eelmisest commit'ist ja samast progressifailist.

## Kasutamine

1. Anna kõigepealt ainult ülesanne 1.
2. Kui selle konto aeg lõpeb või ta annab etapilise üleandmise, anna järgmisele kontole ülesanne 2, siis 3 ja 4.
3. Kui eelmine etapp on pooleli, ei alustata järgmist nummerdatud etappi: uus konto lõpetab progressifaili „Täpselt järgmine samm” järgi eelmise etapi.
4. Viimasena anna ülesanne 5 lõpetavale, suurema võimekusega kontole. Tema teeb ühe tervikliku lõppüleandmise.

Kõik kontod töötavad samas worktree's ükshaaval:

```text
WORKTREE: C:\Users\rauds\Desktop\SotsiaalAI-rag-v1
BRANCH: codex/rag-v1
BASE: f17a3c365928433fbe5a9a681d6f8a91bb762010 (T06)
ALGSEIS: 77510353483547c4b9adc5744717385270f25f15
REMOTE: alguses puudub; esimene terve etapicommit push'itakse samale harule, kui võimalik
PROGRESS: docs/platvormi arendus/progress/T28-RAG-V1-progress.md
```

Lukustatud piirid kogu teemale:

- ära kasuta ega muuda määrdunud põhitööpuud `C:\Users\rauds\Desktop\SotsiaalAI`;
- ei merge'i, deploy'd, PR-i, rebase'i, reset'i, stash'i ega force-push'i;
- ei loeta tootmisvestlusi ega kasutajaandmeid;
- ei tehta päris URL-korjet, välist ingest'i ega P8.6 proovipakki ilma omaniku eraldi ingest-otsuseta;
- ei käivitata pikaealist worker'it Next.js protsessis;
- varasemad valmis osad (RAG-QM, safe fetch, dry-run, admini master-allikate paneel) jäetakse muutmata, kui konkreetne viga ei nõua kitsast parandust;
- iga konto alustab read-only seisukontrolliga (`status`, haru, HEAD, remote, viimased commit'id ja olemasolev diff) ning säilitab poolelioleva diffi.

Kasutage kontosid teenuse tingimuste piires. Kontovahetus ei muuda projekti turva- ega tootmispiire.

---

## Ülesanne 1 — P8.3 tekstiallika kinnitatud apply → ingest

```text
ÜLESANNE: T28 RAG-V1, ETAPP 1/5 — P8.3 kinnitatud tekstiallika apply → ingest
KONTO ROLL: järjestikune jätkuteostaja

TÖÖALA (AINUS):
Worktree: C:\Users\rauds\Desktop\SotsiaalAI-rag-v1
Haru: codex/rag-v1
Alus: f17a3c365928433fbe5a9a681d6f8a91bb762010
Eeldatav alg-HEAD: 77510353483547c4b9adc5744717385270f25f15
Progressifail: docs/platvormi arendus/progress/T28-RAG-V1-progress.md

ALUSTA:
1. Kontrolli ainult lugedes worktree, haru, HEAD, remote, viimased commit'id, status ja diff.
2. Loe olemasolev RAG-kood ning progressifail. Kui progressifail puudub, loo see esimesena selles harus; selles ülesandes olevad lukustatud piirid ja etappide kirjeldused on piisav alus.
3. Kui progressis on pooleli varasem samm, lõpeta ainult see samm. Ära alusta uut P8.3 tööd enne, kui varasem pooleliolev töö on selgelt lõpetatud või ausalt HANDOFF_REQUIRED.

EESMÄRK:
Tee admini poolt juba kinnitatud lokaalse tekstiallika kandidaat kontrollitavaks rakenduseks, mis kasutab olemasolevat turvalist ingest'i rada. Uus adapteritüüp on `html_or_topic`: ta saab ainult sisendi/faili/fixture'i kaudu antud teksti, mitte ei korja URL-i. Apply peab minema olemasoleva `/ingest/text` või samaväärse teenuselepingu kaudu, salvestama kanonilise meta ning tegeliku sisuräsi/fingerprint'i ja olema CAS-/idempotentsusohutu.

ULATUS:
- lisa kitsas `html_or_topic` adapter ning admini kinnitatud kandidaadi apply-rada olemasolevasse registri-/tööjärjekorra mustrisse;
- meta ja sisu peavad olema eristatavad: kanoniline allika identiteet/meta ei tohi teeselda, et see on URL-ist alla laaditud; sisuräsi arvutatakse tegelikust ingest'itavast tekstist;
- sama kandidaat/fingerprint ei tohi tekitada topeltingest'i; konkurents või aegunud ülevaatuse seis peab lõppema turvaliselt;
- ebaõnnestunud ingest annab üheselt masinloetava `RAG_INGEST` vea-/taastelepingu. Kui olemasolev `DataDeletionJob` konveier on juba kasutatav, seo see kohe; kui selle turvaline queue-integratsioon kuulub järgmisse etappi, jäta selge adapteriõmblus ja märgi see progressis etapi 2 sõltuvuseks;
- kasuta ainult fixture'eid ja lokaalselt antud teksti. `/ingest/url`, automaatne fetch, `--fetch`, välisvõrk ja päris allikate ingest on keelatud;
- ära tee migratsiooni ega uut paralleelset jobs-tabelit.

KONTROLL:
- lisa ainult selle etapi node:test/fake-Prisma sihttestid: kinnitatud apply, dubleering/fingerprint, CAS-race või aegunud kinnituse keeld, kanonilise meta ja tegeliku sisuräsi eristus, ning ebaõnnestumise leping;
- käivita need sihttestid ning muudetud failide lint. Täissviiti, production buildi ega runtime'i ära selles etapis korda.

PROGRESS JA ÜLEANDMINE:
- uuenda pärast iga sisulist sammu sama progressifaili: HEAD, dirty/remote seis, muudetud failid, tegelikult käivitatud kontrollid, täpselt järgmine samm ja katkemise seis;
- kui etapp on terviklik, commit'i koos progressifailiga ja push'i samale `codex/rag-v1` remote-harule, kui remote on saadaval;
- kui limiit katkeb, ära puhasta ega lähtesta midagi: kirjuta progressi HANDOFF_REQUIRED koos dirty failide ning ühe konkreetse jätkusammuga;
- lõppvastuses anna ainult: haru, HEAD/remote SHA, tehtu, sihttestid, NOT_DONE ja täpselt järgmine samm.

EI MERGE'I EGA DEPLOY.
```

## Ülesanne 2 — retry/dead-letter, lukud ja CAS

```text
ÜLESANNE: T28 RAG-V1, ETAPP 2/5 — tööjärjekorra töökindlus
KONTO ROLL: järjestikune jätkuteostaja

TÖÖALA (AINUS):
Worktree: C:\Users\rauds\Desktop\SotsiaalAI-rag-v1
Haru: codex/rag-v1
Alus: f17a3c365928433fbe5a9a681d6f8a91bb762010
Progressifail: docs/platvormi arendus/progress/T28-RAG-V1-progress.md

ALUSTA:
1. Loe täielikult progressifail ning kontrolli read-only worktree, haru, HEAD, remote, viimased commit'id, status ja diff.
2. Kui etapp 1 või muu varasem etapp ei ole progressi järgi valmis, lõpeta ainult selle puuduv täpselt järgmine samm. Ära alusta tööjärjekorra tööd enne seda.

EESMÄRK:
Muuda T28 ingest'i ja kustutuse tausttöö taaskäivitatavaks ning topeltkäivituse suhtes ohutuks, kasutades juba olemasolevat `DataDeletionJob`/tööjärjekorra mustrit. See on töökindluskiht, mitte uus ingest-funktsioon ega migratsiooniprojekt.

ULATUS:
- kasuta olemasolevat `DataDeletionJob`-i või repo samaväärset keskset töörida `RAG_INGEST`, `RAG_DELETE` ja `master_source` tööde jaoks; uut paralleelset tabelit ega migratsiooni ära loo;
- lisa piiratud retry, selge retryable/non-retryable põhjus, nähtav dead-letter seis ning idempotentne uuestikäivitus;
- kasuta advisory-lock'i või repo olemasolevat lukumustrit, et sama allika/versiooni pending töö ei dubleeruks;
- state-file või registri fingerprint/CAS kirjutus peab olema aatomne: katkestus ega konkurents ei tohi muuta vana head seisu poolikuks;
- ühenda etapi 1 `RAG_INGEST` ebaõnnestumise leping queue'ga, kui see oli jäetud õmbluseks;
- ära tee scheduleri, timeri ega worker-unit'i tööd: see on etapp 4;
- kui olemasolev model ei võimalda seda ilma skeemimuudatuseta turvaliselt, ära leiuta lahendust. Kirjuta progressi HANDOFF_REQUIRED koos täpse tõendiga ning jäta migratsioon lõpetavale kontole otsustada.

KONTROLL:
- fake-Prisma/node:test sihttestid vähemalt: pending-dedupe, retry piir ja dead-letter, concurrent lock, CAS-konflikt, idempotentne rerun ja ingest'i ebaõnnestumise sidumine;
- käivita ainult need testid ning muudetud failide lint. Ära käivita täissviiti ega production buildi.

PROGRESS JA ÜLEANDMINE:
- uuenda sama progressifaili pärast sisulisi samme ja enne kontovahetust;
- terviklik etapp commit'i ning push'i samale harule, kui võimalik;
- katkestuse korral säilita diff ja anna HANDOFF_REQUIRED: dirty failid, viimane edukas kontroll, täpselt järgmine käsk/samm;
- lõppvastus: haru, HEAD/remote SHA, tehtu, sihttestid, NOT_DONE, täpselt järgmine samm.

EI MERGE'I EGA DEPLOY. Ei kasutata päris URL-e, välisvõrku ega tootmisandmeid.
```

## Ülesanne 3 — versioonivahetus ja vana RAG_DELETE

```text
ÜLESANNE: T28 RAG-V1, ETAPP 3/5 — allikaversiooni turvaline vahetus
KONTO ROLL: järjestikune jätkuteostaja

TÖÖALA (AINUS):
Worktree: C:\Users\rauds\Desktop\SotsiaalAI-rag-v1
Haru: codex/rag-v1
Alus: f17a3c365928433fbe5a9a681d6f8a91bb762010
Progressifail: docs/platvormi arendus/progress/T28-RAG-V1-progress.md

ALUSTA:
1. Loe progressifail ja kontrolli read-only worktree, haru, HEAD, remote, viimased commit'id, status ja diff.
2. Kui etapp 1 või 2 on pooleli, tee enne ainult progressis nimetatud lõpetamata samm. Etappi 3 ei alustata enne varasema etapi selget lõpetust.

EESMÄRK:
Ehita RAG-allika versioonivahetus nii, et vana teadmise eemaldamine ei katkesta kunagi töötavat vastuseallikat. Eeskujuks on järjekord: uus vN+1 ingest → kontroll, et uuel versioonil on chunks > 0 → current liigub uuele versioonile → vana versiooni `RAG_DELETE` pannakse järjekorda → töö drainitakse ning vana chunks == 0 on tõendatud.

ULATUS:
- realiseeri see järjekord olemasoleva registri, ingest'i ja etapi 2 queue-lepingu peal;
- kui uue versiooni ingest või kontroll ebaõnnestub, vana current jääb aktiivseks ja otsing ei kaota kasutatavat sisu;
- retrieval välistab supersede'itud versioonid ka vahetuse/race'i ajal;
- delete on idempotentne ning retry/dead-letter sobib etapi 2 lepinguga;
- kasuta lokaalset fixture-põhist RAG teenust või repo testdouble'it. Ära korja URL-e ega kasuta tootmisandmeid;
- skeemimuudatus ainult siis, kui olemasolev mudel ei saa lepingut väljendada ja vajadus on koodist tõendatud. Eelista olemasolevat seisumudelit; kui migratsioon on vältimatu, jäta see lõpetavale kontole koos HANDOFF_REQUIRED põhjendusega.

KONTROLL:
- lisa sihttestid: v1 aktiivne → v2 õnnestub → vana delete; v2 ebaõnnestub ja v1 jääb aktiivseks; delete korduskäivitus; retrieval ei näe supersede'itut; vana chunks == 0 pärast edukat draini;
- käivita ainult need testid ning muudetud failide lint. Täissviit ja production build jäävad etappi 5.

PROGRESS JA ÜLEANDMINE:
- kirjuta progressi tegelik commit/remote/dirty seis, testid, järgmine samm ja kõik tõendamata read;
- commit'i ja push'i terve etapp samale `codex/rag-v1` harule, kui võimalik;
- katkestuse puhul ära puhasta diffi: HANDOFF_REQUIRED peab sisaldama täpselt järgmist väikest sammu.

EI MERGE'I EGA DEPLOY. P8.6 päris proovipakk ei kuulu sellesse etappi.
```

## Ülesanne 4 — allikate kontrolli taimer ja worker-unit

```text
ÜLESANNE: T28 RAG-V1, ETAPP 4/5 — allikate värskuskontroll ja repo-hallatud worker
KONTO ROLL: järjestikune jätkuteostaja

TÖÖALA (AINUS):
Worktree: C:\Users\rauds\Desktop\SotsiaalAI-rag-v1
Haru: codex/rag-v1
Alus: f17a3c365928433fbe5a9a681d6f8a91bb762010
Progressifail: docs/platvormi arendus/progress/T28-RAG-V1-progress.md

ALUSTA:
1. Loe progressifail ja kontrolli read-only worktree, haru, HEAD, remote, viimased commit'id, status ja diff.
2. Kui varasem etapp on pooleli, lõpeta ainult selle puuduv samm. Ära alusta taimerit enne, kui P8.3–P8.4 ahel on valmis või selle piirang on progressis ausalt fikseeritud.

EESMÄRK:
Lisa master-allikate kontroll, mis märgib värskuse ausalt, kuid ei muuda teadmiste seisu automaatselt. Pikaealine töö kuulub repo-hallatud ops-unit'i, mitte Next.js serveriprotsessi.

ULATUS:
- lisa `check-master-sources` või olemasolevasse tööriista samaväärne käsk, mis kontrollib ainult `next_check_at`-iga küpseid allikaid;
- kasuta olemasolevat turvalist fetch'i: redirect'id, gone/puuduva allika käsitlus ning kontrolli tulemus salvestatakse ilma ingest'i käivitamata;
- hoia gone-counter'it: alles kolm ebaõnnestunud kontrolli vähemalt 48 tunni jooksul võivad tõsta nähtava hoiatusseisu; ei arhiivita, ei avaldata ega kustutata automaatselt;
- lisa repo-hallatud `sotsiaalai-rag-worker.service` ja/või sobiv systemd timer olemasoleva ops-mustri järgi. Unit peab olema vaikimisi vaid installitav/hinnatav: seda ei enable'ita, ei käivitata ega deploy'ta;
- worker-unit'i puudumine või väär env peab andma nähtava hoiatuse, mitte vaikiva deploy;
- ära käivita inline worker'it Next.js protsessis, ära tee P8.6 päris korjet ning ära lisa automaatset ingest'i.

KONTROLL:
- fixture/testdouble sihttestid: `next_check_at` filter, redirect, gone-counter 3 korda/48 h, ei-autoarchive/eipublish/eingest, unit/env-hoiatus;
- käivita need testid ja muudetud failide lint. Täissviit ja production build jäävad etappi 5.

PROGRESS JA ÜLEANDMINE:
- uuenda sama progressifail, commit'i ning push'i terviklik etapp samale harule, kui võimalik;
- katkestuse puhul säilita worktree ja kirjuta HANDOFF_REQUIRED koos dirty failide, viimase kontrolli ning täpselt järgmise sammuga;
- lõppvastus: haru, HEAD/remote SHA, tehtu, sihttestid, NOT_DONE, järgmine samm.

EI MERGE'I EGA DEPLOY. Ei käivitata systemd unit'it ega loeta tootmisandmeid.
```

## Ülesanne 5 — lõpetav konto: T28 terviklik viimistlus ja üleandmine

```text
ÜLESANNE: T28 RAG-V1, ETAPP 5/5 — lõpetav integratsioon, tõend ja üks lõppüleandmine
KONTO ROLL: lõpetav teostaja (suurem võimekus)

TÖÖALA (AINUS):
Worktree: C:\Users\rauds\Desktop\SotsiaalAI-rag-v1
Haru: codex/rag-v1
Alus: f17a3c365928433fbe5a9a681d6f8a91bb762010
Progressifail: docs/platvormi arendus/progress/T28-RAG-V1-progress.md

ALUSTA:
1. Loe täielikult progressifail, kõik T28 commit'id ning asjakohane RAG-kood. Kontrolli read-only haru, HEAD, remote, status ja diff.
2. Kui ükski etapp 1–4 on progressis pooleli või ainult dokumendis „valmis”, lõpeta kõigepealt see täpne puuduv osa. Ära loo uut haru ega korda valmis etappi.

EESMÄRK:
Anna T28 `RAG-V1` terviklik, pushitud `CODE_READY` haru koos ühe ausa lõpparuandega. Lahenda vaid eelmistest etappidest jäänud ristkihid ja lepingurikkumised.

LÕPUULATUS:
- kontrolli, et P8.3 tekstiallika apply→ingest, P8.4 versioonivahetus/`RAG_DELETE`, retry/dead-letter/CAS ning master-allikate check/worker-unit moodustavad ühe sidusa elutsükli;
- hoia olemasolevad turvalised piirid: registriviide ei ole vastuse ainus sisuallikas, supersede'itud versioonid ei jõua retrieval'isse, URL-fetch jääb turvaliseks ning worker ei ole inline Next.js protsess;
- P8.6 päris proovipakk jääb `NOT_DONE — OWNER_DECISION`. Ära fetch'i ega ingest'i päris välisallikaid.

KONTROLL (üks kord teema lõpus):
- käivita T28 koond-sihttestid ja seotud regressioonid, kuid ära käivita `npm test` täissviiti, kui midagi eraldi ei nõuta;
- muudetud failide lint, `npm run i18n:check`, Prisma validate/migratsioonikontroll vastavalt tegelikule skeemimuudatusele, `git diff --check` ja production build;
- kui see on lokaalselt turvaliselt võimalik, tee sünteetiline fixture-põhine runtime: v1 aktiivne → v2 ingest → vana `RAG_DELETE` → vana chunks == 0. Korista kõik ülesandes loodud sünteetilised andmed, protsessid ja failid. Kui keskkond ei võimalda seda, ära improviseeri: märgi `NOT_RUN`/`NOT_PROVEN` koos põhjusega;
- ei autentitud tootmiskontosid ega päris kasutajaandmeid.

PROGRESS, PUSH JA LÕPPARUANNE:
- uuenda progressifaili lõppseisuks `CODE_READY` või ausaks `HANDOFF_REQUIRED` koos remote SHA, tööpuu seisuga, kõigi etappide commit'ide ja tõendamata ridadega;
- push'i sama haru `origin/codex/rag-v1`; kui push ei ole võimalik, nimeta see selgelt `LOCAL_ONLY`, mitte valmis;
- anna üks lõpparuanne: worktree, haru, alus, kohalik/remote SHA, commit'id, migratsioonid, diff, tehtud P8.3/P8.4/P8.5 osad, tegelikult käivitatud testid/build/runtime, cleanup, `NOT_DONE`/`NOT_PROVEN` ning P8.6 omanikuotsus;
- ei merge'i, deploy'd ega PR-i.
```

## Koordinaatori vastuvõtupiir

Pärast ülesande 5 lõpparuannet kontrollitakse ainult Git-fakte (haru, parent, commit, remote ja tööpuu). Teostaja sihtteste, buildi ja runtime'i ei korrata. Sõltumatu audit ja täissviit kuuluvad T27 release-candidate'i väravasse, mitte konto vahetuse vahe-etappi.
