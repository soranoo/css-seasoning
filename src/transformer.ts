import type { CustomAtRules, Selector, Visitor } from "lightningcss-wasm";
import type {
  ConversionTable,
  PrefixSuffixOptions,
  Transform,
  TransformProps,
} from "@/types.ts";

import init, { transform as lightningcssTransform } from "lightningcss-wasm";
import {
  cssEscape,
  cssUnescape,
  generateHash,
  initializeHash,
  isNArray,
  matchesAnyPattern,
  numberToLetters,
  parseSelectorComponent,
  stringifySelectorComponent,
  stringSeedToNumber,
} from "@/utils.ts";

export const initTransform = async () => {
  await init();
  await initializeHash();
};

/**
 * Recursively processes a CSS selector's components with a given conversion function.
 *
 * @param selector - The CSS selector to process.
 * @param selectorConversionTable - A table mapping original values to converted values.
 * @param conv - A conversion function that transforms a string.
 * @param ignoreSelectorPatterns - Regex patterns for selectors to ignore.
 * @returns The processed selector.
 */
const INTERNAL_handleSelector = (
  selector: Selector,
  selectorConversionTable: ConversionTable,
  conv: (
    ...props: Parameters<ReturnType<typeof createConversionFunction>>
  ) => string | Selector,
  ignoreSelectorPatterns?: (string | RegExp)[],
): Selector | Selector[] => {
  const newSelector = selector.map(
    (component): Selector | Selector[] | (Selector | Selector[])[] => {
      switch (component.type) {
        case "universal": // eg. *
        case "attribute": // eg. [type="text"], [disabled], etc.
        case "combinator": // eg. >, +, ~, etc.
        case "namespace": // eg. |, |namespace, etc.
        case "nesting": // eg. &, &.class, etc.
        case "pseudo-element": // eg. ::before, ::after, etc.
        case "type": { // eg. div, span, etc.
          // No handling needed for these types
          return [component];
        }
        case "id":
        case "class": {
          const componentWithType = stringifySelectorComponent(component);
          if (componentWithType) {
            // Check if we should ignore this selector based on pattern
            if (ignoreSelectorPatterns && componentWithType) {
              // For class selectors like ".button", extract "button"
              // For id selectors like "#header", extract "header"
              const selectorName = componentWithType.slice(1); // Remove the leading . or #

              if (matchesAnyPattern(selectorName, ignoreSelectorPatterns)) {
                // Skip transformation for this selector
                return [component];
              }
            }

            const convertedSelector = conv(
              componentWithType,
              selectorConversionTable,
              {
                onNewValueBeforeAdd: (originalValue, valueToSave) => {
                  // Make sure the value being saved is prefixed with the original value's type identifier
                  const prefix = originalValue.slice(0, 1);
                  return `${prefix}${valueToSave}`;
                },
              },
            );
            if (typeof convertedSelector === "string") {
              if (
                convertedSelector.slice(0, 1) === "." ||
                convertedSelector.slice(0, 1) === "#"
              ) {
                component.name = convertedSelector.slice(1);
              } else {
                component.name = convertedSelector;
              }
            } else {
              return convertedSelector;
            }
          } else {
            throw new Error(
              `Unhandled component stringify: ${
                JSON.stringify(component)
              }, the "${component.type}" type should be handled.`,
            );
          }
          return [component];
        }
        case "pseudo-class": // eg. :hover, :active, etc.
          switch (component.kind) {
            case "disabled":
            case "hover":
            case "custom":
            case "root":
            case "focus":
            case "focus-within":
            case "focus-visible":
            case "last-child":
            case "first-child": {
              // No further handling needed for these pseudo-classes
              return [component];
            }
            case "nth-child":
            case "nth-last-child":
              component?.of?.map((sel) => {
                return INTERNAL_handleSelector(
                  sel,
                  selectorConversionTable, // <- passing reference
                  conv,
                  ignoreSelectorPatterns,
                );
              });
              break;
            case "host": // eg. :host, :host(.class)
              if (component.selectors) {
                INTERNAL_handleSelector(
                  component.selectors, // <- passing reference
                  selectorConversionTable,
                  conv,
                  ignoreSelectorPatterns,
                );
              }
              return [component];
            case "not":
            case "where":
            case "is":
            case "any":
            case "has": {
              const s = component.selectors.map((sel) => {
                return INTERNAL_handleSelector(
                  sel,
                  selectorConversionTable,
                  conv,
                  ignoreSelectorPatterns,
                );
              });
              if (isNArray(s, 2)) {
                component.selectors = s as Selector[];
                return [component];
              }
              return s;
            }
            default:
              console.log(`[unhandled] pseudo-class: ${component.kind}`);
              break;
          }
          return [component];
        default:
          // @ts-expect-error - Make sure get notified about unhandled types
          console.log(`[unhandled] type: ${component.type}`);
          return [component];
      }
    },
  );

  // Flat the array that more than 2 levels deep
  return newSelector.flat(3);
};

