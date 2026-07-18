# ÜLESANNE: T02 `ACCOUNT-V1` — konto ja turvaline ligipääs

**Olek:** `ASSIGNED_WAITING_START` — antud Fable'ile 2026-07-17; worktree/haru algusfakte oodatakse  
**Teostus:** üks worktree, üks haru, üks terviklik lõppüleandmine  
**Soovitatud teostaja:** Terra Medium või Sol Medium

## Eesmärk

Kasutaja saab turvaliselt hallata profiili, e-posti ja PIN-i, taastada ligipääsu, saada turvasündmuse teate ning kustutada konto ausa lõppseisuga. See töö võtab sisse olemasoleva PROF-P1 aluse ja lõpetab kogu konto-teema; see ei ole mikro-pakett.

Valmis kasutajatee tähendab:

1. e-post ei muutu enne, kui uue aadressi valdaja on selle kinnitanud;
2. PIN-i muutus ja taastamine sulgevad kõik vanad sessioonid;
3. turvasündmusest tuleb selge teade ilma PIN-i, tokeni või muu saladuseta;
4. paroolita konto ei pääse tundlikust kontrollist mööda;
5. konto kustutuse `202 pending` ütleb ausalt, et ligipääs on suletud, kuid koristus jätkub;
6. profiili dialoogid on klaviatuuri ja ekraanilugejaga kasutatavad;
7. aegunud tellimus ei näi aktiivse ega lihtsalt tasuta seisuna.

## Loe enne tervikuna

1. `CLAUDE.md`
2. `docs/platvormi arendus/teemaarenduse-jatkamise-kord.md`
3. `docs/platvormi arendus/fable-5-profiil-ja-konto-elutsukkel.md`
4. `docs/platvormi arendus/arendusteemade-masterregister.md` — T02
5. `docs/platvormi arendus/tehis-testkontod.md`
6. `app/api/profile/route.js`, `app/api/profile/logout-all/route.js`, `app/api/verify-email/route.js`
7. `app/api/auth/password/reset/route.js`, `components/alalehed/UuendaPinBody.jsx`, `components/alalehed/UuendaEpostiBody.jsx`, `components/alalehed/ProfiilBody.jsx`
8. `components/ui/Modal.jsx`, `components/ui/ModalConfirm.jsx`, `components/profile/UsageOverview.jsx`, `lib/usage/snapshot.js`
9. PROF-P1 aluscommit `16e688f76fc68be237f21ee187bd7191d055f00d` ja `tests/profile/accountLifecycle.test.js`.

## Alus ja worktree

1. Kontrolli enne alustamist `origin/main` SHA-d. Ülesande koostamise hetkel on see `fe4eb4fa7997a7eada9417a27c6cea75ccd23cbe`.
2. Ära kasuta ega muuda määrdunud põhitööpuud `C:\Users\rauds\Desktop\SotsiaalAI`.
3. Loo uus worktree, näiteks `C:\Users\rauds\Desktop\SotsiaalAI-account-v1`, ja värske haru `codex/account-v1` aktiivsest `origin/main`-ist.
4. Too PROF-P1 samasse harusse käsuga `cherry-pick -x 16e688f76fc68be237f21ee187bd7191d055f00d`. Ära muuda algset `codex/prof-p1-email-reauth-rate-limit` haru.
5. Kui remote SHA või cherry-pick erineb, lahenda ainult konto-teema piires ja raporteeri kõrvalekalle. Ära rebase'i, puhasta põhitööpuud ega alusta uut paralleelset konto-haru.

## Lukustatud V1 valikud

| Otsus | V1 valik |
|---|---|
| E-posti muutus | **Verify-then-swap.** `User.email` jääb vanaks sisselogimisidentiteediks kuni uus aadress on kinnitatud. |
| Turvateavitused | E-posti muutuse kinnitumisel kiri vanale aadressile; PIN-i muutumisel kiri kontol kehtivale aadressile. Kirjas ei ole PIN-i, tokenit ega uut e-posti. |
| Paroolita konto | E-posti muutus ja konto kustutus vajavad esmalt PIN-i loomist olemasoleva e-posti taastamisraja kaudu. Olemasolev sessioon üksi ei ole piisav. |
| Aegunud tellimus | Näita selgelt „tellimus aegus” koos kuupäevaga ja paketihalduse CTA-ga. T09 arveldus- ega õigusteolekut ei muudeta. |
| Admini eelvaade | Profiil näitab informatiivset riba tegeliku konto- ja aktiivse vaaterolliga; õigused ei muutu. |
| Kustutuse `202` | Pärast väljalogimist anonüümne lokaliseeritud kinnitusvaade. `deletionJobId` ega kontoandmed ei jõua URL-i, DOM-i ega logisse. |

## Teostus

