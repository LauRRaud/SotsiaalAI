STATUS: ACTIVE INDEX

# Fable 5 teemade katvusekaart — mis on kaetud ja mis katmata

Uuendatud: 15.07.2026

## 0. Kuidas seda faili lugeda

See kaart näitab **analüüsi katvust**, mitte ainult rakenduskoodi olemasolu. „Kaetud” ei tähenda automaatselt, et funktsioon on valmis, parandatud, auditeeritud, merge'itud või deploy'itud.

Staatusemärgid:

- **KAETUD** — olemas on piiritletud süvaanalüüs või tervikvoo teadmistekaart koos tõendite ja jätkamispunktiga;
- **OSALISELT KAETUD** — olemas on sisuline käsitlus, kuid tervikvoog, tehniline plaan või UX-ring on lõpetamata;
- **TÖÖS** — eraldi ülesanne on alustatud ja väljundfail olemas, kuid staatus pole `COMPLETE`;
- **ÜLDISELT KAETUD** — teema esineb orientatsioonis või platvormiüleses analüüsis, kuid oma süvaanalüüsi pole;
- **KATMATA** — eraldi praeguse koodi vastu kontrollitud toote-/UX-/tehnilist tervikanalüüsi pole.

## 1. Kasutajale praegu lubatud põhifunktsioonid

