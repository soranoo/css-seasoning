import type { ConversionTables } from "@/types.ts";

import {
  assertEquals,
  assertNotEquals,
  assertObjectMatch,
} from "jsr:@std/assert";
import { initTransform, transform } from "@/transformer.ts";

await initTransform();

Deno.test("transform - hash mode (default)", () => {
  const input = `
    :root { 
      --custom-prop: value; 
      --another-prop: value;
    }
    .test { color: var(--custom-prop); } 
    .another-test { background: var(--another-prop); }
  `;
  const result = transform({
    css: input,
    lightningcssOptions: { minify: false },
  });

  // Basic transformation checks
  assertNotEquals(result.css, input);
  assertEquals(typeof result.css, "string");

  // Conversion tables check
  INTERNAL_assertConversionTable(result.conversionTables.selectors, 2);
  INTERNAL_assertConversionTable(result.conversionTables.idents, 2);

  // Consistent hashing check
  const secondResult = transform({
    css: input,
    lightningcssOptions: { minify: false },
  });
  assertEquals(result.css, secondResult.css);

  // TODO: Missing check for the actual hash values in the output
});

Deno.test("transform - minimal mode", () => {
  const input = `
    :root { 
      --custom-prop: value; 
      --another-prop: value;
    }
    .test { color: var(--custom-prop); } 
    .another-test { background: var(--another-prop); }
  `;
  const expectedOutput = `
    :root { --a: value; --b: value; }
    .c { color: var(--a); } 
    .d { background: var(--b); }
  `;
  const result = transform({
    css: input,
    mode: "minimal",
    lightningcssOptions: { minify: false },
  });

  // Check if using alphabetical naming
  INTERNAL_assertCss(result.css, expectedOutput);

  INTERNAL_assertConversionTable(result.conversionTables.selectors, 2);
  INTERNAL_assertConversionTable(result.conversionTables.idents, 2);
});

Deno.test("transform - debug mode", () => {
  const debugSymbol = "__DEBUG__";
  const prefix = "prefix-";
  const suffix = "-suffix";

  const input = `
    :root { --custom-prop: value; }
    .test { color: var(--custom-prop); }
  `;
  const expectedOutput = `
    :root { --${debugSymbol}${prefix}custom-prop${suffix}: value; }
    .${debugSymbol}${prefix}\\.test${suffix} { color: var(--${debugSymbol}${prefix}custom-prop${suffix}); }
  `;

  const result = transform({
    css: input,
    mode: "debug",
    debugSymbol,
    prefix,
    suffix,
    lightningcssOptions: { minify: false },
  });

  // Check if debug format is correct
  INTERNAL_assertCss(result.css, expectedOutput);

  // Check if new conversion tables are created
  INTERNAL_assertConversionTable(
    result.conversionTables.selectors,
    1,
  );
  INTERNAL_assertConversionTable(
    result.conversionTables.idents,
    1,
  );
});

Deno.test("transform - custom seed in hash mode", () => {
  const input = ".test { color: red; }";
  const seed1Result = transform({
    css: input,
    seed: 1,
    lightningcssOptions: { minify: false },
  });
  const seed1Result2 = transform({
    css: input,
    seed: 1,
    lightningcssOptions: { minify: false },
  });
  const seed2Result = transform({
    css: input,
    seed: 2,
    lightningcssOptions: { minify: false },
  });

  // Check if the same seed produces the same output
  assertEquals(seed1Result.css, seed1Result2.css);

  // Different seeds should produce different outputs
  assertNotEquals(seed1Result.css, seed2Result.css);
});

