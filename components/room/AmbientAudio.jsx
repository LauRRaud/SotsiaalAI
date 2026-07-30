"use client";

/**
 * AmbientAudio — taustamuusika mängija. Viis rahulikku instrumentaal-lugu
 * (public/audio/, päris MP3-failid) + vaikus: a–c ambient (tellija valis
 * 06.07 Pixabaylt), d–e klassika (30.07, avaliku omandi / CC0 salvestised).
 * Valik püsib localStorage's ("sotsiaalai:ambient" = "off" | "a".."e",
 * vaikimisi "a") ja rakendub kohe sündmusega "sotsiaalai:ambient-change".
 *
 * Fail mängib PUHTALT (ilma madalpääsfiltri ja kajata, ~FILE_LEVELS tasemel).
 * Kui mõne mode'i fail puudub või ei lae, langeb tagavaraks WebAudio-süntees
 * (lounge/padjad) — nii ei jää platvorm kunagi tummaks. Süntees EI mängi enam
 * "sillana" faili laadimise ajal (tellija ei soovi sünteesi-klaverit) — kuni
 * fail laeb, on lühike vaikus.
 *
 * Käivitus (tellija 07.07: "avaleht on vale koht"): kui <html> kannab
 * atribuuti data-ambient-hold (loor ekraanil), siis žestid EI käivita heli —
 * RoomStage vabastab hoiu ja saadab "sotsiaalai:ambient-start" alles
 * uksekaadris. Loorita lehtedel algab endiselt esimesest žestist
 * (autoplay-poliitika vajab žesti). Lülitid: kõnd (sisse/välja) ja Keel ja
 * ligipääsetavus modal (Vaikus / Meloodia I–V).
 */

import { useEffect } from "react";

export const AMBIENT_STORAGE_KEY = "sotsiaalai:ambient";
export const AMBIENT_EVENT = "sotsiaalai:ambient-change";
export const AMBIENT_START_EVENT = "sotsiaalai:ambient-start";

export const AMBIENT_MODES = ["a", "b", "c", "d", "e"];

/* Mode → päris helifaili baasnimi (public/audio/<base>.mp3). Järjekord =
   menüü Meloodia I–V. a–c on Pixabay originaalnimed, d–e kannavad nimes
   esitajat ja litsentsi (klassika puhul on teos avalik omand, aga SALVESTIS
   on eraldi õigus — jälgitavus peab failinimest välja lugema);
   public/audio/LOE-MIND.md hoiab täiskaardistust. */
const FILE_SRC = {
  a: "atlasaudio-ambient-cinematic-510518",
  b: "atlasaudio-cinematic-softness-511863",
  c: "the_mountain-delicate-cinematic-512628",
  d: "satie-gymnopedie-1-alciatore-pd",
  e: "bach-wtc1-prelude-bwv846-ishizaka-cc0",
};

export function getAmbientMode() {
  if (typeof window === "undefined") return "a";
  try {
    const v = window.localStorage.getItem(AMBIENT_STORAGE_KEY);
    return v === "off" || AMBIENT_MODES.includes(v) ? v : "a";
  } catch {
    return "a";
  }
}

export function setAmbientMode(mode) {
  try {
    window.localStorage.setItem(AMBIENT_STORAGE_KEY, mode);
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent(AMBIENT_EVENT, { detail: { mode } }));
  } catch {}
}

/* Tagavara-süntees — mängib AINULT siis, kui mode'i fail ei õnnestu laadida.
   a = vaikne lounge-klaver; b/c = pehmed detune-siinuspadjad. */
