# MediaPipe käetuvastus (vendored)

Ruumi käežestid (`components/room/HandGestures.jsx`) laadivad need failid omalt
päritolult, et kaamerarežiim ei teeks ühtegi päringut kolmandale osapoolele.
Kaamerakaadrid ei lahku seadmest.

| Fail | Allikas |
| --- | --- |
| `vision_bundle.js` | npm `@mediapipe/tasks-vision@1.0.1`, `vision_bundle.js` (IIFE, globaal `Vision`; sourcemap-viide eemaldatud) |
| `vision_wasm_internal.js` / `.wasm` | sama pakett, `wasm/` (ainult SIMD-variant) |
| `gesture_recognizer.task` | `https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task` (sisaldab käepunktide mudelit ja žestiklassifikaatorit) |

SHA-256:

```
36cf336f1d1259b540a09251f53ea277d36e1eeedc4d733a8afa816e4102401e  vision_bundle.js
e170ee67dd4e16c1a6fcd8840a206687e5a59b22c20e4a902bc445b095454d73  vision_wasm_internal.js
8da277a733926eacd0474b8704b36742d6ec3231c57a860c5b889dff8f1df886  vision_wasm_internal.wasm
97952348cf6a6a4915c2ea1496b4b37ebabc50cbbf80571435643c455f2b0482  gesture_recognizer.task
```

Litsents: Apache License 2.0 (Google LLC, MediaPipe) —
https://github.com/google-ai-edge/mediapipe/blob/master/LICENSE

Uuendamisel vaheta kõik neli faili korraga: laadija ja wasm peavad olema samast
paketiversioonist.
