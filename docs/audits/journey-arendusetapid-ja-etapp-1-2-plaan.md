# Journey arendusetapid ja Etapp 1-2 tehniline plaan

## 1. Lühikokkuvõte

Minu hinnang: plaan on loogiline, tehtav, asjalik ja vajalik, kui SotsiaalAI tooteline suund on päriselt teekonnakeskne. Auditite põhjal on platvormil palju eraldiseisvaid funktsionaalseid plokke olemas, kuid puudub keskne Journey/JourneyMap kiht, mis seoks kasutaja olukorra, soovitatud järgmised sammud, teenusekaardi, eelpöördumise, dokumendid, abisoovid ja ruumid üheks kasutaja jaoks arusaadavaks teekonnaks.

Etapiline lähenemine vastab suurele teekonnakesksele visioonile, sest see ei püüa punkte 1-19 korraga arendusülesandeks muuta. Suur mudel kirjeldab lõppseisundit; etapid kirjeldavad turvalist teostusjärjekorda. Õhukesest core'ist alustamine on põhjendatud, sest ilma püsiva Journey objektita jääks teekonnaloogika ainult UI või prompti tasemele. Samas ei ole mõistlik alustada chat/RAG tuuma muutmisest, sest praegune vestlusvoog on juba mitmekihiline: privacy check, rolli- ja ligipääsukihid, workflow harud, RAG/context koostamine, vastuse genereerimine ja allikate kuvamine.

Esimene loomise voog on mõistlik teha pöörduja-keskseks. See hoiab MVP kitsana ja sobib privaatsusloogikaga: teekond on alguses privaatne, spetsialist või teenuseosutaja näeb hiljem ainult kasutaja kinnitatud eelinfot. Kolme rolli mudel ei kao ära, vaid lükkub hilisematesse kihtidesse. See ei ole tagasiminek suurest visioonist, vaid viis vältida olemasoleva chat/RAG, eelpöördumise, teenusekaardi, ruumide ja ligipääsuloogika lõhkumist.

Peamine täpsustus: Etapp 2 vajab minimaalse draft-review UI osa juba enne Etapp 3 detailset teekonnakaardi UI-d. Etapp 2 peab võimaldama mustandi ülevaatamist ja kinnitamist; Etapp 3 võib jääda salvestatud Journey detailvaate ja jätkamise kogemuse etapiks.

## 2. Etappide koondtabel

| Etapp | Nimi | Eesmärk | Kas koodimuudatus? | Sõltuvused | Risk | Prioriteet |
|---|---|---|---|---|---|---|
| 0 | Otsused ja piirid | Lukustada Journey loomise, privaatsuse, rollide ja mittepuututavate süsteemide piirid | Ei, ainult otsused | Run 1-3 ja MVP spetsifikatsioon | Keskmine: ebamäärased otsused paisutavad MVP-d | P0 |
| 1 | Õhuke Journey core | Lisada minimaalne püsiv Journey objekt, API ja teenusekiht | Jah, hilisemas arendus-run'is | Etapp 0 | Keskmine: liiga lai andmemudel või liiga palju seoseid | P1 |
| 2 | Kontrollitud pöörduja algusvoog | Anda pöördujale eraldi koht teekonna alustamiseks, ilma chat/RAG tuuma puutumata | Jah, hilisemas arendus-run'is | Etapp 1 | Keskmine: draft generation võib muutuda uueks chat-orchestration'iks | P1 |
| 3 | Teekonnakaardi minimaalne UI | Kuvada salvestatud Journey kasutajale arusaadava kaardina | Jah | Etapp 1-2 | Madal-keskmine: UI võib liiga vara muutuda suureks dashboard'iks | P2 |
| 4 | Journey -> teenusekaart | Avada olemasolev teenusekaart Journey kontekstist eelfiltriga | Jah | Etapp 1-3 | Madal-keskmine: nõrgad filtrid võivad anda ebatäpse kogemuse | P2 |
| 5 | Journey -> eelpöördumine | Avada olemasolev eelpöördumine eel täidetud kontekstiga | Jah | Etapp 1-3 | Keskmine: privaatse teekonna ja jagatud eelinfo piir peab olema selge | P2 |
| 6 | Chat'i mitteinvasiivne soovitus | Lubada chat'il soovitada teekonna alustamist, ilma automaatse salvestuseta | Jah | Etapp 1-5 | Kõrge: chat/RAG voogu ei tohi muuta liiga sügavalt | P3 |
| 7 | Spetsialisti esimene seos | Näidata spetsialistile ainult kasutaja kinnitatud eelinfot eelpöördumise kaudu | Jah | Etapp 5 | Keskmine: nähtavuspiir peab olema tootena lukustatud | P3 |
| 8 | Teenuseosutaja esimene seos | Näidata teenuseosutajale ainult teenusega seotud kinnitatud eelinfot | Jah | Etapp 4-5 | Keskmine: teenuseosutaja nähtavuse piir vajab eraldi otsust | P3 |
| 9 | Vestlusruumi päritolu/meta | Lisada ruumidele päritolu metainfo ilma room süsteemi ümber ehitamata | Jah | Etapp 5, 7, 8 | Keskmine: room päritolu võib minna segamini ligipääsuga | P4 |
| 10 | Teenusekatkemise kontroll | Lisada Journey peale teenuse jätkumise kontroll ja seotud eelpöördumine | Jah | Etapp 3, 5 | Keskmine-kõrge: vajab sisulist teenuseloogikat | P4 |
| 11 | Teenusekaardi accessPath | Rikastada teenusekaarti teenuseni jõudmise loogikaga | Jah | Etapp 4 valideerimine | Kõrge: andmekvaliteedi ja sync'i töö | P4 |
| 12 | Tervisekontakti piiratud kiht | Lisada kitsas tervisekontakti suund ilma terviseplatvormiks muutumata | Jah | Etapp 4, 11 osaline selgus | Kõrge: piirid peavad olema tootes väga selged | P5 |
| 13 | Rollipõhised Journey töölauad | Luua pöörduja, spetsialisti ja teenuseosutaja rollipõhised Journey vaated | Jah | Etapp 1-8 valideerimine | Kõrge: suur UI ja ligipääsu laiendus | P5 |

