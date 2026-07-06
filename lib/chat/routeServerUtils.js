import { maybeRunRetentionCleanup } from "@/lib/retention";

export const CHAT_NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0"
};

export function isPlausibleChatId(id) {
  if (!id || typeof id !== "string") return false;
  if (id.length < 8 || id.length > 200) return false;
  return /^[A-Za-z0-9._\-:+]+$/.test(id);
}

export function isChatDbOfflineError(err) {
  return err?.code === "P1001" || err?.code === "P1017" || err?.name === "PrismaClientInitializationError" || err?.name === "PrismaClientRustPanicError";
}

async function getChatAuthOptions() {
  try {
    const mod = await import("@/pages/api/auth/[...nextauth]");
    return mod.authOptions || mod.default || mod.authConfig;
  } catch {
    try {
      const mod = await import("@/auth");
      return mod.authOptions || mod.default || mod.authConfig;
    } catch {
      return undefined;
    }
  }
}

export async function requireChatUser(options = {}) {
  const {
    runRetentionCleanup = false,
    includeSession = false,
    includeRole = false,
    normalizeRole = null
  } = options;

  try {
    if (runRetentionCleanup) {
      await maybeRunRetentionCleanup();
    }
    const { getServerSession } = await import("next-auth/next");
    const authOptions = await getChatAuthOptions();
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return {
        ok: false,
        status: 401,
        message: "api.common.unauthorized"
      };
    }

    const result = {
      ok: true,
      userId: String(session.user.id),
      isAdmin: !!session.user.isAdmin
    };

    if (includeSession) {
      result.session = session;
    }
    if (includeRole) {
      result.role = typeof normalizeRole === "function"
        ? normalizeRole(session?.user?.role || (session?.user?.isAdmin ? "SOCIAL_WORKER" : "CLIENT"))
        : String(session?.user?.role || "").trim().toUpperCase();
    }

    return result;
  } catch {
    return {
      ok: false,
      status: 401,
      message: "api.common.unauthorized"
    };
  }
}
