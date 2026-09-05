# RAG v2: repositooriumi audit (M0)

Kontrollipäev 05.09.2026. See on konkreetse lähtepuu tehniline kaart, mitte elav seisufail. Aktiivne töö on [SotsiaalAI.md S1.0-s](../platvormi%20arendus/SotsiaalAI.md). Ülesande alus on omaniku viidatud `docs/CODEX_RAG_GRAPH_v0_1/rag-spec-v0.1` pakett; selle dokumendid on arendusnõuete sisend, artikli PDF/JSON on andmed.

## Kontrollitud lähtepuu

- `git log -1`: `ef184d4a410ba42b3153b15a2afa8c561a047e38`. `git ls-remote origin refs/heads/main` andis sama SHA. Serveri SHA-d, teenuseid, RAM-i ega GPU-d ei kontrollitud.
- `codex/repair-b` oli sama SHA peal ja `git status --short` oli tühi. Töö piirdub `lib/rag-v2/`, selle CLI ja sihttestiga, `docs/rag-v2/`, paketikirje/lukufaili ning S1.0-ga.
- Põhikausta võõrad muudatused: kustutatud avalik pildifail ning jälgimata lähtepakett, `docs/audits/evidence/` ja `eval/`. Neid ei kopeeritud commit'i ega muudetud.
- JavaScript ESM, Next.js App Router, React; npm ja `package-lock.json`. Käivitatud Node on 24.18.0. `package.json` sisaldab Next 16.2.3 semver-vahemikku, React 19.2.7, Prisma 7.3.0 vahemikku; resolutsioonid määrab lukufail.
- `prisma/schema.prisma` andmeallikas on PostgreSQL. Olemasolev skeem jääb puutumata. M1 kohalik register ei kirjuta Prisma ega tootmise andmebaasi.
- Olemas on `pdf-parse` 2.4.5 ning selle lukustatud PDF.js sõltuvus 5.4.296. Uus asukohapõhine parser kasutab PDF.js-i otse; sama versioon lisati otsese sõltuvusena, uusi transitiivseid pakette lukufaili ei lisandunud.
- Üldist RAG-testitaristut ei ole. Lisatud test kasutab Node'i sisseehitatud `node:test` käivitajat. Üldist E2E-/smoke-sviiti ei taastata.

## Tegelikud ühenduskohad

