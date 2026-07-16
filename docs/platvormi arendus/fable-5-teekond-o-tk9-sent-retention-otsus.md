# O-TK9: SENT-eelpöördumise säilitamine autori konto kustutamisel — otsustuspakett

Kuupäev: 2026-07-16
Koostaja: Fable 5 (koordinaatori handoff'i rea „Teekond O-TK9" järgi)
Otsustaja: tooteomanik
Iseloom: **kitsas otsustusleht, mitte analüüs ega koodipakett.** Rakenduskoodi, skeemi ega migratsioone ei muudetud; commit'e, merge'e ega deploy'd ei tehtud.

Lähtedokumendid: `fable-5-teekond-eelpoordumine-ux-ja-navigeerimine.md` ptk 15.2–15.6 (runtime-tõendid ja TK-P0 leping), ideed.md §11.8 (õiguslik piir), `koordinaatori-handoff-2026-07-16.md` (tööjärjekord ja tõeallika reegel).

**Git-seisu kontroll (read-only, 16.07.2026):** lokaalne `main` @ 890124bd; `origin/main` @ 2a63fcd0 on 4 commit'i ees, kõik neli on RAG-P8.0 inventuur+audit+2 merge'i; `git diff main origin/main -- prisma/schema.prisma lib/preInquiries.js lib/privacy/` on **tühi**. O-TK9 pinnafailide viimased muudatused on ajaloolised (userDeletion.js @ cb914cee, preInquiries.js @ 7f20d7ce). Järeldus: ptk 15.2 runtime-tõendid kehtivad nii lokaalse kui GitHubi main-i kohta muutmata kujul — kordamiseks põhjust ei ole. Töötööpuu määrdunud failid (komponendid, RV-P0) ei puuduta kustutus-/retention-pinda.

## 1. Kinnitatud tänane käitumine ja andmekadu

Runtime-tõendatud sünteetiliste kasutajatega (ptk 15.2, kõik testandmed koristatud):

- **Autori konto kustutamisel** kustub privaatne Journey-originaal täielikult (õige) JA kaskaad hävitab **kõik autori eelpöördumised, ka adressaadile juba kohale toimetatud SENT-kirjad** — koos külmutatud väljavõttega (`assessmentState.sharedJourneyInfo`) ja **adressaadi enda töömärkmetega** (`receiverNote`, `receiverChecklist`, `nextContactOn` elavad samal real). Alus: `PreInquiry.author … onDelete: Cascade` (schema:1891); kustutusteenus (lib/privacy/userDeletion.js) ei tee eelpöördumistega midagi — kõik käib skeemikaskaadiga. **See on leid L4 (P1).**
- **Adressaadi konto kustutamisel** jääb kiri autorile (`recipientOwner … SetNull`, schema:1892), kuid kustutatud adressaadi kirjutatud `receiverNote` **jääb autori kirje külge nähtamatu orvuna** DB-sse (serializer ei näita seda enam kellelegi). **See on leid L5 (P2)** — hügieeniparandus, mitte tooteotsus.
- Kontekst, mis teeb L4-st otsustuskoha: (a) ideed.md §11.8 ütleb, et KOV-ile saadetud eelpöördumine on „vähemalt dokumenteeritav kontakt" ja täpne menetluslik staatus tuleb partner-KOV-iga lukustada; (b) **kanali-asümmeetria**: EXTERNAL_EMAIL kanalis jääb adressaadile e-kirja koopia igaveseks väljaspool platvormi — praegune INTERNAL-kanal on adressaadi jaoks NÕRGEM kui tavaline e-post; (c) adressaat saab juba täna eelinfo alla laadida (WorkspaceFeaturePage „Laadi eelinfo alla"), kuid see eeldab ettenägelikkust enne autori kustutust; (d) privaatsuspoliitika §7.7 (messages/et.json:382) lubab paindlikult „aktiivsed kasutajaandmed eemaldatakse rakenduse kustutusloogika kohaselt" — ükski avalik lubadus ei fikseeri kummagi suuna käitumist täpselt.

## 2. Variandid

### Variant A — täielik privaatsus-esimene kustutamine (tänane käitumine, teadlikuks tehtud)

Autori kustutus kustutab kõik tema pöördumised, ka SENT; adressaat kaotab kirja JA oma märkmed. Muudatus koodis: mitte midagi (ainult otsuse fikseerimine + privaatsusteksti täpsustus + L5 D-plokk TK-P0-s).

### Variant B — anonüümitud minimaalse kandja säilitamine adressaadile (Fable'i soovitus)

