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

// A scheduled job of the app runs the release's code and dependencies, like the frontend. The repository's unit files
// name the first checkout; a release writes its own folder in its place. The releases folder beside the checkout
// (…/sotsiaalai-releases) is another path and is never taken for it. The frontend's unit has an override of its own.
const checkout = app => new RegExp(`${app.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`, 'g');
export const namesCheckout = (text, app) => checkout(app).test(text || '');
export const releaseUnit = (text, app, directory) => text.replace(checkout(app), directory);
export const jobUnit = (name, text, app) => /^sotsiaalai-[a-z0-9-]+\.service$/.test(name) && name !== 'sotsiaalai-frontend.service' && namesCheckout(text, app);
export const outsideRelease = ({ workingDirectory, execStart }, app) => namesCheckout(workingDirectory, app) || namesCheckout(execStart, app);
