# SotsiaalAI teekonnakeskse mudeli audit — Run 3 strateegiline koond

## 1. Auditi ulatus

See raport on strateegiline koondhinnang, mitte uus failide inventuur ega punktide 1-21 kordusaudit.

Põhesisendid olid:

- `docs/uus-plaan.md`
- `docs/audits/teekonnakeskne-mudel-run1-koodibaasi-kaardistus.md`
- `docs/audits/teekonnakeskne-mudel-run2-pohiaudit.md`

Märkus: kasutaja sisendis oli Run 2 failina nimetatud `docs/audits/teekonnakeskne-mudel-run2-pohjaudit.md`, kuid repo olemasolev Run 2 raport on `docs/audits/teekonnakeskne-mudel-run2-pohiaudit.md`. Run 3 kasutas olemasolevat Run 2 faili.

Koodimuudatusi ei tehtud. Rakenduse koodi, Prisma skeemi, migratsioone, konfiguratsiooni, package-faile, route'e, komponente ega teenuseid ei muudetud. See raport hindab Run 1 ja Run 2 järelduste kooskõla ning annab otsustustoe järgmise tehnilise spetsifikatsiooni jaoks.

## 2. Run 1 ja Run 2 järelduste kooskõla

Run 1 ja Run 2 on põhijäreldustes kooskõlas.

Run 1 kaardistas, et platvormis on juba olemas enamik vajalikke funktsionaalseid plokke: privaatne chat, eelpöördumine, eelkaardistus, teenusekaart, teenuseosutaja profiil, dokumendid, ruumid, abisoovid, privaatsuskiht, rollid, paketid ja RAG/allikad. Run 2 kinnitas sama peatükipõhiselt ja täpsustas, et probleem ei ole üksiku funktsiooni puudumine, vaid keskse teekonnakihi puudumine.

Run 2 täpsustas Run 1 järeldusi neljas olulises kohas:

- `PreInquiry` on tugev olemasolev sild, kuid ei asenda `Journey` objekti.
- `CovisionJourneyStep` on nime poolest sarnane, kuid kuulub kovisiooni domeeni ega ole üldine teekonnakaart.
- `Room` süsteem on tugev, kuid puudub typed origin või `journeyId` seos.
- Teenusekaart on olemas, kuid ei kanna veel peatükkide 6-7 ligipääsutee välju.

Üks Run 2 järeldus on strateegiliselt õige, kuid sõnastuses vajab ettevaatust: punktide 1, 2, 3, 4 ja 20 "SUUR ARHITEKTUURILINE MUUDATUS" ei tähenda, et kogu platvorm tuleb ümber ehitada. See tähendab, et lisandub uus siduv kiht olemasolevate moodulite kohale.

Mõlemas auditis jäi paratamatult vähem käsitletuks see, kuidas kasutaja teekonnakaardi loomist kinnitab. See on tooteotsus, mitte ainult tehniline detail, ja tuleb enne arendust lukustada.

## 3. Peamine arhitektuurne järeldus

Väide:

"Platvormil on enamik funktsionaalseid plokke olemas, kuid puudub keskne Journey/JourneyMap kiht, mis seoks vestluse, eelpöördumise, teenusekaardi, dokumendid, ruumid ja järgmised sammud üheks teekonnaks."

Hinnang: KINNITAN

Põhjendus:

- Run 1 leidis laia olemasoleva funktsionaalse baasi, kuid ei leidnud `Journey` või `JourneyMap` Prisma mudelit.
- Run 2 kinnitas peatükkide 1-4 ja 20 põhjal, et keskne puuduv osa on teekonnakaart kui juhtkiht.
- Olemasolevad objektid katavad alamosasid: `Conversation`, `PreInquiry`, `ServiceMapEntry`, `UserDocument`, `Room`, `HelpRequest`, `HelpOffer`, `HelpMatch`.
- Ükski neist ei kata dokumenti kirjeldatud rolli: kasutaja olukorra kokkuvõte, seotud teemad, puuduolev info, riskisignaalid, soovitatud järgmised sammud ja seosed teiste töövoogudega.

