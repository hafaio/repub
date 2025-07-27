import eslint from "@eslint/js";
import next from "@next/eslint-plugin-next";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import spellcheck from "eslint-plugin-spellcheck";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      spellcheck,
      react,
      "react-hooks": reactHooks,
      "@next/next": next,
    },
    rules: {
      ...react.configs["jsx-runtime"].rules,
      //...reactHooks.configs.recommended.rules,
      //...next.configs.recommended.rules,
      ...next.configs["core-web-vitals"].rules,
      "no-warning-comments": [
        "warn",
        {
          terms: ["fixme"],
        },
      ],
      "no-control-regex": "off",
      "@typescript-eslint/no-inferrable-types": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-deprecated": "off",
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        { allowNumber: true },
      ],
      "spellcheck/spell-checker": [
        "error",
        {
          identifiers: false,
          skipWords: [
            "doctype",
            "epub",
            "epubs",
            "hacky",
            "href",
            "latin",
            "Markable",
            "mhtml",
            "nextjs",
            "offscreen",
            "repub",
            "srcset",
          ],
          minLength: 4,
        },
      ],
    },
  },
);
