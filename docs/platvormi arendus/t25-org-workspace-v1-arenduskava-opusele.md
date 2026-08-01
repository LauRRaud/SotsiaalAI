# T25 `ORG-WORKSPACE-V1` — KOV-i ja teenuseosutaja organisatsioonikihi arenduskava Opusele

Kuupäev: **01.08.2026**  
Staatus: **valmis Opusele edasiandmiseks; esmalt kohustuslik read-only `ORG-E0`, seejärel omaniku loal kolm teostusviilu**  
Eesmärk: anda Opusele üks iseseisev, koodini viiv arendusleping ja terviklik jätkuprogramm, mis seob organisatsioonikihi SotsiaalAI olemasolevate funktsioonide, hinnastuse, privaatsusmudeli ning KOV-i ja teenuseosutaja tulevaste võimalustega.

---

## 0. Opusele: kuidas seda ülesannet kasutada

See fail on tööülesanne, mitte ainult ideekogu.

Enne koodi:

1. loe tervikuna:
   - `docs/platvormi arendus/SotsiaalAI.md`;
   - käesolev fail;
   - `docs/platvormi arendus/fable-5-organisatsiooni-analuutika.md`;
   - `docs/platvormi arendus/aruandlus-teenuskirje-disain.md`;
   - `docs/platvormi arendus/SEIS.md` uusimad asjakohased sissekanded;
   - `docs/platvormi arendus/teemaarenduse-jatkamise-kord.md`.
2. kontrolli aktiivset koodi ja skeemi; ära usalda vanade dokumentide reanumbreid ega väidet, et midagi on juba ehitatud;
3. käsitle `fable-5-organisatsiooni-analuutika.md` privaatsusinvariante siduva alusena, kuid **ära teosta selle vana lameda organisatsiooni mudelit muutmata kujul**;
4. kui käesolev fail ja varasem T25 analüüs lähevad vastuollu, kehtib käesolev fail järgmistes küsimustes:
   - organisatsioonil võivad olla üksused ja tiimid;
   - KOV ja teenuseosutaja kasutavad ühist organisatsioonialust, kuid eri mooduleid;
   - organisatsioonile kuuluv töövara eristatakse inimese privaatsest varast;
   - organisatsioonisisene roll ei määra kasutaja hinnakirja;
   - organisatsioon saab osta eri hinnaga rollipõhiseid kasutajakohti.
5. kasuta määrdunud põhitööpuu asemel värsket tööpuud kanoonilisest `origin/main` baasist;
6. käsitle CORE-V1 ühe programmina, kuid mitte ühe hiigelüleandmisena: E0 ja kolm peatükis 9 kirjeldatud teostusviilu saavad igaüks oma tervikteemalise haru, testivärava ja lõppüleandmise;
7. ära merge'i, deploy ega taaskäivita tootmist ilma omaniku eraldi loata;
8. kõik autentitud runtime-katsed tehakse ainult kohalike sünteetiliste testkontodega; päris isikuandmeid ei kasutata ega väljastata;
9. E0 on kohustuslik eraldi vahevärav. Pärast E0-t esita kontrollitud andmemudeli, migratsioonide ja viilude teostusettepanek ning ära alusta koodi enne omaniku kinnitust esimesele teostusviilule. Ära kärbi privaatsus-, migratsiooni-, offboarding- ega testiosa vaikides.

---

## 1. Tulemus ühe lausega

SotsiaalAI kasutaja saab töötada isiklikult või ühe/mitme organisatsiooni kontekstis; KOV ja teenuseosutaja saavad kutsuda töötajaid, moodustada üksusi ja tiime, anda täpseid õigusi, rahastada rollipõhiseid kasutajakohti, hallata ühist vastuvõttu ja organisatsioonile kuuluvat töövara ning toetada töötajaid — ilma et organisatsioon saaks ligipääsu inimese privaatsele vestlusele, Tööheaolule, refleksioonile, mentorlusele, supervisioonile või pöörduja jagamata Teekonnale.

---

## 2. Miks vana T25 vajab enne ehitamist parandust

Vana T25 analüüs on turvapiiride poolest tugev, kuid see lähtus teadlikult mudelist „üks lame tööüksus, null hierarhiat, üksikisikule adresseeritud töö”. Uus tootesuund nõuab enamat.

### 2.1. Aktiivse koodi tänane piir

- Globaalsed rollid on `ADMIN`, `SOCIAL_WORKER`, `SERVICE_PROVIDER`, `CLIENT`.
- Kasutajal puudub organisatsiooniliikmesus.
- Teenuseosutaja profiil on seotud ühe `ownerId`-ga ja `@@unique([ownerId])` piirab profiili sisuliselt ühe inimese kontole.
- Eelpöördumise adressaat on konkreetne `recipientOwnerId`, mitte organisatsiooni vastuvõtulaud.
- Tööheaolu privaatne kiht ja koondimootor on olemas, kuid juhile saatmise päris tarnevoog puudub.
- `OrganizationAdmin` ja `MunicipalityKovAdmin` on RAG-allikate haldusmudelid, mitte kasutajaorganisatsioonid. Neid ei tohi uue organisatsioonikihiga segi ajada.

### 2.2. Uue suuna nõuded

Platvorm peab toetama vähemalt:

- KOV tervikut ja selle sotsiaalosakonda/tiime;
- väikest KOV-i, kus eraldi osakonnajuhti ei ole;
- ühe inimese teenuseosutajat;
- mitme töötaja ja mitme teenuskohaga teenuseosutajat;
- sama kasutaja kuulumist mitmesse organisatsiooni;
- olukorda, kus üks organisatsioon on korraga nii avalik asutus kui ka teenuse osutaja;
- juhti, kes haldab liikmesust, tööjaotust ja organisatsiooni vara, kuid ei näe privaatset sisu;
- organisatsioonile adresseeritud vastuvõttu ja töö järjepidevust töötaja puhkuse/lahkumise korral;
- rollipõhist hinnakirja ka siis, kui maksjaks on organisatsioon.

### 2.3. Muudatuse ulatus

Kogu SotsiaalAI-d ei tehta tenant-süsteemiks. Kasutusele tuleb **hübriidne omandimudel**:

1. isiklikud objektid jäävad kasutajale;
2. osalejatega jagatud objektid jäävad osalejapõhiseks;
3. organisatsiooni tööobjektid kuuluvad organisatsiooni tööruumi;
4. anonüümsed koondid on eraldi, isikuni puurimiseta kiht.

---

## 3. Fikseeritud tooteotsused

Need otsused on arenduse lähtepunkt. Neid ei tohi Opus vaikimisi ümber tõlgendada.

### D1. Üks konto, mitu konteksti

- Konto kuulub inimesele.
- Isiklik kontekst kasutab inimese isiklikku põhirolli.
- Organisatsiooni kontekst kasutab liikmesuse, kasutajakoha ja capability'de kombinatsiooni.
- Organisatsioonist lahkumine ei kustuta ega lukusta inimese kontot.
- Kasutaja võib kuuluda mitmesse organisatsiooni ja valida aktiivse tööruumi.

### D2. KOV ja teenuseosutaja kasutavad sama mootorit, mitte sama paketti

Ühine alus:

- organisatsioon;
- struktuur;
- liikmesus;
- kutsed;
- õigused;
- kasutajakohad;
- audit;
- töö üleandmine;
- teavitused;
- offboarding.

Erinev väärtuskiht:

- KOV: vastuvõtt, tiimidele jagamine, pöördujate sponsorlus, sotsiaalvalve, KOV/STAR-väljundid;
- teenuseosutaja: ühine teenuseprofiil, teenuskohad, kättesaadavus, suunamised, Teenuspäevik, graafik, välitöö ja aruanded.

### D3. Organisatsiooni liik ei ole uus globaalne kasutajaroll

Ära lisa globaalsesse `Role` enumisse `MANAGER`, `ORG_ADMIN`, `TEAM_LEAD` ega muud organisatsioonisisest rolli.

- `SOCIAL_WORKER` ja `SERVICE_PROVIDER` jäävad hinnastatavateks tootepersonadeks.
- juht, administraator, tiimijuht ja aruande kinnitaja on organisatsioonisisene õigus/skoop.
- sama inimene võib olla ühes organisatsioonis tiimijuht ja teises tavaline liige.

### D4. Organisatsiooni juriidiline liik ja tootemoodulid on eri asjad

Ära tee eksklusiivset valikut „KOV või teenuseosutaja”.

Organisatsioonil on:

- juriidiline liik (`MUNICIPALITY`, `PUBLIC_AGENCY`, `COMPANY`, `NGO`, `FOUNDATION`, `SOLE_PROPRIETOR`, `OTHER`);
- aktiveeritud tootemoodulid (`KOV_INTAKE`, `SERVICE_DELIVERY`, `PROFESSIONAL_SUPPORT`, `ORG_KNOWLEDGE`, hiljem `WELLBEING_AGGREGATE`, `ON_CALL`).

Sama KOV võib aktiveerida nii vastuvõtu kui teenuse osutamise mooduli.

### D5. Hinnakiri säilib

Praegused rollipõhised võrdlushinnad säilivad:

| Hinnastatav roll | Tänane võrdlushind kuus |
|---|---:|
| `CLIENT` | 7,99 € |
| `SOCIAL_WORKER` | 14,99 € |
| `SERVICE_PROVIDER` | 19,99 € |

Kontrollallikad: `lib/subscriptionPlans.js` ja `messages/et.json` hinnastuse plokk.

Kolm eri telge:

1. **hinnastatav roll** määrab paketi, funktsioonid ja kasutuspiirid;
2. **organisatsioonisisene õigus** määrab, mida inimene konkreetses tööruumis teha saab;
3. **maksja** on kasutaja ise, sponsor või organisatsioon.

Juht ei ole neljas hinnaklass.

### D6. V1 organisatsioonihind ja pöörduja sponsorluse eraldi rada

V1 ei loo üht universaalset „organisatsioonihinda”. **Organisatsiooni töötajakoht** ja **pöörduja sponsoreeritud ligipääs** on kaks eri rada.

Organisatsiooni töötajakoht:

