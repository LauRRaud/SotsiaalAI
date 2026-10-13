"use client";

import { useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { useAccessibility } from "@/components/accessibility/AccessibilityProvider";

const MetallicPaint = dynamic(() => import("./MetallicPaint"), { ssr: false });
const LOGO = "/logo/sotsiaal-pro-corner.svg";

function subscribeMotion(callback) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", callback);
  document.addEventListener("visibilitychange", callback);
  return () => {
    media.removeEventListener("change", callback);
    document.removeEventListener("visibilitychange", callback);
  };
}

function motionAllowed() {
  return !document.hidden && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function serverMotionAllowed() {
  return false;
}

function SuffixOutline({ hidden = false }) {
  return (
    <svg viewBox="4088 -712 1037 566" className="room-veil-logo-suffix" style={{ visibility: hidden ? "hidden" : undefined }} aria-hidden="true">
      <use href={`${LOGO}#wordmark-pro`} />
    </svg>
  );
}

function MetallicSuffix() {
  const [ready, setReady] = useState(false);
  return (
    <>
      <SuffixOutline hidden={ready} />
      {/* Last SotsiaalAI preset before removal in 24fc69a6 (03.10.2026).
          Only the mask and pixel sampling density change. */}
      <MetallicPaint
        imageSrc="/logo/sotsiaal-pro-mark.svg"
        onReady={() => setReady(true)}
        resolutionScale={2}
        preserveDrawingBuffer
        seed={7}
        scale={3}
        speed={0.11}
        brightness={1.42}
        contrast={0.6}
        liquid={0.38}
        waveAmplitude={0.65}
        refraction={0.012}
        chromaticSpread={0}
        blur={0.026}
        patternSharpness={0.55}
        noiseScale={0.3}
        distortion={0.55}
        lightColor="#e5e2db"
        darkColor="#464a55"
        tintColor="#e6d3c0"
        tintPulse={0.6}
        radial={3.5}
      />
    </>
  );
}

export default function RoomWordmark({ active }) {
  const { prefs } = useAccessibility();
  const visibleMotion = useSyncExternalStore(subscribeMotion, motionAllowed, serverMotionAllowed);
  const animate = active && visibleMotion && !prefs.reduceMotion && prefs.contrast !== "hc";

  return (
    <div className="room-veil-logo" role="img" aria-label="Sotsiaal.pro">
      {/* Native SVG contours avoid resampling the complete wordmark as an image. */}
      <svg className="room-veil-logo-body" viewBox="1.922390 -853.813645 5178.221604 923.052372" width="2400" height="428" aria-hidden="true">
        <use href={`${LOGO}#wordmark-body`} />
      </svg>
      <div className="room-veil-logo-metal" aria-hidden="true">
        {animate ? <MetallicSuffix /> : <SuffixOutline />}
      </div>
    </div>
  );
}
