# Opus U8-lite — allikate usalduskihi sõltumatu audit

> **LÕPPOTSUS: `OPUS PARANDUSED VAJALIKUD`** — P0 puudub. **1 blokeeriv P1 (U8-P1-1)** + 3 P2.
> Pakett ei lähe commit'i/main-i enne U8-P1-1 sulgemist ja kordusauditit.

- Kuupäev/kell: 2026-07-14, Europe/Tallinn.
- Mudel/effort: Opus 4.8, Extra (xhigh). Sõltumatu read-only esmane audit.
- Auditeeritud: tööpuu `C:\Users\rauds\Desktop\SotsiaalAI-u8-lite`, haru `codex/u8-lite-trust-layer`, baas `df2f45c0`, **kogu diff commit'imata** (17 muudetud + 11 uut rada).
- Alus: paketi enda lukustatud leping (doc `11-sol-u8-lite-allikate-usalduskiht-progress.md` §2.2–§2.4).
- Loetud/kontrollitud: `lib/sourceFeedback.js`, `lib/chat/sourceTrust.js`, `lib/contentTrustState.js`, `lib/chat/sourceAttribution.js` (diff + `getSourceAttributionId`/`isLegalSource`/`stripSourceEvidence`), `lib/rag/sourceMetadata.js` (`normalizeSourceType`, legal-aliased), kõik 4 API-route'i, chat'i `messages`/`run` route'id, `ChatSourcesPanel.jsx`, `useConversationSources.js`, wellbeing-paneelid, skeem + migratsioon, kõik 4 testifaili.
- Käivitatud kontrollid: `tests/u8/*.test.js` — **15/15 läbitud**. Lisaks kirjutasin ise ajutise sondi (allpool), mis tõestab U8-P1-1 päris funktsioonidega; sond kustutati, tööpuud ei muudetud.

## 1. P1 — 1 blokeeriv

### U8-P1-1 — allika identiteet ei ole püsiv: „teata veast" annab teatud allikatel alati 404 kuni lehe taaslaadimiseni (**P1, blokeeriv**)

- **Failid/read:** `lib/chat/sourceTrust.js:32–36` (`normalizedSourceType`) ja `:79–90` (`serializeDisplayedSourceTrust`); `lib/chat/sourceAttribution.js:453–455` (`isLegalSource`) ja `:875–897` (`getSourceAttributionId`); `lib/sourceFeedback.js:79–83` (serveri sobitus); `app/api/chat/conversations/[id]/messages/route.js:72–76` ja `app/api/chat/run/route.js:53–57` (lugemisaegne re-serialiseerimine).
- **Mehhanism (tõestatud, mitte oletatud):** `serializeDisplayedSourceTrust` **kirjutab üle** olemasoleva `source_type` välja väärtusega `normalizedSourceType()`, mis langeb tagasi `origin`/`type` peale. Just sellel väljal põhineb `isLegalSource` (`sourceAttribution.js:454` ehitab objekti **ainult** `{ source_type: sourceType || source_type }` — `type`/`origin` sinna EI jõua). Identiteediahelas `getSourceAttributionId` eelistab `legalId`-d (`id`/`key`/`chunk_id`) väljale `source_id`. Seega allikas, mille legaalne tüüp on väljal `type` või `origin` (mitte `source_type`), **ei ole** attribuutika hetkel „legaalne" (ID = `source_id`), aga **on** seda pärast salvestamist (ID = `id`).
- **Tõend (jooksutasin päris funktsioonidega):**

  ```text
  OK   | plain doc                  | shown=doc-1            | server=doc-1
  OK   | source_id + id             | shown=A                | server=A
  FAIL | type:law, no source_type   | shown=A                | server=B
  FAIL | origin:law                 | shown=A                | server=B
  OK   | source_type:law            | shown=B                | server=B
  OK   | url only                   | shown=https://x.ee/u   | server=https://x.ee/u
  ```

  (invariant: `getSourceAttributionId(serializeDisplayedSourceTrust(s, id), i) === id`)
