// Tasuta loendus: mitme teenuseprofiili nimi vastab äriregistrile (lib/businessRegisterNames.js).
// Ainult lugemine; väljastab arvud, mitte ühtki nime, koodi ega kontakti.
//
//   node --import ./scripts/register-node-source-loader.mjs scripts/service-profile-register-name-count.mjs
//
// Milleks: nimekontroll käib kinnitamisel ja avaldatud profiili salvestamisel. Profiil, mis avaldati
// enne seda reeglit, või asutus, mille nimi on registris hiljem muutunud, jääb avalikuks kuni
// järgmise salvestamiseni. See loendus näitab, kas selliseid on (`published` all muu kui `match`
// ja `free`).
import { RegisterNameResult, loadRegisterNamesOrNull, registerNameCheck, registerNamesMeta } from "../lib/businessRegisterNames.js";
import { prisma } from "../lib/prisma.js";

try {
  const [profiles, names, meta] = await Promise.all([
    prisma.serviceProviderProfile.findMany({ select: { status: true, registryCode: true, organizationName: true } }),
    loadRegisterNamesOrNull(),
    registerNamesMeta()
  ]);
  const counts = { total: profiles.length, published: {}, other: {} };
  for (const profile of profiles) {
    const group = String(profile.status || "").toUpperCase() === "PUBLISHED" ? counts.published : counts.other;
    const { result } = registerNameCheck(names, profile);
    group[result] = (group[result] || 0) + 1;
  }
  const allowed = new Set([RegisterNameResult.MATCH, RegisterNameResult.FREE]);
  process.stdout.write(`${JSON.stringify({
    registerDate: meta?.sourceLastModified || meta?.builtAt || null,
    registerEntries: meta?.entries || 0,
    ...counts,
    publishedNotAllowed: Object.entries(counts.published).filter(([result]) => !allowed.has(result)).reduce((sum, [, count]) => sum + count, 0)
  }, null, 2)}\n`);
} finally {
  await prisma.$disconnect();
}
