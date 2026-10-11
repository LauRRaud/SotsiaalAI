# ADR-136: otsus, millega inimene ei nõustu, saab ka vaidlustamise korra ja tähtaja

Kuupäev: 10.10.2026. Teostus Claude Opus 5.5. Omanik 10.10.2026 õhtul: „tee test low ja medium luna“ sõnastusega „mis õigused mul on…“ ja seejärel „tee need parandused, mis välja tulid ka“. Seis: **kood ja testid tehtud; enne serverisse saatmist mõõdetud tasuliselt serveris (0,0451 USD).**

## Probleem

Küsimusele „Mis õigused mul on, kui vald keeldus mulle toimetulekutoetust maksmast?“ vastas Luna mõlemas mõtlemisrežiimis sisuliselt (vaie, halduskohus, keeldumise alused), kuid ütles ausalt, et vaide esitamise tähtaega tal ees ei ole. See on inimese jaoks kõige tähtsam arv: 30 päeva.

Põhjus pöörde kirjetest (sama küsimus kaks korda, 0,0072 USD): otsinguplaan kirjutas mõlemal korral päringud toetuse nimega („toimetulekutoetuse määramisest keeldumine vaide esitamine“). 36 lõigust, mida lõikude valik luges, ei olnud ükski haldusmenetluse seadusest, kus on vaide esitamise tähtaeg iga sellise otsuse kohta (§ 75). Säte on kogus olemas; otsing ei jõudnud selleni, sest see ei räägi toimetulekutoetusest.

## Otsus

**Otsinguplaani juhis saab ühe rea** (`PLAN_CHALLENGE_INSTRUCTIONS`, `rag-v2/search-assist-14`): kui küsimus on ametiasutuse otsusest, millega inimene ei nõustu (keeldumine, oodatust väiksem summa, tagasinõue, otsus, mis ei tule), jääb üks päring asja enda kohta ja lisandub üks päring selle kohta, kuidas sellist otsust vaidlustatakse, menetluse üldistes mõistetes ja ilma toetuse või teenuse nimeta: vaie, kuhu see esitatakse ja mis tähtajaks.

Rida ei nimeta ühtegi toetust, seadust ega asutust. See on sama liiki reegel nagu varasemad read hinna, kohustuse ja sobivuse kohta.

## Mõõdetud (tasuline, serveris veel saatmata koodiga, vaikimisi režiim)

Esimene sõnastus, kuus küsimust (0,0261 USD):

| Küsimus | Vaidlustamise päring | HMS § 75 vastuse ees | Vastus ütleb 30 päeva |
|---|---|---|---|
| Vald keeldus toimetulekutoetusest (1. kord) | jah | jah | jah |
| Sama (2. kord) | jah | jah | jah |
| Amet nõuab toetuse tagasi | jah | jah | jah |
| Vald ei ole kaks kuud vastanud | jah | jah | ütleb otsuse tähtaja (10 tööpäeva) ja vaide võimaluse |
| Ema ei saa kodus hakkama (otsust ei vaidlustata) | ei | ei | ei puutu asjasse |
| Hooldekodu kohatasu (otsust ei vaidlustata) | ei | ei | ei puutu asjasse |

Ühel korral kirjutas plaan ainult vaidlustamise päringu ja toetuse enda tingimused jäid vastusest välja. Rida täpsustati („jääb üks päring asja enda kohta ja lisandub üks…“) ja kontrolliti uuesti kolme küsimusega (0,0118 USD): kõigil kolmel on mõlemad päringud, sotsiaalhoolekande seaduse ja haldusmenetluse seaduse lõigud koos, ja vastus ütleb: „Vaie tuleb üldjuhul esitada 30 päeva jooksul päevast, mil said otsusest teada või oleksid pidanud teada saama (Haldusmenetluse seaduse § 71 lg 1; Haldusmenetluse seaduse § 75).“

Tasuta: kogu ühiktestide komplekt (arv saadetise kirjelduses); plaani teksti test hoiab, et ilma kaheteistkümne lisatud reata on tekst sama mis versioonil 5.

## Samas saadetises: mitu sätet abiotsija vastuses

Mõõdetud kolmes kontrollis: abiotsija vastus nimetab 4–10 sätet, kuigi rolli rida ütleb „tavaliselt üks kuni kolm“. Omanik 10.10.2026: „kui vähem sätteid on õigustatud, kui ei ole, siis ei pane.“ **Otsus: ei vähenda.** Kõik nimetatud sätted olid õiged (242 sätet viies kontrollis, mitte ükski alusetu), need seisavad sulgudes lause lõpus ega sega lugemist, ja omaniku sõnul on väärtus just selles, et vastus leiab õige seaduse ja paragrahvi. Juhise teksti ei muudeta ainult arvu pärast: iga juhise muudatus vajab tasulist kontrolli ja kasu kasutajale ei oleks.

