import Link from "next/link";

import RagAdminPageFrame from "@/components/admin/rag/RagAdminPageFrame";
import { getRagAdminCopy } from "@/components/admin/rag/ragAdminCopy";
import { getChatTraceCopy } from "@/components/admin/rag/chatTraceCopy";
import { prisma } from "@/lib/prisma";
import { localizePath } from "@/lib/localizePath";
import { requireAdminRagAccess } from "../pageHelpers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export const metadata = {
  title: "Answer traces - Sotsiaal.pro",
  robots: { index: false, follow: false, nocache: true }
};

// The admin's own chat turns, newest first (owner 21.10.2026). Only the admin's own conversations: another user's
// conversation is personal data and is not shown here.
export default async function AdminChatTraceListPage() {
  const { locale, session } = await requireAdminRagAccess("/admin/rag/chat-trace");
  const copy = getRagAdminCopy(locale), trace = getChatTraceCopy(locale);
  const rows = session?.user?.id ? await prisma.m4PilotTurn.findMany({ where: { chatTurn: { userId: session.user.id } },
    orderBy: { createdAt: "desc" }, take: 60, select: { id: true, createdAt: true, state: true, payload: true } }) : [];
  const time = value => new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(value);
  return (
    <RagAdminPageFrame locale={locale} activeKey="chatTrace" title={copy.pages.chatTrace.title} subtitle={copy.pages.chatTrace.subtitle}>
      <section className="ra-card">
        <p>{trace.list.scope}</p>
        {rows.length ? (
          <table>
            <thead><tr><th>{trace.list.time}</th><th>{trace.list.question}</th><th>{trace.list.kind}</th><th>{trace.list.state}</th><th /></tr></thead>
            <tbody>{rows.map(row => {
              const question = row.payload?.query?.question ?? row.payload?.query?.text ?? "";
              return (
                <tr key={row.id}>
                  <td>{time(row.createdAt)}</td>
                  <td>{question.length > 140 ? `${question.slice(0, 140)}…` : question || "—"}</td>
                  <td>{row.payload?.answer?.kind ?? "—"}</td>
                  <td>{row.state}</td>
                  <td><Link prefetch={false} href={localizePath(`/admin/rag/chat-trace/${encodeURIComponent(row.id)}`, locale)}>{trace.list.open}</Link></td>
                </tr>
              );
            })}</tbody>
          </table>
        ) : <p>{trace.list.empty}</p>}
      </section>
    </RagAdminPageFrame>
  );
}
