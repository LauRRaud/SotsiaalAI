# SotsiaalAI RAG/Graph — GitHubi audit ja edasine plaan

**Auditi kuupäev:** 08.09.2026

**GitHubi vaadeldud haru:** `main`

**Fikseeritud commit:** `9780dee9c68b0ea699b4a4cee2f8257bb84ce5dd`

**Commit’i aeg:** 07.09.2026 18:32:18 UTC

**Commit’i sõnum:** `Record deployed budget display and restored published knowledge intake`

See dokument on kuupäevastatud sõltumatu assistendi koodiülevaatus ja arendusettepanek. See ei asenda projekti aktiivset `SotsiaalAI.md` S1.0/S2 tööseisu, ei kinnita kogu M4/M6 vastuvõttu ega anna uusi väliskutse-, push’i- või paigalduslubasid.

## Kokkuvõttev otsus

**Olemasolevat tuuma tuleb edasi arendada, mitte asendada uue RAG-raamistiku, andmebaasi või agentide ahelaga.** Võrreldes varasema M4-C kohaliku katsega on nüüd koodis olemas nii juhitud jätkuvestlus, serveri segmendi-ID-del põhinev tõendimustandi kandidaat kui ka allikasse ankurdatud M3 teadmiskirjed ja haldaja teadmismustandi töövoog.

Suurim järgmine ülesanne pole järjekordne sama küsimuse promptikatse. See on **kontrollitud väljalaske, allikakorpuse ja tegeliku vestluskonfiguratsiooni ühendamine**, seejärel jätkatav mahutöötlus ja päringu töömahu vähendamine. Üks konkreetne dokumendiõiguse järelkontrolli viga vajab enne kasutusulatuse laiendamist parandust.

### Prioriteedid

| ID | Prioriteet ja liik | Järeldus | Tõendi seis |
|---|---|---|---|
| F01 | P1, väljalaske töökindlus | Auditeeritud `main` ei läbi GitHubi linti ega webpack-build’i. | Tegelikud GitHub Actionsi tulemused ja logid. |
| F02 | P1, turve; hinnanguline raskus keskmine | Admini PDF-/metadata-lugemise lõpus ei jõustata uuesti konkreetse dokumendi luba. | Lähtekood + eraldatud kuue stsenaariumi diagnostika; mitte pärisserveri ründekatse. |
| F03 | P1, töökindlus/integratsioon | Uue indeksi aktiveerimine ja M4 põlvkonna valik on eraldi; erinevus peatab uue päringu. | Koodist kinnitatud; viimase serverierinevuse kohta ainult 07.09 masteri teade. |
| F04 | P1 enne suurt korpust, jõudlus | Päring loeb kogu lubatud korpust ning kordab suuri kontrolle; üks liikmelisustsükkel on ruutkeerukusega. | Kooditee ja keerukuse analüüs; mitte koormusmõõtmine. |
| F05 | P1 enne massindekseerimist, andmetöötlus | Praegune indekseerimine on tervikpõlvkonna töö, mitte üldine jätkatav mahupipeline. | Koodis 5000 üksuse piir, täielikud massiivid ja suur tehing. |
| F06 | P2, teadmiste tähendus | M3 on ankurdatud sõltuvuskontekst, mitte semantiliselt kinnitatud reeglimootor. | Kood + ühe dokumendi avaldatud kontrolliraport. |
| F07 | P1, teostuse jälgitavus | Uuem nelja vormingu M1 ja osa korpusedokumente on masteri järgi kohalikud; auditeeritud GitHubis neid pole. | Masteri selgesõnaline piir + GitHubi puu ja PDF-sisendikood. |
| F08 | P2, tootenõue | Praegune M4 esitus lisab jätkuvalt tekstisiseseid viiteid; tootmisallikapaneel pole nõutud kujul valmis. | Renderdaja ja kliendiadapter + omaniku nõue masteris. |

P1 tähendab siin tööjärje prioriteeti, mitte kõigi kirjete ühesugust turvaraskust. Ainus selles auditivoorus eraldi taasesitatud ligipääsuviga on F02. Muude pindade turvalisuse kohta ei anta üldist garantiid.

## 1. Auditi alus ja piir

### Vaadatud

GitHubi haru ja fikseeritud failid loeti GitHubi ühenduse kaudu. Vaadati projekti juhiseid, aktiivse tööseisu asjakohast algusosa, sissevõtu põhivoogu, teadmiskirjete lepingut, sõltuvuste läbimist, indekseerimist, PostgreSQL-i/Qdranti adaptereid, mudelikonteksti, M4 päringu/vastuse/dialoogi/configuration/presentation radu, admini sessiooni ja HTTP-ühendust, admini õigusi ja kulutöid, valitud teste ning uuemaid arendusraporteid. GitHub Actionsi kahe ebaõnnestunud töö logid loeti eraldi.

Lisatud 775-realise masteri järgi tehtud järeldused eristatakse koodist kontrollitust. Masteri SHA-256: `1a607eec3f3b496aaab8c47373d9bb38b825c31422ad589b1b80840707a29c60`.

### Mida ei tehtud

Repositooriumi ega serverit ei muudetud. Ei tehtud commit’i, push’i, deploy’d, uut embedding’ut, vastamiskutset ega pärisandmebaasi kirjutust. Ei kasutatud kasutaja privaatseid kontovõtmeid ega loetud päriskasutajate juhtumeid. Serveri hetkeolekut, failisüsteemi õigusi, PostgreSQL/Qdranti tegelikku sisu ja teenusepakkuja arvet ei kontrollitud.

