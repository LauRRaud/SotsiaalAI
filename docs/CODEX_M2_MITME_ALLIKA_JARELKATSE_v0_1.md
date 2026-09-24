# Codexi jätkuülesanne: M2 mitme allika kvaliteedikatse

Versioon: 0.1  
Koostatud: 05.09.2026  
Seis: uus tööettepanek pärast M0–M2.2 piiratud vastuvõttu; pole käivitatud.  
Ulatus: senise otsingu hindamine mitme pärisallika seas ja lõppartefaktide päritolu korrastamine. See ei ole M2.2 algse piloodi kordamine ega M3/M4 teostamise luba.

## 1. Eesmärk ja kehtiv juhtimine

M0–M2.2 jääb lõpetatuks selle dokumenteeritud ulatuses. Järgnev katse lisab teise küsimuse: kas vajalik allikakoht leitakse ka siis, kui lubatud kogus on mitu sarnase sisuga dokumenti, mitte ainult üks artikkel?

Aktiivse töö autoriteet on repositooriumi `SotsiaalAI.md` S1.0. Loe see koos tegeliku tööpuu, kehtivate juhiste ja ADR-idega enne muutmist. Käesolev fail on ülesande sisend, mitte uus konkureeriv seisufail. Kui S1.0 on juba edenenud, ära taasta vanemat tööjärjekorda; kirjelda erinevus ja järgi omaniku kehtivat otsust.

Ära kirjuta ümber töötavat ingest'i, PostgreSQL-i/Qdranti adaptereid, indeksipõlvkondi, õiguste kontrolli, kanoonilisi viiteid ega väljasaatmise päevikut ilma konkreetse tõendatud vajaduseta. Ära lisa agente, uut tasulist otsinguteenust, mudelipõhist hindajat ega automaatset reegligraafi eraldamist.

## 2. Lähteandmed ja nende tõendiulatus

Ülesande alus on järgmised omaniku esitatud failid:

- `rag-v2-m2-2-audit-2026-09-05.md`: jaotised „Järeldus”, „Pärisembedding'u piloot”, „Auditist leitud ja parandatud vead”, „Kontrollid” ja „Alles olevad piirid ja järgmine töö”.
- `rag-susteem-master.md`: „Etappide seis”, „Mis praegu päriselt töötab” ja „Järgmine samm”.
- `pilot-report.html`: ühe artikli 36 meetodirea piloodiraport.
- `report.md`: varasema lähte-SHA turvaskanni muutmatu raport, mitte parandatud tööpuu uus skann.

Lõppaudit kirjeldab 25 edukat embedding-katset, 12 420 sisendtokenit, arvestuslikku kulu 0,001614600 USD ja null genereerivat kutset. See on usage'i ja lukustatud hinnakirje arvutus, mitte arve kinnitus. Kuus sisuküsimust on kahe küsimuseperekonna ET/EN/RU variandid. Leksikaalne kanal kattis 4/6, vektor- ja hübriidkanal 6/6. Hübriidi vajalik tugi oli juba top-1-s; struktuurse laienduse lisakasu selle valimiga ei tõendatud.

Lõppaudit raporteerib 57/0/0 testi nii lokaalselt kui serveris. Neid ei liideta 114 sõltumatuks sisuliseks kvaliteedinäiteks. Paranduste commit on auditile tuginedes `682d2a6e4`; omanik raporteeris lõppcommit'iks `86bb0d1e7`. Kontrolli tegelikke SHA-sid repositooriumis; selle ülesande koostamisel koodi ega serverit ei kontrollitud.

## 3. Esimene töö: lõppartefaktide päritolu kontroll

### 3.1. Piloodi HTML ja praegune kompaktne esitus

Lisatud `pilot-report.html` sisaldab 36 meetodirida; 34 mittetühjas kontekstis on allikaväljad veel skeemi `rag-v2/model-context-json-1` paljaste väärtustena. Näiteks `authority`, `historical` ja `source_status` pole seal koos välja päritolu ja `review_state` seisundiga. Lõppaudit kirjeldab juba täiendatud esitust, kus mudelile antavatel allikatunnustel on väärtus, päritolu ja ülevaatuse seis.

