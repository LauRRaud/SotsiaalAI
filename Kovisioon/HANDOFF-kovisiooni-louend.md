# HANDOFF — Kovisiooni digitaalne lõuend (2026-07-11)

Sessiooni jätk teises aknas. Seis, katkestuskoht ja järgmised sammud.

---

## 1. Mis on ehitatud (valmis ja töötab)

**Kovisiooni sessioon = üks täisekraani lõuend, etapid 1–3 valmis, 4–8 platseholderid.**

- [components/covision/CovisionSession.jsx](../components/covision/CovisionSession.jsx) — kogu sessioon ühes komponendis:
  - **Etapp 1 (cv1)** — alustamine ja juhtumi kinnitamine: ooteruum → "Alusta kohtumist" käivitab taimerid → kinnitusvood (roll, kokkulepete kiht nimelise loendiga, seaded, isiklik valmisolek 3 valikuga) → värav "Ava juhtum" inimese kaupa põhjustega.
  - **Etapp 2 (cv2)** — loo jagamine: faasid ready→sharing→review; Mari toimingud (Alusta/Lõpeta loo jagamist, Minu ettevalmistus kiht); 7 ankrut allikasiltidega (sh "Juhtumi tooja kogemus", tõlgendus "vajab uurimist"); nimetatud seosed (üks katkendlik); tööfookuse sõnastuskiht (Kinnitan / Täpsustan pärast uurimist); Liisa privaatsuskontroll; rollide vastutuste paneel; õhuke värav "Liigu uurimisse".
  - **Etapp 3 (cv3)** — uurimine: faasid plan→prep→round; uurimisplaan (Mari valitud 4 kohta, parandatud sõnastused); vaikne ettevalmistus (Aveli vaates küsimuse kirjutamine + kompass + kvaliteedivihjed); aktiivse küsimuse töövoog §21 (Jaanika: Anna sõna Marile / Pargi / Sulge / Ava järgmine + küsimuse kestus; Mari: Vastasin / Palun täpsusta / Ma ei tea veel / Ei soovi vastata / Vajan hetke; küsija: "Aitäh, vastus on piisav"); uurimiskohtade olekud (Uurime/Täpsustatud/Teadlikult avatud); Mari "piisavalt uuritud" + temp-fookuse kinnitus; värav "Liigu mõistmise süvendamisse".
- **Demo-mudel:** all vasakul vaatevahetaja (Sessiooni juht / Juhtumi tooja / Kaardi haldaja / Grupiliige). Üks vaade = üks roll (spec §29.5/§42.7/§51.8). Mitte-vaadatavad rollid täidavad oma toimingud **simulatsioonina** taimerite peal (etapp 1: teised ~2 s sammuga, Timo lukus 25 s referentsseisu jaoks; etapp 2: lugu 4 s, ankrud 2 s vahedega, ülevaatuse kinnitused +6/+10/+14 s; etapp 3: analoogne). Vaadatava rolli toimingud on alati kasutaja käes.
- [app/styles/covision.css](../app/styles/covision.css) — cv1/cv2/cv3 + vana .cvs kiht (etapid 4–8 platseholder). Violetne aktsent `--cv1a` + `.cv1-acc` klass primaarnuppudel; soe täisekraani taust `.covision-page` peal.
- [components/covision/CovisionPage.jsx](../components/covision/CovisionPage.jsx) → renderdab CovisionSession; `/kovisioon` on TÄISLEHT (WorkspacePanel'i EMBEDDED map'ist eemaldatud).

**Ruumi karussell (varasem töö samas sessioonis):**
- Töölaud/Tööheaolu/Kovisioon = kaardikomplektid ruumi karussellis (RoomStage: workspaceHub/wellbeingHub/kovisionHub, "Tagasi" kaardid, lähtestused).
- Kovisiooni alamkomplekt: Kovisiooni ruum / Teemaseemned / Parimad praktikad → kõik viivad praegu `/kovisioon` (seemnete ja praktikate lehed EHITAMATA).
- GlassCarousel `visible={5}` režiim (≥1200px; kitsalt 3), pööre 480 ms, sammulukk 460 ms, äärekaardid sissepoole (välissamm ×0.86), nooled äärekaardi kõrval.
- 14 uut ikooni CardIcons.jsx-is. i18n võtmed `room.kovision_*_card` PUUDUVAD messages-failidest (konsoolis warningud) — lisada et/en/ru.

## 2. Spetsifikatsioonid (kaanon, millest ehitada)

Kaustas `Kovisioon/`:
- `uue-kovisiooni-funktsiooni-visioon-ja-8-etapiline-selgroog.md` — keskne visioon (üks elav lõuend, rollid, AI piirid, andmed). Lahtised otsused: tööfookuse vorm (§6.2), jõustamisrituaal 6. etappi, §14 "ruumikäivitaja" parandus, §29 malli ajaraam+ekraanitekstid.
- `kovisioon-etapp-1-...md` **v1.1** — §29.5 rollipõhised vaated, §29.6 referentsvaade.
- `kovisioon-etapp-2-...md` **v1.1** — §42.7–42.9 (rollivaated, parem-paneeli/värava tööjaotus, referentsvaade), kriteeriumid 19–25.
- `kovisioon-etapp-3-...md` **v1.1** — §51.8–51.10, kriteeriumid 26–33.
- Etapp 4–8 spetsifikatsioone veel POLE — tellija kirjutab; ehitus järgib sama mustrit.
- `teemaseeme-professionaalne-funktsioon.md` — teemaseemnete lehe alus (ehitamata).

