import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createFistTracker,
  createPinchTracker,
  createSwipeTracker,
  handShape,
  palmPoint,
  pinchRatio,
} from "../lib/handGestures.js";

/* Päris käed: MediaPipe'i näidisfotodelt tuvastatud punktid (vt _source). */
const photos = JSON.parse(readFileSync(new URL("./hand-landmarks.fixture.json", import.meta.url), "utf8"));
const photoHands = (name) =>
  photos[name].hands.map((points) => ({
    aspect: photos[name].aspect,
    landmarks: points.map(([x, y, z]) => ({ x, y, z })),
  }));

/* 21 punkti: ranne (0) ja keskmise sõrme alus (9) annavad peopesa pikkuse,
   pöidla- (4) ja nimetissõrme (8) ots näpistuse. */
function hand({ gap = 0.2, x = 0.5, y = 0.5 } = {}) {
  const points = Array.from({ length: 21 }, () => ({ x, y, z: 0 }));
  points[0] = { x, y: y + 0.2, z: 0 };
  points[9] = { x, y, z: 0 };
  points[4] = { x: x - gap / 2, y: y - 0.1, z: 0 };
  points[8] = { x: x + gap / 2, y: y - 0.1, z: 0 };
  return points;
}

const FRAME_MS = 33;

/* Käe liikumine kaadrist kaadrisse: `path` on [x, y] punktid. */
function motion(path, { start = 0, pinched = false } = {}) {
  return path.map(([x, y], i) => ({ t: start + i * FRAME_MS, hand: { x, y }, pinched }));
}

const still = (x, y, frames) => Array.from({ length: frames }, () => [x, y]);
const line = (from, to, frames) =>
  Array.from({ length: frames }, (_, i) => [
    from[0] + ((to[0] - from[0]) * (i + 1)) / frames,
    from[1] + ((to[1] - from[1]) * (i + 1)) / frames,
  ]);

function swipes(frames, tracker = createSwipeTracker()) {
  return frames.flatMap((f) => tracker.update(f));
}

test("pinchRatio does not depend on how far the hand is from the camera", () => {
  const near = pinchRatio(hand({ gap: 0.2 }), 1);
  const far = pinchRatio(
    hand({ gap: 0.1 }).map((p, i) => (i === 0 ? { ...p, y: 0.6 } : p)),
    1
  );
  assert.ok(Math.abs(near - 1) < 1e-9);
  assert.ok(Math.abs(far - 1) < 1e-9);
  assert.ok(pinchRatio(hand({ gap: 0.02 }), 1) < 0.3);
});

test("a real fist is a fist and never a pinch, although its fingertips touch", () => {
  const [{ landmarks, aspect }] = photoHands("fist");
  assert.ok(pinchRatio(landmarks, aspect) < 0.3, "raw pinch measure alone would call it a pinch");
  const shape = handShape(landmarks, aspect);
  assert.equal(shape.fist, true);
  assert.equal(shape.ratio, Number.POSITIVE_INFINITY);
});

test("a looser fist than the sample photo still counts, a pinch with curled fingers does not", () => {
  const [{ landmarks, aspect }] = photoHands("fist");
  const wrist = landmarks[0];
  // Loosen the fist: each fingertip ~25 % further from the wrist (middle, ring, pinky ≈ 1.05)
  const loose = landmarks.map((p, i) =>
    [12, 16, 20].includes(i) ? { x: wrist.x + (p.x - wrist.x) * 1.25, y: wrist.y + (p.y - wrist.y) * 1.25, z: p.z * 1.25 } : p
  );
  assert.equal(handShape(loose, aspect).fist, true);
  // Same hand, but the index reaches out to meet the thumb in front of the palm: a pinch, never a fist
  const [thumbTip, indexBase] = [landmarks[4], landmarks[5]];
  const reach = { x: indexBase.x + (indexBase.x - wrist.x) * 0.5, y: indexBase.y + (indexBase.y - wrist.y) * 0.5, z: 0 };
  const pinching = loose.map((p, i) => (i === 8 || i === 4 ? { ...reach } : i === 3 ? { x: (thumbTip.x + reach.x) / 2, y: (thumbTip.y + reach.y) / 2, z: 0 } : p));
  const shape = handShape(pinching, aspect);
  assert.equal(shape.fist, false);
  assert.ok(shape.ratio < 0.3, `pinch still reads as a pinch (ratio ${shape.ratio})`);
});

