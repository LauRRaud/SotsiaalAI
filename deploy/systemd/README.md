# Hallatavad ajastused

## Keskkonnafailid (ADR-028)

- `/etc/sotsiaalai/frontend.env`: rakenduse seaded ja saladused, sh OpenAI võti.
- `/etc/sotsiaalai/rag.env`: RAG v2 ühendused (Postgres, Qdrant, EstNLTK), admin-RAG-i ja vestluspiloodi lülitid ning plaanid.

Mõlemad failid on loetavad ainult root'ile. Avaldamine teeb neist samas järjekorras root'i õigustega versioonikoopia `/etc/sotsiaalai/releases/<SHA>.env`; üks `sotsiaalai-frontend.service` loeb seda. Aktiivne väljalase on kirjas `/home/ubuntu/apps/sotsiaalai-releases/active.json`-is ning systemd `WorkingDirectory`-s. Vana checkout säilib andmehoidlate ja esimese tagasipöördumise jaoks; selle HEAD ei ole aktiivse versiooni tunnus.

Vestluspiloodi plaan on seotud täpse käituskoodiga (`implementationHash`). Avaldamine uuendab vajadusel kinnitatud plaani uuele koodile, säilitades omaniku kinnitatud kasutajad, eelarve ja andmete väljasaatmise load. See töövalmiduse kontroll ei tee mudelikutseid. Serveris rakendatakse GitHubis valmis ehitatud artefakt; lint'i, teste, sõltuvuste installi ega build'i serveris ei korrata. Failide ettevalmistamise järel peatatakse senine frontend ning käivitatakse uus samal pordil. Korraga töötab üks rakenduse protsess.

## LiveKit, egress ja OSRM

Unit-failid on repos, et nende versioonid ja käsuread oleksid näha ning muudatused läbiksid ülevaatuse. Saladusi failides pole: need tulevad failidest `/etc/livekit/livekit.yaml` ja `/etc/livekit/egress.env`.

- `livekit.service` käivitab binaari `/usr/local/bin/livekit-server` (25.09 seisuga 1.13.7). Binaar paigaldatakse eraldi GitHubi väljalaskest ja räsi kontrollitakse `checksums.txt` vastu.
- `livekit-egress.service` kasutab tõmmist `livekit/egress`, mis on lukustatud versiooni ja räsiga (`v1.14.1@sha256:…`), mitte sildiga `latest`.
- `sotsiaalai-osrm.service` kasutab tõmmist `ghcr.io/project-osrm/osrm-backend:v26.9.0-debian@sha256:…` ja kaarti kaustas `/home/ubuntu/osrm-26.9`.

LiveKiti ja OSRM-i muudetud unit-failid paigaldab AI vajadusel eraldi ning käivitab `daemon-reload`; rakenduse tavaline avaldamine neid teenuseid ei muuda. Pärast nende konfiguratsiooni muudatust tuleb vastav teenus taaskäivitada (`sudo systemctl restart <teenus>`).

OSRM-i kaardi uuendamiseks tehakse uus graaf kõrvalkausta, seda testitakse pordil 5001 ja alles siis vahetatakse unit-failis kaust:

```sh
NEW=/home/ubuntu/osrm-<versioon>; IMG=ghcr.io/project-osrm/osrm-backend:<silt>
curl -fsSLO https://download.geofabrik.de/europe/estonia-latest.osm.pbf  # kontrolli ka .md5 faili
sudo docker run --rm -v "$NEW:/data" "$IMG" osrm-extract -p /opt/car.lua /data/estonia-latest.osm.pbf
sudo docker run --rm -v "$NEW:/data" "$IMG" osrm-partition /data/estonia-latest.osrm
sudo docker run --rm -v "$NEW:/data" "$IMG" osrm-customize /data/estonia-latest.osrm
```

Kaart töödeldakse auto profiiliga (`routability`), sest sõidupäevik vajab autoteekondi. OSRM-i andmefailid on seotud versiooniga, millega need tehti. Uue OSRM-i versiooniga tuleb kaart alati uuesti töödelda.

## Materjalide isoleeritud hoidla (SOL-MAT-08)

`var-lib-sotsiaalai-materials.mount` on repo-hallatav leping eraldi LUKS2 + ext4 köitele:
`nodev,nosuid,noexec`, köiteta aluskataloog `root:root 0500`, köite peal
omanik `ubuntu:ubuntu`, juurkataloog `0750` ning `uploads`, `quarantine` ja
`sanitized` kataloogid `0700`. Frontend seotakse `BindsTo` abil köite elueaga
ning sama kontrollskript jookseb `ExecStartPre` kaudu iga käivituse ees. Rakenduse
`MATERIALS_STORAGE_DIR` peab olema `/var/lib/sotsiaalai/materials`.

