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
    .a { color: var(--a); } 
    .b { background: var(--b); }
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
  const stringSeedResult = transform({
    css: input,
    seed: "seed1", // Use a string seed
    lightningcssOptions: { minify: false },
  });
  const stringSeedResult2 = transform({
    css: input,
    seed: "seed1", // Same string seed
    lightningcssOptions: { minify: false },
  });
  const stringSeedResult3 = transform({
    css: input,
    seed: "seed2", // Different string seed
    lightningcssOptions: { minify: false },
  });

  // Check if the same numeric seed produces the same output
  assertEquals(seed1Result.css, seed1Result2.css);

  // Different numeric seeds should produce different outputs
  assertNotEquals(seed1Result.css, seed2Result.css);

  // Check if the same string seed produces the same output
  assertEquals(stringSeedResult.css, stringSeedResult2.css);

  // Different string seeds should produce different outputs
  assertNotEquals(stringSeedResult.css, stringSeedResult3.css);

  // Numeric seed 1 and string seed "seed1" should produce different outputs
  assertNotEquals(seed1Result.css, stringSeedResult.css);
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
    .a { color: var(--a); } 
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

Deno.test("transform - handles disabled pseudo-class", () => {
  const input = `
    .button:disabled { opacity: 0.5; }
    input:disabled { background: #eee; }
    .form-control:disabled + .helper { display: none; }
    button:disabled:hover { cursor: not-allowed; }
  `;
  const expectedOutput = `
    .a:disabled { opacity: .5; }
    input:disabled { background: #eee; }
    .b:disabled + .c { display: none; }
    button:disabled:hover { cursor: not-allowed; }
  `;
  const expectedConversionTable: ConversionTables = {
    selectors: {
      "\\.button": "\\.a",
      "\\.form-control": "\\.b",
      "\\.helper": "\\.c",
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

Deno.test("transform - handles first-child pseudo-class", () => {
  const input = `
    .list-item:first-child { margin-top: 0; }
    .nested:first-child:hover { background: #eee; }
  `;
  const expectedOutput = `
    .a:first-child { margin-top: 0; }
    .b:first-child:hover { background: #eee; }
  `;
  const expectedConversionTable: ConversionTables = {
    selectors: {
      "\\.list-item": "\\.a",
      "\\.nested": "\\.b",
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

Deno.test("transform - handles last-child pseudo-class", () => {
  const input = `
    .list-item:last-child { margin-bottom: 0; }
    .nested:last-child:hover { background: #eee; }
  `;
  const expectedOutput = `
    .a:last-child { margin-bottom: 0; }
    .b:last-child:hover { background: #eee; }
  `;
  const expectedConversionTable: ConversionTables = {
    selectors: {
      "\\.list-item": "\\.a",
      "\\.nested": "\\.b",
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

Deno.test("transform - handles nth-child pseudo-class", () => {
  const input = `
    :nth-child(2n) { background: #00f; }
    .item:nth-child(3) { margin: 10px; }
  `;
  const expectedOutput = `
    :nth-child(2n) { background: #00f; }
    .a:nth-child(3) { margin: 10px; }
  `;
  const expectedConversionTable: ConversionTables = {
    selectors: {
      "\\.item": "\\.a",
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

Deno.test("transform - handles focus-visible pseudo-class", () => {
  const input = `
    .button:focus-visible { outline: 2px solid blue; }
    .link:focus-visible:not(.disabled) { text-decoration: underline; }
    .input:focus-visible::placeholder { color: transparent; }
    .card:hover:focus-visible { transform: scale(1.02); }
  `;
  const expectedOutput = `
    .a:focus-visible { outline: 2px solid #00f; }
    .b:focus-visible:not(.c) { text-decoration: underline; }
    .d:focus-visible::placeholder { color: #0000; }
    .e:hover:focus-visible { transform: scale(1.02); }
  `;
  const expectedConversionTable: ConversionTables = {
    selectors: {
      "\\.button": "\\.a",
      "\\.link": "\\.b",
      "\\.disabled": "\\.c",
      "\\.input": "\\.d",
      "\\.card": "\\.e",
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

Deno.test("transform - handles nth-last-child pseudo-class", () => {
  const input = `
    :nth-last-child(odd) { margin-bottom: 10px; }
    .item:nth-last-child(2) { padding: 5px; }
  `;
  const expectedOutput = `
    :nth-last-child(odd) { margin-bottom: 10px; }
    .a:nth-last-child(2) { padding: 5px; }
  `;
  const expectedConversionTable: ConversionTables = {
    selectors: {
      "\\.item": "\\.a",
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

Deno.test("transform - handles not, where, is, and root pseudo-classes", () => {
  const input = `
    .item:not(.active) { opacity: 0.5; }
    .menu:where(.dropdown, .popup) { position: relative; }
    .section:is(.important, .highlight) { border: 1px solid red; }
    :root { display: block; }
  `;
  const expectedOutput = `
    .a:not(.b) { opacity: .5; }
    .c:where(.d, .e) { position: relative; }
    .f:is(.g, .h) { border: 1px solid red; }
    :root { display: block; }
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
  assertObjectMatch(
    result.conversionTables.selectors,
    expectedConversionTable.selectors,
  );
  assertObjectMatch(
    result.conversionTables.idents,
    expectedConversionTable.idents,
  );
});

Deno.test("transform - handles custom pseudo-classes", () => {
  const input = `
    .button::custom-state { background: blue; }
    .input::placeholder-shown { color: gray; }
    .card::--custom { transform: scale(1.1); }
    .element::--hover-focus:hover:focus { outline: 2px solid red; }
  `;
  const expectedOutput = `
    .a::custom-state { background: #00f; }
    .b::placeholder-shown { color: gray; }
    .c::--custom { transform: scale(1.1); }
    .d::--hover-focus:hover:focus { outline: 2px solid red; }
  `;
  const expectedConversionTable: ConversionTables = {
    selectors: {
      "\\.button": "\\.a",
      "\\.input": "\\.b",
      "\\.card": "\\.c",
      "\\.element": "\\.d",
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

Deno.test("transform - handles focus-within pseudo-class", () => {
  const input = `
    .form:focus-within { border-color: blue; }
    .nav-item:focus-within > .dropdown { display: block; }
    .menu:hover:focus-within { background: #eee; }
    .container:focus-within .item { color: blue; }
    .nested:focus-within:not(.disabled) { outline: 2px solid red; }
  `;
  const expectedOutput = `
    .a:focus-within { border-color: #00f; }
    .b:focus-within > .c { display: block; }
    .d:hover:focus-within { background: #eee; }
    .e:focus-within .f { color: #00f; }
    .g:focus-within:not(.h) { outline: 2px solid red; }
  `;
  const expectedConversionTable: ConversionTables = {
    selectors: {
      "\\.form": "\\.a",
      "\\.nav-item": "\\.b",
      "\\.dropdown": "\\.c",
      "\\.menu": "\\.d",
      "\\.container": "\\.e",
      "\\.item": "\\.f",
      "\\.nested": "\\.g",
      "\\.disabled": "\\.h",
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
    .a { color: var(--a); }
    .btn-primary { color: var(--b); }
    #b { background: var(--c); }
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
    .a { color: var(--a); }
    .b { color: var(--theme-color); }
    #c { background: var(--b); }
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
    .a { color: var(--a); }
    .btn-primary { color: var(--theme-color); }
    #b { background: var(--b); }
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
    .a { color: var(--a); }
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
    .a { color: var(--a); }
    .btn-primary { color: var(--theme-color); }
    .b { background: var(--brand-color); }
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
    .a { color: var(--a); }
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

Deno.test("transform - prefix with different values for selectors and identifiers", () => {
  const input = `
    :root { 
      --custom-prop: value; 
      --another-prop: value;
    }
    .test { color: var(--custom-prop); } 
    .another-test { background: var(--another-prop); }
  `;

  const expectedOutput = `
    :root { 
      --var-a: value; 
      --var-b: value;
    }
    .sel-a { color: var(--var-a); } 
    .sel-b { background: var(--var-b); }
  `;

  // Different prefixes for selectors and identifiers
  const result = transform({
    css: input,
    mode: "minimal",
    prefix: {
      selectors: "sel-",
      idents: "var-",
    },
    lightningcssOptions: { minify: false },
  });

  INTERNAL_assertCss(result.css, expectedOutput);
});

Deno.test("transform - suffix with different values for selectors and identifiers", () => {
  const input = `
    :root { 
      --custom-prop: value; 
      --another-prop: value;
    }
    .test { color: var(--custom-prop); } 
    .another-test { background: var(--another-prop); }
  `;

  const expectedOutput = `
    :root { 
      --a-v: value; 
      --b-v: value;
    }
    .a-s { color: var(--a-v); } 
    .b-s { background: var(--b-v); }
  `;

  // Different suffixes for selectors and identifiers
  const result = transform({
    css: input,
    mode: "minimal",
    suffix: {
      selectors: "-s",
      idents: "-v",
    },
    lightningcssOptions: { minify: false },
  });

  INTERNAL_assertCss(result.css, expectedOutput);
});

Deno.test("transform - prefix and suffix with different values for selectors and identifiers", () => {
  const input = `
    :root { 
      --custom-prop: value; 
      --another-prop: value;
    }
    .test { color: var(--custom-prop); } 
    .another-test { background: var(--another-prop); }
  `;

  const expectedOutput = `
    :root { 
      --var-a-v: value; 
      --var-b-v: value;
    }
    .sel-a-s { color: var(--var-a-v); } 
    .sel-b-s { background: var(--var-b-v); }
  `;

  // Both prefix and suffix with different values
  const result = transform({
    css: input,
    mode: "minimal",
    prefix: {
      selectors: "sel-",
      idents: "var-",
    },
    suffix: {
      selectors: "-s",
      idents: "-v",
    },
    lightningcssOptions: { minify: false },
  });

  INTERNAL_assertCss(result.css, expectedOutput);
});

Deno.test("transform - handles universal selector", () => {
  const input = `
    * { box-sizing: border-box; }
    .test * { margin: 0; }
  `;
  const expectedOutput = `
    * { box-sizing: border-box; }
    .a * { margin: 0; }
  `;

  const result = transform({
    css: input,
    mode: "minimal",
    lightningcssOptions: { minify: false },
  });

  INTERNAL_assertCss(result.css, expectedOutput);
});

Deno.test("transform - handles pseudo-element selector", () => {
  const input = `
    .test::before { content: ""; }
    .item:after { content: "→"; }
  `;
  const expectedOutput = `
    .a:before { content: ""; }
    .b:after { content: "→"; }
  `;

  const result = transform({
    css: input,
    mode: "minimal",
    lightningcssOptions: { minify: false },
  });

  INTERNAL_assertCss(result.css, expectedOutput);
});

Deno.test("transform - handles attribute selector", () => {
  const input = `
    [disabled] { opacity: 0.5; }
    [type="text"] { border: 1px solid gray; }
    .test[hidden] { display: none; }
  `;
  const expectedOutput = `
    [disabled] { opacity: .5; }
    [type="text"] { border: 1px solid gray; }
    .a[hidden] { display: none; }
  `;

  const result = transform({
    css: input,
    mode: "minimal",
    lightningcssOptions: { minify: false },
  });

  INTERNAL_assertCss(result.css, expectedOutput);
});

Deno.test("transform - handles combinator selector", () => {
  const input = `
    .parent > .child { margin: 10px; }
    .list + .list { margin-top: 1em; }
    .sibling ~ .next { padding: 5px; }
    .container .item { display: block; }
  `;
  const expectedOutput = `
    .a > .b { margin: 10px; }
    .c + .c { margin-top: 1em; }
    .d ~ .e { padding: 5px; }
    .f .g { display: block; }
  `;

  const result = transform({
    css: input,
    mode: "minimal",
    lightningcssOptions: { minify: false },
  });

  INTERNAL_assertCss(result.css, expectedOutput);
});

Deno.test("transform - handles namespace selector", () => {
  const input = `
    |div { color: blue; }
    svg|circle { fill: red; }
    *|element { padding: 10px; }
  `;
  const expectedOutput = `
    |div { color: #00f; }
    svg|circle { fill: red; }
    *|element { padding: 10px; }
  `;

  const result = transform({
    css: input,
    mode: "minimal",
    lightningcssOptions: { minify: false },
  });

  INTERNAL_assertCss(result.css, expectedOutput);
});

Deno.test("transform - handles nesting selector", () => {
  const input = `
    .parent {
      & > .child { color: red; }
      &:hover { background: blue; }
      &.modifier { font-weight: bold; }
    }
  `;
  const expectedOutput = `
    .a {
      & > .b { color: red; }
      &:hover { background: #00f; }
      &.c { font-weight: bold; }
    }
  `;

  const result = transform({
    css: input,
    mode: "minimal",
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