Deno.test("transform - preserves conversion tables", () => {
  const existingTables = {
    selectors: {
      "\\.existing": "\\.preserved-class",
      "\\.existing-2": "\\.preserved-class-2 \\#preserved-id",
    },
    idents: { "existing-var": "preserved-var" },
  } satisfies ConversionTables;
  const input = `
    :root { --existing-var: value; --other-var: value; }
    .test { color: var(--other-var); } 
    .existing { color: var(--existing-var); }
    .existing-2 { color: red; }
  `;
  const expectedOutput = `
    :root { --preserved-var: value; --a: value; }
    .b { color: var(--a); } 
    .preserved-class { color: var(--preserved-var); }
    .preserved-class-2 #preserved-id { color: red; }
  `;

  const result = transform({
    css: input,
    mode: "minimal",
    conversionTables: existingTables,
    lightningcssOptions: { minify: false },
  });

  // Check if existing mappings are preserved
  assertEquals(
    result.conversionTables.selectors[
      Object.keys(existingTables.selectors)[0]
    ],
    Object.values(existingTables.selectors)[0],
  );
  assertEquals(
    result.conversionTables.idents[
      Object.keys(existingTables.idents)[0]
    ],
    Object.values(existingTables.idents)[0],
  );
  INTERNAL_assertCss(result.css, expectedOutput);

  // Check if new mappings are added
  INTERNAL_assertConversionTable(
    result.conversionTables.selectors,
    3,
  );
  INTERNAL_assertConversionTable(
    result.conversionTables.idents,
    2,
  );
});

Deno.test("transform - handles custom properties", () => {
  const input = ".test { --custom-prop: value; }";
  const result = transform({
    css: input,
    lightningcssOptions: { minify: false },
  });

  // Check if custom properties are transformed
  assertNotEquals(result.css.match(/--[a-f0-9]+/)?.[0], "--custom-prop");
});

Deno.test("transform - handles complex selectors", () => {
  const input = ".test:not(.other):where(.something) { color: red; }";
  const expectedOutput = `
    .a:not(.b):where(.c) { color: red; }
  `;

  const result = transform({
    css: input,
    mode: "minimal",
    lightningcssOptions: { minify: false },
  });

  // Check if the output is different but valid
  INTERNAL_assertCss(result.css, expectedOutput);
  INTERNAL_assertConversionTable(result.conversionTables.selectors, 3);
  INTERNAL_assertConversionTable(result.conversionTables.idents, 0);
});

Deno.test("transform - handles basic selectors", () => {
  const input = `
    div { color: red; }
    #myId { color: #00f; }
    .myClass { color: green; }
    * { box-sizing: border-box; }
  `;
  const expectedOutput = `
    div { color: red; }
    #a { color: #00f; }
    .b { color: green; }
    * { box-sizing: border-box; }
  `;
  const expectedConversionTable: ConversionTables = {
    selectors: {
      "\\#myId": "\\#a",
      "\\.myClass": "\\.b",
    },
    idents: {},
  };

  const result = transform({
    css: input,
    mode: "minimal",
    lightningcssOptions: { minify: false },
  });

  INTERNAL_assertCss(result.css, expectedOutput);

  assertObjectMatch(
    result.conversionTables.selectors,
    expectedConversionTable.selectors,
  );
  assertObjectMatch(
    result.conversionTables.idents,
    expectedConversionTable.idents,
  );
});

Deno.test("transform - handles pseudo-classes", () => {
  const input = `
    :nth-child(2n) { background: #00f; }
    :nth-last-child(odd) { margin-bottom: 10px; }
    .item:not(.active) { opacity: 0.5; }
    .menu:where(.dropdown, .popup) { position: relative; }
    .section:is(.important, .highlight) { border: 1px solid red; }
  `;
  const expectedOutput = `
    :nth-child(2n) { background: #00f; }
    :nth-last-child(odd) { margin-bottom: 10px; }
    .a:not(.b) { opacity: .5; }
    .c:where(.d, .e) { position: relative; }
    .f:is(.g, .h) { border: 1px solid red; }
  `;
  const expectedConversionTable: ConversionTables = {
    selectors: {
      "\\.item": "\\.a",
      "\\.active": "\\.b",
      "\\.menu": "\\.c",
      "\\.dropdown": "\\.d",
      "\\.popup": "\\.e",
      "\\.section": "\\.f",
      "\\.important": "\\.g",
      "\\.highlight": "\\.h",
    },
    idents: {},
  };

  const result = transform({
    css: input,
    mode: "minimal",
    lightningcssOptions: { minify: false },
  });

  INTERNAL_assertCss(result.css, expectedOutput);

  // Function-like pseudo-classes should not be converted, but class selectors should
  assertObjectMatch(
    result.conversionTables.selectors,
    expectedConversionTable.selectors,
  );
  assertObjectMatch(
    result.conversionTables.idents,
    expectedConversionTable.idents,
  );
});

