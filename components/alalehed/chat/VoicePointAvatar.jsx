"use client";

import { useEffect, useRef } from "react";
import { Camera, Geometry, Mesh, Program, Renderer } from "ogl";

const VERTEX_SHADER = `
  precision highp float;
  attribute vec3 position;
  attribute float aKind;
  attribute float aPart;
  attribute float aTone;
  attribute float aSeed;
  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  uniform float uTime;
  uniform float uEnergy;
  uniform float uState;
  uniform vec2 uPointer;
  varying float vAlpha;
  varying float vTone;
  varying float vKind;

  mat2 rotate2d(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat2(c, -s, s, c);
  }

  void main() {
    vec3 p = position;
    float speaking = step(2.5, uState) * (1.0 - step(3.5, uState));
    float listening = step(0.5, uState) * (1.0 - step(1.5, uState));

    if (aKind < 1.5) {
      float headWeight = aPart;
      p.xz = rotate2d(uPointer.x * 0.28 * headWeight) * p.xz;
      p.yz = rotate2d(-uPointer.y * 0.16 * headWeight) * p.yz;
      p.y += sin(uTime * 0.72 + aSeed * 6.283) * 0.006 * (0.25 + headWeight);
    }

    if (aKind > 1.5) {
      float cycle = fract(uTime * (0.24 + aTone * 0.05) + aSeed);
      float angle = aSeed * 6.2831853 + aTone * 1.71;
      float radius = 0.38 + cycle * (0.74 + uEnergy * 0.34);
      p = vec3(
        cos(angle) * radius,
        0.19 + sin(angle) * radius * 0.48,
        0.34 + sin(angle * 2.0) * 0.08
      );
      vAlpha = speaking * sin(cycle * 3.14159) * (0.26 + uEnergy * 0.74);
    } else if (aKind > 0.5) {
      float drift = sin(uTime * 0.45 + aSeed * 18.0);
      p.xy += vec2(cos(aSeed * 19.0), sin(aSeed * 23.0)) * drift * 0.018;
      vAlpha = 0.12 + 0.17 * (0.5 + 0.5 * drift) + listening * uEnergy * 0.22;
    } else {
      float depth = smoothstep(-0.72, 0.75, p.z);
      vAlpha = mix(0.38, 1.0, depth);
    }

    vec4 view = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * view;
    float perspective = 300.0 / max(1.0, -view.z);
    float baseSize = aKind > 1.5 ? 2.8 : mix(1.25, 2.15, smoothstep(-0.7, 0.7, p.z));
    gl_PointSize = baseSize * perspective * 0.02 * (1.0 + uEnergy * 0.26);
    vTone = aTone;
    vKind = aKind;
  }
`;

const FRAGMENT_SHADER = `
  precision highp float;
  uniform float uState;
  uniform float uEnergy;
  varying float vAlpha;
  varying float vTone;
  varying float vKind;

  void main() {
    vec2 point = gl_PointCoord - 0.5;
    float distanceToCenter = length(point);
    if (distanceToCenter > 0.5) discard;
    float core = smoothstep(0.5, 0.06, distanceToCenter);
    float halo = smoothstep(0.5, 0.22, distanceToCenter);

    vec3 pearl = vec3(0.86, 0.84, 0.82);
    vec3 platinum = vec3(0.59, 0.60, 0.64);
    vec3 violet = vec3(0.36, 0.28, 0.45);
    vec3 champagne = vec3(0.86, 0.68, 0.52);
    vec3 roseGold = vec3(0.77, 0.43, 0.39);
    float speaking = step(2.5, uState) * (1.0 - step(3.5, uState));

    vec3 shell = mix(platinum, pearl, vTone);
    shell = mix(shell, violet, smoothstep(0.62, 1.0, vTone) * 0.38);
    vec3 energy = mix(champagne, roseGold, clamp(vTone + uEnergy * 0.35, 0.0, 1.0));
    vec3 color = mix(shell, energy, speaking * smoothstep(0.28, 1.0, vTone));
    if (vKind > 1.5) color = energy;
    if (uState > 3.5) color = mix(platinum, violet, 0.66);

    float alpha = vAlpha * (core * 0.84 + halo * 0.32);
    gl_FragColor = vec4(color, alpha);
  }
`;

function seededRandom(seedRef) {
  seedRef.value = (seedRef.value * 1664525 + 1013904223) >>> 0;
  return seedRef.value / 4294967296;
}

