# Hallatavad ajastused

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

## `sotsiaalai-casework-retention` (JTA-V1 E7)

| | |
|---|---|
| **Lukk** | `flock -n /var/lock/sotsiaalai-casework-retention.lock` — faililukk, mitte ainult systemd'i instantsipiir, sest käsitsi käivitatud `npm run casework:retention` ei tea systemd'ist midagi |
| **Ajastus** | `OnCalendar=hourly`, `Persistent=true` (vahelejäänud jooks tehakse järele) |
| **Retry** | taimerilt: `Type=oneshot` ei tohi `Restart`-i kanda, seega kukkunud jooks proovitakse uuesti tunni pärast. Töö on idempotentne ja partii piiratud |
| **Monitooring** | iga jooks jätab rea `CaseWorkRetentionRun` tabelisse — **enne** tööd, mitte pärast |
| **Alarm** | `npm run casework:retention:smoke` → väljumiskood **1**, kui viimasest edukast jooksust on möödas üle kahe intervalli |

## Teavitused ja perioodilised taastetööd

`sotsiaalai-notifications.timer` käivitab iga viie minuti järel
`npm run notifications:dispatch`. Sama fail-closed route lepitab ja saadab teavitused ning
käitab mentorluse, supervisiooni, praktikate määranguparanduse ja praktikate RAG-taaste
piiratud partiid. RAG-taaste `dead_letter` või sama jooksu tõrge muudab job'i vastuse
ebaõnnestunuks, nii et systemd jätab nähtava failed-jälje journal'i; järgmine timerijooks
proovib parandatavaid töid uuesti.

Deploy paigaldab või uuendab unit-failid, kuid ei luba uut taimerit esimest korda sisse.
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
npm run casework:retention:smoke
```

**Enne lubamist annab smoke `NEVER_RUN`** ja see on aus vastus: ajastust ei ole
paigaldatud. Kui `CASEWORK_V1_ENABLED` on väljas, lõpeb smoke koodiga 0 ja ütleb
seda välja — väljas funktsioonil ei ole midagi säilitada ja alarm siin õpetaks
inimest alarmi eirama.

### Kas alarm ise töötab?

```bash
npm run casework:retention:probe
```

Sond loob **visatava andmebaasi**, rakendab talle migratsiooniahela ja mõõdab
alarmi **mõlemast otsast** päris PostgreSQL-is ja päris protsessis: kaks `CHECK`-i,
ajavööndi kokkulepe, lävi täpselt piiril ja üks millisekund üle, ning smoke'i
väljumiskood alarmi, korras seisu, väljas värava ja katkise skeemi peal. Arendus-
ega tootmisbaasi ta ei kirjuta ja koristust kontrollib. `npm test` jookseb
fake-Prisma peal ega tõenda neist ühtegi.
