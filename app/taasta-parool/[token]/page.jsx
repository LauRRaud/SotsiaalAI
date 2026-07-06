import { cookies } from "next/headers";
import { getLocaleFromCookies, getMessagesSync } from "@/lib/i18n";
import { buildLocalizedMetadata } from "@/lib/metadata";
import ResetPasswordForm from "./ResetPasswordForm";

export async function generateMetadata() {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const messages = getMessagesSync(locale);
  const meta = messages?.meta?.reset || {};

  return buildLocalizedMetadata({
    locale,
    pathname: "/taasta-parool",
    title: meta.title || "",
    description: meta.description || ""
  });
}

export default async function ResetPasswordPage({ params }) {
  const resolvedParams = await params;
  const token = resolvedParams?.token || "";
  return <ResetPasswordForm token={token} />;
}
