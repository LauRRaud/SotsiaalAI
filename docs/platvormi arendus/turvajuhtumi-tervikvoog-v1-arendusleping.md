# `ST10-11 TURVAJUHTUM-V1` — töötaja turvajuhtumi tervikvoo arendusleping

Versioon: 1.0 · 24.08.2026
Lepingu liik: uus organisatsiooniülene tervikvoog olemasolevate ohutus- ja tugifunktsioonide peal
Elav teostusseis: [`SotsiaalAI.md`](./SotsiaalAI.md) S4 artiklivõrdluse lepinguregister
Tõendipiir lepingu koostamisel: doonorid osaliselt olemas; `runtime: not_run`

## 1. Vajadus ja kasutajalubadus

2026. aasta osalise allikakihi töötajaturvalisuse käsitlus asetab vastutuse organisatsioonile
ja juhtimisele, mitte ainult töötaja enesehoiule. **Turvajuhtumi tervikvoog** aitab töötajal
enne visiiti teha teadliku ohutusplaani, vajadusel taotleda paaristööd või abi, saata ametliku
turvateate volitatud juhile ning saada pärast juhtumit kokkulepitud õigus-, psühholoogilist,
supervisiooni- või muud järelabi.

Privaatne enesehoid ja ametlik organisatsiooni vastutus jäävad eri objektideks. Juht ei saa
selle funktsiooni kaudu töötaja Tööheaolu, supervisiooni või refleksiooni sisu lugeda.

## 2. Sobivus olemasoleva platvormiga

**Taaskasutatav:** välitöö check-in/dead-man ohutus `lib/field/safety.js`; töövägivalla
privaatne töövoog `lib/wellbeing/workplaceViolence.js`,
`components/wellbeing/WorkplaceViolenceWorkflow.jsx` ja vastav API; Tööheaolu,
supervisioon, mentorlus, kovisioon, organisatsiooni rollid, teavitused ja assignment.
`lib/org/supportShare.js` ning `components/org/OrgSupportClient.jsx` annavad manager/safety
saajaga `WellbeingSupportShare` elutsükli `SENT → OPENED → CORRECTED/CLOSED` ja toe küsimise
doonori. `lib/wellbeing/aggregate.js` ja `lib/wellbeing/cellSuppression.js` annavad juba
väikeste lahtrite summutuse aluse.

**Puudu:** organisatsiooni ametlik eelrisk/abipalve, juhi vastuvõtukinnitus, paarisvisiidi või
abi määramine, järeltoe kokkulepe ja kontrollpunkt ning piisavalt summutatud õppiv koond.
Olemasolev töötaja privaatne turva- või töövägivalla rada ei ole juhtumiregister ning
`OPENED` ei tõenda juhi vastutuse vastuvõttu.

## 3. V1 kasutajatee

1. Töötaja teeb enne visiiti teadliku ohutusplaani ja valib vajadusel „soovin paarisvisiiti / abi”.
2. Volitatud juht või turvaroll näeb minimaalset taotlust, kinnitab vastuvõtu ning määrab
   kokkulepitud toe. Ta ei näe töötaja privaatseid enesehoiu kirjeid.
3. Juhtumi korral teeb töötaja eraldi selge toiminguga ametliku turvateate; välitöö check-in'i
   puudumine ei loo automaatselt juhtumit.
4. Juht kinnitab vastuvõtu, valib järeltoe variandid ja lepib töötajaga kontrollpunkti.
5. Töötaja näeb, kes vastutab ja millal järelkontakt toimub. Privaatne refleksioon võib jääda
   Tööheaolusse/supervisiooni eraldi jagamiseta.
6. Organisatsioon saab õppida ainult ette määratud, piisava rühma ja summutusega koondist,
   millest ei saa inimese või juhtumi juurde puurida.

## 4. Tootepiirid ja invariandid

- Ei taustal asukoha jälgimist, „kes on kus” juhi vaadet ega pidevat töötaja check-in'i seiret.
- Ei töötaja, kliendi, pere või piirkonna riskiskoori ega musta nimekirja.
- Juht ei näe privaatset Tööheaolu, supervisiooni, mentorluse, kovisiooni ega refleksiooni sisu.
- Ametlik turvateade tekib ainult töötaja selgest toimingust või eraldi seaduslikust kanalist,
  mitte AI järeldusest.
- AI võib aidata teksti struktureerida, kuid ei määra ohtu, süüd, vastutust ega meedet.
- Turvateate lugemisõigus on organisatsiooni capability ja nimelise rolliga; admini platvormiroll
  ei anna sisuõigust.
- Koond ei lähe kasutusele enne O-WB-K läve/summutuse otsust ja differentsiriskide kontrolli.

