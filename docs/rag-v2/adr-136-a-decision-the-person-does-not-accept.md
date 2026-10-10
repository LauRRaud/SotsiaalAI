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