test("the gesture model decides the fist; measurements only fill in when it has no answer", () => {
  const [{ landmarks, aspect }] = photoHands("victory");
  // Geometry says V-sign, but the model sees a fist (e.g. a loose fist at an angle): fist
  const byModel = handShape(landmarks, aspect, { categoryName: "Closed_Fist", score: 0.62 });
  assert.equal(byModel.fist, true);
  assert.equal(byModel.ratio, Number.POSITIVE_INFINITY, "a fist is never a pinch");
  // A weak Closed_Fist guess does not override the measurements
  assert.equal(handShape(landmarks, aspect, { categoryName: "Closed_Fist", score: 0.3 }).fist, false);

  const [fist] = photoHands("fist");
  // The model is sure it is another gesture: not a fist, whatever the measurements say
  assert.equal(handShape(fist.landmarks, fist.aspect, { categoryName: "Thumb_Up", score: 0.8 }).fist, false);
  // "None" or no model answer: the measurements decide
  assert.equal(handShape(fist.landmarks, fist.aspect, { categoryName: "None", score: 0.9 }).fist, true);
  assert.equal(handShape(fist.landmarks, fist.aspect, null).fist, true);
});

test("a pinch is thumb and index meeting with the other fingers curled, never an open hand", () => {
  // Owner 26.09: "a pinch is two extended fingers coming together, the rest of the hand a fist"
  const [pointing] = photoHands("pointing_up"); // index out, middle/ring/pinky curled
  const meet = (points) => points.map((p, i) => (i === 4 ? { ...points[8] } : p));
  const pinch = handShape(meet(pointing.landmarks), pointing.aspect);
  assert.ok(pinch.ratio < 0.3, `pinch pose reads as a pinch (ratio ${pinch.ratio})`);
  assert.equal(pinch.fist, false);
  // Open hand with thumb on the index tip (OK sign, or fingers brushing while waving): not a pinch
  for (const { landmarks, aspect } of photoHands("woman_hands")) {
    assert.equal(handShape(meet(landmarks), aspect).ratio, Number.POSITIVE_INFINITY);
  }
});

test("a fist-like pinch pose is a pinch when short and a fist when held", () => {
  const run = (frames) => {
    const fist = createFistTracker();
    const pinch = createPinchTracker();
    let taps = 0;
    let backs = 0;
    let t = 0;
    const step = (hand) => {
      const closed = fist.update({ t, hand });
      backs += closed.back ? 1 : 0;
      taps += pinch.update({ t, hand, blocked: closed.quiet }).tap ? 1 : 0;
      t += FRAME_MS;
    };
    for (let i = 0; i < 10; i++) step({ x: 0.5, y: 0.5, ratio: 0.9, fist: false });
    // the model calls the pinch pose a fist; the geometry says pinch
    for (let i = 0; i < frames; i++) step({ x: 0.5, y: 0.5, ratio: 0.2, fist: true });
    for (let i = 0; i < 20; i++) step({ x: 0.5, y: 0.5, ratio: 0.9, fist: false });
    return { taps, backs };
  };
  assert.deepEqual(run(8), { taps: 1, backs: 0 }, "~260 ms: pinch opens");
  assert.deepEqual(run(30), { taps: 0, backs: 1 }, "~1 s: fist goes back");
});

test("thumbs up/down, pointing, victory and open hands are neither fist nor pinch", () => {
  for (const name of ["thumbs_up", "thumbs_down", "pointing_up", "victory", "woman_hands"]) {
    for (const { landmarks, aspect } of photoHands(name)) {
      const shape = handShape(landmarks, aspect);
      assert.equal(shape.fist, false, `${name} is not a fist`);
      assert.ok(shape.ratio >= 0.3, `${name} is not a pinch (ratio ${shape.ratio})`);
    }
  }
});

test("palmPoint mirrors the front camera so the hand moves the way the user sees it", () => {
  assert.deepEqual(palmPoint(hand({ x: 0.2, y: 0.4 })), { x: 0.8, y: 0.4 });
  assert.deepEqual(palmPoint(hand({ x: 0.2, y: 0.4 }), { mirror: false }), { x: 0.2, y: 0.4 });
});

