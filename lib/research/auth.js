import { isAdmin, normalizeRole, requireSubscription, roleFromSession } from "@/lib/authz";

async function getAuthOptions() {
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

export async function requireResearchAuth() {
  let getServerSession;
  try {
    ({ getServerSession } = await import("next-auth/next"));
  } catch {
    return {
      ok: false,
      status: 401,
      message: "api.common.unauthorized",
    };
  }

  const authOptions = await getAuthOptions();
  const session = await getServerSession(authOptions).catch(() => null);
  if (!session?.user?.id) {
    return {
      ok: false,
      status: 401,
      message: "api.common.unauthorized",
    };
  }

  const role = normalizeRole(roleFromSession(session));
  const gate = await requireSubscription(session, role);
  if (!gate.ok) {
    return {
      ok: false,
      status: gate.status,
      message: gate.message,
      redirect: gate.redirect,
      requireSubscription: gate.requireSubscription,
    };
  }

  return {
    ok: true,
    session,
    userId: session.user.id,
    role,
    isAdmin: isAdmin(session.user),
  };
}
