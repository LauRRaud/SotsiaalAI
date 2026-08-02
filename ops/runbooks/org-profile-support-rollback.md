# Runbook — T25 viil C tagasipööramine (`org_profile_support_v1`)

Migratsioon: `prisma/migrations/20260802090000_org_profile_support_v1`
Preflight: `scripts/org-profile-support-preflight.mjs`

Seda runbooki läheb vaja siis, kui teenuseprofiilide kaheks omandirežiimiks
jagamine tuleb toodangust tagasi võtta. **Rollback ei ole rutiin.** Ta taastab
olukorra, kus teenuseprofiil on jäigalt ühe inimese konto küljes ja konto
kustutamine viib profiili kaasa — täpselt selle, mille viil C parandas.

---

## 1. Enne kui midagi puutud

1. **Võta andmebaasi varukoopia ja veendu, et ta on taastatav.** Preflight ei
   asenda backup'i: ta ütleb, kas käsud jooksevad läbi, mitte et tulemus on see,
   mida sa tahtsid.
2. Pane kirja praegune rakenduse SHA ja rollback-SHA.
3. **Lülita org-väravad välja ENNE skeemi muutmist**, muidu jookseb rakendus
   veergude vastu, mida enam ei ole:
   `ORG_WORKSPACE_ENABLED=0`, `ORG_CREATION_ENABLED=0`, `ORG_SEATS_ENABLED=0`,
   `ORG_INBOX_ENABLED=0`.

---

## 2. Preflight — kohustuslik värav

```bash
node --import ./scripts/register-node-test-loader.mjs scripts/org-profile-support-preflight.mjs
```

Väljundkoodid: **0** = ohutu · **1** = ei ole ohutu · **2** = kontroll ise kukkus.

**Kood 2 ei ole roheline tuli.** Ebaselge tulemus tähendab peatumist.

Preflight kontrollib kolme asja ja kõik kolm peavad olema **0**:

| Värav | Miks |
|---|---|
| `ownershipMode = 'ORGANIZATION'` profiile | Rollback taastab `ownerId` **Cascade**-seose ja seoks organisatsiooni profiili uuesti ühe inimese konto külge. |
| `ownerId IS NULL` profiile | Rollback'i samm `ALTER COLUMN "ownerId" SET NOT NULL` **kukub** nende ridade peal. |
| omanikke rohkem kui ühe profiiliga | Rollback taastab TÄIELIKU unikaalindeksi `ServiceProviderProfile_ownerId_key`; viilu C osaline indeks lubab ühel inimesel olla korraga ühe org-profiili päritolu ja omada uut solo-profiili. |

> **Miks kolm, mitte üks.** Algne värav migratsiooni kommentaaris luges ainult
> ORGANIZATION-profiile. Sellest ei piisa: `ownerId IS NULL` read tekivad
> TAVAKASUTUSES, sest viil C tegi omanikuseose `SetNull`-iks just selleks, et
> kustutatud konto ei viiks profiili kaasa. Ainult ORGANIZATION-loendust
> vaadates näeks operaator nulli ja rollback kukuks keset skeemimuudatust.

---

## 3. Kui preflight ütleb STOP

Lahenda takistused ükshaaval ja jooksuta preflight uuesti. Ükski samm ei ole
automaatne — igaüks neist on **andmeotsus**, mitte tehniline formaalsus.

### 3.1. ORGANIZATION-režiimi profiilid

Iga profiil tuleb kas viia tagasi SOLO-režiimi (määrates vastutava inimese) või
teadlikult kustutada. Kellele profiil kuuluma hakkab, on omaniku otsus — kood
seda valida ei oska.

```sql
SELECT id, "organizationName", "organizationId", "ownerId"
FROM "ServiceProviderProfile" WHERE "ownershipMode" = 'ORGANIZATION';
```

### 3.2. Omanikuta profiilid (`ownerId IS NULL`)

Need on profiilid, mille looja konto on kustutatud. Kaks teed: määra uus omanik
või kustuta profiil. **Kustutamine on pöördumatu ja viib kaasa profiili avaliku
kirje** — vaata enne, kas profiil on teenusekaardil nähtav.

```sql
SELECT id, "organizationName", "publicSlug", "status"
FROM "ServiceProviderProfile" WHERE "ownerId" IS NULL;
```

### 3.3. Topeltomanikud

```sql
SELECT "ownerId", count(*) FROM "ServiceProviderProfile"
WHERE "ownerId" IS NOT NULL GROUP BY "ownerId" HAVING count(*) > 1;
```

Jäta iga omaniku kohta alles üks profiil.

---

## 4. Rollback'i käsud

Jooksuta ainult siis, kui preflight andis **0**. Käsud on täies mahus
migratsioonifaili osas 3 (`OSA 3 — ROLLBACK`). Järjekord on oluline: indeksid ja
piirangud maha, veerud maha, alles siis `SET NOT NULL`.

Pärast rollback'i:

1. Käivita `npm run db:migrate:check` — migratsiooniahel peab jääma terveks.
2. Eemalda migratsioonikirje `_prisma_migrations` tabelist, kui kavatsed sama
   migratsiooni hiljem uuesti rakendada.
3. Kontrolli, et teenuseprofiili lehed avanevad ja teenusekaart renderdub.

---

## 5. Mida rollback EI taasta

- **Tugiavalduste sisu.** `WellbeingSupportShare`, `OrganizationSupportContact`
  ja `OrganizationReportingLine` tabelid KUSTUTATAKSE. Kui neis on päris ridu,
  on need pärast rollback'i läinud — varukoopia on ainus tee tagasi.
- **Päritolu.** Org-profiilide `organizationId` ja `ownershipMode` veerud
  kaovad; teadmine, milline profiil kunagi organisatsioonile kuulus, jääb
  ainult auditilogisse (`DataAuditLog`, action `org.profile_converted_to_organization`).

---

## 6. Kust see nõue tuli

Kontrolli leid 02.08.2026: rollback-värav luges ainult ORGANIZATION-profiile ja
elas kommentaarina migratsioonifailis. Kommentaari ei jookse keegi. Preflight
jookseb ja väljub veakoodiga — ning tema STOP-tee on tõendatud sünteetilise
`ownerId IS NULL` reaga, mitte ainult loetud.
