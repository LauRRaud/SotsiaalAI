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
  return (parts.length ? parts : [source]).flatMap(part => (typeof part === 'string' ? miswritten(part, targets, hosts) : [part]));
}

// The model sometimes miswrites an address by a letter (06.10.2026: one letter dropped from a company's name, twice
// in one answer, and the bubble left both as text). An address whose site differs by one or two letters from the site
// of exactly one cited source, with the same ending, is that source's address miswritten: it is shown as the source
// gives it and leads there. The page it names must be a cited one, or the site named alone must have one cited page.
// A short site name is left alone: two letters of seven make another name.
const ADDRESS = /(?<![\p{L}\p{N}@./-])(?:https?:\/\/)?(?:www\.)?((?:[a-z0-9-]+\.)+[a-z]{2,})((?:\/[\p{L}\p{N}_~%-]+)*)\/?(?![\p{L}\p{N}/-]|\.[\p{L}\p{N}])/giu;
const ending = host => host.slice(host.lastIndexOf('.'));
function distance(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  let row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    row = next;
  }
  return row[b.length];
}
function miswritten(text, targets, hosts) {
  const parts = [];
  let last = 0;
  for (const match of text.matchAll(ADDRESS)) {
    const host = match[1].toLowerCase(), page = match[2].toLowerCase();
    if (hosts.has(host)) continue;
    const near = [...hosts.keys()].filter(known => known.length >= 8 && ending(known) === ending(host) && distance(known, host) <= 2);
    if (near.length !== 1) continue;
    const address = `${near[0]}${page}`, url = page ? targets.get(address) : hosts.get(near[0]);
    if (!url) continue;
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push({ text: address, url });
    last = match.index + match[0].length;
  }
  if (!parts.length) return [text];
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