Autori kustutusel **kohale toimetatud** (`sentAt ≠ null`) kirjad EI kustu, vaid **anonüümitakse miinimumkandjaks**; kõik saatmata/mustand-kirjad kustuvad nagu praegu.

Miinimumkandja täpne piir (väli väljalt):

| Säilib (adressaadi pool + faktikiht) | Kustub / asendatakse (autori sisu) |
|---|---|
| rea olemasolu; `recipientOwnerId`, `recipientEntryId`, `recipientType`, `deliveryChannel`, `selectedRecipientName/Email` (adressaadi enda andmed) | `authorId` → NULL (+ uus `authorErasedAt` ajatempel) |
| `status`, `sentAt`, `openedAt`, `recalledAt`, `supersededById`, `createdAt/updatedAt` | `topic` → NULL (UI kuvab i18n-placeholderi „Kustutatud kasutaja pöördumine") |
| **adressaadi töömärkmed:** `receiverNote`, `receiverChecklist`, `nextContactOn` | `situation` → tühi; `assessmentState` → NULL (sh külmutatud Teekonna-väljavõte); `generatedDraft`/`userEditedDraft` → NULL |

Loogika: faktikiht („kes-kunagi-mis-staatuses") + adressaadi ENDA loodud sisu säilivad; kogu autori sisu (sh Teekonnast kinnitatud väljavõte) kustub. `sourceJourneyId` on Journey kaskaadi järel nagunii NULL.

### Variant C — adressaadi omandis eraldatud koopia (delivered-mail mudel)

Saatmise hetkel tekib **adressaadi omandis** külmutatud koopia (eraldi tabel/kirje), mis elab ja sureb ADRESSAADI kontoga; autori rida jääb autori omaks ja kustub tema kustutusel tervikuna. Adressaadi märkmed elavad tema koopial → L5 kaob struktuurselt. See on arhitektuuriliselt sama muster, mis ptk 14.7 „üks külmutus, üks kandja" siht.

### Kaalutud ja kõrvale jäetud: ajapõhine retention-aken

„SENT säilib N päeva pärast kustutust, siis kustub" — lisab taimeri ja kolmanda oleku, lahendamata omandiküsimust; adressaadi töömärkmete saatus jääks ikkagi juhuslikuks. Ei ole variant.

## 3. Mõjuvõrdlus

| Mõõde | A: kustub kõik | B: anonüümitud kandja | C: adressaadi koopia |
|---|---|---|---|
| **Autor** | maksimaalne kustutamisõigus: mitte midagi ei jää | sisu kustub täielikult; jääb anonüümne fakt, et pöördumine oli (autorile tagasi viimatu) | autori pool kustub; adressaadil on täiskoopia — autori sisu ELAB EDASI teise omandis (nagu e-post) |
| **Adressaat ja tema töömärkmed** | kaotab kirja JA oma märkmed ilma hoiatuseta (runtime-tõendatud); tööjärg katkeb vaikselt | säilitab fakti, staatuse ja OMA märkmed; sisu peab vajadusel enne alla laadima (võimalus on täna olemas) | säilitab kõik, sh sisu — tugevaim vastuvõtja-lugu, võrdne e-posti kanaliga |
| **Privaatsus ja minimaalsus** | maksimaalne autori privaatsus; adressaadi enda loodud andmete (märkmete) hävitamine teise isiku toiminguga on ise problemaatiline | tasakaal: autori sisu kaob; faktikiht on töötlemise metaandmed (§11.8 õigustatud huvi); adressaadi märkmed on tema enda andmed | autori kustutamisõigus nõrgim: sisu säilib adressaadi õigustatud huvi alusel; vajab selget teavitust saatmisel („adressaadile jääb koopia") |
| **Audit / eksport / kustutamislubadus** | vastab §7.7 kõige rangemale lugemisele; „dokumenteeritav kontakt" (§11.8) kaob — KOV-i vaates halvim; eksport = ainult kui adressaat ise enne salvestas | vajab §7.7 ühe lause täpsustust („kohale toimetatud pöördumisest jääb adressaadile fakt ja tema märkmed"); DataDeletionJob saab anonüümimis-kirje; auditijälg paraneb | vajab §7.7 ja saatmiseelvaate teksti muudatust („adressaat saab koopia, mis jääb talle alles"); lubadus on selgeim, aga kõige kaugem tänasest |
| **L5 D-plokk (TK-P0-s)** | vajalik muutmata kujul (adressaadi kustutusel nullitakse tema märkmed autori kirjel) | vajalik muutmata kujul — sama D-plokk | muutub tarbetuks (märkmed elavad adressaadi koopial); kui valitakse C, tuleb D-plokk TK-P0-st VÄLJA jätta ja lahendada TK-R1-s |
| **Skeem / migratsioon / retention-pakett** | 0 migratsiooni; TK-R1 = ainult privaatsusteksti täpsustus | **1 väike migratsioon** (`authorId String?` + relatsioon SetNull-käitumisele + `authorErasedAt DateTime?`) + kustutusteenusesse üks `updateMany` enne `user.delete`'i + serializeri placeholder; keskmine töö | uus tabel/omandimudel + saatmisraja muudatus + topeltkirje elutsükkel; suurim töö, puudutab saatmise kuuma rada |

## 4. Fable'i soovitatud vaikevariant: **B**

Põhjendus:

1. **Kaotab mõlemad tõendatud kahjud korraga:** adressaadi töömärkmed ja dokumenteeritav kontakt (§11.8) säilivad; autori sisu (sh Teekonna väljavõte) kustub täielikult — kustutamisõiguse tuum jääb puutumata.
2. **Kõrvaldab kanali-asümmeetria mõistlikult:** INTERNAL ei jää e-postist nõrgemaks (fakt+märkmed püsivad), aga ei muutu ka e-postist tugevamaks sisusäilitajaks (sisu ei jää, erinevalt C-st).
3. **Väikseim otsusega proportsionaalne töö:** üks väike migratsioon + üks updateMany + placeholder; ei puuduta saatmise kuuma rada ega TK-P0 jagamispiiri. C nõuaks uut omandimudelit — see on õigustatud alles siis, kui ptk 14.7 külmutus-arhitektuur (TK-P4) niikuinii ehitatakse; B ei välista hilisemat C-d.
4. **Õiguslik ettevaatus:** §11.8 järgi tuleb eelpöördumise menetluslik staatus partner-KOV-iga enne pilooti lukustada — faktikihi säilimine (B) on ainus variant, mis ei tee seda läbirääkimist juba ette võimatuks (A kaotaks tõendi) ega liiga jäigaks (C fikseeriks täissisu säilimise).

Ausalt B vastu: autor võib eeldada, et „kustutasin konto = kõik kadus"; B jätab temast anonüümse jälje adressaadi loendisse. Leevendus: konto kustutamise kinnitusdialoogi lisatakse üks selgitav lause (vt TK-R1 kriteeriumid) ja §7.7 täpsustatakse — lubadus ja käitumine jäävad kooskõlla.

## 5. Tooteomaniku otsus (üks küsimus)

> **O-TK9: Kui autor kustutab oma konto — mis saab adressaadile juba kohale toimetatud (`sentAt ≠ null`) eelpöördumisest?**
>
> - **A.** Kustub kõik, ka adressaadi märkmed (tänane käitumine kinnitatakse teadlikuks; privaatsustekst täpsustatakse vastavalt).
> - **B. (soovitatud)** Sisu kustub; adressaadile jääb anonüümitud fakt + tema enda töömärkmed (ptk 2 tabeli täpne piir).
> - **C.** Adressaadile jääb saatmisel külmutatud täiskoopia tema omandis; autori pool kustub.

Rohkem küsimusi selle otsuse alla EI kuulu: saatmata mustandid kustuvad alati (kõik variandid); L5 orvu-parandus tehakse alati (A/B: TK-P0 D-plokis; C: TK-R1-s); DRAFT/READY-eelsete olekute käitumine ei muutu. **Kui otsust ei tehta, kehtib A** (praegune kood) — koos teadmata jäänud riskiga, et adressaatide töö kaob vaikselt edasi.

## 6. Pärast otsust avanev koodipakett TK-R1 (Sol/Codex) — piirid ja vastuvõtukriteeriumid

Üldpiirid (kõik variandid): eraldi värske worktree/haru `origin/main`-ist; EI puuduta TK-P0 jagamispiiri koodi (allowlist/manifest), `serializePreInquiry` vaatajaloogikat (peale autori-placeholderi), vastuvõtja UI ülesehitust, EXTERNAL_EMAIL kanalit ega retention-taimereid; sõltumatu audit (Opus) enne merge'i; ei jookse paralleelselt TK-P0 teostusega (koordinaatori üks-pakett-korraga reegel).

**Kui valitakse A:** koodimuudatust ei ole. Pakett = privaatsuspoliitika §7.7 ja konto-kustutuse kinnitusdialoogi teksti täpsustus („kustutamisel kaovad ka sinu saadetud pöördumised adressaatide vaatest koos nende märkmetega") + 15.5 testid 9–11 fikseerivad käitumise. TK-P0 D-plokk jääb muutmata.

**Kui valitakse B (soovitus), TK-R1 sisu:**
1. Migratsioon (täpselt üks): `PreInquiry.authorId String?`; relatsioon `PreInquiryAuthor` → `onDelete: SetNull` EI sobi üksi (see nullib ka mustandid) — õige mehhanism on teenusepoolne transform: kustutusteenusesse (lib/privacy/userDeletion.js, enne `user.delete`'i) `updateMany({where: {authorId: uid, sentAt: {not: null}}, data: {authorId: null, authorErasedAt: now, topic: null, situation: "", assessmentState: DbNull, generatedDraft: null, userEditedDraft: null}})`; ülejäänud (saatmata) read kustuvad kaskaadiga nagu praegu. Uus veerg `authorErasedAt DateTime?`.
2. Serializer/UI: `author: null` + `authorErasedAt` → adressaadi loendis/detailis i18n-placeholder „Kustutatud kasutaja" (ET/EN/RU); U3 parandus/tagasivõtt on autorita kirjel loomulikult võimatu (nupud peidetud).
3. DataDeletionJob: anonüümitud ridade arv logitakse kustutustöö metasse (sisu ei logita).
4. Tekstid: privaatsuspoliitika §7.7 üks lisalause + konto-kustutuse kinnitusdialoogi üks lause (tooteomanik kinnitab sõnastuse enne merge'i).
5. **Vastuvõtukriteeriumid:** (a) env-väravaga integratsioonitest (ptk 15.5 p 9–11 uuendus): autori kustutuse järel adressaadi `GET /api/pre-inquiries` tagastab rea, millel `status/sentAt/openedAt` ja adressaadi märkmed on alles, `authorId=null`, `authorErasedAt` olemas ning MITTE ÜHTEGI sisumarkerit (situation tühi, assessmentState null, mustandid null); Journey ridu 0; saatmata pöördumisi 0; (b) L5 suund: adressaadi kustutusel nullitakse tema märkmed (D-ploki test); (c) `npx prisma migrate status` puhas pärast täpselt ühte uut migratsiooni; `npm run db:migrate:check` roheline; `npm test` täissviit roheline; `npm run i18n:check` pariteet; (d) ptk 15.2 sondi kordus uue käitumise vastu (sünteetilised kasutajad, 0 jääki).

**Kui valitakse C:** TK-R1 asendub suurema paketiga (uus adressaadi-koopia mudel + saatmisraja muudatus + saatmiseelvaate tekst); enne teostust tuleb see ühendada TK-P4 külmutus-arhitektuuriga (ptk 14.7), et ei tekiks kahte konkureerivat snapshot-mehhanismi; TK-P0-st jäetakse D-plokk välja.

## 7. Mida see otsus EI muuda

- **Journey privaatse originaali kustutamine jääb alati täielikuks** — kõigis variantides kustub Teekond koos `context`/`personContext`/riskisignaalidega jäljetult (runtime-tõendatud käitumine säilib).
- **TK-P0 jagamispiiri turvaparandus** (ptk 15.4–15.6 leping: allowlist, riskisignaalide keeld, manifest, ignoredKeys) — sõltumatu ja jätkub oma järjekorras; O-TK9 mõjutab AINULT L5 D-ploki asukohta (A/B: jääb TK-P0-sse; C: kolib TK-R1-e).
- Saatmata mustandite (DRAFT, saatmata READY) kustumine autori kustutusel.
- `serializePreInquiry` vaatajapõhine nähtavusleping, vastuvõtja töövoog ja UI, U3 tagasivõtu/paranduse semantika elavatel kontodel.
- EXTERNAL_EMAIL kanal (platvorm ei kontrolli e-posti koopiaid nagunii).
- DataAuditLog/DataDeletionJob metaandmete senine praktika (§7.7 lubatud tehniline jälg).
- RV-P0/RV-P1, Admin P0.1, TK-P1/TK-P2 jm koordinaatorilaua paketid — järjekord püsib handoff'i järgi.

---

Kokkuvõte ühe reaga: **soovitus on B — autori sisu kustub, adressaadile jääb anonüümitud fakt ja tema enda töömärkmed; otsuse järel avaneb kitsas TK-R1 pakett (1 migratsioon + kustutusteenuse transform + placeholder + tekstid), A puhul ainult tekstitäpsustus, C puhul TK-P4-ga ühendatav suurem omandimudel.**

STATUS: COMPLETE
