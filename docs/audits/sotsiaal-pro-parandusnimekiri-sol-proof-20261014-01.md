# Sotsiaal.pro parandusnimekiri — Soli tõenduskatsete leiud

Seis 21.10.2026. Siin on ühes kohas kõik, mida Soli tõenduskatsed (`sol-proof-20261014-01`) leidsid ja mida
tuleb parandada või otsustada. Tõenduskatsete ajal (14.–20.10) parandusi ei tehtud
(`productFixesDuringBaseline: false`). 21.10 parandati omaniku palvel kinnitatud vead A1–A6 ja A8; A7 osutus
katseraki ajastusveaks. Samal päeval lisati puuduvad funktsioonid 19–21 ja vestluse juhise parandused 12, 14, 15, 16 (juhis 44);
vestluse otsingu ja sisu punktid (B) on RAG-i töösuunal. Iga punkti juures on seis. Täpne kirjeldus ja mõõtmise piirid on
[Soli aruandes](sotsiaal-pro-toenduskatsete-tulemused-sol-proof-20261014-01.md), toorandmed kaustas
`evidence/sol-proof-20261014-01/`. 21.10 kontrollid tehti kohalikus eraldatud koopias, mitte serveris.

## A. Kinnitatud vead

1. **Võrgustikujagamine katkeb pärast vastuvõttu (`network_share.source_inactive`).** Spetsialist saab jagamise
   mustandi teha enne vastuvõttu, kuid vastuvõtt viib pöördumise olekusse READY ja sama lubatud jagamine keeldub
   (arendusülesanne D01). [Tõend, FLOW-08](evidence/sol-proof-20261014-01/server-baseline.json)
   **Parandatud 21.10:** `lib/network/share.js` lubab allikana SENT ja READY olekut; arhiveeritud pöördumist ei
   jagata. Saajaõigus, tagasivõtmise ja asendamise piir jäid samaks.
   [Kontroll](evidence/sol-proof-20261014-01/local-fix-verify-20261021.json)
2. **Saabumiskiri eirab konto e-postiteavituse eelistust.** Omaniku otsus: eelistust tuleb arvestada.
   [Tõend](evidence/sol-proof-20261014-01/server-safety-mail.json)
   **Parandatud 21.10:** `sendInternalPreInquiryArrivalEmail` peatub enne transpordi kutset, kui eelistus ei ole
   `true` (sama reegel nagu teistel valikulistel teavitustel); platvormisisene teavitus jääb. Sisselülitatud eelistuse
   korral läheb sisuta neutraalne kiri. [Kontroll](evidence/sol-proof-20261014-01/local-fix-verify-20261021.json)
3. **Pöörduja näeb „vastu võetud”, kui asutuse koordinaator kirje ainult avab.** Avamine ei ole vastuvõtt.
   [Tõend](evidence/sol-proof-20261014-01/local-ui-open-semantics.json)
   **Parandatud 21.10:** asutusele saadetud ja avatud pöördumise seis on pöördujale „asutus avas {kuupäev}”;
   isikliku saaja vastuvõtt jääb „vastu võetud”. Asutuse sisemist tööle võtmist pöördujale ei avaldata, nagu enne.
   [Kontroll](evidence/sol-proof-20261014-01/local-ui-fix-sender-label-20261021.json)
4. **Teemaseemne privaatsuskontrolli valepositiivid.** Asutuste nimed ja ühendid „kliendi/juhtumi + sõna” loeti
   isikutuvastajateks ja kasutaja ei saanud teada, milline sõna lisamise peatas.
   [Tõend](evidence/sol-proof-20261014-01/local-topicseed-privacy.json)
   **Parandatud 21.10:** juhtumi number peab sisaldama numbrit; suurtähepaar ei ole nimi, kui üks sõna on asutus
   või koht (linnad ja omavalitsused asustusüksuste failist, maakonnad); nimi tuvastatakse nüüd ka „Õ”-ga algades.
   Jagamise peatamisel näeb omanik oma sõnu, mis kontrolli peatasid (ainult selles vastuses, ei logita).
   [Kontroll](evidence/sol-proof-20261014-01/local-ui-fix-covision-topicseed-20261021.json)
5. **Kovisiooni „Nõustun kokkuleppega” on aktiivne enne seadete kinnitamist** ja vajutus annab üldise 409-teate.
   [Tõend](evidence/sol-proof-20261014-01/local-ui-covision.json)
   **Parandatud 21.10:** nupp on lukus, kuni juhtumi tooja on seaded kinnitanud, ja põhjus on näha; kutsutu
   kärbitud seansivaade ütleb ainult, kas seaded on kinnitatud.
   [Kontroll](evidence/sol-proof-20261014-01/local-ui-fix-covision-topicseed-20261021.json)
