# Fable 5: ESTA ja mentorlus (ESTA-MENTOR-A0)

ÜLESANNE: ESTA-MENTOR-A0 — ESTA ja mentorluse terviklik teemaanalüüs ning ESTA-MENTOR-V1 arendusleping
Kuupäev: 2026-07-17
Analüüsi baas: `origin/main @ fe4eb4fa7997a7eada9417a27c6cea75ccd23cbe` (kontrollitud `git ls-remote` 17.07.2026 — muutumatu)
STATUS: COMPLETE (esimene täisring 17.07.2026. COMPLETE tähendab valmis analüüsi, mitte valmis rakenduskoodi; ükski pakett ei saa siit automaatset arendusluba — see käib koordinaatori väravast.)

> Toote-, süsteemi- ja UX-analüüs: kuidas SotsiaalAI mentorlus toimib algusest lõpuni, sobitub olemasoleva
> professionaalse ühistegevuse ja ruumimudeliga, ei dubleeri supervisiooni ning on pärast ÜHTE teemaarendust
> (`ESTA-MENTOR-V1`, masterregistri T23) päriselt kasutatav.
> Autor: Fable 5 (ESTA-MENTOR-A0), 2026-07-17. **Ainult analüüs — rakenduskoodi, Prisma skeemi, migratsioone
> ega teste ei muudetud; midagi ei commit'itud, merge'itud ega deploy'tud.**

## Edenemistabel

| Etapp | Sisu | Seis |
|---|---|---|
| 0 | Tõeallikad (git read-only; origin/main muutumatuse kontroll) | TEHTUD |
| 1 | Kohustuslike sisendite lugemine (5 dokumenti + sihitud kontrollid) | TEHTUD |
| 2 | Read-only koodiinventuur (schema, calls, wellbeing, seed, API-pinnad) | TEHTUD |
| 3 | Ptk 1 — teema ja piirid | TEHTUD |
| 4 | Ptk 2 — osalised ja õigused | TEHTUD |
| 5 | Ptk 3 — täielik kasutajateekond | TEHTUD |
| 6 | Ptk 4 — olekumasinad ja invariandid | TEHTUD |
| 7 | Ptk 5 — olemasolev ja uus süsteemikiht | TEHTUD |
| 8 | Ptk 6 — ESTA ja välise partnerluse leping | TEHTUD |
| 9 | Ptk 7 — privaatsus, turvalisus ja säilitamine | TEHTUD |
| 10 | Ptk 8 — kasutajaliides ja ruumiline kogemus | TEHTUD |
| 11 | Ptk 9 — sündmused, teavitused ja taustatöö | TEHTUD |
| 12 | Ptk 10 — tooteotsused (O-EM-1…10) | TEHTUD |
| 13 | Ptk 11 — üks terviklik arenduspakett ESTA-MENTOR-V1 | TEHTUD |
| 14 | Ptk 12 — arendusvalmiduse lõpphinnang + registrite uuendus | TEHTUD |

## 0. Tõeallikad (kontrollitud 2026-07-17, read-only)

| Allikas | Seis | Tõend |
|---|---|---|
| `origin/main` | `fe4eb4fa` — muutumatu ülesande kanoonilise seisu suhtes | `git ls-remote origin main` + `git log origin/main` 17.07 |
| Lokaalne main | `0da4185b`, määrdunud tööpuu — EI kasutata ühegi väite alusena; skeemi loen origin/main-iga bait-identsest failist (COLLAB-A0 ptk 0 kontroll kehtib) | git status |
| `prisma/schema.prisma` | `Role` enum (ADMIN/SOCIAL_WORKER/SERVICE_PROVIDER/CLIENT — mentorit/ESTA-t POLE); `CallContextType.MENTORING` (reserveeritud, 0 kasutuskohta); `CallRecordingPurpose.MENTORING_SUMMARY` (kasutusel); `AgentArtifactType` EI sisalda mentorlustüüpi; ühtegi `Mentor*` mudelit EI OLE | grep + sihtlugemine |
| `data/mentoring/esta-mentor-seed.json` + `esta-mentor-import-report.md` | 17 ESTA mentorit, `PENDING_CONSENT` / `EXTERNAL_REFERENCE` / `consentStatus: NOT_REQUESTED`; kontaktid admin-only; fotod keelatud; kontrollitud 24.05.2026 | failid loetud |
| `lib/calls/service.js`, `components/rooms/RoomCallBar.jsx` | salvestuseesmärk „mentorluskohtumise kokkuvõte" on kasutajale valitav [MAIN] | grep |
| `lib/wellbeing/starterSupport.js`, `supportDrafts.js`, `displayLabels.js` | Alustaja tugi tuvastab mentorivajaduse (`mentorDiscussionNeed`, `starter_support.mentor_needed`) ja genereerib „Küsimused juhile või mentorile"; `WELLBEING_RECIPIENT_TYPES` = manager/pilot_support_contact/**supervisor**/covision/other — „mentor" PUUDUB | failid loetud |
| `app/api/**` | 32 API-perekonda; mentorlusega seotut ei ole ühtegi | `ls app/api` |
| K1-P0 | `codex/k1-p0-workspace-contract @ ef5973c9` [BRANCH] — registry reserveerib `meeting`/`network_case`/`org_space`/`field_visit`; mentorlusprotsessi kind'i EI reserveeri | K1-U1-A0 + COLLAB-A0 ptk 7.1 |
| SUP-P0 | `codex/supervision-v0-p0-schema @ 2fc826c4` [BRANCH, lokaalne] — 13 mudelit; kuju-doonor, MITTE alus | SUP tootemudel Q2 |
| Dokumendid | masterregister (T23), tulevikuprogrammi register, COLLAB-A0 (478 r, täielikult), SUP tootemudel Q1+Q2 (1013 r; Q1 + 3.1 + Q2 mudelid/otsused), lisavastused (org+piloot, täielikult), RUUM-VIS ptk 6.4–6.6 sihitult, ideed ptk 22/25/26/27 täielikult, K1-U1-A0 ptk 4/6/7/8 sihitult | loetud |

Märgistus: `[MAIN]` = origin/main; `[BRANCH]` = ainult harul; `[VISION]` = ainult analüüsides; `[DECISION]` = tooteomaniku/partneri otsus. Tootmisandmeid ega kasutajate sisu ei loetud.

---

## 1. Teema ja piirid

### 1.1. Mis on SotsiaalAI mentorlus

**Mentorlus on kahe spetsialisti vaheline kogemuse üleandmise suhe:** kogenum kolleeg (mentor) toetab vähemkogenut või uues rollis töötajat (mentee) praktiliste küsimuste, karjääri, rolliselguse ja professionaalse arengu teemadel. Sõnastuse ankur on olemas kolmes kinnitatud allikas, mida see analüüs ei muuda:

