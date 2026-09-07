# M4-C päriskatse sisuline analüüs

07.09.2026. Hinnatud on nelja fikseeritud dialoogi 15 pärisvastust, nende tegelikku dialoogisisendit ja kõiki valitud allikakatkendeid. Analüüs ei teinud uusi mudelikutseid ega muutnud rakenduskoodi. Aktiivset tööseisu kannab `SotsiaalAI.md` S1.0; see fail on konkreetse jooksu hinnang.

**Järeldus: piiratud jätkuvestluse kontekstimehhanism toimis selles katses. Sisulist lõppvastuvõttu ei saa anda.** Tartu parandus säilis, uue inimese andmed eraldusid ning tagasipöördumine valis õige varasema vastuse. Samal ajal muutus ühes vastuses kavandatud tegevus juba alanud tegevuseks, ühes lõigus ei toeta lisatud viide kõiki väiteid ning väljundis säilisid viite- ja tõendipiiri puudused. Tootmiskeskkonna kasutajaliidese plaanitud taastamisrada jäi tegemata.

## Tõend ja hinnangu piir

- Põhitõend: [serveri täielik kaitstud väljavõte](../../tmp/rag-v2-m4-c/server-real-run-raw.json), eksporditud `2026-09-07T10:12:35.603Z`. SHA-256: `daf45753cb09a9b38e990ee111e464c35dc01447a591c7d063e3a77aea438933`.
- [Loetavam jooksukoond](../../tmp/rag-v2-m4-c/server-real-run-summary.json), [23 eraldi allikakatkendit koos pöördepõhiste tähistega](../../tmp/rag-v2-m4-c/analysis-unique-evidence.json) ja [analüüsi arvulised kontrollid](../../tmp/rag-v2-m4-c/analysis-verification.json). Need on kohaliku `tmp` kausta tõendid, mitte gitiga levitatavad avalikud artefaktid.
- Katse alus: [omanikule esitatud koondplaan](rag-v2-m4-c-real-plan-2026-09-07.md), mille koostamisaegne `NOT_APPROVED / NOT_RUN` märge on ajalooline. Omanik andis hiljem loa commit'iks, push'iks, deploy'ks ja täpselt sellele 15-pöördelisele jooksule. [Tegelikud plaaniseosed](../../tmp/rag-v2-m4-c/runtime-rebind.json) säilitavad jooksu konfiguratsiooniräsid.
- Läbi loeti kõik 15 vastust ja kõik 23 erinevat valitud `source_text` katkendit. Hinnang käsitleb väite toetust neis katkendeis, mitte kogu korpuse täielikkust, kehtivat õigust ega päris teenuse hinda.
- Hindaja on Codex. See ei ole sõltumatu inimese pimehindamine ega statistiline kvaliteedimõõtmine. Vastuse `kind`, `factual=true` ja serveri valideerimise edu ei ole sisulise õigsuse tõendid.

## Mis on tegelikult tõendatud

