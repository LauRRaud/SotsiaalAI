# Sotsiaal.pro parandusnimekiri — Soli tõenduskatsete leiud

Seis 20.10.2026. Siin on ühes kohas kõik, mida Soli tõenduskatsed (`sol-proof-20261014-01`) leidsid ja mida
tuleb Astra/Fable arendusetapis parandada või otsustada. Tõenduskatsete ajal parandusi ei tehtud
(`productFixesDuringBaseline: false`), seega on kõik punktid avatud. Enne parandust kontrolli, kas mõni on vahepeal
juba tehtud. Täpne kirjeldus ja mõõtmise piirid on [Soli aruandes](sotsiaal-pro-toenduskatsete-tulemused-sol-proof-20261014-01.md),
toorandmed kaustas `evidence/sol-proof-20261014-01/`.

## A. Kinnitatud vead

1. **Võrgustikujagamine katkeb pärast vastuvõttu (`network_share.source_inactive`).** Spetsialist saab jagamise
   mustandi teha enne vastuvõttu, kuid vastuvõtt viib pöördumise olekusse READY ja sama lubatud jagamine keeldub
   (arendusülesanne D01). Valmis, kui jagamine töötab ka READY olekus ning saajaõigus, kliendi jagamiskinnitus,
   tagasikutsumine ja sulgemise piir säilivad. [Tõend, FLOW-08](evidence/sol-proof-20261014-01/server-baseline.json)
2. **Saabumiskiri eirab konto e-postiteavituse eelistust.** Omaniku otsus: eelistust tuleb arvestada. Valmis, kui
   `lib/preInquiries.js` peatab saatmise enne transpordi kutset, kui teavitus on välja lülitatud; sisselülitatud
   konto neutraalne kiri ja ebaõnnestunud saatmise aus tulemus jäävad. [Tõend](evidence/sol-proof-20261014-01/server-safety-mail.json)
3. **Pöörduja näeb „vastu võetud”, kui asutuse koordinaator kirje ainult avab.** Avamine ei ole vastuvõtt.
   [Tõend](evidence/sol-proof-20261014-01/local-ui-open-semantics.json)
4. **Teemaseemne privaatsuskontrolli valepositiivid.** Asutuste nimed ja ühendid „kliendi/juhtumi + sõna” loetakse
   isikutuvastajateks ja kasutaja ei saa teada, milline sõna lisamise peatas.
   [Tõend](evidence/sol-proof-20261014-01/local-topicseed-privacy.json)
5. **Kovisiooni „Nõustun kokkuleppega” on aktiivne enne seadete kinnitamist** ja vajutus annab üldise 409-teate.
   [Tõend](evidence/sol-proof-20261014-01/local-ui-covision.json)
6. **Supervisiooni sulgemise viisard lubab lõpliku vajutuse ilma kohustusliku üldistatud pealkirjata.**
   [Tõend](evidence/sol-proof-20261014-01/local-ui-supervision.json)
7. **Pärast autori konto kustutamist lähevad saaja vaated lahku.** Tööjärg näitab „Uued 0”, juhtumitöö laud loeb
   pöördumist edasi ja link viib tühja kohta; API tagastab kirje `authorErasedAt` märkega. Kas saaja peab
   tühjendatud kirjet nägema, on tooteotsus; vastuolu tuleb igal juhul kaotada.
   [Tõend](evidence/sol-proof-20261014-01/local-ui-casework-board.json)
8. **Maksekirjade skript loeb värava 503 vastuse olekuks „töötaja välja lülitatud”.**
   [Tõend](evidence/sol-proof-20261014-01/server-jobs-and-deadline.json)

## B. Vestlus ja RAG

Kõik punktid peale viimase tulevad 50 küsimuse testist sotsiaal.pro peal (väljalase `12cdf6cc`, korpus v92).
[Tõend](evidence/sol-proof-20261014-01/server-rag-chat-50.json)

9. **§ 95 juurde ei tule § 72 lg 2 välistust (G33).** Toetatud elamise küsimus alkoholisõltuvuse kohta jäi
   välistuseta, kuigi § 88 (G04) ja § 98 (G34) juurde tuli sama lõik kaasa. Kaaslõigu reegel on ebaühtlane.
