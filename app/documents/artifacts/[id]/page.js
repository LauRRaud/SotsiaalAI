import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authConfig } from "@/auth"
import ArtifactDetailPage from "@/components/documents/ArtifactDetailPage"
import SubscriptionReadOnlyBanner from "@/components/ui/SubscriptionReadOnlyBanner"
import { requireSubscription, roleFromSession } from "@/lib/authz"
import { getLocaleFromCookies, getMessagesSync } from "@/lib/i18n"
import { localizePath } from "@/lib/localizePath"
import { buildLocalizedMetadata } from "@/lib/metadata"

/* Vahelehe nimi tuleb kataloogist lehe keeles: rühma `documents.meta` kataloogis
   ei ole, nii et varem oli nimi igas keeles eestikeelne varutekst. Aadress on
   dokumentide lehe oma (nagu teistel alamlehtedel), mitte marsruudi muster
   nurksulgudega: üksiku teksti leht ei ole avalik aadress. */
export async function generateMetadata() {
  const cookieStore = await cookies()
  const locale = getLocaleFromCookies(cookieStore)
  const messages = getMessagesSync(locale)

  return buildLocalizedMetadata({
    locale,
    pathname: "/documents",
    title: messages?.documents?.artifact_detail_title || messages?.documents?.page_title || undefined,
    description: ""
  })
}

export default async function Page({ params }) {
  const cookieStore = await cookies()
  const locale = getLocaleFromCookies(cookieStore)
  const session = await getServerSession(authConfig).catch(() => null)
  /* KÕVA REEGEL: 402 ei suuna — oma tulemuse vaatamine/allalaadimine on lahti. */
  const gate = await requireSubscription(session, roleFromSession(session))
  if (!gate.ok && gate.status !== 402) {
    redirect(localizePath(gate.redirect || "/tellimus", locale))
  }
  const subscriptionInactive = !gate.ok

  const resolvedParams = await params
  return (
    <>
      {subscriptionInactive ? <SubscriptionReadOnlyBanner /> : null}
      <ArtifactDetailPage artifactId={resolvedParams?.id} />
    </>
  )
}
