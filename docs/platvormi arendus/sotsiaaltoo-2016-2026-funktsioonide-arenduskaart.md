# Sotsiaaltöö 2016–2026 funktsioonide arenduskaart

Koostatud: 24.08.2026
Ulatus: `SotsiaalAI.md` S4 artiklivõrdlusest sündinud 12 tootetõlget
Tõendipiir: staatiline koodi- ja dokumendikaart; `runtime: not_run`

See fail selgitab funktsioonide omavahelisi seoseid ja lepingute arhitektuuri. Ta **ei kanna
elavat teostusseisu**. Olek, järgmine töö ja aktiveerimisväravad elavad ainult
[`SotsiaalAI.md`](./SotsiaalAI.md)-s; vastuolu korral võidab `SotsiaalAI.md`.

## 1. Mida võrreldi

Alus on ajakirja `Sotsiaaltöö` 2016–2025 täiskümnendi ja 2026. aasta kahe esimese numbri
allikapõhine süntees. Artiklid annavad vajaduse või probleemi; funktsiooninimed ja tehniline
lahendus on SotsiaalAI tootetõlge. Võrdluses kontrolliti:

- milline SotsiaalAI võimekus juba täidab sama kasutajaeesmärki;
- milline osa on koodis, kuid peidetud, partneri taga või muul viisil pooleli;
- milline osa on nimelise funktsioonina koodis 0 rida;
- millist olemasolevat andmemudelit ja töövoogu peab uus funktsioon taaskasutama;
- milline arendusleping on funktsiooni üks kanooniline kodu.

`TEHTUD`, `POOLIK` ja `TEGEMATA` hinnangud jäävad `SotsiaalAI.md`-sse. Siinsed sõnad
*olemasolev alus*, *nimeline funktsioon 0* ja *partnerivärav* kirjeldavad sobivust, mitte uut
konkureerivat staatust.

## 2. Üks funktsioon — üks lepinguline kodu

`ST10-*` on selle 12-lepingulise funktsioonikaardi ID-perekond, mitte uus `Txx` masterteema
ega `XXX-Pn` teostuspakett. Teostuspaketid nimetatakse alles konkreetse lepingu väljastamisel.