Järeldus on piisavalt põhjendatud. Seda ei pea enne Run 3 järel uuesti laiema inventuuriga kontrollima.

## 4. Kas Journey kiht peaks olema uus keskobjekt?

Journey/JourneyMap peaks olema päriselt uus keskobjekt, kuid mitte kohe väga lai objekt.

Soovitus:

- Esimeses tehnilises MVP-s võiks olla minimaalne püsiv `Journey` mudel.
- Journey ei peaks tekkima automaatselt iga vestluse juurde.
- Esmane chat võib luua ajutise `JourneyDraft` või struktureeritud context-väljundi.
- Püsiv `Journey` tekib siis, kui kasutaja valib "salvesta teekond", "koosta eelpöördumine selle põhjal" või "ava teekonnakaart".
- Journey peaks alguses olema privaatne ja kuuluma ühele kasutajale.
- Journey peaks olema kasutajale nähtav chati kõrval või chati sees kaardina, mitte kohe täiesti eraldi suur töölaud.

Ajutisest session/context objektist üksi ei piisa kogu mudeli jaoks, sest dokument nõuab hiljem seoseid eelpöördumise, teenusekaardi, dokumentide ja ruumidega. Ajutine objekt sobib aga esimeseks chat-sõela väljundiks enne salvestamist.

Eraldi leht võib tulla hiljem. MVP jaoks on kõige väiksem turvaline pind: chati sees või kõrval kuvatav teekonnakaart, millelt saab avada olemasoleva teenusekaardi või eelpöördumise.

## 5. Kõige väiksem turvaline MVP

| Samm | Kirjeldus | Miks vajalik | Sõltuvused | Risk |
|---|---|---|---|---|
| 1 | Lisada chati teekonnasõela struktureeritud väljund ilma olemasolevat chat flow'd lõhkumata | Võimaldab testida, kas kasutaja kirjeldusest saab teekonnasisendi | `app/api/chat/**`, `lib/chat/**` | Keskmine: prompt/orchestration võib dubleerida olemasolevaid intent-vooge |
| 2 | Luua minimaalne privaatne `Journey` objekt ainult kasutaja kinnituse järel | Annab püsiva keskpunkti ilma igale vestlusele journey't tekitamata | Prisma mudel, authz | Keskmine: vajab täpset salvestamise reeglit |
| 3 | Kuvada minimaalne teekonnakaart chati kontekstis | Annab kasutajale uue mudeli tegeliku väärtuse ilma uut töölauda ehitamata | chat UI, journey API | Madal-keskmine: UI võib muutuda koormavaks |
| 4 | Lisada teekonnalt olemasoleva teenusekaardi avamine eelfiltriga | Testib journey -> service map seost ilma teenusekaarti ümber ehitamata | `app/api/service-map/**`, service map UI | Madal: filter võib alguses olla piiratud |
| 5 | Lisada teekonnalt olemasoleva eelpöördumise loomine eel täidetud kontekstiga | Testib journey -> pre-inquiry seost ja kasutaja kinnituse mudelit | `lib/preInquiries.js`, `app/api/pre-inquiries/**` | Keskmine: ei tohi eelpöördumist dubleerida |
| 6 | Salvestada journey külge ainult lihtsad viited või JSON-context, mitte täis party/action mudelit | Hoiab esimese mudeli väiksena | Journey mudel | Madal: hilisem normaliseerimine võib vajada migratsiooni |
| 7 | Kasutada olemasolevat privacy, authz, source attribution ja room kihti muutmata | Vähendab regressiooniriski | olemasolevad kihid | Madal |

See MVP ei ehita uut ruumisüsteemi, ei tee teenusekaarti nullist ümber, ei dubleeri eelpöördumist ja võimaldab siiski testida dokumendi põhiväidet: kasutaja alustab olukorrast, mitte feature-valikust.

## 6. Mida kindlasti mitte esimeses etapis teha?

Esimeses etapis ei tohiks refaktoreerida:

- `Room` süsteemi tervikuna;
- `PreInquiry` põhimudelit suureks intake-süsteemiks;
- teenusekaardi sünk- ja kaardiloogikat nullist;
- RAG/source attribution tuuma;
- privacy-check, deletion, audit ja authz kihte;
- subscription/billing töövooge.

Esimeses etapis ei tohiks andmemudelis teha:

- täielikku `JourneyParty` ja `JourneyAction` normaliseeritud alammudelit, kui MVP saab hakkama JSON-väljadega;
- `ServiceMapEntry` täielikku ümberkujundamist;
- `Room` kõigi päritolu- ja tüübiseoste korraga ümbermigreerimist;
- `PreInquiry` status enumite ümbernimetamist.

Esimeses etapis ei tohiks UI-s ehitada:

- uut suurt rollipõhist töölauda;
- uut teenusekaardi detailide süsteemi;
- uut room UI-d;
- täielikku pöördumiste vastuvõtu töölauda;
- pakettide uut avalikku esitlust enne MVP scope'i lukustumist.

Ideed, mis peaksid ootama:

- tervisekontaktide täielik platvormisisene vastuvõtt;
- teenusekatkemise riskitasemete täielik töövoog;
- teenuseosutaja ligipääsutingimuste täielik haldus;
- rolliti detailne journey vaate eristus;
- allikapaneeli täielik ümberkujundamine kõigil pindadel.

## 7. Enne arendust lukustamist vajavad tooteotsused

| Otsus | Miks vajalik | Soovitus |
|---|---|---|
| Kas Journey salvestub automaatselt või kasutaja kinnitusega? | Mõjutab privaatsust, andmemahtu ja UX-i | Salvestada ainult kasutaja kinnitusega |
| Kas iga vestlus saab Journey või ainult valitud töövoog? | Väldib tühje ja ebavajalikke teekondi | Ainult valitud töövoog või kasutaja kinnitatud hetk |
| Kas MVP journey on chati kõrvalpaneel, chati sees kaart või eraldi leht? | Määrab UI töömahu | Chati sees või kõrval lihtsa kaardina |
| Kas eelpöördumine jääb eraldi feature'ks või muutub journey alamtegevuseks? | Väldib dubleerimist | Jätta feature alles, aga lubada journey'st eel täidetud avamine |
| Kas teenusekaart saab MVP-s ainult eelfiltri või ka uued `accessPath` väljad? | Määrab skeemimuutuse ulatuse | MVP-s eelfilter; `accessPath` järgmises etapis |
| Kas tervisekontakt on MVP-s päris teenusekaardi kirje? | Mõjutab andmemudelit ja vastutuse piire | Mitte esimeses MVP-s; esmalt ainult soovitatud järgmine samm |
| Kas `riskSignals` kuvatakse kasutajale või ainult sisemiselt? | Mõjutab sõnastust ja vastutust | Kasutajale ainult ettevaatliku tähelepanekuna, mitte riskihindena |
| Kas guided eelkaardistus läheb MVP-sse? | Võib MVP paisutada | Ainult märge "soovin täita koos spetsialistiga", mitte täis koostäitmise töölaud |
| Kas Journey seotakse Roomiga kohe? | Room mudeli muutmine suurendab riski | Mitte kohe; esimene seos läbi olemasoleva pre-inquiry -> room voo |
| Milline on esimese MVP rolliscope? | Mõjutab UI ja õiguste testimist | Alustada pöörduja rollist, spetsialistile näidata ainult olemasolev pre-inquiry vastuvõtt |

## 8. Run 2 muudatuse vajaduste kontroll

