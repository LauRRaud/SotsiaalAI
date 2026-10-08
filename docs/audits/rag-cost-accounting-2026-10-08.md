# RAG-i tegeliku tokenikasutuse kulu ja rahaline kuupiir

08.10.2026. Omanik palus tervikauditi järel toimivat rahakulu arvestust ja lubas tasulisi mõõtmisi. AI teatas enne mõõtmist 1 USD ülempiiri. Omaniku täpsustus: piir võiks olla pool kuutasust või veidi vähem, rahaliselt. Rakendusvalik: 45%, ümardatult sendini.

## Tulemuse ulatus

Uute RAG-vestluste planeerimine, päringuvektorid, allikavalik ja vastamine salvestatakse eraldi teenusepakkuja kulukirjetena. Pöörduja kuupiir on 3,60 EUR, spetsialistil 6,75 EUR ja teenuseosutajal 9,00 EUR. Administraatori sisepiir on 12 EUR. Paketiversioonide olemasolevaid muid õigusi migratsioon ei kirjuta üle; migratsioon lisab olemasolevatele tasulistele paketiversioonidele 45% nende tegelikust eurohinnast. Hilisem hinnamuutus vajab ka administraatori rahalimiidi muudatust. Administraator saab rahalimiiti paketis ja kasutaja erandiga muuta eurodes.

Vestluse raha piirab server, enne iga tasulist API-kutset. Vestluse vastuste arv ei ole selle RAG-raja rahalimiit. Teiste funktsioonide ühikupiirid jäävad alles. **See arvestus ei hõlma varasemaid vestlusi ega STT, TTS, dokumenditöö või süvauuringute teisi mudeliradu.** Nende olemasolev arvestus jääb eraldi; kogu platvormi ühine AI-kulupiir ei ole selle muudatusega tõendatud. Liides ütleb sama piiri välja.

## Hind ja tõendi tähendus

- Säilib algne USD-kulu nanoühikutes ning kasutaja limiiti kantud EUR-kulu, kursi kuupäev ja kurss. ECB USD/EUR kurss küsitakse kord päevas, salvestatakse ning kuni kümme päeva vana kurss saab ajutise välise tõrke katta. Vanem või puuduv kurss peatab tasulise raja. Päringu vastus kasutab sama kurssi kui selle reserv.
- Luna standardhind USD/miljon: tavasisend 0,10, cache-read 0,01, cache-write 0,125, väljund 0,50. Tavasisend = sisend kokku − cache-read − cache-write. Arutlustokenid on väljundi sees. Neid ega cache-tokeneid ei liideta teist korda.
- Ühe kutse sisendi korral üle 272 000 tokeni korrutatakse kogu kutse sisendi/cache hinnad kahega ja väljundi hind 1,5-ga. Vestluse koondtokenite arv ei käivita kordajat. Reserveerimisel võetakse kõrgem määr ka siis, kui konservatiivne baidipiir läve ületab.
- Rakenduse Luna-kutsed küsivad `service_tier: default`. Kviitung säilitab tegeliku tagastatud taseme. Flex on kalkulaatoris toetatud; tundmatu mudel, teenusetase või cache-jaotus jääb tundmatuks, mitte nullkuluks. Fikseeritud globaalse endpoint'i standardrada ei kasuta regionaalset ega pikka TTL-i hinnastust.
- `AiProviderCall` on teenusepakkuja **tegeliku kasutuse ja avaliku tariifi arvutus**, mitte OpenAI arve imporditud rida. Arve kooskõlastus on eraldi: snapshot ütleb `invoiceReconciled: false`. OpenAI Costs API annab päevase koondi, mitte `request_id` kaupa maksumust.