6. **Supervisiooni sulgemise viisard lubab lõpliku vajutuse ilma kohustusliku üldistatud pealkirjata.**
   [Tõend](evidence/sol-proof-20261014-01/local-ui-supervision.json)
   **Parandatud 21.10:** lõplik vajutus on lukus ja põhjus on näha, kuni pealkiri puudub.
   [Kontroll](evidence/sol-proof-20261014-01/local-ui-fix-supervision-close-20261021.json)
7. **Pärast autori konto kustutamist lähevad saaja vaated lahku.** **Ei olnud viga (21.10):** esimene jooks luges
   tööjärge laadimise ajal. Pärast laadimist näitab tööjärg „Uued · 1” ja rida „Kustutatud kasutaja pöördumine”,
   sama kirjet loeb laud. [Kordusmõõtmine](evidence/sol-proof-20261014-01/local-ui-casework-board-recheck.json)
8. **Maksekirjade skript loeb värava 503 vastuse olekuks „töötaja välja lülitatud”.**
   [Tõend](evidence/sol-proof-20261014-01/server-jobs-and-deadline.json)
   **Parandatud 21.10:** `scripts/payment-emails.mjs` eristab vastuse sisu järgi suletud avamisvärava
   (`platform_not_open`: veateade, väljumiskood 1) ja töötaja konfiguratsioonis väljalülituse (väljumiskood 0).
   Kas taustatööd peavad suletud režiimis jooksma, on punkt 22. [Kontroll](evidence/sol-proof-20261014-01/local-fix-verify-20261021.json)

## B. Vestlus ja RAG

Kõik punktid peale viimase tulevad 50 küsimuse testist sotsiaal.pro peal (väljalase `12cdf6cc`, korpus v92).
[Tõend](evidence/sol-proof-20261014-01/server-rag-chat-50.json)
**Juhise vead 12, 14, 15, 16: tehtud 21.10 koodis**, juhise versioon `m4-grounded-dialogue-44`
([ADR-153](../rag-v2/adr-153-request-fit-not-found-units-and-help-seeker-steps.md)); mudeli käitumine mõõdetakse
samade küsimustega serveris. Paranduse eelne märkus „server keeldub, kuni plaan on uuendatud” oli liiga range:
väljalase uuendab kinnitatud vestlusplaani uuele koodile ise (omaniku otsus 27.09.2026, `renewChatPlan`); muutuvad
ainult koodi väljad, kasutajad, eelarve ja otsinguprofiil jäävad samaks.
**Otsingu ja sisu punktid jäävad RAG-i töösuunale:**
- **Otsing (uus profiil, nt chat-v7, 9):** seaduse sisesed viited („käesoleva seaduse § 72 lõikes 2”) järgida ka
  teiste radade lisatud lõikudes, mitte ainult algselt valitud lõikudes; välistuse viidetele („välja arvatud …
  nimetatud isikul”) eraldi koht. Uus profiil vajab uut omaniku kinnitatud plaani, sest profiil kuulub kinnitatud
  ulatusse; põhjus tuleb enne kinnitada serveri otsingujäljega.
- **Sisu:** KOV-i kohustuslike teenuste loetelu üks lõik korpusesse (18a); G13 (PKS § 96 hooldekodu sõnastusega)
  kontrollida otsinguplaani ja järjestuse jäljega (10).

9. **§ 95 juurde ei tule § 72 lg 2 välistust (G33).** Toetatud elamise küsimus alkoholisõltuvuse kohta jäi
   välistuseta, kuigi § 88 (G04) ja § 98 (G34) juurde tuli sama lõik kaasa. Kaaslõigu reegel on ebaühtlane.
   Diagnoos 21.10 (koodi lugemine): seaduse sisesed viited („käesoleva seaduse § 72 lõikes 2”) järgib rada
   `query.references` (`lib/rag-v2/search/retrieval.js`), kuid see loeb ainult algselt valitud lõike, mitte teiste
   radade lisatud lõike; kui § 95 jõudis paketti lisarajana, jäi tema viide järgimata. Pöördumise diagnostikas
   otsingujälge ei olnud, seega põhjus tuleb kinnitada serveri otsingujäljega.
