# Omavalitsuste vastuste kitsas mõõtmine päris vestluses — 30.09.2026

30.09.2026 kell 21:48–22:05 EEST. Korpus v46 (indeks `5a959000`), plaan `…-rfa51eb787` (profiil v3, answer-12, dialoog 21, olek v5, arutlus medium). Teostus Claude Opus 5.5, S1.0 järgmine samm („kitsas omavalitsuste vastuste mõõtmine, 6–8 küsimust“).

## Kuidas

- **Küsimused ja viitevastused** tehti enne küsimist, ainult indeksis oleva akti tekstist. Seitse kategooriat ADR-058 uutest aktidest: eluasemekulude piirmäärad (koos jätkuküsimusega), hoolduskulu piirmäär, toetuste määrad, hooldajatoetus, teenuste hinnad, toetuse tingimus ja vormi link.
  - Iga küsimuse jaoks kirjutas üks agent küsimuse ja viitevastuse ning teine agent püüdis selle akti uuesti lugedes ümber lükata. Viis seitsmest viitest parandati, näiteks Kuusalu küsimuse andmeid muudeti, et normpinna arvutusviis ei jätaks hindamist kahemõtteliseks.
  - Välja jäid Tartu, Rae, Kose ja Maardu (juba kontrollitud või 04.10 muutuvad) ning kõik, mis sõltub 01.10 jõustuvast SHS-ist.
- **Küsimine:** brauseripaanis `sotsiaal.ai/vestlus`, iga küsimus uues vestluses (sessionStorage'i `:convId` võtmete kustutamine).
- **Hindamine:** kaks sõltumatut hindajat vastuse kohta (viitefaktid; iga väide akti, manifesti ja KOV-paketi vastu), lahknevused otsustas kolmas agent allikat avades.

## Tulemus

| Omavalitsus | Küsimus | Hinne | Märkus |
|---|---|---|---|
| Kuusalu vald | üür 40 m² 1-toalises korteris, 520 € | õige | 480 € (40 m² × 12 €, § 2 lg 2 ja § 3 lg 1 p 1) |
| Kuusalu vald (jätk) | elekter kahekesi, 160 € | õige | 140 € (90 + 50, § 3 lg 1 p 8) |
| Kambja vald | hoolduskulu piirmäär | õige | kuni 800 € kuus; majutus ja toitlustus ema kanda |
| Märjamaa vald | sünnitoetus | enamasti õige | 500 + 300 €, tingimused õiged; **vale kuupäevakahtlus** (vt allpool) |
| Jõelähtme vald | raske puudega lapse hooldajatoetus | õige | 150 € kuus otsusele järgnevast kuust; vormi link õige |
| Mulgi vald | sotsiaaltranspordi hind | õige | 0,45 €/km kodust koju, ooteaeg 5 €/h = 15 € |
| Viimsi vald | koduse lapse toetus pärast augustis kolimist | õige | 2026 ei saa: 1. jaanuari elukoha tingimus |
| Häädemeeste vald | sünnitoetuse taotlemine | õige | vormi link „Sünnitoetuse taotlus (docx)“, 6 kuu tähtaeg, kolm esitamise viisi |

- **Kõik 8 käiku lõpetasid vigadeta.** Esimene nähtav tekst 12,9–25,9 s, vastus valmis 13,9–29,4 s.
- **Tokenid kokku:** sisend 280 702 (neist vahemälust 40 440), väljund 23 016 (arutlus 17 084). Tegelik kulu on OpenAI armatuurlaual.
- **Vormi lingid** tulid Kuusalu, Märjamaa, Jõelähtme ja Häädemeeste vastuse alla. Kambja vastus nimetab vormi, kuid lingita. See on õige, sest KOV-paketi vormikirjel pole ametlikku aadressi.

## Leid: konsolideeritud teksti algus ei ole summa muutumise päev (Märjamaa)

- Vastus ütles, et 800 € kehtib „alates 4. septembrist 2026“, ega osanud öelda, kas see kehtib augustis sündinud lapsele.
- 04.09.2026 on terviktekstis `401092026014` ainult konsolideeritud teksti algus. Sel päeval muudeti vaid preambulit (`401092026001`). § 1 p 1 summad tulid muudatusega `421022026007`: see jõustus 24.03.2026 märkega „rakendatakse alates 01.01.2026“.
- **Põhjus:** mudel näeb versiooni kehtivuse algust, aga mitte sätte enda muutmise märget.
- **Parandus (järgmine arendussamm):** sätte muutmise märge (jõustumine, muutev akt, „rakendatakse alates“) peab jõudma lõigu või allikakaardiga mudelini. Vastuse juhis dateerib summa selle märke järgi, mitte teksti alguse järgi.

## Väiksemad tähelepanekud

- **Kuusalu:** vastus võiks nimetada, millise normi § 2 lg 2 kõrvale jätab (18 + 15 = 33 m²). Siis on näha, miks kogu 40 m² arvesse läheb.
- **Viimsi:** vastus segab pöördumisi („kolisite“ ja „saad“ ühes vastuses). Luna kõnetab kasutajat sinaga.
- **Häädemeeste:** Eha Säde telefon ja e-post tulevad kontaktiregistrist, KOV-paketi kontaktikirjes on ainult nimi ja roll. Registris on tema piirkond täiskasvanute hoolekanne teatud külades, mitte pered.

## #288 kontroll samas jooksus

- **Fookus keset vastust:** Kuusalu jätkuküsimuse ajal saadeti iga 1,5 s järel `focus` ja `visibilitychange` sündmus, kokku 20 s. „Pooleliolev katse“ ei ilmunud; voog jäi alles.
- **Laadimine keset vastust:** Kambja küsimuse 10. sekundil laeti leht uuesti. Pärast laadimist oli näha „Pooleliolev katse“. Serveris valmis vastus umbes 29,6 s juures ja lehel asendus see vastusega 37 s juures (järelpäring iga 4 s).
- **Vormi lingi stiil:** läbipaistev taust, raam 0, allajoonitud, igaüks oma real. Omanik leidis, et link on väike ja hõljutusefekt kole. #289 teeb lingi vastuse teksti suuruseks (14 → 16,5 px) ja annab talle saidi lingijoone (35 % → hõljutades 75 %) paksu 2 px joone asemel.
