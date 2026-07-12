# SotsiaalAI avastamata vajadused ja uued võimalused

Kuupäev: 12.07.2026
Alusdokumendid: [brief](./fable-5-platvormi-loogika-brief.md), [ülevaade](./fable-5-platvormiloogika-ulevaade.md), [max-täiendus](./fable-5-platvormiloogika-max-taiendus.md), [ideed.md](./ideed.md), [ruumilise-kogemuse-lahtekoht.md](./ruumilise-kogemuse-lahtekoht.md). Tõeallikas praeguse seisu kohta: aktiivne kood (kontrollid tehtud selles sessioonis; osa runtime-tõendeid pärineb max-täienduse E2E-kontrollist). Rakenduse koodi ei muudetud.

Eesmärk: leida see, mida varasemad raportid **ei käsitlenud** — katmata kasutusolukorrad, puuduvad väikesed lülid, uued ühendused, nähtamatud taustavõimekused ja asjad, mida ei tasu ehitada. Kolm põhikasutajatüüpi jäävad (pöörduja, spetsialist, teenuseosutaja); kõik muud nimetused on tiitlid/võimekused.

Piirang aususe huvides: juba varasemates raportites käsitletud võimalused (Kovisiooni sidumine, häälvestlus, kohtumise ühisvaade, JTA, Meetodipeegel, võrgustikutöö, Supervisioon, ESTA, koondid) siin **ei kordu** — neile viidatakse ainult seostena.

---

## 1. Ajajoone-analüüs: kus kasutaja praegu üksi jääb

Märgistus: ✅ kaetud aktiivse koodiga · 🟡 osaliselt · ⬜ katmata. Viide `U#` = ptk 3 võimalus.

### 1.1. Pöörduja

| Olukord | Seis | Tõend / lünk |
|---|---|---|
| Enne abi otsimist (kas ja kust üldse?) | 🟡 | Teenusekaart on avalik (`GET /api/service-map/entries` = 200 autentimata); vestlus/Teekond vajavad kontot. Lävi on teadlik äripiir (max-täiendus O12), mitte funktsioonilünk |
| Olukorra kirjeldamine ja mõtestamine | ✅ | vestlus + RAG + Teekond (runtime-tõendatud) |
| Info liiga keeruline / koormav | ⬜ | a11y katab kirjasuuruse, kontrasti, teema, reduced-motion ([AccessibilityProvider.jsx:12–23](../components/accessibility/AccessibilityProvider.jsx)); **selge keele** režiimi ei ole → U7 |
| Teenuse/spetsialisti leidmine | ✅/🟡 | kaart + filtrid töötavad; kättesaadavuse info on staatiline tekst → U4 |
| Pöördumise ettevalmistus ja saatmine | ✅ | privaatsuskontrolliga, runtime-tõendatud |
| **Ootamise periood pärast saatmist** | ⬜ | mitte ühtegi signaali peale staatuseveeru, mida peab ise vaatamas käima → U1 |
| Kohtumise eel ja ajal | 🟡 | eelinfo liigub; ühisvaade = max-täiendus 9.7 (rühm 2, ei korrata siin) |
| **Pärast kohtumist: „mis kokku lepiti?"** | ⬜ | kokkulepe jääb inimese mällu/paberile; artefaktid on olemas, aga pöördujani ei jõua → U10 |
| Kontakt katkeb / inimene loobub | ⬜ | ühtegi taasalustamise mehhanismi ega meeldetuletust pole → U1, U2 |
| Otsus/ametlik kiri on ebaselge | 🟡 | dokumendi üleslaadimine + analüüs on CLIENT-ile juba olemas (analyze-file, 2 faili) — **olemasolev funktsioon katab põhiosa**; puudu on selge keele vastus (U7) ja teadlik „selgita ametlikku kirja" sisenemiskoht (väike UI-lisa, mitte uus funktsioon) |
| Eriarvamus otsusega | ⬜ teadlikult | vaidlustamine on ametlik menetlus (KOV/STAR2) — platvorm võib ainult selgitada ja suunata; EI ehita (ptk 6) |
| Lähedase/usaldusisiku tugi | 🟡 | mehaanika on olemas (ruumikutse `relationshipType: CLIENT`, sponsoreeritud kutse), pöörduja-poolne arusaadav rada puudub → U9; ametlik esindusõigus = edasilükatud tooteotsus (ideed 17 k12) |

### 1.2. Sotsiaaltöö spetsialist

| Olukord | Seis | Tõend / lünk |
|---|---|---|
| Tööpäeva alustamine: „mis mind ootab?" | ⬜ | iga funktsioon on eraldi loend; ristvaadet pole; badge-konks on koodis tootjata ([workspaceDashboardCards.js:29–45](../lib/workspaceDashboardCards.js)) → U2, U1 |
| Uue pöördumise mõistmine ja tähtsus | 🟡 | vastuvõtja tööplaan + kiireloomulisuse märksõnad (`URGENT_KEYWORDS`, [lib/preInquiries.js:73–82](../lib/preInquiries.js)) on olemas; automaatset triaaži EI ehita (ptk 6) |
| Kohtumiseks valmistumine | ✅ | tööplaan + artefaktid + dokumendid |
| Info muutuste märkamine | 🟡 | ruumides lugemata-märk (`RoomMember.lastReadAt`); mujal mitte midagi → U1 |
| **Järeltegevused ja tähtajad** | ⬜ | ainsad tähtajad koodis on kuulutuste/kutsete `expiresAt`; „järgmine kontakt + kuupäev" mõistet pole üheski töövoos → U2 |
| Kliendiga kokkulepitu hoidmine | ⬜ | → U10 (sama objekt teenindab mõlemat poolt) |
| **Töö üleandmine kolleegile** (puhkus, lahkumine, koormus) | ⬜ | `recipientOwnerId` ja ruumi `ownerId` on jäigalt fikseeritud; ümbersuunamise rada puudub täielikult → U11 |
| Katkestatud kontakti taastamine | ⬜ | → U1, U2 |
| Võrgustiku koordineerimine | — | käsitletud (max-täiendus 9.3, rühm 3) |
| Meetodi valik ja refleksioon | — | käsitletud (9.2) |
| Professionaalse toe küsimine | — | käsitletud (9.4; Tööheaolu mustandid töötavad) |
| **Vajalikku teenust ei ole olemas/saadaval** | ⬜ | täna kaob see teadmine töötaja peas; kaardil on ainult olemasolevad teenused → U5 (uus, üheski varasemas dokumendis funktsioonina puudub) |

