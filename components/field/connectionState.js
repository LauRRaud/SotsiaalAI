/**
 * Välitöö ühenduse seis ühe sõnana: mida kiirmenüü märk ja lehe teade näitavad.
 *
 * Puhas funktsioon (ilma JSX-ita), et seda saaks testida: `FieldConnection.jsx`
 * ainult joonistab.
 *
 *  - `offline`  võrku ei ole; kõik salvestub seadmesse
 *  - `failed`   võrk on, aga mõni üksus vajab tähelepanu (saatmine ebaõnnestus, konflikt)
 *  - `pending`  võrk on, üksusi on saatmata
 *  - `online`   võrk on ja kõik on saadetud
 *
 * `attention`: kas inimene peab seda teadma ka siis, kui ta kiirmenüüd ei vaata
 * (siis on täislause lehe sisu alguses). Võrgus ja kõik saadetud ei vaja teadet.
 */
export function fieldConnectionState({ online, pendingCount = 0, failedCount = 0, needsLogin = false } = {}) {
  const pending = Math.max(0, Math.trunc(Number(pendingCount) || 0));
  const failed = Math.max(0, Math.trunc(Number(failedCount) || 0));
  const key = !online ? "offline" : failed ? "failed" : pending ? "pending" : "online";
  return { key, pending, failed, needsLogin: Boolean(needsLogin), attention: key !== "online" || Boolean(needsLogin) };
}
