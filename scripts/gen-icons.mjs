import sharp from "sharp";
import fs from "fs";

// Favicon ja paigaldatav rakendus kasutavad sama S-tähte nagu vestluse
// mõtlemisolek. Rakenduse ikoon jätab maskable kärpele suurema ohutu ala.
const sMark = fs.readFileSync("public/logo/sai-s-valge.svg", "utf8")
  .match(/<svg\b[^>]*>([\s\S]*?)<\/svg>/)[1];
const appSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
<rect width="512" height="512" rx="108" fill="#141414"/>
<svg x="153" y="86" width="206" height="340" viewBox="0 8 25.2 41.6">${sMark}</svg>
</svg>`;
const favSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
<rect width="512" height="512" rx="96" fill="#141414"/>
<svg x="126" y="36" width="260" height="440" viewBox="0 8 25.2 41.6">${sMark}</svg>
</svg>`;

const render = (svg, sz) => sharp(Buffer.from(svg)).resize(sz, sz).png().toBuffer();

function buildIco(items) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(items.length, 4);
  let offset = 6 + items.length * 16;
  const entries = items.map(({ size, buf }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(buf.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += buf.length;
    return e;
  });
  return Buffer.concat([header, ...entries, ...items.map((i) => i.buf)]);
}

const main = async () => {
  if (!process.argv.includes("--favicon-only")) {
    fs.writeFileSync("public/icons/icon-512-v20261003.png", await render(appSvg, 512));
    fs.writeFileSync("public/icons/icon-192-v20261003.png", await render(appSvg, 192));
    const at = await render(appSvg, 180);
    fs.writeFileSync("public/apple-touch-icon.png", at);
    fs.writeFileSync("public/apple-touch-icon-v20261003.png", at);
    fs.writeFileSync("public/logo/sai-icon.svg", appSvg);
  }

  const f16 = await render(favSvg, 16);
  const f32 = await render(favSvg, 32);
  const f48 = await render(favSvg, 48);
  fs.writeFileSync("public/favicon.svg", favSvg);
  fs.writeFileSync("public/favicon-16x16.png", f16);
  fs.writeFileSync("public/favicon-32x32.png", f32);
  fs.writeFileSync("public/favicon-48x48.png", f48);
  fs.writeFileSync("public/favicon.ico", buildIco([
    { size: 16, buf: f16 },
    { size: 32, buf: f32 },
    { size: 48, buf: f48 },
  ]));

  console.log(process.argv.includes("--favicon-only")
    ? "S-favicon genereeritud: SVG, PNG (16/32/48), ICO (16/32/48)."
    : "S-ikoonid genereeritud: rakendus 192/512, Apple touch 180, favicon SVG/PNG/ICO.");
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
