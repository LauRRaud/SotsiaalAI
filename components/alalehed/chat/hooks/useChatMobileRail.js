import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { detectMobileViewport } from "../chatLayoutVars";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function useChatMobileRail() {
  const [isMobile, setIsMobile] = useState(false);
  const [mobileRailVisible, setMobileRailVisible] = useState(false);
  const [mobileRailInteractionLocked, setMobileRailInteractionLocked] = useState(false);
  const mobileModeRef = useRef(null);

  useIsomorphicLayoutEffect(() => {
    const update = () => {
      if (typeof window === "undefined") return;
      const nextIsMobile = detectMobileViewport();
      setIsMobile(nextIsMobile);
      setMobileRailVisible(prev => {
        const prevMode = mobileModeRef.current;
        if (prevMode === null || prevMode !== nextIsMobile) {
          mobileModeRef.current = nextIsMobile;
          setMobileRailInteractionLocked(false);
          return nextIsMobile ? false : true;
        }
        return prev;
      });
    };

    update();
    if (typeof window === "undefined") return;
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const showMobileRail = useCallback(() => {
    setMobileRailInteractionLocked(false);
    setMobileRailVisible(true);
  }, []);

  const toggleMobileRail = useCallback(() => {
    setMobileRailInteractionLocked(false);
    setMobileRailVisible(prev => !prev);
  }, []);

  const hideMobileRail = useCallback(() => {
    if (!isMobile) return;
    setMobileRailInteractionLocked(false);
    setMobileRailVisible(false);
  }, [isMobile]);

  return {
    isMobile,
    mobileRailVisible,
    mobileRailInteractionLocked,
    showMobileRail,
    toggleMobileRail,
    hideMobileRail
  };
}
