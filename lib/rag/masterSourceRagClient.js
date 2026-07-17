function endpoint(baseUrl, path) {
  return `${String(baseUrl || "").replace(/\/+$/u, "")}${path}`;
}

async function request(fetchImpl, url, options) {
  const response = await fetchImpl(url, options);
  if (!response.ok) throw new Error(`rag_http_${response.status}`);
  return response;
}

export function createMasterSourceRagClient({ baseUrl, apiKey, fetchImpl = fetch } = {}) {
  if (!baseUrl) throw new TypeError("baseUrl is required");
  const headers = apiKey ? { "X-API-Key": apiKey } : {};
  return {
    async ingestText(payload) {
      await request(fetchImpl, endpoint(baseUrl, "/ingest/text"), { method: "POST", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify(payload) });
    },
    async countChunks(docId) {
      const response = await fetchImpl(endpoint(baseUrl, `/documents/${encodeURIComponent(docId)}/chunks`), { headers });
      if (response.status === 404) return 0;
      if (!response.ok) throw new Error(`rag_http_${response.status}`);
      const payload = await response.json();
      return Number(payload?.count || 0);
    },
    async patchMetadata(docId, metadata) {
      await request(fetchImpl, endpoint(baseUrl, `/documents/${encodeURIComponent(docId)}/patch-meta`), { method: "POST", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify({ metadata }) });
    },
    async deleteDocument(docId) {
      const response = await fetchImpl(endpoint(baseUrl, `/documents/${encodeURIComponent(docId)}`), { method: "DELETE", headers });
      if (!response.ok && response.status !== 404) throw new Error(`rag_http_${response.status}`);
    }
  };
}
