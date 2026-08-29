# RAG 75 varasemate FAIL/PARTIAL juhtumite tootmiskordus

- Runtime SHA: `e1a8eea4ebcc6dcb6a20caa40cbdb0ca418454f5`
- Docs/local HEAD: `e1a8eea4ebcc6dcb6a20caa40cbdb0ca418454f5`
- origin/main HEAD: `e1a8eea4ebcc6dcb6a20caa40cbdb0ca418454f5`
- Server checkout HEAD: `e1a8eea4ebcc6dcb6a20caa40cbdb0ca418454f5`
- Server checkout: clean
- Active frontend artifact: `frontend-current-20260829T081235Z-e1a8eea4.tar.gz`
- RAG health: `ok`; original FTS ready; lemma FTS ready
- Run started at UTC: `2026-08-29T08:15:30.442Z`
- Selection source: `results-codex-risk-refactor-2026-08-29.md`
- Selection rule: ainult viimase 75-jooksu `PARTIAL` ja `FAIL`
- Frozen case count: 34 (`PARTIAL` 16, `FAIL` 18)
- Frozen manifest SHA-256 (enne selle kontrollrea lisamist): `801006da3d77a481fdddae618c88a1ee6123d08775b5574703f20ebc72842f86`

Küsimused on muutmata kujul varasema 75 juhtumi `manifest.md` failist. Kordusjooksus kasutatakse viit uut vestlust: `R-B01` (J/V), `R-B02` (A), `R-B03` (S), `R-B04` (M) ja `R-B05` (K). Iga küsimus saadetakse üks kord kasutajaliideses, järjest.

