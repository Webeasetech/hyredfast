import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

/** @type {import('eslint').Linter.Config[]} */
const eslintConfig = [
  {
    ignores: [".next/**", "node_modules/**"],
  },
  ...nextCoreWebVitals,
  {
    rules: {
      // Next 16's preset promotes the React-Compiler-aware rules to errors.
      // The codebase has ~18 long-standing sync-props-to-state /
      // mounted-flag effects that predate this; they are real cleanup targets
      // but not regressions, so they warn instead of failing CI while they
      // are burned down incrementally.
      "react-hooks/set-state-in-effect": "warn",
      // Same story for the one useEvent-style ref shim in add-leads-chat.
      "react-hooks/refs": "warn",
    },
  },
];

export default eslintConfig;