Täielikku repositooriumi testikomplekti, npm-sõltuvuste installi, tootmisbuild’i ja kogu platvormi turvatesti selles keskkonnas ei käivitatud. Repositooriumi täiskoopiat ega vajalikke teenuseid ei olnud siin ette valmistatud; ühendusest loeti sihitud lähtekood. Katseartefaktide privaatseid `tmp` tervikfaile üldjuhul ei olnud kaasas. Raportites nimetatud käitumised on seega nende koostaja tõend, mitte kõik uued sõltumatud mõõtmised.

**Käivitati ainult eraldatud admini lugemisraja diagnostika kuue stsenaariumiga.** See kasutab kolme lähtekoodist kopeeritud meetodit, päris ajutisi sünteetilisi faile ning juhitavat õigusemuutust. See ei ole kogu `IntakeService` ega päris HTTP/autentimise integratsioonitest. Vt `diagnostics/admin-asset-revocation.mjs` ja `evidence/admin-asset-revocation.json`.

GitHubi `main` näitas ka järelkontrollil sama SHA-d. See fikseerib auditi lähtealuse; see ei kinnita, et kasutaja kohalik tööpuu on selle SHA-ga identne.

## 2. Tegelik areng pärast eelmist arutelu

### Jätkuvestlus on päriselt edasi liikunud

Uuendatud M4-C raport kirjeldab 15-pöördelist pärisotsinguga katset: 15 embedding’u- ja 15 vastamiskatset, 15 avaldatud vastust. Parandatud Tartu asukoht, uue inimese piir ja varasema teema juurde naasmine säilisid kontrollitud jäljes. Esimese jooksu kogu nähtav UI-taastamisrada jäi tegemata; hilisemad 12-pöördeline järelkatse ja kuue paari võrdlus lisasid oma piirides taastamise tõendeid. Neid etappe ei ühendata tagantjärele üheks veatuks esimeseks jooksuks. [R16]

Praegune `dialogue.js` kasutab versiooni `m4-active-dialogue-1`, otsinguteksti `m4-user-scope-search-1` ja dialoogijuhist `m4-grounded-dialogue-2`. Kontekstis on kuni kaheksa kasutajapööret ühes ulatuses ja 64 kogu vestluses. Režiimid on endiselt kasutaja selgesõnalised valikud. See ei tõenda veel automaatset vabavestluse teema- ja isikutuvastust. [R15]

### Täpse tsitaadi kandidaat ja segmendikandidaat pole sama asi

Varasem mudeli kopeeritud täpse tsitaadi kandidaat ebaõnnestus 0/7 avaldamisega. Hilisem `m4-evidence-draft-2` valib serveri tehtud `segmentId` väärtusi; algteksti ja nihked taastab programm. Kuue paari raportis avaldasid mõlemad variandid 6/6 vastust; kandidaadi 28/28 valitud segmendi seosed vastasid kataloogile. [R17]

Sama raporti järgi oli semantiline jaotus baasvariandil 2 PASS / 4 PARTIAL ning kandidaadil 4 PASS / 2 PARTIAL. See on raporti kuue juhtumi tabeli kokkuvõte, mitte sõltumatu statistiline hinnang. Kandidaat jäi opt-in variandiks; jätkuvestlusega ühendamist ei võetud vastu. T1 ja T5 piirid jäid lahti. Neid ei tohi asendada vana 0/7 kokkuvõttega ega kuulutada hilisemat kandidaati universaalseks võitjaks. [R17]

### M3 pole enam ainult kavatsus

Koodis on `knowledge_cards`, suunatud `dependencies`, `knowledge_gaps`, `all/any`, ankrute kontroll ja piiratud sõltuvuste lisamine. Haldaja saab ühe dokumendi kohta mudelilt teadmismustandi, näeb tsitaate, valib säilitatavad kirjed ja avaldab uue muutumatu allikaversiooni. [R06, R07, R18]

Ühe dokumendi pärisrajal tekkis 13 kaarti ja kaks kandidaatseost. Üks `REQUIRES` jäeti ülevaatusel välja, sest allika põhjendus ei olnud eeltingimus. Alles jäi üks `QUALIFIES`. Uus indeks säilitas kaheksa dokumenti ja 69 tekstiosa; kontrollitud sõltuvuspäring oli leksikaalne, mitte selle graafi pealt koostatud pärisvestlusvastus. [R18]

### Uus M1 on praegu teise tõendipiiriga

Lisatud master kirjeldab PDF/HTML/XML/JSON-i kohalikku vastuvõttu seitsme pärisallika ja 194 tekstiosaga. Master ütleb ise, et see sisaldab veel commit’imata tööd. Auditeeritud GitHubi `ingestion.js` nõuab endiselt `%PDF-` signatuuri; `registered-source.js` ei ole sellel commit’il leitav. `docs/rag-v2` puus on ADR-id kuni 008-ni, mitte masteri ADR-009/010. See ei tõesta kohaliku M1 puudumist või ebaõnnestumist; see piirab siin tehtud koodiülevaatust. [M §§1,3,10; R02,R05]

## 3. F01 — GitHubi väljalase pole korratavalt roheline

**Tõend:** Actionsi run `34152034000`, head `9780dee9c…`. `quality-gate` töö `101836184018` ebaõnnestus lintis. `webpack-build` töö `101836184214` ebaõnnestus webpack-kompileerimisel. [R01]

Lint-logis on üks peatav viga `app/layout.js:334:9`: `@next/next/no-sync-scripts`. Vaadeldud allikas on Cloudflare’i välise skripti element. Seda tuleb kirjeldada lint-reegli veana; üksnes reegli nimi ei tõesta, et `type="module"` skript käitub brauseris sünkroonselt.

Webpack-logi näitab importahelat:

```text
node:crypto
→ lib/chat/questionRequirements.js
→ lib/chat/ragDiagnostics.js
→ components/chat/ChatDiagnosticsModal.jsx
→ components/alalehed/ChatBody.jsx
```

