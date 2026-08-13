# SotsiaalAI — olemus, seis ja tulevik

STATUS: SINGLE SOURCE OF TRUTH. **See on projekti ainus elav fail.** Siin on korraga see,
mis platvorm on, kus ta täna on ja mis on tegemata. Konkureerivat seisu- ega
registrifaili ei looda.

Kõrval on [`ideed.md`](./ideed.md) — **tegemata teemade kontseptsioonid ja taust**: S4
ütleb, MIS on tegemata ja mis seda blokeerib, `ideed.md` ütleb, MIS ASI SEE ON. Sinna
lisandub ~130 analüüsi-, lepingu- ja auditifaili. Kõik need on detail ja tõend, mitte olek —
vastuolu korral kehtib see fail.

Rollijaotus, mida ei tohi segi ajada:

| Fail | Vastab küsimusele | Millal loetakse |
|---|---|---|
| `SotsiaalAI.md` S4 | mis on tegemata, mis blokeerib | iga kord |
| `ideed.md` | mis asi see on | üks kord, kui teemat alustatakse |
| `tXX-…-ulesanne.md` | kuidas see tehakse | kirjutatakse alustamisel |

**Kuidas fail on jaotatud:**

| Osa | Vastab küsimusele |
|---|---|
| **OSA I — SEIS JA TÖÖ** (S0–S6) | mis on olemas, mis on lahti, kuidas tööd tehakse |
| **OSA II — OLEMUS JA SUUND** (1–7) | mis me oleme, miks see oluline on, kuhu läheme |

---

# OSA I — SEIS JA TÖÖ

## S0. Kuidas seda faili lugeda ja kirjutada

**Fail on järjestatud TEEMA, mitte kuupäeva järgi.** Kronoloogiline kandevoog kolis
03.08.2026 välja. Ta ei kolinud teise faili — **ta elab gitis**, mis on kroonika õige koht:

```
git show db514ba0:"docs/platvormi arendus/SEIS.md"
```

Põhjus: ajajärjestuses ei saa fakti parandada,
saab ainult uue kande lisada, ja sama teema laguneb kümnesse kohta. Teemasektsiooni saab
parandada kohapeal.

**MAHUREEGEL (omanik 03.08).** Mahtu ei tohi võtta **teostuslugu** — SHA-ahelad,
merge-järjekorrad, mõõtmisprotokollid, väravate tulemused, „mis päeval mis parandati".
See kõik elab ajaloos ja analüüsifailides.

| Olek | Mida kirjutada |
|---|---|
| **TEHTUD** | **lõik või kaks: mida funktsioon inimese jaoks teeb** — kellele, mis lubadusega, mis piiriga. Kirjutatud nii, et sellest saab otse infolehe või hinnakirja funktsioonikirjelduse tekst. Teostuslugu EI. |
| **POOLIK** | üks rida „mis töötab" + **nimeliselt kõik lahtised sabad** |
| **TEGEMATA** | mis see on, mis seda blokeerib, mis selle avab |

Kui sektsioon kasvab, kontrolli esimesena, kas keegi on valmis töö kohta **ajalugu** tagasi
kirjutanud — kirjeldus tohib olla pikk, kroonika mitte.

**HÜLJATUD VARIANTE EI KIRJELDATA (omanik 03.08).** Siia ei kirjutata „mida ei tule",
„kaalusime, aga otsustasime teisiti" ega pargitud alternatiive. Kui mingi lahendusvariant
langeb ära, ta lihtsalt kaob — sektsioon kirjeldab seda, mis on, ja seda, mis tuleb. Erand
on ainult **tootepiir**, mille inimene või partner peab teadma (nt „AI ei hinda õigust
teenusele", „ei ole hädaabinumber") — see ei ole hüljatud variant, vaid lubadus.

**Muud reeglid.** Olekut kannab AINULT see fail. `ideed.md` (kontseptsioonid ja taust) ning
~130 analüüsi-, lepingu- ja auditifaili on detail ja tõend, mitte olek; vastuolu korral kehtib
see fail. Aktiivse sidusa ploki vaheetappe siia ei kirjutata: seis uuendatakse ühe korra ploki
lõpus või kohe siis, kui plokk jääb blokituna/pooleli maha.

### Osa I sektsioonid

| # | Sektsioon | Seis |
|---|---|---|
| **S0** | Kuidas lugeda + reeglid | ✅ |
| **S1** | Alus (main, väravad) | ✅ |
| **S2** | Pöörduja rada | ✅ |
| **S3** | Hääl ja multimodaalsus | ✅ |
| **S4** | **Kogu lahtine töö — täisnimekiri** | ✅ |
| **S5** | Spetsialisti rada | ✅ |
| **S6** | Professionaalne areng ja ühistegevus | ✅ |
| **S7** | Ruumid ja kõned | ✅ |
| **S8** | Organisatsioon ja partnerid | ✅ |
| **S9** | Platvormi alused | ✅ |
| **S10** | Avalik pind ja release | ✅ |
| **S11** | Töökord | ✅ |

**S4 on kogu lahtise töö täisnimekiri — sealt ei tohi ükski tegemata või poolik asi
puududa.** S2–S10 kirjeldavad valdkonna kaupa, mis on olemas ja mis on selle sees lahti;
tegemata tööriistad elavad ainult S4-s ja neid ei dubleerita.

---

## S1. Alus

### S1.0. Aktiivne tööots — loe uues aknas seda, mitte kogu S1

**Teenuspäeviku jätkuauditi `SOL-SLOG-J-01…07` on lõpetatud.** Kirje parandamine,
tühistamine, mustandi kustutamine ja owner-skoobitud ajalugu on nüüd päris kasutajateed;
suunamist saab parandada või teadlikult lõpetada ning jagatud PostgreSQL-i lukk sulgeb
end-vs-create võistluse. AI-abiga alustatud narratiivi päritolu säilib toimetamisel ning
revision/CAS peatab paralleelse vaikse ülekirjutuse. Andmekoopia hõlmab nüüd rolli- ja
omandipõhiselt Teenuspäevikut, konto kustutus tombstone'ib kõik identiteedipinnad samas
tehingus ning auditeeritud retention-worker koristab tähtaja järel sõltuvused ja failikoopiad.

**Organisatsioonide `SOL-ORG-18/19` on lõpetatud.** Konto kustutus järgib nüüd sama
lukustatud offboardingulepingut: viimane omanik ja elav töö peatuvad parandatava põhjusega,
ajalooline liikmesus säilib identiteedita ning inimese andmekoopia sisaldab tema enda
liikmesuse, õiguste, üksuste ja koha elutsüklit.

**Välitöö `SOL-FIELD-J-01…11` on lõpetatud.** Lahendamata seadmesisu blokeerib
sulgemise ja sulgemiseelsele sisule on auditeeritud recovery-import; serverimärkmed on
omanikule nähtavad ja päriselt hallatavad. Offline-avaleht leiab krüptitud paketid ning
online-loendil on stabiilne cursor ja ausad koguarvud. Üleandmine on idempotentne per-target
saga, fotol on tõendatav alus ning attachment'i staging/tombstone-reconciler kasutab sama
PostgreSQL-i kvoodilukku kui tavadokumendid. Mikrofon peatub vaate elutsükli piiridel ja
kohalik heli on piiratud 10 minuti / 25 MiB-ga. Andmekoopia sisaldab nüüd versioonitud
välitööajalugu, turvakirjad liiguvad tõendatava outbox'i kaudu ning OCR-il on püsiv töö,
omaniku/IP kiiruspiir ja PostgreSQL-i globaalne concurrency-värav. Järgmine soovitatav sidus
plokk on `SOL-COMP-01…05`.

**RAG-teenuse `SOL-RAGSVC-01…28` on DONE ja peatüki UTC täisvärav on roheline.**
`SOL-ORG-13`–`17`, `SOL-DOC-J-01`–`06` ja kogu `SOL-SLOG-01…24` parandused ning kiirem plokipõhine töökord on koodipuus. Kolmeastmelised arvud loetakse käsuga `npm run sol:progress`, neid siia ankrusse ei
kopeerita. Kui ülesanne ei ole SOL-parandus, loe S11 järel ainult vastavat S2–S10 sektsiooni.

**„Minu jagamised” `SOL-SHARE-01…07` on lõpetatud.** Inimene näeb nüüd kõiki päris
jagamisklasse, ühe allika tõrge ei peida ülejäänud ajalugu, abi-kaardi nähtavus ja mentorluse
tagasivõtt on ausad ning jagamisajalugu jõuab sisuta andmekoopiasse. Tööheaolu toe sisu ja
kolmeaastase minimaalse kviitungi elutsükkel järgib omaniku otsustatud poliitikat; juristi
kinnitus on enne selle production-jõustumist väljalaske kontrollpunkt.

**Teenusekaardi `SOL-SMAP-01…09` on lõpetatud.**
Kaardi avaldamine, allikast kadumine, teenuse kanalid, paginatsioon, grupid, süvalingid ja
anonüümne peer-piir on nüüd serveri-, PostgreSQL-i ja brauseritõendiga kaetud ning tile'id
liiguvad lõppkasutaja asemel sama päritolu proxy kaudu. Omaniku kinnitatud `SOL-SMAP-07` leping
hoiab ühe tehniliselt rikkis allika korral terve allika tulemused nähtaval koos ausa hoiatusega,
kuid turva- ja õigusevead jäävad fail-closed. `SOL-SMAP-09` ametlikud kasutustingimused lubavad
TMS/WMTS integratsiooni koos allikaviitega; kaart kasutab soovitatud atributsiooni ja `no-store`
proxy ei edasta Maa- ja Ruumiametile lõppkasutaja võrgu- ega otsinguidentifikaatoreid.

**SOL-RES-07 kood on valmis; brauseritõend on NOT_PROVEN.** Aktiivne uuring leitakse vestlusse
naastes üles, elav progress jätkub ühe voona ja Stop jääb sama tööga seotuks; lokaalse dev-serveri
React hydration'i rike takistas päris brauseriraja lõpetamist, mistõttu leid jääb lahtiseks.

**SOL-RAGSVC-03 tehtud 12.08 — RAG-teenus ei käivitu enam puuduva või nõrga teenusevõtmega.**
Võtmeta arendus on eraldi loopback-only lipp ning kogu kaitstud endpointide inventuur annab
puuduva või vale võtmega 401. Järgmine plokk on adminiproksi toimingupõhine luba ja audit.

**SOL-RAGSVC-04 tehtud 12.08 — RAG haldus ei ole enam iga administraatori piiramatu catch-all.**
Teadmistehalduril ja platform-adminil on eraldi püsiv õigus, brauseriproksil täpne allowlist ja
same-origin mutatsioonipiir ning iga upstream-toiming saab kohustusliku algus- ja tulemusauditi.
Järgmine plokk teeb registri ja aktiivse dokumendiversiooni rikke- ning protsessiohutuks.

**SOL-RAGSVC-05/06 tehtud 12.08 — katkine register ei muutu enam tühjaks ega kaota mitme protsessi uuendusi.**
Olemasoleva registri viga teeb tervise punaseks ja peatab kirjutused; viimane kontrollitud snapshot
jääb taastamiseks alles. OS-ülene lukk, unikaalsed tempfailid ja fsync säilitasid nelja protsessi
register/patch/delete koormuses kõik uuendused. Järgmine plokk on vektorite, faili ja registri
ühine versiooniline commit.

**SOL-RAGSVC-07…10 tehtud 12.08 — fail, vektorid ja register vahetuvad nüüd ühe aktiivversiooni lepinguga.**
Uus sisu on otsingule nähtamatu kuni terviklikkuse kontrolli ja registri commit'ini; vana versioon
säilib selle hetkeni. Kustutusel on retry-tombstone ning metadata patch taastab vea korral vana
terviku. Järgmine plokk seab päris keha-, parseri- ja võrguressursi piirid.

**SOL-RAGSVC-11/12 tehtud 12.08 — keha- ja parserikulu on nüüd päriselt piiratud enne kallist tööd.**
Proksi ja ASGI loendavad voo tegelikke baite, upload spulitakse piiratud ajutisse faili ning teksti,
chunkide ja query kululagi on serveri leping. MIME/ZIP/PDF struktuur kontrollitakse enne parserit;
parser töötab tapetavas ressursipiiriga alamprotsessis. Järgmine plokk sulgeb URL-fetch'i
DNS-kontrolli ja ühenduse vahelise rebindingu akna.

**SOL-RAGSVC-13 tehtud 12.08 — URL-ingest ühendub ainult eelkontrollitud avaliku IP-ga.**
Algne hostname säilib Host/SNI/sertifikaadikontrollis, socket'i tegelik peer peab võrduma pin'itud
IP-ga ning proxy-env ei sekku. Redirect kordab sama lepingut. Järgmine plokk teeb otsingu
infrastruktuurivea nähtavaks ja jõustab tulemuste ning leksikaalse korpuse täielikkuse lepingu.

**SOL-RAGSVC-14…16 tehtud 12.08 — RAG-i rike ei näi enam tühja eduka otsinguna.**
Chroma tõrge annab struktureeritud 503, hübriidtulemus lõigatakse pärast lõppskoori täpselt
`top_k` järgi ning leksikaalrada pagib korpuse või märgib turvalaeni/vea nähtava partial/degraded
seisuna. Järgmine plokk seob artiklipaki ja eksplitsiitsete chunkide identiteedi dokumendiga.

**SOL-RAGSVC-17/18 tehtud 12.08 — artiklipakk aktiveerub ühe versioonina ja klient ei vali enam Chroma ID-d.**
Kõik artiklid ehitatakse enne kirjutust, ID sisaldab dokumendi ja artikli identiteeti ning manifest
commit'ib koos aktiivversiooniga. Eksplitsiitse chunki kliendi-ID jääb ainult päritolumetadataks;
füüsilise võtme tuletab server. Järgmine plokk tõendab teksti katvuse, PDF-leheküljed, nulltulemuse
ja embeddingusse saadetud/salvestatud chunki samasuse.

**SOL-RAGSVC-19…22 tehtud 12.08 — chunkide tekst, leheküljeviide ja embedding kirjeldavad sama sisu.**
Lausekatkestus ei jäta enam vahet, lühike mitmeleheküljeline PDF kannab kogu lehevahemikku,
tekstita asendus katkeb 422-ga enne aktiivversiooni ning embeddingule liiga pikk eksplitsiitne
chunk lükatakse kärpimise asemel tagasi. Järgmine plokk teeb Chroma tõrke tervise- ja
dokumendivaadetes nähtavaks ning eemaldab siseteed vastustest.

**SOL-RAGSVC-23 tehtud 12.08 — katkine vektorkiht on punane, mitte tühi ja roheline.**
Health annab Chroma tõrkel 503 ilma sisekonfiguratsiooni või teedeta; dokumendiloend ja detail
annavad `DEGRADED`, tundmatu chunk-arvu ning stabiilse veakoodi. Avalikud dokumendiväljad on
allowlistis ja hoidlateed ei välju. Järgmine plokk ühendab OR-grupid kadudeta ning teeb
autorite/tagide filtri vastavaks nende tegelikule salvestuskujule.

**SOL-RAGSVC-24/25 tehtud 12.08 — kombineeritud filtrid ei kirjuta üksteist üle.**
Iga OR-rühm säilib ühise AND-i all ning dense/leksikaal kasutavad sama puud. Autorid ja tagid
salvestatakse ning filtreeritakse diakriitikata scalar-slot'ide kaudu, mitte komadega kuvateksti
vastu. Järgmine plokk sulgeb base64, valideerimisvea ja metadata välja tühjendamise lepingud.

**SOL-RAGSVC-26…28 tehtud 12.08 — vigane sisend ei jõua kallisse töötlusse ja metadata saab päriselt tühjaks.**
Faili base64 on range ning tühi või nullbaitidest sisu katkeb enne workerit. Valideerimisvastus annab
marsruudi, välja ja stabiilse veakoodi ilma keha või räsita. Nullable metadata väljad eemaldatakse
registrist ja kõigist chunkidest ühe rollback'itava muudatusena. RAG-teenuse peatükk on 28/28 DONE
ning peatüki UTC täisvärav on roheline; järgmine SOL-paranduste peatükk valitakse eraldi.

**SOL-SLOG-02…05 ja 21…24 tehtud 12.08 — Teenuspäeviku viimane plokk sulges võrgujärjekorra andmekao, idempotentsuse/päritolu, narratiivi identiteedi ja asünkroonse UI ning vaikse mahukärpe.** Päris PostgreSQL-i sondid: kirje päritolu/paralleelsus **12/12**, narratiivi identiteet **6/6**. Brauseris läbis narratiivi A/B seed-, list- ja AI-võistlus mõlemas järjekorras kõik kuus juhtu ning salvestus kasutas nähtavat valikut. Uued migratsioonid: `20260812233000_sol_slog_04_entry_request_hash` ja `20260812234000_sol_slog_22_narrative_identity`.

**SOL-SLOG-19…20 tehtud 12.08 — samal päevateekonnal saab olla ainult üks aktiivne külastus ning päeva sulgemine ei saa enam võita paralleelselt külastuse alustamisega.** Mõlemad toimingud lukustavad sama route'i rea ja loevad luku järel värske seisu; kaotaja saab 409. `npm run slog:route-race:probe` **10/10** päris PostgreSQL-is: depart/depart, close/depart ja close/arrive jätsid kõik ainult ühe koherentse võitja. Uut migratsiooni ei vaja.

**SOL-SLOG-11…12 tehtud 12.08 — kliendi kinnitus vastab nüüd nähtud kuule ja seitsmeaastane aruanne ei kao konto ega tavakustutuse kaudu.** Kuuvaade väljastab sisu-snapshoti, POST kinnitab ainult tema külmutatud ID-d ning muutunud kuu annab 409. Aktiivse säilitustähtajaga raporti DELETE annab samuti 409; konto kustutamisel liigub fail kasutajaseoseta juriidilisse arhiivi ja retention-sweep eemaldab ta alles tähtaja järel. `npm run slog:confirmation-retention:probe` **8/8** päris PostgreSQL-is, Teenuspäeviku ja konto-kustutuse testslice **366/366**, sihitud eslint, i18n ja Prisma valideerimine puhtad. Vajab migratsiooni `20260812213000_sol_slog_12_report_legal_archive`.

**SOL-SLOG-15…16 tehtud 12.08 — juhile saadetav aruanne ei saa enam jääda orvufailiks ega kaduda vanemobjekti kaskaadiga.** `PREPARING` on püsiv taasteseis: fail liigub stagingust lõplikuks enne `SENT`+auditi ühistehingut ning cleanup-tõrke korjab retention-sweep. Kolm identiteedi-FK-d kasutavad `SetNull`-i ja DB-triggeri erased-at jälge; räsi, fail ja tähtaeg säilivad. Veasüstitestid **7/7**, `npm run slog:share-integrity:probe` **8/8** päris PostgreSQL-is ning kogu ploki testslice **373/373**; sihitud eslint, i18n ja Prisma valideerimine puhtad. Vajab migratsiooni `20260812223000_sol_slog_15_16_share_integrity`.

**Viimati mõõdetud server on `a79c68b7`, `.next` 12.08 21:23:06** (kaheksateistkümnes
deploy, omaniku selgel loal). Välja läksid eelnenud SOL-ORG/DOC/SLOG parandused ja kogu
**SOL-RAGSVC-01…28** peatükk koos kuue uue migratsiooniga. Frontend, RAG ja research-worker on
aktiivsed; avalik HTTPS ning RAG health vastavad 200, RAG võtmeta/vale võtmega 401 ja õige võtmega
200. Serveri tööpuu on puhas; järgmine SOL-paranduste peatükk valitakse eraldi.

**Mõõdetud ENNE ja PÄRAST, sest migratsioon puudutas tootmisandmetega tabelit.** Enne: 4
`Payment` rida, `userId` kõigil täidetud, `Payment_userId_fkey` ja `Payment_subscriptionId_fkey`
mõlemad **`c` (Cascade)**, blokeerivaid migratsiooniridu 0. Pärast: mõlemad **`n` (SetNull)**,
`userId` nullitav (`is_nullable = YES`), **read endiselt 4, `userId_null = 0`, `archivedAt`
täidetud 0 real** — migratsioon ei muutnud ühtki olemasolevat väärtust, nagu ta ette ütles.
Kolm teenust `active`, `/` `/vestlus` `/toolaud` `/tooheaolu` **200**, kolme teenuse veatasemel
logi **tühi**. Deploy jooksis lahtiühendatuna, skript **genereeritud `deploy-server.mjs`-ist**
(md5 klappis mõlemas otsas), ajutised failid serverist koristatud.
**Migratsioon ainult lõdvendab piiri** — `Payment.userId` `DROP NOT NULL` ja kaks võõrvõtme
reeglit `Cascade` → `SetNull` — ega muuda ühtki olemasolevat väärtust; toodangus mõõdetud enne
kirjutamist: 4 `Payment` rida, kõigil `userId` täidetud, 11 `Subscription`, 1 `BillingMethod`.

**Kaks deploy'd 12.08 omaniku selgel loal: `c169ca70` 15:07 ja `954289fc` 15:12**, `.next`
15:12. Mõõdetud kohe pärast mõlemat: kolm teenust `active`, `/` `/vestlus` `/toolaud` **200**,
veatasemel logi tühi, **viis migratsiooni rakendatud** (uus tabel `WellbeingParticipation` +
neli veergu; blokeerivaid migratsioonuridu 0). Välja läks **30 auditileidu** (SOL-EVENT-01,
kogu SOL-URG, kogu SOL-WB) ning lisaks selle päeva õhtune töö.

**SOL-PAY-09 on tehtud ja peatükk lõpetatud (11/11).** Leid ei olnud tingimuste ja koodi
vastuolu, vaid koodi ja koodi oma: `lib/retention.js` hoiab makseid seitse aastat ja
privaatsustingimuste punkt 7.9 lubab kasutajale sedasama, aga `ON DELETE CASCADE` võttis selle
ühe konto kustutusega vaikselt tagasi. Maksekirje elab nüüd maksjast kauem, koosseis on ühes
kohas (`PAYMENT_ARCHIVE_FIELDS`) ja külmutatakse **sisemine tootekood, mitte paketi nimi** —
„supervisioonipakett" tõendaks seitse aastat, et see inimene oli supervisioonis.
**`npm run pay:archive:probe` 24/24 päris PostgreSQL-is, kaks negatiivkontrolli:** kustutus ilma
eelneva külmutamiseta (tõendab, et järjekord kannab — pärast `user.delete`-i ei leia arhiveerija
enam ühtki rida) ja vana kaskaadireegel samas andmebaasis sama andmestiku peal (0 rida alles vs
2). **Sond leidis vea iseendas:** struktuurikontroll otsis võõrvõtit tabelipaari järgi, aga
`Subscription` viitab `User`-ile kahest veerust vastupidiste reeglitega. **Lahtiseks jääb ainult
koosseisu õiguslik kinnitus** (jurist/raamatupidaja) — see ei muuda mehhanismi, vaid ühe
konstandi loendit.

**Teise sessiooni PWA/a11y töö on samuti väljas** (`cb93e8e0`) — ta seisis tööpuus commit'imata:
paigaldusviip, ligipääsetavuse modaal, taustaheli sammunupud, lühem sõnastus. Väravad enne
commit'i: `i18n:check` OK (sh kattekontroll — eemaldatud võti `promotion_body` ei olnud kusagilt
viidatud), eslint puhas, `TZ=UTC npm test` 4155/4155.

**12.08 õhtu, pärast SOL-WB lõpetamist: kaks lahtist otsust on tehtud ja teostatud, üks uus
kõrvalleid parandatud.** (1) **WB-04 analüüsiühik** — vaikimisi `latest_per_person`; ühik on nüüd
nähtav aruandes ja kõigis kolmes ekspordis ning valitav päringus. „Vahetus on üks rida" ei pidanud
paika: ühik ei jõudnud kuhugi väljundisse ega olnud `app/` all kordagi olemas. (2) **WB-06
lävend 3 → 5**, üks allikas kahe käsitsi koopia asemel; 10 jäi teadlikult võtmata, sest ta
summutaks kümnete inimestega piloodis enamiku lahtreid. (3) **Makse säilituse põrand** —
`PAYMENT_RETENTION_DAYS=90` oleks vaikselt langetanud privaatsustingimuste punktis 7.9 AVALDATUD
seitsme aasta lubaduse; auditis seda leidu ei ole. Kolm commit'i, migratsioone ei ole,
`TZ=UTC npm test` **4155/4155**. **Lahtiseks jäi õigusliku asendi otsus:** kas tööheaolu koond on
kontrollitud ligipääsuga isikuandmed (WP29 05/2014 järgi ei tee ükski lävend teda anonüümseks) —
sellel on tagajärjed õiguslikule alusele, säilitusele ja osalejale antud lubadusele.

**Seis 12.08 (mõõdetud, mitte mäletatud):** server on **`1443b6a0`**. **Pärast seda deploy'd on `main`-i tulnud SOL-EVENT-01, kogu SOL-URG ja kogu SOL-WB — 30 leidu ja VIIS migratsiooni, mis on push'imata ja deploy'mata.** Kolm uuemat migratsiooni (`…080000` osalusprojektsioon, `…090000` kontrollpunkti skalaar, `…100000` vaataja kutse + FK `SetNull` → `Cascade`) puudutavad tootmises **0 rida** — 0 `WellbeingRecord`, 0 pilooti, 0 vaatajat, mõõdetud psql-iga enne migratsioonide kirjutamist. **Deploy 12.08 08:12 sinu selgel loal** (järjekorranumbrit siia ei kirjutata: S1 ja
`parandusaudit.md` ei ole 11.08 õhtuse deploy osas nõus — üks ütles serveriks `b7c9adf0`, teine
`1ed23452`, **mõõdetuna oli ta `b7539345`, `.next` 11.08 18:53**; kumbki number ei pidanud
paika)**:** 34 commit'i — AUTH-14, AUTH-15, kogu SOL-VOICE, SOL-ROOM, SOL-CALL ja SOL-INV, SOL-PAY-01…-08, -10, -11 ning kogu SOL-NOTIF — ja **seitse migratsiooni**, kõik lisavad. Mõõdetud kohe pärast: `.next` 08:12:44, kolm teenust `active`, `sotsiaal.ai` ja `127.0.0.1:3000` **200**, serveri tööpuu puhas, kolme teenuse veatasemel logi tühi. Deploy jooksis serveris lahtiühendatuna (`setsid` + logifail), sest SSH-kanal katkes väljundivoo peale ka seekord — jälgija sai `Connection reset by peer`, deploy ise seda ei märganud. **Neljateistkümnes deploy 11.08 13:45** oli `b7c9adf0`: SOL-CHAT-09…-13 (peatükk LÕPETATUD, 13/13), migratsioone ei olnud; mõõdetud kohe pärast: `.next` 13:45:53, kolm teenust `active`, `/` `/vestlus` `/toolaud` **200**, frontend'i JA rag-teenuse veatasemel logi tühi. **Kolmeteistkümnes deploy 11.08 13:06** oli `27af4a02`: SOL-CHAT-01…-08 + SOL-MEET-05/-06 ja migratsioon `20260811160000` (uus tabel `ChatTurn`, ridu 0).

**Kaheteistkümnes deploy 11.08 11:42** oli `ae1f2055`: kaheksa commit'i (SOL-MEET-01…-04 + docs)
ja üks migratsioon. Mõõdetud kohe pärast: `.next` 11:42, kolm teenust `active`, viis lehte **200**,
veatasemel logi tühi. `MeetingSummaryJobClaim` olemas koos unikaalse `userId` indeksi ja
`ON DELETE CASCADE` võtmega, ridu 0.

**Enne deploy'd mõõdetud ja seetõttu ära jäänud mure:** SOL-MEET-03 toob kaasa
snapshotikataloogi koristuse, aga `/var/lib/sotsiaalai/agent/meeting-summary-jobs` oli
toodangus **tühi**, seega kustutada ei olnud midagi. Sama loogika esimene päris koormus tuleb
alles siis, kui keegi kokkuvõttetöid päriselt käivitab.

**Üheteistkümnes deploy 11.08 10:17** oli `aafe4eaa`: 30 commit'i (kogu SOL-DOC 01…09, kogu
SOL-RES 01…07 + docs) ja kaks migratsiooni. Mõõdetud kohe pärast: `.next` 10:17, kolm teenust
`active`, `/` `/vestlus` `/toolaud` `/teenusekaart` **200**, veatasemel logi tühi. `ResearchJob`
on toodangus 0 rida, seega RES-02 unikaalne indeks läks läbi triviaalselt — esimene päris
kinnitus tuleb siis, kui kaks sama võtmega kavatsust tõesti kohtuvad.

**Kümnes deploy 10.08 23:34** oli `44144aba` (SOL-FIELD-04/-05/-06, migratsioonita) — vt S9.
**Üheksas deploy 10.08 22:49** oli `a2aa7435`: neli commit'i (SOL-FIELD-02 ja -03 + docs),
migratsioone ei olnud. Mõõdetud kohe pärast: `.next` 22:49, kolm teenust `active`,
`/` `/vestlus` `/valitoo` `/admin/rag` **200**, frontend'i veatasemel logi tühi.

**Kaheksas deploy 10.08 21:45** oli `ae599200`: 21 commit'i (SOL-NET-01/-02, SPROF-plokk,
kogu SOL-ORG, SOL-FIELD-01 + docs) ja kaks migratsiooni. Mõõdetud kohe pärast, mitte
eeldatud: `.next` 21:45, kolm teenust `active`, `https://sotsiaal.ai` **200**, mõlemad
migratsioonid `_prisma_migrations`-is lõpetatud ja tagasi kerimata, trigger
`ServiceVisit_provenance_frozen` **olemas ja lubatud** (`tgenabled = O`). `NetworkShare` on
toodangus 0 rida, seega `contentHash` backfill oli tühikäik ja `SET NOT NULL` läks läbi
triviaalselt — esimene päris kinnitus arvutab räsi koodirajal.

**Seitsmes deploy 10.08 17:04** oli `4c6c9cc9`: viis commit'i (SLOG-17/18, RAGSVC-01/02,
JOUR-01/02, PRE-02 + docs) ja üks migratsioon (`20260810160000` külastuse org-päritolu).
Kontrollitud kohe pärast: `migrate status` „up to date", `/` `/vestlus` `/admin/rag` **200**,
kolm teenust `active`, vea-ridu ei ole.

**Deploy järel jooksis ka `rag:path:probe`** (RAGSVC-01/02 tõend, mis ootas teadlikult
deploy'd): **`PROBE_OK 8/8`** päris teenuse vastu, kettal ei ole ühtki faili hoidlast
väljas. Esimene jooks andis punase, aga viga oli **sondis** — tema reegel vastas vaenuliku
faili enda nimele ka pärast korrektset puhastust. Sond parandatud.

**SOL-süvaauditi arvud ei ela S1 jutustuses.** `npm run sol:tally` annab ametliku
DONE/lahtise vaate; `npm run sol:progress` eristab DONE / PARTIAL / NOT_DONE. Auditis ei ole
enam ühtegi lahtist P0-d. `parandusaudit.md` kolmeastmeline plokk on samuti GENEREERITUD
(`npm run sol:progress -- --write`) — PARTIAL ja DONE leiud peatükkide kaupa ning Seis-lõik
sõna-sõnalt. Ploki värskust hoiab test, mitte lubadus. **Per-leiu loendit siia ei kopeerita:**
S1 kannab kogusummat, raport kannab leiu enda seisu, `parandusaudit.md` kannab tuletatud
ülevaadet — kolmas käsitsi hoitav koopia oleks järgmine lahknemine.

**SOL-ORG-13 tehtud 12.08 — organisatsiooni audit ei kärbi enam vastutusjälge vaikides.**
Auditivaade kannab serveri koguarvu ja stabiilset `(createdAt,id)` cursorit; eksport läbib kogu
auditi või katkeb ning manifest ütleb rea arvu ja täielikkuse välja. `npm run org:audit:probe`
**14/14 päris PostgreSQL-is** 205 sünteetilise reaga, sh võrdsed ajatemplid ja esimese/viimase
rea säilimine; sond koristas kõik enda read (`audit=0`, `organization=0`).

**SOL-ORG-14 tehtud 12.08 — aktiivne töö ei kao enam vaikse 50/100/200 rea lõike taha.**
Vastuvõtt, saadud ja saadetud toeavaldused, juhile saadetud aruanded, kutsed ning sponsorlused
kasutavad stabiilset liitcursorit ja nõudmisel järgmise lehe laadimist; serveris on seisu ning
asjakohased kiireloomulisuse, tähtaja ületuse ja avamata filtrid. Sihttest **5/5** läbis
201/101/201 rea piirid; `npm run org:operational-pagination:probe` **6/6 päris PostgreSQL-is**
ning cleanup jäi `inbox=0 support=0 reports=0`. Peatüki täissviit tuleb peatüki lõpus, mitte
iga ploki järel.

**SOL-ORG-15 tehtud 12.08 — toeavalduse terminalset seisu ei saa enam stale või paralleelse
API-kutsega tagasi pöörata.** Kõik neli mutatsiooni lukustavad sama avalduserea ja kirjutavad
ainult lubatud lähteseisu ning sama `updatedAt` revisjoni pealt; `RECALLED`, `CORRECTED` ja
`CLOSED` on terminalsed. `npm run org:support-share:probe` **12/12 päris PostgreSQL-is** kattis
open-vs-recall, close-vs-correct ja topelt-close võidujooksud: üks võitja, kaotajale 409, üks
audit. Cleanup `shares=0 audits=0 org=0 user=0`; sihttest **4/4**.

**SOL-ORG-16 tehtud 12.08 — aruande „avatud” seis järgib nüüd päriselt brauserisse jõudnud
terviklikku faili.** GET kontrollib enne vastust suuruse ja SHA-256 ning kirjutab kohustusliku
`access_attempted` auditi; audititõrke korral bait'e ei väljastata. Klient loeb kogu JSON-i või
blob'i ning saadab alles siis lühiajalise allkirjastatud delivery-kinnituse. See muudab `OPENED`
seisu ja kirjutab `delivered`-tähendusega auditi ühes tehingus. Veasüsti sihttest **7/7** kattis
puuduva faili, räsivea, katkenud streami ning mõlema auditikihi tõrke;
`npm run org:report-delivery:probe` **5/5 päris
PostgreSQL-is**, cleanup `shares=0 audits=0 org=0 user=0`.

**SOL-ORG-17 tehtud 12.08 — organisatsiooni loomise retry ei tee enam topelt tööruumi ning
loomist piirab server.** Kasutaja ja `clientActionId` on DB unikaalpiir, normaliseeritud payload'i
räsi teeb sama võtme eri sisust 409 ning muutmata vorm hoiab retry ajal sama võtit. Route'il on
kasutaja- ja usaldatud proxy korral ka IP-põhine tunnine piir. `npm run org:create:probe`
**7/7 päris PostgreSQL-is**: neli paralleelpäringut, üks organisatsioon, üks liikmesus, üks
grantide komplekt ja üks audit; cleanup `org=0 audits=0 user=0`. Migratsioon
`20260812200000_sol_org_17_creation_idempotency` rakendus kohalikult ja migratsiooniseis on
puhas. Peatükilõpu värav: `TZ=UTC npm test` **4199/4199**, lint 0 viga, i18n puhas ja
`git diff --check` puhas. Sellega on **SOL-ORG 17/17**; järgmine dokumendijärgne plokk on
**SOL-DOC-J-01…-06**.

**SOL-DOC-J-01 tehtud 12.08 — Dokumendid-vaate vanemad omanikuobjektid on nüüd päriselt
kättesaadavad.** Neli peret kasutavad dünaamilist offsetti ja ühist „laadi vanemad” toimingut;
otsing läheb kõigis neljas serverisse enne count'i/paginatsiooni. Sihttest **3/3** lõi igasse
peresse 51 rida, kattuva lehega jäi 204 unikaalset objekti ja iga pere 51. rida jõudis samasse
töötoimingute renderdusse. Kolme uue otsingupäringu Prisma kuju valideeriti päris PostgreSQL-i
vastu.

**SOL-DOC-J-02 tehtud 12.08 — kaks vahekaarti ei kirjuta enam sama dokumenti vaikides üle.**
PATCH nõuab nähtud `updatedAt` versiooni ja teeb `id + ownerId + updatedAt` CAS-i; 409 kannab
värske rea tagasi kliendile. Sama piir on staged transkripti avaldamise ees, nii et kaotaja ei
muuda faili. Sihttestid **12/12**; `npm run doc:mutation:probe` **10/10 päris PostgreSQL-is ja
päris kettal** kattis rename'i, transkripti ning `agentAllowed true/false` võistlused. Igas oli
üks võitja ja 409 kaotaja, DB/fail jäid koherentseks, staged jääke 0 ja cleanup `users=0`.
Järgmine leid on **SOL-DOC-J-03** — loa tagasivõtmisel taastatav RAG-delete.

**SOL-DOC-J-03 kood ja DB-rada tehtud 12.08, ametlik seis PARTIAL kuni päris RAG-tõendini.**
Keelamine kirjutab CAS-tehingus enne kaugkatset auditeeritud `DataDeletionJob` töö ja
`pending` seisu; tõrge jääb `failed`, retry viib sama töö `done`-iks. Pending/failed blokeerib
nii korduslubamise kui ingest'i ning on Dokumendid-vaates nähtav. Sihttestid **15/15**;
`npm run doc:rag-removal:probe` **15/15 päris PostgreSQL-is** kattis tõrke, retry,
idempotentsuse ja paralleelse keela/luba võistluse, cleanup `users=0 jobs=0 audits=0`.
**NOT_PROVEN:** päris RAG ingest → keela → GET/search puudub ja konto kustutuse välisots —
kohalikus masinas pole RAG-võtit ega porti 8000 kuulavat teenust. J-03 muutub DONE-iks alles
välise tõendi järel; muud dokumendiparandused võivad sellest sõltumatult edasi liikuda.

**SOL-DOC-J-04 tehtud 12.08 — salvestatud analüüs kuulub nüüd tervikandmekoopiasse.**
Eraldi versioonitud `saved_analyses` pind ekspordib omaniku sisu, pealkirja, disclaimer'i,
ajatemplid ja allikaviited; kustutatud allika ID säilib, võõra analüüs ei läbi owner-filtrit.
Andmekoopia sihttestid **12/12** ja `npm run doc:saved-analysis-export:probe` **6/6 päris
PostgreSQL-is**; manifest `recordCount=1`, cleanup `users=0`. Järgmine leid on
**SOL-DOC-J-05** — puuduva algfailiga andmekoopia peab ausalt katkema või olema partial.

**SOL-DOC-J-05 tehtud 12.08 — puuduva või loetamatu algfailiga koopia ei saa enam READY-ks.**
ENOENT, ligipääsu-, containment- ja keset lugemist tekkinud viga katkestavad kogu töö stabiilse
`documentId + reason` koodiga; toortee ja erind ei leki. Sihttestid **13/13**;
`npm run doc:missing-export-file:probe` **6/6 päris PostgreSQL-is** kinnitas FAILED seisu,
puuduva outputPath/ZIP-i ja `DATA_EXPORT_FAILED` auditi, cleanup `users=0`. Järgmine leid on
**SOL-DOC-J-06** — dokumentide allalaadimise ja artefakti kustutuse kohustuslik audit.

**SOL-DOC-J-06 tehtud 12.08 — download ega artefakti kustutus ei saa enam auditita õnnestuda.**
Mõlemad allalaadimised auditeerivad pärast baitide valmimist, enne vastust; kustutuse audit ja
DELETE on üks tehing. FK `SET NULL` tõttu jääb kustutatud artefakti ID metaossa püsima.
Sihttestid **5/5** ja `npm run doc:artifact-audit:probe` **5/5 päris PostgreSQL-is**:
audititõrke järel artefakt 1/audit 0, edu järel artefakt 0/audit 1, cleanup `users=0`.
Dokumendiploki peatükilõpu värav: `TZ=UTC npm test` **4223/4223**, lint **0 viga**
(kolm varasemat hoiatust), i18n puhas, Prisma **166 migratsiooni** ajakohased ja
`git diff --check` puhas. Täissviit käis kokkulepitult üks kord peatüki lõpus.
Dokumendiploki järel on järgmine dokumendijärgne peatükk **SOL-SLOG**, esimene lahtine leid
**SOL-SLOG-06**; J-03 päris RAG-tõend jääb eraldi selgelt nähtavaks võlaks.

**SOL-WB (Tööheaolu) lõpetatud 12.08 — 18/18, sh neli leidu jätkufailist.** Kandvad parandused:
**osalusprojektsioon** (`WellbeingParticipation`) — kirje kuulub sellesse piloodikoondisse, kelle
tööna ta sündis, ja seda ei otsusta enam kliendi saadetud `roleGroup` string; §D8 piir jäi
puutumata, sest projektsioon on eraldi tabel, mitte veerg kirje peal · **range väljaskeem** —
tundmatu ohuväärtus ei muutu enam „ohtu ei ole" vastuseks (`dangerStatus: "ONGOING"` vale
kirjapildiga andis varem `no_immediate_danger`) · **fikseeritud perioodivõrk**, mis võtab ära
differencing-rünnaku eelduse, ja künnise alampiir koodis (`WELLBEING_MIN_GROUP_SIZE=1` eemaldas
varem kaitse täielikult) · **kontrollpunkt** — vastatud read ei näljuta enam taimerit, kokkulepe
liigub parandusega kaasa ja tal on identiteet · **erindi tekst ei jõua enam kasutajani** ·
**piloodivaataja ligipääsu saab ära võtta** ja iga andmine jätab jälje · **andmekoopia kannab
elutsüklit ja mustandeid**. `npm run wb:pilot:probe` **28/28** päris PostgreSQL-is.

**TÄIENDAV LAHTRISUMMUTUS ON 12.08 HILISÕHTUL TEHTUD** (`db97a10b`) — ta oli WB-06 sabas kirjas
kui „eraldi töö" ja ta ei vajanud migratsiooni ega otsust. **Lävend 5 mõõtis kogu koondit ja
lahter jäi katmata:** kaheteistkümne inimese aruandes läks ühe inimese riskimarker välja täpse
arvuna. Nüüd on kaks kihti — väike lahter ei jõua välja ÜLDSE (rida ei teki, osakaal kaob koos
loenduriga) ja **kui lahtrid liituvad avaldatud üldsummaks, peab kinni minema vähemalt kaks**,
muidu on ainus summutatud lahter lahutamise teel tagasi arvutatav. Kolm kohta oleksid teinud
summutusest vaikse nulli — aruande lugemisreegel, XLSX ja prindivaade — ja kõik kolm ütlevad nüüd
„avaldamata". `TZ=UTC npm test` **4175/4175**, kolm negatiivkontrolli.

**SIIN OLNUD „KAKS OTSUST" ON MÕLEMAD TEHTUD** (analüüsiühik `latest_per_person`, lävend 5 —
vt selle lõigu ülemist osa) ja lahtrisummutus, mis nende kõrval kolmandana laual seisis, on nüüd
samuti tehtud. **Privaatsuskaitse sabast jääb alles kaks:** kaks ERI SUURUSEGA lubatud perioodi
(kuu vs kvartal) on endiselt sisestikud — selle vastu aitavad päringueelarve, privaatsust
säilitav müra või „üks perioodiliik piloodi kohta", ja kõik kolm on tootevalik — ning
**lävend 10**, mille eeldus on piloodi päris pealiikmete arv, mida ei ole olemas. Kolmas, väiksem: liikmesuseta konto kirjed ei osale
üheski piloodikoondis — see on SOL-WB-01 otsene tagajärg.

**AUDIT ISE ON LÕPUNI VIIDUD** — kõik 20 funktsiooni, Haldus, Ruumid ja Töölaud on kaetud,
pluss funktsioonideülene ring (kustutus, andmekoopia, retention, RAG, failid, SMTP, süvalingid,
rolli- ja organisatsioonivahetus, samaaegsus). **Aga tema failid ei ole ühes puus:** üheksa
auditifaili **26 leiuga** elab seitsmes kõrvalises tööpuus — kuus lahtise pea (detached HEAD)
taga, kolm üldse commit'imata. Seega tegelik nimetaja on **429**, mitte 403, ja lahtiseid on
**312**. Nende hulgas kolm uut leidu: `SOL-XFUNC-01` ja `-02` (P2) ning **`SOL-XFUNC-03` (P1,
isikuandmete koopia registril puudub skeemiülene täielikkusvärav)**. Mõõdetud loend koos
tööpuude nimede ja commit'idega on `parandusaudit.md`-s lõigus „Auditikorpus ei ole ühes puus".
**See on andmekao risk:** lahtise pea peale ei näita ükski haru. Koondamine on S4-s.

Sama klassi lahtine asi: **teenusekaardi klaaskujunduse parandus on commit'imata** tööpuus
`SotsiaalAI-service-map-glass-a4e00e4` (+307/−85, 5 faili, 50/50 sihttesti läbis). Haru
`codex/service-map-glass-visual-fix` on olemas, aga ta ei kanna ühtki oma commit'i — mõõdetuna
ei ole parandus „harus", ta on ainult selle kausta töölaual.

**Nimetaja ei ole 357 — ta liikus jätkufailidega 403-ni.** Loendur luges algul ainult peafaili
pealkirju, seega jätkufailid olid tema alt VÄLJAS; 11.08 õhtul mõõdetuna on neid **seitse,
kokku 46 leidu, kõik NOT_DONE** (`…-jatk-materjalid` 13 · `…-teenusekaart` 8 ·
`…-dokumendid` 6 · `…-minu-jagamised` 5 · `…-koosta-dokument` 5 · `…-organisatsioonid` 5 ·
`…-tooheaolu` 4). Loendur kukub nüüd nimeliselt, kui mõni pealkiri tema mustrile ei vasta —
vaikselt väiksemat nimetajat ta enam anda ei saa.

**„SOL-ORG 12/12 tehtud" ja „SOL-DOC 9/9 tehtud" ei kehti enam** — mõlemad said jätkufailist
lahtiseid leide juurde, seepärast on lõpetatuid 7, mitte 9. SOL-MAT-01 on tavaline
serveripiiri puudumine tasulisel spetsialistifunktsioonil, mitte ääreala. **Otsustamata ja see
otsus määrab, mis on järgmine töö: kas jätkufailid liidetakse peaauditi dokumendijärjekorda
või jäävad eraldi järjekorraks.**

**SOL-AUTH on lõpetatud: 15/15.** AUTH-03 tehtud (commit `14501377`) — toortoken kadus
`VerificationToken` reast (`lib/auth/verificationTokens.js`, `v2:` + sha256) ja tarbimine sai
atomaarse ühekordse claim'i. `npm run auth:token:probe` **26/26 päris PostgreSQL-is**, kaks
negatiivkontrolli: vana rea väärtus ON töötav link, vana claim-muster viskab kaotaja peal erindi.

**AUTH-04 + -05 + -06, üks juur: kinnitus otsustas asjade üle, mida ta ei
hoidnud kinni.** -04: GET ei muuda enam identiteeti — sama skannerikaitse vaheleht, mis
`verify-email`-is juba oli (GET ei tee ühtki DB-päringut, POST vahetab). -05: kogu otsus kolis
tehingusse, rea lukk tuli lugemise ETTE ja tarbimine on tingimuslik `deleteMany({id, tokenHash})`
— `id` ei ole identiteet, sest resend kirjutab sama rea peale ümber. -06: resend teeb nüüd
**mint → SAADA → alles siis rotatsioon**, seega vana link elab kuni uus on teele läinud; vale
eduteade asendus `502`-ga ja esmane PUT kannab ausat `emailDelivery` seisu.
`npm run auth:emailchange:probe` **27/27 päris PostgreSQL-is**, **kolm negatiivkontrolli**: vana
GET-rada vahetab identiteedi pelgalt avamisel · vana kinnitusmuster vahetab VANA aadressi peale ja
hävitab värske tokeni · vana resend-järjekord tapab varem kohale jõudnud lingi.

**AUTH-07 + -11: `LoginTempToken` elutsükkel.** -07: PIN-i vahetus kasvatas
ainult `sessionVersion`-it, aga vana PIN-iga alustatud sisselogimine loeb tarbimisel KÄESOLEVAT
versiooni — rotatsioon nägi välja nagu tühistaks kõik ja ei tühistanud. Nüüd kustutatakse samas
tehingus `LoginTempToken`, `EmailOtpCode`, `TrustedDevice` ja `Session`, täpselt nagu paroolitaaste
ja e-posti vahetus juba tegid. -11: sama katse sai väljastada mitu usaldatud seadet, sest `usedAt`
täideti alles NextAuthis; nüüd on tingimuslik claim `trustedDeviceId: null` peal + kasutajapõhine
nõuandelukk (`4712`, kõrvuti AUTH-02 `4711`-ga), otsus kolis marsruudist välja
(`lib/auth/loginAttemptVerification.js`). `npm run auth:attempt:probe` **19/19 päris
PostgreSQL-is**, tõend on **NextAuthi päris `authorize()` vastus**, mitte rea puudumine; kaks
negatiivkontrolli. **Sond leidis lõksu, mis oleks tõendi tühjaks teinud:** `provider.authorize` on
next-auth'i tühi stub (`() => null`) ja päris funktsioon on `provider.options.authorize` — kinni
püüdis baasjoone kontroll „enne vahetust ANNAB".

**AUTH-08…-14 said 11.08 tehtud ja on `origin/main`-is** (sisselogimislingi kinnitus nõuab
nüüd vajutust, turvalingi origin tuleb ainult konfiguratsioonist, PIN-katsete loendur elab
andmebaasis ja on instantsiülene, tundmatu konto vastus on ajastuselt sama mis vale PIN-i oma,
ning väljalogimine ütleb „tehtud" alles siis, kui serveripoolne rida on tühistatud).

**AUTH-15 lõpetas peatüki: paroolitaaste kaks samaaegset päringut tapsid teineteise lingi.**
Kasutaja sai kaks näiliselt edukat kirja ja kumbki link ei töötanud — topeltklikk või aeglane
meilitarne võis konto taastamise juhuslikult võimatuks muuta. Nüüd on lingi mintimine ja
saatmine ÜKS omand: kuni üks kiri on teel, teine päring midagi ei mindi ega saada (topeltklikk
annab ühe kirja), ja vana link vahetub välja alles siis, kui uus on päriselt teele läinud.
`npm run auth:reset:probe` **31/31 päris PostgreSQL-is**; tõend on marsruudi enda `PUT` — see,
mille kasutaja lingile klikkides käivitab. **Vajab migratsiooni `20260811220000`** (uus tabel
`VerificationLinkDispatch`).

**Hääl sai 11.08 kolm piiri, kus enne oli null (SOL-VOICE, peatükk täis).** Ettelugemise
„Peata" katkestab nüüd ka poolelioleva serverisünteesi — varem sünteesis server lõpuni, kvoot
kulus ja heli võis hakata mängima pärast lehelt lahkumist. Igal välisel kutsel on ajapiir, mis
eristab meie oma piiri kasutaja katkestusest, ja kummalgi juhul ei jää reservatsioon rippuma.
Transkribeerimise arve käib nüüd teenusepakkuja kinnitatud kestuse järgi: tundmatu formaadiga
fail maksis varem alati minuti, ka siis, kui ta oli tunni pikkune. `npm run voice:settle:probe`
**15/15 päris PostgreSQL-is**, mitte kunagi laheneva provideriga. Brauserikiht jääb
**NOT_PROVEN** (DOM-testisviiti ei ole).

**Kiire abi rada sai 12.08 üksteist parandust (SOL-URG, peatükk täis 13/13).** Vastamata
ohuküsimus ei ole enam vastus „ei" — edasi pääseb ainult otsene eitus, ja kliendi tekst ei saa
enam laual „AI koostatud mustandi" silti. Iga olekumuutus ja tema vastutusjälg sünnivad koos või
mitte kumbki, ja oodatav seis on päringus: kaks töötajat ei saa mõlemad vastutust võtta, vahepealne
lugemine võidab tagasivõtu, aegumine ei võta juba võetud tööd ja vana kinnitus ei vii juhtumit
uue üleandmise vale laua kätte. „Võtan" kirjutab nüüd vastutaja nimeliselt põhirea peale (see on
laua tööinfo, mitte pöörduja oma). Laua rida on valmiduse lukk: pöördumist ei saa enam jätta
lauale, mis kontrolli ja kirjutuse vahel kinni pandi, ja üleandmise siht peab kandma sama
vastuvõtulubadust mis uus pöördumine. Konversioon eelpöördumiseks on täpselt üks kord. Koond
loeb kogu valimi (kärpimine on nähtav) ja liigitab Eesti seinakella, mitte UTC järgi. Partneri
kinnitusel on nüüd kinnitaja ja kinnitatud tekstiversioon, ning iga valmisolekut mõjutav
adminitoiming jätab auditirea. Laua täisloendi rada, mis möödus „iga vaatamine jätab jälje"
lepingust, on eemaldatud — laual on juba sisuta järjekord oma marsruudil.
`npm run urgent:race:probe` **42/42 päris PostgreSQL-is**. Brauserikiht jääb **NOT_PROVEN**.

**Sündmusel on 12.08 identiteet, mitte ainult võti (SOL-EVENT, peatükk täis).** Sama
idempotentsusvõti annab edu ainult siis, kui ta kirjeldab sama tegu — teistsugune tegu sama
võtme all katkestab tehingu selge veaga, mitte ei anna põhitehingule näilist sündmuse edu.
Kõrvalleiuna sai parandatud rada, mis päris andmebaasis ei olnud kunagi töötanud: pärast
unikaalsusrikkumist ei saa samas tehingus enam midagi küsida, sest Postgres on tehingu juba
vigaseks märkinud. `npm run event:idempotency:probe` **13/13 päris PostgreSQL-is**.

`npm test` **4032/4032** (Europe/Tallinn ja UTC), i18n ja eslint puhtad, `db:migrate:check` OK.

**Deploy'mata: SOL-EVENT-01 ja kogu SOL-URG (03…13) — 12 leidu ja kaks migratsiooni**
(`20260812060000` `UrgentRequest.takenByUserId`, `20260812070000` `UrgentDesk.lastVerifiedByUserId`
+ `verifiedConditionsHash`). Mõlemad on lisavad ja olemasolevaid ridu ei puuduta; kumbki ei loo
unikaalindeksit, seega toodangu andmete eelkontrolli nad ei vaja.

**Eelmine deploy tehtud 12.08 08:12 (omaniku luba samal päeval).** Välja
läksid AUTH-14, AUTH-15, kogu SOL-VOICE, kogu SOL-ROOM, kogu SOL-CALL, kogu SOL-INV,
SOL-PAY-01…-08, -10, -11 ja kogu SOL-NOTIF; server on `1443b6a0`. Peale läksid ka kõik **seitse
migratsiooni**: `20260811220000` (`VerificationLinkDispatch`), `20260811230000`
(`PaymentStatus.RECONCILE_PENDING` + `Payment.clientIntentKey` unikaalsus), `20260812010000`
(`PaymentStatus.REVIEW_REQUIRED`), `20260812020000` (`PaymentStatus.PART_REFUNDED` +
`Payment.refundedAmount`), `20260812030000` (mandaadi unikaalsus) `20260812040000`
(outbox'i püsiv Message-ID) ja `20260812050000` (teavituste reconcile-kursor). Ükski neist ei puuduta olemasolevaid ridu. Toodangu
PostgreSQL on **16.14** — mõõdetud, sest `ALTER TYPE … ADD VALUE` migratsioonitehingus nõuab
PG 12+.

**Mandaadi unikaalsust mõõdeti toodangu pealt ENNE deploy'd.** `20260812030000` loob
`CREATE UNIQUE INDEX`-i ilma eelneva dedupeta — ja just duplikaat oli see, mida SOL-PAY-10
kirjeldas. Duplikaadi peal oleks migratsioon kukkunud ja jäänud `_prisma_migrations`-i „failed"
seisu, mis blokeerib iga järgmise `migrate deploy` kuni käsitsi lahendamiseni. Mõõdetud:
**0 duplikaati** (1 `BillingMethod` rida, 4 makset). Sama kontroll käib iga tulevase
unikaalsuspiirangu ette.

**Toodangu maksepilt mõõdetud 12.08** (SOL-PAY-04 backfilli küsimuse pärast): 11 tellimust
(8 `SELF`, 3 `SPONSORED_BY_HOST`) ja 4 makset (3 `PAID`, 1 `REFUNDED`). Ühelgi sponsoreeritud
real ei ole oma `PAID` makset, seega ühtki vale päritoluga rida praegu ei ole ja backfilli ei
ole vaja.

**Neli uut sondi 11.08 kõne- ja kutsepeatükist:** `call:seat:probe` 12/12 (deterministlik
võistlus viimase koha pärast + tehingu tagasipööramine) · `call:audit:probe` 11/11 (otsus ja
tema jälg commit'ivad koos või mitte kumbki) · `invite:seat:probe` 11/11 (kaks eri kutset
seisus 49/50) · `invite:mail:probe` 16/16 (kogu ahel päris outbox-workeriga). Igaühel
negatiivkontroll vana kuju vastu.

**Maksepeatükk lisas viis sondi:** `pay:renewal:probe` 13/13 · `pay:outcome:probe` **27/27**
(päris marsruudid + päris HTTP-provider, mille vastust sond juhib: 500, katkenud ühendus keset
laadimist, päris `P2002` pärast õnnestunud laadimist, 402) · `pay:checkout:probe` **27/27**
(deterministlik võistlus nõuandeluku peal, mõõdetud on makseridade JA provideri kutsete arv) ·
`pay:origin:probe` **19/19** (aegunud hosti- ja organisatsioonisponsorlus → omamakse → PAID →
cancel/refund) · `pay:verify:probe` **19/19** (iga väli eraldi muudetud, iga sõnum kehtiva
allkirjaga) · `pay:refund:probe` **22/22** (0,01 € · osaline · kumulatiivne · täielik, nii
omamakse kui sponsorkutse peal, pluss kutse-kandja veasüst) · `pay:audit:probe` **11/11**
(veasüst on päris andmebaasi trigger) · `pay:mandate:probe` **13/13** (callback vs webhook
deterministlikus võistluses). Igal sondil on negatiivkontroll vana kuju vastu; `pay:outcome` ja
`pay:verify` kannavad lisaks vastassuunalist kontrolli — kinnitatud eitus peab jääma lõplikuks ja
vastav sõnum peab endiselt õiguse andma.

**Mõõdetud serverist 11.08:** `sotsiaalai-payment-emails.timer` on toodangus **enabled ja
active** (iga ~3 min). See on SOL-INV-03 eeldus — kirjade järjekord ei ole surnud postkast.
**Omaniku otsused 11.08:** SOL-CHAT-10 jääb **fail-closed**, SOL-CHAT-08 jääb **efemeerseks** —
mõlemad kirjas leidude Seis-lõikudes. Viimased kaks (SOL-SPROF-01
ja -02) said 10.08 õhtul kolm puuduvat otsa: päringuaegne fail-closed nõusolekuvärav
(`lib/privacy/serviceProfileRetrievalGuard.js`), aus pending/failed seis liideses ja
runtime-tõend päris PostgreSQL-i vastu (`npm run sprof:consent:probe` 22/22). Ühiktest
leidis seejuures, et esimene värav oli **vales kohas** — `searchRagQueries` tagastab kahest
kohast ja ühe päringu kiirtee (vestluses kõige tavalisem kuju) käis mööda; värav kolis
`searchRagDirect`-i sisse. Teine, seni märkamata uks oli **kovisiooni teadmusotsing**, mis
käib sama RAG-indeksi peal ilma kollektsioonifiltrita — ka see rada on nüüd väravaga.

**Sama õhtu jätk: kogu SOL-ORG peatükk (01…12) kaetud.** Viis uut sondi, kõik päris
PostgreSQL-i vastu: `slog:org:probe` (34/34) · `org:seat:probe` (26/26) ·
`org:sponsor:probe` (33/33) · `org:inbox:probe` (51/51) · `org:invite:probe` (38/38) ·
`org:offboard:probe` (60/60).

**Paralleelsussondid on deterministlikud, mitte „mahtusid ühte sekundisse":** kolmas
tehing hoiab rea lukku, mõlemad võistlejad käivitatakse ja MÕÕDETAKSE, et nad ootavad,
siis lukk lastakse lahti ja Postgres annab ta ootejärjekorra järjekorras. Võistlusriist
elab ühes kohas (`scripts/probe-race-harness.mjs`) — vigane võistlusriist annaks ROHELISE
tulemuse, mitte punase.

**IGA sond jooksutati ka vana koodi vastu** ja punaste arv on kirjas iga leiu Seis-lõigus
(ORG-05: 10, ORG-06: 10, ORG-08: 2, ORG-09: 14, ORG-10: 13, ORG-12: 6). Ilma selle
kontrollita ei tõendaks roheline sond midagi. Uus migratsioon `20260810200000` teeb
külastuse organisatsioonilise päritolu **andmebaasi tasemel muutumatuks**.

**Neli asja, mida audit ise ei nimetanud ja mis tulid välja alles sondiga:**
korduv sponsorluse vastuvõtmine tegi kasutajale **kaks tellimusrida** · korduv kutse
vastuvõtmine oleks teinud **kaks liikmesust** · `REVOKED` kutse all oli **aktiivne
liikmesus koos õigustega** · ühest olekumuutusest jäi auditisse **kaks sündmust**.
Teenuspäeviku nõusolekuväraval oli lisaks **teine uks** kovisiooni kaudu.

**Muster, mis kordus enamikus neist:** loe seis → otsusta → kirjuta tingimusteta. Parandus
on igal pool sama kuju — kas `updateMany ... WHERE <eeldatav seis>` (nõue) või rea lukk
ENNE lugemist. Kaks kohta väärivad eraldi mainimist: SOL-ORG-05-l oli lukk **õigel real,
aga otsus tehti luku-eelse tõe pealt**, ja SOL-SPROF-02-l oli värav **õige, aga vales
kohas** — mõlemad nägid parandatud välja.

**SOL-FIELD-01 on samuti tehtud** ja ta on selle õhtu kõige inimlikum leid: välitöö
hoiatuste loendurit kasvatas TAUSTAKÄIK, mida mitte ükski komponent ei kuvanud. „Kolm
hoiatust enne kustutamist" tähendas päriselt „rakendus avati kolmel eri päeval" — saatmata
märge võis kaduda inimeselt, kes ei näinud ühtegi hoiatust. Nüüd on hoiatus **nähtav**,
tema kinnitus on **eraldi tegevus**, ja kustutamine vajab lisaks **viimast selget luba**.
Poliitika kolis komponendist välja (`lib/field/localRetention.js`) — see ei olnud
korrastus, vaid tõendatavuse tingimus. **NOT_PROVEN jääb brauserikiht:** DOM-iga
testisviiti selles projektis ei ole, seega bänneri päris renderdumine on kontrollimata.

**SOL-FIELD-02 on sama klass vastupidises suunas** ja ta tehti 10.08 hilisõhtul: seal oli
otsus õige ja teda ei kutsunud mitte keegi. `fieldPackPurgeDue()` oli koodis olemas ja
arvutas lepingu tähtaegu õigesti, aga ainus koht, kust teda kutsuti, oli ühiktest —
rakenduse ainus automaatne säilituskäik luges `items`, mitte pakke. Eesmärki, asukohta,
ajakava ja **ohutusinfot** kandev külastuspakett kadus seadmest ainult siis, kui inimene
vajutas „Eemalda pakett". Nüüd on kolm tähtaega järjekord, mitte valik: sulgemine kustutab
**kohe**, hiljemalt 72 h pärast planeeritud akent, ja 7 päeva, kui akent ei olegi.

**Minu otsus, mille sa võid pöörata:** lugesin lepingu sõna „hiljemalt" ÜLEMPIIRIKS ja
72 h piir kehtib ka lõpetamata jäänud külastuse paketile — muidu jääks tähtajatuks just see
juht, mis leiu tekitas. Kaotus on taastatav („Võta seadmesse" uuesti), säilimine ei ole.

**Sond käib päris Chromiumi päris IndexedDB ja WebCrypto vastu** (`npm run field:pack:probe`
**26/26**), sest fake-hoidla on minu enda kirjutatud ega tõenda seda, mida otsus kõige rohkem
usub: seadmes on sisu krüptitud ja säilituskäik näeb ainult metaandmeid. Vana koodi vastu
6 plokki punast. Kirjutamise käigus tuli välja kaks vastupidavuse auku, mida auditis ei
olnud — katkine krüptogramm oleks blokeerinud uue paketi võtmise, ja kohaliku hoidla viga
oleks kestale öelnud „server ei vastanud".

**SOL-FIELD-03: audit kirjutas alati globaalse ühenduse kaudu ja neelas iga vea.** Nüüd on
kaks eksporti ja kaks lepingut — `writeDataAudit()` võtab `db` süstituna ja **viskab**,
`logDataAudit()` jääb best-effort'iks. Viis kohustuslikku välitöö rada (turvatoiming,
sulgemine, nõusoleku tagasivõtmine, kaks üleandmist, manuse kustutus) kirjutavad tõendi nüüd
**samas tehingus** põhikirjutusega; auditita rajad tehingut ei ava.

**Leiu teine pool oli TESTIDES ja just see peitis teda nii kaua:** fake-DB-ga roheline test
proovis vaikselt PÄRIS andmebaasi kirjutada, logis ühendusvea ja jäi ikka roheliseks.
Mõõtsin ära — vanade kutsujate vastu kulub esimesel auditikirjutusel **241 ms**, mis on päris
ühenduse katse. Fake-hoidla ise pidi saama kaks asja ja mõlemad peitsid veaklassi: päris
rollback (varem läbilase) ja pesastatud seose-projektsioon (manuse dokument jäi vaikselt
välja, seega kustutuse selle haru kohta ei olnud ühtki jooksvat testi).

**Kaks teadlikku erandit:** turvahoiatuse eskalatsioon ja säilituskäigu kustutus said
süstitud kliendi, aga jäid best-effort'iks — seal on kiri juba välja läinud ja fail juba
kettalt kadunud, seega tagasipööramine tähendaks teist kirja või rida olematu faili kohta.

Vana koodi vastu **8/12 punast**. Üks õppetund läks testi sisse: `assert.rejects(p)` üksi
rahuldub suvalise veaga ja mu esimene versioon läks roheliseks hoopis 409 pealt.

**SOL-FIELD-04: marker kadus kolmel viisil ja üks neist oli raportist väljas.** Kinnine
väljaloend ei kopeerinud teda (kolmas kord samas failis — SOL-FIELD-02 kaotas nii `takenAt`
ja `status`), flush eemaldas ta pärast IGA täidetud päringut staatust vaatamata (401, 409,
429 ja 500 kustutasid tõendi nagu edu) — **ja võrguta kinnitus kutsus `storePack`-i
võltsvisiidiga, mis kirjutas üle terve ettevalmistuspaketi, sealhulgas OHUTUSINFO.** Ehk
„Kinnita saabumine" ilma võrguta hävitas selle, mille inimene just offline-kasutuseks võttis.

Nüüd on marker versioonitud pakiskeemi osa ja kaob AINULT kahel juhul: server vastas 2xx või
värske külastus tõendab sama sündmust. Kõik muu jätab ta alles ja annab **nähtava
tõrkeseisu** koos põhjuse ja korduskatsega. Paketi payload on koodis nähtavalt kahes pooles —
serveripoolne sisu ehitatakse ümber, seadmepoolne kantakse edasi.

Sond **35/35** päris IndexedDB vastu (sh rakenduse sulgemine ja taasavamine), ühikuid **18**.
**Aus piir mõõtmises:** vanal koodil ei olnud moodulipiiri, mille vastu jooksutada — loogika
elas React-i `useCallback`-is. Vana kesta vastu läheb punaseks staatiline lepingutest;
ülejäänu asemel on eraldi negatiivkontroll, mis kirjutab vana reegli testi sisse ümber ja
tõendab, et ta sama 500 peale tõendi kustutab. Silt on ausalt küljes: see on transkriptsioon,
mitte vana kood.

**SOL-FIELD-05 ja -06 lõpetasid peatüki — SOL-FIELD on 6/6.** FIELD-05: kinnitatud
transkripti tekst ja toorheli kustutuskell olid kaks eraldi päringut, millest teise viga
neelati vaikselt ja eduteade anti alati. Kui teine kukkus, oli tekst serveris ja toorheli
jäi kuni 7-päevase varutähtajani — kaks tõde ühest toimingust lahknesid. Nüüd on nad **üks
idempotentne serveritoiming**: märge kannab viidet salvestisele ja kell käivitub samas
tehingus, kus tekst vastu võetakse. Eduteade tuleb ainult siis, kui kirje jõudis `SYNCED`-i;
järjekorda jäänud kirje ütleb ausalt „saadetakse, kell käivitub siis, kui tekst on serveris".

FIELD-06: lubatud **5 s → 5 min backoff oli olemas ainult arvutusena**. `nextAttemptAt` seati
ja `isUploadDue()` oskas teda lugeda, aga pärast tähtaja saabumist ei küsinud teda mitte
keegi — uus katse tuli ainult rakenduse avamisel, `online` sündmusel või sinu enda vajutusel.
Uus `lib/field/syncScheduler.js` elab Reactist väljas ja tema kell on süstitav, seega **viis
automaatset katset, kasvav backoff, peatumine edu ja ülempiiri korral, offline/auth parkimine
ja unmount'i taimerikoristus on mõõdetud võltskella all** — ilma ühegi päris ootamiseta.

**SOL-FIELD-04, -05 ja -06 on LIVE** (kümnes deploy 10.08 23:34, server `44144aba`,
migratsioone ei olnud). Järelkontroll mõõdetud: `.next` 23:34, kolm teenust `active`,
`/` `/vestlus` `/valitoo` `/admin/rag` **200**, veatasemel logi tühi.

**SOL-DOC-01 avas dokumendipeatüki: AI-tasu võeti enne, kui tulemus oli olemas.** Kolm rada
(genereerimine, artefakti loomine, refinement) arvestasid kasutuse maha kohe pärast
mudelikutset ja märkisid siis „valmis" lipu, mis keelas hilisema vabastuse. Mustandi loomise
viga, üle salvestuskvoodi jäänud sisu või kohustusliku auditirea viga tuli seega juba
arvestatud ühiku otsa: **sinu nädalalimiit kahanes ilma leitava mustandi või isegi vastuses
saadud tekstita**. Järjekord `reserve → genereeri → talleta → tasu` on nüüd omaette moodulis
(`lib/usage/paidResult.js`): viga enne tasu vabastab reservatsiooni, tasu enda viga ei vabasta
midagi, sest püsiv tulemus on juba sinu oma. Refinement'i puhul on püsiv asi **auditirida** —
ühtlasi lubatud kolme paranduse loenduri ainus allikas — seega käivad audit ja tasu ühes
tehingus. Agendi kest saadab nüüd ka stabiilse kavatsusvõtme: sama sisendiga kordus ei võta
teist tasu ega loo teist mustandit, aga tahtlik uus jooks on aus uus töö.

**SOL-DOC-02: kaks otsepunkti, kus tekkis päris kulu ilma ühegi kvoodita.** Helifaili
transkriptsioon kutsus päris teenusepakkujat, aga ei arvestanud ühtegi `STT_SECONDS` sekundit —
kuigi paketis on see piir olemas ja kitsas (klient 900 s kuus, töötaja 3600). Transkripti
kokkuvõte tegi AI-genereerimise ja lõi uue artefakti ilma dokumendiloome lepinguta. Mõlemal oli
ainult minutipõhine mälupõhine piir, mis kaob serveri taaskäivitusel ega ole perioodikvoot: seda
otsepunkti kaudu sai tekitada piiramatut kuukulu ja kasutusülevaade ei näidanud sellest midagi.
Nüüd reserveeritakse enne kutset **turvaline ülempiir** (kõnesalvestise teadaolev kestus →
failist loetud kestus → baitidest tuletatud piir) ja arvestatakse pärast kutset **tegelik
kestus**. Olemasoleva transkripti tagastamine ei maksa endiselt midagi.

**SOL-DOC-03: kinnitatud dokumenti sai pärast kinnitamist veel muuta.** Nii salvestamine kui
kinnitamine lugesid seisu eraldi päringuga ja kontrollisid mälus, et dokument on veel mustand —
aga kirjutasid hiljem ilma ühegi tingimuseta. Kahe vahekaardi tavaline kasutus piisas: kui
kinnitus jõudis vahele, muutis hilinenud salvestus juba **kinnitatud** dokumendi sisu, ja
allalaaditav „lõplik" fail ei olnud enam see, mille sa kinnitasid. Nüüd on kontroll ja kirjutus
üks toiming ning kinnitamine võtab su viimase sisu kaasa (detailivaate kaks päringut said üheks);
kaotaja saab ausa teate „muudeti vahepeal mujal". Tõendatud **päris andmebaasi vastu 33/33**,
sealhulgas negatiivkontroll: sond jäljendab samas olukorras vana käitumist ja näitab, et see
rikub kinnitatud sisu — seega on võistlus päris, mitte teoreetiline.

**SOL-DOC-04: sama dokument andis kaks eri vastust.** Transkripti muutmine kirjutas uue teksti
vana faili peale ja alles siis andmebaasi. Kui DB-samm kukkus, luges allalaadimine juba uut
sisu, aga vaade ja AI-kokkuvõte vana teksti — sama dokument, kaks tõde. Uue transkripti puhul
jäi vea korral tundlik tekst kettale ilma ühegi omaniku- ja säilitusreata. Nüüd läheb uus sisu
esmalt ajutisse faili ja avaldatakse alles pärast andmebaasi; vea korral tuleb vana fail tagasi
ja ajutine kaob. Tõendatud **päris hoidla ja päris tehinguga 17/17**.

**SOL-DOC-05: kolme paranduse piir ei pidanud kiirele topeltklõpsule vastu.** Piir oli loendus
enne AI-kutset, aga jälg kirjutati alles pärast — kaks samaaegset päringut lugesid sama arvu ja
mõlemad said läbi. Koht võetakse nüüd enne kutset ära ja jääb kinni ka siis, kui vastus veel
tuleb; ebaõnnestunud katse annab koha tagasi. Tõendatud **päris andmebaasis 13/13**: kui kolmest
kohast on kaks võetud, võidab neljast korraga saadetud päringust täpselt üks.

**SOL-DOC-06: sama salvestist sai korraga kaks korda transkribeerida.** Kui kaks päringut
jõudsid kohale samal hetkel, nägid mõlemad „transkripti veel ei ole", mõlemad maksid välise
teenuse eest ja mõlemad lõid eri sisuga transkripti — liides näitas neist lihtsalt uuemat. Nüüd
tehakse otsus ja tema jälg ühes lukustatud toimingus: valmis transkript tuleb tagasi ilma ühegi
kutseta, käimasolev töö annab ausa „seda salvestist transkribeeritakse juba", ja tööle saab
korraga hakata täpselt üks. Surnud protsess ei lukusta faili igaveseks — hüljatud töö võetakse
üle. Tõendatud **päris andmebaasis 13/13**, sh üks kutse ja üks transkript nelja korraga saabuva
päringu peale.

**SOL-DOC-07: salvestuskvoot ei olnud koormuse all päris piir.** Neli rada lugesid senise mahu
kokku ja lõid kirje alles hiljem — kaks korraga saabuvat päringut mahtusid mõlemad vana summa
järgi ära ja ületasid koos limiidi. Mõõtmine ja kirjutus käivad nüüd ühes lukustatud toimingus,
seega teine päring näeb juba esimese oma. Tõendatud **päris andmebaasis 8/8**: kui ruumi on veel
kahele, õnnestub neljast korraga saadetud kirjutusest täpselt kaks ja lõppsumma ei ületa piiri.

**SOL-DOC-08: salvestatud analüüsid ei läinud kvoodi arvestusse.** Analüüsi salvestamine
kontrollis sinu üldist salvestusmahtu, aga see summa analüüse ei lugenud — seega ei muutnud ükski
salvestatud analüüs järgmise kontrolli sisendit ja neid sai järjest salvestada piiramatult.
Analüüsid on nüüd samas summas mis dokumendid ja artefaktid, ja nende salvestamine käib sama
atomaarse reservatsiooni all.

**SOL-DOC-09 lõpetas peatüki: audit, mida ei olnud.** Analüüsi salvestamine ja kustutamine
kutsusid auditit, aga kutsutud sündmust ei olnud auditikaardis — kutse nägi välja nagu jälg, kuid
ühtki rida ei tekkinud. Hiljem ei saanud sinu enda kustutust eristada säilitustähtajast ega
puuduvast objektist. Nüüd on mõlemal oma jälg, kustutus ja jälg on üks toiming, ja kaardistamata
sündmus ei kao enam vaikselt. **See on peatüki ainus migratsiooni vajav parandus** (kaks
enum-väärtust, andmeid ei muuda).

**SOL-DOC on 9/9 — kuues lõpuni viidud peatükk.**

**SOL-RES-01: aegunud tellimus võttis ligipääsu su enda uuringule, ja „kustuta" ei kustutanud.**
Kogu uuringupind — loend, detail, edenemine ja kustutus — nõudis aktiivset tellimust, kuigi
dokumentidel kehtib juba kõva reegel, et oma failide lugemine ja kustutamine sellest ei sõltu.
Teine pool: kustutusnupp kutsus tegelikult tühistamist, mis lõppenud töö puhul ei teinud midagi —
sulle öeldi „kustutatud" ja rida ilmus kohe uuesti. Nüüd on lugemine, peatamine ja kustutamine
tellimusevabad (uue uuringu käivitamine jääb värava taha), peatamisel on oma nupp ja kustutus
eemaldab rea päriselt. Tõendatud **päris andmebaasi vastu 15/15** kõigis viies olekus.

**SOL-RES-02: sama katse tunnusega sai ühe ühiku eest tellida piiramatult uuringuid.** Kliendi
võti sidus ainult kasutusühikut, aga töö loodi alati uue tunnusega — teadlikult sama võtit korrates
sai ühe kuulimiidi ühikuga käivitada järjest uusi täismahus uuringuid. Vestlus ise ei saatnud võtit
üldse, seega ebaselge võrguvea kordus tegi vastupidi: uus tasuline töö ja topelttulemus. Nüüd on
kavatsusel oma tunnus andmebaasis: sama tunnus tagastab sama töö (ka lõppenu), teine sisend annab
ausa vea. **See vajab migratsiooni** (uus veerg + unikaalsus, olemasolevaid ridu ei muuda).

**SOL-RES-03: uuring võis olla ammu valmis, aga ekraanil seisis „ootel".** Kui uuringuid jooksutab
eraldi tööprotsess (nii on server seadistatav), siis hoidis töö loonud protsess oma mälus vana
seisu ja näitas seda ka sulle — töö lõppes andmebaasis, aga detail ja edenemisvoog jäid lõputult
`queued` peale. Nüüd on lihtne reegel: mälukoopia on ainult sellel protsessil, kes tööd päriselt
teeb; kõik teised loevad andmebaasist. Tõendatud **päris kahe protsessiga 8/8**.

**SOL-RES-04 ja -05: kaks viisi, kuidas tasuline uuring võis „õnnestuda" ilma tulemuseta.** Kui
uuringut jooksutav protsess pausile jäi ja teine võttis töö üle, jätkas vana ikkagi tööd ja võis
oma tulemuse peale kirjutada — nüüd tohib kirjutada ainult praegune omanik ja kaotaja katkestab
töö. Ja teine: raporti salvestamine vestlusse neelas kõik vead, seega uuring märgiti valmis ja
ühik kulus ka siis, kui vestlusse ei jäänud raportist jälgegi — nüüd on „valmis" seotud sellega,
et püsikoopia PÄRISELT tekkis; muidu jääb töö aktiivseks ja ühikut ei arvestata. Tõendatud päris
kahe workeri ja kahe protsessiga (9/9) ning päris andmebaasi vastu (10/10).

**SOL-RES-06: edukas uuring võis jääda arvestamata ja tühistatu hoidis kvooti kinni.** Kasutuse
lõplik arvestus käis pärast töö valmiks märkimist ja tema vead kadusid vaikselt; tühistamisel ei
leitud arveldusvõtit üldse üles. Nüüd jääb arvelduse tulemus tööle kirja ja pooleli jäänu
korratakse üle, kuni teenus kinnitab.

**SOL-RES-07 koodiosa on lõpetatud; brauserirada jääb eraldi QA-ks.** Aktiivse uuringu saab
vestluse avamisel üles leida, sama edenemisvooga jätkata ja **peatada** (ka „Minu dokumentide"
aktiivsel real on Stop-nupp). Taasühendumise, create/Stopi ja vestlusevahetuse võistlused on
serveritöö ID ning vestluse identiteediga suletud. Audit loeb leiu ametlikult PARTIAL-iks ainult
seetõttu, et nõutud päris brauserirada on lokaalse React hydration'i rikke tõttu NOT_PROVEN.

Täpsed lahtiste leidude arvud loetakse S1 juhise järgi käsuga `npm run sol:tally`. **SOL-RES on
ametlikult 6/7.** **SOL-AUTH (15/15), SOL-VOICE (3/3), SOL-ROOM (7/7), SOL-CALL (13/13) ja SOL-INV (3/3)
on 11.08 lõpetatud** — käsil on **SOL-PAY (10/11)**, kui just jätkufaile ette ei tõsteta.
SOL-CW-09/-14/-19 seisavad sinu otsuse ja brauseri-QA taga.

**SOL-PAY-01 tehtud: automaatne uuendamine ei anna enam alla esimese tõrke peale.** Üks
ajutine võrgu- või kaarditõrge lõpetas seni korduvmakse jäädavalt — server arvutas järgmise
katse aja ja näitas seda ka liideses, aga ei valinud seda tellimust enam kunagi. Nüüd jõuab
iga lubatud katse päriselt kohale ja maksemeetod märgitakse katkiseks alles siis, kui
loobutakse. **PAY-09 ootab sinu ja juristi/raamatupidaja otsust** (konto kustutamine viib
kaasa makseajaloo enne seitsmeaastast säilitustähtaega) — seda ei saa koodiga ette otsustada.

**SOL-PAY-02 tehtud: „me ei tea, kas makse õnnestus" ei ole enam sama mis „makse
ebaõnnestus".** Kui provideri vastus jäi tulemata (aegumine, katkenud võrk, tema enda tõrge)
või kukkus meie enda kirjutus juba pärast kaardi laadimist, märkis platvorm makse lõplikult
ebaõnnestunuks. Hiljem saabuv kinnitus „makstud" võeti vastu ja visati ära: raha oli võetud,
ligipääsu ei tulnud, ja järgmine katse võis lisaks võtta teist korda. Nüüd jääb teadmata
tulemus omaette seisu, hilisem kinnitus annab õiguse ikka veel, ja teadmata tulemusega kuud ei
laadita teist korda — peatus on nähtav nii töö vastuses kui halduse vaates. **Sama viga elas
KOLMANDAS kohas, mida raport ei nimetanud:** sponsorkutse makse tegi sedasama ja lisaks tühistas
kutse, mida hilisem kinnitus enam äratada ei saa — sponsori raha oleks läinud ilma kutseta.

**SOL-PAY-03 tehtud: topeltklõps ei ava enam kaht tasutavat makseakent.** Iga „Telli" vajutus
lõi seni uue makse ja uue provideritehingu; kaks vahekaarti või võrgu-retry võisid tekitada kaks
kehtivat checkout'i ja mõlema tasumisel pikenes sama tellimus kaks korda. Nüüd kannab kavatsus
oma tunnust: sama kavatsus annab sama makseakna, teine vahekaart saab sama akna, ja korraga
saabunud päringutest saab tasutava akna täpselt üks. **Lahtine ja sinu teada:** sponsorkutse
checkout ei ole endiselt idempotentne — see ei ole üheski auditileiu tekstis, aga ta on sama
klassi asi.

**SOL-PAY-04 tehtud: kes maksab, on nüüd üks otsus.** Kui inimene maksis pärast sponsorluse
lõppu ise, jäi andmebaasi kirja endine maksja — ja see ei olnud kosmeetika: **oma tellimust ei
saanud lõpetada** (tühistus nõuab omamakset) ning sponsori hilisem tagasimakse võttis ligipääsu
ära perioodilt, mille eest inimene ise maksis. Sama auk oli sponsorluste vahel: organisatsiooni
sponsorlus jättis eelmise inimsponsori seosed rea külge. Nüüd kirjutatakse päritolu tervikuna,
vahetus jätab ledgerisse jälje (kes maksis eelmise perioodi eest) ja **„lõpeta" ei vasta enam
eduga siis, kui ta ei lõpetanud midagi**.

**SOL-PAY-06 tehtud: ühe sendi tagastus ei võta enam tervet kuud.** Provideri osaline tagastus
mapiti täistagastuseks ja täistagastus lõpetab ligipääsu kohe — seega 0,01 € korrigeerimine
võttis kasutajalt kogu makstud kuu, sponsoreeritud inimeselt ruumiliikmesuse ja tappis
korduvmakse mandaadi. Nüüd on reegel raamatupidamise oma: **õigus lõpeb siis, kui makse on
täielikult tagastatud**. Osalised tagastused liidetakse; kui summa jõuab kogu makseni, käivitub
täisrada. Mida osaline tagastus õigusega tegema peaks (pool kuud? krediit?) on tooteotsus ja
seda ei ole koodiga ette otsustatud — vaikimisi jääb ligipääs alles ja seis on nähtav.

**SOL-PAY-07 tehtud: tasutud kutse link ei saa enam kaduda.** Kutse toorlink sündis tehingu sees,
aga tema kandja (kirja järjekorrarida) loodi alles pärast makse commit'i — kui see kukkus,
neelati viga logisse ja webhook vastas ikkagi „ok". Räsist linki tagasi ei saa: sponsor oli
maksnud, kutse seisis „saadetud", aga saajale ei olnud enam midagi saata. Nüüd sünnivad link ja
tema kandja koos või mitte kumbki, ja kui kandja on kaduma läinud, teeb sama teate kordus uue
lingi — ilma uue makse ja ilma uue õiguseta. **Sond leidis selle käigus päris vea minu enda
paranduses:** unikaalsuse rikkumine mürgitab PostgreSQL-i tehingu, seega „püüa viga kinni ja
jätka" ei tööta tehingu sees — logi ütles „tehtud", aga kõik pöördus vaikselt tagasi.

**Teavituste peatükk on täis (SOL-NOTIF 7/7).** Kolm asja, mis olid vaikselt katki: **ükski
teavituskiri ei oleks päris seadistusega välja läinud** (worker ei andnud SMTP-le saatja aadressi
ja platvormi transport katkeb ilma temata) · **teavituste kokkukorjaja alustas iga käivitusega
otsast** ja katkes 100 lehekülje järel, seega esimese ~10 000 rea taha jäänud teated ei jõudnud
kunagi kellenigi · **ohutuskriitilised sweep'id olid ühises `try` plokis viimased**, seega
tavalise teavituse või SMTP rike blokeeris välitöö check-in eskalatsiooni ja kiire abipalve
nähtava lõpetamise. Nüüd: saatja tuleb ühest kohast ja puuduv saatja ei jää lõputusse
korduskatsesse; kokkukorjaja edenemine elab andmebaasis ja käib ringi (hiljem sobivaks muutuv
vana rida ei jää vesimärgi taha); iga etapp jookseb oma veapiiri sees ja **ohutusetapid
käivituvad alati**, ka siis, kui varasem etapp kukkus. Lisaks: ruumiaktiivsuse teade ei tule enam
inimesele, kes ise kirjutas (autorid loeti varem ainult ühelt leheküljelt), sama aktiivsus ei anna
kuue tunni piiri taga teist teadet, timeout ei tähenda enam pimedat kordussaatmist, ja teavituste
loend ei peida vanemaid kehtivaid teateid uuemate nähtamatute taha.

**SOL-PAY-10 ja -11 tehtud (mõlemad P2).** Sama kaardimandaat sai andmebaasi kaks aktiivset
rida — kaks rada (makse tagasitulek ja webhook) kirjutasid teda kumbki oma koodiga ja kumbki ei
lukustanud midagi; siis ei tea revoke ega võtmevahetus, milline rida on õige. Nüüd kirjutab
mandaati üks lukustatud koht ja andmebaas ise ei võta teist rida vastu. **Ja e-kirjade
järjekord ei korda enam pimesi:** kui SMTP ei vastanud õigeks ajaks, ei tähenda see, et kiri ei
läinud — see tähendab, et me ei tea. Kutselink korratakse (saamata link on suurem kahju kui
topeltkiri ja sisu on identne), aga **maksekinnitus ja sponsorluse tagasivõtmise teade jäävad
ootele inimese otsustada**. Iga korduskatse kannab sama sõnumitunnust, seega postkastis on
duplikaat sama kiri, mitte teine.

**SOL-PAY-08 tehtud: makse jälg ei saa enam otsusest lahku minna.** Auditijälg kirjutati
telemeetriana — globaalse ühendusega, tehingust väljas ja vea neelates. Kolm vaikset tagajärge:
makse võis jõustuda ilma jäljeta, jälg võis kirjeldada muudatust, mis pöördus tagasi, või kaduda
ise. Nüüd on püsiv jälg sama tehingu osa (`DataAuditLog`) ja tema kirjutamise viga pöörab kogu
otsuse tagasi; telemeetria jääb eraldi kihiks, millest elavad halduse loendurid. Kasutaja enda
tühistus sai ühtlasi tehingu, mida tal varem üldse ei olnud.

**SOL-PAY-05 tehtud: allkiri tõendab päritolu, mitte summat.** „Makstud" otsuseks piisas seni
kehtivast allkirjast ja leitavast viitest — makstud summat ja valuutat ei võrreldud kunagi
sellega, mida see makse pidi maksma. Ühe sendiga oleks saanud kuu või sponsorkutse õiguse. Nüüd
peab sõnum vastama sellele maksele ja selle summa eest; mittevastavus ei anna õigust, vaid läheb
nähtavasse ülevaatuse seisu (omanikule teade, halduses loendur) ja hoiab ka kordusmakse kinni.
Täpselt vastav sõnum annab kuu edasi nagu enne.

**Kutsepeatükk sai 11.08 kolm leidu ja on täis.** Sponsorkoht on nüüd päriselt piir:
50 tasutud kohta ei saa enam ületada ka siis, kui kaks inimest võtavad kaks eri kutset
täpselt korraga vastu — varem said mõlemad sisse ja host maksis 51 koha eest. **Keelatud
päring on kõrvalmõjuta:** ruumi ID-d teadev võõras sai varem 403-ga lõppeva päringuga muuta
ruumi omaniku kuvatavat nime ja taasaktiveerida lõpetatud liikmesuse; nüüd ei kirjuta
kutsevoog enne autoriseerimist mitte midagi ja omaniku nimi tuleb tema enda profiilist.
**Kutse saatmine ütleb tulemuse välja:** iga adressaadi kohta on vastuses `sent`, `queued`
või `failed`, kohale toimetamata kiri jääb päris järjekorda ja server saadab ta ise uuesti;
liides nimetab jõudmata jäänud aadressid. Varem öeldi kõigi kohta ühetaoliselt „saadetud",
ka siis, kui kiri ei läinud kunagi välja ja saatja ootas vastust inimeselt, kes ei saanud
kunagi linki.

**Kõnepeatükk sai 11.08 kolm viimast leidu ja on täis.** Salvestisel on nüüd **üks kandja**:
teade „salvestis on saadaval" läheb ainult sellele, kes salvestamist taotles, ja
nõusolekutekst ütleb kolmes keeles välja, et teised annavad loa salvestamiseks, mitte
koopiale — varem lubas tekst ligipääsu, mida ükski vaade ei andnud. **Osalejapiir peab nüüd
koormusele vastu:** koht võetakse kõneluku all, seega kaks inimest ei mahu enam korraga
viimasele kohale, ja kõne sünnib ühe tehinguga — poolikut kõnet ilma hosti või
providerinimeta ei jää enam alles (vanad sellised read paranevad esimesel puutumisel).
**Salvestuse jälg on kohustuslik:** loa küsimine, iga nõusolekuotsus, käivitus, peatus ja
kustutus kirjutavad oma tõendi samas tehingus, kus seisumuutuse — kui tõendit ei saa
kirjutada, ei jõustu ka otsus. Käivitus, mille algusest ei saa kirjutada, peatab egressi.
**Omaniku otsus 11.08: salvestis on ainult taotleja oma** (alternatiiv oleks olnud
consent-snapshotil põhinev ligipääs kõigile nõustunutele — see oleks nõudnud teist
ligipääsuteed dokumentide piiris).

**Kogu SOL-DOC peatükk (01…09) ja SOL-RES-01…-07 on LIVE** (üheteistkümnes deploy 11.08 10:17,
vt S1) koos migratsioonidega `20260811020000` (`ANALYSIS_SAVE`/`ANALYSIS_DELETE`) ja
`20260811040000` (`clientIntentKey` + unikaalne indeks). Kumbki ei muutnud olemasolevaid ridu.

**SOL-NET-01/-02 on LIVE** koos migratsiooniga `20260810180000`
(`contentHash`, `confirmedContentHash`). Võrgustikujagamise kinnitus viitab nüüd TEKSTILE,
mitte reale: klient ei saa kinnitada sõnu, mida ta ei näinud, ja `SENT` rida ei saa
eksisteerida ilma sama versiooni kinnitustõendita. Ruum sünnib saatmisega ühes tehingus.
Sond `npm run net:share:probe` 30/30 päris PostgreSQL-is; vana käitumise vastu 14/16 punast.

SOL-CW on 17/20 ja kolm lahtist ei ole lihtsalt tegemata: CW-09 (kood tehtud, brauseritest
tegemata), CW-14 (mehhanism tehtud, taimeri lubamine sinu lukustatud järjekorras) ja
**CW-19, mis ootab sinu otsust**. Täielik ülevaade koos prioriteedijaotusega:
[`docs/audits/parandusaudit.md`](../audits/parandusaudit.md); **olekut kannab raport ise**,
iga leiu all on Seis-lõik.

**SOL-SCHEMA-01 on uus P0 ja ta muudab seda, mida „JTA-V1 on valmis ootama" tähendas.**
`CaseWorkMeetingNoteEntry` mudel ei kandnud kaht veergu, mis andmebaasis on `NOT NULL` ilma
vaikeväärtuseta — **iga kohtumise märkme kirje loomine oleks toodangus kukkunud** koodiga
`23502`. Kogu E4 ja kogu SOL-CW-15 karastus. Kasutajakahju ei tekkinud ainult sellepärast, et
värav on väljas. Parandatud mudelis (uut migratsiooni ei ole vaja), väravatest lisatud.
**Õppetund on suurem kui üks veerg:** `npm test` (fake-Prisma), `prisma validate` ja
`db:migrate:check` olid kõik kolm rohelised. Ainus värav, mis teda nägi, oli päris andmebaasi
vastu kirjutav sond. Kolm juhtumitöö sondi on nüüd olemas: `casework:retention:probe`,
`casework:workbench:probe`, `casework:deletion:probe`.
Tootmises on SOL-auditi parandused BUILD-01, AUTH-01/02, CW-01…CW-18, CW-20, SCHEMA-01 ja
RAGADMIN-01/02/03. **Deploy tehtud 09.08.2026 kolm korda omaniku selgel loal**
(16:53 `ff4547b9`, siis `df82b4f0`, siis 22:24 `841b6fa8`) — esimene kandis 48 commit'i ja
**8 migratsiooni** korraga: kogu JUHTUM-V1 + JTA-V1 juhtumitöö, a11y-laadimisloor ja A4
DST-parandus. Teine lisas **2 migratsiooni** (SOL-CW-15 märkme paranduste ajalugu, SOL-CW-16
kopeerimisauditi sisu sõrmejälg). Kolmas kandis 13 commit'i ja **2 migratsiooni**
(`CaseWorkRetentionRun` jooksulogi, SOL-RAGADMIN-03 ingest-claim'i lease). Rollback
`8ab68f98` (A4 deploy 05.08).
Tööpuu puhas. Üks tööpuu, üks haru.

**Mõõdetud kohe pärast kolmandat deploy'd, mitte eeldatud:** server `841b6fa8`, `.next`
ehitatud 22:24 · `_prisma_migrations` 140 rida, `migrate status` „up to date" · kõik kuus
claim-veergu ja kolm `ingest_claim_pair` `CHECK`-i on kohal · toodangus ei ole **ühtki**
`INGESTING` rida (KOV veeb 11 INGESTED / 2 READY / 65 NOT_INGESTED, RT 11/67,
organisatsioonid 4× NOT_INGESTED), seega uus lease-mehhanism ei pärinud ühtki ummikut ·
`sotsiaal.ai` `/` `/vestlus` `/admin/rag` **200** · frontend/rag/worker `active`, viimases
6 minutis ühtegi vea-rida.

**Juhtumitöö säilitustöö taimer on paigaldatud, aga VÄLJAS** — deploy kirjutas
`sotsiaalai-casework-retention.{service,timer}` `/etc/systemd/system`-i ja tegi
`daemon-reload`, `is-enabled` = **disabled**, `is-active` = **inactive**. See on nõutud
käitumine: lubamine kuulub aktiveerimise väljalaskesse, mitte igasse deploy'sse.

**Varasem mõõtmine (teine deploy) jääb kehtima:** `CaseWorkAssist` kannab kolme unikaalset
indeksit (SOL-CW-12) ja on tühi · `CaseWorkMeetingNoteEntryRevision` muutumatuse-trigger ja
mõlemad `contentHash` `CHECK`-id on kohal · `CASEWORK_V1_ENABLED` **ei ole**
`/etc/sotsiaalai/frontend.env`-is, seega värav on väljas ja `/juhtumid` annab **404**
(SOL-CW-02 nõutud käitumine: väljas väravaga peab marsruut olema olematust eristamatu).

**TEGEMATA (ootab omanikku): JTA-V1 aktiveerimine ja tema cron.** Omaniku otsus 08.08:
**funktsiooni ei aktiveerita ilma säilitustöö käivitajata** — kell ilma cron'ita on lubadus, mitte
mehhanism. **Järjekord on lukus ja seda ei tohi ümber tõsta:**

1. **Õ2/Õ3 andmekaitseanalüüsi kinnitus**
2. **cron paigaldatakse** (sama väljalase, mis aktiveerib)
3. **kuivjooks** — `npm run casework:retention:dry`
4. **aktiveerimine** — `CASEWORK_V1_ENABLED=1`
5. **päris jooks + logikontroll**

**Cron ei ole enam crontabi rida — ta on repositooriumi oma (SOL-CW-14, `e48a1068`).**
`deploy/systemd/sotsiaalai-casework-retention.{service,timer}` kannavad ajastust, lukku
(`flock`) ja timeout'i; deploy **paigaldab** unit-failid ja teeb `daemon-reload`, aga
**ei luba taimerit sisse**. Ajastus, mis elab ainult ühe masina crontabis, ei ole
platvormi oma — ja just tema puudumine oli see, mis jäi märkamatuks. Sammu 2 sisu on
seega üks käsk aktiveerimise väljalaskes:

```
sudo systemctl enable --now sotsiaalai-casework-retention.timer
```

Kontroll pärast lubamist: `systemctl list-timers sotsiaalai-casework-retention.timer` ja
`npm run casework:retention:smoke` (alarm = **väljumiskood 1**, mitte lause). Alarm ise on
tõendatud päris PostgreSQL-is: `npm run casework:retention:probe` **22/22** (visatav
andmebaas, lävi mõlemast otsast, smoke lapsprotsessina). **Tõendamata jääb säilitustähtaeg
ise** — hoiatus ja kustutus päris kellaga —, sest see nõuab, et värav oleks kuskil sees.
Vt `deploy/systemd/README.md`.

### Viimati tehtud (07.08): JUHTUM-V1 — juhtumi objekt

**E1–E6 on tehtud, tervik on koodis ja peidus.** Leping
[`juhtum-v1-arendusleping.md`](./juhtum-v1-arendusleping.md) v6 (`READY_TO_ASSIGN`, 21
lukustatud otsust, 40 testilepingut) on täidetud: skeem viie DB CHECK-iga, teenuskiht,
seoseregister, puuduv info, K1 adapter (`case_work` `RESERVED → SUPPORTED`) ja pind
**„Minu juhtumid" (`/juhtumid`)** üheteistkümne kasutusvooga. **Mida funktsioon inimese jaoks
teeb, on S4.1 „Juhtumi objekt elutsükliga".**

Väravad 07.08: `npm test` **2924/2924** · `i18n:check` OK · eslint puhas · `db:migrate:check`
OK · `npm run build` OK · **`npm run case:probe` 81/81** päris andmebaasi ja **kahe päris
sessiooni** vastu. Sondi E6 osa käib HTTP kaudu, mitte teenuskihi otsekutsega — ainult nii saab
tõendada, et kaks töötajat on üksteise juhtumitest pimedad (04.08 IDOR-i õppetund). Brauseris
päris sessiooniga läbi käidud loomine, puuduva info lisamine, kirjutuskaitse ja kliendiviite
kustutamine; HTML tekstiväljas kuvatakse tekstina.

Pind ei ole kättesaadav ainult URL-i kaudu: töölaual on kaart **„Juhtum" tsoonis** Välitöö
kõrval (UI-lipu ja rolli taga — kliendi ega admini lauale ta ei leki) ja pind kannab oma
**ⓘ juhendit** kolmes keeles, mille viimane osa ütleb välja piirid (ei ole register · rangelt
isiklik · ei anta üle ega kustutata · kliendiviite kustutamine on lõplik).

**Avamine on eraldi otsus.** `CASEWORK_V1_ENABLED` on vaikimisi väljas: siis vastab `/juhtumid`
`notFound()`-iga, töölaual kaarti ei ole ja API on eristamatu olematust marsruudist. Deploy'da
tohib väravaga väljas; **avamine vajab omaniku luba JA Õ2/Õ3 andmekaitseanalüüsi kinnitust**.

Objekt on `ideed.md` ptk 12 nimega **`CaseWorkAssist`** ja ta on **konteiner, mitte
olekumasin** — mustandi ülekandeahel (8 elementi × 7 seisu) on eraldi pakett **CASEWORK-P2**
kolme otsuse taga ja seda lepingusse ei neelatud.

**Platvormi reegel, mis sellest teemast kaugemale ulatub:** `PreInquiry` skeemikommentaar ütleb
välja, et *„adressaadiväljad on teadlikult eraldi, mitte üks polümorfne `recipientId`… muidu
kaob referentsiaalne terviklikkus."* Seosemudel on seetõttu **typed-FK, mitte polümorfne**, ja
„ei jää rippuvat viidet" tuleb andmebaasi kaskaadist, mitte rakenduse kustutusteede kaetusest.

### Viimati tehtud (08.08): JTA-V1 — juhtumitöö assistent, E1–E8 VALMIS

**Omanik valis 07.08 kuuenda teema: juhtumitöö assistent.** Leping
[`jta-v1-arendusleping.md`](./jta-v1-arendusleping.md) on **v8** — **kuus** omaniku auditiringi,
**23 lukustatud otsust, 8 etappi, 6 migratsiooni**. **Kõik kaheksa etappi on TEHTUD 08.08 ja
tervik on koodis ning peidus** (`CASEWORK_V1_ENABLED` vaikimisi väljas, sama värav mis
JUHTUM-V1-l — uut lippu ei loodud).

**Väravad:** `npm test` **3115/3115** (`Europe/Tallinn` ja `UTC`) · `i18n:check` OK ·
`db:migrate:check` OK (**135 migratsiooni**) · eslint puhas · `npm run build` OK ·
**`npm run jta:probe` 34/34** päris andmebaasi ja **kahe päris sessiooni** vastu.

**Mida assistent inimese jaoks teeb, on S4.1.** Lühidalt: laud näitab päeva ühelt ekraanilt ·
kohtumise saab ette valmistada nii, et iga lause päritolu on näha · kohtumise märge hoiab
kaheksa kihti lahus · STAR2-sse kandmise järjekord on nähtav ahel · **kopeerimine ja
ülekantuks märkimine on kaks eri tegu** · ja säilituskell on nüüd mehhanism, mitte lubadus.

**Omanik otsustas 08.08 O-JTA-5: rada C.** Juhtum kannab tegu **„arhiveeri töömaterjal"**, mis
kustutab ettevalmistava töömaterjali sisu (kandmata mustandid ja kohtumise ettevalmistused —
vt O-JTA-6 allpool), ilma et juhtumit arhiveeritaks. See on vastus
küsimusele, mille L7 lahtiseks jättis: ülekantud sisu saab oma 12 kuu kella, **kandmata
töömaterjal ei saanud kunagi ühtegi** ja aastaid aktiivne juhtum hoidis teda tähtajatult.
Rada C ei kustuta midagi kellegi selja taga — inimene teeb teo, süsteem jõustab.

Kolm esimest ringi leidsid nimeliselt neli kohta, kus leping lubas garantiid ilma jõustajata:
CHECK ei oska olekuüleminekut · audit rippus juhtumi küljes, mis säilitusreegli lõpus kustub ·
hoiatus nullis kella, mida ta pidi teenindama (12 → 23 kuud) · „ainus tee `ULE_KANTUD`-ini" ja
teine uks lahti. **Sellepärast kannab iga L-otsus nüüd nime, kes teda jõustab.**

**Neljas ring oli esimene, mis vaatas KOODI**, ja leidis kaks P0-d. Mõlemad olid nähtamatud
arendusmasinal, mille ajavöönd on juhtumisi `Europe/Tallinn`:

- **Eesti kalendripäev sõltus serveri ajavööndist.** UTC-serveris nihkus päev suvel 3 tundi, ja
  `+24 h` tegi DST-päevad (23 h / 25 h) valeks kõikjal. Ühine teostus on nüüd
  `lib/time/estonianDay.js` — kolmest koopiast sai üks.
- **Lapse kirjutuskaitses oli võistlus.** `requireActiveCase()` oli eelkontroll, mitte jõustaja,
  ja retention-siire mahtus kontrolli ja kirjutuse vahele. Jõustaja on nüüd
  `withActiveCaseLock()` — kirjutuse sees.

Lisandusid **L20** (laud tagastab ainult kokkulepitud deskriptori) ja **L21** (lapse
kirjutuskaitse jõustatakse kirjutusega samas atomaarses piiris). **L21 ei ole uus semantika** —
JUHTUM-V1 L14 nõudis seda juba v3-st; teostus rikkus oma enda reeglit laste peal. Parandus on ka
baaslepingus (v7).

**Muster, mis neljandas ringis välja tuli.** Kolm esimest ringi leidsid „garantii ilma
jõustajata". Neljas leidis **„jõustaja nimetatud, aga vales kohas"** — kood oli mõlemal korral
täpselt nii kirjutatud, nagu leping nõudis, ja ikkagi vale. Sellest tuli reegel, mis kehtib
edasi: selline garantii vajab testi, mis **kukub vana teostuse peal**, mitte ainult testi, mis
uuel roheline on.

**E1 (laua koondlugeja) on koodis:** `lib/casework/workbench.js` koondab kaheksa sektsiooni
olemasolevatest lugejatest, 0 migratsiooni. Kolm uut lugejat läksid omaniku-moodulisse, mitte
lauda (L10) — neist **neljas oli leid**: võrgustikujagamiste nimekirja päring elas
marsruudi sees ja moodulil ei olnud ühtegi lugejat, seega laud oleks pidanud kirjutama oma
`findMany`-t.

**Väravad:** `npm test` **2953/2953** — jooksutatud nii `Europe/Tallinn` kui `UTC` all ·
`i18n:check` OK · eslint puhas · `case:probe` **58/59** päris andmebaasi vastu.

**`NOT_PROVEN`:** sondi E6 rida nõuab serverit lipuga `CASEWORK_V1_ENABLED=1`, mis oli väljas.
Teenuskihi read läbivad, **marsruudikiht on selle ringiga tõendamata**. See ei ole `FAIL` — aga
sondi ei tohi nimetada roheliseks enne, kui server on õige lipuga käivitatud.

**Kõrvalsaak:** A4 loakontrolli `estonianDayEnd()` kandis sama viga — luba kehtis 29.03 tunni
liiga kaua ja suri 25.10 tunni liiga vara. Parandatud **eraldi commit'is** samale ühisele
helperile, et loakontrolli semantika muutus jääks auditeeritavaks ilma JTA muudatusteta.

### Viies audit (08.08): kaks uut lukku ja üks päris lahtine otsus

**Omanik andis E2–E5-le rohelise tule ja pani E6/E7 luku ette kaks küsimust.** Kontrollisin
mõlemad koodist ja lepingust — mõlemad pidasid paika, ja kolmandaks tuli tekstivõlg, mida
kumbki pool ei olnud nimetanud.

- **L22 — `COPIED_FOR_STAR2` idempotentsus.** L16 kirjeldas ausalt juhu „lõikelaud õnnestus,
  audit ebaõnnestus", aga mitte teist serva: kui klient **ei tea**, kas `POST` jõudis kohale,
  on kordus ainus mõistlik käitumine ja append-only tabel võtab ta vastu — **kaks auditirida
  ühe päris kopeerimise kohta**. `markTransferred` oli kaitstud tingimusliku siirdega,
  `recordCopyEvent` ei olnud millegagi. Jõustaja on **unikaalne indeks**
  `[draftId, clientActionId]`, võti sünnib kliendis enne lõikelauda, kokkupõrge annab **200**
  (üks tegu = üks tulemus). Migratsioone ei lisandu.
- **L23 — arhiveerimine ütleb kella välja ENNE tegu.** Mõõdetud koodist: olemasolev tekst
  (`casework.page.retention_hint`, [CaseWorkDetail.jsx:591](components/casework/CaseWorkDetail.jsx:591))
  ütleb „ühesuunaline, tagasiteed ei ole" — ja ei ütle, **mis kell käima hakkab**. See tekst oli
  oma ajal täielik, sest JUHTUM-V1-s ei olnud kella; kell tuleb selle lepinguga, seega **võlg on
  JTA oma**. 30 päeva hoiatus jääb, aga ta saabub 11 kuud pärast otsust, mida enam muuta ei saa.
- **O-JTA-5 — hüljatud töömaterjali säilitus. Lahtine, omaniku otsustada.** L7 jätab `MUSTAND`
  ja `EI_KANTA` teadlikult kellata ja see on õige vastus **varju-registri** küsimusele — aga mitte
  **andmeminimeerimise** omale. Õ2 12 kuud katab ülekantud sisu; L15 kaskaad katab kustuva
  juhtumi. Vahele jääb juhtum, mis on aastaid `ACTIVE` — ja pikk aeglane juhtumitöö ongi norm,
  seda ütleb L7 ise. Kolm rada lepingus, **soovitus on rada C** (töötaja tegu „arhiveeri
  töömaterjal"), sest ta ei nõua uut jälge ega uut vaikset kustutust. Ükski rada ei muuda
  migratsioonide arvu.

Neljas leid ei saanud lukku: **2500 ms `Promise.race` ei katkesta DB-päringut**. See jääb
teadlikuks kompromissiks; E8 sond hakkab `TIMEOUT`-sektsioonide arvu mõõtma, et number oleks
olemas enne kui ta probleem on. Päringu tühistamine on omaette töö mõõdetud määra peal.

Ja üks dokumendiparandus: pealkiri „Lahtised otsused — ükski ei blokeeri ehitust" oli eksitav,
sest kõigil ridadel seisis juba V1 vastus. Teostaja jaoks tähendab „lahtine" seda, et tal ei ole
õigust valida. Nüüd on „V1 vaikeotsused" ja päris lahtine otsus (O-JTA-5) seisab eraldi.

### E2 tehtud (08.08): laud on nähtav

**Juhtumitöö laud on pind, kust sotsiaaltöötaja ja teenuseosutaja näevad oma päeva ühelt
ekraanilt:** mis eelpöördumine on saabunud, kellega on täna kontakt, millised juhtumid on
töös, mis info on puudu või kontrollimata, kellega on järgmine kontakt, mis võrgustikujagamine
ootab tegu, mis on meetodipeeglis ja mis ootab kovisiooni. Iga rida viib sinna, kus tegu
tehakse — **laual endal ei ole ühtegi nuppu, mis midagi muudaks.**

**Tühi sektsioon ütleb, MIKS ta tühi on**, ja neid põhjuseid on neli: tööd ei ole · seda
tööriista sinu rollil ei ole · allikas ei jõudnud vastata · allikas on katki. Need tähendavad
vastupidiseid asju ja üks hall kast oleks neist kolm valeks teinud. Ühe allika tõrge ei võta
lauda maha.

**Laud ei ole koormuse mõõdik ja see on arhitektuur, mitte lubadus.** Ainus arv pinnal on ühe
juhtumi lahtiste punktide oma; mahajäämust, keskmisi, tähtaja ületamise märgiseid ega võrdlust
eelmise perioodiga ei ole ja neid ei tule. ⓘ juhend ütleb selle välja koos kolme ülejäänud
piiriga (laud on isiklik · keegi teine ei näe sinu oma · AI ei otsusta ega järjesta).

Väravad: `npm test` **2978/2978** — jooksutatud nii `Europe/Tallinn` kui `UTC` all ·
`i18n:check` OK · eslint puhas · `npm run build` OK · 0 migratsiooni.

**Kuues audit (08.08) leidis kolm parandust ja need on tehtud.** Kandev neist:
**sektsiooni oleku semantika oli pinnal fail-open** — kuju valiti ridade arvu järgi ja olekut
loeti ainult siis, kui ridu ei olnud, seega `FORBIDDEN` või `TIMEOUT` koos ridadega oleks
kuvanud read ja oleku vaikides ära visanud; tundmatu olek ütles kasutajale „tööd ei ole" siis,
kui laud tegelikult ei teadnud. Server hoiab neid olekuid täna tühjana, **aga pind saab
HTTP-vastuse ja ei tohi sõltuda sellest, et teine pool end korralikult üleval peab.** Otsus
kolis JSX-ist välja omaette moodulisse, sest testijooksja ei teisenda JSX-i — ja alles siis sai
teda päriselt testida: **neli testi üheksast kukuvad vana teostuse peal, kontrollitud.**
Ülejäänud kaks: sisenavigatsioon käib nüüd `next/link`-iga (toores ankur laadis rakenduse
uuesti) ja ebaõnnestunud värskendus **ütleb välja**, et andmed on eelmisest laadimisest, ning
pakub „Proovi uuesti" — varem jäi vana laud ekraanile vaikides ja ainus väljapääs oli lehe
taaslaadimine.

**Kaks leidu tulid brauserist, mitte testidest** — mõlemad on nüüd regressioonitestiga lukus.
Esiteks lekkis K1 tööruumi pealkiri **tõlkevõtmena**: laual seisis „workspace.kind.pre_inquiry",
sest sisuta tööruum annab `title`-ks võtme (pealkiri ei tohi kanda kliendi sisu) ja nimega
tööruum annab teksti. **Kuju oli õige, tähendus vale** — kuju-test ei saanudki seda näha.
Teiseks oli tuletatud aadress katkine: `pre_inquiry` (tööruumi liik) ja `pre_inquiries`
(töölaua võti) ei ole sama string. Nüüd on nimeline marsruudikaart ja test kontrollib, et iga
siht on **päris leht**. Kolmas leid oli kääne: „1 lahtist punkti" → „lahtisi punkte: 1".

**Ja üks võlg tuli E1-st välja:** koondlugeja saatis välja kaks `notice`-võtit, mida **üheski
sõnastikus ei olnud**. E1 oli teegikiht, seega ainus koht, kus see oleks paistnud, oli pind —
ja pinda ei olnud. Test loeb need võtmed nüüd koondlugeja **koodist**, mitte nimekirjast.

### E3 tehtud (08.08): kohtumise ettevalmistus

**Töötaja saab kohtumise ette valmistada nii, et hiljem on näha, kust iga lause tuli.** Juhtumi
juurde saab luua ettevalmistuse (üks kohtumine = üks ettevalmistus, neid võib olla mitu) ja
selle sisse viis välja: kohtumise eesmärk, vajalikud dokumendid, eluvaldkonnad, päevakord ja
selgitused lihtsas keeles. Kõrvale käivad **täpsustavad küsimused** ja **kliendiga
kontrollitavad väited** — kaks eri asja, mida ei valata kokku: küsimus otsib infot, väide
kinnitab olemasolevat.

**Kandev asi ei ole vorm, vaid päritolu.** Iga väli ja iga küsimus kannab **oma** märgist —
mitte üks jäme märgis terve ettevalmistuse peal. Nii saab öelda „eesmärgi kirjutas töötaja,
lihtsas keeles selgituse koostas AI", mis on täpselt see, mida leping lubab.

**Ja AI märgist ei saa vaikselt maha võtta.** Teksti parandamine **ei muuda** märgist: server
eirab saadetud väärtust. Märgis muutub ainult eraldi teoga („kinnita päritolu"), see käib
ainult suunas AI mustand → inimese märgis, ja **tagasiteed masina märgise juurde ei ole** —
see kirjutaks inimese kinnituse ümber. Liides kannab kinnitusnuppu ainult AI mustandi real.

**Puuduvat infot ettevalmistusse ei kopeerita** — ta loeb juhtumi enda loendit. Koopia oleks
teine tõde ja läheks esimese lahendamise järel originaalist lahku.

Väravad: `npm test` **2995/2995** (`Europe/Tallinn` ja `UTC`) · `i18n:check` OK ·
`db:migrate:check` OK (**130 migratsiooni**) · eslint puhas · `npm run build` OK.

**Kolm asja, mis lepingust erinesid.** Esiteks: leping lubas uut marsruuti põhjendusega
„juhtumi detailvaade täna ei ole" — **koodist mõõdetuna oli see vale** ja JUHTUM-V1 oli
teadlikult valinud ühe marsruudi. Ettevalmistus läks olemasolevasse detailvaatesse; leping on
parandatud. Teiseks: **migratsioon on käsitsi kirjutatud**, sest `migrate diff` arendusbaasi
vastu tõi kaasa võõra triivi — kokku liidetuna oleks „lisa kolm tabelit" migratsioon kustutanud
võõra tabeli. Kolmandaks leid päris sessioonidest: **kinnitamise 404 käis suunakontrolli
järel**, seega võõras töötaja sai ühelt rajalt 400 ja kõigilt teistelt 404. Andmeid ei lekkinud,
aga omanikule oli vastus eksitav — olematu välja kinnitamine ütles „ainult AI mustandit saab
kinnitada". Järjekord on nüüd `rida olemas? → suund? → tingimuslik update`.

**Tõendatud päris andmebaasi ja kahe päris sessiooni vastu**, sh **kaskaad**: juhtumi kustutus
viis prep-i, välja ja küsimuse kaasa (1/1/1 → 0/0/0), kontrollitud loendusega.

### E4 tehtud (08.08): kohtumise märge kaheksa kihiga

**Kohtumise järel kirjutab töötaja märkme, milles kaheksa kihti ei ole kokku valatud:**
kliendi enda vaade · faktilised asjaolud · töötaja tähelepanek · kontrollimata info ·
kokkulepped · järgmised sammud · STAR2-sse kantav info · privaatne professionaalne
refleksioon. Iga rida kannab lisaks **oma päritolu**. Märkme saab siduda kohtumise
ettevalmistusega, aga ei pea.

**Pinnal on kaheksa eraldi plokki, mitte üks loend siltidega** — ja see ei ole
kujundusvalik. Kui kliendi enda sõnad ja töötaja tõlgendus seisavad ühes voos, loeb inimene
neid ühe tekstina ka siis, kui igal real on silt küljes. Eraldi plokk sunnib **kirjutamise
hetkel** valima, kuhu rida käib.

**Märget ei kustutata.** Ettevalmistus on tulevikuplaan ja teda tohib kustutada; märge
kirjeldab seda, mis juba juhtus. Üksik kirje on eemaldatav, märge tervikuna mitte.

**Privaatne refleksioon on lukus mõlemas suunas.** Leping lubab, et see kiht ei lähe STAR2-sse
kunagi, ja paneb kontrolli E6-sse. Ehitades tuli välja, et **ilma kihikeeluta on see kontroll
teatrike**: kirje liigutatakse „STAR2-sse kantavasse" ja läheb välja, ilma et kuskil tekiks
jälge. Nüüd keeldub server ümbernimetamisest mõlemas suunas. Teksti tohib parandada — keeld
käib kihi, mitte kirje kohta. Kui midagi peab päriselt STAR-i jõudma, kirjutab töötaja selle
STAR2-kihti; see on autorlus, mitte silt ümber.

Väravad: `npm test` **3019/3019** (`Europe/Tallinn` ja `UTC`) · `i18n:check` OK ·
`db:migrate:check` OK (**131 migratsiooni**) · eslint puhas · `npm run build` OK.

**Kaks FK-semantikat on tõendatud, mitte eeldatud:** ettevalmistuse kustutus jättis märkme
alles koos kõigi kaheksa kirjega (seos nullitakse) — plaani kustutus ei tohi kaasa võtta
tõendit selle kohta, mis päriselt räägiti; juhtumi kustutus viis märkmed ja kirjed täielikult.
Teine töötaja sai kõigilt kuuelt rajalt **404**, sh kihikeeldu rikkuva kehaga.

**Üks lahtine ots, mis väärib sinu otsust:** märkmel **ei ole** päritolu kinnitamise rada
(ettevalmistusel on). Leping ei anna talle marsruuti, seega ma ei leiutanud seda juurde — aga
tagajärg on, et AI mustandi märgisega märkmerida ei saa V1-s inimese märgiseks kinnitada, teda
saab ainult eemaldada ja uuesti kirjutada.

**Ja üks dev-serveri lõks kirja:** uus sügavalt pesastatud marsruudikaust ei jõudnud juba
töötava dev-serveri registrisse ja vastuseks tuli Next-i **HTML 404**, mitte teenuskihi JSON —
see näeb välja täpselt nagu omanikupiiri viga. Kontroll on `content-type`; restart lahendas,
koodis viga ei olnud.

### Seitsmes audit (08.08): seitse leidu PINNAL, mitte teenuskihis

**Kandev õppetund: kõik senised väravad olid rohelised.** Teenuskihi sviit, marsruudileping ja
IDOR-sond ei näinud ühtegi neist — nad kõik elasid kasutajaliideses. Pind võib kõiki teenuskihi
garantiisid austada ja ikkagi **kaotada kasutaja teksti või salvestada ta vale objekti alla**.
Neli olid P1 andmeterviklusega ja kõik seitse on parandatud.

- **Vormi olek kandus teise objekti.** Märkme vahetamisel jäid editor ja kihiplokid samadeks
  komponentideks — märkmes A pooleli jäänud teksti sai salvestada **B alla**. Nüüd võtab
  `key` puu maha, aegunud päring visatakse ära ja **avatud märkme aeg on ekraanil**.
- **Päritolu oli eelvalitud.** Rea sai lisada märgist teadlikult valimata — L4 otsene
  rikkumine, ja märkmel ei ole hiljem parandusrada. Nüüd on „Vali päritolu" ja nupp on kinni.
- **Tõrge kustutas sisestuse.** Ebaõnnestunud salvestus tühjendas välja — töö kadus ja põhjust
  ei olnud näha. Nüüd tühjeneb väli ainult õnnestumisel.
- **Vanemad kui 25 kirjet olid kättesaamatud** — teenuskiht toetas lehekülgi, pind viskas selle
  ära. Nüüd on „Näita rohkem".
- **Pöördumatud kustutused ühe vajutusega.** Uus kaheastmeline kinnitusnupp märkme kirjel,
  ettevalmistusel, küsimusel ja **kliendiviitel**. Tagasivõtuakent ei pakuta: kliendiviide ei
  tule tagasi ka konto kustutamise rajalt — **lubadus, mille taga ei ole mehhanismi, on halvem
  kui küsimus**.
- **Murdarvuline `limit` andis Prisma vea, mitte 400.** `?limit=1.5` → `take = 2.5`. Fake-prisma
  ei valideeri argumente, seega sviit oli roheline. **Sama rida oli seitsmes koopias** — nüüd üks
  normaliseerija viies moodulis.
- **Detailvaate lehevahetus oli veakäsitlusest väljas** — nupp ei lukustunud ja tõrge jäi
  näitamata.

Väravad pärast parandusi: `npm test` **3031/3031** (`Europe/Tallinn` ja `UTC`) · `i18n:check` OK
· eslint puhas · `npm run build` OK. Brauseris mõõdetud: vormi tühjenemine märkme vahetusel,
päritolu sundvalik, teksti säilimine sunnitud tõrke korral, kinnitusnupu kaks astet ja
`limit=1.5` → **400** (varem 500).

### E5 tehtud (08.08): STAR2-sse kandmise ahel

**Töötaja näeb, kus iga STAR2-sse minev tükk parajasti on.** Juhtumi alla saab luua kaheksa
liiki elemente (pöördumise kokkuvõte, abivajaduse hindamine, eluvaldkonna kirjeldus, eesmärgi
sõnastus, tegevus, vastutaja ja tähtaeg, kohtumise märge, teenuse suunamise alus) ja igaüks
neist liigub ühes suunas: mustand → vajab kontrollimist → kontrollitud → valmis kandmiseks.
**„Ei kanta" on teadlik lõpp**, mitte seisma jäämine, ja mõlemad lõpp-punktid on
kirjutuskaitstud.

**Olekumasinat ei projekteeritud** — kuus seisu ja lubatud üleminekud olid koodis olemas ja
kasutamata (`lib/workspaces/provenance.js`); E5 andis neile salvestuse. Iga väli kannab **oma**
päritolu, mitte üks märgis terve elemendi peal.

### E6 tehtud (08.08): kopeerimine ja ülekandeajalugu

**„Kopeeri STAR2 jaoks" annab teksti, mille esimene rida ütleb välja, et tegemist on
ettevalmistava mustandiga ja ametlik kanne sünnib STAR-is.** Lõikelaualt läheb tekst kuhugi,
kus keegi teine võib teda ilma kontekstita lugeda — hoiatuseta näeks ta välja nagu ametlik kanne.

**Kopeerimine ja ülekantuks märkimine on kaks eri tegu ja neid ei valata kokku.** Kopeerimine
ei muuda midagi; „märgi üle kantuks" on **avaldus**, et info on STAR-is, ja alles tema käivitab
säilituskella. Kui kopeerimine märgiks automaatselt üle kantuks, hakkaks kell käima hetkest, mil
keegi ainult vaatas.

**Ajalugu kannab tegu, aega ja VÄLJADE NIMESID — kopeeritud teksti seal ei ole.** Täissnapshot
oleks varju-register, ehitatud selle mehhanismi sisse, mis pidi teda ära hoidma: mustandi sisu
kustuks 12 kuu pärast, aga sama sisu elaks auditis kuni juhtumi lõpuni.

**Kaks tõrget saavad eri teate ja teine on tahtlikult ebamugav:** „ei õnnestunud kopeerida" +
plokk jääb ekraanile käsitsi valimiseks, versus **„kopeeritud, aga jälge ei õnnestunud
salvestada"**. Vaikne tõendi kadu on halvem kui nähtav. Korduskatse kannab **sama** tunnust,
seega üks tegu jääb auditis üheks reaks ka siis, kui võrk katkes.

**Laud sai täis:** L12 kanoonilise tabeli kümme sektsiooni on nüüd kõik olemas — juurde tulid
„STAR2-sse kandmist ootavad mustandid" ja „STAR2 ülekandmise ajalugu". **Sektsioon #4 oleks
pidanud tulema juba E5-ga ja jäi tegemata** — see leiti E6 ehitades lepingu tabelit koodiga
kõrvutades.

### E7 tehtud (08.08): säilitus on nüüd mehhanism, mitte lubadus

**Kolm tööd, üks öine käivitus** (`npm run casework:retention`): ülekantud mustandi **sisu**
kustub 12 kuud pärast ülekannet · arhiveeritud juhtumi omanik saab hoiatuse **30 päeva** ette ·
arhiveeritud juhtum kustub 12 kuud pärast arhiveerimist, kaskaadis koos kõigi lastega.
**Loendus on juhtumil ja mustandil nähtav kogu aja**, mitte alles hoiatuse hetkel, ja ta tuleb
samast valemist, mille järgi kustutus päriselt juhtub.

**Kell käib teadlikust teost, mitte puutumatusest.** Juhtumi kell algab päris üleminekust
`ARCHIVED`-i, mitte viimasest muudatusest — „12 kuud puutumata → kustub" tapaks pika ja aeglase
juhtumitöö, mis ongi valdkonna norm.

**Ja arhiveerimine ütleb kella välja ENNE tegu.** Vana tekst ütles „ühesuunaline, tagasiteed ei
ole" ja oli oma ajal täielik — kella siis veel ei olnud. Nüüd ütleb kinnitus välja kolm asja:
käivitub 12 kuu kell, lõpus kustub **kogu juhtum koos lastega**, ja tagasiteed ei ole.
30 päeva hoiatus jääb, aga ta saabub 11 kuud pärast otsust — aus hoiatus vales kohas ei ole
hoiatus, vaid teade.

**Üks asi on lepingust erinev ja tema hind on migratsioon.** O-JTA-5 lubas, et ükski rada ei
lisa migratsiooni. Koodist mõõtes oli see vale: E5 andmebaasi-`CHECK` keelab sisu kustutamise
mustandil, mida ei ole üle kantud — ja rada C on täpselt see juht, ainult et teadlik. Purge sai
**põhjuse** ja garantii kitsenes automaatsele rajale, selle asemel et ta lihtsalt maha võtta.

### E8 tehtud (08.08): tõend

`npm run jta:probe` — **31/31** päris andmebaasi vastu, marsruudikiht **kahe päris sessiooniga
HTTP kaudu**, mitte teenuskihi otsekutsega (04.08 IDOR-i õppetund). Tõendatud nimeliselt: kaks
töötajat on üksteise laudadest pimedad · võõra juhtumi mustand, plokk, ajalugu, kopeerimine,
ülekantuks märkimine ja töömaterjali arhiveerimine annavad kõik **404, mitte 403** ·
kirjutuskaitstud juhtumi laps ei muutu · **privaatne refleksioon ei esine ülekandeplokis üheski
vormis** · auditirida ei kanna ühtegi kopeeritud väärtust · ebaseaduslik ja aegunud üleminek
annavad 400/409 · kaks samaaegset siiret → üks 200, teine 409.

**Brauseris läbi käidud päris sessiooniga:** kopeerimine (sh lõikelaua tõrke rada — **audit jäi
õigesti kirjutamata**), ülekantuks märkimine kaheastmelise kinnitusega, säilituskella loendus
arhiveeritud juhtumil ja rada C, mis kustutas kandmata mustandi sisu ja jättis ülekantud oma
puutumata. Säilitusskript jooksutatud päris andmebaasi vastu kuivalt, päriselt ja teist korda —
**hoiatus läks üks kord**.

**Üks leid tuli brauserist:** mustandi sektsioon lubas endiselt, et ülekantuks märkimine
„tuleb järgmise etapiga" — tekst oli E5-aegne ja E6 oli ta juba kohale toonud. Parandatud
kolmes keeles.

### O-JTA-6 otsustatud (08.08): rada C katab ka ettevalmistused

**Esimene kuju kattis ainult mustandeid** — see oli lepingu sõnastus tähttäheline, aga jättis
katmata otsuse enda motiveeriva näite: kaks aastat vana kohtumise ettevalmistus, milles on
kliendi sisu. Tegu, mis ei kata seda, mida ta lubab, on halvem kui puuduv tegu.

**Omanik otsustas: laiendada + purge-marker ettevalmistusel.** Nüüd kustutab „arhiveeri
töömaterjal" **kogu ettevalmistava töömaterjali sisu** — kandmata mustandid ja kohtumise
ettevalmistused —, aga **kummaski ei kustu rida**: mustandil jääb ülekande tõend, ettevalmistusel
jääb konteiner koos oma seosega märkmega. Plaani kustutamine ei tohi viia kaasa tõendit selle
kohta, mis päriselt räägiti.

**Purge'itud ettevalmistus on kirjutuskaitstud** ja see ei ole lisapiirang, vaid sama lubaduse
teine pool: „sisu on arhiveeritud" on avaldus, mille peab saama uskuda ka viie minuti pärast.
Uus kohtumine tähendab uut ettevalmistust.

**Märge jääb puutumata** — E4 ütleb, et märget ei kustutata. Ettevalmistus on tulevikuplaan,
märge kirjeldab seda, mis juba juhtus.

**Ettevalmistusel ei ole kella ja seda jõustab andmebaas:** ainus lubatud purge-põhjus on
töötaja tegu. Automaatne säilitustöö ei saa siia kirjutada ka siis, kui keegi ta tulevikus
kogemata sinna suunaks.

**Kolm otsust langesid samal päeval** ja nad on lepingus lukus:

| Kood | Küsimus | Vastus 07.08 |
|---|---|---|
| **O-CW-4** | JTA konteiner vs adapterid | **suletud faktiga** — konteiner on ehitatud (JUHTUM-V1). Analüüsi soovitus oli „adapterid kuni tõendatud vajaduseni"; teostus vastas küsimusele enne, kui ta otsusena esitati |
| **O-JU-1 + O-CW-2** | juhtumi ja ülekantud mustandi säilitus | **kirjutuskaitse + 12 kuud arhiivis + kustutus.** Jõustamise kuju on lepingus L7: kell käib **`ARCHIVED`-ist**, mitte viimasest muutmisest; loendus on juhtumil nähtav; hoiatus 30 päeva ette; **vaikset kustutust ei ole** — automaatne kustutus, millest töötaja ette teada ei saa, hävitaks tema enda töö ilma taastevõimaluseta |
| **O-CW-10** | „Kopeeri STAR2 jaoks" auditisügavus | **fakt + väljade loend**, mitte täissnapshot. Auditikirjed on append-only ja ükski säilitusreegel ei ulatu nendeni — täissnapshot oleks varju-register, ehitatud selle mehhanismi sisse, mis pidi teda ära hoidma |

**Ulatus oli järjestatud otsuste järgi, mitte teemade järgi:** E1–E2 (laud) migratsiooni- ja
otsustevabana esimesena, STAR2-mustandite ahel (= **CASEWORK-P2**) viimasena. **Kõik kaheksa
etappi said 08.08 valmis**, aga Õ2 ei kadunud kuhugi: ta ei blokeerinud EHITUST ja blokeerib
**avamist** — värav on väljas ja avamine vajab omaniku luba JA Õ2/Õ3 kinnitust.

**Kaks mõõdetud fakti kujundasid lepingut.** Esiteks: **STAR2 ülekande olekumasin on koodis
juba olemas ja kasutamata** — `lib/workspaces/provenance.js` kannab kuut seisu, lubatud
üleminekuid ja `canTransitionStar2()`-t, ning faili enda kommentaar näeb ette, et ebaseaduslik
üleminek annab „409 once the state is persisted in P2". E5 ei projekteeri olekumasinat, ta
annab olemasolevale salvestuse. Teiseks: **laua kümnest sektsioonist kaheksa on lugemistöö** —
allikad (`listReceivedCaseWork`, `listCaseWorkAssists`, `countOpenMissingInfo`,
`listPracticeReflectionWorkspaces`, COLLAB-P4 jagamised, `TopicSeed`) on kõik olemas.

**JTA-V1 elab sama värava taga** (`CASEWORK_V1_ENABLED`) — uut lippu ei looda. Assistent ilma
juhtumi objektita on mõttetu ja juhtumi objekt ilma assistendita poolik; kaks lippu annaks neli
kombinatsiooni, millest kaks on katkised olekud.

### Eelmine samm — omaniku valik

**T03 E4/E5 punktid 1–4 (hääle karastus) on 03.08 tehtud, deploy'tud ja LIVE.** Vt S3.
Selle sees läks kinni ka S4.2 nr 5–8.

**Eesti TTS on 03.08 LIVE TartuNLP `kylli` häälega ja teema on LUKUS.** `TARTUNLP_TTS_URL`
ja `TARTUNLP_TTS_SPEAKER=kylli` on serveris seatud, Google jääb varuks; serveri
kättesaadavus kontrollitud (HTTP 200, 0,54 s). Hääl valitud · privaatsustingimused
uuendatud (`PRIVACY_VERSION` = `2026-08-03`) · kasutusluba omaniku kinnitusel olemas ·
ise-hostimist ei tehta (server ei kanna, tasuta on niigi saavutatud). Kaks saba läksid
**T27-sse** (S10): seadmematriks ja art. 28 paberitöö. Täielik lugu on S3-s.

**Omanik valis 04.08: tehakse kõik neli** — salvestuse nõusolekukeel (tehtud, vt S7),
COLLAB-P4, A2 eelkalkulaator ja deploy. **Kõik neli on tehtud**, deploy 05.08. Selle peale
tuli omaniku viies valik: **SOTSIAALKIIRABI-V1**, mis on samuti tehtud ja välja läinud.
Tehtud järjekord:

| Kandidaat | Seis |
|---|---|
| **Salvestuse eesmärgisildid + nõusolekukirje keel** (S4.2 nr 4) | **TEHTUD 04.08** |
| ~~A2 toimetulekutoetuse eelkalkulaator~~ | **VALMIS 04.08** — vt S2 „Tehtud". Sabad: P2 checklist, P3 kontota versioon, P4 KOV piirmäärad |
| **COLLAB-P4 võrgustiku vertikaal** (S4.1) | **V1–V4 TEHTUD 04.08 — vertikaal on suletud**: domeenikiht, ruum, 8 API-marsruuti, kliendi otsustussektsioon, töötaja koostamisvorm ja saaja vaade. **Rada tõendatud 04.08 kolme päris sessiooniga** ja selle käigus leitud + parandatud **IDOR**: iga töötaja sai luua jagamise võõrast eelpöördumisest. Leping on mustand ja ootab kinnitust ([`collab-p4-vorgustiku-vertikaal-ulesanne.md`](./collab-p4-vorgustiku-vertikaal-ulesanne.md)) |
| **SOTSIAALKIIRABI-V1** (omaniku valik 05.08) | **E1–E6 TEHTUD 05.08 — tervik on koodis ja peidus.** Vt S2 „Tehtud" ja S5. Rada tõendatud päris andmebaasi ja päris sessioonidega, nelja identiteediga; brauseris läbi käidud pöörduja vorm, kriisiekraan, laua koondvaade ja admini laudade register. Aktiveerimine ootab partnerit — vt „Mis avab" allpool |
| **JUHTUM-V1 juhtumi objekt** (omaniku valik 06.08) | **E1–E6 TEHTUD 07.08 — tervik on koodis ja peidus.** Vt eespool ja S4.1. Aktiveerimine vajab omaniku luba JA Õ2/Õ3 andmekaitseanalüüsi kinnitust |

**Uus teema 05.08: A4 MTR/tegevusloa kontroll — E1–E6 tehtud, E7 otsuse taga.** Leping on v2 kujul olemas
([`a4-mtr-tegevusloa-kontroll-ulesanne.md`](./a4-mtr-tegevusloa-kontroll-ulesanne.md)) ja
**E1–E3 on tehtud** — allikaklient `lib/mtr/licences.js`, vastavustabel
`lib/mtr/licensedServices.js`, andmemudel (migratsioon `20260805170000_a4_mtr_licence_check`:
4 tabelit, 3 enum'i) ning seisuloogika `lib/mtr/assessment.js` + `lib/mtr/policy.js`; kokku
53 testi. Lisaks on **E4 teenuskiht** (`lib/mtr/licenceCheckService.js`) olemas — ahel
identiteedivärav → lubade päring → kirje → iga teenuse hinnang; tegemata on ainult liides.
**E4–E6 on samuti koodis:** teenuskiht, tekstikiht (`lib/mtr/statusText.js` on ainus koht, kus
seisust saab tekst), osutaja API ja vaade eraldi failina, ET/EN/RU tekstid seitsmele seisule,
**avalik märgis teenusekaardil** ja **ajastatud korje** (`npm run mtr:refresh` kord tunnis,
austab `nextCheckAt`-i, käib profiilid ükshaaval; viis admini alarmisignaali rajal
`GET /api/admin/licence-alarms`). **Neljas ülevaatus leidis veel ühe päris vea:** profiili
salvestamine tegi teenustele `delete + create` ja kustutas kaskaadis kogu loahinnangu —
osutaja oleks kaotanud märgise iga kirjavea parandusega. Nüüd uuendatakse rida kohapeal ja
sond tõendab seda päris andmebaasis (44/44; sond tõendab nüüd ka teenuskihi enda atomaarsust,
mitte ainult seda, et Prisma tehing veereb tagasi). **Sidumisoperatsioon on tehtud**
(`lib/mtr/serviceBinding.js` + admini rada): ainus koht, kus `serviceKey` muutub, vana tõend
kustub kohe ja iga muudatus jätab auditijälje. Automaatset sidumist nime järgi ei ole —
kandidaate pakutakse, kinnitab inimene. **Rütm on lukus (omanik 05.08):** edukas kontroll →
14 päeva, tõrge → 1/6/24 h, positiivse märgise värskus → 16 päeva (kahepäevane puhver, et üks
ebaõnnestunud kontroll ei kustutaks märgist), käsitsi ≤1× 15 min, cron `0 * * * *` koos
`flock`-iga. **RAG-otsus tehtud 05.08:** tegevusloa seis tohib
jõuda assistendini **piiratud usaldussignaalina** (`lib/mtr/licenceSignal.js`) — kuus välja
pluss kasutusreegel, kontrolliajalugu ja veakoodid mitte. Seis **liidetakse soovituse ajal
andmebaasist**, mitte ei kirjutata RAG-indeksisse: „kontrollitud" on väide, mis aegub, ja
indeksisse kirjutatud tekst ei aegu iseenesest. Sond valvab, et loaseis RAG-dokumenti ei
lekiks. Soovituskihti ennast veel ei ole, seega signaal ootab kasutuselevõttu. **E7 ei ole tegemata
töö, vaid otsuse taga** — O-A4-3 järgi on MTR-luba kiireloomulise osutaja-raja jaoks vajalik,
aga mitte piisav.
**Rada on 05.08 tõendatud elava MTR-i vastu:** identiteet `Masaan OÜ`, kolm luba eristuvate
alateenustega, `Toetatud elamine → VERIFIED`, `Tugiisik → NO_SHS_LICENCE_REQUIRED`.
Elav päring õpetas seitse asja, mida ükski test ega ülevaatus ei näinud (väljundtulbad
asendavad vaiketulpi · peidetud `tulemus_id` väljad · CSV on windows-1257, kuigi päis lubab
utf-8 · mitme kohaga luba tuleb jätkuridadena · kaks paralleelset otsingut ajavad registri
ajapiiri üle) — kõik kirjas lepingus.

**E3/E4 karastati teise sõltumatu ülevaatuse järel** (11 leidu): aegumine ja tõendi seos
salvestatakse ja lugemisrada **jõustab** neid, seega märgis ei ripu üle loa lõpu; `VERIFIED` ja
`ACTIVITY_VERIFIED` on eri seisud; kirje ja hinnangud on üks tehing; loa kuupäevi võrreldakse
**Eesti kalendripäevades**, mitte UTC-hetkedena. Väravad: `npm test` **2826/2826**,
`db:migrate:check` OK (128 migratsiooni), **`npm run mtr:probe` 29/29 päris andmebaasi vastu**
(fake-prisma ei valideeri skeemi).
**E3 kaheksa lukustatud põhimõtet** on lepingus tabelina — kandev on see, et `serviceKey` on
laiendatav string, mitte DB-enum, ja et loakohustuse otsus salvestatakse kontrolli hetke
koopiana, nii et vastavustabeli hilisem muutus ei anna vanale kirjele vaikselt uut tähendust. **Mõlemad
osad karastati sõltumatu ülevaatuse järel.** E1 tõsiseim leid: registri vastuse registrikoodi
ei kontrollitud ja rakendumata filtri korral oleks võõra ettevõtte load tulnud tagasi `OK`-na.
E2 tõsiseim leid: MTR-i üldine „Erihoolekandeteenus" vaste andis `true` kõigile kuuele
alateenusele — nüüd tagastab kaetus seisu (`ACTIVITY_MATCH_ONLY` ≠ `EXACT_MATCH`) ja avalik
„ei vaja luba" on kitsendatud kujule „ei ole MTR-is kontrollitavat sotsiaalteenuse tegevusluba
nõutud", sest tabel ei tõenda muude seaduste lubade puudumist.

**Parandus 05.08: MTR EI OLE jämedam kui seadus.** Registril on erihoolekande lubade jaoks
eraldi väli „Tegevusala liik" kuue väärtusega, mis vastavad täpselt SHS-i alateenustele —
kontrollitud päris filtriga (päeva- ja nädalahoiuteenus = 21 kehtivat kirjet). E1 tellib
väljundtulbad nüüd nimeliselt, seega vaste on täpne; jäme seis jääb ainult varuks. Kataloogi
lisandusid neli loakohustuseta teenust, neist hoolduspere kannab eraldi märget, et sobivust
hindab SKA ja kanne on STAR-is (mitte avalik register), ning sotsiaalnõustamine kannab ausat
`legalBasis: null`, sest kehtivas SHS-is teda eraldi teenusena ei ole. E3–E7 on
tegemata ja kood ei ole veel ühegi vaate küljes. **O-A4-1 ja O-A4-4 said 05.08 vastuse**
(korje 1×/ööpäevas, kehtivus 72 h, korduskatsed 1/6/24 h, käsitsi ≤1× 15 min kohta,
kõik konfiguratsioonis; sidumata teenusel ei ole avalikku silti ja tal on oma seis
`SERVICE_MAPPING_REQUIRED`, mitte „ei saanud kinnitada"). **E3 on teadlikult blokeeritud
vastavustabeli ridade kinnituse taga** — skeem hakkab kandma nende võtmeid. Vt S2 „Tegemata".

Kaks lülitit ootavad ainult otsust, mitte arendust: maksete recurring ja RAG-i
allikavärskuse timerid (S9, S2). Kolmas lüliti on nüüd olemas ja **otsustatud**: RU/EN
ettelugemine jääb tasuta brauserihäälele (`serverTtsLocales()`, vt S3).

Üks kvoodiotsus jäi lahti ja on väike: kas võtta eesti ettelugemiselt `TTS_CHARS` kvoot
ära, kui teenus enam tähemärgi kaupa ei maksa. Täna kulub kvoot edasi.

**Töökord (omanik 03.08, ülimuslik):** tööpuid ja harusid ei tehta, kõik läheb otse
`main`-i. Vt JADATÖÖ-sektsiooni täiendust allpool. Merge'i ja deploy luba küsitakse endiselt
eraldi.

**Viimane roheline mõõtmine** (05.08, A4 järel): `npm test` **2860/2860**,
`npm run i18n:check` OK, eslint puhas, `npm run build` OK,
`npm run db:migrate:check` OK (128 migratsiooni), `npm run mtr:probe` **44/44** ja
`npm run urgent:probe` **16/16** päris andmebaasi vastu.

**Deploy tehtud 05.08 (omaniku luba samal päeval).** Server on **`d7e9fcd5`** — sama mis
`main` ja `origin/main`, deploy'mata ei ole midagi. Välja läksid kolm valdkonda korraga:
COLLAB-P4 vertikaal, A2 kalkulaator (`/toimetulekutoetus`) ja kogu SOTSIAALKIIRABI-V1
(`/kiireloomuline-abi`, `/toolaud/kiireloomuline-abi`, `/admin/urgent-desks`).
Rollback `215fac39`.

Smoke pärast deploy'd: kolm teenust `active` · `/` `/meist` `/vestlus` `/voimalused`
`/kiireloomuline-abi` `/toimetulekutoetus` → 200 · SK API autentimata → 401 ·
teenuselogides **0 viga** · 126 migratsiooni rakendatud, neli SK-tabelit toodangus olemas.

**A4 deploy tehtud 05.08 (omaniku luba samal päeval).** Server on **`8ab68f98`**, 19 commit'i,
128 migratsiooni, kolm teenust `active`. Smoke: avalikud lehed 200 · uued rajad autentimata
401 (`licence-check`, `licence-alarms`, `service-licence-binding`) · neli A4 tabelit toodangus
olemas · `mtr:probe` sihtbaasi vastu **44/44**.

**Sond jättis toodangusse jälje ja see on koristatud.** `ServiceProviderProfile.ownerId` on
`SetNull`, mitte `Cascade`, seega sünteetilise kasutaja kustutamine ei kustutanud profiili,
mille salvestusraja test talle lõi — jäi üks profiil ja üks hinnang. Read on käsitsi
kustutatud (toodangus 0 kontrolli, 0 hinnangut, 0 sünteetilist rida) ja sond parandatud
(`1c99793e`): salvestusraja profiil kustutatakse eraldi ja koristust **kontrollitakse**, mitte
ei eeldata.

### A4 — TEGEMATA (ootab omanikku)

Kood on toodangus, aga **funktsioon on veel dormant**: ükski teenus ei ole kataloogiga seotud,
seega ühtegi märgist kusagil ei kuva. Neli sammu on tegemata ja kolm neist vajavad admini
sessiooni, mida ma ise ei ava.

| # | Mis | Miks tegemata |
|---|---|---|
| 1 | **Üks kontrollitud käsitsi sidumine** (`POST /api/admin/service-licence-binding`) | vajab admini sessiooni |
| 2 | **Avaliku ja sisemise märgise smoke** — teenusekaardi hüpik + osutaja vaade | eeldab sammu 1 |
| 3 | **Tunnine cron** (rida allpool) | serveri cron-tabeli muudatus |
| 4 | **Alarmiraja kontroll** (`GET /api/admin/licence-alarms`) | vajab admini sessiooni |

Cron-rida valmis kujul — `flock` hoiab ära, et pika MTR-i tõrke korral järgmine käivitus
eelmisele otsa jookseks:

```
0 * * * * flock -n /var/lock/sotsiaalai-mtr-refresh.lock \
  /bin/bash -lc 'cd /home/ubuntu/apps/sotsiaalai && MTR_REFRESH_BATCH=10 npm run mtr:refresh' \
  >> /var/log/sotsiaalai/mtr-refresh.log 2>&1
```

Enne esimest käivitust tasub teha `npm run mtr:refresh:dry` — küpseid profiile on täna null,
sest ükski teenus ei ole veel seotud.

**SK-V1 on toodangus ja DORMANT:** `UrgentDesk` 0 rida, `UrgentRequest` 0 rida. Ilma
seadistatud lauata ei ole rada üheski piirkonnas nähtav ega API kaudu kasutatav ja päris
isikuandmeid temas ei teki — see on omaniku 28.07 „ehitus võib alata kohe, värav kehtib
sisselülitamisele" reegli puhas rakendus. Vt „Lüliti" S2-s ja „Mis avab" S4.1-s.

---

## S2. Pöörduja rada

### Tehtud

**Vestlus ja teadmusbaas.**
SotsiaalAI vestlusaken vastab sotsiaalvaldkonna küsimustele eesti, inglise ja vene keeles
ööpäev läbi. Vastus ei tule mudeli mälust, vaid platvormi teadmusbaasist: seadustest,
riigi juhenditest, KOV-ide teenuskirjeldustest ja ajakirja Sotsiaaltöö materjalidest — ja
iga vastuse juures on näha, millisele allikale ta tugineb. Inimene saab kontrollida, kust
lause tuli, ja minna algallika juurde. Vestlus ei nõua kellegi teise järjekorras ootamist
ega tööaega.

Vestlusesse on sisse ehitatud kriisirada: kui jutust tuleb välja vahetu oht elule või
tervisele, katkeb tavaline vastamine ja ette tulevad hädaabi ja usaldustelefonide numbrid.
See lukk töötab kõigis kolmes keeles ja on tahtlikult „fail-safe" — pigem käivitub liiga
tihti kui liiga harva. AI ei hinda kellegi õigust teenusele ega abivajaduse taset; ta
selgitab, valmistab ette ja suunab.

**Teekond.**
Teekond on inimese enda lugu ühes kohas: mis mure on, mida on juba proovitud, kellega on
räägitud, mis on järgmine samm. See ei ole ametniku toimik ega register — kirje kuulub
inimesele endale ja liigub tema otsusel edasi. Teekonnalt saab ühe vajutusega minna
eelpöördumise koostamisse, teenusekaardile või abivahenduse rajale, ilma et midagi tuleks
uuesti kirjutada. Sisse on ehitatud kaks eraldi selgitajat: abivahendi hankimise teekond
(tõend → loetelu → piirhind → müüja) ja tervishoiukontakti rada.

**Eelpöördumine ja vastuvõtulaud.**
Eelpöördumine on inimese poolt ettevalmistatud pöördumine kohalikule omavalitsusele või
teenuseosutajale. Inimene kirjeldab olukorra rahulikult ette, AI aitab selle
struktureerida — aga saadab alati inimene ise ja saatmise hetkel on näha täpselt, mis ja
kellele läheb. Kuni vastuvõtja ei ole kirja avanud, saab pöördumise tagasi võtta. Kõik
saadetu jääb inimesele endale nähtavaks vaates „Minu jagamised".

Vastuvõtja poolel on laud, kus pöördumised seisavad järjekorras koos ettevalmistatud
kokkuvõttega. Ametnik näeb inimese enda sõnu ja AI koostatud struktuuri eraldi ja
märgistatult — masina mustandit ei esitata kunagi inimese ütlusena.

**Teenusekaart ja teenuseprofiil.**
Teenusekaart näitab, millised sotsiaalteenused ja osutajad piirkonnas olemas on, kellele
nad on mõeldud ja kuidas nendeni jõuab. Osutajal on oma profiil, mida ta ise haldab.
Kaardil on kättesaadavuse elav signaal — teenuse info ei jää seisma sinna, kus ta kunagi
sisestati.

**Abisoovid ja -pakkumised.**
Inimene saab kirja panna, millist abi ta vajab, ja teine pool selle, mida ta pakub;
platvorm viib need kokku. Vestlusest saab töövoo käivitada otse — soovi ei pea eraldi
vormilt otsima.

**Isiklik otsing.**
Otsing inimese enda materjali sees: vestlused, teekond, dokumendid, jagamised. See on ainus
otsing platvormil, mis vaatab isiklikku sisu — ja ta vaatab ainult seda, mis kuulub
otsijale endale.

**Dokumendid ja koostamine.**
Dokumendi saab platvormile tuua, lasta sellest teha kokkuvõte või süvaanalüüs ning koostada
uut teksti olemasoleva põhjal. Helisalvestisest tehakse transkriptsioon ja koosolekust
kokkuvõte. Iga AI koostatud osa kannab märget, et tegemist on mustandiga.

**Eksport ja andmekoopia.**
Inimene saab oma andmetest koopia ja saab oma materjali välja viia PDF- või DOCX-kujul.
See lubadus ei sõltu tellimusest: ligipääs oma andmetele ei aegu kunagi.

**Toimetulekutoetuse eelhinnang.**
Inimene saab teada, kas tal võib olla õigus toimetulekutoetusele ja umbes kui palju — enne
seda, kui ta kellegagi räägib või ühtegi blanketti näeb. Kalkulaator küsib pere koosseisu,
eelmise kuu sissetuleku ja eluasemekulud ning näitab tulemuse **koos koosseisuga**: kui suur
on pere toimetulekupiir, kui palju eluasemekulusid arvesse läheb ja mis sissetulekust maha
arvatakse. Number ilma koosseisuta ei ole selgitus.

Kaks piiri on inimesele ette öeldud, mitte tulemuse juurde peidetud. **See ei ole otsus** —
toimetulekutoetuse määrab valla- või linnavalitsus. Ja **arvutus käib inimese enda seadmes**:
sissetulek, pere koosseis ja eluasemekulud ei lähe kuhugi ära ega salvestu. Platvorm teab, et
keegi kalkulaatorit kasutas; ta ei tea, mida sinna kirjutati.

Kui sisendist ei saa ohutult vastust anda, **ei näidata summat** — öeldakse, mis on puudu.
Usutav vale number on siin halvim võimalik väljund, sest inimene teeb tema põhjal otsuse.
Kui omavalitsus kehtestab eluasemekuludele oma piirmäärad, mida kalkulaator ei tea, öeldakse
seegi välja.

**Kiireloomuline abipalve.**
Kui olukord ei kannata hommikuni, saab inimene selle oma sõnadega kirja panna ja saata oma
omavalitsuse vastuvõtulauale. Küsitakse nelja asja: mis toimub, kus sa oled, kuidas sind
kätte saab ja kas keegi on praegu ohus. Rohkem mitte — sissetulek, leibkond ja eluase on
vastuvõtja töö küsida, ja pikk küsimustik kell 23.47 ei ole eelinfo kogumine, vaid filter,
mis jätab välja täpselt need, kelle pärast see funktsioon olemas on.

**Kiireloomulisuse ütleb inimene ise.** Ükski mudel ega märksõnaloend ei järjesta pöördujaid
— järjekord on ajaline ja ainult ajaline. Vastuvõtja näeb inimese teksti **sõna-sõnalt**;
kui AI midagi struktureerib, seisab see eraldi ja märgistatult, mitte inimese sõnade asemel.

Enne saatmist on näha, kuhu ja mis läheb: laua nimi, **millal seda loetakse**, tööaeg, kes
tohib pöörduda, mis see inimesele maksab ja millal tuleb hoopis 112 helistada. Platvorm
lubab ainult **lugemisaega, mitte reageerimisaega** — kohalesõitmine on omavalitsuse otsus,
mitte platvormi lubadus. Saatmine ise ongi nõusolek: eraldi linnukest ei ole, sest inimene
ise palub info edasi saata. Kirje läheb „Minu jagamistesse" ja seda saab tagasi võtta seni,
kuni keegi ei ole seda lugenud.

**Kolm piiri on ette öeldud.** See **ei ole hädaabinumber**: kui vastad, et keegi on ohus,
või kui tekstist tuleb välja vahetu oht, ei liigu vorm edasi — ette tulevad 112 ja
usaldustelefonid, ja mingit järjekorda ei teki. **Vaikus ei ole vastus**: kui laud ei jõua,
peab ta keeldumise põhjendama, ja kui keegi ei vasta lubatud aja jooksul, saab inimene
sellest ise teada. **Ja platvorm ei ole register** — pärast üleandmist on ametlik kandja
omavalitsuse oma; platvormile jääb inimese enda koopia.

**Lüliti on saaja seadistus ise.** Piirkonnas, kus ei ole kokku lepitud vastuvõtulauda koos
lugemisajaga, ei ole nuppu, vormi ega valikut — leht ütleb selle välja ja pakub asemele
teenusekaarti ja eelpöördumist. See ei ole liidese peitmine: server keeldub sellises
piirkonnas pöördumist vastu võtma, seega lekkinud lipp, vana vahemälu ega otse-URL ei suuda
toota nuppu, mis ei vii kuhugi.

### Poolik

| Teema | Mis töötab | Lahtised sabad |
|---|---|---|
| Teadmusbaas | otsing + allikaviited + mõõdetud kvaliteedi lähtejoon | P8.6 päris allikate proovipakk; allikavärskuse timerite aktiveerimine (omaniku otsus) |
| Teekond | tuum LIVE | TK-P0 jagamispiir — **03.08 kontrollimata, ei tea kummaski suunas**; Teekonna kompass (horisont C) |
| Teenusekaart | kaart + kättesaadavus | loendivaade/klasterdamine; usaldusmärgistus — vajab MTR-kontrolli (vt tegemata) |
| Abisoovid | kood valmis | kriitiline mass (kasutajad); match-nõusoleku tooteotsus; moderatsioonimudel |
| Eelpöördumine | täisrada koodis | piloodis tõendamata — vajab KOV-partnerit |

### Tegemata

- **Toimetulekutoetuse eelkalkulaator (A2)** — **funktsioon on valmis** (vt „Tehtud" ülal, leht `/toimetulekutoetus`, konto nõutav). Lahtised sabad: P2 dokumentide kontrollnimekiri · P3 kontota avalik versioon (omanik otsustas 04.08 konto kasuks) · P4 KOV piirmäärade andmekiht (vajab partnerit) · üks õigusküsimus kärpimistehte kohta. Leping: [`a2-toimetulekutoetuse-eelkalkulaator-ulesanne.md`](./a2-toimetulekutoetuse-eelkalkulaator-ulesanne.md).
- **MTR/tegevusloa kontroll (A4)** — avalik register → usaldusmärgise objektiivne alus. Topeltroll: vajalik ka SK-V1 osutaja-raja otsustamiseks (O-SK-5). **Leping v2 + E1–E2 tehtud 05.08** ([`a4-mtr-tegevusloa-kontroll-ulesanne.md`](./a4-mtr-tegevusloa-kontroll-ulesanne.md)) — allikaklient ja vastavustabel on koodis ja testitud, E3–E7 tegemata. **Kaks piirangut tulid ehitades välja:** MTR koondab viis SHS-i erihoolekandeteenust ühe tegevusala „Erihoolekandeteenus" alla, seega märgis ei tohi lubada alateenuse täpsust; ja platvormil ei ole kontrollitud teenusesõnastikku (`categories` on vaba tekst), seega vabatekstist sünnib ainult kandidaat, mitte otsus. **Allikaküsimus on lahendatud:** X-teed ei ole vaja — rada on MTR-i avalik otsing → CSV-väljavõte → parse, mõõdetud 05.08 päris päringuga. **Võti on registrikood, mitte nimi** (sama nimega MTÜ ja OÜ kannavad eri lube). Omaniku otsused 05.08: hoiatus ei ole avalik ega punane · loata teenus jääb kaardile nähtavaks · avalikke tekste on **neli** ja need on neutraalsed, aga täpsed — „ei leitud kehtivat luba" ja „ei saanud kinnitada" on **eri tekstid** (varasem ühine sõnastus „ei ole märgitud" tühistati omaniku ülevaatusega, sest ta vihjas, et osutaja oleks pidanud loa ise lisama). Ülevaatus lukustas veel neli asja: luba seotakse **teenuse ja tegevuskohaga**, mitte firmaga · mahupiir EI ole kättesaadavuse signaal ega lähe V1-s avalikule kaardile · MTR-i veebipäring on ebastabiilne väline sõltuvus (skeemimuutuse tuvastus, alarm, circuit breaker) · **MTR-luba üksi ei ava SK-V1 osutaja-rada** (O-SK-5 vajab lisaks nõusolekut, kontakti, piirkonda ja perioodilist kinnitust).
- ~~SOTSIAALKIIRABI-V1~~ — **E1–E6 TEHTUD 05.08**, vt „Tehtud" ülal. Lahtised sabad on ainult aktiveerimise omad, mitte ehituse: **O-SK-2** (kaks vastutavat töötlejat või vastutav + volitatud), **O-SK-4** (säilitusaeg pärast üleandmist — praegu kirjeid ei kustutata, see on teadlik ootamine), **O-SK-5** (kes lülitab teenuseosutaja raja, mis tõendi alusel — soovitus: MTR-kontroll), **KOV-lepingu 10 punkti** ja **konto nõue** (täna nõutav; kontota rada kell 23.47 on tootepiiri küsimus, mille peab omanik otsustama).

---

## S3. Hääl ja multimodaalsus

Juhtprintsiip (`SotsiaalAI.md` ptk 4): **hääl ja kaamera on liides, mitte teine aju** — iga
sisuline vastus käib läbi sama tekstitorustiku (teadmusbaas + allikad + kriisirada +
kvoodid), mis kannab platvormi lubadusi.

### Tehtud

**Dikteerimine vestlusaknas.**
Kui kirjutamine on raske — käed on kinni, silmad väsinud, olukord ärev või kirjatöö lihtsalt
ei ole inimese tugevus — saab oma mure vestlusaknasse rääkida. Mikrofon on komposeris
tekstivälja kõrval, salvestus käib vajutusega ja kõne muudetakse tekstiks, mille inimene
näeb ja saab enne saatmist parandada. Tekstiväli on alati nähtav ja mikrofon seisab selle
kõrval lisavõimalusena — inimene võib vahetada kirjutamise ja rääkimise vahel keset vestlust.
Alustatud salvestuse saab katkestada nii, et heli ei lähe kuhugi: katkestus kustutab
salvestise enne saatmist ja inimene saab selle kohta kinnituse.

**Ettelugemine.**
Vastuseid saab kuulata eesti, inglise ja vene keeles. See teenib kahte gruppi korraga:
nägemispuudega või lugemisraskustega inimesi ning neid, kes tahavad pikka selgitust kuulata
samal ajal, kui käed on muuga hõivatud. Kui ettelugemine ei õnnestu, öeldakse see välja —
vaikus ei ole vastus.

**Helikõned ruumides.**
Platvormi ruumides saab pidada helikõne — kovisiooniks, supervisiooniks, võrgustikutööks või
kliendikohtumiseks. Kõne toimub platvormi sees, eraldi konverentsitarkvara ei ole vaja.
Salvestamine ei ole vaikimisi sees ja käivitub ainult siis, kui osalejad on selleks
selgesõnalise nõusoleku andnud; salvestise eesmärk märgitakse ette ära.

**Heli dokumentides.**
Salvestisest saab transkriptsiooni ja koosolekust kokkuvõtte. See kaotab ära käsitsi
ümberkirjutamise, mis on üks valdkonna vaiksemaid ajaröövleid — ja kokkuvõte jääb mustandiks,
mille inimene üle vaatab.

**Välitöö dikteerimine.**
Välitöö kestas saab külastuse märkme rääkida kohapeal ära, ka siis, kui internetti ei ole —
kirje läheb järjekorda ja sünkroniseerub, kui võrk tuleb tagasi. Töötaja ei pea kandma
märkmeid peas kontorisse tagasi.

Kõne ja ettelugemine kasutavad platvormi ühiseid arvesteid (`STT_SECONDS`, `TTS_CHARS`,
`CHAT_ASSISTANT_REPLY`) — häälekasutus käib olemasoleva kvoodi arvelt, eraldi häälepaketti
ei ole.

### T03 E4/E5 karastus — punktid 1–4 TEHTUD 03.08

Omaniku verdikt 03.08 oli „teha ära". Tehtud. Leping:
[`t03-chat-voice-v1-ulesanne.md`](./t03-chat-voice-v1-ulesanne.md) ptk E4/E5.

**Salvestuse saab katkestada, ilma et heli kuhugi läheks.** Mikrofoni kõrvale ilmub
salvestamise ajal katkestusnupp (ja Escape teeb sama klaviatuurilt). Katkestus viskab
salvestise ära enne, kui teda kellelegi saadetakse — transkribeerimisteenust ei kutsuta
üldse — ja inimene saab selle kohta kirjaliku kinnituse, mitte vaikuse. Sama kehtib
ekraanilt lahkumisel: pooleli salvestus ei rända lahkuvalt ekraanilt teenusesse.

**Pikk salvestus lõpeb ise ära.** Kahe minuti juures tuleb hoiatus ja 2,5 minuti juures
salvestus lõpetatakse — seni räägitu läheb tekstiks, ei lähe kaotsi. Salvestuse taimerid ja
mikrofonirajad vabastatakse igal rajal: katkestusel, veal ja õnnestumisel.

**Ettelugemine ei kao vaikselt ära.** Eesti keel käib platvormi häält mööda; kui see ei ole
saadaval, kasutatakse brauseri häält ja kasutajale öeldakse, et hääl on praegu brauseri oma.
Inglise ja vene keel käivad brauseri häält mööda — **see on omaniku otsus 03.08: RU/EN
ettelugemine jääb kasutajale tasuta ega kuluta kvooti.** Uus on see, et kui brauseri hääl ei
kõnele, öeldakse tõrge välja. Vaikus ei ole enam üks võimalikest tulemustest üheski keeles.

**Mikrofoni keeldumine ütleb põhjuse.** Tellimusnõue, brauseri loakeeld, puuduv mikrofon ja
tehniline viga on neli eri teksti, mitte üks hall nupp — igaühe parandustee on erinev ja
kasutaja peab teadma, kumb pool teda takistab.

**Omaniku otsus 03.08 — RU/EN ettelugemine on tasuta.** Serveritee oskaks ka vene ja inglise
keelt (`/api/tts` hääled on olemas), aga ta kulutab `TTS_CHARS` kvooti. Omanik otsustas, et
RU/EN peab jääma tasuta, seega need kaks jäävad brauseri häälele. **See on teadlik vahetus:
kvaliteedierinevus (VEST-L8) jääb sisse, vaikiv ebaõnnestumine ei jää.** Kui otsus kunagi
muutub, on lüliti üherealine — `serverTtsLocales()` failis `lib/chat/voiceState.js`.

**NOT_PROVEN:** brauseris tõendati 03.08 ainult tellimusnõude rada (märgistus, tekst,
teade). Katkestus, 2,5 min piir ja ettelugemise varurada vajavad tellimusega kontot ja
päris mikrofoni — need on tõendatud ainult testilepinguga
(`tests/chat/voiceHardening.test.js`).

Punktid 5–6 (a11y-seisud klaviatuuriga + reduced-motion, ET/EN/RU sümmeetria) kuuluvad
sektsiooni S4 a11y-sappa ja neid siin ei dubleerita.

### Ruumide nõusolekupere — kõik neli parandatud

Kaks olid E5-tööga juba koodis, „Helikõne toimus" kaks korda parandati 03.08, ja neljas —
salvestuse eesmärgisildid koos nõusolekukirjega — sai tehtud 04.08 (vt S7). Selle pere sees
ei ole enam lahtist viga.

- **VEST-L8** — RU/EN TTS kvaliteedierinevus. **Jääb lahti teadliku otsusena**, mitte
  tegemata tööna: omanik valis 03.08 tasuta RU/EN ettelugemise kvaliteedipariteedi ees.
  Erinevus on nüüd hinnaotsus, mitte tehniline puudus, ja avaneb päeval, mil keegi on nõus
  RU/EN häälekulu kandma (kasutaja kvoodist või meie omast).

### Eesti TTS — TEEMA LUKUS 03.08

Küsimus oli: **kas eestikeelse ettelugemise saab teha tasuta?** Brauseri hääl vastuseks ei
kõlba — brauserites ei ole eesti häält, seega loetaks eesti tekst inglise häälega ette.
Vastus tuli TartuNLP-st ja ta on **toodangus sees**: eesti ettelugemine käib Tartu Ülikooli
kõnesünteesi teenuse `kylli` häälega, tähemärgitasu ei teki, Google jääb varuks.

**Kolm asja, mis selle sulgesid:** omanik kuulas hääled ja valis (`kylli`) ·
privaatsustingimuste §5 nimetab TartuNLP kolmes keeles · omanik kinnitas, et avaliku API
kasutamine on lubatud. **Ise-hostimist ei tehta** — vt „Miks mitte ise-hostida" allpool.

**Kood.** `/api/tts` võtab kolmanda pakkuja `TARTUNLP_TTS_URL` taga; ilma selle
env-muutujata ei muutu ükski rada (arendusmasinal saab teda niimoodi välja lülitada).
Admin võib päringus kõneleja valida
(`speaker`), et 12 häält järjest kuulata ilma restardita. Vaikimisi hääl on
`TARTUNLP_TTS_SPEAKER`, vaikeväärtus **`kylli`** (omaniku valik 03.08).

**Läbiv rada tõendatud 03.08** sünteetilise kontoga (`ai.client@sotsiaalai.test`,
CLIENT + aktiivne tellimus): päris sisselogimine → `POST /api/tts` locale `et` → HTTP 200,
`provider: "tartunlp"`, `contentType: "audio/wav"`, **formaadikood 1, 16 bit, 22 050 Hz**,
4,92 s kõnet 212 KB-s, kogu päring 2,5 s. Ehk: pakkuja valik, teisendus ja kvoodivärav
töötavad päriselt koos, mitte ainult tükkidena.

**Fallback on NOT_PROVEN.** Kood ütleb: kui TartuNLP ei vasta või jääb üle 20 s rippuma,
läheb sama päring edasi Google'i teed. Lähtekoodi tasemel on see lukustatud testiga, aga
**runtime'is seda tõendada ei õnnestunud** — arendusmasinal ei ole Google'i ega OpenAI
võtmeid, seega surnud TartuNLP annab seal HTTP 500 (varem oleks sama masin andnud 503
„not_configured"; mõlemal juhul kukub klient märgistatud brauserihäälele, nii et kasutaja
vaikusesse ei jää). Omanik kinnitas 03.08, et **serveris on Google seatud** — seal on
fallbackil millelegi kukkuda. Tõendamine kuulub serveri-QA alla.

**Omanik kuulas viis häält (mari, albert, kylli, tambet, vesta) ja valis `kylli`.** See on
nüüd vaikimisi hääl; `TARTUNLP_TTS_SPEAKER` saab teda muuta.

**Mõõdetud avalikul API-l** (5 häält, sama valdkonnalause, ~10 s kõnet):

| Leid | Number | Mida see tähendab |
|---|---|---|
| Vastuseaeg | 0,7–1,3 s | kiirem kui vaja; ei ole probleem |
| Hääli | 12 eesti + 2 võro | valikut on rohkem kui Google'il (üks) |
| Väljundi kuju | 22 050 Hz, mono, 32-bitine float WAV | teisendatakse serveris, vt allpool |
| Maht enne teisendust | ~86 KB sekundis | 11 s kõnet = 955 KB |
| **Maht pärast teisendust** | ~43 KB sekundis | sama 11 s = **478 KB, 50% vähem** |

**Float32 → PCM16 teisendus on tehtud** (`lib/audio/wavPcm.js`). Ta lahendab korraga kaks
asja: poolitab mahu ja annab formaadikoodi 1, mida iga brauser tunneb (32-bitine float on
formaadikood 3, millega vanemad Safari/iOS versioonid on ajalooliselt kitsid olnud).
Teisendus on fail-safe — iga ootamatuse korral tuleb algne heli muutmata tagasi, sest
katkine heli on halvem kui suur heli.

Brauseris kontrollitud päris kylli-näidisel: teisendatud fail dekodeerub sama pikkusega
(11,09 s), tipp 0,83 ja keskmine amplituud 0,071 — päris kõne, mitte vaikus ega klipitud
müra; `canplaythrough` OK.

**Alles jääv mahuvahe:** Google'i MP3 on ~4 KB/s, meie PCM16 ~43 KB/s ehk ikka ~10×
suurem. MP3/Opus kodeerimine viiks ta Google'i tasemele, aga nõuab uut sõltuvust — tehakse
siis, kui maht kellelegi ette jääb, mitte ette ära.

#### Miks mitte ise-hostida

Ise-hostimine oli algne suveräänsuse-idee ja see **ei ole keelatud** — mudelid on MIT ja
omanik kinnitas 03.08, et luba on olemas. Ta lihtsalt ei osta enam midagi:

- **Tasuta on juba saavutatud.** Avalik API on tasuta ja live'is; tähemärgitasu on null.
  Varasem lause „ise-hostimine teeb eesti ettelugemise tasuta" oli eksitav ja on parandatud.
- **Server ei kanna.** 3 vCPU, 6,8 GB RAM (4,5 GB vaba), 35 töötavat teenust. Vaja läheks
  RabbitMQ + worker + API konteinerit; mudel ise on väike (185 MB, v3.1.0 `multispeaker.zip`),
  aga PyTorch-i mälujälg on ~1,5–2,5 GB ja CPU-inferents konkureeriks samade kolme tuumaga,
  millel jooksevad frontend, RAG ja research-worker. Ketast jätkuks (20 GB vaba).
- Seega tähendaks ise-hostimine suuremat või teist VPS-i ehk **päris raha** — probleemi
  eest, mida praegu ei ole.

Kui olud muutuvad (kättesaadavus muutub probleemiks või server saab niikuinii suuremaks),
on rada teada ja lipp on koodis olemas: `serverTtsLocales()` + `TARTUNLP_TTS_URL`.

**Alles jäänud sabad on mõlemad T27-s** (S10): eestikeelse PCM16-heli seadmematriks päris
iOS/Safari peal, ja art. 28 paberitöö. Kumbki ei blokeeri midagi täna.

### Tegemata

| Idee | Mis see on | Mis seda avab |
|---|---|---|
| **Kõnerežiim** | eraldi pind nagu telefonikõne: lahtine mikrofon, VAD teeb vooruvahetuse (~0,7 s vaikus), elavad subtiitrid + allikakaardid ekraanil, barge-in kohustuslik. Arhitektuur: kaskaad (STT → olemasolev torustik → voogav TTS) → siht „õhuke hääl, paks server". **Uusi teenusepakkujaid ei vaja, uut kvooti ei looda.** „3 lause leping": hääl annab tuuma, täisvastus koos allikatega maandub tekstina | omaniku hinnastusotsus (kas kõigil tasulistel või 14,99+) |
| **Häälkäsklused — „kaks rada, üks mikrofon"** | ruuter valib raja: sõnastikuvaste → kohalik refleks (sõnastik olemas, `roomDock.js`); muu → LLM kui kavatsuste tõlk. **AI ei saa kunagi vaba kätt ekraani üle** — sama piiratud kavatsuste sõnastik mis nooleklahvidel; navigeerimine kohe, loomine/saatmine/kustutamine kinnitusega | faas 1 (sõnastik + esiletõst) on otsustevaba |
| ~~Eesti TTS suveräänsus — TartuNLP~~ | **TEHTUD JA LUKUS 03.08** — eesti ettelugemine käib toodangus `kylli` häälega, tasuta. Ise-hostimist ei tehta. Vt „Eesti TTS — teema lukus" ülal | — |
| **Lokaalsed mudelid** | Whisper/whisper.cpp eesti dikteerimiseks seadmes; VAD; eesti TTS-mudel; PII-märkaja | päästikud: riigipartneri „kus heli töödeldakse?", kasvav pilvearve, võrguta välitöö |
| **Häälvestlus supervisiooni-/kovisiooniruumis** | `ideed.md` 23.6. Range leping: ei salvestata vaikimisi, **automaatset transkripti ei tehta, AI ei kuula ega koosta kokkuvõtet**, superviisor ei saa ühepoolselt salvestamist käivitada | ESTA partnerlus |
| **Piiratud häälruum tervishoiukontaktis** | `ideed.md` MVP-loend | TERVIK-reform |
| **Kaamera / žestid** | MediaPipe brauseris, **kaader ei lahku seadmest**; vehe = liigu, näpistus = vali | VR-viilude järel |

---
## S4. Kogu lahtine töö — täisnimekiri

Koostatud 03.08 läbiva korjega: `ideed.md` (29 peatükki), `SotsiaalAI.md` register,
`shs-katvuskaart.md`, ~130 analüüsi- ja lepingufaili. Korje leidis **122 paketikoodi**
(`XXX-Pn`) — varem ei olnud neist üheski nimekirjas rohkem kui paarkümmend.

**Miks see sektsioon olemas on:** omanik 03.08 — *„lihtsalt kõik kanna tegemata, ma ei
näinud neid."* Kui funktsioon ei ole siin, siis teda praktikas ei ole olemas: teda ei
plaanita, ei prioriseerita ega mäletata.

**Kaks liiki tööd, mida ei tohi ühte nimekirja panna (omanik 03.08).**

| Liik | Mis see on | Mida vajab |
|---|---|---|
| **TÖÖRIIST** | suurem funktsioon — uus võimekus, mida täna ei ole | oma arendusleping, oma DoD, sageli migratsioon ja otsus/partner |
| **VÄIKE MUUDATUS või LISA** | parandus, saba või täiendus olemasoleva funktsiooni sees | ei vaja lepingut; kirjelduse ja väravad mahuvad ühte tööringi |

Kõik allpool on üks või teine. Vahepealset kategooriat ei tehta — kui kahtled, on ta
tööriist ja vajab lepingut.

---

### 4.1. TÖÖRIISTAD — suuremad funktsioonid

Iga tööriist on siin kirjeldatud nii, et alustamiseks ei pea mujalt lugema. Detailne
lähtematerjal on `ideed.md`-s viidatud peatükis; teostuse leping kirjutatakse alustamisel.

---

#### Juhtumitöö assistent

*Lähtematerjal: `ideed.md` **ptk 4** (4.2–4.8). Leping:
[`jta-v1-arendusleping.md`](./jta-v1-arendusleping.md) **v7**, etapid E1–E8. **KÕIK KAHEKSA
ETAPPI ON KOODIS (08.08) ja värav on väljas.** E1 laua koondlugeja · E2 laua pind
`/toolaud/juhtumitoo` · E3 kohtumise ettevalmistus · E4 kihiline märge · E5 STAR2 mustandi ahel ·
E6 kopeerimine ja ülekandeajalugu · E7 säilituse jõustamine (`npm run casework:retention`) ·
E8 sond. **O-JTA-5 = rada C** ja **O-JTA-6 = laiendada + purge-marker ettevalmistusel**
(mõlemad otsustatud 08.08). Lahtisi otsuseid ei ole.*

**Assistent ei ole üks pakett, vaid kolm** (analüüsi ptk 10 jaotus): P1 ettevalmistuspaneel
(tehtud) · **P2 STAR2-mustandite ahel — TEHTUD 08.08** (selle lepingu E5–E6) · P3 Meetodipeegel
(eraldi, O-CW-3 taga). JTA-V1 katab laua, kohtumise ettevalmistuse, kihilise märkme ja P2 —
**mitte P3, P5 ega P6**.

Juhtumitöö assistent aitab sotsiaaltöötajal korraldada **enda jooksvat professionaalset
tööd, ilma STAR2 ametlikku toimikut dubleerimata**. Ta vastab küsimustele, millele register
ei vasta: millele järgmisel kohtumisel keskenduda, milline info on puudu või kontrollimata,
milliseid küsimusi kliendile esitada, kuidas sõnastada kliendiga eesmärki, millist meetodit
kasutati ja kuidas see töötas, ning kas juhtum vajab kovisiooni, supervisiooni või
võrgustikutööd.

**Assistendi töölaud** koondab: saabunud eelpöördumised · tänased vastuvõtud · aktiivsed
ettevalmistustööd · STAR2-sse kandmist ootavad mustandid · puuduv ja kontrollimist vajav
info · järgmised kontaktid · võrgustikutöö ettevalmistus · meetodipeegel · kovisiooni või
supervisiooni ettevalmistus · STAR2 ülekandmise ajalugu.

**Ühe tööprotsessi vaade** hoiab koos praeguse fookuse (miks inimene pöördus, mida ta ise
soovib, mis vajab lahendamist, milline on järgmine kontakt), kohtumise ettevalmistuse
(eesmärk, täpsustavad küsimused, puuduva info loend, kliendiga kontrollitavad väited,
lihtsas keeles selgitused) ja kohtumise märkmed. Märge on jaotatud kihtidesse, mida ei tohi
kokku valada: *kliendi enda vaade · faktilised asjaolud · töötaja tähelepanek ·
kontrollimata info · kokkulepped · järgmised sammud · STAR2-sse kantav info · privaatne
professionaalne refleksioon*. **Privaatne refleksioon ei lähe STAR2-sse kunagi.**

**Info päritolu on kohustuslik iga olulise infokillu juures:** kliendi öeldud · kliendi
kinnitatud · dokumendist · teise spetsialisti info · töötaja tähelepanek · töötaja
tõlgendus · AI koostatud mustand · STAR2-s kontrollitud. Platvormil on selle jaoks juba
jagatud päritolusõnastik (`lib/workspaces/provenance.js`) — uut ei leiutata.

**STAR2 rada.** Kandmist ootavad elemendid seisavad nimekirjas (pöördumise kokkuvõte,
abivajaduse hindamise mustand, eluvaldkonna kirjeldus, eesmärgi sõnastus, tegevus,
vastutaja ja tähtaeg, kohtumise märge, teenuse suunamise alus), igaüks oma seisuga:
*mustand · vajab kliendiga kontrollimist · vajab dokumenti või registripäringut · töötaja
kontrollitud · valmis kandmiseks · kantud · ei kanta*. **Esimeses versioonis on tegevus
„Kopeeri STAR2 jaoks", mitte „Saada STAR2-sse"** — ametlik saatmine saab tulla ainult SKA
ja TEHIK-uga kokku lepitud liidestuse kaudu.

**Paralleelset andmebaasi ei teki.** Assistent säilitab eelpöördumise algmaterjali,
töösolevad mustandid, puuduva info loendi, kohtumise ettevalmistuse, STAR2 viitenumbri,
ülekandmise staatuse ja professionaalse refleksiooni. Pärast STAR2-sse kandmist ei hoita
teist aktiivset ametliku juhtumiplaani koopiat — ülekantud mustand muutub kirjutuskaitstuks
või arhiveerub säilitusreegli järgi.

**Mis blokeeris:** üks eeldus — **juhtumi objekt** (allpool). Ilma selleta oli assistendil laud,
aga mitte seda, mille ümber laud käib. **07.08: eeldus täidetud** (objekt on koodis, värav
väljas) **ja leping kirjutatud — miski ei blokeeri enam ehitust.** Tema „puuduva info loend" ja
„järgmised kontaktid" loevad juhtumi objekti, ei loo neid uuesti.

Aktiveerimist blokeerib sama, mis juhtumi objektil (Õ2/Õ3), **pluss üks uus**: säilitusreegli
12-kuuline kell vajab õigusabi kinnitust (lepingu Õ2). Ehitust see ei blokeeri — E1–E2 on
kellast sõltumatud.

---

#### Juhtumi objekt elutsükliga

*Lähtematerjal: `ideed.md` **ptk 12** (kontseptuaalne andmemudel — objekt on seal nimega
`CaseWorkAssist`) + **ptk 4**. Leping:
[`juhtum-v1-arendusleping.md`](./juhtum-v1-arendusleping.md) v6. **E1–E6 TEHTUD 07.08 — tervik
on koodis ja peidus.** Värav `CASEWORK_V1_ENABLED` on vaikimisi väljas, tabelites 0 rida.*

> **Selle rea juures puudus `Lähtematerjal:` viide ja see maksis kätte.** Naaberread
> (assistent, võrgustikutöö, meetodite kataloog) kannavad kõik `ideed.md` peatüki numbrit;
> juhtumi objekti oma ei kandnud, sest küsimus tõstatati 03.08 hiljem — ja lepingu esimene
> versioon kirjutati seetõttu kirjeldust lugemata, leiutades oma mudeli. Kirjeldus oli olemas.
> **Iga uue S4.1 rea juurde käib `Lähtematerjal:` rida, ka siis, kui vastus on „ei ole".**

**Mida see töötaja jaoks teeb.** „Minu juhtumid" on sotsiaaltöötaja ja teenuseosutaja **enda
töökorralduse** pind. Juhtum on konteiner, mille ümber töö käib: tema küljes on kliendiviide
(kas platvormi kasutaja või töötaja enda vabatekstiline märge — nt „perearst R" või välise
registri tunnus), järgmise kontakti aeg, STAR-i viitenumber, seotud materjal ja loend sellest,
**mis on puudu või kontrollimata**. Iga puuduva info punkt kannab päritolumärgist (kliendi
öeldu · kliendi kinnitatud · dokumendist · teise spetsialisti info · töötaja tähelepanek ·
töötaja tõlgendus · AI mustand · ametlikult kontrollitud) ja liigub lahtise, lahendatu ja
„ei ole asjakohane" vahel; lahtised on loendis alati ees.

**Juhtum seob olemasolevat — 0 rida ei kopeerita.** Siduda saab dokumendi, mustandi või
välitöökäigu, ja ainult seda, mida töötaja niikuinii juba näeb; seos ise ei ava kunagi
ligipääsu. Kui algobjekt kustub, kaob seos koos temaga, ja kättesaamatu seos ei ilmu ei
loendisse ega loendurisse — vahe „3 seost, näidatakse kahte" oleks ise leke.

**Mis see ei ole.** Ei kliendiregister ega STAR-i vari: ametlik kandja jääb STAR-i ja platvorm
ei paku „saada STAR2-sse", vaid oma töökorraldust. Juhtum on **rangelt isiklik** — kaks
töötajat on üksteise juhtumitest täielikult pimedad (võõras juhtum vastab „ei leitud", mitte
„ei tohi") ja admin ei näe sisu. Juhtumit ei anta üle ega kustutata. Kliendiotsingut ei ole:
platvormi kasutaja saab kliendiks märkida ainult siis, kui ta ise selle pöördumise saatis.

**Elutsükkel on ühesuunaline:** aktiivne → kirjutuskaitstud → arhiveeritud. Põhjus on
kohustuslik ja jääb auditisse, tagasiteed ei ole, ja kirjutuskaitse laieneb ka lastele —
lugemine jääb alles. **Erand on kliendiviite kustutamine:** see töötab igas seisus, sest
andmesubjekti õigus ei tohi jääda kirjutuskaitse taha kinni. Kustutatud viide kaob ka
kuvanimest („Kustutatud kliendiviide") ega tule tagasi, ka mitte konto kustutamise rajalt —
FK `SetNull` üksi jätaks jälje määramata.

Õiguslik alus on olemasolev `WORKER_DATA_PROCESSING` raamleping; **see on `LEGAL_ASSUMPTION`,
mitte tõestatud fakt**, ja just seda lahutab aktiveerimisvärav: deploy'da tohib, avamine vajab
lisaks andmekaitseanalüüsi kinnitust (Õ2/Õ3).

Kolmest lahtisest otsusest **O-JU-1 sai 07.08 vastuse koos O-CW-2-ga** (kirjutuskaitse + 12 kuud
arhiivis + kustutus; jõustamise kuju JTA-V1 lepingu L7-s — kell käib `ARCHIVED`-ist ja vaikset
kustutust ei ole). Lahtised jäävad **O-JU-2** (üleandmine kolleegile) ja **O-JU-3** (loomine
eelpöördumisest ühe vajutusega); kumbki ei blokeerinud ehitust ja V1 vastab neile „ei".

---

#### Võrgustikutöö

*Lähtematerjal: `ideed.md` ptk 5 + COLLAB-analüüs ptk 11. Koodis on alus (P0–P2), vertikaal puudub.*

Võrgustikutöö on juhtumitöö assistendiga seotud, aga **eraldi nähtavusega koostöökiht**. Ta
ei ole juhtumiplaani koopia ega anna osalejatele ligipääsu töötaja privaatsele vaatele.

**Info kolm taset, mida ei tohi ühte valada:** (1) privaatne juhtumiinfo — ainult volitatud
juhtumitöötajale; (2) võrgustikuga jagatud kokkuvõte — ainult sellele võrgustikule; (3)
osalejaga seotud ülesanne — osalejale ja koordinaatorile. **Võrgustikku kutsumine ei anna
ligipääsu juhtumile.** Vestlusruumi liikmelisus ei ava juhtumitöö assistenti, meetodipeeglit,
kliendi teekonda ega STAR2 toimikut.

**Esimene vertikaalne lõik (COLLAB-P4)** — **V1 kitsas tuum on koodis 04.08**
(`lib/network/share.js` + `NetworkShare` mudel, 19 testi): üks eelpöördumine → külmutatud
kokkuvõte ühele olemasoleva kontoga saajale → kliendi kinnitus → ruum. Kolm garantiid on
testidega lukus: saaja peab olema kasutaja · kinnitamata jagamist ei saa saata · teksti
muutmine pärast kinnitust tühistab kinnituse. Ruumi avamine on samuti koodis
(`lib/network/shareRoom.js`). **Klient ei pea olema kasutaja** (omanik 04.08) — kaks rada,
vt allpool. **API-marsruudid on olemas** (8 marsruuti, rada on serverist läbitav);
tegemata on liides. Leping on mustand ja ootab kinnitust
([`collab-p4-vorgustiku-vertikaal-ulesanne.md`](./collab-p4-vorgustiku-vertikaal-ulesanne.md),
osad E1–E6; koodi veel ei ole). Väikseim töötav rada: eelpöördumine või
kohtumise tulemus → töötaja kaardistab vajaliku võrgustiku → **klient näeb ja kinnitab, mida
jagatakse** → töötaja leiab teenusekaardilt osutaja → valitud osapoolele läheb piiratud
kutse → avaneb kirjalik ruum → osaleja näeb ainult talle jagatud kokkuvõtet → töötaja
kontrollib tulemuse → ametlik osa dokumenteeritakse STAR2-s. **Kõik osalejad on siin
platvormi kasutajad, seega mittekasutajate õigusküsimus (O-CO-6) ei kehti — miski ei
blokeeri.**

**Võrgustikukaart** hoiab osapooli: klient · lähedased · vastutav sotsiaaltöötaja · teised
KOV-i spetsialistid · teenuseosutajad · perearst või muu tervishoiukontakt · kool või
lasteaed · Töötukassa · tugiorganisatsioonid. Iga osapoole juures roll, organisatsioon,
kontakt, kaasamise eesmärk, **jagamispiir**, osalemise algus ja lõpp, viimane kontakt,
kokkulepitud tegevus.

**Teenuseosutaja näeb ainult talle jagatut** — kontaktisoovi, kokkuvõtet, dokumenti,
ülesannet või ruumiarutelu. Mitte meetodipeeglit, tööheaolu, kliendi teekonda ega
assistenti.

#### O-CO-6 ei ole õiguslik sein, vaid lepinguline värav (omanik 04.08)

> „Väga suure tõenäosusega tohib käidelda isikuandmeid kellegi teise omi serveris, aga siis
> peab olema raamleping allkirjastatud nii sotsiaaltöö spetsialistiga kui ta
> teenuseosutajaga. Nii et see otsene blokk ei ole, sest leping tõenäoliselt sõlmitakse, aga
> siis meil on nö poolik toode."

See muudab O-CO-6 tähendust: küsimus **ei ole** „kas tohib", vaid „kas leping on
allkirjastatud". Seega ei blokeeri ta ehitust — ta blokeerib **aktiveerimist**, täpselt nagu
osa II ptk 4 teine omaniku otsus ette näeb.

**Masinavärk on juba olemas ja kontrollitud koodist 04.08:**

- Raamlepingu tekst paneb rollid paika: *„Organisatsioon on **vastutav töötleja** nende
  isikuandmete suhtes, mida tema kasutajad töötlevad SotsiaalAI-s tööülesannete
  täitmiseks"* · *„SotsiaalAI OÜ on **volitatud töötleja** ulatuses, milles ta töötleb
  organisatsiooni tööandmeid organisatsiooni nimel ja dokumenteeritud juhiste alusel."*
  Just see konstruktsioon kannab kolmanda isiku kirjet võrgustikukaardil.
- `FrameworkAcceptance` hoiab nõustumist masinloetavalt: `frameworkKey`,
  `frameworkVersion`, `roleAtAcceptance`, `acceptedAt`, allkirjastatud dokumendi
  allalaadimise aeg.
- Võti `WORKER_DATA_PROCESSING` (`lib/frameworkAcceptances.js`) ja
  `isWorkerEligible` katavad **mõlemat rolli — `SOCIAL_WORKER` ja `SERVICE_PROVIDER`** ehk
  täpselt need kaks poolt, keda omanik nimetas.

**Mida see tähendab ehituse jaoks.** O-CO-6 värav on kirjutatav serverikontrolliks, mitte
lahtiseks otsuseks: *mittekasutaja isikuandmetega kirje tohib tekkida ainult siis, kui nii
vastutaval töötajal kui kaasatud teenuseosutajal on kehtiv allkirjastatud raamleping.* Kui
mõlemat ei ole, jääb rada fail-closed.

**See värav on 04.08 koodis** (`lib/network/share.js`, COLLAB-P4): välise kliendiga jagamine
kontrollib raamlepingut mõlemal poolel ja keeldub, kui kas või üks puudub. Kontoga kliendi
rada seda kontrolli ei vaja.

**Klient ise ei pea olema kasutaja (omanik 04.08).** Võrgustikutöö on sotsiaaltöötaja
tööülesanne ja klient saab info nagunii hiljem; kasutajaks olemist ei saa nõuda, aga
võimaldada võib. Kaks rada käivad läbi kogu lõigu: kontoga klient kinnitab ise (`IN_APP`) ja
on ruumi liige; väline klient hoitakse miinimumkujul ja tema kinnituse kannab töötaja üle
(`IN_PERSON`/`PHONE`/`WRITTEN`). **Ülekantud kinnitus on nõrgem tõend ja jääb eristatavaks** —
sama piir, mis AI mustandi ja inimese ütluse vahel.

**Omaniku hoiatus, mis jääb kehtima:** kuni lepingud on allkirjastamata, on tegemist poolikult
kasutatava tootega — funktsioon on olemas, aga ei tööta ühelegi päris kasutajale. Seepärast
ehitatakse **esimene vertikaal ikkagi kasutajate peal** (COLLAB-P4) ja mittekasutajate rada
tuleb eraldi (COLLAB-P5) koos väravaga, mitte enne.

**COLLAB-P5** (võrgustiku täisfunktsioon, mittekasutajate kirjed) = P4 + ülalkirjeldatud
raamlepingu värav.
**COLLAB-P6** (kohtumise ühisvaade: päevakord, otsused, ülesanded, kinnitusring) ootab
O-CO-2. Täna kannavad kohtumisi kolm eraldi mudelit — `SupervisionMeeting`,
`MentoringMeeting`, `lib/calls/` — ja ühist vaadet ei ole.

---

#### Genogramm, ökokaart ja professionaalne võrgustikukaart

*Lähtematerjal: `ideed.md` ptk 9; leping valmis: [`t21-casework-vorgustikuvaated-ulesanne.md`](./t21-casework-vorgustikuvaated-ulesanne.md). Koodis 0 rida.*

**Genogramm** on interaktiivne pere struktuuri ja põlvkondadevaheliste suhete kaart.
**Ökokaart** on kliendi seoste kaart pere, lähedaste, kooli, töö, kogukonna, teenuste ja
spetsialistidega, kus seosele saab määrata tüübi, tugevuse ja suuna. **Professionaalne
võrgustikukaart** on midagi muud ja neid ei tohi segada: ta näitab, kes juhtumiga töötab,
milline on osaleja roll, mida temaga võib jagada, milline tegevus on tema vastutada ja
millal toimus viimane kontakt. Ökokaart kirjeldab **elukeskkonda**, võrgustikukaart
**koordineeritud koostööd**.

Leping lukustab tundlikud otsused: miinimumväljad (kuvanimi võib olla roll või initsiaal —
„ema", „perearst R"; **kontaktandmeid, isikukoodi ega terviseinfot vaikimisi ei ole**),
versioonitud parandamine, kustutus mõjub läbi kõigi vaadete korraga, **kaardistamise lõpp on
kohustuslik väli** („igavesti vaikimisi" on keelatud), ja lapse kirje kannab ainult
struktuurifakte ega ole kunagi jagatava väljavõtte vaikimisi osa. Elav kaart ei liigu kunagi
— jagatakse ainult külmutatud väljavõtet.

**Mis blokeerib:** **V1** — art 14 teavitamiskohustus: kas, millal ja mis mehhanismiga
teavitatakse kolmandat isikut, kes kaardile satub. **V2** — vastutav töötleja: KOV või
platvorm. `O-CW-7` on juba otsustatud (genogramm on tavapraktika seadusest tuleneva ülesande
peal, meedium ei loo uut töötlemist) — **ära oota seda, see vastus on olemas.** V1/V2 ja
COLLAB-P5 O-CO-6 on osaliselt sama küsimus: mis staatuses on inimene, kes ei ole kasutaja,
aga kelle kohta kaardil kirje on. Küsi ühe selgitustaotlusega.

---

#### Meetodite ja töövõtete kataloog

*Lähtematerjal: `ideed.md` ptk 7 (kuus perekonda, ~50 meetodit). Koodis 0 rida.*

Kataloog kirjeldab sotsiaaltöö meetodeid nii, et neid saab tööle külge panna: mida meetod
eeldab, mida ta annab, millal ta ei sobi, mida tema kohta kirja panna. Kuus perekonda:
**A** hindamise ja info kogumise meetodid (struktureeritud vestlus, vaatlus, kodukülastus,
dokumentide läbivaatamine) · **B** otsese klienditöö meetodid · **C** pere, rühma ja
võrgustiku meetodid · **D** abi koordineerimise ja õiguste kaitse meetodid · **E** keskkonna
ja kogukonnaga töötamise meetodid · **F** professionaalset tööd toetavad meetodid.

Läbiv nõue: **süsteem peab eristama nähtud fakti töötaja tõlgendusest.** Vaatlus annab
fakti, järeldus on tõlgendus, ja need ei tohi kirjes koos seista.

Kataloog on eeldus **meetodi valimise assistendile**: AI pakub kaalumiseks võimalikke
meetodeid, sobivuse põhjuseid, olukordi kus meetod ei pruugi sobida, puuduvaid andmeid,
riske, alternatiive ja refleksiooniküsimusi. **AI ei määra õiget meetodit ega asenda
professionaalset otsust.**

---

#### Sekkumispäevik ja vahehindamine

*Lähtematerjal: `ideed.md` 8.5. Vahehindamise tulemused on koodis (`lib/reflection/`), päevik ise puudub.*

Sekkumispäevik on juhtumi ajajoon, kus iga sündmus kannab eesmärki, meetodit, tegevust,
fakte, kliendi vaadet, töötaja tõlgendust, kokkulepet ja vahehindamise aega. Vahehindamise
tulemus on üks kaheteistkümnest: jätkata · jätkata kohandatult · vajab rohkem aega · mõju ei
ole veel hinnatav · klient ei soovi jätkata · väline takistus · valida teine lähenemine ·
vajab kovisiooni · vajab supervisiooni · vajab eetilist arutelu.

See on koht, kus „kas see töötas?" saab vastuse, mis ei ole mälupõhine.

---

#### Kliendi tagasiside

*Lähtematerjal: `ideed.md` 8.6. Omaniku otsuse taga.*

Kliendilt küsitakse: kas ta tundis end kuulatuna · kas eesmärk oli arusaadav · kas ta
nõustus järgmise sammuga · mida ta pidas kasulikuks · mida ta soovib muuta · kas ta soovib
lisada oma sõnastuses kommentaari.

**Töötaja kirjeldatud kliendi reaktsioon ja kliendi enda tagasiside peavad jääma
eristatavaks.** See on ka platvormi strateegiline lubadus: riik mõõdab tegevusi, inimene
saab mõõta muutust.

---

#### Kovisiooni ettevalmistuse mustand ja praktika arenguvaade

*Lähtematerjal: `ideed.md` 8.7–8.8.*

Juhtumist koostatakse **privaatsust arvestav kovisioonimustand**: keskne küsimus, kasutatud
lähenemine ja meetod, valiku põhjus, seni proovitu, kliendi reaktsioon, töötaja kahtlus või
pimekoht, eetiline vastuolu, kolleegidelt oodatav abi. Mustand **deidentifitseeritakse enne
kovisiooni viimist** ja töötaja kinnitab selle.

**Praktika arenguvaade** näitab töötajale tema enda kasutatud meetodeid, korduvaid küsimusi,
toe vajadusi ja soovitatavaid õppimisteemasid. **Seda ei tohi kasutada töötajate edetabeli
ega tulemuslikkuse hindamiseks** — see keeld peab olema arhitektuuris, mitte poliitikas.

---

#### Seadusest tulenevad moodulid (`shs-katvuskaart.md`)

| # | Moodul | Mis blokeerib |
|---|---|---|
| A1 | **Erihoolekande profiil Teenuspäevikule** (§ 70–107) — tegevusplaan koos isikuga + kvartali- ja aastahinnang on seadusega ette kirjutatud aruanderütm; tegevusjuhendajad on suur kasutajaskond | — |
| A2 | ~~Toimetulekutoetuse eelkalkulaator~~ (§ 131–134) — **FUNKTSIOON VALMIS 04.08**, vt S2 „Tehtud". Tuum on sõltumatu auditi järel ümber kirjutatud fail-closed'iks; vorm ja leht `/toimetulekutoetus` on brauseris tõendatud | sabad: P2 checklist · P3 kontota versioon · **P4 KOV piirmäärad** (vajab partnerit, § 133 lg 6) ja nendega koos ainus lahtine õigusküsimus |
| A4 | **MTR/tegevusloa kontroll** (§ 147–155) — avalik register annab usaldusmärgisele objektiivse aluse. **Leping mustandis 05.08**, koodis 0 rida | miski ei blokeeri; allikas kontrollitud (avalik otsing + CSV, **mitte X-tee**); **avab ka teenusekaardi usaldusmärgise ja SK-V1 O-SK-5 värava** |
| A5 | Võlanõustamise eelkaardistus (§ 44–45) — eelpöördumise erikuju võlaprofiiliga | — |
| A6 | Sotsiaaltransport Teenuspäeviku teenusetüübina (§ 38–40) | — |
| A7 | **„Teata abivajajast" avalik juhis** (§ 13 — igaühe seadusekohustus) + teenusekaardi KOV-kontaktid; kontota avalik leht | — |
| A8 | Hooldekodu valiku rada (§ 20–22²) — hooldereformi rahastus + valikujuhis | — |
| A9 | Kriisirežiimi seaduslik konks (§ 13¹) | — |

**Mis avab SOTSIAALKIIRABI-V1 (05.08).** Kood on tervikuna valmis ja peidus. Avamiseks on
vaja täpselt kolme asja ja mitte ühtegi rida koodi juurde: **(1)** üks KOV, kes on nõus
mehitatud lauda pidama ja lugemisaega lubama; **(2)** KOV-lepingu 10 punkti allkirjastatult
(lepingu ptk 8) — nendest kannab kõige rohkem p 4 „eitava vastuse kohustus" ja p 6 „KOV ei
tohi saabuvatest teadetest koostada riskinimekirja"; **(3)** kolm otsust — O-SK-2 (rollid),
O-SK-4 (säilitusaeg), O-SK-5 (kes lülitab osutaja raja). Alles siis loob admin laua,
kinnitab tingimused ja lülitab sisse. Enne seda ei näe rada ükski inimene.

*(A3 abivahendi teekond on tehtud — `lib/journey/assistiveDevices.js`.)*

---

#### Hääl ja multimodaalsus

Kõnerežiim, häälkäsklused („kaks rada, üks mikrofon"), eesti TTS suveräänsus, lokaalsed
mudelid, häälvestlus supervisiooniruumis, kaamera ja žestid — täiskirjeldused koos
blokeerijatega on **S3**-s, siin ei dubleerita.

---

#### Muud tööriistad

| Tööriist | Mis blokeerib |
|---|---|
| ~~SOTSIAALKIIRABI-V1~~ — **E1–E6 TEHTUD 05.08**, kirjeldus S2-s. Ehitust ei blokeeri enam miski; aktiveerimist blokeerib partner (KOV-lepingu 10 punkti) ja kolm otsust: O-SK-2, O-SK-4, O-SK-5 | leping [`sotsiaalkiirabi-v1-arendusleping.md`](./sotsiaalkiirabi-v1-arendusleping.md) |
| SUP-P1…P11 supervisiooni täismudel | omaniku prioriseerimine |
| TK-P1…P5 + Teekonna kompass („kus olen / mis on muutunud / mis järgmiseks") | — |
| T08 failide ja meedia elutsükkel | omaniku otsus |
| T19 ruumiline töölaud | DEFERRED; kasvab viiludena |

### 4.2. VÄIKSED MUUDATUSED JA LISAD — olemasoleva sees

Liik: **VIGA** = lubadus on katki · **SABA** = väljalastud funktsiooni lõpetamata ots ·
**LISA** = väike täiendus · **LÜLITI** = kood olemas, ootab otsust.

| # | Mis | Kus | Liik |
|---|---|---|---|
| 1 | **Auditikorpus ühte puusse.** Üheksa auditifaili **26 leiuga** (sh `SOL-XFUNC-01…-03`) elab seitsmes kõrvalises tööpuus — kuus lahtise pea taga, kolm commit'imata. Kuni nad ei ole `main`-is, ei saa `sol:tally` anda tervikpilti ja iga avaldatud number on osaline. Failide, tööpuude ja commit'ide loend: `parandusaudit.md` → „Auditikorpus ei ole ühes puus". **Koondamisel võetakse igast commit'ist AINULT uus fail** — nende `parandusaudit.md` ja `sotsiaalai-sol-suvaaudit.md` on rebase-eelsed ja vanemad kui siinsed | audit | VIGA (andmekao risk) |
| 2 | **Teenusekaardi klaaskujunduse parandus commit'imata** tööpuus `SotsiaalAI-service-map-glass-a4e00e4` (+307/−85, 5 faili, 50/50 sihttesti läbis). Haru `codex/service-map-glass-visual-fix` ei kanna ühtki oma commit'i | teenusekaart | SABA |
| 3 | ~~„Helikõne toimus …" tekib ruumi kaks korda~~ — **PARANDATUD 03.08** (`9cef880e`): tingimuslik `updateMany`, süsteemsõnum ainult üleminekut teinud kutsest | ruumid | tehtud |
| 4 | ~~Salvestuse eesmärgisildid ja nõusolekukirje eesti keeles~~ — **TEHTUD 04.08**. Kirjeldus oli algselt vale („staatusetekstid"); koodist kontrollimisel selgus, et staatusetekstid on tõlgitud ja katki on hoopis eesmärgisildid + **salvestatav nõusolekutõend**. Nüüd renderdab server nõusolekuteksti samadest `calls.recording_*` võtmetest, mida liides kuvab, vastamise hetkel vastaja enda keeles; keel jääb kirje juurde (`CallRecordingConsent.locale`). Vt S7 | ruumid | tehtud |
| 5 | ~~Salvestuse katkestamine enne transkribeerimist~~ — **TEHTUD 03.08**: katkestusnupp + Escape, lipp tõuseb enne stop'i, ainus värav providerini on `processRecordingBlob` | hääl (T03 E4) | tehtud |
| 6 | ~~2,5 min hoiatus/piir + taimerite ja helirajade puhastus~~ — **TEHTUD 03.08**: hoiatus 2 min, pehme piir 2,5 min, `clearRecordingTimers` abort/error/success/unmount rajal | hääl (T03 E4) | tehtud |
| 7 | ~~TTS locale-fallback~~ — **TEHTUD 03.08**: brauserihääle tõrge öeldakse välja kõigis keeltes; ET-l on serverivaru MÄRGISTATUD. RU/EN jäid omaniku otsusega tasuta brauserihäälele | hääl (T03 E4) | tehtud |
| 8 | ~~Mikrofoninupu kolm keeldu eristatud tekstina~~ — **TEHTUD 03.08**: tellimus / loakeeld / puuduv seade / tehniline viga = neli eri teksti; tellimuseta nupp ei ole enam tumm | hääl (T03 E4) | tehtud |
| 9 | VEST-L8 — RU/EN TTS kvaliteedierinevus. **Omanik valis 03.08 tasuta RU/EN pariteedi ees** — jääb hinnaotsusena lahti, mitte tegemata tööna | hääl | LÜLITI (`serverTtsLocales()`) |
| 10 | ~~TartuNLP kolmanda TTS-pakkujana~~ — **KATSE TEHTUD 03.08**: kood on `/api/tts`-s `TARTUNLP_TTS_URL` taga, mõõdetud (0,7–1,3 s, 12 häält, aga 32-bit float WAV ≈ 20× Google'i maht). Vt S3 „Katse tulemus" | hääl | tehtud (katse) |
| 11 | ~~`ROOM_OWNERSHIP_TRANSFERRED` teavitus~~ — **KONTROLLITUD KOODIST 06.08: TEHTUD.** Tüüp, spec, ET/EN/RU tekstid ja test on olemas; `lib/rooms/lifecycleNotifications.js` on ühendatud transfer-marsruuti ja teavitab kõiki liikmeid peale algataja | ruumid | tehtud |
| 12 | U1 mitme-osaleja audience-reegel — `lib/events/recipients.js` tunneb ainult `OWNER`/`AUTHOR`/`RECIPIENT_OWNER` | töölaud/teavitused | SABA |
| 13 | ~~Kvoodileke~~ — **KONTROLLITUD KOODIST 06.08: TEHTUD, ja viide oli vale.** `lib/storageGuardrails.js` on 43 rida puhtaid predikaate, seal ei saanud lekkida; leke oli `lib/research/jobStore.js` katkenud töö rajal ja `settleResearchUsage(…, "release", …)` kutsutakse nüüd, kaks testi lukustavad selle | PERF-P0 jääk | tehtud |
| 14 | L3 renewals-timerid | PERF-P0 jääk | SABA |
| 15 | L5 kuluajaloo retention | PERF-P0 jääk | SABA |
| 16 | Teenusekaardi loendivaade / klasterdamine | teenusekaart | LISA |
| 17 | RV-P1 rollivahetaja jätk + tõlkestrateegia | a11y | SABA |
| 18 | A11Y P1 juured | a11y | SABA |
| 19 | RAG P8.6 päris allikate proovipakk | teadmusbaas | SABA |
| 20 | RAG allikavärskuse timerite aktiveerimine | teadmusbaas | **LÜLITI** |
| 21 | Maksete recurring sisselülitamine — mõlemad rajad koodis olemas | maksed | **LÜLITI** |
| 22 | Päris Maksekeskuse ost toodangus tõendamata | maksed | SABA (QA) |
| 23 | Kovisiooni privaatne märkmik | kovisioon | LISA |
| 24 | ~~Lõuendireegel uues cvl-kestas rikutud~~ — **KONTROLLITUD KOODIST 06.08: TEHTUD.** `.cvl-shell` kannab reeglit „kest EI keri" ja `.cvl-canvas` `min-height` on 0; parandus tuli jaamalennu tööga | kovisioon | tehtud |
| 25 | TK-P0 jagamispiir — **kontrollimata, ei tea kummaski suunas** | teekond | kontrolli enne liigitamist |
| 26 | ~~Privaatsustingimused ei nimeta TartuNLP-d volitatud töötlejana~~ — **TEHTUD 03.08**: §5 nimetab TartuNLP eesti ettelugemise juures, ET/EN/RU; `PRIVACY_VERSION` → `2026-08-03`. Juristi sisukinnitus puudub endiselt (kehtib kogu dokumendi kohta) | juriidiline | tehtud |
| 27 | ~~Art. 28 andmetöötlusleping TartuNLP-ga~~ — **SULETUD 03.08**: kasutusluba on omaniku kinnitusel olemas; paberitöö läks T27 juristi-kinnituste korvi (S10) | juriidiline | viidud T27-sse |
| 28 | ~~Vestlus nimetab KOV-ist ainult üht-kaht üldnimetusega spetsialisti~~ — **KOOD TEHTUD JA SERVERIS** (`496e8aaf`, kontrollitud 04.08; deploy'mata on ainult viimistlus `e1934c5c`): kontaktiplokk kannab nüüd rollide katet (nt Harku vallal 15 kontakti seitsmes rollis, mitte kaks nime) ja vastus valib kolme režiimi vahel — teemata küsimuses kirjeldab rolle ja küsib teemat, kontaktipäringus nimetab kõik selle teema rolliga inimesed, konkreetse teenuse juures teemale lähima rolli. Kehtib kõigis KOV-ides | vestlus / KOV-kontaktid | tehtud (viimistlus ootab deploy'd) |
| 29 | ~~Laadimisloor ei olnud ekraanilugejaga läbitav — „Sisenen" oli kättesaamatu~~ — **TEHTUD 07.08** (omaniku teade nägemispuudega kasutajatelt). `role="dialog" aria-modal="true"` ei kärbi Chrome'i\TalkBacki puud: mõõdetuna oli loori all 23–31 sihitavat juhtelementi („Jäta vahele", „Lülita taustaheli välja", „Käivita", kiirriba, esmakülastuse a11y-akna dokk) ja loori enda „Sisenen" alles kuues — TalkBack luges täpselt seda järjekorda. Uus `lib/inertOutside.js` märgib kogu tausta `inert`-iks (fookus + klõps + ekraanilugeja kirje kaovad korraga), loor võtab fookuse endale ja annab ta sisenemisel `#main`-ile; sr-only `role="status"` ütleb, et lävi ilmub mõne sekundi pärast (`room.enter_pending`\`enter_ready`). Sama värav on nüüd ka esmakülastuse ligipääsetavusaknal, mis seisab loorist kõrgemal. Mõõdetud pärast: **1 sihitav element = „Sisenen"** | ruum / a11y | tehtud |

**KONTROLLITUD KOODIST 03.08 — kaks „viga" olid juba parandatud.** Analüüsidokument
`fable-5-ruumid-liitumine-ja-konevoog.md` kirjeldab hilise liituja salvestamist ja
nõusoleku tagasivõtmise mõjutut egressi, aga E5-töö parandas mõlemad: `joinCall` peatab
ACTIVE salvestuse fail-closed, kui uus liituja pole nõustunud, ja
`respondToRecordingConsent` suunab WITHDRAWN/DECLINED ACTIVE ajal `discardActiveRecording`
kaudu (egress-stopp + artefakti kõrvaldus + rida `DELETED`). `cancelRecordingRequest` on
piiratud eel-ACTIVE staatustele. **Õppetund kordub: analüüsidokumendi leid ei ole olek.**
Ma kandsin need siia dokumendist, koodist kontrollimata — sama viga, mille pärast A/B/C
register kandis vale väravat.

**Punkt 5 sai 03.08 kontrollitud ja parandatud.** Kontroll näitas, et katkestusrada
puudus täielikult: mikrofoninupp oli lüliti, mille teine vajutus SAATIS heli ära, ja muud
väljapääsu ei olnud. Nüüd on katkestus oma nupp (+ Escape) ja providerini viib täpselt üks
värav, mis kontrollib katkestuslippu enne kutset.

---

### 4.3. Paketikoodide täisinventuur

Korje leidis **122 koodi**. Perekonnad ja teadaolevalt lahtised liikmed:

| Perekond | Koodid | Lahtised |
|---|---|---|
| RAG | P0–P8.1, RAG-QM-P0/P0a/P1 | P8.1, RAG-QM-P1, P8.6 |
| SUP supervisioon | P0–P11 | P1–P11 |
| TK teekond | P0–P5, KOMPASS-P0 | P0 (kontrollimata), P1–P5, KOMPASS-P0 |
| COLLAB | P0–P6 | P3 jääk, P4, P5, P6 |
| CASEWORK | P0–P7 | P3–P6; **P7 = juhtumi objekt — TEHTUD 07.08, värav väljas**; **P2 = JTA-V1 E5–E6 — TEHTUD 08.08**; **JTA-V1 E1–E8 tehtud 08.08, värav väljas, ükski otsus ei ole lahti** |
| WB-V2 tööheaolu | P0–P5, TH-RUUM-P0, TO-P1, TO-P4 | P3–P5, TH-RUUM-P0 |
| PERF | P0–P6 | P0 jääk, P1–P6 |
| MAKSED | P0–P3 (+P1a/b/d/e) | P2, P3, recurring |
| RV rollivahetaja | P0–P3 | P1, P2, P3 |
| VEST vestlusaken | P0/P0a, P1–P4 | P1–P4 |
| EXPORT | P0–P4 | P2–P4 |
| FAILID (T08) | P0/P0.1, P1–P3 | kõik — omaniku otsusega ootel |
| ADMIN | P0.1–P0.4, P1 | P0.2, P0.3, P0.4, P1 |
| AVALIK | P0–P4 | P2–P4 |
| TÖÖLAUD | P0–P3 | P2, P3 |
| DOK-XTEN | P0, P1 | P1 |
| HELP | P0/P0a/P0b | — tehtud |
| SK kiireloomuline abipalve | E1–E6 | — **kõik tehtud 05.08**; lahtised on ainult aktiveerimise otsused O-SK-2/4/5 |
| VÄLI, OPS, VOICE-V1, KOV, PROF, SOL, OPUS | üksikud | vt lähtefaile |

**Aus piirang:** neist 122-st kontrollisin koodist ~25. Ülejäänute seis pärineb
dokumentidest ja **võib olla sama vananenud nagu A/B/C register oli** — täielik
kontrollpass on ise eraldi töö ja seda ei ole tehtud.

**06.08 mõõt selle piirangu kohta: kontrollisin S4.2-st kolme rida ja kõik kolm olid
aegunud** (nr 11, 13, 24 — kõik juba tehtud, nr 13-l oli lisaks vale failiviide). Valim on
väike ja teadlikult juhuslik, aga suund on selge: **lahtiste ridade nimekiri on pessimistlik,
mitte optimistlik.** Enne ükskõik millise S4.2 rea kallale asumist kontrolli ta koodist —
tõenäosus, et töö on juba tehtud, ei ole väike.

---

### 4.4. Sahtel — ideed, mis ootavad tingimust

Need ei ole „kunagi võib-olla". Igal on kirjas, mis ta on ja mis ta äratab.

#### Tööheaolu anonüümne valdkondlik andmekiht

*`ideed.md` ptk 20. Analüüs valmis.*

Tööheaolul on kaks rangelt eraldatud eesmärki: **töötajale privaatne töötoe töölaud** ja
**valdkonnale anonüümne töökorralduslik ülevaade**. Ahel on privaatne tööheaolu →
standardiseeritud näitajate anonüümne koond → KOV-i osakonna juhtimisvaade → ESTA
valdkondlik analüüs → ministeeriumi süsteemne ülevaade. **Privaatseid vastuseid, vabatekste
ega üksiktulemusi sellesse ahelasse ei edastata kunagi.**

Väärtus: Eestis ei ole täna ühtegi andmestikku sotsiaaltöötajate töötingimuste kohta, mis ei
oleks küsitlus. **Äratab:** ESTA tõlgendaja + O-WB-3 õigusanalüüs.

#### KOV-i osakonna igakuine tööheaolu koond

*`ideed.md` ptk 21. Analüüs valmis.*

Osakonna juht saaks kord kuus anonüümse töökorraldusliku ülevaate. Raport kannab nähtavat
põhisõnumit: *„See ülevaade kirjeldab osakonna töötingimuste ja toe mustreid. Seda ei tohi
kasutada üksikute töötajate hindamiseks ega tuvastamiseks."* Raport algab andmete piisavuse
plokiga — periood, kas valim lubab avaldada, mis on privaatsuse tõttu peidetud,
representatiivsuse märkus.

**Äratab:** partnerlepe + baromeetri pretsedent. Seotud otsusega **O-WB-K** (koondite lävi).

#### ESTA liikmepakett ja ühe euro mudel

*`ideed.md` ptk 26.*

Kui kontrollitud ESTA liige kasutab tasulist SotsiaalAI paketti, suunab platvorm iga aktiivse
liikmekuu eest **ühe euro ESTA-le**. Kasutaja kuutasu ei suurene. Arvestus käib ainult siis,
kui liikmestaatus on kontrollitud, pakett on aktiivne, kuu makse on laekunud, makset ei ole
tagastatud ja sama liikme eest ei arvestata kuus mitut eurot. Aastapaketi puhul jagatakse
arvestus aktiivsete kuude vahel.

See lahendab ka küsimuse „kes maksab tööriistade eest". **Äratab:** ESTA partnerlusleping.

#### ESTA foorum, piirkonnaruumid ja teemakogukonnad

*`ideed.md` ptk 27.*

ESTA liikmeala võib kanda üleriigilist professionaalset foorumit ja liikmestaatusel põhinevaid
piirkonnaruume — ESTA kuus ametlikku piirkonda: Ida-, Kesk-, Lõuna-, Lääne-, Põhja-Eesti ja
Saaremaa. Juurde teemakogukonnad. **Äratab:** ESTA partnerlus; MVP on kirjeldatud ptk 27.12.

#### Supervisiooniruum kui keskne töövorm

*`ideed.md` ptk 23.*

Supervisioon ruumina, mitte vormina: fookusküsimus, ühine lõuend, jagatud märkmed,
refleksiooniküsimused, osalejad, taimer, järgmiste sammude ala. Sinna kuulub ka **häälvestlus
range privaatsuslepinguga** (ei salvestata vaikimisi, automaatset transkripti ei tehta, AI ei
kuula ega koosta kokkuvõtet, superviisor ei saa ühepoolselt salvestamist käivitada, MVP-s
võib salvestamise täielikult välistada) ja **visuaalne valgetahvel**.

Seotud ideega, et supervisioon võiks olla eraldi tasuta teenus ja töölaud (ptk 22).
**Äratab:** ESTA partnerlus + päris superviisorid.

#### Ruumiline kasutuskogemus

*`ideed.md` ptk 28 + ruumilise platvormi visioon.*

Hõljuvad klaaspaneelid, dokk, jaamalend, kaamera- ja näpistusgrammatika. Tehniline alus on
juba kolmes kohas koodis ja kasvab viiludena. **Äratab:** VR-viilude järjekord; tervikuna on
see horisont C.

#### Riigi dokumentidest sündinud ideed

Omastehooldaja ruum (hooldaja märgib OMA olukorra, mitte teise inimese diagnoosi) · VIPS-
spetsialistide tööruum · tervise teejuhi tööruum (1.07.2027 heaolupiirkondade tähtaeg) ·
heaoluplaani peegel · kriisirežiim · juhendite värskuskanal · lubaduste audit (/voimalused
kannab 19 avalikku lubadust, iga lause vajab tõendit) · ukraina keel · **SOTSIAALVALVE**
(KOV-i valvelaud) · **Häirekeskuse järelsuunamise sild**. Kirjeldused ja ajendid on osa II
ptk 4 C-tabelis.

## S5. Spetsialisti rada

### Tehtud

**Töölaud.**
Töölaud on sotsiaaltöötaja päeva algusekraan: mis on saabunud, mis ootab vastust, mis on
tähtaja lähedal. Kaardid toovad esile selle, mis vajab tegutsemist, ja viivad ühe vajutusega
õigesse tööruumi. Teavitused ei tule e-postiga peale, vaid seisavad siin, kuni töötaja nad
ise ette võtab.

**Teenuspäevik.**
Teenuspäevik on osutaja ja tema töötajate igapäevane teenuskirjete raamat. Töötaja märgib
külastuse või teenuse hetkel, mis tehti ja kui kaua see võttis; kuu lõpus koostatakse sellest
kuuaruanne, mille saab esitada, kinnitada ja osakonna juhatajale jagada. Aruanne salvestub
dokumendina, mitte kaduva allalaadimisena.

Päev on modelleeritud päris tööpäevana, mitte ühe külastusena: olekumasin viib töö
plaanitust teel-olekusse, kohalejõudmiseni ja lõpetamiseni, kus järgmise kliendi juurde
sõitmine ongi eelmise juurest lahkumine. Marsruudi pikkuse arvutab platvormi enda
marsruudimootor, aadressid tulevad Maa-ameti registrist, ja terve päeva saab ühe vajutusega
navigaatorisse saata. Sõidupäevik tekib kõrvalsaadusena, ilma odomeetrit lugemata.
Sisestada saab ka võrguta — kirje läheb järjekorda ja sünkroniseerub hiljem.

Teenuspäevikul on **STAR/s-veebi väljavõtte kuju**: sotsiaalhoolekande seadus paneb
andmete registrisse kandmise kohustuse ka teenuseosutajale, ja platvorm aitab seda täita
ilma sama asja kaks korda sisestamata. Platvorm ei ole register ega püüa selleks saada.

**Välitöö.**
Välitöö kest on mõeldud tööks väljaspool kontorit: ühe käega, halva levialaga, sageli
seistes. Külastuse märkme saab dikteerida, lisada fotod ja dokumendid, ning kõik see elab
seadmes seni, kuni võrk tagasi tuleb. Fotod puhastatakse metaandmetest enne saatmist ja
manused kannavad oma säilitustähtaega.

**Juhtumitugi.**
Juhtumi juurde kuuluvad artefaktid — juhtumi kokkuvõte, lühikirjeldus, tegevusplaan,
eelhinnangu kokkuvõte, STAR-i abitekst — koostatakse platvormil ja kannavad alati märget,
kas tegemist on kliendi öelduga või masina mustandiga. Lõpetatud juhtumid liiguvad omaette
vaatesse, kust saab neid hiljem üle vaadata ja meetodipeeglisse viia.

**Kiireloomuline vastuvõtt.**
Omavalitsuse laua taga istuv töötaja näeb ühte järjekorda, kus seisavad koos kiireloomulised
abipalved ja tavalised eelpöördumised — kaua oodanud on ees. Kaks allikat kannavad kahte eri
lubadust ja neid ei valata kokku: lugemisaeg on kirjas ainult kiireloomulise abipalve real
ja eelpöördumise tühi lahter tähendabki, et sellist lubadust ei antud.

Töötaja saab pöördumise märkida loetuks, võtta töösse, põhjendatult keelduda või anda üle
järgmisele üksusele. **Üleandmine üksi ei liiguta vastutust** — kuni vastuvõttev laud ei ole
kinnitanud, vastutab endine. **„Loetud" on teadlik toiming, mitte nimekirja avamise
kõrvalmõju**, sest muidu täituks lugemisaja lubadus ilma, et keegi teksti loeks. Iga
vaatamine, toiming ja edasisuunamine jääb kellaajaga ja nimeliselt kirja, ka siis, kui
töötaja ainult vaatas.

Laud ise on funktsionaalne, mitte nimeline: tema taga on nimetatud mehitajad ja omanik.
Sotsiaaltöötaja roll üksi ei ava võõra valla lauda — ligipääs käib laua liikmelisusest.

### Poolik

| Teema | Mis töötab | Lahtised sabad |
|---|---|---|
| Töölaud + teavitused | kaardid, järeltegevused, sündmusekiht | U1 mitme-osaleja audience-reegel (vt S4.2 nr 12) |
| Teenuspäevik | OSA I + OSA II tervikuna | erihoolekande profiil (A1) ja sotsiaaltransport (A6) on eraldi tööriistad, vt S4.1 |
| Välitöö | kest, GPS, OCR, võrguta rada | seadme-QA maatriks; oma piloot outreach-osakonnaga |
| Juhtumitugi | artefaktid + päritolumärgistus + lõpetatud juhtumid + **juhtumi objekt elutsükliga (TEHTUD 07.08, värav väljas)** + **juhtumitöö assistent E1–E8 koos STAR2 kandmise järjekorra ja säilituse jõustamisega (TEHTUD 08.08, värav väljas)** | **aktiveerimine** ootab Õ2/Õ3 andmekaitseanalüüsi ja omaniku luba (S4.1) ning säilitustöö cron-rida serveris (S1); genogramm ja ökokaart |
| Kiireloomuline vastuvõtt | kogu rada koodis ja tõendatud | ükski päris laud ei ole seadistatud — **aktiveerimine on partneri-, mitte tehnoloogiaotsus**; laua loomise ja mehitajate haldamise vorm on admini API-s olemas, aga admini vaates saab täna ainult kinnitada ja lülitada |

### Tegemata

Juhtumitöö assistent, juhtumi objekt, genogramm, ökokaart, erihoolekande profiil,
sotsiaaltransport — kõik **S4.1**-s koos blokeerijatega. Siin ei dubleerita.

---

## S6. Professionaalne areng ja ühistegevus

### Tehtud

**Kovisioon.**
Kovisioon on kolleegide omavaheline juhtumiarutelu ilma välise superviisorita. Platvorm
juhib grupi läbi kaheksa etapi — juhtumi toomisest kuni valiku ja järgmiste sammudeni —
nii et arutelu ei jää poolele teele ega kaldu nõuandmiseks. Igal osalejal on privaatne
tööpind ja grupil ühine lõuend; juhtumi saab tuua nii sotsiaaltöötaja kui teenuseosutaja.
Lõpetatud kovisioonist jääb alles see, mille grupp ise otsustas alles jätta.

**Supervisioon.**
Supervisioon on struktureeritud töösuhe superviisori ja töötaja või grupi vahel: teemade
jagamine, kohtumiste rütm, kokkulepped ja nende lõpetamine. Superviisor näeb ainult seda,
mida talle on jagatud, ja töötaja privaatne osa jääb privaatseks. Supervisioonist saab
vajadusel tööheaolu poolele üle anda, ilma et inimene peaks oma lugu uuesti jutustama.

**Mentorlus.**
Mentorlus viib kogenud spetsialisti ja alustaja kokku: mentoriprofiilid, soovi esitamine,
suhte kujunemine, kohtumiste ettevalmistus ja märkmed. Mentori profiil on tema enda hallata
ja suhe lõpeb selgelt, mitte vaikselt.

**Meetodipeegel.**
Meetodipeegel on koht, kus töötaja vaatab oma tööd meetodi pilguga: mida ta tegi, mis oli
fakt ja mis tõlgendus, mis vahetulemus tekkis ja millist tuge ta ise vajab. See ei ole
aruanne kellelegi — see on professionaalse arengu materjal, mis kuulub töötajale.

**Tööheaolu.**
Tööheaolu on töötaja enda ruum: koormus, katkestused, töö piirid, rollipiirid, rasked
juhtumid, taastumine. Kirjed kuuluvad inimesele endale ja ükski juht ei näe neid
individuaalselt — see ei ole poliitika, vaid arhitektuur. Koondid avanevad alles siis, kui
grupis on piisavalt eristuvaid inimesi, et kedagi ei saaks üksikuna ära tunda.

**Materjalid ja praktikad.**
Spetsialistid saavad esitada materjale ja häid praktikaid, mis pärast ülevaatust jõuavad
teistele. Kogutud praktika ei kao inimesega koos ära.

### Poolik

| Teema | Mis töötab | Lahtised sabad |
|---|---|---|
| Kovisioon | 8 etappi, lõuend, privaatne pind, osutaja saab luua, lõuendireegel terve | privaatne märkmik puudub (S4.2 nr 23) |
| Supervisioon | V1 tervikuna | SUP-P1…P11 täismudel; autenditud läbiv voog tõendamata |
| Mentorlus | kood tervikuna | ESTA mentorite individuaalsed nõusolekud — partner, mitte kood |
| Meetodipeegel | refleksioonikirje, faktid vs tõlgendused, vahehindamine | sekkumispäevik, meetodite kataloog, meetodi valimise assistent, kliendi tagasiside, arenguvaade (S4.1) |
| Tööheaolu | E0 + piloodirada + koondid | P3–P5; nädalarütm ja naasmispunkt; **O-WB-K: kas tõsta lävi 3 → 5** |
| Ühistegevus | osaleja- ja jagamiskiht, kokkuvõtte kinnitusring | võrgustiku vertikaal, kohtumise ühisvaade (S4.1) |
| Materjalid | esitamise ja ülevaatuse rada | esimesed päris esitused puuduvad — kasutajad, mitte kood |

---

## S7. Ruumid ja kõned

### Tehtud

**Vestlusruumid.**
Ruum on koht, kus mitu inimest töötavad ühe asja kallal — kovisioonigrupp, supervisioonipaar,
võrgustik või klient ja töötaja. Ruumi kutsutakse nimeliselt, liikmelisus on nähtav ja
ruumist saab lahkuda. Ruumi kokkuvõtte saab kinnitusringi kaudu ühiselt heaks kiita, nii et
keegi ei kirjuta teiste eest kokkuvõtet, mida nad ei ole näinud.

**Helikõned.**
Ruumis saab pidada helikõne ilma eraldi konverentsitarkvarata. Salvestamine ei ole vaikimisi
sees; see käivitub ainult osalejate selgesõnalisel nõusolekul ja salvestise eesmärk
märgitakse ette ära.

**Nõusolek antakse inimese enda keeles.**
Kui keegi kõnes salvestamise nõusolekut küsib, näeb iga osaleja küsimust — kes küsib, mis
eesmärgil salvestatakse, mis salvestisega edasi juhtub ja mis on tema valik — selles keeles,
milles ta platvormi kasutab: eesti, inglise või vene. Nii oli juba varem. Uus on see, et
**ka salvestatav nõusolekukirje tekib samas keeles**: platvorm paneb tõendisse täpselt selle
teksti, mida inimene luges, ja märgib kirje juurde keele. Varem kuvati küsimus kolmes keeles,
aga tõendisse jäi alati eestikeelne tekst — ehk kirjas seisis, et venekeelne osaleja nõustus
tekstiga, mida talle kunagi ei näidatud. Nõusoleku tagasivõtmine ei kirjuta seda teksti üle:
alles jääb see, millega inimene tegelikult nõustus.

### Poolik

| Mis töötab | Lahtised sabad |
|---|---|
| ruumid, liikmelisus, kokkuvõtte kinnitusring, helikõned, salvestuse nõusolekuvoog kolmes keeles, omanikuvahetuse teavitus | **nõusolekupere on terve — kõik neli viga parandatud**; päris-egress QA; ruumi elutsükli miinimum |

---

## S8. Organisatsioon ja partnerid

### Tehtud

**Organisatsiooni kiht.**
Asutus saab platvormil oma ruumi: liikmed, üksused, kohad, rollid ja õigused. Organisatsioon
saab võtta vastu pöördumisi ühisele lauale, hallata oma teenuseprofiili, jagada tööd üksuste
vahel ja koostada aruandeid. Sponsorluse kaudu saab asutus katta oma klientide või töötajate
ligipääsu. Kõik ligipääsumuudatused jäävad auditijälge.

### Poolik

| Mis töötab | Lahtised sabad |
|---|---|
| org-ruum, liikmed, üksused, kohad, vastuvõtulaud, sponsorlus, audit, aruannete eksport | esimene päris organisatsioon puudub — aktiveerimine on partneri-, mitte tehnoloogiaotsus |

### Tegemata

Partnerpiloot (üks KOV-i sotsiaaltööosakond, eelpöördumise täisrada), SOTSIAALVALVE,
Häirekeskuse järelsuunamise sild, KOV kuukoond, teenuste puudujäägikoond — vt **S4** ja
horisondid osas II.

---

## S9. Platvormi alused

### Tehtud

**Konto, ligipääs ja turve.**
Kasutaja loob konto, kinnitab e-posti, kasutab PIN-i ja saab oma konto kustutada nii, et
kustutus käib päriselt läbi kõigi kihtide. Privaatsuspiirid on jõustatud serveris, mitte
liideses — ka administraator ei pääse võõra kovisioonijuhtumi ega tööheaolu kirjete juurde.

**Keeled ja ligipääsetavus.**
Platvorm töötab eesti, inglise ja vene keeles ning tõlkepariteeti kontrollib eraldi värav —
üheski keeles ei tohi jääda auk. Ekraanilugeja, klaviatuurinavigatsioon ja liikumise
vähendamise eelistus on arvesse võetud.

**Maksed ja kvoodid.**
Tellimuspaketid, ühekordne ost ja sponsoreeritud ligipääs töötavad. Kasutus arvestatakse
läbipaistvalt ja kvoot ei kao märkamatult. **Ligipääs oma andmetele ei aegu kunagi** — ka
siis, kui tasuline pakett lõpeb.

**Eksport ja andmekoopia.**
GDPR-i andmekoopia ja materjali väljaviimine PDF- või DOCX-kujul on sisse ehitatud.

**Admin ja analüütika.**
Administraatoril on kasutajate, tellimuste, teadmusbaasi ja koondnäitajate haldus. Koondid
on kaitstud väikese arvu summutusega.

### Poolik

| Teema | Lahtised sabad |
|---|---|
| Ligipääsetavus | RV-P1 rollivahetaja jätk, tõlkestrateegia, P1 juured |
| Jõudlus ja kulu | kvoodileke, L3 renewals-timerid, L5 kuluajalugu (S4.2 nr 13–15) |
| Maksed | recurring on koodis ja väljas — **lüliti, mitte arendus**; päris ost toodangus tõendamata |
| Admin | ADMIN-P0.2…P0.4, P1 |
| Koondite kaitse | **O-WB-K** — kas ühtne avalik number või mehhanismi kirjeldus; admini kriisiloendur vajab enne mistahes avalikku „k≥5" lubadust karastust (vt osa II ptk 1) |

---

## S10. Avalik pind ja release

### Tehtud

**Avalikud lehed.**
Võimalused, kasutusjuhend, kasutustingimused, privaatsustingimused, tööalase kasutuse
raamistik, hinnastus, „Meist" ja „Autorilt" on olemas kolmes keeles. Registreerimine on
teadlikult suletud kuni avaliku käivituseni.

### Poolik

| Mis töötab | Lahtised sabad |
|---|---|
| avalikud pinnad ja juriidilised tekstid | avaliku kesta viil (E1) — **kontrollimata**; lubaduste audit: /voimalused kannab 19 avalikku lubadust, iga lause vajab tõendit või parandust |

### Tegemata

**T27 OPS-FINAL-A0** — release candidate'i koondvärav, kuhu on teadlikult kogutud kõik
edasi lükatud QA-d: brauseri- ja seadmematriks, Playwright, päris Maksekeskus ja e-kirjad,
juristi kinnitused, täissviidid ja sõltumatud auditid. Käivitab omanik otsusega „lähme
turule".

Juristi-kinnituste korvis nimeliselt: kõigi avalike õigustekstide sisukinnitus (ükski ei
ole juristi üle vaadatud), **TartuNLP art. 28 andmetöötlusleping** (kasutusluba on olemas,
paberitöö mitte), art. 15 ekspordi kinnitus (T16) ja O-CW-7 järgsed juhtumitöö küsimused.
Seadmematriksis nimeliselt: **eestikeelse ettelugemise PCM16-heli päris iOS/Safari peal**.

---
## S11. Töökord

**Uude aknasse kleepimiseks üks rida:**

> Loe `AGENTS.md` ning `SotsiaalAI.md`-st S1.0, S11 ja S1.0 nimetatud järgmise töö teemasektsioon;
> ära loe kogu faili uuesti.

Uue teema väljastamiseks lisa lepingufaili nimi (nt `sotsiaalkiirabi-v1-arendusleping.md`).
Töökaust: `C:\Users\rauds\Desktop\SotsiaalAI`.

### Reeglid

1. **Töö käib otse `main`-is.** Harusid ega worktree-kaustu ei tehta. Üks teema korraga.
2. **Ploki järel väike värav, peatüki lõpus täisvärav.** Ploki järel: sihttestid, nõutud sond,
   eslint muudetud koodifailidel ja `git diff --check`; i18n ainult tõlkemuudatusel ning
   `db:migrate:check` kohe skeemimuudatusel. `TZ=UTC npm test` käib peatüki lõpus ning alati enne
   push'i/deploy'd, mitte iga ploki järel. Sama muutumatu koodipuu täissviiti ei korrata pärast
   raporti/koondi/S1 uuendust.
3. **Push ja deploy ainult omaniku selgel loal.** Sama kehtib päris e-kirjade, päris maksete ja päris partnerini jõudmise kohta. *(Parandatud 06.08: siin seisis „merge ja deploy". Reegel 1 järgi käib töö otse `main`-is, seega merge'imist ei toimu ja väravaks on **push** — vana sõnastus jättis lokaalse commit'i ja `origin`-i vahelise sammu nimetamata.)*
4. **Ära loe tootmiskasutajate sisu** ega kasuta päris kasutajaid testimiseks.
5. **Ära käivita `OPS-FINAL-A0`** — see on release candidate'i lõppvärav.
6. **Ära korda teostaja teste, build'i ega auditeid**, kui sama muutumatu puu tulemus on juba
   olemas. Uus jooks peab vastama uuele riskile, mitte rituaalile.
7. **Olekut kannab ainult see fail.** Aktiivse ploki vaheetappe ei logita; uuenda seis ploki
   lõpus ühe koondina või kohe, kui töö jääb blokituna/pooleli maha.

Miks need reeglid tekkisid — `git show db514ba0:"docs/platvormi arendus/SEIS.md"`.

### Kiirrežiim SOL-parandustele (omanik 12.08: üle 100 leiu, liigume plokkidena)

- **Tööühik on 2–8 seotud leidu**, millel on sama helper, teenus, andmemudel või runtime-rada.
  Üks suur mitmekihiline leid võib olla omaette plokk; seoseta leide ei liideta.
- Alguses üks lühike kaart: vastuvõtukriteerium → failid → sihttest → DB/brauseri vajadus.
  Täpsest raportist, seotud koodist ja testist kaugemale ei loeta ilma põhjuseta.
- Üks kandev negatiivkontroll käitumisklassi kohta. Sama shared helperi täpsetele kasutajatele
  ei tehta koopiat; erinevad invariantid peavad endiselt eraldi punaseks minema.
- Fake-prisma piiri tabamisel kavandatakse üks plokisond **enne koodi lõpetamist**, mitte pärast
  esimest täissviiti. Brauser avatakse ainult siis, kui vastuvõtukriteerium või ligipääsupiir
  seda vajab; muidu märgitakse runtime ausalt `not_run`.
- Ploki lõpus: kõik Seis-lõigud → **üks** `npm run sol:progress -- --write` → S1.0 tööots ja
  vajadusel üks lühike teemakoond → väike värav. Peatüki viimase ploki järel üks täisvärav.
  Testi-/sondidetail jääb raportisse, mitte S1 teostuslooks. Kui pärast täisväravat muutus ainult
  see kolmik, piisab `solAuditTally.test.js`-ist.
- Kohaliku vahecommit'i võib teha väikese värava järel, märkega `full gate: pending chapter
  close`. **Enne push'i või deploy'd peab peatüki täisvärav olema roheline.** Skeemi-, turva-,
  makse-, privaatsus-, võistlus- või laia shared-helperi muudatus saab vajadusel laiema kontrolli
  kohe; globaalset sviiti ei käivitata siiski rituaalselt, kui löögiala on sihttestiga tõendatud.

### Ülesande lõpus

Uuenda **selles failis** teemasektsiooni: mis liikus TEHTUD / POOLIK / TEGEMATA vahel, mis
saba jäi lahti, mis jäi `NOT_PROVEN`. Kui töö käigus selgus, et mõni siinne lause on vale,
paranda see kohapeal. Konkureerivat seisufaili ega „handoff-<kuupäev>" faili ei looda.

### Esimene tegevus uues aknas

Kontrolli read-only: `git status`, `git log -1`, `origin/main`. Teste ega build'i selleks ei
jooksutata. Kui kontrollitud fakt erineb sellest failist, kehtib fakt — paranda fail.

### Lokaalne testkeskkond (seatud 04.08, omanik: „las jääb")

Autenditud kontrollid ei ole lisatöö — 04.08 leidis päris sessiooniga läbisõit **kolm viga,
mida 2622 rohelist testi ei püüdnud**: puuduv tabel, korduv veateade ja **IDOR**. Roheline
sviit fake-prismaga ei tõenda ligipääsupiiri.

| Mis | Kus |
|---|---|
| **Viis kontot**, PIN **`45671234`** | `ai.admin` · `ai.specialist.a` · `ai.specialist.b` · `ai.client` · `ai.service-provider`, kõik `@sotsiaalai.test` |
| **OTP-värav lahti** | `.env`-is `LOGIN_OTP_BYPASS_EMAILS` (varukoopia `.env.backup-2026-08-04`). NB **`LOGIN_ALLOW_DIRECT_PIN` ei ole vaja** — see gate'ib teist rada |
| **Testandmestik** | üks eelpöördumine `ai.client` → `ai.specialist.a` + kolm `NetworkShare` kirjet |
| **SK-V1 laud** (05.08) | Harku vallal on seadistatud `UrgentDesk` (mehitaja `ai.specialist.a`, lugemisaeg 2 h, aegumine 12 h) + kaks abipalvet seisudes `SENT` ja `DECLINED`. **Ainult lokaalselt** — serveris ühtegi lauda ei ole ja rada on seal peidus |

**Login:** `POST /api/auth/login-step1 {email,pin}` → `temp_login_token` (ühekordne) →
`GET /api/auth/csrf` → `POST /api/auth/callback/credentials` form-encoded
`{csrfToken, temp_login_token, redirect:false, json:true}`.

**Mitu rolli korraga: eraldi küpsisefailid** (`curl -c/-b`). Brauseripaani vahekaardid
jagavad ühte küpsisepurki, seega nendega kahte sessiooni ei saa. Kolmerollilised rajad on
ainult nii testitavad. Brauseris saab rolli vahetada `fetch`-iga: `signout` → `login-step1`
→ `csrf` → `callback/credentials`, kõik lehe enda kontekstis.

**Skeemimuudatuse järel ei kõlba võõra sessiooni dev-server (leitud 05.08).** Kui pordil
3000 käib teise akna dev-server, hoiab ta **vana Prisma klienti** ka pärast `prisma
generate` — `globalForPrisma` vahemälu elab HMR-i üle. Kõik uut tabelit puutuvad päringud
annavad seal HTTP 500 ja see näeb välja nagu koodiviga. Võõrast serverit ei tapeta ja
Next lukustab kausta ka teisel pordil, aga **`next start` toodangu-build'iga töötab**:

```
npm run build
(set -a; . ./.env; set +a; NEXTAUTH_URL=http://localhost:3100 npx next start -p 3100)
```

NB `next start` seab `NODE_ENV=production`, mille peale `lib/prisma.js` otsib
`.env.production`-it — seda ei ole, seega env tuleb ise shelli sisse laadida.
Ja **build peab olema uuem kui viimane uus marsruut**: vana build andis
`/api/admin/urgent-desks/aggregate` peale 405, sest tee langes `[deskId]`-i alla.

### Viitematerjal (ei kanna olekut)

| Fail | Mille jaoks |
|---|---|
| `ideed.md` | tegemata teemade kontseptsioonid ja taust (2946 rida, 29 ptk; sisaldab ka juba ehitatut — olekut EI kanna) |
| `arendusteemade-masterregister.md` | teemade definitsioonid ja piirid |
| `tXX-…-ulesanne.md` | teemalepingud — ei muutu pärast väljastamist |



# OSA II — OLEMUS JA SUUND

## 1. Mis SotsiaalAI praegu on

### Ühe lausega

SotsiaalAI on kiht **inimese elu ja riigi süsteemi vahel**: koht, kus eluküsimusega inimene
saab oma olukorrast selguse enne, kui ta kohtub ühegi blanketiga, ja kus spetsialist saab teha
oma tööd ette valmistades, reflekteerides ja koostööd tehes — ilma et kumbki kaotaks kontrolli
oma info üle.

### Kolm „EI-d", mis defineerivad meid sama palju kui funktsioonid

1. **Me ei pea kliendiregistrit ega dubleeri STAR-i.** Ametlik kandja ei teki platvormil
   kunagi; registrisse liigub ainult see, mille töötaja on ise kirjutanud ja kinnitanud.
2. **AI ei tee ühtegi otsust.** Iga AI väljund on mustand kuni inimese kinnituseni; AI ei
   muuda kunagi privaatset jagatuks.
3. **Mitte midagi ei jagata ilma inimese teadliku, tagasivõetava otsuseta.** Jagamine on
   konkreetne, eesmärgipõhine ja nähtav („Minu jagamised" + tagasivõtt).

Need kolm lauset on ühtaegu tootefilosoofia, õiguslik positsioon ja turunduslause. Neid ei
tohi kunagi pehmendada, sest nad on ainus asi, mida ükski suur konkurent kopeerida ei taha —
kopeerimine tähendaks nende ärimudeli hülgamist.

### Kolm rolli, üks platvorm — positsioon, mida Eestis kellelgi teisel ei ole

- **Pöörduja:** vestlus Eesti allikatega, Teekond (privaatne elusündmuse tööruum),
  eelkaardistus STAR2 hindamisjuhendi seitsme eluvaldkonna raamistikus, eelpöördumine tema
  enda valitud jagamisega, dokumentide selgitamine, kohtumise kokkuvõte vastusega „sain aru /
  mul on parandus".
- **Spetsialist:** vastuvõtulaud, ettevalmistus, koostööruumid ja kõned, kovisioon (8 etappi,
  atomaarne sulgemine ja purge), supervisioon, mentorlus, välitöö võrguta mobiilikest,
  tööheaolu privaatsed tööriistad, artefaktid päritolumärgistusega (kliendi öeldud / töötaja
  tähelepanek / töötaja tõlgendus / AI mustand / dokumendist …).
- **Teenuseosutaja:** teenuseprofiil, teenusekaart tegeliku kättesaadavusega, pöördumiste
  vastuvõtt, abivahenduse sobitus.

Sellest kolmnurgast sünnib võimekus, mida ükski üherolliline süsteem ei saa pakkuda: **sama
sündmuse kolm vaadet** (inimene valmistub → töötaja võtab vastu → teenus leitakse) ilma, et
info kordagi omaniku käest lahkuks.

### Mis on tehniliselt tõsi (mitte lubadus)

- Privaatsuspiirid on **serveris jõustatud** — IDOR-testidega tõendatud; ka admin ei pääse
  võõra kovisioonijuhtumi ega tööheaolu kirjete juurde.
- Koondid on kaitstud, **aga kaks kaitset on ERI LIIKI ja neid ei tohi ühe numbri alla
  kokku valetada (kontrollitud koodist + serverist 29.07.2026; täpsustus samal õhtul —
  varasem sõnastus siin failis nimetas admini „5" ekslikult k-anonüümsuseks):**
  - **Tööheaolu koondid ja piloodiskoobid = päris inimesepõhine k-anonüümsus, lävi 3:**
    `lib/wellbeing/aggregate.js` arvutab valimi ERISTUVATEST inimestest
    (`ownerUserId`) ja summutab alla läve; `pilotScopes.js` põrandastab iga skoobi
    väärtuse 3 peale ja päringuga läve langetada EI SAA (kontrollitud sihilikult).
    Env `WELLBEING_MIN_GROUP_SIZE` ei ole toodangus seatud → kehtib 3.
    Individuaalset juhivaadet ei eksisteeri arhitektuuriliselt.
  - **Admini kriisiloendur = SÜNDMUSEPÕHINE väikese arvu summutus ühel mõõdikul,
    MITTE k-anonüümsus:** `lib/admin/analyticsMetrics.js`
    (`CRISIS_SUPPRESSION_THRESHOLD = 5`) summutab, kui sündmuste ARV on 1–4 — aga ühe
    inimese viis kriisivestlust kuvatakse „5"-na, st isikutasandi kaitset see number ei
    anna. Odav karastus on olemas, kui numbrit kunagi avalikult öelda tahetakse:
    `ChatLog`-il on `userId`, loenduri vahetus eristuvate kasutajate peale (~3 kohta)
    teeks „5"-st päris k≥5.
  - **Järeldus, mis on vastuintuitiivne ja väärib meeldejätmist: 3 on siin TUGEVAM
    konstruktsioon kui 5** — väiksem number, aga mõõdab õiget asja (inimesi, mitte
    sündmusi). Avalikes tekstides (lubaduste leht, AI-määruse vastavusdokument, essee)
    räägi seni MEHHANISMIST („koond avaneb alles siis, kui inimesi on piisavalt, et
    kedagi ei saaks üksikuna ära tunda"), mitte numbrist. Ühtki „k≥5" avalikku lubadust
    ei ole antud (kontrollitud messages/*.json + kood 29.07) — aken on lahti.
  **LAHTINE OTSUS O-WB-K:** kas tõsta tööheaolu lävi 5-le (ühtne avalik number) või
  jätta 3 ja kirjeldada kaitset mehhanismina. Hind tõstmisel: alla 5-liikmelise
  meeskonna koond kaob täielikult — väikeses KOV-is on see enamik meeskondi, ja
  tõenäoliselt just see ongi põhjus, miks lävi on 3. NB enne mistahes ühtset avalikku
  numbrit vajab ka admini „5" pool ülal kirjeldatud karastust — muidu oleks lubadus
  peenelt vale ka pärast tööheaolu tõstmist. Env-i praegu ei muudeta (soovitus 29.07:
  dokument joondati koodiga, mitte kood dokumendiga).
- Kriisirada on **fail-closed** kolmes keeles.
- Andmed asuvad Eestis; platvorm töötab kolmes keeles (et/en/ru); ekspordiõigus (GDPR
  andmekoopia) on sisse ehitatud.
- Maksed töötavad; registreerimine on teadlikult suletud kuni avaliku käivituseni.
  Funktsioonide hetkeseis on **osas I** (S2–S4) — siia numbrit ei kirjutata, sest ta vananeb.

---

## 2. Miks see on valdkonnale oluline — koht, mille riik on tühjaks jätnud

### 2.1. Vaheruumi tees

Sotsiaaltöö juhtub ruumis **elu ja süsteemi vahel**. Kõik kuus riigi dokumenti, mille ma läbi
lugesin, ehitavad süsteemi poolt: registrid (STAR2), koordinatsioon (TERVIK), riskituvastus
(§ 136 riskirühmitamine), kvaliteedikontroll, andmekogud. See on õige ja vajalik töö. Aga
**mitte ükski neist ei ehita elu poolt** — kohta, kus inimene oma olukorda ise mõtestab, ENNE
kui temast saab menetlusobjekt, ja kus töötaja on inimene, MITTE ainult menetleja.

TERVIK-eelnõu on selle asümmeetria puhtaim näide: tervise teejuht „koostab inimesele",
„selgitab inimesele", „motiveerib" — inimene on läbivalt sihitis. Heaoluplaani
juurdepääsuloendis (§ 135) inimest ennast ei ole. Samal ajal nõuab riigi enda kvaliteedijuhis:
*„Inimest koheldakse võrdväärse partnerina"* ja *„Inimesele tagatakse juurdepääs teda
puudutavale infole."*

**See lõhe — normatiivne lubadus vs süsteemide tegelikkus — ON SotsiaalAI koht.** Me ei
konkureeri riigiga; me ehitame seda poolt, mida riik struktuurselt ehitada ei saa, sest riik
ei saa olla inimese privaatse eneseselgituse teine pool. Register ei saa kunagi olla „minu
oma" — ta on definitsiooni järgi asutuse oma. Isiklik kiht saab tulla ainult väljastpoolt
süsteemi, ja ta peab olema usaldusväärne viisil, mida saab kontrollida.

### 2.2. Keeleliides riigi ja inimese vahel

Sotsiaalvaldkonna sügavaim ligipääsetavusprobleem ei ole rambid ega fondisuurused — see on
**keel**. Menetluskeel, milles riik kirjutab, ja elukeel, milles inimene mõtleb, on kaks eri
keelt. Kvaliteedijuhis nõuab „arusaadavat infot" ja abi „valikute tegemisel"; suurte
keelemudelite küpsus teeb selle nõude esimest korda ajaloos **taristuna** täidetavaks, mitte
brošüürina. SotsiaalAI on sisuliselt **tõlkekiht bürokraatia ja elu vahel** — mõlemas suunas:
inimese lugu → struktuurne eelinfo töötajale; ametlik otsus → arusaadav selgitus inimesele.

See on suund, mida tasub teadlikult nimetada ja kaitsta: *keeleliides heaoluriigile*. Sellel
kihil on väärtus sõltumata sellest, milliseid registreid riik järgmisena ehitab.

### 2.3. Andmeparadoks: riik on pime seal, kus meie näeme

Heaolu arengukava tunnistab ise: *„Praegune sotsiaalteenuste andmestike digiteerituse tase ja
andmekvaliteet ei ole riigi ja kohalike omavalitsuste sotsiaalvaldkonna juhtimiseks,
poliitikakujundamiseks ning teadus- ja arendustööks piisav."* Riigi registrid näevad
menetlusi, mis algasid. Nad EI näe:

- vajadust, millele teenust ei ole (menetlust ei teki → statistikat ei teki);
- töötajate tegelikku koormust ja taastumist (keegi ei julge seda tööandja süsteemi sisestada);
- kas inimese olukord PÄRISELT paranes (registrid loevad tegevusi, mitte muutust).

SotsiaalAI positsioon on ainus, kust need kolm andmekihti saavad üldse tekkida — **ja ainult
sellepärast, et me ei kuritarvita neid**. Teenuste puudujäägikoond, sotsiaaltöö kestlikkuse
baromeeter ja tulemuste mõõtmine on võimalikud ainult platvormil, kus individuaalne jälgimine
on arhitektuuriliselt võimatu. Usaldus ei ole siin moraalne valik, vaid **andmekihi
tekkimise eeltingimus**: päev, mil keegi kahtlustab jälgimist, on päev, mil andmed valetama
hakkavad. See on meie kõige vastuintuitiivsem vara: *me saame näha rohkem, sest oleme
lubanud vähem*.

### 2.4. Ajastus: aken on lahti umbes 2026–2028

Neli sõltumatut protsessi ristuvad just praegu:

1. **Keelemudelite küpsus** — inimkeelne eneseselgitus ja selge keele tõlge muutusid
   tehniliselt odavaks alles nüüd.
2. **AI-määruse jõustumine** (kõrge riski kohustused 02.08.2026) — turule tekib regulatiivne
   sein nende ette, kes tahavad AI-ga *otsustada*; meie oleme teadlikult ettevalmistuskihis.
   Regulatsioon on meile kaitsekraav, mitte takistus.
3. **Riigi reformid** (STAR2 iseteenindus, TERVIK 2027, heaolupiirkonnad) — riik ehitab
   uksi, mille taga peab keegi olema inimese poolel. STAR-i strateegia ütleb ise, et inimene
   võib alustada teekonda „mõnes muus keskkonnas" — *keegi peab olema see muu keskkond*.
4. **Tööjõukriis** — iga riigi dokument algab tööjõu nappusest; iga lahendus, mis päriselt
   vabastab töötaja aega, saab poliitilise tuule.

Kes selle akna ajal inimese-poolse kihi ära ehitab ja usaldusväärseks tõestab, seda on hiljem
peaaegu võimatu asendada — sest usaldust ei saa järele osta.

---

## 3. Kuhu areneda: kolm horisonti

### Horisont A (0–12 kuud): tõestus

Eesmärk: **üks päriselt töötav, mõõdetud, õiguslikult puhas kasutuslugu.**

- Release candidate + T27 koondvärav (kõik edasi lükatud QA-d).
- **Piloot:** üks KOV sotsiaaltööosakond, 2–4 töötajat, 10–30 pöördujat, eelpöördumise
  täisrada. Mõõdikud ilma sisu lugemata. STOP-rada valmis. (Leping ja 12-etapiline mudel on
  analüüsis olemas.)
- **Rahastus:** taotlus Heaolutehnoloogiate innovatsiooniprogrammi (2025–2030, lühikood 437) —
  programmi eesmärgikirjeldus kattub meie väärtuslubadusega peaaegu sõna-sõnalt. Kõrval
  ESF+ pikaajalise hoolduse TAT ja Šveitsi-Eesti programm (spetsialistide koolitus- ja
  tugisüsteem = kovisioon/supervisioon/mentorlus rahastuskeeles).
- **Õigusselgus:** selgitustaotlused SoM-ile ja SKA-le (eelpöördumise staatus, STAR2
  liidesed, kaks vastutavat töötlejat) — sügiskool avab isiklikud kontaktid, kirjad lähevad
  nädal hiljem viitega kohtumisele.
- **ESTA:** mentorite individuaalse nõusoleku voog käima (17 profiili ootab); rollijaotuse
  ettepanek (meie tehnoloogia, nende erialane kvaliteet, privaatandmetele ligipääsu neil ei
  ole kunagi).

### Horisont B (1–3 aastat): laienemine mööda riigi enda tähtaegu

- **1.07.2027 — heaolupiirkondade tähtaeg.** Igas piirkonnas tekivad tervise teejuhid, kelle
  heaoluplaan elab tervise infosüsteemis, aga kelle igapäevatöö (ettevalmistus, märkmed,
  tugimeeskonna koordineerimine, inimese ettevalmistamine kohtumiseks) jääb tööriistata.
  Teejuht on sotsiaaltöötaja kõrval meie teine loomulik professionaalne sihtrühm — ja tema
  tulek on seadusega dateeritud.
- **Teine KOV-laine:** esimese piloodi õppetundidega 3–5 osakonda; CASEWORK-tervik sama
  partneriga; välitöö kest osakondades, kus on outreach-töö.
- **Professiooni taristu:** kovisioon + supervisioon + mentorlus + meetodipeegel ühe
  paketina — „professionaalse arengu keskkond", mida ükski tööandja ega register ei paku.
  Siin on ka vastus valdkonna järelkasvuprobleemile: keskkond, kus algaja saab mentori,
  refleksiooniharjumuse ja kogukonna esimesest tööpäevast.
- **Org-kiht (T25)** aktiveerub alles siis, kui päris organisatsioon seda küsib — kood on
  lepinguna valmis, aktiveerimine on partneri-, mitte tehnoloogiaotsus.
- **Eksport-liidesed:** STAR2 ühesuunaline üleandmine (kui SKA ukse avab — strateegia lubab
  liidestusi teenuseosutajatega); KOV iseteeninduste „ühe ukse" haakumine.
- **Andmekihid käivituvad:** teenuste puudujäägikoond (huvikaitse-andmekiht) ja kestlikkuse
  baromeeter — mõlemad ainult partnerite ja selge õigusaluse olemasolul.

### Horisont C (3–10 aastat): isiklik heaolukiht elukaarel

- **Teekond muutub elukaare-pikkuseks:** mitte üks pöördumine, vaid inimese oma pidevuskiht
  läbi elusündmuste (lahutus, hooldus, töökaotus, vananemine) — riigi süsteemid tulevad ja
  lähevad, inimese lugu jääb tema omaks. „Teekonna kompass" (kus olen / mis on muutunud /
  mis järgmiseks) on selle esimene kehastus.
- **Ruumiline kogemus** (VR-põhjatäht: järveäärne tuba, klaaskaardid, lend läbi ruumi) —
  mitte efekt, vaid rahu disainiprintsiibina: keskkond, mis ise on abi osa. Tehniline alus
  (lennumootor, dokk, klaasikeel) on juba kolmes kohas koodis.
- **Lokaalsed mudelid:** eesti keele kõnetuvastus, isikuandmete märkaja enne jagamist, OCR —
  seadmes või Eesti serveris. Suveräänsus muutub müügiargumendist nõudeks; me oleme valmis.
- **Tulemuste mõõtmise kiht:** kvaliteedijuhis nõuab mõju hindamist „koos inimesega" — meie
  oleme ainus koht, kus inimene saab ise, vabatahtlikult ja koondatult öelda, kas ta olukord
  paranes. Riik mõõdab tegevusi; inimene saab mõõta muutust. See kiht võib kümne aasta pärast
  olla valdkonna kõige väärtuslikum tagasisideahel.
- **Mudeli eksport:** „inimese-poolne kiht heaoluriigile" on universaalne probleem. Eesti on
  ideaalne esimene maa (väike, digivõimekas, üks keel, üks register) — ja toimiv Eesti mudel
  on müüdav igale Põhjamaale. See on e-riigi loo puuduv peatükk: X-tee ühendas asutused,
  SotsiaalAI-laadne kiht ühendab inimese.

---

## 4. Funktsioonid: mis lisandub ja mille järgi me otsustame

### Otsustusväravad (iga uue funktsiooni 4 testi)

1. **Omaniku test:** kas see suurendab inimese kontrolli oma loo üle? (Kui väheneb — ei.)
2. **Varju test:** kas see hakkab dubleerima ametlikku registrit? (Kui jah — ei, ehitame
   selle asemel eksport-ukse.)
3. **Kihi test:** kas vähemalt kaks olemasolevat voogu saavad seda taaskasutada (K1–K8
   ühiskihid)? (Kui ainult üks — kas ta on piisavalt väärtuslik üksi?)
4. **Usalduse test:** kas funktsiooni saab kuritarvitada jälgimiseks, ja kas see võimalus on
   arhitektuuriliselt suletav? (Kui mitte suletav — ei.)

„Mitte ehitada" nimekirjad on sama tähtsad kui tegevuskavad — need on seni ära hoidnud
tööandja dashboardi, heaoluskoori, automaatse triaaži ja registri kloonimise. See distsipliin
on strateegiline vara.

### Omaniku otsus (28.07.2026): midagi ei kärbita

> „Mina hoiaks kõik asjad alles ja arendaks lõpuni, ja arendaks ka mingid ideed, mis olid
> veel sahtlis."

See on siduv suund: ükski olemasolev võimekus ei sure ja sahtliideed jäävad kaardile. Neli
väravat (ülal) EI ole sellega tühistatud — nad muutuvad tapariistast **järjestajaks**: nad ei
otsusta enam, KAS midagi ehitatakse, vaid MILLAL ja mis tingimusel. Ainus, mis jääb päriselt
keelatuks, on „Mida me EI ehita" loend (allpool) — see kaitseb usaldusarhitektuuri, mitte
ressurssi.

„Lõpuni arendamine" vajab iga asja juures kahte definitsiooni: **mis on „valmis"** ja **mis on
tema järgmine ühik** (kood / kasutaja / partner / otsus). Register allpool annab mõlemad.

**Teine omaniku otsus (28.07.2026): õigusselgus väravaks aktiveerimisele, mitte ehitusele.**

> „Pigem ei jää ootama õiguslikku infot funktsiooni välja arendamiseks, vaid saame funktsiooni
> lihtsalt peita."

Registri kõiki ridu, mille tingimus on „õigusanalüüsi taga" või „otsuse taga", loetakse nüüd
nii: **ehitus võib alata kohe; värav kehtib sisselülitamisele.** See on juba platvormi
tõestatud muster — recurring-maksed on toodangus *fail-closed dormant*, salvestus on
env-lippude taga, registreerimine sulgub ühe konstandiga; org-kihi analüüs sõnastas sama
põhimõtte ammu („otsused ei blokeeri koodi, vaid aktiveerimist").

Üks aus piirang, et peitmine päriselt kaitseks: **peidetud funktsioon on õiguslikult
neutraalne ainult seni, kuni temas ei ole päris isikuandmeid.** Kui varjatud funktsioon juba
kogub andmeid, on risk olemas sõltumata nähtavusest. Seega „peidetud" tähendab meil alati:
lipp väljas + 0 päris isikuandmeid + skeem disainitud nii, et õiguslikult tundlik osa on
additiivne (saab hiljem sisse lülitada ilma tagasiulatuva töötluseta). Sünteetiliste
andmetega tohib pime funktsioon elada täisvormis.


**SOTSIAALVALVE võrdlusallikas — Soome sotsiaal- ja kriisiabi (loetud 30.07.2026).**
[Merike Mikk, „Sotsiaalkiirabi või pigem sotsiaal- ja kriisiabi? Soome kogemus",
Sotsiaaltöö 2/2026](https://www.sotsiaalkindlustusamet.ee/sotsiaaltoo-artiklid/sotsiaalkiirabi-voi-pigem-sotsiaal-ja-kriisiabi-soome-kogemus)
kinnitab piirkondliku ühisvalve loogikat, kuid lisab viis nõuet, mida Eesti prototüübis
ei tohi vahele jätta:

1. **Kaks sissepääsu:** avalik kanal inimesele ning eraldi ametnikukanal Häirekeskusele,
   politseile, kiirabile ja teistele partneritele.
2. **Isikuline vastutusjälg:** funktsionaalse laua taga peab iga vaatamine, toiming ja
   edasisuunamine jääma konkreetse töötaja ning kellaajaga logisse.
3. **Vahetuse ja üksuse üleandmine:** öine juhtum peab jõudma hommikul õige piirkondliku
   üksuseni koos tegevuslooga; üleandmine vajab vastuvõtukinnitust.
4. **Väljasõidu ohutus:** väljasõit on inimese juhitud eraldi teenus, mitte platvormi
   automaatne jätk. Soome mudelis minnakse kodukülastusele kahekesi ning rollid politsei,
   pääste, kiirabi ja sotsiaaltöö vahel on ette kokku lepitud ja läbi harjutatud.
5. **Töötaja järelhoid:** rühmasupervisioon, kiire tugi raskete juhtumite järel ja
   ühised kriisiõppused on teenuse osa, mitte vabatahtlik lisand.

Nimetust **„Sotsiaalkiirabi" SotsiaalAI üldise avaliku raja nimena ei kasutata.**
SK-V1 võib jääda sisemiseks funktsiooninimeks, kuid avalikus vaates on vaikimisi
**„Kiireloomuline abipalve"**. Partneri konkreetse teenuse nime võib näidata ainult siis,
kui pöördumine läheb päriselt selle teenuse mehitatud vastuvõttu.

**Eesti rakendustõend — Estkeeri piloot ja Sotsiaalministeeriumi kukkumisjuhtumite
analüüs (loetud 30.07.2026).** Eesti ei alusta nullist. RTK
[13.05.2025 rahastusotsuse](https://adr-docs.karlerss.com/vGptejVOOMwg2gZbWz5xcAjLvs9p9faH/Taotluse%20rahuldamise%20kohta.pdf)
järgi kestab Estkeer OÜ projekt 01.06.2025–31.05.2027, selle abikõlblik maksumus on
625 000 eurot, toetus kuni 500 000 eurot ja väljundsiht 340 teenusesaajat. Esimesel
kolmel teenusekuul ei tulnud kolmest vallast ühtegi väljakutset. See ei tõenda vajaduse
puudumist. [Jaanuari 2026 sõltumatu kajastus](https://peegel.ut.ee/node/1158) ning
[teenuseosutaja tausta avav lugu](https://tervisetasku.ee/artiklid/uudislood/abi-on-olemas-kuid-sotsiaalkiirabi-ei-joua-abivajajateni-miks-kodused-kriisid-jaavad-varju)
toovad välja neli käivitustakistust:

1. **Öisel teenusel oli päevane värav.** Piloodi algses mudelis määras teenusele KOV-i
   sotsiaaltöötaja; see piiras otsest ligipääsu ja nähtavust ajal, mil töötaja ise valves
   ei olnud.
2. **Juhtumid olid teises torus.** Kiirabi ja 112 nägid sotsiaalse sisuga olukordi, kuid
   info ei jõudnud süsteemselt KOV-i ega teenuseosutajani.
3. **Puudus ametkondlik suunamisleping.** Häirekeskusel ei olnud ühtset õiguslikku alust,
   ohuhinnangut, kontakti ega tööprotsessi juhtumi sotsiaalvaldkonna reageerijale
   andmiseks.
4. **Valmisolek ei loonud iseenesest usaldust ega kasutusharjumust.** Inimesed ja
   töötajad olid harjunud ise hakkama saama ning uus teenus polnud veel tuttav.
5. **Ligipääsureegel ja hind ei olnud piirkonniti ühetaolised.** Teenuseosutaja leht
   ütleb, et teenusele määrab KOV-i sotsiaaltöötaja;
   [Tartu valla lehel](https://tartuvald.ee/pere-sotsiaal-ja-tervishoid/eakad-ja-erivajadusega-inimesed/sotsiaalkiirabi)
   on väljakutse ja toimingud tasulised, kuid
   [Kambja 19.02.2026 uuendatud juhis](https://www.kambja.ee/sotsiaalkiirabi) lubab
   inimesel ise helistada ja ütleb, et teenus on tasuta. See võib peegeldada piloodi
   parandamist, kuid sama nimi ei anna inimesele veel üheselt teada, kas tal on õigus
   pöörduda, kelle loal ja mis hinnaga.

TerviseTasku väljaanne märgib ise, et seda toetab Estkeer OÜ; seetõttu on see kasulik
teenuseosutaja vaate, mitte sõltumatu mõjuhinnanguna. Tugevam süsteemitõend on
Sotsiaalministeeriumi [2026. aasta kukkumisjuhtumite analüüs](https://sm.ee/sites/default/files/documents/2026-06/Koduses%20keskkonnas%20toimunud%20kukkumisjuhtumid.pdf):
41% küsitlusele vastanud KOV-idest ei saanud kodustest kukkumisjuhtumitest infot;
takistustena nimetati sobimatud infosüsteemid ja kokkuleppe puudumine. Analüüs eristab
Estkeeri ööpäevaringset hooldusabi, Valga tööajavälist sotsiaalset tuge, Punase Risti
esmaabi ja Tallinna eelnevalt hinnatud inimestele mõeldud sotsiaalvalvet ning hoiatab,
et ühise mudelita tähendab „sotsiaalne kiirabi" eri kohtades eri asja. Juhtumite väike
ja ebaühtlane piirkondlik maht ei toeta eraldi 24/7 üksuse loomist igasse KOV-i.

**Järeldus SotsiaalAI jaoks:** digitaalne esiuks võib lahendada leitavuse, inimese enda
pöördumise, vastutusjälje ja üleandmise, kuid ei loo ise reageerijat. Aktivatsiooniks on
vaja otsest mehitatud saajat koos lugemisajaga, mitte suunamist päevase sotsiaaltöötaja
kaudu; eraldi tuleb kokku leppida ametnikukanal ja Häirekeskuse suunamisõigus. Eelistus
on üks piirkondlik või riiklikult ühetaoline suunamismudel, mitte neljanda reageerija
lisamine eri kontaktiga igasse KOV-i. Piloodi mõõdik ei ole nupu olemasolu, vaid kogu
ahela läbimine: saadetud → loetud → vastu võetud või põhjendatult tagasi lükatud →
vajadusel päevasele üksusele üle antud.

Teenusekaardi kiireloomulise abi kirje vajab seetõttu tavakirjest rangemat
valmiduslepingut: piirkond, avalik nimi, tööaeg, kes tohib pöörduda, kas eelhindamist on
vaja, inimese kulu, otsene kontakt või vastuvõtulaud, lubatud lugemis- või
reageerimisaeg, 112 piir ning `lastVerifiedAt`. Automatiseeritud korje võib muutusi
märgata, kuid kiireloomulise raja avab ainult partneri kinnitatud aktiivne kirje.

**Teadmusbaasi uudiskirjakorje (omanik 28.07).** Ajakirja Sotsiaaltöö uudiskiri (11×/a) on
tasuta KUREERITUD värskusvoog uutest artiklitest, juhenditest ja uuringutest — toimetus teeb
valiku meie eest. Väljaandja alates 2026: SKA + SoM (kolis TAI alt ära). **Õigused: omanik
töötas ise ajakirjas; vastutav toimetaja Regina Lind (endine kolleeg) on andnud loa ajakirja
kasutamiseks andmebaasis** — seepärast ongi artiklid juba RAG-is. Soovitus: küsi Reginalt
lühike KIRJALIK kinnitus uue väljaandja (SKA+SoM) all — mitte usaldamatusest, vaid sest
väljaandja vahetus 2026, platvorm on tasuline ja kirjalik rida kaitseb ka Reginat ennast;
avaliku lehe üldtingimus („õppe- ja koolitustöös") ei kata ärikasutust, sinu luba on erand,
mis väärib paberit. Korjetorustik olemasoleva RAG-infra peal: e-postiarhiiv (vanad numbrid;
avalikul lehel ainult 2026) + leht + tellimus → parser (lingid+pealkirjad+kontekst →
kandidaatide JSON, master_sources mustris) → õigusklass lingi kohta (riigi juhendid =
ametlikud dokumendid, täistekst vaba; ajakiri = luba olemas; uuringud allikapõhiselt;
sündmused ei lähe) → RAG-admini ülevaatusvoog → ingest + checkedAt. Edaspidi ~30 min/kuu
uue numbri peale. Parser = väikese skripti mõõtu, järgmise sessiooni kandidaat.
**Empiiriliselt tõendatud 28.07** (numbrid 1/2026 ja 7/2026 päriselt alla laetud ja parsitud):
webcopy-link on puhas HTML (192–204 KB), JS-i ei vaja; sihtlingid istuvad trck-linkide `url=`
parameetris — **dekodeeri parameeter, ÄRA järgi trck-linki** (jälgimisvaba, ei sõltu smaily
püsimisest); e-postiarhiiv = kindlaim allikas, avalik leht varu. Saak: 1/2026 = 124 sihtlinki
(13 PDF-i, sh perevägivalla juhend, õiguskantsleri seisukoht, IFSW); 7/2026 = 100 sihtlinki
(5 riigi uuringu/juhendi PDF-i, 2 õiguskantsleri, 2 riigikohtu lahendit, 1 eelnõu, 20 SKA/SoM
uudist, 6 ajakirja artiklit → dedupe, 15 koolitust/sündmust → välja). Hinnang: ~10–25
RAG-väärilist kirjet numbri kohta ≈ 150–250 allikat aastas + vanade numbrite järelkorje.
Ingest: HTML otse; PDF laetakse ja parsitakse automaatselt (`pdf-parse` on juba projektis).

**Katmata analüüsid** (enne vastavat ehitust): vestlus-UX + kriisirada · häälvestluse tervik ·
receiver-workbench · kõne elutsükkel ja nõusolek · RAG edasiarendusprogramm · SUP-V1-A0 ·
KOV-V2-A0.

### Multimodaalne juhtimiskiht (omaniku küsimus 28.07: Realtime-mudel + RAG, kaamera, hääl)

Juhtprintsiip: **hääl ja kaamera on liides, mitte teine aju** — iga sisuline vastus käib läbi
sama tekstitorustiku (RAG + allikad + kriisirada + kvoodid), mis kannab platvormi lepingut.

1. **Realtime-kõnemudel + RAG:** töötab tool-calling'uga. Arhitektuurivalik: kaskaad
   (STT → olemasolev torustik → voogav TTS; ~1,5–2,5 s, leping muutmata) → siht on hübriid
   „õhuke hääl, paks server" (realtime-mudel hoiab ainult vooru ja kutsub KOHUSTUSLIKULT
   sisu-tooli; ~1 s tunnetuslikult). Puhas kõne-kõne (mudel vastab ise) EI sobi — vastuseleping
   nõrgeneks. Allikad kuvatakse ekraanil rääkimise ajal. **LiveKit on toodangus olemas** —
   häältorustik ehitada LiveKit Agents mustris, Realtime-mini on vahetatav komponent, mitte
   arhitektuuri omanik.
2. **Hääl „ilma viivituseta" = käskude ja vestluse lahutamine.** OLEMASOLEV komplekt
   (kontrollitud koodist 28.07): STT = OpenAI `gpt-4o-mini-transcribe`
   (`lib/transcription/provider.js`, failipõhine), TTS = Google Cloud `et-EE-Standard-A`
   (+ ru/en; varuks OpenAI `gpt-4o-mini-tts`) — mõlemad kvooditud (`STT_SECONDS`/`TTS_CHARS`)
   ja rate-limititud. **Kõnerežiim EI vaja uusi teenusepakkujaid** — kaks režiimimuudatust:
   (a) STT failist voogavaks (sama OpenAI mudel toetab Realtime-transkriptsiooni liidest;
   või VAD lõikab lausungi ja saadab tervikuna — ~0,5–1,5 s, vestluseks piisav);
   (b) TTS lausekaupa (Google'ile lause haaval = pseudo-vooguv). Käsklused: Silero VAD (WASM)
   + fikseeritud ~20–30 fraasi ruuter; AUS latentsus pilve-STT-ga on ~0,5–1 s, mitte <300 ms —
   osatulemuse esiletõst (kaart süttib enne lause lõppu) päästab tunnetuse; päris-instant
   vajaks kunagi lokaalset mudelit (optimeering, mitte eeldus). Barge-in kohustuslik. Hääl ei
   käivita pöördumatut tegevust kinnituseta.
   **TalTech/EKI = valikulised TULEVIKU-alternatiivid, mitte eeldused** (omanik 28.07: „ma ei
   tea nendest midagi" — õigustatud): TalTechi keeletehnoloogia labor avaldab tasuta eesti
   STT-mudeleid oma serveris jooksutamiseks („voogav" = transkribeerib sõna haaval heli
   saabudes, ~0,1–0,3 s; failipõhine ootab lausungi lõppu; jooksutaja = sherpa-onnx, ka
   brauseris/telefonis, ilma pilveta).
   **Eesti TTS — KAKS ERI ökosüsteemi (parandus 28.07, ära aja segi):**
   (a) **TartuNLP** (Tartu Ülikooli keeletehnoloogia grupp; neurokone.ee on nende avalik
   nägu) — `POST api.tartunlp.ai/text-to-speech/v2` `{text ≤10 000 tm, speaker, speed}` →
   WAV; võtmeta; **12 eesti neuraalset häält + 2 võro**; **MIT-litsents, kood+mudelid
   GitHubis (`TartuNLP/text-to-speech-api`) = ISE-HOSTITAV** — suveräänsuse-rada ilma
   loaküsimiseta. Hostitud API miinused tootmises: SLA puudub + kasutajate vastusetekstid
   läheksid kolmandale osapoolele (GDPR volitatud töötleja küsimus) → tootmisse
   ise-hostituna; viisakuskiri ping@tartunlp.ai (võimalik koostöö). Katsetus: lisa
   `tartunlp` kolmanda pakkujana olemasolevasse TTS-route'i (~50 rida, lipu taga),
   kõrvavõrdlus Google `et-EE-Standard-A` (mitteneuraalne) vastu.
   (b) **EKI** (Eesti Keele Instituut, vanem teenus, `teenus.eki.ee/synthub`) —
   litsentsikonks: arhiivileht lubab „privaatselt mitteärilistel eesmärkidel"; ärikasutuseks
   küsida heli@eki.ee. Eelistus on (a).
   Aktiveerimispäästikud endised: riigipartneri „kus heli töödeldakse?", kasvav pilvearve,
   võrguta välitöö.
   **Kõnerežiimi majandus (omanik 28.07: „hea ja soodne; piirang kasutajal, millegi muu
   arvelt; vastused 10–15 s; kas RAG kannab pikka kõnet; nuppudeta"):** (a) kaskaad on
   struktuurselt odavam ja jookseb OLEMASOLEVATE teenustega — STT = senine OpenAI
   mini-transcribe (voogavas režiimis), mõistmine = olemasolev kvooditud torustik, TTS =
   senine Google/OpenAI lausekaupa; Realtime-mini arveldab helisekundeid mõlemas suunas ja on
   hilisem „tunnetuse-turbo", mitte alus (transport on LiveKitis nagunii); (b) **uut kvooti EI
   looda** — kõne põletab olemasolevaid arvesteid (`STT_SECONDS` + `CHAT_ASSISTANT_REPLY` +
   `TTS_CHARS`), mis ONGI „millegi muu arvelt"; lisada ainult kõne maksimumpikkus (~10 min) +
   päevane häälelimiit; tasandi-värav (kas kõigil tasulistel või 14,99+) = omaniku
   hinnastusotsus; (c) **3 lause leping**: 10–15 s ≈ 2–3 lauset ≈ 150–250 tm; hääl annab tuuma,
   TÄISVASTUS koos allikatega maandub alati tekstina vestlusesse — lahendab korraga UX-i,
   kulu ja allika-lubaduse; (d) RAG kannab pikka kõnet juba täna (vestluslõng + ajalugu);
   lisada otsingu-ruuter pöörde kohta (jätkuküsimus ei käivita otsingut), lausekaupa voogav
   TTS, barge-in = olemasolev aus Stop; (e) **kõnerežiim on eraldi pind nagu telefonikõne**:
   opt-in, lahtine mikrofon, lokaalne VAD teeb vooruvahetuse (~0,7 s vaikus = vooru lõpp),
   elavad subtiitrid + allikakaardid ekraanil, „vaigista" ja „lõpeta" — dikteerimis-mikker
   jääb komposeris eraldi funktsiooniks.
   **Kaks rada, üks mikrofon (omanik 28.07: „ava vestlus" JA „selgitan, AI mõistab ja
   tegutseb"):** ruuter valib raja, mitte kasutaja — sõnastikuvaste (kõrge kindlus) → RADA 1
   kohalik refleks; muu → RADA 2 = LLM kui kavatsuste TÕLK. Rada 1 sõnastik on juba olemas:
   doki sildid (`roomDock.js` = marsruutide semantiline kaart) + käputäis tegusõnu; osaline
   vaste süütab kaardi enne lause lõppu; mitmetähenduslikkus → mõlemad süttivad + „kumba?".
   Rada 2 turvamudel: **AI ei saa kunagi vaba kätt ekraani üle — ta saab sama piiratud
   kavatsuste sõnastiku, mis nooleklahvid**; „AI on mustand" üldistub tegevustele
   (navigeerimine = pöörduv → täidab kohe; loomine/saatmine/kustutamine → AI valmistab ette,
   inimene kinnitab); iga AI-kavatsus logitud ja nähtav. NB rada 2 on tekstina juba toodangus
   („vestlusest saab alustada töövooge") — hääl on sama mustri uus sisend, mitte uus
   filosoofia. Faasid: (1) sõnastik + esiletõst doki peal → (2) LLM-tõlk ainult
   navigeerimiseks → (3) toimingud kinnitusega; kaugsiht = assistent „kätega" (pakub ise:
   „kas avan vormi?" → „jah" = kavatsus).
3. **Kaamera:** MediaPipe käetuvastus brauseris (WASM/WebGPU); **kaader ei lahku kunagi
   seadmest**, välja lähevad ainult semantilised sündmused. Kaamera on alternatiivne sisend,
   mitte nõutav (žestiväsimus + a11y). Sihtkaart on olemas (dokk/jaamad/lennumootor). WebXR
   käetuvastus tuleb hiljem sama kihi peale.
   **Žestikeel v1 (omanik 28.07): vehe = liigu, näpistus = vali.** Karussell on valmis vastuvõtja —
   tal on juba kolm kavatsust (prev/next/select), mida klaviatuur ja näpuvedu kasutavad; kaamera
   on ainult uus adapter. Disainireeglid, milleta žesti-UI kukub: (a) **tagasitõmbe lõks** —
   vehe = randme KIIRUS üle läve + suunalukk + ~500 ms puhkeaeg (muidu loeb käe tagasitulek
   vastassuuna vehkeks); üks vehe = üks samm; (b) **peegeltelg** — kaamera on peegelpilt,
   x-telg peegeldada, muidu juhtimine tundub tagurpidi; (c) **näpistus avab lahtilaskmisel**
   (nagu klõps mouseup'il) → kogemata näpistuse saab tühistada kätt kõrvale liigutades;
   näpistuskaugus normaliseeritud käe suurusega + hüsterees; vehke ajal näpistust ei loeta;
   (d) **kohaloleku indikaator** („näen su kätt") + selge opt-in lüliti (ülaserva juhtpaneel) +
   auto-off. Sama kahe žesti grammatika skaleerub jaamalendudele (vehe = järgmine jaam) ja
   VR-i — see on platvormi žestikeel, mitte karusselli funktsioon.
4. **Ehita üks kord: KAVATSUSTE SIIN (intent bus)** — hiir, klaviatuur, häälkäsk ja näpistus
   emiteerivad samu kavatsusi (`open_panel:x`, `select:next`, `confirm`, `dismiss`); UI kuulab
   ainult kavatsusi. Iga uus sisend on edaspidi adapter, mitte projekt; ligipääsetavus muutub
   arhitektuuriks (kõik juhitav ka klaviatuuri/lülitiga); testitav ilma mikrofoni ja kaamerata.

**Omaniku 6 soovi (28.07) = üks torn kuue korrusega, ehitusjärjekord** (kõik lipu taga;
uusi teenusepakkujaid null; kulu käib olemasolevate arvestite kaudu):
V1 STT+TTS nupuga = **JUBA VALMIS** (mikker + ettelugemine) →
(1) **kavatsuste siin** (vundament, 0 kulu, teenib ka klaviatuuri/a11y) →
(2) **V2 käed-vabad dikteerimine**: Silero VAD brauseris (kõne algus avab, ~0,7 s vaikus
saadab, vastus loetakse ette) — sama tariif mis V1 →
(3) **H1 häälnavigatsioon**: sama mikrofonisilmus + käsuruuter (doki sildid = sõnastik) +
kaardi süttimine osatulemusel →
(4) **V3 kõne-pind**: voogav STT (sama OpenAI mudel, uus ühendusviis) + lausekaupa TTS +
barge-in + elavad subtiitrid + allikad; kaitseriivid (max kõne ~10 min, päevalimiit) →
(5) **V4+H2 assistent „kätega"**: tool-calling kavatsuste sõnastiku peal; navigeerib vabalt,
muudab ainult kinnitusega; platvorm küsib täpsustusi häälega („kumba mustandit?"); LLM-tõlk =
mini-mudel, sent-murdosad käsu kohta →
(paralleelselt, sõltumatu) **TartuNLP TTS kolmanda pakkujana** lipu taha, kõrvavõrdlus, võidu
korral ise-hostituna tootmisse. Kolm suurimat kuluhooba on disainiotsused: 3 lause leping,
otsingu-ruuter (jätkuküsimus ei käivita RAG-i), barge-in (poolelijäänud vastust ei genereerita
lõpuni). Realtime-mini jääb V3 valikuliseks „tunnetuse-turboks". Lisaks: WER-mõõtmine eesti
keeles enne mudelivahetusi; näpistus-prototüüp kavatsuste siini peal pärast sammu 3.

### Järjestusloogika (kuidas „kõik lõpuni" ellu jääb)

Jadatöö reegel jääb: korraga kirjutab koodi üks teema. Järjekorra annavad kolm kella:

1. **Piloodi kell** — kõik, mis on piloodi eeldus (TK-P0, RC, lubaduste audit), enne kõike.
2. **Riigi kell** — seadusega dateeritud aknad (teejuhid 1.07.2027; AI Act 02.08.2026;
   STAR2 liidesed strateegia tempos) — nende ettevalmistus algab varem, sest tähtaeg ei
   nihku meie järgi.
3. **Partneri kell** — ESTA/KOV/superviisorid avavad terved plokid (mentorlus, foorum,
   baromeeter) ilma meie koodita; partneritöö käib kooditööga PARALLEELSELT, sest ta ei
   kuluta sama ressurssi.

Kõik muu — sahtel B ja C — säilib registris koos ärkamise tingimusega. Mitte miski ei kao;
kõik teab, mille taga ta ootab.

### Mida me ka tulevikus EI ehita

Automaatne triaaž ja riskiskoorimine inimeste üle · tööandja individuaalvaade · „jaga kogu
Teekond" nupp · vaidlustusmenetluse esindamine · ametlik register mis tahes kujul · engagement-
optimeerimine (vt 5.7).

---

## 5. Strateegiad

### 5.1. Sisenemine: kitsas kiil, mitte lai rinne

Üks täisrada (eelpöördumine) ühe partneriga lõpuni ja mõõdetult — alles siis järgmine.
Laienemise järjekord käib mööda **külgnevusi**: sama partner + uus voog (CASEWORK), sama voog
+ uus partner (2. KOV), sama kest + uus roll (tervise teejuht). Mitte kunagi „kõigile kõike
korraga" — visioon on asutuse mõõtu, aga ehitaja on üks, ja see nõuab halastamatut järjekorda.

### 5.2. Partnerlus: neljast sõltumatust jalast koosnev usaldus

- **ESTA** — erialane kvaliteet ja tõlgendus (rollijaotus on valmis kirjutatud; privaat-
  andmetele ligipääsu ei saa nad kunagi — see on usaldusargument, mitte piirang);
- **KOV-id** — piloot ja igapäevane väärtus;
- **SoM/SKA** — õigusselgus, liidesed, rahastusprogrammid; mitte lubade küsimine, vaid
  selgitustaotluste ja töötavate näidete keel;
- **EPIK ja kogemusorganisatsioonid** — inimese poole valvurid; nende kriitika TERVIK-ile
  kattub meie printsiipidega, mis teeb neist loomuliku liitlase. Kaugem siht: platvormi
  **privaatsusnõukoda** (ESTA + EPIK + kogemuseksperdid), mis annab väikesele ettevõttele
  institutsionaalse usalduse ilma agiilsust kaotamata.

### 5.3. Rahastus: kaks jalga + avalik raha kolmandaks

Tellimused (rollipõhine kuutasu — töötab juba) + tulevikus KOV-/asutuselitsents (piloot loob
hinnastusaluse) + projektiraha (innovatsiooniprogramm 437, ESF+ TAT-id, Šveitsi programm).
Reegel: avalik raha ehitab ÜHISHÜVE kihte (baromeeter, puudujäägikoond, ligipääsetavus,
liidesed), tellimusraha ehitab toodet. Nii ei teki sõltuvust, kus projektiraha lõpp tapab
põhiteenuse.

**Maksja-strateegia (arutatud 28.07).** Lähtepinge: tänane maksja on vale inimene — abivajaja
on väikseima maksevõimega klient (kvaliteedijuhis nõuab taskukohasust) ja spetsialist, kes
maksab ise oma töövahendi eest, on anomaalia (= sügiskooli E3). **Sihtpilt: pöörduja rada
muutub järk-järgult sponsoreerituks/tasuta; tulu tuleb professionaalidelt, asutustelt ja
avalikust rahast** — astmeliselt, praegust tulu ei tapeta enne asendust. Kuus mudelit
järjekorras: (1) isiklik tellimus (töötab; recurring tehniliselt valmis, serveris väljas);
(2) **asutuselitsents** — KOV/organisatsioon töötajate eest; aastahind alla lihthanke piiri,
et KOV saaks osta ilma hankemenetluseta; org-kiht T25 on koodina valmis; (3) **sponsoreeritud
pöörduja** — olemasolev sponsorkutse ON selle seeme; üldistus „KOV sponsoreerib N pöördujat";
müügilause: *teie elanikud saavad tasuta ettevalmistuse, teie töötajad parema eelinfo*;
(4) **ESTA liikmehüve** (ideed ptk 26 „1€ mudel" = valmis läbirääkimispositsioon);
(5) avalik projektiraha (ainult ühishüve kihid); (6) **supervisiooni vahendustasu**
(turuplatsi-komisjon tasuliselt professionaalselt teenuselt; mentorlusele EI sobi).
(+7) **Tervise teejuhid / TERVIK-ud alates 1.07.2027** — ravikindlustuse rahaga ostjaklass,
kuupäev ja eelarve seadusega küljes. Kolm hinnastuspõhimõtet: **ära allahindle kunagi otse**
(soodustus käib ainult partneri kaudu — ESTA hüve, asutuselitsents); **piloot on tasuta, aga
arvega** (lepingus nähtav tegelik väärtus + teise aasta hind — tasuta ilma ankruta muutub
igaveseks ootuseks); **andmed ei ole kunagi tuluallikas** (kuulub avalikule lubaduste
lehele). Enne sügiskooli valmis: **asutuselitsentsi hinnakirja A4 mustand** — kui KOV-juht
kuluaaris küsib „mis see maksaks?", läheb paber lauale.

**Täpsustus „pöörduja ei maksa?" (omaniku küsimus 28.07):** sihtpildis ei maksa
KASUTUSHETKEL — aga keegi maksab alati (KOV/sponsor/asutus/avalik raha; Lasteabi loogika:
helistaja ei maksa, riik maksab). Neli argumenti pöörduja-maksemüüri vastu: vale hetk
(kriisis ei sisestata kaardinumbrit — iga kanal lekib maksemüüri taha), vale rütm
(pöörduja vajadus on EPISOODILINE — kuutellimus on vale kuju), vale sõnum („abi algab
selgusest — 7,99 €/kuus" õõnestab tuumlauset; kvaliteedijuhis nõuab taskukohasust), väike
raha (100 maksvat pöördujat = 799 €/kuus; 5 asutuselitsentsi annab sama JA avab pöördujad).
Kaks vahekuju kaalumiseks: **freemium olemasoleva kvoodisüsteemiga** (baasrada tasuta,
AI-mahukas kvoodi taga — tehniliselt juba olemas, ainult tasuta paketi piirid nihutada) ja
**episoodipass** kuutasu asemel (nt ühekordne 30 päeva — vastab vajaduskujule). Isikliku
maksmise VÕIMALUS jääb erandina alles (autonoomia/privaatsus: mõni ei soovi KOV-i
sponsorlust; plaanivad, mitte-kriisis kasutajad). Üleminek astmeline: TÄNA ei muudeta
midagi (registreerimine kinni, piloot nagunii tasuta); otsus aktualiseerub avaliku
käivituse hetkel („avamise käigu" sessioon); 7,99 jääb hinnakirja — tema roll muutub
pöörduja seinast SPONSORI hinnaks (sponsorkutse juba kasutab seda).
**Valitud mehhanism (omanik 28.07): checkout'is KAKS valikut — „üks kuu, ei pikene ise"
VÕI püsimakse.** Tehniline seis: mõlemad rajad olemas — ühe kuu makse = tänane
live-käitumine (recurring globaalselt väljas, `validUntil`), püsimakse masinavärk täielik
(`lib/payments/recurring.js`: tokenid/mandaadid/retry'd; Subscription: `nextBilling`,
`cancelAtPeriodEnd`, `billingMethodId`) ja magab env-lüliti taga → töö = globaalne lüliti
kasutaja valikuks + UI 2 kaarti + valik tellimuse külge. Disain: vaikimisi pöördujal ühe
kuu (usalduslause „ei pikene ise"), spetsialistil/osutajal püsimakse; SAMA hind mõlemal;
recurring-nõusoleku linnuke (tekstid `checkout.recurring_*` olemas); ÜKS leebe
meeldetuletus enne lõppu (payment-emails worker olemas, unit'id inaktiivsed);
sponsoreeritud kuu lõpp → sama valikuekraan. Ainus päris värav: serveris
`PAYMENT_TOKEN_ENC_KEY` + `SUBSCRIPTION_RECURRING_ENABLED=1` + **päris Maksekeskuse
recurring-makse E2E test (NOT_PROVEN)**. Kuulub „avamise käigu" sessiooni skoopi koos
ootejärjekorraga.
**Sponsorluse diilikujud (omaniku küsimus 28.07: „1 kuu teise raha eest, edasi ise?"):**
see diil ON olemas (sponsorkutse = 1 kuu → „aktiveeri oma") ja JÄÄB üksikjuhtumi
mehhanismiks — aga põhidiiliks ei sobi, sest **menetlus kestab kauem kui kuu** (4–10
nädalat; maksesein keset protsessi murrab lubaduse kõige haavatavamal hetkel). Põhidiilid:
(a) **KOV menetlusepõhine** — inimene kaetud, KUNI pöördumine lahendatud; (b) **KOV
piirkonnalitsents** — asutuselitsents SISALDAB elanike juurdepääsu (hinnakirja-A4 teine
rida); (c) riik/projektiraha piirkonna kaupa; (d) üksiksponsor (olemas); (e) hiljem
MTÜ/fond sihtgrupile ja tööandja EAP-loogikas. Redel pärast sponsorlust: KOV pikendab
(menetlusepõhises automaatne) VÕI inimene jätkab ise (üks kuu korraga) VÕI baasrada.
**KÕVA REEGEL: oma andmetele ligipääs ei aegu KUNAGI** — tellimuse lõpp sulgeb AI-lisad,
aga Teekonna lugemine, Minu jagamised, eksport ja kriisikontaktid jäävad alati
(GDPR + usaldus); ÜLE KONTROLLIDA, kas aegunud tellimusega konto saab täna oma Teekonda
lugeda. Kokkulepete tekkimise viis: valideerimisküsimus KOV-juhile („kas selle eest maksab
KOV või inimene ise?" — keegi ei vasta avalikult „inimene ise") + piloot kui esimene diil
(tasuta aasta arvega, 2. aasta hind lepingus nähtaval).
**Väärtusargument maksjale (omaniku küsimus 28.07: „miks üldse keegi peaks maksma
abivajaja eest?") — kolm kihti:** (1) **inimene tuleb KOV-i lauale NAGUNII** (SHS § 15
kohustus) — küsimus on ainult, kui kallilt: ettevalmistamata pöördumine = 2–4 h töötaja
aega rohkem juhtumi kohta; töötaja tund ~15–25 € → kuu hind 7,99 teenib end tagasi ÜHE
säästetud tunniga, ja tööjõupuuduses pole töötaja aeg lihtsalt kallis, teda pole OLEMAS —
KOV ostab oma defitsiitseima ressursi tagasi; (2) **hilinenud abi on eksponentsiaalselt
kallim** (üldhoolduskoht ~2000 €/kuus, asendushooldus rohkem) — ÜKS ära hoitud kriis /
kuu võrra edasi lükatud paigutus katab piirkonna pöördujate aasta; „elukaareülene ennetus"
on heaolu arengukava ENDA esimene põhimõte; (3) **abivajaja ei maksa sotsiaalvaldkonnas
peaaegu kunagi ise — see ON valdkonna rahastusmudel** (Lasteabi, ohvriabi, perearst):
ühishüve loogika on ammu otsustatud, veider mudel oleks vastupidine; kvaliteedijuhis teeb
kohustuseks („inimest aidatakse sobiva teenuse leidmisel"). AUS LISA: täna on see
hüpotees — piloodi mõõdikud (aeg selguseni, ettevalmistatud pöördumiste osakaal,
kontaktide arv juhtumi kohta) muudavad ta arvet kandvaks faktiks. Hinnakirja-lause:
*„KOV ei maksa abivajaja äpi eest — KOV maksab selle eest, et tema seadusjärgne töö
algaks selgusest, mitte segadusest: iga ettevalmistatud pöördumine on tagasi ostetud
töötunnid ja iga varakult leitud uks on ära hoitud kriisi hind."*

### 5.4. Regulatiivne positsioon: piir kui kaitsekraav

AI-määruse kõrge riski klass (III lisa 5(a)) algab sealt, kus AI hindab õigust toetustele või
teenustele. Meie **dokumenteerime end teadlikult piirist ettevalmistuse poolele** ja hoiame
selle tõendatavana (mustand-kuni-kinnituseni on ka logides nähtav). Kaks käiku:

1. **Vastavusdokument avalikuks** — „kus SotsiaalAI AI-määruse kaardil asub ja miks" — enne,
   kui keegi küsima peab. Esimene omataoline valdkonnas = referentspositsioon.
2. **Standardimäng:** kui riik hakkab defineerima „muu keskkonna" liitumist (STAR-i
   strateegia lubab), peab laual olema valmis spetsifikatsioon. Kes kirjutab esimese
   ettevalmistuskihi-liidese mustandi, selle vorming saab aluspõhjaks. See on väikese tegija
   suurim võimendus: mitte võita hankeid, vaid **defineerida vorming**.

### 5.5. Usaldus kui kaubamärk: radikaalne läbipaistvus

- Avalik **lubaduste leht**: kolm EI-d + privaatsusinvariandid + „mitte ehitada" nimekiri —
  kontrollitavas, mitte turunduskeeles.
- **Sõltumatu audit** enne avalikku käivitust ja selle kokkuvõte avalikuks.
- Iga intsident (kui tuleb) — avalik post-mortem. Usalduskihi ettevõte ei saa endale lubada
  vaikimist; ta saab endale lubada vigu, kui ta neist ausalt räägib.

### 5.6. Tehnoloogia: mudel-agnostilisus ja suveräänsus

AI-mudelid on vahetatav osa; usaldusarhitektuur, päritolumärgistus ja töövood on püsiv osa.
Liikumine kolmes astmes: pilve-mudelid (praegu) → EL-i residentsus → lokaalsed/oma mudelid
seal, kus tundlikkus nõuab (kõne, PII-tuvastus). Andmed on Eestis ja jäävad; see lause peab
alati tõene olema.

### 5.7. Pöördujani jõudmine (omaniku küsimus 28.07: „kuidas ma jõuan eluküsimusega pöördujateni?")

Põhimõte: **pöörduja ei ole sihtrühm, vaid inimene hetkes** — temani jõutakse (a) olles
kohal hetkel, mil eluküsimus tekib, ja (b) tulles läbi inimese/asutuse, keda ta juba
usaldab. Reklaam ei tee kumbagi. Kanalid prioriteedis: (1) **KOV ise** — piloot ONGI
pöördujakanali proov (partner kutsub oma pöördujad oma kanalites); (2) **spetsialisti
soovitus** — sponsorkutse mehhanism on olemas; vaja „enne kohtumist" kaarti töötajale;
(3) **avalik selge keele Q&A** (SEO) — Google on koht, kus eluküsimus esimesena väljendub;
teadmusbaas + selge keel = vastusemootor, staatilised toimetatud lehed (omanik ON
toimetaja), iga leht lõpeb kahe uksega (mõtle läbi → platvorm / räägi inimesega →
teenusekaart); (4) **vene keel** — 3-keelne platvorm + venekeelse selge sotsiaalinfo
peaaegu-null-konkurents; (5) **kogemusorganisatsioonid** (EPIK, omastehooldajad,
pereliidud) — usalduse kandjad; kogemusekspertide ring (5–8) = validatsioon + esimene
partnerlus; (6) perearstid (TERVIK-i märkamisleht teeb 2027 ametlikuks); (7) raamatukogud
(alahinnatud üleriigiline „digiabi" võrk); (8) meedia inimlood pärast pilooti; (+ FB
kogukonnagrupid — ausalt vastates, mitte müües). **Kolm eeltingimust, ilma milleta kanalid
lekivad:** pöörduja rada kasutushetkel TASUTA (7,99 sein tapab konversiooni — maksja-
strateegia sihtpilt juba osutab sinna); kontota esimene väärtus (Q&A + teenusekaart +
kriisikontaktid; konto alles järjepidevuseks); **ootejärjekord kohe** (septembri lavad
toovad sadu spetsialiste, igaüks teab kümmet pöördujat — ilma „jäta e-post" leheta aurab
see õhku). Faasid: 0 (august) = ootejärjekord + ~10 Q&A lehte + kogemusekspertide ring;
1 (piloot) = KOV kutsub, õpime sõnumit; 2 (avalik) = sisu-mootor + soovituspakett +
MTÜ-d + vene rada. Mõõdupuu (anti-engagement ka siin): iga kanali juures küsi „kas ta toob
inimese hetkel, mil tal on PÄRIS küsimus?" — kui ei, jäta ära.

### 5.8. Teenuseosutaja-lugu (omaniku küsimus 28.07)

Aus lähteseis: kolmnurga alahinnatum tipp — kõrgeim hind (19,99), õhim lugu (kataloog +
postkast). **Kaks eri klienti:** väike osutaja (tugiisik/FIE/väike koduteenus — IT null,
platvorm = KOGU tema digitaristu) vs suur osutaja (hooldekodu/lepingutega MTÜ — raha on,
valu = töötajate voolavus, aruandlus, kvaliteedinõuded). ORG-analüüsi vana leid saab uue
kaalu: `SERVICE_PROVIDER_ORG` on AINUS juht, kus org-kihi vajadus on olemas juba täna
(profiil on 1:1 inimesega, osutaja on organisatsioon; 19,99 on inimese, mitte asutuse
hind). **Riik ehitab nõudlust:** (1) STAR-i strateegia lubab liidestada osutajate
süsteemidega — aga väikesel pole süsteemi, mida liidestada (sügiskooli F3) → SotsiaalAI =
**väikeste osutajate digikodu, mis STAR-iga liidestub** (liides üks kord, sajad väikesed
saavad ukse); (2) kvaliteedijuhis kohustab 2018-st kõiki osutajaid, aga tööriista pole →
„kvaliteedijuhis kui teenus" (enesehindamise checklist, tagasisidevoog) = ühtlasi vastus
teenusekaardi lahtisele USALDUSMÄRGISTUSE otsusele (märgis = täidetud kvaliteedinõuete
peegel; hangetel raha väärt); (3) TERVIK teeb osutajad kohustuslikeks
koostööpartneriteks. **Väärtuslugu:** nähtavus→klientide vool; ettevalmistatud
pöördumine→ajasääst; töötajate tugi→VOOLAVUS ALLA (suure osutaja kalleim valu; tööheaolu/
kovisioon/välitöö = personalihoidmise taristu); homme STAR-aruandlus ühest kohast. **Aus
seis:** V3 liit-ID viga (INTERNAL-pöördumine teeninduskohaga osutajale KATKI) + V5 lüli +
detailleht/usaldusmärgistus tegemata + org-kiht ehitamata. **Järjekord:** faas 2 pärast
KOV-pilooti (KOV-id on osutaja usalduse allikas) — AGA varem: V3/V5 parandus (katkine
põhivoog) + org-kihi aktiveerimisvalmidus (esimene mitme töötajaga osutaja on tõenäoliselt
esimene org-klient üldse, enne ühtegi KOV-i). Heaolutalgutel on osutaja hääl juba kohal
(Südamekodu juht, teenuseosutaja praktik-teoreetik). Lause: *„Väikesele osutajale müüd
digikodu, mida tal endal kunagi ei tekiks; suurele müüd töötajate püsimist — tema suurim
kulu ei ole tarkvara, vaid iga lahkuv inimene."*

**Omaniku suunaotsus (28.07): teenuseosutaja tähtsust platvormil SUURENDATAKSE ja talle
pakutakse rohkem.** Konkreetne pakett kolmes astmes: **enne kõike V3/V5 parandus** (austus
enne lubadusi — põhivoog tööle); **aste 1 „vitriin ja väärikus"** (avalik detailleht =
jagatav „koduleht", mida paljudel väikestel pole; usaldusmärgistus kvaliteedijuhise
enesehindamisena; org-kihi aktiveerimine SERVICE_PROVIDER_ORG-ile; asutuselitsentsi rida
hinnakirja — 19,99 jääb üksiktegija hinnaks); **aste 2 „töökorraldus"** (tagasisidevoog —
kvaliteedijuhis NÕUAB, tööriista pole; töötajate tugi paketina osutaja töötajatele =
voolavuse-argument; **ARUANDLUS = astme 2 põhisisu — kontrollitud 28.07: kohtumise
kokkuvõte on osutajale JUBA hästi arendatud** [`MEETING_SUMMARY_SHARE_ROLES` sisaldab
SERVICE_PROVIDER-it; täisahel mustand → U10 „sain aru/parandus" → kinnitusring →
kustutust üle elav privaatkoopia], **aga aruandlus PUUDUB päriselt**: `REPORT_DRAFT` on
tekstimustand, mitte andmearuanne; puudub ka eeldus = TEENUSKIRJE. Disainisuund:
FieldVisit on teenuskirje prototüüp (omanik, eesmärk, saabumis-/lahkumiskinnitus =
kestus, märkmed) → üldista kergeks teenussündmuste logiks (osutaja OMA töökiht,
owner-scoped — MITTE vari-STAR, ametlik arveldus jääb riigile) → perioodi väljavõte
CSV/PDF KOV-ile (+ REPORT_DRAFT mähib andmed kuuaruande mustandiks, inimene kinnitab) →
STAR-liidese avanedes „ekspordi" → „edasta". Topeltkontroll 28.07 (omanik arvas, et aruandlus on olemas — mõistetav segadus:
`REPORT_DRAFT` nimi vihjab, kokkuvõtted olemas, admin-analüütika olemas):
`ServiceProviderService` = KATALOOGIKIRJE (nimi/sihtrühmad/piirkonnad), mitte osutamise
logi; pöördumiste loend = sissetulevad soovid, mitte osutatud teenused; /voimalused EI
luba osutajale aruandlust → avalikku usaldusvõlga pole. **MVP maht on VÄIKE (1–2
tööpäeva):** teenuskirje mudel (teenus kataloogist + kuupäev + kestus + klient + märge,
owner-scoped) + sisestus + kuufilter + CSV — kataloog annab rippmenüü, FieldVisit annab
kestuse-mustri; hiljem REPORT_DRAFT mähib numbrid kuuaruande tekstiks. Ehita lipu taha
KOHE (universaalväljad — tund on tund igas KOV-is), septembris valideeri ainult EKSPORDI
vorming: Südamekodu juhilt/Keiu Talvelt 2–3 PÄRIS aruandevormi = ekspordi
spetsifikatsioon. Eeldus: puhas tööpuu (commit enne — skeemimuudatus); **aste 3 „digikodu"** (STAR-liides +
TERVIK-tööriistad, riigi tempos). **KOLM KAITSEPIIRET** (koht, kus rollide huvid võivad
esimest korda põrkuda): järjestus kaardil EI ole ostetav (mitte kunagi promoted listings);
usaldusmärgis EI ole müügiartikkel (ainult läbipaistvad kriteeriumid); pöörduja
andmed/kontaktid EI ole kunagi osutaja „lead'id" (sobitus jääb inimese algatatud ja
nõusolekupõhiseks). Järjekord: KOV-piloot jääb esimeseks; kohe ilma fookust hajutamata =
V3/V5 + hinnakirja rida + septembris osutaja-häälte valideerimine (heaolutalgutel
Südamekodu juht + teenuseosutaja praktik-teoreetik — küsi NEILT, mis astmest kõige rohkem
korda läheb).

### 5.9. Edu mõõdik: anti-engagement

Meie edu EI ole ekraaniaeg. Sotsiaalvaldkonnas on õnnestumise definitsioon pöördvõrdeline:
**inimene vajab meid vähem**. Mõõdame: aeg selguseni (pöörduja); ettevalmistusaeg kohtumise
kohta (töötaja); õigesse kanalisse jõudnud pöördumiste osakaal; taastumisrütmi püsivus
(töötaja enda jaoks, mitte kellelegi raporteerituna); dubleeriva sisestuse kadu. Kui kunagi
tekib kiusatus optimeerida „kasutajate naasmist", on see punane lipp, mitte KPI.

Teoreetiline selgroog valdkonna ENDA diskursusest (Harrikari, Sotsiaaltöö solidaarsuse
erinumber 1/2026): kolmanda modernsuse kriitika ütleb, et algoritmid ja tähelepanumajandus
toodavad „klikksolidaarsust" — emotsioon ja nähtavus asendavad püsiva pühendumise — ning
Rosa „resonantsi kriisis" muutub maailm hääletuks: inimesed ühendavad end, aga keegi ei
kuula. Anti-engagement mõõdik on sellesama kriitika TOOTETASANDI vastus: meie AI ei võistle
tähelepanu pärast, vaid vabastab aega kuulamiseks. See tähendab, et valdkonna
AI-skeptilisusega ei pea vaidlema — saame sellega ühineda ja näidata, et ehitame just seda
erandit, mida kriitika ise nõuab. Kasutuskohad: ESTA/akadeemilised vestlused, positsioonileht,
AI-koolituse eetikamoodul.

Soome sotsiaal- ja kriisiabi praktikakirjeldus annab sellele empiirilise kontrolli:
inimesed helistavad valvesotsiaaltöötajale muu hulgas seetõttu, et automaatvastajate ja
chat-vestluste kõrval tuntakse, et keegi ei kuula. Tootereegel: AI vastab infoküsimusele,
aitab mure sõnastada ja vähendab kordamist, kuid inimese soov päris töötajaga ühendust
saada ei ole tõrge ega „madal engagement". Edu mõõdik on sel juhul aus ja võimalikult
lühike üleandmine inimesele koos lubatud lugemisajaga.

### 5.10. Kaks paneeliankrut (TLÜ „Sotsiaaltöö 2050" paneel, transkript loetud 29.07.2026)

**1. „Kahe kiirusega sotsiaaltöö" hoiatus (Anu Toots).** Tootsi lennujaama-paralleel:
odava piletiga reisija kohtub masinatega, business-klass saab inimteenindaja — ja sama
klassivahe võib tekkida sotsiaaltöös: vaestele „masin-sotsiaaltöö" (andurid, algoritmid,
monitooring), jõukatele päris inimene kui luksusteenus. See on meie positsioneeringu
kõige täpsem VASTAND: meie AI ei ole odav asendus vähem maksvale inimesele, vaid selguse
kiht, mis vabastab inimaega — ja anti-engagement mõõdik (5.9) on selle kaitse. Kui AI-kiht
hakkab kunagi asendama inimkontakti seal, kus inimest on vaja, oleme Tootsi düstoopia
teenistuses. Positsioonilehele üks lause: „tehnoloogia vaestele, inimesed rikastele" on
läbikukkumise definitsioon, mitte tõhusus.

**2. RAKE pretsedent = AI-piiri empiiriline selgroog (Lauri Leppik).** SoM tellis
paneeli meenutuse järgi ~2021–22 analüüsi: „kasutage kõiki riigi registriandmeid ja
kirjeldage algoritm, mis ennustab, kes hakkab 75-aastaselt abi vajama." TLÜ pidas
ülesannet lahendamatuks ega esitanud pakkumist; hanke võitnud TÜ RAKE järeldas lõpuks
SAMA — ülesannet ei saa lahendada (Leppiku paralleel: kõik autod sõidavad, kuni katki
lähevad, aga millal täpselt, ei tea keegi); lisaks leidis töö seadusandlikud tõkked
andmete ühendamisel. Tähendus meile: meie „ei ennusta abivajadust, ei triaaži, ei skoori"
EI OLE ainult eetiline valik — see on riigi enda tellitud analüüsiga empiiriliselt
põhjendatud piir. Kasutuskohad: positsioonileht, AI Act vastavusdokument, TERVIK § 136
lavaküsimus (T5). NB: lugu on paneeli suuline meenutus — enne avalikku tsiteerimist otsi
RAKE raport üles ja kontrolli aasta ning täpne järeldus.

### 5.11. Mõjuettevõtluse ökosüsteem: identiteet, uksed ja piirid

Allikas: TLÜ „Arenguvajaduste kaardistus" (Praakli, Kübar, Lepik K-L, 2025; Šveitsi-Eesti
koostööprogrammi „Sotsiaalse kaasatuse toetamine" / KÜSK-i tellimus; loetud 29.07.2026).
NB valimid on väikesed (37 vabaühendust/mõjuettevõtet, 17 konsultanti, 12 KOV-i) —
protsendid on suunanäitajad, mitte esinduslik statistika.

**1. Identiteedi-uks: SotsiaalAI ON mõjuettevõte.** Kaardistuse definitsioonide järgi
(ettevõte, mille põhieesmärk on ühiskondlik mõju; tegutseb sotsiaalhoolekandes; tulu
teenib eesmärki) kuulume sinna kategooriasse täpselt — aga me pole end kunagi selle
ökosüsteemi osaks deklareerinud. See on tasuta positsioneerimiskiht: „sotsiaalne
ettevõte" on keel, mida KÜSK, SEV (Sotsiaalsete Ettevõtete Võrgustik), maakondlikud
arenduskeskused ja rahastajad kõnelevad. Kaardistus ise märgib, et paljud organisatsioonid
„ei taju vajadust end sotsiaalse ettevõttena identifitseerida ega näe sellest kasu" — meie
näeme: võrgustik, nähtavus, rahastuskõlblikkus, ja Baltikumi mõju-startup'ide 800% kasvu
narratiiv, mille osaks saab olla.

**2. Rahastuse-uksed (kolm, erineva küpsusega):**
- **Šveitsi-Eesti programm 2024–2028, ~23 M€ sotsiaalse kaasatuse peale** — sihib
  sõnaselgelt „eri keele- ja kultuuritaustaga inimeste" osalusvõimalusi + sotsiaal-
  hoolekande teenuste kättesaadavust ja kvaliteeti. See on meie VENE RAJA ja ukraina
  keele sahtli-idee (C-tabel) loomulik rahastusallikas — keelekiht ei ole meie
  äriplaanis prioriteet, aga kui riik/Šveits selle kinni maksab, tõuseb ta järjekorras.
- **KÜSK-i sotsiaalse innovatsiooni tugi** — sellest kaardistusest kasvab
  nõustamis- ja koolitusprogramm (ESIA projekt 2024–2027, sotsiaalse innovatsiooni
  kompetentsikeskus). Meie roll seal on SAAJA, mitte andja: tasuta/subsideeritud
  nõustamine, mentorlus, võrgustik — täpselt need asjad, mida üksikehitaja bus-factori
  vastu vajab (riskitabel rida 1). Jälgi KÜSK-i voore.
- **Aus piirang samast kaardistusest:** konsultandi tsitaat „Eestis ei ole ühtegi
  rahastusmeedet, mis oleks mõeldud just sotsiaalsetele ettevõtetele" + MTÜ-d ei
  kvalifitseeru starditoetusele. Ökosüsteem on toetav, aga raha-instrumenti EI OLE —
  ära ehita äriplaani sellele, et „sotsiaalse ettevõtte raha" kuskilt tuleb.

**3. Turu-tõestus: mõju mõõtmine on kõigi kolme sihtrühma NÕRGIM pädevus.** KOV-idest
hindas 91,7% oma mõju mõõtmise ja raporteerimise pädevust „rahuldavaks" või madalamaks
(nõrgim kõigist!), vabaühendustest 70,3%; osa KOV-e tunnistab otse „ei mõõdeta
mõju/mõõdetakse väga minimaalselt". Samal ajal on „praktilised tööriistad ja juhendid"
KOV-ide suurim motivaator (91,7%). Tähendus meile: **Teenuspäeviku mall C (sisuaruanne
kliendi lugudega) + kvaliteedirütmid + E8 aruandlusaja mõõtmine ON mõju mõõtmise
infrastruktuur** — sama aatom, mis toidab KOV-i kuuaruannet, on organisatsiooni
mõjunarratiiv rahastajale. Kaardistuse keel („mõjunarratiiv", „muutuste teooria",
„mõju visualiseerimine") tasub Teenuspäeviku müügimaterjalis üle võtta — me ei ehita
midagi juurde, me nimetame olemasoleva õigesse keelde.

**4. Väiksemad resonantsid (märgi, ära ehita):** vabaühenduste katmata teemade loendis
on sõna-sõnalt „tööstressi ja läbipõlemise temaatika" (→ tööheaolu tööriistad 11 tk LIVE)
ja „digioskused/tehnoloogialahendused, ka tehisintellekti kasutamine" (32,4% tahab
arendada → AI-koolituspakett töötab ka vabaühenduste segmendis, mitte ainult ESTA-s);
konsultandid ise soovivad „kovisiooni või mastermindide vormis tuge" (→ kovisioonilõuend
on sama muster teises sihtrühmas — KAUGE sahtel). Eelistatud formaadid (moodulipõhisus,
hübriid, Eesti-põhised juhtumid, õppekülastused, mikrokraadid/koolitusampsud) kinnitavad
meie koolituspaketi disainivalikuid.

**5. Konkreetne käik: paku end Eesti-põhiseks juhtumiuuringuks.** Konsultantide kõige
korduvam soov oli elulised Eesti näited („tahaks Eesti konteksti — reaalne tegevus,
klient, mõju, tulu"; „ei piisa, kui ütled lihtsalt nime — tahaks teada, mis seal
ärimudelis täpselt toimub"). Loodav koolitusprogramm VAJAB case'e — SotsiaalAI radikaalse
läbipaistvuse joon (avalik arhitektuur, avalikud piirid, aus ärimudel) teeb meist ideaalse
õppejuhtumi. Kontakt: kaardistuse autorid on TLÜ-st (Katri-Liis Lepik = sotsiaalse
ettevõtluse tuumikuurija) — SAMA TLÜ klaster, kust tulid 2050-esseed ja paneel; uks on
soe. Hind: paar tundi intervjuud; tulu: nähtavus konsultantide võrgustikus, kes nõustavad
KOV-e ja vabaühendusi üle Eesti.

**6. Nimeline sõlm: Koosloome / Sotsiaalse Innovatsiooni Labor (koosloome.ee; loetud
29.07.2026).** 9-aastase avalike teenuste disaini kogemusega koosloome-fasiliteerija
(Pedanik, Koppel, Kostabi, Kaasik, Üibu; Telliskivi 60a) — kaardistuses nimetasid teda
kvaliteetse toe pakkujana NII vabaühendused KUI KOV-id, st ta on ökosüsteemi
usaldusristmik. Referents otse meie maailmast: **Kagu-Eesti sotsiaalteenuste
arenguprogramm** — neil on KOV-suhted just väikeste omavalitsuste segmendis. Kolm
sihitud kasutuskohta (MITTE üldine „teeme koostööd"): (a) **T26 piloodi disainitugi** —
kui KOV-piloot käivitub, on professionaalne koosloome-fasiliteerimine (töötajad +
pöördujad + meie ühes ruumis) parem kui meie oma käe peal vehkimine; (b) **KOV-uks
Kagu-Eestis** — nende arenguprogrammi läbinud KOV-idel on disainitud protsessid, aga
tõenäoliselt mitte digikihti — täpselt meie profiil; (c) **heaolutalgute (30.09)
fasiliteerimiskvaliteet** — nende tööriistad või kohalolu tõstaks töölaudade taset.
Aus piir: nad müüvad fasiliteerimist (maksab) ja TOOTE disaini me sisse ei osta —
kasutus on sihitud üritused/uksed, mitte alltöövõtt.

**7. Nimeline sõlm: EKA sotsiaalse disaini MA (artun.ee; loetud 29.07.2026).** 2-aastane
eestikeelne tasuta magistriõpe disainiteaduskonnas (õppejõud Martínez, Kubinyi, Aaloe);
fookused kattuvad meie registriga peaaegu punkt-punktilt: teenusedisain, osaluspõhised
meetodid, vaimne tervis, migratsioon, KRIISIVALMIDUS, eetika. Partnerite seas on juba
**Sotsiaalministeerium (Heaolutehnoloogiate programm 2025–2030 — SAMA programm 437, mis
on meie F10 rahastusuks!)**, PERH (patsiendikeskne disain), Kultuuriministeerium + INSA
(Ukraina põgenike lõimumine → meie ukraina-rada teema). Kolm sihitud kasutuskohta:
(a) **tudengiprojektid/magistritööd = struktureeritud tasuta disainivõimekus** — paku
SotsiaalAI päris-teemasid (pöörduja teekonna kasutajauuring, teenusekaardi UX väikestele
osutajatele, ruumilise UI ligipääsetavus, kanalikaardi disain); hind = meie juhendamisaeg,
tulu = värsked silmad + akadeemiline rangus ilma palgakuluta (bus-factori sõbralik);
(b) **programmi 437 taotluse tugevdus** — EKA kui akadeemiline disainipartner taotluses,
nad juba töötavad selle programmi sees; (c) **värbamiskanal**, kui tiim kunagi kasvab
(lõpetajad = teenuse-/interaktsioonidisainerid, rakendusantropoloogid). Aus piir sama
mis SIL-il: semestririik on aeglane, IP/omand lepitakse ette kokku, tuumaotsuseid välja
ei delegeeri. Ökosüsteemi kolm akadeemilist jalga on nüüd kaardil: TLÜ (sotsiaaltöö +
ettevõtlus + esseeklaster), TÜ (RAKE pretsedent), EKA (disain).

**8. Nimeline sõlm: TalTechi teenusedisaini labor d.Lab (Jana Kukk, Laura Kullerkupp;
taltech.ee uudis, loetud 29.07.2026).** Neljas akadeemiline jalg — ja TalTechil on meie
kaardil nüüd KAKS rolli: kõnetehnoloogia (voogav eesti STT, multimodaalse kihi
tulevikutrigger) + teenusedisain. Uudisest kolm meie printsiipe kinnitavat mõtet, mis
kõlbavad positsioonilehele ja koolitusse: (a) „keerulised lahendused on tegelikult
lihtsamad ehitada" — täpselt meie aruandlusmooduli-keeldumise loogika (eraldi moodul on
lihtsam ehitada, kõrvalsaadus on õigem); (b) lihtsam lahendus maksab ehitades ~6% rohkem,
aga on odavam hooldada (NB: intervjuu väide, allikas kontrollimata — enne avalikku
tsiteerimist otsi uuring); (c) „avalikes teenustes on tekkinud rohkem NÄHTAMATUID
lahendusi" — essee lõpplause („aidata alguses ja jääda lõpus nähtamatuks") on valdkonna
disainidiskursuses juba olemas. Kasutuskoht: kerge — tsitaadivaramu + d.Lab kui
võimalik neljas tudengiprojektide kanal EKA kõrvale; eraldi käiku ei planeeri.

**9. Algallika lisad: Kangro & Lepik „An Ecosystem for Social Innovation in Estonia"
(TLÜ 2023, ESIA; loetud 29.07.2026)** — 2025. a kaardistuse teoreetiline eelkäija,
23 poliitikasoovitusega. Mida kaardistuses EI olnud ja mis meile loeb:
- **Hangete tühjus on mõõdetud:** innovatsioonihankeid oli 2020. a kõigist hangetest
  0,2% (arvult) / 0,1% (maksumuselt), 2021. a alustati 11; sotsiaalselt vastutustundlikke
  hankeid 2021. a KOKKU 12 tk (9,7 M€), enamik Töötukassa omad. Riigi enda raport
  soovitab (rec 9) sotsiaalse väärtuse hangetesse sisse kirjutada — praktika on
  peaaegu null. Kasutus: kui KOV meid kunagi hangib, on „sotsiaalselt vastutustundlik
  hange" valmis raamistik, mida hankijale ette pakkuda; kuluaari-fakt sügiskooliks.
- **93% sotsiaalseid ettevõtteid on MTÜ vormis ega pääse ettevõtlustoetustele** (OECD
  2020 kaudu) — meie OÜ-vorm on selles ökosüsteemis ERAND ja eelis: pääseme
  tavameetmetele, mida MTÜ-põhine enamus ei saa.
- **Mõju-investeerimise kaart:** „investing for impact" poolel sisuliselt üks tegija
  (Heateo SA); pankade peatakistus = mõju hindamise metoodika keerukus → kinnitab
  punkti 3 (mõju-mõõtmise infra on turuauk) ka KAPITALI poolelt.
- **SoM on juba katsetanud tulemuspõhist MTÜ-rahastust** (nt eakate tööhõive
  tulemusnäitajaga) ja KOV-ide MTÜ-toetused „ei eelda mõju" (KÜSK 2021) —
  tulemuspõhisuse laine tuleb; kes suudab mõju NÄIDATA, võidab järgmise
  rahastusmudeli. Meie E8/mall C on selleks valmis.
- **Kirikud kui avastamata kogukonnaressurss** (usaldusvõrgustikud, hingehoid vaimse
  tervise väljal) — kattub paneeli Šotimaa-näitega („linn, kogukond ja kirik koos");
  kogukonnakihi kauge noot, mitte tegevus.
- Accelerate Estonia = riigi „sandbox radikaalseteks pilootideks" — võimalik uks, kui
  kunagi vajame regulatiivset katsetusruumi (nt Sotsiaalvalve idee).

**10. „Sotsiaalne innovatsioon Eestis. Visioon 2030" (KÜSK + TLÜ + SEV + Sise- ja
Sotsiaalministeerium; ESIA projekt, ~2023; PDF docs/; loetud 29.07.2026)** — kolmiku
keskmine lüli (2023 analüüs → visioon → 2025 kaardistus). Mida teised kaks ei andnud:
- **Sektori suurus:** Eestis 263 sotsiaalset ettevõtet (SEV 2023 II kv), maksustatav
  käive 34,5 M€, ~4200 töötajat; 34% asutatud viimase 5 aasta jooksul.
- **2030 sihid, mille sisse me mahume:** mõjuettevõtlus = 10% SKP-st, 1% rahvastikust
  töötab mõjuettevõttes, „Eestis on mitu mõjuükssarvikut", ühiskondliku mõju analüüs
  majandusaasta aruande osana. Ambitsioonikas/aspiratiivne — aga tähendab, et
  mõjuettevõtteks deklareerumine paneb meid POLIITILISELT ÕNNISTATUD kasvunarratiivi
  sisse, mitte niši.
- **Kolm visioonirida, mis õnnistavad otse meie positsioneeringut:** (a) „SELGE KEEL
  asjaajamises, dokumentides, kaasamises" on avaliku sektori 2030 visioonieesmärk —
  meie keeleliides/bürokraatia-tõlge EI ole niši-veidrus, vaid riikliku visiooni
  teostus; (b) „tõusnud on TEHISINTELLEKTI kasutamise alane teadlikkus" on
  inimese/kogukonna visioonirida — AI-koolituspakett panustab otse ametlikku 2030
  eesmärki (kasuta Liisi-kirjas ja koolituse põhjendustes!); (c) „MÕJUHANKED ja/või
  mõjupõhiste teenuste ostmine on avalikus sektoris levinud tava" — hangete-argument
  (punkt 9) on visioonis normiks kuulutatud.
- **KOV-soovituste eraldi plokk** (koosloome areen, mõju hangetes, tulemuspõhised
  rahastusprogrammid, innovatsioonimõõdikud) — valmis keel meie KOV-vestlusteks:
  „teie enda valdkonna visioon soovitab täpselt seda, mida see tööriist teeb".
- **Viies akadeemiline sõlm:** TÜ Pärnu kolledži „inimesekeskse sotsiaalse
  innovatsiooni" õppekava nimetatud visioonis näidisena — TÜ on kaardil nüüd kahes
  rollis (RAKE + Pärnu kolledž); + Vastutustundliku Ettevõtluse Foorum (28 märgisega
  ettevõtet 2022) CSR-poolel ja Siseministeeriumi SI-töörühm (2022–) koordinatsioonis.
- **Erivajadustega inimesed kui oma elu asjatundjad, kes „müüvad eksperditeadmist
  teenusena"** — kogemusekspertide/mentorluse suuna visioonikinnitus.

**11. SIKK = ökosüsteemi elav esiuks (kysk.ee/sikk; loetud 29.07.2026).** Kogu kolmik
(2023 analüüs + visioon 2030 + 2025 kaardistus) elab nüüd KÜSK-i sotsiaalse
innovatsiooni kompetentsikeskuse veebikeskusena: terminid, ökosüsteemi ülevaade,
poliitikasoovitused, Šveitsi-Eesti programmi leht, uudised. Kaks praktilist asja:
(a) **SIKK on taotlusvoorude ja programmide JÄLGIMISKOHT** — punktis 2 lubatud
„jälgi KÜSK-i voore" tähendab konkreetselt seda lehte; (b) **podcast „Mõjulood"** =
odav ja täpne nähtavuskanal: mõjuettevõtte lugu sotsiaalvaldkonnas + AI-piirid on
täpselt nende formaadi teema — omanik võiks end külaliseks pakkuda (haakub punkti 5
juhtumiuuringu-käiguga, sama KÜSK/TLÜ ring). Numbrite ajarida ettevaatusega: SEV-i
andmebaas näitas 2022 III kv ~187 SE-d (30,4 M€, ~3800 töötajat) ja 2023 II kv 263
(34,5 M€, ~4200) — kiire kasv VÕI loendusmetoodika muutus; enne tsiteerimist võta
värske number sev.ee andmebaasist.

**11b. ESTA tugiprogramm = meie tööheaolu-kihi riiklik paralleel + kolm ust
(docs/ESTA kaust, 12 dokumenti, loetud 30.07.2026).** ESTA ehitab Šveitsi-Eesti
kvalifikatsioonikomponendi (SoM, 6,45 M€, 2024–2028) partnerina „töökohapõhist
tugisüsteemi": koolitused ~200 spets/a (SH „Tehisintellekti nutikas kasutamine
sotsiaalhoolekandes" — Airi Mitendorf, kohad täituvad kiiresti → AI-koolituse NÕUDLUS
on tõestatud, meie pakkumine = süvendus+eristus, mitte „tühiku täitmine"),
eetikakompass (ETAG TA-rahastus — ESTA arendab ise digitaalset tööriista!),
kompetentsiraamistik → 9 ameti kompetentsiprofiilid (sh TERVISETEEJUHT; digitaalsed
kaasamisvoorud sept 2026 / jaan 2027 / apr 2027 = formaalne kanal AI-pädevuse
ettepanekuks), **sügisel 2026 tööheaolu häkaton → tugisüsteemi KOV-piloteerimine
2027** (omaniku Heaolutalgud on selle rütmiga tõenäoliselt seotud — talgu väljund
võib viia KOV-pilootideni, kuhu platvorm istub). KOLM UST: (1) **mentorluse digikodu** —
strateegiapäev 23.04 pani ESTA omatulu-kavva mentorlusteenuse MÜÜGI (18 koolitatud
mentorit); teenuse müük vajab keskkonda (kohtumised, kokkuvõtted, arveldus) ja meie
mentorluse-kiht on ehitatud → E-ploki pakkumine „teie teenuse infrastruktuur, teie
kaubamärk"; (2) **koolitus revenue-share'ina** — ESTA tahab ise koolitusturule
(omatulu-kava esikoht), seega meie AI-koolitus = NENDE korraldatud tasuline koolitus
meie sisuga; (3) **KOV-kandidaadid tunnustuselt**: Viljandi vald (aasta asutus 2025;
juba katsetab heaolutehnoloogiaid — piloodi TIPPKANDIDAAT) ja Saue vald (Piiritalo
digilahendus töö koordineerimiseks + teenuste logistik — Teenuspäeviku turu-uuringu
kontakt). Taustanumber tööheaolu-kihile: **92,6% KOV sotsiaal-/lastekaitsetöötajatest
on kogenud kliendist lähtuvat vägivalda** (Toros jt 2024, TLÜ CIRIC) — töövägivalla
töövoog ja välitöö turvasignaal EI OLE nišifunktsioonid, vaid valdkonna
põhiprobleemi tootetasand.

**12. Autori lugu kui strateegiline vara (sotsiaal.ai/autorilt; loetud 29.07.2026).**
Avalik elulugu (2017 sotsiaalinfo.ee idee → 2020 AI-mõte ENNE ChatGPT-d → 2022 selge
visioon → 2025 mai ehituse algus → 2026 aprill toimiv platvorm) teeb kolm strateegilist
tööd, mida ükski teine dokument ei tee: (a) **ökosüsteem = vilistlasvõrgustik** — iga
5.11 sõlm on autori CV-s olemas (ajakiri Sotsiaaltöö tegevtoimetaja → RAG-luba; SoM-i
praktika; ESTA tegevus; Helpific → sotsiaalne ettevõtlus; TLÜ haridus → esseeklaster);
ükski uks ei ole külm; (b) **„kolm külge läbi elatud"** — isiklik abistaja
(osutaja/pöörduja pool) + tegevtoimetaja (teadmus ja keel) + ministeeriumipraktika
(süsteemi pool) = vaheruumi tees on elatud kogemus, mitte analüütiline poos; kuluaari
tugevaim avalause; (c) **pre-ChatGPT autentsus** — 2020. aasta AI-idee neutraliseerib
„hype'i-turisti" vastuväite ette ära. Võtmelause „sama keskkond ei saa kõnetada kõiki
ühtemoodi" (2022) on täna koodis kandjapiiri ja kolme rollina — elulugu ja arhitektuur
räägivad sama lauset, mis on radikaalse läbipaistvuse (5.5) harvim vorm: järjepidevus.
Kasutuskohad: essee autoririda, Mõjulood/juhtumiuuring, positsioonilehe „miks mina"
lõik, kuluaariavangud.

Lisakontroll (sotsiaal.ai/meist; loetud 29.07.2026): avalik leht, elulugu, essee ja
see strateegiadokument räägivad JUBA sama keelt („kõik algab selgusest"; „selguseni
peaks jõudma küsides, mitte otsides"; „AI valmistab ette, ei asenda"; „otsused jäävad
inimesele") — sõnumiarhitektuur on koherentne, mida hoida. Kasutamata pärl Meist-lehelt:
**„hoitud spetsialist on tugeva sotsiaaltöö alus"** → koolitusse ja positsioonilehele.
SAHTLI-MÄRGE (aktiveerib ainult omanik, = avaliku lehe muudatus): kui Meist kunagi
värskeneb, on tänase töö kandidaadid sinna: kolm EI-d selgete keeldumistena,
anti-engagement lubadus („meie edu on, et vajad meid vähem"), „abi küsimine tohib olla
sama privaatne kui mure ise", mõjuettevõtte enesemääratlus.

### 5.12. Vaimse tervise astmeline abi — riigi paralleelprojekt (peegel, piir ja kaks ust)

Allikas: SoM-i leht „Vaimse tervise astmelise abi piloteerimine" (uuendatud 24.07.2026;
PDF + infograafik `docs/vaimne tervis/`). Faktid: astmeline mudel = seisundi hindamine →
1. aste digitaalne eneseabi → 2. aste VIPS (väheintensiivne psühholoogiline sekkumine) →
3. aste esmatasand → 4. aste eriarstiabi; pilot digitaliseerib kaks esimest astet —
24/7 veebipõhine enesehindamine, AUTOMAATNE suunamine ilma spetsialistita, seisundi
jälgimine läbi teekonna; 40 kuud, **1 912 000 €** Riigikantselei avaliku sektori
innovatsioonifondist; SoM + Tervisekassa + TEHIK (projektijuht Kertu Miidu); pikaajaline
visioon = sidumine TIS-iga; eeskujud UK/Soome/Taani; terviseministri pealkiri lehel:
„abi peab jõudma inimeseni enne, kui mure süveneb".

**1. PEEGEL: riik ehitab tervise poolel sedasama, mida meie sotsiaalpoolel.** 24/7
digitaalne esmakanal enne spetsialisti, „abi võib alata juba enne arsti juurde jõudmist"
— see on vaheruumi-teesi riigipoolne kinnitus KOLMANDAT korda (Kuuse 2017 → TERVIK →
nüüd astmeline abi) ja ühtlasi tõestus, et selline kiht on rahastatav avalik hüve
(1,9 M€!). Sügiskooli U1 saab lisaargumendi: tervisemure digitaalne esmakanal on juba
ehitamisel — sotsiaalmure oma endiselt puudub.

**2. PIIR — ja see on KULD: riik ise klassifitseerib automaathindamise
MEDITSIINISEADMEKS.** Lehe võtmelause: kuna digitaalne seisundi hindamine ja
automatiseeritud suunamine tuginevad kliinilistele hindamisvahenditele, „käsitletakse
sellist lahendust meditsiiniseadmena" (MDR) — enne laienemist tuleb hinnata ohutust,
toimivust ja mõju. Meile tähendab see KOLMANDAT regulatiivset kaitsekraavi (AI Act +
RAKE pretsedent + nüüd MDR): meie EI kasuta kliinilisi hindamisinstrumente, EI skoori
seisundit, EI suuna automaatselt — sellepärast EI OLE me meditsiiniseade, ja see piir
peab jääma arhitektuuri (kriisirada = inimese enda valik + kontaktide näitamine, MITTE
kliiniline triaaž). Iga tulevane funktsiooniidee, mis lisaks „seisundi hindamise", tooks
kaasa MDR-i — registri väravasse kirjutada.

**3. UKS A: VIPS-spetsialistid = uus töötajaskond, seadusliku supervisioonivajadusega.**
VIPS-e osutavad väljaõppega spetsialistid, kes EI OLE tervishoiutöötajad, töötavad
tõenduspõhiselt ja on „regulaarselt superviseeritud" — see on tervise teejuhtide kõrval
TEINE riigi loodav uus töötajasrühm, kellel on sisseehitatud supervisiooni- ja
töökorraldusvajadus, aga (tõenäoliselt) ei ole veel töökihti. Meie supervisioonimudel,
kovisioon, tööheaolu ja kohtumiste kokkuvõtete muster sobivad neile ilma kliinilise
kihita. C-tabelisse rida; ärkamise kell = piloodi käivitumine/laienemine.

**4. UKS B: kanalikaart täieneb.** Kui riigi enesehindamise värav läheb live, peab meie
vestlus/kanalikaart (5.7) oskama vaimse tervise mure puhul juhatada ka sinna — „õige
kanal" on meie lubadus, mitte konkurentsitõrje. Ja vastupidi: astmelise abi teekonnal
sotsiaalmurega inimene vajab sotsiaalpoole ust — see ristsuunamine on koostöövestluse
teema SoM-iga (kontakt lehel olemas), MITTE enne piloodi käivitumist.

---

## 6. Riskid — aus pilk

| Risk | Tõenäosus | Vastus |
|---|---|---|
| **Üks ehitaja** (bus factor, läbipõlemine) | kõrge | halastamatu järjekord (5.1); dokumentatsioon on juba erakordne — hoida; partnerid kannavad osa koormast; ära ehita üksi seda, mida saab partneriga |
| **Riik ehitab ise peale** (STAR2 iseteenindus katab eelpöördumise) | keskmine | riik ehitab vormi-, mitte mõtestamiskeskselt; meie kiht algab enne vormi ja jääb inimese omaks; liidestu, ära võistle. Riigi tempo on meie liitlane |
| **Usaldusõnnetus** (leke, väärkasutus) | madal, mõju fataalne | invariandid arhitektuuris, mitte poliitikas; sõltumatu audit; intsidendiplaan; radikaalne läbipaistvus (5.5) |
| **Rahastuseta venimine** | keskmine | kaks jalga + 437-programm; piloot enne raha küsimist — töötav näide on parim taotlus |
| **Skoobi ahnus** (visioon on asutuse mõõtu, ehitaja üks) | kõrge | „mitte ehitada" distsipliin; 4 väravat; iga kuu küsimus: mis on AINUS järgmine asi? |
| **Regulatiivne ümberklassifitseerimine** (keegi loeb meid kõrge riski AI-ks) | madal | vastavusdokument ette (5.4); piir on koodis tõendatav |
| **KOV-ide konservatiivsus** | kõrge | mitte müüa platvormi, vaid lahendada ühte valu (eelinfo kvaliteet); EPIK/ESTA referentsid; „kaks töötlejat" raamistik valmis |

---

## 7. Kümne aasta pilt

2036. Inimene, kellel on elus keeruline hetk, avab keskkonna, mis on talle tuttav — sest ta
on seal varem oma elu sündmusi mõtestanud. Tema lugu on tema oma: ta näeb, mida ta on kunagi
jaganud, kellele ja miks, ja saab iga jagamise tagasi võtta. Ta räägib oma keeles — eesti,
vene, inglise, lihtsas keeles — ja süsteem tõlgib bürokraatia inimkeelde, mitte vastupidi.

Sotsiaaltöötaja alustab tööpäeva keskkonnas, mis teab, mis teda ees ootab, valmistab koos
temaga ette, ja kus tema enda jaksamine on sama tähtis kui tema juhtumid. Tema refleksioon,
kovisioon ja mentorlus on sama loomulik osa tööst nagu dokumenteerimine — ja dokumenteerimine
ise on poole väiksem, sest midagi ei sisestata kaks korda.

Riik näeb esimest korda ausat koondpilti: kus on rahuldamata vajadus, kuidas valdkond
päriselt jaksab, kas inimeste olukord muutub — ilma et ükski üksikisik oleks kunagi nähtav.
Ja kui mõni teine riik küsib, kuidas Eesti selle tegi, on vastus sama, mis X-tee puhul:
väike maa ehitas kihi, mida suured ei osanud alustada.

> **SotsiaalAI ei asenda ei inimest ega riiki, vaid teeb nähtavaks ja kergemaks kõik selle,
> mis seni on kahe vahele ära kadunud.**

See lause oli olemas enne seda dokumenti. Kõik ülaltoodu on ainult tema teostusplaan.

---

## Lisa: alusdokumendid

Riigi dokumendid (täistekstid loetud 28.07.2026): STAR-i strateegia 2026–2030 · Täisealise
abi- ja toetusvajaduse hindamise juhend 2025 · TERVIK-eelnõu 05.03.2026 · Eesti
sotsiaalteenuste kvaliteedijuhis (12.11.2024) · Heaolu arengukava 2023–2030 ·
Sotsiaalhoolekande programm 2026–2029 (+ Lisa 1 ja 2) · EPIKoja arvamus TERVIK-eelnõule ·
AI-määruse III lisa ajaraam. Tsitaatidega viited: `sugiskool-2026-kusimustik.md` ptk 9.

Platvormi dokumendid: `ideed.md` · fable-5 analüüsid (44 tk) · arhiveeritud kroonika (`git show db514ba0:…SEIS.md`) ·
usaldusmudel · ruumilise platvormi visioon · tulevikufunktsioonide register.