See on artefaktide vastavuse kontrollikoht, mitte tõendatud uus viga parandatud koodis.

Kontrolli, millisest koodi- ja indeksiversioonist HTML pärineb. Hoia vana raport ajaloolise tõendina alles. Loo praegusest parandatud koodist uus selgelt märgistatud raport või eraldi lõppkontrolli väljavõte. Kasuta olemasolevaid salvestatud vektoreid ja olemasolevat luba ainult selle kehtivas kohalikus taaskasutusulatuses; uut välist kutset pole pelgaks rapordi taastootmiseks vaja.

Märgi uuele raportile vähemalt käivituse ID, koodi-SHA, dirty-tööpuu seis, korpuse/indeksipõlvkonna ID, konfiguratsiooni ja hindamiskogu räsi, väljundskeemi versioon ning ajamärge. Ära kasuta räsisid salajaste väärtuste või algteksti avaldamise ettekäändena.

1788 tokenit on lõppauditisse märgitud konkreetse varasema valiku uus esitus, mitte kõigi piloodipäringute eeldatav maht. Mõõda iga tegelik serialiseeritud kontekst uuesti. Ära muuda teksti üksnes varasema tokeniarvu kordamiseks.

### 3.2. Turvaskanni ajalooline ja lõplik seis

Ära kirjuta `report.md` algseid leide tagantjärele olematuks. Raport nimetab oma katvust `partial` ning lõpus on veel „Needs follow-up” ja `baseline-04`…`baseline-07` kirjed. Kontrolli skanni algartefaktidest ja lõppauditist, milline otsus igale lahtisele kirjele tegelikult tehti.

Lisa vajaduse korral olemasoleva lõppauditi juurde lühike vastendustabel: algne kirje → parandatud / põhjendatult mitteaktuaalne praeguses CLI-ulatuse ohumudelis / M4 jaoks edasi lükatud / lahendamata → tõend. Ära märgi kirjet suletuks üksnes rohelise üldtesti või selle ülesande teksti põhjal.

See ei nõua automaatselt uut tasulist skanni ega kogu projekti uuesti auditeerimist. HTTP-autentimine, allika avamine, mudelile väljasaatmine ja kasutajaõigused vajavad M4-s oma kontrolli, sest ohumudel muutub.

## 4. Korpus: väike, päris ja kinnitatud

Vali omaniku määratud olemasolevast materjalijuurest esimeseks järelkatseks ligikaudu 6–10 dokumenti kokku. Arv on töömahu siht, mitte statistilise piisavuse tõend ega kohustus luua puuduvad failid ise.

Valimis peab säilima senine artikkel ning võimaluse korral olema mitu sarnase teemaga, kuid erineva järelduse või kitsama ulatusega artiklit, üks kõrvalteema ja vähemalt üks sama ajakirjanumbri teine artikkel identiteedi eristamiseks. Piirkondliku teenuse või juhendi võib lisada ainult siis, kui sobiv pärismaterjal ja vajalik töötlus on olemas; selle puudumine märgitakse M3 sisendivajadusena.

Inventuuri tegemine või faili lokaalne lugemine ei võrdu välise mudeliteenuse kasutusloaga. Ära taasta vana registri kõiki kirjeid aktiivsesse otsingusse. Ära skanni kogu serverit ega kasutajate vestlusi. Piirdu omaniku lubatud materjalijuure ja dokumentidega.

Koosta korpusemanifest: algfailid, räsid, identiteedid, materjaliroll, võimaliku kordustrüki/duplikaadi seos, kasutuspiirid, parseri hoiatused ja allikakohad. Ära esita ühe artikli eri ekspordikoopiaid sõltumatute allikatena.

