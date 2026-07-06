import { cookies, headers } from "next/headers";
import { getLocaleFromCookies, getMessagesSync } from "@/lib/i18n";
import { buildLocalizedMetadata } from "@/lib/metadata";
import ProfiilBody from "@/components/alalehed/ProfiilBody";

function detectMobileRequest(headersList) {
  const uaMobile = String(headersList.get("sec-ch-ua-mobile") || "").trim();
  if (uaMobile === "?1") return true;
  const userAgent = String(headersList.get("user-agent") || "");
  return /Android|iPhone|iPad|iPod|Windows Phone|IEMobile|Opera Mini|Mobile/i.test(userAgent);
}

export async function generateMetadata() {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const messages = getMessagesSync(locale);
  const meta = messages?.meta?.profile || {};
  return buildLocalizedMetadata({
    locale,
    pathname: "/profiil",
    title: meta.title || "",
    description: meta.description || ""
  });
}
export default async function Page({
  searchParams
}) {
  const params = await searchParams;
  const headerStore = await headers();
  return <ProfiilBody initialOrbitRequested={params?.orbit === "1"} initialIsMobileProfileMenu={detectMobileRequest(headerStore)} />;
}


