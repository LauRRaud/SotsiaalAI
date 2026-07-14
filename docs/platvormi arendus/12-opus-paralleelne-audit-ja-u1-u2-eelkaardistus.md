# Opuse paralleelne tööplaan — U1/U2 eelkaardistus ja Fable'i järgmised tööd

> **Staatus:** AKTIIVNE JÄRJEKORD
>
> **Koostatud:** 2026-07-14
>
> **Teostaja:** Claude Opus 4.8, eelistatult Max; minimaalselt Extra (`xhigh`)
>
> **Töö laad:** read-only arhitektuurikaardistus ja järgmiste pakettide analüüs
>
> **Koodi teostamine:** keelatud selles tööpaketis
>
> **Commit/push/merge/deploy:** keelatud ilma kasutaja eraldi loata

## 0. Eesmärk

Opus ei pea Soli parandusringi ajal jõude ootama. Ta teeb ainult sellist tööd, mis ei muuda Soli aktiivseid faile ega auditeeri liikuvat sihtmärki.

Kasutaja otsus 2026-07-14: Parimate praktikate OPUS-P1-6, U4 ja U8-lite parandusringe ei anta Opusele veel üheks kordusauditiks tagasi. Sol teostas Opuse konkreetsed parandused ja regressioonid ning kasutaja aktsepteerib need esitatud kontrollitulemuste alusel.

Seda seisu ei nimetata `OPUS HEAKS KIIDETUD`. Aus staatus on `SOL PARANDATUD — KASUTAJA AKTSEPTEERIS ILMA KORDUSAUDITITA`, kuni mõni tulevane audit või regressioon leiab uue vea.

Prioriteet on:

1. U1/U2 read-only eelkaardistus;
2. U1/U2 tööplaani arhitektuuri-, privaatsus- ja töömahu kontroll;
3. allesjäänud U5/U6/U7/U9/U11 ajakohastatud koodireaalsuse audit;
4. U7 järgmise tööplaani sisendi ettevalmistamine;
5. mitte ükski uus koodimuudatus selles paketis.

## 1. Töö alustamise kontroll

Iga tööploki alguses:

1. kontrolli `git worktree list`, iga siht-worktree `git status`, haru ja HEAD;
2. fikseeri auditeeritav commit või commit'imata diffi räsi/faililoend;
3. loe Soli värsked progressidokid ainult sõltuvuste kaardistamiseks;
4. ära auditeeri ega muuda worktree'd, kuhu Sol samal ajal kirjutab;
5. ära vaheta põhitööpuu haru ega muuda Soli worktree faile;
6. kasuta vajadusel eraldi detached read-only audit-worktree'd;
7. dokumenteeri täpselt, millist commit'i või diffi auditeeriti.

Ära ava lõpetatud OPUS-P1-6, U4 või U8 leidu uuesti ilma uue konkreetse kooditõendi või kasutaja otsuseta.

## 2. Varasemad parandusringid — uuesti auditeerimise asemel aktsepteeritud

Kasutaja ei soovi, et Opus kordaks kohe enda auditi järel Soli tehtud paranduste auditit. Järgmised paketid liiguvad integratsiooniotsuse suunas Soli kontrollpakettide alusel:

- **Parimate praktikate OPUS-P1-6:** auditivabatekst kustutatakse avaldatud praktika autori kontoga, otsuse mittetundlik auditijälg säilib; `npm test` 1122/1122.
- **U4:** P1 ja kolm P2 parandatud; päring–mapper–UI integratsioon katab värske, aegunud, suletud ja kinnitamata teenuse; `npm test` 1097/1097 ja build korras.
- **U8-lite:** allika ID püsivus, kuue kuju invariant, ilma reload'ita tagasiside, vigase JSON-i 400 ja tühja sisu kinnitus parandatud; `npm test` 1093/1093, CSS eelarve 52/52 ja build korras.