/**
 * Creates a conversion function based on the specified mode.
 *
 * @param mode - The conversion mode: 'hash', 'minimal', or 'debug'.
 * @param debugSymbol - Symbol used for debugging (only applicable in 'debug' mode).
 * @param prefix - Prefix to display after the debug symbol in debug mode.
 * @param suffix - Suffix to append after the converted value in debug mode.
 * @param seed - Optional numeric seed used for hashing in 'hash' mode.
 * @returns A function that converts a string using the given mode.
 */
const createConversionFunction = (
  mode: "hash" | "minimal" | "debug",
  debugSymbol: string,
  prefix: string,
  suffix: string,
  seed?: number,
): (
  value: string,
  conversionTable: Record<string, string>,
  options?: {
    /**
     * Callback function to handle existing values in the conversion table.
     *
     * @param originalValue - The original (not escaped) value being converted.
     * @param convertToValue - The value (escaped) to which the original value is being converted.
     * @returns The converted value.
     */
    onExistenceFound?: (
      originalValue: string,
      convertToValue: string,
    ) => string;

    /**
     * Callback function to handle new values before adding them to the conversion table.
     *
     * @param originalValue - The original value (not escaped) being converted.
     * @param valueToSave - The new value (not escaped) being added to the conversion table.
     * @returns The new value to be added to the conversion table.
     */
    onNewValueBeforeAdd?: (
      originalValue: string,
      valueToSave: string,
    ) => string;
  },
) => string => {
  switch (mode) {
    case "minimal": {
      let minimalCounter = 0;
      return (
        value: string,
        conversionTable: Record<string, string>,
        options?: {
          onExistenceFound?: (
            originalValue: string,
            convertToValue: string,
          ) => string;
          onNewValueBeforeAdd?: (
            originalValue: string,
            valueToSave: string,
          ) => string;
        },
      ) => {
        const escaped = cssEscape(value);
        if (conversionTable[escaped]) {
          const convertToValue = conversionTable[escaped];
          if (options?.onExistenceFound) {
            return options.onExistenceFound(value, convertToValue);
          }
          return convertToValue;
        }
        const newVal = prefix + numberToLetters(minimalCounter) + suffix;
        minimalCounter++;
        conversionTable[escaped] = cssEscape(
          options?.onNewValueBeforeAdd
            ? options.onNewValueBeforeAdd(value, newVal)
            : newVal,
        );
        return newVal;
      };
    }
    case "debug": {
      return (
        value: string,
        conversionTable: Record<string, string>,
        options?: {
          onExistenceFound?: (
            originalValue: string,
            convertToValue: string,
          ) => string;
          onNewValueBeforeAdd?: (
            originalValue: string,
            valueToSave: string,
          ) => string;
        },
      ) => {
        const escaped = cssEscape(value);
        if (conversionTable[escaped]) {
          const convertToValue = conversionTable[escaped];
          if (options?.onExistenceFound) {
            return options.onExistenceFound(value, convertToValue);
          }
          return convertToValue;
        }
        const newVal = debugSymbol + prefix + value + suffix;
        conversionTable[escaped] = cssEscape(
          options?.onNewValueBeforeAdd
            ? options.onNewValueBeforeAdd(value, newVal)
            : newVal,
        );
        return newVal;
      };
    }
    case "hash": {
      const localSeed = seed;
      return (
        value: string,
        conversionTable: Record<string, string>,
        options?: {
          onExistenceFound?: (
            originalValue: string,
            convertToValue: string,
          ) => string;
          onNewValueBeforeAdd?: (
            originalValue: string,
            valueToSave: string,
          ) => string;
        },
      ) => {
        const escaped = cssEscape(value);
        if (conversionTable[escaped]) {
          const convertToValue = conversionTable[escaped];
          if (options?.onExistenceFound) {
            return options.onExistenceFound(value, convertToValue);
          }
          return convertToValue;
        }
        const hashValue = prefix + generateHash(value, localSeed) + suffix;
        conversionTable[escaped] = cssEscape(
          options?.onNewValueBeforeAdd
            ? options.onNewValueBeforeAdd(value, hashValue)
            : hashValue,
        );
        return hashValue;
      };
    }
    default:
      throw new Error(`Unknown mode: ${mode}`);
  }
};

/**
 * Builds a visitor object for processing selectors and dashed identifiers using lightningcss.
 *
 * @param selectorConvertFunc - The conversion function to apply to selector names.
 * @param identConvertFunc - The conversion function to apply to identifier names.
 * @param selectorConversionTable - A table mapping original selectors to converted selectors.
 * @param identConversionTable - A table mapping original identifiers to converted identifiers.
 * @param ignorePatterns - Patterns for selectors and custom properties to ignore during transformation.
 * @returns A visitor object compatible with lightningcss.
 */
