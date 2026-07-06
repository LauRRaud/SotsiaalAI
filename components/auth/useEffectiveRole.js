"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";

function normalizeBaseRole(value, isAdmin = false) {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "SERVICE_PROVIDER") return "SERVICE_PROVIDER";
  if (normalized === "SOCIAL_WORKER") return "SOCIAL_WORKER";
  if (normalized === "CLIENT") return "CLIENT";
  if (normalized === "ADMIN" || isAdmin) return "ADMIN";
  return "CLIENT";
}

function normalizeEffectiveRole(value, fallbackRole = "CLIENT", isAdmin = false) {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "SERVICE_PROVIDER") return "SERVICE_PROVIDER";
  if (normalized === "SOCIAL_WORKER") return "SOCIAL_WORKER";
  if (normalized === "CLIENT") return "CLIENT";
  if (normalized === "ADMIN") return "SOCIAL_WORKER";
  return isAdmin ? "SOCIAL_WORKER" : normalizeBaseRole(fallbackRole, isAdmin);
}

function normalizePreviewRole(value) {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "SERVICE_PROVIDER") return "SERVICE_PROVIDER";
  if (normalized === "SOCIAL_WORKER") return "SOCIAL_WORKER";
  if (normalized === "CLIENT") return "CLIENT";
  return null;
}

export function useEffectiveRole() {
  const { data: session, status } = useSession();
  const actualRole = normalizeBaseRole(session?.user?.role, session?.user?.isAdmin === true);
  const isAdmin = session?.user?.isAdmin === true || actualRole === "ADMIN";
  const [profileMeta, setProfileMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const refresh = useCallback(() => {
    setRefreshNonce((value) => value + 1);
  }, []);

  useEffect(() => {
    if (status !== "authenticated" || !isAdmin) {
      setProfileMeta(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadProfileMeta() {
      setLoading(true);
      try {
        const response = await fetch("/api/profile", { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.user) {
          if (!cancelled) setProfileMeta(null);
          return;
        }
        if (!cancelled) setProfileMeta(payload.user);
      } catch {
        if (!cancelled) setProfileMeta(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadProfileMeta();

    return () => {
      cancelled = true;
    };
  }, [isAdmin, refreshNonce, status]);

  const effectiveRole = normalizeEffectiveRole(profileMeta?.effectiveRole, actualRole, isAdmin);
  const adminViewRole = normalizePreviewRole(profileMeta?.adminViewRole);
  const isRoleResolved = status !== "loading" && (!isAdmin || !loading);

  return {
    actualRole,
    effectiveRole,
    adminViewRole: actualRole === "ADMIN" ? adminViewRole : null,
    isAdmin,
    isRoleViewActive: Boolean(isAdmin && adminViewRole),
    isRoleResolved,
    isRoleLoading: loading,
    refresh
  };
}
