# ADR-143: õigusabi lehe toimetatud artiklid, indeksi piirid 15 000 dokumenti ja 150 000 lõiku ning riikide register

Kuupäev: 11.10.2026. Teostus Claude Opus 5.5. Seis: **korpus v83 on serveris töös alates 11.10.2026 kell 13:19 (479 artiklit, 0,0422 USD); indeksi piirid, korjaja täiendus, valikureegli parandused ja riikide register on koodis; otsing mõõdetud tasuta ja vastused 20 tasulise pöördega (0,0680 USD).**

## Miks

[ADR-140](adr-140-associations-own-pages.md) jättis lahtiseks juristaitab.ee rubriigi „Kiirelt kätte“. Omanik 11.10.2026, päeva jooksul:

- öösel teises aknas: „selles ma kahtlen, pigem ei pane“, ja selles seansis: „juristi sisu ma ei soovi“ (ettevalmistus peatati);
- hiljem, kui oli näha, mida rubriik sisaldab: „mul on ju eluküsimusega pöördujad ka platvormil ja tihti ka sotsiaaltöötajad soovivad lihtsat seaduse selgitust. Selline väike lõik koos seadusega oleks ju hea?“;
- küsimus-vastus kujul juristi postituste kohta: „mida ma ei taha, on need küsimused“ ja „minu arust peaks olema andmebaasis ainult vastused. Sest küsib meil ju kasutaja“;
- toimetatud artiklite kohta: „on artikleid ka, mis ei ole vormis "küsimus - vastus" - need võiks meil kindlasti sees olla“;
- dokumentide piiri kohta: „tõstame 15000 peale“;
- kui valikureegel luges riikide nimesid inimeste nimedeks: „riigi nimed peaks olema mul kuskil ühenduses nii, et süsteem saaks aru, kas tegu on riigi nime või inimese nimega. ehk siis mingi register peaks olema“.

## Mida rubriik tegelikult sisaldab

Varasem hinnang „umbes kaks tuhat lühikest õigusartiklit“ ei pidanud paika. Rubriigis on 197 loendilehte ja **3933 kirjet kahte liiki**, loend on liigi järgi järjestatud:

| Liik | Kirjeid | Mis see on |
|---|---:|---|
| „Korduma kippuvad küsimused“ | 501 | toimetatud artikkel, igal „Kontrollitud: pp.kk.aaaa“ |
| „Juristi vastus“ | umbes 3430 | eraisiku enda küsimus ja juristi vastus sellele, kuupäevaga „Vastatud“ |

**Juristi vastuseid ei loetud ja need ei lähe sisse.** Omanik neid ei soovi; vastus on kirjutatud ühe inimese juhtumi kohta ja ilma küsimuseta ei ole selge, millele ta vastab; pärast vastamist ei kontrolli neid keegi üle. Loendilehti loeti 93 (toimetatud artiklid on kõik esimesel 26 lehel); juristi vastuste arv on arvutatud lehekülgede arvust.

## Mis läks sisse

**479 toimetatud artiklit, 98 603 sõna, 670 lõiku.** Väljaandjana on kirjas „Justiits- ja Digiministeerium (Jurist aitab)“: sait ütleb enda kohta, et see on ministeeriumi veebileht, mida haldab lepingupartner Eesti Juristide Liit.

- **Pikkus:** veerand artiklitest on kuni 71 sõna, pooled kuni 126, kolmveerand kuni 233, pikim 1862. 375 artiklit on üks lõik.
- **Vanus:** kõigil 479 artiklil on kontrollimise kuupäev ja kõik on vahemikus 11.06.2026 kuni 27.07.2026 (juunis 463, juulis 16). Üle kahe aasta vanuseid ei ole.

Teemade kaupa (üks artikkel võib olla mitme teema all):

