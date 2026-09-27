// Next.js calls register() once when a server instance starts. The RAG v2 chat verifies its knowledge
// sources in the background from here, so the first question after a deploy or a chat plan rebuild does
// not wait for that work (ADR-033). Node runtime only, never during a build. Nothing here can stop the
// server from starting: a failure only logs, and the first chat turn then starts the warm-up as before.
export function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.NEXT_PHASE === 'phase-production-build') return;
  if (process.env.M4_PILOT_ENABLED !== '1') return;
  const timer = setTimeout(async () => {
    try {
      const { warmPilotAtStart } = await import('./lib/rag-v2/pilot/retrieval.js');
      console.info('[rag-v2] start warm-up', await warmPilotAtStart() ? 'started' : 'not needed');
    } catch (error) {
      console.error('[rag-v2] start warm-up skipped', error?.code || error?.name);
    }
  }, 2000);
  timer.unref?.();
}