## 5. Minimaalne andmeleping

Ohutusplaan: töötaja, tööülesande/visiidi viide, teadlikult valitud meetmed, taotletud abi,
vastutav roll, vastuvõtt ja aegumine. Turvateade: organisatsioon, töötaja, juhtumi aeg/kategooria,
minimaalne kirjeldus, kiire toe vajadus, vastuvõtja, olek ja versioon. Järeltugi: valitud toe
tüüp, vastutaja, tähtaeg, vastuvõtt ja kontrollpunkt — mitte supervisiooni sisu.

Audit kannab olekusiirdeid, rolle ja aega. Detailne vabatekst ei lähe outbox'i ega koondisse.
Privaatse töövägivalla kirje ja ametliku teate vahel pole automaatset kopeerimist; töötaja
valib väljad ning näeb eelvaadet.

## 6. Teostusetapid

### E0 — organisatsiooni capability, õigus ja privaatsus

- Lukusta ühe pilootorganisatsiooni turvarollid, vastutus, lugemisaeg, fallback, retention ja
  järeltoe omanik.
- Kaardista privaatse töövägivalla, välitöö ohutuse, ametliku tööõnnetuse/turvateate ja
  supervisiooni piirid; ära ühenda neid üheks sisuks.
- Otsusta koondanalüütika lävi ja summutus eraldi enne E4 aktiveerimist.

### E1 — eelnev ohutusplaan ja abitaotlus

- Lisa teadlik ohutusplaan olemasoleva välitöö tööülesande külge.
- Paarisvisiidi/abi taotlus läheb ainult capability'ga rollile ja nõuab vastuvõttu.
- Puuduv vastuvõtja või aegumine näitab fallback'i; ei märgita abi vaikimisi korraldatuks.

### E2 — ametlik turvateade ja juhi vastuvõtt

- Loo eraldi omaniku/organisatsiooni-skoobitud teade ning tingimuslik olekumasin.
- Lisa töötajale 1:1 eelvaade privaatsetest väljadest, mida ta ametlikku teatesse viib.
- Juht kinnitab vastuvõtu; võõras juht/organisatsioon saab fail-closed vastuse.

### E3 — järelabi ja kontrollpunkt

- Paku õigus-, psühholoogilise, supervisiooni, töökorraldusliku või muu toe valikuid
  capability-põhiselt.
- Järelabi ülesandel on vastutaja, tähtaeg ja vastuvõtt; toe sessiooni sisu ei lähe teatesse.
- Töötaja saab nähtava kontrollpunkti ja teavituse, mitte automaatse „lahendatud” oleku.

### E4 — privaatsusturvaline organisatsiooniõpe

- Taaskasuta olemasolevat aggregate/cell-suppression kihti ning lisa ainult ette määratud
  kategooriad, perioodid, piisav rühm, vajalik täiendav summutus ja puurimiseta vaade.
- Ära kuva vabateksti, täpset aega/kohta ega kombinatsiooni, mis võimaldab töötajat tuvastada.
- Kui lävi või õigusotsus puudub, jääb koond välja.

### E5 — ligipääsetavus ja käsitsi organisatsioonirada

- ET/EN/RU, lihtkeel, klaviatuur, ekraanilugeja, mobiil, offline/halb ühendus ja kiire fallback.
- Käsitsi töötaja/juhi/võõra rada: ohutusplaan, abi, teade, vastuvõtt, järelabi, tagasivõtmise
  piir ja privaatsisu mittelugemine.

## 7. Vastuvõtukriteeriumid ja DoD

Valmis koodiviil võimaldab töötajal teadlikult abi taotleda ja turvateate saata, volitatud juhil
vastuvõtu kinnitada ning järeltoe vastutajaga kokku leppida. Võõras roll ei näe sisu, juht ei
näe privaatset enesehoidu, check-in ei loo automaatset juhtumit ja taustajälgimist ei ole.
Koond jääb välja, kuni selle eraldi lävi ja summutus on kinnitatud.

Kontroll: lint, `git diff --check`, vajadusel `i18n:check` ja `prisma validate`, peatüki lõpus
build ning käsitsi sünteetiline organisatsioonirada. Automaatteste ega sonde ei looda ega
käivitata; kontrollimata käitumine jääb `NOT_PROVEN`.

## 8. Aktiveerimisväravad

- P-TJ-1: päris organisatsioonipiloot, turvaroll ja järeltoe omanik.
- Õ-TJ-1: ametliku teate alus, tööandja kohustus, töötaja õigused, retention ja kustutus.
- O-TJ-1: O-WB-K koondlävi, summutus ja välistatud mõõtmed.
- Feature flag jääb välja, kuni capability, partnerleping ja käsitsi rada on tõendatud.