Deno.test("transform - handles host pseudo-class", () => {
  const input = `
    :host { display: block; }
    :host(.classname) { font-weight: bold; }
  `;
  const expectedOutput = `
    :host { display: block; }
    :host(.a) { font-weight: bold; }
  `;
  const expectedConversionTable: ConversionTables = {
    selectors: {
      "\\.classname": "\\.a",
    },
    idents: {},
  };

  const result = transform({
    css: input,
    mode: "minimal",
    lightningcssOptions: { minify: false },
  });

  INTERNAL_assertCss(result.css, expectedOutput);

  // Host selectors should be preserved
  assertObjectMatch(
    result.conversionTables.selectors,
    expectedConversionTable.selectors,
  );
  assertObjectMatch(
    result.conversionTables.idents,
    expectedConversionTable.idents,
  );
});

Deno.test("transform - handles attribute selectors", () => {
  const input = `
    [data-attr] { display: block; }
    [data-role="button"] { cursor: pointer; }
  `;
  const expectedOutput = `
    [data-attr] { display: block; }
    [data-role="button"] { cursor: pointer; }
  `;
  const expectedConversionTable: ConversionTables = {
    selectors: {},
    idents: {},
  };

  const result = transform({
    css: input,
    mode: "minimal",
    lightningcssOptions: { minify: false },
  });

  INTERNAL_assertCss(result.css, expectedOutput);

  // Attribute selectors should be preserved
  assertObjectMatch(
    result.conversionTables.selectors,
    expectedConversionTable.selectors,
  );
  assertObjectMatch(
    result.conversionTables.idents,
    expectedConversionTable.idents,
  );
});

Deno.test("transform - handles combinators", () => {
  const input = `
    .parent > .child { margin: 10px; }
    .sibling ~ .next-sibling { padding: 5px; }
  `;
  const expectedOutput = `
    .a > .b { margin: 10px; }
    .c ~ .d { padding: 5px; }
  `;
  const expectedConversionTable: ConversionTables = {
    selectors: {
      "\\.parent": "\\.a",
      "\\.child": "\\.b",
      "\\.sibling": "\\.c",
      "\\.next-sibling": "\\.d",
    },
    idents: {},
  };

  const result = transform({
    css: input,
    mode: "minimal",
    lightningcssOptions: { minify: false },
  });

  INTERNAL_assertCss(result.css, expectedOutput);

  // Each class selector should be converted
  assertObjectMatch(
    result.conversionTables.selectors,
    expectedConversionTable.selectors,
  );
  assertObjectMatch(
    result.conversionTables.idents,
    expectedConversionTable.idents,
  );
});

Deno.test("transform - handles multiple complex selectors", () => {
  const input = `
    .complex:not(.simple):where(.advanced) { 
      border: 2px solid black; 
    }
  `;
  const expectedOutput = `
    .a:not(.b):where(.c) { 
      border: 2px solid #000; 
    }
  `;
  const expectedConversionTable: ConversionTables = {
    selectors: {
      "\\.complex": "\\.a",
      "\\.simple": "\\.b",
      "\\.advanced": "\\.c",
    },
    idents: {},
  };

  const result = transform({
    css: input,
    mode: "minimal",
    lightningcssOptions: { minify: false },
  });

  INTERNAL_assertCss(result.css, expectedOutput);

  // Should convert all three class selectors
  assertObjectMatch(
    result.conversionTables.selectors,
    expectedConversionTable.selectors,
  );
  assertObjectMatch(
    result.conversionTables.idents,
    expectedConversionTable.idents,
  );
});

Deno.test("transform - handles custom properties in :root", () => {
  const input = `
    :root {
      --main-color: purple;
      --accent-color: orange;
    }
  `;
  const expectedOutput = `
    :root {
      --a: purple;
      --b: orange;
    }
  `;
  const expectedConversionTable: ConversionTables = {
    selectors: {},
    idents: {
      "main-color": "a",
      "accent-color": "b",
    },
  };

  const result = transform({
    css: input,
    mode: "minimal",
    lightningcssOptions: { minify: false },
  });

  INTERNAL_assertCss(result.css, expectedOutput);

  // Should convert both custom properties
  assertObjectMatch(
    result.conversionTables.selectors,
    expectedConversionTable.selectors,
  );
  assertObjectMatch(
    result.conversionTables.idents,
    expectedConversionTable.idents,
  );
});

