# SotsiaalAI SOL-süvaaudit — jätk: Teenusekaart

**Auditi seis:** Teenusekaardi otsingu-, detaili-, kaardi-, adressaadi- ja avaldamisradade staatiline süvaaudit `DONE`; runtime `NOT_PROVEN`; `runtime: not_run`.

**Fikseeritud audit-commit:** `f72c2f468bffdb3befe4e9c7c05c3ebc04d350a5`

**Audit-worktree:** `C:\Users\rauds\Desktop\SotsiaalAI-sol-audit-svc-f72c2f4` (detached HEAD). Liikuvat põhi-worktree'd ega teise akna commit'imata parandusi ei kasutatud tõendina.

## Katvustabel enne leide

| Pind | Seis | Kontrollitud ulatus |
|---|---|---|
| Leht ja sisenemisteed | DONE | `/teenusekaart`, Töölaud, URL-i algfiltrid, eelpöördumise tagasilink ja valitud kirje süvalink |
| Otsing, piirkond, tüübid ja tulemused | DONE | kliendi filtreerimine, serverifiltrid, mahupiirid, tellimine, kärbe ja paginatsioon |
| Kaart ja detail | DONE | Leaflet laadimine, markerid, sama koordinaadi grupid, popup, teenused, ligipääsutee ja välislingid |
| Kontakti alustamine | DONE | KOV/teenuseosutaja eelpöördumine, liit-ID → baas-ID, e-post, teenuse kontaktieelistused ja abikuulutuse sobitus |
| Avalik API ja õigused | DONE | anonüümne/autenditud/admini projektsioon, eelvaate lipud, peer-kuulutuste piir, limiter ja veavastus |
| Teenuseosutaja avalik projektsioon | DONE | profiil, teenused, teeninduskohad, nähtavus, kontaktid ja litsentsi/kättesaadavuse projektsioon; olemasolevad `SOL-SPROF` leiud jäid oma ID-de alla |
| KOV/RAG avaldamine ja geokodeerimine | DONE | KOV registri- ja RAG-sünk, teenuseosutaja RAG-sünk, upsert, geokodeerimise olekusiire ja allikast eemaldamine |
| Prisma ja migratsioonid | DONE | `ServiceMapEntry`, `ServiceProviderProfile`, teenuse-, asukoha- ja seosmudelid, `PreInquiry` FK ning vastavad migratsioonid |
| Päris runtime | NOT_PROVEN | autentitud brauser, päris PostgreSQL, välise geokooderi, RAG-i ja kahe kasutaja tervikvoog `not_run` |

## Auditeeritud failid ja funktsioonid

- `app/teenusekaart/page.jsx`; `components/workspace/WorkspaceFeaturePage.jsx`: `readInitialServiceMapFilters()`, `ServiceMapSurface()`, otsing, filtrid, tulemused, eelpöördumise ja abisobituse toimingud.
- `components/workspace/ServiceMapLeaflet.jsx`: `createPopupContent()`, `appendGroupedPopupContact()`, `createGroupedPopupContent()`, markerite rühmitamine, detailid ja kontaktitoimingud.
- `app/api/service-map/entries/route.js`, `address-suggestions/route.js`; `lib/serviceMap/entriesQueryPolicy.js`, `entryTypes.js`, `accessPath.js`, `geocoding.js`.
- `lib/serviceProviderProfiles.js`: `serializeServiceMapEntry()`, `listPublishedServiceMapEntries()` ja avaliku teenuseprofiili projektsioon; `lib/serviceProviderServiceLocations.js`: `locationServices()`, `serializeLocationEntry()`, `splitServiceLocationMapEntries()`.
- `lib/help/mapEntries.js`, teenusekaardi abikuulutuste projektsioon ning `app/api/help/matches/route.js`-ni ulatuv ühendamisrada.
- `lib/preInquiries.js`: `resolveRecipient()`, teenusekaardi adressaadi soovitused ja kanalivalik; `normalizeServiceMapRecipientEntryId()` ning selle test.
- `lib/serviceMap/ragServiceMapSync.js`, `kovContactSync.js`, `kovMunicipalitySync.js`; `scripts/sync-service-map-from-rag.mjs`, `sync-kov-service-map-entries.mjs`, `geocode-service-map-entries.mjs`.
- `prisma/schema.prisma`: `ServiceProviderProfile`, `ServiceProviderService`, `ServiceProviderLocation`, `ServiceProviderServiceLocation`, `ServiceMapEntry`, `PreInquiry`; migratsioonid `20260505203000_add_service_provider_profile_and_map_entries`, `20260522120000_add_service_provider_services`, `20260522124500_add_service_provider_locations`, `20260526103000_add_service_map_access_path` ja seotud help-map migratsioonid.
- Põhiauditi `SOL-PRE-03`–`04`, `SOL-PRE-12`, `SOL-PRE-18`, `SOL-SPROF-01`–`15`, `SOL-HELP-01`–`12` ja `SOL-SEARCH-05`–`06` ning nende `Seis`-lõigud; `parandusaudit.md` vastavad koondread.

