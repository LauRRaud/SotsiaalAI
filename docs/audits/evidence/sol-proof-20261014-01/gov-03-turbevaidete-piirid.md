# GOV-03 — Turbe- ja privaatsusväidete ulatus

Seis 21.10.2026 (Claude, `sol-proof-20261014-01`). Dokument eristab, mida Soli tõenduskatsed päriselt kontrollisid, ja
mida mitte. See ei ole turvaaudit, läbistustest ega sertifikaat. Läbitud juurdepääsukatseid ei tohi esitada kogu
infoturbe kinnitusena.

## Kontrollitud kaitsemeetmed (katse, tulemus, tõend)

| Valdkond | Mida kontrolliti | Tulemus | Tõend |
|---|---|---|---|
| Võõra andmete piir (DATA-01) | Spetsialist, teenuseosutaja ja pöörduja ei saa lugeda ega muuta võõrast Teekonda, eelpöördumist, teenuseprofiili ega organisatsiooni; tavaroll ei pääse admini API-sse; määramata töötaja ei näe postkasti kirjet | 39 varianti PASS (serveris) | `server-http-flow.json`, `server-org-boundaries.json`, `server-baseline.json`, `server-intake-flow.json` |
| Suletud avamine (ENV-02) | Anonüümne ja tavaroll jäävad avamisvärava taha; admini sisenemine suunatakse | 9 PASS | `server-baseline.json`, `server-http-flow.json` |
| Rollid ja seansid (ENV-03) | Rollivaated; peatatud konto ja tühistatud seanss lõpetavad ligipääsu | 25 PASS | `server-http-lifecycle.json`, `server-browser-role-walkthrough.json` |
| Väline e-kiri (DATA-03) | Vaikimisi ei lähe pöördumise sisu e-kirja; sisu ainult teadliku valikuga | 9 PASS | `server-external-mail.json` |
| Kustutamine (DATA-04) | Konto kustutamisel jääb alles ainult kustutamise arvestus; privaatsisu ei jää kõrvalhoidlatesse; saajale jääb saadetud pöördumine nähtava kustutamismärkega | 7 PASS (kohalik eraldatud baas) | `local-data04-deletion.json` |
| Mudelile minev andmepakett (DATA-05) | Väljaminevas päringus on ainult jagatud kasutajatekst ja avalik tõendusmaterjal; valimata moodulid ja võõrad juhtelemendid puuduvad; `store: false` | 4 PASS | `server-rag-outbound.json`, `rag-outbound-field-map.json` |
| Tööheaolu privaatsus (DATA-06) | Isiklik kirje on privaatne; väikese grupi koond on peidetud ja lisalahtrite kaudu ei saa seda tuletada | 8 PASS | `server-wellbeing-privacy.json` |
| Allikasse peidetud juhis (RAG-10) | Allika tekst jääb kasutajaandmeks ega muuda rakenduse juhiseid, viiteid ega tööriistu | 11 PASS (kohalik komponent) + 2 vestlusvastust | `local-rag-source-injection.json`, `server-rag-chat-50.json` |
| Kriisirada (RAG-11) | Kriisiteade tuleb ka ligipääsu keelamisel; kriis tuvastati päris vestluses | 6 PASS | `server-pilot-crisis.json`, `server-rag-chat-50.json` |
| Taustatööde võtmed (OPS-06) | Ilma võtmeta või vale võtmega töö keeldub (401); 21.10 avatud kaks tööd jõuavad võtmekontrollini, raha ja ekspordi tööd jäävad värava taha | 7 PASS | `server-jobs-and-deadline.json`, `local-ui-admin-role-caption-20261021.json` |
| Teemaseemne privaatsuskontroll (DATA-02) | Nimi, e-post, isikukood ja juhtumi number peatavad jagamise; 21.10 parandusest alates ei peata asutuse ja koha nimed | 20.10: 6 FAIL; 21.10 parandatud ja kontrollitud | `local-topicseed-privacy.json`, `local-ui-fix-covision-topicseed-20261021.json` |

## Kontrollimata pinnad

- Läbistustest, sõltumatu turvaaudit, haavatavuste skaneerimine ja sõltuvuste turvaülevaade.
- Serveri ja võrgu karastamine, tulemüür, TLS-i seadistus ja turvapäiste tegelik kehtivus (koodis on
  `frame-ancestors 'none'`, `X-Frame-Options: DENY` ja HSTS; serveri vastuseid selles töös ei mõõdetud).
- Andmete krüpteerimine puhkeolekus, varukoopiad ja taastamise proov.
- Logimine, seire, rikkumisest teavitamine ja intsidendi käsitlus päris olukorras.
- Alltöötlejate lepingute (DPA) tegelik olemasolu: raamlepingu mustandi lisas 3 on täitmata kohad
  (e-posti saatja, varundus- ja seireteenus, TartuNLP kasutus).
- Kontode kaitse: kahefaktoriline autentimine, paroolipoliitika, sessioonide kestus.
- Päringute piiramine ja väärkasutuse tõrje koormuse all.

## Tehisaru teenusepakkuja: mida tohib väita

Allikas: [OpenAI, Your data](https://developers.openai.com/api/docs/guides/your-data) (loetud 21.10.2026).

- **Treening:** API kaudu saadetud andmeid ei kasutata vaikimisi mudelite treenimiseks. See vastab raamlepingu p 8.3
  sõnastusele ja on korrektne üldreegel.
- **Säilitamine ei ole sama mis treening:** väärkasutuse seire logid säilivad pakkuja juures vaikimisi kuni 30 päeva.
  Platvormi päringutes on `store: false` (rakenduse oleku säilitamine välja lülitatud), kuid see ei kaota
  väärkasutuse logi.
- **Nullsäilitus (ZDR) ja EL-i andmeresidentsus** vajavad pakkuja eelnevat heakskiitu. Platvorm kasutab globaalset
  lõpp-punkti `api.openai.com`, mitte EL-i lõpp-punkti; nullsäilituse olemasolu ei ole tõendatud. Seega ei tohi
  väita, et tehisaru töötlus toimub ainult Eestis või EMP-s. Raamlepingu mustandi lisa 3 sõnastus („sh võimalik
  kolmanda riigi töötlus“) on selle kohta aus.
- Õiguslik alus ja eriliigiliste andmete töötlemise lubatavus on organisatsiooni ja õigusnõustaja küsimus, mitte
  tehniline tulemus.

## Väidete otsused

| Väide | Otsus |
|---|---|
| „Riigi süsteemidega võrreldav või kõrgem turvatase“ | **Tõendamata.** Võrdlevat sõltumatut auditit ega sertifikaati ei ole. Võib esitada eesmärgina. |
| „API andmeid ei kasutata mudelite treenimiseks“ | **Kinnitatud** pakkuja reegli tasemel (vaikimisi). Ei tähenda säilitamata jätmist. |
| „Andmed jäävad Eestisse“ | Majutuse kohta (Zone Media, Eesti) lepingu tasemel tõendamata; **tehisaru töötluse kohta ei kehti.** |
| „Teised ei näe minu andmeid“ | **Piiratud ulatuses kinnitatud:** 39 juurdepääsupiiri katset läbisid; kõiki pindu ei ole testitud. |
| „Konto kustutamisel kustuvad andmed“ | **Piiratud ulatuses kinnitatud:** kohalikus baasis läbis; saajale jääb saadetud pöördumine kustutamismärkega (tahtlik). Varukoopiate kustumist ei kontrollitud. |
