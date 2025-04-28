import type { Selector, SelectorComponent } from "lightningcss-wasm";
import { transform as lightningcssTransform } from "lightningcss-wasm";
import xxhash from "xxhash-wasm";

// Initialize xxhash
let hashInstance: Awaited<ReturnType<typeof xxhash>> | null = null;

/**
 * Initializes the xxhash instance for use in generating hash values.
 */
export const initializeHash = async () => {
  if (!hashInstance) {
    hashInstance = await xxhash();
  }
  return hashInstance;
};

// Character codes for lowercase a-z range
const LOWERCASE_A_CHARCODE = 97;
const LOWERCASE_Z_CHARCODE = 122;

/**
 * Converts a string seed into a numeric seed by summing character codes.
 *
 * @param strSeed - The string seed to convert.
 * @returns A numeric representation of the string seed.
 */
export const stringSeedToNumber = (strSeed: string): number => {
  let numSeed = 0;
  for (let i = 0; i < strSeed.length; i++) {
    numSeed += strSeed.charCodeAt(i);
  }
  return numSeed;
};

/**
 * Generates a hash value from a string.
 *
 * @param value - The string to hash.
 * @param seed - Optional seed for the hash function.
 * @returns A hash value with a lowercase first character.
 *
 * @example
 * ```ts
 * generateHash("example", 1); // Returns a consistent hash that starts with lowercase
 * ```
 */
export const generateHash = (value: string, seed?: number): string => {
  if (!hashInstance) {
    throw new Error(
      "Hash instance not initialized. Call initializeHash() first.",
    );
  }
  //? Hash start with number will break the CSS selector

  let hashValue = hashInstance.h32ToString(value, seed);
  const firstCharCode = hashValue.charCodeAt(0);

  // If the first character is not lowercase, map to lowercase range of a-z
  if (
    firstCharCode < LOWERCASE_A_CHARCODE || firstCharCode > LOWERCASE_Z_CHARCODE
  ) {
    const newCharCode = LOWERCASE_A_CHARCODE + (firstCharCode % 26);
    hashValue = String.fromCharCode(newCharCode) + hashValue.slice(1);
  }

  return hashValue;
};

/**
 * Escapes special characters in a CSS string.
 *
 * @param value - The string to escape.
 * @returns The escaped string.
 *
 * @source https://github.com/tailwindlabs/tailwindcss/blob/7d51e38d8c4a5cba20face7384be9629c9dcc3c8/packages/tailwindcss/src/utils/escape.ts#L2-L73
 *
 * @example
 * ```ts
 * cssEscape("-"); // "\\-"
 * cssEscape("a"); // "a"
 * cssEscape("0"); // "\\30 "
 * cssEscape("-0"); // "-\\30 "
 * cssEscape("\0"); // "\uFFFD"
 * ```
 */
