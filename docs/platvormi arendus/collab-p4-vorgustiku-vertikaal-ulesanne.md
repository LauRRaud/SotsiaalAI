# COLLAB-P4 — võrgustikutöö esimene vertikaalne lõik: arendusleping

STATUS: **MUSTAND 04.08.2026 — ootab omaniku kinnitust.** Alles kinnitamise hetkel muutub ta
väljastatud lepinguks, mis enam ei muutu (S11). Seni tohib teda muuta.

Koostatud `SotsiaalAI.md` S4.1 + `ideed.md` ptk 5 + koodist kontrollitud K1 aluse peale.

## Miks see on lahti ja miks ta ei ole blokeeritud

Võrgustikutöö on koodis alusena olemas (P0–P2), aga **vertikaali ei ole**: ükski päris lugu
ei jookse otsast lõpuni läbi. P5 (mittekasutajate kirjed) ootab `O-CO-6` GDPR-analüüsi ja
P6 (kohtumise ühisvaade) ootab `O-CO-2`. **P4 ei oota kumbagi**, sest selle lõigu kõik
osalejad on platvormi kasutajad — mittekasutaja õigusküsimust siin ei teki.

## Mis on ALUSENA juba olemas (kontrollitud koodist 04.08)

Ära ehita neid uuesti. K1 tööruumileping (`lib/workspaces/`) annab:

**Jagamisklassid** (`sharing.js`, `SharingObjectClass`) — 10 klassi: `PERSONAL_NOTE` (1) ·
`SPECIALIST_PRIVATE_NOTE` (2) · `SHARED_FACT` (3) · `PERSON_OWN_INPUT` (4) ·
`THIRD_PARTY_INFO` (5) · `MEETING_AGENDA` (6) · `DECISION` (7) · `TASK` (8) ·
`CONFIRMED_SUMMARY` (9) · `EXPORTED_ARTIFACT` (10).

> **Klassid 1–2 EI ole jagatavad.** Nende jagamiskuju on ALATI eraldi külmutatud väljavõte
> (klass 4 või 9), mitte originaal. See on juba lepinguline ja testiga lukus — P4 peab seda
> kasutama, mitte kordama.

**Kehtivus** (`SharingValidityKind`): `WORKSPACE_LIFETIME` · `UNTIL_REVOKED` · `UNTIL_DATE` ·
`PERMANENT` · `EXTERNAL`. **Tagasivõetavus**: enne avamist `RECALL`/`NONE`, pärast avamist
`CORRECTION`/`SUPERSEDE`/`NONE`.

**Osalejakiht** (`participation.js`): rollid `OWNER` · `RESPONSIBLE` · `MODERATOR` ·
`MEMBER` · `OBSERVER` · `REVIEWER`; liikmelisus `INVITED` · `ACTIVE` · `LEFT` · `REMOVED` ·
`WITHDRAWN`; kutse `PENDING` · `ACCEPTED` · `DECLINED` · `EXPIRED` · `REVOKED`; suhe
`COLLEAGUE` · `CLIENT`.

**12 adapterit** (`lib/workspaces/adapters/`), sh `preInquiryReceiverAdapter`, `roomAdapter`,
`roomParticipationAdapter`, `caseArtifactAdapter`, `journeyAdapter`.

**Päritolusõnastik** (`lib/workspaces/provenance.js`) — uut ei leiutata.

**U1 sündmusekiht** — NB teadaolev saba (S4.2 nr 12): `lib/events/recipients.js` tunneb
ainult `OWNER`/`AUTHOR`/`RECIPIENT_OWNER`. **Mitme osalejaga võrgustik nõuab selle
laiendamist** — see saba tuleb P4-ga koos ette ja kuulub selle lepingu sisse.

## Vertikaali rada — väikseim asi, mis päriselt töötab

```
eelpöördumine või kohtumise tulemus
  → töötaja kaardistab vajaliku võrgustiku
  → KLIENT NÄEB JA KINNITAB, mida jagatakse
  → töötaja leiab teenusekaardilt osutaja
  → valitud osapoolele läheb PIIRATUD kutse
  → avaneb kirjalik ruum
  → osaleja näeb AINULT talle jagatud kokkuvõtet
  → töötaja kontrollib tulemuse
  → ametlik osa dokumenteeritakse STAR2-s (käsitsi, mitte liidesega)
```

## Kolm taset, mida ei tohi kokku valada

| Tase | Kes näeb |
|---|---|
| 1. privaatne juhtumiinfo | ainult volitatud juhtumitöötaja |
| 2. võrgustikuga jagatud kokkuvõte | ainult see võrgustik |
| 3. osalejaga seotud ülesanne | osaleja ja koordinaator |

