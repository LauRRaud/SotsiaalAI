# Näidisfailide audit ja ingest'i ülekandekaart

Versioon 0.1 • 2026-09-05

## Ulatus

Kontrollitud on paketi kolm sisendfaili. Artikli PDF-is on 13 lehekülge ja loetav tekstikiht. Vaadatud on kõigi lehtede renderdatud ülevaade ning eraldi viimane leht. JSON loeti täielikult. Kontrollsummad on `inputs/manifest.json` failis.

See audit ei kontrolli artikli kõigi sisuliste väidete ega metaandmete `last_checked` märke vastavust tänasele välismaailmale. Ei ole vaadatud rakenduse koodi, serverit ega kogu korpust. Täheldatud risk ei tõenda vana RAG-i rikke põhjust.

Allikate tähised: **PDF** = `inputs/Tehisintellekt sotsiaaltöös_2_2025.pdf`; **META** = vastav JSON; **ÜLEVAADE** = `inputs/ULEVAADE.md`. Leheküljenumbrid tähendavad PDF-i lehti, mitte ajakirjanumbri trükilehekülgi.

## 1. Dokumendi identiteet: mitu eri tasandi tunnust

**Failidest nähtav:** META `docId` on `sotsiaaltoo-2-2025`. Lisaks on seal artiklispetsiifilised `articleId`, `source_id` ja `document_id`. ÜLEVAADE näitab registris selle artikli `docId`-na pikemat artiklispetsiifilist väärtust.

**Risk:** ainult algse `docId` kasutamine artikli unikaalvõtmena võib sama ajakirjanumbri artiklid kokku viia. See on võimalik risk, mitte tõend, et varasem süsteem nii käitus.

**Ülekandereegel:** säilita kõik neli välist tunnust nende algse nimetusega. Kasuta artikli sisemise identiteedi alusena kontrollitud artiklitasandi vastendust. `sotsiaaltoo-2-2025` võib jääda väljaande/ajakirjanumbri kandidaattunnuseks. Väärtuste tähenduse vastendus peab olema nähtav, mitte vaikne ümbernimetamine.

**Test:** teine sama `docId`-ga, kuid teise `document_id`-ga sünteetiline artikkel ei kirjuta esimest üle.

## 2. Avaldamiskuupäev, PDF-i loomisaeg ja kontrollimismärge

**Failidest nähtav:** PDF-i 1. lehel on `06. juuni 2025`. Prindipäistes on `05.12.25, 19:49`. PDF-i tehniline CreationDate on `D:20251205174938+00'00'`. META sisaldab `year: 2025` ja `last_checked: 2026-04-26`, kuid mitte eraldi täpset avaldamiskuupäeva.

**Ülekandereegel:** `publication_date=2025-06-06` pärineb lehelt 1. PDF-i loomisaeg võib minna `asset_created_at` väljale koos tehnilise päritoluga. Metaandmete kontrollimisaeg säilib eraldi `source_checked_at` kandidaadina või imporditud märkena; audit ei tõenda selle kontrolli tegemist. `ingested_at` määrab uus import. Kehtivusajad jäävad teadmata, sest tegemist ei ole kindla jõustumisajaga normikirjega.

**Test:** päring artikli ilmumisaja kohta ei tagasta prindikuupäeva, faili loomisaega ega `last_checked` väärtust.

## 3. PDF-lehed ei ole tõend ajakirja trükilehekülgedest

**Failidest nähtav:** META `pdf_start_page=1`, `pdf_end_page=13`; failis on 13 lehte. PDF-i viimane leht kinnitab artikli ilmumist ajakirjas Sotsiaaltöö 2/2025. Faili päised ja jalused näitavad veebilehe väljatrükki.

**Ülekandereegel:** kasuta allikavaates selle PDF-i lehti 1–13. `journal_page_range` jääb `null`, kuni selle kohta on eraldi alus. Tekstilõigul peab olema enda täpne leht või lehtede vahemik, mitte üksnes kogu artikli 1–13.

**Test:** OTT-i käsitlev allikakoht avaneb PDF-i lehel 3, mitte suvaliselt artikli alguses ega väidetaval ajakirjalehel.

