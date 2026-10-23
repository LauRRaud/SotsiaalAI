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

## Kordus 23.10: üheksa osalist vastust

Omanik 23.10.2026 („nii“, „jah“): parandada osalised vastused, mille põhjus oli info puudumine (A02, A04, A12, A17, A25, B02, C18) või leidmata omavalitsuse kirje (B20, C10). Fokusjooksud F3–F6 küsisid neid samades vestlustes koos vestluse avaküsimusega. Tõend: [F3–F6](evidence/sol-proof-20261014-01/server-rag-chat-focused-F3-F6-adr183-185.json).

| Id | 23.10 seis | Põhjus | Parandus |
|---|---|---|---|
| A02 | Paranenud, osaliselt | Tartu korra § 11 lg 3 oli paketis; vastus ei tuletanud, et kuni 600 € sissetulekuga maksab ainult koduskäigu tasu | [ADR-183](../rag-v2/adr-183-a-provision-list-is-read-whole.md): vastus ei ütle enam „määrus ei ütle“, kuid madalamat astet otse välja ei kirjuta |
| A04 | Õige (F4, F5) | Plaan pani isikuks kasutaja, kirjed otsiti Tallinnast | [ADR-184](../rag-v2/adr-184-carer-benefit-person-and-deadline-terms.md): isik on hooldatav; vastus annab Tartu tingimuse (samal aadressil Tartus) |
| A12 | Paranenud | Tahtest olenematu abi raam puudus | F4–F6: SHS § 105 tingimused (kohus otsustab) 3 korral 4-st; vahetu ohu kord (PsAS) puudub endiselt |
| A17 | Osaliselt | SÜS § 25 („hüvitise andja“) ei jõudnud paketti või ei seotud teenusega | ADR-184 (search-assist-25…27): päring SÜS-i sõnadega. 10 tööpäeva oli vastuses 2 korral 4-st kaudsest allikast. F6b-s oli § 25 paketis, kuid vastus ütles, et säte ei käi teenuse kohta: SÜS § 14 (teenus on mitterahaline hüvitis) puudus. Järgmine samm: rada, mis toob sätte kõrvale sama seaduse mõiste definitsiooni |
| A25 | Osaliselt | Andmete üleandmise õiguslik alus ei ole leitavas korpuses | Parandust pole; vastus piirab andmed vajalikuga ja nimetab nõusoleku või õigusliku aluse vajaduse |
| B02 | Õige (F4, F5) | SHS § 133 lg 1 ja 2 olid paketis; vastus ei lugenud erandite loetelu | ADR-183: „lastetoetus … arvestatakse toimetulekutoetuse määramisel sissetuleku hulka“ |
| B20 | Õige (F4, F5) | Narva kord (teenus on tasuta) ei jõudnud kandidaatide hulka | [ADR-185](../rag-v2/adr-185-municipal-regulations-reserve.md): omavalitsuse õigusaktidele 2 reservkohta; F5 tõi korra reservkohalt, kuigi päring Narvat ei nimetanud |
| C10 | Õige (F2–F5) | Pöördel puudus omavalitsus | ADR-167…173 (22.10) |
| C18 | Paranenud | Täisealise puhul „perelt nõusolek“ | F3–F5: noort käsitletakse täisealisena, alus on tema nõusolek või seadus (PsAS § 5 lg 2); üldist alust (isikuandmete kaitse üldmäärus) ei nimetata |

Ajad: pöörde mediaan oli F3-s 29,7 s, F4-s 34,3 s ja F5-s 34,6 s. Suurem osa kasvust tuli valikumudeli kõnest samade tokenitega (82 → 65 tok/s, õhtune teenus). Vastus oli umbes 15% pikem (1074 → 1234 tokenit), mis võib olla answer-19 mõju. Otsing ilma mudelikutseteta läks 4,9 s pealt 5,7 s peale; sellest umbes 0,5 s on omavalitsuse reservi lisapäringud. Aegu tuleb öises jooksus uuesti mõõta.

### Lisakontroll F7 ja kontrollvastused (23.10 õhtul)

Omanik küsis, kas vastused läksid sisulisemaks ja kas pikem aeg tuleb sellest.

