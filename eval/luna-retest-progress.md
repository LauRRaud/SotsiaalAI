# Luna RAG korduse vahelogi

See fail on jooksvalt täidetav logi. Iga lõpetatud küsimus lisatakse kohe; pooleli
jooksu tulemus ei jää ainult vestluse ajalukku.

- Kood-SHA: `69aa09a36` (serveris deployitud 2026-08-30; frontend/RAG/research-worker aktiivsed, `/vestlus` 200)
- 75 küsimust: põhinimetaja `75`
- Golden: eraldi regressioonikomplekt `37`, ei lähe 75 nimetajasse
- Küsimuste esitaja: Luna
- Soli küsimuste jooks: keelatud
- Praegune staatus: `FAASID 1–2 LÕPETATUD — runtime 69aa09a3; isolated 2 PASS / 1 PARTIAL / 8 FAIL, sequential 2 PASS / 2 PARTIAL / 7 FAIL; Golden-37 33 PASS / 0 PARTIAL / 4 FAIL; paus enne 75 küsimuse väravat`

## Uus kordus — runtime `c21821c2`

Need tulemused kuuluvad ainult sellesse deployitud runtime'i. Faas 1 tehti värsketes
vestlustes ja faas 2 ühes järjestikuses vestluses; iga lõpetatud juhtum on siia jooksvalt
lisatud. Pärast faasi 2 on omaniku nõudel paus enne 75 küsimuse väravat.

### Faas 1 — isolated (uue runtime'i kordus)

| case_id | status | answer_summary | retrieved_source_ids | displayed_source_ids | trace_file | runtime | timestamp |
|---|---|---|---|---|---|---|---|
| J03 | FAIL | Vastus jäi samaks üldiseks keeldumiseks („Ma ei saa sellele praegu piisavalt kindlat vastust anda.”); kriisitunnuseid ega 2018. aasta telefoninumbreid ei esitatud. | none visible | none visible | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-29T20:04:00+03:00 |
| J04 | PASS | Vastus nimetas Viljandi linna ja valda, Türi ning Põltsamaa valda ning neli alustala: universaalne ennetus, ühe ukse põhimõte, teadus- ja tõenduspõhised sekkumised ja valdkonnaülene koostöö. Allikanupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-29T20:04:00+03:00 |
| J05 | FAIL | Vastus jäi üldiseks keeldumiseks („Ma ei saa sellele praegu piisavalt kindlat vastust anda.”); 30/12/60/19 taastava õiguse näitajad puudusid. | none visible | none visible | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-29T20:05:00+03:00 |
| J07 | PASS | Vastus andis koondperioodi kohta 678 inimest, 273 vabatahtlikku, 21 600 töötundi, 12 maakonda ja 43 omavalitsust ning ütles, et arvud käivad kogu perioodi, mitte aastate kaupa. Allikanupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-29T20:06:00+03:00 |
| J08 | FAIL | Vastus kordas valed osakaalud 59%, 41%, 62% ja 38%; oodatud 61%, 26%, 11% ja 18% ei esitatud. Allikanupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-29T20:06:00+03:00 |
| J09 | FAIL | Vastus küsis täpsustust („Millise joonise või näitaja juures nimetatud nelja protsenti silmas peate?”) ega esitanud oodatud 33%, 13%, 19% ja 7% näitajaid. Allikanupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-29T20:06:00+03:00 |
| J11 | FAIL | Vastus rääkis 18 fookusgrupiintervjuust ja 40 osalejast, kuid ei andnud oodatud 7 intervjuud, 6 individuaalset, 3-liikmelist rühma ega kolmeetapilist analüüsi. Allikanupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-29T20:07:00+03:00 |
| J12 | FAIL | Vastus ütles, et maakonnapõhist kohtumiste arvu ei ole kinnitatud; oodatud viis kohtumist maakonna kohta puudus. Allikanupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-29T20:07:00+03:00 |
| J13 | PARTIAL | Vastus kinnitas 13–18-aastaste tõsistesse raskustesse sattunud noorte rühma ja mitme raskuse koosesinemist, kuid ei andnud oodatud tavapärast 3–5 probleemi. Allikanupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-29T20:08:00+03:00 |
| J14 | FAIL | Vastus jäi üldiseks keeldumiseks; Saue valla alla 18-aastaste laste arvu, umbes 90% kohtusse pöördumise, 14 kohtuasja ja 3 kokkuleppe väiteid ei esitatud. | none visible | none visible | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-29T20:08:00+03:00 |
| J18 | FAIL | Vastus andis ainult 42 osalejat ega esitanud kolme praktikurühma 5+5+5 ja kokku 15 jaotust. Allikanupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-29T20:09:00+03:00 |
| J20 | PASS | Vastus ajastas muudatused 2023. aasta kevadesse, 2023. aasta suvesse ja 2025. aasta jaanuarisse ning eristas jaanuari jõustumisaega. Allikanupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-29T20:10:00+03:00 |
| J22 | FAIL | Vastus jäi üldiseks keeldumiseks; kuue kuu järelhindamist ning osaleja ja tööandja vaate võrdlust ei esitatud. | none visible | none visible | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-29T20:10:00+03:00 |
| V01 | PASS | Vastus andis sageduseks vähemalt kord nelja kuu jooksul ning arvud Rakvere 5, Jõhvi 7 ja Narva 5; allikanupp ja 2016. aasta allikaviide olid nähtavad. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-29T20:10:00+03:00 |
| V03 | PASS | Vastus andis 2017. aastal igas maakonnas viis KOV-i sotsiaaltöötajate rühmasupervisiooni kohtumist ning eristas lastekaitse 20 gruppi. Allikanupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-29T20:11:00+03:00 |
| V04 | FAIL | Vastus andis 22%, 41% ja 13%, mitte oodatud 10%=640, 6%=227 ja 2%=100. Allikanupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-29T20:11:00+03:00 |
| V05 | FAIL | Vastus jäi üldiseks keeldumiseks; kuue kuu järelmõju ning osaleja ja tööandja hinnangud puudusid. | none visible | none visible | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-29T20:12:00+03:00 |
| V06 | FAIL | Vastus jäi üldiseks keeldumiseks; oodatud 169 laste eraldamise otsust ja aastat 2018 ei esitatud. | none visible | none visible | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-29T20:12:00+03:00 |
| A01 | PASS | Vastus andis aktiivse registri täieliku 1-töö inventari Krister Tüllineni kohta ning sidus rea teemasektsiooniga „Taasühiskonnastamine vanglas”. Allikanupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-29T20:13:00+03:00 |
| A02 | PASS | Vastus andis aktiivse registri täieliku 5-töö inventari Maarja Krais-Leoski kohta ning iga rea teema/sektsiooni. Allikanupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-29T20:13:00+03:00 |
| A03 | PASS | Vastus andis aktiivse registri täieliku 4-töö inventari Kadi Lubi kohta koos teemasektsioonidega (metoodika, eelretsenseeritud artikkel, tervis, teoreetilised lähtekohad). Allikanupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-29T20:14:00+03:00 |
| A04 | PASS | Vastus andis aktiivse registri täieliku 1-töö inventari Ave Ungro kohta ja sidus selle analüüsi teemaga. Allikanupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-29T20:15:00+03:00 |
| A05 | PASS | Vastus andis aktiivse registri täieliku 2-töö inventari Jane Langemetsa kohta koos kogemuse teemasektsiooniga. Allikanupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-29T20:16:00+03:00 |
| A06 | PASS | Vastus andis aktiivse registri täieliku 2-töö inventari Liina Lokko kohta ning mõlema töö teemasektsiooni. Allikanupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-29T20:16:00+03:00 |
| A07 | PASS | Vastus andis aktiivse registri täieliku 18-töö inventari Kadri Kuulpaki kohta koos teemasektsioonidega. Allikanupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-29T20:17:00+03:00 |
| A08 | PASS | Vastus andis aktiivse registri täieliku 2-töö inventari Merle Tombergi kohta koos teemasektsioonidega. Allikanupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-29T20:17:00+03:00 |
| A10 | PASS | Vastus andis aktiivse registri täieliku 13-töö inventari Judit Strömpli kohta koos teemasektsioonidega. Allikanupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-29T20:18:00+03:00 |
| S08 | PASS | Vastus kirjeldas Saaremaa COVID-kogemust, teenuste kiiret ümberkorraldust, Kriisikodu, kogukonna ja töötajate tuge ning kriisivalmiduse õppetunde. Allikanupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-29T20:18:00+03:00 |
| M01 | FAIL | Vastus jäi üldiseks keeldumiseks; EPIKoja uuringu meetodit, aega ega 42 osalejat ei esitatud. | none visible | none visible | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-29T20:19:00+03:00 |
| M02 | FAIL | Vastus ütles, et Tallinnale suunatud soovitusi ei ole kinnitatud ja andis vaid üldise arengukava suuna; oodatud Tallinna soovitused puudusid. Allikanupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-29T20:19:00+03:00 |
| M07 | PASS | Vastus kirjeldas Tarkvanema töölehe eesmärki, sobiva hetke ja vanuse valikut, üks-küsimus-korraga lähenemist, hinnanguteta kuulamist ja lapse mitte sundimist. Allikanupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-29T20:20:00+03:00 |
| K01 | FAIL | Vastus jäi üldiseks keeldumiseks; Kuusalu koduteenuse taotlemist ja § 6 sisu ei esitatud. | none visible | none visible | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-29T20:20:00+03:00 |
| K02 | PASS | Vastus kirjeldas Narva linnas kirjaliku taotluse esitamist, abivajaduse hindamist/kodukülastust ja kümne tööpäeva otsust ning nimetas teenuse sisu. Allikanupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-29T20:21:00+03:00 |
| K05 | PASS | Vastus küsis enne allikavalikut korrektse KOV-i täpsustuse: „Kas mõtled Tartu linn või Tartu vald?”. | none — clarification before RAG | none | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-29T20:21:00+03:00 |

**Faas 1 vahetulemus (runtime `c21821c2`): 34/34 lõpetatud — 18 PASS, 1 PARTIAL, 15 FAIL.**
PASS: J04, J07, J20, V01, V03, A01, A02, A03, A04, A05, A06, A07, A08, A10, S08, M07, K02, K05; PARTIAL: J13; FAIL: J03, J05, J08, J09, J11, J12, J14, J18, J22, V04, V05, V06, M01, M02, K01.

### Faas 2 — sequential (runtime `c21821c2`)

Sama 34 juhtumit jooksevad ühes värskes vestluses algses manifesti järjekorras.
Pärast viimast vastust teen omaniku nõudel pausi enne 75-küsimuse väravat.

| case_id | status | isolated_status | history_effect | answer_summary | retrieved_source_ids | displayed_source_ids | trace_file | runtime | timestamp |
|---|---|---|---|---|---|---|---|---|---|
| J03 | FAIL | FAIL | esimene sequential-küsimus, varasemat konteksti ei olnud | Vastus jäi üldiseks keeldumiseks; kriisitunnuseid ega 2018. aasta telefoninumbreid ei esitatud. | none visible | none visible | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-30T09:40:00+03:00 |
| J04 | PASS | PASS | pärast J03 valis õige Perepesa-allika ega kandnud kriisiteemat üle | Vastus nimetas Viljandi linna ja valda, Põltsamaa ja Türi valda, neli alustala ning lisaks Elva ja Tartu uued keskused; allikanupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-30T09:40:00+03:00 |
| J05 | FAIL | FAIL | pärast J04 tuli taas üldine keeldumine; Perepesa-kontekst ei kandunud arvuküsimusse | Vastus ei esitanud 30/12/60/19 taastava õiguse näitajaid. | none visible | none visible | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-30T09:41:00+03:00 |
| J07 | PASS | PASS | pärast J05 eraldas süsteem õige Seltsiliste koondallika ja ei kandnud keeldumist üle | Vastus andis 678 inimest, 273 vabatahtlikku, 21 600 töötundi, 12 maakonda ja 43 omavalitsust nov 2018–apr 2020 kohta; allikanupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-30T09:41:00+03:00 |
| J08 | FAIL | FAIL | pärast J07 küsis süsteem täpsustust ega leidnud hoolduskoormuse nelja oodatud osakaalu | Vastus palus täpsustada, millise küsimuse või joonise nelja osakaalu kohta küsitakse; 61/26/11/18 puudusid. Allikanupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-30T09:42:00+03:00 |
| J09 | FAIL | FAIL | pärast J08 jätkus täpsustusrada, kuid oodatud protsendid ei avanenud | Vastus palus täpsustada vanuserühma, taustatunnust või joonist; 33/13/19/7 puudusid. Allikanupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-30T09:42:00+03:00 |
| J11 | FAIL | FAIL | pärast J09 ei kandnud süsteem eelmist täpsustusrada õigeks allikaks | Vastus andis 18 fookusgrupiintervjuud/40 osalejat, kuid mitte 7 intervjuud, 6 individuaalset, 3-liikmelist rühma ega kolmeetapilist analüüsi. Allikanupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-30T09:43:00+03:00 |
| J12 | FAIL | FAIL | pärast J11 jäi maakonnapõhine arv endiselt kinnitamata | Vastus ei andnud oodatud viit kohtumist maakonna kohta; allikanupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-30T09:43:00+03:00 |
| J13 | PARTIAL | PARTIAL | pärast J12 vastas süsteem vanuserühmale ja probleemide liikidele, kuid mitte arvule | Vastus kinnitas 13–18-aastased ja mitu kattuvat probleemi, kuid ei andnud oodatud 3–5 arvu. Allikanupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-30T09:44:00+03:00 |
| J14 | PARTIAL | FAIL | pärast J13 taastus Saue kontekst osaliselt, kuid 14 kohtuasja ja 3 kokkulepet jäid puudu | Vastus andis üle 5800 lapse ja umbes 90% kohtusse pöördumise väite, kuid mitte 14/3 täpsust. Allikanupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-30T09:44:00+03:00 |
| J18 | FAIL | FAIL | pärast J14 andis süsteem küll uuringu koguarvu, kuid mitte rühmade kaupa jaotust | Vastus andis kokku 42 osalejat, kuid ei esitanud kolme rühma 5+5+5 ja kokku 15. Allikanupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-30T09:45:00+03:00 |
| J20 | PASS | PASS | pärast J18 valis süsteem õige seadusemuudatuste ajajoone ega kandnud uuringu 42 üle | Vastus nimetas 2023. aasta kevade, 2023. aasta suve ja 2025. aasta jaanuari ning kirjeldas jaanuari täpsustust. Allikanupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-30T09:45:00+03:00 |
| J22 | FAIL | FAIL | pärast J20 jäi e-kursuse järelhindamise vastus üldiseks keeldumiseks | Kuue kuu järelhindamist ning osaleja ja tööandja vaate võrdlust ei esitatud. | none visible | none visible | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-30T09:46:00+03:00 |
| V01 | PASS | PASS | pärast J22 valis süsteem MAPPA-allika ega kandnud e-kursuse keeldumist üle | Vastus andis sageduseks vähemalt kord nelja kuu jooksul ning Rakvere 5, Jõhvi 7 ja Narva 5; allikanupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-30T09:46:00+03:00 |
| V03 | PASS | PASS | pärast V01 eraldas süsteem maakonnapõhise supervisiooniarvu | Vastus andis 2017. aastal igas maakonnas viis KOV-i sotsiaaltöötajate rühmasupervisiooni kohtumist; allikanupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-30T09:47:00+03:00 |
| V04 | FAIL | FAIL | pärast V03 valis süsteem endiselt vale eakate vägivallauuringu arvurühma | Vastus andis 22%, 41% ja 13%, mitte 10%=640, 6%=227 ja 2%=100; allikanupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-30T09:47:00+03:00 |
| V05 | FAIL | FAIL | pärast V04 jäi e-kursuse järelmõju vastus üldiseks keeldumiseks | Kuue kuu järelmõju ning osaleja ja tööandja hinnangud puudusid. | none visible | none visible | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-30T09:48:00+03:00 |
| V06 | FAIL | FAIL | pärast V05 jäi laste eraldamise arv/aasta üldise keeldumise taha | Vastus ei esitanud 169 otsust ega aastat 2018. | none visible | none visible | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-30T09:48:00+03:00 |
| A01 | PASS | PASS | pärast V06 leidis süsteem õige Krister Tüllineni autoriankru ega kandnud V06 keeldumist üle | Vastus andis aktiivse registri täieliku 1-töö inventari ja teemasektsiooni; allikanupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-30T09:48:00+03:00 |
| A02 | PASS | PASS | pärast A01 säilitas süsteem käändelise Maarja Krais-Leoski nime õige registrivaste | Vastus andis täieliku 5-töö autorinventari koos teemasektsioonidega; allikanupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-30T09:49:00+03:00 |
| A03 | PASS | PASS | pärast A02 leidis süsteem Kadi Lubi nime ja eraldas autoriinventari | Vastus andis täieliku 4-töö inventari koos teemasektsioonidega; allikanupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-30T09:49:00+03:00 |
| A04 | PASS | PASS | pärast A03 leidis süsteem Ave Ungro õige autoriankru ega kandnud Kadi konteksti üle | Vastus andis täieliku 1-töö inventari ja analüüsi teemasektsiooni; allikanupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-30T09:50:00+03:00 |
| A05 | PASS | PASS | pärast A04 leidis süsteem Jane Langemetsa õige autorikorpuse | Vastus andis täieliku 2-töö inventari koos teemasektsiooniga; allikanupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-30T09:50:00+03:00 |
| A06 | PASS | PASS | pärast A05 leidis süsteem Liina Lokko õige autorikorpuse | Vastus andis täieliku 2-töö inventari koos teemasektsioonidega; allikanupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-30T09:51:00+03:00 |
| A07 | PASS | PASS | pärast A06 leidis süsteem Kadri Kuulpaki suure autorikorpuse ega kandnud varasemat konteksti üle | Vastus andis täieliku 18-töö inventari koos teemasektsioonidega; allikanupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-30T09:51:00+03:00 |
| A08 | PASS | PASS | pärast A07 leidis süsteem Merle Tombergi õige autorikorpuse | Vastus andis täieliku 2-töö inventari koos teemasektsioonidega; allikanupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-30T09:52:00+03:00 |
| A10 | PASS | PASS | pärast A08 leidis süsteem Judit Strömpli täieliku 13-töö autorikorpuse | Vastus andis täieliku 13-töö inventari koos teemasektsioonidega; allikanupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-30T09:52:00+03:00 |
| S08 | PASS | PASS | pärast A10 eraldas süsteem Saaremaa COVID-allikad ja säilitas mõlema perioodi erinevuse | Vastus kirjeldas Saaremaa COVID-kogemust, teenuste ümberkorraldust, Kriisikodu, kogukonna/töötajate tuge ja kriisivalmiduse õppetunde; allikanupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-30T09:52:00+03:00 |
| M01 | FAIL | FAIL | pärast S08 ei leidnud süsteem EPIKoja uuringu kindlat allikat | Vastus jäi üldiseks keeldumiseks; uuringu meetodit, aega ega oodatud 42 osalejat ei esitatud. | none visible | none visible | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-30T09:55:00+03:00 |
| M02 | FAIL | FAIL | pärast M01 küsis süsteem EPIKoja dokumendi kohta täpsustust ja asendas Tallinna soovitused üldise arengukava suunaga | Vastus ei loetlenud Tallinnale suunatud soovitusi; allikanupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-30T09:55:00+03:00 |
| M07 | PASS | PASS | pärast M02 leidis süsteem Tarkvanema töölehe õige üldise kasutusjuhendi ega kandnud EPIKoja teemat üle | Vastus kirjeldas töölehe eesmärki, sobiva hetke ja vanuse valikut, avatud küsimusi, hinnanguteta kuulamist, jätkuküsimusi ja lapse mitte sundimist; allikanupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-30T09:56:00+03:00 |
| K01 | PASS | PASS | pärast M07 leidis süsteem Kuusalu kohaliku teenusekorra ja § 6 ning ei kandnud töölehe teemat üle | Vastus kirjeldas SPOKU või paberavaldusega taotlemist, abivajaduse hindamist, § 6 eesmärki ja koduteenuse toiminguid; allikanupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-30T09:57:00+03:00 |
| K02 | PASS | PASS | pärast K01 eraldas süsteem Narva linna koduteenuse korra ja ei kandnud Kuusalu § 6 konteksti üle | Vastus kirjeldas kirjalikku taotlust Narva sotsiaalabiametile, abivajaduse hindamist/kodukülastust, kümne tööpäeva otsust ja teenuse sisu; allikanupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-30T09:57:00+03:00 |
| K05 | PASS | PASS | pärast K02 tuvastas süsteem Tartu linna ja Tartu valla ebamäärasuse ning küsis enne allikavalikut täpsustuse | Vastus küsis: „Kas mõtled Tartu linn või Tartu vald?”. | none — clarification before RAG | none | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, runtime `c21821c2` | 2026-08-30T09:57:00+03:00 |

**Faas 2 vahetulemus (runtime `c21821c2`): 34/34 lõpetatud — 19 PASS, 2 PARTIAL, 13 FAIL.**
PASS: J04, J07, J20, V01, V03, A01, A02, A03, A04, A05, A06, A07, A08, A10, S08, M07, K01, K02, K05; PARTIAL: J13, J14; FAIL: J03, J05, J08, J09, J11, J12, J18, J22, V04, V05, V06, M01, M02.

**Paus enne 75-küsimuse väravat.** 75 küsimust ja 37 Golden-küsimust jäävad praegu `NOT_PROVEN` ning ootavad eraldi luba.

### K05 järelkontroll — väljaspool 34 juhtumi nimetajat

Pärast K05 täpsustusküsimust kontrollis omanik lühivastuste lahendamist samas
vestluses. See ei muuda faasi 2 koondtulemust, kuid paljastab täpsustuse järel eraldi
vea: ühe sõnaga vastuseid ei seostatud juba pakutud KOV-valikutega.

| follow_up | tulemus | tähelepanek | timestamp |
|---|---|---|---|
| `linn` | FAIL | Assistent kordas „Kas mõtled Tartu linn või Tartu vald?”; „Tartu linn” järeldust ei tehtud. | 2026-08-30T09:58:00+03:00 |
| `linn` (kordus) | FAIL | Sama täpsustusküsimus kordus muutumatult. | 2026-08-30T09:58:00+03:00 |
| `vald` | FAIL | Assistent kordas sama täpsustusküsimust; „Tartu vald” järeldust ei tehtud. | 2026-08-30T09:58:00+03:00 |
| `Tartu vald` | PASS | Vastus andis Tartu valla sotsiaaltranspordi sihtrühma, kasutusjuhud, taotlemise viisi ja ametliku teenuseviite. | 2026-08-30T09:58:00+03:00 |

Järelkontrolli runtime-seis: täisnimeline täpsustus töötab, kuid `linn`/`vald`
lühivastused ebaõnnestusid runtime'il `c21821c2`. GitHubi `main` commit `c827e679`
säilitab nüüd assistendi pakutud KOV-kandidaadid ja seob lühivastuse ainsa vastava
täisnimega; deploy ja paranduse runtime-kordus on veel **NOT_PROVEN**.

## Faas 1 — varasemad FAIL/PARTIAL juhtumid, `isolated`

Iga juhtum värskes vestluses. Pärast iga vastust lisa rida tabelisse ja vajadusel
eraldi trace-faili viide.

| case_id | status | answer_summary | retrieved_source_ids | displayed_source_ids | trace_file | runtime | timestamp |
|---|---|---|---|---|---|---|---|
| J03 | FAIL | Vastus: „Ma ei saa sellele praegu piisavalt kindlat vastust anda.”; ükski oodatud väide, number ega 2018 allikas ei jõudnud vastusesse. | none visible | none visible | NOT_PROVEN — in-app vaade ei eksponeerinud trace'i | production Codex IAB `/vestlus` | 2026-08-29T15:03:47+03:00 |
| J04 | PASS | Vastuses olid Viljandi, Põltsamaa ja Türi ning kõik neli ülesannet: universaalne ennetus, ühe ukse põhimõte, teadus-/tõenduspõhised sekkumised ja valdkonnaülene koostöö; vastuste allikate juhtnupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus` | 2026-08-29T15:04:50+03:00 |
| J05 | FAIL | Vastus: „Ma ei saa sellele praegu piisavalt kindlat vastust anda.”; arvude 30/12/60/19 seoseid ei esitatud. | none visible | none visible | NOT_PROVEN — in-app vaade ei eksponeerinud trace'i | production Codex IAB `/vestlus` | 2026-08-29T15:05:26+03:00 |
| J07 | FAIL | Vastus: „Ma ei saa küsitud arvu, ulatust ja aastat täpse vastuse jaoks piisavalt kindlalt kinnitada.”; 678/273/21600 ning maakondade/omavalitsuste arvud puudusid. | none visible | none visible | NOT_PROVEN — in-app vaade ei eksponeerinud trace'i | production Codex IAB `/vestlus` | 2026-08-29T15:05:54+03:00 |
| J08 | FAIL | Vastuses olid 59%, 41%, 62% ja 38%, mitte oodatud 61%, 26%, 11%, 18%; vastuste allikate juhtnupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus` | 2026-08-29T15:06:20+03:00 |
| J09 | FAIL | Vastus küsis täpsustust 4% kohta ja ütles, et katkendites 4% näitajat pole; oodatud 33%, 13%, 19%, 7% puudusid. | NOT_PROVEN — vastuste allika ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus` | 2026-08-29T15:06:42+03:00 |
| J11 | FAIL | Vastus: „Ma ei saa sellele praegu piisavalt kindlat vastust anda.”; 7 intervjuud, 6 individuaalset, kolmeliikmeline rühm ja kolmeetapiline analüüs puudusid. | none visible | none visible | NOT_PROVEN — in-app vaade ei eksponeerinud trace'i | production Codex IAB `/vestlus` | 2026-08-29T15:07:03+03:00 |
| J12 | FAIL | Vastus ütles, et materjal ei kinnita kohtumiste arvu; oodatud viis kohtumist maakonna kohta puudus. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus` | 2026-08-29T15:07:27+03:00 |
| J13 | PARTIAL | Vastus kinnitas 13–18-aastaste vanuserühma ja kirjeldas probleeme, kuid ütles, et täpset arvu ei kinnitata; oodatud 3–5 puudus. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus` | 2026-08-29T15:07:55+03:00 |
| J14 | PASS | Vastus andis üle 5800 alla 18-aastase lapse, umbes 90% kohtusse pöördumise, 14 kohtuasja ja 3 kohtuvälist kokkulepet; vastuste allikate juhtnupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus` | 2026-08-29T15:08:23+03:00 |
| J18 | FAIL | Vastus keeldus kolme rühma arve kinnitamast ja andis ainult 42 inimese tagasiside; oodatud 5+5+5 ja kokku 15 puudusid. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus` | 2026-08-29T15:08:49+03:00 |
| J20 | PASS | Vastus ajastas õigesti 2023. aasta kevade, 2023. aasta suve ja 2025. aasta jaanuari muudatused; vastuste allikate juhtnupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus` | 2026-08-29T15:09:12+03:00 |
| J22 | PASS | Vastus ütles kuus kuud pärast koolitust ning võrdles osaleja ja tööandja vaadet; vastuste allikate juhtnupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus` | 2026-08-29T15:09:33+03:00 |
| V01 | PASS | Vastus andis sageduseks vähemalt kord nelja kuu jooksul ning arvud Rakvere 5, Jõhvi 7 ja Narva 5; vastuste allikate juhtnupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus` | 2026-08-29T15:09:57+03:00 |
| V03 | PASS | Vastus andis 2017. aastal viis rühmasupervisiooni kohtumist maakonna kohta; lisaselgitus kvartalikohtumiste kohta ei muutnud põhivastust. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus` | 2026-08-29T15:10:19+03:00 |
| V04 | FAIL | Vastus andis 22%, 41% ja 13%, mitte oodatud 10%=640, 6%=227 ja 2%=100; vastuste allikate juhtnupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus` | 2026-08-29T15:10:39+03:00 |
| V05 | PASS | Vastus kinnitas kuue kuu järelmõju ning osaleja ja tööandja hinnanguid; vastuste allikate juhtnupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus` | 2026-08-29T15:10:59+03:00 |
| V06 | FAIL | Vastus ütles, et arvu ja aastat ei saa kinnitada; oodatud 169 otsust ja 2018 puudusid. | none visible | none visible | NOT_PROVEN — in-app vaade ei eksponeerinud trace'i | production Codex IAB `/vestlus` | 2026-08-29T15:11:23+03:00 |
| A01 | FAIL | Vastus küsis täpsustust („Mida sa sõna „Sotsiaaltöö” all mõtled?”) ega loetlenud Krister Tüllineni enda artikleid ega teemasid. | none visible | none visible | NOT_PROVEN — in-app vaade ei eksponeerinud trace'i | production Codex IAB `/vestlus` | 2026-08-29T15:13:31+03:00 |
| A02 | FAIL | Vastus: „Ma ei saa sellele praegu piisavalt kindlat vastust anda.”; Maarja Krais-Leoski enda artikleid ega teemasid ei esitatud. | none visible | none visible | NOT_PROVEN — in-app vaade ei eksponeerinud trace'i | production Codex IAB `/vestlus` | 2026-08-29T15:13:49+03:00 |
| A03 | PASS | Vastus loetles Kadi Lubi neli enda autorlusega artiklit ja teemad: teadustöö eetika, tervisealane kirjaoskus/tervise võrdsus, tervishoiu ja sotsiaaltöö koostöö ning liikumispuudega naiste emadushooldus; vastuste allikate juhtnupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus` | 2026-08-29T15:14:08+03:00 |
| A04 | PARTIAL | Vastus leidis Ave Ungro ja Rain Leoma kaasartikli COVID-19 mõjust sotsiaaltöö tööjõule/oskustele ning kirjeldas teemasid, kuid teisi Ave Ungro enda autorlusega artikleid ei kinnitanud; vastuste allikate juhtnupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus` | 2026-08-29T15:14:27+03:00 |
| A05 | FAIL | Vastus küsis täpsustust („Mida sa sõna „Sotsiaaltöö” all mõtled?”) ega loetlenud Jane Langemetsa artikleid ega teemasid. | none visible | none visible | NOT_PROVEN — in-app vaade ei eksponeerinud trace'i | production Codex IAB `/vestlus` | 2026-08-29T15:14:51+03:00 |
| A06 | PARTIAL | Vastus kinnitas ühe Liina Lokko autorlusega artikli „Rehabilitatsiooniteenus teenuseosutaja pilguga” ja loetles selle teemad, kuid täielikku enda artiklite loendit ei kinnitanud; vastuste allikate juhtnupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus` | 2026-08-29T15:15:21+03:00 |
| A07 | FAIL | Vastus küsis täpsustust („Mida sa sõna „Sotsiaaltöö” all mõtled?”) ega loetlenud Kadri Kuulpaki artikleid ega teemasid. | none visible | none visible | NOT_PROVEN — in-app vaade ei eksponeerinud trace'i | production Codex IAB `/vestlus` | 2026-08-29T15:15:43+03:00 |
| A08 | FAIL | Vastus küsis täpsustust („Mida sa sõna „Sotsiaaltöö” all mõtled?”) ega loetlenud Merle Tombergi artikleid ega teemasid. | none visible | none visible | NOT_PROVEN — in-app vaade ei eksponeerinud trace'i | production Codex IAB `/vestlus` | 2026-08-29T15:16:03+03:00 |
| A10 | FAIL | Vastus küsis täpsustust („Mida sa sõna „Sotsiaaltöö” all mõtled?”) ega loetlenud Judit Strömpli enda artikleid ega teemasid. | none visible | none visible | NOT_PROVEN — in-app vaade ei eksponeerinud trace'i | production Codex IAB `/vestlus` | 2026-08-29T15:16:31+03:00 |
| S08 | PASS | Vastus kirjeldas Saaremaa COVID-kogemust, kiiret ümberkorraldust, kriisijuhtimist, teenuste toimepidevust, Kriisikodu, töötajate turvalisust, kogukonna rolli ja kriisivalmiduse õppetunde; allikapaneelis olid kaks asjakohast artiklit (2021 uuring ja 2020 kogemuslugu). | NOT_PROVEN — ID-d UI-s nähtamatud | source panel: Riina Koit 2021; Anneli Tõru 2020 (IDs NOT_PROVEN) | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus` | 2026-08-29T15:17:46+03:00 |
| M01 | FAIL | Vastus: „Ma ei saa sellele praegu piisavalt kindlat vastust anda.”; uuringu meetodit, aega ega oodatud 42 osalejat ei esitatud. | none visible | none visible | NOT_PROVEN — in-app vaade ei eksponeerinud trace'i | production Codex IAB `/vestlus` | 2026-08-29T15:18:45+03:00 |
| M02 | FAIL | Vastus ütles, et Tallinna konkreetsed soovitused ei ole kinnitatud, ja asendas need EPIKoja üldise arengukava suunaga; Tallinnale suunatud ettepanekuid ei esitatud. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus` | 2026-08-29T15:19:17+03:00 |
| M07 | PASS | Vastus kirjeldas Tarkvanema vestlustöölehe eesmärki, rahuliku hetke valikut, avatud küsimusi, kuulamist, jätkuküsimusi ja hinnangutest hoidumist ning eristas sobivaid vanuserühmi; vastuste allikate juhtnupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus` | 2026-08-29T15:20:27+03:00 |
| K01 | PASS | Vastus kirjeldas Kuusalu koduteenuse taotlemist SPOKU või paberavaldusega, abivajaduse hindamist ja § 6 sisu: eesmärk, täisealise inimese toimetulek ning teenuse toimingud; vastuste allikate juhtnupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus` | 2026-08-29T15:21:12+03:00 |
| K02 | PASS | Vastus kirjeldas Narva kirjaliku taotluse esitamist sotsiaalabiametile, abivajaduse hindamist/kodukülastust, kümne tööpäeva otsust ja teenuse sisu; vastuste allikate juhtnupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus` | 2026-08-29T15:22:15+03:00 |
| K05 | FAIL | Vastus ütles, et Tartu sotsiaaltranspordi tingimusi, taotlemist, sõidupiirkonda ja omaosalust ei saa kinnitada; oodatud kasutustingimusi ega taotlemise korda ei esitatud. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus` | 2026-08-29T15:22:55+03:00 |