test("a short still pinch taps on release", () => {
  const tracker = createPinchTracker();
  const ratios = [0.9, 0.2, 0.2, 0.2, 0.2, 0.2, 0.9, 0.9];
  const taps = ratios.map((ratio, i) => tracker.update({ t: i * FRAME_MS, hand: { x: 0.5, y: 0.5, ratio } }).tap);
  assert.deepEqual(taps, [false, false, false, false, false, false, false, true]);
});

test("fingers touching for a blurred frame or two are not a pinch", () => {
  // Owner 26.09: "waving, it thought I was pinching"
  const tracker = createPinchTracker();
  const ratios = [0.9, 0.2, 0.2, 0.2, 0.9, 0.9, 0.9];
  const taps = ratios.map((ratio, i) => tracker.update({ t: i * FRAME_MS, hand: { x: 0.5, y: 0.5, ratio } }).tap);
  assert.equal(taps.includes(true), false);
});

test("fingers closing at the turning point of a wave do not open anything", () => {
  const swipe = createSwipeTracker();
  const pinch = createPinchTracker();
  const wave = [];
  for (let i = 0; i < 3; i++) wave.push(...line([0.4, 0.5], [0.6, 0.5], 5), ...still(0.6, 0.5, 6), ...line([0.6, 0.5], [0.4, 0.5], 5), ...still(0.4, 0.5, 6));
  const path = [...still(0.4, 0.5, 12), ...wave, ...still(0.4, 0.5, 20)];
  let taps = 0;
  path.forEach(([x, y], i) => {
    const t = i * FRAME_MS;
    // At every turning point (hand still for 6 frames) the fingers touch for 5 frames
    const turning = i >= 12 && i < 12 + wave.length && [0, 1, 2, 3, 4].includes((i - 12) % 11 - 5);
    const hand = { x, y, ratio: turning ? 0.2 : 0.9 };
    const { pinched, tap } = pinch.update({ t, hand, blocked: swipe.moving(t) });
    taps += tap ? 1 : 0;
    swipe.update({ t, hand, pinched });
  });
  assert.equal(taps, 0);
  // the same finger movement on a hand held still is a real pinch
  const still2 = createSwipeTracker();
  const pinch2 = createPinchTracker();
  let real = 0;
  for (let i = 0; i < 40; i++) {
    const t = i * FRAME_MS;
    const hand = { x: 0.5, y: 0.5, ratio: i >= 20 && i < 25 ? 0.2 : 0.9 };
    const { pinched, tap } = pinch2.update({ t, hand, blocked: still2.moving(t) });
    real += tap ? 1 : 0;
    still2.update({ t, hand, pinched });
  }
  assert.equal(real, 1);
});

test("one noisy frame neither presses nor releases", () => {
  const tracker = createPinchTracker();
  const seen = [0.9, 0.2, 0.9, 0.2, 0.2, 0.38, 0.38].map(
    (ratio, i) => tracker.update({ t: i * FRAME_MS, hand: { x: 0.5, y: 0.5, ratio } })
  );
  assert.equal(seen.some((s) => s.tap), false);
  assert.equal(seen[2].pinched, false, "single closed frame is not a pinch");
  assert.equal(seen.at(-1).pinched, true, "0.38 sits inside the hysteresis band and keeps the pinch");
});

test("a long or moving pinch opens nothing", () => {
  const long = createPinchTracker();
  let tapped = false;
  for (let t = 0; t <= 900; t += FRAME_MS) tapped ||= long.update({ t, hand: { x: 0.5, y: 0.5, ratio: 0.2 } }).tap;
  for (const t of [933, 966]) tapped ||= long.update({ t, hand: { x: 0.5, y: 0.5, ratio: 0.9 } }).tap;
  assert.equal(tapped, false);

  const moving = createPinchTracker();
  const frames = [
    [0.5, 0.2],
    [0.5, 0.2],
    [0.6, 0.2],
    [0.7, 0.2],
    [0.7, 0.9],
    [0.7, 0.9],
  ];
  const taps = frames.map(([x, ratio], i) => moving.update({ t: i * FRAME_MS, hand: { x, y: 0.5, ratio } }).tap);
  assert.equal(taps.includes(true), false);
});

test("a quick move to the left is one horizontal swipe", () => {
  const frames = motion([...still(0.6, 0.5, 12), ...line([0.6, 0.5], [0.35, 0.52], 6), ...still(0.35, 0.52, 10)]);
  const events = swipes(frames);
  assert.equal(events.length, 1);
  assert.equal(events[0].axis, "x");
  assert.equal(events[0].dir, -1);
  assert.ok(events[0].travel > 0.2);
});

