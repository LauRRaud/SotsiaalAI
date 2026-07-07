#!/usr/bin/env node
/**
 * Ruumikaadrite kõrgekvaliteedilised WebP-versioonid: Plaan/*.png → public/room/frame-N.webp
 *
 * Iga kaadri kohta genereeritakse ÜKS suur, maksimaalse kvaliteediga
 * WebP-fail (mitte responsive srcset mitmes laiuses + AVIF). Ruumi-
 * scroll on täisekraani visuaalne kogemus, mitte tavaline sisupilt —
 * seetõttu eelistatakse siin kvaliteeti agressiivsele failisuuruse
 * optimeerimisele.
 *
 * Töötlus kaadri kohta:
 *   1) Lanczos3 2x suurendus originaalilt (Sharp, mitte AI upscale)
 *   2) sellelt puhvrilt lõplik resize laiuseks 2560px (kuvasuhe säilib)
 *   3) WebP kodeering (quality 90, effort 6, lossy)
 *
 * Lisaks kirjutab skript lib/room-frames.js manifesti (ROOM_FRAMES +
 * ROOM_FRAME_WIDTH/HEIGHT), mida RoomStage.jsx kaadrite renderdamiseks
 * loeb — iga kaadri kohta üks src + LQIP (hägune base64 eelvaade, mis
 * on nähtav enne täispildi laadimist).
 *
 * Failivalik: ainult allpool loetletud FRAME_FILES kuuluvad scrollitava
 * ruumikogemuse kaadrite hulka. Plaan kaustas on ka teisi numbrilise
 * prefiksiga PNG-e (login modal, töölaud, pin-vaade jms), mis EI OLE
 * selle kogemuse osa — seepärast ei tuvastata "kõiki numbrilisi PNG-e",
 * vaid ainult seda selget allowlisti (tellija kinnitas 2026-07-07).
 *
 * Uue kaadri lisamiseks: lisa faili nimi FRAME_FILES loendisse (fail
 * peab kandma numbrilist prefiksit "N - ...png") — järjekord ja
 * väljundnimi (frame-N.webp) tuletatakse sellest prefiksist automaatselt,
 * skripti ülejäänud osa ei vaja muutmist.
 *
 * Kasutus: node scripts/generate-room-images.mjs
 */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")),
  ".."
);
const SRC_DIR = path.join(ROOT, "Plaan");
const OUT_DIR = path.join(ROOT, "public", "room");
const MANIFEST_PATH = path.join(ROOT, "lib", "room-frames.js");
const LQIP_WIDTH = 28;

const FRAME_FILES = [
  "1 - vaade uksest.png",
  "2 - vaade ruumile.png",
  "3 - vaatan tugitooli.png",
  "4 - liigun lähemale.png",
  "5 - viimane kaader enne istumist.png",
  "6 - istun ja vaatan seina.png",
  "7 - enne fookust kaartidele - enne sisse logimist.png",
];

const UPSCALE_FACTOR = 2;
const FINAL_WIDTH = 2560;
const WEBP_OPTS = { quality: 90, effort: 6, lossless: false };
const NUMERIC_PREFIX = /^(\d+)\s*-/;

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/** Loeb Plaan kausta sisu, valideerib allowlisti ja tuletab kaadrinumbrid. */
async function resolveFrames() {
  const entries = await fs.readdir(SRC_DIR, { withFileTypes: true });
  const pngFiles = entries.filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".png"));
  const pngNames = new Set(pngFiles.map((e) => e.name));

  const frames = [];
  for (const name of FRAME_FILES) {
    if (!pngNames.has(name)) {
      throw new Error(`Allowlist'i fail puudub kaustast "${SRC_DIR}": "${name}"`);
    }
    const match = name.match(NUMERIC_PREFIX);
    if (!match) {
      throw new Error(`Faili nimi ei alga numbrilise prefiksiga ("N - ..."): "${name}"`);
    }
    frames.push({ n: Number(match[1]), file: name });
  }
  frames.sort((a, b) => a.n - b.n);

  return { frames, totalPngFound: pngFiles.length };
}

