# CSS-SEASONING

Project starts on 02-03-2025

![Tests](https://github.com/soranoo/css-seasoning/actions/workflows/lint-format-test.yml/badge.svg) [![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)&nbsp;&nbsp;&nbsp;[![Donation](https://img.shields.io/static/v1?label=Donation&message=❤️&style=social)](https://github.com/soranoo/Donation)

<!-- [![banner](./docs/imgs/banner.png)](https://github.com/soranoo/css-seasoning) -->

[![npm version](https://img.shields.io/npm/v/css-seasoning?color=red&style=flat)](https://www.npmjs.com/package/css-seasoning) [![npm downloads](https://img.shields.io/npm/dt/css-seasoning?color=blue&style=flat)](https://www.npmjs.com/package/css-seasoning)

<!-- [![JSR](https://jsr.io/badges/@<scope>/<package>)](https://jsr.io/@<scope>/<package>) [![JSR Score](https://jsr.io/badges/@<scope>/<package>/score)](https://jsr.io/@<scope>/<package>) -->




---

Visit the [GitHub Page](https://github.com/soranoo/css-seasoning/) for better reading experience and latest docs. 😎

--- 

A tool deeply inspired by [google/postcss-rename](https://github.com/google/postcss-rename) but not dependent on PostCSS. 

CSS-SEASONING is designed seasoning your CSS files by transforming selectors and custom properties into hash values (multiple modes available). It can be used to obfuscate CSS files, reduce file size, or simply make your CSS more readable.

Let's say goodbye to long and complex CSS selectors and custom properties, and hello to a cleaner, more efficient CSS!

> [!NOTE]\
> This package does not provide tool to change your HTML or JS files. It only transforms CSS files. You need to use other tools to change your HTML or JS files to match the transformed CSS.

Give me a ⭐ if you like it.

## 📖 Table of Contents

- [🗝️ Features](#️-features)
- [🚀 Getting Started](#-getting-started)
- [📖 Config Options Reference](#-config-options-reference)
- [💻 CLI](#-cli)
- [⭐ TODO](#-todo)
- [🐛 Known Issues](#-known-issues)
- [🤝 Contributing](#-contributing)
- [📝 License](#-license)
- [⭐ Star History](#-star-history)
- [☕ Donation](#-donation)

## 🗝️ Features

- **Hash-based transformation**: Convert CSS selectors and custom properties to hash values
- **Minimal mode**: Convert to shortest possible alphabetical names (a, b, c, ...)
- **Debug mode**: Add prefixes and suffixes to help debugging transformed CSS
- **Custom seed support**: Use a specific seed to generate consistent hashes
- **Conversion tables**: Save and reuse conversion mappings between runs
- **Easy-to-use CLI**: Simple command-line interface for quick transformations
- **CSS optimisation**: Improve the efficiency of your CSS code

## 🚀 Getting Started

### Installation

#### Using npm

```bash
npm install -D css-seasoning
```

Visit the [npm](https://www.npmjs.com/package/css-seasoning) page for more information.

### Usage 🎉

#### Basic Usage

```bash
# Using the CLI (if installed via npm)
css-seasoning styles.css

# Using Deno directly
deno run cli styles.css
```

> [!NOTE]\
> This will transform your CSS file using the default hash mode and display the output in the console if no output file is specified.

#### Example: Using Minimal Mode

```bash
css-seasoning styles.css -m minimal
```

Input (`styles.css`):
```css
:root {
  --main-color: blue;
  --accent-color: red;
}

.button {
  background-color: var(--main-color);
}

.button.primary {
  background-color: var(--accent-color);
}
```

Prettied Output:
```css
:root {
  --a:blue; --b:red;
}.c {
  background-color:var(--a);
}.c.d {
  background-color:var(--b);
}
```

#### Example: Using Debug Mode

```bash
css-seasoning styles.css -m debug -d "__DEBUG__" -p "prefix-" -s "-suffix"
```

Prettied Output:
```css
:root {
   --__DEBUG__prefix-main-color-suffix:blue;
   --__DEBUG__prefix-accent-color-suffix:red;
}

.__DEBUG__prefix-\.button-suffix {
   background-color: var(--__DEBUG__prefix-main-color-suffix);
}
.__DEBUG__prefix-\.button-suffix.__DEBUG__prefix-\.primary-suffix {
   background-color: var(--__DEBUG__prefix-accent-color-suffix);
}
```

#### Example: Saving Conversion Tables

```bash
css-seasoning styles.css --save-tables tables.json
```

This generates a conversion table file (`tables.json`) that maps original selectors and custom properties to their transformed versions:

```json
{
  "selector": {
    "\\.button": "\\.rde48G",
    "\\.primary": "\\.K9aB2z"
  },
  "ident": {
    "main-color": "a8XPz8",
    "accent-color": "mL3o9P"
  }
}
```

#### Example: Using Saved Conversion Tables

```bash
css-seasoning new-styles.css --conversion-tables tables.json
```

This ensures that the same mappings are used across multiple CSS files or builds.

#### Example: Ignoring Specific Patterns

You can selectively ignore certain selectors or custom properties that you don't want to transform using regex patterns:

```bash
# Ignore Bootstrap utility classes starting with 'btn-'
css-seasoning styles.css --ignore-selector "^btn-"

# Ignore both bootstrap buttons and theme color custom properties
css-seasoning styles.css --ignore-selector "^btn-" --ignore-ident "^theme-"
```

Input:
```css
:root {
  --main-color: blue;
  --theme-primary: red;
}

.button {
  color: var(--main-color);
}

.btn-primary {
  color: var(--theme-primary);
}
```

Output with ignore patterns:
```css
:root {
  --a:blue; --theme-primary:red;
}
.b {
  color:var(--a);
}
.btn-primary {
  color:var(--theme-primary);
}
```

This allows you to keep certain naming conventions intact (like framework-specific class names or theme variables) while still transforming the rest of your CSS.

## 📖 Config Options Reference

| Option                 | Type                                 | Default      | Description                                                      |
| ---------------------- | ------------------------------------ | ------------ | ---------------------------------------------------------------- |
| `mode`                 | `"hash"` \| `"minimal"` \| `"debug"` | `"hash"`     | The transformation mode to use                                   |
| `debugSymbol`          | `string`                             | `"_"`        | Symbol to use in debug mode                                      |
| `prefix`               | `string`                             | `""`         | Prefix to add after debug symbol in debug mode                   |
| `suffix`               | `string`                             | `""`         | Suffix to add at the end in debug mode                           |
| `seed`                 | `number`                             | `undefined`  | Seed for hash generation in hash mode                            |
| `ignorePatterns`       | `{selector?: (string \| RegExp)[], ident?: (string \| RegExp)[]}` | `undefined` | Patterns for selectors and custom properties to ignore during transformation |
| `conversionTables`     | `{ selector?: {}, ident?: {} }`      | `undefined`  | Predefined conversion tables for selectors and identifiers       |
| `lightningcssOptions`  | `object`                             | `{ minify: true }` | Options for the lightningcss transform                     |

### All options in one place 📦

If you're using css-seasoning as a library:

```ts
import { transform } from "css-seasoning";

const result = transform({
  css: inputCss,
  mode: "hash",          // "hash", "minimal", or "debug"
  debugSymbol: "_",      // Symbol for debug mode
  prefix: "prefix-",     // Prefix in debug mode (after symbol)
  suffix: "-suffix",     // Suffix in debug mode
  seed: 123,             // Custom seed for hash generation
  ignorePatterns: {      // Patterns to ignore during transformation
    selector: ["^btn-", /header$/],
    ident: ["^theme-"]
  },
  conversionTables: {    // Optional reusable mappings
    selector: { "\\.button": "\\.preserved-class" },
    ident: { "color": "preserved-var" }
  },
  lightningcssOptions: { // Lightning CSS options
    minify: true,
    sourceMap: false
  }
});

console.log(result.css);                // The transformed CSS
console.log(result.conversionTables);   // The generated/used conversion tables
```

## 💻 CLI

The CLI provides a convenient way to transform CSS files from the command line.

```bash
css-seasoning [OPTIONS] <input-file>
```

### Options

```
-h, --help                   Show help message
-o, --output <file>          Output file (default: input-file with '-refined' suffix)
-m, --mode <mode>            Transformation mode: hash, minimal, or debug (default: hash)
-d, --debug-symbol <symbol>  Symbol to use for debug mode (default: _)
-p, --prefix <prefix>        Prefix to add after debug symbol in debug mode
-s, --suffix <suffix>        Suffix to add at the end in debug mode
--seed <number>              Seed for hash generation in hash mode
--minify                     Minify the output CSS (default: true)
--source-map                 Generate source map
--conversion-tables <file>   JSON file with existing conversion tables to preserve mappings
--save-tables <file>         Save the conversion tables to a JSON file
```

### Examples

```bash
# Basic usage with default options
css-seasoning styles.css

# Use minimal mode and specify output file
css-seasoning -o output.css -m minimal styles.css

# Debug mode with custom debug symbol
css-seasoning --mode debug --debug-symbol "_d_" styles.css

# Save and reuse conversion tables
css-seasoning styles.css --save-tables tables.json
css-seasoning other.css --conversion-tables tables.json
```

## ⭐ TODO

- [ ] Combine Selectors
- [ ] Allow selector patterns, eg. convert `.class #id` to `.newClass`
- [ ] Add CLI tests
- [ ] Publish to JSR


## 🐛 Known Issues

- Waiting for you 

<!-- ## 💖 Sponsors

Thank you to all the sponsors who support this project.

#### Organizations (0)
<table>
  <tr>
  <td align="center">
    <a href="https://github.com/xxxx">
      <img src="https://avatars.githubusercontent.com/u/147973044?v=4" width="100" alt=""/>
      <br><sub><b>username</b></sub>
    </a>
  </td>
  </tr>
</table>

#### Individuals (0)
<table>
  <tr>
  <td align="center">
    <a href="https://github.com/xxxx">
      <img src="https://avatars.githubusercontent.com/u/147973044?v=4" width="100" alt=""/>
      <br><sub><b>username</b></sub>
    </a>
  </td>
  </tr>
</table>

## 🦾 Special Thanks
<table>
  <tr>
  <td align="center">
    <a href="https://github.com/xxxx">
      <img src="https://avatars.githubusercontent.com/u/147973044?v=4" width="100" alt=""/>
      <br><sub><b>username</b></sub>
    </a>
  </td>
  </tr>
</table> -->

## 🤝 Contributing

Contributions are welcome! If you find a bug or have a feature request, please open an issue. If you want to contribute code, please fork the repository and run `deno run fmt` & `deno run test` before submitting a pull request.

We are following [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) for commit messages.

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=soranoo/css-seasoning&type=Date)](https://star-history.com/#soranoo/css-seasoning&Date)

## ☕ Donation

Love it? Consider a donation to support my work.

[!["Donation"](https://raw.githubusercontent.com/soranoo/Donation/main/resources/image/DonateBtn.png)](https://github.com/soranoo/Donation) <- click me~
