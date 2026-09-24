# M2.3 rubriigi v2 sisuline ülevaatus

Kuupäev: 05.09.2026. Ülevaataja: ChatGPT, roll **assistant**.

## Otsus ja piir

V2 alus jääb jõusse. Nõuete, JA-komplektide ja VÕI-alternatiivide eristus sobib jätkamiseks. Enne lõplikke inimkinnitusi on vaja allpool nimetatud piiritletud täpsustusi, mitte uut hindamistaristut ega uut otsingualgoritmi.

See on assistendi põhjendatud sisuline arvamus. See ei ole omaniku ega sõltumatu inimese kinnitus. `review-decisions.json` ei muudetud. Kõik ametlikud v2 staatused jäävad käesoleva töö tõttu muutmata; uusi kvaliteediprotsente ei arvutatud.

Üle vaadati kõigi 15 perekonna definitsioonid, 29 nõuet ja 34 tõenduskomplekti (40 allikaviite esinemist). Vaidlusaluseid vastendusi võrreldi `review.html` laiema algtekstikontekstiga. See ei ole kõigi 75 unikaalse konteksti ammendava inimülevaatuse kinnitus. Algsete PDF-ide kujundust ega kõigi kaheksa dokumendi tervikteksti siin uuesti ei kontrollitud.

GitHubi `main` lugemisel oli commit `3e13f3c2f078cfac9d7440f9f6848f2366e25ed8`. Loeti uue hindaja lähtekoodi asjakohast osa. Repositooriumi, otsingut ja serverit ei muudetud. Projekteeritud/rakenduse teste ega build'i ei käivitatud uuesti.

## Kontrollitud artefaktide kooskõla

Kohaliku HTML/JSON-parsimise tulemus:

- 15 perekonda, 29 nõuet, 34 komplekti; sisendis 29 `full` ja 5 `partial` ettepanekut. Need ei ole kinnitatud otsused.
- Mõlemas raportis 84 küsimuse/meetodi rida. Meetodita ülevaates 75 unikaalset perekonna/konteksti kirjet.
- V1 tulemusnimede ja salvestatud tokeniarvude võrdluses erinevusi 0.
- Kõigi 84 rea algteksti, pealkirja ja lehekülgede multihulk vastab seotud uue ülevaatekonteksti multihulgale; erinevusi 0.
- Rubriigi aatomite sisemises tekstiühenduses ja UTF-16 vahemikupikkustes erinevusi 0.

See kontroll ei arvutanud tokeneid uuesti ega tõenda täieliku masinpayload'i räsi või PDF-i originaaliga võrdsust. Maskeeritud vaade muudab tahtlikult allikajärjekorda; selle põhjal ei väideta otsingu algse järjekorra uut sõltumatut verifitseerimist. Koodi säilitusleping ja varasem kitsas diagnoos jäävad eraldi tõenditeks.

`needs_review=84` tähendab otsuste puudumist, mitte 84 ebaõnnestunud otsingut. Hindaja kood nõuab kehtiva otsuse jaoks päris omaniku või inimülevaataja kirjet. Minu arvamust ei tohi selleks ümber nimetada.

## Neli piiritletud täpsustust

### R1. Hoia soovitus, tingimus ja tulemus lahus

`human-relationship` ütleb praegu „AI pakub täiendavat tuge ja säilitab inimsuhted”. Selle allikakatkend ütleb „ei tohiks asendada” ja „peaks pakkuma”. Õige vastendus on soovitusliku piiri, mitte juba saavutatud tulemuse kohta.

Soovitatud tähendus: **Artikli järgi ei tohiks TI asendada inimsuhteid, vaid peaks pakkuma täiendavat tuge ja hoidma inimkeskset hoolduskeskkonda.**

`general-development` võiks samamoodi olla artikli tingimuslik väide: TI saab toetada sotsiaaltööd, kui arendus on läbipaistev, väärtuspõhine ja kaasav ning osalus hõlmab arendusotsuseid. Hooldusnäite kultuuriline sobivus ja teavitamine jäävad üldnõude suhtes osaliseks.