| case_id | previous_verdict | batch_id | turn | exact_question | expected_claims |
|---|---|---|---:|---|---|
| J03 | PARTIAL | R-B01 | 1 | Millised on vaimse tervise kriisi tunnused ning millistele telefoninumbritele tuleb nende korral helistada 2018. aasta artikli järgi? | kriisitunnused; 112; 1220; ajalooline 2018 allikas |
| J04 | PARTIAL | R-B01 | 2 | Millistes linnades tegutsesid Perepesad ja millised neli ülesannet neil olid? | Põltsamaa, Türi, Viljandi; neli põhiülesannet |
| J05 | FAIL | R-B01 | 3 | Milliseid kahte taastava õiguse näitajat kirjeldati arvudega 30 ja 12 ning milliseid näitajaid arvudega 60 ja 19? | 30 ja 12 ühe juhtumi rühm; 60 ja 19 teise rühm; õiged seosed |
| J07 | PARTIAL | R-B01 | 4 | Kui palju inimesi sai teenust, mitu vabatahtlikku osales, mitu töötundi tehti ning mitmes maakonnas ja omavalitsuses tegutseti 2018–2020 katseetapis 2022. aasta artikli „Seltsilised annavad sotsiaalhoolekande teenustele lisaväärtust” järgi? | 678; 273; 21600; 12 maakonda; 43 omavalitsust |
| J08 | FAIL | R-B01 | 5 | Millised olid hoolduskoormuse uuringus neli küsitud osakaalu? | 61%, 26%, 11%, 18% õigete nähtuste juures |
| J09 | PARTIAL | R-B01 | 6 | Millised olid kiusamist kirjeldanud neli protsenti? | 33%, 13%, 19%, 7% õigesti seotud |
| J11 | FAIL | R-B01 | 7 | Kui palju oli töötamise toetamise intervjuusid, kuidas jagunesid individuaal- ja rühmavestlused ning millist kolmeetapilist analüüsi kasutati? | 7; 6 individuaalset; üks kolmeliikmeline rühm; kolmeetapiline temaatiline analüüs |
| J12 | PARTIAL | R-B01 | 8 | Mitu KOV-i sotsiaaltöötajate rühmasupervisiooni kohtumist pidi 2017. aastal lepingu järgi toimuma igas maakonnas? | igas maakonnas pidi toimuma viis kohtumist |
| J13 | PARTIAL | R-B01 | 9 | Millist vanuserühma 13–18 käsitleti ning mitu probleemi noortel tavaliselt korraga oli? | vanus 13–18; 3–5 probleemi |
| J14 | FAIL | R-B01 | 10 | Mida öeldi Saue valla alla 18-aastaste laste arvu ja vanemate hooldusõiguse vaidlustes kohtusse pöördumise kohta? | üle 5800 lapse; 90%; näites 14 kohtuasja ja 3 kokkulepet |
| J18 | FAIL | R-B01 | 11 | Kui palju osalejaid oli eestkostes osalemise uuringu igas kolmes praktikute rühmas ja kokku? | 5 kohtunikku; 5 asutuse töötajat; 5 KOV-i sotsiaaltöötajat; kokku 15 |
| J20 | FAIL | R-B01 | 12 | Millal kirjeldati artiklis sotsiaalvaldkonna seadusemuudatusi 2023. aasta kevadel ja suvel ning 2025. aasta jaanuaris? | 2023 kevad; 2023 suvi; 2025 jaanuar õigesti ajastatud |
| J22 | PARTIAL | R-B01 | 13 | Millal tehti e-kursuse järelhindamine ning kelle vaadet selles võrreldi? | kuue kuu pärast; osaleja ja tööandja vaade |
| V01 | FAIL | R-B01 | 14 | MAPPA kohtumised – kui tihti ja mitu neid kolmes Virumaa linnas oli? | sagedus; Rakvere 5; Jõhvi 7; Narva 5 |
| V03 | PARTIAL | R-B01 | 15 | Palju neid supervisioone maakonna kohta tehti? | maakonna kohta viis supervisioonikohtumist 2017. aastal |
| V04 | FAIL | R-B01 | 16 | Eakate vägivallauuring: mis olid kolm näitu? | 10%=640; 6%=227; 2%=100; rollid õigesti seotud |
| V05 | PARTIAL | R-B01 | 17 | E-kursuse järelmõju – millal ja kelle hinnangud? | kuue kuu pärast; osaleja ja tööandja hinnangud |
| V06 | FAIL | R-B01 | 18 | Laste eraldamise otsused: arv ja aasta? | 169 otsust; 2018 |
| A01 | FAIL | R-B02 | 1 | Milliseid teemasid käsitlevad Krister Tüllineni enda artiklid ajakirjas Sotsiaaltöö? | ainult Krister Tüllineni enda artiklid ja nende teemad |
| A02 | FAIL | R-B02 | 2 | Milliseid teemasid käsitlevad Maarja Krais-Leoski enda artiklid ajakirjas Sotsiaaltöö? | ainult Maarja Krais-Leoski enda artiklid ja nende teemad |
| A03 | FAIL | R-B02 | 3 | Milliseid teemasid käsitlevad Kadi Lubi enda artiklid ajakirjas Sotsiaaltöö? | ainult Kadi Lubi enda artiklid ja nende teemad |
| A04 | PARTIAL | R-B02 | 4 | Milliseid teemasid käsitlevad Ave Ungro enda artiklid ajakirjas Sotsiaaltöö? | ainult Ave Ungro enda artiklid ja nende teemad |
| A05 | PARTIAL | R-B02 | 5 | Milliseid teemasid käsitlevad Jane Langemetsa enda artiklid ajakirjas Sotsiaaltöö? | ainult Jane Langemetsa enda artiklid ja nende teemad |
| A06 | FAIL | R-B02 | 6 | Milliseid teemasid käsitlevad Liina Lokko enda artiklid ajakirjas Sotsiaaltöö? | ainult Liina Lokko enda artiklid ja nende teemad |
| A07 | FAIL | R-B02 | 7 | Milliseid teemasid käsitlevad Kadri Kuulpaki enda artiklid ajakirjas Sotsiaaltöö? | ainult Kadri Kuulpaki enda artiklid ja nende teemad |
| A08 | PARTIAL | R-B02 | 8 | Milliseid teemasid käsitlevad Merle Tombergi enda artiklid ajakirjas Sotsiaaltöö? | ainult Merle Tombergi enda artiklid ja nende teemad |
| A10 | FAIL | R-B02 | 9 | Milliseid teemasid käsitlevad Judit Strömpli enda artiklid ajakirjas Sotsiaaltöö? | Judit Strömpli enda artiklid; välista teda intervjueerivad lood |
| S08 | FAIL | R-B03 | 1 | Mida kirjeldavad Sotsiaaltöö artiklid Saaremaa COVID-kogemuse ja kriisivalmiduse kohta? | Saaremaa COVID-kogemus; kriisivalmidus; mitu asjakohast allikat |
| M01 | FAIL | R-B04 | 1 | Milline oli EPIKoja uuringu meetod, millal uuring tehti ja kui palju osalejaid selles oli? | meetod; aeg; 42 osalejat |
| M02 | PARTIAL | R-B04 | 2 | Milliseid soovitusi andis EPIKoda Tallinnale? | Tallinnale suunatud soovitused EPIKoja allikast |
| M07 | FAIL | R-B04 | 3 | Milles seisneb Tarkvanema vestlustööleht ja kuidas seda kasutada? | eesmärk; kasutamise sammud; õige tööleht |
| K01 | PARTIAL | R-B05 | 1 | Kuidas taotleda Kuusalu vallas koduteenust ja mida sätestab selle kohta § 6? | taotlemise kord; kohaliku määruse § 6; Kuusalu allikas |
| K02 | PARTIAL | R-B05 | 2 | Kuidas taotleda Narva linnas koduteenust? | Narva linna kord; mitte Narva-Jõesuu |
| K05 | PARTIAL | R-B05 | 3 | Millistel tingimustel ja kuidas saab Tartu sotsiaaltransporti kasutada? | Tartu tingimused; taotlemise või kasutamise kord |