`questionRequirements.js` impordib tõepoolest `createHash` funktsiooni `node:crypto`-st. Brauseri diagnostika vaade peab kasutama brauserisse sobivat andmekuju/esitusmoodulit, mitte transitiivselt serverimoodulit. See on väljalaske ühendusviga, mitte tõend, et RAG-i indeks või embedding’ud oleksid rikutud. [R03]

**Soovitus:** võtta olemasolevad kohalikud quality-gate’i parandused üle eraldi ülevaadatud muudatusena. Mitte keelata reeglit ega lisada brauserisse serveri krüptoteegi polüfilli ilma vajadust tõendamata. Kinnitada mõlemad build-rajad tegeliku puhta väljalaskekoodi peal. Kohaliku tööpuu edukas build koos commit’imata parandustega ei tõenda GitHubi commit’i korratavust.

Install-logis oli ka npm-i kokkuvõte 19 turvahoiatusest (5 mõõdukat, 13 kõrget, 1 kriitiline). See **ei ole käesoleva auditi 19 valideeritud turvaleidu**. Vajalik on paketi/advisory täpne väljund, tootmis-/arendussõltuvuse eristus ja kasutatava kooditee hinnang. Ärge kasutage selle arvu põhjal pimesi `npm audit fix --force`.

## 4. F02 — admini allikafaili lugemine ei jõusta värsket dokumendiluba

**Asukoht:** `lib/rag-v2/admin/intake.js`, `IntakeService.get(jobId, asset)`.

Alguses kontrollitakse dokumenti õigesti:

```javascript
const documents = await this.access();
const receipt = await this.receipt(jobId, documents);
```

Faili lugemise ja räsi kontrolli järel tehakse aga ainult:

```javascript
await this.access();
return { bytes, type: ... };
```

`access()` tagastab praegu lubatud dokumentide loendi. Kui dokumendi grant eemaldati vahepeal, võib tagastuseks olla `[]`; see ei ole iseenesest erind. Tühja grant-loendit lubab ka `FilePolicy`. Meetod ei kontrolli, kas `receipt.bundle.document_id` on selles värskes loendis alles. [R04,R19]

Admini sessiooni korduskontroll ei sulge seda konkreetset auku: konto võib olla jätkuvalt sama lubatud administraator ning konfiguratsioon muutumatu, samal ajal kui poliitikafaili konkreetne dokumendiluba on eemaldatud. HTTP GET tagastab teenuse antud baidid ilma veel ühe dokumendikontrollita. [R20]

### Taasesitus

| Stsenaarium | Vaadeldud tulemus |
|---|---|
| Luba säilib | Sünteetiline PDF tagastatakse. |
| Dokumendiluba puudub enne päringut | `rag_v2_document_not_allowed`. |
| Dokumendiluba eemaldatakse PDF-i lugemise ajal | **PDF-i baidid tagastatakse pärast loa eemaldamist.** |
| Dokumendiluba eemaldatakse metadata lugemise ajal | **Metadata baidid tagastatakse pärast loa eemaldamist.** |
| Kogu administraatoriõigus eemaldatakse lugemise ajal | `forbidden`. |
| Dokumendiluba eemaldatakse JSON-kviitungi koostamise ajal | Õigesti tõrjutud, sest selles harus kontrollitakse kviitungit värske loendiga uuesti. |

See on piiritletud võistlusolukord varem lubatud admini lugemises, mitte anonüümne suvalise faili lugemine või tõend tegelikust andmelekkest serveris. Raskuse hinnang on keskmine; ärilise ulatuse laienemisel muutub õiguste tühistamise järjepidevus olulisemaks.

**Parandus:** kasutada pärast faili lugemist sama konkreetse dokumendi/kviitungi uut lubatavuse kontrolli nagu JSON-harus; hõlmata ka kviitungi aegumine ja konfiguratsiooniseos. Mitte muuta `access()` puuduvat vastet automaatselt kogu korpuse lubamiseks.

**Vastuvõtt:** päris teenuse testis tuleb vahetult lugemise lõpetamise ja tagastuse vahel eemaldada ainult dokumendigranti kirje. Mõlema varaliigi tagastus peab olema tõrjutud. Diagnostikafail kinnitab praeguse vea olemasolu; seda ei lisata CI-sse veast läbi minemist oodava regressioonitestina.

## 5. F03 — allikaregister, aktiivne indeks ja M4 plaan on eri olekud

Admini avaldamine aktiveerib uue `rag_v2_head` põlvkonna. M4 konfiguratsioon sisaldab eraldi `generationId` ja `documents` versioonikaarti. `runtimeAdapters.preflight()` ning `search()` nõuavad nende vastavust aktiivsele indeksile ja annavad erinevuse korral `active_index_mismatch` või `active_source_version_mismatch`. [R04,R09]

**Seetõttu ei ole kirjeldatud erinevus lihtsalt „vestlus kasutab vanemat indeksit”.** Uus päring võib peatuda; süsteem ei vali automaatselt vana põlvkonna pealt vastamist. Salvestatud ajaloolise vastuse lugemine on eraldi rada, kus vana allikaversiooni püsimine on vajalik.

Masteri 07.09 serverimõõtmine teatas sellisest põlvkonnaerinevusest. Ma ei mõõtnud, kas see on 08.09 jätkuvalt serveris olemas. Kood näitab selgelt mõju juhul, kui erinevus püsib. [M §8]

**Soovitus:** moodustada üle vaadatud teadmiste väljalase, mis seob allikaversioonipildi, indeksipõlvkonna, otsinguprofiili ja vastamislepingu. Jooksvad ligipääsuotsused jäävad sellest eraldi värskeks kontrolliks. Avaldamine peab koordineerima M4-le lubatud uue väljalaske ning võimaldama vana juurde tagasipöördumist.

