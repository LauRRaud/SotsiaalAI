import { cookies } from "next/headers";
import LogoExportStage from "@/components/brand/LogoExportStage";
import { getLocaleFromCookies, getMessagesSync } from "@/lib/i18n";
import "./logo-export.css";

export const metadata = {
  title: "SotsiaalAI logo eksport",
  robots: { index: false, follow: false }
};

export default async function LogoExportPage({ searchParams }) {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const messages = getMessagesSync(locale);
  const params = await searchParams;
  const variant = ["cover", "centered", "profile"].includes(params?.variant) ? params.variant : "cover";
  return <LogoExportStage loadingLine={messages?.room?.loading_line || "Kõik algab selgusest."} variant={variant} />;
}