| Omadus | Tulemus | Tõendi ulatus |
|---|---|---|
| Täpsed küsimused, keeled ja režiimid | PASS, 15/15 | Salvestatud sisendid ühtivad lukustatud A–D plaanidega. |
| Väliskutsete piir | PASS | 15 embedding'u- ja 15 vastamiskatset, 30 erinevat request ID-d; igal etapil üks `response_received`. |
| Avaldamine | PASS, 15/15 | Kõik pöörded `completed`, vestluspöörded `COMPLETED`. See ei tähenda 15 sisuliselt korrektset vastust. |
| Mudel ja muutumatu baas | PASS vaadeldud jäljes | `gpt-5.6-luna`, reasoning `low`, `m4-text-refs-3`, sama `vector-ranked-first-v1` ja indeksipõlvkond. Fikseeritud paketi või query-reuse katset ei kasutatud. |
| Tegelik vastajasisend | PASS, 15/15 | Saadetud JSON-i dialoog ja tõend kattuvad salvestatud dialoogi ning `packet.model_context` väärtustega. |
| Viite identiteet | PASS | Kõik 75 paketti lisatud viidet seostuvad sama `source_text` SHA-256-ga; vastuste viitenimed leiduvad oma pöörde kaardis. See ei kontrolli väite semantilist tuge. |
| Valitud allikaversioonid | PASS | Kõik kasutatud katkendid kuuluvad konfiguratsioonis lubatud dokumendiversioonidesse. Kasutati 23 eri katkendit viiest dokumendist kaheksast lubatust. |
| A konteksti säilimine | PASS | A4 sisendis on A1–A4 kasutajasõnumid; varasemaks assistendivastuseks valitakse A3. |
| B parandus | PASS | B2–B4 säilitavad parandusversiooni 1, B1 muutumata asjaolud ja parandusseose. Vastused kasutavad Tartut. Vana Harku ei ole range filter; kõigi pöörete `strictFilters={}`. |
| C isikupiir | PASS | C2 loob uue isiku ja ulatuse, varasem assistent puudub. C3 kasutajasõnumite aknas on ainult C2–C3. Esimese inimese vanus, Harku ja abikaasa ei kandu vastusesse. |
| D teemavahetus ja tagasipöördumine | PASS serveri/HTTP rajal | D2 uus ulatus ei sisalda D1 sõnumit. D3 valib D1 ulatuse, avaldatud vastuse ja punkti 2; D4 jätkab seda ulatust. |
| Tootmise refresh ja allikavaatelt naasmine | NOT_RUN | Katse tehti autentitud brauseris HTTP-päringutega. Plaanitud nähtavad valikud, D2 refresh ning D3 allika avamine/tagasitee puuduvad. Kohalik UI-tõend on eraldi. |

Otsing leidis kõigis neljas dialoogis vastamiseks asjakohaseid katkendeid. See ei tõenda kogu lubatud korpuse leidmisvõimet ega optimaalseid järjestusi. Näiteks A1 viies katkend sisaldab peamiselt lehe navigeerimisosa ning B/C pakettides on ka teise väljamõeldud inimese juhtum ja tühje töölehti. Nende võõra inimese asjaolusid vastustesse ei kantud. Otsingu häälestamise vajadust ei saa sellest väikesest valimist kvantifitseerida.

## Vastuste hinnang pöörde kaupa

Allpool on sisuline hinnang, mitte mudeli enda `kind`. „Puudus” võib puudutada ainult üht lõiku; ülejäänud kasulik sisu säilib.

| Pööre | Hinnang |
|---|---|
| A1 | Programm, lahenduste liigid ja individuaalse kättesaadavuse piir on arusaadavalt eristatud. Rahastamisväite viide on puudulik ning kõigi nelja ploki lõpus on dubleeriv paljas viitetähis. |
| A2 | Lahenduste nõuded ja näited on viidatud katkenditega toetatud. Kodus toimetuleku eesmärk säilib eesmärgina. |
| A3 | Kohandamise objekt on õige; konkreetsete muudatuste puuduv täpsus on ausalt piirangus. |
| A4 | Eesmärki ja mõõdetud mõju eristatakse, kuid projektide kavandatud tegevusest tehakse juba alanud tegevus. Puuduva „teise punkti” kohta küsitakse õigesti täpsustust: A3-l on üks allikaplokk. |
| B1 | Faktilehe pöördumis- ja hindamiskäik on õigesti esitatud, hinda ega teenuse määramist ei lubata. Vanuse ja elukoha kohta tehtud oma tõendipiir on lisatud allikaväite plokki. |
| B2 | Tartu parandus rakendub ja vanus 67 säilib. Sama tõendipiiri/ploki eristuse puudus nagu B1-s. |
| B3 | Hinna teadmatus on õigesti sõnastatud. Täpsustusküsimus küsib omavalitsust või teenuseosutajat uuesti, täpsustamata, mida juba antud Tartu juures veel vaja on. See pole tõend mälu kadumisest. |
| B4 | Tartu on meeles ja täpne hind jääb õigesti teadmata. Oma järeldus, et Tartu ei lisa puuduvat hinda, paikneb samas plokis faktilehe refereeringuga. |
| C1 | Faktilehe teave, puuduv hind, ühendusevõtmise aeg ja teenuse määramise garantii on õigesti eristatud. |
| C2 | Uut inimest ei täideta vana inimese andmetega. Küsimus selle kohta, mida uue inimese jaoks vaja on, on põhjendatud. Kohaliku hinna otsinguks omavalitsuse küsimine sobib katse eesmärgiga. |
| C3 | Täpset hinda ega garanteeritud tähtaega ei leiutata; omavalitsuse puudumine säilib. Korpuse teise juhtumi 30-päevast vaidlustamistähtaega ei esitata teenuse tähtajana. |
| D1 | Eetikanõukoja soovitused, töötaja toetamine ja proportsionaalsus on allikaga toetatud ning autorlus säilib. |
| D2 | Eri riikide näidetest ei tehta Eesti omavalitsuste kohustust. Siiski on väide selle kohta, mida kogu artiklis pole sõnastatud, kasutatud katkendist laiem; õiguslik piirang on vastuse lõpus olemas. |
| D3 | Selgitus puudutab D1 teist punkti ning saab toe uutest S1/S2 katkenditest. D2 tehisintellekti teema ei tungi vastusesse. |
| D4 | Organisatsioonilisi samme toetavad õiged uue pöörde S1/S2 katkendid. Paljad viitenimed on ka tekstis, kuigi viiteid peaks esitama rakendus. |

