/* ADR-176: where each municipality's pin stands on the outline map of Estonia (public/icons/eesti_kontuurkaart.svg,
   1600 x 1075), for the waiting view's map. The point is the municipality's centre (the town or the seat of the parish
   government), as [longitude, latitude]; the map is a plain longitude-latitude projection of the outline's extent,
   calibrated to its extreme points (21.83 E at x 21.69, 28.21 E at x 1586.25, 59.68 N at y 39.44, 57.51 N at y 1067.56).
   Every point falls on land in the outline (scratchpad adr176-map-check); a town on the coast or the border is moved
   slightly inland. Kihnu and Ruhnu are not drawn on the map: their pins stand in the sea where the islands are. */
const CENTRES = Object.freeze({
  alutaguse_vald: [27.31, 59.10], anija_vald: [25.33, 59.34], antsla_vald: [26.54, 57.83], elva_vald: [26.42, 58.22],
  haademeeste_vald: [24.50, 58.08], haapsalu_linn: [23.54, 58.94], haljala_vald: [26.26, 59.43], harku_vald: [24.55, 59.42],
  hiiumaa_vald: [22.75, 58.99], jarva_vald: [25.88, 59.04], joelahtme_vald: [25.08, 59.43], jogeva_vald: [26.39, 58.75],
  johvi_vald: [27.42, 59.36], kadrina_vald: [26.15, 59.33], kambja_vald: [26.71, 58.27], kanepi_vald: [26.76, 57.98],
  kastre_vald: [27.00, 58.33], kehtna_vald: [24.88, 58.93], keila_linn: [24.42, 59.31], kihnu_vald: [23.99, 58.13],
  kiili_vald: [24.84, 59.31], kohila_vald: [24.75, 59.17], kohtla_jarve_linn: [27.27, 59.40], kose_vald: [25.17, 59.18],
  kuusalu_vald: [25.44, 59.45], laane_harju_vald: [24.25, 59.27], laane_nigula_vald: [23.74, 58.96], laaneranna_vald: [23.85, 58.68],
  loksa_linn: [25.71, 59.58], luganuse_vald: [26.97, 59.36], luunja_vald: [26.88, 58.36], maardu_linn: [25.02, 59.48],
  marjamaa_vald: [24.43, 58.90], muhu_vald: [23.23, 58.60], mulgi_vald: [25.35, 58.13], mustvee_vald: [26.94, 58.85],
  narva_joesuu_linn: [28.04, 59.46], narva_linn: [28.19, 59.38], noo_vald: [26.53, 58.28], otepaa_vald: [26.50, 58.06],
  paide_linn: [25.56, 58.89], parnu_linn: [24.50, 58.39], peipsiaare_vald: [27.13, 58.60], pohja_parnumaa_vald: [24.50, 58.61],
  pohja_sakala_vald: [25.47, 58.54], poltsamaa_vald: [25.97, 58.65], polva_vald: [27.07, 58.06], raasiku_vald: [25.18, 59.36],
  rae_vald: [24.89, 59.35], rakvere_linn: [26.36, 59.35], rakvere_vald: [26.44, 59.37], rapina_vald: [27.46, 58.10],
  rapla_vald: [24.79, 59.00], rouge_vald: [26.92, 57.73], ruhnu_vald: [23.25, 57.80], saarde_vald: [24.96, 58.15],
  saaremaa_vald: [22.55, 58.30], saku_vald: [24.67, 59.30], saue_vald: [24.55, 59.32], setomaa_vald: [27.64, 57.96],
  sillamae_linn: [27.76, 59.40], tallinn: [24.75, 59.44], tapa_vald: [25.96, 59.26], tartu_linn: [26.72, 58.38],
  tartu_vald: [26.78, 58.43], tori_vald: [24.82, 58.48], torva_vald: [25.93, 58.00], turi_vald: [25.43, 58.81],
  vaike_maarja_vald: [26.25, 59.13], valga_vald: [26.10, 57.82], viimsi_vald: [24.83, 59.50], viljandi_linn: [25.59, 58.36],
  viljandi_vald: [25.48, 58.40], vinni_vald: [26.43, 59.30], viru_nigula_vald: [26.53, 59.49], vormsi_vald: [23.25, 59.00],
  voru_linn: [27.02, 57.83], voru_vald: [27.05, 57.87],
});

const MAP = Object.freeze({ width: 1600, height: 1075, west: 21.83, east: 28.21, north: 59.68, south: 57.51,
  left: 21.69, right: 1586.25, top: 39.44, bottom: 1067.56 });

/* The pin of a municipality as a share of the map's width and height (0..1), or null for one not in the table. */
export function municipalityPoint(region) {
  const centre = CENTRES[region];
  if (!centre) return null;
  const [lon, lat] = centre;
  const x = MAP.left + (lon - MAP.west) / (MAP.east - MAP.west) * (MAP.right - MAP.left);
  const y = MAP.top + (MAP.north - lat) / (MAP.north - MAP.south) * (MAP.bottom - MAP.top);
  return { x: x / MAP.width, y: y / MAP.height };
}

export const MAP_ASPECT = MAP.width / MAP.height;

/* The same pin on the small brand map (estoniaIcon.js), as a share of its view box: the outline's point mapped onto the
   icon's landmass (the islands by their own boxes, Muhu with Saaremaa and Vormsi with Hiiumaa, so their pins stand in
   the sea beside them, as Kihnu's and Ruhnu's do). Narva, on the border line, is moved a little inland. */
const ICON_LANDS = Object.freeze({
  mainland: [0.0156993, 5.92190, 0.0156939, 12.43630],
  saaremaa: [0.0161046, 4.42063, 0.0158845, 11.47664],
  hiiumaa: [0.0163568, 5.12920, 0.0161944, 10.70892],
});
const ICON_LAND_OF = Object.freeze({ saaremaa_vald: "saaremaa", muhu_vald: "saaremaa", hiiumaa_vald: "hiiumaa", vormsi_vald: "hiiumaa" });
const ICON_OVERRIDES = Object.freeze({ narva_linn: [30.4, 15.35] });

export function iconPoint(region, view) {
  const point = municipalityPoint(region);
  if (!point) return null;
  const [ax, bx, ay, by] = ICON_LANDS[ICON_LAND_OF[region] || "mainland"];
  const [x, y] = ICON_OVERRIDES[region] || [ax * point.x * MAP.width + bx, ay * point.y * MAP.height + by];
  return { x: (x - view.x) / view.width, y: (y - view.y) / view.height };
}
export const MUNICIPALITY_REGIONS = Object.freeze(Object.keys(CENTRES));