## Leiud

### SOL-SMAP-01 — aadressi automaatne vaste avaldab ülevaatamata kaardikirje — P1

**Tõend.** KOV registri- ja RAG-mapperid loovad uued kontaktid seisus `NEEDS_REVIEW` (`lib/serviceMap/kovContactSync.js:114-137`; `lib/serviceMap/ragServiceMapSync.js:121-158`). Geokodeerimise `statusAfterGeocoding()` säilitab ainult `HIDDEN` ja `DRAFT` seisu, kuid iga `MATCHED` tulemuse korral tagastab `PUBLISHED`; batch kirjutab selle otse `ServiceMapEntry` reale (`lib/serviceMap/geocoding.js:898-916,924-1000`). Auditispetsiifiline fake-Prisma + fixture-geokooderi negatiivkontroll sisestas `NEEDS_REVIEW/PENDING` kirje ja sai kirjutuseks **`PUBLISHED/MATCHED`** ilma ühegi inimese või admini otsuseta. Olemasolevad geokooderi testid kontrollivad aadressivaste kvaliteeti, kuid mitte seda moderatsioonisiiret.

**Mõju.** RAG-ist või registrist ekslikult eraldatud nimi, telefon, e-post või aadress võib muutuda avalikuks ainuüksi seetõttu, et aadress leidis tehnilise vaste. Aadressi õigsus ei tõenda kontakti ajakohasust, rolli ega avaldamisluba.

**Vastuvõtukriteerium.** Geokodeerimine tohib muuta ainult geokodeerimisvälju; `NEEDS_REVIEW → PUBLISHED` peab olema eraldi autentitud adminitoiming koos actor'i, põhjuse, revision/CAS-i ja püsiva auditiga. Negatiivtest peab geokodeerima `DRAFT`, `NEEDS_REVIEW`, `PUBLISHED` ja `HIDDEN` kirjed nii MATCHED/AMBIGUOUS/FAILED tulemusega ning tõendama, et tehniline töö ei tõsta ühegi ülevaatamata kirje avaldamisse.

**Seis.** NOT_DONE; runtime: not_run.

### SOL-SMAP-02 — allikast kadunud RAG- ja KOV-kontaktid jäävad Teenusekaardile avalikuks — P1

**Tõend.** Mõlemad RAG-sünkroniseerijad loevad parajasti olemasolevad kontaktid/dokumendid ja teevad neile ainult `findUnique + upsert` (`lib/serviceMap/ragServiceMapSync.js:259-292,298-379,382-410`). Sama kuju kasutab failipõhine KOV-sünk (`lib/serviceMap/kovContactSync.js:243-283`). Üheski neist pole allikageneratsiooni, puuduvate `sourceDocId`/ID-de võrdlust, tombstone'i, `HIDDEN`-siiret ega kustutust. Negatiivkontroll andis teenuseosutaja RAG-kliendile eduka tühja dokumendiloendi olukorras, kus lokaalne stale-rida oli `PUBLISHED`: tulemus oli `upserted=0`, **0 mutatsiooni** ja stale-rida jäi `PUBLISHED`.

**Mõju.** Ametlikust allikast eemaldatud või asendatud kontakt võib jääda tähtajatult otsitavaks ning saada tundliku eelpöördumise. Kasutaja ei saa eristada aktiivset kontakti ajaloolisest kaardikoopiast; korduv edukas sünk ei paranda lahknemist.