`cooperation-continuity` kasutab sõna „väldivad”. Algtekst rõhutab koostöö ja juhtumikorralduse olulisust, et inimene ei jääks toeta. Sellest ei saa teha mõõdetud mõju ega garanteeritud tulemuse väidet. Soovitatud tähendus: **Piloodikajastus rõhutab tervishoiu- ja sotsiaalvaldkonna tiheda koostöö ning juhtumikorralduse olulisust, et inimene ei jääks pärast haiglaravi vajaliku toe ja teenusteta.**

Olemasolevad allikakohad säilivad. Tegemist on kolme seotud tähendussõnastuse täpsustamisega.

### R2. 20 toetatud projekti tõend ei pea kohustuslikult sisaldama 52 taotlust

Küsimus küsib rahastatud projektide arvu, probleemirühmi ja mõõdetud tulemusi. See ei küsi esitatud taotluste arvu. Praegune `funded-count` ja selle ainus komplekt muudavad 52 taotluse teksti samuti kohustuslikuks.

Välistada tuleb taotluste ja rahastatud projektide segiajamine, mitte nõuda vastuses või tõendis kõiki seotud arve. Põhinõue: **Esimeses voorus otsustati rahastada 20 projekti / toetuse saanud projektide arv on 20.** 52 taotlust on täiendav kontekst.

`funded-not-applied` jääb sobivaks pikemaks tõendiks. Lisa selle kõrvale VÕI-alternatiiv EKA lk 5 tekstist „Toetust saanud 20 projektist ...”. See tekst on juba sama rubriigi `four-groups` komplektis olemas. Uut teadmist ega otsingukäivitust pole selle leidmiseks vaja.

Praegustes vektori- ja hübriidkontekstides on ka pikem arvu tõend olemas, mistõttu sellele täpsustusele ei omistata praeguse 84-rea skoori paranemist. Parandame lepingu sisu, mitte ei proovi tulemust rohelisemaks muuta.

`problem-groups` sõnastuses täpsusta „ravimeid” asemel „ravimivõtmise tuge” ja säilita varajase sekkumise roll. Nelja rühma koond on sobiv; need kirjeldavad eesmärke/teemasid, mitte mõõdetud tulemusi.

### R3. Tööandja küsimuses on rohkem kui üks osalise toe kandidaat

Lk 4 `page4-subject-and-aftercare` on minu hinnangul täielik tugi järeltoe nõudele: tööandja on nimetatud ning kirjeldatud on vajadusi, suhtlust, dokumenteerimist, õigusabi, kriisituge ja töötaja mitte üksi jätmist.

Lk 4 `page4-risk-and-subject` jääb praeguse üldise riskivastutuse nõude suhtes osaliseks. Esimene katkend räägib situatsioonilisest riskihindamisest; teises on tööandja otseselt nimetatud juhtumijärgse vastutuse kandjana. Neid ei tohi automaatselt ühendada kõigi üldiste ennetuskohustuste eksplitsiitseks väiteks.

Aga lk 3 tekst riskihindamise, juhtkonna toe, tegevusjuhiste ning juriidilise ja psühholoogilise abi kohta on samuti sisuline tugi, mitte pelk märksõnavaste. See esineb ka leksikaalse ja struktuuriraja tööandja-kontekstides, kuigi praegune rubriik ei paku sellele vastendust. Lisa ülevaatuseks kaks osalist vastendust (riskide korralduslik käsitlus ning institutsionaalne tugi); ära nimeta nende ridade sisu kinnitatud `absent`-iks pelgalt praeguse kaardi puudumise tõttu.

**Ära nõua täistoe jaoks samu kolme sõna, kui allikas kirjeldab samaväärseid tegevusi. Samas peab vastutaja seos olema tõendatud.** Uus funktsionaalne täisalternatiiv eeldab nõude ja tervikteksti eraldi hinnangut; käesolev arvamus ei tõsta lk 4 riskinõuet automaatselt `full`-iks.

Täis/osa jaotus ei ole puuduste peitmine: sama reegel peab kehtima kõigile neljale meetodile.

### R4. EKA lk 8 alternatiiv vajab täpset allikarolli

Laiemas ülevaatekontekstis asub `eka-page8` tekst „Loe lisaks” alas, teise loo „Heaoluteenuste digipööre algab koostööst: Tartus kohtusid osapooled” eelvaates.