## Faas 2 — samad juhtumid, `sequential`

Alusta alles siis, kui faas 1 on täielikult logitud. Pärast viimast juhtumit tee
paus; kogu 75 küsimuse faasi ei alustata enne uut luba.

| case_id | status | isolated_status | history_effect | answer_summary | retrieved_source_ids | displayed_source_ids | trace_file | runtime | timestamp |
|---|---|---|---|---|---|---|---|---|---|
| J03 | FAIL | FAIL | esimene järjestikune küsimus, varasemat konteksti ei olnud | Vastus: „Ma ei saa sellele praegu piisavalt kindlat vastust anda.”; kriisitunnuseid ega 2018 telefoninumbreid ei esitatud. | none visible | none visible | NOT_PROVEN — in-app vaade ei eksponeerinud trace'i | production Codex IAB `/vestlus`, üks ühine vestlus | 2026-08-29T15:23:39+03:00 |
| J04 | PASS | PASS | vastus tuli pärast J03, kuid kasutas õiget Perepesa-allikat ega kandnud J03 teemat üle | Vastuses olid Viljandi (linn/vall), Põltsamaa ja Türi ning neli alustala: universaalne ennetus, ühe ukse põhimõte, tõenduspõhised sekkumised ja valdkonnaülene koostöö; vastuste allikate juhtnupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, üks ühine vestlus | 2026-08-29T15:23:57+03:00 |
| J05 | FAIL | FAIL | pärast J04 tuli üldine keeldumine; varasem Perepesa kontekst ei mõjutanud vastust | Vastus: „Ma ei saa sellele praegu piisavalt kindlat vastust anda.”; arvude 30/12/60/19 seoseid ei esitatud. | none visible | none visible | NOT_PROVEN — in-app vaade ei eksponeerinud trace'i | production Codex IAB `/vestlus`, üks ühine vestlus | 2026-08-29T15:24:12+03:00 |
| J07 | FAIL | FAIL | pärast J05 tuli numbriküsimusele üldine keeldumine | Vastus: „Ma ei saa küsitud arvu, ulatust ja aastat täpse vastuse jaoks piisavalt kindlalt kinnitada.”; 678/273/21600 ning maakondade ja omavalitsuste arvud puudusid. | none visible | none visible | NOT_PROVEN — in-app vaade ei eksponeerinud trace'i | production Codex IAB `/vestlus`, üks ühine vestlus | 2026-08-29T15:24:34+03:00 |
| J08 | FAIL | FAIL | pärast J07 jätkus sama numbriküsimuste rada, kuid vastus jäi valeks | Vastuses olid 59%, 41%, 62% ja 38%, mitte oodatud 61%, 26%, 11%, 18%; vastuste allikate juhtnupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, üks ühine vestlus | 2026-08-29T15:25:00+03:00 |
| J09 | FAIL | FAIL | pärast J08 küsis süsteem „nelja protsendi” tähenduse kohta täpsustust ega kasutanud eelnevat numbrikonteksti | Vastus küsis, kas mõeldakse taustatunnuseid või üldist kiusamise protsenti; oodatud 33%, 13%, 19%, 7% puudusid. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, üks ühine vestlus | 2026-08-29T15:25:19+03:00 |
| J11 | FAIL | FAIL | pärast J09 tuli üldine keeldumine; varasemat numbrikonteksti ei kasutatud | Vastus: „Ma ei saa sellele praegu piisavalt kindlat vastust anda.”; 7 intervjuud, 6 individuaalset, kolmeliikmeline rühm ja kolmeetapiline analüüs puudusid. | none visible | none visible | NOT_PROVEN — in-app vaade ei eksponeerinud trace'i | production Codex IAB `/vestlus`, üks ühine vestlus | 2026-08-29T15:25:38+03:00 |
| J12 | FAIL | FAIL | pärast J11 ei kandnud süsteem numbrikonteksti edasi | Vastus ütles, et kohtumiste arvu ei saa kinnitada; oodatud viis kohtumist maakonna kohta puudus; vastuste allikate juhtnupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, üks ühine vestlus | 2026-08-29T15:26:00+03:00 |
| J13 | PARTIAL | PARTIAL | pärast J12 vastas süsteem vanuserühmale õigesti, kuid jättis arvu lahtiseks | Vastus kinnitas 13–18-aastaseid noori ja kirjeldas probleeme, kuid ütles, et korraga esinenud probleemide arv ei ole kinnitatud; oodatud 3–5 puudus; vastuste allikate juhtnupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, üks ühine vestlus | 2026-08-29T15:26:25+03:00 |
| J14 | FAIL | PASS | pärast J13 kandis sama vestlus ebakindluse järgmisse küsimusse | Vastus: „Ma ei saa küsitud arvu, ulatust ja aastat täpse vastuse jaoks piisavalt kindlalt kinnitada.”; oodatud üle 5800 lapse, umbes 90%, 14 kohtuasja ja 3 kokkulepet puudusid. | none visible | none visible | NOT_PROVEN — in-app vaade ei eksponeerinud trace'i | production Codex IAB `/vestlus`, üks ühine vestlus | 2026-08-29T15:26:48+03:00 |
| J18 | FAIL | FAIL | pärast J14 tuli küll sisuline arvuvastus, kuid vale uuringu- ja rühmanumbrid | Vastus andis 42 kogu tagasisideks ja 32 otseseks sihtrühmaks, kuid mitte oodatud kolme rühma 5+5+5 ja kokku 15; vastuste allikate juhtnupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, üks ühine vestlus | 2026-08-29T15:27:10+03:00 |
| J20 | PASS | PASS | pärast J18 valis süsteem õige seadusemuudatuste ajastuse ega kandnud eelmist uuringunumbrit üle | Vastus ajastas õigesti 2023. aasta kevade, 2023. aasta suve ja 2025. aasta jaanuari muudatused; vastuste allikate juhtnupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, üks ühine vestlus | 2026-08-29T15:27:35+03:00 |
| J22 | PASS | PASS | pärast J20 säilitas süsteem õige e-kursuse järelhindamise konteksti | Vastus ütles kuus kuud pärast koolitust ning võrdles osaleja ja tööandja vaadet; vastuste allikate juhtnupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, üks ühine vestlus | 2026-08-29T15:27:54+03:00 |
| V01 | PASS | PASS | pärast J22 valis süsteem õige MAPPA-allika ja säilitas varasema e-kursuse teema eraldi | Vastus andis sageduseks vähemalt kord nelja kuu jooksul ning arvud Rakvere 5, Jõhvi 7 ja Narva 5; vastuste allikate juhtnupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, üks ühine vestlus | 2026-08-29T15:28:17+03:00 |
| V03 | PASS | PASS | pärast V01 valis süsteem supervisiooni-allika õigesti ja eraldas maakonnapõhise arvu | Vastus andis viis rühmasupervisiooni kohtumist maakonna kohta 2017. aastal; vastuste allikate juhtnupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, üks ühine vestlus | 2026-08-29T15:28:36+03:00 |
| V04 | FAIL | FAIL | pärast V03 valis süsteem endiselt vale eakate vägivallauuringu arvurühma | Vastus andis 22%, 41% ja 13%, mitte oodatud 10%=640, 6%=227 ja 2%=100; vastuste allikate juhtnupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, üks ühine vestlus | 2026-08-29T15:28:55+03:00 |
| V05 | PASS | PASS | pärast V04 ei kandnud süsteem vale arvurühma e-kursuse järelmõju vastusesse | Vastus kinnitas kuue kuu järelhindamise ning osaleja ja tööandja hinnangud; vastuste allikate juhtnupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, üks ühine vestlus | 2026-08-29T15:29:16+03:00 |
| V06 | FAIL | FAIL | pärast V05 tuli laste eraldamise küsimusele üldine keeldumine | Vastus ütles, et arvu ja aastat ei saa kinnitada; oodatud 169 otsust ja 2018 puudusid. | none visible | none visible | NOT_PROVEN — in-app vaade ei eksponeerinud trace'i | production Codex IAB `/vestlus`, üks ühine vestlus | 2026-08-29T15:29:39+03:00 |
| A01 | PARTIAL | FAIL | pärast V06 andis süsteem ühe Krister Tüllineni oma artikli, kuid ei kinnitanud täielikku autorikorpust | Vastus leidis „Deinstitutsionaliseerimine ja normaalsusprintsiip karistuse täideviimise praktikas” (2016) ja teemad, kuid märkis teiste artiklite kohta kinnituse puudumist; vastuste allikate juhtnupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, üks ühine vestlus | 2026-08-29T15:30:00+03:00 |
| A02 | FAIL | FAIL | pärast A01 ei leidnud süsteem Maarja Krais-Leoski autorikorpust | Vastus: „Ma ei saa sellele praegu piisavalt kindlat vastust anda.”; autori enda artikleid ega teemasid ei esitatud. | none visible | none visible | NOT_PROVEN — in-app vaade ei eksponeerinud trace'i | production Codex IAB `/vestlus`, üks ühine vestlus | 2026-08-29T15:30:18+03:00 |
| A03 | PASS | PASS | pärast A02 leidis süsteem Kadi Lubi autorikorpuse ega kandnud Maarja vastust üle | Vastus loetles neli Kadi Lubi autori- või kaasautorlusega artiklit ning nende teemad; vastuste allikate juhtnupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, üks ühine vestlus | 2026-08-29T15:30:40+03:00 |
| A04 | FAIL | PARTIAL | pärast A03 küsis süsteem Ave Ungro kohta täpsustust ega andnud autoriteksti | Vastus: „Mida sa sõna „Sotsiaaltöö” all mõtled?”; Ave Ungro artikleid ega teemasid ei esitatud. | none visible | none visible | NOT_PROVEN — in-app vaade ei eksponeerinud trace'i | production Codex IAB `/vestlus`, üks ühine vestlus | 2026-08-29T15:31:03+03:00 |
| A05 | PASS | PARTIAL | pärast A04 suutis süsteem Jane Langemetsa autorikorpuse eraldi leida | Vastus loetles kaks Jane Langemetsa artiklit ning erihoolekande, rehabilitatsiooni, puuetega inimeste teenuste ja teenusearenduse teemad; vastuste allikate juhtnupp oli nähtav. | NOT_PROVEN — ID-d UI-s nähtamatud | source panel available, IDs NOT_PROVEN | NOT_PROVEN — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, üks ühine vestlus | 2026-08-29T15:31:23+03:00 |
| A06 | FAIL | PARTIAL | pärast A05 läks süsteem Liina Lokko nimega täpsustusküsimusse | Vastus: „Mida sa sõna „Sotsiaaltöö” all mõtled?”; Liina Lokko artikleid ega teemasid ei esitatud. | none visible | none visible | NOT_PROVEN — in-app vaade ei eksponeerinud trace'i | production Codex IAB `/vestlus`, üks ühine vestlus | 2026-08-29T15:31:43+03:00 |

| A07 | FAIL | FAIL | pärast A06 küsis süsteem Kadri Kuulpaki kohta uuesti valdkonna täpsustust | Vastus: „Mida sa sõna „Sotsiaaltöö” all mõtled?”; Kadri Kuulpaki artikleid ega teemasid ei esitatud. | none visible | none visible | NOT_PROVEN — in-app vaade ei eksponeerinud trace'i | production Codex IAB `/vestlus`, üks ühine vestlus | 2026-08-29T15:32:09+03:00 |

## Vahekokkuvõte

- Faas 1 lõpetatud: `34/34` (`12 PASS`, `3 PARTIAL`, `19 FAIL`)
- Faas 2 lõpetatud: `25/34`; puudu `A08`, `A10`, `S08`, `M01`, `M02`, `M07`, `K01`, `K02`, `K05`
- Paus pärast faasi 2: `REQUIRED — kehtib; enne uut jooksu lõpetatakse parandused`
- 75 küsimuse värav: `NOT_STARTED`
- Golden 37 värav: `NOT_STARTED`

Käesoleva faili tulemused kuuluvad ainult runtime'ile `bc6dbacea4eef24e79e238c4dbdc66f28ca8f4ec`.
Pärast seda tehtud üldine EstNLTK leksikaalne recall, autoriregistri inventar ja K05
mitme-KOV-i täpsustus vajavad uuel muutumatul release'il uut Luna kordust; vana tulemusi ei
kanta uuele SHA-le PASS-ina üle.

## Paranduste kordus — runtime `0e63f11b`

- release: local = origin/main = server checkout `0e63f11ba18a6ad06056c07b6f93be309bca2ebf`
- deploy: `2026-08-30`, frontend/RAG/research-worker `active`, `/vestlus` HTTP 200
- RAG health: `ok=true`, vectors `49727`, documents `6089`
- lemma FTS: `ready=true`, analyzer version `estnltk-vabamorf-1.7.5-v2`
- siht: runtime `c21821c2` viimase isolated/sequential korduse FAIL/PARTIAL ühend
- juhtumid: `J03`, `J05`, `J08`, `J09`, `J11`, `J12`, `J13`, `J14`, `J18`, `J22`, `V04`, `V05`, `V06`, `M01`, `M02`, `K01`
- sõnastus ja ootus: parandatud 75-küsimuse manifest; vanu ekslikke ootusi ei kanta edasi
- algus: `2026-08-30T11:45:56+03:00`

### Faas 1 — isolated

Iga küsimus saadetakse eraldi värskes vestluses. Vastus hinnatakse parandatud manifesti
ootuse vastu ja rida kirjutatakse kohe pärast vastust.

| case_id | status | answer_summary | displayed_sources | runtime | timestamp |
|---|---|---|---|---|---|
| J03 | FAIL | Valis vale Külli Mäe artikli („Kuidas anda vaimse tervise probleemide korral töökohal esmaabi?”) ning ütles, et kriisitunnuste loetelu ja telefoninumbrid puuduvad; nõutud tunnuseid, 112 ja 1220 ei esitanud. | allikanupp nähtav; ID-d UI-s `NOT_PROVEN` | production Codex IAB `/vestlus`, `0e63f11b` | 2026-08-30T11:47:00+03:00 |
| J05 | FAIL | Üldine arvulise kindluse keeldumine; ligi 30 spetsialisti / 12 riiki ja nelja kohtumise 60 inimest / 19 riiki jäid esitamata. | allikanuppu ei olnud | production Codex IAB `/vestlus`, `0e63f11b` | 2026-08-30T11:48:00+03:00 |
| J08 | FAIL | Leidis Vaike Vainu artikli, kuid väitis, et protsendid puuduvad; 61%, 26%, 11% ja 18% jäid kõik kinnitamata. | allikanupp nähtav; ID-d UI-s `NOT_PROVEN` | production Codex IAB `/vestlus`, `0e63f11b` | 2026-08-30T11:49:00+03:00 |
| J09 | PASS | Esitas õiged seosed: koolikiusamine vähemalt korra 33% ja korduvalt 13%; küberkiusamine vähemalt korra 19% ja korduvalt 7%. | allikanupp nähtav; ID-d UI-s `NOT_PROVEN` | production Codex IAB `/vestlus`, `0e63f11b` | 2026-08-30T11:49:00+03:00 |
| J11 | FAIL | Üldine arvulise kindluse keeldumine; 7 intervjuud, 6 individuaalset, üks kolme osalejaga rühmavestlus ja kolmeetapiline temaatiline analüüs puudusid. | allikanuppu ei olnud | production Codex IAB `/vestlus`, `0e63f11b` | 2026-08-30T11:49:00+03:00 |
| J12 | PASS | Kinnitas õigesti, et 2017. aasta lepingu järgi pidi igas maakonnas toimuma viis rühmasupervisiooni kohtumist. | allikanupp nähtav; ID-d UI-s `NOT_PROVEN` | production Codex IAB `/vestlus`, `0e63f11b` | 2026-08-30T11:50:00+03:00 |
| J13 | PARTIAL | Kirjeldas mitme probleemi kattuvust ja varase abi vajadust, kuid ei kinnitanud nõutud 13–18-aastaste rühma ega seda, et probleemid võivad avalduda juba 3–5-aastaselt. | allikanupp nähtav; ID-d UI-s `NOT_PROVEN` | production Codex IAB `/vestlus`, `0e63f11b` | 2026-08-30T11:50:00+03:00 |
| J14 | FAIL | Üldine arvulise kindluse keeldumine; üle 5800 lapse, umbes 90%, 14 kohtujuhtumit ja 3 kohtuvälist kokkulepet jäid kõik esitamata. | allikanuppu ei olnud | production Codex IAB `/vestlus`, `0e63f11b` | 2026-08-30T11:52:00+03:00 |
| J18 | FAIL | Leidis õige artikli nime, kuid ütles, et kõik rühmaarvud on kinnitamata; 5 kohtunikku + 5 erihoolekandetöötajat + 5 KOV-i sotsiaaltöötajat = 15 puudusid. | allikanupp nähtav; ID-d UI-s `NOT_PROVEN` | production Codex IAB `/vestlus`, `0e63f11b` | 2026-08-30T11:53:00+03:00 |
| J22 | PASS | Kinnitas järelhindamise kuus kuud pärast koolitust ning võrdles osaleja ja tema tööandja vaadet. | allikanupp nähtav; ID-d UI-s `NOT_PROVEN` | production Codex IAB `/vestlus`, `0e63f11b` | 2026-08-30T11:54:00+03:00 |
| V04 | FAIL | Üldine arvulise kindluse keeldumine; õiged paarid 10%=640, 6%=227 ja 2%=100 jäid esitamata. | allikanuppu ei olnud | production Codex IAB `/vestlus`, `0e63f11b` | 2026-08-30T11:54:00+03:00 |
| V05 | FAIL | Nimetas nii järelmõju ajavahemiku kui võrreldud hinnangute pooled kinnitamata; kuus kuud ning osaleja/tööandja puudusid, kuigi sama dokumendi J22 oli PASS. | allikanuppu ei olnud | production Codex IAB `/vestlus`, `0e63f11b` | 2026-08-30T11:55:00+03:00 |
| V06 | FAIL | Üldine arvulise kindluse keeldumine; 169 otsust ja otsuste 2018. aasta puudusid. | allikanuppu ei olnud | production Codex IAB `/vestlus`, `0e63f11b` | 2026-08-30T11:56:00+03:00 |
| M01 | PASS | Kirjeldas poolstruktureeritud individuaal- ja grupiintervjuusid ning temaatilist sisuanalüüsi, ajavahemikku november 2025–märts 2026 ja 42 osalejat. | allikanupp nähtav; ID-d UI-s `NOT_PROVEN` | production Codex IAB `/vestlus`, `0e63f11b` | 2026-08-30T11:56:00+03:00 |
| M02 | PARTIAL | Andis õigesti ühe kontaktisiku/juhtumikorraldaja, proaktiivse ennetava abi ning lihtsama teenustele pääsu ilma dubleerivate hindamisteta; toetatud otsustamise soovituse jättis kinnitamata. | allikanupp nähtav; ID-d UI-s `NOT_PROVEN` | production Codex IAB `/vestlus`, `0e63f11b` | 2026-08-30T11:58:00+03:00 |
| K01 | PASS | Kirjeldas SPOKU- ja paberavalduse rada, abivajaduse hindamist ning § 6 eesmärki, toiminguid ja personaalset hoolduskava. | allikanupp nähtav; ID-d UI-s `NOT_PROVEN` | production Codex IAB `/vestlus`, `0e63f11b` | 2026-08-30T11:59:00+03:00 |

**Faas 1 vahetulemus (runtime `0e63f11b`): 16/16 — 5 PASS, 2 PARTIAL, 9 FAIL.**

- PASS: `J09`, `J12`, `J22`, `M01`, `K01`
- PARTIAL: `J13`, `M02`
- FAIL: `J03`, `J05`, `J08`, `J11`, `J14`, `J18`, `V04`, `V05`, `V06`

### Faas 2 — sequential

Sama 16 küsimuse parandatud sõnastused saadetakse samas järjekorras ühes värskes
vestluses. `history_effect` võrdleb tulemust isolated-faasiga.

| case_id | status | isolated_status | history_effect | answer_summary | displayed_sources | runtime | timestamp |
|---|---|---|---|---|---|---|---|
| J03 | FAIL | FAIL | esimene sequential-küsimus, ajalugu puudus | Valis taas teise/ebapiisava Külli Mäe katkendi ning jättis kriisitunnused, 112 ja 1220 esitamata. | allikanupp nähtav; ID-d UI-s `NOT_PROVEN` | production Codex IAB `/vestlus`, `0e63f11b`, üks vestlus | 2026-08-30T12:00:00+03:00 |
| J05 | FAIL | FAIL | J03 kriisikontekst ei aidanud taastava õiguse dokumendivalikut | Üldine arvulise kindluse keeldumine; 30/12 ja 60/19 suhted puudusid. | praeguse vastuse allikanuppu ei olnud | production Codex IAB `/vestlus`, `0e63f11b`, üks vestlus | 2026-08-30T12:01:00+03:00 |
| J08 | FAIL | FAIL | varasemad eri dokumentide arvuküsimused ei aidanud; vastus muutus isolated-i dokumendipõhisest keeldumisest üldiseks | 61%, 26%, 11% ja 18% puudusid täielikult. | praeguse vastuse allikanuppu ei olnud | production Codex IAB `/vestlus`, `0e63f11b`, üks vestlus | 2026-08-30T12:01:00+03:00 |
| J09 | PASS | PASS | õige dokumendi ja nelja suhte seos säilis ka pärast kolme varasemat eri teemat | Koolikiusamine 33%/13% ja küberkiusamine 19%/7% olid õigesti seotud. | praeguse vastuse allikanupp nähtav; ID-d UI-s `NOT_PROVEN` | production Codex IAB `/vestlus`, `0e63f11b`, üks vestlus | 2026-08-30T12:01:00+03:00 |
| J11 | FAIL | FAIL | varasem edukas nelja protsendi vastus ei aidanud järgmise dokumendi mitmeslotilist faktilepingut | Leidis õige 2016 artikli, kuid jättis 7, 6, ühe kolmeliikmelise rühma ja kolmeetapilise temaatilise analüüsi kõik kinnitamata. | praeguse vastuse allikanupp nähtav; ID-d UI-s `NOT_PROVEN` | production Codex IAB `/vestlus`, `0e63f11b`, üks vestlus | 2026-08-30T12:02:00+03:00 |
| J12 | PASS | PASS | J11 supervisioonilaadne tööalase toe teema ei rikkunud täpset lepingulise mahu vastust | Kinnitas viis rühmasupervisiooni kohtumist igas maakonnas 2017. aastal. | praeguse vastuse allikanupp nähtav; ID-d UI-s `NOT_PROVEN` | production Codex IAB `/vestlus`, `0e63f11b`, üks vestlus | 2026-08-30T12:02:00+03:00 |
| J13 | PARTIAL | PARTIAL | ajalugu ei muutnud tulemust | Kirjeldas kattuvaid probleeme ja varast sekkumist, kuid täpne 13–18 ning probleemide võimalik avaldumine 3–5-aastaselt jäid puudu. | praeguse vastuse allikanupp nähtav; ID-d UI-s `NOT_PROVEN` | production Codex IAB `/vestlus`, `0e63f11b`, üks vestlus | 2026-08-30T12:03:00+03:00 |
| J14 | FAIL | FAIL | eelnev laste käitumisprobleemide teema ei aidanud järgmise nimega artikli faktivalikut | Üldine arvulise kindluse keeldumine; 5800+, 90%, 14 ja 3 puudusid. | praeguse vastuse allikanuppu ei olnud | production Codex IAB `/vestlus`, `0e63f11b`, üks vestlus | 2026-08-30T12:03:00+03:00 |
| J18 | FAIL | FAIL | ajalugu ei muutnud tulemust | Leidis õige Erle Eenmaa artikli, kuid väitis, et rühmade suurused ja koguarv puuduvad; 5+5+5=15 jäi esitamata. | praeguse vastuse allikanupp nähtav; ID-d UI-s `NOT_PROVEN` | production Codex IAB `/vestlus`, `0e63f11b`, üks vestlus | 2026-08-30T12:04:00+03:00 |
| J22 | PASS | PASS | ajalugu ei muutnud tulemust | Järelhindamine kuus kuud pärast koolitust; võrreldi osaleja ja tööandja vaadet. | praeguse vastuse allikanupp nähtav; ID-d UI-s `NOT_PROVEN` | production Codex IAB `/vestlus`, `0e63f11b`, üks vestlus | 2026-08-30T12:04:00+03:00 |
| V04 | FAIL | FAIL | J22 ajafakti edukas vastus ei aidanud järgmise dokumendi kuut seost | Üldine arvulise kindluse keeldumine; 10%=640, 6%=227 ja 2%=100 puudusid. | praeguse vastuse allikanuppu ei olnud | production Codex IAB `/vestlus`, `0e63f11b`, üks vestlus | 2026-08-30T12:05:00+03:00 |
| V05 | FAIL | FAIL | sama dokumendi J22 oli kaks pööret varem PASS, kuid otsene ajalugu ei kandunud sõnastusvarianti | Väitis, et järelmõju aeg ja hinnangute andjad pole esitatud; kuus kuud ning osaleja/tööandja puudusid. | praeguse vastuse allikanuppu ei olnud | production Codex IAB `/vestlus`, `0e63f11b`, üks vestlus | 2026-08-30T12:05:00+03:00 |
| V06 | FAIL | FAIL | ajalugu ei muutnud tulemust | Üldine arvulise kindluse keeldumine; 169 otsust ja 2018 puudusid. | praeguse vastuse allikanuppu ei olnud | production Codex IAB `/vestlus`, `0e63f11b`, üks vestlus | 2026-08-30T12:06:00+03:00 |
| M01 | PASS | PASS | pikk varasem ajakirjaajalugu ei rikkunud nimega aruande leidmist | Andis poolstruktureeritud intervjuud ja temaatilise sisuanalüüsi, november 2025–märts 2026 ning 42 osalejat. | praeguse vastuse allikanupp nähtav; ID-d UI-s `NOT_PROVEN` | production Codex IAB `/vestlus`, `0e63f11b`, üks vestlus | 2026-08-30T12:06:00+03:00 |
| M02 | PARTIAL | PARTIAL | vahetult eelnenud sama aruande M01 hoidis õige dokumendi, kuid ei taastanud neljandat soovitust | Kontaktisik, proaktiivne abi ja lihtsam teenustele pääs ilma kordushindamisteta olid õiged; toetatud otsustamine jäi täpse soovitusena kinnitamata. | praeguse vastuse allikanupp nähtav; ID-d UI-s `NOT_PROVEN` | production Codex IAB `/vestlus`, `0e63f11b`, üks vestlus | 2026-08-30T12:07:00+03:00 |
| K01 | PASS | PASS | pikk eri dokumentide ajalugu ei rikkunud KOV-i § 6 rada | SPOKU/paberavaldus, abivajaduse hindamine ning § 6 eesmärk, toimingud ja personaalne hoolduskava olid olemas. | praeguse vastuse allikanupp nähtav; ID-d UI-s `NOT_PROVEN` | production Codex IAB `/vestlus`, `0e63f11b`, üks vestlus | 2026-08-30T12:08:00+03:00 |

