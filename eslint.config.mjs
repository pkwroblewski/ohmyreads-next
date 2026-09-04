import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),

  // Server code must log through `lib/utils/log.ts`, not `console`.
  //
  // In production the logger emits structured JSON that a log aggregator can
  // search and that scrubs Postgres error internals; a raw `console.error`
  // emits unsearchable text and can leak constraint, column and policy names
  // into the log stream. This rule is what stops the 300+ call sites migrated
  // in task 24 from creeping back.
  //
  // Scoped to code that runs on the server. Browser components and the CLI
  // scripts under `scripts/` are deliberately not covered — see the plan's
  // Out of Scope table.
  {
    files: ["lib/**/*.{ts,tsx}", "app/**/*.{ts,tsx}"],
    rules: {
      "no-console": "error",
    },
  },

  // The logger itself is the one place console is the correct output: it is
  // the sink every other call site now routes through.
  {
    files: ["lib/utils/log.ts"],
    rules: {
      "no-console": "off",
    },
  },

  // Open Graph images are rendered by Satori (`next/og`), which only
  // understands a plain <img> and produces a PNG, so `next/image` and
  // `alt` text have no meaning there.
  {
    files: ["app/api/og/**/*.tsx"],
    rules: {
      "@next/next/no-img-element": "off",
      "jsx-a11y/alt-text": "off",
    },
  },
]);

export default eslintConfig;
