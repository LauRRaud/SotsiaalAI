#!/usr/bin/env node
/**
 * Ruumikaadrite konveier: Plaan/*.png → public/room/
 * AVIF + WebP mitmes laiuses + LQIP (base64) manifest.
 * Originaalfailid jäävad puutumata (brief ptk 3).
 *
 * Kasutus: node scripts/build-room-frames.mjs
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const SRC_DIR = path.join(ROOT, "Plaan");
const OUT_DIR = path.join(ROOT, "public", "room");
const MANIFEST = path.join(ROOT, "lib", "room-frames.js");

const FRAMES = [
  { n: 1, src: "1 - vaade uksest.png" },
  { n: 2, src: "2 - vaade ruumile.png" },
  { n: 3, src: "3 - vaatan tugitooli.png" },
  { n: 4, src: "4 - liigun lähemale.png" },
  { n: 5, src: "5 - viimane kaader enne istumist.png" },
  { n: 6, src: "6 - istun ja vaatan seina.png" },
  { n: 7, src: "7 - enne fookust kaartidele - enne sisse logimist.png" },
];

const WIDTHS = [1672, 1280, 960, 640];
const AVIF_OPTS = { quality: 55, effort: 6 };
const WEBP_OPTS = { quality: 74 };
const LQIP_WIDTH = 28;

async function build() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const manifest = [];

  for (const { n, src } of FRAMES) {
    const srcPath = path.join(SRC_DIR, src);
    if (!fs.existsSync(srcPath)) throw new Error(`Puudub: ${srcPath}`);
    const base = sharp(srcPath);
    const meta = await base.metadata();
    const entry = {
      n,
      width: meta.width,
      height: meta.height,
      avif: [],
      webp: [],
      lqip: "",
    };

    for (const w of WIDTHS) {
      if (w > meta.width) continue;
      const resized = base.clone().resize({ width: w, kernel: "lanczos3" });
      const avifName = `frame-${n}-${w}.avif`;
      const webpName = `frame-${n}-${w}.webp`;
      await resized.clone().avif(AVIF_OPTS).toFile(path.join(OUT_DIR, avifName));
      await resized.clone().webp(WEBP_OPTS).toFile(path.join(OUT_DIR, webpName));
      entry.avif.push({ w, file: `/room/${avifName}` });
      entry.webp.push({ w, file: `/room/${webpName}` });
      console.log(`frame ${n} @${w} ok`);
    }

    const lqipBuf = await base
      .clone()
      .resize({ width: LQIP_WIDTH })
      .blur(1.2)
      .webp({ quality: 32 })
      .toBuffer();
    entry.lqip = `data:image/webp;base64,${lqipBuf.toString("base64")}`;
    manifest.push(entry);
  }

  const js = `// AUTOGENEREERITUD — scripts/build-room-frames.mjs. Ära muuda käsitsi.
// Ruumikaadrite manifest: srcset-allikad + LQIP eelvaated.
export const ROOM_FRAME_WIDTH = ${manifest[0].width};
export const ROOM_FRAME_HEIGHT = ${manifest[0].height};
export const ROOM_FRAMES = ${JSON.stringify(
    manifest.map((m) => ({
      n: m.n,
      avifSrcSet: m.avif.map((a) => `${a.file} ${a.w}w`).join(", "),
      webpSrcSet: m.webp.map((a) => `${a.file} ${a.w}w`).join(", "),
      src: m.webp[0].file,
      lqip: m.lqip,
    })),
    null,
    2
  )};
`;
  fs.writeFileSync(MANIFEST, js);

  const total = fs
    .readdirSync(OUT_DIR)
    .reduce((s, f) => s + fs.statSync(path.join(OUT_DIR, f)).size, 0);
  console.log(`\nKokku public/room: ${(total / 1024 / 1024).toFixed(1)} MB`);
  console.log(`Manifest: ${MANIFEST}`);
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});