- ideed 22.1: mentorlus = „praktiline tugi alustajale või uues rollis töötajale";
- SUP tootemudel ptk 2: mentorlus = „kogenum kolleeg jagab kogemust" — eristatud supervisioonist (väljaõppinud protsessijuht), kovisioonist (võrdsete grupp) ja coachingust;
- COLLAB-A0 ptk 1.1 perekond B: mentorlus on „ekspert-suhe (mentor jagab ‚mida ja kuidas'), mitte võrdsete kohtumine" — metoodiliselt kaitstud vorm, mida EI sulatata kohtumise funktsiooniks.

**Platvormi roll on suhte konteiner, mitte mentori asendaja:** leidmine/viitamine, nõusolek, kokkulepe, kohtumiste jada mälu, kokkulepped ja kinnitatud kokkuvõtted, privaatsed märkmed, aus lõpetamine. Kohtumine ise võib toimuda platvormi ruumis või täielikult väljaspool (SUP V0 „protsessi mälu" pretsedent — Eesti praktika on suuresti kontaktkohtumised, ja ESTA enda mudelis lepivad mentor ja mentee kõik omavahel kokku).

### 1.2. Kasutajavajadus, mida see lahendab

1. **Alustaja/rollivahetaja tugi** — platvormi kõige tugevamalt tõendatud vajadus: Tööheaolu „Alustaja tugi" [MAIN] juba tuvastab mentorivajaduse (`starter_support.mentor_needed`), soovitab „kokkuleppida regulaarne kontrollpunkt juhiga või mentoriga" ja genereerib väljundi „Küsimused juhile või mentorile" — aga sellel väljundil pole täna SIHTKOHTA. Supervisioonile on rada (`recipientType="supervisor"`) olemas, mentorile mitte.
2. **Mentori leidmine** — ESTA peab avalikku mentorite andmebaasi (17 profiili on juba viitena seed-failis), kuid platvormil pole ühtegi leidmis- ega viitamispinda.
3. **Suhte järjepidevus** — mentorlus on kohtumiste seeria kokkulepitud eesmärkidega; ilma konteinerita jäävad eesmärgid, kokkulepped ja edenemine meilidesse ja mällu. Sama väärtusargument, mis SUP V0-l: seda osa ei paku ükski üldine videotööriist.

### 1.3. ESTA roll (fikseeritud piir)

ESTA tõendatud tänane roll (SUP tootemudel 3.1, veebikontroll 15.07.2026; käesolev analüüs EI korda kontrolli ega muuda järeldust): **mentorite andmebaasi haldaja ja huvikaitsja — MITTE teenuseosutaja, MITTE superviisorite kvalifitseerija, MITTE rakenduseroll.** ESTA mudelis valib kasutaja mentori ise, võtab otse ühendust ja lepib tasu kokku mentoriga; sihtrühm on laiem kui ESTA liikmed. Superviisorite register on ESCÜ/ANSE territoorium — mentorlus ja supervisioon EI jaga kvalifikatsiooniallikat.

Siduv piirang (SUP 3.1, kehtib siin muutmata): ühtegi „ESTA kontrollitud / ESTA kinnitatud" märgist ei kasutata ilma sõlmitud kokkuleppeta. Kanooniline seis: **ESTA partnerlus on kinnitamata; koodis 0 partnerlusvastet; midagi ei esitata kokkulepituna.**

### 1.4. Mida süsteem teeb ja mida teeb ESTA/organisatsioon väljaspool süsteemi

| Süsteem (SotsiaalAI) | Väljaspool süsteemi |
|---|---|
| Mentoriprofiilid (platvormi kasutajad) + viited välisele ESTA andmebaasile | ESTA mentorite värbamine, sertifikaatide kontroll, andmebaasi haldus (eswa.ee) |
| Taotlus → mõlemapoolne nõusolek → suhe → kohtumised → kokkuvõtted → lõpetamine | tasu kokkulepe ja maksmine (kui üldse); tööandja-sisesed mentorlusprogrammid |
| Privaatsed märkmed, kokkulepete mälu, teavitused, „Jätka siit" | kohtumine ise, kui pooled eelistavad kontakti/videot väljaspool |
| Admin: väliste viidete import + nõusolekustaatus + kataloogimoderatsioon | mentori individuaalse nõusoleku küsimine (e-kiri/telefon — inimtöö) |
| Auditijälg, purge, eksport, konto kustutuse käsitlus | ESTA programmi aruandlus oma rahastajale |

### 1.5. Piir naabervormidega (kellele mida EI ehitata)

| Vorm | Erinevus mentorlusest | Tehniline tagajärg |
|---|---|---|
| Supervisioon (T22) | juhitud refleksiooniprotsess; kvalifitseeritud protsessijuht (ESCÜ/ANSE); kontrakt + tellija-kolmnurk; rangeim konfidentsiaalsus | mentorlus EI kasuta SupervisorGrant'i, kontraktiversioonide masinat ega tellija-lepingut; SUP mudelid on kuju-doonorid, mitte jagatud tabelid (SUP Q2 otsus 5 pretsedent: töövood lahus) |
| Kovisioon | võrdsete kinnine grupp, 12 metoodilist invarianti, AI-keelud | mentorlus on kahepoolne suhe; Kovisiooni etapimasinat ei kopeerita; AI-piirid on mentorluses leebema astmega (ptk 7.4) |
| Koolitus | formaalne õpe, materjalid, rühm | mentorlusse EI ehitata kursuse-/materjalimoodulit; materjalid = tavalised failiviited |
| Võrgustikutöö / kohtumise ühisvaade (T20) | kliendi juhtumi ümber, mitmepoolne | mentorlussuhtes EI OLE klienti ega juhtumit; kliendiandmete toomine mentorlusse on keelatud (ptk 7.3) |
| Juhtumitöö (T21) | kliendi olukorra koordineerimine, STAR2-piir | mentorlus ei loe ega viita menteede juhtumitele; mentee toob ainult ÜLDISTATUD küsimusi |
| Alustaja tugi (Tööheaolu) [MAIN] | privaatne eneserefleksiooni tööriist | jääb muutmata; saab mentorluses SIHTKOHA (väljundmustandi üleandmine — ptk 5.4) |

### 1.6. Ühised võimekused, mis võetakse kasutusele (mitte ei ehitata uuesti)

K1 tööruumileping (descriptor + elutsüklisõnastik + adapteripiir); K1 4.6 osaleja-elutsükkel ja 4.7 artefakti-elutsükkel; NotificationEvent-konveier + U2 continuity [MAIN, toodangus]; U12 „Minu jagamised" leht; advisory-lock + version-CAS idioom; PracticeCapability/FrameworkAcceptance kinnitusmustrid; Tööheaolu väljundmustandi handoff-mehaanika (allowlist + sameInstant + handedOffAt); Room+kõne+nõusolekusalvestus (valikuline kohtumiskanal — `MENTORING_SUMMARY` eesmärk on juba UI-s); atomaarne sulgemine + purge + isiklik väljund (Kovisiooni/SUP muster); konto kustutuse Cascade/SetNull distsipliin; seed-faili nõusolekupoliitika.

---

## 2. Osalised ja õigused

### 2.1. Põhimõte

Ühtegi uut globaalset rolli EI looda. `User.role` jääb muutmata (CLIENT/SOCIAL_WORKER/SERVICE_PROVIDER/ADMIN). „Mentor" ja „mentee" on **suhtepõhised positsioonid** (kontekstipõhine õigus konkreetses MentoringRelation'is), „mentoriprofiili omanik" on **objektiomandus**, admin tegutseb **väljaspool sisu** protseduurirajalt. See järgib K1 4.3 kolmest eristust (konto-roll / tööruumiroll / admini eelvaade) ja RUUM-VIS 6.6 keeldu („ESTA ei ole uus roll").

### 2.2. Osaliste ja õiguste maatriks

| Osaline | Õiguse alus | Saab luua | Saab näha | Saab muuta | Saab jagada | Saab lõpetada | KINDLASTI EI näe | Ligipääsu teke → lõpp |
|---|---|---|---|---|---|---|---|---|
| **Mentor** (platvormi kasutaja) | MentorProfile omandus + MentoringRelation osalus | oma mentoriprofiili; kohtumisi; kokkuvõttemustandeid; oma privaatmärkmeid | oma profiili täielikult; suhte ühisala (eesmärgid, kokkulepped, kohtumised, kinnitatud kokkuvõtted); mentee taotluse teksti | oma profiili; suhte ühisobjekte; oma märkmeid | kinnitatud kokkuvõtet suhte SEES (välja mitte) | suhte (mõlemapoolse kinnitusega või ühepoolselt — ptk 4.3); oma profiili (RETIRED) | mentee muid tööruume, juhtumeid, Tööheaolu, vestlusi, Teekonda; teiste mentorite taotlusi | profiil ACTIVE + taotluse vastuvõtt → suhte sulgemine / profiili sulgemine |
| **Mentee** | MentoringRelation osalus | taotluse; kohtumisi; kokkuvõttemustandeid; oma privaatmärkmeid; Tööheaolu-väljavõtte üleandmise | kataloogi (ACTIVE profiilid); oma suhte ühisala; oma taotluste seisu | oma taotlust kuni vastuseni (tühistus); suhte ühisobjekte; oma märkmeid | oma ettevalmistuse mustandit suhtesse (teadlik jagamine) | taotluse (CANCELLED); suhte | mentori teisi suhteid ega nende olemasolu; mentori privaatmärkmeid; mentori admin-only kontaktivälju (väliste viidete puhul) | taotluse esitamine → suhte sulgemine |
| **Suhte algataja / suunaja** (nt juht, kolleeg) | — (V1: EI OLE süsteemiroll) | V1: ei midagi; ta saab jagada kataloogilinki väljaspool süsteemi | ei midagi suhtest | — | — | — | KOGU suhte olemasolu ja sisu — suunamine EI anna nähtavust (invariant I6, ptk 4.6) | — |
| **Organisatsiooni esindaja** | — (org-mudelit platvormil POLE — lisavastused ptk 1) | — | MITTE MIDAGI: ei fakti, ei sisu | — | — | — | kõike; ORG_META-fakti nähtavus on ORG-A0 + org-otsuse taga [DECISION, blokeeritud] | — |
| **ESTA / partnerorganisatsioon** | — (platvormil kontot/vaadet POLE) | — | MITTE MIDAGI platvormil; nende avalik andmebaas elab eswa.ee-s | — | — | — | kõike: liikmete platvormitegevust, suhteid, statistikat | — |
| **Administraator** | protseduurirada + auditijälg | EXTERNAL_REFERENCE profiilikirjeid (import); nõusolekustaatuse muudatusi | mentoriprofiilide moderatsioonijärjekorda ja profiiliandmeid (sh admin-only kontaktid); auditijälge; loendureid | profiili staatust (APPROVE/REJECT/REVOKE); väliste kirjete nõusolekustaatust | — | profiili (REVOKED, alusega) | **suhte sisu: ühisala, märkmeid, kokkuvõtteid — 404-norm (Kovisiooni IDOR-etalon)**; suhete loendit isikute kaupa väljaspool protseduurirada | admin-konto; iga toiming auditisse |
| **Vaatleja / kolmas osaline** | — | V1: EI OLE. Mentorlus on kahepoolne; kolmanda osaleja (nt kaasmentor) vajadus pole tõendatud | — | — | — | — | — | — |

### 2.3. Rollipiiride põhjendused

- **Mentoriks saamine ei ole kaitstud tiitel** (erinevus superviisorist): superviisori puhul on kvalifikatsiooniregister (ESCÜ) ja admin-grant (SUP M1); mentori puhul kvalifikatsiooninõuet ei ole — ESTA-l on OMA kinnitusprotsess oma andmebaasi jaoks, mis jääb ESTA-sse. Platvormil asendab granti **kataloogivärav**: profiil muutub teistele nähtavaks alles admini ülevaatuse järel (PENDING_REVIEW → ACTIVE). See on moderatsioon (kuritarvituse tõrje), mitte kvalifikatsioonikinnitus, ja UI ütleb seda ausalt.
- **Mentee võib olla SOCIAL_WORKER või SERVICE_PROVIDER; CLIENT mitte** — mentorlus on professionaalide tööriist (sama loogika, mis SUP Q2 lukustatud otsus 9). Kataloog ega mentorluspinnad ei ole CLIENT-rollile nähtavad.
- **Sama kasutaja võib olla ühes suhtes mentor ja teises mentee** — positsioon on suhtepõhine; keeld: sama paari sama-suunaline topeltsuhe ACTIVE-olekus (ptk 4.6 I7).
- **Kutse-/osalejasüsteem:** MentoringRequest on kahepoolne in-app nõusolekuvoog (CovisionParticipant/SUP M4 muster — ainult userId, e-postikutseta). Room+Invite token-kihti EI kasutata suhte loomiseks (COLLAB 2.2 keeld uue, NELJANDA osalejasüsteemi kohta ei rikuta: mentorlus on perekond B oma konteineriga, nagu Kovisioon ja SUP, ning kaardistub samasse ühissõnastikku K1 4.6 kaudu).

---

## 3. Täielik kasutajateekond

Läbiv navigatsioonipõhimõte: kõik algab ja lõpeb `/mentorlus` pinnal (ptk 8); U2 „Jätka siit" toob kasutaja pooleli oleva sammu juurde (kinnitamata kokkuvõte, vastuseta taotlus, läheneb kohtumine).

### 3.1. Vajaduse tekkimine

- **Põhitee A (alustaja):** Tööheaolu Alustaja tugi näitab signaali „vaja mentori tuge" → tööriista tulemuse juures on viide „Mentorlus" pinnale (kirje sisu EI liigu kaasa — ainult navigatsioon; üleandmine on eraldi teadlik samm 3.8).
- **Põhitee B (otse):** kasutaja avab töölaualt/karussellist „Mentorlus".
- **Põhitee C (mentor):** kogenud spetsialist avab „Mentorlus" → „Hakka mentoriks" → profiilivorm.
- Tühiseis: kasutajal pole suhteid ega taotlusi → pind selgitab, mis mentorlus on (ja mis see EI ole — piir supervisiooni/kovisiooniga, viitega neile), kuvab kataloogi ja „Hakka mentoriks" tee.
- Mobiil: sama pind, üks veerg; kataloog kaartidena.

### 3.2. Mentori otsing, soovitus, suunamine

- **Põhitee:** kataloog kuvab ACTIVE mentoriprofiilid: nimi, lühitutvustus, valdkonnad, teemad, keeled, vormid (kohtumine/veeb), mahutavus (võtab vastu / täis). Filtrid: valdkond, teema, keel. Lisaks püsiplokk „ESTA mentorite andmebaas" — VÄLINE link eswa.ee/mentorlus lehele koos ausa selgitusega („sõltumatu avalik andmebaas; kontakt otse mentoriga").
- CONSENTED välisviited (kui admin on mentori individuaalse nõusoleku saanud — ptk 6): kuvatakse kataloogis eristatava päritolumärgisega „profiil ESTA avalikust andmebaasist, viimati kontrollitud <kuupäev>" + link originaalile; platvormisisest taotlust neile esitada EI saa enne, kui mentor on ka platvormi kasutaja ja profiili üle võtnud.
- Tühiseis: 0 ACTIVE profiili → kataloog näitab ausalt „platvormil pole veel mentoreid" + väline ESTA-link + „Hakka mentoriks".
- Suunaja (juht/kolleeg) V1-s: jagab lingi `/mentorlus` või konkreetse profiili URL-i väljaspool süsteemi; süsteemis suunamisjälge EI teki (O-EM-8).
- Veaolukord: profiili avamisel RETIRED/REVOKED → kataloogist kadunud; otselink → „profiil pole enam saadaval" selgitusleht (mitte 404-leke).

### 3.3. Sobivuse ja pädevuse info

Profiilivaade: bioShort/bioFull, valdkonnad, teemad, keeled, vormid, kogemuse kokkuvõte — **mentori enda kinnitatud andmed** (self-declared), millel märge „andmed esitab mentor ise". Välisel viitel lisaks päritolu + kontrollikuupäev. MITTE ÜHTEGI kvaliteedimärgist, reitingut, edetabelit ega „platvormi kinnitust" (SUP 3.1 siduv piirang + RUUM-VIS 6.6 „liikmete edetabelite" keeld).

### 3.4. Ühenduse loomine ja mõlemapoolne nõusolek

- **Põhitee:** mentee avab profiili → „Soovi mentorlust" → lühivorm: eesmärk/ootus (vabatekst, ilma kliendiandmeteta — vorm hoiatab), soovitud vorm ja rütm → taotlus PENDING; mentor saab teavituse → näeb taotlust oma „Mentori vaates" → ACCEPT või DECLINE (põhjendus vabatahtlik, EI edastata sõnasõnaliselt — mentee näeb ainult viisakat keeldumisseisu).
- ACCEPT → süsteem loob MentoringRelation DRAFT + avab kokkuleppe sammu (3.5).
- Keeldumine: mentee näeb DECLINED; taotluse tekst jääb menteele; mentorile kaob aktiivvaatest.
- Aegumine: PENDING aegub 30 päevaga (EXPIRED); mentee näeb ja võib esitada uue (mitte samale mentorile enne X päeva — spämmitõrje, ptk 7.6).
- Tühistus: mentee võib PENDING taotluse tühistada (CANCELLED).
- Mahutavus: FULL-profiilile taotlust esitada ei saa (nupp keelatud + selgitus); race'i korral (kaks taotlust, mentor täitub) teine saab DECLINE'i automaatse asemel mentori otsusel — süsteem EI otsusta mentori eest.
- Veaolukord: taotluse esitamise 5xx → vorm säilitab sisu, selge veateade, retry.

### 3.5. Suhte loomine, eesmärgid ja kokkulepe

- **Põhitee:** DRAFT-suhtes kuvatakse mõlemale **mentorluskokkuleppe** vorm: eesmärgid (menteelt, toimetatav koos), kohtumiste eeldatav rütm ja vorm, konfidentsiaalsusreeglid (platvormi tekst: mida kumbki näeb, et sisu on kahepoolne, et kliendiandmeid ei jagata), kestuse siht (nt 6 kuud — soovituslik, mitte sundiv). Mõlemad kinnitavad → suhe ACTIVE. Kinnitus on versioonipõhine kirje (FrameworkAcceptance muster — kes, millal, millise tekstiversiooniga).
- Kokkuleppe hilisem muutmine: kumbki võib algatada; jõustub teise kinnitusega (uus versioon; vana kinnitus säilib ajaloos).
- Keeldumine/katkestus DRAFT-is: kumbki võib DRAFT-suhte katkestada (CLOSED ilma sisuta, reasonKey=not_started); teine saab teate.
- Aegumine: DRAFT ilma mõlema kinnituseta 30 päeva → automaatne sulgemine (teavitusega mõlemale).

### 3.6. Kohtumised: planeerimine, toimumine, jäädvustus

- **Põhitee:** kummagi poole loodav kohtumiskirje: kuupäev(+kellaaeg), vorm (platvormi ruum / väljaspool), teema (vabatekst, ühisala). Läheneva kohtumise teavitus mõlemale (`meeting.upcoming` muster). Toimumise järel märgitakse HELD; soovi korral koostatakse kokkuvõte (3.7).
- **Platvormi ruumis toimumine:** V1 EI ehita mentorluse-spetsiifilist kõnekihti. Kui pooled tahavad platvormil kohtuda, loob kumbki tavalise vestlusruumi (olemasolev Room+kõne [MAIN]) ja lisab lingi kohtumiskirjele (viide, SetNull); salvestuse eesmärk „mentorluskohtumise kokkuvõte" on kõne-UI-s juba olemas [MAIN]. `CallContextType.MENTORING` jääb reserveks hilisemale integreeritud kõnele (V2+).
- Muutmine/tühistamine: kumbki pool; teine saab teate; tühistatud kohtumine jääb ajalukku CANCELLED-ina.
- Tühiseis: 0 kohtumist → suhtevaade soovitab esimese kohtumise kirje luua.
- Mobiil: kohtumise kirje loomine ja HELD-märkimine on üherealised toimingud.

### 3.7. Märkmed, ülesanded, materjalid, edenemine

- **Privaatmärkmed:** kummalgi poolel oma, teisele mitte kunagi nähtavad (CovisionPrivateState/SUP M6 muster). Jäävad omanikule ka pärast suhte lõppu.
- **Kokkulepped järgmiseks korraks:** ühisala kirjed „mida proovin enne järgmist korda" — vastutaja (tavaliselt mentee) + tähtaeg (soovituslik); seis (tehtud/pooleli) märgitakse käsitsi; tähtaeg toidab `next_action` teavitust. See EI ole ülesannete projektijuhtimismoodul.
- **Kohtumise kokkuvõte:** mustand (kumbki võib koostada; AI võib aidata sõnastust ainult kasutaja palvel, DRAFT-märgisega) → mõlema kinnitus → CONFIRMED püsikirje. Kinnitamata mustand on klass-1 töömustand (COLLAB 1.3 kandjapiir) — purge'itav, mitte-eksporditav.
- **Materjalid:** V1-s linkidena ühisalal (vabatekst/URL); failimoodulit mentorlusse EI ehitata (FAILID T08 on omaniku otsusel edasi lükatud; mentorlus ei tekita uut failipinda).
- **Edenemine:** suhtevaade näitab: eesmärgid, kohtumiste arv, viimane kohtumine, järgmine kokkulepe — K1 descriptor'i kolm küsimust (kus olen / mis muutus / mis järgmiseks).

### 3.8. Tööheaolu sild (Alustaja tugi → mentorlus)

`WELLBEING_RECIPIENT_TYPES` saab väärtuse `"mentor"` (rakenduskihi konstant [MAIN failis `supportDrafts.js`], migratsioonita). Alustaja toe / muu tööriista väljundmustand (nt „Küsimused juhile või mentorile") muutub üleantavaks **mentee privaatalasse mentorlussuhtes** (SUP Q2.7 v2 pretsedent: siht on PRIVAATKIRJE, mitte ühisala — mentor EI näe enne, kui mentee teadlikult jagab eelvaatega). Handoff kasutab olemasolevat mehaanikat (allowlist + sameInstant + handedOffAt + unique-tõke).

### 3.9. Osalejate või mentori vahetamine

Mentorit EI vahetata suhte sees — see on uus suhe: vana suletakse (reasonKey=changed_mentor), uus taotlus uuele mentorile. Põhjendus: suhe ON mentor+mentee paar; „vahetus" sama konteineri sees looks vale ajaloo (kelle kokkulepped? kelle märkmed?). UI teeb selle tee lihtsaks („lõpeta ja leia uus mentor" viib kataloogi).

### 3.10. Paus, katkestamine, lõpetamine, tagasivõtmine

- **Paus:** kumbki pool võib suhte PAUSED-ida (rütm väljas: meeldetuletused vaikivad; õigused EI muutu — K1 4.2.2 p5); teine saab teate; kumbki võib taastada.
- **Korrapärane lõpetamine (põhitee):** kumbki algatab → lõpetamise vaade näitab, MIS SÄILIB (kinnitatud kokkuvõtted, kokkulepete ajalugu, faktikiri, kummagi privaatmärkmed omanikule) ja MIS KUSTUB (kinnitamata mustandid, ühisala toorkirjed) → algataja kinnitab → suhe CLOSED + purge samas tehingus (Kovisiooni closure-muster). Teine pool saab teate ja näeb sama „mis säilis" vaadet. Lõpetamine EI vaja teise nõusolekut (suhe on vabatahtlik — kumbki võib väljuda), aga teine pool NÄEB alati, kes ja millal lõpetas.
- **Vaikne katkemine:** suhe ilma ühegi kohtumise/kirjeta 90 päeva → süsteem küsib MÕLEMALT „kas suhe elab?" (teavitus); vastuseta 30 päeva järel → automaatne CLOSED (reasonKey=inactive) teavitusega. Ükski suhe ei jää igaveseks rippuma (K4 „igavesti vaikimisi keelatud" printsiip).
- **Tagasivõtmine:** mentee võib oma jagatud ettevalmistuse (3.8) tagasi võtta ENNE, kui mentor on seda avanud (recall — U3 muster); pärast avamist jääb külmutatud koopia + parandusvõimalus. Kinnitatud kokkuvõtet tagasi ei võeta — asendatakse uue versiooniga (superseded-ahel).

### 3.11. Järelvaade, tagasiside, eksport, arhiveerimine, kustutamine

- **Järelvaade:** CLOSED suhe jääb mõlemale loetavana „Lõppenud" loendisse: faktikiri + kinnitatud kokkuvõtted + kokkulepete ajalugu + OMA märkmed.
- **Tagasiside:** V1-s AINULT vabatahtlik lõpumärge kummaltki („kas mentorlus aitas?" 1 valik + vabatekst AINULT iseendale) — mitte mentori hindamine, mitte avalik arvustus (edetabelikeeld). Kasutatakse ainult kasutaja enda järelvaates.
- **Eksport:** kinnitatud kokkuvõtted ja kokkulepete ajalugu on eksporditavad (klass-2 kandja; EXPORT-P0 auditijäljemuster [BRANCH 65c82d04] eeskujuks; kirillitsa-PDF piirang E-2 kehtib — RU-kasutajale DOCX-rada). Töömustandid ja privaatmärkmed EI ole suhte-ekspordi osa; privaatmärkmed kuuluvad kasutaja enda andmekoopia (T16) skoopi.
- **Kustutamine:** suhet ei hard-delete'ita kummagi poole nupust (mitmepoolse ruumi kaitse — COLLAB 9.4); purge käib lõpetamise kaudu. Konto kustutamisel: ptk 7.5.

### 3.12. Kust kasutaja funktsiooni leiab ja kuidas tagasi jõuab

Sisenemine: professionaali töölaud/karussell → „Mentorlus" (`/mentorlus`); Tööheaolu Alustaja toe viide; U2 continuity kirjed (vastuseta taotlus / kinnitamata kokkuleppe versioon / kinnitamata kokkuvõte / lähenev kohtumine) toovad täpselt õigesse kohta; teavituste action-lingid (ptk 9). Iga alamvaade on otselingiga avatav (URL kannab seisu — teekonna-auditite õppetund).

---

## 4. Olekumasinad ja invariandid

Kõik olekud on rakenduskihi konstandid, MITTE PostgreSQL enum'id (kinnitatud platvormireegel). Iga kirjutus CAS-iga (version-väli); iga üleminek = auditisündmus + U1 teavitussündmus (ptk 9); kõik üleminekud idempotentsed (korduv üleminek samasse olekusse → 409/no-op, mitte topeltkõrvalmõju).

### 4.1. Mentoriprofiil (MentorProfile)

| Olek | Tähendus | Sisse | Tegija | Eeltingimus | Kõrvalmõju |
|---|---|---|---|---|---|
| DRAFT | omanik koostab | loomine | kasutaja | roll SOCIAL_WORKER\|SERVICE_PROVIDER | — |
| PENDING_REVIEW | ootab kataloogiväravat | submit | omanik | kohustuslikud väljad täidetud | admin-järjekorda; teavitus adminile |
| ACTIVE | kataloogis nähtav | approve | admin | review tehtud | teavitus omanikule; kataloogi |
| REJECTED | tagasi lükatud (põhjuskoodiga) | reject | admin | — | teavitus omanikule; omanik võib parandada → uus submit |
| PAUSED | omanik peatas (ei võta uusi) | pause/resume | omanik | ACTIVE | kataloogist välja; olemasolevad suhted EI muutu |
| RETIRED | omanik lõpetas mentorluse | retire | omanik | — | kataloogist välja; aktiivsed suhted jäävad kuni ise suletakse |
| REVOKED | admin sulges (alus auditisse) | revoke | admin | dokumenteeritud alus | kataloogist välja; aktiivsete suhete pooltele neutraalne teade „profiil suleti" (põhjust ei edastata) |

Välise viite (EXTERNAL_REFERENCE, `origin=ESTA_IMPORT`, userId=null) eraldi telg: `PENDING_CONSENT → CONSENTED | DECLINED_CONSENT | STALE` (admin muudab; CONSENTED = kataloogis viitena; STALE = kontrollikuupäev aegunud → kataloogist välja kuni uue kontrollini). Väline kirje EI saa kunagi ise ACTIVE-ks — platvormisuhteid saab ainult kasutaja-omanikuga profiil (ptk 6.3 ülevõtmisrada).

### 4.2. Mentorlustaotlus (MentoringRequest)

`PENDING → ACCEPTED | DECLINED | EXPIRED | CANCELLED`

| Üleminek | Tegija | Eeltingimus | Kõrvalmõju |
|---|---|---|---|
| loomine → PENDING | mentee | profiil ACTIVE + capacity OPEN + pole olemasolevat PENDING/ACTIVE sama paariga | teavitus mentorile |
| → ACCEPTED | mentor | PENDING | MentoringRelation DRAFT luuakse SAMAS tehingus; teavitus menteele |
| → DECLINED | mentor | PENDING | teavitus menteele (viisakas seis, põhjendust ei edastata) |
| → EXPIRED | süsteem (taimer) | PENDING ≥ 30p | teavitus menteele; mentori vaatest kaob |
| → CANCELLED | mentee | PENDING | mentori vaatest kaob (kviteering mentorile kui ta oli juba näinud → re-verify kaotab rea) |

### 4.3. Mentorlussuhe (MentoringRelation)

`DRAFT → ACTIVE → (PAUSED ⇄ ACTIVE) → CLOSED` (K1 4.2.1 sõnastikku kaardistub 1:1; ARCHIVED = CLOSED-vaate esitusklass, eraldi olekut ei vaja; PURGED-lipp CLOSED-i sees)

| Üleminek | Tegija | Eeltingimus | Kõrvalmõju |
|---|---|---|---|
| DRAFT (loomine) | süsteem (ACCEPT-tehingus) | taotlus ACCEPTED | kokkuleppe samm avaneb |
| DRAFT → ACTIVE | süsteem (viimane kinnitus) | MÕLEMA kokkuleppekinnitus samale versioonile | teavitus mõlemale; „viimane kinnitus lülitab" muster (EffectivePractice värav) |
| DRAFT → CLOSED (not_started) | kumbki pool VÕI taimer (30p) | DRAFT | teavitus teisele |
| ACTIVE → PAUSED / tagasi | kumbki pool | ACTIVE | teavitus teisele; meeldetuletused vaikivad |
| ACTIVE\|PAUSED → CLOSED | kumbki pool (värav: „mis säilib / mis kustub" kinnitus) VÕI taimer (inaktiivsus 90+30p) | — | **purge SAMAS tehingus** (4.5); teavitus teisele; U12 read lõpetatakse |

### 4.4. Kohtumine (MentoringMeeting)

`PLANNED → HELD | CANCELLED` (+ meta: mode PLATFORM_ROOM|EXTERNAL; occurredOn). Tegija: kumbki pool. Eeltingimus: suhe ACTIVE. HELD-i võib märkida tagantjärele; CANCELLED jääb ajalukku. Kohtumise aeg toidab `meeting.upcoming` teavitust; muudatus/tühistus teavitab teist poolt. Kohtumise kustutamist EI OLE (ajalugu on faktikiri) — vale kirje parandatakse muutmisega (auditijäljega).

### 4.5. Kokkuvõte (MentoringSummary) ja kinnitused

`DRAFT → PENDING_CONFIRM → CONFIRMED | DISCARDED`; kinnitus = MÕLEMA poole kinnituskirje (kahepoolne, mitte rollipõhine — SUP M10 osaluspõhise läve kergem juht). CONFIRMED = külmutatud klass-2 kandja (versioonitud; parandus = uus versioon supersedes-viitega). Suhte sulgemisel: DRAFT/PENDING_CONFIRM kustuvad (purge), CONFIRMED säilivad. Kokkuleppe kinnitus (MentoringAgreementAcceptance) on eraldi versioonipõhine kirje — `agreementVersion + userId + acceptedAt`, iga versiooni kohta mõlema kinnitus.

### 4.6. Invariandid (server jõustab alati)

- **I1. Suhet ei looda ühe poole teadmata:** MentoringRelation tekib AINULT ACCEPT-tehingus, mille sooritab mentor ise; ACTIVE-ks saab AINULT mõlema kokkuleppekinnitusega. Ühtegi „admin loob suhte" ega „suunaja loob suhte" rada ei eksisteeri.
- **I2. Eemaldatud/lahkunud pool ei säilita ligipääsu:** CLOSED lõpetab mõlema kirjutusõiguse; REVOKED-profiili omanik ei näe kataloogivaateid; konto kustutus koristab ristkihid samas tehingus (K1 4.10 p5).
- **I3. Lõpetamine ei saada soovimatuid teavitusi:** sulgemisel saab teate AINULT teine pool (mitte suunaja, mitte admin, mitte kunagi org); DECLINED on vaikne kolmandatele; ükski mentorlussündmus ei välju paarist (v.a admin-protseduurisündmused adminile).
- **I4. Mentor ei näe mentee muid ruume:** mentorlusosalus EI anna ligipääsu ühelegi teisele objektile (K1 4.1 „osaleja ≠ ligipääs päritoluobjektidele"); iga päring on suhte-skoobitud; võõras → 404.
- **I5. Admin ei näe suhte sisu:** 404-norm (Kovisiooni IDOR-runtime-etalon); admini pind piirdub profiilimoderatsiooni ja auditijäljega.
- **I6. Suunamine ei anna nähtavust:** süsteemis pole suunaja-positsiooni; ka tulevikus (org-voog) ei tohi suunamisfakt avada sisu (leping ORG-A0-le).
- **I7. Sama sündmuse kordus ei tekita duplikaate:** max 1 PENDING taotlus paari kohta (osaline unikaalindeks); max 1 mitte-CLOSED suhe sama suunaga paari kohta; teavituste dedupeKey `type:id:olek`; ACCEPT/kinnitused CAS-iga; purge idempotentne.
- **I8. Kliendiandmed ei sisene mentorlusse:** vormid hoiatavad + jagamisväravatel üldistuskinnitus (Kovisiooni anonüümsuskinnituse kergem vorm — kasutaja kinnitab, AI võib ainult hoiatada); mentorlusobjektid ei viita ühelegi juhtumi-/kliendiobjektile (FK-sid ei eksisteeri).
- **I9. Ükski mentorlussündmus/teavitus ei kanna vabateksti** (K1-U1 6.4 absoluutne payload-reegel).
- **I10. Kataloog ei ole edetabel:** järjestus neutraalne (nt uuemad/juhuslik), mitte „aktiivsuse" skoor; mõõdikuid osalejate kohta ei arvutata (COLLAB 8 „keelatud automaatsed järeldused" laieneb).

---

## 5. Olemasolev ja uus süsteemikiht (read-only koodiinventuur)

### 5.1. Olemas ja otse taaskasutatav [MAIN]

| Vara | Roll mentorluses |
|---|---|
| `Role` enum + fail-closed rollikontrollid | mentee/mentor lubatud rollid (SOCIAL_WORKER/SERVICE_PROVIDER); CLIENT väljas |
| NotificationEvent + dedupe + re-verify + 5-min toodangutimer | KÕIK mentorlusteavitused (uued type-väärtused, null uut kanalit) |
| U2 continuity koostur + `/api/workspace/continuity` | „Jätka siit": vastuseta taotlus, kinnitamata kokkulepe/kokkuvõte, lähenev kohtumine |
| U12 „Minu jagamised" (`lib/mySharings.js`, `/minu-jagamised`) | mentee üleantud ettevalmistuse valdusrida (kes näeb / kehtivus / tagasivõtt) |
| Advisory-lock + version-CAS idioom (`covisionLegacyWrite`, `outputDraftLock`) | lukuvõti `mentoring:${relationId}`; kõik olekuüleminekud |
| FrameworkAcceptance versioonipõhine kinnitus | kokkuleppekinnituse kuju |
| PracticeCapability/-Audit grant+audit kuju | EI kasutata grandina (mentor pole tiitel), aga append-only + SetNull auditikuju on M-EM8 etalon |
| CovisionPrivateState eraldi-privaatmudeli põhimõte | privaatmärkmed (EM7) |
| Kovisiooni atomaarne sulgemine + purge + IDOR-piirded (runtime-tõendatud) | suhte sulgemistehing; 404-normid |
| Tööheaolu väljundmustand + handoff-mehaanika (`supportDrafts.js`, allowlist+sameInstant+handedOffAt) | Alustaja tugi → mentee privaatala sild (recipientType `"mentor"` lisandub konstanti — migratsioonita) |
| Room + kõne + nõusolekusalvestus + `CallRecordingPurpose.MENTORING_SUMMARY` [MAIN, UI-s valitav] | valikuline platvormi-kohtumise kanal — mitte mingit uut kõnekihti |
| `CallContextType.MENTORING` [MAIN, skeemis, 0 kasutust] | reserveeritud V2+ integreeritud kõnele; V1 EI aktiveeri |
| `data/mentoring/esta-mentor-seed.json` + import-raport + poliitikad | admin-imporditööriista sisend ja EXTERNAL_REFERENCE kirjete nõusolekuleping |
| EXPORT-P0 aus eksport + auditijälg [BRANCH 65c82d04] | kinnitatud kokkuvõtete eksport (kui EXPORT on merge'itud; muidu V1 piirdub vaatega) |
| K1-P0 registry + descriptor + adapterimuster [BRANCH ef5973c9] | `mentoring_process` kind + adapter (registry laieneb ainult koos adapteriga — K1 4.9) |

### 5.2. Laiendamist vajav

- `WELLBEING_RECIPIENT_TYPES` — lisandub `"mentor"` (rakenduskihi konstant; 0 migratsiooni).
- U2 continuity koostur — mentorluse allikad (liidese laiendus, SUP Q2.8 sama muster).
- U12 andmeleping — mentee üleantud ettevalmistuse rida (olemasolev leht, uus allikas).
- Admin-ala — mentoriprofiilide moderatsioonijärjekord + EXTERNAL kirjete haldus (olemasoleva admini sisse, mitte uus adminipind).

### 5.3. Uuena loodav (minimaalne tähendus; migratsioone SIIN ei kirjutata)

| # | Objekt | Tähendus ja võtmeväljad (kontseptuaalselt) | Omanik | Säilitamine/kustutamine |
|---|---|---|---|---|
| EM1 | MentorProfile | userId? (null välisel), origin (SELF\|ESTA_IMPORT), status (4.1), consentStatus (välisel), displayName*, title, organization (TEKST, mitte FK — org-mudelit pole), fields[], topics[], languages[], formats[], bioShort/bioFull, experienceSummary, capacity (OPEN\|FULL), externalProfileUrl?, contactDisplayAllowed (välisel; vaikimisi false), checkedAt (välisel), review-väljad (reviewedBy SetNull, reviewedAt, reasonKey), version | SELF: kasutaja; IMPORT: admin | SELF: omanik kustutab/RETIRED; konto kustutusel Cascade; IMPORT: admin kustutab; STALE-aegumine |
| EM2 | MentoringRequest | menteeId, mentorProfileId, mentorUserId (denormaliseeritud sihtkasutaja), message (üldistatud vabatekst), status (4.2), expiresAt, respondedAt, version; osaline unique (menteeId, mentorUserId, status=PENDING) | mentee | terminaalsed kirjed: message anonümiseeritakse 90p pärast (jääb faktirida); konto kustutusel Cascade |
| EM3 | MentoringRelation | mentorUserId, menteeUserId, requestId? (SetNull), status (4.3), goalSummary (ühisala), agreementText + agreementVersion, pausedAt?, closedAt?, closedByUserId? (SetNull), closeReasonKey?, purgedAt?, lastActivityAt, version; osaline unique (mentorUserId, menteeUserId, status≠CLOSED) | paar (looja: süsteem) | CLOSED+purge (4.5); kinnitatud kandjad + faktikiri jäävad; retention-tähtaeg = eraldi õigusotsus (SUP otsuse 12 pretsedent — numbrit ei leiutata) |
| EM4 | MentoringAgreementAcceptance | relationId, userId, agreementVersion, acceptedAt; unique (relationId, userId, agreementVersion) | süsteem | append-only; Cascade suhtega |
| EM5 | MentoringMeeting | relationId, occurredOn(+time?), mode (PLATFORM_ROOM\|EXTERNAL), roomId? (SetNull — viide, MITTE omandus), topicSummary?, status (4.4), version | paar | faktikiri jääb CLOSED järel; topicSummary purge'itakse kui kokkuvõtet ei kinnitatud [vt O-EM-7] |
| EM6 | MentoringSummary | relationId, meetingId?, kind (MEETING\|MIDTERM\|FINAL), content, status (4.5), supersededById?, confirmedAt (tuletatav kinnituskirjetest EM4-analoog: MentoringSummaryConfirmation {summaryId,userId,confirmedAt}), version | paar | CONFIRMED jääb (külmutatud); DRAFT/PENDING purge sulgemisel |
| EM7 | MentoringPrivateNote | ownerId, relationId? (SetNull), content, createdAt/updatedAt | AINULT omanik | omaniku kontrolli all; suhte sulgemine EI puuduta; konto kustutusel Cascade |
| EM8 | MentoringAuditEvent | append-only, actor SetNull, action (PROFILE_SUBMITTED/APPROVED/REJECTED/REVOKED, REQUEST_*, RELATION_STARTED/PAUSED/CLOSED/PURGED, SUMMARY_CONFIRMED, CONSENT_STATUS_CHANGED, EXPORT_*), meta AINULT koodid/ID-d (vabatekst keelatud) | süsteem | audit_long klass |

Mudeleid EI jagata SUP-i tabelitega (töövood lahus — SUP Q2 otsus 5 sama loogika); taaskasutus on mustri-, mitte kooditasandil. FK-sid juhtumi-/Teekonna-/Tööheaolu-objektidele EI looda (I8; handoff teeb KOOPIA mentee privaatalasse).

### 5.4. Kõrvale jäetavad vanad/dubleerivad ideed

- ideed 26 „ühe euro mudel", liikmestaatuse kontroll (`estaMembership*` väljad), liikmeala — KÕIK partnerlusleppe taga; V1-st väljas.
- ideed 27 foorum/piirkonnaruumid/teemakogukonnad — ESTA kogukonnakiht, partnerlusleppe + T20 püsiruumi taga; EI kuulu mentorluse teemasse.
- ideed 22.5 „ESTA programmi haldus" töölaud — eeldab ESTA halduskontot platvormil; väljas kuni leppeta.
- „Superviisorite/mentorite turg", hinnavõrdlus, sobitusalgoritm — püsivalt mitte-ehitatavad (SUP 8 + RUUM-VIS 6.4).
- Mentorluse-spetsiifiline kõne-/salvestuskanal — Room-taristu katab; `CallContextType.MENTORING` aktiveerub alles integreeritud vajaduse tõendumisel.

---

## 6. ESTA ja välise partnerluse leping

### 6.1. Soovituslik vaikemudel (fikseeritud selle analüüsiga)

**ESTA on V1-s AINULT väline avalik allikas, millele viidatakse** — mitte partnerorganisatsioon platvormil, mitte kataloogihaldaja, mitte pädevuse kinnitaja. Kolm kihti:

1. **Väline link (0 lepingut, 0 riski):** kataloogipinnal püsiplokk „ESTA mentorite andmebaas" → eswa.ee/mentorlus. Tavaline allikaviide avalikule ressursile; midagi ei imporditata kuvamiseks.
2. **EXTERNAL_REFERENCE kirjed (individuaalse mentori nõusoleku taga; ESTA lepingut EI vaja):** seed-faili 17 kirjet imporditakse EM1 tabelisse `origin=ESTA_IMPORT, PENDING_CONSENT` — need on ADMIN-ONLY tööriistas, kataloogis nähtamatud. Kui mentor ise annab nõusoleku (admin dokumenteerib: kuupäev + viis), muutub kirje CONSENTED-iks ja ilmub kataloogi viitena (nimi, valdkonnad, teemad, bioShort, link originaalprofiilile; kontaktid AINULT kui `contactDisplayAllowed=true` eraldi nõusolekuga — seed-poliitika jõustub andmemudelis). Vastutus andmete õigsuse eest: kirje peegeldab ESTA avalikku profiili seisuga `checkedAt`; UI ütleb seda; aegunud kontroll (>12 kuud) → STALE → kataloogist väljas kuni admin uuendab käsitsi.
3. **Platvormiprofiili ülevõtmine (sild päris kasutuseni):** kui EXTERNAL-kirjes olev mentor liitub platvormiga, seob admin kirje tema kontoga (userId täidetakse, origin jääb ESTA_IMPORT päritolumärgiseks) → mentor toimetab ja submit'ib ise → tavaline PENDING_REVIEW → ACTIVE → talle saab esitada platvormisiseseid taotlusi. Ülevõtmiseta välisviitele platvormisisest taotlust EI saa — ainult „vaata ESTA profiili" link.

Andmete sisestusviis: käsitsi/seed-import admini kaudu. **Mitte mingit ESTA API-t, automaatset andmevahetust ega sünkroniseerimist ei eeldata ega ehitata** — sellist liidest ei eksisteeri ja lepingut pole.

### 6.2. Mis töötab ilma ühegi välise kokkuleppeta (partneri-neutraalsuse tõend)

Kogu põhiteekond (ptk 3) töötab, kui kataloogi esimesed profiilid on platvormi enda kasutajad: profiil → moderatsioon → taotlus → suhe → kohtumised → kokkuvõtted → lõpetamine. EXTERNAL-kihi võib jätta tühjaks (0 CONSENTED kirjet) ja väline link on tavaline viide. **Järeldus: ESTA-MENTOR-V1 EI sõltu ESTA-st.**

### 6.3. Mis vajab ESTA kokkulepet (teadlikult V1-st väljas)

| Võimalus | Vajalik lepe | Kuhu kuulub |
|---|---|---|
| „ESTA mentor" / „koostöös ESTA-ga" märgised kataloogis | partnerlusleping (ideed 25.4 märgisereeglid) | V2+ [DECISION] |
| Liikmestaatuse kontroll + liikmeala + „ühe euro mudel" | leping (ideed 26.7 loetelu) | eraldi teema, mitte T23 laiendus |
| ESTA piirkonnaruumid/foorum/teemakogukonnad | lepe + T20 püsiruumi kiht | tulevikuanalüüs pärast org-/partnerlusotsust |
| ESTA halduskonto/programmivaade platvormil | lepe + org-mudel | ORG-A0 järel |
| Andmebaasi süstemaatiline sünk/API | lepe + tehniline liides ESTA poolel | pole plaanis enne leppe olemasolu |
| Tutvustuspäev ja partnerluse ettevalmistus | inimtöö (lisavastused ptk 2 formaat on olemas) | koordinaator/tooteomanik, mitte arendus |

### 6.4. Pädevusinfo parandus, aegumine, eemaldamine

- SELF-profiil: omanik muudab igal ajal; sisulised muudatused ACTIVE-profiilil EI vaja uut review'd (kerge järelevalve: admin näeb muudatuste auditit; kuritarvituse korral REVOKE) — vaikevalik, mille võib karmistada [O-EM-2 alternatiiv].
- EXTERNAL-kirje: parandus ainult admini käsitsi uuenduse kaudu (checkedAt uueneb); mentori taotlusel (e-kiri) kirje eemaldatakse (DECLINED_CONSENT → admin kustutab); iga muudatus auditisse.
- Aegumine: STALE-reegel (6.1); ACTIVE SELF-profiilil aegumist pole (elab koos kontoga), aga 12 kuud ilma ühegi aktiivse suhteta ja sisselogimiseta → admin võib PAUSED-ida (käsitsi, mitte automaat — V1 ei ehita selleks taimerit).

---

## 7. Privaatsus, turvalisus ja säilitamine

### 7.1. Andmekihid ja nähtavus

| Kiht | Sisu | Näeb | Püsivus |
|---|---|---|---|
| Avalik-kataloog (rollipiiriga!) | ACTIVE profiili kuvaväljad; CONSENTED välisviite kuvaväljad | AINULT sisselogitud SOCIAL_WORKER/SERVICE_PROVIDER (CLIENT ja väljalogitu EI näe; avalikku веб-kataloogi EI OLE) | kuni PAUSED/RETIRED/REVOKED/STALE |
| Paari ühisala | eesmärgid, kokkulepe, kohtumised, kokkulepete kirjed, kokkuvõtted | ainult mentor+mentee | toorosa purge sulgemisel; kinnitatu jääb |
| Privaatne | kummagi märkmed; mentee üleantud ettevalmistus kuni jagamiseni; tagasisidemärge | ainult omanik (server jõustab; admin 404) | omaniku kontrolli all |
| Faktikiri | suhte olemasolu, olekud, kohtumiste kuupäevad, kinnituste ajatemplid | paar; admin AINULT auditiprotseduuris (mitte sirvitav loend) | jääb; retention-tähtaeg eraldi õigusotsus |
| Admin-only | EXTERNAL kirjete kontaktid (`publicContact`), nõusolekudokumentatsioon, review-põhjused | admin | kuni kirje kustutuseni; auditijäljega |

### 7.2. Kolmanda isiku andmed ja nõusolek

- EXTERNAL-kirjed ON kolmanda isiku (mittekasutaja) isikuandmed — õiguslik alus: avalikustatud allika viide + minimaalsed väljad + individuaalne nõusolek ENNE kataloogis kuvamist (seed-poliitika muutub DB-invariandiks). Kontaktandmed ei välju admin-kihist ilma `contactDisplayAllowed` nõusolekuta. Kirje kustutamine mentori nõudel on kohustuslik rada (6.4).
- Suhtesisus kolmandate isikute (klientide!) andmeid ei tohi olla — I8 üldistuskinnitus; see on mentorluse TEADLIK erinevus juhtumitööst: kui vajadus on juhtumipõhine, kuulub see kovisiooni/supervisiooni/juhtumitöösse, ja UI ütleb seda jagamisväraval.
- Nõusolekute tõendid: kokkuleppekinnitus versioonipõhiselt kasutaja keeles (RUUM-A0 5 K4 vea vältimine — snapshot kasutaja keeles); tagasivõtud ptk 3.10/3.11.

### 7.3. IDOR ja õiguste ületamise tõrje

Iga API-rada on suhte-/omaniku-skoobitud WHERE-iga; võõras → 404 (mitte 403-oraakel); admin sisus 404 (Kovisiooni runtime-etalon); kataloog filtreerib serveris rolli järgi; EXTERNAL kontaktiväljad ei sisaldu üheski mitte-admin serializeris (välja-tasemel allowlist, mitte UI-peitmine); profiilide enumeratsioon tõkestatud (kataloog ainult ACTIVE/CONSENTED; ID-ga päring võõrale DRAFT/PENDING kirjele → 404).

### 7.4. AI piirid mentorluses

Lubatud (kasutaja käivitatud, alati DRAFT-märgisega): kokkuvõtte ja kokkuleppe sõnastusmustand; mentee ettevalmistuse struktureerimine (Alustaja toe küsimused ongi olemas); selge keele tugi; RAG-allikapõhine taustainfo mentee küsimusele. Keelatud (arhitektuuriliselt, mitte poliitikana): mentorisoovitused/sobitusalgoritm; osapoolte hindamine või „suhte kvaliteedi"/aktiivsuse skoor; sisu automaatne analüüs või riskituvastus; automaatne transkriptsioon; andmete ristkasutus teistest moodulitest ilma kasutaja teadliku üleandmiseta. (SUP ptk 7 loogika, mentorluse astmes.)

### 7.5. Kustutamine, anonümiseerimine, konto kustutus

- Suhte sulgemine: purge-tehing (4.5) — kinnitamata mustandid ja ühisala toorkirjed kustuvad; kinnitatud kokkuvõtted, kokkulepete kinnitused, faktikiri jäävad; kummagi privaatmärkmed jäävad kummalegi.
- Konto kustutamine (DataDeletionJob orkestreering): kasutaja profiil ja privaatkihid Cascade; tema pool suhtest → suhe CLOSED (kui polnud) + teisele poolele jäävad kinnitatud kokkuvõtted ja faktikiri märkega „autor kustutatud" (K1 4.5 kandjareegel); teise poole privaatmärkmed EI hävine (O-TK9 L4 õppetund); auditikirjed actor→SetNull.
- Taotluse message anonümiseeritakse 90p pärast terminaalset olekut (EM2) — vabateksti ei hoita igavesti.
- Eksport: ptk 3.11; ekspordi fakt = auditikirje.

### 7.6. Kuritarvitus, blokeerimine, raporteerimine

- Taotluste rate-limit (nt max 5 PENDING korraga; sama mentorile uus taotlus DECLINED järel alles 30p pärast) — server jõustab.
- „Raporteeri profiil / suhte pool" → admini moderatsioonijärjekorda (olemasoleva raporteerimismustri laiendus; sisu EI avane adminile automaatselt — admin näeb raporti teksti, mitte suhte sisu; edasine käib protseduurirajalt).
- Mentor saab mentee bloki asemel suhte sulgeda (kahepoolne vorm ei vaja eraldi blokisüsteemi V1-s); korduva ahistava taotlemise tõrje = rate-limit + admini REVOKE-võimekus.
- Teavitustesse, logidesse ega ühelegi välisele osapoolele EI lähe: suhte sisu, vabatekst, osapoolte nimed teistele kasutajatele, EXTERNAL-kontaktid (I9 + 7.1).

---

## 8. Kasutajaliides ja ruumiline kogemus

### 8.1. Pinnad (kõik olemasoleva disainikeele sees; mitte eraldi „äpp")

| Pind | Route | Sisu |
|---|---|---|
| Mentorluse koduleht | `/mentorlus` | kaks vaadet rollipositsiooni järgi: „Minu mentorlus" (suhted, taotlused, jätkamiskaardid) + kataloog; mentori lisaplokk „Mentori vaade" (saabunud taotlused, minu profiil, mahutavus) |
| Kataloog + profiil | `/mentorlus` (loend) + `/mentorlus/mentor/[profileId]` | ptk 3.2/3.3; välise viite eristusmärgis; „Soovi mentorlust" värav |
| Minu mentoriprofiil | `/mentorlus/profiil` | loomine/muutmine/olek (DRAFT→PENDING_REVIEW→ACTIVE); mahutavus; RETIRE |
| Suhteruum | `/mentorlus/suhe/[relationId]` | ülevaade (eesmärgid; kus olen / mis muutus / mis järgmiseks — K1 descriptor); kokkulepe (+versioonid); kohtumised; kokkulepete kirjed; kokkuvõtted; MINU märkmed (selgelt eristatud privaatpaneel — Kovisiooni privaatpaneeli muster); lõpetamine |
| Lõpetamise/järelvaate vaade | suhteruumi seisund | „mis säilib / mis kustub" värav; CLOSED-vaates faktikiri + kinnitatud kandjad + oma märkmed |
| Admin | olemasoleva admini sektsioon | moderatsioonijärjekord; EXTERNAL kirjete import/nõusolek/STALE; auditivaade; loendurid (arvud, mitte sisu) |

Ruumiline keel: mentorlus on professionaali maja „uks" (RUUM-VIS 6.5/6.6 püsiruumi grammatika): ukseesine = minu suhted kaartidena; suhteruum = „laud" (ühisala) + „minu märkmik" (privaatpaneel, füüsiliselt eristatud) + „kapp" (kinnitatud kokkuvõtted ja lõppenud suhete arhiiv). Flight-/lennumehaanikat EI kasutata (suhe pole lineaarne rada; sama põhjendus, miks SUP valis variandi A). Ruumiline lavastus järgib SPATIAL-V1 (T19) ühist prototüüpi, kui see valmib — V1 võib alata tavapärase paneelipaigutusega; lavastus ei ole DoD-i tingimus.

### 8.2. Tekstid ja keeled

Kõik UI-tekstid `messages/et|en|ru.json` võtmetena (et-baasi pariteet — `i18n:check`); serveri loodud sisu AINULT i18n-võti + keelekood (RUUM-A0 4 K5 vea vältimine); kasutaja oma tekst jääb tekstina. Eristatavad sõnastikud: mentorlus ≠ supervisioon ≠ kovisioon terminid järjekindlalt (ideed 22.1 tabel on sõnastiku alus). Kokkuleppe kinnitussnapshot kasutaja keeles.

### 8.3. Ligipääsetavus (teema DoD, mitte hilisem audit — T15 reegel)

Klaviatuur: kõik vood läbitavad; fookusjärjekord; Escape sulgeb modaalid (ühine dialoogiprimitiiv, kui T15 on selle loonud — muidu olemasolev praktika). Ekraanilugeja: iga olekumuutus aria-live; kataloogikaardid loendina; privaatpaneelil tekstiline märgis „ainult sina näed" (mitte ainult visuaalne eristus). Kontrast ja 200% tekst; reduced-motion → flat (ruumiefektid välja, funktsioonikadu 0). Mobiil: üks veerg, alumine tegevusriba suhteruumis; kohtumise märkimine ja märkme lisamine ühe käega. Laadimis-/tühi-/veaseisud: igal pinnal skeleton + selge tühiseis + retry; katkenud POST ei kaota vormisisu.

---

## 9. Sündmused, teavitused ja taustatöö

Kanal: olemasolev NotificationEvent [MAIN] (in-app + emailPolicy opt-in); U1-P0 outbox'i valmides migreeruvad tüübid registrisse SAMA nime all (SUP Q2.8 joondus). Ühtegi uut sündmusePEREKONDA ei looda — kõik on K1-U1 ptk 7 perekondade (participant/workspace/artifact/meeting/consent) mentorlus-instantsid. Payload: AINULT koodid/ID-d/kuupäevad (I9). Kõik emit'id äritehingu sees; dedupeKey teeb korduskatse idempotentseks.

| Sündmus | Käivitaja | Saajad | Kanal | DedupeKey | Ack | Privaatsuspiir |
|---|---|---|---|---|---|---|
| mentoring.request_created | taotlustehing | mentor | N | request.id | otsus (accept/decline) või aegumine; re-verify: CANCELLED kaotab rea | mentee nimi kuvatakse lugemishetkel allikast; meta's ainult ID |
| mentoring.request_accepted / _declined / _expired | vastuse-/taimeritehing | mentee | N (+✉OPT accepted) | request.id:status | readAt | põhjendus EI liigu |
| mentoring.relation_activated | viimase kinnituse tehing | mõlemad | N | relation.id:active | readAt | — |
| mentoring.agreement_updated | uue versiooni esitus | teine pool | N | relation.id:vN | kinnitusotsus | tekst lugemishetkel |
| mentoring.meeting_upcoming | taimer (tallinnDate muster) | mõlemad | N,✉OPT | meeting.id:dateOn | toimumine/HELD | kuupäev, mitte teema |
| mentoring.meeting_changed / _cancelled | muutmistehing | teine pool | N | meeting.id:updatedAt | readAt | — |
| mentoring.summary_pending | mustandi esitus kinnituseks | teine pool | N | summary.id:vN:pending | kinnitusotsus | — |
| mentoring.summary_confirmed | viimase kinnituse tehing | mõlemad | N | summary.id:vN:confirmed | readAt | — |
| mentoring.next_agreement_due | taimer | vastutaja | N | item.id:dueOn | allika olekumuutus (source_resolved) | — |
| mentoring.relation_paused / _resumed | oleku tehing | teine pool | N | relation.id:status:at | readAt | — |
| mentoring.relation_closed | sulgemis-/taimeritehing | teine pool | N,✉OPT | relation.id:closed | readAt | reasonKey enum, mitte vabatekst |
| mentoring.inactivity_check | taimer (90p vaikus) | mõlemad | N | relation.id:periood | vastus („elab" / sulge) või 30p aegumine | sündmus EI ütle midagi sisust |
| mentoring.profile_submitted / _approved / _rejected / _revoked | moderatsioonitehing | omanik (submitted → admin-järjekord, mitte isikuteavitus igale adminile) | N | profile.id:status | readAt | reasonKey enum |
| mentoring.share_recalled (ettevalmistuse tagasivõtt) | recall-tehing | mentor (kui oli näinud → re-verify kaotab rea; muidu vaikne) | N | share.id:recalled | readAt | U3 kahe faasi muster |
| wellbeing → mentor handoff | kasutaja kinnitus | (teavitust EI — kasutaja enda toiming; U12 rida tekib) | — | handoff unique-tõke | — | sisu EI liigu sündmusesse |

Taustatöö (kõik olemasoleva 5-min NotificationEvent-timeri / laisk-sweep mustriga; uut worker'it EI looda): taotluste EXPIRED; DRAFT-suhte 30p sulgemine; inaktiivsuskontroll 90+30p; meeting_upcoming; next_agreement_due; EM2 message-anonümiseerimine; STALE-kontroll on admini käsitsi (V1-s taimerita). Iga taimer-toiming on idempotentne (olekukontroll + CAS enne kirjutust) ja PERF-i reaper/poll-mustritega kooskõlas.

---

## 10. Tooteotsused

Kõik kümme on lahendatud soovitusliku vaikevalikuga; **ükski EI blokeeri ESTA-MENTOR-V1 arendust** — pakett on ehitatud vaikevalikutele, mille muutmine hiljem on lokaalne.

| ID | Otsus | Soovituslik vaikevalik | Alternatiivid | Mõju kasutajale | Mõju andmemudelile/arendusele | Blokeerib? |
|---|---|---|---|---|---|---|
| O-EM-1 | Mentorluse arhitektuurikuju | eraldi kaitstud vorm (perekond B): oma konteiner EM1–EM8, K1 adapteriga; MITTE Room-profiil | (b) Room-profiil; (c) SUP-mudelite jagamine | selge piir supervisiooni/kohtumisega | fikseerib mudelid; COLLAB 1.1 kooskõla | EI (fikseeritud analüüsiga) |
| O-EM-2 | Mentoriks saamise värav | admini kataloogimoderatsioon (PENDING_REVIEW→ACTIVE); MITTE kvalifikatsioonigrant | (b) grant SUP M1 stiilis; (c) väravata | aus „pole kvaliteedimärgis" sõnum | ilma grant-tabelita; review-väljad EM1-s | EI |
| O-EM-3 | ESTA V1 roll | väline viide + EXTERNAL_REFERENCE individuaalse nõusolekuga (ptk 6.1); 0 lepet, 0 märgist | (b) oodata lepet ja jätta väline kiht välja; (c) kuvada avalikke profiile nõusolekuta (KEELATUD — seed-poliitika) | kataloog on kasulik ka enne partnerlust | consentStatus-telg EM1-s; admin-import | EI |
| O-EM-4 | Kes saab olla mentee/mentor | SOCIAL_WORKER + SERVICE_PROVIDER; CLIENT väljas | (b) ainult SOCIAL_WORKER; (c) CLIENT kaasa (KEELATUD — professionaalide tööriist) | selge sihtrühm | rollikontrollid | EI |
| O-EM-5 | Kohtumise kanal | faktikirje + valikuline tavaline Room-link; mentorluse-kõnet EI ehitata | (b) integreeritud kõne CallContextType.MENTORING peal | töötab ka kontaktkohtumistega | roomId SetNull viide; 0 kõnekoodi | EI |
| O-EM-6 | Tasu ja arveldus | platvormil 0 arveldust; tasu (kui üldse) lepitakse väljaspool (ESTA mudel; SUP otsus 7 pretsedent) | (b) arveldus (KEELATUD V1) | lihtne ja aus | 0 makseväljasid | EI |
| O-EM-7 | Sulgemise purge-ulatus | kinnitamata mustandid + ühisala toorkirjed + kohtumiste topicSummary kustuvad; kinnitatud kokkuvõtted, kokkulepete kinnitused, faktikiri, privaatmärkmed jäävad; retention-TÄHTAEG jääb õigusotsuseks (numbrit ei leiutata) | (b) SUP-rangusega täispurge; (c) kõik jääb | ausalt näidatav „mis säilib" | purgedAt lipp; purge-tehing | EI |
| O-EM-8 | Suunaja/organisatsiooni koht | V1: suunajat süsteemis EI OLE (link väljaspool); org-suunamisvoog ORG-A0 taga | (b) suunamiskirje kohe (EI — nähtavusrisk I6) | — | 0 suunamismudelt | EI |
| O-EM-9 | Tööheaolu sild | recipientType `"mentor"` + handoff mentee PRIVAATALASSE kuulub V1 skoopi | (b) hilisemasse paketti | alustaja põhivajadus saab sihtkoha | 1 konstant + handoff-allowlist | EI |
| O-EM-10 | Kliendiandmete piir | keeld + üldistuskinnitus jagamisväravatel (I8) | (b) vaba tekst hoiatuseta (EI) | kaitseb kliente ja pooli | kinnituslipp jagamisel | EI |

Hilisemad, teadlikult MITTE praegu otsustatavad: ESTA partnerlusleping ja märgised (O-EM-3 jätk, [DECISION tooteomanik+ESTA]); liikmeala/„ühe euro mudel"; ORG_META nähtavus (= O-CO-9); kinnitatud kandjate lõplik retention-tähtaeg (= SUP otsus 12 sama õigusküsimus); grupimentorlus (üks mentor + mitu menteed) — vajab osaleja-adapterit (COLLAB-P0) ja eraldi analüüsi.

---

## 11. Üks terviklik arenduspakett

### ESTA-MENTOR-V1 — mentorluse terviklik teostus (kopeeritav Sol/Terra ülesanne)

```
ÜLESANNE: ESTA-MENTOR-V1 — mentorluse terviklik teostus (masterregistri T23; üks haru, üks lõppüleandmine)

LOE ENNE: docs/platvormi arendus/fable-5-esta-ja-mentorlus.md (KOGU leping: teekond ptk 3, olekumasinad ptk 4,
andmemudel ptk 5.3, ESTA-piir ptk 6, privaatsus ptk 7, UI ptk 8, sündmused ptk 9, otsused O-EM-1…10);
fable-5-k1-tooruumi-leping-ja-u1-sundmuse-teavituskiht.md ptk 4 (descriptor/elutsüklid/invariandid);
fable-5-professionaalne-uhistegevus-vorgustikutoo-ja-kohtumise-uhisvaade.md ptk 1.3 (kandjapiir) ja 9.4 (vead,
mida ei korrata); supervisiooni tootemudeli Q2.1 mustritabel (kuju-doonorid); CLAUDE.md (dev-server, testid).

EESMÄRK JA KASUTAJALE NÄHTAV TULEMUS: sotsiaaltöö spetsialist leiab /mentorlus alt mentori (platvormi
kataloog + ESTA väline viide), esitab taotluse, sõlmib mõlemapoolse kokkuleppe, peab kohtumiste jada
(faktikirjed; valikuline Room-link), kinnitab kokkuvõtteid, hoiab privaatmärkmeid, annab Alustaja toe
väljundi mentorlusse üle ning lõpetab suhte ausalt (purge + säiliv järelvaade). Mentor haldab profiili ja
taotlusi. Admin modereerib kataloogi ja haldab ESTA EXTERNAL_REFERENCE kirjeid nõusolekulepinguga.

TÄPNE ULATUS (sisemised etapid; KÕIK samas harus, üks üleandmine):
  E1  Skeem + migratsioon: EM1 MentorProfile, EM2 MentoringRequest, EM3 MentoringRelation,
      EM4 MentoringAgreementAcceptance, EM5 MentoringMeeting, EM6 MentoringSummary(+Confirmation),
      EM7 MentoringPrivateNote, EM8 MentoringAuditEvent — ptk 5.3 tähendused; olekud rakenduskihi
      konstantidena (EI PG-enum'e); osalised unikaalindeksid (1 PENDING taotlus paari kohta; 1 mitte-CLOSED
      suhe suuna kohta) raw-SQL-iga; Cascade/SetNull ptk 7.5 järgi; version-väljad CAS-iks.
  E2  Teenusekiht lib/mentoring/**: profiili elutsükkel (4.1), taotlusvoog (4.2), suhte elutsükkel +
      kokkuleppekinnitus (4.3/4.5), kohtumised (4.4), kokkuvõtete kahepoolne kinnitus, privaatmärkmed,
      sulgemine+purge ÜHES tehingus (advisory-lock `mentoring:${relationId}` + CAS), auditikirjed (EM8),
      rate-limit (7.6). Kõik päringud suhte-/omaniku-skoobitud; võõras ja admin sisus → 404.
  E3  API app/api/mentoring/**: profile (CRUD+submit), catalog (roll-väravaga loend+filtrid), requests
      (create/respond/cancel), relations (get/agreement/pause/close), meetings, summaries (draft/confirm),
      notes, admin/mentoring (review-järjekord, EXTERNAL import+consent+STALE). Serveri lipud canX UI-le
      (UI EI arvuta õigusi — COLLAB 9.4 reegel).
  E4  Teavitused + taustatöö: ptk 9 tabeli tüübid olemasoleva NotificationEvent-konveieri peal (dedupe,
      re-verify, emailPolicy); taimerid olemasoleva sweep-mustriga (EXPIRED, DRAFT-30p, inaktiivsus 90+30p,
      meeting_upcoming, next_agreement_due, message-anonümiseerimine); U2 continuity allikad (vastuseta
      taotlus, kinnitamata kokkulepe/kokkuvõte, lähenev kohtumine); U12 rida mentee üleantud ettevalmistusele.
  E5  Tööheaolu sild: WELLBEING_RECIPIENT_TYPES += "mentor" (lib/wellbeing/supportDrafts.js konstant);
      handoff mentee privaatalasse (allowlist + sameInstant + handedOffAt + unique-tõke; SUP Q2.7 v2 muster:
      siht on PRIVAATKIRJE, mentor ei näe enne teadlikku jagamist; jagamine eelvaade→kinnitus→külmutatud
      koopia; recall enne avamist).
  E6  K1 adapter (TINGIMUSLIK): KUI codex/k1-p0-workspace-contract on selleks hetkeks merge'itud, lisa
      lib/workspaces/registry.js kind `mentoring_process` + read-adapter (MentoringRelation → descriptor:
      lifecycle/goal/nextAction/participants) + leping-test. KUI EI ole, jäta etapp vahele ja märgi
      lõpparuandes NOT_DONE põhjusega — ÄRA loo oma registrit ega blokeeri üleandmist.
  E7  UI: /mentorlus (koduleht: minu suhted + kataloog + mentori vaade), /mentorlus/mentor/[id],
      /mentorlus/profiil, /mentorlus/suhe/[id] (ülevaade/kokkulepe/kohtumised/kokkuvõtted/MINU märkmed
      selgelt eristatud privaatpaneelina/lõpetamise värav „mis säilib–mis kustub"), lõppenud suhete
      järelvaade; admin-sektsioon; navigatsioonikirje professionaali töölauale/karusselli; tühi-/laadimis-/
      veaseisud igal pinnal; olemasolev disainikeel (klaaspaneelid), ruumilist erilavastust EI nõuta.
  E8  ET/EN/RU + a11y + mobiil: kõik võtmed kolmes keeles (i18n:check roheline; hardcoded JSX-teksti lint
      keelab); klaviatuur+fookus+aria-live olekumuutustel; privaatpaneelil tekstiline „ainult sina näed";
      reduced-motion flat; mobiilivaated (üks veerg, kohtumise märkimine ja märge ühe käega).
  E9  Admin-import: skript/admin-toiming data/mentoring/esta-mentor-seed.json → EM1 (origin=ESTA_IMPORT,
      PENDING_CONSENT, kontaktid admin-only); import-raporti poliitikad jõustuvad väljatasemel.

ULATUSEST VÄLJAS (EI tee): ESTA partnerluslepet eeldavad osad (märgised, liikmestaatus, liikmeala, „ühe euro
mudel", piirkonnaruumid/foorum, ESTA halduskonto, API-sünk); org-/suunamisvoog; grupimentorlus; mentorluse-
spetsiifiline kõne/salvestus/transkriptsioon (CallContextType.MENTORING jääb kasutamata reserviks); arveldus;
sobitusalgoritm/soovitused/reitingud; failimoodul; SUP/Kovisiooni tabelite muutmine; CLIENT-rolli ligipääs.

SÕLTUVUSED JA FIKSEERITUD LEPINGUD: origin/main baas (fe4eb4fa või uuem); U1-P0/K1-P0 EI OLE eeldused
(E6 on tingimuslik); O-EM-1…10 vaikevalikud on siduvad; K1-U1 6.4 payload-reegel; COLLAB 9.4 veatabu;
kandjapiir (COLLAB 1.3); repo testireeglid (node:test, fake-prisma, EI elavat DB-d; referentsiaal →
npm run db:migrate:check).

TAASKASUTA (ÄRA ehita uuesti): NotificationEvent-konveier; U2 koostur; U12 leht; advisory-lock+CAS idioom;
FrameworkAcceptance kinnituskuju; CovisionPrivateState privaatmudeli põhimõte; Kovisiooni closure/purge
tehingumuster; wellbeing handoff-mehaanika; Room+kõne (MENTORING_SUMMARY salvestuseesmärk on juba UI-s);
seed-fail + poliitikad; olemasolev admin-kest.

ANDMEMUDEL/MIGRATSIOON: 8 uut tabelit (E1), 0 muudatust olemasolevates tabelites (recipientType on
rakenduskihi konstant); additiivne migratsioon + raw-SQL osalised indeksid; rollback = tabelite drop.

AUTOMAATTESTID (node:test, fake-prisma; sihtklassid): profiili olekumasin + moderatsioonivärav; taotluse
dedupe (osaline unique) + rate-limit + aegumine; suhte ACTIVE ainult mõlema kinnitusega (versioonipõhisus);
IDOR: võõras 404, admin sisus 404, CLIENT kataloog 404; kohtumise elutsükkel + roomId SetNull; kokkuvõtte
kahepoolne kinnitus + superseded-ahel; sulgemise purge atomaarsus (mis kustub / mis jääb / privaatmärkmed
püsivad); inaktiivsus-taimeri idempotentsus; wellbeing-handoff unique + privaatala siht + recall; EXTERNAL
kirje kontaktiväljade serializer-piir; teavituste dedupe + re-verify (CANCELLED kaotab rea); konto kustutuse
kaskaad + „autor kustutatud" kandja; i18n võtmete pariteet. Referentsiaalsus/kaskaadid: npm run
db:migrate:check (localhost Postgres).

RUNTIME-KONTROLL (sünteetiline; EI tootmisandmeid): lokaalne dev-server + temp-login (repo tsx-retsept,
localhost); 3 kontot (mentor, mentee, admin): profiil→submit→approve→kataloog→taotlus→accept→kokkuleppe
2 kinnitust→kohtumine (PLANNED→HELD)→kokkuvõte draft→2 kinnitust→Alustaja toe handoff→jagamine→sulgemine→
järelvaade; kõrvalkontroll: mentee2 üritab võõra suhte URL-e (404), admin üritab suhte sisu (404), CLIENT
üritab /mentorlus (välja); teavituste read + continuity kirjed olemas; purge järel toorsisu kadunud.

CLEANUP: ühtegi ajutist faili/route'i ei jää; console.log'id väljas; seed-import EI jookse automaatselt
(ainult admini käsitsi toiming); lint + i18n:check + npm test rohelised.

DEFINITION OF DONE: (1) põhiteekond ptk 3 on runtime-kontrolliga algusest lõpuni läbitav; (2) kõik ptk 4
invariandid I1–I10 testidega kaetud; (3) ptk 9 teavitused + taimerid töötavad idempotentselt; (4) ET/EN/RU +
a11y + mobiil E8 ulatuses; (5) admin-moderatsioon + EXTERNAL-nõusolekuhaldus töötab; (6) 0 muudatust SUP/
Kovisiooni/Room käitumises (regressioonitestid rohelised); (7) npm test + lint + i18n:check PASS; (8) E6
seis raporteeritud (DONE või NOT_DONE+põhjus).

LÕPPARUANNE: haru + commit'id + remote SHA; migratsioonide loend; testide arv ja tulemus; runtime-kontrolli
sammud + tulemused (tekstilogi); E6 seis; teadaolevad piirangud; NOT_PROVEN read kui tõend puudub; EI
merge'i ega deploy'd — üleandmine koordinaatorile.
```

### 11.1. Miks see on üks teema, mitte mikropaketid

Kõik etapid E1–E9 teenivad ÜHTE kasutajale nähtavat tervikteekonda; ükski ei oma iseseisvat väärtust ega eraldi otsuse-/migratsiooni-/deploy-piiri (masterregistri 1.2 kriteeriumid ei täitu). E6 tingimuslikkus on ainus paindekoht ja see on üleandmises aus raporteerimisrida, mitte eraldi pakett.

---

## 12. Arendusvalmiduse lõpphinnang

**Kas Sol/Terra saab `ESTA-MENTOR-V1` kohe alustada: JAH.**

- **Fikseeritud otsused:** O-EM-1…O-EM-10 vaikevalikud (ptk 10) + selle analüüsiga lukustatud piirid: mentorlus = perekond B oma konteineriga; uut globaalset rolli ei looda; CLIENT väljas; ESTA = väline viide + individuaalse nõusolekuga EXTERNAL_REFERENCE; 0 arveldust; kliendiandmete keeld; kohtumine = faktikirje + valikuline Room-link.
- **Päriselt blokeerivad sõltuvused:** puuduvad. K1-P0 ja U1-P0 EI ole eeldused (E6 tingimuslik; teavitused töötavad olemasoleval NotificationEvent-kihil nagu SUP V0 plaanis); SUP-P0 on kuju-doonor dokumendi kaudu, mitte koodisõltuvus; ESTA lepet ei vajata (ptk 6.2).
- **Teadlikult järgmistesse teemadesse:** ESTA partnerlus-/märgise-/liikmekiht (eraldi otsus+lepe); piirkonnaruumid/foorum (T20 + lepe); org-suunamine ja ORG_META (ORG-A0); grupimentorlus (COLLAB-P0 osaleja-adapteri järel); integreeritud kõne (CallContextType.MENTORING aktiveerimine); kinnitatud kandjate lõplik retention-tähtaeg (õigusotsus, = SUP otsus 12); mentorluse eksport-pakett EXPORT-V1 koosseisus.
- **Kas pakett katab tervikliku kasutajateekonna, õigused, privaatsuse, säilitamise, teavitused, navigeerimise, vead ja testimise:** JAH — vastavalt ptk 3 (teekond kõigi harudega: tühiseis/keeldumine/katkestus/aegumine/viga/õiguse kadu/mobiil), ptk 2+4 (õigused+invariandid), ptk 7 (privaatsus+säilitamine), ptk 9 (teavitused+taustatöö), ptk 8 (navigatsioon+seisundid), ptk 11 (testid+runtime-kontroll+DoD).
- **Kas ESTA lisamiseks on vaja välist kokkulepet enne koodi:** EI — esimene versioon on partnerineutraalne (ptk 6.2); ESTA-lepet vajavad ainult V1-st väljas olevad kihid (6.3). EXTERNAL_REFERENCE kirjete kataloogi jõudmine eeldab mentori INDIVIDUAALSET nõusolekut (mitte ESTA oma) ja ilma ühegi nõusolekuta on kataloog platvormikasutajate-põhine + väline link.
- **Blokeerivaid küsimusi:** 0 (maksimaalselt lubatud 3-st).

### Registrite uuendus (tehtud selle töökorraga)

1. `fable-5-tulevikufunktsioonide-suvaanaluusi-programm.md`: ESTA-MENTOR-A0 → COMPLETE + väljundfail + otsuste kokkuvõte + järgmine sõltumatu analüüs FIELD-A0 (registri järjekorra alusel: KOV-V2-A0 edasi lükatud, SUP-V1-A0 sõltuvus täitmata, ESTA-MENTOR-A0 valmis).
2. `arendusteemade-masterregister.md` T23 → `ANALYSIS_READY` + viide käesolevale analüüsile + katvusindeksi rida.

Koordinaatori handoff'i ega arendusprogrammi EI muudetud (koordinaatori pärusmaa).

## Jätkamispunkt

- **Seis:** kõik 14 etappi TEHTUD (Edenemistabel); STATUS: COMPLETE; dokument jääb elavaks — uus töökord lisab uue kuupäevaga rea, ei muuda ptk 0 lukustatud kontrolle.
- **Kontrollitud allikad (17.07.2026):** ptk 0 tabel; git read-only (`ls-remote` — origin/main muutumatu `fe4eb4fa`); serveri SSH-kontrolli EI korratud (tulevikuprogrammi registri 17.07 kontroll kehtib; reegel „ära tõesta samu fakte uuesti").
- **Peamised tulemused:** mentorluse definitsioon + piirid naabervormidega (ptk 1); osaliste maatriks ilma uue rollita (ptk 2); täisteekond kõigi harudega (ptk 3); 5 olekumasinat + 10 invarianti (ptk 4); koodiinventuur — 3 üllatavat olemasolevat vara (`CallContextType.MENTORING` reserv, `MENTORING_SUMMARY` kasutusel, Alustaja toe mentorivajaduse tuvastus) + 8 uut mudelit EM1–EM8 (ptk 5); partneri-neutraalne ESTA-leping kolme kihiga (ptk 6); privaatsus- ja purge-leping (ptk 7); UI + a11y DoD (ptk 8); sündmuste kataloog olemasoleval konveieril (ptk 9); 10 otsust, 0 blokeerivat (ptk 10); üks kopeeritav arenduspakett E1–E9 (ptk 11); lõpphinnang JAH (ptk 12).
- **Järgmine töökord siin dokumendis:** (1) kui tooteomanik muudab mõnd O-EM vaikevalikut, uuenda ptk 10 + paketi vastavat rida; (2) kui K1-P0 merge'itakse enne V1 algust, muuda E6 tingimusteta etapiks; (3) kui ESTA-ga sõlmitakse lepe, ava ptk 6.3 tabelist vastav kiht eraldi analüüsina; (4) V1 lõpparuande järel märgi siia teostuse seis.
- **Katkemise korral:** Edenemistabel + see punkt on tõeallikas; uus sessioon teeb UUE git-kontrolli ja lisab uue rea.

STATUS: COMPLETE