**Võrgustikku kutsumine ei anna ligipääsu juhtumile.** Vestlusruumi liikmelisus ei ava
juhtumitöö assistenti, meetodipeeglit, kliendi teekonda ega STAR2 toimikut. See peab olema
serveris jõustatud ja IDOR-testiga tõendatud — samamoodi nagu ülejäänud privaatsuspiirid.

## Võrgustikukaardi kirje

**Võrgustikul endal on eesmärk** (`ideed.md` 5.1) — miks see võrgustik kokku pandi. Ilma
selleta on kaart nimekiri, mitte töövahend, ja keegi ei oska hiljem öelda, millal ta oma
töö ära tegi. Sinna juurde käib **järgmine kohtumine või kontrollpunkt**.

Osapooled: klient · lähedased · vastutav sotsiaaltöötaja · teised KOV-i spetsialistid ·
teenuseosutajad · perearst või muu tervishoiukontakt (vt piir allpool) · kool või lasteaed ·
Töötukassa · tugiorganisatsioonid · **muud olulised inimesed**.

Iga osapoole juures: roll · organisatsioon · kontakt · **kaasamise eesmärk** ·
**jagamispiir** · osalemise algus ja lõpp · viimane kontakt · kokkulepitud tegevus.

**Kaardistamise lõpp on kohustuslik väli** — „igaveseks vaikimisi" on keelatud. Sama reegel,
mis genogrammi/ökokaardi lepingus (T21).

## Assistendi abi võrgustiku kokkupanemisel (`ideed.md` 5.4)

Assistent ei tee ühtegi otsust, aga võib ette valmistada: olemasoleva võrgustiku
kaardistamine · **puuduva rolli või teenuse märkamine** · teenuseosutajate otsimine
teenusekaardilt · kontaktisoovi või eelpöördumise ettevalmistus · kliendilt küsimine, mida
tohib jagada · piiratud jagatava kokkuvõtte koostamine · osapoole kutsumine ruumi ·
kokkulepete ettevalmistus STAR2-sse dokumenteerimiseks.

**„Puuduva rolli märkamine" on selle lõigu kõige omanäolisem osa** — võrgustikukaart, mis
oskab öelda „siin loos ei ole kedagi, kes kannaks eluaseme teemat", teeb midagi, mida
paberil kaardistus ei tee. Ta pakub kaalumiseks, ei täida ise.

## Perearst ja tervishoiukontakt — P4-st VÄLJAS (`ideed.md` 5.7)

`ideed.md` näeb perearsti **piiratud välise võrgustikuliikmena** ja loetleb MVP-s:
kontaktivajaduse märkimine · kliendi kinnitatud küsimuste ettevalmistus · turvalise
kontaktisoovi koostamine · võrgustikukohtumise kutse · piiratud häälruumis osalemine.

Kõva piir jääb kehtima: **SotsiaalAI ei loe Terviseportaali, ei hoia ravilugu, ei kuva
diagnoose, ei soovita ravi ega muutu perearsti dokumenteerimiskeskkonnaks.**

**Aga P4-s teda ei ole.** Põhjus on P4 enda värav: P4 on lahti just sellepärast, et kõik
osalejad on platvormi kasutajad. Perearst „välise liikmena" on definitsiooni järgi see, kes
ei pruugi kasutaja olla — ja terviseandmed on eriliiki isikuandmed. See on `O-CO-6`
territoorium ja kuulub P5-i. Kui konkreetne perearst ON platvormi kasutaja, mahub ta P4-de
tavaosalejana, ilma ühegi terviseandmeta.

## Otsused, mis on juba tehtud — ära küsi neid uuesti

- **`O-CW-7` on otsustatud:** võrgustikukaardistus on tavapraktika seadusest tuleneva
  ülesande peal; meedium ei loo uut töötlemist.
- **`O-CO-6` on lepinguline värav, mitte õiguslik sein** (omanik 04.08). Mittekasutaja
  isikuandmeid tohib käidelda, kui raamleping on allkirjastatud nii sotsiaaltöö
  spetsialisti kui teenuseosutajaga. Masinavärk on olemas: `FrameworkAcceptance` +
  `WORKER_DATA_PROCESSING`, mida `isWorkerEligible` lubab **mõlemal** rollil
  (`SOCIAL_WORKER`, `SERVICE_PROVIDER`). Vt `SotsiaalAI.md` S4.1. **P4 ei kasuta seda
  rada** — P4 jääb kasutajate peale, mittekasutajate värav on P5.