const MELODIES = {
  a: {
    type: "lounge",
    stepMs: 3800,
    filterHz: 1900,
    level: 0.07,
    chords: [
      [261.63, 329.63, 392.0, 587.33], // Cadd9
      [349.23, 392.0, 440.0, 523.25], // Fadd9
      [392.0, 440.0, 493.88, 587.33], // Gadd9
      [329.63, 392.0, 493.88, 523.25], // Cmaj7 (kõrge)
    ],
    answers: [659.25, 783.99, 880.0, 587.33],
  },
  b: {
    type: "pads",
    chords: [
      [146.83, 220.0, 293.66, 329.63, 369.99], // D(add9)
      [196.0, 246.94, 293.66, 369.99, 440.0], // G△9
      [246.94, 293.66, 329.63, 369.99, 440.0], // Bm7(add11)
      [220.0, 277.18, 329.63, 440.0, 493.88], // A(add9)
    ],
    wave: "sine",
    stepMs: 12000,
    filterHz: 750,
    level: 0.05,
  },
  c: {
    type: "pads",
    chords: [
      [130.81, 196.0, 261.63, 329.63, 392.0], // C
      [174.61, 261.63, 349.23, 440.0, 523.25], // F
      [196.0, 293.66, 392.0, 493.88, 587.33], // G
      [164.81, 246.94, 329.63, 415.3, 493.88], // E
    ],
    wave: "sine",
    stepMs: 12000,
    filterHz: 700,
    level: 0.05,
  },
  /* d/e katavad klassikalised lood. Süntees EI jäljenda Satiet ega Bachi —
     ta hoiab ainult lubadust, et faili puudumisel ei jää platvorm tummaks,
     ja püsib loo helistikus (d = G-duur, e = C-duur). */
  d: {
    type: "pads",
    chords: [
      [196.0, 246.94, 293.66, 369.99], // G△7
      [146.83, 185.0, 220.0, 277.18], // D△7
      [164.81, 196.0, 246.94, 293.66], // Em7
      [220.0, 293.66, 329.63, 440.0], // Asus4
    ],
    wave: "sine",
    stepMs: 12000,
    filterHz: 720,
    level: 0.05,
  },
  e: {
    type: "pads",
    chords: [
      [130.81, 164.81, 196.0, 261.63], // C
      [220.0, 261.63, 329.63, 392.0], // Am7
      [174.61, 220.0, 261.63, 329.63], // F△7
      [196.0, 246.94, 293.66, 392.0], // G
    ],
    wave: "sine",
    stepMs: 12000,
    filterHz: 700,
    level: 0.05,
  },
};