## Kontrollimata

- Põhjalik režiim selle reaga (mõõdetud ainult vaikimisi režiim).
- Kas plaan lisab vaidlustamise päringu ka seal, kus inimene otsusega nõus on, aga mainib seda möödaminnes (kahes kontrollküsimuses ei lisanud).
- Halduskohtusse pöördumise tähtaeg: vastustes on see kord olemas, kord mitte.

## Täiendus samal õhtul: põhjalik režiim, päris vestlus ja halduskohtu tähtaeg

Omanik 10.10.2026 hilisõhtul: „tegutse“ kolme lahtise punkti kohta (lagi minult 0,10 USD, kulus 0,099 USD).

**Põhjalik režiim serveris oleva versiooniga (`search-assist-14`, 0,0153 USD):** kolm küsimust (keeldumine kaks korda, tagasinõue). Kõigil kolmel kirjutas plaan vaidlustamise päringu, haldusmenetluse seaduse § 75 jäi alles ja vastus ütles vaide esitamise tähtaja (30 päeva). Halduskohtu tähtaega ei öelnud ükski.

**Päris vestlus (omaniku konto, spetsialisti roll, kiire režiim):** „Mis õigused mul on, kui vald keeldus mulle toimetulekutoetust maksmast?“ → „Üldjuhul tuleb vaie esitada 30 päeva jooksul päevast, mil inimene otsusest teada sai või oleks pidanud teada saama (Haldusmenetluse seaduse § 75)“, lisaks vaide sisu (§ 76), lahendamise tähtaeg ja halduskohus (§ 87).

**Halduskohtu tähtaeg: kaks proovitud muudatust jäid saatmata.**

| Proovitud | Tulemus | Miks ei saadetud |
|---|---|---|
| Plaan kirjutab kolmanda päringu kohtusse pöördumise kohta (`search-assist-15`) | Halduskohtumenetluse seadustiku § 46 jäi alles 10 korral 14-st (serveris oleva versiooniga 1 korral 10-st) | Vaide tähtaeg (§ 75), mis on inimesele tähtsam, jäi alles ainult 9 korral 14-st; serveris oleva versiooniga 10 korral 10-st. Kolm päringut jagavad samu kandidaadikohti. |
| Vastuse juhisesse lause „samm, millel on tähtaeg, öeldakse koos tähtajaga“ (vestluse juhis 43) | Kohtu tähtaeg öeldi 4 vastuses 6-st vaidlustamise küsimusest | Üks vastus kaheksast lükati tagasi (`inline_answer_reference`: mudel kirjutas allikaviite sulgudesse sätte kõrvale). Samal päeval ei lükatud varem umbes sajast pöördest tagasi ühtegi. Tagasi lükatud vastus on halvem kui puuduv kohtu tähtaeg. |

Mõlema muudatuse kood on seansi tööfailides (`assist15-prompt43-not-shipped.patch`), mitte repos.

**Jääb lahti:** halduskohtusse pöördumise tähtaeg on vastuses kord olemas, kord mitte. Õigem tee on struktuurne: haldusmenetluse seaduse § 87 viitab halduskohtumenetluse seadustikule ilma paragrahvi numbrita, ja nimetatud aktide rada järgib praegu ainult numbriga viiteid. Kui valitud lõik nimetab teist seadust ilma numbrita, võiks rada tuua sellest seadusest lõigu, mis küsimusega kõige paremini sobib. See vajab eraldi kavandit ja mõõtmist.

## Täiendus 11.10.2026: struktuurne tee on mõõdetud ja ei pidanud vastu

Eelmise täienduse lõpus seisis mõte: kui valitud lõik nimetab teist seadust ilma paragrahvita (haldusmenetluse seaduse § 87: „halduskohtumenetluse seadustikus sätestatud tingimustel ja korras“), võiks nimetatud aktide rada tuua sellest seadusest küsimusega kõige paremini sobiva lõigu. Mõõtsin seda kolmel kujul. **Ükski ei toonud kohtu tähtaega kohale; midagi ei saadetud.** Kulu: 45 päringuvektorit kahe uue küsimustekataloogi jaoks (1146 tokenit, umbes 0,0002 USD), et salvestatud pöörete plaane saaks edaspidi tasuta uuesti läbi mängida. Mudelit ei kutsutud.

