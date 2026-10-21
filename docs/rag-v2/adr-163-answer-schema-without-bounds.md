# ADR-163 — Vastuse ja dialoogiseisu skeem ilma pikkuspiirideta (proovitud, tagasi võetud)

21.10.2026. Teostus Claude Opus 5.5. Jätk [ADR-162](adr-162-plan-schema-without-bounds.md)-le. Kui plaani skeemist
pikkuspiirid välja võeti, kirjutas plaan sama sisu kaks kuni kolm korda kiiremini (6,5–11,8 s asemel 3,0–4,5 s).

## Leid

Vastusekutse skeemis on samasugused piirid:
- vastuse plokis `maxLength` 6000, `minLength` 1 ja muster `\S`;
- piirangus ja küsimuses `maxLength` 2000, `minLength` 1 ja muster `\S`;
- dialoogiseisus (v5, umbes 200 tokenit vastuse järel):
  - teema 64, isik 40, tsitaat 240, vajadus 120, küsimus 160;
  - pöörde number 1–30.

Vastusekutse võtab 9–31 s.

## Otsus

- **`ANSWER_SCHEMA`:** tekstidel ei ole pikkus- ega mustripiire. Server kontrollib neid ise:
  - `repairAnswer` (ADR-160) lõikab liiga pika teksti ja jätab tühja välja;
  - `validateAnswer` kontrollib tulemust nagu enne.
- **Dialoogiseisu skeem (`FACT_STATE_SCHEMA`):** stringidel ja pöörde numbril ei ole piire.
  - `mergeFactState` lõikab mudeli stringid samast kohast, kus skeem need lõikas, ja hoiab pöörde numbri vahemikus
    1–30 (`boundedDraft`). Seega loevad kontrollid sama, mida enne.
  - ID-de mustrid (`F1`, `N2`) jäävad: need on lühikesed ja struktuursed.
- Massiivide `minItems`/`maxItems` ja enum'id jäävad.
- Juhise versioone ei muudetud, sest juhise tekst ei muutunud. Skeemi räsi (`dialogueStateSchemaHash`) uueneb plaani
  uuendamisel ja päringu keha on pöörde auditis tervikuna.

## Kontroll

- Kohalikult:
  - skeemis on alles ainult ID-mustrid;
  - pikk teema, tsitaat, vajadus ja küsimus lõigatakse piirini ning fakt jääb alles;
  - pöörde number 99 viiakse 1 peale;
  - ADR-160 parandused ei muutunud;
  - `npm test`: 70 läbis.
- Serveris: samad kuus küsimust. Võrreldakse vastusekutse aega, vastuse kuju (liik, plokid, viited, parandused) ja
  dialoogiseisu (faktid, välja jäetud kirjed). Kui vastus ei kiirene, võetakse muudatus tagasi.

## Tulemus serveris (90d802d8, 21.10.2026): võetud tagasi

Samad kuus küsimust:

| | Enne (11 pööret) | Pärast (6 pööret) |
|---|---:|---:|
| vastuse kiirus | 48–133 tokenit/s, mediaan umbes 106 | 64–136 tokenit/s, mediaan umbes 111 |
| vastuseid viitemärkidega tekstis | 0 / 12 (alates ADR-160-st) | 2 / 6 (6 plokki) |

- Kiiruse vahet ei ole. Plaani puhul oli vahe selge ja püsiv (ADR-162), vastuse puhul mitte. Vastuse kiirus sõltub
  teenusepakkuja koormusest.
- Ilma tekstimustrita kirjutas mudel nähtavasse teksti rohkem viitemärke. Parandus võttis need välja (ADR-160), aga
  see on kvaliteedirisk ilma võiduta.
- Muudatus on tagasi võetud: vastuse ja dialoogiseisu skeem on jälle piiridega nagu enne.
