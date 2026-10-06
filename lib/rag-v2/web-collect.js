import { createHash } from 'node:crypto';
import { extractPage, subpageLinks, robotsAllows } from './web-page.js';

// Reading pages from the web for the corpus (web-page.js says what is kept of a page). This part fetches: one request
// at a time, https only, a pause between requests to one site, the site's robots.txt respected, redirects followed by
// hand so that every hop is checked, a size limit, and an honest name in the User-Agent. A page that cannot be read is
// reported with its reason and never guessed.
export const COLLECTOR_AGENT = 'SotsiaalAI source collector/1.0 (+https://sotsiaal.pro)';
const sha = value => createHash('sha256').update(value).digest('hex');
const site = host => host.toLowerCase().replace(/^www\./u, '');
const pageKey = address => { const url = new URL(address); return `${site(url.host)}${url.pathname.replace(/\/+$/u, '')}`; };

/** One page. Returns { ok, status, finalUrl, contentType, lastModified, etag, body, rawSha256 } or { ok: false, error }. */
export async function fetchPage(url, { fetchImpl = globalThis.fetch, timeoutMs = 20000, maxBytes = 3_000_000, maxRedirects = 5 } = {}) {
  let current = url;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    let target;
    try { target = new URL(current); } catch { return { ok: false, error: 'address_not_allowed', finalUrl: current }; }
    // Public https names only: no plain http, no address literal, no local name.
    if (target.protocol !== 'https:' || !/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/iu.test(target.hostname) || target.username || target.port) return { ok: false, error: 'address_not_allowed', finalUrl: current };
    let response;
    try {
      response = await fetchImpl(current, { redirect: 'manual', signal: AbortSignal.timeout(timeoutMs),
        headers: { 'User-Agent': COLLECTOR_AGENT, Accept: 'text/html,application/xhtml+xml;q=0.9', 'Accept-Language': 'et' } });
    } catch (error) { return { ok: false, error: ['TimeoutError', 'AbortError'].includes(error?.name) ? 'timeout' : 'fetch_failed', finalUrl: current }; }
    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) { current = new URL(location, current).href; continue; }
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const result = { status: response.status, finalUrl: current, contentType, lastModified: response.headers.get('last-modified'), etag: response.headers.get('etag') };
    if (response.status !== 200) return { ok: false, error: `http_${response.status}`, ...result };
    if (!/^(?:text\/html|application\/xhtml\+xml)/u.test(contentType)) return { ok: false, error: 'not_html', ...result };
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > maxBytes) return { ok: false, error: 'too_large', ...result };
    const label = contentType.match(/charset=["']?([\w-]+)/u)?.[1] || bytes.subarray(0, 2048).toString('latin1').match(/<meta[^>]+charset=["']?([\w-]+)/iu)?.[1] || 'utf-8';
    let body;
    try { body = new TextDecoder(label).decode(bytes); } catch { body = new TextDecoder('utf-8').decode(bytes); }
    return { ok: true, ...result, body, rawSha256: sha(bytes) };
  }
  return { ok: false, error: 'too_many_redirects', finalUrl: current };
}

// A sub-page's id: the listed page's id and the path below it.
export function subpageId(sourceId, rootUrl, url) {
  const below = new URL(url).pathname.replace(/\/+$/u, '').slice(new URL(rootUrl).pathname.replace(/\/+$/u, '').length);
  const slug = below.split('/').filter(Boolean).map(part => decodeURIComponent(part).toLowerCase().normalize('NFKD').replace(/\p{M}+/gu, '').replace(/[^a-z0-9]+/gu, '-').replace(/^-+|-+$/gu, '')).filter(Boolean).join('--');
  const id = `${sourceId}--${slug || 'page'}`;
  return id.length <= 150 ? id : `${id.slice(0, 137)}-${sha(id).slice(0, 12)}`;
}

/**
 * A listed page and the sub-pages it leads to, breadth first: the page, then the pages below its path that it links
 * to, then theirs, down to `depth` levels and at most `max` sub-pages. entry.subpages: false, or { depth, max }.
 * site: { robots(url) → the site's robots.txt text, wait(host) → resolves when the site may be asked again }.
 * Returns { pages, skipped }: every page tried, with its status ('read', 'failed', 'robots_disallowed', 'duplicate',
 * 'left_section'), and the sub-page addresses left out by the limit.
 */
