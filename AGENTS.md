# AGENTS.md

Juhised igale agendile, kes selle projekti kallal koodi kirjutab (Claude Code, Codex, muu).
`CLAUDE.md` viitab siia ja lisab ainult Claude'i-spetsiifilise osa — **reeglid on siin, ühes
kohas.**

## Kust seis tuleb (LOE ESIMESENA)

**`docs/platvormi arendus/SotsiaalAI.md` on projekti ainus elav fail.** Enne tööd loe sealt
**S1.0 „Aktiivne tööots", S11 ja ainult ülesandega seotud teemasektsioon**. Kogu S1 ega kogu
faili ei loeta iga ploki alguses uuesti. SOL-paranduses loe lisaks täpne leid/leiud raportist;
S4 ainult siis, kui töö vajab uut tööriista või tooteotsust, ning osa II ainult siis, kui küsimus
puudutab tootesuunda.

- **osa I (S0–S11)** = seis ja töö: S1 alus ja järgmine samm · S2–S3, S5–S10 valdkonnad
  (tehtud / poolik) · **S4 kogu lahtine töö** · S11 töökord
- **osa II (1–7)** = olemus ja suund: kolm EI-d, horisondid, strateegiad, riskid

Olekut kannab AINULT see fail; konkureerivat seisu- või handoff-faili ei looda.

`SEIS.md` on 719-baidine viit vanadele juhistele. `ideed.md` on kontseptsioonid ja taust,
olekut ei kanna. Vana kroonika on gitis: `git show db514ba0:"docs/platvormi arendus/SEIS.md"`.

**Ära usu seisu mälu järgi — mõõda.** Serveri ja `origin/main`-i seis loetakse käsuga, mitte
dokumendist. Seda reeglit on siin rikutud ja ta on maksnud vale väite omanikule.

## Kiire plokipõhine tööring

Auditiparandusi on palju; vaikimisi tööühik on **sidus PLOKK**, mitte üks leid ega terve
peatükk. Plokk on tavaliselt 2–8 leidu, millel on sama teenus, andmemudel, helper või runtime-rada.
Üks suur leid võib olla omaette plokk ainult siis, kui ta katab ise mitu kihti (nt teenus + API +
UI + eksport). Seoseta leide ühte plokki ei panda.

1. **Kaart enne koodi, maksimaalselt üks lühike ring:** vastuvõtukriteerium → puudutatud failid
   → sihttest → kas päris DB/brauser on nõutud. Ära tee laia repo- ega dokumendiekskursiooni.
2. **Negatiivtõend kõigepealt.** Käitumisklassi kohta üks kandev punane kontroll; sama shared
   helperi täpsetele koopiatele ei tehta rituaalselt sama kontrolli uuesti.
3. **Arenduse ajal ainult sihttestid.** Käivita muutuvate failide testid; ära jooksuta täissviiti
   iga leiu ega väikese patch'i järel.
4. **Tõendid koonda ploki lõppu.** Sama ploki DB-invariandid katab võimalusel üks sond ja UI-rada
   üks runtime-läbisõit.
5. **Ploki kontroll on väike; täisvärav on peatüki kontroll.** Uuenda ploki Seis-lõigud,
   genereeri koond ja uuenda S1.0. Ploki järel jooksuta sihttestid, nõutud sond, muudetud
   koodifailide lint ja `git diff --check`. Kogu `TZ=UTC npm test` käib peatüki lõpus, mitte iga
   ploki järel. Kui pärast täissviiti muutusid ainult raport, genereeritud plokk ja S1, jooksuta
   ainult `solAuditTally.test.js`, mitte kogu sviiti uuesti.

Read-only kaardistused ja sõltumatud lõpuväravad võib käivitada paralleelselt. Sama tööpuu
failide muutmist paralleelsetele kirjutajatele ei jagata. Paralleelseks SOL-paranduseks on kolm
püsivat tööpuud: `SotsiaalAI-repair-a`, `SotsiaalAI-repair-b` ja `SotsiaalAI-repair-c`.
Ühel tööpuul on korraga üks kirjutaja ja üks nimeliselt määratud sidus teema; kattuvaid
skeemi-, migratsiooni-, shared-helperi, privaatsus- ega auditiraporti faile ei jagata kahe
tööpuu vahel.

