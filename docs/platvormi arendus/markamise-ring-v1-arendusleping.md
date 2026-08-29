# `ST10-06 MARKAMISE-RING-V1` — vabatahtliku Märkamise ringi arendusleping

Versioon: 1.0 · 24.08.2026
Lepingu liik: uus kõrge privaatsus- ja eetikariskiga tööriist
Elav teostusseis: [`SotsiaalAI.md`](./SotsiaalAI.md) S4 artiklivõrdluse lepinguregister
Tõendipiir lepingu koostamisel: nimeline funktsioon koodis 0; `runtime: not_run`

## 1. Vajadus ja kasutajalubadus

2021. aasta varase märkamise käsitlus näitab, et paljud võimalikud abivajajad ei pöördu ise,
kuid proaktiivset tööd piiravad ressursid, vastutus ja õiguslik alus. **Märkamise ring** on
inimese enda vabatahtlik kokkulepe: ta valib check-in'i rütmi, ühe või mitu usaldusisikut ja
selle, milline inimlik järeltegu toimub, kui ta ise kokkulepitud ajal märku ei anna.

Funktsioon ei ennusta abivajadust ega jälgi inimest. Vahelejäänud check-in on ainult
kokkulepitud sündmus, mitte riskihinnang.

## 2. Sobivus olemasoleva platvormiga

Taaskasutatav alus on võrgustik/kutsed, ruumid, sisutud teavitused ja outbox. Välitöö
usaldusisiku turvasignaal `lib/field/safety.js` on töötaja tööohutuse funktsioon ega ole selle
tööriista teostus. Märkamise ringil puuduvad praegu nimeline domeen ja kasutajapind; nende
teostuspiiri määrab käesolev leping.

## 3. V1 kasutajatee

1. Inimene lülitab ringi ise sisse ja valib rütmi, vaikse aja, usaldusisiku ning järelteo.
2. Usaldusisik saab enne nõustumist lihtsas keeles rolli, piiri ja loobumise võimaluse.
3. Check-in küsib minimaalselt „Kas soovid märku anda, et sinuga on praegu kokkuleppe järgi
   kõik korras?” ning pakub vajadusel päris abikanaleid.
4. Vastamata jätmisel läheb esmalt inimese enda valitud meeldetuletus; alles kokkulepitud
   tähtaja järel saab nõustunud usaldusisik sisutu teate.
5. Usaldusisik kinnitab teate vastuvõtu ja teeb kokkulepitud inimliku kontakti. Platvorm ei
   järelda kontakti tulemust.
6. Inimene saab rütmi muuta, pausi panna, usaldusisiku eemaldada või ringi kustutada.

## 4. Tootepiirid ja invariandid

- Ei passiivset asukoha-, aktiivsus-, telefoni-, tervise- ega seadmekasutuse jälgimist.
- Ei riskiskoori, riskinimekirja, automaatset triaaži ega politsei/KOV-i automaatteavitust.
- Vastamata jätmine ei tähenda automaatselt ohtu, hooletust ega abivajadust.
- Tööandja, KOV, teenuseosutaja ega pereliige ei saa ringi inimesele kohustuslikuks teha.
- Usaldusisik näeb ainult kokkulepitud check-in'i fakti, mitte Teekonda, vestlusi ega diagnoose.
- AI ei vali usaldusisikut, rütmi, eskalatsiooni ega kontakti sisu.
- Kui usaldusisik pole nõustunud või on lahkunud, ei ole eskalatsioonirada aktiivne.
- Iga ajastatud töö ja outbox'i saatja kontrollib vahetult enne saatmisõiguse võtmist ringi
  aktiivset versiooni ning saaja kehtivat nõusolekut. Peatatud, lõpetatud või kustutatud ring,
  eemaldatud saaja, tagasivõetud nõusolek või aegunud versioon muudab veel järjekorras töö
  sisutuks `no-op`-iks. Juba välisele teavituskanalile üle antud teadet ei saa tagasi kutsuda.

## 5. Minimaalne andmeleping

Ring: omanik, olek, rütm, ajavöönd, vaikne aeg, meeldetuletuse ja eskalatsiooni viivitus,
usaldusisiku kutse/nõusolek ning kokkulepitud järelteo tüüp. Check-in: oodatud aeg, inimese
teadlik vastus või vastamata fakt, meeldetuletus, teate saatmine ja saaja vastuvõtt.

Ajastatud töö kannab ainult oodatud ringiversiooni, saaja ID-d, oodatud nõusolekuversiooni ja
idempotentsusvõtit, mitte tundlikku sisu. Need väljad on uuesti kontrollimise alus, mitte
varasem luba hilisemaks saatmiseks.