function createAvatarGeometry() {
  const positions = [];
  const kinds = [];
  const parts = [];
  const tones = [];
  const seeds = [];
  const seed = { value: 0x5a17a1 };
  const push = (x, y, z, kind, part, tone) => {
    positions.push(x, y, z);
    kinds.push(kind);
    parts.push(part);
    tones.push(tone);
    seeds.push(seededRandom(seed));
  };

  // Nägu ja kolju: kitsenev lõug, kergelt laiem põsesarn ning sügavusega täpikest.
  for (let i = 0; i < 4200; i += 1) {
    const u = seededRandom(seed);
    const v = seededRandom(seed);
    const theta = u * Math.PI * 2;
    const phi = Math.acos(1 - 2 * v);
    const vertical = Math.cos(phi);
    const cheek = 0.78 + 0.12 * Math.exp(-Math.pow((vertical + 0.05) / 0.4, 2));
    const jaw = vertical < -0.25 ? 1 - (-vertical - 0.25) * 0.34 : 1;
    const x = Math.sin(phi) * Math.cos(theta) * 0.7 * cheek * jaw;
    const y = vertical * 0.94 + 0.48;
    const z = Math.sin(phi) * Math.sin(theta) * 0.61;
    const front = (z + 0.61) / 1.22;
    push(x, y, z, 0, 1, 0.18 + front * 0.68);
  }

  // Juuksekaar – hõredam, tumedam ja peast veidi eemal.
  for (let i = 0; i < 1150; i += 1) {
    const theta = seededRandom(seed) * Math.PI * 2;
    const phi = seededRandom(seed) * Math.PI * 0.83;
    const side = Math.abs(Math.cos(theta));
    const x = Math.sin(phi) * Math.cos(theta) * (0.75 + side * 0.08);
    const y = Math.cos(phi) * 1.03 + 0.58;
    const z = Math.sin(phi) * Math.sin(theta) * 0.67 - 0.05;
    push(x, y, z, 0, 1, 0.86);
  }

  // Silmad, nina ja huuled: geomeetrilised kontuurid teevad büsti loetavaks ka väikesel ekraanil.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 145; i += 1) {
      const a = (i / 144) * Math.PI * 2;
      push(side * 0.245 + Math.cos(a) * 0.13, 0.62 + Math.sin(a) * 0.045, 0.57, 0, 1, 0.92);
    }
  }
  for (let i = 0; i < 180; i += 1) {
    const p = i / 179;
    push(Math.sin(p * Math.PI * 2) * 0.035, 0.57 - p * 0.34, 0.615 - Math.abs(p - 0.5) * 0.08, 0, 1, 0.74);
  }
  for (let i = 0; i < 260; i += 1) {
    const a = (i / 259) * Math.PI * 2;
    push(Math.cos(a) * 0.16, 0.17 + Math.sin(a) * 0.052, 0.595, 0, 1, 0.98);
  }

  // Kael ja õlad – stabiilne alus, mida hiir ei pööra.
  for (let band = 0; band < 16; band += 1) {
    const p = band / 15;
    const y = -0.28 - p * 0.42;
    const width = 0.25 + p * 0.12;
    for (let i = 0; i < 82; i += 1) {
      const a = seededRandom(seed) * Math.PI * 2;
      push(Math.cos(a) * width, y, Math.sin(a) * 0.32, 0, 0, 0.36 + seededRandom(seed) * 0.34);
    }
  }
  for (let i = 0; i < 3200; i += 1) {
    const yProgress = seededRandom(seed);
    const y = -0.56 - yProgress * 0.72;
    const shoulderWidth = 0.46 + Math.pow(yProgress, 0.48) * 1.12;
    const x = (seededRandom(seed) * 2 - 1) * shoulderWidth;
    const edge = Math.abs(x) / shoulderWidth;
    const z = (seededRandom(seed) * 2 - 1) * (0.36 - edge * 0.14);
    push(x, y - edge * 0.16, z, 0, 0, 0.18 + seededRandom(seed) * 0.5);
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 620; i += 1) {
      const p = seededRandom(seed);
      const x = side * (0.28 + p * 1.16) + (seededRandom(seed) - 0.5) * 0.045;
      const y = -0.53 - Math.pow(p, 1.45) * 0.24 + (seededRandom(seed) - 0.5) * 0.045;
      const z = 0.28 - p * 0.08 + (seededRandom(seed) - 0.5) * 0.09;
      push(x, y, z, 0, 0, 0.58 + seededRandom(seed) * 0.28);
    }
  }

  // Hõljuv ruumitunne ning kõne ajal suust/kõrist levivad lained.
  for (let i = 0; i < 360; i += 1) {
    const a = seededRandom(seed) * Math.PI * 2;
    const r = 0.82 + seededRandom(seed) * 0.78;
    push(Math.cos(a) * r, 0.36 + Math.sin(a) * r * 0.8, -0.14 + seededRandom(seed) * 0.42, 1, 1, seededRandom(seed));
  }
  for (let i = 0; i < 720; i += 1) {
    push(0, 0, 0, 2, 1, (i % 6) / 5);
  }

  return {
    position: new Float32Array(positions),
    kind: new Float32Array(kinds),
    part: new Float32Array(parts),
    tone: new Float32Array(tones),
    seed: new Float32Array(seeds)
  };
}

