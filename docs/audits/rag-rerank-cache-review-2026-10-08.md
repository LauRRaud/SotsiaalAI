# Astra järelkontroll: RAG-i allikavaliku kulupoliitika

08.10.2026. Auditeeritud commit `ca5970f9`, alus `a543ae5a`. Ulatus: kolm muudetud käitusmoodulit, uus sihttest, rahaarvestusega seos ning kõik salvestatud enne/pärast ja tagasilükatud katsete kviitungid. Lähtedokumendid: [tervikaudit](rag-system-audit-2026-10-08.md), [rahaarvestus](rag-cost-accounting-2026-10-08.md), [Soli teostus ja katsed](rag-rerank-input-reduction-2026-10-08.md).

## Otsus

**Kood sobib teadlikult valitavaks, vaikimisi väljas olevaks kulupoliitikaks. Selles muudatuses uut blokeerivat käituskoodiviga ei leidnud. Üldiseks vaikimisi aktiveerimiseks ja algse sisendimahu vähendamise ülesande lõpetatuks lugemiseks tõendeid ei piisa.** Poliitika kõrvaldab nii cache-kirjutamised kui ka kasulikud lugemised. See ei vähenda tokenimahtu; mõõdetud kogu sisend kasvas 2,47%.

Koondarvud −7,1% allikavaliku sisendi rahakulu ja −3,6% kogu RAG-i kulu on õigesti arvutatud. Need kirjeldavad kahte konkreetset jooksu. Kõik 15 kandidaatide tekstiräside loendit olid jooksude vahel erinevad; muutusid ka valik, vastus ja dialoogiseis. Seetõttu ei ole need protsendid puhta poliitikamuutuse põhjuslik hinnang. Kiiruse ega täieliku kvaliteedivõrdsuse paranemist ei kinnita ka järelkontroll.

## Leiud

### F1 — P2: kvaliteedikontroll jätab olulise dialoogiasjaolu kadumise märkamata

Lõpliku jooksu `SERVICE_PROVIDER / home-care-dialogue / turnIndex=0` kasutaja ütleb, et eakas vajab kodus kõrvalabi. Enne-jooksus sisaldab struktureeritud olek seda fakti ja sellest tulenevat vajadust. Pärast-jooksus säilivad ainult asukoht ja üksi elamine: `model.dropped` sisaldab `fact_not_quoted` ning kaks `needs_based_on` eemaldust; `needs` jääb tühjaks. Järgmisel pöördel lisatakse pension, kuid kõrvalabi vajadust ei taastata.

Varasem kontroll katab siin asukoha, pensioni, isiku ja ulatuse samasuse. See ei kata juhtumi keskset abivajadust ega oleku eemaldusi. Seetõttu ei saa rohelisest kontrolltabelist järeldada kogu vajaliku dialoogikonteksti säilimist. Algne küsimus on vestlusajaloos endiselt alles ja järgnev hinnavastus õnnestus; pika vestluse hilisemat mõju ei mõõdetud. See on olemasoleva olekusüsteemi kvaliteedileid salvestatud katses, mitte tõend, et vahemälulüliti seda põhjustab.

**Vajalik jätk:** olemasoleva salvestatud näite põhjal kohalik kontroll, et olulised kasutaja öeldud asjaolud jõuaksid mällu või nende puudumine oleks nähtav; hinnata olekut fakti ja inimese kaupa. Tsitaadikontrolli ei tohi lihtsalt nõrgendada ega lisada selle küsimuse või allika põhist runtime-erandit.

### F2 — P2: rahalise kokkuhoiu koond peidab rollide erinevust

| Roll, viis pööret | Allikavaliku sisendi USD muutus | Kogu RAG-i USD enne → pärast | Kogu kulu muutus | Valmis vastuse mediaan enne → pärast |
|---|---:|---:|---:|---:|
| Pöörduja | −20,8% | 0,022229415 → 0,019316710 | −13,1% | 29,070 → 37,542 s |
| Sotsiaaltöö spetsialist | **+4,2%** | 0,018836820 → 0,018634445 | −1,1% | 32,560 → 21,019 s |
| Teenuseosutaja | −0,3% | 0,017355230 → 0,018342935 | **+5,7%** | 24,060 → 22,348 s |