10. **Hooldekodu kohatasu küsimus ei leia PKS § 96 ülalpidamiskohustust (G13).** Otsene küsimus (G49) leiab.
11. **§ 133 lg 8 (sugulaselt üür) loetakse kitsalt (G09).** Vastus lisab koos elamise tingimuse ja ütleb, et mujal
    elavale emale makstud üür võib arvesse minna. Enne parandust kinnitab tõlgenduse omaniku ja spetsialisti hinnang.
12. **Tööampsu kuupiir sõnastatakse „kuni 8 kalendripäeva kuus” (N01, R03, R04).** Allikas: leping kuni
    8 kalendripäeva, kuus kuni 8 tööpäeva.
13. **v89 VIPS-i ja astmelise abi materjal ei jõua VIPS-i küsimuse paketti (U01).** Paketis oli üks varasem TAI leht.
    Enne kontrolli, kas v89 failid piloodi aega üldse nimetavad.
14. **Teemavälise palve keeldumine kõlab teabepuudusena (B01).** „Pole piisavalt teavet” asemel peaks vastus ütlema,
    milleks vestlus on mõeldud.
15. **Olematu toetuse korral ei öelda selgelt, et sellist toetust allikates ei ole (X01).**
16. **Abiotsija vastusest jäävad vahel olulised järgmised sammud välja:** tööampsu piiri ületamise tagasiulatuv
    lõpetamine (N01; spetsialisti vaates oli olemas) ja hooldekodu kohatasu puudujäägi muud teed (G02).
17. **Keelevead:** G04 „Kui su isa 70-aastasel isal…”, G42 „peab sa elama”.
18. **Ebaselge plaani korral seotakse esimeses isikus küsimus eelmise fookusisiku omavalitsusega** (NOT_PROVEN:
    kohalik komponendikatse, päris sagedust ei mõõdetud). [Tõend](evidence/sol-proof-20261014-01/local-rag-dialogue-places.json)

## C. Puuduv funktsioon

19. **Töö tähtaeg `dueAt` puudub kasutusrajal** (MISSING_FEATURE). Õiguslik tähtaeg on eraldi GOV-01 küsimus.
    [Tõend](evidence/sol-proof-20261014-01/server-jobs-and-deadline.json)
20. **Supervisiooni osaleja kutsutakse sisemise kasutaja ID-ga** ja kasutajaliides ei ütle, kust seda leida.
    [Tõend](evidence/sol-proof-20261014-01/local-ui-supervision.json)
21. **Kovisiooni kutse jõuab kutsutuni ainult e-kirjaga**, mida serveris suletud värav praegu ei lase saata (vt 22).
    [Tõend](evidence/sol-proof-20261014-01/local-ui-covision.json)

## D. Vajab enne parandust omaniku otsust

22. **Suletud avamisvärav keelab võtmega taustatööd:** teavitused, välitöö turvakontroll, kiire abi aegumine,
    praktikate ülevaated ja kovisiooni kutsekirjad. Kas need peavad suletud režiimis jooksma?
    [Tõend](evidence/sol-proof-20261014-01/server-jobs-and-deadline.json)
23. **Admin ilma vaaterollita vastab vestluses spetsialistina** (`lib/authz.js:33`). Testides on seda lihtne märkamata
    jätta; kas vaikimisi roll peaks olema nähtav või valitav?

## E. Protsess

24. **`docs/audits/**` muudatused ei käivita `quality-gate`-i, kuid täislint kontrollib sealseid `.mjs` tõendiskripte.**
    14.10 skripti lint-viga peatas seetõttu alles 20.10 koodimuudatuse paigalduse.

## Enne RAG-parandusi: inimhinnang (RAG-12)

Need ei ole veel parandused. Omanik ja spetsialist hindavad sõltumatult, kas vastus või eelregistreeritud ootus oli õige:
G05 (tagasinõude aegumine, TsÜS § 151 valik), G06 (kas ootus oli liiga kitsas), G09 (§ 133 lg 8 ulatus),
G13 (puuduva ülalpidamiskohustusega vastuse ohutus) ja C01 (kriisivastuse sõnastus).