const STATE_VALUE = {
  idle: 0,
  connecting: 2,
  listening: 1,
  thinking: 2,
  speaking: 3,
  ended: 4,
  error: 4
};

export default function VoicePointAvatar({ status = "idle", audioLevel = 0, label = "" }) {
  const hostRef = useRef(null);
  const statusRef = useRef(status);
  const energyRef = useRef(audioLevel);
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { energyRef.current = audioLevel; }, [audioLevel]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    let renderer;
    try {
      renderer = new Renderer({ alpha: true, antialias: true, dpr: Math.min(1.75, window.devicePixelRatio || 1) });
    } catch {
      host.dataset.webgl = "unavailable";
      return undefined;
    }
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    host.appendChild(gl.canvas);
    const camera = new Camera(gl, { fov: 31, near: 0.1, far: 100 });
    camera.position.set(0, 0.04, 5.05);

    const avatar = createAvatarGeometry();
    const geometry = new Geometry(gl, {
      position: { size: 3, data: avatar.position },
      aKind: { size: 1, data: avatar.kind },
      aPart: { size: 1, data: avatar.part },
      aTone: { size: 1, data: avatar.tone },
      aSeed: { size: 1, data: avatar.seed }
    });
    const program = new Program(gl, {
      vertex: VERTEX_SHADER,
      fragment: FRAGMENT_SHADER,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      cullFace: false,
      uniforms: {
        uTime: { value: 0 },
        uEnergy: { value: 0 },
        uState: { value: 0 },
        uPointer: { value: [0, 0] }
      }
    });
    const mesh = new Mesh(gl, { mode: gl.POINTS, geometry, program });
    mesh.position.y = 0.12;
    mesh.scale.set(1.12, 1.12, 1.12);

    const pointerTarget = [0, 0];
    const pointerCurrent = [0, 0];
    const reducedMotion = document.documentElement.dataset.reduceMotion === "1"
      || window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const onPointerMove = event => {
      if (reducedMotion) return;
      const rect = host.getBoundingClientRect();
      pointerTarget[0] = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1));
      pointerTarget[1] = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height) * 2 - 1));
    };
    host.addEventListener("pointermove", onPointerMove, { passive: true });

    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      const compact = width < 520;
      camera.position.z = compact ? 5.72 : 5.05;
      mesh.scale.set(compact ? 1.02 : 1.12, compact ? 1.02 : 1.12, compact ? 1.02 : 1.12);
      renderer.setSize(width, height);
      camera.perspective({ aspect: width / height });
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    let frame = null;
    const startedAt = performance.now();
    const render = now => {
      const time = (now - startedAt) / 1000;
      pointerCurrent[0] += (pointerTarget[0] - pointerCurrent[0]) * 0.045;
      pointerCurrent[1] += (pointerTarget[1] - pointerCurrent[1]) * 0.045;
      const state = STATE_VALUE[statusRef.current] ?? 0;
      const automaticEnergy = state === 3 ? 0.42 + Math.sin(time * 7.1) * 0.2 + Math.sin(time * 12.7) * 0.12 : 0;
      program.uniforms.uTime.value = reducedMotion ? 0 : time;
      program.uniforms.uState.value = state;
      program.uniforms.uEnergy.value += (Math.max(energyRef.current, automaticEnergy) - program.uniforms.uEnergy.value) * 0.12;
      program.uniforms.uPointer.value = pointerCurrent;
      renderer.render({ scene: mesh, camera });
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      host.removeEventListener("pointermove", onPointerMove);
      geometry.remove?.();
      program.remove?.();
      try { host.removeChild(gl.canvas); } catch {}
      renderer = null;
    };
  }, []);

  return (
    <div ref={hostRef} className="voice-avatar" data-state={status} role="img" aria-label={label}>
      <div className="voice-avatar__fallback" aria-hidden="true" />
    </div>
  );
}