Lähtemõõtmisel jooksid rollid järjest: pöördujal polnud allikavaliku cache-lugemisi, kahel järgneval rollil oli kummalgi üks peaaegu täielik lugemine. Rollitulemust mõjutab seega ka kordusjärjekord, mitte üksnes roll. Viis pööret rolli kohta ei tõenda tavakoormuse cache-osakaalu. Poliitikat ei tule valida kasutajarolli järgi ega nimetada kõigile rollidele tõendatult soodsamaks.

**Vajalik jätk:** aktiveerimisel lähtuda olemasolevate kviitungite allikavaliku lugemis-/kirjutamismahust ja vastava töökoormuse tasuvusest. Uut tasulist hindamisringi audit ei nõua. Kuupiiri reserv ja arveldamine jäävad olemasolevaks; väiksem tegelik hind ei muuda siin konservatiivset reservi.

### F3 — P2: teadaoleva rollivea kõrval vähenes ka ühe hinnavastuse katvus

Spetsialisti koduteenuse esmane vastus käsitleb teda pöördujana ning suunab piirkonnakeskuse sotsiaaltöö spetsialisti poole. See kinnitab Soli juba märgitud probleemi; serveris õigesti edasi antud roll ei taga igas vastuses õiget käsitlust.

Pöörduja hinnajätku enne-vastus mainib ka seda, et teenustasu ei tohi takistada teenuse saamist. Pärast-vastus annab ainult tingimusliku hinna ja arvestatavate tulude loendi. Mõlemas on 1 EUR külastus ja 6,50 EUR tund olemas, kuid algse hindamisjuhtumi soovitud tasu/erandite käsitlus pole sama täielik. See on katvuse langus, mitte tõend, et pärast-vastuse nimetatud hind oleks vale. Võrdluse `hourPriceInAnswer` seda erinevust ei kata.

**Vajalik jätk:** kasutada olemasolevaid vastuseid rolli ja tingimuste/erandite kohalike kontrollnäidetena. Neid kvaliteedipiire ei tohi muuta üheks „kõik viited õiged“ tulemuseks. Kõigi faktiväidete täielik toetatus jääb `NOT_PROVEN`.

## Mida kood ja hinnastus tõendavad