- KOV-i spetsialisti koht lähtub `SOCIAL_WORKER` hinnast;
- teenuseosutaja koht lähtub `SERVICE_PROVIDER` hinnast;
- `OrganizationMembership.seatRole` ja `OrganizationSeatPlan.seatRole` lubavad ainult `SOCIAL_WORKER | SERVICE_PROVIDER`;
- töötajakoht eeldab organisatsiooniliikmesust ja plaani roll peab liikmesuse `seatRole`-iga klappima;
- lepinguline ühikuhind võib erineda avalikust hinnast, kuid see salvestatakse hinnasnapshot'ina koos põhjuse, kehtivusaja ja auditiga;
- soodustus ei muuda kasutaja rolli ega õigusi;
- organisatsiooni mooduli baas-, mahu- või aastatasu on tulevane hinnastusotsus, mitte CORE-V1 maksetoru vaikimisi eeldus.

Pöörduja sponsoreeritud ligipääs:

- lähtub `CLIENT` 7,99 € hinnast või eraldi lepingulisest hinnasnapshot'ist;
- kasutab sponsoreeritud tellimuse rada, mis viilus B **ehitatakse ruumist sõltumatuks** (vt E0 leiud L2/L3);
- ei kasuta `OrganizationSeatPlan`-i ega `OrganizationSeatAssignment`-i;
- ei loo `OrganizationMembership`-i ega anna ühtegi organisatsioonivaate õigust;
- testimaatriksi „kolm vaikehinda” tähendab kahte töötajakoha hinda ja eraldi `CLIENT` sponsorkutse hinda, mitte kolme `seatRole` väärtust.

### D7. Organisatsioonile kuuluv töövara on piiratud loend

V1 organisatsiooni töövara:

- organisatsiooni struktuur ja liikmesused;
- kutsed, õigused ja kasutajakohad;
- organisatsiooni teenuseprofiil, teenused ja teenuskohad;
- organisatsiooni vastuvõtujärjekorra metaandmed ja rollipõhiselt jagatud sisupakett;
- töö määramise/üleandmise ajalugu;
- organisatsiooni seaded ja tugikontaktid;
- auditeeritud organisatsioonisündmused.

Kõik muu jääb senisesse omandiklassi, kuni eraldi teemaleping ütleb teisiti.

### D8. Tööheaolu lähteinfo ei muutu organisatsiooni varaks

- `WellbeingRecord` ei saa organisatsiooni omandivõtit ega juhi nähtavust.
- Juht ei näe individuaalset signaali, vormikasutust ega „viimati aktiivne” fakti.
- Töötaja võib koostada eraldi jagatava toeavalduse ja saata selle valitud inimesele.
- Saajale läheb kinnitatud snapshot, mitte viide privaatsele lähtekirjele.
- Eluohtu ega kriisisignaali ei saadeta tööandjale automaatselt.

### D9. Kiireloomuline kanal avaneb ainult mehitatud vastuvõtjale

`ON_CALL`/Sotsiaalvalve ei kuulu CORE-V1 aktiveeritud funktsioonidesse. Hilisem moodul peab nõudma kontrollitud:

- vastutavat üksust;
- tööaega;
- lugemis- või reageerimislubadust;
- piirkonda;
- varukontakti;
- 112 piiri;
- auditit ja vahetuse üleandmist.

---

## 4. Omandi- ja nähtavusleping

| Kiht | Näited | Omanik / vastutaja | Nähtavus |
|---|---|---|---|
| Isiklik | vestlused, privaatne Tööheaolu, isiklikud dokumendid, refleksioon, isiklikud mentorlussisud | kasutaja | kasutaja ja tema teadlikud jagamised |
| Osalejatega jagatud | ruum, kinnitatud eelpöördumise pakett, kohtumise kokkuvõte | autor + konkreetsed osalejad | osalejapõhine, mitte organisatsioonipõhine |
| Organisatsiooni töö | liikmesus, ühine vastuvõtt, teenuseprofiil, määramised, seaded, tulevikus Teenuspäevik | organisatsioon | capability + üksuse skoop |
| Anonüümne koond | piisava rühma heaolu-/teenusemustrid | organisatsioonile avaldatud külmutatud agregaat | sama koond töötajale ja juhile; isikuni teed pole |

Kõvad keelud:

- organisatsiooniõigus ei asenda ühegi olemasoleva objekti owner-/participant-kontrolli;
- `OWNER` ega `ORG_ADMIN` ei ole superuser;
- ükski juhi vaade ei tohi sisaldada töötaja privaatseid kirjeid, kasutussagedust, riskiskoori või pingerida;
- organisatsiooni liikmesus ei tee pöördujast organisatsiooni „klienti” andmeomandi tähenduses;
- e-kirjadesse ei panda eelpöördumise, toeavalduse ega muu tundliku objekti sisu;
- organisatsiooni eksport ei sisalda kasutajate GDPR-andmekoopiaid ega privaatobjekte.

---

## 5. Sihtandmemudel

Nimed on soovituslikud. E0 käigus kontrollib Opus kokkupõrked aktiivse skeemi ja Prisma versiooniga. Kõik osalised unikaalsused, mida Prisma skeemikeel ei väljenda, tehakse kontrollitud raw-SQL migratsiooniga.

### 5.1. Organisatsioon ja moodulid

**`Organization`**

- `id`, `displayName`, `legalName?`, `registryCode?`;
- `legalKind`;
- `municipalityId?`;
- `status: DRAFT | PENDING_VERIFICATION | ACTIVE | SUSPENDED | ARCHIVED`;
- `createdByUserId`, kontrollija ja olekumuutuste ajatemplid;
- `defaultLocale`, `timezone` (V1: Europe/Tallinn);
- identiteedikontroll ja arhiveerimine on auditeeritud klassi A/B toimingud.

**`OrganizationModule`**

- `organizationId`, `moduleKey`, `status: DRAFT | ACTIVE | SUSPENDED`;
- `validFrom`, `validUntil?`, `activatedByUserId`, `reason`;
- unikaalne aktiivne moodul organisatsiooni ja moodulivõtme kohta;
- moodul ei anna ise sisuõigust, vaid avab vastava capability-kihi kasutamise.

### 5.2. Struktuur

**`OrganizationUnit`**

- `organizationId`, `parentUnitId?`;
- `type: DEPARTMENT | TEAM | SERVICE_LOCATION | OTHER`;
- `name`, `status`, `sortOrder`;
- maksimaalne toetatud sügavus V1-s: 3;
- tsükli loomine keelatakse serveris ja testiga;
- üksus ei ole eraldi tenant.

### 5.3. Liikmesus ja üksused

**`OrganizationMembership`**

- `organizationId`, `userId`;
- `status: ACTIVE | SUSPENDED | ENDED`;
- `seatRole: SOCIAL_WORKER | SERVICE_PROVIDER`;
- `jobTitle?`, `startedAt`, `endedAt?`, `endedReason?`;
- aktiivne liikmesus org+kasutaja kohta unikaalne;
- sama kasutaja võib olla eri organisatsioonides eri `seatRole`-iga.

**`OrganizationMembershipUnit`**

- `membershipId`, `unitId`, `isPrimary`;
- `startedAt`, `endedAt?`;
- üks aktiivne põhiüksus liikmesuse kohta;
- üksuse vahetus säilitab ajaloo.

### 5.4. Capability'd ja suhted

**`OrganizationCapabilityGrant`**

- `membershipId`;
- `capability`;
- `scopeType: ORGANIZATION | UNIT`;
- `scopeUnitId?`;
- `validFrom`, `validUntil?`, `revokedAt?`;
- `grantedByUserId`, `reason`;
- capability kehtib ainult aktiivse liikmesuse, aktiivse organisatsiooni, aktiivse mooduli ja sobiva skoobi korral.

V1 capability-kataloog:

- `ORG_OWNER`;
- `MEMBER_ADMIN`;
- `UNIT_LEAD`;
- `INBOX_COORDINATOR`;
- `WORK_ASSIGNER`;
- `SERVICE_PROFILE_EDITOR`;
- `SUPPORT_CONTACT_ADMIN`;
- `BILLING_MANAGER`;
- `AUDIT_VIEWER`;
- reserveeritud, kuid CORE-V1-s väljas: `AGGREGATE_VIEWER`, `REPORT_APPROVER`, `SCHEDULER`, `ON_CALL_COORDINATOR`.

Rollinimetused UI-s on capability-mallid, mitte uus kõva rollitabel. Näiteks „osakonnajuht” annab valitud üksuse `UNIT_LEAD + WORK_ASSIGNER`, kuid ei anna automaatselt heaolukoondi ega privaatset sisu.

**`OrganizationReportingLine`**

- `memberMembershipId`, `managerMembershipId`;
- `validFrom`, `validUntil?`;
- ainult sama organisatsiooni aktiivsed liikmesused;
- otsese juhi seos ei anna sisuõigusi;
- töötaja võib toe saatmisel valida organisatsiooni määratud alternatiivse tugikontakti.

### 5.5. Kutsed

**`OrganizationInvite`**

- `organizationId`, `email`, `tokenHash`, `status`;
- kutsuja, aegumine, revoke/accept ajatemplid;
- pakutav `seatRole`, esmane üksus ja capability-malli võti;
- kutse eelvaade näitab organisatsiooni, üksust, hinnastatavat rolli ja kavandatud õigusi;
- kutse vastuvõtt on teadlik nõustumine;
- e-posti domeen ei tekita liikmesust;
- vale e-post, aegunud token, korduskasutus ja revoke peavad fail-closed ebaõnnestuma.

### 5.6. Organisatsiooni leping ja kasutajakohad

**`OrganizationSeatPlan`**

- `organizationId`, `seatRole: SOCIAL_WORKER | SERVICE_PROVIDER`;
- `seatLimit`;
- `unitPriceCents`, `currency: EUR`, `billingInterval`;
- `source: PILOT | MANUAL_CONTRACT | INVOICE | FUTURE_CHECKOUT`;
- `validFrom`, `validUntil?`, `status`;
- avalikust hinnast erinev hind nõuab `priceReason`, tegijat ja auditit;
- hind on lepinguline snapshot, mitte jooksva hinnakirja dünaamiline viide.

