# GOV-02 — STAR-i ja asutuste rolli faktikontroll

Vaatluskuupäev 21.10.2026 (Claude, `sol-proof-20261014-01`). Aluseks 13.10 kirja tõendusanalüüs
([analüüs](../../sotsiaal-pro-kirja-ja-tagasiside-toendusanaluus-2026-10-13.md), osa 9), mille allikad loeti 21.10
uuesti. Midagi ei saadetud ühelegi asutusele. Ametlikku liidest, kirjutamisõigust ega kokkulepet see dokument ei
tõenda.

## Ametlike allikate register

| Allikas | Lehe kuupäev | 21.10 lugemine | Mida allikas ütleb |
|---|---|---|---|
| [SKA: isikuandmete töötlemine](https://www.sotsiaalkindlustusamet.ee/asutus-uudised-ja-kontakt/praktiline-teave/isikuandmete-tootlemine) | uuendatud 16.10.2026 | loetud | STAR on riigi infosüsteemi kuuluv andmekogu sotsiaaltöö korraldamiseks. Vastutav töötleja on Sotsiaalkindlustusamet. Volitatud töötlejad on kohalikud omavalitsused ja sotsiaalteenuse osutajad (13.10 lugemisel ka TEHIK). Andmeid väljastatakse teistele andmekogudele või asutustele ainult õigusakti alusel. |
| [SKA: STAR](https://sotsiaalkindlustusamet.ee/spetsialistile-ja-koostoopartnerile/star) | uuendatud 25.03.2026 | loetud | STAR-is registreeritakse pöördumised, kirjeldatakse abivajajad ja juhtumiplaanid, määratakse teenused ja toetused; teenuseosutajad registreerivad osutatud teenuseid. Päringud: rahvastikuregister, SKAIS, EMPIS, TETRIS, KIRST, MKR, TÖR, EHIS, liiklusregister, kinnistusraamat. Andmevahetus teiste ametkondadega käib üle X-tee. Välist (kolmanda osapoole) liidest lehel ei kirjeldata. Strateegia 2026–2030: STAR on 2030. aastaks „töökindel ja ühendav infosüsteem ning digiplatvorm“. |
| [SKA: kuidas vastata inimese pöördumisele](https://sotsiaalkindlustusamet.ee/sotsiaaltoo-artiklid/kuidas-vastata-inimese-poordumisele) | loodud 27.12.2019 | loetud | Teabenõue 5 tööpäeva (AvTS); märgukiri ja selgitustaotlus 30 kalendripäeva (MSVS); KOV-i hoolekandeabi otsus üldjuhul **10 tööpäeva** (SÜS § 25 lg 1). Kiire juhtumi 7-päevast tähtaega ei nimetata. |
| [SKA: STAR2 lastekaitsetöös](https://sotsiaalkindlustusamet.ee/sotsiaaltoo-artiklid/star2-tuleb-mis-muutub-lastekaitsetootaja-igapaevatoos) | avaldatud 12.10.2026 | **ei loetud** (HTTP 403) | 13.10 lugemine: 3. novembri üleminek puudutab lastekaitsetööd. |
| [SKA: täisealise abivajaduse hindamine STAR-is](https://sotsiaalkindlustusamet.ee/sotsiaaltoo-artiklid/taisealise-inimese-abivajaduse-hindamine-uued-voimalused-star) | — | ei loetud 21.10 | 13.10 lugemine: täisealise hindamise lahendus kasutusel alates oktoobrist 2024. |

## Järeldused

- **SKA on andmevahetuse arutelu jaoks asjakohane osapool**, sest ta on STAR-i vastutav töötleja. See ei tähenda,
  et SKA üksinda otsustab valdkonna poliitika, rahastuse või hanked; Sotsiaalministeerium ja TEHIK on arutelu teised
  osapooled.
- **STAR-il on palju registriühendusi ja X-tee andmevahetus.** Sotsiaal.pro väärtust ei saa põhjendada eeldusega, et
  STAR-is andmevahetust pole.
- **Avalikku kirjutamisliidest kolmandatele süsteemidele ei leitud.** Sotsiaal.pro ei tohi väita, et tal on
  kirjutamisõigus, API või kokkulepe; praegu kannab spetsialist või teenuseosutaja info STAR-i ise ja platvorm aitab
  selle ette valmistada (TOOLS-06, [käsitsi kandmise ettevalmistus](server-manual-star.json)).
- **Tähtajad:** KOV-i hoolekandeabi otsuse üldtähtaeg 10 tööpäeva on ametlikus allikas olemas (SÜS § 25 lg 1).
  Üldist „kiire juhtum 7 päeva“ reeglit ei leitud; seda ei korrata ilma konkreetse allika, menetlusliigi ja
  algushetketa. Platvormi töö tähtaeg (`dueAt`) ei ole praegu kasutusel (parandusnimekiri p 19), seega ei saa
  platvorm õigusliku tähtaja algust ega kulgu tõendada.

## Piiratud kasutusjuhtum ja lahtised küsimused (STAR-i liides)

Kasutusjuhtum, mida võib arutada: inimese nõusolekul saadetud eelpöördumise kokkuvõte liigub ühesuunaliselt STAR-i
pöördumise registreerimise juurde, et spetsialist ei peaks seda käsitsi ümber kirjutama. Platvorm ei loe STAR-ist
andmeid.

Lahtised küsimused SKA-le, SoM-ile ja TEHIK-ule (neid ei ole saadetud):

1. Kas STAR-is on või kavandatakse X-tee teenust, mille kaudu volitatud töötleja (KOV) saab pöördumise kirje
   luua kolmanda osapoole süsteemist? Kes on sel juhul andmete saatja: KOV, teenuseosutaja või platvorm?
2. Milline on STAR-i pöördumise minimaalne andmekoosseis ja kas vaba tekst on lubatud?
3. Mis on andmete STAR-i edastamise õiguslik alus (SHS, STAR-i põhimäärus) ja kas inimese nõusolek on vajalik või
   piisav?
4. Kuidas tuvastatakse kirje looja ja kuidas jääb jälg STAR-i logisse?
5. Kas strateegia 2026–2030 „ühendav digiplatvorm“ hõlmab väliste töövahendite liidestamist ja millise ajakavaga?
6. Kas teenuseosutajate kuluaruannete esitamiseks on olemas või kavas masinliides?
7. Kes kannab liidestuse arendus- ja hoolduskulu?
8. Kas STAR2 lastekaitse üleminek (3.11.2026) muudab pöördumise kirje struktuuri?