test("hand down scrolls down, hand up scrolls up", () => {
  const down = swipes(motion([...still(0.5, 0.3, 12), ...line([0.5, 0.3], [0.51, 0.55], 6), ...still(0.51, 0.55, 10)]));
  assert.deepEqual(down.map((e) => [e.axis, e.dir]), [["y", 1]]);
  const up = swipes(motion([...still(0.5, 0.6, 12), ...line([0.5, 0.6], [0.5, 0.35], 6), ...still(0.5, 0.35, 10)]));
  assert.deepEqual(up.map((e) => [e.axis, e.dir]), [["y", -1]]);
});

test("the return stroke after a swipe is ignored, a second swipe the same way counts", () => {
  const path = [
    ...still(0.7, 0.5, 12),
    ...line([0.7, 0.5], [0.4, 0.5], 6),
    ...still(0.4, 0.5, 10),
    // hand comes back just as fast
    ...line([0.4, 0.5], [0.7, 0.5], 6),
    ...still(0.7, 0.5, 10),
    ...line([0.7, 0.5], [0.4, 0.5], 6),
    ...still(0.4, 0.5, 10),
  ];
  const events = swipes(motion(path));
  assert.deepEqual(events.map((e) => e.dir), [-1, -1]);
  assert.ok(events.every((e) => e.travel > 0.25), "travel is measured from where the hand rested");
});

test("a wind-up to the right before a swipe to the left is a swipe to the left", () => {
  // Owner 26.09: waving left or right, "it doesn't understand which way".
  const frames = motion([
    ...still(0.5, 0.5, 12),
    ...line([0.5, 0.5], [0.6, 0.5], 4), // wind-up: 0.1 in 130 ms (~0.75/s, quick but not a swipe)
    ...line([0.6, 0.5], [0.62, 0.5], 2),
    ...line([0.62, 0.5], [0.3, 0.5], 5), // the swipe: 0.32 in 165 ms (~2/s)
    ...still(0.3, 0.5, 10),
  ]);
  assert.deepEqual(swipes(frames).map((e) => [e.axis, e.dir]), [["x", -1]]);
  const fastWindUp = motion([
    ...still(0.5, 0.5, 12),
    ...line([0.5, 0.5], [0.62, 0.5], 3), // wind-up fast enough to start a gesture (~1.2/s)
    ...line([0.62, 0.5], [0.3, 0.5], 4), // swipe ~2.4/s
    ...still(0.3, 0.5, 10),
  ]);
  assert.deepEqual(swipes(fastWindUp).map((e) => [e.axis, e.dir]), [["x", -1]]);
});

test("a flick out and back counts in the direction of the faster outward stroke", () => {
  const frames = motion([
    ...still(0.6, 0.5, 12),
    ...line([0.6, 0.5], [0.35, 0.5], 4), // out left ~1.9/s
    ...line([0.35, 0.5], [0.58, 0.5], 8), // back ~0.9/s
    ...still(0.58, 0.5, 20), // after a return the tracker waits a moment: a third stroke would be waving
  ]);
  assert.deepEqual(swipes(frames).map((e) => [e.axis, e.dir]), [["x", -1]]);
});

test("waving back and forth is not a direction and says so", () => {
  const wave = [];
  for (let i = 0; i < 3; i++) wave.push(...line([0.4, 0.5], [0.6, 0.5], 5), ...line([0.6, 0.5], [0.4, 0.5], 5));
  const events = swipes(motion([...still(0.4, 0.5, 12), ...wave, ...still(0.4, 0.5, 10)]));
  assert.deepEqual(events.map((e) => e.type), ["unclear"]);
  // a long vehement wave is just waving: one "unclear" at most, never a swipe
  const long = [];
  for (let i = 0; i < 8; i++) long.push(...line([0.4, 0.5], [0.6, 0.5], 4), ...line([0.6, 0.5], [0.4, 0.5], 4));
  const longEvents = swipes(motion([...still(0.4, 0.5, 12), ...long, ...still(0.4, 0.5, 10)]));
  assert.ok(longEvents.every((e) => e.type === "unclear") && longEvents.length <= 1, JSON.stringify(longEvents));
});