Küsimus küsib EKA enda materjali, mistõttu EKA veebiteksti kitsas rollikirjeldus võib olla lubatav alternatiiv. Kuid seda ei tohiks kirjeldada sama põhiartikli uue põhitekstilõiguna, rakendussündmuse tõendina ega sõltumatu teise allikana. Märgi roll eraldi näiteks ülevaatuse põhjenduses `related_content_excerpt`; selleks ei pea kohe runtime-skeemi ümber ehitama.

EKA lk 3 põhiartikli alternatiiv ja Tehnopoli kohustuslik allikanõue säilivad. Vajaduse korral üle kahe tekstiosa ulatuva tõendi koondamist ei pea uues hindajas lisama: vaadatud `hasAtom()` kontrollib nõutud spanide olemasolu sama allika/versiooni kontekstide ühenduses.

## Kõigi perekondade ülevaatus

Järgmised on assistendi soovitused, mitte rakenduse kinnitatud otsused.

### `decision-boundary`

**Soovitus:** `retain`. Piiritle väide osalejapaketi ettevaatliku ametialase juhisena. See ei ole kõigi AI-süsteemide ega kehtiva õiguse üldreegel. Teenuse lõpetamise ja prioriteedijärjekorra tähendus peab säilima.

**`decision-scope`:** Üldine generatiivne AI ei soovita konkreetse inimese abivajaduse, toetuse, teenuse, lapse heaolu, riski, lõpetamise ega prioriteedi otsust.

| Tõenduskomplekt | Sisendi ettepanek | Assistendi sisuline hinnang |
| --- | --- | --- |
| `scope-with-list` | `full` | Allikas nimetab üldise generatiivse AI, konkreetse inimese ja otsuste loendi. Tugi on koolitusreeglile, mitte universaalsele õiguslikule keelule. |

**`substantive-human-control`:** AI võib hinnangut ankurdada; inimese formaalne lõppotsus ei piisa ning sisuline mõju vajab eraldi hinnangut.

| Tõenduskomplekt | Sisendi ettepanek | Assistendi sisuline hinnang |
| --- | --- | --- |
| `anchoring-and-assessment` | `full` | Ankurdamise küsimus koos sisulise mõju korral eraldi hindamise vajadusega toetab põhjendust. Säilita võib/tingimuslikkus. |

### `data-minimization-egress`

**Soovitus:** `retain`. Iga detaili vajalikkus ja konkreetse dokumendi välise edastamise õigus on eraldi nõuded. Andmeliigid, õiguslik alus ja lepingu katvus toetavad neid ainult osaliselt.

**`detail-necessity`:** Kontrollida iga detaili vajalikkust konkreetse ülesande jaoks.

| Tõenduskomplekt | Sisendi ettepanek | Assistendi sisuline hinnang |
| --- | --- | --- |
| `every-detail` | `full` | Iga detaili seos konkreetse ülesandega on otseselt küsitud. |
| `data-types-only` | `partial` | Andmeliikide vajadus on seotud, kuid kitsam kui iga detaili vajalikkuse kontroll. Partial on põhjendatud. |

**`transfer-permission`:** Kontrollida konkreetse dokumendi või sisu välise edastamise õigust, arvestades konfidentsiaalsust, lepingut ja autoriõigust.

| Tõenduskomplekt | Sisendi ettepanek | Assistendi sisuline hinnang |
| --- | --- | --- |
| `document-right-and-limits` | `full` | Dokumendi/sisu edastamise õigus ja konfidentsiaalsuse, lepingu ning autoriõiguse piirangud on samas allikakohas. |
| `general-law-contract` | `partial` | Töötlemisalus ja lepingu katvus ei ole üksinda sama mis konkreetse dokumendi välise saatmise õigus. Partial säilib. |

### `incident-response`

**Soovitus:** `retain`. Nõuded hõlmavad küsimuses küsitud esmast peatamist, kokkulepitud teavituskanalit ja minimaalset kirjeldust. Tühjad kontaktiväljad ei anna ühtki tegelikku nime või aadressi ega luba neid juurde luua.