## Konkreetsed paranduskohad

### F1 — A4 muudab kavandatud tegevuse juba alanud tegevuseks

**Seis: PARTIAL (07.09 järelparandus).** V4 vastamisjuhis ja skeemikirjeldus eristavad valimist, kavatsust, algust, lõpetamist ja mõõdetud mõju. Päris Luna uue vastuse semantika `NOT_PROVEN`; allpool tsiteeritud algvastus jääb muutmata.

**Prioriteet P2.** A4 plokk 2, viide S4, „Käivitus „Heaolutehnoloogiate programm“”, PDF lk 1–5, `evidence_ad8ff083e7a6237ad8687f5ebac8abd107e5ad2e90fb581e11d0c8de9c3130fd`.

- Allikas: „Esimeses voorus valiti välja 20 nutikat projekti, mis asuvad nüüd leevendama nii lähedaste koormust kui ka spetsialistide puudust.”
- Vastus: „need asusid probleeme leevendama; see näitab tegevuse alustamist”.

Projektide valimine on toetatud. Tulevikku suunatud tegevuse kirjeldus ei tõenda eraldi tegevuse algust. Vastuse üldine eristus „eesmärk ei tõenda mõõdetud mõju” on õige, kuid ei paranda seda konkreetset ajavormi ja sündmuse järeldust. See on sama tüüpi puudus nagu varasema baashinnangu eesmärgi/toimumise leid.

Vastuvõtukriteerium oleks säilitada eraldi projektide valimine, kavandatud tegevus ja tõendamata mõju. Sobiv sisu oleks: „20 projekti valiti välja; katkend kirjeldab nende kavandatud panust, kuid ei tõenda tegevuste tegelikku algust ega mõõdetud mõju.” See on analüüsi parandusettepanek, mitte muudetud pärisvastus.

### F2 — A1 lõigu viide ei toeta rahastamisväidet

**Seis: PARTIAL (07.09 järelparandus).** V4 nõuab iga ploki iga osaväite kontrolli ainult selles plokis viidatud katkendite suhtes ning eraldi rahastustuge. Kohalik kujuvalidaator ei tõenda viite semantilist sobivust; uus päriskatse `NOT_RUN`.

**Prioriteet P2.** A1 plokk 4 ütleb „Tegemist on arendus- ja rahastusprogrammiga” ning viitab ainult S4-le: „Heaolu tehnoloogiate programm”, PDF lk 1, `evidence_cc32c9afcb936657dd82931657075b66bb773253486ca30ab9d941cddffcc00e`.

S4 kirjeldab programmi eesmärki, algatajat ja kolme elluviijat. Rahastuse tõend on sama paketi teistes katkendites S2/S3, mida see plokk ei viita. Seega ei ole rahastuse olemasolu välja mõeldud; viga on väite ja konkreetse viite seoses. Korpuses või sama paketi mujal olev tõend ei asenda selle ploki õiget viidet.