**Sihtküsimused, F7 (samad 16 pööret, väljalase `58495e52`).**
- A04, B02 ja B20 olid õiged kolmandat korda järjest (F4, F5, F7).
- A02 oli sama mis F5-s.
- **A17-s on uus viga.** Kui SÜS § 25 jõuab paketti (F6b, F7), ütleb vastus, et kümne tööpäeva tähtaeg „puudutab hüvitise andmist, mitte“ sotsiaalteenust. See on õiguslikult vale: SÜS § 14 loeb teenuse mitterahaliseks hüvitiseks. § 14 ei tule § 25-ga kaasa.

**Kontrollvastused F3 vs F5** (seitse vestluse avaküsimust, läbi loetud koos allikatega). Vigu ei leitud kummastki.

| Id | Võrdlus | Mis erineb |
|---|---|---|
| A01 | Sama tase | F5 lisab dementsuse infoliini ja arsti juurde suunamise, kuid jätab välja pliidivalvuri ja koduteenuse taotlemise tee |
| A11 | Sama tase | F3 on rohkem sätetega seotud, F5 praktilisem (eluvaldkonnad, perearst, päevahoid) |
| A19 | Sama tase | F5 lisab 2026. a soovitused ja töötajate ettevalmistuse |
| B01 | F3 parem | F3 nimetab eluruumi tagamise teenust ja kontakti. F4, F5 ja F7 seda ei nimeta, kuigi Narva kirje on igas jooksus paketis; F3 plaan nimetas seda päringus. Põhjus ei ole selge, jälgida |
| B19 | F5 parem | Narva korra § 2–3 (kellel on õigus teenusele, nõustaja ülesanded) ja võlgniku õigused täitemenetluses |
| C01 | F5 parem | Varjupaik (kellaajad), vältimatu abi, Viljandi kontakt |
| C11 | Sama tase | F5 lisab Viljandi korra § 16 (sotsiaalkomisjon, rahastus), F3 täpsemad kestuse tingimused |

**Aeg.** F7 pöörde mediaan oli 42,6 s (kell 20 Eesti aja järgi), kuid otsing ilma mudelikutseteta võttis 4,9 s nagu F3-s.
- Kõik kolm mudelikutset olid samade tokenitega aeglasemad:
  - plaan 88 → 48 tok/s (4,9 → 8,1 s);
  - valik 82 → 49 tok/s;
  - vastus 140 → 124 tok/s.
- **Koodi mõju tokenites:**
  - plaani sisend +8% (kaks uut rida);
  - valiku sisend +2% (kaks lõiku rohkem);
  - vastuse väljund 13 küsimusel +3% (F5) ja +5% (F7).
- **F3 oli juhuslikult kiire:** kolm vastust (A02, B20, C11) tulid ilma mõtlemistokeniteta ja neli valikukutset lõppesid umbes 1,7 sekundiga.
- **Hinnang:** kood lisab pöördele alla sekundi. Ülejäänud kasv tuleb mudelite teenuse kiirusest.

### A17 pärast ADR-186 (23.10 õhtul)

[ADR-186](../rag-v2/adr-186-a-provision-brings-its-act-definition.md) toob paketi seadusesätte kõrvale sama seaduse mõiste definitsiooni ja selle liigid. Vastuse juhis `m4-grounded-answer-20` loeb mõistet definitsiooni järgi.

- **F9-s oli A17 kolm korda paketis SÜS § 25 koos §-dega 12, 13 ja 14.**
  - **Kaks vastust on õiged:** sotsiaalteenus on mitterahaline hüvitis ja otsus tehakse üldjuhul kümne tööpäeva jooksul.
  - **Kolmas vastus jättis § 25 kasutamata** ja ütles, et tähtaega ei anta.
- **Õiguslikult vale väidet** („tähtaeg ei puuduta teenust“) F9-s ei olnud.
- **A17 hinnang:** osaliselt, enamasti õige.
- **A04 F9-s:** Tartu jäi linna ja valla vahel lahtiseks. Põhjus on eraldi piirkonna teema, ADR-186 seda ei mõjuta.
