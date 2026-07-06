import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authConfig } from "@/auth"
import AgentModePage from "@/components/agent/AgentModePage"
import { requireSubscription, roleFromSession } from "@/lib/authz"
import { getLocaleFromCookies, getMessagesSync } from "@/lib/i18n"
import { localizePath } from "@/lib/localizePath"
import { buildLocalizedMetadata } from "@/lib/metadata"

export async function generateMetadata() {
  const cookieStore = await cookies()
  const locale = getLocaleFromCookies(cookieStore)
  const messages = getMessagesSync(locale)
  const title = messages?.chat?.tools?.agent_mode || messages?.documents?.agent_handoff?.title || "Dokumendi koostamine"
  const description = messages?.documents?.agent_handoff?.description || ""

  return buildLocalizedMetadata({
    locale,
    pathname: "/dokreziim",
    title,
    description
  })
}

export default async function DocumentWorkspaceRoute({ searchParams }) {
  const cookieStore = await cookies()
  const locale = getLocaleFromCookies(cookieStore)
  const session = await getServerSession(authConfig).catch(() => null)
  const gate = await requireSubscription(session, roleFromSession(session))
  if (!gate.ok) {
    redirect(localizePath(gate.redirect || "/tellimus", locale))
  }

  const params = await searchParams
  const initialDocumentIds = Array.from(new Set(String(params?.documents || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)))
  const initialArtifactId = String(params?.artifact || "").trim()

  return <AgentModePage initialDocumentIds={initialDocumentIds} initialArtifactId={initialArtifactId} />
}