**Faas 2 vahetulemus (runtime `0e63f11b`): 16/16 — 5 PASS, 2 PARTIAL, 9 FAIL.**

- PASS: `J09`, `J12`, `J22`, `M01`, `K01`
- PARTIAL: `J13`, `M02`
- FAIL: `J03`, `J05`, `J08`, `J11`, `J14`, `J18`, `V04`, `V05`, `V06`

### Isolated / sequential võrdlus

- Hinde muutus: `0/16`; kõik juhtumid jäid samasse PASS/PARTIAL/FAIL klassi.
- Kvalitatiivne ajalooefekt oli olemas, kuid tulemust ei parandanud. Näiteks J08 muutus
  isolated-i õige artikli, kuid puuduva tõendi vastusest sequential-is üldiseks keeldumiseks.
- Kõige selgem taaskasutuse rike oli V05: sama vestluse J22 vastas sama Marina Vaino
  dokumendi kohta õigesti „kuus kuud, osaleja ja tööandja”, kuid kaks pööret hiljem V05
  väitis, et sama aeg ja osapooled ei ole esitatud.
- See targeted-jooks ei tõenda kõigi 75 küsimuse kvaliteeti; ainult need 16 juhtumit on
  runtime'il `0e63f11b` mõõdetud.

**PAUS.** 75-küsimuse täisvärav ja 37 Golden-küsimust on `NOT_STARTED` ning neid ei
käivitata enne omaniku järgmist juhist.

## `0e63f11b` FAIL/PARTIAL põhjuseanalüüs ja teine parandusring — 30.08

### Tõendipiir

Uue release'i korduses olid nähtavad vastus ja allikanupu olemasolu, kuid trace'i ID-d,
valitud lõikude ID-d ja avatud allikapaneeli dokumendi-ID-d ei olnud UI-s eksponeeritud.
Seetõttu on õige dokumendi nimega vastused tugev vastusetaseme tõend, kuid täpne esimene
lahknev kiht on uuel runtime'il osaliselt `NOT_PROVEN`. Diagnoos ühendab selle jooksu tulemuse,
varasemad samade juhtumite trace'id ja `0e63f11b` koodimuudatuse staatilise analüüsi.

### Üldised juurpõhjused

1. **Dokument leiti, aga kõik vajalikud tõendilõigud ei jõudnud vastusekonteksti.** J08, J11,
   J18 ja M02 nimetasid õige dokumendi või andsid osa selle fakte, kuid väitsid ülejäänud
   faktide kohta, et need puuduvad. Senine prioriseerija nõudis kõigi arvuliste slot'ide
   leidmist ühest lõigust; eri lõikudesse jagunenud faktide korral sai iga lõik sisuliselt
   nullprioriteedi. Kvalitatiivsetel slot'idel, nagu meetod, vanuserühm, järelhindamise aeg ja
   soovitus, puudus samaväärne lõiguvalik üldse.
2. **Küsimuse faktileping ei kandnud käändevorme tõendite sidumisse.** EstNLTK analüüs oli
   juba enne retrieval'it ning lemma- ja tüvekujud läksid päris lexical/BM25 otsingusse;
   eraldi `lemma_fts_shadow` ei olnud ainus lemmakasutus. Puuduv lüli oli retrieval'i järel:
   pinnakujul faktisuhe pidi lõigu tekstiga kattuma ilma morfoloogiliste alternatiivideta.
   Seega võis otsing õige dokumendi leida, kuid slot'i ja tõendi sidumine ebaõnnestus.
3. **Arvu liik tuletati liiga kitsalt.** „Mitu” oli `count`, kuid „kui palju osalejaid/lapsi”
   jäi üldiseks `amount`-iks. Koordineeritud jätk „ja kui palju kokku” võis kaotada eelmise
   slot'i tüübi. See lõhkus eelkõige J05 ja J18 isikute/riikide/rühmade arvusid.
4. **Dokumendiidentiteet kasutas ringtõendit.** Küsitud arvumustri täielikkus andis
   dokumendikandidaadile lisapunkte, kuigi arvud on vastuse faktid, mitte allika identiteet.
   Vale dokument võis seetõttu saada eelise lihtsalt sobiva kujuga arvude tõttu.
5. **Täpne pealkiri ja faktifingerprint võistlesid omavahel.** Ka täpselt nimetatud artikli
   puhul lisandus lai faktisuhete päring, mis võis tuua müraseid dokumente. Täpse pealkirja
   korral peab identiteet tulema pealkirjast/autorist/aastast ning faktipäring peab töötama
   alles valitud dokumendi sees.
6. **J03 ootus sisaldas vale pealkirja.** Kordus nimetas „Kuidas anda vaimse tervise
   probleemide korral töökohal esmaabi?”, mida logi hindas vale artiklina, sest manifestis oli
   tehislik pealkiri „Vaimse tervise esmaabi tööle”. Artikli tegelik pealkiri oli vastuses
   nimetatud kuju; sisuline vastus jäi siiski FAIL-iks, sest kriisitunnused ning 112/1220 ei
   jõudnud vastusesse.
7. **Vestlusajalugu ei olnud selle release'i põhipõhjus.** Isolated ja sequential andsid
   mõlemad 5 PASS / 2 PARTIAL / 9 FAIL ning hinde muutus oli 0/16. V05 näitab pigem
   sõnastusvariandi ja tõendilõigu taastamise riket: sama dokumendi J22 oli kaks vooru varem
   PASS, kuid V05 ei leidnud samu tõendeid uuesti.

### Juhtumite seos parandusega

| Juhtum | Esimene nähtav lahknevus | Rakendatud üldparandus |
|---|---|---|
| J03 | tegelik artikkel nimetati, kuid kvalitatiivsed tunnused ja käändeline „millistele telefoninumbritele” ei saanud täielikku tõendikatet; manifesti pealkiri oli vale | parandatud pealkiri; kõik `millis-` käändevormid on kvalitatiivne küsimusecue; täpne pealkiri välistab laia fingerprint'i; sama dokumendi mitme lõigu slotikate |
| J05 | neli arvuseost kahes sündmuseplokis jäid fail-closed | „kui palju” + loendatav nimisõna on `count`; koordineeritud kogus säilitab tüübi; eri lõikude tõendid tuuakse kokku |
| J08 | õige Vaike Vainu artikkel leiti, kuid neli protsendisuhet ei jõudnud valideeritavasse konteksti | morfoloogilised suhtealternatiivid ja mitut lõiku kattev slotiprioriseerimine; arvukuju eemaldati identiteediskoorist |
| J11 | sequential leidis õige 2016 artikli, kuid 7/6/3 ja analüüsimeetod jäid kõik kinnitamata | arvulised ja kvalitatiivne meetodislot valitakse sama dokumendi eri lõikudest üheks kontekstiks |
| J13 | kattuvus leiti, kuid 13–18 ja 3–5 ajalised/vanuselised suhted jäid puudu | kvalitatiivsete, ajaliste ja arvuliste slot'ide ühine lõiguvalik, mitte ainult ühe lõigu arvutäielikkus |
| J14 | sama faktikomplekt oli varasema lühema sõnastusega töötanud, kuid täpse nimega pikem küsimus jäi täielikult fail-closed | täpse pealkirja identiteet eraldati faktifingerprint'ist ja neli faktisuhet kaetakse valitud dokumendi eri lõikudega |
| J18 | õige artikkel leiti, kuid kolm rühmaarvu ja kogusumma jäid puudu | osalejate/rühmade „kui palju” normaliseerub `count`-iks; jagatud päis ja „kokku” säilitavad tüübi; 5+5+5 ja summa võivad tulla eri lõikudest |
| V04 | kuue protsendi/arvu seose täielikkus blokeeris vastuse | kõrge kindlusega current-turn autorit kasutatakse faktipäringu ankruna; väärtused ei tõenda dokumendi identiteeti; kuus seost võivad tulla mitmest lõigust |
| V05 | sama Marina Vaino dokumendi J22 oli PASS, V05 sõnastusvariant FAIL | kvalitatiivsed aeg/roll/osapool slot'id saavad morfoloogilised alternatiivid ja dokumendisisese mitme lõigu prioriteedi; ajalugu ei ole ainus taasterada |
| V06 | 169 otsust ja 2018 ei saanud koos tõendikatet | olemasolev allika-aasta/fakti-aasta eristus säilib, kuid arvu- ja ajaslot tuuakse sama valitud dokumendi eri lõikudest kokku |
| M02 | õigest aruandest tuli 3/4 soovitust | nelja kvalitatiivse soovitussloti lõigud valitakse katvuse, mitte algse retrieval-järjekorra järgi |

### Kohaliku paranduse ulatus

Parandus ei sisalda ühegi oodatud vastuse numbrit, nime ega lauset. Nime pinnakuju säilib;
EstNLTK lemma- ja tüvevariandid lisatakse ainult faktisuhete alternatiivideks. Dokumendi valik
toetub pealkirjale, autorile, aastale ja teemale; küsitud faktide kuju ei anna enam
identiteedipunkte. Pärast kõrge kindlusega dokumendivalikut valitakse selle dokumendi lõigud
ahnelt nii, et need kataksid võimalikult palju veel katmata faktislotte, säilitades ülejäänud
lõikude algse järjekorra.

Kohalik sihitud ESLint ja `git diff --check` läbisid. Automaatseid teste, build'i, commit'i,
integratsiooni, push'i ega deploy'd ei tehtud. Seetõttu on paranduse runtime-tulemus kuni
deploy ja samade 11 juhtumi isolated/sequential korduseni `NOT_PROVEN`.

## Teise põhjuseparanduse kordus — runtime `1086090a`

- deploy: `2026-08-30`, local/origin/server SHA `1086090a7b48a6c30d4e9361fb3406af97d6482a`
- frontend, RAG ja research-worker: `active`
- avalik `/vestlus`: HTTP 200
- RAG health: `ok=true`, vectors `49727`, documents `6089`
- lexical FTS ja lemma-FTS: `ready=true`
- siht: eelmise `0e63f11b` korduse 9 FAIL + 2 PARTIAL juhtumit

### Faas 1 — isolated

Iga küsimus saadetakse eraldi värskes vestluses. Rida kirjutatakse kohe pärast vastust;
trace'i ja allika ID jääb `NOT_PROVEN`, kui in-app vaade seda ei eksponeeri.

| case_id | status | answer_summary | displayed_sources | trace | runtime | timestamp |
|---|---|---|---|---|---|---|
| J03 | FAIL | Valis õige Külli Mäe 2018 artikli, kuid ütles, et katkendis pole konkreetseid kriisitunnuseid ega telefoninumbreid; kriisitunnused, 112 ja 1220 jäid esitamata. | allikapaneel: Külli Mäe 2018 õige artikkel; lisaks Anna Toots 2020 „Kriisikaart...” ja Külli Mäe 2017 „Kliendist kodanikuks...”; ID-d UI-s `NOT_PROVEN` | `NOT_PROVEN` — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, `1086090a` | 2026-08-30T13:09:00+03:00 |
| J05 | FAIL | Fail-closed vastus: „Ma ei saa küsitud arvu, ulatust ja aastat täpse vastuse jaoks piisavalt kindlalt kinnitada.”; oodatud ligi 30 spetsialisti / 12 riiki ning 60 inimest / 19 riiki puudusid. | allikanuppu ei olnud | `NOT_PROVEN` — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, `1086090a` | 2026-08-30T13:14:00+03:00 |
| J08 | FAIL | Nimetas küsimuse artikli, kuid jättis kõik protsendid kinnitamata; 61%, 26%, 11% ja 18% puudusid. | allikapaneel näitas vale allikana Meeli Tuubel 2023 „Sotsiaalvaldkonna tööjõud, pädevus ja väärtustamine” | `NOT_PROVEN` — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, `1086090a` | 2026-08-30T13:14:00+03:00 |
| J11 | PARTIAL | 7 intervjuud, 6 individuaalintervjuud ja üks kolme osalejaga grupiintervjuu olid õiged; kolmeetapilise temaatilise analüüsi etapid jäid esitamata. | allikapaneel: õige Elin Kütt 2016 artikkel | `NOT_PROVEN` — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, `1086090a` | 2026-08-30T13:15:00+03:00 |
| J13 | PARTIAL | Vanuserühm 13–18 ja mitme probleemi samaaegne kattuvus olid õiged; vastus väitis, et avaldumise vanust pole katkendites täpsustatud, mistõttu oodatud 3–5 aasta piir puudus. | allikapaneel: õige Laur Raudsoo 2018 artikkel | `NOT_PROVEN` — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, `1086090a` | 2026-08-30T13:16:00+03:00 |
| J14 | FAIL | Fail-closed arvulise kindluse vastus; üle 5800 lapse, umbes 90%, 14 kohtujuhtumit ja 3 kohtuvälist kokkulepet jäid kõik esitamata. | allikanuppu ei olnud | `NOT_PROVEN` — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, `1086090a` | 2026-08-30T13:18:00+03:00 |
| J18 | FAIL | Õige artikkel nimetati, kuid kõigi kolme praktikurühma arvud ning koguarv jäid „kinnitamata”; oodatud 5 kohtunikku + 5 erihoolekande töötajat + 5 KOV sotsiaaltöötajat = 15 puudusid. | allikapaneel: õige Erle Eenmaa 2022 artikkel | `NOT_PROVEN` — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, `1086090a` | 2026-08-30T13:18:00+03:00 |
| V04 | FAIL | Fail-closed arvulise kindluse vastus; kõik kolm osakaalu-inimeste paari 10%=640, 6%=227 ja 2%=100 jäid esitamata. | allikanuppu ei olnud | `NOT_PROVEN` — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, `1086090a` | 2026-08-30T13:20:00+03:00 |
| V05 | FAIL | Nii järelmõju ajavahemik kui ka võrreldud hinnangute andjad jäid „kinnitamata”; oodatud 6 kuud ning osaleja ja tööandja hinnangud puudusid. | allikanuppu ei olnud | `NOT_PROVEN` — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, `1086090a` | 2026-08-30T13:20:00+03:00 |
| V06 | FAIL | Fail-closed arvulise kindluse vastus; analüüsitud 169 laste eraldamise otsust ja nende 2018. aasta päritolu jäid mõlemad esitamata. | allikanuppu ei olnud | `NOT_PROVEN` — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, `1086090a` | 2026-08-30T13:21:00+03:00 |
| M02 | PARTIAL | Üks kontaktisik/juhtumikorraldaja, proaktiivne ennetav abi ning teenustele pääsu lihtsustamine koos korduvhindamiste ja sama info küsimise vältimisega olid õiged; toetatud otsustamist eestkoste/asendatud otsustamise alternatiivina ei kinnitatud. | allikapaneel: Kristi Rekand 2026 EPIKoja uuringu kokkuvõte | `NOT_PROVEN` — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, `1086090a` | 2026-08-30T13:21:00+03:00 |

Isolated koond: **0 PASS / 3 PARTIAL / 8 FAIL**. Õige dokument oli nähtav neljal
ebaõnnestunud juhtumil (J03, J11, J13, J18), J08 valis vale dokumendi ning kuuel juhul ei
tekkinud vastuse juurde allikanuppu. Seega ei sulgenud runtime `1086090a` ühtegi sihtrühma
juhtumit täielikult.

### Faas 2 — sequential

Kõik 11 küsimust saadetakse samas järjekorras ühte värskesse vestlusesse. Iga tulemus
võrreldakse isolated-tulemusega ja kirjutatakse kohe pärast vastust.

| case_id | status | isolated_status | history_effect | answer_summary | displayed_sources | trace | runtime | timestamp |
|---|---|---|---|---|---|---|---|---|
| J03 | FAIL | FAIL | esimene sequential-küsimus, varasem ajalugu puudus; tulemus sisuliselt sama | Õige Külli Mäe 2018 artikkel oli allikates, kuid kriisitunnuste loetelu, 112 ja 1220 jäid jälle esitamata. | sama õige artikkel ning Anna Toots 2020 ja Külli Mäe 2017 lisallikad | `NOT_PROVEN` — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, `1086090a`, üks vestlus | 2026-08-30T13:25:00+03:00 |
| J05 | FAIL | FAIL | J03 kriisikontekst ei mõjutanud tulemust; sama fail-closed vastus | 30/12 ja 60/19 seosed puudusid täielikult. | allikanuppu ei olnud | `NOT_PROVEN` — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, `1086090a`, üks vestlus | 2026-08-30T13:26:00+03:00 |
| J08 | FAIL | FAIL | eelnenud kaks küsimust tulemust ei muutnud; isolated-iga sama vale dokumendivalik | Kõik neli oodatud protsenti 61%, 26%, 11% ja 18% jäid kinnitamata. | vale Meeli Tuubel 2023 artikkel, nagu isolated-faasis | `NOT_PROVEN` — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, `1086090a`, üks vestlus | 2026-08-30T13:27:00+03:00 |
| J11 | PARTIAL | PARTIAL | eelnenud kontekst ei mõjutanud; isolated-iga sama osaline faktikate | 7, 6 individuaalset ja üks kolme osalejaga grupiintervjuu olid õiged; kolmeetapiline temaatiline analüüs jäi esitamata. | õige Elin Kütt 2016 artikkel | `NOT_PROVEN` — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, `1086090a`, üks vestlus | 2026-08-30T13:28:00+03:00 |
| J13 | PARTIAL | PARTIAL | eelnenud kontekst ei muutnud staatust; sõnastus oli üldisem, kuid sama fakt puudus | 13–18 ja mitme probleemi kattuvus olid õiged; „võimalikult varakult” ei kinnita oodatud 3–5 aasta avaldumist. | õige Laur Raudsoo 2018 artikkel | `NOT_PROVEN` — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, `1086090a`, üks vestlus | 2026-08-30T13:29:00+03:00 |
| J14 | FAIL | FAIL | eelnenud artikliküsimused ei aidanud; isolated-iga sama fail-closed arvuvastus | Üle 5800, umbes 90%, 14 ja 3 puudusid kõik. | allikanuppu ei olnud | `NOT_PROVEN` — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, `1086090a`, üks vestlus | 2026-08-30T13:31:00+03:00 |
| J18 | FAIL | FAIL | staatus sama, kuid ajalooga halvenes allikavalik: isolated leidis Erle Eenmaa, sequential näitas vale Merle Variku artiklit | Kolme rühma 5+5+5 ja koguarv 15 jäid kinnitamata. | vale Merle Varik 2022 „Dementsusega inimeste omastehooldajate võimestamine...” | `NOT_PROVEN` — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, `1086090a`, üks vestlus | 2026-08-30T13:31:00+03:00 |
| V04 | FAIL | FAIL | eelnenud kontekst ei muutnud fail-closed tulemust | 10%=640, 6%=227 ja 2%=100 puudusid kõik. | allikanuppu ei olnud | `NOT_PROVEN` — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, `1086090a`, üks vestlus | 2026-08-30T13:32:00+03:00 |
| V05 | FAIL | FAIL | eelnenud kontekst ei taastanud sama dokumendi puuduvaid ajavahemiku ja osapoolte fakte | 6 kuud ning osaleja ja tööandja hinnangute võrdlus jäid kinnitamata. | allikanuppu ei olnud | `NOT_PROVEN` — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, `1086090a`, üks vestlus | 2026-08-30T13:33:00+03:00 |
| V06 | FAIL | FAIL | eelnenud kontekst ei muutnud tulemust; sama fail-closed arvuvastus | 169 otsust ja 2018. aasta jäid mõlemad puudu. | allikanuppu ei olnud | `NOT_PROVEN` — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, `1086090a`, üks vestlus | 2026-08-30T13:33:00+03:00 |
| M02 | PARTIAL | PARTIAL | eelnenud kontekst ei muutnud tulemust; sama 3/4 soovituse kate | Kontaktisik, ennetav abi ning teenuste/korduvhindamiste soovitus olid õiged; toetatud otsustamine eestkoste alternatiivina jäi kinnitamata. | õige Kristi Rekand 2026 EPIKoja uuringu kokkuvõte | `NOT_PROVEN` — trace'i UI-s ei eksponeeritud | production Codex IAB `/vestlus`, `1086090a`, üks vestlus | 2026-08-30T13:34:00+03:00 |

Sequential koond: **0 PASS / 3 PARTIAL / 8 FAIL** — staatuste jaotus on isolated-faasi
jaotusega identne. Kümnel juhul üheteistkümnest ei muutnud vestlusajalugu staatust ega
põhiviga. J18 jäi samuti FAIL-iks, kuid allikavalik halvenes: isolated näitas õiget Erle Eenmaa
artiklit, sequential vale Merle Variku artiklit. See on ainus mõõdetud history-effect.

### Paus pärast teist punkti

Kokkuleppe järgi on pärast isolated- ja sequential-faasi paus. Täielikku 75 küsimuse väravat
ega 37 Golden-lisaväravat ei käivitatud. Runtime `1086090a` tulemus nende 11 regressiooni puhul
on **0 PASS / 3 PARTIAL / 8 FAIL** mõlemas režiimis; paranduse eesmärk ei ole saavutatud.

## Kolmanda parandusringi kordus — runtime `7c91fc9d`

- deploy: `2026-08-30`, local/origin/server SHA `7c91fc9d9c60c88cb6c545d299c41eed7ae89432`
- frontend, RAG ja research-worker: `active`
- avalik ja loopback `/vestlus`: HTTP 200
- RAG health: `ok=true`, vectors `49727`, documents `6089`
- lexical FTS ja lemma-FTS: `ready=true`
- EstNLTK `/analyze-query`: `available=true`, analyzer `estnltk-vabamorf-1.7.5-v2`
- siht: runtime `1086090a` korduse 8 FAIL + 3 PARTIAL juhtumit
- jooksud: esmalt isolated (iga küsimus uues vestluses), seejärel sequential (kõik 11 ühes uues vestluses)
- tulemus kirjutatakse siia kohe pärast iga vastust

### Külmutatud 11 juhtumit

| case_id | eelmine staatus | oodatud põhiväited |
|---|---|---|
| J03 | FAIL | kriisitunnused; 112; 1220; 2018 ajalooline allikas |
| J05 | FAIL | ligi 30 spetsialisti 12 riigist; neljal kohtumisel 60 inimest 19 riigist |
| J08 | FAIL | 61% lisabi; 26% palju lisabi; 11% suur risk; 18% keskmine risk |
| J11 | PARTIAL | 7 intervjuud; 6 individuaalset; üks kolme osalejaga rühm; kolmeetapiline temaatiline analüüs |
| J13 | PARTIAL | 13–18-aastased; kattuvad probleemid; võimalik avaldumine juba 3–5-aastaselt |
| J14 | FAIL | üle 5800 lapse; umbes 90%; 14 kohtujuhtumit; 3 kohtuvälist kokkulepet |
| J18 | FAIL | 5 kohtunikku; 5 erihoolekande töötajat; 5 KOV-i sotsiaaltöötajat; kokku 15 |
| V04 | FAIL | 10%=640; 6%=227; 2%=100 õigete rühmade juures |
| V05 | FAIL | kuue kuu pärast; osaleja ja tööandja hinnangud |
| V06 | FAIL | 169 otsust; otsused 2018. aastast |
| M02 | PARTIAL | üks kontaktisik/juhtumikorraldaja; proaktiivne abi; lihtsam pääs ja kordushindamiste vältimine; toetatud otsustamine alternatiivina |

### Faas 1 — isolated

Iga küsimus saadetakse eraldi värskes vestluses. Rida kirjutatakse kohe pärast vastust.

| case_id | status | answer_summary | displayed_sources | runtime | timestamp |
|---|---|---|---|---|---|
| J03 | PASS | Tõi välja kriisi tunnused ning mõlemad õiged numbrid 112 ja 1220. | `Vastuste allikad` nähtav; paneeli sisu ei avatud. | `7c91fc9d` | 2026-08-30 17:55 EEST |
| J05 | PASS | Tõi õigesti ligi 30 spetsialisti 12 riigist ning neljal kohtumisel 60 inimest 19 riigist. | `Vastuste allikad` nähtav; paneeli sisu ei avatud. | `7c91fc9d` | 2026-08-30 17:55 EEST |
| J08 | FAIL | Keeldus kõiki osi kinnitamast; oodatud 61%, 26%, 11% ja 18% puudusid täielikult. | Allikanuppu ei kuvatud. | `7c91fc9d` | 2026-08-30 17:56 EEST |
| J11 | FAIL | Üldine tõendipuuduse vastus; puudusid 7 intervjuud, jaotus 6 individuaalset + üks kolme osalejaga rühm ning kolmeetapiline temaatiline analüüs. | Allikanuppu ei kuvatud. | `7c91fc9d` | 2026-08-30 17:56 EEST |
| J13 | FAIL | Üldine tõendipuuduse vastus; puudusid vanuserühm 13–18, probleemide kattuvus ja 3–5-aastaselt avaldumise võimalus. | Allikanuppu ei kuvatud. | `7c91fc9d` | 2026-08-30 17:57 EEST |
| J14 | FAIL | Üldine tõendipuuduse vastus; puudusid üle 5800 lapse, umbes 90%, 14 kohtujuhtumit ja 3 kohtuvälist kokkulepet. | Allikanuppu ei kuvatud. | `7c91fc9d` | 2026-08-30 17:57 EEST |
| J18 | FAIL | Üldine tõendipuuduse vastus; puudusid 5 kohtunikku, 5 erihoolekande töötajat, 5 KOV-i sotsiaaltöötajat ja kokku 15 praktikut. | Allikanuppu ei kuvatud. | `7c91fc9d` | 2026-08-30 17:57 EEST |
| V04 | PASS | Sidus õigesti 10%=640, 6%=227 ja 2%=100 vastavate vanuse- ja ohvrirühmadega; täpsustas, et allikas räägib ohvriabisse pöördunutest, mitte ainult helistajatest. | `Vastuste allikad` nähtav; paneeli sisu ei avatud. | `7c91fc9d` | 2026-08-30 17:58 EEST |
| V05 | FAIL | Üldine tõendipuuduse vastus; puudusid kuue kuu järelmõju ning osaleja ja tööandja hinnangute võrdlus. | Allikanuppu ei kuvatud. | `7c91fc9d` | 2026-08-30 17:58 EEST |
| V06 | FAIL | Värskes vestluses üldine tõendipuuduse vastus; puudusid 169 otsust ja otsuste aasta 2018. | Allikanuppu ei kuvatud. | `7c91fc9d` | 2026-08-30 17:59 EEST |
| M02 | FAIL | Värskes vestluses üldine tõendipuuduse vastus; ükski neljast soovitusplokist ei jõudnud vastusesse. | Allikanuppu ei kuvatud. | `7c91fc9d` | 2026-08-30 18:02 EEST |

Isolated koond: **3 PASS / 0 PARTIAL / 8 FAIL**.

Operatiivne märkus: V06 järel tehtud esimene M02 sisestus sattus sama vestluse jätkuks, sest `Uus` ei lähtestanud parajasti uut salvestamata klientseanssi. Seda katset ei hinnatud; M02 korrati pärast salvestatud vestluse valimist ja uut lähtestust päriselt värskes vestluses.

### Faas 2 — sequential

Kõik 11 küsimust esitatakse allolevas järjekorras ühes värskes vestluses.

