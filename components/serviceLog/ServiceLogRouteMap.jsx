"use client";

/**
 * TEENUSPÄEVIK E11 — PÄEVATEEKOND KAARDIL.
 *
 * MIDA SEE KAART NÄITAB: kus tänased külastused ON ja MIS JÄRJEKORRAS neid
 * tehakse. Number markeril = koht järjekorras.
 *
 * MIDA TA EI NÄITA JA EI HAKKA NÄITAMA: töötaja liikuvat punkti. Leping
 * (E11): „Kaart näitab teenusekohti ja kinnitatud külastusolekuid, mitte
 * töötaja pidevalt liikuvat punkti." See ei ole tehniline piirang, vaid kogu
 * meie eristus logistikakesksest lahendusest.
 *
 * PUNKTID TULEVAD AADRESSIST, MITTE SEADMEST. Kaardil on koht, kuhu MINNAKSE
 * (Maa-ameti aadressiregister), mitte koht, kus keegi mõõdeti. Nii ei muutu
 * kaart kunagi kogemata jälitusvahendiks: temal ei ole ühtegi mõõdetud punkti.
 *
 * MIKS ISE, MITTE `ServiceMapLeaflet`: too komponent on ehitatud
 * `ServiceMapEntry` kuju ja avaliku teenusekaardi loogika peale (juurdepääsu-
 * teed, kättesaadavus, filtrid). Siin on vaja kümmet nummerdatud punkti ja
 * joont nende vahel. Ühine on ainult see, mis peabki ühine olema: ISE
 * MAJUTATUD Leaflet ja Maa-ameti paanid.
 */

import { useEffect, useMemo, useRef } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";

/* Sama allikas mis teenusekaardil: ise majutatud, mitte CDN-ist. */
const LEAFLET_SCRIPT_URL = "/vendor/leaflet/leaflet.js";
const LEAFLET_CSS_URL = "/vendor/leaflet/leaflet.css";
const TILE_URL =
  "https://tiles.maaamet.ee/tm/tms/1.0.0/hallkaart@GMC/{z}/{x}/{y}.png&ASUTUS=SOTSIAALAI&KESKKOND=LIVE&IS=TEENUSPAEVIK";
const ATTRIBUTION = "Maa- ja Ruumiamet";

let leafletPromise = null;

/** Laeb Leafleti ÜKS KORD lehe eluea jooksul, ka mitme kaardi puhul. */
function loadLeaflet() {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;

  leafletPromise = new Promise((resolve) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS_URL}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = LEAFLET_CSS_URL;
      document.head.appendChild(link);
    }
    const script = document.createElement("script");
    script.src = LEAFLET_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve(window.L || null);
    /* Kaart on lisavaade, mitte töö eeldus: laadimise tõrge annab `null` ja
       päev töötab edasi ilma temata. */
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
  return leafletPromise;
}

const STATUS_COLOR = {
  COMPLETED: "#5fd08a",
  ARRIVED: "#7fd1ff",
  EN_ROUTE: "#7fd1ff",
  CANCELLED: "#ff9a9a",
  NOT_DONE: "#ff9a9a",
  NEEDS_CORRECTION: "#ffcd78"
};

export default function ServiceLogRouteMap({ visits = [] }) {
  const { t } = useI18n();
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  const points = useMemo(
    () =>
      visits
        .map((visit, index) => ({ visit, index }))
        .filter(
          ({ visit }) =>
            Number.isFinite(Number(visit.addressLat)) && Number.isFinite(Number(visit.addressLng))
        ),
    [visits]
  );

  /* Sõltuvuseks on markerite SISU, mitte massiivi identiteet: iga render annab
     uue massiivi ja ilma selleta joonistaks kaart end lõputult uuesti. */
  const signature = useMemo(
    () => points.map((item) => `${item.visit.id}:${item.visit.status}:${item.visit.addressLat}`).join("|"),
    [points]
  );

  useEffect(() => {
    if (!points.length || !containerRef.current) return undefined;
    let cancelled = false;

    loadLeaflet().then((L) => {
      if (cancelled || !L || !containerRef.current) return;

      if (!mapRef.current) {
        mapRef.current = L.map(containerRef.current, {
          /* Kerimine hiirerattaga varastaks lehe kerimise telefonis — kaart on
             siin ülevaade, mitte peamine tööpind. */
          scrollWheelZoom: false,
          attributionControl: true
        });
        L.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: 18 }).addTo(mapRef.current);
      }

      if (layerRef.current) layerRef.current.remove();
      layerRef.current = L.layerGroup().addTo(mapRef.current);

      const latLngs = [];
      for (const { visit, index } of points) {
        const latLng = [Number(visit.addressLat), Number(visit.addressLng)];
        latLngs.push(latLng);
        const color = STATUS_COLOR[visit.status] || "#c9c9c9";
        L.marker(latLng, {
          icon: L.divIcon({
            className: "sl-map-pin",
            html: `<span style="--pin:${color}">${index + 1}</span>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13]
          })
        })
          .bindPopup(`${index + 1}. ${visit.clientDisplayName || ""}<br>${visit.address || ""}`)
          .addTo(layerRef.current);
      }

      /* JOON JÄRJEKORRAS, mitte tee peal: ta ütleb „siit sinna", mitte „seda
         teed mööda". Marsruudimootorit siin ei ole. */
      if (latLngs.length > 1) {
        L.polyline(latLngs, { color: "#7fd1ff", weight: 2, opacity: 0.6, dashArray: "4 6" }).addTo(
          layerRef.current
        );
      }

      mapRef.current.fitBounds(L.latLngBounds(latLngs), { padding: [28, 28], maxZoom: 14 });
    });

    return () => {
      cancelled = true;
    };
    /* eslint-disable-next-line react-hooks/exhaustive-deps -- `points` muutub
       identiteedilt iga renderiga; sisu jälgib `signature`. */
  }, [signature]);

  useEffect(
    () => () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    },
    []
  );

  /* ILMA KOORDINAATIDETA EI OLE KAARTI. Tühi hall kast õpetaks kasutajale, et
     funktsioon on katki — parem ei ole teda üldse. */
  if (!points.length) return null;

  return (
    <section className="sl-map">
      <h4 className="sl-list-title">{t("service_log.route.map", "")}</h4>
      <div ref={containerRef} className="sl-map-canvas" />
      <p className="sl-source">{t("service_log.route.map_note", "")}</p>
    </section>
  );
}
