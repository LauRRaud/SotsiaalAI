import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import { listPreInquiryOrganizationRecipients } from "@/lib/preInquiries";
import { safeError } from "@/lib/privacy/safeError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request) {
  const locale = localeFromRequest(request);
  const session = await getServerSession(authConfig).catch(() => null);
  if (!session?.user?.id) {
    return errorJson("api.common.unauthorized", 401, locale);
  }

  try {
    const recipients = await listPreInquiryOrganizationRecipients();
    return json({ ok: true, recipients });
  } catch (error) {
    console.error("[pre-inquiries] organization recipient load failed", safeError(error));
    return errorJson("pre_inquiries.errors.load_failed", 500, locale);
  }
}
