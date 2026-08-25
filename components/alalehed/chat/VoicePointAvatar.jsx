"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
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
 * Nägu jääb tahtlikult tühjaks: eraldi silmi, nina, suud ega otsmikuefekti
 * ei joonistata.
 */

const CLOUD_SRC = "/voice/avatar-cloud.bin";
const HEADER_BYTES = 32;
let cachedCloud = null;
let cloudRequest = null;

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
  uniform vec3 uPivot;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vRim;

  mat3 headRotation(float yaw, float pitch) {
    float cy = cos(yaw), sy = sin(yaw), cp = cos(pitch), sp = sin(pitch);
    mat3 rotateY = mat3(cy, 0.0, -sy, 0.0, 1.0, 0.0, sy, 0.0, cy);
    mat3 rotateX = mat3(1.0, 0.0, 0.0, 0.0, cp, sp, 0.0, -sp, cp);
    return rotateY * rotateX;
  }

  void main() {
    vec3 p = position;

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
    gl_PointSize = clamp(aSize * uSizeScale * 2.4 / max(0.2, -view.z), 1.4, 14.0);

    // Sooja ja külma kanali eristus tuleb ALLIKAVÄRVIST, mitte maskist:
    // kuldsed energiajooned on pildis juba olemas.
    float warm = clamp((aColor.r - aColor.b) * 3.2, 0.0, 1.0);
    float flow = 0.5 + 0.5 * sin(p.y * 9.0 - uTime * 2.6);
    float warmGain = 1.0 + warm * uSpeaking * (0.3 + uEnergy * 0.85) * (0.4 + 0.6 * flow);
    // Kuulamine: kogu kuju kumab kasutaja hääle tugevusega, mitte ainult
    // külmad täpid — omanik tahtis just seda ("tervenisti veidi kumada").
    float coolGain = 1.0 + uListening * uEnergy * 0.5
      * (0.75 + 0.25 * sin(p.y * 7.0 + uTime * 1.2));

    // Võlts-oklusioon. Sügavustesti ei ole (täpid on läbipaistvad ja
    // sorteerimata), seega tuleb tagakülg kustutada pinnasuuna järgi —
    // muidu paistab kaugem kõrv läbi pea ja pöördel loeb pea lamedana.
    vec3 viewNormal = normalize(mat3(modelViewMatrix) * n);
    float facing = viewNormal.z;
    float front = smoothstep(-0.45, 0.3, facing);
    // Terav aste hoiab valge servavalguse TÄPSELT siluetil. Lauge aste (3.2)
    // valgustas poolt keha ja pleegitas sinise ära.
    float rim = pow(1.0 - abs(facing), 5.0);

    // Kõrva-vööde: KOLJU servavalgus tõmmatakse maha. Päris peas katab kõrv
    // selle joone ära, aga sügavustesti ei ole ja ta jooksis kõrva EEST läbi
    // (omanik 22.08). Piirid on mudeliruumis, seega kehtivad igal pöördel;
    // kõrv ise jääb 0.40 taha ja säilitab oma serva.
    float earBand = smoothstep(0.28, 0.34, position.y)
      * (1.0 - smoothstep(0.58, 0.65, position.y));
    float earSide = smoothstep(0.22, 0.30, abs(position.x))
      * (1.0 - smoothstep(0.40, 0.46, abs(position.x)));
    rim *= 1.0 - 0.88 * earBand * earSide;

    // Suunavalgus. Ilma temata küllastub front-tegur kohe ühte ja kogu esikülg on
    // ühtlaselt hele — siis ei paista silmakoobas ega ninaselg otsevaates
    // kuidagi välja ja nägu loeb pallina (omanik 22.08 „nägu on eest ikka
    // liiga pall"). Mõjutab AINULT heledust, mitte tooni.
    vec3 lightDir = normalize(vec3(-0.34, 0.42, 0.84));
    float diffuse = 0.48 + 0.52 * max(0.0, dot(viewNormal, lightDir));

    // Lähtepildi täpid on üksikuna tumedad — pildil tuleb heledus täppide
    // kattumisest ja sisseküpsetatud hõõgusest, mida pilves ei ole. Võimendus
    // toob need tagasi; küllastuse laseb fragment üle ääre minna.
    // Värv EI tohi ületada ühte: fragment väljastab color*alpha ja
    // premultiplied over kuhjab kattuvatel täppidel üle piiri, mille peale
    // kanalid lõikuvad ja sinine pleegib valgeks (mõõdetud: sinisus 38 -> 8).
    vColor = clamp(aColor * 1.15 * warmGain * coolGain, 0.0, 1.0);
    vAlpha = (0.72 + 0.28 * aSize) * (mix(0.05, 1.0, front) + rim * 0.6) * diffuse;
    vRim = rim;
  }
