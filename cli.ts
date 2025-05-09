import type { PrefixSuffixOptions, TransformProps } from "@/types.ts";

import { parseArgs as jsrParseArgs } from "jsr:@std/cli/parse-args";
import { initTransform, transform } from "@/index.ts";

// TODO: add cli test

/**
 * Displays help information for the CLI tool
 */
const showHelp = () => {
  console.log(`
css-seasoning - A tool to transform CSS selectors and custom properties

USAGE:
  deno run --allow-env --allow-read --allow-write main.ts [OPTIONS] <input-file>

OPTIONS:
  -h, --help                   Show this help message
  -o, --output <file>          Output file (outputs to stdout if not specified)
  -m, --mode <mode>            Transformation mode: hash, minimal, or debug (default: hash)
  -d, --debug-symbol <symbol>  Symbol to use for debug mode (default: _)
  -p, --prefix <prefix>        Prefix to add after debug symbol in debug mode
      --prefix-selector <prefix> Prefix to use for selectors (overrides --prefix)
      --prefix-ident <prefix>  Prefix to use for identifiers (overrides --prefix)
  -s, --suffix <suffix>        Suffix to add at the end in debug mode
      --suffix-selector <suffix> Suffix to use for selectors (overrides --suffix)
      --suffix-ident <suffix>  Suffix to use for identifiers (overrides --suffix)
  --seed <number>              Seed for hash generation in hash mode
  --minify                     Minify the output CSS (default: true)
  --source-map                 Generate source map
  --conversion-tables <file>   JSON file with existing conversion tables to preserve mappings
  --save-tables <file>         Save the conversion tables to a JSON file (prints to stderr if not specified)
  --ignore <pattern>           Regex pattern for selectors and custom properties to ignore (can be used multiple times)
  --ignore-selector <pattern>  Regex pattern for selectors to ignore (can be used multiple times, overridden by --ignore)
  --ignore-ident <pattern>     Regex pattern for custom properties to ignore (can be used multiple times, overridden by --ignore)

EXAMPLES:
  css-seasoning styles.css
  css-seasoning -o output.css -m minimal styles.css
  css-seasoning --mode debug --debug-symbol "_d_" styles.css
  css-seasoning --ignore "^btn-" --ignore "^theme-" styles.css
  css-seasoning --ignore-selector "^btn-" --ignore-ident "^theme-" styles.css
  css-seasoning --prefix "prefix-" --suffix-selector "-sel" --suffix-ident "-var" styles.css
  `);
};

/**
 * Parse command line arguments and return an object with all options
 */
const parseArgsa = () => {
  const args = jsrParseArgs(Deno.args, {
    string: [
      "output", 
      "mode", 
      "debug-symbol", 
      "prefix", 
      "prefix-selector", 
      "prefix-ident", 
      "suffix", 
      "suffix-selector", 
      "suffix-ident", 
      "seed", 
      "conversion-tables", 
      "save-tables", 
      "ignore",
      "ignore-selector", 
      "ignore-ident"
    ],
    boolean: [
      "help", 
      "minify", 
      "source-map"
    ],
    alias: {
      h: "help",
      o: "output",
      m: "mode",
      d: "debug-symbol",
      p: "prefix",
      s: "suffix",
    },
    default: {
      mode: "hash",
      "debug-symbol": "_",
      minify: true,
    },
    collect: ["ignore", "ignore-selector", "ignore-ident"],
  });

  if (args.help || args._.length === 0) {
    showHelp();
    Deno.exit(args.help ? 0 : 1);
  }

  const inputFile = String(args._[0]);
  
  // Output file is optional now - if not provided, output will go to stdout
  const outputFile = args.output || null;

  // Handle prefix/suffix options with separate selector/ident values
  let prefix: string | PrefixSuffixOptions = args.prefix || "";
  if (args["prefix-selector"] || args["prefix-ident"]) {
    prefix = {
      selectors: args["prefix-selector"] || args.prefix || "",
      idents: args["prefix-ident"] || args.prefix || "",
    };
  }

  let suffix: string | PrefixSuffixOptions = args.suffix || "";
  if (args["suffix-selector"] || args["suffix-ident"]) {
    suffix = {
      selectors: args["suffix-selector"] || args.suffix || "",
      idents: args["suffix-ident"] || args.suffix || "",
    };
  }

  // Handle ignore patterns
  let ignorePatterns: TransformProps["ignorePatterns"] = undefined;
  const ignore = args.ignore as string[] | undefined;
  const ignoreSelector = args["ignore-selector"] as string[] | undefined;
  const ignoreIdent = args["ignore-ident"] as string[] | undefined;

  if (ignore && ignore.length > 0) {
    ignorePatterns = ignore; // --ignore takes precedence and applies to both
  } else if ((ignoreSelector && ignoreSelector.length > 0) || (ignoreIdent && ignoreIdent.length > 0)) {
    ignorePatterns = {
      selectors: ignoreSelector && ignoreSelector.length > 0 ? ignoreSelector : undefined,
      idents: ignoreIdent && ignoreIdent.length > 0 ? ignoreIdent : undefined,
    };
  }

  return {
    inputFile,
    outputFile,
    mode: args.mode as "hash" | "minimal" | "debug",
    debugSymbol: args["debug-symbol"],
    prefix,
    suffix,
    seed: args.seed ? Number.parseInt(args.seed) : undefined,
    minify: args.minify,
    sourceMap: args["source-map"],
    conversionTablesFile: args["conversion-tables"],
    saveTablesFile: args["save-tables"],
    ignorePatterns,
  };
};

/**
 * Main function to run the CLI tool
 */
const main = async () => {
  await initTransform();
  
  try {
    const options = parseArgsa();

    // Read the input CSS file
    const css = await Deno.readTextFile(options.inputFile);

    // Read conversion tables file if provided
    let existingConversionTables = undefined;
    if (options.conversionTablesFile) {
      try {
        const tablesContent = await Deno.readTextFile(options.conversionTablesFile);
        existingConversionTables = JSON.parse(tablesContent);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error loading conversion tables: ${errorMessage}`);
        Deno.exit(1);
      }
    }

    // Prepare transform options
    const transformOptions: TransformProps = {
      css,
      mode: options.mode,
      debugSymbol: options.debugSymbol,
      prefix: options.prefix,
      suffix: options.suffix,
      seed: options.seed,
      conversionTables: existingConversionTables,
      ignorePatterns: options.ignorePatterns,
      lightningcssOptions: {
        minify: options.minify,
        sourceMap: options.sourceMap,
      },
    };

    // Transform the CSS
    console.log(`Processing ${options.inputFile}...`);
    const result = transform(transformOptions);

    // Either save to a file or output to stdout
    if (options.outputFile) {
      await Deno.writeTextFile(options.outputFile, result.css);
      console.log(`Output written to ${options.outputFile}`);
    } else {
      // Output directly to stdout
      console.log(result.css);
    }

    // Save conversion tables if requested or print to stderr if not specified
    if (options.saveTablesFile) {
      await Deno.writeTextFile(
        options.saveTablesFile,
        JSON.stringify(result.conversionTables, null, 2)
      );
      console.log(`Conversion tables saved to ${options.saveTablesFile}`);
    } else {
      // Print conversion tables to stderr
      console.log("\nConversion Tables:");
      console.log(JSON.stringify(result.conversionTables, null, 2));
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${errorMessage}`);
    Deno.exit(1);
  }
};

export {
  main as cli,
}

if (import.meta.main) {
  // If this module is run directly, execute the main function
  main();
}
