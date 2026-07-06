import { cookies } from "next/headers"

import MaterialsPage from "@/components/materials/MaterialsPage"
import { getLocaleFromCookies } from "@/lib/i18n"
import { buildLocalizedMetadata } from "@/lib/metadata"

export async function generateMetadata() {
  const cookieStore = await cookies()
  const locale = getLocaleFromCookies(cookieStore)

  return buildLocalizedMetadata({
    locale,
    pathname: "/materjalid",
    title: "Materjalide jagamine",
    description: "Saada õppematerjale ja dokumente, et täiendada SotsiaalAI teadmuspõhist andmebaasi."
  })
}

export default async function Page() {
  const cookieStore = await cookies()
  const locale = getLocaleFromCookies(cookieStore)

  return <MaterialsPage locale={locale} />
}
