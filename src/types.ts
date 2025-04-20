import type { CustomAtRules, TransformOptions } from "lightningcss-wasm";

export type ConversionTable = Record<string, string>;

export interface ConversionTables {
  /**
   * Mapping for selector conversion.
   *
   * ## **Note**
   * Make sure the keys are **escaped** properly.
   */
  selector: ConversionTable;
  /**
   * Mapping for identifier conversion.
   *
   * ## **Note**
   * Make sure the keys are **escaped** properly
   * and without the '--' prefix.
   */
  ident: ConversionTable;
}

export interface TransformProps {
  css: string;
  mode?: "hash" | "minimal" | "debug";
  debugSymbol?: string;
  prefix?: string;
  suffix?: string;
  seed?: number;
  /**
   * Predefined conversion tables for selectors and identifiers.
   * Use if you want to preserve previous mappings.
   */
  conversionTables?: Partial<ConversionTables>;
  /**
   * Patterns to ignore when transforming CSS.
   * Any selector or custom property that matches one of the patterns will be left unchanged.
   */
  ignorePatterns?: {
    /**
     * Patterns for selectors to ignore during transformation.
     * Any selector that matches one of these regular expressions will be left unchanged.
     * Patterns should match the selector name without the prefix (e.g., "button" for ".button").
     */
    selector?: (string | RegExp)[];
    /**
     * Patterns for custom properties (identifiers) to ignore during transformation.
     * Any custom property that matches one of these regular expressions will be left unchanged.
     * Patterns should match the property name without the '--' prefix (e.g., "color" for "--color").
     */
    ident?: (string | RegExp)[];
  };
  lightningcssOptions?: Omit<
    TransformOptions<CustomAtRules>,
    | "filename"
    | "code"
    | "visitor"
  >;
}

export interface TransformResult {
  css: string;
  conversionTables: ConversionTables;
}

export type Transform = (params: TransformProps) => TransformResult;