Deno.test("transform - ignores selector patterns", () => {
  const input = `
    :root { 
      --main-color: purple;
      --theme-color: orange;
      --accent-color: green;
    }
    .button { color: var(--main-color); }
    .btn-primary { color: var(--theme-color); }
    #header { background: var(--accent-color); }
  `;

  const expectedOutput = `
    :root { 
      --a: purple;
      --b: orange;
      --c: green;
    }
    .d { color: var(--a); }
    .btn-primary { color: var(--b); }
    #e { background: var(--c); }
  `;

  // Test ignoring selector patterns
  const result = transform({
    css: input,
    mode: "minimal",
    ignorePatterns: {
      selectors: ["^btn-"],
    },
    lightningcssOptions: { minify: false },
  });

  INTERNAL_assertCss(result.css, expectedOutput);

  // Verify that btn-primary is not in the conversion table
  assertEquals(
    Object.keys(result.conversionTables.selectors).some((key) =>
      key.includes("btn-primary")
    ),
    false,
  );
});

Deno.test("transform - ignores ident patterns", () => {
  const input = `
    :root { 
      --main-color: purple;
      --theme-color: orange;
      --accent-color: green;
    }
    .button { color: var(--main-color); }
    .btn-primary { color: var(--theme-color); }
    #header { background: var(--accent-color); }
  `;

  const expectedOutput = `
    :root { 
      --a: purple;
      --theme-color: orange;
      --b: green;
    }
    .c { color: var(--a); }
    .d { color: var(--theme-color); }
    #e { background: var(--b); }
  `;

  const result = transform({
    css: input,
    mode: "minimal",
    ignorePatterns: {
      idents: ["^theme-"],
    },
    lightningcssOptions: { minify: false },
  });

  INTERNAL_assertCss(result.css, expectedOutput);

  // Verify that theme-color is not in the conversion table
  assertEquals(
    Object.keys(result.conversionTables.idents).some((key) =>
      key === "theme-color"
    ),
    false,
  );
});

Deno.test("transform - ignores both selector and ident patterns", () => {
  const input = `
    :root { 
      --main-color: purple;
      --theme-color: orange;
      --accent-color: green;
    }
    .button { color: var(--main-color); }
    .btn-primary { color: var(--theme-color); }
    #header { background: var(--accent-color); }
  `;

  const expectedOutput = `
    :root { 
      --a: purple;
      --theme-color: orange;
      --b: green;
    }
    .c { color: var(--a); }
    .btn-primary { color: var(--theme-color); }
    #d { background: var(--b); }
  `;

  const result = transform({
    css: input,
    mode: "minimal",
    ignorePatterns: {
      selectors: ["^btn-"],
      idents: ["^theme-"],
    },
    lightningcssOptions: { minify: false },
  });

  INTERNAL_assertCss(result.css, expectedOutput);

  // Verify that neither btn-primary nor theme-color are in their respective conversion tables
  assertEquals(
    Object.keys(result.conversionTables.selectors).some((key) =>
      key.includes("btn-primary")
    ),
    false,
  );
  assertEquals(
    Object.keys(result.conversionTables.idents).some((key) =>
      key === "theme-color"
    ),
    false,
  );
});

Deno.test("transform - ignores patterns using RegExp objects", () => {
  const input = `
    :root { 
      --main-color: purple;
      --theme-color: orange;
      --accent-color: green;
    }
    .button { color: var(--main-color); }
    .btn-primary { color: var(--theme-color); }
    #header { background: var(--accent-color); }
  `;

  const expectedOutput = `
    :root { 
      --a: purple;
      --theme-color: orange;
      --accent-color: green;
    }
    .b { color: var(--a); }
    .btn-primary { color: var(--theme-color); }
    #header { background: var(--accent-color); }
  `;

  const result = transform({
    css: input,
    mode: "minimal",
    ignorePatterns: {
      selectors: [/^btn-/, /header$/],
      idents: [/^theme-/, /accent/],
    },
    lightningcssOptions: { minify: false },
  });

  INTERNAL_assertCss(result.css, expectedOutput);

  // Verify which items should be in the conversion tables and which should not
  assertEquals(
    Object.keys(result.conversionTables.selectors).some((key) =>
      key.includes("btn-primary")
    ),
    false,
  );
  assertEquals(
    Object.keys(result.conversionTables.selectors).some((key) =>
      key.includes("header")
    ),
    false,
  );
  assertEquals(
    Object.keys(result.conversionTables.idents).some((key) =>
      key === "theme-color"
    ),
    false,
  );
  assertEquals(
    Object.keys(result.conversionTables.idents).some((key) =>
      key === "accent-color"
    ),
    false,
  );
});