| ID | Funktsioon | Lepingu liik ja kanooniline fail | Olemasolev alus | Päriselt puudu |
|---|---|---|---|---|
| ST10-01 | Minu muutuse kompass | laiendusleping [`minu-muutuse-kompass-v1-arendusleping.md`](./minu-muutuse-kompass-v1-arendusleping.md) | Teekond LIVE; refleksiooni `clientGoal`/`clientReaction`/`interimOutcome`; Teenuspäeviku eesmärk, edenemine ja kliendi kuu digikinnitus | inimese omandis terviklik algseis–muutus–vahehindamine, parandusrada ja valikuline jagamine |
| ST10-02 | Ühine tegevusplaan ja üleandmisahel | tervikleping [`uhine-tegevusplaan-ja-uleandmisahel-v1-arendusleping.md`](./uhine-tegevusplaan-ja-uleandmisahel-v1-arendusleping.md) | JTA, NetworkShare, ruumid, org assignment ja kiire abi handover | üks eesmärk–tegevus–vastutaja–tähtaeg–vastuvõtt–tulemus kandja |
| ST10-03 | Toetuspaketi koostaja | uus tööriist [`toetuspaketi-koostaja-v1-arendusleping.md`](./toetuspaketi-koostaja-v1-arendusleping.md) | eluvaldkonnad, Teekond, Teenusekaart; ServiceReferral teenuse/eesmärgi/ühiku/mahu/perioodi ning teenuseprofiili hinnakirjelduse väljad | paketi koondkandja, eelarveraam ja eesmärgi–komponendi–järelhindamise tervik |
| ST10-04 | Ühine abiplaan hooldaja paralleelvaatega | ST10-02 laiendus [`uhine-abiplaan-hooldaja-paralleelvaatega-v1-arendusleping.md`](./uhine-abiplaan-hooldaja-paralleelvaatega-v1-arendusleping.md) | ühise plaani doonorid | hooldaja enda eraldiseisev eesmärk, nõusolek, nähtavus ja tugi; nimeline Omastehooldaja ruum on 0 |
| ST10-05 | Kriisiteekond | SOTSIAALKIIRABI-V1 delta/integratsioon [`kriisiteekond-v1-arendusleping.md`](./kriisiteekond-v1-arendusleping.md) | laua readiness/availability, take/resolve, handover+accept ja urgent→eelpöördumise mustand on koodis ning peidus; ruumid ja hääl | päris partnermehitus, abistatud kanal, kokkulepitud järelkontakt ja inimese kinnitatud Journey-jätk |
| ST10-06 | Vabatahtlik Märkamise ring | uus tööriist [`markamise-ring-v1-arendusleping.md`](./markamise-ring-v1-arendusleping.md) | võrgustik, teavitused ja outbox | inimese valitud check-in, nõustunud usaldusisik ja inimlik järelkontakt; nimeline funktsioon 0 |
| ST10-07 | Abiteekonna pass | uus ekspordi-/üleandmistööriist [`abiteekonna-pass-v1-arendusleping.md`](./abiteekonna-pass-v1-arendusleping.md) | Teekonna eksport, eelpöördumise allowlist-handoff ja päritolu | minimaalne versioonitud pass, RFK/keele/ligipääsetavuse teadlik valik ja vastuvõtukinnitus |
| ST10-08 | Inimkontrolliga STAR2 üleandmispakett | olemasolev kanooniline [`jta-v1-arendusleping.md`](./jta-v1-arendusleping.md), L5/L8/L9/L16 ja E5–E6 | „Kopeeri STAR2 jaoks”, päritolu, kopeerimis- ja ülekandeajalugu on koodis | ametlik SKA/TEHIK otseliides on eraldi tulevikufunktsioon ja partnerivärav, mitte selle lepingu vaikne jätk |
| ST10-09 | „Üks kord kirjeldatud vajaduse” üleandmine | laiendusleping [`uks-kord-kirjeldatud-vajaduse-uleandmine-v1-arendusleping.md`](./uks-kord-kirjeldatud-vajaduse-uleandmine-v1-arendusleping.md) | Teekond→eelpöördumine, külmutatud NetworkShare, org handoff | eesmärgipõhine minimaalne asutusteülene pakett, uus nõusolek igale saajale ja vastuvõtukinnitus |
| ST10-10 | AI vastutusmärge | platvormiülene laiendusleping [`ai-vastutusmarge-v1-arendusleping.md`](./ai-vastutusmarge-v1-arendusleping.md) | allikad, päritolu, privaatsuse eelkiht, allikatagasiside ning Tööheaolu `ContentTrustBadge`/`getContentTrustState` | platvormiülene katvus ning evidence/värskuse/ebakindluse/vaidlustuse ühine wrapper |
| ST10-11 | Turvajuhtumi tervikvoog | uus organisatsiooniülene tervik [`turvajuhtumi-tervikvoog-v1-arendusleping.md`](./turvajuhtumi-tervikvoog-v1-arendusleping.md) | välitöö check-in, töövägivalla voog, manager/safety saajaga WellbeingSupportShare, summutatud koondid ja professionaalne tugi | ametlik turvateade, juhi vastuvõtt, järelabi ja privaatsusturvaline õppetsükkel ühe tervikuna |
| ST10-12 | Sotsiaaltöö arengukaart | RAG-i tootekiht [`sotsiaaltoo-arengukaart-v1-arendusleping.md`](./sotsiaaltoo-arengukaart-v1-arendusleping.md) | ajakirjakorpus, aasta-meta, allikapaneel ning evidence-paketi temporal coverage/by-year/limitations/trendi mittetuletamise alus | kontrollitud arenguetapi/tõendiliigi metaandmed ja ajajoone kasutajafunktsioon |

## 3. Kõige olulisemad sobitusotsused

### 3.1. Üks jagatud tegevusplaani kandja

