"""Pildi AI-upscale (Real-ESRGAN x4plus) — toa taust jm udused pildid.

Kasutus:
    pip install -r scripts/upscale/requirements.txt
    python scripts/upscale/upscale.py SISEND.png VÄLJUND.webp [--scale 2] [--mix 0.25] [--quality 86]

--scale  lõppsuurendus originaali suhtes (mudel teeb alati 4×, siis vähendatakse)
--mix    kui palju originaali (bikuubiliselt suurendatud) tagasi segada; hoiab
         seinte ja maali tekstuuri, mida ESRGAN üksi siledaks plastiks teeb
--quality  WebP kvaliteet (PNG väljundil ignoreeritakse)

Mudeli kaalud (~67 MB) laaditakse esimesel käivitusel scripts/upscale/models/
kausta (gitignore'itud). Töötab ka ainult protsessoriga: 1672×941 pilt ~5 min.
"""
import argparse
import time
import urllib.request
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from spandrel import ModelLoader

MODEL_URL = "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth"
MODEL_PATH = Path(__file__).parent / "models" / "RealESRGAN_x4plus.pth"
TILE, PAD, NET_SCALE = 256, 16, 4


def load_model():
    if not MODEL_PATH.exists():
        MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
        print(f"Laadin mudeli: {MODEL_URL}")
        urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    return ModelLoader().load_from_file(str(MODEL_PATH)).model.eval().to(device), device


def upscale4(model, device, img):
    x = torch.from_numpy(np.asarray(img).astype(np.float32) / 255).permute(2, 0, 1)[None]
    _, c, h, w = x.shape
    out = torch.zeros(1, c, h * NET_SCALE, w * NET_SCALE)
    s = NET_SCALE
    # Plaatide kaupa, ülekattega: mahub ka väikesesse mällu ja õmblusi ei teki.
    with torch.inference_mode():
        for y0 in range(0, h, TILE):
            for x0 in range(0, w, TILE):
                ya, xa = max(y0 - PAD, 0), max(x0 - PAD, 0)
                yb, xb = min(y0 + TILE + PAD, h), min(x0 + TILE + PAD, w)
                o = model(x[:, :, ya:yb, xa:xb].to(device)).cpu()
                oy, ox = (y0 - ya) * s, (x0 - xa) * s
                th, tw = min(TILE, h - y0) * s, min(TILE, w - x0) * s
                out[:, :, y0 * s:y0 * s + th, x0 * s:x0 * s + tw] = o[:, :, oy:oy + th, ox:ox + tw]
    arr = (out[0].clamp(0, 1).permute(1, 2, 0).numpy() * 255 + 0.5).astype(np.uint8)
    return Image.fromarray(arr)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("output")
    ap.add_argument("--scale", type=float, default=2)
    ap.add_argument("--mix", type=float, default=0.25)
    ap.add_argument("--quality", type=int, default=86)
    a = ap.parse_args()

    src = Image.open(a.input).convert("RGB")
    model, device = load_model()
    t = time.time()
    big = upscale4(model, device, src)
    size = (round(src.width * a.scale), round(src.height * a.scale))
    result = big.resize(size, Image.LANCZOS)
    if a.mix > 0:
        result = Image.blend(result, src.resize(size, Image.BICUBIC), a.mix)
    opts = {"quality": a.quality, "method": 6} if a.output.lower().endswith(".webp") else {}
    result.save(a.output, **opts)
    print(f"{a.output}: {size[0]}×{size[1]} ({device}, {time.time() - t:.0f} s)")


if __name__ == "__main__":
    main()