Saatmise olek on vähemalt `PENDING | CLAIMED | SENT | CANCELLED`. Saatja võtab `CLAIMED` õiguse
samas lukustatud tehingus, milles kontrollitakse ringi ja nõusoleku versiooni; paus/tagasivõtt
kasutab sama lukku. Kui saatmisõigus võidab võistluse, ütleb UI ausalt, et teadet ei pruugi enam
saada tagasi kutsuda.

V1 ei salvesta päevikuvabateksti ega „miks ei vastanud” põhjust. Teavitus kannab ainult
ringi ID-d ja tegevusvajadust. Ajalugu on lühikese, lepingus otsustatud retention'iga ning
inimesele kustutatav; minimaalne saatmis-/vastuvõtufakt võib säilida piiratud auditina.

## 6. Teostusetapid

### E0 — eetika-, õigus- ja vastutuse värav

- Tehke andmekaitse/õiguse analüüs vabatahtlikkuse, alaealise/täisealise, teovõime,
  usaldusisiku vastutuse, teavituse ja retention'i kohta.
- Valige üks päris inimsaaja-piloot ning valideerige sõnastus kogemusekspertidega.
- Ärge kirjutage ajastatud eskalatsiooni enne, kui safe default ja fallback on kinnitatud.

### E1 — ring, nõusolek ja elutsükkel

- Loo omaniku-skoobitud ring olekutega DRAFT, PENDING_RECIPIENT, ACTIVE, PAUSED, ENDED.
- Kasuta olemasolevat kutse/outbox taristut; nõusolek on saajapõhine ja tagasivõetav.
- Ringi aktiveerimine nõuab vähemalt üht kehtivalt nõustunud saajat.

### E2 — check-in ja meeldetuletus

- Lisa inimese teadlik check-in, rütm ja ajavöönd; taustatöö loob ainult oodatud sündmuse.
- Rakenda idempotentne meeldetuletus ning võimalus „vajan praegu abi” päris kanaliteni.
- Vastamata fakt ei tohi käivitada muud kui lepingus valitud rada.
- Enne meeldetuletuse outbox-kirjet kontrolli ringi oodatud versiooni ja aktiivsust; aegunud töö
  lõpetab ilma saatmise ja uue sündmuseta.

### E3 — inimlik järelkontakt

- Saada sisutu teade nõustunud saajale ning nõua vastuvõtukinnitust.
- Võta outbox'i saatmisõigus atomaarse claim'iga, mis kontrollib saaja nõusolekut ja ringi
  aktiivset versiooni sama lukustuse all. Varem peatatud/tühistatud ring või eemaldatud saaja
  tühistab järjekorratöö; juba claim'itud/väljastatud teate tagasikutsumise piir on nähtav.
- Kuva inimesele, kellele ja millal teade läks; paku saaja puudumise fallback'i.
- Platvorm ei märgi inimest „turvaliseks” saaja oletuse või vaikimise põhjal.

### E4 — juhtpult, lõpetamine ja ligipääsetavus

- Lisa rütmi, pausi, saajate ja ajaloo juhtimine ning päris kustutusrada.
- ET/EN/RU, lihtkeel, klaviatuur, ekraanilugeja, mobiil ja timezone/DST veaseisud.
- Ära kuva tööandja- ega organisatsioonivaadet.

## 7. Vastuvõtukriteeriumid ja DoD

Valmis koodiviil võimaldab inimesel ringi teadlikult luua, saajal rolliga nõustuda, check-in'i
teha, pausi/lõpetamist hallata ja kokkulepitud vastamata sündmuse järel sisutu teate saata.
Ilma nõustunud saajata ei aktiveeru midagi; võõras kasutaja, tööandja ega admin ei näe ringi.
Ükski rada ei kogu passiivset telemeetriat ega loo riskiskoori.
Ajastuse järel, kuid enne saatmisõiguse claim'i tehtud paus, lõpetamine, kustutamine, saaja
eemaldamine või nõusoleku tagasivõtmine takistab kohaletoimetamist; aegunud töö jääb
idempotentseks `no-op`-iks. Claim'i ja tühistamise võistlus on serialiseeritud ning võitnud
saatmisõiguse korral ei lubata UI-s tagasikutsumist.

Kontroll: lint, `git diff --check`, vajadusel `i18n:check` ja `prisma validate`, peatüki lõpus
build ning käsitsi omaniku/saaja/võõra, DST, pausi ja vastamata rada. Automaatteste ega sonde
ei looda ega käivitata; kontrollimata käitumine jääb `NOT_PROVEN`.

## 8. Aktiveerimisväravad

- Õ-MR-1: eetika- ja õigusanalüüs ning retention.
- P-MR-1: päris nõustunud inimsaaja või partner ning selge vastutuse piir.
- O-MR-1: V1 sihtrühm; alaealise või piiratud teovõimega inimese rada ei kuulu vaikimisi
  täisealise iseseisva kasutaja MVP-sse.
- Feature flag jääb välja, kuni käsitsi partnerirada on tõendatud.