| Teema | Analüüsi katvus | Peamine dokument | Rakenduse / töö tegelik jätkamispunkt |
|---|---|---|---|
| Platvormi tervikloogika, kolm põhirolli ja moodulite seosed | **KAETUD** | `fable-5-uue-akna-orientatsioon-ja-teadmistekaart.md`; `fable-5-platvormiloogika-ulevaade.md`; MAX-täiendus ja järelkontroll | Hoida ajakohasena pärast suuremaid merge'e; ei asenda moodulite süvaanalüüse |
| Platvormiülene usaldus, jagamise nähtavus ja AI/inimese vastutuse eristus | **KAETUD kontseptsioonina** | `fable-5-usaldusmudel.md` | Avalikud turvaväited vajavad jätkuvalt eraldi tõendamist |
| Vestlusaken ja RAG-vastused | **ÜLDISELT KAETUD** | orientatsioonikaart; platvormiloogika dokid; dokumentide tervikvoo RAG-leid | Vajab eraldi tänase vestlus-UX, allikakuvamise, kriisiraja, töövoogude käivitamise ja veaseisude süvaanalüüsi |
| Häälvestlus, STT ja TTS | **ÜLDISELT KAETUD** | `lokaalsed-mudelid-ja-multimodaalne-interaktiivsus.md`; orientatsioonikaart | STT/TTS töötab osadena, kuid tervikliku reaalajahäälvestluse toote-, privaatsus- ja UX-analüüs on tegemata |
| SotsiaalAI teadmusbaas, allikate värskus ja RAG-haldus | **OSALISELT KAETUD** | usaldusmudel; Kovisiooni praktika→RAG kontroll; dokumentide RAG-leid; U8-lite auditid | Vajab eraldi RAG-i edasiarendus- ja testimisprogrammi: allika lisamine/versioon/aegumine/eemaldamine, automaatne muutusekontroll, tenant- ja audience-eraldatus, päris ingest/update/delete/retry, retrieval'i kvaliteet, allikaviited, kõrge riskiga väidete värskus, rollback ja deploy-väravad |
| Teekond → eelpöördumine → adressaat → eelvaade → saatmine → jätkamine | **KAETUD** | `fable-5-teekond-eelpoordumine-ux-ja-navigeerimine.md` | Analüüs tõendas P0/P1 jagamisleppe ja kerimise probleeme; parandused pole selle dokumendi põhjal veel teostatud |
| Pöördumiste vastuvõtja töölaud ja hilisem menetluseelne koostöö | **OSALISELT KAETUD** | Teekonna/eelpöördumise analüüs; U3/U4/U10 auditid | Autorivaade on põhjalikumalt kaetud kui vastuvõtja igapäevane töövoog; vajab eraldi receiver-workbench UX-ringi |
| Abisoovid + abipakkumised + sobitus + ühine ruum | **KAETUD** | `fable-5-teenusekaart-profiil-ja-abivahendus-tervikvoog.md` | Tuum runtime-tõendatud; V1/V2 mustandite ja mitteavalike kirjete leke on blokeeriv; lisaks vajab tooteotsust match-nõusolek ja eraldi väärkasutuse/modereerimise mudel |
| Teenusekaart + KOV-kontaktid + markerid + detailvaade | **KAETUD** | sama Teenusekaardi tervikvoo fail | V5 katkine in-app pöördumise lüli ja V6 puuduva marker-CSS-i integratsioon; loendivaade/klasterdamine hilisemad paketid |
| Teenuseprofiil + avaldamine + kättesaadavus | **KAETUD** | sama Teenusekaardi tervikvoo fail | V3 liit-ID lõhub teeninduskohaga osutaja INTERNAL-pöördumise; avalik detailleht ja usaldusmärgistus on tooteotsused |
| Vestlusruumid ja osalejakutsed | **OSALISELT KAETUD** | orientatsioonikaart; U10; rollipõhise osalejakutse haru ja varasemad ruumiauditid | Vajab eraldi professionaal↔pöörduja ja professionaal↔professionaal tervikvoo UX-/õigusteanalüüsi; „tugiisiku rada” on aegunud tõlgendus |
| Ruumi helikõne, nõusolek, salvestamine ja transkript | **ÜLDISELT KAETUD** | orientatsioonikaart; dokumentide heli-/transkriptivoog | Vajab eraldi kõne elutsükli ja nõusoleku süvaanalüüsi; vältida automaatset salvestamist/kokkuvõtet |
| Dokumendi koostamine | **KAETUD** | `lisafunktsioonid/fable-5-dokumendid-analuus-ja-syvauuring-tervikvoog.md`; `ruumilised-lehe-faasid.md` | Tervikvoog kaardistatud; järgmine töö on leitud P1-de lahendamine ja hilisem UX-prototüüp |
| Dokumendid: üleslaadimine, säilitamine, leidmine, kustutamine | **KAETUD** | sama dokumentide tervikvoo fail | Parandada elutsükli ja leitavuse katkestused teostusjärjekorra järgi |
| Dokumendianalüüs ja ametliku kirja selgitamine | **KAETUD** | sama dokumentide tervikvoo fail | Analüüs on praegu efemeerne vestluskontekst; tooteotsus vajab püsiva objekti ja hilisema leidmise kohta |
| Helifail → transkript → inimese ülevaatus | **KAETUD** | sama dokumentide tervikvoo fail | Tervikvoog ja piirid dokumenteeritud; parandused eraldi paketina |
| Süvauuring | **KAETUD** | sama dokumentide tervikvoo fail | P1/P0-kandidaat: võimalik RAG cross-tenant lekkevektor vajab sõltumatut kinnitamist ja parandust enne usaldamist |
| Teemaseeme → Kovisiooni etapid 1–8 | **KAETUD** | `fable-5-kovisiooni-tervikvoo-teadmistekaart.md` | Tehniline rada töötab; ettevalmistusraja tupik ja ruumiline esitlus vajavad teostust |
| Lõpetatud juhtumid, järeltegevus ja jätkuseeme | **KAETUD** | sama Kovisiooni teadmistekaart | Analüüs ja runtime-kontroll tehtud; kujundus kuulub KOV-R paketti |
| Parimad praktikad, retsensioon, avaldamine ja RAG-sünk | **KAETUD** | sama Kovisiooni teadmistekaart | Võtmeta keskkonnas kontrolliti `skipped` haru; päris RAG-ingest vajab võtmega keskkonna tõendit |
| Kovisiooni metoodika | **KAETUD** | sama fail, `KOV-Q1` | 12 invarianti ja digitaalse liidese piirid fikseeritud |
| Kovisiooni ruumiline tervikmudel | **KAETUD analüüsina** | sama fail, `KOV-Q2` ja `KOV-R`; `fable-pildid/kovisioon-tervikvoog/` | Järgmine aste on piiritletud interaktiivne prototüüp ja tooteotsused, mitte uus audit |
| Tööheaolu tervikloogika ja kümme tööriista | **KAETUD** | `fable-5-tooheaolu-tervikloogika-ja-jatkuteed.md` | TO-1…TO-10 otsustusleht on puudu; E1–E6 pole alustatud |
| Tööheaolu E0 veaparandused | **KAETUD ja koodina valmis harul** | `fable-5-tooheaolu-e0-progress.md`; koondseis | `fable/tooheaolu-e0` vajab sõltumatut järelkontrolli; pole merge'itud/deploy'itud |
| Materjalide esitamine → ülevaatus → teadmusbaas → automaatne värskuskontroll | **ÜLDISELT KAETUD** | orientatsioonikaart; praktika/RAG ning dokumentide RAG leiud; KOV source-monitori ja contact-registry kandidaadimustrid | Vajab oma tervikvoo analüüsi: esitaja, retsensent, versioonid, nõusolek, eemaldamine, ingest, tagasiside ning ametlike veebiallikate/kontaktide ajastatud `check → candidate → review/apply → reingest` |
| Töölaud, „Jätka siit”, teavitused ja badge'id | **OSALISELT KAETUD** | Opuse U1/U2 kaardistus/audit; orientatsioonikaart | Tehniline vertikaal on olemas, kuid rollipõhine igapäevane UX ja prioriseerimise loogika vajab eraldi Fable’i süvaanalüüsi |
| „Minu jagamised” ja tagasivõtmine | **OSALISELT KAETUD** | U12 arendus- ja auditid; usaldusmudel | Tehniline pakett on olemas; terviklik kasutaja-UX, aegumine ja kõigi jagamistüüpide ühine keel vajab eraldi ringi |
| Isiklik otsing | **OSALISELT KAETUD** | U6 pakett ja Opuse/Soli auditid | Tehniliselt käsitletud; platvormiülese otsingu infostruktuur ja sihtpinnad on otsustamata |
| Selge keele režiim | **OSALISELT KAETUD** | U7 pakett ja Opuse audit | Tehniline moodul olemas harul; päris mudeliväljundite eval ning laiem kasutuspiir vajab otsust |
| Profiil, rollid ja rollivahetus lehtedel | **KATMATA** | ainult orientatsioon ja töölaua olemasolev rollivalik | Vajab eraldi lehekaarti: kus roll muudab sisu/õigusi, kus rollivahetaja peab nähtav olema ja kus see oleks ohtlik või eksitav |
| Tööalase kasutuse raamistik / raamleping | **OSALISELT KAETUD tehnilise vertikaalina** | `/tooalase-kasutuse-raamistik`; `FrameworkAcceptance`; töötaja GET/POST API; registreerimise kinnitus; kirjutuskaitstud dokumendikirje; „Minu jagamised”; admini auditivaade ja analüütika | Vajab eraldi õigusliku tähenduse, sõnastuse, rollisobivuse, versiooniuuenduse/taaskinnituse, tõendijälje, allalaadimise, säilitamise, kustutamise ja UX-i tervikanalüüsi. ASiC allalaadimine ja platvormi klõps-kinnitus ei tohi kasutajale näida sama toiminguna |
| Kasutusjuhend ja abikiht | **OSALISELT KAETUD** | `prototyybid/kasutusjuhend-lugemispaneel-demo.html`; üldine orientatsioon | Prototüüp olemas, kuid päris sisu, rollipõhine juhend, otsing ja rakendusse ühendamine on katmata |
| Admini analüütika, haldus- ja koondvaated | **KATMATA süvaanalüüsina** | üksikud auditid ja orientatsioon | Kõrge prioriteet: kasutaja sõnul puudub terviklik kujundus ja funktsionaalsus; vajab eraldi andme-, õiguste-, privaatsus- ja UX-teemat |
| Tellimus, paketid, kasutuspiirid ja hinnastus | **ÜLDISELT KAETUD tehniliselt** | varasemad P0/P1 paketikaardistused; hinnastuse lehed | Fable’i toote- ja kasutaja-UX tervikanalüüs puudub |

