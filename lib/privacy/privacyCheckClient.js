const TRANSIENT_PRIVACY_CHECK_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const DEFAULT_RETRY_DELAYS = [650, 1600];

function wait(delay) {
  return new Promise(resolve => setTimeout(resolve, delay));
}

export async function requestPrivacyCheck({
  text,
  workflow,
  fetchImpl = fetch,
  waitImpl = wait,
  retryDelays = DEFAULT_RETRY_DELAYS
} = {}) {
  const delays = Array.isArray(retryDelays) ? retryDelays : DEFAULT_RETRY_DELAYS;
  let lastError = null;

  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    try {
      const response = await fetchImpl("/api/privacy/check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text,
          workflow
        })
      });
      const payload = await response.json().catch(() => ({}));
      const transient = TRANSIENT_PRIVACY_CHECK_STATUSES.has(response.status);
      if (!transient || attempt >= delays.length) {
        return {
          response,
          payload,
          attempts: attempt + 1
        };
      }
      lastError = null;
    } catch (error) {
      lastError = error;
      if (attempt >= delays.length) throw error;
    }

    await waitImpl(Math.max(0, Number(delays[attempt]) || 0));
  }

  throw lastError || new Error("privacy_check_failed");
}
