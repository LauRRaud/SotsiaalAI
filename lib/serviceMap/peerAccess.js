export async function loadPeerServiceMapEntries({ userId = "", query = {}, db, loadHelpEntries }) {
  if (!userId) {
    return { entries: [], page: null, peerListingsAvailable: false, peerListingsAccess: "AUTH_REQUIRED" };
  }
  const result = await loadHelpEntries({ ...query, currentUserId: userId }, db);
  return {
    entries: Array.isArray(result) ? result : result.entries,
    page: Array.isArray(result) ? null : result.page,
    peerListingsAvailable: true,
    peerListingsAccess: "AUTHORIZED"
  };
}