ST10-02, ST10-04 ja ST10-09 ei tohi tekitada kolme plaanitabelit. Neil on üks ühine
versioonitud kandja: eesmärk, tegevus, vastutaja, tähtaeg, päritolu, nähtavus, vastuvõtt ja
tulemus. Hooldaja paralleelvaade lisab eraldi eesmärgi- ja nõusolekukonteksti; asutusteülene
üleandmine lisab eesmärgipõhise külmutatud paketi. Mõlemad kasutavad sama kandjat ja rangemat
projektsiooni.

### 3.2. Eksport ei ole elava teekonna jagamine

Abiteekonna pass, STAR2 kopeerimine ja asutusteülene vajaduse üleandmine on kolm eri tegu:

1. inimene koostab enda valitud väljadega kaasaskantava passi;
2. spetsialist kopeerib ainult STAR2-sse kantava töömustandi ja märgib hiljem eraldi ülekande;
3. inimene kinnitab konkreetse eesmärgi ja saaja jaoks minimaalse külmutatud paketi.

Ükski neist ei anna saajale vaikimisi ligipääsu kogu Teekonnale ega loo ametliku registri
paralleelkoopiat.

ST10-07 omab ainult ST10-07 ja ST10-09 jagatud serveripoolset minimaalse snapshot'i
projektsioonikihti. ST10-09 kitsendab seda saaja capability ja eesmärgi järgi ega loo teist
projektorit. ST10-08 jääb tervikuna JTA L5/L8/L9/L16 ning E5–E6 projektsiooniks; seda ei
refaktoreerita ST10-07 sisse ega dubleerita.

### 3.3. Kriisi- ja märkamisrada vajavad päris inimest

Kriisiteekond ja Märkamise ring ei lähe aktiveerimisele pelgalt koodi valmimisega. Esimesel
peab olema mehitatud vastuvõtulaud ja lepinguline järeltoe vastutus; teisel nõustunud
usaldusisik või partner, kes mõistab oma rolli. Kui päris vastuvõtjat pole, on rada
fail-closed.

### 3.4. AI märge on läbiv, mitte uus register

AI vastutusmärge peab laienema vestlusele, dokumendimustandile, juhtumitöö mustandile,
kokkuvõttele, uurimusele ja kõigile tulevastele AI väljunditele ühe katvusmanifesti kaudu.
See ei vaja uut sisuregistrit; ta vajab ühist esitluslepingut, olekuid ja inimese kinnitamise
piiri.

## 4. Mis on täna kõige rohkem pooleli

1. **Koos töötamise selgroog.** JTA ja jagamise osad on tugevad, kuid ühine tegevusplaan ning
   vastuvõtu- ja järeltegevusahel pole üks tervik. See avab korraga ST10-02, ST10-04 ja ST10-09.
2. **Inimese tulemuse nähtavus.** Teekond töötab, kuid Minu muutuse kompass, sekkumispäevik,
   vahehindamine ja kliendi tagasiside pole üheks tulemuste kihiks seotud.
3. **Kiire abi järelhoid.** Abipalve tehniline voog on koodis, kuid partner, mehitus,
   abistatud kasutus ja järelkontakt on puudu.
4. **Turvaline minimaalne üleandmine.** Olemasolev üldeksport ei ole Abiteekonna pass; pass
   vajab eraldi allowlist'i, versiooni, kehtivust ja saaja kinnitust.
5. **Organisatsiooni vastutus töötaja turvalisuse eest.** Individuaalsed toe- ja ohutusvahendid
   on olemas, aga juhi vastuvõtu ja järelabi tervik ei ole.
6. **Ajakirjakorpuse arengutõend.** Aasta on metaandmetes, kuid arenguetapp, tõendiliik,
   sihtrühm, piirkond ja piirang pole kontrollitud kujul otsitavad ega ajajoonena kuvatavad.

## 5. Soovitatud arendusjärjekord

