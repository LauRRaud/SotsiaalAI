"use client";

import { useEffect, useRef } from "react";
import { Camera, Geometry, Mesh, Program, Renderer } from "ogl";

/*
 * Häälavatar: 3D punktipilv, mis on omaniku renderdusest välja loetud.
 *
 * Pilti ennast avatarina EI kasutata. `scripts/voice/build-avatar-cloud.mjs`
 * leiab lähtefailist iga täpi keskme, annab talle siluetist tuletatud
 * sügavuse ja kirjutab tulemuse binaarfaili. Siin joonistatakse ainult
 * needsamad täpid — seega pöörab pea ennast PÄRISELT ruumis, mitte ei
 * nihku parallaksiga.
 *
 * Suu asemel on näol tühi pind. Kõne ajal süttivad SEAL olevad täpid
 * ribadena ja võnguvad kõne tugevusega — valgus tuleb kehast, mitte
 * pealekleebitud graafikast.
 */

const CLOUD_SRC = "/voice/avatar-cloud.bin";
const HEADER_BYTES = 32;

const VERTEX_SHADER = `
  precision highp float;

  attribute vec3 position;
  attribute vec3 aNormal;
  attribute vec3 aColor;
  attribute float aRig;
  attribute float aSize;

  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  uniform float uTime;
  uniform float uEnergy;
  uniform float uSpeaking;
  uniform float uListening;
  uniform float uSizeScale;
  uniform vec2 uPointer;
  uniform vec3 uMouth;
  uniform vec3 uPivot;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vGlow;
  varying float vRim;

  mat3 headRotation(float yaw, float pitch) {
    float cy = cos(yaw), sy = sin(yaw), cp = cos(pitch), sp = sin(pitch);
    mat3 rotateY = mat3(cy, 0.0, -sy, 0.0, 1.0, 0.0, sy, 0.0, cy);
    mat3 rotateX = mat3(1.0, 0.0, 0.0, 0.0, cp, sp, 0.0, -sp, cp);
    return rotateY * rotateX;
  }

  void main() {
    vec3 p = position;

    // Suu võnked: seitse riba näo tühjal pinnal. Amplituud tuleb kõne
    // tugevusest, muster ajast — nii ei ole see silmus, vaid reageering.
    vec3 toMouth = p - uMouth;
    float lateral = toMouth.x / 0.135;
    float vertical = toMouth.y / 0.052;
    float depthGate = 1.0 - smoothstep(0.06, 0.2, abs(toMouth.z));
    float mouthGlow = 0.0;
    if (abs(lateral) < 1.0 && abs(vertical) < 2.6 && depthGate > 0.0) {
      float bars = 7.0;
      float slot = (lateral * 0.5 + 0.5) * bars;
      float index = floor(slot);
      float local = fract(slot) - 0.5;
      float phase = uTime * (7.2 + index * 1.9) + index * 2.3;
      float level = 0.3 + 0.7 * abs(sin(phase)) * (0.45 + 0.55 * abs(sin(phase * 0.37)));
      float height = uEnergy * level * max(0.0, 1.0 - 0.55 * lateral * lateral) * 1.9;
      float bar = smoothstep(0.46, 0.16, abs(local));
      float body = smoothstep(height, height * 0.2, abs(vertical));
      mouthGlow = bar * body * depthGate * uSpeaking;
      // Süttinud täpid astuvad veidi ettepoole — valgus tuleb seest välja.
      p += normalize(vec3(0.0, 0.0, 1.0)) * mouthGlow * 0.02;
    }

    // Hingamine ja kerge elutus, et figuur ei seisaks surnult.
    p.y += sin(uTime * 0.62 + p.x * 1.4) * 0.0035;

    vec3 n = aNormal;
    if (aRig > 0.001) {
      mat3 rotation = headRotation(uPointer.x * 0.34 * aRig, uPointer.y * 0.2 * aRig);
      p = uPivot + rotation * (p - uPivot);
      n = rotation * n;
    }

    vec4 view = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * view;
    // Suurem täpp = rohkem kattumist = heledam pind. Lähtepildil tuleb
    // heledus just sellest ja sisseküpsetatud hõõgusest.
    gl_PointSize = clamp(
      aSize * uSizeScale * 2.4 * (1.0 + mouthGlow * 0.7) / max(0.2, -view.z),
      1.4, 14.0
    );

    // Sooja ja külma kanali eristus tuleb ALLIKAVÄRVIST, mitte maskist:
    // kuldsed energiajooned on pildis juba olemas.
    float warm = clamp((aColor.r - aColor.b) * 3.2, 0.0, 1.0);
    float flow = 0.5 + 0.5 * sin(p.y * 9.0 - uTime * 2.6);
    float warmGain = 1.0 + warm * uSpeaking * (0.3 + uEnergy * 0.85) * (0.4 + 0.6 * flow);
    float coolGain = 1.0 + (1.0 - warm) * uListening * uEnergy * 0.35
      * (0.5 + 0.5 * sin(p.y * 7.0 + uTime * 1.2));

    // Võlts-oklusioon. Sügavustesti ei ole (täpid on läbipaistvad ja
    // sorteerimata), seega tuleb tagakülg kustutada pinnasuuna järgi —
    // muidu paistab kaugem kõrv läbi pea ja pöördel loeb pea lamedana.
    vec3 viewNormal = normalize(mat3(modelViewMatrix) * n);
    float facing = viewNormal.z;
    float front = smoothstep(-0.45, 0.3, facing);
    // Terav aste hoiab valge servavalguse TÄPSELT siluetil. Lauge aste (3.2)
    // valgustas poolt keha ja pleegitas sinise ära.
    float rim = pow(1.0 - abs(facing), 5.0);

    // Lähtepildi täpid on üksikuna tumedad — pildil tuleb heledus täppide
    // kattumisest ja sisseküpsetatud hõõgusest, mida pilves ei ole. Võimendus
    // toob need tagasi; küllastuse laseb fragment üle ääre minna.
    // Värv EI tohi ületada ühte: fragment väljastab color*alpha ja
    // premultiplied over kuhjab kattuvatel täppidel üle piiri, mille peale
    // kanalid lõikuvad ja sinine pleegib valgeks (mõõdetud: sinisus 38 -> 8).
    vColor = clamp(aColor * 1.15 * warmGain * coolGain, 0.0, 1.0);
    vAlpha = (0.72 + 0.28 * aSize) * (mix(0.05, 1.0, front) + rim * 0.6);
    vRim = rim;
    vGlow = mouthGlow * front;
  }
`;