## 4. Rubriik, teema ja allika roll on eri väljad

**Failidest nähtav:** PDF-i lehel 1 on `Uurimus/analüüs`. META `section` on `Eetika`; `source_type=journal_article` ja `authority=editorial`. Lehel 13 on teemad `koosloome, teenuste arendamine, eetika`.

**Järeldus:** `Eetika` võib olla sisuline teemarubriik, mitte tõendatult vale väärtus. Seda ei tohi vaikselt asendada teise, erineva tähendusega liigitusega.

**Ülekandereegel:** säilita `legacy.section=Eetika`, eralda PDF-ist allika žanri/rubriigi silt ning salvesta päritoluga teemad. Ajakirjaanalüüs ei muutu teenuse saamise õiguslikuks aluseks pelgalt selle tõttu, et see paikneb avaliku asutuse veebis.

## 5. Kirjeldus sisaldab kontrollimist vajavaid otsinguvihjeid

**Failidest nähtav:** META `description` nimetab muu hulgas „infootsingu ja enesejuhitud õppe toetamist”. PDF-i nähtavad põhiosad käsitlevad dokumenteerimist ja otsustamist (alates lk 3), vaimse tervise teenuseid ning hooldust (alates lk 5), andmepõhiste otsuste väärtusvalikuid (alates lk 8) ja tehnoloogia kujundust (lk 12).

**Auditi tähelepanek:** selle faili läbivaatamisel ei leitud selget lõiku, mis toetaks just „enesejuhitud õppe toetamist” artikli eraldi käsitlusena. See pole kogu kirjelduse automaatne vääraks tunnistamine. Pelk sõna puudumine ei ole üldine semantilise kontrolli meetod.

**Ülekandereegel:** säilita vana kirjeldus muutmata ja märgi selle allikaline kontroll tegemata. Kasuta kirjeldust üksnes otsinguabina, mitte tõendusväitena. Uuendatud kirjeldus nõuab eraldi päritolu ja ülevaatust. Vastamismudel ei tohi seletada „artikli soovitatud enesejuhitud õppe meetodit” ainult vana kirjelduse põhjal.

## 6. Viidete loetelu sisu ei ole selles PDF-is nähtav

**Failidest nähtav:** lehel 13 on „Viidatud allikad” pealkiri paremale suunatud noolega, kuid selle all ei ole bibliograafilist loetelu. Artikli põhitekstis on autor-aasta viited ja mõned veebilingid. Puuduv loetelu ei tähenda, et algsel veebilehel viiteid ei oleks.

**Ülekandereegel:** salvesta selle faili kohta `reference_list_state=not_visible_in_supplied_asset` ning `in_text_citations_present=true`. Tekstisisene viide ei loo süsteemi automaatselt välist täistekstiallikat. Puuduv bibliograafia ei pea blokeerima artikli oma teksti kasutamist, kuid piirab täpsete algviidete väljastamist.

**Test:** täielikku viidete loendit või puuduvat DOI-d ei rekonstrueerita mudeli mälust. Veebist võimaliku täielikuma versiooni toomine oleks eraldi lubatud ingest'i töö.

## 7. Puhastamine peab säilitama päritolu

**Failidest nähtav:** päistes korduvad printimisaeg ja pealkiri; jalustes URL ning leheküljenumber. Lehel 1 on illustratiivne foto ja selle link. Tekstis on korduva sisuga esiletõstetud tsitaate.

**Ülekandereegel:** korduvat paigutusmüra ei pea embedding-tekstis hoidma, kuid originaal ja eemaldamise jälg säilivad. Allika URL jääb päritoluandmetesse. Foto tuvastamine või inimese visuaalne identifitseerimine ei ole ingest'i eesmärk; autor on kirjas tekstis lehel 2 ja META `authors` väljal.

**Test:** puhastatud tekst ei koosne korduvatest prindipäistest; samas on võimalik iga alles jäänud allikakoht originaalis avada. Katkise sõnapoolituse parandamine peab säilitama seose algse kirjapildiga.