### 1.1. Route’i-põhine lehekatvus

Allolev tabel täiendab moodulikaarti nende lehtedega, mis ei moodusta eraldi suurt töövoogu, kuid vajavad siiski sisu-, UX-, õiguste- või õiguslikku kontrolli.

| Route või lehegrupp | Katvus | Vajalik jätk |
|---|---|---|
| `/`, `/meist`, `/autorilt`, `/voimalused` | **KATMATA ühe avaliku tervikuna** | Kontrollida avalehe ja infoväljade lubaduste vastavust aktiivsele tootele, dubleerimist (`/meist` vs avalehe sektsioon), navigeerimist, CTA-sid, SEO-d ja ET/EN/RU pariteeti |
| `/privaatsustingimused` | **TEADLIKULT EDASI LÜKATUD** | Lõplik vastavusanalüüs ja tekst tehakse pärast põhiliste andmevoogude stabiliseerimist; seni ei tohi praegust teksti käsitleda lõplikult kontrollituna |
| `/kasutustingimused` | **TEADLIKULT EDASI LÜKATUD** | Lõplik rollide, AI-vastutuse, tellimuste ja teenusepiiride tekst tehakse pärast toote funktsionaalsuse ja ärimudeli stabiliseerimist |
| `/kasutusjuhend` | **TEADLIKULT EDASI LÜKATUD; prototüüp olemas** | Lugemispaneeli prototüüp säilib, kuid päris juhendi sisu ja route'ide inventuur tehakse pärast navigatsiooni, rollivahetuse ja põhivoogude ümberkujundamist |
| `/tooalase-kasutuse-raamistik` | **OSALISELT KAETUD tehnilise vertikaalina** | Vt raamlepingu rida eespool; vaja eraldi õiguslikku ja UX-i elutsüklit |
| `/hinnastus`, `/tellimus` | **KATMATA kasutajateekonnana** | Paketi valik, prooviperiood, maksemandaat, olekumuutused, ebaõnnestunud makse, õiguste jõustumine, tühistamine, hinnalubadused ja kasutuslimiidid |
| `/registreerimine` + NextAuth sisselogimine | **KATMATA tervikvoona** | Aktiveerimiskood, roll, tööalase raamistiku lävi, e-post, salasõna/PIN, nõusolekud, vead, katkestamine, jätkamine ja esimene maandumine rollide kaupa |
| `/taasta-parool`, `/taasta-parool/[token]`, `/uuenda-epost`, `/uuenda-pin` | **KATMATA** | Konto taastamise ja tundlike kontoandmete muutmise turva-, aegumis-, teavitus-, brute-force- ja UX-kontroll |
| `/profiil` | **KATMATA süvaanalüüsina** | Rollivaade, tegelikud õigused, keel/ligipääsetavus, kontoandmed, tellimus, jagamised, kustutamine ning rollivahetaja asukoht |
| `/join` | **KATMATA tervikvoona** | Kutse token, aegumine, vale konto/roll, autentimata kasutaja, ruumi eelvaade, nõusolek, liitumine, keeldumine ja tagasitee |
| `/rooms`, `/ruum`, `/room/[roomId]` | **OSALISELT KAETUD** | Tehnilisi auditeid on, kuid kolme ruumiparadigma, rollipõhise kutse, kõne, kokkuvõtte, lahkumise ja professionaalse koostöö ühine UX-ring puudub |
| `/documents`, `/documents/artifacts/[id]`, `/dokreziim` | **KAETUD tervikvoona** | Dokumentide teadmistekaardi leiud ja parandused; ruumiline esitus eraldi prototüübi järel |
| `/admin/analytics` | **KATMATA tervikuna** | Kõrge prioriteediga admini analüütika teema: mõõdikute tähendus, privaatsus, minimaalsed grupid, drill-down, eksport, veaseisud ja kujundus |
| `/admin/rag` ja kuus `/admin/rag/*` alamlehte | **OSALISELT KAETUD tehniliste audititega** | Vajab üheks RAG-operatsioonikeskuseks koondatud UX-i ja õiguste analüüsi: dokumendid, ingest, KOV, organisatsioonid, tagasiside, allikapaketid, järjekorrad ja deploy-väravad |
| `/admin/framework-acceptances` | **OSALISELT KAETUD tehniliselt** | Siduda raamlepingu eraldi analüüsi ja admini analüütika teemaga |
| `/admin/service-availability` | **OSALISELT KAETUD U4 kaudu** | Admini igapäevase töö, aegunud kirjete järjekorra, tõendite ja paranduste UX pole eraldi kaetud |
| `/admin/wellbeing` | **OSALISELT KAETUD Tööheaolu analüüsis** | K-anonüümse koondi admini/pilootvaataja UX ja kuritarvituse kaitsed vajavad eraldi kinnitamist |
| `/logo-eksport` | **KATMATA / OTSUS VAJALIK** | Kontrollida, kas see on sisemine kujundus-/eksporditööriist; kui jah, eemaldada avalikust tootmisroute'ide pinnast või kaitsta sobiva õigusega |