## 3. Vastavus suurele visioonile

| Suure plaani osa | Millises etapis realiseerub? | Märkus |
|---|---|---|
| Privaatne assistendivestlus | Olemasolev chat/RAG säilib; Journey soovitus Etapp 6 | Etapp 1-2 ei muuda chat'i. See on teadlik tehniline piir. |
| Teekonnakaart | Etapp 1-3 | Etapp 1 loob objekti, Etapp 2 loob mustandi ja salvestuse, Etapp 3 teeb detailsema kasutajavaate. |
| Nähtavad tööriistad | Etapp 3-5, hiljem 10 | Teenusekaart ja eelpöördumine tulevad olemasolevate tööriistade handoff'idena. |
| Läbivad usalduskihid | Etapp 0-2 ja kogu edasine arendus | Privacy/authz/source attribution tuuma ei dubleerita ega refaktoreerita. |
| Pöörduja | Etapp 1-5 | Esimene loomise ja kasutamise voog on pöörduja-keskne. |
| Spetsialist | Etapp 7, hiljem 13 | MVP-s spetsialist ei loo samasugust Journey't, vaid näeb kinnitatud eelinfot. |
| Teenuseosutaja | Etapp 8, hiljem 13 | Teenuseosutaja näeb ainult teenusega seotud kinnitatud infot. |
| Teenusekaart | Etapp 4, hiljem 11 | Alguses eelfilter; accessPath on hilisem suurem töö. |
| Eelpöördumine | Etapp 5, hiljem 7 | Journey ei dubleeri eelpöördumist, vaid annab prefill konteksti. |
| Vestlusruum | Etapp 9 | Room süsteemi ei ehitata ümber; lisandub päritolu/meta. |
| Teenusekatkemise risk | Etapp 10 | Ei kuulu esimese MVP sisse. Vajab eraldi sisulist mudelit. |
| Tervisekontakti piiratud suund | Etapp 12 | Hilisem kitsas kiht, mitte meditsiiniotsuste süsteem. |
| Rollipõhised töövaated | Etapp 13 | Tulevad pärast põhivoogude valideerimist. |

## 4. Etappide detailne kontroll

### Etapp 0 - otsused ja piirid

- Järjekord: õige. See peab tulema enne igasugust arendust.
- Maht: sobiv. Otsused on piisavalt konkreetsed ja enamik neist on jah/ei tüüpi.
- Täpsustus: lisada tuleks otsus, kas Etapp 2 draft tekib ainult käsitsi struktureerimisest või võib kasutada eraldi AI draft teenust.
- Seotud failid/moodulid: otsene koodimuudatus puudub; hiljem mõjutab `prisma/schema.prisma`, `lib/journey/**`, `app/api/journeys/**`, `app/api/chat/route.js`, `lib/chat/**`, `app/api/pre-inquiries/**`, teenusekaardi mooduleid ja room mooduleid.
- Puutumata jätta: kõik rakenduse koodifailid kuni arendusloa andmiseni.
- Vastuvõtukriteeriumid: tooteomanik on kinnitanud automaatse mitteloomise, privaatse vaikeseisu, esimese pöörduja-keskse voo ja mittepuututavad süsteemid.

### Etapp 1 - õhuke Journey core

- Järjekord: õige. Ilma core objektita muutuks hilisem UI, handoff ja rolliloogika ajutiseks metadata kihiks.
- Maht: sobiv, kui jääda ainult Journey objektile, owner-põhisele ligipääsule ja minimaalsele API-le.
- Täpsustus: `Journey.status` võib katta arhiveerimise; eraldi `archivedAt` ei ole MVP-s vältimatu.
- Seotud failid/moodulid: `prisma/schema.prisma`, uus `lib/journey/**`, uus `app/api/journeys/route.js`, uus `app/api/journeys/[id]/route.js`, olemasolev auth/session kiht, `lib/authz.js`.
- Puutumata jätta: `app/api/chat/route.js`, `lib/chat/**`, `app/api/pre-inquiries/**`, teenusekaardi sync, `Room` mudel, billing/subscription tuum.
- Vastuvõtukriteeriumid: kasutaja saab luua privaatse Journey; kasutaja näeb ainult enda Journey objekte; võõras Journey ei ole ligipääsetav; Journey saab arhiveerida; vaikimisi `sharingStatus` on privaatne.