| Teema | Artikleid | Lõike | Kas teema seadus on kogus |
|---|---:|---:|---|
| Perekond (elatis, elatisabi, hooldusõigus, eestkoste, abielu, lahutus) | 121 | 156 | jah: perekonnaseadus, perehüvitiste seadus |
| Kohtusse pöördumine (maksekäsu kiirmenetlus, riigi õigusabi, lähenemiskeeld) | 76 | 105 | jah: kohtumenetluse seadustikud, riigi õigusabi seadus, riigilõivuseadus |
| Võlad (täitemenetlus, pankrot, võlgade ümberkujundamine) | 59 | 75 | osalt: täitemenetluse seadustik ja füüsilise isiku maksejõuetuse seadus on, pankrotiseadust ei ole |
| Piiriülene asjaajamine (kohtuotsuse tunnustamine, elatis välismaalt, dokumendid välismaal) | 54 | 131 | ei: Euroopa määrusi ja konventsioone kogus ei ole |
| Kinnisvara ja asjaõigus | 48 | 55 | ei: asjaõigusseadust ja korteriühistute seadust ei ole |
| Lepingud ja kahju hüvitamine | 45 | 50 | jah: võlaõigusseadus |
| Pärimine | 34 | 45 | jah: pärimisseadus (notari tasu seadust ei ole) |
| Dokumentide vormid (artikkel koos vormi lingiga) | 33 | 88 | |
| Maksud | 28 | 30 | ei: tulumaksuseadust ja maamaksuseadust ei ole |
| Töö | 19 | 33 | jah: töölepingu seadus |
| Ettevõtlus ja ühingud | 17 | 17 | ei |
| Tarbijakaitse | 13 | 18 | osalt: võlaõigusseadus on, tarbijakaitseseadust ei ole |
| Süüteod | 10 | 16 | jah: karistusseadustik, kriminaalmenetluse seadustik |
| Riiklikud toetused; haridus ja sotsiaalteenused | 2 | 3 | jah |

**Välja jäi 22 loetud artiklit:** 17 on alla 30 sõna (viis neist on ainult vormi link, kaksteist ühelauselised vastused; reegli alampiir), kolmel on pealkirjas „majandusaasta aruande“ (reegel jätab aruannete lehed välja ja seda siin ei muudetud), kahel lühikesel maksekäsu artiklil võtab kohtu postkasti aadress, mida reegel paigutada ei oska, ära üle veerandi tekstist. Kahest artiklist võeti välja kolm lõiku: üks nimetab inimest, kaks sisaldavad konsulaadi aadressi.

## Kuidas loeti

Tasuta, korjaja `rag-v2/web-page-2`, üks päring korraga, vähemalt 1,6 s vahega, saidi robotifail lubab. 501 aadressi, üks andis esimesel korral saidi vea ja loeti uuesti.

**Sisuosa vihje `.field--name-body` üksi ei toimi.** Sama klass on igal lehel kahel plokil: artikli sisul ja päises oleval saidi kirjeldusel. Korjaja nõuab, et vihje nimetaks täpselt ühe ploki, ja langes tagasi lehe põhiosale: salvestatud koopias olid sildirida, hääletuse arvud ja plokk „Samal teemal“. Korjaja täiendused (`lib/rag-v2/web-page.js`, `web-collect.js`):

- **Kaheosaline vihje** („`main .field--name-body`“): teine osa esimese sees. Üheosalist vihjet loetakse nagu enne.
- **Lehe enda kuupäeva koht** (nimekirja kirje `updated_region`, siin `.last-updated`): kuupäev „Kontrollitud: 26.06.2026“ seisab väljaspool artikli sisu. See läheb lehe andmetesse väljale `page_updated`, mille allika kaart juba mudelile annab ([ADR-114](adr-114-present-figure-for-a-future-event-and-three-laws.md)), mitte teksti sisse. Igakuine uuendus kannab mõlemat vihjet (`lib/rag-v2/chosen-refresh.js`).

Viie artikli peal (eri teemad, algus ja lõpp) kontrollitud: koopias on ainult artikli sisu; sildirida, hääletus, tagasisidevorm, „Anna tagasisidet“ ja „Samal teemal“ puuduvad. Nimekirja kirjetel silte ei ole (silt oleks otsinguabi dokumendi igal lõigul); teemad on kõrvalfailis.

## Valikureegel ja riikide register

Reegel (`lib/rag-v2/web-select.js`) eksis selle sisu peal neljal viisil; esimese käiguga võttis ta 501 artiklist 454, parandatuna 479.

