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
  assert.deepEqual(handShape(landmarks, aspect), { fist: true, ratio: Number.POSITIVE_INFINITY });
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
  const ratios = [0.9, 0.2, 0.2, 0.2, 0.9, 0.9];
  const taps = ratios.map((ratio, i) => tracker.update({ t: i * FRAME_MS, hand: { x: 0.5, y: 0.5, ratio } }).tap);
  assert.deepEqual(taps, [false, false, false, false, false, true]);
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
  const frames = motion([...still(0.6, 0.5, 12), ...line([0.6, 0.5], [0.35, 0.52], 6), ...still(0.35, 0.52, 4)]);
  const events = swipes(frames);
  assert.equal(events.length, 1);
  assert.equal(events[0].axis, "x");
  assert.equal(events[0].dir, -1);
  assert.ok(events[0].travel > 0.2);
});

test("hand down scrolls down, hand up scrolls up", () => {
  const down = swipes(motion([...still(0.5, 0.3, 12), ...line([0.5, 0.3], [0.51, 0.55], 6), ...still(0.51, 0.55, 4)]));
  assert.deepEqual(down.map((e) => [e.axis, e.dir]), [["y", 1]]);
  const up = swipes(motion([...still(0.5, 0.6, 12), ...line([0.5, 0.6], [0.5, 0.35], 6), ...still(0.5, 0.35, 4)]));
  assert.deepEqual(up.map((e) => [e.axis, e.dir]), [["y", -1]]);
});

test("the return stroke after a swipe is ignored, a second swipe the same way counts", () => {
  const path = [
    ...still(0.7, 0.5, 12),
    ...line([0.7, 0.5], [0.4, 0.5], 6),
    ...still(0.4, 0.5, 2),
    // hand comes back just as fast
    ...line([0.4, 0.5], [0.7, 0.5], 6),
    ...still(0.7, 0.5, 2),
    ...line([0.7, 0.5], [0.4, 0.5], 6),
    ...still(0.4, 0.5, 5),
  ];
  const events = swipes(motion(path));
  assert.deepEqual(events.map((e) => e.dir), [-1, -1]);
  assert.ok(events.every((e) => e.travel > 0.25), "travel is measured from where the hand rested");
});

test("slow drift, a diagonal and a raised hand are not swipes", () => {
  const drift = swipes(motion([...still(0.5, 0.5, 12), ...line([0.5, 0.5], [0.3, 0.5], 40)]));
  assert.deepEqual(drift, []);
  const diagonal = swipes(motion([...still(0.6, 0.3, 12), ...line([0.6, 0.3], [0.4, 0.5], 6), ...still(0.4, 0.5, 4)]));
  assert.deepEqual(diagonal, []);
  // hand enters the frame already moving upwards
  const raised = swipes(motion([...line([0.5, 0.9], [0.5, 0.6], 6), ...still(0.5, 0.6, 4)]));
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
  const pinchedMove = motion([...still(0.6, 0.5, 12), ...line([0.6, 0.5], [0.3, 0.5], 6), ...still(0.3, 0.5, 4)], {
    pinched: true,
  });
  assert.deepEqual(swipes(pinchedMove), []);
});

test("the same swipe counts at 8 frames per second as at 30", () => {
  const slow = [];
  // 0,3 kaadrit veerand sekundiga — sama kiirus mis 30 kaadri testides
  const path = [...still(0.6, 0.5, 4), ...line([0.6, 0.5], [0.3, 0.5], 2), ...still(0.3, 0.5, 3)];
  path.forEach(([x, y], i) => slow.push({ t: i * 125, hand: { x, y } }));
  assert.deepEqual(swipes(slow).map((e) => [e.axis, e.dir]), [["x", -1]]);
});

test("a swipe survives the model losing the blurred hand for a moment", () => {
  const frames = motion([...still(0.6, 0.5, 12), ...line([0.6, 0.5], [0.3, 0.5], 6), ...still(0.3, 0.5, 5)]);
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
  run(true, 500);
  run(false, FRAME_MS); // one noisy frame
  run(true, 500);
  assert.equal(backs, 1);
  run(false, 300);
  run(true, 500);
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
  for (let i = 0; i < 15; i++) frame(true, Number.POSITIVE_INFINITY);
  for (let i = 0; i < 4; i++) frame(false, 0.2); // fingers opening, thumb meets the index
  for (let i = 0; i < 4; i++) frame(false, 0.9);
  assert.equal(taps, 0);
  // a real pinch a moment later still works
  for (let i = 0; i < 20; i++) frame(false, 0.9);
  for (let i = 0; i < 3; i++) frame(false, 0.2);
  for (let i = 0; i < 3; i++) frame(false, 0.9);
  assert.equal(taps, 1);
});
