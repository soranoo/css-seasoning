module.exports = { 
  extends: ["@commitlint/config-conventional"],
  rules: {
    "header-max-length": [1, "always", 160],
  },
  helpUrl: "https://www.conventionalcommits.org/",
};