| Pind | Koodist kontrollitud leping | Uue süsteemi ühendamise piir |
| --- | --- | --- |
| Vestlus | `app/api/chat/route.js`: autentimine `requireChatUser()`, päringupiirang, seejärel 503 `RAG_RETIRED`; GET ütleb `generationAvailable: false` | M1 ei ava seda rada. M4 peab säilitama autentimise, kvoodid, idempotentsuse ja persistentsuse. |
| Autentimine | `lib/chat/routeServerUtils.js`: NextAuth serverisessioon; `lib/authz` ja admini kontrollid | CLI tenant on kohaliku operaatori nimeruum, mitte kasutaja autentimistõend. Enne HTTP-ühendust tuleb tenant/ACL tuletada serverisessioonist. |
| Vestluskontekst | `components/chat/hooks/useChatStream.js` saadab `message`, `history`, `convId`, `role`, `uiLocale`, `roomId`, `inputModality`, `privacyDecision`, `clientTurnKey`/`idempotencyKey` | Kliendi `role` ega `history` ei tõenda serveri õigusi. Subjekti ja paranduste käsitlemine vajab M4 taastamisel eraldi tõendit. |
| Voog ja salvestatud vastus | Sama hook küsib `stream: true`, oskab taastada salvestatud teksti ja `displayed_sources`/`sources` väljad | Praegune chat API ei genereeri ega voogedasta. M4 viite-ID valideerimise hetk tuleb siduda lõppsõnumi/allikate avaldamisega. |
| Allikavaade | `components/chat/utils/sources.js`: `source_id`, `docId`, `document_id`, `page`, `pages`, `pageRange`, pealkiri, autor, URL; `ChatSourcesPanel.jsx` | Uued versiooni/allikakoha ID-d tuleb lahendada lubatud failiks ja 1-põhiseks PDF-leheks enne vana kuvakuju täitmist. Mudeli URL-i ei usaldata. |
| Mudel | `lib/chat/settings.js` sisaldab `OPENAI_MODEL` ja fallback'i `gpt-5.6-luna`; kohalikes `.env*` failides kontrolliti ainult mudelinimede võtmeid, eraldi väärtust ei leitud | See on koodistring, mitte kontrollitud API saadavus. Peamise vastaja adapter on uues tuumas seadistamata; fallback'i ei kopeerita. M4 vajab kinnitatud mudeli-ID-d ja piiratud proovikutse luba. |
| AI-dokumendid | `lib/documents/generation.js` sisaldab OpenAI kliendi loomist ja mudeliseadete importi; teadmispõhine genereerimine on peatatud | SDK olemasolu ei tähenda töötavat uut vastamisadapterit. Käsitsi dokumenditöö säilib. |
| Algfailid ja kustutused | `lib/documents/ragService.js` on katkestust ausalt raporteeriv ühilduspiir; `lib/materials/ragLifecycle.js` ja privaatsustoimingute ühenduskohad säilivad | Uut lokaalset näidishoidlat ei tohi siduda päriskasutaja kustutuste lõpetatuks märkimisega. |
| Admini enesetest | `app/api/rag/selftest/route.js`: NextAuth + `assertAdmin`; 503, `state: retired`, `steps: []` | Kasutaja käsitsi käivitatav funktsioon jääb alles. M1 testiprogramm ei asenda seda. |
| Taustatöö | Säilinud `/api/research/jobs` ja voog kuuluvad ajaloo/oleku pindade juurde; deploy kaustas on olemasolevate ajastatud platvormitööde systemd üksused | Töötavat uut RAG/research worker'it sellest ei järeldata. M1 käivitub otsese kohaliku CLI-na. |

Ülejäänud kasutajale nähtav funktsioonikaart on [RAG masteris](../audits/rag-susteem-master.md). Selle vana arhitektuuri ei taastata. Täiendavaid seisufaile ega SOL-raporti DONE-märke M0/M1 tööga ei looda.

## Vastuvõtukaart

| Risk | Teostus | Väikseim tõend |
| --- | --- | --- |
| Artikkel seguneb ajakirjanumbri või teise kliendiga | Nimeruumiga dokumendi-ID, eraldi välised tunnused ja failiräsi duplikaadikonflikt | I-01, I-02, I-10 ja duplikaaditest |
| Vale kuupäev, leht, rubriik või metaandmeväite tõendiks pidamine | Päritoluga väljad, PDF-lehed, muutmata `legacy_metadata`, eraldi otsinguabid | I-03…I-09, I-12; visuaalselt PDF lk 1, 3, 5, 8, 12, 13 |
| Puhastus kaotab algallika või struktuuri | PDF.js elemendid + koordinaadid, rekonstrueeritud lehetekst, täpsed allikakohad, lõiguplokid ja peatükid | I-04, I-06, I-07; sama tekst päises ja sisus |
| Kordus või katkestus rikub aktiivset kogu | Püsivad versioonid, kontrollsummad, staging, ainukirjutaja lukk ja aktiivse manifesti vahetus | I-11, I-14, versiooni/registri riknemise test |
| Sobimatu fail või väljumine lubatud sisendjuurest | Baidi/lehe/aja piir, realpath-kontroll, tekstita sisendi veaseis | I-13, I-15, parseripiirangud ja välise kataloogi junction-test |
| Valdkond on tuuma sisse kirjutatud | Deklaratiivne profiil, räsiga seotud varasema auditi märkus | Sünteetilise aiandusprofiili ingest; otsingut see test ei tõenda |

Käsitsi DB- ega autenditud brauserirada pole M1 kohaliku failiimportimise vastuvõtuks vajalik: sellist ühendust ei looda. Platvormi autentimise, privaatsuse, DB tehingute ja pärisotsingu runtime jääb `NOT_PROVEN`. M1 failiandmed ei lähe võrku ega mudelisse. Testid blokeerivad ootamatu võrguühenduse; PDF-parser saab ainult kohalikud baidid.