**`OrganizationSeatAssignment`**

- `seatPlanId`, `membershipId`;
- `status: ACTIVE | SUSPENDED | ENDED`;
- `startedAt`, `endedAt?`, `assignedByUserId`;
- liikmesuse `seatRole` peab klappima plaani rolliga;
- seat-limit kontroll toimub tehingus;
- kohti ei „stack'ita” kasutuslimiidi korrutamiseks.

Entitlement'i serverireegel:

- isiklikus kontekstis: senine isiklik tellimus/sponsorlus;
- org-kontekstis: aktiivne org-koht või sobiv isiklik tellimus;
- tagastatav access-context nimetab alati `payerSource: SELF | INDIVIDUAL_SPONSOR | ORGANIZATION` ja vajadusel `organizationId/seatAssignmentId`;
- UI näitab kasutajale, kes tema ligipääsu rahastab;
- kaks kattuvat rahastust ei tekita automaatset raha tagastamist ega kahekordset kvooti;
- organisatsioon ei näe inimese vestluste arvu ega kasutussagedust pelgalt seetõttu, et ta maksab koha eest.

Pöörduja sponsorlus:

- `CLIENT` ei muutu organisatsiooni töötajaliikmeks;
- ära loo `CLIENT` rolliga `OrganizationSeatPlan`-i ega `OrganizationSeatAssignment`-i;
- säilita rollipõhine 7,99 € vaikehind ning lepinguline snapshot;
- ligipääsu lõpp ei tohi sulgeda pöörduja oma andmete lugemist, eksporti, jagamiste haldust ega kriisikontakte.

**E0 parandus (01.08.2026, omaniku otsused O-E0-1 ja O-E0-4).** Varasem sõnastus „kasuta/laienda olemasolevat
sponsorkutse mehhanismi ja `sponsoredByOrgId` seost" eeldas töötavat rada, mida koodis ei ole:

- `Invite.sponsoredByOrgId` on **kohatäide**, mitte seos — `TEXT` ilma FK-ta ja indeksita, ainus kirjutaja saab
  väärtuse funktsioonist `resolveSponsor(room)` (`app/api/invites/route.js`), mis tagastab alati `null`;
- `Invite.roomId` on **NOT NULL + Cascade** → tänane kutse ei saa eksisteerida ilma ruumita;
- **organisatsiooni sponsorlus ei tohi nõuda ruumi loomist.** Viil B ehitab ruumist sõltumatu sponsoreeritud
  ligipääsu raja. Olemasolevat ruumikutset ei muudeta ebamääraseks üldkutseks;
- sponsoreeritud pöörduja ei saa `OrganizationMembership`-i ega `OrganizationSeatPlan`-i.

Viilu B mahuhinnang peab arvestama, et see on **uus ehitus, mitte olemasoleva laiendus**.

### 5.7. Vastuvõtt ja töö määramine

**`OrganizationInboxItem`**

- `organizationId`, `unitId?`;
- `sourceType`, `sourceId`;
- `status: RECEIVED | REVIEWING | ASSIGNMENT_PENDING | ASSIGNED | ACCEPTED | CLOSED | REJECTED | RECALLED`;
- `receivedAt`, `lastTransitionAt`, `dueAt?`;
- `urgencyDeclaredBySender?` — inimese enda märge, mitte AI triaaž;
- ei dubleeri lähteobjekti sisu.

**`OrganizationWorkAssignment`**

- `inboxItemId`, `assigneeMembershipId`;
- määranud kasutaja, algus/lõpp, vastuvõtmine/tagasilükkamine, põhjus;
- üks aktiivne määramine korraga;
- üleandmine on uus määramine, mitte ownerId vaikne ülekirjutus;
- ajalugu säilib.

Vastuvõtupakett:

- pöörduja näeb enne saatmist adressaati kujul „organisatsiooni vastuvõtutiim”, mitte kogu organisatsioon;
- `INBOX_COORDINATOR` näeb ainult saatja kinnitatud jagamispaketti, mitte Teekonda ega vestlust;
- tavaline liige ei näe ühist postkasti;
- määratud töötaja saab sama jagamisulatuse, mitte rohkem;
- tagasivõtmine enne avamist, `openedAt`, parandus ja autoriteavitus peavad säilima;
- töö üleandmisel saab autor neutraalse teavituse uue vastutaja kohta;
- e-posti teavitus sisaldab ainult fakti ja turvalist linki.

### 5.8. Organisatsiooni tugikontakt ja toeavalduse tarne

**`OrganizationSupportContact`**

- `organizationId`, `unitId?`, `membershipId`;
- `contactType: DIRECT_MANAGER | ALTERNATE_SUPPORT | SAFETY_CONTACT`;
- `validFrom`, `validUntil?`, aktiivsus;
- vähemalt üks alternatiivne tugitee, kui organisatsioon aktiveerib professionaalse toe mooduli.

**`WellbeingSupportShare`**

- `ownerUserId`, `organizationId`, `recipientMembershipId`;
- `sourceDraftId?` ainult omaniku/auditi sisekasutuseks, mitte saaja päringu JOIN-võtmeks;
- `sharedSnapshotJson` — kasutaja kinnitatud minimaalne jagatav koopia;
- `status: SENT | OPENED | RECALLED | CORRECTED | CLOSED`;
- `sentAt`, `openedAt?`, `recalledAt?`, `correctedAt?`, `closedAt?`;
- eraldi teavitus saajale;
- saaja ei saa API kaudu lähte-WellbeingRecord'i ega mustandit;
- recall enne avamist; pärast avamist parandusjälg, mitte ajaloo vaikne muutmine;
- organisatsioon näeb ainult talle saadetud toeavaldusi, mitte vormi kasutusfakti.

### 5.9. Teenuseosutaja profiili omand

`ServiceProviderProfile` peab toetama kahte režiimi:

1. **SOLO:** kuulub ühele `ownerId` kasutajale;
2. **ORGANIZATION:** kuulub kontrollitud organisatsioonile, toimetamine käib capability kaudu.

Nõuded migratsioonile:

- olemasolevad profiilid jäävad muutmata SOLO-režiimi;
- lisa `organizationId?` ja omandirežiim;
- ära jäta org-profiili püsimist sõltuma ühe töötaja konto `Cascade` kustutusest;
- iga muudatus jääb konkreetse kasutaja auditisse; jagatud kontot ei looda;
- solo→org üleminek nõuab profiili omaniku ja org-i omaniku kinnitust ühes tehingus;
- `publicSlug`, teenused, teenuskohad, kontrolliajad ja avalik ajalugu säilivad;
- ühe organisatsiooni kohta maksimaalselt üks põhiprofiil V1-s;
- KOV võib sama mooduli aktiveerida, kui ta osutab teenuseid;
- organisatsiooni arhiveerimine ei muuda profiili vaikides kellegi isiklikuks varaks.

---

## 6. Serveripoolne juurdepääsumudel

Loo üks kanooniline resolver:

```text
resolveOrgAccessContext({ userId, requestedOrganizationId? })   // lib/org/accessContext.js
  -> personal või organization context
  -> effectiveProductRole
  -> payerSource
  -> membership + units
  -> active capabilities by scope
  -> active modules
```

**E0 nimeparandus (01.08.2026, otsus O-E0-2/O-E0-4).** Varasem nimi `resolveWorkspaceAccessContext()` on keelatud.
Sõna „workspace" on koodis juba hõivatud **teise tähendusega**: `lib/workspaces/registry.js` `WorkspaceKind`
tähistab töö-objekti liiki (`room`, `journey`, `covision_case`, `field_visit`, …) ning see tähendus kannab
`DomainEvent.workspaceKind` / `NotificationEvent.workspaceKind` välju, indeksit
`@@index([workspaceKind, workspaceId, occurredAt])` ja kausta `lib/workspaces/` (16 faili).

- serveri resolveri nimi on **`resolveOrgAccessContext()`** failis **`lib/org/accessContext.js`**;
- kasutajaliideses võib eestikeelne sõna „tööruum" jääda;
- `WorkspaceKind.ORG_SPACE` (registris juba `RESERVED`) **aktiveeritakse viilus A** organisatsioonikonteksti
  auditi ja ajajoone liitekohana. Selle kõrvale teist org-mõistet ei looda.

Reeglid:

- klient ei saada serverile usaldatavat `effectiveRole`, capability't ega maksjat;
- `orgId` URL-is on ainult päringu siht; server tõendab iga kord liikmesuse ja õiguse;
- capability ilma aktiivse liikmesuseta ei kehti;
- liikmesus ilma capability'ta ei ava haldust;
- moodulita capability ei ava mooduli route'i;
- peatatud/arhiveeritud org sulgeb kirjutused;
- võõras org, võõras üksus ja võõras tööobjekt peavad andma 404/403 vastavalt olemasolevale mittepaljastavale mustrile;
- platvormi admin ei saa organisatsiooni route'i kaudu privaatobjektide drill-down'i;
- olemasolevaid `user.role` kontrolle ei asendata üle platvormi korraga. Muuda ainult ORG-WORKSPACE-V1 puudutatud route'id keskse resolveri peale ja lisa regressioonitestid.

---

## 7. Kasutajaliides

### 7.1. Registreerimine

Registreerimise rollihinnad ja kolm põhirolli jäävad. Organisatsiooni täisprofiili ei küsita konto loomise vormis.

Pärast sisselogimist:

- „Kasutan isiklikult”;
- „Mul on organisatsiooni kutse”;
- „Loon organisatsiooni tööruumi”.

Organisatsiooni loomine läheb `DRAFT → PENDING_VERIFICATION → ACTIVE`; identiteedikontrollita ei saa avalikku profiili ega päris organisatsioonikasutust aktiveerida.

### 7.2. Tööruumivahetaja

- Isiklik tööruum on alati eraldi valik.
- Iga aktiivne organisatsioon on eraldi valik.
- Valitud kontekst on päises püsivalt nähtav.
- Viimati kasutatud kontekst võib olla kliendipoolne mugavuseelistus, mitte õiguse allikas.
- Organisatsioonivaates kuvatakse rahastatav roll ja maksja neutraalselt, nt „Spetsialisti koht · tasub X vald”.