Uue parseripaigutuse tõrge tuleb eraldi nähtavale. Tabelit, OCR-i või mitmeveerulist faili ei tohi vaikselt lihtsa teksti kvaliteeditõendina sisse lugeda. Ära lisa üldist uut parserisüsteemi enne, kui valitud korpuse vajadus on selge.

Puuduvate materjalide korral lõpeta kohalik hindamistaristu ja väljasta täpne sisendivajadus. Ära asenda päriskorpust mudeli väljamõeldud artiklitega.

## 5. Hindamisküsimused

Alustamise siht on 12–20 sisuliselt erinevat küsimuseperekonda, mitte 12–20 sama küsimuse ümberütlemist. Säilita vana üheksa küsimusega komplekt eraldi regressioonina. Uued küsimused katavad ka algse artikli seni hindamata peatükke.

Vähemalt valitud perekondadel peavad olema ET/EN/RU variandid. Loe tulemusi nii perekondade kui keelte kaupa: ühe küsimuse kolm tõlget ei ole kolm sõltumatut sisulist ülesannet.

Kaasa järgmised olukorrad:

- täpne nimi või termin ning sama infovajadus inimese vabas sõnastuses;
- sarnase sõnastusega vale dokument ja õige dokumendi eristamine;
- ühe küsimuse jaoks vajalikud mitu algtekstikohta;
- vähemalt üks loomulikult kahte dokumenti vajav küsimus, kui valik sellist toetab;
- küsimus, mille vastus on olemas ainult osaliselt;
- küsimus, mille jaoks lubatud korpuses vajalik alus puudub;
- bibliograafiline küsimus ning vajaduse korral ajaliselt/piirkondlikult sobimatu allika eristamine.

Ära sunni kõiki vastuseta küsimusi „otsing peab tagastama null kirjet” testiks. Kandidaatide leidmine ja sisuline vastatavus on eri asjad.

Koosta vajalikud tõendigrupid algallikast enne hindamisjooksu. Igal grupil on dokument, versioon, asukoht ja lühike kirjeldus, mida see toetab. Lubatud alternatiivne allikakoht tuleb arvesse võtta, mitte lugeda õigeks ainult üht juhuslikku tekstifragmendi ID-d. Kahtlane tõlgendus märgi inimese ülevaatust vajavaks.

Jaga perekonnad arendus- ja kontrollosaks. Sama perekonna tõlked ja väga lähedased ümberütlemised peavad jääma samale poolele. Ära kohanda järjestust kontrollosa tulemuste põhjal ja jätka selle nimetamist puutumatuks kontrolliks. Iga seadeparandus ja testikogumi versioon tuleb nähtavalt talletada.

## 6. Välista vastuste etteandmine otsingule

Oodatud tõendigrupid, vastatavuse sildid, õige dokumendi ID-d ja leheankrud kuuluvad hindajasse, mitte päringuplaneerijasse, järjestajasse ega embedding-sisendisse.

Üldise päringu korral otsitakse kogu sellele testkasutajale lubatud valimist. Õiget dokumenti ei tohi märkamatult eelfiltriks seada. Kui kasutaja on ülesandes sõnaselgelt valinud artikli, käsitle seda eraldi artiklipiiranguga testiklassina.

Olemasolev `required_evidence_absent_by_dataset` on hindamiskogu teadmine. See ei tähenda, et runtime on õppinud ära tundma kõiki ebapiisavaid vastamisolukordi. Ära vii seda silti tootmisloogikasse küsimuse ID või täpse teksti vastendamisega.

Tuuma testid võivad kasutada selgelt märgistatud sünteetilisi õiguste-, riknemise- ja ressursinäiteid. Neid ei lisata pärisallikate kvaliteediprotsenti.

## 7. Võrdlus ja mõõtmine

Säilita neli senist rada: leksikaalne, pärisvektor, hübriid RRF ning hübriid koos piiratud struktuurse laiendusega. Ära lisa selles plokis uut ümberjärjestajat ega generaatorit.

