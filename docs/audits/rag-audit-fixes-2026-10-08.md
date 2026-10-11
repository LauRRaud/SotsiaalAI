# RAG-i Astra auditi parandused · 08.10.2026

Lähtekoht: `7e4315e4` järelkontroll commit’ile `ca5970f9`. Omanik palus leitud puudused parandada. Muudatus puudutab dialoogimälu, vastuse adressaati ja allikavaliku tingimuste katvust. Vahemälupoliitika `uncached-full-text-1` jääb vaikimisi välja; allikateksti ei kärbita.

## Teostus ja piirid

- **Otsing katab ka formaalse nõude.** Osutamise või saamise õiguse ja piirangute küsimuses otsitakse olemasoleva kuni kolme päringu sees eraldi teenuse/toetuse formaalseid nõudeid ning kasutaja olukorda. See ei lisa uut mudelikutsete etappi ega fikseeritud allikapõhist erandit.

- **Tagasilükatud asjaolu ei kao jäljetult.** `mergeFactState` jätab ebatäpse tsitaadi endiselt faktidest välja. Server säilitab selle aluseks nimetatud kasutajapöörde algteksti `recovery` all; mudeli enda samanimelist välja ei usaldata. Järgmise vastuse sisendis on ainult taastamist vajavate pöörete numbrid, sest algsed sõnumid on seal juba olemas. See ei lisa eraldi mudelikutset ega topelda algteksti igal pöördel.
- **Teema täitumisel on ülekanne piiratud.** Praegused faktid, parandused ja kohateave säilitavad eelisjärjekorra. Lahendamata algtekst läheb olemasoleva 1800 märgi ülekandepiiri vabasse ossa. Kui terve tekst ei mahu, saab uus mälu `recovery.omitted: true`; mudelil kästakse küsida ainult vastuse jaoks vajalik puuduv asjaolu. Vanem sõnastus esitatakse enne kehtivaid fakte. Tagasilükatud tõlgendust ei muudeta selle käigus tõeseks faktiks.
- **Rollijuhis valitakse sisselogitud rolli järgi.** Pöörduja saab enda tegevused, spetsialist juhtumi hindamise ja korraldamise töö ning teenuseosutaja teenuse osutamise ja koostöö tegevused. Ametiasutuse otsustuspädevust ei tuletata sisselogimisrollist. Teises isiklikus rollis esitatud küsimus säilib erandina. Serveri olemasolev rollikontroll jääb samaks; rollijuhis paikneb eraldi serveri loodud `developer`-sõnumina pärast kasutaja küsimuse ja tõendite JSON-i. Rolli väärtus ei pärine allikatekstist ega kliendi saadetud rolliväljast.
- **Hind vajab ka piiravaid norme.** Varasema CLIENT-jätku kandidaatides oli SHS § 16, kuid allikavalik jättis selle välja. Seetõttu ei saanud lõppvastuse täielikkuse juhis üksi maksevõime kaitset taastada. Allikavalikule lisati üldine juhis hoida kohaliku hinna kõrval kohaldatavad maksevõime, ligipääsu, soodustuste ja individuaalse hindamise sätted. Puuduvad allika ID, nime või valla järgi erandid. Esimene päriskatse näitas, et vajalik kvalifikatsioon jõudis nüüd kõigi kolme rolli tõendipaketti, kuid jäi lõppvastustest ikkagi välja. Seetõttu täpsustati ka vastuse juhist: hinnakirja kõrval tuleb esitada tõendatud maksevõime ja kättesaadavuse tingimused ka siis, kui kasutaja küsib ainult hinda. Pensioni ei võrdsustata automaatselt kogu arvestatava sissetulekuga.
- **Viited on pöördepõhiselt piiratud.** Esimese katse spetsialisti redaktsioonivastus tagastati stringiga `S7','S8','S10','S11` ühe viite kohal. Kontroll keeldus selle avaldamisest. Lõplik skeem lubab igas viiteelemendis ainult käesoleva paketi tegelikke viitenumbreid (`enum`). Jagatud skeemi kloonitakse enne täpsustamist, et ühe päringu viited ei satuks järgmisse. Serveri valideerimine jääb muutmata; viiteid ei arvata ega parandata tagantjärele.

