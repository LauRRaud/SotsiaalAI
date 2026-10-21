# Kolm juhtumit, 75 küsimust — mis andmebaasist leiti ja mida vastati

| | pöördeid | grounded | partial | täpsustus | unsupported | „ei saa / ei leidnud” | allikaid paketis (kesk) | tsiteeritud (kesk) | USD |
|---|---|---|---|---|---|---|---|---|---|
| kokku | 75 | 29 | 46 | 0 | 0 | 16 | 43.2 | 4.6 | 0.4026 |
| juhtum A | 25 | 7 | 18 | 0 | 0 | 4 | 40.9 | 4.4 | 0.1351 |
| juhtum B | 25 | 14 | 11 | 0 | 0 | 5 | 56.2 | 4.5 | 0.1372 |
| juhtum C | 25 | 8 | 17 | 0 | 0 | 7 | 32.4 | 4.8 | 0.1303 |
| pöörduja | 30 | 16 | 14 | 0 | 0 | 5 | 61.3 | 4.1 | 0.1695 |
| sotsiaaltöötaja | 24 | 7 | 17 | 0 | 0 | 4 | 44.9 | 5.3 | 0.1405 |
| teenuseosutaja | 21 | 6 | 15 | 0 | 0 | 7 | 15.3 | 4.4 | 0.0926 |

Tsiteeritud allikate liigid: õigusakt 151, muu 61, kontakt 10, veebileht 70, juhend 45, uuring/aruanne 5.

## Aeg

| etapp | n | mediaan ms | p90 ms | max ms |
|---|---|---|---|---|
| total | 75 | 34915 | 50536 | 60422 |
| plan | 75 | 7666 | 11634 | 18872 |
| embed | 75 | 405 | 688 | 1456 |
| search | 75 | 11343 | 18438 | 35497 |
| answer | 75 | 14585 | 27177 | 33148 |
| knowledgeLaneMs | 75 | 11600 | 18635 | 35518 |
| recordsLaneMs | 75 | 1944 | 2877 | 4427 |
| rerankMs | 75 | 5711 | 8569 | 12451 |

| pööre | roll | kokku | plaan | vektorid | otsing+valik | vastus | allikaid | plaani tok | valiku tok | vastuse tok (sisend/väljund) |
|---|---|---|---|---|---|---|---|---|---|---|
| A01 | pöörduja | 30268 | 4633 | 1456 | 11566 | 11437 | 75 | 1927/317 | 15690/32 | 25498/1147 |
| A02 | pöörduja | 24631 | 4428 | 380 | 10272 | 9095 | 69 | 1945/221 | 19581/218 | 29695/914 |
| A03 | pöörduja | 26318 | 4552 | 399 | 11343 | 9250 | 76 | 1971/276 | 16970/153 | 28878/896 |
| A04 | pöörduja | 29101 | 4079 | 370 | 14034 | 10128 | 63 | 2000/238 | 13932/307 | 25845/1102 |
| A05 | pöörduja | 29021 | 3420 | 353 | 5915 | 18490 | 77 | 2028/182 | 13498/35 | 29031/918 |
| A06 | pöörduja | 31129 | 4525 | 422 | 6059 | 19233 | 77 | 2056/213 | 15420/23 | 27887/944 |
| A07 | pöörduja | 28516 | 4762 | 524 | 12541 | 10031 | 83 | 2077/247 | 15706/344 | 31557/1025 |
| A08 | pöörduja | 27075 | 6088 | 379 | 13196 | 6840 | 76 | 2109/310 | 18606/212 | 29478/606 |
| A09 | pöörduja | 22435 | 4975 | 580 | 8896 | 7246 | 72 | 2127/236 | 14583/17 | 25493/309 |
| A10 | pöörduja | 16441 | 5545 | 341 | 5254 | 4720 | 67 | 2145/273 | 11167/17 | 23118/301 |
| A11 | sotsiaaltöötaja | 34167 | 4978 | 351 | 11110 | 16499 | 81 | 1939/316 | 14332/32 | 28470/1823 |
| A12 | sotsiaaltöötaja | 28317 | 6888 | 509 | 11241 | 9176 | 70 | 1966/390 | 18046/41 | 32111/848 |
| A13 | sotsiaaltöötaja | 50536 | 5921 | 371 | 16561 | 27177 | 12 | 2012/308 | 16914/319 | 19631/1481 |
| A14 | sotsiaaltöötaja | 47366 | 5427 | 388 | 15592 | 25452 | 12 | 2010/289 | 17214/256 | 19828/1502 |
| A15 | sotsiaaltöötaja | 57773 | 7368 | 379 | 21900 | 27679 | 10 | 2052/427 | 18790/314 | 20573/1656 |
| A16 | sotsiaaltöötaja | 59908 | 6688 | 557 | 35497 | 16808 | 13 | 2124/282 | 20808/322 | 21741/939 |
| A17 | sotsiaaltöötaja | 59333 | 7175 | 524 | 32372 | 18829 | 11 | 2100/221 | 18062/365 | 21283/1099 |
| A18 | sotsiaaltöötaja | 49275 | 6280 | 387 | 19804 | 21918 | 9 | 2127/293 | 13983/198 | 19245/1145 |
| A19 | teenuseosutaja | 44853 | 7666 | 1074 | 15125 | 20512 | 12 | 1931/314 | 20236/294 | 18527/1295 |
| A20 | teenuseosutaja | 29439 | 7499 | 438 | 12380 | 8630 | 6 | 1949/320 | 17595/269 | 16069/543 |
| A21 | teenuseosutaja | 36593 | 8570 | 378 | 11308 | 15813 | 12 | 1969/324 | 18407/244 | 18573/928 |
| A22 | teenuseosutaja | 34134 | 6214 | 547 | 12495 | 14543 | 10 | 1999/204 | 17290/251 | 17389/859 |
| A23 | teenuseosutaja | 33391 | 7609 | 403 | 8667 | 15452 | 7 | 2046/321 | 18144/26 | 16930/1168 |
| A24 | teenuseosutaja | 28912 | 8188 | 1329 | 7093 | 11942 | 11 | 2049/324 | 16216/29 | 18588/1174 |
| A25 | teenuseosutaja | 37433 | 7926 | 517 | 10514 | 18068 | 12 | 2072/272 | 18163/190 | 18731/949 |
| B01 | pöörduja | 46335 | 6285 | 535 | 12522 | 26281 | 74 | 1926/217 | 13704/41 | 31443/1669 |
| B02 | pöörduja | 23141 | 6372 | 404 | 8897 | 6943 | 68 | 1992/219 | 15314/29 | 34803/716 |
| B03 | pöörduja | 35091 | 8306 | 543 | 12130 | 13305 | 68 | 1969/279 | 13033/165 | 27216/887 |
| B04 | pöörduja | 22394 | 5073 | 394 | 10368 | 5862 | 69 | 2024/132 | 14410/273 | 28253/479 |
| B05 | pöörduja | 32264 | 10242 | 769 | 10587 | 10053 | 75 | 2020/412 | 14111/38 | 29064/882 |
| B06 | pöörduja | 40521 | 9430 | 422 | 10351 | 19718 | 73 | 2059/366 | 16998/240 | 29877/961 |
| B07 | pöörduja | 28713 | 7080 | 512 | 8929 | 11607 | 73 | 2105/255 | 15356/214 | 31468/560 |
| B08 | pöörduja | 16901 | 6142 | 688 | 5554 | 3972 | 68 | 2098/214 | 16065/29 | 27876/320 |
| B09 | pöörduja | 25447 | 7074 | 384 | 6703 | 10744 | 71 | 2087/258 | 19781/32 | 30045/1075 |
| B10 | pöörduja | 23889 | 7720 | 469 | 5883 | 9314 | 69 | 2096/273 | 13711/35 | 28932/856 |
| B11 | sotsiaaltöötaja | 34915 | 9045 | 396 | 9955 | 14727 | 75 | 1931/336 | 17766/41 | 28637/1517 |
| B12 | sotsiaaltöötaja | 60422 | 18872 | 405 | 14731 | 25734 | 73 | 1966/422 | 15532/357 | 29909/1287 |
| B13 | sotsiaaltöötaja | 40413 | 7787 | 386 | 9035 | 22896 | 7 | 2006/252 | 18036/231 | 16882/1518 |
| B14 | sotsiaaltöötaja | 34618 | 7930 | 493 | 12349 | 13054 | 70 | 1998/261 | 14985/341 | 29273/1574 |
| B15 | sotsiaaltöötaja | 36416 | 7901 | 392 | 12703 | 14717 | 76 | 2031/307 | 20139/346 | 34302/1429 |
| B16 | sotsiaaltöötaja | 30915 | 7775 | 365 | 13023 | 8982 | 71 | 2054/274 | 17103/290 | 33004/869 |
| B17 | sotsiaaltöötaja | 42221 | 5802 | 533 | 11523 | 23673 | 76 | 2076/204 | 17699/219 | 31235/1220 |
| B18 | sotsiaaltöötaja | 31439 | 6066 | 360 | 11708 | 12685 | 69 | 2102/187 | 15712/353 | 28467/1386 |
| B19 | teenuseosutaja | 46470 | 11183 | 565 | 10564 | 23824 | 12 | 1936/404 | 15756/214 | 19181/1293 |
| B20 | teenuseosutaja | 25446 | 11463 | 405 | 8844 | 4133 | 62 | 1960/340 | 16535/237 | 23704/290 |
| B21 | teenuseosutaja | 44768 | 10236 | 817 | 11311 | 21777 | 65 | 1985/303 | 14970/280 | 26523/815 |
| B22 | teenuseosutaja | 28727 | 11238 | 316 | 4363 | 12347 | 7 | 2012/341 | 15046/23 | 16238/739 |
| B23 | teenuseosutaja | 32785 | 12621 | 346 | 10870 | 8560 | 11 | 2030/413 | 15105/296 | 18556/816 |
| B24 | teenuseosutaja | 42111 | 9354 | 406 | 10619 | 21372 | 13 | 2053/294 | 15274/285 | 20916/988 |
| B25 | teenuseosutaja | 28692 | 8402 | 517 | 12291 | 7157 | 11 | 2126/284 | 16448/369 | 20853/639 |
| C01 | pöörduja | 38286 | 7963 | 438 | 11062 | 18359 | 64 | 1918/232 | 23071/41 | 31577/1854 |
| C02 | pöörduja | 32837 | 11634 | 360 | 13305 | 6998 | 62 | 1965/333 | 16865/382 | 29993/763 |
| C03 | pöörduja | 46517 | 10057 | 516 | 11674 | 23790 | 61 | 1959/313 | 16688/317 | 29783/1268 |
| C04 | pöörduja | 51710 | 4894 | 342 | 18080 | 27960 | 15 | 1976/132 | 16369/344 | 22637/1387 |
| C05 | pöörduja | 46727 | 6751 | 338 | 8210 | 31057 | 6 | 2007/220 | 16424/29 | 15694/1052 |
| C06 | pöörduja | 29245 | 10292 | 410 | 10494 | 7453 | 62 | 2039/332 | 15990/41 | 27405/682 |
| C07 | pöörduja | 34060 | 7791 | 333 | 20951 | 4529 | 56 | 2037/259 | 15664/26 | 26166/360 |
| C08 | pöörduja | 59539 | 14498 | 422 | 16257 | 27793 | 60 | 2054/504 | 14608/308 | 29463/1258 |
| C09 | pöörduja | 28513 | 7906 | 299 | 8978 | 10955 | 6 | 2101/253 | 14060/29 | 17579/593 |
| C10 | pöörduja | 27520 | 9646 | 590 | 10639 | 6241 | 5 | 2115/331 | 12083/29 | 15892/538 |
| C11 | sotsiaaltöötaja | 38789 | 6327 | 656 | 14625 | 16647 | 64 | 1929/238 | 18878/274 | 30962/1703 |
| C12 | sotsiaaltöötaja | 43191 | 11792 | 366 | 15573 | 14907 | 59 | 1987/443 | 20914/232 | 27680/882 |
| C13 | sotsiaaltöötaja | 38918 | 7812 | 368 | 14165 | 15971 | 61 | 1981/288 | 17423/178 | 28424/1172 |
| C14 | sotsiaaltöötaja | 44211 | 7353 | 356 | 18438 | 17702 | 8 | 2039/280 | 13135/368 | 18691/1025 |
| C15 | sotsiaaltöötaja | 41243 | 12088 | 368 | 13609 | 14585 | 63 | 2020/273 | 18842/339 | 30528/1820 |
| C16 | sotsiaaltöötaja | 46726 | 10789 | 676 | 5669 | 28970 | 65 | 2071/338 | 15305/32 | 30684/1343 |
| C17 | sotsiaaltöötaja | 30884 | 13004 | 880 | 5621 | 10872 | 10 | 2060/399 | 16023/32 | 19103/1196 |
| C18 | sotsiaaltöötaja | 48444 | 9654 | 713 | 9585 | 28181 | 12 | 2132/287 | 17292/267 | 20815/1384 |
| C19 | teenuseosutaja | 48464 | 4321 | 574 | 9971 | 33148 | 13 | 1938/129 | 19593/41 | 20984/1531 |
| C20 | teenuseosutaja | 35826 | 10075 | 366 | 15086 | 9981 | 11 | 1964/327 | 18021/302 | 18763/928 |
| C21 | teenuseosutaja | 37419 | 9735 | 358 | 17356 | 9682 | 6 | 1983/296 | 17753/291 | 15275/578 |
| C22 | teenuseosutaja | 35967 | 7117 | 393 | 18986 | 9121 | 6 | 2042/204 | 17926/318 | 16896/591 |
| C23 | teenuseosutaja | 45040 | 6925 | 321 | 19712 | 17716 | 15 | 2022/241 | 18023/359 | 24390/860 |
| C24 | teenuseosutaja | 50629 | 15227 | 454 | 12404 | 22131 | 15 | 2058/248 | 18158/35 | 23521/1182 |
| C25 | teenuseosutaja | 23836 | 6717 | 339 | 10639 | 5820 | 5 | 2080/191 | 17245/29 | 15697/413 |

## A01 · pöörduja

**Küsimus:** Mu 81-aastane ema elab Tartus üksi ja on viimasel ajal hakanud asju unustama, eile jättis ta pliidi sisse. Ma elan Tallinnas ja käin tal kord nädalas. Kust ma abi saaksin?

**Oodatud (küsija):** KOV (Tartu linn) hindab abivajadust (SHS § 15); koduteenus, turvalisus; kellega ühendust võtta; perearst mälu hindamiseks

**Vastuse liik:** grounded; paketis 75 allikat, tsiteeritud 6 (õigusakt 2, muu 3, kontakt 1); valikumudel luges 7 ja valis 0.

**AI otsinguvariandid:** Tartu eaka üksi elava inimese abivajaduse hindamine koduteenus · dementsusega eaka kodus turvalisus sotsiaalteenused ja abi · Tartu linna sotsiaalabi eakale ja lähedasele

**Tsiteeritud:** S2 Tartu linna sotsiaalhoolekandelise abi andmise kord § 5 lg 1–4; S3 Tartu linna sotsiaalhoolekandelise abi andmise kord § 11 lg 1–3; S4 Dementsusega inimesi toetavad kohandatud keskkond ja abivahendid; S8 Airika Põldkivi; S60 Koduteenus; S62 Päevahoiuteenus mäluprobleemiga eakatele

**Vastus:** See, et su ema on viimasel ajal asju unustanud ja jättis pliidi sisse, teeb koduse turvalisuse ning igapäevase kõrvalabi hindamise oluliseks. Tartu koduteenuse eesmärk on toetada täisealise inimese iseseisvat ja turvalist toimetulekut kodus. Tartu linnas peab teenuse saaja seal elama ja tema rahvastikuregistrijärgne elukoht peab olema Tartu linnas. Abivajadust hindab linnavalitsuse vastav teenistuja; hindamisel võidakse teha kodukülastus. (Tartu linna sotsiaalhoolekandelise abi andmise kord § 5 lg 1–2 ja § 11 lg 1–2) Võta ühendust Tartu linna hoolekandeteenistuse hoolekande spetsialisti Airika Põldkiviga: 746 1764 või 5302 5131, airika.poldkivi@tartu.ee. Kirjelda pliidiga juhtunut ja palu hinnata, millist abi ema kodus vajab. Tartu koduteenuse kohta saad vaadata ka: tartu.ee/et/koduhooldusteenus. Tartus on ka mäluprobleemidega eakatele mõeldud päevahoiuteenus, kus eakas saab päeval turvaliselt ja juhendatult aega veeta ning mis võib lähedase hoolduskoormust vähendada. Vajadust hindab piirkonnakeskuse heaolu spetsialist; teenusele suunatakse pärast hindamist. Vaata lähemalt: tartu.ee/et/paevahoiuteenus. Kuni abi korraldamiseni saad kodu ohutust parandada näiteks elektriseadmete turv…

## A02 · pöörduja

**Küsimus:** Kas linn saab talle koduteenust anda ja kui palju see maksab?

**Oodatud (küsija):** koduteenus KOV-i korraldada; tasu Tartu linna korra järgi (kui tõendites); maksevõime arvestamine

**Vastuse liik:** partial; paketis 69 allikat, tsiteeritud 3 (õigusakt 2, muu 1); valikumudel luges 6 ja valis 3.

**AI otsinguvariandid:** Koduteenuse saamise tingimused ja abivajaduse hindamine · Koduteenuse hind, omaosalus ja hinna kehtestamine

**Tsiteeritud:** S1 Tartu linna sotsiaalhoolekandelise abi andmise kord § 11 lg 1–3; S7 Sotsiaalhoolekande seadus § 15 lg 1–4; S54 Koduteenus

**Vastus:** Jah, Tartu linn saab su emale koduteenust korraldada, kui ta on täisealine, elab Tartu linnas ja tema rahvastikuregistrijärgne elukoht on Tartu linnas. Linn hindab, millist abi ta vajab; sinu kirjeldatud pliidiga juhtumist ja unustamisest tasub hindajale rääkida. (Tartu linna sotsiaalhoolekandelise abi andmise korra § 11 lg 1–2; sotsiaalhoolekande seaduse § 15 lg 1–2) Tartu koduteenus maksab 1 euro iga koduskäigu eest. Lisaks on tunnitasu 6,50 eurot, kui teenuse saaja arvestatav sissetulek on 601–800 eurot kuus, või 13 eurot tunnis, kui sissetulek on suurem kui 801 eurot kuus. Arvesse lähevad riiklik pension, kogumispension, töövõimetoetus ja sotsiaalmaksuga maksustatav tulu. (Tartu linna sotsiaalhoolekandelise abi andmise korra § 11 lg 3) Pöördu Tartu piirkonnakeskuse sotsiaaltöö spetsialisti poole või esita üldtaotlus või linnaportaali taotlus; spetsialist hindab ema abivajadust ja korraldab teenuse. Vaata lähemalt: tartu.ee/et/koduhooldusteenus.

**Piirangud:** Tasu kirjeldus ei selgita, milline tunnitasu kehtib täpselt 801-eurose kuusissetuleku korral ega anna piisavalt teavet ema tasu arvutamiseks ilma tema arvestatava sissetulekuta.

## A03 · pöörduja

**Küsimus:** Ema ei taha võõraid koju lasta. Mis variandid veel on, et ta oleks turvalisemalt?

**Oodatud (küsija):** nt häirenupp/turvalisuse lahendused, päevahoid, lähedaste tugi, sotsiaaltöötaja nõu; ei sunnita

**Vastuse liik:** grounded; paketis 76 allikat, tsiteeritud 4 (veebileht 1, õigusakt 1, muu 2); valikumudel luges 6 ja valis 3.

**AI otsinguvariandid:** Tartu eakate kodus turvalisuse tagamine pliidi väljalülitusseade · Tartu eakate sotsiaalteenused päevahoid intervallhooldus · Eaka abivajaduse hindamine ja sobiva sotsiaalteenuse korraldamine

**Tsiteeritud:** S1 Dementsuse Kompetentsikeskus: Kodu kohandamine; S4 Tartu linna sotsiaalhoolekandelise abi andmise kord § 13 lg 1–3; S40 Häirenupp ja koduandur; S58 Heaolumeistri teenus

**Vastus:** Kui ema ei taha võõraid koju, võib talle sobida Tartu linna päevahoiuteenus: see pakub mäluhäirega inimesele turvalist keskkonda ja järelevalvet ning on tasuta. Teenuse tingimus on, et ta elab Tartu linnas ja tema rahvastikuregistrijärgne elukoht on seal. (Tartu linna sotsiaalhoolekandelise abi andmise korra § 13 lg 1–3) Kodus saab ohutust suurendada ka ilma abilist sisse kutsumata: pliidivalvur lülitab ohu korral pliidi automaatselt välja. Tartu linna teenuste seas on nimetatud ka häirenuppu ja koduandurit, mille abil saab vajadusel abi kutsuda. Vaata lähemalt: tartu.ee/et/ToetusedTeenused. Väiksemateks koduohutuse parandusteks võib sobida Tartu heaolumeistri teenus: heaolumeister hindab kodukeskkonda, aitab lihtsamate töödega ja annab nõu abivahendite kasutamiseks. Vaata lähemalt: tartu.ee/et/heaolumeistri-teenus.

**Täpsustav küsimus:** Kas ema rahvastikuregistrijärgne elukoht on Tartu linnas? See mõjutab päevahoiuteenuse tingimuse täitmist.

## A04 · pöörduja

**Küsimus:** Kas mina saaksin hooldajatoetust, kui ma hakkan teda rohkem aitama, aga töötan täiskohaga?

**Oodatud (küsija):** hooldajatoetus KOV-i korra järgi, tingimused (puude raskusaste, hooldusvajadus); hooldaja toetusvajaduse hindamine (SHS § 15 lg 4)

**Vastuse liik:** partial; paketis 63 allikat, tsiteeritud 3 (õigusakt 3); valikumudel luges 6 ja valis 2.

**AI otsinguvariandid:** Hooldajatoetus täisealise inimese hooldajale Tartu linnas tingimused · Täiskoormusega töötava pereliikme hooldajatoetuse saamine

**Tsiteeritud:** S1 Tartu linna sotsiaalhoolekandelise abi andmise kord § 19 lg 1–4; S4 Sotsiaalhoolekande seadus § 26 lg 1–2; S5 Sotsiaalhoolekande seadus § 15 lg 1–4