**Vastuvõtukriteerium.** Edukas terviklik sünk vajab allikanimeruumi ja generatsiooni: nähtud ID-d märgitakse, varasema täieliku generatsiooni puuduvad read lähevad auditeeritud `HIDDEN`/tombstone seisu. Osalise või nurjunud allikapäringu korral ei tohi massiliselt peita. Testida A+B → järgmine täielik sünk ainult B, ajutine RAG-viga, tühi autoriteetne allikas, ID muutus ja retry; A peab kaduma avalikust vastusest ainult tõendatud täieliku sünkroniseerimise järel.

**Seis.** NOT_DONE; runtime: not_run.

### SOL-SMAP-03 — kaart pakub keelatud teenusele e-posti ja pöördumise toimingut — P1

**Tõend.** Avalik projektsioon kannab teenuse `directContactAllowed`, `acceptsPlatformPreInquiries` ja `acceptsEmailPreInquiries` väärtused korrektselt kaasa (`lib/serviceProviderProfiles.js:1378-1392`). Asukohakirje kontakt valitakse siiski esimese teenuse e-posti/telefoni järgi ilma neid välju kontrollimata (`lib/serviceProviderServiceLocations.js:10-17,34-55`). Popup kuvab e-posti ja loob `mailto:` lingi pelga `entry.email` olemasolul ning lisab „Alusta pöördumist” nupu alati, kui callback on komponendile antud (`components/workspace/ServiceMapLeaflet.jsx:488-539`). Eelpöördumisse viiakse ainult baas-`ServiceMapEntry` ID; `resolveRecipient()` otsustab kanali profiili taseme lubade järgi ega tea valitud teenust (`components/workspace/WorkspaceFeaturePage.jsx:3280-3284`; `lib/preInquiries.js:481-563`). Negatiivkontrollis jäid teenusel `directContactAllowed=false`, `acceptsPlatformPreInquiries=false` ja `acceptsEmailPreInquiries=false`, kuid asukohakirje avalik e-post oli endiselt **`blocked@example.test`**, mida popup kasutab kirjutamislingina.

**Mõju.** Teenuseosutaja selge kanalipiir võib kaardil muutuda vastupidiseks lubaduseks. Kasutaja võib saata tundlikku infot aadressile või alustada platvormipöördumist teenuse kohta, mis neid kanaleid vastu ei võta; mitme teenusega profiili üldluba võib varjata konkreetse teenuse keeldu.

**Vastuvõtukriteerium.** Kaardi toimingud peavad tulema ühest serveripoolsest teenuse+asukoha kontaktipoliitika projektsioonist. Keelatud e-post ei tohi jõuda `mailto:`-sse ja keelatud platvormikanal ei tohi pakkuda pöördumist; server peab sama reeglit uuesti jõustama teenuse stabiilse ID järgi. Negatiivtestid peavad katma profiili- ja teenusetaseme kõik true/false/null kombinatsioonid, mitu teenust ühes asukohas ning muudetud kliendi otsekutse.

**Seis.** NOT_DONE; runtime: not_run.

### SOL-SMAP-04 — otsing ja tulemuste loend on vaikides osalised — P2

**Tõend.** Leht laadib mount'il ühe `/api/service-map/entries?limit=500` vastuse ega saada kasutaja märksõna, piirkonda või tüüpi serverisse; kogu edasine otsing toimub selle lõike sees (`components/workspace/WorkspaceFeaturePage.jsx:58-59,3171-3246`). Tulemuste nupuloend näitab ainult esimest 24 kirjet ilma koguarvu, kärpehoiatuse või „laadi veel” toiminguta (`:3390-3406`). Teenusekirjete DB-päring kasutab `take`-piiri ilma cursorita ja võib ühe profiili mitmeks asukohakirjeks laiendada (`lib/serviceProviderProfiles.js:1271-1328`). Abikuulutuste päring teeb `take` enne märksõna ja `municipalityName` järelfiltrit, nii et vanem sobiv kirje võib esimesest 500/1000 reast välja jääda (`lib/help/mapEntries.js:497-538`). API vastuses puuduvad `total`, `hasMore`, `nextCursor` ja `truncated` (`app/api/service-map/entries/route.js:37-52`). Staatiline negatiivkontroll kinnitas **fetch=500**, **nupud=24** ja kärpemetainfo puudumise.

