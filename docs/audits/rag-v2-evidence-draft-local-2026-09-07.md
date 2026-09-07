# M4 tõendiga seotud mustand: kohalik katsekandidaat

07.09.2026. Üks vaikimisi väljas kandidaat on valmis kohaliku võrdluse ettevalmistuseks. V3 baasleping, prompt, esitus, otsinguprofiil, korpus, mudel ja ajaloolised vastused säilivad. Välismudelikutseid, push'i ja deploy'd selles voorus ei tehtud. Katse ei tõenda kandidaadi sisulist paremust.

## Teostus ja kontrolli piir

Uus `lib/rag-v2/pilot/evidence-draft.js` lisab privaatse lepingu `m4-evidence-draft-1` ja juhise `m4-evidence-first-1`. Olemasolevat `PilotService` rada kasutav adapter rakendub ainult serveri konfiguratsiooni täpse `evidenceDraftVersion` väärtusega. Välja puudumisel kasutatakse senist v3 päringut. Pärisrežiimis peab uus kinnitatud plaan siduma ka kandidaadi skeemiräsi ja promptiversiooni; varasema plaani heakskiitu ei saa selleks kasutada.

Iga privaatne plokk sisaldab enne teksti `evidence: [{ref, quote}]`, seejärel nähtavat `text`, `factual` ja `refs`. Kuni viis tõendiosa võivad toetada üht sünteesi. Server kontrollib viite sama tenant'i, päringut, põlvkonda, dokumendiversiooni, algteksti räsi ja kanoonilist allikakohta. Täpne väljavõte peab esinema just mudelile antud selle viite tekstis; lõppviidete hulk peab vastama tõendiosade viidetele. Väljavõtet ei otsita muust korpusest ega parandata automaatselt.

Tühimärke ei normaliseerita. Asukoht on muutmata `source_text` UTF-16 poolavatud vahemik. Kui väljavõte esineb korduvalt, peatatakse vastus koodiga `evidence_excerpt_ambiguous`, mitte ei leiutata täpset asukohta. Piirid: kuni 12 plokki, 5 tõendiosa plokis, 1200 UTF-16 ühikut väljavõttes ja 32 768 UTF-8 baiti kogu privaatse väljundi kohta. V3 olemasolevad teksti-, viite- ja kind-piirid kehtivad edasi. Väljundtokenite lage ei tõsteta.

Enne saatmist säilib täpne keha ja kandidaadi versioon; provider'i vastus säilib olemasolevas piiratud `responseAudit` kirjes ka vea korral. Edukal projitseerimisel salvestatakse `evidenceDraftAudit`: algteksti asukohad, viitekaart, paketi/mustandi/projektsiooni räsid ning eraldi `sourceBinding=pass`, `semanticSupport=not_evaluated`. Avalikuks vastuseks jääb ainult v3 kuju. Taastamine ja avaldamistõrkest taastumine kontrollivad privaatse mustandi ning avaliku projektsiooni seost uuesti. Õiguste, aegumise, kustutamise, hilise kirjutuse ja kulureservi reeglid on samad.

**Täpselt esinev tsitaat ei tõenda parafraasi.** Näidis „The goal is to open a centre.” koos väitega „The centre opened.” läbib allikaseose, kuid käsitsi sisuline hinnang on `semantic_support=fail`. Samuti võib „Service is not guaranteed.” seest võetud täpne lõpp „guaranteed.” tehniliselt sobida, kuigi eitus kaob ja vastuse järeldus on vale. Sõna „not” eemaldamisega võltsitud terviklause tõrjutakse; tähendust muutva, kuid täpse alamlõigu valik ei ole selle kontrolli abil lahendatud.

## Kolm tegelikku regressiooninäidet

06.09 kell 16:02 UTC kontrolliti lubatud kohaliku v3 pärisjooksu algväljundeid ja pakette. Sisendfaili SHA-256: `4b93745b24ffd800fb201657c16aa4f82308c44cf7d58b0aa1e89ade9b3ca056`. Fail säilis muutmata. [Privaatne tõendivõrdlus](../../tmp/rag-v2-m4-evidence-experiment/regressions.json) sisaldab täpset algteksti, algset väljundiosa ja viiteid, seotud allikateksti, kitsamat näidet, lähedast lubamatut näidet ning hinnangu päritolu.