### Etapp 2 - kontrollitud pöörduja algusvoog

- Järjekord: õige, kui Etapp 1 on valmis.
- Maht: sobiv, aga vajab selget piiri: see ei tohi muutuda üldiseks chat'i asenduseks.
- Täpsustus: Etapp 2 peab sisaldama minimaalset mustandi ülevaatamise ja kinnitamise UI-d. Etapp 3 jääb salvestatud Journey detailvaate ja järgneva kasutuskogemuse jaoks.
- Seotud failid/moodulid: uus `app/minu-teekonnad/**` või `app/teekonnad/**`, uus `components/journey/**`, `lib/journey/**`, võimalik uus `app/api/journeys/draft/route.js`, olemasolevad auth ja privacy check mustrid.
- Puutumata jätta: `app/api/chat/route.js`, `components/alalehed/ChatBody.jsx`, `lib/chat/retrievalContextAssembler.js`, `lib/chat/sourceAttribution.js`, `lib/chat/responseFinalizer.js`.
- Vastuvõtukriteeriumid: pöörduja saab eraldi vaates olukorra kirjeldada; süsteem koostab mustandi; kasutaja saab mustandit muuta; salvestus toimub ainult kinnitusega; salvestatud Journey on privaatne.

### Etapp 3 - teekonnakaardi minimaalne UI

- Järjekord: õige pärast Etapp 1-2.
- Maht: sobiv, kui see ei laiene dashboard'iks ega timeline'iks.
- Täpsustus: Etapp 3 ei peaks uuesti lahendama loomise mustandit, vaid kuvama ja võimaldama hallata juba salvestatud Journey't.
- Seotud failid/moodulid: `app/minu-teekonnad/[id]/**` või `app/teekonnad/[id]/**`, `components/journey/**`, `app/api/journeys/[id]/route.js`.
- Puutumata jätta: rollipõhised töölauad, Room, PreInquiry status, teenusekaardi andmemudel.
- Vastuvõtukriteeriumid: kasutaja avab Journey detaili; näeb kokkuvõtet, teemasid, puuduolevat infot, riskSignals ettevaatlikke märkusi, suggestedActions samme ja privaatsusmärget.

### Etapp 4 - Journey -> teenusekaart

- Järjekord: õige pärast Etapp 1-3. Võib liikuda paralleelselt Etapp 5-ga, kui Journey detailvaade on olemas.
- Maht: sobiv, kui kasutatakse eelfiltreid ega muudeta teenusekaardi mudelit.
- Täpsustus: nõrga filtri korral peab teenusekaart avanema tavarežiimis, mitte andma võltsi täpsust.
- Seotud failid/moodulid: teenusekaardi leht, teenusekaardi API route'id, `ServiceMapEntry`, teenusekaardi päringu/filter utiliidid.
- Puutumata jätta: service map sync, uued teenusekaardi tüübid, accessPath mudel.
- Vastuvõtukriteeriumid: Journey detailis olev "Ava teenusekaart" avab olemasoleva teenusekaardi võimaliku piirkonna, `primaryPath`, `domains` või otsingusõna filtriga.

### Etapp 5 - Journey -> eelpöördumine

- Järjekord: õige pärast Etapp 1-3. Võib liikuda paralleelselt Etapp 4-ga.
- Maht: sobiv, kui tegemist on prefill handoff'iga, mitte uue intake'iga.
- Täpsustus: vastuvõtja ei tohi näha privaatset Journey't ega chat'i; ta näeb ainult kasutaja kinnitatud eelpöördumise sisu.
- Seotud failid/moodulid: `app/api/pre-inquiries/**`, `lib/preInquiries.js`, `lib/preInquiriesQuestionnaire.js`, `lib/preInquiriesAssessment.js`, eelpöördumise UI.
- Puutumata jätta: `PreInquiry.status` enumid, eelpöördumise põhimudel, olemasolev vastuvõtu workflow.
- Vastuvõtukriteeriumid: Journey detailist saab avada eelpöördumise; vorm on eel täidetud; kasutaja saab kõike muuta; jagamine toimub ainult kasutaja kinnitusega.

### Etapp 6 - chat'i mitteinvasiivne soovitus

- Järjekord: konservatiivne ja mõistlik pärast Etapp 1-5. Kui tooteprioriteet nõuab chat-first kogemust, võib seda kaaluda pärast Etapp 3, kuid see tõstab regressiooniriski.
- Maht: keskmine-kõrge, sest olemasolev chat/RAG pipeline on mitmekihiline.
- Täpsustus: chat ei tohi Journey't automaatselt luua ega salvestada.
- Seotud failid/moodulid: `app/api/chat/route.js`, `lib/chat/**`, `components/alalehed/ChatBody.jsx`, `components/chat/**`, `components/chat/hooks/useConversationSources.js`.
- Puutumata jätta Etapp 1-5 ajal: kogu chat/RAG tuum.
- Vastuvõtukriteeriumid: tavaline RAG-vastus ei muutu; sobiva olukorrakirjelduse puhul kuvatakse ainult soovitus või kinnitusküsimus; püsiv Journey tekib alles kasutaja kinnitusega eraldi voos.

