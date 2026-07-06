export function clearStaleScrollLock() {
  if (typeof document === "undefined") return false;
  const hasOpenModal = document.querySelector('[role="dialog"][aria-modal="true"]');
  if (hasOpenModal) return false;

  const html = document.documentElement;
  const body = document.body;
  const locked = Boolean(
    html?.classList.contains("modal-open") ||
      html?.classList.contains("login-modal-open") ||
      body?.classList.contains("modal-open") ||
      body?.classList.contains("login-modal-open") ||
      body?.dataset?.a11yScrollLock ||
      body?.style?.position === "fixed" ||
      body?.style?.overflow === "hidden"
  );

  if (!locked) return false;

  const top = body?.style?.top || "";
  const scrollY = top && top.startsWith("-") ? Math.abs(parseInt(top, 10) || 0) : 0;

  ["modal-open", "login-modal-open"].forEach(cls => {
    html?.classList.remove(cls);
    body?.classList.remove(cls);
  });
  if (body?.dataset?.a11yScrollLock) delete body.dataset.a11yScrollLock;

  if (body?.style) {
    body.style.overflow = "";
    body.style.position = "";
    body.style.top = "";
    body.style.left = "";
    body.style.right = "";
    body.style.width = "";
    body.style.height = "";
    body.style.paddingRight = "";
    body.style.touchAction = "";
  }

  if (scrollY && typeof window !== "undefined") {
    try {
      window.scrollTo(0, scrollY);
    } catch {}
  }

  return true;
}