API kuju kontrolliti ka kohalikust OpenAI SDK-st: `EasyInputMessage` toetab `developer`-rolli (`node_modules/openai/resources/responses/responses.d.ts`).

Lepingud: dialoogijuhis 36 → 37; allikavalik 11 → 12. Ajaloolised versioonid jäävad loetavaks. Olemasolev seisuskeem säilib: `recovery` on serveri lisateave, mitte mudeli uus seisuleping. Vastuse viiteskeemi kitsendatakse päringupõhiselt. Admini enesetest, õigused, tasumäärad ja piirangute rahaarvestus ei muutu.

Viidete piirang tõendab viitenumbri kuulumist paketti, mitte iga lause sisulist järeldatavust allikast.

Piirang: taastamistee katab tuvastatud tagasilükkamise ja puuduva mudeliseisu. See ei tuvasta asjaolu, mida mudel ei paku üldse. Olekumärgis säilib konservatiivselt; üks edukalt taastatud fakt ei tõenda kogu sõnumi täielikku tõlgendamist. Kõigi rollide kõigi olukordade sisulist veatust üks valim ei tõenda.

## Kontrollimeetod

Kohalikud sihttestid: 71/71. Uued kontrollid katavad vale numbri/negatsiooni/parafraasi faktiks muutmise vältimise, algteksti taastamise, mudeli võltsitud taastamisvälja eiramise, teemaülekande ning mahupiiri korral ilmse puudujäägi. Teemaülekande täpsustatud test läbis eraldi 6/6. HTTP-voo testadapteris läbis 7/7, sh päringu rollivälja eiramine sisselogitud rolli kasuks. `rag-v2-dialogue-store.test.mjs` ei käivitunud: puudus nõutud eraldatud kohalik `M4_TEST_DATABASE_URL`; selle faili tulemus `not_run`, mitte läbitud andmebaasitest. Pärast viiteskeemi ja hinnatingimuse lisamist läbis muutunud pinna 18 sihttesti (osaliselt varasemate testidega kattuvad), sh uus viitenumbrite eraldatuse regressioonitest. Formaalse nõude päringu täienduse järel läbis asjakohane 28 testi, sh ajalooliste juhiste säilimine (varasemate kontrollidega kattuv komplekt). Sihtlint ja `git diff --check` läbisid.

Pärismõõtmine kasutab sama 15 pöördumise faili ja kõiki kolme rolli. Serveri aktiivne lähteversioon kontrolliti: `a543ae5a7e1bad7e20c0b2ec43ea96e6ea4a6def`, teenus `active`. Aktiivne plaan läbis muutmata koodiga täitmisloa kontrolli enne katset. Eraldi protsess laadis uued moodulid ainult katseks, lõi sünteetilised `@example.invalid` kasutajad ja oma eelarve ning kasutas päris otsingut, mudelit ja rahaarvestust. Katse ei muuda aktiivset plaani ega loe tootmiskasutajate vestlusi. See katse ei tõenda uut koodi HTTP kaudu tootmises töötavaks.

Iga mõõteringi eraldi lisapiir oli 0,15 USD; enne parandusi kulunud kõigi katsete kulu 0,366613975 USD; kogupiir 1 USD. Esimene ring kulutas 0,059884855 USD (60 tasutud mudelikutset, sh tõrkunud pöördumine); enne lõplikku ringi oli kogukulu 0,426498830 USD. Rahaline mõõt on API tagastatud tegeliku tokenikasutuse hind külmutatud tariifi järgi, mitte OpenAI koondarve import. Kõik tabelite summad on USD. Harilik automaatne vahemälu jääb kasutusse, et kvaliteediparandusi hinnata ilma opt-in poliitikat üldiselt aktiveerimata. Varasema algmõõtmise ja viimase cache-kandidaadi tulemused on mõlemad võrdluses. Muutuvad päringuplaan ja otsingutulemused ning erinev vahemälu soojus välistavad ühest katsest kindla põhjusliku kiiruse- või kuluvõidu järeldamise.