- Vaikimisi ja tundmatu `rerankCachePolicy` jätavad senise päringu muutmata. Täpne väärtus `uncached-full-text-1` lisab ainult `prompt_cache_options`. Allikad, kandidaatide järjekord, juhised, skeem, kuupäev ja sõnumid jäävad sama sisendi korral identseks.
- Kontrollisin lõpliku pärisjooksu kõiki 15 säilitatud sisendit: praeguse päringukoostaja sisendi/juhise räsid kattuvad salvestatud räsidega ning enne/pärast päring erineb ainult vahemäluvälja poolest. Kolme käitusmooduli räsid kattuvad mõõteprotsessi omadega.
- Konfiguratsiooni lugeja säilitab välja ja seob kogu plaani räsi kinnitusega. Käitusmoodulite manifest hõlmab uut faili. Päringu räsi arvutatakse pärast poliitika rakendamist. HTTP kasutaja sisend ei saa poliitikat ette anda. Ligipääsu-, viite-, reservi- ja arveldamisrada ei muudeta.
- Ametlik juhis kinnitab explicit-režiimi ilma ühegi kirjutamispunktita. Luna standardhind on tavasisendile 0,10, kirjutamisele 0,125 ja lugemisele 0,01 USD/miljon. Lõpliku jooksu kõigi 15 allikavaliku vastustes olid lugemised ja kirjutamised null. [OpenAI Docs: prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching), [Luna hinnad](https://developers.openai.com/api/docs/models/gpt-6-luna).

Vahemälu vältimise tariifivõitu saab kontrollida tasuta, hoides lähtesisendi mahu samana: 265 285 tokenit maksaks 0,026528500 USD senise 0,029102875 asemel, **−8,85%**. See on arvutus sama sisendi kohta, mitte uus pärismõõtmine ega tulevase koormuse prognoos. Pöörduja viiel sisendil oleks võit umbes 20%, spetsialisti omadel 1,73% ja teenuseosutaja omadel 1,35%. Kahel üksikul cache-tabamusega päringul oleks sama sisendi uus hind peaaegu kümnekordne.

Tariifide praeguse suhte korral on täpne sisendikulu erinevus nano-USD-des `25 × cacheWriteTokens − 90 × cacheReadTokens`; positiivne väärtus soosib cache vältimist. Ligikaudne 21,7% lugemisosakaalu piir kehtib eeldusel, et ülejäänud tokenid oleksid kirjutamised. Tavaliselt hinnastatud tokenite osakaalu ei tohi lugeda kirjutamiseks. See arvutus ei tõenda vastuse kvaliteeti ega kiirust.

## Tõendite kontroll ja piirid

[Korratav tasuta kontrollskript](rag-rerank-cache-review-2026-10-08-probes.mjs), [selle tulemus](evidence/rag-rerank-cache-review-2026-10-08.json). Skript ei ava võrguühendust ega andmebaasi. Põhiarvutus kasutab commit'is olevaid tõendeid; `--with-local-raw` kontrollib lisaks kohalikku säilitatud toorandmestikku.

Kontrollitud: 362 selle töö kviitungi hind sõltumatu täisarvutusena, vastavus provider'i kasutusele ja olemasolevale kalkulaatorile, korduvate request-ID-de puudumine, etappide/pöörete/jooksude summad, kuus toorfaili räsi, küsimuste ja korpuse samasus, 15 päringu sisu säilimine ning 167 viite seos allikateksti räsiga enne/pärast vastustes. Kõik läbisid. Viiteräsi ei tõenda väite järeldumist allikast.

Lugesin läbi mõlema põhijooksu 30 vastust ja koduteenuse dialoogiseisud. Põhja-Sakala terminiparagrahvi lisandumise kahtlus kontrolliti algsete XML-ide vastu: see paragrahv on uues redaktsioonis lisatud, mistõttu seda ei kanta veana üles. Riigi Teatajast uuesti loetud kahe XML-i räsid kattusid kohalike korpusefailidega; [vana redaktsioon](https://www.riigiteataja.ee/et/akt/404072025051.xml), [uus redaktsioon](https://www.riigiteataja.ee/et/akt/403102026022.xml). See on sihitud kontroll, mitte kogu õigusvastuse semantiline sertifikaat.

Soli sihttestide tõend näitab 34/35 läbimist ning muutmata konfiguratsioonitesti eraldi läbimist. Esialgse `pilot_approval_required` põhjuse seost paralleelse tööga ei saa tõendada. Seda ei esitata 35/35 puhta koondjooksuna. Muutumatuid läbitud teste ei korratud; käesolev uus tasuta kontroll läbis. Serveri/HTTP runtime'i, pika dialoogi, suure kasutajakoormuse ja arve kooskõlastuse uus kontroll: `not_run`. Audit ei nõua uut tasulist mudeltesti ega eraldi AI-hindamisringi.

Audit ei teinud tasulisi API-kutseid. Selle arendustöö summa 0,335901185 USD ja varasem 0,030712790 USD annavad **0,366613975 USD / 1 USD**; alles **0,633386025 USD**. See on provider'i kasutuse tariifiarvutus, arve kooskõlastus jääb eraldi. Käesolev audit muutis dokumentatsiooni ja lisas tasuta tõendiskripti, käituskoodi ei muutnud; push'i, deploy'd ega poliitika aktiveerimist ei tehtud. Serveri ja `origin/main` uut hetkeseisu selle auditiga ei mõõdetud.

Järgmine sisuline töö on rolli ning oluliste asjaolude mällu jõudmise parandamine olemasolevate juhtumite põhjal, seejärel tervikauditis kirjeldatud päringusse lisatava kataloogi mahu vähendamine. See on algse sisendimahu probleemi jätk; vahemälupoliitika üksi seda ei lahenda.