**`stop`:** Peatada uute andmete sisestamine ja väljundi edasisaatmine.

| Tõenduskomplekt | Sisendi ettepanek | Assistendi sisuline hinnang |
| --- | --- | --- |
| `stop-both` | `full` | Peatamisjuhis hõlmab nii uute andmete sisestamist kui ka väljundi edasisaatmist. |

**`notify`:** Teatada viivitamata asutuse kokkulepitud kanalisse: juht, andmekaitse või infoturve/kasutajatugi.

| Tõenduskomplekt | Sisendi ettepanek | Assistendi sisuline hinnang |
| --- | --- | --- |
| `channel-and-roles` | `full` | Kokkulepitud kanal ja loetletud ametialased rollid on olemas. Tühjad väljad ei ole tegelikud kontaktid. |

**`minimum-record`:** Kirja panna tööriist/konto, aeg, andmete liik/maht ja avastamise järel tehtud tegevused.

| Tõenduskomplekt | Sisendi ettepanek | Assistendi sisuline hinnang |
| --- | --- | --- |
| `record-fields` | `full` | Tööriist/konto, aeg, andmete liik/ligikaudne maht ja avastamisjärgsed tegevused on kõik olemas. |

### `human-relationship-support`

**Soovitus:** `clarify_modality`. Muuda human-relationship kirjeldus soovituslikuks piiriks: artikli järgi ei tohiks TI asendada inimsuhteid, vaid peaks neid täiendama. Arenduse nõuet väljenda artikli tingimusliku väitena, mitte tõendina kõigi süsteemide tegelikust toimimisest.

**`human-relationship`:** AI pakub täiendavat tuge ja säilitab inimsuhted.

Pakutud täpsustus: Artikli järgi ei tohiks TI asendada inimsuhteid, vaid peaks pakkuma täiendavat tuge ja hoidma inimkeskset hoolduskeskkonda.

| Tõenduskomplekt | Sisendi ettepanek | Assistendi sisuline hinnang |
| --- | --- | --- |
| `relationship-limit` | `full` | Toetab soovituslikku piiri ei tohiks asendada / peaks täiendama; mitte faktilist väidet, et AI juba säilitab inimsuhted. |

**`general-development`:** Üldine arendusprotsess peab olema läbipaistev, väärtuspõhine ja kaasav, andes spetsialistidele ning kasutajatele sisulise osaluse arendusotsustes.

Pakutud täpsustus: Artikli kohaselt saab TI sotsiaaltööd toetada, kui arendusprotsess on läbipaistev, väärtuspõhine ja kaasav ning spetsialistid ja teenusekasutajad osalevad sisuliselt ka arendusotsustes.

| Tõenduskomplekt | Sisendi ettepanek | Assistendi sisuline hinnang |
| --- | --- | --- |
| `general-conclusion` | `full` | Üldised arenduspõhimõtted ja spetsialistide ning kasutajate sisuline osalus arendusotsustes on olemas. |
| `care-specific-participation` | `partial` | Hooldusnäite teavitamine, kasutajaosalus ja kultuuriline sobivus katavad vaid osa üldisest arendustingimusest. |

### `privacy-processing-basics`

**Soovitus:** `retain`. ESTA allika tundlike andmete kontekst ja kolm küsimust — miks, kuidas, missuguseid andmeid — on vajalikud. Teise allika üldine andmekaitsejutt ei täida automaatselt allikanõuet.

**`why-how-what`:** Tundlike isikuandmete puhul tuleb mõelda läbi miks, kuidas ja missuguseid andmeid töödeldakse.

| Tõenduskomplekt | Sisendi ettepanek | Assistendi sisuline hinnang |
| --- | --- | --- |
| `complete-processing-question` | `full` | Tundlike isikuandmete kontekst ning miks/kuidas/missugused on täielikult nähtavad. |

### `ethics-peer-discussion`

**Soovitus:** `retain`. Selguse saamine ja eetiliste küsimustega mitte üksi jäämine on seotud konkreetse julgustusega. Üldine meeskonnatugi ei ole sama põhjendus.

**`clarity-through-discussion`:** Kolleegidega avatud eetiline arutelu aitab saada selgust.

