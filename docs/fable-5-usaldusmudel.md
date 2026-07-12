# Fable 5: SotsiaalAI platvormiülene usaldusmudel

Kuupäev: 12.07.2026  
Staatus: Fable 5 analüüs ja sõnastusettepanek; avalikud turvalisusväited vajavad enne kasutamist eraldi tõendamist  
Seotud dokumendid: [avastamata vajadused ja uued võimalused](./fable-5-avastamata-vajadused-ja-uued-voimalused.md), [organisatsioonikiht ja esimene piloot](./fable-5-lisavastused-organisatsioon-ja-piloot.md), [sõnum, slogan ja tulevikuvisioon](./sotsiaalai-sonum-slogan-ja-tulevikuvisioon.md)

## Küsimus

> Kuidas peaks kasutaja SotsiaalAI-s igal hetkel tajuma, et tema info, jagamised ja AI vastused on tema kontrolli all, ilma et usaldus piirduks ainult privaatsustingimuste või nõusolekunuppudega? Palun kujunda üks platvormiülene usaldusloogika, mis ühendab „Minu jagamised” vaate, jagamise parandamise ja lõpetamise, teavitused, kohtumise kokkuvõtte, selge keele režiimi, vastuse allikad, allika värskuse ning võimaluse teatada valest infost. Kirjelda, millist ühist kasutajaliidese mustrit ja minimaalset andmeloogikat peaksid kõik praegused ja tulevased funktsioonid järgima, et kasutaja näeks selgelt, mis on privaatne, mida on jagatud, kellele, kui kauaks, mida tegi AI ja mida kinnitas inimene. Vali lõpuks kaks või kolm esimest praktilist parandust, millega seda usaldusmudelit alustada.
>
> Lisaküsimus eraldi: kuidas ma saaksin võita usaldust ja mida öelda turvalisuse kohta — tegu on tundliku valdkonnaga?

## Fable 5 vastus

**Usaldusloogika põhiidee: usaldus ei ole leht, millega nõustutakse, vaid omadus, mida iga objekt kannab endaga kaasas.** Sul on haruldane lähtepositsioon — piirded on serveris päriselt jõustatud (selle sessiooni IDOR-testid tõendasid) ja andmemudelis on juba eristused `generatedDraft` / `userEditedDraft` / `userConfirmed` / `anonymityConfirmedAt`. Puudu on ühtne *tajukiht*, mis teeb jõustatud tegelikkuse igal hetkel nähtavaks. Teekonna kaardil on juba silt „Privaatne" — usaldusmudel ongi selle ühe sildi üldistamine kogu platvormile.

---

**Üks muster: valdusriba igal tööobjektil.** Iga objekt (vestlus, Teekond, mustand, pöördumine, ruum, kokkuvõte, kuulutus, kovisioonijuhtum, Tööheaolu kirje) kannab sama kolmeosalist riba:

```text
[ KES NÄEB ]   Privaatne · Jagatud: Mari (KOV Tartu) · Avalik kaardil · Anonüümne koond
[ PÄRITOLU ]   Sina kirjutasid · AI mustand (kinnitamata) · Sinu kinnitatud · Mari lisas
[ KEHTIVUS ]   kuni tagasivõtuni · aegub 24.07 · lõppenud 12.07
```

Sama komponent, samad sõnad, samad värvireeglid kõikjal — kasutaja ei pea kunagi mõistatama, mis režiimis ta parasjagu on. Küsitud funktsioonid asetuvad selle ümber nelja kihina:

1. **Enne jagamist — eelvaade on leping.** Ükski asi ei liigu ilma, et kasutaja näeks täpselt väljaminevaid välju, saajat ja kestust (shareKeys-muster on juba olemas; sellest saab kohustuslik reegel: *ei mingit jagamist ilma eelvaateta*).
2. **Jagamise ajal — kõik ühes kohas.** „Minu jagamised" on pearaamat: iga aktiivne jagamine on seal sama valdusribaga + tegevused (võta tagasi / paranda / lahku / lase aeguda). Andmereegel: iga funktsiooni jagamised peavad olema *loendatavad* — kui funktsioon ei suuda oma jagamisi nimekirjana esitada, ei ole ta valmis.
3. **Pärast — iga jagamine annab kviitungi.** Iga saatmine, vastuvõtt ja muutus tekitab sisuvaba sündmuse (U1 tabel) → teavitus + objekti ajajoon („saadetud 12.07 · vastu võetud 13.07 · kokkuvõte lisatud"). Kohtumise kokkuvõte on selle kihi kroon: inimene näeb kirjalikult, mida kokku lepiti, ja saab vastata „sain aru / mul on parandus".
4. **AI kiht — mustand, kuni inimene kinnitab.** AI väljund on visuaalselt eristuv (mustandiraam) kuni kinnituseni; AI ei muuda kunagi objekti valdusseisundit — privaatsest jagatuks liigutab ainult inimene. Iga vastuse allikakaart kannab värskust („allikas kontrollitud 05.2026" — `checkedAt` on andmetes olemas) ja vaikset lippu „teata veast". Selge keele režiim kuulub siia samasse: arusaamine *on* usaldusküsimus — mida inimene ei mõista, seda ta ei saa kontrollida.

**Minimaalne andmeloogika — neli küsimust, millele iga praegune ja tulevane tööobjekt peab andmetest vastama:** kes näeb? mida täpselt? kui kaua? kes kinnitas? Kui uus funktsioon ei suuda neile vastata, ei lähe ta välja. Enamik vastuseid on skeemis juba olemas (omanikuväljad, saajaviited, `sentAt`/`expiresAt`, kinnituslipud) — vaja on kokkuleppelist nimetamist ja kuvamist, mitte suurt migratsiooni. Ainsad päris lüngad: tagasivõtu ajatempel (`recalledAt`), sündmuste tabel (U1) ja allika värskuse kuvamine kasutajale.

**Kolm esimest praktilist sammu:**

1. **Valdusriba komponent + „Minu jagamised" (U12-lite).** Ainult olemasolevad andmed, üks jagatud komponent nelja objektitüübi peale (Teekond, pöördumine, ruum, kuulutus) + koondvaade profiilis. Kõige nähtavam muutus väikseima kuluga.
2. **Tagasivõtmine ja parandus (U3-lite).** Pearaamat ilma tegevusteta on vitriin — „võta tagasi enne avamist" + „saada parandus" teevad sõnast „kontroll" tegusõna.
3. **AI-mustandi visuaalne eristus + allika värskus ja „teata veast" (U8-lite).** Üks stiilireegel (mustandiraam kuni kinnituseni) + allikakaardile kuupäev ja lipp, mis esialgu kasvõi ainult logib admini järjekorda.

---

**Lisaküsimus: kuidas võita usaldust ja mida öelda turvalisuse kohta.**

Selles valdkonnas võidab usaldust see, kes räägib **kontrollitavatest omadustest, mitte lubadustest** — ja on aus piiride suhtes. Kolm kihti:

**1. Ütle asju, mida saab järele kontrollida.** Sinu koodis on päriselt olemas väited, mida enamik ei saa öelda: õiguskontroll toimub igal serveripäringul, mitte kasutajaliideses (testitud); Tööheaolu kirjeid ei näe isegi administraator; koondstatistika on k-anonüümne summutamisega; kõne salvestamine nõuab iga osaleja versioonitud nõusolekut; toorheli ei salvestata; logid sisaldavad pikkusi, mitte teksti; kustutamine on töövoog (DataDeletionJob), mitte lubadus; sisselogimine on PIN+e-posti kood+usaldusväärsed seadmed, ja „logi kõik seadmed välja" on olemas. Tee neist avalik **usalduse leht** lihtsas eesti keeles: mida me salvestame, mida me *kunagi* ei salvesta, kes mida näeb, kuidas kustutamine käib, mida AI tohib ja ei tohi. Ja avalda oma „mitte kunagi" nimekiri — *me ei ehita riskiskoore, me ei jälgi töötajaid, me ei müü andmeid, me ei loo STAR2 koopiat* — sest lubadus mitte teha on selles valdkonnas väärtuslikum kui lubadus teha.

**2. Ole aus selle suhtes, mis võib eksida.** „AI võib eksida — sellepärast on igal vastusel allikad, allika kuupäev ja veast teatamise nupp; otsuseid teeb alati inimene; ametlik register on STAR2, mitte meie." Ära ütle kunagi „100% turvaline" — ütle konkreetsed omadused + mis juhtub vea korral (kes vastutab, kuhu pöörduda, kuidas me teavitame). Enne laiemat käiku ütle avameelselt: „tellime sõltumatu turvaauditi" — ja tee seda; DPIA enne pilooti; leping KOV-iga fikseerib andmetöötleja rollid; nimeta, kus andmed füüsiliselt asuvad (EL/Eesti). Ausus piiride kohta on selles publikus usutavam kui täiuslikkuse retoorika.

**3. Usaldus liigub inimeste, mitte tehnoloogia kaudu.** Pöörduja usaldab platvormi siis, kui tema sotsiaaltöötaja seda usaldab; sotsiaaltöötaja usaldab siis, kui ESTA ja kolleegid on selle sisult üle vaadanud. Sellepärast on õige järjekord: võida spetsialistid (piloot, ESTA metoodikaülevaatus, avatud juhendipõhine kovisioon) ja lase neil olla sild. Ja hoia läbipaistvuse harjumust: avalik muudatuste logi, intsidentide aus kommunikatsioon, nimeline inimene kontaktiks — mitte anonüümne tugi.

Kui see ühte lausesse suruda, siis su turvalubadus kõlab nii: **„Sina näed alati, kes su infot näeb, sa saad iga jagamise tagasi võtta, AI teeb ainult mustandeid ja meie ei salvesta midagi, mida sa pole teadlikult andnud — ja kõike seda saab kontrollida, mitte ainult uskuda."**

---

## Kontrollmärkus enne avalikku kasutamist

Vastuses on läbivalt eristatud hea tootesuund ja praegune kood, kuid avalikus turvalisussõnumis tuleb neid veel täpsemalt lahus hoida.

### Aktiivse platvormi põhjal toetatud suund

- valitud põhivoogudes on serveripoolsed omaniku-, osaleja- ja rollipiirded;
- jagamise eelvaate, kasutaja kinnituse, anonüümsuse kinnituse ja salvestusnõusoleku mustrid on koodis olemas;
- Tööheaolu koondis kasutatakse väikeste gruppide summutamist;
- STT marsruut ei kirjuta toorheli kettale ning selle logimine on piiratud;
- andmete kustutamiseks ja säilitamiseks on tehniline töövoog olemas.

Need väited tuleb avalikus tekstis siduda täpse ulatusega. Näiteks „valitud põhivoogudes kontrollitud serveripoolsed ligipääsupiirid” on täpsem kui „õiguskontroll toimub igal serveripäringul”.

### Kavandatud, kuid veel mitte läbivalt valmis

- ühtne valdusriba kõigil tööobjektidel;
- „Minu jagamised” koondvaade;
- saadetud pöördumise tagasivõtmine ja parandamine;
- jagamiskviitungid ning terviklik sündmuste ajajoon;
- allika värskuse läbiv kuvamine;
- allikaveast teatamise töövoog;
- AI-mustandi ühtne visuaalne eristus kõigis funktsioonides.

Neid võib kirjeldada visiooni või arendusplaanina, mitte tänase valmis võimekusena.

### Väited, mis vajavad enne avaldamist eraldi kontrolli või kokkulepet

- millisele sisule administraator tehniliselt ja töökorralduslikult ligi pääseb;
- millised logid võivad sisaldada teksti, metaandmeid või tehnilisi identifikaatoreid;
- andmete täieliku kustutamise ulatus, varukoopiad ja säilitustähtajad;
- väliste AI-, STT-, TTS-, e-posti ja kõneteenuste andmetöötlus ning säilitamine;
- andmete füüsiline ja õiguslik asukoht;
- sõltumatu turvakontrolli ja andmekaitsemõjude hindamise tulemused;
- väide, et andmeid ei müüda — see peab olema kinnitatud ärimudelis, lepingutes ja privaatsustingimustes.

### Turvalubaduse täpsem praegune sõnastus

Enne valdusriba, „Minu jagamiste”, tagasivõtmise ja allikate tagasisideringi valmimist sobib avalikuks lähtekohaks näiteks:

> **SotsiaalAI näitab enne jagamist, milline info liigub ja kellele, ning küsib tundlike toimingute jaoks inimese kinnitust. Vastused seotakse allikatega ja AI koostatud tekst jääb inimese ülevaatamiseks. Ligipääse piiratakse serveris kasutaja rolli, omandi ja osaluse järgi. Me kirjeldame läbipaistvalt, milliseid andmeid töödeldakse, ning täpsustame enne pilooti väliste teenuste, säilitamise ja kustutamise tingimused.**

Tuleviku sihtlubadus võib olla tugevam, kuid seda tuleb esitada selgelt eesmärgina:

> **Meie eesmärk on, et näeksid alati, kes sinu infot näeb, mida oled jaganud, millal ligipääs lõpeb ning milliseid samme tegi AI ja millised kinnitas inimene.**