### E1 — PROF-P1 samas teemas

- Säilita serveripoolne praeguse PIN-i kontroll e-posti muutmisel ning IP + userId võtmega rate-limit enne kallist bcrypt-kontrolli.
- Sama e-posti esitamine ei tohi põhjustada reauth'i, sessioonide tühistust ega kirja saatmist.
- Kliendist tulnud `currentPassword` ei ole kunagi turvatõde: tundlik otsus jääb serverisse.

### E2 — verify-then-swap e-posti elutsükkel

- Asenda kohe-vahetamise rada poolelioleva e-postimuutuse mudeliga. Lisa minimaalne püsiv olek ja migratsioon, kui see on vajalik unikaalsuse, tokeni sidumise ning aegumise tõestamiseks.
- Taotluse alustamine nõuab õiget PIN-i ja rate-limit'i. Kontrolli kandidaati nii aktiivsete kontode kui pooleliolevate taotluste vastu.
- Enne kinnitamist jäävad vana e-post, selle kinnituse staatus ja sisselogimisvõime puutumata; uuele aadressile saadetakse ainult muutuse kinnitamise link.
- Kinnitamine kontrollib tokenit, aegumist, omanikku ja unikaalsust uuesti samas aatomses tehingus. Alles seejärel vaheta e-post, märgi uus aadress kinnitatuks, tühista taotlus/seotud tokenid ja tõsta `sessionVersion`.
- Korduskasutatud, aegunud, võõras või võistlev token ei tohi muuta kontot ega avaldada konto olemasolu.
- Pärast edukat kinnitamist saada vana aadressi omanikule turvateavitus. Kirja saatmise rike ei tohi juba toimunud turvamuutust tagasi kerida; logi ainult turvaline veainfo.
- UI peab näitama selget „ootab kinnitust” seisu, piiratud kordussaatmist, katkestamist enne kinnitamist ning tühja-/laadimis-/veaolekuid.

### E3 — PIN, taastamine ja sessioonid

- PIN-i muutmine säilitab serverikontrolli ning saadab eduka muutuse järel turvateavituse kontol kehtivale e-postile.
- PIN-i taastamise `PUT /api/auth/password/reset` teeb ühes tehingus PIN-i muutuse, tokeni kasutamise ja täieliku vana sessiooniseisu tühistuse: `sessionVersion`, `Session`, `TrustedDevice`, `LoginTempToken`, `EmailOtpCode`.
- Taastamine eristab puuduvat, kehtetut, aegunud, rate-limit'i ja edukat seisu ilma konto olemasolu lekitamata. Ära ehita uut autentimisviisi ega muuda registreerimist.
- Kui `passwordHash` puudub, tagastavad e-posti muutmise ja kustutuse serverirajad serveris kontrollitud step-up vastuse. UI juhatab kasutaja PIN-i taastamisele; klient ei saa piirangut lipuga mööda minna.

### E4 — profiili ausad olekud

- Lisa kasutus-snapshot'i ja `UsageOverview`-sse eristatav aegunud tellimuse esitlus. See on ainult kasutaja enda kuvakiht; T09 omab arvelduse ja entitlement'ide olekumasinat.
- Lisa admini aktiivse vaaterolli mitteinteraktiivne indikaator. Mitte-admini päring ei tohi saada lisainfot ega õigusi.
- Erista kustutuse `200` ja `202`: `202` annab pärast sessiooni lõpetamist anonüümse poolelioleva kustutuse teate, `200` lõpliku kinnituse.

### E5 — konto dialoogide ligipääsetavus

- Paranda jagatud `Modal`-primitiivi konto kasutuse jaoks: avahetke algfookus, Tab/Shift+Tab fookuselõks, Escape, avaja fookuse taastamine ja korrektne dialoogisemantika.
- Busy/kustutusolekus ei tohi Escape ega overlay pooleliolevat toimingut sulgeda.
- Ära tee T15 asemel platvormiülest a11y-auditit. T02 parandab primitiivi ja tõendab konto kasutusjuhud; T15 katab hiljem muud pinnad.

### E6 — keeled ja mobiil

- Lisa iga uus kasutaja- ja e-kirjatekst sümmeetriliselt `messages/et.json`, `messages/en.json`, `messages/ru.json`; serveri `messageKey` ei tohi olla kasutajale nähtav.
- Kontrolli klaviatuuriga e-posti muutmist, PIN-i muutmist, taastamist, kustutust ja modaalide sulgemist ning 375 px mobiilivaadet.
- Reduced-motion jääb rahulikuks; konto turvarada ei vaja dekoratiivset liikumist.

## Väljas