10. **Hooldekodu kohatasu küsimus ei leia PKS § 96 ülalpidamiskohustust (G13).** Otsene küsimus (G49) leiab.
11. **§ 133 lg 8 (sugulaselt üür) loetakse kitsalt (G09).** Vastus lisab koos elamise tingimuse ja ütleb, et mujal
    elavale emale makstud üür võib arvesse minna. Enne parandust kinnitab tõlgenduse omaniku ja spetsialisti hinnang.
12. **Tööampsu kuupiir sõnastatakse „kuni 8 kalendripäeva kuus” (N01, R03, R04).** Allikas: leping kuni
    8 kalendripäeva, kuus kuni 8 tööpäeva. Juhis 44 seda **ei parandanud** (kordustest: kolmes vastuses
    sama ühik); põhjus on sõna „kalendrikuus” → „kalendripäeva”. Ka juhis 45 (ühiku sõna kuulub selle sõna juurde, mille kõrval ta
    allikas seisab) ei parandanud seda: 0/3. **Juhisega edasi ei parandata;** see on sõnastuse ebatäpsus (iga töötatud
    päev on kalendripäev), mille raskuse hindavad omanik ja spetsialist (RAG-12). Ka 20.10 ootus „tööpäeva” oli
    ebatäpne: allikas ütleb „töötamispäevade arv”.
    [Kordustest 44](evidence/sol-proof-20261014-01/server-rag-chat-prompt44.json),
    [kordustest 45](evidence/sol-proof-20261014-01/server-rag-chat-prompt45.json)
13. **v89 VIPS-i ja astmelise abi materjal ei jõua VIPS-i küsimuse paketti (U01).** Paketis oli üks varasem TAI leht.
    Enne kontrolli, kas v89 failid piloodi aega üldse nimetavad.
14. **Teemavälise palve keeldumine kõlab teabepuudusena (B01).** „Pole piisavalt teavet” asemel peaks vastus ütlema,
    milleks vestlus on mõeldud. **Parandatud 21.10 (juhis 44), serveris kontrollitud:** „See vestlus aitab
    sotsiaalhoolekande, toetuste, teenuste … küsimustes. Küsi julgelt …”.
    [Kordustest](evidence/sol-proof-20261014-01/server-rag-chat-prompt44.json)
15. **Olematu toetuse korral ei öelda selgelt, et sellist toetust allikates ei ole (X01).** **Parandatud 21.10 (juhis
    44), serveris kontrollitud:** „Sellise 300-eurose eakate digitoetuse taotlemise korda ma oma teabest ei leidnud.
    See ei ütle, kas toetus on olemas.” [Kordustest](evidence/sol-proof-20261014-01/server-rag-chat-prompt44.json)
16. **Abiotsija vastusest jäävad vahel olulised järgmised sammud välja:** tööampsu piiri ületamise tagasiulatuv
    lõpetamine (N01; spetsialisti vaates oli olemas) ja hooldekodu kohatasu puudujäägi muud teed (G02). **N01 osa
    parandatud 21.10 (juhis 44), serveris kontrollitud:** abiotsija vastuses on nüüd tagasiulatuv lõpetamine ja
    tagasimaksmine. **G02 osa ei ole juhise viga:** 20.10 paketis ei olnud ühtki muud teed (ülalpidamiskohustus, KOV),
    see on otsingu küsimus nagu punkt 10. [Kordustest](evidence/sol-proof-20261014-01/server-rag-chat-prompt44.json)
17. **Keelevead:** G04 „Kui su isa 70-aastasel isal…”, G42 „peab sa elama”.
18a. **Päevakeskuse küsimusele (RAG-06 E9, 21.10) ei saa vastust:** pakett ei sisalda KOV-i kohustuslike teenuste
    loetelu (teenused on seaduses eraldi paragrahvides), vastus jätab küsimuse lahtiseks. Valeväidet ei olnud.
    [Tõend](evidence/sol-proof-20261014-01/server-rag-chat-rag06-rag07.json)
18b. **„Kes on parim teenuseosutaja” vastusest jääb välja, et koduteenust korraldab linn (E7, 21.10).**
18. **Ebaselge plaani korral seotakse esimeses isikus küsimus eelmise fookusisiku omavalitsusega** (NOT_PROVEN:
    kohalik komponendikatse, päris sagedust ei mõõdetud). [Tõend](evidence/sol-proof-20261014-01/local-rag-dialogue-places.json)

## C. Puuduv funktsioon

