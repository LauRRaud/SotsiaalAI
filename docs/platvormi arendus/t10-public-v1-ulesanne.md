# ÜLESANNE: T10 `PUBLIC-V1` — avalik platvorm ja liitumine

**Olek:** `QUEUED` — järjekorranumber **3** jadatöö järjekorras (vt allpool). Ei alustata enne, kui T02+T16 lepitus on `main`-i liidetud.  
**Teostus:** üks worktree, üks haru, üks terviklik lõppüleandmine  
**Soovitatud teostaja:** Terra Medium või Fable Medium

## Eesmärk

Avalik inimene saab ilma segaduse või vale lubaduseta aru, mis SotsiaalAI on, kellele see sobib, mida ta saab praegu teha ning kuidas liituda või sisse logida. Avaleht, võimalused, hinnastus ja registreerimine on üks rahulik etapiline teekond: **üks põhiasi korraga**. Juhend, privaatsus, kasutustingimused ja tööalase kasutuse raamistik jäävad eraldi selgeks lugemiskihiks.

Valmis kogemus tähendab:

1. avalehelt on üks selge järgmine samm: vali oma olukord, saa aru võimalusest või logi sisse;
2. võimalused ja hinnastus ei luba harudel olevat, väljalülitatud või veel ehitamata funktsiooni;
3. registreerimise suletud/avatud seis on serveris ja kasutajale üheselt sama;
4. kui registreerimine on avatud, valib inimene kõigepealt rolli ja liigub seejärel lühikeste arusaadavate sammudena konto, nõustumiste ning kinnituse juurde;
5. hinnastuse tasuta, tasulise ja sponsoreeritud võimaluse sõnastus on omavahel kooskõlas;
6. juhend ja õigusteave on leitavad, lugemiseks sobivad ning viitavad õigetele avalikele lehtedele;
7. ET/EN/RU, klaviatuur, ekraanilugeja, mobiil ja reduced-motion töötavad kõigil uutel avalikel radadel.

## Loe enne tervikuna

1. `CLAUDE.md`
2. `docs/platvormi arendus/teemaarenduse-jatkamise-kord.md`
3. `docs/platvormi arendus/fable-5-avalikud-turunduslikud-ja-oiguslikud-pinnad.md`
4. `docs/platvormi arendus/arendusteemade-masterregister.md` — T10
5. `docs/platvormi arendus/ruumilise-kogemuse-lahtekoht.md` ptk 167–205
6. `app/page.js`, `app/meist/page.jsx`, `app/autorilt/page.jsx`, `app/voimalused/page.jsx`, `app/hinnastus/page.jsx`, `app/registreerimine/page.js`
7. T02 lõpparuanne (haru `codex/account-v1 @ 929793f1…` — taustaks; T02 sisu ise jõuab `main`-i lepituse kaudu enne T10 algust, loe see baasist).
7. `components/alalehed/RegistreerimineBody.jsx`, `components/pages/RegistreeriminePageClient.jsx`, `components/LoginModal.jsx`, `app/api/register/route.js`
8. `app/kasutusjuhend/page.jsx`, `app/privaatsustingimused/page.js`, `app/kasutustingimused/page.js`, `app/tooalase-kasutuse-raamistik/page.jsx`, `app/sitemap.js`, `lib/metadata.js`
9. valmis aluscommit'id `15ab986f111c41eb7eb0c493486ca59cda858067` (meta) ja `8cae87123c6c6d7eefd3ea14fe77a8e4c8525ce7` (sitemap) — **mõlemad on 18.07 seisuga juba `main`-baasis sees**.

## Alus ja worktree

> **BAAS UUENDATUD 2026-07-18 (integratsiooni järel).** Kohalik `main` konsolideeriti 18.07: 26 valmis haru (sh meta `15ab986f` ja sitemap `8cae8712`) on nüüd `main`-is sees. Cherry-pick'e EI ole enam vaja. `origin/main` (server) on kohalikust `main`-ist taga; baas on KOHALIK `main`.