/* Päris käsi: kaarjas (küünarnukk on pöördetelg), sujuva kiirendusega,
   ja pärast tõmmet ei jää ta seisma — laskub või triivib. Omanik 26.09:
   „vasakule ja paremale, üles ja alla ei tööta". */
const ease = (a, b, n, arc = 0) =>
  Array.from({ length: n }, (_, i) => {
    const e = (1 - Math.cos((Math.PI * (i + 1)) / n)) / 2;
    return [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e - arc * Math.sin(Math.PI * e)];
  });
const drift = (a, v, n) => Array.from({ length: n }, (_, i) => [a[0] + (v[0] * (i + 1) * FRAME_MS) / 1000, a[1] + (v[1] * (i + 1) * FRAME_MS) / 1000]);
const noisy = (frames, sigma = 0.004) => {
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() || 1e-9)) * Math.cos(2 * Math.PI * rnd());
  return frames.map((f) => (f.hand ? { ...f, hand: { x: f.hand.x + gauss() * sigma, y: f.hand.y + gauss() * sigma } } : f));
};
const kinds = (events) => events.map((e) => (e.type === "swipe" ? e.axis + (e.dir > 0 ? "+" : "-") : e.type));

test("a real hand swipe counts although the hand never stops afterwards", () => {
  const arc = ease([0.62, 0.5], [0.38, 0.5], 9, 0.06);
  // swipe, then the hand is lowered out of the frame
  const lowered = [...motion([...still(0.62, 0.5, 20), ...arc, ...ease([0.38, 0.5], [0.33, 1.1], 15)]), ...Array.from({ length: 20 }, (_, i) => ({ t: (44 + i) * FRAME_MS, hand: null }))];
  assert.deepEqual(kinds(swipes(noisy(lowered))), ["x-"]);
  // swipe, then a slow drift for a second
  const drifting = motion([...still(0.62, 0.5, 20), ...arc, ...drift([0.38, 0.5], [-0.2, 0.2], 30), ...still(0.32, 0.56, 20)]);
  assert.deepEqual(kinds(swipes(noisy(drifting))), ["x-"]);
  // down, then back up more slowly
  const downUp = motion([...still(0.5, 0.35, 20), ...ease([0.5, 0.35], [0.52, 0.62], 8), ...ease([0.52, 0.62], [0.5, 0.37], 16), ...still(0.5, 0.37, 20)]);
  assert.deepEqual(kinds(swipes(noisy(downUp))), ["y+"]);
});

test("sweeping through the waving window counts in the direction the hand went", () => {
  // Owner 26.09: the hand comes in from one side and goes out the other
  const entering = (from, to, n) => [
    ...motion(ease(from, to, n)),
  ];
  const leftToRight = [...Array.from({ length: 5 }, (_, i) => ({ t: i * FRAME_MS, hand: null })), ...entering([0.1, 0.5], [0.95, 0.5], 12).map((f) => ({ ...f, t: f.t + 5 * FRAME_MS })), ...Array.from({ length: 15 }, (_, i) => ({ t: (17 + i) * FRAME_MS, hand: null }))];
  assert.deepEqual(kinds(swipes(noisy(leftToRight))), ["x+"]);
  // comes in from the right and stops in the middle: a swipe to the left
  const inFromRight = [...entering([0.92, 0.5], [0.45, 0.5], 10), ...motion(still(0.45, 0.5, 15), { start: 10 * FRAME_MS })];
  assert.deepEqual(kinds(swipes(noisy(inFromRight))), ["x-"]);
  // leaving the window is enough: the hand does not have to leave the camera's view
  const outOfWindow = motion([...still(0.5, 0.5, 20), ...ease([0.5, 0.5], [0.85, 0.5], 9), ...still(0.85, 0.5, 20)]);
  assert.deepEqual(kinds(swipes(noisy(outOfWindow))), ["x+"]);
  // top to bottom, edge to edge: scrolls down
  const topToBottom = motion([...still(0.5, 0.12, 20), ...ease([0.5, 0.12], [0.52, 0.9], 12), ...still(0.52, 0.9, 20)]);
  assert.deepEqual(kinds(swipes(noisy(topToBottom))), ["y+"]);
});