**Mõju.** Kasutajale kuvatakse „Selle filtriga kirjeid ei leitud”, kuigi sobiv KOV, teenus või abikuulutus on andmebaasis olemas, kuid sattus lõikest välja. Klaviatuuri-/loendikasutaja ei saa 25. tulemust avada samast tulemuspinnast ning süsteem ei ütle, et vaade on osaline.

**Vastuvõtukriteerium.** Märksõna, piirkond ja tüüp peavad minema serveripäringusse enne stabiilset cursor-paginatsiooni; vastus kannab `hasMore/nextCursor` ja UI koguarvu või ausat osalise tulemuse teadet. Ka asukohaks laiendatud kirjetel peab olema stabiilne sort/võti. Testida vähemalt 501 teenusekirjet, 501. kohal olev märksõnavaste, 25+ sama tüübi tulemust, võrdsed sortimisväljad ja kogu lehtede läbimine ilma kaduva/duplitseeruva reata.

**Seis.** NOT_DONE; runtime: not_run.

### SOL-SMAP-05 — sama koordinaadiga kontaktidel kaovad teenuse detail ja platvormipöördumine — P2

**Tõend.** Ühe kirjega popup kutsub `appendServiceItems()`, `appendAccessPath()` ja pakub `onStartPreInquiry` toimingut (`components/workspace/ServiceMapLeaflet.jsx:488-539`). Kui samal koordinaadil on üle ühe kirje, läheb kood `createGroupedPopupContent()` harusse; iga kontakt saab ainult pealkirja, lühikirjelduse, kontaktmeta ning help-kirje või e-posti/veebi toimingu (`:545-600,604-630`). `onStartPreInquiry` parameetrit kasutatakse grupifunktsioonis ainult ühe kirje varuharus; mitme kirje haru ei kutsu seda ega kuva teenuseid/ligipääsuteed. Kontakti valimine muudab valitud ID-d, kuid popup ehitatakse uuesti sama grupivaatega (`:976-985`). Negatiivkontroll kinnitas mitme kirje harus kõigi kolme detaili puudumise.

**Mõju.** Ühise vallamaja, teenuskeskuse või muu sama koordinaadiga KOV-i/teenuseosutaja puhul ei saa kasutaja kaardilt kontrollida teenuse tingimusi ega alustada platvormipöördumist, kuigi üksiku markeri puhul saab. Funktsionaalsus sõltub juhuslikult koordinaadi jagamisest.

**Vastuvõtukriteerium.** Grupivaade peab lubama avada iga kirje sama täisdetaili ja samad poliitikaga lubatud toimingud nagu üksikpopup, säilitades selge tagasitee gruppi. Komponenditest peab paigutama vähemalt kaks KOV-i, kaks teenuseosutajat ja segagrupi täpselt samale koordinaadile ning tõendama iga kirje detaili, ligipääsuteed ja pöördumistoimingut.

**Seis.** NOT_DONE; runtime: not_run.

### SOL-SMAP-06 — „Vaata teenusekaardil” süvalink ei ava viidatud kirjet — P2

**Tõend.** Eelpöördumise adressaadikaart genereerib lingi `/teenusekaart?entryId=<id>` (`components/workspace/WorkspaceFeaturePage.jsx:2848-2856`). Teenusekaardi `readInitialServiceMapFilters()` loeb ainult tüübi, märksõna ja piirkonna; `entryId`-d ei loeta ning `selectedEntryId` algab tühjana (`:3061-3100`). Vaiketüüp on `KOV_SOCIAL_CONTACT`, mistõttu teenuseosutaja viide filtreeritakse pärast lingi avamist ka loendist ja kaardilt välja. Negatiivkontroll kinnitas tootmiskoodis `?entryId=` lingi olemasolu ning selle täieliku puudumise Teenusekaardi algoleku parserist.

**Mõju.** Kasutaja vajutab konkreetse adressaadi juures „Vaata teenusekaardil”, kuid jõuab üldisele KOV-vaatele ilma valitud kontakti, detaili või selgituseta. Suure loendi korral ei pruugi viidatud kirje olla ka esimeses 500 reas, seega ei saa kasutaja seda käsitsi taastada.