19. **Töö tähtaeg `dueAt` puudus kasutusrajal** (MISSING_FEATURE). [Tõend](evidence/sol-proof-20261014-01/server-jobs-and-deadline.json)
    **Tehtud 21.10:** koordinaator paneb lahtisele kirjele tähtaja (Eesti kalendripäev) või eemaldab selle; kirje ja
    loend näitavad tähtaega ja „üle tähtaja”; möödunud päeva ei saa valida; auditisse ainult kuupäev. Õigusliku
    menetlustähtaja algus on eraldi GOV-01 küsimus. [Kontroll](evidence/sol-proof-20261014-01/local-ui-fix-c19-c21-20261021.json)
20. **Supervisiooni osaleja kutsuti sisemise kasutaja ID-ga.** [Tõend](evidence/sol-proof-20261014-01/local-ui-supervision.json)
    **Tehtud 21.10:** kutse e-posti järgi; puuduv konto ja sobimatu roll annavad sama vastuse.
    [Kontroll](evidence/sol-proof-20261014-01/local-ui-fix-c19-c21-20261021.json)
21. **Kovisiooni kutse oli kutsutu loendis tühja pealkirjaga kaart** (20.10 vaatlus „ei näidata kusagil” oli liiga
    tugev: kaart oli olemas, aga märkamatu). [Tõend](evidence/sol-proof-20261014-01/local-ui-covision.json)
    **Tehtud 21.10:** kaart ütleb „Kutse Kovisiooni”, et sisu avaneb pärast rolli ja kokkuleppe kinnitamist, ja nupp
    on „Vaata kutset”; e-kiri läheb uuesti teele, sest teavitustöö jookseb suletud režiimis (22).
    [Kontroll](evidence/sol-proof-20261014-01/local-ui-fix-c19-c21-20261021.json)

## D. Vajab enne parandust omaniku otsust

22. **Suletud avamisvärav keelab võtmega taustatööd:** teavitused, välitöö turvakontroll, kiire abi aegumine,
    praktikate ülevaated ja kovisiooni kutsekirjad. [Tõend](evidence/sol-proof-20261014-01/server-jobs-and-deadline.json)
    **Otsustatud ja tehtud 21.10:** omanik: jooksevad ka suletud režiimis. `lib/publicPlatform.js` laseb värava
    tagant läbi `/api/jobs/notifications` ja `/api/jobs/practice-reviews` (mõlemad kontrollivad oma võtit).
    [Kontroll](evidence/sol-proof-20261014-01/local-ui-admin-role-caption-20261021.json)
    **Raha ja andmeekspordi tööd, otsustatud ja tehtud 21.10:** omanik „jah, tohib”. Värava tagant läbi lastakse ka
    subscription-renewals, subscription-reconcile, payment-emails, usage-reservation-reaper ja data-exports
    (`82d9eccb`); igaüks kontrollib oma võtit ja raha- ning kasutustööd käivituvad ainult oma `*_ENABLED` lipuga.
    Serveris pärast paigaldust ilma võtmeta: need viis vastavad 401 (marsruut), muu `/api/jobs/…` 503 (värav).
    Kas serveris on nende tööde ajastus ja lipud olemas, ei ole kontrollitud (repos on ajastus ainult teavitustööl).
23. **Admin ilma vaaterollita vastab vestluses spetsialistina** (`lib/authz.js:33`).
    **Otsustatud ja tehtud 21.10:** omanik: näita aktiivset rolli. Vestluses on admini S/P/T lüliti kõrval kiri
    „Vastan kui: Sotsiaaltöö spetsialist” (või valitud roll); vaikimisi käitumine sama.
    [Kontroll](evidence/sol-proof-20261014-01/local-ui-admin-role-caption-20261021.json)

## E. Protsess

24. **`docs/audits/**` muudatused ei käivita `quality-gate`-i, kuid täislint kontrollib sealseid `.mjs` tõendiskripte.**
    14.10 skripti lint-viga peatas seetõttu alles 20.10 koodimuudatuse paigalduse. 21.10 tõendiskriptid linditi enne
    lükkamist.

## Enne RAG-parandusi: inimhinnang (RAG-12)

Need ei ole veel parandused. Omanik ja spetsialist hindavad sõltumatult, kas vastus või eelregistreeritud ootus oli õige:
G05 (tagasinõude aegumine, TsÜS § 151 valik), G06 (kas ootus oli liiga kitsas), G09 (§ 133 lg 8 ulatus),
G13 (puuduva ülalpidamiskohustusega vastuse ohutus) ja C01 (kriisivastuse sõnastus).