| Leiuliik | Algse väljundi koht | Sisuline eristus |
| --- | --- | --- |
| Eesmärk → toimunud sündmus | EN vastuse `blocks[1]`, S1/S3 | S3 kirjeldab eesmärki osapooled kokku tuua. Täpne eesmärgitsitaat sobib tehniliselt ka eksliku minevikuväitega; kitsam näidis säilitab eesmärgi. |
| Õiguslik ulatus | ET vastuse `blocks[2]`, S2/S4/S5 | Artikli eesmärki ja analüüsi saab kirjeldada; sellest üksi ei tulene lai õigusjäreldus. Hinnang ei väida, et algne järeldus on päriselus vale või et artikkel ei võiks õigusnormi refereerida. |
| Allikafakt piiranguväljas | RU vastuse `limitations[0]`, väljundis viited puuduvad; asjakohane õppenäide S2-s | Teise õppenäite info on olemas, kuid pole selle vastuse jaoks vajalik. Kitsam näidis kirjeldab ainult ebapiisavat tõendit hinna määramiseks. |

Käsitsi loodud näidised ei ole uued Luna tulemused. Kõigil kolmel lähedasel vigasel näidisel võib allikaseos või v3 vorm olla korras, kuid sisuline näidisotsus jääb negatiivseks. Algseid nelja vastust ega nende ajaloolisi hinnanguid ei muudeta. Algandmete luba lõpeb 07.09 kell 08:00 UTC; uut luba ega varukoopiatest taastamist ei tehta.

## Kohalikud tõendid

56 eri sihttesti läbisid: 29 kandidaadi/tuuma/provider'i/esituse/konfiguratsiooni testi, 23 päris kohaliku DB püsistustesti, 2 ajaloolise taasesituse testi, 1 kanoonilise viite ja 1 tegeliku HTTP raja test. Lõpptulemus: PASS 56 / FAIL 0 / SKIP 0. Esimene kandidaadi integratsioonitest ebaõnnestus enne adapteri lisamist; hiljem läbis. Ühe asukohatesti käsitsi sisestatud pikkus parandati 27-lt 29-le, allikateksti ei muudetud.

Kaetud on võltsitud väljavõte, teise allika õige tekst, vale versioon/päring/tenant, mitmetähenduslik asukoht, muudetud eitus, mitu tõendiosa, osavastus/täpsustus/unsupported, mahuületus, püsistustõrge, õiguste tühistamine, aegumine ja idempotentsus. Avaliku projektsiooni muutmine privaatse mustandiga vastuollu peatab taastamise. V1/v2 ajalooline lugemine ja v3 baasfailide muutumatus kontrolliti eraldi.

Tegelikus localhosti tavavestluses avaldus täpse väljavõttega testvastus, võltsitud väljavõte peatus ja mõlemad pöörded taastusid refresh'il. Esimese vastuse S1 avas kanoonilise artiklikatkendi PDF lk 2–3; tagasipöördumine taastas sama vestluse. HTTP tõend kontrollis anonüümse/teise konto tõrjet, vale päritolu ja keha tõrjet, allikapiiri ning korduva võtme lõppseisu. Avalikus HTTP vastuses puudusid privaatne tsitaat, audit ja vigane mustand. Lugemine/korduspäring ei lisanud teenusekutset: lõpuks 2 testvastuse ja 2 test-embedding'u sündmust, 0 välismudelikutset ning 0 USD. [Kontrollikoond](../../tmp/rag-v2-m4-evidence-experiment/verification-summary.json), [HTTP tõend](../../tmp/rag-v2-m4-evidence-experiment/http-checks.json).

## Üks veel käivitamata võrdlusplaan

[Arvuliselt piiratud plaan](../../tmp/rag-v2-m4-evidence-experiment/comparison-plan.json) fikseerib 3 teadaolevat arendusregressiooni ja 4 uut küsimust: eesmärk/mõju, allika õiguslik roll, piirangu/allikafakti eristus ning tavaline piisava toega vastus. Nende tulemust pole genereeritud. Mõlemal variandil on samad küsimused ja paketid, ET/EN/RU jaotus 3/2/2. Tuntud korpus ja seotud teemad piiravad sõltumatust; seda ei nimetata üldiseks puutumatuks testiks ning tõlkeid ei loeta uuteks perekondadeks.

| Piir | Kavandatud väärtus |
| --- | ---: |
| V3 baasvariant | 7 vastamiskatset |
| Üks kandidaat | 7 vastamiskatset |
| Kokku | 14 vastamiskatset, kordusi 0 |
| Embedding | 0: võrdlus kasutab otse identseid fikseeritud pakette ega tee uut otsingut |
| Ühe vastuse sisendi/väljundi lagi | 64 000 / 2048 tokenit mõlemal variandil |
| Kogutokenite lagi | 924 672 |
| Täielik konservatiivne reserv | 0,2584064 USD |
| Kavandatud kogulagi | 0,27 USD |

