import Link from "next/link";

import ChatTurnTrace from "@/components/admin/rag/ChatTurnTrace";
import RagAdminPageFrame from "@/components/admin/rag/RagAdminPageFrame";
import { getRagAdminCopy } from "@/components/admin/rag/ragAdminCopy";
import { getChatTraceCopy } from "@/components/admin/rag/chatTraceCopy";
import { prisma } from "@/lib/prisma";
import { localizePath } from "@/lib/localizePath";
import { openTurn } from "@/lib/rag-v2/pilot/packed-json";
import { turnTrace } from "@/lib/rag-v2/pilot/turn-trace";
import { requireAdminRagAccess } from "../../pageHelpers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export const metadata = {
  title: "Answer trace - Sotsiaal.pro",
  robots: { index: false, follow: false, nocache: true }
};

// One turn of the admin's own conversations, as its audit row holds it. The vector is not read.
export default async function AdminChatTracePage({ params }) {
  const { turnId } = await params;
  const id = String(turnId || "");
  const { locale, session } = await requireAdminRagAccess(`/admin/rag/chat-trace/${encodeURIComponent(id)}`);
  const copy = getRagAdminCopy(locale), trace = getChatTraceCopy(locale);
  const row = session?.user?.id && id ? await prisma.m4PilotTurn.findFirst({ where: { id, chatTurn: { userId: session.user.id } }, omit: { vector: true } }) : null;
  return (
    <RagAdminPageFrame locale={locale} activeKey="chatTrace" title={copy.pages.chatTrace.title} subtitle={copy.pages.chatTrace.subtitle}>
      <p><Link prefetch={false} href={localizePath("/admin/rag/chat-trace", locale)}>{trace.list.back}</Link></p>
      {row ? <ChatTurnTrace trace={turnTrace(openTurn(row))} locale={locale} /> : <p role="status">{trace.missing}</p>}
    </RagAdminPageFrame>
  );
}
