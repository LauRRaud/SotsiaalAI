/* PROFIIL — inimese enda ees- ja perekonnanimi.
 *
 * Nime sai seni kirja panna ainult koduteenuse avalehel (`lib/homeCare/ownName.js`) või saada
 * kutsega (`lib/org/inviteService.js`). Inimene, kes koduteenust ei kasuta, ei saanud oma nime
 * platvormil üldse sisestada ega parandada. Reegel on kõigis kolmes kohas sama
 * (`lib/org/personName.js`): mõlemad osad on vajalikud ja kuju peab olema nime oma.
 *
 * Nimi on inimese enda oma ja kehtib kõigis organisatsioonides, kuhu ta kuulub. Varasemad
 * read, mis kannavad nime hetktõmmist, jäävad nii, nagu need kirjutati.
 */

import { PERSON_NAME_MAX, cleanPersonName } from "../org/personName.js";

function view(profile) {
  const firstName = String(profile?.firstName || "").trim();
  const lastName = String(profile?.lastName || "").trim();
  return { firstName, lastName, complete: Boolean(firstName && lastName) };
}

/** Inimese nimi profiililehe jaoks. `profile` on `Profile` rida või `null`. */
export function profileNameView(profile) {
  return view(profile);
}

/**
 * Salvestab inimese enda nime. Tagastab `{ ok: true, name }` või `{ ok: false, error }`,
 * kus `error` on `{ status, messageKey, details }`: marsruut ei pea reeglit tundma.
 */
export async function saveProfileNameForUser({ db, userId, firstName, lastName }) {
  const id = String(userId || "").trim();
  if (!id) return { ok: false, error: { status: 401, messageKey: "api.common.unauthorized" } };

  const first = cleanPersonName(firstName);
  if (!first) return { ok: false, error: { status: 400, messageKey: "profile.name.error_first", details: { limit: PERSON_NAME_MAX } } };
  const last = cleanPersonName(lastName);
  if (!last) return { ok: false, error: { status: 400, messageKey: "profile.name.error_last", details: { limit: PERSON_NAME_MAX } } };

  const names = { firstName: first, lastName: last };
  const profile = await db.profile.upsert({
    where: { userId: id },
    create: { userId: id, ...names },
    update: names,
    select: { firstName: true, lastName: true }
  });
  return { ok: true, name: view(profile) };
}