### Etapp 7 - spetsialisti esimene seos

- Järjekord: õige pärast Etapp 5.
- Maht: keskmine, sest see sõltub eelpöördumise vastuvõtu nähtavusest.
- Täpsustus: spetsialist ei näe kogu privaatset Journey't.
- Seotud failid/moodulid: eelpöördumise vastuvõtu vaated ja workflow route'id, võimalik ruumi loomise workflow.
- Puutumata jätta: spetsialisti täis Journey töölaud, Journey ühiskasutusmudel.
- Vastuvõtukriteeriumid: spetsialist näeb ainult eelpöördumise kaudu jagatud kinnitatud eelinfot ja saab olemasoleva töövoo piires lisainfot küsida.

### Etapp 8 - teenuseosutaja esimene seos

- Järjekord: õige pärast Etapp 4-5.
- Maht: keskmine, sest teenuseosutaja nähtavus ja teenusega seotud eelinfo piir vajab täpset tooteotsust.
- Täpsustus: teenuseosutaja ei näe inimese kogu teekonda.
- Seotud failid/moodulid: teenuseosutaja profiil, teenusekaardi kirjed, eelpöördumise teenusega seotud suunad.
- Puutumata jätta: teenuseosutaja täis Journey töölaud ja üldine jagatud teekonna mudel.
- Vastuvõtukriteeriumid: teenuseosutaja näeb ainult konkreetse teenuse või pöördumisega seotud kasutaja kinnitatud eelinfot.

### Etapp 9 - vestlusruumi päritolu/meta

- Järjekord: õige pärast eelpöördumise ja teenuseosutaja seoste selgumist.
- Maht: keskmine, kui piirduda päritoluga; suur, kui siduda sellega ligipääsu ümberkirjutamine.
- Täpsustus: `roomOriginType` ja `roomOriginId` on alguses ohutumad kui kohustuslik `journeyId`.
- Seotud failid/moodulid: `Room` mudel, `app/api/rooms/**`, `lib/rooms/access.js`, kutsed ja ruumi liikmelisus.
- Puutumata jätta: room õiguste tuum ja olemasolev invite/call loogika.
- Vastuvõtukriteeriumid: süsteem teab, kas ruum tekkis eelpöördumisest, abisoovi matchist või käsitsi kutsest, ilma olemasolevat ruumi töövoogu lõhkumata.

### Etapp 10 - teenusekatkemise kontroll

- Järjekord: õige hilisem etapp.
- Maht: keskmine-kõrge, sest vajab sisulist teenuse jätkumise loogikat ja võimalikku dokumendi analüüsi.
- Täpsustus: seda ei tohiks siduda Etapp 1-2 Journey core'i kohustuslikuks väljaks peale üldise `riskSignals` JSON välja.
- Seotud failid/moodulid: Journey detail, eelpöördumine, dokumendi analüüs, teenusekaart.
- Puutumata jätta: MVP core andmemudel üle ei tohi spetsialiseeruda teenusekatkemisele.
- Vastuvõtukriteeriumid: kasutaja saab märkida või süsteem saab ettevaatlikult küsida teenuse jätkumise infot ning selle põhjal koostada eraldi eelpöördumise.

### Etapp 11 - teenusekaardi accessPath

- Järjekord: õige pärast Etapp 4 valideerimist.
- Maht: suur. See on teenusekaardi andmekvaliteedi ja andmemudeli töö, mitte Journey MVP osa.
- Täpsustus: accessPath ei tohiks olla eeltingimus Journey -> teenusekaart handoff'ile.
- Seotud failid/moodulid: `ServiceMapEntry`, teenusekaardi import/sync, admin haldus, teenusekaardi UI.
- Puutumata jätta esimeses faasis: service map sync ja uued tüübid.
- Vastuvõtukriteeriumid: teenusekaardi kirjel on teenuseni jõudmise info, mille allikas ja kontrollituse staatus on arusaadav.

### Etapp 12 - tervisekontakti piiratud kiht

- Järjekord: õige hilisem etapp.
- Maht: suur tooteotsuse mõttes, isegi kui tehniline mudel on väike.
- Täpsustus: tervisekontakt võib esialgu olla soovitatud järgmine samm, mitte teenusekaardi täistüüp.
- Seotud failid/moodulid: teenusekaart, Journey suggestedActions, võimalik allikate/ohutusjuhiste kuvamine.
- Puutumata jätta: diagnoosi, ravi või terviseotsuste loogika.
- Vastuvõtukriteeriumid: platvorm suunab piiratud ametlike kontaktide juurde ega anna meditsiinilist otsustust.

### Etapp 13 - rollipõhised Journey töölauad