| Punkt | Run 2 hinnang | Run 3 hinnang | Põhjendus |
|---|---|---|---|
| 1 | SUUR ARHITEKTUURILINE MUUDATUS | SUUR ARHITEKTUURILINE MUUDATUS | Õige, sest muutub platvormi algusloogika. Teostus peab olema faasitud. |
| 2 | SUUR ARHITEKTUURILINE MUUDATUS | SUUR ARHITEKTUURILINE MUUDATUS | Õige, sest lisandub uus arhitektuurikiht. |
| 3 | SUUR ARHITEKTUURILINE MUUDATUS | SUUR ARHITEKTUURILINE MUUDATUS | Õige. `Journey` puudub ja on keskne uus objekt. |
| 4 | SUUR ARHITEKTUURILINE MUUDATUS | KESKMINE MUUDATUS pärast Journey alust | Run 2 hinnang on arusaadav, kuid olekud ise ei pea MVP-s olema suur eraldi süsteem. |
| 5 | KESKMINE MUUDATUS | KESKMINE MUUDATUS | Õige, kuid `JourneyParty` võib MVP-s oodata. |
| 6 | KESKMINE MUUDATUS | KESKMINE MUUDATUS | Õige. Teenusekaart on olemas, aga mudelit tuleb hiljem laiendada. |
| 7 | KESKMINE MUUDATUS | KESKMINE MUUDATUS | Õige. Ligipääsutee vajab struktureerimist, kuid mitte esimeses kõige väiksemas MVP-s. |
| 8 | VÄIKE TÄIENDUS | VÄIKE TÄIENDUS | Õige. Pre-inquiry baas on tugev. |
| 9 | KESKMINE MUUDATUS | KESKMINE MUUDATUS | Õige, kui ehitada täis guided workflow. MVP-s saab võtta väiksema alamhulga. |
| 10 | KESKMINE MUUDATUS | KESKMINE MUUDATUS | Õige. Vastuvõtt on olemas, aga intake tüübistus puudub. |
| 11 | KESKMINE MUUDATUS | KESKMINE MUUDATUS | Õige. Room süsteem on tugev, kuid origin meta puudub. |
| 12 | KESKMINE MUUDATUS | KESKMINE MUUDATUS | Õige. Eraldi continuity workflow puudub, kuid alusmoodulid on olemas. |
| 13 | KESKMINE MUUDATUS | KESKMINE MUUDATUS | Õige, kui see on päris entrypoint. Kui ainult CTA tekst, oleks väike täiendus. |
| 14 | VÄIKE TÄIENDUS | VÄIKE TÄIENDUS | Õige. Teenuseprofiil on juba tugev. |
| 15 | VÄIKE TÄIENDUS | VÄIKE TÄIENDUS | Õige. Tehniline allikakiht on olemas. |
| 16 | KESKMINE MUUDATUS | KESKMINE MUUDATUS | Õige. Rollid on olemas, kogemus vajab ümberkorraldust. |
| 17 | VÄIKE TÄIENDUS | VAJAB ERALDI TOOTEOTSUST | Tehniliselt väike, kuid pakettide piirid on tooteotsus. |
| 18 | EI VAJA MUUTMIST | EI VAJA MUUTMIST | Õige. Järjekord on mõistlik. |
| 19 | EI VAJA MUUTMIST | EI VAJA MUUTMIST | Õige. Visioon on sobiv, ajastus tuleb siduda release'iga. |
| 20 | SUUR ARHITEKTUURILINE MUUDATUS | SUUR ARHITEKTUURILINE MUUDATUS, kuid mitte eraldi tööpakett | Õige kui koondjäreldus, mitte eraldi implementation task. |
| 21 | EI VAJA MUUTMIST | EI VAJA MUUTMIST | Õige. Ülesande jada on mõistlik, scope vajab lukustamist. |

Peamine Run 3 täpsustus: punkt 4 võib MVP-s olla väiksem kui Run 2 "suur" hinnang eeldab, kui alustada ainult `PRIVATE`, `DRAFT`, `READY_FOR_ACTION` tüüpi lihtolekutega. Punkt 17 vajab pigem tooteotsust kui tehnilist täiendust.

## 9. Arhitektuurne soovitus

Soovitatud suund on õhuke Journey kiht olemasolevate funktsioonide kohal.

Minimaalne `Journey` mudel peaks hoidma ainult seda, mida muud objektid ei hoia:

- omanik;
- privaatne staatus;
- seos algse vestlusega;
- olukorra kokkuvõte;
- primary path;
- seotud valdkonnad;
- puuduolev info;
- riskisignaalid;
- soovitatud järgmised tegevused;
- lihtne context payload olemasolevate töövoogude avamiseks.

