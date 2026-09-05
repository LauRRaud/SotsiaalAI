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
   → vajalik staatiline kontroll → kas käsitsi DB/brauseri kontroll on nõutud. Ära tee laia repo-
   ega dokumendiekskursiooni.
2. **Teste loo ja käivita ainult arenduseks vajalikus ulatuses.** Iga test peab tõendama praeguse
   muudatuse konkreetset riski või regressiooni. Eelista olemasolevat või väikest sihttesti; laia
   testisviiti, smoke-/E2E-rada ega korduvaid proove ei lisata ega käivitata, kui kitsam kontroll
   annab vajaliku tõendi. Administraatori käsitsi käivitatav RAG-i enesetest on platvormi
   operatiivne tervisekontroll ja peab admini RAG-lehel alles jääma.
3. **Arenduse ajal kasuta väikseid staatilisi kontrolle.** Lint, teksti/tõlgete kontroll ja
   Prisma skeemi valideerimine käivad ainult siis, kui muudatus nende pinda puudutab.
4. **Tõendid koonda ploki lõppu.** Kui vastuvõtukriteerium nõuab päris UI- või teenuserada,
   kontrolli seda käsitsi olemasolevas keskkonnas; uut automatiseeritud sondi selleks ei kirjutata.
5. **Ploki kontroll on väike; peatüki lõpus lisandub build.** Uuenda ploki Seis-lõigud,
   genereeri koond ja uuenda S1.0. Ploki järel käivita asjakohased staatilised kontrollid ning
   `git diff --check`; peatüki lõpus ja enne push'i/deploy'd ka tootmisbuild.

Read-only kaardistused ja sõltumatud lõpuväravad võib käivitada paralleelselt. Sama tööpuu
failide muutmist paralleelsetele kirjutajatele ei jagata. Vaikimisi töö toimub põhikausta
`main`-harus ühe kirjutajaga. Eraldi parandustööpuid kasutatakse ainult eraldi kokkuleppel;
kattuvaid skeemi-, migratsiooni-, shared-helperi, privaatsus- ega auditiraporti faile ei
jagata kahe kirjutaja vahel.

## Git

- **Töö toimub vaikimisi otse põhikausta `main`-harus**
  (`C:\Users\rauds\Desktop\SotsiaalAI`). Omaniku juhis 05.09.2026: kogu töö võib teha
  `main`-is, et vältida hilisemat keerulist integreerimist. Eraldi parandusharu pole nõutud.
- Enne teemat kontrolli `git status` ja piira puudutatavad failid. Omaniku või teise
  sessiooni pooleliolev töö säilib; kogu tööpuu puhtust ei saavutata võõraid faile muutes.
- Kui eraldi kokkuleppel kasutatakse parandusharu, kontrolli enne integreerimist värsket
  `main`-i ja failikonflikte; eelista sobiva ajaloo korral fast-forward'i.
- Auditiraportite Seis-lõigud, genereeritud `parandusaudit.md` ja S1.0 uuendab sama
  kirjutaja `main`-is. Ametlik DONE eeldab kontrollitud tulemust `main`-is.
- **`git add -A` ja `git add .` on KEELATUD.** Samas tööpuus võib olla teise sessiooni
  pooleliolev töö — 03.08 läks võõra sessiooni RAG-töö nii ühte commit'i ja sealt toodangusse.
  Stage'i failid **nimeliselt**.
- **Push, merge ja deploy ainult omaniku selgel loal.**
- Commit'i sõnum ütleb, MIS oli katki ja MIKS parandus selline on — mitte ainult mida muudeti.

## Väike värav ploki järel, build peatüki lõpus

**Iga sidusa ploki järel:**

Kui muudatus vajab käitumise või regressiooni tõendamiseks sihttesti, käivita ainult see test või
kõige väiksem asjakohane testikomplekt. Dokumentatsiooni- ja muu mittekoodimuudatuse korral testi
ei käivitata pelgalt formaalsuse pärast.

```
npx eslint <muudetud koodifailid>
git diff --check
npm run i18n:check            # ainult kui sõnumikataloog või tõlkevõtmed muutusid
npx prisma validate          # ainult kui Prisma skeem või migratsioonid muutusid
```

**Peatüki lõpus ning alati enne push'i või deploy'd:**

```
npm run i18n:check
npx eslint <muudetud failid>
npx prisma validate         # ainult kui Prisma skeem või migratsioonid muutusid
npm run build
```

Peatükilõpu värav käib **üks kord lõpliku muutumatu koodipuu kohta**. Sama puu peal juba rohelist
build'i ei korrata commit'i mehaanilise jagamise, raporti Seis-lõigu, genereeritud koondi ega S1
uuenduse pärast. Kohaliku vahecommit'i võib teha väikese värava järel; üleandmises märgi siis
ausalt `build: pending chapter close`. Push'i ega deploy'd enne peatükilõpu väravat ei tehta.

**Kõrgema riskiga muudatus vajab proportsionaalset tõendamist.** Skeemi/migratsiooni,
autentimise, autoriseerimise, maksete, privaatsuse/säilituse või võistluse muutuse korral lisa või
käivita vajalik sihttest ning koosta selge käsitsi kontrolliplaan nendele omadustele, mida test ei
tõenda. Kui päris keskkonda ei kontrollitud, märgi runtime ausalt `not_run` või `NOT_PROVEN`;
test, lint, build ja skeemi valideerimine ei tõenda iseenesest päris keskkonna käitumist.

`TZ=UTC` ei ole kosmeetika: arendusmasin on Europe/Tallinn, server UTC — kuupäevaviga on
lokaalselt NÄHTAMATU ja läheb rohelisena toodangusse.

## Tõendamine

Staatilised kontrollid tõendavad ainult oma kitsast pinda: lint koodikuju, `i18n:check`
sõnumikataloogide kooskõla, `prisma validate` skeemi kuju ja build kompileerumise.
Sihitud test tõendab ainult testitud lepingut ja juhtumeid. Teste, probe'e, smoke- või E2E-kontrolle
luuakse ja käivitatakse ainult siis, kui need on konkreetse arendusmuudatuse riski tõendamiseks
vajalikud; vaikimisi eelista väikseimat piisavat kontrolli. Need ei tõenda automaatselt
referentsiaalset käitumist, võistlusi, tehingu rollback'i, ligipääsupiire ega päris
kasutajaliidest. Sellise nõude puhul kirjelda käsitsi kontrollitud rada ja tulemus; kontrollimata
osa jääb `NOT_PROVEN`. Admini RAG-i enesetest on kasutaja käivitatav tootefunktsioon, mitte
arendussviit.

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
   DONE / PARTIAL / NOT_DONE ploki; vana `npm run sol:tally -- --write` jääb tagasiühilduvaks);
3. uuenda S1.0 tööotsa ja vajadusel teemaseisundit. Koond on maksimaalselt üks lühike lõik:
   mis muutus inimese jaoks + järgmine plokk. Kontrolli- ja failidetail jääb raporti Seis-lõiku
   ning commit'i, mitte S1 teostuslooks.

Kolmeastmelised numbrid tulevad `npm run sol:progress` väljundist; ametliku DONE/lahtise vaate
annab endiselt `npm run sol:tally`. Käsitsi neid kuhugi ei kirjutata.

## Kui leid on blokitud

Kui parandus eeldab tooteotsust või õiguslikku hinnangut, **ära kirjuta koodi ümber ega otsusta
omaniku eest.** Ütle, MIS otsust vaja on, ja tee valmis kõik, mis sellest otsusest ei sõltu.