const FRAGMENT_SHADER = `
  precision highp float;

  uniform float uDim;
  uniform float uEnergy;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vGlow;
  varying float vRim;

  void main() {
    vec2 offset = gl_PointCoord - 0.5;
    float distance = length(offset);
    if (distance > 0.5) discard;
    float core = smoothstep(0.5, 0.08, distance);
    float halo = smoothstep(0.5, 0.28, distance);

    // Servavalgus: siluetil süttivad täpid. Toon on JAHE tsüaanivalge, nagu
    // lähtepildil — soe valge (1.0, 0.96, 0.9) neutraliseeris sinise keha ja
    // kogu figuur luges hallina (mõõdetud: sinisus B-R 37 asemel 11).
    vec3 color = mix(vColor, vec3(0.82, 0.93, 1.0), clamp(vRim * 1.1, 0.0, 0.8));
    if (vGlow > 0.0) {
      vec3 spark = mix(vec3(1.0, 0.79, 0.46), vec3(1.0, 0.95, 0.86), min(0.65, vGlow * 0.65));
      color = mix(color, spark, min(1.0, vGlow * 1.6)) * (1.0 + vGlow * (0.6 + uEnergy * 0.8));
    }

    // Lai pehme halo asendab lähtepildi sisseküpsetatud hõõgust.
    float alpha = vAlpha * (core * 0.8 + halo * 0.72) * uDim;
    gl_FragColor = vec4(color * alpha, alpha);
  }
`;

const STATE_VALUE = {
  idle: { speaking: 0, listening: 0, dim: 0.88 },
  connecting: { speaking: 0, listening: 0.45, dim: 0.94 },
  listening: { speaking: 0, listening: 1, dim: 1 },
  thinking: { speaking: 0, listening: 0.6, dim: 0.96 },
  speaking: { speaking: 1, listening: 0, dim: 1 },
  ended: { speaking: 0, listening: 0, dim: 0.5 },
  error: { speaking: 0, listening: 0, dim: 0.45 }
};