Tegelike ettevalmistatud kehade konservatiivne reserv on 0,10321615 USD. Kandidaat lisab neis sisenditesse hinnanguliselt 249 tokenit. Üks käsitsi koostatud näidis annab 171 privaatse väljundi tokenit ja 40 nähtava projektsiooni tokenit: lisand 131. See ei ole pärismudeli keskmine kulu. Mõlemad variandid jagavad tõendiosa ja vastuse vahel sama 2048-tokenist väljundlage; mõõta tuleb ka poolelijäänud väljundeid ja põhisisu kadu. [Kandidaatskeem](../../tmp/rag-v2-m4-evidence-experiment/candidate-schema.json), [tegeliku päringukeha näidis](../../tmp/rag-v2-m4-evidence-experiment/example-body.json).

Plaanil puuduvad heakskiit ja uus tähtaeg ning see pole käivitatav. Hilisem fikseeritud pakettide võrdluse käivitaja ja kummagi variandi täpsed load tuleb enne päriskutseid kinnitada; seniseid ledgereid ei lähtestata. Kui soovitakse selle asemel UI kaudu uut otsingut, tuleb eraldi tõendada kehtiv küsimusevektori taaskasutus ja pakettide vastavus; puuduv vektor ei anna uut kutseluba. Hinnad on varasema plaani konservatiivne arvestusalus, mitte teenusepakkuja arve.

Sisulise hinnangu annab omanik või nimetatud hindaja pakettide ja varjatud variandinimedega väljundite põhjal. Mõõtmed: tõeväide/ulatus, määravad väljajätted, kasulik osavastus, põhjendamatu keeldumine, avaldamine, keel, viited, viivitus ja tokenikulu. Kandidaat jääb alles ainult mõõdetava eelise korral; praegu on otsus **kohalikult teostatav, sisuline kasu NOT_PROVEN, vaikimisi väljas**. V3 jääb baasvariandiks ja jätkuvestlus eraldi järgmise arenduse otsuseks.

## Lõppvärav 07.09

Lõplik muudetud failide eslint, i18n:check, git diff --check ja tootmisbuild läbisid. 07.09 build kompileerus 29,3 sekundiga ja lõppes koodiga 0. Katkestusele eelnenud build'i protsessivastus ei olnud enam kättesaadav, seetõttu korrati ainult tõendamata build'i lõppväravat; 56 testi ei korratud formaalselt. Prisma skeem ja migratsioonid ei muutunud. V3 contracts.js, presentation.js ja otsinguprofiili fail vastasid commit'i sisule. Teise akna muudatusi ei stage'itud ega saadetud serverisse.

## Omaniku tähtajamuudatus ja pärisvõrdluse ettevalmistus 07.09

Hilisem tulemus: allpool kirjeldatud paigaldusblokeering lahendati omaniku vastusega „tegutse”; lõplik pärisvõrdlus on raporti lõpus.

Omanik tühistas senise piloodi loa ja katseandmete tähtajapiiri ning palus alustada 7+7 pärisvõrdlust. Kohalik commit `4c7560f3ca47efa028ed577075966ce37401c534` lisab selgesõnalise `expiresAt=null` ja `retentionHours=null` toe ning M4 piloodikirje nullable aegumise migratsiooni. Üldine passiivsuskoristus ei kustuta tähtajata M4 kirjega vestlust; konto-, arhiivi-, kustutamis- ja katsepiirid säilivad. Vana tähtaeg ei ole enam omaniku kehtiv nõue. Olemasolevate serverikirjete tähtajad on seni tehniliselt muutmata, sest paigaldus jäi õiguste kontrolli taha.

Fikseeritud pakettide rada kontrollib kinnitatud manifestiräsi ja küsimuse identiteeti ning jätab embedding'u ja uue otsingu vahele. Kohalikud sihtkontrollid läbisid: 25 DB testi ning 8 loa/kandidaadi testi, eslint, Prisma skeemikontroll ja tootmisbuild (19,1 s kompileerimine, exit 0). [Baasvariandi ettevalmistatud plaan](../../tmp/rag-v2-m4-comparison-real/baseline-prepared.json) ja [kandidaadi plaan](../../tmp/rag-v2-m4-comparison-real/candidate-prepared.json) fikseerivad kummalegi 7 katset ja 0,135 USD, kokku 14 katset / 0,27 USD, uusi embedding'uid 0, tähtaegu pole. Küsimused ja paketid on sama varem külmutatud võrdluse omad.

