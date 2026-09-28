// The chat client's side of the pilot's answer stream (ADR-040). 'delta' events carry provisional text, the one 'done'
// event the reply the JSON path sends ({ status, body }); only that reply is the answer.

/** Reads one answer stream: its text goes to onText; returns the 'done' reply, or null when the stream ended without
 *  it (the connection was lost). A user's abort still throws. */
export async function readPilotStream(body, { createReader, onText = () => {} }) {
  try {
    for await (const ev of createReader(body)) {
      if (ev.event === 'delta') {
        let text;
        try { text = JSON.parse(ev.data)?.t; } catch { continue; }
        if (typeof text === 'string' && text) onText(text);
      } else if (ev.event === 'done') {
        try {
          const done = JSON.parse(ev.data);
          if (Number.isInteger(done?.status) && done.body && typeof done.body === 'object') return done;
        } catch { /* a final event cut in half */ }
        return null;
      }
    }
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
  }
  return null;
}

/** One pilot request with its answer stream. A stream lost before 'done' is asked again with the same request (the same
 *  turn key), at most `reconnects` times: the server then waits for that turn and never starts a second one. A reply
 *  that is not a stream (an error before the answer, or JSON) is returned as it is. `onRestart` clears the provisional
 *  text when a new attempt starts sending its own. */
export async function pilotExchange(send, { createReader, onText = () => {}, onRestart = () => {}, reconnects = 2, waitMs = 1000 }) {
  for (let attempt = 0; ; attempt++) {
    const response = await send();
    if (!(response.headers.get('content-type') || '').includes('text/event-stream')) return { response, done: null, lost: false };
    let fresh = attempt === 0;
    const done = await readPilotStream(response.body, { createReader,
      onText: text => { if (!fresh) { fresh = true; onRestart(); } onText(text); } });
    if (done) return { response, done, lost: false };
    if (attempt >= reconnects) return { response, done: null, lost: true };
    if (waitMs) await new Promise(resolve => setTimeout(resolve, waitMs));
  }
}