function parseCloud(buffer) {
  const view = new DataView(buffer);
  const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (magic !== "SAV3") throw new Error(`tundmatu punktipilve vorming: ${magic}`);
  const count = view.getUint32(4, true);
  const scale = view.getFloat32(8, true);
  const mouth = [view.getFloat32(12, true), view.getFloat32(16, true), view.getFloat32(20, true)];
  const pivot = [0, view.getFloat32(24, true), view.getFloat32(28, true)];

  let offset = HEADER_BYTES;
  const raw = new Int16Array(buffer, offset, count * 3);
  offset += count * 6;
  const rawNormal = new Int8Array(buffer, offset, count * 3);
  offset += count * 3;
  const rgb = new Uint8Array(buffer, offset, count * 3);
  offset += count * 3;
  const rigBytes = new Uint8Array(buffer, offset, count);
  offset += count;
  const sizeBytes = new Uint8Array(buffer, offset, count);

  const position = new Float32Array(count * 3);
  const normal = new Float32Array(count * 3);
  const color = new Float32Array(count * 3);
  const rig = new Float32Array(count);
  const size = new Float32Array(count);
  const unit = scale / 32767;
  for (let i = 0; i < count; i += 1) {
    position[i * 3] = raw[i * 3] * unit;
    position[i * 3 + 1] = raw[i * 3 + 1] * unit;
    position[i * 3 + 2] = raw[i * 3 + 2] * unit;
    normal[i * 3] = rawNormal[i * 3] / 127;
    normal[i * 3 + 1] = rawNormal[i * 3 + 1] / 127;
    normal[i * 3 + 2] = rawNormal[i * 3 + 2] / 127;
    color[i * 3] = rgb[i * 3] / 255;
    color[i * 3 + 1] = rgb[i * 3 + 1] / 255;
    color[i * 3 + 2] = rgb[i * 3 + 2] / 255;
    rig[i] = rigBytes[i] / 255;
    size[i] = 0.35 + (sizeBytes[i] / 255) * 0.65;
  }
  return { count, position, normal, color, rig, size, mouth, pivot };
}

