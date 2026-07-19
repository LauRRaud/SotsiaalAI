import { cookies } from "next/headers";
import TooalaseRaamistikuBody from "@/components/alalehed/TooalaseRaamistikuBody";
import { loadFrameworkDocument } from "@/lib/frameworkDocument";
import { getLocaleFromCookies, getMessagesSync } from "@/lib/i18n";
import { buildLocalizedMetadata } from "@/lib/metadata";


function getEmptyFrameworkDocument(messages) {
  return {
    title: messages?.auth?.register?.worker_framework_title || "SotsiaalAI framework",
    prefaceBlocks: [],
    documentBlocks: []
  };
}

export async function generateMetadata() {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const messages = getMessagesSync(locale);
  const meta = messages?.meta?.framework || {};

  return buildLocalizedMetadata({
    locale,
    pathname: "/tooalase-kasutuse-raamistik",
    title: meta.title || messages?.auth?.register?.worker_framework_title || "",
    description: meta.description || ""
  });
}

export default async function TooalaseRaamistikuPage() {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const messages = getMessagesSync(locale);
  let frameworkDocument = getEmptyFrameworkDocument(messages);

  try {
    frameworkDocument = await loadFrameworkDocument(locale);
  } catch (error) {
    console.error("[framework-page] document load failed", error);
  }

  return <TooalaseRaamistikuBody frameworkDocument={frameworkDocument} />;
}