Ametlikud allikad: [Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), [cache-arvestus](https://developers.openai.com/api/docs/guides/prompt-caching), [Costs API](https://developers.openai.com/api/reference/resources/admin/subresources/organization/subresources/usage/methods/costs), [ECB](https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml). Hinnakaardi versioon `openai-2026-10-08-v1`.

## Rahalimiidi ja katkestuste invariandid

1. Kasutaja reserv ja RAG-i etapikirje tekivad samas andmebaasitehingus. Kasutaja tasemel lukk ning `used + reserved + amount <= hardLimit` atomaarne uuendus välistavad paralleelse topeltkulutamise.
2. Enne võrku märgitakse kutse saadetuks. Kasutaja kontroll, limiit või andmebaasiviga enne seda ei saada mudelikutset.
3. Teadaolev kulu asendab reservi üks kord; sama kviitungi kordus ei vabasta raha uuesti. Ka vana pilootplaani konservatiivne reserv asendub uute hinnastatavate kutsete korral tegeliku kuluga. Vanu ebatäielikke mõõtmisi tagasiulatuvalt täpseks ei nimetata.
4. Saadetud, kuid teadmata tulemusega päring jääb reservi. Ebaõnnestunud, ent kasutuse tagastanud päring loetakse kuluks. Saatmata katkestuse reserv vabastatakse; üle viie minuti saatmata seisnud reserv vabastatakse kasutaja järgmisel vestluse pöördumisel, ka plaaniuuenduse järel. Vabastatud kutset ei saa hiljem saata.
5. Kulukirje salvestamine ei sõltu vestluse püsimisest ega hilisemast seansi tühistamisest. Vestluse kustutamine ei kustuta kulu. Konto kustutamine eemaldab kulukirjelt kasutaja seose. Kirjes pole küsimust, vastust ega allikateksti.
6. Kui tegelik kulu ületaks vale eelbroneeringu, jääb see siiski kirja. Järgmised kutsed blokeeritakse. Andmebaasi senine range ülempiiri kontroll säilib teiste kasutusmõõdikute puhul.
7. Hilinenud vastus tasaarvestatakse algse kuu reserviga. Kuupiir lähtestub `Europe/Tallinn` kalendrikuu järgi. Rahalimiidi 429 säilib ka voogvastuses ega muutu üldiseks vastuse valideerimise veaks.

## Rollid

Roll tuleb serveris seansist; kliendi `userRole` asendatakse. `CLIENT` → `help_seeker`, `SOCIAL_WORKER` → `specialist`, `SERVICE_PROVIDER` → `service_provider`. Administraatori valitud vaateroll muudab mudeli vaatenurka, kuluõigus tuleb konto tegelikust paketist. Raha arvestuse juures parandati administraatori olemasoleva isikliku tellimuse eelistamine sisepaketile, et server ja kasutusvaade näitaksid sama limiiti.

Roll jõuab nii otsinguplaani kui ka vastuse sisendisse. Spetsialisti juhis keelab kolleegi vaikimisi sotsiaaltöötaja juurde saatmise; teenuseosutaja ja pöörduja juhised määravad adressaadi. See üksi ei garanteeri iga vastuse sisulist rollitäpsust.

## Kontrollid enne avaldamist

- Prisma skeem valideerub; kolm lisavat/tagasiühilduvat migratsiooni rakendatud eraldatud kohalikus `sotsiaal_ai_m4_dev` andmebaasis. Lukuaeg piiratud 5 sekundiga. Migreeritud skeemiga läbivad olemasolevad RAG-i salvestuse ja dialoogi testid.
- Rahaarvestuse andmebaasitestid 10/10: kõik kolm tasulist rolli, sama kviitungi paralleelkordus, eri päringute võistlus, tagasipööramine, saatmata ja tundmatu kutse, kustutamine, ülempiiri ületanud tegeliku kulu säilimine, korduspäringu tasuta taastamine, seansi tühistamine, kuu vahetus ja administraatori pakett.
- 66/66 sihttesti (kulu, provider, voogvastus, dialoogi andmebaasirajad), 39/39 päringu/hinna/juhise testi. Lisaks olemasoleva pilootsalvestuse 48 testi läbisid. Need jooksud osaliselt kattuvad; nende summat ei esitata eri testide arvuna.
- Muudetud JS/JSX sihtlint ning `i18n:check` läbisid. `git diff --check` läbis. Kohalikku tootmisbuild'i ei tehtud.
- Playwrightiga päris `UsageOverview` komponent sünteetilise snapshot'iga: 390×844 ja 1280×900, rahasumma, reserveeritud summa, kuu vahetus ja detailide avamine nähtavad. See on komponendi kontroll; kogu sisselogitud profiilirada pole selle pildiga tõendatud. Pildid `output/playwright/rag-cost-*.png`.

## Esimene pärismõõtmine

Kaks sünteetilist Luna standardkutset, `store: false`, 128 väljundtokeni piir. Sama sisend kaks korda, küsimuses isikuandmeid pole. [Algkviitungid](evidence/rag-cost-live-receipts-2026-10-08.json).

| Kutse | Sisend | Cache-read | Cache-write | Väljund | Kulu USD |
|---|---:|---:|---:|---:|---:|
| 1 | 1805 | 0 | 1802 | 13 | 0,00023205 |
| 2 | 1805 | 1802 | 0 | 13 | 0,00002482 |
| Kokku | 3610 | 1802 | 1802 | 26 | **0,00025687** |

Erinevus kinnitab, miks kõigi sisendtokenite 0,125 USD/miljoniga korrutamine ei ole täpne kuluarvestus. Need kaks kutset kontrollivad provider'i kasutusandmeid ja kalkulaatorit; kogu RAG-i pärismõõtmine ning avaldamise tulemus on järgmistes jaotistes.

## Avaldamine ja kolme rolli pärismõõtmine

Rahaarvestus avaldatud versioonis `10495045e78d32d57918c6f4ef70854b061f37f7`. [GitHubi build](https://github.com/LauRRaud/SotsiaalAI/actions/runs/37744907244) ja [deploy](https://github.com/LauRRaud/SotsiaalAI/actions/runs/37745109614) läbisid. Kolm migratsiooni rakendusid ning töötava teenuse kataloog kinnitas sama SHA.

Kolm eraldatud testkontot, üks sünteetiline juhtum rolli kohta, päris allikabaas ja avaldatud `PilotService` koos EUR-arvestuse adapteriga. Avaliku API kasutajate lubatud loendit ei muudetud. See on teenuse pärisrada; HTTP autentimise rolliedastus on kaetud kohalike rajatestidega. [Täielik anonüümne mõõtmistõend](evidence/rag-cost-roles-live-2026-10-08.json).

| Roll | API-kutseid | USD | EUR | Reserv pärast vastust |
|---|---:|---:|---:|---:|
| Pöörduja | 4 | 0,004491165 | 0,004018222 | 0 |
| Sotsiaaltöötaja | 4 | 0,005431890 | 0,004859884 | 0 |
| Teenuseosutaja | 4 | 0,003816610 | 0,003414702 | 0 |
| Kokku | 12 | **0,013739665** | **0,012292808** | **0** |

Kõik kolm vastust avaldati, kõik 12 kutset on hinnastatud. Kasutuskonto summa võrdub kviitungite EUR-summaga, USD-summa võrdub RAG-i eelarve pearaamatuga. Iga sama võtmega korduspäring taastas vastuse ilma ühegi uue API-kutseta. Testkontod ja nende vestlused kustutati; 12 sisuvaba kulukirjet säilisid kasutajaseoseta. Mõõteprotsessi taustal töötanud allikate soojendus hoidis protsessi pärast tulemuse ja puhastuse valmimist elus; lõpetati ainult see mõõteprotsess, mitte rakenduse teenus.

**Rolli sisuline leid:** pöörduja sai juhise omavalitsusse pöördumiseks, spetsialist enda töö sammud. Teenuseosutaja vastus käskis tal aga teenuseosutajaga kokku leppida ja haldusakti vormistada, omistades talle korraldaja ülesande. Dialoogi juhis v36 eristab nüüd teenuseosutaja teenuse planeerimist, osutamist ja koostööd ametiasutuse otsustuspädevusest ning nimetab sammu eest vastutaja. Juhis ei sisalda mõõtejuhtumi asukohta, teenust ega oodatud vastust. V35 jääb loetavaks. Juhise, dialoogi ja plaanilepingu 18 sihttesti ning sihtlint läbisid. Paranduse avaldamine ja kordusmõõtmine on allpool tõendatud.

### Rolliparanduse kordusmõõtmine

Parandus avaldatud versioonis `eb684d22e830377a47faeb924572967d223bd435`, [build](https://github.com/LauRRaud/SotsiaalAI/actions/runs/37746236595) ja [deploy](https://github.com/LauRRaud/SotsiaalAI/actions/runs/37746458214) edukad. Serveri töötava teenuse SHA kontrollitud, avalik `/api/health` tagastas 200.

[Sama kolme rolli kordus](evidence/rag-cost-roles-recheck-2026-10-08.json): 12 hinnastatud API-kutset, 0,013191980 USD / 0,011802798 EUR. Kõigi rollide EUR-konto ja kviitungite summa võrdsed, reserv null, vastuse taastamine olemasolevast tulemusest ilma uue API-kutseta, testkontod kustutatud ja kulukirjed alles. Pöördujale anti abi taotlemise juhised, sotsiaaltöötajale hindamise töö, teenuseosutajale koostöö omavalitsusega; viimasele ei antud enam korraldust ametiasutuse nimel haldusakti teha.

See kinnitab rolli edastamist ja nimetatud vea parandust mõõdetud näidetes. Kolm näidet ei tõenda kõigi võimalike vastuste rolli- ega faktitäpsust. Vabalt sõnastatud „Tartus” sai eri kordadel linna ja valla täpsustuse või linnapõhise vastuse; asukohatõlgenduse järjekindlus ning auditist pärinev väidete sisulise tõendatuse piir jäävad eraldi kvaliteediküsimusteks.

Esimese kolme pöörde kulu jaotus: plaan 0,000387750 USD, päringuvektorid 0,000037960, allikavalik 0,007132525, vastus 0,006181430. Sisendi osa (koos embedding'uga) 87,3%. Sisendikulu põhjus pole selle tööga eemaldatud: täistekstide valiku ja vastuse konteksti vähendamine vajab auditis kirjeldatud eraldi kvaliteediga võrreldavat parandust.

### Voogvastus ja lõppseis

[Päris voogvastuse tõend](evidence/rag-cost-stream-live-2026-10-08.json): üks teenuseosutaja pööre täpsustatud asukohaga Tartu linn, 273 tekstiosa, kõik neli kutset `settled`, 0,003524275 USD / 0,003153152 EUR. EUR-konto võrdub kviitungite summaga, reserv 0, sama pöörde taastamine ei teinud uut kutset. Vastus jättis koduteenuse täpse sisu ja korralduse omavalitsusele; teenuseosutajale ei omistatud ametiasutuse otsust. Testkonto kustutati, kulukirjed jäid alles.

Kõik tasulised mõõtmised kokku: **30 API-kutset, 0,030712790 USD**, sealhulgas seitse RAG-pööret (28 kutset, 0,030455920 USD) ja kaks cache-hinnakontrolli. Ükski seitsmest sama võtmega korduspäringust ei teinud uut API-kutset. Teatatud 1 USD piir jäi suure varuga täitmata. Mõõtmine ei ürita selle väikese valimi põhjal ennustada kõigi pärisvestluste hinda.

[Serveri lõppkontroll](evidence/rag-cost-release-final-2026-10-08.json): SHA `eb684d22`, dialoogi juhis v36, `gpt-6-luna`, health 200. RAG-i olemasolev avaliku kasutuse luba hõlmab praegu endiselt ainult ühte kontot. Selle arendusplaani 4 USD ühine eelarve on eraldi kaitsepiir, mis võib rakenduda enne kasutaja kuupiiri; seda ei tõstetud ega avatud vestlust kõigile kontodele. Rollipõhised rahalimiidid on pärisandmebaasis tõendatud eraldatud testkontodega. Täielikku avalikku mitme kasutaja avamist või kõigi AI-funktsioonide ühist rahalimiiti see töö ei tähista.

Lõplikud kontrollid: rahaarvestuse andmebaasitestid 10/10, hinna/provider'i viimased sihttestid 16/16, rolliparanduse juhise/dialoogi/plaani sihttestid 18/18; varasemad selles raportis nimetatud sihttestid, liidese kontrollid, lint ja tõlked läbisid. Koodi muutumise tõttu tehti GitHubis kummalegi avaldatud koodiversioonile üks tootmisbuild; serveris build'i ega testikomplekte ei käivitatud. Dokumentatsiooni järel samu muutumatu koodi kontrolle ei korratud.