Tõendid: [mõõteskript](rag-audit-fixes-2026-10-08-measure.mjs), [tasuta kontrollskript](rag-audit-fixes-2026-10-08-probes.mjs). Mõõteskript käivitatakse eraldatud serveriprotsessis, täites valimi ja faasi kohatäited; tulemuses on mõõdetud moodulite räsid. Toorandmed on kohalikus ignoreeritud failis `tmp/rag-audit-fixes-result.json`; avaldatav tõend sisaldab kviitungeid, vastuseid, seisumuutusi ja tõenditekstide räsisid.

## Esimene paranduskandidaat — säilitatud ebaõnnestumised

15 pöördumist, 14 avaldatud vastust ja üks viiteveaga peatatud vastus. Kõik 60 kviitungit jäid alles; tundmatu kuluga kutseid 0 ja sünteetilised kasutajad eemaldati. Spetsialisti koduteenuse vastus käsitles hindaja tööd ning kõrvalabi vajadus säilis kõigi kolme rolli mõlemas koduteenuse pöördes. Samas kõigi kolme rolli hinnavastus jättis maksevõime kaitse mainimata, kuigi see oli nüüd tõendites. CLIENT-i vanaema-küsimuses ei jõudnud sugulase piirang vastusesse; vastus kaldus asendushoolduse täpsustamisele. Seda vooru ei loeta täielikult õnnestunuks. Kogu vastuste, maksete ja tõrke kontrolli tõend: [esimene ring](evidence/rag-audit-fixes-first-2026-10-08.json).

## Teine kandidaat — hinnatingimused ja viiteskeem

15/15 vastust avaldati; kulu 0,068948870 USD, 60 arveldatud kutset, tundmatu kasutusega kutseid 0. Hinnajätkudes olid kõigil kolmel rollil nüüd lisaks 1 euro / 6,50 euro määradele inimese majandusliku olukorra ja tasu erandid või ligipääsu kaitse; täpseid kohalikke soodustusi ei mõeldud välja. Pensioni ja kogu arvestatava sissetuleku erinevus säilis. Kõrvalabi vajadus säilis kõigis kuues koduteenuse pöördes.

Spetsialisti koduteenuse esimese vastuse neljas lõik suunas siiski küsija piirkonna sotsiaaltöö spetsialisti poole, kuigi eelnevad lõigud käsitlesid hindaja tööd. Seetõttu ei loeta rollipuudust selle ringiga lahendatuks. Järgnev muudatus viib sama usaldatud rollijuhise pärast pikka tõendipaketti; see ei lisa uut AI-kutset ega luba allikatel rolli muuta. Tõend: [teine ring](evidence/rag-audit-fixes-second-2026-10-08.json). Enne lõplikku ringi on kogukulu 0,495447700 USD.

## Kolmas kandidaat — roll pärast tõendipaketti

15/15 vastust avaldati, lisakulu 0,070165405 USD. Spetsialisti koduteenuse vastus käsitles tema enda hindamis- ja korraldustööd ning teenuseosutaja vastus eristas omavalitsuse otsustuspädevust. Kõigi kolme rolli hinnajätk säilitas tasu suuruse, arvestatava sissetuleku tingimuse ning majandusliku olukorra või ligipääsu kaitse; kõik kuus koduteenuse pööret säilitasid kõrvalabi vajaduse. Taastamise varutee päriselt ei aktiveerunud, sest nendes vastustes olid tsitaadid korrektsed; selle tehniline käitumine on tõendatud kohalike sihttestidega.