Vastuvõtukriteerium: rahastamisväitele lisandub seda toetav viide või see eristatakse omaette toetatud plokiks. Kõigi allikate mehaaniline lisamine igale plokile ei lahenda seose täpsust.

### F3 — paljad S-tähised läbivad viitemärgistuse kontrolli

**Seis: PARTIAL (07.09 järelparandus).** V4 blokeerib eraldiseisvad S-numbriga tähised kõigis nähtavates väljades; vigast teksti ei kustutata ega parandata automaatselt. Kohalikud lepingutestid ja PostgreSQL-i teenuserada läbisid; 15 ajaloolist v3 vastust taastusid muutmata. Päris vastuse kasulikkus ja tootmise esitlus `NOT_PROVEN`. Konservatiivne kontroll võib tagasi lükata ka samakujulise sisulise koodi; see piirang on järelkatse vastuvõtus eraldi nähtav.

**Prioriteet P3.** A1 kõigi nelja ploki tekst lõpeb palja `S3`, `S1`, `S2` või `S4` tähisega. Rakendus lisab seejärel `refs` põhjal oma viited, näiteks esimese ploki lõppu `S3 [S3, S4]`. D4 kasutab samuti `S1`/`S2` tähiseid proosas.

[Väljundileping](../../lib/rag-v2/pilot/contracts.js) nõuab viitetunnuseid ainult `refs` väljas. [Esitluskihi](../../lib/rag-v2/pilot/presentation.js) `hasInlineReferences()` tunneb ära sulgudes viite ja spetsiaalse cite-märgistuse, kuid mitte paljast tähist. `renderAnswer()` lisab v3 korral viited lõppu ja jätab palja tähise alles. Tegemist on salvestatud teksti ja renderdamiskoodi kaudu tõendatud puudusega; selle jooksu tootmise ekraanipilti ei ole.

Vastuvõtukriteerium: viidete esitlus on üheselt rakenduse kontrolli all ning ajalooliste v3 vastuste lugemine säilib. Universaalset `S` + numbri kustutamist tekstist ei saa järeldada sobivaks paranduseks: see võiks rikkuda sisulisi tähiseid.

### F4 — oma tõendipiir seguneb allikaväitega; D2 ulatus laieneb

**Seis: PARTIAL (07.09 järelparandus).** V4 juhis ja väljade kirjeldused eristavad allika sõnaselget piirangut ning vastaja enda tõendipiiri konkreetsete näidetega; katkendist ei laiendata puudumise väidet kogu artiklile. Uute vastuste sisuline vastuvõtt `NOT_PROVEN`.

**Prioriteet P2, tõendipiiri täpsus.** B1/B2 teise ploki allikaks on H3 faktileht, PDF lk 2–3, `evidence_id` lõpuga `14beba5549` (täpne ID on toorandmes).

Faktileht ütleb sõnaselgelt, et ta ei anna ühendusevõtmise kiirust, teenuse kindlat määramist ega hinda. Nende piiride refereerimine viitega plokis on õige. Seevastu „the fact sheet does not establish that being 67 or living in Tartu automatically qualifies you” on vastaja järeldus valitud tõendi puudulikkusest, mitte faktilehe enda vanuse või Tartu kohta käiv väide. See kuulub oma piiranguna `limitations` väljale. B4 samasugune Tartu kohta tehtud järeldus on sisuliselt ettevaatlik, kuid seguneb taas refereeringuga.

D2 ploki 1 S4, tehisintellekti artikli PDF lk 2–3, `evidence_id` lõpuga `8f148da67f`, kirjeldab autori eesmärki tuua näiteid ja analüüsida juhtumiuuringuid. See toetab näidete žanri ja eesmärki, kuid ei tõenda kogu artikli kohta lauset „Näited ei ole artiklis sõnastatud kõigile Eesti valdadele kohustuslike lahenduste või rakendusjuhistena.” Vastuse lõpu õiguslik piirang on hea, ent kitsam ja tugevamini tõendatud põhilausung oleks „neist väljavõtetest ei saa järeldada Eesti valdade kohustust”. See ei ole leid, et mõni tegelik õiguslik kohustus eksisteerib või puudub.