**Vastuvõtukriteerium.** Süvalink peab serveris/klientis lahendama avaliku kirje ID, valima õige tüübi, laadima kirje ka väljaspool esimest lehte, keskendama markeri ja avama detaili. Peidetud/puuduv ID peab andma turvalise „ei ole enam avalik” seisu ilma kontaktilekketa. Testida KOV-i, teenuseosutaja asukohaliit-ID-d, help-kirjet, 501. kirjet, tundmatut ja `HIDDEN` ID-d.

**Seis.** NOT_DONE; runtime: not_run.

### SOL-SMAP-07 — ühe andmeallika viga võtab maha kogu Teenusekaardi — P2

**Tõend.** Ühendroute laeb teenusekirjed ja abikuulutused ühe `Promise.all()`-iga; ükskõik kumma rejection liigub ühisesse catch'i ja tagastab üldise 500 koos tühja kaardiga (`app/api/service-map/entries/route.js:37-56`). Vastuses pole allikapõhist seisu ega `partial` markerit. UI asendab vea korral kogu `entries` massiivi tühjaga (`components/workspace/WorkspaceFeaturePage.jsx:3171-3189`). Staatiline veasüstikontroll kinnitas `Promise.all` kasutuse ning `allSettled`/osalise vastuse lepingu puudumise.

**Mõju.** Ajutine help-tabeli või teenuseprofiili päringu tõrge muudab ka teise täiesti terve kontaktikihi kasutamatuks. Kasutaja ei saa kriitilist KOV-i kontakti otsida põhjusel, et eraldiseisev abikuulutuste allikas ebaõnnestus.

**Vastuvõtukriteerium.** Omanik peab määrama fail-closed vs osalise tulemuse lepingu. Kui andmeallika tehniline rike lubab osalist vastust, tuleb kasutada liigipõhist settled-tulemust, tagastada `partial:true` ja allika stabiilne veakood ning näidata UI-s ausat hoiatust; autentimis-/õigusevead jäävad fail-closed. Testida teenuse-, help- ja mõlema allika eraldi viga ning tõendada, et ükski tundlik sisemine veatekst ei leki.

**Seis.** NOT_DONE; runtime: not_run.

### SOL-SMAP-08 — anonüümsele kasutajale näidatakse keelatud abikuulutuste filtreid tühja tulemusena — P2

**Tõend.** API ei lae anonüümsele kasutajale teiste inimeste abikuulutusi ja tagastab selle kohta `peerListingsAvailable:false` (`app/api/service-map/entries/route.js:35-45,48-52`). Teenusekaardi klient ei salvesta ega loe seda välja, kuid kuvab kõigile alati „Abisoovid” ja „Abipakkumised” valikud (`components/workspace/WorkspaceFeaturePage.jsx:3175-3182,3369-3385`). Nende valimisel kuvatakse tavapärane „Selle filtriga kirjeid ei leitud”, mitte sisselogimise/privaatsuspiiri selgitus (`:3390-3394`). Negatiivkontroll leidis serveri võimekuslipu, kuid Teenusekaardi pinnal **0 tarbijat**.

**Mõju.** Avaliku Teenusekaardi kasutaja järeldab ekslikult, et piirkonnas pole abisoove ega -pakkumisi, kuigi tegelik põhjus on privaatsusest tulenev autentimispiir. See võib katkestada abivahenduse enne sisselogimist.

**Vastuvõtukriteerium.** UI peab kasutama serveri võimekuslippu: kas peitma peer-filtrid või näitama selget privaatsust säilitavat sisselogimiskutset, mis ei avalda kirjete arvu ega olemasolu. Testida anonüümset ja autenditud kasutajat nii nulli kui olemasolevate kuulutustega ning kontrollida, et anonüümne vastus ei võimalda olemasolu tuletada.

**Seis.** NOT_DONE; runtime: not_run.

## Testid ja negatiivkontrollid