U8-P2-1 — vestluse kustutamise mõju `SourceFeedback` märkusele — jääb teadlikuks tooteotsuseks. See ei muutu varjatult „valmis” otsuseks.

Enne commit/merge'i peab teostaja siiski:

- fikseerima iga parandusringi täpse diffi;
- kordama paketi lõppkontrolli, kui pärast üleandmist on faile muudetud;
- tegema selektiivse commit'i ilma kõrvaliste failideta;
- dokumenteerima, et Opuse kordusaudit jäeti kasutaja otsusel tegemata;
- hoidma deploy eraldi selge loa taga.

## 3. U1/U2 read-only Etapp 0 eelkaardistus

See töö algab kohe. See ei tohi muuta koodi, skeemi ega migratsioone.

Loe täielikult:

- `docs/platvormi arendus/10-u1-u2-sundmused-teavitused-jatka-siit-tooplaan-ja-progress.md`;
- `docs/platvormi arendus/fable-5-avastamata-vajadused-ja-uued-voimalused.md` U1 ja U2;
- aktiivne `prisma/schema.prisma`;
- `lib/workspaceDashboardCards.js` ja selle kasutajad;
- eelpöördumise, ruumi, sobituse, Teekonna, Tööheaolu ja maileri aktiivne kood;
- Parimate praktikate scheduler'i ning U4 reminder'i lõppkuju nende worktree'dest ainult read-only;
- job-route, latest-request, avaliku vea ja konto kustutamise aktiivsed mustrid.

Koosta eelkaardistus, mis vastab vähemalt:

1. kus tekib iga esimese versiooni sündmus;
2. milline sündmus peab sündima samas DB tehingus;
3. milline dedupe-võti on iga sündmuse jaoks deterministlik;
4. milline on minimaalne `NotificationEvent` skeem ja indeksid;
5. kuidas lahendada email delivery claim/CAS ning crash-after-send risk;
6. kuidas ruumisõnumid koondada ilma ühe kirjata iga sõnumi kohta;
7. millal sündmus loetakse loetuks;
8. kuidas `workspaceDashboardCards` badge-konks päriselt toidetakse;
9. kuidas „Jätka siit” koondab kuni seitse kirjet ilma ristrolli lekketa;
10. milline aktiivne checklist kannab järgmise kontakti kuupäeva;
11. millised U3/U4/U8/P1 harude lepingud peavad enne U1/U2 algust olema `main`-is;
12. millised tööplaani nõuded on aktiivse koodiga vastuolus või liiga laiad.

Väljund peab olema read-only arhitektuuriaudit, mitte teostus. Soovituslik fail:

`docs/platvormi arendus/13-opus-u1-u2-etapp-0-eelkaardistus.md`

Ära märgi Etapp 0 lõplikult teostatuks enne, kui vajalikud sõltuvusharud on `main`-i ühendatud. Märgi iga järeldus kas:

- `MAIN-IST KINNITATUD`;
- `HARUST KINNITATUD`;
- `VAJAB PÄRAST MERGE'I UUESTI KONTROLLI`.

## 4. Fable'i allesjäänud U5/U6/U7/U9/U11 ajakohastatud audit

Pärast U1/U2 eelkaardistust võrdle Fable'i ülejäänud teostamata nimekirja aktiivse koodiga:

1. U5 — teenusepuudujäägi märge ja anonüümne koond;
2. U6 — isiklik otsing enda objektide üle;
3. U7 — selge keele režiim;
4. U9 — tugiisiku kaasamise rada;
5. U11 — töö üleandmine kolleegile.

Iga töö kohta anna:

- mis on vahepeal juba olemas;
- milline Fable'i eeldus on vananenud;
- väikseim ohutu vertikaal;
- rollid ja privaatsuspiir;
- sõltuvused U1/U2-st või teistest töödest;
- keerukus ja soovitatud järjekord;
- kas töö saab käia paralleelselt või puudutab samu faile.