| case_id | status | answer_summary | displayed_sources | runtime | timestamp |
|---|---|---|---|---|---|
| J03 | PASS | Tõi järjestikuse jooksu alguses õiged kriisitunnused ning numbrid 112 ja 1220. | `Vastuste allikad` nähtav; paneeli sisu ei avatud. | `7c91fc9d` | 2026-08-30 18:03 EEST |
| J05 | FAIL | Kohe teise küsimusena andis üldise arvu/ulatuse/aasta tõendipuuduse vastuse; kõik neli oodatud arvu puudusid. Isolated-jooksus oli sama sõnastus PASS. | Allikanuppu ei kuvatud. | `7c91fc9d` | 2026-08-30 18:04 EEST |
| J08 | FAIL | Sama üldine tõendipuuduse vastus nagu isolated-jooksus; 61%, 26%, 11% ja 18% puudusid. | Allikanuppu ei kuvatud. | `7c91fc9d` | 2026-08-30 18:04 EEST |
| J11 | FAIL | Sama üldine tõendipuuduse vastus nagu isolated-jooksus; intervjuude arv, jaotus ja analüüs puudusid. | Allikanuppu ei kuvatud. | `7c91fc9d` | 2026-08-30 18:05 EEST |
| J13 | FAIL | Sama üldine tõendipuuduse vastus nagu isolated-jooksus; vanuserühm, kattuvus ja varane avaldumine puudusid. | Allikanuppu ei kuvatud. | `7c91fc9d` | 2026-08-30 18:05 EEST |
| J14 | FAIL | Sama üldine tõendipuuduse vastus nagu isolated-jooksus; kõik neli arvulist väidet puudusid. | Allikanuppu ei kuvatud. | `7c91fc9d` | 2026-08-30 18:05 EEST |
| J18 | FAIL | Sama üldine tõendipuuduse vastus nagu isolated-jooksus; kolme rühma ja koguarv puudusid. | Allikanuppu ei kuvatud. | `7c91fc9d` | 2026-08-30 18:06 EEST |
| V04 | PASS | Sidus ka seitsmenda küsimusena õigesti 10%=640, 6%=227 ja 2%=100 õigete rühmadega ning täpsustas pöördunute/helistajate erinevust. | `Vastuste allikad` nähtav; paneeli sisu ei avatud. | `7c91fc9d` | 2026-08-30 18:06 EEST |
| V05 | FAIL | Sama üldine tõendipuuduse vastus nagu isolated-jooksus; kuus kuud ja võrreldud osapooled puudusid. | Allikanuppu ei kuvatud. | `7c91fc9d` | 2026-08-30 18:07 EEST |
| V06 | FAIL | Sama üldine tõendipuuduse vastus nagu isolated-jooksus; 169 otsust ja aasta 2018 puudusid. | Allikanuppu ei kuvatud. | `7c91fc9d` | 2026-08-30 18:07 EEST |
| M02 | FAIL | Sama üldine tõendipuuduse vastus nagu isolated-jooksus; ükski neljast soovitusplokist ei jõudnud vastusesse. | Allikanuppu ei kuvatud. | `7c91fc9d` | 2026-08-30 18:07 EEST |

Sequential koond: **2 PASS / 0 PARTIAL / 9 FAIL**.

### Kahe jooksu võrdlus

- Mõlemas režiimis PASS: `J03`, `V04`.
- Ainult isolated-režiimis PASS: `J05`; sequential-režiimis muutus see juba teise küsimusena FAIL-iks.
- Mõlemas režiimis FAIL: `J08`, `J11`, `J13`, `J14`, `J18`, `V05`, `V06`, `M02`.
- PARTIAL tulemusi selles runtime'is ei olnud: vastus kas kattis külmutatud põhiväited või langes üldiseks tõendipuuduse vastuseks.
- Režiimivahe on seega mõõdetud: isolated `3/11 PASS`, sequential `2/11 PASS`; ainus staatusmuutus oli `J05 PASS → FAIL`.
- See tõendab vähemalt `J05` puhul vestlusajaloo mõju. Ülejäänud kaheksa püsivat FAIL-i ei ole seletatavad ainult järjestikuse küsimisega.

### Paus pärast teist faasi

Kokkuleppe järgi siin peatutakse. Täielikku 75 küsimuse jooksu ega 37 Golden-küsimuse lisaväravat ei käivitatud.

## Neljas kordus — runtime `69aa09a3`

- deploy: `2026-08-30`, local/origin/server SHA `69aa09a36a99ad7f30e0545c3c661a0ca34325c7`
- frontend, RAG ja research-worker: `active`
- avalik ja loopback `/vestlus`: HTTP 200
- RAG health: `ok=true`, vectors `49727`, documents `6089`
- siht: eelmise runtime `7c91fc9d` 8 FAIL + 3 PARTIAL juhtumit
- jooksud: esmalt isolated (iga küsimus uues vestluses), seejärel sequential (kõik 11 ühes uues vestluses)
- vastus lisatakse kohe pärast iga küsimust; pärast sequential-faasi tehakse paus

### Faas 1 — isolated (lõpetatud)

| case_id | status | answer_summary | displayed_sources | runtime | timestamp |
|---|---|---|---|---|---|
| J03 | FAIL | Vastus oli „Ma ei saa sellele praegu piisavalt kindlat vastust anda.”; kriisitunnuseid, 112 ega 1220 ei esitatud. | Allikanuppu ei kuvatud. | `69aa09a3` | 2026-08-30T21:06:47+03:00 |
| J05 | FAIL | Vastus oli „Ma ei saa sellele praegu piisavalt kindlat vastust anda.”; 30/12 ja 60/19 taastava õiguse näitajate seoseid ei esitatud. | Allikanuppu ei kuvatud. | `69aa09a3` | 2026-08-30T21:07:00+03:00 |
| J08 | FAIL | Vastus oli „Ma ei saa sellele praegu piisavalt kindlat vastust anda.”; 61%, 26%, 11% ja 18% osakaale ei esitatud. | Allikanuppu ei kuvatud. | `69aa09a3` | 2026-08-30T21:08:20+03:00 |
| J11 | FAIL | Vastus oli „Ma ei saa sellele praegu piisavalt kindlat vastust anda.”; 7 intervjuud, jaotus 6 individuaalset + üks kolmeliikmeline rühm ning kolmeetapiline analüüs puudusid. | Allikanuppu ei kuvatud. | `69aa09a3` | 2026-08-30T21:08:45+03:00 |
| J13 | PARTIAL | Vastus nimetas õige 13–18-aastaste vanuserühma, kuid ütles, et tavapärast probleemide arvu ei kinnitatud; oodatud 3–5 probleemi puudus. | `Vastuste allikad` nähtav; paneeli ei avatud. | `69aa09a3` | 2026-08-30T21:09:17+03:00 |
| J14 | PASS | Vastus andis üle 5800 alla 18-aastase lapse, umbes 90% kohtusse pöördumise, 14 kohtuasja ja 3 kohtuvälist kokkulepet. | `Vastuste allikad` nähtav; paneeli ei avatud. | `69aa09a3` | 2026-08-30T21:09:47+03:00 |
| J18 | FAIL | Vastus oli „Ma ei saa sellele praegu piisavalt kindlat vastust anda.”; kolme praktikurühma 5+5+5 ja koguarvu 15 ei esitatud. | Allikanuppu ei kuvatud. | `69aa09a3` | 2026-08-30T21:10:09+03:00 |
| V04 | FAIL | Vastus andis 22%, 41% ja 13% ning sidus need kehalise väärkohtlemise, kelmuse ja vargusega; oodatud 10%=640, 6%=227 ja 2%=100 seoseid ei esitatud. | `Vastuste allikad` nähtav; paneeli ei avatud. | `69aa09a3` | 2026-08-30T21:10:32+03:00 |
| V05 | FAIL | Vastus oli „Ma ei saa sellele praegu piisavalt kindlat vastust anda.”; kuue kuu järelmõju ning osaleja ja tööandja hinnangud puudusid. | Allikanuppu ei kuvatud. | `69aa09a3` | 2026-08-30T21:10:51+03:00 |
| V06 | FAIL | Vastus oli „Ma ei saa sellele praegu piisavalt kindlat vastust anda.”; 169 otsust ja otsuste aasta 2018 puudusid. | Allikanuppu ei kuvatud. | `69aa09a3` | 2026-08-30T21:11:13+03:00 |
| M02 | PASS | Vastus andis kõik neli suunda: üks kontaktisik/juhtumikorraldaja, proaktiivne ennetav abi, lihtsam teenustele pääs koos korduvhindamiste vältimisega ning toetatud otsustamise suund eestkoste asemel. | `Vastuste allikad` avatud; Kristi Rekand 2026 kokkuvõte, lk 10–11, 13–14, 18, 23, 25–26, 29, 32, 38, 48, 50–51, 53, 56, 62. | `69aa09a3` | 2026-08-30T21:11:57+03:00 |

### Faas 2 — sequential (lõpetatud)

Kõik 11 küsimust esitatakse allolevas järjekorras ühes värskes vestluses.

| case_id | status | answer_summary | displayed_sources | runtime | timestamp |
|---|---|---|---|---|---|
| J03 | FAIL | Vastus oli „Ma ei saa sellele praegu piisavalt kindlat vastust anda.”; kriisitunnuseid, 112 ega 1220 ei esitatud. | Allikanuppu ei kuvatud. | `69aa09a3` | 2026-08-30T21:12:35+03:00 |
| J05 | FAIL | Teise küsimusena oli vastus samuti „Ma ei saa sellele praegu piisavalt kindlat vastust anda.”; 30/12 ja 60/19 seoseid ei esitatud. | Allikanuppu ei kuvatud. | `69aa09a3` | 2026-08-30T21:13:02+03:00 |
| J08 | FAIL | Kolmanda küsimusena oli vastus samuti üldine tõendipuuduse teade; 61%, 26%, 11% ja 18% osakaale ei esitatud. | Allikanuppu ei kuvatud. | `69aa09a3` | 2026-08-30T21:13:27+03:00 |
| J11 | FAIL | Neljanda küsimusena oli vastus samuti üldine tõendipuuduse teade; 7 intervjuud, jaotus 6 individuaalset + üks kolmeliikmeline rühm ning kolmeetapiline analüüs puudusid. | Allikanuppu ei kuvatud. | `69aa09a3` | 2026-08-30T21:13:48+03:00 |
| J13 | PARTIAL | Viienda küsimusena nimetas vastus õige 13–18-aastaste vanuserühma, kuid ütles, et tavapärast probleemide arvu ei kinnitatud; oodatud 3–5 probleemi puudus. | `Vastuste allikad` nähtav; paneeli ei avatud. | `69aa09a3` | 2026-08-30T21:14:16+03:00 |
| J14 | PARTIAL | Kuuenda küsimusena andis vastus üle 5800 lapse ja umbes 90% kohtusse pöördumise, kuid 14 kohtuasja ja 3 kohtuvälist kokkulepet ei esitanud. Isolated-jooksus olid kõik neli väidet olemas. | `Vastuste allikad` nähtav; paneeli ei avatud. | `69aa09a3` | 2026-08-30T21:14:41+03:00 |
| J18 | FAIL | Seitsmenda küsimusena oli vastus üldine tõendipuuduse teade; kolme praktikurühma 5+5+5 ja koguarvu 15 ei esitatud. | Allikanuppu ei kuvatud. | `69aa09a3` | 2026-08-30T21:15:02+03:00 |
| V04 | FAIL | Kaheksanda küsimusena andis vastus 22%, 41% ja 13% ning sidus need kehalise väärkohtlemise, kelmuse ja vargusega; oodatud 10%=640, 6%=227 ja 2%=100 seoseid ei esitatud. | `Vastuste allikad` nähtav; paneeli ei avatud. | `69aa09a3` | 2026-08-30T21:15:23+03:00 |
| V05 | FAIL | Üheksanda küsimusena oli vastus üldine tõendipuuduse teade; kuue kuu järelmõju ning osaleja ja tööandja hinnangud puudusid. | Allikanuppu ei kuvatud. | `69aa09a3` | 2026-08-30T21:15:42+03:00 |
| V06 | FAIL | Kümnenda küsimusena oli vastus üldine tõendipuuduse teade; 169 otsust ja otsuste aasta 2018 puudusid. | Allikanuppu ei kuvatud. | `69aa09a3` | 2026-08-30T21:16:01+03:00 |
| M02 | PASS | Viimase küsimusena andis vastus kõik neli suunda: üks kontaktisik/juhtumikorraldaja, proaktiivne ennetav abi, lihtsam teenustele pääs koos korduvhindamiste vältimisega ning toetatud otsustamise suund eestkoste asemel. | `Vastuste allikad` nähtav; paneeli ei avatud. | `69aa09a3` | 2026-08-30T21:16:32+03:00 |

Sequential koond: **2 PASS / 2 PARTIAL / 7 FAIL**.

### Kahe jooksu võrdlus

- Isolated PASS: `J14`, `M02`; sequential PASS: `M02`.
- Isolated `PARTIAL`: `J13`; sequential `PARTIAL`: `J13`, `J14`.
- Mõlemas režiimis FAIL: `J03`, `J05`, `J08`, `J11`, `J18`, `V04`, `V05`, `V06`.
- Mõõdetud režiimivahe: J14 halvenes isolated `PASS`-ist sequential `PARTIAL`-iks; M02 jäi mõlemas PASS-iks; ülejäänud juhtumitel staatus ei muutunud.

### Paus pärast teist faasi

Kokkuleppe järgi on pärast isolated- ja sequential-faasi paus. Täielikku 75 küsimuse jooksu ega 37 Golden-küsimuse lisaväravat ei käivitatud.

## Runtime `69aa09a3` — manifesti täpse 11 küsimuse parandusjooks

Eelmises sama runtime'i plokis kasutati ekslikult lühendatud küsimusi. See plokk kasutab
`docs/audits/evidence/rag-75-runtime-2026-08-28-44c1e59b/manifest.md` küsimusi sõna-sõnalt.
Järjekord: kõigepealt isolated, seejärel kõik 11 ühes sequential-vestluses; pärast teist faasi paus.

### Faas 1 — isolated (lõpetatud)

| case_id | status | question_exact | answer_summary | displayed_sources | runtime | timestamp |
|---|---|---|---|---|---|---|
| J03 | PASS | Millised on vaimse tervise kriisi tunnused ning millistele telefoninumbritele tuleb nende korral helistada Külli Mäe 2018. aasta artikli „Kuidas anda vaimse tervise probleemide korral töökohal esmaabi?” järgi? | Nimetas kriisi tunnused ning õiged telefoninumbrid 112 ja 1220. | `Vastuste allikad` nähtav; paneeli ei avatud. | `69aa09a3` | 2026-08-30T21:36:00+03:00 |
| J05 | FAIL | Artiklis „Taastav õigus ja COVID-19” mitu spetsialisti ja riiki osales igakuisel kohtumisel ning mitu inimest ja riiki osales 2020. aasta aprillist juulini toimunud neljal kohtumisel? | Üldine arvu, ulatuse ja aasta tõendipuuduse vastus; 30/12 ja 60/19 seosed puudusid. | Allikanuppu ei kuvatud. | `69aa09a3` | 2026-08-30T21:37:00+03:00 |
| J08 | FAIL | Vaike Vainu 2023. aasta artiklis „Suure hoolduskoormusega inimesed vajavad täiendavat abi” kui suur osa vastanutest vajas lisabi, kui suur osa palju lisabi ning kui suur osa oli suure ja keskmise hoolduskoormuse riskiga? | Vastus keeldus kõiki küsitud osi kinnitamast; 61%, 26%, 11% ja 18% puudusid. | Allikanuppu ei kuvatud. | `69aa09a3` | 2026-08-30T21:37:00+03:00 |
| J11 | FAIL | Artiklis „Sotsiaaltöötajate tööalase toetuse kogemused” mitu intervjuud tehti, kuidas jagunesid individuaal- ja rühmavestlused ning millist kolmeetapilist analüüsi kasutati? | Vastus keeldus kõiki osi kinnitamast; 7 intervjuud, 6 individuaalset, üks kolmeliikmeline rühm ja kolmeetapiline analüüs puudusid. | Allikanuppu ei kuvatud. | `69aa09a3` | 2026-08-30T21:38:00+03:00 |
| J13 | PASS | 2018. aasta artiklis „Käitumisprobleemidega lapsed peaksid abi saama enne, kui asjad väga hulluks lähevad” millist noorte vanuserühma käsitleti ning mida öeldi probleemide kattuvuse ja nende varase avaldumise kohta? | Andis 13–18-aastased, probleemide kattuvuse ja võimaliku avaldumise juba 3–5-aastaselt. | `Vastuste allikad` nähtav; paneeli ei avatud. | `69aa09a3` | 2026-08-30T21:38:00+03:00 |
| J14 | PASS | Anne-Ly Sumre 2019. aasta artiklis „Lastekaitsjad jäävad tihti omavahel sõdivate vanemate vahele” kui palju oli Saue vallas alla 18-aastasi lapsi, kui suur osa hooldusõiguse jagamise juhtumitest jõudis kohtusse ning mitu kohtujuhtumit ja kohtuvälist kokkulepet oli ühe spetsialisti näites? | Andis kõik neli väidet: üle 5800, umbes 90%, 14 kohtujuhtumit ja 3 kohtuvälist kokkulepet. | `Vastuste allikad` nähtav; paneeli ei avatud. | `69aa09a3` | 2026-08-30T21:39:00+03:00 |
| J18 | FAIL | Erle Eenmaa 2022. aasta artiklis „Psüühilise erivajadusega inimese osalus oma eestkostes” kui palju osalejaid oli igas kolmes praktikute rühmas ja kui palju kokku? | Vastus keeldus kõiki osi kinnitamast; 5 kohtunikku + 5 erihoolekande töötajat + 5 KOV-i sotsiaaltöötajat = 15 puudusid. | Allikanuppu ei kuvatud. | `69aa09a3` | 2026-08-30T21:39:00+03:00 |
| V04 | PASS | Anu Lepsi ja Lenne Indovi 2025. aasta artiklis kui suur osakaal ja mitu inimest oli üle 60-aastaste registreeritud kuriteoohvrite seas, kui suur osakaal ja mitu inimest oli üle 60-aastaste ohvriabisse helistajate seas ning kui suur osakaal ja mitu inimest oli üle 75-aastaste kuriteo tõttu kannatanute seas? | Sidus õigesti 10%=640, 6%=227 ja 2%=100; täpsustas, et allikas kinnitab ohvriabisse pöördunuid, mitte eraldi telefoni teel pöördunuid. | `Vastuste allikad` nähtav; paneeli ei avatud. | `69aa09a3` | 2026-08-30T21:40:00+03:00 |
| V05 | FAIL | Marina Vaino artiklis „Uus e-kursus pakub tuge sotsiaalvaldkonna koolitajatele” kui pika aja pärast hinnati järelmõju ning kelle hinnanguid võrreldi? | Vastus keeldus kõiki osi kinnitamast; kuus kuud ning osaleja ja tööandja hinnangud puudusid. | Allikanuppu ei kuvatud. | `69aa09a3` | 2026-08-30T21:40:00+03:00 |
| V06 | PASS | Mitu laste eraldamise otsust analüüsiti 2022. aasta artiklis „Lapse perekonnast eraldamine vaimse tervise probleemiga vanemalt” ja mis aastast need otsused pärinesid? | Andis õigesti 169 lahendit ja 2018. aasta. | `Vastuste allikad` nähtav; paneeli ei avatud. | `69aa09a3` | 2026-08-30T21:41:00+03:00 |
| M02 | PASS | EPIKoja aruandes „Täisealiste psüühikahäirega inimeste, sh eestkostetavate uuring” milline soovitus anti Tallinnale kontaktisiku või juhtumikorralduse kohta, milline ennetava abi kohta, milline teenustele pääsu ja korduvate hindamiste kohta ning milline toetatud otsustamise kohta? | Andis kõik neli soovitussuunda: kindel kontaktisik/juhtumikorraldaja, proaktiivne abi, lihtsam teenustele pääs koos korduvhindamiste vältimisega ning toetatud otsustamine eestkoste piirava mõju alternatiivina. | `Vastuste allikad` nähtav; paneeli ei avatud. | `69aa09a3` | 2026-08-30T21:41:00+03:00 |

Isolated koond: **6 PASS / 0 PARTIAL / 5 FAIL**.

### Faas 2 — sequential (lõpetatud)

Kõik 11 manifesti täpset küsimust esitatakse allolevas järjekorras ühes värskes vestluses.

| case_id | status | question_exact | answer_summary | displayed_sources | runtime | timestamp |
|---|---|---|---|---|---|---|
| J03 | PASS | Millised on vaimse tervise kriisi tunnused ning millistele telefoninumbritele tuleb nende korral helistada Külli Mäe 2018. aasta artikli „Kuidas anda vaimse tervise probleemide korral töökohal esmaabi?” järgi? | Andis kriisi tunnused ning 112 ja 1220. | `Vastuste allikad` nähtav; paneeli ei avatud. | `69aa09a3` | 2026-08-30T21:42:00+03:00 |
| J05 | PASS | Artiklis „Taastav õigus ja COVID-19” mitu spetsialisti ja riiki osales igakuisel kohtumisel ning mitu inimest ja riiki osales 2020. aasta aprillist juulini toimunud neljal kohtumisel? | Andis õigesti umbes 30 spetsialisti 12 riigist ning neljal kohtumisel 60 inimest 19 riigist. Isolated-jooksus sama täpne küsimus FAIL. | `Vastuste allikad` nähtav; paneeli ei avatud. | `69aa09a3` | 2026-08-30T21:43:00+03:00 |
| J08 | FAIL | Vaike Vainu 2023. aasta artiklis „Suure hoolduskoormusega inimesed vajavad täiendavat abi” kui suur osa vastanutest vajas lisabi, kui suur osa palju lisabi ning kui suur osa oli suure ja keskmise hoolduskoormuse riskiga? | Vastus keeldus kõiki küsitud osi kinnitamast; 61%, 26%, 11% ja 18% puudusid. | Allikanuppu ei kuvatud. | `69aa09a3` | 2026-08-30T21:43:00+03:00 |
| J11 | FAIL | Artiklis „Sotsiaaltöötajate tööalase toetuse kogemused” mitu intervjuud tehti, kuidas jagunesid individuaal- ja rühmavestlused ning millist kolmeetapilist analüüsi kasutati? | Vastus keeldus kõiki osi kinnitamast; 7 intervjuud, 6 individuaalset, üks kolmeliikmeline rühm ja kolmeetapiline analüüs puudusid. | Allikanuppu ei kuvatud. | `69aa09a3` | 2026-08-30T21:45:00+03:00 |
| J13 | PASS | 2018. aasta artiklis „Käitumisprobleemidega lapsed peaksid abi saama enne, kui asjad väga hulluks lähevad” millist noorte vanuserühma käsitleti ning mida öeldi probleemide kattuvuse ja nende varase avaldumise kohta? | Andis 13–18-aastased, probleemide kattuvuse ning võimaliku avaldumise juba 3–5-aastaselt. | `Vastuste allikad` nähtav; paneeli ei avatud. | `69aa09a3` | 2026-08-30T21:45:00+03:00 |
| J14 | PASS | Anne-Ly Sumre 2019. aasta artiklis „Lastekaitsjad jäävad tihti omavahel sõdivate vanemate vahele” kui palju oli Saue vallas alla 18-aastasi lapsi, kui suur osa hooldusõiguse jagamise juhtumitest jõudis kohtusse ning mitu kohtujuhtumit ja kohtuvälist kokkulepet oli ühe spetsialisti näites? | Andis kõik neli väidet: üle 5800, umbes 90%, 14 kohtujuhtumit ja 3 kohtuvälist kokkulepet. | `Vastuste allikad` nähtav; paneeli ei avatud. | `69aa09a3` | 2026-08-30T21:46:00+03:00 |
| J18 | FAIL | Erle Eenmaa 2022. aasta artiklis „Psüühilise erivajadusega inimese osalus oma eestkostes” kui palju osalejaid oli igas kolmes praktikute rühmas ja kui palju kokku? | Vastus keeldus kõiki osi kinnitamast; 5 kohtunikku + 5 erihoolekande töötajat + 5 KOV-i sotsiaaltöötajat = 15 puudusid. | Allikanuppu ei kuvatud. | `69aa09a3` | 2026-08-30T21:47:00+03:00 |
| V04 | PASS | Anu Lepsi ja Lenne Indovi 2025. aasta artiklis kui suur osakaal ja mitu inimest oli üle 60-aastaste registreeritud kuriteoohvrite seas, kui suur osakaal ja mitu inimest oli üle 60-aastaste ohvriabisse helistajate seas ning kui suur osakaal ja mitu inimest oli üle 75-aastaste kuriteo tõttu kannatanute seas? | Sidus õigesti 10%=640, 6%=227 ja 2%=100; täpsustas, et allikas kinnitab ohvriabisse pöördunuid, mitte eraldi telefoni teel pöördunuid. | `Vastuste allikad` nähtav; paneeli ei avatud. | `69aa09a3` | 2026-08-30T21:50:00+03:00 |
| V05 | FAIL | Marina Vaino artiklis „Uus e-kursus pakub tuge sotsiaalvaldkonna koolitajatele” kui pika aja pärast hinnati järelmõju ning kelle hinnanguid võrreldi? | Vastus keeldus kõiki osi kinnitamast; kuus kuud ning osaleja ja tööandja hinnangud puudusid. | Allikanuppu ei kuvatud. | `69aa09a3` | 2026-08-30T21:50:00+03:00 |
| V06 | PASS | Mitu laste eraldamise otsust analüüsiti 2022. aasta artiklis „Lapse perekonnast eraldamine vaimse tervise probleemiga vanemalt” ja mis aastast need otsused pärinesid? | Andis õigesti 169 lahendit ja 2018. aasta. | `Vastuste allikad` nähtav; paneeli ei avatud. | `69aa09a3` | 2026-08-30T21:51:00+03:00 |
| M02 | PASS | EPIKoja aruandes „Täisealiste psüühikahäirega inimeste, sh eestkostetavate uuring” milline soovitus anti Tallinnale kontaktisiku või juhtumikorralduse kohta, milline ennetava abi kohta, milline teenustele pääsu ja korduvate hindamiste kohta ning milline toetatud otsustamise kohta? | Andis kõik neli soovitussuunda: kindel kontaktisik/juhtumikorraldaja, proaktiivne abi, lihtsam teenustele pääs koos korduvhindamiste vältimisega ning toetatud otsustamine eestkoste piirava mõju alternatiivina. | `Vastuste allikad` nähtav; paneeli ei avatud. | `69aa09a3` | 2026-08-30T21:51:00+03:00 |

Sequential koond: **7 PASS / 0 PARTIAL / 4 FAIL**.

### Isolated vs sequential võrdlus

- `J05`: isolated **FAIL**, sequential **PASS** — sama täpne küsimus sai värskes vestluses tõendipuuduse vastuse, kuid jooksu teise küsimusena kõik neli õiget arvu.
- `J03`, `J13`, `J14`, `V04`, `V06` ja `M02`: mõlemas faasis **PASS**.
- `J08`, `J11`, `J18` ja `V05`: mõlemas faasis **FAIL**; kõigil juhtudel tagastas assistent üldise kõigi osade kinnitamisest keeldumise ega kuvanud allikanuppu.
- Staatuste põhjal ei tekkinud ühelgi juhul sequential-faasis halvenemist; üks juhtum paranes ja kümme jäid samaks.

### Paus pärast teist faasi

Kokkuleppe järgi peatuti pärast isolated- ja sequential-faasi. Täielikku 75 küsimuse jooksu selles tööjärgus ei käivitatud; Golden-küsimused käivitati hiljem omaniku eraldi korraldusel ja nende tulemused on allpool.

## Golden-37 lisavärav — runtime `69aa09a3`

- algus: `2026-08-30T22:10:16+03:00`
- küsimustik: `eval/golden-rag-v1.json`, 37 juhtumit
- küsimustiku SHA-256: `65284f5265606e4d182f0c8b2e54191abd65155097c68b69fac39baf5f60effc`
- local / `origin/main` / server: `69aa09a36a99ad7f30e0545c3c661a0ca34325c7`
- pind: autentitud production Codex in-app `/vestlus`
- protokoll: iga juhtum värskes vestluses; `edge_followup_paragraph` kasutab Golden-failis määratud SHS § 23 eellugu
- tulemus kirjutatakse siia kohe pärast iga vastust
- täielikud küsimused ja vastused jäid in-app vestluste ajalukku; tabel säilitab hinnangu, sisukokkuvõtte ja kuvatud allikate tõendi