Deno.test("transform - ignores patterns with mixed string and RegExp", () => {
  const input = `
    :root { 
      --main-color: purple;
      --theme-color: orange;
      --brand-color: yellow;
    }
    .button { color: var(--main-color); }
    .btn-primary { color: var(--theme-color); }
    .brand-logo { background: var(--brand-color); }
  `;

  const expectedOutput = `
    :root { 
      --a: purple;
      --theme-color: orange;
      --brand-color: yellow;
    }
    .b { color: var(--a); }
    .btn-primary { color: var(--theme-color); }
    .c { background: var(--brand-color); }
  `;

  const result = transform({
    css: input,
    mode: "minimal",
    ignorePatterns: {
      selectors: ["^btn-"], // String pattern
      idents: [/^(theme|brand)-/], // RegExp pattern
    },
    lightningcssOptions: { minify: false },
  });

  INTERNAL_assertCss(result.css, expectedOutput);

  // Check both string and RegExp pattern matches
  assertEquals(
    Object.keys(result.conversionTables.idents).includes("theme-color"),
    false,
  );
  assertEquals(
    Object.keys(result.conversionTables.idents).includes("brand-color"),
    false,
  );
  assertEquals(
    Object.keys(result.conversionTables.selectors).some((key) =>
      key.includes("btn-primary")
    ),
    false,
  );
});

Deno.test("transform - ignores patterns with array format (not object)", () => {
  const input = `
    :root { 
      --main-color: purple;
      --theme-color: orange;
      --accent-color: green;
    }
    .button { color: var(--main-color); }
    .btn-primary { color: var(--theme-color); }
    .theme-button { background: var(--accent-color); }
  `;

  const expectedOutput = `
    :root { 
      --a: purple;
      --theme-color: orange;
      --b: green;
    }
    .c { color: var(--a); }
    .btn-primary { color: var(--theme-color); }
    .theme-button { background: var(--b); }
  `;

  const result = transform({
    css: input,
    mode: "minimal",
    // Pass an array directly instead of an object with selectors/idents properties
    ignorePatterns: ["^btn-", "^theme-"],
    lightningcssOptions: { minify: false },
  });

  INTERNAL_assertCss(result.css, expectedOutput);
});

/**
 * Removes all spaces from a string.
 *
 * @param str - The string to remove spaces from.
 * @returns The string without spaces.
 *
 * @example
 * ```ts
 * const str = "Hello World!";
 * const noSpaces = INTERNAL_removeAllSpaces(str); // "HelloWorld!"
 * ```
 */
const INTERNAL_removeAllSpaces = (str: string) => str.replace(/\s+/g, "");

/**
 * Asserts that the given CSS string matches
 * the expected CSS string after removing all spaces.
 *
 * @param css - The CSS string to compare.
 * @param expected - The expected CSS string.
 *
 * @example
 * ```ts
 * const css = ".test { color: red; }";
 * const expected = ".test{color:red;}";
 * INTERNAL_assertCss(css, expected); // Passes
 * ```
 */
const INTERNAL_assertCss = (css: string, expected: string) => {
  const normalizedCss = INTERNAL_removeAllSpaces(css);
  const normalizedExpected = INTERNAL_removeAllSpaces(expected);
  assertEquals(normalizedCss, normalizedExpected);
};

/**
 * Asserts that the conversion table has the expected number of entries.
 *
 * @param conversionTable - The conversion table to check.
 * @param expectedNumberOfEntries - The expected number of entries in the conversion table.
 *
 * @example
 * ```ts
 * const conversionTable = { ".test": ".a", "#id": "#b" };
 * INTERNAL_assertConversionTable(conversionTable, 2); // Passes
 * ```
 */
const INTERNAL_assertConversionTable = (
  conversionTable: Record<string, string>,
  expectedNumberOfEntries: number,
) => {
  assertEquals(Object.keys(conversionTable).length, expectedNumberOfEntries);
};