Kokkuvõte: funktsionaalsete põhimoodulite route'id on enamasti vähemalt osaliselt kaetud, kuid avalikud õigus- ja infopinnad, konto elutsükkel ning admini tööpinnad vajavad veel omaette analüüse.

## 2. Tuleviku- ja lisafunktsioonid

| Teema | Katvus | Mis on olemas | Mis on puudu |
|---|---|---|---|
| Supervisioon | **OSALISELT KAETUD** | Q1 tootemudel ja ruumiline teekond `COMPLETE`; Q2 andmemudel, õigused, API ja purge kirjutatud | Q2 mustrite kontroll, eeskambri UI, U1/U2, migratsioonijärjekord, testiplaan ja teostuspaketid on `NOT_STARTED` |
| Mentorlus ja ESTA mentorite viitamine | **OSALISELT KAETUD** | ESTA tegelik roll ja `EXTERNAL_REFERENCE` piir supervisiooni dokis | Eraldi mentorluse kasutajateekond, kvaliteedipiir, kataloog ja kontaktivõtt puuduvad |
| Organisatsiooni- ja meeskonnakiht | **ÜLDISELT KAETUD kontseptsioonina** | `fable-5-lisavastused-organisatsioon-ja-piloot.md`; ideed | Pole aktiivse koodi vastu V0 tervikplaani, õiguste mudelit ega kasutajaliidese analüüsi |
| Esimene KOV-piloot ja ESTA tutvustuspäev | **ÜLDISELT KAETUD kontseptsioonina** | piloodi soovitus ja ulatus dokumenteeritud | Partner, ajakava, mõõdikud, andmekaitse ja operatiivne valmisolek kinnitamata |
| Juhtumitöö assistent ja STAR2 kõrval töötav elutsükkel | **ÜLDISELT KAETUD kontseptsioonina** | `docs/ideed.md`, orientatsioon, STAR_HELPER dokument | Vaja eraldi mittedubleerimise, käsitsi ülekande, staatuste ja partner-KOV õigusliku piiri analüüsi |
| Meetodipeegel | **KATMATA süvaanalüüsina** | idee ja privaatsuspõhimõte | Metoodika, sisendid/väljundid, AI piir, UX ja seosed Kovisiooni/Tööheaoluga kaardistamata |
| Võrgustikutöö ja professionaalide koostöö | **KATMATA süvaanalüüsina** | idee; ruumid ja osalejakutse on tehnilised eeltingimused | Võrgustikukaart, nõusolekud, jagamispiirid, rollid, kokkulepped ja elutsükkel puuduvad |
| Kolleegile töö üleandmine (U11) | **OSALISELT KAETUD** | varasem hetkeseisu audit ja sõltuvuste märkus | Tooteotsus, ruumiligipääs, vastutuse üleminek, auditijälg ja UX-plaan puuduvad |
| Teenusepuudujäägi märge ja anonüümne koond (U5) | **OSALISELT KAETUD** | idee ning varasem hetkeseisu audit | k-lävi, nähtavus, tooteotsus, kasutaja tagasiside ja teostusplaan puuduvad |
| Organisatsiooni/juhi analüütika ja valdkondlik baromeeter | **KATMATA** | ideed ning Tööheaolu k-anonüümse koondi etalon | Mõõdikute tähendus, kuritarvituse kaitsed, min-grupp, rollid, UI ja piloot puuduvad |
| Genogramm, ökokaart ja juhtumi visuaalsed töövahendid | **KATMATA** | üksikud ideemärked | Meetod, andmemudel, privaatsus, eksport ja koostöövoog puuduvad |
| Kohtumise ühisvaade | **KATMATA süvaanalüüsina** | idee; ruum ja U10 kokkuvõte eeltingimustena olemas | Reaalaja tööpind, rollid, nõusolek, märkmed ja järelväljundid kaardistamata |
| Lokaalsed mudelid, kaamera, žestid, OCR ja multimodaalsus | **ÜLDISELT KAETUD kontseptsioonina** | `lokaalsed-mudelid-ja-multimodaalne-interaktiivsus.md` | Prioriteet, seadmetugi, privaatsus, jõudlus, fallback'id ja esimene V0 valimata |
| Avalik usalduse/turvalisuse leht | **OSALISELT KAETUD** | sõnastuspõhimõtted usaldusmudelis | Aktiivsete väidete tõendamine, õiguslik kontroll, kujundus ja avaldamine puuduvad |