**Vastus:** Praegu kirjeldatu järgi sa Tartu hooldajatoetuse tingimust ei täida, sest elad Tallinnas. Tartu linnas peab hooldust vajava inimese hooldaja olema samuti Tartu linna elanik. Täistööajaga töötamist ei ole siin toetuse saamise välistava tingimusena nimetatud. (Tartu linna sotsiaalhoolekandelise abi andmise korra § 19 lg 3–4) Toetus määratakse hoolduse seadmise järel ning selle suurus sõltub ema abivajaduse raskusest: 30, 60 või 120 eurot kuus. Abivajadust hindab Tartu linn. Hooldus ja hooldaja määramine eeldavad ema nõusolekut. (Tartu linna sotsiaalhoolekandelise abi andmise korra § 19 lg 1–3; Sotsiaalhoolekande seaduse § 26 lg 1–2) Kui elad ja oled rahvastikuregistris registreeritud Tallinnas, saad Tartu linnalt siiski küsida ema abivajaduse hindamist ja muud tuge. Kohalik omavalitsus selgitab abivajaduse välja ning korraldab abi või aitab seda saada. (Sotsiaalhoolekande seaduse § 15 lg 1–2)

**Täpsustav küsimus:** Kas plaanid Tartusse elama asuda ja seal rahvastikuregistris registreeruda? See muudaks seda, kas Tartu hooldajatoetuse tingimus võiks sinu puhul täidetud olla.

## A05 · pöörduja

**Küsimus:** Kuidas saada talle dementsuse diagnoos ja kas see annab mingeid õigusi, näiteks puude raskusastme?

**Oodatud (küsija):** perearst ja eriarst diagnoosiks; puude raskusastme tuvastamine SKA-s (pensioniealise puhul); mis sellest tuleneb

**Vastuse liik:** partial; paketis 77 allikat, tsiteeritud 7 (veebileht 4, õigusakt 2, muu 1); valikumudel luges 7 ja valis 1.

**AI otsinguvariandid:** Dementsuse diagnoosimine perearst neuroloog uuringud · Puude raskusastme tuvastamine eakal dementsuse korral õigused · Puude raskusastme tuvastamise taotlemine Sotsiaalkindlustusamet

**Tsiteeritud:** S1 Dementsuse Kompetentsikeskus: Dementsuse diagnoosimine; S2 Dementsuse Kompetentsikeskus: Dementsuse diagnoosimine; S3 Vanaduspensioniealise puude raskusastme tuvastamine; S4 Vanaduspensioniealise puude raskusastme tuvastamine; S6 Puuetega inimeste sotsiaaltoetuste seadus § 2³ lg 1–8; S7 Puuetega inimeste sotsiaaltoetuste seadus § 2² lg 1–5; S64 Päevahoiuteenus mäluprobleemiga eakatele

**Vastus:** Alusta ema perearstist ja mine võimalusel temaga koos. Kirjelda, mida oled märganud, millal muutused algasid ja kui palju ta igapäevaelus abi vajab. Perearst hindab mäluhäiret, võib teha lisauuringuid ja vajadusel suunata neuroloogi juurde; psühhiaatri vastuvõtule saab pöörduda ka saatekirjata. Vaata lisateavet: dementsus.ee/dementsuse-diagnoosimine. Puude raskusastet ei hinnata üksnes diagnoosi nime järgi. Vanaduspensioniealisel inimesel on oluline, kas pikaajalised püsipiirangud takistavad igapäevaseid põhitegevusi ning kas ta vajab abivahendist hoolimata kõrvalabi või tugiteenuseid. Taotluse saad esitada Sotsiaalkindlustusametile; otsuse teeb amet terviseandmete ja taotluse põhjal. (Puuetega inimeste sotsiaaltoetuste seaduse § 2² lg 1 ja § 2³ lg 1, 6) Kui ema ei tule igapäevatoimingutega iseseisvalt toime, saad küsida esmalt Tartu linna sotsiaaltöötajalt abivajaduse hindamist ja tugiteenuseid. Tartu linnas on mäluprobleemidega eakatele ka päevahoiuteenus: vajadust hindab piirkonnakeskuse heaolu spetsialist ning taotluse saab esitada talle või linnaportaali kaudu. Vaata: tartu.ee/et/paevahoiuteenus.

**Piirangud:** Ma ei saa nende andmete põhjal öelda, kas emale puude raskusaste määratakse; otsus sõltub tema pikaajalistest piirangutest ja abivajaduse hindamisest.

## A06 · pöörduja

**Küsimus:** Kui ta peab lõpuks hooldekodusse minema, kui palju ta ise maksab ja kas mina pean juurde maksma?

**Oodatud (küsija):** hooldereform: KOV tasub hoolduskomponendi, isik maksab kohatasu; täisealiste laste ülalpidamiskohustus (PKS § 96) ja selle piirid; KOV peab arvestama maksevõimet

**Vastuse liik:** partial; paketis 77 allikat, tsiteeritud 4 (muu 2, õigusakt 2); valikumudel luges 7 ja valis 1.

**AI otsinguvariandid:** Hooldekodu kohatasu omaosalus hooldusvajaduse kulude katmine · Ülalpidamiskohustus täisealise lapse kohustus vanema ülalpidamiseks tingimused

**Tsiteeritud:** S1 Hooldekodude rahastamise põhimõtted muutuvad; S3 Perekonnaseadus § 96 lg 1–2; S5 Sotsiaalhoolekande seadus § 22¹ lg 1–6; S73 Väljaspool kodu osutatav üldhooldusteenus

