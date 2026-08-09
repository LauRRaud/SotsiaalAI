# Hallatavad ajastused

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

### Paigaldamine

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
