import { openOwnerScopedStore, purgeUnscopedRows } from "@/lib/device/ownerScopedStorage";

/**
 * AKTIIVSE VESTLUSE ID ON KONTO JA ROLLI OMA, MITTE VAHEKAARDI OMA (SOL-CHAT-11).
 *
 * MIS OLI VALESTI. Vestluse SISU elas juba kasutaja, rolli ja keele järgi eraldatud võtme all,
 * aga see, MILLINE vestlus on aktiivne, loeti alati üldisest `sotsiaalai:chat:convId` reast — ja
 * seda rida kirjutasid kolm kohta (hook, `ChatBody`, `ChatSidebar`). Samas vahekaardis kontot
 * vahetades jätkas uus kasutaja EELMISE konto vestluse ID-ga: server keelas õigesti ajaloo
 * lugemise (403), aga uue sõnumi püsistus lõpetas vaikselt ja tasuline vastus kadus. Rollivahetus
 * omakorda uuendas vana vestluse rolli ja segas kliendi- ning spetsialistivaate sisu ühe ID alla.
 *
 * KAKS ASJA, MIS SEDA PARANDAVAD:
 *
 *  1. **Skoop.** Rida on `sotsiaalai:chat:convId:<roll>` ja tema ees on omanikupiire
 *     (`lib/device/ownerScopedStorage.js`) — sama primitiiv, mis SOL-SLOG-01 ja SOL-JOUR-02 juures.
 *     Omanikku ei ole → **`null`** → identiteedita hetk ei loe ega kirjuta midagi.
 *  2. **Vana rea kustutus.** Sildistamata `sotsiaalai:chat:convId` ei kuulu kellelegi ja teda ei
 *     saa tagantjärele omistada; ta kustutatakse esimesel lugemisel. Anda ta esimesele avajale
 *     oleks täpselt see leke, mida parandame.
 *
 * ÜKS KOHT, MITTE KOLM. Kolm koopiat sama võtme loogikast lahkneksid; see moodul on see üks koht.
 */

const LEGACY_ACTIVE_CONVERSATION_ROW = "sotsiaalai:chat:convId";

function normalizeRole(role) {
  const value = String(role || "").trim().toLowerCase();
  return value || "client";
}

export function activeConversationRow(role) {
  return `${LEGACY_ACTIVE_CONVERSATION_ROW}:${normalizeRole(role)}`;
}

function openStore(storage, ownerId) {
  if (!storage) return null;
  // Sildistamata pärandrida kaob esimesel puutel, sõltumata sellest, kes parasjagu vaatab.
  purgeUnscopedRows(storage, [LEGACY_ACTIVE_CONVERSATION_ROW]);
  return openOwnerScopedStore(storage, ownerId);
}

export function readActiveConversationId(storage, { userId, role } = {}) {
  const store = openStore(storage, userId);
  if (!store) return null;
  const value = store.getItem(activeConversationRow(role));
  const trimmed = String(value || "").trim();
  return trimmed || null;
}

export function writeActiveConversationId(storage, { userId, role } = {}, conversationId) {
  const store = openStore(storage, userId);
  if (!store) return false;
  const value = String(conversationId || "").trim();
  if (!value) return false;
  store.setItem(activeConversationRow(role), value);
  return true;
}

export function clearActiveConversationId(storage, { userId, role } = {}) {
  const store = openStore(storage, userId);
  if (!store) return false;
  store.removeItem(activeConversationRow(role));
  return true;
}

/**
 * Kustuta aktiivne vestlus, kui ta on täpselt see, mille kutsuja kustutas/arhiveeris.
 * Vastasel juhul EI puututa — võõra vahekaardi valikut ei tohi ära võtta.
 */
export function clearActiveConversationIdIfMatches(storage, scope, conversationId) {
  const current = readActiveConversationId(storage, scope);
  if (!current || current !== String(conversationId || "").trim()) return false;
  return clearActiveConversationId(storage, scope);
}
