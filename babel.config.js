module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    env: {
      // Release builds only (EAS sets BABEL_ENV/NODE_ENV=production). Strips
      // every console.* call from the bundle so PHI / request bodies that were
      // logged for debugging never reach the device system log in production.
      // Real error reporting goes through Sentry, not console.
      production: {
        plugins: ["transform-remove-console"],
      },
    },
  };
};
