module.exports = {
  branches: [
    { name: "main" },
    { name: "beta", prerelease: true },
  ],
  plugins: [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    // "@sebbo2002/semantic-release-jsr",
    [
      "@semantic-release/npm",
      {
        npmPublish: true,
        pkgRoot: "dist/npm",
      },
    ],
    [
      "@semantic-release/git",
      {
        message: "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
        assets: ["package.json", "CHANGELOG.md"],
      },
    ],
    "@semantic-release/github",
    // [
    //   "@semantic-release/exec",
    //   {
    //     prepareCmd: "deno run test && deno run build:npm",
    //   },
    // ],
  ],
}