## 3. Platvormiülene kujundus ja navigatsioon

| Teema | Katvus | Jätkamispunkt |
|---|---|---|
| Ruumilised lehefaasid, flight ja ühe ekraani tööpind | **KAETUD teooria/prototüübina** | `ruumilised-lehe-faasid.md`; prototüübid. Vajab kasutajatesti ja üht päris-lehe pilooti |
| Alumine dokk, faasiriba ja võrdlusriiul | **KAETUD kontseptsioonina** | `fable-q-dokk-riiul-proto.html`; enne päris koodi otsustada doki kohalolu ja ajalookäitumine |
| Kerimise kasutuspiir | **KAETUD põhimõttena** | tööfaas ei ole pikk leherull; pikk lugemissisu võib kerida oma konteineris |
| Ühine visuaalne süsteem paneelidele, klaaspindadele, menüüdele ja markeritele | **OSALISELT KAETUD** | üksikud prototüübid ja kuvatõendid | Vajab platvormiülest UI-inventuuri ja disainitokenite/komponentide otsust |
| Rollivahetaja nähtavus ja asukoht | **KATMATA** | kasutaja soov: vajadusel paremas alanurgas rollitundlikel lehtedel | Enne taastamist tuleb kaardistada kõik lehed, rollimõju ja serveri tegelikud õigused |
| Mobiil, 200% tekst, klaviatuur, reduced-motion | **OSALISELT KAETUD põhimõttena** | analüüsid sisaldavad reegleid | Vajab päris referentslehtede süsteemset ligipääsetavuse kontrolli |