- Esimene sihttestide käivitus enne auditi worktree lokaalse genereeritud Prisma kliendi taastamist: **35 testi läbis**, **7 testifaili ei laadinud** veaga `ERR_MODULE_NOT_FOUND: generated/prisma/client.ts`. See oli worktree setup'i, mitte tootmiskoodi testitulemus.
- `npx prisma generate` fikseeritud koopias: **õnnestus**, Prisma Client genereeriti; genereeritud failid on ignoreeritud ja auditikoodi ei muudetud.
- `node --import ./scripts/register-node-test-loader.mjs --test tests/serviceMap/*.test.js tests/serviceProvider/*.test.js tests/preInquiries/serviceMapRecipientId.test.js`: **74/74 passed**, 0 failed, 0 skipped, kestus **1954.4477 ms**.
- Auditispetsiifilised semantilised fake-Prisma/fixture negatiivkontrollid: **3/3 riskirada teostus** — `NEEDS_REVIEW + MATCHED → PUBLISHED`; keelatud teenuse e-post jäi avalikku asukohakirjesse; edukas tühi RAG-sünk jättis stale `PUBLISHED` rea muutmata.
- Auditispetsiifilised staatilised negatiivkontrollid: **5/5 kinnitatud** — 500/24 vaikne kärbe; `entryId` süvalinki ei tarbita; grupipopupist puuduvad detail ja pöördumine; ühe allika rejection lõpetab ühise vastuse; RAG-sünk puuduvate ridadega ei lepi.
- Päris PostgreSQL, autentitud brauser, väline Maa- ja Ruumiameti geokooder, päris RAG-teenus ning kahe kasutaja abisobitus/eelpöördumine: **not_run**.

## Kattuvused ja tõendamata osa

- `SOL-PRE-03` ja `SOL-PRE-04` on põhiauditis endiselt lahtised: need katavad avaldamata ID kasutamise eelpöördumises ja kliendi võltsitava adressaadi. `SOL-SMAP-01` kirjeldab eraldi varasemat regressioonirada, kus geokooder muudab ülevaatamata rea päriselt avalikuks; `SOL-SMAP-03` kirjeldab avaliku rea kanalieelistuse eiramist. PRE leide ei dubleeritud.
- `SOL-SPROF-03` katab nähtava asukoha kaudu peidetud teenuse lekke; aktiivses fikseeritud koodis püsib `link.providerService` varuvariant (`lib/serviceProviderServiceLocations.js:10-17`). Seda ei lisatud uue SMAP ID-ga.
- `SOL-SPROF-05`, `-07`, `-11`, `-12`, `-14` ja `-15` katavad profiili stale-salvestuse, profiil↔RAG tervikluse, avaldamisauditi, ühise rate-limit'i, uuesti avaldamise ning tühja profiili RAG-i. RAG-ist tuletatud kaardikontakti allikast eemaldamise reconcile (`SOL-SMAP-02`) ja geokooderi moderatsioonisiire (`SOL-SMAP-01`) ei olnud nendes kaetud.
- `SOL-PRE-18`, `SOL-SEARCH-05`–`06` ja varasemad moodulipõhised loendileiud kontrolliti; Teenusekaardi ühendvastuse enda 500/24 piir, asukohaks laiendamine ja help-i filter-after-take rada ei olnud neis kaetud.
- Help-kuulutuse omaniku-/privaatsusprojektsioon, nõusolek ja sobituse olekumasin on `SOL-HELP` leidude teema; siin auditeeriti ainult Teenusekaardi sisenemine ja ühendamine ning neid leide ei korratud.
- `SOL-SPROF-01` ja `SOL-SPROF-02` on põhiauditi `Seis` järgi DONE. Aktiivses koodis ei leitud Teenusekaardi katmata rajal nende regressiooni ning neid ei avatud uuesti.
- NOT_PROVEN: automaatsete sünkide tegelik scheduler/deploy-seadistus; päris allika täieliku/tühja vastuse semantika; mitme Node'i limiter; välise kaarditile'i ja geokooderi runtime-privaatsus; sama koordinaadi grupipopup päris brauseris; 501+ reaga päris PostgreSQL; RAG-i ja kaardi ajutine lahknemine retry ajal.

## Leidude kokkuvõte

| Prioriteet | Uusi leide |
|---|---:|
| P0 | 0 |
| P1 | 3 |
| P2 | 5 |
| P3 | 0 |
| **Kokku** | **8** |

**Järgmine auditiplokk:** Dokumendid — esimese süvaploki järel katmata failide, omanikuvaate, jagamise, ekspordi, kustutuse ja retention'i rajad.