Tootmises loob `deploy/provision-materials-volume.sh` uue rangelt kontrollitud
`/var/lib/sotsiaalai-materials.luks` failipõhise LUKS2 köite, avab ta ainult
`/dev/mapper/sotsiaalai_materials` nime all ja vormindab uue mapping'u ext4-ks.
Skript keeldub olemasolevat või mittetühja sihtkohta vormindamast. Võtmefail on
root-only `/etc/sotsiaalai/materials-volume.key`; võtit ei logita.
Aktiveerimisel paigalda kontrollskript ja nõua kontrollunit'i edu enne frontendi
käivitamist. `sotsiaalai-materials-tmpfiles.conf` on teadlikult tühi
tagasiühilduvusfail: kataloogid tekivad ainult pärast krüpteeritud köite tõendamist.

```sh
sudo install -m 0755 deploy/bin/sotsiaalai-materials-storage-verify /usr/local/bin/
sudo systemctl enable --now var-lib-sotsiaalai-materials.mount
sudo systemctl enable --now sotsiaalai-materials-storage-verify.service
findmnt -n -o SOURCE,FSTYPE,OPTIONS --target /var/lib/sotsiaalai/materials
```

PDF/DOCX kasutab kohalikku Dangerzone 0.11 CDR-i. `deploy/bin/sotsiaalai-material-cdr`
annab sisendi võrguta Podmani/gVisori liivakastile, Dangerzone rasterdab dokumendi,
ehitab ohutu PDF-i uuesti ja OCR-ib selle; RAG-i jõuab ainult sellest PDF-ist
eraldatud rangelt valideeritud UTF-8 tekst. Puuduv mootor, timeout, tühi või liiga
suur väljund jääb fail-closed olekusse. Välist pilve-CDR-i ei kasutata.

Need failid on **repositooriumi oma**, mitte ühe masina crontabi oma. Põhjus on
SOL-CW-14: säilitustöö loogika oli olemas ja testitud, aga cron oli **näide
skripti päises**. Kui serverivälist cron'i eraldi paigaldatud ei olnud, ei
kustunud ülekantud mustandite sisu 12 kuu järel ja arhiveeritud juhtumid ei
saanud hoiatust ega kustunud tähtajal — ilma ühegi veateate või puuduva rea
märgita. Koodis olev säilitusreegel ei muutu iseenesest päris tööks.

## Ajastatud tööd käivad aktiivsest väljalaskest

Iga avaldamine kirjutab ajastatud tööde unit-failid `/etc/systemd/system/`-i uue väljalaske kaustaga (`WorkingDirectory`, `ExecStart`, `ReadWritePaths`), et järgmine taimerijooks kasutaks sama koodi ja samu sõltuvusi mis frontend. Repo failides on kirjas esimese checkout'i tee `/home/ubuntu/apps/sotsiaalai`; avaldamine asendab selle väljalaske kaustaga.

- Reegel kehtib iga `sotsiaalai-*.service` faili kohta kaustades `deploy/systemd/` ja `ops/systemd/`, mis seda teed nimetab. Nimelist loendit koodis ei ole: uus fail tuleb kaasa juurutusskripti muutmata. Frontendil on oma `30-release.conf`; OSRM ja hoidla kontroll rakenduse koodi ei käivita ja neid ei puututa.
- `deploy/systemd/` failid paigaldatakse või uuendatakse alati. `ops/systemd/` failid (maksetööd) on vaikimisi välja lülitatud ja neid uuendatakse ainult siis, kui operaator on need serverisse paigaldanud.
- Taimereid avaldamine ei luba ega käivita ning käimasolevat tööd ei katkesta.
- Pärast avaldamist vaadatakse üle kõik serveri `sotsiaalai-*.service` üksused. Kui mõni käib endiselt esimesest checkout'ist, kirjutab avaldamine logisse hoiatuse (`WARNING: … runs from …`; GitHubi töövoos märkus „Scheduled job outside the live release”). Hoiatus väljalaset ei peata: üksus, mida repos ei ole, on operaatori teisaldada või eemaldada.

**Miks.** Kuni 05.10.2026 oli juurutusskriptis kolme töö nimeline loend. Maksekirjade, tellimuste uuendamise ja teenuste saadavuse meeldetuletuse üksused jäid loendist välja ja käisid edasi esimesest checkout'ist, mille kood seisis väljalaskekaustadele ülemineku päeva (04.10.2026) seisus. Kaks esimest on õhukesed käivitajad, mis kutsuvad töötava rakenduse API-t; meeldetuletuse töö käivitas vana koodi otse.

**Uue ajastatud töö lisamine.** Pane `.service` ja `.timer` fail kausta `deploy/systemd/`, kirjuta teeks `/home/ubuntu/apps/sotsiaalai` ja luba taimer serveris ühe käsuga. Test `tests/deploy-plan-release.test.mjs` kontrollib, et repo iga tööüksus kirjutatakse väljalaske kausta.

## `sotsiaalai-service-availability`

`sotsiaalai-service-availability.timer` käivitab iga päev kell 4.00 `npm run service-availability:remind`: teenuseosutaja saab e-kirja, kui tema teenuse saadavuse info on aegumas. Unit-failid olid kuni 05.10.2026 ainult serveris; nüüd on need repos. Kuivjooks midagi ei saada: `npm run service-availability:remind:dry`.