- **Käivitustingimus ja kasutaja nähtav sümptom:** klient võtab `sourceId` kinnistatud `source_id` väljalt (`useConversationSources.js` `trustFields`). Värske vastuse voos on see attribuutika-aegne ID (`A`). `createSourceFeedback` **ei sobita kinnistatud `source_id` järgi, vaid arvutab ID uuesti** salvestatud kirjest (`B`) → `matched` on `undefined` → `SOURCE_NOT_FOUND` **404**. Pärast lehe taaslaadimist annavad `messages`/`run` route'id re-serialiseerimisel `source_id = B` → sama teade õnnestub. Seega: **veast teatamine (U8-lite lubadus §1 p2) ebaõnnestub vaikselt kohe pärast vastust ja hakkab tööle alles pärast reload'i.** Sama ebakõla lõhub ka „juba teatatud" märgise (`ownFeedback[src.sourceId]`) ja teeb dedupe-võtme tee-sõltuvaks.
- **Ulatuse aus piir:** tõestasin mehhanismi, kliendi tee ja serveri tee. **Ei saanud tõestada**, kas päris RAG-allikatel esineb kuju „legaalne tüüp `type`/`origin` väljal + `source_id` ≠ `id`" (tööpuus puudub keskkonnafail; sama piirang on kirjas ka paketi enda dokis). Kaudne tõend, et kuju on reaalne: `normalizeSourceType` (`sourceMetadata.js:373`) sisaldab teadlikku `source.type` fallback'i — seda ei oleks, kui tüüp oleks alati `source_type` väljal.
- **Juur (lepingu rikkumine):** §2.2 nõuab, et usaldusmeta **lisatakse** pärast attribuutikaotsust ega muuda kuvamise tõenduslävendit. Praegu see mitte ei lisa, vaid **kirjutab ümber identiteeti kandva `source_type` välja**, muutes seeläbi salvestatud `displayed_sources` tähendust kõigi tarbijate jaoks.
- **Oodatav parandus (üks kahest, soovitan mõlemat):**
  1. **Ära kirjuta identiteeti kandvat välja üle** — usaldusmeta läheb eraldi väljale (nt `source_trust_type`), `source_type` jääb puutumata.
  2. **Server sobitagu kinnistatud ID järgi**, mitte ümberarvutuse teel: `sourceList(...).find((s, i) => String(s?.source_id || "") === input.sourceId || getSourceAttributionId(s, i) === input.sourceId)`.
- **Nõutav regressioonitest:** lukusta invariant `getSourceAttributionId(serializeDisplayedSourceTrust(s, getSourceAttributionId(s, i)), i) === getSourceAttributionId(s, i)` ülaltoodud kuuel kujul (praegu kukuvad 2/6); lisaks integratsioonitest „värskest voost saadud `sourceId`-ga teade õnnestub ilma reload'ita".

## 2. P2 — 3 leidu (ei blokeeri)

| ID | Leid | Fail | Klass |
|---|---|---|---|
| U8-P2-1 | `SourceFeedback.messageId` on lihtne `String` ilma võõrvõtmeta ja vestluse kustutamisel ei koristata midagi → jäävad rippuvad kirjed koos raporteerija märkusega, mille sõnumit enam ei eksisteeri. **Konto** kustutamine on korrektselt kaetud (`reporter` FK `onDelete: Cascade`). Otsustada: kas vestluse kustutamine peab märkuse kaasa võtma (siis lisada koristus) või on kirje teadlikult säilitatav (siis dokumenteerida). | `prisma/schema.prisma` (SourceFeedback), `lib/sourceFeedback.js` | päris (väike; tooteotsus) |
| U8-P2-2 | `POST /api/source-feedback`: `await request.json()` ilma `.catch()`-ita → vigase JSON-i korral `SyntaxError`, millel puudub `status` → vastus on **500 `source_feedback.FAILED`**, mitte 400. Kosmeetiline, aga peidab kliendivea serveriveana. | `app/api/source-feedback/route.js:23` | päris (väike) |
| U8-P2-3 | `getContentTrustState`: kui `userConfirmed === true` ja kõik tekstid on tühjad, tagastab `human_confirmed` (`"" === ""`). Tühja sisu ei tohiks kunagi kuvada „inimese kinnitatud"-na. Lisa valve: `current` peab olema mittetühi. | `lib/contentTrustState.js:12` | päris (väike; serv) |

## 3. Kontrollitud ja KORRAS (ei ole leiud)

- **SourceFeedbacki turvaleping (§2.3) — punkt-punktilt täidetud.** Kontrollisin kõiki 10 alampunkti:
  - POST võtab **ainult** `messageId`/`sourceId`/`category`/`note` — `ALLOWED_POST_FIELDS` allowlist, tundmatu väli → `FORGED_FIELDS` (st täisvestluse/prompti/vastusetekstiga päring lükatakse tagasi) ✓;
  - sõnum leitakse `messageId` **ja raporteerija omandi** järgi (`conversation: { userId: reporterId }`, `role: "ASSISTANT"`) ✓;
  - `sourceType` võetakse **serveris leitud** allikast, mitte kliendist; kliendi pealkiri/URL/tüüp ei ole identiteet ega sisend ✓;
  - dedupe on serveripoolne `sha256(reporterId, messageId, sourceId, category, note)` + `@unique` + P2002-fallback → duplikaat on idempotentne ✓;
  - lahendamisel kirjutatakse `dedupeKey` ümber (`:resolved:<id>`) → sama teade saab pärast lahendamist uuesti tekkida, aga **teist avatud kirjet ei teki** — leping „ei tekita teist avatud kirjet" on täpselt täidetud, ID-põhine sufiks väldib kokkupõrget ✓;
  - kiiruspiirang (10/h) jookseb **tehingus** ja raporteerijapõhise `pg_advisory_xact_lock`-i all → kaks paralleelset POST-i ei möödu loendurist ✓;
  - kasutaja näeb ainult enda kirjeid (`findFirst { id, reporterId }`), admin kõiki; võõras/olematu ID → **ühesugune 404**; admin-route'id annavad mitte-adminile samuti 404 (mitte 403) → olemasolu ei lekita ✓;
  - lahendamine nõuab admini ja kirjutab `dataAuditLog` rea **samas tehingus** CAS-iga (`updateMany where status:"OPEN"`, `count === 1`) ✓;
  - tagasiside ei kirjuta sõnumitesse ega allikatesse midagi ✓.
