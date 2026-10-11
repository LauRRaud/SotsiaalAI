/**
 * QR-koodi kodeerija (mudel 2), nii palju kui uksesildi lingi jaoks vaja.
 *
 * MIKS OMA KOOD. Platvormil ei ole QR-teeki ja uksesilt on ainus koht, kus koodi
 * vaja on: lühike aadress, üks veaparanduse tase. Kodeerija on väike, ilma
 * sõltuvusteta ja testitud sõltumatu lugejaga (vt testid): iga muudatuse järel
 * peab kood endiselt lahti lugema sama teksti.
 *
 * MIDA TOETAB: baidirežiim (UTF-8), veaparanduse tase M (taastab umbes 15%
 * kahjustusest: ukse kõrval olev silt kulub), versioonid 1 kuni 10 (kuni 213
 * baiti). Pikem tekst on viga, mitte loetamatu kood.
 *
 * Tulemus on ruudustik `true` (tume) ja `false` (hele) väärtustest; vaikse
 * ääre lisab joonistaja (`qrSvgPath`).
 */

const MIN_VERSION = 1;
const MAX_VERSION = 10;
/* Tase M: veaparanduse koodsõnu ploki kohta ja plokkide arv, versiooni järgi (indeks 0 on tühi). */
const ECC_PER_BLOCK = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
/* Vormingubittides on tase M väärtusega 0. */
const FORMAT_LEVEL_M = 0;

