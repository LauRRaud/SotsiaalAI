import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import OrgSupportClient from "@/components/org/OrgSupportClient";
import { hasCapability } from "@/lib/org/accessContext";
import { OrganizationCapability } from "@/lib/org/constants";
import {
  listReportingLines,
  listSupportContactCandidates,
  listSupportContacts,
  listSupportRecipients
} from "@/lib/org/support";
import { listOrganizationSupportMeasures } from "@/lib/org/supportMeasures";
import { listOwnSupportSharePage, listReceivedSupportSharePage } from "@/lib/org/supportShare";
import { getWellbeingOutputDraftForUser } from "@/lib/wellbeing/supportDrafts";

import { requireOrgPageContext } from "../../_serverContext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const metadata = {
  title: "Tugi - Sotsiaal.pro",
  robots: { index: false, follow: false, nocache: true }
};

/* Tööheaolu mustandid, millel on asutuses päris saaja: abipalve (tugikontakt
   või juht) ja juhiga arutelu memo (juht). */
const ORG_ROUTE_RECIPIENT_TYPES = new Set(["pilot_support_contact", "manager"]);

/**
 * Tööheaolu sild (TO-6): `?mustand=<id>` eeltäidab saatmise kokkuvõtte
 * inimese ENDA kinnitatud abipalve või juhimemoga. Võõras, kinnitamata või muu
 * liigi mustand jäetakse vaikselt kõrvale ja vorm on siis tühi. Midagi ei
 * saadeta enne, kui inimene saaja valib ja saatmise kinnitab.
 */
async function confirmedSupportRequest(userId, draftId) {
  const id = typeof draftId === "string" ? draftId.trim().slice(0, 64) : "";
  if (!id) return null;
  const draft = await getWellbeingOutputDraftForUser(userId, id).catch(() => null);
  if (
    !draft
    || !ORG_ROUTE_RECIPIENT_TYPES.has(draft.recipientType)
    || draft.status !== "ready_to_share"
    || draft.userConfirmed !== true
    || draft.visibility !== "private"
  ) {
    return null;
  }
  const summary = String(draft.editedText || draft.generatedText || "").trim();
  return summary ? { summary, sourceDraftId: draft.id, sourceRecordId: draft.sourceRecordId || null } : null;
}

/**
 * Tugivaade on IGA aktiivse liikme oma — siin ei ole capability-väravat.
 *
 * Põhjus: toeavaldus on töötaja õigus, mitte haldusfunktsioon. Kui selle taha
 * paneks capability, oleks tugi asi, mida organisatsioon lubab — mitte asi,
 * mida inimene ise algatab.
 *
 * Moodulivärav on samuti teadlikult puudu: `PROFESSIONAL_SUPPORT` reguleerib
 * seda, kas organisatsioon tugikontakte HALDAB. Kui tugiteid ei ole, näeb
 * inimene tühja loendit — mitte 404-t, mis jätaks mulje, et tuge ei ole olemas.
 */
export default async function OrgSupportPage({ params, searchParams }) {
  noStore();
  const { orgId } = await params;
  const query = (await searchParams) || {};
  const auth = await requireOrgPageContext(orgId, `/org/${orgId}/tugi`);
  const membershipId = auth.context.membership?.id;
  if (!membershipId) notFound();

  /* Haldusnupud on mugavus; tõde on route'i `SUPPORT_CONTACT_ADMIN` värav. */
  const canManage =
    auth.context.writable !== false && hasCapability(auth.context, OrganizationCapability.SUPPORT_CONTACT_ADMIN);

  const [recipients, receivedPage, sentPage, measures, contacts, candidates, reportingLines, prefill] = await Promise.all([
    listSupportRecipients(orgId, membershipId),
    listReceivedSupportSharePage(membershipId),
    listOwnSupportSharePage(auth.userId, { organizationId: orgId }),
    listOrganizationSupportMeasures(orgId),
    canManage ? listSupportContacts(orgId) : [],
    canManage ? listSupportContactCandidates(orgId) : [],
    canManage ? listReportingLines(orgId) : [],
    confirmedSupportRequest(auth.userId, query.mustand)
  ]);

  return (
    <OrgSupportClient
      context={auth.context}
      recipients={recipients}
      receivedPage={receivedPage}
      sentPage={sentPage}
      measures={measures}
      canManage={canManage}
      contacts={contacts}
      candidates={candidates}
      reportingLines={reportingLines}
      prefill={prefill}
    />
  );
}