## AUDITI LEIUD 04.08 — mustandit ei tohi selle kujuga kinnitada

Sõltumatu audit (Codex) leidis, et kolm siinset väidet ei pea paika ja skoop on liiga lai.

| # | Leid |
|---|---|
| **1** | **„Klassid 1–2 on testiga lukus" oli LIIGA TUGEV VÄIDE.** Validaator keelab nende otsese jagamise, aga **ei võrdle** `frozen`, `validity` ega `revocable` väärtusi klassilepingu tabeliga — `CONFIRMED_SUMMARY` võttis vastu `frozen:false` ja vale tagasivõtureegli. Enforcement tuleb P4-l ise ehitada. |
| **2** | **„Kõik osalejad on kasutajad" ei pea.** `participation.js` lubab `userId: null`, kui identiteet elab kutses, ja `roomParticipationAdapter` loobki e-posti kutsele sellise kirje. Lisaks: **E1 võrgustikukaart ise loob mittekasutajate kirjeid** (lähedased, kool, „muud olulised inimesed") juba enne kutsumist. |
| **3** | **`THIRD_PARTY_INFO` on koodis juba `blockedByDecision: "O-CO-6"`** (`sharing.js`). Lepingu autor luges sellest failist read 9–48 ja jäi 20 rida enne vastutõendit seisma. |
| **4** | **„12 adapterit" on failiarvuna tõene, võimekusena eksitav** — need on peamiselt kirjutuskaitstud projektsioonid. `roomAdapter` ainult loeb liikmesusi, ta **ei ava ruumi ega loo kutset**. `network_case` on `registry.js`-s `RESERVED`. |
| **5** | **E5 ei ole väike audience-lisa.** `lib/events/recipients.js` on praegu sisuliselt `PreInquiry`-põhine → tegemist on uue horisontaalse sündmusearhitektuuriga. |
| **6** | **E1–E6 ei ole üks vertikaal, vaid vähemalt kuus tööriista** (andmemudel · puuduva rolli märkaja · külmutatud jagamise töövoog · kutse+ruum · sündmuste adressaadikiht · STAR2 rada). DoD lõpeb osaleja vastusega, aga E5 ja E6 väidetavalt kuuluvad samasse lõiku; E1b, E5 ja E6 jaoks vastuvõtukriteeriume ei ole. |

### Kitsam esimene vertikaal, mida audit soovitab

Üks olemasoleva kontoga klient + üks olemasoleva kontoga teenuseosutaja + üks konkreetne
eelpöördumine + üks kliendi kinnitatud külmutatud kokkuvõte + tekstiruum + osaleja vastus.

**Välja jäävad:** vaba võrgustikukaart · mittekasutajad · tervishoid · hääl · puuduva rolli
märkaja · üldise sündmusekihi laiendus. Need lisanduvad eraldi tööriistadena pärast seda, kui
esimene rada on serveripoolselt ja negatiivsete testidega tõendatud.

**Negatiivsed testid, mis peavad olema:** vabatekstilise lähedase salvestamine keelatud ·
kontaktisiku e-post/telefon keelatud · `userId: null` rada suletud · e-posti kutse keelatud.
- **Teenuseosutaja näeb ainult talle jagatut** — kontaktisoovi, kokkuvõtet, dokumenti,
  ülesannet või ruumiarutelu. Mitte meetodipeeglit, tööheaolu, kliendi teekonda ega
  assistenti.

## Teostuse seis

| Osa | Seis |
|---|---|
| **V1 — kitsas vertikaali tuum** (`lib/network/share.js`, `NetworkShare` mudel + migratsioon) | **TEHTUD 04.08** |
| **V2a — ruumi avamine** (`lib/network/shareRoom.js`, `ROOM_ORIGIN_TYPES.NETWORK_SHARE`) | **TEHTUD 04.08** |
| V2b — API-marsruudid | tegemata |
| V3 — töötaja ja kliendi liides | tegemata |
| V4 — saaja vaade ja vastamine | tegemata |
| V5 — „Minu jagamised" haakumine | tegemata |

### V1 — mis on tehtud

Auditi soovitatud kitsas rada on koodis: üks eelpöördumine → töötaja koostab külmutatud
kokkuvõtte **ühele olemasoleva kontoga saajale** → **klient kinnitab** → saatmine avab ruumi
→ saaja näeb ainult talle jagatut → tagasivõtmine ainult enne avamist.

Kolm asja on **arhitektuur, mitte poliitika**, ja igaühel on oma test:

1. **`recipientUserId` on kohustuslik FK olemasolevale kasutajale.** E-posti kutset ega
   `userId: null` rada siin ei ole → lõik jääb O-CO-6-st väljas. Kontroll on serveris.
2. **Kinnitamata jagamist ei saa saata ühegi rajaga.** `AWAITING_CLIENT` on eraldi olek,
   mitte lipp; töötaja ei saa kliendi eest kinnitada.
3. **Kokkuvõte külmub kinnitamisel.** Teksti muutmine pärast kinnitust viib jagamise tagasi
   mustandisse ja kustutab kinnituse — muidu saaks kinnituse alt teksti välja vahetada.

`recipientProjection()` on ehitatud **valgest nimekirjast**, mitte kustutamise teel: uus veerg
mudelis ei leki saajani iseenesest. Test kontrollib välja-välja ja lisaks seda, et
serialiseeritud vaates ei esine lähteallika ega osapoolte identiteete.

**Väljas hoitud teadlikult** (auditi soovitus): vaba võrgustikukaart · mittekasutajad ·
tervishoid · hääl · puuduva rolli märkaja · üldise sündmusekihi laiendus.

### LAHTINE TOOTEOTSUS — kas klient on ruumi liige?

Ruum avaneb praegu **kahe liikmega: töötaja (omanik) ja saaja**. Klient ei ole liige — ta
kinnitas *kokkuvõtte*, mitte kogu edasise erialase arutelu, ja vaikiv kaasamine tähendaks,
et ta loeb vestlust, millega ta ei nõustunud.

**Vastuargument on sama kaalukas:** „mitte midagi minu kohta ilma minuta" on platvormi
tuumlubadus, ja klient, kes ei näe, mida tema loo ümber räägitakse, on täpselt see olukord,
mille vastu SotsiaalAI ehitatud on.

Valitud on kitsam variant ühel praktilisel põhjusel: **liikme lisamine on hiljem lihtne,
eemaldamine mitte.** Otsus vajab omaniku sõna.

Ruumi pealkirja, kirjeldusse ega metaandmetesse **ei panda jagatud kokkuvõtte teksti** —
ruumi metaandmed on nähtavad laiemalt kui jagatud sisu. Testiga lukus.

## Osad

| Osa | Sisu |
|---|---|
| **E1** | Võrgustikukaardi mudel: võrgustiku **eesmärk**, järgmine kontrollpunkt, ja osapoole kirje koos jagamispiiri ja lõpukuupäevaga. Migratsioon additiivne. |
| **E1b** | Puuduva rolli märkaja: kaart võrdleb olemasolevaid rolle loo teemadega ja **pakub kaalumiseks** puuduvat rolli või teenust. Ei täida ise, ei otsusta. |
| **E2** | Kliendi kinnitusring: klient näeb TÄPSELT seda külmutatud väljavõtet, mis välja läheb, ja kinnitab või keeldub. Kinnitamata väljavõte ei liigu. |
| **E3** | Piiratud kutse osalejale (`participation.js` kutseseisundid) + ruumi avamine olemasoleva `roomAdapter`-i peal. `ideed.md` 5.3 lubab ruumi olla **kirjalik või häälpõhine** — helikõne on ruumides juba olemas (S7), seega häälvariant on lüliti, mitte uus ehitus. Vaikimisi kirjalik. |
| **E4** | Osaleja vaade: ainult talle jagatu. Server jõustab, IDOR-test tõendab. |
| **E5** | U1 audience-reegli laiendus mitmele osalejale (`lib/events/recipients.js`) — S4.2 nr 12 saba sulgub siin. |
| **E6** | Töötaja tulemuse kontroll + „STAR2-sse kandmiseks kopeeri" (MITTE „saada STAR2-sse"). |

## DoD

- [ ] Üks päris lugu jookseb eelpöördumisest osaleja vastuseni läbi, ilma käsitsi
      andmebaasi puutumata.
- [ ] IDOR-test: võrgustiku osaleja ei näe juhtumit, teekonda, meetodipeeglit ega tööheaolu.
- [ ] Klassid 1–2 ei lahku kunagi originaalina — testiga lukus.
- [ ] Iga jagamine on nähtav vaates „Minu jagamised" ja tagasivõetav vastavalt klassi
      lepingule.
- [ ] Kaardistamise lõppkuupäev on kohustuslik — tühjaks jätmine ei ole võimalik.
- [ ] `npm test`, `i18n:check`, eslint rohelised; skeemimuudatusel `db:migrate:check`.
- [ ] Tekstid kolmes keeles.