Seos `Conversation`iga:

- `Journey` võiks omada valikulist `conversationId`.
- Iga vestlus ei pea saama journey't.
- Chat võib enne salvestamist luua ajutise `JourneyDraft`.

Seos `PreInquiry`ga:

- MVP-s võib teekond avada olemasoleva pre-inquiry voo eel täidetud kontekstiga.
- Hiljem võiks `PreInquiry` saada valikulise `journeyId`.

Seos `ServiceMapEntry`ga:

- MVP-s piisab journey contextist teenusekaardi eelfiltriks.
- Valitud või soovitatud entry'd võib alguses hoida JSON-väljana.
- Hiljem võib lisada eraldi relation või `JourneyAction`.

Seos `UserDocument`iga:

- MVP-s piisab dokumendi lisamise tegevusest ja valikulistest document ID-dest JSON-contextis.
- Hiljem võib teha `JourneyDocument` seose, kui dokumente hakatakse teekonnal süstemaatiliselt kuvama.

Seos `Room`iga:

- Esimeses MVP-s mitte muuta roomi mudelit.
- Ruum võiks tekkida olemasoleva pre-inquiry -> room töövoo kaudu.
- Hiljem lisada roomile typed origin või `journeyId`.

Seos `HelpRequest` / `HelpOffer` / `HelpMatch` objektidega:

- Esimeses MVP-s piisab soovitatud tegevusest `CREATE_HELP_REQUEST`.
- Otsene seos journey ja help-match vahel võib tulla hiljem.

`JourneyParty` ja `JourneyAction`:

- Ei ole MVP-s eraldi tabelitena vajalikud.
- MVP-s piisab JSON-väljadest `suggestedActions`, `suggestedParties` või `context`.
- Normaliseerida hiljem, kui on teada, milliseid tegevusi päriselt kasutatakse.

`riskSignals` ja `missingInfo`:

- MVP-s JSON väljad.
- Eraldi tabelid oleksid liiga varane optimeerimine.
- Kui neist saavad töövoo staatuseid ja vastutajaid kandvad objektid, saab need hiljem välja tõsta.

## 10. Esimene arendusplokk, kui arenduseks antakse hiljem luba

Eesmärk:

Luua kõige väiksem töötav teekonnakeskne voog: kasutaja kirjeldab olukorda privaatses vestluses, süsteem koostab teekonnakaardi mustandi, kasutaja kinnitab/salvestab selle ja saab avada olemasoleva teenusekaardi või eelpöördumise.

Piirid:

- Ainult pöörduja rolli esmane kogemus.
- Journey on alguses privaatne.
- Ei ehita uut ruumisüsteemi.
- Ei ehita teenusekaarti ümber.
- Ei loo täis `JourneyParty` / `JourneyAction` alammudelit.
- Ei muuda subscription loogikat.

Mida muuta:

- lisada minimaalne journey mudel;
- lisada journey API lugemiseks/salvestamiseks;
- lisada chat teekonnasõela väljund;
- lisada lihtne teekonnakaardi UI;
- lisada avamine teenusekaarti eelfiltriga;
- lisada avamine eelpöördumisse eel täidetud kontekstiga.

Mida mitte muuta:

- room call, invite ja recording loogika;
- RAG/source attribution tuum;
- privacy-check tuum;
- pre-inquiry põhistaatused;
- service map sync loogika.

Tõenäoliselt puudutatavad failid/moodulid:

- `prisma/schema.prisma`
- uus `lib/journey/**`
- uus `app/api/journeys/**`
- `app/api/chat/**`
- `lib/chat/**`
- `app/vestlus/page.js`
- `components/alalehed/ChatBody.jsx`
- `components/workspace/WorkspaceFeaturePage.jsx`
- `lib/preInquiries.js`
- `app/api/pre-inquiries/**`
- `app/api/service-map/**`

Vastuvõtukriteeriumid:

