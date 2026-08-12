# CLAUDE.md

**Reeglid on [`AGENTS.md`](AGENTS.md)-s — loe ta läbi enne tööd.** Seal on seisufail, gitireeglid
(`git add -A` on keelatud), väravad enne commit'i, tõendamise nõue, dev-server ja SOL-auditi
töökord. Neid siin ei korrata: kaks koopiat lahknevad, ja just see veaklass on selles projektis
maksnud kõige rohkem.

Siin failis on ainult see, mis kehtib **Claude Code'i kohta ja mitte teiste agentide kohta**.

## Dev-serveri käivitamine

`AGENTS.md` ütleb, et ainuõige käsk on `npm run dev`. Claude Code'is käivitatakse ta aga
**`preview_start` tööriistaga**, config `next-dev` (`.claude/launch.json`) — MITTE `Bash`/
`PowerShell` kaudu. `preview_start` taaskasutab juba töötavat serverit sama pordi peal ega
spawni duplikaati.

## Brauserikontroll

Kui muudatus on brauseris nähtav, verifitseeri ta brauseripaani tööriistadega (`read_page`,
`javascript_tool`, `read_console_messages`) ja näita omanikule tõend. Screenshot **hangub
SotsiaalAI lehtedel** — mõõda `getComputedStyle`-iga või Playwrightiga.
