#!/usr/bin/env node
/**
 * SOL-SPROF-01 ja SOL-SPROF-02 — „eemaldatud" peab tähendama eemaldatut.
 *
 *   npm run sprof:consent:probe
 *
 * MIDA SEE TÕENDAB, mida `npm test` ei saa: päris ridu, päris tehingut ja
 * päris järjekorda. Fake-Prisma ei ütle midagi selle kohta, kas konto kustutus
 * jõudis profiilini enne `user.delete`-i või kas järjekorda jäi rida.
 *
 * RAG-teenust EI kutsuta: kustutus on siin süstitud port, mille käitumist
 * (õnnestub / kukub) sond ise juhib. Just see on mõte — leid oli selles, et
 * KUKKUMIST ei vaadatud.
 *
 * Andmed: ainult `@sol-sprof.invalid` sünteetilised kontod; skript koristab lõpus.
 */

import prisma from "../lib/prisma.js";
import { removeServiceProfileFromRag } from "../lib/privacy/serviceProfileRagRemoval.js";
import { filterRevokedServiceProfileMatches } from "../lib/privacy/serviceProfileRetrievalGuard.js";
import { deleteUserAfterFinalPracticeSweep } from "../lib/privacy/effectivePracticeAccountCleanup.js";

const SUFFIX = "@sol-sprof.invalid";
const MARK = "(sprof-sünteetiline)";

let passed = 0;
let failed = 0;
const created = { userIds: [] };

