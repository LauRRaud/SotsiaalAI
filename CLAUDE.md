# CLAUDE.md

Ühised reeglid on [AGENTS.md](AGENTS.md)-s. Siin on ainult Claude Code'i tööriistade erisused.

## Dev-serveri käivitamine

`AGENTS.md` ütleb, et ainuõige käsk on `npm run dev`. Claude Code'is käivitatakse ta aga
**`preview_start` tööriistaga**, config `next-dev` (`.claude/launch.json`) — MITTE `Bash`/
`PowerShell` kaudu. `preview_start` taaskasutab juba töötavat serverit sama pordi peal ega
spawni duplikaati.

## Brauserikontroll

Kui muudatus on brauseris nähtav, verifitseeri ta brauseripaani tööriistadega (`read_page`,
`javascript_tool`, `read_console_messages`) ja näita omanikule tõend. Screenshot **hangub
SotsiaalAI lehtedel** — mõõda `getComputedStyle`-iga või Playwrightiga.
