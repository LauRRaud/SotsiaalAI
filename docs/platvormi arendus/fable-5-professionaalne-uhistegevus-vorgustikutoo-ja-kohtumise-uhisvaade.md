# Fable 5: professionaalne ühistegevus, võrgustikutöö ja kohtumise ühisvaade (COLLAB-A0)

STATUS: COMPLETE (esimene täisring 17.07.2026; vt lõpurida. COMPLETE tähendab valmis analüüsi, mitte valmis rakenduskoodi, ega anna ühelegi paketile arendusluba — iga pakett käib koordinaatori arendusvalmiduse väravast läbi eraldi.)

> Toote-, metoodika-, UX-, privaatsus- ja arhitektuurianalüüs: kuidas SotsiaalAI toetab professionaalset
> ühistegevust, võrgustikutööd ja ühist kohtumist ühe sidusa ruumilise töövoona K1 tööruumilepingu ja
> U1 sündmuskihi peal, ilma uue universaalse Workspace-supertabelita.
> Autor: Fable 5 (COLLAB-A0), 2026-07-17. Ainult analüüs — rakenduskoodi, skeeme, migratsioone ega teste ei muudetud.

## Edenemistabel

| Etapp | Sisu | Seis |
|---|---|---|
| 0 | Tõeallikad (git/origin/server/harud, read-only) | TEHTUD |
| 1 | Kohustuslike sisendite lugemine (8 dokumenti) | TEHTUD (loend Jätkamispunktis) |
| 2 | Koodikontroll (schema, K1-P0 haru, U10/U12, SUP-P0 haru) | TEHTUD |
| 3 | Ptk 1 — kasutusjuhud ja piirid | TEHTUD |
| 4 | Ptk 2 — osalejad ja rollid | TEHTUD |
| 5 | Ptk 3 — nõusoleku- ja jagamismaatriks | TEHTUD |
| 6 | Ptk 4 — ruumiline töövoog | TEHTUD |
| 7 | Ptk 5 — kohtumise ühisvaade | TEHTUD |
| 8 | Ptk 6 — võrgustikutöö mudel | TEHTUD |
| 9 | Ptk 7 — K1 ja U1 seos | TEHTUD |
| 10 | Ptk 8 — privaatsus ja ohutus | TEHTUD |
| 11 | Ptk 9 — hea ja halb praeguses platvormis | TEHTUD |
| 12 | Ptk 10 — tooteotsused | TEHTUD (10 otsust) |
| 13 | Ptk 11 — rakenduspaketid COLLAB-P0…P6 | TEHTUD |
| 14 | Ptk 12 — lõppväljund + master-registri uuendus | TEHTUD |

## 0. Tõeallikad (kontrollitud 2026-07-17, read-only)

| Allikas | Seis | Tõend |
|---|---|---|
| `origin/main` | `fe4eb4fa` — "merge: integrate Admin P0.1 safety gates and independent audit" | `git fetch` + `git log origin/main` 17.07 |
| Tootmisserver | `fe4eb4fa` — identne origin/main-iga; tööpuu puhas | `ssh sotsiaalai`, `/home/ubuntu/apps/sotsiaalai`, `git rev-parse HEAD` 17.07 |
| Lokaalne main | `0da4185b` — 1 ees / 22 taga; määrdunud tööpuud EI kasutata ega puudutata | `git rev-list --left-right --count` |
| `prisma/schema.prisma` | lokaalne = origin/main = tööpuu (bait-identne) — skeemi loen lokaalselt | `git diff --quiet` mõlemas suunas |
| K1-P0 | `codex/k1-p0-workspace-contract @ ef5973c9` — CODE_READY, AINULT harul; 5 uut faili (+885): registry, descriptor, Kovisiooni+Room read-adapterid, 318-realine lepingutest | `git show --stat` + registry sisu loetud |
| U1-P0 | koodi EI OLE; `READY_AFTER_K1`; O-K1-1/O-U1-1/O-U1-2 kinnitatud 17.07.2026 | arendusprogramm ptk 7.5/11 |
| SUP-P0 | `codex/supervision-v0-p0-schema @ 2fc826c4` — CODE_READY_LOCAL_ONLY, remote puudub; 13 mudelit | `git show` haru skeemist |
| U10 + U12/U3 | `lib/rooms/meetingSummaryShare.js`, `lib/mySharings.js`, `/minu-jagamised`, `app/api/my-sharings`, recall/corrections — **KÕIK origin/main-is ja serveris** | `git ls-tree origin/main` |
| Org-mudel | PUUDUB. `OrganizationAdmin(+File)` on RAG-sisu register (crawl/ingest-väljad), MITTE tenant-/liikmesusmudel | skeemi read 1611+ |
| Kohtumise/agenda/ülesande/võrgustiku mudelid | skeemis EI eksisteeri ühtegi | grep skeemi vastu |

Kolme seisundi eristus kehtib kogu dokumendis: `[MAIN]` = origin/main+server; `[BRANCH]` = ainult harul; `[VISION]` = ainult analüüsides. Lokaalne määrdunud tööpuu ei ole ühegi väite alus.

## 1. Kasutusjuhud ja piirid

### 1.1. Üksteist kasutusjuhtu kolmes perekonnas

Analüüsi esimene ja kandvaim eristus: need üksteist kasutusjuhtu EI OLE üks funktsioon. Nad jagunevad kolme perekonda, millel on sama alusleping (K1 + osaleja-/jagamiskiht), aga eri metoodiline, õiguslik ja konfidentsiaalsuspiir.

