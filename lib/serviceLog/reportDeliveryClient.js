/**
 * Loeb kogu HTTP keha enne delivery kinnitamist. `readBody` tõrke korral
 * (sh katkenud stream) ei kutsuta `confirm`-i kunagi.
 */
export async function receiveReportBody(response, { readBody, tokenFromBody = false, confirm }) {
  if (!response?.ok) return null;
  const body = await readBody(response);
  const deliveryToken = tokenFromBody
    ? body?.deliveryToken
    : response.headers?.get?.("x-sotsiaalai-report-delivery");
  if (!deliveryToken || !(await confirm(deliveryToken))) return null;
  return body;
}
