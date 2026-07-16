# Fable 5: Supervisiooni tootemudel ja ruumiline teekond

STATUS: COMPLETE (Q1, osad 1–13)
Q2 STATUS: COMPLETE (V0 tehniline tööplaan, 12/12 osa — vt Q2 peatükk dokumendi lõpus)
Kuupäev: 15.07.2026
Koostaja: Fable 5
Viimane lõpetatud osa: 13 (jätkamispunkt teiseks küsimuseks)
Jätkamispunkt: vt osa 13.

Tõendusalus:

- `docs/platvormi arendus/supervisioon/supervisioon materjalid.md` (allikaregister, ainus fail kaustas);
- `docs/platvormi arendus/fable-5-uue-akna-orientatsioon-ja-teadmistekaart.md` (platvormi seis, main @ 80848212);
- `docs/platvormi arendus/ruumilise-kogemuse-lahtekoht.md` (ruumigrammatika);
- kerge main-i kontroll: grep `supervis*` kogu koodibaasis, `prisma/schema.prisma` sihitud lugemine, `lib/wellbeing/supportDrafts.js`, `data/mentoring/esta-mentor-seed.json`;
- veebikontroll 15.07.2026: eswa.ee (avaleht, /mentorlus/), supervisioon.ee (avaleht), otsingud ESTA supervisiooni-rolli kohta.

Reegel: see dokument EI ole rakendusvalmis tehniline tööplaan. Koodi, skeemi ega migratsioone ei muudetud.

---

## 1. Juhtkokkuvõte

1. **Supervisioon on SotsiaalAI-s väljaõppinud superviisori juhitud professionaalse refleksiooni protsess** — kohtumiste seeria kokkuleppe (kontrakti) raames, mitte üksik vestlus ega kovisiooni duplikaat. Kovisioon on võrdsete kolleegide vastastikune meetod ilma superviisorita; supervisiooni juhib kvalifitseeritud protsessijuht. Mõlemad jäävad platvormil eraldi mooduliteks, mis kasutavad sama taristut.
2. **Platvormi roll on protsessi konteiner, mitte superviisori asendaja.** Platvorm hoiab kokkulepet, teemasid, osalejate privaatset ettevalmistust, ühiselt kinnitatud kokkuvõtteid ja jätkuvust; kohtumine ise võib toimuda platvormi ruumis või täielikult väljaspool (füüsiline ruum). AI teeb ainult mustandeid kasutaja palvel.
3. **Konfidentsiaalsuse kolmnurk (tellija–superviisor–osaleja) on mudeli süda:** tellija/tööandja ei näe kunagi protsessi sisu — ainult toimumise fakte ja ühiselt kinnitatud üldistatud kokkuvõtet, kui see on kontraktis kokku lepitud. MVP-s tellija-vaadet platvormile ei ehitata üldse.
4. **Superviisor on kontrollitav lisatiitel (võimekus), mitte uus kasutajagrupp** — sama muster nagu parimate praktikate retsensent (`EffectivePracticeReviewAssignment` grant). Kvalifikatsiooni referents Eestis on ESCÜ/ANSE, mitte ESTA.
5. **ESTA tõendatud roll täna: mentorite andmebaasi haldaja ja töötajate huvikaitsja, mitte supervisiooniteenuse osutaja ega superviisorite kvalifitseerija.** SotsiaalAI ei tohi kasutada „ESTA kontrollitud" märgist ega eeldada partnerlust ilma sõlmitud kokkuleppeta (vt 3.1).
6. **Väikseim kasulik versioon on protsessi mälu + teadlik jagamine:** superviisori tiitel, protsess kontrakti ja osalejate nõusolekuga, osaleja privaatne ettevalmistus, kohtumine olemasolevas ruumitaristus, ühiselt kinnitatud kokkuvõte, lõpetamine koos detailide kustutusega. Ei mingit tellija-portaali, arveldust, sobitusturgu ega uut lõuendimootorit.
7. **Ruumiline soovitus: variant A „Supervisiooniruum eeskambriga"** — püsiv ruum majas, kus privaatne eeskamber ja ühine laud on füüsiliselt eristatud alad ning uks/lävi kannab konfidentsiaalsuspiiri tähendust. Flight-teekond jääb osaleja sisemise ettevalmistusvoo hilisemaks võimaluseks, mitte protsessi põhikujuks.
8. **Taaskasutus on suur:** ruumid+kutsed+kõned+nõusolekupõhine salvestus, U1/U2 teavitused, U12 jagamiste loendatavus, shareKeys→eelvaade→kinnitus muster, Tööheaolu väljundmustand (mille `recipientType` väärtus `"supervisor"` on juba main-is), kovisiooni serverimustrid (CAS, IDOR, atomaarne sulgemine + purge, omanikupakk). Uut ehitust vajab protsessi/kontrakti/kohtumise andmemudel, tiitli grant, nõusolekuvoog ja kinnitusvoog.

## 2. Supervisiooni metodoloogiline alus

Allikad: `supervisioon materjalid.md` register (loetud viidetena; sisuväiteid kasutan registris endas fikseeritud kokkuvõtete ulatuses).