export async function collectEntry(entry, { fetchImpl = globalThis.fetch, site: host = {}, defaults = { depth: 2, max: 25 } } = {}) {
  const limit = entry.subpages === false ? { depth: 0, max: 0 } : { depth: entry.subpages?.depth ?? defaults.depth, max: entry.subpages?.max ?? defaults.max };
  const queue = [{ url: entry.url, depth: 0, id: entry.source_id, title: entry.title, parent: null }], seen = new Set([pageKey(entry.url)]), contents = new Set(), pages = [], skipped = [];
  let root = null, subpages = 0;
  while (queue.length) {
    const item = queue.shift(), target = new URL(item.url), about = { id: item.id, url: item.url, depth: item.depth, parent: item.parent };
    if (!robotsAllows(await host.robots?.(target) ?? '', target.pathname)) { pages.push({ ...about, status: 'robots_disallowed' }); continue; }
    await host.wait?.(target.host);
    const fetched = await fetchPage(item.url, { fetchImpl });
    if (!fetched.ok) { pages.push({ ...about, status: 'failed', error: fetched.error, http: fetched.status ?? null, finalUrl: fetched.finalUrl }); continue; }
    const { body, ...response } = fetched;
    if (item.depth === 0) root = fetched.finalUrl;
    else {
      // A sub-page that turns out to be another address: one already read, or one outside the listed page's section.
      const moved = pageKey(fetched.finalUrl) !== pageKey(item.url);
      if (moved && seen.has(pageKey(fetched.finalUrl))) { pages.push({ ...about, status: 'duplicate', finalUrl: fetched.finalUrl }); continue; }
      if (moved && !`${new URL(fetched.finalUrl).pathname}/`.startsWith(`${new URL(root).pathname.replace(/\/+$/u, '')}/`)) { pages.push({ ...about, status: 'left_section', finalUrl: fetched.finalUrl }); continue; }
      seen.add(pageKey(fetched.finalUrl));
    }
    const page = extractPage(body, fetched.finalUrl, { region: entry.region ?? null, title: item.title });
    // Two addresses with one content (an alias, a landing page that shows its first sub-page) are one source.
    if (contents.has(page.contentSha256)) { pages.push({ ...about, status: 'duplicate', finalUrl: fetched.finalUrl }); continue; }
    contents.add(page.contentSha256);
    pages.push({ ...about, status: 'read', fetched: response, page,
      entry: { ...entry, source_id: item.id, url: item.url, title: item.title || page.title, ...(item.parent ? { parent: item.parent } : {}) } });
    if (item.depth >= limit.depth) continue;
    for (const link of subpageLinks(body, fetched.finalUrl, { within: root })) {
      if (seen.has(pageKey(link.url))) continue;
      seen.add(pageKey(link.url));
      if (subpages >= limit.max) { skipped.push(link.url); continue; }
      subpages++;
      queue.push({ url: link.url, depth: item.depth + 1, id: subpageId(entry.source_id, root, link.url), title: link.text || null, parent: item.id });
    }
  }
  return { pages, skipped };
}

/** The politeness of one run: each site's robots.txt read once, and a pause between two requests to one site. */
export function siteManners({ fetchImpl = globalThis.fetch, delayMs = 1500, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  const robots = new Map(), last = new Map();
  return {
    async robots(url) {
      const key = site(url.host);
      if (!robots.has(key)) {
        let text = '';
        try {
          const response = await fetchImpl(`${url.origin}/robots.txt`, { signal: AbortSignal.timeout(10000), headers: { 'User-Agent': COLLECTOR_AGENT } });
          // No robots.txt, or one that cannot be read, restricts nothing.
          if (response.status === 200 && /^text\//u.test((response.headers.get('content-type') || 'text/plain').toLowerCase())) text = (await response.text()).slice(0, 200000);
        } catch { text = ''; }
        robots.set(key, text);
      }
      return robots.get(key);
    },
    async wait(host) {
      const key = site(host), since = Date.now() - (last.get(key) ?? 0);
      if (since < delayMs) await sleep(delayMs - since);
      last.set(key, Date.now());
    } };
}