CLIENT-i ja SERVICE_PROVIDER-i vanaema-küsimuses polnud vajalikku SHS § 25 sugulase piirangut isegi valikukandidaatides. Mõlemad vastused kaldusid asendushoolduselt lahkuva noore juhendile. Spetsialisti küsimuses oli vajalik norm kandidaatides ja vastuses olemas. See on ülesvoolu otsingukatvuse puudus, mitte viitevalidaatori viga ega lahendatav vastuse suunamisega. Lisati üldine otsinguplaani juhis: osutamise/saamise õiguse või piirangu küsimus peab olemasoleva kolme päringu piiri sees sisaldama eraldi formaalsete nõuete päringut, mitte ainult isikustsenaariumi sõnu. Teenust, sugulast, seadusenumbrit ega oodatud vastust ei kodeerita runtime’i erandina.

Tõend: [kolmas ring](evidence/rag-audit-fixes-third-2026-10-08.json). Enne järgmist ringi on kogukulu 0,565613105 USD; senine voor ei tõenda täielikku kvaliteedivõrdsust.

## Lõplik mõõtmine ja otsus

Lõplik variant: `audit-fixes-formal-rules`, dialoog 37 / allikavalik 12; sama 15 pöördumise valim. **15/15 vastust avaldati, kuid tehniline lõpetamine ei võrdu sisulise õigsusega. Kvaliteedivõrdsus ei ole tõendatud; tootmisse ei avaldata.**

Paranesid kontrollitud rollikäsitlus, kõrvalabi vajaduse säilimine kõigis kuues koduteenuse pöördes ning sugulase piirangu leidmine kõigis kolmes rollis. Mõlema õigusakti redaktsiooni viited ja uurimuste eri aastad olid olemas. Kõigi kolme hinnajätku vastustes oli jõukohasuse, vähendamise või kättesaadavuse tingimus. Taastamise varutee ei aktiveerunud selles pärisvoorus, sest faktitsitaadid olid korrektsed; selle veajuhtum on kontrollitud kohalike testidega.

Allesjäänud konkreetsed puudused:

1. **Q1 · teenuseosutaja hinnakiri.** Esimese pöörde mudeli kohatsitaadist puudus kohanimi. Server jättis koha õigesti kinnitamata, kuid `unresolved` seis takistas ka järgmise pöörde kohaliku allikapiiri valikut (`region_required / attribution_unresolved`), ehkki päringus oli Tartu. Vajalik kehtiv hinnakiri puudus kandidaatides. Vastus nimetas 2023. aasta 6-eurost tasu selgelt ajalooliseks ja ütles, et praegust tasu ei saa kinnitada; seega väljamõeldud kehtiva hinna asemel jäi küsimus lahendamata. Jätkutöö on vigase kohatsitaadi taastamine ja kohaliku allikapiiri eristamine kinnitatud elukohast, ilma omavalitsust teisele inimesele üle kandmata.
2. **Q2 · pöörduja arvuline piir.** Vastus tõstis 13-eurose tunnitasu piiri allikas olevast `suurem kui 801` kujule `ületab 800`. 700-eurose sissetuleku 6,50-eurone määr oli õige, lisatud teise astme piir mitte. Allikaviide S1 oli tehniliselt kehtiv; viiteskeem ei tuvasta sellist tähendusviga.
3. **Q3 · teenuseosutaja redaktsioonivõrdlus.** Vastus väitis, et „nüüd ka hooldaja“ saab taotleda. Hooldaja esineb nii 2025-09-01 kui ka 2026-10-06 redaktsioonis (§ 4 lg 2); muutus ametinimetus. Mõlema teksti olemasolu ei taganud korrektset muutuse järeldust.

[Sihtkriteeriumid ja käsitsi kinnitatud puudused](evidence/rag-audit-fixes-quality-2026-10-08.json). Rerank’i ja vastuse tekstide kärpimist, vigaste tsitaatide leebemaks muutmist ega väljundi vaikset parandamist ei kasutatud.

### Mõõdetud tokenid ja raha

Võrdlus algse vaikimisi vahemäluga baasvooruga. Viimase cache-kandidaadi (`ca5970f9`) eraldi võrdlus on masinloetavas tõendis; selle cache-poliitika ei ole siin aktiveeritud.

