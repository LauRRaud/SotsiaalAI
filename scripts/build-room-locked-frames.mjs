import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = "C:/Users/rauds/Desktop/SotsiaalAI";
const width = 1672;
const height = 941;

const startReference = path.join(
  root,
  "public/room/ruumi pildid/ruumi referents algus.png",
);
const endReference = path.join(
  root,
  "public/room/ruumi pildid/ruumi referents lõpp.png",
);
const startNatureDonor = path.join(
  root,
  "output/imagegen/room-walk-v8-natural-2026-07-13/frame-01.png",
);
const endCorrectionDonor =
  "C:/Users/rauds/.codex/generated_images/019f5c4a-31e7-7b82-8023-3ad8371fc0c2/exec-62ca5621-8e95-453b-845d-144d7f8e26d2.png";
const outputDir = path.join(
  root,
  "output/imagegen/room-walk-v9-locked-2026-07-13",
);

await fs.mkdir(outputDir, { recursive: true });

function maskSvg(elements) {
  return Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      ${elements}
    </svg>
  `);
}

async function compositeMasked({ base, donor, mask, output }) {
  const donorLayer = await sharp(donor)
    .ensureAlpha()
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();

  await sharp(base)
    .composite([{ input: donorLayer, blend: "over" }])
    .png({ compressionLevel: 9 })
    .toFile(output);
}

const lockedStart = path.join(outputDir, "frame-01.png");
await compositeMasked({
  base: startReference,
  donor: startNatureDonor,
  output: lockedStart,
  mask: maskSvg(`
    <rect x="518" y="200" width="142" height="320" fill="white"/>
    <rect x="676" y="200" width="245" height="320" fill="white"/>
    <rect x="940" y="200" width="150" height="320" fill="white"/>
    <path d="M518 520H590V615H518Z" fill="white"/>
    <path d="M1002 520H1090V615H1002Z" fill="white"/>
    <rect x="590" y="520" width="412" height="8" fill="white"/>
    <rect x="590" y="528" width="14" height="70" fill="white"/>
    <rect x="990" y="528" width="12" height="70" fill="white"/>
  `),
});

async function renderCameraCrop({ source, output, zoom, centerX, centerY }) {
  const cropWidth = Math.round(width / zoom);
  const cropHeight = Math.round(height / zoom);
  const left = Math.max(
    0,
    Math.min(width - cropWidth, Math.round(centerX - cropWidth / 2)),
  );
  const top = Math.max(
    0,
    Math.min(height - cropHeight, Math.round(centerY - cropHeight / 2)),
  );

  await sharp(source)
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9 })
    .toFile(output);
}

const forwardCameras = [
  { frame: 2, zoom: 1.12, centerX: 800, centerY: 466 },
  { frame: 3, zoom: 1.28, centerX: 760, centerY: 452 },
  { frame: 4, zoom: 1.48, centerX: 720, centerY: 438 },
  { frame: 5, zoom: 1.75, centerX: 690, centerY: 424 },
];

for (const camera of forwardCameras) {
  await renderCameraCrop({
    source: lockedStart,
    output: path.join(
      outputDir,
      `frame-${String(camera.frame).padStart(2, "0")}.png`,
    ),
    ...camera,
  });
}

const correctedEnd = path.join(outputDir, "frame-12.png");
await compositeMasked({
  base: endReference,
  donor: endCorrectionDonor,
  output: correctedEnd,
  mask: maskSvg(`
    <rect x="0" y="0" width="24" height="515" fill="white"/>
    <rect x="34" y="0" width="27" height="515" fill="white"/>
    <rect x="70" y="0" width="225" height="515" fill="white"/>
    <defs>
      <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="2"/>
      </filter>
    </defs>
    <ellipse cx="474" cy="516" rx="37" ry="51" fill="white" filter="url(#soft)"/>
  `),
});

await renderCameraCrop({
  source: correctedEnd,
  output: path.join(outputDir, "frame-09.png"),
  zoom: 1.08,
  centerX: 824,
  centerY: 458,
});
await renderCameraCrop({
  source: correctedEnd,
  output: path.join(outputDir, "frame-10.png"),
  zoom: 1.08,
  centerX: 824,
  centerY: 488,
});
await renderCameraCrop({
  source: correctedEnd,
  output: path.join(outputDir, "frame-11.png"),
  zoom: 1.04,
  centerX: 830,
  centerY: 480,
});

console.log(outputDir);
