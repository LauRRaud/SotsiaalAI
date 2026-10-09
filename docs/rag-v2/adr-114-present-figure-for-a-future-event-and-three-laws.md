# ADR-114: tulevase sündmuse korral öeldakse praegune summa; kolm puuduvat seadust (korpus v73)

Kuupäev: 09.10.2026. Teostus Claude Opus 5.5. Omanik 09.10.2026: „nii, on meil veel RAG süsteemi arendust. Jätka“ ja „luba on antud raha kulutada“; ulatuse ja kulupiiri (selle töölõigu peale 0,30 USD) määras tegija ja ütles need omanikule. Seis: **korpus v73 on ostetud ja töös** (indeks `d0aa63f4`, 8659 dokumenti, 75 102 lõiku, kulu 0,0620 USD); juhised 38 ja lugeja piir on töös ja mõõdetud kuue küsimusega (0,0247 USD, jaotis „Mõõtmine“): summad tulevad, kolm seadust jõuavad vastustesse. Juhised 39 (märkus teksti, mitte piirangute alla) on mõõtmata.

Lähtekoht on [vastuste kontroll 08.10.2026](../audits/rag-v2-state-content-check-2026-10-08.md): 14 küsimusest viis andsid leiu. Siin on neist kolm; kaks jäävad lahti (jaotis „Mis jääb lahti“).

## 1. Tulevane sündmus ei ole põhjus summa ütlemata jätta (vestluse juhised 38)

**Probleem.** Küsimus „Meil sünnib kevadel laps. Mis raha pere riigilt saab?“ sai õige loetelu ja taotlemise käigu, aga mitte ühtegi summat, kuigi leht „Perehüvitiste määrad“ oli vastusele antud. Vastuse piirang: „ei saa öelda, millised toetuste summad kehtivad lapse sünni ajal kevadel“. Aja reeglid ([ADR-102](adr-102-time-in-the-answer.md)) nõuavad, et summa juures öeldakse, mis aja seis see on; mudel järeldas sellest, et tulevase aja kohta ei saa summat öelda.

**Otsus.** Aja reeglite lõppu üks lause (`TIME_INSTRUCTIONS`, `m4-grounded-dialogue-38`): kui see, mille kohta küsitakse, on alles ees ja tõendites on praegu kehtiv summa, määr, piir, tähtaeg või tingimus, öeldakse see koos seisu ajaga ja lisatakse lühidalt, et selleks ajaks võib see muutuda; tulevik ei ole põhjus summa välja jätta ega ole iseenesest piirang. Lause on üldine: selles ei ole ühtegi toetust, aastat ega arvu (test kontrollib). Juhised kasvavad umbes 60 tokeni võrra pöörde kohta.

## 2. Kolm seadust (korpus v73)

| Seadus | Riigi Teataja | Kehtib | Paragrahve | Lõike |
|---|---|---|---:|---:|
| Riigi õigusabi seadus | `103062026035` | 12.06.2026–31.10.2026 | 47 | 55 |
| Korrakaitseseadus | `109072026055` | alates 01.10.2026 | 106 | 121 |
| Kriminaalmenetluse seadustik | `111072026078` | 01.10.2026–31.10.2026 | 836 | 860 |

Põhjus: küsimus „advokaadi jaoks raha ei ole“ vastati kohtute lehelt ja teiseks viiteks läks asjasse mittepuutuv juhend; küsimusele „mida politsei teha saab“ vastati 2016. aasta ajakirjaartikliga. Viibimiskeeld on korrakaitseseaduses, ajutine lähenemiskeeld ja kannatanu õigused kriminaalmenetluse seadustikus.

Kõik kolm on tervikuna. Kriminaalmenetlus on inimeste jaoks sama sage teema kui tsiviilkohus, mille omanik 08.10 lasi tervikuna sisse võtta ([ADR-111](adr-111-state-level-help-first-batch.md)). Kahe seaduse praegune redaktsioon kehtib 31.10.2026-ni; järgmise toob igakuine kehtivuse kontroll.

## 3. Lugeja ehituslik piir 250 000 sõlme

Kriminaalmenetluse seadustiku XML-is on 124 211 sõlme ja lugeja keeldus (`markup_structure_limit`, piir 100 000). Piir on kaitse vigase faili vastu, mitte lugemise reegel; tsiviilkohtumenetluse seadustik mahtus selle alla 98 293 sõlmega. Uus piir on 250 000 (suurim loetud akt parsitakse alla kümnendiku sekundiga). Ühegi juba loetud akti väljund ei muutu; töötluse sõrmejälg on uuesti salvestatud.

## Eestkoste küsimus: viga ei olnud

Kontrolli leid 2 („eestkoste küsimus ei leidnud uusi allikaid“) on pöörde kirjest üle vaadatud. Otsingu 36 kandidaadi hulgas oli kaks tsiviilkohtumenetluse seadustiku lõiku ja kaks perekonnaseaduse lõiku; valik jättis alles kuus praktilisemat lõiku (dementsuse kompetentsikeskuse leht, hooldaja juhend, perekonnaseadus) ja vastus oli õige. Tähelepanek, mitte viga: üks uuring („Täisealiste eestkostekorralduse uuring“) võttis 36 kandidaadikohast 10. Kandidaatide jaotust dokumentide vahel ühe pöörde põhjal ei muudetud.

