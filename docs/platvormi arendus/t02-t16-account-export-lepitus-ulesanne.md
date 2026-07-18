# ÜLESANNE: T02+T16 LEPITUS — konto elutsükkel ja andmete eksport uuele main-baasile

**Olek:** `READY_TO_ASSIGN` (loodud 2026-07-18)  
**Teostus:** üks worktree, üks haru, üks terviklik lõppüleandmine  
**Soovitatud teostaja:** Fable 5 High (turvatundlik e-postivahetus, migratsioonid, kustutusahel)  
**Järjekord:** sõltumatu T10-st ja T07-st; selle valmimine AVAB T09 `PAYMENTS-V1` (mis vajab account-alust).

## Taust — miks see ülesanne olemas on

18.07 integratsioonis liideti 26 haru kohalikku `main`-i, kuid **T02 `codex/account-v1 @ 929793f1` ja T16 `codex/export-v1 @ c2361e6a` jäeti teadlikult välja disainikollisiooni tõttu**:

- T02 kirjutas e-posti vahetuse ümber **verify-then-swap** mudelisse: `PendingEmailChange` kirje + kinnitustoken, e-post vahetub alles kinnitamisel (migratsioon `20260717120000_add_pending_email_change`).
- Vahepeal jõudis `main`-i PROF-P1 (`16e688f7`), mis lisas **kohese swapi** mudelile reauth-nõude ja rate-limiti (`app/api/profile/route.js`, `lib/profile/accountLifecycle.js`).
- Mehaaniline merge andis 24 konfliktiplokki kahe kokkusobimatu disaini vahel; integratsioon katkestati õigesti.
- T16 (ekspordiregister, `DataExportJob`, copy-first värav kustutusvoos; migratsioon `20260717143000_data_export_v1`) on ehitatud T02 otsa ja jäi koos sellega välja.

Mõlemad harud on `CODE_READY` vastuvõetud lõpparuannetega (T02: 1314/1314 + isoleeritud runtime PROVEN; T16: 1331/1331 + päris-DB sünteetiline runtime PROVEN). Töö EI ole ümber teha — töö on **lepitada uue main-baasiga**.

## Kinnitatud disainiotsus

**Verify-then-swap VÕIDAB.** See on T02 vastuvõetud lõpparuande tulem. Kohese swapi kood asendatakse. PROF-P1 kaitsed **peavad ellu jääma** uues mudelis:

1. e-posti vahetuse algatamine nõuab endiselt värsket reauth'i (step-up);
2. rate-limit kehtib vahetuse algatamise (mitte ainult lõpuleviimise) peale;
3. `sessionVersion`-i tõstmise loogika säilib seal, kus T02 leping seda nõuab (PIN-i vahetus kohe; e-posti vahetus kinnitamisel).

Kui leiad koha, kus PROF-P1 ja T02 leping on päriselt vastuolus (mitte lihtsalt eri failiread), ära otsusta ise — dokumenteeri ja too lõpparuandesse otsustuspunktina.

## Loe enne tervikuna

