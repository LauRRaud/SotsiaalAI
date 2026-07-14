# Opus U4 — kättesaadavuse ja värskuskinnituse sõltumatu audit

> **LÕPPOTSUS: `OPUS PARANDUSED VAJALIKUD`** — P0 puudub. **1 blokeeriv P1 (U4-P1-1)** + 3 P2.
> Haru ei merge'ita enne U4-P1-1 sulgemist ja kordusauditit.

- Kuupäev/kell: 2026-07-14, Europe/Tallinn.
- Mudel/effort: Opus 4.8, Extra (xhigh). Sõltumatu read-only esmane audit.
- Auditeeritud: haru `codex/u4-availability-trust`, teostuscommit `47b51dba`, haru tipp `3208c08c`, tööpuu `C:\Users\rauds\Desktop\SotsiaalAI-u4`. Diff vs `main`: 31 faili, +1993/−72.
- Alus: paketi enda lukustatud leping (doc `10-sol-u4-kattesaadavus-ja-varskuskinnitus-progress.md` §3–§5).
- Loetud/kontrollitud: `lib/serviceAvailability.js`, `serviceAvailability.server.js`, `serviceAvailabilityOperations.js`, `serviceAvailabilityReminders.js`, `serviceAvailabilityUi.js`, `serviceProviderProfiles.js` (upsert + serializerid + RAG), `lib/preInquiries.js`, `lib/mailer.js`, mõlemad API-route'id, admin-leht + klient, `WorkspaceFeaturePage.jsx`, `ServiceMapLeaflet.jsx`, `app/styles/workspace.css`, skeem + migratsioon, CLI-skript, kõik 5 uut testifaili.
- Käivitatud kontrollid: `tests/serviceProvider/*.test.js` — **25/25 läbitud**; `npm run i18n:check` — **OK (en/ru = et)**. Jooksutasin ise.

## 1. P1 — 1 blokeeriv

### U4-P1-1 — eelpöördumise adressaadikaart näitab IGA teenuse kohta valeteadet „kättesaadavus kinnitamata" (**P1, blokeeriv**)

