import { cookies } from "next/headers";
import WorkspaceFeaturePage from "@/components/workspace/WorkspaceFeaturePage";
import { getLocaleFromCookies, getMessagesSync } from "@/lib/i18n";
import { buildLocalizedMetadata } from "@/lib/metadata";

export async function generateMetadata() {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const messages = getMessagesSync(locale);
  const meta = messages?.workspace_feature_pages?.service_map?.meta || {};

  return buildLocalizedMetadata({
    locale,
    pathname: "/teenusekaart",
    title: meta.title || messages?.workspace_feature_pages?.service_map?.title || "Teenusekaart",
    description: meta.description || ""
  });
}

export default function ServiceMapPage() {
  return <WorkspaceFeaturePage feature="service_map" />;
}
