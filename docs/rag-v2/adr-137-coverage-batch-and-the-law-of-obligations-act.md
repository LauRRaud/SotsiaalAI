# ADR-137: katvuse kaardi nõrgad read ja Võlaõigusseadus (korpus v76 ja v77)

Kuupäev: 10.10.2026. Teostus Claude Opus 5.5 (esimese osa nimekirja ja esimese lugemise tegi teine seanss; teise osa otsimine, uus lugemine, valik, Võlaõigusseadus, sisestus, eelkontrollid ja ost minult). Omanik 10.10.2026: „siin on nimekiri, kust sisu korjata, minu nõusolek on ka andmebaasi anda“, seejärel „vajadusel suurenda indeksi arv 15000 peale maksimaalselt rag süsteemis“ ja „kui vaja, siis suurenda ka lõikude arvu indeksis 150 000 peale“. Lae 0,35 USD võtsin tema nimekirjafaili hinnangu ülemisest otsast (0,20–0,35 USD). Seis: **mõlemad korpused on serveris töös (v76 11.10.2026 00:16, v77 00:22); otsing mõõdetud tasuta; vastuseid mudeliga ei ole mõõdetud.**

## Miks

Tasuta katvuse kaart (10.10.2026 hommikul: 294 lahtrist 219 piisavad, 55 õhukesed, 20 ainult seaduse või uuringuga) näitas, kus kogu on nõrk: töö kaotus, sissetulek ei kata elamist, noore käitumis- ja sõltuvusmure, eaka väärkohtlemine, elu lõpp, vanglast vabanemine ning spetsialisti tööteemad. Seadused on sees; puudu olid ametlikud juhislehed inimese vaates. Võlaõigusseadust ei olnud kogus üldse (üür, laenud, lepingud).

## Mis läks sisse

**564 veebilehte 16 saidilt** (477 012 sõna) ja **Võlaõigusseaduse kaks redaktsiooni** (2 × 1257 lõiku). Arvud on pärast järeltäiendust v77 (vt allpool).

| Väljaandja | Sait | Lehti | Sõnu | Teema |
|---|---|---:|---:|---|
| Tööinspektsioon | tooelu.ee | 65 | 107 243 | tööleping sõlmimisest lõppemiseni, töötasu, puhkus, vanemad ja alaealised, töövaidlus, tööstress, Töötukassa teenused |
| Tervise Arengu Instituut | narko.ee | 84 | 70 676 | ained, mõju, noortele, lähedastele, tarvitajatele, kust saab abi |
| Sotsiaalkindlustusamet | lasteabi.ee | 81 | 54 917 | lapsele ja lapsevanemale: vaimne tervis, kiusamine, vägivald, pere; artiklid |
| Sotsiaalkindlustusamet | sotsiaalkindlustusamet.ee | 44 | 41 529 | jaotis spetsialistile (juhtumikorraldus, pereteraapia, kinnise lasteasutuse teenus, MARAC, STAR, kvaliteedijuhised) ja varem puudunud lehed |
| Haridus- ja Noorteamet | teeviit.ee | 64 | 28 077 | noorele endale: vaimne tervis, sõltuvus, vägivald, raha, töö, iseseisev elu |
| Andmekaitse Inspektsioon | aki.ee | 28 | 40 451 | inimese õigused, andmetöötleja kohustused, vastused tervishoiu, kooli ja töösuhete kohta |
| Tervise Arengu Instituut | alkoinfo.ee | 78 | 37 717 | alkoholi mõju, kuidas vähendada, lähedasele, nõu ja abi |
| Terviseportaal | terviseportaal.ee | 29 | 36 813 | arstiabi, õendusabi ja hooldus, vaimne tervis, hüvitised, ravikindlustus |
| Sotsiaalministeerium | sm.ee | 36 | 31 666 | toiduabi, omavalitsuse ja riigi teenused, abivajav laps, vägivald, vaimne tervis, hooldereform, elulõpu tahteavaldus |
| Sotsiaalkindlustusamet | palunabi.ee | 15 | 7 733 | eaka väärkohtlemine, kelmus, lähisuhtevägivalla tõendid, enesetapumõtetega inimese toetamine |
| Tartu Ülikooli Kliinikum | kliinikum.ee | 14 | 7 128 | palliatiivravi ja hospiits, omastehooldus, lamatised, dementsus, sotsiaaltöötaja teenus |
| Tervise Arengu Instituut | tai.ee | 2 | 5 151 | ennetus |
| Tervisekassa | tervisekassa.ee | 5 | 4 012 | õendusabi kodus ja hooldekodus, taastusravi |
| Põhja-Eesti Regionaalhaigla | regionaalhaigla.ee | 6 | 1 941 | palliatiivravi, lähedasele |
| Eesti Toidupank | toidupank.ee | 12 | 1 628 | kuidas toiduabi saab, toidupangad piirkonniti |
| Eesti Sotsiaaltöö Assotsiatsioon | eswa.ee | 1 | 330 | eetika |