/** Töötleb ühe kaadri: 2x Lanczos3 suurendus → 2560px laiune lõplik WebP. */
async function processFrame({ n, file }) {
  const srcPath = path.join(SRC_DIR, file);
  const outName = `frame-${n}.webp`;
  const outPath = path.join(OUT_DIR, outName);

  const srcMeta = await sharp(srcPath).metadata();
  if (!srcMeta.width || !srcMeta.height) {
    throw new Error(`Ei suutnud lugeda mõõtmeid failist: ${file}`);
  }

  // Samm 1: Lanczos3 2x suurendus. Väljund hoitakse raw-puhvrina (ilma
  // vahepealse formaadi taaskodeerimiseta), et suurenduse ja lõpliku
  // resize'i vahele ei tekiks lisakadu.
  const { data, info } = await sharp(srcPath)
    .resize({ width: srcMeta.width * UPSCALE_FACTOR, kernel: "lanczos3" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Samm 2: lõplik resize laiuseks FINAL_WIDTH (kuvasuhe säilib automaatselt,
  // sest kõrgust ei anta ette) + WebP kodeering.
  const outputInfo = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: info.channels },
  })
    .resize({ width: FINAL_WIDTH, kernel: "lanczos3" })
    .webp(WEBP_OPTS)
    .toFile(outPath);

  // Hägune eelvaade (LQIP): väike base64 WebP, näidatakse enne kui
  // täispilt on laaditud/dekodeeritud (vt RoomStage.jsx).
  const lqipBuffer = await sharp(srcPath)
    .resize({ width: LQIP_WIDTH })
    .blur(1.2)
    .webp({ quality: 32 })
    .toBuffer();
  const lqip = `data:image/webp;base64,${lqipBuffer.toString("base64")}`;

  return {
    frame: n,
    file,
    outName,
    width: outputInfo.width,
    height: outputInfo.height,
    size: outputInfo.size,
    lqip,
  };
}

/** Kirjutab lib/room-frames.js manifesti tulemuste põhjal. */
async function writeManifest(results) {
  const js = `// AUTOGENEREERITUD — scripts/generate-room-images.mjs. Ära muuda käsitsi.
// Ruumikaadrite manifest: üks kõrgekvaliteediline WebP + LQIP eelvaade kaadri kohta.
export const ROOM_FRAME_WIDTH = ${results[0].width};
export const ROOM_FRAME_HEIGHT = ${results[0].height};
export const ROOM_FRAMES = ${JSON.stringify(
    results.map((r) => ({
      n: r.frame,
      src: `/room/${r.outName}`,
      lqip: r.lqip,
    })),
    null,
    2
  )};
`;
  await fs.writeFile(MANIFEST_PATH, js);
}

async function main() {
  console.log("Ruumikaadrite genereerimine: Plaan/*.png -> public/room/frame-N.webp\n");

  await fs.mkdir(OUT_DIR, { recursive: true });

  const { frames, totalPngFound } = await resolveFrames();

  const results = [];
  for (const frame of frames) {
    console.log(`Töötlen kaader ${frame.n}: "${frame.file}"...`);
    const result = await processFrame(frame);
    results.push(result);
    console.log(`  -> ${result.outName}  (${result.width}x${result.height}, ${formatSize(result.size)})`);
  }

  await writeManifest(results);

  const totalSize = results.reduce((sum, r) => sum + r.size, 0);

  console.log("\n--- Kokkuvõte ---");
  console.log(`PNG faile kaustas "Plaan" kokku: ${totalPngFound}`);
  console.log(`Kaadreid töödeldi: ${results.length}`);
  console.log(`WebP faile loodi: ${results.length}`);
  console.log(`Manifest kirjutatud: ${path.relative(ROOT, MANIFEST_PATH)}`);
  console.log("");
  for (const r of results) {
    console.log(
      `  frame-${r.frame}.webp — ${r.width}x${r.height}px, ${formatSize(r.size)}  (allikas: "${r.file}")`
    );
  }
  console.log(`\nKokku uued failid public/room kaustas: ${formatSize(totalSize)}`);
}

main().catch((err) => {
  console.error("\nViga ruumikaadrite genereerimisel:");
  console.error(err);
  process.exitCode = 1;
});