**Muster iga etapi juures:** tellija annab pildi + kriitika → mina valideerin spec'i vastu + lisan leiud → "uuenda spec" (v1.1: rollivaated + referentsvaade + kriteeriumid) → "ehita" (uut pilti ei tehta).

## 3. KATKESTUSKOHT — mis oli pooleli

**E2E-verifitseerimine preview-brauseris (etapp 3 voog jäi lõpuni käimata).**

Kronoloogia:
1. Vood 1→2 testitud ja TÖÖTAVAD (kinnitused, sim, väravad, kihid).
2. **Leitud + PARANDATUD päris viga:** etapivahetusel jooksis sim enne taimeri nullimist → `shareStart` sai vana etapi sekundid ("Lugu 00:00/10:00" külmus). Fix: `advance()`/`back()` teevad `setElapsed(0)` samas patšis (CovisionSession.jsx). Pärast fixi jooksis etapp 2 sim täielikult läbi ✓.
3. Klõps "Liigu uurimisse" läks koordinaadi-skaleerimise tõttu viltu → leht/server suri.
4. Uus server andis `/kovisioon` **404** (root 200, page.jsx olemas, vigu logis pole) → kahtlus: katkine `.next` vahemälu ebapuhtast surmast.
5. **Viimane tehtud samm:** server peatatud, `.next` KUSTUTATUD. Restart jäi tegemata.

**JÄRGMISED SAMMUD (alusta siit):**
1. `preview_start` config'iga `next-dev` (AINUS lubatud viis serverit käivitada, CLAUDE.md). NB: esimene kompileerimine kestab.
2. Kontrolli `curl http://127.0.0.1:3000/kovisioon` → peab olema 200 (kui ikka 404, uuri route'i; middleware/lokaliseerimine?).
3. Preview-brauseri tabis on SISSELOGITUD sessioon (prisma logid näitasid userit) — /kovisioon renderdub päriselt.
4. Testi etapp 3 lõpuni Jaanika vaates: (etapid 1–2 kiirelt uuesti — sim teeb enamiku; sinu klikid: Alusta kohtumist → Kinnitan rolli → kokkulepete kiht "Mõistan ja kinnitan" (kihi sees keri alla!) → Kinnita seaded → Olen kohal ja valmis → Olen valmis → oota Timo 25 s → Ava juhtum → etapp 2 sim jookseb ise (~40 s) → Liigu uurimisse) → etapp 3: **Alusta uurimist → Lõpeta vaikne ettevalmistus → Ava järgmine küsimus → Anna sõna Marile** (Mari sim vastab +6 s, küsija sim tänab +3 s) ×3 küsimust → Mari sim "piisavalt uuritud" → **Liigu mõistmise süvendamisse** → 4. etapi platseholder.
5. Testi ka Mari/Aveli vaated etapis 3 (vastamisnupud; Aveli prep-kirjutamine + kompass-insert).
6. Klõpsamisel kasuta `ref`-e, MITTE screenshot-koordinaate (skaleerimine pettis). Kihtide sees keri kihi kaardil.

## 4. Teadaolevad küsitavused / võlg

- `/kovisioon` renderdub PanelFrame'i sees ("Avatud paneel", ⓘ/✕ nurgas) — spec tahab puhast täisekraani; kaaluda panel-wrapperist väljavõtmist (app/kovisioon või PanelFrame erand).
- CovisionSession sisaldab VANU kasutuseta konstante/olekuid (EXPLORE_MODES, DEMO_OTHER_QUESTIONS, qcards/discussed/usedQuestions/deepUnlocked/keywords/allAgreements-jäänuk, STAGE_SUPPORT jm) — kompileerub, aga vajab koristust kui etapid 4–8 valmis.
- Etappide 4–8 vana .cvs kroom (header/footer/anchor) töötab `stage > 3` taga.
- i18n: room.kovision_*_card võtmed lisada.
- Vana workspace.css `.covision-*` reeglid surnud.
- Tööfookus voolab etappi 4+ `focusQuestion` kaudu (vana nimi; sisu = tööfookus).

## 5. Reeglid (tellija lukustatud)

- **Iga nupp peab loogikaga olema** — liigsed elemendid võetakse ära; disabled nupp ütleb alati põhjuse.
- **Üks vaade = üks roll**; ootel olekul on alati TEGUTSEJA nähtav ("Ootab Mari kinnitust").
- **Ausad olekud** — mitte midagi pole kinnitatud enne inimese (või sim-inimese) tegevust.
- Kaks eristatud aega (Kohtumine + etapp/faas); Paus ja Vajan tuge ALATI eraldi; taimer toetav, ei sulge midagi.
- Nupupind glass.css `data-variant` süsteemist; violett ainult aktsendiks (`.cv1-acc`, aktiivne etapp).
- Dev-server AINULT `preview_start next-dev`; mitte kunagi npm run dev shellist; port 3000.
- Kohalik verifitseerimine preview-tööriistadega; curl ainult kompileerumise kontrolliks.