Nimekirjad: `Andmebaasi/register/web_pages_coverage_1.json` (255 lehte: narko.ee, alkoinfo.ee, lasteabi.ee, toidupank.ee) ja `web_pages_coverage_2.json` (309 lehte). Mõlemas on ainult need lehed, mis kogusse läksid, iga leht oma aadressiga.

**Võlaõigusseadus tervikuna** ([põhimõte](adr-111-state-level-help-first-batch.md): üldine õigusteema läheb sisse tervikuna): praegu kehtiv redaktsioon `120062026018` (01.09–31.12.2026) ja järgmine `111072026158` (01.01.2027–28.02.2029), et aastavahetusel auku ei tekiks. Kahe redaktsiooni 1257 lõigust erineb üks. 2029. aasta redaktsiooni ei võetud. Riigi Teataja lühend „VÕS“ on nüüd lühendite tabelis (`lib/rag-v2/search/act-abbreviations.json`).

## Kuidas lehed valiti

Lugemine: 734 lehte nimekirjades, 720 loetud, 14 duplikaati. Lugeja oli `rag-v2/web-page-2` ([ADR-132](adr-132-a-units-mailbox-is-not-a-persons-address.md)); esimene osa loeti selle reegliga uuesti.

Valik tehti sama reegliga nagu organisatsioonide lehtedel ([ADR-095](adr-095-web-pages-as-sources.md), `lib/rag-v2/web-select.js`): lõik, mis nimetab isikut, võetakse välja ja leht jääb; leht, mis on peamiselt isikutest, jääb välja tervikuna. 564 lehelt võeti välja 330 lõiku 196 lehel.

Välja jäi 156 loetud lehte:

| Põhjus | Lehti |
|---|---:|
| lasteabi käsiraamatu lehed (saidil ainult pealkiri) | 71 |
| alla 30 sõna (kestleht ilma tekstita) | 44 |
| peamiselt isikutest või ingliskeelne kirjandusloetelu | 32 |
| teavitamise ja tagasiside vormid | 5 |
| pealkiri nimetab isikut | 2 |
| liigi järgi (aadressis „uudised“) | 1 |
| koolituskuulutus lektorite nimedega (võeti välja v77-s) | 1 |

Pärast valikut kontrollitud (tulemus, mitte ainult reegel): lehtedes ei ole ühtegi sõnapaari, mille reegel loeks eesnime järgi isikuks; 91 e-posti aadressi on kõik asutuse üldaadressid; väljavõtmise märke ei ole; ühe lingi sihtkohas on @-märk ja see on pildipanga kasutajanimi.

Reegli sõnaloendisse lisati 33 sõnapaari, mida ta ekslikult isiku nimeks pidas (`NOT_PERSONS`: „Digiriigi Akadeemia“, „Ameerika Ühendriigid“, „Notarite Kojas“ jt); kõik vaadati ükshaaval üle ja nende seas ei ole ühtegi isikut. Eesnimede loendisse lisati üks puuduv eesnimi.

## Mida tulemuse ülevaatamine leidis (järeltäiendus v77)

Pärast v76 paki koostamist lugesin iga saidi lehtede algust ja lõppu ning otsisin kolme asja: sama algus paljudel lehtedel, initsiaaliga kirjutatud nimed ja kuulutuse tunnused.

- **Noorteinfo portaali kõigil 64 lehel oli sisu ees saidi teemamenüü** (umbes 200 sõna: „Õppimine ja haridus, Töö ja karjäär, Palk …“). Lugeja võttis sisuosaks ploki, kus menüü ja artikkel on kõrvuti. Iga lehe esimene lõik oleks vastanud menüü sõnadele. Nimekirjas on nüüd neil lehtedel sisuosa nimi (`region`), lehed loeti uuesti ja valiti uuesti: 42 984 sõna asemel 28 964, lõike 357 asemel 229.
- **Üks haigla leht oli möödunud päeva koolituskuulutus lektorite nimedega** (initsiaal ja perekonnanimi, mida reegel ei loe nimeks). See võeti poliitikast välja.
- **Üks autoririda** nimetas isikut, kelle eesnime loendis ei olnud; eesnimi lisati ja rida läks välja.
- Ülejäänud 501 lehte jäid uue valikuga bait-baidilt samaks.