- **Õigusakti number ei ole kuupäev.** „Nõukogu määruse nr 4/2009“ ja „Lugano 2007 konventsioon“ pealkirjas (viimane ka aadressis) loeti varasemaks aastaks ja 13 artiklit jäi välja kui vananenud. Akti numbri ja konventsiooni nime aasta jäetakse nüüd vahele; iga muu varasem aasta dateerib lehe nagu enne.
- **Üksuse postkast ei ole inimese aadress.** Valikureeglil oli oma, vanem aadressikontroll, mis tundis ainult kanalisõnade loendit; ministeeriumi „central.authority@“ võttis välja 35 lõiku artiklitest, mis lugeja just sinna suunavad. Nüüd ei ole inimese oma ka aadress, mille korjaja loeb asutuse kanaliks või üksuse postkastiks ([ADR-132](adr-132-a-units-mailbox-is-not-a-persons-address.md)).
- **Riigi nimi ei ole inimese nimi.** Uus register `lib/rag-v2/countries.js`: 208 riigi ja nimekuju eestikeelsed nimed algvormis, omastav ainult seal, kus tüvi muutub. Sõnapaar on riigi oma, kui see on mitmesõnalise nime kaks järjestikust sõna („Burkina Faso“, „Sri Lankas“, „Püha Tooli“), kaks riigi nime („Kasahstan Kasahstani“) või riigi nimi koos riigivormi sõnaga („Venemaa Föderatsiooniga“, „Rootsi Kuningriigiga“). Üks riigi nimi mõne muu sõna kõrval ei piisa, sest perekonnanimi võib olla riigi nimi; eesnimi paari ees otsustab enne („Mari Soome“ on inimene). Käändevormid tehakse lihtsa reegliga, sest valikureegel töötab ka igakuises uuenduses ilma keeleteenuseta; vestluses, kus kohanimesid loeb juba EstNLTK, saab sama registrit küsida lemma järgi (seda ei ole tehtud).
- **Üheksa sõnapaari**, mis ei ole inimesed ega riigid („Ametlikud Teadaanded“ kolmes käändes, „New Yorgis“, „Adobe Reader“ jt), lisati loendisse `NOT_PERSONS`, igaüks üle vaadatud.

**Mõju varasemale sisule** (vana ja uus reegel samade lugemiste peal, 1626 lehte korpuste v63 ja v76 kuni v81 lugemistest): 1617 lehel sama tulemus, 9 lehel jääb alles üks kuni neli lõiku rohkem, ükski leht ei tule juurde ega jää välja. Alles jäävad lõigud vaadati üle: üksuste postkastid (koos uute artiklitega kokku 12 eri aadressi, ühtegi inimese oma) ja paarid „Rootsi Kuningriigiga“, „Šveitsi Konföderatsioonis“, „Ametlikud Teadaanded“. Korpuses olevad koopiad sellest ei muutu: igakuine uuendus valib lehe uuesti alles siis, kui leht ise kaks korda sama moodi muutunud on.

Enne pakkimist vaadati paigutatud artiklid üle: korduvaid plokke ei ole; ühtegi sõnapaari, mida reegel inimeseks loeks, ei jäänud; 40 e-posti aadressi on kõik asutuste üldaadressid; lingi sihtkohtades @-märke ei ole. Seitse pealkirja kordub kahel eri sisuga artiklil (saidil on need eri aadressidel).

## Dokumentide piir 15 000

Piir seisis kahes kohas: `INDEX_CAPACITY.documents` (`lib/rag-v2/search/capacity.js`) ja otsingu enda `UNIFIED_LIMITS.directoryDocuments` (`lib/rag-v2/search/unified.js`). Mõlemad on nüüd 15 000 ja test hoiab need võrdsena: indeks, mille üks vastu võtab ja teine tagasi lükkab, katkestaks vestluse iga pöörde.

Dokumentide arvuga kasvab kõigi dokumentide kataloog, mille pööre loeb ühe korra. Sama mõõtepingiga serveris ([ADR-108](adr-108-index-capacity-100000-and-statistics.md), [ADR-137](adr-137-coverage-batch-and-the-law-of-obligations-act.md)): 38 ms 6470 dokumendiga, 48 ms 8337-ga, 53 ms 8722-ga, 56 ms 9288-ga ehk umbes 6 ms iga tuhande dokumendi kohta. Sama joont mööda on kataloog 15 000 dokumendi juures umbes 90 ms, umbes 35 ms rohkem pöörde kohta kui praegu. Sõnaotsing, vektorotsing ja mälus hoitavad vektorid sõltuvad lõikude arvust ja ei muutu. **Mõõtmata:** üle 9735 dokumendiga indeksit ei ole olemas; mõõtepink tuleb käivitada pärast täiendust.

