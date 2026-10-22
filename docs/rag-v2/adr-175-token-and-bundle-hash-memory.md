# ADR-175 — Allikate kontroll jätab tokenid ja allika räsi meelde. Varjupäring on eemaldatud

22.10.2026. Teostus Claude Opus 5.5. Omaniku valik pärast F2 jooksu: „Jätan alles (Soovitan)“. Täielik sõnaotsing jääb
alles. Teha tuli ainult väikese riskiga töö: allikate laadimise saba ilma tulemust muutmata.

## Leid (F2, 27 pööret)

- **Allikate laadimine on kriitilisel teel.** Valiku järel loetakse valitud lõikude allikad ja kontrollitakse need,
  enne kui vastuse kutse algab.
  - Lugemine `hydrate_db`: mediaan 230 ms, p90 940 ms.
  - Kontroll `hydrate_check`: mediaan 373 ms, p90 1171 ms, kõige aeglasem 2659 ms.
  - Kokku mediaan 0,52 s, p90 2,2 s.
- **Kontrolli aeg kulub kahes kohas** (kohalik korpus, suurimad dokumendid):
  - **Tokenite loendamine (BPE).** Iga üksuse tekst loendatakse uuesti. Meelespidamise tabelis oli 20 000 teksti,
    korpuses on ~78 000 üksust. Suure dokumendi (~350 üksust) esimene kontroll võttis 367–700 ms, millest BPE oli
    357–675 ms. Sama kontroll teist korda võttis 6–12 ms. Samade tekstide sha256 võttis kokku 1 ms.
  - **Terve allika räsi.** `retrievalDirectory` arvutab `hash(stable(bundle))` igal laadimisel uuesti, ka siis, kui
    kataloog annab sama objekti oma vahemälust. Suurel allikal (18–36 MB JSON-ina) kulub selleks 130–340 ms. Kohalikus
    võrdlustestis võttis vahemälust tulnud suure dokumendi kontroll 135–355 ms.

## Otsus

- **Tokenite meelespidamine (`embedding.js`).**
  - Iga korrektne tekst jäetakse meelde oma sha256 räsi järgi. Varem oli võtmeks tekst ise ja räsi ainult üle 4096
    märgi pikkustel tekstidel.
  - Tabelisse mahub 150 000 kirjet (~24 MB).
  - Tabamus tõstab kirje lõppu. Nii lahkuvad esimesena pöörde ühekordsed tekstid (kontekstid, eelarved), mitte korpuse
    üksused.
  - Üksiku surrogaadiga tekst ja kõik muu peale stringi jäävad võtmeks iseendana. Selline tekst annab UTF-8-s sama
    räsi kui mõni teine tekst, ja mitte-string peab andma sama vea kui enne.
  - Loendus ise on sama: `encode(text).length`.
- **Allika räsi objekti kohta (`discovery.js` `bundleHash`).**
  - `hash(stable(bundle))` arvutatakse iga objekti jaoks tema enda sisust üks kord ja jäetakse meelde (`WeakMap`).
  - Kasutab `retrievalDirectory` ja kataloogi täiskontroll (`PostgresCatalog.bundles`). Nii ei arvutata äsja loetud
    allika räsi enam kaks korda: varem tehti seda allika ja kataloogirea kontrollis eraldi.
  - Meelde jääb ainult sisust arvutatud väärtus, mitte andmebaasi veerg `bundle_hash`. Kontroll võrdleb seega
    endiselt sisu andmebaasiga.
  - See kehtib, sest allikat pärast lugemist ei muudeta. Samale reeglile toetuvad juba teised objekti kohta
    meelespidamised (`structuralRole`, lõigu abisõnad, õigusaktide kuupäevad). Tõendikirje jagab mõnda allika massiivi
    (`span_ids`, `pdf_pages`, `limitations`), ja ka neid ei muudeta kohapeal.
- **Varjupäring eemaldatud.** ADR-174 sõnaotsing vektorkandidaatide seas andis vastuse, mida vajasime: eelregistreeritud
  reegel ei täitunud (F2 tulemused eelregistreeringus). Otsingufunktsioon on taas ADR-174-eelsel kujul. Seemnete
  ettelugemine ja laadimise taimerid jäävad alles.

## Mida ei muudetud

Paketid, vead ja kontrollid on samad. Muutuvad ainult aeg ja mälu.

## Kontroll

- **Ohutusaudit (kaks sõltumatut agenti, ainult lugemine).** Mõlema hinnang: ohutu tingimustega, tingimused on täidetud.
  - Allikaobjekti ei muuda ükski koodikoht pärast lugemist. Muudetakse ainult ehitamise ajal, ja see kood ei jõua
    `retrievalDirectory`-ni.
  - Tokenite võti räsi järgi annab samad loendused ja samad vead. 155 316 juhuslikku vigast stringi andsid js-tiktokenis
    samad tokenid.
  - Täidetud tingimused:
    - FIFO asemel LRU;
    - mitte-stringid jäävad räsist välja;
    - mällu läheb ainult sisust arvutatud räsi.
- **Ühikkontroll (`adr175-unit`).** HEAD-i ja uue `tokenCount`-i tulemus ja veatüüp on samad stringidele, pikkadele
  tekstidele, üksikutele surrogaatidele ja mitte-stringidele, ka pärast 151 000 teksti. `bundleHash` võrdub
  `hash(stable(bundle))`-ga. Kolm kataloogiskeemi annavad sama tulemuse kui HEAD.
- **Mälutest (`adr174-check`).** 10 paketti HEAD-iga samad.
- **Kohalik korpus (`adr175-e2e`).** HEAD-i ja uue koodi pakettide võrdlus kuue küsimusega, kumbki kaks korda (allikad
  loetud ja vahemälust). Kolm küsimust on tehtud suurimate dokumentide tekstist.
  - Kõik 12 paketti olid samad.
  - Kontrolli aeg suurimate dokumentidega:

    | allikas | HEAD | uus |
    |---|---:|---:|
    | vahemälust | 133–351 ms | 22–28 ms |
    | äsja loetud | 901–1146 ms | 787–897 ms |

    Äsja loetud allika räsi arvutatakse nüüd kolme korra asemel üks kord. Tokenid loendatakse värskes protsessis
    esimesel korral ikka. Väikeste dokumentidega küsimustes oli kontroll 3–78 ms → 0–64 ms.
  - Kohalikul masinal pole EstNLTK-d, seega said mõlemad pooled sama asendusanalüsaatori ja üksused loeti kontrollituks.
- **Ülevaatus (kolm sõltumatut ülevaatajat, igale leiule ümberlükkamise katse).** Vaatenurgad olid võrdsus, mälu ja
  samaaegsus ning terviklikkus. Kõik kolm leidsid sama madala raskusega vea, ja ümberlükkamine ebaõnnestus.
  - Kui andmebaasi rida on rikutud ja allikas on JSON-skalaar (`null`, string, arv), viskas `WeakMap.set` koodita
    `TypeError`-i. Varem tuli `source_integrity_failed`.
  - Parandus: objektist erineva väärtuse räsi arvutatakse nagu varem ja seda meelde ei jäeta. Ühikkontroll katab ka
    selle juhu.
  - Muid leide ei olnud.
- **eslint** muudetud failidel läbis.
- **Serveris** näitavad `hydrate_check` ja `hydrate_db` järgmises jooksus, kui palju saba lühenes.