| nr | case_id | status | answer_summary | displayed_sources | timestamp |
|---:|---|---|---|---|---|
| 1 | `kov_kuusalu_koduteenus` | PASS | Kirjeldas Kuusalu koduteenuse sihtrühma, eesmärki ja taotlemist; vastus sisaldas nõutud koduteenuse seost. | Avatud: `Kuusalu vald. Koduteenus · Teenused. kehtiv teenuseinfo`. | 2026-08-30T22:10+03:00 |
| 2 | `kov_harku_sotsiaaltransport` | PASS | Andis Harku taotlemisviisi, abivajaduse hindamise, tähtajad ja hinnad; ei seganud teist KOV-i. | Avatud: `Harku vald. Sotsiaaltransporditeenus · Teenused. kehtiv teenuseinfo`. | 2026-08-30T22:12+03:00 |
| 3 | `kov_kuusalu_vormid` | PASS | Nimetas üldise sotsiaalteenuse avalduse ning SPOKU/paberavalduse; vastus sisaldas nõutud vormiseost. | Avatud: `Kuusalu vald. Koduteenus · Teenused. kehtiv teenuseinfo`. | 2026-08-30T22:18+03:00 |
| 4 | `kov_leakage_guard_narva` | PASS | Andis ainult Narva koduteenuse taotlemise ja abivajaduse hindamise; Kuusalu, Harku ega Anija ei lekkinud vastusesse või allikatesse. | Avatud: `Narva linn. Koduteenus · Teenused. kehtiv teenuseinfo`. | 2026-08-30T22:18+03:00 |
| 5 | `legal_shs_42` | PASS | Selgitas SHS § 42 puudega isikule eluruumi tagamist. | Avatud: `Sotsiaalhoolekande seadus § 42 Puudega isikule eluruumi tagamine`. | 2026-08-30T22:19+03:00 |
| 6 | `legal_shs_17` | PASS | Selgitas SHS § 17 koduteenuse eesmärki, sisu ja näidistoiminguid. | Avatud: `Sotsiaalhoolekande seadus § 17 Koduteenuse eesmärk ja sisu`. | 2026-08-30T22:19+03:00 |
| 7 | `legal_inflected_paragraph` | PASS | Tuvastas käändelise „paragrahv 23” päringu ja selgitas tugiisikuteenuse eesmärki ning sisu. | Avatud: `Sotsiaalhoolekande seadus § 23 Tugiisikuteenuse eesmärk ja sisu`. | 2026-08-30T22:20+03:00 |
| 8 | `ajakiri_overview_lastekaitse` | PASS | Koondas lastekaitse murekohad lapse kaasamisest, abi kiirusest, vägivallast, töökoormusest, usaldusest ja andmekaitsest. | Avatud 13 teemakohast Sotsiaaltöö allikat (nõue ≥3). | 2026-08-30T22:20+03:00 |
| 9 | `ajakiri_overview_omastehooldus` | PASS | Koondas hooldajate füüsilise, vaimse, tööalase, majandusliku ja sotsiaalse koormuse ning leevendusvõimalused. | Avatud 7 omastehoolduse allikat (nõue ≥2). | 2026-08-30T22:21+03:00 |
| 10 | `ajakiri_ai_eetika` | PASS | Käsitles eetikat, väärtusi, vastutust, läbipaistvust, andmekaitset ja inimlikku otsustamist. | Avatud: `Tehisintellekt sotsiaaltöös: praktika, kaalutlused ja väärtuspõhised piirid`. | 2026-08-30T22:21+03:00 |
| 11 | `ajakiri_sloveenia_hooldus` | PASS | Kirjeldas Sloveenia asutusekeskset süsteemi, kodu- ja kogukonnateenuseid, kitsaskohti ning tulevikusuundi. | Avatud: `Pikaajaline hooldus Sloveenias: probleemid ja tulevikusuunad`. | 2026-08-30T22:21+03:00 |
| 12 | `pdf_hea_tava_terviseprobleemiga_laps` | PASS | Andis pere emotsionaalse, praktilise, keskkonna-, osalus- ja võrgustikutoe sammud. | Avatud: `Terviseprobleemiga laste ja nende perede toetamise hea tava` + 3 toetavat allikat. | 2026-08-30T22:22+03:00 |
| 13 | `pdf_eestkoste_uuring` | PASS | Kirjeldas asendatud otsustamist, vähest kaasamist, liigset kontrolli, toe ja teenuste koordineerimise puudusi. | Avatud 6 eestkoste teemaga allikat, sh uuringu kokkuvõte ja lühikokkuvõte. | 2026-08-30T22:22+03:00 |
| 14 | `pdf_vaimne_tervis_koolis` | PASS | Loetles koolile suunatud vaimse tervise juhendid, õppematerjalid, uuringud ja taustakäsitlused. | Avatud 9 allikat, sh `Koolilaste ja noorte vaimne tervis` ja `Peaasi.ee Haridus`. | 2026-08-30T22:23+03:00 |
| 15 | `pdf_tarkvanem_tooleht` | PASS | Leidis ja kirjeldas algkoolilapsega vestlemise abiküsimuste töölehte. | Avatud 6 allikat; esmane oli õige algkoolilapse tööleht, kuid 5 kõrvalallikat olid osalt ebaolulised. | 2026-08-30T22:23+03:00 |
| 16 | `org_astangu` | PASS | Kirjeldas Astangu õppimise, töötamise, rehabilitatsiooni ja nõustamise võimalusi. | Avatud 8 allikat; esmane `Astangu Kutserehabilitatsiooni Keskus` sisaldas nõutud URL-i. | 2026-08-30T22:24+03:00 |
| 17 | `org_puudega_inimese_abi` | PASS | Nimetas SKA, KOV-i, EPIKoja, organisatsioonid ja praktilised materjalid. | Avatud 10 allikat; vähemalt 2 nõue täidetud ja SHS-i allikat ei kuvatud. | 2026-08-30T22:24+03:00 |
| 18 | `life_raha_uur_toit` | PASS | Suunas kohe KOV-i sotsiaalosakonda, nimetas vältimatu sotsiaalabi ja toimetulekutoetuse. | Avatud: SHS § 8 ja § 131. | 2026-08-30T22:25+03:00 |
| 19 | `life_eakas_kodus` | PASS | Suunas ema elukohajärgse KOV-i sotsiaalosakonda abivajaduse hindamisele ja kirjeldas kodus osutatavat abi. | Avatud: `Kes aitab ja kuhu pöörduda, kui sul on tuvastatud puude raskusaste?`. | 2026-08-30T22:25+03:00 |
| 20 | `comparison_kodu_tugiisik` | PASS | Eristas koduse praktilise abi tugiisiku juhendamisest ja motiveerimisest. | Avatud § 17 ja § 23 ning korraldusparagrahvid; keelatud § 44/§ 45 puudusid. | 2026-08-30T22:26+03:00 |
| 21 | `comparison_kodu_isiklik_abistaja` | PASS | Eristas koduse toimetuleku abi isikliku abistaja füüsilisest kõrvalabist ja osalemistoest. | Avatud § 17 ja § 27 koos korraldusparagrahvidega. | 2026-08-30T22:27+03:00 |
| 22 | `edge_inflected_tugiisikuteenusel` | PASS | Tuvastas käändelise tugiisikuteenuse, selgitas KOV-i rolli ja küsis täpsustuseks omavalitsust. | Avatud § 24 ja 3 kõrvalallikat. | 2026-08-30T22:27+03:00 |
| 23 | `edge_crisis` | PASS | Andis vahetu ohuga sobiva juhise helistada 112, mitte jääda üksi ja eemaldada vigastusvahendid. | Allikapaneelis avanes üks sisuliselt ebaoluline Sotsiaaltöö intervjuu; Golden-kriteerium allikat ei nõudnud. | 2026-08-30T22:28+03:00 |
| 24 | `pdf_abivajav_laps_andmekaitse` | PASS | Selgitas, et pädevale asutusele teatamine on lubatud ning vajalikku teavet ja teataja andmeid tuleb kaitsta. | Avatud: `Juhend: abivajavast lapsest teatamine ja andmekaitse` + 3 toetavat allikat. | 2026-08-30T22:28+03:00 |
| 25 | `pdf_opilase_toetamine_koolis` | PASS | Loetles kooli tugisüsteemi, individuaalsuse, tugimeeskonna ja heade praktikate juhendid. | Avatud 10 allikat; õiged Harno koolimaterjalid olid olemas, kuid paneelis oli ka kõrvalisi juhendeid. | 2026-08-30T22:29+03:00 |
| 26 | `pdf_marac_mudel` | PASS | Selgitas MARAC-i riskihindamist, võrgustikukohtumist, turvalisusplaani, rollijaotust ja järelhindamist. | Avatud: MARAC-i Sotsiaaltöö artikkel ja `MARAC-i juhendmaterjal`. | 2026-08-30T22:29+03:00 |
| 27 | `pdf_vaesus_statistika` | PASS | Koondas vaesuse seosed töötuse, elukoha, leibkonna, soo, laste võimaluste ja kuhjuvate riskidega ning piiritles andmete ajakohasuse. | Avatud 4 statistika- ja võrdõiguslikkuse allikat. | 2026-08-30T22:29+03:00 |
| 28 | `pdf_lapse_heaolu_hindamine` | PASS | Kirjeldas teabe kogumist, lapse kaasamist, heaoluvaldkondi, riske, tegevuskava ja vahehindamist. | Avatud: `Lapse heaolu hindamise käsiraamatust`. | 2026-08-30T22:30+03:00 |
| 29 | `edge_followup_paragraph` | FAIL | Pärast samas vestluses edukat SHS § 23 vastust küsis assistent uuesti, millist paragrahvi mõeldakse; `tugiisik` puudus jätkuvastusest. | Jätkuvastusel allikanuppu ei olnud; avatud § 23 paneel kuulus eelmisele vastusele. | 2026-08-30T22:30+03:00 |
| 30 | `edge_no_corpus_answer_v2` | FAIL | Keeldus Saksamaa täpset hinda kinnitamast ja jäi alla 60 sõna, kuid no-corpus allikapiir ebaõnnestus. | Avatud 3 Eesti hooldekodu-teemalist allikat, kuigi nõue oli `displayed_max=0`. | 2026-08-30T22:31+03:00 |
| 31 | `pdf_inimkaubandus_ennetus` | PASS | Andis praktilised riskimärgid, turvalise töö/reisimise, usaldussuhte, abiotsimise ja võrgustikutöö sammud. | Avatud 4 allikat, sh kaks inimkaubanduse ennetusmaterjali. | 2026-08-30T22:31+03:00 |
| 32 | `pdf_kubervagivald_ohver` | PASS | Andis turvalisuse hindamise, ohvri kuulamise, seadme- ja kontoturbe, tõendite kogumise ning abi kaasamise sammud. | Avatud 5 allikat; esmane oli `Juhendmaterjal kübervägivallast ohvritega töötavatele spetsialistidele`. | 2026-08-30T22:32+03:00 |
| 33 | `pdf_hoolekande_kvaliteet` | PASS | Loetles ja selgitas hoolekandeteenuste kvaliteedi põhimõtted, sh isikukesksuse, võimestamise, vajaduspõhisuse, õiguste kaitse ja juhtimise. | Avatud 4 allikat; esmane oli `Hoolekandeteenuste kvaliteedi juhendmaterjal`. | 2026-08-30T22:33+03:00 |
| 34 | `pdf_toovoime_reform` | PASS | Koondas töövõimereformi mõju tööhõivele, töösoovile, hoiakutele ja teadlikkusele ning piiritles põhjusliku mõju ebakindluse. | Avatud 4 uuringuallikat; kaks esimest käsitlesid otseselt töövõimereformi ja töövõime toetamise skeemi. | 2026-08-30T22:34+03:00 |
| 35 | `graph_kov_vormid_kontaktid` | FAIL | Vastus piirdus väitega, et praeguseid kontaktandmeid ei saa kinnitada; nõutud avaldust/vormi/taotlust ega pöördumiskohta ei andnud. | Allikanuppu ei kuvatud, kuigi nõue oli vähemalt 1 allikas. | 2026-08-30T22:34+03:00 |
| 36 | `ajakiri_integreeritud_teenused` | FAIL | Selge ajakirjapäringu asemel küsis assistent, mida kasutaja sõna „Sotsiaaltöö” all mõtleb; integreeritud teenuste vastus puudus. | Allikanuppu ei kuvatud, kuigi nõue oli vähemalt 1 allikas. | 2026-08-30T22:35+03:00 |
| 37 | `ajakiri_kinnise_lasteasutuse_alternatiiv` | PASS | Kirjeldas tugevdatud toetust, väiksemaid üksusi, ravi- ja teraapiakodusid, rehabilitatsiooni ning jätkutuge KLAT-i vähem piiravate alternatiividena. | Avatud 6 allikat; nõutud 2019. aasta tugevdatud toetuse artikkel oli olemas, kuid paneelis oli ka üks teemaväline mälestusartikkel. | 2026-08-30T22:35+03:00 |

### Golden-37 koond

- tulemus: **33 PASS / 0 PARTIAL / 4 FAIL**
- nimetaja: **37/37**, eraldi 75 küsimuse auditist
- `edge_followup_paragraph`: samas vestluses ei sidunud „sellest paragrahvist” vahetult eelnenud SHS § 23 vastusega
- `edge_no_corpus_answer_v2`: vastus tunnistas tõendipuudust, kuid kuvas kolm ebaolulist Eesti hooldekodu allikat
- `graph_kov_vormid_kontaktid`: Kuusalu vormi ja kontakti asemel tagastas tõendipuuduse vastuse ning null allikat
- `ajakiri_integreeritud_teenused`: tõlgendas selge ajakirja nime mitmetähenduslikuna ja küsis tarbetu täpsustusküsimuse
- allikakvaliteedi kõrvalmärkus: mitu formaalselt PASS-juhtumit kuvas õige esmaallika kõrval osaliselt ebaolulisi lisaallikaid (`pdf_tarkvanem_tooleht`, `edge_crisis`, `pdf_opilase_toetamine_koolis`, `ajakiri_kinnise_lasteasutuse_alternatiiv`)

## 31.08 paranduse–deploy–korduse tsükkel

- Omaniku ajapiir: 31.08.2026 kell **02:15 Europe/Tallinn** või kasutuslimiidi täitumine, kumb saabub enne. Pärast limiidi taastumist ega hommikul automaatselt ei jätkata; ajastatud jätk on `PAUSED`.
- Ring 1 runtime: `f8eaae5612130e0a5b65e7e51603077f1407c6e6`. Kohalik, GitHub `main` ja serveri SHA kattuvad, server puhas; 3 teenust aktiivsed ja `/vestlus` HTTP 200 (00:19 EEST).
- Serveri RAG health: 49 727 vektorit, 6089 registridokumenti, aktiivne FTS ja lemma-FTS 6073 dokumenti; mõlema indeksipõlvkond õige. See ei tõenda küsimuste vastuse kvaliteeti.
- Kohalik ning serveri tootmisbuild läbisid; migratsioone ootel ei olnud.
- Protokoll: 75-auditi viimase exact-korduse viis lahtist juhtumit `J05,J08,J11,J18,V05` esmalt eraldi värsketes vestlustes, siis samas vestluses järjest. Golden-juhtumid ja uued regressioonid eraldi nimetajas.
- Pind: autentitud **Codex in-app** vestlus, küsimusi ei saadeta otse API kaudu. Iga täielik vastus, avatud allikad ja hinnang salvestatakse siia kohe.
- PASS eeldab kõiki küsitud osi, õigeid seoseid ja nimetatud artikli allikat; tõendipuudus ei ole faktipäringu PASS. Täpsustamine võib olla õige ainult päriselt ebaselge päringu puhul. Hinnet 10/10 ei eeldata ette.

### Ring 1 — isolated

#### J05 — PASS — 00:19 EEST

Küsimus: Artiklis „Taastav õigus ja COVID-19” mitu spetsialisti ja riiki osales igakuisel kohtumisel ning mitu inimest ja riiki osales 2020. aasta aprillist juulini toimunud neljal kohtumisel?

Täielik vastus:

> - Spetsialisti osales igakuisel kohtumisel: umbes 30 spetsialisti.
> - Riiki osales igakuisel kohtumisel: 12 riigist.
> - Inimest osales 2020. aasta aprillist juulini toimunud neljal kohtumisel: 60 inimest.
> - Riiki osales 2020. aasta aprillist juulini toimunud neljal kohtumisel: 19 riigist.

Avatud allikapaneel: **Ian D. Marder, 2020. Taastav õigus ja COVID-19. Sotsiaaltöö 4/2020 · lk 1–7 · Taastav õigus** (1 allikas). Kõik neli arvu, sündmusseosed ja ligikaudsus õiged. Keelekuju on kohmakas, sisuhinnang PASS.

#### J08 — FAIL — 00:20 EEST

Küsimus: Vaike Vainu 2023. aasta artiklis „Suure hoolduskoormusega inimesed vajavad täiendavat abi” kui suur osa vastanutest vajas lisabi, kui suur osa palju lisabi ning kui suur osa oli suure ja keskmise hoolduskoormuse riskiga?

Täielik vastus:

> Ma ei saa küsitud arvu, ulatust ja aastat täpse vastuse jaoks piisavalt kindlalt kinnitada.

Allikanuppu ei kuvata (0 allikat). Kõik neli küsitud protsenti puuduvad. Lokaalne faktilepingu parandus üksi ei tõendanud lõppraja toimimist; esimene lahknev kiht vajab runtime-diagnoosi.

#### J11 — FAIL — 00:21 EEST

Küsimus: Artiklis „Sotsiaaltöötajate tööalase toetuse kogemused” mitu intervjuud tehti, kuidas jagunesid individuaal- ja rühmavestlused ning millist kolmeetapilist analüüsi kasutati?

Täielik vastus:

> Ma ei saa kõiki küsitud osi valitud allika põhjal piisavalt kindlalt kinnitada.

Allikanuppu ei kuvata (0 allikat). Arvud ja analüüsimeetod puuduvad, FAIL. J08 oma vestlustunnus: `conv-a96d50fe-a250-4f74-9356-28c3ea39a25e`; J05: `72c2fdfc-502d-43bc-a5f9-f92085b02353`.

#### J18 — PASS — 00:21 EEST

Küsimus: Erle Eenmaa 2022. aasta artiklis „Psüühilise erivajadusega inimese osalus oma eestkostes” kui palju osalejaid oli igas kolmes praktikute rühmas ja kui palju kokku?

Täielik vastus:

> - Osalejaid igas kolmes praktikute rühmas: 5
> - Osalejaid kokku: 15

Avatud allikapaneel: **Erle Eenmaa, 2022. Psüühilise erivajadusega inimese osalus oma eestkostes. Sotsiaaltöö 1/2022 · lk 1–9 · Õigus** (1 allikas). Küsitud jaotus ja koguarv õiged; rühmi nimeliselt ei loetleta, kuid küsimus küsis nende arvu, mitte rühmade nimetusi.

#### V05 — FAIL — 00:21 EEST

Küsimus: Marina Vaino artiklis „Uus e-kursus pakub tuge sotsiaalvaldkonna koolitajatele” kui pika aja pärast hinnati järelmõju ning kelle hinnanguid võrreldi?

Täielik vastus:

> Ma ei saa kõiki küsitud osi valitud allika põhjal piisavalt kindlalt kinnitada.

Allikanuppu ei kuvata (0 allikat). Kuus kuud ja osaleja/tööandja seos puuduvad.

Ring 1 isolated koond: **2 PASS / 0 PARTIAL / 3 FAIL**. J05 ja J18 PASS; J08, J11 ja V05 FAIL. Võrreldes eelneva sama viie juhtumi isolated-tulemusega (0/5 PASS) paranesid J05 ja J18. See pole kogu 75-korpuse kordustulemus.

### Ring 1 — sequential

Alustatud 00:23 EEST värskes vestluses; järjekord J05 → J08 → J11 → J18 → V05. Muutumatul `f8eaae56` versioonil. Diagnostikaks vaadeldakse ainult uute enda in-app testpäringute vastusevoogu, mitte teiste kasutajate sõnumeid või andmebaasi.

#### J05 — PASS — 00:23 EEST

Küsimus sama mis ring 1 isolated J05 (täpne sõnastus eespool).

Täielik vastus:

> - Spetsialisti osales igakuisel kohtumisel: umbes 30 spetsialisti.
> - Riiki osales igakuisel kohtumisel: 12 riigist.
> - Inimest osales aprillist juulini toimunud neljal kohtumisel: 60 inimest.
> - Riiki osales aprillist juulini toimunud neljal kohtumisel: 19 riigist.

Avatud allikapaneel: **Ian D. Marder, 2020. Taastav õigus ja COVID-19. Sotsiaaltöö 4/2020 · lk 1–7 · Taastav õigus** (1 allikas).

#### J08 — FAIL — 00:24 EEST

Küsimus sama mis ring 1 isolated J08.

Täielik vastus:

> Ma ei saa küsitud arvu, ulatust ja aastat täpse vastuse jaoks piisavalt kindlalt kinnitada.

Uuel vastusel allikanuppu ei kuvata (0 allikat); J05 allikanupp ei ole J08 allikas.

Oma SSE diagnostika: dokumendiidentiteet `high`, valitud õige `sotsiaaltoo-1-2023-suure-hoolduskoormusega-inimesed-vajavad-taiendavat-abi-2023-1`; lõppkonteksti faktileping **4/4 complete**, kasutatakse genereerimisel ja valideerimisel. Keeldumise põhjus **`requested_metric_relation_mismatch`**, 4 arvuväidet, toetamata arvude loendur 0. See juhtum ei ole „RAG ei leidnud artiklit”: lahknemine on lõppvastuse arvude-suhete valideerimise kihis. Jälg ei avalda valideerimiseelset vastust, seetõttu ei tõenda see üksinda, kas mudeli seos või validaator oli vale.

#### J11 — FAIL — 00:25 EEST

Küsimus sama mis ring 1 isolated J11.

Täielik vastus:

> Ma ei saa kõiki küsitud osi valitud allika põhjal piisavalt kindlalt kinnitada.

Uue vastuse allikaid 0. Oma SSE: dokumendiidentiteet õige/high, arvuleping 3/3 complete; kogu küsimuse tõendikaetus 3/4, puudub nullpõhine slot 3 ehk analüüsimeetod. Kvalitatiivne leping `qualitative_evidence_mapping_incomplete`, mapped 0/1. Validaator peatab põhjusel `requested_fact_evidence_incomplete`.

Selle ringi J08/J11 oma jooksude masinloetavad jäljed: `docs/audits/evidence/rag-loop-2026-08-31-f8eaae56/r1-seq-J08.trace.json` ja `r1-seq-J11.trace.json`.

#### J18 — PASS — 00:25 EEST

Küsimus sama mis ring 1 isolated J18.

Täielik vastus:

> - Osalejaid igas kolmes praktikute rühmas: 5
> - Osalejaid kokku: 15

SSE valideerimine: `uniform_requested_metric_slots_validated`; õige dokument, faktileping 2/2 complete. Avatud allikapaneel: **Erle Eenmaa, 2022. Psüühilise erivajadusega inimese osalus oma eestkostes. Sotsiaaltöö 1/2022 · lk 1–9 · Õigus** (1 allikas).

#### V05 — FAIL — 00:26 EEST

Küsimus sama mis ring 1 isolated V05.

Täielik vastus:

> Ma ei saa kõiki küsitud osi valitud allika põhjal piisavalt kindlalt kinnitada.

Uue vastuse allikaid 0. Oma SSE: õige dokument/high, kestuse ja osapoolte lepingud complete, osapooltel `minimum_answer_items=2`, aga vastuse slot 2 ei läbinud kontrolli: **`requested_fact_answer_incomplete`**. See erineb J11 tõendikaetuse veast. Jälg: `docs/audits/evidence/rag-loop-2026-08-31-f8eaae56/r1-seq-V05.trace.json`.

Ring 1 sequential koond: **2 PASS / 0 PARTIAL / 3 FAIL**. Kõigi viie staatus kattub isolated-ringiga; selles mõõtmises järjekorra mõju ei ilmnenud. Mõlemas J05/J18 PASS, J08/J11/V05 FAIL. Uus tsükkel peab parandama tõendatud kihivead, mitte lihtsalt sama küsimust eduka juhuni kordama.

### Ring 1 — Golden-paranduste eraldi kontroll

Nimetaja on 6 valitud Golden-juhtumit (4 varasemat FAIL-i + lapse hindamise ja kübervägivalla allikakvaliteet); SHS § 23 eelküsimus ei suurenda seda nimetajat.

| Juhtum | Hinnang | Täielik vastus ja avatud allikapaneel | Põhjendus |
|---|---|---|---|
| edge_followup_paragraph | PASS | [täisvastus](../docs/audits/evidence/rag-loop-2026-08-31-f8eaae56/r1-golden-edge_followup_paragraph.md) | Säilitab SHS § 23, selgitab tugiisikuteenust; 1 õige allikas. |
| edge_no_corpus_answer_v2 | FAIL | [täisvastus](../docs/audits/evidence/rag-loop-2026-08-31-f8eaae56/r1-golden-edge_no_corpus_answer_v2.md) | Vastus hinda ei väida, kuid avatud allikaid 1; nõue oli 0. |
| graph_kov_vormid_kontaktid | PASS | [täisvastus](../docs/audits/evidence/rag-loop-2026-08-31-f8eaae56/r1-golden-graph_kov_vormid_kontaktid.md) | Avaldus/SPOKU või paberil ning Kuusalu Vallavalitsus; õige teenuseallikas. Ei mõtle isikukontakti välja. |
| ajakiri_integreeritud_teenused | PARTIAL | [täisvastus](../docs/audits/evidence/rag-loop-2026-08-31-f8eaae56/r1-golden-ajakiri_integreeritud_teenused.md) | Golden teemavastus PASS; 10 allikat, sh 4 tekstis nimetamata kõrvalallikat. Allikaseose lisakriteerium vajab diagnoosi, mitte automaatset PASS-i. |
| pdf_lapse_heaolu_hindamine | PARTIAL | [täisvastus](../docs/audits/evidence/rag-loop-2026-08-31-f8eaae56/r1-golden-pdf_lapse_heaolu_hindamine.md) | Meetodijuhis paranes: eelhindamine, tervikhindamine, vahehindamine ja Turvalisuse märgid. 4 allika seas on täiskasvanute abivajaduse raport; sihtrühma/allikaseose viga. |
| pdf_kubervagivald_ohver | PASS | [täisvastus](../docs/audits/evidence/rag-loop-2026-08-31-f8eaae56/r1-golden-pdf_kubervagivald_ohver.md) | Praktiline turvaplaan, tõendite säilitamine ja ohutu suhtlus. Avatud 1 otsene kübervägivalla juhend (varem 5 allikat). |

Golden valitud kuue remondikontroll: **3 PASS / 2 PARTIAL / 1 FAIL**. Algsete kitsaste Golden-kriteeriumide järgi 5/6 PASS, kuid lapse ja integreeritud teenuste allikakvaliteeti ei loeta praegu parandatuks.

### Ring 2 — põhjuseparandus enne uut serverikordust

Esimese ringi oma UI päringute SSE jälg on vaatlustõend, mitte serveri teiste kasutajate sisu. Küsimusi ei saadetud otse API kaudu. Esimene lahknev kiht määrab paranduse:

| Juhtum | Kinnitatud põhjus | Parandus ja negatiivne piir |
|---|---|---|
| J08 | Õige dokument ja 4/4 faktileping, kuid lõppvastuse relation-mismatch. Avaliku täisteksti lokaalkontroll lükkas tagasi õige „palju abi” ning vana määrangukontroll lubas vale riskirühma. | Ainult allikas kinnitatud konkreetse sloti abi-variant; jagatud nähtuse kategooriamäärang peab säilima. 9 õiget sõnastust läbib, 8 vale/puuduv määrang või arvude vahetus blokeeritud. Valideerimiseelset mudelivastust SSE ei sisalda, seda ei rekonstrueerita oletusena. |
| J11 | Recovery eel/järel 4/4 kaetus, lõpp-renderduses 3/4; meetod kadus. Valitud exact-fact režiimi kõrval aktiveerus pealkirja „kogemused” tõttu sünteesieelarve. | Valitud specific_research_fact rada välistab üldise sünteesi toorsõna-heuristika. Lõplik renderdatud tõendikontroll jääb rangeks. |
| V05 | Kvalitatiivne ankur tuli kursuseteemade fragmendist, mitte osalistest: fragment-hash 76f3da2e…e4a35; ankrud markamine/abivoimalused/laste/peredega. | Koordineeritud osapoolte paar peab tulema osalemise/hindamise lausest ja osalist tähistavatest sõnadest. Täistekst annab nüüd õige fragmendi 72c0febc… ning osaleja/tooandja; puuduv tööandja ja teemaloend blokeeritud. |
| Saksamaa hooldekodu hind | Puhta tõendipuuduse alusega algav sõnastus loeti sisuväiteks ja kuvas kõrvalallika. | Alusega algav piirang ja puuduva tõendi vajadus ei ole sisuväide; tõeline sisuline vastandus säilitab oma allika. |
| Integreeritud teenused | 10 kuvatud allikast 4 nimetamata kõrvalartiklit toetasid üksnes teiste allikatega juba kaetud üldväiteid. | Nimetatud allikatega sünteesis säilivad kõik nimetatud allikad ja uut väidet lisavad allikad; redundantne nimetamata taust peidetakse. |
| Lapse hindamine | Lapse küsimusele valiti üldise hindamissõnavara tõttu täiskasvanute abivajaduse raport. | Sõnaselge lapse/täiskasvanu küsimuse ja vastupidise ainsa sihtrühma pealkirja konflikt välistab kandidaadi. |

Kitsad arenduskontrollid: 11 faktilepingu/renderduse/rolli/sihtrühma testi PASS; 9 allikaatributsiooni testi PASS; avaliku J08 täisteksti maatriks 17/17 oodatud; V05 kvalitatiivse sloti täistekst, õige vastus ning kaks negatiivi kontrollitud. ESLint, i18n ja `git diff --check` läbivad. Teise puu tootmisbuild PASS (`TZ=UTC`, exit 0, kompileerimine 34,6 s). Need ei ole runtime PASS-id. Deploy `32765b01` (kood `4c658a48`) lõppes edukalt 00:49 EEST: serveri build PASS, pending migrations 0, teenused 3/3 aktiivsed. Deploy säilitas eelmise artefakti ja eemaldas ühe vana current-artefakti ning ühe vana build-logi; kasutajaandmeid ei kustutatud.

### Ring 2 — in-app isolated ja sequential

Release `32765b01`; iga küsimuse täielik vastus, avatud allikapaneel ja oma SSE jälg salvestatakse eraldi. Hinnang ei võrdu automaatselt validaatori tulemusega.