| Tõenduskomplekt | Sisendi ettepanek | Assistendi sisuline hinnang |
| --- | --- | --- |
| `discussion-clarity` | `full` | Avatud eetilise arutelu ja selguse seos on otsene. |

**`not-alone`:** Spetsialist ei peaks jääma eetiliste küsimustega üksi.

| Tõenduskomplekt | Sisendi ettepanek | Assistendi sisuline hinnang |
| --- | --- | --- |
| `ethics-not-alone` | `full` | Üksijäämise piir puudutab sama allika eetilisi küsimusi, mitte üksnes üldist heaolu. |

### `worker-violence-rate`

**Soovitus:** `retain`. 92,6% kuulub nimetatud küsitluse osalejatele ja kliendist lähtuvale vägivallale. See ei ole kõigi Eesti töötajate määr ega iga vägivallaliigi eraldi määr.

**`rate-population-event`:** 92,6% nimetatud uuringu küsitletud KOV sotsiaal- ja lastekaitsetöötajatest oli kogenud kliendist lähtuvat vägivalda.

| Tõenduskomplekt | Sisendi ettepanek | Assistendi sisuline hinnang |
| --- | --- | --- |
| `population-and-rate-and-event` | `full` | Sisaldab määra, valimi nimetust ja kliendist lähtuva vägivalla nähtust; säilita autoriviide uuringule. |

### `employer-worker-safety`

**Soovitus:** `retain_split_add_partial_candidates`. Lk 4 täielik tööandja järeltoe alternatiiv on põhjendatud. Riskivastutuse praegune lk 4 komplekt on sõnastatud üldnõude suhtes osaline. Lisada tuleb lk 3 institutsionaalse riski- ja toekäsitluse osalised alternatiivid. Lk 4 riskitee automaatset full-staatust ei soovita; funktsionaalse täisalternatiivi miinimum tuleb sõnastada eraldi, mitte nõuda lihtsalt kolme sama sõna.

**`employer-risk-role`:** Tööandjal on tööga seotud riskide hindamise, ennetamise ja maandamise vastutus.

| Tõenduskomplekt | Sisendi ettepanek | Assistendi sisuline hinnang |
| --- | --- | --- |
| `page5-explicit-employer` | `full` | Riskide hindamine, ennetamine ja maandamine on otseselt seotud tööandjaga. Tugi on artiklis avaldatud kommentaarile. |
| `page4-risk-and-subject` | `partial` | Situatsiooniline riskihindamine on olemas, kuid tööandja eksplitsiitne mainimine valitud teises aatomis puudutab sündmusejärgset vastutust. Praeguse üldnõude suhtes partial; automaatne täistugi ei ole põhjendatud. |

**`employer-aftercare`:** Pärast vägivalda ei jäeta töötajat üksi: tööandja korraldab vajalikud tegevussammud ja toe.

| Tõenduskomplekt | Sisendi ettepanek | Assistendi sisuline hinnang |
| --- | --- | --- |
| `page5-role-and-support` | `full` | Tööandja toe roll koos organisatsiooni/süsteemi toe ja mitteüksi jätmise väitega toetab üldist järeltoe nõuet. Ei nõua kõigi võimalike meetmete üksikasjalikku loendit. |
| `page4-subject-and-aftercare` | `full` | Otsene tööandja vastutus, töötaja vajadused, suhtlus, dokumenteerimine ning õigus-/kriisiabi moodustavad täieliku järeltoe alternatiivi. |

### `care-ethics-selfcare`

**Soovitus:** `retain`. Eetilise hoolduse teemad ja enesehoiu/meeskonnatoe teemad on allikaga kaetud. Koolituse teemaloend ei tõenda osalejate oskuste või hoolduse kvaliteedi tegelikku paranemist.

**`ethical-care`:** Käsitleti väärtusi, eetilisi dilemmasid, väärikust ja enesemääramist toetavat suhtlust.

| Tõenduskomplekt | Sisendi ettepanek | Assistendi sisuline hinnang |
| --- | --- | --- |
| `values-dilemmas-dignity` | `full` | Eetilised teemad, väärikus, enesemääramine ja lugupidav suhtlus on koolituse sisuna nähtavad. |