Vastuvõtukriteerium: allika sõnaselge piir ja vastaja enda puuduv teadmine jäävad eristatavaks ning katkendipõhist hinnangut ei laiendata kogu dokumendile.

### O1 — B3 täpsustusküsimus vajab täpsemat põhjendust

**Seis: PARTIAL (07.09 järelparandus).** Juhis nõuab teadaolevate ja parandatud asjaolude kasutamist enne täpsustusküsimust ning küsib üksnes puuduvat eristust. Päris Luna küsimuse kvaliteet `NOT_PROVEN`; kontekstivalikut ei muudetud.

**Kasutatavuse tähelepanek, mitte kinnitatud kontekstirike.** B3 küsib „What municipality or service provider should be checked for the current price in Tartu?” Tartu on nii sisendis kui vastuse piirangus alles. „Tartu” võib vajada linna/valla täpsustust ning teenuseosutaja pole antud; seetõttu ei saa küsimust täielikult põhjendamatuks lugeda. Küsimus peaks nimetama just puuduvat eristust, selle asemel et jätta mulje, et elukohta ei mäletata. Täiendav elukohatäpsustus ei tekitaks üksi praegusesse katkendipaketti puuduvat hinnatõendit.

## Katse läbiviimine ja plaanist kõrvalekalded

Kood jõudis omaniku loal commit'iga `3f8a1870c183826b520dd1ccf1b4b63a979efa00` `origin/main`-i ja serverisse. Deploy läbis oma build'i ja kontrollid; analüüs neid sama koodi peal ei korranud. Kohalik main, kaug-main ja server mõõdeti analüüsi käigus kell 10:19 UTC samale commit'ile; serveri tööpuu oli puhas ja frontend aktiivne.

1. **Nähtava UI raja asemel kasutati autentitud brauseri HTTP-kutseid.** Küsimused ja režiimid vastasid plaanile ning D3 täpsed viite-ID-d võeti jooksu D1 vastusest. Kuid valikute tegemine toote juhtelementidega, D2 refresh ja D3 allika avamine/tagasipöördumine jäid tegemata. Seetõttu on täielik tootmise UI-vastuvõtt `NOT_PROVEN`. [Kohalikus raportis](rag-v2-m4-c-local-2026-09-07.md) kirjeldatud UI-katsed jäävad kohaliku testtranspordi tõendiks.
2. **Manifest tuli enne väliskutseid serveri baitidega siduda.** Esialgsed neli A HTTP-päringut said `implementation_approval_mismatch` ja ei loonud mudelikatseid. Kohalik räsi `7958451a…` erineb serveri räsist `7f0817c2…`; analüüs võrdles manifesti faile ning kõik 26 erinevust taanduvad CRLF/LF reavahetustele. Teisi sisuerinevusi ei leitud. Tegelike plaanide võrdluses muutusid `approval`, `sourceHead` ja `implementationHash`; muud väljad, sh konto/projekt, küsimused, mudel, korpus ja piirid, säilisid.
3. **Ettevalmistuses parandati konfiguratsioonifaili lugemisõigust.** Algne serverifail ei olnud frontend'i kasutajale loetav; viga lahendati enne jooksu. Samuti lisati ettevalmistuses ajutine `LOGIN_OTP_BYPASS_EMAILS` seadistus. Katse kasutas omaniku kontoga autentitud in-app brauserisessiooni. Pärast jooksu taastati algne env baittäpselt; ajutist möödapääsu ei jäetud sisse.
4. **Brauserit juhtinud käsu ajalõpp ei tähendanud mudelipäringu kordamist.** A/C/D juhtkäskude ajalõpu järel jätkus juba käivitatud töö. Püsijälg sisaldab kokku täpselt 15 lõpetatud pööret ja 30 provider-etappi. Ajalõppe ei tohi esitada edukate nähtavate UI-sammude tõendina.
5. **Eelkontrollide tõend on osaline.** Käituskonfiguratsioonid seovad sama konto/projekti, indeksi ja kaheksa versiooni; reaalselt kasutatud viie dokumendi kõik katkendid vastavad lubatud versioonidele. Eraldi salvestatud täielikku kaheksa allika seisukontrolli ja värske kontotariifi kontrolli enne esimest kutset tõendikogumis ei ole. Neid ei märgita tagantjärele tehtuks.