- **Määratlus:** supervisioon on süsteemne nõustamisprotsess, mida juhib väljaõppinud superviisor (Vikipeedia; ESCÜ). See eristab supervisiooni kovisioonist (võrdsete kolleegide vastastikune refleksioon ilma juhita), mentorlusest (kogenum kolleeg jagab kogemust) ja coachingust (eesmärgipõhine arengupartnerlus) — eristuse ankur on Goodwill & Partners ja TAI/Paşcu 2024 „Töönõustamise eri liigid sotsiaaltöös", mis asetab supervisiooni, grupinõustamise ja kovisiooni kõrvuti. Platvorm peab neid termineid kasutama järjekindlalt ega tohi esitada mentorit superviisorina.
- **Kolm funktsiooni (Proctor):** formatiivne (õppimine ja professionaalne areng), normatiivne (kvaliteet, standardid, eetika) ja restoratiivne (taastumine, toetus, läbipõlemise ennetus). Toote tähendus: supervisiooniprotsessi väljundid peavad teenima kõiki kolme, aga normatiivne funktsioon EI muutu platvormil töösoorituse hindamiseks — see jääb superviisori ja osaleja vaheliseks professionaalseks raamiks.
- **Seitsmesilmne mudel (Hawkins & Shohet):** superviisor võib vaadata juhtumit seitsme fookuse kaudu (klient, sekkumised, suhe, töötaja, supervisioonisuhe, superviisor ise, laiem kontekst). Toote tähendus: see on superviisori metoodiline tööriist, mida platvorm võib pakkuda vaatenurkade struktuurina superviisori kutsel — mitte automaatse analüüsiraamina.
- **Grupisupervisiooni tõendus (Merkuljeva doktoritöö):** väline grupisupervisioon võib sotsiaaltöötaja töösooritust positiivselt mõjutada, kui protsess koosneb vähemalt viiest kohtumisest ja osaletakse motiveeritult. Toote tähendus: protsess on seeria, mitte üksiksündmus — andmemudel ja UI peavad kandma kohtumiste jada; vabatahtlikkus/motivatsioon tähendab, et osaleja liitub teadliku nõusolekuga, mitte tööandja määramisega platvormi kaudu.
- **Meetodite mitmekesisus:** psühhodraama kogemus asenduskodude kasvatajatega (TAI) näitab, et superviisorid kasutavad eri meetodeid. Platvorm ei fikseeri meetodit — struktuur peab mahutama superviisori valitud töövormi.
- **Kvalifikatsioon:** superviisori väljaõpe kestab ANSE raamistikus minimaalselt 2,5 aastat; Eestis hoiab standardeid ja kvaliteedisüsteemi ESCÜ (kvaliteeditasemega liikmete avalik register — veebikontroll 15.07: „Leia kõigi liikmete seast" / „Leia kvaliteeditasemega liikmetest"). Toote tähendus: superviisori tiitli tõendusallikas on olemas ja avalik, aga märgistus platvormil peab olema aus („viide ESCÜ registrile"), mitte omistatud kinnitus.
- **Eetika:** ESTA eetikakäsiraamat katab nii supervisiooni kui kovisiooni — konfidentsiaalsus, piirid ja professionaalne vastutus on valdkonna normid, mitte platvormi leiutis.

## 3. Sihtrühmad ja supervisiooni vormid

**Kellele:** esmane sihtrühm on sotsiaaltöö spetsialistid (SOCIAL_WORKER) — nii üksiktöötajad kui meeskonnad; teisene sihtrühm on teenuseosutajate (SERVICE_PROVIDER) meeskonnad (nt hooldekodu, asenduskodu, rehabilitatsioonikeskus — TAI psühhodraama-artikli kontekst). Eluküsimusega pöördujale (CLIENT) supervisioon ei ole suunatud ega nähtav.

**Toetatavad vormid (platvormi mõistes protsessitüübid):**

1. **Individuaalsupervisioon** — üks osaleja + superviisor. Lihtsaim konfidentsiaalsusruum.
2. **Grupisupervisioon** — eri asutuste (või sama asutuse) töötajad, keda ühendab valdkond; Merkuljeva tõendusbaas; tüüpiliselt ≥5 kohtumist.
3. **Meeskonnasupervisioon** — ühe asutuse meeskond, sageli koos juhiga; erisus: võimusuhted grupis, mille haldamine on superviisori (mitte platvormi) töö; platvorm peab vaid tagama, et juht ei saa teiste privaatseid sisendeid näha.
4. **Organisatsiooni supervisioon** (Kaljakin) — juhtkonna ja struktuuri tasand; **teadlikult MVP-st ja V1-st väljas**, sest eeldab organisatsioonikihti, mida platvormil pole (orientatsioonikaart: teadlik otsus mitte enne esimest pilooti).

**Toimumisviisid:** platvormi veebikohtumine (olemasolev ruumi+kõne taristu), füüsiline kohtumine väljaspool platvormi (platvorm = ettevalmistus, kokkulepped, järelväljundid) või hübriid. See on oluline reaalsuspiir: suur osa Eesti supervisioonist toimub kontaktkohtumistena; platvorm annab väärtust ka siis, kui ta kohtumist ennast ei kanna.

### 3.1. ESTA roll: tõendatud seis ja võimalikud tulevikurollid

Kontroll 15.07.2026 (eswa.ee avaleht ja /mentorlus/; otsingud; supervisioon.ee; repo `data/mentoring/esta-mentor-seed.json`).

**Mida ESTA tõendatult teeb:**

- **Mentorluses: võrgustiku/andmebaasi haldaja, mitte teenuse osutaja.** ESTA peab avalikku sotsiaalvaldkonna mentorite andmebaasi („Mentorite andmebaas on valminud Sotsiaalministeeriumi strateegilise partnerluse projekti rahastuse abil"). Kasutaja valib mentori ise ja võtab otse ühendust; tasu lepitakse kokku mentori ja mentee vahel; sihtrühm on sotsiaalvaldkonna asutuste ja KOV-ide töötajad (mitte ainult ESTA liikmed). ESTA ei vahenda ega hinnasta teenust.
- **Supervisioonis: huvikaitsja ja teavitaja, mitte korraldaja.** ESTA avalehe menüüs supervisiooni teenust ei ole; supervisiooni käsitletakse huvikaitse-prioriteedina (ligipääs regulaarsele supervisioonile kui töötaja õigus) ja eetikakäsiraamatu osana. Üksik uudislugu „Supervisioon eesliini töötajatele!" viitab tõenäoliselt COVID-aegsele algatusele koostöös superviisorite kogukonnaga (ESCÜ suunal), kuid lehe sisu ei ole enam kättesaadav (ESCÜ /sotsiaalvaldkond/ alamleht annab 404) — seda ei saa lugeda püsiteenuse tõendiks.
- **Kutse andmine: sotsiaaltöötaja kutse, mitte superviisori oma.** ESTA hindab sotsiaaltöötajate vastavust kutsestandardile. Superviisorite kvalifikatsiooni ja kvaliteedisüsteemi hoiab ESCÜ (avalik register, kvaliteeditasemed, eetikajuhised; ANSE katusorganisatsioon).
- **Repo seis:** `data/mentoring/esta-mentor-seed.json` (kontrollitud 24.05.2026) sisaldab ESTA avalikest profiilidest imporditud mentoreid staatusega `PENDING_CONSENT / EXTERNAL_REFERENCE` ja range poliitikaga: ei kuvata aktiivsete SotsiaalAI mentoritena ilma nõusolekuta, fotosid ei kopeerita, kontaktid admin-only. Mõne mentori bios on superviisori väljaõpe — see on isiku kvalifikatsioon, mitte ESTA teenus. Orientatsioonikaart kinnitab: ESTA partnerlus on kinnitamata, koodis 0 vastet.

**Hinnang võimalikele rollidele SotsiaalAI Supervisiooni tulevikumudelis:**

| Roll | Realistlikkus | Eeldus |
|---|---|---|
| Teenuse osutaja (ESTA osutab supervisiooni) | EI — ei vasta ESTA tänasele funktsioonile | — |
| Superviisorite võrgustiku haldaja / kvaliteedi kinnitaja | EI — see on ESCÜ/ANSE territoorium; ESTA-l pole superviisorite registrit | — |
| Mentorite võrgustiku haldaja, kelle andmebaasile platvorm viitab | JAH, juba täna võimalik viitena (EXTERNAL_REFERENCE, nagu seed teeb) | iga mentori individuaalne nõusolek aktiivseks profiiliks + ESTA nõusolek andmebaasi süstemaatiliseks kasutuseks |
| Metoodiline partner (eetikakäsiraamat, terminoloogia, piloodi kaasamine) | VÕIMALIK ja loogiline (eetikakäsiraamat on juba RAG-allikate registris) | sõlmitud kokkulepe; enne seda ainult avalike allikate viitamine tavapärase allikaviite kujul |
| Kasutajate suunaja (ESTA kanalid → platvorm; platvorm → ESTA mentorlus/ESCÜ register) | JAH, madalaima lävega roll | passiivne viitamine ei eelda midagi; aktiivne suunamiskampaania eeldab kokkulepet |

**Siduv piirang tootemudelile:** ühtegi „ESTA kontrollitud", „ESTA kinnitatud superviisor" vms märgist ei kasutata ilma ESTA-ga sõlmitud kokkuleppeta. Superviisori kvalifikatsiooni viide käib ESCÜ avaliku registri kaudu ja sõnastatakse viitena („ESCÜ kvaliteeditasemega liige — vaata registrit"), mitte platvormi ega ESTA antud kinnitusena. Sama loogika kehtib ESCÜ suhtes: ka nende nime ei kasutata partnerlusmärgisena ilma kokkuleppeta — avalik register on lihtsalt kontrollitav allikas.

## 4. Rollid

**Superviisor** — protsessi juht ja protsessiomanik platvormil:

- loob protsessi, sõnastab kontrakti (eesmärk, raam, kohtumiste arv, konfidentsiaalsusreeglid, tellija-nähtavuse kokkulepe), kutsub osalejad;
- juhib kohtumisi ja valib meetodi; platvorm ei sekku metoodikasse;
- tema tööpäevik/märkmed protsessi kohta on rangelt privaatsed (analoog: kovisiooni `CovisionPrivateState`);
- superviisori staatus on **admin-grant'iga antav kontrollitav lisatiitel** (muster: `EffectivePracticeReviewAssignment` — tähtaja ja alusega), mitte uus `UserRole`. Aluseks sobib ESCÜ registri avalik kontroll; tõendi vorm ja kontrollisagedus on tooteomaniku otsus (osa 12).
- superviisor võib platvormirollilt olla SOCIAL_WORKER või SERVICE_PROVIDER; tiitel on rollist sõltumatu võimekus.

**Osaleja (supervisant)** — refleksiooni subjekt ja oma info ainuomanik:

- liitub protsessiga ainult kontrakti teadliku kinnitamisega (nõusolek on protsessi liikmesuse eeldus);
- toob teemad ise; tema ettevalmistus ja isiklikud refleksioonid on privaatsed, kuni ta teadlikult jagab (shareKeys-laadne eelvaade → kinnitus);
- näeb alati, mida ta on protsessi jaganud (U12 „Minu jagamised" laieneb supervisioonile);
- võib protsessist lahkuda; lahkumine ei kustuta ühisesse alasse juba kinnitatud panuseid (nagu ruumidest lahkumine), kuid lõpetab uue sisu nähtavuse.

**Tellija (tööandja/KOV)** — teadlikult platvormilt väljas (MVP ja V1):

- kontrakt võib fikseerida, millise üldistatud lõppkokkuvõtte superviisor tellijale annab, aga selle üleandmine toimub väljaspool platvormi (e-kiri, dokument);
- platvormile tellija-vaadet, toimumis-dashboard'i ega osalusaruandlust ei ehitata enne, kui organisatsioonikihi otsus on tehtud — ja ka siis ainult k-anonüümse/fakti-tasandi mustriga (Tööheaolu koondi etalon).

**AI** — mustandiabiline kasutaja palvel (piirid osas 7).

## 5. Soovitatud põhiteekond

Teekond algusest jätkamiseni; iga samm nimetab, kes tegutseb.

1. **Protsessi loomine (superviisor).** Vorm/tüüp (individuaal/grupp/meeskond), pealkiri, eesmärk, kavandatud kohtumiste arv (vaikimisi ≥5 grupivormis — Merkuljeva), toimumisviis (platvormi ruum / väljaspool / hübriid). Superviisor koostab kontrakti — platvorm pakub struktuuri (konfidentsiaalsus, raam, tellija-nähtavus, salvestusreeglid), AI võib sõnastust aidata mustandina.
2. **Kutsed ja teadlik nõusolek (osalejad).** Kutse (olemasolev Invite-taristu laiendusena) avab kontrakti täisteksti; osaleja kinnitab või keeldub. Kinnitamata osaleja ei näe protsessi sisu. Nõusolek on kirje (kes, millal, millise kontraktiversiooniga).
3. **Kohtumise-eelne ettevalmistus (osaleja, privaatne).** Osaleja sõnastab teema/juhtumi/küsimuse oma privaatalas. Sisendiks võib tuua Tööheaolu väljundmustandi („supervisiooni küsimus" — `WellbeingOutputDraft.recipientType="supervisor"` on juba main-is) kasutaja kinnitusel. Jagamine gruppi/superviisorile käib eelvaate ja kinnitusega; jagatud teema muutub kohtumise tööobjektiks.
4. **Kohtumine.** Platvormi ruumis: olemasolev kõne + nõusolekupõhine salvestus (vaikimisi väljas; supervisioonis soovituslikult veel rangem — vt osa 12); ühine tööala kohtumise ajal (V1-s piisab ruumi sõnumitest/jagatud teemakaartidest, hiljem ühislõuend). Väljaspool: platvorm näitab kohtumise fakti (kuupäev, teemad kokkuleppel) ja kannab järeltööd.
5. **Kohtumise järel.** Osaleja privaatne järelrefleksioon (jääb talle); ühine kokkuvõte tekib AINULT teadliku koostamise ja kinnitamisega — superviisor (või määratud osaleja) koostab, AI võib teha mustandi kohtumisel ühisalasse pandud materjalist (mitte kõnest, kui salvestust polnud), kõik osalised näevad ja superviisor kinnitab; kinnitatud kokkuvõte on protsessi püsikirje.
6. **Jätkamine.** Järgmise kohtumise aeg ja teemajärjekord protsessis; U1 teavitused (fakt + viide, ilma sisuta) ja U2 „Jätka siit" toovad osaleja tagasi õigesse kohta (ettevalmistus ootab / kokkuvõte kinnitamata / kohtumine läheneb).
7. **Protsessi lõpetamine (superviisor algatab, osalejad kinnitavad).** Lõpurefleksioon; kui kontraktis kokku lepitud, koostatakse tellijale mõeldud üldistatud lõppkokkuvõte (kõigi osaliste kinnitusega; üleandmine väljaspool platvormi). Sulgemine on atomaarne (kovisiooni muster): igale osalejale jääb **isiklik õpipakk** (tema enda refleksioonid + kinnitatud ühiskokkuvõtted — `CovisionOwnerPackage` analoog), protsessi tööalade detailid (jagatud toorteemad, vahemärkmed, sõnumid) **kustutatakse**; alles jäävad ainult kinnitatud kokkuvõtted ja faktikiri (toimumised, osalus).
8. **Uus tsükkel.** Lõpetatud protsessist võib superviisor või osaleja algatada jätkuprotsessi (uus kontrakt); midagi ei kandu üle automaatselt.

## 6. Privaatsuse ja nõusoleku piirid

| Kiht | Sisu | Kes näeb | Püsivus |
|---|---|---|---|
| Privaatne (osaleja) | ettevalmistus, teemamustandid, järelrefleksioonid, Tööheaolu-sisendid | ainult osaleja ise; server jõustab, admin ei möödu (kovisiooni IDOR-etalon) | osaleja kontrolli all; protsessi sulgemine ei puuduta |
| Privaatne (superviisor) | tööpäevik, protsessimärkmed, hüpoteesid | ainult superviisor | superviisori kontrolli all |
| Protsessisisene jagatud | kontrakt, osalejate nõusolekud, jagatud teemad, kohtumise ühisala, kinnitamata kokkuvõttemustandid | ainult protsessi liikmed (superviisor + kinnitanud osalejad) | tööalade detailid kustutatakse sulgemisel (purge) |
| Kinnitatud püsiväljund | kohtumiste kinnitatud kokkuvõtted; lõpukokkuvõte; osaleja isiklik õpipakk | kokkuvõtted: protsessi liikmed; õpipakk: ainult omanik | jääb alles pärast sulgemist |
| Faktikiri | protsessi olemasolu, toimumiskuupäevad, osaluskinnitused | protsessi liikmed; (tulevikus tellijale ainult kontrakti alusel, platvormiväliselt) | jääb alles |

Teadlikku kinnitust nõuavad tegevused (iga punkt = eraldi eelvaatega kinnitus, mitte vaikimisi märgitud ruut):

1. kontraktiga liitumine (osaleja) ja kontrakti hilisem muutmine (kõik osalejad uuesti);
2. oma teema/materjali/Tööheaolu-väljavõtte jagamine protsessi (shareKeys-eelvaade);
3. kõne salvestamise alustamine (olemasolev nõusolekumuster; igal osalejal veto);
4. kohtumise kokkuvõtte kinnitamine püsikirjeks;
5. tellijale mineva lõppkokkuvõtte kinnitamine (superviisor + iga osaleja, keda tekst puudutab);
6. protsessi sulgemine (superviisor algatab; osalejad näevad, mis kustub ja mis jääb);
7. protsessist lahkumine (osaleja; nähtav teistele faktina).

## 7. Mida AI ei tohi teha

Püsivad keelud (kooskõlas platvormi põhimudeliga „AI teeb mustandeid, inimene kinnitab" ja mitte-ehitatavate nimekirjaga):

1. **Ei juhi protsessi ega asenda superviisorit** — AI ei modereeri kohtumist, ei jaga sõnavoore, ei „vea" etappe; supervisioonil pole kovisiooni-laadset AI-toetatud etapimasinat, sest meetod on superviisori oma.
2. **Ei hinda inimest** — mitte mingit osaleja „arengu", seisundi, läbipõlemisriski, osalusaktiivsuse ega töösoorituse skoori, ka mitte superviisorile. Restoratiivse funktsiooni toetamine ≠ seisundi mõõtmine.
3. **Ei tee organisatsioonile/tellijale midagi nähtavaks** — AI ei koosta tellija-raporteid toorandmetest; ainus tellijale minev tekst on inimeste kinnitatud üldistatud kokkuvõte; platvorm ei paku tööandjale osalus- ega sisuanalüütikat.
4. **Ei salvesta ega transkribeeri vaikimisi** — nõusolekupõhine salvestus jääb; „automaatne transkriptsioon+AI-kokkuvõte kõnedes" on püsivalt keelatud nimekirjas; supervisioonis on mõistlik vaikeseade „salvestus pole lubatud, kui kontrakt ei ütle teisiti".
5. **Ei ühenda andmeid ristmoodulitest omal algatusel** — Tööheaolu kirjed, vestlused, Teekond, kovisioonijuhtumid ei liigu supervisiooni automaatselt; iga sisend tuleb kasutaja teadliku üleandmisega.
6. **Ei anonümiseeri „usalda mind" põhimõttel** — kliendiandmete anonüümsus jagatavas teemas on inimese kinnitatav (kovisiooni anonüümsuskinnituse muster), AI võib ainult hoiatada ja soovitada.
7. **Ei soovita superviisorile sekkumisi inimeste kohta** („kes grupis vajab tähelepanu") ega profileeri osalejaid.

Mida AI TOHIB (kasutaja käivitatud, alati mustandina): refleksiooniküsimuste pakkumine osaleja ettevalmistuses; kontrakti ja kokkuvõtte sõnastusmustandid; superviisori kutsel struktuurivaated (nt seitsmesilmse mudeli vaatenurgad valitud teemale — allikapõhiselt, RAG-i teadmusbaasist); selge keele tugi.

## 8. Väikseim kasulik esimene versioon

**V0 — protsessi mälu (ilma uue kohtumiskanalita):**

- superviisori tiitel (admin-grant, alus + tähtaeg);
- protsess: tüüp, kontrakt (tekstistruktuur), osalejad, kohtumiste kava;
- kutse + kontrakti nõusolekuvoog;
- osaleja privaatne ettevalmistusala + teadlik teemajagamine (eelvaade→kinnitus);
- kohtumise faktikiri (toimus kuupäeval X; teemad kokkuleppel) — kohtumine ise toimub kus tahes (sh füüsiliselt);
- kinnitatud kohtumis- ja lõpukokkuvõtted;
- sulgemine: isiklik õpipakk + tööalade purge (kovisiooni muster);
- U1/U2 integratsioon (teavitused, „Jätka siit").

V0 väärtus: Eesti supervisioonipraktika on suures osas kontaktkohtumised — protsessi konteiner (kontrakt, teemad, kokkuvõtted, jätkuvus, konfidentsiaalsuspiirid) on väärtus ka ilma videokõneta, ja see on täpselt see osa, mida ükski üldine videotööriist (Teams/Zoom) ei paku.

**V1 — + platvormi kohtumine:**

- protsessiga seotud ruum (olemasolev Room+kõne+nõusolekusalvestus);
- jagatud teemakaardid kohtumise ühisalas;
- kokkuvõttemustand ühisala materjalist (AI, kinnitusega).

**Teadlikult väljas (kuni eraldi otsuseni):** tellija-vaade ja organisatsioonikiht; arveldus/tasud (tasu lepitakse platvormiväliselt, nagu ESTA mentorlusmudelis); superviisorite turg/sobitus („leia superviisor" kataloog — sõltub ESCÜ/ESTA kokkulepetest); organisatsiooni supervisioon; supervisioonist parimate praktikate kandidaadid (kovisiooni rada olemas, dubleerimine vajab eraldi otsust); uus lõuendimootor.

## 9. Kaks ruumilist varianti

Mõlemad kasutavad ruumigrammatikat (sein/laud/kapp/uks/lävi) ja täidavad ligipääsetavuspiirid (klaviatuur, `prefers-reduced-motion` lame variant, otselingid igasse seisundisse).

### Variant A: „Supervisiooniruum eeskambriga" (püsiv ruum majas)

Maja plaanis on kovisiooni- ja supervisiooniruumid juba ette nähtud (lähtekoht §4.1). Supervisioon on **uks fuajees/professionaali stuudios**; ukse taga on kahe alaga ruum.

- **Sisenemine:** kasutaja avab supervisiooni ukse → näeb oma protsesse (iga protsess = oma „ruumivõti" — kaart ukseesises; superviisor näeb ka „alusta uut protsessi" lauda). Protsessi valides siseneb ta SELLE protsessi ruumi. Ruumi lävel on alati nähtav tekstiline kinnitus: kes selles ruumis on, mis on kontrakti raam, mis on salvestuse seis.
- **Ettevalmistus — eeskamber:** iga osaleja siseneb kõigepealt oma **privaatsesse eeskambrisse** (hämaram valgus, väike laud): siin on tema teemamustandid, Tööheaolu-väljavõtte toomine, varasemad isiklikud refleksioonid. Eeskambrist ühisruumi viib nähtav lävi; teema viimine üle läve = jagamiskinnitus (eelvaade: „see tekst muutub nähtavaks superviisorile ja 4 osalejale").
- **Kohtumine — ühine laud:** ühisruumi keskmes on laud, mille ümber on osalejate kohalolu (kõne olemasoleva taristuga); lauale tõstetud teemakaardid on kohtumise tööobjektid; sein näitab parajasti fookuses olevat teemat (superviisor liigutab fookust — see on tema „protsessijuhi" ruumiline väljendus). Superviisori enda märkmik on tema käes, mitte laual — teistele nähtamatu.
- **Privaatne vs ühine:** füüsiline eristus — eeskamber (privaatne, ainult sinu valgus) / ühisruum laua ümber (jagatud, ühtlane valgus); üleminek käib alati üle nähtava läve koos tekstilise kinnitusega. Valgus toetab, aga ei ole ainus staatuse kandja (lähtekoha reegel).
- **Jäädvustus — kapp:** kohtumise lõpus koostatav kokkuvõte „asetatakse kappi" alles siis, kui osalised on kinnitanud; kapp on protsessi arhiiv (kinnitatud kokkuvõtted + faktikiri). Kõik, mis jäi lauale (jagatud toorteemad, vahemärkmed), **haihtub protsessi sulgemisel** — purge on ruumiliselt aus: laud tühjeneb, kapp jääb.
- **Jätkamine:** ruumi naastes on laual järgmise kohtumise kava ja sinu kinnitamata asjad (kokkuvõte ootab kinnitust); kapist saab varasemaid kokkuvõtteid lauale tuua. „Jätka siit" (U2) viib otse õigesse kohta (eeskamber/laud/kapp).

### Variant B: „Protsessi lennuteekond" (flight-sisuteekond)

Protsess = sügavusse laotud kohtumiste jada (flight-sisuteekonna mehaanika, lähtekoht §4.3).

- **Sisenemine:** karussellist/stuudiost „Supervisioon" → protsesside loend → protsessi valides avaneb lennurada: iga kohtumine on üks sügavustasand, kronoloogia kulgeb sügavusse (minevik taga, järgmine kohtumine ees).
- **Ettevalmistus:** iga kohtumistasandi EES on osaleja privaatne vahetasand (sinu ettevalmistus selleks kohtumiseks); see on hämaram ja märgistatud „ainult sina näed"; jagamine lükkab teemakaardi järgmisele (ühisele) tasandile — kinnitusega.
- **Kohtumine:** kohtumistasand avaneb täisekraani ühisalaks (kõne + jagatud teemad); ülemine ohutu tsoon jääb ruumiülesele juhtpaneelile (lähtekoht §9.2).
- **Privaatne vs ühine:** vaheldumisi paiknevad privaat- ja ühistasandid; eristus valguse + püsiva tekstimärgisega tasandi servas. Nõrkus: piir on visuaalne konventsioon, mitte „koht" — vajab pidevat märgistust.
- **Jäädvustus:** kinnitatud kokkuvõte jääb kohtumistasandile püsielemendina; kinnitamata/toorsisu tuhmub ja kustub sulgemisel; suletud protsess „lukustub" rajana, kus alles on ainult kokkuvõtete tasandid.
- **Jätkamine:** naastes maandub kasutaja oma järgmise tegevuse tasandil (kinnitamata kokkuvõte või järgmise kohtumise ettevalmistus); kerimine liigub ajas edasi-tagasi; iga tasand on otselingiga avatav.

### Võrdlus

| Kriteerium | A: ruum eeskambriga | B: lennuteekond |
|---|---|---|
| Konfidentsiaalsuspiiri tajutavus | tugev: piir = koht (eeskamber/lävi/ühisruum) | nõrgem: piir = tasandi märgistus |
| Grupikohtumise sobivus | loomulik (laud + kohalolu) | kohtumine tuleb tasandist „välja murda" täisekraaniks |
| Protsessi kui seeria tunnetus | kapp + kava (kaudsem) | suurepärane: jada ON ruumi kuju |
| Vastavus grammatikale | otse (uks/lävi/laud/kapp on olemas) | flight on lehe-sisu mehaanika, mitte kohtumise oma |
| Purge ruumiline ausus | laud tühjeneb, kapp jääb — selge | tasandite tuhmumine — abstraktsem |
| Teostuse eeldused | maja/ruumi olemasolev keel + karussell | flight-prototüüp on alles kandidaat (lähtekoht §4.3) |

## 10. Soovitatud variant: A („Supervisiooniruum eeskambriga")

Põhjendus:

1. **Konfidentsiaalsus on supervisiooni tähtsaim tooteomadus ja A teeb selle ruumiliselt käegakatsutavaks:** privaatne eeskamber ja ühine laud on eri KOHAD, mille vahel on nähtav lävi koos tekstilise kinnitusega — täpselt lähtekoha nõue, et ruumivahetusega kaasneb nähtav selgitus, kes mida näeb. B-s on sama piir vaid märgistuskonventsioon.
2. **Supervisioon ei ole lineaarne etappide voog.** Erinevalt kovisiooni 8 etapist (millele flight sobiks) on supervisioon suhte- ja raamipõhine korduv kohtumine — püsiv ruum, kuhu naastakse, kannab protsessi „koha ja jätkuvuse" tunnet paremini kui rada. Merkuljeva „vähemalt 5 kohtumist" tähendab, et ruumiline mälu (kus mu asjad on) on väärtus omaette.
3. **Grupivorm on esmane tõendatud sihtvorm** ja mitme osalejaga kohtumine vajab ühist lauda ja kohalolu, mitte igaühe eraldi kerimisrada.
4. **Madalam tehniline risk:** A toetub maja/ruumi/karusselli olemasolevale keelele ja Room-taristule; B eeldab flight-mehaanikat, mis on lähtekohas alles prototüübikandidaat.
5. **Flight ei kao:** osaleja ettevalmistuse sisemine voog (teema sõnastamine → anonüümsuskontroll → jagamisotsus) võib hiljem kasutada flight-sisuteekonda eeskambri SEES — variandid ei välista teineteist.

## 11. Olemasoleva taristu võimalik taaskasutus

Kerge main-i kontrolli tulemus (grep + skeemi sihtlugemine; EI ole täisaudit).

**Otse taaskasutatav:**

- **Ruumid + kutsed + kõned + nõusolekupõhine salvestus** (`Room`, `RoomMember`, `Invite`, `RoomMessage` + kõnetaristu) — V1 kohtumiskanal;
- **U1 teavitused + U2 „Jätka siit"** (`NotificationEvent`: fakt + viide, sisuta) — protsessi rütm (kohtumine läheneb, kokkuvõte ootab kinnitust);
- **U12 „Minu jagamised"** — supervisiooni jagamised samasse koondvaatesse;
- **Üleandmise etalonmuster** (shareKeys → eelvaade → kinnitus → minimaalne sihtobjekt) — teemade jagamine ja Tööheaolu-sisend;
- **Tööheaolu väljundmustand:** `WellbeingOutputDraft.recipientType` väärtus `"supervisor"` on juba main-is (`lib/wellbeing/supportDrafts.js:18`) — supervisiooniprotsess annab sellele lõpuks päris sihtkoha; mudelis on ka `handedOffAt`+seosevälja muster (praegu kovisioonile), mida saab laiendada;
- **STT/TTS, artefaktisüsteem, RAG-teadmusbaas** — dikteerimine, kokkuvõttemustandid, allikapõhine metoodikatugi;
- **`EffectivePracticeReviewAssignment` grant-muster** — superviisori tiitli etalon (admin annab, alus + tähtaeg, server jõustab);
- **Kovisiooni serverimustrid mallidena (mitte koodina otse):** IDOR-piirded (isegi admin ei möödu), versiooni-CAS + advisory lock, atomaarne sulgemine + detailide purge + omanikupakk (`CovisionClosure`/`CovisionOwnerPackage`/`CovisionPrivateState`), anonüümsuskinnitus enne jagamist;
- **`data/mentoring/esta-mentor-seed.json` + selle nõusolekupoliitika** — kui kunagi tuleb superviisorite/mentorite kataloog, on EXTERNAL_REFERENCE/PENDING_CONSENT muster valmis.

**Uut ehitust vajav põhiosa:**

- supervisiooniprotsessi andmemudel: protsess (tüüp, olek), kontrakt (versioonid), osalus + nõusolekukirjed, kohtumine (kava/fakt/kokkuvõtteseos), kinnitusvoog (mitme osapoole kinnitus kokkuvõttele) — kovisiooni mudelid on ühe juhtumi elutsükli, mitte kohtumiste seeria kesksed, seega otse ei sobitu;
- superviisori tiitli grant-tabel + haldus;
- osaleja eeskambri (privaatala) ja protsessiruumi UI variandis A;
- purge-loogika supervisiooni objektidele (kovisiooni mustri järgi, aga oma mudelitele).

## 12. Tooteomaniku otsust vajavad küsimused

1. **Superviisori tiitli alus:** mis tõend kvalifitseerib (ESCÜ registri kanne? väljaõppe tunnistus? ainult admini otsus)? Kui sageli üle kontrollitakse? Kas tiitel on avalikult nähtav teistele kasutajatele?
2. **ESTA ja ESCÜ suhted:** kas alustada läbirääkimisi (a) ESTA-ga metoodilise/piloodipartnerluse ja mentorite andmebaasi kasutuse üle, (b) ESCÜ-ga registri viitamise ja superviisorite kaasamise üle? Kuni kokkuleppeta: ainult avalike allikate viitamine, mitte mingeid märgiseid (siduv piirang 3.1).
3. **Kas V0 (protsessi mälu) või kohe V1 (koos platvormi kohtumisega)?** V0 on väiksem ja väärtuslik kontaktsupervisioonile; V1 kasutab olemasolevat ruumitaristu — kumb on piloodi jaoks õige lävi?
4. **Salvestuspoliitika supervisioonis:** kas vaikereegel „salvestus keelatud, kui kontrakt ei luba" (rangem kui ruumide üldine nõusolekumuster)?
5. **Tellija-kokkuvõtte koht:** kas platvorm üldse vormistab tellijale mineva lõppkokkuvõtte (kinnitusvooga, üleandmine väljas) või jääb see täielikult superviisori platvormiväliseks tööks? (Soovitus: V0-s täielikult väljas, ainult kontraktikirje.)
6. **Supervisiooni ja kovisiooni suhe tootes:** kas kovisioonigrupp saab „tellida" superviisori (protsesside sild) või hoiame moodulid esialgu täiesti lahus? (Soovitus: lahus kuni piloodini.)
7. **Tasumudel:** supervisioon on turul tasuline teenus; kas platvorm jääb ESTA mentorlusmudeli loogikasse (tasu lepitakse platvormiväliselt) ka pikas plaanis, või tuleb kunagi arveldus? Seos tasuta tuuma piiri otsusega (O12).
8. **Individuaal- vs grupivorm MVP-s:** kas V0 toetab mõlemat kohe (soovitus: jah, sama mudel katab) või alustame ühest?
9. **Kas osaleja võib olla CLIENT-rollis kasutaja?** (Soovitus: ei — supervisioon on professionaalide tööriist; kogemusnõustajate supervisioon vajaks eraldi otsust, sest nende konto-roll platvormil on lahtine.)
10. **Retention:** kui kaua kinnitatud kokkuvõtteid ja faktikirja hoitakse pärast protsessi sulgemist?

## 13. Täpne jätkamispunkt teiseks küsimuseks

Teine küsimus (eraldi ülesanne): **rakendusvalmis tehniline tööplaan.** Sisend on käesolev dokument; jätkata tuleb siit:

1. võtta osast 12 tooteomaniku vastused (miinimum: küsimused 1, 3, 4 — tiitli alus, V0/V1 lävi, salvestuspoliitika);
2. projekteerida andmemudel (osa 11 „uut ehitust vajav" loend): SupervisionProcess / SupervisionContract(+versioonid) / SupervisionParticipation(+consent) / SupervisionMeeting / kinnitusvoog / SupervisorGrant — kovisiooni mudelite (CAS, purge, OwnerPackage, IDOR) mustrite järgi, kohtumiste-seeria keskselt;
3. kaardistada marsruudid ja õiguste väravad (protsessiomanik vs osaleja; admin EI möödu privaatalast);
4. täpsustada Tööheaolu → supervisiooni üleandmise tehnika (`WellbeingOutputDraft.recipientType="supervisor"` + `handedOffAt` laiendus);
5. variandi A UI tükeldus: ukseesine (protsesside loend) → eeskamber → ühisruum → kapp; karusselli/maja sisenemiskoht;
6. testiplaan node:test fake-prismaga (repo reegel: EI elavat DB-d testides) + purge atomaarsuse kontroll.

Selle dokumendi ulatusest jäid teadlikult välja (ära käsitle jätkutöös uuesti ilma vajaduseta): Kovisiooni/Tööheaolu uus audit, route'ide täisaudit, organisatsioonikiht, arveldus.

---

# Q2 — Supervisiooni V0 rakendusvalmis tehniline tööplaan

Q2 STATUS: COMPLETE
Alustatud ja lõpetatud: 15.07.2026. Alus: Q1 (osad 1–13 eespool) + 12 lukustatud tooteotsust (all). See on tehniline tööplaan — rakenduskoodi, Prisma skeemi ega migratsioone selle peatüki raames ei kirjutata.

## Q2 seisutabel

| Osa | Seis | Viimane tõend | Jätkamispunkt |
|---|---|---|---|
| 1. Olemasolevad mustrid | COMPLETE (v2) | 15 mustrit + taaskasutatav/kohandatav/sobimatu klassifikatsioon | — |
| 2. Andmemudel | COMPLETE | 13 mudelit; kanoonid schema:2382 (PracticeCapability), 2066 (CovisionParticipant), 2157 (PrivateState), 1954 (TopicSeed snapshot), 2268 (OwnerPackage) | → osa 3 |
| 3. Õiguste maatriks | COMPLETE | 8 tegijat × 23 toimingut; ADMIN=VÕÕR sisus (kovisiooni runtime-etalon) | → osa 5 (sulgemine) |
| 4. API ja teenusekiht | COMPLETE | 27 rida + ühislepingud; allowlist-kanoon lib/wellbeing/covisionHandoff.js:7 | → osa 10 (testid) |
| 5. Sulgemine ja purge | COMPLETE | 10 sammu ühes tehingus; xact-lukk lib/covisionLegacyWrite.js:6 kanoonil; V0-l välist cleanup'i pole | → osa 4 (API) |
| 6. Eeskambri UI | COMPLETE (v2) | 10+1 vaadet + sisu neljane jaotus (privaatne/grupp/SV/kustub) | — |
| 7. Tööheaolu üleandmine | COMPLETE (v2 — PARANDATUD) | siht = EESKAMBER (M6 privaatkirje); superviisor ei näe enne jagamisväravat; unique-tõke M6-s | — |
| 8. U1/U2 | COMPLETE | 5 teavitust + 1 continuity-allikas; sisuvaba invariant | → osa 9 |
| 9. Migratsioonijärjekord | COMPLETE (v2) | + additiivsus/indeksikoond/rollback/andmemõju; uus = 20260716090000_supervision_v0 | — |
| 10. Testiplaan | COMPLETE (v2) | 18 testi + 15-klassi maatriks (sh T19 auditijälg, T20 indiv/grupp, T21 ET/EN/RU, T22 a11y) | — |
| 11. Teostuspaketid | COMPLETE (v2) | P0…P11 + lisaväljad (migratsioon/UI/i18n/ei-tee); P9 siht = M6 | — |
| 12. Lõppväljund | COMPLETE (v2) | + lõplik hinnang (rakendusvalmis: JAH tingimustega) + kopeeritav käsk teostajale | järgmine töö = SUP-P0 |

## Q2 lukustatud tooteotsused (siduvad)

1. V0 on **protsessi mälu**; supervisioonikohtumine võib toimuda platvormiväliselt.
2. V0 ei sisalda helikõnet, salvestamist ega transkriptsiooni.
3. Superviisori lisatiitli annab administraator dokumenteeritud aluse põhjal.
4. Avalikku „ESTA kontrollitud", „ESCÜ kontrollitud" vm kvaliteedimärgist ei kasutata.
5. Supervisioon ja Kovisioon jäävad eraldi töövoogudeks.
6. Tellija-kokkuvõte ja selle üleandmine jäävad V0-s platvormist välja.
7. Arveldamine toimub platvormiväliselt.
8. Sama mudel toetab individuaal- ja grupisupervisiooni.
9. CLIENT-roll ei saa V0 Supervisioonis osaleda.
10. ESTA/ESCÜ partnerlus ega väline kataloog ei ole V0 eeltingimus.
11. Sulgemisel kustutatakse jagatud toorsisu; alles jäävad ainult teadlikult kinnitatud väljundid ja minimaalne faktijälg.
12. Kinnitatud väljundite lõplik säilitustähtaeg on eraldi õiguslik otsus — V0 ei leiuta numbrit ega ehita retention-scheduler'it.

Ulatus (ainus kaetav voog): admin annab grandi → superviisor loob protsessi ja kontrakti → kutsub professionaalid → osaleja kinnitab kontrakti → privaatne eeskamber → teadlik jagamine eelvaatega → kohtumise fakt → kokkuvõte + kinnitused → järgmine kohtumine → sulgemine → toorsisu purge → osalejale jäävad privaatne refleksioon ja kinnitatud väljundid.

Teadlikult väljas: platvormisisene kõne; salvestus/transkriptsioon; organisatsiooni- või tellijavaade; arveldus; superviisorite kataloog; partnerintegratsioonid; Kovisiooni ühendamine; uus üldine lõuendimootor; rakenduskoodi kirjutamine.

## Q2.1 Olemasolevate mustrite sihtkontroll

SEIS: COMPLETE

Sihtkontroll (mitte üldaudit); kanoonid on peatüki koostamisel koodist üle vaadatud. Täpsed funktsiooninimed, mida siin pole nimetatud, fikseerib vastava paketi esimene samm (märgitud „→ P-nr").

| Muster | Kanooniline näide (failid/mudelid) | Taaskasuta | Supervisioon ehitab eraldi | Semantika, mida MITTE kopeerida |
|---|---|---|---|---|
| Admin-grant + aegumine | `PracticeCapability` (schema:2382–2400: validFrom/validUntil/revokedAt/grantBasis; @@unique[userId,type,scope]) + grant-teenus lib/effectivePractices.js (→ P1) | väljade kuju, ACTIVE-tuletus, indeks [userId,revokedAt,validUntil] | oma mudel M1 (otsus 5: mitte laiendada PracticeCapabilityType enumit) | scope-string (praktikate skoobisemantika; M1-l scope'i pole) |
| Grant-audit | `PracticeCapabilityAudit` (schema:2501–2517: action/validUntil/grantBasis, SetNull osapooled) | append-only kuju | M13 GRANT_* kirjed | — |
| Owner/participant skoop + ühetaoline 404 | `CovisionCase.ownerId` + `CovisionParticipant` + `assertCovisionCreator` (lib/covisionSession.js:258–262); runtime-tõend: ka ADMIN 404 (orientatsioonikaart ptk 8) | skoobitud-WHERE päringustiil; assert-funktsioonide kuju | `lib/supervision/` omad assertid (SV/OS/OS†/KUT/LAHK on rikkam kui covision owner/participant) | ADMIN-i lubamine loojarolli (`assertCovisionCreator` lubab ADMIN — teadaolev P3-ebasümmeetria; M1 grant EI lähe adminile vaikimisi) |
| Kutsed | `CovisionParticipant` (schema:2066–2086: userId? + email? + inviteStatus) vs Room `Invite` (schema:2825–2857: tokenHash, e-post, arveldus) | CovisionParticipant in-app muster; @@unique[processId,userId] | M4 (ainult userId; ilma email-kutseta) | Room Invite tokeni/arvelduse/sponsoreeritud rolli kiht (V0-s pole väliskutseid) |
| Tingimuste versioonipõhine kinnitus | FrameworkAcceptance (migratsioon 20260315120000_add_framework_acceptances) — platvormitasandi versioonipõhine nõusolek; `CovisionParticipantState.agreementConfirmedAt` (schema:2122) — protsessisisene fakt | versioonipõhisuse idee (acceptance viitab versioonile) | M3+M5 paar (kontrakt on protsessi-, mitte platvormiobjekt) | agreementConfirmedAt versioonitus (ainult timestamp, versioonita — M5 PEAB olema versioonipõhine) |
| Privaatne tööolek | `CovisionPrivateState` (schema:2155–2174 + kaitsekommentaar) | eraldi-mudeli põhimõte; owner-skoobitud unique | M6 (kind-enum supervisiooni oma) | stage-seotus (covisioni etapimasin; supervisioonil etappe pole) |
| Jagamise eelvaade + serveripoolne manifest | `TopicSeed.sharedCardSnapshot`+`ownerConfirmedAt`+`sharedAt` (schema:1943–1968); shareKeys-muster eelpöördumises (U3 rada) | külmutatud-koopia põhimõte; kinnitus enne jagamist | M7 (koopia + audience; manifest = kirje ise) | TopicSeed WAITING-järjekorra/külmutatud-kaardi elutsükkel (kovisiooni jagamisjärjekord) |
| CAS + advisory-lock | `CovisionSessionState.version` (schema:2088–2095 kommentaar: expected integer version, never wholesale) + `pg_advisory_xact_lock(hashtext(...))`: lib/covisionLegacyWrite.js:6, lib/wellbeing/outputDraftLock.js:7, lib/rooms/preInquiryRoom.js:33–48 | lukuvõtme formaat `supervision:${id}`; version++ igal kirjutusel | M2/M6/M7/M8/M9 version-väljad | Room origin-singleton partial-unique trikk (20260713193000) — teine probleem |
| Mitme kasutaja kinnitus | EffectivePractice 3-rolli heakskiit (REVIEWER/EDITOR/ETHICS → READY_TO_PUBLISH; schema:2403–2445) + `CovisionParticipantState.readyAt` kõik-valmis värav | „viimane kinnitus lülitab oleku samas tehingus" | M10 (lävi = kõik ACCEPTED osalused, mitte rollitüübid) | autor-ei-publitseeri reegel (praktikate 403; supervisioonis SV submitib JA on üks kinnitajaist) |
| U1 teavitused | `NotificationEvent` (schema:1912–1939: type/sourceType/sourceId/dedupeKey/targetKind/targetId; emailPolicy opt-in) | kogu kuju + dedupeKey distsipliin | ainult uued type-väärtused (Q2.8) | — (sisu mittepanek ON muster) |
| U2 „Jätka siit" | `/api/workspace/continuity` + deterministlik kuni-7-kirje koostur (U1/U2 main-is, produktsioonis) | koosturi allikaliidese laiendus | supervisiooni allikad (kinnitamata kontrakt, ootav kinnitus, järgmine kohtumine) | — |
| Atomaarne sulgemine + purge | `CovisionClosure` (schema:2197–2238) + runtime-tõendatud üks-tehing-sulgemine (orientatsioonikaart ptk 8: closure+pakk+kandidaat+kustutus ühes tehingus) | tehingupiir; purge-põhimõte; `retentionStatus` staatus-ilma-scheduler'ita | Q2.5 oma järjestus (M11+M12) | practiceDecision/FollowUp/jätkuseemne/RAG-sünk rajad (otsused 5 ja 18: supervisioonil pole praktika- ega RAG-rada) |
| Konto kustutamine | privacy_audit_and_deletion_jobs (migratsioon 20260424193000) + `DataAuditLog` (schema:1416) + Cascade/SetNull distsipliin | Cascade-disain M-mudelites; deletion-jobs kontroll | test #17 stsenaariumid | — |
| Auditikirjed | `EffectivePracticeAuditEvent` (schema:2519–2543: append-only, actor SetNull, justificationVisibility värav) | append-only + SetNull-actor | M13 (sisuvaba) | justification-vabatekst ja selle visibility-värav (M13-s vabatekst KEELATUD) |
| Väljundmustandid | `WellbeingOutputDraft` (schema:1267–1292: userReviewed/userConfirmed/recipientType/handedOffAt/covisionCaseId; `recipientType="supervisor"` juba olemas — lib/wellbeing/supportDrafts.js:15–21) + `lib/wellbeing/covisionHandoff.js` voog | mustandi kinnituse-elutsükkel + handoff-mehaanika (allowlist, sameInstant, handedOffAt) | supervisiooni-poolne vastuvõtt (M6 sihtkirje, Q2.7 v2) | covisionCaseId 1:1-juhtumiseose kuju (supervisioonis on siht privaatkirje, mitte protsess/juhtum) |
| Kutsed ja ruumiliikmesus (Room-pool) | `Room`/`RoomMember`/`Invite` (schema:2779–2857: RoomRole, leftAt, lastReadAt, tokenHash, arveldusväljad) | leftAt-nähtavuspiiri IDEE (lahkunu ei näe uut sisu) | — (V0 EI kasuta ruume: kohtumine on platvormiväline fakt, otsused 1–2) | origin-singleton, token-kutsed, billing/sponsor-kiht, sõnumivoog — kõik V0-le sobimatu |

**Klassifikatsioon (taaskasutatav / kohandatav / sobimatu):**

- **Taaskasutatav** (muster üle sellisena): NotificationEvent + U2 koostur (ainult uued type'id/allikad); advisory-lock + version-CAS idioom; append-only auditikuju; konto kustutamise Cascade/SetNull distsipliin; väljundmustandi handoff-mehaanika (allowlist + sameInstant + handedOffAt).
- **Kohandatav** (muster sobib, semantika muutub): admin-grant (PracticeCapability → M1: ilma scope'ita, kohustuslik grantBasis); osalejad/kutsed (CovisionParticipant → M4: ilma email-kutseta); privaatoleku eraldus (CovisionPrivateState → M6: ilma stage'ita); külmutatud jagamissnapshot (TopicSeed → M7: koopia-kirje, mitte snapshot-väli); mitme-kinnituse lävi (praktikate rollipõhine → M10 osaluspõhine); atomaarne sulgemine + purge (CovisionClosure → M11+M12: ilma praktika/RAG-rajata); tingimuste versioonikinnitus (FrameworkAcceptance idee → M3+M5).
- **Sobimatu** (ära kasuta V0-s): Room/Invite token- ja arvelduskiht; ruumiliikmesus tervikuna; kovisiooni etapimasin (stage/phase/StageSnapshot); praktikate autor-ei-publitseeri reegel; `assertCovisionCreator` ADMIN-luba; auditite justification-vabatekst.

Kokkuvõte: taaskasutus on mustri-, mitte kooditasandil — supervisioon EI impordi kovisiooni teenusefaile, vaid kordab nende lepinguid omas moodulis (otsus 5). Ainsad jagatud runtime-sõltuvused: NotificationEvent-kiht, continuity-koostur, User/Role, advisory-lock idioom.

## Q2.2 Andmemudel

SEIS: COMPLETE

Põhimõtted: Prisma-enum'id nagu Kovisioonis; privaatne, jagatud ja püsiv sisu EI ela ühes JSON-konteineris (CovisionPrivateState-pretsedent, schema.prisma:2155–2157 kommentaar); jagamine = külmutatud KOOPIA, mitte viide elavale mustandile (TopicSeed.sharedCardSnapshot-pretsedent, schema:1954–1956); User-seosed nimeliste relatsioonidega.

### M1. SupervisorGrant

- **Eesmärk:** superviisori lisatiitel; peegeldab 1:1 `PracticeCapability` mustrit (schema:2382–2400), aga eraldi mudelina (otsus 5: töövood lahus; `PracticeCapabilityType` enum jääb puutumata).
- **Väljad:** id; userId; grantedByUserId (SetNull); grantBasis String @db.Text (KOHUSTUSLIK — otsus 3 „dokumenteeritud alus"; erinevalt PracticeCapability nullable-väljast); validFrom (default now); validUntil DateTime?; revokedAt DateTime?; revokedByUserId?; createdAt/updatedAt.
- **Olekud:** tuletatud, mitte salvestatud: ACTIVE = revokedAt IS NULL AND (validUntil IS NULL OR validUntil > now). Sama loogika nagu `@@index([userId, revokedAt, validUntil])` PracticeCapability's.
- **Omanik/nähtavus:** kirje kuulub adminile; kasutaja näeb OMA grandi fakti (validUntil, mitte teiste kasutajate oma); grantBasis on admin-only + kasutajale endale nähtav.
- **Indeksid:** @@index([userId, revokedAt, validUntil]).
- **Unikaalsus:** @@unique([userId]) EI sobi (ajalugu: tühistatud + uus grant). Teenusetasand jõustab „max 1 aktiivne grant kasutaja kohta" (loe lukuga enne insert'i); DB-indeks toetab kontrolli.
- **Kustutus:** user Cascade; grantedBy/revokedBy SetNull.
- **CAS:** pole vaja (admin-ainuõigus, madal paralleelsus); revoke on idempotentne (juba revokeeritud → no-op).
- **Vabatekst:** ainult grantBasis (admin sisestab; nt „ESCÜ registrikanne, kontrollitud 15.07.2026"); EI kuvata avalikult (otsus 4).

### M2. SupervisionProcess

- **Eesmärk:** protsessi juurobjekt (individuaal- ja grupivorm sama mudeliga, otsus 8).
- **Väljad:** id; supervisorId; type enum {INDIVIDUAL, GROUP}; title String; goal String? @db.Text; plannedMeetingCount Int @default(5); status enum; activeContractVersionId String? @unique (seos M3-le); version Int @default(0); lastActivityAt; createdAt/updatedAt; closedAt DateTime?.
- **Olekud:** DRAFT → ACTIVE → CLOSED. DRAFT = loodud, kutsed/kontrakt töös; ACTIVE = aktiivne kontraktiversioon olemas JA ≥1 ACCEPTED osalus; CLOSED = sulgemine tehtud (closure olemas). CLOSING-vaheolekuta — sulgemine on üks tehing (Q2.5).
- **Omanik/nähtavus:** supervisorId on omanik; loevad omanik + ACCEPTED osalejad; kõik teised (sh ADMIN sisuvaadetes) → 404.
- **Indeksid:** @@index([supervisorId, status, updatedAt]); @@index([status, lastActivityAt]).
- **Unikaalsus:** —.
- **Kustutus:** supervisor-User Cascade (konto kustutamisel kaob protsess; osalejate isiklikud väljundid M12 elavad seda üle SetNull-iga); alamobjektid Cascade protsessi küljes.
- **CAS:** version Int + expectedVersion igal muteerival actionil (CovisionSessionState muster, schema:2088–2095) + advisory lock `supervision:${processId}` (kanoon: lib/covisionLegacyWrite.js:6).
- **Vabatekst:** title, goal — jagatud protsessi liikmetele; sulgemisel title asendatakse üldistatuga ja goal nullitakse (CovisionClosure.generalizedTitle muster).

### M3. SupervisionContractVersion

- **Eesmärk:** kontrakti versioonid; kinnitused viitavad versioonile, mitte „kontraktile üldiselt".
- **Väljad:** id; processId; versionNumber Int; body String @db.Text; createdByUserId (SetNull); status enum; activatedAt DateTime?; createdAt.
- **Olekud:** DRAFT → ACTIVE → SUPERSEDED. Korraga max 1 ACTIVE protsessi kohta (jõustab teenusetasand + M2.activeContractVersionId viit).
- **Omanik/nähtavus:** kirjutab ainult superviisor; loevad omanik + kõik osalused staatuses INVITED/ACCEPTED (kutsutu PEAB nägema kontrakti enne kinnitamist — ainus asi, mida kutsutu näeb).
- **Indeksid:** @@index([processId, status]).
- **Unikaalsus:** @@unique([processId, versionNumber]).
- **Kustutus:** process Cascade.
- **CAS:** muudatused käivad M2 versiooni kaudu (kontraktiversioon ise on pärast ACTIVE muutumatut — server keelab body muutmise pärast aktiveerimist).
- **Vabatekst:** body — jagatud; JÄÄB alles pärast sulgemist (kinnitatud väljund otsuse 11 mõttes: iga osaleja on selle teadlikult kinnitanud).

### M4. SupervisionParticipation

- **Eesmärk:** osalus + kutse ühes mudelis (CovisionParticipant muster, schema:2066–2086), V0-s AINULT olemasoleva konto userId-ga — e-posti-kutseid ja token-linke (Room Invite, schema:2825) V0 ei kasuta.
- **Väljad:** id; processId; userId; invitedByUserId (SetNull); status enum; invitedAt; respondedAt DateTime?; leftAt DateTime?; createdAt/updatedAt.
- **Olekud:** INVITED → ACCEPTED | DECLINED; ACCEPTED → LEFT; INVITED → WITHDRAWN (superviisor võtab kutse tagasi enne vastust).
- **Omanik/nähtavus:** superviisor näeb kõiki protsessi osalusi; osaleja näeb protsessi osaliste nimekirja alles pärast ACCEPTED-it (kutsutu näeb ainult protsessi pealkirja, superviisori nime ja kontrakti); rollivärav: userId roll PEAB olema SOCIAL_WORKER või SERVICE_PROVIDER (User.role enum `Role`, schema:652) — kontroll NII kutse loomisel KUI kinnitamisel (roll võib vahepeal muutuda); CLIENT → kutse loomine ebaõnnestub 422-ga.
- **Indeksid:** @@index([userId, status, updatedAt]) („minu protsessid" loend).
- **Unikaalsus:** @@unique([processId, userId]).
- **Kustutus:** process Cascade; user Cascade (osaleja konto kustutus eemaldab osaluse; tema M6/M12 kustuvad omaniku kaudu).
- **CAS:** olekusiirded advisory-lock'i all; idempotentsed (teine accept → sama tulemus, mitte duplikaat).
- **Vabatekst:** ei ole.

### M5. SupervisionContractAcceptance

- **Eesmärk:** kontrakti versioonipõhine kinnitus (CovisionParticipantState.agreementConfirmedAt idee, schema:2122, aga versioonipõhisena — iga uus kontraktiversioon nõuab uut kinnitust).
- **Väljad:** id; participationId; contractVersionId; acceptedAt.
- **Olekud:** kirje olemasolu ON olek (append-only).
- **Omanik/nähtavus:** osaleja loob oma; superviisor näeb, KES on kinnitanud (fakt), mitte rohkem.
- **Indeksid:** @@index([contractVersionId]).
- **Unikaalsus:** @@unique([participationId, contractVersionId]) — topeltklikk ei loo duplikaati.
- **Kustutus:** participation Cascade; contractVersion Cascade.
- **CAS:** pole (append-only, unique-kaitse).
- **Vabatekst:** ei ole.
- **Tuletatud reegel:** osaleja on „kehtivalt kinnitanud" = tal on acceptance protsessi AKTIIVSELE kontraktiversioonile. Ilma selleta: loeb, aga ei saa jagada ega kinnitada (maatriks Q2.3).

### M6. SupervisionPrivateItem (eeskamber)

- **Eesmärk:** osaleja JA superviisori privaatne ettevalmistus/märkmed; eraldi mudel, et jagatud serializer ei saaks seda kunagi tagastada (CovisionPrivateState pretsedent, schema:2157–2174).
- **Väljad:** id; processId; ownerUserId; kind enum {PREP_TOPIC, PRIVATE_NOTE, CLOSING_REFLECTION}; title String?; body String @db.Text; sharedTopicId String? (SetNull; viide M7-le kui sellest tehti jagatud teema); sourceKind enum {MANUAL, WELLBEING_HANDOFF} @default(MANUAL); sourceWellbeingDraftId String? @unique (SetNull — topeltüleandmise DB-tõke, Q2.7 v2); version Int @default(0); createdAt/updatedAt.
- **Olekud:** olekuta (DRAFT-loomuga); „jagatud" tuvastub sharedTopicId olemasolust; kustutamine on päris-DELETE (omanik ise).
- **Omanik/nähtavus:** AINULT ownerUserId; superviisor EI näe osaleja oma; ADMIN EI näe kellegi oma (kovisiooni IDOR-etalon); serializer-perekond eraldi failis, mida jagatud vaated ei impordi.
- **Indeksid:** @@index([processId, ownerUserId, updatedAt]); @@unique([processId, ownerUserId, id]) pole vajalik — piisab omanik-skoobitud päringutest.
- **Kustutus:** process Cascade; owner-User Cascade. Sulgemine EI kustuta (otsus 11: privaatne refleksioon jääb omanikule) — v.a kui protsess ise kustub konto kustutusega.
- **CAS:** version + expectedVersion (autosalvestuse konflikt).
- **Vabatekst:** title, body — rangelt privaatne.

### M7. SupervisionSharedTopic

- **Eesmärk:** teadlikult jagatud teema = külmutatud koopia jagamishetkel (manifest ON kirje ise; TopicSeed.sharedCardSnapshot + ownerConfirmedAt muster, schema:1954–1956).
- **Väljad:** id; processId; authorParticipationId; title String; body String @db.Text; audience enum {SUPERVISOR_ONLY, PROCESS}; sourceKind enum {MANUAL, WELLBEING_HANDOFF} (kopeeritakse jagamisel allikaks olnud M6 kirjest — v2: otsest Tööheaolu-viidet M7-s EI OLE, see elab M6-s); status enum {SHARED, WITHDRAWN}; sharedAt; withdrawnAt?; version Int; createdAt/updatedAt.
- **Olekud:** SHARED → WITHDRAWN (autor võtab tagasi; sisu jääb DB-s kuni purge'ini, aga serializer peidab teistelt).
- **Omanik/nähtavus:** autor + superviisor alati; teised ACCEPTED osalejad ainult kui audience=PROCESS ja status=SHARED. Audience'i valib autor jagamisväraval; Tööheaolu-päritolu (sourceKind=WELLBEING_HANDOFF) EI muuda väravat ega anna kiirteed (Q2.7 v2).
- **Indeksid:** @@index([processId, status, sharedAt]); @@index([authorParticipationId]).
- **Unikaalsus:** — (v2: topeltüleandmise tõke kolis M6.sourceWellbeingDraftId peale).
- **Kustutus:** process Cascade; authorParticipation Cascade; **purge sulgemisel kustutab KÕIK protsessi SharedTopic-read** (toorsisu, otsus 11).
- **CAS:** version (audience'i muutmine, tagasivõtt).
- **Vabatekst:** title, body — jagatud skoobis; kaob sulgemisel.

### M8. SupervisionMeeting

- **Eesmärk:** kohtumise faktikirje (kohtumine võib toimuda platvormiväliselt — otsus 1).
- **Väljad:** id; processId; seq Int; plannedAt DateTime?; heldAt DateTime?; markedHeldByUserId?; status enum {PLANNED, HELD, CANCELLED}; agendaTopicIds String[] @default([]) (viited M7-le, jagatud skoop); note String? @db.Text (jagatud töömärge); topicCountAtClose Int? (purge täidab enne viidete kustutamist); version Int; createdAt/updatedAt.
- **Olekud:** PLANNED → HELD | CANCELLED. HELD on lõplik (faktijälg).
- **Omanik/nähtavus:** kirjutab superviisor; loevad protsessi liikmed.
- **Indeksid:** @@index([processId, seq]).
- **Unikaalsus:** @@unique([processId, seq]).
- **Kustutus:** process Cascade. **Purge:** rida JÄÄB (faktijälg: seq, plannedAt, heldAt, status), aga note → NULL, agendaTopicIds → [], topicCountAtClose ← arv.
- **CAS:** version (mark-held, plaanimuudatus).
- **Vabatekst:** note — jagatud, purge nullib.

### M9. SupervisionSummary

- **Eesmärk:** kokkuvõtte mustand → kinnitatud püsiväljund; üks mudel, olek eristab.
- **Väljad:** id; processId; meetingId String? @unique (NULL = lõpukokkuvõte); kind enum {MEETING, FINAL}; body String @db.Text; status enum; createdByUserId (superviisor; SetNull); submittedAt?; approvedAt?; version Int; createdAt/updatedAt.
- **Olekud:** DRAFT → PENDING_APPROVAL → APPROVED; DRAFT/PENDING → DISCARDED. Pärast APPROVED on body MUUTUMATU (server keelab; uus sisu = uus kokkuvõte pole V0-s lubatud sama kohtumise kohta — meetingId @unique).
- **Omanik/nähtavus:** koostab ja submitib superviisor; loevad protsessi liikmed (ka DRAFT-i? EI — DRAFT on superviisori tööversioon, nähtav ainult talle; PENDING_APPROVAL ja APPROVED nähtavad liikmetele).
- **Indeksid:** @@index([processId, kind, status]).
- **Unikaalsus:** meetingId @unique (max 1 kokkuvõte kohtumise kohta); „max 1 FINAL protsessi kohta" jõustab teenusetasand.
- **Kustutus:** process Cascade; meeting SetNull (fakt jääb, seos säilib kind-väljas). **Purge:** DRAFT/PENDING_APPROVAL/DISCARDED kustutatakse; APPROVED jääb.
- **CAS:** version (mustandi salvestus, submit).
- **Vabatekst:** body — kuni APPROVED jagatud-tööversioon, pärast APPROVED püsiväljund.

### M10. SupervisionSummaryApproval

- **Eesmärk:** mitme osapoole kinnitus kokkuvõttele.
- **Väljad:** id; summaryId; participationId; approvedAt.
- **Olekud:** kirje olemasolu = kinnitus (append-only).
- **Omanik/nähtavus:** osaleja loob oma; kõik liikmed näevad kinnituste FAKTE (kes on kinnitanud, kes ootab).
- **Indeksid:** @@index([summaryId]).
- **Unikaalsus:** @@unique([summaryId, participationId]).
- **Kustutus:** summary Cascade; participation Cascade.
- **CAS:** pole; APPROVED-läve arvutus toimub advisory-lock'i all: kui viimane puuduv ACTIVE-osaleja kinnitus saabub, märgib SAMA tehing summary APPROVED-iks (lävi = kõik hetkel ACCEPTED-staatuses osalused; LEFT ei blokeeri).
- **Vabatekst:** ei ole.

### M11. SupervisionClosure

- **Eesmärk:** sulgemise fakt + purge-raport + idempotentsuse ankur (CovisionClosure muster, schema:2197–2238, oluliselt õhem).
- **Väljad:** id; processId @unique; closedByUserId (SetNull); closedAt; factsJson Json (ainult arvud/kuupäevad: {meetingsPlanned, meetingsHeld, participantCount, firstHeldAt, lastHeldAt, approvedSummaryCount}); purgeReport Json (kustutatud ridade arvud tüübiti — EI sisu); retentionStatus String @default("AWAITING_POLICY") — peegel CovisionClosure.retentionStatus väljale (schema:2218): STAATUS ilma scheduler'ita, otsus 12.
- **Olekud:** olemasolu = suletud; korduv sulgemiskatse → 409 (closure juba olemas).
- **Omanik/nähtavus:** protsessi liikmed loevad; keegi ei muuda (append-only).
- **Indeksid/unikaalsus:** processId @unique.
- **Kustutus:** process Cascade.
- **CAS:** loomine ainult sulgemistehingus advisory-lock'i all.
- **Vabatekst:** EI OLE (teadlik erinevus CovisionClosure'ist — supervisiooni kokkuvõtted elavad M9-s).

### M12. SupervisionPersonalOutcome (osaleja isiklik püsiväljund)

- **Eesmärk:** sulgemisel igale osalejale (ja superviisorile) loodav isiklik pakk (CovisionOwnerPackage muster, schema:2268–2282): külmutatud koopia kinnitatud väljunditest + faktijälg, mis elab üle protsessi kustumise.
- **Väljad:** id; ownerUserId; processId String? (SetNull — protsessi hilisem kadu ei kustuta pakki); processTitleGeneralized String; contentJson Json (külmutatud: kinnitatud kokkuvõtete tekstid, kontrakti viimane kinnitatud body, faktid); createdAt.
- **Olekud:** olekuta, muutumatu.
- **Omanik/nähtavus:** AINULT ownerUserId (ka mitte superviisor teiste omi); ADMIN ei loe.
- **Indeksid:** @@index([ownerUserId, createdAt]).
- **Unikaalsus:** @@unique([processId, ownerUserId]) (NULL-processId ei sega Postgresis).
- **Kustutus:** owner-User Cascade; processId SetNull.
- **CAS:** pole (loob ainult sulgemistehing).
- **Vabatekst:** contentJson sees külmutatud KINNITATUD tekstid — see on lubatud „püsiv" konteiner, sest sisaldab AINULT kinnitatud väljundeid, mitte toorsisu (otsuse 11 piiril: privaatne refleksioon jääb M6-s, mitte siin).

### M13. SupervisionAuditEvent

- **Eesmärk:** append-only sündmusteregister (EffectivePracticeAuditEvent muster, schema:2519–2543, ILMA justification-vabatekstita; grant-sündmustele PracticeCapabilityAudit muster, schema:2501–2517).
- **Väljad:** id; processId String? (SetNull või Cascade — vt allpool); actorUserId? (SetNull — kustutatud konto ei kustuta otsusejälge); action String (PROCESS_CREATED, CONTRACT_ACTIVATED, INVITE_SENT, INVITE_WITHDRAWN, CONTRACT_ACCEPTED, PARTICIPANT_LEFT, TOPIC_SHARED, TOPIC_WITHDRAWN, MEETING_PLANNED, MEETING_HELD, SUMMARY_SUBMITTED, SUMMARY_APPROVED, PROCESS_CLOSED — v2: HANDOFF-sündmust EI OLE, üleandmine on privaatala toiming); targetKind/targetId String?; metadata Json? (AINULT id-d/arvud/olekud — vabateksti keeld on invariant); createdAt.
- **Kustutus:** processId Cascade (kui protsess kustub konto kustutusega, kaovad ka sündmused — privaatsus ennekõike); grant-sündmused (GRANT_ISSUED, GRANT_REVOKED) elavad processId=NULL kirjetena SetNull-loogikata.
- **Nähtavus:** V0-s UI-d ei ole; server/diagnostika; ADMIN näeb grant-sündmusi, protsessisündmusi EI sirvita sisuvaadetes.
- **Vabatekst:** keelatud (invariant, testitav).

**Kokkuvõte:** 13 mudelit, 0 muudatust olemasolevatele mudelitele peale kahe: (a) Tööheaolu-viide elab vastassuunalise @unique-viitena **M6-s** (Q2.7 v2), seega **WellbeingOutputDraft EI muutu üldse** (handedOffAt semantika laieneb teenusekoodis); (b) `User` saab ~10 uut nimelist tagasi-relatsiooni (Prisma nõue, ainult skeemirida, mitte andmemuudatus).

## Q2.3 Õiguste ja privaatsuse maatriks

SEIS: COMPLETE

Server jõustab kõik read teenusekihis (mitte UI peitmisega). Tegijate legend: **SV** = protsessi superviisor (omanik); **OS** = ACCEPTED osaleja (SOCIAL_WORKER ja SERVICE_PROVIDER on osalejana identsete õigustega); **OS†** = ACCEPTED osaleja, kes EI ole kinnitanud AKTIIVSET kontraktiversiooni (uus versioon ootab); **KUT** = INVITED (kutsutud, vastamata); **LAHK** = LEFT; **VÕÕR** = kõrvaline autentitud kasutaja (sh teise protsessi superviisor); **CLIENT** = CLIENT-rollis kasutaja; **ADMIN** = administraator.

| Toiming | SV | OS | OS† | KUT | LAHK | VÕÕR | CLIENT | ADMIN |
|---|---|---|---|---|---|---|---|---|
| Grant: anda/tühistada (M1) | – | – | – | – | – | – | – | **AINULT ADMIN** |
| Grant: näha oma grandi fakti | oma | oma | oma | oma | oma | oma | oma | kõik |
| Protsessi loomine (M2) | aktiivse grandiga | – | – | – | – | – | – | – (adminil pole granti → ei loo) |
| Protsessi lugemine (M2 detail) | ✓ | ✓ | ✓ | piiratud kaart¹ | piiratud² | **404** | **404** | **404**³ |
| Protsessi muutmine (title/goal/kava) | ✓ CAS | – | – | – | – | 404 | 404 | 404 |
| Kontraktiversiooni loomine/aktiveerimine (M3) | ✓ | – | – | – | – | 404 | 404 | 404 |
| Kontrakti lugemine | ✓ | ✓ | ✓ | ✓ (ainus sisu, mida kutsutu näeb) | ✓ (viimane kinnitatud) | 404 | 404 | 404 |
| Kutse loomine/tagasivõtt (M4) | ✓ (sihtroll ainult SW/SP; CLIENT-sihile 422) | – | – | – | – | 404 | 404 | 404 |
| Kutse vastuvõtt/keeldumine + kontrakti kinnitus (M5) | – | – | ✓ (uue versiooni kinnitus) | ✓ | – | 404 | **404/422** | 404 |
| Eeskambri kirjed (M6): CRUD | ainult OMA | ainult OMA | ainult OMA | – (pole veel liige) | OMA vanad (read-only) | 404 | 404 | **404 — EI MÖÖDU** |
| Teema jagamine (M7 loomine) | ✓ | ✓ | **ei** (enne uue kontrakti kinnitust) | – | – | 404 | 404 | 404 |
| Jagatud teema lugemine (audience=PROCESS) | ✓ | ✓ | ✓ (lugeda saab) | – | – | 404 | 404 | 404 |
| Jagatud teema lugemine (audience=SUPERVISOR_ONLY) | ✓ | ainult autor | ainult autor | – | – | 404 | 404 | 404 |
| Teema tagasivõtt (WITHDRAWN) | – | autor | autor | – | – | 404 | 404 | 404 |
| Kohtumise plaanimine / HELD-märge (M8) | ✓ CAS | – | – | – | – | 404 | 404 | 404 |
| Kohtumiste lugemine | ✓ | ✓ | ✓ | – | faktid | 404 | 404 | 404 |
| Kokkuvõtte mustand (M9 DRAFT) | ✓ (ainult tema näeb DRAFT-i) | – | – | – | – | 404 | 404 | 404 |
| Kokkuvõtte submit (→PENDING_APPROVAL) | ✓ CAS | – | – | – | – | 404 | 404 | 404 |
| Kokkuvõtte kinnitamine (M10) | implitsiitne (submit = tema kinnitus) | ✓ | **ei** | – | ei loeta läves | 404 | 404 | 404 |
| PENDING/APPROVED kokkuvõtte lugemine | ✓ | ✓ | ✓ | – | APPROVED-id kuni lahkumiseni | 404 | 404 | 404 |
| Protsessi sulgemine (M11) | ✓ (ainult SV; eeltingimused Q2.5) | – | – | – | – | 404 | 404 | 404 |
| Sulgemise eelvaade (mis kustub/jääb) | ✓ | ✓ (read-only) | ✓ | – | – | 404 | 404 | 404 |
| Isiklik püsiväljund (M12) | ainult OMA | ainult OMA | ainult OMA | – | OMA (kui lahkus pärast sulgemist — ei teki: pakk luuakse ainult sulgemishetkel ACCEPTED-osalustele + SV-le) | 404 | 404 | **404 — EI MÖÖDU** |
| Auditisündmused (M13) | – (V0-s UI-ta) | – | – | – | – | – | – | grant-sündmused jah; protsessisündmusi sisuvaadetes ei sirvi |
| Tööheaolu-mustandi üleandmine (Q2.7 v2 — loob M6 PRIVAATkirje) | – | ✓ (ainult OMA mustand, OMA osalusega protsessi) | ✓ (privaatala kirjutus on lubatud nagu M6 CRUD) | – | – | 404 | 404 (Tööheaolu on niigi SW-only) | 404 |

¹ **KUT piiratud kaart:** protsessi pealkiri, superviisori nimi, tüüp, aktiivne kontraktitekst — EI osalejate nimekirja, EI teemasid, EI kohtumisi, EI kokkuvõtteid.
² **LAHK:** näeb protsessi kaarti, oma vanu M6 kirjeid (read-only), lahkumiseelseid APPROVED-kokkuvõtteid; EI näe uusi teemasid/kokkuvõtteid/kohtumisi pärast leftAt-i (serializer filtreerib leftAt-iga).
³ **ADMIN sisuvaadetes = VÕÕR (404).** See on kovisiooni runtime-tõendatud etalon (orientatsioonikaart ptk 8: „mitteosaleja (ka ADMIN) sai läbivalt 404"). ADMIN-i eriõigused piirduvad M1 grandi haldusega ja M13 grant-sündmustega.

**Ühetaolise 404 reegel:** olematu ID ja olemasoleva-aga-võõra ID vastus peab olema baiditi sama (sama staatus, sama keha, sama ajakäitumine — päring tehakse alati skoobitud `WHERE id AND <membership>` kujul, mitte „leia → siis kontrolli"). Kehtib M2, M6, M7, M8, M9, M12 detailipäringutele.

**Kohad, kus ADMIN EI TOHI privaatskoobist mööduda (testitavad invariandid):** M6 eeskamber (kellegi oma); M12 isiklik pakk (kellegi oma); M7 SUPERVISOR_ONLY teemad; M9 DRAFT; protsesside loend (ADMIN ei saa protsesse loendada sisu-API kaudu). Admin-diagnostika vajadus lahendatakse M13 sisuvabade sündmustega, mitte sisu-ligipääsuga.

**Kirjutuslävede koond:** kinnitada saab ainult see, kellelt kinnitust oodatakse (M5: osaleja ise; M10: ACCEPTED+kehtiva kontraktikinnitusega osaleja); sulgeda saab ainult SV; OS† (aktiivse kontraktiversiooni kinnituseta) on lugeja, mitte kirjutaja — see hoiab ära olukorra, kus osaleja panustab raamile, millega ta pole nõustunud.

## Q2.4 API ja teenusekiht

SEIS: COMPLETE

**Teenusekihi paigutus (kovisiooni pretsedent: loogika lib-is, route õhuke):** `lib/supervision/` — `grants.js`, `service.js` (protsess+kontrakt+osalus), `privateItems.js`, `topics.js`, `meetings.js`, `summaries.js`, `closure.js`, `wellbeingHandoff.js`, `serializers.js`, `notifications.js`. Iga muteeriv teenusefunktsioon: (a) advisory-xact-lukk `supervision:${processId}`; (b) allowlist-valideerimine (kanoon: `HANDOFF_REQUEST_KEYS` Set, lib/wellbeing/covisionHandoff.js:7 — tundmatu võti → 400); (c) CAS `expectedVersion`; (d) auditikirje samas tehingus.

**Ühised lepingud (kehtivad kõigile ridadele, kui rida ei ütle teisiti):**

- Autentimine: sessioon kohustuslik; autentimata → 401 (API-d; lehed järgivad olemasolevat redirect-mustrit).
- Ühetaoline 404: liikmesus-skoobitud päring (Q2.3); võõras ID ja puuduv ID eristamatud.
- Avalikud veakoodid: 400 (valideerimine/tundmatu väli), 401, 404 (skoop), 409 (CAS stale / closure olemas / PENDING-kokkuvõtted sulgemisel / topeltjagamine), 422 (ärireegel: CLIENT-sihtkutse, vale roll, grant puudub loomisõiguseks → 403 AINULT grandi puhul, sest protsessi-ID pole veel skoobi all).
- Idempotentsus: kõik „kinnita/võta tagasi/sulge" toimingud on idempotentsed (kordus → sama lõppseis, 200 või 409 vastavalt lepingule); unique-piirangud (M5, M10, M11, M12, M7.sourceWellbeingDraftId) on DB-tõkked.
- Serializer'id on vaatajapõhised (kanoon: vaatajapõhine `serializePreInquiry`, orientatsioonikaart ptk 3): iga vastus ehitatakse vaataja rolli järgi, mitte täisobjektist kärpides. Audience'id: SV / OS / OS† / KUT / LAHK — väljade komplektid Q2.3 tabeli järgi. M6 ja M12 serializer elab eraldi failis, mida jagatud vaadete kood EI impordi (CovisionPrivateState eraldatuse põhjendus, schema:2155).

**Marsruudikaart** (kõik `app/api/` all; „Lukk+audit" = advisory-lukk + M13 kirje samas tehingus):

| # | Meetod + tee | Värav | Sisendi allowlist | CAS / idempotentsus | Lukk+audit |
|---|---|---|---|---|---|
| 1 | GET `/api/admin/supervisor-grants` | ADMIN | — (query: userId?) | — | — |
| 2 | POST `/api/admin/supervisor-grants` | ADMIN | {userId, grantBasis, validUntil?} | teenus jõustab „1 aktiivne/kasutaja" luku all; kordus → 409 | ✓ GRANT_ISSUED |
| 3 | POST `/api/admin/supervisor-grants/[id]/revoke` | ADMIN | {} | idempotentne (juba tühistatud → 200 sama seis) | ✓ GRANT_REVOKED |
| 4 | GET `/api/supervision/processes` | autenditud SW/SP | — | — | — |
| 5 | POST `/api/supervision/processes` | **aktiivne grant** (403 kui pole) | {type, title, goal?, plannedMeetingCount?} | — | ✓ PROCESS_CREATED |
| 6 | GET `/api/supervision/processes/[id]` | liige/kutsutu (Q2.3) | — | — | — |
| 7 | PATCH `/api/supervision/processes/[id]` | SV | {title?, goal?, plannedMeetingCount?, expectedVersion} | CAS 409 | ✓ |
| 8 | POST `/api/supervision/processes/[id]/contract-versions` | SV | {body} | — | ✓ |
| 9 | POST `/api/supervision/processes/[id]/contract-versions/[vid]/activate` | SV | {expectedVersion} | CAS; idempotentne (juba aktiivne → 200) | ✓ CONTRACT_ACTIVATED |
| 10 | POST `/api/supervision/processes/[id]/invites` | SV | {userId} | sihtroll SW/SP, muidu 422; duplikaat → 409 (unique) | ✓ INVITE_SENT |
| 11 | POST `/api/supervision/participations/[id]/withdraw-invite` | SV | {} | idempotentne | ✓ INVITE_WITHDRAWN |
| 12 | POST `/api/supervision/participations/[id]/respond` | kutsutu ise | {action: "accept"\|"decline", contractVersionId} | accept nõuab AKTIIVSE versiooni ID-d (aegunud → 409 uue versiooniga); idempotentne | ✓ CONTRACT_ACCEPTED |
| 13 | POST `/api/supervision/processes/[id]/contract-acceptance` | OS† ise | {contractVersionId} | unique [participation, version] → kordus 200 | ✓ CONTRACT_ACCEPTED |
| 14 | GET/POST `/api/supervision/processes/[id]/private-items` | omanik-skoop (liige) | POST: {kind, title?, body} | — | EI auditit (privaatsisu; sisuvaba invariant kaaluks üles) |
| 15 | PATCH/DELETE `/api/supervision/private-items/[itemId]` | AINULT omanik | {title?, body?, expectedVersion} | CAS 409 | EI auditit |
| 16 | POST `/api/supervision/processes/[id]/topics` | OS/SV (kehtiv kinnitus) | {title, body, audience, sourcePrivateItemId?} | koopia-semantika; Tööheaolu-päritoluga M6 kirje jagatakse SAMA rea kaudu (sourceKind kopeerub; v2) | ✓ TOPIC_SHARED (metadata: topicId, audience — MITTE sisu) |
| 17 | POST `/api/supervision/topics/[id]/withdraw` | autor | {expectedVersion} | idempotentne | ✓ TOPIC_WITHDRAWN |
| 18 | POST `/api/supervision/processes/[id]/meetings` | SV | {plannedAt?} (seq arvutab server) | unique [processId, seq] | ✓ MEETING_PLANNED |
| 19 | PATCH `/api/supervision/meetings/[id]` | SV | {status?, plannedAt?, heldAt?, note?, agendaTopicIds?, expectedVersion} | CAS; HELD on lõplik (tagasi → 409) | ✓ MEETING_HELD |
| 20 | POST `/api/supervision/processes/[id]/summaries` | SV | {kind, meetingId?, body} | meetingId unique → 409 | ✓ |
| 21 | PATCH `/api/supervision/summaries/[id]` | SV, ainult DRAFT | {body, expectedVersion} | CAS; APPROVED → 409 alati | — |
| 22 | POST `/api/supervision/summaries/[id]/submit` | SV | {expectedVersion} | idempotentne | ✓ SUMMARY_SUBMITTED |
| 23 | POST `/api/supervision/summaries/[id]/approve` | OS (kehtiv kinnitus) | {} | unique [summary, participation] → kordus 200; viimane kinnitus → APPROVED samas tehingus | ✓ SUMMARY_APPROVED |
| 24 | GET `/api/supervision/processes/[id]/close-preview` | liige | — | — | — |
| 25 | POST `/api/supervision/processes/[id]/close` | SV | {expectedVersion, generalizedTitle} | Q2.5 järjestus; closure olemas → 409 | ✓ PROCESS_CLOSED |
| 26 | POST `/api/wellbeing/output-drafts/[id]/supervision` | mustandi omanik + OS/OS† sihtprotsessis | {processId, expectedUpdatedAt} | **loob M6 PRIVAATkirje (Q2.7 v2)**; mehaanika peegel covision-handoff'ile (app/api/wellbeing/output-drafts/[id]/covision/route.js); topelt → 409 (M6 unique) | EI auditit (privaatala) |
| 27 | GET `/api/supervision/outcomes` (+ `/[id]`) | AINULT omanik | — | — | — |

**Serializer-väljade miinimum (näited):** rida 6 KUT-vaatajale: {id, title, type, supervisorName, activeContract:{versionNumber, body}, myParticipation:{status}} — EI participants[], topics[], meetings[], summaries[]. Rida 6 OS-vaatajale: + participants (nimed+staatus), meetings (faktid), topics (audience-filtreeritud), summaries (PENDING/APPROVED), myPrivateItems EI OLE selles vastuses (eraldi rida 14 — privaatsisu ei sõida jagatud vastuses).

## Q2.5 Atomaarne sulgemine ja purge

SEIS: COMPLETE

Etalon: kovisiooni atomaarne sulgemine (orientatsioonikaart ptk 8: closure + omanikupakk + detailide kustutus ühes tehingus, runtime-tõendatud). Kogu järjestus 1–8 toimub ÜHES `prisma.$transaction`-is; lukukanoon: `SELECT pg_advisory_xact_lock(hashtext('supervision:' || processId))` (lib/covisionLegacyWrite.js:6 muster — xact-lukk vabaneb tehinguga automaatselt).

**Sulgemistehingu järjestus:**

1. **Värske seis luku all.** Võta advisory-xact-lukk; loe protsess + osalused + aktiivne kontraktiversioon + kokkuvõtted SAMAS tehingus (mitte enne lukku loetud andmeid usaldades); kontrolli `expectedVersion` == M2.version (CAS) — stale → 409, ei kirjuta midagi.
2. **Eeltingimused.** Protsess status=ACTIVE (DRAFT-i võib sulgeda ainult „tühistamisena" — V0 lihtsustus: DRAFT-protsessi sulgemine = sama tehing, aga vahele jäävad sammud 3–4, sest kinnitatud väljundeid pole); ühtegi M9 kirjet ei ole PENDING_APPROVAL olekus (kas kinnita või discard'i enne — server tagastab 409 + loendi); closure't ei eksisteeri (olemasolu → samm 9).
3. **Kinnitatud väljundite külmutamine.** Märgi kõik APPROVED M9 read immutable'iks (server-invariant kehtib niigi; siin arvutatakse `approvedSummaryCount` ja kogutakse tekstid sammu 4 jaoks); DRAFT/PENDING/DISCARDED M9 read kustutatakse.
4. **Isiklikud püsiväljundid (M12).** Loo igale sulgemishetkel ACCEPTED-osalusele JA superviisorile üks `SupervisionPersonalOutcome`: contentJson = {approvedSummaries[], lastAcceptedContractBody, facts}; processTitleGeneralized = üldistatud pealkiri (superviisor annab sulgemisvormis; vaikimisi tüüp+kuu, nt „Grupisupervisioon, kevad 2026").
5. **Jagatud toorsisu kustutamine.** DELETE kõik protsessi M7 SharedTopic-read (sh WITHDRAWN); M8 ridadel: note→NULL, agendaTopicIds→[], topicCountAtClose←arv; M2-l: title←processTitleGeneralized, goal→NULL. M6 privaatkirjeid EI puututa (jäävad omanikele); M3 kontraktiversioonid jäävad (kinnitatud raam); M5 kinnitused jäävad (fakt).
6. **Minimaalne faktijälg.** Koosta factsJson (meetingsPlanned/held, participantCount, firstHeldAt, lastHeldAt, approvedSummaryCount) ja purgeReport (kustutatud ridade arvud tüübiti: sharedTopics, draftSummaries, meetingNotes).
7. **Protsessi sulgemine.** Loo M11 SupervisionClosure (factsJson, purgeReport, retentionStatus="AWAITING_POLICY"); M2.status←CLOSED, closedAt←now, version++.
8. **Auditikirje.** M13 PROCESS_CLOSED (metadata = purgeReport arvud; MITTE sisu). Teavitussündmused (U1, Q2.8) kirjutatakse samas tehingus NotificationEvent-ridadena (fakt+viide, sisuta — olemasolev muster).
9. **Idempotentne kordus.** Kui M11 closure on juba olemas: tagasta 409 + olemasoleva closure viide (mitte uus purge); topeltklõps/paralleelpäring: teine päring ootab advisory-lukku, näeb closure't sammul 2, saab 409. Kordus EI tohi luua teist M12 pakki (unique [processId, ownerUserId] on DB-tõke).
10. **Rollback.** Iga sammu ebaõnnestumine (sh M12 unique-konflikt, mida poleks tohtinud juhtuda) → kogu tehing rullub tagasi: purge'i EI toimunud, closure't EI ole, protsess jääb ACTIVE — pool-suletud olekut ei eksisteeri kunagi. Advisory-xact-lukk vabaneb automaatselt.

**Sama DB-tehingu piir vs väline cleanup:**

- **Samas tehingus PEAB olema:** kõik sammud 1–8 (read + kustutused + closure + pakid + audit + notification-read).
- **Välist cleanup'i V0-s EI OLE:** supervisioon ei kirjuta faile (dokumendimoodulit ei puudutata), ei salvesta kõnesid (otsus 2), **ei saada RAG-i** (kohustuslik invariant: ükski supervisiooni vabatekst ei jõua RAG-i töö­järjekorda ega embedding'usse; erinevalt kovisiooni praktikate rajast supervisioonil RAG-sünki EI OLE). Seega puudub ka „eraldi usaldusväärse kustutustöö" vajadus — see on V0 teadlik lihtsus. Kui V1 lisab manused, tuleb siia kaheastmeline kustutus (DB-tehing + järeltöö-järjekord), aga MITTE V0-s.
- U1 e-kirjad on sisuvabad ja opt-in (olemasolev kiht) — sulgemisjärgne e-kiri ei vaja cleanup'i.

## Q2.6 Eeskambri UI

SEIS: COMPLETE

V0 teostab variandi A (Q1 osa 9/10) LIHTSA vaadetekomplektina — ruumigrammatika (eeskamber/lävi/laud/kapp) kantakse paigutuse ja märgistusega, MITTE uue lõuendimootori, Flight-efekti ega detailse visuaalkujundusega. Marsruudijuur: `app/supervisioon/` (leht järgib olemasolevat autentimisväravat). Ühisreeglid: iga vaade on otselingiga avatav (URL-olek allpool); brauseri tagasi/edasi töötab; `prefers-reduced-motion` = sama sisu ilma üleminekuteta; klaviatuuriga tehtav kõik, mis hiirega; privaatsusmärgis („Ainult sina näed" / „Näevad: superviisor + N osalejat") on püsielement, mitte tooltip.

| # | Vaade | Põhitegevus | Privaatsusolek (nähtav märgis) | Peamine nupp | URL-olek | Laadimis/vea/konfliktiseis | Mobiilis lihtsusta |
|---|---|---|---|---|---|---|---|
| 1 | Minu protsessid | vali protsess; näe rolli (SV/OS) ja ootel tegevusi | roll + staatusemärgis kaardil | „Ava" (SV-l lisaks „Uus protsess") | `/supervisioon` | skeleton-loend; tühi-olek selgitusega; 401→login | üherealine loend |
| 2 | Uue protsessi loomine (ainult grandiga SV) | tüüp+pealkiri+eesmärk+kohtumiste arv | „Mustand — näed ainult sina, kuni kutsud" | „Loo protsess" | `/supervisioon/uus` | 403 grandita → selgitus (mitte tühi viga); valideerimisvead väljade juures | üks väli sammu kohta |
| 3 | Kontrakt ja kutsed (SV) | kontraktiversiooni koostamine/aktiveerimine; osalejate kutsumine | „Kutsutu näeb pealkirja, sinu nime ja kontrakti" | „Aktiveeri versioon" / „Saada kutse" | `/supervisioon/[id]?ala=kontrakt` | CAS 409 → „keegi muutis vahepeal, laadi uuesti" + diff-viide; 422 CLIENT-sihile | kutse ja versioonid eraldi sakkidena |
| 3b | Kutsutu vastamisvaade (KUT) | loe kontrakti; nõustu/keeldu | „Sa ei ole veel liige — näed ainult kontrakti" | „Kinnitan kontrakti ja liitun" | `/supervisioon/[id]` (KUT-serializer annab piiratud kaardi) | aegunud versioon → 409 + uus tekst | sama |
| 4 | Privaatne eeskamber | teemamustandite loomine/muutmine (M6) | **„Ainult sina näed"** — püsiv, iga kirje juures | „Uus mustand" | `/supervisioon/[id]?ala=eeskamber` | autosalvestuse CAS-konflikt → „teises aknas muudetud" valikuga; offline-viga ei kaota teksti (lokaalne puhver) | täisekraani redaktor |
| 5 | Jagamise eelvaade (lävi) | vali mustand → näe TÄPSELT, mis väljad ja kellele lähevad; vali audience | „Pärast jagamist näevad: …" nimeliselt | „Jagan teadlikult" (kaheastmeline: eelvaade → kinnitus) | `/supervisioon/[id]/jaga?item=[itemId]` | 400 tundmatu väli (ei tohiks UI-st tekkida); 409 kui kontraktikinnitus puudub (OS†) → selgitus | eelvaade ja kinnitus eraldi ekraanidel |
| 6 | Kohtumised ja järgmised ajad | kava vaatamine; SV: plaani, märgi toimunuks | kohtumise faktiväljad on liikmetele ühised | SV: „Märgi toimunuks" | `/supervisioon/[id]?ala=kohtumised` | HELD-lõplikkus: kinnitusdialoog enne; 409 CAS | kaardiloend, mitte tabel |
| 7 | Kokkuvõte ja kinnitamine | SV: koosta/submiti; OS: loe + kinnita | DRAFT: „Näed ainult sina (SV)"; PENDING: „Ootab N/M kinnitust" | SV: „Saada kinnitamisele"; OS: „Kinnitan" | `/supervisioon/[id]?ala=kokkuvotted&summary=[sid]` | kinnituste seis reaalajas (polling piisab); 409 juba-kinnitatud → sulanduv „kinnitatud" | lugemisvaade ees, kinnitus lõpus |
| 8 | Kinnitatud väljundite kapp | APPROVED kokkuvõtete + kehtiva kontrakti lugemine | „Püsiv — jääb alles ka pärast sulgemist" | — (lugemisvaade) | `/supervisioon/[id]?ala=kapp` | tühi-olek: „kinnitatud väljundeid pole veel" | sama |
| 9 | Sulgemise eelvaade (SV; OS read-only) | näe LOENDIT: mis kustub (teemad, mustandid, märkmed) / mis jääb (kinnitatud, faktid, sinu privaatsed) | kaks selgelt eristatud tulpa „Kustub" / „Jääb" | SV: „Sulgen protsessi lõplikult" (topeltkinnitus + üldistatud pealkirja sisestus) | `/supervisioon/[id]/sulge` | 409 PENDING-kokkuvõtetega → loend + otselingid; 409 juba suletud → suuna vaatesse 10 | sama |
| 10 | Suletud protsessi vaade | faktid + kapp + MINU isiklik pakk (M12) | „Protsess on suletud; toorsisu on kustutatud" + purgeReport arvud | „Ava minu pakk" | `/supervisioon/[id]` (CLOSED-serializer) ja `/supervisioon/valjundid/[outcomeId]` | — | sama |

**Navigeerimisleping:** `?ala=` väärtused on püsivad ankrud (eeskamber/kontrakt/kohtumised/kokkuvotted/kapp); U2 „Jätka siit" sihib alati täpset `?ala=...&summary=...` oleku-URL-i (Q2.8). Ruumikeel V0-s: eeskamber-ala visuaalselt eristatud (hämaram paneel) + lävi = vaade 5 eraldi sammuna — sellest piisab, et Q1 variandi A tähendus (privaatne koht → nähtav lävi → ühine ala → kapp) oleks olemas ilma 3D-tööta.

**Sisu neljane jaotus (siduv piir igale UI-elemendile; iga vaade kannab vastavat märgist):**

| Sisuelement | Mudel | Kes näeb | Sulgemisel |
|---|---|---|---|
| Eeskambri mustandid ja privaatmärkmed | M6 | AINULT omanik (mitte SV, mitte ADMIN) | jääb omanikule |
| Tööheaolust toodud küsimus (jagamata) | M6 (sourceKind=WELLBEING_HANDOFF) | AINULT omanik | jääb omanikule |
| Jagatud teema, audience=SUPERVISOR_ONLY | M7 | autor + superviisor | **kustub** |
| Jagatud teema, audience=PROCESS | M7 | kõik ACCEPTED liikmed | **kustub** |
| Kontrakt (versioonid + kinnitusfaktid) | M3 + M5 | liikmed; kutsutu ainult aktiivset versiooni | jääb (kinnitatud raam) |
| Kohtumise fakt (seq, ajad, staatus) | M8 | liikmed | jääb |
| Kohtumise töömärge | M8.note | liikmed | **kustub** (NULL) |
| Kokkuvõtte mustand (DRAFT) | M9 | AINULT superviisor | **kustub** (PENDING ei saa sulgemisel eksisteerida — 409) |
| Kinnitatud kokkuvõte (APPROVED) | M9 (+M10 faktid) | liikmed | jääb (külmutatud) |
| Isiklik püsiväljund | M12 | AINULT omanik | tekib sulgemisel |
| Faktijälg (osalus, closure, purgeReport arvud) | M4/M11 | liikmed | jääb |

## Q2.7 Tööheaolu üleandmise piir

SEIS: COMPLETE (v2 — siht on EESKAMBER, mitte jagatud teema; asendab varasema versiooni)

**Siduv ahel:**

```text
Tööheaolu privaatne kirje (EI liigu kunagi)
→ kasutaja enda üldistus (olemasolev Tööheaolu väljundmustandi voog)
→ „supervisiooni küsimuse" mustand (WellbeingOutputDraft, recipientType="supervisor" — lib/wellbeing/supportDrafts.js:18)
→ eelvaade (kasutaja näeb täpselt üleantavat teksti + sihtprotsessi)
→ kinnitus (expectedUpdatedAt-fingerprint)
→ Supervisiooni EESKAMBER (M6 privaatkirje) — superviisor EI näe midagi
```

Üleandmine EI loo jagatud teemat ega tee midagi superviisorile loetavaks. Sisu jõuab superviisorini (või grupini) AINULT hilisema tavalise jagamisväravaga (rida 16: M6 → eelvaade → audience-valik → M7).

Mehaanika-etalon: peegel `lib/wellbeing/covisionHandoff.js` lepingule — allowlist `HANDOFF_REQUEST_KEYS` (:7), range ISO `expectedUpdatedAt` parse (:76–83), `sameInstant`-võrdlus (:172), `handedOffAt` samas tehingus (:235). Erinevus kovisiooni-rajast: sihtobjekt on privaatne M6 kirje, mitte uus juhtum.

Vastused ülesande küsimustele:

1. **Protsessi valik:** rida 26 keha `{processId, expectedUpdatedAt}`; UI pakub ainult ACTIVE protsesse, kus kasutajal on ACCEPTED-osalus (server kordab kontrolli). `confirmedNoIdentifiers` EI ole siin vajalik — kellelegi ei jagata veel midagi; anonüümsuskontroll kuulub jagamisväravasse (rida 16).
2. **Üle antav tekst:** AINULT kasutaja kinnitatud lõpptekst — `editedText ?? generatedText`, ja ainult kui `userReviewed=true` JA `userConfirmed=true` JA `recipientType="supervisor"`; muidu 422/409.
3. **Mis EI liigu:** toorkirje (`sourceRecordId` sisu), töövoo tüübi detailid, kirje kuupäevad/vastused — M6 kirjesse läheb {kind: PREP_TOPIC, title (kasutaja annab üleandmisel), body = kinnitatud tekst, sourceKind: WELLBEING_HANDOFF, sourceWellbeingDraftId}; mitte midagi muud (allowlist).
4. **Fingerprint:** `expectedUpdatedAt` peab olema baiditi sama mis `draft.updatedAt.toISOString()` (sameInstant-kanoon); erinevus → 409, ei kirjuta.
5. **Topeltüleandmise tõkked:** teenusevärav `draft.handedOffAt === null && draft.covisionCaseId === null` JA DB-tõke **M6**.`sourceWellbeingDraftId @unique` — paralleelpäring → 409.
6. **Päritolu:** M6.sourceKind + sourceWellbeingDraftId (SetNull); jagamisel kopeerub sourceKind M7-sse (märgis „toodud Tööheaolust"); Tööheaolu poolel `handedOffAt`. U12 „Minu jagamised" kirje tekib alles JAGAMISEL (rida 16) — üleandmine ise ei jaga kellelegi midagi, seega U12-sse ei kuulu.
7. **Mida näeb superviisor:** MITTE MIDAGI enne jagamist (M6 on omanik-only; superviisori päring kirjele → 404; test #16). Pärast jagamist: M7 koopia + päritolumärgis.
8. **Mida näevad teised osalejad:** mitte midagi enne jagamist; pärast jagamist ainult siis, kui autor valis audience=PROCESS.
9. **Millal muutub jagatud teemaks:** AINULT rida 16 kaudu (eelvaade + audience-valik + teadlik kinnitus) — täpselt sama värav nagu igal muul eeskambri mustandil; Tööheaolu-päritolu EI anna kiirteed.

**Skeemimõju:** WellbeingOutputDraft EI muutu (unique-viide elab M6 poolel); `handedOffAt` semantika = „üle antud (kovisiooni VÕI supervisiooni)". **Auditimõju:** üleandmine M13 kirjet EI loo (privaatala toiming — järjepidev M6-reegliga); alles jagamine loob tavalise TOPIC_SHARED.

## Q2.8 U1/U2 integratsioon

SEIS: COMPLETE

Kõik sündmused = olemasolev `NotificationEvent` (schema:1912): fakt + viide, MITTE SISU (ei protsessi pealkirja vabateksti riskantseid osi — pealkiri on lubatud ainult continuity-sildis, mitte e-kirjas; e-kirjad jäävad olemasoleva opt-in korra alla). `sourceType="supervision"`.

| Sündmus (type) | Päästik | Saajad | targetKind/targetId | dedupeKey | „Jätka siit" siht-URL |
|---|---|---|---|---|---|
| supervision_invite | rida 10 | kutsutu | process/[id] | `sup:inv:{participationId}` | `/supervisioon/[id]` (KUT-vaade) |
| supervision_contract_pending | rida 9 (uue versiooni aktiveerimine) | kõik ACCEPTED, kel uus kinnitus puudu | process/[id] | `sup:ctr:{participationId}:{versionId}` | `/supervisioon/[id]?ala=kontrakt` |
| supervision_meeting_upcoming | plannedAt läheneb (olemasolev 5-min teavitustimer, „läheneva tähtaja" kategooria) | kõik liikmed | meeting/[id] | `sup:mtg:{meetingId}:{userId}` | `/supervisioon/[id]?ala=kohtumised` |
| supervision_summary_pending | rida 22 (submit) | kõik ACCEPTED, kelle kinnitus puudu | summary/[id] | `sup:sum:{summaryId}:{participationId}` | `/supervisioon/[id]?ala=kokkuvotted&summary=[sid]` |
| supervision_prep_waiting | järgmine PLANNED kohtumine olemas JA kasutajal 0 jagatud teemat selle kohta (koostatakse continuity-päringul, MITTE push-sündmusena — vältimaks survet; ainult „Jätka siit" kirje, mitte teavitus) | osaleja ise | process/[id] | — (pole NotificationEvent) | `/supervisioon/[id]?ala=eeskamber` |
| supervision_closed | rida 25 (sulgemistehing) | kõik liikmed | process/[id] | `sup:cls:{processId}:{userId}` | `/supervisioon/[id]` (CLOSED-vaade) |

Reeglid: teavituskirjed luuakse SAMAS tehingus toiminguga (Q2.5 samm 8 jt); `supervision_prep_waiting` on teadlikult AINULT continuity-allikas (mitte teavitus — restoratiivne kontekst, mitte kohustuse meeldetuletus); ükski type ei kanna teksti sisu (test #15); U2 koostur saab supervisiooni-allika, mis tagastab kuni 2 kirjet kasutaja kohta (kinnitamata kontrakt/kokkuvõte ees, ettevalmistus tagapool), et mitte ummistada 7-kirje limiiti.

## Q2.9 Migratsiooni- ja integratsioonijärjekord

SEIS: COMPLETE

**Migratsioonide hetkeseis (kontrollitud Glob'iga selle plaani koostamisel):** viimane migratsioon on `20260715120000_u1_u2_notification_continuity`. **Uus unikaalne migratsiooniaeg: `20260716090000_supervision_v0`** (hilisem kui kõik olemasolevad; migratsiooni ENNAST selle ülesande raames ei looda).

**Konfliktiteadlik järjekord** (vastab pakettidele SUP-P0…P11):

1. **Skeem ja migratsioon** (P0) — ainus skeemipuude; enne haru merge'i kontrolli `prisma/migrations` saba uuesti (kui vahepeal on maandunud U6/U7/role-aware-invite või muu haru migratsiooniga, nihuta timestamp ettepoole); lokaalse dev-DB reegel: enne tööd `prisma migrate deploy` (orientatsioonikaardi ptk 8 leid 1 — lokaal oli 6 migratsiooni maas).
2. **Serveriteenused** (P1 grant; P2 tuum; P3–P7 teenusfailid) — kõik `lib/supervision/` all; ei puuduta olemasolevaid lib-faile (ainus erand: U2 continuity-koosturi allikaliides, samm 6).
3. **Õigused ja serializer'id** — P2 sees (assertid + audience-serializer'id) ENNE API-ridade avamist; `serializersPrivate.js` eraldatus CI-grep'iga.
4. **API** (P2–P7 route-failid) — iga pakett avab oma read alles siis, kui teenusetestid rohelised.
5. **Eeskambri UI** (P10) — algab pärast P2 API stabiilsust; võib käia paralleelselt P8/P9-ga.
6. **Teavitused ja jätkamine** (P8) — puudutab ühte olemasolevat faili (continuity-koostur): väike, eraldi auditeeritav diff.
7. **Tööheaolu üleandmine** (P9) — uus route + uus lib-fail; `covisionHandoff.js` jääb puutumata.
8. **Sulgemine ja cleanup** (P7) — NB: loogiliselt enne P8/P9 merge'i (sulgemissündmus on P8 sisend; järjekord ülal on pakettide TÖÖ-järjekord, merge-järjekord: P7 → P8/P9).
9. **Täiskontroll** (P11) — päris-DB e2e + IDOR-sviip + purge DB-kinnitus; alles pärast seda deploy.

**Ristumiskohad olemasolevate harudega (15.07 seis):** `opus/u6-personal-search`, `codex/u7-plain-language`, `codex/role-aware-invite-copy` ootavad merge'i — ükski ei puuduta supervisiooni tabeleid ega `lib/supervision/` kausta; ainus jagatud puutepunkt on `prisma/schema.prisma` User-mudeli relatsiooniplokk (tekstikonflikti võimalus, sisulist mitte) ja migratsioonide järjekord. Reegel: P0 haru rebase'itakse vahetult enne merge'i ja migratsioonikaust nummerdatakse vajadusel ümber.

**Additiivsus, indeksid, rollback ja andmemõju:**

- **Rangelt additiivne:** migratsioon sisaldab AINULT CREATE TYPE (11 enumit), CREATE TABLE (13 tabelit), CREATE INDEX/UNIQUE ning FK-sid uutelt tabelitelt olemasolevatele (User, WellbeingOutputDraft) — MITTE ÜHTEGI ALTER-it olemasolevatele tabelitele ega andmete backfill'i. P0 auditipunkt kontrollib seda migration.sql-ist rida-realt.
- **Indeksite koond (allikas Q2.2):** M1 [userId,revokedAt,validUntil]; M2 [supervisorId,status,updatedAt]+[status,lastActivityAt]; M3 unique[processId,versionNumber]+[processId,status]; M4 unique[processId,userId]+[userId,status,updatedAt]; M5 unique[participationId,contractVersionId]+[contractVersionId]; M6 [processId,ownerUserId,updatedAt]+unique(sourceWellbeingDraftId); M7 [processId,status,sharedAt]+[authorParticipationId]; M8 unique[processId,seq]; M9 unique(meetingId)+[processId,kind,status]; M10 unique[summaryId,participationId]; M11 unique(processId); M12 unique[processId,ownerUserId]+[ownerUserId,createdAt]; M13 [processId,createdAt]+[actorUserId,createdAt].
- **Rollback:** kuna migratsioon on puhtalt additiivne, on tagasitee = uute tabelite+enumite DROP vastupidises FK-järjekorras (M13→M12→M11→M10→M9→M8→M7→M6→M5→M4→M3→M2→M1→enumid); kaotsi läheb ainult supervisiooni enda sisu. Repo praktika on forward-only — rollback on erakorraline käsitsi-protseduur, mille järjekord dokumenteeritakse P0 PR-kirjelduses.
- **Olemasolevate andmete mõju:** NULL — ühtegi olemasolevat rida ei loeta ega muudeta; User ja WellbeingOutputDraft saavad ainult sissetulevaid FK-viiteid (SetNull/Cascade suunad kavandatud nii, et olemasolevate kirjete kustutuskäitumine ei muutu).
- **Sõltuvused:** P0 eeldab ainult main'i hetkeseisu (viimane 20260715120000_u1_u2_notification_continuity); ükski hilisem pakett EI lisa oma migratsiooni (üks migratsioon V0 peale; kui parandus on vältimatu, tuleb uus hilisem timestamp, mitte olemasoleva ümberkirjutus).

## Q2.10 Kohustuslik testiplaan

SEIS: COMPLETE

**Taristureeglid (repo kehtiv kord):** `npm test` = node:test, ELAVAT DB-d EI OLE; DB-loogika testitakse süstitud fake-prismaga (teenusefunktsioonide signatuur `{db = prisma}` — kovisiooni/praktikate testide muster, `tests/covision`, `tests/effectivePractices`); päris referentsiaalsus/cascade → `npm run db:migrate:check` (localhost Postgres); runtime-e2e päris DB vastu = temp-login-tokenitega lokaalne dev-server (kovisiooni 14.07 sihtkontrolli meetod). Uus kaust: `tests/supervision/`.

**18 kohustuslikku regressioonitesti** (veerg „Tüüp": U = teenuse ühiktest fake-prismaga; S = serializer'i audience-test; R = route-leping; M = migratsioonitest; UI = UI olekuleping; I = päris-DB integratsioonikontroll enne deploy'd):

| # | Test | Tüüp | Asukoht (kavandatav) |
|---|---|---|---|
| 1 | Ainult ADMIN saab anda superviisori granti (SW/SP/CLIENT katse → 403) | U+R | tests/supervision/grants.test.js |
| 2 | Aegunud (validUntil möödas) või tühistatud (revokedAt) grant → protsessi loomine 403 | U | grants.test.js |
| 3 | CLIENT ei saa osaleda: kutse CLIENT-ile → 422; CLIENT-i päring protsessile → 404 | U+R | participation.test.js |
| 4 | INVITED (kinnitamata) näeb AINULT piiratud kaarti (Q2.3 ¹): ei osalejaid, teemasid, kohtumisi, kokkuvõtteid | S | serializers.test.js |
| 5 | Võõras ID ja olematu ID → baiditi sama 404 (M2, M6, M7, M8, M9, M12 detailid) | R | uniform404.test.js |
| 6 | ADMIN → osaleja M6 eeskambri item 404; M12 pakk 404; protsesside loend tühi | U+R | idor.test.js |
| 7 | SV ei näe osaleja M6 kirjet enne jagamist (M6 päring SV-na → 404; protsessi detailvastuses M6 välju pole) | U+S | idor.test.js |
| 8 | Jagamine edastab AINULT manifesti väljad: M7 kirje = {title, body, audience} koopia; hilisem M6 muudatus EI muuda M7-t; lisaväli sisendis → 400 | U | topics.test.js |
| 9 | Kontrakti uue versiooni aktiveerimine → senine acceptance ei loe; OS† ei saa jagada (409/403-leping) ega kinnitada; uus acceptance taastab | U | contracts.test.js |
| 10 | Stale `expectedVersion` → 409 JA ühtegi rida ei muudetud (fake-prisma kirjete kontroll) | U | cas.test.js |
| 11 | Topeltklikk/paralleel: respond, approve, close, handoff → ei duplikaati (unique-tõkked M5/M10/M11/M12/M7.source) | U | idempotency.test.js |
| 12 | M9 → APPROVED alles siis, kui KÕIK sulgemishetkel ACCEPTED-osalused on kinnitanud; LEFT ei blokeeri; OS† kinnitus tagasi lükatud | U | summaries.test.js |
| 13 | Sulgemine ühes tehingus: APPROVED jääb muutumatuna, M7 kõik kustunud, M8.note NULL, M9 DRAFT/PENDING kustunud, M12 pakid loodud, M2 title üldistatud — JA vahepealse vea korral rollback (fake-prisma tx-katkestus) | U | closure.test.js |
| 14 | Sulgemise kordus → 409 + sama closure; teist M12 pakki ei teki | U | closure.test.js |
| 15 | Ükski NotificationEvent ei sisalda vabateksti: type/sourceType/sourceId/targetKind/targetId AINULT (leping kõigile Q2.8 sündmustele) | U | notifications.test.js |
| 16 | Tööheaolu üleandmine loob AINULT M6 privaatkirje (superviisori päring → 404; grupp ei näe midagi); toorkirje väljad ei liigu; topelt → 409 (M6 unique); jagatuks saab AINULT rida-16 värava kaudu | U+S | handoff.test.js |
| 17 | Konto kustutamine: osaleja kustutus → tema M4/M5/M6/M12 kadunud, M7 autor-cascade, protsess terve; SV kustutus → protsess+alamad kadunud, teiste M12 pakid ALLES (processId SetNull) | M+I | db:migrate:check + integratsioon |
| 18 | Supervisiooni teksti EI saadeta RAG-i: teenusekiht ei impordi RAG-sünki; grep-invariant `lib/supervision/` → 0 RAG-viidet; runtime: ükski supervision-action ei loo RAG-tööjärjekorra kirjet | U+I | ragIsolation.test.js + grep CI-reeglina |

**Kategooriate kaupa (lisaks 18-le):**

- **Teenuse ühiktestid:** iga `lib/supervision/*.js` avalik funktsioon õnneliku raja + skoobivea + CAS-vea kohta; olekusiirete täielik maatriks (M2 DRAFT→ACTIVE→CLOSED; M4 kõik siirded; M9 DRAFT→PENDING→APPROVED/DISCARDED).
- **Serializer'i audience-testid:** iga audience (SV/OS/OS†/KUT/LAHK) × iga objektitüüp — väljade allowlist-võrdlus (mitte „sisaldab", vaid TÄPNE võtmehulk, et uus väli ei lekiks vaikimisi); LAHK leftAt-filtri test (uus teema pärast lahkumist → ei tagastata).
- **Route-lepingud:** iga Q2.4 rida: 401 autentimata; 400 tundmatu kehaväli; õige staatus õnnelikul rajal; ühetaoline 404.
- **Migratsioonitestid:** `db:migrate:check` — FK-d, cascade'id (test 17), unique-piirangud (M5, M10, M11.processId, M12 [processId,ownerUserId], M7.sourceWellbeingDraftId), NULL-käitumised (M12 processId SetNull).
- **UI olekulepingud:** Q2.6 vaadete olekud (laadimine/viga/409-konflikt/tühi) — komponenditestid andmelepingu vastu (mitte visuaal); „privaatne/jagatud" märgise kohalolu eeskambri ja jagamis-eelvaate vaadetes.
- **Päris-DB integratsioonikontrollid enne deploy'd (käsitsi/e2e, temp-login-token):** täisvoog grant→loomine→kutse→accept→prep→jagamine→kohtumine→kokkuvõte→kinnitused→sulgemine kahe päris kontoga; DB-tasandi kinnitus purge järel (raw SQL: M7 count=0, M8.note NULL, M9 ainult APPROVED); IDOR-sviip admin-kontoga; test 18 runtime-pool.

**Klassimaatriks (15 nõutud klassi → katvus; uued testid T19–T22):**

| Klass | Katvus |
|---|---|
| Rollid ja võõra objekti 404 | #1, #3, #5 + route-lepingute 404-read |
| Privaatse eeskambri eraldatus | #6, #7 + S-kategooria täpne-võtmehulk M6-le |
| Kontrakti versioon ja taaskinnitus | #9 + M5 unique-leping |
| Jagamissnapshot | #8 (koopia külmub; M6 hilisem muudatus ei levi) |
| CAS ja paralleelsus | #10, #11 |
| Kutsed | #3, #4, #11(respond) + **T19a**: kutse tagasivõtt (WITHDRAWN) lõpetab kutsutu ligipääsu kontraktile |
| Teavituste sisutus | #15 |
| Sulgemine ja purge | #13, #14 |
| Konto kustutamine | #17 |
| Auditijälg | **T19**: iga Q2.4 „✓"-rida loob täpselt ÜHE M13 kirje õige action'iga; M13.metadata vabateksti-keeld (regex-invariant kõigi stringiväärtuste peal: ainult id/enum/arv); M6- ja handoff-toimingud EI loo M13 kirjet |
| Tööheaolu no-leak | #16 (v2: ainult M6; superviisor 404 enne jagamist) + toorkirje väljade allowlist-test |
| Admin ei näe supervisiooni sisu | #6 + IDOR-sviip (I-kategooria) |
| Individuaal- ja grupisupervisioon | **T20**: INDIVIDUAL — 1 osaleja kinnitus viib M9 APPROVED-iks ja sulgemine loob 2 pakki (osaleja+SV); GROUP — lävi on KÕIK ACCEPTED; type ei muuda ühtegi õigusrida |
| ET/EN/RU | **T21**: `i18n:check` pariteet (repo kord: et-baas, lint keelab hard-coded JSX-teksti); väravavaadete (3b kontraktinõusolek, 5 jagamise eelvaade, 9 sulgemise eelvaade) tekstid olemas kõigis kolmes keeles |
| Ligipääsetavus | **T22**: vaadete 4/5/9 täielik klaviatuurirada (tab-järjekord, Enter kinnitab, Escape katkestab), nähtav fookus, jagamisväraval aria-tekst „kes näeb pärast jagamist"; `prefers-reduced-motion` = sama sisu ilma üleminekuteta |

## Q2.11 Teostuspaketid

SEIS: COMPLETE

Iga pakett on eraldi harul tehtav (Sol/Codex) ja sõltumatult auditeeritav (Opus). Vorming: **Eesmärk / Puutepind / Sõltub / Privaatsusinvariant / Valmis-kriteerium / Testid / Auditipunkt.**

### SUP-P0 — Skeem ja migratsioon

- **Eesmärk:** M1–M13 Prisma skeemi + enum'id + User tagasi-relatsioonid + migratsioon `20260716090000_supervision_v0`.
- **Puutepind:** `prisma/schema.prisma`; `prisma/migrations/20260716090000_supervision_v0/migration.sql`. MITTE ÜHTEGI muud faili (WellbeingOutputDraft EI muutu — Q2.2 kokkuvõte).
- **Sõltub:** —.
- **Privaatsusinvariant:** M6/M12 EI oma relatsioone, mida jagatud serializer saaks include'iga kaasa tõmmata protsessi alt (M6 seos ainult processId+ownerUserId indeksitena; teadlikult EI defineerita `process.privateItems` include-rada — kui Prisma relatsioon on vajalik FK jaoks, dokumenteeri serializer-keeld).
- **Valmis:** `prisma migrate dev` puhas; `npm run db:migrate:check` roheline; skeem vastab Q2.2 tabelile 1:1.
- **Testid:** migratsioonitestid (Q2.10 M-kategooria: cascade'id, unique'id, SetNull-id — test 17 DB-pool).
- **Audit:** Opus võrdleb skeemi Q2.2 vastu välja-väljalt; kontrollib, et ükski olemasolev mudel peale User-relatsioonide ei muutunud (`git diff prisma/schema.prisma` ainus lisandumine).

### SUP-P1 — Grant-teenus ja admin-API

- **Eesmärk:** M1 elutsükkel: anna/tühista/loe; „1 aktiivne grant" reegel; GRANT_ISSUED/REVOKED audit.
- **Puutepind:** `lib/supervision/grants.js`; `app/api/admin/supervisor-grants/**` (read 1–3); admin-UI EI kuulu siia (V0-s piisab API-st + olemasolevast admin-konsoolist hiljem).
- **Sõltub:** P0.
- **Invariant:** grantBasis ei jõua kunagi mitte-admin serializer'isse (v.a omanikule endale fakti kujul).
- **Valmis:** read 1–3 töötavad; 403-väravad testitud.
- **Testid:** Q2.10 #1, #2.
- **Audit:** rollivärav igas route'is; PracticeCapability-mustri võrdlus (schema:2382).

### SUP-P2 — Protsessi tuum (protsess + kontrakt + kutse + nõusolek)

- **Eesmärk:** M2/M3/M4/M5 teenused + read 4–13 + vaatajapõhised serializer'id (SV/OS/OS†/KUT/LAHK) + ühetaoline 404.
- **Puutepind:** `lib/supervision/service.js`, `serializers.js`; `app/api/supervision/processes/**`, `participations/**`.
- **Sõltub:** P0, P1.
- **Invariant:** KUT näeb ainult piiratud kaarti; VÕÕR/CLIENT/ADMIN → 404; serializer ehitab audience'i järgi, mitte ei kärbi.
- **Valmis:** read 4–13 + Q2.3 maatriksi protsessi/kontrakti/kutse read jõustatud.
- **Testid:** Q2.10 #3, #4, #5(osa), #9, #10, #11(respond); serializer-allowlist testid.
- **Audit:** IDOR-sviip; OS† kirjutuskeeld; CAS-leping.

### SUP-P3 — Eeskamber (privaatkirjed)

- **Eesmärk:** M6 CRUD omanik-skoobis; read 14–15; eraldi privaat-serializer'i fail.
- **Puutepind:** `lib/supervision/privateItems.js`, `serializersPrivate.js`; `app/api/supervision/**/private-items/**`.
- **Sõltub:** P2.
- **Invariant:** mitte ükski jagatud vaade ei impordi `serializersPrivate.js`-i (CI-grep); ADMIN/SV → 404.
- **Valmis:** read 14–15; CAS autosalvestusele.
- **Testid:** Q2.10 #5(M6), #6, #7, #10(M6).
- **Audit:** import-graafi kontroll; auditivabaduse kinnitus (M6 toimingud EI kirjuta M13).

### SUP-P4 — Teadlik jagamine (teemad)

- **Eesmärk:** M7 koopia-semantikaga jagamine + audience + tagasivõtt; read 16–17.
- **Puutepind:** `lib/supervision/topics.js`; `app/api/supervision/**/topics/**`.
- **Sõltub:** P2, P3 (sourcePrivateItemId).
- **Invariant:** M7 on külmutatud koopia (hilisem M6 muudatus ei levi); SUPERVISOR_ONLY ei jõua teiste OS-vaatesse; tundmatu kehaväli → 400.
- **Valmis:** read 16–17; OS† jagamiskeeld.
- **Testid:** Q2.10 #8, #16(S-pool), #17(autor-cascade).
- **Audit:** manifest-allowlist; audience-serializer.

### SUP-P5 — Kohtumised

- **Eesmärk:** M8 plaanimine + HELD-fakt; read 18–19.
- **Puutepind:** `lib/supervision/meetings.js`; `app/api/supervision/**/meetings/**`.
- **Sõltub:** P2 (+P4 agendaTopicIds viidetele).
- **Invariant:** HELD on lõplik; seq-unikaalsus.
- **Valmis:** read 18–19; CAS.
- **Testid:** #10(M8), #11(mark-held), olekusiirded.
- **Audit:** faktijälje väljad vs Q2.2 M8.

### SUP-P6 — Kokkuvõtted ja kinnitused

- **Eesmärk:** M9/M10: mustand→submit→kinnitused→APPROVED-lävi samas tehingus; read 20–23.
- **Puutepind:** `lib/supervision/summaries.js`; `app/api/supervision/summaries/**`.
- **Sõltub:** P2, P5.
- **Invariant:** DRAFT ainult SV-le; APPROVED muutumatu; lävi = sulgemishetkel ACCEPTED; OS† ei kinnita.
- **Valmis:** read 20–23; viimane-kinnitus-tehing.
- **Testid:** Q2.10 #12, #10(M9), #11(approve).
- **Audit:** läve arvutus luku all; DISCARDED-rada.

### SUP-P7 — Sulgemine, purge, isiklikud pakid

- **Eesmärk:** Q2.5 järjestus 1–10; read 24–25, 27; M11/M12.
- **Puutepind:** `lib/supervision/closure.js`; `app/api/supervision/**/close*`, `outcomes/**`.
- **Sõltub:** P2–P6.
- **Invariant:** pool-suletud olekut ei eksisteeri; M12 ainult omanikule; purge ei puutu M6.
- **Valmis:** close-preview + close + outcomes; rollback tõendatud.
- **Testid:** Q2.10 #13, #14, #5(M12), #6(M12).
- **Audit:** tehingupiiri kontroll (kõik sammud ühes $transaction'is); purgeReport täpsus.

### SUP-P8 — U1/U2 integratsioon

- **Eesmärk:** Q2.8 sündmused NotificationEvent-idena + „Jätka siit" allikad.
- **Puutepind:** `lib/supervision/notifications.js`; olemasoleva continuity-koosturi allikaloend (`/api/workspace/continuity` taga olev lib).
- **Sõltub:** P2, P6, P7.
- **Invariant:** sündmus = fakt+viide, MITTE sisu (test #15).
- **Valmis:** 6 sündmust + continuity-kirjed täpse URL-olekuga.
- **Testid:** Q2.10 #15; dedupeKey-leping.
- **Audit:** sündmuste väljad vs NotificationEvent muster (schema:1912).

### SUP-P9 — Tööheaolu üleandmine

- **Eesmärk:** rida 26 (Q2.7 v2 leping): kinnitatud mustand → M6 EESKAMBRI privaatkirje (superviisor ei näe enne jagamisväravat).
- **Puutepind:** `lib/supervision/wellbeingHandoff.js`; `app/api/wellbeing/output-drafts/[id]/supervision/route.js`. `lib/wellbeing/covisionHandoff.js` jääb PUUTUMATA (peegel, mitte refaktor).
- **Sõltub:** P3 (eeskamber).
- **Invariant:** expectedUpdatedAt-fingerprint; topelt → 409 (M6 unique); superviisorile ega grupile EI leki enne rida-16 jagamist; toorkirje ei liigu; M13 kirjet ei teki.
- **Valmis:** rida 26 töötab; handedOffAt semantika dokumenteeritud.
- **Testid:** Q2.10 #16, #11(handoff).
- **Audit:** võrdlus covisionHandoff'i lepinguga (allowlist, sameInstant).

### SUP-P10 — Eeskambri UI (V0 vaated)

- **Eesmärk:** Q2.6 kümme vaadet (loend→loomine→kontrakt/kutse→eeskamber→jagamise eelvaade→kohtumised→kokkuvõte→kapp→sulgemise eelvaade→suletud vaade).
- **Puutepind:** `app/supervisioon/**` (uus marsruut); komponendid `components/supervision/**`; CSS olemasoleva süsteemi piires (EI uut lõuendimootorit).
- **Sõltub:** P2–P7 API-d (P8/P9 mitteblokeerivad).
- **Invariant:** privaatne/jagatud märgis alati nähtav; jagamis-eelvaade näitab TÄPSELT manifesti välju; URL-olekud otselingitavad.
- **Valmis:** Q2.6 olekulepingud (laadimine/viga/409/tühi) kaetud.
- **Testid:** UI olekulepingud (Q2.10); i18n:check (et-baas — repo lint keelab hard-coded JSX-teksti).
- **Audit:** privaatsusmärgiste kohalolu; 409-konflikti UX.
- **Tükeldus vajadusel:** P10a (loend+loomine+kontrakt/kutse), P10b (eeskamber+jagamine), P10c (kohtumised+kokkuvõtted+sulgemine).

### SUP-P11 — Täiskontroll enne deploy'd

- **Eesmärk:** Q2.10 I-kategooria: päris-DB täisvoog kahe kontoga, purge DB-kinnitus raw SQL-iga, IDOR-sviip, RAG-isolatsiooni runtime-pool.
- **Puutepind:** ainult kontrolliskriptid/temp-tokenid (ei tootekoodi).
- **Sõltub:** kõik.
- **Valmis:** raport samas dokumendisarjas; 18/18 kohustuslikku rohelised.
- **Audit:** = ise auditipunkt (Opus teeb sõltumatu läbimängu).

**Järjekord ja paralleelsus:** P0 → P1 → P2 → {P3, P5 paralleelselt} → P4 → P6 → P7 → {P8, P9, P10 paralleelselt} → P11. Iga pakett eraldi harul; merge alles pärast paketi auditipunkti läbimist.

**Pakettide lisaväljad (migratsioon / UI / i18n / mida teadlikult EI tee):**

| Pakett | Migratsioon | UI | i18n | Teadlikult EI tee |
|---|---|---|---|---|
| P0 | `20260716090000_supervision_v0` (V0 AINUS) | — | — | ei muuda olemasolevaid tabeleid; null teenuskoodi |
| P1 | — | — (API-only) | veateated et/en/ru | admin-UI-d; grandi avalikku kuvamist (otsus 4) |
| P2 | — | — | veateated | UI-d; teemasid/kohtumisi/kokkuvõtteid |
| P3 | — | — | — | jagamist (ainult privaat-CRUD); M13 auditit |
| P4 | — | — | — | audience-muutmise UI-d (API olemas) |
| P5 | — | — | — | kalendrit/meeldetuletusi (U1 tuleb P8-s) |
| P6 | — | — | — | mitut FINAL-it; AI-kokkuvõttemustandit (V0-väline) |
| P7 | — | — | — | retention-automaatikat (otsus 12) |
| P8 | — | — | teavituste sildid | e-kirjade sisselülitamist (jääb olemasoleva opt-in korra taha) |
| P9 | — | Tööheaolu mustandivaatesse 1 nupp + eelvaade (olemasoleva voo jätk) | eelvaate tekstid | `covisionHandoff.js` muutmist; jagamiskiirteed superviisorile |
| P10 | — | 10+1 vaadet (Q2.6) | TÄISMAHT (suurim i18n-pakett; T21) | Flight/3D; tellijavaadet; uut lõuendimootorit |
| P11 | — | — | — | uut funktsionaalsust (ainult kontroll ja raport) |

## Q2.12 Lõppväljund

SEIS: COMPLETE

**1. V0 arhitektuur (üks lõik):** Supervisioon V0 on iseseisev moodul `lib/supervision/` + `app/api/supervision/` + `app/supervisioon/`, mis EI impordi kovisiooni teenuskoodi (mustrid jah, kood ei — Q2.1). Andmekiht: 13 uut mudelit (M1–M13), 0 muudatust olemasolevatele (v.a User tagasi-relatsioonid). Iga kirjutus käib advisory-xact-luku + version-CAS-i alt; iga lugemine on liikmesus-skoobitud (ühetaoline 404; ADMIN = võõras sisus). Privaatne (M6, M12), jagatud (M3, M7, M8, M9-PENDING) ja püsiv (M9-APPROVED, M11, M12) sisu elavad eri mudelites; sulgemine on üks tehing, mis külmutab kinnitatu, kustutab toorsisu ja jätab igale liikmele isikliku paki. RAG-i, kõnet, salvestust, tellijavaadet ja arveldust EI OLE (otsused 1, 2, 6, 7; invariant-test #18).

**2. Mudelid ja seosed (koond; täisspetsifikatsioon Q2.2):**

| Mudel | Võtmeseosed | Sulgemisel |
|---|---|---|
| M1 SupervisorGrant | →User | ei puutu |
| M2 SupervisionProcess | →User(SV); juur | title üldistatud, goal NULL, status CLOSED |
| M3 ContractVersion | →M2 | jääb (kinnitatud raam) |
| M4 Participation | →M2, →User; unique[process,user] | jääb (fakt) |
| M5 ContractAcceptance | →M4, →M3; unique paar | jääb (fakt) |
| M6 PrivateItem | →M2, →User(omanik), →WellbeingOutputDraft? unique (v2) | **jääb omanikule** |
| M7 SharedTopic | →M2, →M4(autor) | **kustub täielikult** |
| M8 Meeting | →M2; unique[process,seq] | faktid jäävad; note/viited nullitakse |
| M9 Summary | →M2, →M8? unique | APPROVED jääb; muud kustuvad |
| M10 SummaryApproval | →M9, →M4; unique paar | jääb APPROVED-i küljes |
| M11 Closure | →M2 unique | tekib sulgemisel |
| M12 PersonalOutcome | →User(omanik), →M2 SetNull; unique[process,owner] | tekib sulgemisel; elab protsessi üle |
| M13 AuditEvent | →M2 Cascade, →User SetNull | protsessiga; grant-kirjed protsessita |

**3. Marsruudid:** 27 rida — täistabel Q2.4. **4. Õiguste maatriks:** 8 tegijat × 23 toimingut — Q2.3. **5. Sulgemise järjestus:** 10 sammu ühes tehingus — Q2.5. **6. UI vaadete kaart:** 10+1 vaadet, `?ala=` ankrud — Q2.6. **7. Testimaatriks:** 18 kohustuslikku + 6 kategooriat — Q2.10.

**8. Teostuspakettide järjekord:** P0 → P1 → P2 → {P3, P5} → P4 → P6 → P7 → {P8, P9, P10} → P11 (detailid Q2.11); iga pakett eraldi harul, merge pärast auditipunkti.

**9. Teadaolevad riskid:**

1. `schema.prisma` User-ploki tekstikonflikt ootel harudega (U6/U7/role-aware-invite) — madal; rebase-reegel Q2.9.
2. Migratsiooni-timestamp'i konflikt teise haruga — kontrolli saba enne merge'i.
3. OS† olek (uus kontraktiversioon ootab kinnitust) võib osalejat segadusse ajada — UI peab blokeeringu põhjuse selgelt ütlema (vaade 3b/5).
4. Serializer-välja leke tulevikus (mudel saab uue välja, audience-test unustatakse) — maandus: testid võrdlevad TÄPSET võtmehulka, mitte „sisaldab" (Q2.10 S-kategooria).
5. Purge'i ja konto-kustutuse samaaegsus — advisory-lukk + FK-käitumised + test #17; jälgida P11-s.
6. `supervision_prep_waiting` continuity-kirje võib mõjuda survena (restoratiivne kontekst) — teadlikult mitte-teavitus; piloodis üle vaadata.
7. M12 contentJson maht suurte protsesside puhul — piiratud (kokkuvõtteid ≤ kohtumisi+1); aktsepteeritud.
8. i18n kolmes keeles 10 vaatele — mahurisk P10-s; `i18n:check` nõuab et-baasi pariteeti.

**10. Lahtine retention-otsus (otsus 12):** M11.retentionStatus="AWAITING_POLICY" on staatus ILMA automaatikata (CovisionClosure.retentionStatus pretsedent); ükski V0 kood ei kustuta kinnitatud väljundeid ega isiklikke pakke tähtaja alusel; säilitustähtaeg, selle õiguslik alus ja kustutusmehhanism = eraldi otsus + eraldi töö PÄRAST V0.

**11. Esimese arenduspaketi (SUP-P0) täpne jätkamispunkt:**

1. loo haru (nt `codex/supervision-v0-p0-schema`) värskest `main`-ist; jooksuta lokaalis `npx prisma migrate deploy` (lokaal peab olema 92+/92 tasemel — orientatsioonikaardi õppetund);
2. lisa `prisma/schema.prisma` lõppu M1–M13 plokk Q2.2 spetsifikatsiooni järgi + enum'id (SupervisionProcessType, SupervisionProcessStatus, SupervisionContractStatus, SupervisionParticipationStatus, SupervisionPrivateItemKind, SupervisionTopicAudience, SupervisionTopicSourceKind, SupervisionTopicStatus, SupervisionMeetingStatus, SupervisionSummaryKind, SupervisionSummaryStatus) + User-mudelisse nimelised tagasi-relatsioonid;
3. `npx prisma migrate dev --name supervision_v0` (sihtnimi `20260716090000_supervision_v0`; kui kell on edasi läinud, kasuta tekkivat hilisemat timestampi — unikaalsus on nõue, täpne kellaaeg mitte);
4. `npm run db:migrate:check` + `npm test` (peab jääma roheliseks — skeemilisandus ei tohi midagi lõhkuda);
5. kontrolli `git diff --stat`: TÄPSELT 2 puudet (schema.prisma + uus migratsioonikaust);
6. auditipunkt (Opus): väli-väljalt võrdlus Q2.2 vastu + Cascade/SetNull/unique käitumiste kontroll test #17 stsenaariumiga.
7. Enne SUP-P1 algust: fikseeri `lib/effectivePractices.js` grant-funktsioonide täpsed nimed (Q2.1 tabeli „→ P1" märge).

**12. Lõplik hinnang (v2):**

1. **Kas V0 plaan on rakendusvalmis?** JAH, tingimustega: andmemudel (Q2.2), õigused (Q2.3), API (Q2.4), sulgemine (Q2.5), UI-piirid (Q2.6), liidesed (Q2.7 v2, Q2.8), migratsioonikord (Q2.9), testid (Q2.10) ja paketid (Q2.11) on teostaja jaoks piisava täpsusega kirjas. Kaks teadlikult teostuse-aegset lahtist kohta (mitte blokeerijad): grant-funktsioonide täpsed nimed `lib/effectivePractices.js`-is (P1 esimene samm) ja U2 continuity-koosturi täpne liides (P8 esimene samm).
2. **Blokeerivad toote-/õigusotsused:** (a) **retention** (otsus 12) — ei blokeeri ehitust, ainult hilisemat kustutuspoliitikat; (b) **grandi tõendusstandard** (mis dokument kõlbab grantBasis'eks — Q1 osa 12 k1) — vaja HILJEMALT enne esimest päris granti, mitte enne P0–P2; (c) **piloodi ulatus** (Q1 osa 12 k3) — määrab V0 vs V1 järjekorra pärast P11. Ükski ei peata P0 alustamist.
3. **Esimene pakett:** SUP-P0 (skeem + migratsioon) — samm-sammult juhis p 11 ülal.
4. **Täpne käsk järgmisele teostajale (kopeeritav):**

```text
Loe docs/platvormi arendus/fable-5-supervisiooni-tootemudel-ja-ruumiline-teekond.md
peatükk Q2 (kohustuslikult Q2.2, Q2.9, Q2.11 SUP-P0, Q2.12 p11).
Teosta AINULT pakett SUP-P0:
1) loo värskest main'ist haru codex/supervision-v0-p0-schema;
2) jooksuta lokaalis: npx prisma migrate deploy (lokaal peab olema main'iga tasa);
3) lisa prisma/schema.prisma lõppu M1–M13 + enumid + User tagasi-relatsioonid
   TÄPSELT Q2.2 järgi (Tööheaolu-viide on M6-s, MITTE M7-s ega WellbeingOutputDraftis);
4) npx prisma migrate dev --name supervision_v0;
5) npm run db:migrate:check && npm test (mõlemad rohelised);
6) git diff --stat = AINULT schema.prisma + uus migratsioonikaust;
7) commit'i harule; ÄRA merge'i main'i, ära push'i ilma ülevaatuseta, ära deploy'i;
8) raporteeri: diff-stat, migrate-check väljund, kõrvalekalded Q2.2-st (kui oli).
```