**Perekond A — professionaalne koostöö ja kohtumine** (sama alus, sama tulevane „kohtumise profiil"):

| Kasutusjuht | Tuum | Praegune kate [MAIN] | Eripära |
|---|---|---|---|
| Professionaalne konsultatsioon | kaks spetsialisti arutavad juhtumit/küsimust | Room (MANUAL_INVITE) + kutsed + kõne | kirjalik + kõne toimib; väljund (kokkulepe) puudub |
| Ühine juhtumitöö | mitu spetsialisti töötavad sama juhtumi ümber pikema aja | Room annab kirjaliku kanali; juhtumi-objekt puudub | vajab „liige ≠ juhtumiligipääs" reeglit ja püsiruumi elutsüklit |
| Võrgustikukohtumine | mitme osapoole (sh välised) koordineeritud kohtumine | ainult tavaline Room; rollid/piirid puuduvad | perekond A + perekond C piirimudel |
| Juhtumikonverents | formaalne mitme asutuse kohtumine inimese asjas | puudub | sama kohtumise profiil + RANGEIM dokumenteeritav kandja (1.3) |
| Nõupidamine inimese ja tugivõrgustikuga | inimene ise + lähedased + spetsialistid | puudub (U9 tugiisik on analüüsitud [VISION]) | inimene on OSALEJA, mitte objekt — vaikimisi nähtavus tema kasuks |
| Kohtumise ettevalmistamine | päevakord, materjalid, küsimused enne | MEETING_SUMMARY artefakt + vastuvõtulaud + receiverChecklist | privaatne faas; ühisvaatesse tõuseb ainult kinnitatu |
| Järeltegevused | kokkulepped → ülesanded → tähtajad → järelkohtumine | CovisionFollowUp (ainult Kovisioonis); `nextContactOn` (ainult eelpöördumisel) | K6 „järgmine tegevus" üldistus; U1 `workspace.next_action_*` |

**Perekond B — metoodiliselt kaitstud vormid** (SAMA leping adapteri kaudu, aga OMA konteiner — neid EI sulatata kohtumise funktsiooniks):

| Kasutusjuht | Miks ei tohi sulatada | Tõend |
|---|---|---|
| Kovisioon | 12 metodoloogilist invarianti (Q1.0): struktuur ON meetod; hinnanguvabadus; kirjalik-vaikne individuaaltöö; konfidentsiaalsus + kinnine grupp + üldistatud jälg + purge; tulemus EI OLE otsus ega menetlustoiming, vaid omaniku õppimine (Q1.8). Kohtumise ühisvaate mustrid (päevakord, otsused, ülesanded vastutajaga, protokoll) on Kovisioonis otsesed metoodikarikkumised | Kovisiooni teadmistekaart Q1.0/Q1.8/Q1.10 |
| Supervisioon | leping + tasuline/lepinguline suhe + superviisori kontrollitud kvalifikatsioon + org-tellija META-ONLY nähtavus + supervisandi kontrollitav kokkuvõte; protsessi disainib superviisor, mitte võrdsete grupp | SUP tootemudel Q1+Q2; SUP-P0 skeem [BRANCH] |
| Mentorlus | ekspert-suhe (mentor jagab „mida ja kuidas"), mitte võrdsete kohtumine; ESTA = mentorite andmebaas [DECISION, partnerlus] — kogu vorm on ESTA-MENTOR-A0 teema | Q1.8; supervisiooni tootemudeli ESTA-piir |

**Perekond C — üleandmisvood** (artefakti-, mitte ruumiloogika):

| Kasutusjuht | Miks mitte ruum | Tõend |
|---|---|---|
| Suunamine (inimese juhtumi üleandmine teisele teenusele/spetsialistile) | õige muster on KÜLMUTATUD ARTEFAKTI üleandmine kviteeringuga (PreInquiry SENT→opened→recall/correction), mitte adressaadi kutsumine ruumi. Ruumiliikmesus annaks suunatavale nähtavuse kogu edasisse vestlusse — üleandmine vajab piiri, mitte akent | PreInquiry elutsükkel [MAIN]; K1 4.7 artefaktileping |

### 1.2. Mida perekonnad jagavad ja mida mitte

Jagavad (üks kord ehitatav): K1 descriptor + elutsükkel; osaleja elutsükkel (kutse→vastus→osalus→lahkumine); nõusoleku-/jagamisleping (külmutatud koopiad, tagasivõtt, „Minu jagamised" nähtavus); U1 sündmused ja teavitused; artefaktileping (DRAFT→FINAL→SHARED→SUPERSEDED/REVOKED); auditijälg; retention-klassid.

EI jaga: faaside SISU (Kovisiooni 8 etappi ≠ kohtumise enne/ajal/järel ≠ supervisiooni leping→töö→lõpetamine); tööobjektide liigid ja nende whitelist'id; nähtavusklassi vaikeväärtust; kandja õiguslikku staatust (1.3); moderaatorirolli semantikat (Kovisiooni sessioonijuht on metoodiline roll, kohtumise juht on korralduslik).

### 1.3. Kandjapiir (õiguslik eristus, mis jookseb läbi kogu dokumendi)

Kolm kandjaklassi, mida EI TOHI segada:

1. **Töömustand** — privaatne või ruumisisene, kustub/purge'itakse mooduli reegli järgi; ei oma tõendiväärtust (nt märkmed, kokkuvõtte DRAFT).
2. **Kinnitatud kokkuvõte** — külmutatud FINAL-artefakt, jagatud koopiana, auditijäljega; platvormi „ametlikem" kuju; SIISKI mitte ametlik protokoll ega menetlusdokument.
3. **Ametlik kandja** — eksisteerib AINULT väljaspool platvormi (STAR2, asutuse dokumendihaldus). Platvorm annab „Kopeeri STAR2 jaoks" tüüpi väljundi, mitte kunagi automaatset saatmist ega menetluskoopiat (visiooni läbiv keeld; ideed 17 õigusotsused CASEWORK-A0 teema).

Juhtumikonverents on seepärast kohtumise profiili RANGEIM variant: sama tehniline alus, aga kohustuslik kinnitatud kokkuvõte (klass 2), määratud vastutajad ja eksport — mitte eraldi „konverentsimoodul".

## 2. Osalejad ja rollid

### 2.1. Rollikaart

K1 4.3 kolmene eristus kehtib (konto-roll vs tööruumiroll vs admini vaate-eelvaade). COLLAB lisab tööruumirollide profiili; ükski rida ei nõua uut konto-rolli (User.role jääb CLIENT/SOCIAL_WORKER/SERVICE_PROVIDER/ADMIN).

| Roll ülesandes | K1 tööruumiroll | Kes olla saab | Mida teeb / EI tee | Olemasolev vaste |
|---|---|---|---|---|
| Tööruumi omanik | OWNER | ruumi looja (voog või käsitsi) | elutsükli lõpp; kutsed; EI saa lahkuda enne üleandmist (U11 puudub [MAIN]!) | Room.ownerId; CovisionCase.ownerId |
| Koordinaator | RESPONSIBLE (+ MODERATOR) | määratud spetsialist | vastutab JÄRGMISE tegevuse eest; võib erineda omanikust | closure.assignedFollowUpUserId; SUP supervisorId muster |
| Vastutav spetsialist | RESPONSIBLE | SOCIAL_WORKER/SERVICE_PROVIDER | ülesande/otsuse vastutaja; descriptor kannab alati owner+responsible | K1 4.1 |
| Osalev spetsialist | MEMBER | kutsutud professionaal | töötab ruumi sisus; EI halda osalejaid | RoomMember MEMBER |
| Klient / pöörduja | MEMBER (kliendisuhte lipuga) | CLIENT-konto | võrdne suhtluses; ERI vaikimisi nähtavus (3. ptk); tema sisend märgistatud päritoluga | Invite.relationshipType=CLIENT [MAIN] — kutse JUBA eristab! |
| Lähedane / tugiisik | MEMBER (piiratud skoobiga) | kutsutud isik, inimese nõusolekul | näeb AINULT kutsel fikseeritud ulatust; U9 rada [VISION] | puudub; Invite scopeNote [VISION] |
| Väline kutsutud spetsialist | MEMBER/OBSERVER, tähtajaline | e-postiga kutsutu (konto tekib liitudes) | ajaline kehtivus kohustuslik; „liige ≠ päritoluligipääs" | Invite (expiresAt, token) |
| Vaatleja | OBSERVER | kokkuleppel | näeb kitsamat sisu, EI muuda; Kovisioonis lisamine = grupi konsensus (KOV-Q1-DEC-2), kohtumisel omaniku otsus — SAMA roll, ERI lisamisreegel | CovisionParticipantRole.OBSERVER |
| Mentor | — (ESTA-MENTOR-A0) | — | EI defineerita siin; mentorlussuhe ei ole kohtumise roll | — |
| Organisatsiooni esindaja | ORG_META vaataja [TULEVIK] | org-tellija | näeb toimumise FAKTI, MITTE KUNAGI sisu; blokeeritud org-otsusega | SUP org-leping [VISION]; ORG-A0 |
| Administraator | — (väljaspool ruumi) | ADMIN | EI näe ega ava ruumi sisu (404-norm, Kovisiooni IDOR-tõend); toimingud ainult protseduurirajalt auditijäljega. LAHTINE: moderatsioonifilosoofia lahknevus — kõnedes ADMIN modereerib, sõnumites mitte (RUUM-A0 3 K6b) | K1 4.3/4.10 |

### 2.2. Osaleja elutsükli leping

K1 4.6 kanooniline elutsükkel kehtib muutmata: `INVITED → ACCEPTED | DECLINED | EXPIRED`, seejärel `ACTIVE → LEFT | REMOVED | WITHDRAWN`. COLLAB-i täpsustused iga ülemineku kohta:

| Üleminek | Leping | Olemasolev tõend / auk |
|---|---|---|
| Kutsumine | kutse kannab: roll + **nähtavuspiir (scopeNote)** + eesmärk + kehtivusaeg + kutsuja PÄRIS identiteet (profiilinimi, mitte e-post — RUUM-A0 6 K6 viga ei tohi korduda); kliendisuhte kutse (relationshipType=CLIENT) käivitab kliendi-vaikimisi (ptk 3) | Invite [MAIN] on tugev alus (tokenHash, aegumine, revoke/resend, rate-limit); scopeNote puudub; expiresAt ÜLEMPIIRITA (RUUM-A0 6 K3) |
| Vastuvõtmine | liitumine = nõusolek ruumi reeglitega; kutsutu näeb ENNE liitumist: kes kutsub, mis eesmärgil, mis rolliga, mida ta nägema hakkab | accept-voog [MAIN]; „mida nägema hakkab" eelvaade puudub |
| Keeldumine | DECLINED on vaikne (kutsujale U1 sündmus, mitte põhjendus); keeldumine EI tohi olla nähtav teistele osalejatele | CovisionInviteStatus.DECLINED muster |
| Eemaldamine | OWNER (+ MODERATOR [DECISION moodulipõhiselt]) eemaldab; eemaldatu SAAB teate; eemaldamine koristab ristkihid SAMAS tehingus (kõneosalus, consent-read — RUUM-A0 16 K3 fantoom-osaleja viga ei tohi korduda) | „kick" endpointi ei eksisteeri [MAIN] — sünnib koos lepinguga |
| Lahkumine | alati võimalik (v.a OWNER enne üleandmist); panus JÄÄB ruumile, ligipääs lõpeb (leftAt + SSE 20s taaskontroll on tõendatud muster); lahkumine vajab kinnitusdialoogi (täna 1 klõps — RUUM-A0 16 K6b) | leave [MAIN]; kõneosaluse koristus puudub |
| Aegumine | kutse EXPIRED taimeriga; VÄLISE osaleja liikmesus võib olla tähtajaline (validUntil — PracticeCapability muster on koodis olemas) | Invite.expiresAt [MAIN]; liikmesuse tähtaeg puudub |
| Rollimuutus | OWNER muudab MEMBER⇄MODERATOR/OBSERVER; iga muutus = U1 sündmus + auditikirje; rollimuutus EI muuda tagasiulatuvalt, mida inimene juba nägi | üheski moodulis pole [MAIN] |
| Omaniku/vastutuse üleandmine | kaheastmeline: praegune algatab → uus KINNITAB (O-KO1 kinnitusreegel [DECISION]); üleandmiseta ruum sureb omanikuga (RUUM-A0 16 K6a: täna on omaniku ainus väljapääs ruumi häving!) | U11 analüüsitud [DOC]; koodi pole; UI kustutusvärav loeb role'i, server ownerId — kaks eri andmevälja ilma invariandita (16 K5) on üleandmise esimene riskikoht |
| WITHDRAWN | osalusnõusoleku tagasivõtt ≠ lahkumine: nõuab PANUSE käsitlusreeglit (kas varasem panus jääb) — moodulipõhine tooteotsus (K1 11.3), SUP-i pretsedent tuleb SUP-P1-ga | SupervisionParticipationStatus [BRANCH] |

Kolm osalejasüsteemi (Room+Invite [MAIN], CovisionParticipant [MAIN], SupervisionParticipation [BRANCH]) EI liideta füüsiliselt — leping kaardistab nad ühte sõnastikku (K1 variant A). Uus reegel: ükski COLLAB-i funktsioon ei loo NELJANDAT osalejasüsteemi; kohtumine ja võrgustik kasutavad Room+Invite alust (K1 4.11 keeld on siin siduv).

## 3. Nõusolek ja jagamine

### 3.1. Objektiklassid ja jagamismaatriks

Üldist „jaga kogu juhtum" lahendust EI OLE ega tule (K1 4.11; RUUM-VIS 6.1 keeld). Jagamine käib objektiklassi kaupa; iga klass kannab oma nõusoleku-, kestuse- ja tagasivõtulepingut:

| # | Objekt | Kes jagab | Kellele | Eesmärk (nähtav adressaadile) | Kestus | Jagamine nähtav (U12) | Nõusoleku tõend | Tagasivõtt | Varem jagatud koopiate saatus |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Isiklik märge (inimese oma, nt Teekonna sisu) | EI JAGATA kunagi otse | — | — | — | — | — | — | jagatav on ainult külmutatud VÄLJAVÕTE (shareKeys→PreInquiry muster) |
| 2 | Spetsialisti privaatne töömärge | EI JAGATA; jääb autori omandiks | — | — | konto eluiga / mooduli reegel | ei (privaatne) | — | — | ei eksisteeri koopiaid; kohtumise ühisvaatesse ei tõuse KUNAGI (K8 privaatne kõrvalpind) |
| 3 | Jagatud fakt (nt kohtumise aeg, staatus, osalejad) | süsteem tehingu käigus | osalejad | ruumi töö | ruumi eluiga | jah (liikmesusena) | liitumisnõusolek | lahkumine lõpetab edasise | fakt jääb ruumi ajalukku (üldistatud jälg) |
| 4 | Inimese enda sisend (tema sõnad, tema kinnitatud) | inimene ise | ruumi osalejad | kutsel fikseeritud | kuni tagasivõtuni | jah | päritolumärgis „inimese öeldud/kinnitatud" (K2) | enne adressaadi avamist: recall (U3 muster); pärast: parandus (supersededBy) | külmutatud versioon + parandusahel; „autor kustutatud" markeriga koopia (O-TK9 pretsedent) |
| 5 | Kolmanda isiku teave (mittekasutaja andmed juhtumis) | spetsialist TEADLIKU otsusega | minimaalne ring | dokumenteeritud vajadus | võimalikult lühike | jah + päritolumärgis „kolmanda isiku teave" | õiguslik alus [DECISION O-CO-6 — GDPR-analüüs enne võrgustiku-MVP-d] | kohustuslik rada | miinimum: ei kopeerita artefaktidesse ilma uue otsuseta |
| 6 | Kohtumise päevakord | kokkukutsuja | osalejad (sh kutsutud, enne liitumist [DECISION O-CO-5]) | kohtumise ettevalmistus | kohtumise eluiga | jah | DRAFT→CONFIRMED kinnitusega | muudetav kuni kohtumiseni; muudatus = U1 sündmus | kinnitatud päevakord külmub kokkuvõtte osaks |
| 7 | Otsus (kohtumisel vastu võetud) | vastutav osaleja fikseerib | osalejad | kokkulepe | püsiv (kuni ruumi arhiivini) | jah | kinnitusahel (kes nõustus; eriarvamus SÄILIB) | otsust EI võeta tagasi — asendatakse UUE otsusega (superseded-ahel) | otsuse ajalugu on artefakti versiooniahel |
| 8 | Ülesanne (vastutaja + tähtaeg) | otsustaja/koordinaator | vastutaja + osalejad | järeltegevus | kuni täitmise/tühistamiseni | jah | vastutaja ACK (U1 ackMode=explicit) | tühistamine = olekumuutus, mitte kustutus | ajalugu ruumis; tähtaeg → workspace.next_action_due |
| 9 | Kinnitatud kokkuvõte | vastutav spetsialist (FINAL järel) | osalejad; valikuliselt inimene | kohtumise kandja (klass 2) | püsiv külmutatud | jah | FINAL + jagamisotsus + osalejate kinnitus/eriarvamus (5. ptk) | REVOKED enne avamist; pärast SUPERSEDED uue versioonina | külmutatud koopia adressaadil; auditikirje (U10 auk RUUM-A0 8 K2 SULETAKSE); „autor kustutatud" marker |
| 10 | Eksporditud artefakt (PDF/DOCX väljaspool platvormi) | õigustatud osaleja | väljaspool platvormi | dokumenteeritud eesmärk | platvormi kontroll LÕPEB | jah (ekspordi fakt + auditikirje) | ekspordikinnitus | VÕIMATU — UI ütleb seda ausalt (EXTERNAL_EMAIL aususe pretsedent U12-s) | pöördumatu; seepärast eksport ainult kinnitatud kandjast, mitte mustandist |

### 3.2. Läbivad reeglid

1. **Külmutatud koopia on vaikimisi jagamiskuju** (PreInquiry/TopicSeed/EffectivePracticeVersion/U10 ühine muster [MAIN]); elav viide on dokumenteeritud erand.
2. **Iga jagamine on nähtav „Minu jagamistes"** — U12 [MAIN] laieneb kohtumise/võrgustiku objektidele samas valdusriba-vormis („kes näeb / päritolu / kehtivus"). See on olemasolev leht, mitte uus.
3. **Tagasivõtu kaks faasi** on platvormi norm: enne avamist eemaldav recall; pärast avamist parandus uue versioonina (U3 [MAIN] pretsedent). UI ei luba kunagi muljet, et tagasivõtt kustutab inimese mälu (U12 aususreegel).
4. **Nõusoleku tõendamine**: kinnituse ajatempel + teksti külmutatud snapshot + versioon (CallRecordingConsent muster) — snapshot KASUTAJA KEELES (RUUM-A0 5 K4 viga: täna ainult eestikeelne tõend — uude süsteemi ei kanta).
5. **Nõusoleku tagasivõtt on TEADE + mooduli JÕUSTAMINE samas tehingus** — U1 consent.withdrawn ei tohi luua illusiooni „teavitatud = peatatud" (FAILID F-01 egress-õppetund; K1 7.4).
6. **Konto kustutamise kandjareegel**: adressaadile jääb külmutatud koopia märkega „autor kustutatud"; töömärkmete omand jääb nende autorile (O-TK9 B-variandi loogika on COLLAB-i vaikesuund; lõplik valik on lahtine tooteotsus, mis kehtib ühtviisi kohtumise kokkuvõtetele).

## 4. Ruumiline töövoog

### 4.1. Faasid ja inimese võimed igas faasis

`ettevalmistus → osalejate kutsumine ja nõusolek → ühine töö või kohtumine → otsused → järeltegevused → lõpetamine või arhiiv`

| Faas | Näeb | Saab muuta | Peab kinnitama | Saab tagasi võtta | Saab jagada | Saab eksportida | Saab delegeerida |
|---|---|---|---|---|---|---|---|
| Ettevalmistus | oma mustandid; päevakorra mustand; keda plaanitakse kutsuda | päevakorda, materjalivalikut, oma sisendit | — (kõik on mustand) | kõike (kustutada mustandi) | mitte midagi veel | mitte midagi | ettevalmistuse teisele spetsialistile (koos materjalivalikuga) |
| Kutsumine ja nõusolek | kes on kutsutud, mis rollis, mis piiriga; kutse seisu (SENT/ACCEPTED/DECLINED/EXPIRED) | kutseid (revoke/resend); nähtavuspiiri ENNE vastuvõttu | kutse saatmise (värav); kutsutu: liitumise = reeglitega nõustumise | kutse (revoke [MAIN]) | päevakorra kutsutuile [DECISION O-CO-5] | mitte midagi | kutsumisõiguse moderaatorile |
| Ühine töö / kohtumine | ühisala + OMA privaatpaneeli (K8); osalejate kohalolu ja rolli; aktiivse faasi | ühisobjekte rollipiires; oma märkmeid | sõnastatud otsuseid/kokkuleppeid (värav) | oma kinnitamata sisendi | oma sisendit ühisalale (teadlik tõstmine, mitte automaatne) | mitte midagi (töömustand ei ekspordita) | märkmete pidamise/ülesande koostamise |
| Otsused | otsuste loendi + kinnitusseisu + eriarvamused | eriarvamust lisada; otsust ENNE kinnitust | oma kinnituse VÕI eriarvamuse | eriarvamuse sõnastust enne lukku | — (otsus on ruumi oma) | — | otsuse vormistamise vastutajale |
| Järeltegevused | ülesanded, vastutajad, tähtajad; „mis muutus" (U1 timeline) | oma ülesande seisu; tähtaega (vastutaja) | ülesande vastuvõtu (ack) | ülesande tagasi anda (vastutaja vahetus) | kokkuvõtte adressaatidele (9. objekt) | kinnitatud kokkuvõtte | ülesande teisele (uus vastutaja kinnitab) |
| Lõpetamine / arhiiv | mis säilib, mis kustub (enne kinnitust!); arhiivivaate | — | lõpetamise värava (CLOSED = teadlik otsus, mitte taimer) | — | — | lõpp-paketi (kinnitatud kandjad) | omaniku üleandmise (kui ise lahkub) |

### 4.2. Kolm esitust (K8)

- **Töölaud:** ruum on „laud + sein + privaatpaneel" — aktiivne faas esil, ülejäänud kättesaadavad, mitte korraga nähtavad. Ühisvaade ja privaatne märkmik on SAMA ruumi kaks kihti, piir tekstiga märgitud (mitte ainult asukohaga).
- **Mobiil:** üks faas = üks ekraan; alumine tegevusriba (dokk-muster); dikteerimine sisestuseks; kohtumise ajal „ainult see, mida praegu vajan" (päevakorrapunkt + märkmeväli + otsuse nupp).
- **Ligipääsetavus:** iga faas ja seis on esitatav loendina (K1 esitusnõue); faasivahetus teatatakse aria-live'iga; klaviatuuriga läbitav; reduced-motion → flat-režiim ilma funktsioonikaota. Info üleküllust vähendab faasipõhine liikumine, MITTE info peitmine: kasutaja saab alati avada „kogu seisu" loendivaate.

### 4.3. Info üleküllus

Reegel „üks etapp korraga" tähendab: descriptor'i tasandil on alati vastus kolmele küsimusele (kus olen / mis muutus / mis on järgmine tegevus — K1 4.1), faasi tasandil kuvatakse ainult aktiivse faasi tööobjektid (Kovisiooni COVISION_STAGE_PHASES muster), ja kõik varasem on „kapis" (arhiivipaneel), mitte kustutatud.

## 5. Kohtumise ühisvaade

### 5.1. Elemendid

| Element | Leping | Olemasolev alus [MAIN] |
|---|---|---|
| Päevakord | mustand ettevalmistuses → kinnitatud kohtumise alguses; punktid on tööobjektid (mitte vabatekst-plokk) | puudub; TopicSeed külmutusmuster on lähim analoog |
| Osalejate kohalolek ja roll | kohalolek = inimese TEADLIK kinnitus, mitte „aken lahti" (Q1.10 p11 üldistub); rollid nähtavad kogu aja | CovisionParticipantState.presentAt muster |
| Ühised märkmed | ühisala, autori-/päritolumärgisega (K2) | RoomMessage annab kirjaliku kanali; struktuurne märge puudub |
| Privaatsed märkmed | KUMMAGI poole privaatpaneel; EI tõuse ühisvaatesse kunagi automaatselt; serializer laadib ainult vaataja omad | CovisionPrivateState muster on runtime-tõendatud |
| Kokkulepped ja otsused | otsus = objekt kinnitusahelaga; „seinal" nähtav; asendatav ainult uue otsusega | puudub; closure whitelist-muster lähim |
| Ülesanded (vastutaja + tähtaeg) | ülesanne kannab vastutajat + tähtaega; tähtaeg tõuseb U1 next_action_due sündmuseks | CovisionFollowUp + nextContactOn mustrid |
| Inimese parandus/kommentaar | inimene saab kokkuvõtte mustandile/otsusele lisada „sain aru / mul on parandus" — parandus SÄILIB kandja juures | puudub; U3 correction-muster üldistub |
| Kokkuvõtte mustand | AI võib koostada MUSTANDI (audience=client generaator on koodis OLEMAS); spetsialist toimetab; mustand = klass 1 kandja | MEETING_SUMMARY artefakt DRAFT [MAIN] |
| Osalejate kinnitus / eriarvamus | kinnitusring FINAL-i eel või järel [DECISION O-CO-2: kohustuslikkus]; eriarvamus jääb kandja LAHUTAMATUKS osaks (mitte kommentaariks, mida saab kaotada) | SupervisionSummaryApproval muster [BRANCH]; artifact.approval_pending U1 kataloogis |
| Lõplik artefakt | FINAL → külmutatud → jagatud koopia ruumi (U10 [MAIN]) + auditikirje (TÄNA PUUDUB — RUUM-A0 8 K2) + U1 artifact.shared | U10 töötab; auk teada |
| Järelkohtumine | järelkohtumine = UUS kohtumine viitega eelmisele (mitte sama ruumi „taasavamine"); eelmise kokkuvõte on uue ettevalmistuse sisend | CovisionFollowUp→continue muster |
| Sündmused ja teavitused | meeting.upcoming (taimer), output.pending (kinnitusootel kokkuvõte), artifact.shared/approval_pending, participant.*, workspace.next_action_due — kõik K1-U1 ptk 7 kataloogist | U1-P0 järel |

### 5.2. Millal tekib dokumenteeritav kandja

- Kõik kuni FINAL-kinnituseta on **töömustand** (klass 1): purge'itav, mitte-eksporditav, tõendiväärtuseta.
- **Kinnitatud kokkuvõte** (klass 2) tekib täpselt ühes punktis: vastutav spetsialist kinnitab FINAL + (kui O-CO-2 nõuab) osalejate kinnitusring on läbitud. Sellest hetkest: külmutatud, versioonitud, auditijäljega, eksporditav, jagatav külmutatud koopiana.
- **Õiguslik/ametlik kandja** (klass 3) EI teki platvormil kunagi automaatselt. Juhtumikonverentsi protokoll ametlikus tähenduses on asutuse süsteemi asi; platvorm annab kinnitatud kokkuvõtte ja „kopeeri" väljundi. See piir kaitseb ühtaegu inimest (platvorm ei muutu varju-registriks) ja platvormi (ei võta menetlusvastutust).

### 5.3. U10 kui olemasolev v1

U10 (`meetingSummaryShare.js` [MAIN]) on kohtumise ühisvaate töötav esimene vertikaal: FINAL MEETING_SUMMARY → ruumisõnum. RUUM-A0 ptk 8 hindas selle platvormi puhtaimaks üksuseks (omanik-skoobitud, fail-closed, 8 testi). Täisvaade ehitatakse SELLE peale, mitte asemele. Teada augud, mis liiguvad pakettidesse: auditikirje puudub (K2), toores veaedastus (K1), tiitel ei liigu kaasa, sõnumisuurus piiramata (K4), UI eel-vastab privaatsusvärava (K3).

## 6. Võrgustikutöö

### 6.1. Võrgustikumudel (sihtmudel, [VISION])

Võrgustik on inimese juhtumi ümber olev NIMEKIRI + PIIRID, mitte sotsiaalgraaf. Mudel (kõik read on tulevase skeemi kandidaadid, mitte otsus):

| Element | Sisu | Piir |
|---|---|---|
| Inimene (keskmes) | kelle asjus võrgustik töötab | tema nõusolek on iga kaasamise eeldus; ta näeb teda puudutavat võrgustikku [DECISION ulatus] |
| Osaleja (inimesed) | platvormi kasutaja VÕI mittekasutaja (kolmas isik!) | mittekasutaja kirje = kolmanda isiku teave (3. ptk klass 5); minimaalsed väljad |
| Roll | mis funktsioonis kaasatud (lastekaitse, kool, perearst, tugiisik…) | roll on kirjeldav silt, MITTE õigusi andev — õigused tulevad ruumiliikmesusest |
| Organisatsioon | osaleja tööandja/asutus tekstina/registriviitena | org-MUDELIT ei looda enne org-otsust (ORG-A0); väli on kirjeldav |
| Teenus | seotud teenus (ServiceMapEntry viide) | viide, mitte koopia |
| Suhe | kes-kellega-mis-asjas koostööd teeb | AINULT professionaalne koostöösuhe; peresuhted = genogramm (CASEWORK-A0, siin EI analüüsita) |
| Koostöö eesmärk | miks see osaleja on kaasatud (nähtav kõigile asjaosalistele) | kohustuslik väli — eesmärgita kaasamist ei ole |
| Aktiivsus | viimane kontakt; kas koostöö elab | descriptor'i lastMeaningfulActivityAt; „unustatud liikmete" ülevaatuse alus |
| Kontaktipiir | mida selle osalejaga jagatakse (ideed 5.2 kolm taset: privaatne juhtumiinfo / võrgustikuga jagatud kokkuvõte / osalejaga seotud ülesanne) | osaleja lisamine = piiri määramine SAMAS liigutuses; vaikimisi = kitsaim |
| Nähtavus | kes näeb võrgustiku kaarti/loendit | koordinaator + inimene (tema osas); osaleja näeb OMA seost, mitte kogu kaarti [DECISION] |
| Ajaline kehtivus | kaasamise algus/lõpp; ligipääsu LÕPP on kohustuslik väli | „igavesti vaikimisi" on keelatud (K4: kestus või sündmus) |

### 6.2. Genogramm ja ökokaart

Siin AINULT tarbijapiir (täisanalüüs = CASEWORK-A0): genogramm ja ökokaart on võrgustikuandmete kaks VAADET, mitte eraldi andmekihid. COLLAB-i võrgustikumudel peab seepärast (a) hoidma isiku- ja suhtekirjed vaadetest lahus, (b) mitte fikseerima suhtetüüpide taksonoomiat, mida perevaade hiljem vajaks teistsugusena, (c) mitte lubama võrgustikuvaate jagamist mehhanismiga, mida ei saa hiljem genogrammile rangemaks keerata. Rohkem selles dokumendis genogrammi/ökokaardi kohta väiteid ei esitata.

### 6.3. Võrgustiku töövoog

Sama ptk 4 faasistik, kahe eripäraga: (1) kaasamise värav — enne välise osaleja kutsumist peab olemas olema inimese kinnitatud jagatav kokkuvõte (külmutatud objekt), mitte lubadus seda hiljem teha; (2) lõpetamise värav — võrgustiku sulgemine SULGEB kõigi väliste osalejate ligipääsud kontrollitud nimekirjana (elutsüklite ristkoristuse retsept, RUUM-A0 20.3).

Väikseim kasulik vertikaal (RUUM-VIS 6.8, kinnitatud siin): inimese kinnitatud kokkuvõte → ÜKS piiratud nähtavusega kutsutud väline osaleja → kirjalik ruum → kokkuleppemustand. ILMA kaardi-UI-ta, ILMA org-mudelita, ILMA mittekasutajate kirjeteta (esimeses vertikaalis on kõik osalejad kasutajad — kolmandate isikute kirjed tulevad alles pärast O-CO-6 õigusanalüüsi).

## 7. K1 ja U1 seos

### 7.1. WorkspaceKind

Kontrollitud fakt: K1-P0 register (`lib/workspaces/registry.js` [BRANCH ef5973c9]) juba sisaldab RESERVED-staatuses kind'e `meeting`, `network_case`, `org_space`, `field_visit`. COLLAB EI vaja registri laiendust — vaja on reserveeritud kind'ide descriptorid ja adapterid, kui vastavad mudelid sünnivad. Vahepeal töötab kohtumine `room`-kind'i PROFIILINA (Room originType eristab; kohtumise-spetsiifiline descriptor tuleb adapteri tasandil).

### 7.2. Descriptor'i väljad kohtumise ja võrgustiku jaoks

K1 4.1 WorkspaceDescriptor katab vajaduse peaaegu täielikult:

| Väli | Kohtumine | Võrgustik |
|---|---|---|
| ref | `{kind:"room", id}` (V1, profiil) → hiljem `{kind:"meeting"}` | `{kind:"network_case", id}` [TULEVIK] |
| lifecycle | DRAFT (ettevalmistus) → ACTIVE (kutsed väljas/kohtumine) → CLOSED (kokkuvõte kinnitatud) → ARCHIVED | DRAFT → ACTIVE → (PAUSED — koostöö seisab) → CLOSED → ARCHIVED |
| phase | `{key: "prepare"\|"invite"\|"meet"\|"decide"\|"follow_up"}` — toetav, mitte sundiv | kaardistus → kaasamine → koordineeritud töö → seire → lõpetamine |
| goal | kohtumise eesmärk (kasutaja sõnastatud) | koostöö eesmärk (kohustuslik) |
| nextAction | järgmine kokkulepe/ülesanne + dueOn + assigneeId | järgmine kontakt / ülevaatus |
| visibility | SHARED_PARTICIPANTS | SHARED_PARTICIPANTS; org-esindajale ORG_META [TULEVIK, blokeeritud] |
| participants | {active, invited} — K1-P0 room-adapter juba annab | + väliste osalejate tähtajad |
| responsible | kohtumise koordinaator | võrgustiku koordinaator |

Uus, mida descriptor V1-kujul EI kata ja mis vajab lepingulaiendust (mitte kohe koodi): **osaleja nähtavuspiir kutsel** (K1 4.4 reegel 3 nimetab seda võrgustikuruumi eeldusena — Invite'il täna implitsiitne „kogu ruum") ja **osaleja-descriptor** (ptk 11 COLLAB-P0 sisu).

### 7.3. DomainEvent-liigid, teavitused, deep-lingid

Kõik vajalikud sündmuseperekonnad on K1-U1-A0 ptk 7 kataloogis JUBA olemas — COLLAB ei lisa ühtegi uut perekonda, ainult tarbib:

| Vajadus | Kataloogi tüüp | Kanal | Ack | Retention |
|---|---|---|---|---|
| Kutse/liitumine/lahkumine/eemaldamine | participant.invited/joined/left/removed/withdrawn | N (+kutsekiri) | invite.id re-verify / readAt | short30/standard90 |
| Kohtumise lähenemine | meeting.upcoming (7.10) | N,✉OPT | toimumine | short30 |
| Kokkuvõte ootab kinnitust | artifact.approval_pending (7.5) | N,✉OPT | kinnitusotsus | short30 |
| Kokkuvõte jagatud/tagasi võetud/asendatud | artifact.shared/revoked/superseded | T,N | readAt/avamiskviitung | standard90 |
| Otsus/ülesanne/tähtaeg | workspace.next_action_set/due | N,✉OPT | source_resolved | short30 |
| Nõusolek antud/tagasi võetud | consent.granted/withdrawn | T,N | mooduli jõustamine! | audit_long |
| Ruumi elutsükkel | workspace.created/activated/phase_changed/closed/archived/deleted | T,N | readAt | standard90/audit_long |
| Omaniku üleandmine | participant.owner_changed [TULEVIK U11] | T,N,✉OPT | uus omanik kinnitab | standard90 |

Deep-lingid: action-registri kirjed `open_room` (olemas), `open_workspace`, `open_artifact`, `open_invite` (K1-U1 8.1) katavad kõik; URL EI salvestu kunagi (registrireegel). Idempotentsus: iga emit äritehingus `idempotencyKey = type:resourceId:discriminator` (K1-U1 6.3) — kohtumise kinnitusring kasutab `artifact.id:vN:pending` mustrit. Auditijälg: consent.* ja workspace.deleted lähevad audit_long klassi; kinnitatud kokkuvõtte jagamine saab LISAKS mooduli auditikirje (ARTIFACT_SHARE — RUUM-A0 8 K2 sulgemine). Payload-privaatsus on absoluutne: ühegi kohtumise/võrgustiku sündmuse meta'sse ei lähe vabateksti, päevakorda ega nimesid (K1-U1 6.4).

### 7.4. Mida miski kiht annab

| Kiht | Annab | Seis |
|---|---|---|
| **K1-P0 juba annab** | kind-register (meeting/network_case RESERVED), descriptor-validaator, Room+Kovisiooni read-adapterid (liikmesus→descriptor), leping-testide muster | CODE_READY [BRANCH ef5973c9]; ootab sõltumatut kontrolli Wave A-s |
| **U1-P0 hakkab andma** | DomainEvent outbox + projektor + NotificationEvent-projektsioon + retention-klassid; eelpöördumise vertikaal tõendab ahela | READY_AFTER_K1; kood puudub |
| **Uus ühine aluspakett (COLLAB-P0)** | osaleja- ja jagamislepingu descriptor-kiht: ParticipantDescriptor + kutse-elutsükli ühissõnastik + U12-valdusriba andmeleping — K1-P0 stiilis read-only, migratsioonita | ptk 11 |
| **Täisfunktsioon (hiljem)** | kohtumise mudel (päevakord/otsus/ülesanne/kinnitusring), Room-elutsükli väljad, võrgustikukirjed, ligipääsu tähtajad — KÕIK migratsioonidega ja otsuste taga | COLLAB-P2+ |

## 8. Privaatsus ja ohutus

| Teema | Leping / seis |
|---|---|
| Cross-tenant / organisatsioonidevaheline | org-mudelit EI OLE (kontrollitud; OrganizationAdmin = RAG-register). Kuni org-otsuseta on iga ligipääs ISIKU-põhine ruumiliikmesus; „asutuse ligipääsu" ei eksisteeri ega imiteerita. Organisatsioonidevaheline kohtumine = kasutajad eri asutustest samas ruumis, igaüks isikliku vastutusega. See on teadlik piirang, mitte auk — org-kiht tuleb ORG-A0 + org-otsuse järel |
| Kolmanda isiku andmed | võrgustiku suurim pind (RUUM-VIS 6.8); klass 5 objektid (3. ptk); mittekasutajate kirjeid EI looda enne O-CO-6 GDPR-analüüsi; kohtumise märkmetes on kolmanda isiku teave päritolumärgisega ja EI liigu artefaktidesse ilma teadliku otsuseta |
| Alaealised | platvormil pole vanusemudelit; COLLAB-i reegel: alaealine EI OLE kohtumise osaleja (konto-eelduski puudub); alaealist puudutav info on alati klass 5 (kolmanda isiku teave) rangeima piiriga; tugivõrgustiku nõupidamine lapse asjus toimub täiskasvanud osalejatega. Kui kunagi tekib alaealise oma osalus, on see eraldi õigusanalüüs, mitte tehniline laiendus |
| Kriisi- ja turvasignaalid | kriisirada (VEST) jääb U1-st ja kohtumise sündmustest VÄLJAS (K1-U1 11.3 keeld). Kohtumise märkmetest EI tuletata automaatselt riskisignaale. Välitöö turvasignaal (töötaja enda seadistatud) on FIELD-A0 teema |
| Kutsutu identiteedi kontroll | Invite = e-post + tokenHash + aegumine [MAIN] — identiteeditase on „valdab e-posti". See on piisav kolleegikutseks; VÄLISE spetsialisti ja kliendisuhte kutsel peab kutsuja nägema hoiatust, et link = ligipääs (bearer). Tugevam kontroll (nt e-posti kinnitusring liitumise järel, kutsuja käsitsi kinnitus esimesel sisenemisel) on [DECISION O-CO-4] |
| Kutselingi edasisaatmine | tokenid on räsitud, roteeritakse resend'il, maxUses piirab [MAIN] — hea alus. Uued reeglid: expiresAt ÜLEMPIIR (leitud auk: API kaudu saab luua aastakümneid kehtiva lingi — RUUM-A0 6 K3/7 K4); kutse vastuvõtt näitab kutsutu e-posti, millele kutse saadeti, ja liitumine logitakse auditisse |
| Nõusoleku tagasivõtmine | ptk 3.2 reegel 5: teade + jõustamine samas tehingus. Salvestuse pretsedent (ACTIVE-egress ei peatu tagasivõtul — RUUM-A0 ptk 5 K1) on NEGATIIVNE näide, mida kohtumise/võrgustiku kihti ei kanta: iga „luba" peab omama töötavat „peata" rada enne funktsiooni sisselülitamist |
| Konto kustutamine | kandjareegel ptk 3.2 p6 („autor kustutatud" külmutatud koopia); O-TK9 valik (A/B/C) määrab platvormi pretsedendi — COLLAB järgib sama loogikat kohtumise kokkuvõtetel. RoomMessage autori-kaskaad (autori kustutus kustutab ta ruumisõnumid — FAILID ptk 8) on lahtine kandjaotsus, mis muutub kohtumise ajaloo jaoks kriitiliseks [DECISION seos] |
| Töömärkmete omand | spetsialisti privaatne märge on TEMA oma (ei kuulu ruumile, juhtumile ega asutusele); adressaadi töömärkmed jagatud objektil on TEMA omad (O-TK9 L4 õppetund: teise inimese toiming ei tohi hävitada minu märkmeid); ruumi ühisala sisu kuulub RUUMILE (lahkuja panus jääb) |
| Auditijälg | 4 auditisüsteemi on teada killustatus (K1-U1 5.1); COLLAB EI loo viiendat — kohtumise/võrgustiku auditivajadus kaetakse U1 sündmustega (audit_long klass) + DocumentAudit laiendusega (ARTIFACT_SHARE). Ruumi kustutus auditijäljeta (RUUM-A0 16 K4) suletakse enne flow-ruumide laiemat kasutust |
| Ekspordid | ainult klass 2 kandjatest (kinnitatud kokkuvõte); ekspordi fakt on auditikirje + U12 rida; EXPORT-P0 auditijälje muster [BRANCH 65c82d04] on eeskuju; kirillitsa PDF-viga (EXPORT-A0 E-2) tähendab, et RU-kasutaja kokkuvõtte eksport vajab DOCX-rada kuni PDF parandatud |
| AI kasutamine kohtumise/juhtumi sisuga | LUBATUD: kokkuvõtte mustand (audience-põhine generaator on olemas), selge keele versioon (U7), päevakorra mustand — alati DRAFT-märgisega, inimene kinnitab (K2 päritolu). KEELATUD: osalejasoovitused, riskiskoorid, „kohtumise tooni" analüüs, automaatne otsuste tuletamine märkmetest, transkriptsioon vaikimisi. Kovisiooni sees kehtib RANGEM Q1.10 (AI ei genereeri küsimusi/lahendusi/kokkuvõtteid); kohtumise ühisvaates on mustand lubatud — see erinevus ON perekonna A/B piiri põhjendus |
| Keelatud automaatsed järeldused | ei mingit „aktiivsuse" skoori, osaluse edetabelit, „koostöö kvaliteedi" mõõdikut, emotsioonituvastust — nii Kovisiooni allikad (Q1.10 p9) kui org-analüütika keeld (üksikisiku jälgimine) laienevad kogu ühistegevusele arhitektuurilise, mitte poliitika-keeluna |
| Minimaalne andmestik | sündmuse payload koodid+ID-d (K1-U1 6.4); kutse meta ilma adressaadi e-postita; võrgustikukirje minimaalsed väljad; kohalolu-kinnitus ilma kellaaja-jälgimiseta (present = kinnitus, mitte logi) |

## 9. Hea ja halb praeguses platvormis

### 9.1. Doonorid (tõendatud mustrid, millest COLLAB ehitub)

| Doonor | Mida annab | Tõend |
|---|---|---|
| Room + RoomMember + Invite [MAIN] | osalejakiht: rollid, leftAt, lastReadAt, token-hügieen, revoke/resend, rate-limit, origin-tüübid | RUUM-A0 ptk 6 („küpseim route"), ptk 15–17 |
| Kovisioon [MAIN] | faasiväravad (server arvutab tõendid), CAS+advisory lock, atomaarne sulgemine+purge, CovisionPrivateState (privaatpaneel!), osaleja pseudonümiseerimine kõnedes, kinnituste distsipliin | teadmistekaart ptk 3–4, 7; 265/265 testi |
| PreInquiry + U3/U12 [MAIN] | külmutatud jagamine, recall enne avamist, parandus supersededBy-ahelana, advisory-lock järjestused, „Minu jagamised" valdusriba, EXTERNAL-kanali ausus | 08-sol progress; 16/16 + 1086/1086 |
| U10 meetingSummaryShare [MAIN] | FINAL-artefakti jagamise leping-moodul: omanik-skoobitud, fail-closed, anti-enumeratsioon, testitud | RUUM-A0 ptk 8 |
| SUP-P0 [BRANCH] | rikkaim osaleja-elutsükkel (INVITED…WITHDRAWN), SupervisionContractAcceptance (lepingu kinnitusversioonid), SummaryApproval (kinnitusring!), SupervisionAuditEvent | skeemidiff 2fc826c4 |
| K1-P0 [BRANCH] | registry (meeting/network_case juba reserveeritud), descriptor-validaator, kaks read-adapterit, leping-testi muster | ef5973c9, sisu loetud |
| roomStream SSE [MAIN] | 20s ligipääsu-taaskontroll (lahkunu striim sulgub) — „üks platvormi paremaid turvaomadusi" | RUUM-A0 ptk 9 |
| NotificationEvent konveier [MAIN] | dedupe, õiguste re-verify loomisel JA lugemisel, delivery-retry, toodangu 5-min timer | K1-U1 ptk 5 [SERVER] |

### 9.2. Adapteriga taaskasutatav (ei ehitata uuesti)

Continuity omaniku-skoobitud koondimuster (descriptor-päringute referents); Help-match ruumi origin-muster (flow→ruum 1:1 originType+originId); TopicSeed külmutus (sharedCardSnapshot → päevakorra/kokkuvõtte külmutuse analoog); FrameworkAcceptance (reeglitega-nõustumise kirje → ruumi kokkulepete kinnituse analoog); PracticeCapability.validUntil (tähtajaline võimekus → välise osaleja tähtajaline liikmesus); audience-põhine kokkuvõttegeneraator (client-versioon olemas).

### 9.3. Dubleerimisohud (mida uus süsteem EI tee)

1. NELJAS osalejasüsteem — keelatud (K1 4.11); kohtumine/võrgustik kasutavad Room+Invite.
2. Eraldi „kohtumiste moodul kalendriga" — visiooni mitte-ehitada nr 1; kohtumine on ruumi profiil, mitte kalendritoode.
3. Uus teavituskanal — kõik käib U1 kaudu; mitte ühtegi uut otse-e-kirja rada (kolme paralleelse e-kirjasüsteemi õppetund, U1-A4).
4. Kovisiooni „kohtumiseks" üldistamine või kohtumise „kovisiooniks" rikastamine — perekonna A/B piir (ptk 1).
5. Teine „Minu jagamised" — U12 leht laieneb, ei dubleerita.
6. Genogrammi/võrgustiku eraldi andmebaas väljaspool võrgustikumudelit (6.2).

### 9.4. Vead, mida uude süsteemi EI kanta (tõendatud RUUM-A0-s)

| Viga | Kus täna | COLLAB-i reegel |
|---|---|---|
| Nõusolek kehtib ainult alustamisel, mitte kestmisel | salvestuse egress (ptk 5 K1, 4 K1) | iga kestev luba omab töötavat peatamisrada ENNE sisselülitust |
| Elutsüklite ristkoristus puudub | ruum ei lõpeta kõnet; leave ei korista osalust (16 K1/K3) | „X lõppes → järgmise kihi koristus samas tehingus" on lepingu invariant |
| Hard-delete auditijäljeta + flow-ruumi ühepoolne häving | Room DELETE (16 K2/K4) | mitmepoolsetel ruumidel arhiveeri+lahku; kustutus = auditisündmus |
| Identiteet e-postina + vale omistus | inviterName=auth.email; moderaatori resend omistab kutse valele (6 K6) | kutse kannab kutsuja profiilinime + algset inviterId-d |
| Tähtaja ülempiiri puudumine | expires_in_hours piiramata (6 K3, 7 K4) | jagatud konstant-lagi kõigile kutsetele |
| TOCTOU / find-then-create | osalejad, taotlused, topelt-lõpp (20.3) | tingimuslikud kirjutused + osalised unikaalindeksid sünnist |
| Serveripoolne eestikeelne sisu | süsteemsõnum, consent-snapshot (4 K5, 5 K4) | i18n-võti + keelekood igal serveri-loodud sisul |
| Vaikiv kadumine billing-väraval | ruumiloend (15 K2) | accessible:false + selgitus, mitte kadumine |
| 0 sündmust tegevushetkel | Kovisioon ei teavita kutsutut; ruumi kustutusest ei saa keegi teada (5.2) | iga COLLAB-i üleminek emiteerib U1 sündmuse sünnist |
| UI ja serveri väravad eri andmetel | kustutusnupp role vs ownerId (16 K5) | server annab canDelete/canManage lipud; UI ei arvuta õigusi |

### 9.5. Tänased funktsioonid, mis VAJAVAD seda aluslepingut enne edasiarendust

U10 täisvaade (kinnitusring vajab osaleja-/kinnituslepingut); Help-match ruumid (kustutusreegel O-CO-1 enne päriskasutuse kasvu); Kovisiooni ruumiline ümberkujundus KOV-V2 (osalejakihi ühissõnastik enne lavastust); SUP-P1 grupivorm (osaleja-adapter); role-aware invite copy [BRANCH, BLOCKED_DECISION] (sponsoriroll vs COLLAB-i rollikaart peavad ühilduma); TÖÖLAUD-P2 badge'id (U1-P2 + workspace-descriptor).

## 10. Tooteotsused

Ükski järgnev EI blokeeri COLLAB-P0 (ptk 11) — see on paketi valiku kriteerium, mitte juhus.

| ID | Otsus | Variandid | Soovitus | Mõju | Viimane otsustushetk | Blokeerib P0? |
|---|---|---|---|---|---|---|
| O-CO-1 | Flow-päritolu ruumide kustutusreegel (= RUUM-A0 16 K2) | (a) omanik kustutab (tänane); (b) arhiveeri+lahku, hard-delete keelatud; (c) mõlema poole kinnitus | (b) | kaitseb teise poole ajalugu; eeldab Room-elutsükli välju | enne COLLAB-P3 (Room-elutsükkel) ja enne help-match kasvu | EI |
| O-CO-2 | Kohtumise kokkuvõtte kinnitusringi kohustuslikkus | (a) valikuline (spetsialist otsustab); (b) kohustuslik kõigil; (c) kohustuslik ainult juhtumikonverentsi profiilil | (c), v1-s (a) | määrab kandjaklassi 2 tekke; U1 approval_pending kasutuse | enne COLLAB-P2 | EI |
| O-CO-3 | Omanikuvahetuse kinnitusreegel (= O-KO1) | (a) uus omanik kinnitab; (b) + osalejad näevad üleminekuteadet; (c) admin-protseduur lisaks | (b) | avab U11; parandab „omaniku ainus väljapääs on häving" | enne COLLAB-P3/U11 koodi | EI |
| O-CO-4 | Kutsutu identiteedi tase kliendisuhte/välise kutsel | (a) e-post piisab (tänane); (b) + esmasisenemise kinnitus kutsuja poolt; (c) tugev ID hiljem | (b) kliendisuhtele | kliendi kaasamise turvalisus | enne kliendi-osalusega kohtumise pilooti | EI |
| O-CO-5 | Kliendi/pöörduja koht kohtumise ühisvaates | (a) klient = täisosaleja algusest; (b) klient näeb kinnitatud kihti (päevakord+otsused+kokkuvõte), mitte töömustandit; (c) klient ainult adressaat (U10 tänane) | (b) sihina, (c) jääb v1 | inimese positsioon: osaleja vs objekt — platvormi väärtuslubaduse tuum | enne COLLAB-P2 UI-d | EI |
| O-CO-6 | Võrgustiku kolmandate isikute (mittekasutajate) kirjete õiguslik alus | õigustatud huvi / nõusolek / kirjeid ei looda | vajab GDPR-analüüsi (õigusabi) | blokeerib võrgustiku TÄIS-mudeli (6.1 mittekasutaja read) | enne COLLAB-P5 | EI (P4 vertikaal on kasutajate-põhine) |
| O-CO-7 | WITHDRAWN-osaleja panuse saatus mitmepoolses ruumis | (a) panus jääb (nagu LEFT); (b) panus anonüümitakse; (c) moodulipõhine | (c), SUP-i pretsedent ees | K1 11.3 p6 kordus — EI otsustata vaikimisi tehniliselt | enne esimest WITHDRAWN-toega moodulit | EI |
| O-CO-8 | Moderatsioonifilosoofia ühtlustus (ADMIN kõnedes modereerib, sõnumites mitte — RUUM-A0 3 K6b) | (a) admin ei modereeri kunagi sisu; (b) eraldi protseduuriroll auditijäljega | (b) pikas plaanis; (a) kuni protseduurita | õigusvastase sisu eemaldamise võimekus | enne avalikumat ruumikasutust | EI |
| O-CO-9 | Org-esindaja ORG_META nähtavus | — (kogu org-kiht) | ära otsusta siin; ORG-A0 + org-otsus | supervisiooni/võrgustiku org-vaated | ORG-A0 järel | EI |
| O-CO-10 | Kinnitatud kokkuvõtte õiguslik staatus juhtumikonverentsil (kandjaklass 2 vs asutuse protokoll) | (a) platvorm = alati klass 2, ametlik protokoll väljas; (b) partner-leppega tõendikõlblik kandja | (a) kuni partner-leppeta | STAR2/menetluse piir; kattub ideed 17 otsustega (CASEWORK-A0) | enne juhtumikonverentsi profiili | EI |

## 11. Rakenduspaketid

### COLLAB-P0 — osaleja- ja jagamislepingu kiht (ESIMENE, rakendusvalmis)

- **Eesmärk:** ptk 2 osaleja-elutsükkel ja ptk 3 jagamisleping muutuvad koodis kontrollitavaks samal viisil, nagu K1-P0 tegi tööruumilepinguga: ühissõnastik + read-only descriptorid + adapterid olemasolevate mudelite kohal + leping-testid. **Skeemimuudatust, migratsiooni ega UI-d EI OLE. Ühtegi lahtist tooteotsust EI OLE** (sõnastik on ekstraktitud töötavast koodist: Invite/RoomMember [MAIN], CovisionParticipant [MAIN], SupervisionParticipation kuju [BRANCH] ainult sõnastiku valideerimiseks).
- **Sõltuvus:** K1-P0 sõltumatu PASS + merge (failid elavad `lib/workspaces/**` kõrval ja taaskasutavad registry't). U1-P0 EI ole eeldus.
- **Failid (kõik uued):**
  - `lib/workspaces/participation.js` — ParticipantDescriptor typedef + validaator: `{workspaceRef, userId, role (OWNER|RESPONSIBLE|MODERATOR|MEMBER|OBSERVER|REVIEWER), invite {status, expiresAt, relationship (COLLEAGUE|CLIENT)}, membership {status: INVITED|ACTIVE|LEFT|REMOVED|WITHDRAWN, since, leftAt}, scope {note: null}}` — scope.note on V1-s alati null (aus piirang, nagu K1-P0 room-adapteri lifecycle:"ACTIVE");
  - `lib/workspaces/sharing.js` — jagatava objekti descriptor (ptk 3 veerud: objectClass 1–10, frozen:boolean, purpose, validity, revocable {beforeOpen, afterOpen:"correction"}) + validaator; EI tee päringuid — leping + helper;
  - `lib/workspaces/adapters/roomParticipationAdapter.js` — `listParticipants(userId, roomId)` ja `listMyMemberships(userId)` → ParticipantDescriptor[] (RoomMember+Invite pealt; omaniku-/osaleja-skoobitud; võõras → tühi);
  - `lib/workspaces/adapters/covisionParticipationAdapter.js` — sama CovisionParticipant pealt (INVITED/ACCEPTED/DECLINED/EXPIRED → ühissõnastik);
  - `tests/workspaces/participationContract.test.js` — fake-db (repo konventsioon), mõlemad adapterid, võõra kasutaja 0 rida, sõnastiku täielikkus (iga DB-enum kaardistub), validaatori reject tundmatule rollile/olekule.
- **DoD / vastuvõtt:** mõlemad adapterid tagastavad kehtiva descriptor'i; U12 `lib/mySharings.js` andmekuju on kaardistatav sharing-descriptor'iks ilma mySharings.js muutmiseta (test tõendab kaardistust, mitte integratsiooni); `npm test` + `npm run i18n:check` rohelised; ühtegi olemasolevat faili peale testide ei muudeta.
- **Keelatud skoobilaiendused:** EI mingit kirjutavat rada; EI Invite/RoomMember skeemimuudatust; EI scopeNote välja (ainult null-koht lepingus); EI UI-d; EI SUP-adapterit (haru pole main-is); EI U1 emit-punkte; EI „kick"/rollimuutuse endpointe.
- **Audititase:** Soli tehniline kontroll (read-only kiht, madal risk) — sama klass kui K1-P0.
- **Rollback:** failide eemaldus.

### COLLAB-P1 — kohtumise piloot A: U10 jagamise ausus (väike, 1 additiivne migratsioon)

Sisu: `ARTIFACT_SHARE` väärtus `DocumentAuditAction` enumisse (additiivne migratsioon) + auditikirje U10 postitusharru `meta:{roomId, messageId}` (RUUM-A0 8 K2); safeError-parandus (8 K1); artefakti tiitel sõnumi päisesse; sisulagi (~32k). Sõltuvus: puudub (U10 on main-is). Otsuseid ei vaja. Audititase: Sol. NB: see on ainus P1-tasemel pakett, kus migratsioon on aus hind — alternatiiv (DataAuditLog string-action) killustaks artefakti auditijälge kahte süsteemi.

### COLLAB-P2 — kohtumise piloot B: kokkuvõtte kinnitusring (otsuste + U1 taga)

Sisu: kohtumise kokkuvõtte kinnitus-/eriarvamusring inimese poolel (O-CO-2/O-CO-5 järgi): FINAL-kokkuvõte → osaleja „kinnitan / mul on parandus" → seis autorile; U1 `artifact.approval_pending`/`artifact.confirmed` emit; „mis muutus" rida. See on arendusprogrammi H2 piloot nr 1 („kohtumise kokkuvõtte kinnitamine — väikseim vertikaal sündmusest artefakti ja reaktsioonini"). Sõltuvused: U1-P0 PASS (sündmuskiht), O-CO-2, O-CO-5; tõenäoliselt 1 väike mudel (kinnituskirje) → migratsioon → Opuse-klassi kontroll (uus isikuandmete kandja). SupervisionSummaryApproval [BRANCH] on kuju-doonor.

### COLLAB-P3 — ruumi elutsükli miinimum (otsuste taga)

Sisu: Room saab K1 elutsükli miinimumi (CLOSED/ARCHIVED väljad + üleminekud CAS-iga), flow-ruumide hard-delete asendus arhiveeri+lahku-ga (O-CO-1), kustutuse auditisündmus (RUUM-A0 16 K4), omanikuvahetus U11 (O-CO-3) ja elutsüklite ristkoristuse sidumised (16 K1/K3 kolmik). Sõltuvused: O-CO-1, O-CO-3; migratsioon; kõrge riski klass (tootmisandmete Room-tabel) → sõltumatu audit. Kattuvus RUUM-A0 20.5 paranduspakkidega — koordinaator liidab, ei dubleeri.

### COLLAB-P4 — võrgustiku vertikaal (kasutajate-põhine, ilma kaardi-UI-ta)

Sisu: ptk 6.3 väikseim vertikaal: inimese kinnitatud külmutatud kokkuvõte → ÜKS piiratud nähtavusega kutse (scopeNote saab siin esimese päris tähenduse) → kirjalik ruum → kokkuleppemustand. Kõik osalejad on kasutajad (O-CO-6 ei blokeeri). Sõltuvused: COLLAB-P0 (osalejaleping), U1-P0, O-CO-4; Invite.scopeNote lisamine = migratsioon.

### COLLAB-P5 — võrgustiku täisfunktsioon (otsuste + õigusanalüüsi taga)

Sisu: võrgustikukirjed (6.1 mudel), mittekasutajate kirjed (O-CO-6 järel), kontaktipiiride kolm taset, ajalise kehtivuse jõustamine, `network_case` kind'i adapter + descriptor, liikmeülevaatuse rütm (U1 taimer-sündmus). Genogramm/ökokaart TARBIVAD seda (CASEWORK-A0 defineerib vaated).

### COLLAB-P6 — professionaalse ühistegevuse täisfunktsioon

Sisu: püsiruumi profiil (eesmärk + perioodiline „kas ruum elab?" ülevaatus + rollide rotatsioon), `meeting` kind'i täis-adapter (päevakord/otsused/ülesanded mudelitena), juhtumikonverentsi profiil (O-CO-10), ORG_META vaatajaroll (org-otsuse järel). Hilisemad seosed: juhtumitöö assistent ja Meetodipeegel (CASEWORK-A0) tarbivad kohtumise ettevalmistus-/järelkihti; ESTA (ESTA-MENTOR-A0) kasutab püsiruumi + liikmesusväravat; SUP-V1 grupivorm kasutab osaleja-adapterit; KOV-V2 kasutab sama privaatpaneeli- ja kohalolekulepingut ilma kohtumise otsuste-kihita (perekonna B piir püsib).

## 12. Lõppväljund

### 12.1. Peamised järeldused

1. **Üksteist kasutusjuhtu = kolm perekonda, üks leping.** Kohtumine/koostöö/võrgustik (A) jagavad tulevast „kohtumise profiili"; Kovisioon/Supervisioon/mentorlus (B) on metoodiliselt kaitstud konteinerid, mis tarbivad SAMA osaleja-/jagamis-/sündmuslepingut adapteriga, aga mida ei tohi kohtumise funktsiooniks sulatada (Q1.0/Q1.8 tõendus); suunamine (C) on artefakti-üleandmine, mitte ruum.
2. **Alus on suuremas osas juba olemas ja osalt CODE_READY.** Room+Invite (osalejad), PreInquiry/U3/U12 (jagamine+tagasivõtt+valdusriba), U10 (kokkuvõtte jagamine), Kovisiooni privaatpaneel ja väravad [MAIN]; K1-P0 registry juba reserveerib `meeting`/`network_case` kind'id [BRANCH]. COLLAB ei alusta nullist üheski osas.
3. **Suurim struktuurne auk ei ole funktsioon, vaid elutsükkel ja sündmused:** Room on elutsüklita (hard-delete auditijäljeta, ühepoolne flow-ruumi häving, omanikuvahetuseta) ja ükski ühistegevuse üleminek ei väljasta sündmust. Seepärast on U1-P0 ja Room-elutsükkel (COLLAB-P3) kohtumise TÄISvaate eeldused, mitte kaunistused.
4. **Kandjapiir (töömustand / kinnitatud kokkuvõte / ametlik kandja) on analüüsi tähtsaim õiguslik eristus** — see hoiab platvormi varju-registriks muutumast ja määrab, millal tekib eksporditav/auditeeritav objekt.
5. **Esimene pakett saab olla migratsioonita ja otsustevaba** just seetõttu, et see on leping + read-adapterid (K1-P0 muster), mitte funktsioon.

### 12.2. Leitud sõltuvused

| Sõltuvus | Suund |
|---|---|
| K1-P0 PASS + merge | → COLLAB-P0 failipaigutus (`lib/workspaces/**`) |
| U1-P0 (DomainEvent outbox) | → COLLAB-P2 kinnitusring, P4 võrgustiku teavitused, kõik „mis muutus" read |
| O-TK9 valik (A/B/C) | → kustutusjärgse kandja pretsedent, mida COLLAB-i kokkuvõtted järgivad |
| RUUM-A0 20.5 parandusringid (elutsükli koristus, race-migratsioon) | → COLLAB-P3 kattub — koordinaator liidab paketid |
| SUP-P0 push+audit+merge | → SupervisionSummaryApproval/Participation kui P2 kuju-doonor; SUP-adapter |
| GDPR-analüüs kolmandate isikute kirjete kohta (O-CO-6) | → COLLAB-P5 (mitte P4) |
| Org-otsus (ORG-A0) | → ORG_META vaatajaroll, org-supervisioon, juhtumikonverentsi org-pool |
| Role-aware invite copy [BRANCH, BLOCKED_DECISION] | → peab ühilduma ptk 2 rollikaardiga enne integratsiooni |

### 12.3. Tooteomaniku otsused

Kümme otsust ptk 10 tabelis (O-CO-1…O-CO-10); ükski ei blokeeri COLLAB-P0. Esimesena vajavad vastust O-CO-1 (flow-ruumide kustutusreegel — kaitseb juba TÄNASEID help-match ruume) ja O-CO-2/O-CO-5 (kinnitusringi ja kliendi positsiooni valik — avavad kohtumise piloodi B).

### 12.4. Esimene rakendusvalmis pakett

**COLLAB-P0 — osaleja- ja jagamislepingu kiht** (ptk 11): 5 uut faili `lib/workspaces/**` + `tests/workspaces/**`, 0 migratsiooni, 0 lahtist otsust, 0 UI-d; sõltuvus ainult K1-P0 PASS+merge; Soli tehniline kontroll. See on arendusprogrammi H1 rea „osaleja, jagamise ja nõusoleku adapteripiir" täitmine.

### 12.5. Soovitatud järgmine süvaanalüüs

**CASEWORK-A0** (master-registri järjekord ja koordinaatori handoff kinnitavad sama): juhtumitöö assistent + Meetodipeegel + genogramm/ökokaart. COLLAB-A0 annab talle valmis sisendid: võrgustikumudel (ptk 6, mille vaated genogramm/ökokaart on), kandjapiir (ptk 1.3, mis STAR2-piiri kannab) ja objektiklasside maatriks (ptk 3, mille klass 5 on juhtumitöö tuumrisk).

### 12.6. Kopeeritav jätkamisülesanne

```
ÜLESANNE: CASEWORK-A0 — juhtumitöö assistent, Meetodipeegel, genogramm ja ökokaart (süvaanalüüs)
Loe enne: docs/platvormi arendus/fable-5-tulevikufunktsioonide-suvaanaluusi-programm.md (master-register);
fable-5-professionaalne-uhistegevus-vorgustikutoo-ja-kohtumise-uhisvaade.md (ptk 1.3 kandjapiir, ptk 3 objektiklassid,
ptk 6 võrgustikumudel — genogramm/ökokaart on selle VAATED, mitte eraldi andmekiht); ideed.md ptk 4–12 + 17 (k1–k11
õigusotsused); fable-5-ruumilise-platvormi-elav-visioon-ja-arendusteed.md ptk 6.7/6.9/6.10; K1-U1-A0.
Kontrolli read-only: origin/main + server + harud (ära eelda võrdsust); vastuvõtulaua/receiverChecklist/artefaktide
tegelik kood. Väljund: docs/platvormi arendus/fable-5-juhtumitugi-meetodipeegel-genogramm-ja-okokaart.md
(edenemistabel alguses; lõpus järeldused, sõltuvused, otsused, esimene pakett, järgmine analüüs, jätkamisülesanne,
Jätkamispunkt, STATUS: COMPLETE). Uuenda master-registrit alguses (IN_PROGRESS) ja lõpus (COMPLETE).
Reeglid: rakenduskoodi/skeemi/teste ei muudeta; ei commit'ita; määrdunud main-i ei puututa; STAR2-piir on siduv;
kolmandate isikute andmete õigusküsimusi EI lahendata tehnilise vaikimisi-otsusena.
```

## Jätkamispunkt

- **Seis:** kõik 14 etappi TEHTUD (vt Edenemistabel); esimene täisring COMPLETE; dokument jääb elavaks — uus töökord lisab uue kuupäevaga rea, ei muuda ptk 0 lukustatud kontrolle.
- **Kontrollitud allikad (17.07.2026):** git fetch + origin/main `fe4eb4fa` = server (SSH, ise kontrollitud); lokaalne main `0da4185b` (1/22, määrdunud — ei kasutatud); K1-P0 `ef5973c9` registry+adapterite SISU loetud; SUP-P0 `2fc826c4` osalejamudelid loetud; schema.prisma (main=origin=tööpuu identne): Room/RoomMember/Invite/RoomRole/InviteStatus/RelationshipType/DocumentAuditAction/AgentArtifact kontrollitud; U10+U12 failid origin/main-is kinnitatud; org-/kohtumise-/ülesande-/võrgustikumudeleid skeemis EI OLE (grep). Dokumendid täies mahus: arendusprogramm 2026-07-17; K1-U1-A0 (708 r); RUUM-VIS-A0 (719 r); O-TK9; koordinaatori handoffi strateegia-/väravaosa. Sihitult (peatükkide kaupa, ülejäänu struktuur kaardistatud): Kovisiooni teadmistekaart (ptk 1–11 + Q1.0–Q1.13 täielikult; R-osad on KOV-V2-A0 sisend); RUUM-A0 (ptk 1–10 põhiosa + 15–17 + 20 täielikult); 08-sol-u12-u3 (ptk 1–14).
- **Peamised tulemused:** kolm kasutusjuhtude perekonda + kandjapiir (ptk 1); osaleja-elutsükli leping (ptk 2); 10 objektiklassi jagamismaatriks (ptk 3); kohtumise ühisvaate leping + U10 kui v1 (ptk 5); võrgustikumudel ilma genogrammi-süvaanalüüsita (ptk 6); K1/U1 kaardistus — uusi sündmuseperekondi EI vaja, kind'id juba reserveeritud (ptk 7); 10 tooteotsust, ükski ei blokeeri P0 (ptk 10); paketid COLLAB-P0…P6, P0 = migratsioonita osaleja-/jagamislepingu kiht (ptk 11).
- **Järgmine töökord siin dokumendis:** (1) kui K1-P0 saab PASS+merge, ava COLLAB-P0 teostuseks (ptk 11 leping on Sol-valmis); (2) kui O-CO-1/O-CO-2/O-CO-5 saavad vastuse, märgi ptk 10 seisud ja täpsusta P2/P3; (3) kui SUP-P0 merge'itakse, lisa SUP-osaleja-adapter P0 järelpaketina; (4) kui U1-P0 valmib, ava P2 kinnitusringi leping.
- **Katkemise korral:** Edenemistabel + see punkt on tõeallikas; git/serveri kontrollid on lukus 17.07 seisuga — uus sessioon teeb UUE kontrolli ja lisab uue rea.

STATUS: COMPLETE