| Juhtum | Hinnang | Vastus/allikad | Märkus |
|---|---|---|---|
| r2-iso-J05 | PASS | [täisvastus](../docs/audits/evidence/rag-loop-2026-08-31-32765b01/r2-iso-J05.md) | Umbes 30 / 12; 60 / 19, üks õige allikas. |
| r2-iso-J08 | FAIL | [täisvastus](../docs/audits/evidence/rag-loop-2026-08-31-32765b01/r2-iso-J08.md) | Endiselt requested_metric_relation_mismatch; allikaid 0. |
| r2-iso-J11 | FAIL | [täisvastus](../docs/audits/evidence/rag-loop-2026-08-31-32765b01/r2-iso-J11.md) | Keeldumine muutus: requested_metric_relation_mismatch, allikaid 0. |
| r2-iso-J18 | PASS | [täisvastus](../docs/audits/evidence/rag-loop-2026-08-31-32765b01/r2-iso-J18.md) | Igas kolmes rühmas 5, kokku 15; üks õige allikas. |
| r2-iso-V05 | PASS | [täisvastus](../docs/audits/evidence/rag-loop-2026-08-31-32765b01/r2-iso-V05.md) | Kuus kuud ning osaleja ja tema tööandja; üks õige allikas. |
| r2-seq-J05 | PASS | [täisvastus](../docs/audits/evidence/rag-loop-2026-08-31-32765b01/r2-seq-J05.md) | Umbes 30 / 12; 60 / 19, üks õige allikas. |
| r2-seq-J08 | PASS | [täisvastus](../docs/audits/evidence/rag-loop-2026-08-31-32765b01/r2-seq-J08.md) | 61/26/11/18 õiges seoses; üks õige allikas. Erineb isolated FAIL-ist, põhjus vajab eristamist mudelihajuvusest. |
| r2-seq-J11 | FAIL | [täisvastus](../docs/audits/evidence/rag-loop-2026-08-31-32765b01/r2-seq-J11.md) | requested_metric_relation_mismatch; allikaid 0. |
| r2-seq-J18 | PASS | [täisvastus](../docs/audits/evidence/rag-loop-2026-08-31-32765b01/r2-seq-J18.md) | 5 igas kolmes rühmas, kokku15; õige allikas. SSE salvestus katkes, UI tõend säilis. |
| r2-seq-V05 | PASS | [täisvastus](../docs/audits/evidence/rag-loop-2026-08-31-32765b01/r2-seq-V05.md) | Kuus kuud, osaleja ja tööandja; õige allikas. |
| r2-golden-edge_no_corpus_answer_v2 | PASS | [täisvastus](../docs/audits/evidence/rag-loop-2026-08-31-32765b01/r2-golden-edge_no_corpus_answer_v2.md) | Hinda ei leiutata ja allikapaneel tühi. |
| r2-golden-ajakiri_integreeritud_teenused | FAIL | [täisvastus](../docs/audits/evidence/rag-loop-2026-08-31-32765b01/r2-golden-ajakiri_integreeritud_teenused.md) | Ekslik Sotsiaaltöö mõiste täpsustus; trace korrektne sünteesirada. quoted_user_term_only järelkiht vajab parandust. |
| r2-golden-pdf_lapse_heaolu_hindamine | PASS | [täisvastus](../docs/audits/evidence/rag-loop-2026-08-31-32765b01/r2-golden-pdf_lapse_heaolu_hindamine.md) | Terviklik hindamisprotsess ja täiendav Turvalisuse märkide mudel; 3 lapsekohast allikat, täiskasvanute raport puudub. |

Ring 2 koond: isolated **3 PASS / 0 PARTIAL / 2 FAIL**, sequential **4 PASS / 0 PARTIAL / 1 FAIL**. J08 on isolated FAIL ja sequential PASS; ühe paari põhjal ei saa eristada ajaloo mõju mudeli sõnastushajuvusest. V05 paranes mõlemas. J11 lõppkontekst on nüüd 7/7 body, 12079 märki, kärpimata ja meetodisloti vastusekontroll läbib; alles jääb numbrilise seose kontrolli viga. Valideerimiseelne mudelivastus ei ole nähtav ning sanitizer eemaldab ka olemasoleva puuduva arvusloti indeksi — järgnev diagnostikaparandus peab selle lünga sulgema ilma vastuseteksti avaldamata.

Ring 2 Golden-järelkontroll (eraldi nimetaja 3): **2 PASS / 0 PARTIAL / 1 FAIL**. Integreeritud teenuste allikakärpe tulemust ei saanud keeldumise tõttu sellel jooksul hinnata.

### Ring 3 — kinnitatud põhjuste teine järelparandus

- J11 avaliku meetodilõigu ja runtime'i morfoloogiaslottidega leping kordas viga: „Tehti 7 intervjuud: 6 individuaalintervjuud ja 1 rühmaintervjuu” ebaõnnestus slotis 2, kuigi eraldi lausetena läbis. Tokenikeskpunkti kaugus oli õige pika sildi jaoks 12, eelmise koguarvu lühisildil 7,5. Kaugus on nüüd arvuspani ja sõnaspani servade vahel. Runtime'i varjatud algvastust sellest ei järeldata.
- Sünteesi järelkiht muutis tavapärase mitmelauselise vastuse „Ajakiri „Sotsiaaltöö” käsitleb…” mõiste täpsustuseks. Põhjus: quotedUserTerm fallback ei nõudnud üldse küsimusekuju. Sama struktuurivärav kehtib nüüd nii turvalise mudeliküsimuse kui ka jutumärgipõhise fallback'i ees; sisuvastus ja sisuvastus koos lõpu järelküsimusega säilivad.
- J08 allesjääva vea uurimiseks on trace'is puuduva arvusloti piiratud indeks, sobivuskontrollide loendurid/tõeväärtused ja allikast lisatud variantide arv. Uusi tooreid relation-term'e, arve ega valideerimiseelset vastust ei lisata.

Kolmanda puu kitsas kontroll: **14/14 PASS**, sh arvusildi liitsõna, vahetatud arvude negatiiv, päris täpsustuse säilimine, sisuvastuse säilimine ning diagnostika loenduripiir/privaatse canary puudumine. Avaliku J08 17/17 maatriks ja J11 täisteksti 7 positiivset/negatiivset kontrolli annavad oodatud tulemuse. Lõpule lisatud kasutajaküsimuse kordamise fallback-piiri sihttest läbib. ESLint, i18n, diff-check ja lõpliku muutumatu koodipuu `TZ=UTC` tootmisbuild PASS (34,5 s kompileerimine). Commit/push `d2257318`; deploy käib. Runtime pärast seda plokki on seni NOT_RUN.

### Ring 3 — in-app isolated ja sequential

Iga küsimus saadetakse kasutajaliidese kaudu. Golden ja uued sõnastused ei suurenda 75-auditi nimetajat; allpool märgitakse nende kontrollid eraldi.

| R3 juhtum | Hinnang | Täisvastus/allikapaneel | Märkus |
|---|---|---|---|
| r3-iso-J05 | PASS | [täisvastus](../docs/audits/evidence/rag-loop-2026-08-31-d2257318/r3-iso-J05.md) | Umbes30 / 12 ja60 / 19; üks õige allikas. |
| r3-iso-J08 | FAIL | [täisvastus](../docs/audits/evidence/rag-loop-2026-08-31-d2257318/r3-iso-J08.md) | Slot1:3/3 sõna sobib, kuid unique_relation_bound=false; allikaid0. |
| r3-iso-J11 | FAIL | [täisvastus](../docs/audits/evidence/rag-loop-2026-08-31-d2257318/r3-iso-J11.md) | Slot2 sõna sobib, unique_relation_bound=false; meetod läbib. |
| r3-iso-J18 | PASS | [täisvastus](../docs/audits/evidence/rag-loop-2026-08-31-d2257318/r3-iso-J18.md) | Igas kolmes rühmas5, kokku15; õige allikas. |
| r3-iso-V05 | PASS | [täisvastus](../docs/audits/evidence/rag-loop-2026-08-31-d2257318/r3-iso-V05.md) | Kuus kuud, osaleja ja tööandja; õige allikas. |
| r3-seq-J05 | PASS | [täisvastus](../docs/audits/evidence/rag-loop-2026-08-31-d2257318/r3-seq-J05.md) | Umbes30/12 ja60/19; õige allikas. |
| r3-seq-J08 | FAIL | [täisvastus](../docs/audits/evidence/rag-loop-2026-08-31-d2257318/r3-seq-J08.md) | Slot1 sõnakate2/3 piisav, kuid unique_relation_bound=false. |
| r3-seq-J11 | FAIL | [täisvastus](../docs/audits/evidence/rag-loop-2026-08-31-d2257318/r3-seq-J11.md) | Numbriseos läbis, kuid requested_metric_unexpected_numeric_claim; küsitud meetod säilis. |
| r3-seq-J18 | PASS | [täisvastus](../docs/audits/evidence/rag-loop-2026-08-31-d2257318/r3-seq-J18.md) | 5 igas kolmes rühmas, kokku15; õige allikas. |
| r3-seq-V05 | PASS | [täisvastus](../docs/audits/evidence/rag-loop-2026-08-31-d2257318/r3-seq-V05.md) | Kuus kuud; osaleja ja tööandja; õige allikas. |

R3 viie varem vigase 75-komplekti juhtumi tulemus: **isolated 3 PASS / 2 FAIL, sequential 3 PASS / 2 FAIL**. J05, J18 ja V05 läbivad mõlemad jooksud; J08 ja J11 mitte. Selle ringi põhjal järjekorra eelist ei ilmnenud.

Golden eraldi järelkontroll: **integreeritud teenused PASS** — sisuline süntees ja kuus vastuses nimetatud allikat, ilma võltsi täpsustusküsimuseta. [Täisvastus ja avatud paneel](../docs/audits/evidence/rag-loop-2026-08-31-d2257318/r3-golden-integrated.md).

### Ring 4 — arvuseose vormindus ja allikaga piiratud taastamine

R3 deploy oli edukas: lokaalne/origin/server SHA d2257318, kolm teenust aktiivsed, avalik vestlus HTTP 200; 49 727 vektorit, 6089 registrikirjet ja 6073 aktiivset leksikaalset dokumenti. Mõlemad FTS-indeksid valmis. EstNLTK saadavus on kinnitatud enda UI päringu trace'iga; restart-järgne lazy-load olek ei tähenda teenuse viga.

- J08 trace eristas esimese sloti vale sildikonkurentsi. Avalik täistekst ja tegelikud morfoloogiaslotid reprodutseerisid vea kolme õige „hooldustegevustes/hoolduskoormusega” sõnastusega. Konkureeriv slot peab nüüd ise täitma kohaliku seosesignatuuri ning tema kategooriamäärang on ühise põhisõna asemel esmane. Tegeliku puu sõltumatu maatriks: 24/24 oodatud, sealhulgas valed arvude vahetused ja puuduv „palju” jäävad blokeerituks.
- J11 õige arvupaar ebaõnnestus rasvase kirja, koopula või nihutatud toorpositsioonide tõttu. Tokeniseerimine säilitab algsed positsioonid; kõrvalolev silt kuulub lähimale oma arvule ka vorminduse korral. Sõltumatu avaliku täisteksti kontroll: kuus õiget vormi läbib, kolm valet/puuduvat fakti blokeeritakse (9/9).
- R3 sequential-J11 jõudis arvuseosest edasi, kuid blokeerus ootamatu kõrvalarvu tõttu. Varjatud mudelivastust ega tegelikku kõrvalarvu ei oletata. Lisatud kitsas taastamine kasutab ainult täielikku renderdatud faktilepingut, tugevat dokumendilukku, olemasolevaid allikaid ja juba valideeritud kvalitatiivseid üksusi; kogu vastus valideeritakse uuesti. Vale põhiarv, puuduv meetod, tühi allikakomplekt ja nõrk identiteet ei taastu.

Neljanda ploki sihttestid: 14/14 PASS. ESLint, i18n ja diff-check PASS; lõpliku muutumatu koodipuu TZ=UTC tootmisbuild PASS (35,3 s kompileerimine). Käituskvaliteet jääb NOT_PROVEN kuni uue serverikorduseni.

### Ring 4 — in-app isolated ja sequential

Release e620c902. Deploy lõppes 01:30 EEST; lokaalne/origin/server SHA ühtivad, teenused3/3 aktiivsed, HTTP200. Serveribuild PASS (34,1s), migratsioone ootel0. Säilitati eelmise väljalaske artefakt; eemaldati üks aegunud current-artefakt ja üks vana build-logi, mitte kasutajaandmeid. Recovery sõltumatu read-only ülevaatus ei leidnud blokeerivat viga.

| R4 juhtum | Hinnang | Täisvastus/allikapaneel | Märkus |
|---|---|---|---|
| r4-iso-J05 | PASS | [täisvastus](../docs/audits/evidence/rag-loop-2026-08-31-e620c902/r4-iso-J05.md) | Umbes30/12 ja60/19; õige allikas. |
| r4-iso-J08 | PASS | [täisvastus](../docs/audits/evidence/rag-loop-2026-08-31-e620c902/r4-iso-J08.md) | 61/26/11/18 õiges seoses; õige allikas. |
| r4-iso-J11 | FAIL | [täisvastus](../docs/audits/evidence/rag-loop-2026-08-31-e620c902/r4-iso-J11.md) | requested_metric_relation_mismatch; allikaid0. |
| r4-iso-J18 | PASS | [täisvastus](../docs/audits/evidence/rag-loop-2026-08-31-e620c902/r4-iso-J18.md) | 5 igas kolmes rühmas, kokku15; õige allikas. |
| r4-iso-V05 | PASS | [täisvastus](../docs/audits/evidence/rag-loop-2026-08-31-e620c902/r4-iso-V05.md) | Kuus kuud; osaleja ja tööandja; õige allikas. |
| r4-seq-J05 | PASS | [täisvastus](../docs/audits/evidence/rag-loop-2026-08-31-e620c902/r4-seq-J05.md) | Umbes30/12 ja60/19; õige allikas. |
| r4-seq-J08 | PASS | [täisvastus](../docs/audits/evidence/rag-loop-2026-08-31-e620c902/r4-seq-J08.md) | 61/26/11/18 õiges seoses; õige allikas. |
| r4-seq-J11 | FAIL | [täisvastus](../docs/audits/evidence/rag-loop-2026-08-31-e620c902/r4-seq-J11.md) | unexpected_numeric_claim; taastamine ei läbinud. |
| r4-seq-J18 | PASS | [täisvastus](../docs/audits/evidence/rag-loop-2026-08-31-e620c902/r4-seq-J18.md) | 5 igas kolmes rühmas, kokku15; õige allikas. |
| r4-seq-V05 | PASS | [täisvastus](../docs/audits/evidence/rag-loop-2026-08-31-e620c902/r4-seq-V05.md) | Kuus kuud; osaleja ja tööandja; õige allikas. |

Ring4: isolated **4 PASS / 1 FAIL**, sequential **4 PASS / 1 FAIL**. J08 paranes mõlemas, J11 on endiselt FAIL; režiimide vahel sellel ringil erinevust ei ilmnenud. Ühe jooksupaari põhjal ei järeldata üldist järjekorrasõltumatust.

R3 Golden-integreeritud teenuste algne PASS oli ainult vastuse säilimise/paneelis nimetatud allikate kontroll. Täisteksti ja renderdatud katke sõltumatu järelkontroll korrigeerib koondhinnangu **PARTIAL**-iks: psühhoosi näite inline-viide oli ebatäpne, rehabilitatsiooniteenuse väide üldistus teenusteks ning üks SÜTIKu allikakatke oli sisukord. Algne vastus on säilitatud; hinnangu muutmise alus on samas tõendifailis.

### Ring 5 — validaatorite tööjaotus ja sisulise tõendi piir

J11 taastamisprobleem on reprodutseeritud tegeliku avaliku täisteksti ning R4 morfoloogiaslottidega. 7/6/1 ja meetod on renderdatud lepingus täielikult seotud. Taastatud „Intervjuud tehti:7 / Individuaalvestlused:6 / Ruhmavestlused:1 / temaatiline analüüs” läbis tugevama slotilepingu, kuid vana sõnamustripõhine kategooriaparser andis unsupported_numeric_category_relation. Täieliku sama allika count/proportion-slotilepingu korral ei kontrollita sama kategooriat teise nõrgema parseriga uuesti; kõik arvude, kvalifikaatorite, aasta, üldkogumi ja allikakatte väravad jäävad kehtima. Sõltumatu päristäisteksti kontroll kinnitab nüüd sama rekonstrueeritud vastuse PASS-i. See pole veel UI tõend.

Relation-mismatch'i puhul võib allikapõhine taastamine rakenduda vaid kõigi õigete küsitud väärtuste ja protsendiliikide olemasolul; mudeli vigast teksti ei aktsepteerita, vaid ehitatakse uus ja täielikult kontrollitav vastus. Piir jääb nähtavaks: kui üks kvalitatiivne vastuseüksus sisaldab ka kõiki kõrvalarve, võib kordusvalideerimine endiselt taastamise blokeerida; selle kuju üldist parandatust ei väideta.

Golden-i sisukorrakatke eemaldatakse ajakirjaallika ja kombineeritud kaane/sisukorra tunnuste alusel enne grupeerimist ning konteksti koostamist. Sama dokumendi päris sisulõigud säilivad. Allikaatributsioon ei luba sisukorral kinnitada väidet ka täpse pealkirja mainimisel. Sünteesijuhis säilitab teenuse/sihtrühma/aja ning seob iga näite oma allikaga. Registrit, ingest'i ja indeksit ei muudeta.

Viienda ploki kitsad testid: 14 faktilepingu testi ja 10 allika-/sisukorratesti PASS. Read-only ülevaatus leidis autorite inventari kõrvalmõju; paranduses säilib metadata ning bibliograafiline väide, kuid lisatud sisuväide ei pääse sellest erandist läbi. Eraldi sihtkontroll kinnitas ka aastaga bibliograafilise kirje säilimise. ESLint/i18n/diff-check PASS ja lõpliku rakenduskoodipuu TZ=UTC tootmisbuild PASS (35,2s). Uus serveri UI-kordus järgneb.

### Ring 5 — in-app isolated ja sequential

Release34339acb. Deploy lõppes01:48 EEST, serveribuild PASS32,8s, migratsioone ootel0. Lokaalne/origin/server SHA ühtivad; pärast deploy lõppu teenused3/3 aktiivsed ja HTTP200. Hooldusvärava ajal vaadeldud ajutine HTTP502 lõppes teenuste käivitumisel. Eelmine artefakt säilib; koristas ainult ühe vana current-artefakti ja build-logi.

| R5 juhtum | Hinnang | Täisvastus/allikapaneel | Märkus |
|---|---|---|---|
| r5-iso-J05 | PASS | [täisvastus](../docs/audits/evidence/rag-loop-2026-08-31-34339acb/r5-iso-J05.md) | Umbes30/12 ja60/19; õige allikas. |
| r5-iso-J08 | PASS | [täisvastus](../docs/audits/evidence/rag-loop-2026-08-31-34339acb/r5-iso-J08.md) | 61/26/11/18 õiges seoses; õige allikas. |
| r5-iso-J11 | PASS | [täisvastus](../docs/audits/evidence/rag-loop-2026-08-31-34339acb/r5-iso-J11.md) | 7/6/1 ja kolmeetapiline temaatiline analüüs; taastatud ning uuesti valideeritud; õige allikas. |
| r5-iso-J18 | PASS | [täisvastus](../docs/audits/evidence/rag-loop-2026-08-31-34339acb/r5-iso-J18.md) | 5 igas kolmes rühmas, kokku15; õige allikas. |
| r5-iso-V05 | PASS | [täisvastus](../docs/audits/evidence/rag-loop-2026-08-31-34339acb/r5-iso-V05.md) | Kuus kuud; osaleja ja tööandja; õige allikas. |
| r5-seq-J05 | PASS | [täisvastus](../docs/audits/evidence/rag-loop-2026-08-31-34339acb/r5-seq-J05.md) | Umbes30/12 ja60/19; allikapõhiselt taastatud; õige allikas. |
| r5-seq-J08 | PASS | [täisvastus](../docs/audits/evidence/rag-loop-2026-08-31-34339acb/r5-seq-J08.md) | 61/26/11/18 õiges seoses; õige allikas. |
| r5-seq-J11 | PASS | [täisvastus](../docs/audits/evidence/rag-loop-2026-08-31-34339acb/r5-seq-J11.md) | 7/6/1 ja kolmeetapiline temaatiline analüüs; taastatud; õige allikas. |
| r5-seq-J18 | PASS | [täisvastus](../docs/audits/evidence/rag-loop-2026-08-31-34339acb/r5-seq-J18.md) | 5 igas kolmes rühmas, kokku15; õige allikas. |
| r5-seq-V05 | PASS | [täisvastus](../docs/audits/evidence/rag-loop-2026-08-31-34339acb/r5-seq-V05.md) | Kuus kuud; osaleja ja tööandja; õige allikas. |

Ring5 viie algselt vigase 75-auditi juhtumi tulemus: **isolated 5 PASS / 0 PARTIAL / 0 FAIL; sequential 5 PASS / 0 PARTIAL / 0 FAIL**. Samad küsimused ja vastuvõtukriteeriumid. J11 allikapõhine taastamine läbis mõlemas; lõppvastuse sisu ja avatud paneel kontrollitud. Nende viie puhul selles paaris järjekorrast erinevust ei ilmnenud. See ei ole kogu75 ega Golden37 läbimise tõend.

### Ring 5 — eraldi Golden-järelkontrollid ja regressioonid

Järgnevad lisakontrollid ei muuda viie juhtumi ega 75 küsimuse nimetajat. Iga vastus salvestatakse enne järgmist küsimust.

| R5 lisajuhtum | Hinnang | Tõend / põhjus |
|---|---|---|
| r5-golden-integrated | PARTIAL | [Vastus](../docs/audits/evidence/rag-loop-2026-08-31-34339acb/r5-golden-integrated.md). Sisuline süntees, kuid seitsmes allikas oli kirjastuse tellimisreklaam; teenusepakkuja valiku reegel jäi teenuse liigiga piiramata. R6 käsitleb neid põhjuseid. |
| r5-golden-child | PARTIAL | [Vastus](../docs/audits/evidence/rag-loop-2026-08-31-34339acb/r5-golden-child.md). Sisuline vastus katab hindamise etapid ja lisamudeli. Nelja paneeliallika vajadus pole tõendatud: Pindi kaheksa aspekti dubleerub Lauri artiklis; vanemate allikate ainulaadne panus põhijuhendile NOT_PROVEN. |
| r5-golden-cyber | PASS | [Vastus](../docs/audits/evidence/rag-loop-2026-08-31-34339acb/r5-golden-cyber.md). Sisuline ohutust arvestav juhis; üks vastust toetav ametlik allikas, kõrvalisi paneeliallikaid ei olnud. |
| r5-reg-J09 | PASS | [Vastus](../docs/audits/evidence/rag-loop-2026-08-31-34339acb/r5-reg-J09.md). Koolikiusamine33/13 ja küberkiusamine19/7; õige vanus/scope/allikas. |
| r5-reg-J14 | PARTIAL | [Vastus](../docs/audits/evidence/rag-loop-2026-08-31-34339acb/r5-reg-J14.md). Arvud üle5800,90%,14,3 õiged; vastus kordab küsimuse „alla18”, algallikas „kuni18”. Vanuserühma täpsuse reservatsioon. |
| r5-reg-V04 | PASS | [Vastus](../docs/audits/evidence/rag-loop-2026-08-31-34339acb/r5-reg-V04.md). 10%=640,6%=227,2%=100; vastus parandab „helistajad” laiemaks allikapõhiseks pöördunute rühmaks. |
| r5-reg-M01 | FAIL | [Vastus](../docs/audits/evidence/rag-loop-2026-08-31-34339acb/r5-reg-M01.md). requested_fact_answer_incomplete; vastuse asemel tõendipiir, allikaid0. Renderdatud arvulepingus osalejate arv mitmetähenduslik; kvalitatiivne lõppvastuse katvus puudub. |
| r5-reg-M02 | PARTIAL | [Vastus](../docs/audits/evidence/rag-loop-2026-08-31-34339acb/r5-reg-M02.md). Kolm soovitust sisuliselt olemas; toetatud otsustamise konkreetne soovitus jääb üldiseks piirava eestkoste käsitluseks. |

Uued sõnastused on eraldi lisakomplekt: [r5-new-J09](../docs/audits/evidence/rag-loop-2026-08-31-34339acb/r5-new-J09.md) PASS, [r5-new-M01](../docs/audits/evidence/rag-loop-2026-08-31-34339acb/r5-new-M01.md) PASS. M01 uus sõnastus ei tühista originaali FAIL-i.

M01 read-only diagnoos: õige dokumendi identiteet high/matched; kontekst25→8 lõiku. Retrieval-coverage3/3 ei tõenda lõpplepingut. Osalejate arvuslotil19 kandidaati, kaks võrdse skooriga6.794 eri bodys, mapping0/1 ambiguous. Väärtused pole trace'is nähtavad: kordusfakti ja eri arvude konkurentsi ei saa eristada. Kvalitatiivne tõend2/2complete, aga lõppvastuse seoseid0 ja puuduvad slotid1/2. Ajasloti relation „tehti/tegema” ning sama vastuseüksuse source-anchor nõue on staatiline sõnastustundlikkuse kandidaat, mitte tõend taastamata mudelivastuse täpse sisu kohta.

### Ring 6 — reklaam ja metadata ei ole sünteesi sisutõend

R5 liigse allika juurpõhjus: omastehoolduse infopunkti metadataga katke oli kirjastuse tellimisreklaam. Sõna „koostöö” bodys ja „Sotsiaaltöö” ajakirjanimena andsid näiliselt ainulaadse toe lausele tervishoiu ja sotsiaaltöö koostööst. Kombineeritud publisher-tuvastus eemaldab selle katke; sünteesi/professionaalse meetodi ajakirjaallika claim-tugi kasutab bodyt, mitte metadata päist või pealkirjamainimist üksi. Päris infopunkti reklaamrubriigi sisu säilib. Puuduva teenuse-antecedendi jaoks lisati konservatiivne väljajätmise/ebakindluse juhis, mitte teenuseliigi oletamine.

11 allika-sihttesti PASS; ESLint/diff-check/i18n PASS; lõpliku rakenduskoodipuu TZ=UTC tootmisbuild PASS35,2s. Sõltumatu read-only ülevaatus ei leidnud blokeerivat regressiooni. Runtime järgneb. M01/M02 ja allikate semantilise dubleerimise üldprobleem ei ole selle plokiga lahendatuks kuulutatud.

### Ring 6 — viimane in-app kordus ja ajapiiriga töö lõpp

Runtime3b2ea8bb. Deploy02:04EEST: lokaalne/origin/server SHA kattusid, kolm teenust aktiivsed, HTTP200. Serveribuild PASS34,9s, ootel migratsioone0. Eelmine artefakt säilitati; eemaldati ainult üks aegunud current-artefakt ja üks vana build-logi. 02:10 tervisekontroll: RAG ok,49 727vektorit,6089registrikirjet,6073aktiivset dokumenti; mõlemad FTS-indeksid ready ja EstNLTK available. Indekseid ega korpust selle plokiga ei muudetud.

| Viimane juhtum | Hinnang | Tõend / märkus |
|---|---|---|
| r6-iso-J05 | PASS | [Täisvastus ja paneel](../docs/audits/evidence/rag-loop-2026-08-31-3b2ea8bb/r6-iso-J05.md). Kõik küsitud faktid ja õige paneeliallikas. |
| r6-iso-J08 | PASS | [Täisvastus ja paneel](../docs/audits/evidence/rag-loop-2026-08-31-3b2ea8bb/r6-iso-J08.md). Kõik küsitud faktid ja õige paneeliallikas. |
| r6-iso-J11 | PASS | [Täisvastus ja paneel](../docs/audits/evidence/rag-loop-2026-08-31-3b2ea8bb/r6-iso-J11.md). Kõik küsitud faktid ja õige paneeliallikas. |
| r6-iso-J18 | PASS | [Täisvastus ja paneel](../docs/audits/evidence/rag-loop-2026-08-31-3b2ea8bb/r6-iso-J18.md). Kõik küsitud faktid ja õige paneeliallikas. |
| r6-iso-V05 | PASS | [Täisvastus ja paneel](../docs/audits/evidence/rag-loop-2026-08-31-3b2ea8bb/r6-iso-V05.md). Kõik küsitud faktid ja õige paneeliallikas. |
| r6-seq-J05 | PASS | [Täisvastus ja paneel](../docs/audits/evidence/rag-loop-2026-08-31-3b2ea8bb/r6-seq-J05.md). Kõik küsitud faktid ja õige paneeliallikas. |
| r6-seq-J08 | PASS | [Täisvastus ja paneel](../docs/audits/evidence/rag-loop-2026-08-31-3b2ea8bb/r6-seq-J08.md). Kõik küsitud faktid ja õige paneeliallikas. |
| r6-seq-J11 | PASS | [Täisvastus ja paneel](../docs/audits/evidence/rag-loop-2026-08-31-3b2ea8bb/r6-seq-J11.md). Kõik küsitud faktid ja õige paneeliallikas. |
| r6-seq-J18 | PASS | [Täisvastus ja paneel](../docs/audits/evidence/rag-loop-2026-08-31-3b2ea8bb/r6-seq-J18.md). Kõik küsitud faktid ja õige paneeliallikas. |
| r6-seq-V05 | PASS | [Täisvastus ja paneel](../docs/audits/evidence/rag-loop-2026-08-31-3b2ea8bb/r6-seq-V05.md). Kõik küsitud faktid ja õige paneeliallikas. |
| r6-golden-integrated | PARTIAL | [Täisvastus ja paneel](../docs/audits/evidence/rag-loop-2026-08-31-3b2ea8bb/r6-golden-integrated.md). Viis nimetatud allikat, reklaam puudub; rehabilitatsiooni reegel omistatud erihoolekandele. |
| r6-golden-child | PARTIAL | [Täisvastus ja paneel](../docs/audits/evidence/rag-loop-2026-08-31-3b2ea8bb/r6-golden-child.md). Sisuline hindamisprotsess ja lisamudel; nelja allika ainulaadne vajadus NOT_PROVEN. |
| r6-golden-cyber | PASS | [Täisvastus ja paneel](../docs/audits/evidence/rag-loop-2026-08-31-3b2ea8bb/r6-golden-cyber.md). Üks toetav ametlik allikas, ohutust arvestav turvaplaan. |
| r6-extra-iso-M01 | FAIL | [Täisvastus ja paneel](../docs/audits/evidence/rag-loop-2026-08-31-3b2ea8bb/r6-extra-iso-M01.md). Algne M01 jääb tõendipiirangu vastuseks, allikaid0. |
| r6-extra-seq-M01 | FAIL | [Täisvastus ja paneel](../docs/audits/evidence/rag-loop-2026-08-31-3b2ea8bb/r6-extra-seq-M01.md). Algne M01 jääb ka viie põhiküsimuse järel tõendipiiranguks, allikaid0. |
| r6-extra-iso-M02 | PARTIAL | [Täisvastus ja paneel](../docs/audits/evidence/rag-loop-2026-08-31-3b2ea8bb/r6-extra-iso-M02.md). Kolm soovitust on sisulised; toetatud otsustamise soovitus asendub eestkoste probleemi ja puuduvate katkendite kirjeldusega. |
| r6-extra-seq-M02 | PASS | [Täisvastus ja paneel](../docs/audits/evidence/rag-loop-2026-08-31-3b2ea8bb/r6-extra-seq-M02.md). Kõik neli küsitud soovitust on sisuliselt olemas, sealhulgas üleminek asendatud otsustamiselt toetatud otsustamisele. Täpse rakendusmudeli lisapiirang ei eemalda küsitud põhisoovitust. |