Väljund on read-only ajakohastatud teekaardiaudit. Uut koodi ei kirjutata.

## 5. Katkestus- ja jätkamisreegel

Kui limiit või aknavahetus katkestab töö:

1. lõpeta pooleliolev lõik;
2. kirjuta väljundfaili täpne jätkamispunkt;
3. loetle täielikult loetud failid;
4. märgi kontrollimata oletused;
5. jätka samast punktist, mitte algusest.

## 6. Opuse hetkejärjekord

1. **Kohe:** U1/U2 Etapp 0 read-only eelkaardistus.
2. **Seejärel:** kontrollida ja täpsustada U1/U2 tööplaani, kuid mitte teostada koodi.
3. **Seejärel:** U5/U6/U7/U9/U11 ajakohastatud koodireaalsuse audit.
4. **Seejärel:** valmistada U7 eraldi tööplaani sisend, sest U7 on U1/U2 järel järgmine esmane kandidaat.
5. **Lõpus:** anda Solile U1/U2 teostuse sisend ja kasutajale uuendatud U1–U12 protsendivaade.

## 7. Progressipäevik

### 2026-07-14 — plaan loodud

- U12/U3 auditisiht on puhas ja push'itud commit `d2dd13e3`.
- U4 ja U8 parandusringid olid worktree'des commit'imata ning neid ei käsitleta enne Soli selget üleandmist stabiilse auditisihtmärgina.
- Parimate praktikate operatsioonipaketi parandusi teeb Sol põhitööpuus; Opus ei muuda selle koodi.
- Ooteaja produktiivseks kasutuseks lisati U1/U2 read-only eelkaardistus.
- Ühtegi rakenduskoodi, skeemi, migratsiooni ega testi selle plaani loomisel ei muudetud.

### 2026-07-14 — kasutaja muutis järelkontrolli otsust

- OPUS-P1-6, U4 ja U8-lite parandusi ei anta Opusele uueks kordusauditiks.
- Soli parandused aktsepteeritakse esitatud regressiooni- ja täiskontrolli tulemuste alusel.
- Pakette ei nimetata ekslikult `OPUS HEAKS KIIDETUD`; audit jäeti kasutaja otsusel kordamata.
- Opuse aktiivne töö algab U1/U2 read-only eelkaardistusega.
- Pärast U1/U2 kaardistab Opus U5/U6/U7/U9/U11 tegeliku hetkeseisu.

### Täidab Opus iga tööploki järel

- Kuupäev:
- Tööplokk:
- Auditeeritud haru/commit/diff:
- Kontrollid:
- Leiud:
- Verdikt:
- Solile antud parandused:
- Jätkamispunkt:
- Commit/push/merge/deploy seis:

### 2026-07-14 — OPUS tööplokk 2: U1/U2 arhitektuuri- ja privaatsusring