- Järjekord: õige viimane suur etapp pärast põhivoogude valideerimist.
- Maht: suur arhitektuuriline ja UI töö.
- Täpsustus: rollipõhiseid töölaudu ei tohiks kasutada Etapp 1-2 ulatuse laiendamiseks.
- Seotud failid/moodulid: töölaud, rollipõhised vaated, authz, provider dashboard, specialist workflow.
- Puutumata jätta esimeses faasis: olemasolevad töölauad ja rollipõhised põhivaated.
- Vastuvõtukriteeriumid: iga roll näeb ainult oma tööks vajalikku Journey'ga seotud infot ja olemasolevad töövood säilivad.

## 5. Sõltuvuste kaart

- Etapp 0 on kõigi arendusetappide eeltingimus.
- Etapp 1 on tehniline eeltingimus Etappidele 2-13.
- Etapp 2 sõltub Etapp 1 API-st ja ligipääsuloogikast.
- Etapp 3 sõltub Etapp 1-2 valminud Journey objektist ja salvestatud andmetest.
- Etapp 4 ja Etapp 5 sõltuvad Etapp 1-3-st, kuid võivad omavahel paralleelselt areneda.
- Etapp 6 peaks tulema pärast Etapp 1-5, sest siis on olemas tegelik koht, kuhu chat saab kasutaja suunata.
- Etapp 7 sõltub Etapp 5-st.
- Etapp 8 sõltub Etapp 4-5-st.
- Etapp 9 sõltub sellest, et eelpöördumise, teenuseosutaja ja ruumi päritolu töövood on selgemad.
- Etapp 10 sõltub Etapp 3-st ja soovitatavalt Etapp 5-st.
- Etapp 11 sõltub Etapp 4 kogemusest ja teenusekaardi andmekvaliteedi otsustest.
- Etapp 12 sõltub tervisekontakti toote- ja piiride otsustest ning ei ole Journey core'i eeltingimus.
- Etapp 13 sõltub põhivoogude valideerimisest: Etapp 1-8 peavad olema piisavalt stabiilsed.

## 6. Etapp 1 tehniline plaan

### Eesmärk

Luua minimaalne püsiv Journey core, mida saab hiljem siduda vestluse, eelpöördumise, teenusekaardi, dokumentide, abisoovide ja ruumidega, kuid mis MVP esimeses osas ei muuda neid olemasolevaid süsteeme.

### Andmemudel

Minimaalne `Journey` objekt:

| Väli | Soovituslik tähendus | Märkus |
|---|---|---|
| `id` | Journey unikaalne ID | Standardne primaarvõti. |
| `ownerUserId` | Teekonna omanik | Ligipääsu põhialus. |
| `conversationId` | Valikuline seos vestlusega | Etapp 1-s optional; chat integratsiooni ei ehitata. |
| `roleContext` | Loomise rollikontekst | MVP-s peamiselt `seeker`/pöörduja; ei tohi välistada hilisemaid rolle. |
| `status` | Teekonna seis | Minimaalselt `DRAFT`, `ACTIVE`, `ARCHIVED` või samaväärne. |
| `sharingStatus` | Jagamise seis | Minimaalselt `PRIVATE`; hiljem `PREPARING_SHARE`, `SHARED_VIA_PRE_INQUIRY` vms. |
| `title` | Kasutajale kuvatav pealkiri | Võib olla kasutaja muudetav. |
| `summary` | Olukorra kokkuvõte | Kasutaja kinnitatud tekst, mitte privaatse chat'i täielik sisu. |
| `primaryPath` | Esmane suund | Näiteks teenusekaart, eelpöördumine, dokument, abisoov; väärtused vajavad tooteotsust. |
| `domains` | JSON valdkonnad | Näiteks elukoht, toimetulek, hooldus, teenused. |
| `missingInfo` | JSON puuduolev info | Ei vaja MVP-s eraldi tabelit. |
| `riskSignals` | JSON ettevaatlikud tähelepanekud | Ei tähenda automaatset riskihinnangut. |
| `suggestedActions` | JSON soovitatud järgmised sammud | Hoiab MVP lihtsana ilma `JourneyAction` tabelita. |
| `context` | JSON täiendav struktureeritud kontekst | Handoff'ide ja hilisema laienduse jaoks. |
| `createdAt` | Loomisaeg | Standardne auditväli. |
| `updatedAt` | Muutmisaeg | Standardne auditväli. |

MVP-s ei ole vajalikud `JourneyParty`, `JourneyAction`, `Room.journeyId`, `PreInquiry.journeyId` ega teenusekaardi accessPath seosed. Need lisaksid liiga vara jagamise, töövoo ja rollide semantikat.

### API route'id

| Route | Eesmärk | Ligipääs |
|---|---|---|
| `GET /api/journeys` | Tagastab kasutaja enda Journey objektid | Ainult sisseloginud kasutaja enda objektid. |
| `POST /api/journeys` | Loob uue privaatse Journey | `ownerUserId` tuleb sessioonist, mitte kliendist. |
| `GET /api/journeys/[id]` | Tagastab ühe Journey | Ainult omanikule; võõras objekt 403 või 404. |
| `PATCH /api/journeys/[id]` | Uuendab lubatud välju või arhiveerib | Ainult omanikule; `sharingStatus` muutmine piiratud. |