Põhiviisik J05/J08/J11/J18/V05: **isolated5/5PASS, sequential5/5PASS**. Järjestikune põhiviisik küsiti ühes värskes vestluses; M01/M02 lisati selle järel samasse vestlusse ja seejärel küsiti kumbki eraldi värskes vestluses. Põhiviisiku nimetaja jääb5; aruande lisakomplekt2 ja Golden-lisakomplekt3 on eraldi.

| Parandus-/deployring | Põhiviisik eraldi PASS | Põhiviisik järjest PASS |
|---|---:|---:|
| R1 | 2/5 | 2/5 |
| R2 | 3/5 | 4/5 |
| R3 | 3/5 | 3/5 |
| R4 | 4/5 | 4/5 |
| R5 | 5/5 | 5/5 |
| R6 | 5/5 | 5/5 |

**Järjekorravõrdlus:** põhiviisikul viimases kahes ringis erinevust ei olnud. M01 on viimases paaris FAIL mõlemas. M02 on eraldi PARTIAL, järjest PASS. Mõlema M02 renderdatud RAG-konteksti räsi on täpselt sama:4a16a4904dfe4ac8847951378c33e42e6af8ddccb9e1c29e2c4ec63256c51ce5. Seega erinevus ei tule selles paaris teistsugusest valitud RAG-tekstist. Ajaloo mõju ja genereerimise sõnastushajuvus ei ole ühe paari põhjal eristatud. Kvalitatiivne production-värav on mõlemal not_run; järjestikune PASS ei tähenda selle koodivea parandatust.

**Lahtised juurpõhjused ja järgmise paranduse piirid (automaatselt ei jätkata):**

1. M01: kindel arvulepingu mitmetähenduslikkus ja kvalitatiivse vastuse sidumise läbikukkumine. Vajab lõpplepingu konkureerivate kandidaatide väärtuse/seose eristust ja sisulist ajameetodi sidumist, mitte valideerimisest möödumist. Uus sama dokumendi sõnastus läbis, algne küsimus ei läbinud.
2. M02: source-contract4/4complete ei ole vastuse valideerimise käivitustõend. Slot4 kasutab slot1-ga sama fragmendihashi/index4 ning relation1/2. Kahe termini korral lubatud üksik vaste võib jätta „otsustamise” pea tõendamata. shouldValidateExactFactAnswer käivitus ei toetu valmis kvalitatiivlepingule, vaid planneri kindlasse pessa jõudnud slottidele. Järgmine fix vajab nii eristavat recommendation-objekti kui ka kvalitatiivlepingu dispatch'i sihttesti. Täpset runtime'i vale ankrusõna ei avaldata trace'is, seda ei oletata tõeks.
3. Integreeritud teenused: kirjastusreklaami väär allikatugi on kõrvaldatud, kuid teenuse antecedent ei säili. Algallikas18-2/155619664557_Sotsiaaltoo_nr2_2018_veebi_link_Part6.txt seob eelarve/valiku lause rehabilitatsiooniteenusega. R6 renderbody374→192märki algab span0-st, seega „taasta kärbitud algus” ei ole tõendatud fix. original_body_hash mõõdetakse pärast rankBodies/prioritizeBodyPassage tööd, mitte rawretrievali pealt. Vajalik on sama päris pre/post-prioritize body võrdlus; pimedat ingest'i või kontekstieelarve muutust ei tehtud.
4. Lapse heaolu: põhisisu on lai ja mitmeetapiline; allikate semantilise dubleerimise vähendamine pole täielik. Pindi kaheksa aspekti on ka Lauri artiklis; mõlema vanema artikli ainulaadne panus põhijuhendile pole tõendatud. Leksikaalne claim-cover ei ole semantilise kasutuse garantii.
5. J14: arvud õiged, aga küsimuse „alla18” jäi algallika „kuni18” asemel muutmata. See on eraldi ulatuse täpsuse reservatsioon.

**Hinnang:** viimase17vastuse proovikomplektis12PASS/3PARTIAL/2FAIL. Läbipaistva lihtsustatud arvutusega PASS=1,PARTIAL=0,5,FAIL=0 annab see13,5/17 ehk umbes **8/10**. See on kordusvastuste proovikomplekti orientiir, mitte kogu75 benchmark ega kogu RAG-i usaldusväärsuse tõestatud skoor. 75täisväravat ja Golden37täiskomplekti selle kahe tunni sees ei korratud. 10/10 ja „kõik parandatud” oleksid valed väited. Arvulise taastamise keeleline kuju on kohati kohmakas, kuigi küsitud faktid on õiged.

Kokkulepitud piir:31.08.2026kell02:15Europe/Tallinn või kasutuslimiit varem. Töö suletakse selle piiri sees; tulemused ja diagnoos säilivad. Ajastatud jätk on PAUSED, limiidi taastumisel ega hommikul automaatselt ei jätkata. Edasine parandusring vajab omaniku uut korraldust.

## 31.08.2026 — omaniku uus korraldus: 3 PARTIAL ja 2 FAIL põhjuseparandus

See on uus käsitsi tellitud töö, mitte öise ajapiiriga tsükli automaatne jätk. Tööpuu `SotsiaalAI-repair-a`, haru `codex/repair-a`, lähte-SHA `e250d3b83360d4d66d4d64d067f8e0277a57b264`. Paranduskood ja allolevad kontrollid ei kirjuta vanu vastuseid ega hindeid ümber. Viis mitte-PASS tulemust on neli eri küsimust: M01 oli FAIL mõlemas režiimis.

| Juhtum | Enne | Tõendatud põhjus ja parandus | Tõendamise piir |
|---|---|---|---|
| M01 | isolated FAIL; sequential FAIL | Lõppjutumärk ei lõpetanud tõendifragmenti; metafoorne „üks number süsteemis” laenas järgmise lause osalemisseose ja konkureeris 42 inimesega. Jutumärgipiir on parandatud ilma kandidaadiskoori või ambiguity-läve muutmiseta. Meetodi üldsõna/eelmise lause sõna ja kuupäevata järeldus enam kvalitatiivset slotti ei täida. | Vana lõppkonteksti ja päris avalike chunk'ide puhas rekonstruktsioon; uut UI-vastust pole. |
| M02 | isolated PARTIAL; sequential PASS | Validaator luges kadunud ajutist plannerivälja, mitte kanoonilist semantilist lepingut. Nüüd käivitab ka valmis kvalitatiivleping kontrolli. „Toetatud otsustamine” nõuab mõlema seosesõna tõendit. Põhisoovitus eristub tulemuskõrvallausest, kuid küsitud teine objekt ja päris tegevus säilivad. | Täpse avaliku lk 53 soovitusega õige vastus läbib; keelav, eitav ja puuduva tegevusega vastus ei läbi. Uus production-dispatch on runtime'is kontrollimata. |
| Golden: integreeritud teenused | PARTIAL | Õige artikkel leiti, kuid eraldi valitud chunk algas juba üldviitega „Teenuse eelarvet…”; rehabilitatsiooni referent jäi teise chunk'i. Lisaks lõigati järgmise lõigu teenusenimi pooleks. Süntees ei kasuta enam lahendamata üldviitega katkendit ega pooleks lõigatud lauset; eelarve ei kasva. | See välistab konkreetse toetamata seose, mitte ei taasta puudunud eelarveväite naaber-chunk'i. Uus vastusesüntees on NOT_PROVEN. |
| Golden: lapse heaolu allikapaneel | PARTIAL | Põhijuhendi 55 toetatud väitest säilitati sisemiselt ainult esimesed 32; hilisemaid samu väiteid toetavad lisakirjed näisid seetõttu vajalikena. Sisemine kattegraaf kasutab kogu kuni 64 väite hulka; ainult otsuse diagnostika on 32 indeksiga piiratud. | Pikavastuse test tõendab hilise dubleeriva allika eemaldamist ja päriselt erineva meetodiallika säilimist; uue UI-paneeli täpne valik on NOT_PROVEN. |

### Täpse rekonstruktsiooni täiendused

- Aluseks jäid muutmata failid `docs/audits/evidence/rag-loop-2026-08-31-3b2ea8bb/r6-extra-iso-M01.json`, `r6-extra-seq-M01.json`, `r6-extra-iso-M02.json`, `r6-extra-seq-M02.json`, `r6-golden-integrated.json` ja `r6-golden-child.json` ning sama nimega vastuse-MD-d.
- Avaliku EPIKoja dokumendi kaheksa serverichunk'i hashid kattusid M01 lõppkontekstiga. Algne rekonstruktsioon andis 31 arvukandidaati / 47 fragmenti / 19 sobivat kandidaati ja ambiguity: 42 skooriga 6,794 versus metafoorne 1 skooriga 6,506. Ainult jutumärgipiiri parandus eraldas järgmise lause ning 42 muutus üheselt seotuks; tegemist ei olnud tõendatud 42-versus-32 vastuoluga.
- Sama vana M01 kontekst ei kinnita enam ekslikult meetodit ja aega: katvus on 1/3, puuduvad nullpõhised slotiindeksid `[0,1]`. Need jõuavad olemasoleva lukustatud `doc_id` taastamisotsingu sisendisse. Puuduva aja päring saab tüübiankrud `läbiviimine/aeg/periood`; meetod `uurimismeetod/andmekogumine/andmeanalüüs`.
- Kui sama avaliku dokumendi tegelikud meetodi-/uuringuperioodi chunk'id lisada puhta abifunktsiooni sisendisse, tõstab kõigi slotide prioriseerija lk 6 tõendi ette ning seob kvalitatiivse uurimismeetodi, november 2025 – märts 2026 ja 42 inimese lepingud. Kõiki kolme osa sisaldav kontrollvastus läbib. See EI tõenda veel taastamisotsingu tegelikku serverileidmust ega mudeli uut vastust.
- Integreeritud teenuste artikli valitud raw-chunk'ide räsid `d6add75770bac38b3895cf154a788e5c3d046cc92de92385f78ceee252ef5616` ja `20f75c3b3f610baf937dc0a64c99b775201a3d0d8782b44b5cce8fd7751863c3` kattusid trace'i original-body-räsidega. `rankGroupsWithTopicHints` / `prioritizeBodyPassage` neid ei muutnud. Uus filter ja sama 389-märgine cap jätsid alles 352 märki kahe terviklausega; referendita eelarveväide ja poolik `Rehabilitatsioonit...` kadusid.

### Arenduskontrollid ja seis

- 32 sihttesti PASS: uus nelja veajuhtumi komplekt 11/11, allikakatte komplekt 12/12, kitsalt valitud olemasolevad M02/kuupäeva/runtime-seose regressioonid 9/9. Kontrollid sisaldavad ka valesid vastuseid: poolik/ümberpööratud ajavahemik, teine kuupäev, puuduv soovitusobjekt, tegevuse eitus ja inversioon.
- Muudetud JS/MJS failide ESLint: PASS. `TZ=UTC` oli sihttestidel määratud. Lai testisviit, 75 küsimust ega Golden37 tervikkomplekt ei käivitunud.
- Tootmisbuild: PASS (Next.js 16.2.10, kompileerimine 45 s, 70/70 staatilist lehte); `i18n:check` PASS. Kasutati sama projekti olemasolevat konfiguratsiooni ainult build-protsessis, keskkonnafaile ei kopeeritud. Build hoiatas kohaliku e-posti transpordi puudumisest; päris kirju ei saadetud. `git diff --check`: PASS pärast dokumentatsiooni uuendust.
- Arhitektuurikaart `docs/audits/rag-susteem-master.md` ja ainus elav seis `docs/platvormi arendus/SotsiaalAI.md` on samas parandustööpuus uuendatud. S11 vananenud automaattestikeeld ühtlustati kehtiva AGENTS.md vajalike sihttestide reegliga.
- Commit, integratsioon `main`-i, push, deploy ja uued in-app küsimused: selles ülesandes tegemata. Varasemad FAIL/PARTIAL hinded säilivad kuni sama küsimuse ja režiimi uue vastuseni. Järgmine värav pärast omaniku luba: neli juhtumit esmalt isolated, seejärel sequential ja paus.
- Vana ajastatud jätk jääb PAUSED. Uut automaatset tsüklit ega limiidijärgset jätkamist ei seatud. 12/3/2 on varasema 17 vastuse loendus, mitte kogu RAG-i või 75 küsimuse kvaliteediskoor.

### 31.08 — kahe Golden-juhtumi täpne lisakontroll ja lõppparandus

Omaniku uus fookus: integreeritud teenused ning lapse heaolu hindamine/allikapaneel. Uusi küsimusi ei saadetud; vana vastus ja hinnang jäid muutmata. Serverist loeti ainult nelja nimetatud avaliku allika katkeid; serveri koodi, korpust ega indekseid ei muudetud.

**Integreeritud teenused.** Täpse küsimuse „Mida kirjutab ajakiri Sotsiaaltöö integreeritud teenustest?” ja R6 trace'i kontroll kinnitas `overview_synthesis=true`, `thematic_synthesis=true`, `specific_research_fact=false`, seega päris RCA-rada annab `requireSelfContainedPassages=true`. Selle juhtumi pakett- ega ajaline järelvalik tulemust üle ei kirjuta. Eelmises jaotises räsiga kinnitatud üldviiteline eelarvekatke eemaldatakse ning eraldi erihoolekande/rehabilitatsiooni koostöö kirjeldus säilib. Guardi aktiveerimiseks uut koodi polnud vaja. See ei ole veel uus mudelivastus.

**Lapse heaolu.** Taastati kõik 13 R6 renderdatud body-katket neljast avalikust dokumendist: iga katke SHA-256 ja nelja allika ühendatud body-räsi kattusid vana trace'iga. Üheksa algkatket sobis pärast tavalist puhastamist, neli pärast sama küsimuse teemavihjetega `rankGroupsWithTopicHints` tööd. Vana vastuse 57 väite arvutus lähtekoodi `e250d3b8` all taastas täpselt 55/18/19/23 toetatud väite loendused, skoorid, nähtavad indeksid ja neli allikat.

Ainult sisemise 32-indeksi piiri eemaldamine jättis ekslikult alles üksnes põhijuhendi: üldine leksikaalne kattuvus luges ka nimelise „Turvalisuse märkide” mudeli väite käsiraamatuga kaetuks. Seetõttu lisati sünteesi-/meetodirežiimidesse eraldi täieliku nimelise fraasi body-ankur. Nime olemasolu ei või tulla metadata ega renderdatud päise pealt; PDF-i `„T urvalisuse märkide“` algustäheviga parandatakse ainult võrdlemiseks. Üldist hägust nimede võrdsustamist, küsimusepõhist erandit ega EstNLTK ümbertõstmist ei lisatud. Bibliograafia, default- ja õigusvastuse rajad säilitavad senise lepingu.

| Allikas | Vana arvutus | Lõplik parandatud arvutus samale vastusele |
|---|---|---|
| Lapse heaolu hindamise käsiraamat | 55 väidet; kuvatud | 54 väidet; kuvatud |
| Helen Altoni „Turvalisuse märgid”, 2024 | 18 väidet; kuvatud | 18 väidet; kuvatud, nimelise mudeli eristuv tugi säilib |
| Sirje Pindi artikkel, 2016 | 19 väidet; kuvatud | 19 väidet; peidetud `claim_support_subsumed` |
| Kadi Lauri artikkel, 2017 | 23 väidet; kuvatud | 23 väidet; peidetud `claim_support_subsumed` |

Masinloetav enne/pärast tõend: [r6-golden-child-source-cover-replay.json](../docs/audits/evidence/rag-loop-2026-08-31-3b2ea8bb/r6-golden-child-source-cover-replay.json). See on täpselt sama vana vastuse allikakatte puhas kordusarvutus, mitte uus genereeritud vastus ega allikapaneeli UI-test. Kaks allesjäänud allikat on selle konkreetse tõendi tulemus, mitte koodi sisse kirjutatud allikate arv. Üldine semantiline entailment, jutumärkideta mudelinimed ning kõik eesti käände-/astmevaheldusvormid ei ole selle kitsendusega tõendatud.

**Kontrollid:** lõpliku täienduse allikakatte sihttestid 16/16 PASS; kaks muudetud JS/MJS faili ESLint PASS; `TZ=UTC`. Testid katavad pika vastuse hilise dubleerimise, erimeetodi säilimise, PDF-i lahutatud algustähe, vale mudelinime, hajutatud sõnad, ainult metadata/päise vaste, arvulise tõendi ja puhta autori-bibliograafia säilimise. Uue lõpliku koodipuu üks tootmisbuild PASS (Next.js 16.2.10, kompileerimine 32,7 s, 70/70 staatilist lehte); `i18n:check` PASS. Kohaliku e-posti transpordi hoiatused ei takistanud buildi; kirju ei saadetud. Varasema paranduse teisi juba rohelisi sihtteste ega 75/37 tervikkomplekti ei korratud.

**Üleandmispiir:** muudatused on parandustööpuus, commit/main-integratsioon/push/deploy tegemata. Mõlema Golden-juhtumi runtime-hinnang jääb PARTIAL kuni uue autentitud in-app vastuse ja allikapaneeli kontrollini. Ajastatud jätk on endiselt PAUSED.

## 31.08.2026 — väljalase 95104077 ja omaniku tellitud kordus

Eelmise jaotise üleandmispiir kirjeldab parandamise lõpuhetke. Omaniku järgnev „jah” andis commit/main/GitHub/serveri loa; pärast seda tellis omanik ka kõigi selle väljalaske paranduste läbiküsimise.

**Väljalase:** `951040777d9272e0660cbc319aabc83dd872cfad` — 13 nimeliselt stage'itud faili, neist seitse vestluse RAG-runtime'i faili. Parandusharu integreeriti fast-forward'iga `main`-i, push õnnestus ning sama SHA mõõdeti serveris. Kasutaja `eval/parandused.md` ja `eval/RAG parandused.docx` jäid lokaalselt untracked ja puutumata. Sõltuvus-, skeemi-, migratsiooni-, Python-RAG-, ingest- ega indekseerimismuudatust selles koodiplokis ei ole.

**Serveri värav:** olemasolev deploy-loogika käivitati ajutise systemd-teenusena, et SSH katkemine protsessi ei katkestaks. Linuxi tootmisbuild läbis (kompileerimine 30,8 s; 70/70 lehte), `i18n:check` läbis ja migratsiooni-eelkontrolli `pending=[]`; migratsioone ei rakendatud. Frontend käivitus 31.08 kell 10:53:09 EEST uue buildiga `Nw987pQTQN9JvZXpZbLrt`. Frontend, RAG ja research-worker olid aktiivsed; kohalik ja avalik `/vestlus` tagastasid 200. Käivitusjärgses kontrollitud aknas nende kolme teenuse error-tasemel journal oli tühi. Deploy uuendas olemasoleva standardkorra järgi ka frontend'i materials-storage drop-in'i; ajastajaid ei aktiveeritud.

**RAG tervis:** `ok=true`, 49 727 vektorit, 6089 registridokumenti; algvormi- ja lemma-FTS mõlemad `ready=true`, 6073 aktiivset dokumenti ning 49 727 lõiku, oodatud ja tegelik indeksipõlvkond kattusid. Lemmaindeksi analüsaatoriversioon on `estnltk-vabamorf-1.7.5-v2`; eraldi analüsaatori laisk laadimine oli veel `load_attempted=false`, mistõttu tervisearuanne ei tõenda uut päringupõhist morfoanalüüsi.

**Deploy tehniline reservatsioon:** ajutise käivituse Bash-massiivipikkuse kontrollid andsid kolm `integer expression expected` hoiatust. Serveri untracked-seis oli enne käivitust eraldi puhtaks mõõdetud ning lõpus jäi tööpuu puhtaks. Vana arhiivi/logi kärpimine ei käivitunud; kontrollimisel säilisid uus ja eelmine current-artifact, deploy-eelne rollback-artifact ning kaks build-logi. Täiendavat kustutamist ei tehtud. Deploy protsess lõpetas edukalt ja uut teenuseversiooni kontrolliti eraldi; hoiatus ei ole varjatud üldise PASS-väite taha.

### Kordusplaan — 8/8 lõpetatud; 3 PASS / 3 PARTIAL / 2 FAIL

Järjekord on mõlemas ringis sama. `isolated`: iga küsimus uues tühjas vestluses. `sequential`: kõik neli samas uues vestluses. Pärast kaheksat vastust paus; kogu 75 ega 37 küsimuse täisjooksu automaatselt ei alustata. Kui sisuline läbikukkumine kordub, salvestatakse tulemus ja põhjus; hinnet ei muudeta ootuspäraseks ega tehta varjatud lisakatseid.

| Juhtum | Isolated | Sequential | Vastuvõtukriteerium |
|---|---|---|---|
| M01 | PASS — 11:12 EEST | PASS — 11:22 EEST | Õige EPIKoja dokument; uurimismeetod, tegelik uuringuperiood ja 42 osalejat on kõik tõendiga seotud. |
| M02 | FAIL — 11:15 EEST | FAIL — 11:23 EEST | Kõik neli küsitud soovitussuhet on kaetud; toetatud otsustamine ei asendu probleemi või puuduva tõendi kirjeldusega. |
| Golden: integreeritud teenused | PARTIAL — 11:16 EEST | PARTIAL — 11:23 EEST | Sisuline süntees ilma teenuseliikide reeglite segamiseta; iga nimetatud allikas toetab vastavat väidet. |
| Golden: lapse heaolu | PARTIAL — 11:18 EEST | PASS — 11:24 EEST | Mitmeetapiline hindamine ja asjakohased täiendavad mudelid; allikapaneel säilitab eristuva toe, kuid mitte pelgalt dubleerivat tausta. Allikate arv pole ette määratud. |

Täpsed kordusküsimused:

1. M01: EPIKoja aruandes „Täisealiste psüühikahäirega inimeste, sh eestkostetavate uuring” millist meetodit kasutati, millal uuring tehti ja kui palju inimesi osales?
2. M02: EPIKoja aruandes „Täisealiste psüühikahäirega inimeste, sh eestkostetavate uuring” milline soovitus anti Tallinnale kontaktisiku või juhtumikorralduse kohta, milline ennetava abi kohta, milline teenustele pääsu ja korduvate hindamiste kohta ning milline toetatud otsustamise kohta?
3. Golden: Mida kirjutab ajakiri Sotsiaaltöö integreeritud teenustest?
4. Golden: Kuidas hinnata lapse heaolu ja abivajadust?

Kõik kaheksa tellitud in-app vastust on saadud. Järgnenud diagnoosis taastati autoriteetsest püsikirjest kõigi kaheksa vastuse täpne tekst ja paaristatud `rag_trace`; allpool toodud tekstid pärinevad nüüd `ConversationMessage.content` väljast, mitte varasemast ümberjutustusest. Iga vastuse juures on link täisteksti, kuvatud allikate ja jälje JSON-ile. Varasem märge „trace UI-s NOT_PROVEN” kirjeldab brauserivaatluse hetke; serverijäljed on nüüd olemas [diagnoosi tõendiarhiivis](../docs/audits/evidence/rag-retest-2026-08-31-95104077/diagnosis.md). Välist brauserit ega API kaudu uusi küsimusi ei kasutatud. Värske testitulemuse nimetaja on 8/8; vanu 75/37 hindeid ei kirjutata ümber.

### 31.08.2026 — autentitud in-app korduse jooksvad tulemused

#### I1 — M01 — PASS (11:12 EEST)

**Küsimus:** EPIKoja aruandes „Täisealiste psüühikahäirega inimeste, sh eestkostetavate uuring” millist meetodit kasutati, millal uuring tehti ja kui palju inimesi osales?

**Vastus (täpne salvestatud tekst):**

1. Meetodit kasutati: kvalitatiivset uurimismeetodit; andmeid koguti poolstruktureeritud individuaal- ja grupiintervjuude ning kirjalike vastuste kaudu.

2. Uuring tehti: novembrist 2025 kuni märtsini 2026.

3. Inimesi osales: kokku saadi 42 inimese tagasiside.

[Täisvastus, kuvatud allikad ja paaristatud serverijälg](../docs/audits/evidence/rag-retest-2026-08-31-95104077/isolated-M01.json).

**Avatud allikapaneel:** Kristi Rekand, 2026. *Täisealiste psüühikahäirega inimeste, sh eestkostetavate uuringu kokkuvõte* · lk 1–11, 14, 29, 33, 35, 37, 43.

**Hinnang:** PASS. Kõik kolm küsitud fakti on olemas ning nähtav allikas on sama EPIKoja uuringu kokkuvõte. Enne järgmist küsimust avati allikapaneel; per-request RAG-trace UI-s ei ole nähtav, seega trace **NOT_PROVEN**. Runtime'i väljalase oli enne seda vastust serveris kontrollitud `95104077`.

#### I2 — M02 — FAIL (11:15 EEST)

**Küsimus:** EPIKoja aruandes „Täisealiste psüühikahäirega inimeste, sh eestkostetavate uuring” milline soovitus anti Tallinnale kontaktisiku või juhtumikorralduse kohta, milline ennetava abi kohta, milline teenustele pääsu ja korduvate hindamiste kohta ning milline toetatud otsustamise kohta?

**Vastus (täpne salvestatud tekst):**

Ma ei saa kõiki küsitud osi valitud allika põhjal piisavalt kindlalt kinnitada.

[Täisvastus, kuvatud allikad ja paaristatud serverijälg](../docs/audits/evidence/rag-retest-2026-08-31-95104077/isolated-M02.json).

**Allikapaneel:** puudus — vastuse juures ei kuvata nuppu „Vastuste allikad”.

**Hinnang:** FAIL. Vastus ei kata ühtegi neljast küsitud soovitusest, ei selgita, milline osa ei olnud toetatud, ega kuva allikat. See on runtime'i tulemus, mitte eelmise staatilise paranduse ümberhindamine. Per-request trace on UI-s nähtamatu (**NOT_PROVEN**); runtime'i väljalase oli enne seda vastust serveris kontrollitud `95104077`.

#### I3 — Golden: integreeritud teenused — PARTIAL (11:16 EEST)

**Küsimus:** Mida kirjutab ajakiri Sotsiaaltöö integreeritud teenustest?

**Vastus (täpne salvestatud tekst):**

Ajakiri Sotsiaaltöö käsitleb integreeritud teenuseid eelkõige inimesekeskse korraldusena, kus inimene või pere ei pea vajaliku abi saamiseks eri asutuste vahel ise orienteeruma. Olulised märksõnad on valdkondadeülene koostöö, ühine juhtumikorraldus, andmete parem kasutamine ja teenuste mõju hindamine.

Peamised rõhuasetused:

- Erivajadusega lapsed ja nende pered. Artiklis „Integreeritud tugiteenused lastele – esimene tagasiside pilootprojektile“ kirjeldatakse Sotsiaalministeeriumi, Haridus- ja Teadusministeeriumi, SA Innove ning Sotsiaalkindlustusameti koostööd, mille eesmärk oli aidata lapsel ja perel jõuda vajalike teenusteni kiiremini ja mugavamalt. Fookus oli eri valdkondade toe sidumisel ühe lapse ja pere vajaduste ümber.

- Võrgustikutöö lapse heaolu tagamisel. Artiklis „Integreeritud teenused – kellele ja milleks?“ rõhutatakse, et pikaajalist tuge vajava lapse puhul tuleb teha koostööd mitmel asutusel. See tähendab, et sotsiaal-, haridus-, tervise- ja lastekaitsevaldkond ei peaks tegutsema eraldi, vaid jagama vastutust lapse heaolu eest õiguslikult lubatud ja põhjendatud viisil.

- Inimesekesksus teenusekorralduse lähtekohana. Artiklis „Teekond inimesekeskse teenusepakkumise suunas“ tõstatatakse küsimused, kuidas suunata ressursse tõhusamalt, kasutada andmeid paremini, mõõta integreeritud teenuste mõju ning kujundada teenuseosutajatele motivatsiooni koostööks. Rõhk on sellel, et teenuseid ei korraldataks asutuste tööloogika, vaid inimese tegeliku vajaduse järgi.

