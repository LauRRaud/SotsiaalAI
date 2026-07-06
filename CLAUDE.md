# CLAUDE.md

Juhised Claude Code'ile selle projekti kallal töötamisel.

## Dev-server (OLULINE)

- Ainuõige dev-käsk on **`npm run dev`** (port 3000, turbopack, `NODE_OPTIONS=--max-old-space-size=8192`).
  `dev` → `d` → `cross-env … next dev --turbopack -p 3000`. Ära kutsu `npm run d` otse.
- **Claude: serveri käivitamiseks kasuta ALATI `preview_start` tööriista config'iga `next-dev`** (`.claude/launch.json`),
  MITTE `Bash`/`PowerShell` `npm run dev`. `preview_start` taaskasutab juba töötavat serverit sama pordi peal
  ega spawni duplikaati.
- Ära käivita kunagi kahte dev-serverit korraga (nt `run dev` + `run d`) — tekivad pordikonfliktid ja pidevad restardid.
- Kontrolli enne käivitamist töötavaid servereid `preview_list`-iga.