Alles jäi teadlikult: toidupanga kaheksal piirkonnalehel on teksti ees piirkondade loend (lehed on väga lühikesed); kirjandusloetelude autorid Tervise Arengu Instituudi lehtedel (teose autorsus).

## Mida ei saanud lugeda

- **Vanglateenistus (vangla.ee):** iga aadress annab sama skriptiga laetava lehe. Vanglast vabanemise teema jäi sellest allikast katmata; ministeeriumi leht vangla ja kriminaalhoolduse kohta on kogus varasemast.
- **Töötukassa:** nagu enne ([ADR-111](adr-111-state-level-help-first-batch.md)). Töö kaotuse teema toetub nüüd Tööinspektsiooni lehtedele, sealhulgas lehele Töötukassa teenustest.
- **Lasteabi käsiraamat** (71 lehte): saidil on ainult pealkirjad, tekst laetakse skriptiga.
- **Sotsiaaltöö eetika käsiraamatu teemalehed** (eswa.ee, 7 lehte), **Tervisekassa infomaterjalid** (6) ja osa **kliinikumi patsiendiinfost** (7): lehel on ainult PDF-i link. PDF-e selles partiis ei võetud.
- **pallium.ee:** avalehel 75 sõna.

## Lugeja viga, mis tuli välja Võlaõigusseadusega

Seaduse 40. peatüki 3. jagu on kehtetu ja Riigi Teataja fail hoiab selle esimest ja viimast paragrahvi (§ 734 ja § 746) tühjade märkidena: number on, teksti ei ole. Lugeja tegi kummastki kirje ilma ühegi tekstireata ja kogu seadus peatus veaga `invalid_relation`. Nüüd jääb tühi paragrahv vahele nagu tervikuna kehtetu paragrahv (`lib/rag-v2/text-source.js`). Kontrollitud `rag-v2-reader-compare.mjs`-iga: 578 kogus olevat õigusakti loetakse täpselt nagu enne (0 erinevat, 0 uut vektorisisendit), nii et töötluse silt ei muutunud.

## Eelkontrollid ja ost

| | Enne | Pärast | Piir |
|---|---:|---:|---:|
| Dokumente indeksis | 8722 | 9289 (v76), 9288 (v77) | 10 000 |
| Lõike indeksis | 80 948 | 88 313 (v76), 88 181 (v77) | 100 000 |
| Vaba ketast serveris | 20 GB | 18 GB | |

Ühist silti partiil ei ole. Piire ei olnud vaja tõsta; järgmise partii jaoks on dokumentide ruumi 712.

| Käik | Sisendeid ostetud | Märke | Hind | Indeks | Dokumente | Lõike |
|---|---:|---:|---:|---|---:|---:|
| v76 | 6096 | 2 151 870 | 0,2797 USD | `2bfa1077` | 9289 | 88 313 |
| v77 | 72 | 30 487 | 0,0040 USD | `60b0ba23` | 9288 | 88 181 |
| **Kokku** | **6168** | | **0,2837 USD** | | | |

Serveri tasuta plaan näitas enne ostu täpselt kohalikku arvestust (6096 sisendit). v77 229 lõigust oli 157 juba v76-s ostetud. Vestlusplaan: `/etc/sotsiaalai/m4-corpus-chat-20261011a.json`. Järgmine alus: põhikausta `tmp/rag-v2-v76/v77/ship/policy.json` (9288 dokumenti).

## Mõõdetud pärast täiendust (tasuta, serveris)

**Katvuse kaart** (`scripts/rag-v2-coverage-map.mjs`, 294 lahtrit):

| | Enne (v74) | Pärast (v77) |
|---|---:|---:|
| piisav | 219 | 235 |
| õhuke | 55 | 48 |
| ainult seadus või uuring | 20 | 11 |

Read, mille pärast partii tehti (selgituse lõikude arv):

| Rida | Enne | Pärast |
|---|---:|---:|
| Sõltuvus | 6 | 123 |
| Laps on hädas | 11 | 56 |
| Sissetulek ei kata elamist | 2 | 19 |
| Noore käitumis- ja sõltuvusmure | 6 | 11 |
| Töö kaotus | 2 | 6 |
| Elu lõpp | 1 | 6 |
| Eaka väärkohtlemine | 1 | 3 |
| Vanglast vabanemine | 1 | 1 |
| Andmete jagamine ja STAR | 13 | 44 |
| Lastekaitse sammud | 8 | 24 |
| Eetika, töönõustamine, läbipõlemine | 6 | 12 |

