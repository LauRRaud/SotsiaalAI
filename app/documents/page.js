import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authConfig } from "@/auth"
import DocumentsPage from "@/components/documents/DocumentsPage"
import SubscriptionReadOnlyBanner from "@/components/ui/SubscriptionReadOnlyBanner"
import { requireSubscription, resolveSessionRoleState } from "@/lib/authz"
import { getLocaleFromCookies, getMessagesSync } from "@/lib/i18n"
import { buildLocalizedMetadata } from "@/lib/metadata"
import { localizePath } from "@/lib/localizePath"

export async function generateMetadata() {
  const cookieStore = await cookies()
  const locale = getLocaleFromCookies(cookieStore)
  const messages = getMessagesSync(locale)
  const meta = messages?.documents?.meta || {}

  return buildLocalizedMetadata({
    locale,
    pathname: "/documents",
    title: meta.title || "Dokumendid",
    description: meta.description || ""
  })
}

export default async function Page() {
  const cookieStore = await cookies()
  const session = await getServerSession(authConfig).catch(() => null)
  const locale = getLocaleFromCookies(cookieStore)

  const roleState = resolveSessionRoleState(session, cookieStore)
  /* KÕVA REEGEL: 402 ei suuna — failide lugemine/allalaadimine/kustutamine
     jääb lahti, riba selgitab; loomine ja AI on API-s endiselt värava taga. */
  const gate = await requireSubscription(session, roleState.effectiveRole)
  if (!gate.ok && gate.status !== 402) {
    redirect(localizePath(gate.redirect || "/tellimus", locale))
  }
  const subscriptionInactive = !gate.ok
  return (
    <>
      {subscriptionInactive ? <SubscriptionReadOnlyBanner /> : null}
      <DocumentsPage />
    </>
  )
}