### 7.3. Organisatsiooni põhivaated

- `/org` — organisatsioonide valik ja kutsete vastuvõtt;
- `/org/[orgId]` — ülevaade;
- `/org/[orgId]/struktuur` — üksused ja tiimid;
- `/org/[orgId]/liikmed` — liikmed, seis, üksused, capability-mallid;
- `/org/[orgId]/kutsed`;
- `/org/[orgId]/vastuvott` — ainult sobiva mooduli ja õigusega;
- `/org/[orgId]/teenused` — teenuseprofiil ja teenuskohad;
- `/org/[orgId]/tugi` — tugikontaktide haldus / mulle saadetud toeavaldused;
- `/org/[orgId]/arveldus` — kohad ja rahastus, mitte individuaalne kasutus;
- `/org/[orgId]/audit` — organisatsiooni enda haldussündmused;
- `/org/[orgId]/seaded`.

Vaated, mille moodul pole aktiivne, ei ilmu navigatsiooni ja route failib serveris suletult.

### 7.4. Juhi vaade

Juht näeb:

- liikmeid, üksusi, õigusi ja kohti;
- kutseid;
- organisatsioonile saabunud tööde seise;
- määramata ja üleandmist vajavat tööd;
- organisatsiooni teenuseprofiili värskust;
- talle teadlikult saadetud toeavaldusi;
- hiljem ainult kaitstud organisatsioonikoondit.

Juht ei näe:

- töötaja privaatseid tööheaolu vastuseid/signaale;
- vestlusi, privaatseid dokumente või refleksiooni;
- mentorluse, kovisiooni ega supervisiooni sisu;
- „viimati aktiivne”, kasutuskordade või tootlikkuse veergu;
- pöörduja kogu Teekonda;
- teiste üksuste tööd ilma vastava capability'ta.

### 7.5. A11y ja keeled

- ET/EN/RU täielik pariteet;
- klaviatuur, fookus, ekraanilugeja, 200% tekst, mobiil, reduced-motion;
- tabelitel caption/scope; mobiilis kaardivaade;
- kutse, õiguse, üleandmise ja kustutamise dialoogid ühise ligipääsetava dialoogiprimitiiviga;
- värv ei ole ainus seisu kandja.

---

## 8. Seos olemasolevate ja järgmiste funktsioonidega

| Teema | CORE-V1 tegevus | Hilisem teema |
|---|---|---|
| Vestlus/RAG | jääb isiklikuks; org-kontekst ei anna juhile lugemisõigust | `ORG-KNOWLEDGE-V1`: sisemised juhendid eraldi koguna |
| Teekond | omand muutumatu | organisatsiooni vastuvõttu saadetakse ainult kinnitatud pakett |
| Eelpöördumine | lisa organisatsiooni adressaat, vastuvõtt, määramine ja üleandmine | KOV/STAR liidesed |
| Teenusekaart | org-omandiga ühine profiil ja toimetajad | usaldusmärgis, MTR, puudujäägikoond |
| Teenuspäevik | ainult org-aluse liitekohad | `TEENUSPÄEVIK-V1`: kirjed, suunamised, graafik, aruanded |
| Välitöö | liikme/üksuse konteksti liitekoht | graafik, dispetšerlus, asendus, väljasõidu turvarada |
| Tööheaolu | päris toeavalduse tarne valitud inimesele | `ORG-WELLBEING-V1`: külmutatud kaitstud koond + tegevuskava |
| Kovisioon | omand ja sisu muutumatu | org võib kunagi rahastada; sisu jääb privaatseks |
| Supervisioon | sisu muutumatu | tellijale ainult eraldi lepinguga toimumise/arvelduse fakt |
| Mentorlus | suhe muutumatu | org võib rahastada kohta, ei näe sisu |
| Dokumendid | ei muudeta automaatselt org-varaks | organisatsiooni mallid ja juhendid eraldi objektidena |
| Maksed | org-koha ja rollihinna mudel, manual/pilot contract | päris arve, checkout, SSO/hange |
| Kriisituvastus | muutumatu fail-closed rada; tööandjale automaatset teadet ei ole | mehitatud Sotsiaalvalve eraldi teema |

---

## 9. Teostusetapid

CORE-V1 on üks tootearendusprogramm, kuid selle maht ei ole realistlik ühe haru ega ühe lõppüleandmisena. Teostus toimub kohustusliku E0 värava ja kolme suure, eraldi vastuvõetava viiluna. Need ei ole mikropaketid: igal viilul on oma kasutajale nähtav terviktulemus, skeemipiir, negatiivsed testid ja runtime.

### 9.1. Kohustuslik üleandmisjaotus

#### Üleandmine 0 — `ORG-E0` (read-only arendusvalmidus)

Sisu:

- aktiivse koodi ja skeemi inventuur;
- konfliktide ja migratsiooniriskide kontroll;
- mudelite lõplik jaotus viilude vahel;
- API/route/UI puutepinna kaart;
- täpne testiplaan;
- parent SHA ja worktree strateegia;
- `NOT_PROVEN` loend;
- hinnang, kas allolev A/B/C jaotus vajab kooditõe tõttu muutmist.

Tulemus: eraldi aruanne, **0 rakenduskoodi muudatust**. Edasi minnakse ainult omaniku kinnitatud viiluga.

#### Viil A — `ORG-FOUNDATION-V1`

Kasutajale nähtav tervik:

- organisatsiooni loomine/kinnitamine;
- üksused ja tiimid;
- e-posti kutsed;
- liikmesused ja üksuseliikmesused;
- capability'd;
- isikliku ja organisatsiooni tööruumi vahetaja;
- organisatsiooni ülevaate, struktuuri, liikmete, kutsete ja seadete vaated.

Põhimudelid:

- `Organization`;
- `OrganizationModule`;
- `OrganizationUnit`;
- `OrganizationMembership`;
- `OrganizationMembershipUnit`;
- `OrganizationCapabilityGrant`;
- `OrganizationInvite`.

Kohustuslikud etapid: E1 vastav skeemiosa, E2, E3, E4 (reporting-line jääb viilu C), E6 põhivaated, E11 vastav audit/teavitused ja E12 viilu QA.

Soovituslik haru: `codex/org-foundation-v1`.

#### Viil B — `ORG-FUNDING-INBOX-V1`

Kasutajale nähtav tervik:

- organisatsiooni makstavad `SOCIAL_WORKER` ja `SERVICE_PROVIDER` kohad;
- olemasoleva eraldi `CLIENT` sponsorkutse sidumine organisatsioonist maksjaga;
- organisatsiooni vastuvõtulaud;
- töö määramine, vastuvõtmine ja üleandmine;
- rahastuse ja vastuvõtu vaated;
- vastuvõtuga seotud offboarding.

Põhimudelid:

- `OrganizationSeatPlan` (`SOCIAL_WORKER | SERVICE_PROVIDER` ainult);
- `OrganizationSeatAssignment`;
- `OrganizationInboxItem`;
- `OrganizationWorkAssignment`;
- olemasoleva sponsorkutse/tellimuse org-seose laiendus, mitte uus `CLIENT` seat-mudel.

Kohustuslikud etapid: E5, E7, E10 vastav osa, E11 ja E12 viilu QA.

Eeldus: viil A on omaniku poolt vastu võetud ja kanoonilisse baasi integreeritud.  
Soovituslik haru: `codex/org-funding-inbox-v1`.

#### Viil C — `ORG-PROFILE-SUPPORT-V1`

Kasutajale nähtav tervik:

- organisatsioonile kuuluv, mitme toimetajaga teenuseprofiil;
- reporting-line ja alternatiivsed tugikontaktid;
- Tööheaolu eraldi toeavalduse päris tarne;
- täielik offboarding, organisatsiooni audit ja eksport CORE-V1 ulatuses;
- A/B/C ühine lõpp-runtime kahe organisatsiooniga.

Põhimudelid/muudatused:

- `OrganizationReportingLine`;
- `OrganizationSupportContact`;
- `WellbeingSupportShare`;
- `ServiceProviderProfile` omandirežiimi migratsioon;
- E10/E11 vajalikud elutsükli- ja auditiliited.

Kohustuslikud etapid: E8, E9, E10, E11 ja E12 kogu CORE-V1 lõpp-QA.

Eeldus: viil B on omaniku poolt vastu võetud ja kanoonilisse baasi integreeritud.  
Soovituslik haru: `codex/org-profile-support-v1`.

### 9.2. Viilutamise reeglid

- Iga viil algab oma värskes worktree's omaniku kinnitatud kanoonilisest baasist.
- Ükski viil ei eelda, et eelmine lokaalne haru „on kuskil olemas”; sõltuvus peab olema integreeritud baasis või omanik peab andma täpse parent SHA.
- Iga viil saab oma migratsioonid, rollback'i, ET/EN/RU, a11y, testid, runtime'i ja lõppüleandmise.
- Viilu A ei lisata „igaks juhuks” Seat/Inbox/Support tühitabeleid. Liitekohad fikseeritakse lepingus ja lisatakse siis, kui vastav viil algab.
- Viilu B `CLIENT` sponsorlus kasutab olemasolevat rada; see ei laienda viilu A liikmesusmudelit.
- Viilu C ei ava heaolukoondit; ta teostab ainult kasutaja algatatud eraldi jagatava toeavalduse.
- Pärast iga viilu peatub programm omaniku vastuvõtuks. Push ei anna luba järgmise viilu ega deploy alustamiseks.

### E0 — värske koodiaudit ja lepingu täpsustus

- kontrolli origin/main SHA ja määrdunud põhitööpuu;
- loo värske worktree/haru;
- inventeeri rolli-, tellimuse-, kutse-, eelpöördumise-, teenuseprofiili-, teavituse-, auditi- ja Tööheaolu mudelid/route'id;
- koosta `NOT_PROVEN` loend;
- kontrolli nimekonflikte (`OrganizationAdmin`);
- täpsusta migratsioonijärjekord ja rollback;
- kui leitakse turvakriitiline vastuolu, raporteeri see;
- esita peatüki 9.1 A/B/C jaotuse kooditõene kinnitus või põhjendatud parandus;
- peata pärast E0 aruannet ja oota omaniku luba viilule A.