| Roll | Kogu sisend, enne → pärast | Allikavaliku sisend, enne → pärast | Allikavaliku sisendi USD, enne → pärast | Kogu USD, enne → pärast |
|---|---:|---:|---:|---:|
| Kõik 15 | 544657 → 572261 | 265285 → 277284 | 0.02910288 → 0.03065898 | 0.05842146 → 0.06345755 |
| Pöörduja (5) | 189618 → 201746 | 92181 → 92328 | 0.01152225 → 0.01154063 | 0.02222941 → 0.02397248 |
| Spetsialist (5) | 183120 → 190194 | 85666 → 93061 | 0.00871746 → 0.00963206 | 0.01883682 → 0.01960670 |
| Teenuseosutaja (5) | 171919 → 180321 | 87438 → 91895 | 0.00886317 → 0.00948631 | 0.01735523 → 0.01987837 |

Kogu sisend **+5.1%**, allikavaliku sisendi hind **+5.3%**, kogukulu **+8.6%**. Väljund 18244 → 18338 tokenit. Seega see on töökindluse ja juhiste paranduskandidaat, **mitte tõendatud sisendikulu vähendus**. Vahemälust loetud sisend 163347 → 149555 tokenit ja kirjutatud sisend 380051 → 419397; sama küsimusefail ei tähenda identset päringuplaani, tõendipaketti ega cache-olekut. Ühest mõõtmisest ei saa tuletada püsivat hinnatõusu ega -langust.

| Roll | Mediaan, enne → pärast | p95, enne → pärast |
|---|---:|---:|
| Kõik 15 | 26.06 → 26.02 s | 40.46 → 36.98 s |
| Pöörduja (5) | 29.07 → 35.21 s | 39.28 → 36.98 s |
| Spetsialist (5) | 32.56 → 24.41 s | 40.46 → 30.80 s |
| Teenuseosutaja (5) | 24.06 → 21.61 s | 25.95 → 27.06 s |

Aeg on salvestatud `timings.phases.answered`, mitte pelgalt esimese teksti saabumine. Väike valim, protsessi käivitamine, teenuse latentsus ja vahemälu mõjutavad tulemust; viie pöördumise rollirühma p95 on sisuliselt selle rühma aeglaseim vastus.

### Kulu ja tõendite terviklikkus

- `audit-fixes`: 0.059884855 USD; avaldatud 14/15.
- `audit-fixes-final`: 0.068948870 USD; avaldatud 15/15.
- `audit-fixes-role-last`: 0.070165405 USD; avaldatud 15/15.
- `audit-fixes-formal-rules`: 0.063457545 USD; avaldatud 15/15.

Selle parandustöö neli vooru: **0.262456675 USD**. Koos kõigi varasemate katsetega **0.629070650 USD / 1 USD**; jääk **0.370929350 USD**. Tundmatu kasutusega kutseid 0. Kõigi nelja vooru sünteetilised kasutajad eemaldati, rahakviitungid säilisid. Tasuta kontrollskript kinnitas 240 uut kviitungit ja 312 avaldatud viite tekstiräsi, korduspäring ei käivitanud uut mudelikutset.

[Lõppvooru vastused, seisud, kasutus ja hinnakviitungid](evidence/rag-audit-fixes-2026-10-08.json) · [enne/pärast mõõdikud](evidence/rag-audit-fixes-comparison-2026-10-08.json).

Kohalik kood ja tõendid on review jaoks valmis. Push, deploy ja cache-lüliti aktiveerimine: **not_run**. Tasuline katsetamine on lõpetatud; järgmine töö peaks lahendama Q1–Q3 põhjuslikult kohalike testide ja salvestatud juhtumitega, mitte otsima uut soodsamat juhuslikku mõõtevooru. Sisendikulu järgmine töö vajab sisendi struktuuri ja kohaliku kataloogivaliku analüüsi; siinsed katsed ei õigusta allikateksti kärpimist.