Esialgu võib see olla kontrollitud hooldustoiming praeguse arhitektuuri peal. Ei ole vaja kohe uut hajustransaktsiooni. Tulevases teenuses peab iga pööre fikseerima ühe valmis väljalaske; uus aktiveerimine ei tohi keset pöörde tööd allikaid vahetada. Pelk põlvkonna kontrolli väljalülitamine pole lahendus.

Admini aegumispoliitika on praegu M4 omast erinev: `validateAdminConfig()` nõuab tulevast tähtaega; M4 aktsepteerib selgesõnalist `null` väärtust. Masteri ajutist adminiseadistust ei tohi segi ajada tähtajatu M4 katsepoliitikaga. Praegust admini aktiivsust tuleb eraldi mõõta, mitte tuletada vanast kuupäevast. [R10,R14]

## 6. F04 — tegelik jõudlustakistus on korduv töö, mitte tingimata mudel

`retrieve()` laeb enne otsingukanaleid kõigi nähtavate dokumentide bundle’id ja kõik nende üksused, kontrollib objekte ning rekonstrueerib `indexUnit()` andmed. Sõltuvuskihile koostatakse kogu valitud korpuse kaardi-/servaindeks mällu. Piiratud 16 graafisammu ei piira selle eeltöö mahtu. [R08,R07,R11]

Täiendavad konkreetsed kordused:

1. Sobivate üksuste loendi sees kontrollitakse iga üksust `eligibleIds.includes(unit.id)` abil. Kui kõik N üksust sobivad, läbib see silmus ligikaudu N(N+1)/2 võrdluskohta. Näiteks N=5000 korral 12 502 500 — see on koodist tuletatud keerukus, mitte serveri ajamõõtmine.
2. `canonicalReference()` laeb ja valideerib terve dokumendi bundle’i koos objektidega isegi ühe viite jaoks.
3. M4 baasedu korral kontrollitakse iga viidet enne mudelit, pärast mudelit ja vastuse taastamisel. Viie viite korral on selles rajal 15 kanoonilise resolveri väljakutset; adapter loob iga kord uue PostgreSQL-i ühenduspuuli. Varasema assistendivastuse või kandidaadi kontroll võib tööd lisada. Need on kooditee väljakutsete arvud, mitte sõltumatult mõõdetud SQL-päringute koguarv. [R09,R11,R21]
4. Käivitamise kontroll arvutab teostusmanifesti uuesti: loeb runtime-faile, lukufaili ja sõnumikatalooge. Õiguste värske kontroll on vajalik; muutumatu väljalaske kõigi failide korduv räsimine pole ainus viis seda saavutada. [R12,R14]
5. Qdranti päring kasutab `exact:true` ning filtris kõiki sobivate üksuste ID-sid. See on kontrollitud väikekorpuse jaoks sobiv baas, kuid suure mahu automaatset skaleerumist sellest ei järeldu. [R13]

### Soovitatud tööjaotus

**Sisendi/aktiveerimise ajal:** täielik allikate, indeksi, vektorite ja versiooniseoste kontroll, valideeritud väljalaskemanifest.

**Päringu ajal:** kasutaja kehtivad õigused ja väljalase → piiratud kandidaatide otsing → ainult kasutatavate üksuste/ankrute/sõltuvuste lugemine → enne saatmist ja avaldamist värske ligipääsukontroll.

**Sama päringu sees:** ühe dokumendi sama muutumatu versiooni kontrolli võib turvaliselt taaskasutada; õigusteotsust ei külmutata selleks kogu vastamise ajaks. Kõigepealt parandada ilmne O(N²) liikmelisustsükkel `Set`-iga ning võtta ühenduspuul päringu või teenuse eluea alla. Alles pärast mõõtmist otsustada täpse/ligikaudse vektorotsingu profiilide üle.

Mõõta PostgreSQL-ist loetud ridu/baite, failiräside tööd, kanooniliste resolutsioonide arvu, protsessi mälu ja otsinguaega eraldi mudeliajast. Võrdlus peab säilitama õiguste tühistamise ning vigase allika tuvastamise testid. Ära muuda kiirusparanduse nime all semantilist järjestust.

## 7. F05/F07 — olemasolev korpus vajab üldist jätkatavat sissevõtu- ja avaldamisrada

Masteri järgi on registris 2529 failikirjet, sealhulgas 892 ajakirjaartiklit (849 PDF + 43 HTML), 185 juhendifaili, 78 KOV-paketti ja 104 XML-i. Need on **masteri registriarvud**, mitte käesolevas auditivoorus üle loetud algfailid ega aktiivse indeksi dokumentide arv. Kontaktide lookup, allikaregistrid ja põhiteadmuse dokumendid on masteris eristatud ning nii peab see ka jääma. [M §8]

Auditeeritud `indexSnapshot()` moodustab kõik üksused ja vektorid mällu, impordib PostgreSQL-i ühe suure tehinguga, laeb Qdranti ja kontrollib kogu põlvkonna. Qdranti 100 punkti kaupa kirjutamine ei tee tervikprotsessi veel üldiseks jätkatavaks partiitööks. `local_index_limit` peatab üle 5000 üksuse; admini lubatud dokumentide loendi piir on 64. Piire ei tõsteta lihtsalt oletatava mahu järgi. [R10,R22,R13]

### Järgmise mahutöötluse leping