export const cssEscape = (value: string): string => {
  const string = String(value);
  const length = string.length;
  let index = -1;
  let codeUnit: number;
  let result = "";
  const firstCodeUnit = string.charCodeAt(0);

  if (
    // If the character is the first character and is a `-` (U+002D), and
    // there is no second character, […]
    length === 1 &&
    firstCodeUnit === 0x002d
  ) {
    return `\\${string}`;
  }

  while (++index < length) {
    codeUnit = string.charCodeAt(index);
    // Note: there’s no need to special-case astral symbols, surrogate
    // pairs, or lone surrogates.

    // If the character is NULL (U+0000), then the REPLACEMENT CHARACTER
    // (U+FFFD).
    if (codeUnit === 0x0000) {
      result += "\uFFFD";
      continue;
    }

    if (
      // If the character is in the range [\1-\1F] (U+0001 to U+001F) or is
      // U+007F, […]
      (codeUnit >= 0x0001 && codeUnit <= 0x001f) ||
      codeUnit === 0x007f ||
      // If the character is the first character and is in the range [0-9]
      // (U+0030 to U+0039), […]
      (index === 0 && codeUnit >= 0x0030 && codeUnit <= 0x0039) ||
      // If the character is the second character and is in the range [0-9]
      // (U+0030 to U+0039) and the first character is a `-` (U+002D), […]
      (index === 1 &&
        codeUnit >= 0x0030 &&
        codeUnit <= 0x0039 &&
        firstCodeUnit === 0x002d)
    ) {
      // https://drafts.csswg.org/cssom/#escape-a-character-as-code-point
      result += `\\${codeUnit.toString(16)} `;
      continue;
    }

    // If the character is not handled by one of the above rules and is
    // greater than or equal to U+0080, is `-` (U+002D) or `_` (U+005F), or
    // is in one of the ranges [0-9] (U+0030 to U+0039), [A-Z] (U+0041 to
    // U+005A), or [a-z] (U+0061 to U+007A), […]
    if (
      codeUnit >= 0x0080 ||
      codeUnit === 0x002d ||
      codeUnit === 0x005f ||
      (codeUnit >= 0x0030 && codeUnit <= 0x0039) ||
      (codeUnit >= 0x0041 && codeUnit <= 0x005a) ||
      (codeUnit >= 0x0061 && codeUnit <= 0x007a)
    ) {
      // the character itself
      result += string.charAt(index);
      continue;
    }

    // Otherwise, the escaped character.
    // https://drafts.csswg.org/cssom/#escape-a-character
    result += `\\${string.charAt(index)}`;
  }
  return result;
};

/**
 * Unescapes a CSS string.
 *
 * @param escaped - The escaped string to unescape.
 * @returns The unescaped string.
 *
 * @source https://github.com/tailwindlabs/tailwindcss/blob/7d51e38d8c4a5cba20face7384be9629c9dcc3c8/packages/tailwindcss/src/utils/escape.ts#L75-L81
 *
 * @example
 * ```ts
 * cssUnescape("\\31 23"); // "123"
 * cssUnescape("\\61 bc"); // "abc"
 * ```
 */
export const cssUnescape = (escaped: string): string => {
  return escaped.replace(/\\([\dA-Fa-f]{1,6}[\t\n\f\r ]?|[\S\s])/g, (match) => {
    return match.length > 2
      ? String.fromCodePoint(Number.parseInt(match.slice(1).trim(), 16))
      : match[1];
  });
};

/**
 * Converts a selector string to a selector component.
 *
 * @param selectorStr - The selector string to convert.
 * @returns An array of SelectorComponent parsed from the string.
 *
 * @example
 * ```ts
 * stringToSelectorComponent(".test"); // [{ type: "class", name: "test" }]
 * stringToSelectorComponent("#test"); // [{ type: "id", name: "test" }]
 * stringToSelectorComponent("div"); // [{ type: "type", name: "div" }]
 * stringToSelectorComponent("*"); // [{ type: "universal" }]
 * ```
 *
 * ## **Note**
 * Although this function can parse any valid CSS selector theoretically
 * , it is **computationally expensive** and should be used with caution.
 */
export const parseSelectorComponent = (
  selectorStr: string,
): SelectorComponent[] => {
  const output: SelectorComponent[] = [];
  lightningcssTransform({
    filename: "style.css",
    code: new TextEncoder().encode(
      `${selectorStr}{}`, //? To make the selector valid to parse
    ),
    visitor: {
      Selector(selector) {
        output.push(...selector);
      },
    },
  });
  return output;
};

/**
 * Converts a selector object to a string.
 *
 * @param selector - The selector object to convert.
 * @returns The string representation of the selector.
 *
 * @example
 * ```ts
 * stringifySelectorComponent({ type: "class", name: "test" }); // ".test"
 * stringifySelectorComponent({ type: "id", name: "test" }); // "#test"
 * stringifySelectorComponent({ type: "type", name: "div" }); // "div"
 * stringifySelectorComponent({ type: "universal" }); // "*"
 * ```
 *
 * ## **Note**
 * This function is **computationally expensive** and should be used with caution.
 */