test("a fast sweep counts even when the blurred hand is lost in the middle of the frame", () => {
  // Measured in the browser: the model saw a fast sweep only at x 0.87 and 0.41, then lost it.
  const frames = [
    { t: 0, hand: null },
    { t: 270, hand: { x: 0.866, y: 0.557 } },
    { t: 546, hand: { x: 0.409, y: 0.562 } },
    ...Array.from({ length: 20 }, (_, i) => ({ t: 636 + i * 90, hand: null })),
  ];
  assert.deepEqual(kinds(swipes(frames)), ["x-"]);
  // the same loss after a short movement, or a vertical one (lowering), counts for nothing
  const short = [{ t: 0, hand: { x: 0.6, y: 0.5 } }, ...motion(still(0.6, 0.5, 12), { start: 33 }), { t: 460, hand: { x: 0.5, y: 0.5 } }, ...Array.from({ length: 20 }, (_, i) => ({ t: 550 + i * 90, hand: null }))];
  assert.deepEqual(swipes(short), []);
  const down = [...motion(still(0.5, 0.4, 12)), { t: 430, hand: { x: 0.5, y: 0.75 } }, ...Array.from({ length: 20 }, (_, i) => ({ t: 520 + i * 90, hand: null }))];
  assert.deepEqual(swipes(down), []);
});

test("imperfect, partial movements count by their main direction", () => {
  // Owner 26.09: "people don't do it perfectly, even partial movements should count"
  const shortSlantedLeft = motion([...still(0.55, 0.5, 20), ...ease([0.55, 0.5], [0.45, 0.43], 8), ...still(0.45, 0.43, 20)]);
  assert.deepEqual(kinds(swipes(noisy(shortSlantedLeft))), ["x-"]);
  const shortUp = motion([...still(0.5, 0.55, 20), ...ease([0.5, 0.55], [0.54, 0.48], 7), ...still(0.54, 0.48, 20)]);
  assert.deepEqual(kinds(swipes(noisy(shortUp))), ["y-"]);
  const slowerRight = motion([...still(0.4, 0.5, 20), ...ease([0.4, 0.5], [0.55, 0.52], 14), ...still(0.55, 0.52, 20)]);
  assert.deepEqual(kinds(swipes(noisy(slowerRight))), ["x+"]);
});

test("a downward swipe that ends low in the frame still scrolls; the hand did not leave", () => {
  const low = motion([...still(0.5, 0.45, 20), ...ease([0.5, 0.45], [0.51, 0.86], 9), ...still(0.51, 0.86, 20)]);
  assert.deepEqual(kinds(swipes(noisy(low))), ["y+"]);
});

test("lowering the hand out through a bottom corner after a side swipe keeps the swipe", () => {
  // The hand ends right of the window and is lowered out: it left at the bottom, not the right
  const frames = [
    ...motion([...still(0.55, 0.5, 20), ...ease([0.55, 0.5], [0.82, 0.55], 11), ...ease([0.82, 0.55], [0.84, 1.05], 12)]),
    ...Array.from({ length: 20 }, (_, i) => ({ t: (43 + i) * FRAME_MS, hand: null })),
  ];
  assert.deepEqual(kinds(swipes(noisy(frames))), ["x+"]);
});

test("raising the hand into the window or lowering it out does not scroll", () => {
  const raised = motion([...ease([0.5, 0.97], [0.5, 0.5], 10), ...still(0.5, 0.5, 20)]);
  assert.deepEqual(swipes(noisy(raised)), []);
  const lowered = [...motion([...still(0.5, 0.5, 20), ...ease([0.5, 0.5], [0.5, 1.05], 10)]), ...Array.from({ length: 15 }, (_, i) => ({ t: (30 + i) * FRAME_MS, hand: null }))];
  assert.deepEqual(swipes(noisy(lowered)), []);
});

test("slow drift, a diagonal and a raised hand are not swipes", () => {
  const drift = swipes(motion([...still(0.5, 0.5, 12), ...line([0.5, 0.5], [0.3, 0.5], 40)]));
  assert.deepEqual(drift, []);
  const diagonal = swipes(motion([...still(0.6, 0.3, 12), ...line([0.6, 0.3], [0.4, 0.5], 6), ...still(0.4, 0.5, 10)]));
  assert.deepEqual(diagonal, []);
  // hand enters the frame already moving upwards
  const raised = swipes(motion([...line([0.5, 0.9], [0.5, 0.6], 6), ...still(0.5, 0.6, 10)]));
  assert.deepEqual(raised, []);
});