Automaatne õiguste kontroll keeldus `origin/main` push'ist põhjendusega, et projekti juhis nõuab selle muudatuse jaoks omaniku selgesõnalist push-luba. Kohalik commit ja plaanid on valmis; push'i, paigaldust, serveri tähtajamuudatusi ega päriskutseid ei tehtud. Puuduv järgmine otsus on konkreetne luba selle commit'i push'iks ja paigaldamiseks; kinnitatud 7+7 katse ulatust uuesti avada pole vaja.

## Pärisvõrdlus 07.09: kandidaat jääb välja

Omaniku kinnituse järel jõudis GitHubi ja serverisse `5b9d0a233` (sisuline muudatus `4c7560f3c`). Serveri puhas tööpuu võimaldas tavalist deploy'd ilma `--discard-tracked` liputa. Serveri build läbis (30,6 s), nullable aegumise migratsioon rakendus ja frontend on aktiivne. 20 varasema M4 kirje ja nende kolme vestluse aegumine muudeti nulliks; tehingukontroll kinnitas sisu ning kululoendurite säilimise. Vana tähtajaga plaanifailid on ajaloolised tõendid, uued võrdlusload tähtajata.

Päris brauseris, omaniku olemasoleva seansiga ja tavalisel vestluslehel tehti täpselt seitse baas- ning seitse kandidaatvastamiskutset. Embedding'uid, uut otsingut ja korduskatseid oli 0. Kõigi 14 salvestatud paketi räsi vastas enne katset külmutatud paketile; enne aktiveerimist kontrolliti mõlema haru 35 viidet kanooniliste allikate vastu. Rakenduse räsi oli `c681bd9bde135f808e7e25573ceb82e03e6ee04864ad6c041304090461e4f2ca`.

| Mõõdik | V3 baas | Kandidaat |
|---|---:|---:|
| Avaldatud vastuseid | 7/7 | 0/7 |
| Sisendtokenid | 31 134 | 32 611 |
| Väljundtokenid | 2 101 | 3 350 |
| Mudelivastuse kestuse mediaan | 2,485 s | 3,655 s |
| Kasutuspõhine konservatiivne kuluhinnang | 0,01030470 USD | 0,01217275 USD |
| Püsiv kulureserveering | 0,05056245 USD | 0,05265370 USD |

Kasutuspõhine hinnang kokku on 0,02247745 USD, püsiv reserveering 0,10321615 USD ja kinnitatud piir 0,27 USD. Need on konservatiivsete ühikuhindadega arvutused, mitte arve. Kandidaat lisas 1477 sisendtokenit (211 igal kutsel) ja 1249 väljundtokenit; mudelivastuse mediaankestus kasvas ligikaudu 47%. Mõõdeti täieliku mudelivastuse saabumist, mitte kogu UI ooteaega.

Kõik seitse kandidaati lõppesid `answer_rejected / evidence_excerpt_not_found`. 22 tsitaadist 19 muutusid leitavaks diagnostilisel tühikute/reavahetuste ühtlustamisel, kolm ei kattunud ka siis: lisatud kolm punkti või muudetud sõnastus. Diagnostika ei muutnud kontrollireeglit ega avaldanud vastuseid tagantjärele. Täpse tsitaadi kontroll toimis, kuid mudeli tegelik väljund ei täitnud lepingut üheski juhtumis.

**Otsus: praegust kandidaati kasutusele ei võeta.** Avaldamise tingimus kukkus läbi nii kolmes teadaolevas kui neljas kontrolljuhtumis. Server lülitati tagasi tähtajata baasvõrdluse plaanile; mõlema haru seitsme kutse kvoot on täis. Baasi 7/7 avaldamine ei tõenda sisulist õigsust: nähtavates vastustes on endiselt kontrollimist vajavaid üldistusi, näiteks faktilehe „garanteerib” ja kohaliku kohustuslikkuse sõnastused. Kandidaadi semantiline paremus ning omaniku sõltumatu pimehindamine on NOT_PROVEN. Uut katset ega parandusringi ei lisatud.

Privaatsed tõendid: `tmp/rag-v2-m4-comparison-real/results.json`, `summary.json` ja `review.md`. Tulemuste dokumenteerimine ei muutnud koodi ega nõudnud uut build'i.