Kasuta samade sisendite jaoks samu salvestatud vektoreid, sama õiguste- ja põlvkonnapilti ning võrreldavat lõppkonteksti tokeni- ja ühikueelarvet. Märgi struktuurse raja seemnete ja lisanduste tegelik jaotus; laiendusel peab olema katses võimalus mõjuda. Ära anna graafile vaikimisi suuremat lõppkonteksti ega nimeta sellest tulenevat vahet algoritmi puhtaks kasuks.

Iga küsimuse juures näita vähemalt:

| Mõõdik | Tähendus |
| --- | --- |
| Vajalik tugi toorkandidaatides ja top-1/3/5-s | Eristab leidmata jäämist halvasti järjestamisest. |
| Vajalikud tõendigrupid lõppkontekstis | Eristab järjestust konteksti valiku ja mahupiiride mõjust. |
| Täielik / osaline / puuduv tugi | Hindamiskogu suhtes, mitte universaalne runtime-tõde. |
| Valitud allikad ja eksitavad kandidaadid | Näitab vale dokumendi ning liigse kõrvalise teksti mõju. |
| Konteksti tegelikud tokenid | Kaasa arvatud vajalik päritolu ja piirangud, mitte ainult paljas algtekst. |
| Struktuurse laienduse lisatud ja välja tõrjutud ühikud | Lisakasu, mõju puudumine ja võimalik kahju on eraldi. |
| Päringuetappide kestused | Erista embedding'u võrgukulu ja lokaalne otsing; soe/külm režiim märgitakse. |
| Kulupäevik | Uued katsed, taaskasutatud sisendid, tegelik usage, arvutuslik kulu ja teadmata tulemused. |

Väikese juhtumikogumi ajamõõtmisi ei nimetata tootmise p95 ega koormustõendiks. Kui tehakse kordusmõõtmisi, raporteeri meetod ja valimi suurus.

## 8. Väljasaatmine ja kulu

Kasuta olemasolevat kinnitatud adapterit, sisendimanifesti ja püsivat päevikut. Ära ehita kõrvalist API-kutsujat. Senise piloodi 25 katse, 12 420 tokeni ja 0,05 USD luba ei laiene uutele tekstidele, küsimustele ega mudelitele.

Kõigepealt tee uus kuivjooks: uued sisendid, vahemälust taaskasutatavad sisendid, sisendite räsid, tegelikud tokenid, kinnitatud mudel ja mõõtmed, katsete piir ning ajakohase kinnitatud hinnakirje põhine kuluhinnang. Mudeli- või hinnaväärtusi ei võeta selle faili näidisarvutusest uue jooksu automaatseks autoriteediks.

Ära küsi kordusluba ainult kohalikuks juba lubatud vektorite taaskasutuseks; kontrolli olemasoleva loa ja õiguste tegelikku ulatust. Uuele väljasaatmisele on vaja omaniku luba ühe selge manifesti ning piiriga, mitte eraldi käsitsi kinnitust iga tekstiosa jaoks.

Loa puudumisel lõpeta kohaliku hindamise tehniline valmisolek ja peatu enne uusi väliskutseid. Keelatud on vaikne uus saatmine muudetud sisendiga, automaatsed korduskatsed väljaspool luba ning lõpmatu kulu nullhinnanguga jätkamine.

## 9. M3 ja M4 ettevalmistus ilma ulatuse kasvatamiseta

M3 jaoks koosta ainult väike allikakohaga kandidaadiloend, kui pärismaterjalides on selged tingimused või erandid. Ära nimeta teemalist sarnasust `REQUIRES` või `EXCEPTION_TO` seoseks. Märgi, millised seosed on inimese kontrollita, millised on õigel alusdokumendil ning milline vajalik allikas puudub. Ära kodeeri kogu artiklit teenuseõiguse reeglistikuks.

Semantilist graafimootorit selles töövoorus ei implementeerita. Kui see on järgmine kokkulepitud töö, koostame selle jaoks eraldi, piiratud M3 ülesande.