Mõõdupuu: kümme 10.10 tasulise kontrolli vaidlustamise pööret (küsimus ja plaani päringud nii, nagu need siis olid) ja kaks kontrollpööret, mängitud läbi otsingukontrolliga ([ADR-122](adr-122-free-search-gate.md)) korpusel v78 ja v79. Kataloog: `tests/evaluation/graph/decision-challenge-1.json`.

| Kuju | Mis mõõdeti | Tulemus |
|---|---|---|
| 1. Valitud lõik nimetab seadust (algne mõte) | 10.10 kümne pöörde kirjed | § 87 oli valitud lõikude seas 2 pöördel 10-st. Mõlemal olid nimetatud aktide kaks kohta juba täis numbriga viiteid. Oodatav kasu umbes üks pööre kümnest: ei ehitatud. |
| 2. Mis tahes kandidaat nimetab seadust, millel kandidaati ei ole; seaduse lähim lõik lisatakse kandidaatide lõppu | ehitatud, serveris kattekausta kaudu, 51 küsimust | Reegel käivitus 43 küsimusel 51-st ja tõi 73 lõiku, peaaegu kõik kõrvalised (puuetega inimeste sotsiaaltoetuste seadus neljateistkümnel korral, välismaalasele rahvusvahelise kaitse andmise seadus kuuel). Kümnest vaidlustamise plaanist ei toonud see halduskohtumenetluse seadustikku **ühelgi**. 33 kontrollküsimusest sai üks otsustava lõigu juurde (perekonnaseaduse § 97), ükski ei kadunud ega nihkunud. Otsingu aja mediaan 3811 → 4052 ms. |
| 3. Sama, aga nimetada võib ainult seaduse enda lõik | sama kood kitsendatult, 51 küsimust | Käivitus 32 küsimusel, tõi 52 lõiku, endiselt kõrvalised. Vaidlustamise plaanidest 0 kümnest; perekonnaseaduse § 97 võit kadus. |

**Miks.** Kontrollmõõtmine samade kümne plaaniga, serveris oleva koodiga:

- Seadus nimetab teist seadust ilma paragrahvita enamasti loetelus, mitte menetlusviitena („puuetega inimeste sotsiaaltoetuste seaduse alusel makstavad toetused“ sissetulekute loetelus). Kehtivas üleriigilises õiguses teeb seda 378 lõiku 6490-st.
- § 87 on 36 kandidaadi seas 3 plaanil 10-st, kohtadel 33–36. Mõni seaduselõik nimetab seadustikku 8 plaanil, aga need seisavad kandidaatide lõpus ja enne neid nimetavad teised kandidaadid teisi seadusi.
- Kui seadustiku seest otsida pöörde enda küsimuse ja päringutega, on lähim lõik tähtaja oma (§ 46 või § 47) ainult 2 plaanil 10-st; tavaliselt on see § 45 („Kaebeõiguse piirangud“) või § 42. § 46 on nelja lähima seas 9 plaanil.
- Ja isegi kui § 46 on tõendite seas, ütleb vastus kohtu tähtaja umbes pooltel kordadel (10.10 kolmanda päringu katse: 5 pööret 10-st).

Neli nõrka lüli järjest. Reeglit, mis neist läbi tuleks, saaks teha ainult selle ühe juhtumi järgi häälestades, ja müra (lisakandidaadid enamikul pööretel) jääks alles.

Ehitatud koodi (kuju 2 ja 3, koos testidega) plaaster ja kontrollmõõtmise tulemus on seansside märkmete kaustas (`court-deadline-mention-places-not-shipped-2026-10-11.patch`, `court-deadline-probe-2026-10-11.json`), mitte repos. Serveris: `rag-v2-work/w5/` (kataloogid, vektorid, mõõteskriptid `mention-diag.mjs` ja `probe-hkms.mjs`).

**Jääb lahti:** halduskohtusse pöördumise tähtaeg on vastuses kord olemas, kord mitte. Vaide tähtaeg, mis on inimese esimene samm, on vastuses iga kord. Proovimata teed, kumbki tasulise kontrolliga: üks juhendilõik, kus mõlemad tähtajad on koos (kohtu lehe „Halduskohtumenetlus“ ja Sotsiaalkindlustusameti „Vaide esitamine“ on kogus olemas ja 10.10 võttis üks vastus kohtu tähtaja ühelt sellistest lehtedest), või valiku juhis. Tasuta mõõdupuu on nüüd olemas: kataloog näitab, mitmel kümnest plaanist on seadustiku tähtajalõik kandidaatide seas (11.10.2026 korpusel v79: kahel).