Serveri plaan kontrollib piiri töötava väljalaske koodiga, nii et piir peab olema kasutusele võetud enne ostu.

## Lõikude piir 150 000

Omanik 11.10.2026, kui arvud olid ees: „lõikude piir tuleks panna sada viiskümmend tuhat 150 000 ja need ära osta“ (10.10 oli ta seda juba lubanud: „kui vaja, siis suurenda ka lõikude arvu indeksis 150 000 peale“). `INDEX_CAPACITY.units` on nüüd 150 000; see arv seisab ainult ühes kohas.

Viimane mõõtmine sama mõõtepingiga on sama päeva korpuselt v77 ([ADR-137](adr-137-coverage-batch-and-the-law-of-obligations-act.md), 88 181 lõiku): sõnaotsing kahe tekstiga 4,6 ja 5,6 s, vektorotsing 255 ms. Varasemate mõõtmiste joon peab (0,4 s ja 26 ms iga 10 000 lõigu kohta). Sama joont mööda 150 000 lõigu juures: sõnaotsingu mõõtepäring umbes 7,1 ja 8,1 s (andmebaasi ajapiir on 15 s), vektorotsing umbes 0,42 s, päris pöördel umbes 1,3 s rohkem kui praegu. Vektorid võtavad siis mälus 1,8 GB (praegu 1,1 GB). **Mõõtmata:** üle 91 158 lõiguga indeksit ei ole olemas.

**Enne seda piiri otsustab serveri ketas.** Üks lõik võtab serveris umbes 0,3 MB; 11.10.2026 vaba 16 GB mahutab umbes 45 000 lõiku juurde ehk kokku umbes 135 000. Mälu juurde osta ei ole vaja; ketast on vaja enne, kui kogu läheb üle umbes 130 000 lõigu.

## Eelkontrollid ja hind

Alus on korpus v82 (indeks `ec1defd0`), aluspoliitika põhikausta `tmp/rag-v2-v82/ship/policy.json`. Ettevalmistuse ajal oli alus v81 ja arvud olid 34 dokumendi ja 451 lõigu võrra väiksemad.

| | Praegu | Pärast | Piir |
|---|---:|---:|---:|
| Dokumente | 9769 | 10 248 | 15 000 (enne 10 000) |
| Lõike | 91 158 | 91 828 | 150 000 (enne 100 000) |
| Ketas serveris | 16 GB vaba (pärast v80) | umbes 0,25 GB vähem | |

Ühist silti partiil ei ole. Serveri ketast ega mälu täna üle ei mõõdetud.

Lõigud ja sisendite maht on mõõdetud päris lugejaga (`lib/rag-v2/ingestion.js`) iga artikli kohta eraldi ajutises hoidlas, mitte kohalikus korpuse hoidlas: **670 lõiku, 670 erinevat sisendit, 324 442 märki**, hinnaga 0,13 USD miljoni märgi kohta **0,042 USD**. Lagi: **0,06 USD ja kuni 700 sisendit**. Omanik 11.10.2026 küsimusele „Kas ostan: 479 artiklit, lagi 0,06 USD?“: „need ära osta“.

## Ost ja korpus v83 (11.10.2026)

Kohalik sisestus: 479 artiklit, ülevaatus reegli järgi (`scripts/rag-v2-review-by-rule.mjs`, liik „ametlik veebileht“, hoiatusi 0, takistusi 0), avaldatud kohalikku hoidlasse, pakitud aluse v82 poliitika peale. Enne üleslaadimist võrreldi sisestatud failid valikureegli värske käiguga (479 samad baidid) ja uus poliitika alusega (kõik 9769 alles, 479 uut).

| Käik | Sisendeid ostetud | Märke | Hind | Indeks | Dokumente | Lõike |
|---|---:|---:|---:|---|---:|---:|
| v83 | 670 | 324 442 | 0,0422 USD | `5288f882` | 10 248 | 91 828 |

