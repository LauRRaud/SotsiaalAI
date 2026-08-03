# CLAUDE.md

Juhised Claude Code'ile selle projekti kallal töötamisel.

## Kust seis tuleb (LOE ESIMESENA)

**`docs/platvormi arendus/SotsiaalAI.md` on projekti ainus elav fail.** Loe see enne tööd —
kasutaja ei pea seda eraldi paluma.

- **osa I (S0–S11)** = seis ja töö: S1 alus ja järgmine samm · S2–S3, S5–S10 valdkonnad
  (tehtud / poolik) · **S4 kogu lahtine töö** · S11 töökord
- **osa II (1–7)** = olemus ja suund: kolm EI-d, horisondid, strateegiad, riskid

Reeglid, mis kehtivad ka siis, kui neid üle ei korrata: olekut kannab AINULT see fail ·
konkureerivat seisu- või handoff-faili ei looda · **töö käib otse `main`-is**, harusid ega
worktree-kaustu ei tehta · merge ja deploy ainult omaniku selgel loal.

`SEIS.md` on 719-baidine viit vanadele juhistele. `ideed.md` on kontseptsioonid ja taust,
olekut ei kanna. Vana kroonika on gitis: `git show db514ba0:"docs/platvormi arendus/SEIS.md"`.

## Dev-server (OLULINE)

- Ainuõige dev-käsk on **`npm run dev`** (port 3000, turbopack, `NODE_OPTIONS=--max-old-space-size=8192`).
  `dev` → `d` → `cross-env … next dev --turbopack -p 3000`. Ära kutsu `npm run d` otse.
- **Claude: serveri käivitamiseks kasuta ALATI `preview_start` tööriista config'iga `next-dev`** (`.claude/launch.json`),
  MITTE `Bash`/`PowerShell` `npm run dev`. `preview_start` taaskasutab juba töötavat serverit sama pordi peal
  ega spawni duplikaati.

