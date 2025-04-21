
// console.log(cssEscape(".bg-[image:repeating-linear-gradient(315deg,_var(--pattern-fg)_0,_var(--pattern-fg)_1px,_transparent_0,_transparent_50%)]"));
// $ NPM_TOKEN=<your_npm_token> GH_TOKEN=<your_github_token> npx semantic-release --no-ci

import { transform, initTransform } from "@/transformer.ts";

const main = async () => {
  await initTransform();
  const t = transform({
    css: Deno.readTextFileSync("./sample/test.css"),
    // css: ".test#testId { color: red; } .existing { color: blue; }",
    mode: "minimal",
    // debugSymbol: "__debug__",
    // prefix: "prefix-",
    // suffix: "-suffix",
    seed: 123,
    // Users can now optionally provide predefined conversion tables
    conversionTables: {
      // todo: maybe allow to convert selector type, eg. class -> id
      // selector: {
      //   // Allow atom selector to convert to complex selector
      //   // eg. ".existing" -> "h1:has(.existing)"
      //   // BUT, can't convert complex selector to selector
      //   // eg. "h1:has(.existing)" -> ".existing" <- this is not allowed

      //   // "\\.existing": "\\.preserved-id",
      //   // // "h1\\:has\\(\\.existing\\)": ".preserved-id",
      //   // "\\#testId": "preserved-id"
      // },
      // ident: { "tw-ring-color": "preserved-var" },
    },
  });


  // save the transformed CSS
  Deno.writeTextFileSync("./sample/test-transformed.css", t.css);
  console.log({
    identConversionTable: t.conversionTables.idents,
    selectorConversionTable: t.conversionTables.selectors,
  });
}

main();