`;

const FRAGMENT_SHADER = `
  precision highp float;

  uniform float uDim;

  varying vec3 vColor;
  varying float vAlpha;
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

    // Lai pehme halo asendab lähtepildi sisseküpsetatud hõõgust.
    float alpha = vAlpha * (core * 0.8 + halo * 0.72) * uDim;
    gl_FragColor = vec4(color * alpha, alpha);
  }
`;

/* Olek EI muuda kuju heledust (omanik 22.08: „ta ei tohiks heledust muuta").
   Varem jäi kuju pärast Alusta/Lõpeta tumedaks, sest ended/error tõmbasid
   dim-i alla. Ainus, mis heledust liigutab, on hääl: tema kõne süütab näo ja
   kuulamisel kumab kogu kuju kasutaja hääle tugevusega kaasa. */
const STATE_VALUE = {
  idle: { speaking: 0, listening: 0 },
  connecting: { speaking: 0, listening: 0.45 },
  listening: { speaking: 0, listening: 1 },
  thinking: { speaking: 0, listening: 0.6 },
  speaking: { speaking: 1, listening: 0 },
  ended: { speaking: 0, listening: 0 },
  error: { speaking: 0, listening: 0 }
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

function loadCloud() {
  if (cachedCloud) return Promise.resolve(cachedCloud);
  if (!cloudRequest) {
    cloudRequest = fetch(CLOUD_SRC)
      .then(response => {
        if (!response.ok) throw new Error(`punktipilve ei laetud: ${response.status}`);
        return response.arrayBuffer();
      })
      .then(buffer => {
        cachedCloud = parseCloud(buffer);
        return cachedCloud;
      })
      .catch(error => {
        cloudRequest = null;
        throw error;
      });
  }
  return cloudRequest;
}

/* Taustarežiimis on sama kuju tavavestluse taga: tuhm, kliki mitte püüdev.
   Omanik nägi teda veaolekus tumedana ja soovis just seda (22.08). */
const BACKDROP_DIM = 0.34;

export default function VoicePointAvatar({
  status = "idle",
  audioLevel = 0,
  label = "",
  backdrop = false
}) {
  const hostRef = useRef(null);
  const statusRef = useRef(status);
  const energyRef = useRef(audioLevel);
  const backdropRef = useRef(backdrop);

  useEffect(() => { backdropRef.current = backdrop; }, [backdrop]);
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { energyRef.current = audioLevel; }, [audioLevel]);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    let renderer = null;
    let frame = null;
    let disposed = false;

    (async () => {
      let cloud;
      try {
        // Tavavaate avatar on faili juba laadinud. Häälvaatesse minnes
        // kasutame sama parsitud pilve kohe, et vahetusel ei tekiks tühja
        // kaadrit ega eraldi laadimisrõngast.
        cloud = cachedCloud || await loadCloud();
      } catch {
        host.dataset.webgl = "unavailable";
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
          uDim: { value: 1 },
          uSizeScale: { value: 900 },
          uPointer: { value: [0, 0] },
          uPivot: { value: cloud.pivot }
        }
      });
      // Värv on juba alfaga läbi korrutatud; nii ei kustuta kattuvad täpid
      // üksteist ära, vaid liituvad hõõguks.
      program.setBlendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      const mesh = new Mesh(gl, { mode: gl.POINTS, geometry, program });
      // Pilv on tsentreeritud lähtepildi keskele; pärast alumist lõiget on
      // figuuri kese 0.085 võrra ülalpool, see toob ta kaadri keskele tagasi.
      mesh.position.y = -0.085;

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
        // 2.65 vs figuuri 2.07 jätab ~11% veerise üles ja alla: pealagi ei
        // tohi ekraani ülaserva puutuda (omanik 22.08).
        const fitHeight = 2.65 / (2 * Math.tan(halfFov));
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
        const targetDim = backdropRef.current ? BACKDROP_DIM : 1;
        program.uniforms.uDim.value += (targetDim - program.uniforms.uDim.value) * 0.05;
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
      if (frame) cancelAnimationFrame(frame);
      host.__voiceCleanup?.();
      host.__voiceCleanup = null;
      renderer = null;
    };
  }, []);

  return (
    <div
      ref={hostRef}
      className="voice-avatar"
      data-state={status}
      data-backdrop={backdrop ? "true" : undefined}
      role={backdrop ? "presentation" : "img"}
      aria-hidden={backdrop ? "true" : undefined}
      aria-label={backdrop ? undefined : label}
    >
      <div className="voice-avatar__fallback" aria-hidden="true" />
    </div>
  );
}