1. `CLAUDE.md`
2. `docs/platvormi arendus/t02-account-v1-ulesanne.md` (algne T02 leping)
3. `docs/platvormi arendus/t16-export-v1-ulesanne.md` + `t16-export-v1-jatkuulesanne.md`
4. T02 ja T16 lõpparuanded (worktree'des `SotsiaalAI-account-v1`, `SotsiaalAI-export-v1` või dokiregistris)
5. `main`-i praegune profiilikood: `app/api/profile/route.js`, `lib/profile/accountLifecycle.js`, `tests/profile/accountLifecycle.test.js` (PROF-P1 seis, mis tuleb säilitada)

## Alus ja worktree

1. Baas on KOHALIK `main` (väljastamise hetkel `d0b0af3f`; kontrolli `git rev-parse main` ja raporteeri kasutatud SHA). `origin/main` on serverina taga; seda ei kasutata.
2. Loo uus worktree: `git worktree add ../SotsiaalAI-t02-t16-remerge -b codex/t02-t16-remerge main`
3. Lepitusstrateegia on sinu valida (merge konfliktilahendusega VÕI sihitud cherry-pick/port), aga tulemus peab olema **auditeeritav**: lõpparuandes kirjeldad, kuidas iga konfliktifail lahenes ja kummalt poolelt iga otsus tuli.
4. Algseid harusid `codex/account-v1` ja `codex/export-v1` EI muudeta, EI rebase'ita ega force-push'ita — need on vastuvõetud tõendusmaterjal.
5. Ära kasuta teiste teemade poolelolevaid worktree'sid (`SotsiaalAI-field-v1`, `SotsiaalAI-esta-mentor-v1`, `SotsiaalAI-public-v1`, `SotsiaalAI-documents-research-v1`) alusena. Paralleelsed teemad T10/T07 on väljas; tõlkemuudatused hoia T02/T16 võtmetes.

## Teadaolevad konfliktipesad (18.07 proovimerge põhjal)

- `app/api/profile/route.js` (3 plokki), `lib/profile/accountLifecycle.js` (6), `tests/profile/accountLifecycle.test.js` (15) — verify-then-swap vs kohene+reauth. See on töö tuum.
- Migratsioonid: `20260717120000_add_pending_email_change` ja `20260717143000_data_export_v1` sorteeruvad main'i olemasolevate `20260717180000/193000/233000` ETTE. Server pole ühtegi neist veel rakendanud, seega värske-ahela kontroll peaks läbima; kui `npm run db:migrate:check` siiski kukub järjestuse tõttu, nimeta migratsioonikaust ümber värske ajatempliga ja raporteeri see.
- T16 copy-first värav puudutab T02 kustutusvoogu — kontrolli, et see istub main'i praeguse kustutusahela (sh admin-v1-core bulk-kustutus ja retention-rajad) peale.
- `messages/*.json` — liida võtmed additiivselt, `npm run i18n:check` peab läbima.

## Nõutud väravad (kõik samas harus, enne üleandmist)

1. T02 sihttestid (profiil/konto elutsükkel) ja T16 sihttestid (dataExport) rohelised **uue** mudeli vastu.
2. PROF-P1 testid rohelised või teadlikult uuendatud (kui test kirjeldas kohese swapi käitumist, asenda see verify-then-swap lepingu testiga ja raporteeri asendus).
3. Täissviit `npm test`, `npm run lint`, `npm run i18n:check`, `npm run db:migrate:check`, `git diff --check`, production build.
4. Sünteetiline runtime lokaalse DB-ga: e-posti vahetuse täisring (algata → reauth → pending → kinnita → swap → vanad sessioonid kehtetud), PIN-i vahetus, ekspordi loomine ja allalaadimine, copy-first värav kustutusel. Mis ei ole käivitatav, märgi ausalt `NOT_RUN`/`NOT_PROVEN`.
5. Brauseri-QA jääb T27 koondväravasse; seda siin ei nõuta.

## Selgelt väljas

- Uus funktsionaalsus, mida T02/T16 lepingud ei sisalda; UI ümberdisain; makse-loogika (T09 tuleb eraldi).
- Merge `main`-i, deploy, PR, põhitööpuu muutmine, algsete harude ümberkirjutamine, tootmisandmed, päris e-kirjad.
- `.env` `MAKSEKESKUS_PUBLIC_KEY` küsimus — see on eraldi omaniku otsus, ära lahenda siin.

## Lõpparuanne

Esita: worktree, haru, kasutatud `main`-baasi SHA, lõppcommit/remote SHA; konfliktifailide kaupa lahenduse kirjeldus (kummalt poolelt, miks); migratsioonide lõplikud nimed; kõigi väravate tulemused; runtime-ringi tulemus või `NOT_RUN`; PROF-P1 kaitsete säilimise tõendus (viide testidele); avastatud päris-vastuolud otsustuspunktidena; kinnitus, et algsed harud, `main`, server, merge ja deploy on puutumata.

Pärast lõpparuannet kontrollib koordinaator ainult Git-faktid ja lepitusotsuste loogika; teste/buildi ei korrata. Vastuvõtu järel liidetakse haru main'i eraldi koordinaatoritoiminguna ja T09 muutub väljastatavaks.
