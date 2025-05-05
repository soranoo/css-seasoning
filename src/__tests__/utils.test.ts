import { assertEquals } from "jsr:@std/assert";
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
  stringifySelectorComponentComplex,
  stringSeedToNumber,
} from "@/utils.ts";

// Initialize hash before tests
await initializeHash();

Deno.test("cssEscape handles special characters correctly", () => {
  assertEquals(cssEscape("-"), "\\-");
  assertEquals(cssEscape("a"), "a");
  assertEquals(cssEscape("0"), "\\30 ");
  assertEquals(cssEscape("-0"), "-\\30 ");
  assertEquals(cssEscape("\0"), "\uFFFD");
  assertEquals(cssEscape("a.b"), "a\\.b");
  assertEquals(cssEscape("a#b"), "a\\#b");
  assertEquals(cssEscape("a[b"), "a\\[b");
});

Deno.test("cssUnescape reverses cssEscape", () => {
  const testCases = [
    "test",
    "-test",
    "0test",
    "-0test",
    "test.class",
    "special@chars",
  ];

  for (const testCase of testCases) {
    assertEquals(cssUnescape(cssEscape(testCase)), testCase);
  }

  assertEquals(cssUnescape("\\31 23"), "123");
  assertEquals(cssUnescape("\\61 bc"), "abc");
  assertEquals(cssUnescape("\\26 \\#"), "&#");
});

Deno.test("parseSelectorComponent parses CSS selectors correctly", () => {
  const classSelector = parseSelectorComponent(".test");
  assertEquals(classSelector.length, 1);
  assertEquals(classSelector[0].type, "class");
  // deno-lint-ignore no-explicit-any
  assertEquals((classSelector[0] as any).name, "test");

  const idSelector = parseSelectorComponent("#test");
  assertEquals(idSelector.length, 1);
  assertEquals(idSelector[0].type, "id");
  // deno-lint-ignore no-explicit-any
  assertEquals((idSelector[0] as any).name, "test");

  const typeSelector = parseSelectorComponent("div");
  assertEquals(typeSelector.length, 1);
  assertEquals(typeSelector[0].type, "type");
  // deno-lint-ignore no-explicit-any
  assertEquals((typeSelector[0] as any).name, "div");

  const universalSelector = parseSelectorComponent("*");
  assertEquals(universalSelector.length, 1);
  assertEquals(universalSelector[0].type, "universal");

  const attributeSelector = parseSelectorComponent("[data-test]");
  assertEquals(attributeSelector.length, 1);
  assertEquals(attributeSelector[0].type, "attribute");
  // deno-lint-ignore no-explicit-any
  assertEquals((attributeSelector[0] as any).name, "data-test");
});

Deno.test("stringifySelectorComponent returns correct string representations", () => {
  assertEquals(
    stringifySelectorComponent({ type: "class", name: "test" }),
    ".test",
  );
  assertEquals(
    stringifySelectorComponent({ type: "id", name: "test" }),
    "#test",
  );
  assertEquals(
    stringifySelectorComponent({ type: "type", name: "div" }),
    "div",
  );
  assertEquals(stringifySelectorComponent({ type: "universal" }), "*");
});

Deno.test("stringifySelectorComponentComplex handles complex selectors", () => {
  const result = stringifySelectorComponentComplex([
    { type: "class", name: "test" },
  ]);
  assertEquals(result.includes(".test"), true);

  const attrResult = stringifySelectorComponentComplex([
    { type: "attribute", name: "data-test" },
  ]);
  assertEquals(attrResult.includes("[data-test]"), true);
});

Deno.test("numberToLetters converts numbers to alphabetical representation", () => {
  assertEquals(numberToLetters(0), "a");
  assertEquals(numberToLetters(1), "b");
  assertEquals(numberToLetters(25), "z");
  assertEquals(numberToLetters(26), "aa");
  assertEquals(numberToLetters(27), "ab");
  assertEquals(numberToLetters(51), "az");
  assertEquals(numberToLetters(52), "ba");
  assertEquals(numberToLetters(53), "bb");
  assertEquals(numberToLetters(701), "zz");
  assertEquals(numberToLetters(702), "aaa");
});

Deno.test("generateHash generates hashes that always start with a lowercase letter", () => {
  for (let i = 0; i < 100; i++) {
    const testString = `test-string-${i}`;
    const hash = generateHash(testString);
    assertEquals(hash[0] >= "a" && hash[0] <= "z", true);
  }
});

Deno.test("generateHash produces consistent hashes", () => {
  const testString = "test-string";
  const hash1 = generateHash(testString);
  const hash2 = generateHash(testString);
  assertEquals(
    hash1,
    hash2,
    "Hash should be consistent for the same input string",
  );
});

Deno.test("generateHash uses seed for hash generation", () => {
  const testString = "test-string";
  const hash1 = generateHash(testString, 1);
  const hash2 = generateHash(testString, 2);
  assertEquals(
    hash1 !== hash2,
    true,
    "Different seeds should produce different hashes",
  );

  // Verify consistency with the same seed
  const hash3 = generateHash(testString, 1);
  assertEquals(hash1, hash3, "Same seed should produce the same hash");
});

// Testing the isNArray function (which is unexported, but we'll test its behavior indirectly)
Deno.test("Array level detection works correctly", () => {
  assertEquals(isNArray([1, 2, 3], 1), true);
  assertEquals(isNArray([1, 2, 3], 2), false);
  assertEquals(isNArray([[1], [2], [3]], 2), true);
  assertEquals(isNArray([[1], [2], [3]], 3), false);
  assertEquals(isNArray([[[1]]], 3), true);
  assertEquals(isNArray([], 1), true);
  assertEquals(isNArray("not an array", 1), false);
});

// Tests for matchesAnyPattern function
Deno.test("matchesAnyPattern identifies matching patterns correctly", () => {
  // Test with string patterns
  assertEquals(matchesAnyPattern("test", ["test"]), true);
  assertEquals(matchesAnyPattern("test", ["other"]), false);
  assertEquals(matchesAnyPattern("test123", ["test\\d+"]), true);

  // Test with RegExp patterns
  assertEquals(matchesAnyPattern("test", [/^test$/]), true);
  assertEquals(matchesAnyPattern("test", [/^t.st$/]), true);
  assertEquals(matchesAnyPattern("test", [/^other$/]), false);

  // Test with mixed patterns
  assertEquals(matchesAnyPattern("test", ["other", /^test$/]), true);
  assertEquals(matchesAnyPattern("test", [/^other$/, "test"]), true);

  // Test with multiple matches
  assertEquals(matchesAnyPattern("test", ["test", /^test$/]), true);

  // Test with empty or undefined patterns
  assertEquals(matchesAnyPattern("test", []), false);
  assertEquals(matchesAnyPattern("test", undefined), false);

  // Test case sensitivity
  assertEquals(matchesAnyPattern("Test", ["test"]), false);
  assertEquals(matchesAnyPattern("Test", [/test/i]), true);
});

Deno.test("stringSeedToNumber converts string seeds correctly", () => {
  assertEquals(stringSeedToNumber("a"), 97);
  assertEquals(stringSeedToNumber("abc"), 97 + 98 + 99); // 294
  assertEquals(stringSeedToNumber(""), 0);
  assertEquals(
    stringSeedToNumber("seed1"),
    "s".charCodeAt(0) + "e".charCodeAt(0) + "e".charCodeAt(0) +
      "d".charCodeAt(0) + "1".charCodeAt(0),
  );
});