const ok = (label) => { passed += 1; console.log(`  PASS  ${label}`); };
const bad = (label, detail) => { failed += 1; console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`); };
const expect = (label, cond, detail) => (cond ? ok(label) : bad(label, detail));

const docIdFor = (profileId) => `service-provider-profile::${profileId}`;
const matchFor = (profileId) => ({ doc_id: docIdFor(profileId), text: "sünteetiline lõik" });

async function makeUser(local) {
  const user = await prisma.user.create({
    data: { email: `${local}${SUFFIX}`, role: "SERVICE_PROVIDER", emailVerified: new Date(), acceptsPreInquiries: false }
  });
  created.userIds.push(user.id);
  return user;
}

async function makeProfile(owner, { allowed = true, status = "PUBLISHED" } = {}) {
  const profile = await prisma.serviceProviderProfile.create({
    data: {
      ownerId: owner.id,
      ownershipMode: "SOLO",
      organizationName: `Osutaja ${MARK}`,
      status,
      assistantRecommendationAllowed: allowed
    }
  });
  await prisma.serviceProviderProfile.update({
    where: { id: profile.id },
    data: { ragSourceId: docIdFor(profile.id) }
  });
  return prisma.serviceProviderProfile.findUnique({ where: { id: profile.id } });
}

async function purge() {
  const users = await prisma.user.findMany({ where: { email: { endsWith: SUFFIX } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  const profiles = await prisma.serviceProviderProfile.findMany({
    where: { organizationName: { contains: MARK } },
    select: { id: true }
  });
  await prisma.serviceMapEntry.deleteMany({ where: { title: { contains: MARK } } });
  const profileIds = profiles.map((p) => p.id);
  if (profileIds.length) {
    await prisma.serviceMapEntry.deleteMany({ where: { providerProfileId: { in: profileIds } } });
    await prisma.dataDeletionJob.deleteMany({ where: { resourceId: { in: profileIds } } });
    await prisma.serviceProviderProfile.deleteMany({ where: { id: { in: profileIds } } });
  }
  if (ids.length) await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

async function main() {
  console.log("SOL-SPROF-01/-02 — eemaldatud tähendab eemaldatut\n");
  await purge();

  // === 1. KUKKUNUD KUSTUTUS EI TOHI ÖELDA „removed" =======================
  {
    const owner = await makeUser("revoke");
    const profile = await makeProfile(owner);

    const removal = await removeServiceProfileFromRag(
      {
        profileId: profile.id,
        ragSourceId: profile.ragSourceId,
        reason: "assistant_recommendation_not_allowed",
        targetUserId: owner.id
      },
      { db: prisma, deleteDocument: async () => ({ ok: false, error: new Error("teenus maas") }) }
    );
    await prisma.serviceProviderProfile.update({ where: { id: profile.id }, data: removal.data });

    const row = await prisma.serviceProviderProfile.findUnique({ where: { id: profile.id } });
    expect("kukkunud kustutus: seis on pending_removal, mitte removed", row.ragMetadata?.syncStatus === "pending_removal", row.ragMetadata?.syncStatus);
    expect("kukkunud kustutus: VIIT jääb alles — orb peab leitav olema", row.ragSourceId === docIdFor(profile.id));
    const job = await prisma.dataDeletionJob.findFirst({
      where: { resourceType: "ServiceProviderProfile", externalRef: docIdFor(profile.id) }
    });
    expect("kukkunud kustutus: püsiv töö on järjekorras", job?.status === "pending", job?.status);
    expect("töö kannab masinloetavat põhjust, mitte kasutaja teksti", job?.storagePath === "assistant_recommendation_not_allowed");

    // Korduv tagasivõtmine ei tohi teist tööd tekitada.
    await removeServiceProfileFromRag(
      { profileId: profile.id, ragSourceId: row.ragSourceId, reason: "assistant_recommendation_not_allowed", targetUserId: owner.id },
      { db: prisma, deleteDocument: async () => ({ ok: false }) }
    );
    const jobCount = await prisma.dataDeletionJob.count({
      where: { resourceType: "ServiceProviderProfile", externalRef: docIdFor(profile.id) }
    });
    expect("korduv tagasivõtmine ei tekita teist tööd", jobCount === 1, `${jobCount}`);

    // === 2. RETRIEVAL PEATUB KOHE, mitte alles kinnituse järel ============
    /* Profiil on endiselt PUBLISHED, aga luba on maas — täpselt see seis, kus
       vana kood oleks teda edasi soovitanud, sest kaugkoopia oli veel olemas. */
    await prisma.serviceProviderProfile.update({
      where: { id: profile.id },
      data: { assistantRecommendationAllowed: false }
    });
    const guarded = await filterRevokedServiceProfileMatches(
      [matchFor(profile.id), { doc_id: "kov::midagi-muud", text: "seotud" }],
      { db: prisma }
    );
    expect("loata profiil kaob vastustest KOHE", !guarded.some((m) => m.doc_id === docIdFor(profile.id)));
    expect("muu allikas jääb puutumata", guarded.some((m) => m.doc_id === "kov::midagi-muud"));
  }

  // === 3. NEGATIIVKONTROLL — lubatud profiil jääb alles ===================
  {
    const owner = await makeUser("allowed");
    const profile = await makeProfile(owner, { allowed: true, status: "PUBLISHED" });
    const guarded = await filterRevokedServiceProfileMatches([matchFor(profile.id)], { db: prisma });
    expect("negatiivkontroll — kehtiva loaga profiil JÄÄB vastustesse", guarded.length === 1);

    const confirmed = await removeServiceProfileFromRag(
      { profileId: profile.id, ragSourceId: profile.ragSourceId, reason: "profile_not_published", targetUserId: owner.id },
      { db: prisma, deleteDocument: async () => ({ ok: true }) }
    );
    await prisma.serviceProviderProfile.update({ where: { id: profile.id }, data: confirmed.data });
    const row = await prisma.serviceProviderProfile.findUnique({ where: { id: profile.id } });
    expect("kinnitatud kustutus: seis on removed", row.ragMetadata?.syncStatus === "removed");
    expect("kinnitatud kustutus: viit kustus", row.ragSourceId === null);
    const job = await prisma.dataDeletionJob.findFirst({
      where: { resourceType: "ServiceProviderProfile", externalRef: docIdFor(profile.id) }
    });
    expect("kinnitatud kustutus: töö on suletud", job?.status === "done", job?.status);
  }

  // === 4. FAIL-CLOSED: kontrollimata luba ei ole luba =====================
  {
    const owner = await makeUser("failclosed");
    const profile = await makeProfile(owner, { allowed: true });
    const guarded = await filterRevokedServiceProfileMatches([matchFor(profile.id)], { db: null });
    expect("andmebaasita värav kukutab profiilivasted, ei lase neid läbi", guarded.length === 0);
  }

  // === 5. SOL-SPROF-01: konto kustutus ====================================
  {
    const owner = await makeUser("deleted");
    const profile = await makeProfile(owner, { allowed: true, status: "PUBLISHED" });
    await prisma.serviceMapEntry.create({
      data: {
        providerProfileId: profile.id,
        type: "SERVICE_PROVIDER",
        title: `Kaardikirje ${MARK}`,
        status: "PUBLISHED"
      }
    });

    const result = await deleteUserAfterFinalPracticeSweep(owner.id, prisma);
    expect("konto kustutus: loendur ütleb, mitu profiili peideti", result.privacyCounts.hiddenServiceProfiles === 1, `${result.privacyCounts.hiddenServiceProfiles}`);
    expect("konto kustutus: loendur ütleb, mitu kaardikirjet peideti", result.privacyCounts.hiddenServiceMapEntries === 1);
    expect("konto kustutus: loendur ütleb, mitu RAG-tööd tekkis", result.privacyCounts.queuedServiceProfileRagDeletions === 1);

    const row = await prisma.serviceProviderProfile.findUnique({ where: { id: profile.id } });
    expect("konto kustutus: profiil on HIDDEN", row?.status === "HIDDEN", row?.status);
    expect("konto kustutus: profiil jäi ilma omanikuta alles (SetNull)", row?.ownerId === null);
    const publicEntries = await prisma.serviceMapEntry.count({
      where: { providerProfileId: profile.id, status: "PUBLISHED" }
    });
    expect("konto kustutus: AVALIKKE kaardivasteid on 0", publicEntries === 0, `${publicEntries}`);
    const job = await prisma.dataDeletionJob.findFirst({
      where: { resourceType: "ServiceProviderProfile", externalRef: docIdFor(profile.id) }
    });
    expect("konto kustutus: RAG-koopiale jäi püsiv töö", job?.status === "pending");
    expect("töö nimetab põhjuse", job?.storagePath === "owner_account_deleted");
    expect("konto kustutus: kasutaja rida on läinud", (await prisma.user.findUnique({ where: { id: owner.id } })) === null);

    const guarded = await filterRevokedServiceProfileMatches([matchFor(profile.id)], { db: prisma });
    expect("kustutatud konto profiil ei jõua enam vastustesse", guarded.length === 0);
  }
}

async function cleanup() {
  console.log("\ncleanup");
  await purge();
  const left = await prisma.serviceProviderProfile.count({ where: { organizationName: { contains: MARK } } });
  console.log(`  leftovers: ${left} profiles, ${await prisma.user.count({ where: { email: { endsWith: SUFFIX } } })} users`);
}

try {
  await main();
} catch (error) {
  failed += 1;
  console.error("\nUNCAUGHT", error);
} finally {
  await cleanup();
  await prisma.$disconnect();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
