import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getLocaleFromCookies } from "@/lib/i18n";
import { localizePath } from "@/lib/localizePath";
export default async function Page() {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  redirect(localizePath("/ruum", locale));
}