### 1.3. Teenuseosutaja

| Olukord | Seis | Tõend / lünk |
|---|---|---|
| Teenuste haldus | ✅ | profiil + teenused + asukohad + avaldamine (sünk kaardile ja RAG-i testidega) |
| **Tegelik vaba maht / ooteaeg** | 🟡 | `availabilityStatus/availabilityDescription` on skeemas ja serialiseeruvad kaardile ning RAG-teksti ([serviceProviderProfiles.js:307, 414, 807](../lib/serviceProviderProfiles.js)) — aga vaba tekst, käsitsi, värskuseta → U4 |
| Pöördumiste vastuvõtt | ✅ | INTERNAL kanal + `acceptsPlatformPreInquiries` lipud |
| Sobivuse hindamine | 🟡 | eeldusväljad olemas (`requiresKovAssessment` jt); toimib kirjeldusena |
| Ootenimekiri | ⬜ | puudub; täishaldussüsteemi EI ehita (ptk 6), signaal → U4 |
| Koostöö suunava spetsialistiga | ✅ | ruum (`SERVICE_PROVIDER_INQUIRY` origin) |
| Teenuse algus/lõpp/tagasiside | ⬜ teadlikult | teenuse osutamine ja dokumenteerimine toimub väljaspool platvormi; enne partner-teenuseosutajate pilooti ei ehita |
| Kaardi info värskus | 🟡 | `checkedAt` väli on olemas (schema:1541), admin jälgib KOV-allikaid; teenuseosutaja enda „kinnitan, et kehtib" meeldetuletust pole → U4 osa |

### 1.4. Rollidevahelised olukorrad