Eaka väärkohtlemine jäi nõrgaks ja vanglast vabanemine ei muutunud. Spetsialisti teemadest ei muutunud kodukülastus ja abist keeldumine, võrgustikutöö ning tahtest olenematu abi.

**Otsinguvärav** (33 kontrollküsimust, võrdlus korpuse v75 alusega; sama koodiga oli 10.10 õhtul korpusel v75 tulemus 33/33 sama, nii et erinevus tuleb uuest sisust):

| | |
|---|---:|
| otsustav lõik kadus kandidaatide seast | 0 |
| otsustav lõik liikus tahapoole | 10 |
| otsustav lõik liikus ettepoole | 6 |
| muutus ainult kandidaatide koosseis | 17 |

Põhjus on üks: kaks uut lehte pealkirjaga „Toimetulekutoetus“ (Sotsiaalkindlustusameti juhis omavalitsustele, 57 lõiku, ja ministeeriumi leht, 17 lõiku) võtavad toimetulekutoetuse küsimustes kuni 17 kandidaadikohta 36-st. Sotsiaalhoolekande seaduse kohti jäi vähemaks (näiteks 10 → 6). Uute dokumentide käes on 33 küsimuse 1188 kohast 248, neist 152 nende kahe lehe käes. Suurim liikumine: „keeldumine ainult kodu pärast“ 6. kohalt 31. kohale.

Värav mõõdab otsingut, mitte vastust. Kas vastused rasketele toimetulekutoetuse küsimustele läksid paremaks või halvemaks, näitab ainult tasuline vastuste kontroll päris vestluse rajal (alus korpusel v74: 72 pöördest 71, 0,27 USD, [valmisoleku audit](../audits/rag-v2-readiness-2026-10-10.md)); seda ei ole tehtud.

**Mahu mõõtepink** (`w4/cap-bench2.mjs`, terve korpuse päring ilma vestluse kitsendusteta, sama mis [ADR-108](adr-108-index-capacity-100000-and-statistics.md) mõõtmisel):

| Lõike | Sõnaotsing, kaks teksti | Vektorotsing | Kataloog |
|---:|---|---:|---:|
| 68 408 (08.10) | 4,0 s ja 4,7 s | 200 ms | 48 ms |
| 80 948 (v75) | 4,4 s ja 5,5 s | 250 ms | 53 ms |
| 88 181 (v77) | 4,6 s ja 5,6 s | 255 ms | 56 ms |

Kasv on joonelähedane. Omanik lubas 10.10 vajadusel tõsta dokumentide piiri 15 000 ja lõikude piiri 150 000 peale; seda ei tehtud, sest partii mahtus ära. Sama joone järgi oleks sõnaotsing 150 000 lõigu juures umbes 60% aeglasem kui praegu.

**Otsingu aeg** samade küsimuste peal: mediaan 4778 ms → 5249 ms (10% rohkem; lõike on 9% rohkem). **Planeerija** ootab uuele põlvkonnale 9616 dokumenti, nii et aktiveerimise ANALYZE töötas. Uus võrdlusalus tänase koodi ja korpusega: serveris `gate-files/gate-baseline-v77.json`.

## Kus lehed on

Lehtede tekstid ei ole repos: valikureegel võtab neist lõike välja, aga igakuine ametlike lehtede uuendus ([ADR-116](adr-116-official-pages-monthly-refresh.md)) seda reeglit ei tunne ja asendaks koopia lugeja omaga. Tekstid on põhikausta `tmp/rag-v2-v76/sources/veebilehed` all ja registrid loetlevad need pealkirja ja aadressiga. Võlaõigusseaduse failid on repos (`Andmebaasi/oigusaktid`).

## Lahtine

- Need 564 lehte ei ole igakuises uuenduses. Uuendus peaks enne oskama valikureeglit.
- PDF-id, millele kestlehed viitavad (Tervisekassa infomaterjalid, eetika käsiraamat, lasteabi käsiraamat).
- Vanglast vabanemine ja Töötukassa (omaniku otsus: kas küsida neilt luba või andmeid).
- Omaniku otsustamata küsimused nimekirjafailist: tubakainfo.ee ja venekeelsed koopiad jäid välja.
- Mudeliga mõõtmata: kas vastused uusi lehti kasutavad.