export default function AmbientAudio() {
  useEffect(() => {
    let ctx = null;
    let master = null;
    let filter = null;
    let lfoGain = null;
    let timer = 0;
    let phraseTimers = [];
    let step = 0;
    let mode = getAmbientMode();
    let started = false;
    let liveVoices = [];

    /* Failimängija — KAKS <audio> elementi crossfade-loop'i jaoks:
       korduskohas kattuvad loo lõpp ja algus (üht elementi ei saa
       iseendaga risti hääldada). Iga element: MediaElementSource →
       crossfade-gain → fileGain (üldtase) → destination. playGen =
       põlvkonna-žetoon, mis tühistab vananenud edasilükatud pausid. */
    let fileEls = null; // [Audio, Audio]
    let fileSrcNodes = null; // [MediaElementSource, MediaElementSource]
    let fileFades = null; // [GainNode, GainNode] — crossfade-mähised 0..1
    let fileGain = null; // üldtase (FILE_LEVELS)
    let fileMode = null;
    let fileActive = 0; // kumb element on esiplaanil
    let xfadeTimer = 0; // seire-intervall
    let xfadeActive = false; // crossfade käib parajasti
    let playGen = 0; // laadimise põlvkond (võidujooksude vastu)
    /* d/e on klaverisalvestised, mitte toodetud ambient — keskmine valjus on
       märgatavalt madalam kui a–c-l, seepärast kõrgem võimendus. Täpne
       väärtus vajab kõrvaga ülekuulamist (ffmpeg/LUFS-mõõtu siin ei ole). */
    const FILE_LEVELS = { a: 0.32, b: 0.3, c: 0.3, d: 0.4, e: 0.4 };
    const XFADE = 4; // crossfade'i pikkus sekundites
    /* Võrdvõimsuse (equal-power) kõverad — hoiavad summaarse valjuse
       ristihäälduse ajal ühtlasena (lineaarne teeks keskele mõõna). */
    const CURVE_N = 48;
    const fadeOutCurve = new Float32Array(CURVE_N);
    const fadeInCurve = new Float32Array(CURVE_N);
    for (let i = 0; i < CURVE_N; i++) {
      const x = i / (CURVE_N - 1);
      fadeOutCurve[i] = Math.cos((x * Math.PI) / 2);
      fadeInCurve[i] = Math.sin((x * Math.PI) / 2);
    }

    const ensureFileGraph = () => {
      if (!ctx || fileEls) return;
      fileGain = ctx.createGain();
      fileGain.connect(ctx.destination);
      fileEls = [];
      fileSrcNodes = [];
      fileFades = [];
      for (let i = 0; i < 2; i++) {
        const el = new Audio();
        el.preload = "auto";
        el.loop = false; // loop'i haldame ise crossfade'iga
        const fade = ctx.createGain();
        fade.gain.value = 0.0001;
        let node = null;
        try {
          node = ctx.createMediaElementSource(el);
          node.connect(fade).connect(fileGain);
        } catch {}
        fileEls.push(el);
        fileSrcNodes.push(node);
        fileFades.push(fade);
      }
    };

    /* Peata failid pehme hääbumisega (nt "Vaikus"); playGen++ tühistab
       kõik edasilükatud pausid, et hiljem käivitatud lugu ei katkeks. */
    const stopFile = () => {
      const gen = ++playGen;
      window.clearInterval(xfadeTimer);
      xfadeActive = false;
      fileMode = null;
      if (!fileEls) return;
      if (ctx) {
        const now = ctx.currentTime;
        for (const g of fileFades) {
          try {
            g.gain.cancelScheduledValues(now);
            g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), now);
            g.gain.linearRampToValueAtTime(0.0001, now + 0.4);
          } catch {}
        }
        const els = fileEls;
        window.setTimeout(() => {
          if (gen !== playGen) return;
          for (const el of els) {
            try {
              el.pause();
            } catch {}
          }
        }, 460);
      } else {
        for (const el of fileEls) {
          try {
            el.pause();
          } catch {}
        }
      }
    };

    const clearPhrase = () => {
      for (const id of phraseTimers) window.clearTimeout(id);
      phraseTimers = [];
    };

    const stopVoices = (at, release = 2.5) => {
      for (const v of liveVoices) {
        try {
          v.gain.gain.cancelScheduledValues(at);
          v.gain.gain.setValueAtTime(Math.max(v.gain.gain.value, 0.0001), at);
          v.gain.gain.linearRampToValueAtTime(0.0001, at + release);
          v.osc.stop(at + release + 0.2);
        } catch {}
      }
      liveVoices = [];
    };

    /* Rhodes-laadne klaverihääl: siinus-põhitoon + kiirelt vaibuvad
       ülemtoonid (2f, 4f). Kasutusel ainult tagavara-sünteesis. */
    const epiano = (freq, at, gain, dur = 2.6) => {
      const parts = [
        [1, 1, 1],
        [2, 0.22, 0.5],
        [4, 0.07, 0.28],
      ];
      for (const [mul, amp, durMul] of parts) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq * mul;
        const d = dur * durMul;
        g.gain.setValueAtTime(0.0001, at);
        g.gain.linearRampToValueAtTime(gain * amp, at + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, at + d);
        osc.connect(g).connect(filter);
        osc.start(at);
        osc.stop(at + d + 0.05);
      }
    };

    const playChord = () => {
      if (!ctx || mode === "off") return;
      const m = MELODIES[mode];
      if (!m || m.type !== "pads") return;
      const now = ctx.currentTime;
      stopVoices(now, 3.2);
      const notes = m.chords[step % m.chords.length];
      step += 1;
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = m.wave;
        osc.frequency.value = freq;
        osc.detune.value = i % 2 ? 3 : -3; // õrn kooriefekt
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(1 / notes.length, now + 2.4);
        osc.connect(gain).connect(filter);
        osc.start(now);
        liveVoices.push({ osc, gain });
      });
      timer = window.setTimeout(playChord, m.stepMs);
    };

    const tone = (freq, at, dur, gain, wave) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = wave;
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(gain, at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      osc.connect(g).connect(filter);
      osc.start(at);
      osc.stop(at + dur + 0.05);
    };

    const playLounge = () => {
      if (!ctx || mode === "off") return;
      const m = MELODIES[mode];
      if (!m || m.type !== "lounge") return;
      const now = ctx.currentTime + 0.03;
      const chord = m.chords[step % m.chords.length];
      step += 1;
      const rest = step % 4 === 0;
      const jit = () => Math.random() * 0.12 - 0.06;
      tone(chord[0] / 2, now + Math.abs(jit()), 2.6, 0.3, "sine");
      if (!rest) {
        chord.forEach((f, i) => {
          epiano(f, now + 0.055 * i + Math.abs(jit()) * 0.4, 0.5 - i * 0.06);
        });
        if (m.answers && Math.random() < 0.45) {
          const t2 = now + m.stepMs / 2000 + Math.abs(jit());
          epiano(m.answers[Math.floor(Math.random() * m.answers.length)], t2, 0.22, 1.6);
          if (Math.random() < 0.5) {
            epiano(m.answers[Math.floor(Math.random() * m.answers.length)], t2 + 0.42, 0.18, 1.5);
          }
        }
      }
      timer = window.setTimeout(playLounge, m.stepMs + (Math.random() * 260 - 130));
    };

    /* Käivita tagavara-süntees praegusele mode'ile (ainult faili-vea korral) */
    const startSynth = () => {
      if (!ctx || mode === "off") return;
      const m = MELODIES[mode];
      if (!m) return;
      window.clearTimeout(timer);
      filter.frequency.setTargetAtTime(m.filterHz, ctx.currentTime, 0.5);
      master.gain.setTargetAtTime(m.level, ctx.currentTime, 0.8);
      lfoGain?.gain.setTargetAtTime(m.level * 0.13, ctx.currentTime, 0.5);
      step = 0;
      if (m.type === "lounge") {
        stopVoices(ctx.currentTime, 0.7);
        playLounge();
      } else {
        playChord();
      }
    };

    /* Seire: kui esiplaani element jõuab XFADE sekundit enne lõppu,
       käivita teine element ja crossfade — korduskoht on sujuv, ilma
       krõpsu/pausita. Elemendid vahelduvad ping-pong'ina. */
    const startXfadeMonitor = (gen) => {
      window.clearInterval(xfadeTimer);
      xfadeTimer = window.setInterval(() => {
        if (gen !== playGen || !ctx || fileMode == null || xfadeActive) return;
        const cur = fileEls[fileActive];
        const dur = cur.duration;
        if (!dur || Number.isNaN(dur) || dur <= XFADE + 3) return;
        if (cur.currentTime < dur - XFADE) return;
        xfadeActive = true;
        const oldIdx = fileActive;
        const nextIdx = fileActive ^ 1;
        const nxt = fileEls[nextIdx];
        const now = ctx.currentTime;
        try {
          nxt.currentTime = 0;
        } catch {}
        nxt.play().catch(() => {});
        try {
          fileFades[oldIdx].gain.cancelScheduledValues(now);
          fileFades[oldIdx].gain.setValueCurveAtTime(fadeOutCurve, now, XFADE);
        } catch {}
        try {
          fileFades[nextIdx].gain.cancelScheduledValues(now);
          fileFades[nextIdx].gain.setValueCurveAtTime(fadeInCurve, now, XFADE);
        } catch {}
        fileActive = nextIdx;
        window.setTimeout(() => {
          if (gen !== playGen) return;
          try {
            fileEls[oldIdx].pause();
          } catch {}
          xfadeActive = false;
        }, (XFADE + 0.25) * 1000);
      }, 200);
    };

    /* Lae ja mängi mode'i lugu (crossfade-loop). Mõlemad elemendid
       saavad sama src'i (kumbki mängib korduskohas teise otsa).
       Õnnestumisel süntees vaikib; vea korral (fail puudub) süntees
       varuks. */
    const loadTrack = (m) => {
      const base = FILE_SRC[m];
      if (!base) {
        startSynth();
        return;
      }
      ensureFileGraph();
      if (!fileEls || !ctx) {
        startSynth();
        return;
      }
      const gen = ++playGen;
      window.clearInterval(xfadeTimer);
      xfadeActive = false;
      const now = ctx.currentTime;
      for (const g of fileFades) {
        try {
          g.gain.cancelScheduledValues(now);
          g.gain.setValueAtTime(0.0001, now);
        } catch {}
      }
      for (const el of fileEls) {
        try {
          el.pause();
        } catch {}
      }
      fileGain.gain.value = FILE_LEVELS[m] ?? 0.3;
      fileActive = 0;
      const url = `/audio/${base}.mp3`;
      const a = fileEls[0];
      const b = fileEls[1];
      a.src = url;
      b.src = url;
      a.oncanplay = () => {
        if (gen !== playGen || mode !== m || !ctx) return;
        window.clearTimeout(timer);
        stopVoices(ctx.currentTime, 0.6); // vaigista tagavara-süntees
        fileMode = m;
        const t = ctx.currentTime;
        try {
          fileFades[0].gain.cancelScheduledValues(t);
          fileFades[0].gain.setValueAtTime(0.0001, t);
          fileFades[0].gain.linearRampToValueAtTime(1, t + 0.8); // pehme algus
          fileFades[1].gain.cancelScheduledValues(t);
          fileFades[1].gain.setValueAtTime(0.0001, t);
        } catch {}
        try {
          a.currentTime = 0;
        } catch {}
        a.play().catch(() => {});
        a.oncanplay = null; // ainult esmakäivitus; crossfade'i kerimised ei taaskäivita
        startXfadeMonitor(gen);
      };
      a.onerror = () => {
        if (gen === playGen && mode === m) {
          fileMode = null;
          startSynth(); // faili pole → süntees varuks
        }
      };
      try {
        a.load();
        b.load();
      } catch {}
    };

    const applyMode = () => {
      if (!ctx) return;
      window.clearTimeout(timer);
      clearPhrase();
      if (mode === "off") {
        stopFile();
        stopVoices(ctx.currentTime, 1.2);
        lfoGain?.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
        return;
      }
      if (fileMode === mode) return; // juba mängib seda lugu (crossfade-loop käib)
      stopVoices(ctx.currentTime, 0.5); // vana pad kohe maha
      loadTrack(mode); // fail juhib; süntees ainult vea korral
    };

    const start = () => {
      if (started && ctx) return;
      if (mode === "off") {
        started = true; // konteksti ei looda enne, kui heli valitakse
        return;
      }
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch {
        return;
      }
      started = true;
      master = ctx.createGain();
      master.gain.value = 0.0001;
      filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 850;
      filter.Q.value = 0.4;
      /* RUUMIKAJA tagavara-sünteesile (kuiv süntees kõlab steriilselt):
         filter → kuiv 0.66 → master; filter → convolver → märg 0.55 →
         master. IR = 2.6s eksponentsiaalselt vaibuv müra. Päris fail EI
         käi siit läbi — see mängib puhtalt fileGain → destination. */
      const irLen = Math.floor(ctx.sampleRate * 2.6);
      const ir = ctx.createBuffer(2, irLen, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch);
        for (let i = 0; i < irLen; i++) {
          d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 2.4);
        }
      }
      const convolver = ctx.createConvolver();
      convolver.buffer = ir;
      const dry = ctx.createGain();
      dry.gain.value = 0.66;
      const wet = ctx.createGain();
      wet.gain.value = 0.55;
      filter.connect(dry).connect(master);
      filter.connect(convolver).connect(wet).connect(master);
      master.connect(ctx.destination);
      /* Rhodes-tremolo: aeglane värelus master-tasemel */
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 4.7;
      lfoGain = ctx.createGain();
      lfoGain.gain.value = 0;
      lfo.connect(lfoGain).connect(master.gain);
      lfo.start();
      ctx.resume?.().catch(() => {});
      applyMode();
    };

    /* Loor ekraanil = heli ootel; RoomStage saadab stardisignaali uksel */
    const held = () =>
      document.documentElement.hasAttribute("data-ambient-hold");

    const onGesture = () => {
      if (held()) return;
      start();
    };
    const onStart = () => start();
    const onChange = (e) => {
      mode = e?.detail?.mode || getAmbientMode();
      if (!ctx) {
        // Valik tuli kasutaja žestist — võib kohe käivitada (kui pole hoius)
        if (mode === "off" || held()) return;
        started = false;
        start();
        return;
      }
      applyMode();
    };

    window.addEventListener("pointerdown", onGesture);
    window.addEventListener("keydown", onGesture);
    window.addEventListener(AMBIENT_START_EVENT, onStart);
    window.addEventListener(AMBIENT_EVENT, onChange);
    return () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
      window.removeEventListener(AMBIENT_START_EVENT, onStart);
      window.removeEventListener(AMBIENT_EVENT, onChange);
      window.clearTimeout(timer);
      window.clearInterval(xfadeTimer);
      clearPhrase();
      playGen++; // tühista pooleliolevad edasilükatud pausid
      if (fileEls) {
        for (const el of fileEls) {
          try {
            el.oncanplay = null;
            el.onerror = null;
            el.pause();
          } catch {}
        }
      }
      try {
        ctx?.close();
      } catch {}
    };
  }, []);

  return null;
}
