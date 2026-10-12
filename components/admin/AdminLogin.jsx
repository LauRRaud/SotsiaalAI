"use client";

import { useCallback } from "react";
import dynamic from "next/dynamic";

// LoginModal kasutab document.body portaali; see avaneb ainult brauseris.
const LoginModal = dynamic(() => import("@/components/LoginModal"), { ssr: false });

export default function AdminLogin() {
  const close = useCallback(() => window.location.replace("/"), []);
  // Täislaadimine võtab uue sessiooni serveris üle ja kontrollib admini rolli.
  const signedIn = useCallback(() => window.location.replace("/admin"), []);
  return <LoginModal open onClose={close} suppressRedirect onAuthSuccess={signedIn} defaultNextPath="/admin" />;
}