### Teenusekiht

Soovituslik uus moodul: `lib/journey/**`.

Minimaalne jaotus:

- `lib/journey/service.js` või samaväärne: create/list/get/update/archive.
- `lib/journey/access.js` või samaväärne: owner-põhine ligipääs.
- `lib/journey/validation.js` või samaväärne: lubatud väljad ja JSON payload'i piirid.
- `lib/journey/serializers.js` või samaväärne: API-st väljuv kuju.

Teenusekiht peab kasutama olemasolevat sessiooni, authz ja Prisma kasutusmustrit. Ta ei tohi dubleerida üldist authz tuuma.

### Ligipääsukontroll

- `ownerUserId` on peamine ligipääsu kontroll.
- MVP-s on Journey privaatne.
- Kliendi saadetud `ownerUserId` tuleb ignoreerida või keelata.
- Võõra kasutaja Journey lugemine ja muutmine peab olema blokeeritud.
- Admini erivaadet ei ole Etapp 1 MVP-s vaja lisada.
- Jagamist ei tehta Etapp 1-s; `sharingStatus` on tulevikukindel väli.

### Testid ja smoke kontrollid

Arendus-run'is tuleks kontrollida vähemalt:

- sisselogimata kasutaja ei saa Journey API-t kasutada;
- kasutaja saab luua Journey ja vaikimisi on see privaatne;
- `GET /api/journeys` näitab ainult kasutaja enda objekte;
- `GET /api/journeys/[id]` ei näita võõrast objekti;
- `PATCH /api/journeys/[id]` ei lase muuta omanikku;
- arhiveerimine muudab ainult `status` välja või kokkulepitud arhiveerimise välja;
- chat, eelpöördumine, teenusekaart ja ruumid töötavad muutmata loogikaga.

### Mida Etapp 1-s mitte muuta

- `app/api/chat/route.js`
- `lib/chat/**`
- `components/alalehed/ChatBody.jsx`
- `app/api/pre-inquiries/**`
- `PreInquiry.status`
- teenusekaardi sync ja import
- `Room` mudel ja room access
- RAG/source attribution tuum
- privacy-check tuum
- billing/subscription tuum

## 7. Etapp 2 tehniline plaan

### Eesmärk

Luua pöördujale eraldi, kontrollitud koht teekonna alustamiseks. See annab kasutajale võimaluse kirjeldada olukorda, saada struktureeritud Journey mustand, seda muuta ja kinnitada. Olemasolevat chat/RAG route'i selles etapis ei muudeta.

### Vaade ja route

Soovitus: alustada kasutajale arusaadava route'iga `app/minu-teekonnad/**`. Alternatiiv `app/teekonnad/**` on tehniliselt neutraalsem, kuid "Minu teekonnad" väljendab paremini, et objekt on privaatne ja kasutajakeskne.

Minimaalne vaade:

- teekondade nimekiri;
- nupp "Alusta uut teekonda";
- olukorra kirjelduse vorm;
- mustandi ülevaade;
- kasutaja muutmise/kinnitamise samm;
- salvestatud privaatse Journey avamine.

### Kasutajavoog

Tekstiline voog:

Kasutaja avab "Minu teekonnad"  
-> valib "Alusta uut teekonda"  
-> kirjeldab olukorda  
-> süsteem koostab mustandi  
-> kasutaja vaatab mustandi üle ja muudab vajadusel  
-> kasutaja kinnitab salvestamise  
-> `POST /api/journeys` loob privaatse Journey  
-> kasutaja näeb salvestatud teekonda

### Mustandi teke

Etapp 2-s on kaks võimalikku varianti:

| Variant | Kirjeldus | Hinnang |
|---|---|---|
| 2A: struktureeritud käsitsi mustand | Vorm jagab olukorra kokkuvõtte, teemad, puuduoleva info ja järgmised sammud kasutaja sisendi põhjal lihtsasse struktuuri | Kõige väiksem risk; ei vaja AI ega RAG muutmist. |
| 2B: eraldi AI draft teenus | Uus `lib/journey/draft.js` või samaväärne teenus koostab kasutaja tekstist JourneyDrafti | Tehtav, kuid vajab selget piiri, et see ei muutuks chat/RAG dubleerimiseks. |

Soovitus: Etapp 2 võib lubada AI draft'i ainult eraldi Journey töövoos, mitte olemasoleva chat route'i sees. Kui AI-d kasutatakse, peab vastus olema märgitud mustandiks ja kasutaja peab kõik enne salvestamist kinnitama. Kui AI lisamine kasvatab ulatust, alustada variandist 2A ja lisada 2B eraldi alametapina.

### Võimalik draft API

Kui AI või struktureeritud draft teenus lisatakse, võib kasutada eraldi route'i:

| Route | Eesmärk | Märkus |
|---|---|---|
| `POST /api/journeys/draft` | Tagastab mitte-püsiva JourneyDrafti | Ei loo `Journey` objekti. |

Draft payload peaks sarnanema Journey lubatud väljadega:

- `title`
- `summary`
- `primaryPath`
- `domains`
- `missingInfo`
- `riskSignals`
- `suggestedActions`
- `context`

