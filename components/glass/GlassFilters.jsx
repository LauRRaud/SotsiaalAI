/**
 * GlassFilters — liquid glass'i SERVA-REFRAKTSIOON ("bend", tellija
 * 07.07 iOS-etaloni järgi): feDisplacementMap painutab klaasi taga
 * olevat tausta serva lähedal nagu paks lääts; keskosa jääb neutraalseks.
 * Kaart (nihkekaart): R-kanal = X-nihe (horisontaalne ramp), G = Y-nihe
 * (vertikaalne ramp), feBlend screen liidab kanalid; radiaalne
 * neutraal-kate hoiab keskme paigal. Peale murret: härmatis (blur) +
 * kerge küllastus/heledus (sama maht mis nuppude senisel blur-retseptil).
 * Viidatakse CSS-ist: backdrop-filter: url(#lg-bend) — AINULT Chromium
 * (Safari/Firefox loevad url() vigaseks ja kaskaad jätab kehtima
 * eelneva tavalise bluri; vt glass.css).
 */

const MAP_R =
  "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='256'%20height='256'%3E%3ClinearGradient%20id='g'%20x1='0'%20y1='0'%20x2='1'%20y2='0'%3E%3Cstop%20offset='0'%20stop-color='%23ff0000'/%3E%3Cstop%20offset='1'%20stop-color='%23000000'/%3E%3C/linearGradient%3E%3Crect%20width='256'%20height='256'%20fill='url(%23g)'/%3E%3C/svg%3E";
const MAP_G =
  "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='256'%20height='256'%3E%3ClinearGradient%20id='g'%20x1='0'%20y1='0'%20x2='0'%20y2='1'%3E%3Cstop%20offset='0'%20stop-color='%2300ff00'/%3E%3Cstop%20offset='1'%20stop-color='%23000000'/%3E%3C/linearGradient%3E%3Crect%20width='256'%20height='256'%20fill='url(%23g)'/%3E%3C/svg%3E";
const MAP_CENTER =
  "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='256'%20height='256'%3E%3CradialGradient%20id='c'%20cx='0.5'%20cy='0.5'%20r='0.5'%3E%3Cstop%20offset='0.45'%20stop-color='%23808000'%20stop-opacity='1'/%3E%3Cstop%20offset='1'%20stop-color='%23808000'%20stop-opacity='0'/%3E%3C/radialGradient%3E%3Crect%20width='256'%20height='256'%20fill='url(%23c)'/%3E%3C/svg%3E";

export default function GlassFilters() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="0"
      height="0"
      style={{ position: "absolute", overflow: "hidden" }}
    >
      <filter
        id="lg-bend"
        x="-15%"
        y="-15%"
        width="130%"
        height="130%"
        colorInterpolationFilters="sRGB"
      >
        <feImage href={MAP_R} x="0%" y="0%" width="100%" height="100%" preserveAspectRatio="none" result="mr" />
        <feImage href={MAP_G} x="0%" y="0%" width="100%" height="100%" preserveAspectRatio="none" result="mg" />
        <feBlend in="mr" in2="mg" mode="screen" result="rg" />
        <feImage href={MAP_CENTER} x="0%" y="0%" width="100%" height="100%" preserveAspectRatio="none" result="ct" />
        <feComposite in="ct" in2="rg" operator="over" result="map" />
        <feDisplacementMap
          in="SourceGraphic"
          in2="map"
          scale="14"
          xChannelSelector="R"
          yChannelSelector="G"
          result="bent"
        />
        <feGaussianBlur in="bent" stdDeviation="16" result="frost" />
        <feColorMatrix in="frost" type="saturate" values="1.35" result="sat" />
        <feComponentTransfer in="sat">
          <feFuncR type="linear" slope="1.05" />
          <feFuncG type="linear" slope="1.05" />
          <feFuncB type="linear" slope="1.05" />
        </feComponentTransfer>
      </filter>
    </svg>
  );
}
