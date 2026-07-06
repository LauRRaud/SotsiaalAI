import { getServerSession } from "next-auth"
import { authConfig } from "@/auth"
import { assertAdmin } from "@/lib/authz"
import { getRetrievalStats } from "@/lib/documents/retrievalObservability"
import { normalizeServerLocale, serverT } from "@/lib/i18n/serverMessages"
import { json } from "@/lib/documents/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

function localeFromRequest(req) {
  const url = new URL(req.url)
  const fromQuery = normalizeServerLocale(url.searchParams.get("locale"))
  if (fromQuery) return fromQuery

  const fromHeader =
    normalizeServerLocale(req.headers.get("x-ui-locale")) ||
    normalizeServerLocale(req.headers.get("x-locale")) ||
    normalizeServerLocale(req.headers.get("accept-language"))

  return fromHeader || "en"
}

function errorJson(messageKey, status = 400, locale = "en", extras = {}) {
  const translated = serverT(locale, messageKey, undefined, messageKey)
  return json(
    {
      ok: false,
      messageKey,
      message: translated,
      ...extras
    },
    status
  )
}

export async function GET(req) {
  const locale = localeFromRequest(req)
  const session = await getServerSession(authConfig).catch(() => null)
  const authz = assertAdmin(session)

  if (!authz.ok) {
    return errorJson(authz.message || "api.common.forbidden", authz.status || 403, locale)
  }

  return json({
    ok: true,
    ...getRetrievalStats()
  })
}