Serveri tasuta plaan näitas enne ostu täpselt kohalikku arvestust (670 sisendit, 0,042177 USD); teadmata tulemusega päringuid 0. Käik algas kell 13:10 ja lõppes 13:19 (ost 3 min, indeks 5 min), ajal, mil ühtegi kasutuselevõttu ega muud tööd ei käinud. Vestlusplaan: `/etc/sotsiaalai/m4-corpus-chat-20261011g.json`. Hoidla pakiti käigu lõpus ise. Vaba ketast pärast: 14 GB. **Järgmine alus:** põhikausta `tmp/rag-v2-v79/ship/policy.json` (10 248 dokumenti; kausta nimi on ettevalmistuse oma).

Artiklid on registrites (`Andmebaasi/REGISTER.json`, `REGISTER.md`: asutuste juhislehti 1096), nimekirjas `Andmebaasi/register/web_pages_coverage_3.json` ja igakuise uuenduse seisus (rühm `coverage`, 479 koopiat külvatud; uuendus loeb nüüd vaikimisi kolme nimekirja).

### Mõõdetud pärast ostu (tasuta, serveris)

**Otsinguvärav** (33 raske tingimusega küsimust, alus korpus v77; sama võrdlus korpusel v82 kaks tundi varem): vigu 0, **otsustav lõik ei kadunud ühelgi küsimusel ega liikunud tahapoole**; üks küsimus parem (nagu v82-l), 21 täpselt samad, 11 muutunud (v82-l 4). Muutunud küsimustes on otsustava lõigu koht sama mis enne (17→17, 4→4, 32→32, 31→31, 3→3, 2→2, 7→7, 8→8) ja kandidaatide seas vahetus üks kuni kolm lõiku või muutus järjekord. Otsingu aja mediaan 5249 ms (alus) ja 4725 ms (nüüd). Värava küsimused on sotsiaalhoolekande teemadel; õigusartiklite enda teemasid (elatis, täitemenetlus, pärimine, tööleping) need ei mõõda.

**Mahu mõõtepink** (`w4/cap-bench2.mjs`, samad sisendid mis varem):

| Põlvkond | Dokumente | Lõike | Sõnaotsing, kaks teksti | Vektorotsing | Kataloog |
|---|---:|---:|---|---:|---:|
| v77 | 9288 | 88 181 | 6,1–7,3 s ja 7,7–10,0 s | 244 ms | 55 ms |
| v82 | 9769 | 91 158 | 6,3 s ja 7,5 s | 241 ms | 56 ms |
| v83 | 10 248 | 91 828 | 6,3 s ja 7,4 s | 328 ms | 57 ms |

Kataloog käitub nagu arvutatud (57 ms 10 248 dokumendiga). **Sõnaotsingu arvud ei ole eelmiste mõõtmistega võrreldavad:** sama põlvkond v77 andis eelmisel ööl 4,6 ja 5,6 s. Mõõtmise ajal läks tööle teise muudatuse kasutuselevõtt (teenuse taaskäivitus ja soojendus; koormus 5 nelja tuuma peal), nii et pink mõõtis koormatud serverit. Kolm põlvkonda on omavahel võrdsed, seega uus sisu ise otsingut aeglasemaks ei teinud.

**Puhas kordus vaiksel serveril** (samal päeval kell 14:23; skript ootas, kuni muud tööd ei käinud ja koormus oli alla 1,5):

| Põlvkond | Dokumente | Lõike | Sõnaotsing, kaks teksti | Vektorotsing | Kataloog |
|---|---:|---:|---|---:|---:|
| v77 | 9288 | 88 181 | 4,6 s ja 5,5 s | 318 ms | 53 ms |
| v82 | 9769 | 91 158 | 4,7 s ja 5,7 s | 321 ms | 55 ms |
| v83 | 10 248 | 91 828 | 4,8 s ja 5,8 s | 235 ms | 60 ms |

