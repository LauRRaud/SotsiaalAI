# AGENTS.md

Juhised igale agendile, kes selle projekti kallal koodi kirjutab (Claude Code, Codex, muu).
`CLAUDE.md` viitab siia ja lisab ainult Claude'i-spetsiifilise osa — **reeglid on siin, ühes
kohas.**

## Kust seis tuleb (LOE ESIMESENA)

**`docs/platvormi arendus/SotsiaalAI.md` on projekti ainus elav fail.** Loe see enne tööd —
kasutaja ei pea seda eraldi paluma.

- **osa I (S0–S11)** = seis ja töö: S1 alus ja järgmine samm · S2–S3, S5–S10 valdkonnad
  (tehtud / poolik) · **S4 kogu lahtine töö** · S11 töökord
- **osa II (1–7)** = olemus ja suund: kolm EI-d, horisondid, strateegiad, riskid

Olekut kannab AINULT see fail; konkureerivat seisu- või handoff-faili ei looda.

`SEIS.md` on 719-baidine viit vanadele juhistele. `ideed.md` on kontseptsioonid ja taust,
olekut ei kanna. Vana kroonika on gitis: `git show db514ba0:"docs/platvormi arendus/SEIS.md"`.

**Ära usu seisu mälu järgi — mõõda.** Serveri ja `origin/main`-i seis loetakse käsuga, mitte
dokumendist. Seda reeglit on siin rikutud ja ta on maksnud vale väite omanikule.

## Git

- **Töö käib otse `main`-is.** Harusid ega worktree-kaustu ei tehta.
- **`git add -A` ja `git add .` on KEELATUD.** Samas tööpuus võib olla teise sessiooni
  pooleliolev töö — 03.08 läks võõra sessiooni RAG-töö nii ühte commit'i ja sealt toodangusse.
  Stage'i failid **nimeliselt**.
- **Push, merge ja deploy ainult omaniku selgel loal.**
- Commit'i sõnum ütleb, MIS oli katki ja MIKS parandus selline on — mitte ainult mida muudeti.

## Väravad enne igat commit'i

```
TZ=UTC npm test
npm run i18n:check
npx eslint <muudetud failid>
npm run db:migrate:check     # ainult kui prisma/schema.prisma muutus
```

`TZ=UTC` ei ole kosmeetika: arendusmasin on Europe/Tallinn, server UTC — kuupäevaviga on
lokaalselt NÄHTAMATU ja läheb rohelisena toodangusse.

## Tõendamine

**Enne commit'i vasta ühele küsimusele: kas see test oleks vana koodi peal LÄBI läinud?**

Kui vastus ei ole pilguga selge — võistlus, võõrvõti või muu andmebaasi tasandi käitumine,
neelatud viga, järjekord, ajastus — siis **mõõda see ära**: jooksuta sama test vana käitumise
vastu ja nõua, et ta kukuks. Kirjuta tulemus commit'i.

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

`docs/audits/parandusaudit.md` on **tuletatud** ülevaade. Tema peatükk „Mis on tehtud" on
genereeritud; käsi sinna ei lähe.

**Leiu lõpetamisel, kolm sammu ja kõik kolm on kohustuslikud:**

1. uuenda leiu Seis-lõik raportis;
2. jooksuta **`npm run sol:tally -- --write`** (uuendab genereeritud ploki; tegemata jätmine
   viib `tests/scripts/solAuditTally.test.js` punaseks — see on tahtlik);
3. uuenda S1 `SotsiaalAI.md`-s.

Numbrid tulevad `npm run sol:tally` väljundist. Käsitsi neid kuhugi ei kirjutata.

## Kui leid on blokitud

Kui parandus eeldab tooteotsust või õiguslikku hinnangut, **ära kirjuta koodi ümber ega otsusta
omaniku eest.** Ütle, MIS otsust vaja on, ja tee valmis kõik, mis sellest otsusest ei sõltu.