function rawDataModules(version) {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const align = Math.floor(version / 7) + 2;
    result -= (25 * align - 10) * align - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

function dataCodewords(version) {
  return Math.floor(rawDataModules(version) / 8) - ECC_PER_BLOCK[version] * BLOCKS[version];
}

/** Mitu baiti teksti versioon mahutab (režiimi ja pikkuse bitid maha arvatud). */
export function qrCapacityBytes(version) {
  const countBits = version <= 9 ? 8 : 16;
  return Math.floor((dataCodewords(version) * 8 - 4 - countBits) / 8);
}

/* Galois' väli GF(256), taandav polünoom 0x11D. */
function gfMultiply(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i -= 1) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function rsDivisor(degree) {
  const result = new Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i += 1) {
    for (let j = 0; j < result.length; j += 1) {
      result[j] = gfMultiply(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
}

function rsRemainder(data, divisor) {
  const result = new Array(divisor.length).fill(0);
  for (const byte of data) {
    const factor = byte ^ result.shift();
    result.push(0);
    for (let i = 0; i < divisor.length; i += 1) result[i] ^= gfMultiply(divisor[i], factor);
  }
  return result;
}

/** Andmebaidid plokkideks, igale veaparandus, ja plokid läbisegi nagu standard nõuab. */
function addEccAndInterleave(version, data) {
  const blockCount = BLOCKS[version];
  const eccLength = ECC_PER_BLOCK[version];
  const rawCodewords = Math.floor(rawDataModules(version) / 8);
  const shortBlocks = blockCount - (rawCodewords % blockCount);
  const shortLength = Math.floor(rawCodewords / blockCount);
  const divisor = rsDivisor(eccLength);
  const blocks = [];
  let offset = 0;
  for (let i = 0; i < blockCount; i += 1) {
    const length = shortLength - eccLength + (i < shortBlocks ? 0 : 1);
    const chunk = data.slice(offset, offset + length);
    offset += length;
    const ecc = rsRemainder(chunk, divisor);
    if (i < shortBlocks) chunk.push(0);
    blocks.push(chunk.concat(ecc));
  }
  const result = [];
  for (let i = 0; i < blocks[0].length; i += 1) {
    blocks.forEach((block, j) => {
      /* Lühema ploki täitekoht jäetakse vahele. */
      if (i !== shortLength - eccLength || j >= shortBlocks) result.push(block[i]);
    });
  }
  return result;
}

function alignmentPositions(version) {
  if (version === 1) return [];
  const size = version * 4 + 17;
  const count = Math.floor(version / 7) + 2;
  const step = Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
  const result = [6];
  for (let position = size - 7; result.length < count; position -= step) result.splice(1, 0, position);
  return result;
}

function bit(value, index) {
  return ((value >>> index) & 1) !== 0;
}

function maskAt(mask, x, y) {
  switch (mask) {
    case 0:
      return (x + y) % 2 === 0;
    case 1:
      return y % 2 === 0;
    case 2:
      return x % 3 === 0;
    case 3:
      return (x + y) % 3 === 0;
    case 4:
      return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6:
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    default:
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
  }
}

/* Maski valik: standardi neli karistusreeglit; väikseim summa võidab. */
function penalty(modules) {
  const size = modules.length;
  let result = 0;

  const lines = [];
  for (let y = 0; y < size; y += 1) lines.push(modules[y]);
  for (let x = 0; x < size; x += 1) lines.push(modules.map((row) => row[x]));

  for (const line of lines) {
    /* 1. Viis või rohkem sama värvi järjest. */
    let run = 1;
    for (let i = 1; i <= size; i += 1) {
      if (i < size && line[i] === line[i - 1]) run += 1;
      else {
        if (run >= 5) result += 3 + (run - 5);
        run = 1;
      }
    }
    /* 3. Otsimismustrit meenutav jada 1:1:3:1:1 nelja heleda mooduliga kõrval. */
    const text = line.map((dark) => (dark ? "1" : "0")).join("");
    for (const pattern of ["10111010000", "00001011101"]) {
      let from = text.indexOf(pattern);
      while (from !== -1) {
        result += 40;
        from = text.indexOf(pattern, from + 1);
      }
    }
  }

  /* 2. Sama värvi 2×2 ruudud. */
  for (let y = 0; y < size - 1; y += 1) {
    for (let x = 0; x < size - 1; x += 1) {
      const color = modules[y][x];
      if (color === modules[y][x + 1] && color === modules[y + 1][x] && color === modules[y + 1][x + 1]) result += 3;
    }
  }

  /* 4. Tumedate osakaal kaugel poolest. */
  let dark = 0;
  for (const row of modules) for (const value of row) if (value) dark += 1;
  const total = size * size;
  const steps = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
  result += Math.max(0, steps) * 10;
  return result;
}

/**
 * Tekst QR-koodiks.
 * @returns {{ version: number, size: number, modules: boolean[][] }}
 * @throws RangeError, kui tekst ei mahu toetatud versioonidesse
 */
export function encodeQr(text) {
  const bytes = Array.from(new TextEncoder().encode(String(text ?? "")));
  let version = MIN_VERSION;
  while (version <= MAX_VERSION && bytes.length > qrCapacityBytes(version)) version += 1;
  if (version > MAX_VERSION) throw new RangeError("qr_text_too_long");

  /* Bitijada: režiim (bait), pikkus, andmed, lõpetaja, täide. */
  const bits = [];
  const push = (value, length) => {
    for (let i = length - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
  };
  push(0x4, 4);
  push(bytes.length, version <= 9 ? 8 : 16);
  for (const byte of bytes) push(byte, 8);
  const capacityBits = dataCodewords(version) * 8;
  push(0, Math.min(4, capacityBits - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacityBits; pad ^= 0xec ^ 0x11) push(pad, 8);

  const data = [];
  for (let i = 0; i < bits.length; i += 8) {
    let value = 0;
    for (let j = 0; j < 8; j += 1) value = (value << 1) | bits[i + j];
    data.push(value);
  }
  const codewords = addEccAndInterleave(version, data);

  const size = version * 4 + 17;
  const modules = Array.from({ length: size }, () => new Array(size).fill(false));
  const isFunction = Array.from({ length: size }, () => new Array(size).fill(false));
  const setFunction = (x, y, dark) => {
    modules[y][x] = dark;
    isFunction[y][x] = true;
  };

  /* Ajastusjooned. */
  for (let i = 0; i < size; i += 1) {
    setFunction(6, i, i % 2 === 0);
    setFunction(i, 6, i % 2 === 0);
  }
  /* Kolm otsimismustrit koos eraldajaga. */
  for (const [cx, cy] of [
    [3, 3],
    [size - 4, 3],
    [3, size - 4]
  ]) {
    for (let dy = -4; dy <= 4; dy += 1) {
      for (let dx = -4; dx <= 4; dx += 1) {
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < size && y >= 0 && y < size) setFunction(x, y, distance !== 2 && distance !== 4);
      }
    }
  }
  /* Joondusmustrid (mitte otsimismustrite kohal). */
  const align = alignmentPositions(version);
  for (let i = 0; i < align.length; i += 1) {
    for (let j = 0; j < align.length; j += 1) {
      const corner =
        (i === 0 && j === 0) || (i === 0 && j === align.length - 1) || (i === align.length - 1 && j === 0);
      if (corner) continue;
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          setFunction(align[i] + dx, align[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    }
  }

  const drawFormat = (mask) => {
    const value = (FORMAT_LEVEL_M << 3) | mask;
    let remainder = value;
    for (let i = 0; i < 10; i += 1) remainder = (remainder << 1) ^ ((remainder >>> 9) * 0x537);
    const format = ((value << 10) | remainder) ^ 0x5412;
    for (let i = 0; i <= 5; i += 1) setFunction(8, i, bit(format, i));
    setFunction(8, 7, bit(format, 6));
    setFunction(8, 8, bit(format, 7));
    setFunction(7, 8, bit(format, 8));
    for (let i = 9; i < 15; i += 1) setFunction(14 - i, 8, bit(format, i));
    for (let i = 0; i < 8; i += 1) setFunction(size - 1 - i, 8, bit(format, i));
    for (let i = 8; i < 15; i += 1) setFunction(8, size - 15 + i, bit(format, i));
    /* Alati tume moodul. */
    setFunction(8, size - 8, true);
  };
  drawFormat(0);

  /* Versiooniinfo alates versioonist 7. */
  if (version >= 7) {
    let remainder = version;
    for (let i = 0; i < 12; i += 1) remainder = (remainder << 1) ^ ((remainder >>> 11) * 0x1f25);
    const info = (version << 12) | remainder;
    for (let i = 0; i < 18; i += 1) {
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      setFunction(a, b, bit(info, i));
      setFunction(b, a, bit(info, i));
    }
  }

  /* Koodsõnad siksakis paremalt vasakule; ajastusveerg jäetakse vahele. */
  let index = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vertical = 0; vertical < size; vertical += 1) {
      for (let j = 0; j < 2; j += 1) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vertical : vertical;
        if (!isFunction[y][x] && index < codewords.length * 8) {
          modules[y][x] = bit(codewords[index >>> 3], 7 - (index & 7));
          index += 1;
        }
      }
    }
  }

  const applyMask = (mask) => {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        if (!isFunction[y][x] && maskAt(mask, x, y)) modules[y][x] = !modules[y][x];
      }
    }
  };

  let best = 0;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask += 1) {
    applyMask(mask);
    drawFormat(mask);
    const score = penalty(modules);
    if (score < bestScore) {
      bestScore = score;
      best = mask;
    }
    applyMask(mask);
  }
  applyMask(best);
  drawFormat(best);

  return { version, size, modules };
}

/**
 * SVG `path` atribuudi sisu: iga tume moodul on ühikruut. Vaikne äär (4
 * moodulit) on koordinaatides sees, `viewBox` on `0 0 ${side} ${side}`.
 */
export function qrSvgPath(modules, quiet = 4) {
  const parts = [];
  for (let y = 0; y < modules.length; y += 1) {
    for (let x = 0; x < modules.length; x += 1) {
      if (modules[y][x]) parts.push(`M${x + quiet},${y + quiet}h1v1h-1z`);
    }
  }
  return { d: parts.join(""), side: modules.length + quiet * 2 };
}