RAG master näeb mitme allika järelkatse järel ette M4 ühenduse. See võimaldab hiljem piiratud artiklivastuste sisemist pilooti ilma täieliku teenuseõiguste graafita. See ei luba esitada veel tõendamata tingimusotsuseid ega avada kõiki kasutajaradu korraga.

Selles plokis jäävad `/api/chat` genereerimine ja admini kasutajapõhine vastamisrada suletuks. Ära lisa Lunat, avalikku otsingu-API-t, HTTP-autentimist ega mitme kliendi teenust kõrvalülesandena.

## 10. Vastuvõtt ja peatamiskoht

Järelkatse teostus on üleandmiseks valmis, kui:

1. Vana piloodi ja turvaparanduste tõendid on versiooniliselt eristatavad; lahendamata küsimused pole kustutatud ega varjatult suletud.
2. Uue päriskorpuse manifest, küsimuseperekonnad ja tõendigrupid on olemas või konkreetne puuduv sisend on dokumenteeritud.
3. Otsing töötab tegelikus mitme dokumendi ulatuses, mitte oodatud vastuste järgi eelfiltreerituna.
4. Kõik neli rada kasutavad võrreldavaid eelarveid ning hindamissildid ei mõjuta otsingut.
5. Senine regressioon on kontrollitud ja uued funktsionaalsed testid esitatud pass/fail/skip kaupa. Vigaste viidete, õiguste või põlvkondade probleem ei tohi taanduda „väiksemaks otsingutäpsuseks”.
6. Lubatud päriskatse korral on juhtumipõhine tulemuste aruanne ja kulupäevik valmis. Loa või sisendite puudumisel on seis ausalt „ettevalmistatud, käivitamata”.
7. Iga sisuline puudujääk on liigitatud: allikas puudub / parser või metaandmed / kandidaat jäi leidmata / järjestus / konteksti valik / hindamisankru probleem. Kehtiva normi või tegeliku teenuseolukorra kontrolli ei väideta artiklipiloodi põhjal.

Ära nõua raporti lõpetamiseks kunstlikku 100% tulemust ega eemalda raskeid küsimusi. Raport esitab tegelikud tulemused; omaniku ülevaatus otsustab, millised puudujäägid tuleb enne kitsast M4 pilooti parandada. Turva- ja andmetervikluse rikked on eraldi tõkestavad vead.

Töö lõpus väljasta muudatuste kokkuvõte, tegelikud SHA-d ja diff, kohalike kontrollide tulemused, privaatsete raportite asukohad, korpuse- ja hindamiskogu versioonid, kasutus/kulu ning põhjendatud järgmise töö ettepanek. Ära tee push'i, serveripaigaldust, massindekseerimist ega vanade teenuste käivitamist ilma selleks eraldi antud töökorralduseta.

## 11. Codexile kopeeritav algusjuhis

```text
Loe kehtivat SotsiaalAI.md S1.0, RAG masterit, M0–M2.2
lõppauditit ja CODEX_M2_MITME_ALLIKA_JARELKATSE_v0_1.md.

M0–M2.2 on dokumenteeritud ulatuses lõpetatud. Ära alusta
seda uuesti. Teosta uus mitme allika kvaliteedikatse:
korrasta lõppartefaktide päritolu, koosta lubatud pärisallikate
valim ja küsimuseperekonnad ning käivita neli võrreldavat
otsingurada olemasoleva hindamistaristu kaudu.

Hoia oodatud allikad ja vastatavuse sildid otsingust lahus.
Uued embedding-kutsed nõuavad uut manifesti ja omaniku luba;
loa puudumisel lõpeta ettevalmistus väliskutseteta.

Ära lisa Lunat, agente, semantilise graafi runtime'i ega
avalikku API-t. M3 jaoks koosta ainult kontrollitavate
sõltuvuste kandidaadid. Ära muuda omaniku muud tööd.

Esita tegelikud tulemused ja piirid. Peatu pärast raportit,
enne M3/M4 teostust, push'i või tootmispaigaldust, kui selleks
pole eraldi kinnitatud töökorraldust.
```
