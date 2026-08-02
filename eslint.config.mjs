import { defineConfig } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import unusedImports from "eslint-plugin-unused-imports";

export default defineConfig([
  ...nextCoreWebVitals,
  {
    ignores: [
      ".next/**",
      /* PESASTATUD build-artefaktid. `.next/**` katab ainult juurkausta oma;
         `.claude/worktrees/<nimi>/.next/**` jäi katmata ja `eslint .` luges
         sisse tuhandeid minifitseeritud node_modules-tuekke. Kogu repo
         lint-vaerav oli seetoettu 923 veaga punane, millest ueheski ei olnud
         midagi kirjutatud. */
      "**/.next/**",
      ".claude/**",
      "node_modules/**",
      "out/**",
      "dist/**",
      "build/**",
      "coverage/**",
      "generated/**",
      "public/vendor/**",
      "tmp/**",
    ],
  },
  {
    files: ["**/*.{js,jsx,mjs,cjs}"],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  {
    files: [
      "app/api/**/*.js",
      "lib/**/*.js",
      "auth.js",
      "next.config.mjs",
      "public/sw.js",
    ],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
  },
  {
    plugins: {
      "react-hooks": reactHooks,
      "unused-imports": unusedImports,
    },
    rules: {
      /* Puuduv import on VAIKNE viga: kood tõlgib ja käivitub, aga plahvatab
         alles siis, kui see haru päriselt läbitakse. Nii jõudis teenuspäeviku
         marsruuti `localeFromRequest(req)` ilma impordita — kõik testid olid
         rohelised, sest catch-haru ei jooksnud kunagi, ja viga tuli välja alles
         brauseris esimese päris tõrke ajal. Sisselülitamine maksis kogu repos
         2 viga, mõlemad surnud koodis (`lib/help/chatWorkflow.js` pargitud
         browse/connect-käsitlejad) — see kood on nüüd kustutatud, repo on
         puhas. */
      "no-undef": "error",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
      "no-unused-vars": "off",
      "no-empty": ["warn", { allowEmptyCatch: true }],
      "no-console": "off",
      "no-debugger": "warn",
      "no-useless-escape": "warn",
      "no-control-regex": "warn",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/immutability": "off",
      "react-hooks/refs": "off",
      "react-hooks/unsupported-syntax": "warn",
      "react-hooks/preserve-manual-memoization": "off",
    },
  },
  {
    rules: {
      "no-restricted-syntax": [
        "warn",
        {
          selector: "JSXText[value=/[A-Za-zÀ-ÖØ-öø-ÿ0-9]/]",
          message: "Hardcoded UI string detected. Use translations.",
        },
      ],
    },
  },
  {
    files: [
      "app/admin/**/*.{js,jsx,ts,tsx}",
      "components/admin/**/*.{js,jsx,ts,tsx}",
      "components/alalehed/ChatBody.jsx",
      "components/HomeSections/HomeAboutSection.jsx",
      "components/alalehed/chat/ChatAnalysisPanel.jsx",
      "components/brand/LogoExportStage.jsx",
      "tests/**/*",
      "**/*.test.*",
    ],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  {
    files: ["eslint.config.mjs", "tailwind.config.js"],
    rules: {
      "import/no-anonymous-default-export": "off",
    },
  },
]);