## 4. Läbivad platvormiteemad, mis ei ole üks eraldi leht

| Läbiv teema | Katvus | Mis vajab veel terviklikku käsitlust |
|---|---|---|
| Privaatsus, GDPR, säilitustähtajad ja konto kustutamine | **OSALISELT KAETUD** | Jagamise, auditijälje, RAG-koopiate, kinnitatud väljundite, varukoopiate ja konto kustutamise üks ühine andmete elutsükli kaart |
| Rakendusturvalisus ja ohumudel | **OSALISELT KAETUD auditite kaudu** | Platvormiülene threat model: autentimine, IDOR, rollitõus, rate-limit, failid, prompt injection, SSRF, webhook'id, saladused ja kuritarvituse käsitlus |
| Operatiivne valmisolek | **OSALISELT KAETUD** | Keskkonnamuutujate register, migratsioonijärjekord, backup/restore, health-check'id, teenuste sõltuvused, deploy/rollback ja intsidendijuhis |
| Monitooring ja auditijälg | **OSALISELT KAETUD** | Ühine sündmuste, veakoodide, RAG-i jääkide, scheduler'ite, e-kirjade, privaatsustoimingute ja turvaintsidentide vaatlusmudel |
| Jõudlus, skaleerimine ja kulud | **ÜLDISELT KAETUD** | RAG-i latency/kulu, suure kasutajaajaloo otsing, kaart/klastrid, failid, scheduler'id, websocket/kõne ning päris koormustestid |
| Ligipääsetavus, seadmed ja ET/EN/RU pariteet | **OSALISELT KAETUD põhimõttena** | Süsteemne WCAG-kontroll referentslehtedel, 200% tekst, klaviatuur, puude-/mobiilivaade, reduced-motion, ekraanilugeja ja kõigi keelte sisuline kvaliteet |
| Andmete eksport, teisaldatavus ja koostalitlus | **KATMATA tervikuna** | Kasutaja enda andmete eksport, jagatud väljundite tõend, STAR2 käsitsi/API üleandmine, standardvormingud ja kustutamisjärgne portatiivsus |
| Avalik info, onboarding ja kasutajatugi | **OSALISELT KAETUD** | Võimaluste lehe lubaduste tõendamine, rollipõhine esmakasutus, kasutusjuhend, veateated, tugikanal ja aus turvalisusleht |
| Eval'id, piloodimõõdikud ja kvaliteediväravad | **OSALISELT KAETUD** | RAG/AI vastuste eval-komplekt, ülesandepõhised UX-mõõdikud, piloodi edukriteeriumid, regressiooniläved ja keelatud töötajaseire piir |
| Andmeomanik, nõusolek ja välispartnerid | **OSALISELT KAETUD kontseptsioonina** | KOV-i, ESTA/ESCÜ, teenuseosutaja ja kasutaja vastutuse piir; volitused, partnerlepingud, andmetöötleja rollid ja välise allika kasutusõigus |