- **Failid/read:** `lib/preInquiries.js:1204–1237` (Prisma `select`), `:1306–1309` ja `:1321` (mapper), `components/workspace/WorkspaceFeaturePage.jsx` (`getPreInquiryAvailabilityNotices`).
- **Juur:** `assistPreInquiry` päringu `providerProfile.serviceItems.select` **ei võta** välju `availabilityStatus`, `availabilityDescription`, `availabilityCheckedAt`, ning `serializePublicServiceAvailability` **ei ole `preInquiries.js`-i kunagi imporditud ega kutsutud** (kontrollitud: failis on ainsad `availability`-viited need 5 mapper-rida). Seega `service.availability` on **alati `undefined`** ja `service.availabilityStatus`/`availabilityCheckedAt` samuti.
- **Käivitustingimus:** iga eelpöördumise adressaadisoovitus (`/api/pre-inquiries/assist` → adressaadikaardid ja valitud adressaadi eelvaade).
- **Mõju (tugevam kui „funktsioon ei tööta"):** `serviceAvailabilityPresentation(t, undefined)` → `status: "unknown"`, `freshness: "unknown"`. `getPreInquiryAvailabilityNotices` filter `presentation.freshness === "unknown"` on seetõttu **tõene iga teenuse kohta**, mistõttu kaart kuvab kuni 3 teenuse kohta teate „? <teenus>: Kättesaadavus kinnitamata. Kinnitamise aeg teadmata. Kättesaadavuse infot ei ole veel kinnitatud. Küsi enne pöördumist üle." — **ka siis, kui teenuseosutaja kinnitas täna „võtab uusi pöördumisi vastu"**. See pöörab U4 lubaduse pahupidi: hoolas kinnitaja kuvatakse kinnitamatuna ja kogu meeldetuletuse-silmus on pöörduja vaates mõttetu.
- **Rikutud leping:** §1 („pöörduja ja spetsialist näevad olekut ning info vanust enne pöördumist") ja §5 („eelpöördumise adressaadikaart näitab olekut tekstina koos ikooniga, ligikaudset ooteaega, suhtelist kinnitamise vanust").
- **Klass:** päris viga, haru sisse toodud. Teenusekaardi (Leaflet) tee töötab korrektselt, sest `listPublishedServiceMapEntries` kutsub `serializePublicServiceAvailability` — vigane on ainult eelpöördumise tee. Viga on vaikiv: „unknown" näeb usutav välja, seetõttu ei paista see käsitsi testimisel veaks.
- **Oodatav parandus:** lisada `select`-i `availabilityStatus`, `availabilityDescription`, `availabilityCheckedAt` ning arvutada mõlemas mapperis (`providerServiceItems` ja `providerProfile.serviceItems`) `availability: serializePublicServiceAvailability(service)` (import `@/lib/serviceAvailability`).
- **Nõutavad regressioonitestid:** (1) värskelt kinnitatud `accepting` teenus → soovituse `availability.status === "accepting"`, `freshness === "fresh"` ja **ükski teade ei teki**; (2) aegunud kinnitus → `freshness === "stale"` + stale-teade; (3) `not_accepting` → teade tekib ka värske kinnituse korral; (4) kinnitamata teenus → „unknown" teade (praegune käitumine, aga õigel põhjusel).

## 2. P2 — 3 leidu (ei blokeeri)

| ID | Leid | Fail | Klass |
|---|---|---|---|
| U4-P2-1 | Meeldetuletuse CLI ei kutsu kunagi `prisma.$disconnect()` → perioodiline töö ei lõpeta protsessi (kõik võrreldavad skriptid, nt `drain-effective-practice-rag-deletions.mjs` ja `practice-deploy-gate.mjs`, kasutavad `try/finally { await prisma.$disconnect() }`). Cron kuhjab rippuvaid protsesse. | `scripts/service-availability-reminders.mjs` | päris (operatsiooniline) |
| U4-P2-2 | Päring ja due-predikaat on vastuolus: `OR: [{ reminderSentAt: null }, { reminderSentAt: { lt: cutoff } }]` tõmbab ligi juba meeldetuletatud read, kuid `serviceAvailabilityReminderDue` nõuab `reminderSentAt < checkedAt`, mida **ükski kirjutustee ei tekita** (nii `confirmServiceAvailabilityRecord` kui profiilisalvestus nullivad `reminderSentAt`). Teine OR-haru toob seega ainult ridu, mis alati `skipped`. Kuna järjestus on `availabilityCheckedAt asc`, sordivad need igavesti-skipitavad read **esimesena** ja täidavad tõmbeakna (`limit*5`, max 2000) → mahus näljutavad päriselt tähtaja ületanud read. Lihtsusta `availabilityReminderSentAt: null`-iks. | `lib/serviceAvailabilityReminders.js:82–85` + `serviceAvailability.js:110–117` | päris (väike; skaala) |
| U4-P2-3 | Fantoom-tokenid: `var(--surface, #fff)` ja `var(--border, #9aa6a0)` — **kumbagi tokenit ei ole `app/`-s ega `components/`-s defineeritud** → alati fallback. Näeb teemateadlik välja, aga ei ole; kui päev/öö redisain `--surface` tumedaks defineerib, muutub kõvakodeeritud `color: #2b2925` tume-tumedal loetamatuks. Sama klass: inline-värvid `ServiceMapLeaflet.jsx` (`applyServiceMapPopupTheme`, `line.style.color`) ja `WorkspaceFeaturePage.jsx` inline `style={{ color: ... }}`. | `app/styles/workspace.css`, `ServiceMapLeaflet.jsx`, `WorkspaceFeaturePage.jsx` | päris (väike; CSS-distsipliin) |

## 3. Kontrollitud ja KORRAS (ei ole leiud)

- **Autoriseerimine (§3.4) — puhas.** Kinnitus-route: sessioon → 401; roll (admin või SERVICE_PROVIDER) → 403; ja mis tähtsaim, `confirmServiceAvailabilityRecord` päring on skoobitud `providerProfile: { ownerId }` → **admin saab kinnitada ainult oma profiili**, mitte võõrast. Admin-route (GET/POST) mõlemad `assertAdmin`; admin-leht suunab mitte-admini `/`-le; adminivaates puudub „omaniku eest kinnitamine" (§5 täidetud).
- **Fingerprint-CAS (§3.3) — korrektne.** sha256(id, kanooniline olek, normaliseeritud kirjeldus); vale/aegunud fingerprint → 409 ilma kirjutamiseta; `updateMany` WHERE sisaldab ka sisuvälju → topelt-CAS; muutmata sisu korduskinnitus on idempotentne. Fingerprint on CAS-žetoon, mitte autoriseerimisžetoon — ligipääsu annab ownerId-skoop, seega äraarvamine ei anna midagi.
- **Legacy säilitamine (§3.2) — korrektne.** `LEGACY_STATUS_MAP` katab ainult üheselt mõistetavad (`Saadaval`/`Järjekord`/`Peatatud`); §2-s mainitud mitmetähenduslik „Piiratud vastuvõtt" → ausalt `unknown`. `normalizeAvailabilityStatusForWrite` lubab tundmatut väärtust ainult siis, kui see on **muutmata** olemasolev väärtus (muidu 400). `serviceAvailabilityFingerprint` → `null` mittekanoonilise oleku korral → legacy rida **ei ole kinnitatav** enne kanoonilise oleku valikut. Migratsioon aditiivne, backfill puudub.
- **Profiili terviksalvestus (§3.3) — korrektne ja parem kui nõutud.** Teenuse ID päritakse (`id: previous.id`) ainult **omaniku enda** olemasolevatest kirjetest (`existingServicesById` ehitatakse `existing.serviceItems`-ist) → klient ei saa võõrast ID-d nõuda. `availabilityCheckedAt` uueneb ainult siis, kui olek/kirjeldus **sisuliselt muutus**; kõrvalise välja muutmine pärib vana ajatempli → aegunud info ei „pese" end värskeks. Kogu salvestus on `Serializable` + P2034-retry (3×), nii et samaaegne üheklõpsu-kinnitus konfliktib ausalt. (Tühine: `now` on püütud retry-silmusest väljaspool.)
- **Avalik esitus (§3.4/§5) — korrektne.** Kaardi-popup kasutab `service.availability` objekti, mitte toorest legacy-olekut, ja seob oleku ALATI vanuse + stale/unknown hoiatusega; tähendus ei sõltu ainult värvist (ikoon + tekst). `availabilityFingerprint`/`availabilityReminderSentAt` väljastatakse ainult `includeAvailabilityOperations`-iga ja seda kasutavad ainult omaniku-skoobiga route'id → avalikku leket ei ole.
- **Kontrast:** kontrollisin mõlemat pinda. Kaardi-popup: hele plokk (`#fff6e8`/`#edf7f1`/`--surface` fallback `#fff`) + tume tekst; eelpöördumise kaart: tume taust + **hele** tekst (`#fff4df`/`#e8fff2`). Loetavus korras (vt siiski U4-P2-3 tuleviku-risk).
- **Meeldetuletus (§4) — korrektne.** Link viib autenditud `/teenuseprofiil?availability=review` vaatesse, **mitte tokenipõhisele anonüümsele muutmis-URL-ile**; kiri sisaldab ainult organisatsiooni/teenuse nime + linki, mitte kliendi/juhtumi andmeid; HTML on escape'itud; „claim-before-send" CAS (`updateMany` vana `checkedAt`+`reminderSentAt` vastu) hoiab ära kahe samaaegse dispatcheri topeltkirja; saatja/saaja/transpordi puudumine → `not_sent` + `DataAuditLog` põhjus, vale `sent` edu ei tagastata; auditisse ei kirjutata e-posti aadressi. Saatmisvea korral taastatakse `reminderSentAt` → kordussaatmine on võimalik (at-least-once; kui kiri läks välja, aga vastus kadus, võib tekkida duplikaat — standardne kompromiss, mainin teadmiseks).
- **RAG (§3.3):** `serviceAvailabilityRagFields` viib RAG-i nii oleku, kinnitamise aja kui `availability_freshness`/`availability_stale` signaali; RAG-tekst ütleb aegunud info kohta ausalt „(stale)" ja kinnitamata info kohta „kinnitamata".

## 4. Jaotus

- **Päris vead:** U4-P1-1 (blokeeriv), U4-P2-1, U4-P2-2, U4-P2-3.
- **Teadlikult edasi lükatud:** —.
- **Valikulised UX-parandused:** —.
- **Miks testid vea ei püüdnud:** 25 testi katavad `serviceAvailability*` mooduleid ja UI-lepingut regexiga, kuid **mitte `assistPreInquiry` → adressaadikaardi integratsiooni**. U4-P1-1 elab täpselt selles katmata liideses (Prisma `select` vs mapper).

## 5. Järgmine samm

1. Sol parandab U4-P1-1 + lisab nimetatud regressioonitestid; P2-d on soovituslikud (U4-P2-1 ja U4-P2-2 on odavad ja soovitan samas ringis).
2. Seejärel Opuse kitsas kordusaudit.
3. Merge/deploy alles pärast seda; deploy on kasutaja otsus.

- Kõrvaliste failide seis: ruumifailid puutumata; audit oli read-only, haru koodi ei muudetud.
- Commit/push/deploy seis: **TEGEMATA** (ainus muudatus on see auditidokk peapuus).

---

## 6. Hilisem parandus- ja integratsiooniseis (2026-07-14)

See fail säilitab Opuse esmase auditi ajaloolise otsuse. Sol sulges hiljem
U4-P1-1 liidesetasandi paranduse ja regressioonitestidega commit'is
`a3529ac0`. Kasutaja aktsepteeris sihitud parandusringi ilma uue Opuse
kordusauditita; seepärast ei muudeta esmast otsust tagantjärele
`OPUS HEAKS KIIDETUD` otsuseks.

Pakett ühendati seejärel `main`-i ja deploy'ti productionisse koondrelease'is
`22958456`.

Lõppseis: **SOL PARANDATUD — KASUTAJA AKTSEPTEERIS ILMA KORDUSAUDITITA —
MAIN-IS JA PRODUCTIONIS**.