Joon peab: v77 annab sama mis eelmisel ööl (4,6 ja 5,6 s) ja v83 on lõikude arvu võrra aeglasem (0,2 s 3647 lõigu kohta, joone järgi 0,15 s). 150 000 lõigu arvutus (7,1 ja 8,1 s) jääb kehtima. Planeerija statistika värskendati aktiveerimisel (`ANALYZE` kell 13:18) ja planeerija ootab uuele põlvkonnale 11 051 dokumenti (tegelikult 10 248).

### Tasuline vastuste kontroll (11.10.2026)

Omanik 11.10.2026 küsimusele, kas teha tasuline kontroll (kümme õigusküsimust kaks korda, umbes 20 pööret, umbes 0,08 USD, lagi 0,12 USD): „tegutse jah“. Kümme küsimust inimese mure sõnadega, igaüks kaks korda päris vestluse rajal, töötaval väljalaskel ja korpusel v83 (`w4/check-v83` serveris; küsimused ja ettevalitud sätted `tmp/rag-v2-v79/check-v83/`). Iga küsimuse otsustava sätte sõnastus pandi enne paika seaduse tekstist. **20 pööret, vigu 0, 0,0680 USD.**

| Küsimus | Seadusesäte tõendites ja viidatud | Artikleid tõendites (1. ja 2. kord) | Millele vastus viitas |
|---|---|---|---|
| Lapse isa ei maksa elatist: kui palju vähemalt ja kuidas nõuda | jah, 2/2 | 4 ja 1 | perekonnaseadus § 101, artiklid „Kuidas määratakse elatise suurus?“, „Kuidas elatist taotleda Eestis?“ |
| Kohtutäitur ei saa elatist kätte: kas riik maksab | jah, 2/2 (§ 50, vt allpool) | 0 ja 0 | perehüvitiste seadus § 50, Sotsiaalkindlustusameti leht „Elatisabi“ |
| Kohtutäitur arestis palga: kui palju peab kätte jääma | jah, 2/2 | 0 ja 1 | täitemenetluse seadustik § 132 |
| Isa suri võlgadega: kas ja mis ajaga loobuda | jah, 2/2 | 2 ja 2 | pärimisseadus § 118–119, artikkel „Kuidas toimub pärandist loobumine?“ |
| Katseajal öeldi homseks üles | jah, 2/2 | 1 ja 1 | töölepingu seadus § 86 ja § 96, Tööinspektsiooni juhis, artikkel |
| Tähtajatu üürileping, omanik annab kuu aega | jah, 2/2 | 0 ja 0 | võlaõigusseadus § 312 ja § 311 |
| Täisealise vaimupuudega poja eest otsustamine | jah, 2/2 | 0 ja 1 | perekonnaseadus § 203, tsiviilkohtumenetluse seadustik |
| Ei ole raha advokaadi jaoks | jah, 2/2 | 1 ja 1 | riigi õigusabi seadus § 6, § 4, § 8, § 10 |
| Makseettepanek võla kohta, mida ei tunnista | jah, 2/2 | 2 ja 2 | tsiviilkohtumenetluse seadustik § 485, artikkel „Kuidas arvutada vastuväite tähtaega?“ |
| Lahkuminek: kes otsustab lapse elukoha | jah, 2/2 | 1 ja 1 | perekonnaseadus, artikkel „Kes otsustab lapse elukoha üle?“ |

- **Seadus ei jäänud ühelgi pöördel välja.** Mudelile antud 122 lõigust olid 72 seaduse lõigud ja 47 veebilehtede omad (neist 21 uutest artiklitest). Ettevalitud sõnastus oli tõendites ja viidatud 18 pöördel 20-st. Kahel elatisabi pöördel olin ise valinud vale sätte (perehüvitiste seaduse § 47, eesmärk): tõendites ja vastuse viites oli sama seaduse § 50 (tingimused ja summa), mis küsimusele tegelikult vastab.
- **Artikleid kasutati 14 pöördel 20-st** (tõendites) ja vastus viitas neile 11 pöördel. Artikkel andis seda, mida seaduses ei ole: elatise tänavune baassumma, kuidas arvutada vastuväite tähtaega, kuhu avaldus esitada.
- Vastuste tähtajad ja tingimused kuues küsimuses (katseaeg, üür, pärand, makseettepanek, eestkoste, riigi õigusabi) võrdlesin seaduse tekstiga: klapivad. Summasid (elatise baassumma 295,86 eurot, arestivaba 946 eurot) ma sõltumatu allikaga ei võrrelnud.
- Pöörde aja mediaan 19,8 s.