**`selfcare-team`:** Käsitleti emotsionaalset koormust, läbipõlemise ennetamist, enesehoidu ja meeskonna tuge.

| Tõenduskomplekt | Sisendi ettepanek | Assistendi sisuline hinnang |
| --- | --- | --- |
| `selfcare-with-team` | `full` | Emotsionaalne koormus, läbipõlemise ennetus, enesehoid ning meeskonnatugi on olemas. |

### `wellbeing-funding`

**Soovitus:** `retain`. Säilita etapp, kuni/alates ja minimaalne protsent. Tehnopoli salvestatud info ei kinnita praegu avatud vooru. Taotlustähtajad ja kogueelarve ei muutu selle küsimuse kohustuslikeks nõueteks.

**`first-stage-terms`:** Esimeses etapis kuni 30 000 eurot, omafinantseeringut ei nõuta.

| Tõenduskomplekt | Sisendi ettepanek | Assistendi sisuline hinnang |
| --- | --- | --- |
| `first-stage-complete` | `full` | Esimene etapp, kuni 30 000 eurot ja omafinantseeringu puudumine on seotud ühes tervikus. |

**`second-stage-terms`:** Teises etapis toetus alates 500 000 eurost, omafinantseering minimaalselt 12%.

| Tõenduskomplekt | Sisendi ettepanek | Assistendi sisuline hinnang |
| --- | --- | --- |
| `second-stage-complete` | `full` | Teine etapp, alates 500 000 eurost ja minimaalselt 12% on tervikuna olemas; summa algus ei jää välja. |

### `wellbeing-two-source-roles`

**Soovitus:** `retain_source_scope_annotate_related_card`. Tehnopoli elluviijate nõue jääb kohustuslikuks. EKA lk 3 toetab enda rolli; lk 8 alternatiiv paikneb nähtava väljavõtte järgi Loe lisaks alas. Viimane võib toetada kitsast EKA veebiteksti rolliväidet, kuid ei ole selle põhiartikli uus sõltumatu allikas.

**`tehnopol-implementers`:** Tehnopoli tekst nimetab elluviijatena Tehnopoli, Civitta ja Eesti Kunstiakadeemia.

| Tõenduskomplekt | Sisendi ettepanek | Assistendi sisuline hinnang |
| --- | --- | --- |
| `tehnopol-only` | `full` | Tehnopoli allikas seob elluviimise Tehnopoli, Civitta ja EKAga; teise allika sama nimekiri seda allikanõuet ei asenda. |

**`eka-role`:** EKA kirjeldab enda teenusedisaini ja kasutajavaate rolli.

| Tõenduskomplekt | Sisendi ettepanek | Assistendi sisuline hinnang |
| --- | --- | --- |
| `eka-page3` | `full` | Subjekt EKA ning teenusedisaini ja kasutajavaate roll on olemas. Aitab-sõnast kaugemat mõju ega tulemust ei ole selle lühikese aatomi alusel lubatud järeldada. |
| `eka-page8` | `full` | Kitsas EKA roll on öeldud ka seotud loo eelvaates. Hoida päritolu related_content_excerpt nähtavana; ei kinnita põhiartikli autorlust, ajastust ega sõltumatut lisatõendit. |

### `hospital-discharge-continuity`

**Soovitus:** `clarify_modality`. Erista piloodi eesmärk ja kajastatud õppetund mõõdetud tulemusest. Asenda koostöö väldib toe katkemist sõnastusega, et kajastus rõhutab koostöö ja juhtumikorralduse olulisust toe järjepidevuseks.

**`whole-patient-path`:** Patsiendi vajadustest lähtuv terviklik raviteekond.

| Tõenduskomplekt | Sisendi ettepanek | Assistendi sisuline hinnang |
| --- | --- | --- |
| `stroke-and-path` | `full` | Seob insuldijärgse piloodi patsiendikeskse tervikliku raviteekonna eesmärgiga, mitte tõestatud lõpptulemusega. |

**`cooperation-continuity`:** Tervishoiu ja sotsiaalvaldkonna koostöö ning juhtumikorraldus väldivad toe katkemist haiglast lahkudes.