- **Kuupäevaleping (§2.2) — korrektne.** Aliased normaliseeritakse ühes serveripoolses abifunktsioonis; väljund on ainult valideeritud ISO-kuupäev või `null`; **tänast kuupäeva ei leiutata** (puudub `|| now` fallback); puuduv/vigane → `unknown`; ajalooline/arhiveeritud/mitteaktiivne saab eraldi hoiatuse; `validTo` möödumine → `stale`. Lisaks hea kaitse, mida leping ei nõudnud: **tulevikku jääv `checkedAt`** (> +1 päev) tõrjutakse (`checked_at: null`, `freshness: unknown`) — st vigane meta ei saa end värskeks võltsida.
- **Attribuutika lävend (§2.2) — puutumata.** `buildAttributionResult` lisab usaldusmeta alles `displayedItems` üle, st **pärast** kuvamisotsust; valikuloogikat, skoore ega lävendeid ei muudetud. (Vt siiski U8-P1-1: probleem ei ole lävendis, vaid identiteedis.)
- **Lugemisaegne värskuse ümberarvutus** (`messages`/`run` route'id) on **õige disain** — muidu külmuks salvestatud „fresh" igaveseks; värskus vananeb korrektselt iga lugemisega.
- **AI-mustandi olekuleping (§2.4) — korrektne ja fail-safe.** Olek tuletatakse ainult `generatedText`/`editedText`/`userConfirmed` lepingust; kinnitamata muutmata → `ai_draft`; muudetud → `human_edited`; ainult tõendatud kinnitus → `human_confirmed`. **Kõige olulisem:** `changedSinceStored` tühistab kinnituse esituskihis isegi siis, kui DB `userConfirmed` lipp on aegunud → märgis ei saa valetada ka serveri-poolse lipu-vea korral. Märgis on tekstiline ja semantiline (`ContentTrustBadge`), mitte ainult värv.
- **Skeem/migratsioon:** üks uus tabel + 2 nullable seost; olemasolevaid veerge ei muudeta; `note VARCHAR(500)`/`resolutionNote VARCHAR(1000)` vastavad rakenduskihi piiridele; `reporter` Cascade / `resolvedBy` SetNull ✓.
- **Klient:** `ChatSourcesPanel` POST'ib täpselt 4 lubatud välja — vestluse ega vastuse teksti ei saadeta ✓.

## 4. Jaotus

- **Päris vead:** U8-P1-1 (blokeeriv), U8-P2-2, U8-P2-3.
- **Tooteotsust vajav:** U8-P2-1 (vestluse kustutamise semantika).
- **Miks testid vea ei püüdnud:** 15 testi katavad iga mooduli eraldi (`sourceTrust`, `sourceFeedback`, `contentTrust`, lepingud), kuid **mitte `sourceAttribution` ↔ `sourceTrust` liidest** — täpselt seal U8-P1-1 elab. Sama muster nagu U4-P1-1: mõlemad paketid on moodulite tasemel korralikult testitud ja kukuvad läbi kahe mooduli vahelisel piiril.

## 5. Järgmine samm

1. Sol parandab U8-P1-1 (soovitus: ära kirjuta `source_type`-i üle **ja** sobita kinnistatud `source_id` järgi) + lukustab invariandi testiga.
2. P2-1 vajab kasutaja tooteotsust; P2-2/P2-3 on odavad ja soovitan samas ringis.
3. Seejärel Opuse kitsas kordusaudit; alles siis commit/main/deploy.

- Kõrvaliste failide seis: ruumifailid puutumata; audit oli read-only, ajutine sond kustutati.
- Commit/push/deploy seis: **TEGEMATA** (ainus muudatus on see auditidokk peapuus).

---

## 6. Hilisem parandus- ja integratsiooniseis (2026-07-14)

See fail säilitab Opuse esmase auditi ajaloolise otsuse. Sol sulges hiljem
U8-P1-1 identiteedi-invariandi paranduse ja liidesetasandi regressioonitestiga
commit'is `02f40a21`. Kasutaja aktsepteeris sihitud parandusringi ilma uue
Opuse kordusauditita; seepärast ei muudeta esmast otsust tagantjärele
`OPUS HEAKS KIIDETUD` otsuseks.

Pakett ühendati seejärel `main`-i ja deploy'ti productionisse koondrelease'is
`22958456`.

Lõppseis: **SOL PARANDATUD — KASUTAJA AKTSEPTEERIS ILMA KORDUSAUDITITA —
MAIN-IS JA PRODUCTIONIS**.