## 8. Aktiivsus, ajalugu, auditoorium ja õigused

**Failidest nähtav:** META sisaldab korraga `source_status=active`, `historical=true` ja `audience=BOTH`.

**Ülekandereegel:** need väärtused säilivad. Ajalooline artikkel võib olla aktiivses teadmistekogus täiesti kasutatav. `active` ei tähenda, et kõik artiklis kirjeldatud teenused ja praktikad on täna muutumatult kasutusel. `BOTH` kirjeldab kavandatud lugejat, mitte õigust kogu faili kõigile või teisele kliendile avaldada.

## 9. Näidis ei ole kogu ingest'i tõend

ÜLEVAADE käsitleb eri liiki materjale ja registrikirjeid, kuid nende täielikke algfaile pole selles paketis. META ja PDF annavad ühe ajakirjaartikli esmase ingest'i katse. KOV-i tegelike teenusereeglite, mahukate tabelite, skannitud dokumentide ja kümne aasta korpuse jaoks on vaja täiendavaid allikaid või eraldi märgistatud tehnilisi testifaile.

Artiklis nimetatud rahvusvahelised süsteemid on selle artikli kirjeldatud näited. Audit ei kontrolli nende praegust olemasolu, omadusi ega tulemusnäitajaid. Vastusetestides kasutatakse sõnastust „artikli järgi”, mitte uut välismaailma faktikinnitust.

## Väljade esialgne ülekandekaart

Alljärgnevad sihtväljad on ettepanekud. Codex peab need realiseerima versioonitud skeemi ja masinloetava päritolukaardina, säilitades algse JSON-i.

| Sisend | Sihtesitus | Tingimus |
| --- | --- | --- |
| `document_id` | artikli välis-ID, sisemise ID vastendus | unikaalsus kliendi ja dokumendiliigi ulatuses |
| `docId` | algne tunnus; väljaande/ajakirjanumbri seose kandidaat | mitte üksinda artikli unikaalvõti |
| `articleId`, `source_id` | nimelised välised identifikaatorid | mitte vaikimisi sünonüümid |
| `title`, `authors`, `journalTitle`, `issueLabel` | dokumendi bibliograafilised väljad | kinnita PDF-i olemasolevate kohtadega |
| `year` + PDF lk 1 | `publication_date` ja tuletatud avaldamisaasta | päevakuupäeva alus on PDF, mitte üldine aastaväli |
| `last_checked` | imporditud kontrollimismärge | uut kontrolli ei väideta |
| PDF tehniline CreationDate | `asset_created_at` | dokumendi loomisaeg, mitte artikli ilmumine |
| `source_type`, `authority` | allikaliik ja imporditud autoriteediroll | roll pole õigsusprotsent |
| `section` + PDF `Uurimus/analüüs` | eraldi teema/algväli ja allika rubriigisilt | väldi tähenduste kokkusurumist |
| `pdf_start_page`, `pdf_end_page` | sisendfaili lehevahemik | üksiklõigu asukoht arvutatakse eraldi |
| `description`, `tags` | pärandatud otsinguabid koos päritolu ja ülevaatusseisuga | mitte iseseisev tõendusmaterjal |
| `historical`, `source_status` | eraldi sisukogu tunnused | pole jõustumise või tänase kehtivuse tõend |
| `audience`, `language`, `collection_id` | auditoorium, keel, kogu | auditoorium ei ole ACL |
| `source_path` | lähtefaili lahendatav asukohaviide | piiratud lubatud sisendjuurega |
| PDF-i algallika URL | päritolu URL + allikakoht | ei tähenda praeguse veebisisu kontrollimist |
| kõik muud sisendväljad | `legacy_metadata` | kadudeta säilitamine |

## Esimese vastuvõtu sisuline kontroll

M1 on valmis, kui normaliseeritud andmed ja allikakohad on kasutatavad ilma generatiivse mudelita, hoiatuste põhjused on nähtavad ja samade failide korduv töötlus ei tekita duplikaate. Selle auditi eduka realiseerimise põhjal ei tohi veel väita, et uus RAG või graaf annab paremaid lõppvastuseid.
