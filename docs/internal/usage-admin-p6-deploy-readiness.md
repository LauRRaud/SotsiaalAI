# Usage/admin P6 deploy-valmidus

## Automaatne kvaliteedivärav

Workflow `.github/workflows/quality-gate.yml` käivitub igal pull request'il ja
`main` haru muudatusel. Üks ebaõnnestunud samm peatab ülejäänud tarnevoo.

Kontrollid:

1. lukustatud sõltuvuste paigaldus `npm ci`;
2. Prisma skeemi valideerimine ja kliendi genereerimine;
3. kogu migratsiooniahela rakendamine tühjale PostgreSQL 16 andmebaasile;
4. `prisma migrate status`;
5. kogu testikomplekt;
6. lint ja ET/EN/RU tõlkepariteet;
7. production build;
8. production serveri smoke: hinnastus kuvab tasuta paketti ning kasutaja- ja
   admini kasutus-API-d ei ole autentimata ligipääsetavad.

CI kasutab ainult lokaalseid fiktiivseid võtmeid. Smoke ei kutsu OpenAI, RAG-i,
makseteenust ega e-posti teenust.

## GitHubi branch protection

YAML ei saa takistada otse `main` harusse push'imist enne push'i vastuvõtmist.
Repo seadetes tuleb `main` harule lubada järgmised reeglid:

- Require a pull request before merging.
- Require status checks to pass before merging: `quality-gate`.
- Require branches to be up to date before merging.
- Require conversation resolution before merging.
- Do not allow bypassing the above settings.
- Block force pushes and branch deletion.

Kuni branch protection pole GitHubis sisse lülitatud, on P6 tehnilised
kontrollid olemas, kuid otse `main` push'i serveripoolne blokeerimine pole
veel tõendatud.

## Deploy-järgne käsitsi kontroll

Pärast heakskiidetud merge'i ja deploy'd:

1. kontrolli `/hinnastus`, tasuta paketti ja pakettide tegelikke limiiditekste;
2. kontrolli adminina paketi muutmist, kasutaja erandit ja auditikirjet;
3. kontrolli testkasutajaga hard limit'i 429 vastust;
4. kontrolli testdokumendi kustutamisel faili- ja RAG-kustutust;
5. kontrolli testkonto kustutamisel `USER_DELETE` töö lõppstaatust ja jääkide
   puudumist;
6. kontrolli AI-kulude katvuse märgistust päris telemeetria peal.

Production deploy'd ega andmeid muutvaid live-smoke'e CI automaatselt ei tee.
