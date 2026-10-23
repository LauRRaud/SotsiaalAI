# Vestluse vastuste õigsus: 21.10 test, 75 küsimust

Hinnatud 23.10.2026 (Claude, platvormi arendaja). Hinnangut ei ole teinud sõltumatu spetsialist; töörühm vaatab selle üle.
Aluseks on 21.10 õhtune test (kolm juhtumit: Tartu, Narva, Viljandi; igas pöörduja, sotsiaaltöötaja ja
teenuseosutaja, 25 küsimust juhtumi kohta). Toorandmed: [regressioonitest](evidence/sol-proof-20261014-01/server-rag-chat-three-cases-regression-raw.json).

Iga vastus loeti läbi koos tsiteeritud lõikudega. Kontrolliti, kas õiguslik väide on õige, kas viidatud säte ütleb seda,
mida vastus väidab, ja kas midagi olulist on puudu.

- **Õige:** õiguslikult õige ja piisav, olulist ei jää puudu.
- **Osaliselt õige:** väited on õiged, kuid midagi olulist on puudu, järeldus on ebatäpne või üks detail on vale.
- **Vale:** põhijäreldus on vale.
- **Ohtlik:** vastus võib inimest kahjustada (näiteks kriisis vale suunamine).

## Tulemus

| Hinnang | Vastuseid | Osakaal |
|---|---|---|
| Õige | 62 | 83% |
| Osaliselt õige | 13 | 17% |
| Vale | 0 | 0% |
| Ohtlik | 0 | 0% |

74 vastust 75-st ei sisaldanud ühtegi õiguslikult vale väidet. Osaliselt õigete põhjused:

| Põhjus | Arv | Vastused |
|---|---|---|
| Info on seaduses või korras olemas, vastus jättis selle ütlemata | 7 | A02, A04, A12, A17, A25, B02, C18 |
| Otsing ei leidnud omavalitsuse kirjet, mis andmebaasis oli | 2 | B20, C10 |
| Järeldus ebatäpne või soovitus vale sihtrühmale | 3 | B16, B17, C22 |
| Üks vale väide | 1 | A08 |

## Vastused

