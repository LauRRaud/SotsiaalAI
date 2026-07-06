import { readCssSourceBundle } from "./cssSourceBundle.mjs";

export function readServiceMapCssBundle() {
  return readCssSourceBundle("app/styles/features/service-map/index.css");
}
