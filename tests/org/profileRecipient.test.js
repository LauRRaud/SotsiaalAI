/**
 * T25 — ORGANIZATION-profiili `ownerId` on PÄRITOLU, mitte adressaat.
 *
 * Kolm elusündmust, mille järel jäi vana kood profiili LOOJALE saatma:
 *   üleandmine (SOLO → ORGANIZATION), offboarding (looja lahkub) ja
 *   looja konto kustutamine. Kõigil kolmel juhul jääb `ownerId` alles või
 *   muutub NULL-iks, aga kummalgi juhul EI TOHI temast saada saajat.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  PROVIDER_OWNERSHIP_MODE,
  PROVIDER_RECIPIENT_SELECT,
  isOrganizationOwnedProfile,
  resolveProviderAuditTargetUserId,
  resolveProviderRecipientEmail,
  resolveProviderRecipientOrganizationId,
  resolveProviderRecipientUserId
} from "../../lib/org/profileRecipient.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

const soloProfile = {
  ownerId: "user-solo",
  ownershipMode: PROVIDER_OWNERSHIP_MODE.SOLO,
  organizationId: null,
  email: "profiil@naide.ee",
  owner: { id: "user-solo", email: "inimene@naide.ee" }
};

/** Sama profiil pärast üleandmist: `ownerId` JÄÄB, režiim muutub. */
const handedOverProfile = {
  ...soloProfile,
  ownershipMode: PROVIDER_OWNERSHIP_MODE.ORGANIZATION,
  organizationId: "org-1"
};

test("SOLO-profiilil on omanik endiselt adressaat", () => {
  assert.equal(isOrganizationOwnedProfile(soloProfile), false);
  assert.equal(resolveProviderRecipientUserId(soloProfile), "user-solo");
  assert.equal(resolveProviderRecipientEmail(soloProfile), "inimene@naide.ee");
  assert.equal(resolveProviderRecipientOrganizationId(soloProfile), null);
});

test("ÜLEANDMINE: režiimi vahetus võtab loojalt adressaadirolli, aga jätab päritolu", () => {
  // Päritolu on endiselt kirjas — auditi fakt ei tohi kaduda.
  assert.equal(handedOverProfile.ownerId, "user-solo");
  // Adressaat kaob samal hetkel.
  assert.equal(resolveProviderRecipientUserId(handedOverProfile), null);
  assert.equal(resolveProviderRecipientOrganizationId(handedOverProfile), "org-1");
});

test("ÜLEANDMINE: e-post läheb profiili avalikule aadressile, mitte looja omale", () => {
  assert.equal(resolveProviderRecipientEmail(handedOverProfile), "profiil@naide.ee");
  assert.notEqual(resolveProviderRecipientEmail(handedOverProfile), "inimene@naide.ee");
});

test("OFFBOARDING: looja lahkub organisatsioonist — ownerId jääb, saajaks ei saa", () => {
  // Offboarding EI tühjenda `ownerId`-d (päritolu ei tohi kaduda), seega
  // ainus kaitse ongi režiimipõhine lahendaja.
  const afterOffboarding = { ...handedOverProfile, owner: { id: "user-solo", email: "lahkunud@naide.ee" } };
  assert.equal(resolveProviderRecipientUserId(afterOffboarding), null);
  assert.equal(resolveProviderRecipientEmail(afterOffboarding), "profiil@naide.ee");
  assert.notEqual(resolveProviderRecipientEmail(afterOffboarding), "lahkunud@naide.ee");
});

test("LOOJA KONTO KUSTUTAMINE: ownerId muutub NULL-iks, profiil jääb kättesaadavaks", () => {
  // Viil C tegi seosest `SetNull`, seega konto kustutus EI hävita profiili.
  const afterAccountDeletion = { ...handedOverProfile, ownerId: null, owner: null };
  assert.equal(resolveProviderRecipientUserId(afterAccountDeletion), null);
  assert.equal(resolveProviderRecipientEmail(afterAccountDeletion), "profiil@naide.ee");
  assert.equal(resolveProviderRecipientOrganizationId(afterAccountDeletion), "org-1");
});

test("SOLO-profiili looja konto kustutamine jätab profiili ilma adressaadita, mitte vale adressaadiga", () => {
  const orphanSolo = { ...soloProfile, ownerId: null, owner: null };
  assert.equal(resolveProviderRecipientUserId(orphanSolo), null);
  // Profiili enda avalik aadress jääb ainsaks kanaliks.
  assert.equal(resolveProviderRecipientEmail(orphanSolo), "profiil@naide.ee");
});

test("auditi target on org-profiilil null, mitte eraisik", () => {
  assert.equal(resolveProviderAuditTargetUserId(handedOverProfile), null);
  assert.equal(resolveProviderAuditTargetUserId(soloProfile), "user-solo");
});

test("puuduv profiil ei kukuta lahendajaid", () => {
  for (const fn of [
    resolveProviderRecipientUserId,
    resolveProviderRecipientEmail,
    resolveProviderRecipientOrganizationId,
    resolveProviderAuditTargetUserId
  ]) {
    assert.equal(fn(null), null);
    assert.equal(fn(undefined), null);
  }
  assert.equal(isOrganizationOwnedProfile(null), false);
});

test("valik sisaldab kõiki välju, mida lahendajad vajavad", () => {
  // Kui keegi lisab lahendajasse uue välja, aga unustab valiku, tagastaks
  // Prisma `undefined` ja org-profiil näeks välja nagu SOLO — vaikne taandareng.
  for (const field of ["ownerId", "ownershipMode", "organizationId"]) {
    assert.equal(PROVIDER_RECIPIENT_SELECT[field], true, `${field} puudub valikust`);
  }
});

/* ---------------------------------------------------------------------------
   Struktuurne kaitse: tarbijad EI TOHI enam toorest `ownerId`-d adressaadina
   lugeda. Käitumistestid ülal tõendavad lahendaja õigsust; see test tõendab,
   et lahendajast ka MÖÖDA ei minda.
   ------------------------------------------------------------------------- */
const CONSUMERS = [
  "lib/preInquiries.js",
  "lib/notificationReconciler.js",
  "lib/serviceAvailabilityReminders.js",
  "lib/preInquiryRouting.js"
];

test("ükski tarbija ei loe providerProfile.ownerId-d otse", () => {
  for (const file of CONSUMERS) {
    const source = readFileSync(join(root, file), "utf8");
    assert.doesNotMatch(
      source,
      /providerProfile\??\.\s*ownerId/,
      `${file}: loeb providerProfile.ownerId otse — kasuta resolveProviderRecipientUserId`
    );
    assert.match(
      source,
      /from "@\/lib\/org\/profileRecipient"/,
      `${file}: ei impordi jagatud lahendajat`
    );
  }
});

test("kättesaadavuse meeldetuletus ei kasuta omaniku e-posti varuvariandina", () => {
  const source = readFileSync(join(root, "lib/serviceAvailabilityReminders.js"), "utf8");
  assert.doesNotMatch(source, /owner\?\.\s*email\s*\|\|/);
});

test("kättesaadavuse teavituse järelkontroll tunnistab omanikku ainult SOLO-režiimis", () => {
  const source = readFileSync(join(root, "lib/notifications.js"), "utf8");
  assert.match(
    source,
    /SERVICE_AVAILABILITY_STALE[\s\S]*?providerProfile:\s*\{\s*ownerId:\s*userId,\s*ownershipMode:\s*"SOLO"\s*\}/u
  );
});
