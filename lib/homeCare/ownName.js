/* KODUTEENUS — inimese enda nimi kolleegidele.

   Leitud päris saidi läbimängus 10.10.2026: platvormil ei olnud ühtegi kohta,
   kus inimene saaks oma ees- ja perekonnanime kirja panna (`Profile.firstName`
   ja `lastName` olid ainult loetavad). Koduteenus näitab töötajat nime järgi
   igal pool: päevaplaan, võtmeraamat, teated, külmkapileht. Ilma nimeta seisis
   seal kriips ja kahte töötajat ei saanud eristada.

   Nime paneb kirja INIMENE ISE oma profiili: see on tema nimi, mitte asutuse
   märge tema kohta, ja kehtib kõigis organisatsioonides, kuhu ta kuulub.

   Varasemad read (kes soovi esitas, kes kuu lukustas jms) kannavad nime
   hetktõmmist ja jäävad nii, nagu need kirjutati. */

import prisma from "@/lib/prisma";

import { badRequest, notFound } from "../org/errors.js";
import { cleanPersonName } from "../org/personName.js";

import { assertHomeCareContext } from "./access.js";
import { OWN_NAME_MAX } from "./ownNameLimits.js";

export { OWN_NAME_MAX };

/* Nime kuju ja pikkuse reegel on ühine kutsega antava nimega: `lib/org/personName.js`. */
function cleanName(value, errorKey) {
  const text = cleanPersonName(value);
  if (!text) throw badRequest(errorKey);
  return text;
}

async function ownMembership(db, context) {
  const membershipId = context?.membership?.id;
  const organizationId = context?.organization?.id;
  if (!membershipId || !organizationId) throw notFound("org.errors.not_found");
  const row = await db.organizationMembership.findFirst({
    where: { id: membershipId, organizationId },
    select: { userId: true, user: { select: { profile: { select: { firstName: true, lastName: true } } } } }
  });
  if (!row?.userId) throw notFound("org.errors.not_found");
  return row;
}

function view(profile) {
  const firstName = String(profile?.firstName || "").trim();
  const lastName = String(profile?.lastName || "").trim();
  return { firstName, lastName, complete: Boolean(firstName && lastName) };
}

/** Vaataja enda nimi, nagu kolleegid seda näevad. */
export async function getOwnName(context, { db = prisma, env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const row = await ownMembership(db, context);
  return view(row.user?.profile);
}

/** Inimene paneb kirja oma nime. Mõlemad osad on vajalikud: eesnimi läheb kliendi lehele, täisnimi kolleegidele. */
export async function saveOwnName(context, input = {}, { db = prisma, env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const firstName = cleanName(input?.firstName, "home_care.errors.own_name_first");
  const lastName = cleanName(input?.lastName, "home_care.errors.own_name_last");

  const row = await ownMembership(db, context);
  const profile = await db.profile.upsert({
    where: { userId: row.userId },
    create: { userId: row.userId, firstName, lastName },
    update: { firstName, lastName },
    select: { firstName: true, lastName: true }
  });
  return view(profile);
}