### E1 — skeem ja migratsioonid

- lisa ainult omaniku kinnitatud aktiivse viilu mudelid ja enumid peatüki 9.1 järgi;
- viil A: organisatsioon, moodul, üksus, liikmesus, üksuseliikmesus, capability ja kutse;
- viil B: seat-plan, seat-assignment, inbox-item, assignment ning olemasoleva sponsorkutse org-seos;
- viil C: reporting-line, support-contact, support-share ja `ServiceProviderProfile` omandirežiimi migratsioon;
- ära lisa tulevaste viilude tühitabeleid ega nullable välju „igaks juhuks”;
- seo senised nullable sponsor-/organization-väljad FK-dega ainult selles viilus, mis neid päriselt kasutab, ja ainult siis, kui andmeaudit näitab ohutut migratsiooni;
- **`WellbeingPilotScope.organizationId` jääb kõigis CORE-V1 viiludes puutumata** (otsus O-E0-4). See on vaba
  tekstiväli (`lib/wellbeing/pilotScopes.js` — `cleanText`), mitte viide; ta kuulub pilootkoondi kihti, mis on
  CORE-V1-st teadlikult väljas (§13) ja liigub `ORG-WELLBEING-V1` alla. FK lisamine nõuaks andmepuhastust ilma
  ühegi CORE-V1 kasuta. Seda rida ei tohi lugeda unustuseks;
- raw-SQL osalised indeksid;
- DB-checkid või teenuskihi invariandid seal, kus XOR/tingimuslik kohustus on vajalik;
- iga viilu eraldi migration check, generate, validate ja rollback-plaan.

### E2 — access-context ja capability teenus

- üks serveritõde tööruumi konteksti jaoks;
- fail-closed membership/module/capability kontrollid;
- üksuse skoobi pärilus: org-skoop katab kõik üksused; üksuse skoop katab valitud üksuse ja selle alampuu ainult siis, kui see on lepingus selgelt testitud;
- seatRole ja payerSource lahendus;
- kõik uued route'id kasutavad seda teenust, mitte ad hoc kontrolle.

### E3 — organisatsiooni elutsükkel ja struktuur

- loomine, admin-kontroll, aktiveerimine, peatamine, arhiveerimine;
- üksuste/tiimide CRUD ja tsüklikeeld;
- organisatsiooni moodulite aktiveerimine feature-gate'i taga;
- audit ja teavitused.

### E4 — kutsed, liikmed ja õigused

- e-posti kutse, eelvaade, accept/decline/revoke/expire;
- üksuse ja seatRole valik;
- capability-mallid + detailne grant/revoke;
- kasutaja mitmes org-is;
- liikme peatamine ja lahkumine.

Reporting-line ja alternatiivsed tugikontaktid kuuluvad viilu C / E9 alla, mitte viilu A liikmesusvundamenti.

### E5 — rollipõhised kasutajakohad ja hinnastus

- `OrganizationSeatPlan` ja `OrganizationSeatAssignment`;
- tänased 14,99/19,99 professionaalsete rollide hinnad jäävad organisatsiooni töötajakohtade kanooniliseks vaikeallikaks;
- 7,99 `CLIENT` hind jääb eraldi olemasoleva sponsorkutse/tellimuse raja vaikehinnaks;
- segapakett: üks org võib omada `SOCIAL_WORKER` ja `SERVICE_PROVIDER` plaane ning eraldi sponsoreerida `CLIENT` ligipääsu;
- seat limit, hinnasnapshot, kehtivus ja audit;
- `CLIENT` seat-plaani loomise katse lükatakse serveris tagasi;
- olemasoleva isikliku tellimuse regressioonikaitse;
- olemasoleva sponsorkutse org-seos;
- UI-s maksja selgus;
- päris org-checkout ja arvegeneraator jäävad gate'i taha / ulatusest välja, kui eraldi lepingut pole.

### E6 — tööruumivahetaja ja organisatsiooni UI

- `/org` ja põhivaated;
- konteksti päis;
- isikliku ja org-konteksti selge eristus;
- moodulipõhine navigatsioon;
- juhi/member vaate serveriprojektsioonid;
- mobiil/a11y/i18n.

### E7 — organisatsiooni vastuvõtt, määramine ja üleandmine

- pöörduja saab valida kontrollitud organisatsiooni vastuvõtutiimi;
- organisatsioonile saadetav kinnitatud pakett;
- koordinaatori piiratud nähtavus;
- määramine, vastuvõtt, tagasilükkamine, üleandmine;
- recall/openedAt/correction;
- neutraalsed teavitused;
- autori jagamisulatus ei laiene;
- offboarding leiab poolelioleva töö ja nõuab üleandmist.

### E8 — teenuseosutaja organisatsiooniprofiil

- SOLO ja ORGANIZATION režiim;
- olemasoleva profiili turvaline teisendamine;
- mitu isikustatud toimetajat;
- teenused/asukohad/publicSlug säilivad;
- konto kustutamine ei hävita org-profiili;
- KOV saab aktiveerida teenuse osutamise mooduli;
- avaliku projektsiooni regressioonitestid.

### E9 — tööheaolu toe päris tarne

- töötaja valib otsese juhi, alternatiivse tugikontakti või turvakontakti;
- kinnitab jagatava snapshot'i;
- saaja saab neutraalse teavituse ja avab ainult snapshot'i;
- openedAt, recall enne avamist, correction pärast avamist, closed;
- privaatse lähtekirje null-leke;
- kriisirada jääb eraldi ja ei tekita tööandjale automaatset sündmust.

### E10 — offboarding, eksport ja audit

Offboarding-kontrollnimekiri:

1. pooleliolevad organisatsiooni tööd;
2. aktiivsed määramised;
3. teenuseprofiili vastutav toimetamine;
4. seat assignment;
5. capability'd;
6. üksuse/juhi seosed;
7. liikmesuse lõpetamine.

Reeglid:

- organisatsiooni töö jääb organisatsioonile;
- kasutaja privaatne töö jääb kasutajale;
- midagi ei kanta automaatselt kolleegile ilma objektiklassi lubatud üleandmiseta;
- konto jääb alles;
- audit elab vajaliku retention'i ulatuses;
- organisatsiooni eksport sisaldab haldus- ja organisatsiooni töövara, mitte privaatset sisu.

### E11 — teavitused, observability ja ops

- kasuta olemasolevat `NotificationEvent`/outbox kihti;
- dedupe ja idempotentsus;
- tundliku sisuta e-kirjad;
- haldustoimingud `DataAuditLog` või selle kanoonilise järglase kaudu;
- organisatsiooni tervisemõõdikud ainult platvormi ops-vaates;
- org-juht ei näe individuaalset AI kasutust;
- feature-gate'i seisu ja keelatud aktiveerimiskatseid logitakse privaatsusturvaliselt.

### E12 — QA, dokumentatsioon ja lõppüleandmine

- sihitud testid;
- täisregressioon mõistlikus ulatuses;
- Prisma migratsiooniahel;
- lint, i18n, build;
- autentitud sünteetiline runtime;
- kahe org-i negatiivsed testid;
- cleanup ainult ülesande sünteetiliste andmete ulatuses;
- dokumenteeri `DONE / NOT_DONE / NOT_PROVEN / OUT_OF_SCOPE / runtime not_run` ausalt.

---

## 10. Feature-gate'id ja aktiveerimisväravad

Vaikimisi tootmises väljas:

- `ORG_WORKSPACE_ENABLED`;
- `ORG_CREATION_ENABLED`;
- `ORG_SEATS_ENABLED`;
- `ORG_INBOX_ENABLED`;
- `ORG_PROVIDER_PROFILE_ENABLED`;
- `ORG_SUPPORT_SHARE_ENABLED`;
- tulevik: `ORG_WELLBEING_AGGREGATES_ENABLED`;
- tulevik: `ORG_ON_CALL_ENABLED`.

Kahe tasandi reegel:

1. globaalne gate;
2. organisatsiooni aktiivne moodul/grant.

Gate väljas:

- UI ei reklaami funktsiooni;
- route failib suletult;
- päris isikuandmeid ei looda;
- taimerid/workers ei töötle teemat;
- sünteetiline testkeskkond võib gate'i ajutiselt sisse lülitada.

Aktiveerimisväravad:

| Värav | Vajalik enne |
|---|---|
| organisatsiooni identiteedi kontroll | esimese päris org-i ACTIVE seis |
| andmetöötlus-/kasutusleping | esimese päris töötajaliikmesuse aktiveerimine |
| hinnastuse ja arvelduse otsus | esimene päris org-koht väljaspool pilooti |
| vastuvõtu adressaadi ja tagasivõtu tekstide õiguslik/tooteline kinnitus | päris eelpöördumine org-postkasti |
| tööheaolu toe jagamise teavitus ja tööandja rolli õiguslik kontroll | esimene päris toeavaldus |
| eraldi O-WB koondotsus | ükskõik milline heaolukoond org-vaates |
| mehitatud vastuvõtuleping | ON_CALL/Sotsiaalvalve aktiveerimine |

---

## 11. Kohustuslik testimaatriks

### 11.1. Isolatsioon ja õigused

- kasutaja A org-is 1 ei näe org 2 olemasolu, liikmeid, kutseid, tööd ega profiili haldust;
- üks kasutaja kahes org-is, erinevad seatRole'id ja capability'd;
- vale orgId, unitId, membershipId, inboxItemId, supportShareId;
- capability ilma aktiivse membership'ita;
- membership ilma capability'ta;
- aegunud/revoked capability;
- peatatud/arhiveeritud org;
- org-owner ei näe privaatset Tööheaolu, vestlust, dokumenti, refleksiooni, mentorlust, kovisiooni ega supervisiooni;
- platform-admin ei saa org-route'i kaudu sisudrilldown'i.

### 11.2. Kutsed

- õige konto/e-post;
- vale e-post;
- aegumine;
- revoke;
- tokeni korduskasutus;
- sama org-i aktiivse liikmesuse topeltloomine;
- kutse pakutud õiguste eelvaade ja nõustumine;
- e-postis tundliku sisu puudumine.

### 11.3. Struktuur