## Git

- **`main` on integratsioonipuu.** Parandustöö käib kolmes püsivas harus/tööpuus:
  `codex/repair-a` → `C:\Users\rauds\Desktop\SotsiaalAI-repair-a`,
  `codex/repair-b` → `C:\Users\rauds\Desktop\SotsiaalAI-repair-b` ja
  `codex/repair-c` → `C:\Users\rauds\Desktop\SotsiaalAI-repair-c`.
- Enne uue teema määramist peab tööpuu olema puhas ja tema haru integreeritud `main`-iga
  samal lähte-SHA-l. Ühele tööpuule määratakse korraga üks sidus, failipiiridega teema.
- Valmis haru integreerib üks kirjutaja: kõigepealt värske `main`, siis konfliktikontroll,
  vajadusel puhta parandusharu rebase ning `main`-i fast-forward. Pärast integratsiooni
  sünkroonitakse vabanenud parandusharu uuesti `main`-iga enne järgmist teemat.
- Auditiraportite Seis-lõigud, genereeritud `parandusaudit.md` ja S1.0 on integratsioonifailid:
  parandusharu võib tuua täpse raportimuudatuse, kuid lõpliku koondi ja ristkonfliktid lahendab
  integraator `main`-is. Ametlik DONE tekib alles integreeritud ja kontrollitud `main`-is.
- **`git add -A` ja `git add .` on KEELATUD.** Samas tööpuus võib olla teise sessiooni
  pooleliolev töö — 03.08 läks võõra sessiooni RAG-töö nii ühte commit'i ja sealt toodangusse.
  Stage'i failid **nimeliselt**.
- **Push, merge ja deploy ainult omaniku selgel loal.**
- Commit'i sõnum ütleb, MIS oli katki ja MIKS parandus selline on — mitte ainult mida muudeti.

## Väike värav ploki järel, täisvärav peatüki lõpus

**Iga sidusa ploki järel:**

```
node --import ./scripts/register-node-test-loader.mjs --test <sihttestid>
<nõutud päris DB/runtime sond>
npx eslint <muudetud koodifailid>
git diff --check
npm run i18n:check            # ainult kui sõnumikataloog või tõlkevõtmed muutusid
npm run db:migrate:check      # kohe, kui prisma/schema.prisma muutus
```

**Peatüki lõpus ning alati enne push'i või deploy'd:**

```
TZ=UTC npm test
npm run i18n:check
npx eslint <muudetud failid>
npm run db:migrate:check     # ainult kui prisma/schema.prisma muutus
```

Täisvärav käib **üks kord peatüki lõpliku muutumatu koodipuu kohta**. Sama puu peal juba
rohelist täissviiti ei korrata commit'i mehaanilise jagamise, raporti Seis-lõigu, genereeritud
koondi ega S1 uuenduse pärast. Kohaliku vahecommit'i võib teha väikese värava järel; commit'i
üleandmises märgi siis ausalt `full gate: pending chapter close`. Push'i ega deploy'd enne
täisväravat ei tehta.

**Varasem lai kontroll on erand, mitte vaikimisi:** skeem/migratsioon, autentimine või
autoriseerimine, maksed, privaatsus/säilitus, võistlus või mitut peatükki puudutav shared helper.
Ka siis jooksuta kõigepealt asjakohane lai testslice/sond; kogu globaalne sviit ainult siis, kui
muudatuse löögiala ei ole usaldusväärselt kitsendatav.

`TZ=UTC` ei ole kosmeetika: arendusmasin on Europe/Tallinn, server UTC — kuupäevaviga on
lokaalselt NÄHTAMATU ja läheb rohelisena toodangusse.

## Tõendamine

**Enne commit'i vasta ühele küsimusele: kas see test oleks vana koodi peal LÄBI läinud?**

