import { unstable_noStore as noStore } from "next/cache";
import { notFound, redirect } from "next/navigation";

import prisma from "@/lib/prisma";
import { resolveOrgAccessContext } from "@/lib/org/accessContext";
import { isOrgInboxEnabled } from "@/lib/org/flags";
import { getInboxItem, hadWorkOnInboxItem } from "@/lib/org/inbox";

import { requireOrgSession } from "../../_serverContext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const metadata = {
  title: "Pöördumine - Sotsiaal.pro",
  robots: { index: false, follow: false, nocache: true }
};

/**
 * `/org/vastuvott/[itemId]` — TEAVITUSE SIHTKOHT, mitte vaade.
 *
 * MIKS SEE OLEMAS ON: teavituse link ei tohi kanda organisatsiooni ID-d.
 * Kui link oleks `/org/{orgId}/vastuvott/{itemId}`, lekitaks juba URL ise
 * fakti, MILLISESSE organisatsiooni see töö kuulub — ka siis, kui saaja
 * teavitust ei avanud või kui see edastati kellelegi teisele.
 *
 * Siin lahendatakse organisatsioon alles PÄRAST õiguskontrolli ja siis
 * suunatakse päris vaatesse. Kes kirjet näha ei tohi, saab 404 — sama vastuse
 * kui olematu kirje puhul. Erand on endine vastutaja, kes jõuab asutuse
 * vastuvõtulauale (vt lõpust).
 */
export default async function OrgInboxItemRedirectPage({ params }) {
  noStore();
  const { itemId } = await params;
  if (!isOrgInboxEnabled()) notFound();

  const auth = await requireOrgSession(`/org/vastuvott/${itemId}`);

  /* Organisatsioon loetakse kirjelt, MITTE kasutaja sisendist — muidu saaks
     keegi proovida võõra kirje ID-d oma organisatsiooni kontekstis. */
  const item = await prisma.organizationInboxItem.findUnique({
    where: { id: itemId },
    select: { id: true, organizationId: true }
  });
  if (!item) notFound();

  let context;
  try {
    context = await resolveOrgAccessContext({
      userId: auth.userId,
      requestedOrganizationId: item.organizationId,
      isPlatformAdmin: Boolean(auth.roleState?.isAdmin),
      productRole: auth.roleState?.effectiveRole
    });
  } catch {
    notFound();
  }
  if (!(context.activeModules || []).includes("KOV_INTAKE")) notFound();

  /* Sama värav kui päris vaates: `getInboxItem` viskab 404, kui vaataja ei ole
     koordinaator ega määratud töötaja. Kontrollime SIIN, et suunamine ise ei
     muutuks olemasolu-oraakliks. */
  let visible = true;
  try {
    await getInboxItem(context, item.id);
  } catch {
    visible = false;
  }
  if (visible) redirect(`/org/${item.organizationId}/vastuvott/${item.id}`);

  /* Endine vastutaja: töö võeti tagasi või anti teisele ja teade „töö ei ole enam sinu
     vastutusel" viib siia. Kirjet ta enam ei ava, aga „lehte ei leitud" oleks tema jaoks
     vale vastus: ta jõuab asutuse vastuvõtulauale, kus on tema ülejäänud töö. Kõik teised
     saavad endiselt 404. */
  if (await hadWorkOnInboxItem(context, item.id)) redirect(`/org/${item.organizationId}/vastuvott`);
  notFound();
}
