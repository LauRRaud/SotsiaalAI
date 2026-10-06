// ADR-097: the web addresses an answer names, as links. Only an address of one of the answer's own sources becomes a
// link, and it leads to that source's declared address: the model writes the words, never the target.
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

/** The links of a message's sources: [{ address, url }], one per address, the longest first (a page before its site). */
export function messageLinks(sources) {
  const links = new Map();
  for (const source of Array.isArray(sources) ? sources : []) {
    if (typeof source?.web === 'string' && source.web && /^https:\/\/[^\s"<>]+$/u.test(source.webUrl || '') && !links.has(source.web.toLowerCase())) links.set(source.web.toLowerCase(), { address: source.web, url: source.webUrl });
  }
  return [...links.values()].sort((a, b) => b.address.length - a.address.length);
}

/** `text` in parts: strings, and { text, url } for each place an address of `links` stands (with or without
 *  "https://" and "www.", in any letter case). A site named without its page links to the page when one source only
 *  is of that site. An address inside a longer one (another path, another host) is left as text. */
export function splitByLinks(text, links) {
  const source = String(text ?? '');
  if (!Array.isArray(links) || !links.length || !source) return [source];
  const targets = new Map(links.map(link => [link.address.toLowerCase(), link.url]));
  const hosts = new Map();
  for (const link of links) { const host = link.address.split('/')[0].toLowerCase(); hosts.set(host, hosts.has(host) ? null : link.url); }
  for (const [host, url] of hosts) if (url && !targets.has(host)) targets.set(host, url);
  const names = [...targets.keys()].sort((a, b) => b.length - a.length).map(escape).join('|');
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}@./-])(?:https?://)?(?:www\\.)?(${names})/?(?![\\p{L}\\p{N}/-]|\\.[\\p{L}\\p{N}])`, 'giu');
  const parts = [];
  let last = 0;
  for (const match of source.matchAll(pattern)) {
    if (match.index > last) parts.push(source.slice(last, match.index));
    parts.push({ text: match[0], url: targets.get(match[1].toLowerCase()) });
    last = match.index + match[0].length;
  }
  if (last < source.length) parts.push(source.slice(last));
  return parts.length ? parts : [source];
}
