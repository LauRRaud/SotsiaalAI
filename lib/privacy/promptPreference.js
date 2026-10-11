import { prisma } from "@/lib/prisma";

import { PRIVACY_DECISIONS } from "./privacyGuard.js";

/**
 * ISIKUANDMETE HOIATUSE LÜLITI (konto seaded, omaniku soov 11.10.2026).
 *
 * Hoiatus küsib enne saatmist, kui tekstis on isikuandmeid: muuda, saada varjatult või saada
 * siiski. Privaatses töövoos (vestlus abilisega, ruumi sõnum, eelpöördumine, dokumendi
 * koostamine) sai inimene juba enne iga kord valida „saada siiski". Lüliti teeb sellest
 * valikust PÜSIVA: kui hoiatus on väljas ja inimene ei ole selle teksti kohta ise midagi
 * valinud, loetakse otsuseks „saada siiski".
 *
 * MIDA LÜLITI EI MUUDA. Avalikus töövoos (abikuulutus, teadmusbaasi sisu) ei ole „saada siiski"
 * lubatud ka üksikotsusena (`privacyGuard.js`), seega jääb seal küsimine ja varjamine alles.
 * Kuulutuste vaikne varjamine (`redactPersonalData`) ei käi selle lüliti kaudu üldse.
 *
 * Otsus tehakse SERVERIS, igal kontrollil andmebaasist: lehe väide „mul on hoiatus väljas" ei
 * ole volitus. Kui eelistust lugeda ei saa (konto puudub, test ilma kasutajatabelita), on
 * hoiatus sees.
 */

export const STANDING_SEND_ORIGINAL = Object.freeze({ action: PRIVACY_DECISIONS.sendOriginal });

function hasOwnDecision(decision) {
  const action = typeof decision === "object" && decision
    ? decision.action || decision.privacyDecision
    : decision;
  return Boolean(String(action || "").trim());
}

/** Kas sellel inimesel on isikuandmete hoiatus sees? Vaikimisi jah. */
export async function readPrivacyPromptEnabled(userId, { db = prisma } = {}) {
  const id = String(userId || "").trim();
  if (!id || typeof db?.user?.findUnique !== "function") return true;
  const row = await db.user.findUnique({ where: { id }, select: { privacyPromptEnabled: true } });
  return row?.privacyPromptEnabled !== false;
}

/**
 * Otsus, millega kontroll selle teksti läbi laseb: inimese enda valik selle teksti kohta või,
 * kui ta ei ole valinud ja hoiatus on välja lülitatud, püsiv „saada siiski".
 */
export async function resolvePrivacyDecision(userId, decision, { db = prisma } = {}) {
  if (hasOwnDecision(decision)) return decision;
  return (await readPrivacyPromptEnabled(userId, { db })) ? decision : STANDING_SEND_ORIGINAL;
}

/** Salvestab lüliti. Tagastab uue seisu või `null`, kui kontot ei ole. */
export async function savePrivacyPromptEnabled(userId, enabled, { db = prisma } = {}) {
  const id = String(userId || "").trim();
  if (!id || typeof enabled !== "boolean") return null;
  const updated = await db.user.updateMany({ where: { id }, data: { privacyPromptEnabled: enabled } });
  return updated.count === 1 ? { enabled } : null;
}