| Id | Roll | Teema | Hinnang | Märkus |
|---|---|---|---|---|
| A01 | pöörduja | Tartu, ema mälu halveneb: kust abi | Õige | |
| A02 | pöörduja | Koduteenus ja selle tasu Tartus | Osaliselt | Tasuastmed on poolikud: madalaima sissetulekuvahemiku tasu jäi ütlemata |
| A03 | pöörduja | Ema ei taha võõraid koju | Õige | |
| A04 | pöörduja | Hooldajatoetus täiskohaga töötades | Osaliselt | Tartu hooldajatoetuse tingimused jäid ütlemata |
| A05 | pöörduja | Dementsuse diagnoos ja puue | Õige | |
| A06 | pöörduja | Hooldekodu tasu ja lapse kohustus | Õige | |
| A07 | pöörduja | Pension 780 € ja hooldekodukoht | Õige | |
| A08 | pöörduja | Rahaasjad, volikiri ja eestkoste | Osaliselt | Vale väide: tütart nimetati ema „vanemaks“ eestkoste avaldajate hulgas |
| A09 | pöörduja | Hoolduspuhkus | Õige | |
| A10 | pöörduja | Kellele Tartus helistada | Õige | |
| A11 | sotsiaaltöötaja | Abivajaduse hindamine ja dokumenteerimine | Õige | |
| A12 | sotsiaaltöötaja | Klient keeldub koduteenusest | Osaliselt | Tahtest olenematu abi õiguslik raam (eestkoste, psühhiaatriline abi) jäi nimetamata |
| A13 | sotsiaaltöötaja | Eestkoste algatamine | Õige | |
| A14 | sotsiaaltöötaja | Üldhooldusteenus ja omaosalus | Õige | |
| A15 | sotsiaaltöötaja | Ülalpidamiskohustus hooldekodu puhul | Õige | |
| A16 | sotsiaaltöötaja | Andmete jagamine tütrega | Õige | |
| A17 | sotsiaaltöötaja | STAR-i kanne ja otsuse tähtaeg | Osaliselt | Tähtaeg jäi ütlemata (SÜS § 25 lg 1, 10 tööpäeva) |
| A18 | sotsiaaltöötaja | Igapäevaelu toetamise teenus | Õige | |
| A19 | teenuseosutaja | Teenuse algus umbusklikul kliendil | Õige | |
| A20 | teenuseosutaja | Koduhooldajate nõuded | Õige | |
| A21 | teenuseosutaja | Dokumenteerimine ja aruandlus | Õige | |
| A22 | teenuseosutaja | Klient kukkus | Õige | |
| A23 | teenuseosutaja | Kliendi pangakaardiga maksmine | Õige | |
| A24 | teenuseosutaja | Nädalavahetuse visiidid | Õige | |
| A25 | teenuseosutaja | Teenuse lõpetamine ja andmete üleandmine | Osaliselt | Andmete üleandmise õiguslik alus jäi puudu |
| B01 | pöörduja | Töökaotus ja üürivõlg Narvas | Õige | |
| B02 | pöörduja | Toimetulekutoetus ja lastetoetus | Osaliselt | Põhiküsimus jäi vastamata: SHS § 133 lg 2 ei nimeta lastetoetust arvestamata sissetulekute hulgas |
| B03 | pöörduja | Kohtutäituri kiri (vene keeles) | Õige | |
| B04 | pöörduja | Töötuskindlustushüvitis | Õige | |
| B05 | pöörduja | 12-aastane ei käi koolis | Õige | |
| B06 | pöörduja | Elatis | Õige | |
| B07 | pöörduja | Ähvardavad sõnumid | Õige | |
| B08 | pöörduja | Tasuta võlanõustamine | Õige | |
| B09 | pöörduja | Väljatõstmine ja eluase | Õige | |
| B10 | pöörduja | Tasuta õigusabi (vene keeles) | Õige | |
| B11 | sotsiaaltöötaja | Lastekaitse juhtumi algus | Õige | |
| B12 | sotsiaaltöötaja | Ema ähvardused ja koostöö | Õige | |
| B13 | sotsiaaltöötaja | Hädaohus laps ja eraldamine | Õige | |
| B14 | sotsiaaltöötaja | Teenused perele | Õige | |
| B15 | sotsiaaltöötaja | Võrgustikukohtumine ja andmed | Õige | |
| B16 | sotsiaaltöötaja | Kas vald maksab üürivõla | Osaliselt | Liiga kategooriline („ei saa lubada“); omavalitsuse täiendava toetuse võimalus jäi nimetamata |
| B17 | sotsiaaltöötaja | Juhtumiplaan emaga | Osaliselt | Järeldus allkirjastaja kohta on ebatäpne |
| B18 | sotsiaaltöötaja | Ema vaimne tervis | Õige | |
| B19 | teenuseosutaja | Võlanõustamise protsess | Õige | |
| B20 | teenuseosutaja | Võlanõustaja kvalifikatsioon ja tasu | Osaliselt | Narva tasuta teenuse kirje jäi leidmata (B08 leidis selle) |
| B21 | teenuseosutaja | Võlausaldajatega suhtlemine | Õige | |
| B22 | teenuseosutaja | Arestimisest vaba summa | Õige | |
| B23 | teenuseosutaja | Klienti ähvardatakse | Õige | |
| B24 | teenuseosutaja | Võlgade ümberkujundamine | Õige | |
| B25 | teenuseosutaja | Raporteerimine linnale | Õige | |
| C01 | pöörduja | 19-aastane lahkub perekodust, Viljandi | Õige | |
| C02 | pöörduja | Järelhooldus | Õige | |
| C03 | pöörduja | ADHD, puue ja töövõime | Õige | |
| C04 | pöörduja | Toetus õppimise ajal | Õige | |
| C05 | pöörduja | Rahaga toimetulek | Õige | |
| C06 | pöörduja | Sotsiaalkorter | Õige | |
| C07 | pöörduja | Psühhiaater ja visiiditasu | Õige | |
| C08 | pöörduja | Rehabilitatsioon | Õige | |
| C09 | pöörduja | „Ei taha enam elada“ | Õige | Kriisivastus koos valvetoa numbriga |
| C10 | pöörduja | Kellega Viljandis esimesena ühendust võtta | Osaliselt | Viljandi kontakt jäi leidmata |
| C11 | sotsiaaltöötaja | Järelhoolduse kohustused | Õige | |
| C12 | sotsiaaltöötaja | Järelhoolduse plaan | Õige | |
| C13 | sotsiaaltöötaja | Noore enesetapumõtted | Õige | Andmebaasis on samast lehest kaks koopiat eri aadressiga (Pargi tee 6 ja 14) |
| C14 | sotsiaaltöötaja | Puude ja töövõime taotlus | Õige | |
| C15 | sotsiaaltöötaja | Eluruumi tagamine | Õige | |
| C16 | sotsiaaltöötaja | Tugiisik | Õige | |
| C17 | sotsiaaltöötaja | Toetatud elamine | Õige | |
| C18 | sotsiaaltöötaja | Info jagamine perekodu, kooli ja psühhiaatriga | Osaliselt | Üldine õiguslik alus jäi puudu; täisealise puhul on „perelt nõusolek“ ebatäpne |
| C19 | teenuseosutaja | Tugiisikuteenuse kavandamine | Õige | |
| C20 | teenuseosutaja | Tugiisiku nõuded | Õige | |
| C21 | teenuseosutaja | Noor lõpetab koostöö | Õige | |
| C22 | teenuseosutaja | Enesetapumõtted tugiisikule | Osaliselt | 19-aastasele soovitati lastele mõeldud kanaleid (Lasteabi, lastekaitsetöötaja) |
| C23 | teenuseosutaja | Andmete säilitamine | Õige | |
| C24 | teenuseosutaja | Toetatud elamise algus ja rahastus | Õige | |
| C25 | teenuseosutaja | Teenuse mõju mõõtmine | Õige | |