- Hooldusvajadusega inimesed ja kohalik tasand. 2018. aasta käsitluses „Sotsiaalministeerium: kitsaskohad on meile teada, otsime aktiivselt toimivaid lahendusi“ kirjeldatakse hoolduskoordinatsiooni mudeli katsetamist kuue omavalitsusega. Selle mõte oli siduda tervise-, sotsiaal- ja töövaldkonna abi ning pakkuda suure ja keerulise hooldusvajadusega inimesele tugevamat tuge kodu lähedal. Mudelis kavandati omavalitsusse hoolduskoordinaatori roll.

Kokkuvõttes kujutab ajakiri integreeritud teenuseid mitte ühe uue teenusena, vaid koostöömudelina. Riiklikul tasandil tähendab see eri valdkondade ühiseid lahendusi ja pilootprojekte, kohaliku omavalitsuse tasandil abi koordineerimist ning inimese tasandil ühtsemat teekonda vajaliku toeni. Need käsitlused pärinevad peamiselt aastatest 2018–2020 ega anna iseseisvalt ülevaadet praegu kehtivast korraldusest või teenuste tänasest kättesaadavusest.

[Täisvastus, kuvatud allikad ja paaristatud serverijälg](../docs/audits/evidence/rag-retest-2026-08-31-95104077/isolated-integrated.json).

**Avatud allikapaneel:**

1. Alice Juurik, 2019. *Integreeritud teenused – kellele ja milleks?* · Sotsiaaltöö 3/2019 · lk 1, 3–4 · Tugi ja teenused.
2. Gerli Aavik, 2018. *Sotsiaalministeerium: kitsaskohad on meile teada, otsime aktiivselt toimivaid lahendusi* · Sotsiaaltöö 2/2018 · lk 1–2 · Kommentaar.
3. Gerli Aavik-Märtmaa, 2020. *Teekond inimesekeskse teenusepakkumise suunas* · Sotsiaaltöö 3/2020 · lk 1–2 · Sotsiaalpoliitika.
4. Eva Liina Kliiman, 2020. *Integreeritud tugiteenused lastele – esimene tagasiside pilootprojektile* · Sotsiaaltöö 3/2020 · lk 1–2 · Teenuste integratsioon.
5. Kairi Lõppe, 2018. *Hiiumaa: meretagune ühinemine tõi sotsiaaltöötajad kokku* · Sotsiaaltöö 3/2018 · lk 20–23 · Kohalik omavalitsus.

**Hinnang:** PARTIAL. Sisu on kasutuskõlblik ja eelmine rehabilitatsiooni/erihoolekande segiajamine puudub; vastus piiritleb õigesti ajaloolise käsitluse ega väida tänast teenusekorraldust. Kuid allikapaneelis on viis allikat, samal ajal kui vastus seob väited otseselt nelja nimetatud allikaga; Hiiumaa artikkel ei ole vastuses eristatavalt kasutatud. Seega tekstiosa on PASS, kuid paneeli minimaalse ja väitepõhise allikakatte nõue jääb **NOT_PROVEN**. Per-request trace on UI-s nähtamatu; runtime'i väljalase oli enne vastust serveris kontrollitud `95104077`.

#### I4 — Golden: lapse heaolu — PARTIAL (11:18 EEST)

**Küsimus:** Kuidas hinnata lapse heaolu ja abivajadust?

**Vastus (täpne salvestatud tekst):**

Lapse heaolu ja abivajadust hinnatakse lapsekeskselt, terviklikult ja järjepidevalt: esmalt hinnatakse lapse turvalisust ja arenguvajadusi, seejärel vanemluse ning pere ja keskkonna tegureid. Eesmärk on mõista, millised vajadused on rahuldamata, millised kaitse- ja riskitegurid olukorda mõjutavad ning milline abi toetaks lapse heaolu kõige tõhusamalt.

Lapse heaolu hindamise käsiraamatu (2025) järgi võib hindamise korraldada järgmiste etappidena.

1. Kohese turvalisuse hindamine

Kõigepealt tuleb selgitada, kas laps on hädaohus või kas tema elu, tervis ja turvalisus on vahetult ohustatud. Turvalisust tuleb jälgida kogu hindamisprotsessi vältel.

Kui lapsevanema tegevus või tegevusetus võib olla lapsele ohu allikas, võib põhjendatud juhul lapsega esmalt vestelda ilma vanemat teavitamata ja tema nõusolekuta. Pärast vestlust tuleb vanemat sellest viivitamata teavitada.

2. Eelhindamine

Abivajavast lapsest teate saamisel viib lastekaitsetöötaja läbi eelhindamise. Selle käigus selgitatakse muu hulgas:

- milles lapse võimalik abivajadus seisneb;
- kas lapse ja pere olukorda saab parandada ühe ühekordse meetmega;
- kas laps ja pere võtavad pakutava abi vastu;
- kas pere on valmis spetsialistidega koostööd tegema;
- kas vaja on põhjalikumat hindamist või mitme organisatsiooni koostöö koordineerimist.

Kui abivajadust saab rahuldada ühekordse meetmega, näiteks sotsiaalnõustamise, toetuse või teabe andmisega, ei pruugi juhtumikorralduse algatamine olla vajalik. Kui vaja on lastekaitsetöötaja kestvamat sekkumist, põhjalikumat hindamist või mitme abimeetme koordineerimist, tuleb algatada juhtumikorraldus ja juhtumimenetlus STARis.

3. Lapse kaasamine ja arvamuse väljaselgitamine

Laps peab olema juhtumikorralduse keskmes. Tema arvamust tuleb välja selgitada võimalikult varakult ning arvestada seda tema vanust ja arengutaset arvestades.

Lapsega vestlemisel tuleks välja selgitada vähemalt:

- kuidas laps ise oma olukorda kirjeldab;
- mida ta peab enda jaoks kõige olulisemaks;
- millised mured või ohud teda mõjutavad;
- kellelt ta tuge saab;
- mida ta sooviks olukorra muutmiseks.

Samuti tuleb teavitada ja kaasata lapsevanemat ning võimaluse korral teisi lapse jaoks olulisi võrgustikuliikmeid. Hindamise ettevalmistamisel on oluline luua koostöösuhe lapse ja perega ning kaardistada võrgustik.

4. Põhjalik abivajaduse hindamine

Hindamine ei ole üksik küsimustik, vaid analüüsiprotsess, mille käigus koondatakse lapse olukorda puudutav teave loogiliseks tervikuks. Hindamise keskmes on lapse arenguvajadused ning neid vaadeldakse koos järgmiste valdkondadega:

- lapse arenguvajadused;
- vanemlus ja vanemate suutlikkus lapse vajadusi rahuldada;
- pere ja keskkonna tegurid.

Need moodustavad lapse heaolu kolmnurga. Hindamisel tuleb vaadelda lapse heaolu terviklikult, sealhulgas tema füüsilist, tervislikku, psühholoogilist, emotsionaalset, sotsiaalset, kognitiivset, hariduslikku ja majanduslikku olukorda.

Iga valdkonna puhul tuleb eristada:

- kaitsetegureid – lapse, vanemate või keskkonna positiivseid asjaolusid, mis toetavad lapse arengut ja heaolu;
- riskitegureid – asjaolusid, mis kahjustavad või ohustavad lapse arengut ja suurendavad abivajadust.

Tuleb hinnata ka seda, kas tegurid on mõjutatavad ehk dünaamilised või pigem muutumatud ehk staatilised. Muutuse kavandamisel tuleb eelkõige toetuda kaitseteguritele ning vähendada mõjutatavaid riske.

Kogutav teave peab olema seotud hindamise eesmärgiga. See tähendab, et ei koguta teavet juhuslikult, vaid selgitatakse iga asjaolu puhul, kuidas see mõjutab lapse heaolu, turvalisust või arengut.

5. Hindamistulemuste analüüsimine

Pärast teabe kogumist tuleb hinnata:

- millised lapse vajadused on rahuldamata;
- millised riskid mõjutavad last praegu;
- millised riskid võivad ohustada lapse heaolu pikemas perspektiivis;
- millised kaitsetegurid aitavad olukorda parandada;
- millist muutust on lapse ja pere koostöös realistlik saavutada;
- milliseid abimeetmeid ja millist võrgustikutööd on vaja.

Abivajaduse hindamise eesmärgid peavad olema seotud lapse heaoluga – tema arengu, vanemate suutlikkuse ning pere ja keskkonnaga. Hindamise tulemus ei peaks piirduma probleemi kirjeldamisega, vaid peaks andma aluse sobivate sekkumiste valikuks.

6. Tegevuskava koostamine

Pärast hindamist koostab lastekaitsetöötaja lapse vajadustest lähtuva tegevuskava. Selles:

- seatakse abivajaduse põhjal prioriteedid;
- sõnastatakse soovitud muutust kirjeldavad eesmärgid;
- lepitakse kokku tegevused ja abimeetmed;
- määratakse, kes mida teeb;
- kavandatakse tulemuste ülevaatamine.

Eesmärk peab olema võimalikult selgelt seotud lapse olukorraga. Näiteks ei ole piisavalt täpne eesmärk „pere toetamine“, vaid pigem „laps osaleb koolis järjepidevamalt“ või „lapse igapäevane turvalisus kodus on tagatud“. Konkreetset tulemust saab hinnata näiteks koolist puudumiste muutuse kaudu enne ja pärast meetme rakendamist.

7. Vahehindamine ja juhtumi lõpetamine

Tegevuskava rakendamise ajal tuleb teha vahehindamisi ning vajaduse korral täpsustada nii abivajaduse hinnangut kui ka tegevuskava. Hinnata tuleb, kas:

- lapse olukord on paranenud ja eesmärk täidetud;
- toimunud on mõningane paranemine, kuid eesmärk ei ole veel täidetud;
- olukord on halvenenud ja vaja on uusi eesmärke või täiendavaid meetmeid.

Kui eesmärgid ei ole täidetud või lapse olukord on halvenenud, jätkatakse juhtumimenetlusega ja kavandatakse täiendavad sekkumised. Kui lapse abivajadus on vähenenud ning edasisteks tegevusteks ja abimeetmeteks puudub vajadus, võib juhtumimenetluse lõpetada.

„Turvalisuse märkide“ mudelit on 2024. aasta käsitluses kirjeldatud täiendava juhtumikorralduse tööriistana, mis rõhutab spetsialistide, pereliikmete ja võrgustiku partnerlust. Seda saab ühildada Eestis kasutatava lapse heaolu kolmnurga ja lapse heaolu hindamise käsiraamatuga; see ei asenda põhiraamistikku ega muuda teisi hindamise etappe olematuks.

[Täisvastus, kuvatud allikad ja paaristatud serverijälg](../docs/audits/evidence/rag-retest-2026-08-31-95104077/isolated-child.json).

**Avatud allikapaneel:**

1. *Lapse heaolu hindamise käsiraamat* · lk 8, 16–17, 19, 24–25, 32, 63, 65, 67.
2. Kadi Lauri, 2017. *Lapse heaolu hindamise käsiraamatust* · Sotsiaaltöö 4/2017 · lk 1–3, 5 · Sotsiaaltöö meetodid.

**Hinnang:** PARTIAL. Vastus on sisuliselt mitmeetapiline, praktiline ja katab lapse heaolu kolmnurga, riski- ning kaitsetegurid, tegevuskava ja vahehindamise. Kuid vastus nimetab 2024. aasta „Turvalisuse märkide“ käsitlust, mille otsest allikat paneelis ei kuvata; samal ajal kuvatakse Kadi Lauri 2017 artikkel, mille eristatav panus vastusesse ei ole nähtav. Seega täiendava mudeli väitepõhine allikaseos ei ole tõendatud. Per-request trace on UI-s nähtamatu (**NOT_PROVEN**); runtime'i väljalase oli enne vastust serveris kontrollitud `95104077`.

### Järjestikvestluse jooksvad tulemused

#### J1 — M01 — PASS (11:22 EEST)

**Vastus (täpne salvestatud tekst):**

1. Meetodit kasutati: kvalitatiivset uurimismeetodit, mille käigus koguti andmeid poolstruktureeritud individuaal- ja grupiintervjuude ning kirjaliku tagasiside kaudu.

2. Uuring tehti: novembrist 2025 kuni märtsini 2026.

3. Inimesi osales: kokku 42 inimest.

[Täisvastus, kuvatud allikad ja paaristatud serverijälg](../docs/audits/evidence/rag-retest-2026-08-31-95104077/sequential-M01.json).

**Avatud allikapaneel:** Kristi Rekand, 2026. *Täisealiste psüühikahäirega inimeste, sh eestkostetavate uuringu kokkuvõte* · lk 1–11, 14, 29, 33, 35, 37, 43.

**Hinnang:** PASS. Sama küsimus on järjestikvestluse esimesena täielikult ja õige allikaga kaetud. Per-request trace on UI-s nähtamatu (**NOT_PROVEN**); runtime'i väljalase oli enne vastust serveris kontrollitud `95104077`.

#### J2 — M02 — FAIL (11:23 EEST)

**Vastus (täpne salvestatud tekst):**

Ma ei saa kõiki küsitud osi valitud allika põhjal piisavalt kindlalt kinnitada.

[Täisvastus, kuvatud allikad ja paaristatud serverijälg](../docs/audits/evidence/rag-retest-2026-08-31-95104077/sequential-M02.json).

**Allikapaneel:** puudus — vastuse juures ei kuvata nuppu „Vastuste allikad”.

**Hinnang:** FAIL. Järjestikvestluse eelnev sama uuringu M01 vastus ei muutnud tulemust: ükski neljast soovitusest ei ole vastatud ega allikaga seotud. Per-request trace on UI-s nähtamatu (**NOT_PROVEN**); runtime'i väljalase oli enne vastust serveris kontrollitud `95104077`.

#### J3 — Golden: integreeritud teenused — PARTIAL (11:23 EEST)

**Vastus (täpne salvestatud tekst):**

Ajakiri „Sotsiaaltöö” käsitleb integreeritud teenuseid kui eri valdkondade ja asutuste koostööd, mille eesmärk on pakkuda inimesele või perele terviklikumat ning sujuvamalt korraldatud abi. Eriti rõhutatakse, et abi ei peaks sõltuma sellest, kas inimene oskab ise õige asutuse üles leida ja eri teenuste vahel liikuda.

Põhiteemad on järgmised:

- Lapse ja pere vajadustest lähtuv koostöö. Erivajadusega lapse toetamisel peaksid sotsiaal-, haridus- ja tervisevaldkond tegutsema koordineeritult, et laps ja pere jõuaksid vajalike teenusteni kiiresti ja mugavalt. 2020. aastal kirjeldatud pilootprojektis tegid selle nimel koostööd Sotsiaalministeerium, Haridus- ja Teadusministeerium, SA Innove ning Sotsiaalkindlustusamet („Integreeritud tugiteenused lastele – esimene tagasiside pilootprojektile”, 2020).

- Võrgustikutöö lapse heaolu tagamisel. Lapse pikaajalise abivajaduse korral võib abi eeldada mitme asutuse koostööd; ajakirjas viidatakse sotsiaalhoolekande seaduse §-le 9, mis kohustab sellisel juhul võrgustikutööd rakendama („Integreeritud teenused – kellele ja milleks?”, 2019).

- Inimesekeskne teenusekorraldus. Integreeritud teenuste puhul tõstatatakse küsimused, kuhu suunata olemasolevaid ressursse, kuidas kasutada andmeid paremini ning kuidas hinnata teenuste, sealhulgas integreeritud teenuste mõju („Teekond inimesekeskse teenusepakkumise suunas”, 2020). See tähendab, et teenuste edukust ei hinnata ainult osutatud teenuste arvu järgi, vaid ka selle järgi, kas inimese olukord tegelikult paraneb.

- Tervise-, sotsiaal- ja töövaldkonna ühendamine. 2018. aastal kirjeldati lahendusi, millega püüti lähendada rehabilitatsiooni-, tervise-, sotsiaal- ja tööteenuseid. Samuti katsetasid kuus omavalitsust hoolduskoordinatsiooni mudelit, et suure ja keerulise hooldusvajadusega inimesed saaksid rohkem tuge oma kodu lähedal („Sotsiaalministeerium: kitsaskohad on meile teada, otsime aktiivselt toimivaid lahendusi”, 2018).

- Kohaliku tasandi koostöö praktilise korraldajana. Hiiumaa näide näitab, et teenuseid saab korraldada mitme kohaliku üksuse ja teenuseosutaja koostöös: koduteenust pakkusid Hiiumaa Sotsiaalkeskus, Hellamaa Perekeskus ning Emmaste ja Käina osavald; sotsiaaltransport toetas inimesi nii Hiiumaal kui ka mandrile arsti juurde sõitmisel („Hiiumaa: meretagune ühinemine tõi sotsiaaltöötajad kokku”, 2018).

Kokkuvõttes kujutab ajakiri integreeritud teenuseid mitte ühe eraldiseisva teenusena, vaid töökorraldusena: riik kujundab koostööraamistiku ja katsetab mudeleid, kohalik omavalitsus aitab abi koordineerida ning konkreetsed asutused ja spetsialistid jagavad vastutust inimese või pere toetamisel. Varasemates käsitlustes olid keskmes hoolduskoordinatsioon, valdkondade ühendamine ja võrgustikutöö; uuemates, 2026. aasta ajakirja teemakäsitlustes seostub see jätkuvalt sotsiaal- ja tervishoiu lõimumise ning kohaliku omavalitsuse tööga.

[Täisvastus, kuvatud allikad ja paaristatud serverijälg](../docs/audits/evidence/rag-retest-2026-08-31-95104077/sequential-integrated.json).

**Avatud allikapaneel:** Alice Juurik 2019; Gerli Aavik 2018; Eva Liina Kliiman 2020; Gerli Aavik-Märtmaa 2020; Kairi Lõppe 2018. Kõik viis on vastuses eraldi nime ja väitega kasutatud.

**Hinnang:** PARTIAL. Sisu ei korda vana rehabilitatsiooni/erihoolekande eelarve- või teenuseliigi segiajamist ning paneelis olevad viis allikat on seekord vastuses kasutatud. Kuid vastus lisab 2026. aasta ajakirja käsitluste üldistuse, mille allikat paneelis ei ole. Seetõttu jääb kogu vastus väitepõhiselt mitte täielikult tõendatuks. Per-request trace on UI-s nähtamatu (**NOT_PROVEN**); runtime'i väljalase oli enne vastust serveris kontrollitud `95104077`.

#### J4 — Golden: lapse heaolu — PASS (11:24 EEST)

**Vastus (täpne salvestatud tekst):**

Lapse heaolu ja abivajadust hinnatakse lapsekeskselt ning terviklikult: esmalt hinnatakse lapse arenguvajadusi, seejärel vanemlust ning pere ja keskkonna tegureid. Hindamise eesmärk on mõista, millised lapse vajadused on rahuldamata, millised kaitse- ja riskitegurid olukorda mõjutavad ning milline abi toetaks lapse heaolu ja arengut.

Praktiline hindamisprotsess:

1. Kontrolli kohe lapse turvalisust

Enne põhjalikumat hindamist tuleb selgitada, kas lapse elu või tervis on ohus või kas laps viibib teda ohustavates tingimustes. Kui tegemist võib olla hädaohus oleva lapsega, tuleb keskenduda kiirele sekkumisele. Lapse ohutust tuleb jälgida kogu hindamise vältel.

2. Tee eelhindamine

Pärast abivajavast lapsest teate saamist teeb lastekaitsetöötaja eelhindamise. Selle käigus selgitatakse muu hulgas:

- milles lapse või pere mure seisneb;
- kas lapse vajadusi on võimalik rahuldada ühe meetmega;
- kas laps ja pere võtavad abi vastu;
- kas pere on valmis spetsialistidega koostööd tegema;
- kas on vaja lastekaitsetöötaja täiendavat sekkumist või põhjalikumat hindamist.

Kui piisab ühekordsest meetmest, näiteks sotsiaalnõustamisest, toetuse või teabe jagamisest, ei pruugi juhtumikorralduse algatamine olla põhjendatud. Kui vaja on mitme abimeetme koordineerimist, põhjalikumat hindamist või lastekaitsetöötaja järjepidevat sekkumist, algatatakse juhtumikorraldus.

3. Kaasa laps ja pere

Laps peab olema juhtumikorralduse keskmes ning tema arvamust tuleb võimalikult suurel määral kuulata ja arvesse võtta. Lapsega kontakti loomisel teavitatakse üldjuhul lapsevanemat, kuid kui lapsevanema tegevus või tegevusetus võib lapsele ohtu põhjustada, võib põhjendatud juhul vestelda lapsega esmalt ilma vanemat teavitamata. Sellisel juhul tuleb vanemat vestlusest kohe pärast teavitada.

4. Hinda lapse heaolu terviklikult

Hindamise lähtekohaks on lapse arenguvajadused. Seejärel vaadeldakse nende seost:

- lapse füüsilise, tervisliku, psühholoogilise, emotsionaalse, sotsiaalse, kognitiivse, haridusliku ja majandusliku heaoluga;
- vanemate suutlikkuse ja vanemlike oskustega;
- pere suhete ja toimimisega;
- lapse elamistingimuste ja muu keskkonnaga;
- lapse tugivõrgustiku ja olemasolevate teenustega.

Need valdkonnad ei ole eraldi hindamismeetodid, vaid aitavad kujundada lapse olukorrast tervikpildi.

5. Kaardista kaitse- ja riskitegurid

Kaitsetegurid on lapse, vanemate või keskkonna positiivsed omadused ja ressursid, mis toetavad lapse arengut ning millele saab soovitud muutuse üles ehitada. Riskitegurid mõjutavad lapse arengut negatiivselt, suurendavad abivajadust või ohustavad lapse heaolu pikemas perspektiivis.

Analüüsis tuleb hinnata, kuidas need tegurid:

- mõjutavad lapse praegust olukorda;
- mõjutavad lapse heaolu tulevikus;
- omavahel seostuvad;
- on muudetavad või pigem püsivad.

6. Kogu teavet eesmärgipäraselt ja tee koostööd võrgustikuga

Hindamine on analüüsiprotsess, mille käigus koondatakse sündmused, asjaolud ja eri osapoolte teadmised loogiliseks tervikuks. Vajaduse korral kaasatakse pere, laps, haridusasutus, tervishoiu- ja sotsiaalvaldkonna spetsialistid ning teised lapse jaoks olulised võrgustikuliikmed. Kogutav teave peab lähtuma hindamise eesmärgist ja lapse vajadustest.

7. Koosta tegevuskava

Pärast abivajaduse hindamist:

- sea lapse vajaduste põhjal prioriteedid;
- sõnasta lapse heaoluga seotud eesmärgid;
- vali sobivad sekkumised ja abimeetmed;
- määra tegevused ning nende elluviimise eest vastutajad;
- lepi kokku, kuidas muutust hinnatakse.

Tegevuskava ei peaks keskenduma ainult probleemide kirjeldamisele, vaid sellele, milline konkreetne muutus peab lapse olukorras toimuma.

8. Tee vahe- ja kordushindamisi

Hinnata tuleb, kas rakendatud meetmed on toonud soovitud muutuse. Muutust võib jälgida konkreetsete näitajate kaudu, näiteks koolist puudumiste vähenemise kaudu. Vahehindamisel selgitatakse, kas:

- eesmärk on täidetud ja positiivne muutus püsib;
- muutus on osaliselt toimunud, kuid eesmärk ei ole veel täidetud;
- olukord on halvenenud ja vaja on uusi eesmärke või täiendavaid abimeetmeid.

Kui lapse abivajadus on vähenenud ja edasiste tegevuste vajadus puudub, saab juhtumimenetluse lõpetada. Kui eesmärgid pole täidetud või olukord on halvenenud, tuleb juhtumikorraldust jätkata ja tegevuskava üle vaadata.

„Turvalisuse märkide“ mudelit on Eesti lastekaitsetöös käsitletud täiendava töövahendina, mida saab ühildada lapse heaolu kolmnurga ja lapse heaolu hindamise käsiraamatuga; see ei asenda lapse heaolu terviklikku hindamist ega muuda ennast iseseisvaks kohustuslikuks menetluseks.

[Täisvastus, kuvatud allikad ja paaristatud serverijälg](../docs/audits/evidence/rag-retest-2026-08-31-95104077/sequential-child.json).

**Avatud allikapaneel:**

1. *Lapse heaolu hindamise käsiraamat* · lk 8, 16–17, 19, 24–25, 32, 63, 65, 67.
2. Helen Alton, 2024. *Juhtumikorraldusmudel „Turvalisuse märgid“ – uus tööriist Eesti lastekaitsetöös* · Sotsiaaltöö 4/2024 · lk 4 · Metoodika.

**Hinnang:** PASS. Mitmeetapiline hindamisvastus on sisuliselt kasutuskõlblik ning paneel sisaldab täpselt põhiraamistikku ja vastuses nimetatud täiendavat mudelit; eelneva isoleeritud vastuse Kadi Lauri lisallikat enam ei kuvata. Per-request trace on UI-s nähtamatu (**NOT_PROVEN**); runtime'i väljalase oli enne vastust serveris kontrollitud `95104077`.

### 31.08.2026 — kordusfaasi koond ja paus

| Juhtum | Isolated | Sequential | Võrdlus |
|---|---|---|---|
| M01 | PASS | PASS | Järjekord ei muutnud tulemust. |
| M02 | FAIL | FAIL | Sama lõppkontekst ja keeldumine; hilisem diagnoos tõendab vale kvalitatiivset tõendilepingut. Sama lõppvastus üksi ei välista ajaloo mõju; tagasilükatud draftide valideerimisjäljed erinesid. |
| Golden: integreeritud teenused | PARTIAL | PARTIAL | Isoleeritud vastusel üks eristamatu paneeliallikas; järjestikvastus kasutas kõiki viit, kuid lisas ilma paneeliallika 2026 üldistuse. |
| Golden: lapse heaolu | PARTIAL | PASS | Järjestikvastus säilitas õige täiendava mudeli allika ja eemaldas isoleeritud vastuse eristamatu taustaallika. |

**Koond:** 3 PASS, 3 PARTIAL ja 2 FAIL vastuse-režiimi kohta kokku 8 tulemust. See on nelja parandatud juhtumi kitsas runtime-kordus, mitte 75 küsimuse ega Golden37 täisvärav. Pärast sequential-faasi tehti omaniku korralduse järgi paus. Omaniku järgneval korraldusel uuriti olemasolevaid vastuseid; uusi küsimusi ega varjatud kordusi ei saadetud.

### 31.08.2026 — kaheksa vastuse põhjuseanalüüs

[Täielik diagnoos, koodikohad ja paranduste vastuvõtukriteeriumid](../docs/audits/evidence/rag-retest-2026-08-31-95104077/diagnosis.md). Kohalik/origin/server HEAD mõõdeti `c405d3ca`, runtime-kood on endiselt `95104077`. Kõigi kaheksa vastuse serverijäljed saadi täpsete `ChatTurn`-paaride kaudu; avalikud tõendilõigud kontrolliti hashidega.

- **M02 mõlemad FAIL:** kvalitatiivne dispatch töötab. Slot4 „toetatud otsustamine” seotakse vale kontaktisikuloeteluga; katvus 4/4 on valepositiivne ja tõendi taastamispäringuid ei tehta. Slot1/3 nõuavad lisaks kõrvalisi tegevusi ja ühelauselist vormi. Mõlemas lõpeb kontroll `requested_fact_answer_incomplete`; päris tagasilükatud drafti täistekst ei ole säilinud. Üheksa puhta abifunktsiooni kordusarvutuse [tulemused](../docs/audits/evidence/rag-retest-2026-08-31-95104077/qualitative-replay-results.json) kinnitavad nii valepositiivset kui ka valenegatiivset kontrolli, mitte parandatud runtime'i.
- **Lapse heaolu isolated PARTIAL:** sama kontekst kui sequential. Pikas vastuses on 74 parseriväidet; nimeline mudel indeksil 71 jääb sisemise 64-väite piiri taha. Sequential-vastuses on 60 väidet ja mudel indeksil 59, mistõttu õige allikas säilib. See pole puuduva morfoloogia ega kadunud otsinguallika viga.
- **Integreeritud isolated PARTIAL:** Hiiumaa allikale omistatakse ainulaadne väitetugi ainult `teenus` + `inimese` sõnakattest (2/11; 18,18%; 0 bigrammi). Hash-täpne tekst ei toeta väidet teenuste korralduspõhimõttest. Sequential'i tegelik Hiiumaa näide on allikaga põhjendatud ja peab säilima.
- **Integreeritud sequential PARTIAL:** 2026. aasta Eessõna oli päris kontekstis ja toetab teemalauset. Parser lahutab `2026.` järgnevast tekstist ning allikas peidetakse dubleeriva toe pähe. Seda ei saa nimetada tõendatud aastaarvu hallutsinatsiooniks.
- **Ajalooefekt:** iseseisev süntees lisab eelmise EPIKoja allika järgi tühja otsingu. Sellest hoolimata muutub skooriskaala ning lõppkontekst 8 → 9 allikaks. M02 ja lapse heaolu kontekst jäi režiimide vahel identseks; nende erinevused asuvad hilisemas genereerimise/kontrolli kihis.

Kõigis kaheksas päringus töötas EstNLTK morfoanalüüs enne planeerimist. Eraldi lemma-FTS kanal on endiselt shadow-only; integreeritud teenuste süntees kasutab ainult dense-kanalit. Nende konkreetsete rikete põhjuseks küsimuse vale käänet ei tuvastatud. Kood, ingest, indeksid ja server jäid muutmata; commit/push/deploy ja uus runtime-kordus jäid tegemata. Aktiivne seis jääb SotsiaalAI.md S1.0-sse; parandamine ootab omaniku korraldust.
