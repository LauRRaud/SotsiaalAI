const withBundleAnalyzer =
  process.env.ANALYZE === "true"
    ? (await import("@next/bundle-analyzer")).default({
        enabled: true,
      })
    : config => config;

/** @type {import('next').NextConfig} */
const baseConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  devIndicators: false,

  compiler: { styledComponents: true },

  /* Turbopacki dev-failivahemälu (.next/dev/cache/turbopack/*.sst) on Next 16-s
     vaikimisi peal ega paista evictionit tegevat: 26.07 kasvas .next 45 GB-ni,
     mis viis dev-kliendi lehe-taaslaadimise silmusesse ja masina kokkujooksmiseni.
     Väljas = aeglasem külmkäivitus, aga piiratud ketta- ja mälukasutus. */
  experimental: { turbopackFileSystemCacheForDev: false },

  images: {
    formats: ["image/avif", "image/webp"],
    domains: [],
  },

  // säilita turbopack config
  turbopack: {
    rules: {
      "*.svg": {
        loaders: ["@svgr/webpack"],
        as: "*.js",
      },
    },
  },

  async headers() {
    const headers = [
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      /* `geolocation=(self)`, MITTE `()`.
       *
       * `()` tähendab „mitte keegi, ka mitte meie ise" ja brauser keeldub
       * ENNE, kui jõuab kasutaja käest luba küsida — teade oli sõna-sõnalt
       * „Geolocation has been disabled in this document by permissions policy".
       * Teenuspäeviku asukohatempel (E2b, DoD 10) oli seetõttu surnud sünnist
       * saati: lipp oli sees, kood töötas, aga päis lõikas ta ära. Ükski test
       * ega serveripoolne stsenaarium ei saanud seda näha — päised puudutavad
       * ainult brauserit.
       *
       * `(self)` on kitsaim, mis funktsiooni üldse võimaldab: AINULT meie oma
       * päritolu, mitte ükski manustatud kolmas osapool. Kasutaja luba jääb
       * endiselt tema enda käest küsitavaks — päis ei anna asukohta, ta ainult
       * lõpetab keeldumise enne küsimist.
       *
       * `camera=()` jääb: kaamerat me ei kasuta. */
      { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(self)" },
    ];
    if (process.env.NODE_ENV === "production") {
      headers.push({
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains; preload",
      });
    }
    return [
      {
        source: "/:path*",
        headers,
      },
    ];
  },

  webpack(config, { dev: _dev, isServer: _isServer }) {
    // Add SVGR loader for SVG imports in JS/TS files
    // NOTE: using the package name string for the loader is ESM-safe (no require)
    config.module.rules.push({
      test: /\.svg$/i,
      issuer: /\.[jt]sx?$/,
      use: [
        {
          loader: "@svgr/webpack",
          options: {
            svgo: true,
            svgoConfig: {
              plugins: [
                {
                  name: "preset-default",
                  params: {
                    overrides: {
                      removeViewBox: false,
                    },
                  },
                },
                { name: "prefixIds" }, // avoid id collisions for gradients/defs
              ],
            },
            titleProp: true,
            ref: true,
          },
        },
      ],
    });

    return config;
  },
};

export default withBundleAnalyzer(baseConfig);