export default function VoicePointAvatar({ status = "idle", audioLevel = 0, label = "" }) {
  const hostRef = useRef(null);
  const statusRef = useRef(status);
  const energyRef = useRef(audioLevel);

  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { energyRef.current = audioLevel; }, [audioLevel]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    let renderer = null;
    let frame = null;
    let disposed = false;
    const controller = new AbortController();

    (async () => {
      let cloud;
      try {
        const response = await fetch(CLOUD_SRC, { signal: controller.signal });
        if (!response.ok) throw new Error(`punktipilve ei laetud: ${response.status}`);
        cloud = parseCloud(await response.arrayBuffer());
      } catch (error) {
        if (error?.name !== "AbortError") host.dataset.webgl = "unavailable";
        return;
      }
      if (disposed) return;

      try {
        renderer = new Renderer({
          alpha: true,
          antialias: true,
          dpr: Math.min(1.75, window.devicePixelRatio || 1)
        });
      } catch {
        host.dataset.webgl = "unavailable";
        return;
      }

      const gl = renderer.gl;
      gl.clearColor(0, 0, 0, 0);
      host.appendChild(gl.canvas);

      const fov = 28;
      const camera = new Camera(gl, { fov, near: 0.1, far: 100 });
      camera.position.set(0, 0, 5);

      const geometry = new Geometry(gl, {
        position: { size: 3, data: cloud.position },
        aNormal: { size: 3, data: cloud.normal },
        aColor: { size: 3, data: cloud.color },
        aRig: { size: 1, data: cloud.rig },
        aSize: { size: 1, data: cloud.size }
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
          uSpeaking: { value: 0 },
          uListening: { value: 0 },
          uDim: { value: STATE_VALUE.idle.dim },
          uSizeScale: { value: 900 },
          uPointer: { value: [0, 0] },
          uMouth: { value: cloud.mouth },
          uPivot: { value: cloud.pivot }
        }
      });
      // Värv on juba alfaga läbi korrutatud; nii ei kustuta kattuvad täpid
      // üksteist ära, vaid liituvad hõõguks.
      program.setBlendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      const mesh = new Mesh(gl, { mode: gl.POINTS, geometry, program });

      const reducedMotion = document.documentElement.dataset.reduceMotion === "1"
        || window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

      const pointerTarget = [0, 0];
      const pointerCurrent = [0, 0];
      const clamp = value => Math.max(-1, Math.min(1, value));
      const onPointerMove = event => {
        if (reducedMotion) return;
        const rect = host.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        // Kursorit jälgitakse kogu ekraanil, mitte ainult lõuendi kohal.
        pointerTarget[0] = clamp((event.clientX - (rect.left + rect.width / 2)) / (rect.width * 0.62));
        pointerTarget[1] = clamp((event.clientY - (rect.top + rect.height * 0.4)) / (rect.height * 0.6));
      };
      window.addEventListener("pointermove", onPointerMove, { passive: true });

      const halfFov = (fov * Math.PI) / 360;
      const resize = () => {
        const width = Math.max(1, host.clientWidth);
        const height = Math.max(1, host.clientHeight);
        renderer.setSize(width, height);
        camera.perspective({ aspect: width / height });
        // Kõrgus mahutatakse tervikuna, õlad tohivad kaadrist välja minna.
        const fitHeight = 2.34 / (2 * Math.tan(halfFov));
        const fitWidth = 1.62 / (2 * Math.tan(halfFov) * (width / height));
        camera.position.z = Math.max(fitHeight, fitWidth);
        // gl_PointSize on kaadripuhvri pikslites, seega kannab ta dpr-i.
        program.uniforms.uSizeScale.value = (height * renderer.dpr) / (2 * Math.tan(halfFov)) * 0.0042;
      };
      const observer = new ResizeObserver(resize);
      observer.observe(host);
      resize();

      const startedAt = performance.now();
      const render = now => {
        const time = (now - startedAt) / 1000;
        const state = STATE_VALUE[statusRef.current] || STATE_VALUE.idle;
        pointerCurrent[0] += (pointerTarget[0] - pointerCurrent[0]) * 0.055;
        pointerCurrent[1] += (pointerTarget[1] - pointerCurrent[1]) * 0.055;

        // Kõne ajal on mikrofonimõõdik vaikne (räägib AI), seega sünteesime
        // amplituudi ise — muidu seisaks suu liikumatult.
        const synthetic = state.speaking
          ? 0.45 + Math.sin(time * 6.9) * 0.22 + Math.sin(time * 11.7 + 1.3) * 0.14
          : 0;
        const target = Math.max(energyRef.current, synthetic);

        program.uniforms.uTime.value = reducedMotion ? 0 : time;
        program.uniforms.uEnergy.value += (target - program.uniforms.uEnergy.value) * 0.16;
        program.uniforms.uSpeaking.value += (state.speaking - program.uniforms.uSpeaking.value) * 0.1;
        program.uniforms.uListening.value += (state.listening - program.uniforms.uListening.value) * 0.06;
        program.uniforms.uDim.value += (state.dim - program.uniforms.uDim.value) * 0.05;
        program.uniforms.uPointer.value = pointerCurrent;

        renderer.render({ scene: mesh, camera });
        frame = requestAnimationFrame(render);
      };
      frame = requestAnimationFrame(render);

      host.__voiceCleanup = () => {
        observer.disconnect();
        window.removeEventListener("pointermove", onPointerMove);
        geometry.remove?.();
        program.remove?.();
        try { host.removeChild(gl.canvas); } catch {}
      };
    })();

    return () => {
      disposed = true;
      controller.abort();
      if (frame) cancelAnimationFrame(frame);
      host.__voiceCleanup?.();
      host.__voiceCleanup = null;
      renderer = null;
    };
  }, []);

  return (
    <div ref={hostRef} className="voice-avatar" data-state={status} role="img" aria-label={label}>
      <div className="voice-avatar__fallback" aria-hidden="true" />
    </div>
  );
}