Pärast katset taastati vana baas-konfiguratsioon ja ajutine `/etc/sotsiaalai/m4-c-active.json` eemaldati. Env SHA-256 on taas `a50c105cb5eab9a6fe78fd787574f551efcf059649276c4cf1c0aea2145a0dcf`, baas-konfiguratsiooni SHA-256 `f64f88a77247da0a1f05ed11e1fd795e34779ffebd6235bee7efa5be7b3b2292`. Taastatud baasrežiimis on dialoog väljas; uus manifest ei anna vanale kulutatud plaanile uut täitmisluba. Avalikku vastamist ei avatud.

## Kasutus ja varasema kuluväite parandus

**Varasem 0,1174 USD arv on ledger'i konservatiivne reserv, mitte tegeliku arve ega kasutuspõhise hinnangu summa.** Ka faili `server-run-measurements.json` väli `dollars` pärineb reservist. Originaaltõendit ümber ei kirjutatud; täpsustatud arvutus on `analysis-verification.json` failis.

| Mõõdik | Tegelik salvestatud väärtus |
|---|---:|
| Embedding'u sisendtokenid | 1 279 |
| Vastaja sisendtokenid | 74 261 |
| Vastaja väljundtokenid | 4 778 |
| Provider usage kokku | 80 318 tokenit |
| Ledger'i reserveeritud tokenid | 353 473 |
| Kasutuspõhine hinnang kinnitatud konservatiivsete määradega | 0,02446512 USD |
| Ledger'i rahaline reserv | 0,11739877 USD |
| Kinnitatud rahaline ülempiir | 0,30 USD |

Kasutushinnang on `(1279 × 130 + 74261 × 250 + 4778 × 1200) / 10^9`. See kasutab katse konfiguratsiooni määrasid ja ei ole konto arve. `cachedInput=16 891` ning `cacheWriteInput=57 325` on sisendi alamnäitajad; `reasoning=924` on väljundi alamnäitaja. Neid ei liideta tokenikogusele uuesti. Värsket tariifi analüüs ei oletanud.

Kõik 15+15 lubatud mudelikatset kasutati ära. Rahaline jääk ei anna õigust lisaküsimusteks ega kordusteks. Salvestatud pöörde kestus oli mediaanina 5,405 sekundit, vahemik 3,578–13,656 sekundit; see väike järjestikune jooks ei ole koormus- ega UI-kiiruse test.

## Mis jääb avatuks ja milline järgmine plokk on põhjendatud

Konteksti valiku jaoks ei näita see jooks vajadust uue mäluagendi või otsinguarhitektuuri järele. Põhjendatud järgmine sisuline plokk on olemasoleva v3 allikaväite täpsus: F1 ajalisus, F2 väite ja viite vastavus ning F4 tõendipiir. F3 esitlus-/valideerimislünk on eraldi väike koodiparandus. O1 on täpsustusküsimuse kvaliteet. Need on ettepanekud; analüüs ei muutnud prompti, profiili, korpust ega vastuseid.

Terviklikuks vastuvõtuks jäävad eraldi nähtavaks:

- tootmise nähtav kontekstivalik, refresh ning allika avamine ja vestlusse naasmine;
- sünteetilise varasema assistendigarantii semantiline tagasilükkamine Luna poolt: kohalik sisendilepingu test ei tõenda seda ning siin ei olnud sellist lisakatset;
- vastuse ebaõnnestumise järel uue inimese/paranduse säilimine, õiguse tühistamine ja konteksti ülempiir: kohalikud tõendid on olemas, selles 15-pöördelises päriskatses neid olukordi ei esinenud;
- varasemate seitsme baasvastuse sisulised leiud. Käesolev jooks ei ole nende sama sisendi kontrollitud kordus ega sulge neid automaatselt. Eesmärgi/toimumise ja tõendipiiri probleemid ilmuvad siin uuesti; hind ja teenuse garantii jäid siin õigesti teadmata.

