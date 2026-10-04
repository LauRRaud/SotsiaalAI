// Prepare files with the existing service live, then stop it before starting the
// new code. There is exactly one service; failures restore its previous release.
export async function publishRelease(host) {
  let switched = false;
  try {
    await host.prepare();
    await host.migrate();
    await host.preparePlan();
    switched = true;
    await host.stop();
    await host.switch();
    await host.start();
    await host.check();
    await host.checkPublic();
    await host.commit();
  } catch (error) {
    if (switched) await host.rollback();
    await host.abandon();
    throw error;
  }
}