- Deterministlik tööde manifest: sisendvara, konkreetne JSON-i kirje, algmetaandmed, adapteri- ja töötlusversioon, õigused ning tulemuse räsi.
- Dokumendi kaupa olekud: vastendamata, vastuoluline, ette valmistatud, parsitud, ülevaatust vajav, indeksi jaoks valmis, avaldatud. Katkestusest jätkamine ei eelda kõigi varasemate dokumentide kordustöötlust.
- Eraldi töövood teksti töötlemisele, valikulisele teadmiste koostamisele ja vektoritele. Kogu korpuse iga lause keelemudeliga märgendamine pole esialgne eeltingimus.
- Muutumatu embedding-sisend taaskasutab kontrollitud vektorit; muutunud tekst/prefiks/mudel ei kasuta vana vektorit. Taastatud vanad lõigud ei muutu ümbernimetamisega ametliku lehe tsitaadiks.
- Uus põlvkond koostatakse eraldatult ja aktiveeritakse tervikuna alles valideerimisel. Päeviku „valmis” märge ei asenda allika, indeksi ja vestluse versiooniseost.
- Kululuba võib katta ühe tegeliku manifestiga piiratud partii. Iga faili või pöörde jaoks uue käsikinnituse nõudmine ei pea muutuma toote tavaliseks töövooguks; õigused ja kogupiir peavad siiski säilima.

**Enne kogu korpuse massavaldamist teha väike nelja vormingu tervikrada.** Kohalik M1 on masteri järgi juba valmis; seda ei tellita uuesti. Kontrollitakse selle tegeliku koodi integreerimist, seejärel PDF-i, HTML-i, XML-i ja JSON-kirje salvestust, indekseerimist, viite avamist ja ajaloo taastamist. Mitte-PDF allikale ei looda kunstlikke PDF-lehekülgi.

## 8. F06 — milline GraphRAG see tegelikult on?

Praegust lahendust võib kirjeldada kui **hübriidotsingu tuuma koos allikasse ankurdatud sõltuvuskontekstiga**, mitte universaalse teadmiste- või reeglisüsteemina. Graafikiht on relatsioonilise andmebaasi objektides ja bundle’ites; eraldi graafiandmebaasi puudumine ei ole selle töö jaoks tõendatud puudus.

`REQUIRES`, `EXCEPTION_TO`, `DEFINES`, `QUALIFIES` ja `SUPERSEDES` mõjutavad konteksti laiendamist. Algtekstid, seose suund, all/any, kasutatud K-/S-tunnused, piirid ning puuduvad sihid säilivad. `applicability` jääb `unknown`. Neljaväärtuseline `conditionGroupState()` on olemas, kuid selle olemasolu ei tõenda kasutaja tegelike faktide alusel käitatavat reeglimootorit. [R06,R07]

Kõik teadmiskirjed on `source_anchored_unreviewed`. See on aus ja vajalik, sest ühe dokumendi kontrollis eemaldatud vale `REQUIRES` näitab, et täpne tsitaat ei kinnita seose tähendust. **Haldaja valik ja avaldamine pole praegu eraldi semantiline kinnitusstaatus.** [R18]

### M3 järgmine sisuline väärtus

Järgmine seostamise katse peaks sisaldama teenusekirjeldust, teises allikas paiknevat tingimust/erandit ning vähemalt üht allika versiooniuuendust. Vajalik on kontrollitud dokumentidevahelise sihi valik, mitte ainult sama nimetusega kaartide liitmine.

Ülevaatuse otsus võiks tulevikus olla eraldi päritoluga kirje: milline inimene/mudel mida hindas, millise allikaversiooni vastu, mis ulatuses ja mis kuupäeval. Seda ei impordita algmetaandme `verified=true` lipust.

Tingimuse rakenduvus vajab kasutajafakti päritolu, vastuolu ja teadmata seisundit; tundmatut ei tohi tõlgendada vääraks ega tõeseks. Sihiversiooni muutumisel on vaja mõjutatud seoste ja vastusekontekstide tuvastamist. Sihtversioonid on praegu servades jäigalt seotud; uuenduste juhtimine vajab oma lepingut, mitte viidete vaikset suunamist uusima sisu peale.

Võrdluses tuleb eristada seose lisaväärtust suuremast kontekstist. Graafivariandi üheksa tekstiosa ja baasvariandi viis tekstiosa ei ole iseenesest sama eelarvega katse. Võrrelda määravaid väljajätteid, keeldumisi ja tegelikku kontekstimahtu tugeva lihtsa otsingubaasiga.

## 9. F08 ja M4 — tootevastus ning semantiline kvaliteet

Praegune renderer lisab endiselt `[S1, S2]` märgid allikaplokkide lõppu ja `pilotChatResult()` kasutab seda teksti. Kliendi allikakuju sisaldab pealkirja, lehti, URL-i ja kasutatud/leitud eristust, kuid ei edasta kogu masteris nõutud bibliograafiat eraldi väljadena. [R23,R24]

Masteri tootmisnõue on **puhas vastusemull + eraldi „Vastuste allikad” paneel**, mitte viidete eemaldamine andmetest. Tootmisprojektsioon peab eristuma katsediagnostikast. Säilitada ploki→allika seos, versioon, kasutatud/leitud staatus, autor/aasta/väljaanne/lehed või muu allikakoht ning veateate seos konkreetse vastusega. See töö ei nõua uut mudelit ega viitevalideerimise nõrgendamist. [M §1]

Viimased kontrollid näitavad edasiminekut, kuid ka allesjäänud semantilisi vigu. T1 allikakirjeldatud arendustegevuse nüanss võib kaduda liiga laias „algus pole tõendatud” piirangus; T5 võib esitada vastaja järeldust allikaplokis. Mõlemad on laiemad probleemid kui viite-ID olemasolu. [R17]

Seepärast peab M4 kvaliteeditöö hõlmama nii ülemääraseid väiteid **kui liigset ettevaatlikkust ja määravaid väljajätteid**. Eesmärgiks pole võimalikult palju `partial` vastuseid. Piiranguvälja teisaldamine ei muuda väidet tõeseks ning automaatne vormitõrje ei asenda sisu hindamist.