## Arvud

| | v72 | v73 | Piir |
|---|---:|---:|---:|
| Dokumente | 8656 | 8659 | 10 000 |
| Lõike | 74 066 | 75 102 | 100 000 |

- Ost: 1036 sisendit, 476 971 tokenit, 0,0620 USD (selle ostu piir 0,08 USD). Arvestatud kinnitatud kasutusest, mitte arvelt; hind kontrolliti samal päeval.
- Ketas: pärast 22 GB vaba (72% kasutusel).

## Kontrollitud

- Ühiktestid (värske põhiharu peal, kuhu teised tööd olid vahepeal lisanud 52 muudatust): 1087, neist 1065 läbi ja 22 vahele jäetud. Juhiste test kontrollib uue lause sõnastust, seda, et aja reeglites ei ole ühtegi arvu ega teemat, ja uut versiooni; töötluse sõrmejälje test läbib uue salvestusega. ESLint muudetud failidel.
- Serveris: ost `complete` (1036, teadmata 0); indeks `ready`; vestlusplaani kontroll `ready`; teenus töötab; planeerija ootab uuele põlvkonnale 8842 dokumenti (tegelikult 8659).
- Registri räsid vastavad failidele; õigusaktide nimekiri igakuise kehtivuse kontrolli jaoks on uuendatud (552 akti).
- [ADR-113](adr-113-stopped-purchase-vectors-count.md) esimene päris jooks: varasemate ostude loendis oli nüüd ka 26.09 peatunud ost (44 kausta) ning plaan, ost ja indeksi ehitus võtsid selle vastu; peatunud ostudest tuli 0 sisendit, nagu pidigi.

## Kontrollimata

- Vastused mudeliga: kas tulevase sündmuse küsimus saab nüüd summad ja kas kolm seadust jõuavad vastustesse. Mõõdetakse pärast paigaldust samade küsimustega.
- Kas uus lause muudab teisi vastuseid (näiteks lisab asjatu märkuse „võib muutuda“ sinna, kus küsimus tuleviku kohta ei käi).

## Mõõtmine 09.10.2026 ja juhised 39

Pärast paigaldust (väljalase `03ee35cc`, juhised 38, korpus v73) kuus küsimust serveri enda vestlusteenusest läbi; kõik lõppesid, kulu **0,0247 USD** (lagi 0,05).

| Küsimus | Tulemus |
|---|---|
| Meil sünnib kevadel laps, mis raha pere saab | summad on nüüd vastuses: „2026. aastal on sünnitoetus 320 eurot ühekordselt ja lapsetoetus esimesele ning teisele lapsele 80 eurot kuus“; enne ei olnud ühtegi summat |
| Kui suur on praegu lapsetoetus esimese lapse eest (võrdluseks, olevik) | „Praegu on lapsetoetus pere esimese lapse eest 80 eurot.“ Asjatut märkust muutumise kohta ei lisatud |
| Jään kahe aasta pärast pensionile, kui suur on rahvapension | „2026. aasta 1. aprillist on rahvapension 414,10 eurot kuus“ ja lause, et kahe aasta pärast võib see olla teistsugune |
| Advokaadi jaoks raha ei ole, kas riik aitab | viitab riigi õigusabi seadusele ja kohtute lehele; kes abi saab, mida taotlusse kirjutada, et taotlus tähtaega ei peata |
| Elukaaslane lööb, mida politsei teha saab | viitab korrakaitseseadusele ja kriminaalmenetluse seadustikule: viibimiskeeld perevägivalla ohvri kaitseks kuni 72 tundi (võrreldud seaduse tekstiga, klapib), ajutine lähenemiskeeld prokuratuuri taotlusel; 2016. aasta artiklit enam ei kasutatud |
| Kutsuti kannatanuna ütlusi andma, mis õigused | kriminaalmenetluse seadustikust: tõendid, taotlused ja kaebused, protokolliga tutvumine, saatja, samast soost küsitleja, ohvriabi |

**Mis jäi viltu.** Kahes tuleviku-küsimuses kirjutas vastus märkuse „summa võib selleks ajaks muutuda“ nii teksti kui ka piirangute alla, mistõttu vastus sai sildi „osaline“. Juhised 39 (`m4-grounded-dialogue-39`) ütlevad, et märkus käib ploki tekstis ja seda ei kirjutata piirangute alla. Kas see mõjub, mõõdetakse pärast järgmist paigaldust ja kirjutatakse [kontrolli aruandesse](../audits/rag-v2-state-content-check-2026-10-08.md).

## Mis jääb lahti

- Töö kaotus vastatakse ainult seadustest: Töötukassa lehti ei saa korjata (sisu aadress on saidi robots.txt-s kogujatele keelatud).
- Lapse arengumure allikas (Rajaleidja lehed ei sobinud), Peaasi ja Tervise Arengu Instituudi lehed.
- Uued 293 juhislehte ei ole igakuises värskenduses.
