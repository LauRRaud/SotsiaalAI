"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import MetallicPaint from "@/components/brand/MetallicPaint";
import VeilArt, { VEIL_EFFECTS } from "@/components/room/VeilArt";
import styles from "./LogoExportStage.module.css";

const FACEBOOK_COVER_WIDTH = 3280;
const FACEBOOK_COVER_HEIGHT = 1248;
const FACEBOOK_PROFILE_SIZE = 2048;
const EXPORT_DELAY_MS = 34500;

/**
 * SotsiaalAI logo ekspordilava.
 *
 * AI-kihi parameetrid on teadlikult samad mis avalehe laadimislooris
 * (RoomStage). Nii ei teki sotsiaalmeedia failis staatilist või teise
 * tooniga logo versiooni.
 */
export default function LogoExportStage({ loadingLine, variant = "cover" }) {
  const isProfile = variant === "profile";
  const [metalReady, setMetalReady] = useState(false);
  const stageRef = useRef(null);
  const wordmarkRef = useRef(null);
  const metalRef = useRef(null);
  const metalBaseRef = useRef(null);
  const downloadStartedRef = useRef(false);
  const [downloadUrl, setDownloadUrl] = useState(null);

  useEffect(() => () => {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl.url);
  }, [downloadUrl]);

  const downloadRenderedLogo = useCallback((format) => {
    const stage = stageRef.current;
    const wordmark = wordmarkRef.current;
    const metalBase = metalBaseRef.current;
    const metalCanvas = metalRef.current?.querySelector("canvas");
    const artCanvas = stage?.querySelector(".room-veil-art");
    if (!stage || !wordmark || !metalBase || !metalCanvas) return;

    const stageRect = stage.getBoundingClientRect();
    const wordmarkRect = wordmark.getBoundingClientRect();
    const metalRect = metalCanvas.getBoundingClientRect();
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = isProfile ? FACEBOOK_PROFILE_SIZE : FACEBOOK_COVER_WIDTH;
    exportCanvas.height = isProfile ? FACEBOOK_PROFILE_SIZE : FACEBOOK_COVER_HEIGHT;
    const context = exportCanvas.getContext("2d");
    if (!context) return;

    const scale = exportCanvas.width / stageRect.width;
    const draw = (source, rect) => {
      context.drawImage(
        source,
        (rect.left - stageRect.left) * scale,
        (rect.top - stageRect.top) * scale,
        rect.width * scale,
        rect.height * scale
      );
    };

    context.fillStyle = "#000";
    context.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    if (artCanvas) context.drawImage(artCanvas, 0, 0, exportCanvas.width, exportCanvas.height);
    const wordmarkOpacity = Number.parseFloat(getComputedStyle(wordmark.parentElement).opacity) || 1;
    context.globalAlpha = wordmarkOpacity;
    if (isProfile) {
      // Profiilimärgi S on puhas valge. Ekspordis tuleb see samast SAI-SVG-st
      // lõigata, sest canvas ei arvesta HTML-i clip-path'i.
      context.globalAlpha *= Number.parseFloat(getComputedStyle(wordmark).opacity) || 1;
      const sWidth = wordmark.naturalWidth * 0.35;
      context.drawImage(
        wordmark,
        0,
        0,
        sWidth,
        wordmark.naturalHeight,
        (wordmarkRect.left - stageRect.left) * scale,
        (wordmarkRect.top - stageRect.top) * scale,
        wordmarkRect.width * scale * 0.35,
        wordmarkRect.height * scale
      );
      context.globalAlpha = wordmarkOpacity;
    } else {
      draw(wordmark, wordmarkRect);
    }
    draw(metalBase, metalRect);
    draw(metalCanvas, metalRect);
    context.globalAlpha = 1;

    const mimeType = format === "jpg" ? "image/jpeg" : "image/png";
    exportCanvas.toBlob(
      (blob) => {
        if (!blob) return;
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        const suffix = isProfile ? "-profiil" : variant === "centered" ? "-centered" : "";
        link.download = `sotsiaalai-facebook-logo${suffix}.${format}`;
        setDownloadUrl({ url: link.href, name: link.download, format });
        // Mõni brauser ei käivita eemaldatud ankruelemendi allalaadimist.
        // Lisame selle hetkeks DOM-i, et ka 34,5 s viitega eksport jääks toimima.
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        link.remove();
      },
      mimeType,
      format === "jpg" ? 0.96 : undefined
    );
  }, [isProfile, variant]);

  useEffect(() => {
    if (!metalReady || downloadStartedRef.current) return undefined;
    const params = new URLSearchParams(window.location.search);
    const requestedFormat = params.get("download");
    // Otse /logo-eksport avamine on kaanefoto PNG-eksport. Eelvaate saab
    // vajadusel avada ?preview=1 abil, ilma et pilt automaatselt salvestuks.
    const format = requestedFormat === "jpg" ? "jpg" : params.get("preview") === "1" ? null : "png";
    if (!format) return undefined;

    let firstFrame = 0;
    let secondFrame = 0;
    const delay = window.setTimeout(() => {
      firstFrame = requestAnimationFrame(() => {
        secondFrame = requestAnimationFrame(() => {
          if (downloadStartedRef.current) return;
          downloadStartedRef.current = true;
          downloadRenderedLogo(format);
        });
      });
    }, EXPORT_DELAY_MS);
    return () => {
      window.clearTimeout(delay);
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, [downloadRenderedLogo, metalReady]);

  return (
    <main
      className={styles.stage}
      aria-label="SotsiaalAI logo"
      data-metal-ready={metalReady ? "1" : "0"}
      data-variant={variant}
      ref={stageRef}
    >
      {variant === "cover" ? <VeilArt effect={VEIL_EFFECTS.DIRECT} textLimit={1800} /> : null}
      {variant === "cover" ? <p className={`room-veil-line ${styles.loadingLine}`}>{loadingLine}</p> : null}
      <div className={styles.wordmark}>
        {/* Exact SVG geometry must remain unoptimized so the AI overlay aligns pixel-for-pixel. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={wordmarkRef}
          className={isProfile ? styles.profileS : undefined}
          src={isProfile ? "/logo/sotsiaalai-sai-valge.svg" : "/logo/sotsiaalai-h-valge.svg"}
          alt={isProfile ? "SAI" : "SotsiaalAI"}
          width={isProfile ? 786 : 264}
          height={isProfile ? 500 : 50}
          decoding="sync"
        />
        <div className={`${styles.metal} ${isProfile ? styles.profileMetal : ""}`} aria-hidden="true" ref={metalRef}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={metalBaseRef}
            className={styles.metalBase}
            src="/logo/ai-mark.svg"
            alt=""
          />
          <MetallicPaint
            imageSrc="/logo/ai-mark.svg"
            onReady={() => setMetalReady(true)}
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
        </div>
      </div>
      {downloadUrl ? (
        <a className={styles.manualDownload} href={downloadUrl.url} download={downloadUrl.name}>
          Salvesta {downloadUrl.format.toUpperCase()}
        </a>
      ) : null}
    </main>
  );
}
