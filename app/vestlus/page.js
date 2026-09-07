export const dynamic = "force-dynamic";
export const revalidate = 0;
import { cookies } from "next/headers";
import { getLocaleFromCookies, getMessagesSync } from "@/lib/i18n";
import { buildLocalizedMetadata } from "@/lib/metadata";
import ChatBody from "@/components/alalehed/ChatBody";
import ConversationDrawer from "@/components/alalehed/ConversationDrawer";
import ChatSidebar from "@/components/ChatSidebar";
import { redirect } from "next/navigation";
import { localizePath } from "@/lib/localizePath";
import { requireChatUser } from '@/lib/chat/routeServerUtils';
import { readPilotConfig } from '@/lib/rag-v2/pilot/config';
export async function generateMetadata() {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const messages = getMessagesSync(locale);
  const meta = messages?.meta?.chat || {};
  return buildLocalizedMetadata({
    locale,
    pathname: "/vestlus",
    title: meta.title || "",
    description: meta.description || "",
    openGraph: {
      type: "article"
    }
  });
}
export default async function Page({ searchParams }) {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const resolvedSearchParams = await searchParams;
  if (resolvedSearchParams?.profile === "1") {
    redirect(localizePath("/profiil", locale));
  }
  const loginRequested = resolvedSearchParams?.login === "1";
  const reason =
    typeof resolvedSearchParams?.reason === "string"
      ? resolvedSearchParams.reason.trim().toLowerCase()
      : "";
  const emailVerifiedEntry = reason === "email-verified";
  const roomIdRaw = resolvedSearchParams?.roomId;
  const roomId = typeof roomIdRaw === "string" ? roomIdRaw.trim() || null : null;
  let pilotMode = null, pilotDialogueEnabled = false;
  if (!roomId && process.env.M4_PILOT_ENABLED === '1') {
    const auth = await requireChatUser({ includeSession: true });
    if (auth.ok && !auth.session?.authDegraded) {
      try { const config = await readPilotConfig(auth.userId, { purpose: 'read' }); pilotMode = config.mode; pilotDialogueEnabled = !!config.dialogueVersion; } catch {}
    }
  }
  return <>
      <ConversationDrawer>
        <ChatSidebar pilotEnabled={!!pilotMode} />
      </ConversationDrawer>
      <ChatBody
        pilotMode={pilotMode}
        pilotDialogueEnabled={pilotDialogueEnabled}
        roomId={roomId}
        requestLoginOnOpen={loginRequested || emailVerifiedEntry}
        emailVerifiedEntry={emailVerifiedEntry}
      />
    </>;
}