export const stringifySelectorComponentComplex = (
  selector: Selector,
): string => {
  const placeholderCssBody = "{color:red}"; //? Make sure the body is minified
  const { code } = lightningcssTransform({
    filename: "style.css",
    code: new TextEncoder().encode(
      `#temp${placeholderCssBody}`, //? To make the selector valid to parse
    ),
    minify: true,
    visitor: {
      Selector() {
        return selector;
      },
    },
  });

  const removePlaceholderCssBodyRegex = new RegExp(`${placeholderCssBody}$`);

  return new TextDecoder().decode(code).replace(
    removePlaceholderCssBodyRegex,
    "",
  );
};

/**
 * Converts a selector component to a string.
 *
 * @param selectorComponent - The selector component to convert.
 * @returns The string representation of the selector component.
 *
 * @example
 * ```ts
 * stringifySelectorComponent({ type: "class", name: "test" }); // ".test"
 * stringifySelectorComponent({ type: "id", name: "test" }); // "#test"
 * stringifySelectorComponent({ type: "type", name: "div" }); // "div"
 * stringifySelectorComponent({ type: "universal" }); // "*"
 * stringifySelectorComponent({ type: "attribute", name: "data-attr" }); // "[data-attr]"
 * stringifySelectorComponent({ type: "pseudo-element", name: "before" }); // "::before"
 * ```
 */
export const stringifySelectorComponent = (
  selectorComponent: SelectorComponent,
) => {
  switch (selectorComponent.type) {
    case "attribute":
      return stringifySelectorComponentComplex([selectorComponent]);
    case "combinator":
    case "namespace":
    case "nesting":
    case "pseudo-class":
    case "pseudo-element":
      return undefined;
    case "class":
      return `.${selectorComponent.name}`;
    case "id":
      return `#${selectorComponent.name}`;
    case "type":
      // eg. div, span, etc.
      return selectorComponent.name;
    case "universal":
      return "*";
  }

  // Should never reach here
  throw new Error(
    `Unknown selector type: ${JSON.stringify(selectorComponent)}`,
  );
};

/**
 * Converts a number to its alphabetical representation.
 *
 * @param num - The number to convert.
 * @returns The alphabetical string.
 *
 * @example
 * ```ts
 * numberToLetters(0); // "a"
 * numberToLetters(1); // "b"
 * numberToLetters(25); // "z"
 * numberToLetters(26); // "aa"
 * numberToLetters(27); // "ab"
 * ```
 */
export const numberToLetters = (num: number): string => {
  let s = "";
  let n = num + 1; // make it 1-indexed
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(97 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

/**
 * Checks if the given value is an array of a specific level.
 *
 * @param arr - The value to check.
 * @param level - The level to check.
 * @returns `true` if the value is an array of the specified level, `false` otherwise.
 *
 * @example
 * ```ts
 * isNArray([1, 2, 3], 1); // true
 * isNArray([1, 2, 3], 2); // false
 * isNArray([1, 2, 3], 0); // false
 * isNArray([[1, 2, 3]], 2); // true
 * isNArray([[1, 2, 3]], 1); // false
 */
export const isNArray = <T>(arr: T | T[], level: number): arr is T[] => {
  if (!Array.isArray(arr)) {
    return false;
  }
  if (level === 1) {
    return true;
  }
  if (arr.length === 0) {
    return false;
  }
  return isNArray(arr[0], level - 1);
};

/**
 * Checks if a value matches any of the provided regex patterns.
 *
 * @param value - The string value to check.
 * @param patterns - Array of string or RegExp patterns to match against.
 * @returns True if the value matches any pattern, false otherwise.
 *
 * @example
 * ```ts
 * matchesAnyPattern("test", [/^test$/]); // true
 * matchesAnyPattern("test", ["test"]); // true
 * matchesAnyPattern("test", [/^foo$/]); // false
 * matchesAnyPattern("test", ["bar"]); // false
 * ```
 */
export const matchesAnyPattern = (
  value: string,
  patterns?: (string | RegExp)[],
): boolean => {
  if (!patterns || patterns.length === 0) {
    return false;
  }

  return patterns.some((pattern) => {
    if (typeof pattern === "string") {
      return new RegExp(pattern).test(value);
    }
    return pattern.test(value);
  });
};