- parent-child hierarhia;
- max sügavus;
- tsükli katse;
- üksuse liigutamine;
- liikme põhiüksuse vahetus ajalooga;
- unit-scope ei leki õdeüksusesse.

### 11.4. Hinnastus ja kohad

- `SOCIAL_WORKER` ja `SERVICE_PROVIDER` OrganizationSeatPlan'i vaikehinnad 14,99 / 19,99;
- eraldi olemasoleva `CLIENT` sponsorkutse vaikehind 7,99;
- `CLIENT` OrganizationSeatPlan'i loomine → 400 ja DB kõrvalmõju 0;
- sponsoreeritud `CLIENT` ei saa OrganizationMembership'i ega organisatsioonivaate õigust;
- KOV-i `SOCIAL_WORKER` koht;
- teenuseosutaja `SERVICE_PROVIDER` koht;
- sama org-i segarollidega plaanid;
- seat-limit tehinguline võistluskatse;
- role mismatch;
- hinnasnapshot ei muutu hilisema avaliku hinnamuutusega;
- self + org seat kattuvus ei topelda kvooti;
- payerSource serveritõde;
- org ei näe individuaalset kasutussagedust;
- aegunud ligipääsuga inimene näeb jätkuvalt oma andmeid ja kriisikontakte.

### 11.5. Vastuvõtt ja üleandmine

- saatja näeb täpset adressaati ja jagatavat eelvaadet;
- tavaline org-liige ei näe inbox'i;
- koordinaator näeb ainult kinnitatud paketti;
- määratud töötaja ei saa lisasisu;
- assignment accept/reject;
- sama töö topeltmääramise võistlus;
- recall enne avamist;
- correction pärast avamist;
- üleandmisel säilib jagamisulatus;
- autor saab neutraalse teavituse;
- offboarding ei jäta tööd omanikuta.

### 11.6. Teenuseprofiil

- olemasolev solo-profiil jääb pärast migratsiooni tööle;
- solo→org kinnitusring;
- kaks toimetajat, CAS-konflikt;
- võõra org-i toimetaja 404;
- publicSlug/teenused/asukohad säilivad;
- töötaja konto kustutus ei kustuta org-profiili;
- org arhiveerimine käitub lepingujärgselt;
- avalik projektsioon ei leki sisemisi liikmeid ega auditit.

### 11.7. Tööheaolu toeavaldus

- lähtekirje on ainult omanikule;
- snapshot sisaldab ainult kasutaja kinnitatud välju;
- saaja ei saa sourceDraft/sourceRecord'i;
- vale saaja/org/unit fail-closed;
- openedAt;
- recall enne avamist;
- correction audit pärast avamist;
- e-postis puudub sisu;
- otsese juhi kõrval on alternatiivne tugikontakt;
- kriisisignaal ei tekita org-teavitust.

### 11.8. Gate'id, audit ja idempotentsus

- iga gate väljas: UI puudub, API suletud, DB kõrvalmõju 0;
- korduv callback/event ei loo dubleeritud liikmesust, kohta, määramist ega teavitust;
- capability/seat/member/offboarding toimingud audititud;
- auditiprojektsioon org-ile ei sisalda privaatset sisu;
- org-i eksport ja kasutaja andmekoopia on eri rajad.

### 11.9. Runtime-stsenaarium

Sünteetiliselt vähemalt:

1. loo KOV-organisatsioon, sotsiaalosakond ja kaks tiimi;
2. kutsu juht ja kaks spetsialisti;
3. määra `SOCIAL_WORKER` kohad ja eri capability'd;
4. sama kasutaja liitub teise org-i teise õigusega;
5. pöörduja saadab kinnitatud paketi KOV-i vastuvõttu;
6. juht määrab töö, töötaja võtab vastu, teine töötaja ei näe seda;
7. töö antakse üle;
8. töötaja saadab eraldi toeavalduse alternatiivsele tugikontaktile;
9. loo teenuseosutaja org, teisenda solo-profiil org-profiiliks ja lisa teine toimetaja;
10. offboard'i töötaja ning tõenda: org-töö säilib, capability/seat lõpevad, privaatne sisu ja konto jäävad;
11. org 1 ei näe org 2 andmeid;
12. kustuta ainult ülesandes loodud sünteetilised kirjed.

---

## 12. Definition of Done

CORE-V1 programm on valmis alles pärast E0 ning omaniku poolt vastu võetud viile A, B ja C. Üksik viil on valmis oma peatüki 9.1 kasutajaterviku ja kohaldatavate E-etappide järgi; ta ei tohi väita kogu CORE-V1 valmimist.

Kogu CORE-V1 DoD:

- E0–E12 nõuded on viilude 0/A/B/C peale kaetult täidetud või omanikuga kirjalikult ümber otsustatud;
- üks kasutaja saab turvaliselt kasutada isiklikku ja mitut org-konteksti;
- KOV saab luua struktuuri, kutsuda töötajaid, anda õigusi ja rahastada eri hinnaga rolle;
- teenuseosutaja saab organisatsioonile kuuluva, mitme toimetajaga profiili;
- organisatsiooni vastuvõtt, määramine, üleandmine ja offboarding töötavad;
- Tööheaolu toeavaldus jõuab päriselt valitud saajale ilma lähtekirje lekketa;
- juhi vaade ei sisalda individuaalset heaolu-, kasutus- ega privaatinfot;
- olemasolevad individuaalsed tellimused, hinnad, sponsorkutsed ja isiklikud tööruumid ei regressi;
- migratsioonid ja rollback on kontrollitud;
- ET/EN/RU, a11y, mobiil, lint, build ja sihitud testid on rohelised;
- kahe org-i negatiivne runtime tõendab serveripoolset lahusust;
- feature-gate väljas on pärisandmete kõrvalmõju null;
- lõppüleandmine eristab selgelt: `DONE`, `NOT_DONE`, `NOT_PROVEN`, `OUT_OF_SCOPE`, `runtime`;
- commit/push tehakse ainult omaniku antud ulatuses; merge/deploy ei ole osa DoD-st.

---

## 13. Teadlikult ulatusest väljas CORE-V1-s

- töötaja individuaalne heaoluskoor või „punaste töötajate” nimekiri;
- juhi kasutus-/tootlikkuse dashboard;
- organisatsiooni heaolukoond (eraldi `ORG-WELLBEING-V1`);
- Sotsiaalvalve/ON_CALL päris aktiveerimine;
- Teenuspäeviku täisfunktsioon, graafik, logistika ja aruandlus (eraldi olemasoleva disainilepingu alusel);
- STAR/s-veeb/TIS päris liidesed;
- org-supervisiooni sisu või ORG_META;
- mentorluse/kovisiooni sisu nähtavus tööandjale;
- automaatne töötaja lisamine e-posti domeeni järgi;
- SSO/SCIM;
- palga-, puhkuse- või personalisüsteem;
- täis-ERP/CRM;
- päris org-checkout, e-arve ja raamatupidamine ilma eraldi makseteemata;
- avalik organisatsioonikataloog väljaspool olemasolevat teenuseprofiili;
- tasuline Teenusekaardi järjestus või „lead'ide” müük;
- AI automaatne triaaž, sobivus-, riski- või kvaliteediotsus;
- vaba filtritega org-analüütika;
- isikliku konto kustutamine organisatsiooni poolt.

---

## 14. Terviklik võimekuste kaart ja jätkuarenduste programm

CORE-V1 ei ole kogu organisatsioonivisioon. See on vundament, mille peale allolevad võimekused ehitatakse. Opus peab E0/E1 arhitektuuris looma puhtad liitekohad, kuid ei tohi kõiki jätkuteemasid samasse harusse vaikides sisse tõmmata.

### 14.1. Organisatsiooni võimekuste lõppkaart

| Võimekuste rühm | Lõppvõimekus | KOV | Teenuseosutaja | Teostuskoht |
|---|---|---:|---:|---|
| Konto ja kontekst | isiklik tööruum + mitu organisatsiooni + selge vahetaja | jah | jah | CORE-V1 |
| Struktuur | osakonnad, tiimid, teenuskohad, juhid ja liikmed | jah | jah | CORE-V1 |
| Liitumine | e-posti kutse, eelvaade, nõustumine, hulgikutse hiljem | jah | jah | CORE-V1 + `ORG-ACCESS-V2` |
| Õigused | org- ja üksusepõhised capability'd, tähtajad, audit | jah | jah | CORE-V1 |
| Hinnastus | eri hinnaga `SOCIAL_WORKER`/`SERVICE_PROVIDER` töötajakohad + eraldi `CLIENT` sponsorlus | jah | jah | CORE-V1 |
| Vastuvõtt | ühine postkast, määramine, vastuvõtmine, üleandmine | jah | jah | CORE-V1 |
| Teenuseprofiil | organisatsioonile kuuluv profiil, mitu toimetajat ja teenuskohta | võib olla | jah | CORE-V1 |
| Tööheaolu tugi | töötaja valitud saajale päriselt saadetav piiratud toeavaldus | jah | jah | CORE-V1 |
| Offboarding | organisatsiooni töö säilib, õigused lõpevad, konto jääb inimesele | jah | jah | CORE-V1 |
| Teenuse osutamine | suunamine, Teenuspäevik, graafik, välitöö, mahud | võib olla | jah | `TEENUSPÄEVIK-V1` |
| Aruandlus | tööaja-, sisu-, kvaliteedi- ja riigiväljundid ühest teenuskirjest | võib olla | jah | `TEENUSPÄEVIK-V1` |
| Kättesaadavus | teenuskohtade, vabade kohtade ja vastuvõtuvõime elav seis | jah | jah | `SERVICE-AVAILABILITY-V2` |
| Professionaalne tugi | org maksab mentorluse/supervisiooni/kovisiooni eest, sisu jääb privaatseks | jah | jah | `ORG-PRO-SUPPORT-V1` |
| Tööheaolu koond | piisava rühma külmutatud koond, isikuni teedeta tegevuskava | jah | jah | `ORG-WELLBEING-V1` |
| Teadmus ja sisseelamine | sisemised juhendid, mallid, rollipõhine onboarding | jah | jah | `ORG-KNOWLEDGE-V1` |
| Kvaliteedijuhtimine | kvaliteedijuhise enesehindamine, tegevuskava ja kontrollrütm | jah | jah | `ORG-QUALITY-V1` |
| Koostöö | KOV-i ja osutaja suunamised, osalejapõhised ruumid ja lõpetamine | jah | jah | `CROSS-ORG-COLLAB-V1` |
| Kiireloomuline abi | piirkondlik vastuvõtt, valvegraafik ja vahetuse üleandmine | jah | lepingu korral | `SOCIALWATCH-V1` |
| Haldus ja integratsioon | aastaplaan, arved, SSO/SCIM, STAR/s-veeb | jah | jah | `ORG-BILLING-V2` + `ORG-INTEGRATIONS-V1` |