Oluline: draft ei ole püsiv objekt enne kasutaja kinnitust.

### Olemasolevate komponentide taaskasutus

Võimalikud taaskasutatavad mustrid:

- olemasolev töölaud/leheraami muster;
- olemasolevad vormi- ja nupu komponendid;
- olemasolev auth/session kontroll;
- olemasolev privacy-check route või privacy guard muster kasutaja sisendi eelkontrolliks;
- olemasolev rolli tuvastus, kui vaade peab olema ainult pöördujale nähtav.

Ei ole soovitatav taaskasutada chat orchestration'i nii, et Journey draft hakkab sõltuma `app/api/chat/route.js` sisemisest vastusevoost.

### Salvestamine

- Salvestamine toimub ainult pärast kasutaja kinnitust.
- Salvestus kutsub `POST /api/journeys`.
- `ownerUserId` määratakse serveris sessiooni põhjal.
- `sharingStatus` on vaikimisi `PRIVATE`.
- `status` on kas `ACTIVE` või kokkulepitud `DRAFT`, sõltuvalt sellest, kas kasutaja kinnitatud mustand loetakse aktiivseks teekonnaks.

Soovitus: kasutaja kinnitatud esimene versioon võiks olla `ACTIVE`; salvestamata või pooleliolev UI mustand ei pea olema andmebaasi `DRAFT`.

### Mida Etapp 2-s mitte muuta

- Mitte muuta `app/api/chat/route.js`.
- Mitte muuta `lib/chat/retrievalContextAssembler.js`.
- Mitte muuta `lib/chat/sourceAttribution.js`.
- Mitte muuta `lib/chat/responseFinalizer.js`.
- Mitte lisada automaatset Journey loomist tavalise vestlussõnumi põhjal.
- Mitte ehitada uut eelpöördumise vormi.
- Mitte ehitada uut teenusekaarti.
- Mitte luua ruumisüsteemi seoseid.

## 8. Etapp 1-2 ühine vastuvõtukriteerium

Etapp 1-2 saab lugeda valmis, kui:

- tooteotsused Etapp 0 kohta on kinnitatud;
- andmebaasis on minimaalne Journey core objekt või samaväärne püsiv mudel;
- olemas on Journey loomise, lugemise, nimekirja ja muutmise API;
- Journey vaikimisi nähtavus on privaatne;
- kasutaja näeb ainult enda Journey objekte;
- võõra kasutaja Journey ei ole ligipääsetav;
- pöörduja saab eraldi vaates alustada uut teekonda;
- olukorra kirjeldusest tekib mustand;
- salvestamata mustand ei muutu püsivaks Journey objektiks;
- kasutaja saab mustandit enne salvestamist muuta;
- kinnituse järel salvestub privaatne Journey;
- chat/RAG töövoog jääb muutmata;
- eelpöördumise töövoog jääb muutmata;
- teenusekaart jääb muutmata;
- Room süsteem jääb muutmata;
- privacy/authz tuuma ei dubleerita ega refaktoreerita.

## 9. Riskid

| Risk | Seos sisendraportite ja plaaniga | Tõsidus | Maandamine |
|---|---|---|---|
| Journey core paisub liiga vara täis workflow mootoriks | Run 3 soovitas õhukest Journey kihti; plaanis on palju hilisemaid etappe | Kõrge | Etapp 1 piirata ainult objektile, owner accessile ja API-le. |
| Etapp 2 AI draft hakkab dubleerima chat/RAG orchestration'it | Praeguse chat kaardistus näitab mitmekihilist toimivat pipeline'i | Kõrge | Hoida draft eraldi `lib/journey` teenuses või alustada käsitsi struktureeritud mustandiga. |
| Eelpöördumise dubleerimine | Run 1-3 järgi PreInquiry töövoog on juba olemas | Keskmine-kõrge | Etapp 5 teha ainult prefill handoff'ina. |
| Privaatse teekonna ja jagatud eelinfo piir hägustub | Suur mudel rõhutab rollide nähtavust ja jagamist | Kõrge | `sharingStatus` ja kasutaja kinnituse reegel lukustada enne arendust. |
| Etapp 3 muutub liiga suureks dashboard'iks | Rollipõhised töölauad on hilisem Etapp 13 | Keskmine | Etapp 3 piirata ühe kasutaja Journey detailvaatega. |
| Teenusekaardi eelfilter tekitab vale täpsuse | Etapp 4 ei sisalda accessPath mudelit | Keskmine | Kui filter on nõrk, avada kaart tavarežiimis ja mitte väita kindlat sobivust. |
| Rollivaated tulevad liiga vara | Kolme rolli visioon on suur, kuid MVP on pöörduja-keskne | Kõrge | Etapp 7-8 näitavad ainult kinnitatud eelinfot; Etapp 13 alles hiljem. |
| Status ja sharingStatus ülemodelleerimine | Etapp 1 peab olema õhuke | Keskmine | MVP-s kasutada minimaalset olekute hulka. |
| Vanade RAG arhitektuuridokumentide põhjal otsustamine | Kasutaja märkis, et `rag-architecture.md` võib olla vana | Keskmine | Toetuda praegusele koodikaardistusele ja audititele, mitte vanale arhitektuurifailile. |