> **JADATÖÖ REEGEL (18.07, ülimuslik).** See teema on järjekorras **kolmas**: T24 FIELD → T02+T16 lepitus → **T10** → T07. Ära alusta enne, kui eelmine teema on `main`-i liidetud. Korraga kirjutab koodi ainult üks teema — 18.07 integratsioon näitas, et paralleelsed harud eri baasidelt tekitavad kollisioone, mida keegi ei näe enne lõppu.

1. **Baas = `main`-i PRAEGUNE tipp alustamise hetkel.** Jooksuta `git rev-parse main` ja raporteeri kasutatud SHA. Ülesande koostamise ajal oli see `0ea13453…`, kuid `main` on vahepeal liikunud (T24/T23 kontrollpunktid, dokumendid) ja liigub veel enne, kui T10 alustab — **see ei ole viga, see on ootuspärane**. Ära hargne vanast SHA-st.
2. Ära muuda põhitööpuud `C:\Users\rauds\Desktop\SotsiaalAI` — see on `main`-i peal ja puhas; kasuta seda ainult read-only baasina.
3. Loo uus worktree, näiteks `C:\Users\rauds\Desktop\SotsiaalAI-public-v1`, ja värske haru `codex/public-v1` kohalikust `main`-ist (`git worktree add ../SotsiaalAI-public-v1 -b codex/public-v1 main`).
4. Cherry-pick'e ei tehta: meta-title/description commit `15ab986f` ja sitemap'i commit `8cae8712` on juba baasis. Sinu kohustus on need terveks hoida (meta kõigil T10 lehtedel ET/EN/RU mittetühi; sitemap'i kanoonilised URL-id kooskõlas).
5. T02 `ACCOUNT-V1` jõuab `main`-i enne T10 algust (lepitus on järjekorras teine). See on oluline, sest T02 ja T10 puudutavad mõlemad registreerimise ja `LoginModal`-i kasutajateed — kontrolli baasist, milline konto/e-posti mudel seal kehtib, ja ehita selle peale. Ära võta T02 haru eraldi stack'i.
6. Ära rebase'i ega kasuta teiste teemade poolelolevaid worktree'sid (`SotsiaalAI-field-v1`, `SotsiaalAI-esta-mentor-v1`) alusena.
7. Lõpetamisel: väravad rohelised → merge `main`-i **samal päeval** → alles siis avatakse järgmine teema. Haru ei jäeta päevadeks lahku seisma.

## Lukustatud V1 valikud

| Teema | V1 valik |
|---|---|
| Avalik kujundus | Tegevuslikud lehed (`/`, `/voimalused`, `/hinnastus`, `/registreerimine`) kasutavad SotsiaalAI enda registreerimislehe laadset ühe-fookuse-etapiteekonda. See ei ole eraldi T19 ruumimootor ega React Bits'i komponentide kopeerimine. |
| Lugemislehed | `/meist`, `/autorilt`, `/kasutusjuhend`, privaatsus, tingimused ja raamistik kasutavad rahulikku lugemiskihti: sisukord, otsitavad pealkirjad, nähtav asukoht ja lihtne tagasi-/edasi liikumine. |
| Registreerimine | Registreerimine jääb vaikimisi suletuks. Avatus tuleb ühest serveri tõeallikast; klient näitab sama seisu ega anna väljalülitatud vormiga eksitavat lubadust. |
| Tasuta pakett | Tasuta võimalus jääb nähtavaks. Sõnastus on „alustamiseks”; aktiivse tasulise kasutuse piirid on hinnastuses ning juhendis selged. Päris makseid ei aktiveerita. |
| Kriisiinfo | Avalik tekst ei väida, et veel deploy'mata käitumine toimub alati automaatselt. Hädaolukorras on 112 alati nähtav; muu abiinfo sõnastatakse ausalt olemasoleva funktsiooni järgi. |
| SEO ja keel | Keelevalik jääb küpsisepõhiseks. Kuni puudub eraldi URL-lokaadi otsus, sitemap on lokaadineutraalne ja hreflang-alternatiive ei lisata. |
| `/autorilt` | Leht jääb alles ning on leitav Meist-/Teave-kihist ja sitemap'ist. |
| Õigusinfo | Tehniline V1 parandab faktilised vastuolud, näitab dokumendiversiooni/jõustumiskuupäeva ning salvestab uuel registreerumisel terms/privacy nõustumise tõendi. See ei ole juristi lõplik sisukinnitus. |

## Teostus

### E1 — avaliku teekonna ühine kest

- Loo väike korduskasutatav avaliku teekonna kest, mis hoiab ühel ekraanil ühe tähendusliku teema, näitab kasutaja asukohta, pakub nähtavat „Järgmine”/„Tagasi” või alternatiivset otsevalikut ning ei kaaperda brauseri loomulikku kerimist.
- Rakenda kest avalehele, võimalustele, hinnastusele ja registreerimisele. Iga leht võib kasutada eri sisu, kuid ei tohi olla eri nupu-, värvi- ega liikumiskeeles.
- Lähtu olemasoleva registreerimislehe flighti kasutatavuse tugevustest, mitte selle tehnilise koodi kopeerimisest kõikjale. Ühel lehel ei tohi kaks eri süsteemi korraga kerimist juhtida.
- Reduced-motion ja klaviatuurirežiimis on sama sisu tasase, järjestikuse ja hüpatava vaadena; `prefers-reduced-motion` ei peida ühtegi sammu.
- Lisa mobiilile kindel, nähtav järgmise sammu CTA ning väldi tabelit, mis sunnib inimest horisontaalselt kerima.

### E2 — avaleht, võimalused, Meist ja Autorilt

- Avaleht juhatab kolme ausa järgmise sammuni: „mida ma vajan”, „mida platvorm võimaldab” ja „logi sisse / liitu”. Kui registreerimine on suletud, ei ole peamine CTA konto loomine.
- Võimaluste leht eristab pöörduja, sotsiaaltöö spetsialisti ja teenuseosutaja kasu ilma tulevasi funktsioone valminuna esitlemata. Harudel olev T02, T17, T23–T25 või deploy'mata paketid ei lähe avalikku lubadusse.
- Meist-leht selgitab lühidalt eesmärki, usalduspiire ja kuhu edasi liikuda; Autorilt on sellest leitav ning mõlemad kasutavad sama avalikku navigeerimist.
- Säilita olemasolevad brändivärvid, kontrast ja semantiline HTML. Ära too sisse uut disainisüsteemi ega kõrvalise teegi komponente.

### E3 — hinnastus, tellimuse lubadus ja registreerimise avatus

- Loo üks serveripoolne avalik registreerimise seis, mida kasutavad `app/api/register/route.js`, registreerimisleht ja LoginModal. Klient ei tohi olla autoriteet ning väljalülitatud server ei tohi saada avatud kliendivormi.
- Suletud seis selgitab rahulikult, et platvorm on avamise ettevalmistuses, ning pakub reaalseid alternatiive: võimalused, juhend, hinnastus või sisselogimine olemasolevale kasutajale.
- Avatud seis kasutab nelja selget sammu: roll → kontoandmed → vajalikud nõustumised → ülevaade ja kinnitus. Rolli järgi nähtavad tööalase kasutuse raamistikunõuded säilivad serveris autoriteetsena.
- Hinnastus eristab tasuta alustamist, rollipõhiseid pakette ja sponsoreeritud ligipääsu. Disabled/ehitamisel CTA-l on alati nähtav selgitus ning klaviatuuriga loetav olek, mitte ainult tooltip.
- Muuda `subscription.info`, juhendi ja hinnastuse sõnastus sama tõeallika järgi kooskõlaliseks. Ära muuda T09 tellimuse, entitlement'i, webhooki ega makseoleku loogikat.

### E4 — nõustumise tõend ja õigusteave

- Nõua registreerimise API-s terms- ja privacy-nõustumist serveripoolel, mitte ainult kliendi checkbox'ina. Lisa minimaalne versioonitud tõendikirje või kasuta olemasolevat samaväärset püsivat mustrit: kasutaja, dokumendivõti, versioon, locale, aeg, allikas, IP ja user-agent.
- Loo nõustumised samas transaktsioonis uue kasutajaga. Katkine või puuduv nõustumine ei loo kontot.
- Näita Terms/Privacy/raamistiku lehtedel dokumendi versiooni ja jõustumiskuupäeva. Paranda ainult faktilised vastuolud: teenuseosutaja hind viitab hinnastuse tõeallikale ning süvauuringu piir kirjeldab tegelikku kuupõhist mahtu + ühe aktiivse töö piirangut.
- Ära esitle neid tekste juristi lõplikult kinnitatuna ning ära muuda makse-, retentioni- ega töötlejarollide sisupoliitikat. See jääb tulevase õigusliku kinnituse sisendiks.

### E5 — juhend ja otsitav lugemiskiht

- Tee kasutusjuhendist avalik lugemiskiht: nähtav sisukord, URL-i hashiga avanevad peatükid, lokaalne pealkirja- ja märksõnaotsing ning selge tühja tulemuse seis. See otsing otsib ainult juhendi avalikku sisu; T17 isiklikku otsingut ei puutu.
- Uuenda juhendi katkised `/#meist` viited, registreerimise suletud seis, rollisõnastus, hinnastuse viited ja kriisiinfo, et need vastaksid E2–E4 tõele.
- Privaatsus, tingimused ja raamistik kasutavad sama lugemiskihi semantikat, kuid ei muutu interaktiivseks vormiks ega nõua sisselogimist.

### E6 — meta, sitemap ja jagamine

- Säilita ja integreeri meta-title/description aluscommit ning sitemap'i kanooniliste URL-ide aluscommit. Meta peab olema kõigil T10 lehtedel ET/EN/RU mittetühi ja sisuga kooskõlas.
- Lisa ainult samas T10 ulatuses avalik Organization JSON-LD ning brändile vastav staatiline jagamispilt. Pilt peab olema tekstita või sisaldama ainult SotsiaalAI nime, et ET/EN/RU ei läheks pildis vastuollu.
- Sitemap sisaldab iga kanoonilise avaliku lehe üks kord, sh `/meist` ja `/autorilt`; autentitud `/tellimus` ei lähe avalikku sitemap'i.

## Selgelt väljas

- T09 maksete, tegeliku tellimuse olekumasina, webhookide või paketiõiguste muutmine.
- T02 konto-/PIN-/e-posti turvateekonna muutmine.
- T15 platvormiülene a11y/i18n audit; T10 tõendab ainult oma muudetud avalikke pindu.
- T19 ruumilise tööruumi mootori, prototüüpide või sisepindade muutmine.
- T17 isiklik otsing; T10 otsib ainult avaliku juhendi sisu.
- Päris kasutajate, tootmisandmete, maksepakkuja või tootmisserveri kasutamine.
- Merge, deploy, PR, põhitööpuu puhastus, rebase ja force-push.

## Nõutud testilepingud

Lisa või laienda repo `node:test` mustris vähemalt järgnevad kontrollid.

1. Avalik registreerimise seis on serveris autoriteetne; suletud kliendivaade ei esita avatud vormi ja suletud server tagastab ka käsitsi POST-ile 403.
2. Avatud registreerimise rada nõuab terms- ja privacy-nõustumist serveris ning loob kasutaja ja tõendikirjed aatomselt; puuduv nõustumine ei jäta kasutajat ega tõendit.
3. Kolm rolli läbivad õige sammujada; tööalase kasutuse raamistikunõue jääb serveris jõustatuks.
4. Avalehe, võimaluste ja hinnastuse CTA-d ei väida tuleviku- või deploy'mata funktsiooni ning suletud seis annab reaalse järgmise sammu.
5. Tasuta, tasuline, sponsoreeritud ja aegunud/puuduv tellimuse avalik copy ei ole omavahel vastuolus; T09 entitlement'e ei muudeta.
6. Juhendi hash-navigatsioon, avalik lokaalne otsing, tühi tulemus ja katkiste ankrute puudumine toimivad.
7. Õigusteabe faktilised hinna-/perioodiviited on kooskõlas kinnitatud T10 copyga; uus tõendikirje ei leki avalikesse vastustesse.
8. Iga T10 meta-title/description on ET/EN/RU-s mittetühi; sitemap sisaldab ainult unikaalseid kanoonilisi avalikke URL-e ning `/autorilt` on leitav.
9. Järgmine/tagasi, skip-link, klaviatuurifookus, reduced-motion ja 375 px mobiilivaade on kasutatavad; disabled CTA-l on nähtav selgitus.
10. Public HTML/JSON-LD ei sisalda testkontode, töötajate, sisemiste feature flag'ide ega tundlike serveriväärtuste andmeid.

Käivita vähemalt avalike lehtede, registreerimise, i18n/meta, sitemap'i ja õigusnõustumise sihttestid; muudetud failide lint; `npm run i18n:check`; skeemi korral `npx prisma validate` + migratsiooniahela kontroll; `git diff --check`; production build. Täissviit ja sõltumatu audit jäävad T27-sse, kui neid eraldi ei nõuta.

## Sünteetiline runtime

Kasuta ainult lokaalset sünteetilist keskkonda. Kontrolli kolm rolliteekonda, suletud registreerimise serveri-/kliendikooskõla, juhendi otsingut, hinnastuse CTA-sid, ET/EN/RU metaandmeid ja mobiilivaadet. Kui avatud registreerimise täisrada vajab eraldi ajutist testandmebaasi, kasuta seda; ära loo ega kustuta ühiseid püsivaid testkontosid. Päris e-kirju ega makseid ei saadeta. Ajutine kasutaja ja nõustumiskirjed koristatakse või märgitakse ausalt `NOT_RUN`/`NOT_PROVEN`.

## Definition of Done

1. E1–E6 on samas harus teostatud.
2. Meta `15ab986f` ja sitemap `8cae8712` panus on baasist terve: meta kõigil T10 lehtedel ET/EN/RU mittetühi, sitemap'i kanoonilised URL-id kooskõlas.
3. Avalik tegevusteekond on ühe fookusega, SotsiaalAI brändikeeles ning reduced-motion/mobiili varuvaatega.
4. Registreerimise avatus on ühtne serveritõde; avatud raja nõustumised on serveris tõendatavad.
5. Hinnastus, juhend ja avalikud lubadused räägivad sama, praegu tegelikult olemasolevat juttu.
6. Õigusinfo on faktiliselt täpsem, versioonitud ja ausalt mitte-juristi-lõppkinnitusega.
7. Avalik juhend on leitav ning otsitav ilma isiklikku otsingut või ligipääse laiendamata.
8. ET/EN/RU, a11y, mobiil, meta, sitemap ja jagamine on muudetud pindadel korras.
9. Worktree on puhas, muudatused commit'itud ja remote-harusse push'itud.
10. `main`, server, merge ja deploy jäävad puutumata.

## Lõpparuanne koordinaatorile

Esita worktree, haru, täpne baas-SHA (peab olema `0ea13453…` või uuem kohalik `main`) ning lõppcommit/remote SHA; migratsiooni nimi või kinnitus, et seda ei tehtud; E1–E6 kasutajateekonna kokkuvõte; testide/lindi/i18n/Prisma/diff-check/buildi tulemused; runtime ja cleanup või `NOT_RUN`/`NOT_PROVEN`; juristi lõppkinnituse piir; ning kinnitus, et põhitööpuud, `main`-i, serverit, merge'i ega deploy'd ei muudetud.

Koordinaator kontrollib pärast aruannet ainult haru, parent'i, commit'i ja remote SHA-d. Ta ei korda automaatselt sinu teste, buildi ega runtime'i.