## 5. Kõige olulisemad katmata eraldiseisvad Fable’i teemad

Soovitatud järjekord pärast praegu töös oleva Teenusekaardi teema lõppu:

1. **Admini analüütika ja koondvaated** — kasutaja jaoks oluline, kuid sisuliselt kujundamata ja tervikuna kontrollimata.
2. **Vestlusaken + RAG + häälvestlus** — platvormi keskne pind, mille tänase UX-i ja eri töövoogudesse hargnemise oma süvaanalüüs puudub.
3. **Vestlusruumide ja professionaalse koostöö tervikvoog** — osalejakutse, rollid, nõusolek, kõne, kokkuvõte ja lahkumine üheks mudeliks.
4. **RAG-i edasiarendus, materjalide elutsükkel ja automaatne allikavärskendus** — esitatud materjal → ülevaatus → versioon → RAG → eemaldamine ning ametlik veebiallikas/KOV-kontakt/teenuseinfo → ajastatud kontroll → muutuse kandidaat → riskipõhine kinnitus → uus aktiivne RAG-versioon. RAG ei tohi olla kontaktide algne tõeallikas; Teenusekaart ja RAG peavad lugema sama kinnitatud struktuurset kontaktikirjet. Töö peab sisaldama päris RAG-teenuse ja andmebaasiga kontrollitavat eval-/regressioonipaketti, mitte ainult lähtekooditeste.
5. **Profiil, rollivahetus ja rollitundlike lehtede kaart** — millistel lehtedel roll muudab sisu, tegevusi või õigusi ning kus peab vahetaja nähtav olema.
6. **Meetodipeegel** — seni idee, kuid loogiline järgmine professionaalne privaatmoodul pärast Kovisiooni, Tööheaolu ja Supervisiooni.
7. **Võrgustikutöö** — professionaalide koostöö, nõusolekud, võrgustikukaart ja eesmärgipõhine jagamine.
8. **Juhtumitöö assistent + STAR2 käsitsi üleandmine** — oluline tulevikurada, kuid sõltub õigusliku staatuse ja partner-KOV otsustest.