**Vastus:** Kui Tartu linn on ema hooldusvajaduse hinnanud ja selgub, et ta vajab ööpäevaringset hooldekoduteenust, jaguneb teenuskoha maksumus ema ja linna vahel. Ema tasub majutuse, toitlustuse ja muud teenuse osutamisega seotud kulud. Linn katab hooldustöötajate ja abihooldustöötajate nimetatud tööga seotud kulud ning võib kehtestada neile piirmäära, mis peab tagama teenuse kättesaadavuse. (Sotsiaalhoolekande seaduse § 22¹ lg 1–4) Kui ema arvestatav sissetulek on väiksem kui eelarveaastale eelnenud aasta teise kvartali keskmine vanaduspension, katab linn tema tasutavate kulude ja sissetuleku vahe, kuid mitte rohkem kui selle keskmise pensioni ja ema sissetuleku vahe. Arvesse lähevad ema riiklik ja kogumispension, töövõimetoetus ning sotsiaalmaksuga maksustatav tulu. (Sotsiaalhoolekande seaduse § 22¹ lg 5) Sinu võimaliku ülalpidamiskohustuse kohta: täisealised lapsed on oma vanemate suhtes ülalpidamiskohustuslased. Samas ei võeta omavalitsuse hoolduskulude katmise üle otsustamisel ülalpidajate maksevõimet arvesse. See ei ütle, kui suure summa sinult konkreetsel juhul võidakse nõuda; hooldekodu puudujäägi katmine võib sõltuda ka inimese enda varast ja lähedaste toest. (Perekonnaseaduse § 96 l…

**Piirangud:** Ma ei saa siin öelda ema ega sinu võimalikku täpset makseosa, sest ema sissetulekut, teenuskoha hinda ja teie olukorra hindamiseks vajalikke asjaolusid ei ole teada.

## A07 · pöörduja

**Küsimus:** Ema pension on 780 eurot. Kas sellest piisab hooldekodukoha jaoks?

**Oodatud (küsija):** ütleb, millest sõltub (kohatasu, keskmine pension, KOV-i abi); kui tõendites on arvud, ütleb need; ei paku kindlat summat ilma allikata

**Vastuse liik:** partial; paketis 83 allikat, tsiteeritud 4 (õigusakt 1, muu 3); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 Sotsiaalhoolekande seadus § 22¹ lg 1–6; S2 Hooldekodude kohamaksumus: Tartu linn; S3 Hooldekodude kohamaksumus: Tartu linn; S79 Väljaspool kodu osutatav üldhooldusteenus

**Vastus:** Ainuüksi 780-eurosest pensionist ei saa järeldada, kas hooldekodukoht on emale jõukohane. Tartu hooldekodude 2026. aasta märtsi näidetes oli kohatasu kuus 1750 eurot Tartu Hooldekodus ning 1990 eurot Eluringikeskuses ulatusliku hooldusvajaduse või dementsuse korral. Need hinnad on märtsi 2026 seisuga ja võivad vahepeal muutunud olla. Kui Tartu linn on ema hooldusvajaduse välja selgitanud, katab linn hooldustöötajate ja abihooldustöötajate seaduses nimetatud kulud. Ema tasub majutus-, toitlustus- ja muud teenusega seotud kulud. Kui tema arvestatav sissetulek on väiksem kui eelarveaastale eelnenud aasta teise kvartali keskmine vanaduspension, katab linn ka osa ema tasutavate kulude ja sissetuleku vahest, kuid mitte üle seaduses toodud piiri. Sissetulekuna arvestatakse riiklikku ja kogumispensioni, töövõimetoetust ning sotsiaalmaksuga maksustatavat tulu. (Sotsiaalhoolekande seaduse § 22¹ lg 1–5) Tartu hooldekoduteenuse saamiseks pöördu ema piirkonnakeskuse sotsiaaltöö spetsialisti poole. Spetsialist hindab hooldusvajadust ja aitab teenust korraldada. Vaata lähemalt: tartu.ee/et/hooldusteenus-hooldekodus.

**Piirangud:** Ma ei saa praegu öelda, kui palju emal endal maksta jääks: selleks on vaja teada valitud hooldekodu tasu ning ema muud arvestatavat sissetulekut ja seda, milline keskmise vanaduspensioni võrdlus kehtib.

## A08 · pöörduja

**Küsimus:** Ma kardan, et ta ei suuda varsti oma raha ja pangaasjadega toime tulla. Kas ma saan tema eest otsuseid teha?

**Oodatud (küsija):** volikiri (kui otsusvõimeline), eestkoste kohtu kaudu (PKS § 203 jj), KOV-i roll

**Vastuse liik:** grounded; paketis 76 allikat, tsiteeritud 5 (õigusakt 2, veebileht 1, muu 1, kontakt 1); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 Perekonnaseadus § 203 lg 1–4; S2 Dementsuse Kompetentsikeskus: Õiguslikud küsimused; S5 Mälestuste mustrid. Number 2; S8 Tsiviilkohtumenetluse seadustik § 522 lg 1–5; S12 Katrin Tammine

**Vastus:** Sa ei saa üksnes tütre või lähedasena ema pangaasjade üle otsustama hakata. Kui ta suudab sellest aru saada, võib ta anda sulle volituse asju ajada. Eestkostet ei seata ülesannete jaoks, mida saab korraldada volituse ja abiliste kaudu (Perekonnaseaduse § 203 lg 2). Kui ema ei suuda psüühikahäire tõttu kestvalt oma tegudest aru saada või neid juhtida, määrab eestkostja kohus ning ainult nende ülesannete jaoks, milleks eestkoste vajalik on. Sina ei saa eestkostjaks pelgalt enda otsusega. Ema vanemana võid esitada kohtule eestkostja määramise avalduse; kohus hindab vajadust ja eestkoste ulatust, muu hulgas psühhiaatrilise ekspertiisi põhjal (Perekonnaseaduse § 203 lg 1–2). Tartus saad enne kohtusse pöördumist küsida nõu ema elukohajärgse omavalitsuse sotsiaaltöötajalt. Tartu linnas on sotsiaaltöö spetsialist Katrin Tammine; talle saad helistada numbril 746 1701 või 5307 6883 või kirjutada aadressil katrin.tammine@tartu.ee. Samuti võib eestkostet vajav inimene ise, tema vanem või muu seaduses nimetatud isik kohtule avalduse esitada. Vaata lisaks: dementsus.ee/oiguslikud-kusimused.

**Piirangud:** Ema unustamine ja pliidi sisse jätmine üksi ei näita, kas ta suudab oma rahaasjadest aru saada või kas eestkoste on vajalik; selle hindab kohus.

## A09 · pöörduja

**Küsimus:** Kas ma saan töölt vaba aega võtta, et ema eest hoolitseda?

**Oodatud (küsija):** hoolduspuhkus täisealise sügava puudega isiku hooldamiseks (TLS) ja tingimused; muu: tööandjaga kokkulepe

**Vastuse liik:** grounded; paketis 72 allikat, tsiteeritud 1 (õigusakt 1); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 Töölepingu seadus § 65¹ lg 1–4

**Vastus:** Jah, kui su emal on tuvastatud sügav puue, saad täisealise töötajana võtta tema hooldamiseks kalendriaastas kuni viis tööpäeva hoolduspuhkust. Tütrena kuulud selle õigusega sugulaste hulka. Ühe ema kohta saavad õigustatud inimesed kokku kasutada viis tööpäeva aastas ja korraga võib puhkust kasutada üks inimene. Hoolduspuhkuse eest makstakse töötasu alammäära järgi. (Töölepingu seaduse § 65¹ lg 1–4)

**Piirangud:** Ma ei saa sinu kirjelduse põhjal öelda, kas emal on tuvastatud sügav puue. Ilma selle tingimuseta see hoolduspuhkus ei kohaldu.

## A10 · pöörduja

**Küsimus:** Kellele ma Tartus täpselt helistan, et asja alustada?

**Oodatud (küsija):** Tartu linna sotsiaalabi kontakt (kirjetest), konkreetne järgmine samm

**Vastuse liik:** grounded; paketis 67 allikat, tsiteeritud 3 (kontakt 1, muu 2); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S28 Aigi Puusepp; S49 Heaolumeistri teenus; S50 Hoolduskoordinaatorid

**Vastus:** Alustuseks helista Tartu linna hoolduskoordinaatorile Aigi Puusepale numbril 5886 0369. Hoolduskoordinaator aitab perel tervishoiu- ja sotsiaalteenuseid korraldada ning sobivat abi leida. Võid talle ka kirjutada aadressil aigi.puusepp@tartu.ee. Kui soovid alustada koduse turvalisuse parandamisest, saad pöörduda ka piirkonnakeskuse sotsiaaltöö või heaolu spetsialisti poole. Spetsialist hindab vajadust ja suunab vajaduse korral heaolumeistri teenusele, mis aitab kodu turvalisemaks muuta. Loe lähemalt: tartu.ee/et/heaolumeistri-teenus.

## A11 · sotsiaaltöötaja

**Küsimus:** Olen Tartu linna sotsiaaltöötaja. Mulle pöördus tütar, kelle 81-aastane ema elab üksi, mälu halveneb ja ta on jätnud pliidi sisse. Kuidas ma abivajaduse hindamise läbi viin ja mida dokumenteerin?

**Oodatud (küsija):** SHS § 15 terviklik hindamine, kliendi enda kaasamine ja nõusolek, hooldaja hindamine, dokumenteerimine (STAR), otsus

**Vastuse liik:** partial; paketis 81 allikat, tsiteeritud 8 (õigusakt 2, juhend 3, uuring/aruanne 1, muu 2); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 Tartu linna sotsiaalhoolekandelise abi andmise kord § 5 lg 1–4; S2 Täisealise abi- ja toetusvajaduse hindamise juhend 2025; S3 Täisealise abi- ja toetusvajaduse hindamise juhend 2025; S4 Täisealise inimese abivajaduse hindamine – uued võimalused STAR-is; S5 Abi- ja toetusvajaduse hindamisvahendi metoodiline juhis 2021; S7 Sotsiaalhoolekande seadus § 15 lg 1–4; S66 Koduteenus; S68 Päevahoiuteenus mäluprobleemiga eakatele

**Vastus:** Tartu linnas selgitab abivajaduse välja linnavalitsuse vastav teenistuja. Lähtu terviklikust hindamisest: arvesta ema toimetulekut ning tema isikliku tegevusvõime ja füüsilise ning sotsiaalse elukeskkonnaga seotud asjaolusid. Kui hindamisvahend on olemas, kasuta seda koos pöördumises esitatud ja klienditöö käigus kogutud teabega. Abivajadust võib hinnata kodus või vajaduse korral videosilla kaudu (Tartu Linnavolikogu „Tartu linna sotsiaalhoolekandelise abi andmise kord“ § 5 lg 1–3; Sotsiaalhoolekande seadus § 15 lg 1–2). Ema üksi elamine, halvenenud mälu ja pliidi sisselülitatuks jätmine on olulised lähteandmed, mitte veel terviklik hinnang tema abivajadusele. Selgita hindamisel välja, millistes eluvaldkondades ja kui palju ta tuge vajab. Hindamisjuhendi valdkondade hulgas on vaimne ja füüsiline tervis, elukeskkond ning igapäevaelu toimingud. Käsitle pliidi kasutamise juhtumit elukeskkonna ja igapäevase toimetuleku hindamisel ning selgita välja, millist tuge oleks vaja kodus turvaliseks hakkamasaamiseks. Kogu hindamisel teavet emalt ning klienditöö käigus ka lähedaselt ja asjakohastest dokumentidest. Selgita välja, kas ja millisel viisil tütar saab või soovib abistamises osaleda. H…

**Piirangud:** Ma ei saa nende andmete põhjal hinnata, kui vahetu pliidiga seotud oht praegu on või millist abi ema lõpuks vajab. Valitud teave ei anna ka täielikku loetelu kõigist dokumenteerimisväljadest.

## A12 · sotsiaaltöötaja

**Küsimus:** Klient keeldub koduteenusest. Mida ma tohin teha, kui ta on endale ohtlik?

**Oodatud (küsija):** enesemääramine; sundi ainult seaduse ja kohtu alusel; turvalisuse plaan, lähedased, perearst; ohu korral 112

**Vastuse liik:** partial; paketis 70 allikat, tsiteeritud 3 (õigusakt 1, juhend 1, muu 1); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S2 Sotsiaalhoolekande seadus § 15 lg 1–4; S3 Üldjuhend KOV sotsiaalteenuse korraldamiseks ametnikule; S4 Koduteenuse teenusedisaini projekti raport

**Vastus:** Kui klient keeldub koduteenusest, ära käsitle keeldumist põhjusena abi pakkumine lõpetada. Selgita talle teenuse sisu ja püüa välja selgitada keeldumise põhjus; paku abi uuesti esimesel võimalusel. Soovimatu sotsiaalhoolekande meedet ei saa talle peale sundida ning tema tahet tuleb arvestada. Pane keeldumine ja juhtunu kirjeldus kirja ning võimalusel võta kliendilt allkiri. Teavita juhtumist linna sotsiaaltöötajat ja tee koostööd lähedaste ning teiste asjakohaste spetsialistidega. Need on koduteenuse keeldumise korral esitatud tegevussoovitused. Tartu linnas selgitab kohalik omavalitsus abivajaduse ja sellele vastava abi ulatuse ning korraldab abi või aitab vajalike tegevustega (Sotsiaalhoolekande seaduse § 15 lg 1). Hindamisel tuleb arvestada inimese toimetulekut ning tema tegevusvõime ja elukeskkonnaga seotud asjaolusid (Sotsiaalhoolekande seaduse § 15 lg 2).

**Piirangud:** Ma ei saa valitud teabe põhjal öelda, milline õiguslik alus või menetlus lubaks kliendi tahte vastaselt tegutseda, ega anda juhist vahetu eneseohu korral tegutsemiseks.

**Täpsustav küsimus:** Kas kliendil on praegu vahetu oht endale või küsid üldise tegevuskorra kohta?

## A13 · sotsiaaltöötaja

**Küsimus:** Millal ja kuidas peaksin algatama eestkoste seadmise?

**Oodatud (küsija):** KOV võib/peab taotlema kohtult eestkostet (PKS § 203 jj), tõendid, isiku ärakuulamine, ajutine eestkoste

**Vastuse liik:** partial; paketis 12 allikat, tsiteeritud 5 (õigusakt 2, veebileht 2, muu 1); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 Perekonnaseadus § 203 lg 1–4; S2 Dementsuse Kompetentsikeskus: Õiguslikud küsimused; S3 Dementsuse Kompetentsikeskus: Õiguslikud küsimused; S4 Eestkostjal on lisaks asjaajamisele palju muid ülesandeid; S10 Tsiviilkohtumenetluse seadustik § 522 lg 1–5

**Vastus:** Eestkostet tasub kaaluda siis, kui ema ei suuda psüühikahäire tõttu kestvalt oma tegudest aru saada või neid juhtida. Mälumuutus ja pliidi sisselülitatuks jätmine annavad põhjust tema olukorda hinnata, kuid ei tõenda üksinda, et see seaduse tingimus on täidetud. Eestkostet saab seada ainult nendes ülesannetes, kus seda on vaja; kui ema huve saab kaitsta volikirja või lähedaste abiga, ei ole eestkoste vajalik (perekonnaseaduse (PKS) § 203 lg 1–2). Kui hindamise järel leiad, et tingimus võib olla täidetud ja leebemast toest ei piisa, saab eestkoste seadmise avalduse kohtule esitada ka Tartu linnavalitsus. Eestkoste seadmise otsustab kohus; sina saad sotsiaaltöötajana aidata asjaolud ja ema abivajaduse läbi töötada ning teha linnavalitsuses avalduse ettevalmistamiseks koostööd. Kohus piiritleb eestkoste ainult vajalikus ulatuses (PKS § 203 lg 1–2). Pane avalduse ettevalmistamisel kirja konkreetne probleem, mida on selle lahendamiseks juba tehtud, millistes otsustamise valdkondades ema tuge vajab ning mida kohtult palutakse. Lisa olulised tõendid ja põhjenda, miks võimalik eestkostja kandidaat sobib. Kohus selgitab eestkoste vajaduse ja ulatuse välja menetluses; vajaduse korral määrab …

**Piirangud:** Ma ei saa nende kirjeldatud asjaolude põhjal otsustada, kas ema ei suuda kestvalt oma tegudest aru saada või neid juhtida; selle ja eestkoste vajalikkuse hindab kohus.

## A14 · sotsiaaltöötaja

**Küsimus:** Kuidas korraldan üldhooldusteenuse ja kuidas arvestatakse kliendi omaosalust hooldereformi järgi?

**Oodatud (küsija):** SHS § 22¹ jj rahastamine, KOV-i osa, kliendi kohatasu, maksevõime

**Vastuse liik:** grounded; paketis 12 allikat, tsiteeritud 7 (juhend 1, veebileht 2, õigusakt 4); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 Väljaspool kodu osutatava üldhooldusteenuse juhend; S2 Väljaspool kodu osutatav üldhooldusteenus; S7 Hooldereform; S8 Sotsiaalhoolekande seadus § 15 lg 1–4; S9 Sotsiaalhoolekande seadus § 3 lg 1–2; S10 Sotsiaalhoolekande seadus § 22¹ lg 1–6; S11 Sotsiaalhoolekande seadus § 20 lg 1–4

**Vastus:** Üldhooldusteenus on kohaliku omavalitsuse korraldatav teenus täisealisele, kes ei tule tervise, tegevusvõime või elukeskkonna tõttu ajutiselt või püsivalt kodus iseseisvalt toime. Hinda abivajadust terviklikult, arvesta inimese enda tahet ja selgita, kas kodused teenused või ööpäevaringne hooldus tagavad talle abi. Teenusele ei tohi suunata sunniga. (Sotsiaalhoolekande seaduse § 20 lg 1; § 15 lg 1–2; § 3 lg 1 p 1 ja 5) Kui hindamine näitab, et inimene vajab ööpäevaringset üldhooldusteenust, korraldab teenuse tema rahvastikuregistrijärgne omavalitsus. Lähedane võib abivajadusest omavalitsusele teada anda; suulise pöördumise protokollid sotsiaaltöötajana ja võtad menetlusse. Selgita välja abivajadus ning aita teenuse korraldamisel. Kui teenuskohta kohe ei ole, kata ooteajal abivajadus sobivate ajutiste abimeetmetega. (Sotsiaalhoolekande seaduse § 15 lg 1; § 22¹ lg 1) Hooldereformi järgi tasub omavalitsus hooldustöötajate ja abihooldustöötajate nimetatud tööjõu-, tööriietuse ja isikukaitsevahendite, tervisekontrolli ja vaktsineerimise ning koolituse ja supervisiooni kulud. Omavalitsus võib seada nendele kuludele piirmäära, mis peab tagama teenuse kättesaadavuse. Klient tasub majutuse,…

## A15 · sotsiaaltöötaja

**Küsimus:** Tütar ütleb, et ta ei suuda hooldekodu puudujääki maksta. Kuidas ma ülalpidamiskohustust hindan ja mida vald peab tegema?

**Oodatud (küsija):** PKS § 96, § 102 (vabanemine), KOV peab teenuse korraldama ka vaidluse ajal; maksevõime hindamine

**Vastuse liik:** partial; paketis 10 allikat, tsiteeritud 5 (veebileht 2, õigusakt 2, muu 1); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 Väljaspool kodu osutatav üldhooldusteenus; S2 Väljaspool kodu osutatav üldhooldusteenus; S5 Sotsiaalhoolekande seadus § 22¹ lg 1–6; S6 Kohaliku omavalitsuse väljakutsed sotsiaalteenuste osutamisel; S8 Sotsiaalhoolekande seadus § 16 lg 1–3

**Vastus:** Tütre ütlus, et ta ei suuda puudujääki maksta, ei näita veel, kas ega kui palju ta saab ülalpidamiseks panustada. Hinda tema maksevõimet eraldi ning ära eelda, et kogu puudujääk tuleb tütrelt küsida. 2017. aastal kirjeldati maksevõime hindamist individuaalse hindamisena, kus tuleb arvestada ülalpidamiskohustuse aluseid; see käsitlus viitab perekonnaseaduse §-dele 102 ja järgnevale, kuid ei anna alust määrata tütre konkreetset makset. (Sotsiaaltöö 2017. aasta käsitluse järgi.) Enne kui hindad, kas teenuse saajale jääb üldhooldusteenuse kuludest katmata osa, arvesta esmalt kohaliku omavalitsuse rahastatavate hoolduskulude ning teenuse saaja sissetulekust sõltuva toetusega. Üldhooldusteenuse rahastamisel katab omavalitsus nimetatud hooldustöötajate kulud; kui teenuse saaja sissetulek jääb alla seaduses kirjeldatud võrdlusmäära, katab omavalitsus tasutavate kulude ja sissetuleku vahe, kuid mitte üle võrdlusmäära ja sissetuleku vahest. Arvestatav sissetulek hõlmab riiklikku pensioni, kogumispensioni, töövõimetoetust ja sotsiaalmaksuga maksustatavat tulu. (Sotsiaalhoolekande seaduse § 22¹ lg 2 ja 5.) Tasu määramisel arvesta teenuse mahtu ja maksumust ning teenuse saaja ja tema pere majan…

**Piirangud:** Esitatud teave ei anna alust arvutada tütre võimalikku makset ega kinnitada tema konkreetset ülalpidamiskohustust. Selle juhtumi täpseks korraldamiseks on vaja teada ema rahvastikuregistrijärgset omavalitsust ja ema ning tütre majanduslikku olukorda.

**Täpsustav küsimus:** Milline on ema rahvastikuregistrijärgne omavalitsus? Kas sul on juba andmed ema ja tütre sissetuleku ning tütre muude ülalpidamiskohustuste kohta?

## A16 · sotsiaaltöötaja

**Küsimus:** Milliseid andmeid ma võin tütrega jagada ilma kliendi nõusolekuta?

**Oodatud (küsija):** isikuandmete kaitse, nõusolek, seadusest tulenevad erandid; minimaalne vajalik

**Vastuse liik:** partial; paketis 13 allikat, tsiteeritud 5 (õigusakt 3, muu 2); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 Sotsiaalseadustiku üldosa seadus § 8; S2 Tähelepanekutest sotsiaalvaldkonnas andmekaitse inspektsiooni juristi pilgu läbi; S3 Andmekaitsespetsialist aitab muuta teenused turvaliseks ja usaldusväärseks; S6 Isikuandmete kaitse seadus § 14; S7 Haldusmenetluse seadus § 7 lg 1–5

**Vastus:** Ära jaga tütrega kliendi juhtumiandmeid üksnes põhjusel, et ta on klienti tütar või pöördus sinu poole. Sotsiaalkaitse vajadus ja hüvitise saamine on era- ja perekonnaelu saladus (Sotsiaalseadustiku üldosa seaduse § 8). Töö käigus saadud andmeid ei tohi avaldada kõrvalistele isikutele ning ligipääs peab olema neil ametnikel, kes vajavad neid oma tööülesannete täitmiseks. Kui töötled andmeid haldusmenetluses, võib neid menetletavas asjas töödelda vajalike asjaolude kohta haldusakti andmiseks, toimingu tegemiseks või halduslepingu sõlmimiseks, kui seadus ei sätesta teisiti (Haldusmenetluse seaduse § 7 lg 5). Iga kord hinda, kas tütrele info edastamine on konkreetse ülesande täitmiseks vajalik ja milline on selle õiguslik alus. Piira edastatava info maht vajalikuga ning arvesta eesmärgikohasuse ja minimaalsuse põhimõttega.

**Piirangud:** Ma ei saa siinsete andmete põhjal öelda, milliseid konkreetseid andmeid võib sellele tütrele edastada: see sõltub edastamise eesmärgist ja tütre õiguslikust rollist kliendi suhtes.

**Täpsustav küsimus:** Kas tütrel on kliendi seadusliku esindaja staatus või kliendi nõusolek, ja mis eesmärgil soovid talle infot anda?

## A17 · sotsiaaltöötaja

**Küsimus:** Kas STAR-is peab selle juhtumi kohta midagi kirja panema ja mis tähtajaga pean otsuse tegema?

**Oodatud (küsija):** STAR-i kasutamine KOV-is; menetluse tähtaeg (sotsiaalseadustiku üldosa seadus, 10 tööpäeva) kui tõendites

**Vastuse liik:** partial; paketis 11 allikat, tsiteeritud 4 (õigusakt 2, uuring/aruanne 1, veebileht 1); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 Sotsiaalhoolekande seadus § 15 lg 1–4; S2 Täisealise inimese abivajaduse hindamine – uued võimalused STAR-is; S4 STAR; S9 Sotsiaalseadustiku üldosa seadus § 25 lg 1–2

**Vastus:** Jah, STAR-is saad pöördumise registreerida, menetluse käiku hallata ja toiminguid dokumenteerida. Täisealise inimese abivajaduse hindamise andmeid saab STAR-is sisestada ka lihtmenetluses, ilma juhtumimenetlust algatamata. See kirjeldab STAR-i võimalusi, mitte kohustust kasutada just kindlat menetlusviisi. Vaata juhiseid: sotsiaalkindlustusamet.ee/spetsialistile-ja-koostoopartnerile/star. Tartu linn peab välja selgitama abi saamiseks pöördunud inimese abivajaduse ja sellele vastava abi ulatuse ning korraldama abi või aitama seda saada. Hindamisel tuleb arvestada inimese toimetulekut ning tema isiklikku ja sotsiaalset keskkonda (Sotsiaalhoolekande seaduse § 15 lg 1–2). Kui pead silmas hüvitise andmise või sellest keeldumise otsust, tuleb see teha kümne tööpäeva jooksul nõuetekohase taotluse esitamisest või muu hüvitisele õiguse tekkimise aluseks oleva sündmuse, asjaolu või tingimuse saabumisest (Sotsiaalseadustiku üldosa seaduse (SÜS) § 25 lg 1).

**Piirangud:** Ma ei saa nende sätete põhjal öelda, mis tähtajaks tuleb teha abivajaduse hindamise otsus, kui sa ei pea silmas hüvitise andmise otsust.

**Täpsustav küsimus:** Kas mõtled hüvitise andmise või sellest keeldumise otsust või abivajaduse hindamise tulemust?

## A18 · sotsiaaltöötaja

**Küsimus:** Kas ma saan suunata ta ka riigi rahastatud teenustele, näiteks igapäevaelu toetamise teenusele?

**Oodatud (küsija):** vanaduspensioniealise dementsusega isikule riigi erihoolekandeteenust ei osutata (SHS § 72 lg 2); KOV-i teenused

**Vastuse liik:** partial; paketis 9 allikat, tsiteeritud 5 (õigusakt 3, muu 1, veebileht 1); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 Sotsiaalhoolekande seadus § 88; S3 Teekond erilise lapse kõrval; S4 Erihoolekandeteenused; S5 Sotsiaalhoolekande seadus § 72 lg 1–6; S7 Sotsiaalhoolekande seadus § 71 lg 1–5

**Vastus:** Saad aidata tal riikliku igapäevaelu toetamise teenuse võimalust välja selgitada, kuid suunamisotsuse teeb Sotsiaalkindlustusamet. Teenuse saamise õigus on täisealisel inimesel, kellel on raske, sügav või püsiva kuluga psüühikahäire ja kellele ei osutata samal ajal kogukonnas elamise, päeva- ja nädalahoiu ega ööpäevaringset erihooldusteenust. Sotsiaalkindlustusamet väljastab suunamisotsuse, kui tingimused on täidetud, riigieelarves on raha ja soovitud teenuseosutajal on vaba koht (sotsiaalhoolekande seaduse (SHS) § 88; § 71 lg 1). Kui emal on dementsuse diagnoos, ta on jõudnud vanaduspensioniikka ega ole dementsusele lisaks raske, sügava või püsiva kuluga psüühikahäiret, siis riigieelarvest seda teenust ei rahastata (SHS § 72 lg 2 p 1; § 88). Mälu halvenemine ja pliidi sisselülitatuks jätmine üksi ei näita, kas need tingimused on täidetud. Kui tingimused võivad olla täidetud, aita taotlus vajalike dokumentidega Sotsiaalkindlustusametile esitada või suuna taotluse esitamiseks eesti.ee kaudu. Sotsiaalkindlustusamet hindab teenusevajadust ja teeb otsuse; vaata teenuse kirjeldust ja juhiseid: sotsiaalkindlustusamet.ee/puue-ja-hoolekanne/erihoolekanne/erihoolekandeteenused.

**Piirangud:** Praegu kirjeldatu põhjal ei saa ma öelda, kas emal on diagnoos, mis vastab teenuse saamise tingimustele, ega kas kehtib dementsusega seotud rahastamisvälistus.

**Täpsustav küsimus:** Kas emal on dementsuse või muu raske, sügava või püsiva kuluga psüühikahäire diagnoos?

## A19 · teenuseosutaja

**Küsimus:** Oleme Tartus koduteenust osutav ettevõte. Linn suunas meile 81-aastase dementsusega kliendi, kes on võõraste suhtes umbusklik. Kuidas peaksime teenuse alustamise ja usalduse loomise planeerima?

**Oodatud (küsija):** teenuse kavandamine kliendi ja lähedastega, järjepidev töötaja, dementsusega inimesega suhtlemine, koostöö linnaga

**Vastuse liik:** grounded; paketis 12 allikat, tsiteeritud 5 (veebileht 2, juhend 1, muu 1, õigusakt 1); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 Dementsuse Kompetentsikeskus: Dementsusesõbralik asutus; S2 Dementsuse Kompetentsikeskus: Dementsusesõbralik asutus; S4 Koduteenuse kvaliteedijuhis; S5 Dementsusega inimeste toetamisel tuleb olla avatud uute lahenduste leidmisele; S10 Sotsiaalhoolekande seadus § 18 lg 1–2

**Vastus:** Alusta kliendiga tutvumisest, mitte ainult toimingute loetelust: uuri tema elulugu, harjumusi ja vajadusi ning seda, millised teemad või tegevused teda rahustavad. Kui klient seda soovib, küsi seda ka lähedastelt. Loo esimestel kohtumistel aega rahulikuks vestluseks ja kasuta kliendile sobivat suhtlusviisi. Lisateavet leiad: dementsus.ee/dementsusesobralik-asutus. Kohtu kliendiga rahulikult ja selgita enne iga toimingut, mida kavatsed teha. Räägi rahuliku häälega, vali sissejuhatuseks talle tuttav teema ning julgusta teda tegema ise seda, millega ta toime tuleb. Kui üks võte ei sobi, proovi teistsugust lähenemist. Kui hooldustoiming tekitab tugevat vastuseisu, võib üks töötaja toimingut teha ja teine kliendiga rääkida või tema tähelepanu mujale juhtida. Leppige teenuse alustamisel linnaga ja kliendiga kokku, millist abi ja milliseid toiminguid klient vajab. Linn koostab teenuse osutamise haldusakti või -lepingu koostöös kliendi ja teenuseosutajaga ning määrab seal kindlaks vajalikud toimingud (Sotsiaalhoolekande seaduse § 18 lg 2). Teie saate hoolduskavas või -plaanis kirjeldada, mida, millal ja kuidas teete, ning jälgida kliendi tegevusvõime muutusi.

## A20 · teenuseosutaja

**Küsimus:** Milliseid nõudeid peavad täitma meie koduhooldajad?

**Oodatud (küsija):** seaduse ja KOV-i lepingu nõuded (kvalifikatsioon/koolitus kui tõendites), kvaliteedijuhis

**Vastuse liik:** partial; paketis 6 allikat, tsiteeritud 3 (juhend 1, õigusakt 2); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 Koduteenuse juhend; S2 Sotsiaalhoolekande seadus § 19; S5 Sotsiaalhoolekande seadus § 22 lg 1–6

**Vastus:** Sotsiaalhoolekande seaduse § 19 järgi ei tohi koduteenust vahetult osutada inimene, kelle karistatus tahtlikult toime pandud kuriteo eest võib ohustada teenuse saaja elu, tervist või vara. Koduteenuse juhendis on soovitatud, et vahetult teenust osutav töötaja oleks täisealine, erialase ettevalmistusega ja/või varasema sihtrühmaga töötamise kogemusega ning sobiks isikuomadustelt teenuse saajaga. Juhendis on samuti kirjas, et töölepingus või ametijuhendis peab olema keeld võtta kliendilt vastu väärtuslikke kingitusi või mõjutada teda töötajat testamendis nimetama; väikese väärtusega viisakuskingitused on mõistlikult lubatavad. Sotsiaalhoolekande seaduse § 22 lg 1 järgi peab teenuseosutajal olema piisavalt personali, kelle kvalifikatsioon ja töökoormus võimaldavad hooldusplaanis määratud tegevusi ja toiminguid teha. See paragrahv käsitleb hooldusteenuse osutajat ega kehtesta siin esitatud teksti põhjal koduteenuse töötaja nõudeid.

**Piirangud:** Ma ei saa selle teabe põhjal öelda, kas teie Tartus tegutsemise puhul on mõeldud Tartu linna või Tartu valda. Esitatud juhend kirjeldab töötajale soovitatud omadusi, mitte siduvaid kvalifikatsiooninõudeid; raportis märgitakse, et koduteenuse töötajale ei olnud riiklikult kvalifikatsiooninõudeid määratud, kuid see kirjeldus pärineb 2022. aastast ega näita, millised nõuded kehtivad praegu.

## A21 · teenuseosutaja

**Küsimus:** Kuidas peaksime teenuse osutamist dokumenteerima ja kellele aru andma?

**Oodatud (küsija):** teenuse kava, päevik, KOV-i lepingu aruandlus, andmekaitse

**Vastuse liik:** partial; paketis 12 allikat, tsiteeritud 3 (juhend 2, õigusakt 1); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 Koduteenuse kvaliteedijuhis; S2 Koduteenuse juhend; S5 Sotsiaalhoolekande seadus § 18 lg 1–2

**Vastus:** Dokumenteeri teenuse saaja abivajadus, individuaalsed eesmärgid ja kokkulepitud toimingud hoolduskavas või -plaanis. Kasuta seda toimingute — mida, millal ja kuidas tehti — ning inimese toimetuleku jälgimiseks. Selgita teenuse saajale arusaadavalt tema õigused ja kohustused ning fikseeri need teenuse osutamise lepingus või muus dokumendis. Anna Tartu omavalitsusele tagasisidet teenuse saaja seisundi muutustest ja vajadusest teenuse sisu uuesti hinnata. Lähedastele anna sellist tagasisidet teenuse saaja nõusolekul. Teenuse osutamise ajal jälgi inimese toimetulekut; juhendis on soovitatud registreerida teenusele suunamine ja teenuse osutamine STARis. Kui abivajadus muutub, vastutab kordushindamise eest kohaliku omavalitsuse sotsiaaltöötaja. Sotsiaalhoolekande seaduse § 18 lg 1–2 järgi hindab kohalik omavalitsus abivajaduse määra iga inimese puhul eraldi ja korraldab selle muutumisel kordushindamise. Omavalitsus koostab koos teenuse saaja ja teenuseosutajaga haldusakti või halduslepingu, milles määratakse kindlaks iseseisvat toimetulekut toetavad toimingud.

**Piirangud:** Ma ei saa siin oleva teabe põhjal öelda, kas koduteenuse osutajale kehtib eraldi kohustuslik aruandlusvorm või -tähtaeg; esitatud juhend kirjeldab tagasiside andmist ja STARi kasutamist soovitusena.

## A22 · teenuseosutaja

**Küsimus:** Klient kukkus ja meie töötaja leidis ta põrandalt. Mida me peame tegema ja keda teavitama?

**Oodatud (küsija):** esmaabi/112, lähedased, KOV, juhtumi dokumenteerimine, kukkumiste ennetus

**Vastuse liik:** partial; paketis 10 allikat, tsiteeritud 5 (muu 2, juhend 1, õigusakt 2); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 Koduses keskkonnas toimunud kukkumisjuhtumid: praegune korraldus ja võimalikud lahendused; S2 Koduses keskkonnas toimunud kukkumisjuhtumid: praegune korraldus ja võimalikud lahendused; S3 Koduteenuse juhend; S4 Sotsiaalhoolekande seadus § 13; S5 Sotsiaalhoolekande seadus § 18 lg 1–2

**Vastus:** Kui klient on praegu põrandal, hinda esmalt, kas tal võib olla vigastus või muu terviserisk. Kukkumist ei saa pelgalt esmase teate põhjal pidada alati olukorraks, kus piisab koduhooldaja abist: vajaduse korral kaasa kiirabi, pääste või politsei. Ära ürita klienti üksi tõsta, kui see ületab töötaja tööohutuse piirid; abi võib vajada mitut inimest, tõstmisabivahendit või päästeametit. Töötaja peab üldjuhul teatama kliendi seisundi muutusest; koduteenuse juhendis on see toodud vahetult teenust osutava töötaja töölepingu või ametijuhendi kohustusena. Kui kõrvalabi vajadus muutub, peab kordushindamise tegema kohalik omavalitsus. Sotsiaalhoolekande seaduse § 18 lg 1 järgi hinnatakse vajadust uuesti, kui see muutub tegevusvõime või elukeskkonna tõttu. Kui juhtum näitab, et klient vajab sotsiaalhoolekannet, tuleb sellest teatada tema viibimiskoha järgsele omavalitsusele. See kohustus kehtib ka teistele isikutele; Sotsiaalhoolekande seaduse § 13 järgi kuulub teavitajate hulka ka hoolekandeasutuse töötaja.

**Piirangud:** Ma ei saa siin oleva teabe põhjal määrata, kas klient vajab praegu kiirabi; täpsemat vigastuse või terviseriski hindamise juhist siin ei ole.

**Täpsustav küsimus:** Kas klient on praegu endiselt põrandal või on tal vigastuse või halva enesetunde tunnuseid?

## A23 · teenuseosutaja

**Küsimus:** Kas me tohime kliendi eest tema pangakaardiga poes maksta?

**Oodatud (küsija):** kliendi rahaga toimingud ainult kokkuleppel/volitusega, dokumenteerimine, PIN-koodi mitte hoida; KOV-i kord

**Vastuse liik:** partial; paketis 7 allikat, tsiteeritud 2 (juhend 2); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 Koduteenuse juhend; S2 Koduteenuse juhend

**Vastus:** Sa võid klienti poes abistada ja teda rahaliste tehingute tegemisel juhendada, kuid koduteenuse juhendi järgi tohib kliendile väljastatud pangakaarti kasutada ainult kaardi omanik. Seega ära maksa kliendi kaardiga tema eest. Kui kasutate ostude tegemisel sularaha, kehtesta selged reeglid selle kasutamise ja aruandluse kohta, näiteks kuidas ostukviitungeid esitatakse ja ettemakseid arvestatakse.

**Piirangud:** Ma ei saa siin oleva teabe põhjal kinnitada, kas eraldi volitus muudaks pangakaardi kasutamise lubatavaks. Juhend ütleb, et kaarti tohib kasutada üksnes omanik, kuid 2022. aasta projektikirjelduses on nimetatud ka volitatud isikut.

## A24 · teenuseosutaja

**Küsimus:** Linn tahab, et teeksime ka nädalavahetustel visiite. Kuidas see lepinguliselt käib ja kes maksab?

**Oodatud (küsija):** hankeleping/teenusleping KOV-iga, tasu KOV-i ja kliendi omaosalus KOV-i korra järgi

**Vastuse liik:** partial; paketis 11 allikat, tsiteeritud 6 (juhend 4, muu 1, õigusakt 1); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 Koduteenuse juhend; S2 Koduteenuse kvaliteedijuhis; S3 Koduteenuse juhend; S4 Koduteenuse juhend; S5 Koduteenuse teenusedisaini projekti raport; S9 Sotsiaalhoolekande seadus § 18 lg 1–2

**Vastus:** Nädalavahetuse visiidid tuleb siduda kliendi tegeliku abivajadusega. Teenuse maht, toimingud ja nende sagedus lepitakse kokku; vajaduse korral võib teenus toimuda ka nädalavahetusel. KOV koostab koos kliendi ja teenuseosutajaga teenuse osutamise haldusakti või halduslepingu, kus määratakse vajalikud toimingud (Sotsiaalhoolekande seaduse § 18 lg 2). Kui kokkulepitud teenuse vajadus muutub, tuleb muuta ka lepingut või haldusakti ja hooldusplaani. Teenuse saajalt võib teenuse eest tasu võtta. Tasu kujundamisel arvestatakse teenuse vajadust ja maksumust ning kliendi ja tema pere maksevõimet; tasu ei tohi takistada kliendil abi saamast. Seega ei saa nädalavahetuse visiitide eest maksjat ega hinda üksnes sellest järeldada, et linn neid soovib. 2022. aastal kirjeldati Tartu linna koduteenust tasuta teenusena, välja arvatud juhul, kui abivajaja seadusjärgne ülalpidaja elas samuti Tartu linnas. See on toonane hinnastamise näide, mitte tõend praeguse nädalavahetuse teenuse rahastamise või hinna kohta.

**Piirangud:** Ma ei saa siin oleva teabe põhjal kindlaks teha, kuidas Tartu linn praegu nädalavahetuse visiite rahastab või millise hinnaga neid osutatakse.

## A25 · teenuseosutaja

**Küsimus:** Kui klient läheb hooldekodusse, kuidas me teenuse lõpetame ja andmed üle anname?

**Oodatud (küsija):** teenuse lõpetamine KOV-i otsusega, andmete üleandmine seaduse alusel, säilitamine

**Vastuse liik:** partial; paketis 12 allikat, tsiteeritud 5 (juhend 2, muu 1, õigusakt 2); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 Koduteenuse juhend; S2 Koduteenuse juhend; S3 Isikuandmete edastamisest ametialases koostöös; S5 Sotsiaalhoolekande seadus § 18 lg 1–2; S6 Sotsiaalhoolekande seadus § 144 lg 1

**Vastus:** Kui kliendi abivajadus muutub ja ta ei vaja enam määratud koduteenust, hindab Tartu linn uuesti, kas koduteenus jätkub või tuleb see lõpetada. Kordushindamise eest vastutab linna sotsiaaltöötaja ning teenuse vajaduse muutudes muudetakse ka teenuse osutamise haldusakti või -lepingut ja hooldusplaani (Sotsiaalhoolekande seaduse (SHS) § 18 lg 1–2). Juhendis on koduteenuse lõpetamise võimaliku alusena nimetatud ka seda, et inimene siirdub elama teise omavalitsusse või teenust takistav asjaolu püsib. Hooldekodusse kolimist ennast ei ole seal eraldi lõpetamise alusena nimetatud. Andmeid anna hooldekodule edasi ainult vajalikus mahus ja kindla õigusliku aluse korral; kui eriseadus ei näe andmete edastamiseks erandit ette, on peamiseks aluseks kliendi nõusolek. Selgita kliendile, millist teavet edastad ja miks. 2017. aasta käsitluses rõhutatakse andmete minimaalsuse ja eesmärgipärasuse põhimõtet. Sotsiaalteenuste ja -toetuste andmeregistrisse kannab kohaliku omavalitsuse korraldatava sotsiaalteenuse taotluse ja teenusele suunamise otsuse andmed omavalitsus, mitte teenuseosutaja (SHS § 144 lg 1 p 11). Praktiliselt kooskõlasta lõpetamise aeg ja kordushindamine Tartu linna sotsiaaltöötajaga. …

**Piirangud:** Ma ei saa siin oleva teabe põhjal öelda, milline on Tartu linna täpne lõpetamise ja andmete üleandmise kord hooldekodusse kolimise korral. Samuti ei selgu, kas kliendi puhul on kordushindamine või teenuse lõpetamise otsus juba tehtud.

## B01 · pöörduja

**Küsimus:** Kaotasin töö ja mul on kaks last, 6 ja 12. Üür on kaks kuud maksmata ja üürileandja ähvardab välja tõsta. Elan Narvas. Mida ma esimesena tegema peaksin?

**Oodatud (küsija):** Narva linna sotsiaalabi (toimetulekutoetus, täiendavad toetused), Töötukassa registreerimine, üürileandjaga suhtlus, võlanõustamine

**Vastuse liik:** partial; paketis 74 allikat, tsiteeritud 8 (õigusakt 3, muu 4, kontakt 1); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 Võlaõigusseadus § 316 lg 1–6; S12 Sotsiaalhoolekande seadus § 133 lg 2¹–5; S13 Sotsiaalhoolekande seadus § 133 lg 5–8; S32 Toimetulekutoetus; S35 Võlanõustamisteenuse taotlus; S49 Eluruumi tagamine; S63 Võlanõustamisteenus; S65 Alisa Lanno

**Vastus:** Tee esimesena ühendust Narva Linna Sotsiaalabiametiga ja ütle kohe, et sul on kaks last, üür on kaks kuud maksmata ning kardad kodu kaotada. Küsi toimetulekutoetust ja võlanõustamist. Toimetulekutoetuse taotluse saad esitada Sotsiaalabiametile hiljemalt kuu viimasel tööpäeval koos sissetuleku- ja eluasemekulude dokumentidega. Võlanõustamise taotlusele lisa võlgnevust ja majanduslikku olukorda tõendavad dokumendid. Vaata vorme ja teenuse infot: narva.ee/blanketid-ja-vormid ja narva.ee/sotsiaalteenused/-/asset_publisher/J8TOJukj0wfP/content/volanoustamisteenus. Toimetulekutoetust arvestades võidakse arvesse võtta jooksval kuul tasumisele kuuluv üür, kuid varem tekkinud üürivõlga toetuse arvestusse ei lisata ega kaeta selle toetusega (Sotsiaalhoolekande seaduse § 133 lg 5 ja 7). Kui sa ei suuda endale ja perele sobivat eluruumi ise tagada, saad taotleda Narva eluruumi tagamise teenust. Esita Sotsiaalabiametile kirjalik taotlus, kirjelda eluruumi vajadust ja oma majanduslikku olukorda ning lase kõigil täisealistel pereliikmetel taotlus allkirjastada. Küsi teenuse kontaktisikult Alisa Lannolt; vaata lähemalt: narva.ee/sotsiaalteenused/-/asset_publisher/J8TOJukj0wfP/content/eluruumi-taga…

**Piirangud:** Ma ei saa nende andmete põhjal öelda, kas üürileandja saab lepingu sinu puhul üles öelda: selleks on vaja teada, kas oled saanud kirjaliku lisaaja ja hoiatuse ning millal ja kui palju üüri maksmata jäi.

**Täpsustav küsimus:** Kas oled üürileandjalt saanud kirjaliku ülesütlemisavalduse või vähemalt 14-päevase lisaaja ja hoiatuse?

## B02 · pöörduja

**Küsimus:** Kuidas toimetulekutoetust taotleda ja kas mu laste lastetoetus läheb sissetulekuna arvesse?

**Oodatud (küsija):** SHS § 131–134, taotlus KOV-ile, mida ei arvestata sissetulekuna (kui tõendites)

**Vastuse liik:** grounded; paketis 68 allikat, tsiteeritud 5 (õigusakt 2, veebileht 1, muu 2); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 Sotsiaalhoolekande seadus § 132 lg 1–5¹; S3 Toimetulekutoetus; S8 Sotsiaalhoolekande seadus § 133 lg 5–8; S29 Toimetulekutoetus; S64 Võlanõustamisteenus

**Vastus:** Narvas saad jooksva kuu toimetulekutoetuse taotluse esitada Narva linnale hiljemalt kuu viimasel tööpäeval. Lisa andmed arvestusse minevate pereliikmete kohta ning eelmise kuu netosissetulekuid tõendavad dokumendid. Kui soovid, et arvestataks eluasemekulusid, lisa ka eluruumi kasutamise õigust ja jooksval kuul tasumisele kuuluvaid eluasemekulusid tõendavad dokumendid. Narva toimetulekutoetuse avalduse leiad aadressilt narva.ee/sotsiaaltoetused/-/asset_publisher/c6DGSHfBeUiA/content/toimetulekutoetus. (Sotsiaalhoolekande seaduse § 132 lg 1–4) Lastetoetus arvestatakse üldjuhul sissetulekuna: peretoetused kuuluvad arvestatavate tulude hulka, kui need ei ole seaduses erandina välja toodud. (Sotsiaalministeeriumi teabelehel kirjeldatud üldreegel) Kui taotluse esitamise kuul saadav toimetulekutoetus arvestatakse koos eluasemekuludega, saab toetuse arvestusse võtta jooksval kuul tasumisele kuuluva üüri, kuid varasemat üürivõlga ei arvestata ega kaeta toimetulekutoetusest. Narvas saad üürivõla tõttu küsida ka võlanõustamist: esita Sotsiaalabiametile taotlus ja lisa võlgnevust ning majanduslikku olukorda tõendavad dokumendid; vaata narva.ee/sotsiaalteenused/-/asset_publisher/J8TOJukj0wfP/co…

**Piirangud:** Ma ei saa siin kindlaks teha, kas sinu laste konkreetne toetus kuulub mõne erandi alla; esitatud teave nimetab peretoetusi üldiselt arvestatava tuluna, kuid ei kirjelda eraldi lastetoetuse erandeid.

## B03 · pöörduja

**Küsimus:** Мне пришло письмо от судебного исполнителя. Что мне делать?

**Oodatud (küsija):** vastus vene keeles; kohtutäituri kiri, täitemenetlus, arestimisest vaba summa, võlanõustamine, tasuta abi

**Vastuse liik:** partial; paketis 68 allikat, tsiteeritud 3 (veebileht 2, muu 1); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 Olen saanud täitmisteate. Mida teha?; S2 Võlgniku põhilised õigused täitemenetluses; S57 Võlanõustamisteenus

**Vastus:** Если в письме указано, что это «täitmisteade» (уведомление о начале исполнительного производства), сначала проверьте срок добровольной оплаты и сумму. Если вы не можете заплатить в этот срок, сразу свяжитесь с судебным исполнителем. Сообщите о потере работы и о детях на вашем иждивении, приложите подтверждающие документы. Чтобы сохранить прожиточный минимум на банковском счёте, подайте судебному исполнителю отдельное заявление и укажите банк, в котором хотите сохранить эту сумму. Подробнее: juristaitab.ee/et/olen-saanud-taitmisteate-mida-teha Вы можете попросить суд приостановить исполнительное производство или разрешить платить долг частями. Если арестован доход, можно попросить судебного исполнителя освободить от взыскания сумму, необходимую для содержания вас и детей. Вы вправе запросить у исполнителя сведения о производстве и копии документов. Подробнее о правах: juristaitab.ee/et/volgniku-pohilised-oigused-taitemenetluses Поскольку вы живёте в Нарве и у вас есть долги, можно также обратиться в Нарвский социальный департамент за услугой консультации по долгам. Подайте письменное заявление и приложите документы о долгах и своём материальном положении. Подробнее: narva.ee/sotsiaa…

**Piirangud:** Я не могу определить по вашему сообщению, какой именно документ прислал судебный исполнитель и какой срок в нём указан.

**Täpsustav küsimus:** Как называется письмо и какой срок или дата указаны в нём? Можете переписать эти строки, убрав личные данные.

## B04 · pöörduja

**Küsimus:** Kas ma saan Töötukassast töötuskindlustushüvitist, kui mind koondati?

**Oodatud (küsija):** TKindlS § 6: 12 kuud 36 jooksul, koondamine lubatud põhjus; registreerimine; baasmäär

**Vastuse liik:** grounded; paketis 69 allikat, tsiteeritud 2 (veebileht 1, õigusakt 1); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 Töötuskindlustushüvitis; S6 Töötuskindlustuse seadus § 6 lg 1–5

**Vastus:** Jah, koondamine võib anda õiguse sissetulekupõhisele töötuskindlustushüvitisele, kui oled töötuna arvele võetud ja sul on töötuna arvelevõtmisele eelnenud 36 kuu jooksul vähemalt 12 kuud töötuskindlustusstaaži (Töötuskindlustuse seaduse § 6 lg 1 ja 4). Kui sinu töösuhe selle tööandjaga kestis viis kuni kümme aastat, tekib õigus hüvitisele 30 kalendripäeva pärast töösuhte lõppu; üle kümne aasta kestnud töösuhte korral 60 kalendripäeva pärast. Kui töösuhe kestis alla viie aasta, ei anna see lõige ooteaja kohta vastust. Töötukassa lehelt leiad tingimused ja avalduse esitamise teabe: tootukassa.ee/et/teenused/tootuskindlustushuvitis.

**Piirangud:** Ma ei saa sinu kirjeldusest hinnata, kas sul on nõutav töötuskindlustusstaaž või kui kaua sinu töösuhe selle tööandjaga kestis.

**Täpsustav küsimus:** Kas sind on juba töötuna arvele võetud ning mitu kuud töötuskindlustusstaaži on sul viimase 36 kuu jooksul? Kui kaua kestsid su töösuhe selle tööandjaga?

## B05 · pöörduja

**Küsimus:** Mu 12-aastane poeg ei käi enam koolis ja on agressiivne. Kust ma abi saan?

**Oodatud (küsija):** kool (tugispetsialistid), KOV lastekaitse, Rajaleidja/perearst, vaimse tervise abi

**Vastuse liik:** grounded; paketis 75 allikat, tsiteeritud 4 (veebileht 2, õigusakt 2); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S4 MTÜ Lastekaitse Liit: Kuhu pöörduda abi saamiseks?; S6 MTÜ Peaasjad: Mida saab teha õpetaja, kui ta märkab õpilase muutunud käitumist?; S9 Lastekaitseseadus § 27 lg 1–5; S11 Lastekaitseseadus § 31 lg 1–2

**Vastus:** See, et poeg enam koolis ei käi ja käitub agressiivselt, võib tähendada, et ta vajab abi. Räägi sellest esimesel võimalusel tema kooliga ning pöördu kohaliku lastekaitsetöötaja või lasteabi poole. Lasteabi telefon on 116 111. Abivajavast lapsest tuleb teatada viivitamata kohaliku omavalitsuse üksusele või lasteabitelefonil 116 111 (Lastekaitseseaduse § 27 lg 2). Kui keegi on praegu vahetus ohus, helista 112. Hädaohus olevast lapsest tuleb viivitamata teatada hädaabinumbril 112 (Lastekaitseseaduse § 31 lg 2).

**Täpsustav küsimus:** Kas sinu poeg ja teised pereliikmed on praegu turvaliselt?

## B06 · pöörduja

**Küsimus:** Laste isa ei maksa elatist. Mida ma teha saan?

**Oodatud (küsija):** elatise nõudmine (kohus, maksekäsk), elatisabi SKA kaudu, õigusabi

**Vastuse liik:** partial; paketis 73 allikat, tsiteeritud 4 (veebileht 3, õigusakt 1); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 Mida teha, kui lahuselav vanem ei maksa elatist?; S3 Elatisabi; S5 Elatis - hagi või avaldus? Kuhu esitada?; S10 Perehüvitiste seadus § 50 lg 1–5

**Vastus:** Kui teil pole veel elatist määravat kohtulahendit ega notariaalset või perelepituse kokkulepet, saad esitada lapse nimel elatisnõude kohtule. Kui isa ei vaidle nõudele põhimõtteliselt vastu, võib sobida maksekäsu kiirmenetlus; avalduse saab esitada E-toimikus. Vaata juhiseid: juristaitab.ee/et/elatis-hagi-voi-avaldus-kuhu-esitada Kui elatis on kohtulahendiga määratud või notariaalses või perelepituse kokkuleppes kokku lepitud, aga seda ei maksta, saad pöörduda kohtutäituri poole ja algatada täitemenetluse. Kohtutäiturile saad koos täitemenetluse avaldusega esitada ka täitemenetlusaegse elatisabi taotluse. Elatisabi on kuni 200 eurot lapse kohta kalendrikuus; kui isa maksab osa elatisest, arvestatakse abi makstud summa võrra väiksemana. Abi saab taotleda, kui täitetoimiku avamisest on möödunud üks kuu ja seejärel on elatis jäänud tasumata. Loe lisa: sotsiaalkindlustusamet.ee/perehuvitised-ja-muud-toetused/elatisabi (Perehüvitiste seaduse § 50 lg 1–5)

**Täpsustav küsimus:** Kas elatis on juba kohtuotsuse või notariaalse või perelepituse kokkuleppega määratud ning kas kohtutäituri juures on elatise täitemenetlus alanud?

## B07 · pöörduja

**Küsimus:** Laste isa saadab mulle ähvardavaid sõnumeid ja ma kardan teda.

**Oodatud (küsija):** ohu korral 112; ohvriabi/lähisuhtevägivalla abi, politsei, lähenemiskeeld, turvakodu; rahulik toon

**Vastuse liik:** grounded; paketis 73 allikat, tsiteeritud 5 (veebileht 5); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 Vägivalla märkajale; S2 Lähisuhtevägivald: mis see on ja kuhu pöörduda?; S4 Naiste tugikeskused; S5 Kuidas koguda tõendusmaterjali kogetud lähisuhtevägivalla kohta?; S6 Perelepitus

**Vastus:** Mul on kahju, et pead seda kogema. Kui tunned, et oht on vahetu, helista kohe 112 ja püüa minna koos lastega turvalisse kohta. Ära jää ähvardustega üksi. Võid helistada ohvriabi kriisitelefonile 116 006. Sealt saad tuge ja nõu ka siis, kui sa pole politseisse pöördunud või juhtumist teatanud. Vaata lähemalt: palunabi.ee/et/artiklid/kuidas-koguda-toendusmaterjali-kogetud-lahisuhtevagivalla-kohta Hoia ähvardavad sõnumid alles ja pane kuupäevadega kirja, millal ähvardused saadeti. Narvas saad pöörduda ka naiste tugikeskusesse: abi on tasuta ja saad minna koos lastega; vajadusel pakutakse turvalist ajutist majutust. Vaata lähemalt: palunabi.ee/et/naiste-tugikeskused

**Täpsustav küsimus:** Kas sina ja lapsed olete praegu turvalises kohas või kardad, et isa võib teile kohe viga teha?

## B08 · pöörduja

**Küsimus:** Kas ma saan tasuta võlanõustamist?

**Oodatud (küsija):** võlanõustamisteenus KOV-i kaudu (tasuta), kuidas saada

**Vastuse liik:** grounded; paketis 68 allikat, tsiteeritud 2 (õigusakt 1, muu 1); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 Võlanõustamise teenuse osutamise kord Narva linnas § 1 lg 1–6; S57 Võlanõustamisteenus

**Vastus:** Jah, Narvas on võlanõustamisteenus inimesele tasuta. Narva linn korraldab teenust ning Sotsiaalabiamet hindab, kas vajad seda. (Narva linna „Võlanõustamise teenuse osutamise kord Narva linnas“ § 1 lg 1–5) Sinu kirjeldatud üürivõlg võib olla põhjus võlanõustamise taotlemiseks. Esita Narva Linna Sotsiaalabiametile vormikohane kirjalik taotlus ning lisa võlgnevust ja oma majanduslikku olukorda tõendavad dokumendid. Amet hindab teenusevajadust ja suunab sind teenusele. Vaata juhiseid ja taotlust: narva.ee/sotsiaalteenused/-/asset_publisher/J8TOJukj0wfP/content/volanoustamisteenus

## B09 · pöörduja

**Küsimus:** Kui mind tõesti välja tõstetakse, kas vald peab mulle eluaseme andma?

**Oodatud (küsija):** KOV eluruumi tagamise teenus ja tingimused, sotsiaalpind, ajutine majutus

**Vastuse liik:** grounded; paketis 71 allikat, tsiteeritud 4 (õigusakt 2, muu 1, kontakt 1); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S9 Sotsiaalhoolekande seadus § 15 lg 1–4; S10 Sotsiaalhoolekande seadus § 41 lg 1–2; S46 Eluruumi tagamine; S62 Alisa Lanno

**Vastus:** Mitte automaatselt üksnes selle põhjal, et sind ähvardab väljatõstmine. Kui sa ei suuda oma pere vajadustele vastavat eluruumi ise tagada, peab omavalitsus sinu abivajaduse välja selgitama ja sellele vastavat abi korraldama. Eluruumi tagamise teenus võib tähendada näiteks sotsiaaleluruumi või abi üüripinna leidmisel. (Sotsiaalhoolekande seaduse § 41 lg 1; § 15 lg 1) Narvas saad taotleda eluruumi tagamise teenust. Kirjelda kirjalikus taotluses oma pere koosseisu, eluruumivajadust ja majanduslikku olukorda; taotluse peavad allkirjastama kõik täisealised pereliikmed. Narva Sotsiaalabiameti eluruumi tagamise teenuse kontakt on Alisa Lanno: 5306 0561, alisa.lanno@narva.ee. Vaata ka juhiseid: narva.ee/sotsiaalteenused/-/asset_publisher/J8TOJukj0wfP/content/eluruumi-tagamine

**Piirangud:** Ma ei saa nende andmete põhjal öelda, kas Narva annab sinu perele eluruumi: selle otsustab amet pärast olukorra ja abivajaduse hindamist.

## B10 · pöörduja

**Küsimus:** Как получить бесплатную юридическую помощь?

**Oodatud (küsija):** vastus vene keeles; riigi õigusabi, juristaitab, KOV-i jurist kui tõendites

**Vastuse liik:** grounded; paketis 69 allikat, tsiteeritud 4 (veebileht 2, õigusakt 2); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S2 Menetluskulud ja menetlusabi; S3 Õigusabi; S5 Riigi õigusabi seadus § 10 lg 1–6; S8 Riigi õigusabi seadus § 6 lg 1–2²

**Vastus:** Если вам нужна первичная консультация, на Juristaitab указаны два часа бесплатной юридической помощи; в списке мест, где её оказывают, есть Нарва. Подробности: juristaitab.ee/et/mis-riigi-oigusabi. Если вы не можете оплатить юриста или можете оплатить его лишь частично, можно подать заявление о государственной юридической помощи. Адвокат оказывает такую помощь за счёт государства, но она не всегда бесплатна: иногда часть расходов нужно возместить полностью или частично после завершения судебного спора. Подать заявление и уведомление о своём материальном положении можно в суд; для представительства в исполнительном производстве заявление подают в суд, который рассматривает жалобу на действия судебного исполнителя (Закон о государственной юридической помощи (Riigi õigusabi seadus) § 6 ч. 1; § 10 ч. 6).

## B11 · sotsiaaltöötaja

**Küsimus:** Olen Narva linna lastekaitsetöötaja. Kool teatas, et 12-aastane poiss puudub palju ja on agressiivne; ema on töötu ja üksikvanem. Kuidas alustan juhtumit ja hindan lapse abivajadust?

**Oodatud (küsija):** LasteKS: abivajavast lapsest teavitamine, lapse abivajaduse hindamine, juhtumikorraldus, lapse ärakuulamine

**Vastuse liik:** grounded; paketis 75 allikat, tsiteeritud 8 (juhend 1, veebileht 1, õigusakt 5, uuring/aruanne 1); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 Lapse heaolu hindamise käsiraamat; S2 Abivajav laps; S3 Lastekaitseseadus § 28 lg 1–4; S4 Lastekaitseseadus § 29 lg 1–5; S6 Lasteabi tulemuslikkuse uuring; S8 Lastekaitseseadus § 26; S11 Lastekaitseseadus § 30; S13 Lastekaitseseadus § 17 lg 1–2

**Vastus:** Alusta viivitamata eelhindamisega: kogu koolilt täpsustused puudumiste ulatuse, kestuse ja kooli seniste sammude kohta ning räägi lapse ja tema emaga. Hinda lapse füüsilist, tervislikku, psühholoogilist, emotsionaalset, sotsiaalset, kognitiivset, hariduslikku ja majanduslikku olukorda ning ema vanemlikke oskusi. Kaasa hindamisse laps ja last kasvatav isik või lapsega seotud lasteasutus; vajaduse korral ka asjaomane spetsialist. (Lastekaitseseaduse § 17 lg 1 p 3; § 28 lg 1–3) Sage puudumine ja agressiivne käitumine annavad põhjuse hinnata, kas lapse heaolu on ohustatud või kas tema käitumine ohustab tema enda või teiste heaolu. See võib tähendada, et tegu on abivajava lapsega, kuid esitatud teave üksi ei näita, et ta oleks hädaohus. Selgita eraldi välja, kas praegu on oht lapse või kellegi teise elule või tervisele; kui laps on vahetus elu- või terviseohus, tuleb teda viivitamata aidata ja ohust eemaldada. (Lastekaitseseaduse § 26; § 30) Tee kümne päeva möödumisel lapse abivajadusest teada saamisest otsus juhtumikorralduse algatamise, algatamata jätmise või juhtumi pädevale ametiisikule edastamise kohta. Juhtumikorralduse võib algatamata jätta ainult siis, kui lapse abivajaduse saab…

## B12 · sotsiaaltöötaja

**Küsimus:** Ema räägib, et endine elukaaslane ähvardab teda. Mida ma pean tegema ja kellega koostööd tegema?

**Oodatud (küsija):** turvalisuse hindamine, politsei, ohvriabi, lähisuhtevägivalla võrgustik (nt MARAC kui tõendites), lapse kaitse

**Vastuse liik:** partial; paketis 73 allikat, tsiteeritud 9 (õigusakt 4, muu 2, veebileht 1, kontakt 2); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 Lastekaitseseadus § 29 lg 1–5; S2 Lastekaitseseadus § 28 lg 1–4; S3 Ohvriabi seadus § 9 lg 1–3; S6 Lähisuhtevägivald ja ohvriabi võimalused; S7 Perelepitus; S8 Laps perevägivalla pealtnägijana; S11 Ohvriabi seadus § 21 lg 1–4; S60 Anastassia Romanova; S64 Jekaterina Tihhomirova

**Vastus:** Kui emal või lapsel on praegu vahetu oht, korralda viivitamata abi ja helista politseisse numbril 112. Ähvardusest üksi ei saa järeldada, kas ema on seaduse tähenduses hädaohus: hinda eraldi perevägivallast tulenevat ohtu tema elule ja tervisele. Kui hindamisel selgub surma või raske tervisekahjustuse risk, peab Sotsiaalkindlustusamet hindama ka ohustavast isikust lähtuvaid riske ja kavandama abi. (Ohvriabi seaduse § 9 lg 1–2) Lapse abivajadust hinnates käsitle ka seda, kuidas ähvardused ja kodune olukord võivad mõjutada tema turvalisust ning heaolu. Hinda lapse füüsilist, tervislikku, psühholoogilist, emotsionaalset, sotsiaalset, kognitiivset, hariduslikku ja majanduslikku olukorda ning ema vanemlikke oskusi; kaasa laps ja ema ning vajaduse korral asjaomane spetsialist. Juhtumikorralduse kaudu abi andmisel tee võrgustikutööd ja dokumenteeri lapse arvamus. (Lastekaitseseaduse § 28 lg 1–3; § 29 lg 2, 5) Kui selgub, et ema on hädaohus olev täisealine perevägivalla ohver, peab Narva linn algatama lapsele abi osutamiseks juhtumikorralduse ning tegema koostööd Sotsiaalkindlustusameti ja teiste ema abistavate asutustega. Muul juhul tee lapse abivajaduse kohta otsus juhtumikorralduse alga…

**Piirangud:** Kirjeldusest ei selgu, kas emal või lapsel on praegu vahetu oht ega kas ema puhul on tuvastatud surma või raske tervisekahjustuse risk.

**Täpsustav küsimus:** Kas emal või lapsel on praegu vahetu oht?

## B13 · sotsiaaltöötaja

**Küsimus:** Millal on laps hädaohus ja millal tohib lapse perest eraldada?

**Oodatud (küsija):** LasteKS § 33 jj: hädaohus laps, eraldamine, 72 tundi, kohus

**Vastuse liik:** grounded; paketis 7 allikat, tsiteeritud 4 (õigusakt 4); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 Lastekaitseseadus § 33 lg 1–4; S2 Lastekaitseseadus § 30; S4 Perekonnaseadus § 135 lg 1–4; S5 Lastekaitseseadus § 32 lg 1–5

**Vastus:** Hädaohus on laps siis, kui tema elu või tervis on ohus või tema käitumine ohustab tema enda või kellegi teise elu või tervist (lastekaitseseaduse § 30). Seega ei näita sage koolist puudumine või agressiivsus üksi veel, kas laps on hädaohus: hinda, milles oht konkreetselt seisneb ja kas see puudutab elu või tervist. Hädaohus last tuleb viivitamata aidata. Vajaduse korral võib ta viia ohututesse tingimustesse kuni ohu möödumiseni ka hooldusõigust teostava isiku nõusolekuta. Selle korraldab lapse asukohajärgse omavalitsuse lastekaitsetöötaja või politsei ning paigutus tuleb valida lapse olukorra ja vajaduste järgi. Kui ohtu ei põhjustanud hooldusõigust teostav isik või temast lähtuv oht on lõppenud, antakse laps sellele isikule üle (lastekaitseseaduse § 32 lg 1–4). Lapse ajutiseks perest eraldamiseks enne kohtumäärust peab lapse perre jätmine või vanema ja lapse suhtlus ohustama lapse tervist või elu. Omavalitsus või Sotsiaalkindlustusamet saab selle otsuse teha ainult siis, kui ohtu põhjustas hooldusõigust teostav isik oma tegevuse või tegevusetusega või kui ta keeldub lapse ajutisest paigutamisest sobiva teenuse saamiseks. Otsusega määratakse lapse viibimiskoht ja vajaduse korral su…

## B14 · sotsiaaltöötaja

**Küsimus:** Milliseid teenuseid saan perele pakkuda?

**Oodatud (küsija):** perelepitus/perenõustamine, tugiisik, lapsehoid, sotsiaalpedagoog, KOV teenused

**Vastuse liik:** grounded; paketis 70 allikat, tsiteeritud 6 (veebileht 2, õigusakt 1, muu 2, kontakt 1); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 SOS Lasteküla Eesti Ühing: Info kohaliku omavalitsuse lastekaitsetöötajale; S3 SOS Lasteküla Eesti Ühing: Ennetustöö; S9 Lastekaitseseadus § 29 lg 1–5; S28 Vaimse tervise teenuse toetus; S53 Turvakoduteenus lastele; S57 Anastassia Romanova

**Vastus:** Alusta lapse abivajaduse hindamisest ja juhtumikorralduse otsusest. Narvas saad lapse ja pere toetamiseks kaaluda SOS Lasteküla peretugevdusteenust: tugitöötaja saab aidata vanemluse, koolist puudumise ja käitumisprobleemidega ning pere igapäevase toimetulekuga. Kohaliku omavalitsuse lastekaitsetöötaja võib pere teenusele suunata; osalemine on vabatahtlik, tasuta ja eeldab vähemalt kuuekuulist lepingut. Vaata lähemalt: sos-lastekyla.ee/info-kohaliku-omavalitsuse-lastekaitsetootajale Kui hindamine näitab, et pere vajab vaimse tervise tuge, võib Narva vaimse tervise teenuse toetus sobida näiteks psühholoogiliseks või perenõustamiseks. Seda saab taotleda abivajav laps või täiskasvanu, kelle registrijärgne ja tegelik elukoht on Narva linnas. Toetus katab kuni 10 teenuskorda aastas ning teenus tuleb kasutada kuue kuu jooksul. Taotluse saab esitada vormivabalt; üldjuhul valib taotleja teenusepakkuja ise. Täpsemalt: narva.ee/sotsiaaltoetused/-/asset_publisher/c6DGSHfBeUiA/content/vaimse-tervise-teenuse-toetus Kui lapse hooldamise puudused ohustavad tema elu, tervist või arengut, hinda turvakoduteenuse vajadust. Narva linn korraldab lastele ajutise turvalise elukoha ja esmase kriisiabi; va…

**Piirangud:** Ma ei saa nende asjaolude põhjal otsustada, kas pere vastab vaimse tervise toetuse tingimustele või kas laps vajab turvakoduteenust; see sõltub hindamise tulemustest.

## B15 · sotsiaaltöötaja

**Küsimus:** Kuidas korraldada võrgustikukohtumine kooli, perearsti ja politseiga ning milliseid andmeid tohin jagada?

**Oodatud (küsija):** võrgustikutöö, andmete jagamine LasteKS alusel lapse huvides, dokumenteerimine

**Vastuse liik:** partial; paketis 76 allikat, tsiteeritud 5 (juhend 1, õigusakt 3, uuring/aruanne 1); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 Juhend: abivajavast lapsest teatamine ja andmekaitse; S2 Lastekaitseseadus § 34² lg 5–8; S3 Tänapäevase lastekaitse juhtumikorralduse, andmevahetuse ja e-teenuste analüüs; S13 Lastekaitseseadus § 29 lg 1–5; S14 Lastekaitseseadus § 34² lg 3–5

**Vastus:** Abivajavale lapsele abi osutamisel tuleb teha võrgustikutööd ja järgida juhtumikorralduse põhimõtteid (Lastekaitseseaduse § 29 lg 2). Kaasa lapse vajaduste hindamisse need kooli, tervishoiu ja õiguskaitse spetsialistid, kelle töö või ametikohustus on lapse õiguste ja heaolu tagamine ning kes lapsega vahetult kokku puutuvad. Jaga nendega lapse isikuandmeid ainult ulatuses, mis on selle juhtumi vajaduste hindamiseks ja sobivate abimeetmete valimiseks vajalik. 2021. aasta juhendis on kirjeldatud, et võrgustiku liikmed võivad edastada lapse andmeid omavalitsusele, Sotsiaalkindlustusametile ja politseile ilma lapse või seadusliku esindaja nõusolekuta, kui neil asutustel on seaduslik õigus andmeid lapse abistamiseks ja kaitseks töödelda. See ei anna alust jagada kõigile osalejatele kogu pere teavet. Andmete valikul lähtu sellest, kas need võivad mõjutada lapse heaolu. Lastekaitseseaduse § 34² lg 5–8 lubab lapse abivajaduse hindamisse ja sobiva abi osutamisse kaasatud osapooltel töödelda seaduses nimetatud andmeid. Nende hulgas on lapsega seotud vägivallajuhtumi andmed ning vanema või last kasvatava isiku puhul näiteks vanemluse, majandusliku ja sotsiaalse toimetuleku, vanemlike oskuste, …

**Piirangud:** Ma ei saa siinse teabe põhjal määrata, milline konkreetne perearsti või politsei käsutuses olev teave on selle juhtumi jaoks vajalik. Hinda seda iga andme ja osaleja puhul eraldi.

## B16 · sotsiaaltöötaja

**Küsimus:** Kas vald saab pere üürivõla ära maksta, et väljatõstmist vältida?

**Oodatud (küsija):** KOV täiendavad sotsiaaltoetused oma korra järgi; toimetulekutoetus; võlanõustamine

**Vastuse liik:** partial; paketis 71 allikat, tsiteeritud 4 (õigusakt 2, muu 2); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 Sotsiaalhoolekande seadus § 133 lg 5–8; S5 Sotsiaalhoolekande seadus § 134 lg 1–4; S14 Erakorraline toetus; S60 Võlanõustamisteenus

**Vastus:** Narva linnas ei saa toimetulekutoetusest tasuda varem tekkinud üürivõlga: jooksva kuu eluasemekuludest eraldi varasemat võlga toetuse arvestusse ei võeta (Sotsiaalhoolekande seaduse § 133 lg 7). Toimetulekutoetust määrates hindab linn ühtlasi, kas pere vajab muud sotsiaalhoolekandelist abi (Sotsiaalhoolekande seaduse § 134 lg 3). Kui pere ei suuda ise võlausaldajaga läbi rääkida, võib talle sobida Narva linna võlanõustamisteenus. Teenusel aidatakse muu hulgas võlausaldajaga läbirääkimistel ning võlgnevusega seotud probleemide lahendamisel. Sina saad juhtumi järgmise sammuna hinnata teenuse vajadust ja korraldada taotluse ning võlgnevust ja majanduslikku olukorda tõendavate dokumentide esitamise Sotsiaalabiametile. Vaata lähemalt: narva.ee/sotsiaalteenused/-/asset_publisher/J8TOJukj0wfP/content/volanoustamisteenus Narva linnas on ka erakorraline toetus ajutiselt hädaolukorda sattunud inimesele või perele; toetuse puhul arvestatakse pere sissetulekut ning taotlus esitatakse Sotsiaalabiametile koos vajalike dokumentidega. Saad koos perega hinnata, kas olukord vastab sellele kirjeldusele, ja paluda ametil toetuse vajadust hinnata. See teave ei ütle, et üürivõlg kindlasti kaetakse. Vaat…

**Piirangud:** Ma ei saa selle teabe põhjal öelda, kas Narva linn maksab pere üürivõla erakorralise toetusena või kas väljatõstmist saab vältida.

## B17 · sotsiaaltöötaja

**Küsimus:** Kas ma pean emaga sõlmima juhtumiplaani ja mis see peab sisaldama?

**Oodatud (küsija):** juhtumiplaan (LasteKS/SHS), sisu, eesmärgid, ülevaatamine

**Vastuse liik:** partial; paketis 76 allikat, tsiteeritud 3 (õigusakt 3); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S6 Lastekaitseseadus § 28 lg 1–4; S7 Sotsiaalhoolekande seadus § 9 lg 1–6; S8 Lastekaitseseadus § 29 lg 1–5

**Vastus:** Sa ei pea käsitlema juhtumiplaani emaga sõlmitava lepinguna. Kui lapse abivajadust ei saa rahuldada ühe ühekordse meetmega, peab Narva linn algatama juhtumikorralduse; algatamata võib selle jätta ainult siis, kui ühekordsest meetmest piisab. Otsus juhtumikorralduse algatamise, algatamata jätmise või juhtumi edasiandmise kohta tuleb teha kümne päeva jooksul lapse abivajadusest teada saamisest (Lastekaitseseaduse § 29 lg 3–4). Juhtumikorralduse korral tuleb kasutada võrgustikutööd. Juhtumiplaan on kirjalik dokument, mis sisaldab hinnangut abivajadusele ja abimeetmete rakendamise tegevuskava; abi andmisel tuleb kokku leppida ka tegevuste ajakava, määrata juhtumi koordineerija ning leppida kokku vastastikune teabevahetus (Sotsiaalhoolekande seaduse § 9 lg 2–3). Juhtumiplaanile kirjutavad alla koordineerija ja isik, kellele plaan on koostatud (Sotsiaalhoolekande seaduse § 9 lg 4). Lapse abivajadust hinnates tuleb kaasata laps ja teda kasvatav isik. Hindamisel tuleb käsitleda lapse füüsilist, tervislikku, psühholoogilist, emotsionaalset, sotsiaalset, kognitiivset, hariduslikku ja majanduslikku seisundit ning last kasvatava isiku vanemlikke oskusi (Lastekaitseseaduse § 28 lg 2–3). Abivaja…

**Piirangud:** Ma ei saa nende sätete põhjal öelda, et just ema peab juhtumiplaanile alla kirjutama: seadus nimetab allkirjastajana isiku, kellele plaan koostatakse, kuid siin ei täpsusta, kuidas allkirjastamine korraldada lapse juhtumiplaani puhul. Juhtumiplaan ei tähenda iseenesest emaga lepingu sõlmimist.

## B18 · sotsiaaltöötaja

**Küsimus:** Kuidas hinnata, kas ema vajab ise vaimse tervise tuge, ja kuhu teda suunata?

**Oodatud (küsija):** perearst, vaimse tervise õde, kriisiabi, peaasi.ee, VIPS/astmeline abi kui tõendites

**Vastuse liik:** grounded; paketis 69 allikat, tsiteeritud 4 (veebileht 3, muu 1); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S3 Kuhu pöörduda vaimse tervise probleemide korral?; S4 MTÜ Peaasjad: Korduma kippuvad küsimused; S5 Spetsialistid ja abivõimalused; S26 Vaimse tervise teenuse toetus

**Vastus:** Hinda emaga vesteldes, kas mure või muud vaimse tervisega seotud sümptomid segavad tema igapäevaelu. Küsi ja pane tähele muutusi unes, söömises, suhetes ja tööga toimetulekus ning kuula ka tema enda ja lähedaste tähelepanekuid. Need võivad aidata märgata abivajadust, kuid ei anna üksi alust diagnoosiks. Kui pähe tulevad enesetapumõtted või -plaanid, otsige abi viivitamata. Esimese sammuna arutage emaga perearstiga ühenduse võtmist: perearst saab hinnata tema vaimset ja füüsilist tervist ning soovitada edasist abi. Vaimse tervise õde saab teha esmase hindamise ja nõustada; vajaduse korral suunab ta edasi psühholoogi või psühhiaatri juurde. Psühhiaater on arst ja tema juurde saab pöörduda saatekirjata. Vaata võimalusi: terviseportaal.ee/arstiabi/vaimne-tervis/spetsialistid-ja-abivimalused. Kui ema rahvastikuregistrijärgne ja tegelik elukoht on Narva linnas, võib talle sobida Narva vaimse tervise teenuse toetus. See võimaldab kasutada näiteks psühholoogilist või kriisinõustamist, hingehoidu, perenõustamist või pereteraapiat. Taotluse saab esitada vormivabalt Narva Linna Sotsiaalabiametile; põhjendatud taotluse rahuldamise või rahuldamata jätmise otsustab Sotsiaalabiameti direktor või …

## B19 · teenuseosutaja

**Küsimus:** Oleme Ida-Virumaal võlanõustamisteenust osutav MTÜ. Narva linn suunas meile kahe lapsega üksikema, kellel on üürivõlg ja kohtutäituri menetlus. Kuidas me nõustamisprotsessi üles ehitame?

**Oodatud (küsija):** kaardistus, eelarve, võlausaldajad, täitemenetlus, maksegraafik, koostöö KOV-iga

**Vastuse liik:** partial; paketis 12 allikat, tsiteeritud 5 (juhend 2, muu 1, veebileht 1, õigusakt 1); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 Võlanõustamisteenuse juhend; S2 Võlanõustamisteenuse juhend; S3 Heade praktikate kogumik; S6 Psühholoogiline ja võlanõustamine; S9 Sotsiaalhoolekande seadus § 45 lg 1–2

**Vastus:** Alusta usaldusliku kontakti loomisest ja selgita, et nõustamine eeldab ema enda soovi ja koostööd. Leppige temaga kokku realistlik eesmärk: võlanõustamine aitab võlaolukorda lahendada, kuid ei tähenda rahalise abi andmist ega võlgade tema eest ära võtmist. Kaardistage koos võlgadesse sattumise põhjused, tema tugevused ja olemasolevad ressursid. Seejärel tehke võlgadest ja sissetulekutest tervikpilt. Vaadake üle, kellele ja kui palju ta võlgneb, ning koguge kokku üürivõla ja kohtutäituri menetlusega seotud dokumendid. Hinnake nõuete õiguspärasust, koostage pere eelarve ning selgitage välja, millised kulud ja kohustused vajavad esmajärjekorras tähelepanu. Võlanõustamise töö hulka kuuluvad ka maksegraafikute koostamise toetamine ja vajaduse korral võlausaldajatega suhtlemisel vahendamine. Käsitle juhtumit nelja omavahel seotud osana: finants- ja juriidiline nõustamine, psühhosotsiaalne tugi, igapäevase majapidamise ja eelarve korraldamine ning uute võlgade ennetamine. Kuna olukorras on korraga mitu probleemi ja kaasatud on lapsed, võib olla asjakohane juhtumikorraldus: kaardistage koos emaga eri valdkondade abivajadused ja vajalik koostöövõrgustik ning seadke ühised eesmärgid. See on …

**Piirangud:** Ma ei saa siinse teabe põhjal kirjeldada Narva linna suunamise, teenuse mahu kokkuleppimise ega teie MTÜ ja linna vahelise koostöö korda.

## B20 · teenuseosutaja

**Küsimus:** Milline kvalifikatsioon peab võlanõustajal olema ja kas teenus peab kliendile tasuta olema?

**Oodatud (küsija):** nõuded kui tõendites; KOV-i korraldatud teenus kliendile tasuta

**Vastuse liik:** grounded; paketis 62 allikat, tsiteeritud 2 (õigusakt 2); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 Sotsiaalhoolekande seadus § 45 lg 1–2; S2 Võlanõustamise teenuse osutamise kord Narva linnas § 1 lg 1–6

**Vastus:** Teenust vahetult osutaval võlanõustajal peab olema kas kutseseaduse alusel antud võlanõustaja kutse või riiklikult tunnustatud kõrgharidus koos läbitud võlanõustaja täienduskoolitusega. (Sotsiaalhoolekande seaduse (SHS) § 45 lg 1) Narva linnas on võlanõustamisteenus kliendile tasuta. Teenuse korraldamine ja linnaeelarvest selleks eraldatud raha arvestamine kuulub Narva linna Sotsiaalabiametile. (Narva linna määruse „Võlanõustamise teenuse osutamise kord Narva linnas“ § 1 lg 3–5)

## B21 · teenuseosutaja

**Küsimus:** Kas me võime kliendi nimel võlausaldajatega suhelda ja mida selleks vaja on?

**Oodatud (küsija):** volikiri, nõusolek, andmekaitse

**Vastuse liik:** partial; paketis 65 allikat, tsiteeritud 4 (õigusakt 2, veebileht 2); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 Tsiviilseadustiku üldosa seadus § 118 lg 1–3; S3 Eesti Võlanõustajate Liit: Teenuse korraldus; S4 Tsiviilkohtumenetluse seadustik § 221 lg 1–3; S5 Eesti Võlanõustajate Liit: Eetikakoodeks

**Vastus:** Jah, võite kliendi nimel võlausaldajatega suhelda, kui klient on andnud teile selleks volituse. Volitus tekib kliendi vastava tahteavaldusega teile või võlausaldajale. Kui tehingu tegemiseks on seaduses ette nähtud kindel vorm, peab ka selleks antud volitus olema samas vormis (Tsiviilseadustiku üldosa seaduse § 118 lg 1 ja 3). Kohtumenetluses esindamiseks tõendab lepingulise esindaja volitust kohtule esitatav volikiri. Kohus võib vajaduse korral nõuda notariaalselt kinnitatud või tõestatud volikirja (Tsiviilkohtumenetluse seadustiku § 221 lg 2). Võlanõustaja peab hoidma kliendi privaatsust ja teda puudutava teabe konfidentsiaalsust ning kasutama seda vastutustundlikult asutuse korra või kliendiga sõlmitud kokkuleppe järgi. Võlanõustamise juurde kuulub kliendi abistamine võlausaldajatega läbirääkimisel; teenus lähtub personaalsest ja kliendipõhisest lähenemisest.

**Piirangud:** Ma ei saa siin toodud teabe põhjal öelda, kas konkreetne võlausaldaja nõuab tavapäraseks suhtluseks kindlat volikirja vormi või muid tõendeid. Üldist kirjaliku volikirja nõuet nende väljavõtete põhjal järeldada ei saa.

## B22 · teenuseosutaja

**Küsimus:** Kuidas aidata kliendil taotleda täitemenetluses arestimisest vaba summa suurendamist?

**Oodatud (küsija):** TMS § 132, ülalpeetavad, taotlus kohtutäiturile

**Vastuse liik:** grounded; paketis 7 allikat, tsiteeritud 5 (veebileht 2, õigusakt 3); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 Miks ei ole kohtutäitur minu arvelduskontole elatusmiinimumi jätnud?; S3 Kohtutäitur on arestinud minu sissetulekud, mis ei kuulu seaduse kohaselt arestimisele. Mida teha?; S5 Täitemenetluse seadustik § 133 lg 1–2; S6 Täitemenetluse seadustik § 131 lg 1–2; S7 Täitemenetluse seadustik § 132 lg 1–2

**Vastus:** Aita kliendil esitada kohtutäiturile avaldus arestitud sissetuleku aresti alt vabastamiseks. Avaldusele lisage tõendid tema sissetulekute ja ülalpeetavate kohta. Kui kontole ei ole jäetud arestimisele mittekuuluvat summat, tuleb kohtutäituri poole pöörduda viivitamata. Kohtutäitur tühistab avalduse alusel konto arestimise kolme tööpäeva jooksul ulatuses, mis tagab arestimisele mittekuuluva sissetuleku (Täitemenetluse seadustiku (TMS) § 133 lg 1). Täpsem juhis ja kohtutäiturite kontaktide link: juristaitab.ee/et/miks-ei-ole-kohtutaitur-minu-arvelduskontole-elatusmiinimumi-jatnud Kui kliendi ülalpeetavad ei ole kohtutäiturile teada, esitage nende kohta tõendid. Üldjuhul suureneb mittearestitav summa iga ülalpeetava kohta ühe kolmandiku võrra palga alammäärast kuus, välja arvatud juhul, kui täidetakse lapse elatisnõuet (TMS § 132 lg 2). TMS § 133 lg 1 järgi märgib kohtutäitur arestimisaktis talle teadaolevate andmete põhjal ülalpeetavad ja vastava mittearestitava summa. Kui kontole kantakse korraga rohkem kui ühe kuu sissetulek, taotle avalduses iga ettemakstud kuu kohta arestimisele mittekuuluva summa vabastamist. Kui sissetuleku kasutamise perioodi ei saa kindlaks teha, tagab kohtut…

**Piirangud:** Ma ei saa nende juhiste põhjal kindlaks teha, kui suur summa konkreetsele kliendile vabastatakse; seda mõjutavad tema sissetulekud, ülalpeetavad ja täitemenetluse asjaolud.

## B23 · teenuseosutaja

**Küsimus:** Kui klient mainib, et teda ähvardatakse, mis on meie kohustus?

**Oodatud (küsija):** ohu korral 112, ohvriabi, teavitamine, lapse puhul lastekaitse

**Vastuse liik:** grounded; paketis 11 allikat, tsiteeritud 3 (õigusakt 3); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 Lastekaitseseadus § 27 lg 1–5; S2 Lastekaitseseadus § 31 lg 1–2; S6 Sotsiaalhoolekande seadus § 13

**Vastus:** Kui saad teada, et klient vajab sotsiaalhoolekande abi, pead sellest teatama kliendi viibimiskoha järgsele kohaliku omavalitsuse üksusele. See kohustus kehtib ka teistele isikutele ega sõltu sellest, kas klient ise abi küsib (Sotsiaalhoolekande seaduse (SHS) § 13). Kui ähvardamisega on seotud laps ja sul on teavet, et laps vajab abi, pead sellest viivitamata teatama kohaliku omavalitsuse üksusele või lasteabitelefonil 116 111. Kui laps on hädaohus, tuleb viivitamata teatada hädaabinumbril 112 (Lastekaitseseaduse § 27 lg 1–2; § 31 lg 1–2).

**Piirangud:** Ainuüksi ähvardamise mainimisest ei selgu, kas klient vajab sotsiaalhoolekande abi või kas laps on abivajav või hädaohus. Nende asjaolude hindamine sõltub sellest, mida klient ähvardamise ja oma olukorra kohta räägib.

## B24 · teenuseosutaja

**Küsimus:** Kas maksejõuetuse või võlgade ümberkujundamise menetlus sobiks talle?

**Oodatud (küsija):** võlgade ümberkujundamise ja võlakaitse seadus, füüsilise isiku pankrot; tingimused

**Vastuse liik:** partial; paketis 13 allikat, tsiteeritud 4 (õigusakt 4); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 Füüsilise isiku maksejõuetuse seadus § 19 lg 1–3; S2 Füüsilise isiku maksejõuetuse seadus § 18 lg 1–7; S3 Füüsilise isiku maksejõuetuse seadus § 21 lg 1–3; S12 Füüsilise isiku maksejõuetuse seadus § 11 lg 1–5

**Vastus:** Üürivõlg ja kohtutäituri menetlus näitavad, et makseraskusi tuleb hinnata, kuid neist üksi ei piisa, et otsustada, milline menetlus talle sobib. Kohus arutab võlgniku ja usaldusisikuga võlgnevuste tasumise väljavaateid ning valib sobivaima menetluse: pankroti, pankroti koos kohustustest vabastamise menetlusega või võlgade ümberkujundamise (Füüsilise isiku maksejõuetuse seaduse (FIMS) § 18 lg 1–2). Võlgade ümberkujundamine võib sobida kaalumiseks siis, kui ta ei suuda või tõenäoliselt ei suuda kohustusi nende sissenõutavaks muutumisel täita, kuid ei ole veel püsivalt maksejõuetu. Kohustusi saab muuta näiteks maksetähtaega pikendades, osamakseteks jagades või neid vähendades; menetlus hõlmab üldjuhul avalduse esitamise ajaks sissenõutavaks muutunud kohustusi. Kohus võib menetluse algatamata jätta, kui ilmnevad seaduses nimetatud takistused (Füüsilise isiku maksejõuetuse seaduse § 19 lg 1, 3 ja § 21 lg 1, 3). Järgmise sammuna hinnake koos temaga võlgade ja sissetulekute tervikpilti ning seda, kas realistlik maksegraafik aitaks makseraskustest väljuda. Kui ta soovib menetlust taotleda, peab maksejõuetusavaldus selgitama makseraskusi ja nende põhjuseid ning näitama, millist menetlust ta…

**Piirangud:** Nende asjaolude põhjal ei saa veel hinnata, kas ta on püsivalt maksejõuetu või kas tema sissetulek ja vara võimaldavad ümberkujundamiskava täita.

**Täpsustav küsimus:** Kas tal on pärast hädavajalike kulude tasumist võimalik võlgade tagasimakseteks raha eraldada ning kas makseraskus paistab ajutine või püsiv?

## B25 · teenuseosutaja

**Küsimus:** Kuidas me teenuse tulemusi linnale raporteerime, ilma et rikuksime konfidentsiaalsust?

**Oodatud (küsija):** agregeeritud aruandlus, nõusolek, minimaalne andmemaht

**Vastuse liik:** partial; paketis 11 allikat, tsiteeritud 5 (juhend 3, muu 1, õigusakt 1); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 Võlanõustamisteenuse kvaliteedijuhis; S4 Eetikakoodeks | ESTA; S5 Eetikakäsiraamat | ESTA; S6 Eetikakäsiraamat | ESTA; S7 Sotsiaalseadustiku üldosa seadus § 8

**Vastus:** Linnale saadetavas aruandes keskendu teenuse üldistele tulemustele: näiteks eesmärkide täitmise hindamisele ja tagasiside analüüsile. Jäta välja kliendi nimi ja muud üksikasjad, mille järgi võib tema ära tunda. Ka väike piirkond või haruldane olukord võib inimese tuttavatele tuvastatavaks teha, seega hinda enne iga detaili lisamist, kas see on aruandeks vajalik. Kliendiga seotud teavet tohib avaldada vajalikus ulatuses inimesega kokkuleppel või seaduses ette nähtud juhul. Võlanõustamisel on inimese sotsiaalse kaitse vajadus ja talle hüvitise andmine era- ja perekonnaelu saladus (Sotsiaalseadustiku üldosa seaduse § 8).

**Piirangud:** Ma ei saa siinse teabe põhjal öelda, milliseid näitajaid või aruandevormi Narva linn teilt nõuab.

## C01 · pöörduja

**Küsimus:** Olen 19 ja elasin perekodus. Nüüd pean Viljandis iseseisvalt elama hakkama, aga mul pole raha ega oma kodu. Mis abi mulle ette nähtud on?

**Oodatud (küsija):** järelhooldus (KOV), eluruumi tagamine, toetused, kellega ühendust võtta

**Vastuse liik:** partial; paketis 64 allikat, tsiteeritud 7 (õigusakt 3, kontakt 2, muu 2); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 Sotsiaalhoolekande seadus § 45¹⁶ lg 1–3; S11 Sotsiaalhoolekande seadus § 45¹⁵ lg 1–2; S15 Sotsiaalhoolekande seadus § 131 lg 1–8; S34 Elis Ehrlich; S37 Silja Simon; S50 Järelhooldusteenus; S62 Varjupaigateenus

**Vastus:** Kui elasid perekodus kuni täisealiseks saamiseni, võib omavalitsus sulle korraldada järelhooldusteenuse kuni 25-aastaseks saamiseni. Teenus võib hõlmata eluaset ning sinu vajadustele vastavaid tugiteenuseid ja toetusi. Seadus kohustab teenust tagama teatud tingimustel õppivale noorele, kuid muul juhul võib omavalitsus seda pakkuda oma otsuse alusel (sotsiaalhoolekande seaduse § 45¹⁵ lg 1–2 ja § 45¹⁶ lg 1¹–2). Viljandi linna järelhooldusteenuse taotlemiseks esita vabas vormis avaldus Viljandi Linnavalitsuse sotsiaalametile. Lisa isikut tõendav dokument; vajaduse korral ka puudeotsus, rehabilitatsiooniplaan ja sissetuleku dokumendid. Sotsiaalameti spetsialist hindab sinu vajadust ja teeb suunamise otsuse. Teenuse kirjelduses on tingimusena nimetatud õpingute jätkamist. Lisainfo: viljandi.ee/pere-sotsiaal-ja-tervishoid/teenused-ja-toetused/abi-toimetulekuraskusega-inimesele/ (Sotsiaalhoolekande seaduse § 45¹⁵ lg 2 ja § 45¹⁶ lg 2). Kui su sissetulekust ei piisa ja pärast arvestatavate eluasemekulude mahaarvamist jääb kuu netosissetulek alla kehtestatud toimetulekupiiri, on sul õigus taotleda toimetulekutoetust. Seda saab taotleda ka üksinda elav inimene (sotsiaalhoolekande seaduse § 13…

**Piirangud:** Toimetulekutoetuse saamise tingimuse täitmist ei saa sinu puhul otsustada ainult selle põhjal, et sul pole praegu raha ega oma kodu; vaja on arvestada sinu kuu sissetulekut ja arvestatavaid eluasemekulusid. Selle toetuse taotlemise täpseid kohalikke samme ma siit kindlalt öelda ei saa.

**Täpsustav küsimus:** Kas õpid praegu edasi ning kas pead Viljandi all silmas Viljandi linna või Viljandimaad?

## C02 · pöörduja

**Küsimus:** Mis on järelhooldus ja kui kaua ma seda saan?

**Oodatud (küsija):** järelhooldusteenus SHS-is, kestus/vanusepiir kui tõendites, mida see hõlmab

**Vastuse liik:** grounded; paketis 62 allikat, tsiteeritud 4 (veebileht 1, õigusakt 2, muu 1); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 Asendus- ja järelhooldus; S2 Sotsiaalhoolekande seadus § 45¹⁶ lg 1–3; S3 Sotsiaalhoolekande seadus § 45¹⁵ lg 1–2; S48 Järelhooldusteenus

**Vastus:** Järelhooldusteenus on omavalitsuse korraldatav abi noorele, kes lahkub asendushoolduselt või eestkostelt. Selle eesmärk on toetada iseseisvat toimetulekut ja õpingute jätkamist. Juhtumiplaani alusel tagab omavalitsus eluaseme ning sinu vajadustele vastavad tugiteenused ja toetused (Sotsiaalhoolekande seaduse § 45¹⁵ lg 1–2). Kui jätkad asendushooldusel alustatud õpinguid, peab omavalitsus sulle järelhooldust tagama. Kui õppimise jätkamise tingimus ei kehti, võib omavalitsus teenust siiski pakkuda, sest viibisid enne täisealiseks saamist asendushooldusel. Selle võimaliku teenuse üle otsustab omavalitsus sinu olukorda koos sinuga hinnates (Sotsiaalhoolekande seaduse § 45¹⁶ lg 1¹–2). Teenuse kestus sõltub sellest, millisel alusel seda saad: õppimise jätkamisel võib see kesta õpingute katkestamiseni või õppekava nominaalaja lõpuni, kuid mitte kauem kui 25-aastaseks saamiseni. Seaduses nimetatud õppetingimusele vastaval noorel võib teenus kesta ka 25-aastaseks saamiseni. Kui omavalitsus tagab teenuse kaalutlusõiguse alusel, on ülempiir samuti 25. eluaasta (Sotsiaalhoolekande seaduse § 45¹⁶ lg 1–2). Viljandi linnas saad järelhooldust taotleda vabas vormis avaldusega Viljandi Linnavalitsus…

**Täpsustav küsimus:** Kas jätkad praegu õpinguid? Sellest sõltub, kas omavalitsus peab teenuse tagama või võib seda kaalutlusotsusega pakkuda.

## C03 · pöörduja

**Küsimus:** Mul on ADHD ja depressioon. Kas ma saan puude või töövõime hindamist ja mis sellest kasu oleks?

**Oodatud (küsija):** puude raskusaste (SKA), töövõime hindamine (Töötukassa), tingimused ja kasu

**Vastuse liik:** partial; paketis 61 allikat, tsiteeritud 5 (õigusakt 4, muu 1); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 Töövõimetoetuse seadus § 5 lg 1–4; S2 Töövõimetoetuse seadus § 6 lg 1–7; S5 Puuetega inimeste sotsiaaltoetuste seadus § 7 lg 1–3; S8 Kes aitab ja kuhu pöörduda, kui sul on tuvastatud puude raskusaste?; S10 Puuetega inimeste sotsiaaltoetuste seadus § 2 lg 1–2²

**Vastus:** ADHD või depressiooni diagnoos üksi ei otsusta, kas sulle määratakse puude raskusaste või vähenenud töövõime. Töövõime hindamisel vaadatakse, kas pikaajaline tervisekahjustus piirab sinu töötamist ja kui palju. Puude raskusastme hindamisel arvestatakse muu hulgas terviseseisundit ning igapäevase tegutsemise ja ühiskonnaelus osalemise piiranguid. (Töövõimetoetuse seaduse § 5 lg 1–3; Puuetega inimeste sotsiaaltoetuste seaduse § 2 lg 2¹) Sa saad taotleda töövõime hindamist Töötukassalt ning esitada samal ajal ka puude raskusastme tuvastamise taotluse. Ühistaotluse saad esitada Sotsiaalkindlustusameti kaudu. Töövõime hindamise taotluse esitamisele eelneva kuue kuu jooksul pead olema käinud perearsti, sind põhiliselt raviva eriarsti või töötervishoiuarsti vastuvõtul. (Töövõimetoetuse seaduse § 6 lg 1–4) Kui tööealisel inimesel tuvastatakse puude raskusaste, võib tal olla õigus igakuisele toetusele puudest tingitud lisakulude hüvitamiseks. Toetuse suurus sõltub raskusastmest: raske puude korral 50 eurot ja sügava puude korral 100 eurot kuus; keskmise puude korral sõltub summa valdkonnast ning täpsemad tingimused ja suurused kehtestab minister. Toetust ei maksta kulude eest, mida rahastat…

**Piirangud:** Ma ei saa diagnooside põhjal öelda, kas sulle määratakse puue või vähenenud töövõime; selle otsustamiseks tuleb hinnata, kuidas terviseseisund sinu igapäevast tegutsemist või töötamist piirab.

## C04 · pöörduja

**Küsimus:** Kas ma saan õppimise ajal mingit toetust, et ära elada?

**Oodatud (küsija):** õppetoetused, järelhoolduse toetus, toimetulekutoetus (üliõpilase reeglid), KOV

**Vastuse liik:** partial; paketis 15 allikat, tsiteeritud 4 (õigusakt 4); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S2 Sotsiaalhoolekande seadus § 45¹⁶ lg 1–3; S3 Sotsiaalhoolekandelise abi andmise kord § 16 lg 1–4; S5 Puuetega inimeste sotsiaaltoetuste seadus § 10 lg 1–2; S9 Sotsiaalhoolekande seadus § 45¹⁵ lg 1–2

**Vastus:** Jah, üks võimalus võib olla järelhooldusteenus. Kuna oled 19 ja elasid perekodus, võib omavalitsus seda sulle pakkuda kuni 25-aastaseks saamiseni ka siis, kui sa parajasti ei õpi. Teenus võib hõlmata eluaset ning sinu vajadustele vastavaid toetusi ja tugiteenuseid. Omavalitsus hindab sinu vajadusi koos sinuga ning otsustab teenuse määramise. Küsi seda oma elukohajärgsest omavalitsusest ja ütle, et oled perekodus kasvanud ning vajad õppimise ajal eluaseme- ja rahalist tuge. (Sotsiaalhoolekande seaduse § 45¹⁶ lg 2; § 45¹⁵ lg 2; Viljandi linna „Sotsiaalhoolekandelise abi andmise kord” § 16 lg 4) Kui sul on puue, sa ei tööta ja puude tõttu tekivad õppimisega seotud lisakulud, võib sul olla õigus õppetoetusele. Seda makstakse tegelike lisakulude järgi, 6,39–25,57 eurot kuus, välja arvatud juulis ja augustis. (Puuetega inimeste sotsiaaltoetuste seaduse § 10 lg 1–2)

**Piirangud:** Ma ei saa öelda, kas õppetoetuse tingimused sinu puhul täidetud on, sest sa pole öelnud, kas sul on puue, kas töötad või kas õppimisega kaasneb puudest tingitud lisakulu.

**Täpsustav küsimus:** Kas elad Viljandi linnas või Viljandi vallas? Kas sa juba õpid, ja kui jah, siis millises koolis või õppevormis?

## C05 · pöörduja

**Küsimus:** Ma ei oska rahaga hästi ümber käia ja kardan, et jään võlgu. Kas keegi saab mind aidata?

**Oodatud (küsija):** tugiisik, võlanõustamine, rahatarkus

**Vastuse liik:** partial; paketis 6 allikat, tsiteeritud 2 (õigusakt 1, juhend 1); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S2 Sotsiaalhoolekande seadus § 44 lg 1–5; S4 Asendushooldusel noorte elluastumiskava kontrollnimekiri ja juhendmaterjal

**Vastus:** Jah, abi võib olla. Võlanõustamine aitab sul oma rahaolukorda selgemaks saada, võlausaldajaga läbi rääkida ja uusi võlgnevusi ennetada. Seda korraldab kohalik omavalitsus. (Sotsiaalhoolekande seaduse § 44 lg 1, 3) Esimese sammuna võid panna kirja oma sissetulekud ning püsikulud ja muutuvad kulud, näiteks üüri, telefoni, toidu ja transpordi. Nii saad võrrelda, kui palju raha tuleb sisse ja kui palju kulub.

**Piirangud:** Ma ei saa praegu öelda, millise Viljandi omavalitsuse poole pöörduda või kuidas seal täpselt teenust taotleda, sest pole selge, kas mõtled Viljandi linna või Viljandi valda.

**Täpsustav küsimus:** Kas elad Viljandi linnas või Viljandi vallas?

## C06 · pöörduja

**Küsimus:** Kas ma võin saada sotsiaalkorteri?

**Oodatud (küsija):** KOV eluruumi tagamise teenus/sotsiaalpind, tingimused, taotlemine

**Vastuse liik:** partial; paketis 62 allikat, tsiteeritud 5 (õigusakt 4, muu 1); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 Viljandi linna omandis olevate eluruumide valdamise,kasutamise ja käsutamise ning sotsiaaleluruumide kasutusse andmise kord § 31; S2 Viljandi linna omandis olevate eluruumide valdamise,kasutamise ja käsutamise ning sotsiaaleluruumide kasutusse andmise kord § 35; S3 Viljandi linna omandis olevate eluruumide valdamise,kasutamise ja käsutamise ning sotsiaaleluruumide kasutusse andmise kord § 36; S4 Viljandi linna omandis olevate eluruumide valdamise,kasutamise ja käsutamise ning sotsiaaleluruumide kasutusse andmise kord § 12; S52 Sotsiaaleluruumi taotlemine

**Vastus:** Kui sinu rahvastikuregistrijärgne elukoht on Viljandi linn ja sa elad tegelikult linna territooriumil, võib sulle sotsiaaleluruumi üürile anda siis, kui sul pole eluaset ning sa ei suuda oma sotsiaalse ja majandusliku olukorra tõttu endale või perele eluruumi tagada ja selle saamata jäämine ohustaks toimetulekut, elu või tervist. Eluruumi peab olema saadaval. Sotsiaalkomisjon hindab sinu tegelikke võimalusi ja vajadusi ning otsustab, kas eluruum sulle sobib. (Viljandi linna „Viljandi linna omandis olevate eluruumide valdamise, kasutamise ja käsutamise ning sotsiaaleluruumide kasutusse andmise kord“ § 31; § 12) Viljandi linnas esita sotsiaaleluruumi taotlus kirjalikult linnavalitsuse sotsiaalametile. Lisa leibkonna liikmete viimase kolme kalendrikuu pangakontode väljavõtted ja eluasemekulude arved. Taotluses märgi oma elukoht, leibkond, taotlemise põhjused, praeguse eluruumi suurus ja seisukord, leibkonna kinnisvara ning kontaktandmed. Otsus tehakse 10 tööpäeva jooksul pärast vajalike dokumentide laekumist; üürnik tasub üüri ja kõrvalkulud, välja arvatud remondifondi tasu. Vaata juhiseid: viljandi.ee/pere-sotsiaal-ja-tervishoid/teenused-ja-toetused/abi-toimetulekuraskusega-inimesele…

**Piirangud:** Ma ei saa nende andmete põhjal kinnitada, kas sinu rahvastikuregistrijärgne elukoht on Viljandi linn või kas seal on praegu vaba sotsiaaleluruum. Viljandi linna tingimused kehtivad siin käsitletud teenuse kohta; sinu tegeliku sobivuse ja taotluse üle otsustab sotsiaalkomisjon.

## C07 · pöörduja

**Küsimus:** Kuidas ma psühhiaatri juurde saan ja kas see maksab midagi?

**Oodatud (küsija):** perearst, psühhiaatri vastuvõtt (Tervisekassa kindlustus), saatekiri kui vaja

**Vastuse liik:** grounded; paketis 56 allikat, tsiteeritud 3 (veebileht 2, õigusakt 1); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 MTÜ Peaasjad: Millal pöörduda spetsialisti poole?; S2 Vaimse tervise abi saamise võimalused; S3 Ravikindlustuse seadus § 70 lg 1–5

**Vastus:** Psühhiaatri vastuvõtule saad aja panna kinni otse polikliiniku registratuurist või otsida aega digiregistratuurist. Saatekirja pole vaja. Võid vaadata ka mitme polikliiniku aegu. Järjekord võib olla pikk; selle teabe järgi võib oodata umbes kuu või kaks. Kui sul on ravikindlustus ja lähed üle 18-aastasena Tervisekassa rahastatud vastuvõtule, on psühhiaatriline abi üldjuhul tasuta, kuid tavaliselt tuleb maksta 5 eurot visiiditasu. Tervisekassa lepinguta teenuseosutaja juures võib abi olla tasuline. Küsi valitud registratuurist enne aja broneerimist, kas neil on Tervisekassaga leping ning kui pikk on järjekord ja mis maksab vastuvõtt. (Ravikindlustuse seaduse § 70 lg 1–3)

## C08 · pöörduja

**Küsimus:** Kas ma saan rehabilitatsiooniteenust ja kuidas seda taotleda?

**Oodatud (küsija):** sotsiaalne rehabilitatsioon SKA kaudu, tingimused

**Vastuse liik:** partial; paketis 60 allikat, tsiteeritud 6 (veebileht 4, õigusakt 2); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 Sotsiaalse rehabilitatsiooni teenus tööealistele ja pensioniealistele; S2 Töötukassa teenused; S3 Sotsiaalse rehabilitatsiooni teenus tööealistele ja pensioniealistele; S4 Sotsiaalse rehabilitatsiooni teenus tööealistele ja pensioniealistele; S8 Sotsiaalhoolekande seadus § 62 lg 1–3¹; S9 Sotsiaalhoolekande seadus § 59 lg 1–2

**Vastus:** 19-aastasena kuulud tööealiste hulka, kuid ADHD ja depressiooni diagnoos üksi ei tähenda, et sul on õigus sotsiaalse rehabilitatsiooni teenusele. Tööealisel peab lisaks olema tuvastatud puue või osaline või puuduv töövõime ning teenuse vajadus; puuduva töövõimega inimese puhul on samuti vaja teenuse vajaduse tuvastamist. (Sotsiaalhoolekande seaduse § 59 lg 1 p 3–4) Sotsiaalkindlustusamet hindab teenuse vajadust sinu toimetuleku, tegevusvõime, osalusvõime, terviseseisundi ja Töötukassa tööturuteenuste andmete põhjal. Teenus võib sobida, kui vajad tervisest tingitud igapäevaelu raskuste lahendamiseks mitme eri spetsialisti abi. (Sotsiaalhoolekande seaduse § 62 lg 1) Kui soovid sotsiaalset rehabilitatsiooni taotleda, saada taotlus Sotsiaalkindlustusametile eesti.ee kaudu, iseteeninduse kaudu, digiallkirjastatult e-postiga aadressile info@sotsiaalkindlustusamet.ee või allkirjastatult postiga. Taotluse saab esitada ka ameti klienditeeninduses. Amet hindab vajadust ning teavitab sind pärast taotluse esitamist; töö- ja vanaduspensioniealiste taotluse menetlemine ja otsus võtab nõuetekohaste dokumentide saamisest kuni 40 tööpäeva. Vaata lähemalt: sotsiaalkindlustusamet.ee/puue-ja-hoolekann…

**Piirangud:** Ma ei saa nende andmete põhjal otsustada, kas sul on vajalik puude või töövõime otsus või kas sinu teenusevajadus hinnatakse piisavaks.

**Täpsustav küsimus:** Kas sul on juba puude või töövõime otsus ning kas sa praegu töötad, õpid või oled töötuna arvel?

## C09 · pöörduja

**Küsimus:** Mul on vahel nii halb, et ei taha enam elada.

**Oodatud (küsija):** kriis: hooliv toon, kohene abi (112, eluliin/peaasi/kriisiabi), küsib turvalisuse kohta

**Vastuse liik:** grounded; paketis 6 allikat, tsiteeritud 3 (veebileht 3); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 Arstiabi; S2 Spetsialistid ja abivõimalused; S4 MTÜ Peaasjad: KUST LEIDA ABI JA TUGE?

**Vastus:** Mul on kahju, et sul nii raske on. Kui tunned, et sinu elu on praegu ohus, helista kohe 112 või mine erakorralise meditsiini osakonda. Viljandis on psühhiaatriakliiniku valvetuba avatud ööpäev läbi: 435 4255. Vaata abiinfot: peaasi.ee/kust-leida-abi-ja-tuge Kui oht ei ole vahetu, aga vajad praegu kellegagi rääkida, helista ööpäev läbi Ohvriabi kriisitelefonile 116 006. Emotsionaalse toe telefon 116 123 töötab iga päev kell 10–24.

**Täpsustav küsimus:** Kas sul on praegu mõte endale viga teha või tunned, et sa ei suuda end turvaliselt hoida?

## C10 · pöörduja

**Küsimus:** Kellega ma Viljandis esimesena ühendust võtan?

**Oodatud (küsija):** Viljandi linna sotsiaaltöötaja kontakt (kirjetest)

**Vastuse liik:** grounded; paketis 5 allikat, tsiteeritud 3 (veebileht 3); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 MTÜ Peaasjad: Suitsiid; S3 Emotsionaalne tugi; S4 Spetsialistid ja abivõimalused

**Vastus:** Kuna ütlesid, et sul on vahel nii halb, et sa ei taha enam elada, võta esimesena ühendust Viljandi psühhiaatriakliiniku valvetoaga. See on avatud ööpäev läbi: helista 435 4255 või mine Jämejalga, Pargi tee 6. Kui tunned, et oled praegu vahetus ohus, helista 112. Kui vajad kellegagi rääkimist, saad ööpäev läbi helistada Ohvriabi kriisitelefonile 116 006. Emotsionaalse toe telefon 116 123 vastab iga päev kell 10–24.

**Täpsustav küsimus:** Kas sul on praegu mõte endale viga teha või tunned, et sa ei suuda end turvaliselt hoida?

## C11 · sotsiaaltöötaja

**Küsimus:** Olen Viljandi linna sotsiaaltöötaja. Meie juurde tuleb 19-aastane noor, kes lahkub perekodust asendushoolduselt. Millised on minu kohustused järelhoolduse korraldamisel?

**Oodatud (küsija):** järelhoolduse korraldamine KOV-is, hindamine, plaan, eluruum

**Vastuse liik:** partial; paketis 64 allikat, tsiteeritud 7 (õigusakt 4, juhend 1, veebileht 1, muu 1); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 Sotsiaalhoolekande seadus § 45¹⁶ lg 1–3; S2 Sotsiaalhoolekande seadus § 45¹⁵ lg 1–2; S3 Sotsiaalhoolekandelise abi andmise kord § 16 lg 1–4; S4 Asendushooldusel täisealiseks saavate noorte iseseisvumise ja elluastumise toetamine ning järelhooldusteenuse planeerimine ja korraldamine. Soovituslik juhend kohalikule omavalitsusele (2025. aastal kaasajastatud); S8 Noorte toetamine ja järelhooldus; S10 Sotsiaalhoolekande seadus § 45⁹ lg 1–4; S50 Järelhooldusteenus

**Vastus:** Järelhoolduse vajadust tuleb hinnata juba noore asendushooldusel viibimise ajal. Koosta noorega juhtumiplaan: selle alusel korraldatakse talle eluaseme ning tema vajadustele vastavad tugiteenused ja toetused. Järelhoolduse eesmärk on toetada iseseisvat toimetulekut ja õpingute jätkamist (sotsiaalhoolekande seaduse § 45¹⁵ lg 1–2). Kui noor jätkab järelhooldusele suunamise ajal sotsiaalhoolekande seaduse § 45⁹ lg 2 nimetatud õppevormis õppimist, peab omavalitsus järelhooldusteenuse tagama (sotsiaalhoolekande seaduse § 45¹⁶ lg 1¹). Kui ta pärast põhi-, kesk-, kutse- või kõrghariduse omandamist jätkab järgmisel õppeaastal seaduses nimetatud tasemeõppes, tuleb teenus samuti tagada; kestus sõltub seaduses nimetatud õppimise jätkumise tingimustest ja lõpeb hiljemalt noore 25-aastaseks saamisel (sotsiaalhoolekande seaduse § 45¹⁶ lg 1). Kui noor nende kohustuslike tingimuste alla ei kuulu, võib omavalitsus talle teenust siiski tagada kuni 25-aastaseks saamiseni (sotsiaalhoolekande seaduse § 45¹⁶ lg 2). Viljandi linnas otsustab teenuse määramise sotsiaalkomisjon. Viljandi linna teenusekirjelduse järgi esita menetluseks vabas vormis avaldus linnavalitsuse sotsiaalametile, lisa isikut tõendav …

**Piirangud:** Ma ei saa nende andmete põhjal öelda, kas noor vastab järelhooldusteenuse kohustusliku tagamise õpitingimusele ega kas teenuse korraldamise eest vastutab Viljandi linn: sõnumist ei selgu noore õpingud ega rahvastikuregistrijärgne elukoht.

**Täpsustav küsimus:** Kas noor jätkab õppimist ja millises õppevormis? Kas tema rahvastikuregistrijärgne elukoht on Viljandi linnas?

## C12 · sotsiaaltöötaja

**Küsimus:** Mis peab olema järelhoolduse plaanis ja kes selle koostab?

**Oodatud (küsija):** plaani sisu ja koostaja kui tõendites

**Vastuse liik:** grounded; paketis 59 allikat, tsiteeritud 5 (õigusakt 3, juhend 2); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 Sotsiaalhoolekande seadus § 10 lg 1–5; S2 Asendushooldusel täisealiseks saavate noorte iseseisvumise ja elluastumise toetamine ning järelhooldusteenuse planeerimine ja korraldamine. Soovituslik juhend kohalikule omavalitsusele (2025. aastal kaasajastatud); S3 Asendushooldusel täisealiseks saavate noorte iseseisvumise ja elluastumise toetamine ning järelhooldusteenuse planeerimine ja korraldamine. Soovituslik juhend kohalikule omavalitsusele (2025. aastal kaasajastatud); S4 Sotsiaalhoolekande seadus § 9 lg 1–6; S7 Sotsiaalhoolekande seadus § 45¹⁵ lg 1–2

**Vastus:** Järelhoolduse juhtumiplaan peab lähtuma noore abivajadusest ning olema aluseks eluaseme ja vajaduspõhiste tugiteenuste ning toetuste korraldamisele (Sotsiaalhoolekande seaduse (SHS) § 45¹⁵ lg 2). Juhtumiplaan on kirjalik dokument, mis sisaldab abivajaduse hinnangut ja abimeetmete tegevuskava (SHS § 9 lg 3). Tegevuskavas tasub kirja panna noore vajadused, eesmärgid, tegevused ja vajalikud vahendid, samuti konkreetsed sammud, vastutajad ja tähtajad. Plaan koostatakse noort kaasates ja tema arvamust arvestades; plaanitud tegevused lähtuvad hinnatud vajadustest. Enne järelhooldusele suunamist koostab juhtumiplaani eestkostja ülesandeid täitev või noore täisealiseks saamisel tema elukohajärgne kohaliku omavalitsuse üksus, kui noor kuulub SHS § 45¹⁶ lg 1 või 1¹ alla (SHS § 10 lg 2). Juhtumiplaani vaatab elukohajärgne omavalitsus üle vähemalt kord aastas (SHS § 10 lg 3).

## C13 · sotsiaaltöötaja

**Küsimus:** Noor ütles, et tal on vahel enesetapumõtteid. Mida ma kohe tegema pean ja kuhu suunama?

**Oodatud (küsija):** kohene riski hindamine, 112 ägeda ohu korral, psühhiaatriline abi, kriisiabi; dokumenteerimine

**Vastuse liik:** partial; paketis 61 allikat, tsiteeritud 5 (muu 1, veebileht 4); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 Noorukite sõeltestimine, lühisekkumine ja ravile suunamine uimastite tarvitamise korral; S2 MTÜ Peaasjad: Kuidas aidata enesetapu mõtetega lähedast?; S3 Spetsialistid ja abivõimalused; S4 Kuidas olla toeks enesetapumõtetega inimesele?; S6 Arstiabi

**Vastus:** Võta noore juttu tõsiselt, kuula teda rahulikult ja küsi otse, kas ta mõtleb praegu enesetapule ning kas tal on konkreetne plaan, aeg või vahendid. Ära vähenda tema muret ega kiirusta lahendusi pakkuma. Mida konkreetsem plaan, seda suurem võib oht olla. Elutüdimuse ja enesetapumõtete korral on vaja psühhiaatri abi. Kui noorel on vahetu oht, konkreetne ettevalmistus või realistlik plaan, ära jäta teda üksi. Korralda viivitamatu pääs erakorralisele psühhiaatrilisele abile; kui tema elu on ohus, helista 112. Viljandi psühhiaatriakliiniku valveabi on loetletud ööpäevaringsena aadressil Jämejala, Pargi tee 6, telefon 435 4255. Vaata lähemalt: terviseportaal.ee/arstiabi/vaimne-tervis/spetsialistid-ja-abivimalused Kui vahetu oht ei ilmne, lepi noorega kokku järgmine samm psühhiaatri poole pöördumiseks ning paku abi nõustamise või ravi leidmisel. Jälgi olukorda ja tee vajaduse korral koostööd kaasatud tugivõrgustikuga.

**Piirangud:** Ma ei saa sinu kirjelduse põhjal hinnata, kas noorel on praegu vahetu oht; see sõltub tema vastustest ja olukorra hindamisest.

**Täpsustav küsimus:** Kas noorel on praegu konkreetne enesetapuplaan või vahendid selle elluviimiseks, või on ta vahetus ohus?

## C14 · sotsiaaltöötaja

**Küsimus:** Kuidas aidata tal taotleda puude raskusastet ja töövõime hindamist?

**Oodatud (küsija):** SKA ja Töötukassa taotlused, dokumendid, tugi

**Vastuse liik:** grounded; paketis 8 allikat, tsiteeritud 5 (õigusakt 3, veebileht 1, uuring/aruanne 1); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 Töövõimetoetuse seadus § 6 lg 1–7; S2 Puuetega inimeste sotsiaaltoetuste seadus § 2² lg 1–5; S3 Tööealise puude raskusastme tuvastamine; S5 Puude raskusastme tuvastamine ja töövõime hindamine nõustamisteenuse praktika põhjal; S7 Puuetega inimeste sotsiaaltoetuste seadus § 2³ lg 1–8

**Vastus:** Kui noor soovib nii puude raskusastme tuvastamist kui ka töövõime hindamist, aita tal täita tööealise ühistaotlus ja kirjeldada seal oma tervisega seotud tegutsemispiiranguid, abivahendite ning kõrvalise abi kasutamist ja rehabilitatsiooni. Töövõime hindamise taotlus esitatakse Töötukassale; ühistaotluse võib esitada ka Sotsiaalkindlustusametile. Puude raskusastme tuvastamise taotlus esitatakse Sotsiaalkindlustusametile, kuid ühistaotluse võib esitada Töötukassa kaudu. (Töövõimetoetuse seaduse (TVTS) § 6 lg 1–3; Puuetega inimeste sotsiaaltoetuste seaduse (PISTS) § 2² lg 1–3) Enne taotluse esitamist kontrolli koos noorega, kas ta on eelneva kuue kuu jooksul käinud perearsti, teda põhiliselt raviva eriarsti või töötervishoiuarsti vastuvõtul. Kui ta pole sel ajal arsti juures käinud, teavitab Töötukassa teda vastuvõtu vajadusest ja määrab selleks tähtaja. (TVTS § 6 lg 4–5) Taotlust täites aita noorel kirjeldada konkreetselt, kuidas tervis mõjutab tema igapäevast toimetulekut ja tegevusi. Puude raskusastme hindamisel arvestatakse muu hulgas terviseseisundit, tegevusvõimet ning kõrvalabi, juhendamise või järelevalve vajadust. Taotlust võib olla kasulik täita koos abistajaga; see on soov…

## C15 · sotsiaaltöötaja

**Küsimus:** Kas vald peab talle eluruumi tagama ja milliste tingimustega?

**Oodatud (küsija):** SHS eluruumi tagamine, järelhoolduse raames

**Vastuse liik:** partial; paketis 63 allikat, tsiteeritud 7 (õigusakt 4, muu 3); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S2 Viljandi linna omandis olevate eluruumide valdamise,kasutamise ja käsutamise ning sotsiaaleluruumide kasutusse andmise kord § 31; S3 Sotsiaalhoolekande seadus § 43 lg 1–2; S4 Sotsiaalhoolekande seadus § 41 lg 1–2; S9 Sotsiaalhoolekandelise abi andmise kord § 27 lg 1–3; S36 Sotsiaaleluruumi taotlus; S49 Järelhooldusteenus; S53 Sotsiaaleluruumi taotlemine

**Vastus:** Viljandi linn peab korraldama eluruumi tagamise teenuse inimesele, kes ei suuda sotsiaalmajandusliku olukorra tõttu endale ja oma pere vajadustele vastavat eluruumi tagada. See ei tähenda automaatselt, et noorele tuleb anda just sotsiaaleluruum. Eluruum peab vastama tema ja võimaliku pere põhjendatud vajadustele ning pere suurusele (sotsiaalhoolekande seaduse § 41 lg 1 ja § 43 lg 1). Viljandi linnas antakse sotsiaaleluruum üürile siis, kui eluruum on olemas ning inimese rahvastikuregistri elukoht on Viljandi linnas ja ta elab tegelikult linna territooriumil. Lisaks peab tal puuduma eluruum ning täituma vähemalt üks tingimus: ta ei suuda sotsiaalse ja majandusliku olukorra tõttu endale või perele eluruumi tagada ning eluruumi andmata jätmine ohustab toimetulekut, elu või tervist; või ta on eluruumi kaotanud tulekahju, loodusõnnetuse, katastroofi või muu sarnase põhjuse tõttu (Viljandi linna määruse § 31). Asendushoolduselt lahkuva noore järelhooldusteenus võib hõlmata eluaseme ning vajaduspõhiste tugiteenuste ja toetuste tagamist. Seega hinda eluasemevajadust järelhoolduse kavandamisel, kuid noore asendushoolduselt lahkumine üksi ei tõenda, et Viljandi linna sotsiaaleluruumi tingimu…

**Piirangud:** Ma ei saa nende andmete põhjal öelda, kas noor vastab Viljandi linna sotsiaaleluruumi tingimustele; selleks on vaja teada tema rahvastikuregistri elukohta ja tegelikku elukohta ning eluasemeolukorda.

**Täpsustav küsimus:** Kas noore rahvastikuregistri elukoht on Viljandi linnas ja kas ta elab tegelikult linna territooriumil?

## C16 · sotsiaaltöötaja

**Küsimus:** Kas ja kuidas saan talle määrata tugiisiku ja kui kauaks?

**Oodatud (küsija):** tugiisikuteenus SHS § 23, KOV-i kord

**Vastuse liik:** partial; paketis 65 allikat, tsiteeritud 6 (õigusakt 3, juhend 1, muu 2); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 Sotsiaalhoolekandelise abi andmise kord § 17 lg 1–5; S4 Sotsiaalhoolekande seadus § 24 lg 1–3; S5 Asendushooldusel täisealiseks saavate noorte iseseisvumise ja elluastumise toetamine ning järelhooldusteenuse planeerimine ja korraldamine. Soovituslik juhend kohalikule omavalitsusele (2025. aastal kaasajastatud); S11 Sotsiaalhoolekande seadus § 23 lg 1–4; S39 Täiskasvanud isikule tugiisikuteenuse taotlus; S59 Täiskasvanud isikute tugiisikuteenus

**Vastus:** Jah, kui hindamise põhjal selgub, et noor vajab tugiisiku abi, saab Viljandi linn teenuse määrata. Tugiisikuteenus aitab täisealisel inimesel probleemide tõttu kohustusi täita ja õigusi kasutada, juhendades ja motiveerides teda iseseisvamalt toime tulema (sotsiaalhoolekande seaduse § 23 lg 1). Viljandi linnas hindab sotsiaalameti spetsialist teenuse vajadust ning teeb teenuse saamise ja tasustamise otsuse (Viljandi linna määruse „Sotsiaalhoolekandelise abi andmise kord“ § 17 lg 5). Hinda noore kõrvalabi vajadust eraldi ning selgita välja, millist tuge ta igapäevaelus vajab. Viljandi linn koostab noore ja teenuseosutajaga haldusakti või halduslepingu, kus määratakse vajalikud toimingud. Kui noor seda soovib, aita tal sobivat tugiisikut valida; tal on õigus enne valiku kinnitamist selle inimesega sobivust hinnata (sotsiaalhoolekande seaduse § 24 lg 1–3). Tugiisikuga koostöö on noorele vabatahtlik, seega aruta valikut temaga (sotsiaalkindlustusameti 2025. aastal kaasajastatud juhendis kirjeldatud soovitus). Praktiliselt saad vajaduse ja taotlemise põhjuse kirja panna täiskasvanud isiku tugiisikuteenuse taotlusvormil. Viljandi linna teenusekirjelduses on kirjas, et otsuse ettevalmistam…

**Piirangud:** Ma ei saa siinse teabe põhjal öelda, kui pikaks perioodiks tuleks teenus sellele noorele määrata: kindlat algset kestust siin ei täpsustata. Kestust saab vajaduse kordushindamisel muuta.

## C17 · sotsiaaltöötaja

**Küsimus:** Kas tal võib olla õigus erihoolekandeteenustele, näiteks toetatud elamisele?

**Oodatud (küsija):** SHS § 95 tingimused (raske, sügava või püsiva kuluga psüühikahäire), SKA hindab

**Vastuse liik:** partial; paketis 10 allikat, tsiteeritud 5 (õigusakt 3, juhend 2); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 Sotsiaalhoolekande seadus § 95; S6 Asendushooldusel täisealiseks saavate noorte toetamine. Juhend asendus- ja järelhooldusteenuse osutajatele; S7 Asendushooldusel täisealiseks saavate noorte toetamine. Juhend asendus- ja järelhooldusteenuse osutajatele; S9 Sotsiaalhoolekande seadus § 94 lg 1–2; S10 Sotsiaalhoolekande seadus § 70 lg 1–8

**Vastus:** Jah, toetatud elamise teenus võib talle sobida, kui tal on raske, sügav või püsiva kuluga psüühikahäire, ta suudab enda eest hoolitseda ja tuleb juhendamisel toime igapäevatoimingutega ning talle ei osutata samal ajal seaduses loetletud teatud teisi erihoolekandeteenuseid. Erandina ei ole sellele teenusele õigust isikul, kellele viitab Sotsiaalhoolekande seaduse § 95. (Sotsiaalhoolekande seaduse § 95) Toetatud elamisel juhendatakse inimest majapidamise ja igapäevaelu korraldamisel ning elamispinna leidmisel. Teenuse saamiseks esitab inimene taotluse Sotsiaalkindlustusametile; amet hindab vajadust ja teeb otsuse. Otsus tehakse 40 tööpäeva jooksul taotluse ja kõigi nõutavate dokumentide saamisest. (Sotsiaalhoolekande seaduse § 94 lg 1–2; § 70 lg 1–2, 4) Järelhoolduse kavandamisel võib noorele planeerida tema vajadustele vastavat erihoolekandeteenust, sealhulgas toetatud elamist. Vajaduse kaalumisel tasub aegsasti jagada kohalikule omavalitsusele infot noore toimetuleku kohta.

**Piirangud:** Ma ei saa öelda, kas noor nende tingimuste järgi teenusele õigust omab: siin ei ole kirjeldatud, kas tal on nõutud diagnoos, kuidas ta tuleb toime enda eest hoolitsemise ja igapäevatoimingutega või kas talle osutatakse mõnda välistavat teenust.

**Täpsustav küsimus:** Kas noorel on raske, sügav või püsiva kuluga psüühikahäire ning kuidas ta tuleb toime enda eest hoolitsemise ja igapäevatoimingutega?

## C18 · sotsiaaltöötaja

**Küsimus:** Kuidas jagan infot perekodu, kooli ja psühhiaatriga nii, et see oleks seaduslik?

**Oodatud (küsija):** nõusolek, isikuandmete kaitse, tervise andmed eriliigilised

**Vastuse liik:** partial; paketis 12 allikat, tsiteeritud 2 (õigusakt 1, veebileht 1); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 Psühhiaatrilise abi seadus § 5 lg 1–3; S2 MTÜ Peaasjad: Räägi lapsega

**Vastus:** Psüühilise seisundi, ravi ja diagnoosi kohta käiv info on eraelu saladus. Seda võib raviprotsessist väljapoole edastada noore enda või tema seadusliku esindaja kirjalikul nõusolekul või seaduses nimetatud erandjuhtudel (Psühhiaatrilise abi seaduse § 5 lg 2). Seega küsi enne info jagamist noorelt kirjalik nõusolek ning leppige kokku, kellele ja millist infot jagad. Räägi noorega rahulikult ja selgita, kui sa ei saa saadud infot ainult enda teada jätta. Arutage, millist abi ta vajab ning mida on selleks tarvis perekodu, kooli ja tervishoiutöötajaga jagada. Kui noor osaleb raviprotsessis, ei saa tervishoiutöötaja raviteavet omal algatusel teistega jagada; koostööks tuleb asjaosalistega läbi rääkida ja saada nõusolekud. See on praktiline juhis noore ja perega koostööks, mitte seadusesäte.

**Piirangud:** Ma ei saa siinse info põhjal öelda, kas konkreetses olukorras kehtib mõni seaduses nimetatud erand või milliseid muid andmeid võib kooli ja perekoduga jagada.

## C19 · teenuseosutaja

**Küsimus:** Oleme Viljandimaal tugiisikuteenust ja toetatud elamist pakkuv teenuseosutaja. Linn soovib meilt tugiisikut 19-aastasele perekodust lahkuvale noorele, kellel on ADHD ja depressioon. Kuidas teenust kavandada?

**Oodatud (küsija):** eesmärgid koos noorega, kava, kohtumiste sagedus, koostöö KOV-iga

**Vastuse liik:** partial; paketis 13 allikat, tsiteeritud 6 (juhend 3, veebileht 1, õigusakt 2); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S2 Asendushooldusel täisealiseks saavate noorte iseseisvumise ja elluastumise toetamine ning järelhooldusteenuse planeerimine ja korraldamine. Soovituslik juhend kohalikule omavalitsusele (2025. aastal kaasajastatud); S4 Asendushooldusel täisealiseks saavate noorte iseseisvumise ja elluastumise toetamine ning järelhooldusteenuse planeerimine ja korraldamine. Soovituslik juhend kohalikule omavalitsusele (2025. aastal kaasajastatud); S5 Järelhooldusteenuse kvaliteedijuhend; S6 Noorte toetamine ja järelhooldus; S7 Sotsiaalhoolekande seadus § 45¹⁵ lg 1–2; S13 Sotsiaalhoolekande seadus § 23 lg 1–4

**Vastus:** Kavanda tugiisikuteenust koos noorega ja lähtu tema vajadustest, tugevustest ning eesmärkidest. Tugiisiku roll on juhendada ja motiveerida ning aidata noorel kasvatada iseseisvust ja vastutust igapäevaelus (sotsiaalhoolekande seaduse § 23 lg 1). Kui linn korraldab noorele järelhooldusteenust, peab kohalik omavalitsus teenuse korraldama juhtumiplaani alusel ning tagama selle järgi eluaseme ja vajaduspõhised tugiteenused ja toetused (sotsiaalhoolekande seaduse § 45¹⁵ lg 1–2). Tugiisikuteenus võib olla selle raames üks vajaduspõhine tugi. Enne noore teenusele suunamist hinnatakse tema abivajadust ning juhtumiplaanis pannakse paika tegevused, tähtajad ja vastutajad. Hindamisel tasub vaadata tervist ja heaolu, arengut, peret ja sõpru, õppimist ja tööd, elukohta, praktilisi oskusi, raha ning õigusi ja juriidilisi küsimusi. Leppige noorega kokku, millised eesmärgid ja tegevused tema jaoks tähtsad on, kui sageli kohtute ning kuidas ta saab kohtumiste vahel sinuga ühendust. Pange paika ka suhtluskorra piirid ja see, millal vastad, et tugi oleks järjepidev ja korraldus oleks tugiisikule jõukohane. Hinda vajadusi ja eesmärke uuesti regulaarselt ning leppige kokku koostöö teiste vajalike teenu…

**Piirangud:** Ma ei saa nende andmete põhjal öelda, kas noorele tuleb järelhooldusteenus tagada: see sõltub muu hulgas tema õpingutest ja suunamise asjaoludest. Kohaliku lepingu või rahastuse korraldus ei selgu siinsest infost.

**Täpsustav küsimus:** Milline omavalitsus teenust korraldab? Kas noor jätkab õppimist? Need asjaolud aitavad täpsustada kohalikke kokkuleppeid ja seda, kas järelhooldusteenuse tagamise kohustus võib rakenduda.

## C20 · teenuseosutaja

**Küsimus:** Millised nõuded kehtivad tugiisikule ja kas ta võib olla ka meie toetatud elamise töötaja?

**Oodatud (küsija):** tugiisiku nõuded (SHS § 23, KOV), toetatud elamise tegevusjuhendaja nõuded (erihoolekanne)

**Vastuse liik:** partial; paketis 11 allikat, tsiteeritud 5 (õigusakt 3, juhend 2); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 Sotsiaalhoolekande seadus § 25 lg 1–2; S2 Tugiisikuteenuse juhend; S3 Tugiisikuteenuse juhend; S6 Sotsiaalhoolekande seadus § 94 lg 1–2; S8 Sotsiaalhoolekande seadus § 24 lg 1–3

**Vastus:** Tugiisikuteenust vahetult osutav inimene peab lähtuma teenuse osutamise haldusaktist või halduslepingust. Ta ei tohi seda teenust vahetult osutada, kui tema tahtliku kuriteo eest saadud karistatus võib ohustada teenusesaaja elu, tervist või vara, kui ta on teenusesaaja esimese või teise astme üleneja või alaneja sugulane või kui ta elab teenusesaajaga alaliselt või püsivalt samas eluruumis (Sotsiaalhoolekande seaduse (SHS) § 25 lg 1–2). Sama inimene võib töötada toetatud elamise teenuse osutajana ja olla tugiisik, kui tugiisikuteenuse vahetu osutamise piirangud on täidetud. Tugiisiku ja toetatud elamise töötaja ülesanded on siiski erinevad: toetatud elamise teenuses juhendatakse inimest muu hulgas igapäevaelu ja majapidamise korraldamisel ning valmistatakse teda ette iseseisvaks elamiseks (SHS § 94 lg 1–2). Korralduses pane tugiisiku ülesanded ja vajalikud toimingud kirja teenuse osutamise haldusakti või halduslepingusse. See koostatakse kohaliku omavalitsuse, teenusesaaja ja teenuseosutaja koostöös. Tugiisiku valikul arvesta tema pädevuse ja isikuomadustega; sissejuhatav koolitus on soovitatav ning teadmisi saab täiendada näiteks psüühikahäirega inimese toetamise ja esmaabi teemal…

**Piirangud:** Nende andmete põhjal ei saa ma kinnitada, kas tugiisiku ja toetatud elamise töötaja rollide ühendamisele kehtib teie lepingus või muudes kohalikes kokkulepetes lisatingimusi.

## C21 · teenuseosutaja

**Küsimus:** Kui noor lõpetab koostöö ja ei vasta telefonile, mida me teeme?

**Oodatud (küsija):** kokkulepitud tegevus, KOV-i teavitamine, turvalisuse kaalutlus

**Vastuse liik:** partial; paketis 6 allikat, tsiteeritud 3 (juhend 2, muu 1); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 Asendushooldusel täisealiseks saavate noorte iseseisvumise ja elluastumise toetamine ning järelhooldusteenuse planeerimine ja korraldamine. Soovituslik juhend kohalikule omavalitsusele (2025. aastal kaasajastatud); S2 Tugiisikuteenuse juhend; S3 Noored on vahel üllatunud, kui nende vastu huvi tuntakse

**Vastus:** Kui noor ei vasta telefonile, ära käsitle seda kohe koostöö lõpetamisena. Ühes 2018. aasta Raasiku valla juhtumikorraldaja kogemusel prooviti noorega ühendust saada e-posti, kõne või sõnumi, tavakirja ja vahel sotsiaalmeedia kaudu; kontakti leidmiseks tehti mõnikord 6–8 katset ning pakuti kohtumist noorele sobivas kohas. See on ühe juhtumikorraldaja kirjeldatud praktika, mitte kõigile teenuseosutajatele kehtiv kord. Kui noor ütleb, et soovib teenusest loobuda, kavandage teenuse lõpetamine temaga tundlikult ja selgitage koostöö alguses, kuidas sellest viisakalt loobuda. Noore tugiisikuteenuse kiire lõppemine võib tema olukorda raskendada, seega tasub lõpetamise vajadus ja viis hoolikalt läbi rääkida. Pärast teenuse lõppu peaks kohaliku omavalitsuse sotsiaaltöötaja hoidma noorega kontakti vähemalt kaks aastat pärast iseseisvalt elama asumist; probleemide korral võib võimaluse korral kaasata sama tugiisiku uuesti. Tugiisikuteenuse juhendis on teenuse lõppemise võimalike alustena nimetatud vastastikune kokkulepe, teenusevajaduse lõppemine, elukoha muutumine, teenuse mittekasutamine ja muu põhjus. Teenuse ajal ja lõppedes on asjakohane küsida noorelt tagasisidet.

**Piirangud:** Ma ei saa nende andmete põhjal öelda, milline kontaktikatsete arv või lõpetamise kord teie teenuse kokkuleppes kehtib ega hinnata, kas noorel on praegu vahetu abivajadus.

**Täpsustav küsimus:** Kas noor on ise öelnud, et soovib teenusest loobuda, või on ta üksnes telefonile vastamata jätnud?

## C22 · teenuseosutaja

**Küsimus:** Kuidas toimida, kui noor räägib tugiisikule enesetapumõtetest?

**Oodatud (küsija):** riski hindamine, 112 ägeda ohu korral, kriisiabi, KOV/arst, dokumenteerimine

**Vastuse liik:** grounded; paketis 6 allikat, tsiteeritud 5 (juhend 1, veebileht 3, muu 1); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 Vaimse tervise parandamise kogukonna juhend; S2 MTÜ Peaasjad: Kuidas aidata enesetapu mõtetega lähedast?; S3 Arstiabi; S4 MTÜ Peaasjad: Suitsiid; S6 Suitsiidse patsiendi käsitlus esmatasandi tervishoius (sh kooli- ja töötervishoid), kiirabis ja erakorralise meditsiini osakondades (SUIPA). Lõppraport

**Vastus:** Võta noore juttu tõsiselt, kuula teda rahulikult ning küsi otse, kas ta mõtleb enesetapule. Kui vastus on jah, küsi, kuidas ja millal ta on mõelnud seda teha. Mida konkreetsem on plaan, seda suurem võib olla oht. Ära pisenda tema muret ega jäta teda oma mõtetega üksi. Kui oht tundub vahetu, jää noorega ja veendu, et sa ise ei oleks ohus. Võimalusel eemalda lähedusest enesetapuvahendid ning kaasa kohe abi. Kui noore elu on ohus, helista 112. Väga suure suitsiidiohu korral ära jäta teda üksi; kui valvepsühhiaatri juurde ei saa ise minna, kutsu kiirabi. Enesetapumõtete korral on vaja pöörduda psühhiaatri poole. Viljandis on psühhiaatriakliiniku valvetuba avatud ööpäev läbi telefonil 435 4255. Vaata lähemalt: peaasi.ee/kuidas-aidata ja peaasi.ee/suitsiid. Edasise toe korraldamisel tee koostööd vaimse tervise ja sotsiaalvaldkonna spetsialistidega ning kaasa võimalusel noore lähedased. Toeks on oluline üks pädev kontaktisik, kes koordineerib koostööd.

## C23 · teenuseosutaja

**Küsimus:** Milliseid andmeid me tohime hoida ja kui kaua?

**Oodatud (küsija):** isikuandmete kaitse, eesmärgipärasus, säilitamine lepingu/seaduse järgi

**Vastuse liik:** partial; paketis 15 allikat, tsiteeritud 4 (juhend 2, õigusakt 2); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S3 Eetikakäsiraamat | ESTA; S4 Eetikakäsiraamat | ESTA; S13 Isikuandmete kaitse seadus § 20 lg 1–2; S15 Isikuandmete kaitse seadus § 17 lg 1–4

**Vastus:** Kogu noore kohta ainult neid andmeid, mida on vaja teenuse eesmärgi täitmiseks. Enne andmete küsimist mõtle läbi, miks neid vajad, ja selgita seda noorele arusaadavalt. Kui andmed pole enam eesmärgi täitmiseks vajalikud, tuleks need kustutada. Terviseandmed, sealhulgas info ADHD ja depressiooni kohta, on eriliiki isikuandmed. Neid tohib töödelda ainult siis, kui see on rangelt vajalik ja esineb seaduses nimetatud alus; kasutada tuleb ka sobivaid kaitsemeetmeid (isikuandmete kaitse seaduse § 20 lg 1–2). Kui seadus või määrus ei sätesta säilitustähtaega, peab selle määrama vastutav töötleja. Tähtaega võib pikendada ainult põhjendatud juhul. Kui tähtaega ei ole võimalik määrata, tuleb pidevalt hinnata, kas andmete töötlemine on endiselt vajalik; tähtaja lõppedes tuleb andmed jäädavalt kustutada (isikuandmete kaitse seaduse § 17 lg 1–4).

**Piirangud:** Ma ei saa siin oleva info põhjal öelda, milline konkreetne dokumentide loetelu ja säilitustähtaeg kehtib teie tugiisikuteenuse ning toetatud elamise dokumentidele. Kümneaastane tähtaeg on sätestatud erihoolekandeteenuse osutaja dokumentidele, kuid ma ei saa kinnitada, et see kehtib teie kirjeldatud teenustele (sotsiaalhoolekande seaduse § 83 lg 2–3).

## C24 · teenuseosutaja

**Küsimus:** Kui noor saab Sotsiaalkindlustusametilt toetatud elamise suunamise, kuidas me teenuse alustame ja mida riik rahastab?

**Oodatud (küsija):** SKA suunamine, tegevuskava, riigi rahastus erihoolekandeteenusele

**Vastuse liik:** partial; paketis 15 allikat, tsiteeritud 8 (õigusakt 6, veebileht 2); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 Sotsiaalhoolekande seadus § 71 lg 1–5; S2 Sotsiaalhoolekande seadus § 83 lg 1; S3 Sotsiaalhoolekande seadus § 96 lg 1–7; S4 Sotsiaalhoolekande seadus § 72 lg 1–6; S5 Erihoolekandeteenuse osutajale; S6 Erihoolekandeteenused; S11 Sotsiaalhoolekande seadus § 94 lg 1–2; S15 Sotsiaalhoolekande seadus § 71 lg 5–10

**Vastus:** Kui suunamisotsus on väljastatud, leppige Sotsiaalkindlustusameti, noore ja teiega kokku teenuse alustamise kuupäev. Otsuses on kirjas teenuse saamise tähtaeg ja eesmärk ning teenuse kestuse ja tegevuste soovitusliku sageduse määrab Sotsiaalkindlustusamet (sotsiaalhoolekande seaduse § 71 lg 2, 5; § 96 lg 2). Noorel tuleb pöörduda teie poole kokkulepitud tähtpäeval, toetatud elamise puhul hiljemalt kolme päeva jooksul sellest kuupäevast. Kui tähtpäev jääb mõjuval põhjusel vahele, võib Sotsiaalkindlustusamet noore taotlusel ja teiega kokkuleppel määrata uue tähtpäeva (sotsiaalhoolekande seaduse § 71 lg 6, 8). Teenuse alustamisel tutvusta noorele oma kodukorda ning tema õigusi ja kohustusi. Kui teenust osutad enda ruumides, tutvusta ka vajalikke ruume. Koosta noore toetusvajadusest lähtuv personaalne tegevusplaan. Toetatud elamise tegevusi tuleb teha vähemalt kaks tundi nädalas ning vahetult osutatud teenuse tundide üle tuleb arvestust pidada (sotsiaalhoolekande seaduse § 83 lg 1; § 96 lg 6). Teenuse sisu hulka kuulub juhendamine igapäevaelu ja majapidamise korraldamisel, sealhulgas eelarve koostamisel, ning vajaduse korral ettevalmistus iseseisvaks elamiseks ja abi elamispinna hankim…

**Piirangud:** Ma ei saa siin oleva info põhjal nimetada toetatud elamise teenuse riigieelarvest rahastatava maksimaalse maksumuse eurodes suurust.

## C25 · teenuseosutaja

**Küsimus:** Kuidas mõõdame, kas teenus aitas, ja kuidas sellest linnale aru anname?

**Oodatud (küsija):** eesmärkide hindamine, tagasiside, aruandlus KOV-ile

**Vastuse liik:** grounded; paketis 5 allikat, tsiteeritud 4 (juhend 3, muu 1); valikumudel luges — ja valis 0.

**AI otsinguvariandid:** —

**Tsiteeritud:** S1 Isikliku abistaja teenuse kvaliteedijuhis; S2 Hoolekandeteenuste kvaliteedi juhendmaterjal; S3 Kvaliteetne sotsiaalteenus on isikukeskne; S4 Hoolekandeteenuste kvaliteedi juhendmaterjal

**Vastus:** Mõõda teenuse mõju noore enda seatud eesmärkide järgi. Pane koos temaga kirja oodatav tulemus, kuidas seda hinnata ja millal üle vaadata. Näiteks iseseisvuse suurenemist saab hinnata, kui võrdlete noore olukorda enne teenust ja kokkulepitud ajal hiljem. Üht kõigile sobivat mõõdikut ei ole: arvesta noore enda hinnangut ja eesmärkide tähtsust talle. Vaata regulaarselt üle nii vahetud tulemused kui ka teenuse mõju. Küsi noorelt ja vajaduse korral tema lähedastelt tagasisidet, arutage hindamistulemused koos läbi ning muutke tegevusi, kui see on vajalik. Kvaliteedijuhises on soovitatud teha küsitlusi kord aastas, analüüsida tulemusi ja avaldada tagasiside üldistatud kujul oma veebilehel. Linnale aru andes näita, kuidas teenuse eesmärgid ja tulemused on hinnatavad ning mida tagasiside ja hindamine näitasid. Rahastajale teenuse kvaliteedi tõendamine eeldab teenuse eesmärkide läbimõtlemist, teenuse kujundamist ja hindamist. Vali näitajad, mis sobivad seatud eesmärgiga, näiteks eesmärgi saavutamine või teenuse kasutaja hinnang elukvaliteedi muutusele.

