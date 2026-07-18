# ORG-A0 — organisatsioonikiht, privaatsusturvaline analüütika ja terviklik ORG-V1 arendusleping

Ülesanne: **ORG-A0** (tulevikufunktsioonide süvaanalüüside register, rida 8; masterregistri teema **T25 `ORG-V1`**)
Kuupäev: **2026-07-17**
Koostaja: Fable 5 (analüüsirada)

Kontrollitud Git-baas:

- kohalik põhitööpuu `main @ 0da4185bfd171b5b25d684aaed8fb5239a371275` — määrdunud; EI kasutatud arenduse ega analüüsi baasina peale read-only lugemise;
- `origin/main @ fe4eb4fa7997a7eada9417a27c6cea75ccd23cbe` — kanooniline kood- ja serveriseis (handoff'i kontroll 17.07);
- väljundfail `fable-5-organisatsiooni-analuutika.md` puudus töö alguses (Glob-kontroll); failikokkupõrget ei tekkinud.

**ANALYSIS STATUS: COMPLETE**
**DEVELOPMENT READINESS: ANALYSIS_READY** (koodi võib alustada kohe; kolm otsust piiravad ainult *aktiveerimist*, mitte ehitust — vt ptk 20)

Lubatud kirjutusala: AINULT käesolev fail. Jagatud registreid (`arendusteemade-masterregister.md`, `fable-5-tulevikufunktsioonide-suvaanaluusi-programm.md`, `koordinaatori-handoff-2026-07-16.md`, `platvormi-arendusprogramm-2026-07-17.md`) EI muudetud — soovitatavad registritekstid on ptk 21.

Kinnitus: rakenduskoodi, Prisma skeemi, migratsioone ega teste ei muudetud; serverit, andmebaasi ega väliseid teenuseid ei käivitatud; tootmisandmeid ega kasutajasisu ei loetud; ei commit'itud, push'itud, merge'itud ega deploy'tud.

## Edenemistabel

| # | Etapp | Seis | Tulemus |
|---|---|---|---|
| 1 | Tõeallikate ja failikokkupõrke kontroll | TEHTUD | päis + ptk 0 |
| 2 | Kohustuslikud sisendid (masterregister, analüüsiregister, lisavastused, WELLBEING-V2-A0, admini analüütika) | TEHTUD | läbivalt viidatud |
| 3 | Sihitud sisendid (TH tervikloogika, COLLAB, CASEWORK, K1/U1, Teenusekaart, RUUM-VIS, usaldusmudel, EXPORT) | TEHTUD | läbivalt viidatud |
| 4 | Sihitud koodiinventuur (skeem, allowlist/capability/audit mustrid, agregaat, sponsor-väljad) | TEHTUD | ptk 0 |
| 5 | Organisatsiooni tähendus ja V1 piir | TEHTUD | ptk 1 |
| 6 | Elutsükkel ja olekumasinad | TEHTUD | ptk 2 |
| 7 | Osalised ja capability-maatriks | TEHTUD | ptk 3 |
| 8 | Kõvad privaatsusinvariandid ORG-INV-1…12 | TEHTUD | ptk 4 |
| 9 | Minimaalne andmemudel (5 tabelit) | TEHTUD | ptk 5 |
| 10 | Omandimaatriks | TEHTUD | ptk 6 |
| 11 | Üleandmine, asendamine, ühine teenuseprofiil | TEHTUD | ptk 7 |
| 12 | Koondandmete allikakataloog | TEHTUD | ptk 8 |
| 13 | K-anonüümsus ja tuvastamisvastane leping + ründetestid | TEHTUD | ptk 9 |
| 14 | Tööheaolu koond org-vaates | TEHTUD | ptk 10 |
| 15 | Meetodipeegel, koostöö, Supervisioon (O-CW-6, O-CO-9) | TEHTUD | ptk 11 |
| 16 | Baromeetri tooteleping | TEHTUD | ptk 12 |
| 17 | Kasutajaliides ja navigatsioon | TEHTUD | ptk 13 |
| 18 | Sündmused, teavitused, audit | TEHTUD | ptk 14 |
| 19 | Eksport, säilitamine, lõpetamine | TEHTUD | ptk 15 |
| 20 | Variandivõrdlus A/B/C + soovitus | TEHTUD | ptk 16 |
| 21 | Otsustabel (max 3 blokeerivat) | TEHTUD | ptk 17 |
| 22 | Üks terviklik ORG-V1 arendusülesanne | TEHTUD | ptk 18 |
| 23 | Testimaatriks | TEHTUD | ptk 19 |
| 24 | Arendusvalmiduse lõpphinnang + registritekstid + jätkamispunkt | TEHTUD | ptk 20–22 |

## 0. Tõeallikad ja sihitud koodiinventuur (read-only, 2026-07-17)

### 0.1. Dokumendid

Täies mahus: `arendusteemade-masterregister.md`; `fable-5-tulevikufunktsioonide-suvaanaluusi-programm.md`; `fable-5-lisavastused-organisatsioon-ja-piloot.md` (varasem kahe tabeli soovitus + neli päästikut); `fable-5-tooheaolu-v2-iganadalane-pusiruum.md` (W-INV-1…8, A1–A5 auguanalüüs, O-WB-1…5); `fable-5-admini-analuutika-haldus-ja-koondvaated.md` (capability-leping ptk 4.3, basis-leping ptk 10.1, org_steward „teadlikult hiljem").
Sihitult: TH tervikloogika (I1 täidetud; TO-1…10 lahtised); COLLAB-A0 (ORG_META [TULEVIK], O-CO-9; cross-tenant = teadlik puudumine; org = tekstiväli osalejakaardil); CASEWORK-A0 (O-CW-6 vaikekeeld); K1-U1 (nähtavusklass ORG_META blokeeritud; org-analüütika = AINULT k-anonüümsed koondid U1 sündmustest; klassitõstmine ainult kasutaja kinnitusega); Teenusekaart (profiili 1:1 unikaalsus; liit-ID viga V3); RUUM-VIS 6.12 („vaatetorn, mitte valvekaamera"; töötajad näevad sama koondit; U5 esimene samm org-mudelita); usaldusmudel (privaatne vaikimisi, jagamine eesmärgipõhine, ligipääs ajaga seotud); EXPORT-A0 (E-1 andmekoopia puudub; auditijälg elab konto kustutuse üle; manifest-muster).

### 0.2. Koodileiud (kõik `origin/main @ fe4eb4fa` / kohalik peegel, read-only)

| Pind | Leid | Tähendus ORG-ile |
|---|---|---|
| `Role` enum (schema:12) | `ADMIN, SOCIAL_WORKER, SERVICE_PROVIDER, CLIENT` — org-rolli EI OLE | organisatsioon EI tule uue põhirollina; kinnitab lähtehüpoteesi |
| `User` (646–750) | ei ühtegi org-välja; `isAdmin` lame lipp; `serviceProviderProfiles[]` seos | liikmesus tuleb eraldi tabelist, mitte User'i väljast |
| `OrganizationAdmin` (1611) + `MunicipalityKovAdmin` (1532) | crawl/ingest/RT-väljad — **RAG-allikate registrid, MITTE kasutajaorganisatsioonid** | nimekonflikt on reaalne; uus kiht vajab teadlikult teist nime (ptk 5.6) |
| `RoomMember.sponsorOrgId` (2812), `Invite.sponsoredByOrgId` (2835) | `String?` ilma FK-ta; `resolveSponsor` (invites/route.js:270) tagastab ALATI `orgId: null` | rippuvad väljad = ootus, mitte toimiv kiht; V1 saab need ohutult FK-ks siduda (väärtusi pole) |
| `BillingSource` (577) + `InvitePaymentMode` (572) | ainult `SELF` ja `SPONSORED_BY_HOST` — org-arvelduse väärtust pole | org-arveldus EI ole täna maksetorus; V1 ei ehita seda (ptk 5.5) |
| `WellbeingPilotScope` (1294) | `municipalityId?/organizationId?` stringid FK-ta; `minimumGroupSize @default(3)`; `WellbeingPilotViewer` userId/email allowlist | parim olemasolev „skoop + eksplitsiitne vaataja" muster; org-kiht asendab stringi FK-ga, EI asenda vaatajagranti |
| `resolveWellbeingPilotAccess` (lib/wellbeing/pilotAccess.js) | admin → täisligipääs ilma roleGroup-piirita; DB-viewers ajaaknaga; env-fallback | kahe võtme põhimõte on pooleldi olemas; admini piiramatus on O-WB-2 auditilogi vajaduse põhjus |
| `buildWellbeingAggregateDataset` (lib/wellbeing/aggregate.js, 175 r) | k-lävi eristuvatel omanikel, kõik-või-mitte-midagi summutus, `suppressed/suppressionReason`, mõõdikud kirjepõhised | koondimootori alus; A1–A5 augud (WELLBEING-V2-A0 ptk 4.3) tuleb org-suunal sulgeda ENNE avamist |
| `ServiceProviderProfile` (1663) | `@@unique([ownerId])` 1:1; `organizationName/registryCode` tekstiväljad; `ServiceMapEntry?` 1:1 | mitme töötajaga teenuseosutaja murdekoht; org-link + toimetaja-capability lahendab ilma unikaalsust lõhkumata |
| `CovisionVisibility.ORGANIZATION` (353) | väärtus on skeemis ja `lib/covision.js:365` võtab vastu, aga ükski lugemistee seda ei jõusta (org-seost pole) | surnud väärtus (max-täienduse C1); ORG-V1 EI ärata seda — Kovisiooni sisu jääb org-ile suletuks (ptk 11) |
| `PracticeCapability` (2382) + `PracticeCapabilityAudit` | `type, scope, validFrom/validUntil, revokedAt, grantBasis, grantedByUserId` + audititabel | **kanooniline capability-muster** — org-capability kordab seda kuju (ptk 5.3) |
| `UserEntitlementOverride` (880) | `reason` kohustuslik, `validUntil`, `createdByAdminId onDelete: Restrict` | grandi-auditimuster; sama distsipliin org-capability'tele |
| `DataAuditLog` (1416) | actor/target/action/resource/meta, FK-ta stringid (elab kustutuse üle) | org-auditikirjed lähevad SIIA, mitte uude tabelisse |
| `NotificationEvent` (1912) + `lib/notifications.js` | 9 tüüpi (PRE_INQUIRY_*, ROOM_*, HELP_MATCH_CREATED, PRACTICE_REVIEW_*, SERVICE_AVAILABILITY_STALE), `dedupeKey @unique`, `emailPolicy`, timer töötab toodangus iga ~5 min | org-sündmused lisanduvad OLEMASOLEVASSE kihti uute tüüpidena; uut teavitusmootorit ei ehitata |
| `Municipality` (1511) | seeditud KOV-register slug/type/county | `Organization.municipalityId` saab päris FK sihtmärgi |
| `Invite` olekud (559) | `PENDING_PAYMENT/SENT/ACCEPTED/EXPIRED/REVOKED` + `tokenHash @unique` + `expiresAt` + `maxUses` | org-kutse kordab sama olekumasinat ja tokenimustrit |
| `assertAdmin` (lib/authz.js:106) | üks lame `isAdmin`-värav kõikjal | org-kontrollid EI tohi seda mustrit kopeerida; kahe võtme kontroll on teenuskihi funktsioon |
| `PreInquiry` (1864) | `recipientOwnerId` = üksikkasutaja; staatusemasin DRAFT→READY→SENT→… | üleandmise väikseim päris vertikaal = adressaadi vahetus org-i sees (ptk 7.2) |

**Kohustusliku lähtekoha kontroll (ülesande nõue):** kõik viis eeldust said koodist kinnituse — `OrganizationAdmin`/`MunicipalityKovAdmin` on RAG-haldus; `sponsorOrgId`-väljad ei tõenda kihti (alati null); org ei ole uus põhiroll (Role enum); platvorm ei ole tenant-põhine (kõik omandipiirded on isiku- või osalejapõhised); `MANAGER`/org-admin ei tõuse kuskil `ADMIN`-iks (isAdmin on eraldi lipp, mida org-kiht ei puuduta).

---

## 1. Organisatsiooni tähendus ja piir

### 1.1. Mõisted, mida V1 peab eristama

| Mõiste | Mis see on SotsiaalAI vaates | V1 käsitlus |
|---|---|---|
| KOV tervikuna | juriidiline isik (linn/vald), kelle all on mitu valdkonda | EI ole V1 org-üksus; liiga suur — koond seguneks üle osakondade |
| KOV-i osakond (sotsiaaltööosakond) | tegelik tööüksus, kus töötajad üksteist tunnevad ja tööd üle annavad | **V1 põhijuht** — `Organization` kirje, `type: KOV_UNIT`, seotud `municipalityId`-ga |
| Mitme töötajaga teenuseosutaja | äriühing/FIE-de rühm ühise teenuseprofiiliga | **V1 teine põhijuht** — `type: SERVICE_PROVIDER_ORG`; ainus juht, kus vajadus on juba täna (profiili 1:1 piirang) |
| MTÜ vm partner | vabaühendus, kes osutab/vahendab abi | V1 lubatud (`type: NGO`), sama mehaanika |
| ESTA-laadne erialapartner | erialaliit, mitte tööandja | EI ole V1 org — ESTA-MENTOR-A0 otsustas: väline viide, mitte konteiner; `type: PROFESSIONAL_ASSOCIATION` on enumis RESERVEERITUD, aga V1 ei aktiveeri ühtegi sellist |
| Sponsoreeriv/arveldav organisatsioon | asutus, kes maksab töötajate/kutsutute eest | V1-s AINULT viitena (sponsor-väljade FK); päris org-arveldust ei ehitata (ptk 5.5) |

### 1.2. V1 piiriotsused (soovitused koos põhjendusega)

1. **Organisatsioon = tööüksus, mille taga on juriidiline isik; hierarhiat EI ole.** `Organization` tähistab üksust, millel on ühine liikmeskond, ühine töökorraldus ja (soovi korral) ühine koond. KOV-i puhul on see osakond (`type: KOV_UNIT` + `municipalityId` + `name` nt „Tartu LV sotsiaaltööosakond"); teenuseosutaja puhul juriidiline isik ise (`registryCode`). `legalName`/`registryCode` väljad kannavad juriidilise isiku seose; eraldi „ema-organisatsiooni" kirjet ega `parentId`-d V1-s EI OLE. Kui üks KOV tahab kaht osakonda, luuakse kaks organisatsiooni — nende koonde EI summeerita (ristorganisatsiooniline võrdlus on keelatud, ptk 9.9). See on täpselt „õhuke liikmesuskiht", mida lisavastuste dokument soovitas, ühe täpsustusega: üksuse-semantika fikseeritakse kirje TASEMEL (type + väljad), mitte hierarhiana.
2. **Kasutaja võib kuuluda mitmesse organisatsiooni.** Reaalne juht: sotsiaaltöötaja töötab osakoormusega kahes KOV-is; superviisor kuulub teenuseosutajasse ja MTÜ-sse. Skeemi tasemel: mitu aktiivset `OrganizationMembership` rida eri org-idele on lubatud; sama org-i sees on aktiivseid liikmesusi täpselt üks (osaline unikaalindeks, ptk 5.2).
3. **Aktiivne organisatsioonikontekst on kasutajaliidese valik, mitte sessiooni omadus.** Iga org-vaate URL kannab `orgId`-d (`/org/[orgId]/…`); server valideerib IGAL päringul liikmesuse + capability — konteksti ei salvestata sessioonisse ega usaldata kliendilt (sama loogika, millega rollivahetaja RV-P0 on fail-closed). Vahetus = navigeerimine teise org-i URL-ile; „viimati kasutatud org" võib olla kliendipoolne mugavuseelistus, mitte õiguste allikas.
4. **Organisatsioon on liikmesuskiht, MITTE tenant.** Ükski olemasolev objekt (vestlus, Teekond, dokument, ruum, juhtum, heaolukirje) EI saa org-välja ega org-nähtavust selle analüüsi tulemusena. Org-kiht lisab AINULT: (a) org-i enda objektid (liikmesus, kutse, capability, koondiperiood, seaded), (b) FK sihtmärgi kolmele rippuvale väljale, (c) valikulise lingi teenuseprofiilile. Tenant-variandi tagasilükkamise põhjendus on ptk 16.
5. **Lähtehüpoteesi kontrolli tulemus:** hüpotees „õhuke liikmesuskiht, mitte tenant ega personalisüsteem" PEAB paika, kahe kohustusliku lisandusega, ilma milleta kiht ei oleks terviklik: (a) capability-kandja liikmesuse küljes (ilma selleta korduks admini „ühe lameda õiguse" viga org-tasandil), (b) külmutatud koondiperioodid (ilma nendeta ei ole tuvastamisvastane leping ptk 9 jõustatav). Need kaks on põhjus, miks V1 andmemudel on viis tabelit, mitte kaks (ptk 5).

### 1.3. Vastus põhiküsimusele (kokkuvõte, mida ülejäänud dokument tõestab)

Väikseim terviklik organisatsioonikiht = **5 tabelit + capability-kontrollid teenuskihis + fikseeritud-vaadetega koondimootor + org-navigatsioon**, kus: liikmesus annab vaikimisi ainult kaks asja (nähtavus kolleegide valikuloendis + loendatavus k-anonüümses koondis kehtiva nõusoleku korral); kõik muu on eksplitsiitne capability; ükski org-õigus ei ava ühtegi isiklikku ega osalejapõhist sisu (arhitektuuriliselt — vastavaid päringuteid ei eksisteeri); ja organisatsioonile suunatud koond avaneb alles eraldi feature-gate'i + õigusotsuse järel.

---

## 2. Organisatsioonitüübid ja elutsükkel

### 2.1. Organisatsiooni olekumasin

```
DRAFT ──(taotlus esitatud)──► PENDING_VERIFICATION ──(admin kinnitab identiteedi/registriinfo)──► ACTIVE
  │                                   │ (tagasi lükatud)                                            │
  └──(loobumine)──► kustutus          └──► REJECTED (lõppseisund; kirje säilib auditi jaoks)        │
                                                                                                    ▼
                                                            SUSPENDED ◄──(admin, põhjusega)──── ACTIVE
                                                                │  └──(taastamine)──► ACTIVE
                                                                ▼
                                                            ARCHIVED ──(retention möödas + omaniku taotlus)──► DELETED (purge)
```

- **Loomine:** taotluse esitab tulevane omanik (SOCIAL_WORKER või SERVICE_PROVIDER rolliga kasutaja); DRAFT on nähtav ainult loojale ja adminile.
- **Kinnitamine:** `PENDING_VERIFICATION → ACTIVE` on platvormi admini klass-A toiming (reason + audit): kontrollitakse nime, tüüpi, KOV-seost/registrikoodi vastavust äriregistri/KOV-i avalikule infole. See on identiteedivärav — ilma selleta saaks igaüks luua „Tartu sotsiaaltööosakonna" ja kutsuda inimesi.
- **SUSPENDED:** kõik org-vaated suletud, liikmesused jäävad (mitte ENDED), koonde ei arvutata, kutsed peatatud. Kasutus: väärkasutuse kahtlus, partnerlepingu vaidlus.
- **ARCHIVED:** read-only; liikmesused lõpetatakse (`endedReason: ORG_ARCHIVED`); avaldatud koondiperioodid säilivad; uusi ei arvutata.
- **DELETED:** purge pärast retention'i (ptk 15.4); auditikirjed jäävad (DataAuditLog on FK-ta).

### 2.2. Liikmesuse olekumasin

```
(OrganizationInvite ACCEPTED) ──► ACTIVE ⇄ SUSPENDED ──► ENDED(endedReason: LEFT | REMOVED | ORG_ARCHIVED)
```

- Liikmesus tekib AINULT kutse vastuvõtust (või org-i loomisel loojale endale). Adminil ega org-omanikul ei ole „lisa kasutaja e-postiga otse" teed — kasutaja nõusolek on alati vahel.
- `SUSPENDED` (liikme ajutine peatamine, nt pikk puhkus): liige ei ilmu kolleegide valikuloendis ega saa org-vaateid avada; capability'd ei kehti (kontroll nõuab ACTIVE liikmesust); intervall EI katke (`endedAt` jääb null-iks) — koondiarvestuses on ta jätkuvalt selle org-i inimene.
- `ENDED` on lõplik: taasliitumine = uus kutse = UUS liikmesuserida. Nii säilib intervallajalugu (`startedAt/endedAt`) katkematuna — see on Tööheaolu perioodikoondi õigsuse alus (ptk 10.3).
- Lahkumine (`LEFT`) on liikme enda toiming, alati lubatud, kinnitusdialoogiga; eemaldamine (`REMOVED`) nõuab MEMBER_ADMIN capability't + põhjust + auditit. Mõlemad lõpetavad hetkeliselt kõik selle liikmesuse capability'd (revokedAt = endedAt) ja eemaldavad liikme valikuloendist.

### 2.3. Kutse olekumasin

```
SENT ──► ACCEPTED | DECLINED | EXPIRED | REVOKED      (Invite-mudeli pretsedent, sama tokenHash/expiresAt muster)
```

- Kutse saadab MEMBER_ADMIN/OWNER; e-posti põhine, `tokenHash @unique`, vaikimisi 7 päeva aegumine, `maxUses: 1`.
- Vastuvõtt nõuab sisselogitud kontot, mille e-post klapib kutsega (või kutse lunastamist sisselogimisjärgselt — sama voog mis ruumikutsel); vastuvõtul EI anta ühtegi capability't — ainult MEMBER-liikmesus (kahe võtme põhimõte: õigused antakse eraldi sammuna pärast liitumist).
- REVOKED enne vastuvõttu on kutsuja/liikmehalduri toiming; korduskasutus on välistatud `useCount/maxUses` + lõppseisundi kontrolliga.
- Keeldumine (DECLINED) salvestub; org näeb ainult seisundit, mitte põhjust.

### 2.4. Organisatsiooni teenuseprofiili olekumasin (link, mitte uus profiil)

```
UNLINKED ──(omanik seob profiili org-iga; OWNER kinnitab)──► LINKED ──(omaniku vahetus org-i sees)──► LINKED
   ▲                                                            │
   └──(org ARCHIVED → link katkeb, profiil jääb omanikule)──────┘
```

`ServiceProviderProfile` ise säilitab oma `DRAFT|PUBLISHED|HIDDEN` masina — org-kiht ei muuda seda; lisandub ainult `organizationId?` ja mitme toimetaja õigus (ptk 7.3).

### 2.5. Koondiperioodi olekumasin

```
(kalendrikuu/kvartal lõppeb) ──► PENDING ──(arvutus)──► PUBLISHED | SUPPRESSED
                                                            │
                                     RECALLED ◄─(ainult platform_admin, klass B, põhjusega — arvutusvea korral)
```

- `PUBLISHED` on külmutatud: hilisemad kirjekustutused, nõusoleku muutused ega liikmeliikumised seda EI muuda (anonüümne agregaat, mitte isikuandmed; ptk 9.6 põhjendus).
- `SUPPRESSED` on võrdväärne avaldamata jätmisega — salvestub fakt „alla läve", MITTE osalised arvud.
- Jooksva (lõpetamata) perioodi vahekoondit EI eksisteeri üheski vaates (ptk 9.6).

---

## 3. Osalised ja capability-maatriks

### 3.1. Põhimõte

Püsivaid org-rolle on täpselt ÜKS: liige (MEMBER — liikmesuserida ilma ühegi capability'ta). Kõik muu on vajaduspõhine, tähtajastatav ja tagasivõetav **capability** liikmesuse küljes (`PracticeCapability` musterkuju: type + validFrom/validUntil + revokedAt + grantBasis + grantedBy + audit). Capability kehtib AINULT koos ACTIVE liikmesusega — see ongi kahe võtme põhimõtte tehniline kuju: iga kontroll = `activeMembership(orgId, userId) AND capability(type)`.

V1 capability-tüübid: `OWNER`, `MEMBER_ADMIN`, `PROFILE_EDITOR`, `ANALYTICS_VIEWER`, `BILLING_MANAGER`. Meeskonnajuht/osakonnajuht EI ole capability — hierarhiat pole; „juht" on inimene, kellele org on andnud ANALYTICS_VIEWER-i ja/või MEMBER_ADMIN-i.

### 3.2. Maatriks

| Osaline | Saab luua/muuta | Näeb | EI näe KUNAGI | Õiguse teke | Aegumine/eemaldus | Auditijälg | Kaks võtit? |
|---|---|---|---|---|---|---|---|
| **Tavaline liige** (MEMBER) | oma lahkumise; oma kirjete nõusolekud (nagu seni) | org-i nime/tüüpi, liikmete NIMEKIRJA (nimi+roll valikuloendi tarbeks), enda liikmesuse seisu, org-i AVALDATUD koondit (ideed 21.4: töötajad näevad SAMA koondit mis juht) | teiste liikmete isiklikku sisu, kasutusfakte, kutsete e-poste, capability-põhjuseid | kutse vastuvõtt | lahkumine/eemaldamine → kõik lõpeb hetkeliselt | liitumine/lahkumine DataAuditLog | — (liikmesus ise ON esimene võti) |
| **Liikmehaldur** (MEMBER_ADMIN) | kutsed (saatmine/revoke), liikme eemaldamine/peatamine, capability'te andmine v.a OWNER | + kutsete seisud (e-post nähtav ainult kutse kontekstis), liikmesuste ajalugu | liikmete sisu; koondit ILMA ANALYTICS_VIEWER-ita | OWNER/teine MEMBER_ADMIN annab, reason kohustuslik | validUntil või revoke; liikmesuse lõpp | iga grant/revoke/eemaldus + reason | JAH |
| **Omanik/peavastutaja** (OWNER, täpselt 1 aktiivne) | kõik MEMBER_ADMIN-i õigused + omaniku üleandmine + org-i arhiveerimistaotlus + profiili sidumine | sama mis MEMBER_ADMIN | sama keeld — omandus EI ava sisu ega koondit ilma ANALYTICS_VIEWER-ita | org-i loomisel; hiljem üleandmisega (uus omanik KINNITAB — O-CO-3 muster) | üleandmine on ainus tee; OWNER-it ei saa revoke'ida, ainult üle anda | omanikuvahetus = eraldi auditiklass + U1 sündmus liikmetele | JAH |
| **Arvelduse haldur** (BILLING_MANAGER) | V1-s: näeb org-iga seotud sponsoreeritud kutsete/tellimuste SEISU (mitte maksevahendeid) | sponsorlusseosed, summad koondina | kasutajate kasutusstatistikat, sisu, koondanalüütikat | grant nagu eelmine | sama | sama | JAH |
| **Koondvaataja** (ANALYTICS_VIEWER) | ei midagi — read-only | org-i koondiperioodid + baromeeter + koondieksport | ÜHTEGI isikutaseme rida — vaadet, kust seda küsida, ei eksisteeri (ptk 9/13) | grant + (välise partneri puhul) O-ORG-3 leping; iga grant reason'iga | validUntil SOOVITUSLIKULT kohustuslik (max 12 kuud, pikendatav) | iga koondivaatamine JA eksport logitakse (O-WB-2 laiendus) | JAH — ja kolmas võti: feature-gate ORG_ANALYTICS (ptk 17) |
| **Teenuseprofiili toimetaja** (PROFILE_EDITOR) | org-iga seotud teenuseprofiili sisu (mitte omandust) | profiili + selle kinnitusseisu (U4) | teiste liikmete pöördumisi (adressaat on endiselt konkreetne inimene) | grant | sama | profiilimuudatus = olemasolev checkedAt/audit rada | JAH |
| **Platvormi administraator** | org-i kinnitamine (klass A), SUSPENDED (klass A), RECALL (klass B), purge (klass C) — admini analüüsi väravaklassid | org-ide registrit, seise, auditivoogu | org-koondile EI OLE vaikimisi ligipääsu-UI-d (erinevus tänasest wellbeing-pilotist! vt ptk 10.5); isiklikku sisu ei ava (K1 4.10 p7) | isAdmin (kuni Admin P0.4 capability-kihini; siis `platform_admin`) | — | kõik klass A/B/C toimingud | värav + reason |
| **Väline partner / KOV ilma liikmesuseta** | ei midagi | ei midagi (org-i olemasolu on nähtav ainult liikmetele ja adminile; avalikku org-kataloogi V1-s EI OLE) | kõike | — | — | — | — |
| **Mitmesse org-i kuuluv kasutaja** | konteksti valik navigeerimisega | iga org-i vaates AINULT selle org-i andmed | teise org-i mistahes halduseset samas vaates | iga org-i liikmesus eraldi | eraldi | eraldi | konteksti-orgId igal päringul serveri poolt valideeritud |

### 3.3. Kolm läbivat reeglit

1. **Vaikimisi null:** liikmesus üksi ei ava ÜHTEGI haldus- ega koondvaadet; MEMBER-i kaks „tasuta" omadust on nähtavus valikuloendis ja loendatavus koondis (kehtiva nõusoleku korral).
2. **OWNER ≠ superuser:** omanik ilma ANALYTICS_VIEWER-ita ei näe koondit; ilma PROFILE_EDITOR-ita ei muuda profiili sisu. See hoiab „juht näeb kõike, sest ta on juht" mustri tekkimata — iga õigus on eraldi antud, põhjendatud ja auditeeritud.
3. **Grant on toiming, mitte seisund:** iga capability-muudatus nõuab reason'it, tekitab DataAuditLog kirje ja U1 teavituse SAAJALE endale (sinu õigusi muudeti) — mitte kogu org-ile.

---

## 4. Kõvad privaatsusinvariandid (ORG-INV)

Need on TEHNILISED invariandid — jõustatakse puuduva päringutee, serveripoolse omaniku-/osaleja-skoobi ja testidega (ptk 19), mitte UI-lubadusega. Ükski capability, org-seadistus ega admini toiming ei tühista neid.

1. **ORG-INV-1:** organisatsiooni liikmesus ega ükski org-capability ei anna ligipääsu töötaja privaatsele Tööheaolule (kirjed, mustandid, trend, kasutusfakt — W-INV-1/2 laienevad org-kihile muutmata kujul).
2. **ORG-INV-2:** organisatsioon ei näe Meetodipeegli ega juhtumitöö privaatkirjeid (CASEWORK 3.6 arhitektuurilised keelud; O-CW-6 vaikekeeld kehtib kuni eraldi otsuseni).
3. **ORG-INV-3:** organisatsioon ei näe Supervisiooni sisu; maksimaalne tulevik on ORG_META „toimumise fakt" ja SEEGI on väljaspool V1 (ptk 11).
4. **ORG-INV-4:** organisatsioon ei näe pöörduja Teekonda, vestlusi, dokumente ega juhtumeid — pöörduja ei ole KUNAGI org-i „andmeobjekt"; eelpöördumise adressaat on inimene, mitte organisatsioon (ptk 7.2 üleandmine ei muuda seda).
5. **ORG-INV-5:** org-juht ei näe Kovisiooni ega koostööruumi sisu organisatsiooniseose tõttu; `CovisionVisibility.ORGANIZATION` jääb surnuks — ORG-V1 EI lisa sellele lugemisteed.
6. **ORG-INV-6:** platvormi administraator ei saa org-vaadete ega admin-vaadete kaudu privaatset sisu avada (K1 4.10 p7 kehtib); org-kiht ei loo adminile ühtegi uut sisuteed.
7. **ORG-INV-7:** liikmesus ei asenda ruumi-, omandi-, osaleja- ega jagamisõigust — org-kontrollid on LISANDUVAD org-objektidele, mitte asendavad isiklikele (lisavastuste p4 sõnastus, nüüd invariandina).
8. **ORG-INV-8:** tööandja ei saa individuaalset riskiskoori, töötajate pingerida, „aktiivsuse" tabelit ega „probleemsete töötajate" nimekirja — vastavaid API-sid, päringuid ega eksportvälju ei eksisteeri; koondis pole ühtegi isikuvõtit.
9. **ORG-INV-9:** kriisisündmusi ei kuvata isikupõhiselt ega kasutata org-analüütikas ÜLDSE (ka koondarvuna mitte V1-s — kriisitrend on platvormi admini mõõdik, mitte tööandja oma; Admin P0.2 pretsedent).
10. **ORG-INV-10:** AI ei tee töötajate, meeskondade ega organisatsioonide automaatseid sooritus-, riski- ega kvaliteedihinnanguid; baromeetri iga väide on deterministlik arvutus avaldatud koondist (ptk 12).
11. **ORG-INV-11:** kasutusfakti nähtamatus (W-INV-2) laieneb org-kihile: org ei näe, KES liikmetest platvormi/Tööheaolu/mõnd vormi kasutab — ka mitte kaudselt (tõrkeloendid, sündmustevood, „viimati aktiivne" veerud).
12. **ORG-INV-12:** koondi ekraanivaade ja eksport kannavad SAMA summutuslepingut (ptk 9.10); ühtegi „toorandmete" ekspordirada org-ile ei eksisteeri.

---

## 5. Minimaalne andmemudel

### 5.1. Varasema kahe tabeli soovituse hinnang

Lisavastuste `Organization + OrganizationMember` kaks tabelit katavad liikmesuse, aga EI kata kolme asja, milleta tervikteemat ei saa ühe haruna üle anda: (a) õiguste kandja — ilma capability-tabelita korduks admini „ühe lameda õiguse" viga (`orgRole: MANAGER` väli oleks just see); (b) kutse elutsükkel auditiga — ruumi-`Invite` on ruumipõhine ega sobi taaskasutuseks (roomId kohustuslik); (c) külmutatud koondiperioodid — ilma nendeta pole differencing-kaitset (ptk 9.6) võimalik jõustada. Seega V1 = **5 tabelit, 0 hierarhiat**.

### 5.2. Tabelid (kirjeldus, MITTE Prisma-kood — skeemi kirjutab teostaja)

**`Organization`**
- `id`; `name` (unikaalne aktiivsete seas — soovitus: unikaalsus (name, status!=REJECTED/DELETED) teenuskihis, mitte DB-unikaalsus, et arhiiv ei blokeeriks nime); `type` enum `KOV_UNIT | SERVICE_PROVIDER_ORG | NGO | PROFESSIONAL_ASSOCIATION | OTHER` (PROFESSIONAL_ASSOCIATION reserveeritud, V1 ei aktiveeri); `legalName?`; `registryCode?` (kohustuslik teenuskihis, kui type=SERVICE_PROVIDER_ORG|NGO); `municipalityId?` FK → `Municipality` (SetNull; kohustuslik teenuskihis, kui type=KOV_UNIT); `unitLabel?` (vaba tekst „sotsiaaltööosakond" — annab osakonna-semantika ilma hierarhiata);
- `status` enum `DRAFT | PENDING_VERIFICATION | REJECTED | ACTIVE | SUSPENDED | ARCHIVED` (+ purge kustutab rea; DELETED ei ole salvestatav olek);
- `createdByUserId`; `verifiedAt?`, `verifiedByUserId?`; `suspendedAt?/suspendedReason?`; `archivedAt?`; `deletionRequestedAt?`;
- `analyticsEnabled Boolean @default(false)` — org-tasandi lüliti koondimootorile (kolmas võti; sisse ainult O-ORG-2/3 järel);
- `aggregatePeriodGranularity` enum `MONTH | QUARTER` (vaikimisi MONTH; valitakse ÜKS — kahe granulaarsuse paralleelkuva on differencing-risk, ptk 9.6);
- indeksid: status; municipalityId; type.

**`OrganizationMembership`**
- `id`; `organizationId` FK Cascade; `userId` FK Cascade; `status` enum `ACTIVE | SUSPENDED | ENDED`;
- `startedAt` (=kutse vastuvõtt); `endedAt?`; `endedReason?` enum `LEFT | REMOVED | ORG_ARCHIVED | ACCOUNT_DELETED`;
- `invitedByUserId?` (SetNull); `endedByUserId?` (SetNull); `suspendedAt?`;
- **aktiivse liikmesuse unikaalsus:** Prisma ei toeta osalist unikaalindeksit → **raw-SQL migratsioon**: `CREATE UNIQUE INDEX ... ON "OrganizationMembership" ("organizationId", "userId") WHERE "endedAt" IS NULL;` (lisavastuste tehniline märkus kinnitatud);
- indeksid: (userId, endedAt); (organizationId, status); (organizationId, startedAt, endedAt) — intervallipäringute jaoks.
- Konto kustutamine: FK Cascade kustutab liikmesuseread → avaldatud koondiperioodid EI muutu (külmutatud, ptk 2.5); veel avaldamata perioodide arvutus ei sisalda enam kustutatud kasutajat. `endedReason: ACCOUNT_DELETED` on ainult teenuskihi vaheolek enne cascade'i (auditisse jääb DataAuditLog kirje, mitte liikmesuserida).

**`OrganizationMemberCapability`**
- `id`; `membershipId` FK Cascade (NB: liikmesuse, MITTE kasutaja küljes — liikmesuse lõpp lõpetab õigused struktuurselt); `capability` enum `OWNER | MEMBER_ADMIN | PROFILE_EDITOR | ANALYTICS_VIEWER | BILLING_MANAGER`;
- `grantedByUserId?`; `reason` (kohustuslik — UserEntitlementOverride distsipliin); `validFrom`; `validUntil?`; `revokedAt?`; `revokedByUserId?`;
- **täpselt üks aktiivne OWNER org-i kohta:** raw-SQL osaline unikaalindeks `(organizationId ei ole siin tabelis) →` teostus: unikaalindeks `("membershipId", "capability") WHERE "revokedAt" IS NULL` + OWNER-i ainsus teenuskihi tehinguga üleandmisel (kaks kirjet ei saa korraga aktiivsed olla, sest üleandmine on üks tehing: vana revoke + uus grant). Kui teostaja soovib DB-garantiid, on alternatiiv denormaliseeritud `organizationId` veerg selles tabelis + osaline unikaalindeks `("organizationId") WHERE capability='OWNER' AND "revokedAt" IS NULL` — soovituslik, sest omaniku ainsus on turvainvariant;
- indeks: (membershipId, capability, revokedAt).

**`OrganizationInvite`**
- `id`; `organizationId` FK Cascade; `email`; `invitedByUserId`; `tokenHash @unique`; `status` enum `SENT | ACCEPTED | DECLINED | EXPIRED | REVOKED`; `expiresAt`; `acceptedByUserId?`; `acceptedAt?`; `revokedByUserId?`; `note?` (kutsuja lühisõnum, sisupiiranguga);
- teadlikult PUUDUB: capability-eelmääramine kutses (kahe võtme põhimõte — õigused antakse pärast liitumist eraldi toiminguna);
- indeksid: (organizationId, status); email; expiresAt.

**`OrganizationAggregatePeriod`**
- `id`; `organizationId` FK Cascade; `periodKey` (nt `2026-M07` või `2026-Q3`, Europe/Tallinn); `metricSet` (nt `wellbeing_v1`, `service_ops_v1` — eri allikaklassid eraldi ridadena); `status` enum `PENDING | PUBLISHED | SUPPRESSED | RECALLED`;
- `payload Json` — AINULT summutusjärgsed mõõdikud + `basis` (allikas, aken, sampleSize-klass, arvutusaeg, mootoriversioon); isikuvõtmeid, userId-sid ega toorloendeid EI OLE payload'is KUNAGI;
- `computedAt`; `publishedAt?`; `recalledAt?/recallReason?`;
- `@@unique([organizationId, periodKey, metricSet])`;
- see tabel ON differencing-kaitse kandja: avaldatud rida on külmutatud tõde, mida hilisemad andmemuutused ei muuda.

### 5.3. Capability-kandja valik (hinnang)

Kaalutud: (a) capability-veerud liikmesusreal (lame, aga iga uus õigus = migratsioon; revoke-ajalugu kaob); (b) eraldi tabel liikmesuse küljes (VALITUD — PracticeCapability pretsedent, täielik grant/revoke/aegumise ajalugu, kahe võtme kontroll struktuurne); (c) globaalne AdminGrant-laiendus scope'iga `org:<id>` (Admin P0.4 tabel) — lükatud tagasi V1-s: AdminGrant on PLATVORMI halduse kiht (admini analüüs ptk 4.3), org-õigused on ORG-i sisehaldus; segamine looks „org-juht = väike admin" väärarusaama. Kui Admin P0.4 valmib, jäävad kaks süsteemi teadlikult eraldi: AdminGrant = kes haldab platvormi; OrganizationMemberCapability = kes mida teeb org-i sees.

### 5.4. V1 vs reserveeritud vs eksitavad

| Klass | Sisu |
|---|---|
| V1 kohustuslik | 5 tabelit ptk 5.2; `ServiceProviderProfile.organizationId?` FK (SetNull; `ownerId` + `@@unique([ownerId])` JÄÄVAD — ptk 7.3); FK-de lisamine kolmele rippuvale väljale: `RoomMember.sponsorOrgId`, `Invite.sponsoredByOrgId`, `WellbeingPilotScope.organizationId` → `Organization.id` (SetNull) — ohutu, sest toodangus on kõik väärtused null (resolveSponsor tagastab alati null; PilotScope=0 rida) |
| Reserveeritud, V1-s EI ehitata | `OrganizationUnit`/hierarhia (unitLabel katab); org-arveldus (`BillingSource.SPONSORED_BY_ORG`, arved, hanked) — ärkab alles hanke-päästikul; `Subscription.sponsorOrgId`; ORG_META nähtavusklass (K1); U5 puudujäägikoondi org-vaade; org-tasandi RAG-allikad (see on OLEMASOLEV OrganizationAdmin, eraldi maailm) |
| Eksitava nimega olemasolev | `OrganizationAdmin(+File)` ja `MunicipalityKovAdmin(+File)` = RAG-allikate haldus. **Nimetusekonflikti lahendus:** uusi RAG-mudeleid ei nimetata ümber (liiga lai puutepind); uus kiht kasutab `Organization*` eesliidet ILMA `Admin`-sõnata; koodikommentaar + doc-viide mõlemasse suunda; admin-UI-s hoitakse sõnastus lahus („Teadmusallikad: organisatsioonid" vs „Organisatsioonid") |
| Migratsioon olemasolevatele kirjetele | EI OLE VAJA — org-kiht algab tühjalt; ainsad puudutatavad olemasolevad tabelid saavad nullable FK (ei backfilli); `WellbeingPilotScope.organizationId` FK ei muuda pilootide senist tööd (0 rida) |

### 5.5. Sponsorlus ja arveldus V1-s

V1 teeb kolm asja ja EI tee neljandat: (1) seob rippuvad sponsor-väljad FK-ga, et tulevased sponsoreeritud kutsed saaksid viidata päris org-ile; (2) lubab org-i BILLING_MANAGER-il näha org-iga seotud sponsorlusseoseid koondina; (3) hoiab isiku-põhise sponsorluse (sponsorUserId, SPONSORED_BY_HOST) muutmata töös. EI ehita: org-poolset maksevoogu, arveldusarveid, hankearveldust — `BillingSource`-i uusi väärtusi ei lisata enne hanke-päästikut (lisavastuste päästik 3). Põhjus: Maksekeskuse voog on isikupõhine; org-arveldus on eraldi maksete-teema (T09) otsus.

### 5.6. Nimetuste kokkulepe

Teenuskiht: `lib/organizations/` (service.js, membership.js, capabilities.js, invites.js, aggregate.js). API: `/api/org/[orgId]/…` (mitte `/api/organizations` — väldib segadust `/api/admin/rag/organizations`-iga). UI-route: `/org/[orgId]/…`. i18n nimeruum: `org.*`.

---

## 6. Andmete ja töövara omand

Veerud: omanik / vastutav töötleja või õigusotsuse koht / nähtavus / muutmisõigus / säilitamine / töötaja lahkumise mõju / org-i lõpetamise mõju / eksport ja kustutamine.

| Objekt | Omanik | Vastutav töötleja / õigusotsus | Nähtavus | Muutmine | Säilitamine | Töötaja lahkumine | Org-i lõpetamine | Eksport/kustutamine |
|---|---|---|---|---|---|---|---|---|
| Kasutaja privaatne sisu (vestlused, Teekond, dokumendid, Tööheaolu, Meetodipeegel, juhtumitöö ettevalmistus) | kasutaja | platvorm kasutaja suhtes; org EI ole töötleja | ainult omanik (+tema jagamised) | ainult omanik | senised reeglid, org ei mõjuta | **muutumatu** — jääb kasutajale; org ei saa midagi; asendajale ei liigu midagi automaatselt | muutumatu | kasutaja andmekoopia (EXPORT E-1); org-ile MITTE KUNAGI |
| Ruumi ühine sisu | ruumi omanik + osalejad (T12 leping) | platvorm; osalejapõhine | osalejad | osalejad rollide järgi | T12 retention | osaleja lahkub ruumist T12 reeglitega — org-liikmesuse lõpp EI eemalda teda automaatselt ruumidest (eraldi toiming offboarding-kontrollnimekirjas, ptk 7.4) | muutumatu (ruumid pole org-i omad) | T12/T16 |
| Organisatsiooni liikmesus | **org ja liige ühiselt** (kummalgi õigus lõpetada) | org kui vastutav töötleja liikmeandmete (nimi, e-post kutses, intervallid) suhtes; platvorm volitatud töötleja — O-ORG-3 leping fikseerib | org-i haldurid + liige ise; teised liikmed näevad nime valikuloendis | MEMBER_ADMIN (staatus), liige (lahkumine) | intervalliread säilivad org-i eluea + auditiretention (ptk 15.4) — koondi õigsus sõltub neist | rida saab `endedAt`; ajalugu säilib | kõik read `ENDED(ORG_ARCHIVED)` | liige näeb oma liikmesusfakte andmekoopias; org-eksport sisaldab liikmete NIMEKIRJA (haldusfakt), mitte kasutusandmeid |
| Org-i teenuseprofiil (LINKED) | profiili `ownerId` (füüsiline vastutav toimetaja) + org-i link | teenuseinfo on avalik-suunaline; vastutav org | avalik (PUBLISHED) nagu seni | PROFILE_EDITOR-id + omanik | seni + org-i ajalugu | kui lahkuja = ownerId → omaniku üleandmine org-i sees KOHUSTUSLIK enne lahkumist (ptk 7.3); muidu ainult capability lõpp | link katkeb, profiil jääb viimasele omanikule isiklikuna | profiil on avalik info; kustutus = seni |
| Arveldus- ja sponsorlusinfo | maksja (isik) V1-s | T09 leping | BILLING_MANAGER koondina; maksja ise | ei (read-only V1) | T09/raamatupidamine | sponsoreeritud liikme lahkumine → clawback on T09 otsus (O-J-pere), org-kiht ainult NÄITAB seost | sponsorlusseosed jäävad ajalukku | T09 |
| Koondanalüütika (OrganizationAggregatePeriod) | **organisatsioon** (avaldatud, külmutatud, anonüümne agregaat) | org vastutav; platvorm koostaja; anonüümsuse tagab leping ptk 9 | liikmed + ANALYTICS_VIEWER (sama koond mõlemale — ideed 21.4) | mitte keegi (RECALL ainult admin, klass B) | org-i eluiga + arhiiv | EI mõjuta (külmutatud) | säilib ARCHIVED-olekus; kustub purge'iga | eksport ptk 15.1; kustutamine ainult org-i purge'iga |
| Auditijälg (DataAuditLog org-actionid) | platvorm | platvorm (aruandekohuslus); elab konto/org-i kustutuse üle (FK-ta stringid — olemasolev muster) | platform_admin; org-haldurid näevad OMA org-i haldussündmuste väljavõtet (ptk 14.3) | mitte keegi | audit_long | muutumatu | muutumatu | ei ekspordita org-ile täiskujul; kasutaja näeb teda puudutavat GDPR-rajal (E-1/jurist) |
| Eksporditud koond (CSV/JSON fail) | eksportija org-i nimel | org vastutav — fail on org-i valduses edasi | väljaspool platvormi | — | org-i vastutus | — | — | manifest + audit (ptk 15.1); platvorm ei saa tagasi kutsuda — SEEPÄRAST on ekspordi lävi sama või rangem kui ekraanil |
| Org-i teavitused (U1 org-tüübid) | saaja (individuaalne NotificationEvent) | platvorm | ainult saaja | ack/dismiss | short30/standard90 (ptk 14) | saaja lahkumine → org-teavitusi enam ei tule | genereerimine lõpeb | U1 üldreeglid |
| Üleantud töö (eelpöördumise adressaadivahetus) | pöördumise AUTOR jääb omanikuks; adressaadipool läheb uuele vastuvõtjale | KOV/teenuseosutaja menetluspool — O-CW-1 perekond | autor + uus adressaat; org näeb FAKTI (arv), mitte sisu | üleandmine = vana+uue adressaadi nõusolek (ptk 7.2) | T06 retention (O-TK9) | lahkuja adressaadi-õigus lõpeb; ootel pöördumised LÄHEVAD üleandmisele (ptk 7.4) | org-i lõpp ei muuda pöördumisi (need on isikute vahel) | T06/T16 |

Töötaja lahkumise neli keeldu (ülesande nõue, kinnitatud maatriksis): lahkumine EI kustuta tema privaatseid kirjeid; EI anna neid organisatsioonile; EI vii isiklikku sisu automaatselt asendajale; EI jäta ühtegi org-volitust kehtima (capability'd lõpevad struktuurselt liikmesusega).

---

## 7. Töö üleandmine, asendamine ja ühine teenuseprofiil

### 7.1. Piir T20-ga (COLLAB omab U11 mehaanikat)

U11 „kolleegile üleandmine" KUULUB T20/T21-le (masterregister ptk 6). ORG-V1 EI ehita üldist üleandmismehaanikat; ta annab kolm asja, mida U11 vajab ja mis seni puudusid: (1) **kolleegide ringi** — org-i aktiivsete liikmete valikuloend (nimi + roll; ilma kasutusandmeteta), mida üleandmis-UI-d saavad kasutada „kellele" välja allikana; (2) **õiguste lõpetamise garantii** — offboarding lõpetab volitused; (3) **ühe päris vertikaali** (7.2), mis tõestab lepingu.

### 7.2. V1 vertikaal: eelpöördumise adressaadi üleandmine org-i sees

- **Kes algatab:** senine adressaat (ise, nt puhkusele minnes) VÕI MEMBER_ADMIN lahkunud/peatatud liikme ootel pöördumiste puhul.
- **Vastuvõtmine:** üleandmine vajab UUE adressaadi kinnitust (O-CO-3 muster: vastuvõtja kinnitab); enne kinnitust jääb pöördumine vana adressaadi järjekorda.
- **Mida uus adressaat saab:** sama, mida algne adressaat nägi — autori JAGATUD kihi (shareKeys-projektsioon), mitte rohkem; üleandmine EI laienda kunagi jagamise ulatust.
- **Mida org näeb:** üleandmise FAKTI auditis ja loenduris (mitu üleandmist perioodis); MITTE pöördumise sisu. MEMBER_ADMIN, kes algatab teise inimese pöördumiste üleandmist, valib loendist, mis näitab ainult pöördumiste ARVU ja vanust adressaadi kohta, mitte sisu ega autoreid.
- **Mida autor näeb:** neutraalne U1 teavitus „sinu pöördumisega tegeleb nüüd <nimi, asutus>" — autor EI pea uuesti nõustuma (adressaat on sama asutuse sama funktsioon), AGA autoril on õigus pöördumine tagasi võtta nagu seni (U3 leping). See tasakaal on O-ORG-1 juures üle kinnitatav (ptk 17).
- **Juht EI saa sisu:** üleandmine ei ava pöördumist kolmandale osapoolele — ainult uuele adressaadile.

### 7.3. Ühine teenuseprofiil

- Profiil JÄÄB `ownerId`-ga füüsilise isiku vastutusele (`@@unique([ownerId])` säilib — jagatud kontosid ei teki, iga muudatus on isikustatud); lisandub `organizationId?` link ja PROFILE_EDITOR capability, mis lubab org-i liikmetel sisu toimetada.
- Toimetamiskonflikt: viimase kirjutaja võit + `updatedAt` CAS-kontroll (sama muster mis WellbeingOutputDraft) — kui vahepeal muudeti, kuvatakse värskenda-ja-korda; auditisse iga salvestus (kes).
- Töötajate vahetumine: profiili JÄRJEPIDEVUS = omaniku üleandmine org-i sees (OWNER algatab, uus omanik kinnitab; publicSlug, kaardikirje ja kinnituste ajalugu EI muutu). Kui ownerId-kasutaja kustutab konto ilma üleandmiseta, kaob profiil cascade'iga — SEEPÄRAST on offboarding-kontrollnimekirjas (7.4) profiiliomandi kontroll kohustuslik samm ja org saab U1 hoiatuse, kui LINKED-profiili omanik alustab konto kustutust [teostus: kustutuseelne kontroll deleteUserWithPrivacyCleanup rajal — ainult hoiatus/blokk „anna profiil enne üle", mitte automaatne ülekanne].
- U4 kättesaadavuskinnitus: iga PROFILE_EDITOR saab kinnitada; `checkedAt` + kinnitaja audit; org-vaade näitab profiili värskusseisu (org-i ENDA teenuseinfo — lubatud fakt).
- Teenusekaardi seos: kaardil kuvatav kirje jääb ServiceMapEntry mehaanikasse (T11); org-link ei muuda kaardiloogikat V1-s.

### 7.4. Asendamine ja offboarding

- **Asendamine puhkuse ajal:** liikme `SUSPENDED` + tema ootel pöördumiste üleandmine (7.2). Automaatset „asendaja" rolli EI OLE — iga üleandmine on eksplitsiitne.
- **Offboarding-kontrollnimekiri** (UI-tugi MEMBER_ADMIN-ile, serveripoolsete faktidega): ① ootel pöördumised → üle anda; ② LINKED-profiili omandus → üle anda; ③ capability'd → lõpevad automaatselt; ④ org-i ruumid, kus lahkuja on omanik → T12/T20 omanikuvahetuse rada (org-kiht ainult NÄITAB fakti „on ruume, mille omanik ta on", ilma sisuta — loendur, mitte loend pealkirjadega); ⑤ liikmesus → ENDED. Nimekiri EI puuduta lahkuja isiklikku sisu (ORG-INV vaikimisi).
- **Jagatud kontode vältimine:** org-kihi olemasolu ise on lahendus (iga töötaja oma konto + org-seos); lisaks jääb profiili 1:1 unikaalsus ja iga toimingu isikustatud audit.

---

## 8. Koondandmete allikakataloog

Veerud on ühtses lepingus (admini analüüsi ptk 10.1 basis-leping laieneb org-koondile): iga mõõdik kannab `basis`-t (allikas + aken + sampleSize-klass + computedAt) ja kolme eriseisu („andmeid pole" / „alla läve" / „päris null" — ptk 12.3).

Üldreeglid: **cohort** = org-i ACTIVE+SUSPENDED liikmed, kelle intervall katab perioodi (ptk 10.3); **värskus** = perioodikoond arvutatakse perioodi lõpus ja külmutatakse (ptk 2.5/9.6); **säilitus** = org-i eluiga; **nähtavus** = liikmed + ANALYTICS_VIEWER (sama koond); vaba teksti EI kasutata ÜHESKI org-mõõdikus (tootmisvestluste, dokumentide, juhtumikirjelduste sisu on allikana keelatud).

| # | Allikas / mõõdik | Vajadus (kasutaja/juhtimine) | Lähteobjekt | Numerator | Denominator | Ajavahemik | Puuduv andmestik tähendab | Min lävi | Õigus-/tooteotsuse sõltuvus | V1 seis |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Liikmete arv + liitumised/lahkumised | org-i haldusfakt („kui suur me oleme") | OrganizationMembership | liikmesuseread seisuga | — | perioodi lõpu seis | org on tühi | EI VAJA k-läve (haldusfakt, mitte käitumine — admini analüüsi 10.1 pretsedent) | — | **LUBATUD** |
| 2 | Aktiveerunud kontode arv (liikmed, kes on platvormile vähemalt korra sisse loginud perioodi jooksul) | kasutuselevõtu ulatus piloodis | sessioonifakt → AINULT loendina | eristuvad sisselogijad | liikmete arv | periood | „andmeid pole" | **k≥5 JA mitte kunagi nimekirjana; kui org <5 liiget, ei kuvata üldse** | O-ORG-3 (kas kasutusfakt üldse kuulub org-koondisse — W-INV-2 pinge; soovitus: AINULT see üks binaarfakt, mitte sagedus/ajad) | **TINGIMUSLIK** (gate) |
| 3 | Eelpöördumised org-i liikmetele: saabunud/vastuvõetud arv | vastuvõtuvõime | PreInquiry staatusefaktid (adressaat ∈ org-liikmed) | staatusesündmuste arv | — | periood | 0 vs „—" eristus basis-ega | k≥5 AUTORITE kaitseks (autorid on välised isikud) | U1-P0 sündmuskiht annab ajatemplid (kuni selleta ainult updatedAt-põhine ligikaudsus — basis ütleb seda) | **LUBATUD** (arvud), latentsus TINGIMUSLIK |
| 4 | Vastuvõtu mediaanlatentsus (SENT→ACCEPTED) | „kas jõuame õigel ajal" | PreInquiry ajatemplid | mediaan | vastuvõetud arv | periood | „—" kuni U1 ajatempliteta | k≥5 | sama | **TINGIMUSLIK** (U1-P0 järel) |
| 5 | Teenuse kättesaadavus U4: org-i profiili kinnitusseis (kinnitatud/aegumas/aegunud) | org-i ENDA teenuseinfo värskus | ServiceProviderProfile.checkedAt + serviceItems | kirjete seisud | kirjete arv | jooksev seis (ainus elus-mõõdik — org-i enda vara, mitte isikuandmed) | „profiili pole seotud" | — | — | **LUBATUD** |
| 6 | Teenusepuudujäägi koond U5 | huvikaitse („mida meie piirkonnas napib") | U5 ei ole veel ehitatud (T11) | — | — | — | — | U5 oma lävileping | U5 teostus + O-ORG-2 klass | **KEELATUD V1** (tulevik; esimene samm on admini U5, org-mudelita — RUUM-VIS 6.12) |
| 7 | Tööheaolu koond (signaalijaotus, demand/resource/risk loendurid) | „kas meeskond on ülekoormatud" — AINUS heaoluallikas | WellbeingRecord aggregationEligible=true läbi liikmesusintervallide | aggregate.js mõõdikud (A1 parandusega: inimese-, mitte kirjepõhised) | eristuvad inimesed | kuu/kvartal (org-i granulaarsus) | „andmeid pole" (0 kirjet) vs „alla läve" | **k≥5 + tundlik klass k-safe reeglid ptk 9.5** | **O-ORG-2 (=O-WB-3/4) + A1–A5 sulgemine + partneri leping** | **TINGIMUSLIK** (feature-gate ORG_ANALYTICS + org.analyticsEnabled) |
| 8 | Koostöö-/Supervisiooniruumide meta-faktid (toimumiste arv) | org-tellija „kas teenus toimub" | ORG_META klass (K1) | — | — | — | — | — | O-CO-9 + SUP org-leping — MÕLEMAD blokeeritud | **KEELATUD V1** (vaikekeeld; ptk 11) |
| 9 | Teenuseprofiili toimimine (vaatamised, kontaktid) | turundushuvi | mõõtmist ei eksisteeri (analytics puudub kaardil) | — | — | — | — | — | — | **KEELATUD V1** (allikat pole; ei looda jälgimiskihti selle jaoks) |
| 10 | Tehnilised töökindluse mõõdikud (veamäärad, latentsus) | platvormi tervis | ChatLog/health | — | — | — | — | — | — | **KEELATUD org-vaates** — platvormi admini ala (T18); org ei ole platvormi operaator |
| 11 | Piloodi vabatahtlikud standardvormid (nt „kui palju eelinfo aitas" 1–5) | piloodi mõõtmine | tulevane standardvorm (lisavastuste piloodileping) | vastuste jaotus | vastanute arv | periood | „—" | k≥5 | piloodi disain (T26) | **TINGIMUSLIK** (kui piloot vormid loob; sama summutusleping) |
| 12 | Kriisisignaalid | — | — | — | — | — | — | — | — | **KEELATUD IGAVESTI org-vaates** (ORG-INV-9) |
| 13 | Individuaalne kasutus, sooritus, „aktiivsus", pingerida | — | — | — | — | — | — | — | — | **KEELATUD IGAVESTI** (ORG-INV-8/11) |

V1 avaldatav miinimum (enne O-ORG-2): read 1, 3 (arvud), 5 — need EI sisalda heaolu- ega käitumisandmeid ja katavad „kas platvorm meil töötab" küsimuse. Read 2, 4, 7, 11 avanevad gate'ide taga. See jaotus on baromeetri V1 sisu (ptk 12.4).

---

## 9. K-anonüümsus ja tuvastamisvastane leping

„k ≥ N" üksi ei kaitse (WELLBEING-V2-A0 A1–A5 tõestas augud sisepiloodi mootoris). Org-suunaline leping on järgmine — iga punkt on teostajale siduv:

### 9.1. Fikseeritud vaated, mitte päringuehitaja (struktuurne kaitse A2/A3 vastu)

Org-koond EI paku vabu filtreid. V1 lubatud lõiked on EELDEFINEERITUD: (a) kogu org × periood; (b) roleGroup-lõige AINULT siis, kui KÕIK rollirühmad ületavad läve eraldi (muidu kuvatakse ainult kogu-org). Soo-, vanuse-, üksuse-, nädala- ega kombineeritud filtreid EI EKSISTEERI. Komplement-lahutus (A2) ja filtrikombod (A3) on välistatud konstruktsiooniga, mitte kontrolliga: kui roleGroup-lõiget ei saa TÄIELIKULT avaldada, ei avaldata sellest ÜHTEGI rida (täiendav ehk complementary suppression = kõik-või-mitte-midagi lõike tasandil).

### 9.2. Läved andmeklasside kaupa

| Klass | Lävi | Põhjendus |
|---|---|---|
| Haldusfaktid (liikmete arv, profiili seis) | lävi puudub | org-i enda vara, mitte isikukäitumine |
| Töövoo arvud (pöördumised) | k≥5 eristuvat AUTORIT numeratoris | autorid on välised isikud; sisepiloodi 3 ei sobi väliseks kasutuseks (ideed 20.7) |
| Heaoluandmed (rida 7) | k≥5 eristuvat inimest denominaatoris JA ≥2 kirjet inimese kohta keskmiselt EI nõuta (see oleks rütmisurve) | kõrgem kui sisepiloodi 3; lõplik väärtus kuulub O-ORG-2 õigusanalüüsi (võib tõusta, mitte langeda) |
| Tundlikud alamklassid (risk_event.*, signal.red) | k≥5 JA klassi count<3 → kuva „<3" asemel SUMMUTA kogu rida (harv sündmus, A5) | „vähemalt üks viiest märkis töövägivalda" on väikeses meeskonnas sisuliselt isikutuvastus |

### 9.3. Inimese-, mitte kirjepõhised mõõdikud (A1 parandus)

Org-koondi osakaalud arvutatakse ERISTUVATE INIMESTE, mitte kirjete suhtes (üks aktiivne kasutaja ei tohi jaotust domineerida). aggregate.js praegune kirjepõhine arvutus tuleb org-suunal asendada: iga inimene panustab mõõdikusse max 1 (nt „inimesi, kellel perioodis esines punane signaal", mitte „punaste kirjete arv"). See on koondimootori E8 põhitöö.

### 9.4. Ümardamine ja vahemikud

Avaldatavad arvud: eristuvate inimeste loendurid TÄPSELT ainult siis, kui ≥10; vahemikus 5–9 kuvatakse „5–9"; osakaalud ümardatakse täisprotsendini. Statistilist müra V1-s EI lisata — fikseeritud vaated + külmutatud perioodid + vahemikud annavad piisava kaitse ilma müra selgitamiskuluta; müra muutub vajalikuks alles siis, kui kunagi avatakse vabad filtrid (mida see leping keelab).

### 9.5. Stabiilsed kohordid ja liikmeliikumine

Perioodi kohort külmub perioodi lõpus arvutushetkel: liige kuulub kohorti, kui tema intervall `[startedAt, endedAt)` kattub perioodiga vähemalt 50% ulatuses VÕI ta oli liige perioodi lõpus (lihtne, deterministlik reegel — teostaja fikseerib testiga). Ühe inimese lisandumine/lahkumine EI muuda juba avaldatud perioode (külmutus) ja järgmises perioodis muutub denominaator koos numeraatoriga — üksikliikme mõju ei ole isoleeritav, sest kuvatakse vahemikke (9.4) ja perioodide vahesid ei saa lahutada (9.6).

### 9.6. Ajaline differencing

- Ainult TERVIKLIKUD kalendriperioodid (Europe/Tallinn); jooksva perioodi vahekoond puudub.
- Org valib ÜHE granulaarsuse (kuu VÕI kvartal, `aggregatePeriodGranularity`); mõlemat paralleelselt ei avaldata — kuu- ja kvartalikoondi lahutamine üksteisest on klassikaline differencing-rünne.
- Avaldatud perioodid on külmutatud (`OrganizationAggregatePeriod`); sama perioodi ei arvutata kunagi uuesti (v.a admin-RECALL, mis EEMALDAB rea, mitte ei asenda vaikselt).
- Väikese org-i perioodilaiendus: kui 3 järjestikust kuud on SUPPRESSED, soovitab UI granulaarsuse vahetust kvartalile; vahetus kehtib EDASIULATUVALT (vanu kuid ei taasavaldata kvartalina, sest kuu-suppressed + kvartali-avaldatud kombinatsioon lubaks lahutamist tagantjärele — vahetuse järel algab kvartaliarvestus JÄRGMISEST tervikkvartalist).

### 9.7. Minimaalsed ajavahemikud

Lühim avaldatav periood on kalendrikuu. Nädala- või päevalõikeid org-koondis EI eksisteeri (nädalalõige + väike meeskond = sisuliselt kohalolekutabel).

### 9.8. Päringueelarve ja audit

Fikseeritud vaadete tõttu pole DP-stiilis eelarvet vaja; selle asemel: IGA koondivaate avamine ja IGA eksport kirjutab DataAuditLog kirje (kes, mis org, mis periood/metricSet) — O-WB-2 auditilogi otsus laieneb org-koondile kohustuslikuna. Ebaharilik muster (sama vaataja avab kõiki perioode järjest + ekspordib) on platvormi admini seirefakt.

### 9.9. Ristorganisatsiooniline piir

Ükski org-vaade ei kuva teise organisatsiooni ega „platvormi keskmise" võrdlust V1-s. Põhjus: platvormi väikese kasutajaskonna juures on „keskmine" sageli 1–2 muu org-i andmed — võrdlus oleks nende tuletamine. Võrdlusraamistik (kui üldse) on O-ORG-2-järgne metoodikaotsus.

### 9.10. Eksport = ekraan

Eksport (ptk 15.1) sisaldab TÄPSELT samu summutatud väärtusi, mis ekraanivaade — mitte kunagi detailsemaid. Sama mootorifunktsioon, sama payload; eksport lisab ainult manifesti.

### 9.11. Ründetestsenaariumid (kohustuslikud testid teostajale — ptk 19 viitab)

| # | Stsenaarium | Nõutav tulemus |
|---|---|---|
| R1 | Rühmas täpselt lävi (5 inimest) | avaldatakse vahemikuna „5–9"; mitte täpne 5 koos täpsete alamjaotustega, mis 5-st tagasi arvutuks |
| R2 | +1 inimene perioodide vahel (5→6) | kahe avaldatud perioodi vahe EI võimalda uue inimese andmeid isoleerida (vahemikud + inimese-põhisus + külmutus); test kontrollib, et payload ei sisalda täpseid count'e <10 |
| R3 | −1 inimene (lahkumine) | avaldatud vana periood EI muutu; uus periood arvutab uue kohordi; lahkuja panus pole lahutatav |
| R4 | „Juht filtreerib soo, rolli, üksuse ja nädala järgi" | selliseid filtreid EI EKSISTEERI — test kinnitab, et API lükkab tagasi KÕIK parameetrid peale (orgId, periodKey, metricSet) |
| R5 | Kaks peaaegu identset ajavahemikku | API väljastab ainult fikseeritud kalendriperioode; suvalise vahemiku päring → 400 |
| R6 | Väikesest osakonnast (4 in.) CSV-eksport | eksport = SUPPRESSED seisu fail („alla läve", ilma arvudeta); mitte osaline andmestik |
| R7 | Üks inimene on ainus uue kirje tegija perioodis | inimese-põhine lävi (k≥5 eristuvat) summutab; risk_event count<3 reegel katab harva sündmuse |
| R8 | Kasutaja vahetab org-i perioodi keskel | kirjed jagunevad intervalli järgi (vana org: kuni endedAt; uus org: alates startedAt); KUMBKI org ei näe teise perioodiosa; 50%/perioodi-lõpu kohordireegel annab deterministliku kuuluvuse; test mõlema org-i koondile |

---

## 10. Tööheaolu koond organisatsioonikihi vaates

WELLBEING-V2-A0 leping on siduv sisend; siin lahendatakse AINULT org-kihi küsimused.

1. **`aggregationEligible` tähendus org-kontekstis:** nõusolek tähendab „minu standardväljad võivad osaleda anonüümses koondis" — see EI ole org-spetsiifiline. Org-koond on selle nõusoleku UUS TARBIJA, mitte uus nõusolek; AGA kuna org-suunaline avaldamine on kasutaja jaoks sisuliselt uus sihtrühm (tööandja!), peab TO-3 otsus (vaikeseade + selgitus + lüliti) olema tehtud ENNE org-koondi aktiveerimist ja privaatsusselgitus peab NIMETAMA tööandja-suuna („…koondis, mida võib näha ka sinu organisatsioon — lülita välja siin"). Toodangu 0-kirje seis teeb selle tasuta (WELLBEING-V2-A0 ptk 4.4 aken).
2. **Nõusoleku ajahetk:** kehtib ARVUTAMISE hetkel (soovitus, kooskõlas elusarvutusega): kui kasutaja lülitab nõusoleku välja, ei sisene tema kirjed enam ühessegi UUDE perioodiarvutusse; juba avaldatud külmutatud perioodid ei muutu (anonüümne agregaat ei ole enam isikuandmed — O-ORG-2 kinnitab selle õigusliku tõlgenduse).
3. **Liikmesusintervall:** kirje kuulub org-i perioodikoondisse ainult siis, kui `record.createdAt ∈ [membership.startedAt, membership.endedAt)` JA kirje omanik kuulub perioodi kohorti (9.5). **Töökohavahetus EI vii varasemaid kirjeid uude org-i** — uue org-i koond algab liitumisest; varasema tööandja perioodid jäävad tema omadeks. See on täpselt lisavastuste „liikmesus liidetakse agregeerimisel, kirje ise jääb org-vabaks" reegel.
4. **Muutus ajas:** kuvatakse avaldatud perioodide JADANA (külmutatud punktid), mitte jooksva trendijoonena; „muutus" = kahe avaldatud perioodi kõrvutus. pilotReport'i hetketõmmise piirang (ajavõrdlust pole) lahendatakse org-mootoris perioodijadaga, MITTE pilotReport'i laiendamisega.
5. **Kolm eriseisu:** „andmeid pole" (0 koondikõlblikku kirjet perioodis — basis ütleb recordCount=0), „alla läve" (SUPPRESSED — kirjeid on, inimesi < k), „päris null" (mõõdik on 0, nt risk_event-klassi ei esinenud, JA lävi on ületatud). UI ei tohi neid kunagi ühe „0"-na näidata (admini analüüsi ptk 3.3 viga ei tohi korduda).
6. **`basis` ja osalejate arv:** iga heaolumõõdik kannab basis-t: allikaklass, periood, eristuvate inimeste VAHEMIK (9.4), arvutusaeg, mootoriversioon, granulaarsus. Täpset sampleSize'i <10 ei avaldata.
7. **Trend vs teemapõhine jaotus:** V1 org-vaade näeb signaalijaotust (green/yellow/red inimeste vahemikena) + demand/resource TOP-klasse (inimese-põhiselt, läve ja harv-sündmuse kaitsega); workflowType-jaotust EI kuvata (see paljastaks, MIS vorme meeskond kasutab — kasutusfakti klass, W-INV-2 vaim). Teemapõhine sügavus on O-ORG-2 järgne otsus.
8. **Koondpäringu audit:** iga org-heaoluvaate avamine + eksport logitakse (9.8); WellbeingPilotScope-i senine admin-piiramatus EI laiene org-koondile — org-koond käib AINULT capability + gate'i kaudu.
9. **O-WB-3/O-WB-4 mõju:** need KAKS on org-heaolukoondi ainus päris värav (koondatud siin O-ORG-2-ks): õiguslik klassifikatsioon (kas riskMarkerid on GDPR art 9) määrab, kas lävi 5 on piisav või vajab art 9 režiimi (kõrgem lävi/lisakaitse); O-WB-4 tingimused (partnerlepe, A1–A5 suletud, töötajad näevad sama koondit, „muutus ajas" olemas) on selle analüüsiga arhitektuuriliselt täidetavaks disainitud — otsus jääb.
10. **Kõva keeld (ülesande nõue, kinnitatud):** `WellbeingRecord` EI saa organisatsiooni nähtavusvõtit (ei org-välja, ei visibility-väärtust) — liitmine käib AINULT agregeerimisaegse liikmesus-JOIN-iga. Ka mitte „jõudluse pärast": denormaliseeritud org-veerg kirjel oleks arhitektuuriline auk (kiri muutuks org-i küsitavaks objektiks).

### 10.5. Sisepiloodi ja org-koondi suhe

`WellbeingPilotScope/Viewer` (admin-hallatav sisepiloot, k=3) JÄÄB eraldi instrumendiks platvormi enda seireks; org-koond (k=5, capability, gate) on TEINE, rangem kanal. V1 EI migreeri pilootskoope org-idele; kui päris org aktiveerub, võib admin luua pilootskoobi organizationId-FK-ga — aga org-i liikmed näevad AINULT org-kanalit. Kaks kanalit ei tohi sama UI-d jagada (eri läved, eri õigused).

---

## 11. Meetodipeegel, koostöö ja Supervisioon

- **O-CW-6 (Meetodipeegli org-õppimine):** V1 vastus = **vaikekeeld jääb jõusse**. Refleksiooniandmed ei osale üheski org-koondis, ka k-anonüümses; „organisatsiooni õppimine" (anonüümsed metoodikamustrid) on eraldi otsus, mis avaneb kõige varem O-ORG-2 + CASEWORK-P5 järel ja vajab oma analüüsi. ORG-V1 ei ehita selleks midagi ega reserveeri skeemis midagi.
- **O-CO-9 (`ORG_META` nähtavus):** V1 vastus = **ORG_META klassi EI aktiveerita**. Org ei näe koostöö-, kohtumis- ega Kovisiooni ruumide toimumise fakte. Kui SUP-tootemudel toob org-tellitud supervisiooni (tellija näeb toimumist, mitte sisu), on SEE esimene ORG_META tarbija — SUP-V1-A0 + O-ORG-3 ühisotsus, mitte ORG-V1 skoop. Skeemireserv pole vajalik (K1 nähtavusklass on lepingu, mitte tabeli küsimus).
- **Mida org VÕIB näha ruumidest:** mitte midagi V1-s. Isegi „osalemiste arv" on kasutusfakt (ORG-INV-11). Ainus ruumidega seotud org-fakt on offboarding-loendur (7.4 p④ — „lahkujal on N ruumi omandis", ilma pealkirjadeta).
- **Miks kohtumise/Supervisiooni sisu ei kuulu koondisse:** sisu on osalejapõhine (K1 SHARED_PARTICIPANTS klass); org ei ole osaleja; klassitõstmine nõuab kasutaja kinnitust (K1 reegel) — organisatsioon ei saa olla kinnitaja teise inimese sisu üle.
- **Organisatsioonidevaheline koostöö vs org-i enda ligipääs:** need on ERI mehaanikad. Koostöö = eri asutuste INIMESED samas ruumis, igaüks isikliku vastutusega (COLLAB-A0 cross-tenant reegel — org-kiht EI muuda seda); org-i ligipääs = käesoleva analüüsi capability-kiht org-i ENDA objektidele. ORG-V1 ei loo asutustevahelist andmevahetust.
- **Töötaja isiklik vastutus säilib:** liikmesus ei muuda kirjete omandust, jagamisotsuseid ega osalejakohustusi; töötaja teeb professionaalses ühistegevuses kõik sammud isikuna (COLLAB-i isikliku vastutuse põhimõte), org-kiht lisab ainult halduskonteksti.

---

## 12. Baromeetri tooteleping

### 12.1. Mis baromeeter ON

„Baromeeter" = org-i avalehe koondvaade, mis esitab MITU selgelt nimetatud, seletatavat mõõdet avaldatud perioodikoondidest: iga mõõde = nimi + definitsioon (mis loendatakse, mis on denominaator) + väärtus/vahemik + trend avaldatud perioodide jadana + basis + värskus + tõlgendusabi lühitekst („mida see näitab / mida see EI näita"). Summutatud perioodid kuvatakse ausalt („alla läve") ja ebakindlus nimetatakse (vahemikud, „valimi põhjal", „andmeid pole").

### 12.2. Mis baromeeter EI OLE (keelud, testitavad)

Üks liitskoor („org-i tervis 72/100") — KEELATUD; töötajate/meeskondade pingerida — KEELATUD; punane „riskitöötaja"/„riskimeeskonna" signaal — KEELATUD; diagnoos või kliiniline tõlgendus — KEELATUD; automaatne juhtimisotsus või -soovitus („koonda osakond X") — KEELATUD; võrdlus teise organisatsiooniga või „keskmisega" — KEELATUD V1 (9.9); AI genereeritud narratiiv, mille väiteid algandmed ei toeta — KEELATUD (V1 baromeetris pole AI-teksti ÜLDSE; tõlgendusabi on staatiline i18n-tekst).

### 12.3. Mõõdikute kataloog (kandidaadid) ja V1 valik

| Mõõde | Definitsioon | Allikaklass (ptk 8) | V1? |
|---|---|---|---|
| Liikmeskond | liikmete arv + liitumised/lahkumised perioodis | rida 1 | **JAH** |
| Teenuseinfo värskus | org-profiili kinnitatud/aegumas/aegunud teenusekirjete jaotus (U4) | rida 5 | **JAH** (kui profiil LINKED) |
| Pöördumiste maht | saabunud + vastu võetud pöördumiste arv perioodis (k≥5 autorit) | rida 3 | **JAH** |
| Vastuvõtu latentsus | mediaan SENT→ACCEPTED | rida 4 | gate (U1-P0 järel) |
| Kasutuselevõtt | aktiveerunud kontode arv vahemikuna | rida 2 | gate (O-ORG-3) |
| Heaolutrend | signaalijaotus inimeste vahemikena + top demand/resource klassid, perioodijada | rida 7 | gate (O-ORG-2 + ORG_ANALYTICS) |
| Tagasiside | piloodi standardvormide jaotus | rida 11 | gate (piloodi disain) |

V1 baromeeter = 3 mõõdet (liikmeskond, teenuseinfo värskus, pöördumiste maht) + iga gate'itud mõõte KOHT on UI-s olemas seisuga „vajab aktiveerimist" (aus tühiseis, mitte peidetud funktsioon) — nii näeb org, mida platvorm VÕIKS näidata, ilma et midagi lubamatut avaneks.

### 12.4. Vaatetorn-print

Baromeetrilt EI VII ükski klikk isikuni: mõõdikukaardil pole drill-down'i liikmete loendisse ega ühelegi isikureale (route'e ei eksisteeri — ORG-INV-8). Ainus navigatsioon on mõõte→definitsioon/basis→(kui olemas) perioodijada.

---

## 13. Kasutajaliides ja navigatsioon

- **Kontekst:** mitme liikmesuse korral org-valik profiilimenüüs/töölaual → `/org/[orgId]`; valitud org-i nimi on IGAL org-lehel püsivalt nähtav (päiseriba); server valideerib orgId igal päringul (ptk 1.2 p3).
- **Pinnad:** org-avaleht (baromeeter ptk 12 + seisuread); Liikmed (loend: nimi, seis, capability-sildid; toimingud MEMBER_ADMIN-ile); Kutsed (saada/revoke, seisud); Õigused (capability-grant reason-väljaga, aegumised); Teenuseprofiil (LINKED-profiil + U4 seis); Üleandmine (7.2 tööpind + offboarding-kontrollnimekiri 7.4); Koond (perioodijada + eksport; gate-seisud); Seaded (nimi, granulaarsus, analyticsEnabled read-only kuni gate); Arhiveerimine (OWNER, klass B kinnitus).
- **Vaatetorn-print:** liikmete loend on HALDUSvaade (seisud, mitte tegevus); ühtegi „viimati aktiivne"/kasutusveergu ei ole; koondvaates isikuteed puuduvad (ORG-INV-8/11).
- **Seisud:** iga mõõdik oskab „—"/„alla läve"/pärisnull (10.5); laadimis-/vea-/tühiseisud igal pinnal; aegunud õigus (validUntil möödas) → selge teade + kellelt küsida; SUSPENDED-org → read-only teade.
- **DoD-kiht:** ET/EN/RU täies mahus (lint keelab hardcode'i); klaviatuur + fookusejärjekord; ekraanilugeja leping (tabelid caption/scope, live-region seisumuutustel); 200% tekst; kontrast; mobiil (tabelid → kaardid); reduced-motion (perioodijada ilma animatsioonita); modaalid ühise dialoogiprimitiiviga (T15).

## 14. Sündmused, teavitused ja audit

Kõik olemasoleval NotificationEvent-kihil (uued `type` väärtused, `sourceType: "ORGANIZATION"` v.a märgitud); payload = AINULT viited (orgId, nimi, tegija roll) — mitte kunagi privaatsisu, kasutusfakte ega Tööheaolu andmeid (W-INV-7 analoog); dedupeKey = `type:orgId:sihtID`; e-post ainult opt-in, v.a kutse (TRANSACTIONAL).

| Sündmus | Käivitaja | Saaja | Retention | Auditiklass |
|---|---|---|---|---|
| org.created / org.verified / org.rejected | looja / admin | looja; verified → liikmed (=looja) | standard90 | A |
| org.member_invited (e-post kutsutule) | MEMBER_ADMIN | kutsutu | short30 + tokeni aegumine | A |
| org.invite_accepted / declined / expired / revoked | kutsutu / taimer / haldur | kutsuja + haldurid | short30 | A |
| org.capability_granted / revoked | haldur | SAAJA ise (mitte kogu org) | standard90 | A (reason kohustuslik) |
| org.member_left / removed | liige / haldur | haldurid; removed → ka eemaldatu | standard90 | A |
| org.owner_changed | vana+uus omanik (kinnitusega) | kõik liikmed | standard90 | B |
| org.profile_editor_changed / profile_owner_changed | haldur/omanik | asjaosalised | standard90 | A |
| org.handover_started / accepted (7.2) | adressaat/haldur | vana+uus adressaat; autor saab NEUTRAALSE teate (T06 kanalis) | standard90 | A |
| org.aggregate_published / below_threshold | taimer/mootor | ANALYTICS_VIEWER-id + liikmed (sama teave — ideed 21.4) | short30 | — (payload: periodKey, metricSet; MITTE väärtused) |
| org.aggregate_exported | eksportija | — (ainult audit) | — | A (DataAuditLog kohustuslik, 9.8) |
| org.archived / suspended | omanik/admin | kõik liikmed | standard90 | B/C |

Idempotentsus: dedupeKey + olemasolev timer-retry; kõik haldustoimingud kirjutavad DataAuditLog'i (actor, org, action, reason, meta) — org-haldurid näevad OMA org-i haldussündmuste väljavõtet (mitte platvormi auditit).

## 15. Eksport, säilitamine ja lõpetamine

1. **Koondieksport:** ainult PUBLISHED/SUPPRESSED perioodid, sama summutusleping kui ekraan (9.10); CSV/JSON + manifest {org, periodKey'd, metricSet, basis, generatedAt, mootoriversioon}; iga eksport auditisse.
2. **Retention:** liikmesusread — org-i eluiga + audit_long (koondi õigsuse alus); kutsed — 90p pärast lõppseisundit; auditikirjed — audit_long (kustutamatud); koondiperioodid — org-i eluiga (arhiivis säilivad, purge kustutab); teenuseprofiil — säilib omaniku käes ka org-i lõppedes (link katkeb).
3. **Arhiveerimine:** read-only; liikmesused ENDED(ORG_ARCHIVED); koondiarvutus seiskub; taastamine ainult admini kaudu (klass B).
4. **Kustutamine:** ARCHIVED + retention möödas + omaniku taotlus → purge (org, liikmesused, kutsed, capability'd, perioodid); DataAuditLog jääb; kustutuspiir: org-i EI saa kustutada, kui tal on lahtisi sponsorlusseoseid (T09 kontroll).
5. **Kaks eri asja:** töötaja GDPR-andmekoopia (E-1; sisaldab TEMA liikmesusfaktid) ≠ org-i koondieksport (anonüümne agregaat). Org EI saa KUNAGI töötaja andmekoopiat ega selle osi.

## 16. Tehnilised variandid ja soovitus

| | A: ainult allowlistid (praegune) | **B: õhuke Organization + liikmesus (SOOVITUS)** | C: täistenant/hierarhia |
|---|---|---|---|
| Koondite õigsus 2+ org-iga | MURDUB (rollirühmad segunevad) | intervallipõhine JOIN — õige | õige, aga ülehinnaga |
| Mitme töötajaga teenuseosutaja | murdub (profiili 1:1) | PROFILE_EDITOR lahendab | lahendab |
| Privaatsusmudel | OK | isiku-/osalejapiirded muutumatud | LÕHUB (tenant-piir ristub Room/Help/cross-org koostööga) |
| Kulu | 0 | 5 tabelit + teenuskiht | suur + migratsioonirisk |

**Soovitus: B.** Alamvalikud: kaks→viis tabelit (5.1 põhjendus); capability-kandja = liikmesuse-külge tabel (5.3); org-kontekst = URL + serverivalideering (1.2); teenuseprofiil = link+capability, mitte omandi ümberkirjutus (7.3); Tööheaolu = ajalooline liikmesus-JOIN, kirjele org-võtit EI (10 p10); U1 = olemasolev NotificationEvent-kiht (14); koondimootor = fikseeritud vaated + külmutatud perioodid (9); **partnerineutraalne: JAH** — V1 ei vaja ühtegi partnerispetsiifilist välja ega lepet koodi kirjutamiseks (leping on vaja AKTIVEERIMISEKS, ptk 17). Ei ehitata: personalihaldust, SSO-d, palgaarvestust, CRM-i, org-arveldust, hierarhiat.

## 17. Toote- ja õigusotsused

| ID | Otsus | Soovituslik vaikevalik | Alternatiivid | Mõju (kasutaja/privaatsus/andmemudel) | Blokeerib ORG-V1 koodi? | Viimane hetk |
|---|---|---|---|---|---|---|
| **O-ORG-1** | Org-i V1 üksus: juriidiline isik vs osakond/tööüksus | tööüksus + type/unitLabel/registryCode, hierarhiata (1.2) | ainult jur. isik; hierarhia | nimekuva, kutsete usaldus / väike / Organization väljad | **EI** (kood katab mõlemad); blokeerib PÄRIS org-i kinnitamise | enne esimest PENDING_VERIFICATION→ACTIVE |
| **O-ORG-2** | Tööheaolu andmete õiguslik klassifikatsioon (=O-WB-3/4) + org-suunaline anonüümsusstandard | ptk 9 leping (k≥5, fikseeritud vaated, külmutus, vahemikud, harv-sündmuse kaitse) õigusanalüüsi sisendina | art 9 režiim kõrgema lävega | koondi sisu / SUUR / payload-kuju | **EI** (mootor gate'i taga sünteetiliselt testitav); blokeerib ORG_ANALYTICS + org.analyticsEnabled sisselülituse | enne esimest päris heaolukoondi avaldamist |
| **O-ORG-3** | Koondvaataja capability väline andmine + vastutava töötleja / volitatud töötleja piir (partneri andmetöötlusleping) + kasutuselevõtu-fakti (rida 2) lubatavus | ANALYTICS_VIEWER ainult org-i liikmele; väline vaataja V1-s puudub; rida 2 väljas kuni lepe | väline vaataja lepinguga | õigused / SUUR / — | **EI**; blokeerib capability andmise päris välistele + rea 2 | enne esimest päris ANALYTICS_VIEWER granti |
| O-ORG-4 | Üleandmisel autori uus nõusolek (7.2) | ei nõuta (sama asutus, sama funktsioon); tagasivõtuõigus säilib | nõusolek igal vahetusel | usaldus / keskmine / — | EI | enne E7 UI lõplikku sõnastust |
| O-ORG-5 | Org-i nähtavus platvormil | kataloogi pole; nähtav ainult liikmetele+adminile | avalik kataloog | — | EI | V2 |

Muud pered (org-arveldus, ORG_META/O-CO-9, O-CW-6, U5 org-vaade, org-supervisioon) on TEADLIKULT väljas — vaikekeelud fikseeritud ptk 5.5/8/11. **Blokeerivaid otsuseid on täpselt kolm (O-ORG-1/2/3) ja ükski ei blokeeri koodi — ainult aktiveerimisväravaid.**

## 18. Üks terviklik arenduspakett

```
ÜLESANNE: ORG-V1 — organisatsioonikiht ja privaatsusturvaline juhtimisvaade
Alus: docs/platvormi arendus/fable-5-organisatsiooni-analuutika.md (ORG-A0; LOE TERVIKUNA — ptk 4 invariandid,
ptk 5 andmemudel, ptk 9 tuvastamisvastane leping ja ptk 19 testimaatriks on siduvad).
Haru: fable/org-v1 origin/main'ist; ÜKS teemaharu, sisemised etapid E1–E10, ÜKS lõpparuanne. Määrdunud
kohalikku main'i ei puututa.

KASUTAJALE NÄHTAV LÕPPTULEMUS: KOV-i osakond või mitme töötajaga teenuseosutaja saab: luua organisatsiooni
(admin kinnitab identiteedi); kutsuda/eemaldada liikmeid; anda tähtajalisi õigusi (OWNER/MEMBER_ADMIN/
PROFILE_EDITOR/ANALYTICS_VIEWER/BILLING_MANAGER); hallata ühist teenuseprofiili mitme toimetajaga; anda
eelpöördumisi org-i sees üle (vastuvõtja kinnitusega); näha baromeetrit (3 V1-mõõdet + ausad gate-seisud) ja
külmutatud perioodikoonde; eksportida koondi sama summutuslepinguga; arhiveerida/lõpetada organisatsiooni —
ilma et ÜKSKI org-õigus avaks kellegi privaatset sisu.

ULATUS (etapid, kõik samas harus):
E1 Skeem: 5 tabelit (Organization, OrganizationMembership, OrganizationMemberCapability, OrganizationInvite,
   OrganizationAggregatePeriod — väljad/enumid/indeksid ptk 5.2) + ServiceProviderProfile.organizationId? FK +
   FK-d RoomMember.sponsorOrgId / Invite.sponsoredByOrgId / WellbeingPilotScope.organizationId (kõik SetNull;
   toodangus null-väärtused — ohutu). Migratsioonid + raw-SQL osalised unikaalindeksid: aktiivne liikmesus
   (organizationId,userId WHERE endedAt IS NULL); aktiivne capability (membershipId,capability WHERE revokedAt
   IS NULL); üks aktiivne OWNER (denormaliseeritud organizationId + WHERE capability='OWNER' AND revokedAt IS
   NULL). Rollback: down-migratsioonid + FK-de eemaldus.
E2 lib/organizations/: liikmesusteenus, capability-kontroll requireOrgCapability(orgId,userId,cap) — kahe
   võtme kontroll (ACTIVE liikmesus + kehtiv capability), fail-closed; DataAuditLog integratsioon (reason
   kohustuslik). E3 Kutsevoog (tokenHash, aegumine, revoke, lunastamine; capability'teta vastuvõtt).
E4 Org-kontekst: /org/[orgId]/* route'id, serveripoolne valideering igal päringul, org-valija UI.
E5 Liikmete haldus + omaniku üleandmine (kinnitusega tehing) + offboarding-kontrollnimekiri (ptk 7.4) +
   kustutuseelne profiiliomandi hoiatus. E6 Teenuseprofiili ühendus: link, PROFILE_EDITOR, CAS-konflikt, U4
   kinnitus, omaniku üleandmine org-i sees. E7 Eelpöördumise üleandmine org-i sees (ptk 7.2; autori neutraalne
   teavitus; jagamisulatus ei laiene). E8 Koondimootor: inimese-põhised mõõdikud (A1 parandus), fikseeritud
   vaated (AINULT orgId+periodKey+metricSet; muu parameeter → 400), k≥5 + harv-sündmuse kaitse + vahemikud +
   täiendav summutus lõike tasandil, kohordireegel, perioodi külmutus OrganizationAggregatePeriod'i,
   granulaarsuse vahetus edasiulatuvalt, koondipäringu+ekspordi audit. KÕIK feature-gate ORG_ANALYTICS
   (env, vaikimisi väljas) + org.analyticsEnabled taga; heaolu-metricSet lisaks O-ORG-2 taga.
E9 Baromeeter + koondivaade + eksport (manifest; sama summutus) + kõik ptk 13 pinnad; „—"/„alla läve"/
   pärisnull eristus; vaatetorn-print (isiku-drilldowni route'e ei eksisteeri).
E10 U1 sündmused (ptk 14 kataloog olemasoleval NotificationEvent-kihil), i18n ET/EN/RU, a11y, mobiil,
   observability (org-toimingute loendurid admini tervisevaatesse), testid (ptk 19 maatriks, sh R1–R8
   ründetestid), sünteetiline runtime-läbimäng: org → kutse → liikmed → õigused → profiil → üleandmine →
   koond (sünteetiliste kirjetega, gate sees testkeskkonnas) → eksport → offboarding → arhiveerimine;
   cleanup (sünteetiliste andmete nulljääk).

ULATUSEST VÄLJAS: org-arveldus/BillingSource laiendus; hierarhia/OrganizationUnit; ORG_META/O-CO-9; O-CW-6
org-õppimine; U5 org-vaade; org-supervisioon; avalik org-kataloog; väline ANALYTICS_VIEWER; kriisiandmed
org-vaates; individuaalse kasutuse/soorituse ÜKSKÕIK MIS kuju; RAG OrganizationAdmin-i ümbernimetamine.

FIKSEERITUD INVARIANDID: ORG-INV-1…12 (ptk 4) — testidena kohustuslikud.
SÕLTUVUSED: tehnilisi blokeerijaid EI OLE (U1-P0 puudumine → latentsusmõõdik jääb basis-märkega välja;
K1-P0 pole eeldus). OTSUSED/GATE'ID: O-ORG-1 → päris org-i kinnitamine; O-ORG-2 → heaolu-metricSet + gate;
O-ORG-3 → päris ANALYTICS_VIEWER + rida 2. Kood valmib täielikult NENDE OOTAMATA.
DoD: kõik etapid + testimaatriks roheline + lint/i18n:check + migratsiooniahel db:migrate:check + rollback
kirjeldatud + sünteetiline läbimäng dokumenteeritud + lõpparuanne (haru, commit'id, testitõendid, gate-seisud,
registriuuenduste ettepanekud).
```

## 19. Kohustuslik testimaatriks

Isolatsioon: kahe org-i range lahusus (liikmed/kutsed/koondid/haldus — org-liige ei näe teise org-i haldust; API-tasandi katse → 403/404). Mitmiksus: üks kasutaja kahes org-is; aktiivse org-i vahetus (URL-põhine; vale orgId → fail-closed). Õigused: org-manager ei näe töötaja privaatsisu (Tööheaolu/Teekond/dokumendid/Meetodipeegel/SUP null-leke — API-de olemasolu kontroll, mitte ainult UI); platform-admin ei saa org-vaate kaudu sisudrilldowni; capability lisamine/eemaldamine/aegumine; kahe võtme kontroll (capability ilma ACTIVE liikmesuseta → ei kehti); omaniku üleandmine (ainsus, kinnitus, tehing). Kutsed: aegumine, revoke, korduskasutuskatse, vale konto e-post. Elutsükkel: offboarding (õigused lõpevad, ootel töö üleandmisele, profiiliomandi kontroll); pooleliolev üleandmine lahkumisel; profiili mitme toimetaja CAS-konflikt; aktiivse liikmesuse unikaalsus (raw-indeksi test); org arhiveerimine/purge/retention. Koond: liikmesusintervalli-põhine arvutus; k-lävest all/täpselt lävel; complementary suppression (lõike kõik-või-mitte-midagi); ajavahemike differencing (ainult kalendriperioodid; granulaarsusevahetus edasiulatuv); filtrikatse R4; org-vahetus keset perioodi R8; ekspordi sama piir R6; koondipäringu/ekspordi audit. Läbiv: i18n ET/EN/RU pariteet; a11y (klaviatuur, lugeja, 200%, kontrast, reduced-motion); mobiil; migratsiooniahel + rollback; sünteetiliste andmete nulljääk.

## 20. Arendusvalmiduse lõpphinnang

- **ANALYSIS STATUS: COMPLETE**
- **DEVELOPMENT READINESS: ANALYSIS_READY**
- **Kas Sol/Terra saab ORG-V1 kohe alustada: JAH** — kogu pakett (ptk 18) on ehitatav otsusteta; O-ORG-1/2/3 piiravad ainult aktiveerimisväravaid (päris org-i kinnitamine; heaolukoondi sisselülitus; päris koondvaataja grant).
- **Fikseeritud (analüüsi vaikevalikud, ei blokeeri):** õhuke liikmesuskiht 5 tabeliga; hierarhiata tööüksus; capability liikmesuse küljes; URL-põhine org-kontekst; profiili link+toimetajad omandi ümberkirjutuseta; kirjele org-võtit EI; fikseeritud koondivaated + külmutatud perioodid + k≥5; ORG_META/O-CW-6 vaikekeelud; org-arveldus väljas; O-ORG-4/5 vaikevalikud.
- **Tehnilised sõltuvused:** mitte ühtegi blokeerivat; U1-P0 lisab hiljem latentsusmõõdiku; Admin P0.4 valmides jäävad AdminGrant ja org-capability teadlikult eraldi.
- **Blokeerivad otsused (max 3): O-ORG-1, O-ORG-2, O-ORG-3** (ptk 17) — kõigil vaikevalik olemas; ühe otsustusringiga suletavad.
- **Koodis valmis, gate'i taga:** koondimootor + heaolu-metricSet (ORG_ANALYTICS + org.analyticsEnabled + O-ORG-2); rida 2 kasutuselevõtu-fakt (O-ORG-3); väline vaataja (puudub V1-s).
- **Partnerlepe:** koodi EI vaja; vaja on enne PÄRIS organisatsiooni aktiveerimist (O-ORG-1 kinnitusprotsess + O-ORG-3 andmetöötlusleping).
- **Katvus:** liikmesus-, õiguste-, privaatsus-, analüütika-, UX-, ekspordi- ja lõpetamisrada on kõik kaetud (ptk 2–15); näilist mikropaketti ei tehtud — pakett on üks tervik.

## 21. Registritesse soovitatavad tekstid (koordinaator rakendab)

- `fable-5-tulevikufunktsioonide-suvaanaluusi-programm.md` rida 8: `ORG-A0 … COMPLETE (17.07.2026)`; jätkamispunkt: „valmis: 5-tabeline õhuke liikmesuskiht + capability'd + fikseeritud-vaadetega külmutatud koondimootor (k≥5); ORG-INV-1…12; 3 aktiveerimisotsust O-ORG-1/2/3 (ükski ei blokeeri koodi); T25 = ANALYSIS_READY — ÜKS pakett ORG-V1 (E1–E10, kopeeritav ülesanne doc ptk 18); O-CO-9/O-CW-6/O-WB-4 said V1 vastuse: vaikekeeld/gate". Muudatuslogisse analoogne rida varasemate mustris.
- `arendusteemade-masterregister.md` T25: olek `ANALYSIS_READY`; „Üks arendus: ORG-V1 ühe haruna E1–E10 (fable-5-organisatsiooni-analuutika.md ptk 18); kinnitatud vaikevalikud ptk 20; blokeerivad ainult aktiveerimisel O-ORG-1/2/3; kõva keeld muutumatu". Ptk 10 jätkamispunkti: järgmine avamata tulevikuanalüüs = SUP-V1-A0 (SUP-P0 push+audit järel) või KOV-V2-A0 (tooteomaniku avamisel).
- Otsuste registrisse: O-ORG-1…5 (ptk 17); O-CO-9 ja O-CW-6 reale märge „ORG-A0 vastus V1: ei aktiveerita"; O-WB-4 reale „arhitektuurilised tingimused disainitud (ORG-A0 ptk 9/10), ootab O-WB-3".

## 22. Koordinaatori jätkamispunkt

1. Võta vastu see analüüs; rakenda ptk 21 registritekstid (mina jagatud faile ei muutnud).
2. Ava soovi korral kohe ORG-V1 (ptk 18) — otsusteta ehitatav; paralleelselt käivita O-ORG-1/2/3 otsustusring (üks ring, vaikevalikud ptk 17).
3. O-ORG-2 õigusanalüüsile anna sisendiks ptk 9 leping + WELLBEING-V2-A0 ptk 4.3 auguloend.
4. Katkemise korral: Edenemistabel + see punkt on tõeallikas; kontrollid on lukus 17.07 seisuga (origin/main fe4eb4fa); uus sessioon teeb uue kontrolli ja lisab uue rea, vana ei muuda.

STATUS: COMPLETE