## `sotsiaalai-casework-retention` (JTA-V1 E7)

| | |
|---|---|
| **Lukk** | `flock -n /var/lock/sotsiaalai-casework-retention.lock` — faililukk, mitte ainult systemd'i instantsipiir, sest käsitsi käivitatud `npm run casework:retention` ei tea systemd'ist midagi |
| **Ajastus** | `OnCalendar=hourly`, `Persistent=true` (vahelejäänud jooks tehakse järele) |
| **Retry** | taimerilt: `Type=oneshot` ei tohi `Restart`-i kanda, seega kukkunud jooks proovitakse uuesti tunni pärast. Töö on idempotentne ja partii piiratud |
| **Monitooring** | iga jooks jätab rea `CaseWorkRetentionRun` tabelisse — **enne** tööd, mitte pärast |
| **Jälg** | systemd `failed` seis, journal ja iga jooksu `CaseWorkRetentionRun` rida; eraldi automatiseeritud smoke-alarmi repos enam ei ole |

## `sotsiaalai-mtr-refresh` (A4 tegevusloa kontroll)

`sotsiaalai-mtr-refresh.timer` käivitab iga tunni 20. minutil `npm run mtr:refresh`. Korje ei kontrolli tunnis kõiki: ta võtab ainult need teenuseprofiilid, millel on registrikood ja vähemalt üks loakataloogiga seotud teenus ning mille järgmise kontrolli aeg on käes (edukas kontroll 14 päeva pärast, tõrke järel 1 h, 6 h, 24 h). Üks kontroll on kolm järjestikust päringut majandustegevuse registrisse; partii on kümme profiili jooksu kohta. Faililukk `/var/lock/sotsiaalai-mtr-refresh.lock` ei lase kahel jooksul korraga käia.

Kuni ükski teenus ei ole kataloogiga seotud, ei tee töö ühtegi registripäringut. Sidumine on halduri teadlik toiming (`POST /api/admin/service-licence-binding`), mitte automaatne.

Esmane lubamine serveris (avaldamine paigaldab `.service` faili, taimerit mitte):

```sh
R=$(systemctl show -p WorkingDirectory --value sotsiaalai-frontend)
sudo install -m 0644 "$R/deploy/systemd/sotsiaalai-mtr-refresh.timer" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now sotsiaalai-mtr-refresh.timer
systemctl list-timers sotsiaalai-mtr-refresh.timer --no-pager
journalctl -u sotsiaalai-mtr-refresh.service -n 20 --no-pager
```

Kuivjooks näitab, kes oleks järgmises partiis, ega päri registrist midagi: `npm run mtr:refresh:dry`. Seis halduri jaoks: `GET /api/admin/licence-alarms`.

## Teavitused ja perioodilised taastetööd

`sotsiaalai-notifications.timer` käivitab iga viie minuti järel
`npm run notifications:dispatch`. Sama fail-closed route lepitab ja saadab teavitused ning
käitab mentorluse, supervisiooni, praktikate määranguparanduse ja praktikate RAG-taaste
piiratud partiid. RAG-taaste `dead_letter` või sama jooksu tõrge muudab job'i vastuse
ebaõnnestunuks, nii et systemd jätab nähtava failed-jälje journal'i; järgmine timerijooks
proovib parandatavaid töid uuesti.

Deploy paigaldab või uuendab `.service` faili (väljalaske kaustaga), kuid ei paigalda `.timer` faili ega luba uut taimerit esimest korda sisse.
Esmasel aktiveerimisel kontrolli `/etc/sotsiaalai/frontend.env` võtmeid ja käivita:

```sh
sudo systemctl enable --now sotsiaalai-notifications.timer
systemctl is-enabled sotsiaalai-notifications.timer
systemctl is-active sotsiaalai-notifications.timer
journalctl -u sotsiaalai-notifications.service -n 20 --no-pager
```

### Casework-taimeri paigaldamine

Deploy kopeerib unit-failid `/etc/systemd/system/`-i ja teeb `daemon-reload`.
**Taimerit ta EI luba sisse** — see on teadlik.

`SotsiaalAI.md` S1 lukustab järjekorra: Õ2/Õ3 andmekaitseanalüüs → **cron
paigaldatakse (sama väljalase, mis aktiveerib)** → kuivjooks → aktiveerimine →
päris jooks + logikontroll. Unit-failide olemasolu ei aktiveeri midagi; taimeri
lubamine on **üks käsk** ja ta kuulub aktiveerimise väljalaskesse:

```bash
sudo systemctl enable --now sotsiaalai-casework-retention.timer
```

Kontroll pärast lubamist:

```bash
systemctl list-timers sotsiaalai-casework-retention.timer
journalctl -u sotsiaalai-casework-retention.service -n 20 --no-pager
```

Automaatne smoke- ja probe-kiht eemaldati repo puhastusega. Kui taimerit või päris
säilituskäitumist ei ole käsitsi kontrollitud, tuleb seis märkida `NOT_PROVEN`.
