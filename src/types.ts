import type { CustomAtRules, TransformOptions } from "lightningcss-wasm";

/**
 * Represents a conversion table.
 * A mapping of original strings to their converted counterparts.
 * The keys are the original strings, and the values are the converted strings.
 */
export type ConversionTable = Record<string, string>;

/**
 * Represents a group of conversion tables supported by this package.
 * This includes both selector and identifier conversion tables.
 */
export interface ConversionTables {
  /**
   * Mapping for selector conversion.
   *
   * ## **Note**
   * Make sure the keys are **escaped** properly.
   */
  selectors: ConversionTable;

  /**
   * Mapping for identifier conversion.
   *
   * ## **Note**
   * Make sure the keys are **escaped** properly.
   * Ensure they do not include the `--` prefix.
   */
  idents: ConversionTable;
}

export interface TransformProps {
  /**
   * The CSS code to be transformed.
   */
  css: string;

  /**
   * The mode of transformation.
   * - `hash`: Generates a reproducible hash for each selector and identifier.
   * - `minimal`: Minimizes the key into an alphanumeric string (e.g., "a", "b", "c"...)
   * - `debug`: Won't change the targeted selectors or identifiers fully but prefixes them with a debug symbol.
   */
  mode?: "hash" | "minimal" | "debug";

  /**
   * The debug symbol to be used in debug mode.
   * This symbol will be prepended to the transformed selectors and identifiers.
   */
  debugSymbol?: string;

  /**
   * The prefix to be prepended to transformed selectors and identifiers.
   */
  prefix?: string;

  /**
   * The suffix to be appended to transformed selectors and identifiers.
   */
  suffix?: string;

  /**
   * The seed to be used for hash generation.
   * This is useful for generating consistent hashes across different runs.
   */
  seed?: number;

  /**
   * Predefined conversion tables for selectors and identifiers.
   * Use if you want to preserve previous mappings.
   */
  conversionTables?: Partial<ConversionTables>;

  /**
   * Patterns to ignore when transforming CSS.
   * Any selector or custom property that matches one of the patterns will be left unchanged.
   *
   * Can be provided as either:
   * - An array of patterns that apply to both selectors and identifiers
   * - An object with separate patterns for selectors and identifiers
   */
  ignorePatterns?: {
    /**
     * Patterns for selectors to ignore during transformation.
     * Any selector that matches one of these regular expressions will be left unchanged.
     * Patterns should match the selector name without the prefix (e.g., "button" for ".button").
     */
    selectors?: (string | RegExp)[];

    /**
     * Patterns for custom properties (identifiers) to ignore during transformation.
     * Any custom property that matches one of these regular expressions will be left unchanged.
     * Patterns should match the property name without the '--' prefix (e.g., "color" for "--color").
     */
    idents?: (string | RegExp)[];
  } | (string | RegExp)[];

  /**
   * Options for the LightningCSS transformation.
   */
  lightningcssOptions?: Omit<
    TransformOptions<CustomAtRules>,
    | "filename"
    | "code"
    | "visitor"
  >;
}

export interface TransformResult {
  /**
   * The transformed CSS code.
   */
  css: string;

  /**
   * The conversion tables used during the transformation.
   */
  conversionTables: ConversionTables;
}

export type Transform = (params: TransformProps) => TransformResult;