Ei soovita uut kõigile küsimustele lisatavat hindavat agenti ega järgmist suurt sama valimi promptiringi. Kohalikud täpsed regressioonid säilivad; laiem kasutuskatse peab tulema esinduslikumast päriskorpusest ja selgelt fikseeritud küsimustest. Varasema vastuse kordamine ei tohi muuta selle oletust dialoogis faktiks.

## 10. Säilitamist väärt lahendused

1. Algallikas, metaandmed, tekstiosad ja viitekaart on eristatud ning versioonidega seotud. Uut teadmismustandit ei kirjutata algdokumendi asemele. [R05,R06]
2. PostgreSQL-i ja Qdranti põlvkond aktiveeritakse pärast kontrolli; vektori mõõtmete kõrval kontrollitakse ka tegelikku sisu. Vektorindeks pole ainus tekstihoidla. [R11,R13,R22]
3. Graafi eeldused, tsüklid, puuduvad sihid ja mahu tõttu kaasamata kontekst jäävad nähtavaks. [R07]
4. M4 eristab saatmist, teadaolevat vastust, avaldamist, `unknown`-seisu ja taastamist. Mustand ja tegelik pakett säilivad kontrollitud kujul ning lugemine ei pea tellima uut vastust. [R21]
5. Jätkuvestluse aktiivne inimene/teema ei sõltu eelmise vastuse õnnestumisest; varasem assistenditekst ei ole faktiallikas. [R15]
6. Admini teadmismustandi ja embedding’u kulud on eraldi, kordused kontrollitud ning teadmise avaldamine ei võrdu semantilise heakskiiduga. [R04,R18,R25]

Neid mehhanisme ei eemaldataks kiiruse või mugavuse nimel. Optimeerimise siht on korduva muutumatu töö vähendamine, mitte päritolu ja õiguste kaotamine.

## 11. Prioriseeritud edasine plaan

| Tööplokk | Sisu | Edasiliikumise tõend |
|---|---|---|
| **A. Kontrollitud väljalase ja tervikühendus** | Kohalik töö vs GitHub selgeks; CI parandused; F02; olemasoleva uue M1 integreerimine; väike nelja vormingu indeks/viide; allika→indeksi→M4 väljalase. | Puhtast commit’ist korratav build; dokumendiloata lugemine tõrjutud; igal neljal vormingul õige allikakoht ja versioon; uue päringu põlvkond teadlikult valitud. |
| **B. Jätkatav mahutöötlus** | REGISTER-põhine manifest, allikapõhised tööd/checkpoint’id, konfliktid, muutunud/taaskasutatav tekst, eraldi teadmise/vektori eelarve. | Katkestus ja jätk ei dubleeri tööd/kulu; ühe dokumendi muutus ei nõua kõigi tekstide uuesti genereerimist; vana aktiivne indeks säilib kuni uue valmimiseni. |
| **C. Valikuline kiire päring** | Väldi kogu korpuse laadimist ja O(N²) tsüklit; piiratud DB lugemised; sama päringu kanooniliste andmete taaskasutus; ühenduste elutsükkel. | Sama allikavalik ja piirangud kontrollvalimil; päringu loetud andmemaht ei kasva kogu korpuse tekstimahuga; ACL-tühistamise ja vigase allika testid säilivad. |
| **D. M3 dokumentidevahelised tingimused** | Suunatud seosed, sisulise ülevaatuse päritolu, kasutajafaktide/aja rakenduvus, versiooniuuenduse mõju. | Kaugem määrav erand jõuab vastusesse; vale seos tõrjutakse või jääb kontrollimata kandidaadiks; teadmata asjaolu ei muutu otsuseks. |
| **E. M4 kasutatavus ja sisuline vastuvõtt** | Nõutud allikapaneel, loomulik vestlus, parandused, sama inimese eri teemad, realistlik korpus ja külmutatud küsimused. | Õigsus, täielikkus, kasulikkus, piirangud ja viited on mõõdetud eraldi; lubatud kasutusulatus määratud. |
| **F. M5 ajalised ülevaated ja M6 tootestamine** | Ajaperioodi-/teemakatvus, tõendatud muutused, paigaldatav tuum, teise kliendi eraldatus, varundus/taastamine, kustutus ja uuendamine. | Kümnendi ülevaade eristab kajastust tegelikust muutusest; sama väljalase töötab teise kliendi juures ilma tuuma ümberkirjutuseta. |

B ja C tehniline ettevalmistus võib alata paralleelselt, aga mahuka korpuse avaldamist ei tehta enne A läbimist. D/E puhul ei pea ootama kogu korpuse täiuslikkust: kasutada saab selgelt piiratud teemavaldkonda. M6 õigused, varundus ja käitus ei jää viimaseks lihtsalt etapinumbri pärast.

### Kümne aasta küsimuse jaoks

Tulevane küsimus „kuidas sotsiaaltöö kümne aastaga muutus?” vajab eraldi teema- ja ajakatvuse rada. Viis kõige sarnasemat lõiku pole kogu kümnendi esinduslikkuse tõend. Säilitada tuleb avaldamisaeg, kirjeldatud sündmuse aeg, õiguslik kehtivus ja allika tüüp. Artiklis arutatud ettepanek, alanud piloot, kehtestatud kord ja mõõdetud mõju on eri väited.

Minu ettepanek on teha aastate/teemade kaart ingest’i ajal või kontrollitud uuendustööna ning viia sünteesi olulised tähelepanekud tagasi algallikatesse. Koondkokkuvõte ei asenda määravat erandit ega muutu ise uueks sõltumatuks allikaks. Need on kavandatavad nõuded, mitte praeguse teostuse tõendatud võimalused.