- kasutaja saab chatis olukorra kirjelduse põhjal teekonnakaardi mustandi;
- teekonnakaart ei salvestu enne kasutaja kinnitust;
- salvestatud teekond on privaatne ja seotud kasutajaga;
- teekonnalt saab avada teenusekaardi olemasoleva UI kaudu;
- teekonnalt saab alustada olemasolevat eelpöördumise voogu;
- privaatset vestlust ei jagata vastuvõtjale;
- olemasolevad pre-inquiry, service map, room, privacy ja source attribution testid ei tohi regressiooniga kukkuda.

## 11. Kriitilised riskid

| Risk | Seos Run 1/Run 2 järeldusega | Tõsidus | Maandamise soovitus |
|---|---|---|---|
| Journey muutub liiga suureks "kõike teadvaks" objektiks | Run 2 punktid 1-4 ja 20 kinnitasid keskse kihi vajadust | Kõrge | Hoida MVP `Journey` õhukesena, kasutada JSON contexti ja seoseid ainult vajadusel |
| PreInquiry dubleeritakse uue intake/journey töövooga | Run 1 ja Run 2 leidsid tugeva pre-inquiry baasi | Kõrge | Journey peab avama olemasoleva pre-inquiry voo, mitte looma paralleelset pöördumist |
| Room süsteemi hakatakse liiga vara ümber tegema | Run 2 punkt 11 leidis roomi tugevana, kuid ilma origin metata | Keskmine | Esimeses etapis jätta room puutumata, lisada origin seos hiljem |
| Teenusekaart paisub enne journey väärtuse testimist | Run 2 punktid 6-7 leidsid accessPath puudused | Keskmine | MVP-s kasutada eelfiltrit, accessPath lisada hiljem |
| Teekonnasõel võib kasutajale tunduda ametliku hindamisena | `uus-plaan.md` rõhutab, et teekonnakaart ei ole hindamine | Kõrge | UI-s kasutada piiriteksti ja vältida sõna "hindas" |
| Paketiloogika tehakse enne tooteotsust | Run 2 punkt 17 jäi tehniliselt väikeseks, kuid tooteotsusena oluliseks | Keskmine | Hoida MVP alguses olemasoleva subscription reegli sees |
| Allikate/RAG vanade dokumentide põhjal tehakse vale järeldus | Kasutaja täpsustas, et vana `rag-architecture.md` ei ole usaldusväärne | Keskmine | Toetuda ainult aktiivsele koodile ja testidele, nagu Run 2 tegi |

## 12. Lõplik soovitus

1. Jah, edasi võib minna Journey MVP tehnilise spetsifikatsiooniga.

2. Enne seda ei ole vaja kogu `docs/uus-plaan.md` ümber kirjutada, kuid tuleb lukustada lühike MVP-scope dokument: millal journey salvestub, kus UI asub, millised väljad on MVP-s ja millised jäävad hilisemaks.

3. Run 2 põhjal võib alustada väikseima MVP planeerimist. Run 2 järeldused on Run 1-ga kooskõlas ja piisavalt põhjendatud.

4. Arendus peaks algama andmemudeli ja chat-sõela tehnilisest spetsifikatsioonist koos. Ainult UI prototüüp oleks liiga õhuke, sest keskne risk on andmete ja töövoogude seostamine. Ainult andmemudel ilma chat-väljundita ei testi kasutajaväärtust.

Lühike otsus: järgmine samm peaks olema väike Journey MVP spetsifikatsioon, mitte kohe arendus. Spetsifikatsioon peaks katma minimaalse `Journey` mudeli, chati `JourneyDraft` väljundi, salvestamise reegli ja kaks integratsiooni: teenusekaart ning eelpöördumine.

**Lõpukontroll**

- Koodifaile ei muudetud.
- Prisma skeemi ei muudetud.
- Migratsioone ei tehtud.
- Pakette ei installitud.
- Build/deploy käske ei käivitatud.
- Loodi ainult Run 3 Markdown-raport.
- Raport ei korda kogu Run 2 auditit.
- Raport annab strateegilise otsustustoe Journey MVP järgmise otsuse jaoks.