### 14.2. KOV-i võimaluste sihtpakett

KOV-i organisatsioonipakett peab lõpuks võimaldama:

- KOV terviku, sotsiaalosakonna ja tiimide struktuuri;
- juhi, osakonnajuhi, tiimijuhi, töötaja ja tugikontakti õigusi;
- töötajate kutsumist ja organisatsiooni makstavaid spetsialistikohti;
- elanike sponsoreeritud ligipääsu ilma elanikku töötajaliikmeks muutmata;
- organisatsioonile adresseeritud eelpöördumisi;
- vastuvõtulauda, töö määramist, asendamist ja üleandmist;
- pöördujale nähtavat vastutava töötaja muutust;
- organisatsiooni dokumente, juhendeid ja AI kasutamise reegleid;
- professionaalse toe rahastamist sisu nägemata;
- kaitstud tööheaolu koondit ja organisatsiooni tegevuskava;
- teenuste kättesaadavuse ja puudujäägi koondpilti;
- digitaalset suunamist teenuseosutajale;
- teenuse lõpetamise ja järgmisele osapoolele üleandmise rada;
- piirkondliku ühise vastuvõtu või valve tööruumi;
- STAR/s-veebi ekspordi või liidese ettevalmistust;
- organisatsiooni andmete eksporti, arhiveerimist ja kontrollitud sulgemist.

### 14.3. Teenuseosutaja võimaluste sihtpakett

Teenuseosutaja organisatsioonipakett peab lõpuks võimaldama:

- üksikteenuseosutaja sujuvat kasvu organisatsiooniks;
- ühist avalikku teenuseprofiili ja mitut isikustatud toimetajat;
- mitut teenuskohta, tiimi ja juhti;
- teenuste kataloogi, piirkondi, sihtrühmi, hindu, tingimusi ja nõutavaid suunamisi;
- tegevusloa/MTR kontrolli ja läbipaistvat usaldusmärgistust;
- tegeliku kättesaadavuse, vabade kohtade ja vastuvõtuvõime uuendamist;
- organisatsioonile saabunud eelpöördumiste ja suunamiste vastuvõttu;
- graafikut, asendamist, päevaplaani ja välitööd;
- Teenuspäevikut ja teenusmahu jääki;
- nelja märgi välitöövoogu ning töötaja turvarada;
- kuu- ja sisuaruandeid ning aruande kinnitusringi;
- kliendi arusaamise, paranduse ja tagasiside kinnitust;
- kvaliteedijuhise tegevuskava ja kontrollrütme;
- organisatsiooni makstavat tööheaolu, mentorlust, supervisiooni ja kovisiooni;
- töötaja lahkumise korral töö, graafiku, klientide ja aruannete järjepidevust;
- STAR/s-veebi valmis väljundeid;
- organisatsiooni andmete eksporti ja lõpetamist.

### 14.4. Täiendavate arendusideede register

Kõik varasema „SotsiaalAI organisatsioonikihi ideestiku” täiendavad ideed on allpool nimelise arendusteemana. Ükski ei kao „muu” kategooriasse.

| ID / teema | Võimekus ja kasutajaväärtus | Esmane sihtrühm | Eeldus | Privaatsus- või toote piir | Valmis, kui |
|---|---|---|---|---|---|
| **A1 `ORG-KNOWLEDGE-V1`** | organisatsiooni sisemine teadmuskeskus juhendite, mallide, kontaktide ja töökorraldusega | mõlemad | CORE-V1 + failielutsükkel | rangelt eraldi isiklikest dokumentidest ja RAG `OrganizationAdmin` registrist; üksusepõhine õigus | töötaja leiab oma rolli/üksuse ajakohase juhendi, omanik ja värskus on nähtavad |
| **A2 `ORG-ONBOARDING-V1`** | uue töötaja rollipõhine sisseelamisrada, kontrollnimekiri ja vajalikud esimesed sammud | mõlemad | A1 + liikmesus | ei ole töötaja hindamine ega tootlikkusskoor | juht määrab raja, töötaja näeb samme, „tehtud” on töötaja/ülesande fakt, mitte sisuanalüüs |
| **A3 `ORG-COMPETENCY-RHYTHM-V1`** | pädevuste, tegevuslubade ja koolituste kehtivuse meeldetuletused | mõlemad | A1 + kontrollitud profiiliväljad | ei loo automaatset sobivusotsust; tundlikke hinnanguid ei hoita | kehtivus, vastutaja ja meeldetuletus töötavad; aegumine ei eemalda inimest automaatselt töölt |
| **A4 `ORG-STAFFING-V1`** | puhkuse, ajutise asendamise ja töö üleandmise voog | mõlemad | CORE-V1 assignment + units | ei ole täis personalisüsteem; puudumise põhjust ei pea hoidma | asendaja kinnitab, töö ei jää omanikuta, algne vastutaja taastub kontrollitult |
| **A5 `ORG-AFTERCARE-V1`** | raske juhtumi või töövägivalla järel kiire toe valik | mõlemad | CORE-V1 support-share + Tööheaolu | juhtumit ei järeldata vestlusest; tööõnnetuse/ohutusraport on eraldi teadlik rada | töötaja saab ühe sammuga valida privaatse järeltoe või eraldi ametliku ohutusteate |
| **A6 `SERVICE-AVAILABILITY-V2`** | teenuskohtade, vabade kohtade, ooteaja ja vastuvõtuvõime elav signaal | teenuseosutaja, KOV | org-profiil + teenuskohad | info peab kandma `lastVerifiedAt`; automaatkorje ei tohi avada kiiret rada | Teenusekaart näitab kontrollitud seisu ja saadab aegumise meeldetuletuse |
| **A7 `SERVICE-REFERRAL-V1`** | KOV-i ja osutaja digitaalne suunamine koos mahu, perioodi ja tingimustega | mõlemad | CORE-V1 inbox + org-collab | ainult vajalik kinnitatud info; ei teki ühist kliendiregistrit | suunamine saadetud→avatud→vastu võetud/tagasi lükatud→lõpetatud on auditeeritud |
| **A8 `REPORT-APPROVAL-V1`** | teenuse- ja sisuaruande kontroll, parandus ning vastutava isiku kinnitus | teenuseosutaja | Teenuspäevik | AI väljund on mustand; kinnitaja vastutab lõppteksti eest | aruandel on allikakirjed, versioonid, kinnitaja ja eksporditav kinnitatud kuju |
| **A9 `CLIENT-CONFIRMATION-V1`** | inimene saab teenuse kokkuvõtte kohta öelda „sain aru / mul on parandus” | pöörduja + osutaja/KOV | U10 muster + A8 | klient ei kinnita arveldusfakte, mida ta ei saa hinnata; parandust ei kirjutata üle | parandusjälg jõuab vastutajale ja lõppversiooni päritolu on nähtav |
| **A10 `ORG-QUALITY-V1`** | kvaliteedijuhise enesehindamine, tegevuskava, vastutajad ja kontrollrütm | mõlemad | A1 + org-moodulid | ei ole ostetav usaldusmärk ega AI kvaliteediskoor | kriteerium, tõend, tegevus, omanik, tähtaeg ja järelkontroll moodustavad auditeeritud rütmi |
| **A11 `ORG-AI-POLICY-V1`** | organisatsiooni enda AI kasutamise reeglid, lubatud andmed ja kinnituskohad | mõlemad | A1 | reeglid ei tohi nõrgendada SotsiaalAI platvormi kõvasid keelde | kasutaja näeb enne töövoogu oma org-i juhist ja kinnitaja rolli; versioon/aegumine on hallatud |
| **A12 `ORG-PRO-SUPPORT-V1`** | organisatsioon maksab mentorluse, supervisiooni või kovisiooni koha eest | mõlemad | org-seats/billing + olemasolevad tugimoodulid | tööandja näeb ainult lepingus lubatud tellimus-/toimumisfakti, mitte sisu ega isiklikke tulemusi | rahastus, kutse, osalemisõigus ja arveldusfakt töötavad; sisule null ligipääsu |
| **A13 `REGIONAL-DESK-V1`** | mitme KOV-i piirkondlik ühine vastuvõtulaud | KOV-id | cross-org + vastuvõtuleping | iga partneri vastutus, piirkond ja üleandmisreegel peab olema selge | pöördumine jõuab ühe kontrollitud ukse kaudu õige üksuseni ning vastuvõtt kinnitatakse |
| **A14 `CROSS-ORG-COLLAB-V1`** | KOV-i, teenuseosutaja ja teiste partnerite osalejapõhine koostööruum | mõlemad | CORE-V1 + ruumide osalejamudel | org-liikmesus üksi ei anna ruumi ligipääsu; cross-tenant vaikimisi suletud | iga osaleja, jagatud artefakt, õigus ja lahkumine on isikustatud ning piiratud konkreetse tööga |
| **A15 `SERVICE-CLOSURE-V1`** | teenuse lõpetamine, lõppkokkuvõte ja järgmisele osapoolele üleandmine | mõlemad + pöörduja | A7–A9 | üleandmine ei laienda varasemat nõusolekut; inimene näeb, kellele mis läks | lõpetamise põhjus/kuupäev, kinnitatud kokkuvõte, järeltee ja vastuvõtukinnitus on olemas |
| **A16 `ORG-OFFBOARDING-V2`** | töötaja lahkumise täisnimekiri: töö, profiilid, graafik, aruanded, õigused ja kohad | mõlemad | CORE-V1 + järgnevate moodulite liitekohad | privaatset sisu ei anta organisatsioonile ega asendajale | süsteem tõendab, et org-töö sai vastutaja ja ükski org-õigus ei jäänud kehtima |
| **A17 `ORG-EXPORT-CLOSE-V1`** | organisatsiooni andmete eksport, arhiveerimine, retention ja kontrollitud sulgemine | mõlemad | CORE-V1 + failielutsükkel | org-eksport ei sisalda kasutajate privaatset andmekoopiat; seadusest tulenev säilitus jääb | manifestiga eksport, kontrollnimekiri, audit, arhiveeritud read-only seis ja purge-värav töötavad |
| **A18 `ORG-ACCESS-V2`** | hulgikutsed, domeeni tõendamine, SSO ja SCIM | suuremad org-id | CORE-V1 stabiilne + leping | domeen ei anna automaatselt ligipääsu; deprovision lõpetab ainult org-õigused | bulk/SSO kasutaja läbib sama liikmesuse, õiguse ja offboarding-lepingu |