Pakutud täpsustus: Piloodikajastus rõhutab tervishoiu- ja sotsiaalvaldkonna tiheda koostöö ning juhtumikorralduse olulisust, et inimene ei jääks pärast haiglaravi vajaliku toe ja teenusteta.

| Tõenduskomplekt | Sisendi ettepanek | Assistendi sisuline hinnang |
| --- | --- | --- |
| `cooperation-and-consequence` | `full` | Toetab koostöö ja juhtumikorralduse olulisust toe järjepidevuseks; ei tõenda mõõdetud kausaalset mõju ega garanteeritud tulemusi. |

### `worker-safety-author`

**Soovitus:** `retain`. Põhiartikli byline toetab Aljona Kõpu autorlust. Sama PDF-i kommentaaride autorid ei ole automaatselt põhiartikli kaasautorid. Metadata-alternatiivi sisuline alus on byline ja kontekst, mitte ainult parseri sõnavaste.

**`article-author`:** Põhiartikli autor on Aljona Kõpp.

| Tõenduskomplekt | Sisendi ettepanek | Assistendi sisuline hinnang |
| --- | --- | --- |
| `metadata-author` | `full` | Sobib alternatiiviks pärast byline ja põhiartikli identiteedi sisulist kontrolli. Pelk metadata väärtuste võrdsus ei loo autorluse tõendit. |
| `page1-author` | `full` | Autori nimi paikneb nähtavas põhiartikli alguses; kommentaaride autoreid ei lisata sama põhiväite alla. |

### `wellbeing-project-state`

**Soovitus:** `narrow_required_count_add_alternative`. Nõua 20 rahastamiseks valitud/toetust saanud projekti, mitte kohustuslikult ka 52 taotlust. Lisa sama allika Toetust saanud 20 projektist alternatiiv. Säilita neli probleemirühma ja mõõdetud tulemuste eraldi nõue. Raha eraldamise otsus ei tõenda mõju ega väljamakse teostamist.

**`funded-count`:** Rahastati 20 projekti, eristades neid 52 esitatud taotlusest.

Pakutud täpsustus: Programmi esimeses voorus otsustati rahastada 20 projekti / toetuse saanud projektide arv on 20. Seda ei tohi segi ajada taotluste arvuga; 52 esitatud taotluse eraldi nimetamine ei ole selle küsimuse kohustuslik osa.

| Tõenduskomplekt | Sisendi ettepanek | Assistendi sisuline hinnang |
| --- | --- | --- |
| `funded-not-applied` | `full` | See pikem tõendikomplekt on sobiv, kuid mitte ainus lubatav. 52 taotluse olemasolu ei peaks olema vajalik 20 toetatud projekti arvu tõendamiseks. |

**`problem-groups`:** Teemad hõlmavad eakate võimekust/taastumist, kroonilise haiguse jälgimist/ravimeid, andmepõhist kaughooldust ning üksildust.

Pakutud täpsustus: Teemarühmad hõlmavad eakate funktsionaalse võimekuse säilitamist ja taastumist, kroonilise haigusega inimeste kodust kaugmonitooringut ja ravimivõtmise tuge, andmepõhist kaughooldust ja varajast sekkumist ning üksilduse vähendamist.

| Tõenduskomplekt | Sisendi ettepanek | Assistendi sisuline hinnang |
| --- | --- | --- |
| `four-groups` | `full` | Kõik neli teemarühma on kaetud kahe lehega. Rühmade eesmärgid ei tõenda mõõdetud mõju. |
| `some-groups` | `partial` | Lk 6 katab kolm rühma, kuid mitte lk 5 eakate võimekuse/taastumise rühma; partial on põhjendatud. |

**`measured-results`:** Juba saavutatud mõõdetud mõju või tulemused.

Vastenduste loend on tühi. See ei tõenda korpuses puudumist. Ülevaadatud kontekstides nõutud tuge ei tuvastatud; kogu korpuse kinnitus jääb eraldi otsuseks.

### `current-home-service-cost`

**Soovitus:** `retain_scope_corpus_review_pending`. Küsimuses puudub vald; lisaks vajatakse selle valla kehtivat hinda ja tähtaega. Ülevaadatud kontekstides ei ole vastavat kohalikku tõendit. Terve korpuse puudumisotsust ei saa teha ainult tühja evidence_sets loendi alusel; koolituse väljamõeldud otsus ei ole kehtiv KOV alus.

