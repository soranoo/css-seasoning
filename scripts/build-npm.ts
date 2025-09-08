import { build, emptyDir } from "@deno/dnt";
import pkg from "../deno.json" with { type: "json" }

const BASE_PATH = "./dist/npm";

/**
 * Recursively copy all files and subfolders from src to dest.
 * @param src - Source directory path
 * @param dest - Destination directory path
 */
const copyDir = (src: string, dest: string) => {
  Deno.mkdirSync(dest, { recursive: true });
  for (const entry of Deno.readDirSync(src)) {
  const srcPath = `${src}/${entry.name}`;
  const destPath = `${dest}/${entry.name}`;
  if (entry.isFile) {
    Deno.copyFileSync(srcPath, destPath);
  } else if (entry.isDirectory) {
    copyDir(srcPath, destPath);
  }
  }
};


await emptyDir(`${BASE_PATH}`);

await build({
  entryPoints: ["./mod.ts", "./cli.ts"],
  importMap: "deno.json",
  outDir: `${BASE_PATH}`,
  rootTestDir: "./folder-that-never-exists", // To avoid the test folder getting checked for top-level await
  typeCheck: false,
  packageManager: "npm",
  shims: {
    // see JS docs for overview and more options
    deno: true,
  },
  package: {
    // package.json properties
    name: "css-seasoning",
    description: pkg.description,
    license: pkg.license,
    author: "soranoo (Freeman)",
    bin: {
      "css-seasoning": "./bin/cli.mjs",
    },
    keywords: ["css", "transform", "deno"],
    repository: {
      type: "git",
      url: "git+https://github.com/soranoo/css-seasoning.git",
    },
    bugs: {
      url: "https://github.com/soranoo/css-seasoning/issues",
    },
  },
  postBuild() {
    // steps to run after building and before running the tests
    Deno.copyFileSync("LICENSE", `${BASE_PATH}/LICENSE`);
    Deno.copyFileSync("README.md", `${BASE_PATH}/README.md`);
    Deno.copyFileSync(".npmignore", `${BASE_PATH}/.npmignore`);

    Deno.mkdirSync(`${BASE_PATH}/bin`, { recursive: true });
    copyDir("./bin", `${BASE_PATH}/bin`);
  },
});
