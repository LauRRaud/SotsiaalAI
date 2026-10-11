/**
 * Organisatsiooni teenuseprofiili osa (`/org/<id>/teenusprofiil`) reeglid ilma
 * joonistamiseta: vormi algseis, kas midagi on muudetud, toimetajate nimed ja
 * üle antava profiili nimi.
 *
 * Leht (`../OrgProfileClient.jsx`) hoiab olekut ja teeb päringud, vaated
 * (`./ProfileViews.jsx`) joonistavad. Test: `tests/org-profile-views.test.mjs`.
 */

/** Osa vaated lahtritena. */
export const PROFILE_TABS = Object.freeze(["data", "text", "editors"]);

/** Vormi väljad selles järjekorras, nagu need serverisse lähevad. */
export const PROFILE_FIELDS = Object.freeze(["organizationName", "shortDescription", "phone", "email", "website"]);

function text(value) {
  return typeof value === "string" ? value : "";
}

/** Vormi algseis profiilist: puuduv väli on tühi tekst. */
export function formFromProfile(profile) {
  const form = {};
  for (const field of PROFILE_FIELDS) form[field] = text(profile?.[field]);
  return form;
}

/** Kas vormis on midagi, mis erineb salvestatud profiilist. */
export function profileDirty(form, profile) {
  const saved = formFromProfile(profile);
  return PROFILE_FIELDS.some((field) => text(form?.[field]) !== saved[field]);
}

/** Toimetaja nimi; nimeta toimetaja puhul e-post. Sisemist ID-d ei näidata. */
export function editorName(editor, { t }) {
  return [text(editor?.firstName).trim(), text(editor?.lastName).trim()].filter(Boolean).join(" ") || text(editor?.email).trim() || t("org.support.unnamed");
}

/** Toimetajate nimed loendina. */
export function editorNames(editors, { t }) {
  return (Array.isArray(editors) ? editors : []).map((editor) => ({ id: String(editor?.membershipId || ""), name: editorName(editor, { t }) }));
}

/**
 * Üle antava profiili nimi. MIS profiili inimene üle annab, peab olema öeldud:
 * üleandmine on pöördumatu ja ilma nimeta on kinnitus pime. Nimeta profiil saab
 * üldnime (vana leht näitas siis sisemist ID-d).
 */
export function convertSubject(convertibleProfile, { t }) {
  return text(convertibleProfile?.organizationName).trim() || t("org.profile.unnamed_profile");
}

/** Milline vaade on ees: inimese valik, kui see on päris vaade. */
export function shownProfileTab(wanted) {
  return PROFILE_TABS.includes(wanted) ? wanted : "data";
}