### Eraldi müüdav tuum

Kõigepealt stabiliseerida allikaadapteri, õiguste, väljalaske ja tõendipaketi liidesed. SotsiaalAI sessioon ning `Conversation/ChatTurn` püsistus jäävad kliendiadapteriks. Modelle ei pea kohe kõikjalt täielikult abstraheerima, kuid üks kontrollitud mudelipiir ei tohiks hiljem nõuda kogu parseri ja indeksi ümberkirjutamist.

Teise kliendi piloteerimine peaks kontrollima sama tuuma, mitte looma teist projekti koopiat eranditega. Vastuvõtt sisaldab kliendiandmete isolatsiooni, allika uuendamist/eemaldamist, taastamist ning tegelikku haldustöö ja API-kulu. Hind ega patent ei asenda seda tõendit. Võimalik tehniline eristus on kogu allika- ja sõltuvuselutsükli kontrollitavus; käesolev audit ei tõenda selle patendiõiguslikku uudsust.

## 12. Järgmine Codexi tööots

Vaata samas paketis `CODEX_JARGMINE_PLOKK_VALJALASE_JA_TERVIKRADA.md`.

See ei telli uut RAG-i ega uut üldauditit. See käsib kasutada olemasolevat kohalikku teostust, parandada üks kitsas õiguste auk ja viia väike tegelik allika→indeksi→vestluse ahel korratava väljalaskeni. Järgnev mahutöötlus ja valikuline päring on eraldi piiritletud tööd.

## Allikaregister

Kõik GitHubi failiviited on fikseeritud commit’ile `9780dee9c68b0ea699b4a4cee2f8257bb84ce5dd`. Asukohtade nimetamisel eelistatakse funktsiooni nime; uued commit’id võivad reanumbrid muuta. Osa pikki faile loeti sihitud vahemikena, mitte tervikuna.

[M] Kasutaja lisatud **rag-susteem-master(1).md**, 08.09 kohaliku tööpuu ülevaade, 775 rida, SHA-256 ülal. Peatükid 1–11 on uus seis; peatükk 12 on 05.09 ajalugu.