- T09 maksete, webhookide, reconciliation'i, entitlement'ide või päris maksete muutmine.
- T10 registreerimise, avalehe ja hinnastuse tervikümbertegemine.
- T15 platvormiülene ligipääsetavuse täisaudit.
- Admini õiguste või rollivahetaja loogika muutmine; T02 võib olemasolevat eelvaadet ainult ausalt kuvada.
- Konto kustutamise säilitus-/maksekirjete poliitika muutmine (T09/T16/O-TK9).
- Päris kasutajate, päris postkastide, tootmisandmete või tootmisserveri kasutamine.
- Merge, deploy, PR, põhitööpuu puhastus, rebase ja force-push.

## Nõutud testilepingud

Lisa või laienda `node:test` sihtteste. Vähemalt:

1. Vale/puuduv PIN ei loo e-postitaotlust, ei muuda DB-d ega saada kirja; rate-limit toimub enne bcrypti.
2. Õige PIN loob poolelioleva taotluse, vana e-post jääb sisselogimisel kehtima.
3. Kinnitus vahetab e-posti aatomselt ühe korra, lõpetab vanad sessioonid ja saadab vana aadressi turvateate ilma saladusteta.
4. Aegunud, korduskasutatud, võõras või võistlev token ei muuda ühtegi kontot.
5. PIN-i muutus ja taastamine tühistavad vanad sessioonid/usaldusseadmed; taastamistoken on ühekordne.
6. Paroolita konto ei saa e-posti muuta ega kontot kustutada ilma serveris kontrollitud taastamiseta.
7. `DELETE /api/profile` `202` ei avalda `deletionJobId`-d ning anonüümne kinnitusvaade ei vaja sessiooni ega kontoandmeid.
8. Aegunud tellimuse snapshot/UI erineb aktiivsest, tulevikus kehtivast ja tasuta seisust; T09 õigused ei muutu.
9. Admini eelvaateriba kasutab ainult olemasolevat serveritõde; mitte-admin ei eskaleeru.
10. Konto modaalide fookus, Escape, Tab-ringi ja fookuse taastamise leping; busy dialoog ei sulgu tahtmatult.
11. ET/EN/RU pariteet ja uute serverivastuste lokaliseeritus.

Käivita vähemalt konto-, auth-, taastamise-, kasutus- ja modaalide sihttestid; muudetud failide lint; `npm run i18n:check`; skeemi korral `npx prisma validate` + migratsiooniahela kontroll; `git diff --check`; production build. Täissviit ja sõltumatu audit jäävad T27-sse, kui neid eraldi ei nõuta.

## Sünteetiline runtime

Kasuta ainult lokaalset sünteetilist keskkonda. Ära muuda ega kustuta ühiseid püsivaid testkontosid. Kui e-posti vahetuse või konto kustutuse täisrada vajab eraldi ajutist testandmebaasi ja see on turvaliselt olemas, tee see seal ning tõesta cleanup; muul juhul märgi `NOT_RUN` või `NOT_PROVEN`.

Soovitud rada: õige/vale PIN → e-posti taotlus → vana e-posti säilimine → kinnituse järel sessiooni tühistus → PIN-i taastamine → aegunud token → `202 pending` anonüümne teade → modaal klaviatuuriga. Päris e-kirju ei saadeta.

## Definition of Done

1. E1–E6 on sama haru sees lõpuni teostatud.
2. PROF-P1 on stack'is, mitte eraldi unustatud haru.
3. E-posti muutus on verify-then-swap ning vead/võistlused on fail-closed.
4. PIN-i muutus ja taastamine tühistavad vanad sessioonid; teavitused ei leki saladusi.
5. Paroolita konto ei möödu step-up nõudest.
6. Kustutuse `202` rada on aus ega avalda töö id-d.
7. Aegunud tellimus ja aktiivne admini vaateroll on ausalt nähtavad ilma õiguste muutuseta.
8. Konto dialoogid töötavad klaviatuuri ja ekraanilugejaga ning keeled on pariteedis.
9. Worktree on puhas, kõik muutused commit'itud ja remote-harusse push'itud.
10. `main`, server, merge ja deploy jäävad puutumata.

## Lõpparuanne koordinaatorile

Esita worktree, haru, täpne baas-SHA, PROF-P1 cherry-pick SHA ning lõppcommit/remote SHA; migratsiooni nimi või kinnitus, et seda ei tehtud; E1–E6 lühikokkuvõte; testide/lindi/i18n/Prisma/diff-check/buildi tulemused; runtime ja cleanup või `NOT_RUN`/`NOT_PROVEN`; kõrvalekalded; ning kinnitus, et põhitööpuud, `main`-i, serverit, merge'i ega deploy'd ei muudetud.

Koordinaator kontrollib pärast aruannet ainult haru, parent'i, commit'i ja remote SHA-d. Ta ei korda automaatselt sinu teste, buildi ega runtime'i.
