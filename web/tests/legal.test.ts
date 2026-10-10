import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// The app bundles copies of the policies from web/src/legal/ (Vite can't import
// from outside web/); docs/ holds the canonical versions GitHub renders. If the
// two ever drift, the in-app text and the repo text would disagree — fail loudly.
const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

describe("bundled legal copies match docs/", () => {
  for (const f of ["TERMS.md", "PRIVACY.md"]) {
    it(`${f} in web/src/legal is byte-identical to docs/${f}`, () => {
      expect(read(`../src/legal/${f}`)).toBe(read(`../../docs/${f}`));
    });
  }
});