Analüüsi muudatused piirduvad selle raporti, kohaliku tuletatud kontroll-JSON-i ja S1.0 aegunud seisulõigu parandamisega. Rakenduskoodi, ajaloolisi vastuseid ja omaniku muid pooleliolevaid faile ei muudetud. Uusi teste, build'i, väliskutseid, commit'i, push'i ega deploy'd analüüs ei käivitanud.

## Kohalik järelparandus pärast omaniku alustamisluba

07.09.2026, pärast eespool kirjeldatud analüüsi. Omanik andis selles vestluses loa kohalike paranduste alustamiseks. **Kohalik teostus ja kontrollid valmis; pärisvastuste paranemine ning tootmise UI endiselt NOT_PROVEN.** Analüüsi algne jooks, toorandmed, kulud ja hinnangud säilivad. Siinne lõik dokumenteerib sellele järgnenud kooditöö, mitte uut päriskatset.

Lähtepunkt: kohalik põhikaust `main`, HEAD `3f8a1870c183826b520dd1ccf1b4b63a979efa00`; kaug-main kontrolliti `git ls-remote origin refs/heads/main` abil samaks. Serverit selles plokis ei mõõdetud ega muudetud. Omaniku varasemad muudatused ja jälgimata failid säilisid; S1.0 olemasolevat analüüsikokkuvõtet uuendati täpselt ühe lõiguna. Commit'i, push'i ega deploy'd ei tehtud.

| Vastuvõtupind | Muudetud failid | Kohalik tõend / allesjääv piir |
|---|---|---|
| F1/F2/F4/O1 | `lib/rag-v2/pilot/contracts.js` | Prompt `m4-grounded-answer-4` ja skeemi kirjeldused täpsustatud; kuju on sama. Mõju päris vastustele vajab allikapõhist järelhindamist. |
| F3 ja ajalooline loetavus | `presentation.js`, `contracts.js` | Uus väljund `m4-text-refs-4`; v1/v2/v3 oma käitumine säilib. V3 factual/kind/piirangute kontroll ei nõrgene v4 lisamisel. Teksti ega ajaloolisi dubleerivaid tähiseid ei kirjutata ümber. |
| Versiooni ja loa sidumine | `dialogue.js`, `config.js` | Dialoogijuhis `m4-grounded-dialogue-2`; vana dialoogijuhis on lubatud lugemiseks. Vana promptiga plaan ei sobi uue kutse käivitamiseks. Konteksti, otsingu ja isikupiiri algoritmid ei muutu. |
| Regressioonid | `tests/rag-v2-pilot-answer-v4.test.mjs` (uus), `rag-v2-dialogue-config.test.mjs`, `rag-v2-pilot-replay.test.mjs`, `rag-v2-pilot-store.test.mjs` | Paljad/koondatud tundmatud ja tuntud viited, kõik nähtavad väljad, muutmata mustand, v3 piirid ja taastamine, uue prompti loapiir, avaldamine ja tagasilükkamise taastamine ilma korduskutseta. |

Uus tähisekontroll reserveerib eraldiseisvad `S1`, `S2` jne `refs` väljale. See on süntaktiline piir, mitte tsitaadi tähenduse tuvastaja. Ka lause „The device is called S1.” peatub muutmata mustandiga; `AS1`, `S1A`, `ES12`, `S1_2026` säilivad. Seda kompromissi ei esitata universaalse sisuliste tähiste lahendusena. Järelkatse peab näitama kasulikke avaldatud vastuseid, mitte üksnes väiksemat vigaste avaldamiste arvu.

Kontrollid lõpliku koodipuu kohta:

- **PASS 14 sihttesti, FAIL 0, SKIP 0.** 11 lepingu/config/replay testi ning 3 isoleeritud PostgreSQL-i testi. 15 algvastuse replay on üks test ja ei teinud uut otsingut ega mudelikutset; algfaili SHA-256 kontrolliti muutumatuks. Kohalik canonical-adapter kontrollis artefakti viidete tekstiräsi, mitte serveri praegust ligipääsu.
- **PASS ESLint** kõigil kaheksal muudetud JS/MJS failil; pärast viimast testifaili muudatust kontrolliti uuesti ainult seda faili.
- **PASS `TZ=UTC; npm run build`**, üks jooks lõpliku koodipuu kohta; sisaldas edukat `i18n:check` kontrolli. Next 16.2.10 kompileerus 23,7 sekundiga. Build teatas olemasolevast puuduva meilitranspordi seadistusest; veata exit 0. Staatilised kontrollid ei tõenda päris kasutajaliidest ega Luna semantikat.
- **PASS `git diff --check`**. Prisma skeem/migratsioonid ei muutunud, nende valideerimine pole asjakohane. See pole SOL-leidude plokk; SOL-koondit ei genereeritud ümber.
- **Välismudelikutsed 0.** PostgreSQL-i testid kasutasid ainult `sotsiaal_ai_m4_dev` andmebaasi ja sünteetilist transporti, mille võrgukutsed on blokeeritud.

Käivitatud sihttestid:

```powershell
$env:TZ = 'UTC'
$env:M4_REPLAY_ARTIFACT = 'tmp/rag-v2-m4-c/server-real-run-raw.json'
node --import ./scripts/register-node-source-loader.mjs --test tests/rag-v2-pilot-answer-v4.test.mjs tests/rag-v2-pilot-answer-v3.test.mjs tests/rag-v2-dialogue-config.test.mjs tests/rag-v2-pilot-replay.test.mjs
# M4_TEST_DATABASE_URL anti olemasoleva kohaliku runtime'i isoleeritud DB seadistusest.
node --import ./scripts/register-node-source-loader.mjs --test --test-name-pattern='v4 real DB|current answer real DB|evidence candidate: one call' tests/rag-v2-pilot-store.test.mjs
```

Tsitaadikandidaati ei aktiveeritud. Üks olemasolev sünteetiline kandidaat-projektsiooni test kontrollis ainult jagatud vastuseversiooni muutuse ühilduvust; kandidaadi sisuline vastuvõtt ei muutunud.

Järgmiseks on valmis [A/B/D nähtava brauseriraja järelkatse plaan](rag-v2-m4-c-fix-real-plan-2026-09-07.md): 12 + 12 katset, 0,24 USD ülempiir, kolm uut allkirjastamata konfiguratsiooni. Need tagastasid olemasoleva lugejaga `pilot_approval_required`. Uue jooksu tariifi, serverit, kõigi kaheksa allika seisundit ja baasi taastamist tuleb mõõta aktiveerimisel; ettevalmistus ei märgi neid tehtuks. Täielik M4-C vastuvõtt ja varem loetletud muud lahtised tõendid jäävad avatuks.

## Pöörete tunnused toorandme kontrollimiseks

| Pööre | Kaitstud pöörde ID |
|---|---|
| A1 | `2b9ea86f-4f9a-40aa-8be3-74584be1d28f` |
| A2 | `26bc4cb0-b3eb-4ee3-913d-5f23aee18cc8` |
| A3 | `61ef1e56-1bc2-49b5-873a-93c77841a398` |
| A4 | `d963c885-e811-44f4-a6fe-279f56aed1d5` |
| B1 | `dfbdf3c9-6ac9-4d80-8442-e879ef627b07` |
| B2 | `db4f5561-e284-4081-bd72-d1eab654f781` |
| B3 | `76fd1c5f-d3f8-4a70-afc6-b12f9e8fb51d` |
| B4 | `452bcb24-5c70-4577-b4d5-8b1e852b9061` |
| C1 | `1d63c7b7-4895-450b-8872-2206cdf976a5` |
| C2 | `8762b693-68ab-4543-8701-2395279fe092` |
| C3 | `30e0ce3f-ad36-4a36-b0a5-61d8602e84f3` |
| D1 | `28c935b4-91a8-44c8-81f4-984166a2b941` |
| D2 | `6533d386-743a-4b8d-8849-3e09132796b6` |
| D3 | `c7c43bce-1959-473f-8308-e386e6c5c57e` |
| D4 | `c0866fc1-a030-4cd9-872a-e6c591689473` |
