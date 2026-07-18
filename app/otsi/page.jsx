import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import PersonalSearchPage from "@/components/search/PersonalSearchPage";
import { getLocaleFromCookies } from "@/lib/i18n";
import { localizePath } from "@/lib/localizePath";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Personal search only needs an authenticated user: it aggregates the user's
// OWN conversations, Journeys and documents. Conversations (/vestlus) and
// Journeys (/teekond) have no subscription gate, so requiring a paid plan here
// would wrongly lock a free-but-signed-in user out of searching their own work.
// The owner-scoped API (/api/otsi) is the real boundary; this page only
// enforces sign-in.
export default async function Page() {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const session = await getServerSession(authConfig).catch(() => null);
  if (!session?.user?.id) {
    redirect(`/api/auth/signin?callbackUrl=${encodeURIComponent(localizePath("/otsi", locale))}`);
  }
  return <PersonalSearchPage />;
}
