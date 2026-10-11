/**
 * KODUTEENUS K5-x — asenduse mõju püsivusele (kava II.6.2). Puhas reegel omaette failis:
 * seda loeb ka brauseris töötav ümbertõstmise vorm, mis ei tohi serveri faile kaasa tõmmata.
 *
 * Kui käik tõstetakse töötajale, kes ei ole viimasel neljal nädalal selle kliendi juures
 * käinud, saab klient veel ühe uue näo. Tagastab `null`, kui mõju ei ole (töötaja on seal
 * käinud, töötajat ei ole valitud või kliendil ei olnud sel ajal ühtegi käiku), muidu mitmes
 * eri töötaja ta oleks.
 */
export function continuityImpact(recentWorkerIds, candidateId) {
  const recent = recentWorkerIds || [];
  if (!candidateId || !recent.length || recent.includes(candidateId)) return null;
  return { count: recent.length + 1 };
}