## 10. Tooteotsused, mis tuleb enne arendust kinnitada

| Otsus | Variandid | Soovitus | Mõju |
|---|---|---|---|
| Kas Journey tekib automaatselt chat'ist? | Jah / Ei / ainult kasutaja kinnitusega | Ei automaatselt; ainult kinnitusega | Vähendab privaatsus- ja regressiooniriski. |
| Kus algab esimene Journey loomise voog? | Chat / `Minu teekonnad` / töölaud | `Minu teekonnad` või töölaud -> Minu teekonnad | Hoiab chat/RAG puutumata. |
| Kas Etapp 2 draft kasutab AI-d? | Ei / eraldi AI draft / olemasolev chat route | Eelistatult eraldi Journey draft teenus; vajadusel alustada ilma AI-ta | Määrab Etapp 2 tehnilise riski. |
| Milline on kinnitatud Journey esmane status? | `DRAFT` / `ACTIVE` | `ACTIVE`, kui kasutaja kinnitab; salvestamata mustand ei ole DB objekt | Lihtsustab MVP olekuid. |
| Mis on `sharingStatus` MVP väärtused? | Ainult `PRIVATE` / `PRIVATE` + ettevalmistav jagamine | Etapp 1-s ainult `PRIVATE`; Etapp 5-s lisada jagamise semantika | Väldib varajast jagamismudelit. |
| Kas spetsialist näeb Journey't? | Kogu Journey / ainult eelinfo / ei näe | Ainult eelpöördumise kaudu kinnitatud eelinfo | Vastab privaatsuspiirile. |
| Kas teenuseosutaja näeb Journey't? | Kogu Journey / teenusega seotud eelinfo / ei näe | Ainult teenusega seotud kinnitatud eelinfo | Väldib liigset nähtavust. |
| Kas `primaryPath` väärtused lukustatakse MVP-s? | Vaba tekst / piiratud enum / JSON | Piiratud lubatud väärtused või kontrollitud stringid | Aitab teenusekaart/eelpöördumine handoff'i. |
| Kas `riskSignals` on kasutajale nähtav? | Jah / ei / ainult ettevaatliku tekstina | Nähtav ettevaatliku, mitte diagnoosiva tekstina | Mõjutab UX-i ja usaldust. |
| Kas `conversationId` peab Etapp 1-s olema FK? | Jah / optional string / puudub | Optional seos, mitte kohustuslik | Jätab chat integratsiooni hilisemaks. |

## 11. Mida mitte teha esimeses arendusfaasis

- Mitte refaktoreerida `app/api/chat/route.js`.
- Mitte refaktoreerida `lib/chat/**` orchestration, RAG context assemblerit, source attributionit ega response finalizerit.
- Mitte lisada automaatset Journey loomist iga vestluse peale.
- Mitte muuta `PreInquiry.status` enumit ega eelpöördumise põhimudelit.
- Mitte ehitada uut eelpöördumise/intake süsteemi.
- Mitte ehitada teenusekaarti ümber.
- Mitte muuta service map sync'i ega importi.
- Mitte lisada accessPath mudelit Etapp 1-2 sisse.
- Mitte lisada `JourneyParty` ega `JourneyAction` tabeleid Etapp 1-2 sisse.
- Mitte lisada `Room.journeyId` või room õiguste ümberkirjutamist Etapp 1-2 sisse.
- Mitte muuta privacy-check tuuma.
- Mitte muuta authz/subscription/billing tuuma.
- Mitte luua spetsialisti või teenuseosutaja Journey dashboard'i Etapp 1-2 sees.
- Mitte lisada tervisekontakti täismudelit Etapp 1-2 sisse.
- Mitte toetuda vanale `rag-architecture.md` failile otsuste alusena.

## 12. Soovitatud järgmine Codexi arendusülesanne

Pealkiri:

**SOTSAALAI JOURNEY MVP - ETAPP 1-2: Õhuke Journey core ja kontrollitud pöörduja algusvoog**

Lühikirjeldus:

Ehita ainult esimene Journey MVP plokk: minimaalne privaatne Journey andmemudel, owner-põhine ligipääs, `GET/POST/GET[id]/PATCH` API, `lib/journey` teenusekiht ja pöördujale mõeldud `Minu teekonnad` algusvoog, kus kasutaja kirjeldab olukorda, vaatab JourneyDrafti üle ja kinnitab privaatse Journey salvestamise. Ära muuda chat/RAG tuuma, eelpöördumise mudelit, teenusekaarti, ruumisüsteemi, privacy/authz tuuma ega billingut.

Lõpukontroll:

- Koodifaile ei muudetud.
- Prisma skeemi ei muudetud.
- Migratsioone ei tehtud.
- Package-faile ei muudetud.
- Build/deploy käske ei käivitatud.
- Loodi ainult Markdown-plaani fail.
- Etappide plaan vastab suurele teekonnakesksele visioonile.
- Etapp 1-2 on piisavalt täpsed, et nende põhjal saaks järgmises run'is arendusega alustada.
