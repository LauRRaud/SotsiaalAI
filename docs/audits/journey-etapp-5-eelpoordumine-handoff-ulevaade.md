# Journey MVP Etapp 5 ülevaade — Teekond → eelpöördumine handoff

## 1. Ulatus

Etapp 5 lisas salvestatud Teekonna detailvaatesse kerge handoff'i olemasolevasse eelpöördumise töövoogu. Eesmärk oli koostada teekonna põhjal eeltäidetud eelpöördumise mustand ilma uut eelpöördumise mudelit, uut intake'i või PreInquiry staatuste ümbertegemist lisamata.

## 2. Olemasolev eelpöördumise töövoog

Koodibaasis on kasutaja eelpöördumise vaade route'il `/eelpoordumised`, mida renderdab `app/eelpoordumised/page.jsx` läbi `components/workspace/WorkspaceFeaturePage.jsx` komponendi ja `feature="pre_inquiries"` võtme.

Olemasolevad API route'id:

| Route | Roll |
|---|---|
| `/api/pre-inquiries` | eelpöördumiste lugemine ja loomine |
| `/api/pre-inquiries/[id]` | olemasoleva eelpöördumise uuendamine |
| `/api/pre-inquiries/[id]/send` | saatmisega seotud olemasolev töövoog |
| `/api/pre-inquiries/assist` | eelpöördumise assistendi tugi |
| `/api/pre-inquiries/preferences` | vastuvõtu eelistused |

Olemasolev vorm võimaldab kasutajal teemat, olukorra kirjeldust, piirkonda, adressaadi tüüpi ja pöördumise mustandit enne salvestamist või saatmist muuta.

## 3. Lisatud handoff

Lisati Teekonna detailvaatesse tegevus `Koosta eelpöördumine`.

Tegevus avab:

`/eelpoordumised?fromJourney=<journeyId>&workspaceRole=CLIENT`

Admini testkasutaja puhul sunnib `workspaceRole=CLIENT` eelpöördumise vaate pöörduja algusvoogu, et kasutaja ei satuks vastuvõtja töövaatesse.

## 4. Lisatud API

Lisati route:

`POST /api/journeys/[id]/pre-inquiry-draft`

Route:

- nõuab autentimist;
- loeb Journey objekti ainult `ownerUserId` põhjal;
- tagastab eelpöördumise prefill payload'i;
- ei loo PreInquiry objekti;
- ei saada midagi vastuvõtjale;
- ei muuda Journey `sharingStatus` väärtust.

## 5. Prefill payload

Journey kontekst teisendatakse eelpöördumise eeltäiteks `lib/journey/preInquiryHandoff.js` abil.

| Journey väli | Eelpöördumise prefill |
|---|---|
| `title` | `topic` |
| `summary` | `situation` põhitekst |
| `domains` | lisatakse olukorra kirjelduse teemadena |
| `missingInfo` | lisatakse mustandisse täpsustamist vajava infona |
| `riskSignals` | lisatakse ettevaatlike tähelepanekutena |
| `suggestedActions` | lisatakse järgmiste sammude kirjeldusena |
| `context.municipalityName/municipality/kov/region` või tekstist tuletatud piirkond | eelpöördumise KOV/piirkonna väli ja adressaadi otsing |
| tuletatud adressaadi tüüp | `KOV_CONTACT` või `SERVICE_PROVIDER`, kui kontekst annab piisava signaali |

## 6. Privaatsus ja nähtavus

Handoff ei jaga teekonda automaatselt. Vastuvõtja ei näe Journey objekti ega privaatset chat'i. Vastuvõtja näeb ainult seda sisu, mille kasutaja olemasolevas eelpöördumise vormis kinnitab ja salvestab või saadab.

`sharingStatus` jääb muutmata ning Journey jääb privaatseks.

## 7. Muudetud failid

| Fail | Muudatus |
|---|---|
| `components/journey/JourneyDetail.jsx` | lisati `Koosta eelpöördumine` tegevus ja privaatsust selgitav plokk |
| `lib/journey/preInquiryHandoff.js` | lisati Journey → PreInquiry prefill helper |
| `app/api/journeys/[id]/pre-inquiry-draft/route.js` | lisati owner-kontrolliga prefill API |
| `components/workspace/WorkspaceFeaturePage.jsx` | lisati `fromJourney` prefill laadimine ja admini `workspaceRole=CLIENT` vaate tugi |
| `messages/et.json` | lisati Teekond/eelpöördumine handoff tekstid |
| `messages/en.json` | lisati Teekond/eelpöördumine handoff tekstid |
| `messages/ru.json` | lisati Teekond/eelpöördumine handoff tekstid |

## 8. Kontrollid

Läbisid:

- `npx eslint app/teekond components/journey lib/journey app/api/journeys components/workspace/WorkspaceFeaturePage.jsx`
- `npx prisma validate`
- `npx prisma generate`
- `node -e "for (const f of ['messages/et.json','messages/en.json','messages/ru.json']) JSON.parse(require('fs').readFileSync(f,'utf8')); console.log('messages json ok')"`

Brauseris kontrolliti:

- `/teekond` avaneb;
- `/teekond/[id]` detailvaates on `Koosta eelpöördumine`;
- tegevus avab `/eelpoordumised?fromJourney=...&workspaceRole=CLIENT`;
- eelpöördumise vorm avaneb pöörduja vaates;
- teema, olukorra kirjeldus, KOV/piirkond, adressaadi otsing ja mustandi tekst täituvad Journey põhjal;
- vormis saab teksti muuta;
- automaatset saatmist ei toimu;
- prefill API vastus on `persisted: false` ja `shared: false`;
- prefill API ei loonud PreInquiry objekti;
- võõra või olematu Journey id tagastas 404;
- sisselogimata prefill API päring tagastas 401;
- pärast tavavoo laadimist ei olnud console error'e ega warninguid.

## 9. Mida ei muudetud

Ei muudetud:

- chat/RAG tuuma;
- `app/api/chat/route.js`;
- `lib/chat/**`;
- PreInquiry mudelit;
- `PreInquiry.status` enumit;
- eelpöördumise saatmise põhiloogikat;
- teenusekaardi andmemudelit või sync/import loogikat;
- Room süsteemi;
- billing/subscription/authz/privacy tuuma.

## 10. Järgmine etapp

Etapp 6 alla jääb chat'i mitteinvasiivne soovitus: chat võib sobiva olukorrakirjelduse korral pakkuda teekonna alustamist, kuid ei loo Journey objekti automaatselt ega muuda RAG/chat orchestrationit.