test("a hand that leaves the frame mid-stroke or moves while pinched does nothing", () => {
  const tracker = createSwipeTracker();
  const gone = Array.from({ length: 20 }, (_, i) => ({ t: (16 + i) * FRAME_MS, hand: null }));
  const lowered = [...motion([...still(0.5, 0.5, 12), ...line([0.5, 0.5], [0.5, 0.8], 4)]), ...gone];
  assert.deepEqual(swipes(lowered, tracker), []);
  // hand comes back later, resting: the old stroke does not fire
  const back = motion(still(0.5, 0.6, 12), { start: 40 * FRAME_MS });
  assert.deepEqual(swipes(back, tracker), []);
  const pinchedMove = motion([...still(0.6, 0.5, 12), ...line([0.6, 0.5], [0.3, 0.5], 6), ...still(0.3, 0.5, 10)], {
    pinched: true,
  });
  assert.deepEqual(swipes(pinchedMove), []);
});

test("the same swipe counts at 8 frames per second as at 30", () => {
  const slow = [];
  // 0,3 kaadrit veerand sekundiga — sama kiirus mis 30 kaadri testides
  const path = [...still(0.6, 0.5, 4), ...line([0.6, 0.5], [0.3, 0.5], 2), ...still(0.3, 0.5, 4)];
  path.forEach(([x, y], i) => slow.push({ t: i * 125, hand: { x, y } }));
  assert.deepEqual(swipes(slow).map((e) => [e.axis, e.dir]), [["x", -1]]);
});

test("a swipe survives the model losing the blurred hand for a moment", () => {
  const frames = motion([...still(0.6, 0.5, 12), ...line([0.6, 0.5], [0.3, 0.5], 6), ...still(0.3, 0.5, 10)]);
  frames[14] = { t: frames[14].t, hand: null };
  frames[15] = { t: frames[15].t, hand: null };
  assert.deepEqual(swipes(frames).map((e) => [e.axis, e.dir]), [["x", -1]]);
});

test("a held fist goes back once, a passing one does not", () => {
  const fist = createFistTracker();
  const seen = [];
  for (let t = 0; t <= 1000; t += FRAME_MS) seen.push(fist.update({ t, hand: { fist: true } }).back);
  assert.equal(seen.filter(Boolean).length, 1, "one back per held fist");
  assert.equal(seen.indexOf(true) * FRAME_MS >= 400, true, "only after the hold time");

  const passing = createFistTracker();
  let back = false;
  for (let t = 0; t < 300; t += FRAME_MS) back ||= passing.update({ t, hand: { fist: true } }).back;
  for (let t = 300; t < 700; t += FRAME_MS) back ||= passing.update({ t, hand: { fist: false } }).back;
  assert.equal(back, false);
});

test("a new fist needs an open hand in between; one flickering frame is not an open hand", () => {
  const fist = createFistTracker();
  let backs = 0;
  let t = 0;
  const run = (isFist, ms) => {
    for (const end = t + ms; t < end; t += FRAME_MS) backs += fist.update({ t, hand: { fist: isFist } }).back ? 1 : 0;
  };
  run(true, 800);
  run(false, FRAME_MS); // one noisy frame
  run(true, 800);
  assert.equal(backs, 1);
  run(false, 300);
  run(true, 800);
  assert.equal(backs, 2);
});

test("opening a fist passes through a pinch shape but does not open anything", () => {
  const fist = createFistTracker();
  const pinch = createPinchTracker();
  let taps = 0;
  let t = 0;
  const frame = (isFist, ratio) => {
    const hand = { x: 0.5, y: 0.5, ratio, fist: isFist };
    const { quiet } = fist.update({ t, hand });
    taps += pinch.update({ t, hand, blocked: quiet }).tap ? 1 : 0;
    t += FRAME_MS;
  };
  for (let i = 0; i < 25; i++) frame(true, Number.POSITIVE_INFINITY);
  for (let i = 0; i < 4; i++) frame(false, 0.2); // fingers opening, thumb meets the index
  for (let i = 0; i < 4; i++) frame(false, 0.9);
  assert.equal(taps, 0);
  // a real pinch a moment later still works
  for (let i = 0; i < 20; i++) frame(false, 0.9);
  for (let i = 0; i < 5; i++) frame(false, 0.2);
  for (let i = 0; i < 3; i++) frame(false, 0.9);
  assert.equal(taps, 1);
});
