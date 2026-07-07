import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

/**
 * Next.js 16 flat ESLint config for @fleetvolt/web.
 * eslint-config-next v16 ships flat-config arrays from its subpath exports.
 */
const config = [
  ...coreWebVitals,
  ...typescript,
  {
    ignores: [
      ".next/**",
      "convex/_generated/**",
      "node_modules/**",
      "next-env.d.ts",
    ],
  },
];

export default config;
