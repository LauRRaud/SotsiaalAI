export function decodeHashFragment(hash) {
  const fragment = String(hash || "").slice(1);
  try {
    return decodeURIComponent(fragment);
  } catch {
    return fragment;
  }
}