| Küsimus | Seis | Tõend / lünk |
|---|---|---|
| Kes mida näeb | ✅ | omaniku-/osaleja-/liikmesuspiirded runtime-tõendatud (max-täiendus 2.3); UI-s privaatsusmärgised (nt Teekonna „Privaatne") |
| Kes peab kinnitama | ✅ | kinnitusmustrid järjekindlad (userConfirmed, anonymityConfirmed, nõusolek salvestusel) |
| Kui kaua ligipääs kestab | 🟡 | kutsetel aegumine+tagasivõtt+taassaatmine (routes olemas); ruumist lahkumine olemas; **saadetud pöördumist ei saa tagasi võtta** ([pre-inquiries/[id]/route.js](../app/api/pre-inquiries/[id]/route.js): ainult GET+PATCH; SENT lukustub) → U3 |
| Valesti jagatud info parandamine | ⬜ | → U3 (praegu ainus tee on paluda adressaadil ignoreerida) |
| Kuidas inimene otsusest aru saab | 🟡 | dokumendianalüüs + U10 + U7 |
| Kuidas pooleliolev töö jätkub | 🟡 | vestlused/mustandid püsivad; ühtset jätkamiskohta pole → U2 |
| Teavitused ja tähtajad | ⬜ | → U1 |
| Sama info mitmekordne sisestamine | ✅/🟡 | eeltäitemustrid töötavad (Teekond→pöördumine shareKeys, kaardikirje→pöördumine); seosekirje puudub (P0.2, juba plaanis) |

---

## 2. Neliteist taustavõimekust: kontrollitud seis aktiivses koodis

| # | Võimekus | Seis | Tõend |
|---|---|---|---|
| 1 | Platvormisisene teavituskeskus | **puudub** | ühtegi teavitusmudelit/marsruuti pole; e-kiri ainult kutsetel, kovisiooni kutsel ja välissaatmisel; töölauakaartide badge-konks on olemas, aga **ilma tootjata** (workspaceDashboardCards.js:29–45; ChatBodyView saab `dashboardBadges` väärtuseta) |
| 2 | Tegevuste ja tähtaegade ülevaade | **puudub** | tähtajad eksisteerivad ainult kuulutuste/kutsete `expiresAt` väljadena; tegevus+kuupäev mõistet pole |
| 3 | Poolelioleva töö jätkamine | **osaline** | vestluste loend + kinnitamine; Teekonna „Jätka viimast"; DRAFT-pöördumised püsivad; Teemaseemned kaotab kõik (demo-olek); ühtne „jätka siit" vaade puudub |
| 4 | Otsing üle enda objektide | **puudub kasutajana** | `searchDocumentChunks` on AI-sisene (lib/documents/search.js); vestluste API-l pole otsinguparameetrit (conversations/route.js:135–140); ChatSidebar filtreerib ainult laaditud pealkirju kliendipoolselt (ChatSidebar.jsx:85) |
| 5 | „Mis on muutunud" vaade | **osaline** | ruumide lugemata-märk (`lastReadAt` + `/read` marsruut); üheski teises moodulis pole |
| 6 | Tegevuste/jagamiste ajalugu | **osaline, nähtamatu** | `DocumentAudit` (dokumendid), `DataAuditLog` (kõned, kustutus, usage-admin) kirjutavad; kasutajale nähtavat vaadet pole; pöördumise saatmine auditeerub ainult `sentAt` väljana |
| 7 | Jagamise aegumine ja tagasivõtmine | **osaline** | kutsed: aegumine+revoke+resend (routes olemas); kaardikuulutused: `expiresAt`; **pöördumine: tagasivõtt puudub** → U3 |
| 8 | Usaldusisiku/esindaja piiratud ligipääs | **puudub mudelina** | ainus mehaanika on ruumikutse `relationshipType: CLIENT`; esindusõiguse mudel on teadlikult lahtine (ideed 17 k12) |
| 9 | Teenuseosutaja vaba maht ja ooteaeg | **osaline** | staatilised väljad serialiseeruvad kaardile ja RAG-i; hallatavus/värskus puudub |
| 10 | Tagasiside ja ebaselge otsuse selgitus | **puudub kanalina** | tagasisidemudelit pole; otsuse *selgitamist* katab osaliselt dokumendianalüüs |
| 11 | Lihtsam keel / väiksem infokoormus | **osaline** | a11y: uiScale, kontrast, teema, reduced-motion; selge keele vastuseid ja lihtsustatud vaadet pole |
| 12 | Kehv ühendus / katkenud sessioon | **osaline** | PWA olemas (`public/sw.js`, `site.webmanifest`); SSE 180 s taimaut + `run` GET taastab vestluse seisu; sisestusmustandi kaitset ega ühenduseoleku märki pole |
| 13 | Teadmusallika aegumise märkamine | **olemas (admin), osaline (kasutaja)** | `checkedAt`/`KovAutoCheckStatus`/kov-source-monitor marsruut + värskusetestid ja -skriptid; kasutajale allika vanust vastuse juures süsteemselt esile ei tooda |
| 14 | AI vastuse kvaliteediraport → teadmusbaasi parandus | **puudub (kasutaja pool)** | admin-telemeetria (ChatLog, retrieval-stats, golden-eval skriptid) on olemas; kasutajal pole ühtegi „teata veast" nuppu ega ringi, mis jõuaks allikahalduseni → U8 |

Järeldus: kõige suurem süsteemne auk ei ole üksikfunktsioon, vaid **sündmuse-/teavituskihi puudumine** (read 1, 2, 5, 7 taanduvad samale alusele) ning **tagasivõtmise ja jagamisnähtavuse** puudulikkus (read 6–7).

---

## 3. Kaksteist võimalust

Liigid: **(1)** olemasolevate funktsioonide puuduv ühendus · **(2)** väike iseseisev täiendus · **(3)** võimalik uus moodul · **(4)** kasutajale nähtamatu kvaliteedi-/käitamisvõimekus.

### U1. Sündmuse- ja teavituskiht — liik 4

- **Kasutusolukord:** pöörduja saatis pöördumise ja ootab vaikuses; spetsialistile saabus uus pöördumine, ruumisõnum või sobitus — keegi ei saa teada enne, kui juhtub lehte avama.
- **Kelle probleem:** kõik kolm rolli; kõige valusam pöörduja ootamisperioodil.
- **Praegu:** e-kiri läheb ainult kutsel, kovisiooni kutsel ja välissaatmisel; muu = käi ja vaata.
- **Miks olemasolevast ei piisa:** iga moodul on eraldi loend; vastuvõtu kiirus sõltub juhusest.
- **Kas piisab olemasoleva parandamisest:** osaliselt — max-täienduse P0.5 (saabumise e-kiri) on selle kihi esimene sündmus, mitte asendus.
- **Väikseim kasulik versioon:** sündmusetabel + 5 sündmusetüüpi (pöördumine saabus / võeti vastu; ruumikutse; ruumi lugemata sõnumid koondina; sobitus; „järgmine kontakt" tähtaeg) → e-kiri + töölauakaartide badge'ide **tootja** olemasolevale konksule. Eraldi teavituskeskuse lehte v1-s ei tee.
- **Taaskasutus:** `getMailer`, badge-konks (workspaceDashboardCards.js:29–45), `RoomMember.lastReadAt` muster, tööde käivitusmuster (`/api/jobs/subscription-renewals` + skriptid).
- **Uus tööobjekt:** `NotificationEvent { userId, type, sourceType, sourceId, readAt, emailedAt }` + kasutaja kanalieelistus.
- **Piirid:** teavitus kannab ainult fakti ja viidet, mitte sisu (e-kirja ei tohi sattuda pöördumise tekst); halduskihti pole.
- **Ruumiline kogemus:** quickbari vaikne märgutuli + kaardi badge — „ukse alla lükatud kiri", mitte müravoog.
- **Seosed:** toidab U2, U3, U10, U11; eeldab otsust O6.
- **Tooteotsused:** O6 (kanal); e-kirja minimaalsus.
- **Keerukus:** keskmine.
- **Millal mitte ehitada:** eraldi teavituskeskuse UI-d ei ehita enne, kui sündmusetüüpe on rohkem kui badge'id kannavad.

### U2. „Jätka siit" — pooleli oleva töö koond ja järgmise kontakti kuupäev — liik 2

- **Kasutusolukord:** spetsialist alustab tööpäeva („mis mind ootab?"); pöörduja naaseb nädala pärast („kus ma pooleli jäin?").
- **Kelle probleem:** spetsialist igapäevaselt; pöörduja taastulekul.
- **Praegu:** 5–6 eri loendi lappamine (pöördumised, ruumid, Teekond, mustandid, kuulutused, dokumendid).
- **Miks olemasolevast ei piisa:** kõik andmed on serveris olemas, aga ristvaadet pole; badge-konks on tootjata.
- **Kas piisab olemasoleva parandamisest:** jah — see ONGI olemasolevate loendite liitmine, mitte uus moodul.
- **Väikseim kasulik versioon:** Töölaua ülariba „Pooleli" (kuni 7 kirjet): DRAFT-pöördumised, lugemata ruumid, READY-pöördumised (vastuvõtjal), kinnitamata Tööheaolu mustandid, aktiivne Teekond; lisaks vastuvõtja tööplaani **üks uus väli „järgmine kontakt (kuupäev)"** (receiverChecklist JSON-i laiendus — migratsioonita), mis tõuseb koondisse ja U1 tähtajasündmuseks.
- **Taaskasutus:** kõik loendi-API-d, `normalizePreInquiryReceiverChecklist`, workspaceDashboardCards.
- **Uus tööobjekt:** mitte ühtegi (koondpäring + JSON-välja laiendus).
- **Piirid:** rangelt kasutaja enda objektid — samad omanikupiirded, mis loendites (runtime-tõendatud).
- **Ruumiline kogemus:** ruumigrammatika „laud" (ruumidoc 3.2) otserakendus — laual on pooleliolev töö.
- **Seosed:** U1 badge'id; kandidaat-1 vertikaali tagasiside-pool.
- **Tooteotsused:** ei vaja.
- **Keerukus:** väike.
- **Millal mitte ehitada:** eraldi ülesannete-moodulit (task-manager) ei tee — ainult koond.

### U3. Saadetud pöördumise tagasivõtmine ja parandamine — liik 2

- **Kasutusolukord:** pöörduja märkab pärast saatmist, et kirjas on viga, liigne isikuandmete detail või vale adressaat.
- **Kelle probleem:** pöörduja (ja spetsialist saatjana).
- **Praegu:** võimatu — SENT lukustub (`sent_cannot_be_edited`, lib/preInquiries.js:644–648; marsruudil pole DELETE/recall'i); ainus tee on paluda adressaadil ignoreerida.
- **Miks olemasolevast ei piisa:** platvormi keskne lubadus on „sina kontrollid jagamist" — kutsetel on revoke olemas, pöördumisel mitte; ebajärjekindlus õõnestab usaldust.
- **Kas piisab olemasoleva parandamisest:** jah — olekumudeli täiendus, mitte uus moodul.
- **Väikseim kasulik versioon:** „Võta tagasi", kuni adressaat pole avanud (avamise fakt: accept või tööplaani esimene salvestus) → pöördumine kaob adressaadi loendist, autorile jääb koos märkega; pärast avamist „saada parandus" (uus versioon viitega `supersededById`).
- **Taaskasutus:** olemasolev update-loogika; U1 teavitus adressaadile; auditiväljad.
- **Uus tööobjekt:** `recalledAt` kuupäeva­väli (mitte uus enum-väärtus — Postgresi enum'i laiendus on tagasipööramatu, max-täienduse 5.6 reegel) + `supersededById` viide.
- **Piirid:** tagasivõtt ei kustuta adressaadi mälu — UI ütleb seda ausalt; jälg säilib mõlemal pool.
- **Ruumiline kogemus:** saadetud kiri tõmmatakse tagasi oma lauale; parandus asetub vana peale.
- **Seosed:** U12 (jagamiste vaade on koht, kus tagasivõtt elab); O4 (sama olekumudeli otsus).
- **Tooteotsused:** kas avamise järel on tagasivõtt lubatud (soovitus: ei — ainult parandus).
- **Keerukus:** väike–keskmine.
- **Millal mitte ehitada:** täisversioonimist (dokumendihalduse klooni) ei tee.

### U4. Kättesaadavuse ja ooteaja signaal + värskuskinnitus — liik 2

- **Kasutusolukord:** pöörduja valib teenust teadmata, kas sinna üldse pääseb; teenuseosutaja saab päringuid, mida ei suuda vastu võtta; spetsialist suunab pimesi.
- **Kelle probleem:** kõik kolm rolli korraga — haruldane ühisväärtus.
- **Praegu:** `availabilityStatus/-Description` on vaba tekst, käsitsi, kuupäevata (serialiseerub kaardile ja RAG-i — serviceProviderProfiles.js:307, 414, 807).
- **Miks olemasolevast ei piisa:** kuupäevata staatiline tekst ei ole usaldatav ega masinloetav.
- **Kas piisab olemasoleva parandamisest:** jah — samade väljade struktureerimine + värskus.
- **Väikseim kasulik versioon:** kolmeväärtuseline signaal (võtab vastu / ootenimekiri ~kestus / ei võta praegu) + `availabilityCheckedAt`; kaart ja pöördumisvorm kuvavad signaali koos vanusega („kinnitatud 3 nädalat tagasi"); iga N nädala järel üheklõpsu-kinnituskiri teenuseosutajale.
- **Taaskasutus:** olemasolevad availability-väljad ja serialiseerimisahel, `checkedAt` muster, mailer; admini aegumisülevaade kov-source-monitor'i mustriga.
- **Uus tööobjekt:** 2 välja teenusekirjel (signaal rakenduskihi konstandina, mitte PG-enum; kuupäev).
- **Piirid:** avalik info (kaart ongi avalik); halduslik: aegunud kinnitusega kirjete loend adminile.
- **Ruumiline kogemus:** kaardikirje seisundimärk + tekst (mitte ainult värv — ruumidoc 3.6 reegel).
- **Seosed:** U5; eelpöördumise vorm hoiatab enne saatmist; RAG-vastused saavad värskema kättesaadavuse.
- **Tooteotsused:** kinnitusintervall; kas „ei võta vastu" ainult hoiatab või peidab kirje pöördumisvalikust (soovitus: ainult hoiatab).
- **Keerukus:** väike.
- **Millal mitte ehitada:** ootenimekirja haldust ega broneerimist mitte (ptk 6).

### U5. Teenusepuudujäägi märge ja anonüümne koond — liik 3 (väike moodul)

- **Kasutusolukord:** spetsialist otsib teenust, mida piirkonnas ei ole (nt lastepsühholoog eesti keeles) — täna kaob see teadmine; süsteemset auku ei näe keegi.
- **Kelle probleem:** spetsialist vahetult; pöörduja kaudselt; pikas plaanis KOV/valdkond.
- **Praegu:** mitte midagi; parimal juhul e-kiri juhile.
- **Miks olemasolevast ei piisa:** Teenusekaart näitab ainult olemasolevat; puudujääk on nähtamatu andmeliik, mida ükski funktsioon ei kogu.
- **Kas piisab olemasoleva parandamisest:** ei — uus, kuid väike andmekiht.
- **Väikseim kasulik versioon:** kaardi tühja otsingutulemuse ja kirjevaate juurest „märgi puudujääk" (kategooria + omavalitsus + vabatahtlik üldistatud märkus, PII-eelkontrolliga, ilma kliendiviideta) → kuukoond adminile k-anonüümsuse mustriga.
- **Taaskasutus:** abikategooriate ja omavalitsuste registrid (seeditud), Tööheaolu agregaadi summutusmuster (aggregate.js), `piiFilter`.
- **Uus tööobjekt:** `ServiceGapReport { categoryCode, municipalityId, note?, reporterRole, createdAt }` — teadlikult ilma juhtumi/kliendi viiteta.
- **Piirid:** üksikmärge sisemiselt pseudonüümne, koond anonüümne; juht/admin ei näe üksikmärkeid seostatuna (sama reegel mis ideed 21.7).
- **Ruumiline kogemus:** kaardi „aken" näitab ka tühimikku — puuduv teenus kui nähtav objekt.
- **Seosed:** U4 (eristus „hõivatud" vs „puudub"); hilisem valdkondlik baromeeter (max-täiendus 9.5) sama avaldamisloogikaga.
- **Tooteotsused:** kes koondit näeb (algul ainult admin; KOV alles pilootleppega); avaldamislävi.
- **Keerukus:** keskmine.
- **Millal mitte ehitada:** enne U4 signaali (muidu andmed segunevad); koondit ei avalikustata enne läveanalüüsi.

### U6. Isiklik otsing enda objektide üle — liik 2

- **Kasutusolukord:** „kus mul see vestlus/dokument/pöördumine oli?" — spetsialistil kuhjub sadu objekte.
- **Kelle probleem:** spetsialist eelkõige; teised vähem.
- **Praegu:** ChatSidebari kliendipoolne pealkirjafilter (ChatSidebar.jsx:85), dokumentide loend, mälu.
- **Miks olemasolevast ei piisa:** sisuotsingut pole üldse; API-l puudub otsinguparameeter (conversations/route.js:135–140).
- **Kas piisab olemasoleva parandamisest:** osaliselt — algus võiks ollagi `q`-parameeter vestluste API-le.
- **Väikseim kasulik versioon:** üks otsinguväli (quickbar/käsupaneel) → ILIKE üle enda vestluste (pealkiri+sisu), dokumendipealkirjade, pöördumiste teemade ja Teekondade; tulemused rühmitatult tüübi kaupa.
- **Taaskasutus:** kõik tabelid + samad omanikufiltrid, mis loendites; vajadusel pg_trgm indeks (raw-migratsioon).
- **Uus tööobjekt:** ei (hiljem valikuline indeks).
- **Piirid:** rangelt omaniku skoop; ei otsi kunagi üle teiste kasutajate sisu.
- **Ruumiline kogemus:** ruumidoc 9. ptk „käsklus- või otsingupaneel" — sama paneel on ruumiindeksi teine pool (ideed 28.6).
- **Seosed:** ruumiindeks/kiirmenüü; U2.
- **Tooteotsused:** ei vaja.
- **Keerukus:** keskmine (jõudlus + õigusfiltrite hoolikus).
- **Millal mitte ehitada:** eraldi otsingutaristut (Elastic vms) ei võta — Postgres piisab.

### U7. Selge keele režiim — liik 2

- **Kasutusolukord:** pöörduja, kellele pikk ametlik tekst on takistus (keeleoskus, väsimus, kriis, puue), saab vastused ja juhendatud vood lihtsas eesti keeles.
- **Kelle probleem:** pöörduja; kaudselt spetsialist (vähem selgitamiskoormust).
- **Praegu:** kasutaja peab ise oskama küsida „selgita lihtsamalt"; a11y katab ainult esituse (kiri, kontrast, liikumine), mitte keelt.
- **Miks olemasolevast ei piisa:** lihtsus ei tohi sõltuda oskusest seda küsida.
- **Kas piisab olemasoleva parandamisest:** jah — vestluse süsteemijuhise + vaadete tiheduse lipp, mitte uus moodul.
- **Väikseim kasulik versioon:** a11y-menüü lüliti „selge keel" → chat lisab vastustele selge keele juhise (lühikesed laused, sammud, ilma kantseliidita; allikad jäävad); eelpöördumise juhendatud vaade kasutab sama lippu väiksema plokiarvuga.
- **Taaskasutus:** AccessibilityProvider salvestusmuster, `lib/chat/systemPrompts`, serverT.
- **Uus tööobjekt:** üks kasutajaeelistus.
- **Piirid:** puhtalt esituskiht; sisu ja allikad ei muutu.
- **Ruumiline kogemus:** sama ruum, madalam samaaegse info hulk — kooskõlas ideed 28 reegliga („etappideks jagamine, mitte teksti vähendamine").
- **Seosed:** U10 (kokkuvõte selges keeles), häälvestlus (sama profiil ettelugemisel).
- **Tooteotsused:** selge keele juhise kvaliteedi valideerimine (hiljem sobiv ESTA-koostöö teema, kuid ei sõltu sellest).
- **Keerukus:** väike–keskmine (promptitöö + kontrolltestid).
- **Millal mitte ehitada:** eraldi „lihtsat rakendust"/duplikaat-UI-d mitte — ligipääsetav variant on sama struktuur (ruumidoc ptk 10).

### U8. Allika-tagasiside silmus — liik 4

- **Kasutusolukord:** kasutaja näeb vastuses aegunud KOV-kontakti või valet infot; täna ei saa ta sellest kuhugi teatada ja viga jääb korduma.
- **Kelle probleem:** kõik rollid; sisuliselt teadmusbaasi kvaliteedi käitamisvõimekus.
- **Praegu:** admin-telemeetria (ChatLog, retrieval-stats, freshness-skriptid, golden-eval) on olemas, aga kasutaja tähelepanek ei jõua kunagi ahelasse.
- **Miks olemasolevast ei piisa:** perioodiline eval ei püüa reaalajas leitud vigu; kasutajad on suurim kontrolljõud.
- **Kas piisab olemasoleva parandamisest:** jah — see on puuduv lüli olemasoleva RAG-haldusahela ees.
- **Väikseim kasulik versioon:** allikakaardi juures vaikne „teata veast" (aegunud / vale / ei puutu asjasse) → kirje admini järjekorda koos `doc_id`-ga → admin kasutab olemasolevaid revalidate/light-check marsruute ja märgib lahendatuks; teataja saab U1 kaudu kinnituse.
- **Taaskasutus:** vastuse allikametaandmed (doc_id on `displayed_sources`-is), RagDocument staatused, kov revalidate marsruudid, materjalide review-muster.
- **Uus tööobjekt:** `SourceFeedback { docId, reason, note?, userId, resolvedAt }` (vestluse sisu vaikimisi kaasa ei lähe).
- **Piirid:** raport = viide + põhjus; kasutaja vabatekst läbib PII-eelkontrolli; halduskiht adminil.
- **Ruumiline kogemus:** lipuke allikakaardi nurgas — fookus allikal, mitte „hinda AI-d" nupul.
- **Seosed:** võimekused 13–14 (ptk 2); teadmusbaasi värskusahel; U1.
- **Tooteotsused:** kas teataja näeb lahenduse staatust (soovitus: jah).
- **Keerukus:** väike–keskmine.
- **Millal mitte ehitada:** üldist tärnihinnangut vastustele mitte — see ei anna parandatavat signaali.

### U9. Tugiisiku kaasamise rada — liik 1

- **Kasutusolukord:** eakas või kriisis pöörduja tahab, et lähedane aitaks pöördumist teha ja vestluses osaleda.
- **Kelle probleem:** pöörduja.
- **Praegu:** mehaanika on tegelikult OLEMAS (ruumikutse `relationshipType: CLIENT`, sponsoreeritud kutse koos maksega) — aga see elab spetsialisti-keskse „Lisa inimene" taga ja pöörduja ei leia ega mõista seda.
- **Miks olemasolevast ei piisa:** võimekus on peidus; pöördujal puudub arusaadav sisenemiskoht ja piiride selgitus.
- **Kas piisab olemasoleva parandamisest:** **jah — see on peamiselt UI ja sõnastuse töö** (aus näide: uut funktsiooni pole vaja).
- **Väikseim kasulik versioon:** pöörduja vaates „kutsu tugiisik" + selge selgitus, mida tugiisik näeb (ainult see ruum) ja mida mitte (Teekond, vestlused, dokumendid); kutsekiri selges keeles.
- **Taaskasutus:** kogu invites-ahel (aegumine, revoke, sponsoreerimine), ruumipiirded (runtime-tõendatud).
- **Uus tööobjekt:** mitte ühtegi. Ametlik esindusõigus jääb eraldi tulevikuotsuseks (ideed 17 k12) — seda siin EI lahendata.
- **Piirid:** tugiisik = tavaline ruumiliige; mitte mingit vaikimisi ligipääsu mujale.
- **Ruumiline kogemus:** „toon inimese oma ruumi" — uks (ruumidoc 3.4).
- **Seosed:** U10 (tugiisik näeb sama kokkuvõtet ruumis).
- **Tooteotsused:** sõnastus; tugiisiku konto tasuta-loogika (sponsoreeritud kutse juba võimaldab).
- **Keerukus:** väike.
- **Millal mitte ehitada:** volituste/esindusõiguse registrit enne õiguslikku analüüsi mitte.

### U10. Kohtumise kokkuvõte pöördujale — liik 1

- **Kasutusolukord:** pärast kohtumist ei mäleta inimene, mis kokku lepiti ja mis edasi saab; spetsialist kordab sama telefonis.
- **Kelle probleem:** pöörduja ja spetsialist võrdselt.
- **Praegu:** suuline/paber; MEETING_SUMMARY artefakt on olemas, kuid jääb spetsialisti dokreziimi (artefaktid on omanikupõhised).
- **Miks olemasolevast ei piisa:** puudu on täpselt üks ühendus: artefakt → ühine ruum.
- **Kas piisab olemasoleva parandamisest:** jah — üks ühendus, null uut õigustemudelit.
- **Väikseim kasulik versioon:** vastuvõtuvaates/ruumis „koosta kokkuvõte inimesele" → genereeritakse (audience=client on generation.js-is juba olemas; U7 selge keel) → spetsialist toimetab → **postitatakse ruumi sõnumina** (ruumiliikmed näevad niikuinii) → pöörduja saab märkida „sain aru" või „mul on parandus" (vastussõnum).
- **Taaskasutus:** artifacts generation, room messages (runtime-tõendatud), U1 teavitus.
- **Uus tööobjekt:** v1-s mitte ühtegi.
- **Piirid:** jagatakse ainult spetsialisti kinnitatud kokkuvõte; pöörduja parandus on nähtav mõlemale — ideed 17 k6 (eriarvamuse käsitlus) esimene praktiline seeme.
- **Ruumiline kogemus:** ruumidoc tööobjektitabeli täpne rida: „Kokkulepe → ühise ruumi seinale → nähtav ja kinnitatav".
- **Seosed:** kandidaat-2 voo loomulik lõpp; U7, U9; hiljem JTA kohtumise märkmete allikas.
- **Tooteotsused:** kas pöörduja kinnitus on kohustuslik (soovitus: valikuline v1).
- **Keerukus:** väike.
- **Millal mitte ehitada:** sellest ei tohi saada ametlik protokoll ega otsusedokument (STAR2 piir).

### U11. Töö üleandmine kolleegile — liik 2

- **Kasutusolukord:** spetsialist läheb puhkusele või lahkub; saabunud pöördumised ja aktiivsed ruumid jäävad ripakile.
- **Kelle probleem:** spetsialist ja asutus; pöörduja kaudselt (vastus hilineb).
- **Praegu:** platvormil võimatu — `recipientOwnerId` ja ruumi `ownerId` on jäigad; ainus tee on paluda inimesel uuesti saata.
- **Miks olemasolevast ei piisa:** üleandmise rada puudub täielikult (ptk 1.2 rida 7).
- **Kas piisab olemasoleva parandamisest:** osaliselt — kaks kitsast PATCH-i.
- **Väikseim kasulik versioon:** pöördumise ümbersuunamine teisele `acceptsPreInquiries=true` kasutajale (uus adressaat + märge + U1 teavitus autorile „sinu pöördumisega tegeleb nüüd X") + ruumi omanikurolli üleandmine (RoomMember.role vahetus).
- **Taaskasutus:** acceptsPreInquiries register, RoomMember rollid, DataAuditLog auditiks.
- **Uus tööobjekt:** üleandmise auditikirje (DataAuditLog action).
- **Piirid:** autor PEAB teada saama (läbipaistvus); sisu ei kopeerita — muutub ainult sihtkoht; kuna org-mudelit pole, on v1 ainult käsitsi valitud kolleegile.
- **Ruumiline kogemus:** kausta ulatamine kolleegi lauale — nähtav, mitte vaikne.
- **Seosed:** U1; tulevane org-/üksusemudel on eraldi suurem otsus.
- **Tooteotsused:** kas autoril on õigus üleandmisest keelduda (soovitus: teavitus + võimalus vastata); KOV-struktuuri vaade = hilisem.
- **Keerukus:** keskmine (õiguste servajuhud).
- **Millal mitte ehitada:** org-hierarhiat ja juhi määramisvoogu enne org-mudeli tooteotsust mitte.

### U12. „Minu jagamised" läbipaistvusvaade — liik 2

- **Kasutusolukord:** „kes mu infot praegu näeb?" — eriti pöördujal, kes on jaganud pöördumisi, ruume ja kuulutusi eri aegadel.
- **Kelle probleem:** pöörduja eelkõige; kõik rollid.
- **Praegu:** killustatult eri lehtedel; auditikirjed (DocumentAudit, DataAuditLog) on kasutajale nähtamatud.
- **Miks olemasolevast ei piisa:** lubadus „sina kontrollid jagamist" vajab ühte kohta, kus see kontroll on NÄHA.
- **Kas piisab olemasoleva parandamisest:** jah — koondvaade olemasolevatest loenditest + olemasolevad revoke/leave nupud ühte kohta.
- **Väikseim kasulik versioon:** profiilis „Jagamised": saadetud pöördumised (adressaat + staatus), ruumiliikmesused (+ lahku), aktiivsed kutsed (+ võta tagasi — marsruut olemas), avaldatud kuulutused (+ aegumine), tehtud raamistikukinnitused (`FrameworkAcceptance` on mudelis).
- **Taaskasutus:** kõik loendid ja revoke/leave marsruudid; `chat/export` pretsedent enda andmete kättesaadavusest.
- **Uus tööobjekt:** ei ühtegi.
- **Piirid:** ainult enda jagamised; see ON privaatsuse omavaade, mitte auditilogi.
- **Ruumiline kogemus:** „millised mu uksed ja aknad on lahti" — ülevaade ühes ruumis.
- **Seosed:** U3 (pöördumise tagasivõtt elab siin); GDPR-i andmete allalaadimise tulevik.
- **Tooteotsused:** ei vaja.
- **Keerukus:** väike.
- **Millal mitte ehitada:** täielikku tehnilist auditilogi siia ei pane (müra) — ainult jagamised.

---

## 4. Hindamine viie kriteeriumi järgi

Skaala: K = kõrge, KE = keskmine, M = madal. Keerukus: V = väike, KESK = keskmine (kõik 12 on teadlikult ilma „suureta" — suured teemad on varasemates raportites).

| # | Võimalus | Liik | Kasutajaväärtus | Sobivus põhieesmärgiga | Koodi taaskasutus | Keerukus | Eristatavus tavalisest AI-vestlusest / juhtumihaldusest |
|---|---|---|---|---|---|---|---|
| U1 | Sündmuse-/teavituskiht | 4 | K | K | KE | KESK | M (hügieen, aga kõige alus) |
| U2 | „Jätka siit" koond + järgmine kontakt | 2 | K | K | K | V | KE |
| U3 | Pöördumise tagasivõtt/parandus | 2 | KE–K | K | K | V–KESK | KE (usalduslubadus lõpuni) |
| U4 | Kättesaadavuse signaal + värskus | 2 | K | K | K | V | **K** (elav kättesaadavus — seda ei tee ei tavavestlus ega registrid) |
| U5 | Teenusepuudujäägi koond | 3 | KE praegu / K pikas | K | K | KESK | **K** (huvikaitse-andmekiht, unikaalne) |
| U6 | Isiklik otsing | 2 | KE | KE | K | KESK | M |
| U7 | Selge keele režiim | 2 | K (pöördujale) | K | K | V–KESK | **K** (selge keel + allikad koos) |
| U8 | Allika-tagasiside silmus | 4 | KE | K | K | V–KESK | **K** (allikapõhine kvaliteedisilmus) |
| U9 | Tugiisiku rada | 1 | KE | K | K | V | KE |
| U10 | Kohtumise kokkuvõte pöördujale | 1 | K | K | K | V | **K** (inimlik kinnitatud kokkuvõte) |
| U11 | Töö üleandmine kolleegile | 2 | KE | KE | KE | KESK | M |
| U12 | „Minu jagamised" vaade | 2 | KE | K | K | V | KE–K |

## 5. Viis tugevaimat

**Valik: U1, U2, U4, U7, U10.** (U3 ja U12 on kohe järgmised — nad moodustavad koos „usalduse paketi" ja tulevad väikese kuluga U1 järel.)

**Miks need viis:**

1. **U1** on ainus, millest sõltub neli teist (U2 badge'id, U3 teavitused, U10 kättetoimetamine, U11 läbipaistvus) ja mis parandab korraga kõige rohkem ajajoone-auke (ootamine, katkenud kontakt, muutuste märkamine). Ilma selleta jääb iga uus funktsioon „mine ja vaata ise" seisu.
2. **U2** annab mõlemale põhirollile igapäevase sissepääsu, taaskasutab kõik olemasoleva ja on väike — parim väärtus/kulu suhe.
3. **U4** on ainus, mis teenib kõiki kolme rolli korraga, ja muudab Teenusekaardi elavaks — see on andmekiht, mida üheski teises Eesti süsteemis ei ole.
4. **U7** teenib otseselt platvormi põhieesmärki (abi peab olema arusaadav neile, kellel on kõige raskem) ja võimendab kõiki teisi väljundeid (vestlus, kokkuvõtted, ettelugemine).
5. **U10** sulgeb pöörduja põhiraja emotsionaalselt kõige olulisema augu („mis nüüd saab?") praktiliselt nullarhitektuuriga.

**Enne või pärast olemasolevate ühenduste lõpetamist (max-täienduse P0):**

- **U1 alustada paralleelselt P0-ga** — P0.5 (saabumise e-kiri) ONGI U1 esimene sündmus; mõistlik on see kohe õigele alusele ehitada.
- U2, U10 — **pärast** P0 põhiühendusi (kandidaat-1 seosekirje ja R4 parandus), sest nad kuvavad/kannavad just neid seoseid.
- U4, U7 — **sõltumatud**, võivad käia paralleelselt ükskõik millal.

**Väikseks prototüübiks sobib kõige paremini U10:** null uut andmemudelit, üks ühendus (artefakt → ruumisõnum), kohe tuntav väärtus mõlemale rollile ja testitav sünteetiliselt olemasoleva E2E-mustriga.

**Pikaajaline eristav põhivõimekus: U4 + U5 koos** — teenuste tegeliku kättesaadavuse ja puudujääkide elav pilt. Tavaline AI-vestlus ei tea, kuhu päriselt pääseb; STAR2 dokumenteerib menetlusi, mitte teenusemaastiku auke. SotsiaalAI-l on ainulaadne positsioon: pöördujad, spetsialistid ja teenuseosutajad on samal platvormil, seega kättesaadavuse signaal + puudujäägi märge tekivad tööprotsessi kõrvalproduktina, mitte eraldi küsitlusena. Teine kandidaat on U8 (allikapõhine kvaliteedisilmus), mis muudab teadmusbaasi ajas usaldusväärsemaks kui ükski üldine vestlusrobot.

## 6. „Mitte ehitada" nimekiri

| # | Ahvatlev idee | Miks ahvatleb | Miks mitte |
|---|---|---|---|
| 1 | **Broneerimis-/kalendrisüsteem** (vastuvõtuaegade haldus, väliskalendrite sünk) | „AEG PAKUTUD" seis on ideed 11.4 loendis; tundub loogiline järgmine samm | kalendrisünk on lõputu hoolduskoorem; KOV-idel on oma süsteemid; väikseim vajadus (aja ettepanek sõnumina + kuupäevaväli U2-s) katab 90% |
| 2 | **STAR2 menetluse peegel** („minu juhtumi olek KOV-is" pöördujale) | vastaks pöörduja kõige sagedasemale küsimusele | nõuaks ametlikku liidestust ja teeks SotsiaalAI-st varju-registri; õiguslik lõks; brief keelab dubleerimise. Vastus on U10 (inimese kinnitatud kokkuvõte), mitte registripeegel |
| 3 | **Üldine DM-/sõnumisüsteem** rollide vahel väljaspool ruume | „miks ma ei saa lihtsalt kirjutada?" | dubleeriks ruume, kaotaks päritolu- ja nõusolekupiirid, tooks moderatsioonikoormuse; ruum + kutse ON sõnumikanal, millel on kontekst |
| 4 | **Avalik kogukond/foorum pöördujatele** | kogukondlik tugi kõlab missiooniga kooskõlas | haavatavate inimeste avalik foorum = tõsine moderatsiooni- ja turvarisk; kogukondlik pool on juba olemas turvalisemal kujul (abisoovid/­pakkumised + sobitusruumid); ESTA-foorum on eraldi liikmeskonna-lugu |
| 5 | **AI-triaaž / riskiskoor** pöördumiste automaatseks järjestamiseks | „aita mul tähtsaimad üles leida" on päris vajadus | ideed 13.3 keelab AI riskiskoori otsuse alusena; valepositiivid/negatiivid on siin inimohtlikud; olemasolev kiireloomulisuse märksõnavihje + vastuvõtja tööplaan on õige tase |
| 6 | **Teenuseosutaja täielik ootenimekirja-CRM** | U4 kõrval tundub loogiline jätk | teenuseosutajatel on oma süsteemid; platvormi roll on SIGNAAL (U4), mitte kliendihaldus; CRM tooks isikuandmete hulga, mida platvorm ei vaja |
| 7 | **Automaatne transkriptsioon + AI-kokkuvõte kõigis kõnedes vaikimisi** | tehniliselt peaaegu olemas (TranscriptionJob + artefaktid) | nõusolekumudel muutuks pöördumatult; kovisiooni/supervisiooni spetsifikatsioonid keelavad selle sõnaselgelt; praegune „iga samm on eraldi kasutajatoiming" on väärtus, mitte puudus |
| 8 | **Tööheaolu/koormuse võrdlustabelid juhtidele** (edetabelid, „aktiivsuse" skoorid) | juhid küsivad seda esimesena | ideed 8.8 ja 21.7 keelavad; hävitaks töötajate usalduse, millel kogu Tööheaolu kiht seisab; ainus lubatav kuju on olemasolev k-anonüümne koond |

## 7. Kokkuvõte

1. Kõige suurem avastamata auk ei ole üksikfunktsioon, vaid **kolm läbivat kihti**: sündmused/teavitused (U1+U2), jagamise elutsükli lõpuleviimine (U3+U12) ja kättesaadavuse tõde (U4+U5). Kõik kolm on väikesed, taaskasutavad olemasolevat ja ükski ei dubleeri STAR2.
2. Kolm leidu olid „funktsioon on tegelikult olemas, aga peidus": tugiisiku kutse (U9 — vajab ainult rada ja sõnastust), ametliku kirja selgitamine (dokumendianalüüs katab, vajab sisenemiskohta ja U7), teenuseosutaja kättesaadavuse väljad (U4 — vajavad struktuuri ja värskust).
3. Viis valitut: U1, U2, U4, U7, U10; prototüübiks U10; pikaajaline eristaja U4+U5 (teenusemaastiku elav pilt); kvaliteedivallikraav U8.
4. Kaheksa asja jäävad teadlikult ehitamata (ptk 6) — enamik neist dubleeriks kas STAR2, teenuseosutajate endi süsteeme või rikuks juba fikseeritud privaatsuspõhimõtteid.
5. Ükski siinne võimalus ei muuda varasemate raportite prioriteete: P0 ühendused (max-täiendus ptk 7) jäävad ette; U1 on ainus, mida tasub alustada nendega paralleelselt, sest P0.5 on selle esimene sündmus.
