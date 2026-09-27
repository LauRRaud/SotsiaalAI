import { fail, id } from '../contracts.js';

// How a search generation stores its index (ADR-036). 'generation': every generation has its own unit rows and
// Qdrant collection. 'versions-v1': a document version's unit rows and points are written once per search config
// and shared; a generation is the list of versions it serves (its snapshot and rag_v2_generation_document rows).
export const GENERATION_LAYOUT = 'generation';
export const VERSION_LAYOUT = 'versions-v1';
export const INDEX_LAYOUTS = Object.freeze([GENERATION_LAYOUT, VERSION_LAYOUT]);

export function indexLayout(value) {
  const layout = value ?? GENERATION_LAYOUT;
  if (!INDEX_LAYOUTS.includes(layout)) fail('unsupported_index_layout');
  return layout;
}
// The layout is part of a version-layout generation's identity, so the same source and config can exist in both.
export function generationIdentity(tenant, source, config, layout) {
  return indexLayout(layout) === GENERATION_LAYOUT ? id('search_generation', tenant, source, config) : id('search_generation', tenant, source, config, layout);
}
export function sharedLayout(generation) { return indexLayout(generation.layout) === VERSION_LAYOUT; }
/** The versions a generation serves for these documents; a document outside the generation has none. */
export function generationVersions(generation, documentIds) {
  const versions = [];
  for (const documentId of documentIds) {
    const version = generation.snapshot?.documents?.[documentId]?.version_id;
    if (version) versions.push(version);
  }
  return versions;
}