- [R01] [GitHub Actions: run 34152034000; jobs 101836184018 ja 101836184214, mõlema töö dekodeeritud logid](https://github.com/LauRRaud/SotsiaalAI/actions/runs/34152034000)
- [R02] [GitHubi docs/rag-v2 puu: ADR-001…008; register-/uue M1 faili puudumise kontroll](https://github.com/LauRRaud/SotsiaalAI/blob/9780dee9c68b0ea699b4a4cee2f8257bb84ce5dd/docs/rag-v2)
- [R03] [Cloudflare’i skript ning node:crypto impordi allikas](https://github.com/LauRRaud/SotsiaalAI/blob/9780dee9c68b0ea699b4a4cee2f8257bb84ce5dd/lib/chat/questionRequirements.js)
- [R04] [Admini IntakeService: access, receipt, get, prepare, applyKnowledge, publish](https://github.com/LauRRaud/SotsiaalAI/blob/9780dee9c68b0ea699b4a4cee2f8257bb84ce5dd/lib/rag-v2/admin/intake.js)
- [R05] [Sissevõtu põhivoog, PDF-signatuur, identiteet ja versioon](https://github.com/LauRRaud/SotsiaalAI/blob/9780dee9c68b0ea699b4a4cee2f8257bb84ce5dd/lib/rag-v2/ingestion.js)
- [R06] [Teadmiste skeem, ankrud, staatus ja conditionGroupState](https://github.com/LauRRaud/SotsiaalAI/blob/9780dee9c68b0ea699b4a4cee2f8257bb84ce5dd/lib/rag-v2/knowledge.js)
- [R07] [Sõltuvuste läbimine, suunad, piirid ja unresolved](https://github.com/LauRRaud/SotsiaalAI/blob/9780dee9c68b0ea699b4a4cee2f8257bb84ce5dd/lib/rag-v2/search/dependencies.js)
- [R08] [Otsingu põhivoog ja täieliku korpuse lugemine](https://github.com/LauRRaud/SotsiaalAI/blob/9780dee9c68b0ea699b4a4cee2f8257bb84ce5dd/lib/rag-v2/search/retrieval.js)
- [R09] [M4 aktiivse indeksi kontroll ja iga viite uus adapter](https://github.com/LauRRaud/SotsiaalAI/blob/9780dee9c68b0ea699b4a4cee2f8257bb84ce5dd/lib/rag-v2/pilot/retrieval.js)
- [R10] [Admini konfiguratsioon: 64 dokumenti, tähtaeg ja privaatkaustad](https://github.com/LauRRaud/SotsiaalAI/blob/9780dee9c68b0ea699b4a4cee2f8257bb84ce5dd/lib/rag-v2/admin/config.js)
- [R11] [PostgreSQL-i objektid, bundles/units ja canonicalReference](https://github.com/LauRRaud/SotsiaalAI/blob/9780dee9c68b0ea699b4a4cee2f8257bb84ce5dd/lib/rag-v2/search/postgres.js)
- [R12] [Teostusmanifesti failide lugemine ja räsi](https://github.com/LauRRaud/SotsiaalAI/blob/9780dee9c68b0ea699b4a4cee2f8257bb84ce5dd/lib/rag-v2/pilot/provenance.js)
- [R13] [Qdranti vektorikontroll, partii100 ja exact:true päring](https://github.com/LauRRaud/SotsiaalAI/blob/9780dee9c68b0ea699b4a4cee2f8257bb84ce5dd/lib/rag-v2/search/qdrant.js)
- [R14] [M4 konfiguratsioon, mudelipiir, execute/read ja plaan](https://github.com/LauRRaud/SotsiaalAI/blob/9780dee9c68b0ea699b4a4cee2f8257bb84ce5dd/lib/rag-v2/pilot/config.js)
- [R15] [Juhitud vestluskontekst ja selle piirid](https://github.com/LauRRaud/SotsiaalAI/blob/9780dee9c68b0ea699b4a4cee2f8257bb84ce5dd/lib/rag-v2/pilot/dialogue.js)
- [R16] [M4-C päriskatse ja hilisemate järelkontrollide raport, valitud lõigud](https://github.com/LauRRaud/SotsiaalAI/blob/9780dee9c68b0ea699b4a4cee2f8257bb84ce5dd/docs/audits/rag-v2-m4-c-real-analysis-2026-09-07.md)
- [R17] [Segmendi-ID kandidaadi kuue paari plaan ja lõpphinnang](https://github.com/LauRRaud/SotsiaalAI/blob/9780dee9c68b0ea699b4a4cee2f8257bb84ce5dd/docs/audits/rag-v2-evidence-segments-local-2026-09-07.md)
- [R18] [M3 ühe dokumendi pärisrada ja selle piir](https://github.com/LauRRaud/SotsiaalAI/blob/9780dee9c68b0ea699b4a4cee2f8257bb84ce5dd/docs/rag-v2/adr-008-source-knowledge-preparation.md)
- [R19] [Poliitikagrandid: tühi lubatud dokumendiloend](https://github.com/LauRRaud/SotsiaalAI/blob/9780dee9c68b0ea699b4a4cee2f8257bb84ce5dd/lib/rag-v2/search/policy.js)
- [R20] [Admini sessiooni ja HTTP ühendused](https://github.com/LauRRaud/SotsiaalAI/blob/9780dee9c68b0ea699b4a4cee2f8257bb84ce5dd/lib/admin/rag/v2Server.js)
- [R21] [M4 päringu, auditi, avaldamise ja taastamise rada](https://github.com/LauRRaud/SotsiaalAI/blob/9780dee9c68b0ea699b4a4cee2f8257bb84ce5dd/lib/rag-v2/pilot/service.js)
- [R22] [Indekseerimise 5000 ühiku piir ja tervikpõlvkond](https://github.com/LauRRaud/SotsiaalAI/blob/9780dee9c68b0ea699b4a4cee2f8257bb84ce5dd/lib/rag-v2/search/indexing.js)
- [R23] [V4 renderdaja ning tekstiviited](https://github.com/LauRRaud/SotsiaalAI/blob/9780dee9c68b0ea699b4a4cee2f8257bb84ce5dd/lib/rag-v2/pilot/presentation.js)
- [R24] [M4 allikate ja nähtava vastuse kliendiprojektsioon](https://github.com/LauRRaud/SotsiaalAI/blob/9780dee9c68b0ea699b4a4cee2f8257bb84ce5dd/lib/chat/m4PilotClientContract.js)
- [R25] [Teadmiste koostamise päevik ja reserveeringud](https://github.com/LauRRaud/SotsiaalAI/blob/9780dee9c68b0ea699b4a4cee2f8257bb84ce5dd/lib/rag-v2/admin/knowledge-jobs.js)
- [R26] [Praegune vastuseskeem ja prompt m4-grounded-answer-8](https://github.com/LauRRaud/SotsiaalAI/blob/9780dee9c68b0ea699b4a4cee2f8257bb84ce5dd/lib/rag-v2/pilot/contracts.js)
- [R27] [Mudelikontekst, päritolu ja kanooniline resolver](https://github.com/LauRRaud/SotsiaalAI/blob/9780dee9c68b0ea699b4a4cee2f8257bb84ce5dd/lib/rag-v2/search/model-context.js)
- [R28] [Admini olemasolevate sihttestide katvus](https://github.com/LauRRaud/SotsiaalAI/blob/9780dee9c68b0ea699b4a4cee2f8257bb84ce5dd/tests/rag-v2-admin-intake.test.mjs)
- [R29] [Segmendi-ID-de deterministlik koostamine](https://github.com/LauRRaud/SotsiaalAI/blob/9780dee9c68b0ea699b4a4cee2f8257bb84ce5dd/lib/rag-v2/pilot/evidence-segments.js)
- [R30] [Admini HTTP-GET ja POST sissepääs](https://github.com/LauRRaud/SotsiaalAI/blob/9780dee9c68b0ea699b4a4cee2f8257bb84ce5dd/app/api/admin/rag/v2/intake/route.js)
- [R31] [Skripti element, vaadatud read323–346](https://github.com/LauRRaud/SotsiaalAI/blob/9780dee9c68b0ea699b4a4cee2f8257bb84ce5dd/app/layout.js)
- [R32] [Projekti töökorraldus](https://github.com/LauRRaud/SotsiaalAI/blob/9780dee9c68b0ea699b4a4cee2f8257bb84ce5dd/AGENTS.md)
- [R33] [Aktiivne tööseis: vaadatud asjakohane algusosa](https://github.com/LauRRaud/SotsiaalAI/blob/9780dee9c68b0ea699b4a4cee2f8257bb84ce5dd/docs/platvormi%20arendus/SotsiaalAI.md)

## Diagnostika kordamine

```sh
node diagnostics/admin-asset-revocation.mjs
```

Väljund peab auditeeritud meetoditega näitama F02 kirjeldatud puudujääki. Diagnostika töötab ainult oma ajutises kaustas sünteetiliste baitidega ega vaja serverivõtit, andmebaasi või mudelikutset. See ei muuda repositooriumi. Pärast tootmiskoodi parandust tuleb päris regressioonitest kirjutada vastupidise turvaootusega: lugemise ajal eemaldatud dokumendiluba peab keelama tagastuse.