const INTERNAL_buildVisitor = (
  selectorConvertFunc: ReturnType<typeof createConversionFunction>,
  identConvertFunc: ReturnType<typeof createConversionFunction>,
  selectorConversionTable: ConversionTable,
  identConversionTable: ConversionTable,
  ignorePatterns?: TransformProps["ignorePatterns"],
) => {
  // Normalize ignorePatterns to handle both array and object formats
  let selectorPatterns: (string | RegExp)[] | undefined;
  let identPatterns: (string | RegExp)[] | undefined;

  if (Array.isArray(ignorePatterns)) {
    // If ignorePatterns is an array, use it for both selectors and identifiers
    selectorPatterns = ignorePatterns;
    identPatterns = ignorePatterns;
  } else if (ignorePatterns) {
    // If ignorePatterns is an object, extract the separate patterns
    selectorPatterns = ignorePatterns.selectors;
    identPatterns = ignorePatterns.idents;
  }

  return {
    Selector(selector: Selector): Selector | Selector[] {
      return INTERNAL_handleSelector(
        selector,
        selectorConversionTable,
        (value: string, conversionTable: Record<string, string>, ...props) => {
          const escapedValue = cssEscape(value);
          if (selectorConversionTable[escapedValue]) {
            return parseSelectorComponent( // <- Allow to convert to complex selector
              cssUnescape(selectorConversionTable[escapedValue]),
            );
          }
          return selectorConvertFunc(value, conversionTable, ...props);
        },
        selectorPatterns,
      );
    },
    DashedIdent(ident: string) {
      const value = ident.slice(2); // remove the '--' prefix

      // Check if this custom property should be ignored based on pattern
      if (identPatterns && matchesAnyPattern(value, identPatterns)) {
        // Return the original value without transformation
        return ident;
      }

      return `--${identConvertFunc(value, identConversionTable)}`;
    },
  } satisfies Visitor<CustomAtRules>;
};

/**
 * Normalize prefix/suffix options to get separate values for selectors and identifiers
 *
 * @param value - A string or object with selectors/idents properties
 * @param defaultValue - Default value to use if not specified
 * @returns An object with normalized selectors and idents values
 */
const normalizeAffixOptions = (
  value: string | PrefixSuffixOptions | undefined,
  defaultValue = "",
): { selectors: string; idents: string } => {
  if (typeof value === "string" || value === undefined) {
    const stringValue = value || defaultValue;
    return {
      selectors: stringValue,
      idents: stringValue,
    };
  }

  return {
    selectors: value.selectors ?? defaultValue,
    idents: value.idents ?? defaultValue,
  };
};

/**
 * Transforms CSS by processing selectors and dashed identifiers using a conversion mode.
 *
 * @param params - Parameters for the transformation.
 * @param params.css - The input CSS as a string.
 * @param params.mode - The conversion mode to use. 'hash' uses xxhash, 'minimal' assigns sequential alphabetical identifiers, and 'debug' prefixes identifiers with a custom debug symbol; defaults to 'hash'.
 * @param params.debugSymbol - The custom debug symbol to prefix in debug mode; defaults to '_' if not provided.
 * @param params.prefix - In debug mode, the prefix to display after the debug symbol; defaults to an empty string.
 * @param params.suffix - In debug mode, the suffix to append after the value; defaults to an empty string.
 * @param params.seed - The custom seed (string or number) for hash mode.
 * @param params.conversionTables - Predefined conversion tables for selectors and identifiers. Use if you want to preserve previous mappings.
 * @param params.ignorePatterns - Patterns for selectors and custom properties to ignore during transformation.
 * @param params.lightningcssOptions - Options for the lightningcss transform.
 * @returns An object containing the transformed CSS and conversion tables.
 */
export const transform: Transform = ({
  css,
  mode = "hash",
  debugSymbol = "_",
  prefix,
  suffix,
  seed,
  conversionTables,
  ignorePatterns,
  lightningcssOptions = {
    minify: true,
  },
}) => {
  // Use user provided conversion tables if available, otherwise create new ones
  const selectorConversionTable: ConversionTable =
    conversionTables?.selectors ??
      {};
  const identConversionTable: ConversionTable = conversionTables?.idents ?? {};

  // Normalize prefix and suffix to get separate values for selectors and identifiers
  const normalizedPrefix = normalizeAffixOptions(prefix);
  const normalizedSuffix = normalizeAffixOptions(suffix);

  // Convert string seed to number if necessary
  const numericSeed = typeof seed === "string"
    ? stringSeedToNumber(seed)
    : seed;

  // Create conversion functions based on the selected mode and custom seed
  const selectorConvertFunc = createConversionFunction(
    mode,
    debugSymbol,
    normalizedPrefix.selectors,
    normalizedSuffix.selectors,
    numericSeed,
  );

  const identConvertFunc = createConversionFunction(
    mode,
    debugSymbol,
    normalizedPrefix.idents,
    normalizedSuffix.idents,
    numericSeed,
  );

  // Build visitor for lightningcss.Transform using provided conversion tables
  const visitor = INTERNAL_buildVisitor(
    selectorConvertFunc,
    identConvertFunc,
    selectorConversionTable,
    identConversionTable,
    ignorePatterns,
  );

  const { code, ...otherOutput } = lightningcssTransform({
    filename: "style.css",
    code: new TextEncoder().encode(css),
    visitor,
    ...lightningcssOptions,
  });

  const newCss = new TextDecoder().decode(code);
  return {
    css: newCss,
    conversionTables: {
      selectors: selectorConversionTable,
      idents: identConversionTable,
    },
    ...otherOutput,
  };
};