Sama päeva teine muudatus ([ADR-145](adr-145-a-passage-points-at-the-provision-it-names.md), teise seansi töö) paneb vestluse järgima lõigus nimetatud seadusesätet igas kirjaviisis; see oli kontrolli ajal juba töös ja kehtib ka nende artiklite kohta.

## Mis võib valesti minna

- **Kokkuvõtted võtavad otsingus seaduse sätete kohti.** Seda on korra mõõdetud (ADR-137: kaks lehte võtsid kuni 17 kandidaadikohta 36-st, otsustav säte liikus tahapoole, ei kadunud). Otsing hoiab riigi seaduste lõikudele kuus kohta; see on kaitse, mitte garantii.
- **Teemadel, kus seadust kogus ei ole** (piiriülene asjaajamine, kinnisvara, maksud, ettevõtlus: 147 artiklit ja 233 lõiku; koos pankroti ja tarbijakaitsega 181 artiklit), vastaks Luna ainult artikli põhjal. Leht on juhis, mitte õiguslik alus, nii et summasid ja õigusi ta sellest seaduse nimel ei väida.
- **Vananemine.** Praegu on kõik artiklid kontrollitud suvel 2026. Igakuine uuendus loeb lehe uuesti, aga kui muutub ainult kontrollimise kuupäev ja tekst jääb samaks, siis lehe andmetes olev kuupäev ei uuene.
- **Saidi kiirus.** 501 lehe lugemine võttis 40 minutit; sait vastas vahepeal 10 sekundiga lehe kohta.

## Kuidas pärast ostu mõõta

1. **Tasuta otsinguvärav** (`scripts/rag-v2-search-gate.mjs`, kataloogide 60 küsimust): alus salvestatakse samal päeval korpusel v81 enne ostu, võrdlus pärast. Loetakse, kas otsustav lõik kadus või liikus, ja konteksti pikkus.
2. **Tasuta mahu mõõtepink** (kataloogi aeg 10 214 dokumendiga) ja planeerija hinnang uuele põlvkonnale.
3. **Tasuline vastuste kontroll** (eraldi luba): umbes kümme õigusküsimust artiklite teemadel, igaüks kaks korda päris vestluse rajal, otsustav säte enne seaduse tekstist paika pandud. Hinnang 20 pööret, umbes 0,08 USD. Värava olemasolevad küsimused neid teemasid peaaegu ei puuduta ja uus väravaküsimus vajab oma päringuvektorit.

Kui otsustav säte mõnes küsimuses kaob, võetakse partii poliitikast tagasi.

## Lahtine

- ~~Ost ja korpuse täiendus.~~ Tehtud 11.10.2026 (korpus v83).
- ~~Mahu mõõtepingi puhas kordus ja planeerija hinnang.~~ Tehtud samal päeval (tabel ülal).
- ~~Tasuline vastuste kontroll õigusküsimustega.~~ Tehtud 11.10.2026: 20 pööret, 0,0680 USD (osa „Tasuline vastuste kontroll“).
- ~~Artiklis nimetatud säte ei tule artikliga kaasa.~~ Lahendatud samal päeval teise muudatusega ([ADR-145](adr-145-a-passage-points-at-the-provision-it-names.md)): lõigus nimetatud säte loetakse otsingu ajal tekstist.
- Vastustes olnud summad (elatise baassumma, arestivaba sissetulek) on võrdlemata sõltumatu allikaga.
- Puuduvad seadused teemadele, kus artikkel jääks üksi (asjaõigusseadus, korteriomandi- ja korteriühistuseadus, pankrotiseadus, tarbijakaitseseadus, tulumaksuseadus, notari tasu seadus): eraldi suurusega samm.
- Kontrollimise kuupäeva uuendamine, kui tekst ei muutu.
- 17 alla 30 sõna artiklit: nimekirja oma alampiir, kui neid soovitakse.
- Riikide registri ühendamine vestluse kohalugemisega.
- ~~Artiklite lisamine igakuisesse uuendusse.~~ Tehtud: rühm `coverage` on külvatud.