| Laine | Funktsioonid | Põhjus |
|---|---|---|
| 0 — lepitamine | ST10-10 AI vastutusmärge; ST10-01 Minu muutuse kompassi esimene viil; ST10-08 JTA täppisviide | kasutab olemasolevat alust, teeb inimese kontrolli nähtavaks ja ei vaja välispartnerit |
| 1 — ühine kandja | ST10-02 ühine tegevusplaan → ST10-04 hooldaja vaade | kaks funktsiooni sõltuvad ühest mudelist; kandja tuleb ehitada üks kord |
| 2 — kontrollitud väljavõtted | ST10-07 Abiteekonna pass → ST10-09 vajaduse üleandmine → ST10-03 Toetuspaketi koostaja | pass loob ühise minimaalse projektsiooni; asutusteülene rada kitsendab seda saaja capability järgi; Toetuspakett lisab eelarvepiiri |
| 3 — partneri- ja vastutusrajad | ST10-05 Kriisiteekond; ST10-06 Märkamise ring; ST10-11 Turvajuhtumi tervikvoog | vajavad päris vastuvõtjat, eetika-/õigusanalüüsi või organisatsioonipilooti |
| 4 — teadmustoode | ST10-12 Sotsiaaltöö arengukaart | esmalt metaandmete audit, seejärel üks allikatega tõendatud vertikaal |

Järjekord on soovitus, mitte omaniku eest tehtud prioriteediotsus. Ühe laine funktsioonid ei
lähe automaatselt paralleelarendusse, kui nad puudutavad sama skeemi, jagamispiiri või
privaatsusprojektsiooni.

## 6. Kõigi lepingute ühine tõendus- ja töökorraldus

- Rakendustöö tehakse eraldi puhtas tööpuus; määrdunud integratsioonipuud ei kasutata
  funktsiooni ehitamiseks.
- Automaatset testi-, contract-, probe-, smoke- ega E2E-kihti ei looda ega käivitata.
- Iga etapi järel tehakse ainult asjakohane staatiline kontroll: muudetud koodi lint,
  `git diff --check`, tõlgete muutumisel `i18n:check`, skeemi/migratsiooni korral
  `prisma validate`; peatüki lõpus üks tootmisbuild.
- Käitumine tõendatakse vajadusel olemasolevas lokaalses keskkonnas käsitsi sünteetiliste
  identiteetidega. Kontrollimata rada jääb `NOT_PROVEN` või `runtime: not_run`.
- Päris partner, e-kiri, makse, tootmisandmed, merge/integratsioon, push ja deploy vajavad
  eraldi omaniku luba.
- Lepingu valmimine ei tähenda funktsiooni valmimist. Teostusseisu muudab ainult
  `SotsiaalAI.md`-sse lisatud kontrollitud koond.

## 7. Kõrvalfunktsioonid, mis ei kuulu `ST10-*` numbrijadasse

28.08.2026 ametialasest ja eetika arutelust sündis kaks lepingut, mis seostuvad selle
arenduskaardiga, kuid ei pärine 2016–2026 artiklivõrdluse 12 funktsiooni registrist:

- **Ametialane teejuht** —
  [`ametialane-teejuht-v1-arendusleping.md`](./ametialane-teejuht-v1-arendusleping.md):
  allikapõhine vastus ameti nõude, hea tava, teadmata osa, pädevuspiiri ja siduva vastuse
  kanali kohta;
- **Eetilise juhtumiarutelu ruum** —
  [`eetilise-juhtumiarutelu-ruum-v1-arendusleping.md`](./eetilise-juhtumiarutelu-ruum-v1-arendusleping.md):
  privaatne refleksioon, kasutaja kinnitatud deidentifitseeritud Kovisiooni mustand ja
  eraldi kinnitatud eetilise nõustamise kanal.

Neile ei anta tagantjärele `ST10-13` ega `ST10-14` ID-d, sest see muudaks 12 funktsiooni
artiklipõhise komplekti päritolu ebatäpseks. Nende elav seis ja järgmine ühik on ainult
[`SotsiaalAI.md`](./SotsiaalAI.md)-s; käesolev fail hoiab üksnes arhitektuurset seost.