**`local-cost`:** Kasutaja vallas 2026 kehtiv koduteenuse omaosaluse määr.

Vastenduste loend on tühi. See ei tõenda korpuses puudumist. Ülevaadatud kontekstides nõutud tuge ei tuvastatud; kogu korpuse kinnitus jääb eraldi otsuseks.

**`local-time`:** Sama valla koduteenuse määramise tähtaeg.

Vastenduste loend on tühi. See ei tõenda korpuses puudumist. Ülevaadatud kontekstides nõutud tuge ei tuvastatud; kogu korpuse kinnitus jääb eraldi otsuseks.

## Kuidas see voor lõpetada

1. Codex rakendab ainult kinnitatud rubriigi sõnastus- ja vastendusmuudatused. Algtekst, v1 tulemused, otsinguparameetrid ja server jäävad muutmata. Uued locatori ettepanekud lahendatakse kanoonilisest snapshot'ist, mitte ei mõelda span-ID-sid välja.
2. Tegelik omanik või inimülevaataja kinnitab vastuvõetud definitsioonid ja vastendused olemasolevas otsuseformaadis. See assistendi arvamus on otsuse alusmaterjal, mitte allkiri. Ülejäänud selgeid otsuseid ei pea ühe lahtise perekonna tõttu tühistama.
3. Lõpeta olemasoleva lepingu järgi korpuse ja 75 unikaalse konteksti ülevaatus. Sama perekonna ja sama tõendusmaterjali otsust pole vaja eri meetodinime tõttu uuesti sisestada. Ära märgi ammendavat ülevaatust tehtuks ilma tegeliku lugemiseta.
4. Käivita võrguta kordushindamine. Raporteeri nõuete katvus, osaline tugi, puuduv tugi, vastuolud ja ootel otsused. Projektide arvu/teemade leidmine ei täida mõõdetud tulemuse nõuet; KOV-küsimuse puuduva valla täpsustamine ei loo korpusesse teenusreegleid.
5. Alles selle järel vali üks diagnoosiga põhjendatud otsinguparandus. Tervet M2.3 plokki ega kitsast diagnoosi uuesti ei avata; uus hübriidkaal või dokumendikvoot pole selle arvamusega heaks kiidetud.

## Kaasas olevad failid

- `ASSISTENDI_RUBRIIK_V2_ARVAMUS.json`: 29 nõude ja 34 komplekti läbivaatamise masinloetav arvamus, input-räsid ja piiritletud muutmisettepanekud. **Ei vasta ega asenda** `rag-v2/review-decisions-2` vormingut.
- `ARTEFAKTIDE_KOOSKOLA_KONTROLL.json`: tegelikult tehtud kohalikud failikontrollid ja nende ulatus.

Selles voorus ei tehtud väliste embedding- ega genereerimisteenuste kutseid, otsingupäringuid, indekseerimist, Git-kirjutusi või serverimuudatusi. GitHubi kasutati olemasoleva koodi lugemiseks.

## Viitealus

- `rubric-v2.json`, versioon `2.0-proposal-1`: iga eespool nimetatud perekonna/nõude/komplekti allikakohad; failiräsi kontrollide JSON-is.
- `review.html`: küsimused, täpsed salvestatud tekstikatkendid ning allika identiteet; eriti safety lk 3–5 ja EKA lk 5–8.
- `report.html` ja varasem `multi-source-v1-report.html`: kõik 84 rea tulemusnimed, salvestatud tokeniarvud ja nähtavad kontekstitekstid.
- GitHub `LauRRaud/SotsiaalAI`, commit `3e13f3c2f078cfac9d7440f9f6848f2366e25ed8`, `lib/rag-v2/evaluation/rubric-v2.js`: `hasAtom()`, `receipt()` ja `makeReviewPacket()`.

Allikad kirjeldavad valitud dokumentide sisu. Siin ei kontrollitud nende väidete tänast õiguslikku, meditsiinilist ega empiirilist kehtivust väljaspool antud korpust.
