# SotsiaalAI sünteetilised arenduskontod

STATUS: LOCAL ACTIVE

Kuupäev: 2026-07-17

## Eesmärk

Need kontod on püsiv lokaalne testidentiteetide komplekt autentitud arendus- ja runtime-kontrollide jaoks. Kontodel ja nende loodud andmetel ei ole seost päris kasutajate ega tootmisandmetega.

Kontosid ei looda iga ülesande jaoks uuesti. Sol, Terra ja Codex kasutavad neid ainult siis, kui ülesanne vajab autentitud lokaalset runtime-kontrolli. Fable'i dokumentatsiooni- ja analüüsitööd neid vaikimisi ei vaja.

## Kontod

| Nimi | E-post | Repo roll | Kasutus |
|---|---|---|---|
| AI Admin | `ai.admin@sotsiaalai.test` | `ADMIN` + `isAdmin=true` | admini operatiiv- ja rollivaadete kontroll; mitte tavakasutaja voo asendus |
| AI Spetsialist A | `ai.specialist.a@sotsiaalai.test` | `SOCIAL_WORKER` | spetsialisti põhitöö, omanik ja kutsete algataja |
| AI Spetsialist B | `ai.specialist.b@sotsiaalai.test` | `SOCIAL_WORKER` | teine osaleja, koostöö, kutse, võõra kasutaja ja õiguse eemaldamise kontroll |
| AI Klient | `ai.client@sotsiaalai.test` | `CLIENT` | kliendi vaade ja rollipiirid |
| AI Teenuseosutaja | `ai.service-provider@sotsiaalai.test` | `SERVICE_PROVIDER` | teenuseosutaja töövood ja adressaadi roll |

Kõigil mitte-admin kontodel on lokaalne sünteetiline aktiivne tellimus, mis ei ole seotud maksepakkuja ega päris maksega. Kõigil kontodel on e-posti saatmise eelistus välja lülitatud.

## Ligipääs

E-postid võib lisada arendusülesande runtime-osasse. PIN-koode ei kopeerita ülesannetesse, lõpparuannetesse, commit'idesse ega vestlusse.

Lokaalsed PIN-id asuvad Gitist ignoreeritud failis:

`.env.ai-test.local`

Agent loeb selle faili ainult siis, kui autentitud runtime on ülesande skoobis. Faili sisu ei väljastata tööriistalogisse ega lõpparuandesse.

## Taastamine ja kontroll

Kontode loomine või algseisu taastamine:

`node scripts/tmp-create-ai-test-users.mjs --apply`

Olemasolu ja rollide kontroll ilma muutmiseta:

`node scripts/tmp-create-ai-test-users.mjs --check`

Kõigi viie sünteetilise konto ning nende kaskaadse testandmestiku eemaldamine:

`node scripts/tmp-create-ai-test-users.mjs --delete`

Skript keeldub töötamast, kui `DATABASE_URL` host ei ole `localhost`, `127.0.0.1` või `::1`, või kui `NODE_ENV=production`.

## Ülesannetesse lisatav lühiviide

Kui runtime vajab autentitud rolle, lisa ülesandesse ainult:

> Kasuta olemasolevaid sünteetilisi lokaalseid testkontosid failist `docs/platvormi arendus/tehis-testkontod.md`. Ligipääs on `.env.ai-test.local`; PIN-e ei väljastata. Ära loo uusi kontosid, ära kasuta tootmisandmeid ning kustuta ainult ülesandes loodud sünteetiline sisu, mitte ühiseid testkontosid.

Viidet ei ole vaja lisada puhtale dokumentatsiooni-, analüüsi- või staatilise koodi ülesandele.

## Piirid

- Need ei ole tootmiskontod ega anna AI-le tootmispääsu.
- Admin-kontot kasutatakse ainult admini funktsioonide kontrolliks.
- Admini rollivahetaja ei asenda eri kasutaja-ID-dega kontosid omandi, kutsete ega IDOR-piiride kontrollimisel.
- Päris e-posti, maksepakkujat, tootmisandmeid ja päris organisatsiooni ei kasutata.
- Kontode paroolifaile ei commit'ita ega push'ita.
