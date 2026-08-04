# COLLAB-P4 — võrgustikutöö esimene vertikaalne lõik: arendusleping

STATUS: väljastatud 04.08.2026. Leping ei muutu pärast väljastamist — muudatused
lähevad `SotsiaalAI.md`-sse.

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

Osapooled: klient · lähedased · vastutav sotsiaaltöötaja · teised KOV-i spetsialistid ·
teenuseosutajad · perearst või muu tervishoiukontakt · kool või lasteaed · Töötukassa ·
tugiorganisatsioonid.

Iga osapoole juures: roll · organisatsioon · kontakt · **kaasamise eesmärk** ·
**jagamispiir** · osalemise algus ja lõpp · viimane kontakt · kokkulepitud tegevus.

**Kaardistamise lõpp on kohustuslik väli** — „igaveseks vaikimisi" on keelatud. Sama reegel,
mis genogrammi/ökokaardi lepingus (T21).

## Otsused, mis on juba tehtud — ära küsi neid uuesti

- **`O-CW-7` on otsustatud:** võrgustikukaardistus on tavapraktika seadusest tuleneva
  ülesande peal; meedium ei loo uut töötlemist.
- **`O-CO-6` ei kehti P4-le** — kõik osalejad on kasutajad.
- **Teenuseosutaja näeb ainult talle jagatut** — kontaktisoovi, kokkuvõtet, dokumenti,
  ülesannet või ruumiarutelu. Mitte meetodipeeglit, tööheaolu, kliendi teekonda ega
  assistenti.

## Osad

| Osa | Sisu |
|---|---|
| **E1** | Võrgustikukaardi mudel + osapoole kirje koos jagamispiiri ja lõpukuupäevaga. Migratsioon additiivne. |
| **E2** | Kliendi kinnitusring: klient näeb TÄPSELT seda külmutatud väljavõtet, mis välja läheb, ja kinnitab või keeldub. Kinnitamata väljavõte ei liigu. |
| **E3** | Piiratud kutse osalejale (`participation.js` kutseseisundid) + kirjaliku ruumi avamine olemasoleva `roomAdapter`-i peal. |
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