- **Kuupäev:** 2026-07-14, Europe/Tallinn.
- **Tööplokk:** ülesanne 2 — eraldi U1/U2 arhitektuuri- ja privaatsuskontroll (read-only).
- **Auditeeritud haru/commit/diff:** `main` @ `df2f45c0` + commit'imata P1 diff; read-only viide U4 harule `3208c08c`.
- **Kontrollid:** ainult lugemine. Kontrollisin `SOL-U1U2-P1-1` tõendiahela viis lüli ise koodist (`serializePreInquiry:487`, `:503–504`, `visiblePreInquiryWhere:539–546`, `listVisiblePreInquiries:548–559`, `getVisiblePreInquiry`, `app/api/pre-inquiries/route.js:36`, `app/api/pre-inquiries/[id]/route.js:45–51`, `WorkspaceFeaturePage.jsx:934/945/1037`) ning `preInquiryInclude` select-kuju. Testikatvuse kontroll: `grep` `tests/preInquiries/*` üle.
- **Leiud:**
  - `SOL-U1U2-P1-1` **KINNITATUD** — kõik viis Soli tõendilüli pidasid paika.
  - **`OPUS-U1U2-P1-1-EXT` (uus, minu leid):** sama vaatajakontekstita serializer väljastab ka mõlema poole **konto-e-postid** (`author.email` → vastuvõtjale, `recipientOwner.email` → autorile); `preInquiryInclude` valib need eksplitsiitselt. Audience-leping peab need teadlikult otsustama.
  - **Täpsustus mõjule:** leke on puhtalt API-tasemel — UI peidab märkme autori eest, seega tegu on täpselt doc 10 §3.4 („UI peitmine ei ole õigusekontroll") rikkumisega.
  - **Odav sulgeda:** ükski test ei lukusta praegust lekkivat kuju.
  - **Privaatsuslepingu kontroll:** §3.2, §3.3, §3.8, §3.9 on aktiivses koodis juba korrektsed pretsedendid; ainult §3.4 on rikutud.
  - **Neli arhitektuurilist lahknevust Soli §4.4 skeemist:** `occurredAt` üleliigne; `emailClaimToken` ilma tarbijata; kolmas indeks vale võtme peal (peab olema `[userId, sourceType, sourceId, readAt]`, sest read-marking käib allika järgi); `emailMessageId` nõuab `lib/mailer.js` muudatust ehk sama ringi kui OPUS-U1U2-P1-2.
  - Number-lahknevus: Sol „17 getMailer kutsekohta", minu kaardistus 15. Ei muuda järeldust.
- **Verdikt:** ülesanne 2 **VALMIS**. Uusi P0 ei ole. Mõlemad P1-d (`SOL-U1U2-P1-1` + `OPUS-U1U2-P1-2`) on **U2 ja U1-C eeltingimused**, mitte U1-A tuuma blokeerijad.
- **Solile antud parandused:** puuduvad (read-only plokk). Sulgemisnõuded on kirjas failis 13 §11.1 ja §11.3.
- **Jätkamispunkt:** ülesanne 3 — U5/U6/U7/U9/U11 sõltumatu audit aktiivse koodi vastu, kasutades faili 13 §6 kontrollnimekirjana.
- **Commit/push/merge/deploy seis:** TEGEMATA.

### 2026-07-14 — OPUS tööplokid 3–5: U5/U6/U7/U9/U11 audit, U7 sisend, U1–U12 progressihinnang

- **Kuupäev:** 2026-07-14, Europe/Tallinn.
- **Tööplokk:** ülesanded 3, 4 ja 5 (read-only).
- **Auditeeritud haru/commit/diff:** `main` @ `df2f45c0` + commit'imata P1 diff `b6847805`.
- **Kontrollid:** ainult lugemine. Kontrollisin Soli §6 iga väite ise koodist: skeemi `ServiceGapReport` puudumine; `lib/wellbeing/aggregate.js:36/116/140`; `app/api/chat/conversations/route.js:135–140`; `components/ChatSidebar.jsx:620–633`; `components/accessibility/AccessibilityProvider.jsx:12`; `lib/documents/generation.js:25/41`; `components/invite/InviteModal.jsx:298–305`; `app/api/invites/route.js:355/477/518/533`; `enum RelationshipType`; `enum RoomRole`; `schema:2710`; `lib/preInquiries.js:803/810/876`; `lib/covisionCompletedCases.js:391–392`.
- **Leiud:**
  - **Kõik Soli §6 väited KINNITATUD** — ükski ei osutunud vääraks (doc 13 §12.1 tabel).
  - **Opuse lahknevus 1 (U9):** `Invite.relationshipType` on **kirjutuse-ainult väli ilma tarbijata** — ükski otsus ei loe seda. `CLIENT` seadmine ei muuda ühtegi õigust. U9 v1 väärtus on **ainult copy/UX**, mitte mehhanism. Test, mis kinnitab `relationship_type: CLIENT`, on tuleviku-metaandme leping, mitte turvatest.
  - **Opuse lahknevus 2 (U6):** praegune otsing ei ole ainult „kitsas" — see on **eksitav**. Filter jookseb ainult laetud lehel (vaikimisi `limit=30`), seega 200 vestlusega kasutaja saab olemasoleva vestluse kohta **vale negatiivse**. Ruume ei filtreerita üldse. → tõstan U6 prioriteeti Soli hinnangust kõrgemale.
  - **Opuse täiendus 3 (U6):** serveripoolset otsingumustrit ei pea leiutama — `lib/covisionCompletedCases.js:391–392` teeb juba mitme välja `OR` + `contains`/`mode:"insensitive"` omanikuskoobi sees.
  - **U7 sisend (ülesanne 4):** kinnitan Soli §7 struktuuri; neli Opuse muudatust — golden-testid vajavad masinloetavat negatiivset invarianti; **U7-D (dokumendid/U10) v1-st välja** (tone = dokumendi omadus, plainLanguage = lugeja omadus); lisada regressioonitest, et `plainLanguage` ei ole seotud teenuseosutaja `simple_language` filtriga; **U7 võib alata U1/U2-st sõltumatult ja paralleelselt**.
  - **U1–U12 progressihinnang (ülesanne 5):** funktsionaalne valmidus **≈46 %** (5,5/12), lõplik valmidus **≈8 %** (1/12, ainult U10), deploy **0/12**. **Peajäreldus: kitsaskoht ei ole arendus, vaid integratsioon** — viis paketti on koodina valmis ja null neist on `main`-is.
- **Verdikt:** ülesanded 3, 4 ja 5 **VALMIS**. Uusi P0/P1 ei leitud (mõlemad P1-d pärinevad plokist 2).
- **Solile antud parandused:** vt allolev üleandmine.
- **Jätkamispunkt:** Opuse ülesanded 2–5 on **lõpetatud**. Järgmine Opuse töö on Soli teostuse sõltumatu audit doc 10 §16 järgi — see algab alles pärast Soli teostust.
- **Commit/push/merge/deploy seis:** TEGEMATA. Muudetud ainult dokid 10, 12, 13.

---

## 8. OPUSE ÜLEANDMINE SOLILE — U1/U2 teostuse sisend

> Koostatud pärast Opuse ülesannete 2–5 lõpetamist. Kõik viited on kontrollitud `main` @ `df2f45c0` + commit'imata P1 diff `b6847805` vastu.

### 8.1 Enne koodi — integratsioon on esimene

**Ära alusta U1/U2 teostust praegusest seisust.** Viis paketti on koodina valmis ja **null neist on `main`-is**. U1/U2 §7 kaheksast sündmusest kolme lähtefakti ei eksisteeri `main`-is (`openedAt`/accept → U3; kättesaadavus → U4; praktika markerid → commit'imata P1).

Järjekord: **U3 + P1 → `main`** (kohustuslik) → U4 + U8 → clean migration check → alles siis U1-A.
Migratsioonide märkus: U3 `20260714220000_pre_inquiry_recall_and_correction` ja U8 `20260714220000_source_feedback_trust_layer` on **sama ajatempliga**; P1 `20260714230000` on juba peapuu kaustas. Merge'i järel kinnita deterministlik järjekord `npm run db:migrate:check`-iga.

### 8.2 Esimesed kaks tööd EI OLE NotificationEvent

**1. `SOL-U1U2-P1-1` + `OPUS-U1U2-P1-1-EXT` — audience-aware eelpöördumise serializer.**
- `lib/preInquiries.js:487` `serializePreInquiry(inquiry, { viewerId })` või kaks eraldi serializerit;
- `receiverNote` (`:503`), `receiverChecklist` (`:504`) ja tulevane `nextContactOn` **ainult** kui `viewerId === recipientOwnerId`;
- **Opuse lisanõue:** sama leping peab katma `author.email` (`:522–528`) ja `recipientOwner.email` (`:529–535`) — `preInquiryInclude` valib mõlemad eksplitsiitselt. Vaikesoovitus: kumbki pool ei saa teise **konto-e-posti**; autor näeb adressaati `recipientEntry.email` (avalik) kaudu;
- tarbijad: `app/api/pre-inquiries/route.js:36`, `app/api/pre-inquiries/[id]/route.js:45–51`, workflow-mutation ja U3 accept/correction vastused;
- **hea uudis:** ükski olemasolev test ei lukusta praegust kuju → parandus ei lõhu midagi.

**2. `OPUS-U1U2-P1-2` — mailer fail-closed.**
- `lib/mailer.js:273–289` — tootmises puuduv transport peab **viskama klassifitseeritava vea**, mitte tagastama `createDevTransporter()`-it;
- `:59–69` dev-mock: explicit opt-in, ei logi `to` ega body't;
- **tee samas ringis:** `Message-ID` peab olema kutsuja antav (praegu `Date.now() + Math.random()`), sest U1 `emailMessageId` sõltub sellest.

### 8.3 Opuse parandused Soli §4.4 skeemile

Enne migratsiooni kirjutamist rakenda need (põhjendused doc 13 §11.3):

1. **eemalda `occurredAt`** — võrdub alati `createdAt`-iga, sest tulevikusündmust ei looda ette;
2. **eemalda `emailClaimToken`** — CAS teeb `updateMany({ where: { id, emailStatus: "PENDING" } })` → `count === 1`; token oleks vajalik ainult auto-taastega, mille §4.5 p7 välistab;
3. **kolmas indeks peab olema `@@index([userId, sourceType, sourceId, readAt])`**, mitte target-põhine — §4.7 read-semantika märgib loetuks **allika** järgi (ruumi read → selle ruumi sündmused);
4. `emailMessageId` jääb, aga sõltub §8.2 punktist 2.

### 8.4 Mida saab kohe teha, kui merge blokeerub

**U7 võib alata täna** — see ei puuduta ühtegi U1/U2 ega merge'imata haru faili (`AccessibilityProvider`, prompt builder, chat request bootstrap). Kui U3/U4/P1 merge venib, on U7 ainus lukus otsusega töö, mis ei oota kedagi. Opuse sisend: doc 13 §13.

### 8.5 Mida MITTE teha

- ära ehita `NotificationEvent`-i enne §8.2 kahe paranduse sulgemist — muidu läheb privaatne „järgmine kontakt" lekkiva serializeri ja näiliselt õnnestuva transpordi peale;
- ära instrumenteeri `roomMessage.create`-i — kirjutajaid on vähemalt kolm ja tee on lukuta; digest tuleb scheduler'ist;
- ära loo `Invite.relationshipType` põhjal ühtegi õigusekontrolli — väljal ei ole tarbijat;
- ära eelda `PreInquiry.version`-it — seda ei ole; samaaegsuse muster on `sameUpdatedAtFingerprint` (`lib/preInquiries.js:619`).

### 8.6 Tooteotsused, mis peavad olema tehtud enne vastavat plokki

1. e-kirjatüüpide legacy/transactional vs optional-preference jaotus (U1-C);
2. ambiguous SMTP `SENDING` → fail-closed `UNKNOWN` (Opuse soovitus) või auto-retry duplikaadiriskiga (U1-C);
3. kes saab `REVIEW_DUE` kasutajamärguande, kui reviewer puudub (U1-B);
4. kas U4 või U1 omab kättesaadavuse kirja — **kaks saatjat ei tohi kõrvuti eksisteerida** (U1-B);
5. U5 k-lävi ja nähtavus (soovitus: ainult admin, `k >= 5`);
6. U11 vana/uue adressaadi ruumiligipääs.
