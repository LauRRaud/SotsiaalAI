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

export async function generateMetadata() {
  const cookieStore = await cookies()
  const locale = getLocaleFromCookies(cookieStore)
  const messages = getMessagesSync(locale)
  const meta = messages?.documents?.meta || {}

  return buildLocalizedMetadata({
    locale,
    pathname: "/documents/artifacts/[id]",
    title: meta.artifactTitle || meta.title || "Agendi tulemus",
    description: meta.artifactDescription || meta.description || ""
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