## 6. Pooleliolevad tööd, mida mitte uue teemana nullist korrata

| Töö | Seis | Õige jätkamine |
|---|---|---|
| Teenusekaart/profiil/abivahendus | `COMPLETE` | Mitte korrata auditit; sulgeda esmalt V1–V3 turva-/ühenduspakett, seejärel V4–V7 ja kujundus |
| Supervisiooni Q2 tehniline plaan | `IN_PROGRESS` | Jätkata Q2.1, Q2.6–Q2.12 olemasolevas supervisiooni failis |
| Tööheaolu TO-1…TO-10 otsustusleht | Pole loodud | Vajadusel eraldi lühike otsustusülesanne; mitte korrata tervikanalüüsi |
| Tööheaolu E0 sõltumatu järelkontroll | Tegemata | Auditeerida külmutatud haru; mitte lasta E0 autoril ise heaks kiita |
| Teekonna jagamisleppe P0/P1 parandused | Analüüs valmis, kood tegemata | Teostada ptk 13.5–13.8 järgi eraldi harul |
| Dokumentide RAG cross-tenant leid | Analüüs valmis, runtime-kinnitus/parandus tegemata | Prioriteetne sõltumatu turvakontroll enne uut dokumendi-UX tööd |

### RAG ja abivahendus on seotud, kuid mitte sama teema

- **RAG-i põhiteema** on teadmusallikate usaldusväärne elutsükkel ja vastuste tõendatav kvaliteet. Selle testid peavad katma ingest'i, uuendamise, vana versiooni eemaldamise, retry/rollback'i, ristkasutaja eraldatuse, audience-filtri, aegunud kõrge riskiga allika blokeerimise ning ET/EN/RU vastuste allikapõhisuse.
- **Abisoovid ja abipakkumised** on kasutaja tootevoog: loomine, avaldamine, nähtavus, sobitamine, tagasivõtmine, aegumine ja ühise ruumi avamine. See on praegu Teenusekaardi tervikvoo analüüsi kõrvalharu ning seda ei anta enne olemasoleva faili lõpetamist teisele Fable'ile dubleerivaks ülesandeks.
- Seos tekib alles otsingus ja soovitamises: RAG võib aidata ametlikku teenuseinfot selgitada, kuid abisoovide/-pakkumiste omanikusisu ja sobitusloogika ei tohi muutuda vabalt otsitavaks üldiseks teadmusallikaks.

## 7. Uue Fable konto valimise reegel

Enne uue ülesande andmist kontrolli seda faili:

- `KAETUD` teemat ei anta uuesti üldiseks auditiks; küsitakse üks konkreetne jätkuküsimus või teostuspakett;
- `TÖÖS` teemale ei avata paralleelset teist analüüsi;
- `OSALISELT KAETUD` teema jätkub olemasoleva faili täpsest jätkamispunktist;
- `TEADLIKULT EDASI LÜKATUD` teemat ei anta uuele Fable'ile enne, kui selle eeltingimused on stabiliseerunud;
- värskele 100% kontole sobib üks §5 eraldiseisev katmata teema;
- väljundfail luuakse ülesande alguses ja seda täidetakse peatükkhaaval, et limiidi lõpp ei kaotaks tulemust.

## 8. Järgmine uuendus

Uuenda seda kaarti kohe, kui:

1. Teenusekaardi analüüs saab `STATUS: COMPLETE`;
2. Supervisiooni Q2 lõpetatakse;
3. mõni katmata teema saab oma väljundfaili;
4. analüüsist tuletatud parandus merge'itakse või deploy'itakse — siis muutub rakenduse seis, mitte ainult analüüsi katvus.