Kui vastus ei ole pilguga selge — võistlus, võõrvõti või muu andmebaasi tasandi käitumine,
neelatud viga, järjekord, ajastus — siis **mõõda see ära**: jooksuta sama test vana käitumise
vastu ja nõua, et ta kukuks. Kirjuta tulemus commit'i.

Otsusta sondi vajadus vastuvõtukriteeriumist **enne** esimese täissviidi käivitamist. Üks sond
võib tõendada sama ploki mitut leidu, kui ta süstib ja mõõdab iga invariandi eraldi.

Puhta ümbernimetamise, koodi kokkutõstmise või tõlkevõtme juures seda ei nõuta — seal ei ole
vana käitumist, mille vastu jooksutada, ja väljamõeldud negatiivkontroll on rituaal.

Sama küsimus käib **fikstuuri** kohta: kui muudad testi andmeid, kontrolli, et test mõõdab ikka
oma asja. Fikstuur võib vaikselt kaotada mõõdetava omaduse, kui mõni piirmäär tema alt liigub.

**`npm test` ei kasuta elavat andmebaasi (fake-prisma) ja fake EI tõenda:** referentsiaalset
käitumist (`ON DELETE`), unikaalsuspiiranguid, võistlusi, tehingu rollback'i ega ligipääsupiiri.
Kui leid on üks neist, kirjuta **sond päris PostgreSQL-i vastu**. Muster on olemas:
`scripts/*-probe.mjs` (nt `payment-archive-probe.mjs`) — ajutine andmebaas + `prisma migrate
deploy` + negatiivkontroll samas harnessis. Registreeri ta `package.json`-i.

## Dev-server

Ainuõige dev-käsk on **`npm run dev`** (port 3000, turbopack,
`NODE_OPTIONS=--max-old-space-size=8192`). `dev` → `d` → `cross-env … next dev --turbopack
-p 3000`. Ära kutsu `npm run d` otse.

Next lukustab KAUSTA, mitte pordi: kui server juba töötab, ava brauser tema pordile, ära tapa
võõrast protsessi.

## SOL-süvaaudit

Leiu seisu kannab **raport ise** (`docs/audits/sotsiaalai-sol-suvaaudit.md` ja
`…-jatk-*.md`), Seis-lõik iga leiu all. Tehtuks loetakse AINULT leid, mille Seis-lõik **algab
sõnaga `DONE`** — kvalifitseeritud seis („kood DONE, brauseritest NOT_PROVEN") on lahtine.

`docs/audits/parandusaudit.md` on **tuletatud** ülevaade. Tema peatükk „Paranduste seis:
DONE / PARTIAL / NOT_DONE" on genereeritud; käsi sinna ei lähe.

**Ploki lõpetamisel, kolm sammu ja kõik kolm on kohustuslikud:**

1. uuenda kõigi lõpetatud leidude Seis-lõigud raportis;
2. jooksuta ploki kohta **üks kord** `npm run sol:progress -- --write` (uuendab genereeritud
   DONE / PARTIAL / NOT_DONE ploki; vana `npm run sol:tally -- --write` jääb tagasiühilduvaks; tegemata jätmine
   viib `tests/scripts/solAuditTally.test.js` punaseks — see on tahtlik);
3. uuenda S1.0 tööotsa ja vajadusel teemaseisundit. Koond on maksimaalselt üks lühike lõik:
   mis muutus inimese jaoks + järgmine plokk. Testi-, sondi- ja failidetail jääb raporti
   Seis-lõiku ning commit'i, mitte S1 teostuslooks.

Kolmeastmelised numbrid tulevad `npm run sol:progress` väljundist; ametliku DONE/lahtise vaate
annab endiselt `npm run sol:tally`. Käsitsi neid kuhugi ei kirjutata.

## Kui leid on blokitud

Kui parandus eeldab tooteotsust või õiguslikku hinnangut, **ära kirjuta koodi ümber ega otsusta
omaniku eest.** Ütle, MIS otsust vaja on, ja tee valmis kõik, mis sellest otsusest ei sõltu.