### 14.5. Täiendavad võimalused, mis seovad olemasolevad moodulid organisatsiooniga

Need ei vaja kõik uut suurt toodet, kuid vajavad teadlikke liitekohti.

#### Vestlus ja RAG

- Isiklik vestlus jääb isiklikuks ka org-kontekstis.
- Organisatsioon saab tulevikus pakkuda kinnitatud sisemisi juhendeid eraldi allikaklassina.
- Vastuses tuleb eristada riiklik allikas, organisatsiooni juhis ja kasutaja enda privaatne materjal.
- Juht ei näe, mida töötaja sisemisest juhendist küsis.

#### Teekond ja eelpöördumine

- Pöörduja Teekond ei saa `organizationId` omandivõtit.
- Pöörduja saab saata ainult enda üle vaadatud paketi organisatsiooni vastuvõttu.
- Vastuvõtja muutus, avamine, tagasivõtt ja parandus on pöördujale nähtavad.
- Organisatsioon ei saa kunagi nuppu „jaga kogu Teekond”.

#### Dokumendid ja materjalid

- „Minu dokument” ja „organisatsiooni dokument/mall” on kasutajaliideses eri objektid.
- Isikliku dokumendi muutmine org-malliks vajab eraldi teadlikku avaldamist või koopia loomist.
- Organisatsiooni mallil on omanik, versioon, kehtivus, sihtrühm ja järgmine kontroll.

#### Kovisioon, supervisioon ja mentorlus

- Organisatsioon võib luua ligipääsu ja tasuda koha eest.
- Sisu, isiklikud märkmed, hinnangud ja tulemused jäävad osalejatele.
- Kui tulevikus näidatakse tellijale toimumise fakti, vajab see eraldi ORG_META lepingut ja minimaalset projektsiooni.

#### Välitöö ja turvalisus

- Organisatsiooni üksus annab töötajate/teenuskohtade ringi, mitte pideva asukohaseire loa.
- Puhkus/asendus peab töötama ilma jagatud kontota.
- Turvasignaal läheb töötaja valitud või organisatsiooniga kokku lepitud kontrollitud kontaktile.
- Täpne asukohatempel on valikuline hetkefakt; pidev trajektoor ei ole vaikimisi osa tootest.

#### Maksed ja sponsorlus

- Organisatsioon saab osta eri hinnaga rolle ja pöörduja ligipääsu.
- Organisatsiooni maksmine ei anna sisuõigust.
- Sponsorluse lõpp ei võta inimeselt oma andmete lugemise ja ekspordi õigust.
- Hilisem aastaplaan/mahuhind peab säilitama rolli hinna ja kasutuspiiride läbipaistvuse.

#### Kriisituvastus ja kiireloomuline abi

- Eluohu korral peatub tavavestlus ja kuvatakse inimabi kontaktid; org-kontekst ei muuda seda.
- Tööandjale ei saadeta automaatset kriisiteavitust.
- Mitteeluohtlik kiireloomuline abipalve saab minna org-vastuvõttu ainult kontrollitud mehitatud kanali korral.
- AI ei otsusta prioriteeti ega luba reageerimisaega.

### 14.6. Programmi arenduslained

#### Laine A — organisatsiooni vundament

**Teema:** `ORG-WORKSPACE-V1` (käesoleva faili CORE-V1)  
**Tulemus:** struktuur, liikmesus, õigused, hinnastatud kohad, vastuvõtt, üleandmine, org-profiil, toeavaldus, offboarding.  
**Järgmise laine värav:** kahe org-i sünteetiline runtime, serveripoolne isolatsioon, olemasoleva hinnakirja regressioonikaitse.

#### Laine B — teenuseosutaja digikodu ja KOV-i suunamisrada

**Teemad:** `TEENUSPÄEVIK-V1`, A6–A9, A15.  
**Tulemus:** kättesaadavus, suunamine, teenuskirjed, graafik/välitöö, aruande kinnitusring, kliendi parandus ja teenuse lõpetamine.  
**Värav:** päris aruandevormide/mallide valideerimine ja teenuseinfo retention'i õigusotsus.

#### Laine C — hoitud töötaja, õppiv organisatsioon

**Teemad:** `ORG-WELLBEING-V1`, A1–A5, A10–A12.  
**Tulemus:** teadmuskeskus, onboarding, pädevusrütm, asendamine, raske juhtumi järelhoid, kvaliteeditegevused, AI-reeglid ja org-i rahastatud professionaalne tugi.  
**Värav:** tööheaolu koondi õiguslik klassifikatsioon, rühmalävi ja partnerileping; sisu nähtavus jääb keelatuks.

#### Laine D — organisatsioonide võrgustik ja piirkondlik abi

**Teemad:** A7, A13–A15, `SOCIALWATCH-V1`.  
**Tulemus:** KOV-i ja osutaja koostöö, piirkondlik ühine vastuvõtt, mehitatud kiireloomuline kanal, vahetuse üleandmine ja partnerkanal.  
**Värav:** iga kanali vastutaja, tööaeg, piirkond, 112 piir, reageerimislubadus ja andmevahetusleping.

#### Laine E — asutuse elutsükkel ja riigiliidesed

**Teemad:** A16–A18, `ORG-BILLING-V2`, `ORG-INTEGRATIONS-V1`.  
**Tulemus:** täis-offboarding, eksport/sulgemine, aastaplaan/arve, bulk/SSO/SCIM, STAR/s-veeb.  
**Värav:** partneri tehniline spetsifikatsioon, hanke-/arveldusmudel ja retention'i kinnitatud reeglid.

### 14.7. Programmi järjestusreeglid

1. Laine A valmib enne seda, kui ükski jätkuteema hakkab looma oma org-, team-, member- või role-tabeleid.
2. Teenuspäevik ei loo paralleelset töötajate ega organisatsioonide registrit; ta kasutab CORE-V1 konteksti.
3. Tööheaolu koond ei ole CORE-V1 toeavalduse „järgmine ekraan”, vaid eraldi õigus- ja anonüümsusteema.
4. Teadmuskeskus ei taaskasuta RAG `OrganizationAdmin` mudelit kasutajate organisatsiooni liikmesuse või õiguste kandjana.
5. Cross-org koostöö ei tee organisatsioone vastastikku tenant-adminideks; õigused jäävad konkreetse ruumi, suunamise või artefakti külge.
6. Kiireloomulist kanalit ei avata demo- ega turundusvajadusest; ta vajab päris inimest ja tööprotsessi.
7. Hinnastuse muutus ei muudeta õiguste migratsiooniks. Hind, tootepersona, capability ja maksja jäävad eri telgedeks.
8. Iga laine saab oma feature-gate'i, sünteetilise runtime'i, cleanup'i ja lõppüleandmise.
9. „Peidetud” tähendab gate väljas ja päris isikuandmeid null, mitte ainult navigeerimislingi puudumist.
10. Kõik ideed jäävad registrisse ka siis, kui nende aktiveerimisvärav pole veel täidetud.

---

## 15. Opuse lõppüleandmise kohustuslik kuju

E0 ja iga viil A/B/C saavad eraldi üleandmise. Üleandmine nimetab ainult selles viilus tegelikult tehtud etapid ega väida järgmiste viilude või kogu CORE-V1 valmimist.

Iga kohaldatav lõpparuanne peab sisaldama:

- haru ja worktree;
- parent/origin SHA;
- commit'id ja remote SHA, kui push oli lubatud;
- muudetud failide loend ja diff-stat;
- skeem/migratsioonid ja rollback;
- realiseeritud E-etapid ja teadlikult järgmisse viilu jäetud etapid;
- privaatsusinvariantide tõendid;
- hinnakirja ja kohtade regressioonitõendid;
- testid täpsete käskude ja tulemustega;
- runtime-stsenaariumi tõendid sünteetiliste andmetega;
- gate'ide seis;
- `DONE / NOT_DONE / NOT_PROVEN / OUT_OF_SCOPE`;
- teadaolevad riskid;
- kinnitus, et põhitööpuu, merge ja deploy jäid puutumata;
- cleanup'i tulemus.

---

## 16. Lühike käivitusülesanne Opusele

> Tee esmalt ainult T25 `ORG-E0` read-only arendusvalmiduse kontroll käesoleva faili peatüki 9.1 järgi. Loe kohustuslikud alusdokumendid tervikuna, kontrolli aktiivset koodi, skeemi, hinnastust ja migratsiooniriski ning esita viilude A/B/C kooditõene kinnitus või põhjendatud parandus. E0 ei muuda rakenduskoodi ega skeemi. Fikseeritud tooteotsus: `OrganizationMembership.seatRole` ja `OrganizationSeatPlan.seatRole` lubavad ainult `SOCIAL_WORKER | SERVICE_PROVIDER`; `CLIENT` 7,99 € sponsorlus kasutab eraldi olemasolevat sponsorkutse/tellimuse rada, ei loo organisatsiooniliikmesust ega OrganizationSeatPlan'i. Käsitle peatüki 14 võimekuste kaarti ja A1–A18 registrit jätkulainete siduva teekaardina. Peatu pärast E0 üleandmist ja oota omaniku eraldi luba viilule A. Ära merge'i ega deploy'd.
